/* Why the editor is split in two: a delivery vehicle has a fixed cargo hold, and the one-letter editor is bigger than it.
   The common delivery vehicle for gene therapy (an adeno-associated virus, AAV) holds about 4,700 letters of code.
   A protein that only cuts DNA fits. A protein that rewrites one letter, plus the guide and the controls it needs,
   does not — so it is split across two vehicles that reassemble inside the cell. Drag the slider to size the editor. */
import { svg, el, clear, label, slider, controls, readouts, C } from './kit.js';

const CAP = 4700;   // letters of code a single AAV vehicle carries (its packaging limit, ~4.7 kb)
const PARTS = [['guide + controls', 900, C.purple], ['targeting protein', 3000, C.blue], ['letter-rewriter', 1500, C.orange]];

export default function (fig) {
  const s = svg(fig, 380, 200, 'A cargo hold the width of one vehicle, and a bar of code that may or may not fit inside it.'), g = el('g', {}, s);
  const box = controls(fig), [fitR, splitR] = readouts(fig, ['Fits one vehicle?', 'Vehicles needed']);
  let extra = 1500;   // the size of the letter-rewriter part, which the slider moves

  function draw() {
    clear(g);
    const parts = PARTS.map(p => p.slice()); parts[2][1] = extra;
    const total = parts.reduce((a, p) => a + p[1], 0), x0 = 20, W = 340, scale = W / (CAP * 1.6);
    // the cargo hold: a bay exactly CAP wide
    el('rect', { x: x0, y: 36, width: CAP * scale, height: 34, rx: 6, fill: 'none', stroke: C.ink, 'stroke-width': 2, 'stroke-dasharray': '6 4' }, g);
    label(g, x0, 28, 'one vehicle holds ' + CAP.toLocaleString('en-US') + ' letters', { a: 'start', size: 12, cls: 'soft' });
    // the parts of the editor, laid end to end
    let x = x0;
    parts.forEach(p => { const w = p[1] * scale; el('rect', { x, y: 36, width: w, height: 34, rx: 4, fill: p[2], opacity: .85 }, g); if (w > 46) label(g, x + w / 2, 58, p[0].split(' ')[0], { size: 11, fill: 'var(--on-accent)' }); x += w; });
    label(g, x0, 90, 'the whole one-letter editor: ' + total.toLocaleString('en-US') + ' letters', { a: 'start', size: 12 });
    // the verdict
    const fits = total <= CAP;
    el('rect', { x: x0, y: 108, width: 340, height: 70, rx: 10, fill: fits ? C.sunk : 'color-mix(in srgb, var(--orange) 16%, var(--sunk))' }, g);
    if (fits) label(g, 190, 148, 'It fits. One vehicle delivers it.', { size: 15, w: 600 });
    else {
      label(g, 190, 140, 'Too big. Split it across two vehicles —', { size: 15, w: 600 });
      label(g, 188, 162, 'and now a cell needs', { a: 'end', size: 13, cls: 'soft' });
      label(g, 194, 162, 'both', { a: 'start', size: 13, w: 700, fill: 'var(--orange-t, var(--orange))' });
    }
    fitR.textContent = fits ? 'yes' : 'no, by ' + (total - CAP).toLocaleString('en-US') + ' letters';
    splitR.textContent = fits ? '1' : '2';
  }
  slider(box, 'Rewriter size, letters ', 0, 3000, 50, extra, v => v ? v.toLocaleString('en-US') : 'cut only', v => { extra = v; draw(); });
  draw();
}
