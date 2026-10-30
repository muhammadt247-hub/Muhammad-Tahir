"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Upload,
  Download,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
  Sliders,
  Maximize2,
  ArrowRight,
  Edit3,
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Eye,
  Check,
  Copy,
} from "lucide-react";

const MAX_FILES = 50;
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/avif",
  "image/svg+xml",
];

type OutputFormat = "image/jpeg" | "image/png" | "image/webp";
type ResizeMode = "original" | "longEdge" | "percent" | "custom";
type FitMode = "cover" | "stretch";
type Status = "waiting" | "processing" | "done" | "failed";

export interface ImageEdits {
  brightness: number; // -100 to 100, default 0
  contrast: number; // -100 to 100, default 0
  saturation: number; // -100 to 100, default 0
  warmth: number; // -100 to 100, default 0
  sharpness: number; // -100 to 100, default 0
  rotation: number; // 0, 90, 180, 270
  flipH: boolean;
  flipV: boolean;
}

const defaultEdits: ImageEdits = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  sharpness: 0,
  rotation: 0,
  flipH: false,
  flipV: false,
};

interface ImageItem {
  id: string;
  file: File;
  name: string;
  originalUrl: string;
  origW: number;
  origH: number;
  status: Status;
  edits: ImageEdits;
  resultBlob?: Blob;
  resultUrl?: string;
  newW?: number;
  newH?: number;
  newSize?: number;
  error?: string;
  doneKey?: string;
}

const checkerStyle: React.CSSProperties = {
  background: "repeating-conic-gradient(#d4d4d4 0% 25%, #ffffff 0% 50%) 50% / 12px 12px",
};

function saveBlob(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function baseName(name: string) {
  return name.replace(/\.[^/.]+$/, "").replace(/[^\w.\- ]+/g, "_") || "image";
}

function getExtension(format: OutputFormat) {
  if (format === "image/jpeg") return "jpg";
  if (format === "image/webp") return "webp";
  return "png";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function loadImage(file: File): Promise<{ img: HTMLImageElement; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      URL.revokeObjectURL(url);
      resolve({ img, width, height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image."));
    };
    img.src = url;
  });
}

function applyConvolution(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  weights: number[]
) {
  const src = ctx.getImageData(0, 0, w, h);
  const dst = ctx.createImageData(w, h);
  const srcData = src.data;
  const dstData = dst.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dstI = (y * w + x) * 4;
      let r = 0, g = 0, b = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const px = Math.min(w - 1, Math.max(0, x + kx));
          const py = Math.min(h - 1, Math.max(0, y + ky));
          const srcI = (py * w + px) * 4;
          const weight = weights[(ky + 1) * 3 + (kx + 1)];
          r += srcData[srcI] * weight;
          g += srcData[srcI + 1] * weight;
          b += srcData[srcI + 2] * weight;
        }
      }

      dstData[dstI] = Math.max(0, Math.min(255, r));
      dstData[dstI + 1] = Math.max(0, Math.min(255, g));
      dstData[dstI + 2] = Math.max(0, Math.min(255, b));
      dstData[dstI + 3] = srcData[dstI + 3];
    }
  }
  ctx.putImageData(dst, 0, 0);
}

// Shared editing function used for both live preview and final export
async function renderImageWithEdits(
  file: File,
  edits: ImageEdits,
  maxLongEdge?: number
): Promise<HTMLCanvasElement> {
  const { img, width: ow, height: oh } = await loadImage(file);

  let w = ow;
  let h = oh;
  if (maxLongEdge) {
    const maxDim = Math.max(ow, oh);
    if (maxDim > maxLongEdge) {
      if (ow >= oh) {
        w = maxLongEdge;
        h = Math.round(oh * (maxLongEdge / ow));
      } else {
        h = maxLongEdge;
        w = Math.round(ow * (maxLongEdge / oh));
      }
    }
  }

  const rot = (edits.rotation % 360 + 360) % 360;
  const isSwapped = rot === 90 || rot === 270;
  const canvasW = isSwapped ? h : w;
  const canvasH = isSwapped ? w : h;

  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas context not supported");

  ctx.save();
  ctx.translate(canvasW / 2, canvasH / 2);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.scale(edits.flipH ? -1 : 1, edits.flipV ? -1 : 1);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();

  const hasEdits =
    edits.brightness !== 0 ||
    edits.contrast !== 0 ||
    edits.saturation !== 0 ||
    edits.warmth !== 0 ||
    edits.sharpness !== 0;

  if (!hasEdits) {
    return canvas;
  }

  const imgData = ctx.getImageData(0, 0, canvasW, canvasH);
  const data = imgData.data;

  const b = edits.brightness * 2.5;
  const c = edits.contrast;
  const contrastFactor = (259 * (c + 255)) / (255 * (259 - c));
  const s = edits.saturation / 100;
  const wArm = edits.warmth;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let bl = data[i + 2];

    if (b !== 0) {
      r += b;
      g += b;
      bl += b;
    }

    if (c !== 0) {
      r = contrastFactor * (r - 128) + 128;
      g = contrastFactor * (g - 128) + 128;
      bl = contrastFactor * (bl - 128) + 128;
    }

    if (s !== 0) {
      const avg = 0.299 * r + 0.587 * g + 0.114 * bl;
      r = avg + (r - avg) * (1 + s);
      g = avg + (g - avg) * (1 + s);
      bl = avg + (bl - avg) * (1 + s);
    }

    if (wArm !== 0) {
      r += wArm * 0.5;
      bl -= wArm * 0.5;
    }

    data[i] = Math.max(0, Math.min(255, r));
    data[i + 1] = Math.max(0, Math.min(255, g));
    data[i + 2] = Math.max(0, Math.min(255, bl));
  }

  ctx.putImageData(imgData, 0, 0);

  if (edits.sharpness !== 0) {
    const sharpAmt = (edits.sharpness / 100) * 1.5;
    const weights = [
      0, -sharpAmt, 0,
      -sharpAmt, 1 + 4 * sharpAmt, -sharpAmt,
      0, -sharpAmt, 0,
    ];
    applyConvolution(ctx, canvasW, canvasH, weights);
  }

  return canvas;
}

export default function ImageConverterPage() {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [format, setFormat] = useState<OutputFormat>("image/jpeg");
  const [quality, setQuality] = useState<number>(85);
  const [bgColor, setBgColor] = useState<string>("#ffffff");
  const [resizeMode, setResizeMode] = useState<ResizeMode>("original");
  const [longEdge, setLongEdge] = useState<number>(1200);
  const [percent, setPercent] = useState<number>(100);
  const [customW, setCustomW] = useState<number>(800);
  const [customH, setCustomH] = useState<number>(600);
  const [customFit, setCustomFit] = useState<FitMode>("cover");

  const [running, setRunning] = useState<boolean>(false);
  const [dragging, setDragging] = useState<boolean>(false);
  const [notice, setNotice] = useState<string>("");
  const [zipping, setZipping] = useState<boolean>(false);
  const [zipProgress, setZipProgress] = useState<number>(0);
  const [zipError, setZipError] = useState<string>("");

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<ImageItem | null>(null);
  const [modalEdits, setModalEdits] = useState<ImageEdits>(defaultEdits);
  const [showOriginal, setShowOriginal] = useState<boolean>(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);

  const itemsRef = useRef<ImageItem[]>([]);
  const cancelRef = useRef<boolean>(false);
  const zipLock = useRef<boolean>(false);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    return () => {
      cancelRef.current = true;
      itemsRef.current.forEach((i) => {
        URL.revokeObjectURL(i.originalUrl);
        if (i.resultUrl) URL.revokeObjectURL(i.resultUrl);
      });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, []);

  // Update live preview in dialog when modalEdits or showOriginal changes
  useEffect(() => {
    if (!editingItem) return;
    let active = true;
    setPreviewLoading(true);

    const editsToUse = showOriginal ? defaultEdits : modalEdits;
    renderImageWithEdits(editingItem.file, editsToUse, 1200)
      .then((canvas) => {
        canvas.toBlob((blob) => {
          if (!active || !blob) return;
          const url = URL.createObjectURL(blob);
          setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return url;
          });
          setPreviewLoading(false);
        }, "image/png");
      })
      .catch(() => {
        if (active) setPreviewLoading(false);
      });

    return () => {
      active = false;
    };
  }, [editingItem, modalEdits, showOriginal]);

  const settingsKey = `${format}|${quality}|${bgColor}|${resizeMode}|${longEdge}|${percent}|${customW}|${customH}|${customFit}`;
  const hasAnyEdits = items.some((i) => JSON.stringify(i.edits) !== JSON.stringify(defaultEdits));

  function applyEditsToAll() {
    const editedOne = items.find((i) => JSON.stringify(i.edits) !== JSON.stringify(defaultEdits));
    if (!editedOne) return;
    const targetEdits = editedOne.edits;
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        edits: { ...targetEdits },
      }))
    );
    setNotice("Applied edits from one image to all images.");
  }

  async function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const incoming = Array.from(list);
    const valid = incoming.filter(
      (f) =>
        ALLOWED_TYPES.includes(f.type) ||
        /\.(jpe?g|png|webp|gif|bmp|avif|svg)$/i.test(f.name)
    );
    const skipped = incoming.length - valid.length;
    const room = MAX_FILES - itemsRef.current.length;
    const accepted = valid.slice(0, Math.max(0, room));
    const tooMany = valid.length - accepted.length;

    const msgs: string[] = [];
    if (skipped > 0) msgs.push(`${skipped} file(s) skipped (unsupported format).`);
    if (tooMany > 0) msgs.push(`${tooMany} file(s) skipped (maximum is ${MAX_FILES} files).`);
    setNotice(msgs.join(" "));

    if (accepted.length === 0) return;

    const newItems: ImageItem[] = [];
    for (const file of accepted) {
      try {
        const { width, height } = await loadImage(file);
        newItems.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          file,
          name: file.name,
          originalUrl: URL.createObjectURL(file),
          origW: width,
          origH: height,
          status: "waiting",
          edits: { ...defaultEdits },
        });
      } catch {
        newItems.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          file,
          name: file.name,
          originalUrl: URL.createObjectURL(file),
          origW: 0,
          origH: 0,
          status: "waiting",
          edits: { ...defaultEdits },
        });
      }
    }

    setItems((prev) => [...prev, ...newItems]);
  }

  function updateItem(id: string, patch: Partial<ImageItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function removeItem(id: string) {
    const it = itemsRef.current.find((i) => i.id === id);
    if (!it || it.status === "processing") return;
    URL.revokeObjectURL(it.originalUrl);
    if (it.resultUrl) URL.revokeObjectURL(it.resultUrl);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function clearAll() {
    cancelRef.current = true;
    itemsRef.current.forEach((i) => {
      URL.revokeObjectURL(i.originalUrl);
      if (i.resultUrl) URL.revokeObjectURL(i.resultUrl);
    });
    setItems([]);
    setNotice("");
    setZipError("");
    setRunning(false);
  }

  async function startConversion() {
    if (running) return;
    const queue = itemsRef.current.filter(
      (i) => i.status !== "processing" && (i.status !== "done" || i.doneKey !== settingsKey)
    );
    if (queue.length === 0) return;

    cancelRef.current = false;
    setRunning(true);
    setNotice("");

    try {
      for (const item of queue) {
        if (cancelRef.current) break;
        updateItem(item.id, { status: "processing", error: undefined });

        try {
          // 1. Apply edits first at full size using shared function
          const editedCanvas = await renderImageWithEdits(item.file, item.edits);
          const ow = editedCanvas.width;
          const oh = editedCanvas.height;

          let nw = ow;
          let nh = oh;

          if (resizeMode === "longEdge") {
            const maxDim = Math.max(ow, oh);
            if (maxDim > longEdge) {
              if (ow >= oh) {
                nw = longEdge;
                nh = Math.round(oh * (longEdge / ow));
              } else {
                nh = longEdge;
                nw = Math.round(ow * (longEdge / oh));
              }
            }
          } else if (resizeMode === "percent") {
            const scale = percent / 100;
            nw = Math.round(ow * scale);
            nh = Math.round(oh * scale);
          } else if (resizeMode === "custom") {
            nw = customW;
            nh = customH;
          }

          const canvas = document.createElement("canvas");
          if (resizeMode === "custom" && customFit === "cover") {
            canvas.width = customW;
            canvas.height = customH;
          } else {
            canvas.width = Math.max(1, nw);
            canvas.height = Math.max(1, nh);
          }

          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) throw new Error("Canvas context is not supported.");

          if (format === "image/jpeg") {
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }

          if (resizeMode === "custom" && customFit === "cover") {
            const scale = Math.max(customW / ow, customH / oh);
            const sw = ow * scale;
            const sh = oh * scale;
            const ox = (customW - sw) / 2;
            const oy = (customH - sh) / 2;
            ctx.drawImage(editedCanvas, ox, oy, sw, sh);
          } else {
            ctx.drawImage(editedCanvas, 0, 0, canvas.width, canvas.height);
          }

          const qualityParam = format === "image/png" ? undefined : quality / 100;

          const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
              (b) => (b ? resolve(b) : reject(new Error("Conversion failed."))),
              format,
              qualityParam
            );
          });

          if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
          updateItem(item.id, {
            status: "done",
            resultBlob: blob,
            resultUrl: URL.createObjectURL(blob),
            newW: canvas.width,
            newH: canvas.height,
            newSize: blob.size,
            doneKey: settingsKey,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Conversion failed.";
          updateItem(item.id, { status: "failed", error: msg });
        }
        await new Promise((r) => setTimeout(r, 20));
      }
    } finally {
      setRunning(false);
    }
  }

  async function downloadAll() {
    if (zipLock.current) return;
    const done = itemsRef.current.filter((i) => i.status === "done" && i.resultBlob);
    if (done.length === 0) return;

    zipLock.current = true;
    setZipping(true);
    setZipError("");
    setZipProgress(0);

    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const usedNames = new Set<string>();
      const ext = getExtension(format);

      for (const it of done) {
        const base = baseName(it.name);
        let fname = `${base}-converted.${ext}`;
        let k = 2;
        while (usedNames.has(fname.toLowerCase())) {
          fname = `${base}-converted-${k++}.${ext}`;
        }
        usedNames.add(fname.toLowerCase());
        zip.file(fname, it.resultBlob as Blob);
      }

      const zipBlob = await zip.generateAsync(
        { type: "blob", compression: "STORE" },
        (meta) => setZipProgress(Math.round(meta.percent))
      );
      const url = URL.createObjectURL(zipBlob);
      saveBlob(url, `orbinexa-converted-images.zip`);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      setZipError("Could not create ZIP file. Please try again.");
    } finally {
      zipLock.current = false;
      setZipping(false);
    }
  }

  const total = items.length;
  const doneCount = items.filter((i) => i.status === "done").length;
  const failedCount = items.filter((i) => i.status === "failed").length;
  const finished = doneCount + failedCount;
  const percentProgress = total ? Math.round((finished / total) * 100) : 0;
  const outdated = items.filter((i) => i.status === "done" && i.doneKey !== settingsKey).length;

  const pillBtn = (active: boolean) =>
    `px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
      active
        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
        : "bg-muted text-muted-foreground hover:text-foreground hover:bg-accent border border-border/60"
    }`;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 px-4 sm:px-0">
      {/* Title & description */}
      <div className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          Image Converter
        </h1>
        <div className="w-12 h-1 bg-gradient-to-r from-orange-600 to-amber-500 rounded-full" />
        <p className="text-sm sm:text-base text-muted-foreground">
          Your images stay on your computer. Nothing is uploaded.
        </p>
      </div>

      {/* Settings Card */}
      <div className="glass-card rounded-2xl p-5 sm:p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-foreground font-semibold text-base">
            <Sliders className="h-5 w-5 text-primary" />
            <h2>Conversion &amp; Resize Settings</h2>
          </div>

          {hasAnyEdits && (
            <button
              type="button"
              onClick={applyEditsToAll}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/20 cursor-pointer"
            >
              <Copy className="h-3.5 w-3.5" />
              Apply the same edits to all images
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Format selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Output Format
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={pillBtn(format === "image/jpeg")}
                onClick={() => setFormat("image/jpeg")}
              >
                JPG
              </button>
              <button
                type="button"
                className={pillBtn(format === "image/png")}
                onClick={() => setFormat("image/png")}
              >
                PNG
              </button>
              <button
                type="button"
                className={pillBtn(format === "image/webp")}
                onClick={() => setFormat("image/webp")}
              >
                WebP
              </button>
            </div>
          </div>

          {/* Quality slider (hidden for PNG) */}
          {format !== "image/png" && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-muted-foreground uppercase tracking-wider">
                  Quality
                </span>
                <span className="font-bold text-foreground">{quality}%</span>
              </div>
              <input
                type="range"
                min={40}
                max={100}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer h-2 bg-muted rounded-lg"
              />
            </div>
          )}

          {/* Background color picker for JPG */}
          {format === "image/jpeg" && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Transparent BG Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="h-9 w-12 rounded-lg border border-border bg-card cursor-pointer p-1"
                />
                <span className="text-xs font-mono text-muted-foreground">{bgColor}</span>
              </div>
            </div>
          )}
        </div>

        {/* Resize mode */}
        <div className="space-y-3 pt-3 border-t border-border/40">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            Resize Mode
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={pillBtn(resizeMode === "original")}
              onClick={() => setResizeMode("original")}
            >
              Original size
            </button>
            <button
              type="button"
              className={pillBtn(resizeMode === "longEdge")}
              onClick={() => setResizeMode("longEdge")}
            >
              Long edge
            </button>
            <button
              type="button"
              className={pillBtn(resizeMode === "percent")}
              onClick={() => setResizeMode("percent")}
            >
              Percent
            </button>
            <button
              type="button"
              className={pillBtn(resizeMode === "custom")}
              onClick={() => setResizeMode("custom")}
            >
              Custom W x H
            </button>
          </div>

          {resizeMode === "longEdge" && (
            <div className="flex items-center gap-3 pt-2 max-w-xs">
              <label className="text-xs text-muted-foreground shrink-0">Max long edge (px):</label>
              <input
                type="number"
                min={100}
                max={10000}
                value={longEdge}
                onChange={(e) => setLongEdge(Math.max(50, Number(e.target.value)))}
                className="w-full px-3 py-1.5 text-sm rounded-xl border border-border bg-card text-foreground"
              />
            </div>
          )}

          {resizeMode === "percent" && (
            <div className="space-y-1.5 pt-2 max-w-sm">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Scale factor:</span>
                <span className="font-bold text-foreground">{percent}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={200}
                value={percent}
                onChange={(e) => setPercent(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer h-2 bg-muted rounded-lg"
              />
              <p className="text-[11px] text-muted-foreground">
                Values above 100% will upscale the image.
              </p>
            </div>
          )}

          {resizeMode === "custom" && (
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Width:</label>
                <input
                  type="number"
                  min={50}
                  max={10000}
                  value={customW}
                  onChange={(e) => setCustomW(Math.max(10, Number(e.target.value)))}
                  className="w-24 px-3 py-1.5 text-sm rounded-xl border border-border bg-card text-foreground"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Height:</label>
                <input
                  type="number"
                  min={50}
                  max={10000}
                  value={customH}
                  onChange={(e) => setCustomH(Math.max(10, Number(e.target.value)))}
                  className="w-24 px-3 py-1.5 text-sm rounded-xl border border-border bg-card text-foreground"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Fit:</label>
                <select
                  value={customFit}
                  onChange={(e) => setCustomFit(e.target.value as FitMode)}
                  className="px-3 py-1.5 text-sm rounded-xl border border-border bg-card text-foreground"
                >
                  <option value="cover">Cover (crop)</option>
                  <option value="stretch">Stretch</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Drop zone */}
      <label
        className={
          "dropzone-static flex flex-col items-center justify-center text-center rounded-2xl border-2 border-dashed border-border bg-card px-6 py-12 cursor-pointer transition-colors " +
          (dragging ? "border-primary bg-primary/5" : "hover:border-primary/50")
        }
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
      >
        <input
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Upload className="h-9 w-9 text-primary mb-3 animate-bounce" />
        <p className="text-base font-semibold text-foreground">
          Drag &amp; drop images, or <span className="underline underline-offset-4 text-primary">browse</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1.5">
          Accepts JPG, PNG, WebP, GIF, BMP, AVIF, SVG. Up to {MAX_FILES} files.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Your images stay on your computer. Nothing is uploaded.
        </p>
      </label>

      {notice && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground">
          {notice}
        </div>
      )}

      {/* Action status & controls toolbar */}
      {total > 0 && (
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {finished} of {total} processed ({doneCount} done, {failedCount} failed)
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Output format: <span className="uppercase font-bold text-primary">{getExtension(format)}</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {running ? (
                <button
                  type="button"
                  onClick={() => {
                    cancelRef.current = true;
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-md shadow-primary/20 cursor-pointer"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Stop
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startConversion}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-md shadow-primary/20 cursor-pointer hover:bg-primary/90 transition-all"
                >
                  Convert images
                </button>
              )}

              <button
                type="button"
                onClick={downloadAll}
                disabled={doneCount === 0 || zipping}
                className="inline-flex items-center gap-2 rounded-xl border border-primary px-4 py-2 text-sm font-medium text-primary disabled:opacity-50 hover:bg-primary/5 cursor-pointer transition-all"
              >
                {zipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {zipping ? `Zipping ${zipProgress}%` : `Download All ZIP (${doneCount})`}
              </button>

              <button
                type="button"
                onClick={clearAll}
                disabled={running}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent cursor-pointer transition-all disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Clear all
              </button>
            </div>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${percentProgress}%` }}
            />
          </div>

          {outdated > 0 && !running && (
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              {outdated} image(s) have outdated settings. Click &quot;Convert images&quot; to re-render them.
            </p>
          )}
          {zipError && <p className="text-xs text-red-600">{zipError}</p>}
        </div>
      )}

      {/* Thumbnail grid */}
      {total > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => {
            const hasChangedSettings = item.status === "done" && item.doneKey !== settingsKey;
            const diff = item.newSize !== undefined ? item.file.size - item.newSize : 0;
            const pctChange = item.newSize !== undefined ? Math.abs(Math.round((diff / item.file.size) * 100)) : 0;
            const isSaved = diff >= 0;
            const isEdited = JSON.stringify(item.edits) !== JSON.stringify(defaultEdits);

            return (
              <div
                key={item.id}
                className="relative glass-card rounded-2xl p-4 flex flex-col justify-between space-y-3"
              >
                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  disabled={item.status === "processing"}
                  className="absolute right-3 top-3 z-10 rounded-full bg-card/90 p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40 shadow-sm border border-border/40 cursor-pointer"
                  aria-label="Remove image"
                >
                  <X className="h-4 w-4" />
                </button>

                {/* Previews */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Original
                    </span>
                    <div className="overflow-hidden rounded-xl bg-muted aspect-square flex items-center justify-center border border-border/40" style={checkerStyle}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.originalUrl}
                        alt={item.name}
                        className="max-h-full max-w-full object-contain p-1"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {item.origW}×{item.origH} · {formatBytes(item.file.size)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Converted ({getExtension(format).toUpperCase()})
                    </span>
                    <div className="overflow-hidden rounded-xl aspect-square flex items-center justify-center border border-border/40" style={checkerStyle}>
                      {item.resultUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.resultUrl}
                          alt={`${item.name} converted`}
                          className="max-h-full max-w-full object-contain p-1"
                        />
                      ) : item.status === "processing" ? (
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Ready</span>
                      )}
                    </div>
                    {item.newW && item.newH && item.newSize !== undefined ? (
                      <p className="text-[11px] text-muted-foreground truncate">
                        {item.newW}×{item.newH} · {formatBytes(item.newSize)}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground truncate">-</p>
                    )}
                  </div>
                </div>

                {/* File name & status */}
                <div className="space-y-1.5 pt-2 border-t border-border/40">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate" title={item.name}>
                        {item.name}
                      </p>
                      {isEdited && (
                        <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                          Edited
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-[11px] flex items-center gap-1 font-medium">
                      {item.status === "waiting" && (
                        <span className="text-muted-foreground inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> Waiting
                        </span>
                      )}
                      {item.status === "processing" && (
                        <span className="text-primary inline-flex items-center gap-1">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Converting
                        </span>
                      )}
                      {item.status === "done" && !hasChangedSettings && (
                        <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Done ({isSaved ? `Saved ${pctChange}%` : `Grown ${pctChange}%`})
                        </span>
                      )}
                      {hasChangedSettings && (
                        <span className="text-amber-600 dark:text-amber-400">Outdated</span>
                      )}
                      {item.status === "failed" && (
                        <span className="text-red-600 inline-flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5" /> Failed
                        </span>
                      )}
                    </span>
                  </div>

                  {item.error && <p className="text-[11px] text-red-600">{item.error}</p>}
                </div>

                {/* Action buttons (Edit & Download) */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingItem(item);
                      setModalEdits({ ...item.edits });
                      setShowOriginal(false);
                    }}
                    disabled={item.status === "processing"}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-accent transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-primary" />
                    Edit
                  </button>

                  {item.status === "done" && item.resultUrl && !hasChangedSettings && (
                    <button
                      type="button"
                      onClick={() =>
                        saveBlob(
                          item.resultUrl as string,
                          `${baseName(item.name)}-converted.${getExtension(format)}`
                        )
                      }
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-all cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal Dialog */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-card w-full max-w-4xl rounded-3xl p-6 sm:p-8 space-y-6 bg-card border border-border shadow-2xl relative my-auto">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">Edit Image</h2>
                <p className="text-xs text-muted-foreground truncate max-w-md">
                  {editingItem.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Live Preview */}
              <div className="lg:col-span-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {showOriginal ? "Original Preview" : "Live Preview"}
                  </span>
                  <button
                    type="button"
                    onMouseDown={() => setShowOriginal(true)}
                    onMouseUp={() => setShowOriginal(false)}
                    onMouseLeave={() => setShowOriginal(false)}
                    onTouchStart={() => setShowOriginal(true)}
                    onTouchEnd={() => setShowOriginal(false)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-muted text-foreground hover:bg-accent transition-colors select-none cursor-pointer"
                    title="Hold to compare original"
                  >
                    <Eye className="h-3.5 w-3.5 text-primary" />
                    Hold to compare
                  </button>
                </div>

                <div
                  className="w-full aspect-square rounded-2xl overflow-hidden border border-border/60 flex items-center justify-center relative shadow-inner"
                  style={checkerStyle}
                >
                  {previewLoading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  ) : previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : null}
                </div>
              </div>

              {/* Right Column: Controls */}
              <div className="lg:col-span-6 space-y-5 max-h-[60vh] overflow-y-auto pr-1">
                {/* Transform buttons */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Rotate &amp; Flip
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setModalEdits((prev) => ({
                          ...prev,
                          rotation: (prev.rotation - 90) % 360,
                        }))
                      }
                      className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-muted/60 hover:bg-muted text-foreground text-xs font-medium border border-border/60 cursor-pointer transition-colors"
                    >
                      <RotateCcw className="h-4 w-4 text-primary" />
                      <span>Rotate L</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setModalEdits((prev) => ({
                          ...prev,
                          rotation: (prev.rotation + 90) % 360,
                        }))
                      }
                      className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-muted/60 hover:bg-muted text-foreground text-xs font-medium border border-border/60 cursor-pointer transition-colors"
                    >
                      <RotateCw className="h-4 w-4 text-primary" />
                      <span>Rotate R</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setModalEdits((prev) => ({ ...prev, flipH: !prev.flipH }))
                      }
                      className={
                        "flex flex-col items-center justify-center gap-1 p-2 rounded-xl text-xs font-medium border cursor-pointer transition-colors " +
                        (modalEdits.flipH
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/60 hover:bg-muted text-foreground border-border/60")
                      }
                    >
                      <FlipHorizontal className="h-4 w-4" />
                      <span>Flip H</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setModalEdits((prev) => ({ ...prev, flipV: !prev.flipV }))
                      }
                      className={
                        "flex flex-col items-center justify-center gap-1 p-2 rounded-xl text-xs font-medium border cursor-pointer transition-colors " +
                        (modalEdits.flipV
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/60 hover:bg-muted text-foreground border-border/60")
                      }
                    >
                      <FlipVertical className="h-4 w-4" />
                      <span>Flip V</span>
                    </button>
                  </div>
                </div>

                {/* Sliders (-100 to 100) */}
                <div className="space-y-4 pt-2 border-t border-border/40">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                    Adjustments (-100 to 100)
                  </label>

                  {/* Brightness */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Brightness</span>
                      <span className="font-bold text-foreground">{modalEdits.brightness}</span>
                    </div>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      value={modalEdits.brightness}
                      onChange={(e) =>
                        setModalEdits((prev) => ({ ...prev, brightness: Number(e.target.value) }))
                      }
                      className="w-full accent-primary cursor-pointer h-2 bg-muted rounded-lg"
                    />
                  </div>

                  {/* Contrast */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Contrast</span>
                      <span className="font-bold text-foreground">{modalEdits.contrast}</span>
                    </div>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      value={modalEdits.contrast}
                      onChange={(e) =>
                        setModalEdits((prev) => ({ ...prev, contrast: Number(e.target.value) }))
                      }
                      className="w-full accent-primary cursor-pointer h-2 bg-muted rounded-lg"
                    />
                  </div>

                  {/* Saturation */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Saturation</span>
                      <span className="font-bold text-foreground">{modalEdits.saturation}</span>
                    </div>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      value={modalEdits.saturation}
                      onChange={(e) =>
                        setModalEdits((prev) => ({ ...prev, saturation: Number(e.target.value) }))
                      }
                      className="w-full accent-primary cursor-pointer h-2 bg-muted rounded-lg"
                    />
                  </div>

                  {/* Warmth */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Warmth</span>
                      <span className="font-bold text-foreground">{modalEdits.warmth}</span>
                    </div>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      value={modalEdits.warmth}
                      onChange={(e) =>
                        setModalEdits((prev) => ({ ...prev, warmth: Number(e.target.value) }))
                      }
                      className="w-full accent-primary cursor-pointer h-2 bg-muted rounded-lg"
                    />
                  </div>

                  {/* Sharpness */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Sharpness</span>
                      <span className="font-bold text-foreground">{modalEdits.sharpness}</span>
                    </div>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      value={modalEdits.sharpness}
                      onChange={(e) =>
                        setModalEdits((prev) => ({ ...prev, sharpness: Number(e.target.value) }))
                      }
                      className="w-full accent-primary cursor-pointer h-2 bg-muted rounded-lg"
                    />
                  </div>
                </div>

                {/* Reset button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setModalEdits({ ...defaultEdits })}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset all adjustments
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/40">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-accent transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  updateItem(editingItem.id, { edits: { ...modalEdits } });
                  setEditingItem(null);
                }}
                className="px-6 py-2.5 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 transition-colors cursor-pointer"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
