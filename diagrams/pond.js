/* The home page's pond: the 2D wave equation on a small grid. Poke it. It rests when nothing is moving. */
import { calm } from './kit.js';

export default function (fig) {
  const c = document.createElement('canvas'), W = 96, H = 44;
  c.width = W; c.height = H;
  c.style.imageRendering = 'auto';
  c.setAttribute('role', 'img');
  c.setAttribute('aria-label', 'A pond. Touching it starts ripples that spread and reflect off the edges.');
  fig.insertBefore(c, fig.firstChild);
  const g = c.getContext('2d'), img = g.createImageData(W, H);
  let u = new Float32Array(W * H), v = new Float32Array(W * H), raf = 0, seen = true, last = 0;
  const probe = document.createElement('i');
  fig.appendChild(probe);
  function rgb(name) { probe.style.color = `var(${name})`; const m = getComputedStyle(probe).color.match(/[\d.]+/g).map(Number); return m; }
  let lo = rgb('--sunk'), hi = rgb('--blue'), peak = rgb('--snow');
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { lo = rgb('--sunk'); hi = rgb('--blue'); peak = rgb('--snow'); paint(); });

  function drop(x, y, a) {
    const r = 3;
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      const X = x + i, Y = y + j;
      if (X < 1 || Y < 1 || X >= W - 1 || Y >= H - 1) continue;
      u[Y * W + X] += a * Math.exp(-(i * i + j * j) / 3);
    }
  }
  function step() {
    let e = 0;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const k = y * W + x;
      v[k] = (v[k] + .22 * (u[k - 1] + u[k + 1] + u[k - W] + u[k + W] - 4 * u[k])) * .996;
    }
    for (let k = 0; k < u.length; k++) { u[k] += v[k]; e += Math.abs(v[k]); }
    return e;
  }
  function paint() {
    const d = img.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = y * W + x, s = x < W - 1 && y < H - 1 ? (u[k + 1] - u[k]) + (u[k + W] - u[k]) : 0;
      const t = Math.max(0, Math.min(1, .28 + u[k] * .5)), w = Math.max(0, Math.min(1, s * 1.8)), q = k * 4;
      for (let n = 0; n < 3; n++) d[q + n] = (lo[n] + (hi[n] - lo[n]) * t) * (1 - w) + peak[n] * w;
      d[q + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  function run() {
    raf = 0;
    if (!seen || document.hidden) return;
    const e = step() + step();
    paint();
    if (e > .6) raf = requestAnimationFrame(run);
  }
  function kick() { if (!raf && !calm()) raf = requestAnimationFrame(run); }
  function poke(ev) {
    const b = c.getBoundingClientRect();
    drop(Math.floor((ev.clientX - b.left) / b.width * W), Math.floor((ev.clientY - b.top) / b.height * H), 1.4);
    if (calm()) { for (let i = 0; i < 26; i++) step(); paint(); } else kick();
  }
  c.addEventListener('pointerdown', poke);
  c.addEventListener('pointermove', ev => { const now = performance.now(); if (ev.buttons && now - last > 70) { last = now; poke(ev); } });
  new IntersectionObserver(es => { seen = es[0].isIntersecting; if (seen) kick(); }).observe(c);
  document.addEventListener('visibilitychange', kick);
  drop(30, 18, 1.6); drop(68, 28, 1.2);
  if (calm()) for (let i = 0; i < 40; i++) step();
  paint();
  kick();
}
