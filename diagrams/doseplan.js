/* More dose buys coincidence and costs survival, so the best amount is in the middle.
   Spreading the same dose over more visits buys editing windows instead. */
import { svg, el, clear, label, controls, picker, readouts, C } from './kit.js';
import { run, P } from './twohalf-core.js';

const SPLIT = .38, ROUNDS = [1, 2, 3, 6], DMAX = 30, HUE = [C.orange, C.purple, C.blue, C.green];

/* same total dose, spread evenly over r visits, each visit splitting the same way */
const curve = r => {
  const pts = [];
  for (let i = 1; i <= 60; i++) {
    const D = i / 60 * DMAX, per = D / r;
    if (per > P.dose) continue;
    pts.push([D, run(Array.from({ length: r }, () => [per, SPLIT])).score]);
  }
  return pts;
};
const CURVES = ROUNDS.map(curve);
const TOP = Math.max(...CURVES.flat().map(p => p[1])) * 1.12;

export default function (fig) {
  const s = svg(fig, 360, 236, 'Score against total dose, one curve for each number of visits, each curve peaking in the middle.');
  const g = el('g', {}, s), box = controls(fig);
  const [bd, bs] = readouts(fig, ['Best total dose', 'Cells fixed there']);
  const X = d => 30 + d / DMAX * 318, Y = v => 196 - v / TOP * 180;

  function draw(k) {
    clear(g);
    el('path', { d: 'M30 196H348M30 16V196', stroke: C.line, fill: 'none' }, g);
    CURVES.forEach((pts, j) => {
      const d = pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join('');
      el('path', { d, fill: 'none', stroke: HUE[j], 'stroke-width': j === k ? 3 : 1.5, opacity: j === k ? 1 : .35 }, g);
      const top = pts.reduce((a, b) => b[1] > a[1] ? b : a);
      el('circle', { cx: X(top[0]), cy: Y(top[1]), r: j === k ? 5 : 3, fill: HUE[j], opacity: j === k ? 1 : .35 }, g);
      if (j === k) {
        el('path', { d: `M${X(top[0])} ${Y(top[1]).toFixed(1)}V196`, stroke: HUE[j], 'stroke-width': 1.5, 'stroke-dasharray': '4 3', fill: 'none' }, g);
        bd.textContent = top[0].toFixed(1);
        bs.textContent = (top[1] * 100).toFixed(2) + '%';
      }
    });
    label(g, 189, 226, 'Total dose', { size: 14, cls: 'soft' });
    el('text', { transform: 'translate(13 106) rotate(-90)', 'text-anchor': 'middle', 'font-size': 14, class: 'soft' }, g, 'Cells fixed');
    label(g, 348, 30, ROUNDS[k] + (ROUNDS[k] === 1 ? ' dose' : ' doses'), { a: 'end', size: 14, w: 600, fill: HUE[k] });
  }
  picker(box, ROUNDS.map(r => r === 1 ? '1 dose' : r + ' doses'), 2, draw);
  draw(2);
}
