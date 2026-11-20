/* Achilles and the tortoise. Each "Zeno step" ends when Achilles reaches the spot where the tortoise
   was at the start of that stage. Stage k covers d·r^(k-1) meters (r = v_T / v_A) and takes
   d·r^(k-1) / v_A seconds, so the stage times are a geometric series with a finite sum, d / (v_A − v_T). */
import { svg, el, clear, label, controls, slider, button, readouts, calm } from './kit.js';

const BLUE = 'var(--blue)', ORANGE = 'var(--orange)', GREEN = 'var(--green)', RED = 'var(--red)', INK = 'var(--ink)', SOFT = 'var(--ink-soft)', LINE = 'var(--line)', PANEL = 'var(--panel)', SUNK = 'var(--sunk)';
const fmt = x => { const s = x.toPrecision(3); return String(+s) === s || Math.abs(x) >= 1e-3 ? String(+s) : x.toExponential(0).replace('e-', 'e−'); };

export default function (fig) {
  const s = svg(fig, 380, 290, 'A track with Achilles and a tortoise, the shrinking stages of the chase drawn as stacked segments, and a bar chart of how long each stage takes.');
  const g = el('g', {}, s);
  const box = controls(fig), box2 = controls(fig);
  const [stR, tR, dR, cR] = readouts(fig, ['Stages so far', 'Time so far', 'Distance so far', 'Catch-up time']);
  let d = 100, ratio = 10, t = 0, raf = 0;
  const vT = () => 1, vA = () => ratio;
  const tc = () => d / (vA() - vT());
  const r = () => vT() / vA();
  const D = n => d * (1 - Math.pow(r(), n)) / (1 - r());      // Achilles' position at the end of stage n
  const stageT = k => d * Math.pow(r(), k - 1) / vA();
  const nAt = tt => { let n = 0, sum = 0; while (n < 60 && sum + stageT(n + 1) <= tt + 1e-12) { sum += stageT(n + 1); n++; } return n; };
  const caught = () => t >= tc() - 1e-12;

  function draw() {
    clear(g);
    const catchPos = vA() * tc(), L = catchPos * 1.1, X0 = 20, W = 340, px = p => X0 + W * p / L;
    const aPos = vA() * t, tPos = d + vT() * t;
    // track
    el('line', { x1: X0, y1: 52, x2: X0 + W, y2: 52, stroke: INK, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, g);
    el('line', { x1: px(catchPos), y1: 28, x2: px(catchPos), y2: 270, stroke: GREEN, 'stroke-width': 1.2, 'stroke-dasharray': '4 3', opacity: .8 }, g);
    label(g, px(catchPos), 20, 'catch point ' + fmt(catchPos) + ' m', { size: 11, fill: GREEN, a: px(catchPos) > 300 ? 'end' : 'middle' });
    label(g, X0, 70, '0 m', { size: 10, cls: 'soft', a: 'start' });
    // tortoise (a dome) and Achilles (a circle)
    const tx = px(tPos);
    el('path', { d: `M${tx - 9} 51 A9 9 0 0 1 ${tx + 9} 51 Z`, fill: ORANGE, stroke: INK, 'stroke-width': 1.5 }, g);
    el('circle', { cx: tx + 10, cy: 46, r: 2.5, fill: ORANGE, stroke: INK }, g);
    const ax = px(aPos);
    el('circle', { cx: ax, cy: 40, r: 7, fill: caught() ? GREEN : BLUE, stroke: INK, 'stroke-width': 1.5 }, g);
    el('line', { x1: ax, y1: 47, x2: ax, y2: 52, stroke: INK, 'stroke-width': 2 }, g);
    label(g, Math.max(18, Math.min(362, ax - (Math.abs(ax - tx) < 22 ? 14 : 0))), 33, 'Achilles', { size: 10, fill: BLUE, a: 'middle' });
    label(g, Math.min(362, tx + (Math.abs(ax - tx) < 22 ? 14 : 0)), 70, 'tortoise', { size: 10, fill: ORANGE, a: 'middle' });

    // stage segments, stacked
    const n = nAt(t), rows = 8, rh = 11, y0 = 82;
    let tiny = 0;
    for (let k = 1; k <= rows; k++) {
      const a = D(k - 1), b = D(k), y = y0 + (k - 1) * rh, w = px(b) - px(a);
      if (w < 1 && !tiny) tiny = k;
      el('rect', { x: px(a), y, width: Math.max(w, 1.5), height: rh - 3, rx: 1.5, fill: k <= n ? BLUE : SUNK, stroke: k <= n ? 'none' : LINE, opacity: k <= n ? .85 : 1 }, g);
      label(g, 11, y + 7.5, String(k), { size: 9, cls: 'soft' });
    }
    const note = tiny ? `Stage ${tiny} and later are thinner than a pixel here` : 'Stages past 8 are too small to list';
    label(g, 190, y0 + rows * rh + 9, note, { size: 10, cls: 'soft' });

    // stage times
    const by = 262, bh = 52, cw = 34, bx = 20, T1 = stageT(1);
    label(g, 190, 210, 'Time each stage takes (seconds)', { size: 10, cls: 'soft' });
    for (let k = 1; k <= 10; k++) {
      const h = bh * stageT(k) / T1, x = bx + (k - 1) * cw;
      el('rect', { x: x + 3, y: by - h, width: cw - 8, height: Math.max(h, 1), fill: k <= n ? BLUE : SUNK, stroke: k <= n ? 'none' : LINE, opacity: k <= n ? .85 : 1 }, g);
      label(g, x + cw / 2 - 1, by - Math.max(h, 1) - 3, fmt(stageT(k)), { size: 8.5, cls: 'soft' });
      label(g, x + cw / 2 - 1, by + 12, String(k), { size: 9, cls: 'soft' });
    }
    el('line', { x1: bx, y1: by, x2: bx + 10 * cw - 4, y2: by, stroke: LINE }, g);

    stR.textContent = caught() ? 'all of them' : String(n);
    tR.textContent = (caught() ? tc() : t).toFixed(4) + ' s';
    dR.textContent = (caught() ? catchPos : aPos).toFixed(4) + ' m';
    cR.textContent = tc().toFixed(4) + ' s';
    if (caught() && t > tc() + 1e-9) { tR.textContent = t.toFixed(4) + ' s'; dR.textContent = aPos.toFixed(4) + ' m'; }
  }

  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  function reset() { stop(); t = 0; draw(); }
  function step() { stop(); if (caught()) return; const n = nAt(t); t = D(n + 1) / vA(); draw(); }
  function run() {
    stop();
    const end = tc() * 1.08;
    if (calm()) { t = end; draw(); return; }
    t = 0; const T0 = performance.now(), dur = 3500;
    const f = now => { const u = Math.min(1, (now - T0) / dur); t = end * u; draw(); raf = u < 1 ? requestAnimationFrame(f) : 0; };
    raf = requestAnimationFrame(f);
  }

  slider(box, 'Head start ', 10, 200, 5, d, v => v + ' m', v => { d = v; reset(); });
  slider(box, 'Speed ratio ', 2, 20, 1, ratio, v => v + ' : 1', v => { ratio = v; reset(); });
  button(box2, 'Zeno step', step, 'go');
  button(box2, 'Just run', run);
  button(box2, 'Start over', reset);
  draw();
}
