"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  Download,
  Copy,
  Loader2,
  AlertCircle,
  Sparkles,
  SlidersHorizontal,
  X,
  RefreshCw,
  Info,
  Play,
  Square,
  Trash2,
  Plus,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import type { PipelineSettings } from "@/lib/vectorize/pipeline";
import type { VectorizeMessage } from "@/workers/vectorize.worker";

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_MB = 25;
const MAX_BATCH = 500;

type Mode = "auto" | "manual";
type Preset = "lineart" | "flat" | "illustration" | "detailed";

const PRESET_INFO: Record<Preset, { label: string; hint: string; settings: Omit<PipelineSettings, "removeBackground" | "deep"> }> = {
  lineart: {
    label: "Line art (2 colors)",
    hint: "Black and white drawings, signatures, outlines.",
    settings: { maxColors: 2, mergeDistance: 30, smoothRadius: 1, curveTolerance: 0.6, minArea: 20, thinWidth: 2 },
  },
  flat: {
    label: "Flat icon (one color per area)",
    hint: "Logos and icons. Each color area becomes one flat color, no shades.",
    settings: { maxColors: 24, mergeDistance: 18, smoothRadius: 1, curveTolerance: 0.6, minArea: 12, thinWidth: 4 },
  },
  illustration: {
    label: "Illustration",
    hint: "Cartoons and artwork with soft color areas.",
    settings: { maxColors: 32, mergeDistance: 12, smoothRadius: 1, curveTolerance: 0.6, minArea: 10, thinWidth: 3 },
  },
  detailed: {
    label: "Detailed (keeps shading)",
    hint: "Many colors, shading and fine edges. Slower and bigger files.",
    settings: { maxColors: 48, mergeDistance: 6, smoothRadius: 1, curveTolerance: 0.5, minArea: 6, thinWidth: 2 },
  },
};

const checkerStyle: React.CSSProperties = {
  background: "repeating-conic-gradient(#d4d4d4 0% 25%, #ffffff 0% 50%) 50% / 16px 16px",
};

function baseName(name: string) {
  return name.replace(/\.[^/.]+$/, "").replace(/[^\w.\- ]+/g, "_") || "image";
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

// Look at a small copy of the picture and pick the best preset (our own simple rule).
function detectPreset(data: Uint8ClampedArray, pixelCount: number): Preset {
  const bins = new Map<number, number>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 16) continue;
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    bins.set(key, (bins.get(key) || 0) + 1);
  }
  let strong = 0;
  let darkOrWhite = 0;
  bins.forEach((count, key) => {
    if (count / pixelCount >= 0.005) {
      strong++;
      const r = (key >> 8) & 15;
      const g = (key >> 4) & 15;
      const b = key & 15;
      const avg = (r + g + b) / 3;
      if (avg <= 3 || avg >= 12) darkOrWhite += count;
    }
  });
  if (strong <= 6 && darkOrWhite / pixelCount > 0.85) return "lineart";
  if (strong <= 24) return "flat";
  if (strong <= 90) return "illustration";
  return "detailed";
}


type BatchItem = {
  id: number;
  file: File;
  status: "waiting" | "working" | "done" | "error";
  svg?: string;
  svgUrl?: string;
  paths?: number;
  preset?: Preset;
  ms?: number;
  error?: string;
};

// ---- Our own small ZIP maker (no extra library needed) ----
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(d: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < d.length; i++) c = crcTable[(c ^ d[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === "undefined") return null;
  try {
    const stream = new Blob([data.slice().buffer]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

async function makeZip(entries: { name: string; text: string }[]): Promise<Blob> {
  const enc = new TextEncoder();
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = enc.encode(e.name);
    const bytes = enc.encode(e.text);
    const crc = crc32(bytes);
    const packed = await deflateRaw(bytes);
    const useDeflate = !!packed && packed.length < bytes.length;
    const payload = useDeflate ? (packed as Uint8Array) : bytes;
    const method = useDeflate ? 8 : 0;

    const lh = new Uint8Array(30 + name.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, method, true);
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, payload.length, true);
    lv.setUint32(22, bytes.length, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    lh.set(name, 30);
    parts.push(lh, payload);

    const ch = new Uint8Array(46 + name.length);
    const cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, method, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, payload.length, true);
    cv.setUint32(24, bytes.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    ch.set(name, 46);
    central.push(ch);
    offset += lh.length + payload.length;
  }
  let centralSize = 0;
  for (const c of central) centralSize += c.length;
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  const all = [...parts, ...central, end].map((u) => u.slice().buffer);
  return new Blob(all, { type: "application/zip" });
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

type Source = {
  file: File;
  url: string;
  width: number;
  height: number;
};

export default function VectorizerPage() {
  const [source, setSource] = useState<Source | null>(null);
  const [mode, setMode] = useState<Mode>("auto");
  const [autoPreset, setAutoPreset] = useState<Preset | null>(null);
  const [preset, setPreset] = useState<Preset>("flat");

  // Manual settings
  const [colors, setColors] = useState(24);
  const [merge, setMerge] = useState(18);
  const [detail, setDetail] = useState(8);
  const [noise, setNoise] = useState(12);
  const [thin, setThin] = useState(4);
  const [smooth, setSmooth] = useState(1);
  const [maxEdge, setMaxEdge] = useState(2400);
  const [transparentBg, setTransparentBg] = useState(true);
  const [progress, setProgress] = useState<{ message: string; fraction: number } | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [svgText, setSvgText] = useState<string | null>(null);
  const [svgUrl, setSvgUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<{ paths: number; bytes: number; ms: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Many images at once
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ message: string; fraction: number } | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [zipping, setZipping] = useState(false);
  const batchRef = useRef<BatchItem[]>([]);
  batchRef.current = batch;
  const nextId = useRef(1);
  const cancelRef = useRef(false);
  const batchWorkerRef = useRef<Worker | null>(null);
  const rejectRef = useRef<((e: Error) => void) | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sourceRef = useRef<Source | null>(null);
  sourceRef.current = source;

  const stopWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopWorker();
  }, [stopWorker]);

  useEffect(() => {
    return () => {
      cancelRef.current = true;
      batchWorkerRef.current?.terminate();
      batchRef.current.forEach((it) => {
        if (it.svgUrl) URL.revokeObjectURL(it.svgUrl);
      });
    };
  }, []);

  useEffect(() => {
    return () => {
      if (svgUrl) URL.revokeObjectURL(svgUrl);
    };
  }, [svgUrl]);

  useEffect(() => {
    return () => {
      if (source?.url) URL.revokeObjectURL(source.url);
    };
  }, [source]);

  const clearResult = () => {
    setSvgText(null);
    setSvgUrl(null);
    setStats(null);
  };

  const buildSettings = (usedPreset: Preset): PipelineSettings => {
    if (mode === "manual") {
      return {
        maxColors: colors,
        mergeDistance: merge,
        smoothRadius: smooth,
        curveTolerance: 1.2 - detail * 0.07, // detail 1..10 -> 1.13..0.5 (lower = follows the edge more closely)
        minArea: noise,
        thinWidth: thin,
        removeBackground: transparentBg,
        deep: true,
      };
    }
    return { ...PRESET_INFO[usedPreset].settings, removeBackground: transparentBg, deep: true };
  };

  const runVectorize = useCallback(
    async (src: Source, overridePreset?: Preset) => {
      stopWorker();
      setBusy(true);
      setError(null);
      setProgress({ message: "Reading your image...", fraction: 0.02 });
      const started = performance.now();
      try {
        const bmp = await createImageBitmap(src.file, { imageOrientation: "from-image" });
        const edge = mode === "manual" ? maxEdge : 2400;
        const scale = Math.min(1, edge / Math.max(bmp.width, bmp.height));
        const w = Math.max(1, Math.round(bmp.width * scale));
        const h = Math.max(1, Math.round(bmp.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("Your browser could not prepare the image.");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(bmp, 0, 0, w, h);
        bmp.close?.();
        const imageData = ctx.getImageData(0, 0, w, h);

        let usedPreset: Preset = overridePreset || preset;
        if (mode === "auto" && !overridePreset) {
          usedPreset = detectPreset(imageData.data, w * h);
          setAutoPreset(usedPreset);
          setPreset(usedPreset);
        }
        const settings = buildSettings(usedPreset);

        const worker = new Worker(new URL("../../../../workers/vectorize.worker.ts", import.meta.url), {
          type: "module",
        });
        workerRef.current = worker;
        const id = String(Date.now());

        const result = await new Promise<{ svg: string; paths: number }>((resolve, reject) => {
          const timer = window.setTimeout(() => {
            reject(new Error("This is taking too long. Try a smaller working size or fewer colors."));
          }, 240000);
          worker.onmessage = (ev: MessageEvent<VectorizeMessage>) => {
            const msg = ev.data;
            if (msg.type === "progress") {
              setProgress({ message: msg.message, fraction: msg.fraction });
            } else if (msg.type === "done") {
              window.clearTimeout(timer);
              resolve({ svg: msg.svg, paths: msg.paths });
            } else {
              window.clearTimeout(timer);
              reject(new Error(msg.error || "Vectorizing failed."));
            }
          };
          worker.onerror = () => {
            window.clearTimeout(timer);
            reject(new Error("The vectorizer could not start. Please refresh the page."));
          };
          worker.postMessage(
            { id, width: w, height: h, buffer: imageData.data.buffer, settings },
            [imageData.data.buffer]
          );
        });
        stopWorker();

        // Keep the original picture size
        const svg = result.svg.replace("<svg ", `<svg width="${src.width}" height="${src.height}" `);
        const blob = new Blob([svg], { type: "image/svg+xml" });
        setSvgText(svg);
        setSvgUrl(URL.createObjectURL(blob));
        setStats({ paths: result.paths, bytes: blob.size, ms: Math.round(performance.now() - started) });
      } catch (err) {
        clearResult();
        setError(err instanceof Error ? err.message : "Vectorizing failed.");
      } finally {
        setBusy(false);
        setProgress(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, preset, colors, merge, detail, noise, thin, smooth, maxEdge, transparentBg, stopWorker]
  );

  const loadFile = async (file: File | undefined | null) => {
    if (!file) return;
    if (!ALLOWED.includes(file.type)) {
      toast.error("Please choose a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`This image is bigger than ${MAX_FILE_MB} MB.`);
      return;
    }
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      const src: Source = { file, url: URL.createObjectURL(file), width: bmp.width, height: bmp.height };
      bmp.close?.();
      clearResult();
      setError(null);
      setAutoPreset(null);
      setSource(src);
      void runVectorize(src);
    } catch {
      toast.error("This image could not be opened.");
    }
  };

  const patchItem = (id: number, patch: Partial<BatchItem>) => {
    setBatch((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const handleFiles = (list: FileList | null | undefined) => {
    const files = Array.from(list || []);
    if (!files.length) return;
    const good: File[] = [];
    let skipped = 0;
    for (const f of files) {
      if (!ALLOWED.includes(f.type) || f.size > MAX_FILE_MB * 1024 * 1024) skipped++;
      else good.push(f);
    }
    if (skipped) toast.error(`${skipped} file(s) skipped. Use JPG, PNG or WebP, up to ${MAX_FILE_MB} MB each.`);
    if (!good.length) return;
    if (batchRef.current.length === 0 && good.length === 1) {
      void loadFile(good[0]);
      return;
    }
    const room = MAX_BATCH - batchRef.current.length;
    if (good.length > room) toast.error(`Only ${MAX_BATCH} images can be in one batch. Extra images were left out.`);
    const added: BatchItem[] = good.slice(0, Math.max(0, room)).map((file) => ({
      id: nextId.current++,
      file,
      status: "waiting" as const,
    }));
    if (added.length) setBatch((prev) => [...prev, ...added]);
  };

  // Trace one file (used by the batch). Returns the SVG text.
  const traceFile = async (file: File, onProgress: (message: string, fraction: number) => void) => {
    const started = performance.now();
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const origW = bmp.width;
    const origH = bmp.height;
    const edge = mode === "manual" ? maxEdge : 2400;
    const scale = Math.min(1, edge / Math.max(origW, origH));
    const w = Math.max(1, Math.round(origW * scale));
    const h = Math.max(1, Math.round(origH * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Your browser could not prepare the image.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const imageData = ctx.getImageData(0, 0, w, h);
    canvas.width = 1;
    canvas.height = 1;

    let usedPreset: Preset = preset;
    if (mode === "auto") usedPreset = detectPreset(imageData.data, w * h);
    const settings = buildSettings(usedPreset);

    const worker = new Worker(new URL("../../../../workers/vectorize.worker.ts", import.meta.url), {
      type: "module",
    });
    batchWorkerRef.current = worker;
    const id = String(Date.now());
    try {
      const result = await new Promise<{ svg: string; paths: number }>((resolve, reject) => {
        rejectRef.current = reject;
        const timer = window.setTimeout(() => {
          reject(new Error("This image took too long. Try a smaller working size or fewer colors."));
        }, 300000);
        worker.onmessage = (ev: MessageEvent<VectorizeMessage>) => {
          const msg = ev.data;
          if (msg.type === "progress") {
            onProgress(msg.message, msg.fraction);
          } else if (msg.type === "done") {
            window.clearTimeout(timer);
            resolve({ svg: msg.svg, paths: msg.paths });
          } else {
            window.clearTimeout(timer);
            reject(new Error(msg.error || "Vectorizing failed."));
          }
        };
        worker.onerror = () => {
          window.clearTimeout(timer);
          reject(new Error("The vectorizer could not start. Please refresh the page."));
        };
        worker.postMessage({ id, width: w, height: h, buffer: imageData.data.buffer, settings }, [imageData.data.buffer]);
      });
      const svg = result.svg.replace("<svg ", `<svg width="${origW}" height="${origH}" `);
      return { svg, paths: result.paths, preset: usedPreset, ms: Math.round(performance.now() - started) };
    } finally {
      worker.terminate();
      batchWorkerRef.current = null;
      rejectRef.current = null;
    }
  };

  const startBatch = async () => {
    if (batchRunning) return;
    cancelRef.current = false;
    setBatchRunning(true);
    const todo = batchRef.current.filter((it) => it.status === "waiting");
    for (const item of todo) {
      if (cancelRef.current) break;
      patchItem(item.id, { status: "working", error: undefined });
      setBatchProgress({ message: "Reading the image...", fraction: 0.02 });
      try {
        const r = await traceFile(item.file, (message, fraction) => setBatchProgress({ message, fraction }));
        const svgUrl = URL.createObjectURL(new Blob([r.svg], { type: "image/svg+xml" }));
        patchItem(item.id, { status: "done", svg: r.svg, svgUrl, paths: r.paths, preset: r.preset, ms: r.ms });
      } catch (err) {
        if (cancelRef.current) patchItem(item.id, { status: "waiting" });
        else patchItem(item.id, { status: "error", error: err instanceof Error ? err.message : "Vectorizing failed." });
      }
    }
    setBatchRunning(false);
    setBatchProgress(null);
  };

  const stopBatch = () => {
    cancelRef.current = true;
    batchWorkerRef.current?.terminate();
    rejectRef.current?.(new Error("Stopped."));
  };

  const retryFailed = () => {
    setBatch((prev) => prev.map((it) => (it.status === "error" ? { ...it, status: "waiting" as const, error: undefined } : it)));
  };

  const clearBatch = () => {
    if (batchRunning) return;
    batchRef.current.forEach((it) => {
      if (it.svgUrl) URL.revokeObjectURL(it.svgUrl);
    });
    setBatch([]);
    setSelectedId(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const downloadItem = (item: BatchItem) => {
    if (!item.svg) return;
    saveBlob(new Blob([item.svg], { type: "image/svg+xml" }), `${baseName(item.file.name)}-vector.svg`);
  };

  const downloadZip = async () => {
    const done = batchRef.current.filter((it) => it.status === "done" && it.svg);
    if (!done.length) return;
    setZipping(true);
    try {
      const used = new Map<string, number>();
      const entries = done.map((it) => {
        const base = `${baseName(it.file.name)}-vector`;
        const n = (used.get(base) || 0) + 1;
        used.set(base, n);
        return { name: n === 1 ? `${base}.svg` : `${base}-${n}.svg`, text: it.svg as string };
      });
      const blob = await makeZip(entries);
      saveBlob(blob, "vectorized-svgs.zip");
    } catch {
      toast.error("Could not make the ZIP file. Please try again, or download the files one by one.");
    } finally {
      setZipping(false);
    }
  };

  const selected = batch.find((it) => it.id === selectedId) || null;
  const selectedFile = selected?.file;
  const selSvgUrl = selected?.svgUrl || null;
  const selOrigUrl = useMemo(() => (selectedFile ? URL.createObjectURL(selectedFile) : null), [selectedFile]);
  useEffect(() => {
    return () => {
      if (selOrigUrl) URL.revokeObjectURL(selOrigUrl);
    };
  }, [selOrigUrl]);

  const [follow, setFollow] = useState(true);
  const workingId = batch.find((it) => it.status === "working")?.id ?? null;
  useEffect(() => {
    if (!follow || workingId === null) return;
    document.getElementById(`bi-${workingId}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [follow, workingId]);

  const moveSelected = (dir: 1 | -1) => {
    const list = batchRef.current;
    const i = list.findIndex((it) => it.id === selectedId);
    if (i < 0) return;
    const n = list[i + dir];
    if (n) setSelectedId(n.id);
  };
  useEffect(() => {
    if (selectedId === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedId(null);
      else if (e.key === "ArrowRight") moveSelected(1);
      else if (e.key === "ArrowLeft") moveSelected(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const doneCount = batch.filter((it) => it.status === "done").length;
  const errorCount = batch.filter((it) => it.status === "error").length;
  const waitingCount = batch.filter((it) => it.status === "waiting").length;
  const workingItem = batch.find((it) => it.status === "working") || null;
  const finishedCount = doneCount + errorCount;
  const msList = batch.filter((it) => it.status === "done" && it.ms).map((it) => it.ms as number);
  const avgMs = msList.length ? msList.reduce((a, b) => a + b, 0) / msList.length : 0;
  const leftCount = waitingCount + (workingItem ? 1 : 0);
  const etaMinutes = avgMs && leftCount ? Math.max(1, Math.round((avgMs * leftCount) / 60000)) : 0;

  const reset = () => {
    stopWorker();
    setBusy(false);
    setSource(null);
    clearResult();
    setError(null);
    setAutoPreset(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const download = () => {
    if (!svgUrl || !source) return;
    const a = document.createElement("a");
    a.href = svgUrl;
    a.download = `${baseName(source.file.name)}-vector.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const copySvg = async () => {
    if (!svgText) return;
    try {
      await navigator.clipboard.writeText(svgText);
      toast.success("SVG code copied.");
    } catch {
      toast.error("Could not copy. Please download the file instead.");
    }
  };

  const rangeClass = "w-full accent-[#D9560B]";

  const settingsFields = (isBatch: boolean) => (
    <>
              <div className="grid grid-cols-2 gap-1.5">
                {(["auto", "manual"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      mode === m
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background/50 text-muted-foreground border-border/60 hover:bg-accent"
                    }`}
                  >
                    {m === "auto" ? "Auto" : "Manual"}
                  </button>
                ))}
              </div>

              {mode === "auto" ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {isBatch
                      ? "Auto looks at each image and picks the best settings for it."
                      : "Auto looks at your image and picks the best settings. You can switch the style below."}
                  </p>
                  {!isBatch && autoPreset && (
                    <div className="rounded-xl bg-primary/10 border border-primary/20 p-3 text-xs">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-primary" /> Detected: {PRESET_INFO[autoPreset].label}
                      </div>
                      <div className="text-muted-foreground mt-0.5">{PRESET_INFO[autoPreset].hint}</div>
                    </div>
                  )}
                  <div className={isBatch ? "hidden" : "grid grid-cols-2 gap-1.5"}>
                    {(Object.keys(PRESET_INFO) as Preset[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setPreset(p);
                          if (source) void runVectorize(source, p);
                        }}
                        className={`px-2 py-2 rounded-xl text-[11px] font-semibold border transition-colors disabled:opacity-50 ${
                          preset === p
                            ? "bg-primary/15 text-primary border-primary/40"
                            : "bg-background/50 text-muted-foreground border-border/60 hover:bg-accent"
                        }`}
                      >
                        {PRESET_INFO[p].label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4 text-xs">
                  <label className="block space-y-1">
                    <span className="flex justify-between font-medium text-foreground">
                      Most colors to look for <span className="text-muted-foreground">{colors}</span>
                    </span>
                    <input type="range" min={2} max={64} step={1} value={colors} onChange={(e) => setColors(+e.target.value)} className={rangeClass} />
                  </label>
                  <label className="block space-y-1">
                    <span className="flex justify-between font-medium text-foreground">
                      Merge similar shades <span className="text-muted-foreground">{merge}</span>
                    </span>
                    <input type="range" min={0} max={40} step={1} value={merge} onChange={(e) => setMerge(+e.target.value)} className={rangeClass} />
                  </label>
                  <label className="block space-y-1">
                    <span className="flex justify-between font-medium text-foreground">
                      Curve detail <span className="text-muted-foreground">{detail}</span>
                    </span>
                    <input type="range" min={1} max={10} step={1} value={detail} onChange={(e) => setDetail(+e.target.value)} className={rangeClass} />
                  </label>
                  <label className="block space-y-1">
                    <span className="flex justify-between font-medium text-foreground">
                      Remove small specks <span className="text-muted-foreground">{noise}</span>
                    </span>
                    <input type="range" min={0} max={80} step={1} value={noise} onChange={(e) => setNoise(+e.target.value)} className={rangeClass} />
                  </label>
                  <label className="block space-y-1">
                    <span className="flex justify-between font-medium text-foreground">
                      Remove thin lines and halos <span className="text-muted-foreground">{thin}px</span>
                    </span>
                    <input type="range" min={0} max={8} step={1} value={thin} onChange={(e) => setThin(+e.target.value)} className={rangeClass} />
                  </label>
                  <label className="block space-y-1">
                    <span className="flex justify-between font-medium text-foreground">
                      Edge smoothing <span className="text-muted-foreground">{smooth}</span>
                    </span>
                    <input type="range" min={0} max={4} step={1} value={smooth} onChange={(e) => setSmooth(+e.target.value)} className={rangeClass} />
                  </label>
                  <label className="block space-y-1">
                    <span className="flex justify-between font-medium text-foreground">
                      Working size (long edge) <span className="text-muted-foreground">{maxEdge}px</span>
                    </span>
                    <input type="range" min={800} max={3000} step={100} value={maxEdge} onChange={(e) => setMaxEdge(+e.target.value)} className={rangeClass} />
                  </label>
                </div>
              )}

              <label className="flex items-center gap-2 text-xs font-medium text-foreground">
                <input type="checkbox" checked={transparentBg} onChange={(e) => setTransparentBg(e.target.checked)} />
                Transparent background (remove the outer background)
              </label>
    </>
  );


  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Image → SVG Vectorizer</h1>
        <p className="text-sm text-muted-foreground">
          Turn a logo, icon or illustration into a clean, scalable SVG. You can add one image or hundreds. It studies the colors first, so each image takes a few seconds. It runs in your browser. Your images are not uploaded and no credits are used.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {batch.length > 0 ? (
        <div className="space-y-6">
          <div className="glass-card rounded-2xl border border-border/50 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-foreground">{batch.length} images</div>
                <div className="text-xs text-muted-foreground">
                  {doneCount} done · {errorCount} failed · {leftCount} left
                  {batchRunning && etaMinutes > 0 ? ` · about ${etaMinutes} min to go` : ""}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {batchRunning ? (
                  <button
                    type="button"
                    onClick={stopBatch}
                    className="inline-flex items-center gap-2 rounded-xl bg-destructive text-white px-4 py-2 text-sm font-semibold hover:opacity-90"
                  >
                    <Square className="h-4 w-4" /> Stop
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={waitingCount === 0}
                    onClick={() => void startBatch()}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Play className="h-4 w-4" /> {finishedCount > 0 ? "Continue" : "Start vectorizing all"}
                  </button>
                )}
                <button
                  type="button"
                  disabled={doneCount === 0 || zipping}
                  onClick={() => void downloadZip()}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
                >
                  {zipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Download all (ZIP){doneCount > 0 ? ` · ${doneCount}` : ""}
                </button>
                {errorCount > 0 && !batchRunning && (
                  <button
                    type="button"
                    onClick={retryFailed}
                    className="inline-flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-xs font-semibold hover:bg-accent"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Retry failed
                  </button>
                )}
                <button
                  type="button"
                  disabled={batchRunning}
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-xs font-semibold hover:bg-accent disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" /> Add more
                </button>
                <button
                  type="button"
                  disabled={batchRunning}
                  onClick={clearBatch}
                  className="inline-flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-xs font-semibold hover:bg-accent disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Clear all
                </button>
              </div>
            </div>
            <div className="h-2 rounded-full bg-black/10 overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.round((finishedCount / batch.length) * 100)}%` }}
              />
            </div>
            {batchRunning && workingItem && (
              <p className="text-xs text-muted-foreground">
                Now: <span className="font-semibold text-foreground">{workingItem.file.name}</span>
                {batchProgress ? ` · ${batchProgress.message}` : ""}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Keep this tab open while it works. Images are done one by one, so your computer stays usable.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
            <div className="glass-card rounded-2xl border border-border/50 p-4 space-y-4 self-start">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <SlidersHorizontal className="h-3.5 w-3.5" /> Settings for all images
              </div>
              <fieldset disabled={batchRunning} className="min-w-0 border-0 p-0 m-0 space-y-4">
                {settingsFields(true)}
              </fieldset>
            </div>

            <div className="space-y-3 min-w-0">
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>Click any picture to see it large next to the original.</span>
                <label className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
                  Follow progress
                </label>
              </div>
              <div className="glass-card rounded-2xl border border-border/50 p-3 max-h-[75vh] overflow-auto">
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {batch.map((it) => (
                    <div
                      key={it.id}
                      id={`bi-${it.id}`}
                      onClick={() => setSelectedId(it.id)}
                      className={`group relative cursor-pointer rounded-xl border overflow-hidden ${
                        it.status === "working" ? "border-primary ring-2 ring-primary/30" : "border-border/50"
                      }`}
                    >
                      <div className="relative aspect-square flex items-center justify-center" style={checkerStyle}>
                        {it.status === "done" && it.svgUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={it.svgUrl}
                            alt={it.file.name}
                            loading="lazy"
                            decoding="async"
                            className="max-h-full max-w-full object-contain"
                          />
                        )}
                        {it.status === "working" && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/85 text-[11px] font-semibold text-foreground text-center px-2">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            {batchProgress ? batchProgress.message : "Working..."}
                            {batchProgress && (
                              <div className="w-3/4 h-1.5 rounded-full bg-black/10 overflow-hidden">
                                <div className="h-full bg-primary" style={{ width: `${Math.round(batchProgress.fraction * 100)}%` }} />
                              </div>
                            )}
                          </div>
                        )}
                        {it.status === "waiting" && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-white/85 text-[11px] text-muted-foreground">
                            <Clock className="h-5 w-5" /> Waiting
                          </div>
                        )}
                        {it.status === "error" && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-white/90 text-[11px] text-destructive text-center px-2">
                            <AlertCircle className="h-5 w-5" /> {it.error || "Failed"}
                          </div>
                        )}
                        {it.status === "done" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadItem(it);
                            }}
                            className="absolute top-1.5 right-1.5 h-7 w-7 rounded-lg bg-white/90 border border-border/60 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-white"
                            aria-label="Download this SVG"
                          >
                            <Download className="h-3.5 w-3.5 text-foreground" />
                          </button>
                        )}
                        {it.status === "done" && (
                          <CheckCircle2 className="absolute top-1.5 left-1.5 h-4 w-4 text-emerald-600 bg-white rounded-full" />
                        )}
                      </div>
                      <div className="px-2 py-1.5 bg-card/80">
                        <div className="truncate text-[11px] font-medium text-foreground">{it.file.name}</div>
                        <div className="truncate text-[10px] text-muted-foreground">
                          {it.status === "done" ? `${it.paths} shapes · ${((it.ms || 0) / 1000).toFixed(1)}s` : it.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selected && (
                <div
                  className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
                  onClick={() => setSelectedId(null)}
                >
                  <div
                    className="w-full max-w-4xl rounded-2xl bg-card border border-border/50 p-4 space-y-3 max-h-[95vh] overflow-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground truncate">{selected.file.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {selected.status === "done"
                            ? `${selected.preset ? PRESET_INFO[selected.preset].label + " · " : ""}${selected.paths} shapes · ${formatBytes(
                                new Blob([selected.svg || ""]).size
                              )}`
                            : selected.status}
                          {" · use the arrow keys to move, Esc to close"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => moveSelected(-1)}
                          className="h-8 px-3 rounded-lg border border-border/60 text-xs font-semibold hover:bg-accent"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSelected(1)}
                          className="h-8 px-3 rounded-lg border border-border/60 text-xs font-semibold hover:bg-accent"
                        >
                          Next
                        </button>
                        {selected.status === "done" && (
                          <button
                            type="button"
                            onClick={() => downloadItem(selected)}
                            className="h-8 inline-flex items-center gap-1.5 px-3 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500"
                          >
                            <Download className="h-3.5 w-3.5" /> Download
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedId(null)}
                          className="h-8 w-8 rounded-lg border border-border/60 flex items-center justify-center hover:bg-accent"
                          aria-label="Close"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Original</div>
                        <div className="rounded-xl overflow-hidden border border-border/50 aspect-square flex items-center justify-center bg-white">
                          {selOrigUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={selOrigUrl} alt="Original" className="max-h-full max-w-full object-contain" />
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">SVG result</div>
                        <div
                          className="rounded-xl overflow-hidden border border-border/50 aspect-square flex items-center justify-center"
                          style={checkerStyle}
                        >
                          {selSvgUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={selSvgUrl} alt="SVG result" className="max-h-full max-w-full object-contain" />
                          ) : (
                            <span className="text-xs text-muted-foreground bg-white/80 rounded-lg px-3 py-2">
                              {selected.status === "error" ? selected.error || "Failed" : "Not done yet"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : !source ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
            dragging ? "border-primary bg-primary/5" : "border-border/60 bg-card/60 hover:bg-accent/40"
          }`}
        >
          <Upload className="h-8 w-8 mx-auto text-primary" />
          <p className="mt-3 text-sm font-semibold text-foreground">
            Drag and drop images, or <span className="underline">browse</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            JPG, PNG or WebP. Up to {MAX_FILE_MB} MB each. Choose many at once for a bulk batch (up to {MAX_BATCH}).
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* Controls */}
          <div className="space-y-4">
            <div className="glass-card rounded-2xl border border-border/50 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-foreground truncate">{source.file.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {source.width} × {source.height} px · {formatBytes(source.file.size)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={reset}
                  className="shrink-0 h-8 w-8 rounded-lg border border-border/60 flex items-center justify-center hover:bg-accent"
                  aria-label="Remove image"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="glass-card rounded-2xl border border-border/50 p-4 space-y-4">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <SlidersHorizontal className="h-3.5 w-3.5" /> Tracing controls
              </div>

              {settingsFields(false)}

              <button
                type="button"
                disabled={busy}
                onClick={() => source && void runVectorize(source)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {busy ? "Analyzing deeply..." : "Vectorize again"}
              </button>
            </div>

            <div className="glass-card rounded-2xl border border-border/50 p-4 space-y-2">
              <button
                type="button"
                disabled={!svgUrl}
                onClick={download}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
              >
                <Download className="h-4 w-4" /> Download SVG
              </button>
              <button
                type="button"
                disabled={!svgText}
                onClick={copySvg}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border/60 px-4 py-2 text-xs font-semibold hover:bg-accent disabled:opacity-50"
              >
                <Copy className="h-3.5 w-3.5" /> Copy SVG code
              </button>
              {stats && (
                <p className="text-[11px] text-muted-foreground text-center">
                  {stats.paths} shapes · {formatBytes(stats.bytes)} · {(stats.ms / 1000).toFixed(1)}s
                </p>
              )}
            </div>
          </div>

          {/* Preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass-card rounded-2xl border border-border/50 p-4 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Original</div>
              <div className="rounded-xl overflow-hidden border border-border/50 aspect-square flex items-center justify-center bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={source.url} alt="Original" className="max-h-full max-w-full object-contain" />
              </div>
            </div>
            <div className="glass-card rounded-2xl border border-border/50 p-4 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">SVG result</div>
              <div
                className="relative rounded-xl overflow-hidden border border-border/50 aspect-square flex items-center justify-center"
                style={checkerStyle}
              >
                {busy && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/80 text-xs font-semibold text-foreground">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" /> {progress ? progress.message : "Tracing your image..."}
                    {progress && (
                      <div className="w-40 h-1.5 rounded-full bg-black/10 overflow-hidden">
                        <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
                      </div>
                    )}
                  </div>
                )}
                {svgUrl && !busy && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={svgUrl} alt="SVG result" className="max-h-full max-w-full object-contain" />
                )}
                {error && !busy && (
                  <div className="p-4 text-center text-xs text-destructive flex flex-col items-center gap-2 bg-white/90 rounded-xl m-4">
                    <AlertCircle className="h-5 w-5" /> {error}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Guide */}
      <div className="glass-card rounded-2xl border border-border/50 p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Info className="h-4 w-4 text-primary" /> What works best
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
          <div className="space-y-1">
            <div className="font-semibold text-emerald-600">Good inputs</div>
            <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
              <li>Logos, icons and flat illustrations</li>
              <li>Black and white line art</li>
              <li>Sharp images with clear edges and few colors</li>
            </ul>
          </div>
          <div className="space-y-1">
            <div className="font-semibold text-amber-600">Poor inputs</div>
            <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
              <li>Photos and soft gradients (the file becomes large and messy)</li>
              <li>Blurry or tiny images</li>
              <li>Scanned text and very dense designs</li>
            </ul>
          </div>
        </div>
        <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-0.5">
          <li>Too many shapes? Lower the colors, or raise &quot;Remove small specks&quot;.</li>
          <li>Edges look rough? Raise &quot;Edge smoothing&quot;. Lost a tiny detail? Lower it, or lower &quot;Remove small specks&quot;.</li><li>Shades of one color split into patches? Raise &quot;Merge similar shades&quot;. Want the shading? Choose &quot;Detailed&quot;.</li><li>A thin outline or halo you want to keep? Lower &quot;Remove thin lines and halos&quot;.</li>
          <li>Want a see-through background? Keep &quot;Transparent background&quot; ticked. Turn it off to keep the white.</li>
          <li>Always check the SVG before you sell it, and only trace images you have the right to use.</li>
        </ul>
      </div>
    </div>
  );
}
