/* The hydrograph synth. data-view="fixed": the textbook SCS synthetic unit hydrograph, a few knobs.
   data-view="modular": a rack of modules, rain → losses → hillslope (Nash cascade) → channel (Muskingum) → baseflow, each patched in or bypassed.
   Both: rain bars on top, flow below; "Listen" plays the final hydrograph as a rising and falling tone (pitch follows flow). */
import { svg, el, clear, label, controls, button, picker, slider, readouts, C } from './kit.js';
import { storm, cnLoss, phiLoss, nash, muskingum, scsUH, convolve, mmToQ } from './hydro-core.js';

const DT = .25, STEPS = 192;   // quarter-hour steps, 48 hours

function scope(g, rain, excess, lines) {
  clear(g);
  const x = i => 40 + i / STEPS * 326, rmax = Math.max(1, ...rain), tops = lines.filter(l => !l.over), qmax = Math.max(1, ...(tops.length ? tops : lines).flatMap(l => l.q)) * 1.05;
  el('path', { d: 'M40 112H366M40 238H366', stroke: C.line, fill: 'none' }, g);
  rain.forEach((r, i) => { const h = r / rmax * 70, e = (excess[i] || 0) / rmax * 70; el('rect', { x: x(i), y: 14, width: Math.max(1, 326 / STEPS), height: h, fill: C.blue, opacity: .35 }, g); if (e > 0) el('rect', { x: x(i), y: 14, width: Math.max(1, 326 / STEPS), height: e, fill: C.blue }, g); });
  label(g, 40, 102, 'rain (light) and the part that runs off (dark), mm per 15 min', { a: 'start', size: 11, cls: 'soft' });
  lines.forEach(l => { let d = ''; l.q.forEach((v, i) => d += (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + (238 - Math.min(v / qmax, 1.12) * 110).toFixed(1)); el('path', { d, stroke: l.c, 'stroke-width': l.w || 2.5, fill: 'none', 'stroke-dasharray': l.dash || '' }, g); });
  [0, 12, 24, 36, 48].forEach(h => label(g, x(h / DT), 252, h + ' h', { size: 11, cls: 'soft' }));
  el('path', { d: 'M40 128H366', stroke: C.line, 'stroke-dasharray': '2 4', fill: 'none' }, g);
  label(g, 366, 124, Math.round(qmax) + ' m³/s', { a: 'end', size: 11, cls: 'soft' }); label(g, 36, 242, '0', { a: 'end', size: 11, cls: 'soft' });
  const big = lines.find(l => l.over && Math.max(...l.q) > qmax * 1.12); if (big) label(g, 366, 140, 'straight off the land peaks at ' + Math.round(Math.max(...big.q)) + ' m³/s, off the top', { a: 'end', size: 11, cls: 'soft' });
}
function listen(q) {   // the hydrograph as sound, three seconds long: pitch and loudness follow the flow
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; const ac = new AC(), o = ac.createOscillator(), gn = ac.createGain(), T = 3, qmax = Math.max(1e-9, ...q), t0 = ac.currentTime + .05;
  o.type = 'triangle'; o.connect(gn).connect(ac.destination);
  q.forEach((v, i) => { const t = t0 + i / q.length * T, r = v / qmax; o.frequency.linearRampToValueAtTime(110 + 660 * r, t); gn.gain.linearRampToValueAtTime(.02 + .14 * r, t); });
  gn.gain.linearRampToValueAtTime(0, t0 + T + .1); o.start(t0); o.stop(t0 + T + .15); o.onended = () => ac.close();
}
const peakOf = q => { let m = 0, at = 0; q.forEach((v, i) => { if (v > m) { m = v; at = i; } }); return [m, at * DT]; };

export default function (fig) {
  const s = svg(fig, 380, 260, 'Rain bars across the top and the flow it produces at the catchment outlet below, over two days.'), g = el('g', {}, s);
  return fig.getAttribute('data-view') === 'modular' ? modular(fig, g) : fixed(fig, g);
}

function fixed(fig, g) {
  const box = controls(fig), box2 = controls(fig), [qR, pR, tR] = readouts(fig, ['Runoff', 'Peak flow', 'Peak at']);
  const K = { A: 50, lag: 3, P: 80, D: 6, CN: 75, shape: 'peak' };
  let last = [];
  function run() {
    const rain = storm(K.P, K.D, DT, K.shape), ex = cnLoss(rain, K.CN), uh = scsUH(K.A, DT / 2 + K.lag, DT, STEPS), q = convolve(ex, uh, STEPS); last = q;
    scope(g, rain.concat(new Array(STEPS).fill(0)).slice(0, STEPS), ex, [{ q, c: C.orange }]);
    const [m, at] = peakOf(q); qR.textContent = ex.reduce((a, b) => a + b, 0).toFixed(1) + ' mm of ' + K.P + ' mm'; pR.textContent = m.toFixed(0) + ' m³/s'; tR.textContent = at.toFixed(1) + ' h';
  }
  slider(box, 'Catchment area, km² ', 1, 500, 1, K.A, v => String(v), v => { K.A = v; run(); });
  slider(box, 'Lag time, h ', .5, 12, .25, K.lag, v => v.toFixed(2), v => { K.lag = v; run(); });
  slider(box, 'Curve number ', 40, 98, 1, K.CN, v => String(v), v => { K.CN = v; run(); });
  slider(box2, 'Storm rain, mm ', 10, 250, 5, K.P, v => String(v), v => { K.P = v; run(); });
  slider(box2, 'Storm length, h ', .5, 24, .5, K.D, v => v.toFixed(1), v => { K.D = v; run(); });
  picker(box2, ['Peaked storm', 'Even storm'], 0, k => { K.shape = k ? 'block' : 'peak'; run(); });
  button(box2, 'Listen', () => listen(last), 'go');
  run();
}

function modular(fig, g) {
  if (!document.getElementById('hrack-css')) { const st = document.createElement('style'); st.id = 'hrack-css'; st.textContent = `
.hrack{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;margin-top:12px}
.hrack section{background:var(--sunk);border-radius:12px;padding:10px 12px 8px;border-top:5px solid var(--c)}
.hrack h4{display:flex;justify-content:space-between;align-items:center;gap:6px;margin:0 0 4px;font-size:1rem}
.hrack label{display:grid;grid-template-columns:1fr auto;gap:0 8px;margin:8px 0 0;font-size:.9rem}
.hrack label input{grid-column:1/-1;grid-row:2;width:100%;margin:2px 0 0}
.hrack label output{grid-row:1;grid-column:2;font-variant-numeric:tabular-nums}
.hrack .btn{padding:4px 10px;min-height:32px;font-size:.85rem}
.hrack .row{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}`; document.head.append(st); }
  const rack = document.createElement('div'); rack.className = 'hrack';
  fig.insertBefore(rack, fig.querySelector('figcaption'));
  const [vR, pR, tR] = readouts(fig, ['Runoff that reaches the outlet', 'Peak flow', 'Peak at']);
  const K = { A: 50, P: 80, D: 6, shape: 'peak', loss: 'cn', CN: 75, phi: 5, n: 3, k: 2, MK: 4, MX: .2, base: 2, on: { loss: true, hill: true, chan: true, base: true } };
  let last = [];
  const mod = (key, title, col, build) => { const d = document.createElement('section'); d.style.setProperty('--c', col);
    const h = document.createElement('h4'); h.append(title);
    if (key) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; const paint = () => { b.textContent = K.on[key] ? 'Patched' : 'Bypassed'; b.setAttribute('aria-pressed', K.on[key]); b.setAttribute('aria-label', title + ': ' + b.textContent); d.style.opacity = K.on[key] ? 1 : .55; }; b.addEventListener('click', () => { K.on[key] = !K.on[key]; paint(); run(); }); paint(); h.append(b); }
    d.append(h); build(d); rack.append(d); };
  const row = d => { const r = document.createElement('div'); r.className = 'row'; d.append(r); return r; };
  mod(null, 'Rain', 'var(--blue)', c => { slider(c, 'mm ', 10, 250, 5, K.P, v => String(v), v => { K.P = v; run(); }); slider(c, 'hours ', .5, 24, .5, K.D, v => v.toFixed(1), v => { K.D = v; run(); }); picker(row(c), ['Peaked', 'Even'], 0, k => { K.shape = k ? 'block' : 'peak'; run(); }); });
  mod('loss', 'Losses', 'var(--green)', c => { picker(row(c), ['Curve number', 'φ index'], 0, k => { K.loss = k ? 'phi' : 'cn'; run(); }); slider(c, 'CN ', 40, 98, 1, K.CN, v => String(v), v => { K.CN = v; run(); }); slider(c, 'φ, mm/h ', 0, 30, .5, K.phi, v => v.toFixed(1), v => { K.phi = v; run(); }); });
  mod('hill', 'Hillslope', 'var(--purple)', c => { slider(c, 'reservoirs ', 1, 6, 1, K.n, v => String(v), v => { K.n = v; run(); }); slider(c, 'each k, h ', .25, 8, .25, K.k, v => v.toFixed(2), v => { K.k = v; run(); }); });
  mod('chan', 'Channel', 'var(--orange)', c => { slider(c, 'travel K, h ', .5, 12, .5, K.MK, v => v.toFixed(1), v => { K.MK = v; run(); }); slider(c, 'weighting X ', 0, .5, .05, K.MX, v => v.toFixed(2), v => { K.MX = v; run(); }); });
  mod('base', 'Baseflow', 'var(--ink-soft)', c => { slider(c, 'm³/s ', 0, 20, .5, K.base, v => v.toFixed(1), v => { K.base = v; run(); }); });
  mod(null, 'Out', 'var(--gold)', c => { slider(c, 'catchment km² ', 1, 500, 1, K.A, v => String(v), v => { K.A = v; run(); }); button(row(c), 'Listen', () => listen(last), 'go'); });
  function run() {
    const rain = storm(K.P, K.D, DT, K.shape), r = rain.concat(new Array(STEPS).fill(0)).slice(0, STEPS);
    const ex = !K.on.loss ? r : K.loss === 'cn' ? cnLoss(r, K.CN) : phiLoss(r, K.phi, DT);
    const lines = [], direct = mmToQ(ex, K.A, DT);
    let q = direct; lines.push({ q: direct, c: 'var(--green)', w: 1.5, dash: '4 3', over: K.on.hill || K.on.chan });
    if (K.on.hill) { q = mmToQ(nash(ex, K.n, K.k, DT, STEPS), K.A, DT); lines.push({ q, c: 'var(--purple)', w: 1.5, dash: '4 3' }); }
    if (K.on.chan) { q = muskingum(q, K.MK, K.MX, DT); lines.push({ q, c: 'var(--orange)', w: 1.5, dash: '4 3' }); }
    if (K.on.base) q = q.map(v => v + K.base);
    lines.push({ q, c: 'var(--ink)', w: 3 }); last = q; scope(g, r, ex, lines);
    const [m, at] = peakOf(q), mm = ex.reduce((a, b) => a + b, 0); vR.textContent = mm.toFixed(1) + ' mm of ' + K.P; pR.textContent = m.toFixed(0) + ' m³/s'; tR.textContent = at.toFixed(1) + ' h';
  }
  run();
}
