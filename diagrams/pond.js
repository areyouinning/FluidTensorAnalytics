/* The home page's spinning drop: a thin layer of fluid on an oblate spheroid. Drag to spin the spheroid; tap to drop dye.
   The physics is spin-up. When the container's spin Ω changes, the fluid lags. A viscous boundary layer (the Ekman layer)
   drags each latitude back into step on its own time, τ = H / √(ν Ω |sin φ|): quick near the poles, slow at the equator.
   So the fluid rotates at different rates at different latitudes for a while, and the dye shears into streaks. The same
   spin-up drives a weak overturning: during spin-up the layer drifts toward the poles, during spin-down toward the equator.
   The layer's own swirls and waves are left out: this is the spin-up alone, with the flow worked out latitude by latitude. */
import { calm } from './kit.js';

const NX = 256, NY = 128, A = 1, Cax = .7, TILT = 24 * Math.PI / 180;   // grid in longitude × latitude; semi-axes; axis tipped toward you
const T0 = 2.6, OMIN = .15, SMIN = .12, K_OVER = .06, OMEGA0 = .35;      // τ = T0/√(max(|Ω|,OMIN)·max(|sin φ|,SMIN)); overturning; resting spin

export default function (fig) {
  const c = document.createElement('canvas');
  c.setAttribute('role', 'img');
  c.setAttribute('aria-label', 'A squashed sphere of fluid, slowly spinning. Drag to spin it faster or slower; tap to drop orange or blue dye, which the spin-up shears into streaks.');
  fig.insertBefore(c, fig.firstChild);
  const g = c.getContext('2d');
  const probe = document.createElement('i'); fig.appendChild(probe);
  const rgb = name => { probe.style.color = `var(${name})`; return getComputedStyle(probe).color.match(/[\d.]+/g).slice(0, 3).map(Number); };
  let COL = {};
  const colors = () => { const pa = rgb('--panel'), ik = rgb('--ink'), dark = pa[0] + pa[1] + pa[2] < 300;
    COL = { bg: rgb('--sunk'), base: pa.map((v, n) => v + (ik[n] - v) * (dark ? .32 : 0)), line: rgb('--line'), o: rgb('--orange'), b: rgb('--blue'), ink: rgb('--ink') }; };
  colors(); matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { colors(); draw(); });

  /* dye: two channels; row j's cell i sits at body longitude i·dλ + off[j] (each latitude row carries its own drift, so the zonal shear is exact) */
  const dl = 2 * Math.PI / NX, dye = [new Float32Array(NX * NY), new Float32Array(NX * NY)], tmp = new Float32Array(NX * NY);
  const off = new Float64Array(NY), wf = new Float64Array(NY), lat = new Float64Array(NY);
  for (let j = 0; j < NY; j++) lat[j] = -Math.PI / 2 + (j + .5) * Math.PI / NY;
  let Om = calm() ? 0 : OMEGA0, theta = 0, ink = 0;
  wf.fill(Om);

  /* controls: pick the dye, clear it */
  const bar = document.createElement('div'); bar.className = 'pond-ctl';
  bar.innerHTML = '<button type="button" data-k="0" aria-pressed="true"><i style="background:var(--orange)"></i>Orange</button><button type="button" data-k="1" aria-pressed="false"><i style="background:var(--blue)"></i>Blue</button><button type="button" data-k="x">Clear</button>';
  fig.appendChild(bar);
  bar.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const k = b.dataset.k;
    if (k === 'x') { dye[0].fill(0); dye[1].fill(0); draw(); return; }
    ink = +k; bar.querySelectorAll('[data-k="0"],[data-k="1"]').forEach(x => x.setAttribute('aria-pressed', x.dataset.k === k)); });

  /* per-pixel geometry, worked out once per size: where each pixel lands on the spheroid (latitude row, body longitude) and its shading */
  let W = 0, H = 0, R = 0, cx = 0, cy = 0, img = null, PX = null;
  function layout() {
    const r = c.getBoundingClientRect(), s = Math.min(1.5, (devicePixelRatio || 1)) * .85;
    W = Math.max(160, Math.round(r.width * s)); H = Math.max(90, Math.round(r.height * s)); c.width = W; c.height = H;
    img = g.createImageData(W, H); cx = W / 2; cy = H / 2;
    const st = Math.sin(TILT), ct = Math.cos(TILT), semiV = Math.sqrt(Cax * Cax * ct * ct + A * A * st * st);
    R = Math.min(H * .44 / semiV, W * .3);
    const L = norm([-.45, .55, .7]), list = [];
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      const x = (px + .5 - cx) / R, y = -(py + .5 - cy) / R;
      const qa = ct * ct / (A * A) + st * st / (Cax * Cax), qb = 2 * y * st * ct * (1 / (Cax * Cax) - 1 / (A * A)), qc = x * x / (A * A) + y * y * st * st / (A * A) + y * y * ct * ct / (Cax * Cax) - 1;
      const disc = qb * qb - 4 * qa * qc; if (disc < 0) continue;
      const z = (-qb + Math.sqrt(disc)) / (2 * qa), X = x, Y = -y * st + z * ct, Z = y * ct + z * st;
      const n = norm([X / (A * A), Y / (A * A), Z / (Cax * Cax)]), phi = Math.asin(Math.max(-1, Math.min(1, n[2])));
      const ns = screenN(n, st, ct), lam = Math.atan2(Y, X), dif = Math.max(0, dot(ns, L)), rim = Math.max(0, ns[2]);
      const h = norm([L[0], L[1], L[2] + 1]), spec = Math.pow(Math.max(0, dot(ns, h)), 90);
      list.push(py * W + px, (phi + Math.PI / 2) / Math.PI * NY - .5, lam, .38 + .62 * dif, spec * .4, Math.min(1, rim * 3));
    }
    PX = new Float64Array(list);
  }
  const norm = v => { const m = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / m, v[1] / m, v[2] / m]; };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  /* a body-frame vector in screen axes (x right, y up, z toward you): body X = (1,0,0), Y = (0, −sin t, cos t), Z = (0, cos t, sin t) */
  const screenN = (n, st, ct) => [n[0], -n[1] * st + n[2] * ct, n[1] * ct + n[2] * st];

  /* dye at body longitude lam in row j (linear in longitude) */
  function rowVal(ch, j, lam) { let f = ((lam - off[j]) / dl) % NX; if (f < 0) f += NX; const i = Math.floor(f), t = f - i, r = j * NX; return ch[r + i] * (1 - t) + ch[r + (i + 1) % NX] * t; }
  function draw() {
    if (!PX) return;
    const d = img.data, bg = COL.bg, base = COL.base, o = COL.o, bl = COL.b, ln = COL.line;
    for (let q = 0; q < d.length; q += 4) { d[q] = bg[0]; d[q + 1] = bg[1]; d[q + 2] = bg[2]; d[q + 3] = 255; }
    for (let p = 0; p < PX.length; p += 6) {
      const k = PX[p] * 4, fy = PX[p + 1], lam = PX[p + 2] - theta, sh = PX[p + 3], sp = PX[p + 4], edge = PX[p + 5];
      const j0 = Math.max(0, Math.min(NY - 1, Math.floor(fy))), j1 = Math.min(NY - 1, j0 + 1), ty = Math.max(0, Math.min(1, fy - j0));
      const ao = Math.min(1, rowVal(dye[0], j0, lam) * (1 - ty) + rowVal(dye[0], j1, lam) * ty), ab = Math.min(1, rowVal(dye[1], j0, lam) * (1 - ty) + rowVal(dye[1], j1, lam) * ty);
      /* faint meridians every 30° and the equator, fixed to the spheroid, so you can see it turn */
      let m = ((lam % (Math.PI / 6)) + Math.PI / 6) % (Math.PI / 6); m = Math.min(m, Math.PI / 6 - m) / dl; const eq = Math.abs(fy - (NY / 2 - .5));
      const grid = Math.max(m < .6 ? .5 : 0, eq < .7 ? .5 : 0);
      for (let n = 0; n < 3; n++) {
        let v = base[n] * (1 - grid) + ln[n] * grid;
        v = v * (1 - ao) + o[n] * ao; v = v * (1 - ab) + bl[n] * ab;
        v = v * sh + 255 * sp;
        d[k + n] = bg[n] + (v - bg[n]) * edge;
      }
    }
    g.putImageData(img, 0, 0);
  }

  /* one step of the physics */
  function step(dt) {
    let busy = Math.abs(Om - (calm() ? 0 : OMEGA0)) > 1e-3;
    for (let j = 0; j < NY; j++) {
      const s = Math.abs(Math.sin(lat[j])), tau = T0 / Math.sqrt(Math.max(Math.abs(Om), OMIN) * Math.max(s, SMIN));
      wf[j] = Om + (wf[j] - Om) * Math.exp(-dt / tau);                 // Ekman spin-up of this latitude
      off[j] += (wf[j] - Om) * dt;                                    // its drift relative to the spheroid
      if (Math.abs(wf[j] - Om) > 2e-3) busy = true;
    }
    /* the overturning: v = −K (ω − Ω) sin 2φ, as a semi-Lagrangian step in latitude */
    for (const ch of dye) {
      let any = false;
      for (let j = 0; j < NY; j++) {
        const v = -K_OVER * (wf[j] - Om) * Math.sin(2 * lat[j]) * dt / (Math.PI / NY), r = j * NX;
        if (Math.abs(v) < 1e-4) { tmp.set(ch.subarray(r, r + NX), r); continue; }
        any = true; const src = Math.max(0, Math.min(NY - 1, j - v)), j0 = Math.floor(src), j1 = Math.min(NY - 1, j0 + 1), t = src - j0;
        for (let i = 0; i < NX; i++) { const lam = i * dl + off[j]; tmp[r + i] = j0 === j && t === 0 ? ch[r + i] : rowVal(ch, j0, lam) * (1 - t) + rowVal(ch, j1, lam) * t; }
      }
      if (any) ch.set(tmp);
    }
    if (!dragging && !calm()) Om += (OMEGA0 - Om) * (1 - Math.exp(-dt / 25));   // a slow bearing friction back to the resting spin
    if (!dragging) theta += Om * dt;                                 // while you drag, your finger turns it
    return busy;
  }

  function dropAt(px, py) {
    let best = -1, bd = 1e9;
    for (let p = 0; p < PX.length; p += 6) { const k = PX[p], X = k % W, Y = (k - X) / W, d2 = (X + .5 - px) ** 2 + (Y + .5 - py) ** 2; if (d2 < bd) { bd = d2; best = p; } }
    if (best < 0 || bd > 4) return false;
    const fy = PX[best + 1], lam0 = PX[best + 2] - theta, ch = dye[ink], rad = 7;
    for (let dj = -rad; dj <= rad; dj++) { const j = Math.round(fy) + dj; if (j < 0 || j >= NY) continue; const cl = Math.max(.08, Math.cos(lat[j]));
      for (let di = -Math.ceil(rad / cl); di <= Math.ceil(rad / cl); di++) { const lam = lam0 + di * dl, f = (((lam - off[j]) / dl) % NX + NX) % NX, i = Math.round(f) % NX;
        const r2 = (dj * dj + (di * cl) ** 2) / (rad * rad * .35); if (r2 < 4) ch[j * NX + i] = Math.min(1, ch[j * NX + i] + .95 * Math.exp(-r2)); } }
    return true;
  }

  /* input: drag sideways to spin (the surface follows your finger); a tap drops dye */
  let dragging = false, lastX = 0, lastT = 0, moved = 0, downX = 0, downY = 0, vx = 0;
  c.addEventListener('pointerdown', e => { dragging = true; moved = 0; lastX = downX = e.clientX; downY = e.clientY; lastT = performance.now(); vx = 0; c.setPointerCapture(e.pointerId); kick(); });
  c.addEventListener('pointermove', e => { if (!dragging) return; const t = performance.now(), dx = e.clientX - lastX, dts = Math.max(.008, (t - lastT) / 1000);
    moved += Math.abs(dx) + Math.abs(e.clientY - downY) * .2; lastX = e.clientX; lastT = t;
    if (moved > 6) { const b = c.getBoundingClientRect(), Rc = R * b.width / W; vx = vx * .5 + .5 * dx / dts; Om = Math.max(-9, Math.min(9, -vx / Rc)); theta += -dx / Rc; draw(); kick(); } });
  const up = e => { if (!dragging) return; dragging = false; if (moved <= 6) { const b = c.getBoundingClientRect(); if (dropAt((e.clientX - b.left) / b.width * W, (e.clientY - b.top) / b.height * H)) { draw(); kick(); } } };
  c.addEventListener('pointerup', up); c.addEventListener('pointercancel', () => { dragging = false; });

  let raf = 0, seen = true, prev = 0;
  function run(t) { raf = 0; if (!seen || document.hidden) return; const dt = Math.min(.05, prev ? (t - prev) / 1000 : .016); prev = t;
    const busy = step(dt); draw(); if (busy || !calm() || dragging) raf = requestAnimationFrame(run); else prev = 0; }
  function kick() { if (!raf) { prev = 0; raf = requestAnimationFrame(run); } }
  new IntersectionObserver(es => { seen = es[0].isIntersecting; if (seen) kick(); }).observe(c);
  document.addEventListener('visibilitychange', kick);
  new ResizeObserver(() => { layout(); draw(); }).observe(c);

  /* a start: two drops of each color, and a recent spin-up so the streaks are already forming */
  layout();
  const seed = (ch, la, lo) => { const j = Math.round((la + Math.PI / 2) / Math.PI * NY - .5);
    const cl = Math.cos(lat[j]), rad = 7; for (let dj = -rad; dj <= rad; dj++) { const jj = j + dj; for (let di = -Math.ceil(rad / cl); di <= Math.ceil(rad / cl); di++) { const i = ((Math.round(lo / dl) + di) % NX + NX) % NX, r2 = (dj * dj + (di * cl) ** 2) / (rad * rad * .35); if (r2 < 4) dye[ch][jj * NX + i] = Math.min(1, dye[ch][jj * NX + i] + .95 * Math.exp(-r2)); } } };
  seed(0, .55, 1.2); seed(1, .15, 1.9); seed(0, -.2, 2.5); seed(1, .85, 2.9);
  if (!calm()) { Om = 2.2; wf.fill(OMEGA0); }
  draw(); kick();
}
