/* Two halves have to land in the same cell. Move the share and watch the overlap. */
import { svg, el, clear, label, controls, slider, readouts, rng, C } from './kit.js';
import { P } from './twohalf-core.js';

const DOSE = 8, COLS = 12, ROWS = 5, N = COLS * ROWS, S = 28;

const both = f => (1 - Math.exp(-f * DOSE * P.wA)) * (1 - Math.exp(-(1 - f) * DOSE * P.wB));
const onlyA = f => (1 - Math.exp(-f * DOSE * P.wA)) * Math.exp(-(1 - f) * DOSE * P.wB);
const onlyB = f => Math.exp(-f * DOSE * P.wA) * (1 - Math.exp(-(1 - f) * DOSE * P.wB));

export function bestShare() {
  let bf = .5, bv = -1;
  for (let i = 1; i < 200; i++) { const f = i / 200, v = both(f); if (v > bv) { bv = v; bf = f; } }
  return { f: bf, v: bv };
}

export default function (fig) {
  const s = svg(fig, 360, 262, 'Sixty cells shaded by which halves of the editor reached them, over a curve of the chance a cell gets both.');
  const g = el('g', {}, s), box = controls(fig);
  const [got, tip] = readouts(fig, ['Cells with both halves', 'Best share for half A']);
  /* a fixed shuffle, so moving the slider recolors cells instead of rearranging them */
  const R = rng(91), ord = [...Array(N).keys()];
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [ord[i], ord[j]] = [ord[j], ord[i]]; }
  const best = bestShare();
  const X = f => 12 + f * 336, Y = v => 250 - v / Math.max(.4, best.v * 1.15) * 56;

  function draw(f) {
    clear(g);
    const pB = both(f), pA = onlyA(f), pO = onlyB(f);
    const nB = Math.round(pB * N), nA = Math.round(pA * N), nO = Math.round(pO * N);
    const kind = new Array(N).fill(3);
    ord.forEach((cell, rank) => { kind[cell] = rank < nB ? 0 : rank < nB + nA ? 1 : rank < nB + nA + nO ? 2 : 3; });
    const fill = [C.green, C.blue, C.orange, C.sunk];
    for (let i = 0; i < N; i++) {
      const x = 12 + (i % COLS) * S, y = 10 + Math.floor(i / COLS) * S;
      el('rect', { x, y, width: S - 3, height: S - 3, rx: 4, fill: fill[kind[i]] }, g);
      if (kind[i] === 0) el('path', { d: `M${x + 7} ${y + 13}l4 4 7-8`, fill: 'none', stroke: 'var(--panel)', 'stroke-width': 2.6, 'stroke-linecap': 'round' }, g);
    }
    label(g, 12, 168, 'green: both halves', { a: 'start', size: 13, cls: 'soft' });
    label(g, 348, 168, 'blue A only, orange B only', { a: 'end', size: 13, cls: 'soft' });

    el('path', { d: 'M12 250H348', stroke: C.line, fill: 'none' }, g);
    let d = '';
    for (let i = 1; i < 200; i++) d += (i === 1 ? 'M' : 'L') + X(i / 200).toFixed(1) + ' ' + Y(both(i / 200)).toFixed(1);
    el('path', { d, fill: 'none', stroke: C.green, 'stroke-width': 2.5 }, g);
    el('circle', { cx: X(best.f), cy: Y(best.v), r: 4, fill: C.green }, g);
    el('path', { d: `M${X(f)} 186V250`, stroke: C.ink, 'stroke-width': 2, 'stroke-dasharray': '4 3', fill: 'none' }, g);
    label(g, 12, 262, 'all to B', { a: 'start', size: 13, cls: 'soft' });
    label(g, 348, 262, 'all to A', { a: 'end', size: 13, cls: 'soft' });

    got.textContent = (pB * 100).toFixed(1) + '%';
    tip.textContent = Math.round(best.f * 100) + '%';
  }
  slider(box, 'Share to half A', .04, .96, .02, .5, v => Math.round(v * 100) + '%', draw);
  draw(.5);
}
