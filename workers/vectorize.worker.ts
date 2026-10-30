/// <reference lib="webworker" />
import { runPipeline } from '../lib/vectorize/pipeline';
import type { PipelineSettings } from '../lib/vectorize/pipeline';

export interface VectorizeRequest {
  id: string;
  width: number;
  height: number;
  buffer: ArrayBuffer; // RGBA pixels
  settings: PipelineSettings;
}

export type VectorizeMessage =
  | { id: string; type: 'progress'; message: string; fraction: number }
  | { id: string; type: 'done'; svg: string; colors: number; paths: number }
  | { id: string; type: 'error'; error: string };

const post = (msg: VectorizeMessage) => (self as unknown as Worker).postMessage(msg);

self.onmessage = (event: MessageEvent<VectorizeRequest>) => {
  const { id, width, height, buffer, settings } = event.data;
  try {
    const data = new Uint8ClampedArray(buffer);
    const result = runPipeline(data, width, height, settings, (message, fraction) =>
      post({ id, type: 'progress', message, fraction })
    );
    post({ id, type: 'done', svg: result.svg, colors: result.colors, paths: result.paths });
  } catch (err) {
    post({ id, type: 'error', error: err instanceof Error ? err.message : 'Vectorizing failed.' });
  }
};