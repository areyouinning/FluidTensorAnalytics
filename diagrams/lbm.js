/* A lattice Boltzmann flow solver (D2Q9, BGK collisions). At low speeds its averages obey the 2D incompressible Navier-Stokes equations,
   which is why it is a standard way to compute vortex shedding. Everything shown is computed here, in your browser, as you watch.
   data-body="cylinder": flow past a fixed cylinder; the shedding frequency is measured from a probe in the wake.
   data-body="foil": a thin wing section that heaves up and down at a chosen Strouhal number; the push on it is measured.
   Units are lattice units: one cell, one step. Inflow speed U = 0.1 cells per step. */
import { controls, button, slider, readouts, calm } from './kit.js';

const EX = [0, 1, 0, -1, 0, 1, -1, -1, 1], EY = [0, 0, 1, 0, -1, 1, 1, -1, -1], WT = [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36], OPP = [0, 3, 4, 1, 2, 7, 8, 5, 6];
export const U0 = 0.1;

export class Flow {
  constructor(nx, ny, nu, u0 = U0) {
    this.nx = nx; this.ny = ny; this.n = nx * ny; this.u0 = u0; this.setNu(nu);
    this.f = new Float32Array(9 * this.n); this.g = new Float32Array(9 * this.n);
    this.rho = new Float32Array(this.n).fill(1); this.ux = new Float32Array(this.n); this.uy = new Float32Array(this.n);
    this.solid = new Uint8Array(this.n); this.bx = 0; this.by = 0; this.fx = 0; this.fy = 0; this.t = 0;
    for (let k = 0; k < this.n; k++) { const y = (k / nx) | 0; this.ux[k] = u0; this.uy[k] = 1e-3 * Math.sin(2 * Math.PI * y / ny); this.equil(k, 1, this.ux[k], this.uy[k], this.f); }
  }
  /* a brief sideways nudge in a patch of the wake, so an unstable wake starts shedding in seconds instead of minutes */
  kick(cx, cy, r, v) { for (let y = 0; y < this.ny; y++) for (let x = 0; x < this.nx; x++) { const d2 = (x - cx) ** 2 + (y - cy) ** 2; if (d2 > r * r * 4) continue; const k = y * this.nx + x; if (this.solid[k]) continue; const uy = this.uy[k] + v * Math.exp(-d2 / (r * r)); this.uy[k] = uy; this.equil(k, 1, this.ux[k], uy, this.f); } }
  setNu(nu) { this.nu = nu; this.omega = 1 / (3 * nu + 0.5); }
  equil(k, r, u, v, arr) { const uu = 1.5 * (u * u + v * v); for (let i = 0; i < 9; i++) { const eu = 3 * (EX[i] * u + EY[i] * v); arr[i * this.n + k] = WT[i] * r * (1 + eu + 0.5 * eu * eu - uu); } }
  /* a new body shape: cells that stop being solid start from the flow's state at the body's speed */
  setSolid(fn) { const { nx, ny } = this; for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) { const k = y * nx + x, s = fn(x, y) ? 1 : 0; if (this.solid[k] && !s) this.equil(k, 1, this.bx, this.by, this.f); this.solid[k] = s; } }
  step() {
    const { nx, ny, n, f, g, solid, rho, ux, uy, omega } = this; let Fx = 0, Fy = 0;
    for (let k = 0; k < n; k++) {
      if (solid[k]) continue;
      let r = 0, u = 0, v = 0;
      for (let i = 0; i < 9; i++) { const q = f[i * n + k]; r += q; u += q * EX[i]; v += q * EY[i]; }
      u /= r; v /= r; rho[k] = r; ux[k] = u; uy[k] = v;
      const uu = 1.5 * (u * u + v * v), x = k % nx, y = (k / nx) | 0;
      for (let i = 0; i < 9; i++) {
        const eu = 3 * (EX[i] * u + EY[i] * v), q = f[i * n + k] + omega * (WT[i] * r * (1 + eu + 0.5 * eu * eu - uu) - f[i * n + k]);
        const X = x + EX[i]; if (X < 0 || X >= nx) continue;
        const Y = (y + EY[i] + ny) % ny, j = Y * nx + X;
        if (solid[j]) {   // bounce back off the body, which may be moving; the momentum handed over is the force on it
          const back = q - 6 * WT[i] * r * (EX[i] * this.bx + EY[i] * this.by);
          g[OPP[i] * n + k] = back; Fx += EX[i] * (q + back); Fy += EY[i] * (q + back);
        } else g[i * n + j] = q;
      }
    }
    for (let y = 0; y < ny; y++) { const a = y * nx, b = a + nx - 1;
      this.equil(a, 1, this.u0, 0, g);                                         // inflow: a steady stream from the left
      for (let i = 0; i < 9; i++) g[i * n + b] = g[i * n + b - 1]; }      // outflow: the flow leaves as it arrives
    this.f = g; this.g = f; this.fx = Fx; this.fy = Fy; this.t++;
  }
  vort(k) { const { nx, ux, uy } = this, x = k % nx; if (x < 1 || x >= nx - 1) return 0; const up = (k + nx) % this.n, dn = (k - nx + this.n) % this.n; return (uy[k + 1] - uy[k - 1] - ux[up] + ux[dn]) / 2; }
}

export default function (fig) {
  const body = fig.getAttribute('data-body') || 'cylinder', NX = 260, NY = 100;
  const c = document.createElement('canvas'); c.width = NX; c.height = NY; c.className = 'd'; c.style.maxWidth = '100%'; c.style.borderRadius = '10px'; c.style.imageRendering = 'auto';
  c.setAttribute('role', 'img'); fig.insertBefore(c, fig.firstChild);
  const g2 = c.getContext('2d'), img = g2.createImageData(NX, NY), px = img.data;
  const probe = document.createElement('i'); probe.hidden = true; fig.appendChild(probe);
  const rgb = name => { probe.hidden = false; probe.style.color = `var(${name})`; const v = getComputedStyle(probe).color.match(/[\d.]+/g).map(Number); probe.hidden = true; return v; };
  let COL; const cols = () => { COL = { bg: rgb('--panel'), a: rgb('--blue'), b: rgb('--orange'), body: rgb('--ink') }; }; cols();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', cols);
  const box = controls(fig), S = { run: !calm(), budget: 14 };
  let sim, info;

  if (body === 'cylinder') {
    const D = 20, CX = 60, CY = NY / 2, P = { x: CX + 3 * D, y: CY };
    const [reR, stR, tR] = readouts(fig, ['Reynolds number', 'Strouhal number, measured', 'Vortices per tank pass']);
    let Re = 100, ups = [], lastV = 0, amp = 0;
    function make() { sim = new Flow(NX, NY, U0 * D / Re); sim.setSolid((x, y) => (x - CX) ** 2 + (y - CY - .5) ** 2 <= (D / 2) ** 2); sim.kick(CX + D, CY, 6, .03); ups = []; amp = 0; }
    info = () => { const k = P.y * NX + P.x, v = sim.uy[k]; amp = Math.max(amp * .9995, Math.abs(v));
      if (lastV <= 0 && v > 0 && sim.t > 2500 && amp > .01) ups.push(sim.t); lastV = v; if (ups.length > 8) ups.shift();   // time the swings once the shedding has grown
      reR.textContent = Re; const steady = sim.t > 9000 && amp < 2e-3;
      if (steady) { stR.textContent = 'none: the wake is steady'; tR.textContent = '0'; }
      else if (ups.length >= 4) { const T = (ups[ups.length - 1] - ups[1]) / (ups.length - 2), St = D / (T * U0); stR.textContent = St.toFixed(3); tR.textContent = (2 * NX / U0 / T).toFixed(1); }
      else { stR.textContent = 'settling…'; tR.textContent = '…'; } };
    slider(box, 'Reynolds number ', 30, 160, 10, Re, v => String(v), v => { Re = v; make(); });
    c.setAttribute('aria-label', 'Flow from the left past a cylinder, coloured by spin: blue one way, orange the other.');
    make();
  } else {
    const CH = 24, TH = 4, X0 = 60, H = 8, YC = NY / 2, UF = .08, RE = 100;   // chord, thickness, position, heave amplitude (peak-to-peak 16 cells), stream speed, Reynolds number on the chord
    const [stR, fR, wakeR] = readouts(fig, ['Strouhal number, f · A / U', 'Beats per tank pass', 'Wake speed, against the stream']);
    let St = 0.3, hist = [], stIn;
    const yAt = t => YC + H * Math.sin(2 * Math.PI * (St * UF / (2 * H)) * t);
    function shape() { const y0 = yAt(sim.t), vy = (yAt(sim.t + .5) - yAt(sim.t - .5)); sim.bx = 0; sim.by = vy; sim.setSolid((x, y) => ((x - X0) / (CH / 2)) ** 2 + ((y - y0) / (TH / 2)) ** 2 <= 1); }
    function make() { sim = new Flow(NX, NY, UF * CH / RE, UF); hist = []; shape(); const base = sim.step.bind(sim); sim.step = () => { shape(); base(); }; }   // the wing moves before every step
    const period = () => 2 * H / (St * UF);
    /* the wake's average speed in a box two to four chords behind the wing, over the last two beats: below 1 the wing trails slow fluid (a drag wake), above 1 it throws a jet */
    info = () => { const T = Math.round(period()); if (sim.t % 5 === 0) { let su = 0, n = 0; for (let y = YC - 3; y <= YC + 3; y++) for (let x = X0 + 2 * CH; x <= X0 + 4 * CH; x++) { su += sim.ux[y * NX + x]; n++; } hist.push(su / n / UF); const keep = Math.round(2 * T / 5); if (hist.length > keep) hist.splice(0, hist.length - keep); }
      stR.textContent = St.toFixed(2); fR.textContent = (NX / UF / period()).toFixed(1);
      if (sim.t < 4 * T || sim.t < 5000) { wakeR.textContent = 'settling…'; return; }
      const m = hist.reduce((a, b) => a + b, 0) / hist.length;
      wakeR.textContent = '× ' + m.toFixed(2) + (m < .97 ? ', slower: a drag wake' : m > 1.03 ? ', faster: a jet' : ', about even'); };
    stIn = slider(box, 'Strouhal number ', .05, .5, .01, St, v => v.toFixed(2), v => { St = v; make(); });
    window.addEventListener('fta:st', ev => { St = Math.max(.05, Math.min(.5, +ev.detail)); stIn.value = St; stIn.dispatchEvent(new Event('input')); fig.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'center' }); });
    c.setAttribute('aria-label', 'A wing section heaving up and down in a stream from the left, with its wake coloured by spin.');
    make();
  }
  const pause = button(box, S.run ? 'Pause' : 'Play', () => { S.run = !S.run; pause.textContent = S.run ? 'Pause' : 'Play'; });

  function draw() {
    const { nx, ny } = sim, sc = U0 / 6;
    for (let k = 0; k < nx * ny; k++) {
      const o = k * 4, B = COL.bg;
      if (sim.solid[k]) { px[o] = COL.body[0]; px[o + 1] = COL.body[1]; px[o + 2] = COL.body[2]; px[o + 3] = 255; continue; }
      const w = sim.vort(k) / sc, a = Math.min(1, Math.abs(w)), C = w > 0 ? COL.b : COL.a;
      px[o] = B[0] + (C[0] - B[0]) * a; px[o + 1] = B[1] + (C[1] - B[1]) * a; px[o + 2] = B[2] + (C[2] - B[2]) * a; px[o + 3] = 255;
    }
    g2.putImageData(img, 0, 0);
  }
  let seen = true; if ('IntersectionObserver' in window) new IntersectionObserver(es => { seen = es[0].isIntersecting; }).observe(c);
  (function loop() {
    if (seen && S.run) { const t0 = performance.now(); let k = 0; while (performance.now() - t0 < S.budget && k < 40) { sim.step(); info(); k++; } draw(); }
    requestAnimationFrame(loop);
  })();
  if (!S.run) { for (let k = 0; k < 4000; k++) { sim.step(); info(); } }
  draw();
  return { get sim() { return sim; }, S };
}
