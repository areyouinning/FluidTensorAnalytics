/* How far the primes stray from Riemann's estimate. π(x) counts the primes up to x; li(x), the logarithmic
   integral, is the smooth estimate. Schoenfeld (1976) showed the Riemann hypothesis is equivalent to
   |π(x) − li(x)| < √x · ln x / (8π) for every x ≥ 2657. Plotted on a log scale up to ten million: the actual
   gap π(x) − li(x) and that band. Primes come from a sieve; li from Ramanujan's series. */
import { svg, el, clear, label, controls, slider, readouts } from './kit.js';

const BLUE = 'var(--blue)', ORANGE = 'var(--orange)', GREEN = 'var(--green)', INK = 'var(--ink)', LINE = 'var(--line)';
export function li(x) {   // Ramanujan: li(x) = γ + ln ln x + √x Σ_{n≥1} (−1)^(n−1) (ln x)^n / (n! 2^(n−1)) Σ_{k ≤ (n−1)/2} 1/(2k+1)
  const L = Math.log(x); let sum = 0, term = 1, odd = 0;
  for (let n = 1; n < 400; n++) {
    term *= L / n; if (n > 1) term /= 2;            // (ln x)^n / (n! 2^(n−1))
    if (n % 2 === 1) odd += 1 / n;                   // Σ_{k ≤ (n−1)/2} 1/(2k+1) gains 1/n at each odd n
    const t = (n % 2 ? 1 : -1) * term * odd; sum += t;
    if (n > 2 * L && Math.abs(t) < 1e-17 * Math.abs(sum)) break;
  }
  return 0.5772156649015329 + Math.log(L) + Math.sqrt(x) * sum;
}
const MAX = 1e7;
export function primeCounts(max = MAX) { const c = new Uint8Array(max + 1); c[0] = c[1] = 1; for (let i = 2; i * i <= max; i++) if (!c[i]) for (let j = i * i; j <= max; j += i) c[j] = 1; return c; }
export const band = x => Math.sqrt(x) * Math.log(x) / (8 * Math.PI);

export default function (fig) {
  const W = 380, H = 250, X0 = 52, X1 = 366, Y0 = 200, Y1 = 16, LX0 = 3, LX1 = 7;
  const s = svg(fig, W, H, 'The gap between the prime count and Riemann’s smooth estimate, staying well inside the band the Riemann hypothesis allows.');
  const g = el('g', {}, s), box = controls(fig);
  const [piR, liR, gapR, bandR] = readouts(fig, ['Primes up to x, π(x)', 'Estimate li(x)', 'Gap π(x) − li(x)', 'Allowed if Riemann is true']);
  // prime counts at sample points
  const comp = primeCounts(), P = 400, xs = [], pis = [];
  { let k = 0, cnt = 0; for (let i = 0; i <= P; i++) { const x = Math.round(10 ** (LX0 + (LX1 - LX0) * i / P)); while (k < x) { k++; if (!comp[k]) cnt++; } xs.push(x); pis.push(cnt); } }
  const pi = x => { let c = 0; for (let k = 2; k <= x; k++) if (!comp[k]) c++; return c; };
  const YM = 2500;   // the band reaches about 2,028 at ten million
  const X = x => X0 + (Math.log10(x) - LX0) / (LX1 - LX0) * (X1 - X0), Y = v => (Y0 + Y1) / 2 - v / YM * (Y0 - Y1) / 2;
  let lx = 6;
  function draw() {
    clear(g);
    [-.8, -.4, 0, .4, .8].forEach(f => { el('line', { x1: X0, y1: Y(f * YM), x2: X1, y2: Y(f * YM), stroke: LINE }, g); label(g, X0 - 5, Y(f * YM) + 4, Math.round(f * YM).toLocaleString(), { a: 'end', size: 9.5, cls: 'soft' }); });
    for (let e = LX0; e <= LX1; e++) label(g, X(10 ** e), Y0 + 15, '10' + '⁰¹²³⁴⁵⁶⁷'[e], { size: 10.5, cls: 'soft' });
    label(g, (X0 + X1) / 2, Y0 + 32, 'x (log scale) →', { size: 10.5, cls: 'soft' });
    let up = '', dn = '';
    xs.forEach((x, i) => { up += (i ? 'L' : 'M') + X(x).toFixed(1) + ' ' + Y(band(x)).toFixed(1); dn += (i ? 'L' : 'M') + X(x).toFixed(1) + ' ' + Y(-band(x)).toFixed(1); });
    el('path', { d: up, fill: 'none', stroke: GREEN, 'stroke-width': 2, 'stroke-dasharray': '5 4' }, g);
    el('path', { d: dn, fill: 'none', stroke: GREEN, 'stroke-width': 2, 'stroke-dasharray': '5 4' }, g);
    label(g, X1, Y(band(MAX)) - 6, 'Riemann’s band', { a: 'end', size: 10.5, w: 700, fill: GREEN });
    let d = ''; xs.forEach((x, i) => { d += (i ? 'L' : 'M') + X(x).toFixed(1) + ' ' + Y(pis[i] - li(x)).toFixed(1); });
    el('path', { d, fill: 'none', stroke: ORANGE, 'stroke-width': 2.5 }, g);
    label(g, X0 + 6, Y(0) + 26, 'π(x) − li(x), the real gap', { a: 'start', size: 10.5, w: 700, fill: ORANGE });
    const x = Math.round(10 ** lx), p = pi(x), l = li(x);
    el('line', { x1: X(x), y1: Y1, x2: X(x), y2: Y0, stroke: BLUE, 'stroke-dasharray': '3 3' }, g);
    el('circle', { cx: X(x), cy: Y(p - l), r: 4.5, fill: BLUE, stroke: INK, 'stroke-width': 1.2 }, g);
    piR.textContent = p.toLocaleString() + ' (x = ' + x.toLocaleString() + ')';
    liR.textContent = l.toLocaleString(undefined, { maximumFractionDigits: 1 });
    gapR.textContent = (p - l).toLocaleString(undefined, { maximumFractionDigits: 1 });
    bandR.textContent = '± ' + band(x).toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  slider(box, 'x = 10^', LX0 + .42, LX1, .01, lx, v => v.toFixed(2), v => { lx = v; draw(); });
  draw();
}
