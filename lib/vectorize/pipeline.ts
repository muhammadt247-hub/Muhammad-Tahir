// Our own "deep analysis" vectorizing pipeline.
// Steps: find the real colors -> snap every pixel to them -> smooth the shape edges
// -> find the exact edge of every color layer -> fit smooth Bezier curves.
import { ContourScratch, findLoops, loopArea, loopToPath } from './curves';

export interface PipelineSettings {
  maxColors: number; // 2..64 most colors we will look for
  mergeDistance: number; // 0..60 colors closer than this are treated as one
  smoothRadius: number; // 0..6 edge smoothing (pixels at working size)
  curveTolerance: number; // 0.2..2 pixels: how far a curve may drift from the true edge
  minArea: number; // remove shapes smaller than this (square pixels)
  thinWidth: number; // 0..8 thin lines and halos narrower than this (pixels) are removed
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


// Perceptual color distance: two colors with a distance under ~18 look like "the same color,
// just a different shade". Distinct design colors are usually 30 or more apart.
function toLab(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const R = lin(r), G = lin(g), B = lin(b);
  const x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function labDistance(a: [number, number, number], b: [number, number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
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
  // Colors that look like the same color in a different shade become one color.
  const kept: { c: RGB; n: number; lab: [number, number, number] }[] = [];
  for (const e of order) {
    const lab = toLab(e.c[0], e.c[1], e.c[2]);
    let merged = false;
    for (const big of kept) {
      if (labDistance(big.lab, lab) <= mergeDistance) {
        big.n += e.n;
        merged = true;
        break;
      }
    }
    if (!merged) kept.push({ c: e.c, n: e.n, lab });
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

// Remove thin lines and halos (the blurry band between two colors). Every pixel that is
// not part of a wide-enough shape is given to the nearest wide shape.
function removeThin(labels: Uint8Array, w: number, h: number, labelCount: number, radius: number) {
  const total = w * h;
  const field = new Float32Array(total);
  const tmp = new Float32Array(total);
  const lost = new Uint8Array(total);
  const counts = new Float64Array(labelCount);
  for (let p = 0; p < total; p++) counts[labels[p]]++;
  for (let c = 0; c < labelCount; c++) {
    if (counts[c] === 0) continue;
    for (let p = 0; p < total; p++) field[p] = labels[p] === c ? 1 : 0;
    boxBlur(field, tmp, w, h, radius); // erode: keep only pixels whose whole neighbourhood is c
    for (let p = 0; p < total; p++) field[p] = field[p] >= 0.9999 ? 1 : 0;
    boxBlur(field, tmp, w, h, radius); // dilate back
    for (let p = 0; p < total; p++) {
      if (labels[p] === c && field[p] < 0.0001) lost[p] = 1;
    }
  }
  // grow the wide shapes into the lost pixels (nearest wide shape wins)
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  const near = (p: number, q: number) => {
    if (lost[q]) lost[p] = lost[p]; // no-op, keeps the helper tiny
  };
  void near;
  for (let p = 0; p < total; p++) {
    if (lost[p]) continue;
    const x = p % w;
    const y = (p - x) / w;
    if ((x > 0 && lost[p - 1]) || (x < w - 1 && lost[p + 1]) || (y > 0 && lost[p - w]) || (y < h - 1 && lost[p + w])) {
      queue[tail++] = p;
    }
  }
  while (head < tail) {
    const p = queue[head++];
    const l = labels[p];
    const x = p % w;
    const y = (p - x) / w;
    const visit = (q: number) => {
      if (lost[q]) {
        lost[q] = 0;
        labels[q] = l;
        queue[tail++] = q;
      }
    };
    if (x > 0) visit(p - 1);
    if (x < w - 1) visit(p + 1);
    if (y > 0) visit(p - w);
    if (y < h - 1) visit(p + w);
  }
}

// Find the background: the main color along the picture border. Only WIDE background
// areas count. Thin white lines that join the inside of the artwork to the outside
// (like circuit lines) are kept, so white rings do not turn see-through.
function markBackground(
  labels: Uint8Array,
  w: number,
  h: number,
  colorCount: number
): { mark: number; bg: number } {
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
  if (edgeCounts[bg] / edgeTotal < 0.5) return { mark: -1, bg: -1 };

  const total = w * h;
  const R = 6; // channels narrower than about 13 pixels do not count as open background
  const field = new Float32Array(total);
  const tmp = new Float32Array(total);
  for (let p = 0; p < total; p++) field[p] = labels[p] === bg ? 1 : 0;
  boxBlur(field, tmp, w, h, R);
  const core = new Uint8Array(total); // wide background
  for (let p = 0; p < total; p++) core[p] = field[p] >= 0.9999 ? 1 : 0;

  // flood fill the wide background from the picture border
  const open = new Uint8Array(total);
  let stack: number[] = [];
  const seed = (p: number) => {
    if (core[p] && !open[p]) {
      open[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < w; x++) {
    seed(x);
    seed((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }
  while (stack.length) {
    const p = stack.pop() as number;
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) seed(p - 1);
    if (x < w - 1) seed(p + 1);
    if (y > 0) seed(p - w);
    if (y < h - 1) seed(p + w);
  }

  // grow back out to the real background edge (undo the shrinking), only over background pixels
  let frontier: number[] = [];
  for (let p = 0; p < total; p++) if (open[p]) frontier.push(p);
  for (let step = 0; step < R + 2 && frontier.length; step++) {
    const next: number[] = [];
    for (const p of frontier) {
      const x = p % w;
      const y = (p - x) / w;
      const grow = (q: number) => {
        if (!open[q] && labels[q] === bg) {
          open[q] = 1;
          next.push(q);
        }
      };
      if (x > 0) grow(p - 1);
      if (x < w - 1) grow(p + 1);
      if (y > 0) grow(p - w);
      if (y < h - 1) grow(p + w);
    }
    frontier = next;
  }
  stack = [];

  const mark = colorCount; // special label for "removed background"
  for (let p = 0; p < total; p++) if (open[p]) labels[p] = mark;
  return { mark, bg };
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

  progress('Finding the real colors...', 0.06);
  const palette = findPalette(rgba, w, h, s.maxColors, s.mergeDistance, s.deep);
  const K = palette.length;

  progress('Matching every pixel to a color...', 0.18);
  const labels = nearestLabels(rgba, total, palette);

  if (s.thinWidth > 0) {
    progress('Removing thin lines and halos...', 0.22);
    removeThin(labels, w, h, K, Math.max(1, Math.round(s.thinWidth / 2)));
  }

  let bgMark = -1;
  let bgIndex = -1;
  if (s.removeBackground) {
    const found = markBackground(labels, w, h, K); // background pixels get label K
    bgMark = found.mark;
    bgIndex = found.bg;
  }

  // True color of each shape = average of its inside pixels (not the blurry edge pixels)
  progress('Measuring the true colors...', 0.26);
  const sums = new Float64Array((K + 1) * 3);
  const cnt = new Float64Array(K + 1);
  const area = new Float64Array(K + 1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const l = labels[p];
      area[l]++;
      if (l >= K || x === 0 || y === 0 || x === w - 1 || y === h - 1) continue;
      if (labels[p - 1] !== l || labels[p + 1] !== l || labels[p - w] !== l || labels[p + w] !== l) continue;
      sums[l * 3] += rgba[p * 4];
      sums[l * 3 + 1] += rgba[p * 4 + 1];
      sums[l * 3 + 2] += rgba[p * 4 + 2];
      cnt[l]++;
    }
  }
  const colors: RGB[] = palette.map((c, i) => {
    let r = c[0], g = c[1], b = c[2];
    if (cnt[i] > 0) {
      r = Math.round(sums[i * 3] / cnt[i]);
      g = Math.round(sums[i * 3 + 1] / cnt[i]);
      b = Math.round(sums[i * 3 + 2] / cnt[i]);
    }
    if (r >= 250 && g >= 250 && b >= 250) return [255, 255, 255] as RGB;
    if (r <= 8 && g <= 8 && b <= 8) return [0, 0, 0] as RGB;
    return [r, g, b] as RGB;
  });

  // Colors that only existed as thin halos are gone now. Keep the real ones.
  const minPixels = Math.max(30, total * 0.0002);
  const used: number[] = [];
  for (let i = 0; i < K; i++) if (area[i] >= minPixels) used.push(i);
  // Paint order: biggest color first (bottom), smallest last (top)
  used.sort((a, b) => area[b] - area[a]);

  // The colors used to measure every pixel (the removed background color is included,
  // so the edge of the artwork is placed exactly where the picture changes color)
  const soft = used.slice();
  if (bgMark >= 0 && bgIndex >= 0 && !soft.includes(bgIndex)) soft.push(bgIndex);
  const sr = soft.map((i) => colors[i][0]);
  const sg = soft.map((i) => colors[i][1]);
  const sb = soft.map((i) => colors[i][2]);
  // Softness of each color: wide for colors far from all others, tight for similar colors
  const inv2 = new Float64Array(soft.length);
  const logNorm = new Float64Array(soft.length);
  for (let j = 0; j < soft.length; j++) {
    let nearest = Infinity;
    for (let k = 0; k < soft.length; k++) {
      if (k === j) continue;
      nearest = Math.min(nearest, Math.hypot(sr[j] - sr[k], sg[j] - sg[k], sb[j] - sb[k]));
    }
    const sigma = Math.max(7, Math.min(45, nearest === Infinity ? 45 : nearest * 0.3));
    inv2[j] = 1 / (2 * sigma * sigma);
    logNorm[j] = -3 * Math.log(sigma);
  }

  progress('Measuring every pixel...', 0.3);
  const best = new Float32Array(total).fill(-Infinity); // best log-weight at each pixel
  for (let j = 0; j < soft.length; j++) {
    const r = sr[j], g = sg[j], b = sb[j];
    const k2 = inv2[j];
    const ln = logNorm[j];
    for (let p = 0; p < total; p++) {
      const dr = rgba[p * 4] - r, dg = rgba[p * 4 + 1] - g, db = rgba[p * 4 + 2] - b;
      const lw = -(dr * dr + dg * dg + db * db) * k2 + ln;
      if (lw > best[p]) best[p] = lw;
    }
  }
  const invZ = new Float32Array(total);
  for (let j = 0; j < soft.length; j++) {
    const r = sr[j], g = sg[j], b = sb[j];
    const k2 = inv2[j];
    const ln = logNorm[j];
    for (let p = 0; p < total; p++) {
      const dr = rgba[p * 4] - r, dg = rgba[p * 4 + 1] - g, db = rgba[p * 4 + 2] - b;
      invZ[p] += Math.exp(-(dr * dr + dg * dg + db * db) * k2 + ln - best[p]);
    }
  }
  for (let p = 0; p < total; p++) invZ[p] = 1 / invZ[p];

  // Pixels near the removed background must not count as drawn white
  let nearBg: Uint8Array | null = null;
  if (bgMark >= 0) {
    const f = new Float32Array(total);
    const t = new Float32Array(total);
    for (let p = 0; p < total; p++) f[p] = labels[p] === bgMark ? 1 : 0;
    boxBlur(f, t, w, h, 3);
    nearBg = new Uint8Array(total);
    for (let p = 0; p < total; p++) nearBg[p] = f[p] > 0.0001 ? 1 : 0;
  }

  const blurR = Math.max(1, Math.round(s.smoothRadius));
  const acc = new Float32Array(total);
  const field = new Float32Array(total);
  const tmp = new Float32Array(total);
  const scratch = new ContourScratch(w, h);
  const tolerance = Math.max(0.15, s.curveTolerance);

  // Layer k covers everything painted at rank k or above, so neighbouring shapes overlap
  // and there are never thin gaps. We go from the top layer down, adding one color at a time.
  const parts: string[] = new Array(used.length).fill('');
  for (let li = used.length - 1; li >= 0; li--) {
    progress(`Tracing shapes (${used.length - li} of ${used.length})...`, 0.4 + (0.56 * (used.length - 1 - li)) / used.length);
    const idx = used[li];
    const j = soft.indexOf(idx);
    const r = sr[j], g = sg[j], b = sb[j];
    const k2 = inv2[j];
    const ln = logNorm[j];
    const isBgColor = idx === bgIndex && nearBg !== null;
    for (let p = 0; p < total; p++) {
      if (isBgColor && (nearBg as Uint8Array)[p]) continue;
      const dr = rgba[p * 4] - r, dg = rgba[p * 4 + 1] - g, db = rgba[p * 4 + 2] - b;
      acc[p] += Math.exp(-(dr * dr + dg * dg + db * db) * k2 + ln - best[p]) * invZ[p];
    }
    field.set(acc);
    boxBlur(field, tmp, w, h, blurR);
    boxBlur(field, tmp, w, h, blurR);

    const loops = findLoops(field, w, h, 0.5, scratch);
    let d = '';
    for (const loop of loops) {
      const area = Math.abs(loopArea(loop));
      if (area < s.minArea) continue;
      if (s.thinWidth > 0) {
        // thickness of a long thin shape is about 2 x area / outline length; slivers are not real shapes
        let perimeter = 0;
        for (let i = 0; i < loop.length; i++) {
          const q = loop[(i + 1) % loop.length];
          perimeter += Math.hypot(q[0] - loop[i][0], q[1] - loop[i][1]);
        }
        if (perimeter > 0 && (2 * area) / perimeter < s.thinWidth * 0.75) continue;
      }
      d += loopToPath(loop, tolerance);
    }
    if (!d) continue;
    const c = colors[idx];
    parts[li] = `<path fill="#${hex(c[0])}${hex(c[1])}${hex(c[2])}" fill-rule="evenodd" d="${d}"/>`;
  }

  let pathCount = 0;
  let body = '';
  for (const part of parts) {
    if (part) {
      body += part;
      pathCount++;
    }
  }

  progress('Finishing the SVG...', 0.98);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body}</svg>`;
  return { svg, colors: used.length, paths: pathCount };
}