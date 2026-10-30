/// <reference lib="webworker" />
import ImageTracer from '../lib/vendor/imagetracer';
import type { TracerOptions } from '../lib/vendor/imagetracer';

export interface VectorizeRequest {
  id: string;
  width: number;
  height: number;
  buffer: ArrayBuffer; // RGBA pixels
  options: TracerOptions;
  removeWhite: boolean;
  whiteTolerance: number; // 0-60
}

export interface VectorizeResponse {
  id: string;
  success: boolean;
  svg?: string;
  error?: string;
}

self.onmessage = (event: MessageEvent<VectorizeRequest>) => {
  const { id, width, height, buffer, options, removeWhite, whiteTolerance } = event.data;
  try {
    const data = new Uint8ClampedArray(buffer);
    if (removeWhite) {
      const limit = 255 - Math.max(0, Math.min(60, whiteTolerance));
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] >= limit && data[i + 1] >= limit && data[i + 2] >= limit) {
          data[i + 3] = 0;
        }
      }
    }
    const svg = ImageTracer.imagedataToSVG({ width, height, data }, options);
    const response: VectorizeResponse = { id, success: true, svg };
    (self as unknown as Worker).postMessage(response);
  } catch (err) {
    const response: VectorizeResponse = {
      id,
      success: false,
      error: err instanceof Error ? err.message : 'Vectorizing failed.',
    };
    (self as unknown as Worker).postMessage(response);
  }
};