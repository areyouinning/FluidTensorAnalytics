/* How large must n be before the claimed subexponential bound beats brute force?
   Brute force costs about 2^n. The general bound costs about 2^(C · n · ln ln n / √ln n) for an unknown
   constant C (natural logs, as in the preprint; polynomial factors ignored). Plotted: the new exponent as a
   fraction of brute force's, C · ln ln n / √ln n, against the number of digits of n. It wins only where the
   curve drops below 1. Dias and Lima (arXiv 2611.00517) report crossovers near 10^32 for C = 2, 10^126 for
   C = 3 and 10^3517 for C = 10; this figure solves C · ln L = √L (L = ln n) to reproduce them. */
import { svg, el, clear, label, controls, slider, readouts } from './kit.js';

const BLUE = 'var(--blue)', ORANGE = 'var(--orange)', GREEN = 'var(--green)', INK = 'var(--ink)', SOFT = 'var(--ink-soft)', LINE = 'var(--line)';
const LN10 = Math.LN10;
export function crossover(C) {   // smallest L = ln n > e with C ln L <= √L, by scanning then bisecting; returns log10 n
  let lo = Math.E, hi = lo; while (C * Math.log(hi) > Math.sqrt(hi)) { lo = hi; hi *= 1.5; if (hi > 1e12) return Infinity; }
  if (hi === Math.E) return Math.E / LN10;
  for (let k = 0; k < 200; k++) { const mid = (lo + hi) / 2; if (C * Math.log(mid) > Math.sqrt(mid)) lo = mid; else hi = mid; }
  return hi / LN10;
}

export default function (fig) {
  const s = svg(fig, 380, 236, 'A curve of the new method’s exponent as a fraction of brute force’s, against the number of digits of n, crossing below one only at enormous n.');
  const g = el('g', {}, s);
  const box = controls(fig);
  const [crossR, cmpR] = readouts(fig, ['Beats brute force once n has', 'For scale']);
  let C = 2;
  const X0 = 46, X1 = 364, Y0 = 186, Y1 = 18, D0 = 0, D1 = 5;            // x: log10(digits) from 0 to 5 (1 to 100,000 digits)
  const X = d => X0 + (Math.log10(Math.max(1, d)) - D0) / (D1 - D0) * (X1 - X0), YMAX = 4;
  const Y = r => Y0 - Math.min(YMAX, r) / YMAX * (Y0 - Y1);
  function draw() {
    clear(g);
    for (let r = 0; r <= YMAX; r++) { el('line', { x1: X0, y1: Y(r), x2: X1, y2: Y(r), stroke: LINE }, g); label(g, X0 - 6, Y(r) + 4, r + '×', { a: 'end', size: 10, cls: 'soft' }); }
    [1, 10, 100, 1000, 10000, 100000].forEach(d => { el('line', { x1: X(d), y1: Y0, x2: X(d), y2: Y0 + 4, stroke: SOFT }, g); label(g, X(d), Y0 + 16, d >= 1000 ? (d / 1000) + 'k' : String(d), { size: 10, cls: 'soft' }); });
    label(g, (X0 + X1) / 2, Y0 + 32, 'digits in n, the number of variables →', { size: 10.5, cls: 'soft' });
    el('line', { x1: X0, y1: Y(1), x2: X1, y2: Y(1), stroke: INK, 'stroke-width': 2 }, g);
    label(g, X1, Y(1) - 5, 'brute force', { a: 'end', size: 11, w: 700 });
    let d = '';
    const LG0 = Math.log10(1.25);   // start where ln n > e, so ln ln n is positive
    for (let k = 0; k <= 300; k++) { const lg = LG0 + (D1 - LG0) * k / 300, digits = 10 ** lg, L = digits * LN10, r = C * Math.log(L) / Math.sqrt(L); d += (k ? 'L' : 'M') + X(digits).toFixed(1) + ' ' + Y(r).toFixed(1); }
    el('path', { d, fill: 'none', stroke: ORANGE, 'stroke-width': 3 }, g);
    label(g, X0 + 6, Y1 + 12, 'new method (as a multiple of brute force’s exponent)', { a: 'start', size: 10.5, w: 600, fill: ORANGE });
    el('line', { x1: X(80), y1: Y1, x2: X(80), y2: Y0, stroke: BLUE, 'stroke-dasharray': '3 3' }, g);
    label(g, X(80) + 4, Y1 + 30, 'atoms in the universe ≈ 10⁸⁰', { a: 'start', size: 9.5, fill: BLUE });
    const c = crossover(C);
    if (isFinite(c)) { el('circle', { cx: X(c), cy: Y(1), r: 5, fill: GREEN, stroke: INK, 'stroke-width': 1.5 }, g); }
    crossR.textContent = isFinite(c) ? Math.round(c).toLocaleString() + ' digits (n ≈ 10^' + Math.round(c).toLocaleString() + ')' : 'never on this chart';
    cmpR.textContent = isFinite(c) ? (c > 80 ? 'that n is 10^' + Math.round(c - 80).toLocaleString() + ' times the number of atoms in the universe (about 10^80)' : 'fewer than the atoms in the universe (about 10^80), but still far beyond any real formula') : '';
  }
  slider(box, 'Hidden constant C ', 1.5, 10, .1, C, v => v.toFixed(1), v => { C = v; draw(); });
  draw();
}
