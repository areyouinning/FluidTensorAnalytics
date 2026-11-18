/* Braess's paradox in springs and string (Cohen & Horowitz, Nature 1991). A weight hangs from two identical springs
   in series, joined by a short string. Two longer safety strings hang slack: one from the ceiling to the lower
   spring's top, one from the upper spring's bottom to the weight. Cut the short string and the load is shared by
   two parallel paths, each a spring plus a long string; each spring now carries half the weight, and the weight RISES.
   Numbers (cm): spring rest length 10, stretch 10 per full weight, short string 2, safety strings 24.
     series:   10+10 + 2 + 10+10 = 42 below the ceiling.
     parallel: 10+5 + 24 = 39. The weight rises 3 cm. */
import { svg, el, clear, label, controls, button, readouts, calm } from './kit.js';

const BLUE = 'var(--blue)', ORANGE = 'var(--orange)', GREEN = 'var(--green)', INK = 'var(--ink)', SOFT = 'var(--ink-soft)', PANEL = 'var(--panel)';
const L0 = 10, X = 10, LS = 2, LL = 24, PX = 6.2, TOP = 22, W = 380, H = 372;
const SER = { j1: L0 + X, j2: L0 + X + LS, w: 2 * (L0 + X) + LS }, PAR = { j1: L0 + X / 2, j2: LL, w: L0 + X / 2 + LL };

export default function (fig) {
  const s = svg(fig, W, H, 'A weight hanging from two springs joined by a short string, with two slack safety strings. Cutting the short string makes the weight rise.');
  const g = el('g', {}, s), box = controls(fig);
  const [stateR, springR, heightR] = readouts(fig, ['Arrangement', 'Each spring carries', 'Weight below ceiling']);
  let t = 0, cut = false, raf = 0;
  const Y = cm => TOP + cm * PX;
  function spring(x, ya, yb, col) {
    const n = 12, lead = 5, d = [`M${x} ${ya}`, `L${x} ${ya + lead}`];
    for (let i = 1; i <= n; i++) d.push(`L${x + (i % 2 ? 9 : -9)} ${ya + lead + (yb - ya - 2 * lead) * (i - .5) / n}`);
    d.push(`L${x} ${yb - lead}`, `L${x} ${yb}`);
    el('path', { d: d.join(''), fill: 'none', stroke: col, 'stroke-width': 2.4, 'stroke-linejoin': 'round' }, g);
  }
  function string(x, ya, yb, len, col, dir) {    // straight if taut, bowed sideways if slack
    const dist = (yb - ya) / PX, slack = Math.max(0, len - dist), bow = Math.sqrt(Math.max(0, (len / 2) ** 2 - (dist / 2) ** 2)) * PX * .9;
    el('path', { d: slack > .05 ? `M${x} ${ya}Q${x + dir * bow * 1.6} ${(ya + yb) / 2} ${x} ${yb}` : `M${x} ${ya}L${x} ${yb}`, fill: 'none', stroke: col, 'stroke-width': 2 }, g);
  }
  function draw() {
    clear(g);
    const e = t < .5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t), lerp = (a, b) => a + (b - a) * e;
    const j1 = Y(lerp(SER.j1, PAR.j1)), j2 = Y(lerp(SER.j2, PAR.j2)), wy = Y(lerp(SER.w, PAR.w));
    // ceiling
    el('rect', { x: 120, y: TOP - 10, width: 150, height: 10, fill: SOFT, opacity: .5 }, g);
    for (let x = 124; x < 270; x += 12) el('line', { x1: x, y1: TOP - 10, x2: x + 8, y2: TOP - 18, stroke: SOFT }, g);
    // reference line: where the weight hung before the cut
    el('line', { x1: 40, x2: W - 40, y1: Y(SER.w), y2: Y(SER.w), stroke: SOFT, 'stroke-dasharray': '5 4' }, g);
    label(g, 44, Y(SER.w) - 5, 'before the cut', { size: 11, a: 'start', cls: 'soft' });
    // springs
    spring(176, TOP, j1, BLUE); spring(214, j2, wy, BLUE);
    // safety strings: ceiling → lower spring's top bar; upper spring's bottom bar → weight
    string(240, TOP, j2, LL, ORANGE, 1); string(150, j1, wy, LL, ORANGE, -1);
    // the short middle string
    if (t === 0 && !cut) el('line', { x1: 195, y1: j1, x2: 195, y2: j2, stroke: GREEN, 'stroke-width': 3 }, g);
    else { el('line', { x1: 195, y1: j1, x2: 195, y2: j1 + 4, stroke: GREEN, 'stroke-width': 3 }, g); el('line', { x1: 195, y1: j2 - 4, x2: 195, y2: j2, stroke: GREEN, 'stroke-width': 3 }, g); }
    // the two bars
    el('rect', { x: 146, y: j1 - 3, width: 54, height: 6, rx: 3, fill: INK }, g);
    el('rect', { x: 190, y: j2 - 3, width: 54, height: 6, rx: 3, fill: INK }, g);
    // weight
    el('rect', { x: 140, y: wy, width: 110, height: 34, rx: 5, fill: 'color-mix(in srgb, var(--ink) 75%, transparent)' }, g);
    label(g, 195, wy + 22, 'weight', { size: 13, w: 700, fill: PANEL });
    if (t >= 1) { el('path', { d: `M300 ${Y(SER.w)}L300 ${wy + 2}`, stroke: GREEN, 'stroke-width': 2.5 }, g); el('path', { d: `M294 ${wy + 10}L300 ${wy + 2}L306 ${wy + 10}`, fill: 'none', stroke: GREEN, 'stroke-width': 2.5 }, g); label(g, 308, (Y(SER.w) + wy) / 2 + 4, 'up 3 cm', { size: 12, a: 'start', fill: GREEN, w: 700 }); }
    // legend
    label(g, 20, H - 30, 'blue: springs · orange: safety strings · green: short string', { size: 11, a: 'start', cls: 'soft' });
    label(g, 20, H - 12, 'spring 10 cm, +10 cm per full weight · strings 2 cm and 24 cm', { size: 11, a: 'start', cls: 'soft' });
    stateR.textContent = t >= 1 ? 'two parallel paths' : t > 0 ? 'cutting…' : 'springs in series';
    springR.textContent = t >= 1 ? 'half the weight' : 'the whole weight';
    heightR.textContent = (t >= 1 ? PAR.w : t > 0 ? lerp(SER.w, PAR.w) : SER.w).toFixed(1) + ' cm';
  }
  const btn = button(box, 'Cut the short string', () => {
    cancelAnimationFrame(raf);
    if (cut) { cut = false; t = 0; btn.textContent = 'Cut the short string'; draw(); return; }
    cut = true; btn.textContent = 'Tie it back';
    if (calm()) { t = 1; draw(); return; }
    const t0 = performance.now(), f = now => { t = Math.min(1, (now - t0) / 1400); draw(); if (t < 1) raf = requestAnimationFrame(f); };
    raf = requestAnimationFrame(f);
  }, 'go');
  draw();
}
