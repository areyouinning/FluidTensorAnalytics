/* One poisoned bottle among many, and a handful of tasters with one night to find it. Number the bottles
   in binary and give taster k a sip from every bottle whose k-th bit is 1. In the morning the sick tasters
   spell the poisoned bottle's number. n tasters cover 2^n bottles: ten cover 1024. */
import { svg, el, clear, label, controls, slider, button, readouts } from './kit.js';

const BLUE = 'var(--blue)', RED = 'var(--red)', GREEN = 'var(--green)', INK = 'var(--ink)', SOFT = 'var(--ink-soft)', SUNK = 'var(--sunk)', LINE = 'var(--line)';

export default function (fig) {
  const s = svg(fig, 380, 206, 'A row of tasters, each labeled with a power of two, lit when they sip from the chosen bottle or fall sick.');
  const g = el('g', {}, s);
  const box = controls(fig), box2 = controls(fig);
  const [covR, sipR, verR] = readouts(fig, ['Bottles covered', 'This bottle', 'Morning']);
  let n = 10, bottle = 617, poison = -1;
  const bin = v => v.toString(2).padStart(n, '0');

  function draw() {
    clear(g);
    const w = 360 / n, r = Math.min(15, w / 2 - 3), tested = poison >= 0;
    label(g, 190, 22, tested ? 'Morning: who is sick?' : 'Bottle ' + bottle + ' in binary is ' + bin(bottle), { size: 14, w: 600 });
    for (let k = n - 1; k >= 0; k--) {
      const cx = 10 + (n - 1 - k + 0.5) * w, sips = (bottle >> k) & 1, sick = tested && ((poison >> k) & 1);
      // a little taster: head and shoulders
      el('circle', { cx, cy: 70, r, fill: sick ? RED : !tested && sips ? BLUE : SUNK, stroke: sick ? RED : INK, 'stroke-width': 1.5 }, g);
      el('path', { d: `M${cx - r - 2} ${70 + r * 2.6}q${r + 2} ${-r * 2.2} ${2 * r + 4} 0`, fill: sick ? RED : !tested && sips ? BLUE : SUNK, stroke: sick ? RED : INK, 'stroke-width': 1.5 }, g);
      label(g, cx, 70 + r * 2.6 + 18, String(1 << k), { size: n > 8 ? 11 : 13, w: 600, fill: sick ? RED : !tested && sips ? BLUE : SOFT });
      label(g, cx, 70 + r * 2.6 + 36, tested ? (sick ? '1' : '0') : String(sips), { size: 15, w: 700, fill: sick ? RED : INK });
    }
    const sum = [], v = tested ? poison : bottle; for (let k = n - 1; k >= 0; k--) if ((v >> k) & 1) sum.push(1 << k);
    label(g, 190, 190, (sum.length ? sum.join(' + ') : '0') + ' = ' + v, { size: 13, w: 600, fill: tested ? RED : BLUE });
    covR.textContent = n + ' tasters cover ' + (1 << n);
    sipR.textContent = tested ? '—' : sum.length + ' of ' + n + ' tasters sip it';
    verR.textContent = tested ? 'the sick ones add to ' + poison + ': that is the bottle' : 'not yet — run the test';
  }
  let bs;
  slider(box, 'Tasters ', 3, 10, 1, n, v => String(v), v => { n = v; poison = -1; bs.max = (1 << n) - 1; if (bottle > bs.max) { bottle = +bs.max; } bs.value = bottle; bs.dispatchEvent(new Event('input')); });
  bs = slider(box, 'Bottle ', 0, (1 << n) - 1, 1, bottle, v => String(v), v => { bottle = v; poison = -1; draw(); });
  button(box2, 'Poison one and wait for morning', () => { poison = Math.floor(Math.random() * (1 << n)); draw(); }, 'go');
  button(box2, 'Back to the cellar', () => { poison = -1; draw(); });
  draw();
}
