/* The two-half delivery problem, computed exactly. Shared by this page's diagrams and its puzzle.

   A cell needs BOTH halves of a split editor present at the same time to have a working machine.
   Once it does, each of the cell's two gene copies independently ends up corrected, scarred
   (permanent, never correctable) or still raw. Halves decay, so keeping a machine alive costs
   more dose, and dose costs the cell's survival. Nothing here is measured: see the page. */

export const P = {
  ok: .25,        // a raw copy is corrected in one window
  scar: .08,      // a raw copy is permanently scarred in one window
  wA: 1,          // vehicles carrying half A deliver at this weight
  wB: .35,        // half B is the bigger piece, so it packages worse
  eta: .75,       // each later round's vehicles are cleared harder
  keep: .45,      // a half already held survives to the next round
  kappa: 20,      // surviving cells = exp(-total dose / kappa)
  rounds: 6,      // you may dose at most this many times
  dose: 14,       // and at most this much in one round
  best: .073211   // the best schedule found offline, as a fraction of treated cells
};
/* the schedule that reaches it: [dose, share of that dose given to half A] */
export const BEST = [[6.61, .349], [5.21, .384], [4.38, .451]];

/* a cell's two copies, order forgotten: R raw, C correct, S scarred */
export const MS = ['RR', 'RC', 'RS', 'CC', 'CS', 'SS'];
const MSI = {}; MS.forEach((m, i) => MSI[m] = i);
const CC = MSI.CC;
const order = c => 'RCS'.indexOf(c);
const norm = (a, b) => order(a) <= order(b) ? a + b : b + a;

/* one editing window, as a list of [next multiset, probability] */
const WIN = MS.map(m => {
  const raw = 1 - P.ok - P.scar;
  const per = c => c === 'R' ? [['C', P.ok], ['S', P.scar], ['R', raw]] : [[c, 1]];
  const out = new Map();
  for (const [u, pu] of per(m[0])) for (const [v, pv] of per(m[1])) {
    const k = MSI[norm(u, v)];
    out.set(k, (out.get(k) || 0) + pu * pv);
  }
  return [...out];
});

export const idx = (a, b, mi) => (a * 2 + b) * 6 + mi;
const NS = 24;

export function start() { const v = new Float64Array(NS); v[idx(0, 0, MSI.RR)] = 1; return v; }

/* one round: vehicles arrive, then a machine (if complete) acts once, then held halves decay */
export function step(v, dose, f, k) {
  const eff = dose * Math.pow(P.eta, k);
  const pa = 1 - Math.exp(-f * eff * P.wA), pb = 1 - Math.exp(-(1 - f) * eff * P.wB);
  const w = new Float64Array(NS);
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let mi = 0; mi < 6; mi++) {
    const p = v[idx(a, b, mi)];
    if (p <= 0) continue;
    const gotA = a ? [[1, 1]] : [[1, pa], [0, 1 - pa]];
    const gotB = b ? [[1, 1]] : [[1, pb], [0, 1 - pb]];
    for (const [a2, qa] of gotA) for (const [b2, qb] of gotB) {
      const flow = p * qa * qb;
      if (flow <= 0) continue;
      const outs = (a2 && b2) ? WIN[mi] : [[mi, 1]];
      for (const [m2, pm] of outs) {
        const base = flow * pm;
        const keepA = a2 ? [[1, P.keep], [0, 1 - P.keep]] : [[0, 1]];
        const keepB = b2 ? [[1, P.keep], [0, 1 - P.keep]] : [[0, 1]];
        for (const [a3, ra] of keepA) for (const [b3, rb] of keepB) w[idx(a3, b3, m2)] += base * ra * rb;
      }
    }
  }
  return w;
}

/* sum over the four holding states, so a fate counts however the cell ended up holding halves */
export function fate(v, m) {
  let s = 0;
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) s += v[idx(a, b, MSI[m])];
  return s;
}
export function holdsBoth(v) { let s = 0; for (let mi = 0; mi < 6; mi++) s += v[idx(1, 1, mi)]; return s; }

/* sched: [[dose, share to A], ...]. Returns the score and what it is made of.
   Every step happens whether or not you dose at it: time passes either way, so a machine
   already in the cell works again and held halves decay again. Skipping the empty steps
   instead would let a dose of a thousandth buy a whole free editing window. */
export function run(sched) {
  let v = start(), total = 0;
  const trace = [];
  for (let k = 0; k < P.rounds; k++) {
    const [d, f] = sched[k] || [0, .5];
    const dose = d > 0 ? d : 0;
    total += dose;
    v = step(v, dose, dose > 0 ? f : .5, k);
    trace.push({ step: k + 1, both: holdsBoth(v), done: fate(v, 'CC') });
  }
  const done = fate(v, 'CC'), surv = Math.exp(-total / P.kappa);
  return { score: surv * done, done, surv, total, v, trace };
}

/* coordinate ascent. Deterministic, and quick enough to run on a phone. */
export function solve(sched) {
  let cur = sched.map(r => r.slice()), best = run(cur).score;
  for (let sd = 1, sf = .16; sd > 1e-4; sd /= 2, sf /= 2) {
    for (let pass = 0; pass < 60; pass++) {
      let moved = false;
      for (let i = 0; i < cur.length; i++) for (let j = 0; j < 2; j++) {
        for (const s of [j ? sf : sd, -(j ? sf : sd)]) {
          const t = cur.map(r => r.slice());
          t[i][j] += s;
          if (t[i][0] < 0 || t[i][0] > P.dose) continue;
          if (j === 1 && (t[i][1] < .01 || t[i][1] > .99)) continue;
          const y = run(t).score;
          if (y > best + 1e-15) { best = y; cur = t; moved = true; }
        }
      }
      if (!moved) break;
    }
  }
  return { sched: cur, score: best };
}

/* the per-copy ceiling: a copy that keeps getting worked on ends correct this often */
export const RATIO = P.ok / (P.ok + P.scar);

/* the two copies after n editing windows, if the machine simply stays present.
   This is the best delivery could ever do, so it bounds every schedule. */
export function windowsOnly(n) {
  let d = new Float64Array(6);
  d[MSI.RR] = 1;
  for (let t = 0; t < n; t++) {
    const w = new Float64Array(6);
    for (let mi = 0; mi < 6; mi++) {
      const p = d[mi];
      if (p > 0) for (const [m2, pm] of WIN[mi]) w[m2] += p * pm;
    }
    d = w;
  }
  return { dist: d, done: d[CC], at: (m) => d[MSI[m]] };
}
