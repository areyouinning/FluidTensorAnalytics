/* The blue-eyed islanders, simulated exactly. A "world" is a pattern of eye colours: a bitmask, bit i set when
   islander i has blue eyes. Islander i cannot tell world v from v with bit i flipped (they see everyone else).
   S is the set of worlds still possible as common knowledge. The visitor's announcement removes the world with
   no blue eyes. Each dawn, i leaves in world v if v ^ (1 << i) is no longer in S. Everyone sees who left, so S
   keeps only the worlds in which the same people would have left (a public announcement, in the logic of
   knowledge). With k blue-eyed islanders the blue ones leave on dawn k, and, since everyone knows eyes are
   blue or brown, the brown ones work it out and leave on dawn k + 1. Without the visitor nobody ever leaves. */
import { svg, el, clear, label, controls, slider, button, readouts, put } from './kit.js';

const BLUE = 'var(--blue)', BROWN = '#8a5a33', INK = 'var(--ink)', SOFT = 'var(--ink-soft)', PANEL = 'var(--panel)', GREEN = 'var(--green)', ORANGE = 'var(--orange)';
const N = 10, W = 380, H = 290, CX = 170, CY = 150, R = 96;

export function sim(n, actual, visitor, days) {
  let S = []; for (let v = 0; v < 1 << n; v++) if (!visitor || v) S.push(v);
  let set = new Set(S), gone = 0; const out = [];
  for (let d = 1; d <= days; d++) {
    const leavers = v => { let m = 0; for (let i = 0; i < n; i++) if (!(gone >> i & 1) && !set.has(v ^ (1 << i))) m |= 1 << i; return m; };
    const L = leavers(actual), keep = S.filter(v => leavers(v) === L);
    out.push(L); gone |= L; S = keep; set = new Set(S);
  }
  return out;
}
const pop = m => { let c = 0; while (m) { c += m & 1; m >>= 1; } return c; };

export default function (fig) {
  const s = svg(fig, W, H, 'Ten islanders around an island, some with blue eyes. Step through the nights after the visitor speaks and see who works out their own eye colour.');
  const g = el('g', {}, s);
  const box = controls(fig), box2 = controls(fig);
  const [dayR, goneR, statusR] = readouts(fig, ['Dawn', 'Gone so far', 'What happened']);
  const think = document.createElement('p'); think.className = 'think'; think.setAttribute('aria-live', 'polite'); put(fig, think);
  let k = 4, visitor = true, day = 0, pick = 0, hist = [];
  const actual = () => (1 << k) - 1;      // islanders 0..k-1 have blue eyes
  const blue = i => i < k;

  function run() { hist = sim(N, actual(), visitor, 12); }
  const goneBy = d => hist.slice(0, d).reduce((a, b) => a | b, 0);
  const dawnOf = i => { for (let d = 0; d < hist.length; d++) if (hist[d] >> i & 1) return d + 1; return 0; };

  function face(i, x, y, gone) {
    const node = el('g', { role: 'button', tabindex: '0', 'aria-label': 'Islander ' + (i + 1) + (gone ? ', gone' : '') + ', ' + (blue(i) ? 'blue' : 'brown') + ' eyes', style: 'cursor:pointer', opacity: gone ? .28 : 1 }, g);
    el('circle', { cx: x, cy: y, r: 17, fill: 'color-mix(in srgb, var(--ink) 12%, var(--panel))', stroke: i === pick ? ORANGE : INK, 'stroke-width': i === pick ? 3.5 : 1.6 }, node);
    [-6, 6].forEach(dx => { el('circle', { cx: x + dx, cy: y - 3, r: 3.6, fill: blue(i) ? BLUE : BROWN }, node); });
    el('path', { d: `M${x - 6} ${y + 7}Q${x} ${y + 11} ${x + 6} ${y + 7}`, fill: 'none', stroke: INK, 'stroke-width': 1.4 }, node);
    label(node, x, y + 31, String(i + 1), { size: 10, cls: 'soft' });
    const tap = () => { pick = i; draw(); };
    node.addEventListener('click', tap); node.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(); } });
  }
  function draw() {
    clear(g);
    el('ellipse', { cx: CX, cy: CY, rx: 132, ry: 124, fill: 'color-mix(in srgb, var(--green) 14%, transparent)', stroke: 'color-mix(in srgb, var(--green) 40%, transparent)', 'stroke-width': 2 }, g);
    // the dock and ferry
    el('rect', { x: 312, y: 136, width: 34, height: 8, fill: SOFT, opacity: .6 }, g);
    el('path', { d: 'M332 156h40l-6 14h-28z', fill: 'color-mix(in srgb, var(--ink) 55%, transparent)' }, g);
    label(g, 352, 186, 'ferry', { size: 10, cls: 'soft' });
    const G = goneBy(day);
    for (let i = 0; i < N; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / N; face(i, CX + R * Math.cos(a), CY + R * .92 * Math.sin(a), G >> i & 1); }
    // the departed sit on the ferry
    let j = 0; for (let i = 0; i < N; i++) if (G >> i & 1) { el('circle', { cx: 314 + (j % 5) * 12, cy: 206 + Math.floor(j / 5) * 12, r: 4.5, fill: blue(i) ? BLUE : BROWN }, g); j++; }
    label(g, CX, CY - 4, visitor ? '“At least one of you' : 'No visitor.', { size: 11, cls: 'soft' });
    label(g, CX, CY + 11, visitor ? 'has blue eyes.”' : 'Nobody says anything.', { size: 11, cls: 'soft' });
    dayR.textContent = day === 0 ? 'none yet' : String(day);
    goneR.textContent = pop(G) ? pop(G & actual()) + ' blue, ' + pop(G & ~actual()) + ' brown' : 'nobody';
    const L = day ? hist[day - 1] : 0;
    statusR.textContent = day === 0 ? 'the ferry has not come yet' : L ? pop(L) + ' left this dawn' : 'nobody left';
    explain();
  }
  function explain() {
    const i = pick, b = k - (blue(i) ? 1 : 0), d = dawnOf(i), G = goneBy(day);
    let t = `Islander ${i + 1} can see ${b} blue-eyed islander${b === 1 ? '' : 's'}. `;
    if (!visitor) t += b === 0 ? 'Without the visitor, nothing rules out that nobody here has blue eyes, so they cannot tell their own colour. They never will.'
      : `If their own eyes are brown, those ${b} would be reasoning about a smaller group, and at the bottom of that chain is a world with no blue eyes at all, which nothing rules out. So no dawn is ever special, and nobody leaves.`;
    else if (b === 0) t += 'But the visitor saw blue eyes. They can only be their own, so they leave on the first dawn.';
    else {
      t += `If their own eyes are brown, those ${b} are the only blue-eyed islanders and will all work it out and leave on dawn ${b}. If their eyes are blue, nobody can be sure until dawn ${b} passes with everyone still here. `;
      if (G >> i & 1) t += `Dawn ${d} settled it: they left with eyes ${blue(i) ? 'blue' : 'brown'}.`;
      else if (day >= b && blue(i)) t += `Dawn ${b} passed and nobody left, so their eyes must be blue. They leave on dawn ${b + 1}.`;
      else if (day >= b && !blue(i)) t += `Dawn ${b} came and all ${b} left, without them. So their own eyes are not blue: brown. They leave on dawn ${b + 1}.`;
      else t += `It is ${day ? 'after dawn ' + day : 'the visitor’s day'}, so they cannot tell yet.`;
    }
    think.textContent = t;
  }
  button(box, 'Next dawn', () => { if (day < 12) day++; draw(); }, 'go');
  button(box, 'Start over', () => { day = 0; draw(); });
  const vb = button(box, 'Without the visitor', () => { visitor = !visitor; vb.textContent = visitor ? 'Without the visitor' : 'With the visitor'; day = 0; run(); draw(); });
  slider(box2, 'Blue-eyed', 1, 10, 1, k, x => String(x), x => { k = +x; day = 0; pick = Math.min(pick, N - 1); run(); draw(); });
  run(); draw();
}
