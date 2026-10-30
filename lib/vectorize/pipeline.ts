// Our own "deep analysis" vectorizing pipeline.
// Steps: find the real colors -> snap every pixel to them -> smooth the shape edges
// -> trace each color with ImageTracer -> clean up the SVG text.
import ImageTracer from '../vendor/imagetracer';

export interface PipelineSettings {
  maxColors: number; // 2..64 most colors we will look for
  mergeDistance: number; // 0..60 colors closer than this are treated as one
  smoothRadius: number; // 0..6 edge smoothing (pixels at working size)
  curveTolerance: number; // 0.3..3 bigger = smoother, simpler curves
  minArea: number; // remove specks smaller than this (pixels)
  removeBackground: boolean;
  deep: boolean; // more careful (slower) color search
}

export type ProgressFn = (message: string, fraction: number) => void;

export interface PipelineResult {
  svg: string;
  colors: number;
  paths: number;
}

type RGB = [number, number, number];

function dist2(a: RGB, r: number, g: number, b: number) {
  const dr = a[0] - r;
  const dg = a[1] - g;
  const db = a[2] - b;
  return dr * dr + dg * dg + db * db;
}

// Simple repeatable random numbers so results do not change between runs.
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function findPalette(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  maxColors: number,
  mergeDistance: number,
  deep: boolean
): RGB[] {
  const total = w * h;
  const wanted = deep ? 60000 : 25000;
  const step = Math.max(1, Math.floor(total / wanted));
  const sx: number[] = [];
  const sy: number[] = [];
  const sz: number[] = [];
  for (let p = 0; p < total; p += step) {
    sx.push(data[p * 4]);
    sy.push(data[p * 4 + 1]);
    sz.push(data[p * 4 + 2]);
  }
  const n = sx.length;
  const k = Math.max(1, Math.min(maxColors, n));
  const rng = makeRng(12345);

  // k-means++ start
  const centers: RGB[] = [];
  const first = Math.floor(rng() * n);
  centers.push([sx[first], sy[first], sz[first]]);
  const d2 = new Float64Array(n).fill(Infinity);
  while (centers.length < k) {
    const c = centers[centers.length - 1];
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const d = dist2(c, sx[i], sy[i], sz[i]);
      if (d < d2[i]) d2[i] = d;
      sum += d2[i];
    }
    if (sum === 0) break;
    let pick = rng() * sum;
    let idx = 0;
    for (let i = 0; i < n; i++) {
      pick -= d2[i];
      if (pick <= 0) {
        idx = i;
        break;
      }
    }
    centers.push([sx[idx], sy[idx], sz[idx]]);
  }

  const iterations = deep ? 24 : 12;
  const counts = new Float64Array(centers.length);
  for (let it = 0; it < iterations; it++) {
    const sums = centers.map(() => [0, 0, 0]);
    counts.fill(0);
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bd = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const d = dist2(centers[c], sx[i], sy[i], sz[i]);
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
      sums[best][0] += sx[i];
      sums[best][1] += sy[i];
      sums[best][2] += sz[i];
      counts[best]++;
    }
    for (let c = 0; c < centers.length; c++) {
      if (counts[c] > 0) {
        centers[c] = [sums[c][0] / counts[c], sums[c][1] / counts[c], sums[c][2] / counts[c]];
      }
    }
  }

  // Sort biggest first, then merge colors that are too close to a bigger one
  const order = centers.map((c, i) => ({ c, n: counts[i] })).filter((e) => e.n > 0);
  order.sort((a, b) => b.n - a.n);
  const kept: { c: RGB; n: number }[] = [];
  // Colors closer than the merge distance are one color. Very light colors (pale blue
  // next to white) are the exception: they are real design colors, so they stay apart.
  const farSq = mergeDistance * mergeDistance;
  const lightSq = Math.min(mergeDistance, 12) * Math.min(mergeDistance, 12);
  const isLight = (c: RGB) => Math.min(c[0], c[1], c[2]) >= 215;
  for (const e of order) {
    let merged = false;
    for (const big of kept) {
      // a big light color is a real design color; a tiny one is just noise next to white
      const mergeSq = (isLight(big.c) || isLight(e.c)) && e.n / n >= 0.006 ? lightSq : farSq;
      if (dist2(big.c, e.c[0], e.c[1], e.c[2]) <= mergeSq) {
        big.n += e.n;
        merged = true;
        break;
      }
    }
    if (!merged) kept.push({ c: e.c, n: e.n });
  }
  // Drop colors that are only a tiny blur of edge pixels
  const minShare = 0.0004;
  const strong = kept.filter((e) => e.n / n >= minShare);
  const final = (strong.length ? strong : kept).map((e) => {
    const r = Math.round(e.c[0]);
    const g = Math.round(e.c[1]);
    const b = Math.round(e.c[2]);
    // Snap near-white and near-black to pure values
    if (r >= 250 && g >= 250 && b >= 250) return [255, 255, 255] as RGB;
    if (r <= 12 && g <= 12 && b <= 12) return [0, 0, 0] as RGB;
    return [r, g, b] as RGB;
  });
  return final;
}

function nearestLabels(data: Uint8ClampedArray, total: number, palette: RGB[]): Uint8Array {
  const labels = new Uint8Array(total);
  const kk = palette.length;
  const pr = new Int32Array(kk);
  const pg = new Int32Array(kk);
  const pb = new Int32Array(kk);
  for (let c = 0; c < kk; c++) {
    pr[c] = palette[c][0];
    pg[c] = palette[c][1];
    pb[c] = palette[c][2];
  }
  for (let p = 0; p < total; p++) {
    const r = data[p * 4];
    const g = data[p * 4 + 1];
    const b = data[p * 4 + 2];
    let best = 0;
    let bd = Infinity;
    for (let c = 0; c < kk; c++) {
      const dr = pr[c] - r;
      const dg = pg[c] - g;
      const db = pb[c] - b;
      const d = dr * dr + dg * dg + db * db;
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    labels[p] = best;
  }
  return labels;
}

// Blur a 0/1 mask with a box filter (running sum). Two passes ~ soft round blur.
function boxBlur(src: Float32Array, tmp: Float32Array, w: number, h: number, r: number) {
  const size = 2 * r + 1;
  // horizontal: src -> tmp
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let x = -r; x <= r; x++) sum += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / size;
      sum += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  // vertical: tmp -> src
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      src[y * w + x] = sum / size;
      sum += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
}

// Smooth the shape edges: blur every color's mask, then give each pixel to the color
// with the highest value. This removes jagged steps and thin color fringes.
function smoothLabels(
  labels: Uint8Array,
  w: number,
  h: number,
  colorCount: number,
  radius: number,
  onStep?: (i: number) => void
): Uint8Array {
  if (radius <= 0) return labels;
  const total = w * h;
  const blurR = Math.max(1, Math.round(radius * 0.75));
  const out = new Uint8Array(total);
  const best = new Float32Array(total).fill(-1);
  const mask = new Float32Array(total);
  const tmp = new Float32Array(total);
  for (let c = 0; c < colorCount; c++) {
    let any = false;
    for (let p = 0; p < total; p++) {
      const v = labels[p] === c ? 1 : 0;
      mask[p] = v;
      if (v) any = true;
    }
    if (!any) continue;
    // three gentle passes give a round (almost Gaussian) blur, so circles stay round
    boxBlur(mask, tmp, w, h, blurR);
    boxBlur(mask, tmp, w, h, blurR);
    boxBlur(mask, tmp, w, h, blurR);
    for (let p = 0; p < total; p++) {
      if (mask[p] > best[p]) {
        best[p] = mask[p];
        out[p] = c;
      }
    }
    onStep?.(c);
  }
  return out;
}

// Find the background: the main color along the picture border, joined to the border.
function markBackground(labels: Uint8Array, w: number, h: number, colorCount: number): number {
  const edgeCounts = new Float64Array(colorCount);
  let edgeTotal = 0;
  const addEdge = (p: number) => {
    edgeCounts[labels[p]]++;
    edgeTotal++;
  };
  for (let x = 0; x < w; x++) {
    addEdge(x);
    addEdge((h - 1) * w + x);
  }
  for (let y = 1; y < h - 1; y++) {
    addEdge(y * w);
    addEdge(y * w + w - 1);
  }
  let bg = 0;
  for (let c = 1; c < colorCount; c++) if (edgeCounts[c] > edgeCounts[bg]) bg = c;
  if (edgeCounts[bg] / edgeTotal < 0.5) return -1;

  // flood fill from the border through background-colored pixels, mark them as "colorCount"
  const mark = colorCount; // special label
  const stack: number[] = [];
  const push = (p: number) => {
    if (labels[p] === bg) {
      labels[p] = mark;
      stack.push(p);
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
  while (stack.length) {
    const p = stack.pop() as number;
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (y > 0) push(p - w);
    if (y < h - 1) push(p + w);
  }
  return mark;
}

function hex(n: number) {
  return n.toString(16).padStart(2, '0');
}

export function runPipeline(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  s: PipelineSettings,
  progress: ProgressFn = () => {}
): PipelineResult {
  const total = w * h;

  // Put transparent parts on white so they count as background
  for (let p = 0; p < total; p++) {
    const a = rgba[p * 4 + 3];
    if (a < 255) {
      const f = a / 255;
      rgba[p * 4] = Math.round(rgba[p * 4] * f + 255 * (1 - f));
      rgba[p * 4 + 1] = Math.round(rgba[p * 4 + 1] * f + 255 * (1 - f));
      rgba[p * 4 + 2] = Math.round(rgba[p * 4 + 2] * f + 255 * (1 - f));
      rgba[p * 4 + 3] = 255;
    }
  }

  progress('Finding the real colors...', 0.08);
  const palette = findPalette(rgba, w, h, s.maxColors, s.mergeDistance, s.deep);

  progress('Matching every pixel to a color...', 0.25);
  const labels0 = nearestLabels(rgba, total, palette);

  progress('Smoothing the edges...', 0.4);
  const labels = smoothLabels(labels0, w, h, palette.length, Math.round(s.smoothRadius), (c) =>
    progress('Smoothing the edges...', 0.4 + (0.3 * (c + 1)) / palette.length)
  );

  // Which colors are really used
  const used = new Int32Array(palette.length + 1);
  for (let p = 0; p < total; p++) used[labels[p]]++;

  let bgMark = -1;
  if (s.removeBackground) bgMark = markBackground(labels, w, h, palette.length);

  // Placeholder color for the removed background (a color not in the palette)
  const candidates: RGB[] = [[255, 0, 255], [0, 255, 0], [0, 255, 255], [255, 255, 0]];
  let placeholder: RGB = candidates[0];
  let farthest = -1;
  for (const cand of candidates) {
    let nearest = Infinity;
    for (const pc of palette) nearest = Math.min(nearest, dist2(cand, pc[0], pc[1], pc[2]));
    if (nearest > farthest) {
      farthest = nearest;
      placeholder = cand;
    }
  }

  const tracerPalette: { r: number; g: number; b: number; a: number }[] = palette.map((c) => ({
    r: c[0],
    g: c[1],
    b: c[2],
    a: 255,
  }));
  tracerPalette.push({ r: placeholder[0], g: placeholder[1], b: placeholder[2], a: 255 });

  const quantized = new Uint8ClampedArray(total * 4);
  for (let p = 0; p < total; p++) {
    const c = tracerPalette[labels[p]];
    quantized[p * 4] = c.r;
    quantized[p * 4 + 1] = c.g;
    quantized[p * 4 + 2] = c.b;
    quantized[p * 4 + 3] = 255;
  }

  progress('Tracing the shapes...', 0.75);
  const raw = ImageTracer.imagedataToSVG(
    { width: w, height: h, data: quantized },
    {
      pal: tracerPalette,
      colorsampling: 0,
      numberofcolors: tracerPalette.length,
      colorquantcycles: 1,
      mincolorratio: 0,
      ltres: s.curveTolerance,
      qtres: s.curveTolerance,
      pathomit: Math.max(0, Math.round(s.minArea)),
      rightangleenhance: true,
      strokewidth: 0,
      linefilter: false,
      blurradius: 0,
      roundcoords: 1,
      desc: false,
    }
  );

  progress('Cleaning the SVG...', 0.95);
  const dropKey = `${placeholder[0]},${placeholder[1]},${placeholder[2]}`;
  let pathCount = 0;
  const body = raw.replace(
    /<path fill="rgb\((\d+),(\d+),(\d+)\)"[^>]*?opacity="([\d.]+)"[^>]*? d="([^"]*)"[^>]*\/>/g,
    (_m, r: string, g: string, b: string, op: string, d: string) => {
      if (parseFloat(op) < 0.5) return '';
      if (bgMark >= 0 && `${r},${g},${b}` === dropKey) return '';
      pathCount++;
      return `<path fill="#${hex(+r)}${hex(+g)}${hex(+b)}" d="${d.trim()}"/>`;
    }
  );
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}</svg>`;
  const colorsUsed = Array.from(used).slice(0, palette.length).filter((n) => n > 0).length;
  return { svg, colors: colorsUsed, paths: pathCount };
}