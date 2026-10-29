"use client";

import { useEffect, useRef, useState } from "react";
import {
  Upload,
  Download,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
} from "lucide-react";

const MAX_FILES = 500;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

type Mode = "auto" | "graphics" | "photo";
type Used = "graphics" | "photo";
type Status = "waiting" | "processing" | "done" | "failed";

type Item = {
  id: string;
  file: File;
  name: string;
  originalUrl: string;
  status: Status;
  usedMode?: Used;
  resultUrl?: string;
  resultBlob?: Blob;
  doneKey?: string;
  error?: string;
};

const checkerStyle: React.CSSProperties = {
  background: "repeating-conic-gradient(#d4d4d4 0% 25%, #ffffff 0% 50%) 50% / 16px 16px",
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

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("PNG export failed."))),
      "image/png"
    );
  });
}

// Auto mode: plain white edge AND few flat colors means graphics (icons, logos).
async function looksLikeGraphics(file: File): Promise<boolean> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, 300 / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    bmp.close();
    return false;
  }
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const d = ctx.getImageData(0, 0, w, h).data;

  let edge = 0;
  let white = 0;
  const check = (x: number, y: number) => {
    const p = (y * w + x) * 4;
    edge++;
    if (d[p + 3] < 10 || Math.min(d[p], d[p + 1], d[p + 2]) >= 235) white++;
  };
  for (let x = 0; x < w; x++) {
    check(x, 0);
    check(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    check(0, y);
    check(w - 1, y);
  }
  if (white / edge < 0.9) return false;

  const bins = new Uint32Array(4096);
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    bins[((d[p] >> 4) << 8) | ((d[p + 1] >> 4) << 4) | (d[p + 2] >> 4)]++;
  }
  const sorted = Array.from(bins).sort((a, b) => b - a);
  let top = 0;
  for (let i = 0; i < 24; i++) top += sorted[i];
  return top / (w * h) >= 0.6;
}

// Graphics mode: removes the white that touches the image edge. Light colors inside shapes stay.
async function removeWhite(file: File, tol: number, inner: boolean): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const w = bmp.width;
  const h = bmp.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not supported in this browser.");
  ctx.drawImage(bmp, 0, 0);
  bmp.close();

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const n = w * h;
  const dist = new Uint8Array(n);
  const near = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    const m = Math.min(d[p], d[p + 1], d[p + 2]);
    dist[i] = 255 - m;
    if (d[p + 3] < 10 || 255 - m <= tol) near[i] = 1;
  }

  let bg: Uint8Array;
  if (inner) {
    bg = near;
  } else {
    bg = new Uint8Array(n);
    const stack = new Int32Array(n);
    let sp = 0;
    const push = (i: number) => {
      if (near[i] && !bg[i]) {
        bg[i] = 1;
        stack[sp++] = i;
      }
    };
    for (let x = 0; x < w; x++) {
      push(x);
      push((h - 1) * w + x);
    }
    for (let y = 0; y < h; y++) {
      push(y * w);
      push(y * w + w - 1);
    }
    while (sp > 0) {
      const i = stack[--sp];
      const x = i % w;
      if (x > 0) push(i - 1);
      if (x < w - 1) push(i + 1);
      if (i >= w) push(i - w);
      if (i < n - w) push(i + w);
    }
  }

  const dilate = (src: Uint8Array) => {
    const out = new Uint8Array(src);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (src[i]) continue;
        if (
          (x > 0 && src[i - 1]) ||
          (x < w - 1 && src[i + 1]) ||
          (y > 0 && src[i - w]) ||
          (y < h - 1 && src[i + w])
        ) {
          out[i] = 1;
        }
      }
    }
    return out;
  };
  const wide = dilate(dilate(bg));

  let cleared = 0;
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    if (bg[i]) {
      d[p + 3] = 0;
      cleared++;
      continue;
    }
    if (wide[i]) {
      const a = Math.min(1, dist[i] / 90);
      if (a > 0 && a < 1) {
        for (let c = 0; c < 3; c++) {
          const v = (d[p + c] - 255 * (1 - a)) / a;
          d[p + c] = v < 0 ? 0 : v > 255 ? 255 : v;
        }
        d[p + 3] = Math.round(a * d[p + 3]);
      }
    }
  }

  if (cleared === 0) {
    throw new Error("No white background found. Try Photo (AI) mode.");
  }
  if (cleared === n) {
    throw new Error("Everything was removed. Lower the tolerance or try Photo (AI) mode.");
  }

  ctx.putImageData(img, 0, 0);
  return await canvasToPng(canvas);
}

// Cleans the AI result: almost-solid pixels become solid, faint haze becomes clear.
async function cleanAlpha(blob: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const w = bmp.width;
  const h = bmp.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    bmp.close();
    return blob;
  }
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) {
    if (d[i] >= 250) d[i] = 255;
    else if (d[i] <= 12) d[i] = 0;
  }
  ctx.putImageData(img, 0, 0);
  return await canvasToPng(canvas);
}

export default function BackgroundRemoverPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [mode, setMode] = useState<Mode>("auto");
  const [tol, setTol] = useState(14);
  const [inner, setInner] = useState(false);
  const [running, setRunning] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const [zipError, setZipError] = useState("");

  const itemsRef = useRef<Item[]>([]);
  const cancelRef = useRef(false);
  const modelReadyRef = useRef(false);
  const zipLock = useRef(false);

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
    };
  }, []);

  const settingsKey = `${mode}|${tol}|${inner}`;

  function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const incoming = Array.from(list);
    const valid = incoming.filter((f) => ALLOWED.includes(f.type));
    const skipped = incoming.length - valid.length;
    const room = MAX_FILES - itemsRef.current.length;
    const accepted = valid.slice(0, Math.max(0, room));
    const tooMany = valid.length - accepted.length;
    const msgs: string[] = [];
    if (skipped > 0) msgs.push(`${skipped} file(s) skipped (use JPG, PNG or WEBP).`);
    if (tooMany > 0) msgs.push(`${tooMany} file(s) skipped (limit is ${MAX_FILES}).`);
    setNotice(msgs.join(" "));
    const fresh: Item[] = accepted.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file,
      name: file.name,
      originalUrl: URL.createObjectURL(file),
      status: "waiting",
    }));
    if (fresh.length) setItems((prev) => [...prev, ...fresh]);
  }

  function updateItem(id: string, patch: Partial<Item>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function removeItem(id: string) {
    const it = itemsRef.current.find((i) => i.id === id);
    if (!it || it.status === "processing") return;
    URL.revokeObjectURL(it.originalUrl);
    if (it.resultUrl) URL.revokeObjectURL(it.resultUrl);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function startRemoving() {
    if (running) return;
    const key = settingsKey;
    const currentMode = mode;
    const queue = itemsRef.current.filter(
      (i) => i.status !== "processing" && (i.status !== "done" || i.doneKey !== key)
    );
    if (queue.length === 0) return;

    cancelRef.current = false;
    setRunning(true);
    setNotice("");

    try {
      for (const item of queue) {
        if (cancelRef.current) break;
        updateItem(item.id, { status: "processing", error: undefined });

        let used: Used = currentMode === "photo" ? "photo" : "graphics";
        if (currentMode === "auto") {
          try {
            used = (await looksLikeGraphics(item.file)) ? "graphics" : "photo";
          } catch {
            used = "photo";
          }
        }

        if (used === "photo" && !modelReadyRef.current) setModelLoading(true);
        try {
          let blob: Blob;
          if (used === "graphics") {
            blob = await removeWhite(item.file, tol, inner);
          } else {
            const lib = await import("@imgly/background-removal");
            const raw: Blob = await lib.removeBackground(item.file, {
              output: { format: "image/png" },
            });
            modelReadyRef.current = true;
            blob = await cleanAlpha(raw);
          }
          setModelLoading(false);
          if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
          updateItem(item.id, {
            status: "done",
            usedMode: used,
            resultBlob: blob,
            resultUrl: URL.createObjectURL(blob),
            doneKey: key,
          });
        } catch (err) {
          setModelLoading(false);
          let message = err instanceof Error ? err.message : "Could not process this image.";
          if (used === "photo" && !modelReadyRef.current) {
            message = "Model download failed. Check your internet, VPN or ad-block, then try again.";
            setNotice(message);
            updateItem(item.id, { status: "failed", error: message });
            break;
          }
          updateItem(item.id, { status: "failed", error: message });
        }
        await new Promise((r) => setTimeout(r, 30));
      }
    } finally {
      setRunning(false);
      setModelLoading(false);
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
      const used = new Set<string>();
      for (const it of done) {
        const base = baseName(it.name);
        let fname = `${base}-no-bg.png`;
        let k = 2;
        while (used.has(fname.toLowerCase())) fname = `${base}-no-bg-${k++}.png`;
        used.add(fname.toLowerCase());
        zip.file(fname, it.resultBlob as Blob);
      }
      if (Object.keys(zip.files).length !== done.length) {
        throw new Error("ZIP file count does not match.");
      }
      const blob = await zip.generateAsync(
        { type: "blob", compression: "STORE" },
        (meta) => setZipProgress(Math.round(meta.percent))
      );
      const url = URL.createObjectURL(blob);
      saveBlob(url, "orbinexa-background-removed.zip");
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      setZipError("Could not make the ZIP file. Please click the button to try again.");
    } finally {
      zipLock.current = false;
      setZipping(false);
    }
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
    setModelLoading(false);
  }

  const total = items.length;
  const doneCount = items.filter((i) => i.status === "done").length;
  const failedCount = items.filter((i) => i.status === "failed").length;
  const finished = doneCount + failedCount;
  const percent = total ? Math.round((finished / total) * 100) : 0;
  const outdated = items.filter((i) => i.status === "done" && i.doneKey !== settingsKey).length;

  const pill = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Background Remover</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Remove image backgrounds free, right in your browser.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card px-5 py-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={pill(mode === "auto")} onClick={() => setMode("auto")}>
            Auto
          </button>
          <button type="button" className={pill(mode === "graphics")} onClick={() => setMode("graphics")}>
            Graphics on white
          </button>
          <button type="button" className={pill(mode === "photo")} onClick={() => setMode("photo")}>
            Photo (AI)
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {mode === "auto" &&
            "Auto checks every image. Icons, logos and illustrations on white use the exact method. Photos use the AI model."}
          {mode === "graphics" &&
            "Best for icons, logos and illustrations on a white background. Instant, and the colors stay exactly the same."}
          {mode === "photo" &&
            "Best for photos of people, products and animals. The first time it downloads an AI model, which can take a minute."}
        </p>
        {mode !== "photo" && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-medium text-foreground" htmlFor="tol">
              White tolerance: {tol}
            </label>
            <input
              id="tol"
              type="range"
              min={4}
              max={40}
              value={tol}
              onChange={(e) => setTol(Number(e.target.value))}
              style={{ accentColor: "hsl(21 90% 44%)" }}
            />
            <label className="flex items-center gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={inner}
                onChange={(e) => setInner(e.target.checked)}
                style={{ accentColor: "hsl(21 90% 44%)" }}
              />
              Also remove white inside shapes (holes)
            </label>
          </div>
        )}
      </div>

      <label
        className="dropzone-static flex flex-col items-center justify-center text-center rounded-2xl border-2 border-dashed border-border bg-card px-6 py-12 cursor-pointer"
        style={dragging ? { borderColor: "hsl(21 90% 44%)" } : undefined}
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
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Upload className="h-8 w-8 text-primary mb-3" />
        <p className="text-sm font-medium text-foreground">
          Drag &amp; drop images, or <span className="underline underline-offset-4">browse</span>
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">
          JPG, PNG, WEBP. Up to {MAX_FILES} images per session.
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">
          Your images stay on your computer. Nothing is uploaded.
        </p>
      </label>

      {notice && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground">
          {notice}
        </div>
      )}

      {total > 0 && (
        <div className="rounded-2xl border border-border bg-card px-5 py-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-foreground">
              {finished} of {total} finished · {doneCount} done · {failedCount} failed
            </p>
            <div className="flex flex-wrap gap-2">
              {running ? (
                <button
                  type="button"
                  onClick={() => {
                    cancelRef.current = true;
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Stop
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRemoving}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                >
                  Remove backgrounds
                </button>
              )}
              <button
                type="button"
                onClick={downloadAll}
                disabled={doneCount === 0 || zipping}
                className="inline-flex items-center gap-2 rounded-xl border border-primary px-4 py-2 text-sm font-medium text-primary disabled:opacity-50"
              >
                {zipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {zipping ? `Preparing ZIP ${zipProgress}%` : `Download All PNGs (${doneCount})`}
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground"
              >
                <Trash2 className="h-4 w-4" />
                Clear
              </button>
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
          </div>
          {modelLoading && (
            <p className="text-xs text-muted-foreground">Downloading the AI model, this can take a minute.</p>
          )}
          {outdated > 0 && !running && (
            <p className="text-xs text-muted-foreground">
              {outdated} image(s) were made with other settings. Click Remove backgrounds to redo them.
            </p>
          )}
          {failedCount > 0 && !running && (
            <p className="text-xs text-muted-foreground">
              To retry failed images, click Remove backgrounds again. Finished images are kept.
            </p>
          )}
          {zipError && <p className="text-xs text-red-600">{zipError}</p>}
        </div>
      )}

      {total > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} className="relative rounded-2xl border border-border bg-card p-3 space-y-3">
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                disabled={item.status === "processing"}
                className="absolute right-2 top-2 z-10 rounded-full bg-card/90 p-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
                aria-label="Remove this image"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="grid grid-cols-2 gap-2">
                <div className="overflow-hidden rounded-xl bg-muted aspect-square flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.originalUrl} alt={item.name} className="max-h-full max-w-full object-contain" />
                </div>
                <div
                  className="overflow-hidden rounded-xl aspect-square flex items-center justify-center"
                  style={checkerStyle}
                >
                  {item.resultUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.resultUrl}
                      alt={`${item.name} without background`}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : item.status === "processing" ? (
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  ) : null}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs text-foreground" title={item.name}>
                  {item.name}
                </p>
                <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                  {item.status === "waiting" && (
                    <>
                      <Clock className="h-3.5 w-3.5" /> Waiting
                    </>
                  )}
                  {item.status === "processing" && (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing
                    </>
                  )}
                  {item.status === "done" && (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Done
                      {item.usedMode ? ` · ${item.usedMode === "graphics" ? "Graphics" : "AI"}` : ""}
                    </>
                  )}
                  {item.status === "failed" && (
                    <>
                      <AlertCircle className="h-3.5 w-3.5 text-red-600" /> Failed
                    </>
                  )}
                </span>
              </div>
              {item.error && <p className="text-[11px] text-red-600">{item.error}</p>}
              {item.status === "done" && item.resultUrl && (
                <button
                  type="button"
                  onClick={() => saveBlob(item.resultUrl as string, `${baseName(item.name)}-no-bg.png`)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                >
                  <Download className="h-4 w-4" />
                  Download PNG
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}