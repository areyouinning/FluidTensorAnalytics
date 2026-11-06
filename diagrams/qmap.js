/* Quantile mapping: a value's rank in the model's world is sent to the same rank in the real one. */
import { svg, el, clear, label, controls, slider, readouts, rng, gauss, C } from './kit.js';

export default function (fig) {
  const R = rng(55), N = 400;
  const seen = Array.from({ length: N }, () => 12 * Math.exp(.55 * gauss(R))).sort((a, b) => a - b);
  const model = Array.from({ length: N }, () => 20 + 4 * gauss(R)).sort((a, b) => a - b);
  const s = svg(fig, 360, 230, 'Two cumulative curves, model and observations, with an arrow carrying one value across at the same rank.');
  const g = el('g', {}, s), box = controls(fig), [was, now] = readouts(fig, ['The model said', 'At the same rank, the record says']);
  let rank = .9;
  const X = v => 8 + Math.min(45, v) / 45 * 344, Y = p => 196 - p * 186;
  const curve = (a, hue) => el('path', { d: 'M' + a.map((v, i) => X(v).toFixed(1) + ' ' + Y(i / (N - 1)).toFixed(1)).join('L'), fill: 'none', stroke: hue, 'stroke-width': 2.5 }, g);
  function draw() {
    clear(g);
    el('path', { d: 'M8 196H352', stroke: C.soft, fill: 'none' }, g);
    curve(seen, C.green); curve(model, C.blue);
    const i = Math.round(rank * (N - 1)), a = model[i], b = seen[i], y = Y(rank);
    el('path', { d: `M${X(a)} 196V${y}L${X(b)} ${y}V196`, fill: 'none', stroke: C.orange, 'stroke-width': 2, 'stroke-dasharray': '4 3' }, g);
    el('circle', { cx: X(a), cy: y, r: 5, fill: C.blue }, g);
    el('circle', { cx: X(b), cy: y, r: 5, fill: C.green }, g);
    label(g, X(model[60]) + 8, Y(.15) + 3, 'model', { a: 'start', w: 600, size: 14 });
    label(g, X(seen[300]) + 60, Y(.72) + 14, 'record', { a: 'start', w: 600, size: 14 });
    label(g, 180, 222, 'Daily rainfall', { size: 14, cls: 'soft' });
    was.textContent = a.toFixed(1);
    now.textContent = b.toFixed(1);
  }
  slider(box, 'Rank', .02, .99, .01, rank, v => Math.round(v * 100) + '%', v => { rank = v; draw(); });
  draw();
}
