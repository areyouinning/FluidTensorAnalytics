/* The neutral log profile: one forecast number, many winds, depending on what the ground wears. */
import { svg, el, clear, label, controls, slider, readouts, C } from './kit.js';
import { logSpeed } from './windcore.js';

const GROUND = [
  { z0: 0.0002, name: 'open water' },
  { z0: 0.03, name: 'mown grass' },
  { z0: 0.2, name: 'scrub and fences' },
  { z0: 0.8, name: 'forest' }
];
const UREF = 6, ZREF = 10, HMAX = 120;

export default function (fig) {
  const s = svg(fig, 360, 280, 'Wind speed against height above ground, for four kinds of ground cover, all passing through the forecast value at ten metres.');
  const g = el('g', {}, s), box = controls(fig);
  const [face, up] = readouts(fig, ['At head height (2 m)', 'At 80 m']);
  const X = v => 42 + v / 11 * 300, Y = h => 232 - Math.sqrt(h / HMAX) * 206;

  function draw(pick) {
    clear(g);
    /* the ground, and the anchor every curve shares */
    el('rect', { x: 42, y: 232, width: 300, height: 10, rx: 2, fill: C.sunk }, g);
    el('path', { d: `M42 26V232`, stroke: C.line, fill: 'none' }, g);
    for (const h of [2, 10, 40, 80, 120]) {
      el('path', { d: `M38 ${Y(h).toFixed(1)}H342`, stroke: C.line, fill: 'none', opacity: .5 }, g);
      label(g, 34, Y(h) + 5, h + '', { a: 'end', size: 13, cls: 'soft' });
    }
    GROUND.forEach((gr, k) => {
      const on = k === pick;
      let d = '';
      for (let i = 0; i <= 60; i++) {
        const h = HMAX * Math.pow(i / 60, 2) + 0.05;
        d += (i ? 'L' : 'M') + X(logSpeed(UREF, ZREF, h, gr.z0)).toFixed(1) + ' ' + Y(h).toFixed(1);
      }
      el('path', { d, fill: 'none', stroke: on ? C.blue : C.line, 'stroke-width': on ? 3 : 1.5, opacity: on ? 1 : .55 }, g);
    });
    const gr = GROUND[pick];
    el('circle', { cx: X(UREF), cy: Y(ZREF), r: 5, fill: C.orange }, g);
    label(g, X(UREF) + 10, Y(ZREF) - 8, 'the forecast', { a: 'start', size: 13, w: 600, fill: 'var(--orange-t)' });
    label(g, 192, 266, 'Wind speed, m/s', { size: 14, cls: 'soft' });
    el('text', { transform: 'translate(13 130) rotate(-90)', 'text-anchor': 'middle', 'font-size': 14, class: 'soft' }, g, 'Height, m');
    face.textContent = logSpeed(UREF, ZREF, 2, gr.z0).toFixed(1) + ' m/s';
    up.textContent = logSpeed(UREF, ZREF, 80, gr.z0).toFixed(1) + ' m/s';
    fig.querySelector('figcaption').textContent =
      `Over ${gr.name}, a 6 m/s forecast at 10 m means ${logSpeed(UREF, ZREF, 2, gr.z0).toFixed(1)} m/s in your face and ${logSpeed(UREF, ZREF, 80, gr.z0).toFixed(1)} m/s at roof height of a tall building. Rougher ground does not only slow the air down: it bends the whole profile, so the wind aloft runs further ahead of the wind you feel.`;
  }
  const pick = (box2 => {
    const names = GROUND.map(g2 => g2.name);
    const bs = names.map((n, k) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn'; b.textContent = n;
      b.addEventListener('click', () => { bs.forEach((x, j) => x.setAttribute('aria-pressed', j === k)); draw(k); });
      box2.appendChild(b);
      return b;
    });
    bs.forEach((b, j) => b.setAttribute('aria-pressed', j === 2));
    return bs;
  })(box);
  draw(2);
}
