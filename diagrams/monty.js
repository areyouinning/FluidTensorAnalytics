/* Three doors, one car. You pick; the host, who knows, opens a goat door among the other two; you stay or switch.
   Your first pick wins 1 time in 3, and switching wins exactly when the first pick was wrong, so 2 in 3. */
import { svg, el, clear, label, controls, button, readouts } from './kit.js';

const BLUE = 'var(--blue)', ORANGE = 'var(--orange)', GREEN = 'var(--green)', RED = 'var(--red)', INK = 'var(--ink)', SOFT = 'var(--ink-soft)', SUNK = 'var(--sunk)', LINE = 'var(--line)', PANEL = 'var(--panel)';
const CX = [70, 190, 310], DW = 92, DY = 14, DH = 132;
const rnd = n => Math.floor(Math.random() * n);

export default function (fig) {
  const s = svg(fig, 380, 236, 'Three doors. A car is behind one and goats behind the other two. Pick a door, see the host open a goat door, then stay or switch.');
  const g = el('g', {}, s);
  const box = controls(fig);
  const [stayR, switchR] = readouts(fig, ['Stay wins', 'Switch wins']);
  const tally = { stay: { w: 0, n: 0 }, switch: { w: 0, n: 0 } };
  let car, pick, opened, final, phase, won;

  const fmt = t => t.n ? `${t.w} of ${t.n} (${(100 * t.w / t.n).toFixed(1)}%)` : '0 of 0';
  const hostOpens = (car, pick) => {
    const ok = [0, 1, 2].filter(d => d !== pick && d !== car);
    return ok[rnd(ok.length)];
  };
  const other = (pick, opened) => [0, 1, 2].find(d => d !== pick && d !== opened);

  function newRound() {
    car = rnd(3); pick = opened = final = won = null; phase = 'pick';
    draw();
  }

  function drawCar(x, y) {
    el('path', { d: `M${x - 28} ${y + 8}L${x - 22} ${y - 8}L${x - 8} ${y - 14}L${x + 10} ${y - 14}L${x + 22} ${y - 6}L${x + 30} ${y + 8}Z`, fill: BLUE, stroke: INK, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }, g);
    el('path', { d: `M${x - 17} ${y - 5}L${x - 7} ${y - 10}L${x + 8} ${y - 10}L${x + 16} ${y - 4}Z`, fill: PANEL, stroke: 'none' }, g);
    el('circle', { cx: x - 15, cy: y + 9, r: 6, fill: INK }, g);
    el('circle', { cx: x + 16, cy: y + 9, r: 6, fill: INK }, g);
  }
  function drawGoat(x, y) {
    el('ellipse', { cx: x, cy: y + 2, rx: 22, ry: 13, fill: SUNK, stroke: INK, 'stroke-width': 1.2 }, g);
    el('path', { d: `M${x - 14} ${y + 12}v12M${x - 5} ${y + 14}v10M${x + 6} ${y + 14}v10M${x + 15} ${y + 12}v12`, stroke: INK, 'stroke-width': 2, 'stroke-linecap': 'round', fill: 'none' }, g);
    el('circle', { cx: x - 22, cy: y - 8, r: 8, fill: SUNK, stroke: INK, 'stroke-width': 1.2 }, g);
    el('path', { d: `M${x - 26} ${y - 14}l-3 -9M${x - 19} ${y - 14}l1 -9`, stroke: INK, 'stroke-width': 2, 'stroke-linecap': 'round', fill: 'none' }, g);
    el('circle', { cx: x - 24, cy: y - 9, r: 1.5, fill: INK }, g);
    el('path', { d: `M${x + 22} ${y - 2}q6 -4 8 -10`, stroke: INK, 'stroke-width': 2, 'stroke-linecap': 'round', fill: 'none' }, g);
  }

  function draw() {
    clear(g);
    const done = phase === 'done';
    for (let d = 0; d < 3; d++) {
      const x = CX[d] - DW / 2, isOpen = d === opened || done;
      const sel = d === (done ? final : pick);
      let stroke = LINE, sw = 1.5;
      if (sel) { stroke = done ? (won ? GREEN : RED) : ORANGE; sw = 3.5; }
      const grp = el('g', {}, g);
      el('rect', { x, y: DY, width: DW, height: DH, rx: 6, fill: isOpen ? SUNK : PANEL, stroke, 'stroke-width': sw }, grp);
      if (isOpen) {
        if (d === car) drawCar(CX[d], DY + 84); else drawGoat(CX[d] + 4, DY + 76);
      } else {
        el('rect', { x: x + 12, y: DY + 14, width: DW - 24, height: DH - 28, rx: 4, fill: 'none', stroke: LINE, 'stroke-width': 1.2 }, grp);
        el('circle', { cx: x + DW - 20, cy: DY + DH / 2 + 4, r: 4, fill: SOFT }, grp);
        label(grp, CX[d], DY + 46, String(d + 1), { size: 26, w: 600, fill: INK });
      }
      label(g, CX[d], DY + DH + 18, 'Door ' + (d + 1), { size: 12, fill: SOFT });
      if (phase === 'pick') {
        grp.setAttribute('role', 'button'); grp.setAttribute('tabindex', '0');
        grp.setAttribute('aria-label', 'Pick door ' + (d + 1)); grp.style.cursor = 'pointer';
        const go = () => choose(d);
        grp.addEventListener('click', go);
        grp.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      }
    }
    let l1, l2 = '';
    if (phase === 'pick') l1 = 'Tap a door to pick it.';
    else if (phase === 'host') {
      l1 = `You picked door ${pick + 1}. The host opens door ${opened + 1}: a goat.`;
      l2 = `Stay on door ${pick + 1}, or switch to door ${other(pick, opened) + 1}?`;
    } else {
      l1 = `You ${final === pick ? 'stayed on' : 'switched to'} door ${final + 1}. The car was behind door ${car + 1}.`;
      l2 = won ? 'You win the car.' : 'You get a goat.';
    }
    label(g, 190, 202, l1, { size: 12.5, fill: INK });
    if (l2) label(g, 190, 222, l2, { size: 12.5, w: 600, fill: done ? (won ? GREEN : RED) : INK });
    stayBtn.disabled = switchBtn.disabled = phase !== 'host';
    nextBtn.disabled = phase !== 'done';
    stayR.textContent = fmt(tally.stay);
    switchR.textContent = fmt(tally.switch);
  }

  function choose(d) {
    if (phase !== 'pick') return;
    pick = d; opened = hostOpens(car, pick); phase = 'host'; draw();
  }
  function decide(sw) {
    if (phase !== 'host') return;
    final = sw ? other(pick, opened) : pick;
    won = final === car;
    const t = sw ? tally.switch : tally.stay;
    t.n++; if (won) t.w++;
    phase = 'done'; draw();
  }
  function bulk() {
    for (let i = 0; i < 1000; i++) {
      for (const sw of [false, true]) {
        const c = rnd(3), p = rnd(3), o = hostOpens(c, p);
        const f = sw ? other(p, o) : p, t = sw ? tally.switch : tally.stay;
        t.n++; if (f === c) t.w++;
      }
    }
    draw();
  }

  const stayBtn = button(box, 'Stay', () => decide(false));
  const switchBtn = button(box, 'Switch', () => decide(true));
  const nextBtn = button(box, 'Next round', newRound, 'go');
  button(box, 'Play 1000 each way', bulk);
  newRound();
}
