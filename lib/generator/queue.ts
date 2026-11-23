import { toast } from 'sonner';
import { ProcessedAssetFile } from './compress';
import { AiProvider, GeneratorSavedSettings, saveBatchItem } from './db';
import { keyRotator } from './key-rotation';
import { createClient as createBrowserSupabase } from '@/lib/supabase/client';
import { scanItemCompliance } from '@/lib/compliance/scan';
import { calculateItemSeoScore } from './seo-score';
import { computeDHash } from '@/lib/compliance/phash';
import { ImageFingerprint, PairwiseSimilarityScore } from '@/types/similarity';

// Generation limits (one place to tune them)
const REQUEST_TIMEOUT_MS = 75_000; // browser stops waiting for one image after 75 s (server gives up at ~30 s)
const MAX_RATE_LIMIT_WAITS = 3; // built-in key: wait and retry a "too many requests" reply at most 3 times

// Escape a word so it can be used safely inside a search pattern ("c++" or "a.i." would break it otherwise)
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

  const isUnder4MpReason =
    item.excludedReason === "Below Adobe's 4 MP minimum, likely refused" ||
    Boolean(item.excludedReason?.includes('4 MP')) ||
    Boolean(item.excludedReason?.includes('4MP'));

  if (item.isExcluded) {
    if (minSizeCheck !== 'exclude' && isUnder4MpReason) {
      // Ignore size exclusion if size check is not exclude
    } else {
      return true;
    }
  }

  // Vector files and video files skip only the size rule
  const isVector = item.isVector || item.fileData?.isVector;
  const isVideo = item.isVideo || item.fileData?.isVideo;
  if (isVector || isVideo) {
    return false;
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
  private maxParallel = 2;

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

  // Images waiting in the running batch (a single "Retry" can be added while it runs)
  private pendingItems: GeneratorItemState[] = [];
  private nextIndex = 0; // position of the next image to start in pendingItems

  // Add one image to the running batch, without restarting it. Returns false when it cannot be added.
  addItem(item: GeneratorItemState): boolean {
    if (!this.isRunning) return false;
    const idx = this.items.findIndex((it) => it.id === item.id);
    if (idx === -1) return false;
    // already waiting in this batch (not reached yet) or being processed right now: nothing to add
    const at = this.pendingItems.findIndex((p) => p.id === item.id);
    if (at >= this.nextIndex || (at !== -1 && this.pendingItems[at].status === 'working')) return true;
    this.items[idx] = item;
    this.pendingItems.push(item);
    return true;
  }

  async start(limit?: number, onlyIds?: string[]): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.abortController = new AbortController();
    this.maxParallel = this.settings.parallelImages ?? 2;
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
        !isItemExcluded(i, activeMinSizeCheck) &&
        // "Retry" on one image sends only that image, not every failed one
        (!onlyIds || onlyIds.includes(i.id))
    );
    const pendingItems = limit !== undefined && limit > 0 ? allPending.slice(0, limit) : allPending;
    this.pendingItems = pendingItems;

    if (pendingItems.length === 0) {
      this.isRunning = false;
      this.callbacks.onStateChange?.(false, false);
      this.broadcastProgress('All images already completed.');
      this.callbacks.onComplete();
      return;
    }

    this.broadcastProgress(`Starting parallel processing (${this.maxParallel} worker${this.maxParallel > 1 ? 's' : ''}) of ${pendingItems.length} image(s)...`);

    this.nextIndex = 0;
    const activeWorkers = new Set<Promise<void>>();

    const spawnWorker = () => {
      const worker = (async () => {
        while (this.isRunning && !this.abortController?.signal.aborted) {
          await this.checkPause();
          if (!this.isRunning || this.abortController?.signal.aborted) break;

          if (this.maxParallel === 1 && activeWorkers.size > 1) {
            break;
          }

          const currentIndex = this.nextIndex++;
          if (currentIndex >= pendingItems.length) break;

          const item = pendingItems[currentIndex];
          const overallIndex = this.items.findIndex((it) => it.id === item.id);
          this.currentItemIndex = overallIndex !== -1 ? overallIndex + 1 : currentIndex + 1;
          this.currentFilename = item.fileData.originalName;

          if (item.needsPreview || item.isConvertingVector || item.svgRasterFailed || item.isExcluded || isItemExcluded(item, activeMinSizeCheck)) {
            continue;
          }

          this.currentStage = `Processing Image ${this.currentItemIndex} of ${this.items.length}`;
          this.broadcastProgress(`Generating metadata for Image ${this.currentItemIndex} of ${this.items.length}: ${item.fileData.originalName}...`);

          // One image must never stop the whole batch, whatever goes wrong with it
          let success = false;
          try {
            success = await this.processSingleItem(item);
          } catch (err) {
            console.error('Unexpected error for one image (batch continues):', err);
            if (item.status === 'working') item.status = item.title?.trim() || item.prompt?.trim() ? 'done' : 'failed';
            success = item.status === 'done';
          }

          if (success) {
            await saveBatchItem(item);
            this.callbacks.onItemCompleted?.(item);

            const delaySec = this.settings.interImageDelaySeconds ?? 10;
            if (delaySec > 0 && this.isRunning && !this.abortController?.signal.aborted) {
              await this.sleep(delaySec * 1000);
            }
          } else {
            await saveBatchItem(item);
          }

          this.broadcastProgress();
        }
      })().finally(() => {
        activeWorkers.delete(worker);
      });

      activeWorkers.add(worker);
    };

    const initialWorkers = Math.min(this.maxParallel, pendingItems.length);
    for (let w = 0; w < initialWorkers; w++) {
      spawnWorker();
    }

    // Keep workers going until every image (including ones added with "Retry" during the batch) is handled
    while (this.isRunning && !this.abortController?.signal.aborted) {
      if (this.nextIndex < pendingItems.length) {
        if (this.maxParallel > activeWorkers.size) spawnWorker();
        await this.sleep(200);
        continue;
      }
      if (activeWorkers.size === 0) break;
      await Promise.race(Array.from(activeWorkers).map((w) => w.catch(() => undefined)));
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

  private async sleep(ms: number): Promise<void> {
    if (this.abortController?.signal.aborted) return;
    const signal = this.abortController?.signal;
    return new Promise((resolve) => {
      const abortHandler = () => {
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        // remove the stop listener again, so long batches do not pile up listeners
        signal?.removeEventListener('abort', abortHandler);
        resolve();
      }, ms);
      signal?.addEventListener('abort', abortHandler, { once: true });
    });
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

      await this.sleep(1000);
    }

    this.isCoolingDown = false;
    this.cooldownSeconds = 0;
    this.cooldownReason = '';
    this.broadcastProgress();
  }

  private async processSingleItem(item: GeneratorItemState): Promise<boolean> {
    let currentProvider: AiProvider = this.settings.aiProvider || 'gemini';

    item.status = 'working';
    item.currentStage = `Connecting to ${currentProvider === 'grok' ? 'Groq' : 'Gemini AI'}...`;
    item.errorMessage = undefined;
    item.errorDetails = undefined;
    item.httpStatus = undefined;
    this.callbacks.onItemUpdate({ ...item });

    let attempts = 0;
    const maxServerAttempts = 3;
    let rateLimitWaits = 0;
    let authRetries = 0; // how many times we refreshed the login for this image

    // Last 40 generated titles to avoid repetitive phrasing
    const recentTitles = this.items
      .filter((i) => i.status === 'done' && i.title?.trim())
      .map((i) => i.title.trim())
      .slice(-40);

    while (this.isRunning && !this.abortController?.signal.aborted) {
      await this.checkPause();
      if (!this.isRunning || this.abortController?.signal.aborted) break;

      const chosenModel = currentProvider === 'grok'
        ? (this.settings.selectedGrokModel || 'llama-3.2-11b-vision-preview')
        : (this.settings.selectedModel || 'gemini-3.8-flash');

      // Obtain next key sequentially via controlled round-robin
      let keyInfo = await keyRotator.getNextKey(currentProvider);

      // If all keys for current provider are resting, attempt cross-provider failover first before waiting
      if (keyInfo.allResting) {
        const alternateProvider: AiProvider = currentProvider === 'gemini' ? 'grok' : 'gemini';
        const altKeyCheck = await keyRotator.getNextKey(alternateProvider);
        if (altKeyCheck.apiKey && !altKeyCheck.allResting) {
          currentProvider = alternateProvider;
          keyInfo = altKeyCheck;
          item.currentStage = `Primary provider resting. Switched to ${currentProvider === 'grok' ? 'Groq' : 'Gemini'} (${altKeyCheck.maskedKey})...`;
          this.callbacks.onItemUpdate({ ...item });
        } else {
          this.isCoolingDown = true;
          const cooldownDesc = keyInfo.isSharedRateLimit
            ? `Shared ${currentProvider === 'grok' ? 'Groq' : 'Gemini'} quota cooldown`
            : `All ${currentProvider === 'grok' ? 'Groq' : 'Gemini'} API keys resting`;
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
            },
            currentProvider
          );

          this.isCoolingDown = false;
          this.cooldownSeconds = 0;
          this.cooldownReason = '';
          this.broadcastProgress();
        }
      }

      if (this.abortController?.signal.aborted) break;

      this.currentKeyInfo =
        keyInfo?.maskedKey ||
        (keyInfo?.isDefaultEnv ? 'Default Key (Server Env)' : `${currentProvider === 'grok' ? 'Groq' : 'Gemini'} Key`);
      item.currentStage = `Sending request using ${this.currentKeyInfo}...`;
      this.callbacks.onItemUpdate({ ...item });
      this.broadcastProgress(`Generating with ${this.currentKeyInfo}...`);

      // Stop waiting after 75 s (the server gives up on slow AI calls after about 30 s),
      // or at once when the user presses Stop
      // set once the AI has answered for this image: from then on, nothing may send it (and charge) again
      let resultReceived = false;
      const requestCtl = new AbortController();
      const stopSignal = this.abortController?.signal;
      const onStop = () => requestCtl.abort();
      stopSignal?.addEventListener('abort', onStop, { once: true });
      const requestTimer = setTimeout(() => requestCtl.abort(), REQUEST_TIMEOUT_MS);

      try {
        let res: Response;
        try {
          res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: requestCtl.signal,
          body: JSON.stringify({
            mode: this.settings.mode,
            images: [item.fileData.aiDataUrl],
            platform: this.settings.platform,
            titleMaxLength: this.settings.titleLength,
            descriptionLength: 150,
            keywordsMaxCount: this.settings.keywordsCount,
            keywordStyle: this.settings.keywordStyle || 'mixed',
            backgroundMode: this.settings.backgroundMode || 'auto',
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
            provider: currentProvider,
            model: chosenModel,
            modelFallback: this.settings.modelFallback ?? true,
            apiKey: keyInfo?.apiKey,

            // Compliance & Uniqueness & Rules
            existingTitles: recentTitles,
            avoidTitles: recentTitles,
            reason: `Strictly adhere to rules: no brand names, trademarks, artist names, real people, characters, or words from the Blocked Terms list (${(this.settings.customBlockedWords || []).join(', ')}). Titles already made in this batch: [${recentTitles.join(' | ')}]. Ensure this title is clearly different and unique.`,
            uniqueness: this.settings.titleUniqueness || 'normal',
            contributorLanguage: this.settings.contributorLanguage || 'en',
            isAiBatch: this.settings.isAiBatch || false,
            customBlockedWords: this.settings.customBlockedWords || [],
          }),
        });
        } catch (fetchErr) {
          if (!stopSignal?.aborted && requestCtl.signal.aborted) {
            throw new Error('The AI took too long to answer. Retrying...');
          }
          throw fetchErr;
        } finally {
          clearTimeout(requestTimer);
          stopSignal?.removeEventListener('abort', onStop);
        }

        const resData = await res.json().catch(() => ({}));
        if (typeof resData?.creditsRemaining === 'number') {
          this.callbacks.onCreditsRemaining?.(resData.creditsRemaining);
        }

        // 401 can mean two very different things:
        //  (a) the user's login is not accepted (session problem) -> refresh the login and try again
        //  (b) the AI key was refused (code INVALID_API_KEY) -> this is handled below by switching keys
        // Only (a) may talk about logging in. A bad AI key must never stop the whole batch.
        if (res.status === 401 && resData?.error?.code !== 'INVALID_API_KEY') {
          if (authRetries < 2) {
            authRetries++;
            item.currentStage = 'Checking your login and trying again...';
            this.callbacks.onItemUpdate({ ...item });
            try {
              await createBrowserSupabase().auth.refreshSession();
            } catch {
              // ignore: the retry below will tell us if the login really is gone
            }
            await this.sleep(1200 * authRetries);
            continue;
          }
          item.status = 'failed';
          item.httpStatus = 401;
          item.errorMessage = 'Your login ended. Open orbinexacsv.com in a new tab, log in, then come back and press Resume.';
          this.callbacks.onItemUpdate({ ...item });
          toast.error('Your login ended. Log in again (in a new tab), then press Resume. Your work is kept.');
          this.stop();
          return false;
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

        // Handle 429 Rate Limit / Quota Exhaustion / Temporary Provider Errors
        if (res.status === 429 || resData?.error?.code === 'RATE_LIMITED' || resData?.error?.code === 'DAILY_QUOTA_EXHAUSTED' || resData?.error?.code === 'RESOURCE_EXHAUSTED') {
          if (this.maxParallel > 1) {
            this.maxParallel = 1;
            toast.warning('Rate limit encountered (429). Dropping to 1 parallel worker for the rest of the batch.');
          }

          const retryAfterSec =
            resData?.error?.retryAfterSeconds ||
            parseInt(res.headers.get('Retry-After') || '30', 10) ||
            30;

          if (resData?.error?.code === 'DAILY_QUOTA_EXHAUSTED') {
            await keyRotator.markKeyDailyExhausted(keyInfo?.keyId, currentProvider);
          } else {
            await keyRotator.markKeyRateLimited(keyInfo?.keyId, retryAfterSec, currentProvider);
          }

          // Built-in site key (no personal keys): a short "too many requests" is temporary,
          // so wait the time the server asks for and try the same image again (a few times at most)
          if (keyInfo?.isDefaultEnv && resData?.error?.code !== 'DAILY_QUOTA_EXHAUSTED' && rateLimitWaits < MAX_RATE_LIMIT_WAITS) {
            rateLimitWaits++;
            const waitSec = Math.min(60, Math.max(5, Math.ceil(retryAfterSec)));
            item.currentStage = `Busy right now. Trying again in ${waitSec}s (${rateLimitWaits}/${MAX_RATE_LIMIT_WAITS})...`;
            this.callbacks.onItemUpdate({ ...item });
            await this.waitWithCountdown(waitSec, 'The AI is busy. Waiting before trying again');
            continue;
          }

          // Try next key for current provider
          const nextKeyCheck = await keyRotator.getNextKey(currentProvider);
          if (nextKeyCheck.apiKey && !nextKeyCheck.allResting) {
            item.currentStage = `Switching to next ${currentProvider === 'grok' ? 'Groq' : 'Gemini'} key (${nextKeyCheck.maskedKey})...`;
            this.callbacks.onItemUpdate({ ...item });
            continue;
          }

          // All keys for current provider are resting or exhausted. Attempt cross-provider failover!
          const alternateProvider: AiProvider = currentProvider === 'gemini' ? 'grok' : 'gemini';
          const altKeyCheck = await keyRotator.getNextKey(alternateProvider);

          if (altKeyCheck.apiKey && !altKeyCheck.allResting) {
            currentProvider = alternateProvider;
            item.currentStage = `Primary provider exhausted. Failover switched to ${currentProvider === 'grok' ? 'Groq' : 'Gemini'} (${altKeyCheck.maskedKey})...`;
            this.callbacks.onItemUpdate({ ...item });
            toast.warning(`Automatically failed over to ${currentProvider === 'grok' ? 'Groq' : 'Gemini'}`);
            continue;
          }

          // Both providers exhausted
          item.status = 'failed';
          item.httpStatus = 429;
          item.errorMessage = resData?.error?.message || 'Quota exhausted across all Gemini and Groq API keys.';
          item.errorDetails = 'All keys are resting or rate limited. Please add another key in Settings to continue.';
          this.callbacks.onItemUpdate({ ...item });
          return false;
        }

        // Handle 401 / 403 Authentication Error
        if (res.status === 401 || res.status === 403) {
          // (was `provider`, which does not exist: an invalid key crashed the batch instead of switching keys)
          await keyRotator.markKeyInvalid(keyInfo?.keyId, currentProvider);
          const nextKeyCheck = await keyRotator.getNextKey(currentProvider);

          if (nextKeyCheck.apiKey) {
            item.currentStage = 'Invalid API key detected. Switched to next valid key...';
            this.callbacks.onItemUpdate({ ...item });
            continue;
          } else {
            item.status = 'failed';
            item.httpStatus = res.status;
            item.errorMessage = `HTTP ${res.status}: Invalid API Key. Authentication failed.`;
            item.errorDetails = `Please enter a valid ${currentProvider === 'grok' ? 'Groq' : 'Gemini'} API key in API Keys.`;
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
          await this.sleep(backoff);
          continue;
        }

        // Request Succeeded!
        await keyRotator.recordKeySuccess(keyInfo?.keyId);
        item.modelUsed = resData.modelUsed;

        if (this.settings.mode === 'metadata') {
          const resItem = resData.metadataSets?.[0];
          if (resItem) {
            resultReceived = true;
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
            const isUnder4 = !isVector && activeMinSizeCheck === 'exclude' && item.fileData.width > 0 && item.fileData.height > 0 && mp < 4.0;

            // Immediate Compliance scanning & fixing DURING generation (Points 2, 3, 4)
            const comp = scanItemCompliance(
              item.title,
              item.keywords,
              item.description,
              this.settings.customBlockedWords || [],
              item.approvedIssues || [],
              this.settings.isAiBatch || false
            );
            item.blockedTermsFound = comp.blockedTerms;

            // If blocked words found, remove locally (no AI call) and fill missing keywords with safe alternatives
            if (comp.hasErrors && comp.blockedTerms.length > 0) {
              const nonAmbiguousBlocked = comp.blockedTerms.filter((b) => !b.isAmbiguous);
              let newTitle = item.title;
              let newKeywords = [...(item.keywords || [])];

              for (const b of nonAmbiguousBlocked) {
                const termRegex = new RegExp(`\\b${escapeRe(b.term)}\\b`, 'gi');
                newTitle = newTitle.replace(termRegex, '').replace(/\s+/g, ' ').trim();
                newKeywords = newKeywords.filter((kw) => !kw.toLowerCase().includes(b.term.toLowerCase()));
              }

              newTitle = newTitle.replace(/^[^a-zA-Z0-9]+/, '').trim();
              if (!newTitle) newTitle = 'Commercial stock asset';

              item.title = newTitle;
              item.keywords = newKeywords;
            }

            // Check if title still fails compliance or is too similar to earlier title -> regenerate title once automatically (no extra credit charge)
            const checkFails = scanItemCompliance(
              item.title,
              item.keywords,
              item.description,
              this.settings.customBlockedWords || [],
              item.approvedIssues || [],
              this.settings.isAiBatch || false
            );
            const isStillFailing = (checkFails.blockedTerms || []).some((b) => !b.isAmbiguous);
            let matchingPrevTitle = '';
            const isTooSimilar = recentTitles.some((prevTitle) => {
              if (!prevTitle || !item.title) return false;
              const t1 = prevTitle.toLowerCase().trim();
              const t2 = item.title.toLowerCase().trim();
              if (t1 === t2) {
                matchingPrevTitle = prevTitle;
                return true;
              }
              const ratio = wordsOverlapRatio(prevTitle, item.title);
              if (ratio >= 0.8) {
                matchingPrevTitle = prevTitle;
                return true;
              }
              return false;
            });

            if (isStillFailing || isTooSimilar) {
              if (isTooSimilar) {
                const prevWordsLower = new Set(
                  matchingPrevTitle.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean)
                );
                const unusedKeywords = (item.keywords || []).filter(
                  (kw) => !prevWordsLower.has(kw.toLowerCase().trim()) && kw.trim().length > 1
                );
                const kw1 = unusedKeywords[0] || 'detail';
                const kw2 = unusedKeywords[1] || 'composition';
                const addition = ` with ${kw1} and ${kw2}`;
                const maxLength = this.settings.titleLength || 100;
                let candidate = `${item.title}${addition}`.trim();
                if (candidate.length > maxLength) {
                  candidate = `${item.title} with ${kw1}`.trim();
                  if (candidate.length > maxLength) {
                    candidate = item.title;
                  }
                }
                item.title = candidate;
              } else if (isStillFailing) {
                item.title = item.title.replace(/[^a-zA-Z0-9\s,.-]/g, '').trim();
                if (!item.title) item.title = 'Commercial stock asset';
              }
            }

            // Final compliance and exclusion determination (Point 4)
            const finalComp = scanItemCompliance(
              item.title,
              item.keywords,
              item.description,
              this.settings.customBlockedWords || [],
              item.approvedIssues || [],
              this.settings.isAiBatch || false
            );
            item.blockedTermsFound = finalComp.blockedTerms;

            const stillHasBlocked = (finalComp.blockedTerms || []).some((b) => !b.isAmbiguous);
            const stillTooSimilar = recentTitles.some((prevTitle) => prevTitle.toLowerCase().trim() === item.title.toLowerCase().trim());

            if (stillHasBlocked || stillTooSimilar) {
              item.isExcluded = true;
              item.excludedReason = stillHasBlocked
                ? `Blocked terms: ${finalComp.blockedTerms.map((b) => b.term).join(', ')}`
                : 'Similar title issue remains';
            } else if (isUnder4) {
              item.isExcluded = true;
              item.excludedReason = "Below Adobe's 4 MP minimum, likely refused";
            } else if (!item.manualInclude) {
              item.isExcluded = false;
              item.excludedReason = undefined;
            }

            const seo = calculateItemSeoScore(item, this.settings.platform);
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
            resultReceived = true;
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
        // Stop pressed while this request was running (Stop clears this.abortController, so use the saved signal)
        if (stopSignal?.aborted && !resultReceived) {
          item.status = 'queued';
          item.currentStage = undefined;
          this.callbacks.onItemUpdate({ ...item });
          return false;
        }
        // The AI already answered (and the image was charged). A problem while tidying the result
        // must not send the image again: keep what we have.
        if (resultReceived) {
          console.error('Post-processing error (result kept, not re-sent):', err);
          const hasResult = Boolean(item.title?.trim() || item.prompt?.trim());
          item.status = hasResult ? 'done' : 'failed';
          item.currentStage = undefined;
          if (!hasResult) item.errorMessage = 'The result could not be read. Press Retry for this image.';
          this.callbacks.onItemUpdate({ ...item });
          return hasResult;
        }

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
          item.errorDetails = 'Press Retry on this image to try it again. Your other results are kept.';
          this.callbacks.onItemUpdate({ ...item });
          return false;
        }

        const backoffMs = 1500 * Math.pow(2, attempts) + Math.random() * 1000;
        item.currentStage = `${err instanceof Error ? err.message : 'Connection problem'} Trying again in ${Math.round(backoffMs / 1000)}s (attempt ${attempts}/${maxServerAttempts})...`;
        this.callbacks.onItemUpdate({ ...item });
        await this.sleep(backoffMs); // stops waiting at once when the user presses Stop
      }
    }

    // Stopped before this image finished: put it back in the queue instead of leaving it on "working"
    if (item.status === 'working') {
      item.status = 'queued';
      item.currentStage = undefined;
      this.callbacks.onItemUpdate({ ...item });
    }
    return false;
  }
}

function wordsOverlapRatio(t1: string, t2: string): number {
  const words1 = t1.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  const words2 = t2.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  if (words1.length === 0 || words2.length === 0) return 0;
  const set1 = new Set(words1);
  let shared = 0;
  for (const w of words2) {
    if (set1.has(w)) shared++;
  }
  return shared / words2.length;
}