/* Bird by bird: the Strouhal number St = f · A / U from wingbeat frequency f, wingtip travel A and flight speed U.
   The presets are rounded ballpark figures with ranges, not measurements; A is taken as a fraction of the wingspan (0.4 to 0.7).
   The shaded band is the published finding for measured cruising flyers, St about 0.2 to 0.4 (Taylor, Nudds & Thomas, Nature 2003). */
import { svg, el, clear, label, controls, button, slider, readouts, C } from './kit.js';

export const BIRDS = [
  { k: 'Ruby-throated hummingbird', short: 'Hummingbird', f: [45, 55], b: 0.10, U: [8, 12] },
  { k: 'House sparrow', f: [12, 18], b: 0.24, U: [7, 11] },
  { k: 'Rock pigeon', f: [5, 8], b: 0.65, U: [12, 18] },
  { k: 'Mallard', f: [4.5, 6], b: 0.9, U: [15, 22] },
  { k: 'Canada goose', f: [2.5, 4], b: 1.6, U: [15, 21] },
  { k: 'Mute swan', f: [2.5, 3.5], b: 2.2, U: [14, 20] }
];
const AMP = [0.4, 0.7];
export const stOf = (f, A, U) => f * A / U;
export const range = q => [stOf(q.f[0], AMP[0] * q.b, q.U[1]), stOf(q.f[1], AMP[1] * q.b, q.U[0])];

export default function (fig) {
  const s = svg(fig, 380, 250, 'For each bird, a bar showing the range of its Strouhal number from ballpark inputs, against the band where measured cruising flyers sit.');
  const g = el('g', {}, s), pick = controls(fig), box = controls(fig), go = controls(fig);
  const [stR, vR, aR] = readouts(fig, ['Strouhal number, f · A / U', 'Vortices shed per second', 'Wingtip travel, A']);
  const mid = q => [(q.f[0] + q.f[1]) / 2, (q.U[0] + q.U[1]) / 2];
  const S = { i: 2, f: 0, b: 0, U: 0, a: 0.55 };
  const X = v => 150 + v / .5 * 216;

  function draw() {
    clear(g);
    el('rect', { x: X(.2), y: 8, width: X(.4) - X(.2), height: 6 * 34 + 6, rx: 6, fill: 'color-mix(in srgb, var(--green) 18%, var(--panel))' }, g);
    label(g, (X(.2) + X(.4)) / 2, 230, 'measured cruising flyers', { size: 12, cls: 'soft' });
    [0, .1, .2, .3, .4, .5].forEach(v => label(g, X(v), 246, v.toFixed(1), { size: 11, cls: 'soft mono' }));
    BIRDS.forEach((q, j) => {
      const y = 26 + j * 34, [lo, hi] = range(q), on = j === S.i;
      label(g, 142, y + 5, q.short || q.k, { a: 'end', size: 13, w: on ? 600 : 400 });
      el('rect', { x: X(lo), y: y - 4, width: X(Math.min(hi, .5)) - X(lo), height: 8, rx: 4, fill: on ? C.blue : C.line }, g);
      if (on) el('circle', { cx: X(Math.min(.5, stOf(S.f, S.a * S.b, S.U))), cy: y, r: 7, fill: C.orange, stroke: C.panel, 'stroke-width': 2 }, g);
    });
    const St = stOf(S.f, S.a * S.b, S.U);
    stR.textContent = St.toFixed(2) + (St < .2 ? ', below the band' : St > .4 ? ', above the band' : ', in the band');
    vR.textContent = 'about ' + Math.round(2 * S.f) + ' (two a beat)';
    aR.textContent = (S.a * S.b * 100).toFixed(0) + ' cm';
  }
  const sF = slider(box, 'Wingbeats a second ', 1, 60, .5, 6, v => v.toFixed(1), v => { S.f = v; draw(); });
  const sU = slider(box, 'Speed, m/s ', 3, 25, .5, 15, v => v.toFixed(1), v => { S.U = v; draw(); });
  const sB = slider(box, 'Wingspan, m ', .05, 2.5, .01, .65, v => v.toFixed(2), v => { S.b = v; draw(); });
  const sA = slider(box, 'Tip travel, share of span ', .3, .8, .01, .55, v => v.toFixed(2), v => { S.a = v; draw(); });
  function set(input, v) { input.value = v; input.dispatchEvent(new Event('input')); }
  function preset(j) { S.i = j; const q = BIRDS[j], [f, U] = mid(q); Object.assign(S, { f, U, b: q.b, a: .55 }); set(sF, f); set(sU, U); set(sB, q.b); set(sA, .55); pbs.forEach((b, k) => b.setAttribute('aria-pressed', k === j)); }
  const pbs = BIRDS.map((q, j) => button(pick, q.k, () => preset(j)));
  button(go, 'Flap at this number in the wing tank', () => window.dispatchEvent(new CustomEvent('fta:st', { detail: stOf(S.f, S.a * S.b, S.U) })), 'go');
  preset(2);
}
