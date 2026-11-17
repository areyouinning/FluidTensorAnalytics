/* Simpson's paradox with the kidney-stone data (Charig et al., 1986). Treatment A beats B for small
   stones and for large stones, yet B has the better overall rate, because A was mostly given the hard
   (large-stone) cases. An overall rate is a weighted average of the two group rates; each treatment is
   a line from its large-stone rate to its small-stone rate, and where its dot sits along that line is
   set by its mix of patients. A's line is above B's everywhere, but the dots sit at different places. */
import { svg, el, clear, label, controls, slider, button, readouts } from './kit.js';

const BLUE = 'var(--blue)', ORANGE = 'var(--orange)', INK = 'var(--ink)', SOFT = 'var(--ink-soft)', LINE = 'var(--line)';
const RATE = { A: { small: 81 / 87, large: 192 / 263 }, B: { small: 234 / 270, large: 55 / 80 } };   // success rates, held fixed
const N = 350, REAL = { A: 87, B: 270 };   // of each treatment's 350 patients, how many had small stones

export default function (fig) {
  const s = svg(fig, 380, 250, 'Two rising lines, treatment A above treatment B, with a dot on each showing its overall success rate for its mix of patients.');
  const g = el('g', {}, s);
  const box = controls(fig), box2 = controls(fig);
  const [inR, allR] = readouts(fig, ['Within each group', 'All patients together']);
  let nA = REAL.A, nB = REAL.B, sA, sB;
  const X0 = 46, X1 = 356, Y0 = 204, Y1 = 22, lo = 0.6, hi = 1.0;
  const X = share => X0 + share * (X1 - X0), Y = r => Y0 - (r - lo) / (hi - lo) * (Y0 - Y1);
  const overall = (t, n) => (n * RATE[t].small + (N - n) * RATE[t].large) / N;
  const pc = v => (v * 100).toFixed(0) + '%';

  function draw() {
    clear(g);
    for (let r = 0.6; r <= 1.001; r += 0.1) { el('line', { x1: X0, y1: Y(r), x2: X1, y2: Y(r), stroke: LINE }, g); label(g, X0 - 6, Y(r) + 4, pc(r), { a: 'end', size: 10, cls: 'soft' }); }
    label(g, X0, Y0 + 16, 'all large stones', { a: 'start', size: 10, cls: 'soft' }); label(g, X1, Y0 + 16, 'all small stones', { a: 'end', size: 10, cls: 'soft' });
    label(g, (X0 + X1) / 2, Y0 + 32, 'share of this treatment’s patients with small (easier) stones →', { size: 10, cls: 'soft' });
    [['A', BLUE, nA], ['B', ORANGE, nB]].forEach(([t, col, n]) => {
      el('line', { x1: X(0), y1: Y(RATE[t].large), x2: X(1), y2: Y(RATE[t].small), stroke: col, 'stroke-width': 2.5 }, g);
      label(g, X(1) - 4, Y(RATE[t].small) + (t === 'A' ? -7 : 15), t + ': ' + pc(RATE[t].small), { a: 'end', size: 11, w: 700, fill: col });
      label(g, X(0) + 4, Y(RATE[t].large) + (t === 'A' ? -7 : 15), t + ': ' + pc(RATE[t].large), { a: 'start', size: 11, w: 700, fill: col });
      const o = overall(t, n);
      el('line', { x1: X(n / N), y1: Y(o), x2: X(n / N), y2: Y0, stroke: col, 'stroke-dasharray': '2 3' }, g);
      el('circle', { cx: X(n / N), cy: Y(o), r: 7, fill: col, stroke: INK, 'stroke-width': 2 }, g);
      label(g, X(n / N), Y(o) + (t === 'A' ? -12 : 22), t + ' overall ' + pc(o), { size: 11, w: 700, fill: col });
    });
    const oA = overall('A', nA), oB = overall('B', nB);
    inR.textContent = 'A wins both: ' + pc(RATE.A.small) + ' v ' + pc(RATE.B.small) + ' small, ' + pc(RATE.A.large) + ' v ' + pc(RATE.B.large) + ' large';
    allR.textContent = (Math.abs(oA - oB) < 0.0005 ? 'a tie at ' + pc(oA) : oA > oB ? 'A looks better: ' + pc(oA) + ' v ' + pc(oB) : 'B looks better: ' + pc(oB) + ' v ' + pc(oA) + ' — reversed');
  }
  const set = (a, b) => { nA = a; nB = b; sA.value = a; sB.value = b; sA.dispatchEvent(new Event('input')); sB.dispatchEvent(new Event('input')); };
  sA = slider(box, 'A’s small-stone patients ', 0, N, 1, nA, v => v + ' of ' + N, v => { nA = v; draw(); });
  sB = slider(box, 'B’s small-stone patients ', 0, N, 1, nB, v => v + ' of ' + N, v => { nB = v; draw(); });
  button(box2, 'As it happened', () => set(REAL.A, REAL.B), 'go');
  button(box2, 'Same mix for both', () => set(175, 175));
  draw();
}
