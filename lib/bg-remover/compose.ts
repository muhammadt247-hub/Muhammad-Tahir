// Background choices for the Background Remover, and the full-size (HD) export.
// Everything runs in the browser. Nothing is uploaded.
import type { CSSProperties } from "react";

export type BgChoice =
  | { kind: "transparent" }
  | { kind: "white" }
  | { kind: "color"; color: string }
  | { kind: "image"; url: string };

export const TRANSPARENT: BgChoice = { kind: "transparent" };

export const checkerStyle: CSSProperties = {
  background: "repeating-conic-gradient(#d4d4d4 0% 25%, #ffffff 0% 50%) 50% / 16px 16px",
};

// CSS for showing the chosen background behind the cut-out in the preview.
export function bgPreviewStyle(bg: BgChoice): CSSProperties {
  switch (bg.kind) {
    case "white":
      return { background: "#ffffff" };
    case "color":
      return { background: bg.color };
    case "image":
      return { backgroundImage: `url("${bg.url}")`, backgroundSize: "cover", backgroundPosition: "center" };
    default:
      return checkerStyle;
  }
}

export function sameBg(a: BgChoice, b: BgChoice): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "color" && b.kind === "color") return a.color.toLowerCase() === b.color.toLowerCase();
  if (a.kind === "image" && b.kind === "image") return a.url === b.url;
  return true;
}


// ---------- export (size, padding, format) ----------

export type ExportSize = "original" | { w: number; h: number };
export type ExportSettings = { size: ExportSize; padding: number; format: "png" | "jpg" };
export const DEFAULT_EXPORT: ExportSettings = { size: "original", padding: 0.08, format: "png" };

function toBlob(canvas: HTMLCanvasElement, format: "png" | "jpg"): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Export failed."))),
      format === "jpg" ? "image/jpeg" : "image/png",
      format === "jpg" ? 0.92 : undefined
    );
  });
}

// The box around the visible (not see-through) part of the cut-out.
function visibleBox(img: ImageBitmap): { x: number; y: number; w: number; h: number } | null {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) {
    const row = y * c.width * 4;
    for (let x = 0; x < c.width; x++) {
      if (d[row + x * 4 + 3] > 10) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

async function drawBackground(ctx: CanvasRenderingContext2D, bg: BgChoice, w: number, h: number) {
  if (bg.kind === "transparent") return;
  if (bg.kind === "image") {
    const pic = await createImageBitmap(await (await fetch(bg.url)).blob(), { imageOrientation: "from-image" });
    // "cover": fill the whole area, keep the picture's shape, crop the overflow from the centre
    const scale = Math.max(w / pic.width, h / pic.height);
    const dw = pic.width * scale;
    const dh = pic.height * scale;
    ctx.drawImage(pic, (w - dw) / 2, (h - dh) / 2, dw, dh);
    pic.close();
    return;
  }
  ctx.fillStyle = bg.kind === "white" ? "#ffffff" : bg.color;
  ctx.fillRect(0, 0, w, h);
}

// Makes the final file: the cut-out on the chosen background.
// "original" size keeps the same pixels as the photo. A fixed size crops to the subject,
// adds padding around it, and centres it (good for shop listings).
// JPG cannot be see-through, so a transparent background becomes white.
export async function composeResult(cutout: Blob, bg: BgChoice, ex: ExportSettings = DEFAULT_EXPORT): Promise<Blob> {
  if (ex.size === "original" && ex.format === "png" && bg.kind === "transparent") return cutout;
  const fg = await createImageBitmap(cutout);
  try {
    let W = fg.width, H = fg.height;
    let src = { x: 0, y: 0, w: fg.width, h: fg.height };
    let dst = { x: 0, y: 0, w: W, h: H };
    if (ex.size !== "original") {
      W = Math.max(1, Math.round(ex.size.w));
      H = Math.max(1, Math.round(ex.size.h));
      src = visibleBox(fg) ?? src;
      const pad = Math.round(Math.min(W, H) * Math.max(0, Math.min(0.4, ex.padding)));
      const s = Math.min(Math.max(1, W - 2 * pad) / src.w, Math.max(1, H - 2 * pad) / src.h);
      const dw = src.w * s;
      const dh = src.h * s;
      dst = { x: (W - dw) / 2, y: (H - dh) / 2, w: dw, h: dh };
    }
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not supported in this browser.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    await drawBackground(ctx, ex.format === "jpg" && bg.kind === "transparent" ? { kind: "white" } : bg, W, H);
    ctx.drawImage(fg, src.x, src.y, src.w, src.h, dst.x, dst.y, dst.w, dst.h);
    return await toBlob(canvas, ex.format);
  } finally {
    fg.close();
  }
}

export function outputName(base: string, bg: BgChoice, ex: ExportSettings = DEFAULT_EXPORT): string {
  const tag = bg.kind === "transparent" && ex.format === "png" ? "no-bg" : "new-bg";
  return `${base}-${tag}.${ex.format === "jpg" ? "jpg" : "png"}`;
}

// What the exported file will be, in words (for the download buttons).
export function exportNote(ex: ExportSettings, w?: number, h?: number): string {
  const size = ex.size === "original" ? (w && h ? `${w} × ${h} px` : "full size") : `${ex.size.w} × ${ex.size.h} px`;
  return `${ex.format.toUpperCase()}, ${size}`;
}