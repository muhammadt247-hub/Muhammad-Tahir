'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ControlsCard } from '@/components/generator/ControlsCard';
import { BatchCard } from '@/components/generator/BatchCard';
import { MetadataSettings } from '@/components/generator/MetadataSettings';
import { ComplianceSettings } from '@/components/generator/ComplianceSettings';
import { PromptSettings } from '@/components/generator/PromptSettings';
import { UploadCard } from '@/components/generator/UploadCard';
import { ActionBar } from '@/components/generator/ActionBar';
import { ResultList } from '@/components/generator/ResultList';
import { ApiKeysDialog } from '@/components/generator/ApiKeysDialog';
import { EmbedDialog, EmbedDialogStats } from '@/components/generator/EmbedDialog';
import { SimilarityClustersDialog } from '@/components/generator/SimilarityClustersDialog';
import { DeleteSimilarDialog } from '@/components/generator/DeleteSimilarDialog';
import { SimilarityProgressCard } from '@/components/generator/SimilarityProgressCard';
import { ComplianceReportDialog } from '@/components/generator/ComplianceReportDialog';
import { OutOfCreditsDialog } from '@/components/generator/OutOfCreditsDialog';
import { BatchCreditsDialog } from '@/components/generator/BatchCreditsDialog';
import { PLATFORM_SPECS } from '@/config/platforms';
import {
  GeneratorSavedSettings,
  DEFAULT_GENERATOR_SETTINGS,
  getSavedGeneratorSettings,
  saveGeneratorSettings,
  getStoredApiKeys,
  saveLibraryEntries,
  clearLibraryStore,
  LibraryFingerprintEntry,
  getSavedBatchItems,
  saveBatchItem,
  saveAllBatchItems,
  deleteSavedBatchItem,
  clearSavedBatchItems,
} from '@/lib/generator/db';
import { GeneratorItemState, GeneratorQueue, QueueProgressState, isItemExcluded } from '@/lib/generator/queue';
import { processFileForGenerator } from '@/lib/generator/compress';
import {
  getBaseName,
  isVectorFileName,
  getVectorType,
  processRasterPreview,
  extractAiPreview,
  createUnpairedEpsResult,
  NEEDS_PREVIEW_MESSAGE,
} from '@/lib/generator/vector-preview';
import { rasterizeSvgToPng } from '@/lib/generator/svg-raster';
import { generateMarketplaceCsv, generatePromptCsv, GeneratorResultExportItem } from '@/lib/generator/csv';
import { embedJpegMetadata, embedPngMetadata, isMetadataEmbeddable } from '@/lib/generator/embed';
import { downloadEmbeddedFilesZip, EmbeddedFileEntry } from '@/lib/generator/zip';
import { downloadBlob } from '@/lib/csv';
import { computeBatchSimilarities } from '@/lib/compliance/similarity';
import { buildPreExportReport, PreExportReport } from '@/lib/compliance/report';
import { scanItemCompliance } from '@/lib/compliance/scan';
import { calculateItemSeoScore } from '@/lib/generator/seo-score';
import { keyRotator } from '@/lib/generator/key-rotation';
import {
  runSimilarityPipeline,
  SimilarityProgress,
} from '@/lib/similarity/pipeline';
import { SimilarityCluster } from '@/types/similarity';
import { useCredits } from '@/components/CreditsProvider';
import { toast } from 'sonner';

export default function GeneratorPage() {
  const {
    balance: creditBalance,
    loading: creditsLoading,
    hasError: creditsError,
    updateBalanceLocally,
  } = useCredits();

  const [settings, setSettings] = useState<GeneratorSavedSettings>(DEFAULT_GENERATOR_SETTINGS);
  const [items, setItems] = useState<GeneratorItemState[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentFilename, setCurrentFilename] = useState<string>('');
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [currentKeyInfo, setCurrentKeyInfo] = useState<string>('');
  const [isCoolingDown, setIsCoolingDown] = useState<boolean>(false);
  const [cooldownSecondsRemaining, setCooldownSecondsRemaining] = useState<number>(0);
  const [cooldownText, setCooldownText] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');

  const [apiKeysOpen, setApiKeysOpen] = useState(false);
  const [hasCustomKeys, setHasCustomKeys] = useState(false);

  // Similarity Guard States
  const [similarityProgress, setSimilarityProgress] = useState<SimilarityProgress | null>(null);
  const [isAnalyzingSimilarity, setIsAnalyzingSimilarity] = useState(false);
  const [similarityClusters, setSimilarityClusters] = useState<SimilarityCluster[]>([]);
  const [similarityDialogOpen, setSimilarityDialogOpen] = useState(false);
  const [deleteSimilarOpen, setDeleteSimilarOpen] = useState(false);

  // Compliance Report Dialog
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  // Embed Dialog State
  const [embedDialogOpen, setEmbedDialogOpen] = useState(false);
  const [embedDialogStatus, setEmbedDialogStatus] = useState<'processing' | 'complete' | 'no-compatible'>('processing');
  const [embedCurrent, setEmbedCurrent] = useState(0);
  const [embedTotal, setEmbedTotal] = useState(0);
  const [embedStats, setEmbedStats] = useState<EmbedDialogStats>({
    successCount: 0,
    skippedCount: 0,
    failedFiles: [],
  });

  // Out of Credits Dialog
  const [outOfCreditsOpen, setOutOfCreditsOpen] = useState(false);
  const [outOfCreditsBalance, setOutOfCreditsBalance] = useState(0);

  // Batch Needs More Credits Dialog (Requirement 5)
  const [batchCreditsDialogOpen, setBatchCreditsDialogOpen] = useState(false);
  const [batchCreditsInfo, setBatchCreditsInfo] = useState<{ needed: number; balance: number }>({
    needed: 0,
    balance: 0,
  });

  const queueRef = useRef<GeneratorQueue | null>(null);

  const checkCustomKeys = useCallback(async () => {
    const keys = await getStoredApiKeys();
    const active = keys.some((k) => k.isActive && !k.isInvalid);
    setHasCustomKeys(active);
  }, []);

  // Load initial settings, saved batch items, and check keys
  useEffect(() => {
    let isMounted = true;
    getSavedGeneratorSettings().then((saved) => {
      if (isMounted) setSettings(saved);
    });

    getStoredApiKeys().then((keys) => {
      if (isMounted) {
        setHasCustomKeys(keys.some((k) => k.isActive && !k.isInvalid));
      }
    });

    // Restore completed results from IndexedDB so refresh preserves data
    getSavedBatchItems().then((savedItems) => {
      if (isMounted && savedItems && savedItems.length > 0) {
        setItems(savedItems);
        const done = savedItems.filter((i) => i.status === 'done').length;
        if (done > 0) {
          toast.info(`Restored ${savedItems.length} items from previous session (${done} completed).`);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Persist settings changes
  const updateSettings = useCallback((partial: Partial<GeneratorSavedSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...partial };
      saveGeneratorSettings(updated);
      if (queueRef.current) {
        queueRef.current.updateSettings(updated);
      }
      return updated;
    });

    if (partial.minSizeCheck !== undefined) {
      const newCheck = partial.minSizeCheck;
      setItems((prev) => {
        const next = prev.map((it) => {
          const width = it.fileData.width || 0;
          const height = it.fileData.height || 0;
          const mp = width > 0 && height > 0 ? (width * height) / 1_000_000 : 0;
          const isUnder4 = width > 0 && height > 0 && mp < 4.0;

          const isVector = it.isVector || it.fileData?.isVector;

          if (newCheck === 'exclude') {
            if (isUnder4 && !isVector && !it.isExcluded && !it.manualInclude && it.excludedReason !== 'manual_override') {
              return {
                ...it,
                isExcluded: true,
                excludedReason: "Below Adobe's 4 MP minimum, likely refused",
              };
            }
          } else {
            // 'warn' or 'off': immediately clear the size exclusion on all files
            const isSizeExclusion =
              it.excludedReason === "Below Adobe's 4 MP minimum, likely refused" ||
              Boolean(it.excludedReason?.includes('4 MP')) ||
              (isUnder4 && it.isExcluded && !it.excludedReason?.startsWith('Similar') && !it.excludedReason?.startsWith('Already exported'));
            if (isSizeExclusion) {
              return {
                ...it,
                isExcluded: false,
                excludedReason: undefined,
              };
            }
          }
          return it;
        });
        saveAllBatchItems(next);
        return next;
      });
    }
  }, []);

  // Deep Similarity Pipeline runner
  const runSimilarityCheck = useCallback(
    async (targetItems: GeneratorItemState[], activeSettings = settings) => {
      if (targetItems.length === 0 || activeSettings.similarityStrictness === 'off') {
        setIsAnalyzingSimilarity(false);
        setSimilarityProgress(null);
        return;
      }

      setIsAnalyzingSimilarity(true);
      try {
        const result = await runSimilarityPipeline(
          targetItems,
          activeSettings,
          (prog) => setSimilarityProgress(prog)
        );
        setItems(result.updatedItems);
        saveAllBatchItems(result.updatedItems);
        setSimilarityClusters(result.clusters);

        if (result.clusters.length > 0 || result.libraryExcludedCount > 0) {
          const msg =
            result.libraryExcludedCount > 0
              ? `Similarity Guard: ${result.totalExcludedCount} image(s) excluded (${result.libraryExcludedCount} matched exported library).`
              : `Similarity Guard: ${result.totalExcludedCount} similar image(s) excluded from export to protect against spam rejections.`;
          toast.info(msg);
        }
      } catch (err) {
        console.error('Similarity check error:', err);
      } finally {
        setIsAnalyzingSimilarity(false);
        setSimilarityProgress(null);
      }
    },
    [settings]
  );

  // Re-run similarity when strictness changes
  const prevStrictnessRef = useRef(settings.similarityStrictness);
  useEffect(() => {
    if (prevStrictnessRef.current !== settings.similarityStrictness) {
      prevStrictnessRef.current = settings.similarityStrictness;
      if (items.length > 0) {
        const timer = setTimeout(() => {
          runSimilarityCheck(items, settings);
        }, 50);
        return () => clearTimeout(timer);
      }
    }
  }, [settings.similarityStrictness, items, runSimilarityCheck, settings]);

  // Batch title similarity computation (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      const activeDone = items.filter(
        (i) =>
          i.status === 'done' &&
          Boolean(i.title?.trim()) &&
          i.title.trim() !== i.fileData.originalName
      );

      if (activeDone.length < 2) {
        setItems((prev) =>
          prev.some((it) => it.similarTo && it.similarTo.length > 0)
            ? prev.map((it) => (it.similarTo && it.similarTo.length > 0 ? { ...it, similarTo: [] } : it))
            : prev
        );
        return;
      }

      const simMap = computeBatchSimilarities(activeDone, settings.titleUniqueness || 'normal');
      let changed = false;
      const updated = items.map((it) => {
        if (!it.title?.trim() || it.title.trim() === it.fileData.originalName) {
          if (it.similarTo && it.similarTo.length > 0) {
            changed = true;
            return { ...it, similarTo: [] };
          }
          return it;
        }

        const matches = (simMap.get(it.id) || []).filter(
          (m) => m.otherId !== it.id && m.otherFilename.toLowerCase().trim() !== it.fileData.originalName.toLowerCase().trim()
        );
        const prevLen = it.similarTo?.length || 0;
        const newLen = matches.length;
        if (prevLen !== newLen) {
          changed = true;
          return { ...it, similarTo: matches };
        }
        return it;
      });

      if (changed) {
        setItems(updated);
        saveAllBatchItems(updated);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [items, settings.titleUniqueness]);

  // Handle uploaded files (Supports up to 1000 files for large batches, with EPS/AI preview pairing)
  const handleFilesSelected = async (newFiles: File[]) => {
    const maxCapacity = 1000;
    const remainingSlots = maxCapacity - items.length;

    if (remainingSlots <= 0) {
      toast.error(`Maximum batch limit reached (${maxCapacity} files).`);
      return;
    }

    const filesToProcess = newFiles.slice(0, remainingSlots);
    if (newFiles.length > remainingSlots) {
      toast.warning(`Only ${remainingSlots} files could be added (max ${maxCapacity}).`);
    }

    toast.info(`Preparing ${filesToProcess.length} file${filesToProcess.length === 1 ? '' : 's'}...`);

    const consumedRasters = new Set<string>();
    const updatedExistingItems: GeneratorItemState[] = [...items];
    let existingModified = false;
    let pairedExistingCount = 0;

    // Group candidates from current batch by base name
    const candidateRastersByBase = new Map<string, File[]>();
    for (const f of filesToProcess) {
      if (!isVectorFileName(f.name) && /\.(jpg|jpeg|png|webp)$/i.test(f.name)) {
        const base = getBaseName(f.name);
        if (!candidateRastersByBase.has(base)) candidateRastersByBase.set(base, []);
        candidateRastersByBase.get(base)!.push(f);
      }
    }

    // 1. Check if newly uploaded rasters match existing EPS/AI items in the list that need a preview
    for (const [base, rasterList] of candidateRastersByBase.entries()) {
      const matchingExisting = updatedExistingItems.filter(
        (it) =>
          (it.isVector || it.fileData.isVector) &&
          (it.vectorType === 'eps' || it.vectorType === 'ai' || it.fileData.vectorType === 'eps' || it.fileData.vectorType === 'ai') &&
          it.needsPreview &&
          getBaseName(it.fileData.originalName) === base
      );

      if (matchingExisting.length > 0 && rasterList.length > 0) {
        matchingExisting.sort((a, b) =>
          a.fileData.originalName.localeCompare(b.fileData.originalName, undefined, { sensitivity: 'base' })
        );
        rasterList.sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        );

        if (matchingExisting.length > 1 || rasterList.length > 1) {
          toast.warning(`Multiple vectors or previews share base name "${base}". Paired in alphabetical order.`);
        }

        const pairs = Math.min(matchingExisting.length, rasterList.length);
        for (let i = 0; i < pairs; i++) {
          const target = matchingExisting[i];
          const rasterFile = rasterList.shift()!;
          consumedRasters.add(rasterFile.name);

          try {
            const rasterRes = await processRasterPreview(rasterFile);
            const targetIdx = updatedExistingItems.findIndex((it) => it.id === target.id);
            if (targetIdx !== -1) {
              updatedExistingItems[targetIdx] = {
                ...target,
                fileData: {
                  ...target.fileData,
                  previewUrl: rasterRes.previewUrl,
                  aiDataUrl: rasterRes.aiDataUrl,
                  width: rasterRes.width,
                  height: rasterRes.height,
                  compressedSize: rasterRes.compressedSize,
                  needsPreview: false,
                  needsPreviewMessage: undefined,
                  previewSource: 'paired',
                  isLowResPreview: false,
                  pairedPreviewName: rasterFile.name,
                },
                needsPreview: false,
                needsPreviewMessage: undefined,
                previewSource: 'paired',
                isLowResPreview: false,
                pairedPreviewName: rasterFile.name,
              };
              existingModified = true;
              pairedExistingCount++;
            }
          } catch (err) {
            console.error(`Failed to pair raster preview ${rasterFile.name}:`, err);
          }
        }
      }
    }

    // 2. Identify pairing vector files (EPS and AI) in the current batch
    const pairingVectorsByBase = new Map<string, File[]>();
    for (const f of filesToProcess) {
      if (/\.(eps|ai)$/i.test(f.name)) {
        const base = getBaseName(f.name);
        if (!pairingVectorsByBase.has(base)) pairingVectorsByBase.set(base, []);
        pairingVectorsByBase.get(base)!.push(f);
      }
    }

    const unpairedVectorTasks: { assetId: string; vectorFile: File }[] = [];
    const newItems: GeneratorItemState[] = [];
    const activeMinSizeCheck = settings.minSizeCheck || (settings.platform === 'adobe-stock' ? 'exclude' : 'warn');
    const handledVectorNames = new Set<string>();
    let pairedBatchVectors = 0;
    let needPreviewBatchVectors = 0;

    // 3. Process EPS & AI vectors with preview pairing
    for (const [base, vectorList] of pairingVectorsByBase.entries()) {
      const rasterList = (candidateRastersByBase.get(base) || []).filter((r) => !consumedRasters.has(r.name));

      // Sort both in alphabetical order
      vectorList.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      rasterList.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

      if (vectorList.length > 0 && rasterList.length > 0 && (vectorList.length > 1 || rasterList.length > 1)) {
        toast.warning(`Multiple vectors or previews share base name "${base}". Paired in alphabetical order.`);
      }

      const pairCount = Math.min(vectorList.length, rasterList.length);

      // Pair 1-to-1 in alphabetical order
      for (let i = 0; i < pairCount; i++) {
        const vectorFile = vectorList[i];
        const rasterFile = rasterList[i];
        consumedRasters.add(rasterFile.name);
        handledVectorNames.add(vectorFile.name);

        const pairedResult = await processRasterPreview(rasterFile);
        const assetId = `asset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const vectorType = getVectorType(vectorFile.name) || 'eps';

        newItems.push({
          id: assetId,
          fileData: {
            id: assetId,
            file: vectorFile,
            originalName: vectorFile.name, // e.g. logo.eps or logo.ai
            originalSize: vectorFile.size,
            compressedSize: pairedResult.compressedSize,
            mimeType: vectorFile.type || (vectorType === 'ai' ? 'application/illustrator' : 'application/postscript'),
            previewUrl: pairedResult.previewUrl,
            aiDataUrl: pairedResult.aiDataUrl,
            hasAlphaChannel: false,
            width: pairedResult.width,
            height: pairedResult.height,
            isVector: true,
            vectorType,
            previewSource: 'paired',
            needsPreview: false,
            isLowResPreview: false,
            pairedPreviewName: rasterFile.name,
          },
          status: 'queued',
          title: '',
          description: '',
          keywords: [],
          prompt: '',
          retryCount: 0,
          isVector: true,
          vectorType,
          previewSource: 'paired',
          needsPreview: false,
          isLowResPreview: false,
          pairedPreviewName: rasterFile.name,
          isExcluded: false,
        });
        pairedBatchVectors++;
      }

      // Unpaired vectors for this base name (AI and EPS)
      for (let i = pairCount; i < vectorList.length; i++) {
        const vectorFile = vectorList[i];
        handledVectorNames.add(vectorFile.name);
        const vectorType = getVectorType(vectorFile.name) || 'eps';
        const assetId = `asset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        newItems.push({
          id: assetId,
          fileData: {
            id: assetId,
            file: vectorFile,
            originalName: vectorFile.name,
            originalSize: vectorFile.size,
            compressedSize: 0,
            mimeType: vectorType === 'ai' ? 'application/illustrator' : 'application/postscript',
            previewUrl: '',
            aiDataUrl: '',
            hasAlphaChannel: false,
            width: 0,
            height: 0,
            isVector: true,
            vectorType,
            needsPreview: false,
            isConverting: true,
            previewSource: 'pdf',
          },
          status: 'queued',
          title: '',
          description: '',
          keywords: [],
          prompt: '',
          retryCount: 0,
          isVector: true,
          vectorType,
          needsPreview: false,
          isConverting: true,
          isExcluded: false,
        });

        unpairedVectorTasks.push({ assetId, vectorFile });
      }
    }

    // 4. Process all remaining files (SVGs and non-consumed rasters/videos)
    for (const file of filesToProcess) {
      if (consumedRasters.has(file.name) || handledVectorNames.has(file.name)) continue;

      try {
        const fileData = await processFileForGenerator(file);
        const mp = fileData.width > 0 && fileData.height > 0 ? (fileData.width * fileData.height) / 1_000_000 : 0;
        const isUnder4Mp = fileData.width > 0 && fileData.height > 0 && mp < 4.0;
        const shouldExclude4Mp = !fileData.isVector && activeMinSizeCheck === 'exclude' && isUnder4Mp;

        newItems.push({
          id: fileData.id,
          fileData,
          status: fileData.svgRasterFailed ? 'failed' : 'queued',
          title: '',
          description: '',
          keywords: [],
          prompt: '',
          retryCount: 0,
          isVector: fileData.isVector,
          vectorType: fileData.vectorType,
          needsPreview: fileData.needsPreview,
          needsPreviewMessage: fileData.needsPreviewMessage,
          isLowResPreview: fileData.isLowResPreview,
          previewSource: fileData.previewSource,
          svgRasterFailed: fileData.svgRasterFailed,
          errorMessage: fileData.svgRasterFailed ? 'Failed to rasterize SVG' : undefined,
          isExcluded: shouldExclude4Mp,
          excludedReason: shouldExclude4Mp ? "Below Adobe's 4 MP minimum, likely refused" : undefined,
        });
      } catch (err) {
        console.error(`Failed to process ${file.name}:`, err);
        toast.error(`Could not process ${file.name}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const finalItems = existingModified ? [...updatedExistingItems, ...newItems] : [...items, ...newItems];

    if (newItems.length > 0 || existingModified) {
      setItems(finalItems);
      await saveAllBatchItems(finalItems);

      const totalVectorCount = pairedBatchVectors + needPreviewBatchVectors + pairedExistingCount;
      if (totalVectorCount > 0) {
        const totalPaired = pairedBatchVectors + pairedExistingCount;
        toast.info(`Paired ${totalPaired} vector files with previews, ${needPreviewBatchVectors} need a preview`);
      } else if (newItems.length > 0) {
        toast.success(`Added ${newItems.length} file${newItems.length === 1 ? '' : 's'} to queue`);
      }
      runSimilarityCheck(finalItems);
    }

    if (unpairedVectorTasks.length > 0) {
      (async () => {
        try {
          for (const task of unpairedVectorTasks) {
            try {
              const processed = await processFileForGenerator(task.vectorFile);
              setItems((prev) => {
                const next = prev.map((it) => {
                  if (it.id !== task.assetId) return it;
                  const errReason = processed.needsPreviewMessage || 'Could not convert this file';
                  if (processed.needsPreview || processed.svgRasterFailed || !processed.previewUrl) {
                    console.error(`Could not convert vector file ${task.vectorFile.name}: ${errReason}`);
                    return {
                      ...it,
                      fileData: {
                        ...it.fileData,
                        ...processed,
                        isConverting: false,
                        needsPreview: true,
                        needsPreviewMessage: errReason,
                      },
                      needsPreview: true,
                      needsPreviewMessage: errReason,
                      isConverting: false,
                    };
                  } else {
                    return {
                      ...it,
                      fileData: {
                        ...it.fileData,
                        ...processed,
                        isConverting: false,
                        needsPreview: false,
                      },
                      needsPreview: false,
                      isConverting: false,
                    };
                  }
                });
                saveAllBatchItems(next);
                runSimilarityCheck(next);
                return next;
              });
            } catch (err: unknown) {
              const errReason = err instanceof Error ? err.message : 'Could not convert this file';
              console.error(`Could not convert vector file ${task.vectorFile.name}: ${errReason}`);
              setItems((prev) => {
                const next = prev.map((it) => {
                  if (it.id !== task.assetId) return it;
                  return {
                    ...it,
                    fileData: {
                      ...it.fileData,
                      isConverting: false,
                      needsPreview: true,
                      needsPreviewMessage: errReason,
                    },
                    needsPreview: true,
                    needsPreviewMessage: errReason,
                    isConverting: false,
                  };
                });
                saveAllBatchItems(next);
                runSimilarityCheck(next);
                return next;
              });
            }
          }
        } catch (outerErr: unknown) {
          const outerReason = outerErr instanceof Error ? outerErr.message : 'Could not convert vector files';
          console.error('Vector conversion batch error:', outerReason);
          setItems((prev) => {
            const next = prev.map((it) => {
              if (it.isConverting || it.fileData?.isConverting) {
                return {
                  ...it,
                  fileData: {
                    ...it.fileData,
                    isConverting: false,
                    needsPreview: true,
                    needsPreviewMessage: outerReason,
                  },
                  needsPreview: true,
                  needsPreviewMessage: outerReason,
                  isConverting: false,
                };
              }
              return it;
            });
            saveAllBatchItems(next);
            return next;
          });
        }
      })();
    }
  };

  // Attach a preview to an EPS/AI item needing a preview
  const handleAttachPreview = useCallback(
    async (itemId: string, previewFile: File) => {
      try {
        const rasterRes = await processRasterPreview(previewFile);
        setItems((prev) => {
          const next = prev.map((it) => {
            if (it.id !== itemId) return it;
            return {
              ...it,
              fileData: {
                ...it.fileData,
                previewUrl: rasterRes.previewUrl,
                aiDataUrl: rasterRes.aiDataUrl,
                width: rasterRes.width,
                height: rasterRes.height,
                compressedSize: rasterRes.compressedSize,
                needsPreview: false,
                needsPreviewMessage: undefined,
                previewSource: 'paired' as const,
                isLowResPreview: false,
                pairedPreviewName: previewFile.name,
              },
              needsPreview: false,
              needsPreviewMessage: undefined,
              previewSource: 'paired' as const,
              isLowResPreview: false,
              pairedPreviewName: previewFile.name,
            };
          });
          saveAllBatchItems(next);
          runSimilarityCheck(next);
          return next;
        });
        toast.success(`Attached preview image from ${previewFile.name}`);
      } catch (err) {
        console.error('Failed to attach preview:', err);
        toast.error('Could not process preview image');
      }
    },
    [runSimilarityCheck]
  );

  // Retry browser SVG rasterization
  const handleRetrySvgRaster = useCallback(
    async (itemId: string) => {
      const item = items.find((it) => it.id === itemId);
      if (!item) return;

      toast.info(`Retrying SVG rasterization for ${item.fileData.originalName}...`);
      try {
        const { pngDataUrl, width, height } = await rasterizeSvgToPng(item.fileData.file);
        const compressedSize = Math.round((pngDataUrl.length * 3) / 4);
        setItems((prev) => {
          const next = prev.map((it) => {
            if (it.id !== itemId) return it;
            return {
              ...it,
              fileData: {
                ...it.fileData,
                previewUrl: pngDataUrl,
                aiDataUrl: pngDataUrl,
                width,
                height,
                compressedSize,
                svgRasterFailed: false,
              },
              svgRasterFailed: false,
              errorMessage: undefined,
              status: 'queued' as const,
            };
          });
          saveAllBatchItems(next);
          runSimilarityCheck(next);
          return next;
        });
        toast.success(`Successfully rasterized ${item.fileData.originalName}`);
      } catch (err: unknown) {
        console.error('Failed to retry SVG rasterization:', err);
        const msg = err instanceof Error ? err.message : 'Could not rasterize SVG';
        toast.error(`Retry failed: ${msg}`);
      }
    },
    [items, runSimilarityCheck]
  );

  // Item management callbacks
  const handleUpdateItem = useCallback(
    (id: string, updated: Partial<GeneratorItemState>) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          const merged = { ...item, ...updated };

          if (updated.title !== undefined || updated.keywords !== undefined) {
            if (settings.complianceGuard) {
              const comp = scanItemCompliance(
                merged.title,
                merged.keywords,
                merged.description,
                settings.customBlockedWords || [],
                merged.approvedIssues || [],
                settings.isAiBatch || false
              );
              merged.blockedTermsFound = comp.blockedTerms;
            }
            const seo = calculateItemSeoScore(merged);
            merged.seoScore = seo.score;
            merged.seoChecklist = seo.checklist;
          }

          saveBatchItem(merged);
          return merged;
        })
      );
    },
    [settings]
  );

  const handleDeleteItem = useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.fileData.previewUrl?.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(target.fileData.previewUrl);
        } catch {}
      }
      const remaining = prev.filter((item) => item.id !== id);
      deleteSavedBatchItem(id);
      return remaining;
    });
  }, []);

  const handleClearAll = useCallback(() => {
    if (queueRef.current) {
      queueRef.current.stop();
      queueRef.current = null;
    }
    setIsGenerating(false);
    setIsPaused(false);
    setCurrentFilename('');
    setCurrentImageIndex(0);
    setCurrentKeyInfo('');
    setIsCoolingDown(false);
    setCooldownSecondsRemaining(0);
    setCooldownText('');
    setStatusMessage('');
    setSimilarityClusters([]);

    setItems((prev) => {
      for (const item of prev) {
        if (item.fileData.previewUrl?.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(item.fileData.previewUrl);
          } catch {}
        }
      }
      return [];
    });

    clearSavedBatchItems();
    toast.success('Cleared all items');
  }, []);

  // Pre-export report computation
  const currentReport: PreExportReport = useMemo(() => {
    const activeMinSizeCheck = settings.minSizeCheck || (settings.platform === 'adobe-stock' ? 'exclude' : 'warn');
    return buildPreExportReport(items, activeMinSizeCheck);
  }, [items, settings.minSizeCheck, settings.platform]);

  // Execute CSV Export (strictly excludes similar, resolution-refused, and hard-blocked items)
  const executeActualCsvExport = useCallback(() => {
    const activeMinSizeCheck = settings.minSizeCheck || (settings.platform === 'adobe-stock' ? 'exclude' : 'warn');
    const doneItems = items.filter((i) => {
      if (i.status !== 'done' || isItemExcluded(i, activeMinSizeCheck)) return false;
      const isVector = i.isVector || i.fileData.isVector;
      const mp = (i.fileData.width * i.fileData.height) / 1_000_000;
      if (!isVector && activeMinSizeCheck === 'exclude' && i.fileData.width > 0 && i.fileData.height > 0 && mp < 4.0) return false;
      if (!isVector && mp > 100) return false;
      if ((i.fileData.originalSize || 0) > 45 * 1024 * 1024) return false;
      return true;
    });

    const validItems = doneItems.filter(
      (i) => !i.blockedTermsFound?.some((b) => !b.isAmbiguous)
    );

    if (validItems.length === 0) {
      toast.error('No compliant items available for export. Resolve blocked terms or resolution issues first.');
      return;
    }

    const exportData: GeneratorResultExportItem[] = validItems.map((i) => ({
      originalName: i.fileData.originalName,
      title: i.title,
      description: i.description,
      keywords: i.keywords,
      prompt: i.prompt,
      status: i.status,
    }));

    const dateStr = new Date().toISOString().slice(0, 10);
    if (settings.mode === 'prompt') {
      const csvContent = generatePromptCsv(exportData);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      downloadBlob(blob, `prompts_${dateStr}.csv`);
      toast.success(`Exported ${validItems.length} prompts to CSV`);
    } else {
      const csvContent = generateMarketplaceCsv(exportData, settings.platform);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const exportFilename =
        settings.platform === 'adobe-stock'
          ? 'orbinexacsv_adobe-stock_export.csv'
          : `${settings.platform}_metadata_${dateStr}.csv`;
      downloadBlob(blob, exportFilename);
      toast.success(`Exported ${validItems.length} metadata rows for ${settings.platform}`);
    }

    if (settings.rememberExportedImages) {
      const libraryEntriesToSave: LibraryFingerprintEntry[] = validItems
        .filter((it) => it.fingerprint)
        .map((it) => ({
          id: `lib-${Date.now()}-${it.id}`,
          filename: it.fileData.originalName,
          exportedAt: Date.now(),
          thumbnail32: it.fingerprint!.thumbnail32,
          fingerprint: it.fingerprint!,
        }));
      if (libraryEntriesToSave.length > 0) {
        saveLibraryEntries(libraryEntriesToSave);
      }
    }
  }, [items, settings]);

  const handleExportCsv = useCallback(() => {
    if (currentReport.blockedItemsCount > 0) {
      setReportDialogOpen(true);
      toast.error('Cannot export: Fix compliance or resolution issues first.');
      return;
    }
    executeActualCsvExport();
  }, [currentReport.blockedItemsCount, executeActualCsvExport]);

  // Metadata Embedding Engine (Skips vector files)
  const executeActualMetadataEmbed = useCallback(async () => {
    const doneItems = items.filter((i) => i.status === 'done' && !i.isExcluded);
    const validItems = doneItems.filter(
      (i) => !i.blockedTermsFound?.some((b) => !b.isAmbiguous)
    );

    if (validItems.length === 0) {
      toast.error('No compliant items to embed');
      return;
    }

    // Skip vector files (Vector files cannot embed metadata. Use the CSV.)
    const compatibleItems = validItems.filter((i) => {
      if (i.isVector || i.fileData.isVector) return false;
      const kind = isMetadataEmbeddable(i.fileData.originalName, i.fileData.mimeType);
      return kind !== null;
    });

    if (compatibleItems.length === 0) {
      setEmbedDialogStatus('no-compatible');
      setEmbedDialogOpen(true);
      return;
    }

    setEmbedDialogStatus('processing');
    setEmbedCurrent(0);
    setEmbedTotal(compatibleItems.length);
    setEmbedDialogOpen(true);

    const zipEntries: EmbeddedFileEntry[] = [];
    const failedFiles: string[] = [];
    let successCount = 0;
    const skippedCount = validItems.length - compatibleItems.length;

    for (let idx = 0; idx < compatibleItems.length; idx++) {
      const item = compatibleItems[idx];
      setEmbedCurrent(idx + 1);
      try {
        const rawBuffer = await item.fileData.file.arrayBuffer();
        const rawBytes = new Uint8Array(rawBuffer);
        const kind = isMetadataEmbeddable(item.fileData.originalName, item.fileData.mimeType);
        const title = (item.title || '').trim();
        const description = (item.description || title).trim();
        const keywords = item.keywords || [];

        let embeddedBytes: Uint8Array;
        if (kind === 'jpeg') {
          embeddedBytes = embedJpegMetadata(rawBytes, { title, description, keywords });
        } else if (kind === 'png') {
          embeddedBytes = embedPngMetadata(rawBytes, { title, description, keywords });
        } else {
          continue;
        }

        zipEntries.push({
          filename: item.fileData.originalName,
          data: embeddedBytes,
        });
        successCount++;
      } catch (err) {
        console.error(`Failed to embed metadata in ${item.fileData.originalName}:`, err);
        failedFiles.push(item.fileData.originalName);
      }
      await new Promise((resolve) => setTimeout(resolve, 15));
    }

    if (successCount === 0) {
      toast.error('Embedding failed: Could not process files');
      setEmbedDialogOpen(false);
      return;
    }

    try {
      await downloadEmbeddedFilesZip(zipEntries);
      setEmbedStats({ successCount, skippedCount, failedFiles });
      setEmbedDialogStatus('complete');

      if (settings.rememberExportedImages) {
        const libraryEntriesToSave: LibraryFingerprintEntry[] = compatibleItems
          .filter((it) => it.fingerprint)
          .map((it) => ({
            id: `lib-${Date.now()}-${it.id}`,
            filename: it.fileData.originalName,
            exportedAt: Date.now(),
            thumbnail32: it.fingerprint!.thumbnail32,
            fingerprint: it.fingerprint!,
          }));
        if (libraryEntriesToSave.length > 0) {
          saveLibraryEntries(libraryEntriesToSave);
        }
      }
    } catch (err) {
      console.error('Failed to create ZIP archive:', err);
      toast.error('Embedding failed: Error building ZIP');
      setEmbedDialogOpen(false);
    }
  }, [items, settings.rememberExportedImages]);

  const handleEmbedMetadata = useCallback(() => {
    if (currentReport.blockedItemsCount > 0) {
      setReportDialogOpen(true);
      toast.error('Cannot embed: Fix blocked trademark terms first.');
      return;
    }
    executeActualMetadataEmbed();
  }, [currentReport.blockedItemsCount, executeActualMetadataEmbed]);

  // One-click Fix Title for blocked term
  const handleFixTitle = useCallback(
    async (id: string, blockedTerm?: string) => {
      const target = items.find((it) => it.id === id);
      if (!target) return;

      toast.info(`Rewriting title to remove "${blockedTerm || 'blocked term'}"...`);
      try {
        const keyInfo = await keyRotator.getNextKey();
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'retitle',
            images: [target.fileData.aiDataUrl],
            currentTitle: target.title,
            reason: `Remove blocked trademark / brand term: "${blockedTerm || 'blocked term'}"`,
            platform: settings.platform,
            titleMaxLength: settings.titleLength,
            contributorLanguage: settings.contributorLanguage || 'en',
            isAiBatch: settings.isAiBatch || false,
            customBlockedWords: settings.customBlockedWords || [],
            apiKey: keyInfo?.apiKey,
            model: settings.selectedModel,
          }),
        });

        if (res.status === 401) {
          toast.error('Session expired or unauthorized. Please log in.');
          window.location.assign('/login');
          return;
        }
        if (res.status === 402) {
          const errData = await res.json().catch(() => ({}));
          const balance = typeof errData?.error?.balance === 'number' ? errData.error.balance : 0;
          setOutOfCreditsBalance(balance);
          setOutOfCreditsOpen(true);
          return;
        }
        if (!res.ok) {
          throw new Error('Failed to retitle image');
        }

        const data = await res.json();
        if (typeof data.creditsRemaining === 'number') {
          updateBalanceLocally(data.creditsRemaining);
        }
        const newTitle = data.metadataSets?.[0]?.title || data.title;
        if (newTitle) {
          handleUpdateItem(id, { title: newTitle });
          toast.success('Title fixed successfully!');
        }
      } catch (err) {
        console.error('Fix title error:', err);
        toast.error('Could not automatically fix title. Please edit manually.');
      }
    },
    [items, settings, handleUpdateItem, updateBalanceLocally]
  );

  // Fix all flagged similar titles & rewrite repetitive title openings (>3 in batch)
  const handleFixSimilarTitles = useCallback(async () => {
    const firstWordMap = new Map<string, string[]>();
    for (const item of items) {
      if (!item.title?.trim()) continue;
      const cleanFirst = item.title
        .trim()
        .replace(/^[^a-zA-Z0-9]+/, '')
        .split(/\s+/)[0]
        ?.toLowerCase()
        .replace(/[^a-z0-9]/g, '');

      if (cleanFirst && cleanFirst.length > 1) {
        const ids = firstWordMap.get(cleanFirst) || [];
        ids.push(item.id);
        firstWordMap.set(cleanFirst, ids);
      }
    }

    const synonyms: Record<string, string[]> = {
      modern: ['Contemporary', 'Sleek', 'Stylish', 'Clean', 'Minimalist', 'Sophisticated'],
      closeup: ['Detailed view of', 'Macro perspective of', 'Close focal view of', 'Sharp focus on'],
      'close-up': ['Detailed view of', 'Macro perspective of', 'Close focal view of', 'Sharp focus on'],
      portrait: ['Studio portrait of', 'Candid portrait of', 'Expressive headshot of', 'Artistic portrait of'],
      young: ['Youthful', 'Smiling', 'Energetic', 'Active', 'Dynamic'],
      beautiful: ['Scenic', 'Picturesque', 'Stunning', 'Charming', 'Serene', 'Vibrant'],
      abstract: ['Conceptual', 'Geometric', 'Artistic', 'Dynamic', 'Textured', 'Minimalist'],
      business: ['Corporate', 'Professional', 'Commercial', 'Executive', 'Enterprise'],
      vintage: ['Retro', 'Classic', 'Nostalgic', 'Antique', 'Timeless'],
      aerial: ['Top-down view of', 'Elevated view of', 'High-angle perspective on', 'Panoramic view of'],
      happy: ['Joyful', 'Cheerful', 'Smiling', 'Radiant', 'Delighted'],
      cozy: ['Warm', 'Inviting', 'Comfortable', 'Homely', 'Intimate'],
    };

    let openingFixedCount = 0;
    const modifiedItems = items.map((item) => {
      if (!item.title?.trim()) return item;
      const words = item.title.trim().split(/\s+/);
      const firstWord = words[0]?.toLowerCase().replace(/[^a-z0-9]/g, '');
      const groupIds = firstWord ? firstWordMap.get(firstWord) : null;

      if (groupIds && groupIds.length > 3) {
        const indexInGroup = groupIds.indexOf(item.id);
        if (indexInGroup > 0) {
          const synList = synonyms[firstWord] || [
            'Distinctive',
            'Authentic',
            'Selected',
            'Highlighted',
            'Featured',
            'Vibrant',
          ];
          const replacement = synList[(indexInGroup - 1) % synList.length];
          const newTitle = `${replacement} ${words.slice(1).join(' ')}`.trim();
          openingFixedCount++;
          return { ...item, title: newTitle, similarTo: [] };
        }
      }
      return item;
    });

    if (openingFixedCount > 0) {
      setItems(modifiedItems);
      saveAllBatchItems(modifiedItems);
      toast.success(`Rewrote opening words for ${openingFixedCount} titles`);
    }

    const remainingFlagged = modifiedItems.filter(
      (it) => it.status === 'done' && it.similarTo && it.similarTo.length > 0
    );

    if (remainingFlagged.length > 0) {
      toast.info(`Refining ${remainingFlagged.length} similar title${remainingFlagged.length === 1 ? '' : 's'} with AI...`);
      for (const item of remainingFlagged) {
        try {
          const avoidList = (item.similarTo || [])
            .map((s) => s.otherFilename)
            .filter(Boolean);
          const keyInfo = await keyRotator.getNextKey();
          const res = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: 'retitle',
              images: [item.fileData.aiDataUrl],
              currentTitle: item.title,
              reason: 'Rewrite with a distinct opening and perspective to eliminate batch similarity',
              avoidTitles: avoidList,
              platform: settings.platform,
              titleMaxLength: settings.titleLength,
              contributorLanguage: settings.contributorLanguage || 'en',
              isAiBatch: settings.isAiBatch || false,
              customBlockedWords: settings.customBlockedWords || [],
              apiKey: keyInfo?.apiKey,
              model: settings.selectedModel,
            }),
          });

          if (res.status === 402) {
            const errData = await res.json().catch(() => ({}));
            const balance = typeof errData?.error?.balance === 'number' ? errData.error.balance : 0;
            setOutOfCreditsBalance(balance);
            setOutOfCreditsOpen(true);
            return;
          }

          if (res.ok) {
            const data = await res.json();
            if (typeof data.creditsRemaining === 'number') {
              updateBalanceLocally(data.creditsRemaining);
            }
            const newTitle = data.metadataSets?.[0]?.title || data.title;
            if (newTitle) {
              handleUpdateItem(item.id, { title: newTitle, similarTo: [] });
            }
          }
        } catch (e) {
          console.error('Error fixing similar title:', e);
        }
        await new Promise((r) => setTimeout(r, 200));
      }
      toast.success('Finished adjusting similar titles!');
    } else if (openingFixedCount === 0) {
      toast.info('No repeated opening words or similar titles found to adjust');
    }
  }, [items, settings, handleUpdateItem, updateBalanceLocally]);

  // Fix all issues across items (blocked terms locally, similar titles with retitle, re-run compliance, summary)
  const handleFixAllIssues = useCallback(async () => {
    let fixedCount = 0;
    let stillBlockedCount = 0;

    const updatedItems = [...items];

    for (let i = 0; i < updatedItems.length; i++) {
      const item = updatedItems[i];
      if (item.status !== 'done') continue;

      // Rule 4: Do NOT touch items excluded for near-duplicate pictures, size limits, or a visible logo
      const isDuplicate = item.similarityClusterId && !item.isKeptBest;
      const isSizeExcluded = item.fileData && (item.fileData.width < 800 || item.fileData.height < 800);
      const hasVisibleLogo = item.flags?.visibleLogoOrBrand || item.blockedTermsFound?.some(b => b.category.toLowerCase().includes('logo') || b.term.toLowerCase().includes('logo') || b.category.toLowerCase().includes('trademark'));
      
      const hasBlocked = item.blockedTermsFound?.some(b => !b.isAmbiguous);
      const hasSimilar = item.similarTo && item.similarTo.length > 0;

      if (!hasBlocked && !hasSimilar) {
        continue;
      }

      if (isDuplicate || isSizeExcluded || hasVisibleLogo) {
        if (hasBlocked || hasSimilar) {
          stillBlockedCount++;
        }
        continue;
      }

      let itemChanged = false;

      // 1. Blocked-term issue items: local fix (no AI call, no credits)
      if (hasBlocked) {
        const nonAmbiguousBlocked = (item.blockedTermsFound || []).filter(b => !b.isAmbiguous);
        let newTitle = item.title;
        let newKeywords = [...(item.keywords || [])];

        for (const b of nonAmbiguousBlocked) {
          const termRegex = new RegExp(`\\b${b.term}\\b`, 'gi');
          newTitle = newTitle.replace(termRegex, '').replace(/\s+/g, ' ').trim();
          newKeywords = newKeywords.filter(kw => !kw.toLowerCase().includes(b.term.toLowerCase()));
        }

        // Fill missing keywords with safe alternatives (no brands, no names)
        const safeAlternatives = ['commercial', 'studio', 'editorial', 'professional', 'minimalist', 'clean', 'modern', 'creative', 'concept', 'abstract', 'isolated', 'background', 'digital', 'graphic'];
        const targetCount = settings.keywordCount || 30;
        for (const alt of safeAlternatives) {
          if (newKeywords.length >= targetCount) break;
          if (!newKeywords.some(kw => kw.toLowerCase() === alt)) {
            newKeywords.push(alt);
          }
        }

        newTitle = newTitle.replace(/^[^a-zA-Z0-9]+/, '').trim();
        if (!newTitle) newTitle = 'Commercial stock asset';

        item.title = newTitle;
        item.keywords = newKeywords;
        itemChanged = true;
      }

      // 2. Similar title items: rewrite title using existing retitle logic, charged once per item
      if (hasSimilar) {
        try {
          const avoidList = (item.similarTo || []).map(s => s.otherFilename).filter(Boolean);
          const keyInfo = await keyRotator.getNextKey();
          const res = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: 'retitle',
              images: [item.fileData.aiDataUrl],
              currentTitle: item.title,
              reason: 'Rewrite with a distinct opening and perspective to eliminate batch similarity',
              avoidTitles: avoidList,
              platform: settings.platform,
              titleMaxLength: settings.titleLength,
              contributorLanguage: settings.contributorLanguage || 'en',
              isAiBatch: settings.isAiBatch || false,
              customBlockedWords: settings.customBlockedWords || [],
              apiKey: keyInfo?.apiKey,
              model: settings.selectedModel,
            }),
          });

          if (res.status === 402) {
            const errData = await res.json().catch(() => ({}));
            const balance = typeof errData?.error?.balance === 'number' ? errData.error.balance : 0;
            setOutOfCreditsBalance(balance);
            setOutOfCreditsOpen(true);
            break;
          }

          if (res.ok) {
            const data = await res.json();
            if (typeof data.creditsRemaining === 'number') {
              updateBalanceLocally(data.creditsRemaining);
            }
            const newTitle = data.metadataSets?.[0]?.title || data.title;
            if (newTitle) {
              item.title = newTitle;
              item.similarTo = [];
              itemChanged = true;
            }
          }
        } catch (e) {
          console.error('Error fixing similar title in fix all:', e);
        }
      }

      // 3. After each fix, run the existing compliance check again
      if (itemChanged) {
        const comp = scanItemCompliance(
          item.title,
          item.keywords,
          item.description,
          settings.customBlockedWords || [],
          item.approvedIssues || [],
          settings.isAiBatch || false
        );
        item.blockedTermsFound = comp.blockedTerms;
        const seo = calculateItemSeoScore(item);
        item.seoScore = seo.score;
        item.seoChecklist = seo.checklist;

        if (!comp.hasErrors && (!item.similarTo || item.similarTo.length === 0)) {
          // Passes: remove excluded tag
          item.isExcluded = false;
          item.excludedReason = undefined;
          fixedCount++;
        } else {
          // Still fails: keep excluded and show real reason
          item.isExcluded = true;
          item.excludedReason = comp.hasErrors ? `Blocked terms: ${comp.blockedTerms.map(b => b.term).join(', ')}` : 'Similar title issue remains';
          stillBlockedCount++;
        }
      } else {
        stillBlockedCount++;
      }

      saveBatchItem(item);
      await new Promise((r) => setTimeout(r, 100));
    }

    setItems([...updatedItems]);
    toast.success(`Fixed ${fixedCount}, still blocked ${stillBlockedCount}`);
  }, [items, settings, updateBalanceLocally]);

  // Approve ambiguous term
  const handleApproveIssue = useCallback(
    (id: string, term: string) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          const approved = [...(item.approvedIssues || []), term.toLowerCase()];
          const comp = scanItemCompliance(
            item.title,
            item.keywords,
            item.description,
            settings.customBlockedWords || [],
            approved,
            settings.isAiBatch || false
          );
          const seo = calculateItemSeoScore({ ...item, blockedTermsFound: comp.blockedTerms });
          const updated = {
            ...item,
            approvedIssues: approved,
            blockedTermsFound: comp.blockedTerms,
            seoScore: seo.score,
            seoChecklist: seo.checklist,
          };
          saveBatchItem(updated);
          return updated;
        })
      );
      toast.success(`Approved "${term}" for this session.`);
    },
    [settings]
  );

  // Similarity Cluster Winner
  const handleSetClusterWinner = useCallback(
    (cluster: SimilarityCluster, newWinnerId: string) => {
      setItems((prev) => {
        const winnerItem = prev.find((it) => it.id === newWinnerId);
        const winnerName = winnerItem?.fileData.originalName || 'chosen winner';
        const updated = prev.map((it) => {
          if (!cluster.itemIds.includes(it.id)) return it;
          if (it.id === newWinnerId) {
            return {
              ...it,
              isExcluded: false,
              manualInclude: true,
              isKeptBest: true,
              excludedReason: undefined,
            };
          } else {
            return {
              ...it,
              isExcluded: true,
              manualInclude: false,
              isKeptBest: false,
              excludedReason: `Similar to ${winnerName}`,
            };
          }
        });
        saveAllBatchItems(updated);
        return updated;
      });

      setSimilarityClusters((prev) =>
        prev.map((c) => (c.clusterId === cluster.clusterId ? { ...c, winnerId: newWinnerId } : c))
      );
      toast.success('Updated cluster: new primary image kept.');
    },
    []
  );

  // Sequential Queue Generation Engine
  const startQueue = useCallback((customItems?: GeneratorItemState[], limit?: number) => {
    const targetItems = customItems || items;
    if (targetItems.length === 0) return;

    if (queueRef.current) {
      queueRef.current.stop();
      queueRef.current = null;
    }

    setIsGenerating(true);
    setIsPaused(false);

    const queue = new GeneratorQueue(targetItems, settings, {
      onItemUpdate: (updatedItem) => {
        setItems((prev) =>
          prev.map((it) => (it.id === updatedItem.id ? updatedItem : it))
        );
      },
      onItemCompleted: (completedItem) => {
        saveBatchItem(completedItem);
      },
      onProgressUpdate: (progressState: QueueProgressState) => {
        setIsGenerating(progressState.isGenerating);
        setIsPaused(progressState.isPaused);
        setCurrentFilename(progressState.currentFilename || '');
        setCurrentImageIndex(progressState.currentIndex || 0);
        setCurrentKeyInfo(progressState.currentKeyInfo || '');
        setIsCoolingDown(progressState.isCoolingDown || false);
        setCooldownSecondsRemaining(progressState.cooldownSecondsRemaining || 0);
        setCooldownText(
          progressState.isCoolingDown
            ? progressState.cooldownReason || `Cooling down (${progressState.cooldownSecondsRemaining}s)...`
            : ''
        );
        setStatusMessage(progressState.statusMessage);
      },
      onStateChange: (running, paused) => {
        setIsGenerating(running);
        setIsPaused(paused);
      },
      onOutOfCredits: (balance: number) => {
        setOutOfCreditsBalance(balance);
        setOutOfCreditsOpen(true);
      },
      onCreditsRemaining: (creditsRemaining: number) => {
        updateBalanceLocally(creditsRemaining);
      },
      onComplete: () => {
        setIsGenerating(false);
        setIsPaused(false);
        setCurrentFilename('');
        setCurrentImageIndex(0);
        setCurrentKeyInfo('');
        setIsCoolingDown(false);
        setCooldownSecondsRemaining(0);
        setCooldownText('');
        queueRef.current = null;
        toast.success('Sequential generation complete!');

        if (settings.autoCsvDownload) {
          handleExportCsv();
        }
        if (settings.autoEmbed && settings.mode === 'metadata') {
          setTimeout(() => {
            handleEmbedMetadata();
          }, settings.autoCsvDownload ? 500 : 100);
        }
      },
    });

    queueRef.current = queue;
    queue.start(limit);
  }, [items, settings, handleExportCsv, handleEmbedMetadata, updateBalanceLocally]);

  const handlePause = useCallback(() => {
    if (queueRef.current) {
      queueRef.current.pause();
      setIsPaused(true);
      toast.info('Pausing queue after current image...');
    }
  }, []);

  const handleResume = useCallback(() => {
    if (queueRef.current && isPaused) {
      queueRef.current.resume();
      setIsPaused(false);
      toast.success('Resuming sequential processing...');
    } else {
      startQueue();
    }
  }, [isPaused, startQueue]);

  const handleStop = useCallback(() => {
    if (queueRef.current) {
      queueRef.current.stop();
      queueRef.current = null;
    }
    setIsGenerating(false);
    setIsPaused(false);
    setCurrentFilename('');
    setCurrentImageIndex(0);
    setCurrentKeyInfo('');
    setIsCoolingDown(false);
    setCooldownSecondsRemaining(0);
    setCooldownText('');
    setStatusMessage('Generation stopped');
    toast.info('Generation stopped');
  }, []);

  const handleKeepInstead = useCallback(
    (itemId: string) => {
      let updatedItems: GeneratorItemState[] = [];
      const cluster = similarityClusters.find((c) => c.itemIds.includes(itemId));
      if (cluster) {
        const winnerItem = items.find((it) => it.id === itemId);
        const winnerName = winnerItem?.fileData.originalName || 'chosen winner';
        updatedItems = items.map((it) => {
          if (!cluster.itemIds.includes(it.id)) return it;
          if (it.id === itemId) {
            return {
              ...it,
              isExcluded: false,
              manualInclude: true,
              isKeptBest: true,
              excludedReason: undefined,
              status: 'queued' as const,
              errorMessage: undefined,
            };
          } else {
            return {
              ...it,
              isExcluded: true,
              manualInclude: false,
              isKeptBest: false,
              excludedReason: `Similar to ${winnerName}`,
            };
          }
        });
        setSimilarityClusters((prev) =>
          prev.map((c) => (c.clusterId === cluster.clusterId ? { ...c, winnerId: itemId } : c))
        );
      } else {
        updatedItems = items.map((it) =>
          it.id === itemId
            ? {
                ...it,
                isExcluded: false,
                manualInclude: true,
                isKeptBest: true,
                excludedReason: undefined,
                status: 'queued' as const,
                errorMessage: undefined,
              }
            : it
        );
      }
      setItems(updatedItems);
      saveAllBatchItems(updatedItems);
      toast.success('Kept this image for export. Starting generation...');
      startQueue(updatedItems);
    },
    [similarityClusters, items, startQueue]
  );

  const handleOverrideInclude = useCallback(
    (itemId: string) => {
      const updatedItems = items.map((it) =>
        it.id === itemId
          ? {
              ...it,
              isExcluded: false,
              manualInclude: true,
              excludedReason: 'manual_override',
              status: 'queued' as const,
              errorMessage: undefined,
            }
          : it
      );
      setItems(updatedItems);
      saveAllBatchItems(updatedItems);
      toast.success('Included image in export. Starting generation...');
      startQueue(updatedItems);
    },
    [items, startQueue]
  );

  const handleIgnoreLibraryAndGenerate = useCallback(() => {
    const updated = items.map((it) => {
      if (it.excludedReason?.startsWith('Already exported')) {
        return {
          ...it,
          isExcluded: false,
          manualInclude: true,
          excludedReason: 'manual_override',
          status: 'queued' as const,
          errorMessage: undefined,
        };
      }
      return it;
    });
    setItems(updated);
    saveAllBatchItems(updated);
    toast.success('Included all previously exported files in this batch. Starting generation...');
    startQueue(updated);
  }, [items, startQueue]);

  const handleClearLibraryBatch = useCallback(async () => {
    await clearLibraryStore();
    toast.success('Exported images library cleared');
    runSimilarityCheck(items);
  }, [items, runSimilarityCheck]);

  // Delete Similar: Confirmation Handler with 10s Undo Toast
  const handleConfirmDeleteSimilar = useCallback(
    (deletedItems: GeneratorItemState[]) => {
      if (deletedItems.length === 0) return;
      const deletedIds = new Set(deletedItems.map((d) => d.id));
      const previousItems = [...items];
      const previousClusters = [...similarityClusters];

      setItems((prev) => {
        const filtered = prev.filter((it) => !deletedIds.has(it.id));
        saveAllBatchItems(filtered);
        return filtered;
      });

      setSimilarityClusters((prev) =>
        prev
          .map((c) => ({
            ...c,
            itemIds: c.itemIds.filter((id) => !deletedIds.has(id)),
          }))
          .filter((c) => c.itemIds.length > 0)
      );

      const cleanupTimer = setTimeout(() => {
        deletedItems.forEach((item) => {
          deleteSavedBatchItem(item.id);
          if (item.fileData?.previewUrl && item.fileData.previewUrl.startsWith('blob:')) {
            try {
              URL.revokeObjectURL(item.fileData.previewUrl);
            } catch {}
          }
        });
      }, 10000);

      toast(`Deleted ${deletedItems.length} duplicate file${deletedItems.length === 1 ? '' : 's'}`, {
        description: 'Keepers remain in the batch. Files on your computer are untouched.',
        duration: 10000,
        action: {
          label: 'Undo',
          onClick: () => {
            clearTimeout(cleanupTimer);
            setItems(previousItems);
            saveAllBatchItems(previousItems);
            setSimilarityClusters(previousClusters);
            toast.success('Restored deleted files to batch.');
          },
        },
      });
    },
    [items, similarityClusters]
  );

  const handleDeleteClusterOthers = useCallback(
    (cluster: SimilarityCluster) => {
      const keeperId = cluster.winnerId || cluster.itemIds[0];
      const idsToRemove = new Set(cluster.itemIds.filter((id) => id !== keeperId));
      if (idsToRemove.size === 0) return;

      const deletedItems = items.filter((it) => idsToRemove.has(it.id));
      const previousItems = [...items];
      const previousClusters = [...similarityClusters];

      setItems((prev) => {
        const filtered = prev.filter((it) => !idsToRemove.has(it.id));
        saveAllBatchItems(filtered);
        return filtered;
      });

      setSimilarityClusters((prev) =>
        prev.map((c) =>
          c.clusterId === cluster.clusterId
            ? { ...c, itemIds: [keeperId] }
            : { ...c, itemIds: c.itemIds.filter((id) => !idsToRemove.has(id)) }
        )
      );

      const cleanupTimer = setTimeout(() => {
        deletedItems.forEach((item) => {
          deleteSavedBatchItem(item.id);
          if (item.fileData?.previewUrl && item.fileData.previewUrl.startsWith('blob:')) {
            try {
              URL.revokeObjectURL(item.fileData.previewUrl);
            } catch {}
          }
        });
      }, 10000);

      const keeperName = items.find((it) => it.id === keeperId)?.fileData.originalName || 'keeper';
      toast(`Deleted ${deletedItems.length} duplicate file${deletedItems.length === 1 ? '' : 's'} from group`, {
        description: `Keeping ${keeperName}. Files on your computer are untouched.`,
        duration: 10000,
        action: {
          label: 'Undo',
          onClick: () => {
            clearTimeout(cleanupTimer);
            setItems(previousItems);
            saveAllBatchItems(previousItems);
            setSimilarityClusters(previousClusters);
            toast.success('Restored group files to batch.');
          },
        },
      });
    },
    [items, similarityClusters]
  );

  const handleScrollToItem = useCallback((targetId: string) => {
    const el = document.getElementById(`result-card-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-primary');
      setTimeout(() => el.classList.remove('ring-2', 'ring-primary'), 2000);
    }
  }, []);

  const handleRegenerateItem = useCallback(
    (id: string) => {
      const updated = items.map((item) =>
        item.id === id ? { ...item, status: 'queued' as const, errorMessage: undefined } : item
      );
      setItems(updated);
      saveAllBatchItems(updated);
      startQueue(updated);
    },
    [items, startQueue]
  );

  const activeMinSizeCheck = settings.minSizeCheck || (settings.platform === 'adobe-stock' ? 'exclude' : 'warn');

  const under4MpExcludedCount = useMemo(() => {
    if (activeMinSizeCheck !== 'exclude') return 0;
    return items.filter(
      (it) =>
        isItemExcluded(it, activeMinSizeCheck) &&
        (it.excludedReason === "Below Adobe's 4 MP minimum, likely refused" ||
          ((it.fileData.width || 0) > 0 &&
            (it.fileData.height || 0) > 0 &&
            ((it.fileData.width * it.fileData.height) / 1_000_000) < 4.0 &&
            !it.excludedReason?.startsWith('Similar') &&
            !it.excludedReason?.startsWith('Already exported')))
    ).length;
  }, [items, activeMinSizeCheck]);

  const totalExcludedCount = useMemo(() => {
    return items.filter((i) => isItemExcluded(i, activeMinSizeCheck)).length;
  }, [items, activeMinSizeCheck]);

  const similarExcludedCount = useMemo(() => {
    return Math.max(0, totalExcludedCount - under4MpExcludedCount);
  }, [totalExcludedCount, under4MpExcludedCount]);

  const handleIncludeAll = useCallback(() => {
    setItems((prev) => {
      const next = prev.map((it) =>
        isItemExcluded(it, activeMinSizeCheck)
          ? { ...it, isExcluded: false, manualInclude: true, excludedReason: 'manual_override' }
          : it
      );
      saveAllBatchItems(next);
      return next;
    });
    toast.success(`Included all ${totalExcludedCount} excluded files in batch generation.`);
  }, [activeMinSizeCheck, totalExcludedCount]);

  const handleIncludeBelow4MpOnly = useCallback(() => {
    setItems((prev) => {
      const next = prev.map((it) => {
        const isBelow4Mp =
          (it.fileData.width || 0) > 0 &&
          (it.fileData.height || 0) > 0 &&
          ((it.fileData.width * it.fileData.height) / 1_000_000) < 4.0;
        const isExcludedUnder4Mp =
          it.excludedReason === "Below Adobe's 4 MP minimum, likely refused" ||
          Boolean(it.excludedReason?.includes('4 MP')) ||
          (isBelow4Mp && !it.excludedReason?.startsWith('Similar') && !it.excludedReason?.startsWith('Already exported'));

        if (isItemExcluded(it, activeMinSizeCheck) && isExcludedUnder4Mp) {
          return { ...it, isExcluded: false, manualInclude: true, excludedReason: 'manual_override' };
        }
        return it;
      });
      saveAllBatchItems(next);
      return next;
    });
    toast.success(`Included ${under4MpExcludedCount} file(s) below 4 MP in batch generation.`);
  }, [activeMinSizeCheck, under4MpExcludedCount]);

  const handleGenerateAll = () => {
    // 1. Excluded images count
    const excludedCount = items.filter((it) => isItemExcluded(it, activeMinSizeCheck)).length;

    // 2. Needed items: items that are queued or failed and NOT excluded, and NOT needing preview, and NOT failed SVG raster
    const neededItems = items.filter(
      (it) =>
        (it.status === 'queued' || it.status === 'failed') &&
        !it.needsPreview &&
        !it.svgRasterFailed &&
        !isItemExcluded(it, activeMinSizeCheck)
    );
    const needed = neededItems.length;
    const needsPreviewCount = items.filter((it) => it.needsPreview).length;

    if (needed === 0) {
      if (needsPreviewCount > 0) {
        toast.info(`${needsPreviewCount} vector file(s) need a preview image. Add preview to generate.`);
      } else if (excludedCount > 0) {
        toast.info(`Skipped ${excludedCount} excluded files`);
      } else {
        toast.info('All images are already generated.');
      }
      return;
    }

    // 3. Before Generate All starts, if the batch needs more credits than the balance, show dialog
    if (!creditsLoading && !creditsError && needed > creditBalance) {
      if (creditBalance === 0) {
        setOutOfCreditsBalance(0);
        setOutOfCreditsOpen(true);
        return;
      }
      setBatchCreditsInfo({ needed, balance: creditBalance });
      setBatchCreditsDialogOpen(true);
      return;
    }

    // 4. Show skipped notice if any excluded files
    if (excludedCount > 0) {
      toast.info(`Skipped ${excludedCount} excluded files`);
    }

    // 5. Start queue
    startQueue();
  };

  const handleGenerateFirstFromDialog = (count: number) => {
    const excludedCount = items.filter((it) => isItemExcluded(it, activeMinSizeCheck)).length;
    if (excludedCount > 0) {
      toast.info(`Skipped ${excludedCount} excluded files`);
    }
    startQueue(undefined, count);
  };

  // Counts & status
  const doneCount = items.filter(
    (i) => i.status === 'done' && Boolean(i.title?.trim()) && i.title.trim() !== i.fileData.originalName
  ).length;
  const failedCount = items.filter((i) => i.status === 'failed').length;
  const needsPreviewCount = items.filter((i) => i.needsPreview).length;
  const pendingCount = items.filter(
    (i) =>
      (i.status === 'queued' || i.status === 'working' || i.status === 'failed') &&
      !i.needsPreview &&
      !i.svgRasterFailed &&
      !isItemExcluded(i, activeMinSizeCheck)
  ).length;
  const hasResults = doneCount > 0;
  const currentSpec = PLATFORM_SPECS[settings.platform] || PLATFORM_SPECS['adobe-stock'];

  const similarTitleCount = useMemo(() => {
    return items.filter(
      (i) =>
        i.status === 'done' &&
        Boolean(i.title?.trim()) &&
        i.title.trim() !== i.fileData.originalName &&
        i.similarTo &&
        i.similarTo.length > 0
    ).length;
  }, [items]);

  const blockedCount = useMemo(() => {
    return items.filter(
      (i) => i.status === 'done' && i.blockedTermsFound?.some((b) => !b.isAmbiguous)
    ).length;
  }, [items]);

  const totalSimilarExcluded = totalExcludedCount;

  const libraryExcludedCount = useMemo(() => {
    return items.filter((i) => i.isExcluded && i.excludedReason?.startsWith('Already exported')).length;
  }, [items]);

  const similarDeleteCount = useMemo(() => {
    const similarOnly = items.filter(
      (it) =>
        it.isExcluded &&
        !it.excludedReason?.startsWith('Already exported') &&
        it.excludedReason !== "Below Adobe's 4 MP minimum, likely refused"
    ).length;
    return similarOnly > 0 ? similarOnly : libraryExcludedCount;
  }, [items, libraryExcludedCount]);

  const generatingCount = useMemo(() => {
    return items.filter((i) => i.status === 'working' || (i.status === 'queued' && !isItemExcluded(i, activeMinSizeCheck))).length;
  }, [items, activeMinSizeCheck]);

  const convertingVectorCount = useMemo(() => {
    return items.filter((i) => i.isConverting || i.fileData?.isConverting).length;
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6 items-start">
        {/* Left Column: Controls & Settings */}
        <div className="space-y-4">
          <ControlsCard
            mode={settings.mode}
            onModeChange={(m) => updateSettings({ mode: m })}
            selectedModel={settings.selectedModel}
            onOpenApiKeys={() => setApiKeysOpen(true)}
            hasCustomKeys={hasCustomKeys}
          />

          <BatchCard
            delaySeconds={settings.interImageDelaySeconds ?? 10}
            onDelayChange={(sec) => updateSettings({ interImageDelaySeconds: sec })}
            disabled={isGenerating || isAnalyzingSimilarity}
          />

          {settings.mode === 'metadata' ? (
            <>
              <MetadataSettings
                settings={settings}
                onUpdate={updateSettings}
                disabled={isGenerating || isAnalyzingSimilarity}
              />
              <ComplianceSettings
                settings={settings}
                onUpdate={updateSettings}
                disabled={isGenerating || isAnalyzingSimilarity}
                onLibraryChanged={() => {
                  if (items.length > 0) runSimilarityCheck(items);
                }}
              />
            </>
          ) : (
            <PromptSettings
              settings={settings}
              onUpdate={updateSettings}
              disabled={isGenerating || isAnalyzingSimilarity}
            />
          )}
        </div>

        {/* Right Column: Upload, Actions & Results */}
        <div className="flex-1 min-w-0 space-y-4">
          <UploadCard
            onFilesSelected={handleFilesSelected}
            currentCount={items.length}
            maxFiles={1000}
            disabled={isGenerating || isAnalyzingSimilarity}
          />

          {/* Similarity Analysis Progress Card */}
          {similarityProgress && (
            <SimilarityProgressCard progress={similarityProgress} />
          )}

          <ActionBar
            totalFiles={items.length}
            doneCount={doneCount}
            failedCount={failedCount}
            pendingCount={pendingCount}
            isGenerating={isGenerating}
            isPaused={isPaused}
            isAnalyzingSimilarity={isAnalyzingSimilarity}
            hasResults={hasResults}
            mode={settings.mode}
            similarCount={similarTitleCount}
            similarClusterCount={similarityClusters.length}
            similarExcludedCount={similarExcludedCount}
            under4MpExcludedCount={under4MpExcludedCount}
            totalExcludedCount={totalExcludedCount}
            needsPreviewCount={needsPreviewCount}
            convertingVectorCount={convertingVectorCount}
            libraryExcludedCount={libraryExcludedCount}
            similarDeleteCount={similarDeleteCount}
            generatingCount={generatingCount}
            blockedCount={blockedCount}
            currentFilename={currentFilename}
            currentImageIndex={currentImageIndex}
            currentKeyInfo={currentKeyInfo}
            isCoolingDown={isCoolingDown}
            cooldownSecondsRemaining={cooldownSecondsRemaining}
            cooldownText={cooldownText}
            statusMessage={statusMessage}
            onGenerateAll={handleGenerateAll}
            onPause={handlePause}
            onResume={handleResume}
            onStop={handleStop}
            onClearAll={handleClearAll}
            onDeleteSimilar={() => setDeleteSimilarOpen(true)}
            onExportCsv={handleExportCsv}
            onEmbedMetadata={handleEmbedMetadata}
            onFixSimilarTitles={handleFixSimilarTitles}
            onFixAllIssues={handleFixAllIssues}
            onReviewClusters={() => setSimilarityDialogOpen(true)}
            onOpenReport={() => setReportDialogOpen(true)}
          />

          <ResultList
            items={items}
            mode={settings.mode}
            platformSpec={currentSpec}
            minSizeCheck={activeMinSizeCheck}
            showSimilarityScores={settings.showSimilarityScores}
            alreadyExportedCount={libraryExcludedCount}
            totalExcludedCount={totalExcludedCount}
            under4MpExcludedCount={under4MpExcludedCount}
            similarExcludedCount={similarExcludedCount}
            onIncludeAll={handleIncludeAll}
            onIncludeBelow4MpOnly={handleIncludeBelow4MpOnly}
            onIgnoreLibraryAndGenerate={handleIgnoreLibraryAndGenerate}
            onClearLibrary={handleClearLibraryBatch}
            onUpdateItem={handleUpdateItem}
            onDeleteItem={handleDeleteItem}
            onRegenerateItem={handleRegenerateItem}
            onFixTitle={handleFixTitle}
            onApproveIssue={handleApproveIssue}
            onScrollToItem={handleScrollToItem}
            onKeepInstead={handleKeepInstead}
            onIncludeAnyway={handleOverrideInclude}
            onAttachPreview={handleAttachPreview}
            onRetrySvgRaster={handleRetrySvgRaster}
          />
        </div>
      </div>

      {/* API Keys Configuration Dialog */}
      <ApiKeysDialog
        open={apiKeysOpen}
        onOpenChange={setApiKeysOpen}
        settings={settings}
        onUpdateSettings={updateSettings}
        onKeysChanged={checkCustomKeys}
      />

      {/* Embed Metadata Progress Dialog */}
      <EmbedDialog
        open={embedDialogOpen}
        onOpenChange={setEmbedDialogOpen}
        status={embedDialogStatus}
        current={embedCurrent}
        total={embedTotal}
        stats={embedStats}
      />

      {/* Step 8 Deep Similarity Review Dialog */}
      <SimilarityClustersDialog
        open={similarityDialogOpen}
        onOpenChange={setSimilarityDialogOpen}
        clusters={similarityClusters}
        items={items}
        onSetWinner={handleSetClusterWinner}
        onOverrideInclude={handleOverrideInclude}
        onDeleteClusterOthers={handleDeleteClusterOthers}
      />

      {/* Delete Similar Confirmation Dialog */}
      <DeleteSimilarDialog
        open={deleteSimilarOpen}
        onOpenChange={setDeleteSimilarOpen}
        items={items}
        clusters={similarityClusters}
        onConfirmDelete={handleConfirmDeleteSimilar}
      />

      {/* Pre-Export Compliance & Quality Report Dialog */}
      <ComplianceReportDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        report={currentReport}
        onProceedExport={executeActualCsvExport}
        onFixTitle={handleFixTitle}
        onApproveAmbiguous={handleApproveIssue}
        onFixSimilarTitles={handleFixSimilarTitles}
      />

      {/* Out of Credits Dialog */}
      <OutOfCreditsDialog
        open={outOfCreditsOpen}
        onOpenChange={setOutOfCreditsOpen}
        balance={outOfCreditsBalance}
      />

      {/* Batch Needs More Credits Dialog (Requirement 5) */}
      <BatchCreditsDialog
        open={batchCreditsDialogOpen}
        onOpenChange={setBatchCreditsDialogOpen}
        needed={batchCreditsInfo.needed}
        balance={batchCreditsInfo.balance}
        onGenerateFirst={handleGenerateFirstFromDialog}
        onCancel={() => setBatchCreditsDialogOpen(false)}
      />
    </div>
  );
}
