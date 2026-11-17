/* Every second person steps out of a circle until one is left. People are dots around a ring; "Step" removes
   one, "Play" runs them all. When it finishes, n and the survivor are shown in binary: the survivor is n with
   its leading 1 moved to the end. */
import { svg, el, clear, label, controls, slider, button, readouts, calm } from './kit.js';

const BLUE = 'var(--blue)', ORANGE = 'var(--orange)', GREEN = 'var(--green)', INK = 'var(--ink)', SOFT = 'var(--ink-soft)', LINE = 'var(--line)', SUNK = 'var(--sunk)', PANEL = 'var(--panel)', ON = 'var(--on-accent)';

export default function (fig) {
  const s = svg(fig, 380, 284, 'A circle of numbered people. Every second person steps out until one is left.');
  const g = el('g', {}, s);
  const box = controls(fig), box2 = controls(fig);
  const [stillR, lastR, binR] = readouts(fig, ['Still in', 'Last one standing', 'In binary']);
  let n = 10, alive = [], pos = 1, timer = 0;

  function reset() { stop(); alive = Array.from({ length: n }, (_, i) => i + 1); pos = 1; draw(); }
  function stop() { clearInterval(timer); timer = 0; }
  function step() {
    if (alive.length < 2) return false;
    alive.splice(pos, 1);
    pos = (pos + 1) % alive.length;      // the next person steps out after one stays
    if (alive.length === 1) pos = 0;
    draw();
    return alive.length > 1;
  }
  function play() {
    stop();
    if (alive.length < 2) reset();
    if (calm()) { while (step()); return; }
    timer = setInterval(() => { if (!step()) stop(); }, 300);
  }

  function draw() {
    clear(g);
    const cx = 190, cy = 134, R = 112, r = n <= 16 ? 12 : n <= 32 ? 8.5 : 5;
    const done = alive.length === 1, inSet = new Set(alive), nextP = done ? 0 : alive[pos];
    el('circle', { cx, cy, r: R, fill: 'none', stroke: LINE, 'stroke-dasharray': '2 5' }, g);
    for (let p = 1; p <= n; p++) {
      const a = -Math.PI / 2 + 2 * Math.PI * (p - 1) / n, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
      const live = inSet.has(p), win = done && live, nx = p === nextP;
      if (nx) el('circle', { cx: x, cy: y, r: r + 4, fill: 'none', stroke: ORANGE, 'stroke-width': 2.5 }, g);
      if (win) el('circle', { cx: x, cy: y, r: r + 4, fill: 'none', stroke: GREEN, 'stroke-width': 2.5 }, g);
      el('circle', { cx: x, cy: y, r, fill: win ? GREEN : live ? BLUE : SUNK, stroke: live ? 'none' : LINE, 'stroke-width': 1, opacity: live ? 1 : .55 }, g);
      if (n <= 32) label(g, x, y + r * .36, String(p), { size: r * (p > 9 ? .95 : 1.15), w: 600, fill: live ? ON : SOFT });
    }
    if (done) {
      label(g, cx, cy - 4, 'Last one in', { size: 13, cls: 'soft' });
      label(g, cx, cy + 28, String(alive[0]), { size: 34, w: 700, fill: GREEN });
    } else {
      label(g, cx, cy - 4, 'Next to step out', { size: 13, cls: 'soft' });
      label(g, cx, cy + 28, String(nextP), { size: 34, w: 700, fill: ORANGE });
    }
    label(g, cx, 278, done ? 'Everyone else has stepped out.' : 'Blue are still in; faded have stepped out.', { size: 11, cls: 'soft' });
    stillR.textContent = String(alive.length);
    lastR.textContent = done ? String(alive[0]) : '—';
    binR.textContent = done ? n.toString(2) + ' → ' + alive[0].toString(2).padStart(n.toString(2).length, '0') : '—';
  }

  slider(box, 'People ', 2, 64, 1, n, v => String(v), v => { n = v; reset(); });
  button(box2, 'Step', () => { stop(); step(); }, 'go');
  button(box2, 'Play', play);
  button(box2, 'Reset', reset);
  reset();
}
