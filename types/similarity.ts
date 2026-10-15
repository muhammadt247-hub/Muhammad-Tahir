import { SimilarityStrictness } from '@/config/similarity';

export interface QualityMetrics {
  sharpness: number;      // Variance of Laplacian
  clippedShadows: number; // Ratio [0, 1] of dark clipped pixels (< 5)
  clippedHighlights: number; // Ratio [0, 1] of light clipped pixels (> 250)
  exposureScore: number;  // 1 - (clippedShadows + clippedHighlights)
  noiseEstimate: number;  // Standard deviation of high-frequency noise
  width: number;
  height: number;
  fileSizeBytes: number;
  overallQualityScore: number; // Normalized [0, 1] score
}

export interface ImageFingerprint {
  pHash: string;          // 64-bit binary string (e.g. "10101...")
  pHashMirror: string;    // Mirrored 64-bit binary
  dHash: string;          // 64-bit binary string
  dHashMirror: string;    // Mirrored 64-bit binary
  regionHashes: string[]; // 9 64-bit dHashes (3x3 grid)
  colorHistogram: number[]; // 128 normalized bins (8 H x 4 S x 4 V)
  thumbnail32: number[];  // 32x32 grayscale pixel values [0-255] (1024 numbers)
  quality: QualityMetrics;
}

export interface PairwiseSimilarityScore {
  otherId: string;
  otherFilename: string;
  isLibraryMatch?: boolean;
  exportedAtDate?: string;
  totalSimilarity: number;
  pHashSim: number;
  dHashSim: number;
  regionSim: number;
  colorSim: number;
  ssim: number;
  isBorderline: boolean;
  isSimilar: boolean;
}

export interface SimilarityCluster {
  clusterId: string;
  itemIds: string[];
  winnerId: string;
  winnerReason: string;
  pairs: PairwiseSimilarityScore[];
  aiReviewed?: boolean;
  aiExplanation?: string;
}

export interface LibraryFingerprintEntry {
  id: string;
  filename: string;
  exportedAt: number;
  thumbnail32: number[];
  fingerprint: ImageFingerprint;
}
