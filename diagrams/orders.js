/* From one number to a stack of cubes: each new direction asks one more question of the data. */
import { svg, el, clear, label, controls, picker, readouts, grid, isoProject, quad, C } from './kit.js';

const STEPS = [
  { name: 'Number', shape: 'one value', count: 1, says: 'Flow at one gauge, on one day.' },
  { name: 'List', shape: '365', count: 365, says: 'One gauge, every day of a year.' },
  { name: 'Table', shape: '30 × 365', count: 10950, says: 'Thirty gauges, every day.' },
  { name: 'Cube', shape: '30 × 365 × 4', count: 43800, says: 'Add four variables: flow, snow, rain, temperature.' },
  { name: 'Row of cubes', shape: '30 × 365 × 4 × 10', count: 438000, says: 'Add ten climate models. Now it no longer fits in your head, and it still fits in the math.' }
];

function cube(g, cx, cy, n, s, fills) {
  const p = isoProject(cx, cy, s);
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
    quad(g, p, [a, n, b], [a + 1, n, b], [a + 1, n, b + 1], [a, n, b + 1], fills[0]);
    quad(g, p, [n, a, b], [n, a + 1, b], [n, a + 1, b + 1], [n, a, b + 1], fills[1]);
    quad(g, p, [a, b, n], [a + 1, b, n], [a + 1, b + 1, n], [a, b + 1, n], fills[2]);
  }
}

export default function (fig) {
  const s = svg(fig, 360, 190, 'A growing array: one number, a list, a table, a cube and a row of cubes.');
  const g = el('g', {}, s), box = controls(fig), [shape, count] = readouts(fig, ['Shape', 'Values']);
  const say = label(s, 180, 186, '', { size: 16 });
  const faces = [C.blue, C.orange, C.purple];
  function draw(k) {
    clear(g);
    if (k === 0) el('circle', { cx: 180, cy: 95, r: 22, fill: C.blue }, g);
    if (k === 1) grid(g, 180 - 8 * 15, 80, 1, 8, 30, () => C.blue, 3);
    if (k === 2) grid(g, 180 - 8 * 15, 20, 5, 8, 30, () => C.blue, 3);
    if (k === 3) cube(g, 180, 26, 4, 19, faces);
    if (k === 4) [[-122, 8], [-61, 92], [0, 8], [61, 92], [122, 8]].forEach(([dx, y]) => cube(g, 180 + dx, y, 3, 13, faces));
    shape.textContent = STEPS[k].shape;
    count.textContent = STEPS[k].count.toLocaleString();
    say.textContent = '';
    fig.querySelector('figcaption').textContent = STEPS[k].says;
  }
  say.remove();
  picker(box, STEPS.map(x => x.name), 3, draw);
  draw(3);
}
