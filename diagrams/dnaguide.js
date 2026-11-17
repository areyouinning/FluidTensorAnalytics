/* A friendly cartoon double-helix walks through the gene-editing idea, step by step — in the cheerful
   spirit of an old theme-park explainer film, but an original character. Tap Next to advance.
   Colors match the puzzle: half A is blue, half B is orange. */
import { svg, el, clear, controls, button, C, calm } from './kit.js';

const BLUE = 'var(--blue)', ORANGE = 'var(--orange)', GREEN = 'var(--green)', RED = 'var(--red)', INK = 'var(--ink)', SOFT = 'var(--ink-soft)', PANEL = 'var(--panel)', SUNK = 'var(--sunk)';
const LETTER = { A: BLUE, C: GREEN, G: ORANGE, T: 'var(--purple)' };

const STEPS = [
  { say: 'Your genes are a book, written in four letters.', draw: drawBook },
  { say: 'Sometimes one letter is a typo — copied for a lifetime.', draw: drawTypo },
  { say: 'A gene editor carries a guide that matches the exact spot.', draw: drawGuide },
  { say: 'Old tools just cut there. The new one rewrites one letter.', draw: drawRewrite },
  { say: 'But the rewriter is too big for one delivery — so it rides in two.', draw: drawSplit },
];

export default function (fig) {
  const W = 380, H = 210, s = svg(fig, W, H, 'A cartoon double helix explaining gene editing, one step at a time.');
  const stage = el('g', {}, s), buddy = el('g', {}, s), say = el('text', { x: 250, y: 24, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600 }, s);
  const box = controls(fig);
  let step = 0, t0 = performance.now(), raf = 0, seen = true;

  function render() {
    clear(stage); say.textContent = '';
    STEPS[step].draw(stage, 1);                  // final frame first, so static/calm shows the finished panel
    // wrap the caption over two lines if needed
    const words = STEPS[step].say.split(' '); let line = '', lines = [];
    words.forEach(w => { if ((line + ' ' + w).length > 34) { lines.push(line); line = w; } else line = line ? line + ' ' + w : w; });
    lines.push(line); say.textContent = '';
    clear(say); lines.forEach((ln, i) => el('tspan', { x: 250, dy: i ? 16 : 0 }, say, ln));
    dots.forEach((d, i) => d.setAttribute('fill', i === step ? INK : SOFT));
    prev.disabled = step === 0; next.textContent = step === STEPS.length - 1 ? '↻ Again' : 'Next →';
    t0 = performance.now(); if (!calm()) kick();
  }
  function frame(now) {
    raf = 0; if (!seen) return;
    const t = Math.min(1, (now - t0) / 500);     // a short entrance tween
    const bob = Math.sin(now / 600) * 3;
    clear(buddy); drawBuddy(buddy, bob, 1 - Math.cos(now / 900) * .5);
    clear(stage); STEPS[step].draw(stage, calm() ? 1 : ease(t));
    if (t < 1 || !calm()) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  const ease = x => 1 - Math.pow(1 - x, 3);

  const prev = button(box, '← Back', () => { if (step > 0) { step--; render(); } });
  const next = button(box, 'Next →', () => { step = (step + 1) % STEPS.length; render(); }, 'go');
  const dotWrap = el('g', {}, s); const dots = STEPS.map((_, i) => el('circle', { cx: 150 + i * 16, cy: 198, r: 4, fill: SOFT }, dotWrap));

  new IntersectionObserver(es => { seen = es[0].isIntersecting; if (seen && !calm()) kick(); }).observe(s);
  drawBuddy(buddy, 0, .5); render();
}

/* ---- the mascot: a smiling double helix on the left, one arm pointing at the stage ---- */
function helixPath(x, cy, h, ph) { let d = ''; for (let i = 0; i <= 20; i++) { const y = cy - h / 2 + (h * i / 20), a = ph + i / 20 * Math.PI * 2.2; d += (i ? 'L' : 'M') + (x + Math.sin(a) * 13).toFixed(1) + ' ' + y.toFixed(1); } return d; }
function drawBuddy(g, bob, wave) {
  const x = 46, cy = 120 + bob;
  for (let i = 0; i <= 20; i++) { const y = cy - 45 + 90 * i / 20, a = i / 20 * Math.PI * 2.2, x1 = x + Math.sin(a) * 13, x2 = x + Math.sin(a + Math.PI) * 13; if (i % 2 === 0) el('line', { x1, y1: y, x2, y2: y, stroke: SOFT, 'stroke-width': 2 }, g); }
  el('path', { d: helixPath(x, cy, 90, 0), stroke: BLUE, 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'round' }, g);
  el('path', { d: helixPath(x, cy, 90, Math.PI), stroke: ORANGE, 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'round' }, g);
  const hx = x, hy = cy - 64;                    // head
  el('circle', { cx: hx, cy: hy, r: 17, fill: PANEL, stroke: INK, 'stroke-width': 2.5 }, g);
  el('circle', { cx: hx - 6, cy: hy - 2, r: 2.4, fill: INK }, g); el('circle', { cx: hx + 6, cy: hy - 2, r: 2.4, fill: INK }, g);
  el('path', { d: `M${hx - 7} ${hy + 5}Q${hx} ${hy + 11} ${hx + 7} ${hy + 5}`, stroke: INK, 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round' }, g);
  const ay = cy - 24, tipx = 92 + wave * 6;      // the pointing arm
  el('path', { d: `M${x + 11} ${ay}Q${(x + 11 + tipx) / 2} ${ay - 14} ${tipx} ${ay - 2}`, stroke: INK, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }, g);
  el('circle', { cx: tipx, cy: ay - 2, r: 3.5, fill: INK }, g);
}

/* ---- the stage panels (x ~110..372) ---- */
const SEQ = ['A', 'C', 'G', 'T', 'A', 'C', 'G'];
function tile(g, x, y, ch, col, boxed) {
  el('rect', { x, y, width: 24, height: 28, rx: 5, fill: boxed || PANEL, stroke: INK, 'stroke-width': boxed ? 3 : 1.5 }, g);
  el('text', { x: x + 12, y: y + 20, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700, style: `fill:${col}` }, g, ch);
}
function strand(g, y, t, hi) { const x0 = 118; SEQ.forEach((ch, i) => { if (i / SEQ.length > t) return; tile(g, x0 + i * 32, y, ch, LETTER[ch], hi === i ? 'color-mix(in srgb, var(--red) 18%, var(--panel))' : null); }); return x0; }

function drawBook(g, t) { strand(g, 70, t); el('text', { x: 250, y: 130, 'text-anchor': 'middle', 'font-size': 13, class: 'soft' }, g, 'A · C · G · T'); }
function drawTypo(g, t) {
  const bad = 3; strand(g, 70, 1, bad);
  // the bad letter reads A but should be G
  if (t > .4) { el('text', { x: 118 + bad * 32 + 12, y: 56, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 700, style: `fill:${RED}` }, g, '!'); }
  el('text', { x: 250, y: 132, 'text-anchor': 'middle', 'font-size': 12, class: 'soft' }, g, 'one wrong letter, copied forever');
}
function drawGuide(g, t) {
  const bad = 3, x0 = strand(g, 58, 1, bad);
  const gx = x0 + bad * 32 - 44 + 44 * t;        // a guide strip slides up to the spot
  el('rect', { x: gx, y: 96, width: 110, height: 22, rx: 6, fill: 'color-mix(in srgb, var(--purple) 22%, var(--panel))', stroke: 'var(--purple)', 'stroke-width': 2 }, g);
  el('text', { x: gx + 55, y: 111, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 600, style: 'fill:var(--purple)' }, g, 'guide');
  if (t > .9) el('line', { x1: x0 + bad * 32 + 12, y1: 86, x2: gx + 55, y2: 96, stroke: 'var(--purple)', 'stroke-dasharray': '3 3', 'stroke-width': 1.5 }, g);
}
function drawRewrite(g, t) {
  // left: scissors cut (a gap). right: a pencil flips A -> G.
  el('text', { x: 165, y: 44, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 600, class: 'soft' }, g, 'cut');
  [0, 1, 3, 4].forEach((i, k) => tile(g, 120 + k * 26 + (i > 2 ? 14 : 0), 56, SEQ[i], LETTER[SEQ[i]]));
  el('path', { d: 'M196 54l10 34M206 54l-10 34', stroke: INK, 'stroke-width': 2, 'stroke-linecap': 'round' }, g);
  el('circle', { cx: 196, cy: 92, r: 4, fill: 'none', stroke: INK, 'stroke-width': 2 }, g); el('circle', { cx: 206, cy: 92, r: 4, fill: 'none', stroke: INK, 'stroke-width': 2 }, g);
  el('text', { x: 300, y: 44, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 600, style: `fill:${GREEN}` }, g, 'rewrite');
  const ch = t > .5 ? 'G' : 'A', col = t > .5 ? GREEN : RED;
  tile(g, 288, 56, ch, col, t > .5 ? 'color-mix(in srgb, var(--green) 18%, var(--panel))' : null);
  el('path', { d: `M330 ${104 - t * 10}l14-14 4 4-14 14z`, fill: 'var(--gold)', stroke: INK, 'stroke-width': 1.5 }, g);  // pencil
  if (t > .7) el('path', { d: 'M286 96l5 5 9-11', stroke: GREEN, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
}
function drawSplit(g, t) {
  el('rect', { x: 150, y: 44, width: 60, height: 34, rx: 8, fill: SUNK, stroke: INK, 'stroke-width': 2 }, g);
  el('text', { x: 180, y: 66, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 600, class: 'soft' }, g, 'editor');
  el('text', { x: 180, y: 94, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 700, class: 'soft' }, g, '✂ too big');
  // two little trucks split off toward a cell on the right
  truck(g, 236 + t * 10, 120 - t * 44, BLUE, 'A');
  truck(g, 236 + t * 30, 150 - t * 44, ORANGE, 'B');
  el('circle', { cx: 344, cy: 92, r: 22, fill: 'color-mix(in srgb, var(--green) 14%, var(--panel))', stroke: GREEN, 'stroke-width': 2 }, g);
  el('text', { x: 344, y: 96, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 600, style: `fill:${GREEN}` }, g, 'cell');
}
function truck(g, x, y, col, lab) {
  el('rect', { x, y, width: 34, height: 18, rx: 4, fill: col, stroke: INK, 'stroke-width': 1.5 }, g);
  el('text', { x: x + 17, y: y + 13, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700, fill: '#fff' }, g, lab);
  el('circle', { cx: x + 8, cy: y + 20, r: 3.2, fill: INK }, g); el('circle', { cx: x + 26, cy: y + 20, r: 3.2, fill: INK }, g);
}
