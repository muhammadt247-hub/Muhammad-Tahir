// Our own edge finding and curve fitting. ok.
// 1) Marching squares finds the exact (sub-pixel) edge of a smooth 0..1 field.
// 2) Schneider-style least-squares fitting turns the edge points into smooth cubic Bezier curves.
// Written from the published, well-known methods (marching squares; "An Algorithm for
// Automatically Fitting Digitized Curves", Graphics Gems I).

export type Pt = [number, number];

export class ContourScratch {
  adj: Int32Array;
  seen: Uint8Array;
  padded: Float32Array;
  constructor(public w: number, public h: number) {
    const W = w + 2;
    const H = h + 2;
    const nE = (W - 1) * H + W * (H - 1);
    this.adj = new Int32Array(nE * 2);
    this.seen = new Uint8Array(nE);
    this.padded = new Float32Array(W * H);
  }
}

// Find closed edge loops where the field crosses `level`.
export function findLoops(field: Float32Array, w: number, h: number, level: number, sc: ContourScratch): Pt[][] {
  const W = w + 2;
  const H = h + 2;
  const g = sc.padded;
  g.fill(0);
  for (let y = 0; y < h; y++) {
    const src = y * w;
    const dst = (y + 1) * W + 1;
    for (let x = 0; x < w; x++) g[dst + x] = field[src + x];
  }
  const nH = (W - 1) * H;
  const adj = sc.adj;
  const seen = sc.seen;
  adj.fill(-1);
  seen.fill(0);

  const link = (a: number, b: number) => {
    if (adj[2 * a] < 0) adj[2 * a] = b;
    else adj[2 * a + 1] = b;
    if (adj[2 * b] < 0) adj[2 * b] = a;
    else adj[2 * b + 1] = a;
  };

  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W - 1; x++) {
      const i = y * W + x;
      const tl = g[i];
      const tr = g[i + 1];
      const bl = g[i + W];
      const br = g[i + W + 1];
      const c = (tl >= level ? 8 : 0) | (tr >= level ? 4 : 0) | (br >= level ? 2 : 0) | (bl >= level ? 1 : 0);
      if (c === 0 || c === 15) continue;
      const top = y * (W - 1) + x;
      const bottom = (y + 1) * (W - 1) + x;
      const left = nH + y * W + x;
      const right = nH + y * W + x + 1;
      switch (c) {
        case 1: case 14: link(left, bottom); break;
        case 2: case 13: link(bottom, right); break;
        case 3: case 12: link(left, right); break;
        case 4: case 11: link(top, right); break;
        case 6: case 9: link(top, bottom); break;
        case 7: case 8: link(top, left); break;
        case 5: {
          const mid = (tl + tr + bl + br) / 4 >= level;
          if (mid) { link(top, left); link(bottom, right); } else { link(top, right); link(left, bottom); }
          break;
        }
        case 10: {
          const mid = (tl + tr + bl + br) / 4 >= level;
          if (mid) { link(top, right); link(left, bottom); } else { link(top, left); link(bottom, right); }
          break;
        }
      }
    }
  }

  const point = (e: number): Pt => {
    if (e < nH) {
      const y = Math.floor(e / (W - 1));
      const x = e - y * (W - 1);
      const a = g[y * W + x];
      const b = g[y * W + x + 1];
      const t = b === a ? 0.5 : (level - a) / (b - a);
      return [x + t - 0.5, y - 0.5];
    }
    const e2 = e - nH;
    const y = Math.floor(e2 / W);
    const x = e2 - y * W;
    const a = g[y * W + x];
    const b = g[(y + 1) * W + x];
    const t = b === a ? 0.5 : (level - a) / (b - a);
    return [x - 0.5, y + t - 0.5];
  };

  const loops: Pt[][] = [];
  for (let e = 0; e < seen.length; e++) {
    if (seen[e] || adj[2 * e] < 0) continue;
    const loop: Pt[] = [];
    let prev = -1;
    let cur = e;
    let guard = 0;
    while (!seen[cur] && guard++ < 50_000_000) {
      seen[cur] = 1;
      loop.push(point(cur));
      const n0 = adj[2 * cur];
      const n1 = adj[2 * cur + 1];
      let next = n0 !== prev && !seen[n0] ? n0 : n1;
      if (next < 0 || seen[next]) next = n0 !== prev ? n0 : n1;
      if (next < 0 || seen[next]) break;
      prev = cur;
      cur = next;
    }
    if (loop.length >= 4) loops.push(loop);
  }
  return loops;
}

export function loopArea(p: Pt[]): number {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += p[j][0] * p[i][1] - p[i][0] * p[j][1];
  return a / 2;
}

// ---------- Bezier fitting ----------
type Bez = [Pt, Pt, Pt, Pt];

const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const mul = (a: Pt, s: number): Pt => [a[0] * s, a[1] * s];
const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1];
const len = (a: Pt) => Math.hypot(a[0], a[1]);
const norm = (a: Pt): Pt => {
  const l = len(a);
  return l < 1e-12 ? [0, 0] : [a[0] / l, a[1] / l];
};

function bezAt(b: Bez, t: number): Pt {
  const s = 1 - t;
  const b0 = s * s * s;
  const b1 = 3 * s * s * t;
  const b2 = 3 * s * t * t;
  const b3 = t * t * t;
  return [
    b[0][0] * b0 + b[1][0] * b1 + b[2][0] * b2 + b[3][0] * b3,
    b[0][1] * b0 + b[1][1] * b1 + b[2][1] * b2 + b[3][1] * b3,
  ];
}
function bezD1(b: Bez, t: number): Pt {
  const s = 1 - t;
  const a = mul(sub(b[1], b[0]), 3 * s * s);
  const c = mul(sub(b[2], b[1]), 6 * s * t);
  const d = mul(sub(b[3], b[2]), 3 * t * t);
  return add(add(a, c), d);
}
function bezD2(b: Bez, t: number): Pt {
  const s = 1 - t;
  const a = mul(add(sub(b[2], mul(b[1], 2)), b[0]), 6 * s);
  const c = mul(add(sub(b[3], mul(b[2], 2)), b[1]), 6 * t);
  return add(a, c);
}

function chordParams(p: Pt[], first: number, last: number): number[] {
  const u = [0];
  for (let i = first + 1; i <= last; i++) u.push(u[u.length - 1] + len(sub(p[i], p[i - 1])));
  const total = u[u.length - 1] || 1;
  return u.map((v) => v / total);
}

function generate(p: Pt[], first: number, last: number, u: number[], t1: Pt, t2: Pt): Bez {
  const n = last - first + 1;
  const p0 = p[first];
  const p3 = p[last];
  let c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0;
  for (let i = 0; i < n; i++) {
    const t = u[i];
    const s = 1 - t;
    const b0 = s * s * s;
    const b1 = 3 * t * s * s;
    const b2 = 3 * t * t * s;
    const b3 = t * t * t;
    const a1 = mul(t1, b1);
    const a2 = mul(t2, b2);
    c00 += dot(a1, a1);
    c01 += dot(a1, a2);
    c11 += dot(a2, a2);
    const tmp = sub(p[first + i], add(mul(p0, b0 + b1), mul(p3, b2 + b3)));
    x0 += dot(a1, tmp);
    x1 += dot(a2, tmp);
  }
  const det = c00 * c11 - c01 * c01;
  const seg = len(sub(p3, p0));
  let al = 0;
  let ar = 0;
  if (Math.abs(det) > 1e-12) {
    al = (x0 * c11 - x1 * c01) / det;
    ar = (c00 * x1 - c01 * x0) / det;
  }
  const eps = 1e-6 * seg;
  if (Math.abs(det) <= 1e-12 || al < eps || ar < eps || al > seg * 1.5 || ar > seg * 1.5) {
    const d = seg / 3;
    return [p0, add(p0, mul(t1, d)), add(p3, mul(t2, d)), p3];
  }
  return [p0, add(p0, mul(t1, al)), add(p3, mul(t2, ar)), p3];
}

function maxError(p: Pt[], first: number, last: number, b: Bez, u: number[]): [number, number] {
  let worst = 0;
  let split = Math.floor((last - first + 1) / 2);
  for (let i = 1; i < last - first; i++) {
    const q = bezAt(b, u[i]);
    const d = sub(q, p[first + i]);
    const dist = d[0] * d[0] + d[1] * d[1];
    if (dist >= worst) {
      worst = dist;
      split = i;
    }
  }
  return [worst, first + split];
}

function reparam(p: Pt[], first: number, last: number, u: number[], b: Bez): number[] {
  return u.map((t, i) => {
    const d = sub(bezAt(b, t), p[first + i]);
    const d1 = bezD1(b, t);
    const d2 = bezD2(b, t);
    const num = dot(d, d1);
    const den = dot(d1, d1) + dot(d, d2);
    if (Math.abs(den) < 1e-12) return t;
    const nt = t - num / den;
    return nt < 0 ? 0 : nt > 1 ? 1 : nt;
  });
}

function fitCubic(p: Pt[], first: number, last: number, t1: Pt, t2: Pt, err2: number, out: Bez[], depth = 0) {
  if (last - first === 1) {
    const d = len(sub(p[last], p[first])) / 3;
    out.push([p[first], add(p[first], mul(t1, d)), add(p[last], mul(t2, d)), p[last]]);
    return;
  }
  let u = chordParams(p, first, last);
  let b = generate(p, first, last, u, t1, t2);
  let [e, split] = maxError(p, first, last, b, u);
  if (e < err2) {
    out.push(b);
    return;
  }
  if (e < err2 * 16) {
    for (let i = 0; i < 4; i++) {
      u = reparam(p, first, last, u, b);
      b = generate(p, first, last, u, t1, t2);
      [e, split] = maxError(p, first, last, b, u);
      if (e < err2) {
        out.push(b);
        return;
      }
    }
  }
  if (depth > 40 || split <= first || split >= last) {
    out.push(b);
    return;
  }
  const center = norm(sub(p[split - 1], p[split + 1]));
  fitCubic(p, first, split, t1, center, err2, out, depth + 1);
  fitCubic(p, split, last, mul(center, -1), t2, err2, out, depth + 1);
}

// Remove points that are almost exactly on a straight line between their neighbours
function thin(p: Pt[], tol: number): Pt[] {
  if (p.length < 8) return p;
  const keep: boolean[] = new Array(p.length).fill(false);
  keep[0] = true;
  keep[p.length - 1] = true;
  const stack: [number, number][] = [[0, p.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop() as [number, number];
    let worst = 0;
    let idx = -1;
    const ax = p[a][0], ay = p[a][1];
    const dx = p[b][0] - ax, dy = p[b][1] - ay;
    const l = Math.hypot(dx, dy) || 1e-9;
    for (let i = a + 1; i < b; i++) {
      const dist = Math.abs((p[i][0] - ax) * dy - (p[i][1] - ay) * dx) / l;
      if (dist > worst) {
        worst = dist;
        idx = i;
      }
    }
    if (worst > tol && idx > 0) {
      keep[idx] = true;
      stack.push([a, idx], [idx, b]);
    }
  }
  return p.filter((_, i) => keep[i]);
}

const f1 = (n: number) => {
  const s = n.toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
};


// Fit one run of points. If the run starts and ends at the same point (a full circle),
// split it in the middle first, so the fit works on two normal pieces.
function fitRun(pts: Pt[], t1: Pt, t2: Pt, tolerance: number, out: Bez[]) {
  if (pts.length < 2) return;
  const err2 = tolerance * tolerance;
  const closed = len(sub(pts[0], pts[pts.length - 1])) < 1e-6;
  if (closed && pts.length > 8) {
    const m = Math.floor(pts.length / 2);
    const tm = norm(sub(pts[m + 1], pts[m - 1]));
    const a = thin(pts.slice(0, m + 1), tolerance * 0.15);
    const b = thin(pts.slice(m), tolerance * 0.15);
    fitCubic(a, 0, a.length - 1, t1, mul(tm, -1), err2, out);
    fitCubic(b, 0, b.length - 1, tm, t2, err2, out);
    return;
  }
  const q = thin(pts, tolerance * 0.15);
  if (q.length === 2) {
    out.push([q[0], q[0], q[1], q[1]]);
    return;
  }
  fitCubic(q, 0, q.length - 1, t1, t2, err2, out);
}

// Turn one closed loop of dense edge points into an SVG path piece (smooth curves, sharp corners kept)
export function loopToPath(loop: Pt[], tolerance: number, cornerAngle = 55): string {
  const n = loop.length;
  if (n < 4) return '';
  const k = Math.max(3, Math.min(6, Math.floor(n / 10)));

  // find corners from the turning angle
  const ang = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = sub(loop[i], loop[(i - k + n) % n]);
    const b = sub(loop[(i + k) % n], loop[i]);
    const la = len(a);
    const lb = len(b);
    if (la < 1e-9 || lb < 1e-9) continue;
    const c = Math.max(-1, Math.min(1, dot(a, b) / (la * lb)));
    ang[i] = (Math.acos(c) * 180) / Math.PI;
  }
  const corners: number[] = [];
  for (let i = 0; i < n; i++) {
    if (ang[i] < cornerAngle) continue;
    let isMax = true;
    for (let j = 1; j <= k && isMax; j++) {
      if (ang[(i + j) % n] > ang[i] || ang[(i - j + n) % n] >= ang[i]) isMax = false;
    }
    if (isMax) corners.push(i);
  }

  const curves: Bez[] = [];
  const tangentAt = (pts: Pt[], i: number, dir: 1 | -1): Pt => {
    const j = Math.min(pts.length - 1, Math.max(0, i + dir * 3));
    return norm(sub(pts[j], pts[i]));
  };

  if (corners.length === 0) {
    // one smooth closed curve
    const pts = loop.concat([loop[0]]);
    const t1 = norm(sub(pts[1], pts[pts.length - 2]));
    fitRun(pts, t1, mul(t1, -1), tolerance, curves);
  } else {
    for (let c = 0; c < corners.length; c++) {
      const a = corners[c];
      const b = corners[(c + 1) % corners.length];
      const seg: Pt[] = [];
      let i = a;
      seg.push(loop[i]);
      // walk from this corner to the next one (a full circle when there is only one corner)
      do {
        i = (i + 1) % n;
        seg.push(loop[i]);
      } while (i !== b && seg.length <= n + 1);
      if (seg.length < 2) continue;
      fitRun(seg, tangentAt(seg, 0, 1), tangentAt(seg, seg.length - 1, -1), tolerance, curves);
    }
  }
  if (!curves.length) return '';
  let d = `M${f1(curves[0][0][0])} ${f1(curves[0][0][1])}`;
  for (const c of curves) {
    const straight = c[1] === c[0] && c[2] === c[3];
    d += straight
      ? `L${f1(c[3][0])} ${f1(c[3][1])}`
      : `C${f1(c[1][0])} ${f1(c[1][1])} ${f1(c[2][0])} ${f1(c[2][1])} ${f1(c[3][0])} ${f1(c[3][1])}`;
  }
  return d + 'Z';
}