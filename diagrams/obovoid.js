/* The inspirations, as a sky of obovoid balloons — part lightbulb (the idea), part hot-air balloon
   (the lift). Each one floats and bobs; tap it to read how it inspires the site. The roster is a plain
   array, so more can rise later. Kept gentle, and still under prefers-reduced-motion. */
import { svg, el, label, put, calm } from './kit.js';

const GOLD = 'var(--gold)', INK = 'var(--ink)';
// the balloon body: broad at the top (the bulb / canopy), tapering to a small base (the screw / basket)
const BODY = 'M0 -52 C30 -52 34 -20 30 -2 C27 16 20 34 10 44 C4 50 -4 50 -10 44 C-20 34 -27 16 -30 -2 C-34 -20 -30 -52 0 -52 Z';

const PEOPLE = [
  {
    name: 'Nick Berry', who: 'DataGenetics', hue: 'var(--orange)',
    how: 'DataGenetics worked puzzles the way this whole site wants to: take something that sounds like a trick question, then follow the arithmetic patiently — with pictures — until the magic turns into something you understand. The pages here tagged “remix” are direct descendants, and the habit behind all of them — delight first, rigor all the way down — is Nick’s.'
  }
];

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default function (fig) {
  const W = 380, H = 232, baseY = 112;
  const s = svg(fig, W, H, 'A sky of balloons, one for each inspiration; choose one to read how it inspires the site.');
  const sky = el('g', {}, s);
  const panel = document.createElement('div'); panel.className = 'obv-panel'; panel.setAttribute('aria-live', 'polite'); put(fig, panel);

  const N = PEOPLE.length;
  const xs = N === 1 ? [W / 2] : PEOPLE.map((_, i) => 58 + i * ((W - 116) / (N - 1)));
  let sel = -1, raf = 0, seen = true;
  const balloons = PEOPLE.map((p, i) => {
    const g = el('g', { class: 'obv-balloon', role: 'button', tabindex: '0', 'aria-label': p.name + ' — how they inspire' }, sky);
    drawBalloon(g, p);
    const choose = () => select(i);
    g.addEventListener('click', choose);
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
    return { g, x: xs[i], phase: i * 1.7 };
  });

  function drawBalloon(g, p) {
    el('ellipse', { class: 'glow', cx: 0, cy: -14, rx: 20, ry: 26, fill: GOLD, opacity: 0.16 }, g);
    el('path', { class: 'body', d: BODY, fill: 'color-mix(in srgb, ' + p.hue + ' 26%, var(--panel))', stroke: p.hue, 'stroke-width': 1.8, 'stroke-linejoin': 'round' }, g);
    el('path', { d: 'M0 -52 C10 -20 8 20 4 42', fill: 'none', stroke: p.hue, 'stroke-width': 1, opacity: 0.5 }, g);   // balloon gores
    el('path', { d: 'M0 -52 C-10 -20 -8 20 -4 42', fill: 'none', stroke: p.hue, 'stroke-width': 1, opacity: 0.5 }, g);
    el('path', { d: 'M-6 -16 L-2 -6 L2 -16 L6 -6', fill: 'none', stroke: GOLD, 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);   // filament
    el('line', { x1: -9, y1: 43, x2: -5, y2: 50, stroke: INK, 'stroke-width': 1 }, g);
    el('line', { x1: 9, y1: 43, x2: 5, y2: 50, stroke: INK, 'stroke-width': 1 }, g);
    el('path', { d: 'M-6 50 H6 L4 57 H-4 Z', fill: INK }, g);   // basket
    label(g, 0, 74, p.name, { size: 13, w: 700 });
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
      const bob = calm() ? 0 : Math.sin(now / 1000 + b.phase) * 6, sway = calm() ? 0 : Math.sin(now / 1700 + b.phase) * 3, sc = i === sel ? 1.06 : 1;
      b.g.setAttribute('transform', 'translate(' + (b.x + sway).toFixed(1) + ',' + (baseY + bob).toFixed(1) + ') scale(' + sc + ')');
    });
  }
  function frame(now) { raf = 0; if (!seen) return; layout(now); if (!calm()) raf = requestAnimationFrame(frame); }
  function kick() { if (!raf && !calm()) raf = requestAnimationFrame(frame); }
  new IntersectionObserver(es => { seen = es[0].isIntersecting; if (seen) kick(); }).observe(s);

  select(0);
}
