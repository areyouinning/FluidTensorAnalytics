/* Tower of Hanoi. Tap a peg to lift its top disk, tap another peg to set it down; a larger disk will
   not sit on a smaller one. "Solve" plays the standard recursion: move n-1 disks to the spare peg,
   move the largest, move n-1 back on top. That takes 2^n - 1 moves, which is the fewest possible. */
import { svg, el, clear, label, controls, slider, button, readouts, calm } from './kit.js';

const INK = 'var(--ink)', SOFT = 'var(--ink-soft)', LINE = 'var(--line)', PANEL = 'var(--panel)';
const HUES = ['var(--blue)', 'var(--orange)', 'var(--green)', 'var(--purple)', 'var(--gold)', 'var(--red)'];
const PX = [64, 190, 316], BASE = 226, DH = 16, NAMES = ['left', 'middle', 'right'];

/* the optimal move list for n disks: [disk (1 = smallest), from, to] */
export function solution(n, a = 0, b = 2, c = 1, out = []) {
  if (n === 0) return out;
  solution(n - 1, a, c, b, out);
  out.push([n, a, b]);
  solution(n - 1, c, b, a, out);
  return out;
}

export default function (fig) {
  const s = svg(fig, 380, 252, 'Three pegs with a stack of disks on the left peg, largest at the bottom. Tap pegs to move disks.');
  const g = el('g', {}, s);
  const box = controls(fig);
  const [movesR, bestR, noteR] = readouts(fig, ['Moves', 'Fewest possible', 'Last move']);
  let n = 4, pegs, held, moves, timer = 0, note = 'Tap a peg to lift its top disk.';

  const stop = () => { clearInterval(timer); timer = 0; };
  const solved = () => pegs[2].length === n;
  function reset(msg) {
    stop(); pegs = [Array.from({ length: n }, (_, i) => n - i), [], []]; held = -1; moves = 0;
    note = msg || 'Tap a peg to lift its top disk.'; draw();
  }
  const width = d => n === 1 ? 70 : 30 + (d - 1) * (86 / (n - 1));

  function disk(d, cx, y, lifted) {
    const w = width(d);
    el('rect', { x: cx - w / 2, y, width: w, height: DH - 2, rx: 6, fill: HUES[(d - 1) % HUES.length], stroke: lifted ? INK : PANEL, 'stroke-width': lifted ? 2.5 : 1 }, g);
    if (w >= 34) label(g, cx, y + DH - 5, String(d), { size: 10, w: 700, fill: 'var(--on-accent)' });
  }

  function draw() {
    clear(g);
    el('rect', { x: 8, y: BASE, width: 364, height: 6, rx: 3, fill: LINE }, g);
    for (let p = 0; p < 3; p++) {
      const cx = PX[p], top = BASE - n * DH - 16;
      const cell = el('g', { role: 'button', tabindex: '0', 'aria-label': 'Peg ' + (p + 1) + ' (' + NAMES[p] + '), ' + pegs[p].length + ' disks' + (held === p ? ', top disk lifted' : ''), style: 'cursor:pointer' }, g);
      el('rect', { x: cx - 60, y: 20, width: 120, height: BASE + 10 - 20, rx: 8, fill: held === p ? 'color-mix(in srgb, var(--blue) 12%, transparent)' : 'transparent' }, cell);
      el('rect', { x: cx - 3, y: top, width: 6, height: BASE - top, rx: 3, fill: SOFT, opacity: .6 }, cell);
      pegs[p].forEach((d, k) => {
        const lifted = held === p && k === pegs[p].length - 1;
        disk(d, cx, lifted ? 30 : BASE - (k + 1) * DH + 1, lifted);
      });
      label(cell, cx, BASE + 20, String(p + 1), { size: 12, cls: 'soft' });
      cell.addEventListener('click', () => tap(p));
      cell.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(p); } });
    }
    movesR.textContent = moves + (solved() ? ' — solved' : '');
    bestR.textContent = '2^' + n + ' − 1 = ' + (2 ** n - 1);
    noteR.textContent = note;
  }
  function refocus(p) { const c = g.querySelectorAll('[role=button]')[p]; if (c) c.focus({ preventScroll: true }); }

  function tap(p) {
    stop();
    if (held < 0) {
      if (!pegs[p].length) { note = 'That peg is empty.'; }
      else { held = p; note = 'Disk ' + pegs[p][pegs[p].length - 1] + ' lifted.'; }
    } else if (held === p) { held = -1; note = 'Put back.'; }
    else {
      const d = pegs[held][pegs[held].length - 1], t = pegs[p][pegs[p].length - 1];
      if (t !== undefined && t < d) note = 'Refused: disk ' + d + ' is larger than disk ' + t + '.';
      else { pegs[held].pop(); pegs[p].push(d); moves++; note = 'Disk ' + d + ' to peg ' + (p + 1) + '.'; held = -1; }
    }
    draw(); refocus(p);
  }

  function solve() {
    reset();
    const sol = solution(n);
    const step = ([d, a, b]) => { pegs[a].pop(); pegs[b].push(d); moves++; note = 'Disk ' + d + ' to peg ' + (b + 1) + '.'; draw(); };
    if (calm()) { sol.forEach(step); return; }
    let i = 0;
    timer = setInterval(() => { if (i >= sol.length) { stop(); return; } step(sol[i++]); if (i >= sol.length) stop(); }, 350);
  }

  slider(box, 'Disks ', 3, 8, 1, n, v => String(v), v => { n = v; reset(); });
  button(box, 'Solve', solve, 'go');
  button(box, 'Start over', () => reset());
  reset();
}
