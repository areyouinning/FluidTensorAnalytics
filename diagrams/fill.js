/* Punch holes in the data and let the factors guess what was there. Scored only on values it never saw. */
import { svg, el, clear, label, controls, slider, button, readouts, ramp, rng, C } from './kit.js';
import { DIMS, toyFlow, cpFill } from './tensor.js';

export default function (fig) {
  const [I, J] = DIMS, X = toyFlow();
  let max = 0; for (const v of X) max = Math.max(max, v);
  const s = svg(fig, 360, 124, 'One year of data with holes punched in it, beside the same year with the holes filled by the factors.');
  const g = el('g', {}, s), box = controls(fig), [tensorErr, meanErr] = readouts(fig, ['Typical miss, filled by factors', 'Typical miss, filled by the average']);
  let holes = .5, seed = 11;
  function draw() {
    const R = rng(seed), mask = new Uint8Array(X.length);
    for (let k = 0; k < X.length; k++) mask[k] = R() > holes ? 1 : 0;
    const { fit, mean } = cpFill(X, mask, 3);
    let a = 0, b = 0, n = 0;
    for (let k = 0; k < X.length; k++) if (!mask[k]) { a += (fit[k] - X[k]) ** 2; b += (mean - X[k]) ** 2; n++; }
    tensorErr.textContent = n ? Math.sqrt(a / n).toFixed(3) : '-';
    meanErr.textContent = n ? Math.sqrt(b / n).toFixed(3) : '-';
    clear(g);
    const size = 9.5, yr = 2;
    [[0, 'With holes'], [123, 'Filled in'], [246, 'The truth']].forEach(([x, name], p) => {
      label(g, x + J * size / 2, 15, name, { w: 600, size: 13 });
      for (let i = 0; i < I; i++) for (let j = 0; j < J; j++) {
        const k = i + I * (j + J * yr), hole = !mask[k], rect = { x: x + j * size, y: 22 + i * size, width: size - .5, height: size - .5, rx: 1 };
        if (p === 0 && hole) { el('rect', { ...rect, fill: 'none', stroke: C.line }, g); continue; }
        el('rect', { ...rect, fill: ramp((p === 1 ? fit[k] : X[k]) / max) }, g);
        if (p === 1 && hole) el('rect', { ...rect, fill: 'none', stroke: C.orange, 'stroke-width': 1 }, g);
      }
    });
  }
  slider(box, 'Missing', .1, .95, .05, holes, v => Math.round(v * 100) + '%', v => { holes = v; draw(); });
  button(box, 'New holes', () => { seed = seed * 7 % 9973; draw(); });
  draw();
}
