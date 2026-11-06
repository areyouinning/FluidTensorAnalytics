/* Pretend your few years of records are the whole world, and draw from them with replacement. */
import { svg, el, clear, label, controls, button, readouts, rng, C } from './kit.js';

const YEARS = [41, 62, 38, 95, 55, 47, 71, 33, 58, 120, 44, 66];

export default function (fig) {
  const s = svg(fig, 360, 230, 'Twelve yearly values, the years picked this round, and a histogram of the average across rounds.');
  const g = el('g', {}, s), box = controls(fig), [mean, range] = readouts(fig, ['Average of the records', 'Middle 90% of resampled averages']);
  const R = rng(77), means = [];
  let picks = [];
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  function round(n) {
    for (let t = 0; t < n; t++) {
      picks = YEARS.map(() => Math.floor(R() * YEARS.length));
      means.push(avg(picks.map(i => YEARS[i])));
    }
    draw();
  }
  function draw() {
    clear(g);
    const count = YEARS.map((_, i) => picks.filter(p => p === i).length);
    label(g, 0, 14, 'The twelve years, and how often this draw picked each', { a: 'start', size: 13, cls: 'soft' });
    YEARS.forEach((v, i) => {
      const x = i * 30, h = v * .4;
      el('rect', { x: x + 2, y: 74 - h, width: 26, height: h, rx: 3, fill: count[i] ? C.blue : C.line }, g);
      label(g, x + 15, 92, count[i] ? '×' + count[i] : '', { size: 13, cls: 'mono', w: 600 });
    });
    const lo = 35, hi = 95, B = 30, bins = new Array(B).fill(0);
    means.forEach(m => bins[Math.max(0, Math.min(B - 1, Math.floor((m - lo) / (hi - lo) * B)))]++);
    const top = Math.max(1, ...bins);
    bins.forEach((c, b) => { const h = c / top * 92; if (c) el('rect', { x: b * 12 + 1, y: 208 - h, width: 10, height: h, fill: C.orange }, g); });
    el('path', { d: 'M0 208H360', stroke: C.soft, fill: 'none' }, g);
    [40, 60, 80].forEach(v => label(g, (v - lo) / (hi - lo) * 360, 226, v, { size: 13, cls: 'soft' }));
    mean.textContent = avg(YEARS).toFixed(1);
    if (means.length > 19) {
      const sorted = [...means].sort((a, b) => a - b);
      range.textContent = sorted[Math.floor(sorted.length * .05)].toFixed(0) + ' to ' + sorted[Math.floor(sorted.length * .95)].toFixed(0);
    } else range.textContent = 'draw more';
  }
  button(box, 'Draw once', () => round(1), 'go');
  button(box, 'Draw 1,000', () => round(1000));
  round(1);
}
