/* The missing-dollar riddle, followed to the last cent. Three guests pay $30, get $3 back, the bellhop
   keeps $2. "They paid $27, plus the bellhop's $2, is $29 — where's the last dollar?" The trick is the
   plus: the $27 the guests paid already HOLDS the bellhop's $2 ($25 room + $2 tip). You never add it
   again; you add the $3 refund. Step through the money and the $30 is always right there. */
import { svg, el, clear, label, controls, button, calm } from './kit.js';

const BLUE = 'var(--blue)', GREEN = 'var(--green)', ORANGE = 'var(--orange)', GOLD = 'var(--gold)', INK = 'var(--ink)', SOFT = 'var(--ink-soft)', PANEL = 'var(--panel)', RED = 'var(--red)';
const XS = [16, 138, 260], BW = 104, BY = 54, BH = 52, CY = BY + BH / 2;
const CX = XS.map(function (x) { return x + BW / 2; });
const NAME = ['Guests get back', 'Hotel keeps', 'Bellhop keeps'], COL = [BLUE, GREEN, ORANGE];

const STEPS = [
  { say: 'Three guests pay $30 for the room — $10 each.', amt: [0, 30, 0], hi: 1, flow: [0, 1, 30] },
  { say: 'The room was only $25. The clerk sends $5 back up with the bellhop.', amt: [0, 25, 5], hi: 2, flow: [1, 2, 5] },
  { say: '$5 won’t split three ways: each guest keeps $1, the bellhop keeps $2.', amt: [3, 25, 2], hi: 0, flow: [2, 0, 3] },
  { say: 'Each guest paid $9 — that’s $27 — plus the bellhop’s $2 makes $29. Where’s the last dollar?', amt: [3, 25, 2], hi: -1, trick: 1 },
  { say: 'Nowhere: the $27 already holds the bellhop’s $2 ($25 + $2). Add the $3 refund and you’re back to $30.', amt: [3, 25, 2], hi: -1, trick: 2 }
];

export default function (fig) {
  const W = 380, H = 214;
  const s = svg(fig, W, H, 'Three accounts — guests, hotel, bellhop — with the $30 followed from hand to hand, ending in the missing-dollar trick and its resolution.');
  const stage = el('g', {}, s), say = el('text', { x: 190, y: 16, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600 }, s);
  const box = controls(fig);
  let step = 0, t0 = performance.now(), raf = 0, seen = true;
  const ease = function (x) { return 1 - Math.pow(1 - x, 3); };

  function accounts(g, st) {
    XS.forEach(function (x, i) {
      const hi = st.hi === i;
      el('rect', { x: x, y: BY, width: BW, height: BH, rx: 8, fill: PANEL, stroke: COL[i], 'stroke-width': hi ? 3 : 1.5 }, g);
      label(g, CX[i], BY + 17, NAME[i], { size: 11, cls: 'soft' });
      label(g, CX[i], BY + 41, '$' + st.amt[i], { size: 23, w: 700, fill: COL[i] });
    });
  }
  function ledger(g, st) {
    label(g, 190, 128, 'Where the $30 is', { size: 11, cls: 'soft' });
    const t = el('text', { x: 190, y: 152, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 700 }, g);
    const span = function (str, fill) { el('tspan', { style: 'fill:' + fill }, t, str); };
    span('$' + st.amt[1], GREEN); span('  +  ', SOFT); span('$' + st.amt[2], ORANGE);
    span('  +  ', SOFT); span('$' + st.amt[0], BLUE); span('  =  $30', INK);
  }
  function token(g, st, t) {
    if (!st.flow || t >= 1) return;
    const f = st.flow[0], to = st.flow[1], amt = st.flow[2], x = CX[f] + (CX[to] - CX[f]) * t;
    el('rect', { x: x - 21, y: CY - 13, width: 42, height: 26, rx: 13, fill: GOLD, stroke: INK, 'stroke-width': 1.5 }, g);
    label(g, x, CY + 5, '$' + amt, { size: 14, w: 700, fill: INK });
  }
  function trick(g, st) {
    if (st.trick === 1) {
      label(g, 190, 150, '$27 + $2 = $29', { size: 20, w: 700, fill: RED });
      label(g, 190, 176, '…so where is the last $1?', { size: 13, cls: 'soft' });
      label(g, 190, 198, 'Follow the money above — every dollar is sitting right there.', { size: 11, cls: 'soft' });
      return;
    }
    // trick === 2: strike the bogus sum, show the two honest groupings
    label(g, 108, 182, '$27 + $2 = $29', { size: 15, w: 700, fill: RED });
    el('line', { x1: 62, y1: 178, x2: 154, y2: 178, stroke: RED, 'stroke-width': 2 }, g);
    label(g, 108, 201, 'double-counts the $2', { size: 11, cls: 'soft' });
    label(g, 284, 182, '$27 + $3 = $30', { size: 15, w: 700, fill: GREEN });
    label(g, 284, 201, 'what you paid, plus the refund', { size: 11, cls: 'soft' });
  }

  function scene(g, st, t) {
    clear(g);
    accounts(g, st);
    if (st.trick !== 1) ledger(g, st);   // hide the tidy ledger on the "where's the dollar?" beat
    if (st.trick) trick(g, st);
    token(g, st, t);
  }

  function render() {
    const st = STEPS[step];
    // wrap the narration over up to two lines
    clear(say); const words = st.say.split(' '); let line = '', lines = [];
    words.forEach(function (w) { if ((line + ' ' + w).length > 46) { lines.push(line); line = w; } else line = line ? line + ' ' + w : w; });
    lines.push(line); lines.forEach(function (ln, i) { el('tspan', { x: 190, dy: i ? 15 : 0 }, say, ln); });
    dots.forEach(function (d, i) { d.setAttribute('fill', i === step ? INK : 'var(--line)'); });
    prev.disabled = step === 0; next.textContent = step === STEPS.length - 1 ? '↻ Again' : 'Next →';
    t0 = performance.now(); if (calm()) scene(stage, st, 1); else kick();
  }
  function frame(now) {
    raf = 0; if (!seen) return;
    const t = Math.min(1, (now - t0) / 650);
    scene(stage, STEPS[step], ease(t));
    if (t < 1) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && !calm()) raf = requestAnimationFrame(frame); }

  const prev = button(box, '← Back', function () { if (step > 0) { step--; render(); } });
  const next = button(box, 'Next →', function () { step = (step + 1) % STEPS.length; render(); }, 'go');
  const dotWrap = el('g', {}, s);
  const dots = STEPS.map(function (_, i) { return el('circle', { cx: 150 + i * 16, cy: H - 6, r: 4, fill: 'var(--line)' }, dotWrap); });

  new IntersectionObserver(function (es) { seen = es[0].isIntersecting; if (seen) kick(); }).observe(s);
  render();
}
