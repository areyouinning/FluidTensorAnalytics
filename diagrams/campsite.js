/* Optimal stopping on a one-way river. N campsites go by in random order of quality; you cannot paddle
   back. Rule: drift past the first k just looking, then take the first site better than all of those.
   The chance of landing the single best is P(k) = (k/N) * sum_{j=k+1..N} 1/(j-1), which peaks near
   k = N/e at about 1/e = 36.8%.
   Top: one raft trip. Each campsite stands on the bank, its height how good it is. The raft drifts down
   the river, only looking at the first k; the best of those sets the bar to beat (dashed), and the raft
   pulls in at the first site that clears it. Below: the chance of the best for every cutoff. */
import { svg, el, clear, label, controls, slider, button, readouts, rng, calm } from './kit.js';

const BLUE = 'var(--blue)', ORANGE = 'var(--orange)', GREEN = 'var(--green)', INK = 'var(--ink)', SOFT = 'var(--ink-soft)', LINE = 'var(--line)', SUNK = 'var(--sunk)', PANEL = 'var(--panel)';

export default function (fig) {
  const s = svg(fig, 380, 300, 'A raft trip down a river past campsites of different quality, with the bar set by the sites only looked at; below, the chance of picking the best site for every cutoff.');
  const g = el('g', {}, s);
  const box = controls(fig), box2 = controls(fig);
  const [exR, simR, bestR] = readouts(fig, ['Chance of the best', 'Your trips', 'Best cutoff']);
  let N = 20, k = 7, seed = 11, wins = 0, trips = 0, ks, at = null, anim = 0;
  const P = (k, N) => { if (k === 0) return 1 / N; let t = 0; for (let j = k + 1; j <= N; j++) t += 1 / (j - 1); return k / N * t; };
  function trip(R) {   // { q: qualities, pick: index chosen, best: index of best, bar: best seen while looking, forced: no site beat it }
    const q = Array.from({ length: N }, () => R()); let m = -1, pick = -1;
    for (let i = 0; i < k; i++) m = Math.max(m, q[i]);
    for (let i = k; i < N; i++) if (q[i] > m) { pick = i; break; }
    const forced = pick < 0; if (forced) pick = N - 1;
    return { q, pick, best: q.indexOf(Math.max(...q)), bar: m, forced };
  }
  const X0 = 22, X1 = 362, BANK = 98, H = 58;
  function draw() {
    clear(g);
    const t = trip(rng(seed)), w = (X1 - X0) / N, cx = i => X0 + (i + .5) * w;
    const raft = at === null ? t.pick : Math.min(at, t.pick), done = raft >= t.pick;   // where the raft is, in site units
    label(g, 16, 14, 'One raft trip, downstream →', { a: 'start', size: 11, w: 600 });
    label(g, 364, 14, 'height = how good the site is', { a: 'end', size: 10, cls: 'soft' });
    // the river, with a few ripples
    el('path', { d: `M8 ${BANK + 4}H372V${BANK + 26}H8Z`, fill: BLUE, opacity: .22 }, g);
    for (let j = 0; j < 6; j++) { const x = 20 + j * 62; el('path', { d: `M${x} ${BANK + 15} q6 -4 12 0 t12 0`, fill: 'none', stroke: BLUE, 'stroke-width': 1.4, opacity: .7 }, g); }
    // the looking stretch
    if (k > 0) { el('rect', { x: X0, y: 22, width: k * w, height: BANK - 22, fill: SOFT, opacity: .08 }, g);
      el('line', { x1: X0 + k * w, y1: 22, x2: X0 + k * w, y2: BANK + 26, stroke: INK, 'stroke-dasharray': '3 3' }, g);
      label(g, X0 + k * w / 2, BANK + 40, 'just look', { size: 10, cls: 'soft' });
      label(g, X0 + k * w + (X1 - X0 - k * w) / 2, BANK + 40, 'take the first site over the bar', { size: 10, cls: 'soft' }); }
    // campsites: a post whose height is quality, a little tent at its foot
    t.q.forEach((v, i) => {
      const h = 6 + v * H, x = cx(i), looked = i < k, seen = i <= raft, chosen = done && i === t.pick;
      const fill = chosen ? (t.pick === t.best ? GREEN : ORANGE) : !seen ? SUNK : looked ? SOFT : PANEL;
      el('rect', { x: x - Math.max(1, w / 2 - 1.5), y: BANK - h, width: Math.max(2, w - 3), height: h, rx: 2, fill, stroke: done && i === t.best ? GREEN : LINE, 'stroke-width': done && i === t.best ? 2.5 : 1, opacity: done && i > t.pick ? .4 : 1 }, g);
      if (w >= 9) el('path', { d: `M${x - 4} ${BANK}L${x} ${BANK - 6}L${x + 4} ${BANK}Z`, fill: chosen ? fill : SOFT, opacity: seen ? .9 : .35 }, g);
    });
    // the bar to beat: the best site seen while only looking
    if (k > 0 && raft >= k - 1) { const y = BANK - (6 + t.bar * H);
      el('line', { x1: X0, y1: y, x2: X1, y2: y, stroke: ORANGE, 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }, g);
      label(g, X1, y - 4, 'bar to beat', { a: 'end', size: 10, w: 600, fill: ORANGE }); }
    // the raft
    const rx = X0 + Math.max(0, raft) * w + w / 2;
    const r = el('g', { transform: `translate(${rx.toFixed(1)} ${BANK + 15})` }, g);
    el('rect', { x: -9, y: -4, width: 18, height: 8, rx: 3, fill: '#a0703c', stroke: INK, 'stroke-width': 1.2 }, r);
    el('circle', { cx: 0, cy: -9, r: 3.2, fill: INK }, r);
    // what happened
    let msg, col = ORANGE;
    if (!done) msg = raft < k ? 'Just looking. The best so far sets the bar.' : 'Looking for the first site over the bar…';
    else if (t.pick === t.best) { msg = 'Camped at the best site on the river.'; col = GREEN; }
    else if (t.forced) msg = 'The best (green) went by while you looked, so you took the last site.';   // forced exactly when the best was in the looking stretch
    else msg = 'Pulled in at the first site over the bar; a better one (green) came later.';
    label(g, 190, BANK + 58, msg, { size: 11.5, w: 600, fill: done ? col : SOFT });
    // the curve of P(k)
    const cx0 = 34, cx1 = 364, cy0 = 278, cy1 = 184, X = v => cx0 + v / N * (cx1 - cx0), Y = p => cy0 - p / 0.5 * (cy0 - cy1);
    el('path', { d: `M${cx0} ${cy1}V${cy0}H${cx1}`, fill: 'none', stroke: INK, 'stroke-width': 1.5 }, g);
    el('line', { x1: cx0, y1: Y(1 / Math.E), x2: cx1, y2: Y(1 / Math.E), stroke: SOFT, 'stroke-dasharray': '2 4' }, g);
    label(g, cx1, Y(1 / Math.E) - 4, '1/e ≈ 37%', { a: 'end', size: 10, cls: 'soft' });
    label(g, cx0 - 4, cy1 + 4, '50%', { a: 'end', size: 10, cls: 'soft' }); label(g, cx0 - 4, cy0 + 3, '0', { a: 'end', size: 10, cls: 'soft' });
    label(g, cx0 + 4, cy1 - 6, 'chance of camping at the very best site', { a: 'start', size: 10, cls: 'soft' });
    let d = ''; for (let i = 0; i < N; i++) d += (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(P(i, N)).toFixed(1);
    el('path', { d, fill: 'none', stroke: BLUE, 'stroke-width': 2.5 }, g);
    el('circle', { cx: X(k), cy: Y(P(k, N)), r: 5, fill: ORANGE, stroke: INK, 'stroke-width': 1.5 }, g);
    label(g, (cx0 + cx1) / 2, 296, 'sites you only look at, before you are willing to stop →', { size: 10, cls: 'soft' });
    let bk = 0; for (let i = 1; i < N; i++) if (P(i, N) > P(bk, N)) bk = i;
    exR.textContent = (P(k, N) * 100).toFixed(1) + '%';
    simR.textContent = trips ? wins + ' of ' + trips + ' (' + (100 * wins / trips).toFixed(1) + '%)' : 'none yet';
    bestR.textContent = 'look at ' + bk + ' of ' + N + ' (' + (100 * bk / N).toFixed(0) + '%)';
  }
  function float() {   // the raft drifts down to its campsite, about 2.4 s for a full river
    cancelAnimationFrame(anim); if (calm()) { at = null; draw(); return; }
    const t = trip(rng(seed)), dur = 120 * (t.pick + 1) + 200, t0 = performance.now();
    const step = now => { at = (now - t0) / dur * (t.pick + 1) - .5; draw(); if (at < t.pick) anim = requestAnimationFrame(step); else { at = null; draw(); } };
    anim = requestAnimationFrame(step);
  }
  const clearRuns = () => { wins = 0; trips = 0; };
  slider(box, 'Campsites ', 5, 60, 1, N, v => String(v), v => { N = v; if (k > N - 1) { k = N - 1; } ks.max = N - 1; ks.value = k; clearRuns(); ks.dispatchEvent(new Event('input')); });
  ks = slider(box, 'Just look at the first ', 0, N - 1, 1, k, v => String(v), v => { k = v; clearRuns(); cancelAnimationFrame(anim); at = null; draw(); });
  button(box2, 'New trip', () => { seed = (seed * 48271) % 2147483647; const t = trip(rng(seed)); trips++; if (t.pick === t.best) wins++; float(); }, 'go');
  button(box2, 'Take 1000 trips', () => { cancelAnimationFrame(anim); at = null; const R = rng(seed + 977); for (let i = 0; i < 1000; i++) { const t = trip(R); trips++; if (t.pick === t.best) wins++; } draw(); });
  draw();
}
