/**
 * OrbinexaCSV Deep Similarity Guard Configuration
 * Adobe Stock spam prevention & portfolio diversity engine.
 */

export type SimilarityStrictness = 'strict' | 'balanced' | 'relaxed' | 'off';

export interface SimilarityWeights {
  pHash: number;
  dHash: number;
  regionHash: number;
  colorHist: number;
  ssim: number;
}

// Starting values, tune with real data
export const SIMILARITY_WEIGHTS: SimilarityWeights = {
  pHash: 0.30,
  dHash: 0.15,
  regionHash: 0.15,
  colorHist: 0.15,
  ssim: 0.25,
};

// Thresholds for each strictness setting (starting values, tune with real data)
export const SIMILARITY_THRESHOLDS: Record<Exclude<SimilarityStrictness, 'off'>, number> = {
  strict: 0.62,
  balanced: 0.72,
  relaxed: 0.82,
};

// Borderline band: from (threshold minus BORDERLINE_BAND) up to the threshold
export const BORDERLINE_BAND = 0.12;

// Quality weights for winner selection (automatic when AI check is skipped or unavailable)
export const QUALITY_SCORE_WEIGHTS = {
  sharpness: 0.30,      // Laplacian variance (focus)
  exposure: 0.25,       // Well exposed (least clipped highlights/shadows)
  noise: 0.15,          // Lower noise
  resolution: 0.20,     // Total pixel count (megapixels)
  fileSize: 0.10,       // File size in bytes
};

export const SIMILARITY_HONESTY_NOTE =
  "OrbinexaCSV cannot see Adobe's own similarity checks or other contributors' files. This guard greatly reduces the risk but cannot guarantee acceptance.";
