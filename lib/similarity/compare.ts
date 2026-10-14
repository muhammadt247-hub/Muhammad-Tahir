import {
  SIMILARITY_WEIGHTS,
  SIMILARITY_THRESHOLDS,
  BORDERLINE_BAND,
  SimilarityStrictness,
} from '@/config/similarity';
import { ImageFingerprint, PairwiseSimilarityScore } from '@/types/similarity';

/**
 * Hamming distance between two binary strings of equal length (typically 64)
 */
export function hammingDistance(a: string, b: string): number {
  let dist = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) dist++;
  }
  return dist + Math.abs(a.length - b.length);
}

/**
 * Normalized similarity from Hamming distance [0, 1]
 */
function hashSimilarity(dist: number, bitLength = 64): number {
  return Math.max(0, 1 - dist / bitLength);
}

/**
 * Color histogram intersection (both normalized to 1.0)
 * Yields value in [0, 1]
 */
function computeColorCorrelation(histA: number[], histB: number[]): number {
  let intersection = 0;
  const len = Math.min(histA.length, histB.length);
  for (let i = 0; i < len; i++) {
    intersection += Math.min(histA[i], histB[i]);
  }
  return Math.max(0, Math.min(1, intersection));
}

/**
 * SSIM (Structural Similarity Index) on 32x32 grayscale thumbnails
 */
function computeSsim(thumbA: number[], thumbB: number[]): number {
  const N = thumbA.length;
  if (N === 0 || N !== thumbB.length) return 0;

  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < N; i++) {
    sumA += thumbA[i];
    sumB += thumbB[i];
  }
  const meanA = sumA / N;
  const meanB = sumB / N;

  let varA = 0;
  let varB = 0;
  let covAB = 0;
  for (let i = 0; i < N; i++) {
    const diffA = thumbA[i] - meanA;
    const diffB = thumbB[i] - meanB;
    varA += diffA * diffA;
    varB += diffB * diffB;
    covAB += diffA * diffB;
  }
  varA /= N - 1 || 1;
  varB /= N - 1 || 1;
  covAB /= N - 1 || 1;

  // Constants to stabilize division with weak denominator
  const L = 255;
  const c1 = (0.01 * L) * (0.01 * L);
  const c2 = (0.03 * L) * (0.03 * L);

  const numerator = (2 * meanA * meanB + c1) * (2 * covAB + c2);
  const denominator = (meanA * meanA + meanB * meanB + c1) * (varA + varB + c2);

  const rawSsim = denominator !== 0 ? numerator / denominator : 0;
  return Math.max(0, Math.min(1, rawSsim));
}

/**
 * Evaluates pairwise similarity between two fingerprints
 */
export function compareFingerprints(
  fpA: ImageFingerprint,
  fpB: ImageFingerprint,
  strictness: SimilarityStrictness,
  otherId: string,
  otherFilename: string,
  isLibraryMatch = false
): PairwiseSimilarityScore {
  if (strictness === 'off') {
    return {
      otherId,
      otherFilename,
      isLibraryMatch,
      totalSimilarity: 0,
      pHashSim: 0,
      dHashSim: 0,
      regionSim: 0,
      colorSim: 0,
      ssim: 0,
      isBorderline: false,
      isSimilar: false,
    };
  }

  // 1. pHash similarity (direct and mirrored)
  const distPDirect = hammingDistance(fpA.pHash, fpB.pHash);
  const distPMirror1 = hammingDistance(fpA.pHashMirror, fpB.pHash);
  const distPMirror2 = hammingDistance(fpA.pHash, fpB.pHashMirror);
  const minDistP = Math.min(distPDirect, distPMirror1, distPMirror2);
  const pHashSim = hashSimilarity(minDistP, 64);

  // 2. dHash similarity (direct and mirrored)
  const distDDirect = hammingDistance(fpA.dHash, fpB.dHash);
  const distDMirror1 = hammingDistance(fpA.dHashMirror, fpB.dHash);
  const distDMirror2 = hammingDistance(fpA.dHash, fpB.dHashMirror);
  const minDistD = Math.min(distDDirect, distDMirror1, distDMirror2);
  const dHashSim = hashSimilarity(minDistD, 64);

  // 3. 3x3 Region Hash match
  let directRegionSimSum = 0;
  let mirrorRegionSimSum = 0;
  let maxSingleTileMatch = 0;

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const idxA = r * 3 + c;
      const idxBDirect = r * 3 + c;
      const idxBMirror = r * 3 + (2 - c); // Horizontally mirrored tile

      const hashA = fpA.regionHashes[idxA] || '';
      const hashBDirect = fpB.regionHashes[idxBDirect] || '';
      const hashBMirror = fpB.regionHashes[idxBMirror] || '';

      const simDir = hashSimilarity(hammingDistance(hashA, hashBDirect), 64);
      const simMir = hashSimilarity(hammingDistance(hashA, hashBMirror), 64);

      directRegionSimSum += simDir;
      mirrorRegionSimSum += simMir;
      maxSingleTileMatch = Math.max(maxSingleTileMatch, simDir, simMir);
    }
  }

  const avgRegionSim = Math.max(directRegionSimSum / 9, mirrorRegionSimSum / 9);
  // Blend average region match with high single-tile matches (crop/zoom indicator)
  const regionSim = 0.8 * avgRegionSim + 0.2 * maxSingleTileMatch;

  // 4. Color histogram correlation
  const colorSim = computeColorCorrelation(fpA.colorHistogram, fpB.colorHistogram);

  // 5. SSIM on 32x32 thumbnails (normal and mirrored)
  const ssimDirect = computeSsim(fpA.thumbnail32, fpB.thumbnail32);

  // Mirrored thumbnail B
  const mirroredThumbB: number[] = new Array(1024);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      mirroredThumbB[y * 32 + x] = fpB.thumbnail32[y * 32 + (31 - x)];
    }
  }
  const ssimMirror = computeSsim(fpA.thumbnail32, mirroredThumbB);
  const ssim = Math.max(ssimDirect, ssimMirror);

  // Weighted total score
  const totalSimilarity =
    SIMILARITY_WEIGHTS.pHash * pHashSim +
    SIMILARITY_WEIGHTS.dHash * dHashSim +
    SIMILARITY_WEIGHTS.regionHash * regionSim +
    SIMILARITY_WEIGHTS.colorHist * colorSim +
    SIMILARITY_WEIGHTS.ssim * ssim;

  const threshold = SIMILARITY_THRESHOLDS[strictness];
  const borderlineStart = threshold - BORDERLINE_BAND;

  const isSimilar = totalSimilarity >= threshold;
  const isBorderline = !isSimilar && totalSimilarity >= borderlineStart;

  return {
    otherId,
    otherFilename,
    isLibraryMatch,
    totalSimilarity: Math.round(totalSimilarity * 1000) / 1000,
    pHashSim: Math.round(pHashSim * 1000) / 1000,
    dHashSim: Math.round(dHashSim * 1000) / 1000,
    regionSim: Math.round(regionSim * 1000) / 1000,
    colorSim: Math.round(colorSim * 1000) / 1000,
    ssim: Math.round(ssim * 1000) / 1000,
    isBorderline,
    isSimilar,
  };
}
