/* Why each die has a beater: the cycle of Efron's dice, and all 36 face pairs for any two of them. */
import { svg, el, clear, label, controls, picker, readouts, C } from './kit.js';
import { EFRON, duel, frac } from './dice-core.js';

const PAIRS = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3]];

export default function (fig) {
  const s = svg(fig, 380, 236, 'Four dice in a loop of arrows, and a six by six grid of face pairs for the chosen two.');
  const g = el('g', {}, s), box = controls(fig);
  const [aWins, bWins] = readouts(fig, ['First die wins', 'Second die wins']);
  const P = [[70, 40], [130, 100], [70, 160], [10, 100]].map(([x, y]) => [x + 14, y + 14]);

  function arrow(i, j, on) {   // i beats j
    const [x1, y1] = P[i], [x2, y2] = P[j], d = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / d, uy = (y2 - y1) / d, a = 22, b = 26;
    const sx = x1 + ux * a, sy = y1 + uy * a, ex = x2 - ux * b, ey = y2 - uy * b;
    el('path', { d: `M${sx} ${sy}L${ex} ${ey}`, stroke: on ? C.ink : C.line, 'stroke-width': on ? 2.5 : 1.5, fill: 'none' }, g);
    el('path', { d: `M${ex + ux * 6} ${ey + uy * 6}l${-ux * 9 - uy * 5} ${-uy * 9 + ux * 5}l${uy * 10} ${-ux * 10}Z`, fill: on ? C.ink : C.line }, g);
  }

  function draw(k) {
    clear(g);
    const [i, j] = PAIRS[k], A = EFRON[i], B = EFRON[j], r = duel(A.faces, B.faces);
    /* the loop: each arrow points from a die to the one it beats, 2/3 of the time */
    for (let n = 0; n < 4; n++) { const w = (n + 3) % 4; arrow(w, n, (w === i && n === j) || (w === j && n === i)); }
    EFRON.forEach((d, n) => { el('circle', { cx: P[n][0], cy: P[n][1], r: 18, fill: d.c, opacity: n === i || n === j ? 1 : .55 }, g); label(g, P[n][0], P[n][1] + 6, d.k, { size: 17, w: 600, fill: 'var(--on-accent)' }); });
    label(g, 84, 222, 'each arrow wins 2/3', { size: 13, cls: 'soft' });
    /* the grid: rows are the first die's faces, columns the second's; each cell is coloured by who wins it */
    const x0 = 208, y0 = 36, c = 26;
    label(g, x0 + 3 * c, 18, A.k + ' down, ' + B.k + ' across', { size: 14, w: 600 });
    for (let a = 0; a < 6; a++) {
      label(g, x0 - 10, y0 + a * c + 18, String(A.faces[a]), { size: 13, cls: 'mono' });
      label(g, x0 + a * c + 12, y0 + 6 * c + 16, String(B.faces[a]), { size: 13, cls: 'mono' });
      for (let b = 0; b < 6; b++) {
        const fa = A.faces[a], fb = B.faces[b];
        el('rect', { x: x0 + b * c, y: y0 + a * c, width: c - 3, height: c - 3, rx: 4, fill: fa > fb ? A.c : fa < fb ? B.c : C.sunk }, g);
      }
    }
    aWins.textContent = A.k + ': ' + frac(r.w, r.n) + ' (' + r.w + ' of 36)';
    bWins.textContent = B.k + ': ' + frac(r.l, r.n) + ' (' + r.l + ' of 36)';
  }
  picker(box, PAIRS.map(([i, j]) => EFRON[i].k + ' vs ' + EFRON[j].k), 0, draw);
  draw(0);
}
