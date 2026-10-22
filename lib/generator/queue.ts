import { toast } from 'sonner';
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
  errorDetails?: string;
  httpStatus?: number;
  currentStage?: string;
  modelUsed?: string;
  retryCount: number;

  // Compliance & SEO fields
  flags?: AiVisualFlags;
  flagReasons?: string[];
  dhash?: string;
  isExcluded?: boolean;
  manualInclude?: boolean;
  approvedIssues?: string[];
  seoScore?: number;
  seoChecklist?: SeoCheckItem[];
  similarTo?: SimilarTitleMatch[];
  blockedTermsFound?: BlockedTermMatch[];

  // Vector support fields
  isVector?: boolean;
  vectorType?: 'svg' | 'eps' | 'ai';
  needsPreview?: boolean;
  needsPreviewMessage?: string;
  previewSource?: 'paired' | 'embedded' | 'pdf' | 'svg';
  isLowResPreview?: boolean;
  pairedPreviewName?: string;
  svgRasterFailed?: boolean;
  isConvertingVector?: boolean;
  isConverting?: boolean;
  convertingProgress?: string;

  // Video support fields
  isVideo?: boolean;
  videoFrameFailed?: boolean;

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
  currentStage?: string;
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
  onOutOfCredits?: (balance: number) => void;
  onCreditsRemaining?: (creditsRemaining: number) => void;
}

export function isItemExcluded(
  item: GeneratorItemState,
  minSizeCheck: 'exclude' | 'warn' | 'off' = 'exclude'
): boolean {
  if (item.manualInclude) return false;
  // Vector files and video files are NEVER subject to the 4 MP size check or any size-based exclusion
  const isVector = item.isVector || item.fileData?.isVector;
  const isVideo = item.isVideo || item.fileData?.isVideo;
  if (isVector || isVideo) return false;

  const isUnder4MpReason =
    item.excludedReason === "Below Adobe's 4 MP minimum, likely refused" ||
    Boolean(item.excludedReason?.includes('4 MP')) ||
    Boolean(item.excludedReason?.includes('4MP'));

  if (minSizeCheck !== 'exclude' && isUnder4MpReason) {
    return false;
  }
  if (item.isExcluded) {
    if (minSizeCheck !== 'exclude' && isUnder4MpReason) {
      return false;
    }
    return true;
  }
  if (minSizeCheck === 'exclude' && item.fileData.width > 0 && item.fileData.height > 0) {
    const mp = (item.fileData.width * item.fileData.height) / 1_000_000;
    if (mp < 4.0) return true;
  }
  return false;
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
  private currentStage = '';
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
    this.broadcastProgress('Generation paused. Completed results are preserved.');
  }

  resume() {
    if (!this.isRunning || !this.isPaused) return;
    this.isPaused = false;
    this.callbacks.onStateChange?.(true, false);
    if (this.resumeResolve) {
      this.resumeResolve();
      this.resumeResolve = null;
    }
    this.broadcastProgress('Resuming sequential processing...');
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
    this.currentStage = '';
    this.callbacks.onStateChange?.(false, false);
    this.broadcastProgress('Generation stopped. Completed items preserved.');
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
      (i) => (i.status === 'queued' || i.status === 'working') && !isItemExcluded(i)
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
      currentStage: this.currentStage || undefined,
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

  async start(limit?: number): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.abortController = new AbortController();
    this.callbacks.onStateChange?.(true, false);

    // Strictly process pending items (queued or failed), never sending excluded images
    // Done items are preserved without duplication; vector items without preview are skipped until attached
    const activeMinSizeCheck = this.settings.minSizeCheck || (this.settings.platform === 'adobe-stock' ? 'exclude' : 'warn');
    const allPending = this.items.filter(
      (i) =>
        (i.status === 'queued' || i.status === 'failed') &&
        !i.needsPreview &&
        !i.isConvertingVector &&
        !i.svgRasterFailed &&
        !isItemExcluded(i, activeMinSizeCheck)
    );
    const pendingItems = limit !== undefined && limit > 0 ? allPending.slice(0, limit) : allPending;

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
      const overallIndex = this.items.findIndex((it) => it.id === item.id);
      this.currentItemIndex = overallIndex !== -1 ? overallIndex + 1 : i + 1;
      this.currentFilename = item.fileData.originalName;

      // Do not charge for or send excluded or skipped images, or vectors without preview
      if (item.needsPreview || item.isConvertingVector || item.svgRasterFailed || item.isExcluded || isItemExcluded(item, activeMinSizeCheck)) {
        continue;
      }

      this.currentStage = `Processing Image ${this.currentItemIndex} of ${this.items.length}`;
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
        // Failed items are also saved immediately with error details
        await saveBatchItem(item);
      }

      this.broadcastProgress();
    }

    this.isRunning = false;
    this.isPaused = false;
    this.currentFilename = '';
    this.currentKeyInfo = '';
    this.currentStage = '';
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
    item.currentStage = 'Connecting to Gemini AI...';
    item.errorMessage = undefined;
    item.errorDetails = undefined;
    item.httpStatus = undefined;
    this.callbacks.onItemUpdate({ ...item });

    let attempts = 0;
    const maxServerAttempts = 3;

    // Last 15 generated titles to avoid repetitive phrasing
    const recentTitles = this.items
      .filter((i) => i.status === 'done' && i.title?.trim())
      .map((i) => i.title.trim())
      .slice(-15);

    while (this.isRunning && !this.abortController?.signal.aborted) {
      await this.checkPause();
      if (!this.isRunning || this.abortController?.signal.aborted) break;

      // Obtain next key sequentially via controlled round-robin
      let keyInfo = await keyRotator.getNextKey();

      // If all keys are resting, wait with live countdown
      if (keyInfo.allResting) {
        this.isCoolingDown = true;
        const cooldownDesc = keyInfo.isSharedRateLimit ? 'Shared project quota cooldown' : 'All API keys resting';
        item.currentStage = `${cooldownDesc}. Waiting for cooldown...`;
        this.callbacks.onItemUpdate({ ...item });

        keyInfo = await keyRotator.waitForNextAvailableKey(
          this.abortController?.signal,
          (sec, reason) => {
            this.cooldownSeconds = sec;
            this.cooldownReason = reason;
            item.currentStage = `${cooldownDesc} (${sec}s remaining)...`;
            this.callbacks.onItemUpdate({ ...item });
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
      item.currentStage = `Sending request using ${this.currentKeyInfo}...`;
      this.callbacks.onItemUpdate({ ...item });
      this.broadcastProgress(`Generating with ${this.currentKeyInfo}...`);

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
            modelFallback: this.settings.modelFallback ?? true,
            apiKey: keyInfo?.apiKey,

            // Compliance & Uniqueness
            existingTitles: recentTitles,
            uniqueness: this.settings.titleUniqueness || 'normal',
            contributorLanguage: this.settings.contributorLanguage || 'en',
            isAiBatch: this.settings.isAiBatch || false,
            customBlockedWords: this.settings.customBlockedWords || [],
          }),
        });

        // Handle 401 Unauthorized
        if (res.status === 401) {
          toast.error('Session expired or unauthorized. Please log in.');
          item.status = 'failed';
          item.httpStatus = 401;
          item.errorMessage = 'Unauthorized: Please log in to your account.';
          this.callbacks.onItemUpdate({ ...item });
          this.stop();
          if (typeof window !== 'undefined') {
            window.location.assign('/login');
          }
          return false;
        }

        const resData = await res.json().catch(() => ({}));
        if (typeof resData?.creditsRemaining === 'number') {
          this.callbacks.onCreditsRemaining?.(resData.creditsRemaining);
        }

        // Handle 402 Out of credits
        if (res.status === 402) {
          const balance =
            typeof resData?.error?.balance === 'number'
              ? resData.error.balance
              : 0;
          item.status = 'failed';
          item.httpStatus = 402;
          item.errorMessage = 'Out of credits. Contact support to add more.';
          this.callbacks.onItemUpdate({ ...item });
          this.stop();
          this.callbacks.onOutOfCredits?.(balance);
          return false;
        }

        // Handle 429 Rate Limit / Quota Exhaustion
        if (res.status === 429) {
          const retryAfterSec =
            resData?.error?.retryAfterSeconds ||
            parseInt(res.headers.get('Retry-After') || '30', 10) ||
            30;

          if (resData?.error?.code === 'DAILY_QUOTA_EXHAUSTED') {
            await keyRotator.markKeyDailyExhausted(keyInfo?.keyId);
            const nextKeyCheck = await keyRotator.getNextKey();
            if (nextKeyCheck.apiKey) {
              item.currentStage = `Key reached daily quota. Switching to ${nextKeyCheck.maskedKey}...`;
              this.callbacks.onItemUpdate({ ...item });
              continue;
            } else {
              item.status = 'failed';
              item.httpStatus = 429;
              item.errorMessage = resData?.error?.message || 'Daily quota exhausted on all configured keys.';
              item.errorDetails = 'Quota resets at midnight UTC. Add another key in Settings to continue.';
              this.callbacks.onItemUpdate({ ...item });
              return false;
            }
          }

          // Temporary RPM / TPM rate limit
          const cooldownWait = await keyRotator.markKeyRateLimited(keyInfo?.keyId, retryAfterSec);
          item.currentStage = `Rate limit reached. Cooling down for ${cooldownWait}s...`;
          this.callbacks.onItemUpdate({ ...item });

          const nextKeyCheck = await keyRotator.getNextKey();
          if (nextKeyCheck.allResting) {
            await this.waitWithCountdown(
              cooldownWait,
              `Gemini quota cooldown: waiting ${cooldownWait}s before resuming`
            );
          } else {
            // Wait 2s jitter before trying next rotated key
            await new Promise((r) => setTimeout(r, 2000));
          }
          // Do not fail the item for standard rate limits - retry the same item
          continue;
        }

        // Handle 401 / 403 Authentication Error
        if (res.status === 401 || res.status === 403) {
          await keyRotator.markKeyInvalid(keyInfo?.keyId);
          const nextKeyCheck = await keyRotator.getNextKey();

          if (nextKeyCheck.apiKey) {
            item.currentStage = 'Invalid API key detected. Switched to next valid key...';
            this.callbacks.onItemUpdate({ ...item });
            continue;
          } else {
            item.status = 'failed';
            item.httpStatus = res.status;
            item.errorMessage = 'HTTP 401: Invalid API Key. Authentication failed.';
            item.errorDetails = 'Please enter a valid Gemini API key in Settings.';
            this.callbacks.onItemUpdate({ ...item });
            return false;
          }
        }

        // Handle 400 Bad Request (permanent failure, do not retry)
        if (res.status === 400) {
          item.status = 'failed';
          item.httpStatus = 400;
          item.errorMessage = `HTTP 400: ${resData?.error?.message || 'Invalid image or prompt payload'}`;
          this.callbacks.onItemUpdate({ ...item });
          return false;
        }

        // Handle 500 / 503 Server Error
        if (!res.ok) {
          attempts++;
          if (attempts >= maxServerAttempts) {
            item.status = 'failed';
            item.httpStatus = res.status;
            item.errorMessage = `HTTP ${res.status}: ${resData?.error?.message || 'Gemini server error'}`;
            this.callbacks.onItemUpdate({ ...item });
            return false;
          }

          // Exponential backoff with jitter
          const backoff = 1500 * Math.pow(2, attempts) + Math.random() * 1000;
          item.currentStage = `Server error ${res.status}. Retrying in ${Math.round(backoff / 1000)}s (attempt ${attempts}/${maxServerAttempts})...`;
          this.callbacks.onItemUpdate({ ...item });
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }

        // Request Succeeded!
        await keyRotator.recordKeySuccess(keyInfo?.keyId);
        item.modelUsed = resData.modelUsed;

        if (this.settings.mode === 'metadata') {
          const resItem = resData.metadataSets?.[0];
          if (resItem) {
            item.title = resItem.title || '';
            item.description = resItem.description || '';
            item.keywords = resItem.keywords || [];
            item.flags = resItem.flags;
            item.flagReasons = resItem.flagReasons;
            item.status = 'done';
            item.currentStage = undefined;
            item.errorMessage = undefined;
            item.errorDetails = undefined;
            item.httpStatus = undefined;

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

            // Resolution check (skipped for vector items)
            const isVector = item.isVector || item.fileData?.isVector;
            const activeMinSizeCheck = this.settings.minSizeCheck || (this.settings.platform === 'adobe-stock' ? 'exclude' : 'warn');
            const mp = (item.fileData.width * item.fileData.height) / 1_000_000;
            if (!isVector && !item.manualInclude && activeMinSizeCheck === 'exclude' && item.fileData.width > 0 && item.fileData.height > 0 && mp < 4.0) {
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
          const promptItem = resData.prompts?.[0];
          if (promptItem) {
            item.prompt = promptItem.prompt || '';
            item.status = 'done';
            item.currentStage = undefined;
            item.errorMessage = undefined;
            item.errorDetails = undefined;
            item.httpStatus = undefined;
            this.callbacks.onItemUpdate({ ...item });
            return true;
          }
          throw new Error('No prompt returned in Gemini response');
        }
      } catch (err: unknown) {
        if (this.abortController?.signal.aborted) {
          item.status = 'queued';
          item.currentStage = undefined;
          this.callbacks.onItemUpdate({ ...item });
          return false;
        }

        attempts++;
        if (attempts >= maxServerAttempts) {
          item.status = 'failed';
          item.currentStage = undefined;
          item.errorMessage = err instanceof Error ? err.message : 'Network error';
          this.callbacks.onItemUpdate({ ...item });
          return false;
        }

        const backoffMs = 1500 * Math.pow(2, attempts) + Math.random() * 1000;
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }

    return false;
  }
}
