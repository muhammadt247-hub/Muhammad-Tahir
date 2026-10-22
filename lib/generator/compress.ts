import { detectImageAlpha } from './alpha';
import { extractVideoFrame } from './video-frame';
import { rasterizeSvgToPng } from './svg-raster';
import { getVectorConverter, computeDpiFromBoundingBox } from './vector-convert-client';

export interface ProcessedAssetFile {
  id: string;
  file: File;
  originalName: string;
  originalSize: number; // in bytes
  compressedSize: number; // in bytes
  mimeType: string;
  previewUrl: string; // 160px object URL or data URL
  aiDataUrl: string; // 1024px JPEG base64 data URI for AI
  hasAlphaChannel: boolean; // true if transparent PNG
  width: number;
  height: number;

  // Vector support fields
  isVector?: boolean;
  vectorType?: 'svg' | 'eps' | 'ai';
  needsPreview?: boolean;
  needsPreviewMessage?: string;
  previewSource?: 'paired' | 'embedded' | 'pdf' | 'svg';
  isLowResPreview?: boolean;
  pairedPreviewName?: string;
  svgRasterFailed?: boolean;
  isConverting?: boolean;

  // Video support fields
  isVideo?: boolean;
  videoFrameFailed?: boolean;
  errorMessage?: string;
}

export async function processFileForGenerator(file: File): Promise<ProcessedAssetFile> {
  const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(file.name);
  const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
  const isAi = /\.ai$/i.test(file.name) || file.type === 'application/illustrator';
  const isEps = /\.eps$/i.test(file.name) || file.type === 'application/postscript';
  const isPng = file.type === 'image/png' || /\.png$/i.test(file.name);

  const id = `asset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // 1. Video files
  if (isVideo) {
    try {
      const { frameDataUrl, width, height } = await extractVideoFrame(file);
      const compressedSize = Math.round((frameDataUrl.length * 3) / 4);

      return {
        id,
        file,
        originalName: file.name,
        originalSize: file.size,
        compressedSize,
        mimeType: file.type || 'video/mp4',
        previewUrl: frameDataUrl,
        aiDataUrl: frameDataUrl,
        hasAlphaChannel: false,
        width,
        height,
        isVideo: true,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load video';
      console.error(`Failed to extract video frame ${file.name}:`, msg);
      return {
        id,
        file,
        originalName: file.name,
        originalSize: file.size,
        compressedSize: 0,
        mimeType: file.type || 'video/mp4',
        previewUrl: '',
        aiDataUrl: '',
        hasAlphaChannel: false,
        width: 0,
        height: 0,
        isVideo: true,
        videoFrameFailed: true,
        errorMessage: 'This video format could not be read by the browser. Try MP4 (H.264).',
      };
    }
  }

  // 2. SVG files (Vector)
  if (isSvg) {
    try {
      const { pngDataUrl, width, height } = await rasterizeSvgToPng(file);
      const compressedSize = Math.round((pngDataUrl.length * 3) / 4);

      return {
        id,
        file,
        originalName: file.name,
        originalSize: file.size,
        compressedSize,
        mimeType: 'image/svg+xml',
        previewUrl: pngDataUrl,
        aiDataUrl: pngDataUrl,
        hasAlphaChannel: true,
        width,
        height,
        isVector: true,
        vectorType: 'svg',
        previewSource: 'svg',
        needsPreview: false,
      };
    } catch (err: unknown) {
      console.error(`Failed to rasterize SVG ${file.name}:`, err);
      return {
        id,
        file,
        originalName: file.name,
        originalSize: file.size,
        compressedSize: 0,
        mimeType: 'image/svg+xml',
        previewUrl: '',
        aiDataUrl: '',
        hasAlphaChannel: false,
        width: 0,
        height: 0,
        isVector: true,
        vectorType: 'svg',
        svgRasterFailed: true,
        needsPreview: false,
      };
    }
  }

  // 3. AI and EPS files (Vector automatic browser conversion via Ghostscript WASM)
  if (isAi || isEps) {
    const vectorType = isAi ? 'ai' : 'eps';
    const dpi = await computeDpiFromBoundingBox(file);
    try {
      const conv = await getVectorConverter().enqueue(file, vectorType, dpi);

      if (conv.success) {
        return {
          id,
          file,
          originalName: file.name,
          originalSize: file.size,
          compressedSize: conv.compressedSize,
          mimeType: vectorType === 'ai' ? 'application/illustrator' : 'application/postscript',
          previewUrl: conv.previewUrl,
          aiDataUrl: conv.aiDataUrl,
          hasAlphaChannel: false,
          width: conv.width,
          height: conv.height,
          isVector: true,
          vectorType,
          needsPreview: false,
          previewSource: 'pdf',
        };
      } else {
        const reason = conv.error || 'Conversion took too long. Add a JPG/PNG with the same name.';
        console.error(`Could not convert vector file ${file.name}: ${reason}`);
        return {
          id,
          file,
          originalName: file.name,
          originalSize: file.size,
          compressedSize: 0,
          mimeType: vectorType === 'ai' ? 'application/illustrator' : 'application/postscript',
          previewUrl: '',
          aiDataUrl: '',
          hasAlphaChannel: false,
          width: 0,
          height: 0,
          isVector: true,
          vectorType,
          needsPreview: true,
          needsPreviewMessage: reason,
          previewSource: 'paired',
          isLowResPreview: false,
        };
      }
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : 'Conversion took too long. Add a JPG/PNG with the same name.';
      console.error(`Could not convert vector file ${file.name}: ${reason}`);
      return {
        id,
        file,
        originalName: file.name,
        originalSize: file.size,
        compressedSize: 0,
        mimeType: vectorType === 'ai' ? 'application/illustrator' : 'application/postscript',
        previewUrl: '',
        aiDataUrl: '',
        hasAlphaChannel: false,
        width: 0,
        height: 0,
        isVector: true,
        vectorType,
        needsPreview: true,
        needsPreviewMessage: reason,
        previewSource: 'paired',
        isLowResPreview: false,
      };
    }
  }

  // 5. Raster images (JPG, PNG, WEBP, GIF)
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

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        return reject(new Error('Canvas 2D context not available'));
      }

      let hasAlpha = false;

      if (isPng) {
        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
        hasAlpha = detectImageAlpha(ctx, canvasWidth, canvasHeight);

        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
      } else {
        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
      }

      const aiDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      const compressedSize = Math.round((aiDataUrl.length * 3) / 4);

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
        id,
        file,
        originalName: file.name,
        originalSize: file.size,
        compressedSize,
        mimeType: file.type || 'image/jpeg',
        previewUrl,
        aiDataUrl,
        hasAlphaChannel: hasAlpha,
        width: naturalWidth,
        height: naturalHeight,
        isVector: false,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to load image: ${file.name}`));
    };

    img.src = objectUrl;
  });
}
