/* Optimal stopping on a one-way river. N campsites go by in random order of quality; you cannot paddle
   back. Rule: drift past the first k just looking, then take the first site better than all of those.
   The chance of landing the single best is P(k) = (k/N) * sum_{j=k+1..N} 1/(j-1), which peaks near
   k = N/e at about 1/e = 36.8%. The strip on top is one trip; the curve below is every cutoff. */
import { svg, el, clear, label, controls, slider, button, readouts, rng } from './kit.js';

const BLUE = 'var(--blue)', ORANGE = 'var(--orange)', GREEN = 'var(--green)', INK = 'var(--ink)', SOFT = 'var(--ink-soft)', LINE = 'var(--line)', SUNK = 'var(--sunk)';

export default function (fig) {
  const s = svg(fig, 380, 250, 'One trip down a river of campsites on top, and below it the chance of picking the best site for every possible cutoff.');
  const g = el('g', {}, s);
  const box = controls(fig), box2 = controls(fig);
  const [exR, simR, bestR] = readouts(fig, ['Chance of the best', 'Your trips', 'Best cutoff']);
  let N = 20, k = 7, seed = 11, wins = 0, trips = 0, ks;
  const P = (k, N) => { if (k === 0) return 1 / N; let t = 0; for (let j = k + 1; j <= N; j++) t += 1 / (j - 1); return k / N * t; };
  function trip(R) {   // returns { q: qualities, pick: index chosen, best: index of best }
    const q = Array.from({ length: N }, () => R()); let m = -1, pick = N - 1;
    for (let i = 0; i < k; i++) m = Math.max(m, q[i]);
    for (let i = k; i < N; i++) if (q[i] > m) { pick = i; break; }
    return { q, pick, best: q.indexOf(Math.max(...q)) };
  }
  function draw() {
    clear(g);
    const t = trip(rng(seed)), x0 = 16, w = 348 / N;
    label(g, 16, 14, 'One trip downstream →', { a: 'start', size: 11, cls: 'soft' });
    el('path', { d: `M${x0} 84H${x0 + 348}`, stroke: BLUE, 'stroke-width': 3, opacity: .5 }, g);
    t.q.forEach((v, i) => {
      const h = 8 + v * 50, x = x0 + i * w, looked = i < k, passed = i > t.pick;
      el('rect', { x: x + 1, y: 82 - h, width: Math.max(2, w - 2), height: h, rx: 2, fill: i === t.pick ? (t.pick === t.best ? GREEN : ORANGE) : looked ? SOFT : SUNK, stroke: i === t.best ? GREEN : LINE, 'stroke-width': i === t.best ? 2.5 : 1, opacity: passed ? .45 : 1 }, g);
    });
    if (k > 0) { el('line', { x1: x0 + k * w, y1: 18, x2: x0 + k * w, y2: 90, stroke: INK, 'stroke-dasharray': '3 3' }, g); label(g, x0 + k * w / 2, 100, 'just look', { size: 10, cls: 'soft' }); }
    label(g, 190, 114, t.pick === t.best ? 'Camped at the best site.' : 'Camped at a lesser site; the best has a green outline.', { size: 11, w: 600, fill: t.pick === t.best ? GREEN : ORANGE });
    // the curve of P(k)
    const cx0 = 34, cx1 = 364, cy0 = 226, cy1 = 136, X = v => cx0 + v / N * (cx1 - cx0), Y = p => cy0 - p / 0.5 * (cy0 - cy1);
    el('path', { d: `M${cx0} ${cy1}V${cy0}H${cx1}`, fill: 'none', stroke: INK, 'stroke-width': 1.5 }, g);
    el('line', { x1: cx0, y1: Y(1 / Math.E), x2: cx1, y2: Y(1 / Math.E), stroke: SOFT, 'stroke-dasharray': '2 4' }, g);
    label(g, cx1, Y(1 / Math.E) - 4, '1/e ≈ 37%', { a: 'end', size: 10, cls: 'soft' });
    label(g, cx0 - 4, cy1 + 4, '50%', { a: 'end', size: 10, cls: 'soft' }); label(g, cx0 - 4, cy0 + 3, '0', { a: 'end', size: 10, cls: 'soft' });
    let d = ''; for (let i = 0; i < N; i++) d += (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(P(i, N)).toFixed(1);
    el('path', { d, fill: 'none', stroke: BLUE, 'stroke-width': 2.5 }, g);
    el('circle', { cx: X(k), cy: Y(P(k, N)), r: 5, fill: ORANGE, stroke: INK, 'stroke-width': 1.5 }, g);
    label(g, (cx0 + cx1) / 2, 244, 'sites you only look at, before you are willing to stop →', { size: 10, cls: 'soft' });
    let bk = 0; for (let i = 1; i < N; i++) if (P(i, N) > P(bk, N)) bk = i;
    exR.textContent = (P(k, N) * 100).toFixed(1) + '%';
    simR.textContent = trips ? wins + ' of ' + trips + ' (' + (100 * wins / trips).toFixed(1) + '%)' : 'none yet';
    bestR.textContent = 'look at ' + bk + ' of ' + N + ' (' + (100 * bk / N).toFixed(0) + '%)';
  }
  const clearRuns = () => { wins = 0; trips = 0; };
  slider(box, 'Campsites ', 5, 60, 1, N, v => String(v), v => { N = v; if (k > N - 1) { k = N - 1; } ks.max = N - 1; ks.value = k; clearRuns(); ks.dispatchEvent(new Event('input')); });
  ks = slider(box, 'Just look at the first ', 0, N - 1, 1, k, v => String(v), v => { k = v; clearRuns(); draw(); });
  button(box2, 'New trip', () => { seed = (seed * 48271) % 2147483647; const t = trip(rng(seed)); trips++; if (t.pick === t.best) wins++; draw(); }, 'go');
  button(box2, 'Take 1000 trips', () => { const R = rng(seed + 977); for (let i = 0; i < 1000; i++) { const t = trip(R); trips++; if (t.pick === t.best) wins++; } draw(); });
  draw();
}
