/* One line of einsum, one correlation for every grid cell. The data is made up, with a warm patch planted three months ahead of a river. */
import { svg, el, clear, label, controls, slider, readouts, diverge, rng, gauss, C } from './kit.js';

const LAT = 12, LON = 18, T = 240, PLANT = 3;

export function build() {
  const R = rng(2024), river = new Float64Array(T + 12), cube = new Float64Array(LAT * LON * T);
  const driver = new Float64Array(T + 12);
  for (let t = 1; t < T + 12; t++) driver[t] = .7 * driver[t - 1] + gauss(R);
  for (let t = 0; t < T + 12; t++) river[t] = (t >= PLANT ? driver[t - PLANT] : 0) + .7 * gauss(R);
  for (let t = 0; t < T; t++) for (let i = 0; i < LAT; i++) for (let j = 0; j < LON; j++) {
    const near = Math.exp(-((i - 4) ** 2 + (j - 12) ** 2) / 14);
    cube[i + LAT * (j + LON * t)] = near * driver[t] + gauss(R) * .9;
  }
  return { river, cube };
}
/* correlate each cell's history with the river `lag` months later: means off, sum the products, scale. Same as einsum('ijt,t->ij'). */
export function corrMap({ river, cube }, lag) {
  const n = T - 12, y = new Float64Array(n);
  let my = 0;
  for (let t = 0; t < n; t++) { y[t] = river[t + lag]; my += y[t]; }
  my /= n;
  let vy = 0;
  for (let t = 0; t < n; t++) { y[t] -= my; vy += y[t] * y[t]; }
  const map = new Float64Array(LAT * LON);
  for (let i = 0; i < LAT; i++) for (let j = 0; j < LON; j++) {
    let m = 0, xy = 0, xx = 0;
    for (let t = 0; t < n; t++) m += cube[i + LAT * (j + LON * t)];
    m /= n;
    for (let t = 0; t < n; t++) { const x = cube[i + LAT * (j + LON * t)] - m; xy += x * y[t]; xx += x * x; }
    map[i + LAT * j] = xy / Math.sqrt(xx * vy);
  }
  return map;
}

export default function (fig) {
  const s = svg(fig, 360, 250, 'A map of correlation between each grid cell and a river some months later.');
  const g = el('g', {}, s), box = controls(fig), [best] = readouts(fig, ['Strongest cell at this lead']);
  const data = build(), c = 20;
  function draw(lag) {
    clear(g);
    const m = corrMap(data, lag);
    let top = 0;
    for (let i = 0; i < LAT; i++) for (let j = 0; j < LON; j++) {
      const v = m[i + LAT * j];
      top = Math.max(top, v);
      el('rect', { x: j * c, y: i * c, width: c - 1, height: c - 1, rx: 2, fill: diverge(Math.max(-1, Math.min(1, v * 1.4))) }, g);
    }
    label(g, 0, 8 + LAT * c + 12, 'blue: moves opposite', { a: 'start', size: 13, cls: 'soft' });
    label(g, 360, 8 + LAT * c + 12, 'orange: moves together', { a: 'end', size: 13, cls: 'soft' });
    best.textContent = 'r = ' + top.toFixed(2);
  }
  slider(box, 'Months ahead', 0, 9, 1, 0, v => v, draw);
  draw(0);
}
