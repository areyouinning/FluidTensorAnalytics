/* Kiddo's Puzzle Box: four tap-only thinking puzzles for someone who cannot read yet.
     next    — a repeating pattern of shapes; pick what comes next
     odd     — four shapes; tap the one that is different (colour, then shape, then size)
     grid    — a 3 x 3 square where every row and column has one of each; fill the gaps
     balance — blocks on a scale; pick how many more make it level
   A right answer earns a star; every three right answers a puzzle gets a little harder. The prompts are
   spoken (clips in /audio/puzzles/, made by scripts/gen_puzzle_voice.py) and nothing needs reading. */
import { svg, el, clear, label, controls, button, calm } from './kit.js';

const COL = ['var(--blue)', 'var(--orange)', 'var(--green)', 'var(--purple)', 'var(--gold)', 'var(--red)'];
const KINDS = ['circle', 'square', 'triangle', 'star', 'diamond'];
const INK = 'var(--ink)', SOFT = 'var(--ink-soft)', LINE = 'var(--line)', SUNK = 'var(--sunk)', PANEL = 'var(--panel)', GREEN = 'var(--green)', RED = 'var(--red)';
const TABS = [['next', 'What comes next?'], ['odd', 'Which one is different?'], ['grid', 'What goes in the gap?'], ['balance', 'How many more to make it balance?']];
const rnd = n => Math.floor(Math.random() * n), pick = a => a[rnd(a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function shape(g, it, cx, cy, r) {
  r *= it.s || 1; const f = { fill: COL[it.c], stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' };
  if (it.k === 'circle') return el('circle', { cx, cy, r, ...f }, g);
  if (it.k === 'square') return el('rect', { x: cx - r * .88, y: cy - r * .88, width: r * 1.76, height: r * 1.76, rx: r * .18, ...f }, g);
  let pts = [];
  if (it.k === 'triangle') pts = [[0, -1], [.95, .8], [-.95, .8]];
  else if (it.k === 'diamond') pts = [[0, -1.05], [.85, 0], [0, 1.05], [-.85, 0]];
  else for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? .45 : 1.08; pts.push([Math.cos(a) * q, Math.sin(a) * q]); }
  return el('path', { d: 'M' + pts.map(p => (cx + p[0] * r).toFixed(1) + ' ' + (cy + p[1] * r).toFixed(1)).join('L') + 'Z', ...f }, g);
}
const same = (a, b) => a.k === b.k && a.c === b.c && (a.s || 1) === (b.s || 1);
function items(n) { const ks = shuffle(KINDS), cs = shuffle([0, 1, 2, 3, 4, 5]); return Array.from({ length: n }, (_, i) => ({ k: ks[i], c: cs[i] })); }

export default function (fig) {
  const W = 380, H = 318, s = svg(fig, W, H, 'A puzzle box with four puzzles: patterns, odd one out, a shape grid and a balance scale.');
  const tabsG = el('g', {}, s), starsG = el('g', {}, s), g = el('g', {}, s);
  const box = controls(fig);
  let save = { stars: 0, right: { next: 0, odd: 0, grid: 0, balance: 0 } };
  try { const j = JSON.parse(localStorage.getItem('fta-puzzlebox')); if (j && j.right) save = j; } catch (e) {}
  const keep = () => { try { localStorage.setItem('fta-puzzlebox', JSON.stringify(save)); } catch (e) {} };
  let cur = 'next', round = null, sound = true, busy = false, wrong = -1, good = -1, timer = 0, voice = null;
  const level = () => Math.floor(save.right[cur] / 3);

  function say(name) { if (!sound) return; try { if (voice) voice.pause(); voice = new Audio('/audio/puzzles/' + name + '.mp3'); voice.play().catch(() => {}); } catch (e) {} }
  function tappable(node, name, fn) {
    node.setAttribute('role', 'button'); node.setAttribute('tabindex', '0'); node.setAttribute('aria-label', name); node.style.cursor = 'pointer';
    node.addEventListener('click', fn);
    node.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } });
  }

  /* ---- making a round ---- */
  function make() {
    const L = level();
    if (cur === 'next') {
      const unit = L === 0 ? [0, 1] : L === 1 ? pick([[0, 0, 1], [0, 1, 1]]) : L === 2 ? [0, 1, 2] : pick([[0, 1, 2], [0, 1, 0, 2], [0, 0, 1, 2]]);
      const its = items(3), seq = Array.from({ length: 6 }, (_, i) => its[unit[i % unit.length]]), ans = seq[5];
      const opts = shuffle([ans].concat(its.filter(i => !same(i, ans)).slice(0, 2)));
      return { seq: seq.slice(0, 5), opts, answer: opts.findIndex(o => same(o, ans)) };
    }
    if (cur === 'odd') {
      const base = items(2), how = L === 0 ? 'c' : L === 1 ? 'k' : L === 2 ? 's' : pick(['c', 'k', 's']);
      const odd = how === 'c' ? { k: base[0].k, c: base[1].c } : how === 'k' ? { k: base[1].k, c: base[0].c } : { k: base[0].k, c: base[0].c, s: .55 };
      const at = rnd(4); return { opts: [0, 1, 2, 3].map(i => i === at ? odd : base[0]), answer: at };
    }
    if (cur === 'grid') {
      const its = items(3), p = shuffle([0, 1, 2]), rows = shuffle([0, 1, 2]);
      const cells = rows.map(r => [0, 1, 2].map(c => its[p[(c + r) % 3]]));
      const bc = shuffle([0, 1, 2]), blanks = shuffle([0, 1, 2]).slice(0, Math.min(3, 1 + L)).map(r => r * 3 + bc[r]);   // never two gaps in one row or column, so each has a full row to read
      return { its, cells, blanks, done: 0, ...gridStep(its, cells, blanks, 0) };
    }
    const big = Math.min(9, 4 + 2 * L), left = 2 + rnd(big - 1), need = 1 + rnd(Math.min(left - 1, 2 + L)), right = left - need;
    const nums = shuffle([need].concat(shuffle([1, 2, 3, 4, 5].filter(n => n !== need)).slice(0, 2))).sort((a, b) => a - b);
    return { left, right, opts: nums, answer: nums.indexOf(need), added: 0 };
  }
  function gridStep(its, cells, blanks, done) { const b = blanks[done], ans = cells[Math.floor(b / 3)][b % 3], opts = shuffle(its); return { opts, answer: opts.findIndex(o => same(o, ans)) }; }

  /* ---- drawing ---- */
  function tile(x, y, w, h, i, name) {
    const t = el('g', {}, g);
    el('rect', { x, y, width: w, height: h, rx: 14, fill: PANEL, stroke: i === good ? GREEN : i === wrong ? RED : LINE, 'stroke-width': i === good || i === wrong ? 5 : 2 }, t);
    tappable(t, name, () => choose(i)); return t;
  }
  function drawTabs() {
    clear(tabsG);
    TABS.forEach(([id, name], i) => {
      const x = 10 + i * 92, t = el('g', {}, tabsG), on = id === cur;
      el('rect', { x, y: 6, width: 84, height: 50, rx: 14, fill: on ? 'color-mix(in srgb, var(--gold) 45%, var(--panel))' : SUNK, stroke: on ? INK : LINE, 'stroke-width': on ? 3 : 1.5 }, t);
      const cx = x + 42, cy = 31;
      if (id === 'next') { shape(t, { k: 'circle', c: 0 }, cx - 24, cy, 8); shape(t, { k: 'square', c: 1 }, cx - 4, cy, 8); shape(t, { k: 'circle', c: 0 }, cx + 16, cy, 8); label(t, cx + 32, cy + 6, '?', { size: 17, w: 700 }); }
      if (id === 'odd') { [-24, -8, 8].forEach(d => shape(t, { k: 'circle', c: 2 }, cx + d, cy, 7)); shape(t, { k: 'star', c: 4 }, cx + 26, cy, 9); }
      if (id === 'grid') for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) el('rect', { x: cx - 19 + c * 13, y: cy - 19 + r * 13, width: 11, height: 11, rx: 2, fill: r === 1 && c === 1 ? SUNK : COL[(r + c) % 3], stroke: INK, 'stroke-width': 1 }, t);
      if (id === 'balance') { el('path', { d: `M${cx - 26} ${cy - 6}L${cx + 26} ${cy + 4}M${cx} ${cy - 1}V${cy + 16}M${cx - 10} ${cy + 16}H${cx + 10}`, stroke: INK, 'stroke-width': 2.5, fill: 'none', 'stroke-linecap': 'round' }, t); el('rect', { x: cx - 32, y: cy - 18, width: 11, height: 11, fill: COL[0], stroke: INK }, t); el('rect', { x: cx + 20, y: cy - 8, width: 11, height: 11, fill: COL[1], stroke: INK }, t); }
      tappable(t, name, () => { if (cur !== id || !round) { cur = id; start(); } say(id); });
    });
  }
  function drawStars() {
    clear(starsG); const n = save.stars % 5;
    for (let i = 0; i < 5; i++) { const st = shape(starsG, { k: 'star', c: 4 }, 150 + i * 20, 74, 8); if (i >= n) { st.setAttribute('fill', 'none'); st.setAttribute('stroke', SOFT); st.setAttribute('stroke-width', 1.5); } }
    label(starsG, 262, 79, '× ' + Math.floor(save.stars / 5), { a: 'start', size: 13, w: 700, cls: 'soft' });
    shape(starsG, { k: 'star', c: 4 }, 250, 74, 6);
  }
  function draw() {
    clear(g); const r = round;
    label(g, W / 2, 108, TABS.find(t => t[0] === cur)[1], { size: 15, w: 700 });
    if (cur === 'next') {
      r.seq.forEach((it, i) => shape(g, it, 34 + i * 56, 152, 20));
      el('rect', { x: 34 + 5 * 56 - 24, y: 128, width: 48, height: 48, rx: 10, fill: SUNK, stroke: INK, 'stroke-width': 2, 'stroke-dasharray': '5 4' }, g);
      if (good >= 0) shape(g, r.opts[r.answer], 34 + 5 * 56, 152, 20); else label(g, 34 + 5 * 56, 161, '?', { size: 26, w: 700 });
      r.opts.forEach((it, i) => shape(tile(46 + i * 100, 212, 88, 88, i, 'choice ' + (i + 1)), it, 90 + i * 100, 256, 28));
    } else if (cur === 'odd') {
      r.opts.forEach((it, i) => shape(tile(12 + i * 90, 146, 84, 110, i, 'shape ' + (i + 1)), it, 54 + i * 90, 201, 30));
    } else if (cur === 'grid') {
      const now = r.blanks[r.done];
      for (let k = 0; k < 9; k++) {
        const x = 26 + (k % 3) * 56, y = 124 + Math.floor(k / 3) * 56, hole = r.blanks.indexOf(k) >= r.done && r.blanks.includes(k);
        el('rect', { x, y, width: 50, height: 50, rx: 9, fill: hole ? SUNK : PANEL, stroke: k === now && hole ? INK : LINE, 'stroke-width': k === now && hole ? 3 : 1.5, 'stroke-dasharray': hole ? '5 4' : '' }, g);
        if (!hole) shape(g, r.cells[Math.floor(k / 3)][k % 3], x + 25, y + 25, 17); else if (k === now) label(g, x + 25, y + 34, '?', { size: 24, w: 700 });
      }
      r.opts.forEach((it, i) => shape(tile(222, 122 + i * 62, 132, 54, i, 'choice ' + (i + 1)), it, 288, 149 + i * 62, 20));
    } else {
      const d = r.left - (r.right + r.added), ang = Math.max(-1, Math.min(1, d / 3)) * 12, cx = 190, cy = 150;
      el('path', { d: `M${cx} ${cy}V${cy + 58}M${cx - 30} ${cy + 58}H${cx + 30}`, stroke: INK, 'stroke-width': 4, 'stroke-linecap': 'round' }, g);
      const beam = el('g', { transform: `rotate(${-ang} ${cx} ${cy})` }, g);
      el('path', { d: `M${cx - 120} ${cy}H${cx + 120}`, stroke: INK, 'stroke-width': 4, 'stroke-linecap': 'round' }, beam);
      [[-1, r.left, 0], [1, r.right + r.added, 1]].forEach(([sgn, n, ci]) => {
        const px = cx + sgn * 86; el('path', { d: `M${px - 34} ${cy - 3}H${px + 34}`, stroke: SOFT, 'stroke-width': 5, 'stroke-linecap': 'round' }, beam);
        for (let i = 0; i < n; i++) el('rect', { x: px - 30 + (i % 3) * 21, y: cy - 22 - Math.floor(i / 3) * 19, width: 18, height: 16, rx: 3, fill: COL[ci === 1 && i >= r.right ? 2 : ci], stroke: INK, 'stroke-width': 1.5 }, beam);
      });
      r.opts.forEach((n, i) => {
        const t = tile(46 + i * 100, 226, 88, 84, i, n + ' more');
        label(t, 90 + i * 100, 256, '+' + n, { size: 22, w: 700 });
        for (let k = 0; k < n; k++) el('rect', { x: 90 + i * 100 - n * 7 + k * 14 + 1, y: 268, width: 12, height: 12, rx: 2, fill: COL[2], stroke: INK }, t);
      });
    }
  }

  /* ---- playing ---- */
  function start() { clearTimeout(timer); busy = false; wrong = good = -1; round = make(); drawTabs(); drawStars(); draw(); }
  function choose(i) {
    if (busy) return;
    if (i !== round.answer) { wrong = i; say('again'); draw(); return; }
    wrong = -1; good = i;
    if (cur === 'balance') round.added = round.opts[i];
    if (cur === 'grid' && round.done + 1 < round.blanks.length) {      // more gaps to fill in this square
      round.done++; Object.assign(round, gridStep(round.its, round.cells, round.blanks, round.done)); good = -1; draw(); return;
    }
    if (cur === 'grid') round.done++;
    busy = true; save.stars++; save.right[cur]++; keep();
    say(save.stars % 5 === 0 ? 'star' : 'yes'); drawStars(); draw();
    timer = setTimeout(start, calm() ? 1400 : 1500);
  }

  button(box, 'Say it again', () => say(cur), 'go');
  const snd = button(box, 'Sound: on', () => { sound = !sound; snd.textContent = 'Sound: ' + (sound ? 'on' : 'off'); if (!sound && voice) voice.pause(); });
  button(box, 'Start again from easy', () => { save = { stars: 0, right: { next: 0, odd: 0, grid: 0, balance: 0 } }; keep(); start(); });
  start();
}
