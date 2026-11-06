/* Forecast by asking which past years looked like this one, then seeing what those years did next. */
import { svg, el, clear, label, controls, slider, readouts, rng, gauss, C } from './kit.js';

export default function (fig) {
  const R = rng(321), years = Array.from({ length: 40 }, () => { const snow = 4 + R() * 24; return { snow, flow: snow * 1.1 + 3 + gauss(R) * 3.6 }; });
  const s = svg(fig, 360, 250, 'Scatter of snowpack against later flow for forty invented years, with the nearest years to a chosen snowpack highlighted.');
  const g = el('g', {}, s), box = controls(fig), [center, span] = readouts(fig, ['Middle of those years', 'Their range']);
  let now = 16, k = 7;
  const X = v => 28 + v / 30 * 322, Y = v => 216 - v / 40 * 206;
  function draw() {
    clear(g);
    const near = [...years].sort((a, b) => Math.abs(a.snow - now) - Math.abs(b.snow - now)).slice(0, k);
    el('path', { d: `M28 10V216H350`, stroke: C.soft, fill: 'none' }, g);
    el('path', { d: `M${X(now)} 10V216`, stroke: C.orange, 'stroke-width': 2, 'stroke-dasharray': '4 3', fill: 'none' }, g);
    years.forEach(y => { const hit = near.includes(y); el('circle', { cx: X(y.snow), cy: Y(y.flow), r: hit ? 6 : 4, fill: hit ? C.orange : C.line }, g); });
    label(g, 190, 240, 'Snowpack on April 1', { size: 14, cls: 'soft' });
    el('text', { transform: 'translate(14 115) rotate(-90)', 'text-anchor': 'middle', 'font-size': 14, class: 'soft' }, g, 'Flow that summer');
    const flows = near.map(y => y.flow).sort((a, b) => a - b);
    center.textContent = flows[Math.floor(k / 2)].toFixed(1);
    span.textContent = flows[0].toFixed(1) + ' to ' + flows[k - 1].toFixed(1);
  }
  slider(box, 'This year', 4, 28, 1, now, null, v => { now = v; draw(); });
  slider(box, 'Neighbors', 3, 15, 1, k, null, v => { k = v; draw(); });
  draw();
}
