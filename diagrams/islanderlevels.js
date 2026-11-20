/* What did the visitor add? "Someone here has blue eyes" (call it φ), and the tower above it:
   everyone knows φ, everyone knows that everyone knows φ, and so on. Each level is computed from the same model
   of possible worlds as the island diagram: E(X) holds in world w when X holds in w and in every world some islander
   cannot tell apart from w (w with one islander's own eye color flipped). With k blue-eyed islanders, level j
   holds before the visitor speaks exactly when j < k. The announcement makes every level true at once. */
import { svg, el, clear, label, controls, slider, button } from './kit.js';

const N = 10, W = 380;
export function levels(n, actual, visitor, depth) {   // returns [φ, Eφ, EEφ, …] at the actual world
  const worlds = []; for (let v = 0; v < 1 << n; v++) if (!visitor || v) worlds.push(v);
  const inS = new Set(worlds);
  let X = new Set(worlds.filter(v => v !== 0)); const out = [X.has(actual)];
  for (let j = 1; j <= depth; j++) {
    const Y = new Set(); for (const w of worlds) { if (!X.has(w)) continue; let ok = true; for (let i = 0; i < n && ok; i++) { const u = w ^ (1 << i); if (inS.has(u) && !X.has(u)) ok = false; } if (ok) Y.add(w); }
    X = Y; out.push(X.has(actual));
  }
  return out;
}

export default function (fig) {
  let H = 300; const s = svg(fig, W, H, 'A tower of statements: someone has blue eyes, everyone knows it, everyone knows everyone knows it, and so on, each marked true or false before and after the visitor speaks.');
  const g = el('g', {}, s), box = controls(fig), box2 = controls(fig);
  let k = 4, visitor = false;
  function draw() {
    clear(g);
    const depth = Math.min(10, k + 1), L = levels(N, (1 << k) - 1, visitor, depth), rows = L.length, rh = 28;
    H = rows * rh + 26; s.setAttribute('viewBox', `0 0 ${W} ${H}`);
    for (let j = 0; j < rows; j++) {
      const y = H - 14 - (j + 1) * rh, ok = L[j];
      el('rect', { x: 14, y, width: W - 28, height: rh - 4, rx: 6, fill: ok ? 'color-mix(in srgb, var(--green) 30%, var(--panel))' : 'var(--sunk)', stroke: ok ? 'var(--green)' : 'var(--line)' }, g);
      const txt = j === 0 ? 'Someone here has blue eyes.' : (j === 1 ? 'Everyone knows that.' : 'Everyone knows that ×' + j + '.');
      label(g, 24, y + rh / 2 + 2, (j === 0 ? '' : 'Level ' + j + ': ') + txt, { size: 13, a: 'start', w: j === k ? 700 : 400, fill: ok ? 'var(--ink)' : 'var(--ink-soft)' });
      label(g, W - 24, y + rh / 2 + 2, ok ? 'true' : 'not true', { size: 13, a: 'end', w: 700, fill: ok ? 'var(--green)' : 'var(--ink-soft)' });
    }
    const first = L.indexOf(false);
    label(g, W / 2, H - 2, visitor ? 'After the visitor: every level is true, all the way up.' : first < 0 ? '' : 'Before the visitor: true up to level ' + (first - 1) + ', not true from level ' + first + '.', { size: 11, cls: 'soft' });
  }
  const vb = button(box, 'Visitor speaks', () => { visitor = !visitor; vb.textContent = visitor ? 'Before the visitor' : 'Visitor speaks'; draw(); }, 'go');
  slider(box2, 'Blue-eyed', 1, 9, 1, k, x => String(x), x => { k = +x; draw(); });
  draw();
}
