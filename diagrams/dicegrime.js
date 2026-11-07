/* Grime's five dice: every pair, one die each or two dice each. The arrows of one loop turn around when the dice are doubled. */
import { svg, el, clear, label, controls, picker, readouts, C } from './kit.js';
import { GRIME, totals, duel } from './dice-core.js';

export default function (fig) {
  const s = svg(fig, 380, 300, 'Five dice on a pentagon, with an arrow from each die to every die it beats.');
  const g = el('g', {}, s), box = controls(fig);
  const [flipped, outer] = readouts(fig, ['Arrows turned around', 'The outer loop']);
  const R = 108, cx = 190, cy = 150, P = GRIME.map((d, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; });
  const one = {}; GRIME.forEach((a, i) => GRIME.forEach((b, j) => { if (i < j) one[i + ',' + j] = duel(a.faces, b.faces); }));

  function draw(k) {
    clear(g);
    const n = k + 1; let turned = 0, outerOn = true, outerDir = 0;
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
      const r = duel(totals(GRIME[i].faces, n), totals(GRIME[j].faces, n)), o = one[i + ',' + j];
      const win = r.w > r.l ? i : j, lose = win === i ? j : i, p = Math.max(r.w, r.l) / r.n;
      const was = o.w > o.l ? i : j, flip = was !== win; if (flip) turned++;
      const isOuter = (j - i === 1) || (i === 0 && j === 4);
      if (isOuter) { const fwd = (lose - win + 5) % 5 === 1 ? 1 : -1; if (!outerDir) outerDir = fwd; else if (fwd !== outerDir) outerOn = false; }
      const [x1, y1] = P[win], [x2, y2] = P[lose], d = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / d, uy = (y2 - y1) / d, sx = x1 + ux * 24, sy = y1 + uy * 24, ex = x2 - ux * 28, ey = y2 - uy * 28;
      const col = flip ? C.orange : C.soft;
      el('path', { d: `M${sx} ${sy}L${ex} ${ey}`, stroke: col, 'stroke-width': flip ? 2.6 : 1.6, fill: 'none', 'stroke-dasharray': isOuter ? '' : '5 4' }, g);
      el('path', { d: `M${ex + ux * 6} ${ey + uy * 6}l${-ux * 9 - uy * 5} ${-uy * 9 + ux * 5}l${uy * 10} ${-ux * 10}Z`, fill: col }, g);
      const t = isOuter ? .5 : .2, lx = sx + (ex - sx) * t - uy * 12, ly = sy + (ey - sy) * t + ux * 12;
      label(g, lx, ly + 4, Math.round(p * 100) + '%', { size: 12, w: 600, fill: col });
    }
    GRIME.forEach((d, i) => { el('circle', { cx: P[i][0], cy: P[i][1], r: 20, fill: d.c }, g); label(g, P[i][0], P[i][1] + (i === 0 ? -28 : 36), d.k, { size: 13, w: 600 }); });
    label(g, 190, 296, n === 1 ? 'solid: the outer loop · dashed: the star' : 'orange: arrows that turned around', { size: 12, cls: 'soft' });
    flipped.textContent = turned + ' of 10';
    outer.textContent = outerOn ? (outerDir === 1 ? 'Red → Blue → Olive → Yellow → Magenta → Red' : 'Red → Magenta → Yellow → Olive → Blue → Red') : 'not a loop';
  }
  picker(box, ['One die each', 'Two dice each'], 0, draw);
  draw(0);
}
