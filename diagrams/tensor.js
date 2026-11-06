/* Small tensor math for the diagrams: a toy data set and CP by alternating least squares. No library, about the size of a napkin. */
import { rng, gauss } from './kit.js';

export const DIMS = [10, 12, 8]; // sites, months, years

/* Made-up streamflow: snowmelt in the high sites peaks in June, monsoon in the south peaks in August, a steady base everywhere. */
export function toyFlow() {
  const [I, J, K] = DIMS, R = rng(4242), X = new Float64Array(I * J * K);
  const bump = (m, c, w) => Math.exp(-((m - c) ** 2) / (2 * w * w));
  for (let i = 0; i < I; i++) for (let j = 0; j < J; j++) for (let k = 0; k < K; k++) {
    const snow = (i < 5 ? 1 - i * .12 : .08) * bump(j, 5, 1.2) * (1 + .6 * Math.sin(k * 1.7));
    const mons = (i >= 5 ? .35 + (i - 5) * .13 : .04) * bump(j, 7.3, .9) * (1 + .5 * Math.cos(k * 2.3));
    const base = (.1 + i * .012) * (1 + .05 * k);
    X[i + I * (j + J * k)] = snow + mons + base + .012 * gauss(R);
  }
  return X;
}

function solve(A, b) { // Gaussian elimination with partial pivoting; A is n x n, b is n x m, both row arrays
  const n = A.length, M = A.map((r, i) => [...r, ...b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-12;
    for (let r = 0; r < n; r++) if (r !== c) {
      const f = M[r][c] / d;
      if (f) for (let q = c; q < M[r].length; q++) M[r][q] -= f * M[c][q];
    }
  }
  return M.map((r, i) => r.slice(n).map(v => v / (M[i][i] || 1e-12)));
}

export function cpRebuild(F, dims = DIMS) {
  const [I, J, K] = dims, R = F[0][0].length, Y = new Float64Array(I * J * K);
  for (let k = 0; k < K; k++) for (let j = 0; j < J; j++) for (let i = 0; i < I; i++) {
    let s = 0;
    for (let r = 0; r < R; r++) s += F[0][i][r] * F[1][j][r] * F[2][k][r];
    Y[i + I * (j + J * k)] = s;
  }
  return Y;
}

/* One sweep updates each factor in turn. Each update is an ordinary least-squares problem. */
function sweep(X, F, dims) {
  const R = F[0][0].length, n = dims;
  for (let mode = 0; mode < 3; mode++) {
    const a = (mode + 1) % 3, b = (mode + 2) % 3;
    const G = Array.from({ length: R }, () => new Array(R).fill(0));
    for (let p = 0; p < R; p++) for (let q = 0; q < R; q++) {
      let sa = 0, sb = 0;
      for (const row of F[a]) sa += row[p] * row[q];
      for (const row of F[b]) sb += row[p] * row[q];
      G[p][q] = sa * sb + (p === q ? 1e-9 : 0);
    }
    const M = Array.from({ length: n[mode] }, () => new Array(R).fill(0));
    const idx = [0, 0, 0];
    for (idx[2] = 0; idx[2] < n[2]; idx[2]++) for (idx[1] = 0; idx[1] < n[1]; idx[1]++) for (idx[0] = 0; idx[0] < n[0]; idx[0]++) {
      const v = X[idx[0] + n[0] * (idx[1] + n[1] * idx[2])], ra = F[a][idx[a]], rb = F[b][idx[b]], out = M[idx[mode]];
      for (let r = 0; r < R; r++) out[r] += v * ra[r] * rb[r];
    }
    const Gt = G, sol = solve(Gt, Array.from({ length: R }, (_, r) => M.map(row => row[r])));
    for (let i = 0; i < n[mode]; i++) for (let r = 0; r < R; r++) F[mode][i][r] = sol[r][i];
  }
}

function start(R, dims, seed) {
  const r = rng(seed);
  return dims.map(n => Array.from({ length: n }, () => Array.from({ length: R }, () => r() + .05)));
}

export function cpALS(X, R, sweeps = 60, seed = 7, dims = DIMS) {
  const F = start(R, dims, seed);
  for (let s = 0; s < sweeps; s++) sweep(X, F, dims);
  return F;
}

/* Fill holes: guess, fit, replace the guesses with the fit, repeat. mask[k] true means the value was seen. */
export function cpFill(X, mask, R, rounds = 45, seed = 7, dims = DIMS) {
  let seen = 0, n = 0;
  for (let k = 0; k < X.length; k++) if (mask[k]) { seen += X[k]; n++; }
  const mean = seen / Math.max(1, n), Y = X.slice();
  for (let k = 0; k < X.length; k++) if (!mask[k]) Y[k] = mean;
  const F = start(R, dims, seed);
  let fit = Y;
  for (let s = 0; s < rounds; s++) {
    sweep(Y, F, dims);
    fit = cpRebuild(F, dims);
    for (let k = 0; k < X.length; k++) if (!mask[k]) Y[k] = fit[k];
  }
  return { fit, mean };
}

export function explained(X, Y) {
  let m = 0, ss = 0, se = 0;
  for (const v of X) m += v;
  m /= X.length;
  for (let k = 0; k < X.length; k++) { ss += (X[k] - m) ** 2; se += (X[k] - Y[k]) ** 2; }
  return 1 - se / ss;
}
