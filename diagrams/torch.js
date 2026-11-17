/* The bridge-and-torch riddle. Four walkers (1, 2, 5, 10 minutes) cross a bridge that holds two, with one
   torch that must travel with every crossing. Tap walkers on the torch's bank, press Cross. The best plan
   takes 17 minutes (checked by Dijkstra over every state); the greedy "fastest escorts everyone" plan takes 19. */
import { svg, el, clear, label, controls, button, readouts, calm } from './kit.js';

const INK = 'var(--ink)', SOFT = 'var(--ink-soft)', LINE = 'var(--line)', SUNK = 'var(--sunk)', PANEL = 'var(--panel)';
const T = [1, 2, 5, 10], HUE = ['var(--green)', 'var(--blue)', 'var(--purple)', 'var(--red)'];
const BEST = [[0, 1], [0], [2, 3], [1], [0, 1]];
const GREEDY = [[0, 1], [0], [0, 2], [0], [0, 3]];
const SLOT = side => i => [(side ? 310 : 30) + (i % 2) * 42, 188 + Math.floor(i / 2) * 40];

export default function (fig) {
  const s = svg(fig, 380, 256, 'A left bank and a right bank joined by a bridge. Four walkers who take 1, 2, 5 and 10 minutes to cross, and one torch on whichever bank it is.');
  const back = el('g', {}, s), walkers = el('g', {}, s), torch = el('g', {}, s);
  const box = controls(fig), box2 = controls(fig);
  const [timeR, crossR, statR] = readouts(fig, ['Time used', 'Crossings', 'Status']);
  let side, tside, sel, hist, time, timer = 0, note = '';

  // static scenery
  el('rect', { x: 0, y: 128, width: 100, height: 128, rx: 8, fill: SUNK }, back);
  el('rect', { x: 280, y: 128, width: 100, height: 128, rx: 8, fill: SUNK }, back);
  el('rect', { x: 100, y: 178, width: 180, height: 62, fill: 'color-mix(in srgb, var(--blue) 14%, var(--panel))' }, back);
  el('rect', { x: 100, y: 146, width: 180, height: 14, fill: PANEL, stroke: INK, 'stroke-width': 2 }, back);
  for (let x = 114; x < 280; x += 18) el('line', { x1: x, y1: 146, x2: x, y2: 160, stroke: LINE, 'stroke-width': 1.5 }, back);
  label(back, 190, 136, 'bridge: two at a time', { size: 11, cls: 'soft' });
  label(back, 50, 120, 'left bank', { size: 12, cls: 'soft' });
  label(back, 330, 120, 'right bank', { size: 12, cls: 'soft' });
  label(back, 190, 214, 'water', { size: 11, cls: 'soft' });

  const nodes = T.map((t, i) => {
    const g = el('g', { role: 'button', tabindex: '0', style: 'cursor:pointer' }, walkers);
    const ring = el('circle', { r: 22, fill: 'none', stroke: INK, 'stroke-width': 3 }, g);
    el('circle', { r: 18, fill: HUE[i] }, g);
    const tx = el('text', { 'text-anchor': 'middle', y: 6, 'font-size': 17, 'font-weight': 700, style: 'fill:var(--on-accent)' }, g, t);
    const hit = () => { if (side[i] !== tside) return; stop(); const k = sel.indexOf(i); if (k >= 0) sel.splice(k, 1); else { sel.push(i); if (sel.length > 2) sel.shift(); } note = ''; draw(); };
    g.addEventListener('click', hit);
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hit(); } });
    return { g, ring };
  });
  // torch: flame over a stick
  el('rect', { x: -2.5, y: 2, width: 5, height: 14, rx: 2, fill: INK }, torch);
  el('path', { d: 'M0 -16C7 -8 8 -2 0 3C-8 -2 -7 -8 0 -16Z', fill: 'var(--orange)', stroke: INK, 'stroke-width': 1.5, 'stroke-linejoin': 'round' }, torch);
  el('path', { d: 'M0 -7C3 -3 3 0 0 2C-3 0 -3 -3 0 -7Z', fill: 'var(--gold)' }, torch);

  const done = () => side.every(v => v === 1);
  const pairTime = g => Math.max(...g.map(i => T[i]));

  function draw() {
    nodes.forEach((n, i) => {
      const [x, y] = SLOT(side[i])(i);
      n.g.setAttribute('transform', `translate(${x} ${y})`);
      const can = side[i] === tside && !done(), on = sel.includes(i);
      n.ring.style.opacity = on ? 1 : 0;
      n.g.setAttribute('aria-pressed', on);
      n.g.setAttribute('tabindex', can ? '0' : '-1');
      n.g.setAttribute('aria-disabled', !can);
      n.g.style.cursor = can ? 'pointer' : 'default';
      n.g.setAttribute('aria-label', `Walker, ${T[i]} minutes, on the ${side[i] ? 'right' : 'left'} bank` + (on ? ', selected' : can ? '' : ', not with the torch'));
    });
    torch.setAttribute('transform', `translate(${tside ? 331 : 50} 100)`);
    timeR.textContent = time + (time === 1 ? ' minute' : ' minutes');
    crossR.textContent = String(hist.length);
    statR.textContent = done()
      ? `Everyone is across in ${time} minutes` + (time === 17 ? ' — the best possible.' : ' — the best possible is 17.')
      : note || (sel.length ? `${pairTime(sel)} min to cross; press Cross` : `Torch is on the ${tside ? 'right' : 'left'} bank: pick one or two`);
    cross.disabled = done() || !sel.length;
    undo.disabled = !hist.length;
  }

  function stop() { clearInterval(timer); timer = 0; }
  function go(group) {
    const c = pairTime(group);
    group.forEach(i => { side[i] = 1 - side[i]; });
    hist.push({ group: [...group], c }); time += c; tside = 1 - tside; sel = []; note = '';
  }
  function reset() { stop(); side = [0, 0, 0, 0]; tside = 0; sel = []; hist = []; time = 0; note = ''; draw(); }
  function doCross() { stop(); if (!sel.length || done()) return; go([...sel]); draw(); }
  function doUndo() {
    stop(); const m = hist.pop(); if (!m) return;
    m.group.forEach(i => { side[i] = 1 - side[i]; }); time -= m.c; tside = 1 - tside; sel = []; note = ''; draw();
  }
  function play(plan, name) {
    reset();
    if (calm()) { plan.forEach(go); draw(); note = ''; return; }
    let k = 0;
    timer = setInterval(() => { if (k >= plan.length) { stop(); return; } go(plan[k++]); draw(); }, 700);
  }

  const cross = button(box, 'Cross', doCross, 'go'), undo = button(box, 'Undo', doUndo);
  button(box, 'Start over', reset);
  button(box2, 'Show the best plan', () => play(BEST));
  button(box2, 'Greedy plan', () => play(GREEDY));
  reset();
}
