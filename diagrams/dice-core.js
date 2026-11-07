/* Intransitive dice: the sets, and exact win counts by listing every pair of faces. Nothing here is sampled. */
export const EFRON = [
  { k: 'A', faces: [4, 4, 4, 4, 0, 0], c: 'var(--blue)' },
  { k: 'B', faces: [3, 3, 3, 3, 3, 3], c: 'var(--orange)' },
  { k: 'C', faces: [6, 6, 2, 2, 2, 2], c: 'var(--purple)' },
  { k: 'D', faces: [5, 5, 5, 1, 1, 1], c: 'var(--green)' }
];
export const GRIME = [
  { k: 'Red', faces: [4, 4, 4, 4, 4, 9], c: 'var(--red)' },
  { k: 'Blue', faces: [2, 2, 2, 7, 7, 7], c: 'var(--blue)' },
  { k: 'Olive', faces: [0, 5, 5, 5, 5, 5], c: '#7A8B2C' },
  { k: 'Yellow', faces: [3, 3, 3, 3, 8, 8], c: 'var(--gold)' },
  { k: 'Magenta', faces: [1, 1, 6, 6, 6, 6], c: '#C2309A' }
];
/* every total of k rolls of one die, each equally likely */
export function totals(faces, k) {
  let out = [0];
  for (let i = 0; i < k; i++) out = out.flatMap(s => faces.map(f => s + f));
  return out;
}
/* how many of the equally likely outcomes each side wins */
export function duel(a, b) {
  let w = 0, l = 0;
  for (const x of a) for (const y of b) { if (x > y) w++; else if (x < y) l++; }
  return { w, l, t: a.length * b.length - w - l, n: a.length * b.length };
}
const gcd = (a, b) => b ? gcd(b, a % b) : a;
export function frac(w, n) { const g = gcd(w, n) || 1; return (w / g) + '/' + (n / g); }
/* the die that beats a given one most often */
export function beater(set, i) {
  let best = -1, bp = 0;
  set.forEach((d, j) => { if (j === i) return; const r = duel(d.faces, set[i].faces), p = r.w / r.n; if (p > bp) { bp = p; best = j; } });
  return best;
}
/* chance of winning a match of n rolls (n odd, no ties possible) when each roll is won with probability p */
export function matchChance(p, n) {
  let s = 0, c = 1;
  for (let k = 0; k <= n; k++) { if (k > n / 2) s += c * Math.pow(p, k) * Math.pow(1 - p, n - k); c = c * (n - k) / (k + 1); }
  return s;
}
