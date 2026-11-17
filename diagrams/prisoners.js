/* The 100 prisoners. Box i holds a slip with a number; every prisoner may open 50 boxes and all 100
   must find their own number. Strategy: start at the box with your own number and follow the slips.
   You are walking the loop (cycle) of the shuffle that contains your number, and you find it exactly
   when that loop is no longer than 50. So everyone succeeds iff the longest loop is <= 50, which has
   probability 1 - (1/51 + ... + 1/100) = 31.18%. Cells are coloured by loop; tap one to walk it. */
import { svg, el, clear, label, controls, button, readouts, rng } from './kit.js';

const BLUE = 'var(--blue)', GREEN = 'var(--green)', RED = 'var(--red)', ORANGE = 'var(--orange)', PURPLE = 'var(--purple)', INK = 'var(--ink)', SOFT = 'var(--ink-soft)', SUNK = 'var(--sunk)', LINE = 'var(--line)';
const N = 100, HALF = 50, CELL = 32, X0 = 30, Y0 = 8, HUES = [BLUE, PURPLE, ORANGE, GREEN];

function shuffle(R) { const p = Array.from({ length: N }, (_, i) => i); for (let i = N - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } return p; }
function loops(p) {   // every loop of the shuffle, longest first; also which loop each box is in
  const seen = new Array(N).fill(-1), out = [];
  for (let i = 0; i < N; i++) if (seen[i] < 0) { const c = []; let k = i; while (seen[k] < 0) { seen[k] = out.length; c.push(k); k = p[k]; } out.push(c); }
  const order = out.map((c, i) => i).sort((a, b) => out[b].length - out[a].length), rank = []; order.forEach((o, r) => { rank[o] = r; });
  return { list: order.map(o => out[o]), of: seen.map(sv => rank[sv]) };
}

export default function (fig) {
  const s = svg(fig, 380, 340, 'A ten by ten grid of numbered boxes coloured by which loop of the shuffle they belong to.');
  const g = el('g', {}, s);
  const box = controls(fig);
  const [loopR, roomR, runR] = readouts(fig, ['Longest loop', 'This room', 'Rooms so far']);
  let seed = 5, runSeed = 31337, perm, L, pick = -1, wins = 0, rooms = 0;

  function deal() { perm = shuffle(rng(seed)); L = loops(perm); pick = -1; rooms++; if (L.list[0].length <= HALF) wins++; }
  function draw() {
    clear(g);
    const longest = L.list[0].length, ok = longest <= HALF, walk = pick >= 0 ? L.list[L.of[pick]] : null;
    const step = {}; if (walk) { let k = pick, n = 1; do { step[k] = n++; k = perm[k]; } while (k !== pick); }
    for (let i = 0; i < N; i++) {
      const c = i % 10, r = Math.floor(i / 10), li = L.of[i], big = li === 0 && !ok, col = big ? RED : HUES[li % HUES.length], on = walk && step[i];
      const cell = el('rect', { x: X0 + c * CELL, y: Y0 + r * CELL, width: CELL - 3, height: CELL - 3, rx: 4, fill: 'color-mix(in srgb, ' + col + ' ' + (walk ? (on ? 75 : 12) : 45) + '%, var(--sunk))', stroke: i === pick ? INK : LINE, 'stroke-width': i === pick ? 2.5 : 1, style: 'cursor:pointer' }, g);
      cell.addEventListener('click', () => { pick = pick === i ? -1 : i; draw(); });
      el('text', { x: X0 + c * CELL + (CELL - 3) / 2, y: Y0 + r * CELL + (on ? 13 : 19), 'text-anchor': 'middle', 'font-size': on ? 9 : 11, 'font-weight': 600, style: 'pointer-events:none;fill:' + INK }, g, String(i + 1));
      if (on) el('text', { x: X0 + c * CELL + (CELL - 3) / 2, y: Y0 + r * CELL + 25, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 700, style: 'pointer-events:none;fill:' + INK }, g, '#' + step[i]);
    }
    loopR.textContent = longest + ' boxes' + (ok ? '' : ' (red)') + ', ' + L.list.length + ' loops in all';
    roomR.textContent = walk ? 'Prisoner ' + (pick + 1) + ' finds their number on box #' + walk.length + (walk.length <= HALF ? ': in time' : ': too late') : ok ? 'every loop fits in 50: all 100 go free' : (longest) + ' prisoners are on a loop longer than 50: all lose';
    runR.textContent = wins + ' of ' + rooms + ' freed (' + (100 * wins / rooms).toFixed(1) + '%)';
  }
  button(box, 'New shuffle', () => { seed = (seed * 48271) % 2147483647; deal(); draw(); }, 'go');
  button(box, 'Run 1000 rooms', () => { runSeed = (runSeed * 48271) % 2147483647; const R = rng(runSeed); for (let k = 0; k < 1000; k++) { rooms++; if (loops(shuffle(R)).list[0].length <= HALF) wins++; } draw(); });
  button(box, 'Reset count', () => { wins = L.list[0].length <= HALF ? 1 : 0; rooms = 1; draw(); });
  deal(); draw();
}
