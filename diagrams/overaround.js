/* A vertical slice through a ridge, with the real mass-conserving solver running behind it.
   One knob: how expensive vertical adjustment is. Cheap and the air climbs; dear and it leaves
   the slice sideways, which is what going "around" looks like when you are watching a cross-section. */
import { svg, el, clear, label, controls, slider, readouts, C } from './kit.js';
import { syntheticHill, buildField, project, levelAt } from './windcore.js';

const NX = 34, NY = 26, SPAN = 9000, RELIEF = 420;
const DEM = syntheticHill(64, SPAN, RELIEF);
const cache = new Map();

function solveAt(R) {
  const key = R.toFixed(2);
  if (cache.has(key)) return cache.get(key);
  const F = buildField(DEM, { nx: NX, ny: NY, U: 8, dir: 270, z0: 0.2, R });
  project(F, 120, 1.3);
  const NZ = F.nz;
  const j = NY >> 1;
  /* centre-of-cell velocities on the slice, plus how much air is leaving it sideways */
  const u = new Float32Array(NX * NZ), w = new Float32Array(NX * NZ), out = new Float32Array(NX * NZ);
  let side = 0, vert = 0, n = 0, crest = 0, upwind = 0;
  for (let k = 0; k < NZ; k++) for (let i = 0; i < NX; i++) {
    const c = F.cid(i, j, k), o = k * NX + i;
    if (F.solid[c]) { out[o] = NaN; continue; }
    u[o] = (F.u[F.uid(i, j, k)] + F.u[F.uid(i + 1, j, k)]) / 2;
    w[o] = (F.w[F.wid(i, j, k)] + F.w[F.wid(i, j, k + 1)]) / 2;
    const vv = (F.v[F.vid(i, j, k)] + F.v[F.vid(i, j + 1, k)]) / 2;
    out[o] = Math.abs(vv);
    side += vv * vv; vert += w[o] * w[o]; n++;
  }
  /* speed just above the ground, upwind shoulder against the crest */
  const col = (i) => {
    for (let k = 0; k < NZ; k++) if (!F.solid[F.cid(i, j, k)]) return Math.hypot(u[k * NX + i], w[k * NX + i]);
    return 0;
  };
  upwind = col(3); crest = col(NX >> 1);
  const res = {
    u, w, F, j, NZ,
    ter: Array.from({ length: NX }, (_, i) => F.ter[j * NX + i]),
    side: Math.sqrt(side / n), vert: Math.sqrt(vert / n),
    speedup: crest / Math.max(.05, upwind)
  };
  cache.set(key, res);
  return res;
}

export default function (fig) {
  const s = svg(fig, 360, 250, 'A vertical cut through a ridge showing streamlines bending over it, with a control for how readily air rises.');
  const g = el('g', {}, s), box = controls(fig);
  const [climb, aside] = readouts(fig, ['Rising and sinking', 'Leaving sideways']);
  const base = DEM.lo;

  function draw(R) {
    const S = solveAt(R), F = S.F;
    const H = F.top;
    const X = i => 10 + i / NX * 340;
    const Y = z => 200 - (z - base) / H * 176;
    clear(g);

    /* sky, then the hill */
    el('rect', { x: 10, y: 24, width: 340, height: 176, rx: 4, fill: C.sunk, opacity: .5 }, g);
    let hill = `M10 200`;
    for (let i = 0; i < NX; i++) hill += `L${X(i + .5).toFixed(1)} ${Y(S.ter[i]).toFixed(1)}`;
    hill += `L350 200Z`;

    /* streamlines traced through the slice; they stop where air leaves it */
    const sampleAt = (x, z) => {
      const i = Math.max(0, Math.min(NX - 1, Math.round((x - 10) / 340 * NX - .5)));
      const k = levelAt(F, z - base);
      const o = k * NX + i;
      if (Number.isNaN(S.u[o]) && Number.isNaN(S.w[o])) return null;
      if (F.solid[F.cid(i, S.j, k)]) return null;
      return { u: S.u[o], w: S.w[o] };
    };
    for (let line = 0; line < 9; line++) {
      let z = base + (line + 1) / 10 * H, x = 11;
      let d = `M${x.toFixed(1)} ${Y(z).toFixed(1)}`, alive = true;
      for (let step = 0; step < 220 && alive; step++) {
        const q = sampleAt(x, z);
        if (!q) break;
        const sp = Math.hypot(q.u, q.w) || 1e-6;
        const dt = 62 / sp;              // long enough a step that a trace crosses the whole picture
        x += q.u * dt * (340 / SPAN);
        z += q.w * dt;
        if (x > 349 || z < base || z > base + H) alive = false;
        d += `L${Math.min(349, x).toFixed(1)} ${Y(Math.max(base, z)).toFixed(1)}`;
      }
      const rise = Math.min(1, Math.abs(S.vert) / 1.6);
      el('path', { d, fill: 'none', stroke: C.blue, 'stroke-width': 1.8, opacity: .85, 'stroke-linecap': 'round' }, g);
    }
    el('path', { d: hill, fill: C.ink, opacity: .85 }, g);
    label(g, 10, 220, 'wind enters here', { a: 'start', size: 13, cls: 'soft' });
    label(g, 350, 220, 'and leaves here', { a: 'end', size: 13, cls: 'soft' });
    label(g, 180, 18, R < .6 ? 'vertical motion is expensive: it goes around' : R > 1.8 ? 'vertical motion is cheap: it climbs' : 'balanced', { size: 14, w: 600 });

    climb.textContent = S.vert.toFixed(2) + ' m/s';
    aside.textContent = S.side.toFixed(2) + ' m/s';
    fig.querySelector('figcaption').textContent =
      `At this setting the air rises and sinks at ${S.vert.toFixed(2)} m/s on average and slides sideways at ${S.side.toFixed(2)} m/s, speeding up ${S.speedup.toFixed(2)}× at the crest. A streamline that stops short has not hit anything — it has left this slice, which is what going around the ridge looks like from side-on.`;
  }
  slider(box, 'Vertical motion', .15, 5, .05, 1, v => v < .6 ? 'expensive' : v > 1.8 ? 'cheap' : 'even', draw);
  draw(1);
}
