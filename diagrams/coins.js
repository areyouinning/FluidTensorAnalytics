/* Twelve coins and a balance. One coin is fake, heavier or lighter than the rest: 24 possible truths
   (coin 1..12, heavy or light). Tap a coin to move it between off the scale, left pan and right pan.
   After each weighing the page recomputes, exactly, which of the 24 truths agree with every result so far.
   A truth is numbered p = 2*coin + (0 heavy | 1 light). */
import { svg, el, clear, label, controls, button, readouts } from './kit.js';

const BLUE = 'var(--blue)', ORANGE = 'var(--orange)', SOFT = 'var(--ink-soft)', LINE = 'var(--line)', SUNK = 'var(--sunk)', PANEL = 'var(--panel)';
const N = 12, MAX = 3;
const OUT = { 1: 'left side heavier', '-1': 'right side heavier', 0: 'balanced' };

/* what the balance shows for truth p: 1 left heavier, -1 right heavier, 0 balanced */
export function outcome(p, left, right) {
  const c = p >> 1, w = p & 1 ? -1 : 1;
  return left.includes(c) ? w : right.includes(c) ? -w : 0;
}
/* the truths in `alive` that agree with this result */
export function consistent(alive, left, right, out) {
  return alive.filter(p => outcome(p, left, right) === out);
}
export const allTruths = () => Array.from({ length: 2 * N }, (_, p) => p);

export default function (fig) {
  const s = svg(fig, 380, 284, 'A balance with two pans above a tray of twelve numbered coins. Each coin shows whether it could still be heavy, light or either.');
  const g = el('g', {}, s);
  const box = controls(fig);
  const [usedR, possR, resR] = readouts(fig, ['Weighings used', 'Still possible', 'Result']);
  const hist = document.createElement('ol'); hist.className = 'cn-hist';
  fig.insertBefore(hist, fig.querySelector('figcaption'));
  let slot, truth, alive, log, over, tilt, last, weighBtn;

  const side = k => slot.map((v, i) => v === k ? i : -1).filter(i => i >= 0);
  const setText = (node, big, small) => { node.textContent = big; if (small) { const m = document.createElement('small'); m.textContent = small; node.appendChild(m); } };

  function fresh() {
    slot = Array(N).fill(0); truth = Math.floor(Math.random() * 2 * N); alive = allTruths();
    log = []; over = false; tilt = 0; last = 'Nothing weighed yet';
    draw();
  }

  function mark(c) {
    const h = alive.includes(2 * c), l = alive.includes(2 * c + 1);
    return h && l ? 'H/L' : h ? 'H' : l ? 'L' : '';
  }

  function draw() {
    clear(g);
    const L = side(1), R = side(2);
    const dy = tilt * 14, yl = 30 + dy, yr = 30 - dy, XL = 75, XR = 305;
    // stand
    el('path', { d: 'M190 30 L190 134 M160 134 L220 134', stroke: LINE, 'stroke-width': 4, 'stroke-linecap': 'round', fill: 'none' }, g);
    el('line', { x1: XL, y1: yl, x2: XR, y2: yr, stroke: SOFT, 'stroke-width': 4, 'stroke-linecap': 'round' }, g);
    el('circle', { cx: 190, cy: 30, r: 6, fill: SOFT }, g);
    [[XL, yl, L, BLUE, 'Left'], [XR, yr, R, ORANGE, 'Right']].forEach(([x, y, set, hue, name]) => {
      const py = y + 78;
      el('path', { d: `M${x} ${y} L${x - 55} ${py} M${x} ${y} L${x + 55} ${py}`, stroke: LINE, 'stroke-width': 1.5, fill: 'none' }, g);
      el('rect', { x: x - 58, y: py, width: 116, height: 6, rx: 3, fill: hue }, g);
      set.forEach((c, k) => {
        const cx = x - 37.5 + (k % 4) * 25, cy = py - 13 - Math.floor(k / 4) * 25;
        el('circle', { cx, cy, r: 11, fill: `color-mix(in srgb, ${hue} 28%, var(--panel))`, stroke: hue, 'stroke-width': 1.5 }, g);
        label(g, cx, cy + 4.5, c + 1, { size: 13, w: 700 });
      });
      label(g, x, py + 22, name + (set.length ? ' · ' + set.length : ''), { size: 12, cls: 'soft' });
    });
    // tray
    for (let c = 0; c < N; c++) {
      const cx = 36 + (c % 6) * 61.6, cy = 184 + Math.floor(c / 6) * 56, v = slot[c], m = mark(c);
      const hue = v === 1 ? BLUE : v === 2 ? ORANGE : null;
      const cell = el('g', { role: 'button', tabindex: '0', 'aria-label': `Coin ${c + 1}: ${['off the scale', 'left pan', 'right pan'][v]}. ${m === 'H/L' ? 'Could be heavy or light' : m === 'H' ? 'Could only be heavy' : m === 'L' ? 'Could only be light' : 'Known genuine'}`, style: 'cursor:pointer' }, g);
      el('rect', { x: cx - 29, y: cy - 24, width: 58, height: 54, fill: 'transparent' }, cell);
      const inner = el('g', { opacity: m ? 1 : .4 }, cell);
      el('circle', { cx, cy, r: 18, fill: hue ? `color-mix(in srgb, ${hue} 28%, var(--panel))` : SUNK, stroke: hue || LINE, 'stroke-width': hue ? 2.5 : 1.5, 'stroke-dasharray': v ? '' : '4 3' }, inner);
      label(inner, cx, cy + 5.5, c + 1, { size: 16, w: 700 });
      label(inner, cx, cy + 34, m || 'ok', { size: 12.5, w: m ? 700 : 400, cls: m ? '' : 'soft' });
      const cyc = () => { if (over) return; slot[c] = (slot[c] + 1) % 3; tilt = 0; draw(); const again = g.querySelectorAll('[role=button]')[c]; if (again) again.focus({ preventScroll: true }); };
      cell.addEventListener('click', cyc);
      cell.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cyc(); } });
    }
    // readouts
    setText(usedR, String(log.length), ' of ' + MAX);
    setText(possR, String(alive.length), ' of 24');
    resR.textContent = last;
    resR.style.fontSize = '16px';
    weighBtn.disabled = over || log.length >= MAX || L.length === 0 || L.length !== R.length;
    hist.innerHTML = log.map(e => `<li>${e.l.map(x => x + 1).join(' ')} | ${e.r.map(x => x + 1).join(' ')} — ${OUT[e.out]}</li>`).join('');
  }

  function weigh() {
    const L = side(1), R = side(2);
    if (weighBtn.disabled) return;
    const out = outcome(truth, L, R);
    alive = consistent(alive, L, R, out);
    log.push({ l: L, r: R, out });
    slot = Array(N).fill(0);
    tilt = out;
    last = `Weighing ${log.length}: ${OUT[out]}`;
    const tc = truth >> 1, tw = truth & 1 ? 'light' : 'heavy', n = log.length;
    if (alive.length === 1) {
      const c = alive[0] >> 1;
      last = `Coin ${c + 1} is ${alive[0] & 1 ? 'light' : 'heavy'}. Found in ${n} weighing${n === 1 ? '' : 's'}.`;
      over = true;
    } else if (n >= MAX) {
      last = `${alive.length} still possible after 3 weighings. It was coin ${tc + 1}, ${tw}.`;
      over = true;
    }
    draw();
  }

  weighBtn = button(box, 'Weigh', weigh, 'go');
  button(box, 'Clear pans', () => { slot = Array(N).fill(0); tilt = 0; draw(); });
  button(box, 'New coins', fresh);
  fresh();
}
