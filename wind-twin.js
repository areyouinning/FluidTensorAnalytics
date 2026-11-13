/* The local wind twin: fetch the ground under you, fetch the forecast over you, make the two
   agree, then draw the result the way nullschool draws wind — particles carried by the field,
   leaving fading trails, coloured by speed. The physics lives in diagrams/windcore.js. */
import { fetchDEM, buildField, project, surfaceSlice, sampleBilinear, syntheticHill, logSpeed } from './diagrams/windcore.js';
import { mountSky, compass, fmtH } from './wind-sky.js';
import { windForFlight, groundAt } from './diagrams/windcore.js';
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
async function weather(lat, lon) {
  const aloft = LEVELS.flatMap(p => [`wind_speed_${p}hPa`, `wind_direction_${p}hPa`, `geopotential_height_${p}hPa`]);
  const u = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat.toFixed(4) + '&longitude=' + lon.toFixed(4) +
    '&hourly=' + ['wind_speed_10m', 'wind_direction_10m', 'wind_speed_80m', 'wind_direction_80m', 'wind_speed_120m', 'wind_direction_120m', 'temperature_2m'].concat(aloft).join(',') +
    '&wind_speed_unit=ms&forecast_days=3&timezone=auto';
  const r = await fetch(u);
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
  const near = [
    { agl: 10, speed: H.raw.wind_speed_10m[h], dir: H.raw.wind_direction_10m[h] },
    { agl: 80, speed: H.raw.wind_speed_80m[h], dir: H.raw.wind_direction_80m[h] },
    { agl: 120, speed: H.raw.wind_speed_120m[h], dir: H.raw.wind_direction_120m[h] }
  ];
  const up = LEVELS.map(p => {
    const msl = H.raw['geopotential_height_' + p + 'hPa'];
    if (!msl) return null;
    const agl = msl[h] - g;
    if (!(agl > 220)) return null;                  // underground, or inside the near set already
    return { agl, speed: H.raw['wind_speed_' + p + 'hPa'][h], dir: H.raw['wind_direction_' + p + 'hPa'][h], hPa: p };
  }).filter(Boolean);
  return near.concat(up)
    .filter(L => Number.isFinite(L.speed) && Number.isFinite(L.dir))
    .sort((a, b) => a.agl - b.agl);
}
async function geocode(name) {
  const r = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&name=' + encodeURIComponent(name));
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
    $('r-elev').textContent = Math.round(S.hours.elev) + ' m';
    hillshade();
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

/* ---------- controls ---------- */
function wire() {
  const sky = mountSky($('sky-host'), () => ({ layers: S.layers, dem: S.dem }));
  $('look').addEventListener('click', async () => {
    const why = await sky.open();
    if (why) note(why);
  });

  $('go').addEventListener('click', async () => {
    const q = $('place').value.trim();
    if (!q) return;
    note('Looking up that place…');
    try { const g = await geocode(q); load(g.lat, g.lon, g.label); }
    catch (e) { note('No place called that. Try a town and a country.'); }
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
  });
  $('hour').addEventListener('change', () => { if (S.dem) solve(); });

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

  addEventListener('resize', () => { if (S.slice) startFlow(); });
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
