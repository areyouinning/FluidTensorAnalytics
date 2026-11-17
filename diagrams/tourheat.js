/* Every tour of a few cities, weighted by temperature. Each tour of length L gets the Boltzmann weight
   e^(−L/T); Z(T) is the sum of the weights over all tours. Hot, every tour counts about equally. Cold, only
   the shortest survives, and −T·ln Z(T) falls to the shortest length exactly. The map draws each road with
   the share of the total weight carried by tours that use it; the bars are the tours sorted by length, with
   their share of the weight. All (n−1)!/2 tours are listed, so nothing is sampled. */
import { svg, el, clear, label, controls, slider, button, readouts, rng } from './kit.js';

const BLUE = 'var(--blue)', ORANGE = 'var(--orange)', GREEN = 'var(--green)', INK = 'var(--ink)', SOFT = 'var(--ink-soft)', LINE = 'var(--line)', SUNK = 'var(--sunk)';

export default function (fig) {
  const s = svg(fig, 380, 226, 'Left: cities joined by roads, drawn thicker the more the weighted tours use them. Right: every tour as a bar by length, with its share of the weight.');
  const g = el('g', {}, s);
  const box = controls(fig);
  const [zR, minR, shareR] = readouts(fig, ['From the sum: −T · ln Z', 'Shortest tour, by checking all', 'Weight on the shortest']);
  let n = 7, seed = 3, lt = 0, P = [], tours = [];   // lt = log10 of temperature

  function build() {
    const R = rng(seed * 7919 + n); P = Array.from({ length: n }, () => [14 + R() * 152, 22 + R() * 150]);
    const d = (a, b) => Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1]) / 100;
    tours = [];
    (function perm(path, rest) {
      if (!rest.length) { if (path[1] < path[path.length - 1]) { let L = 0; for (let i = 0; i < n; i++) L += d(path[i], path[(i + 1) % n]); tours.push({ path: path.slice(), L }); } return; }   // each loop once, not once per direction
      rest.forEach((c, i) => perm(path.concat(c), rest.filter((_, j) => j !== i)));
    })([0], Array.from({ length: n - 1 }, (_, i) => i + 1));
    tours.sort((a, b) => a.L - b.L); draw();
  }
  function draw() {
    clear(g);
    const T = 10 ** lt, Lmin = tours[0].L, w = tours.map(t => Math.exp(-(t.L - Lmin) / T)), Zs = w.reduce((a, b) => a + b, 0);
    const free = Lmin - T * Math.log(Zs);                       // −T ln Z, with the e^(−Lmin/T) factor taken out so nothing underflows
    const use = {}; tours.forEach((t, k) => { for (let i = 0; i < n; i++) { const a = t.path[i], b = t.path[(i + 1) % n], key = a < b ? a + '-' + b : b + '-' + a; use[key] = (use[key] || 0) + w[k] / Zs; } });
    for (const key in use) { const [a, b] = key.split('-').map(Number), p = use[key]; if (p > .004) el('line', { x1: P[a][0], y1: P[a][1], x2: P[b][0], y2: P[b][1], stroke: p > .98 ? GREEN : BLUE, 'stroke-width': .6 + 5 * p, 'stroke-linecap': 'round', opacity: .25 + .75 * p }, g); }
    P.forEach(p => el('circle', { cx: p[0], cy: p[1], r: 5, fill: INK }, g));
    label(g, 90, 200, T < .03 ? 'cold: one tour is left' : T > 1 ? 'hot: every tour counts' : 'cooling', { size: 11, cls: 'soft' });
    // tours as bars, shortest at the left: grey = length, orange = share of the weight
    const x0 = 206, x1 = 372, y0 = 176, N = tours.length, bw = (x1 - x0) / N, Lmax = tours[N - 1].L, wmax = w[0] / Zs;
    let dl = '', dw = '';
    tours.forEach((t, k) => { const x = x0 + k * bw; dl += `M${x.toFixed(2)} ${y0}V${(y0 - 60 * t.L / Lmax).toFixed(1)}h${bw.toFixed(2)}V${y0}Z`; const h = 150 * (w[k] / Zs) / Math.max(wmax, 1e-9) * Math.min(1, wmax * 4 + .25); if (h > .3) dw += `M${x.toFixed(2)} ${y0}V${(y0 - h).toFixed(1)}h${Math.max(bw, .8).toFixed(2)}V${y0}Z`; });
    el('path', { d: dl, fill: SOFT, opacity: .35 }, g); el('path', { d: dw, fill: ORANGE, opacity: .9 }, g);
    el('line', { x1: x0, y1: y0, x2: x1, y2: y0, stroke: INK }, g);
    label(g, (x0 + x1) / 2, y0 + 14, 'all ' + N.toLocaleString() + ' tours, shortest first →', { size: 10, cls: 'soft' });
    label(g, (x0 + x1) / 2, 14, 'grey: length · orange: weight', { size: 10, cls: 'soft' });
    zR.textContent = free.toFixed(3) + (Math.abs(free - Lmin) < .0005 ? ' — matches' : '');
    minR.textContent = Lmin.toFixed(3);
    shareR.textContent = (100 * w[0] / Zs).toFixed(w[0] / Zs > .999 ? 2 : 1) + '%';
  }
  slider(box, 'Temperature ', -2.2, .6, .02, lt, v => (10 ** v).toFixed(v < -1 ? 3 : 2), v => { lt = v; draw(); });
  slider(box, 'Cities ', 4, 8, 1, n, v => String(v), v => { n = v; build(); });
  button(box, 'New map', () => { seed++; build(); }, 'go');
  build();
}
