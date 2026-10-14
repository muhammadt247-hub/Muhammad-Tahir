import { ImageFingerprint, QualityMetrics } from '@/types/similarity';

/**
 * Loads an image Data URL into an HTMLImageElement
 */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image for fingerprinting'));
    img.src = dataUrl;
  });
}

/**
 * 2D Discrete Cosine Transform (DCT) for 32x32 matrix, extracting 8x8 low frequencies
 */
function computeDct64(matrix32: number[][]): string {
  const N = 32;
  const coefficients: number[] = [];

  // Compute DCT for u=0..7, v=0..7
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      let sum = 0;
      for (let x = 0; x < N; x++) {
        for (let y = 0; y < N; y++) {
          sum +=
            matrix32[x][y] *
            Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N)) *
            Math.cos(((2 * y + 1) * v * Math.PI) / (2 * N));
        }
      }
      const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
      const cv = v === 0 ? 1 / Math.sqrt(2) : 1;
      coefficients.push((1 / Math.sqrt(2 * N)) * cu * cv * sum);
    }
  }

  // Skip DC component (u=0, v=0) when computing median
  const acTerms = coefficients.slice(1);
  const sorted = [...acTerms].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 0;

  // Convert to 64-bit binary string
  let hashBits = '';
  for (let i = 0; i < 64; i++) {
    hashBits += coefficients[i] > median ? '1' : '0';
  }
  return hashBits;
}

/**
 * Computes 64-bit dHash (difference hash) from a canvas context
 */
function getDHashFromCanvas(ctx: CanvasRenderingContext2D, width: number, height: number): string {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // 9 width x 8 height difference
  const grays: number[][] = [];
  for (let y = 0; y < 8; y++) {
    grays[y] = [];
    for (let x = 0; x < 9; x++) {
      const idx = (y * 9 + x) * 4;
      const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      grays[y][x] = gray;
    }
  }

  let hash = '';
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      hash += grays[y][x] > grays[y][x + 1] ? '1' : '0';
    }
  }
  return hash;
}

/**
 * Computes normalized HSV color histogram (128 bins: 8 Hue x 4 Saturation x 4 Value)
 */
function computeHsvHistogram(ctx: CanvasRenderingContext2D, width: number, height: number): number[] {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const bins = new Array(128).fill(0);
  const totalPixels = width * height;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    // Hue [0, 360)
    let h = 0;
    if (delta !== 0) {
      if (max === r) h = ((g - b) / delta) % 6;
      else if (max === g) h = (b - r) / delta + 2;
      else h = (r - g) / delta + 4;
      h = Math.round(h * 60);
      if (h < 0) h += 360;
    }

    // Saturation [0, 1]
    const s = max === 0 ? 0 : delta / max;
    // Value [0, 1]
    const v = max;

    const hBin = Math.min(7, Math.floor(h / 45));
    const sBin = Math.min(3, Math.floor(s * 4));
    const vBin = Math.min(3, Math.floor(v * 4));

    const binIndex = hBin * 16 + sBin * 4 + vBin;
    bins[binIndex]++;
  }

  // Normalize so sum is 1.0
  return bins.map((count) => count / (totalPixels || 1));
}

/**
 * Quality metrics:
 * - Sharpness: Variance of Laplacian
 * - Clipped shadows (<5) and highlights (>250)
 * - Noise estimation
 */
function computeQualityMetrics(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  origWidth: number,
  origHeight: number,
  fileSizeBytes: number
): QualityMetrics {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const totalPixels = width * height;

  let shadowCount = 0;
  let highlightCount = 0;
  const grays = new Float32Array(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    grays[i] = gray;

    if (gray < 5) shadowCount++;
    if (gray > 250) highlightCount++;
  }

  const clippedShadows = shadowCount / totalPixels;
  const clippedHighlights = highlightCount / totalPixels;
  const exposureScore = Math.max(0, 1 - (clippedShadows + clippedHighlights) * 2);

  // Discrete Laplacian for sharpness (stride 1)
  let laplacianSum = 0;
  let laplacianSqSum = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const c = grays[y * width + x];
      const top = grays[(y - 1) * width + x];
      const bottom = grays[(y + 1) * width + x];
      const left = grays[y * width + (x - 1)];
      const right = grays[y * width + (x + 1)];

      const lap = top + bottom + left + right - 4 * c;
      laplacianSum += lap;
      laplacianSqSum += lap * lap;
      count++;
    }
  }

  const meanLap = count > 0 ? laplacianSum / count : 0;
  const varianceLap = count > 0 ? Math.max(0, laplacianSqSum / count - meanLap * meanLap) : 0;
  const sharpness = varianceLap;

  // Noise estimate: high-frequency variance normalized
  const noiseEstimate = Math.sqrt(varianceLap) / (meanLap + 10);

  // Overall normalized quality score [0, 1]
  const resolutionMegapixels = (origWidth * origHeight) / 1000000;
  const normRes = Math.min(1, resolutionMegapixels / 24); // 24MP baseline
  const normSharp = Math.min(1, Math.log10(sharpness + 1) / 3.5);
  const normExposure = exposureScore;
  const normSize = Math.min(1, fileSizeBytes / (10 * 1024 * 1024)); // 10MB baseline

  const overallQualityScore = Math.min(
    1,
    Math.max(
      0,
      0.35 * normSharp + 0.25 * normExposure + 0.2 * normRes + 0.1 * normSize + 0.1 * Math.max(0, 1 - noiseEstimate * 0.1)
    )
  );

  return {
    sharpness: Math.round(sharpness * 10) / 10,
    clippedShadows: Math.round(clippedShadows * 1000) / 1000,
    clippedHighlights: Math.round(clippedHighlights * 1000) / 1000,
    exposureScore: Math.round(exposureScore * 100) / 100,
    noiseEstimate: Math.round(noiseEstimate * 100) / 100,
    width: origWidth,
    height: origHeight,
    fileSizeBytes,
    overallQualityScore: Math.round(overallQualityScore * 100) / 100,
  };
}

/**
 * Main fingerprint generator for an image
 */
export async function computeImageFingerprint(
  aiDataUrl: string,
  origWidth: number,
  origHeight: number,
  fileSizeBytes: number
): Promise<ImageFingerprint> {
  const img = await loadImage(aiDataUrl);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // 1. Grayscale 32x32 for DCT pHash & SSIM thumbnail
  canvas.width = 32;
  canvas.height = 32;
  ctx.drawImage(img, 0, 0, 32, 32);
  const data32 = ctx.getImageData(0, 0, 32, 32).data;
  const matrix32: number[][] = [];
  const thumbnail32: number[] = [];

  for (let y = 0; y < 32; y++) {
    matrix32[y] = [];
    for (let x = 0; x < 32; x++) {
      const idx = (y * 32 + x) * 4;
      const g = Math.round(0.299 * data32[idx] + 0.587 * data32[idx + 1] + 0.114 * data32[idx + 2]);
      matrix32[y][x] = g;
      thumbnail32.push(g);
    }
  }

  const pHash = computeDct64(matrix32);

  // Mirror 32x32 for mirrored pHash
  ctx.save();
  ctx.scale(-1, 1);
  ctx.drawImage(img, -32, 0, 32, 32);
  ctx.restore();
  const mirrorData32 = ctx.getImageData(0, 0, 32, 32).data;
  const mirrorMatrix32: number[][] = [];
  for (let y = 0; y < 32; y++) {
    mirrorMatrix32[y] = [];
    for (let x = 0; x < 32; x++) {
      const idx = (y * 32 + x) * 4;
      mirrorMatrix32[y][x] = Math.round(
        0.299 * mirrorData32[idx] + 0.587 * mirrorData32[idx + 1] + 0.114 * mirrorData32[idx + 2]
      );
    }
  }
  const pHashMirror = computeDct64(mirrorMatrix32);

  // 2. 64-bit dHash (9x8) & Mirror dHash
  canvas.width = 9;
  canvas.height = 8;
  ctx.drawImage(img, 0, 0, 9, 8);
  const dHash = getDHashFromCanvas(ctx, 9, 8);

  ctx.save();
  ctx.scale(-1, 1);
  ctx.drawImage(img, -9, 0, 9, 8);
  ctx.restore();
  const dHashMirror = getDHashFromCanvas(ctx, 9, 8);

  // 3. 3x3 Region dHashes (9 regions)
  const regionHashes: string[] = [];
  const tileW = Math.floor(img.width / 3) || 1;
  const tileH = Math.floor(img.height / 3) || 1;

  for (let ry = 0; ry < 3; ry++) {
    for (let rx = 0; rx < 3; rx++) {
      canvas.width = 9;
      canvas.height = 8;
      ctx.drawImage(img, rx * tileW, ry * tileH, tileW, tileH, 0, 0, 9, 8);
      regionHashes.push(getDHashFromCanvas(ctx, 9, 8));
    }
  }

  // 4. Color HSV Histogram (computed on 64x64 scaled image for speed & robustness)
  canvas.width = 64;
  canvas.height = 64;
  ctx.drawImage(img, 0, 0, 64, 64);
  const colorHistogram = computeHsvHistogram(ctx, 64, 64);

  // 5. Quality metrics on 256x256 sample
  const sampleW = Math.min(256, img.width);
  const sampleH = Math.min(256, img.height);
  canvas.width = sampleW;
  canvas.height = sampleH;
  ctx.drawImage(img, 0, 0, sampleW, sampleH);
  const quality = computeQualityMetrics(
    ctx,
    sampleW,
    sampleH,
    origWidth || img.width,
    origHeight || img.height,
    fileSizeBytes
  );

  return {
    pHash,
    pHashMirror,
    dHash,
    dHashMirror,
    regionHashes,
    colorHistogram,
    thumbnail32,
    quality,
  };
}
