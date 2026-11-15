"use client";

// Big editor for one image in the Background Remover:
// before/after compare slider, background choice and HD download.

import { useEffect, useRef, useState } from "react";
import { Brush, Download, ImagePlus, Loader2, Layers } from "lucide-react";
import { BgChoice, TRANSPARENT, bgPreviewStyle, checkerStyle, sameBg } from "@/lib/bg-remover/compose";
import RefineCanvas from "@/components/tools/RefineCanvas";

const SWATCHES = ["#000000", "#F3F4F6", "#FDE7D9", "#D9560B", "#16A34A", "#DC2626", "#FACC15"];

type Props = {
  name: string;
  originalUrl: string;
  resultUrl?: string;
  processing: boolean;
  error?: string;
  bg: BgChoice;
  canApplyToAll: boolean;
  downloading: boolean;
  onBgChange: (bg: BgChoice) => void;
  onPicture: (file: File) => void;
  onApplyToAll: () => void;
  onDownload: () => void;
  onRefined: (blob: Blob) => void;
};

export default function BgEditor(props: Props) {
  const { name, originalUrl, resultUrl, processing, bg } = props;
  const [pos, setPos] = useState(50);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const boxRef = useRef<HTMLDivElement>(null);
  const pictureInput = useRef<HTMLInputElement>(null);

  const [refining, setRefining] = useState(false);

  // new image: start the slider in the middle, close the refine brush
  useEffect(() => {
    setPos(50);
    setDims(null);
    setRefining(false);
  }, [originalUrl]);

  // keep track of the space we have, so the image fits without stretching
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [refining]); // the preview box is re-created after the refine brush closes

  // Preview height: as tall as the image needs, but at most about half the screen (and 600px).
  const maxH = typeof window === "undefined" ? 600 : Math.max(280, Math.min(600, window.innerHeight * 0.52));
  const boxH = dims && box.w > 0 ? Math.min(maxH, (box.w * dims.h) / dims.w) : maxH;
  let fit = { w: 0, h: 0 };
  if (dims && box.w > 0) {
    const s = Math.min(box.w / dims.w, boxH / dims.h);
    fit = { w: Math.floor(dims.w * s), h: Math.floor(dims.h * s) };
  }

  const done = !!resultUrl && !processing;
  const swatch = (active: boolean) =>
    `h-9 w-9 rounded-full border-2 transition-transform hover:scale-105 ${
      active ? "border-primary ring-2 ring-primary/40" : "border-border"
    }`;
  const isColor = (c: string) => bg.kind === "color" && bg.color.toLowerCase() === c.toLowerCase();

  if (refining && resultUrl && !processing) {
    return (
      <div className="rounded-2xl border border-primary/50 bg-card p-4 sm:p-5 space-y-2">
        <p className="text-sm font-semibold text-foreground">Refine: {name}</p>
        <RefineCanvas
          originalUrl={originalUrl}
          resultUrl={resultUrl}
          bg={bg}
          onCancel={() => setRefining(false)}
          onApply={(blob) => {
            props.onRefined(blob);
            setRefining(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        {/* preview */}
        <div className="space-y-2 min-w-0">
          <div ref={boxRef} className="flex items-center justify-center rounded-xl bg-muted/40" style={{ height: boxH }}>
            {/* hidden image only to learn the size */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={originalUrl}
              alt=""
              className="hidden"
              onLoad={(e) => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            />
            {fit.w > 0 && (
              <div className="relative overflow-hidden rounded-lg shadow-sm select-none" style={{ width: fit.w, height: fit.h }}>
                {/* after: chosen background + cut-out */}
                <div className="absolute inset-0" style={done ? bgPreviewStyle(bg) : checkerStyle} />
                {done && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resultUrl} alt={`${name} without background`} className="absolute inset-0 h-full w-full" draggable={false} />
                )}
                {/* before: original, cut by the slider */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={originalUrl}
                  alt={name}
                  className="absolute inset-0 h-full w-full"
                  draggable={false}
                  style={done ? { clipPath: `inset(0 ${100 - pos}% 0 0)` } : undefined}
                />
                {done ? (
                  <>
                    <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_6px_rgba(0,0,0,0.5)]" style={{ left: `${pos}%` }}>
                      <div className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-primary shadow-md">
                        <span className="text-xs font-bold">‹ ›</span>
                      </div>
                    </div>
                    <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">Before</span>
                    <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">After</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={pos}
                      onChange={(e) => setPos(Number(e.target.value))}
                      aria-label="Compare before and after"
                      className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
                    />
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 px-4 text-center text-white">
                    {props.error ? (
                      <p className="text-sm font-medium">{props.error}</p>
                    ) : (
                      <>
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <p className="text-sm font-medium">{processing ? "Removing background…" : "Waiting…"}</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground" title={name}>
            {name}
            {done ? " · Drag the slider to compare" : ""}
          </p>
        </div>

        {/* controls */}
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">Background</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" title="Transparent" aria-label="Transparent background" disabled={!done}
                onClick={() => props.onBgChange(TRANSPARENT)} className={swatch(bg.kind === "transparent")} style={checkerStyle} />
              <button type="button" title="White" aria-label="White background" disabled={!done}
                onClick={() => props.onBgChange({ kind: "white" })} className={swatch(bg.kind === "white")} style={{ background: "#ffffff" }} />
              {SWATCHES.map((c) => (
                <button key={c} type="button" title={c} aria-label={`Color ${c}`} disabled={!done}
                  onClick={() => props.onBgChange({ kind: "color", color: c })} className={swatch(isColor(c))} style={{ background: c }} />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className={`inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-foreground ${done ? "cursor-pointer hover:border-primary" : "opacity-50"}`}>
                <span className="h-4 w-4 rounded-full border border-border" style={{ background: bg.kind === "color" ? bg.color : "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }} />
                Any color
                <input type="color" className="sr-only" disabled={!done}
                  value={bg.kind === "color" ? bg.color : "#d9560b"}
                  onChange={(e) => props.onBgChange({ kind: "color", color: e.target.value })} />
              </label>
              <button type="button" disabled={!done} onClick={() => pictureInput.current?.click()}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm text-foreground disabled:opacity-50 ${bg.kind === "image" ? "border-primary" : "border-border hover:border-primary"}`}>
                <ImagePlus className="h-4 w-4 text-primary" />
                Your picture
              </button>
              <input ref={pictureInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) props.onPicture(f);
                  e.target.value = "";
                }} />
            </div>
            {props.canApplyToAll && (
              <button type="button" disabled={!done || props.downloading} onClick={props.onApplyToAll}
                className="inline-flex items-center gap-2 text-xs font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50">
                <Layers className="h-3.5 w-3.5" />
                Use this background for all images
              </button>
            )}
          </div>

          <div className="space-y-2">
            <button type="button" disabled={!done} onClick={() => setRefining(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary px-4 py-2.5 text-sm font-semibold text-primary disabled:opacity-50">
              <Brush className="h-4 w-4" />
              Refine (erase / restore)
            </button>
            <button type="button" disabled={!done || props.downloading} onClick={props.onDownload}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {props.downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download HD
            </button>
            <p className="text-[11px] text-muted-foreground">
              {dims ? `Full size PNG, ${dims.w} × ${dims.h} px. ` : ""}
              {sameBg(bg, TRANSPARENT) ? "Transparent background." : "With the background you chose."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
