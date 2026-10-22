/**
 * Vector file preview handling for AI and EPS files in the browser.
 * - AI files: if starts with "%PDF", render page 1 with pdfjs-dist (max 1600 px wide, white background).
 * - EPS files: do NOT extract preview from inside file. Use preview pairing only.
 * - Safety: read at most 100 MB, all browser-side, never upload original vector to server, never run code.
 */

export const NEEDS_PREVIEW_MESSAGE =
  'Add a JPG or PNG with the same name. In Illustrator: File > Export > Export As > JPEG, same file name, tick Use Artboards.';

export interface VectorPreviewResult {
  success: boolean;
  needsPreview: boolean;
  needsPreviewMessage?: string;
  previewUrl: string;
  aiDataUrl: string;
  width: number;
  height: number;
  isLowResPreview: boolean;
  previewSource: 'paired' | 'embedded' | 'pdf' | 'svg';
  errorMessage?: string;
}

const MAX_VECTOR_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

export function getBaseName(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return (lastDot !== -1 ? filename.slice(0, lastDot) : filename).toLowerCase().trim();
}

export function isVectorFileName(filename: string): boolean {
  return /\.(svg|eps|ai)$/i.test(filename);
}

export function getVectorType(filename: string): 'svg' | 'eps' | 'ai' | null {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  if (ext === '.svg') return 'svg';
  if (ext === '.eps') return 'eps';
  if (ext === '.ai') return 'ai';
  return null;
}

/**
 * Process a user-provided raster preview image (JPG, PNG, WEBP)
 * to be paired with an EPS or AI vector item.
 */
export async function processRasterPreview(file: File): Promise<{
  previewUrl: string;
  aiDataUrl: string;
  width: number;
  height: number;
  compressedSize: number;
}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const maxDim = 1024;
      const naturalWidth = img.naturalWidth || 800;
      const naturalHeight = img.naturalHeight || 600;

      let canvasWidth = naturalWidth;
      let canvasHeight = naturalHeight;

      if (canvasWidth > maxDim || canvasHeight > maxDim) {
        if (canvasWidth >= canvasHeight) {
          canvasHeight = Math.round((canvasHeight / canvasWidth) * maxDim);
          canvasWidth = maxDim;
        } else {
          canvasWidth = Math.round((canvasWidth / canvasHeight) * maxDim);
          canvasHeight = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Canvas 2D context not available'));
      }

      // Draw on white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

      const aiDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const compressedSize = Math.round((aiDataUrl.length * 3) / 4);

      // Create 160px preview thumbnail
      const thumbCanvas = document.createElement('canvas');
      const thumbScale = Math.min(160 / canvasWidth, 160 / canvasHeight, 1);
      thumbCanvas.width = Math.max(1, Math.round(canvasWidth * thumbScale));
      thumbCanvas.height = Math.max(1, Math.round(canvasHeight * thumbScale));

      const thumbCtx = thumbCanvas.getContext('2d');
      let previewUrl = aiDataUrl;
      if (thumbCtx) {
        thumbCtx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
        previewUrl = thumbCanvas.toDataURL('image/jpeg', 0.85);
      }

      resolve({
        previewUrl,
        aiDataUrl,
        width: naturalWidth,
        height: naturalHeight,
        compressedSize,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to load raster preview: ${file.name}`));
    };

    img.src = objectUrl;
  });
}

/**
 * 1. AI files (.ai):
 * If the file starts with the bytes "%PDF", render page 1 with pdfjs-dist onto a canvas
 * (max 1600 px wide, white background) and use it as the preview.
 * Load pdfjs-dist lazily, only when an .ai file is added, with the worker bundled in the package (no external CDN).
 * If rendering fails or file does not start with "%PDF", show the yellow "Needs a preview image" state.
 */
export async function extractAiPreview(file: File): Promise<VectorPreviewResult> {
  if (file.size > MAX_VECTOR_SIZE_BYTES) {
    return {
      success: false,
      needsPreview: true,
      needsPreviewMessage: `${file.name} exceeds the 100 MB limit for vector files.`,
      previewUrl: '',
      aiDataUrl: '',
      width: 0,
      height: 0,
      isLowResPreview: false,
      previewSource: 'pdf',
      errorMessage: 'File exceeds 100 MB limit',
    };
  }

  try {
    // Read first 1024 bytes to inspect magic header
    const headerBuffer = await file.slice(0, 1024).arrayBuffer();
    const headerBytes = new Uint8Array(headerBuffer);

    // Check if starts with "%PDF" (0x25, 0x50, 0x44, 0x46)
    const isPdfHeader =
      headerBytes.length >= 4 &&
      headerBytes[0] === 0x25 &&
      headerBytes[1] === 0x50 &&
      headerBytes[2] === 0x44 &&
      headerBytes[3] === 0x46;

    if (!isPdfHeader) {
      return {
        success: false,
        needsPreview: true,
        needsPreviewMessage: NEEDS_PREVIEW_MESSAGE,
        previewUrl: '',
        aiDataUrl: '',
        width: 0,
        height: 0,
        isLowResPreview: false,
        previewSource: 'pdf',
      };
    }

    // Lazily import pdfjs-dist only when an .ai file is added
    const pdfjs = await import('pdfjs-dist');

    // Configure bundled local worker (no external CDN)
    if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    }

    const fileBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(fileBuffer),
      isEvalSupported: false,
      stopAtErrors: false,
    });

    const pdfDoc = await loadingTask.promise;
    if (pdfDoc.numPages < 1) {
      return {
        success: false,
        needsPreview: true,
        needsPreviewMessage: NEEDS_PREVIEW_MESSAGE,
        previewUrl: '',
        aiDataUrl: '',
        width: 0,
        height: 0,
        isLowResPreview: false,
        previewSource: 'pdf',
      };
    }

    const page = await pdfDoc.getPage(1);
    const unscaledViewport = page.getViewport({ scale: 1 });

    // Render onto canvas (max 1600 px wide, white background)
    const maxDim = 1600;
    const scale = unscaledViewport.width > maxDim ? maxDim / unscaledViewport.width : 1;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context not available');
    }

    // White background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport,
      background: '#FFFFFF',
    }).promise;

    const previewUrl = canvas.toDataURL('image/jpeg', 0.85);

    return {
      success: true,
      needsPreview: false,
      previewUrl,
      aiDataUrl: previewUrl,
      width: Math.round(unscaledViewport.width),
      height: Math.round(unscaledViewport.height),
      isLowResPreview: false,
      previewSource: 'pdf',
    };
  } catch (err: unknown) {
    console.warn(`[extractAiPreview] Could not extract PDF preview from ${file.name}:`, err);
    return {
      success: false,
      needsPreview: true,
      needsPreviewMessage: NEEDS_PREVIEW_MESSAGE,
      previewUrl: '',
      aiDataUrl: '',
      width: 0,
      height: 0,
      isLowResPreview: false,
      previewSource: 'pdf',
    };
  }
}

/**
 * 2. EPS files (.eps):
 * Do NOT try to extract a preview from inside the file.
 * EPS files from Illustrator only contain a tiny 128 by 84 thumbnail, which is too small.
 * Use ONLY preview pairing (same base name, case-insensitive, with .jpg, .jpeg, .png or .webp).
 * Without a paired preview, EPS files always enter the "Needs a preview image" state.
 */
export function createUnpairedEpsResult(file: File): VectorPreviewResult {
  return {
    success: false,
    needsPreview: true,
    needsPreviewMessage: NEEDS_PREVIEW_MESSAGE,
    previewUrl: '',
    aiDataUrl: '',
    width: 0,
    height: 0,
    isLowResPreview: false,
    previewSource: 'paired',
  };
}
