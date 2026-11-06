/* What the queens rule costs, from exhaustive search over every placement on each board. */
import { svg, el, label, C } from './kit.js';

const KNOWN = [[4, 5, 5], [5, 7, 7], [6, 8, 8], [7, 10, 10], [8, 11, 12], [9, 12, 14], [10, 14, 14], [11, 15, 16], [12, 16, 16]];

export default function (fig) {
  const s = svg(fig, 360, 210, 'Tiles needed on boards from 4 to 12, with and without the queens rule. The rule costs extra tiles on 8, 9 and 11.');
  const X = n => 20 + (n - 4) * 40, Y = v => 180 - v * 10;
  el('path', { d: 'M4 180H356', stroke: C.soft, fill: 'none' }, s);
  KNOWN.forEach(([n, rook, queen]) => {
    el('rect', { x: X(n) - 15, y: Y(rook), width: 30, height: 180 - Y(rook), rx: 3, fill: C.blue }, s);
    if (queen > rook) {
      el('rect', { x: X(n) - 15, y: Y(queen), width: 30, height: Y(rook) - Y(queen) - 1, rx: 3, fill: C.orange }, s);
      label(s, X(n), Y(queen) - 5, '+' + (queen - rook), { w: 600, size: 14 });
    }
    label(s, X(n), Y(rook) + 18, rook, { size: 13, w: 600, fill: 'var(--on-accent)', cls: 'mono' });
    label(s, X(n), 198, n, { size: 14, cls: 'soft' });
  });
  el('rect', { x: 8, y: 6, width: 12, height: 12, rx: 2, fill: C.blue }, s);
  label(s, 25, 16, 'Without the rule', { a: 'start', size: 13 });
  el('rect', { x: 8, y: 24, width: 12, height: 12, rx: 2, fill: C.orange }, s);
  label(s, 25, 34, 'Extra with queens', { a: 'start', size: 13 });
}
