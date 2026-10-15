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
import { SimilarityProgressCard } from '@/components/generator/SimilarityProgressCard';
import { ComplianceReportDialog } from '@/components/generator/ComplianceReportDialog';
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
} from '@/lib/generator/db';
import { GeneratorItemState, GeneratorQueue } from '@/lib/generator/queue';
import { processFileForGenerator } from '@/lib/generator/compress';
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
import { toast } from 'sonner';

export default function GeneratorPage() {
  const [settings, setSettings] = useState<GeneratorSavedSettings>(DEFAULT_GENERATOR_SETTINGS);
  const [items, setItems] = useState<GeneratorItemState[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [apiKeysOpen, setApiKeysOpen] = useState(false);
  const [hasCustomKeys, setHasCustomKeys] = useState(false);

  // Similarity Guard States
  const [similarityProgress, setSimilarityProgress] = useState<SimilarityProgress | null>(null);
  const [isAnalyzingSimilarity, setIsAnalyzingSimilarity] = useState(false);
  const [similarityClusters, setSimilarityClusters] = useState<SimilarityCluster[]>([]);
  const [similarityDialogOpen, setSimilarityDialogOpen] = useState(false);

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

  const queueRef = useRef<GeneratorQueue | null>(null);

  const checkCustomKeys = useCallback(async () => {
    const keys = await getStoredApiKeys();
    const active = keys.some((k) => k.isActive && !k.isInvalid);
    setHasCustomKeys(active);
  }, []);

  // Load initial settings and check keys
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
        // Never count a file name as a title anywhere; only items with real generated title have similarTo
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
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [items, settings.titleUniqueness]);

  // Handle uploaded files
  const handleFilesSelected = async (newFiles: File[]) => {
    const maxCapacity = 200;
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

    const newItems: GeneratorItemState[] = [];

    for (const file of filesToProcess) {
      try {
        const fileData = await processFileForGenerator(file);
        const mp = fileData.width > 0 && fileData.height > 0 ? (fileData.width * fileData.height) / 1_000_000 : 0;
        const isUnder4Mp = fileData.width > 0 && fileData.height > 0 && mp < 4.0;

        newItems.push({
          id: fileData.id,
          fileData,
          status: 'queued',
          title: '',
          description: '',
          keywords: [],
          prompt: '',
          retryCount: 0,
          isExcluded: isUnder4Mp,
          excludedReason: isUnder4Mp ? "Below Adobe's 4 MP minimum, likely refused" : undefined,
        });
      } catch (err) {
        console.error(`Failed to process ${file.name}:`, err);
        toast.error(`Could not process ${file.name}`);
      }

      // Yield to UI to keep browser responsive with up to 200 files
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    if (newItems.length > 0) {
      const combined = [...items, ...newItems];
      setItems(combined);
      toast.success(`Added ${newItems.length} file${newItems.length === 1 ? '' : 's'} to queue`);

      // Run Deep Similarity Guard on the updated list
      runSimilarityCheck(combined);
    }
  };

  // Item management callbacks
  const handleUpdateItem = useCallback(
    (id: string, updated: Partial<GeneratorItemState>) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          const merged = { ...item, ...updated };

          // Recalculate compliance and SEO if title/keywords were updated
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
      return remaining;
    });
  }, []);

  const handleClearAll = useCallback(() => {
    if (queueRef.current) {
      queueRef.current.stop();
      queueRef.current = null;
    }
    setIsGenerating(false);
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
    toast.success('Cleared all items');
  }, []);

  // Pre-export report computation
  const currentReport: PreExportReport = useMemo(() => {
    return buildPreExportReport(items);
  }, [items]);

  // Execute CSV Export (strictly excludes similar, resolution-refused, and hard-blocked items)
  const executeActualCsvExport = useCallback(() => {
    const doneItems = items.filter((i) => {
      if (i.status !== 'done' || i.isExcluded) return false;
      const mp = (i.fileData.width * i.fileData.height) / 1_000_000;
      // Exclude under 4 MP by default
      if (i.fileData.width > 0 && i.fileData.height > 0 && mp < 4.0) return false;
      // Exclude over 100 MP or over 45 MB
      if (mp > 100 || (i.fileData.originalSize || 0) > 45 * 1024 * 1024) return false;
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
          ? 'doctorx_adobe-stock_export.csv'
          : `${settings.platform}_metadata_${dateStr}.csv`;
      downloadBlob(blob, exportFilename);
      toast.success(`Exported ${validItems.length} metadata rows for ${settings.platform}`);
    }

    // Save exported fingerprints to IndexedDB libraryStore to remember them
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



  // Trigger export or show report dialog if hard issues exist
  const handleExportCsv = useCallback(() => {
    if (currentReport.blockedItemsCount > 0) {
      setReportDialogOpen(true);
      toast.error('Cannot export: Fix compliance or resolution issues first.');
      return;
    }
    executeActualCsvExport();
  }, [currentReport.blockedItemsCount, executeActualCsvExport]);

  // Metadata Embedding Engine
  const executeActualMetadataEmbed = useCallback(async () => {
    const doneItems = items.filter((i) => i.status === 'done' && !i.isExcluded);
    const validItems = doneItems.filter(
      (i) => !i.blockedTermsFound?.some((b) => !b.isAmbiguous)
    );

    if (validItems.length === 0) {
      toast.error('No compliant items to embed');
      return;
    }

    // Filter only JPG/JPEG and PNG files
    const compatibleItems = validItems.filter((i) => {
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

      // Save exported fingerprints to IndexedDB libraryStore
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

        if (!res.ok) {
          throw new Error('Failed to retitle image');
        }

        const data = await res.json();
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
    [items, settings, handleUpdateItem]
  );

  // Fix all flagged similar titles & rewrite repetitive title openings (>3 in batch)
  const handleFixSimilarTitles = useCallback(async () => {
    // 1. Identify repetitive first words (> 3 titles)
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
      toast.success(`Rewrote opening words for ${openingFixedCount} titles`);
    }

    // 2. Also rewrite any remaining flagged pairwise similar titles via AI
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

          if (res.ok) {
            const data = await res.json();
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
  }, [items, settings, handleUpdateItem]);

  // Approve ambiguous term (e.g. apple fruit, amazon rainforest)
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
          return {
            ...item,
            approvedIssues: approved,
            blockedTermsFound: comp.blockedTerms,
            seoScore: seo.score,
            seoChecklist: seo.checklist,
          };
        })
      );
      toast.success(`Approved "${term}" for this session.`);
    },
    [settings]
  );

  // Step 8 Similarity Cluster Winner and Override Actions
  const handleSetClusterWinner = useCallback(
    (cluster: SimilarityCluster, newWinnerId: string) => {
      setItems((prev) => {
        const winnerItem = prev.find((it) => it.id === newWinnerId);
        const winnerName = winnerItem?.fileData.originalName || 'chosen winner';

        return prev.map((it) => {
          if (!cluster.itemIds.includes(it.id)) return it;
          if (it.id === newWinnerId) {
            return {
              ...it,
              isExcluded: false,
              isKeptBest: true,
              excludedReason: undefined,
            };
          } else {
            return {
              ...it,
              isExcluded: true,
              isKeptBest: false,
              excludedReason: `Similar to ${winnerName}`,
            };
          }
        });
      });

      setSimilarityClusters((prev) =>
        prev.map((c) => (c.clusterId === cluster.clusterId ? { ...c, winnerId: newWinnerId } : c))
      );
      toast.success('Updated cluster: new primary image kept.');
    },
    []
  );

  // Queue Generation Engine
  const startQueue = useCallback((customItems?: GeneratorItemState[]) => {
    const targetItems = customItems || items;
    if (targetItems.length === 0) return;

    if (queueRef.current) {
      queueRef.current.stop();
      queueRef.current = null;
    }

    setIsGenerating(true);

    const queue = new GeneratorQueue(targetItems, settings, {
      onItemUpdate: (updatedItem) => {
        setItems((prev) =>
          prev.map((it) => (it.id === updatedItem.id ? updatedItem : it))
        );
      },
      onProgress: () => {
        // Handled via item statuses
      },
      onComplete: () => {
        setIsGenerating(false);
        queueRef.current = null;
        toast.success('Generation complete!');

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
    queue.start();
  }, [items, settings, handleExportCsv, handleEmbedMetadata]);

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
              isKeptBest: true,
              excludedReason: undefined,
              status: 'queued' as const,
              errorMessage: undefined,
            };
          } else {
            return {
              ...it,
              isExcluded: true,
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
                isKeptBest: true,
                excludedReason: undefined,
                status: 'queued' as const,
                errorMessage: undefined,
              }
            : it
        );
      }

      setItems(updatedItems);
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
              excludedReason: 'manual_override',
              status: 'queued' as const,
              errorMessage: undefined,
            }
          : it
      );
      setItems(updatedItems);
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
          excludedReason: 'manual_override',
          status: 'queued' as const,
          errorMessage: undefined,
        };
      }
      return it;
    });
    setItems(updated);
    toast.success('Included all previously exported files in this batch. Starting generation...');
    startQueue(updated);
  }, [items, startQueue]);

  const handleClearLibraryBatch = useCallback(async () => {
    await clearLibraryStore();
    toast.success('Exported images library cleared');
    runSimilarityCheck(items);
  }, [items, runSimilarityCheck]);

  // Smooth scroll to card
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
      startQueue(updated);
    },
    [items, startQueue]
  );

  const handleGenerateAll = () => {
    startQueue();
  };

  const handleStop = () => {
    if (queueRef.current) {
      queueRef.current.stop();
      queueRef.current = null;
    }
    setIsGenerating(false);
    toast.info('Generation stopped');
  };

  // Counts & status
  const doneCount = items.filter(
    (i) => i.status === 'done' && Boolean(i.title?.trim()) && i.title.trim() !== i.fileData.originalName
  ).length;
  const failedCount = items.filter((i) => i.status === 'failed').length;
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

  const totalSimilarExcluded = useMemo(() => {
    return items.filter((i) => i.isExcluded).length;
  }, [items]);

  const libraryExcludedCount = useMemo(() => {
    return items.filter((i) => i.isExcluded && i.excludedReason?.startsWith('Already exported')).length;
  }, [items]);

  const generatingCount = useMemo(() => {
    return items.filter((i) => i.status === 'working' || (i.status === 'queued' && !i.isExcluded)).length;
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
            batchMode={settings.batchMode}
            onBatchModeChange={(b) => updateSettings({ batchMode: b })}
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
            maxFiles={200}
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
            isGenerating={isGenerating}
            isAnalyzingSimilarity={isAnalyzingSimilarity}
            hasResults={hasResults}
            mode={settings.mode}
            similarCount={similarTitleCount}
            similarClusterCount={similarityClusters.length}
            similarExcludedCount={totalSimilarExcluded}
            libraryExcludedCount={libraryExcludedCount}
            generatingCount={generatingCount}
            blockedCount={blockedCount}
            onGenerateAll={handleGenerateAll}
            onStop={handleStop}
            onClearAll={handleClearAll}
            onExportCsv={handleExportCsv}
            onEmbedMetadata={handleEmbedMetadata}
            onFixSimilarTitles={handleFixSimilarTitles}
            onReviewClusters={() => setSimilarityDialogOpen(true)}
            onOpenReport={() => setReportDialogOpen(true)}
          />

          <ResultList
            items={items}
            mode={settings.mode}
            platformSpec={currentSpec}
            showSimilarityScores={settings.showSimilarityScores}
            alreadyExportedCount={libraryExcludedCount}
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
    </div>
  );
}
