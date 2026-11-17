/* Two jugs, a tap and a drain. Fill, empty and pour to measure an exact amount. On the right, every
   state (litres in A, litres in B) is a dot, and your moves trace a path between them — pours run along
   the diagonals, like a billiard ball. A target is reachable exactly when it is a multiple of
   gcd(A, B) (Bezout), and "Solve" finds the shortest way by breadth-first search over the dots. */
import { svg, el, clear, label, controls, slider, button, readouts, calm } from './kit.js';

const BLUE = 'var(--blue)', ORANGE = 'var(--orange)', GREEN = 'var(--green)', INK = 'var(--ink)', SOFT = 'var(--ink-soft)', LINE = 'var(--line)', PANEL = 'var(--panel)';
const gcd = (a, b) => b ? gcd(b, a % b) : a;

export default function (fig) {
  const s = svg(fig, 380, 236, 'Two jugs with water levels, beside a grid of every possible state with your path traced through it.');
  const g = el('g', {}, s);
  const box = controls(fig), box2 = controls(fig);
  const [movesR, gcdR, targR] = readouts(fig, ['Moves', 'gcd(A, B)', 'Target']);
  let A = 3, B = 5, T = 4, x = 0, y = 0, path = [[0, 0]], timer = 0;

  const MOVES = {
    'Fill A': (x, y) => [A, y], 'Fill B': (x, y) => [x, B],
    'Empty A': (x, y) => [0, y], 'Empty B': (x, y) => [x, 0],
    'A → B': (x, y) => { const d = Math.min(x, B - y); return [x - d, y + d]; },
    'B → A': (x, y) => { const d = Math.min(y, A - x); return [x + d, y - d]; }
  };
  const done = (x, y) => x === T || y === T;

  function solve() {   // BFS from empty jugs to any state holding T; returns the list of states
    const key = (x, y) => x * 100 + y, prev = new Map([[key(0, 0), null]]), q = [[0, 0]];
    while (q.length) {
      const [cx, cy] = q.shift();
      if (done(cx, cy)) { const out = []; let k = [cx, cy]; while (k) { out.unshift(k); k = prev.get(key(k[0], k[1])); } return out; }
      for (const m in MOVES) { const [nx, ny] = MOVES[m](cx, cy); if (!prev.has(key(nx, ny))) { prev.set(key(nx, ny), [cx, cy]); q.push([nx, ny]); } }
    }
    return null;
  }

  function jug(x0, cap, amt, name, col) {
    const u = 120 / 12, h = cap * u, w = 44, yb = 196;
    el('rect', { x: x0, y: yb - amt * u, width: w, height: amt * u, fill: col, opacity: .55 }, g);
    el('path', { d: `M${x0} ${yb - h - 6}V${yb}H${x0 + w}V${yb - h - 6}`, fill: 'none', stroke: INK, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, g);
    for (let k = 1; k < cap; k++) el('line', { x1: x0, y1: yb - k * u, x2: x0 + 6, y2: yb - k * u, stroke: SOFT, 'stroke-width': 1 }, g);
    label(g, x0 + w / 2, yb + 16, name + ' · ' + cap, { size: 12, cls: 'soft' });
    label(g, x0 + w / 2, yb - h - 12, String(amt), { size: 16, w: 700, fill: col });
  }

  function draw() {
    clear(g);
    jug(22, A, x, 'A', BLUE); jug(88, B, y, 'B', ORANGE);
    // the state grid: A across, B up
    const ox = 178, oy = 196, sc = Math.min(180 / A, 160 / B), px = v => ox + v * sc, py = v => oy - v * sc;
    el('rect', { x: px(0), y: py(B), width: A * sc, height: B * sc, fill: 'none', stroke: LINE }, g);
    for (let i = 0; i <= A; i++) for (let j = 0; j <= B; j++) {
      const hit = done(i, j);
      el('circle', { cx: px(i), cy: py(j), r: hit ? 3.5 : 1.6, fill: hit ? GREEN : SOFT, opacity: hit ? .9 : .5 }, g);
    }
    if (path.length > 1) el('path', { d: 'M' + path.map(p => px(p[0]).toFixed(1) + ' ' + py(p[1]).toFixed(1)).join('L'), fill: 'none', stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round', opacity: .8 }, g);
    el('circle', { cx: px(x), cy: py(y), r: 6, fill: done(x, y) ? GREEN : PANEL, stroke: INK, 'stroke-width': 2 }, g);
    label(g, px(A / 2), oy + 16, 'litres in A →', { size: 11, cls: 'soft' });
    el('text', { x: ox - 10, y: py(B / 2), 'text-anchor': 'middle', 'font-size': 11, class: 'soft', transform: `rotate(-90 ${ox - 10} ${py(B / 2)})` }, g, 'litres in B →');
    const d = gcd(A, B), ok = T % d === 0 && T <= Math.max(A, B);
    movesR.textContent = (path.length - 1) + (done(x, y) ? ' — got it!' : '');
    gcdR.textContent = String(d);
    const best = ok ? solve() : null;
    targR.textContent = T + (ok ? ' — reachable, best is ' + (best.length - 1) + ' moves' : T > Math.max(A, B) ? ' — too big for either jug' : ' — impossible: not a multiple of ' + d);
  }

  function stop() { clearInterval(timer); timer = 0; }
  function reset() { stop(); x = 0; y = 0; path = [[0, 0]]; draw(); }
  function act(name) { stop(); const [nx, ny] = MOVES[name](x, y); if (nx === x && ny === y) return; x = nx; y = ny; path.push([x, y]); draw(); }
  function play() {
    const sol = solve(); if (!sol) { reset(); return; }
    stop(); x = 0; y = 0; path = [[0, 0]];
    if (calm()) { path = sol.slice(); [x, y] = sol[sol.length - 1]; draw(); return; }
    let i = 1; draw();
    timer = setInterval(() => { if (i >= sol.length) { stop(); return; } [x, y] = sol[i]; path.push(sol[i]); i++; draw(); }, 550);
  }

  slider(box, 'Jug A ', 2, 12, 1, A, v => v + ' L', v => { A = v; if (T > Math.max(A, B)) T = Math.max(A, B); reset(); });
  slider(box, 'Jug B ', 2, 12, 1, B, v => v + ' L', v => { B = v; reset(); });
  slider(box, 'Target ', 1, 12, 1, T, v => v + ' L', v => { T = v; reset(); });
  Object.keys(MOVES).forEach(m => button(box2, m, () => act(m)));
  button(box2, 'Solve', play, 'go');
  button(box2, 'Start over', reset);
  draw();
}
