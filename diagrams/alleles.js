/* Doing it twice is not twice as hard. Each cell shows its two copies; drag the windows up. */
import { svg, el, clear, label, controls, slider, readouts, rng, C } from './kit.js';
import { MS, windowsOnly, RATIO } from './twohalf-core.js';

const COLS = 12, ROWS = 5, N = COLS * ROWS, S = 28, TOP = 10;
const PAINT = { R: C.sunk, C: C.green, S: C.orange };
const CEIL = RATIO * RATIO;

export default function (fig) {
  const s = svg(fig, 360, 300, 'Sixty cells, each drawn as its two gene copies, over a curve of how often both end up correct.');
  const g = el('g', {}, s), box = controls(fig);
  const [win, lost] = readouts(fig, ['Both copies correct', 'One correct, one scarred']);
  const R = rng(17), ord = [...Array(N).keys()];
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [ord[i], ord[j]] = [ord[j], ord[i]]; }
  /* the scale has to hold the one-copy line at 76%, which sits well above the curve */
  const X = k => 16 + (k - 1) / 7 * 330, Y = v => 280 - v / .85 * 94;

  function draw(n) {
    clear(g);
    const d = windowsOnly(n).dist;
    /* hand out the six outcomes in proportion, in a fixed cell order */
    const want = MS.map((m, i) => Math.round(d[i] * N));
    const kind = new Array(N).fill('RR');
    let rank = 0;
    MS.forEach((m, i) => { for (let k = 0; k < want[i] && rank < N; k++) kind[ord[rank++]] = m; });
    for (let i = 0; i < N; i++) {
      const x = 12 + (i % COLS) * S, y = TOP + Math.floor(i / COLS) * S, m = kind[i];
      el('rect', { x, y, width: S - 3, height: S - 3, rx: 4, fill: 'var(--panel)' }, g);
      for (let c = 0; c < 2; c++)
        el('rect', { x: x + 2.5 + c * 10.5, y: y + 2.5, width: 8.5, height: S - 8, rx: 2.5, fill: PAINT[m[c]] }, g);
      if (m === 'CC') el('rect', { x: x - .5, y: y - .5, width: S - 2, height: S - 2, rx: 5, fill: 'none', stroke: C.green, 'stroke-width': 2 }, g);
    }
    label(g, 12, 176, 'green corrected, orange scarred', { a: 'start', size: 13, cls: 'soft' });
    label(g, 348, 176, 'grey still untouched', { a: 'end', size: 13, cls: 'soft' });

    el('path', { d: 'M16 280H348', stroke: C.line, fill: 'none' }, g);
    el('path', { d: `M16 ${Y(CEIL).toFixed(1)}H348`, stroke: C.green, 'stroke-dasharray': '5 4', fill: 'none' }, g);
    el('path', { d: `M16 ${Y(RATIO).toFixed(1)}H348`, stroke: C.blue, 'stroke-dasharray': '5 4', fill: 'none' }, g);
    /* anchored left, where the rising curve leaves the chart empty */
    label(g, 18, Y(RATIO) - 5, 'either copy alone: 76%', { a: 'start', size: 13, cls: 'soft' });
    /* below its line, so the two reference labels do not crowd each other */
    label(g, 18, Y(CEIL) + 15, 'both copies: 57%', { a: 'start', size: 13, cls: 'soft' });
    let path = '';
    for (let k = 1; k <= 8; k++) path += (k === 1 ? 'M' : 'L') + X(k).toFixed(1) + ' ' + Y(windowsOnly(k).done).toFixed(1);
    el('path', { d: path, fill: 'none', stroke: C.green, 'stroke-width': 2.5 }, g);
    el('circle', { cx: X(n), cy: Y(d[MS.indexOf('CC')]), r: 4.5, fill: C.green }, g);
    label(g, 16, 296, '1 window', { a: 'start', size: 13, cls: 'soft' });
    label(g, 348, 296, '8 windows', { a: 'end', size: 13, cls: 'soft' });

    win.textContent = (d[MS.indexOf('CC')] * 100).toFixed(1) + '%';
    lost.textContent = (d[MS.indexOf('CS')] * 100).toFixed(1) + '%';
  }
  slider(box, 'Editing windows', 1, 8, 1, 3, null, draw);
  draw(3);
}
