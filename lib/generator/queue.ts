import { ProcessedAssetFile } from './compress';
import { GeneratorSavedSettings } from './db';
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
  possibleEditorial: boolean;
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
  approvedIssues?: string[]; // IDs of approved warnings (e.g. ambiguous terms)
  seoScore?: number;
  seoChecklist?: SeoCheckItem[];
  similarTo?: SimilarTitleMatch[];
  blockedTermsFound?: BlockedTermMatch[];

  // Step 8 Deep Similarity Guard fields
  fingerprint?: ImageFingerprint;
  similarityClusterId?: string;
  isKeptBest?: boolean;
  excludedReason?: string;
  similarPairDetails?: PairwiseSimilarityScore[];
  aiReviewReason?: string;
}

export interface QueueCallbacks {
  onItemUpdate: (item: GeneratorItemState) => void;
  onComplete: () => void;
  onProgress: (doneCount: number, totalCount: number, failedCount: number) => void;
}

export class GeneratorQueue {
  private items: GeneratorItemState[] = [];
  private settings: GeneratorSavedSettings;
  private callbacks: QueueCallbacks;
  private abortController: AbortController | null = null;
  private isRunning = false;

  constructor(items: GeneratorItemState[], settings: GeneratorSavedSettings, callbacks: QueueCallbacks) {
    this.items = items;
    this.settings = settings;
    this.callbacks = callbacks;
  }

  updateSettings(settings: GeneratorSavedSettings) {
    this.settings = settings;
  }

  stop() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isRunning = false;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.abortController = new AbortController();

    const pendingItems = this.items.filter((i) => i.status === 'queued' || i.status === 'failed');
    if (pendingItems.length === 0) {
      this.isRunning = false;
      this.callbacks.onComplete();
      return;
    }

    if (this.settings.batchMode) {
      await this.runBatchMode(pendingItems);
    } else {
      await this.runSingleMode(pendingItems);
    }

    this.isRunning = false;
    this.callbacks.onComplete();
  }

  private async runSingleMode(pending: GeneratorItemState[]): Promise<void> {
    const concurrency = 4;
    let index = 0;

    const worker = async (): Promise<void> => {
      while (index < pending.length && this.isRunning) {
        const currentItem = pending[index++];
        if (!currentItem || this.abortController?.signal.aborted) break;

        await this.processSingleItem(currentItem);
        this.reportProgress();
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, pending.length) }, () => worker());
    await Promise.all(workers);
  }

  private async runBatchMode(pending: GeneratorItemState[]): Promise<void> {
    const batchSize = 5;
    const concurrency = 2;

    const batches: GeneratorItemState[][] = [];
    for (let i = 0; i < pending.length; i += batchSize) {
      batches.push(pending.slice(i, i + batchSize));
    }

    let batchIndex = 0;

    const worker = async (): Promise<void> => {
      while (batchIndex < batches.length && this.isRunning) {
        const batch = batches[batchIndex++];
        if (!batch || this.abortController?.signal.aborted) break;

        await this.processBatch(batch);
        this.reportProgress();
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, batches.length) }, () => worker());
    await Promise.all(workers);
  }

  private reportProgress() {
    const done = this.items.filter((i) => i.status === 'done').length;
    const failed = this.items.filter((i) => i.status === 'failed').length;
    this.callbacks.onProgress(done, this.items.length, failed);
  }

  private async processSingleItem(item: GeneratorItemState): Promise<void> {
    // Skip AI generation if image was excluded by similarity guard to save API quota
    if (this.settings.skipAiGenerationForExcluded && item.isExcluded) {
      item.status = 'done';
      if (!item.title) {
        item.title = item.fileData.originalName.replace(/\.[^/.]+$/, '');
      }
      this.callbacks.onItemUpdate({ ...item });
      return;
    }

    item.status = 'working';
    item.errorMessage = undefined;
    this.callbacks.onItemUpdate({ ...item });

    let attempts = 0;
    const maxAttempts = 3;

    // Last 15 generated titles to avoid similarity
    const recentTitles = this.items
      .filter((i) => i.status === 'done' && i.title?.trim())
      .map((i) => i.title.trim())
      .slice(-15);

    while (attempts < maxAttempts && this.isRunning && !this.abortController?.signal.aborted) {
      attempts++;
      const keyInfo = await keyRotator.getNextKey();

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

        if (res.status === 429) {
          await keyRotator.markKeyRateLimited(keyInfo?.keyId, 60000);
          if (attempts < maxAttempts) {
            await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, attempts)));
            continue;
          }
        }

        if (res.status === 401 || res.status === 403) {
          await keyRotator.markKeyInvalid(keyInfo?.keyId);
          if (attempts < maxAttempts) continue;
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `HTTP ${res.status}`);
        }

        const data = await res.json();

        if (this.settings.mode === 'metadata') {
          const result = data.metadataSets?.[0];
          if (result) {
            item.title = result.title || '';
            item.description = result.description || '';
            item.keywords = result.keywords || [];
            item.flags = result.flags;
            item.flagReasons = result.flagReasons;
            item.status = 'done';

            // Run compliance scan
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

            // Compute SEO score & checklist
            const seo = calculateItemSeoScore(item);
            item.seoScore = seo.score;
            item.seoChecklist = seo.checklist;

            // Compute perceptual hash (dHash) for near-duplicate detection
            if (this.settings.detectDuplicates && item.fileData.aiDataUrl) {
              try {
                item.dhash = await computeDHash(item.fileData.aiDataUrl);
              } catch (e) {
                console.error('dHash computation error:', e);
              }
            }

            this.callbacks.onItemUpdate({ ...item });
            return;
          }
        } else {
          const promptResult = data.prompts?.[0];
          if (promptResult) {
            item.prompt = promptResult.prompt || '';
            item.status = 'done';
            this.callbacks.onItemUpdate({ ...item });
            return;
          }
        }

        throw new Error('Empty response from generation engine');
      } catch (err: unknown) {
        if (this.abortController?.signal.aborted) {
          item.status = 'queued';
          this.callbacks.onItemUpdate({ ...item });
          return;
        }
        if (attempts >= maxAttempts) {
          item.status = 'failed';
          item.errorMessage = err instanceof Error ? err.message : 'Generation failed';
          this.callbacks.onItemUpdate({ ...item });
        } else {
          // Exponential backoff
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempts)));
        }
      }
    }
  }

  private async processBatch(batch: GeneratorItemState[]): Promise<void> {
    const excludedItems = this.settings.skipAiGenerationForExcluded
      ? batch.filter((b) => b.isExcluded)
      : [];
    const activeBatch = this.settings.skipAiGenerationForExcluded
      ? batch.filter((b) => !b.isExcluded)
      : batch;

    for (const item of excludedItems) {
      item.status = 'done';
      if (!item.title) {
        item.title = item.fileData.originalName.replace(/\.[^/.]+$/, '');
      }
      this.callbacks.onItemUpdate({ ...item });
    }

    if (activeBatch.length === 0) {
      return;
    }

    for (const item of activeBatch) {
      item.status = 'working';
      item.errorMessage = undefined;
      this.callbacks.onItemUpdate({ ...item });
    }

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts && this.isRunning && !this.abortController?.signal.aborted) {
      attempts++;
      const keyInfo = await keyRotator.getNextKey();

      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: this.abortController?.signal,
          body: JSON.stringify({
            mode: this.settings.mode,
            images: activeBatch.map((b) => b.fileData.aiDataUrl),
            platform: this.settings.platform,
            titleMaxLength: this.settings.titleLength,
            descriptionLength: 150,
            keywordsMaxCount: this.settings.keywordsCount,
            hasAlphaChannel: activeBatch.map((b) => b.fileData.hasAlphaChannel),
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
            uniqueness: this.settings.titleUniqueness || 'normal',
            contributorLanguage: this.settings.contributorLanguage || 'en',
            isAiBatch: this.settings.isAiBatch || false,
            customBlockedWords: this.settings.customBlockedWords || [],
          }),
        });

        if (res.status === 429) {
          await keyRotator.markKeyRateLimited(keyInfo?.keyId, 60000);
          if (attempts < maxAttempts) {
            await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, attempts)));
            continue;
          }
        }

        if (res.status === 401 || res.status === 403) {
          await keyRotator.markKeyInvalid(keyInfo?.keyId);
          if (attempts < maxAttempts) continue;
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `HTTP ${res.status}`);
        }

        const data = await res.json();

        if (this.settings.mode === 'metadata') {
          const sets = data.metadataSets || [];
          for (let idx = 0; idx < activeBatch.length; idx++) {
            const item = activeBatch[idx];
            const resItem = sets[idx];
            if (resItem) {
              item.title = resItem.title || '';
              item.description = resItem.description || '';
              item.keywords = resItem.keywords || [];
              item.flags = resItem.flags;
              item.flagReasons = resItem.flagReasons;
              item.status = 'done';

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
            } else {
              item.status = 'failed';
              item.errorMessage = 'No metadata returned for batch index';
            }
            this.callbacks.onItemUpdate({ ...item });
          }
          return;
        } else {
          const prompts = data.prompts || [];
          activeBatch.forEach((item, idx) => {
            const promptItem = prompts[idx];
            if (promptItem) {
              item.prompt = promptItem.prompt || '';
              item.status = 'done';
            } else {
              item.status = 'failed';
              item.errorMessage = 'No prompt returned for batch index';
            }
            this.callbacks.onItemUpdate({ ...item });
          });
          return;
        }
      } catch (err: unknown) {
        if (this.abortController?.signal.aborted) {
          activeBatch.forEach((item) => {
            if (item.status === 'working') item.status = 'queued';
            this.callbacks.onItemUpdate({ ...item });
          });
          return;
        }

        if (attempts >= maxAttempts) {
          activeBatch.forEach((item) => {
            item.status = 'failed';
            item.errorMessage = err instanceof Error ? err.message : 'Batch generation failed';
            this.callbacks.onItemUpdate({ ...item });
          });
        } else {
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempts)));
        }
      }
    }
  }
}
