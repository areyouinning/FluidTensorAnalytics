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

   The mesh follows the terrain, as WindNinja's does. Every column starts at its own ground
   and ends at the same flat lid, so the metre-scale levels are a metre above the surface
   wherever you stand — on the valley floor and on the summit alike. There are no masked
   cells and no rock: the ground is a boundary, not a hole in the grid.

   The coordinate, written out, is a hybrid sigma. Let s run from 0 at the ground to the lid
   depth, and let g be how far this column's ground stands above the lowest ground in the
   square. Then

       z(s) = base + s + g B(s),     B(0) = 1,  B(lid) = 0

   so near the surface (B = 1) height above ground is exactly s, identical for every column,
   and by the lid the terrain's influence has been blended away to a flat ceiling. The
   vertical stretch of a column is J = dz/ds = 1 + g B'(s), which is 1 near the ground and
   shrinks aloft over the high columns, because they have less air above them.

   Differences from WindNinja that remain: it uses finite elements, this uses finite volumes
   on the same kind of mesh; there is no diurnal slope flow and no non-neutral stability. */

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

/* Where the levels sit in the computational coordinate s. Fine at the bottom, because that
   is where the answer is wanted and where the profile bends hardest: every metre to 10,
   every ten to 100, then stretching geometrically up to the lid.

   Near the ground the mesh has B = 1, so s IS height above that column's own ground, and
   these spacings mean what they say for every column in the square — the valley floor and
   the summit get the same metre-scale levels at their own feet. Higher up, where the mesh
   blends to a flat lid, a level's height above ground shrinks over high ground, which is
   just the statement that a summit has less air above it. */
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

/* ---------- the mesh ----------
   Staggered (MAC) in the computational coordinates (x, y, s): u on x-faces, v on y-faces,
   and on the s-faces NOT the physical vertical velocity but the contravariant one,

       omega = w - u dz/dx - v dz/dy      (the flow THROUGH a tilted s-surface)

   which is the quantity that must vanish at the ground. Storing omega rather than w is what
   makes the impermeable-ground condition one line instead of a mask, and what keeps the
   projection's operator diagonal. Physical w is diagnosed afterwards for anything that has
   to fly through the field.

   Why this shape of the problem stays easy: the x-face of a computational cell has area
   vector (J dy ds, 0, 0) — purely x, because x is untouched by the transform — and the
   s-face has area vector dx dy (-dz/dx, -dz/dy, 1), whose dot with the velocity is exactly
   dx dy omega. So the net volume flux out of a cell is a plain six-term difference, and the
   minimisation done on those fluxes gives an operator and a correction that agree term for
   term. The terrain's slope enters through the initial omega and through J, not through
   cross-derivatives bolted onto a Laplacian. */
export function buildField(dem, opt = {}) {
  const nx = opt.nx || 64, ny = opt.ny || 64;
  const z0 = opt.z0 ?? 0.2, Uref = opt.U ?? 5, zRef = opt.zRef ?? 10, dirDeg = opt.dir ?? 270;
  /* Depth of the computational domain, in metres above the lowest ground. The lid has to
     clear the terrain by a good margin or it absorbs the flow instead of squeezing it:
     measured on a 400 m ridge, a lid at 2.3x the relief gave a crest SLOWDOWN of 0.55x.

     The margin that counts has MOVED with this mesh, and the old number is no longer the
     right one. On the masked Cartesian grid the crest ratio had settled by 4x. On the
     terrain-following mesh the same ridge reads 1.72 at a lid of 4.1x, 1.80 at 5.8x and
     1.84 at 8.1x, where it stops moving (11.5x also gives 1.85). Four times the relief is
     now 7% low. Asking for 6x lands the first level past it at about 8x, which is where it
     converges, and costs four more levels. */
  const relief = Math.max(1e-6, dem.hi - dem.lo);
  const want = opt.top ?? Math.max(1200, 6 * relief);
  const zf = opt.zf || levels(want);
  const nz = zf.length - 1;
  /* levels() stops at the first face PAST the depth asked for, so the real lid is zf[nz],
     not `want`. Everything about the mesh has to be measured against the real one: a blend
     whose ramp ends at `want` keeps going past the bottom of its cosine, which turns the
     stretch back upwards and leaves the lid tilted by most of the relief. */
  const top = zf[nz];
  /* zc: centre of each level in s. ds: its thickness. dsf: gap between centres across
     face k, with the half-cells at the ground and the lid. */
  const zc = new Float64Array(nz), ds = new Float64Array(nz), dsf = new Float64Array(nz + 1);
  for (let k = 0; k < nz; k++) { zc[k] = (zf[k] + zf[k + 1]) / 2; ds[k] = zf[k + 1] - zf[k]; }
  dsf[0] = ds[0] / 2;
  for (let k = 1; k < nz; k++) dsf[k] = zc[k] - zc[k - 1];
  dsf[nz] = ds[nz - 1] / 2;
  const dx = dem.spanM / nx, dy = dem.spanM / ny;
  const base = dem.lo;

  /* The blend B(s): flat 1 while the mesh is still hugging the ground, then a cosine ramp
     to 0 at the lid. The ramp has to be long enough that it never folds the mesh over —
     J = 1 + g B' must stay positive, and B' peaks at pi/(2 ramp). Holding the ramp at two
     thirds of the domain depth keeps the worst case at J = 0.41 on the highest column,
     since the lid is at least four times the relief. */
  const sFlat = top / 3, ramp = top - sFlat;
  const blend = s => s <= sFlat ? 1 : s >= top ? 0 : (1 + Math.cos(Math.PI * (s - sFlat) / ramp)) / 2;
  const dBlend = s => (s <= sFlat || s >= top) ? 0 : -Math.PI * Math.sin(Math.PI * (s - sFlat) / ramp) / (2 * ramp);
  const Bc = new Float64Array(nz), dBc = new Float64Array(nz);
  const Bf = new Float64Array(nz + 1), dBf = new Float64Array(nz + 1);
  for (let k = 0; k < nz; k++) { Bc[k] = blend(zc[k]); dBc[k] = dBlend(zc[k]); }
  for (let k = 0; k <= nz; k++) { Bf[k] = blend(zf[k]); dBf[k] = dBlend(zf[k]); }

  /* terrain height sampled onto the solver's own columns, and how far each column's ground
     stands above the lowest ground — the only terrain quantity the mesh needs */
  const ter = new Float32Array(nx * ny), grel = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const si = Math.min(dem.n - 1, Math.floor((i + .5) / nx * dem.n));
    const sj = Math.min(dem.n - 1, Math.floor((j + .5) / ny * dem.n));
    const e = dem.h[sj * dem.n + si];
    ter[j * nx + i] = e; grel[j * nx + i] = e - base;
  }
  const colG = (i, j) => grel[Math.max(0, Math.min(ny - 1, j)) * nx + Math.max(0, Math.min(nx - 1, i))];
  /* terrain slope per column, central difference, clamped at the edges */
  const gx = new Float32Array(nx * ny), gy = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    gx[j * nx + i] = (colG(i + 1, j) - colG(i - 1, j)) / (2 * dx);
    gy[j * nx + i] = (colG(i, j + 1) - colG(i, j - 1)) / (2 * dy);
  }

  const cid = (i, j, k) => (k * ny + j) * nx + i;
  const uid = (i, j, k) => (k * ny + j) * (nx + 1) + i;
  const vid = (i, j, k) => (k * (ny + 1) + j) * nx + i;
  const wid = (i, j, k) => (k * ny + j) * nx + i;
  const { ex, ey } = dirToVec(dirDeg);
  const u = new Float32Array((nx + 1) * ny * nz), v = new Float32Array(nx * (ny + 1) * nz);
  const om = new Float64Array(nx * ny * (nz + 1)), w = new Float32Array(nx * ny * (nz + 1));

  /* Initial field: the forecast's log profile in height above the local ground, blown in one
     direction. Height above ground is now exact per column — s minus the part of the column's
     own relief the blend has already given back — rather than a height above the lowest
     ground that happened to land inside the hill. */
  for (let k = 0; k < nz; k++) {
    const shed = 1 - Bc[k];                       // how much of g this level has shed
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i <= nx; i++) {
        const g = (colG(i - 1, j) + colG(i, j)) / 2;
        u[uid(i, j, k)] = ex * logSpeed(Uref, zRef, zc[k] - g * shed, z0);
      }
    }
    for (let j = 0; j <= ny; j++) for (let i = 0; i < nx; i++) {
      const g = (colG(i, j - 1) + colG(i, j)) / 2;
      v[vid(i, j, k)] = ey * logSpeed(Uref, zRef, zc[k] - g * shed, z0);
    }
  }
  const F = {
    nx, ny, nz, dx, dy, zf, zc, ds, dsf, dzNear: ds[0], base, top, relief, sFlat,
    ter, grel, gx, gy, Bc, dBc, Bf, dBf, u, v, om, w,
    cid, uid, vid, wid, dem, R: opt.R ?? 1, z0, Uref, zRef, dirDeg
  };
  /* Physical w starts at zero, exactly as WindNinja initialises it. In this coordinate that
     is NOT omega = 0: air moving horizontally across a slope is crossing the s-surfaces, and
     omega records that. Setting omega to zero instead would be asserting a perfect drape and
     quietly doing the solver's job for it. */
  for (let k = 0; k <= nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = wid(i, j, k);
    const [uf, vf] = faceUV(F, i, j, k);
    om[c] = -(uf * gx[j * nx + i] * Bf[k] + vf * gy[j * nx + i] * Bf[k]);
  }
  applyWalls(F);
  diagnoseW(F);
  return F;
}

/* u and v interpolated to the centre of s-face k: average across the face in the horizontal,
   and across the two levels the face separates. */
function faceUV(F, i, j, k) {
  const { nx, ny, nz, uid, vid, u, v } = F;
  const lev = kk => {
    const a = (u[uid(i, j, kk)] + u[uid(i + 1, j, kk)]) / 2;
    const b = (v[vid(i, j, kk)] + v[vid(i, j + 1, kk)]) / 2;
    return [a, b];
  };
  if (k === 0) return lev(0);
  if (k >= nz) return lev(nz - 1);
  const a = lev(k - 1), b = lev(k);
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/* The vertical stretch J = dz/ds of a column, at a cell centre and at an s-face. 1 near the
   ground, smaller aloft over high ground. */
export const Jc = (F, i, j, k) => 1 + F.grel[j * F.nx + i] * F.dBc[k];
export const Jf = (F, i, j, k) => 1 + F.grel[j * F.nx + i] * F.dBf[k];
/* absolute height of a cell centre / an s-face in this column */
export const zAtC = (F, i, j, k) => F.base + F.zc[k] + F.grel[j * F.nx + i] * F.Bc[k];
export const zAtF = (F, i, j, k) => F.base + F.zf[k] + F.grel[j * F.nx + i] * F.Bf[k];
/* height above this column's own ground — the number the whole mesh exists to get right */
export const aglC = (F, i, j, k) => F.zc[k] - F.grel[j * F.nx + i] * (1 - F.Bc[k]);

/* The ground is impermeable: nothing flows through the s = 0 surface. That is the entire
   wall condition now — no mask, no faces to seal, no rock. u and v at the ground are free
   to run along the slope, which is what air actually does. */
export function applyWalls(F) {
  const { nx, ny, wid, om } = F;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) om[wid(i, j, 0)] = 0;
}

/* Divergence per cell, as a physical 1/s: net volume flux through the six faces divided by
   the cell's physical volume J dx dy ds. The x-face carries J dy ds u, the y-face J dx ds v,
   and the s-face dx dy omega. */
export function divergence(F) {
  const { nx, ny, nz, dx, dy, ds, cid, uid, vid, wid, u, v, om } = F;
  const d = new Float64Array(nx * ny * nz);
  let peak = 0, sum = 0, cells = 0;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = cid(i, j, k);
    const jm = Jc(F, i, j, k);
    const jxL = (jm + (i > 0 ? Jc(F, i - 1, j, k) : jm)) / 2;
    const jxR = (jm + (i < nx - 1 ? Jc(F, i + 1, j, k) : jm)) / 2;
    const jyD = (jm + (j > 0 ? Jc(F, i, j - 1, k) : jm)) / 2;
    const jyU = (jm + (j < ny - 1 ? Jc(F, i, j + 1, k) : jm)) / 2;
    const flux = (jxR * u[uid(i + 1, j, k)] - jxL * u[uid(i, j, k)]) * dy * ds[k]
      + (jyU * v[vid(i, j + 1, k)] - jyD * v[vid(i, j, k)]) * dx * ds[k]
      + (om[wid(i, j, k + 1)] - om[wid(i, j, k)]) * dx * dy;
    const val = flux / (jm * dx * dy * ds[k]);
    d[c] = val;
    peak = Math.max(peak, Math.abs(val));
    sum += val * val;
    cells++;
  }
  return { d, peak, rms: Math.sqrt(sum / Math.max(1, cells)), cells };
}

/* Minimise the change to the draped wind subject to zero net flux per cell, then correct
   the faces.

   The minimisation is done on the FLUXES, not on the velocity components, and that is what
   keeps this tractable on a terrain-following mesh. Penalise each face's flux change with
   the weight that reproduces the physical cost over that face's own control volume, and the
   stationarity conditions give one unknown per cell against a seven-point stencil, with no
   cross-derivatives. Operator and correction then agree by construction — which matters
   more than it sounds: a mismatched pair still produces a picture that looks fine while
   dropping divergence by 1.4x instead of five orders of magnitude.

   What is approximated, stated plainly: the horizontal adjustment and the through-surface
   adjustment are penalised separately, so the cost of tilting the flow along a slope is not
   cross-coupled between them. On gentle terrain that coupling is small; on a cliff it is
   not, and this will under-charge for vertical motion there.

   The ground is Neumann — the s = 0 face simply drops out of the stencil. Sides and lid are
   open: lambda = 0 outside, which lets air leave. */
export function project(F, iters = 400, omega = 1.8, onStep) {
  const { nx, ny, nz, dx, dy, ds, dsf, cid, uid, vid, wid, R } = F;
  applyWalls(F);
  const before = divergence(F);
  /* Float64, not 32: the vertical and horizontal coefficients differ by about 10^5 on a
     stretched grid, and single precision has only about seven digits to spend, so the
     residual stalls around 1e-5 for no physical reason. */
  const L = new Float64Array(nx * ny * nz);
  const ixx = 1 / (dx * dx), iyy = 1 / (dy * dy);

  /* Every coefficient is the face's flux weight divided by the cell's own volume, so that
     on flat ground (J = 1 everywhere) this reduces term for term to the plain Cartesian
     operator: 1/dx^2 sideways, R/(ds dsf) vertically. The mesh enters only as the ratio of
     the face's stretch to the cell's. */
  const sxy = nx * ny;
  const cxL = new Float64Array(nx * ny * nz), cxR = new Float64Array(nx * ny * nz);
  const cyD = new Float64Array(nx * ny * nz), cyU = new Float64Array(nx * ny * nz);
  const czD = new Float64Array(nx * ny * nz), czU = new Float64Array(nx * ny * nz);
  const diag = new Float64Array(nx * ny * nz);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = cid(i, j, k);
    const jm = Jc(F, i, j, k);
    const half = (a, b) => (a + b) / 2;
    const jl = half(jm, i > 0 ? Jc(F, i - 1, j, k) : jm);
    const jr = half(jm, i < nx - 1 ? Jc(F, i + 1, j, k) : jm);
    const jd = half(jm, j > 0 ? Jc(F, i, j - 1, k) : jm);
    const ju = half(jm, j < ny - 1 ? Jc(F, i, j + 1, k) : jm);
    cxL[c] = ixx * jl / jm; cxR[c] = ixx * jr / jm;
    cyD[c] = iyy * jd / jm; cyU[c] = iyy * ju / jm;
    /* the s-faces: the cell's own thickness times the gap to the neighbour's centre,
       with the face's stretch in the denominator because a squeezed column has less
       distance to push the air through */
    czD[c] = k > 0 ? R / (jm * Jf(F, i, j, k) * ds[k] * dsf[k]) : 0;   // k === 0 is the ground: wall
    czU[c] = R / (jm * Jf(F, i, j, k + 1) * ds[k] * dsf[k + 1]);
    diag[c] = cxL[c] + cxR[c] + cyD[c] + cyU[c] + czD[c] + czU[c];
  }

  /* Solve a whole vertical column at a time, not a point at a time.

     The levels are 1 m apart near the ground while the columns are hundreds of metres wide,
     so the vertical couplings outweigh the horizontal ones by about 10^5. Point relaxation
     cannot carry information along a stiff direction like that: with omega near 1.8 it does
     not merely crawl, it diverges — measured, the residual grew 5.6x instead of falling.
     Taking each column as one tridiagonal system and solving it exactly (Thomas) leaves only
     the gentle horizontal coupling to iterate on, which is what makes a stretched grid
     tractable at all.

     That also moved where the relaxation factor can safely go, and the old setting was left
     behind. The 1.8-diverges warning belonged to POINT relaxation; solving whole columns is
     far more robust, and measured over 160 sweeps on hills of 420, 950 and 1800 m relief at
     three values of R, the divergence drop climbs monotonically from about 5e3 at omega 1.3
     to a peak near 1.85, then falls off a cliff: 2e7 at 1.85, 2e7 at 1.9, 4e3 at 1.95 and
     nothing at all by 1.99. 1.8 buys three orders of magnitude over 1.3 for the same work
     and keeps a margin from the edge. */
  const rhs = before.d;
  const sub = new Float64Array(nz), dia = new Float64Array(nz), sup = new Float64Array(nz);
  const rr = new Float64Array(nz), cp = new Float64Array(nz), dp = new Float64Array(nz);
  let it = 0;
  for (; it < iters; it++) {
    let worst = 0;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      /* Every column runs the full depth now: the mesh starts at this column's own ground,
         so there is no buried run to skip past. */
      const n = nz;
      for (let k = 0; k < nz; k++) {
        const c = cid(i, j, k);
        let acc = 0;
        if (i > 0) acc += cxL[c] * L[c - 1];
        if (i < nx - 1) acc += cxR[c] * L[c + 1];
        if (j > 0) acc += cyD[c] * L[c - nx];
        if (j < ny - 1) acc += cyU[c] * L[c + nx];
        dia[k] = diag[c];
        sub[k] = k > 0 ? -czD[c] : 0;
        sup[k] = k < nz - 1 ? -czU[c] : 0;
        rr[k] = acc + rhs[c];                                // +div because lap(lambda) = -div
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
        const c = cid(i, j, m);
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

  /* u = u0 + grad(lambda), the vertical scaled by R and by the face's own stretch — exactly
     the same ratio the operator put in its coefficient, which is why the divergence actually
     goes to zero rather than merely getting smaller. Every face is corrected, including the
     open sides and lid, against the same ghost lambda = 0 the operator assumed. The ground
     face at k = 0 is the one exception: it stays sealed. */
  const Lat = (i, j, k) => (i < 0 || j < 0 || i >= nx || j >= ny || k >= nz) ? 0 : L[cid(i, j, k)];
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i <= nx; i++)
    F.u[uid(i, j, k)] += (Lat(i, j, k) - Lat(i - 1, j, k)) / dx;
  for (let k = 0; k < nz; k++) for (let j = 0; j <= ny; j++) for (let i = 0; i < nx; i++)
    F.v[vid(i, j, k)] += (Lat(i, j, k) - Lat(i, j - 1, k)) / dy;
  for (let k = 1; k <= nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++)
    F.om[wid(i, j, k)] += R * (Lat(i, j, k) - Lat(i, j, k - 1)) / (Jf(F, i, j, k) * dsf[k]);
  applyWalls(F);
  const after = divergence(F);
  F.L = L;
  diagnoseW(F);
  return { before, after, drop: before.rms / Math.max(1e-30, after.rms) };
}

/* Physical vertical velocity, recovered from the contravariant one: w = omega + u z_x + v z_y.
   The solve never needs it; everything that has to fly through the field does. */
export function diagnoseW(F) {
  const { nx, ny, nz, gx, gy, Bf, wid, om, w } = F;
  for (let k = 0; k <= nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = wid(i, j, k), g = j * nx + i;
    const [uf, vf] = faceUV(F, i, j, k);
    w[c] = om[c] + (uf * gx[g] + vf * gy[g]) * Bf[k];
  }
}

/* ---------- reading the answer ----------
   Wind at a fixed height above the local ground, as a 2D field for drawing.

   This used to be the hardest function in the file, and the mesh has made it ordinary. On a
   masked Cartesian grid a column's lowest unburied cell landed wherever the mask happened
   to cut it — anywhere from a centimetre to most of a cell up — so every column was read at
   a different height and then stretched to a common one by a log factor, and the crest
   reading moved when the lid moved by three metres. Here the level at 10 m above ground is
   the level at 10 m above ground, in every column, by construction. */
export function surfaceSlice(F, zAGL = 10, out = 96) {
  const { nx, ny, nz, uid, vid, u, v, z0 } = F;
  const U = new Float32Array(out * out), V = new Float32Array(out * out), S = new Float32Array(out * out);
  const lg = z => Math.log(Math.max(z, z0 * 1.2 + 0.1) / z0);
  for (let b = 0; b < out; b++) for (let a = 0; a < out; a++) {
    const i = Math.min(nx - 1, Math.floor((a + .5) / out * nx));
    const j = Math.min(ny - 1, Math.floor((b + .5) / out * ny));
    const cen = k => [(u[uid(i, j, k)] + u[uid(i + 1, j, k)]) / 2,
                      (v[vid(i, j, k)] + v[vid(i, j + 1, k)]) / 2];
    let k = 0;
    while (k < nz - 2 && aglC(F, i, j, k + 1) <= zAGL) k++;
    const z1 = aglC(F, i, j, k), z2 = aglC(F, i, j, k + 1);
    const c1 = cen(k), c2 = cen(k + 1);
    /* interpolate between the two levels in log height, the shape the profile actually has
       near the ground; below the first centre (half a metre up) the same log carries it down */
    const t = (lg(zAGL) - lg(z1)) / Math.max(1e-9, lg(z2) - lg(z1));
    const o = b * out + a;
    U[o] = c1[0] + (c2[0] - c1[0]) * t;
    V[o] = c1[1] + (c2[1] - c1[1]) * t;
    S[o] = Math.hypot(U[o], V[o]);
  }
  return { U, V, S, n: out };
}

/* which level of a given column holds a given absolute height. The mesh follows the terrain,
   so this depends on the column — a height that is level 3 in the valley is underground on
   the ridge. Binary search, because the levels are not evenly spaced. */
export function levelAtColumn(F, i, j, zAbs) {
  const { nz } = F;
  if (zAbs <= zAtF(F, i, j, 0)) return 0;
  if (zAbs >= zAtF(F, i, j, nz)) return nz - 1;
  let lo = 0, hi = nz;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (zAtF(F, i, j, mid) <= zAbs) lo = mid; else hi = mid;
  }
  return lo;
}

/* Kept for callers that think in heights above the domain floor. On a terrain-following mesh
   that is only the lowest column's story, so prefer levelAtColumn where the column is known. */
export function levelAt(F, zAboveBase) {
  const { zf, nz } = F;
  if (zAboveBase <= zf[0]) return 0;
  for (let k = 0; k < nz; k++) if (zAboveBase < zf[k + 1]) return k;
  return nz - 1;
}

/* The wind at a point in the world, for anything that has to move through the field rather
   than be drawn on it. Coordinates are metres from the centre of the square: +x east,
   +y north, z absolute (metres above sea level, the same datum as the terrain).

   Bilinear across the columns, and each column read at its OWN level for that height — which
   is the point of the mesh. Nearest in the vertical is honest here because the levels are a
   metre apart where a thrown or falling thing spends its time; interpolating between a 1 m
   and a 2 m level would be false precision over a field this coarse sideways.

   The old version took one level index for all four corners, from the height above the
   lowest ground. Across a slope those four cells were at four different heights above their
   own ground, and some of them were inside the hill — which is why this function used to
   need an "all four underground" escape hatch. It has none now because there is nothing to
   be under. */
export function windAt(F, xE, yN, zAbs) {
  const { nx, ny, dx, dy, uid, vid, wid, u, v, w } = F;
  const px = xE / dx + nx / 2 - 0.5, py = ny / 2 - 0.5 - yN / dy;
  if (px < -0.5 || py < -0.5 || px > nx - 0.5 || py > ny - 0.5) return null;   // outside the square
  const i0 = Math.max(0, Math.min(nx - 1, Math.floor(px))), j0 = Math.max(0, Math.min(ny - 1, Math.floor(py)));
  const i1 = Math.min(nx - 1, i0 + 1), j1 = Math.min(ny - 1, j0 + 1);
  const fx = Math.max(0, Math.min(1, px - i0)), fy = Math.max(0, Math.min(1, py - j0));
  const at = (i, j) => {
    const k = levelAtColumn(F, i, j, zAbs);
    return [(u[uid(i, j, k)] + u[uid(i + 1, j, k)]) / 2,
            (v[vid(i, j, k)] + v[vid(i, j + 1, k)]) / 2,
            (w[wid(i, j, k)] + w[wid(i, j, k + 1)]) / 2];
  };
  const c = [at(i0, j0), at(i1, j0), at(i0, j1), at(i1, j1)];
  const wt = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
  const out = [0, 0, 0];
  for (let n = 0; n < 4; n++) for (let d = 0; d < 3; d++) out[d] += c[n][d] * wt[n];
  return out;
}

/* The wind a column carries below its first cell centre — the half metre of air between the
   grass and zc[0]. The mesh means this is now the only gap left: a summit's surface air is
   real cells carrying real flow, not the blocked cells that used to make a disc thrown from
   a ridge fly through dead air. Below the first centre the neutral log profile carries the
   value down, the same shape the solver started from. */
export function windColumn(F, xE, yN, zAbs) {
  const { nx, ny, dx, dy, ter, uid, vid, u, v, z0 } = F;
  const i = Math.max(0, Math.min(nx - 1, Math.floor(xE / dx + nx / 2)));
  const j = Math.max(0, Math.min(ny - 1, Math.floor(ny / 2 - yN / dy)));
  const cellAGL = Math.max(0.2, aglC(F, i, j, 0));
  const uu = (u[uid(i, j, 0)] + u[uid(i + 1, j, 0)]) / 2;
  const vv = (v[vid(i, j, 0)] + v[vid(i, j + 1, 0)]) / 2;
  const agl = Math.max(0.05, zAbs - ter[j * nx + i]);
  const f = Math.log(Math.max(agl, z0 * 1.2 + 0.1) / z0) / Math.log(Math.max(cellAGL, z0 * 1.2 + 0.1) / z0);
  return [uu * f, vv * f, 0];
}

/* What a thrown thing should feel: the solved field above the first level, the column's own
   log profile in the half metre below it. */
export function windForFlight(F, xE, yN, zAbs) {
  const { nx, ny, dx, dy, ter } = F;
  const i = Math.max(0, Math.min(nx - 1, Math.floor(xE / dx + nx / 2)));
  const j = Math.max(0, Math.min(ny - 1, Math.floor(ny / 2 - yN / dy)));
  if (zAbs - ter[j * nx + i] < aglC(F, i, j, 0)) return windColumn(F, xE, yN, zAbs);
  return windAt(F, xE, yN, zAbs) || windColumn(F, xE, yN, zAbs);
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
