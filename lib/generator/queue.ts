import { ProcessedAssetFile } from './compress';
import { GeneratorSavedSettings, saveBatchItem } from './db';
import { keyRotator } from './key-rotation';
import { scanItemCompliance } from '@/lib/compliance/scan';
import { calculateItemSeoScore } from './seo-score';
import { computeDHash } from '@/lib/compliance/phash';
import { ImageFingerprint, PairwiseSimilarityScore } from '@/types/similarity';

export interface AiVisualFlags {
  identifiablePerson: boolean;
  privateProperty: boolean;
  visibleLogoOrBrand: boolean;
  visibleText: boolean;
  visibleTextOrLogo?: boolean;
  possibleEditorial: boolean;
  showsAiConcept?: boolean;
}

export interface BlockedTermMatch {
  term: string;
  category: string;
  field: 'title' | 'keywords' | 'description' | 'prompt';
  isAmbiguous: boolean;
}

export interface SimilarTitleMatch {
  otherId: string;
  otherFilename: string;
  score: number;
  reason: 'high_similarity' | 'same_opening_words' | 'keyword_overlap';
}

export interface SeoCheckItem {
  id: string;
  name: string;
  passed: boolean;
  reason: string;
}

export interface GeneratorItemState {
  id: string;
  fileData: ProcessedAssetFile;
  status: 'queued' | 'working' | 'done' | 'failed';
  title: string;
  description: string;
  keywords: string[];
  prompt: string;
  errorMessage?: string;
  retryCount: number;

  // Compliance & SEO fields
  flags?: AiVisualFlags;
  flagReasons?: string[];
  dhash?: string;
  isExcluded?: boolean;
  approvedIssues?: string[];
  seoScore?: number;
  seoChecklist?: SeoCheckItem[];
  similarTo?: SimilarTitleMatch[];
  blockedTermsFound?: BlockedTermMatch[];

  // Deep Similarity Guard fields
  fingerprint?: ImageFingerprint;
  similarityClusterId?: string;
  isKeptBest?: boolean;
  excludedReason?: string;
  similarPairDetails?: PairwiseSimilarityScore[];
  aiReviewReason?: string;
}

export interface QueueProgressState {
  total: number;
  completed: number;
  pending: number;
  failed: number;
  currentIndex: number;
  currentFilename?: string;
  currentKeyInfo?: string;
  isGenerating: boolean;
  isPaused: boolean;
  isCoolingDown: boolean;
  cooldownSecondsRemaining?: number;
  cooldownReason?: string;
  statusMessage: string;
}

export interface QueueCallbacks {
  onItemUpdate: (item: GeneratorItemState) => void;
  onItemCompleted?: (item: GeneratorItemState) => void;
  onComplete: () => void;
  onProgress?: (doneCount: number, totalCount: number, failedCount: number) => void;
  onProgressUpdate?: (state: QueueProgressState) => void;
  onStateChange?: (isGenerating: boolean, isPaused: boolean) => void;
}

export class GeneratorQueue {
  private items: GeneratorItemState[] = [];
  private settings: GeneratorSavedSettings;
  private callbacks: QueueCallbacks;
  private abortController: AbortController | null = null;
  private isRunning = false;
  private isPaused = false;
  private resumeResolve: (() => void) | null = null;
  private currentItemIndex = 0;
  private currentFilename = '';
  private currentKeyInfo = '';
  private isCoolingDown = false;
  private cooldownSeconds = 0;
  private cooldownReason = '';

  constructor(items: GeneratorItemState[], settings: GeneratorSavedSettings, callbacks: QueueCallbacks) {
    this.items = items;
    this.settings = settings;
    this.callbacks = callbacks;
  }

  updateSettings(settings: GeneratorSavedSettings) {
    this.settings = settings;
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  getIsPaused(): boolean {
    return this.isPaused;
  }

  pause() {
    if (!this.isRunning || this.isPaused) return;
    this.isPaused = true;
    this.callbacks.onStateChange?.(true, true);
    this.broadcastProgress('Generation paused. Click Resume to continue.');
  }

  resume() {
    if (!this.isRunning || !this.isPaused) return;
    this.isPaused = false;
    this.callbacks.onStateChange?.(true, false);
    if (this.resumeResolve) {
      this.resumeResolve();
      this.resumeResolve = null;
    }
    this.broadcastProgress('Resuming generation...');
  }

  stop() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isRunning = false;
    this.isPaused = false;
    if (this.resumeResolve) {
      this.resumeResolve();
      this.resumeResolve = null;
    }
    this.isCoolingDown = false;
    this.currentKeyInfo = '';
    this.callbacks.onStateChange?.(false, false);
    this.broadcastProgress('Generation stopped');
  }

  private async checkPause(): Promise<void> {
    if (!this.isPaused) return;
    await new Promise<void>((resolve) => {
      this.resumeResolve = resolve;
    });
  }

  private broadcastProgress(overrideMessage?: string) {
    const completed = this.items.filter(
      (i) => i.status === 'done' && Boolean(i.title?.trim())
    ).length;
    const failed = this.items.filter((i) => i.status === 'failed').length;
    const pending = this.items.filter(
      (i) => i.status === 'queued' || i.status === 'working'
    ).length;

    let msg = overrideMessage;
    if (!msg) {
      if (this.isCoolingDown) {
        msg = this.cooldownReason || `Cooling down (${this.cooldownSeconds}s left)...`;
      } else if (this.isPaused) {
        msg = 'Paused. Completed items preserved.';
      } else if (this.currentFilename) {
        msg = `Processing: ${this.currentFilename} (${this.currentItemIndex || completed + 1} of ${this.items.length})`;
      } else {
        msg = `Processed ${completed} of ${this.items.length} images`;
      }
    }

    const state: QueueProgressState = {
      total: this.items.length,
      completed,
      pending,
      failed,
      currentIndex: this.currentItemIndex,
      currentFilename: this.currentFilename,
      currentKeyInfo: this.currentKeyInfo || undefined,
      isGenerating: this.isRunning,
      isPaused: this.isPaused,
      isCoolingDown: this.isCoolingDown,
      cooldownSecondsRemaining: this.cooldownSeconds > 0 ? this.cooldownSeconds : undefined,
      cooldownReason: this.cooldownReason || undefined,
      statusMessage: msg,
    };

    this.callbacks.onProgress?.(completed, this.items.length, failed);
    this.callbacks.onProgressUpdate?.(state);
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.abortController = new AbortController();
    this.callbacks.onStateChange?.(true, false);

    // Strictly process pending items (status = queued or failed)
    // Completed items (status = done) are preserved without duplication
    const pendingItems = this.items.filter((i) => i.status === 'queued' || i.status === 'failed');

    if (pendingItems.length === 0) {
      this.isRunning = false;
      this.callbacks.onStateChange?.(false, false);
      this.broadcastProgress('All images already completed.');
      this.callbacks.onComplete();
      return;
    }

    this.broadcastProgress(`Starting sequential processing of ${pendingItems.length} image(s)...`);

    // Strictly sequential: Process images one by one
    for (let i = 0; i < pendingItems.length; i++) {
      if (!this.isRunning || this.abortController?.signal.aborted) break;
      await this.checkPause();
      if (!this.isRunning || this.abortController?.signal.aborted) break;

      const item = pendingItems[i];
      // Accurate overall index in the entire batch (e.g., Image 3 of 20)
      const overallIndex = this.items.findIndex((it) => it.id === item.id);
      this.currentItemIndex = overallIndex !== -1 ? overallIndex + 1 : i + 1;
      this.currentFilename = item.fileData.originalName;

      // Skip AI generation if excluded by deep similarity guard to save quota
      if (this.settings.skipAiGenerationForExcluded && item.isExcluded) {
        item.status = 'queued';
        this.callbacks.onItemUpdate({ ...item });
        continue;
      }

      this.broadcastProgress(`Generating metadata for Image ${this.currentItemIndex} of ${this.items.length}: ${item.fileData.originalName}...`);

      const success = await this.processSingleItem(item);

      if (success) {
        // Immediately save result to IndexedDB so browser refresh preserves it
        await saveBatchItem(item);
        this.callbacks.onItemCompleted?.(item);

        // Configurable delay (default: 10s) before processing the next image
        const delaySec = this.settings.interImageDelaySeconds ?? 10;
        if (i < pendingItems.length - 1 && delaySec > 0 && this.isRunning && !this.abortController?.signal.aborted) {
          await this.waitWithCountdown(
            delaySec,
            `Waiting ${delaySec}s before next image to prevent API rate limits`
          );
        }
      } else {
        // Failed items are also saved immediately with error state
        await saveBatchItem(item);
      }

      this.broadcastProgress();
    }

    this.isRunning = false;
    this.isPaused = false;
    this.currentFilename = '';
    this.currentKeyInfo = '';
    this.isCoolingDown = false;
    this.callbacks.onStateChange?.(false, false);
    this.broadcastProgress('Processing sequence finished.');
    this.callbacks.onComplete();
  }

  // Live countdown timer with pause & abort awareness
  private async waitWithCountdown(totalSeconds: number, label: string): Promise<void> {
    this.isCoolingDown = true;
    this.cooldownSeconds = totalSeconds;
    this.cooldownReason = `${label} (${totalSeconds}s remaining)...`;
    this.broadcastProgress();

    for (let sec = totalSeconds; sec > 0; sec--) {
      if (!this.isRunning || this.abortController?.signal.aborted) break;
      await this.checkPause();
      if (!this.isRunning || this.abortController?.signal.aborted) break;

      this.cooldownSeconds = sec;
      this.cooldownReason = `${label} (${sec}s remaining)...`;
      this.broadcastProgress();

      await new Promise((r) => setTimeout(r, 1000));
    }

    this.isCoolingDown = false;
    this.cooldownSeconds = 0;
    this.cooldownReason = '';
    this.broadcastProgress();
  }

  private async processSingleItem(item: GeneratorItemState): Promise<boolean> {
    item.status = 'working';
    item.errorMessage = undefined;
    this.callbacks.onItemUpdate({ ...item });

    let attempts = 0;
    const maxAttempts = 3;

    // Last 15 generated titles to avoid repetitive phrasing
    const recentTitles = this.items
      .filter((i) => i.status === 'done' && i.title?.trim())
      .map((i) => i.title.trim())
      .slice(-15);

    while (attempts < maxAttempts && this.isRunning && !this.abortController?.signal.aborted) {
      await this.checkPause();
      if (!this.isRunning || this.abortController?.signal.aborted) break;

      // Obtain next key sequentially via controlled round-robin
      let keyInfo = await keyRotator.getNextKey();

      // If all keys are resting or shared rate limit is reached, wait with live countdown
      if (keyInfo.allResting) {
        this.isCoolingDown = true;
        this.currentKeyInfo = keyInfo.isSharedRateLimit ? 'Shared Quota Cooldown' : 'All Keys Resting';
        keyInfo = await keyRotator.waitForNextAvailableKey(
          this.abortController?.signal,
          (sec, reason) => {
            this.cooldownSeconds = sec;
            this.cooldownReason = reason;
            this.broadcastProgress();
          }
        );
        this.isCoolingDown = false;
        this.cooldownSeconds = 0;
        this.cooldownReason = '';
        this.broadcastProgress();
      }

      if (this.abortController?.signal.aborted) break;

      this.currentKeyInfo = keyInfo?.maskedKey || (keyInfo?.isDefaultEnv ? 'Default Key (Server Env)' : 'Gemini Key');
      this.broadcastProgress(`Generating with ${this.currentKeyInfo}...`);

      attempts++;

      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: this.abortController?.signal,
          body: JSON.stringify({
            mode: this.settings.mode,
            images: [item.fileData.aiDataUrl],
            platform: this.settings.platform,
            titleMaxLength: this.settings.titleLength,
            descriptionLength: 150,
            keywordsMaxCount: this.settings.keywordsCount,
            hasAlphaChannel: [item.fileData.hasAlphaChannel],
            titlePrefix: this.settings.titlePrefix,
            isPrefixEnabled: this.settings.isPrefixEnabled,
            titleSuffix: this.settings.titleSuffix,
            isSuffixEnabled: this.settings.isSuffixEnabled,
            negativeTitleWords: this.settings.negativeTitleWords,
            isNegativeTitleWordsEnabled: this.settings.isNegativeTitleWordsEnabled,
            negativeKeywords: this.settings.negativeKeywords,
            isNegativeKeywordsEnabled: this.settings.isNegativeKeywordsEnabled,
            additionalKeywords: this.settings.additionalKeywords,
            isAdditionalKeywordsEnabled: this.settings.isAdditionalKeywordsEnabled,
            promptMaxLength: this.settings.promptLength,
            negativePromptWords: this.settings.negativePromptWords,
            isNegativePromptWordsEnabled: this.settings.isNegativePromptWordsEnabled,
            whiteBackground: this.settings.whiteBackground,
            cameraParams: this.settings.cameraParams,
            promptPrefix: this.settings.promptPrefix,
            isPromptPrefixEnabled: this.settings.isPromptPrefixEnabled,
            promptSuffix: this.settings.promptSuffix,
            isPromptSuffixEnabled: this.settings.isPromptSuffixEnabled,
            model: this.settings.selectedModel,
            apiKey: keyInfo?.apiKey,

            // Compliance & Uniqueness
            existingTitles: recentTitles,
            uniqueness: this.settings.titleUniqueness || 'normal',
            contributorLanguage: this.settings.contributorLanguage || 'en',
            isAiBatch: this.settings.isAiBatch || false,
            customBlockedWords: this.settings.customBlockedWords || [],
          }),
        });

        const errData = !res.ok ? await res.json().catch(() => ({})) : null;

        // Handle 429 Rate Limit
        if (res.status === 429) {
          const retryAfterSec =
            errData?.error?.retryAfterSeconds ||
            parseInt(res.headers.get('Retry-After') || '30', 10) ||
            30;

          const cooldownWait = await keyRotator.markKeyRateLimited(keyInfo?.keyId, retryAfterSec);

          if (attempts < maxAttempts) {
            // Check if other keys are available or wait
            const nextKeyCheck = await keyRotator.getNextKey();
            if (nextKeyCheck.allResting) {
              await this.waitWithCountdown(
                cooldownWait || retryAfterSec,
                `Gemini quota rate limit reached. Pausing for cooldown`
              );
            } else {
              // Wait short 2s jitter before trying next rotated key
              await new Promise((r) => setTimeout(r, 2000));
            }
            continue;
          }
        }

        // Handle 401 / 403 Authentication Error (Permanent invalid key)
        if (res.status === 401 || res.status === 403) {
          await keyRotator.markKeyInvalid(keyInfo?.keyId);
          // Do not count auth failure against image retry limit
          attempts--;
          continue;
        }

        // Handle Daily Quota Exhausted
        if (errData?.error?.code === 'DAILY_QUOTA_EXHAUSTED') {
          await keyRotator.markKeyDailyExhausted(keyInfo?.keyId);
          if (attempts < maxAttempts) {
            continue;
          }
        }

        // Handle other HTTP errors
        if (!res.ok) {
          throw new Error(errData?.error?.message || `HTTP ${res.status}`);
        }

        const data = await res.json();

        // Successful request - reset consecutive error count on this key
        await keyRotator.recordKeySuccess(keyInfo?.keyId);

        if (this.settings.mode === 'metadata') {
          const resItem = data.metadataSets?.[0];
          if (resItem) {
            item.title = resItem.title || '';
            item.description = resItem.description || '';
            item.keywords = resItem.keywords || [];
            item.flags = resItem.flags;
            item.flagReasons = resItem.flagReasons;
            item.status = 'done';
            item.errorMessage = undefined;

            // AI keyword hygiene
            const showsAi =
              Boolean(item.flags?.showsAiConcept) ||
              /\b(robot|robotics|cyborg|humanoid|android|neural network|machine learning|deep learning|cybernetic|synthetic intelligence|digital brain)\b/i.test(
                `${item.title} ${item.description}`
              );
            if (!showsAi && item.keywords) {
              const aiTerms = new Set(['ai', 'artificial intelligence', 'a.i.', 'artificial-intelligence']);
              item.keywords = item.keywords.filter((k) => !aiTerms.has(k.toLowerCase().trim()));
            }

            // Resolution check
            const mp = (item.fileData.width * item.fileData.height) / 1_000_000;
            if (item.fileData.width > 0 && item.fileData.height > 0 && mp < 4.0) {
              item.isExcluded = true;
              item.excludedReason = "Below Adobe's 4 MP minimum, likely refused";
            }

            // Compliance scanning
            if (this.settings.complianceGuard) {
              const comp = scanItemCompliance(
                item.title,
                item.keywords,
                item.description,
                this.settings.customBlockedWords || [],
                item.approvedIssues || [],
                this.settings.isAiBatch || false
              );
              item.blockedTermsFound = comp.blockedTerms;
            }

            const seo = calculateItemSeoScore(item);
            item.seoScore = seo.score;
            item.seoChecklist = seo.checklist;

            if (this.settings.detectDuplicates && item.fileData.aiDataUrl) {
              try {
                item.dhash = await computeDHash(item.fileData.aiDataUrl);
              } catch (e) {
                console.error('dHash computation error:', e);
              }
            }

            this.callbacks.onItemUpdate({ ...item });
            return true;
          }
          throw new Error('No metadata returned in Gemini response');
        } else {
          // Prompt mode
          const promptItem = data.prompts?.[0];
          if (promptItem) {
            item.prompt = promptItem.prompt || '';
            item.status = 'done';
            item.errorMessage = undefined;
            this.callbacks.onItemUpdate({ ...item });
            return true;
          }
          throw new Error('No prompt returned in Gemini response');
        }
      } catch (err: unknown) {
        if (this.abortController?.signal.aborted) {
          item.status = 'queued';
          this.callbacks.onItemUpdate({ ...item });
          return false;
        }

        if (attempts >= maxAttempts) {
          item.status = 'failed';
          item.errorMessage = err instanceof Error ? err.message : 'Generation failed';
          this.callbacks.onItemUpdate({ ...item });
          return false;
        }

        // Exponential backoff with jitter for temporary errors
        const backoffMs = 1500 * Math.pow(2, attempts) + Math.random() * 1000;
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }

    return false;
  }
}
