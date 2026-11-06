/* How fast a global data set grows: multiply one direction at a time. The grid is MERRA-2's real 576 x 361. */
import { svg, el, clear, label, controls, picker, readouts, C } from './kit.js';

export const STEPS = [
  { name: 'One map', mult: 576 * 361, parts: '576 × 361' },
  { name: 'One year', mult: 576 * 361 * 8760, parts: '576 × 361 × 8,760 hours' },
  { name: '46 years', mult: 576 * 361 * 8760 * 46, parts: '… × 46 years' },
  { name: '100 variables', mult: 576 * 361 * 8760 * 46 * 100, parts: '… × 100 variables' }
];
export const bytes = n => { const b = n * 4, u = ['bytes', 'KB', 'MB', 'GB', 'TB']; let v = b, i = 0; while (v >= 1000 && i < 4) { v /= 1000; i++; } return v.toFixed(v < 10 ? 1 : 0) + ' ' + u[i]; };

export default function (fig) {
  const s = svg(fig, 360, 130, 'Bar on a log scale showing how many values a global hourly data set holds as directions are added.');
  const g = el('g', {}, s), box = controls(fig), [vals, size] = readouts(fig, ['Values', 'At 4 bytes each']);
  function draw(k) {
    clear(g);
    STEPS.forEach((st, i) => {
      const w = Math.log10(st.mult) / Math.log10(STEPS[3].mult) * 360, on = i <= k;
      el('rect', { x: 0, y: i * 32 + 2, width: w, height: 26, rx: 4, fill: i === k ? C.orange : on ? C.blue : C.line }, g);
      label(g, 6, i * 32 + 20, st.name, { a: 'start', w: 600, size: 14, fill: on ? 'var(--on-accent)' : 'var(--ink)' });
    });
    vals.textContent = STEPS[k].mult.toExponential(1).replace('e+', ' × 10^');
    size.textContent = bytes(STEPS[k].mult);
  }
  picker(box, STEPS.map(x => x.name), 3, draw);
  draw(3);
}
