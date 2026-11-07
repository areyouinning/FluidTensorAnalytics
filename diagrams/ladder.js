/* The cosmic distance ladder, one rung at a time. Each rung uses the one below it.
   data-rung="earth" | "moon" | "sun" | "stars" | "scale". All numbers are worked out from the sliders as you move them. */
import { svg, el, clear, label, controls, slider, readouts, C } from './kit.js';

const DEG = Math.PI / 180, R_EARTH = 6371, MOON = 384400, AU = 149.6e6;
const km = v => v >= 1e6 ? (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + ' million km' : Math.round(v).toLocaleString('en-US') + ' km';
const off = (v, truth) => { const r = v / truth; return Math.abs(r - 1) < .005 ? 'spot on' : r > 1 ? ((r - 1) * 100).toFixed(0) + '% too big' : ((1 - r) * 100).toFixed(0) + '% too small'; };
/* shared across the rungs on the page, so a change low on the ladder carries up */
const L = { R: 800 * 360 / 7.2 / (2 * Math.PI), moon: 0, onR: [], onMoon: [] };   // the Earth rung feeds the Moon rung, which feeds the Sun rung

export function earth(d, ang) { const C = d * 360 / ang; return { C, R: C / (2 * Math.PI) }; }
export function moon(R, n, ang) { const dm = 2 * R / (n + 1); return { dm, D: dm / (ang * DEG) }; }
export function sun(Dm, th) { const k = 1 / Math.cos(th * DEG); return { k, D: Dm * k }; }
export function stars(p) { return { pc: 1 / p, ly: 3.2616 / p }; }

export default function (fig) {
  const rung = fig.getAttribute('data-rung');
  const s = svg(fig, 380, 220, ''), g = el('g', {}, s), box = controls(fig);
  if (rung === 'earth') {
    s.setAttribute('aria-label', 'The Earth with two cities: the Sun is overhead at one and casts a shadow at the other.');
    const [cR, rR] = readouts(fig, ['Around the Earth', 'Radius']); let d = 800, a = 7.2;
    const draw = () => { clear(g); const r = earth(d, a); L.R = r.R; L.onR.forEach(f => f());
      el('circle', { cx: 120, cy: 120, r: 90, fill: C.sunk, stroke: C.line }, g);
      const t = -Math.PI / 2, t2 = t + a * DEG * 4, p1 = [120 + 90 * Math.cos(t), 120 + 90 * Math.sin(t)], p2 = [120 + 90 * Math.cos(t2), 120 + 90 * Math.sin(t2)];
      el('path', { d: `M120 120L${p1[0]} ${p1[1]}M120 120L${p2[0]} ${p2[1]}`, stroke: C.soft, 'stroke-dasharray': '4 3', fill: 'none' }, g);
      for (let k = 0; k < 4; k++) el('path', { d: `M${360} ${12 + k * 14}L${p1[0] + 40 + k * 6} ${12 + k * 14}`, stroke: 'var(--gold)', 'stroke-width': 2, fill: 'none' }, g);
      el('path', { d: `M${p1[0]} ${p1[1]}L${p1[0]} ${p1[1] - 30}`, stroke: C.ink, 'stroke-width': 3 }, g);
      el('path', { d: `M${p2[0]} ${p2[1]}l${Math.cos(t2) * 30} ${Math.sin(t2) * 30}`, stroke: C.ink, 'stroke-width': 3 }, g);
      label(g, p1[0], p1[1] - 36, 'Syene: no shadow', { size: 12 }); label(g, p2[0] + 50, p2[1] - 30, 'Alexandria: ' + a.toFixed(1) + '°', { size: 12, a: 'start' });
      label(g, 120, 128, a.toFixed(1) + '° at the centre', { size: 12, cls: 'soft' });
      label(g, 300, 120, 'sunlight arrives', { size: 12, cls: 'soft' }); label(g, 300, 136, 'in parallel rays', { size: 12, cls: 'soft' });
      cR.textContent = km(r.C) + ' (' + off(r.C, 40075) + ')'; rR.textContent = km(r.R) + ' (' + off(r.R, R_EARTH) + ')'; };
    slider(box, 'Shadow angle at Alexandria, ° ', 5, 10, .1, a, v => v.toFixed(1), v => { a = v; draw(); });
    slider(box, 'Distance between the cities, km ', 600, 1000, 5, d, v => String(v), v => { d = v; draw(); });
    draw();
  } else if (rung === 'moon') {
    s.setAttribute('aria-label', 'A lunar eclipse: the Moon crossing the Earth\'s shadow, which is a few Moons wide.');
    const [dR, DR] = readouts(fig, ['Moon across', 'Moon distance']); let n = 2.6, a = .52;
    const draw = () => { clear(g); const r = moon(L.R, n, a); L.moon = r.D; L.onMoon.forEach(f => f());
      const mr = 14, sw = mr * 2 * n;
      el('rect', { x: 40, y: 110 - sw / 2, width: 300, height: sw, rx: sw / 2, fill: C.sunk }, g);
      label(g, 190, 110 - sw / 2 - 8, 'the Earth\'s shadow, ' + n.toFixed(1) + ' Moons wide', { size: 12, cls: 'soft' });
      [-1, 0, 1].forEach((k, i) => el('circle', { cx: 120 + i * 70, cy: 110 + k * 0, r: mr, fill: i === 1 ? 'color-mix(in srgb, var(--orange) 60%, var(--sunk))' : C.line, opacity: i === 1 ? 1 : .7 }, g));
      label(g, 190, 200, 'Moon diameter = 2R ÷ (' + n.toFixed(1) + ' + 1), distance = diameter ÷ angle', { size: 12, cls: 'soft' });
      dR.textContent = km(r.dm) + ' (' + off(r.dm, 3474) + ')'; DR.textContent = km(r.D) + ' (' + off(r.D, MOON) + ')'; };
    slider(box, 'Shadow width, in Moons ', 2, 3.2, .05, n, v => v.toFixed(2), v => { n = v; draw(); });
    slider(box, 'Moon\'s angular size, ° ', .4, .6, .01, a, v => v.toFixed(2), v => { a = v; draw(); });
    L.onR.push(draw); draw();
  } else if (rung === 'sun') {
    s.setAttribute('aria-label', 'Earth, Moon and Sun at half moon, with a right angle at the Moon.');
    const [kR, DR, dR] = readouts(fig, ['Sun distance, in Moon distances', 'Sun distance', 'Sun across']); let th = 87;
    const draw = () => { clear(g); const Dm = L.moon || moon(L.R, 2.6, .52).D, r = sun(Dm, th);
      const E = [40, 170], M = [120, 60], S = [E[0] + (M[0] - E[0]) + 230, E[1]];
      el('path', { d: `M${E[0]} ${E[1]}L${M[0]} ${M[1]}L${S[0]} ${S[1]}Z`, fill: 'none', stroke: C.line, 'stroke-width': 2 }, g);
      el('circle', { cx: E[0], cy: E[1], r: 10, fill: C.blue }, g); el('circle', { cx: M[0], cy: M[1], r: 7, fill: C.soft }, g); el('circle', { cx: S[0], cy: S[1], r: 18, fill: 'var(--gold)' }, g);
      label(g, E[0] + 34, E[1] - 8, th.toFixed(2) + '°', { size: 13, w: 600 }); label(g, M[0] + 14, M[1] + 22, '90°', { size: 12, cls: 'soft' });
      label(g, E[0], E[1] + 26, 'Earth', { size: 12, cls: 'soft' }); label(g, M[0], M[1] - 14, 'half Moon', { size: 12, cls: 'soft' }); label(g, S[0], S[1] + 34, 'Sun (not to scale)', { size: 12, cls: 'soft' });
      kR.textContent = r.k.toFixed(1) + '×'; DR.textContent = km(r.D) + ' (' + off(r.D, AU) + ')'; dR.textContent = km(r.D * .52 * DEG) + ' (' + off(r.D * .52 * DEG, 1.3927e6) + ')'; };
    slider(box, 'Angle from the Moon to the Sun at half moon, ° ', 85, 89.95, .01, th, v => v.toFixed(2), v => { th = v; draw(); });
    L.onMoon.push(draw); draw();
  } else if (rung === 'stars') {
    s.setAttribute('aria-label', 'The Earth on two sides of its orbit, six months apart, seeing a nearby star shift against far ones.');
    const [pR, lR] = readouts(fig, ['Distance', 'In light-years']); let p = .314;
    const draw = () => { clear(g); const r = stars(p);
      el('ellipse', { cx: 90, cy: 160, rx: 60, ry: 18, fill: 'none', stroke: C.line, 'stroke-width': 2 }, g);
      el('circle', { cx: 90, cy: 160, r: 9, fill: 'var(--gold)' }, g); el('circle', { cx: 30, cy: 160, r: 6, fill: C.blue }, g); el('circle', { cx: 150, cy: 160, r: 6, fill: C.blue }, g);
      const sx = 90, sy = 160 - Math.min(140, 40 / p); el('circle', { cx: sx, cy: Math.max(14, sy), r: 5, fill: C.ink }, g);
      el('path', { d: `M30 160L${sx} ${Math.max(14, sy)}L150 160`, stroke: C.soft, 'stroke-dasharray': '4 3', fill: 'none' }, g);
      label(g, 260, 60, 'parallax ' + p.toFixed(3) + '″', { size: 14, w: 600 }); label(g, 260, 80, '1 parsec = 206,265 AU', { size: 12, cls: 'soft' });
      label(g, 260, 100, 'distance = 1 ÷ parallax', { size: 12, cls: 'soft' });
      pR.textContent = r.pc.toFixed(2) + ' parsecs'; lR.textContent = r.ly.toFixed(1) + ' ly'; };
    slider(box, 'Parallax, arcseconds ', .05, 1, .001, p, v => v.toFixed(3) + '″', v => { p = v; draw(); });
    draw();
  } else {
    s.setAttribute('viewBox', '0 0 380 300'); s.setAttribute('aria-label', 'A logarithmic scale from the Earth\'s radius to the edge of the observable universe, with the method that reaches each rung.');
    const RUNGS = [['Earth\'s radius', 6.371e6, 'Eratosthenes: shadows'], ['the Moon', 3.844e8, 'Aristarchus: eclipses'], ['the Sun', 1.496e11, 'half Moon, then transits of Venus'],
      ['Neptune', 4.5e12, 'Kepler\'s laws'], ['nearest star', 4.0e16, 'parallax'], ['61 Cygni', 1.08e17, 'parallax (Bessel)'], ['Small Magellanic Cloud', 1.9e21, 'Cepheids (Leavitt)'],
      ['Andromeda', 2.4e22, 'Cepheids (Hubble)'], ['far galaxies', 1e25, 'supernovae, redshift'], ['Hubble distance c/H₀', 1.4e26, 'Hubble\'s law']];
    const Y = v => 270 - (Math.log10(v) - 6) / 21 * 250;
    el('path', { d: 'M60 20V272', stroke: C.ink, 'stroke-width': 2 }, g);
    [6, 9, 12, 15, 18, 21, 24, 27].forEach(e => { el('path', { d: `M54 ${Y(10 ** e)}H66`, stroke: C.ink }, g); label(g, 48, Y(10 ** e) + 4, '10' + String(e).replace(/./g, c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]) + ' m', { a: 'end', size: 11, cls: 'soft' }); });
    let last = 999; RUNGS.forEach(([n, v, how]) => { const y = Math.min(Y(v), last - 24); last = y; el('circle', { cx: 60, cy: Y(v), r: 5, fill: C.orange }, g); el('path', { d: `M64 ${Y(v)}L84 ${y}`, stroke: C.line, fill: 'none' }, g);
      label(g, 90, y + 4, n, { a: 'start', size: 13, w: 600 }); label(g, 90, y + 18, how, { a: 'start', size: 11, cls: 'soft' }); });
    box.remove();
  }
}
