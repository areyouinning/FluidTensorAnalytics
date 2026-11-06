/* A real CP decomposition, run in your browser on a made-up 960-number flow data set. */
import { svg, el, clear, label, controls, slider, picker, readouts, ramp, C } from './kit.js';
import { DIMS, toyFlow, cpALS, cpRebuild, explained } from './tensor.js';

export default function (fig) {
  const [I, J, K] = DIMS, X = toyFlow(), cache = {};
  let max = 0; for (const v of X) max = Math.max(max, v);
  const s = svg(fig, 360, 240, 'One year of the flow data beside its rebuilt copy and the difference, with the monthly shape of each component below.');
  const g = el('g', {}, s), box = controls(fig), [stored, kept] = readouts(fig, ['Numbers stored, of 960', 'Variation kept']);
  let R = 3, year = 0;
  const fit = r => cache[r] || (cache[r] = (() => { const F = cpALS(X, r); return { F, Y: cpRebuild(F) }; })());
  const hues = [C.blue, C.orange, C.purple, C.green, C.soft, C.ink];
  function panel(x, name, val, color) {
    label(g, x + J * 4.75, 15, name, { w: 600, size: 13 });
    for (let i = 0; i < I; i++) for (let j = 0; j < J; j++) el('rect', { x: x + j * 9.5, y: 22 + i * 9.5, width: 9, height: 9, rx: 1, fill: color(val(i, j)) }, g);
  }
  function draw() {
    clear(g);
    const { F, Y } = fit(R), at = (A, i, j) => A[i + I * (j + J * year)];
    panel(0, 'The data', (i, j) => at(X, i, j), v => ramp(v / max));
    panel(123, `Rebuilt from ${R}`, (i, j) => at(Y, i, j), v => ramp(v / max));
    panel(246, 'What is left', (i, j) => Math.abs(at(X, i, j) - at(Y, i, j)), v => ramp(Math.min(1, v / (max * .3)), 'var(--orange)'));
    /* the month shape of each component */
    label(g, 0, 136, 'Each component, by month', { a: 'start', size: 14, cls: 'soft' });
    const x0 = 0, y0 = 144, w = 360, h = 68;
    el('path', { d: `M${x0} ${y0 + h}H${x0 + w}`, stroke: C.line, fill: 'none' }, g);
    for (let r = 0; r < R; r++) {
      let top = 1e-9; for (let j = 0; j < J; j++) top = Math.max(top, Math.abs(F[1][j][r]));
      const d = F[1].map((row, j) => (j ? 'L' : 'M') + (x0 + j * w / (J - 1)).toFixed(1) + ' ' + (y0 + h - Math.abs(row[r]) / top * (h - 4)).toFixed(1)).join('');
      el('path', { d, fill: 'none', stroke: hues[r], 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, g);
    }
    'JFMAMJJASOND'.split('').forEach((m, j) => label(g, Math.min(354, Math.max(6, x0 + j * w / (J - 1))), y0 + h + 18, m, { size: 13, cls: 'soft' }));
    stored.textContent = R * (I + J + K);
    kept.textContent = (explained(X, Y) * 100).toFixed(1) + '%';
  }
  slider(box, 'Components', 1, 6, 1, R, null, v => { R = v; draw(); });
  picker(controls(fig), ['Year 1', 'Year 3', 'Year 6'], 0, k => { year = [0, 2, 5][k]; draw(); });
  draw();
  fig.cp = { X, fit, explained };
}
