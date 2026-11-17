/* Buffon's needle. A floor ruled with parallel lines d apart. A needle of length L <= d is dropped with its
   centre uniform on the floor and its angle uniform in [0, pi). It crosses a line when its vertical extent
   spans a line position; that is worked out from the geometry. The chance is 2L/(pi d), so
   pi is about 2 L n / (d crossings). Only the latest 400 needles are drawn; the counts are exact. */
import { svg, el, clear, controls, slider, button, readouts } from './kit.js';

const ORANGE = 'var(--orange)', SOFT = 'var(--ink-soft)', LINE = 'var(--line)';
const MAXDRAW = 400;

export default function (fig) {
  const W = 380, H = 260, D = 40, Y0 = 10;          // lines at Y0 + k*D, k = 0..6
  const s = svg(fig, W, H, 'A floor ruled with parallel lines, with needles dropped at random. Needles that cross a line are orange.');
  const clip = el('clipPath', { id: 'buffon-clip' }, el('defs', {}, s));
  el('rect', { x: 0, y: 0, width: W, height: H }, clip);
  const floor = el('g', { 'clip-path': 'url(#buffon-clip)' }, s);
  const box = controls(fig), box2 = controls(fig);
  const [dropR, crossR, expR, piR] = readouts(fig, ['Dropped', 'Crossed', 'Expected', 'π from your drops']);
  let frac = 1, n = 0, crossed = 0, recent = [];

  function drop() {
    const L = frac * D, cx = 20 + Math.random() * (W - 40), cy = Y0 + Math.random() * 6 * D, th = Math.random() * Math.PI;
    const dx = Math.cos(th) * L / 2, dy = Math.sin(th) * L / 2;
    const lo = cy - dy, hi = cy + dy;
    const hit = Math.floor((lo - Y0) / D) !== Math.floor((hi - Y0) / D);
    n++; if (hit) crossed++;
    recent.push({ x1: cx - dx, y1: cy - dy, x2: cx + dx, y2: cy + dy, hit });
    if (recent.length > MAXDRAW) recent.shift();
  }
  function draw() {
    clear(floor);
    for (let k = 0; k <= 6; k++) el('line', { x1: 0, x2: W, y1: Y0 + k * D, y2: Y0 + k * D, stroke: LINE, 'stroke-width': 1.5 }, floor);
    recent.filter(r => !r.hit).forEach(r => el('line', { class: 'needle', x1: r.x1.toFixed(1), y1: r.y1.toFixed(1), x2: r.x2.toFixed(1), y2: r.y2.toFixed(1), stroke: SOFT, 'stroke-width': 2, 'stroke-linecap': 'round', opacity: .8 }, floor));
    recent.filter(r => r.hit).forEach(r => el('line', { class: 'needle', x1: r.x1.toFixed(1), y1: r.y1.toFixed(1), x2: r.x2.toFixed(1), y2: r.y2.toFixed(1), stroke: ORANGE, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, floor));
    dropR.textContent = n.toLocaleString('en-US');
    crossR.textContent = n ? crossed.toLocaleString('en-US') + ' (' + (100 * crossed / n).toFixed(1) + '%)' : '0';
    expR.textContent = (200 * frac / Math.PI).toFixed(1) + '%';
    piR.textContent = crossed ? (2 * frac * n / crossed).toFixed(4) : '—';
  }
  const reset = () => { n = 0; crossed = 0; recent = []; draw(); };
  const many = k => () => { for (let i = 0; i < k; i++) drop(); draw(); };
  slider(box, 'Needle length ', 0.2, 1, 0.05, frac, v => v.toFixed(2) + ' × spacing', v => { frac = v; reset(); });
  button(box2, 'Drop 1', many(1), 'go');
  button(box2, 'Drop 100', many(100));
  button(box2, 'Drop 10,000', many(10000));
  button(box2, 'Sweep the floor', reset);
  draw();
}
