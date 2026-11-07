/* Einstein notation, written out. data-view="ns": the Navier-Stokes equations in index form, expanded for each component.
   data-view="vec": a_i b_i and ε_ijk a_j b_k with your numbers, every term shown. */
import { controls, picker, readouts } from './kit.js';

const SUB = ['₁', '₂', '₃'];
export function expandNS(i, xyz, nondim) {
  const u = j => xyz ? ['u', 'v', 'w'][j] : 'u' + SUB[j], x = j => xyz ? ['x', 'y', 'z'][j] : 'x' + SUB[j], s = nondim ? '*' : '';
  const U = j => u(j) + s, X = j => x(j) + s, d = (a, b) => `∂${a}/∂${b}`, d2 = (a, b) => `∂²${a}/∂${b}²`;
  const lhs = `${d(U(i), 't' + s)} + ` + [0, 1, 2].map(j => `${U(j)} ${d(U(i), X(j))}`).join(' + ');
  const press = nondim ? `−${d('p' + s, X(i))}` : `−(1/ρ) ${d('p', X(i))}`;
  const visc = (nondim ? '(1/Re) ' : 'ν ') + '(' + [0, 1, 2].map(j => d2(U(i), X(j))).join(' + ') + ')';
  return { mom: `${lhs} = ${press} + ${visc}`, cont: [0, 1, 2].map(j => d(U(j), X(j))).join(' + ') + ' = 0' };
}
export function dotCross(a, b) {
  const eps = (i, j, k) => (i - j) * (j - k) * (k - i) / 2;   // +1 for an even order of 1 2 3, −1 for odd, 0 if any repeat
  const dot = a.reduce((s, x, i) => s + x * b[i], 0), terms = [];
  const cross = [0, 1, 2].map(i => { let s = 0; const t = []; for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) { const e = eps(i + 1, j + 1, k + 1); if (!e) continue; s += e * a[j] * b[k]; t.push((t.length ? (e > 0 ? ' + ' : ' − ') : (e > 0 ? '' : '−')) + `a${SUB[j]}b${SUB[k]}`); } terms.push(t.join('')); return s; });
  return { dot, cross, terms };
}

export default function (fig) {
  const out = document.createElement('div'); out.setAttribute('aria-live', 'polite'); out.style.cssText = 'font-size:17px;line-height:1.7;overflow-x:auto';
  fig.insertBefore(out, fig.firstChild);
  if (fig.getAttribute('data-view') === 'vec') return vec(fig, out);
  const S = { i: 0, xyz: false, nd: false }, box = controls(fig), box2 = controls(fig);
  const draw = () => { const e = expandNS(S.i, S.xyz, S.nd), s = S.nd ? '*' : '';
    out.innerHTML = `<p style="margin:0 0 6px;color:var(--ink-soft)">In index form, for every <span class="m">i</span>, summing over the repeated <span class="m">j</span>:</p>` +
      `<p style="margin:0 0 10px"><code>∂u${s}ᵢ/∂t${s} + u${s}ⱼ ∂u${s}ᵢ/∂x${s}ⱼ = ${S.nd ? '−∂p*/∂x*ᵢ + (1/Re)' : '−(1/ρ) ∂p/∂xᵢ + ν'} ∂²u${s}ᵢ/∂x${s}ⱼ∂x${s}ⱼ</code> &nbsp; and &nbsp; <code>∂u${s}ⱼ/∂x${s}ⱼ = 0</code></p>` +
      `<p style="margin:0 0 6px;color:var(--ink-soft)">Written out for <span class="m">i</span> = ${S.i + 1}:</p><p style="margin:0 0 6px"><code>${e.mom}</code></p><p style="margin:0"><code>${e.cont}</code></p>`; };
  picker(box, ['i = 1', 'i = 2', 'i = 3'], 0, k => { S.i = k; draw(); });
  picker(box2, ['x₁ x₂ x₃', 'x y z'], 0, k => { S.xyz = k === 1; draw(); });
  picker(box2, ['With units', 'Unit-free'], 0, k => { S.nd = k === 1; draw(); });
  draw();
}

function vec(fig, out) {
  const box = controls(fig), [dR, cR] = readouts(fig, ['a · b = aᵢ bᵢ', 'a × b, (a × b)ᵢ = εᵢⱼₖ aⱼ bₖ']);
  const a = [1, 2, 3], b = [4, 5, 6];
  const mk = (arr, name) => arr.forEach((v, i) => { const l = document.createElement('label'), inp = document.createElement('input'); inp.type = 'number'; inp.value = v; inp.step = 1; inp.style.cssText = 'width:4.5em;min-height:44px;font:inherit'; inp.setAttribute('aria-label', name + SUB[i]);
    l.append(name + SUB[i] + ' ', inp); l.style.flex = '0 0 auto'; inp.addEventListener('input', () => { arr[i] = +inp.value || 0; draw(); }); box.appendChild(l); });
  mk(a, 'a'); mk(b, 'b');
  const draw = () => { const r = dotCross(a, b);
    out.innerHTML = `<p style="margin:0 0 6px"><code>aᵢ bᵢ = a₁b₁ + a₂b₂ + a₃b₃ = ${a[0]}·${b[0]} + ${a[1]}·${b[1]} + ${a[2]}·${b[2]} = ${r.dot}</code></p>` +
      r.terms.map((t, i) => `<p style="margin:0"><code>(a × b)${SUB[i]} = ε${SUB[i]}ⱼₖ aⱼ bₖ = ${t} = ${r.cross[i]}</code></p>`).join('') +
      `<p style="margin:8px 0 0;color:var(--ink-soft)">Of the 27 terms ε${'ᵢⱼₖ'} aⱼ bₖ for each component, only two survive: ε is zero whenever an index repeats.</p>`;
    dR.textContent = String(r.dot); cR.textContent = '(' + r.cross.join(', ') + ')'; };
  draw();
}
