/* The local wind twin: fetch the ground under you, fetch the forecast over you, make the two
   agree, then draw the result the way nullschool draws wind — particles carried by the field,
   leaving fading trails, coloured by speed. The physics lives in diagrams/windcore.js. */
import { fetchDEM, buildField, project, surfaceSlice, sampleBilinear, syntheticHill, logSpeed } from './diagrams/windcore.js';
import { mountSky, compass, fmtH } from './wind-sky.js';
import { windForFlight, groundAt, lon2x, lat2y, mPerDegLat, mPerDegLon } from './diagrams/windcore.js';
import { fly } from './diagrams/discflight.js';

/* Pressure levels are reported wherever they fall, which over high ground is often BELOW it:
   at 1641 m in Westminster the 1000 and 925 hPa levels come back at 142 m and 810 m above sea
   level. Those are extrapolated fictions, not air you are standing under, so they are dropped. */
const LEVELS = [1000, 925, 850, 700, 500];

const $ = id => document.getElementById(id);
const S = {
  lat: 39.8366, lon: -105.0372, place: 'Westminster, Colorado',
  hours: null, hour: 0, dem: null, F: null, slice: null,
  R: 1, z0: 0.2, zAGL: 10, span: 12000, busy: false, anim: 0,
  bearing: 90, speed: 25, angle: 12, stability: 0, shots: null
};
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* ---------- data ---------- */
/* ---------- keeping the forecast on its feet ----------

   earth.nullschool.net never has this problem, and it is worth saying why: every request its
   page makes goes to its own origin. It pulls GFS from NOAA on a schedule, converts it, and
   serves its own files, so an upstream outage only makes its data stale. That needs a server
   and a scheduled job, and this site is static pages with neither.

   What a static page can do is the same idea twice over: ask somebody else when the first
   service is down, and remember the last answer that worked. Open-Meteo went dark for several
   hours on 12 November 2026 and the page simply failed; with these two it would have carried
   on, first on the National Weather Service and then on yesterday's numbers, saying so.

   The fallbacks are not equals. NWS is US-only and carries no winds aloft, so the sky view
   loses its upper layers on that path. A cached forecast is yesterday's weather. Both are
   labelled on the page rather than passed off as live.

   AND A TIMEOUT ON EVERY ONE OF THEM, which is the part this got wrong the first time.
   A fallback chain written as try/catch only moves on when a request FAILS. Open-Meteo went
   down a second time on 13 November and did not fail: it accepted the connection and then
   said nothing. `fetch` has no timeout of its own, so the promise never settled, the catch
   never ran, the National Weather Service was never asked, and the page sat on "Fetching the
   forecast…" indefinitely. A service that is slow rather than dead is the ordinary way
   things break, so every call below is raced against a clock and a stall is an error. */

const CACHE_KEY = 'fta-wind-last';

/* fetch, but it gives up. A hung request is a failure and has to be raised as one. */
async function fetchIn(url, ms = 9000, opts) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, Object.assign({ signal: ac.signal }, opts));
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('no answer in ' + (ms / 1000) + 's');
    throw e;
  } finally { clearTimeout(t); }
}

function cacheSave(lat, lon, h) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      lat, lon, savedAt: Date.now(),
      hours: { time: h.time, spd: h.spd, dir: h.dir, elev: h.elev, tz: h.tz, raw: h.raw }
    }));
  } catch (e) { /* storage is a convenience here, never a requirement */ }
}
function cacheLoad(lat, lon) {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    /* only reuse it for roughly the same place: a forecast for another valley is not a
       fallback, it is a wrong answer wearing the right label */
    if (Math.abs(c.lat - lat) > 0.4 || Math.abs(c.lon - lon) > 0.4) return null;
    const age = (Date.now() - c.savedAt) / 3600e3;
    return Object.assign({}, c.hours, { source: 'saved', ageHours: age });
  } catch (e) { return null; }
}

/* NWS gives its grid as intervals with ISO durations, not an hourly list. Expand them. */
function expandNWS(values, stamps) {
  const out = new Array(stamps.length).fill(null);
  for (const v of values || []) {
    const bits = String(v.validTime).split('/');
    const start = Date.parse(bits[0]);
    const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(bits[1] || '');
    if (!m || !isFinite(start)) continue;
    const hrs = (+(m[1] || 0)) * 24 + (+(m[2] || 0)) + (+(m[3] || 0)) / 60;
    const end = start + hrs * 3600e3;
    for (let i = 0; i < stamps.length; i++) if (stamps[i] >= start && stamps[i] < end) out[i] = v.value;
  }
  return out;
}

async function weatherNWS(lat, lon) {
  const pt = await fetchIn(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, 9000);
  if (!pt.ok) throw new Error('NWS points ' + pt.status);
  const grid = (await pt.json()).properties.forecastGridData;
  const gr = await fetchIn(grid, 12000);
  if (!gr.ok) throw new Error('NWS grid ' + gr.status);
  const P = (await gr.json()).properties;

  const t0 = new Date();
  t0.setMinutes(0, 0, 0);
  const stamps = [], time = [];
  for (let i = 0; i < 72; i++) {
    const d = new Date(t0.getTime() + i * 3600e3);
    stamps.push(d.getTime());
    const p = n => String(n).padStart(2, '0');
    time.push(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`);
  }
  const kmh = P.windSpeed && /km_h/.test(P.windSpeed.uom || '');
  const spd = expandNWS(P.windSpeed && P.windSpeed.values, stamps).map(v => v == null ? null : (kmh ? v / 3.6 : v));
  const dir = expandNWS(P.windDirection && P.windDirection.values, stamps);
  if (!spd.some(v => v != null)) throw new Error('NWS returned no wind');

  const fill = a => { let last = 0; return a.map(v => (v == null ? last : (last = v))); };
  const S10 = fill(spd), D10 = fill(dir);

  /* The plain-weather fields too, so the forecast section still has something to draw on
     this path. NWS reports these in Celsius, millimetres and percent, which is what
     Open-Meteo gives as well, so the two line up without conversion. */
  const gust = expandNWS(P.windGust && P.windGust.values, stamps)
    .map(v => v == null ? null : (P.windGust && /km_h/.test(P.windGust.uom || '') ? v / 3.6 : v));
  const some = a => a && a.some(v => v != null) ? fill(a) : null;
  const raw = { wind_speed_10m: S10, wind_direction_10m: D10 };
  const put = (k, a) => { const v = some(a); if (v) raw[k] = v; };
  put('wind_gusts_10m', gust);
  put('temperature_2m', expandNWS(P.temperature && P.temperature.values, stamps));
  put('dew_point_2m', expandNWS(P.dewpoint && P.dewpoint.values, stamps));
  put('precipitation', expandNWS(P.quantitativePrecipitation && P.quantitativePrecipitation.values, stamps));
  put('precipitation_probability', expandNWS(P.probabilityOfPrecipitation && P.probabilityOfPrecipitation.values, stamps));
  put('cloud_cover', expandNWS(P.skyCover && P.skyCover.values, stamps));

  return {
    time, spd: S10, dir: D10, spd80: null, temp: raw.temperature_2m || null,
    elev: P.elevation ? P.elevation.value : null,
    tz: 'NWS grid', source: 'NWS', raw
  };
}

/* Open-Meteo first, then the National Weather Service, then whatever we saw last. */
async function weather(lat, lon) {
  try {
    const h = await weatherOpenMeteo(lat, lon);
    h.source = 'Open-Meteo';
    cacheSave(lat, lon, h);
    return h;
  } catch (first) {
    try {
      const h = await weatherNWS(lat, lon);
      cacheSave(lat, lon, h);
      return h;
    } catch (second) {
      const c = cacheLoad(lat, lon);
      if (c) return c;
      throw new Error(first.message + '; the weather service fallback also failed (' + second.message + ')');
    }
  }
}

async function weatherOpenMeteo(lat, lon) {
  const aloft = LEVELS.flatMap(p => [`wind_speed_${p}hPa`, `wind_direction_${p}hPa`, `geopotential_height_${p}hPa`]);
  const u = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat.toFixed(4) + '&longitude=' + lon.toFixed(4) +
    '&hourly=' + ['wind_speed_10m', 'wind_direction_10m', 'wind_speed_80m', 'wind_direction_80m',
      'wind_speed_120m', 'wind_direction_120m', 'wind_gusts_10m',
      /* the plain-weather fields, so this page can be the forecast as well as the twin */
      'temperature_2m', 'dew_point_2m', 'precipitation', 'precipitation_probability', 'cloud_cover'
    ].concat(aloft).join(',') +
    '&wind_speed_unit=ms&forecast_days=3&timezone=auto';
  const r = await fetchIn(u, 9000);
  if (!r.ok) throw new Error('forecast ' + r.status);
  const j = await r.json();
  return {
    time: j.hourly.time, spd: j.hourly.wind_speed_10m, dir: j.hourly.wind_direction_10m,
    spd80: j.hourly.wind_speed_80m, temp: j.hourly.temperature_2m,
    elev: j.elevation, tz: j.timezone, raw: j.hourly
  };
}

/* The profile you are standing under, from your face to the jet, with anything underground
   thrown away. Heights are above the ground, not above the sea, because that is what you
   are looking up through. */
function profileAt(h) {
  const H = S.hours, g = H.elev == null ? 0 : H.elev;
  if (!H.raw) return [];
  /* the fallback sources carry 10 m and nothing else, so every level is optional */
  const lvl = (agl, sKey, dKey) => {
    const s = H.raw[sKey], d = H.raw[dKey];
    if (!s || !d || s[h] == null || d[h] == null) return null;
    return { agl, speed: s[h], dir: d[h] };
  };
  const near = [
    lvl(10, 'wind_speed_10m', 'wind_direction_10m'),
    lvl(80, 'wind_speed_80m', 'wind_direction_80m'),
    lvl(120, 'wind_speed_120m', 'wind_direction_120m')
  ].filter(Boolean);
  const up = LEVELS.map(p => {
    const msl = H.raw['geopotential_height_' + p + 'hPa'];
    if (!msl || msl[h] == null) return null;
    const agl = msl[h] - g;
    if (!(agl > 220)) return null;                  // underground, or inside the near set already
    return { agl, speed: H.raw['wind_speed_' + p + 'hPa'][h], dir: H.raw['wind_direction_' + p + 'hPa'][h], hPa: p };
  }).filter(Boolean);
  return near.concat(up)
    .filter(L => Number.isFinite(L.speed) && Number.isFinite(L.dir))
    .sort((a, b) => a.agl - b.agl);
}
async function geocode(name) {
  const r = await fetchIn('https://geocoding-api.open-meteo.com/v1/search?count=1&name=' + encodeURIComponent(name), 8000);
  const j = await r.json();
  const g = j.results && j.results[0];
  if (!g) throw new Error('no place called that');
  return { lat: g.latitude, lon: g.longitude, label: [g.name, g.admin1, g.country_code].filter(Boolean).join(', ') };
}

/* ---------- drawing the ground ---------- */
function hillshade() {
  const dem = S.dem;
  if (!dem) return;
  const cv = $('ground');
  const n = dem.n;
  cv.width = cv.height = n;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(n, n);
  const rng = Math.max(1, dem.hi - dem.lo), dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const lx = -0.6, ly = -0.6, lz = 0.53;     // light from the north-west, the cartographer's lie
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const at = (a, b) => dem.h[Math.max(0, Math.min(n - 1, b)) * n + Math.max(0, Math.min(n - 1, a))];
    const dzdx = (at(i + 1, j) - at(i - 1, j)) / (2 * dem.dx);
    const dzdy = (at(i, j + 1) - at(i, j - 1)) / (2 * dem.dx);
    let s = (-dzdx * lx - dzdy * ly + lz) / Math.sqrt(dzdx * dzdx + dzdy * dzdy + 1);
    s = Math.max(0, Math.min(1, s * 1.15));
    const t = Math.pow((dem.h[j * n + i] - dem.lo) / rng, 0.78);
    /* low ground cool and dim, high ground warm and bright, then shaded hard enough that
       the relief reads at a glance instead of washing out under the trails */
    const base = dark ? [18, 26, 35] : [206, 214, 219];
    const hiC = dark ? [120, 100, 72] : [226, 206, 174];
    const o = (j * n + i) * 4;
    for (let c = 0; c < 3; c++) {
      const v = base[c] + (hiC[c] - base[c]) * t;
      img.data[o + c] = Math.max(0, Math.min(255, v * (0.28 + 1.0 * s)));
    }
    img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  /* the disc panel crops this same image to its own zoom, in drawDisc */
}

/* ---------- particles, after nullschool ---------- */
const P = { pts: [], n: 900, maxAge: 120 };
function seed(k) {
  return { x: Math.random(), y: Math.random(), px: 0, py: 0, age: Math.random() * P.maxAge | 0 };
}
/* Colour against a reference tied to the forecast rather than to this map's own maximum.
   Normalising by the maximum makes an ordinary 3 m/s day look like a gale, because whatever
   is fastest is always painted the hottest colour. */
function ramp(s, top) {
  const t = Math.max(0, Math.min(1, s / Math.max(2, top)));
  const stops = [[70, 120, 190], [90, 180, 170], [220, 190, 90], [230, 120, 60], [240, 240, 245]];
  const f = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(f)), g = f - i;
  const a = stops[i], b = stops[i + 1];
  return `rgba(${(a[0] + (b[0] - a[0]) * g) | 0},${(a[1] + (b[1] - a[1]) * g) | 0},${(a[2] + (b[2] - a[2]) * g) | 0},0.88)`;
}
function animate() {
  const cv = $('flow'), ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  if (!S.slice) return;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const top = S.ref || 10;

  /* fade instead of clear: that is what leaves the trails. Gentle, or a trail dies in a
     handful of frames and the whole map reads as static rather than as moving air. */
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'rgba(0,0,0,0.04)';
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineWidth = 1.35;
  ctx.lineCap = 'round';

  /* Trail length is scaled so a typical wind is legible, the way nullschool scales its own.
     A 3 m/s day moves a particle about a pixel per frame at true scale, which reads as a
     field of dots rather than as air going somewhere. Speed is carried by colour instead,
     which stays on an absolute scale and does not lie. */
  const n = S.slice.n, step = S.step || 0.0015;
  for (const p of P.pts) {
    const g = sampleBilinear(S.slice, p.x * (n - 1), p.y * (n - 1));
    p.px = p.x; p.py = p.y;
    /* screen y grows downward while the field's v points north, hence the minus */
    p.x += g.u * step;
    p.y -= g.v * step;
    p.age++;
    if (p.age > P.maxAge || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1 || g.s < 0.02) {
      Object.assign(p, seed());
      continue;
    }
    ctx.strokeStyle = ramp(g.s, top);
    ctx.beginPath();
    ctx.moveTo(p.px * W, p.py * H);
    ctx.lineTo(p.x * W, p.y * H);
    ctx.stroke();
  }
  if (!calm) S.anim = requestAnimationFrame(animate);
}
function startFlow() {
  cancelAnimationFrame(S.anim);
  const cv = $('flow'), box = cv.parentElement.getBoundingClientRect();
  const side = Math.round(Math.min(box.width, 560));
  cv.width = side; cv.height = side;
  S.step = 3.6 / (Math.max(2, S.ref || 6) * side);
  $('ground').style.width = $('flow').style.width = side + 'px';
  $('ground').style.height = $('flow').style.height = side + 'px';
  P.pts = Array.from({ length: P.n }, seed);
  cv.getContext('2d').clearRect(0, 0, side, side);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { animate(); note('Motion is off in your system settings, so the flow is drawn once and held.'); }
  else animate();
}

/* ---------- putting it together ---------- */
function note(t) { $('note').textContent = t; }
function hourLabel(i) {
  const t = S.hours.time[i];
  return t.slice(5, 10).replace('-', '/') + ' ' + t.slice(11, 16);
}
function solve() {
  const h = S.hour, U = S.hours.spd[h], dir = S.hours.dir[h];
  const t0 = performance.now();
  S.F = buildField(S.dem, { nx: 48, ny: 48, U, dir, z0: S.z0, R: S.R });
  const res = project(S.F, 160, 1.3);
  S.slice = surfaceSlice(S.F, S.zAGL, 96);
  let mx = 0, sum = 0;
  for (let i = 0; i < S.slice.S.length; i++) { mx = Math.max(mx, S.slice.S[i]); sum += S.slice.S[i]; }
  S.sliceMax = mx;
  /* the colour reference: a touch above the forecast, so the warm end means "faster than
     the forecast said" rather than merely "the fastest thing on screen" */
  S.ref = Math.max(3, U * 1.9);
  const mean = sum / S.slice.S.length;
  const ms = Math.round(performance.now() - t0);

  $('r-forecast').textContent = U.toFixed(1) + ' m/s';
  $('r-dir').textContent = Math.round(dir) + '°';
  $('r-fastest').textContent = mx.toFixed(1) + ' m/s';
  $('r-ratio').textContent = (mx / Math.max(.05, U)).toFixed(2) + '×';
  $('r-relief').textContent = Math.round(S.dem.hi - S.dem.lo) + ' m';
  $('r-div').textContent = res.drop > 50 ? Math.round(res.drop).toLocaleString() + '× less' : 'only ' + res.drop.toFixed(1) + '×';
  S.layers = profileAt(S.hour);
  renderProfile();
  throwDisc();
  const fine = S.F.zf.filter(z => z <= 100).length - 1;
  note(`Solved on a ${S.F.nx}×${S.F.ny}×${S.F.nz} grid in ${ms} ms. Cells are ${Math.round(S.F.dx)} m across; the levels are ${S.F.ds[0]} m apart at the bottom, ${fine} of them inside the first 100 m, stretching to ${Math.round(S.F.ds[S.F.nz - 1])} m by the lid at ${Math.round(S.F.top)} m. Mean speed ${mean.toFixed(1)} m/s.`);
  startFlow();
}

async function load(lat, lon, label) {
  if (S.busy) return;
  S.busy = true;
  $('go').disabled = true;
  try {
    note('Fetching the forecast…');
    S.lat = lat; S.lon = lon; S.place = label;
    $('where').textContent = label;
    S.hours = await weather(lat, lon);
    const now = new Date().toISOString().slice(0, 13);
    const idx = S.hours.time.findIndex(t => t.slice(0, 13) >= now);
    S.hour = idx < 0 ? 0 : idx;
    $('hour').max = S.hours.time.length - 1;
    $('hour').value = S.hour;
    $('hour-out').textContent = hourLabel(S.hour);

    note('Fetching the ground…');
    S.dem = await fetchDEM(lat, lon, S.span, 96, note);
    if (S.dem.missing) note(`${S.dem.missing} terrain tile(s) would not load, so part of the ground is flat and wrong.`);
    $('r-elev').textContent = S.hours.elev == null ? '–' : Math.round(S.hours.elev) + ' m';
    $('r-src').textContent = S.hours.source === 'Open-Meteo' ? 'Open-Meteo'
      : S.hours.source === 'NWS' ? 'Weather Service'
      : 'saved, ' + Math.round(S.hours.ageHours || 0) + 'h old';
    hillshade();
    renderMeteogram();
    /* a radar frame is for where you were, not where you now are */
    if ($('radar')) { $('radar').hidden = true; $('radarbtn').classList.remove('on'); $('radarbtn').setAttribute('aria-pressed', 'false'); }
    solve();
  } catch (e) {
    note('That did not work: ' + e.message + '. The terrain and forecast both come from public services, so a blocked network or an offline tile server will stop it here.');
  } finally {
    S.busy = false;
    $('go').disabled = false;
  }
}

/* ---------- the disc ----------
   Two throws, same release: one through the solved field, one through still air. The gap
   between the lines is the terrain's contribution, which is the only reason this is here. */
function throwDisc() {
  if (!S.F) return;
  const opts = {
    speed: S.speed, angle: S.angle, stability: S.stability, bearing: S.bearing,
    hyzer: 0, nose: -2, spin: 1200, rhbh: true,
    ground: (x, y) => groundAt(S.F, x, y),
    startZ: groundAt(S.F, 0, 0) + 1.5
  };
  const live = fly(opts, (x, y, z) => windForFlight(S.F, x, y, z));
  const calm = fly(opts, null);
  S.shots = { live, calm };

  const d = live.distance - calm.distance;
  $('d-dist').textContent = live.distance.toFixed(0) + ' m';
  $('d-still').textContent = calm.distance.toFixed(0) + ' m';
  $('d-delta').textContent = (d >= 0 ? '+' : '') + d.toFixed(0) + ' m';
  const a = live.across;
  $('d-finish').textContent = Math.abs(a) < 2 ? 'straight' : Math.abs(a).toFixed(0) + ' m ' + (a > 0 ? 'right' : 'left');
  $('d-peak').textContent = (live.peak - groundAt(S.F, 0, 0)).toFixed(1) + ' m';
  $('d-time').textContent = live.time.toFixed(1) + ' s';
  $('d-note').textContent = live.landed
    ? `Thrown ${compass(S.bearing)} at ${S.speed} m/s. The wind ${Math.abs(d) < 2 ? 'barely touched it' : (d > 0 ? 'added ' + d.toFixed(0) + ' m' : 'took ' + (-d).toFixed(0) + ' m')}.`
    : 'The disc left the square before landing — try a slower throw or a wider view.';
  drawDisc();
}

function drawDisc() {
  const cv = $('disc'), box = cv.parentElement.getBoundingClientRect();
  const side = Math.round(Math.min(box.width, 560));
  cv.width = side; cv.height = side;
  $('ground2').style.width = cv.style.width = side + 'px';
  $('ground2').style.height = cv.style.height = side + 'px';
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, side, side);
  if (!S.shots) return;

  /* A throw is about a hundred metres and the map is twelve kilometres, so on the map's own
     scale the whole flight is three pixels wide. This panel zooms to the throw. */
  const reach = Math.max(S.shots.live.distance, S.shots.calm.distance, 60);
  const span = Math.max(150, reach * 2.4);
  const X = x => side / 2 + x / span * side;
  const Y = y => side / 2 - y / span * side;

  /* the same hillshade, cropped to that window */
  const src = $('ground'), g2 = $('ground2');
  if (src && src.width && g2) {
    g2.width = g2.height = side;
    const n = src.width, r = Math.min(n / 2, span / S.span * n / 2);
    const gx = g2.getContext('2d');
    gx.imageSmoothingEnabled = true;
    gx.clearRect(0, 0, side, side);
    gx.drawImage(src, n / 2 - r, n / 2 - r, 2 * r, 2 * r, 0, 0, side, side);
  }

  /* a scale bar, because the zoom changes with every throw */
  const barM = span >= 600 ? 100 : span >= 300 ? 50 : 25;
  const barPx = barM / span * side;
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(14, side - 18); ctx.lineTo(14 + barPx, side - 18);
  ctx.moveTo(14, side - 22); ctx.lineTo(14, side - 14);
  ctx.moveTo(14 + barPx, side - 22); ctx.lineTo(14 + barPx, side - 14);
  ctx.stroke();
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(barM + ' m', 14, side - 26);

  const line = (path, col, width, dash) => {
    ctx.strokeStyle = col; ctx.lineWidth = width; ctx.setLineDash(dash || []);
    ctx.beginPath();
    path.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])));
    ctx.stroke();
    ctx.setLineDash([]);
  };
  line(S.shots.calm.path, 'rgba(255,255,255,0.45)', 2, [6, 5]);
  line(S.shots.live.path, '#FF8A5C', 3);

  const end = S.shots.live.path[S.shots.live.path.length - 1];
  const cEnd = S.shots.calm.path[S.shots.calm.path.length - 1];
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.arc(X(cEnd[0]), Y(cEnd[1]), 4, 0, 6.2832); ctx.fill();
  ctx.fillStyle = '#FF8A5C';
  ctx.beginPath(); ctx.arc(X(end[0]), Y(end[1]), 6.5, 0, 6.2832); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(X(0), Y(0), 5, 0, 6.2832); ctx.fill();
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('you', X(0) + 9, Y(0) + 4);
}

/* the column of air above you, listed highest first the way you would meet it looking up */
function renderProfile() {
  const box = $('profile');
  if (!box) return;
  if (!S.layers || !S.layers.length) { box.innerHTML = '<p class="nojs">The profile aloft arrives with a real place.</p>'; return; }
  box.innerHTML = '<ul class="prof">' + S.layers.slice().reverse().map(L =>
    `<li><b>${fmtH(L.agl)}</b><span>${L.speed.toFixed(1)} m/s</span><span>${compass(L.dir)}</span>` +
    `<i style="width:${Math.min(100, L.speed / 25 * 100).toFixed(0)}%"></i></li>`).join('') + '</ul>';
}

/* ---------- the plain forecast ----------

   This page used to have a sibling, "Weather where you are", which drew a radar map and a
   point forecast. Its forecast was not a forecast: the meteogram was generated on the spot
   from sine waves and Math.random(), and four of its snow markers were invented numbers
   pinned to real Colorado passes. It also crashed before drawing anything, because
   RainViewer stopped publishing the free nowcast frame and the page read [0] of an empty
   array. Rather than repair a page built on fiction, its two real parts — live radar, and
   the idea of a point forecast — moved here, where the numbers already come from somewhere.

   Three panels, one time axis, no second y-scale on any of them. Temperature and dew point
   share a scale because they are the same quantity. Everything else gets its own band. */

const BANDS = [
  {
    key: 'temp', h: 0.40, label: '°F',
    series: [
      { k: 'temperature_2m', name: 'Temperature', col: '--orange', conv: c => c * 9 / 5 + 32 },
      { k: 'dew_point_2m', name: 'Dew point', col: '--blue', dash: [5, 4], conv: c => c * 9 / 5 + 32 }
    ]
  },
  {
    key: 'wet', h: 0.24, label: '% chance', zero: true, top: 100,
    series: [{ k: 'precipitation_probability', name: 'Chance of precipitation', col: '--blue', bars: true }]
  },
  {
    key: 'wind', h: 0.36, label: 'm/s', zero: true,
    series: [
      { k: 'wind_gusts_10m', name: 'Gusts', col: '--purple', dash: [5, 4] },
      { k: 'wind_speed_10m', name: 'Wind at 10 m', col: '--green' }
    ]
  }
];

function meteoData() {
  const H = S.hours;
  if (!H || !H.raw || !H.time) return null;
  const n = Math.min(H.time.length, 48);
  const bands = BANDS.map(b => {
    const series = b.series
      .filter(s => Array.isArray(H.raw[s.k]) && H.raw[s.k].some(v => v != null))
      .map(s => ({ ...s, v: H.raw[s.k].slice(0, n).map(x => x == null ? null : (s.conv ? s.conv(x) : x)) }));
    return series.length ? { ...b, series } : null;
  }).filter(Boolean);
  return bands.length ? { n, time: H.time.slice(0, n), bands } : null;
}

function renderMeteogram() {
  const cv = $('meteo');
  if (!cv) return;
  const wrap = cv.parentElement;
  const D = meteoData();
  const msg = $('meteo-note');
  if (!D) {
    wrap.hidden = true;
    /* the invented hill the page opens on has no weather, and a saved forecast from before
       these fields were requested has none either */
    if (msg) msg.textContent = S.hours && S.hours.raw
      ? 'This forecast carries wind but none of the plain-weather fields, so there is nothing honest to chart.'
      : 'The forecast arrives with a real place.';
    return;
  }
  wrap.hidden = false;

  const dpr = Math.min(2, devicePixelRatio || 1);
  const W = Math.round(wrap.getBoundingClientRect().width);
  const Hpx = 300;
  cv.width = W * dpr; cv.height = Hpx * dpr;
  cv.style.width = W + 'px'; cv.style.height = Hpx + 'px';
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, Hpx);

  const padL = 46, padR = 10, padT = 10, padB = 26;
  const plotW = W - padL - padR, plotH = Hpx - padT - padB;
  const gap = 18;          // enough that one band's lowest tick label clears the next band's highest
  const totalH = D.bands.reduce((a, b) => a + b.h, 0);
  const X = i => padL + (D.n < 2 ? 0 : i / (D.n - 1) * plotW);

  const ink = css('--ink'), soft = css('--ink-soft'), line = css('--line');
  ctx.font = '400 11px ' + (css('--mono') || 'monospace');

  /* midnight rules and day names, drawn once behind every band */
  const dayStart = [];
  for (let i = 0; i < D.n; i++) if (D.time[i].slice(11, 13) === '00') dayStart.push(i);
  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  for (const i of dayStart) {
    ctx.beginPath();
    ctx.moveTo(X(i) + .5, padT);
    ctx.lineTo(X(i) + .5, padT + plotH);
    ctx.stroke();
  }
  ctx.fillStyle = soft;
  ctx.textAlign = 'left';
  for (const i of dayStart) {
    const d = new Date(D.time[i]);
    ctx.fillText(d.toLocaleDateString(undefined, { weekday: 'short' }), X(i) + 4, Hpx - 10);
  }
  /* "now" is index 0 of what we draw only if the slider started there; mark the chosen hour */
  const hx = X(Math.max(0, Math.min(D.n - 1, S.hour)));
  ctx.strokeStyle = css('--orange');
  ctx.lineWidth = 2;
  ctx.globalAlpha = .55;
  ctx.beginPath(); ctx.moveTo(hx, padT); ctx.lineTo(hx, padT + plotH); ctx.stroke();
  ctx.globalAlpha = 1;

  let y = padT;
  for (const b of D.bands) {
    const bh = b.h / totalH * (plotH - gap * (D.bands.length - 1));
    const vals = b.series.flatMap(s => s.v).filter(v => v != null && isFinite(v));
    let lo = b.zero ? 0 : Math.min(...vals), hi = b.top != null ? b.top : Math.max(...vals);
    if (!(hi > lo)) hi = lo + 1;
    const pad = (hi - lo) * 0.12;
    if (b.top == null) hi += pad;
    if (!b.zero) lo -= pad;
    const Y = v => y + bh - (v - lo) / (hi - lo) * bh;

    /* the band's own two ticks: enough to read a value, few enough to stay quiet */
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.fillStyle = soft;
    ctx.textAlign = 'right';
    for (const t of [lo, hi]) {
      ctx.beginPath(); ctx.moveTo(padL, Y(t) + .5); ctx.lineTo(padL + plotW, Y(t) + .5); ctx.stroke();
      ctx.fillText(Math.round(t), padL - 6, Y(t) + 4);
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = soft;
    ctx.fillText(b.label, padL + 4, y + 11);

    const placed = [];                      // label rows already used in this band
    for (const s of b.series) {
      const col = css(s.col);
      if (s.bars) {
        const bw = Math.max(1, plotW / D.n - 1.5);
        ctx.fillStyle = col;
        ctx.globalAlpha = .65;
        for (let i = 0; i < D.n; i++) {
          const v = s.v[i];
          if (v == null || v <= 0) continue;
          /* 4px rounded top, anchored to the baseline */
          const top = Y(v), h = y + bh - top;
          const r = Math.min(4, bw / 2, h);
          ctx.beginPath();
          ctx.moveTo(X(i) - bw / 2, y + bh);
          ctx.lineTo(X(i) - bw / 2, top + r);
          ctx.quadraticCurveTo(X(i) - bw / 2, top, X(i) - bw / 2 + r, top);
          ctx.lineTo(X(i) + bw / 2 - r, top);
          ctx.quadraticCurveTo(X(i) + bw / 2, top, X(i) + bw / 2, top + r);
          ctx.lineTo(X(i) + bw / 2, y + bh);
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else {
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.setLineDash(s.dash || []);
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < D.n; i++) {
          const v = s.v[i];
          if (v == null) { started = false; continue; }
          if (started) ctx.lineTo(X(i), Y(v)); else { ctx.moveTo(X(i), Y(v)); started = true; }
        }
        ctx.stroke();
        ctx.setLineDash([]);
        /* Name the line on the line, so the chart needs no legend box of its own. Two lines
           in a band often end at nearly the same height — wind and its gusts converge when
           it is calm — so a label that would land on one already placed is pushed clear. */
        const last = s.v.map((v, i) => [v, i]).filter(p => p[0] != null).pop();
        if (last) {
          let ly = Math.max(y + 11, Math.min(y + bh - 3, Y(last[0]) - 6));
          for (let guard = 0; guard < 6 && placed.some(p => Math.abs(p - ly) < 13); guard++) {
            ly = ly - 13 < y + 11 ? ly + 13 : ly - 13;
          }
          placed.push(ly);
          ctx.fillStyle = col;
          ctx.textAlign = 'right';
          ctx.font = '600 11px ' + (css('--font') || 'sans-serif');
          ctx.fillText(s.name, padL + plotW - 4, ly);
          ctx.font = '400 11px ' + (css('--mono') || 'monospace');
          ctx.textAlign = 'left';
        }
      }
    }
    y += bh + gap;
  }

  /* the readout for the selected hour, in words rather than in pixels */
  const i = Math.max(0, Math.min(D.n - 1, S.hour));
  const at = k => { const a = S.hours.raw[k]; return a && a[i] != null ? a[i] : null; };
  const f = v => v == null ? null : Math.round(v * 9 / 5 + 32) + '°F';
  const bits = [
    f(at('temperature_2m')) && 'Temperature ' + f(at('temperature_2m')),
    f(at('dew_point_2m')) && 'dew point ' + f(at('dew_point_2m')),
    at('precipitation_probability') != null && Math.round(at('precipitation_probability')) + '% chance of precipitation',
    at('wind_gusts_10m') != null && 'gusting ' + at('wind_gusts_10m').toFixed(1) + ' m/s',
    at('cloud_cover') != null && Math.round(at('cloud_cover')) + '% cloud'
  ].filter(Boolean);
  if (msg) msg.textContent = bits.length ? hourLabel(i) + ': ' + bits.join(', ') + '.' : '';
}

/* ---------- live radar, over your own ground ----------
   RainViewer publishes the composite as ordinary web-map tiles, which is exactly the tile
   scheme the terrain already uses — so the radar lands on the same square with the same
   maths, no map library involved. The free feed's `nowcast` array is empty these days, so
   this takes the newest `past` frame and says so rather than reading [0] of nothing. */
async function loadRadar() {
  const dem = S.dem;
  if (!dem || !dem.zoom) throw new Error('no ground yet');
  const j = await (await fetchIn('https://api.rainviewer.com/public/weather-maps.json', 8000)).json();
  const past = (j.radar && j.radar.past) || [];
  if (!past.length) throw new Error('the radar feed has no frames right now');
  const frame = past[past.length - 1];

  /* The free feed serves real composite tiles up to zoom 7 and, above that, a grey card
     reading "Zoom in" — which loads with status 200 and draws like weather. Asking for the
     terrain's own zoom therefore pastes a placeholder over the map and calls it radar. So
     the request is pinned to 7, and the tiles are checked below in case that ceiling moves.
     Zoom 7 is about a kilometre per pixel at this latitude, which is close to the real
     resolution of a national composite anyway: there is no detail above it to lose. */
  const z = 7;
  const halfLat = dem.spanM / 2 / mPerDegLat, halfLon = dem.spanM / 2 / mPerDegLon(dem.lat);
  const west = dem.lon - halfLon, east = dem.lon + halfLon;
  const north = dem.lat + halfLat, south = dem.lat - halfLat;
  const x0 = Math.floor(lon2x(west, z)), x1 = Math.floor(lon2x(east, z));
  const y0 = Math.floor(lat2y(north, z)), y1 = Math.floor(lat2y(south, z));
  const cols = x1 - x0 + 1, rows = y1 - y0 + 1;

  const host = j.host || 'https://tilecache.rainviewer.com';
  const imgs = await Promise.all(Array.from({ length: cols * rows }, (_, k) => new Promise(ok => {
    const im = new Image();
    const t = setTimeout(() => { im.src = ''; ok(null); }, 9000);   // a stalled tile is a missing tile
    im.crossOrigin = 'anonymous';
    im.onload = () => { clearTimeout(t); ok(im); };
    im.onerror = () => { clearTimeout(t); ok(null); };
    /* colour scheme 4, smoothed, no snow mask: legible over a hillshade */
    im.src = `${host}${frame.path}/256/${z}/${x0 + (k % cols)}/${y0 + Math.floor(k / cols)}/4/1_0.png`;
  })));

  /* A placeholder card is flat grey wherever it is opaque; real echo never is. Reject any
     tile that looks like one, so a change at the far end shows up as missing radar rather
     than as a wash of fake weather. */
  const real = imgs.map(im => {
    if (!im) return null;
    const t = document.createElement('canvas');
    t.width = t.height = 256;
    const tx = t.getContext('2d', { willReadFrequently: true });
    tx.drawImage(im, 0, 0);
    let opaque = 0, grey = 0;
    const d = tx.getImageData(0, 0, 256, 256).data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      opaque++;
      if (Math.abs(d[i] - d[i + 1]) < 8 && Math.abs(d[i + 1] - d[i + 2]) < 8) grey++;
    }
    return (opaque > 2000 && grey / opaque > 0.95) ? null : im;
  });
  if (imgs.some(Boolean) && !real.some(Boolean)) {
    throw new Error('the radar server sent a "zoom in" placeholder instead of a composite');
  }

  const cv = $('radar');
  const side = $('flow').width || 512;
  cv.width = cv.height = side;
  cv.style.width = cv.style.height = $('flow').style.width || (side + 'px');
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, side, side);
  /* the mosaic, then the square's own window out of it */
  const m = document.createElement('canvas');
  m.width = cols * 256; m.height = rows * 256;
  const mx = m.getContext('2d');
  real.forEach((im, k) => { if (im) mx.drawImage(im, (k % cols) * 256, Math.floor(k / cols) * 256); });
  const sx = (lon2x(west, z) - x0) * 256, sy = (lat2y(north, z) - y0) * 256;
  const sw = (lon2x(east, z) - lon2x(west, z)) * 256, sh = (lat2y(south, z) - lat2y(north, z)) * 256;
  ctx.globalAlpha = 0.72;
  /* no smoothing: a radar pixel is a kilometre wide and should look like one, not be
     airbrushed into a soft cloud that implies detail the composite does not have */
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(m, sx, sy, sw, sh, 0, 0, side, side);
  ctx.globalAlpha = 1;

  const age = Math.round((Date.now() / 1000 - frame.time) / 60);
  const res = 156543.03392 * Math.cos(dem.lat * Math.PI / 180) / Math.pow(2, z);   // metres per radar pixel
  const across = Math.max(1, Math.round(dem.spanM / res));
  return `Radar composite from ${age} minute${age === 1 ? '' : 's'} ago. A radar pixel is about ${Math.round(res)} m, so this ${(dem.spanM / 1000).toFixed(0)} km square is ${across} of them across` +
    (dem.spanM < 29000 ? ' — widen "Across" for a picture you can read.' : ', which is as much radar as this view can hold.');
}

/* ---------- controls ---------- */
function wire() {
  const sky = mountSky($('sky-host'), () => ({
    layers: S.layers, dem: S.dem, lat: S.lat, lon: S.lon,
    groundM: S.F ? groundAt(S.F, 0, 0) : (S.hours && S.hours.elev) || 0
  }));
  $('look').addEventListener('click', async () => {
    const why = await sky.open();
    if (why) note(why);
  });

  $('go').addEventListener('click', async () => {
    const q = $('place').value.trim();
    if (!q) return;
    note('Looking up that place…');
    try { const g = await geocode(q); load(g.lat, g.lon, g.label); }
    catch (e) {
      /* "not found" and "the lookup service is down" are different problems and the person
         can only act on one of them, so say which it was */
      note(/no place called/i.test(e.message)
        ? 'No place called that. Try a town and a country.'
        : 'The place lookup did not answer (' + e.message + '). It runs on the same service as the main forecast, so it is probably having a bad day — try again shortly.');
    }
  });
  $('place').addEventListener('keydown', e => { if (e.key === 'Enter') $('go').click(); });

  $('here').addEventListener('click', () => {
    if (!navigator.geolocation) { note('This browser will not share a location.'); return; }
    note('Asking your browser where you are…');
    navigator.geolocation.getCurrentPosition(
      p => load(p.coords.latitude, p.coords.longitude, 'Your location'),
      err => note('Your browser did not share a location (' + err.message + '). Typing a place works the same way.'),
      { timeout: 12000, maximumAge: 600000 }
    );
  });

  $('hour').addEventListener('input', e => {
    S.hour = +e.target.value;
    $('hour-out').textContent = hourLabel(S.hour);
    renderMeteogram();
  });
  $('hour').addEventListener('change', () => { if (S.dem) solve(); });

  /* the chart is the other handle on the same hour: point at a time and the twin goes there */
  const meteo = $('meteo');
  if (meteo) {
    const pick = e => {
      const D = meteoData();
      if (!D) return;
      const r = meteo.getBoundingClientRect();
      const t = (e.clientX - r.left - 46) / Math.max(1, r.width - 56);
      const i = Math.max(0, Math.min(D.n - 1, Math.round(t * (D.n - 1))));
      if (i === S.hour) return;
      S.hour = i;
      $('hour').value = i;
      $('hour-out').textContent = hourLabel(i);
      renderMeteogram();
    };
    meteo.addEventListener('click', e => { pick(e); if (S.dem) solve(); });
    meteo.addEventListener('pointermove', e => { if (e.buttons & 1) pick(e); });
    meteo.addEventListener('pointerup', () => { if (S.dem) solve(); });
  }

  /* radar is a request to somebody else's server, so it happens when asked and not before */
  const rb = $('radarbtn');
  if (rb) rb.addEventListener('click', async () => {
    const cv = $('radar');
    if (!cv.hidden) {
      cv.hidden = true;
      rb.classList.remove('on');
      rb.setAttribute('aria-pressed', 'false');
      note('Radar off.');
      return;
    }
    rb.disabled = true;
    note('Fetching the radar…');
    try {
      const said = await loadRadar();
      cv.hidden = false;
      rb.classList.add('on');
      rb.setAttribute('aria-pressed', 'true');
      note(said);
    } catch (e) {
      note('No radar: ' + e.message + '.');
    } finally { rb.disabled = false; }
  });

  const bind = (id, key, fmt, after) => {
    const el = $(id), out = $(id + '-out');
    el.addEventListener('input', () => { S[key] = +el.value; out.textContent = fmt(+el.value); });
    el.addEventListener('change', () => { if (S.dem) after(); });
    out.textContent = fmt(+el.value);
  };
  bind('rk', 'R', v => v < .5 ? 'around (' + v.toFixed(2) + ')' : v > 2 ? 'over (' + v.toFixed(1) + ')' : v.toFixed(2), solve);
  bind('agl', 'zAGL', v => v + ' m', () => { S.slice = surfaceSlice(S.F, S.zAGL, 96); startFlow(); });
  bind('rough', 'z0', v => v.toFixed(2) + ' m', solve);
  bind('span', 'span', v => (v / 1000) + ' km', () => load(S.lat, S.lon, S.place));

  /* the disc: these only re-throw, they never re-solve the wind */
  bind('bearing', 'bearing', v => compass(v) + ' ' + v + '°', throwDisc);
  bind('speed', 'speed', v => v + ' m/s', throwDisc);
  bind('angle', 'angle', v => v + '°', throwDisc);
  bind('stability', 'stability', v => v < -0.4 ? 'understable ' + v : v > 0.4 ? 'overstable +' + v : 'neutral', throwDisc);

  addEventListener('resize', () => { if (S.slice) startFlow(); renderMeteogram(); });
}

wire();
/* the ridge runs first, so the page has something true on it before any network call */
(function demo() {
  S.dem = syntheticHill(96, 12000, 420);
  hillshade();
  S.hours = { time: [new Date().toISOString().slice(0, 16)], spd: [8], dir: [270], spd80: [10], temp: [10], elev: 1000, tz: 'demo' };
  S.hour = 0;
  $('hour-out').textContent = 'example';
  $('where').textContent = 'An invented hill';
  $('r-elev').textContent = '1,000 m';
  solve();
  note('This is an invented hill, so you can see what the method does before giving it anywhere real. Pick a place, or use your own location.');
})();
