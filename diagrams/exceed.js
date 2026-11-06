/* Turn a pile of outcomes into the question you care about: how likely is it to pass this line? */
import { svg, el, clear, label, controls, slider, readouts, rng, gauss, C } from './kit.js';

export default function (fig) {
  const R = rng(99), members = Array.from({ length: 100 }, () => Math.exp(1.1 + .42 * gauss(R))).sort((a, b) => a - b);
  const s = svg(fig, 360, 180, 'One hundred forecast outcomes as dots stacked along a scale, split by a movable threshold.');
  const g = el('g', {}, s), box = controls(fig), [odds, single] = readouts(fig, ['Chance of passing it', 'The one best guess says']);
  const mid = members[50], X = v => Math.min(350, 10 + v / 10 * 340);
  let line = 4.5;
  function draw() {
    clear(g);
    const stacks = {};
    let over = 0;
    members.forEach(v => {
      const bin = Math.round(X(v) / 9) * 9, h = stacks[bin] = (stacks[bin] || 0) + 1, hit = v >= line;
      if (hit) over++;
      el('circle', { cx: bin, cy: 150 - h * 9, r: 3.8, fill: hit ? C.orange : C.blue }, g);
    });
    el('path', { d: `M10 150H350`, stroke: C.soft, fill: 'none' }, g);
    el('path', { d: `M${X(line)} 8V150`, stroke: C.ink, 'stroke-width': 2, fill: 'none' }, g);
    for (let v = 0; v <= 10; v += 2) label(g, X(v), 170, v, { size: 13, cls: 'soft' });
    odds.textContent = over + ' in 100';
    single.textContent = mid >= line ? 'Yes, it passes' : 'No, it stays under';
  }
  slider(box, 'Flood line', 1, 9, .25, line, v => v.toFixed(2), v => { line = v; draw(); });
  draw();
}
