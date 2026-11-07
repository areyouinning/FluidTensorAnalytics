/* A Chladni plate: sand on a square plate that rings in one of its modes.
   The shape of each mode is the classic approximation for a free square plate,
     w(x, y) = cos(nπx) cos(mπy) + s · cos(mπx) cos(nπy),   0 ≤ x, y ≤ 1,
   and its pitch is taken as proportional to n² + m². A real plate's patterns are close to these, not identical.
   Each grain is kicked in a random direction, harder where the plate moves more, so the sand drifts to where it doesn't move. */
import { controls, button, picker, slider, readouts, calm } from './kit.js';

/* the notes, low to high: n < m, and both mixes of the pair */
export const NOTES = (() => { const out = []; for (let m = 1; m <= 6; m++) for (let n = 0; n < m; n++) { out.push({ n, m, s: 1 }); out.push({ n, m, s: -1 }); } return out.sort((a, b) => (a.n * a.n + a.m * a.m) - (b.n * b.n + b.m * b.m) || a.n - b.n || b.s - a.s); })();
export function w(x, y, n, m, s) { const P = Math.PI; return Math.cos(n * P * x) * Math.cos(m * P * y) + s * Math.cos(m * P * x) * Math.cos(n * P * y); }

export default function (fig) {
  const SIZE = 360, c = document.createElement('canvas'), narrow = innerWidth < 700, N = narrow ? 4500 : 7000;
  c.width = SIZE; c.height = SIZE; c.className = 'd'; c.style.borderRadius = '10px';
  c.setAttribute('role', 'img');
  fig.insertBefore(c, fig.firstChild);
  const g = c.getContext('2d'), img = g.createImageData(SIZE, SIZE), px = img.data;
  const probe = document.createElement('i'); probe.hidden = true; fig.appendChild(probe);
  const rgb = name => { probe.hidden = false; probe.style.color = `var(${name})`; const v = getComputedStyle(probe).color.match(/[\d.]+/g).map(Number); probe.hidden = true; return v; };
  let COL; const paintCols = () => { COL = { plate: rgb('--sunk'), sand: rgb('--ink'), up: rgb('--orange'), down: rgb('--blue') }; };
  paintCols(); matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { paintCols(); draw(0); });

  const S = { k: NOTES.findIndex(q => q.n === 1 && q.m === 2 && q.s === -1), mix: null, view: 0, t: 0, sound: false, run: !calm() };
  const X = new Float32Array(N), Y = new Float32Array(N);
  const box = controls(fig), box2 = controls(fig);
  const [noteR, pitchR] = readouts(fig, ['Mode (n, m)', 'Pitch, against the lowest']);
  const cur = () => { const q = NOTES[S.k]; return { n: q.n, m: q.m, s: S.mix == null ? q.s : S.mix }; };

  function scatter() { for (let i = 0; i < N; i++) { X[i] = Math.random(); Y[i] = Math.random(); } }
  function shake(steps) {   // a random kick in each direction, scaled by how much the plate moves there
    const q = cur(), K = .12;
    for (let r = 0; r < steps; r++) for (let i = 0; i < N; i++) {
      const a = Math.abs(w(X[i], Y[i], q.n, q.m, q.s)) / 2;
      X[i] += (Math.random() - .5) * K * (a + .002); Y[i] += (Math.random() - .5) * K * (a + .002);
      if (X[i] < 0) X[i] = -X[i]; else if (X[i] > 1) X[i] = 2 - X[i];
      if (Y[i] < 0) Y[i] = -Y[i]; else if (Y[i] > 1) Y[i] = 2 - Y[i];
    }
  }
  function draw(dt) {
    const q = cur(), P = COL.plate;
    if (S.view === 0) {
      for (let i = 0; i < px.length; i += 4) { px[i] = P[0]; px[i + 1] = P[1]; px[i + 2] = P[2]; px[i + 3] = 255; }
      const s = COL.sand; for (let i = 0; i < N; i++) { const x = (X[i] * (SIZE - 1)) | 0, y = (Y[i] * (SIZE - 1)) | 0, o = (y * SIZE + x) * 4; px[o] = s[0]; px[o + 1] = s[1]; px[o + 2] = s[2]; if (x + 1 < SIZE) { px[o + 4] = s[0]; px[o + 5] = s[1]; px[o + 6] = s[2]; } }
    } else {   // the plate itself: orange up, blue down, swapping every half swing; the still lines stay plain
      const ph = Math.cos(S.t * 3), U = COL.up, D = COL.down;
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        const v = w(x / (SIZE - 1), y / (SIZE - 1), q.n, q.m, q.s) / 2 * ph, a = Math.min(1, Math.abs(v)), C = v > 0 ? U : D, o = (y * SIZE + x) * 4;
        px[o] = P[0] + (C[0] - P[0]) * a; px[o + 1] = P[1] + (C[1] - P[1]) * a; px[o + 2] = P[2] + (C[2] - P[2]) * a; px[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  }
  function label() {
    const q = cur(), base = 1;   // the lowest note, (0, 1)
    noteR.textContent = '(' + q.n + ', ' + q.m + ')' + (S.mix == null ? (q.s > 0 ? ', plus' : ', minus') : ', mixed ' + S.mix.toFixed(2));
    pitchR.textContent = '× ' + ((q.n * q.n + q.m * q.m) / base).toFixed(2);
    c.setAttribute('aria-label', 'A square plate with sand ' + (S.view === 0 ? 'settling on the still lines' : 'shown as the plate moves') + ' for mode ' + noteR.textContent + '.');
    tone(); settle();
  }
  function settle() { if (!S.run) { shake(300); draw(0); } }
  /* an optional tone at the mode's relative pitch (the plate's real pitch depends on its size and metal) */
  let ac = null, osc = null, gain = null;
  function tone() {
    if (!S.sound) { if (gain) gain.gain.setTargetAtTime(0, ac.currentTime, .05); return; }
    if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); osc = ac.createOscillator(); gain = ac.createGain(); gain.gain.value = 0; osc.type = 'sine'; osc.connect(gain).connect(ac.destination); osc.start(); }
    const q = cur(); osc.frequency.setTargetAtTime(65 * (q.n * q.n + q.m * q.m), ac.currentTime, .03); gain.gain.setTargetAtTime(.08, ac.currentTime, .05);
  }

  button(box, 'Lower note', () => { if (S.k > 0) { S.k--; S.mix = null; mixIn.value = NOTES[S.k].s; mixIn.dispatchEvent(new Event('sync')); label(); } });
  button(box, 'Higher note', () => { if (S.k < NOTES.length - 1) { S.k++; S.mix = null; mixIn.value = NOTES[S.k].s; mixIn.dispatchEvent(new Event('sync')); label(); } }, 'go');
  button(box, 'New sand', () => { scatter(); draw(0); settle(); });
  picker(box2, ['Sand', 'Motion'], 0, k => { S.view = k; label(); draw(0); });
  const snd = button(box2, 'Sound off', () => { S.sound = !S.sound; snd.textContent = S.sound ? 'Sound on' : 'Sound off'; snd.setAttribute('aria-pressed', S.sound); tone(); });
  snd.setAttribute('aria-pressed', 'false');
  const pause = button(box2, S.run ? 'Pause' : 'Play', () => { S.run = !S.run; pause.textContent = S.run ? 'Pause' : 'Play'; });
  const mixIn = slider(box2, 'Mix ', -1, 1, .05, NOTES[S.k].s, v => v.toFixed(2), v => { S.mix = v; label(); });
  mixIn.addEventListener('sync', () => { const o = mixIn.parentNode.querySelector('output'); if (o) o.textContent = (+mixIn.value).toFixed(2); });

  scatter(); label(); draw(0);
  let last = performance.now(), seen = true;
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { seen = es[0].isIntersecting; }).observe(c);
  (function loop(t) { const dt = Math.min(.05, (t - last) / 1000); last = t;
    if (seen && S.run) { S.t += dt; if (S.view === 0) shake(3); draw(dt); }
    requestAnimationFrame(loop); })(last);
  return { S, X, Y, NOTES, shake, scatter, cur };
}
