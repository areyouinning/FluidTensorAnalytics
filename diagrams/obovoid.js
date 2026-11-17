/* The inspirations, as a sky of obovoid balloons — part lightbulb (the idea), part hot-air balloon
   (the lift). Each floats and bobs; tap one to read how it inspires the site. The roster is a plain
   array, laid out on a grid that grows with it, and the whole thing stills under reduced-motion. */
import { svg, el, label, put, calm } from './kit.js';

const GOLD = 'var(--gold)', INK = 'var(--ink)', BLUE = 'var(--blue)', ORANGE = 'var(--orange)', GREEN = 'var(--green)', PURPLE = 'var(--purple)';
// broad at the top (the bulb / canopy), tapering to a small base (the screw / basket)
const BODY = 'M0 -52 C30 -52 34 -20 30 -2 C27 16 20 34 10 44 C4 50 -4 50 -10 44 C-20 34 -27 16 -30 -2 C-34 -20 -30 -52 0 -52 Z';

const PEOPLE = [
  { name: 'Nick Berry', label: 'Berry', who: 'DataGenetics', hue: ORANGE,
    how: 'DataGenetics worked puzzles the way this whole site wants to: take something that sounds like a trick question, then follow the arithmetic patiently — with pictures — until the magic turns into something you understand. The pages here tagged “remix” are direct descendants, and the habit behind all of them — delight first, rigor all the way down — is Nick’s.' },
  { name: 'Larry Silverberg', label: 'Silverberg', who: 'dynamics', hue: BLUE,
    how: 'Ran a million basketball trajectories to show the bank shot really is better from the wings, and taught parametric resonance with a playground swing. He sold exotic birds before he taught mechanical engineering, and he took in a stray aerospace Park Scholar; every tool here that says “draw it, then make it answer to numbers” is his.' },
  { name: 'Chau Tran', label: 'Tran', who: 'computation', hue: GREEN,
    how: 'Larry’s partner in the basketball study — the one who made a million three-dimensional trajectories actually run, and settle onto a single answer with a shape. The habit of turning a playground opinion into a computation you can check was learned beside him.' },
  { name: 'Fuh-Gwo Yuan', label: 'Yuan', who: 'smart structures', hue: PURPLE,
    how: 'Pointed a senior-design team at the hardest thing a bird does casually — landing on a branch — with a wing that changes shape using piezo fibers and muscle wire instead of hinges. A professor who could not stop being interested, which turns out to be the whole trick.' },
  { name: 'John Crimaldi', label: 'Crimaldi', who: 'environmental fluids', hue: BLUE,
    how: 'Asked why a thumb over a hose speeds up the jet (friction, reclaimed), and how broadcast-spawning coral beats the odds (turbulence folds two clouds together, so the mean of the product beats the product of the means). From him: a good riddle and a careful experiment are the same move.' },
  { name: 'Roseanna Neupauer', label: 'Neupauer', who: 'inverse problems', hue: ORANGE,
    how: 'Runs the plume backward — the same transport equation, solved from the sensor backward in time, names which neighborhood a signal came from, every suspect at once. From her: an unknown is just a forward problem read the other way, and a monitor that sees nothing is evidence too.' },
  { name: 'Balaji', label: 'Balaji', who: 'statistics & water', hue: GREEN,
    how: 'Taught the hypergeometric distribution with a pond — tag some fish, catch again, and let the notebook be the model. He was also the generous critic who read work outside his own wheelhouse and asked the questions that actually mattered.' },
  { name: 'Hari', label: 'Hari', who: 'fluid mechanics', hue: PURPLE,
    how: 'Draws a cube on the board, and everything — Navier–Stokes included — comes out of that control volume, one careful step at a time. The site’s instinct to build every result from something you can see on a chalkboard is his.' }
];

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default function (fig) {
  const W = 380, N = PEOPLE.length, COLS = Math.min(4, N), ROWS = Math.ceil(N / COLS);
  const topY = 66, rowH = 150, cellW = W / COLS, stag = [0, 16, 7, 20];
  const H = topY + (ROWS - 1) * rowH + 104;
  const pos = PEOPLE.map((_, i) => {
    const row = Math.floor(i / COLS), col = i - row * COLS;
    const inRow = row < ROWS - 1 ? COLS : N - row * COLS, off = (COLS - inRow) * cellW / 2;
    return { x: off + (col + 0.5) * cellW, y: topY + row * rowH + stag[col % 4] };
  });

  const s = svg(fig, W, H, 'A sky of balloons, one for each inspiration; choose one to read how it inspires the site.');
  const sky = el('g', {}, s);
  const panel = document.createElement('div'); panel.className = 'obv-panel'; panel.setAttribute('aria-live', 'polite'); put(fig, panel);

  let sel = -1, raf = 0, seen = true;
  const balloons = PEOPLE.map((p, i) => {
    const g = el('g', { class: 'obv-balloon', role: 'button', tabindex: '0', 'aria-label': p.name + ' — how they inspire' }, sky);
    drawBalloon(g, p);
    const choose = () => select(i);
    g.addEventListener('click', choose);
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
    return { g, x: pos[i].x, y: pos[i].y, phase: i * 1.3 };
  });

  function drawBalloon(g, p) {
    el('ellipse', { class: 'glow', cx: 0, cy: -14, rx: 20, ry: 26, fill: GOLD, opacity: 0.16 }, g);
    el('path', { class: 'body', d: BODY, fill: 'color-mix(in srgb, ' + p.hue + ' 26%, var(--panel))', stroke: p.hue, 'stroke-width': 1.8, 'stroke-linejoin': 'round' }, g);
    el('path', { d: 'M0 -52 C10 -20 8 20 4 42', fill: 'none', stroke: p.hue, 'stroke-width': 1, opacity: 0.5 }, g);
    el('path', { d: 'M0 -52 C-10 -20 -8 20 -4 42', fill: 'none', stroke: p.hue, 'stroke-width': 1, opacity: 0.5 }, g);
    el('path', { d: 'M-6 -16 L-2 -6 L2 -16 L6 -6', fill: 'none', stroke: GOLD, 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    el('line', { x1: -9, y1: 43, x2: -5, y2: 50, stroke: INK, 'stroke-width': 1 }, g);
    el('line', { x1: 9, y1: 43, x2: 5, y2: 50, stroke: INK, 'stroke-width': 1 }, g);
    el('path', { d: 'M-6 50 H6 L4 57 H-4 Z', fill: INK }, g);
    label(g, 0, 72, p.label, { size: 12, w: 700 });
  }

  function select(i) {
    sel = i;
    balloons.forEach((b, j) => { const on = j === i;
      b.g.querySelector('.glow').setAttribute('opacity', on ? 0.5 : 0.16);
      b.g.querySelector('.body').setAttribute('stroke-width', on ? 3 : 1.8);
      b.g.setAttribute('aria-pressed', on);
    });
    const p = PEOPLE[i];
    panel.innerHTML = '<h3>' + esc(p.name) + ' <span>' + esc(p.who) + '</span></h3><p>' + esc(p.how) + '</p>';
    layout(performance.now());
  }
  function layout(now) {
    balloons.forEach((b, i) => {
      const bob = calm() ? 0 : Math.sin(now / 1000 + b.phase) * 5, sway = calm() ? 0 : Math.sin(now / 1700 + b.phase) * 2, sc = i === sel ? 1.05 : 1;
      b.g.setAttribute('transform', 'translate(' + (b.x + sway).toFixed(1) + ',' + (b.y + bob).toFixed(1) + ') scale(' + sc + ')');
    });
  }
  function frame(now) { raf = 0; if (!seen) return; layout(now); if (!calm()) raf = requestAnimationFrame(frame); }
  function kick() { if (!raf && !calm()) raf = requestAnimationFrame(frame); }
  new IntersectionObserver(es => { seen = es[0].isIntersecting; if (seen) kick(); }).observe(s);

  select(0);
}
