import { GeneratorItemState } from '@/lib/generator/queue';
import { GeneratorSavedSettings, getLibraryEntries } from '@/lib/generator/db';
import { computeImageFingerprint } from './algorithms';
import { compareFingerprints } from './compare';
import {
  ImageFingerprint,
  PairwiseSimilarityScore,
  SimilarityCluster,
  LibraryFingerprintEntry,
} from '@/types/similarity';
import { keyRotator } from '@/lib/generator/key-rotation';

export interface SimilarityProgress {
  step: number; // 1 to 4
  totalSteps: number;
  message: string;
  processedCount: number;
  totalCount: number;
}

export interface SimilarityPipelineResult {
  updatedItems: GeneratorItemState[];
  clusters: SimilarityCluster[];
  libraryExcludedCount: number;
  totalExcludedCount: number;
}

/**
 * Builds a contact sheet canvas image with labeled tiles "A", "B", "C"...
 */
export async function createContactSheet(
  items: Array<{ label: string; dataUrl: string; filename: string }>
): Promise<string> {
  const count = items.length;
  const cols = count <= 2 ? count : count <= 4 ? 2 : 3;
  const rows = Math.ceil(count / cols);

  const tileSize = 512;
  const canvas = document.createElement('canvas');
  canvas.width = cols * tileSize;
  canvas.height = rows * tileSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable for contact sheet');

  // Neutral background
  ctx.fillStyle = '#1e1e1e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * tileSize;
    const y = row * tileSize;

    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = item.dataUrl;
      });

      // Fit image centered within tileSize x tileSize
      const hRatio = tileSize / img.width;
      const vRatio = tileSize / img.height;
      const ratio = Math.min(hRatio, vRatio);
      const centerShiftX = (tileSize - img.width * ratio) / 2;
      const centerShiftY = (tileSize - img.height * ratio) / 2;

      ctx.drawImage(
        img,
        0,
        0,
        img.width,
        img.height,
        x + centerShiftX,
        y + centerShiftY,
        img.width * ratio,
        img.height * ratio
      );

      // Draw high-visibility label badge in top-left
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.beginPath();
      ctx.roundRect(x + 12, y + 12, 64, 64, 12);
      ctx.fill();

      // Border in dark orange (#D9560B)
      ctx.strokeStyle = '#D9560B';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.label, x + 44, y + 44);

      // Filename label badge at bottom
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(x, y + tileSize - 32, tileSize, 32);
      ctx.fillStyle = '#E5E5E5';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const cleanName = item.filename.length > 35 ? item.filename.slice(0, 32) + '...' : item.filename;
      ctx.fillText(` ${item.label}: ${cleanName}`, x + 8, y + tileSize - 16);
    } catch (e) {
      console.error(`Failed to draw item ${item.label} on contact sheet:`, e);
    }
  }

  return canvas.toDataURL('image/jpeg', 0.85);
}

/**
 * Union-Find Disjoint Set for connected components
 */
class DisjointSet {
  private parent: Map<string, string> = new Map();

  find(i: string): string {
    if (!this.parent.has(i)) this.parent.set(i, i);
    const root = this.parent.get(i)!;
    if (root === i) return i;
    const rep = this.find(root);
    this.parent.set(i, rep);
    return rep;
  }

  union(i: string, j: string) {
    const rootI = this.find(i);
    const rootJ = this.find(j);
    if (rootI !== rootJ) {
      this.parent.set(rootI, rootJ);
    }
  }
}

/**
 * Executes the complete 4-step similarity analysis pipeline
 */
export async function runSimilarityPipeline(
  items: GeneratorItemState[],
  settings: GeneratorSavedSettings,
  onProgress?: (progress: SimilarityProgress) => void,
  shouldCancel?: () => boolean
): Promise<SimilarityPipelineResult> {
  const strictness = settings.similarityStrictness || 'strict';

  if (strictness === 'off' || items.length === 0) {
    // If turned off, reset exclusions related to similarity
    const cleanItems = items.map((it) => {
      if (it.excludedReason?.startsWith('Similar') || it.isKeptBest || it.similarityClusterId || it.similarPairDetails) {
        return {
          ...it,
          isExcluded: false,
          excludedReason: undefined,
          isKeptBest: undefined,
          similarityClusterId: undefined,
          similarPairDetails: undefined,
        };
      }
      return it;
    });
    return {
      updatedItems: cleanItems,
      clusters: [],
      libraryExcludedCount: 0,
      totalExcludedCount: 0,
    };
  }

  if (shouldCancel?.()) {
    return { updatedItems: items, clusters: [], libraryExcludedCount: 0, totalExcludedCount: 0 };
  }

  // --- STEP 1: FINGERPRINTS ---
  const total = items.length;
  const itemsWithFingerprints: GeneratorItemState[] = [...items];
  const fingerprintMap = new Map<string, ImageFingerprint>();

  for (let i = 0; i < total; i++) {
    if (shouldCancel?.()) {
      return { updatedItems: items, clusters: [], libraryExcludedCount: 0, totalExcludedCount: 0 };
    }

    const it = itemsWithFingerprints[i];
    if (onProgress) {
      onProgress({
        step: 1,
        totalSteps: 4,
        message: 'Computing image fingerprints & quality metrics...',
        processedCount: i + 1,
        totalCount: total,
      });
    }

    if (it.needsPreview || !it.fileData.aiDataUrl) {
      continue;
    }

    if (it.fingerprint) {
      fingerprintMap.set(it.id, it.fingerprint);
      continue;
    }

    try {
      const fp = await computeImageFingerprint(
        it.fileData.aiDataUrl,
        it.fileData.width || 1024,
        it.fileData.height || 1024,
        it.fileData.originalSize || 500000
      );
      fingerprintMap.set(it.id, fp);
      itemsWithFingerprints[i] = { ...it, fingerprint: fp };
    } catch (err) {
      console.error(`Failed to fingerprint ${it.fileData.originalName}:`, err);
    }

    // Cooperative yield
    if (i % 5 === 0) await new Promise((r) => setTimeout(r, 0));
  }

  if (shouldCancel?.()) {
    return { updatedItems: items, clusters: [], libraryExcludedCount: 0, totalExcludedCount: 0 };
  }

  // Fetch saved library entries (if Remember My Exported Images is enabled)
  let libraryEntries: LibraryFingerprintEntry[] = [];
  if (settings.rememberExportedImages) {
    libraryEntries = await getLibraryEntries();
  }

  if (shouldCancel?.()) {
    return { updatedItems: items, clusters: [], libraryExcludedCount: 0, totalExcludedCount: 0 };
  }

  // --- STEP 2: PAIRWISE SIMILARITY ---
  const pairScores: Map<string, PairwiseSimilarityScore[]> = new Map();
  const confirmedSimilarEdges: Array<[string, string, PairwiseSimilarityScore]> = [];
  const borderlineCandidatePairs: Array<[string, string, PairwiseSimilarityScore]> = [];
  const libraryMatches: Map<string, PairwiseSimilarityScore> = new Map();

  let pairCounter = 0;
  const totalPairs = (total * (total - 1)) / 2 + total * libraryEntries.length;

  for (let i = 0; i < total; i++) {
    if (shouldCancel?.()) {
      return { updatedItems: items, clusters: [], libraryExcludedCount: 0, totalExcludedCount: 0 };
    }

    const itemA = itemsWithFingerprints[i];
    const fpA = fingerprintMap.get(itemA.id);
    if (!fpA) continue;

    // Check against library first
    for (const libEntry of libraryEntries) {
      if (shouldCancel?.()) {
        return { updatedItems: items, clusters: [], libraryExcludedCount: 0, totalExcludedCount: 0 };
      }

      // Never compare a file with itself
      if (itemA.id === libEntry.id) continue;

      const isSameFilename =
        itemA.fileData.originalName.toLowerCase().trim() ===
        libEntry.filename.toLowerCase().trim();

      pairCounter++;
      const score = compareFingerprints(
        fpA,
        libEntry.fingerprint,
        strictness,
        libEntry.id,
        libEntry.filename,
        true
      );
      if (score.isSimilar && isSameFilename) {
        const dateStr = libEntry.exportedAt
          ? new Date(libEntry.exportedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : new Date().toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
        score.exportedAtDate = dateStr;
        libraryMatches.set(itemA.id, score);
      }
    }

    // Check against other batch items (j > i)
    for (let j = i + 1; j < total; j++) {
      if (shouldCancel?.()) {
        return { updatedItems: items, clusters: [], libraryExcludedCount: 0, totalExcludedCount: 0 };
      }

      pairCounter++;
      const itemB = itemsWithFingerprints[j];
      // Never compare a file with itself (by id or filename)
      if (
        itemA.id === itemB.id ||
        itemA.fileData.originalName.toLowerCase().trim() ===
          itemB.fileData.originalName.toLowerCase().trim()
      ) {
        continue;
      }
      const fpB = fingerprintMap.get(itemB.id);
      if (!fpB) continue;

      const score = compareFingerprints(
        fpA,
        fpB,
        strictness,
        itemB.id,
        itemB.fileData.originalName,
        false
      );

      // Record pairwise details for debugging/inspection
      if (!pairScores.has(itemA.id)) pairScores.set(itemA.id, []);
      if (!pairScores.has(itemB.id)) pairScores.set(itemB.id, []);

      pairScores.get(itemA.id)!.push(score);
      pairScores.get(itemB.id)!.push({
        ...score,
        otherId: itemA.id,
        otherFilename: itemA.fileData.originalName,
      });

      if (score.isSimilar) {
        confirmedSimilarEdges.push([itemA.id, itemB.id, score]);
      } else if (score.isBorderline) {
        borderlineCandidatePairs.push([itemA.id, itemB.id, score]);
      }

      if (pairCounter % 150 === 0) {
        if (shouldCancel?.()) {
          return { updatedItems: items, clusters: [], libraryExcludedCount: 0, totalExcludedCount: 0 };
        }
        if (onProgress) {
          onProgress({
            step: 2,
            totalSteps: 4,
            message: 'Analyzing pairwise similarity...',
            processedCount: Math.min(pairCounter, totalPairs),
            totalCount: totalPairs,
          });
        }
        await new Promise((r) => setTimeout(r, 0));
      }
    }
  }

  if (shouldCancel?.()) {
    return { updatedItems: items, clusters: [], libraryExcludedCount: 0, totalExcludedCount: 0 };
  }

  // --- STEP 3: DEEP AI CHECK FOR BORDERLINE PAIRS ---
  const aiClusterDecisions: Map<string, { winnerId: string; reason: string }> = new Map();

  if (settings.deepAiCheck && borderlineCandidatePairs.length > 0) {
    if (onProgress) {
      onProgress({
        step: 3,
        totalSteps: 4,
        message: `Deep AI Review: Checking ${borderlineCandidatePairs.length} borderline pair(s)...`,
        processedCount: 0,
        totalCount: borderlineCandidatePairs.length,
      });
    }

    // Group unique borderline items into contact sheets of up to 6 images
    const borderlineItemIds = new Set<string>();
    borderlineCandidatePairs.forEach(([a, b]) => {
      borderlineItemIds.add(a);
      borderlineItemIds.add(b);
    });

    const borderlineList = Array.from(borderlineItemIds)
      .map((id) => itemsWithFingerprints.find((it) => it.id === id))
      .filter(Boolean) as GeneratorItemState[];

    const chunkSize = 6;
    for (let c = 0; c < borderlineList.length; c += chunkSize) {
      if (shouldCancel?.()) {
        return { updatedItems: items, clusters: [], libraryExcludedCount: 0, totalExcludedCount: 0 };
      }

      const clusterSlice = borderlineList.slice(c, c + chunkSize);
      if (clusterSlice.length < 2) continue;

      const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
      const sheetItems = clusterSlice.map((it, idx) => ({
        label: labels[idx],
        dataUrl: it.fileData.aiDataUrl,
        filename: it.fileData.originalName,
      }));

      try {
        if (shouldCancel?.()) {
          return { updatedItems: items, clusters: [], libraryExcludedCount: 0, totalExcludedCount: 0 };
        }

        const contactSheetUrl = await createContactSheet(sheetItems);
        const keyInfo = await keyRotator.getNextKey();

        if (shouldCancel?.()) {
          return { updatedItems: items, clusters: [], libraryExcludedCount: 0, totalExcludedCount: 0 };
        }

        const res = await fetch('/api/similarity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contactSheet: contactSheetUrl,
            items: clusterSlice.map((it, idx) => ({
              label: labels[idx],
              id: it.id,
              filename: it.fileData.originalName,
              qualityScore: it.fingerprint?.quality.overallQualityScore,
            })),
            model: settings.selectedModel,
            apiKey: keyInfo?.apiKey,
          }),
        });

        if (shouldCancel?.()) {
          return { updatedItems: items, clusters: [], libraryExcludedCount: 0, totalExcludedCount: 0 };
        }

        if (res.ok) {
          const aiData = await res.json();
          const clusters = aiData.clusters || [];
          for (const cl of clusters) {
            const memberIds = cl.itemIds as string[];
            if (memberIds.length >= 2) {
              // Add confirmed edge between all pairs in the AI cluster
              for (let m = 0; m < memberIds.length; m++) {
                for (let n = m + 1; n < memberIds.length; n++) {
                  confirmedSimilarEdges.push([
                    memberIds[m],
                    memberIds[n],
                    {
                      otherId: memberIds[n],
                      otherFilename: '',
                      totalSimilarity: 0.85,
                      pHashSim: 0.85,
                      dHashSim: 0.85,
                      regionSim: 0.85,
                      colorSim: 0.85,
                      ssim: 0.85,
                      isBorderline: false,
                      isSimilar: true,
                    },
                  ]);
                }
              }

              const clusterKey = memberIds.sort().join(':');
              aiClusterDecisions.set(clusterKey, {
                winnerId: cl.winnerId,
                reason: cl.reason || 'Selected as superior commercial asset by AI reviewer.',
              });
            }
          }
        }
      } catch (err) {
        console.error('Deep AI check failed for cluster slice:', err);
      }

      await new Promise((r) => setTimeout(r, 100));
    }
  } else if (!settings.deepAiCheck && borderlineCandidatePairs.length > 0) {
    // When Deep AI check is OFF:
    // Under Strict: treat borderline as similar
    // Under Relaxed and Balanced: treat as NOT similar
    if (strictness === 'strict') {
      for (const [a, b, score] of borderlineCandidatePairs) {
        confirmedSimilarEdges.push([a, b, { ...score, isSimilar: true }]);
      }
    }
  }

  if (shouldCancel?.()) {
    return { updatedItems: items, clusters: [], libraryExcludedCount: 0, totalExcludedCount: 0 };
  }

  // --- STEP 4: CLUSTERING & WINNER SELECTION ---
  if (onProgress) {
    onProgress({
      step: 4,
      totalSteps: 4,
      message: 'Grouping clusters and selecting best images...',
      processedCount: total,
      totalCount: total,
    });
  }

  const ds = new DisjointSet();
  itemsWithFingerprints.forEach((it) => ds.find(it.id));

  // Union connected similar edges
  for (const [idA, idB] of confirmedSimilarEdges) {
    ds.union(idA, idB);
  }

  // Group into clusters
  const clusterMap = new Map<string, string[]>();
  for (const it of itemsWithFingerprints) {
    const root = ds.find(it.id);
    if (!clusterMap.has(root)) clusterMap.set(root, []);
    clusterMap.get(root)!.push(it.id);
  }

  const multiClusters: SimilarityCluster[] = [];
  const itemWinnerMap = new Map<string, { isWinner: boolean; winnerItem: GeneratorItemState; reason: string }>();

  let clusterIndex = 1;
  for (const [, itemIds] of clusterMap.entries()) {
    if (itemIds.length < 2) continue; // Singletons are not clusters

    const clusterItems = itemIds
      .map((id) => itemsWithFingerprints.find((it) => it.id === id))
      .filter(Boolean) as GeneratorItemState[];

    // Determine winner
    let winner: GeneratorItemState = clusterItems[0];
    let winnerReason = '';
    let aiExplanation: string | undefined;

    // Check if AI provided a decision for this cluster or subset
    const sortedKey = [...itemIds].sort().join(':');
    if (aiClusterDecisions.has(sortedKey)) {
      const decision = aiClusterDecisions.get(sortedKey)!;
      winner = clusterItems.find((it) => it.id === decision.winnerId) || clusterItems[0];
      winnerReason = decision.reason;
      aiExplanation = decision.reason;
    } else {
      // Pick best by quality metrics:
      // Compare overallQualityScore (sharpness, exposure, noise, resolution, file size)
      let bestScore = -1;
      for (const it of clusterItems) {
        const q = it.fingerprint?.quality;
        const qScore = q?.overallQualityScore ?? 0;
        if (qScore > bestScore) {
          bestScore = qScore;
          winner = it;
        }
      }

      const q = winner.fingerprint?.quality;
      winnerReason = `Higher resolution (${q?.width || 0}x${q?.height || 0}) and superior focus sharpness.`;
    }

    const clusterId = `cluster-${clusterIndex++}`;
    multiClusters.push({
      clusterId,
      itemIds,
      winnerId: winner.id,
      winnerReason,
      pairs: pairScores.get(winner.id) || [],
      aiReviewed: Boolean(aiExplanation),
      aiExplanation,
    });

    for (const it of clusterItems) {
      itemWinnerMap.set(it.id, {
        isWinner: it.id === winner.id,
        winnerItem: winner,
        reason: winnerReason,
      });
    }
  }

  // Construct final updated items
  let libraryExcludedCount = 0;
  let totalExcludedCount = 0;

  const finalItems: GeneratorItemState[] = itemsWithFingerprints.map((item) => {
    const libMatch = libraryMatches.get(item.id);
    const clusterDecision = itemWinnerMap.get(item.id);
    const pairs = pairScores.get(item.id) || [];

    // Check if user has explicitly overridden exclusion previously
    const wasUserManuallyIncluded = Boolean(item.manualInclude) || (item.isExcluded === false && item.excludedReason === 'manual_override');

    if (wasUserManuallyIncluded) {
      return {
        ...item,
        isExcluded: false,
        excludedReason: undefined,
        manualInclude: true,
        similarPairDetails: pairs,
      };
    }

    // 1. Library match takes absolute priority (avoid duplicate of already exported asset)
    if (libMatch) {
      libraryExcludedCount++;
      totalExcludedCount++;
      const dateLabel = libMatch.exportedAtDate || 'previous session';
      return {
        ...item,
        isExcluded: true,
        excludedReason: `Already exported on ${dateLabel}`,
        isKeptBest: false,
        similarPairDetails: [],
      };
    }

    // 2. Batch cluster exclusion
    if (clusterDecision) {
      if (clusterDecision.isWinner) {
        return {
          ...item,
          isExcluded: false,
          isKeptBest: true,
          excludedReason: undefined,
          aiReviewReason: clusterDecision.reason,
          similarPairDetails: pairs,
        };
      } else {
        totalExcludedCount++;
        return {
          ...item,
          isExcluded: true,
          isKeptBest: false,
          excludedReason: `Similar to ${clusterDecision.winnerItem.fileData.originalName}`,
          aiReviewReason: clusterDecision.reason,
          similarPairDetails: pairs,
        };
      }
    }

    // 3. Unique image
    return {
      ...item,
      isExcluded: false,
      isKeptBest: false,
      excludedReason: undefined,
      similarPairDetails: pairs,
    };
  });

  return {
    updatedItems: finalItems,
    clusters: multiClusters,
    libraryExcludedCount,
    totalExcludedCount,
  };
}
