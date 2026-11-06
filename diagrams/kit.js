/* Shared parts for diagrams. A diagram is one module: export default function (fig) { ... }.
   It builds in the figure's first child position and leaves the figcaption where the page put it. */
export const NS = 'http://www.w3.org/2000/svg';
export const C = { blue: 'var(--blue)', orange: 'var(--orange)', purple: 'var(--purple)', green: 'var(--green)', ink: 'var(--ink)', soft: 'var(--ink-soft)', line: 'var(--line)', sunk: 'var(--sunk)', panel: 'var(--panel)' };
export const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function svg(fig, w, h, label) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', `0 0 ${w} ${h}`);
  s.setAttribute('class', 'd');
  s.setAttribute('role', 'img');
  s.setAttribute('aria-label', label);
  put(fig, s);
  return s;
}
/* keep figure order: picture, controls, readouts, caption */
export function put(fig, node) {
  const cap = fig.querySelector('figcaption');
  if (cap) fig.insertBefore(node, cap); else fig.appendChild(node);
  return node;
}
export function el(name, attrs, parent, txt) {
  const e = document.createElementNS(NS, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (txt != null) e.textContent = txt;
  if (parent) parent.appendChild(e);
  return e;
}
export function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
export function label(parent, x, y, s, opts = {}) {
  return el('text', { x, y, 'text-anchor': opts.a || 'middle', 'font-size': opts.size || 14, 'font-weight': opts.w || 400, class: opts.cls || '', ...(opts.fill ? { style: `fill:${opts.fill}` } : {}) }, parent, s);
}
export function controls(fig) { const d = document.createElement('div'); d.className = 'ctl'; return put(fig, d); }
export function slider(box, text, min, max, step, val, fmt, on) {
  const l = document.createElement('label'), i = document.createElement('input'), o = document.createElement('output');
  l.append(text, i, o);
  Object.assign(i, { type: 'range', min, max, step, value: val });
  const up = () => { o.textContent = fmt ? fmt(+i.value) : i.value; on(+i.value); };
  i.addEventListener('input', up);
  box.appendChild(l);
  o.textContent = fmt ? fmt(+val) : val;
  return i;
}
export function button(box, text, on, cls) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'btn' + (cls ? ' ' + cls : ''); b.textContent = text;
  b.addEventListener('click', on);
  box.appendChild(b);
  return b;
}
/* one-of-many buttons */
export function picker(box, names, start, on) {
  const bs = names.map((n, k) => button(box, n, () => pick(k)));
  function pick(k) { bs.forEach((b, j) => b.setAttribute('aria-pressed', j === k)); on(k); }
  bs.forEach((b, j) => b.setAttribute('aria-pressed', j === start));
  return pick;
}
export function readouts(fig, names) {
  const d = document.createElement('div'); d.className = 'read'; d.setAttribute('aria-live', 'polite');
  const vals = names.map(n => { const s = document.createElement('div'); s.className = 'stat'; const a = document.createElement('small'); a.textContent = n; const b = document.createElement('b'); s.append(a, b); d.appendChild(s); return b; });
  put(fig, d);
  return vals;
}
export function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
export function gauss(R) { return Math.sqrt(-2 * Math.log(R() + 1e-12)) * Math.cos(6.283185 * R()); }
/* one hue from sunk to full, as a mix of two kit tokens; v in 0..1 */
export function ramp(v, hue = 'var(--blue)') { const p = Math.round(Math.max(0, Math.min(1, v)) * 100); return `color-mix(in srgb, ${hue} ${p}%, var(--sunk))`; }
export function diverge(v) { return v < 0 ? ramp(-v, 'var(--blue)') : ramp(v, 'var(--orange)'); }
/* a row of cells; cell(i, j) gives the fill */
export function grid(parent, x, y, rows, cols, s, cell, gap = 1) {
  const g = el('g', {}, parent);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) el('rect', { x: x + c * s, y: y + r * s, width: s - gap, height: s - gap, rx: Math.min(2, s / 6), fill: cell(r, c) }, g);
  return g;
}
/* isometric projection: x right-down, y left-down, z up */
export function isoProject(cx, cy, s) { const dx = s * .866, dy = s * .5; return (x, y, z) => [cx + (x - y) * dx, cy + (x + y) * dy - z * s]; }
export function quad(parent, p, a, b, c, d, fill, stroke = 'var(--panel)') {
  return el('path', { d: 'M' + [a, b, c, d].map(q => p(...q).map(v => v.toFixed(1)).join(' ')).join('L') + 'Z', fill, stroke, 'stroke-width': 1 }, parent);
}
