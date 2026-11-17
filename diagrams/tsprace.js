/* The forecast, drawn so it can be scored. Steps needed to find the shortest tour of n cities, on a log
   scale: trying every tour, (n−1)!/2; Held–Karp (1962), n²·2ⁿ; and the two forecast lines, n²·1.99ⁿ (the
   first break) and n²·1.657ⁿ (if weighted tours reach Björklund's 2010 record for unweighted ones).
   Polynomial factors on the forecast lines are a guess; the base of the exponent is the claim. */
import { svg, el, clear, label, controls, slider, readouts } from './kit.js';

const BLUE = 'var(--blue)', ORANGE = 'var(--orange)', GREEN = 'var(--green)', INK = 'var(--ink)', SOFT = 'var(--ink-soft)', LINE = 'var(--line)';
const lfact = n => { let t = 0; for (let k = 2; k <= n; k++) t += Math.log10(k); return t; };
const CURVES = [
  ['try every tour', n => lfact(n - 1) - Math.log10(2), SOFT, ''],
  ['Held–Karp, 1962', n => 2 * Math.log10(n) + n * Math.log10(2), INK, ''],
  ['forecast: 1.99ⁿ', n => 2 * Math.log10(n) + n * Math.log10(1.99), ORANGE, '6 4'],
  ['forecast, later: 1.657ⁿ', n => 2 * Math.log10(n) + n * Math.log10(1.657), GREEN, '6 4']
];

export default function (fig) {
  const s = svg(fig, 380, 232, 'Four curves of steps against number of cities on a log scale: every tour, Held–Karp, and two dashed forecast lines below it.');
  const g = el('g', {}, s);
  const box = controls(fig);
  const outs = readouts(fig, ['Held–Karp', 'Forecast 1.99ⁿ', 'Forecast 1.657ⁿ']);
  let n = 60;
  const X0 = 44, X1 = 366, Y0 = 190, Y1 = 14, NMAX = 400, YMAX = 130;
  const X = v => X0 + (v - 5) / (NMAX - 5) * (X1 - X0), Y = v => Y0 - Math.min(YMAX, Math.max(0, v)) / YMAX * (Y0 - Y1);
  function draw() {
    clear(g);
    for (let e = 0; e <= YMAX; e += 20) { el('line', { x1: X0, y1: Y(e), x2: X1, y2: Y(e), stroke: LINE }, g); label(g, X0 - 5, Y(e) + 4, e ? '10^' + e : '1', { a: 'end', size: 9.5, cls: 'soft' }); }
    [5, 100, 200, 300, 400].forEach(v => label(g, X(v), Y0 + 14, String(v), { size: 10, cls: 'soft' }));
    label(g, (X0 + X1) / 2, Y0 + 30, 'cities →', { size: 10.5, cls: 'soft' });
    el('line', { x1: X0, y1: Y(80), x2: X1, y2: Y(80), stroke: BLUE, 'stroke-dasharray': '2 4' }, g); label(g, X(100), Y(80) - 4, 'atoms in the universe', { a: 'start', size: 9.5, fill: BLUE });
    CURVES.forEach(([name, f, col, dash], k) => {
      let d = '', started = false;
      for (let v = 5; v <= NMAX; v++) { const y = f(v); if (y > YMAX) break; d += (started ? 'L' : 'M') + X(v).toFixed(1) + ' ' + Y(y).toFixed(1); started = true; }
      el('path', { d, fill: 'none', stroke: col, 'stroke-width': k === 1 ? 3 : 2.2, 'stroke-dasharray': dash }, g);
    });
    label(g, X(62), Y(118), 'every tour', { a: 'start', size: 10, cls: 'soft' });
    label(g, X(300), Y(CURVES[1][1](300)) - 10, 'Held–Karp', { a: 'end', size: 10.5, w: 700 });
    label(g, X(310), Y(CURVES[3][1](310)) + 16, '1.657ⁿ', { a: 'start', size: 10.5, w: 700, fill: GREEN });
    label(g, X(318), Y(CURVES[2][1](318)) + 16, '1.99ⁿ', { a: 'start', size: 10.5, w: 700, fill: ORANGE });
    el('line', { x1: X(n), y1: Y1, x2: X(n), y2: Y0, stroke: INK, 'stroke-dasharray': '3 3', opacity: .6 }, g);
    const hk = CURVES[1][1](n);
    outs[0].textContent = '10^' + hk.toFixed(1) + ' steps';
    [2, 3].forEach((k, i) => { const v = CURVES[k][1](n), gain = hk - v; outs[i + 1].textContent = '10^' + v.toFixed(1) + ' — ' + (gain < 1 ? (10 ** gain).toFixed(1) + '× fewer' : '10^' + gain.toFixed(1) + '× fewer'); });
  }
  slider(box, 'Cities ', 10, 400, 5, n, v => String(v), v => { n = v; draw(); });
  draw();
}
