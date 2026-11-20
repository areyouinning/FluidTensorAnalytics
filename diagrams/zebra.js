/* A small zebra puzzle. Four people; each has one home, one pet and one favorite color, and no two
   share any of them. Tap a cell to cycle its value. Each column, once filled without repeats, is a
   permutation matrix (who x value): exactly one dot in every row and column. Clues such as "the camel
   lives in the shack" never mention a person; they are statements about the PRODUCT of two of those
   matrices (home x pet), which the fourth grid computes live. Eight clues, one solution (checked by
   brute force over all 24^3 assignments). */
import { svg, el, clear, label, put, controls, button, readouts } from './kit.js';

const BLUE = 'var(--blue)', ORANGE = 'var(--orange)', GREEN = 'var(--green)', RED = 'var(--red)', INK = 'var(--ink)', SOFT = 'var(--ink-soft)', LINE = 'var(--line)', SUNK = 'var(--sunk)', PANEL = 'var(--panel)';
const WHO = ['Ada', 'Bo', 'Cy', 'Dee'];
const VALS = [['shack', 'yurt', 'houseboat', 'treehouse'], ['camel', 'zebra', 'owl', 'newt'], ['red', 'blue', 'green', 'gold']];
const HEAD = ['Home', 'Pet', 'Color'], HUE = [BLUE, ORANGE, GREEN];
const SOLUTION = [[1, 0, 2, 3], [2, 0, 3, 1], [1, 3, 2, 0]];
// a clue returns true (holds), false (broken) or null (cannot tell yet)
const link = (A, a, B, b, want = true) => s => {
  const i = s[A].indexOf(a), j = s[B].indexOf(b);
  if (i >= 0 && s[B][i] >= 0) return (s[B][i] === b) === want;
  if (j >= 0 && s[A][j] >= 0) return (s[A][j] === a) === want;
  return null;
};
const is = (i, A, a, want = true) => s => s[A][i] < 0 ? null : (s[A][i] === a) === want;
const CLUES = [
  ['The camel lives in the shack.', link(1, 0, 0, 0)],
  ['Ada likes blue.', is(0, 2, 1)],
  ['Whoever lives on the houseboat likes green.', link(0, 2, 2, 2)],
  ['Dee does not live in the shack.', is(3, 0, 0, false)],
  ['The owl’s keeper likes blue.', link(1, 2, 2, 1)],
  ['Cy keeps the newt.', is(2, 1, 3)],
  ['The zebra does not live on the houseboat.', link(1, 1, 0, 2, false)],
  ['Whoever lives in the treehouse likes red.', link(0, 3, 2, 0)]
];

export default function (fig) {
  const s = svg(fig, 380, 286, 'A table of four people with a home, pet and color each, above four small grids showing the same choices as matrices.');
  const g = el('g', {}, s);
  const list = document.createElement('ol'); list.className = 'zb-clues'; put(fig, list);
  const box = controls(fig);
  const [stateR] = readouts(fig, ['Status']);
  let st = [[-1, -1, -1, -1], [-1, -1, -1, -1], [-1, -1, -1, -1]];
  const COLX = [70, 176, 270], COLW = [102, 90, 102];

  function draw() {
    clear(g);
    HEAD.forEach((h, a) => label(g, COLX[a] + COLW[a] / 2, 16, h, { size: 12, w: 700, fill: HUE[a] }));
    WHO.forEach((w, i) => {
      const y = 24 + i * 32;
      label(g, 10, y + 19, w, { a: 'start', size: 15, w: 700 });
      for (let a = 0; a < 3; a++) {
        const v = st[a][i], dup = v >= 0 && st[a].filter(x => x === v).length > 1;
        const cell = el('g', { role: 'button', tabindex: '0', 'aria-label': w + ' ' + HEAD[a] + ': ' + (v < 0 ? 'not set' : VALS[a][v]), style: 'cursor:pointer' }, g);
        el('rect', { x: COLX[a], y, width: COLW[a] - 6, height: 26, rx: 7, fill: v < 0 ? SUNK : 'color-mix(in srgb, ' + HUE[a] + ' 22%, var(--panel))', stroke: dup ? RED : v < 0 ? LINE : HUE[a], 'stroke-width': dup ? 2.5 : 1.5 }, cell);
        label(cell, COLX[a] + (COLW[a] - 6) / 2, y + 18, v < 0 ? '?' : VALS[a][v], { size: 13, w: 600, cls: v < 0 ? 'soft' : '' });
        const cyc = () => { st[a][i] = st[a][i] >= 3 ? -1 : st[a][i] + 1; draw(); const again = g.querySelectorAll('[role=button]')[i * 3 + a]; if (again) again.focus({ preventScroll: true }); };
        cell.addEventListener('click', cyc);
        cell.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cyc(); } });
      }
    });
    // the same choices as matrices: who x value, and the product home x pet
    const C = 13, Y = 196, mats = [[28, 'who × home', 0], [118, 'who × pet', 1], [208, 'who × color', 2]];
    const grid = (x, title, on, hue, rows, cols) => {
      label(g, x + 2 * C, Y - 22, title, { size: 10.5, w: 600, fill: hue });
      for (let c = 0; c < 4; c++) label(g, x + c * C + C / 2, Y - 6, cols[c], { size: 8, cls: 'soft' });
      for (let r = 0; r < 4; r++) {
        label(g, x - 4, Y + r * C + 10, rows[r], { a: 'end', size: 8, cls: 'soft' });
        for (let c = 0; c < 4; c++) {
          el('rect', { x: x + c * C, y: Y + r * C, width: C - 1, height: C - 1, rx: 2, fill: SUNK }, g);
          if (on(r, c)) el('circle', { cx: x + c * C + C / 2 - .5, cy: Y + r * C + C / 2 - .5, r: 4, fill: hue }, g);
        }
      }
    };
    const ini = a => VALS[a].map(v => v.slice(0, 2));
    mats.forEach(([x, t, a]) => grid(x, t, (r, c) => st[a][r] === c, HUE[a], WHO.map(w => w[0]), ini(a)));
    grid(310, 'home × pet', (r, c) => WHO.some((_, i) => st[0][i] === r && st[1][i] === c), INK, ini(0), ini(1));
    label(g, 190, 272, 'Clue 1 is the top-left cell of the last grid: shack × camel.', { size: 10.5, cls: 'soft' });

    const res = CLUES.map(c => c[1](st)), full = st.every(col => col.every(v => v >= 0)), perm = st.every(col => new Set(col).size === 4);
    list.innerHTML = CLUES.map((c, k) => '<li class="' + (res[k] === true ? 'ok' : res[k] === false ? 'bad' : '') + '">' + c[0] + '</li>').join('');
    const broken = res.filter(r => r === false).length;
    stateR.textContent = full && perm && !broken ? 'Solved. Dee keeps the zebra, in the treehouse.' : broken ? broken + (broken === 1 ? ' clue is' : ' clues are') + ' broken' : !perm && st.some(col => col.filter(v => v >= 0).length !== new Set(col.filter(v => v >= 0)).size) ? 'two people share something (red outline)' : res.filter(r => r === true).length + ' of 8 clues satisfied so far';
  }
  button(box, 'Clear', () => { st = st.map(() => [-1, -1, -1, -1]); draw(); });
  button(box, 'Show the answer', () => { st = SOLUTION.map(c => c.slice()); draw(); });
  draw();
}
