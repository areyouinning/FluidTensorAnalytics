/* Energy moving through a small light-harvesting network: seven pigments, one exit to the reaction centre.
   The excitation is a quantum state (a 7×7 density matrix ρ). Its motion follows a master equation:
     dρ/dt = −(i/ħ)[H, ρ]  − γ·(off-diagonal ρ)  − κ{P_exit, ρ}  − 2Γρ
   H holds the pigment energies and couplings (cm⁻¹). γ is dephasing: the jiggling protein around the pigments washes out the phases.
   κ = 1 ps⁻¹ hands energy to the reaction centre at the exit; Γ = 1 ns⁻¹ loses it as light or heat anywhere.
   This network is made up for this page, with energy scales like the FMO protein's; it is not a fit to FMO.
   data-view="net": the network over time.  data-view="sweep": delivery against dephasing, solved exactly (no time-stepping). */
import { svg, el, clear, label, controls, button, slider, readouts, calm, C } from './kit.js';

const HB = 5.30884;   // ħ in cm⁻¹·ps
export const E = [240, 420, 0, 110, 270, 330, 200];
export const J = [[0, 1, -90], [1, 2, 30], [0, 2, 5], [2, 3, -55], [3, 4, -70], [4, 5, 80], [3, 6, -60], [5, 6, 40], [1, 5, 12], [0, 6, -10]];
export const N = 7, EXIT = 2, START = 0, KAP = 1, LOSS = 0.001;
const H = Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => i === j ? E[i] : 0)); J.forEach(([a, b, v]) => { H[a][b] = v; H[b][a] = v; });

/* the generator as a real matrix on (Re ρ, Im ρ) */
function Lmat(g) {
  const n = N * N, M = Array.from({ length: 2 * n }, () => new Float64Array(2 * n)), id = (i, j) => i * N + j;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const r = id(i, j);
    for (let k = 0; k < N; k++) {
      const a = H[i][k] / HB, b = H[k][j] / HB;
      if (a) { const c = id(k, j); M[r][n + c] += a; M[n + r][c] -= a; }
      if (b) { const c = id(i, k); M[r][n + c] -= b; M[n + r][c] += b; }
    }
    let d = 2 * LOSS; if (i !== j) d += g; if (i === EXIT) d += KAP; if (j === EXIT) d += KAP;
    M[r][r] -= d; M[n + r][n + r] -= d;
  }
  return M;
}
function solve(M, b) {
  const n = b.length, A = M.map((row, i) => { const r = Array.from(row); r.push(b[i]); return r; });
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]];
    const v = A[c][c]; for (let r = 0; r < n; r++) { if (r === c) continue; const f = A[r][c] / v; if (!f) continue; for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k]; }
  }
  return A.map((r, i) => r[n] / r[i]);
}
/* exact: ∫ρ dt solves L(X) = −ρ(0); delivered share = 2κ·X_exit,exit; mean time from a second solve */
export function deliver(g) {
  const n = N * N, M = Lmat(g), b = new Array(2 * n).fill(0); b[START * N + START] = -1;
  const X = solve(M, b), e = 2 * KAP * X[EXIT * N + EXIT], X2 = solve(M, X.map(v => -v));
  return { eta: e, tmean: 2 * KAP * X2[EXIT * N + EXIT] / e };
}

/* time-stepping for the picture (fourth-order Runge-Kutta on ρ, complex as pairs of arrays) */
function deriv(re, im, g, dre, dim) {
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    let sr = 0, si = 0;
    for (let k = 0; k < N; k++) { const a = H[i][k], b = H[k][j]; if (a) { sr += a * re[k * N + j]; si += a * im[k * N + j]; } if (b) { sr -= b * re[i * N + k]; si -= b * im[i * N + k]; } }
    let d = 2 * LOSS; if (i !== j) d += g; if (i === EXIT) d += KAP; if (j === EXIT) d += KAP;
    const r = i * N + j; dre[r] = si / HB - d * re[r]; dim[r] = -sr / HB - d * im[r];
  }
}
export function makeState() { const re = new Float64Array(N * N), im = new Float64Array(N * N); re[START * N + START] = 1; return { re, im, t: 0, got: 0 }; }
export function advance(S, g, T) {
  const n = N * N, k = [0, 1, 2, 3].map(() => [new Float64Array(n), new Float64Array(n)]), tr = new Float64Array(n), ti = new Float64Array(n);
  const dt = Math.min(0.002, 0.15 / Math.max(g, 1e-9)), steps = Math.max(1, Math.ceil(T / dt)), h = T / steps;
  for (let s = 0; s < steps; s++) {
    deriv(S.re, S.im, g, k[0][0], k[0][1]);
    for (let q = 0; q < n; q++) { tr[q] = S.re[q] + h / 2 * k[0][0][q]; ti[q] = S.im[q] + h / 2 * k[0][1][q]; } deriv(tr, ti, g, k[1][0], k[1][1]);
    for (let q = 0; q < n; q++) { tr[q] = S.re[q] + h / 2 * k[1][0][q]; ti[q] = S.im[q] + h / 2 * k[1][1][q]; } deriv(tr, ti, g, k[2][0], k[2][1]);
    for (let q = 0; q < n; q++) { tr[q] = S.re[q] + h * k[2][0][q]; ti[q] = S.im[q] + h * k[2][1][q]; } deriv(tr, ti, g, k[3][0], k[3][1]);
    const pe0 = S.re[EXIT * N + EXIT];
    for (let q = 0; q < n; q++) { S.re[q] += h / 6 * (k[0][0][q] + 2 * k[1][0][q] + 2 * k[2][0][q] + k[3][0][q]); S.im[q] += h / 6 * (k[0][1][q] + 2 * k[1][1][q] + 2 * k[2][1][q] + k[3][1][q]); }
    S.got += 2 * KAP * h * (pe0 + S.re[EXIT * N + EXIT]) / 2; S.t += h;
  }
}
export const coherence = S => { let c = 0; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (i !== j) c += Math.hypot(S.re[i * N + j], S.im[i * N + j]); return c; };

/* one dephasing value shared by both figures on the page */
const G = { v: 3, subs: [] }; const setG = v => { G.v = v; G.subs.forEach(f => f(v)); };
const fromSlider = s => s <= -2.05 ? 0 : Math.pow(10, s), toSlider = g => g <= 0 ? -2.1 : Math.log10(g);
const fmtG = g => g === 0 ? '0 (none)' : g < 1 ? g.toFixed(2) : g < 100 ? g.toFixed(1) : Math.round(g).toString();
function gSlider(box) {
  const s = slider(box, 'Dephasing γ, ps⁻¹ ', -2.1, 4, .05, toSlider(G.v), v => fmtG(fromSlider(v)), v => setG(fromSlider(v)));
  G.subs.push(g => { if (Math.abs(+s.value - toSlider(g)) > 1e-6) { s.value = toSlider(g); const o = s.parentNode.querySelector('output'); if (o) o.textContent = fmtG(g); } });
  return s;
}

const POS = [[70, 60], [160, 40], [250, 110], [180, 150], [100, 180], [40, 130], [150, 95]];

export default function (fig) {
  if (fig.getAttribute('data-view') === 'sweep') return sweep(fig);
  const s = svg(fig, 380, 300, 'Seven pigments joined by couplings, each circle sized by how much of the excitation sits on it, with an exit to the reaction centre.');
  const g = el('g', {}, s), box = controls(fig);
  const [tR, gotR, cohR] = readouts(fig, ['Time', 'Delivered so far', 'Coherence, Σ|ρᵢⱼ|']);
  gSlider(box);
  let S = makeState(), run = !calm(), hist = [];
  const restart = () => { S = makeState(); hist = []; };
  button(box, 'Start again', restart);
  const p = button(box, run ? 'Pause' : 'Play', () => { run = !run; p.textContent = run ? 'Pause' : 'Play'; });
  G.subs.push(restart);
  function draw() {
    clear(g);
    J.forEach(([a, b, v]) => el('path', { d: `M${POS[a][0]} ${POS[a][1]}L${POS[b][0]} ${POS[b][1]}`, stroke: C.line, 'stroke-width': Math.max(1, Math.abs(v) / 14), fill: 'none' }, g));
    el('path', { d: `M${POS[EXIT][0]} ${POS[EXIT][1]}L${POS[EXIT][0] + 70} ${POS[EXIT][1]}`, stroke: C.green, 'stroke-width': 4, 'stroke-dasharray': '6 4', fill: 'none' }, g);
    el('rect', { x: POS[EXIT][0] + 70, y: POS[EXIT][1] - 24, width: 52, height: 48, rx: 8, fill: C.green, opacity: .2 + .8 * S.got }, g);
    label(g, POS[EXIT][0] + 96, POS[EXIT][1] + 44, 'reaction', { size: 12, cls: 'soft' }); label(g, POS[EXIT][0] + 96, POS[EXIT][1] + 58, 'centre', { size: 12, cls: 'soft' });
    for (let i = 0; i < N; i++) { const pop = Math.max(0, S.re[i * N + i]);
      el('circle', { cx: POS[i][0], cy: POS[i][1], r: 13, fill: C.sunk }, g);
      el('circle', { cx: POS[i][0], cy: POS[i][1], r: 4 + 22 * Math.sqrt(pop), fill: C.orange, opacity: .85 }, g);
      label(g, POS[i][0], POS[i][1] + 5, String(i + 1), { size: 13, w: 600 }); }
    /* the last 2 ps of how much sits on the start pigment and on the exit, and how much has been delivered */
    const x0 = 16, y0 = 284, w = 348, h = 64, Tw = 2;
    el('path', { d: `M${x0} ${y0}H${x0 + w}`, stroke: C.line, fill: 'none' }, g);
    const line = (key, col) => { let d = ''; hist.forEach((q, k) => { const x = x0 + (q.t - Math.max(0, S.t - Tw)) / Tw * w, y = y0 - q[key] * h; d += (k ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); }); el('path', { d, stroke: col, 'stroke-width': 2, fill: 'none' }, g); };
    line('a', C.orange); line('e', C.purple); line('got', C.green);
    label(g, x0, y0 - h - 6, 'orange: on pigment 1 · purple: on pigment 3 · green: delivered', { a: 'start', size: 11, cls: 'soft' });
    tR.textContent = (S.t * 1000).toFixed(0) + ' fs'; gotR.textContent = (S.got * 100).toFixed(1) + '%'; cohR.textContent = coherence(S).toFixed(2);
  }
  let seen = true; if ('IntersectionObserver' in window) new IntersectionObserver(es => { seen = es[0].isIntersecting; }).observe(s);
  (function loop() {
    if (seen && run && S.t < 20) { advance(S, G.v, 0.004); hist.push({ t: S.t, a: S.re[START * N + START], e: S.re[EXIT * N + EXIT], got: S.got }); while (hist.length && hist[0].t < S.t - 2) hist.shift(); draw(); }
    requestAnimationFrame(loop);
  })();
  if (!run) { for (let k = 0; k < 250; k++) { advance(S, G.v, 0.004); hist.push({ t: S.t, a: S.re[0], e: S.re[EXIT * N + EXIT], got: S.got }); } }
  draw();
}

function sweep(fig) {
  const s = svg(fig, 380, 250, 'The share of the energy delivered to the reaction centre, against how strongly the surroundings dephase the pigments.');
  const g = el('g', {}, s), box = controls(fig);
  const [etaR, tR, lifeR] = readouts(fig, ['Delivered', 'Average time to the exit', 'Coherence lifetime, 1/γ']);
  gSlider(box);
  const xs = []; for (let v = -2; v <= 4.0001; v += .1) xs.push(+v.toFixed(2));
  const pts = xs.map(v => ({ v, ...deliver(Math.pow(10, v)) })), zero = deliver(0);
  const X = v => 46 + (v + 2.4) / 6.4 * 320, lo = .55, Y = e => 200 - (e - lo) / (1 - lo) * 180;
  function draw() {
    clear(g);
    [.6, .7, .8, .9, 1].forEach(e => { el('path', { d: `M46 ${Y(e)}H366`, stroke: C.line, fill: 'none' }, g); label(g, 40, Y(e) + 4, Math.round(e * 100) + '%', { a: 'end', size: 11, cls: 'soft' }); });
    [-2, -1, 0, 1, 2, 3, 4].forEach(v => label(g, X(v), 218, v === 0 ? '1' : '10' + (v < 0 ? '⁻' : '') + '⁰¹²³⁴'[Math.abs(v)], { size: 11, cls: 'soft' }));
    label(g, 206, 240, 'dephasing γ, per picosecond (log scale)', { size: 12, cls: 'soft' });
    el('circle', { cx: X(-2.4), cy: Y(zero.eta), r: 4, fill: C.soft }, g); label(g, X(-2.4) + 2, Y(zero.eta) + 18, 'none', { size: 11, cls: 'soft' });
    let d = ''; pts.forEach((p, k) => d += (k ? 'L' : 'M') + X(p.v).toFixed(1) + ' ' + Y(p.eta).toFixed(1)); el('path', { d, stroke: C.blue, 'stroke-width': 3, fill: 'none' }, g);
    const gv = G.v, r = deliver(gv), xv = gv > 0 ? Math.log10(gv) : -2.4;
    el('circle', { cx: X(Math.max(-2.4, Math.min(4, xv))), cy: Y(r.eta), r: 7, fill: C.orange, stroke: C.panel, 'stroke-width': 2 }, g);
    etaR.textContent = (r.eta * 100).toFixed(1) + '%'; tR.textContent = r.tmean.toFixed(1) + ' ps';
    lifeR.textContent = gv === 0 ? 'forever' : 1000 / gv >= 1000 ? (1 / gv).toFixed(1) + ' ps' : (1000 / gv).toFixed(1) + ' fs';
  }
  G.subs.push(draw); draw();
}
