/* Braess's paradox (Dietrich Braess, 1968). N drivers go from S to E. Two roads are crowded (time = cars/100 min),
   two are wide but long (45 min whatever the traffic). Open a free shortcut from A to B and let drivers switch,
   each to whichever route is fastest for them right now; the new equilibrium is slower for everyone.
   Equilibria, with N drivers:
     shortcut closed: half each way, trip = N/200 + 45.
     shortcut open:   N ≤ 4500, everyone zig-zags, trip = N/50;  4500 ≤ N ≤ 9000, mixed, trip = 90;  N ≥ 9000, shortcut unused.
   So the shortcut hurts whenever 3000 < N < 9000. */
import { svg, el, clear, label, controls, slider, button, readouts, calm } from './kit.js';

const BLUE = 'var(--blue)', ORANGE = 'var(--orange)', GREEN = 'var(--green)', INK = 'var(--ink)', SOFT = 'var(--ink-soft)', LINE = 'var(--line)', SUNK = 'var(--sunk)', PANEL = 'var(--panel)';
const W = 380, NH = 250, H = NH + 118;
const S = [34, 125], A = [190, 34], B = [190, 216], E = [346, 125];
const ROUTES = { up: [S, A, E], down: [S, B, E], zig: [S, A, B, E] };
const COL = { up: BLUE, down: ORANGE, zig: GREEN };

export function times(f) {      // trip times for each route given flows { up, down, zig }
  const sa = (f.up + f.zig) / 100, be = (f.down + f.zig) / 100;
  return { up: sa + 45, down: 45 + be, zig: sa + be, sa, be };
}
export function equilibrium(N, open) {
  if (!open || N >= 9000) return { up: N / 2, down: N / 2, zig: 0 };
  if (N <= 4500) return { up: 0, down: 0, zig: N };
  return { up: N - 4500, down: N - 4500, zig: 9000 - N };
}
const avg = f => { const t = times(f), N = f.up + f.down + f.zig; return (f.up * t.up + f.down * t.down + f.zig * t.zig) / N; };

export default function (fig) {
  const s = svg(fig, W, H, 'A road network from S to E with two crowded roads, two long roads and an optional free shortcut, and a chart of the average trip time as drivers switch routes.');
  const g = el('g', {}, s), cars = el('g', {}, s);
  const box = controls(fig), box2 = controls(fig);
  const [upR, downR, zigR, tripR] = readouts(fig, ['Top route', 'Bottom route', 'Zig-zag', 'Everyone’s trip']);
  let N = 4000, open = false, f = equilibrium(N, false), hist = [], raf = 0, last = 0, acc = 0, phase = { up: 0, down: 0, zig: 0 };
  const before = () => N / 200 + 45;

  function edge(p, q, txt, t, w, dash, col, side, off = 20) {
    el('line', { x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: col || LINE, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-dasharray': dash || '' }, g);
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy), ox = -dy / L * side, oy = dx / L * side;
    label(g, mx + ox * off, my + oy * off - 2, txt, { size: 12, w: 700 });
    if (t != null) label(g, mx + ox * off, my + oy * off + 12, t.toFixed(1) + ' min', { size: 11, cls: 'soft' });
  }
  function draw() {
    clear(g);
    const t = times(f), wv = x => 3 + 14 * x / Math.max(N, 1);
    edge(S, A, 'cars/100', t.sa, wv(f.up + f.zig), '', 'color-mix(in srgb, var(--ink) 30%, transparent)', -1);
    edge(A, E, '45', 45, wv(f.up), '', 'color-mix(in srgb, var(--ink) 30%, transparent)', -1);
    edge(S, B, '45', 45, wv(f.down), '', 'color-mix(in srgb, var(--ink) 30%, transparent)', 1);
    edge(B, E, 'cars/100', t.be, wv(f.down + f.zig), '', 'color-mix(in srgb, var(--ink) 30%, transparent)', 1);
    if (open) edge(A, B, 'free', 0, wv(f.zig), '', 'color-mix(in srgb, var(--green) 45%, transparent)', -1, 34);
    else { el('line', { x1: A[0], y1: A[1] + 14, x2: B[0], y2: B[1] - 14, stroke: SOFT, 'stroke-width': 2, 'stroke-dasharray': '4 6' }, g); label(g, A[0] + 34, (A[1] + B[1]) / 2 + 4, 'closed', { size: 11, cls: 'soft' }); }
    [[S, 'S'], [A, 'A'], [B, 'B'], [E, 'E']].forEach(([p, n]) => { el('circle', { cx: p[0], cy: p[1], r: 13, fill: PANEL, stroke: INK, 'stroke-width': 2 }, g); label(g, p[0], p[1] + 5, n, { size: 13, w: 700 }); });
    // chart of the average trip
    const y0 = NH + 8, y1 = H - 18, x0 = 40, x1 = W - 10, lo = 0, hi = 100, Y = v => y1 - (v - lo) / (hi - lo) * (y1 - y0);
    el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 6, fill: SUNK }, g);
    [0, 50, 100].forEach(v => label(g, x0 - 5, Y(v) + 4, v, { size: 10, a: 'end', cls: 'soft' }));
    label(g, x0 + 6, y0 + 13, 'everyone’s trip, minutes', { size: 10, a: 'start', cls: 'soft' });
    el('line', { x1: x0, x2: x1, y1: Y(before()), y2: Y(before()), stroke: SOFT, 'stroke-dasharray': '5 4' }, g);
    label(g, x1 - 4, Y(before()) + 13, 'without the shortcut: ' + before().toFixed(0), { size: 10, a: 'end', cls: 'soft' });
    if (hist.length > 1) el('path', { d: 'M' + hist.map((v, i) => (x0 + (x1 - x0) * i / 119).toFixed(1) + ' ' + Y(Math.min(hi, v)).toFixed(1)).join('L'), fill: 'none', stroke: GREEN, 'stroke-width': 2.5 }, g);
    label(g, (x0 + x1) / 2, H - 4, 'time →  (drivers switching to their fastest route)', { size: 10, cls: 'soft' });
    const fmt = (k, v) => Math.round(f[k]).toLocaleString() + ' cars, ' + v.toFixed(1) + ' min';
    upR.textContent = fmt('up', t.up); downR.textContent = fmt('down', t.down);
    zigR.textContent = open ? fmt('zig', t.zig) : 'closed';
    const a = avg(f); tripR.textContent = a.toFixed(1) + ' min' + (open && a > before() + .05 ? ' (' + (a - before()).toFixed(0) + ' worse)' : '');
  }
  function step() {    // drivers on a slower route move toward the fastest, in proportion to how much time they would save
    const t = times(f), ks = open ? ['up', 'down', 'zig'] : ['up', 'down'], best = ks.reduce((m, k) => t[k] < t[m] ? k : m, ks[0]);
    ks.forEach(k => { if (k === best) return; const mv = Math.min(f[k], f[k] * .35 * (t[k] - t[best]) / t[best] + (t[k] - t[best] > .01 ? 12 : 0)); f[k] -= mv; f[best] += mv; });
    hist.push(avg(f)); if (hist.length > 120) hist.shift();
  }
  function drawCars(dt) {
    clear(cars); const t = times(f);
    Object.keys(ROUTES).forEach(k => {
      if (k === 'zig' && !open) return;
      const P = ROUTES[k], seg = P.slice(1).map((q, i) => Math.hypot(q[0] - P[i][0], q[1] - P[i][1])), L = seg.reduce((a, b) => a + b);
      const n = Math.round(f[k] / 250); if (!n) return;
      phase[k] = (phase[k] + dt * 9 / Math.max(t[k], 1)) % 1;
      for (let j = 0; j < n; j++) {
        let d = ((j / n + phase[k]) % 1) * L, i = 0; while (d > seg[i]) { d -= seg[i]; i++; }
        const p = P[i], q = P[i + 1], u = d / seg[i];
        el('circle', { cx: p[0] + (q[0] - p[0]) * u, cy: p[1] + (q[1] - p[1]) * u, r: 3.6, fill: COL[k], stroke: PANEL, 'stroke-width': 1 }, cars);
      }
    });
  }
  function loop(now) {
    const dt = Math.min(.05, (now - (last || now)) / 1000); last = now; acc += dt;
    while (acc > .09) { acc -= .09; step(); draw(); }
    drawCars(dt); raf = requestAnimationFrame(loop);
  }
  function settle() { f = equilibrium(N, open); hist = Array(120).fill(avg(f)); draw(); drawCars(0); }

  const toggle = button(box, 'Open the shortcut', () => {
    open = !open; toggle.textContent = open ? 'Close the shortcut' : 'Open the shortcut'; toggle.setAttribute('aria-pressed', open);
    if (!open) { f.up += f.zig / 2; f.down += f.zig / 2; f.zig = 0; }
    if (calm()) settle(); else draw();
  }, 'go');
  button(box, 'Settle now', settle);
  slider(box2, 'Drivers', 1000, 10000, 250, N, x => x.toLocaleString(), x => { N = +x; settle(); });
  settle();
  if (!calm()) {
    const io = new IntersectionObserver(es => es.forEach(e => { cancelAnimationFrame(raf); if (e.isIntersecting) { last = 0; raf = requestAnimationFrame(loop); } }));
    io.observe(fig);
  }
}
