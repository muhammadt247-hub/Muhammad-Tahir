/**
 * Client-side Ghostscript WASM vector conversion queue.
 * - Handles .eps and .ai automatic conversion in the browser
 * - Reads up to 100 MB
 * - Chooses DPI from bounding box (%%HiResBoundingBox or %%BoundingBox in first 20 KB)
 * - Single sequential queue with reusable Web Worker
 * - 90-second timeout with worker termination and restart
 */

export interface VectorConversionResult {
  success: boolean;
  previewUrl: string;
  aiDataUrl: string;
  width: number;
  height: number;
  compressedSize: number;
  error?: string;
}

interface QueueItem {
  id: string;
  file: File;
  fileType: 'eps' | 'ai';
  dpi: number;
  onProgress?: (stage: string) => void;
  resolve: (res: VectorConversionResult) => void;
}

const MAX_VECTOR_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
const CONVERSION_TIMEOUT_MS = 90 * 1000; // 90 seconds

/**
 * Read bounding box from first 20 KB of the vector file and compute optimal DPI.
 * set dpi = clamp(2000 / (longestSidePt / 72), 24, 150)
 */
export async function computeDpiFromBoundingBox(file: File): Promise<number> {
  try {
    const slice = file.slice(0, 20480);
    const text = await slice.text();

    const hiResMatch = text.match(
      /%%HiResBoundingBox:\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/i
    );
    const bboxMatch =
      hiResMatch ||
      text.match(
        /%%BoundingBox:\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/i
      );

    if (bboxMatch) {
      const x1 = parseFloat(bboxMatch[1]);
      const y1 = parseFloat(bboxMatch[2]);
      const x2 = parseFloat(bboxMatch[3]);
      const y2 = parseFloat(bboxMatch[4]);

      const widthPt = Math.abs(x2 - x1);
      const heightPt = Math.abs(y2 - y1);
      const longestSidePt = Math.max(widthPt, heightPt);

      if (longestSidePt > 0 && !isNaN(longestSidePt)) {
        const rawDpi = 2000 / (longestSidePt / 72);
        return Math.min(150, Math.max(24, Math.round(rawDpi)));
      }
    }
  } catch (err) {
    console.warn(`[computeDpiFromBoundingBox] Error reading bbox for ${file.name}:`, err);
  }
  return 72;
}

/**
 * Process converted raw JPEG bytes into browser object URL and optimized AI JPEG data URI.
 */
export async function processConvertedJpegBytes(
  jpegBytes: Uint8Array
): Promise<{
  previewUrl: string;
  aiDataUrl: string;
  width: number;
  height: number;
  compressedSize: number;
}> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([jpegBytes], { type: 'image/jpeg' });
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      const naturalWidth = img.naturalWidth || 800;
      const naturalHeight = img.naturalHeight || 600;

      // Downsample to 1024px JPEG quality 0.8 for AI request
      const maxDim = 1024;
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
        URL.revokeObjectURL(objectUrl);
        return reject(new Error('Canvas 2D context not available'));
      }

      // Draw onto white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

      const aiDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const compressedSize = Math.round((aiDataUrl.length * 3) / 4);

      // Create a clean thumbnail
      const thumbCanvas = document.createElement('canvas');
      const thumbScale = Math.min(160 / canvasWidth, 160 / canvasHeight, 1);
      thumbCanvas.width = Math.max(1, Math.round(canvasWidth * thumbScale));
      thumbCanvas.height = Math.max(1, Math.round(canvasHeight * thumbScale));
      const thumbCtx = thumbCanvas.getContext('2d');
      let previewUrl = objectUrl;
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
      reject(new Error('Failed to load converted JPEG preview'));
    };

    img.src = objectUrl;
  });
}

class VectorConversionManager {
  private worker: Worker | null = null;
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private currentTimeoutTimer: NodeJS.Timeout | null = null;
  private currentItem: QueueItem | null = null;

  private getOrCreateWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('../../workers/gs-convert.worker.ts', import.meta.url),
        { type: 'module' }
      );
      this.setupWorkerHandlers();
    }
    return this.worker;
  }

  private setupWorkerHandlers() {
    if (!this.worker) return;

    this.worker.onmessage = async (e: MessageEvent) => {
      this.clearCurrentTimeout();
      const data = e.data;
      const active = this.currentItem;

      if (!active || active.id !== data.id) {
        return;
      }

      this.currentItem = null;

      if (data.success && data.jpegBytes) {
        try {
          const processed = await processConvertedJpegBytes(data.jpegBytes);
          active.resolve({
            success: true,
            previewUrl: processed.previewUrl,
            aiDataUrl: processed.aiDataUrl,
            width: processed.width,
            height: processed.height,
            compressedSize: processed.compressedSize,
          });
        } catch (err: unknown) {
          active.resolve({
            success: false,
            previewUrl: '',
            aiDataUrl: '',
            width: 0,
            height: 0,
            compressedSize: 0,
            error: err instanceof Error ? err.message : 'Could not convert this file',
          });
        }
      } else {
        active.resolve({
          success: false,
          previewUrl: '',
          aiDataUrl: '',
          width: 0,
          height: 0,
          compressedSize: 0,
          error: data.error || 'Could not convert this file',
        });
      }

      this.processNext();
    };

    this.worker.onerror = (err) => {
      console.error('[VectorConversionManager] Worker error:', err);
      this.clearCurrentTimeout();
      this.restartWorker();

      const active = this.currentItem;
      this.currentItem = null;
      if (active) {
        active.resolve({
          success: false,
          previewUrl: '',
          aiDataUrl: '',
          width: 0,
          height: 0,
          compressedSize: 0,
          error: 'Could not convert this file',
        });
      }

      this.processNext();
    };
  }

  private restartWorker() {
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch {}
      this.worker = null;
    }
  }

  private clearCurrentTimeout() {
    if (this.currentTimeoutTimer) {
      clearTimeout(this.currentTimeoutTimer);
      this.currentTimeoutTimer = null;
    }
  }

  private handleTimeout(item: QueueItem) {
    console.warn(`[VectorConversionManager] Conversion timed out after 90s for ${item.file.name}`);
    this.restartWorker();
    this.currentItem = null;
    item.resolve({
      success: false,
      previewUrl: '',
      aiDataUrl: '',
      width: 0,
      height: 0,
      compressedSize: 0,
      error: 'Could not convert this file (conversion timed out after 90 seconds)',
    });
    this.processNext();
  }

  public enqueue(
    file: File,
    fileType: 'eps' | 'ai',
    dpi: number,
    onProgress?: (stage: string) => void
  ): Promise<VectorConversionResult> {
    if (file.size > MAX_VECTOR_SIZE_BYTES) {
      return Promise.resolve({
        success: false,
        previewUrl: '',
        aiDataUrl: '',
        width: 0,
        height: 0,
        compressedSize: 0,
        error: `${file.name} exceeds the 100 MB limit for vector files.`,
      });
    }

    return new Promise((resolve) => {
      const id = `convert_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      this.queue.push({
        id,
        file,
        fileType,
        dpi,
        onProgress,
        resolve,
      });

      if (!this.isProcessing) {
        this.processNext();
      }
    });
  }

  private async processNext() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      this.currentItem = null;
      return;
    }

    this.isProcessing = true;
    const task = this.queue.shift()!;
    this.currentItem = task;

    try {
      task.onProgress?.('Reading vector file bytes...');
      const buffer = await task.file.arrayBuffer();
      const fileBytes = new Uint8Array(buffer);

      task.onProgress?.('Converting vector with Ghostscript WASM...');
      const worker = this.getOrCreateWorker();

      // Start 90s timeout
      this.clearCurrentTimeout();
      this.currentTimeoutTimer = setTimeout(() => {
        this.handleTimeout(task);
      }, CONVERSION_TIMEOUT_MS);

      // Post message with transferred ArrayBuffer
      worker.postMessage(
        {
          id: task.id,
          fileBytes,
          fileName: task.file.name,
          fileType: task.fileType,
          dpi: task.dpi,
        },
        [fileBytes.buffer]
      );
    } catch (err: unknown) {
      this.clearCurrentTimeout();
      const msg = err instanceof Error ? err.message : 'Could not convert this file';
      task.resolve({
        success: false,
        previewUrl: '',
        aiDataUrl: '',
        width: 0,
        height: 0,
        compressedSize: 0,
        error: msg,
      });
      this.currentItem = null;
      this.processNext();
    }
  }
}

// Global client singleton
let globalVectorConverter: VectorConversionManager | null = null;

export function getVectorConverter(): VectorConversionManager {
  if (typeof window === 'undefined') {
    return new VectorConversionManager();
  }
  if (!globalVectorConverter) {
    globalVectorConverter = new VectorConversionManager();
  }
  return globalVectorConverter;
}
