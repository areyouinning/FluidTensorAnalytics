/* The coastline paradox. Walk a pair of dividers along an invented coast: each step is one ruler length.
   Shorter rulers find more wiggles, so the measured length grows. On a log–log plot of length against
   ruler the points fall on a line of slope 1 − D, Richardson's empirical law L(ε) = F·ε^(1−D), and
   Mandelbrot's reading of D as a fractional dimension.
   The rugged coasts are random Koch curves: every segment is replaced by four, each 1/(2(1+cos θ)) as long,
   with the bump on a random side. That makes the dimension exactly D = log 4 / log(2(1+cos θ)),
   so θ is chosen from the D we want. The smooth coast is a sum of two sine waves (D = 1). */
import { svg, el, clear, label, controls, slider, button, picker, readouts, rng, calm } from './kit.js';

const BLUE = 'var(--blue)', ORANGE = 'var(--orange)', GREEN = 'var(--green)', INK = 'var(--ink)', SOFT = 'var(--ink-soft)', LINE = 'var(--line)', SUNK = 'var(--sunk)';
const W = 380, CH = 196, PY0 = 226, PY1 = 352, PX0 = 46, PX1 = W - 14, H = 380;
const KM = 2;                         // kilometres per drawing unit
const EMAX = 160, EMIN = 3;           // ruler range, km
const SHAPES = [
  { name: 'Rugged, D = 1.25', D: 1.25, note: 'as rough as the west coast of Britain' },
  { name: 'Gentle, D = 1.13', D: 1.13, note: 'about as rough as the coast of Australia' },
  { name: 'Smooth, D = 1', D: 1, note: 'a smooth curve' }];

function coast(D, seed) {
  let pts;
  if (D === 1) {
    const ph = rng(seed)(); pts = []; for (let i = 0; i <= 4096; i++) { const x = i / 4096; pts.push([x, .18 * Math.sin(2 * Math.PI * (1.3 * x + ph)) + .07 * Math.sin(2 * Math.PI * (4.1 * x + 3 * ph))]); }
  } else {
    const R = rng(seed), th = Math.acos(Math.pow(4, 1 / D) / 2 - 1), r = 1 / (2 * (1 + Math.cos(th)));
    pts = [[0, 0], [1, 0]];
    for (let lev = 0; lev < 7; lev++) {
      const nx = [pts[0]];
      for (let i = 0; i + 1 < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay, s = R() < .5 ? 1 : -1;
        const p1 = [ax + r * dx, ay + r * dy], p3 = [bx - r * dx, by - r * dy];
        const c = Math.cos(s * th), sn = Math.sin(s * th);
        nx.push(p1, [p1[0] + r * (c * dx - sn * dy), p1[1] + r * (sn * dx + c * dy)], p3, [bx, by]);
      }
      pts = nx;
    }
  }
  // scale uniformly (so the dimension is unchanged) to fill the map box
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const k = Math.min((W - 28) / (x1 - x0), (CH - 28) / (y1 - y0)), ox = (W - k * (x1 - x0)) / 2, oy = (CH - k * (y1 - y0)) / 2;
  return pts.map(([x, y]) => [ox + k * (x - x0), oy + k * (y - y0)]);
}

// dividers: from the current point, the next hinge is the first point further along the coast exactly e away
export function walk(pts, e) {
  const hinge = [pts[0]]; let c = pts[0], i = 0, steps = 0;
  for (;;) {
    let k = i + 1; while (k < pts.length && Math.hypot(pts[k][0] - c[0], pts[k][1] - c[1]) < e) k++;
    if (k >= pts.length) { const last = pts[pts.length - 1], rest = Math.hypot(last[0] - c[0], last[1] - c[1]); hinge.push(last); return { hinge, steps, len: steps * e + rest }; }
    const [ax, ay] = pts[k - 1], [bx, by] = pts[k], dx = bx - ax, dy = by - ay, fx = ax - c[0], fy = ay - c[1];
    const A = dx * dx + dy * dy, B = 2 * (fx * dx + fy * dy), C0 = fx * fx + fy * fy - e * e, t = (-B + Math.sqrt(Math.max(0, B * B - 4 * A * C0))) / (2 * A);
    c = [ax + t * dx, ay + t * dy]; i = k - 1; steps++; hinge.push(c);
  }
}

export default function (fig) {
  const s = svg(fig, W, H, 'An invented coastline measured with a pair of dividers, and a log–log plot of measured length against ruler length.');
  const g = el('g', {}, s);
  const box = controls(fig), box2 = controls(fig);
  const [rulerR, stepsR, lenR, dimR] = readouts(fig, ['Ruler', 'Steps', 'Measured length', 'Fitted dimension D']);
  let shape = 0, seed = 7, v = .35, pts = [], sweep = [], fit = null, shown = Infinity, raf = 0;
  const eps = () => EMAX * Math.pow(EMIN / EMAX, v);

  function build() {
    pts = coast(SHAPES[shape].D, seed * 7919 + shape);
    sweep = []; for (let j = 0; j <= 20; j++) { const e = EMAX * Math.pow(EMIN / EMAX, j / 20); sweep.push([e, walk(pts, e / KM).len * KM]); }
    // least squares on log L against log e over the shorter rulers (3–22 km): slope = 1 − D
    const fitPts = sweep.slice(10), X = fitPts.map(p => Math.log(p[0])), Y = fitPts.map(p => Math.log(p[1])), mx = X.reduce((a, b) => a + b) / X.length, my = Y.reduce((a, b) => a + b) / Y.length;
    const sl = X.reduce((a, x, i) => a + (x - mx) * (Y[i] - my), 0) / X.reduce((a, x) => a + (x - mx) ** 2, 0);
    fit = { sl, b: my - sl * mx };
    draw();
  }
  function draw() {
    clear(g);
    const e = eps(), wk = walk(pts, e / KM), n = Math.min(shown, wk.hinge.length);
    // sea below the coast, land above
    el('path', { d: 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + `L${W - 14} ${CH}L14 ${CH}Z`, fill: 'color-mix(in srgb, var(--blue) 16%, transparent)' }, g);
    el('path', { d: 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L'), fill: 'none', stroke: INK, 'stroke-width': 1.1, 'stroke-linejoin': 'round' }, g);
    const H2 = wk.hinge.slice(0, n);
    if (H2.length > 1) el('path', { d: 'M' + H2.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L'), fill: 'none', stroke: ORANGE, 'stroke-width': 2.4, 'stroke-linejoin': 'round' }, g);
    if (e / KM > 4) H2.forEach(p => el('circle', { cx: p[0], cy: p[1], r: 2.6, fill: ORANGE }, g));
    // a scale bar for the ruler
    el('line', { x1: 16, x2: 16 + e / KM, y1: CH + 8, y2: CH + 8, stroke: ORANGE, 'stroke-width': 3 }, g);
    label(g, 20 + Math.max(e / KM, 2), CH + 12, 'ruler ' + e.toFixed(e < 10 ? 1 : 0) + ' km', { size: 11, a: 'start', fill: ORANGE });
    // log–log plot
    const lx = Math.log(EMIN), hx = Math.log(EMAX), Ls = sweep.map(p => Math.log(p[1]));
    let ly = Math.min(...Ls), hy = Math.max(...Ls); if (hy - ly < .5) { const m = (hy + ly) / 2; ly = m - .25; hy = m + .25; }
    const X = le => PX1 - (le - lx) / (hx - lx) * (PX1 - PX0), Y = ll => PY1 - (ll - ly) / (hy - ly) * (PY1 - PY0 - 14) - 4;
    el('rect', { x: PX0, y: PY0, width: PX1 - PX0, height: PY1 - PY0, fill: SUNK, rx: 6 }, g);
    [3, 10, 30, 100].forEach(k => { const x = X(Math.log(k)); el('line', { x1: x, x2: x, y1: PY1, y2: PY1 + 4, stroke: SOFT }, g); label(g, x, PY1 + 15, k + (k === 100 ? ' km ruler' : ''), { size: 10, cls: 'soft' }); });
    label(g, PX0 + 6, PY0 + 14, 'measured length (log scale)', { size: 10, a: 'start', cls: 'soft' });
    label(g, PX0 - 4, Y(ly) + 4, Math.round(Math.exp(ly)), { size: 10, a: 'end', cls: 'soft' });
    label(g, PX0 - 4, Y(hy) + 4, Math.round(Math.exp(hy)), { size: 10, a: 'end', cls: 'soft' });
    el('line', { x1: X(lx), y1: Y(fit.b + fit.sl * lx), x2: X(hx), y2: Y(fit.b + fit.sl * hx), stroke: GREEN, 'stroke-width': 2, 'stroke-dasharray': '5 4' }, g);
    sweep.forEach(([pe, pl]) => el('circle', { cx: X(Math.log(pe)), cy: Y(Math.log(pl)), r: 3, fill: BLUE, opacity: .55 }, g));
    el('circle', { cx: X(Math.log(e)), cy: Y(Math.log(wk.len * KM)), r: 6, fill: ORANGE, stroke: 'var(--panel)', 'stroke-width': 2 }, g);
    rulerR.textContent = e.toFixed(e < 10 ? 1 : 0) + ' km';
    stepsR.textContent = n >= wk.hinge.length ? wk.steps + (wk.hinge.length > 1 ? ' + a bit' : '') : String(n - 1);
    lenR.textContent = n >= wk.hinge.length ? Math.round(wk.len * KM).toLocaleString() + ' km' : '…';
    dimR.textContent = (1 - fit.sl).toFixed(2) + ' (built as ' + SHAPES[shape].D + ')';
  }
  function play() {
    cancelAnimationFrame(raf);
    const total = walk(pts, eps() / KM).hinge.length; if (calm()) { shown = Infinity; draw(); return; }
    const t0 = performance.now(), step = now => { shown = 1 + Math.floor((total - 1) * Math.min(1, (now - t0) / 1800)); draw(); if (shown < total) raf = requestAnimationFrame(step); else shown = Infinity; };
    raf = requestAnimationFrame(step);
  }

  picker(box, SHAPES.map(x => x.name), shape, k => { shape = k; cancelAnimationFrame(raf); shown = Infinity; build(); });
  slider(box2, 'Ruler', 0, 1, .005, v, x => { const e = EMAX * Math.pow(EMIN / EMAX, x); return e.toFixed(e < 10 ? 1 : 0) + ' km'; }, x => { v = +x; cancelAnimationFrame(raf); shown = Infinity; draw(); });
  button(box2, 'Walk the dividers', play);
  button(box2, 'New coast', () => { seed++; cancelAnimationFrame(raf); shown = Infinity; build(); }, 'go');
  build();
}
