/* NumPy's broadcasting rule, drawn: line shapes up from the right; a 1 stretches, and anything else must match. */
import { svg, el, clear, label, controls, picker, C } from './kit.js';

const CASES = [
  { name: 'Remove the mean', a: ['lat', 361, 'lon', 576, 'time', 8760], b: [null, 361, null, 576, null, 1], op: '−', say: 'Subtract each cell\'s long-term mean from every hour. The time direction of 1 stretches to 8,760 with no copying.' },
  { name: 'Weight by latitude', a: ['lat', 361, 'lon', 576, 'time', 8760], b: [null, 361, null, 1, null, 1], op: '×', say: 'Grid cells shrink toward the poles, so weight each row. One list of 361 numbers applies to the whole cube.' },
  { name: 'Whoops', a: ['lat', 361, 'lon', 576, 'time', 8760], b: [null, null, null, null, null, 361], op: '×', say: 'Shapes line up from the right, so a list of 361 latitudes lands against time and fails: 8,760 is not 361. The fix is to give it shape 361 × 1 × 1.' }
];

export default function (fig) {
  const s = svg(fig, 360, 176, 'Two array shapes lined up from the right, showing which directions stretch.');
  const g = el('g', {}, s), cap = fig.querySelector('figcaption'), box = controls(fig);
  const W = 112, xs = [8, 124, 240];
  function draw(k) {
    clear(g);
    const c = CASES[k];
    let ok = true;
    [0, 1, 2].forEach(d => {
      const A = c.a[d * 2 + 1], B = c.b[d * 2 + 1], match = B == null || B === 1 || B === A;
      if (!match) ok = false;
      label(g, xs[d] + W / 2, 14, c.a[d * 2], { size: 13, cls: 'soft' });
      el('rect', { x: xs[d], y: 22, width: W, height: 36, rx: 6, fill: C.blue }, g);
      label(g, xs[d] + W / 2, 46, A.toLocaleString(), { cls: 'mono', w: 600, size: 16, fill: 'var(--on-accent)' });
      if (B != null) {
        const stretch = B === 1;
        el('rect', { x: xs[d], y: 74, width: W, height: 36, rx: 6, fill: !match ? 'var(--red)' : stretch ? C.sunk : C.orange, ...(stretch ? { stroke: C.orange, 'stroke-dasharray': '4 3', 'stroke-width': 2 } : {}) }, g);
        label(g, xs[d] + W / 2, 98, stretch ? '1 stretches' : B.toLocaleString(), { cls: 'mono', w: 600, size: stretch ? 13 : 16, fill: stretch ? 'var(--ink)' : 'var(--on-accent)' });
      }
    });
    label(g, 180, 138, c.op + ' gives', { size: 14, cls: 'soft' });
    label(g, 180, 164, ok ? '361 × 576 × 8,760' : 'ValueError: shapes do not match', { cls: 'mono', w: 600, size: 15, fill: ok ? 'var(--ink)' : 'var(--red)' });
    cap.textContent = c.say;
  }
  picker(box, CASES.map(c => c.name), 0, draw);
  draw(0);
}
