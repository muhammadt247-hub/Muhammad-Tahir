import { detectImageAlpha } from './alpha';
import { extractVideoFrame } from './video-frame';
import { rasterizeSvgToPng } from './svg-raster';

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
}

export async function processFileForGenerator(file: File): Promise<ProcessedAssetFile> {
  const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(file.name);
  const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
  const isPng = file.type === 'image/png' || /\.png$/i.test(file.name);

  const id = `asset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // 1. Video files
  if (isVideo) {
    const { frameDataUrl, width, height } = await extractVideoFrame(file);
    // Approximate compressed size from base64 length
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
    };
  }

  // 2. SVG files
  if (isSvg) {
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
      hasAlphaChannel: true, // SVGs generally have transparent backgrounds
      width,
      height,
    };
  }

  // 3. Raster images (JPG, PNG, WEBP, GIF)
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
        // Draw first to check alpha
        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
        hasAlpha = detectImageAlpha(ctx, canvasWidth, canvasHeight);

        // If it has alpha or for AI request, draw on white background
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
      } else {
        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
      }

      // 1024px JPEG quality 0.8 for AI
      const aiDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      const compressedSize = Math.round((aiDataUrl.length * 3) / 4);

      // Create a 160px thumbnail for clean preview
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
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to load image: ${file.name}`));
    };

    img.src = objectUrl;
  });
}
