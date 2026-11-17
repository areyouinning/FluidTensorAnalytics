/* Counting the solutions of a small 3-SAT formula two ways, as in the claimed ETH refutation.
   1. Brute force: try every assignment (the grid of 2^n cells).
   2. Algebra: each clause becomes a polynomial Φ = 1 − Π(1 − ℓ) that is 1 when the clause holds and 0 when
      it fails; multiply every clause's Φ and add over all assignments. The product is 1 exactly on solutions,
      so the sum IS the count. Tap a cell to see its clause factors multiply out.
   "Two separate groups" makes a formula whose clauses never mix the two halves of the variables. Then the
   count is the product of the two halves' counts, which is the shortcut the new algorithms chase: they
   deform the formula so it nearly splits this way, and pay only for a few links between the groups. */
import { svg, el, clear, label, put, controls, slider, button, picker, readouts } from './kit.js';

const BLUE = 'var(--blue)', ORANGE = 'var(--orange)', GREEN = 'var(--green)', RED = 'var(--red)', INK = 'var(--ink)', SOFT = 'var(--ink-soft)', SUNK = 'var(--sunk)', LINE = 'var(--line)';
const rnd = n => Math.floor(Math.random() * n);

export default function (fig) {
  const s = svg(fig, 380, 214, 'Every assignment of the variables as a grid of cells, green where the formula is satisfied, and the clause factors for the chosen cell multiplied out.');
  const g = el('g', {}, s);
  const list = document.createElement('ol'); list.className = 'sat-clauses'; put(fig, list);
  const box = controls(fig), box2 = controls(fig);
  const [bruteR, algR, splitR] = readouts(fig, ['Brute force', 'Sum of clause products', 'Split into groups']);
  let n = 6, m = 7, mode = 0, F = [], pick = 0;

  function make() {   // a clause is a list of [variable, negated]
    F = [];
    const half = Math.floor(n / 2);
    for (let c = 0; c < m; c++) {
      const grp = mode === 1 ? c % 2 : -1, lo = grp === 1 ? half : 0, hi = grp === 0 ? half : n, k = Math.min(3, hi - lo);
      const vars = []; while (vars.length < k) { const v = lo + rnd(hi - lo); if (!vars.includes(v)) vars.push(v); }
      F.push(vars.sort((a, b) => a - b).map(v => [v, Math.random() < .5]));
    }
    pick = 0; draw();
  }
  const bit = (x, v) => (x >> (n - 1 - v)) & 1;
  const phi = (cl, x) => 1 - cl.reduce((p, [v, neg]) => p * (1 - (neg ? 1 - bit(x, v) : bit(x, v))), 1);   // Φ = 1 − Π(1 − ℓ)
  const sat = x => F.every(cl => cl.some(([v, neg]) => (neg ? 1 - bit(x, v) : bit(x, v)) === 1));       // plain logic, for brute force
  const name = v => 'x' + (v + 1);

  function draw() {
    clear(g);
    const N = 1 << n, cols = N <= 16 ? N : 16, cw = Math.min(22, 360 / cols), ch = Math.min(22, 120 / Math.ceil(N / cols)), x0 = (380 - cols * cw) / 2;
    let brute = 0, alg = 0;
    for (let x = 0; x < N; x++) {
      const ok = sat(x); if (ok) brute++;
      alg += F.reduce((p, cl) => p * phi(cl, x), 1);
      const c = x % cols, r = Math.floor(x / cols);
      const cell = el('rect', { x: x0 + c * cw + 1, y: 8 + r * ch + 1, width: cw - 2, height: ch - 2, rx: 3, fill: ok ? GREEN : SUNK, stroke: x === pick ? INK : LINE, 'stroke-width': x === pick ? 2.5 : 1, style: 'cursor:pointer', opacity: ok ? .85 : 1 }, g);
      cell.addEventListener('click', () => { pick = x; draw(); });
    }
    const gy = 8 + Math.ceil(N / cols) * ch + 22;
    const bits = Array.from({ length: n }, (_, v) => name(v) + '=' + bit(pick, v)).join('  ');
    label(g, 190, gy, 'Chosen assignment: ' + bits, { size: 11.5, w: 600 });
    const fac = F.map(cl => phi(cl, pick)), prod = fac.reduce((a, b) => a * b, 1);
    label(g, 190, gy + 22, 'Clause factors: ' + fac.join(' · ') + ' = ' + prod, { size: 13, w: 700, fill: prod ? GREEN : RED });
    label(g, 190, gy + 40, prod ? 'Every clause holds, so this assignment adds 1 to the count.' : 'A clause fails, its factor is 0, and the whole product is 0.', { size: 10.5, cls: 'soft' });
    list.innerHTML = F.map((cl, k) => '<li class="' + (fac[k] ? 'ok' : 'bad') + '"><b>' + (k + 1) + '</b> (' + cl.map(([v, neg]) => (neg ? '¬' : '') + name(v)).join(' ∨ ') + ')</li>').join('');
    s.setAttribute('viewBox', '0 0 380 ' + Math.ceil(gy + 50));   // fit the picture to the grid's height
    bruteR.textContent = brute + ' of ' + N + ' assignments';
    algR.textContent = alg + (alg === brute ? ' — the same count' : ' — MISMATCH');
    if (mode === 1) {
      const half = Math.floor(n / 2), A = F.filter(cl => cl.every(([v]) => v < half)), B = F.filter(cl => cl.every(([v]) => v >= half));
      const cnt = (cls, lo, hi) => { let t = 0; for (let y = 0; y < 1 << (hi - lo); y++) if (cls.every(cl => cl.some(([v, neg]) => { const b = (y >> (hi - 1 - v)) & 1; return (neg ? 1 - b : b) === 1; }))) t++; return t; };
      const a = cnt(A, 0, half), b = cnt(B, half, n);
      splitR.textContent = a + ' × ' + b + ' = ' + a * b + ' (checking ' + ((1 << half) + (1 << (n - half))) + ' instead of ' + N + ')';
    } else splitR.textContent = 'clauses mix the groups, so no shortcut';
  }
  slider(box, 'Variables ', 4, 8, 1, n, v => String(v), v => { n = v; make(); });
  slider(box, 'Clauses ', 2, 12, 1, m, v => String(v), v => { m = v; make(); });
  picker(box2, ['Any formula', 'Two separate groups'], 0, k => { mode = k; make(); });
  button(box2, 'New formula', make, 'go');
  make();
}
