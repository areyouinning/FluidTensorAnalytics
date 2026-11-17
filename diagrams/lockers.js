/* A hundred lockers, a hundred students. Student k flips every k-th locker. Locker n is touched once for
   each divisor of n, so it ends open only if n has an odd number of divisors — and divisors pair up
   (d with n/d) unless n is a perfect square, where the root pairs with itself. Tap a locker to see its pairs. */
import { svg, el, clear, label, controls, slider, button, readouts, calm } from './kit.js';

const BLUE = 'var(--blue)', ORANGE = 'var(--orange)', INK = 'var(--ink)', SOFT = 'var(--ink-soft)', SUNK = 'var(--sunk)', LINE = 'var(--line)';
const N = 100, CELL = 32, X0 = 30, Y0 = 8;

export default function (fig) {
  const s = svg(fig, 380, 340, 'A ten by ten grid of numbered lockers, open or shut, after some number of students have walked past.');
  const g = el('g', {}, s);
  const box = controls(fig);
  const [openR, pickR] = readouts(fig, ['Open now', 'Locker']);
  let k = 0, pick = 36, timer = 0;
  const divs = n => { const out = []; for (let d = 1; d <= n; d++) if (n % d === 0) out.push(d); return out; };
  const isOpen = n => divs(n).filter(d => d <= k).length % 2 === 1;

  function draw() {
    clear(g);
    const open = [];
    for (let n = 1; n <= N; n++) {
      const c = (n - 1) % 10, r = Math.floor((n - 1) / 10), o = isOpen(n), justHit = k > 0 && n % k === 0;
      if (o) open.push(n);
      const cell = el('rect', { x: X0 + c * CELL, y: Y0 + r * CELL, width: CELL - 3, height: CELL - 3, rx: 4, fill: o ? BLUE : SUNK, stroke: n === pick ? ORANGE : justHit ? INK : LINE, 'stroke-width': n === pick ? 3 : justHit ? 1.5 : 1, style: 'cursor:pointer' }, g);
      cell.addEventListener('click', () => { pick = n; draw(); });
      el('text', { x: X0 + c * CELL + (CELL - 3) / 2, y: Y0 + r * CELL + 19, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 600, style: 'pointer-events:none;fill:' + (o ? 'var(--on-accent)' : SOFT) }, g, String(n));
    }
    openR.textContent = open.length + (open.length && open.length <= 12 ? ': ' + open.join(', ') : '');
    const d = divs(pick), pairs = []; for (const a of d) { const b = pick / a; if (a < b) pairs.push(a + '×' + b); else if (a === b) pairs.push(a + '×' + a + ' (alone)'); }
    pickR.textContent = pick + ' = ' + pairs.join(', ') + ' · ' + d.length + ' touches, ends ' + (d.length % 2 ? 'open' : 'shut');
  }
  function stop() { clearInterval(timer); timer = 0; }
  const sl = slider(box, 'Students gone by ', 0, N, 1, 0, v => String(v), v => { k = v; draw(); });
  button(box, 'Send them all', () => {
    stop(); if (calm()) { k = N; sl.value = N; sl.dispatchEvent(new Event('input')); return; }
    k = 0; timer = setInterval(() => { k++; sl.value = k; sl.dispatchEvent(new Event('input')); if (k >= N) stop(); }, 70);
  }, 'go');
  button(box, 'Shut them all', () => { stop(); sl.value = 0; sl.dispatchEvent(new Event('input')); });
  draw();
}
