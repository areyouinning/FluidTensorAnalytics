/* A local wind twin: real terrain, a real forecast, and the mass-conserving adjustment
   WindNinja uses to put the two together.

   The method, in one line: start from the forecast wind draped over the terrain, then change
   it as little as possible while making it conserve mass. That "as little as possible subject
   to conservation" is a constrained minimisation, and its Euler-Lagrange equations collapse to
   one Poisson equation for a multiplier. It is the same projection step that makes a fluid
   simulation incompressible, run once, over a weather forecast.

   Minimise  integral of  ah^2((u-u0)^2 + (v-v0)^2) + av^2(w-w0)^2   subject to  div u = 0.
   Stationarity gives  u = u0 + dL/dx,  v = v0 + dL/dy,  w = w0 + R dL/dz,  with R = (ah/av)^2
   after folding 2ah^2 into L. Continuity then gives

       L_xx + L_yy + R L_zz = -div(u0)

   R is the whole personality of the result. R > 1 makes vertical adjustment cheap, so air
   climbs the ridge. R < 1 makes it expensive, so air goes around. WindNinja ties that ratio
   to atmospheric stability; here it is a slider.

   Differences from WindNinja, stated plainly: it solves on a terrain-following finite element
   mesh, this solves on a staggered Cartesian grid with cells below ground masked out. Both
   enforce the same constraint and the same impermeable ground, but the near-surface geometry
   is coarser here. There is no diurnal slope flow and no non-neutral stability. */

export const KARMAN = 0.41;

/* ---------- terrain ----------
   Terrarium PNG tiles on AWS: elevation = R*256 + G + B/256 - 32768 metres.
   Same source aerostat.html already uses (USGS 3DEP, SRTM, GMTED). */
const TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';

export const lon2x = (lon, z) => (lon + 180) / 360 * Math.pow(2, z);
export const lat2y = (lat, z) => {
  const r = lat * Math.PI / 180;
  return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z);
};
/* metres per degree, locally */
export const mPerDegLat = 111132.9;
export const mPerDegLon = lat => 111320 * Math.cos(lat * Math.PI / 180);

/* An <img> that never loads and never errors leaves its promise hanging forever, and every
   caller of this is inside a Promise.all — so one stalled tile holds up the whole map. Give
   it a clock. A tile that misses the deadline is treated exactly like one that 404s: the
   caller counts it as missing and says so on the page. */
function loadTile(z, x, y, ms = 12000) {
  return new Promise((ok, no) => {
    const img = new Image();
    const t = setTimeout(() => { img.src = ''; no(new Error('tile ' + z + '/' + x + '/' + y + ' timed out')); }, ms);
    img.crossOrigin = 'anonymous';
    img.onload = () => { clearTimeout(t); ok(img); };
    img.onerror = () => { clearTimeout(t); no(new Error('tile ' + z + '/' + x + '/' + y)); };
    img.src = `${TILES}/${z}/${x}/${y}.png`;
  });
}

/* Pick the zoom whose pixels are near the sample spacing we want, so we are neither
   throwing away detail nor inventing it. */
export function pickZoom(lat, spanM, n) {
  const want = spanM / n;
  for (let z = 14; z >= 6; z--) {
    const res = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, z);
    if (res <= want) return z;
  }
  return 10;
}

/* A square DEM of n x n samples, spanM metres on a side, centred on lat/lon. */
export async function fetchDEM(lat, lon, spanM = 9000, n = 96, onNote) {
  const z = pickZoom(lat, spanM, n);
  const halfLat = spanM / 2 / mPerDegLat, halfLon = spanM / 2 / mPerDegLon(lat);
  const west = lon - halfLon, east = lon + halfLon, north = lat + halfLat, south = lat - halfLat;
  const x0 = Math.floor(lon2x(west, z)), x1 = Math.floor(lon2x(east, z));
  const y0 = Math.floor(lat2y(north, z)), y1 = Math.floor(lat2y(south, z));
  const cols = x1 - x0 + 1, rows = y1 - y0 + 1;
  if (onNote) onNote(`terrain: ${cols * rows} tile${cols * rows === 1 ? '' : 's'} at zoom ${z}`);

  const cv = document.createElement('canvas');
  cv.width = cols * 256; cv.height = rows * 256;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const got = await Promise.all(
    Array.from({ length: cols * rows }, (_, i) =>
      loadTile(z, x0 + (i % cols), y0 + Math.floor(i / cols)).catch(() => null))
  );
  let missing = 0;
  got.forEach((img, i) => {
    if (!img) { missing++; return; }
    ctx.drawImage(img, (i % cols) * 256, Math.floor(i / cols) * 256);
  });
  const px = ctx.getImageData(0, 0, cv.width, cv.height).data;

  const h = new Float32Array(n * n);
  let lo = Infinity, hi = -Infinity;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const la = north - (j + .5) / n * (north - south);
    const lo_ = west + (i + .5) / n * (east - west);
    const fx = (lon2x(lo_, z) - x0) * 256, fy = (lat2y(la, z) - y0) * 256;
    const sx = Math.max(0, Math.min(cv.width - 1, Math.round(fx)));
    const sy = Math.max(0, Math.min(cv.height - 1, Math.round(fy)));
    const p = (sy * cv.width + sx) * 4;
    const e = px[p] * 256 + px[p + 1] + px[p + 2] / 256 - 32768;
    h[j * n + i] = e;
    if (e < lo) lo = e;
    if (e > hi) hi = e;
  }
  return { h, n, spanM, lat, lon, zoom: z, lo, hi, missing, dx: spanM / n };
}

/* ---------- the forecast, draped ----------
   Neutral log profile, the same vertical shape WindNinja starts from. Anchored so the
   profile reproduces the forecast speed at its own reference height. */
export function logSpeed(Uref, zRef, zAGL, z0) {
  const zz = Math.max(zAGL, z0 * 1.2 + 0.1);
  return Uref * Math.log(zz / z0) / Math.log(Math.max(zRef, z0 * 2) / z0);
}
/* meteorological direction (where wind comes FROM, degrees) to vector components */
export function dirToVec(deg) {
  const r = (deg + 180) * Math.PI / 180;
  return { ex: Math.sin(r), ey: Math.cos(r) };
}

/* Where the horizontal levels sit, as heights above the domain floor. Fine at the bottom,
   because that is where the answer is wanted and where the profile bends hardest: every
   metre to 10, every ten to 100, then stretching geometrically up to the lid.

   The honest caveat: these are heights above the LOWEST ground in the square, not above each
   column's own ground. Where you stand near the floor of the view — a valley, a plain, most
   back gardens — the metre-scale levels are genuinely at your feet. On a summit that stands
   hundreds of metres above the lowest point, those fine levels are underground for that
   column and its lowest air sits in the stretched part. Fixing that properly means a
   terrain-following mesh, which is what WindNinja uses and what this is not. */
export function levels(top) {
  const zf = [];
  for (let z = 0; z <= 10; z++) zf.push(z);                  // every metre
  for (let z = 20; z <= 100; z += 10) zf.push(z);            // every ten
  let step = 14;
  while (zf[zf.length - 1] < top) {
    zf.push(zf[zf.length - 1] + step);
    step *= 1.42;
  }
  return Float64Array.from(zf);
}

/* ---------- the grid ----------
   Staggered (MAC): u on x-faces, v on y-faces, w on z-faces, L at cell centres. Divergence
   is then exact on each cell and the Laplacian is the natural one, with no checkerboard.
   Levels are non-uniform, so every vertical term carries its own spacing: a cell's own
   thickness for divergence, the gap between neighbouring centres for gradients. Pairing
   those two the wrong way round breaks the projection quietly. */
export function buildField(dem, opt = {}) {
  const nx = opt.nx || 64, ny = opt.ny || 64;
  const z0 = opt.z0 ?? 0.2, Uref = opt.U ?? 5, zRef = opt.zRef ?? 10, dirDeg = opt.dir ?? 270;
  /* Metres above the lowest ground. The lid has to clear the terrain by a good margin or it
     absorbs the flow instead of squeezing it: measured on a 400 m ridge, a lid at 2.3x the
     relief gave a crest SLOWDOWN of 0.55x, while 4x and above converge on a 1.58x speed-up. */
  const top = opt.top ?? Math.max(1200, 4 * (dem.hi - dem.lo));
  const zf = opt.zf || levels(top);
  const nz = zf.length - 1;
  /* zc: centre height of each level. ds: its thickness. dsf: gap between centres across
     face k, with the half-cells at the ground and the lid. */
  const zc = new Float64Array(nz), ds = new Float64Array(nz), dsf = new Float64Array(nz + 1);
  for (let k = 0; k < nz; k++) { zc[k] = (zf[k] + zf[k + 1]) / 2; ds[k] = zf[k + 1] - zf[k]; }
  dsf[0] = ds[0] / 2;
  for (let k = 1; k < nz; k++) dsf[k] = zc[k] - zc[k - 1];
  dsf[nz] = ds[nz - 1] / 2;
  const dx = dem.spanM / nx, dy = dem.spanM / ny;
  const base = dem.lo;

  /* terrain height sampled onto the solver's own columns */
  const ter = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const si = Math.min(dem.n - 1, Math.floor((i + .5) / nx * dem.n));
    const sj = Math.min(dem.n - 1, Math.floor((j + .5) / ny * dem.n));
    ter[j * nx + i] = dem.h[sj * dem.n + si];
  }
  /* solid = cell centre below ground */
  const solid = new Uint8Array(nx * ny * nz);
  const cid = (i, j, k) => (k * ny + j) * nx + i;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (base + zc[k] < ter[j * nx + i]) solid[cid(i, j, k)] = 1;
  }

  const { ex, ey } = dirToVec(dirDeg);
  const u = new Float32Array((nx + 1) * ny * nz), v = new Float32Array(nx * (ny + 1) * nz), w = new Float32Array(nx * ny * (nz + 1));
  const uid = (i, j, k) => (k * ny + j) * (nx + 1) + i;
  const vid = (i, j, k) => (k * (ny + 1) + j) * nx + i;
  const wid = (i, j, k) => (k * ny + j) * nx + i;

  /* initial field: the forecast's log profile in height above the local ground, blown
     in one direction. This is WindNinja's domain-average initialisation. */
  const colTer = (i, j) => ter[Math.max(0, Math.min(ny - 1, j)) * nx + Math.max(0, Math.min(nx - 1, i))];
  for (let k = 0; k < nz; k++) {
    const zAbs = base + zc[k];
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i <= nx; i++) {
        const g = (colTer(i - 1, j) + colTer(i, j)) / 2;
        u[uid(i, j, k)] = ex * logSpeed(Uref, zRef, zAbs - g, z0);
      }
    }
    for (let j = 0; j <= ny; j++) for (let i = 0; i < nx; i++) {
      const g = (colTer(i, j - 1) + colTer(i, j)) / 2;
      v[vid(i, j, k)] = ey * logSpeed(Uref, zRef, zAbs - g, z0);
    }
  }
  /* w starts at zero, exactly as WindNinja initialises it */
  return { nx, ny, nz, dx, dy, zf, zc, ds, dsf, dzNear: ds[0], base, top, ter, solid, u, v, w, cid, uid, vid, wid, dem, R: opt.R ?? 1, z0, Uref, zRef, dirDeg };
}

/* zero every face that touches ground, so no air blows through rock */
export function applyWalls(F) {
  const { nx, ny, nz, solid, cid, uid, vid, wid } = F;
  const sol = (i, j, k) => (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) ? 0 : solid[cid(i, j, k)];
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i <= nx; i++)
    if (sol(i - 1, j, k) || sol(i, j, k)) F.u[uid(i, j, k)] = 0;
  for (let k = 0; k < nz; k++) for (let j = 0; j <= ny; j++) for (let i = 0; i < nx; i++)
    if (sol(i, j - 1, k) || sol(i, j, k)) F.v[vid(i, j, k)] = 0;
  for (let k = 0; k <= nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++)
    if (sol(i, j, k - 1) || sol(i, j, k) || k === 0) F.w[wid(i, j, k)] = 0;
}

export function divergence(F) {
  const { nx, ny, nz, dx, dy, ds, solid, cid, uid, vid, wid, u, v, w } = F;
  const d = new Float64Array(nx * ny * nz);
  let peak = 0, sum = 0, cells = 0;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = cid(i, j, k);
    if (solid[c]) continue;
    const val = (u[uid(i + 1, j, k)] - u[uid(i, j, k)]) / dx
      + (v[vid(i, j + 1, k)] - v[vid(i, j, k)]) / dy
      + (w[wid(i, j, k + 1)] - w[wid(i, j, k)]) / ds[k];
    d[c] = val;
    peak = Math.max(peak, Math.abs(val));
    sum += val * val;
    cells++;
  }
  return { d, peak, rms: Math.sqrt(sum / Math.max(1, cells)), cells };
}

/* Solve L_xx + L_yy + R L_zz = -div(u0) by SOR, then correct the faces.
   Ground and other solid faces are Neumann (the wall term simply drops out of the stencil).
   Sides and top are open: L = 0 outside, which lets air leave. */
export function project(F, iters = 400, omega = 1.7, onStep) {
  const { nx, ny, nz, dx, dy, ds, dsf, solid, cid, uid, vid, wid, R } = F;
  applyWalls(F);
  const before = divergence(F);
  /* Float64, not 32: the vertical and horizontal coefficients differ by about 10^5 on a
     stretched grid, and single precision has only about seven digits to spend, so the
     residual stalls around 1e-5 for no physical reason. */
  const L = new Float64Array(nx * ny * nz);
  const ix = 1 / (dx * dx), iy = 1 / (dy * dy);
  /* vertical coefficients per level: the cell's own thickness times the gap to the
     neighbour's centre. izDn[k] reaches down across face k, izUp[k] up across face k+1. */
  const izDn = new Float64Array(nz), izUp = new Float64Array(nz);
  for (let k = 0; k < nz; k++) {
    izDn[k] = R / (ds[k] * dsf[k]);
    izUp[k] = R / (ds[k] * dsf[k + 1]);
  }
  const fluid = (i, j, k) => i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz && !solid[cid(i, j, k)];

  /* The stencil is fixed once per cell, so build the diagonal up front and keep the inner
     loop flat: no closures, no bounds objects. Out of the domain the floor is ground, a wall
     that drops out; the sides and top are open and contribute against a ghost L = 0. Getting
     that wrong leaves the operator disagreeing with the correction and the solve goes nowhere. */
  const sxy = nx * ny;
  const diag = new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = cid(i, j, k);
    if (solid[c]) continue;
    let dg = 0;
    if (i > 0) { if (!solid[c - 1]) dg += ix; } else dg += ix;
    if (i < nx - 1) { if (!solid[c + 1]) dg += ix; } else dg += ix;
    if (j > 0) { if (!solid[c - nx]) dg += iy; } else dg += iy;
    if (j < ny - 1) { if (!solid[c + nx]) dg += iy; } else dg += iy;
    if (k > 0 && !solid[c - sxy]) dg += izDn[k];             // k === 0 is the floor: wall
    if (k < nz - 1) { if (!solid[c + sxy]) dg += izUp[k]; } else dg += izUp[k];
    diag[c] = dg;
  }

  /* Solve a whole vertical column at a time, not a point at a time.

     The levels are 1 m apart near the ground while the columns are hundreds of metres wide,
     so the vertical couplings outweigh the horizontal ones by about 10^5. Point relaxation
     cannot carry information along a stiff direction like that: with omega near 1.8 it does
     not merely crawl, it diverges — measured, the residual grew 5.6x instead of falling.
     Taking each column as one tridiagonal system and solving it exactly (Thomas) leaves only
     the gentle horizontal coupling to iterate on, which is what makes a stretched grid
     tractable at all. */
  const rhs = before.d;
  const sub = new Float64Array(nz), dia = new Float64Array(nz), sup = new Float64Array(nz);
  const rr = new Float64Array(nz), cp = new Float64Array(nz), dp = new Float64Array(nz);
  let it = 0;
  for (; it < iters; it++) {
    let worst = 0;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      /* the fluid run in this column: terrain only ever fills it from the bottom */
      let k0 = 0;
      while (k0 < nz && solid[cid(i, j, k0)]) k0++;
      if (k0 >= nz) continue;
      let n = 0;
      for (let k = k0; k < nz; k++) {
        const c = cid(i, j, k);
        let acc = 0;
        if (i > 0 && !solid[c - 1]) acc += ix * L[c - 1];
        if (i < nx - 1 && !solid[c + 1]) acc += ix * L[c + 1];
        if (j > 0 && !solid[c - nx]) acc += iy * L[c - nx];
        if (j < ny - 1 && !solid[c + nx]) acc += iy * L[c + nx];
        dia[n] = diag[c];
        sub[n] = (k > k0 && !solid[c - sxy]) ? -izDn[k] : 0;
        sup[n] = (k < nz - 1 && !solid[c + sxy]) ? -izUp[k] : 0;
        rr[n] = acc + rhs[c];                                // +div because L_lap = -div
        n++;
      }
      /* Thomas: forward sweep, then back-substitute */
      cp[0] = sup[0] / dia[0];
      dp[0] = rr[0] / dia[0];
      for (let m = 1; m < n; m++) {
        const den = dia[m] - sub[m] * cp[m - 1];
        cp[m] = sup[m] / den;
        dp[m] = (rr[m] - sub[m] * dp[m - 1]) / den;
      }
      let x = dp[n - 1];
      for (let m = n - 1; m >= 0; m--) {
        if (m < n - 1) x = dp[m] - cp[m] * x;
        const c = cid(i, j, k0 + m);
        const d = omega * (x - L[c]);
        L[c] += d;
        const ad = d < 0 ? -d : d;
        if (ad > worst) worst = ad;
      }
    }
    if ((it & 15) === 15) {
      if (onStep) onStep(it / iters);
      if (worst < 1e-7) { it++; break; }
    }
  }
  F.sweeps = it;

  /* u = u0 + grad L, with the vertical scaled by R. The open boundary faces are corrected
     too, against the same ghost L = 0 the operator assumed, which is what lets air leave. */
  const Lat = (i, j, k) => (i < 0 || j < 0 || i >= nx || j >= ny || k >= nz) ? 0 : L[cid(i, j, k)];
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i <= nx; i++) {
    const a = fluid(i - 1, j, k), b = fluid(i, j, k);
    const aEdge = i === 0, bEdge = i === nx;
    if (!(a || aEdge) || !(b || bEdge)) continue;            // a face against terrain stays walled
    if ((i > 0 && !a) || (i < nx && !b)) continue;
    F.u[uid(i, j, k)] += (Lat(i, j, k) - Lat(i - 1, j, k)) / dx;
  }
  for (let k = 0; k < nz; k++) for (let j = 0; j <= ny; j++) for (let i = 0; i < nx; i++) {
    const a = fluid(i, j - 1, k), b = fluid(i, j, k);
    if ((j > 0 && !a) || (j < ny && !b)) continue;
    F.v[vid(i, j, k)] += (Lat(i, j, k) - Lat(i, j - 1, k)) / dy;
  }
  for (let k = 1; k <= nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = fluid(i, j, k - 1), b = fluid(i, j, k);
    if (!a) continue;                                        // k-1 must be real fluid
    if (k < nz && !b) continue;
    F.w[wid(i, j, k)] += R * (Lat(i, j, k) - Lat(i, j, k - 1)) / dsf[k];
  }
  applyWalls(F);
  const after = divergence(F);
  F.L = L;
  return { before, after, drop: before.rms / Math.max(1e-30, after.rms) };
}

/* ---------- reading the answer ----------
   Wind at a fixed height above the local ground, as a 2D field for drawing. */
export function surfaceSlice(F, zAGL = 10, out = 96) {
  const { nx, ny, nz, zc, ds, base, ter, uid, vid, u, v, cid, solid, z0 } = F;
  const U = new Float32Array(out * out), V = new Float32Array(out * out), S = new Float32Array(out * out);
  for (let b = 0; b < out; b++) for (let a = 0; a < out; a++) {
    const i = Math.min(nx - 1, Math.floor((a + .5) / out * nx));
    const j = Math.min(ny - 1, Math.floor((b + .5) / out * ny));
    const g = ter[j * nx + i];
    /* The lowest cell that is genuinely IN the air. A cell whose centre clears the ground by
       a few centimetres counts as fluid but has nearly every face walled, so it carries almost
       no flow; trusting it and then scaling it up by a large log factor was enough to make the
       crest reading jump when the lid moved by three metres. Skip anything mostly buried. */
    let k = 0;
    while (k < nz - 1 && (solid[cid(i, j, k)] || base + zc[k] - g < 0.4 * ds[k])) k++;
    const cellAGL = Math.max(0.2, base + zc[k] - g);
    const uu = (u[uid(i, j, k)] + u[uid(i + 1, j, k)]) / 2;
    const vv = (v[vid(i, j, k)] + v[vid(i, j + 1, k)]) / 2;
    /* That cell centre sits anywhere from a metre to most of a cell above the ground,
       depending on where the mask happened to fall. Comparing columns at the height the
       caller asked for, rather than at whatever height each cell landed, is the difference
       between a stable reading and one that flips with the grid. */
    const f = Math.log(Math.max(zAGL, z0 * 2) / z0) / Math.log(Math.max(cellAGL, z0 * 2) / z0);
    const o = b * out + a;
    U[o] = uu * f; V[o] = vv * f; S[o] = Math.hypot(U[o], V[o]);
  }
  return { U, V, S, n: out };
}

/* which level holds a given height above the domain floor; the levels are not evenly
   spaced, so this is a search rather than a division */
export function levelAt(F, zAboveBase) {
  const { zf, nz } = F;
  if (zAboveBase <= zf[0]) return 0;
  for (let k = 0; k < nz; k++) if (zAboveBase < zf[k + 1]) return k;
  return nz - 1;
}

/* The wind at a point in the world, for anything that has to move through the field rather
   than be drawn on it. Coordinates are metres from the centre of the square: +x east,
   +y north, z absolute (metres above sea level, the same datum as the terrain).

   Bilinear across the columns, nearest in the vertical. Nearest is honest here because the
   levels are a metre apart where a thrown or falling thing spends its time; interpolating
   between a 1 m and a 2 m level would be false precision over a field this coarse sideways. */
export function windAt(F, xE, yN, zAbs) {
  const { nx, ny, dx, dy, base, uid, vid, wid, u, v, w, cid, solid } = F;
  const gx = xE / dx + nx / 2 - 0.5, gy = ny / 2 - 0.5 - yN / dy;
  if (gx < -0.5 || gy < -0.5 || gx > nx - 0.5 || gy > ny - 0.5) return null;   // outside the square
  const k = levelAt(F, zAbs - base);
  const i0 = Math.max(0, Math.min(nx - 1, Math.floor(gx))), j0 = Math.max(0, Math.min(ny - 1, Math.floor(gy)));
  const i1 = Math.min(nx - 1, i0 + 1), j1 = Math.min(ny - 1, j0 + 1);
  const fx = Math.max(0, Math.min(1, gx - i0)), fy = Math.max(0, Math.min(1, gy - j0));
  const at = (i, j) => {
    if (solid[cid(i, j, k)]) return null;                                      // inside the hill
    return [(u[uid(i, j, k)] + u[uid(i + 1, j, k)]) / 2,
            (v[vid(i, j, k)] + v[vid(i, j + 1, k)]) / 2,
            (w[wid(i, j, k)] + w[wid(i, j, k + 1)]) / 2];
  };
  const c = [at(i0, j0), at(i1, j0), at(i0, j1), at(i1, j1)];
  const wt = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
  const out = [0, 0, 0];
  let got = 0;
  for (let n = 0; n < 4; n++) {
    if (!c[n]) continue;
    got += wt[n];
    for (let d = 0; d < 3; d++) out[d] += c[n][d] * wt[n];
  }
  if (got < 1e-6) return [0, 0, 0];                                            // all four underground
  for (let d = 0; d < 3; d++) out[d] /= got;
  return out;
}

/* The wind a column actually carries near its own ground, for anywhere the 3D field has
   nothing to say.

   Why this is needed: the levels are fine above the LOWEST ground in the square, so on a
   summit a few hundred metres above that floor, everything within throwing height of the
   surface falls inside blocked cells and the field reads zero. A disc released there would
   fly through dead air and the wind would appear to do nothing at all. This walks up the
   column to the first cell genuinely in the air, takes its wind, and brings it down to the
   height asked for with the same neutral log profile the solver started from. It is the
   surface slice's logic at a single point. */
export function windColumn(F, xE, yN, zAbs) {
  const { nx, ny, dx, dy, nz, zc, ds, base, ter, uid, vid, u, v, cid, solid, z0 } = F;
  const i = Math.max(0, Math.min(nx - 1, Math.floor(xE / dx + nx / 2)));
  const j = Math.max(0, Math.min(ny - 1, Math.floor(ny / 2 - yN / dy)));
  const g = ter[j * nx + i];
  let k = 0;
  while (k < nz - 1 && (solid[cid(i, j, k)] || base + zc[k] - g < 0.4 * ds[k])) k++;
  const cellAGL = Math.max(0.2, base + zc[k] - g);
  const uu = (u[uid(i, j, k)] + u[uid(i + 1, j, k)]) / 2;
  const vv = (v[vid(i, j, k)] + v[vid(i, j + 1, k)]) / 2;
  const agl = Math.max(0.2, zAbs - g);
  const f = Math.log(Math.max(agl, z0 * 2) / z0) / Math.log(Math.max(cellAGL, z0 * 2) / z0);
  return [uu * f, vv * f, 0];
}

/* What a thrown thing should feel: the solved field where it has an answer, the column's own
   near-surface wind where it does not. */
export function windForFlight(F, xE, yN, zAbs) {
  const q = windAt(F, xE, yN, zAbs);
  if (q && (q[0] !== 0 || q[1] !== 0 || q[2] !== 0)) return q;
  return windColumn(F, xE, yN, zAbs);
}

/* The ground height at a point, same coordinates: what a thrown thing lands on.

   Bilinear, deliberately. Nearest-cell made the ground a staircase of 250 m blocks, and a
   flight path does not survive that: the centre of the square sits exactly on a rounding
   boundary, so a disc drifting a millimetre sideways crossed into the next cell and the
   ground stepped up 3.7 m into it, ending the flight on the first frame. A continuous
   surface has no edges to trip over. */
export function groundAt(F, xE, yN) {
  const { nx, ny, dx, dy, ter } = F;
  const gx = Math.max(0, Math.min(nx - 1.001, xE / dx + nx / 2 - 0.5));
  const gy = Math.max(0, Math.min(ny - 1.001, ny / 2 - 0.5 - yN / dy));
  const i = Math.floor(gx), j = Math.floor(gy), fx = gx - i, fy = gy - j;
  const i1 = Math.min(nx - 1, i + 1), j1 = Math.min(ny - 1, j + 1);
  return ter[j * nx + i] * (1 - fx) * (1 - fy) + ter[j * nx + i1] * fx * (1 - fy)
       + ter[j1 * nx + i] * (1 - fx) * fy + ter[j1 * nx + i1] * fx * fy;
}

/* bilinear sample in grid coordinates 0..n-1, the interpolation nullschool uses between
   its grid points so particles see a smooth field rather than a staircase */
export function sampleBilinear(fld, gx, gy) {
  const n = fld.n;
  const x = Math.max(0, Math.min(n - 1.001, gx)), y = Math.max(0, Math.min(n - 1.001, gy));
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const at = (a, b) => b * n + a;
  const g = (A) => A[at(i, j)] * (1 - fx) * (1 - fy) + A[at(i + 1, j)] * fx * (1 - fy)
    + A[at(i, j + 1)] * (1 - fx) * fy + A[at(i + 1, j + 1)] * fx * fy;
  return { u: g(fld.U), v: g(fld.V), s: g(fld.S) };
}

/* ---------- a terrain the test can trust ----------
   A smooth ridge across the domain: analytic, so the physics checks do not depend on
   the network or on whatever happens to be under the user. */
/* An isolated hill, round in plan. A ridge runs to infinity sideways, so air has no way
   around it and the over-or-around question has only one answer; a hill lets it choose. */
export function syntheticHill(n = 96, spanM = 9000, height = 420) {
  const h = new Float32Array(n * n);
  let lo = Infinity, hi = -Infinity;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = (i / (n - 1) - .5) * 2, y = (j / (n - 1) - .5) * 2;
    const e = 1000 + height * Math.exp(-(x * x + y * y) / 0.10);
    h[j * n + i] = e;
    lo = Math.min(lo, e); hi = Math.max(hi, e);
  }
  return { h, n, spanM, lat: 39.8366, lon: -105.0372, zoom: 0, lo, hi, missing: 0, dx: spanM / n };
}

export function syntheticRidge(n = 96, spanM = 9000, height = 400) {
  const h = new Float32Array(n * n);
  let lo = Infinity, hi = -Infinity;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = (i / (n - 1) - .5) * 2;
    const e = 1000 + height * Math.exp(-(x * x) / 0.06);
    h[j * n + i] = e;
    lo = Math.min(lo, e); hi = Math.max(hi, e);
  }
  return { h, n, spanM, lat: 39.8366, lon: -105.0372, zoom: 0, lo, hi, missing: 0, dx: spanM / n };
}
