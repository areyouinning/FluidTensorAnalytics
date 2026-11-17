/* A single-photon Mach–Zehnder interferometer. With the second beamsplitter IN, the two paths
   interfere and the photon lands where the phase sends it (wave). With it OUT, the paths stay
   separate: 50/50, and which detector fires tells you which path it took (particle).
   The "decide late" switch flips the beamsplitter after the photon has passed the first one —
   the statistics are identical, which is Wheeler's point. No photon "decides" anything early. */
import { svg, el, clear, label, controls, slider, button, picker, readouts, C, calm } from './kit.js';

const INK = 'var(--ink)', SOFT = 'var(--ink-soft)', LINE = 'var(--line)', BLUE = 'var(--blue)', ORANGE = 'var(--orange)', GREEN = 'var(--green)', GOLD = 'var(--gold)', PANEL = 'var(--panel)';
// key points of the square interferometer
const SRC = [16, 185], BS1 = [60, 185], MUP = [60, 55], MLO = [300, 185], BS2 = [300, 55], D1 = [300, 18], D2 = [352, 55];
const ENTER = [SRC, BS1], UP = [BS1, MUP, BS2], LO = [BS1, MLO, BS2], OUT1 = [BS2, D1], OUT2 = [BS2, D2];

function along(poly, t) {           // point at fraction t (0..1) along a polyline
  let total = 0; const segs = [];
  for (let i = 0; i < poly.length - 1; i++) { const d = Math.hypot(poly[i + 1][0] - poly[i][0], poly[i + 1][1] - poly[i][1]); segs.push(d); total += d; }
  let want = t * total;
  for (let i = 0; i < segs.length; i++) { if (want <= segs[i] || i === segs.length - 1) { const f = segs[i] ? want / segs[i] : 0; return [poly[i][0] + (poly[i + 1][0] - poly[i][0]) * f, poly[i][1] + (poly[i + 1][1] - poly[i][1]) * f]; } want -= segs[i]; }
  return poly[poly.length - 1];
}

export default function (fig) {
  const s = svg(fig, 380, 262, 'A Mach–Zehnder interferometer with two detectors, a phase control and a switchable second beamsplitter.');
  const base = el('g', {}, s), fringe = el('g', {}, s), photons = el('g', {}, s), hud = el('g', {}, s);
  const box = controls(fig), box2 = controls(fig);
  const [p1R, p2R, whichR] = readouts(fig, ['Lands at D1', 'Lands at D2', 'Which path?']);

  let bs2 = true, phi = 0, late = false, counts = { d1: 0, d2: 0 }, live = [], raf = 0, seen = true, spawnT = 0;
  const pD1 = () => bs2 ? Math.sin(phi / 2) ** 2 : 0.5;   // interference when BS2 is in; else 50/50

  function drawBase() {
    clear(base);
    const beam = (poly, on) => { let d = 'M' + poly[0][0] + ' ' + poly[0][1]; for (let i = 1; i < poly.length; i++) d += 'L' + poly[i][0] + ' ' + poly[i][1]; el('path', { d, fill: 'none', stroke: on ? GOLD : LINE, 'stroke-width': on ? 3 : 2, 'stroke-dasharray': on ? '' : '5 5', opacity: on ? .5 : 1 }, base); };
    beam(UP, true); beam(LO, true); beam(ENTER, true);
    beam(OUT1, bs2 || true); beam(OUT2, bs2 || true);
    const mirror = (p, ang) => { el('rect', { x: p[0] - 11, y: p[1] - 3, width: 22, height: 6, rx: 1, fill: INK, transform: `rotate(${ang} ${p[0]} ${p[1]})` }, base); };
    mirror(MUP, 45); mirror(MLO, 45);
    // beamsplitters: BS1 always there; BS2 only when "in"
    el('rect', { x: BS1[0] - 12, y: BS1[1] - 4, width: 24, height: 8, rx: 1, fill: 'color-mix(in srgb, var(--blue) 45%, var(--panel))', stroke: BLUE, 'stroke-width': 1.5, transform: `rotate(45 ${BS1[0]} ${BS1[1]})` }, base);
    label(base, BS1[0] - 16, BS1[1] + 20, 'BS1', { a: 'start', size: 11, cls: 'soft' });
    if (bs2) { el('rect', { x: BS2[0] - 12, y: BS2[1] - 4, width: 24, height: 8, rx: 1, fill: 'color-mix(in srgb, var(--blue) 45%, var(--panel))', stroke: BLUE, 'stroke-width': 1.5, transform: `rotate(45 ${BS2[0]} ${BS2[1]})` }, base); }
    label(base, BS2[0] + 16, BS2[1] - 10, bs2 ? 'BS2 in' : 'BS2 out', { a: 'start', size: 11, w: 600, fill: bs2 ? BLUE : SOFT });
    // detectors
    [[D1, 'D1'], [D2, 'D2']].forEach(([p, nm]) => { el('rect', { x: p[0] - 10, y: p[1] - 10, width: 20, height: 20, rx: 4, fill: PANEL, stroke: INK, 'stroke-width': 2 }, base); label(base, p[0], p[1] + 5, nm, { size: 12, w: 700 }); });
    label(base, SRC[0] - 2, SRC[1] + 4, '•', { a: 'start', size: 20, fill: GOLD });
  }

  function drawFringe() {
    clear(fringe);
    const x0 = 24, x1 = 236, yB = 242, yT = 212, w = x1 - x0, yof = p => yB - (yB - yT) * p;
    el('path', { d: `M${x0} ${yB}H${x1}`, stroke: LINE }, fringe); el('path', { d: `M${x0} ${yT}H${x1}`, stroke: LINE, 'stroke-dasharray': '2 3' }, fringe);
    label(fringe, x0 - 4, yT + 4, '1', { a: 'end', size: 10, cls: 'soft' }); label(fringe, x0 - 4, yB + 3, '0', { a: 'end', size: 10, cls: 'soft' });
    label(fringe, x1 + 6, (yB + yT) / 2 + 3, 'P(D1)', { a: 'start', size: 11, cls: 'soft' });
    let d = '';
    for (let i = 0; i <= 80; i++) { const ph = i / 80 * 2 * Math.PI, p = bs2 ? Math.sin(ph / 2) ** 2 : 0.5, x = x0 + i / 80 * w; d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + yof(p).toFixed(1); }
    el('path', { d, fill: 'none', stroke: bs2 ? BLUE : SOFT, 'stroke-width': 2.5 }, fringe);
    label(fringe, (x0 + x1) / 2, yB + 14, bs2 ? 'interference fringes, as the phase turns' : 'flat 50/50 — no interference', { size: 11, cls: 'soft' });
    const cx = x0 + (phi / (2 * Math.PI)) * w; el('line', { x1: cx, y1: yT - 2, x2: cx, y2: yB, stroke: ORANGE, 'stroke-width': 1.5 }, fringe);
    el('circle', { cx, cy: yof(pD1()), r: 3.5, fill: ORANGE }, fringe);
  }

  function drawHud() {
    clear(hud);
    const total = counts.d1 + counts.d2;
    label(hud, D1[0] + 16, D1[1] + 4, String(counts.d1), { a: 'start', size: 13, w: 700, fill: BLUE });
    label(hud, D2[0] - 2, D2[1] + 22, String(counts.d2), { a: 'middle', size: 13, w: 700, fill: BLUE });
    p1R.textContent = (pD1() * 100).toFixed(0) + '%' + (total ? ' · ' + (100 * counts.d1 / total).toFixed(0) + '% so far' : '');
    p2R.textContent = ((1 - pD1()) * 100).toFixed(0) + '%' + (total ? ' · ' + (100 * counts.d2 / total).toFixed(0) + '% so far' : '');
    whichR.textContent = bs2 ? 'hidden (paths interfere)' : 'known — the detector tells you';
  }

  function fire(n) {   // add n photons to the tally instantly
    for (let i = 0; i < n; i++) { if (Math.random() < pD1()) counts.d1++; else counts.d2++; }
    drawHud(); drawFringe();
  }

  /* one animated photon: enter, split into two ghosts along both arms, then one solid dot to a detector */
  function spawn() { live.push({ t: 0, phase: 'enter', det: Math.random() < pD1() ? 1 : 2, flipped: false }); }
  function step(dt) {
    for (let k = live.length - 1; k >= 0; k--) { const p = live[k]; p.t += dt / (p.phase === 'enter' ? 0.5 : p.phase === 'split' ? 0.9 : 0.5);
      if (p.phase === 'split' && late && !p.flipped && p.t > 0.5) p.flipped = true;   // the "decide late" flip happens mid-flight
      if (p.t >= 1) { p.t = 0; if (p.phase === 'enter') p.phase = 'split'; else if (p.phase === 'split') p.phase = 'exit'; else { if (p.det === 1) counts.d1++; else counts.d2++; live.splice(k, 1); drawHud(); drawFringe(); } }
    }
    clear(photons);
    for (const p of live) {
      if (p.phase === 'enter') dot(along(ENTER, p.t), GOLD, 1);
      else if (p.phase === 'split') { dot(along(UP, p.t), GOLD, .5); dot(along(LO, p.t), GOLD, .5); }
      else dot(along(p.det === 1 ? OUT1 : OUT2, p.t), GOLD, 1);
    }
  }
  function dot(p, col, op) { el('circle', { cx: p[0], cy: p[1], r: 4, fill: col, opacity: op }, photons); }

  function loop(now) { raf = 0; if (!seen) return; const dt = Math.min(0.05, (now - (loop.last || now)) / 1000); loop.last = now;
    if (!calm()) { spawnT += dt; if (spawnT > 1.1 && live.length < 2) { spawnT = 0; spawn(); } step(dt); }
    if (!calm()) raf = requestAnimationFrame(loop); }
  function kick() { if (!raf && !calm()) { loop.last = 0; raf = requestAnimationFrame(loop); } }

  picker(box, ['Beamsplitter in (wave)', 'Beamsplitter out (which-path)'], 0, k => { bs2 = k === 0; counts = { d1: 0, d2: 0 }; drawBase(); drawFringe(); drawHud(); });
  slider(box, 'Phase, ° ', 0, 360, 5, 0, v => v + '°', v => { phi = v * Math.PI / 180; drawFringe(); drawHud(); });
  button(box2, 'Fire 100', () => fire(100), 'go');
  button(box2, 'Reset counts', () => { counts = { d1: 0, d2: 0 }; drawHud(); drawFringe(); });
  picker(box2, ['Choose early', 'Choose late'], 0, k => { late = k === 1; });

  new IntersectionObserver(es => { seen = es[0].isIntersecting; if (seen) kick(); }).observe(s);
  drawBase(); drawFringe(); drawHud(); kick();
}
