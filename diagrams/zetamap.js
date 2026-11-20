/* Where the zeta function is zero. A map of |ζ(σ + it)| over the critical strip (0 ≤ σ ≤ 1) for 0 ≤ t ≤ 60:
   dark is small, and the black spots are zeros. Below it, |ζ| along one vertical line σ = constant, chosen
   with the slider: on σ = 1/2 the dips touch zero; anywhere else in this window they stop short.
   ζ is computed from the alternating (eta) series with Borwein's 2000 acceleration, ζ = η / (1 − 2^(1−s)),
   n = 90 terms, which matches the known zeros below t = 80 to better than 1e-6. */
import { svg, el, clear, label, controls, slider, readouts } from './kit.js';

const BLUE = 'var(--blue)', ORANGE = 'var(--orange)', INK = 'var(--ink)', SOFT = 'var(--ink-soft)', LINE = 'var(--line)';
// the first zeros on the critical line (imaginary parts), to six decimals
export const ZEROS = [14.134725, 21.022040, 25.010858, 30.424876, 32.935062, 37.586178, 40.918719, 43.327073, 48.005151, 49.773832, 52.970321, 56.446248, 59.347044];

const N = 90, D = (() => { const d = []; let s = 0, t = 1; for (let i = 0; i <= N; i++) { t = i === 0 ? 1 / N : t * (N + i - 1) * 4 * (N - i + 1) / ((2 * i) * (2 * i - 1)); s += t; d.push(N * s); } return d; })();
const LOGK = Array.from({ length: N }, (_, k) => Math.log(k + 1));
export function zeta(sr, si) {   // returns [re, im]
  let er = 0, ei = 0;
  for (let k = 0; k < N; k++) { const c = ((k & 1) ? -1 : 1) * (D[k] - D[N]), m = Math.exp(-sr * LOGK[k]), a = -si * LOGK[k]; er += c * m * Math.cos(a); ei += c * m * Math.sin(a); }
  er /= -D[N]; ei /= -D[N];
  const m = Math.pow(2, 1 - sr), a = -si * Math.LN2, dr = 1 - m * Math.cos(a), di = -m * Math.sin(a), q = dr * dr + di * di;
  return [(er * dr + ei * di) / q, (ei * dr - er * di) / q];
}
export const absZeta = (s, t) => Math.hypot(...zeta(s, t));

export default function (fig) {
  const W = 380, H = 342, X0 = 34, X1 = 368, T1 = 60;
  const MY0 = 14, MY1 = 134;            // the map: σ from 1 (top) to 0 (bottom)
  const PY0 = 196, PY1 = 306, PMAX = 3; // the profile: |ζ| from 0 to 3
  const s = svg(fig, W, H, 'A heat map of the size of the zeta function over the critical strip, with dark zeros all on the middle line, and below it the size of zeta along one vertical line.');
  const X = t => X0 + t / T1 * (X1 - X0), MY = sg => MY1 - sg * (MY1 - MY0), PY = v => PY1 - Math.min(PMAX, v) / PMAX * (PY1 - PY0);
  // the heat map is drawn once, into a canvas, and shown as an image
  const cw = 240, ch = 80, cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const cx = cv.getContext('2d'), img = cx.createImageData(cw, ch);
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const sg = 1 - (j + .5) / ch, t = (i + .5) / cw * T1, v = absZeta(sg, t), u = Math.max(0, Math.min(1, Math.log(1 + v) / Math.log(1 + PMAX)));
    const p = (j * cw + i) * 4; // dark navy at zero, through blue, to pale gold where large
    img.data[p] = 14 + 230 * u * u; img.data[p + 1] = 22 + 190 * u; img.data[p + 2] = 48 + 150 * Math.sqrt(u) - 80 * u * u; img.data[p + 3] = 255;
  }
  cx.putImageData(img, 0, 0);
  el('image', { href: cv.toDataURL(), x: X0, y: MY0, width: X1 - X0, height: MY1 - MY0, preserveAspectRatio: 'none' }, s);
  el('line', { x1: X0, y1: MY(.5), x2: X1, y2: MY(.5), stroke: '#fff', 'stroke-dasharray': '4 4', 'stroke-opacity': .8 }, s);
  label(s, X0 - 5, MY(1) + 4, '1', { a: 'end', size: 10, cls: 'soft' }); label(s, X0 - 5, MY(.5) + 4, '½', { a: 'end', size: 11, cls: 'soft' }); label(s, X0 - 5, MY(0) + 4, '0', { a: 'end', size: 10, cls: 'soft' });
  label(s, 12, (MY0 + MY1) / 2 + 4, 'σ', { size: 12, w: 700, cls: 'soft' });
  [0, 10, 20, 30, 40, 50, 60].forEach(t => label(s, X(t), MY1 + 13, String(t), { size: 10, cls: 'soft' }));
  label(s, (X0 + X1) / 2, MY1 + 27, 't, the height up the strip →', { size: 10.5, cls: 'soft' });
  const g = el('g', {}, s);
  const box = controls(fig);
  const [whereR, minR] = readouts(fig, ['Line shown', 'Smallest |ζ| on it']);
  let sigma = .5;
  function draw() {
    clear(g);
    el('line', { x1: X0, y1: MY(sigma), x2: X1, y2: MY(sigma), stroke: ORANGE, 'stroke-width': 2.5 }, g);
    for (let v = 0; v <= PMAX; v++) { el('line', { x1: X0, y1: PY(v), x2: X1, y2: PY(v), stroke: LINE }, g); label(g, X0 - 5, PY(v) + 4, String(v), { a: 'end', size: 10, cls: 'soft' }); }
    label(g, X0, PY0 - 8, '|ζ(σ + it)| along the orange line', { a: 'start', size: 11, w: 700, fill: ORANGE });
    let d = '', lo = Infinity, at = 0;
    for (let k = 0; k <= 600; k++) { const t = k / 600 * T1, v = absZeta(sigma, t); if (t > 10 && v < lo) { lo = v; at = t; } d += (k ? 'L' : 'M') + X(t).toFixed(1) + ' ' + PY(v).toFixed(1); }
    el('path', { d, fill: 'none', stroke: ORANGE, 'stroke-width': 2 }, g);
    if (Math.abs(sigma - .5) < 1e-9) ZEROS.forEach(z => { el('circle', { cx: X(z), cy: PY(0), r: 3.5, fill: INK }, g); el('circle', { cx: X(z), cy: MY(.5), r: 3, fill: '#fff', stroke: INK, 'stroke-width': 1 }, g); });
    [0, 10, 20, 30, 40, 50, 60].forEach(t => label(g, X(t), PY1 + 13, String(t), { size: 10, cls: 'soft' }));
    label(g, (X0 + X1) / 2, PY1 + 27, 't →', { size: 10.5, cls: 'soft' });
    whereR.textContent = 'σ = ' + sigma.toFixed(2) + (Math.abs(sigma - .5) < 1e-9 ? ', the critical line' : '');
    minR.textContent = Math.abs(sigma - .5) < 1e-9 ? '0, at 13 heights below t = 60 (dots)' : lo.toFixed(3) + ' near t = ' + at.toFixed(1) + ': no zero on this line';
  }
  slider(box, 'σ ', 0, 1, .01, sigma, v => v.toFixed(2), v => { sigma = Math.round(v * 100) / 100; draw(); });
  draw();
}
