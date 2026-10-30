"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import type { PipelineSettings } from "@/lib/vectorize/pipeline";
import type { VectorizeMessage } from "@/workers/vectorize.worker";

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_MB = 25;

type Mode = "auto" | "manual";
type Preset = "lineart" | "flat" | "illustration" | "detailed";

const PRESET_INFO: Record<Preset, { label: string; hint: string; settings: Omit<PipelineSettings, "removeBackground" | "deep"> }> = {
  lineart: {
    label: "Line art (2 colors)",
    hint: "Black and white drawings, signatures, outlines.",
    settings: { maxColors: 2, mergeDistance: 40, smoothRadius: 1, curveTolerance: 0.8, minArea: 20 },
  },
  flat: {
    label: "Logo / flat icon",
    hint: "Logos, icons and flat shapes with few colors.",
    settings: { maxColors: 24, mergeDistance: 55, smoothRadius: 1, curveTolerance: 0.8, minArea: 20 },
  },
  illustration: {
    label: "Illustration",
    hint: "Cartoons and artwork with soft color areas.",
    settings: { maxColors: 32, mergeDistance: 36, smoothRadius: 1, curveTolerance: 1, minArea: 16 },
  },
  detailed: {
    label: "Detailed",
    hint: "Many colors and fine details. Files get bigger.",
    settings: { maxColors: 48, mergeDistance: 22, smoothRadius: 1, curveTolerance: 0.8, minArea: 8 },
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
  const [merge, setMerge] = useState(55);
  const [detail, setDetail] = useState(7);
  const [noise, setNoise] = useState(20);
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
        curveTolerance: 2.6 - detail * 0.2, // detail 1..10 -> 2.4..0.6
        minArea: noise,
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
    [mode, preset, colors, merge, detail, noise, smooth, maxEdge, transparentBg, stopWorker]
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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Image → SVG Vectorizer</h1>
        <p className="text-sm text-muted-foreground">
          Turn a logo, icon or illustration into a clean, scalable SVG. It studies the colors first, so it can take a few seconds. It runs in your browser. Your image is not uploaded and no credits are used.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => void loadFile(e.target.files?.[0])}
      />

      {!source ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void loadFile(e.dataTransfer.files?.[0]);
          }}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
            dragging ? "border-primary bg-primary/5" : "border-border/60 bg-card/60 hover:bg-accent/40"
          }`}
        >
          <Upload className="h-8 w-8 mx-auto text-primary" />
          <p className="mt-3 text-sm font-semibold text-foreground">
            Drag and drop an image, or <span className="underline">browse</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">JPG, PNG or WebP. Up to {MAX_FILE_MB} MB.</p>
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
                    Auto looks at your image and picks the best settings. You can switch the style below.
                  </p>
                  {autoPreset && (
                    <div className="rounded-xl bg-primary/10 border border-primary/20 p-3 text-xs">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-primary" /> Detected: {PRESET_INFO[autoPreset].label}
                      </div>
                      <div className="text-muted-foreground mt-0.5">{PRESET_INFO[autoPreset].hint}</div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-1.5">
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
                      Merge similar colors <span className="text-muted-foreground">{merge}</span>
                    </span>
                    <input type="range" min={0} max={80} step={1} value={merge} onChange={(e) => setMerge(+e.target.value)} className={rangeClass} />
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
          <li>Edges look rough? Raise &quot;Edge smoothing&quot;. Lost a tiny detail? Lower it, or lower &quot;Remove small specks&quot;.</li><li>Shades of one color split into patches? Raise &quot;Merge similar colors&quot;.</li>
          <li>Want a see-through background? Keep &quot;Transparent background&quot; ticked. Turn it off to keep the white.</li>
          <li>Always check the SVG before you sell it, and only trace images you have the right to use.</li>
        </ul>
      </div>
    </div>
  );
}
