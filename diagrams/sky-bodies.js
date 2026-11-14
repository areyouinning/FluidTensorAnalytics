/* Where the sun, the moon and the planets actually are, from your own ground.

   The sky view already knows how to draw anything you can give an azimuth and an elevation
   to — that is how the summits are placed. So this file's whole job is to turn a time and a
   place into those two numbers, honestly, for things that move.

   Nothing here is a model of the sky as decoration. The moon's phase is computed from the
   real geometry of sun, earth and moon, which is why it comes with the angle of its bright
   limb: a crescent over Colorado in the evening is lit from below and to the right, and a
   drawing that puts the horns the other way is wrong in a way people notice without being
   able to say why.

   Accuracy, stated plainly, since a page about the wind has no business pretending to be an
   ephemeris. Sun: about 0.01 degrees. Moon: a few arcminutes, from the abridged lunar series
   in Meeus chapter 47 — the full theory has hundreds more terms. Planets: a few arcminutes
   for the inner ones and up to about a tenth of a degree for Saturn, from JPL's own
   low-precision Keplerian elements, which are fitted for 1800-2050 and should not be used
   outside it. Stars: catalogue positions precessed to date, so sub-arcminute.

   Every one of those is far below the error in a phone compass, which is the real limit on
   anything drawn over a camera. */

import { STARS, LINES } from './sky-stars.js';
export { STARS, LINES };

const D = Math.PI / 180;
const sin = a => Math.sin(a * D), cos = a => Math.cos(a * D), tan = a => Math.tan(a * D);
const norm = a => ((a % 360) + 360) % 360;

/* ---------- time ----------
   Julian Day from a JavaScript Date, which is already UTC underneath. */
export function julianDay(date = new Date()) {
  return date.getTime() / 86400000 + 2440587.5;
}
export const centuries = jd => (jd - 2451545.0) / 36525;

/* Greenwich mean sidereal time in degrees (Meeus 12.4). This is the number that turns a
   fixed star's right ascension into a direction you can point at: the sky's own clock. */
export function gmst(jd) {
  const T = centuries(jd);
  return norm(280.46061837 + 360.98564736629 * (jd - 2451545.0)
    + 0.000387933 * T * T - T * T * T / 38710000);
}

/* obliquity of the ecliptic, degrees (Meeus 22.2) */
function obliquity(T) {
  return 23.4392911 - (46.8150 * T + 0.00059 * T * T - 0.001813 * T * T * T) / 3600;
}

/* ecliptic longitude/latitude to right ascension/declination, all degrees */
function eclToEq(lam, bet, eps) {
  const ra = Math.atan2(sin(lam) * cos(eps) - tan(bet) * sin(eps), cos(lam)) / D;
  const dec = Math.asin(sin(bet) * cos(eps) + cos(bet) * sin(eps) * sin(lam)) / D;
  return { ra: norm(ra), dec };
}

/* ---------- the sun (Meeus 25) ---------- */
export function sunPosition(jd) {
  const T = centuries(jd);
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sin(M)
    + (0.019993 - 0.000101 * T) * sin(2 * M)
    + 0.000289 * sin(3 * M);
  const trueLon = L0 + C, nu = M + C;
  const R = 1.000001018 * (1 - e * e) / (1 + e * cos(nu));        // AU
  /* the apparent longitude: the sun seen from a moving earth, nodded by nutation */
  const Om = 125.04 - 1934.136 * T;
  const lam = trueLon - 0.00569 - 0.00478 * sin(Om);
  const eps = obliquity(T) + 0.00256 * cos(Om);
  const q = eclToEq(lam, 0, eps);
  return { ra: q.ra, dec: q.dec, lam: norm(lam), R, distKm: R * 149597870.7 };
}

/* ---------- the moon (Meeus 47, abridged) ----------
   The periodic terms below are the largest of the lunar series. Each row is
   (D, M, M', F, coefficient), where the four arguments are elongation, the sun's mean
   anomaly, the moon's mean anomaly and argument of latitude. Terms carrying M are scaled by
   E, the earth's slowly changing orbital eccentricity, because the sun's pull on the moon
   depends on it. */
const TL = [
  [0, 0, 1, 0, 6288774, -20905355], [2, 0, -1, 0, 1274027, -3699111], [2, 0, 0, 0, 658314, -2955968],
  [0, 0, 2, 0, 213618, -569925], [0, 1, 0, 0, -185116, 48888], [0, 0, 0, 2, -114332, -3149],
  [2, 0, -2, 0, 58793, 246158], [2, -1, -1, 0, 57066, -152138], [2, 0, 1, 0, 53322, -170733],
  [2, -1, 0, 0, 45758, -204586], [0, 1, -1, 0, -40923, -129620], [1, 0, 0, 0, -34720, 108743],
  [0, 1, 1, 0, -30383, 104755], [2, 0, 0, -2, 15327, 10321], [0, 0, 1, 2, -12528, 0],
  [0, 0, 1, -2, 10980, 79661], [4, 0, -1, 0, 10675, -34782], [0, 0, 3, 0, 10034, -23210],
  [4, 0, -2, 0, 8548, -21636], [2, 1, -1, 0, -7888, 24208], [2, 1, 0, 0, -6766, 30824],
  [1, 0, -1, 0, -5163, -8379], [1, 1, 0, 0, 4987, -16675], [2, -1, 1, 0, 4036, -12831],
  [2, 0, 2, 0, 3994, -10445], [4, 0, 0, 0, 3861, -11650], [2, 0, -3, 0, 3665, 14403],
  [0, 1, -2, 0, -2689, -7003], [2, 0, -1, 2, -2602, 0], [2, -1, -2, 0, 2390, 10056],
  [1, 0, 1, 0, -2348, 6322], [2, -2, 0, 0, 2236, -9884], [0, 1, 2, 0, -2120, 5751],
  [0, 2, 0, 0, -2069, 0], [2, -2, -1, 0, 2048, -4950], [2, 0, 1, -2, -1773, 4130],
  [2, 0, 0, 2, -1595, 0], [4, -1, -1, 0, 1215, -3958], [0, 0, 2, 2, -1110, 0],
  [3, 0, -1, 0, -892, 3258], [2, 1, 1, 0, -810, 2616], [4, -1, -2, 0, 759, -1897],
  [0, 2, -1, 0, -713, -2117], [2, 2, -1, 0, -700, 2354], [2, 1, -2, 0, 691, 0],
  [2, -1, 0, -2, 596, 0], [4, 0, 1, 0, 549, -1423], [0, 0, 4, 0, 537, -1117],
  [4, -1, 0, 0, 520, -1571], [1, 0, -2, 0, -487, -1739], [2, 1, 0, -2, -399, 0],
  [0, 0, 2, -2, -381, -4421], [1, 1, 1, 0, 351, 0], [3, 0, -2, 0, -340, 0],
  [4, 0, -3, 0, 330, 0], [2, -1, 2, 0, 327, 0], [0, 2, 1, 0, -323, 1165],
  [1, 1, -1, 0, 299, 0], [2, 0, 3, 0, 294, 0], [2, 0, -1, -2, 0, 8752]
];
const TB = [
  [0, 0, 0, 1, 5128122], [0, 0, 1, 1, 280602], [0, 0, 1, -1, 277693], [2, 0, 0, -1, 173237],
  [2, 0, -1, 1, 55413], [2, 0, -1, -1, 46271], [2, 0, 0, 1, 32573], [0, 0, 2, 1, 17198],
  [2, 0, 1, -1, 9266], [0, 0, 2, -1, 8822], [2, -1, 0, -1, 8216], [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200], [2, 1, 0, -1, -3359], [2, -1, -1, 1, 2463], [2, -1, 0, 1, 2211],
  [2, -1, -1, -1, 2065], [0, 1, -1, -1, -1870], [4, 0, -1, -1, 1828], [0, 1, 0, 1, -1794],
  [0, 0, 0, 3, -1749], [0, 1, -1, 1, -1565], [1, 0, 0, 1, -1491], [0, 1, 1, 1, -1475],
  [0, 1, 1, -1, -1410], [0, 1, 0, -1, -1344], [1, 0, 0, -1, -1335], [0, 0, 3, 1, 1107],
  [4, 0, 0, -1, 1021], [4, 0, -1, 1, 833], [0, 0, 1, -3, 777], [4, 0, -2, 1, 671],
  [2, 0, 0, -3, 607], [2, 0, 2, -1, 596], [2, -1, 1, -1, 491], [2, 0, -2, 1, -451],
  [0, 0, 3, -1, 439], [2, 0, 2, 1, 422], [2, 0, -3, -1, 421], [2, 1, -1, 1, -366],
  [2, 1, 0, 1, -351], [4, 0, 0, 1, 331], [2, -1, 1, 1, 315], [2, -2, 0, -1, 302],
  [0, 0, 1, 3, -283], [2, 1, 1, -1, -229], [1, 1, 0, -1, 223], [1, 1, 0, 1, 223],
  [0, 1, -2, -1, -220], [2, 1, -1, -1, -220], [1, 0, 1, 1, -185], [2, -1, -2, -1, 181],
  [0, 1, 2, 1, -177], [4, 0, -2, -1, 176], [4, -1, -1, -1, 166], [1, 0, 1, -1, -164],
  [4, 0, 1, -1, 132], [1, 0, -1, -1, -119], [4, -1, 0, -1, 115], [2, -2, 0, 1, 107]
];

export function moonPosition(jd) {
  const T = centuries(jd);
  const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T + T ** 3 / 538841 - T ** 4 / 65194000;
  const Dm = 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T + T ** 3 / 545868 - T ** 4 / 113065000;
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T + T ** 3 / 24490000;
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T + T ** 3 / 69699 - T ** 4 / 14712000;
  const F = 93.2720950 + 483202.0175233 * T - 0.0036539 * T * T - T ** 3 / 3526000 + T ** 4 / 863310000;
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;

  let sl = 0, sr = 0, sb = 0;
  for (const [d, m, mp, f, cl, cr] of TL) {
    const arg = d * Dm + m * M + mp * Mp + f * F;
    const w = m === 0 ? 1 : (Math.abs(m) === 1 ? E : E * E);
    sl += cl * w * sin(arg);
    sr += cr * w * cos(arg);
  }
  for (const [d, m, mp, f, cb] of TB) {
    const arg = d * Dm + m * M + mp * Mp + f * F;
    const w = m === 0 ? 1 : (Math.abs(m) === 1 ? E : E * E);
    sb += cb * w * sin(arg);
  }
  /* the additive terms: Venus, Jupiter and the flattening of the earth, lumped */
  const A1 = 119.75 + 131.849 * T, A2 = 53.09 + 479264.290 * T, A3 = 313.45 + 481266.484 * T;
  sl += 3958 * sin(A1) + 1962 * sin(Lp - F) + 318 * sin(A2);
  sb += -2235 * sin(Lp) + 382 * sin(A3) + 175 * sin(A1 - F) + 175 * sin(A1 + F)
    + 127 * sin(Lp - Mp) - 115 * sin(Lp + Mp);

  const lam = norm(Lp + sl / 1e6);
  const bet = sb / 1e6;
  const distKm = 385000.56 + sr / 1000;
  const eps = obliquity(T);
  const q = eclToEq(lam, bet, eps);
  /* apparent angular radius, which is what decides how big to draw it: the moon really does
     look bigger at perigee, by about a seventh */
  const radiusDeg = Math.asin(1737.4 / distKm) / D;
  return { ra: q.ra, dec: q.dec, lam, bet, distKm, radiusDeg };
}

/* ---------- the moon's phase ----------
   The lit fraction comes from the phase angle at the moon — the sun-moon-earth angle — not
   from counting days since a new moon, which drifts. The position angle of the bright limb
   says which way the horns point, measured from celestial north through east. */
export function moonPhase(sun, moon) {
  const dRa = sun.ra - moon.ra;
  const cosPsi = sin(sun.dec) * sin(moon.dec) + cos(sun.dec) * cos(moon.dec) * cos(dRa);
  const psi = Math.acos(Math.max(-1, Math.min(1, cosPsi))) / D;      // elongation
  const i = Math.atan2(sun.distKm * sin(psi), moon.distKm - sun.distKm * cos(psi)) / D;
  const illum = (1 + cos(i)) / 2;
  const chi = norm(Math.atan2(cos(sun.dec) * sin(dRa),
    sin(sun.dec) * cos(moon.dec) - cos(sun.dec) * sin(moon.dec) * cos(dRa)) / D);
  /* waxing when the moon is east of the sun in longitude */
  const waxing = norm(moon.lam - sun.lam) < 180;
  return { elongation: psi, phaseAngle: i, illum, limbPA: chi, waxing, name: phaseName(illum, waxing) };
}
function phaseName(illum, waxing) {
  if (illum < 0.02) return 'new';
  if (illum > 0.98) return 'full';
  const q = Math.abs(illum - 0.5) < 0.06;
  if (q) return waxing ? 'first quarter' : 'last quarter';
  if (illum < 0.5) return waxing ? 'waxing crescent' : 'waning crescent';
  return waxing ? 'waxing gibbous' : 'waning gibbous';
}

/* ---------- the planets ----------
   JPL's low-precision Keplerian elements: six elements and six rates per planet, fitted for
   1800-2050. Each row is [a, e, I, L, longPeri, longNode] then the same per century. */
const PLANETS = [
  ['Mercury', [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593],
    [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081], -0.42],
  ['Venus', [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255],
    [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418], -4.40],
  ['Mars', [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343], -1.52],
  ['Jupiter', [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
    [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106], -9.40],
  ['Saturn', [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
    [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794], -8.88]
];
const EARTH = [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0],
  [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0]];

/* heliocentric position in the J2000 ecliptic frame, in AU */
function helio(el, rate, T) {
  const a = el[0] + rate[0] * T, e = el[1] + rate[1] * T, I = el[2] + rate[2] * T;
  const L = el[3] + rate[3] * T, wbar = el[4] + rate[4] * T, Om = el[5] + rate[5] * T;
  const w = wbar - Om;
  let M = norm(L - wbar); if (M > 180) M -= 360;
  /* Kepler's equation, Newton: a handful of passes is plenty at these eccentricities */
  const eStar = e * 180 / Math.PI;
  let E = M + eStar * sin(M);
  for (let k = 0; k < 8; k++) {
    const dM = M - (E - eStar * sin(E));
    E += dM / (1 - e * cos(E));
  }
  const xp = a * (cos(E) - e), yp = a * Math.sqrt(1 - e * e) * sin(E);
  /* rotate: argument of perihelion, inclination, then the node */
  const x = (cos(w) * cos(Om) - sin(w) * sin(Om) * cos(I)) * xp
    + (-sin(w) * cos(Om) - cos(w) * sin(Om) * cos(I)) * yp;
  const y = (cos(w) * sin(Om) + sin(w) * cos(Om) * cos(I)) * xp
    + (-sin(w) * sin(Om) + cos(w) * cos(Om) * cos(I)) * yp;
  const z = sin(w) * sin(I) * xp + cos(w) * sin(I) * yp;
  return [x, y, z];
}

export function planetPositions(jd) {
  const T = centuries(jd);
  const eps = obliquity(T);
  const E = helio(EARTH[0], EARTH[1], T);
  const out = [];
  for (const [name, el, rate, H] of PLANETS) {
    const P = helio(el, rate, T);
    const g = [P[0] - E[0], P[1] - E[1], P[2] - E[2]];
    const delta = Math.hypot(g[0], g[1], g[2]);                    // earth to planet, AU
    const r = Math.hypot(P[0], P[1], P[2]);                        // sun to planet, AU
    const lam = norm(Math.atan2(g[1], g[0]) / D);
    const bet = Math.asin(g[2] / delta) / D;
    const q = eclToEq(lam, bet, eps);
    /* phase angle at the planet, then the standard magnitude law for each */
    const rE = Math.hypot(E[0], E[1], E[2]);
    const cosA = (r * r + delta * delta - rE * rE) / (2 * r * delta);
    const alpha = Math.acos(Math.max(-1, Math.min(1, cosA))) / D;
    /* JPL's elements are in the J2000 frame, so this position is for the J2000 equinox and
       has to be carried forward like a catalogue star. Skipping it leaves every planet about
       0.36 degrees adrift in right ascension by 2026 — a systematic error, identical for all
       five, which is exactly what made it visible against Horizons: the sun (worked out in
       the ecliptic of date) matched to a thousandth of a degree while every planet was off
       by the same amount in the same direction. */
    const pr = precess(q.ra, q.dec, T);
    q.ra = pr.ra; q.dec = pr.dec;
    const base = H + 5 * Math.log10(r * delta);
    let mag = base;
    if (name === 'Mercury') mag = base + 0.0380 * alpha - 0.000273 * alpha ** 2 + 0.000002 * alpha ** 3;
    else if (name === 'Venus') mag = base + 0.0009 * alpha + 0.000239 * alpha ** 2 - 0.00000065 * alpha ** 3;
    else if (name === 'Mars') mag = base + 0.016 * alpha;
    else if (name === 'Jupiter') mag = base + 0.005 * alpha;
    /* Saturn's rings swing its brightness by about a magnitude over fifteen years and are
       not modelled here, so its number is the ringless one and can be a magnitude dim */
    out.push({ name, ra: q.ra, dec: q.dec, mag, distAU: delta, rAU: r, phaseAngle: alpha });
  }
  return out;
}

/* ---------- precession (Meeus 21) ----------
   Catalogue positions are for J2000. The sky has turned since: about 0.36 degrees by 2026,
   which is most of a moon's width and plainly visible if you skip it. */
export function precess(ra0, dec0, T) {
  const z1 = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T ** 3) / 3600;
  const z2 = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T ** 3) / 3600;
  const th = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T ** 3) / 3600;
  const A = cos(dec0) * sin(ra0 + z1);
  const B = cos(th) * cos(dec0) * cos(ra0 + z1) - sin(th) * sin(dec0);
  const C = sin(th) * cos(dec0) * cos(ra0 + z1) + cos(th) * sin(dec0);
  return { ra: norm(Math.atan2(A, B) / D + z2), dec: Math.asin(Math.max(-1, Math.min(1, C))) / D };
}

/* ---------- from the centre of the earth to where you are standing ----------
   Everything above is geocentric: computed as if you were at the centre of the earth. For
   anything far away that is the same answer, but the moon is only sixty earth radii off, so
   standing on the surface moves it by up to a degree — twice its own width. Checked against
   JPL Horizons this is the single largest error in the file if you skip it: the moon came
   out 0.99 degrees too high.

   Meeus chapter 40. The flattening of the earth matters here too, which is why the latitude
   is squashed before use rather than taken as it comes. */
export function topocentric(ra, dec, distKm, lat, lon, jd, elevM = 0) {
  const sinPi = 6378.14 / distKm;                      // horizontal parallax
  const u = Math.atan(0.99664719 * tan(lat));
  const rhoSin = 0.99664719 * Math.sin(u) + (elevM / 6378140) * sin(lat);
  const rhoCos = Math.cos(u) + (elevM / 6378140) * cos(lat);
  const H = norm(gmst(jd) + lon - ra);
  const dRa = Math.atan2(-rhoCos * sinPi * sin(H), cos(dec) - rhoCos * sinPi * cos(H)) / D;
  const raT = norm(ra + dRa);
  const decT = Math.atan2((sin(dec) - rhoSin * sinPi) * cos(dRa),
    cos(dec) - rhoCos * sinPi * cos(H)) / D;
  return { ra: raT, dec: decT, shift: Math.hypot(dRa * cos(dec), decT - dec) };
}

/* ---------- where to point ----------
   Right ascension and declination to azimuth (from north, through east) and elevation. */
export function eqToAltAz(ra, dec, lat, lon, jd) {
  const H = norm(gmst(jd) + lon - ra);
  const alt = Math.asin(sin(lat) * sin(dec) + cos(lat) * cos(dec) * cos(H)) / D;
  const az = norm(Math.atan2(-cos(dec) * sin(H),
    sin(dec) * cos(lat) - cos(dec) * sin(lat) * cos(H)) / D);
  return { alt, az, hourAngle: H };
}

/* Atmospheric refraction (Bennett), in degrees. Air lifts everything near the horizon: the
   sun is already geometrically below it when you watch it set, by more than its own width.
   Below about two degrees down there is nothing to lift, so it is left alone. */
export function refract(alt) {
  if (alt < -2) return alt;
  return alt + (1 / tan(alt + 7.31 / (alt + 4.4))) / 60;
}

/* ---------- everything at once ----------
   lat/lon in degrees, east positive. Returns only what is above the given horizon, already
   refracted, with the stars precessed to date. */
export function skyAt(lat, lon, date = new Date(), opt = {}) {
  const jd = julianDay(date), T = centuries(jd);
  const magLimit = opt.magLimit ?? 5.0;
  const elevM = opt.elevM ?? 0;

  const sun = sunPosition(jd);
  const moon = moonPosition(jd);
  /* the phase is geometry between three centres, so it uses the geocentric moon */
  const phase = moonPhase(sun, moon);
  /* everything else is seen from a spot on the surface. For the sun and the planets the
     shift is seconds of arc; for the moon it is most of a degree. */
  const place = (b, distKm) => {
    const t = distKm ? topocentric(b.ra, b.dec, distKm, lat, lon, jd, elevM) : b;
    const p = eqToAltAz(t.ra, t.dec, lat, lon, jd);
    return { ra: t.ra, dec: t.dec, az: p.az, alt: refract(p.alt), rawAlt: p.alt };
  };

  const sunAt = place(sun, sun.distKm), moonAt = place(moon, moon.distKm);
  /* How dark it is, which decides whether any of this is worth drawing over a camera.
     The usual twilight steps: the sun's centre at -6 is civil, -12 nautical, -18 astronomical. */
  const s = sunAt.rawAlt;
  const twilight = s > -0.833 ? 'day' : s > -6 ? 'civil' : s > -12 ? 'nautical' : s > -18 ? 'astronomical' : 'night';

  const planets = planetPositions(jd).map(p =>
    Object.assign({}, p, place(p, p.distAU * 149597870.7), { kind: 'planet' }));

  const stars = [];
  for (let i = 0; i < STARS.length; i++) {
    const st = STARS[i];
    if (st.mag > magLimit) continue;
    const p = precess(st.ra * 15, st.dec, T);
    const at = eqToAltAz(p.ra, p.dec, lat, lon, jd);
    stars.push({ i, name: st.name, mag: st.mag, az: at.az, alt: refract(at.alt), rawAlt: at.alt });
  }

  return {
    jd, date, twilight,
    sun: Object.assign({ kind: 'sun', name: 'Sun', mag: -26.7 }, sun, sunAt),
    moon: Object.assign({ kind: 'moon', name: 'Moon', mag: -12.7 }, moon, moonAt, { phase }),
    planets, stars,
    /* line segments as index pairs into `stars` order is NOT the same as STARS order, so
       lines are given against STARS and resolved by the drawing code through `i` */
    lines: LINES
  };
}
