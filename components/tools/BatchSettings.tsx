"use client";

// Export settings for ALL images in the Background Remover: size, padding and file type,
// with ready presets for online shops and a live preview of one image.

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { BgChoice, ExportSettings, checkerStyle, composeResult } from "@/lib/bg-remover/compose";

type Preset = { id: string; label: string; w?: number; h?: number; white?: boolean };

export const PRESETS: Preset[] = [
  { id: "original", label: "Original size" },
  { id: "square", label: "Square 2000 × 2000", w: 2000, h: 2000 },
  { id: "amazon", label: "Amazon 2000 × 2000 (white)", w: 2000, h: 2000, white: true },
  { id: "shopify", label: "Shopify 2048 × 2048", w: 2048, h: 2048 },
  { id: "ebay", label: "eBay 1600 × 1600", w: 1600, h: 1600 },
  { id: "ig-post", label: "Instagram post 1080 × 1080", w: 1080, h: 1080 },
  { id: "ig-portrait", label: "Instagram portrait 1080 × 1350", w: 1080, h: 1350 },
  { id: "custom", label: "Custom size" },
];

type Props = {
  settings: ExportSettings;
  presetId: string;
  onChange: (s: ExportSettings, presetId: string) => void;
  onWhiteForAll: () => void;
  previewCutout?: Blob;
  previewBg: BgChoice;
};

const clampSide = (n: number) => Math.max(100, Math.min(8000, Math.round(n || 0)));

export default function BatchSettings({ settings, presetId, onChange, onWhiteForAll, previewCutout, previewBg }: Props) {
  const [custom, setCustom] = useState({ w: 2000, h: 2000 });
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // live preview of the selected image with these settings (small delay so sliders stay smooth)
  useEffect(() => {
    if (!previewCutout) {
      setPreview(null);
      return;
    }
    let alive = true;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const blob = await composeResult(previewCutout, previewBg, settings);
        if (!alive) return;
        setPreview(URL.createObjectURL(blob));
      } catch {
        if (alive) setPreview(null);
      } finally {
        if (alive) setBusy(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [previewCutout, previewBg, settings]);

  // free the old preview picture when a new one replaces it
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function pickPreset(id: string) {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    if (id === "original") onChange({ ...settings, size: "original" }, id);
    else if (id === "custom") onChange({ ...settings, size: { w: custom.w, h: custom.h } }, id);
    else onChange({ ...settings, size: { w: p.w as number, h: p.h as number } }, id);
    if (p.white) onWhiteForAll();
  }

  const pill = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
    }`;
  const fixed = settings.size !== "original";

  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-4">
      <div className="grid gap-5 md:grid-cols-[1fr_200px]">
        <div className="space-y-4 min-w-0">
          <div>
            <p className="text-sm font-semibold text-foreground">Export settings for all images</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Used by every download and the ZIP. Pick a shop size to make all your photos the same.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-medium text-foreground" htmlFor="export-size">Size</label>
            <select
              id="export-size"
              value={presetId}
              onChange={(e) => pickPreset(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            {presetId === "custom" && (
              <div className="flex items-center gap-2 text-sm">
                <input
                  type="number" min={100} max={8000} aria-label="Width in pixels"
                  value={custom.w}
                  onChange={(e) => setCustom((c) => ({ ...c, w: Number(e.target.value) }))}
                  onBlur={() => {
                    const w = clampSide(custom.w);
                    setCustom((c) => ({ ...c, w }));
                    onChange({ ...settings, size: { w, h: clampSide(custom.h) } }, "custom");
                  }}
                  className="w-24 rounded-xl border border-border bg-background px-3 py-2"
                />
                <span className="text-muted-foreground">×</span>
                <input
                  type="number" min={100} max={8000} aria-label="Height in pixels"
                  value={custom.h}
                  onChange={(e) => setCustom((c) => ({ ...c, h: Number(e.target.value) }))}
                  onBlur={() => {
                    const h = clampSide(custom.h);
                    setCustom((c) => ({ ...c, h }));
                    onChange({ ...settings, size: { w: clampSide(custom.w), h } }, "custom");
                  }}
                  className="w-24 rounded-xl border border-border bg-background px-3 py-2"
                />
                <span className="text-xs text-muted-foreground">px</span>
              </div>
            )}
          </div>

          {fixed && (
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs font-medium text-foreground" htmlFor="export-padding">
                Space around the subject: {Math.round(settings.padding * 100)}%
              </label>
              <input
                id="export-padding"
                type="range" min={0} max={30} step={1}
                value={Math.round(settings.padding * 100)}
                onChange={(e) => onChange({ ...settings, padding: Number(e.target.value) / 100 }, presetId)}
                style={{ accentColor: "hsl(21 90% 44%)" }}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-foreground mr-1">File type</span>
            <button type="button" className={pill(settings.format === "png")} onClick={() => onChange({ ...settings, format: "png" }, presetId)}>
              PNG
            </button>
            <button type="button" className={pill(settings.format === "jpg")} onClick={() => onChange({ ...settings, format: "jpg" }, presetId)}>
              JPG
            </button>
            <span className="text-[11px] text-muted-foreground">
              {settings.format === "png" ? "Keeps see-through backgrounds." : "Smaller files. See-through parts become white."}
            </span>
          </div>
          {presetId === "amazon" && (
            <p className="text-[11px] text-muted-foreground">Amazon main images need a pure white background, so all images were set to white.</p>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground">Preview</p>
          <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Export preview" className="max-h-full max-w-full object-contain" style={checkerStyle} />
            ) : (
              <p className="px-3 text-center text-[11px] text-muted-foreground">
                {previewCutout ? "Making preview…" : "Finish one image to see a preview."}
              </p>
            )}
            {busy && preview && <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-primary" />}
          </div>
        </div>
      </div>
    </div>
  );
}
