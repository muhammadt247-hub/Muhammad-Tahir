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

function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed."))), "image/png");
  });
}

// Puts the cut-out on the chosen background at full size (same pixels as the original image).
// Transparent returns the cut-out unchanged.
export async function composeResult(cutout: Blob, bg: BgChoice): Promise<Blob> {
  if (bg.kind === "transparent") return cutout;
  const fg = await createImageBitmap(cutout);
  const w = fg.width;
  const h = fg.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    fg.close();
    throw new Error("Canvas is not supported in this browser.");
  }
  if (bg.kind === "image") {
    const pic = await createImageBitmap(await (await fetch(bg.url)).blob(), { imageOrientation: "from-image" });
    // "cover": fill the whole area, keep the picture's shape, crop the overflow from the centre
    const scale = Math.max(w / pic.width, h / pic.height);
    const dw = pic.width * scale;
    const dh = pic.height * scale;
    ctx.drawImage(pic, (w - dw) / 2, (h - dh) / 2, dw, dh);
    pic.close();
  } else {
    ctx.fillStyle = bg.kind === "white" ? "#ffffff" : bg.color;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(fg, 0, 0);
  fg.close();
  return await toPng(canvas);
}

export function outputName(base: string, bg: BgChoice): string {
  return `${base}-${bg.kind === "transparent" ? "no-bg" : "new-bg"}.png`;
}
