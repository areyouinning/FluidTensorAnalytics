/* The home page's spinning drop: a fluid planet you can spin and dye.
   Shape: a spinning, self-gravitating fluid body is a Maclaurin spheroid. Its eccentricity e follows the spin exactly,
     Ω² / (π G ρ) = 2√(1−e²)(3−2e²) arcsin(e) / e³ − 6(1−e²)/e²,
   at constant volume (a²c fixed). Here Ω on screen maps to Ω²/(πGρ) up to 0.37, just short of the point (0.374) where a
   Maclaurin spheroid gives way to a Jacobi ellipsoid, so the shape runs from a sphere to about 0.58 as tall as wide.
   Surface flow, three parts, all worked out on the sphere in 3D (the oblateness is ignored for the flow):
   1. Spin-up: when the spin changes, the surface layer lags, and each latitude catches up on its Ekman time
      τ = H/√(ν Ω |sin φ|): quick near the poles, slow at the equator, so dye shears into streaks.
   2. A weak overturning from the same spin-up: poleward while spinning up, equatorward while spinning down.
   3. Swirls: a few point vortices, which carry each other around as point vortices on a sphere do
      (velocity Γ/(4π) · (x_k × x)/(1 − x_k·x), smoothed over a small core), and ride the spin-up shear too.
   Dye is carried by semi-Lagrangian advection along great circles with a MacCormack correction, which keeps it sharp,
   and a global mass fixer, as weather models use, so the total amount of dye stays put (apart from a slow fade). */
import { calm } from './kit.js';

const NX = 192, NY = 96;                               // dye grid: longitude × latitude
const TILT = 22 * Math.PI / 180;                       // the spin axis tipped toward you
const T0 = 2.6, OMIN = .15, SMIN = .12, K_OVER = .06;  // τ = T0/√(max(|Ω|,OMIN)·max(|sin φ|,SMIN)); overturning strength
const OMEGA0 = .45, OMAX = 5, QMAX = .37;              // resting spin; the screen spin that maps to Ω²/(πGρ) = QMAX
const CORE2 = .05 * .05, FADE = 1 / 150;               // vortex core (squared chord); dye fades with a 150 s e-folding

/* Maclaurin: q = Ω²/(πGρ) as a function of eccentricity, and its inverse by bisection (q rises with e up to e ≈ 0.93) */
export function maclaurinQ(e) { if (e < 1e-4) return 0; const s = Math.sqrt(1 - e * e); return 2 * s * (3 - 2 * e * e) * Math.asin(e) / (e ** 3) - 6 * (1 - e * e) / (e * e); }
export function eccentricity(q) { let lo = 0, hi = .929; for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (maclaurinQ(m) < q) lo = m; else hi = m; } return (lo + hi) / 2; }
export const ratioFor = Om => Math.sqrt(1 - eccentricity(QMAX * Math.min(1, (Om / OMAX) ** 2)) ** 2);   // c/a for a screen spin

export default function (fig) {
  const c = document.createElement('canvas');
  c.setAttribute('role', 'img');
  c.setAttribute('aria-label', 'A spinning fluid planet that flattens as it spins faster. Drag to spin it; tap to drop orange or blue dye, which swirls in eddies and shears into streaks.');
  fig.insertBefore(c, fig.firstChild);
  const g = c.getContext('2d');
  const probe = document.createElement('i'); fig.appendChild(probe);
  const rgb = name => { probe.style.color = `var(${name})`; return getComputedStyle(probe).color.match(/[\d.]+/g).slice(0, 3).map(Number); };
  let COL = {};
  const colors = () => { const pa = rgb('--panel'), ik = rgb('--ink'), dark = pa[0] + pa[1] + pa[2] < 300;
    COL = { bg: rgb('--sunk'), base: pa.map((v, n) => v + (ik[n] - v) * (dark ? .32 : 0)), line: rgb('--line'), o: rgb('--orange'), b: rgb('--blue') }; };
  colors(); addEventListener('fta-theme', () => { colors(); draw(); });

  /* grid cells as unit vectors (body frame, z = spin axis) */
  const dl = 2 * Math.PI / NX, dp = Math.PI / NY, N = NX * NY;
  const lat = new Float64Array(NY), PX3 = new Float64Array(N * 3);
  for (let j = 0; j < NY; j++) { lat[j] = -Math.PI / 2 + (j + .5) * dp; for (let i = 0; i < NX; i++) { const k = (j * NX + i) * 3, l = i * dl, cp = Math.cos(lat[j]);
    PX3[k] = cp * Math.cos(l); PX3[k + 1] = cp * Math.sin(l); PX3[k + 2] = Math.sin(lat[j]); } }
  const dye = [new Float32Array(N), new Float32Array(N)], hat = new Float32Array(N), back = new Float32Array(N);
  const dep = new Float32Array(N * 2), arr = new Float32Array(N * 2);   // departure and arrival points, as fractional (i, j)
  const wf = new Float64Array(NY), area = new Float64Array(NY);
  for (let j = 0; j < NY; j++) area[j] = Math.cos(-Math.PI / 2 + (j + .5) * Math.PI / NY);
  const mass = ch => { let t = 0; for (let j = 0; j < NY; j++) { let r = 0; for (let i = 0, k = j * NX; i < NX; i++, k++) r += ch[k]; t += r * area[j]; } return t; };
  let KO = K_OVER, Om = calm() ? 0 : OMEGA0, theta = 0, ink = 0, ratio = ratioFor(Om);
  wf.fill(Om);

  /* point vortices: unit vector and circulation; equal numbers of each sign, so they pair up and wander */
  const V = [[.6, .9, 1.1], [-.4, 2.4, -1.1], [.25, 4.1, .9], [-.7, 5.2, -.9], [.9, 3.3, .8], [-.15, .4, -.8]].map(([la, lo, G]) => ({ x: [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)], G }));

  /* controls */
  const bar = document.createElement('div'); bar.className = 'pond-ctl';
  bar.innerHTML = '<button type="button" data-k="0" aria-pressed="true"><i style="background:var(--orange)"></i>Orange</button><button type="button" data-k="1" aria-pressed="false"><i style="background:var(--blue)"></i>Blue</button><button type="button" data-k="x">Clear</button>';
  fig.appendChild(bar);
  bar.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const k = b.dataset.k;
    if (k === 'x') { dye[0].fill(0); dye[1].fill(0); draw(); return; }
    ink = +k; bar.querySelectorAll('[data-k="0"],[data-k="1"]').forEach(x => x.setAttribute('aria-pressed', x.dataset.k === k)); });

  /* per-pixel geometry for the current shape: grid position (fractional row, view longitude) and shading */
  let W = 0, H = 0, R = 0, R0 = 0, cx = 0, cy = 0, img = null, PX = null, shapeAt = -1;
  const norm = v => { const m = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / m, v[1] / m, v[2] / m]; };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  function size() {
    const r = c.getBoundingClientRect(), s = Math.min(1.5, (devicePixelRatio || 1)) * .8;
    W = Math.max(160, Math.round(r.width * s)); H = Math.max(90, Math.round(r.height * s)); c.width = W; c.height = H;
    img = g.createImageData(W, H); cx = W / 2; cy = H / 2;
    /* equal-volume radius that keeps the flattest shape inside the frame */
    const rmin = ratioFor(OMAX), aMax = Math.pow(rmin, -1 / 3), st = Math.sin(TILT), ct = Math.cos(TILT);
    const vFlat = aMax * Math.sqrt(rmin * rmin * ct * ct + st * st);
    R0 = Math.min(H * .45 / Math.max(1, vFlat), W * .46 / aMax);
    shapeAt = -1; shape();
  }
  function shape() {
    if (Math.abs(ratio - shapeAt) < .004) return; shapeAt = ratio;
    const a = Math.pow(ratio, -1 / 3), cz = a * ratio;                 // a²c = 1: the volume stays the same
    R = R0; const st = Math.sin(TILT), ct = Math.cos(TILT), L = norm([-.45, .55, .7]), hv = norm([L[0], L[1], L[2] + 1]), list = [];
    const qa = ct * ct / (a * a) + st * st / (cz * cz), k2 = 2 * st * ct * (1 / (cz * cz) - 1 / (a * a));
    for (let py = 0; py < H; py++) { const y = -(py + .5 - cy) / R; for (let px = 0; px < W; px++) {
      const x = (px + .5 - cx) / R, qb = y * k2, qc = x * x / (a * a) + y * y * st * st / (a * a) + y * y * ct * ct / (cz * cz) - 1, disc = qb * qb - 4 * qa * qc;
      if (disc < 0) continue;
      const z = (-qb + Math.sqrt(disc)) / (2 * qa), X = x, Y = -y * st + z * ct, Z = y * ct + z * st;
      const n = norm([X / (a * a), Y / (a * a), Z / (cz * cz)]), ns = [n[0], -n[1] * st + n[2] * ct, n[1] * ct + n[2] * st];
      const phi = Math.atan2(Z / (cz * cz), Math.hypot(X, Y) / (a * a));   // the latitude that the flow grid uses
      list.push(py * W + px, (phi + Math.PI / 2) / dp - .5, Math.atan2(Y, X), .38 + .62 * Math.max(0, dot(ns, L)), .4 * Math.pow(Math.max(0, dot(ns, hv)), 90), Math.min(1, Math.max(0, ns[2]) * 3));
    } }
    PX = new Float64Array(list);
  }

  /* bilinear sample of the grid at fractional (fi, fj): longitude wraps, latitude clamps */
  function samp(ch, fi, fj) {
    fj = Math.max(0, Math.min(NY - 1.0001, fj)); fi = ((fi % NX) + NX) % NX;
    const i = Math.floor(fi), j = Math.floor(fj), ti = fi - i, tj = fj - j, i1 = (i + 1) % NX, r0 = j * NX, r1 = r0 + NX;
    return (ch[r0 + i] * (1 - ti) + ch[r0 + i1] * ti) * (1 - tj) + (ch[r1 + i] * (1 - ti) + ch[r1 + i1] * ti) * tj;
  }
  let LO = 0, HI = 0;
  function mm(ch, fi, fj) {   // min and max of the four cells around a point, for the MacCormack limiter
    fj = Math.max(0, Math.min(NY - 1.0001, fj)); fi = ((fi % NX) + NX) % NX;
    const i = Math.floor(fi), j = Math.floor(fj), i1 = (i + 1) % NX, a = ch[j * NX + i], b = ch[j * NX + i1], c2 = ch[(j + 1) * NX + i], d = ch[(j + 1) * NX + i1];
    LO = Math.min(a, b, c2, d); HI = Math.max(a, b, c2, d);
  }
  const toIJ = (x, y, z, out, k) => { const m = Math.hypot(x, y, z); out[k] = (Math.atan2(y, x) / dl + NX) % NX; out[k + 1] = (Math.asin(Math.max(-1, Math.min(1, z / m))) + Math.PI / 2) / dp - .5; };
  /* move p along the great circle in the direction of U by an arc of |U|·h (h < 0 goes back): exact on the sphere, no drift in latitude */
  function slide(p0, p1, p2, h, out, k) { const sp = Math.hypot(U[0], U[1], U[2]); if (sp < 1e-12) { toIJ(p0, p1, p2, out, k); return; }
    const a = sp * h, c1 = Math.cos(a), s1 = Math.sin(a) / sp; toIJ(p0 * c1 + U[0] * s1, p1 * c1 + U[1] * s1, p2 * c1 + U[2] * s1, out, k); }

  /* the surface velocity at a unit vector (p0, p1, p2) in latitude row j: spin-up, overturning, vortices */
  const U = [0, 0, 0];
  function vel(p0, p1, p2, j, skip) {
    const w = wf[j] - Om, cl = Math.max(.05, Math.hypot(p0, p1));
    let u0 = -w * p1, u1 = w * p0, u2 = 0;                                             // (ω − Ω) ẑ × p
    const vn = -KO * w * Math.sin(2 * lat[j]);                                      // northward rate
    u0 += vn * (-p2 * p0 / cl); u1 += vn * (-p2 * p1 / cl); u2 += vn * cl;              // along local north
    for (const v of V) { if (v === skip) continue; const x = v.x, d = 1 - (x[0] * p0 + x[1] * p1 + x[2] * p2) + CORE2, s = v.G / (4 * Math.PI * d);
      u0 += s * (x[1] * p2 - x[2] * p1); u1 += s * (x[2] * p0 - x[0] * p2); u2 += s * (x[0] * p1 - x[1] * p0); }
    U[0] = u0; U[1] = u1; U[2] = u2;
  }
  const rowOf = z => Math.max(0, Math.min(NY - 1, Math.round((Math.asin(Math.max(-1, Math.min(1, z))) + Math.PI / 2) / dp - .5)));
  function step(dt) {
    /* the container's spin, each latitude's catch-up, and the shape */
    for (let j = 0; j < NY; j++) { const s = Math.abs(Math.sin(lat[j])), tau = T0 / Math.sqrt(Math.max(Math.abs(Om), OMIN) * Math.max(s, SMIN)); wf[j] = Om + (wf[j] - Om) * Math.exp(-dt / tau); }
    if (!dragging && !calm()) Om += (OMEGA0 - Om) * (1 - Math.exp(-dt / 25));
    if (!dragging) theta += Om * dt;
    ratio += (ratioFor(Math.abs(Om)) - ratio) * (1 - Math.exp(-dt / .35));            // the body settles to its new shape
    shape();
    /* move the vortices: each is carried by the others and by the shear, never by itself */
    const moved = V.map(v => { const p = v.x; vel(p[0], p[1], p[2], rowOf(p[2]), v); return norm([p[0] + U[0] * dt, p[1] + U[1] * dt, p[2] + U[2] * dt]); });
    V.forEach((v, n) => v.x = moved[n]);
    /* departure (−u dt) and arrival (+u dt) points for every cell */
    for (let j = 0, k = 0; j < NY; j++) for (let i = 0; i < NX; i++, k++) {
      const q = k * 3, p0 = PX3[q], p1 = PX3[q + 1], p2 = PX3[q + 2]; vel(p0, p1, p2, j, null);
      slide(p0, p1, p2, -dt, dep, k * 2); slide(p0, p1, p2, dt, arr, k * 2); }
    const fade = Math.exp(-dt * FADE);
    for (const ch of dye) {
      const before = mass(ch);
      for (let k = 0; k < N; k++) hat[k] = samp(ch, dep[2 * k], dep[2 * k + 1]);
      for (let k = 0; k < N; k++) back[k] = samp(hat, arr[2 * k], arr[2 * k + 1]);
      for (let k = 0; k < N; k++) { mm(ch, dep[2 * k], dep[2 * k + 1]); let v = hat[k] + .5 * (ch[k] - back[k]); if (v < LO) v = LO; if (v > HI) v = HI; back[k] = v * fade; }   // into a spare buffer: the limiter still reads the old field
      ch.set(back);
      const after = mass(ch); if (after > 1e-9) { const f = before * fade / after; for (let k = 0; k < N; k++) ch[k] = Math.min(1, ch[k] * f); }   // global mass fixer
    }
  }

  function draw() {
    if (!PX) return;
    const d = img.data, bg = COL.bg, base = COL.base, o = COL.o, bl = COL.b, ln = COL.line;
    for (let q = 0; q < d.length; q += 4) { d[q] = bg[0]; d[q + 1] = bg[1]; d[q + 2] = bg[2]; d[q + 3] = 255; }
    for (let p = 0; p < PX.length; p += 6) {
      const k = PX[p] * 4, fj = PX[p + 1], lam = PX[p + 2] - theta, fi = lam / dl, sh = PX[p + 3], sp = PX[p + 4], edge = PX[p + 5];
      const ao = 1 - Math.exp(-3.5 * samp(dye[0], fi, fj)), ab = 1 - Math.exp(-3.5 * samp(dye[1], fi, fj));   // thin filaments stay visible
      let m = ((lam % (Math.PI / 6)) + Math.PI / 6) % (Math.PI / 6); m = Math.min(m, Math.PI / 6 - m) / dl;
      const grid = Math.max(m < .45 ? .45 : 0, Math.abs(fj - (NY / 2 - .5)) < .55 ? .45 : 0);
      for (let n = 0; n < 3; n++) { let v = base[n] * (1 - grid) + ln[n] * grid; v = v * (1 - ao) + o[n] * ao; v = v * (1 - ab) + bl[n] * ab; v = v * sh + 255 * sp; d[k + n] = bg[n] + (v - bg[n]) * edge; }
    }
    g.putImageData(img, 0, 0);
  }

  function blob(ch, fi, fj, amt) {
    const rad = 6, j0 = Math.round(fj), cl = Math.max(.1, Math.cos(lat[Math.max(0, Math.min(NY - 1, j0))]));
    for (let dj = -rad; dj <= rad; dj++) { const j = j0 + dj; if (j < 0 || j >= NY) continue;
      for (let di = -Math.ceil(rad / cl); di <= Math.ceil(rad / cl); di++) { const i = ((Math.round(fi) + di) % NX + NX) % NX, r2 = (dj * dj + (di * cl) ** 2) / (rad * rad * .35);
        if (r2 < 4) ch[j * NX + i] = Math.min(1, ch[j * NX + i] + amt * Math.exp(-r2)); } }
  }
  function dropAt(px, py) {
    let best = -1, bd = 1e9;
    for (let p = 0; p < PX.length; p += 6) { const k = PX[p], X = k % W, Y = (k - X) / W, d2 = (X + .5 - px) ** 2 + (Y + .5 - py) ** 2; if (d2 < bd) { bd = d2; best = p; } }
    if (best < 0 || bd > 4) return false;
    blob(dye[ink], (PX[best + 2] - theta) / dl, PX[best + 1], .95); return true;
  }

  /* input: drag sideways to spin (the surface follows your finger); a tap drops dye */
  let dragging = false, lastX = 0, lastT = 0, moved = 0, downY = 0, vx = 0;
  c.addEventListener('pointerdown', e => { dragging = true; moved = 0; lastX = e.clientX; downY = e.clientY; lastT = performance.now(); vx = 0; c.setPointerCapture(e.pointerId); kick(); });
  c.addEventListener('pointermove', e => { if (!dragging) return; const t = performance.now(), dx = e.clientX - lastX, dts = Math.max(.008, (t - lastT) / 1000);
    moved += Math.abs(dx) + Math.abs(e.clientY - downY) * .2; lastX = e.clientX; lastT = t;
    if (moved > 6) { const b = c.getBoundingClientRect(), Rc = R * Math.pow(ratio, -1 / 3) * b.width / W; vx = vx * .5 + .5 * dx / dts; Om = Math.max(-OMAX, Math.min(OMAX, -vx / Rc)); theta += -dx / Rc; kick(); } });
  c.addEventListener('pointerup', e => { if (!dragging) return; dragging = false; if (moved <= 6) { const b = c.getBoundingClientRect(); if (dropAt((e.clientX - b.left) / b.width * W, (e.clientY - b.top) / b.height * H)) { draw(); kick(); } } });
  c.addEventListener('pointercancel', () => { dragging = false; });

  let raf = 0, seen = true, prev = 0, idle = 0;
  function run(t) { raf = 0; if (!seen || document.hidden) return; const dt = Math.min(.05, prev ? (t - prev) / 1000 : .016); prev = t;
    step(dt); draw(); idle = dragging ? 0 : idle + dt;
    if (!calm() || idle < 4) raf = requestAnimationFrame(run); else prev = 0; }      // with reduced motion, it moves only for a few seconds after you touch it
  function kick() { idle = 0; if (!raf) { prev = 0; raf = requestAnimationFrame(run); } }
  new IntersectionObserver(es => { seen = es[0].isIntersecting; if (seen) kick(); }).observe(c);
  document.addEventListener('visibilitychange', kick);
  new ResizeObserver(() => { size(); draw(); }).observe(c);

  /* a start: drops of each color near the front, and a recent spin-up */
  size();
  [[0, .5, 1.3], [1, .1, 1.8], [0, -.25, 2.2], [1, .75, 2.6], [0, .2, .9]].forEach(([ch, la, lo]) => blob(dye[ch], lo / dl, (la + Math.PI / 2) / dp - .5, .95));
  if (!calm()) { Om = 2.4; wf.fill(OMEGA0); }
  draw(); kick();
}
