/* A chaotic system run many times from almost the same start. This is the Lorenz 1963 model, integrated for real. */
import { svg, el, clear, label, controls, slider, button, readouts, rng, gauss, C } from './kit.js';

const f = (x, y, z) => [10 * (y - x), x * (28 - z) - y, x * y - 8 / 3 * z];
function rk4(s, h) {
  const a = f(...s), b = f(s[0] + h / 2 * a[0], s[1] + h / 2 * a[1], s[2] + h / 2 * a[2]);
  const c = f(s[0] + h / 2 * b[0], s[1] + h / 2 * b[1], s[2] + h / 2 * b[2]);
  const d = f(s[0] + h * c[0], s[1] + h * c[1], s[2] + h * c[2]);
  return s.map((v, i) => v + h / 6 * (a[i] + 2 * b[i] + 2 * c[i] + d[i]));
}
export function runs(n, spread, seed, T = 16, h = .01) {
  const R = rng(seed), out = [];
  for (let m = 0; m < n; m++) {
    let s = [1.5 + (m ? spread * gauss(R) : 0), -2 + (m ? spread * gauss(R) : 0), 21 + (m ? spread * gauss(R) : 0)];
    const xs = [];
    for (let t = 0; t < T / h; t++) { s = rk4(s, h); if (t % 4 === 0) xs.push(s[0]); }
    out.push(xs);
  }
  return out;
}

export default function (fig) {
  const s = svg(fig, 360, 210, 'Many forecast lines leave one point together, then fan out across the whole range.');
  const g = el('g', {}, s), box = controls(fig), [agree] = readouts(fig, ['The lines stay together until about']);
  let spread = .01, seed = 3;
  const W = 360, H = 190, X = i => i / (T - 1) * W, Y = v => 95 - v * 4.2;
  let T = 1;
  function draw() {
    const all = runs(40, spread, seed);
    T = all[0].length;
    clear(g);
    el('path', { d: `M0 ${Y(0)}H${W}`, stroke: C.line, fill: 'none' }, g);
    all.slice(1).forEach(xs => el('path', { d: 'M' + xs.map((v, i) => X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join('L'), fill: 'none', stroke: C.blue, 'stroke-width': 1, opacity: .4 }, g));
    el('path', { d: 'M' + all[0].map((v, i) => X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join('L'), fill: 'none', stroke: C.orange, 'stroke-width': 2.2 }, g);
    let split = T - 1;
    for (let i = 0; i < T; i++) {
      let lo = 1e9, hi = -1e9;
      for (const xs of all) { lo = Math.min(lo, xs[i]); hi = Math.max(hi, xs[i]); }
      if (hi - lo > 10) { split = i; break; }
    }
    el('path', { d: `M${X(split)} 6V${H}`, stroke: C.ink, 'stroke-dasharray': '3 3', fill: 'none' }, g);
    agree.textContent = 't = ' + (split * .04).toFixed(1);
    label(g, 0, 206, 'time', { a: 'start', size: 13, cls: 'soft' });
    label(g, 360, 206, 't = 16', { a: 'end', size: 13, cls: 'soft' });
  }
  slider(box, 'Start error', -6, 0, 1, -2, v => v === 0 ? '1' : '0.' + '0'.repeat(-v - 1) + '1', v => { spread = 10 ** v; draw(); });
  button(box, 'New nudges', () => { seed = seed * 13 % 9973; draw(); });
  draw();
}
