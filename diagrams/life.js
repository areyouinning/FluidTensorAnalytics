/* Conway's Game of Life. Every cell is alive or dead; at each tick, a live cell with two or three live
   neighbors stays alive, a dead cell with exactly three comes alive, and everything else dies or stays
   dead (rule B3/S23). The real plane is infinite; this board is not, so cells that reach the outer edge fall
   off the world each tick. That keeps a glider gun's stream from wrapping round and wrecking the gun. */
import { controls, button, readouts, calm } from './kit.js';

const NX = 80, NY = 50;
const PATTERNS = {
  'Glider': [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]],
  'R-pentomino': [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]],
  'Gosper glider gun': ['........................O', '......................O.O', '............OO......OO............OO', '...........O...O....OO............OO', 'OO........O.....O...OO', 'OO........O...O.OO....O.O', '..........O.....O.......O', '...........O...O', '............OO'],
  'Pulsar': ['..OOO...OOO', '', 'O....O.O....O', 'O....O.O....O', 'O....O.O....O', '..OOO...OOO', '', '..OOO...OOO', 'O....O.O....O', 'O....O.O....O', 'O....O.O....O', '', '..OOO...OOO']
};
const cells = p => Array.isArray(p[0]) ? p : p.flatMap((row, y) => [...row].map((c, x) => c === 'O' ? [x, y] : null).filter(Boolean));

export default function (fig) {
  const cv = document.createElement('canvas'); fig.insertBefore(cv, fig.querySelector('figcaption'));
  cv.className = 'life'; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'A grid of cells for the Game of Life. Tap cells to bring them to life or kill them, then press Play.');
  const ctx = cv.getContext('2d');
  const box = controls(fig), box2 = controls(fig);
  const [genR, popR] = readouts(fig, ['Generation', 'Alive']);
  let a = new Uint8Array(NX * NY), b = new Uint8Array(NX * NY), gen = 0, run = false, raf = 0, lastT = 0, W = 0, H = 0, cs = 0, dpr = 1;
  const probe = document.createElement('i'); probe.style.display = 'none'; fig.appendChild(probe);
  const css = v => { probe.style.color = `var(${v})`; return getComputedStyle(probe).color; };
  let C = {}; const colors = () => { C = { bg: css('--sunk'), live: css('--blue'), grid: css('--line') }; };
  colors(); addEventListener('fta-theme', () => { colors(); draw(); });

  function tick() {
    for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; const X = x + dx, Y = y + dy;
        if (X >= 0 && Y >= 0 && X < NX && Y < NY) n += a[Y * NX + X];
      }
      const k = y * NX + x, edge = x === 0 || y === 0 || x === NX - 1 || y === NY - 1;
      b[k] = edge ? 0 : (n === 3 || (n === 2 && a[k])) ? 1 : 0;
    }
    [a, b] = [b, a]; gen++;
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    if (cs >= 6) { ctx.strokeStyle = C.grid; ctx.lineWidth = .5; ctx.beginPath(); for (let x = 0; x <= NX; x++) { ctx.moveTo(x * cs, 0); ctx.lineTo(x * cs, H); } for (let y = 0; y <= NY; y++) { ctx.moveTo(0, y * cs); ctx.lineTo(W, y * cs); } ctx.stroke(); }
    ctx.fillStyle = C.live; let pop = 0;
    for (let k = 0; k < a.length; k++) if (a[k]) { pop++; ctx.fillRect((k % NX) * cs + .5, Math.floor(k / NX) * cs + .5, cs - 1, cs - 1); }
    genR.textContent = String(gen); popR.textContent = String(pop);
  }
  function resize() { W = cv.clientWidth; if (!W) return; cs = W / NX; H = cs * NY; dpr = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = H + 'px'; draw(); }   // width comes from CSS (100% of the figure's content box)
  new ResizeObserver(resize).observe(cv);

  function frame(t) { raf = 0; if (!run) return; if (t - lastT > 90) { lastT = t; tick(); draw(); } raf = requestAnimationFrame(frame); }
  function setRun(on) { run = on && !calm(); playB.textContent = run ? 'Pause' : 'Play'; if (run && !raf) raf = requestAnimationFrame(frame); }
  function place(name) {
    a.fill(0); gen = 0; const pts = cells(PATTERNS[name]);
    const w = Math.max(...pts.map(p => p[0])) + 1, h = Math.max(...pts.map(p => p[1])) + 1;
    const ox = name === 'Gosper glider gun' ? 4 : Math.floor((NX - w) / 2), oy = name === 'Gosper glider gun' ? 4 : Math.floor((NY - h) / 2);
    pts.forEach(([x, y]) => { a[(y + oy) * NX + x + ox] = 1; }); draw();
  }

  /* tap or drag to paint cells */
  let paint = -1;
  const at = e => { const r = cv.getBoundingClientRect(); return [Math.floor((e.clientX - r.left) / r.width * NX), Math.floor((e.clientY - r.top) / r.height * NY)]; };
  cv.addEventListener('pointerdown', e => { const [x, y] = at(e); if (x < 1 || y < 1 || x >= NX - 1 || y >= NY - 1) return; const k = y * NX + x; paint = a[k] ? 0 : 1; a[k] = paint; cv.setPointerCapture(e.pointerId); draw(); });
  cv.addEventListener('pointermove', e => { if (paint < 0) return; const [x, y] = at(e); if (x < 1 || y < 1 || x >= NX - 1 || y >= NY - 1) return; a[y * NX + x] = paint; draw(); });
  cv.addEventListener('pointerup', () => { paint = -1; });

  const playB = button(box, 'Play', () => setRun(!run), 'go');
  button(box, 'Step', () => { setRun(false); tick(); draw(); });
  button(box, 'Clear', () => { setRun(false); a.fill(0); gen = 0; draw(); });
  button(box, 'Random', () => { setRun(false); gen = 0; for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) a[y * NX + x] = x && y && x < NX - 1 && y < NY - 1 && Math.random() < .28 ? 1 : 0; draw(); });
  Object.keys(PATTERNS).forEach(n => button(box2, n, () => { setRun(false); place(n); }));
  place('Gosper glider gun'); resize();
}
