/* Hydrograph synthesis: the pieces, in metric units. Time step dt in hours; rain and runoff depths in mm; flows in m³/s.
   A catchment of A km² that sheds 1 mm of runoff yields A·1000 m³, so q [m³/s] = (mm per hour) · A / 3.6. */
export function storm(P, D, dt, shape) {   // a design storm of total P mm over D hours: 'block' (uniform) or 'peak' (a triangle peaking a third of the way in)
  const n = Math.max(1, Math.round(D / dt)), out = new Array(n).fill(0);
  for (let i = 0; i < n; i++) { const t = (i + .5) / n; out[i] = shape === 'block' ? 1 : t < 1 / 3 ? t * 3 : (1 - t) * 1.5; }
  const s = out.reduce((a, b) => a + b, 0); return out.map(v => v / s * P);
}
/* SCS curve number: cumulative runoff Q = (P − 0.2S)² / (P + 0.8S) once P > 0.2S, S = 25400/CN − 254 mm. Applied to the running total, then differenced. */
export function cnLoss(rain, CN) { const S = 25400 / CN - 254, Ia = .2 * S; let P = 0, Qp = 0; return rain.map(r => { P += r; const Q = P > Ia ? (P - Ia) ** 2 / (P - Ia + S) : 0, q = Q - Qp; Qp = Q; return q; }); }
export function phiLoss(rain, phi, dt) { return rain.map(r => Math.max(0, r - phi * dt)); }
/* Nash cascade: n equal linear reservoirs with constant k hours; its unit response is a gamma curve. Stepped exactly per reservoir. */
export function nash(inflow, n, k, dt, steps) {
  const S = new Array(Math.round(n)).fill(0), out = [], a = Math.exp(-dt / k);
  for (let t = 0; t < steps; t++) { let x = (inflow[t] || 0) / dt;   // mm per hour into the first reservoir
    for (let j = 0; j < S.length; j++) { const s0 = S[j], sEq = x * k, s1 = sEq + (s0 - sEq) * a, o = x - (s1 - s0) / dt; S[j] = s1; x = o; }
    out.push(x * dt); }                                                                  // mm per step out of the last reservoir
  return out;
}
/* Muskingum routing on flows (any unit): K hours, weighting X, time step dt */
export function muskingum(I, K, X, dt) {
  const den = K - K * X + .5 * dt, c0 = (-K * X + .5 * dt) / den, c1 = (K * X + .5 * dt) / den, c2 = (K - K * X - .5 * dt) / den, O = [I[0] || 0];
  for (let t = 1; t < I.length; t++) O.push(c0 * I[t] + c1 * I[t - 1] + c2 * O[t - 1]);
  return O;
}
/* SCS dimensionless unit hydrograph, in the common gamma form q/qp = [(t/Tp)·e^(1 − t/Tp)]^m with m = 3.7; scaled here so its volume matches the runoff exactly */
export function scsUH(A, Tp, dt, steps) {
  const shape = [], m = 3.7; for (let t = 0; t < steps; t++) { const r = (t + .5) * dt / Tp; shape.push(Math.pow(r * Math.exp(1 - r), m)); }
  const vol = shape.reduce((a, b) => a + b, 0) * dt * 3600, unit = A * 1e3;   // 1 mm over A km² = A·1000 m³
  return shape.map(v => v * unit / vol);                                      // m³/s for 1 mm of runoff
}
export function convolve(x, h, steps) { const y = new Array(steps).fill(0); for (let i = 0; i < x.length; i++) if (x[i]) for (let j = 0; i + j < steps && j < h.length; j++) y[i + j] += x[i] * h[j]; return y; }
export const mmToQ = (mmPerStep, A, dt) => mmPerStep.map(v => v / dt * A / 3.6);
