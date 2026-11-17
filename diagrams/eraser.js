/* The quantum eraser, honestly. Each signal photon carries a hidden which-path marker, entangled with
   a partner. Look at all the photons together and the screen is FLAT — no fringes, ever. "Erasing" the
   marker does not add fringes to that total. What it lets you do is SORT the same photons by the
   partner's outcome into two groups — one a fringe, the other its anti-fringe — that add right back to
   flat. Nothing reaches into the past; the correlation was there all along, waiting to be read. */
import { svg, el, clear, label, controls, button, picker, readouts, rng, C } from './kit.js';

const INK = 'var(--ink)', SOFT = 'var(--ink-soft)', LINE = 'var(--line)', BLUE = 'var(--blue)', ORANGE = 'var(--orange)', GREEN = 'var(--green)';
const X0 = 34, X1 = 350, Y0 = 176, YT = 24, N = 9000, BINS = 22;

export default function (fig) {
  const s = svg(fig, 380, 210, 'Photon hits across a screen: flat as a whole, but two interleaved fringe patterns once sorted by the marker.'), g = el('g', {}, s);
  const box = controls(fig);
  const [totR, subR] = readouts(fig, ['Whole pattern', 'Sorted subsets']);
  let mode = 0, seed = 7;

  function sample() {
    const R = rng(seed), tot = new Array(BINS).fill(0), a = new Array(BINS).fill(0), b = new Array(BINS).fill(0);
    for (let i = 0; i < N; i++) { const x = R() * 2 * Math.PI, bin = Math.min(BINS - 1, Math.floor(x / (2 * Math.PI) * BINS)), isA = R() < Math.cos(x / 2) ** 2;
      tot[bin]++; if (isA) a[bin]++; else b[bin]++; }
    return { tot, a, b };
  }
  const vis = arr => { let re = 0, im = 0, sum = 0; for (let i = 0; i < arr.length; i++) { const x = (i + 0.5) / arr.length * 2 * Math.PI; re += arr[i] * Math.cos(x); im += arr[i] * Math.sin(x); sum += arr[i]; } return sum ? Math.min(1, 2 * Math.hypot(re, im) / sum) : 0; };   // amplitude of the fringe (frequency-1), 0 = flat

  function draw() {
    clear(g);
    const { tot, a, b } = sample();
    const scale = (Y0 - YT) / (N / BINS * 2.1), bw = (X1 - X0) / BINS;
    el('path', { d: `M${X0} ${Y0}H${X1}`, stroke: INK, 'stroke-width': 1.5 }, g);
    label(g, X0, Y0 + 16, 'phase / position across the screen →', { a: 'start', size: 11, cls: 'soft' });
    // theory curves
    const curve = (fn, col, op) => { let d = ''; for (let i = 0; i <= 90; i++) { const x = i / 90 * 2 * Math.PI, X = X0 + i / 90 * (X1 - X0), Y = Y0 - fn(x) * (N / BINS) * scale; d += (i ? 'L' : 'M') + X.toFixed(1) + ' ' + Y.toFixed(1); } el('path', { d, fill: 'none', stroke: col, 'stroke-width': 2, opacity: op }, g); };
    function bars(arr, col, op) { arr.forEach((c, i) => el('rect', { x: X0 + i * bw + 1, y: Y0 - c * scale, width: bw - 2, height: c * scale, fill: col, opacity: op }, g)); }
    if (mode === 0) {   // whole pattern: flat
      bars(tot, SOFT, .55); curve(() => 1, SOFT, .9);
      label(g, (X0 + X1) / 2, YT - 4, 'Everyone together: no fringes', { size: 12, w: 600 });
    } else {            // sorted by the marker: fringe + anti-fringe
      bars(a, BLUE, .5); bars(b, ORANGE, .5);
      curve(x => Math.cos(x / 2) ** 2, BLUE, .95); curve(x => Math.sin(x / 2) ** 2, ORANGE, .95);
      curve(() => 1, SOFT, .5);
      label(g, (X0 + X1) / 2, YT - 4, 'Sorted: a fringe (blue) and its anti-fringe (orange)', { size: 12, w: 600 });
      label(g, (X0 + X1) / 2, YT + 11, 'they add back to the same flat total', { size: 11, cls: 'soft' });
    }
    totR.textContent = 'flat — ' + (vis(tot) * 100).toFixed(0) + '% contrast';
    subR.textContent = mode === 0 ? 'hidden until you sort' : 'blue ' + (vis(a) * 100).toFixed(0) + '%, orange ' + (vis(b) * 100).toFixed(0) + '% contrast';
  }
  picker(box, ['See the whole pattern', 'Sort by the marker'], 0, k => { mode = k; draw(); });
  button(box, 'New sample', () => { seed = (seed * 48271 % 2147483647) | 0; draw(); });
  draw();
}
