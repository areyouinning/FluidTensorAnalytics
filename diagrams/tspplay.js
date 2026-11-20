/* Play the traveling salesman. Tap the cities in the order you want to visit them; the tour closes itself
   when every city is used. Your length is compared with the true shortest tour, found by Held–Karp (1962)
   dynamic programming over subsets: n² · 2ⁿ steps, which for 12 cities is about 600,000, instant in a browser.
   Every map is chosen so that the greedy nearest-neighbor rule misses the shortest tour from EVERY starting
   city. "Unroll" peels each tour off the map one road at a time and lays the roads end to end on one ruler. */
import { svg, el, clear, label, controls, button, picker, readouts, rng, calm } from './kit.js';

const BLUE = 'var(--blue)', ORANGE = 'var(--orange)', GREEN = 'var(--green)', INK = 'var(--ink)', SOFT = 'var(--ink-soft)', LINE = 'var(--line)', PANEL = 'var(--panel)';
const SIZES = [6, 8, 10, 12], GAP = .03;           // greedy must be at least 3% longer than the best, from any start
const W = 380, MAPH = 262, H = MAPH + 128, X0 = 18, X1 = W - 18, ROWY = [MAPH + 30, MAPH + 62, MAPH + 94], AXY = H - 12;

export function heldKarp(D) {   // returns { len, tour } for the shortest closed tour through all points
  const n = D.length, F = 1 << (n - 1), INF = 1e18, dp = new Float64Array(F * n).fill(INF), par = new Int8Array(F * n).fill(-1);
  for (let j = 1; j < n; j++) dp[(1 << (j - 1)) * n + j] = D[0][j];
  for (let S = 1; S < F; S++) for (let j = 1; j < n; j++) {
    const bj = 1 << (j - 1); if (!(S & bj)) continue; const cur = dp[S * n + j]; if (cur >= INF) continue;
    for (let k = 1; k < n; k++) { const bk = 1 << (k - 1); if (S & bk) continue; const T = S | bk, v = cur + D[j][k]; if (v < dp[T * n + k]) { dp[T * n + k] = v; par[T * n + k] = j; } }
  }
  let best = INF, last = -1; for (let j = 1; j < n; j++) { const v = dp[(F - 1) * n + j] + D[j][0]; if (v < best) { best = v; last = j; } }
  const tour = []; let S = F - 1, j = last; while (j > 0) { tour.push(j); const p = par[S * n + j]; S &= ~(1 << (j - 1)); j = p; }
  tour.push(0); tour.reverse(); return { len: best, tour };
}
const tourLen = (D, t) => t.reduce((s, c, i) => s + D[c][t[(i + 1) % t.length]], 0);
export function greedy(D) {     // nearest-neighbor from every start city; returns the shortest of those tours
  const n = D.length; let best = null;
  for (let s0 = 0; s0 < n; s0++) {
    const t = [s0], used = new Set(t);
    while (t.length < n) { const a = t[t.length - 1]; let bk = -1; for (let k = 0; k < n; k++) if (!used.has(k) && (bk < 0 || D[a][k] < D[a][bk])) bk = k; t.push(bk); used.add(bk); }
    const len = tourLen(D, t); if (!best || len < best.len - 1e-9) best = { tour: t, len };
  }
  return best;
}

export default function (fig) {
  const s = svg(fig, W, H, 'Cities on a map with a ruler beneath. Tap the cities in order to build a closed tour, compare it with the shortest and the greedy tours, and unroll all of them onto the ruler.');
  const g = el('g', {}, s), u = el('g', {}, s);
  const box = controls(fig), box2 = controls(fig);
  const [youR, bestR, nnR, verdictR] = readouts(fig, ['Your tour', 'Shortest possible', 'Nearest-neighbor', 'Verdict']);
  let n = 8, seed = 1, P = [], D = [], path = [], showBest = false, showNN = false, opt = null, nn = null, wins = 0, scored = false, ur = null, raf = 0;
  try { wins = +localStorage.getItem('fta-tsp-wins') || 0; } catch (e) {}
  const unrollBtn = () => box2.querySelector('[data-unroll]');

  function make() {
    const R = rng(seed * 104729 + n * 31);
    for (;;) {   // draw maps until greedy loses from every start
      P = []; while (P.length < n) { const p = [24 + R() * (W - 48), 22 + R() * (MAPH - 44)]; if (P.every(q => Math.hypot(q[0] - p[0], q[1] - p[1]) > 40)) P.push(p); }
      D = P.map(a => P.map(b => Math.hypot(a[0] - b[0], a[1] - b[1]) / 10));
      opt = heldKarp(D); nn = greedy(D);
      if (nn.len / opt.len - 1 >= GAP) break;
    }
    path = []; showBest = showNN = false; scored = false; stop(); draw();
  }
  const done = () => path.length === n;
  const pathLen = () => path.reduce((sum, c, i) => sum + (i < path.length - 1 || done() ? D[c][path[(i + 1) % path.length]] : 0), 0);
  function poly(t, closed, col, w, dash, op) {
    if (t.length < 2) return; let d = 'M' + t.map(c => P[c][0].toFixed(1) + ' ' + P[c][1].toFixed(1)).join('L'); if (closed) d += 'Z';
    el('path', { d, fill: 'none', stroke: col, 'stroke-width': w, 'stroke-linejoin': 'round', 'stroke-dasharray': dash || '', opacity: op || 1 }, g);
  }
  function draw() {
    clear(g);
    el('line', { x1: 8, x2: W - 8, y1: MAPH, y2: MAPH, stroke: LINE, 'stroke-width': 1 }, g);
    if (showBest) poly(opt.tour, true, GREEN, 8, '', .45);
    if (showNN) poly(nn.tour, true, ORANGE, 3, '7 5', .95);
    poly(path, done(), BLUE, 3.5);
    P.forEach((p, i) => {
      const k = path.indexOf(i), last = k === path.length - 1 && !done();
      const node = el('g', { role: 'button', tabindex: '0', 'aria-label': 'City ' + (i + 1) + (k >= 0 ? ', stop ' + (k + 1) : ''), style: 'cursor:pointer' }, g);
      el('circle', { cx: p[0], cy: p[1], r: 19, fill: 'transparent' }, node);
      el('circle', { cx: p[0], cy: p[1], r: k === 0 ? 12.5 : 10.5, fill: k >= 0 ? BLUE : PANEL, stroke: last ? ORANGE : INK, 'stroke-width': last ? 3 : 2 }, node);
      if (k >= 0) label(node, p[0], p[1] + 4.3, String(k + 1), { size: 12, w: 700, fill: 'var(--on-accent)' });
      const tap = () => { if (done()) return; if (k < 0) path.push(i); else if (last) path.pop(); finishCheck(); stop(); draw(); };
      node.addEventListener('click', tap); node.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(); } });
    });
    if (!ur) label(g, W / 2, MAPH + 62, done() ? 'Tour closed. Press Unroll to lay the tours on the ruler.' : path.length ? 'Tap the next city. Tap the orange-ringed city to take it back.' : 'Tap any city to start.', { size: 12, cls: 'soft' });
    const you = pathLen(), over = done() ? 100 * (you / opt.len - 1) : 0, nnOver = 100 * (nn.len / opt.len - 1);
    const revealed = done() || showBest || ur;
    youR.textContent = done() ? you.toFixed(1) + ' km' : path.length ? you.toFixed(1) + ' km so far (' + path.length + ' of ' + n + ')' : '—';
    bestR.textContent = revealed ? opt.len.toFixed(1) + ' km' : 'press Show the best';
    nnR.textContent = showNN || ur ? nn.len.toFixed(1) + ' km, ' + nnOver.toFixed(1) + '% over' : 'press Nearest-neighbor';
    verdictR.textContent = !done() ? 'wins so far: ' + wins : over < .05 ? 'Shortest! Wins: ' + wins : over.toFixed(1) + '% longer than the best' + (you < nn.len - 1e-9 ? ', but you beat greedy' : '');
    const b = unrollBtn(); if (b) b.textContent = ur ? 'Roll back up' : 'Unroll';
    if (typeof bBest !== 'undefined') { bBest.setAttribute('aria-pressed', showBest); bNN.setAttribute('aria-pressed', showNN); }
    drawUnroll();
  }
  // a map counts once, however many times its best tour is found
  function finishCheck() { if (!scored && done() && pathLen() / opt.len - 1 < .0005) { scored = true; wins++; try { localStorage.setItem('fta-tsp-wins', wins); } catch (e) {} } }

  // ---- unrolling: each road flies from the map to its place on the ruler, keeping its order along the tour
  function rows() {
    const r = [{ name: 'Shortest', col: GREEN, tour: opt.tour, len: opt.len }, { name: 'Nearest-neighbor', col: ORANGE, tour: nn.tour, len: nn.len, dash: true }];
    if (done()) r.unshift({ name: 'Yours', col: BLUE, tour: path.slice(), len: pathLen() });
    return r;
  }
  function start() {
    const R = rows(), top = Math.ceil(Math.max(...R.map(r => r.len)) / 20) * 20;
    ur = { R, sc: (X1 - X0) / top, top, t0: performance.now(), p: calm() ? 1 : 0 }; draw();
    if (!calm()) { const step = now => { ur.p = Math.min(1, (now - ur.t0) / 2600); drawUnroll(); if (ur.p < 1) raf = requestAnimationFrame(step); }; raf = requestAnimationFrame(step); }
  }
  function stop() { cancelAnimationFrame(raf); ur = null; }
  const ease = q => q < .5 ? 2 * q * q : 1 - 2 * (1 - q) * (1 - q);
  function drawUnroll() {
    clear(u); if (!ur) return;
    const { R, sc, top, p } = ur;
    // ruler
    el('line', { x1: X0, x2: X1, y1: AXY - 8, y2: AXY - 8, stroke: SOFT, 'stroke-width': 1 }, u);
    for (let k = 0; k <= top; k += 10) { const x = X0 + k * sc; el('line', { x1: x, x2: x, y1: AXY - 8, y2: AXY - (k % 20 ? 12 : 15), stroke: SOFT, 'stroke-width': 1 }, u); if (k % (top > 120 ? 40 : 20) === 0) label(u, x, AXY + 4, k + (k === top ? ' km' : ''), { size: 12, cls: 'soft' }); }
    R.forEach((r, ri) => {
      const y = ROWY[ri + (R.length === 2 ? 1 : 0)], m = r.tour.length; let cum = 0;
      r.tour.forEach((c, i) => {
        const d = r.tour[(i + 1) % m], A = P[c], B = P[d], len = D[c][d];
        const q = ease(Math.max(0, Math.min(1, (p - .62 * i / m) / .38)));
        const ax = X0 + cum * sc, bx = ax + len * sc; cum += len;
        const mx0 = (A[0] + B[0]) / 2, my0 = (A[1] + B[1]) / 2, mx1 = (ax + bx) / 2;
        let th = Math.atan2(B[1] - A[1], B[0] - A[0]); th = Math.atan2(Math.sin(th), Math.cos(th));
        const ang = th * (1 - q), half = (len * 10 * (1 - q) + len * sc * q) / 2;
        const mx = mx0 + (mx1 - mx0) * q, my = my0 + (y - my0) * q;
        el('line', { x1: mx - half * Math.cos(ang), y1: my - half * Math.sin(ang), x2: mx + half * Math.cos(ang), y2: my + half * Math.sin(ang), stroke: r.col, 'stroke-width': 5, 'stroke-linecap': 'butt', opacity: q > 0 ? 1 : 0 }, u);
        if (q >= 1) el('line', { x1: bx, x2: bx, y1: y - 4, y2: y + 4, stroke: PANEL, 'stroke-width': 1.5 }, u);   // joints between roads
      });
      if (p >= 1) label(u, X0, y - 8, r.name + ' · ' + r.len.toFixed(1) + ' km', { size: 13, a: 'start', fill: r.col, w: 700 });
    });
  }

  picker(box, SIZES.map(k => k + ' cities'), SIZES.indexOf(n), k => { n = SIZES[k]; make(); });
  button(box2, 'Undo', () => { path.pop(); stop(); draw(); });
  const bBest = button(box2, 'Show the best', () => { showBest = !showBest; draw(); });
  const bNN = button(box2, 'Nearest-neighbor', () => { showNN = !showNN; draw(); });
  button(box2, 'Unroll', () => { if (ur) { stop(); draw(); } else start(); }).dataset.unroll = '1';
  button(box2, 'New map', () => { seed++; make(); }, 'go');
  make();
}
