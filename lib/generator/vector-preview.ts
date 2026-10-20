/**
 * Vector file preview extraction for AI and EPS files in the browser.
 * Follows strict safety rules:
 * - Read vector files at most 100 MB
 * - All parsing in the browser
 * - Never upload original vector file to server
 * - Never execute code from vector files
 */

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
 * to be paired with a vector item.
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
 * Read file in browser (max 100 MB).
 * If starts with "%PDF", render page 1 with pdfjs-dist onto canvas (max 1600 px wide, white background).
 * Loaded lazily only when an .ai file is added.
 * Worker bundled locally with package.
 * If not starting with "%PDF", password protected, or rendering fails:
 * show yellow "Needs a preview image" state with:
 * "This AI file has no PDF-compatible content. Save it with 'Create PDF Compatible File' or add a JPG or PNG preview with the same name."
 */
export async function extractAiPreview(file: File): Promise<VectorPreviewResult> {
  const needsPreviewAiMsg =
    "This AI file has no PDF-compatible content. Save it with 'Create PDF Compatible File' or add a JPG or PNG preview with the same name.";

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
        needsPreviewMessage: needsPreviewAiMsg,
        previewUrl: '',
        aiDataUrl: '',
        width: 0,
        height: 0,
        isLowResPreview: false,
        previewSource: 'pdf',
      };
    }

    // Lazily import pdfjs-dist
    const pdfjs = await import('pdfjs-dist');

    // Configure bundled local worker (not external CDN)
    if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
      try {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString();
      } catch {
        pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.mjs`;
      }
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
        needsPreviewMessage: needsPreviewAiMsg,
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
      needsPreviewMessage: needsPreviewAiMsg,
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
 * 2. EPS files (.eps): try to extract a built-in preview.
 * a. If file starts with bytes C5 D0 D3 C6 (binary EPS header):
 *    TIFF preview offset & length at byte positions 20 to 27, little-endian.
 *    If TIFF exists, decode with "utif" (loaded lazily).
 * b. Otherwise look for an ASCII preview:
 *    "%%BeginPreview: width height depth lines" ... up to "%%EndPreview".
 * c. If neither exists, or preview's longest side is under 200 px, show "Needs a preview image".
 * d. When preview came from inside the file, show amber chip "Preview from file (low resolution)".
 */
export async function extractEpsPreview(file: File): Promise<VectorPreviewResult> {
  const needsPreviewEpsMsg = 'Add a JPG or PNG preview with the same name, for example logo.jpg';

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
      previewSource: 'embedded',
      errorMessage: 'File exceeds 100 MB limit',
    };
  }

  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Check a: Binary EPS Header: C5 D0 D3 C6
    if (
      bytes.length >= 30 &&
      bytes[0] === 0xc5 &&
      bytes[1] === 0xd0 &&
      bytes[2] === 0xd3 &&
      bytes[3] === 0xc6
    ) {
      const dataView = new DataView(buffer);
      // Byte positions 20 to 27, little-endian
      const tiffOffset = dataView.getUint32(20, true);
      const tiffLength = dataView.getUint32(24, true);

      if (tiffOffset > 0 && tiffLength > 0 && tiffOffset + tiffLength <= buffer.byteLength) {
        try {
          const tiffBuffer = buffer.slice(tiffOffset, tiffOffset + tiffLength);
          // Lazily import utif
          const UTIF = await import('utif');
          const ifds = UTIF.decode(tiffBuffer);
          if (ifds && ifds.length > 0) {
            const ifd = ifds[0];
            UTIF.decodeImage(tiffBuffer, ifd);
            const rgba = UTIF.toRGBA8(ifd);
            const width = ifd.width;
            const height = ifd.height;
            const longestSide = Math.max(width, height);

            if (longestSide >= 200) {
              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                const imgData = ctx.createImageData(width, height);
                imgData.data.set(rgba);
                ctx.putImageData(imgData, 0, 0);

                const previewUrl = canvas.toDataURL('image/jpeg', 0.85);
                return {
                  success: true,
                  needsPreview: false,
                  previewUrl,
                  aiDataUrl: previewUrl,
                  width,
                  height,
                  isLowResPreview: true,
                  previewSource: 'embedded',
                };
              }
            }
          }
        } catch (tiffErr) {
          console.warn(`[extractEpsPreview] Failed to decode binary TIFF preview in ${file.name}:`, tiffErr);
        }
      }
    }

    // Check b: ASCII Preview: "%%BeginPreview: width height depth lines"
    // Read initial text segment (max 10MB to find preview)
    const textSliceLength = Math.min(buffer.byteLength, 10 * 1024 * 1024);
    const textSlice = new TextDecoder('latin1').decode(bytes.subarray(0, textSliceLength));

    const previewHeaderMatch = textSlice.match(
      /%%BeginPreview:\s*(\d+)\s+(\d+)\s+(\d+)(?:\s+(\d+))?/i
    );

    if (previewHeaderMatch) {
      const width = parseInt(previewHeaderMatch[1], 10);
      const height = parseInt(previewHeaderMatch[2], 10);
      const depth = parseInt(previewHeaderMatch[3], 10);
      const longestSide = Math.max(width, height);

      if (longestSide >= 200) {
        const startIndex = previewHeaderMatch.index! + previewHeaderMatch[0].length;
        const endIndex = textSlice.indexOf('%%EndPreview', startIndex);

        if (endIndex !== -1) {
          const hexBody = textSlice.slice(startIndex, endIndex);
          const lines = hexBody.split(/\r?\n/);
          let allHex = '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('%')) {
              allHex += trimmed.slice(1).replace(/[^0-9a-fA-F]/g, '');
            }
          }

          if (allHex.length > 0) {
            const decodedBytes = new Uint8Array(Math.floor(allHex.length / 2));
            for (let i = 0; i < decodedBytes.length; i++) {
              decodedBytes[i] = parseInt(allHex.slice(i * 2, i * 2 + 2), 16);
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              const imgData = ctx.createImageData(width, height);

              if (depth === 1) {
                // Monochrome bitmap
                let bytePos = 0;
                let bitPos = 7;
                for (let y = 0; y < height; y++) {
                  for (let x = 0; x < width; x++) {
                    const bit = (decodedBytes[bytePos] >> bitPos) & 1;
                    const pIdx = (y * width + x) * 4;
                    // Standard EPS DSC: 1 is black, 0 is white
                    const val = bit ? 0 : 255;
                    imgData.data[pIdx] = val;
                    imgData.data[pIdx + 1] = val;
                    imgData.data[pIdx + 2] = val;
                    imgData.data[pIdx + 3] = 255;

                    bitPos--;
                    if (bitPos < 0) {
                      bitPos = 7;
                      bytePos++;
                    }
                  }
                  // Scanline padded to byte boundary
                  if (bitPos !== 7) {
                    bitPos = 7;
                    bytePos++;
                  }
                }
              } else {
                // 8-bit grayscale
                let bytePos = 0;
                for (let y = 0; y < height; y++) {
                  for (let x = 0; x < width; x++) {
                    const val = decodedBytes[bytePos++] ?? 255;
                    const pIdx = (y * width + x) * 4;
                    imgData.data[pIdx] = val;
                    imgData.data[pIdx + 1] = val;
                    imgData.data[pIdx + 2] = val;
                    imgData.data[pIdx + 3] = 255;
                  }
                }
              }

              ctx.putImageData(imgData, 0, 0);
              const previewUrl = canvas.toDataURL('image/jpeg', 0.85);

              return {
                success: true,
                needsPreview: false,
                previewUrl,
                aiDataUrl: previewUrl,
                width,
                height,
                isLowResPreview: true,
                previewSource: 'embedded',
              };
            }
          }
        }
      }
    }

    // Neither exists or longest side < 200 px
    return {
      success: false,
      needsPreview: true,
      needsPreviewMessage: needsPreviewEpsMsg,
      previewUrl: '',
      aiDataUrl: '',
      width: 0,
      height: 0,
      isLowResPreview: false,
      previewSource: 'embedded',
    };
  } catch (err: unknown) {
    console.warn(`[extractEpsPreview] Failed to extract EPS preview in ${file.name}:`, err);
    return {
      success: false,
      needsPreview: true,
      needsPreviewMessage: needsPreviewEpsMsg,
      previewUrl: '',
      aiDataUrl: '',
      width: 0,
      height: 0,
      isLowResPreview: false,
      previewSource: 'embedded',
    };
  }
}
