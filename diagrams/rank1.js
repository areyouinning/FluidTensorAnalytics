/* The simplest cube: three short lists multiplied every possible way. Every number in the picture is the product of its row, column and layer. */
import { svg, el, clear, label, controls, slider, ramp, C } from './kit.js';

const sites = [3, 2, 1], months = [1, 4, 2, 1];

export default function (fig) {
  const s = svg(fig, 360, 240, 'Three lists multiplied into two layers of numbers: site size, month shape and how wet each year was.');
  const g = el('g', {}, s), box = controls(fig);
  const years = [1, 2];
  const cw = 30, top = 88;
  function layer(x0, wet, name) {
    label(g, x0 + cw * 2, 22, name, { w: 600, size: 15 });
    el('rect', { x: x0 + cw * 2 - 24, y: 30, width: 48, height: 26, rx: 6, fill: C.purple }, g);
    label(g, x0 + cw * 2, 49, '× ' + wet, { w: 600, size: 16, cls: 'mono', fill: 'var(--on-accent)' });
    months.forEach((m, j) => {
      el('rect', { x: x0 + j * cw + 2, y: 60, width: cw - 4, height: 24, rx: 5, fill: C.orange }, g);
      label(g, x0 + j * cw + cw / 2, 78, m, { w: 600, cls: 'mono', fill: 'var(--on-accent)' });
    });
    sites.forEach((a, i) => months.forEach((m, j) => {
      const v = a * m * wet;
      el('rect', { x: x0 + j * cw + 2, y: top + i * cw + 2, width: cw - 4, height: cw - 4, rx: 5, fill: ramp(Math.min(1, v / 36 + .08)) }, g);
      label(g, x0 + j * cw + cw / 2, top + i * cw + 20, +v.toFixed(1), { cls: 'mono', size: 13, w: 600, fill: v / 36 > .55 ? 'var(--on-accent)' : 'var(--ink)' });
    }));
  }
  function draw() {
    clear(g);
    label(g, 18, 78, 'site', { size: 13, cls: 'soft' });
    sites.forEach((a, i) => {
      el('rect', { x: 2, y: top + i * cw + 2, width: 32, height: cw - 4, rx: 5, fill: C.blue }, g);
      label(g, 18, top + i * cw + 20, a, { w: 600, cls: 'mono', fill: 'var(--on-accent)' });
    });
    layer(44, years[0], 'Year 1');
    layer(44 + cw * 4 + 18, years[1], 'Year 2');
    label(g, 180, 200, 'row 1, column 2, year 2:', { size: 15, cls: 'soft' });
    el('text', { x: 180, y: 226, 'text-anchor': 'middle', 'font-size': 18, class: 'mono', 'font-weight': 600 }, g, `${sites[0]} × ${months[1]} × ${years[1]} = ${+(sites[0] * months[1] * years[1]).toFixed(1)}`);
  }
  slider(box, 'Year 1', .5, 3, .5, 1, v => '×' + v, v => { years[0] = v; draw(); });
  slider(box, 'Year 2', .5, 3, .5, 2, v => '×' + v, v => { years[1] = v; draw(); });
  draw();
}
