/* The inspirations, as a sky of obovoid balloons — part lightbulb (the idea), part hot-air balloon
   (the lift). Each floats and bobs; tap one to read how it inspires the site. The roster is a plain
   array, laid out on banded grids (teachers, living writers, and those in the wind, who lean and drift further), and the whole thing stills under reduced-motion. */
import { svg, el, label, put, calm } from './kit.js';

const GOLD = 'var(--gold)', INK = 'var(--ink)', BLUE = 'var(--blue)', ORANGE = 'var(--orange)', GREEN = 'var(--green)', PURPLE = 'var(--purple)';
// broad at the top (the bulb / canopy), tapering to a small base (the screw / basket)
const BODY = 'M0 -52 C30 -52 34 -20 30 -2 C27 16 20 34 10 44 C4 50 -4 50 -10 44 C-20 34 -27 16 -30 -2 C-34 -20 -30 -52 0 -52 Z';

const GROUPS = [
  { title: 'At the chalkboard', windy: false, people: [
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
  { name: 'Rajagopalan Balaji', label: 'Balaji', who: 'hydroclimatology · CU Boulder', hue: GREEN,
    how: 'Taught the hypergeometric distribution with a pond — tag some fish, catch again, and let the notebook be the model. A hydroclimatologist who reads rivers and monsoons through statistics, he was also the generous critic who read work outside his own wheelhouse and asked the questions that actually mattered.' }
  ] },
  { title: 'Still writing', windy: false, people: [
  { name: 'Douglas Hofstadter', label: 'Hofstadter', who: 'b. 1945', hue: PURPLE,
    how: 'Wrote the book on strange loops: systems that end up talking about themselves. He made Gödel readable, and the two Way Of books on logic and on language models lean on him.' },
  { name: 'Giulio Tononi', label: 'Tononi', who: 'neuroscientist', hue: BLUE,
    how: 'Asks how much a system is more than the sum of its parts, and tries to put a number on it. Whatever the answer turns out to be, it is the right kind of question.' },
  { name: 'Antonio Damasio', label: 'Damasio', who: 'neuroscientist', hue: ORANGE,
    how: 'Argues that feeling comes before reasoning and steers it. The site’s rule of delight first, rigor after, is that idea applied to arithmetic.' }
  ] },
  { title: 'In the wind', windy: true, people: [
  { name: 'Nick Berry', label: 'Berry', who: 'DataGenetics · in memory', hue: ORANGE,
    how: 'DataGenetics worked puzzles the way this whole site wants to: take something that sounds like a trick question, then follow the arithmetic patiently — with pictures — until the magic turns into something you understand. The pages here tagged “remix” are direct descendants, and the habit behind all of them — delight first, rigor all the way down — is Nick’s.' },
  { name: 'Harihar Rajaram', label: 'Hari', who: 'd. 2024 · CU Boulder, Johns Hopkins', hue: PURPLE,
    how: 'Hari drew a cube on the board, and everything — Navier–Stokes included — came out of that control volume, one careful step at a time. He modeled water moving through rock, ice and soil, edited Water Resources Research, and is remembered by his students for intellect, humility and warmth. The site’s instinct to build every result from something you can see on a chalkboard is his. In memory.' },
  { name: 'Leonhard Euler', label: 'Euler', who: '1707–1783', hue: BLUE,
    how: 'Walked the seven bridges of Königsberg on paper and founded graph theory doing it; the bridges page here is his argument. From him: the right notation makes a hard thing look inevitable.' },
  { name: 'Joseph-Louis Lagrange', label: 'Lagrange', who: '1736–1813', hue: GREEN,
    how: 'Stop asking what pushes on a thing and ask what it is minimizing. The river networks that grow by shrinking one number, and the reservoir pages that trade one goal against another, are his question asked of water.' },
  { name: 'Ludwig Boltzmann', label: 'Boltzmann', who: '1844–1906', hue: ORANGE,
    how: 'Count the ways. Disorder is just the arrangement with the most ways to happen, which is why stirred dye never unstirs. Every mixing page on the site is that sentence with a picture.' },
  { name: 'Henri Poincaré', label: 'Poincaré', who: '1854–1912', hue: PURPLE,
    how: 'Found that three bodies under simple laws can wander unpredictably, which is why a forecast gets run a hundred times. He also said we prove by logic but discover by intuition, and the diagrams here take him at his word.' },
  { name: 'Emmy Noether', label: 'Noether', who: '1882–1935', hue: BLUE,
    how: 'Proved that every conservation law is a symmetry in disguise. The habit of asking what stays the same when you change the units, the scale or the point of view comes from her.' },
  { name: 'Srinivasa Ramanujan', label: 'Ramanujan', who: '1887–1920', hue: GREEN,
    how: 'Saw the pattern first and let the proof catch up later. The number games here are built for that feeling: you notice something that should not be there, and then you chase it.' },
  { name: 'Enrico Fermi', label: 'Fermi', who: '1901–1954', hue: ORANGE,
    how: 'Within a factor of ten, with no calculator, is a win, and the estimate teaches more than the exact answer. He is half of the name Fermi Berry.' },
  { name: 'Kurt Gödel', label: 'Gödel', who: '1906–1978', hue: PURPLE,
    how: 'Showed that any rich enough system contains true statements it cannot prove. The Way of Incompleteness is eleven chapters of trying to make that feel as strange as it is.' },
  { name: 'Alan Turing', label: 'Turing', who: '1912–1954', hue: BLUE,
    how: 'Reduced “can this be computed?” to a tape and a rule, and found questions no machine can answer. The Way of Claude starts from his machine.' },
  { name: 'Claude Shannon', label: 'Shannon', who: '1916–2001', hue: GREEN,
    how: 'Measured surprise in bits. The prisoner who sends a message with one coin flip, and the editor split across two deliveries, are both his kind of problem.' },
  { name: 'Richard Feynman', label: 'Feynman', who: '1918–1988', hue: ORANGE,
    how: 'If you cannot explain it to a freshman, you do not understand it yet. The delayed-choice page, and the rule that every claim here has to survive being drawn, are his.' }
  ] }
];
const PEOPLE = GROUPS.flatMap(g => g.people.map(p => Object.assign({ windy: g.windy }, p)));

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default function (fig) {
  const W = 380, COLS = 5, S = 0.8, rowH = 112, cellW = W / COLS, stag = [0, 8, 3, 10, 5];
  const pos = [], heads = []; let yc = 8;
  GROUPS.forEach(gr => {
    heads.push({ y: yc + 14, title: gr.title }); yc += 26;
    const n = gr.people.length, rows = Math.ceil(n / COLS);
    gr.people.forEach((_, i) => {
      const row = Math.floor(i / COLS), col = i - row * COLS, inRow = row < rows - 1 ? COLS : n - row * COLS, off = (COLS - inRow) * cellW / 2;
      pos.push({ x: off + (col + 0.5) * cellW, y: yc + 46 + row * rowH + stag[col] });
    });
    yc += rows * rowH + 12;
  });
  const H = yc;

  const s = svg(fig, W, H, 'A sky of balloons, one for each inspiration; choose one to read how it inspires the site.');
  const sky = el('g', {}, s);
  heads.forEach(h => { label(s, 12, h.y, h.title, { a: 'start', size: 12, w: 700, cls: 'soft' }); el('line', { x1: 12, y1: h.y + 6, x2: W - 12, y2: h.y + 6, stroke: 'var(--line)' }, s); });
  const panel = document.createElement('div'); panel.className = 'obv-panel'; panel.setAttribute('aria-live', 'polite'); put(fig, panel);

  let sel = -1, raf = 0, seen = true;
  const balloons = PEOPLE.map((p, i) => {
    const g = el('g', { class: 'obv-balloon', role: 'button', tabindex: '0', 'aria-label': p.name + ' — how they inspire' }, sky);
    drawBalloon(g, p);
    const choose = () => select(i);
    g.addEventListener('click', choose);
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
    return { g, x: pos[i].x, y: pos[i].y, phase: i * 1.3, windy: p.windy };
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
    label(g, 0, 74, p.label, { size: 14, w: 700 });
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
      const still = calm(), k = b.windy ? 2.6 : 1;   // the ones in the wind drift further and lean into it
      const bob = still ? 0 : Math.sin(now / 1000 + b.phase) * 4, sway = still ? 0 : Math.sin(now / 1700 + b.phase) * 2 * k;
      const tilt = b.windy ? (still ? 5 : 5 + Math.sin(now / 1700 + b.phase) * 4) : 0, sc = S * (i === sel ? 1.08 : 1);
      b.g.setAttribute('transform', 'translate(' + (b.x + sway).toFixed(1) + ',' + (b.y + bob).toFixed(1) + ') rotate(' + tilt.toFixed(1) + ') scale(' + sc.toFixed(3) + ')');
    });
  }
  function frame(now) { raf = 0; if (!seen) return; layout(now); if (!calm()) raf = requestAnimationFrame(frame); }
  function kick() { if (!raf && !calm()) raf = requestAnimationFrame(frame); }
  new IntersectionObserver(es => { seen = es[0].isIntersecting; if (seen) kick(); }).observe(s);

  select(0);
}
