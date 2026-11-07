// The Queens Tiling Challenge. The board logic and exact tile count are unchanged from the original page.
// ---------- configuration ----------
const SUBMIT_TO = "";          // e.g. an email address; empty means submissions are not open yet
const BEST_KNOWN = 3039;
const ROOK_2025 = 2112;
const RECORD = { 8: 12, 9: 14 };
let bestSmall = null, bestBig = null;
const KNOWN = [
  [4, 5, 5, 1], [5, 7, 7, 1], [6, 8, 8, 1], [7, 10, 10, 4], [8, 11, 12, 1],
  [9, 12, 14, 7], [10, 14, 14, 1], [11, 15, 16, 7], [12, 16, 16, 1]
];

// ---------- exact tile count (verified against the Python solvers) ----------
function checkPlacement(p) {
  const n = p.length;
  const seenCol = new Int32Array(n).fill(-1);
  const seenD1 = new Int32Array(2 * n).fill(-1);
  const seenD2 = new Int32Array(2 * n).fill(-1);
  for (let r = 0; r < n; r++) {
    const c = p[r];
    if (!Number.isInteger(c) || c < 0 || c >= n) return { ok: false, reason: "range", row: r };
    if (seenCol[c] >= 0) return { ok: false, reason: "column", pair: [seenCol[c], r] };
    seenCol[c] = r;
    const a = r - c + n, b = r + c;
    if (seenD1[a] >= 0) return { ok: false, reason: "diagonal", pair: [seenD1[a], r] };
    if (seenD2[b] >= 0) return { ok: false, reason: "diagonal", pair: [seenD2[b], r] };
    seenD1[a] = r; seenD2[b] = r;
  }
  return { ok: true };
}

function minTiles(p) {
  const n = p.length;
  const W = n + 1;
  const reg = (r, c) => r >= 0 && r < n && c >= 0 && c < n && p[r] !== c;
  const reflex = new Uint8Array(W * W);
  const rv = [];
  for (let r = 0; r < n; r++) {
    const c = p[r];
    const corners = [[r, c], [r, c + 1], [r + 1, c], [r + 1, c + 1]];
    for (const [i, j] of corners) {
      if (reflex[i * W + j]) continue;
      const k = reg(i - 1, j - 1) + reg(i - 1, j) + reg(i, j - 1) + reg(i, j);
      if (k === 3) { reflex[i * W + j] = 1; rv.push(i, j); }
    }
  }
  const H = [], V = [];
  for (let t = 0; t < rv.length; t += 2) {
    const i = rv[t], j = rv[t + 1];
    let k = j;
    while (reg(i - 1, k) && reg(i, k)) { k++; if (reflex[i * W + k]) { H.push([i, j, k]); break; } }
    k = i;
    while (reg(k, j - 1) && reg(k, j)) { k++; if (reflex[k * W + j]) { V.push([j, i, k]); break; } }
  }
  V.sort((x, y) => x[0] - y[0]);
  const vj = V.map(v => v[0]);
  const lowerBound = (arr, x) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < x) lo = m + 1; else hi = m; } return lo; };
  const upperBound = (arr, x) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] <= x) lo = m + 1; else hi = m; } return lo; };
  const start = new Int32Array(H.length + 1);
  const edges = [];
  for (let u = 0; u < H.length; u++) {
    const [i, j1, j2] = H[u];
    const lo = lowerBound(vj, j1), hi = upperBound(vj, j2);
    for (let v = lo; v < hi; v++) if (V[v][1] <= i && i <= V[v][2]) edges.push(v);
    start[u + 1] = edges.length;
  }
  const M = hopcroftKarp(H.length, V.length, start, Int32Array.from(edges));
  const L = H.length + V.length - M;
  let enclosed = 0;
  for (let r = 1; r < n - 1; r++) if (p[r] > 0 && p[r] < n - 1) enclosed++;
  return rv.length / 2 - L - enclosed + 1;
}

function hopcroftKarp(nU, nV, start, adj) {
  const INF = 1 << 30;
  const matchU = new Int32Array(nU).fill(-1), matchV = new Int32Array(nV).fill(-1);
  const dist = new Int32Array(nU), queue = new Int32Array(nU), it = new Int32Array(nU), stack = new Int32Array(nU + 1);
  let result = 0;
  while (true) {
    let qh = 0, qt = 0, found = false;
    for (let u = 0; u < nU; u++) { if (matchU[u] < 0) { dist[u] = 0; queue[qt++] = u; } else dist[u] = INF; }
    while (qh < qt) {
      const u = queue[qh++];
      for (let e = start[u]; e < start[u + 1]; e++) {
        const w = matchV[adj[e]];
        if (w < 0) found = true; else if (dist[w] === INF) { dist[w] = dist[u] + 1; queue[qt++] = w; }
      }
    }
    if (!found) break;
    for (let u = 0; u < nU; u++) it[u] = start[u];
    for (let s = 0; s < nU; s++) {
      if (matchU[s] >= 0) continue;
      let sp = 0; stack[sp++] = s;
      let augmented = false;
      while (sp > 0 && !augmented) {
        const u = stack[sp - 1];
        let advanced = false;
        while (it[u] < start[u + 1]) {
          const v = adj[it[u]], w = matchV[v];
          if (w < 0) {
            let vv = v;
            for (let q = sp - 1; q >= 0; q--) { const uu = stack[q]; const prev = matchU[uu]; matchU[uu] = vv; matchV[vv] = uu; vv = prev; }
            augmented = true; result++; break;
          }
          if (dist[w] === dist[u] + 1) { stack[sp++] = w; it[u]++; advanced = true; break; }
          it[u]++;
        }
        if (augmented) break;
        if (!advanced) { dist[u] = INF; sp--; }
      }
    }
  }
  return result;
}

function textbook(n) {
  const ev = [], od = [];
  for (let x = 2; x <= n; x += 2) ev.push(x);
  for (let x = 1; x <= n; x += 2) od.push(x);
  let E = ev, O = od;
  if (n % 6 === 2) { O = [3, 1, ...od.slice(2)]; O = [...O.slice(0, 2), ...O.slice(2).filter(x => x !== 5), 5]; }
  if (n % 6 === 3) { E = [...ev.slice(1), 2]; O = [...od.slice(2), 1, 3]; }
  return [...E, ...O].map(x => x - 1);
}

// ---------- shared drawing helpers ----------
const SVGNS = "http://www.w3.org/2000/svg";
function el(name, attrs, parent) {
  const e = document.createElementNS(SVGNS, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
function queenGlyph(parent, r, c, color) {
  const g = el("g", { transform: `translate(${c * 10} ${r * 10})`, fill: color }, parent);
  el("path", { d: "M2 7.3 L1.2 3.4 L3 5.1 L3.4 2.6 L4.4 4.6 L5 2.2 L5.6 4.6 L6.6 2.6 L7 5.1 L8.8 3.4 L8 7.3 Z" }, g);
  for (const [x, y] of [[1.2, 3.4], [3.4, 2.6], [5, 2.2], [6.6, 2.6], [8.8, 3.4]]) el("circle", { cx: x, cy: y, r: 0.55 }, g);
  el("rect", { x: 2, y: 7.7, width: 6, height: 1.2, rx: 0.35 }, g);
  return g;
}
function squares(parent, n) {
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
    el("rect", { x: c * 10, y: r * 10, width: 10, height: 10, fill: (r + c) % 2 ? "var(--square-b)" : "var(--square-a)" }, parent);
}
function tileRect(parent, t, k) {
  return el("rect", {
    x: t.c1 * 10 + 0.7, y: t.r1 * 10 + 0.7,
    width: (t.c2 - t.c1 + 1) * 10 - 1.4, height: (t.r2 - t.r1 + 1) * 10 - 1.4,
    rx: 1.2, fill: `var(--g${k % 8})`, stroke: "var(--tile-edge)", "stroke-width": 0.5
  }, parent);
}

// ---------- hero example ----------
(function hero() {
  const svg = document.getElementById("hero-board");
  const n = 6, q = [1, 3, 5, 0, 2, 4];
  const tiles = [[0,0,2,3],[0,1,4,5],[0,2,0,0],[1,3,1,2],[2,4,3,4],[3,5,5,5],[4,5,0,1],[5,5,2,3]];
  el("rect", { x: -1, y: -1, width: 62, height: 62, rx: 2, fill: "var(--line)" }, svg);
  squares(svg, n);
  tiles.forEach(([r1, r2, c1, c2], k) => tileRect(svg, { r1, r2, c1, c2 }, k));
  q.forEach((c, r) => queenGlyph(svg, r, c, "var(--queen)"));
})();

// ---------- playable boards ----------
const board = document.getElementById("board");
const state = {};
let N = 8;
let mode = "q";
let drag = null;

function blank(n) { return { queens: new Set(), tiles: [] }; }
function key(r, c) { return r * 16 + c; }
function load() {
  for (const n of [8, 9]) {
    state[n] = blank(n);
    try {
      const raw = localStorage.getItem("qtc-board-" + n);
      if (raw) {
        const s = JSON.parse(raw);
        state[n].queens = new Set(s.queens);
        state[n].tiles = s.tiles;
      }
    } catch (e) { /* storage unavailable: start fresh */ }
  }
}
function save() {
  try {
    const s = state[N];
    localStorage.setItem("qtc-board-" + N, JSON.stringify({ queens: [...s.queens], tiles: s.tiles }));
  } catch (e) { /* ignore */ }
}

function queenList(s) { return [...s.queens].map(k => [Math.floor(k / 16), k % 16]); }
function attacks(list) {
  const pairs = [];
  for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
    const [r1, c1] = list[a], [r2, c2] = list[b];
    if (r1 === r2 || c1 === c2 || Math.abs(r1 - r2) === Math.abs(c1 - c2)) pairs.push([a, b]);
  }
  return pairs;
}
function tileAt(s, r, c) { return s.tiles.findIndex(t => r >= t.r1 && r <= t.r2 && c >= t.c1 && c <= t.c2); }
function rectOk(s, r1, r2, c1, c2) {
  for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
    if (s.queens.has(key(r, c)) || tileAt(s, r, c) >= 0) return false;
  }
  return true;
}
function placementOf(s) {
  const list = queenList(s);
  if (list.length !== N || attacks(list).length) return null;
  const p = new Array(N);
  for (const [r, c] of list) p[r] = c;
  return p;
}

function render() {
  const s = state[N];
  board.setAttribute("viewBox", `-1 -1 ${N * 10 + 2} ${N * 10 + 2}`);
  board.replaceChildren();
  el("rect", { x: -1, y: -1, width: N * 10 + 2, height: N * 10 + 2, rx: 2, fill: "var(--line)" }, board);
  squares(board, N);
  s.tiles.forEach((t, k) => tileRect(board, t, k));
  const list = queenList(s);
  const pairs = attacks(list);
  const hot = new Set(pairs.flat());
  for (const [a, b] of pairs) {
    const [r1, c1] = list[a], [r2, c2] = list[b];
    el("line", { x1: c1 * 10 + 5, y1: r1 * 10 + 5, x2: c2 * 10 + 5, y2: r2 * 10 + 5, stroke: "var(--bad)", "stroke-width": 0.8, "stroke-dasharray": "2 1.5", "stroke-linecap": "round" }, board);
  }
  list.forEach(([r, c], i) => queenGlyph(board, r, c, hot.has(i) ? "var(--bad)" : "var(--queen)"));
  if (drag && drag.moved !== undefined && mode === "t") {
    const r1 = Math.min(drag.r0, drag.r), r2 = Math.max(drag.r0, drag.r);
    const c1 = Math.min(drag.c0, drag.c), c2 = Math.max(drag.c0, drag.c);
    const ok = rectOk(s, r1, r2, c1, c2);
    el("rect", {
      x: c1 * 10 + 0.5, y: r1 * 10 + 0.5, width: (c2 - c1 + 1) * 10 - 1, height: (r2 - r1 + 1) * 10 - 1, rx: 1.2,
      fill: ok ? "var(--accent)" : "var(--bad)", "fill-opacity": 0.28, stroke: ok ? "var(--accent)" : "var(--bad)", "stroke-width": 0.8, "stroke-dasharray": "2 1.2"
    }, board);
  }
  status(list, pairs);
}

let parCache = { sig: "", par: null };
function status(list, pairs) {
  const s = state[N];
  const covered = s.tiles.reduce((a, t) => a + (t.r2 - t.r1 + 1) * (t.c2 - t.c1 + 1), 0);
  const left = N * N - list.length - covered;
  document.getElementById("s-queens").innerHTML = `${list.length}<small>/${N}</small>`;
  document.getElementById("s-tiles").textContent = s.tiles.length;
  document.getElementById("s-left").textContent = left;
  const p = placementOf(s);
  let par = null;
  if (p) {
    const sig = N + ":" + p.join(",");
    if (parCache.sig !== sig) parCache = { sig, par: minTiles(p) };
    par = parCache.par;
  }
  document.getElementById("s-par").textContent = par === null ? "–" : par;
  const msg = document.getElementById("msg");
  msg.className = "msg";
  if (pairs.length) {
    msg.className = "msg bad";
    const [a, b] = pairs[0];
    const [r1, c1] = list[a], [r2, c2] = list[b];
    const how = r1 === r2 ? "row" : c1 === c2 ? "column" : "diagonal";
    msg.textContent = `Two queens share a ${how}. Move one of the red queens.`;
  } else if (list.length < N) {
    msg.textContent = `Place ${N - list.length} more ${N - list.length === 1 ? "queen" : "queens"}. No two may share a row, column or diagonal.`;
  } else if (left > 0) {
    msg.textContent = `Queens set. Par for this placement is ${par} tiles (board record ${RECORD[N]}). Cover the ${left} remaining ${left === 1 ? "square" : "squares"}.`;
  } else {
    const n = s.tiles.length;
    if (n === par && par === RECORD[N]) { msg.className = "msg good"; msg.textContent = `Solved in ${n} tiles. That is par and the board record for ${N} × ${N}.`; }
    else if (n === par) { msg.className = "msg good"; msg.textContent = `Solved in ${n} tiles, which is par for these queens. A different placement can reach ${RECORD[N]}.`; }
    else { msg.textContent = `Covered in ${n} tiles. Par for these queens is ${par}, so there is a tiling with ${n - par} fewer.`; }
  }
  document.getElementById("undo").disabled = s.tiles.length === 0;
  document.getElementById("clear-tiles").disabled = s.tiles.length === 0;
  if (left === 0 && pairs.length === 0 && list.length === N) keepBest(N, s.tiles.length);
  showBest();
}

/* --- personal bests, kept on this device only (see fta-best.js) --- */
function keepBest(n, tiles) {
  if (window.FTABest) window.FTABest.record("queens-" + n, tiles, true);
}
function showBest() {
  if (!bestSmall) return;
  const v = window.FTABest.get("queens-" + N);
  bestSmall[0].textContent = v == null ? "not yet" : v + " tiles";
  bestSmall[1].textContent = RECORD[N] + " tiles";
}

function cellOf(e) {
  const b = board.getBoundingClientRect();
  const size = N * 10 + 2;
  const x = ((e.clientX - b.left) / b.width) * size - 1;
  const y = ((e.clientY - b.top) / b.height) * size - 1;
  const c = Math.floor(x / 10), r = Math.floor(y / 10);
  return { r: Math.max(0, Math.min(N - 1, r)), c: Math.max(0, Math.min(N - 1, c)), inside: x >= 0 && y >= 0 && x < N * 10 && y < N * 10 };
}

// Placing queens is a tap, so a phone can still scroll past the board. Laying tiles is a drag, so it holds the finger.
board.addEventListener("click", e => {
  if (mode !== "q") return;
  const { r, c, inside } = cellOf(e);
  if (!inside) return;
  const s = state[N], k = key(r, c);
  if (s.queens.has(k)) s.queens.delete(k);
  else if (tileAt(s, r, c) < 0) s.queens.add(k);
  const wasValid = !!placementOf(s);
  save(); render();
  if (wasValid && s.tiles.length === 0) setMode("t");
});
board.addEventListener("pointerdown", e => {
  if (mode !== "t") return;
  const { r, c, inside } = cellOf(e);
  if (!inside) return;
  e.preventDefault();
  const s = state[N];
  const t = tileAt(s, r, c);
  if (t >= 0) { s.tiles.splice(t, 1); save(); render(); return; }
  if (s.queens.has(key(r, c))) return;
  drag = { r0: r, c0: c, r, c, moved: false };
  board.setPointerCapture(e.pointerId);
  render();
});
board.addEventListener("pointermove", e => {
  if (!drag) return;
  const { r, c } = cellOf(e);
  if (r !== drag.r || c !== drag.c) { drag.r = r; drag.c = c; drag.moved = true; render(); }
});
function endDrag() {
  if (!drag) return;
  const s = state[N];
  const r1 = Math.min(drag.r0, drag.r), r2 = Math.max(drag.r0, drag.r);
  const c1 = Math.min(drag.c0, drag.c), c2 = Math.max(drag.c0, drag.c);
  drag = null;
  if (rectOk(s, r1, r2, c1, c2)) { s.tiles.push({ r1, r2, c1, c2 }); save(); }
  render();
}
board.addEventListener("pointerup", endDrag);
board.addEventListener("pointercancel", () => { drag = null; render(); });

function setMode(m) {
  mode = m;
  board.style.touchAction = m === "q" ? "pan-y" : "none";
  document.getElementById("mode-q").setAttribute("aria-pressed", m === "q");
  document.getElementById("mode-t").setAttribute("aria-pressed", m === "t");
}
document.getElementById("mode-q").addEventListener("click", () => setMode("q"));
document.getElementById("mode-t").addEventListener("click", () => setMode("t"));
document.getElementById("undo").addEventListener("click", () => { state[N].tiles.pop(); save(); render(); });
document.getElementById("clear-tiles").addEventListener("click", () => { state[N].tiles = []; save(); render(); });
document.getElementById("clear-all").addEventListener("click", () => { state[N] = blank(N); save(); setMode("q"); render(); });
document.getElementById("random").addEventListener("click", () => {
  const p = randomQueens(N);
  state[N] = { queens: new Set(p.map((c, r) => key(r, c))), tiles: [] };
  save(); setMode("t"); render();
});
function randomQueens(n) {
  const p = [], cols = new Set(), d1 = new Set(), d2 = new Set();
  const order = () => [...Array(n).keys()].sort(() => Math.random() - 0.5);
  (function rec(r) {
    if (r === n) return true;
    for (const c of order()) {
      if (cols.has(c) || d1.has(r - c) || d2.has(r + c)) continue;
      cols.add(c); d1.add(r - c); d2.add(r + c); p.push(c);
      if (rec(r + 1)) return true;
      p.pop(); cols.delete(c); d1.delete(r - c); d2.delete(r + c);
    }
    return false;
  })(0);
  return p;
}
for (const tab of document.querySelectorAll(".tab")) {
  tab.addEventListener("click", () => {
    N = +tab.dataset.n;
    for (const t of document.querySelectorAll(".tab")) t.setAttribute("aria-pressed", t === tab);
    setMode(placementOf(state[N]) ? "t" : "q");
    render();
  });
}
load();
setMode(placementOf(state[N]) ? "t" : "q");
render();

// ---------- findings table ----------
document.getElementById("known-rows").innerHTML = KNOWN.map(([n, rook, qn, cnt]) =>
  `<tr><td>${n} × ${n}</td><td>${rook}</td><td>${qn}</td><td class="${qn > rook ? "gap-pos" : ""}">${qn > rook ? "+" + (qn - rook) : "0"}</td><td>${cnt}</td></tr>`
).join("");

// ---------- 2025 verifier ----------
const BIG = 2025;
const ta = document.getElementById("placement");
const chip = document.getElementById("big-chip");
const bigMsg = document.getElementById("big-msg");
const canvas = document.getElementById("preview");

function setChip(kind, text) { chip.className = "tag " + kind; chip.textContent = text; }
function fnv(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0").toUpperCase();
}
function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function drawPreview(p, badRows) {
  const ctx = canvas.getContext("2d");
  const S = canvas.width;
  ctx.fillStyle = cssVar("--surface"); ctx.fillRect(0, 0, S, S);
  if (!p) return;
  const k = S / BIG;
  ctx.fillStyle = cssVar("--ink");
  for (let r = 0; r < p.length; r++) {
    const c = p[r];
    if (Number.isInteger(c) && c >= 0 && c < BIG) ctx.fillRect(c * k, r * k, Math.max(1.2, k), Math.max(1.2, k));
  }
  if (badRows) {
    ctx.strokeStyle = cssVar("--bad"); ctx.lineWidth = 2;
    for (const r of badRows) { const c = p[r]; ctx.beginPath(); ctx.arc(c * k, r * k, 7, 0, Math.PI * 2); ctx.stroke(); }
  }
}
function resetBig() {
  document.getElementById("b-tiles").textContent = "–";
  document.getElementById("b-gap").textContent = "–";
  document.getElementById("code-field").hidden = true;
}
function score() {
  resetBig();
  const raw = ta.value.trim();
  if (!raw) { setChip("idle", "Waiting for a placement"); bigMsg.className = "msg"; bigMsg.textContent = "Paste a placement or load a file first."; drawPreview(null); return; }
  const tokens = raw.split(/[\s,;]+/).filter(Boolean);
  const nums = tokens.map(Number);
  const badTok = nums.findIndex(x => !Number.isInteger(x));
  bigMsg.className = "msg bad";
  if (badTok >= 0) { setChip("bad", "Not a placement"); bigMsg.textContent = `Entry ${badTok + 1} ("${tokens[badTok].slice(0, 20)}") is not a whole number.`; drawPreview(null); return; }
  if (nums.length !== BIG) { setChip("bad", "Wrong length"); bigMsg.textContent = `Found ${nums.length.toLocaleString()} numbers. A placement needs exactly 2025, one per row.`; drawPreview(null); return; }
  const lo = Math.min(...nums), hi = Math.max(...nums);
  if (lo === 0 && hi === BIG - 1) { setChip("bad", "Off by one"); bigMsg.textContent = "The columns run from 0 to 2024. Number them from 1 to 2025 instead."; drawPreview(null); return; }
  const p = nums.map(x => x - 1);
  const chk = checkPlacement(p);
  if (!chk.ok) {
    setChip("bad", "Queens attack");
    if (chk.reason === "range") bigMsg.textContent = `Row ${chk.row + 1} has column ${nums[chk.row]}, outside 1 to 2025.`;
    else {
      const [a, b] = chk.pair;
      bigMsg.textContent = chk.reason === "column"
        ? `Rows ${a + 1} and ${b + 1} both use column ${nums[a]}.`
        : `Rows ${a + 1} and ${b + 1} (columns ${nums[a]} and ${nums[b]}) share a diagonal.`;
    }
    drawPreview(p, chk.pair || [chk.row]);
    return;
  }
  setChip("idle", "Counting tiles");
  bigMsg.className = "msg"; bigMsg.textContent = "Valid queens placement. Computing the exact minimum…";
  drawPreview(p);
  setTimeout(() => {
    const t = minTiles(p);
    document.getElementById("b-tiles").textContent = t.toLocaleString();
    document.getElementById("b-gap").textContent = "+" + (t - ROOK_2025).toLocaleString();
    if (t < BEST_KNOWN) { setChip("good", "New best"); bigMsg.className = "msg good"; bigMsg.textContent = `${t.toLocaleString()} tiles beats the best so far (${BEST_KNOWN.toLocaleString()}) by ${(BEST_KNOWN - t).toLocaleString()}.`; }
    else if (t === BEST_KNOWN) { setChip("good", "Valid"); bigMsg.textContent = `${t.toLocaleString()} tiles ties the best so far. Get below ${BEST_KNOWN.toLocaleString()} to set a new best.`; }
    else { setChip("good", "Valid"); bigMsg.textContent = `${t.toLocaleString()} tiles. The best so far is ${BEST_KNOWN.toLocaleString()}.`; }
    const code = `Q2025-${t}-${fnv(p.join(","))}`;
    document.getElementById("code").textContent = code;
    document.getElementById("submit-note").textContent = SUBMIT_TO
      ? `To submit, send your placement file and this code to ${SUBMIT_TO}.`
      : "Keep your placement file. This code only identifies it — the placement itself is the proof, because anyone can paste it in here and watch the number come out the same.";
    document.getElementById("code-field").hidden = false;
    if (window.FTABest) {
      window.FTABest.record("queens-2025", t, true);
      showBigBest();
    }
  }, 20);
}
function showBigBest() {
  if (!bestBig) return;
  const v = window.FTABest.get("queens-2025");
  bestBig[0].textContent = v == null ? "not yet" : v.toLocaleString() + " tiles";
  bestBig[1].textContent = BEST_KNOWN.toLocaleString() + " tiles";
}
document.getElementById("check").addEventListener("click", score);
document.getElementById("load-textbook").addEventListener("click", () => {
  ta.value = textbook(BIG).map(x => x + 1).join(" ");
  score();
});
document.getElementById("file").addEventListener("change", e => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const rd = new FileReader();
  rd.onload = () => { ta.value = String(rd.result); score(); };
  rd.readAsText(f);
});
document.getElementById("copy").addEventListener("click", async () => {
  const code = document.getElementById("code");
  try { await navigator.clipboard.writeText(code.textContent); document.getElementById("copy").textContent = "Copied"; }
  catch (e) { const sel = getSelection(); const rg = document.createRange(); rg.selectNodeContents(code); sel.removeAllRanges(); sel.addRange(rg); document.getElementById("copy").textContent = "Selected"; }
  setTimeout(() => { document.getElementById("copy").textContent = "Copy"; }, 1600);
});
drawPreview(null);
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (ta.value.trim()) score(); else drawPreview(null); });

/* --- bests and board links (fta-best.js) ---
   A warm-up placement is eight or nine numbers, so it fits in a link and the page recomputes
   its par on arrival. The 2025 board cannot: 2025 numbers is far past what a URL will carry,
   so its proof stays the placement itself, pasted or loaded as a file. */
function initBests() {
  const B = window.FTABest;
  if (!B) return;
  bestSmall = B.strip(document.getElementById("best-small"), ["Your best on this device", "Board record"]);
  bestBig = B.strip(document.getElementById("best-big"), ["Your best on this device", "Best so far"]);
  showBest();
  showBigBest();

  B.copier(document.getElementById("random").parentNode, () => {
    const p = placementOf(state[N]);
    return p ? B.share({ q: p.join(",") }) : location.origin + location.pathname;
  }, "Copy board link");

  const raw = (B.parse().q || "").split(",").filter(s => s !== "").map(Number);
  if (raw.length !== 8 && raw.length !== 9) return;
  const n = raw.length;
  if (!raw.every(c => Number.isInteger(c) && c >= 0 && c < n)) return;
  state[n] = { queens: new Set(raw.map((c, r) => key(r, c))), tiles: [] };
  const tab = document.querySelector('.tab[data-n="' + n + '"]');
  if (tab) tab.click(); else { N = n; render(); }
  const par = placementOf(state[n]) ? minTiles(raw) : null;
  if (par !== null) {
    const msg = document.getElementById("msg");
    msg.className = "msg";
    msg.textContent = `Loaded from a link. These queens need ${par} tiles, recomputed here from the placement the link carried. Cover them.`;
  }
}
/* this file is a plain script at the end of the body, so it runs BEFORE the deferred
   fta-best.js. Waiting for DOMContentLoaded puts the init after it. */
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initBests);
else initBests();
