/* The wolf, the goat and the cabbage. A state is which bank each of farmer, wolf, goat and cabbage is on:
   four bits, so 16 states. A crossing flips the farmer's bit and at most one other bit (the passenger,
   who must be on the farmer's bank). A state is unsafe when the wolf is with the goat, or the goat with
   the cabbage, on the bank the farmer has left. The safe states and their edges are computed below; the
   puzzle is a walk on that small graph from "all left" to "all right", and Solve finds a shortest walk
   by breadth-first search. */
import { svg, el, clear, label, controls, button, readouts, calm } from './kit.js';

const BLUE = 'var(--blue)', ORANGE = 'var(--orange)', GREEN = 'var(--green)', RED = 'var(--red)', PURPLE = 'var(--purple)', INK = 'var(--ink)', SOFT = 'var(--ink-soft)', LINE = 'var(--line)', SUNK = 'var(--sunk)', PANEL = 'var(--panel)', ONACC = 'var(--on-accent)';
const NAMES = ['Farmer', 'Wolf', 'Goat', 'Cabbage'], LET = ['F', 'W', 'G', 'C'], HUE = [BLUE, PURPLE, ORANGE, GREEN];
const bit = (s, i) => (s >> i) & 1;
const ALL = 15;
// what is eaten on the bank the farmer is not on
const eaten = s => { const o = []; if (bit(s, 1) === bit(s, 2) && bit(s, 1) !== bit(s, 0)) o.push(2); if (bit(s, 2) === bit(s, 3) && bit(s, 2) !== bit(s, 0)) o.push(3); return o; };
const safe = s => eaten(s).length === 0;
const STATES = [...Array(16).keys()].filter(safe);
// the states one crossing away: alone, or with one thing from the farmer's own bank
const reach = s => { const o = [[s ^ 1, -1]]; for (let i = 1; i < 4; i++) if (bit(s, i) === bit(s, 0)) o.push([s ^ 1 ^ (1 << i), i]); return o; };
const EDGES = []; STATES.forEach(s => reach(s).forEach(([t]) => { if (t > s && safe(t)) EDGES.push([s, t]); }));

function solve() {   // breadth-first search from all-left to all-right; returns the list of states
  const prev = new Map([[0, null]]), q = [0];
  while (q.length) {
    const s = q.shift();
    if (s === ALL) { const out = []; for (let k = s; k !== null; k = prev.get(k)) out.unshift(k); return out; }
    for (const [t] of reach(s)) if (safe(t) && !prev.has(t)) { prev.set(t, s); q.push(t); }
  }
  return null;
}

export default function (fig) {
  const s = svg(fig, 380, 296, 'A river with a wolf, a goat and a cabbage on the left bank and a boat with the farmer, above a graph of the ten safe arrangements with your path traced through it.');
  const g = el('g', {}, s);
  const box = controls(fig);
  const [crossR, statR] = readouts(fig, ['Crossings', 'Status']);
  let hist = [0], what = [], timer = 0;   // hist: states visited; what: description of each crossing
  const cur = () => hist[hist.length - 1];

  // graph layout: one column per crossing from the start (breadth-first depth), so the two shortest
  // solutions show up as the two branches of one loop
  const depth = new Map([[0, 0]]), cols = [];
  for (let q = [0]; q.length;) { const s = q.shift(); for (const [t] of reach(s)) if (safe(t) && !depth.has(t)) { depth.set(t, depth.get(s) + 1); q.push(t); } }
  STATES.forEach(st => (cols[depth.get(st)] = cols[depth.get(st)] || []).push(st));
  const pos = new Map(), STEP = 47.4;
  cols.forEach((c, k) => c.forEach((st, j) => pos.set(st, [24 + k * STEP, 224 - (c.length - 1) * 20 + j * 40])));
  const edgeD = (a, b) => { const [x1, y1] = pos.get(a), [x2, y2] = pos.get(b); return `M${x1} ${y1}L${x2} ${y2}`; };

  function glyph(parent, i, x, y) {   // x, y: centre of a 20 x 20 icon
    const f = HUE[i];
    if (i === 0) { el('circle', { cx: x, cy: y - 5, r: 5, fill: f }, parent); el('path', { d: `M${x - 8} ${y + 9}Q${x} ${y - 3} ${x + 8} ${y + 9}Z`, fill: f }, parent); }
    else if (i === 1) el('path', { d: `M${x - 9} ${y + 8}L${x - 8} ${y - 8}L${x - 3} ${y - 3}L${x + 3} ${y - 3}L${x + 8} ${y - 8}L${x + 9} ${y + 8}Z`, fill: f }, parent);
    else if (i === 2) { el('ellipse', { cx: x, cy: y + 2, rx: 9, ry: 7, fill: f }, parent); el('path', { d: `M${x - 4} ${y - 4}L${x - 6} ${y - 10}M${x + 4} ${y - 4}L${x + 6} ${y - 10}`, stroke: f, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, parent); }
    else { el('circle', { cx: x, cy: y, r: 9, fill: f }, parent); el('path', { d: `M${x - 6} ${y + 3}Q${x} ${y - 8} ${x + 6} ${y + 3}M${x} ${y - 8}V${y + 8}`, fill: 'none', stroke: PANEL, 'stroke-width': 1.3 }, parent); }
  }

  function draw() {
    const fk = document.activeElement && g.contains(document.activeElement) ? document.activeElement.getAttribute('data-k') : null;
    clear(g);
    const st = cur(), dead = eaten(st), over = dead.length > 0, won = st === ALL;
    // scene
    el('rect', { x: 0, y: 0, width: 96, height: 134, rx: 10, fill: `color-mix(in srgb, ${GREEN} 14%, var(--panel))` }, g);
    el('rect', { x: 284, y: 0, width: 96, height: 134, rx: 10, fill: `color-mix(in srgb, ${GREEN} 14%, var(--panel))` }, g);
    el('rect', { x: 96, y: 0, width: 188, height: 134, fill: `color-mix(in srgb, ${BLUE} 16%, var(--panel))` }, g);
    for (const wy of [30, 112]) el('path', { d: `M112 ${wy}q8 -6 16 0t16 0t16 0M188 ${wy + 6}q8 -6 16 0t16 0t16 0`, fill: 'none', stroke: BLUE, 'stroke-width': 1.5, opacity: .45 }, g);
    label(g, 48, 148, 'Start bank', { size: 11, cls: 'soft' });
    label(g, 332, 148, 'Far bank', { size: 11, cls: 'soft' });
    const canMove = !over && !won;
    // the three passengers
    for (let i = 1; i < 4; i++) {
      const right = bit(st, i) === 1, x = right ? 287 : 3, y = 6 + (i - 1) * 42, ate = dead.includes(i);
      const here = bit(st, i) === bit(st, 0), tap = canMove && here;
      const a = { 'data-k': 'p' + i };
      if (tap) Object.assign(a, { role: 'button', tabindex: '0', 'aria-label': 'Take the ' + NAMES[i].toLowerCase() + ' across', style: 'cursor:pointer' });
      const c = el('g', a, g);
      el('rect', { x, y, width: 90, height: 36, rx: 9, fill: ate ? 'none' : tap ? `color-mix(in srgb, ${HUE[i]} 20%, var(--panel))` : PANEL, stroke: ate ? RED : tap ? HUE[i] : LINE, 'stroke-width': ate ? 2.5 : 1.5, 'stroke-dasharray': ate ? '4 3' : '' }, c);
      glyph(el('g', { opacity: ate ? .35 : 1 }, c), i, x + 20, y + 18);
      label(c, x + 33, y + (ate ? 16 : 23), NAMES[i], { a: 'start', size: 12.5, w: 600, cls: ate ? 'soft' : '' });
      if (ate) label(c, x + 33, y + 29, 'eaten', { a: 'start', size: 10.5, w: 700, fill: RED });
      if (tap) { const go = () => move(i); c.addEventListener('click', go); c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }); }
    }
    // the boat, always on the farmer's bank
    const bx = bit(st, 0) ? 198 : 106, boat = el('g', Object.assign({ 'data-k': 'boat' }, canMove ? { role: 'button', tabindex: '0', 'aria-label': 'Cross alone', style: 'cursor:pointer' } : {}), g);
    el('rect', { x: bx - 4, y: 38, width: 86, height: 62, fill: 'transparent' }, boat);
    el('path', { d: `M${bx} 72H${bx + 78}L${bx + 66} 90H${bx + 12}Z`, fill: `color-mix(in srgb, ${ORANGE} 35%, var(--panel))`, stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }, boat);
    glyph(boat, 0, bx + 39, 58);
    label(boat, bx + 39, 109, canMove ? 'tap: cross alone' : 'boat', { size: 10.5, cls: 'soft' });
    if (canMove) { boat.addEventListener('click', () => move(-1)); boat.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); move(-1); } }); }

    // the state graph
    label(g, 190, 166, 'The ' + STATES.length + ' safe arrangements, by crossings from the start', { size: 11.5, w: 600 });
    EDGES.forEach(([a, b]) => el('path', { d: edgeD(a, b), fill: 'none', stroke: LINE, 'stroke-width': 1.8 }, g));
    for (let k = 1; k < hist.length; k++) if (safe(hist[k])) el('path', { d: edgeD(hist[k - 1], hist[k]), fill: 'none', stroke: INK, 'stroke-width': 3, 'stroke-linecap': 'round', opacity: .85 }, g);
    const seen = new Set(hist);
    STATES.forEach(n => {
      const [x, y] = pos.get(n), me = n === st && safe(st), goal = n === ALL;
      el('rect', { x: x - 19, y: y - 10, width: 38, height: 20, rx: 10, fill: me ? BLUE : seen.has(n) ? `color-mix(in srgb, ${BLUE} 28%, var(--panel))` : PANEL, stroke: goal ? GREEN : me ? INK : seen.has(n) ? BLUE : SOFT, 'stroke-width': goal || me ? 2.5 : 1.5 }, g);
      label(g, x, y + 4, [0, 1, 2, 3].filter(i => bit(n, i)).map(i => LET[i]).join('') || '–', { size: 10.5, w: 700, fill: me ? ONACC : INK });
    });
    const [sx, sy] = pos.get(0), [gx, gy] = pos.get(ALL);
    label(g, sx, sy - 15, 'start', { size: 10, cls: 'soft' }); label(g, gx, gy - 15, 'goal', { size: 10, cls: 'soft' });
    if (over) { const last = hist[hist.length - 2], [lx, ly] = pos.get(last); label(g, lx, ly - 15, '✕ unsafe next', { size: 10.5, w: 700, fill: RED }); }
    cols.forEach((c, k) => label(g, 24 + k * STEP, 268, String(k), { size: 10, cls: 'soft' }));
    label(g, 190, 286, 'Letters are what is on the far bank: F farmer, W wolf, G goat, C cabbage', { size: 10, cls: 'soft' });

    crossR.textContent = (hist.length - 1) + (won ? ' — all across' : '');
    statR.textContent = over ? (dead.length === 2 ? 'The wolf ate the goat and the goat ate the cabbage.' : dead[0] === 2 ? 'The wolf ate the goat.' : 'The goat ate the cabbage.') + ' Undo or start over.' : won ? 'Everyone is across, uneaten.' : what.length ? what[what.length - 1] : 'Everyone is on the start bank.';
    undoB.disabled = hist.length < 2; aloneB.disabled = !canMove;
    if (fk) { const again = g.querySelector('[data-k="' + fk + '"][role=button]') || g.querySelector('[role=button]'); if (again) again.focus({ preventScroll: true }); }
  }

  function stop() { clearInterval(timer); timer = 0; }
  function move(i) {
    stop();
    const st = cur(); if (!canGo(st)) return;
    const t = st ^ 1 ^ (i > 0 ? 1 << i : 0);
    hist.push(t); what.push(i > 0 ? 'The farmer took the ' + NAMES[i].toLowerCase() + ' across.' : 'The farmer crossed alone.');
    draw();
  }
  const canGo = st => safe(st) && st !== ALL;
  function undo() { stop(); if (hist.length > 1) { hist.pop(); what.pop(); draw(); } }
  function reset() { stop(); hist = [0]; what = []; draw(); }
  function play() {
    const sol = solve(); stop(); hist = [0]; what = [];
    const step = k => { const a = sol[k - 1], b = sol[k], d = a ^ b ^ 1; hist.push(b); what.push(d ? 'The farmer took the ' + NAMES[Math.log2(d)].toLowerCase() + ' across.' : 'The farmer crossed alone.'); };
    if (calm()) { for (let k = 1; k < sol.length; k++) step(k); draw(); return; }
    let k = 1; draw();
    timer = setInterval(() => { if (k >= sol.length) { stop(); return; } step(k++); draw(); }, 600);
  }

  const aloneB = button(box, 'Cross alone', () => move(-1));
  button(box, 'Solve', play, 'go');
  const undoB = button(box, 'Undo', undo);
  button(box, 'Start over', reset);
  draw();
}
