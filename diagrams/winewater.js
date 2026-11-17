/* Wine and water. Two 200 ml glasses; spoon some wine into the water, then spoon the mixture back.
   Whatever the spoon size and however well you stir, the wine left in the water glass equals the
   water that ends up in the wine glass: each glass ends with its original volume, so the wine
   missing from one is replaced, ml for ml, by water, and that wine is exactly what the other holds. */
import { svg, el, clear, label, controls, slider, button, readouts } from './kit.js';

const PURPLE = 'var(--purple)', BLUE = 'var(--blue)', INK = 'var(--ink)', SOFT = 'var(--ink-soft)';
const CAP = 200;

/* Pure model. stage 0: start; 1: wine spooned into water; 2: mixture spooned back.
   Return-spoon wine fraction: s * (wine fraction in the water glass) + (1 - s) * F0.
   F0 = 1: with no stirring, the spoon dips into the wine you just added and scoops mostly wine. */
const F0 = 1;
export function model(v, s, stage) {
  let wineA = CAP, waterA = 0;   // wine glass: wine, water
  let wineB = 0, waterB = CAP;   // water glass: wine, water
  if (stage >= 1) { wineA -= v; wineB += v; }
  if (stage >= 2) {
    const p = s * (wineB / (wineB + waterB)) + (1 - s) * F0;
    const w = v * p, q = v * (1 - p);
    wineB -= w; waterB -= q; wineA += w; waterA += q;
  }
  return { wineA, waterA, wineB, waterB };
}

export default function (fig) {
  const S = svg(fig, 380, 262, 'A glass of wine and a glass of water, with the amount of each liquid shown in each glass.');
  const g = el('g', {}, S);
  const box = controls(fig), box2 = controls(fig);
  const [r1, r2] = readouts(fig, ['Wine in the water glass', 'Water in the wine glass']);
  let v = 20, s = 1, stage = 0;

  const U = 150 / 260, BOT = 205, GW = 100;   // px per ml, glass floor, glass width
  const f1 = n => n.toFixed(1);

  function glass(x0, native, nat, foreign, foreignCol, title) {
    const natH = nat * U, forH = foreign * U;
    el('rect', { x: x0, y: BOT - natH, width: GW, height: natH, fill: native, opacity: .6 }, g);
    if (foreign > 0.005) el('rect', { x: x0, y: BOT - natH - forH, width: GW, height: forH, fill: foreignCol, opacity: .6 }, g);
    el('path', { d: `M${x0} ${BOT - 260 * U}V${BOT}H${x0 + GW}V${BOT - 260 * U}`, fill: 'none', stroke: INK, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, g);
    // line marking the starting 200 ml
    el('line', { x1: x0 - 6, y1: BOT - CAP * U, x2: x0, y2: BOT - CAP * U, stroke: SOFT, 'stroke-width': 1.5 }, g);
    label(g, x0 + GW / 2, BOT + 18, title, { size: 13, w: 700 });
  }

  function draw() {
    clear(g);
    const m = model(v, s, stage);
    glass(40, PURPLE, m.wineA, m.waterA, BLUE, 'Wine glass');
    glass(240, BLUE, m.waterB, m.wineB, PURPLE, 'Water glass');
    label(g, 90, BOT + 36, `${f1(m.wineA)} wine + ${f1(m.waterA)} water`, { size: 11, cls: 'soft' });
    label(g, 290, BOT + 36, `${f1(m.waterB)} water + ${f1(m.wineB)} wine`, { size: 11, cls: 'soft' });
    label(g, 90, 20, `${f1(m.wineA + m.waterA)} ml`, { size: 13, w: 700 });
    label(g, 290, 20, `${f1(m.wineB + m.waterB)} ml`, { size: 13, w: 700 });
    // spoon note in the gap
    const note = stage === 0 ? ['spoon:', v + ' ml'] : stage === 1 ? ['wine →', v + ' ml'] : ['← mixture', v + ' ml'];
    label(g, 190, 100, note[0], { size: 11, cls: 'soft' });
    label(g, 190, 116, note[1], { size: 12, w: 700 });
    el('line', { x1: 160, y1: 126, x2: 220, y2: 126, stroke: SOFT, 'stroke-width': 1.5, opacity: stage === 0 ? 0 : 1 }, g);
    r1.textContent = f1(m.wineB) + ' ml';
    r2.textContent = f1(m.waterA) + ' ml';
    b2.disabled = stage !== 1;
    b1.disabled = stage !== 0;
  }

  slider(box, 'Spoon size ', 5, 50, 1, v, x => x + ' ml', x => { v = x; draw(); });
  slider(box, 'How well you stir ', 0, 100, 1, 100, x => x + '%', x => { s = x / 100; draw(); });
  const b1 = button(box2, 'Spoon wine into water', () => { stage = 1; draw(); }, 'go');
  const b2 = button(box2, 'Spoon mixture back', () => { if (stage === 1) { stage = 2; draw(); } });
  button(box2, 'Start over', () => { stage = 0; draw(); });
  draw();
}
