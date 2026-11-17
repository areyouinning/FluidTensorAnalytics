/* 100 kg of potatoes, 99% water. The dry matter never changes, so as the water share falls the total must
   shrink: total = dry / (1 - water fraction). The grid is drawn to scale: one square is one kilogram of the
   original 100, filled blue (water) and orange (dry) only as far as today's total reaches. */
import { svg, el, clear, label, controls, slider, picker, readouts } from './kit.js';

const BLUE = 'var(--blue)', ORANGE = 'var(--orange)', SUNK = 'var(--sunk)', LINE = 'var(--line)', SOFT = 'var(--ink-soft)';
const START = [90, 95, 99, 99.9], CELL = 24, X0 = 12, Y0 = 20;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export default function (fig) {
  const s = svg(fig, 380, 300, 'A ten by ten grid, one square per kilogram of the original potatoes. Blue is water and orange is dry matter. As the water share falls, the filled area shrinks while the orange stays the same size.');
  const g = el('g', {}, s);
  const box = controls(fig);
  const [totR, watR, dryR, shareR] = readouts(fig, ['Total weight', 'Water', 'Dry matter', 'Dry share']);
  let w0 = 99, w1 = 99, sl;

  function draw() {
    clear(g);
    const dry = 100 * (1 - w0 / 100), total = dry / (1 - w1 / 100), water = total - dry, share = 100 * dry / total;
    for (let i = 0; i < 100; i++) {
      const x = X0 + (i % 10) * CELL, y = Y0 + Math.floor(i / 10) * CELL, w = CELL - 3;
      el('rect', { x, y, width: w, height: w, rx: 3, fill: SUNK, stroke: LINE, 'stroke-width': 1 }, g);
      const c = clamp(total - i, 0, 1), d = clamp(dry - i, 0, 1);
      if (c > 0) el('rect', { x, y, width: w * c, height: w, rx: 3, fill: BLUE }, g);
      if (d > 0) el('rect', { x, y, width: w * d, height: w, rx: 3, fill: ORANGE }, g);
    }
    label(g, X0, 13, 'Each square is 1 kg of the original 100 kg', { a: 'start', size: 11, fill: SOFT });
    const rx = X0 + 10 * CELL + 6;
    label(g, rx, 58, 'Weight now', { a: 'start', size: 11, fill: SOFT });
    label(g, rx, 84, total.toFixed(1) + ' kg', { a: 'start', size: 22, w: 700 });
    label(g, rx, 120, 'Dry matter', { a: 'start', size: 11, fill: SOFT });
    label(g, rx, 140, dry.toFixed(1) + ' kg', { a: 'start', size: 16, w: 700, fill: ORANGE });
    label(g, rx, 176, 'Dry share', { a: 'start', size: 11, fill: SOFT });
    label(g, rx, 196, (100 - w0).toFixed(1).replace(/\.0$/, '') + '% → ' + share.toFixed(1).replace(/\.0$/, '') + '%', { a: 'start', size: 14, w: 700 });
    /* share bar */
    const bx = X0, by = Y0 + 10 * CELL + 10, bw = 10 * CELL - 3;
    el('rect', { x: bx, y: by, width: bw, height: 14, rx: 3, fill: BLUE }, g);
    el('rect', { x: bx, y: by, width: Math.max(2, bw * share / 100), height: 14, rx: 3, fill: ORANGE }, g);
    label(g, bx + bw + 9, by + 11, 'dry share', { a: 'start', size: 10, fill: SOFT });
    totR.textContent = total.toFixed(1) + ' kg';
    watR.textContent = water.toFixed(1) + ' kg';
    dryR.textContent = dry.toFixed(1) + ' kg';
    shareR.textContent = share.toFixed(1) + '%';
  }
  const fmt = v => v.toFixed(1) + '%';
  sl = slider(box, 'Water after drying ', 50, 99.9, 0.1, 99, fmt, v => { w1 = Math.min(v, w0); if (w1 !== v) { sl.value = w1; sl.nextSibling.textContent = fmt(w1); } draw(); });
  picker(box, START.map(v => v + '% to start'), 2, k => {
    w0 = START[k]; w1 = w0; sl.value = w0; sl.nextSibling.textContent = fmt(w0); draw();
  });
  draw();
}
