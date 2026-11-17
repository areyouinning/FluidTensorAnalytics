/* Play the travelling salesman. Tap the cities in the order you want to visit them; the tour closes itself
   when every city is used. Your length is compared with the true shortest tour, found by Held–Karp (1962)
   dynamic programming over subsets: n² · 2ⁿ steps, which for 12 cities is about 600,000, instant in a browser.
   The Nearest-neighbour button shows the greedy tour for comparison. */
import { svg, el, clear, label, controls, button, picker, readouts, rng } from './kit.js';

const BLUE = 'var(--blue)', ORANGE = 'var(--orange)', GREEN = 'var(--green)', INK = 'var(--ink)', SOFT = 'var(--ink-soft)', LINE = 'var(--line)', PANEL = 'var(--panel)';
const SIZES = [6, 8, 10, 12];

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

export default function (fig) {
  const W = 380, H = 280, s = svg(fig, W, H, 'Cities on a map. Tap them in order to build a closed tour, then compare its length with the shortest possible.');
  const g = el('g', {}, s);
  const box = controls(fig), box2 = controls(fig);
  const [youR, bestR, verdictR] = readouts(fig, ['Your tour', 'Shortest possible', 'Verdict']);
  let n = 8, seed = 1, P = [], D = [], path = [], show = 0, opt = null, nn = null, wins = 0, scored = false;
  try { wins = +localStorage.getItem('fta-tsp-wins') || 0; } catch (e) {}

  function make() {
    const R = rng(seed * 104729 + n * 31);
    P = []; while (P.length < n) { const p = [24 + R() * (W - 48), 24 + R() * (H - 60)]; if (P.every(q => Math.hypot(q[0] - p[0], q[1] - p[1]) > 40)) P.push(p); }
    D = P.map(a => P.map(b => Math.hypot(a[0] - b[0], a[1] - b[1]) / 10));
    opt = heldKarp(D);
    // greedy: always go to the nearest city not yet visited
    const t = [0], used = new Set([0]); while (t.length < n) { const a = t[t.length - 1]; let bk = -1; for (let k = 0; k < n; k++) if (!used.has(k) && (bk < 0 || D[a][k] < D[a][bk])) bk = k; t.push(bk); used.add(bk); }
    nn = { tour: t, len: t.reduce((sum, c, i) => sum + D[c][t[(i + 1) % n]], 0) };
    path = []; show = 0; scored = false; draw();
  }
  const length = t => t.reduce((sum, c, i) => sum + (i < t.length - 1 || t.length === n ? D[c][t[(i + 1) % t.length]] : 0), 0);
  function poly(t, closed, col, w, dash, op) {
    if (t.length < 2) return; let d = 'M' + t.map(c => P[c][0].toFixed(1) + ' ' + P[c][1].toFixed(1)).join('L'); if (closed) d += 'Z';
    el('path', { d, fill: 'none', stroke: col, 'stroke-width': w, 'stroke-linejoin': 'round', 'stroke-dasharray': dash || '', opacity: op || 1 }, g);
  }
  function draw() {
    clear(g);
    const done = path.length === n;
    if (show === 1) poly(opt.tour, true, GREEN, 7, '', .45);
    if (show === 2) poly(nn.tour, true, ORANGE, 3, '7 5', .9);
    poly(path, done, BLUE, 3.5);
    P.forEach((p, i) => {
      const k = path.indexOf(i), node = el('g', { role: 'button', tabindex: '0', 'aria-label': 'City ' + (i + 1) + (k >= 0 ? ', stop ' + (k + 1) : ''), style: 'cursor:pointer' }, g);
      el('circle', { cx: p[0], cy: p[1], r: 19, fill: 'transparent' }, node);
      el('circle', { cx: p[0], cy: p[1], r: k === 0 ? 12.5 : 10.5, fill: k >= 0 ? BLUE : PANEL, stroke: k === path.length - 1 && !done ? ORANGE : INK, 'stroke-width': k === path.length - 1 && !done ? 3 : 2 }, node);
      if (k >= 0) label(node, p[0], p[1] + 4.3, String(k + 1), { size: 12, w: 700, fill: 'var(--on-accent)' });
      const tap = () => { if (done) return; if (k < 0) path.push(i); else if (k === path.length - 1) path.pop(); finishCheck(); draw(); };
      node.addEventListener('click', tap); node.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(); } });
    });
    label(g, W / 2, H - 10, done ? 'Tour closed. Compare it below, or press Undo to change the end.' : path.length ? 'Tap the next city. Tap the orange-ringed city to take it back.' : 'Tap any city to start.', { size: 11, cls: 'soft' });
    const you = length(path), over = done ? 100 * (you / opt.len - 1) : 0;
    youR.textContent = done ? you.toFixed(1) + ' km' : path.length ? you.toFixed(1) + ' km so far (' + path.length + ' of ' + n + ')' : '—';
    bestR.textContent = done || show === 1 ? opt.len.toFixed(1) + ' km' : 'press Show the best';
    verdictR.textContent = !done ? (show === 2 ? 'greedy tour: ' + (100 * (nn.len / opt.len - 1)).toFixed(1) + '% longer than the best' : 'wins so far: ' + wins) : over < .05 ? 'Shortest! Wins: ' + wins : over.toFixed(1) + '% longer than the best';
  }
  // a map counts once, however many times its best tour is found
  function finishCheck() { if (!scored && path.length === n && length(path) / opt.len - 1 < .0005) { scored = true; wins++; try { localStorage.setItem('fta-tsp-wins', wins); } catch (e) {} } }

  picker(box, SIZES.map(k => k + ' cities'), SIZES.indexOf(n), k => { n = SIZES[k]; make(); });
  button(box2, 'Undo', () => { path.pop(); draw(); });
  button(box2, 'Show the best', () => { show = show === 1 ? 0 : 1; draw(); });
  button(box2, 'Nearest-neighbour', () => { show = show === 2 ? 0 : 2; draw(); });
  button(box2, 'New map', () => { seed++; make(); }, 'go');
  make();
}
