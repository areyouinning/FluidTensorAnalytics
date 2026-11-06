/* What each way of factoring costs in stored numbers. These are exact counts for a tensor with every side n and every rank r. */
import { svg, el, clear, label, controls, slider, C } from './kit.js';

export const counts = (n, d, r) => [
  { name: 'Keep everything', v: Math.pow(n, d), hue: C.soft },
  { name: 'Tucker', v: Math.pow(r, d) + d * n * r, hue: C.purple },
  { name: 'CP', v: d * n * r, hue: C.blue },
  { name: 'Tensor train', v: d < 3 ? 2 * n * r : 2 * n * r + (d - 2) * n * r * r, hue: C.green }
];
const fmt = v => v >= 1e6 ? v.toExponential(1).replace('e+', ' × 10^') : Math.round(v).toLocaleString();

export default function (fig) {
  const s = svg(fig, 360, 230, 'Bars on a log scale comparing stored numbers for the full tensor, Tucker, CP and tensor train.');
  const g = el('g', {}, s), box = controls(fig);
  let n = 50, d = 4, r = 5;
  function draw() {
    clear(g);
    const list = counts(n, d, r), top = Math.log10(Math.max(1e4, list[0].v)), x0 = 0, W = 360;
    list.forEach((c, k) => {
      const y = 8 + k * 56, w = Math.max(4, Math.log10(Math.max(1, c.v)) / top * W);
      label(g, x0, y + 13, c.name, { a: 'start', w: 600, size: 15 });
      el('rect', { x: x0, y: y + 20, width: w, height: 22, rx: 4, fill: c.hue }, g);
      label(g, W, y + 13, fmt(c.v), { a: 'end', size: 15, cls: 'mono', w: 600 });
    });
  }
  slider(box, 'Directions', 2, 10, 1, d, null, v => { d = v; draw(); });
  slider(box, 'Side length', 10, 200, 10, n, null, v => { n = v; draw(); });
  slider(box, 'Rank', 1, 20, 1, r, null, v => { r = v; draw(); });
  draw();
}
