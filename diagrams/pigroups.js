/* Buckingham π: pick the quantities a problem depends on; the page finds how many independent unit-free groups they make,
   one set of them (exact exponents, by fraction arithmetic), and the named numbers you can build from your picks.
   Dimensions are powers of mass M, length L, time T and temperature Θ. */
import { controls, button, readouts } from './kit.js';

export const VARS = [
  { k: 'ρ', name: 'density', d: [1, -3, 0, 0] }, { k: 'U', name: 'speed', d: [0, 1, -1, 0] }, { k: 'L', name: 'length', d: [0, 1, 0, 0] },
  { k: 'μ', name: 'viscosity', d: [1, -1, -1, 0] }, { k: 'ν', name: 'kinematic viscosity', d: [0, 2, -1, 0] }, { k: 'D', name: 'mass diffusivity', d: [0, 2, -1, 0] },
  { k: 'α', name: 'heat diffusivity', d: [0, 2, -1, 0] }, { k: 'g', name: 'gravity', d: [0, 1, -2, 0] }, { k: 'σ', name: 'surface tension', d: [1, 0, -2, 0] },
  { k: 'f', name: 'frequency', d: [0, 0, -1, 0] }, { k: 'c', name: 'speed of sound', d: [0, 1, -1, 0] }, { k: 'Δp', name: 'pressure difference', d: [1, -1, -2, 0] },
  { k: 'Ω', name: 'rotation rate', d: [0, 0, -1, 0] }, { k: 'h', name: 'heat transfer coefficient', d: [1, 0, -3, -1] }, { k: 'k', name: 'thermal conductivity', d: [1, 1, -3, -1] },
  { k: 'ΔT', name: 'temperature difference', d: [0, 0, 0, 1] }, { k: 'β', name: 'thermal expansion', d: [0, 0, 0, -1] }, { k: 'λ', name: 'mean free path', d: [0, 1, 0, 0] }
];
/* named numbers as exponents of the variables above */
export const NAMED = [
  { k: 'Reynolds', e: { ρ: 1, U: 1, L: 1, μ: -1 } }, { k: 'Reynolds', e: { U: 1, L: 1, ν: -1 } }, { k: 'Péclet', e: { U: 1, L: 1, D: -1 } }, { k: 'Péclet (heat)', e: { U: 1, L: 1, α: -1 } },
  { k: 'Prandtl', e: { ν: 1, α: -1 } }, { k: 'Schmidt', e: { ν: 1, D: -1 } }, { k: 'Lewis', e: { α: 1, D: -1 } }, { k: 'Froude', e: { U: 1, g: -.5, L: -.5 } },
  { k: 'Mach', e: { U: 1, c: -1 } }, { k: 'Strouhal', e: { f: 1, L: 1, U: -1 } }, { k: 'Weber', e: { ρ: 1, U: 2, L: 1, σ: -1 } }, { k: 'Capillary', e: { μ: 1, U: 1, σ: -1 } },
  { k: 'Bond', e: { ρ: 1, g: 1, L: 2, σ: -1 } }, { k: 'Euler', e: { 'Δp': 1, ρ: -1, U: -2 } }, { k: 'Rossby', e: { U: 1, Ω: -1, L: -1 } }, { k: 'Ekman', e: { ν: 1, Ω: -1, L: -2 } },
  { k: 'Nusselt', e: { h: 1, L: 1, k: -1 } }, { k: 'Grashof', e: { g: 1, β: 1, ΔT: 1, L: 3, ν: -2 } }, { k: 'Rayleigh', e: { g: 1, β: 1, ΔT: 1, L: 3, ν: -1, α: -1 } },
  { k: 'Knudsen', e: { λ: 1, L: -1 } }, { k: 'Womersley', e: { L: 1, f: .5, ν: -.5 } }
];

/* exact fractions */
const gcd = (a, b) => b ? gcd(b, a % b) : Math.abs(a);
const F = (n, d = 1) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d) || 1; return [n / g, d / g]; };
const fsub = (a, b) => F(a[0] * b[1] - b[0] * a[1], a[1] * b[1]), fmul = (a, b) => F(a[0] * b[0], a[1] * b[1]), fdiv = (a, b) => F(a[0] * b[1], a[1] * b[0]);
/* null space of the dimension matrix: every combination of the chosen variables whose units cancel */
export function piGroups(keys) {
  const vs = keys.map(k => VARS.find(v => v.k === k)), m = 4, n = vs.length;
  const A = Array.from({ length: m }, (_, r) => vs.map(v => F(v.d[r]))); const piv = []; let row = 0;
  for (let c = 0; c < n && row < m; c++) {
    let p = -1; for (let r = row; r < m; r++) if (A[r][c][0] !== 0) { p = r; break; } if (p < 0) continue;
    [A[row], A[p]] = [A[p], A[row]]; const v = A[row][c]; A[row] = A[row].map(x => fdiv(x, v));
    for (let r = 0; r < m; r++) if (r !== row && A[r][c][0] !== 0) { const f = A[r][c]; A[r] = A[r].map((x, j) => fsub(x, fmul(f, A[row][j]))); }
    piv.push(c); row++;
  }
  const free = [...Array(n).keys()].filter(c => !piv.includes(c));
  const groups = free.map(fc => { const e = Array(n).fill(null).map(() => F(0)); e[fc] = F(1); piv.forEach((pc, r) => { e[pc] = fsub(F(0), A[r][fc]); });
    const L = e.reduce((l, x) => l * x[1] / gcd(l, x[1]), 1); return e.map(x => x[0] * L / x[1]); });
  return { rank: piv.length, groups: groups.map(g => { const s = g.find(x => x !== 0) < 0 ? -1 : 1; return g.map(x => x * s); }), vs };
}
export function namedFrom(keys) { const seen = new Set(); return NAMED.filter(q => Object.keys(q.e).every(k => keys.includes(k))).filter(q => !seen.has(q.k) && seen.add(q.k)); }
const SUP = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '/': 'ᐟ', '.': '·' };
const pow = x => x === 1 ? '' : String(x).replace(/./g, ch => SUP[ch] || ch);
export const show = (vs, e) => { const t = vs.map((v, i) => e[i] ? v.k + pow(e[i]) : '').filter(Boolean); return t.length ? t.join(' ') : '1'; };

export default function (fig) {
  const pick = document.createElement('div'); pick.className = 'ctl'; fig.insertBefore(pick, fig.firstChild);
  const out = document.createElement('div'); out.setAttribute('aria-live', 'polite'); out.style.marginTop = '12px'; fig.insertBefore(out, fig.querySelector('figcaption'));
  const box = controls(fig), [nR, rR] = readouts(fig, ['Unit-free groups', 'Independent units used']);
  let on = new Set(['ρ', 'U', 'L', 'μ']);
  const btns = VARS.map(v => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = v.k + ' ' + v.name; b.addEventListener('click', () => { on.has(v.k) ? on.delete(v.k) : on.add(v.k); draw(); }); pick.appendChild(b); return b; });
  const preset = (label, ks) => button(box, label, () => { on = new Set(ks); draw(); });
  preset('Pipe flow', ['ρ', 'U', 'L', 'μ']); preset('Ship waves', ['U', 'L', 'g', 'ν']); preset('Droplet', ['ρ', 'U', 'L', 'μ', 'σ']); preset('Heated plate', ['g', 'β', 'ΔT', 'L', 'ν', 'α']); preset('Clear all', []);
  function draw() {
    btns.forEach((b, i) => b.setAttribute('aria-pressed', on.has(VARS[i].k)));
    const keys = VARS.map(v => v.k).filter(k => on.has(k));
    if (!keys.length) { out.innerHTML = '<p class="nojs">Pick the quantities your problem depends on.</p>'; nR.textContent = '–'; rR.textContent = '–'; return; }
    const { rank, groups, vs } = piGroups(keys), named = namedFrom(keys);
    nR.textContent = keys.length + ' quantities − ' + rank + ' = ' + groups.length; rR.textContent = String(rank);
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    out.innerHTML = (groups.length ? '<p style="margin:0 0 6px"><b>One set of groups:</b> ' + groups.map(g => '<code>' + esc(show(vs, g)) + '</code>').join(', ') + '</p>' : '<p style="margin:0 0 6px">No unit-free group: these quantities can\'t cancel each other\'s units.</p>') +
      (named.length ? '<p style="margin:0"><b>Named ones you can build:</b> ' + named.map(q => esc(q.k)).join(', ') + '</p>' : '');
  }
  draw();
}
