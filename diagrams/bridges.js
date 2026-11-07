/* The seven bridges of Königsberg, as Euler drew the problem in 1736 (a schematic, not to scale).
   data-mode="walk": tap bridges to walk, each one once. data-mode="build": add or remove bridges and ask whether a walk exists. */
import { svg, el, clear, label, controls, button, picker, readouts, C } from './kit.js';

const LAND = { A: [190, 38], B: [190, 222], C: [125, 130], D: [350, 130] };
const NAMES = { A: 'the north bank', B: 'the south bank', C: 'the island', D: 'the east land' };
/* each bridge: the two lands it joins and where it is drawn (x1,y1 to x2,y2) */
export const SEVEN = [
  { a: 'A', b: 'C', p: [88, 74, 88, 106] }, { a: 'A', b: 'C', p: [162, 74, 162, 106] },
  { a: 'B', b: 'C', p: [88, 154, 88, 186] }, { a: 'B', b: 'C', p: [162, 154, 162, 186] },
  { a: 'C', b: 'D', p: [198, 130, 268, 130] },
  { a: 'A', b: 'D', p: [304, 74, 304, 112] }, { a: 'B', b: 'D', p: [304, 148, 304, 186] }
];
const EXTRA = [
  { a: 'A', b: 'D', p: [282, 74, 282, 110] }, { a: 'B', b: 'D', p: [282, 150, 282, 186] },
  { a: 'A', b: 'C', p: [124, 74, 124, 104] }
];

export function degrees(list) { const d = { A: 0, B: 0, C: 0, D: 0 }; list.forEach(e => { d[e.a]++; d[e.b]++; }); return d; }
/* a walk that uses every bridge once, by trying them in turn (a handful of bridges, so plain search is instant) */
export function eulerWalk(list) {
  const odd = Object.keys(LAND).filter(k => degrees(list)[k] % 2), used = new Array(list.length).fill(false), path = [];
  if (odd.length !== 0 && odd.length !== 2) return null;
  const starts = odd.length ? odd : Object.keys(LAND).filter(k => degrees(list)[k] > 0);
  function go(at) { if (path.length === list.length) return true;
    for (let i = 0; i < list.length; i++) { if (used[i]) continue; const e = list[i]; if (e.a !== at && e.b !== at) continue; used[i] = true; path.push(i); if (go(e.a === at ? e.b : e.a)) return true; used[i] = false; path.pop(); }
    return false; }
  for (const s of starts) if (go(s)) return { start: s, order: path.slice() };
  return null;
}

function map(g) {
  el('rect', { x: 0, y: 0, width: 380, height: 260, rx: 12, fill: C.sunk }, g);
  el('rect', { x: 0, y: 80, width: 380, height: 100, fill: 'color-mix(in srgb, var(--blue) 35%, var(--panel))' }, g);   // the Pregel
  el('path', { d: 'M266 108H380V152H266Q252 130 266 108Z', fill: C.sunk }, g);                                         // the east land between the two branches
  el('ellipse', { cx: 125, cy: 130, rx: 74, ry: 27, fill: C.sunk }, g);                                                 // Kneiphof island
  for (const k in LAND) label(g, LAND[k][0], LAND[k][1] + (k === 'A' ? -14 : k === 'B' ? 26 : k === 'D' ? 6 : 6), k, { size: 16, w: 600 });
}

export default function (fig) {
  const mode = fig.getAttribute('data-mode') || 'walk';
  const s = svg(fig, 380, 260, mode === 'walk' ? 'A map of the river, its island and seven bridges. Pick a starting land, then cross bridges one at a time.' : 'A map of the river and its bridges, with spare places where a bridge could go.');
  const g = el('g', {}, s), box = controls(fig);
  if (mode === 'walk') walk(fig, g, box); else build(fig, g, box);
}

function bridge(g, e, opts) {
  const [x1, y1, x2, y2] = e.p, b = el('g', { tabindex: opts.click ? 0 : -1, role: opts.click ? 'button' : 'img', 'aria-label': opts.label, style: opts.click ? 'cursor:pointer' : '' }, g);
  el('rect', { x: Math.min(x1, x2) - 13, y: Math.min(y1, y2) - 13, width: Math.abs(x2 - x1) + 26, height: Math.abs(y2 - y1) + 26, fill: 'transparent' }, b);   // a wide target for a finger
  el('path', { d: `M${x1} ${y1}L${x2} ${y2}`, stroke: opts.color, 'stroke-width': opts.w || 9, 'stroke-linecap': 'round', 'stroke-dasharray': opts.dash || '' }, b);
  if (opts.num != null) { const mx = (x1 + x2) / 2, my = (y1 + y2) / 2; el('circle', { cx: mx, cy: my, r: 10, fill: C.panel }, b); label(b, mx, my + 5, String(opts.num), { size: 13, w: 600 }); }
  if (opts.click) { b.addEventListener('click', opts.click); b.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); opts.click(); } }); }
  return b;
}

function walk(fig, g, box) {
  const S = { at: null, path: [], graph: false };
  const [crossed, where] = readouts(fig, ['Bridges crossed', 'You are on']);
  const msg = document.createElement('p'); msg.className = 'nojs'; msg.style.margin = '10px 0 0'; msg.setAttribute('aria-live', 'polite'); fig.insertBefore(msg, box);
  const startBox = controls(fig); fig.insertBefore(startBox, box);
  ['A', 'B', 'C', 'D'].forEach(k => button(startBox, 'Start on ' + k, () => { S.at = k; S.path = []; draw(); }));
  button(box, 'Undo', () => { if (!S.path.length) return; const i = S.path.pop(), e = SEVEN[i]; S.at = e.a === S.at ? e.b : e.a; draw(); });
  button(box, 'Start over', () => { S.at = null; S.path = []; draw(); });
  picker(box, ['Map', 'Graph'], 0, k => { S.graph = k === 1; draw(); });
  function cross(i) { const e = SEVEN[i]; if (!S.at || S.path.includes(i) || (e.a !== S.at && e.b !== S.at)) return; S.path.push(i); S.at = e.a === S.at ? e.b : e.a; draw(); }
  function draw() {
    clear(g);
    if (S.graph) graph(g, SEVEN, S.path); else {
      map(g);
      SEVEN.forEach((e, i) => { const n = S.path.indexOf(i), can = S.at && n < 0 && (e.a === S.at || e.b === S.at);
        bridge(g, e, { color: n >= 0 ? C.orange : can ? C.ink : C.soft, num: n >= 0 ? n + 1 : null, label: 'Bridge from ' + e.a + ' to ' + e.b + (n >= 0 ? ', crossed' : ''), click: () => cross(i) }); });
      if (S.at) { const [x, y] = LAND[S.at]; el('circle', { cx: x + (S.at === 'D' ? -22 : 0), cy: y + (S.at === 'C' ? 0 : S.at === 'D' ? 0 : 6), r: 9, fill: C.blue, stroke: C.panel, 'stroke-width': 3 }, g); }
    }
    const left = S.at ? SEVEN.filter((e, i) => !S.path.includes(i) && (e.a === S.at || e.b === S.at)).length : 1;
    crossed.textContent = S.path.length + ' of 7'; where.textContent = S.at ? S.at + ', ' + NAMES[S.at] : '–';
    msg.textContent = !S.at ? 'Pick a land to start on, then tap a bridge next to you.' : S.path.length === 7 ? 'All seven! (Then the page has a bug: Euler says this cannot happen.)'
      : left === 0 ? 'Stuck: every bridge from here is used. ' + S.path.length + ' of 7. Undo, or start somewhere else.' : 'Tap a dark bridge next to you.';
  }
  draw();
}

/* the map with the land taken away: one dot per land, one line per bridge */
function graph(g, list, path) {
  const P = { A: [190, 40], B: [190, 220], C: [100, 130], D: [290, 130] }, deg = degrees(list), seen = {};
  el('rect', { x: 0, y: 0, width: 380, height: 260, rx: 12, fill: C.sunk }, g);
  list.forEach((e, i) => { const key = [e.a, e.b].sort().join(''), k = seen[key] = (seen[key] || 0) + 1, tot = list.filter(f => [f.a, f.b].sort().join('') === key).length;
    const [x1, y1] = P[e.a], [x2, y2] = P[e.b], bend = (k - (tot + 1) / 2) * 46, mx = (x1 + x2) / 2, my = (y1 + y2) / 2, d = Math.hypot(x2 - x1, y2 - y1), nx = -(y2 - y1) / d, ny = (x2 - x1) / d;
    const n = path ? path.indexOf(i) : -1;
    el('path', { d: `M${x1} ${y1}Q${mx + nx * bend} ${my + ny * bend} ${x2} ${y2}`, stroke: n >= 0 ? C.blue : C.soft, 'stroke-width': n >= 0 ? 4 : 3, fill: 'none' }, g); });
  for (const k in P) { const odd = deg[k] % 2; el('circle', { cx: P[k][0], cy: P[k][1], r: 19, fill: odd ? C.orange : C.green }, g); label(g, P[k][0], P[k][1] + 6, k, { size: 16, w: 600, fill: 'var(--on-accent)' }); label(g, P[k][0] + (k === 'D' ? 50 : k === 'C' ? -48 : 54), P[k][1] + 5, deg[k] + ' bridges', { size: 13, cls: 'soft' }); }
  label(g, 190, 252, 'orange: an odd number of bridges', { size: 12, cls: 'soft' });
}

function build(fig, g, box) {
  const on = SEVEN.map(() => true).concat(EXTRA.map(() => false)), ALL = SEVEN.concat(EXTRA), S = { show: null, graph: false };
  const [oddR, verdict] = readouts(fig, ['Lands with an odd number of bridges', 'A walk over every bridge once']);
  button(box, 'Show a walk', () => { const list = ALL.filter((e, i) => on[i]), w = eulerWalk(list); S.show = w ? w.order.map(j => ALL.indexOf(list[j])) : null; draw(); });
  button(box, 'Back to 1736', () => { ALL.forEach((e, i) => on[i] = i < 7); S.show = null; draw(); });
  picker(box, ['Map', 'Graph'], 0, k => { S.graph = k === 1; draw(); });
  function draw() {
    clear(g);
    const list = ALL.filter((e, i) => on[i]), deg = degrees(list), odd = Object.keys(deg).filter(k => deg[k] % 2), conn = connected(list), w = conn ? eulerWalk(list) : null;
    if (S.graph) graph(g, list, S.show ? S.show.map(i => list.indexOf(ALL[i])) : null); else {
      map(g);
      ALL.forEach((e, i) => { const n = S.show ? S.show.indexOf(i) : -1;
        bridge(g, e, { color: !on[i] ? C.line : n >= 0 ? C.orange : C.ink, dash: on[i] ? '' : '4 5', w: on[i] ? 9 : 6, num: n >= 0 ? n + 1 : null,
          label: (on[i] ? 'Remove the bridge from ' : 'Build a bridge from ') + e.a + ' to ' + e.b, click: () => { on[i] = !on[i]; S.show = null; draw(); } }); });
    }
    oddR.textContent = odd.length ? odd.length + ': ' + odd.join(', ') : 'none';
    verdict.textContent = !conn ? 'No: the lands are cut off' : !w ? 'No: ' + odd.length + ' odd lands is too many' : odd.length ? 'Yes, from ' + odd[0] + ' to ' + odd[1] : 'Yes, and back where you started';
  }
  draw();
}
function connected(list) { const adj = {}; list.forEach(e => { (adj[e.a] = adj[e.a] || []).push(e.b); (adj[e.b] = adj[e.b] || []).push(e.a); }); const keys = Object.keys(adj); if (!keys.length) return false; const seen = new Set([keys[0]]), q = [keys[0]]; while (q.length) { const k = q.pop(); (adj[k] || []).forEach(n => { if (!seen.has(n)) { seen.add(n); q.push(n); } }); } return Object.keys(LAND).every(k => seen.has(k)); }
