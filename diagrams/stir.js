/* The home page's tank: rain falling into still water, coloured by the velocity-gradient tensor.
   A tank of water seen side-on. Each raindrop that lands pushes a small patch of water downward; a downward
   jet in still water rolls up into a vortex ring, and a ring seen in cross-section is a pair of opposite
   swirls, which you can watch sink and spread. Drag to stir it yourself.
   The flow is a small "stable fluids" solver (Stam, 1999), the same method as the full page,
   /navier-stokes-demo.html: add forces, carry the velocity along itself (semi-Lagrangian), and project it to
   be incompressible with a Jacobi solve for the pressure. Walls on all four sides; the top edge stands in for
   the water's surface. A gentle damping lets the tank settle when the rain stops.
   Colour comes from splitting the velocity gradient ∇u into its two parts,
     S = ½(∇u + ∇uᵀ)  the strain rate: stretching and squeezing (green)
     Ω = ½(∇u − ∇uᵀ)  the rotation rate: spinning; blue clockwise, orange anticlockwise as seen on screen
   Both are scaled by the same number (then a gentle gamma, so weak swirls still show), so a green patch and a
   blue one of equal strength mean equal rates.
   Still water has ∇u = 0, so an undisturbed tank is one flat colour. */
import { calm } from './kit.js';

const NX = 128, NY = 76, AIR = .17;          // grid, and the share of the picture that is air above the water
const W2 = NX + 2, ITER = 22, DAMP = .997, FLOOR = .035, DEAD = .004;
const RAIN = [['drizzle', 2.2], ['downpour', 11], ['no rain', 0]];
const VIEW = [['spin + stretch', 3], ['spin only', 1], ['stretch only', 2]];

export default function (fig) {
  const cv = document.createElement('canvas'); fig.insertBefore(cv, fig.firstChild);
  cv.setAttribute('role', 'img');
  cv.setAttribute('aria-label', 'Rain falling into a tank of water. Each drop rolls up into a pair of swirls that sink and spread. Blue marks clockwise spin, orange anticlockwise spin and green stretching. Drag to stir; tap to drop rain there.');
  const ctx = cv.getContext('2d'), off = document.createElement('canvas'); off.width = NX; off.height = NY;
  const octx = off.getContext('2d'), img = octx.createImageData(NX, NY);
  const probe = document.createElement('i'); probe.style.display = 'none'; fig.appendChild(probe);
  const rgb = v => { probe.style.color = `var(${v})`; return getComputedStyle(probe).color.match(/[\d.]+/g).slice(0, 3).map(Number); };
  let C = {}; const colours = () => { C = { base: rgb('--sunk'), cw: rgb('--blue'), ccw: rgb('--orange'), st: rgb('--green'), ink: rgb('--ink'), soft: rgb('--ink-soft'), line: rgb('--line'), panel: rgb('--panel') }; };
  colours();

  /* ---- the fluid ---- */
  const size = W2 * (NY + 2), IX = (i, j) => i + W2 * j;
  let u = new Float32Array(size), v = new Float32Array(size), u0 = new Float32Array(size), v0 = new Float32Array(size);
  const p = new Float32Array(size), div = new Float32Array(size);
  function bnd(b, x) {
    for (let j = 1; j <= NY; j++) { x[IX(0, j)] = b === 1 ? -x[IX(1, j)] : x[IX(1, j)]; x[IX(NX + 1, j)] = b === 1 ? -x[IX(NX, j)] : x[IX(NX, j)]; }
    for (let i = 1; i <= NX; i++) { x[IX(i, 0)] = b === 2 ? -x[IX(i, 1)] : x[IX(i, 1)]; x[IX(i, NY + 1)] = b === 2 ? -x[IX(i, NY)] : x[IX(i, NY)]; }
    x[IX(0, 0)] = .5 * (x[IX(1, 0)] + x[IX(0, 1)]); x[IX(NX + 1, 0)] = .5 * (x[IX(NX, 0)] + x[IX(NX + 1, 1)]);
    x[IX(0, NY + 1)] = .5 * (x[IX(1, NY + 1)] + x[IX(0, NY)]); x[IX(NX + 1, NY + 1)] = .5 * (x[IX(NX, NY + 1)] + x[IX(NX + 1, NY)]);
  }
  function project() {
    for (let j = 1; j <= NY; j++) for (let i = 1; i <= NX; i++) { const k = IX(i, j); div[k] = -.5 * (u[k + 1] - u[k - 1] + v[k + W2] - v[k - W2]); p[k] = 0; }
    bnd(0, div); bnd(0, p);
    for (let it = 0; it < ITER; it++) { for (let j = 1; j <= NY; j++) for (let i = 1; i <= NX; i++) { const k = IX(i, j); p[k] = (div[k] + p[k - 1] + p[k + 1] + p[k - W2] + p[k + W2]) / 4; } bnd(0, p); }
    for (let j = 1; j <= NY; j++) for (let i = 1; i <= NX; i++) { const k = IX(i, j); u[k] -= .5 * (p[k + 1] - p[k - 1]); v[k] -= .5 * (p[k + W2] - p[k - W2]); }
    bnd(1, u); bnd(2, v);
  }
  function advect(b, d, d0) {
    for (let j = 1; j <= NY; j++) for (let i = 1; i <= NX; i++) {
      const k = IX(i, j); let x = i - u0[k], y = j - v0[k];
      x = Math.max(.5, Math.min(NX + .5, x)); y = Math.max(.5, Math.min(NY + .5, y));
      const i0 = Math.floor(x), j0 = Math.floor(y), s1 = x - i0, t1 = y - j0, s0 = 1 - s1, t0 = 1 - t1;
      d[k] = s0 * (t0 * d0[IX(i0, j0)] + t1 * d0[IX(i0, j0 + 1)]) + s1 * (t0 * d0[IX(i0 + 1, j0)] + t1 * d0[IX(i0 + 1, j0 + 1)]);
    }
    bnd(b, d);
  }
  function step() {
    project();
    [u0, u] = [u, u0]; [v0, v] = [v, v0];
    advect(1, u, u0); advect(2, v, v0);
    project();
    for (let k = 0; k < size; k++) { u[k] *= DAMP; v[k] *= DAMP; }
  }
  function push(gx, gy, fx, fy, r) {   // add velocity (fx, fy) in a soft blob of radius r cells
    const R = Math.ceil(r * 2.2);
    for (let j = Math.max(1, Math.round(gy) - R); j <= Math.min(NY, Math.round(gy) + R); j++)
      for (let i = Math.max(1, Math.round(gx) - R); i <= Math.min(NX, Math.round(gx) + R); i++) {
        const w = Math.exp(-((i - gx) ** 2 + (j - gy) ** 2) / (2 * r * r)), k = IX(i, j); u[k] += fx * w; v[k] += fy * w;
      }
  }
  const splash = gx => push(gx, 3.5, 0, 1.7 + Math.random() * .7, 2.3 + Math.random() * .4);   // a short downward jet, wide enough to outlast the grid's own blurring

  /* ---- rain above the water ---- */
  let rain = 0, view = 0, drops = [], rings = [], scale = FLOOR, last = 0, acc = 0, seen = true, raf = 0, W = 0, H = 0, dpr = 1;
  const surface = () => H * AIR;
  function land(xf) { splash(1 + xf * (NX - 1)); rings.push({ x: xf, t: 0 }); }

  /* ---- drawing ---- */
  function draw() {
    const out = img.data, mode = VIEW[view][1]; let peak = 0;
    for (let j = 1; j <= NY; j++) for (let i = 1; i <= NX; i++) {
      const k = IX(i, j), ux = .5 * (u[k + 1] - u[k - 1]), uy = .5 * (u[k + W2] - u[k - W2]), vx = .5 * (v[k + 1] - v[k - 1]), vy = .5 * (v[k + W2] - v[k - W2]);
      const om = .5 * (vx - uy), sxy = .5 * (uy + vx), st = Math.sqrt(ux * ux + vy * vy + 2 * sxy * sxy);
      peak = Math.max(peak, Math.abs(om), st);
      const lift = x => x < DEAD ? 0 : Math.min(1, (x - DEAD) / (scale - DEAD)) ** .6;   // a small dead zone keeps still water flat; gamma .6 keeps weak swirls visible
      const r = mode & 1 ? lift(Math.abs(om)) : 0, s = mode & 2 ? lift(st) : 0, tot = Math.min(1, r + s);
      const spin = om > 0 ? C.cw : C.ccw, q = ((j - 1) * NX + (i - 1)) * 4;
      for (let c = 0; c < 3; c++) { const tgt = r + s > 0 ? (r * spin[c] + s * C.st[c]) / (r + s) : C.base[c]; out[q + c] = C.base[c] + (tgt - C.base[c]) * tot; }
      out[q + 3] = 255;
    }
    scale = Math.max(FLOOR, scale * .97, peak * .55);   // follows the flow down slowly, so a settling tank fades to one colour
    octx.putImageData(img, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sy = surface(), col = (a, o = 1) => `rgba(${a[0]},${a[1]},${a[2]},${o})`;
    ctx.fillStyle = col(C.panel); ctx.fillRect(0, 0, W, sy);
    ctx.imageSmoothingEnabled = true; ctx.drawImage(off, 0, sy, W, H - sy);
    ctx.strokeStyle = col(C.soft, .7); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke();
    ctx.strokeStyle = col(C.cw, .9); ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    for (const d of drops) { ctx.beginPath(); ctx.moveTo(d.x * W, d.y - 16); ctx.lineTo(d.x * W, d.y); ctx.stroke(); }
    for (const r of rings) { const a = 1 - r.t / .45; if (a <= 0) continue; ctx.strokeStyle = col(C.cw, .6 * a); ctx.beginPath(); ctx.ellipse(r.x * W, sy, 3 + 22 * r.t, 1.5 + 4 * r.t, 0, Math.PI, 2 * Math.PI); ctx.stroke(); }
  }

  /* ---- time ---- */
  function frame(t) {
    raf = 0; if (!seen) return;
    const dt = Math.min(.05, (t - (last || t)) / 1000); last = t;
    const rate = RAIN[rain][1]; acc += rate * dt;
    while (acc >= 1) { acc -= 1; drops.push({ x: .03 + Math.random() * .94, y: -10 - Math.random() * 20 }); }
    const sy = surface();
    drops = drops.filter(d => { d.y += 260 * dt; if (d.y >= sy) { land(d.x); return false; } return true; });
    rings = rings.filter(r => (r.t += dt) < .45);
    step(); draw();
    raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && seen && !calm()) { last = 0; raf = requestAnimationFrame(frame); } }
  function still() {   // reduced motion: let a few drops fall in the background and show one frame
    u.fill(0); v.fill(0);
    for (let n = 0; n < 160; n++) { if (n % 14 === 0 && RAIN[rain][1] > 0) land(.12 + .76 * ((n * .37) % 1)); step(); }
    rings = []; drops = []; draw();
  }

  /* ---- size ---- */
  function resize() {
    W = fig.clientWidth; H = Math.round(W * (W < 560 ? .78 : .46)); dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = H + 'px';
    if (calm()) still(); else draw();
  }
  new ResizeObserver(resize).observe(fig);
  addEventListener('fta-theme', () => { colours(); draw(); });

  /* ---- hands ---- */
  let down = null;
  const toGrid = e => { const b = cv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top; return { x, y, gx: 1 + x / b.width * (NX - 1), gy: (y - b.height * AIR) / (b.height * (1 - AIR)) * NY }; };
  cv.addEventListener('pointerdown', e => { down = { ...toGrid(e), moved: 0 }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => {
    if (!down) return; const g = toGrid(e), dx = g.gx - down.gx, dy = g.gy - down.gy; down.moved += Math.abs(dx) + Math.abs(dy);
    if (g.gy > 0) push(g.gx, g.gy, dx * .35, dy * .35, 3);
    Object.assign(down, g); if (calm()) draw(); else kick();
  });
  const up = () => { if (down && down.moved < 1.5) { const xf = Math.max(0, Math.min(1, down.x / W)); if (calm()) { land(xf); for (let n = 0; n < 40; n++) step(); rings = []; draw(); } else drops.push({ x: xf, y: -10 }); } down = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', () => { down = null; });

  /* ---- controls ---- */
  const bar = document.createElement('div'); bar.className = 'tank-ctl';
  const legend = document.createElement('div'); legend.className = 'tank-key';
  const rainB = document.createElement('button'), viewB = document.createElement('button'), calmB = document.createElement('button');
  [rainB, viewB, calmB].forEach(b => { b.type = 'button'; bar.appendChild(b); });
  calmB.textContent = 'Still the water';
  function labels() {
    rainB.textContent = 'Rain: ' + RAIN[rain][0]; viewB.textContent = 'Showing: ' + VIEW[view][0];
    const m = VIEW[view][1];
    legend.innerHTML = (m & 1 ? '<span><i style="background:var(--blue)"></i>spin ↻</span><span><i style="background:var(--orange)"></i>spin ↺</span>' : '') + (m & 2 ? '<span><i style="background:var(--green)"></i>stretch</span>' : '');
  }
  rainB.addEventListener('click', () => { rain = (rain + 1) % RAIN.length; labels(); if (calm()) still(); });
  viewB.addEventListener('click', () => { view = (view + 1) % VIEW.length; labels(); draw(); });
  calmB.addEventListener('click', () => { u.fill(0); v.fill(0); drops = []; rings = []; scale = FLOOR; draw(); });
  fig.appendChild(legend); fig.appendChild(bar); labels();

  new IntersectionObserver(es => { seen = es[0].isIntersecting; if (seen) kick(); }).observe(fig);
  resize(); kick();
}
