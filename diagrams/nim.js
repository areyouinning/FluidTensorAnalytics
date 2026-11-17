/* Nim with three piles. Tap a stone to take it and every stone above it. The computer plays perfectly:
   from a position whose nim-sum (XOR of the pile sizes) is not zero it moves to make the sum zero;
   from a zero position it takes one stone from a largest pile and hopes for a mistake. */
import { svg, el, clear, label, controls, button, picker, readouts, calm } from './kit.js';

const INK = 'var(--ink)', SOFT = 'var(--ink-soft)', LINE = 'var(--line)', PANEL = 'var(--panel)';
const HUES = ['var(--blue)', 'var(--orange)', 'var(--green)'];
const PX = [70, 190, 310], BASE = 176, SH = 22, SW = 70;
const bin = n => n.toString(2).padStart(3, '0');
const MONO = 'font-family:var(--mono, ui-monospace, monospace)';

export const nimSum = piles => piles.reduce((a, b) => a ^ b, 0);
/* the computer's move: [pile index, new size] */
export function reply(piles) {
  const x = nimSum(piles);
  if (x) { for (let i = 0; i < piles.length; i++) if ((piles[i] ^ x) < piles[i]) return [i, piles[i] ^ x]; }
  let m = 0;
  piles.forEach((p, i) => { if (p > piles[m]) m = i; });
  return [m, piles[m] - 1];
}

export default function (fig) {
  const s = svg(fig, 380, 292, 'Three piles of stones in a game of Nim. Tap a stone to take it and every stone above it.');
  const g = el('g', {}, s);
  const box = controls(fig);
  const [turnR, sumR] = readouts(fig, ['Turn', 'Nim-sum']);
  const sumStat = sumR.parentElement;
  let start = 0, first = [3, 4, 5], piles, turn, secret = false, timer = 0, last = '', lastPile = 0;

  const over = () => piles.every(p => !p);
  const stop = () => { clearTimeout(timer); timer = 0; };

  function newGame(p) {
    stop(); first = p.slice(); piles = p.slice(); turn = 'you'; last = '';
    if (start === 1) { turn = 'cpu'; draw(); schedule(); } else draw();
  }
  function schedule() {
    if (calm()) cpu(); else timer = setTimeout(cpu, 600);
  }
  function cpu() {
    timer = 0;
    if (turn !== 'cpu' || over()) return;
    const [i, n] = reply(piles), took = piles[i] - n;
    piles[i] = n;
    last = 'Computer took ' + took + ' from pile ' + (i + 1) + '.';
    turn = over() ? 'cpuwin' : 'you';
    draw();
  }
  function take(i, k) {            /* leave k stones in pile i */
    if (turn !== 'you') return;
    const took = piles[i] - k;
    piles[i] = k; lastPile = i;
    last = 'You took ' + took + ' from pile ' + (i + 1) + '.';
    if (over()) { turn = 'youwin'; draw(); return; }
    turn = 'cpu'; draw(); schedule();
  }

  function draw(refocus) {
    const hadFocus = g.contains(document.activeElement);
    clear(g);
    const live = turn === 'you';
    for (let p = 0; p < 3; p++) {
      const cx = PX[p], n = piles[p];
      el('rect', { x: cx - 44, y: BASE, width: 88, height: 5, rx: 2.5, fill: LINE }, g);
      if (!n) el('rect', { x: cx - 25, y: BASE - SH + 2, width: 50, height: SH - 4, rx: 6, fill: 'none', stroke: LINE, 'stroke-dasharray': '3 3' }, g);
      for (let k = 1; k <= n; k++) {
        const y = BASE - k * SH + 1;
        const c = el('g', { role: 'button', tabindex: live ? '0' : '-1', 'aria-disabled': live ? 'false' : 'true', 'data-pile': p, 'data-stone': k,
          'aria-label': 'Pile ' + (p + 1) + ', stone ' + k + ' of ' + n + ': take ' + (n - k + 1) + (n - k + 1 === 1 ? ' stone' : ' stones'), style: 'cursor:' + (live ? 'pointer' : 'default') }, g);
        el('rect', { x: cx - SW / 2 - 4, y: y - 1, width: SW + 8, height: SH, fill: 'transparent' }, c);
        el('rect', { x: cx - SW / 2, y, width: SW, height: SH - 3, rx: 9, fill: HUES[p], stroke: PANEL, 'stroke-width': 1.5 }, c);
        c.addEventListener('click', () => take(p, k - 1));
        c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); take(p, k - 1); } });
      }
      label(g, cx, BASE + 22, String(n), { size: 16, w: 700 });
      if (secret) label(g, cx, BASE + 42, bin(n), { size: 15, w: 600 }).setAttribute('style', MONO);
    }
    if (secret) {
      const x = nimSum(piles);
      el('line', { x1: 30, x2: 350, y1: BASE + 54, y2: BASE + 54, stroke: LINE, 'stroke-width': 1.5 }, g);
      label(g, 190, BASE + 71, 'Nim-sum: the columns added without carrying', { size: 12, cls: 'soft' });
      label(g, 190, BASE + 92, bin(x) + ' = ' + x, { size: 18, w: 700 }).setAttribute('style', MONO);
    }
    label(g, 190, 286, last, { size: 12, cls: 'soft' });
    const x = nimSum(piles);
    turnR.textContent = { you: 'Yours', cpu: 'Computer’s', youwin: 'You win', cpuwin: 'Computer wins' }[turn];
    sumStat.style.display = secret ? '' : 'none';
    sumR.textContent = String(x);
    const h = document.createElement('small');
    h.textContent = x ? ' not 0: there is a winning move' : ' 0: whoever moves now is losing';
    sumR.appendChild(h);
    if (hadFocus) {
      const tops = [...g.querySelectorAll('[role=button]')].filter(e => e.dataset.stone === String(piles[+e.dataset.pile]));
      const t = tops.find(e => +e.dataset.pile === lastPile) || tops[0];
      if (t) t.focus({ preventScroll: true });
    }
  }

  box.appendChild(Object.assign(document.createElement('span'), { textContent: 'Who starts', className: 'soft' }));
  picker(box, ['You', 'Computer'], 0, k => { start = k; newGame(first); });
  button(box, 'New game', () => {
    let p; do p = [0, 0, 0].map(() => 1 + Math.floor(Math.random() * 7)); while (!p.some(v => v));
    newGame(p);
  }, 'go');
  button(box, 'Classic 3-4-5', () => newGame([3, 4, 5]));
  const sec = button(box, 'Show the secret', () => { secret = !secret; sec.setAttribute('aria-pressed', secret); draw(); });
  sec.setAttribute('aria-pressed', 'false');
  newGame([3, 4, 5]);
}
