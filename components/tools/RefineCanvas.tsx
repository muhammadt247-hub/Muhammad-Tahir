"use client";

// Refine brush for the Background Remover.
// Erase: makes parts see-through. Restore: brings back parts of the original photo.
// Works at full image size; nothing is uploaded.

import { useEffect, useRef, useState } from "react";
import { Check, Eraser, Eye, EyeOff, Loader2, Paintbrush, Redo2, RotateCcw, Undo2, X } from "lucide-react";
import { BgChoice, bgPreviewStyle } from "@/lib/bg-remover/compose";

type Tool = "erase" | "restore";
type Pt = { x: number; y: number };

type Props = {
  originalUrl: string;
  resultUrl: string;
  bg: BgChoice;
  onCancel: () => void;
  onApply: (blob: Blob) => void;
};

export default function RefineCanvas({ originalUrl, resultUrl, bg, onCancel, onApply }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const origRef = useRef<ImageBitmap | null>(null);
  const startRef = useRef<ImageData | null>(null);
  const undoRef = useRef<ImageData[]>([]);
  const redoRef = useRef<ImageData[]>([]);
  const maxUndo = useRef(10);
  const lastPt = useRef<Pt | null>(null);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [tool, setTool] = useState<Tool>("erase");
  const [size, setSize] = useState(30); // brush size on screen, in pixels
  const [ghost, setGhost] = useState(true);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [boxW, setBoxW] = useState(0);
  const [cursor, setCursor] = useState<Pt | null>(null);
  const [hist, setHist] = useState({ u: 0, r: 0 });
  const [saving, setSaving] = useState(false);

  // load the cut-out into the canvas, and keep the original photo for Restore
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [orig, res] = await Promise.all([
          fetch(originalUrl).then((r) => r.blob()).then((b) => createImageBitmap(b, { imageOrientation: "from-image" })),
          fetch(resultUrl).then((r) => r.blob()).then((b) => createImageBitmap(b)),
        ]);
        if (!alive) {
          orig.close();
          res.close();
          return;
        }
        const c = canvasRef.current;
        const ctx = c?.getContext("2d", { willReadFrequently: true });
        if (!c || !ctx) throw new Error("no canvas");
        c.width = res.width;
        c.height = res.height;
        ctx.drawImage(res, 0, 0);
        res.close();
        origRef.current = orig;
        startRef.current = ctx.getImageData(0, 0, c.width, c.height);
        // keep undo memory reasonable for very large images
        maxUndo.current = Math.max(3, Math.min(20, Math.floor(300_000_000 / (c.width * c.height * 4))));
        setDims({ w: c.width, h: c.height });
        setReady(true);
      } catch {
        if (alive) setError("Could not open the image for refining. Please try again.");
      }
    })();
    return () => {
      alive = false;
      origRef.current?.close();
      origRef.current = null;
    };
  }, [originalUrl, resultUrl]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoxW(el.clientWidth));
    ro.observe(el);
    setBoxW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Ctrl+Z / Ctrl+Y
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (k === "y" || (k === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxH = typeof window === "undefined" ? 600 : Math.max(280, Math.min(600, window.innerHeight * 0.55));
  let disp = { w: 0, h: 0 };
  if (dims && boxW > 0) {
    const s = Math.min(boxW / dims.w, maxH / dims.h);
    disp = { w: Math.floor(dims.w * s), h: Math.floor(dims.h * s) };
  }

  function ctx2d() {
    return canvasRef.current?.getContext("2d", { willReadFrequently: true }) ?? null;
  }

  function snapshot(): ImageData | null {
    const c = canvasRef.current;
    const ctx = ctx2d();
    return c && ctx ? ctx.getImageData(0, 0, c.width, c.height) : null;
  }

  function pushUndo() {
    const snap = snapshot();
    if (!snap) return;
    undoRef.current.push(snap);
    if (undoRef.current.length > maxUndo.current) undoRef.current.shift();
    redoRef.current = [];
    setHist({ u: undoRef.current.length, r: 0 });
  }

  function undo() {
    const prev = undoRef.current.pop();
    const ctx = ctx2d();
    if (!prev || !ctx) return;
    const cur = snapshot();
    if (cur) redoRef.current.push(cur);
    ctx.putImageData(prev, 0, 0);
    setHist({ u: undoRef.current.length, r: redoRef.current.length });
  }

  function redo() {
    const next = redoRef.current.pop();
    const ctx = ctx2d();
    if (!next || !ctx) return;
    const cur = snapshot();
    if (cur) undoRef.current.push(cur);
    ctx.putImageData(next, 0, 0);
    setHist({ u: undoRef.current.length, r: redoRef.current.length });
  }

  function resetAll() {
    const ctx = ctx2d();
    if (!ctx || !startRef.current) return;
    pushUndo();
    ctx.putImageData(startRef.current, 0, 0);
  }

  // screen position -> image position
  function toImage(e: React.PointerEvent<HTMLCanvasElement>): { img: Pt; screen: Pt } {
    const c = e.currentTarget;
    const rect = c.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    return { img: { x: (sx * c.width) / rect.width, y: (sy * c.height) / rect.height }, screen: { x: sx, y: sy } };
  }

  function paint(a: Pt, b: Pt) {
    const c = canvasRef.current;
    const ctx = ctx2d();
    if (!c || !ctx || disp.w === 0) return;
    const r = Math.max(1, (size / 2) * (c.width / disp.w)); // brush radius in image pixels
    ctx.save();
    if (tool === "erase") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = r * 2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x + 0.01, b.y);
      ctx.stroke();
    } else {
      const orig = origRef.current;
      if (!orig) {
        ctx.restore();
        return;
      }
      // brush shape = circles along the stroke; inside it, put back the original photo
      ctx.beginPath();
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const n = Math.max(1, Math.ceil(dist / Math.max(1, r / 3)));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.clip();
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(orig, 0, 0, c.width, c.height);
    }
    ctx.restore();
  }

  async function apply() {
    const c = canvasRef.current;
    if (!c || saving) return;
    setSaving(true);
    try {
      const blob = await new Promise<Blob>((resolve, reject) =>
        c.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed."))), "image/png")
      );
      onApply(blob);
    } catch {
      setError("Could not save your changes. Please try again.");
      setSaving(false);
    }
  }

  const toolBtn = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
    }`;
  const iconBtn =
    "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-foreground hover:border-primary disabled:opacity-40";

  return (
    <div className="space-y-3">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={toolBtn(tool === "erase")} onClick={() => setTool("erase")}>
          <Eraser className="h-4 w-4" /> Erase
        </button>
        <button type="button" className={toolBtn(tool === "restore")} onClick={() => setTool("restore")}>
          <Paintbrush className="h-4 w-4" /> Restore
        </button>
        <label className="ml-1 flex items-center gap-2 text-xs text-foreground" htmlFor="brush-size">
          Brush
          <input
            id="brush-size"
            type="range"
            min={4}
            max={120}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            style={{ accentColor: "hsl(21 90% 44%)" }}
          />
          <span className="w-8 tabular-nums text-muted-foreground">{size}</span>
        </label>
        <div className="flex items-center gap-1.5">
          <button type="button" className={iconBtn} onClick={undo} disabled={hist.u === 0} title="Undo (Ctrl+Z)" aria-label="Undo">
            <Undo2 className="h-4 w-4" />
          </button>
          <button type="button" className={iconBtn} onClick={redo} disabled={hist.r === 0} title="Redo (Ctrl+Y)" aria-label="Redo">
            <Redo2 className="h-4 w-4" />
          </button>
          <button type="button" className={iconBtn} onClick={resetAll} disabled={!ready} title="Start over" aria-label="Start over">
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={iconBtn}
            onClick={() => setGhost((g) => !g)}
            title={ghost ? "Hide removed parts" : "Show removed parts"}
            aria-label={ghost ? "Hide removed parts" : "Show removed parts"}
          >
            {ghost ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* canvas */}
      <div ref={wrapRef} className="flex items-center justify-center rounded-xl bg-muted/40" style={{ height: disp.h || maxH }}>
        {error ? (
          <p className="px-4 text-center text-sm text-red-600">{error}</p>
        ) : (
          <div className="relative overflow-hidden rounded-lg shadow-sm" style={{ width: disp.w || undefined, height: disp.h || undefined }}>
            <div className="absolute inset-0" style={bgPreviewStyle(bg)} />
            {ghost && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={originalUrl} alt="" className="pointer-events-none absolute inset-0 h-full w-full opacity-30" draggable={false} />
            )}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 h-full w-full cursor-none"
              style={{ touchAction: "none" }}
              onPointerDown={(e) => {
                if (!ready) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                pushUndo();
                const p = toImage(e);
                lastPt.current = p.img;
                setCursor(p.screen);
                paint(p.img, p.img);
              }}
              onPointerMove={(e) => {
                const p = toImage(e);
                setCursor(p.screen);
                if (lastPt.current) {
                  paint(lastPt.current, p.img);
                  lastPt.current = p.img;
                }
              }}
              onPointerUp={() => (lastPt.current = null)}
              onPointerCancel={() => (lastPt.current = null)}
              onPointerLeave={() => setCursor(null)}
            />
            {cursor && ready && (
              <div
                className="pointer-events-none absolute rounded-full border-2 border-white"
                style={{
                  width: size,
                  height: size,
                  left: cursor.x - size / 2,
                  top: cursor.y - size / 2,
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.6)",
                  background: tool === "erase" ? "rgba(220,38,38,0.18)" : "rgba(22,163,74,0.18)",
                }}
              />
            )}
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
          </div>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {tool === "erase"
          ? "Erase: paint over parts you want to remove."
          : "Restore: paint over parts that were removed by mistake. Faded areas show what can be restored."}
      </p>

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50"
        >
          <X className="h-4 w-4" /> Cancel
        </button>
        <button
          type="button"
          onClick={apply}
          disabled={!ready || saving}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Done
        </button>
      </div>
    </div>
  );
}
