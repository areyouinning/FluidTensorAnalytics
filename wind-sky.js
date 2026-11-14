/* Look up: the twin's air, drawn over the camera.

   Each layer of air is a horizontal plane at some height above you. Seen from underneath, a
   plane in perspective is the same geometry as a ceiling: a ray leaving your eye at elevation
   angle t meets height h at horizontal distance h/tan(t). So particles drifting on that plane
   at the layer's real speed appear fast overhead and crawl near the horizon, which is exactly
   how moving cloud looks. Nothing here is a cartoon of wind: the velocities are the forecast's.

   The same view will also name the mountains, where there are mountains worth naming. See
   diagrams/peaks-co.js for that geometry.

   Honest limits are at the bottom of this file and on the page. */

import { peaksFrom, inPeakCountry } from './diagrams/peaks-co.js';
import { skyAt, STARS, LINES } from './diagrams/sky-bodies.js';

const RAD = Math.PI / 180;

/* ---------- the sky, as it actually is ----------

   Where things are comes from diagrams/sky-bodies.js, checked against JPL Horizons. What is
   left here is how to draw them, and two bits of that are worth saying out loud.

   HOW BIG A STAR IS. Magnitude is a logarithmic scale running backwards, and drawing a dot
   whose area is proportional to the light would make Sirius a blob and everything else
   invisible. The eye does not work that way either. So size runs linearly in magnitude —
   roughly half a pixel per magnitude — which is what star atlases have always done, for the
   same reason.

   WHICH WAY THE CRESCENT POINTS. The moon's lit side faces the sun. That sounds too obvious
   to state until you try to compute it from the position angle of the bright limb, which is
   measured from celestial north through east and therefore needs the parallactic angle to
   get onto a screen — and which is the single easiest thing in the sky to render as a mirror
   image. So this does not use it. It takes the bearing from the moon to the sun directly in
   the alt-azimuth frame the view already draws in, and points the limb that way. The horns
   then cannot be backwards, because the geometry drawing them is the geometry that lights
   them. */

/* how faint you can see, by how dark it is */
const LIMIT_MAG = { day: -4, civil: 1.2, nautical: 3.2, astronomical: 4.4, night: 5.0 };

/* a star's drawn radius, in device pixels before scaling */
function starRadius(mag) {
  return Math.max(0.45, 2.9 - 0.46 * mag);
}
/* bluish-white for hot stars down to a warm tint for the bright red ones is a nicety this
   catalogue cut does not carry colour for, so everything is the same warm white */
const STAR_INK = 'rgba(255,252,244,';

/* great-circle bearing from one alt-az point to another, measured from the zenith direction
   toward increasing azimuth — which on this screen is "up" toward "right" */
export function skyBearing(fromAz, fromAlt, toAz, toAlt) {
  const dL = (toAz - fromAz) * RAD;
  const a1 = fromAlt * RAD, a2 = toAlt * RAD;
  const y = Math.sin(dL) * Math.cos(a2);
  const x = Math.cos(a1) * Math.sin(a2) - Math.sin(a1) * Math.cos(a2) * Math.cos(dL);
  return Math.atan2(y, x);
}

export function mountSky(host, getData) {
  const el = {};
  host.innerHTML = `
    <div class="sky-wrap" hidden>
      <video class="sky-cam" playsinline muted autoplay></video>
      <canvas class="sky-draw"></canvas>
      <div class="sky-hud">
        <button class="btn sky-x" type="button">Close</button>
        <button class="btn sky-peaks" type="button" hidden aria-pressed="false">Peaks</button>
        <button class="btn sky-sky" type="button" aria-pressed="false">Sky</button>
        <div class="sky-read" aria-live="polite"></div>
      </div>
    </div>`;
  el.wrap = host.querySelector('.sky-wrap');
  el.cam = host.querySelector('.sky-cam');
  el.cv = host.querySelector('.sky-draw');
  el.read = host.querySelector('.sky-read');
  el.peaksBtn = host.querySelector('.sky-peaks');
  el.skyBtn = host.querySelector('.sky-sky');
  host.querySelector('.sky-x').addEventListener('click', close);
  el.skyBtn.addEventListener('click', () => {
    S.showSky = !S.showSky;
    el.skyBtn.setAttribute('aria-pressed', String(S.showSky));
    el.skyBtn.classList.toggle('on', S.showSky);
    if (S.showSky) refreshSky();
  });
  el.peaksBtn.addEventListener('click', () => {
    S.showPeaks = !S.showPeaks;
    el.peaksBtn.setAttribute('aria-pressed', String(S.showPeaks));
    el.peaksBtn.classList.toggle('on', S.showPeaks);
  });

  const S = {
    on: false, yaw: 0, pitch: 0, haveSensor: false, stream: null, raf: 0,
    drag: null, fovY: 62, parts: [], horizon: null, note: '',
    peaks: [], showPeaks: false,
    sky: null, showSky: false, skyAtMs: 0, lat: 0, lon: 0, elevM: 0
  };

  /* The sky turns a degree every four minutes, which is a whole moon's width, so this is
     recomputed on a clock rather than once when the view opens. Fifteen seconds is well
     inside what anyone could notice and costs about a millisecond. */
  function refreshSky(force) {
    const now = Date.now();
    if (!force && S.sky && now - S.skyAtMs < 15000) return;
    S.skyAtMs = now;
    S.sky = skyAt(S.lat, S.lon, new Date(), { elevM: S.elevM, magLimit: 5.0 });
  }

  /* ---------- orientation ----------
     iOS hands us a true compass heading but only after an explicit tap. Android gives an
     absolute alpha, measured anticlockwise from north, and the screen may itself be rotated. */
  function onOrient(e) {
    let yaw = null;
    if (typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading)) {
      yaw = e.webkitCompassHeading;                      // already degrees clockwise from north
    } else if (e.absolute && typeof e.alpha === 'number') {
      yaw = 360 - e.alpha;
    }
    if (yaw === null) return;
    const scr = (screen.orientation && screen.orientation.angle) || 0;
    S.yaw = (yaw + scr + 360) % 360;
    /* beta is tilt away from flat-on-its-back; 90 is holding it upright, which we call level */
    if (typeof e.beta === 'number') S.pitch = Math.max(-80, Math.min(80, e.beta - 90));
    S.haveSensor = true;
  }
  async function askSensors() {
    const D = window.DeviceOrientationEvent;
    if (!D) return false;
    try {
      if (typeof D.requestPermission === 'function') {
        const r = await D.requestPermission();
        if (r !== 'granted') return false;
      }
    } catch (err) { return false; }
    addEventListener('deviceorientationabsolute', onOrient, true);
    addEventListener('deviceorientation', onOrient, true);
    return true;
  }

  /* drag works whether or not the sensors do, so the view is never stuck */
  function dragging() {
    const c = el.cv;
    const down = e => { S.drag = { x: e.clientX, y: e.clientY, yaw: S.yaw, pitch: S.pitch }; c.setPointerCapture(e.pointerId); };
    const move = e => {
      if (!S.drag) return;
      S.haveSensor = false;                              // the hand wins once it takes over
      S.yaw = (S.drag.yaw - (e.clientX - S.drag.x) * 0.25 + 360) % 360;
      S.pitch = Math.max(-80, Math.min(85, S.drag.pitch + (e.clientY - S.drag.y) * 0.22));
    };
    const up = () => { S.drag = null; };
    c.addEventListener('pointerdown', down);
    c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
  }
  dragging();

  /* ---------- the camera ---------- */
  async function startCam() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return 'no camera in this browser';
    try {
      S.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      el.cam.srcObject = S.stream;
      await el.cam.play().catch(() => { });
      return '';
    } catch (err) {
      return 'camera not shared (' + (err.name || 'refused') + ')';
    }
  }
  function stopCam() {
    if (S.stream) S.stream.getTracks().forEach(t => t.stop());
    S.stream = null;
    el.cam.srcObject = null;
  }

  /* ---------- the skyline, from the twin's own terrain ----------
     March outward along each compass bearing and keep the largest elevation angle. That is
     the horizon you would actually see, so the drawing lines up with the hills in the frame. */
  function skyline(dem, eyeH) {
    if (!dem) return null;
    const N = 240, out = new Float32Array(N);
    const n = dem.n, half = dem.spanM / 2, ground = dem.h[(n >> 1) * n + (n >> 1)];
    for (let a = 0; a < N; a++) {
      const az = a / N * 360, s = Math.sin(az * RAD), c = Math.cos(az * RAD);
      let best = -90;
      for (let step = 1; step <= 40; step++) {
        const d = step / 40 * half;
        const i = Math.round((d * s) / dem.dx + n / 2), j = Math.round((-d * c) / dem.dx + n / 2);
        if (i < 0 || j < 0 || i >= n || j >= n) break;
        const rise = dem.h[j * n + i] - (ground + eyeH);
        const ang = Math.atan2(rise, d) / RAD;
        if (ang > best) best = ang;
      }
      out[a] = best;
    }
    return out;
  }
  const horizonAt = (az) => {
    if (!S.horizon) return 0;
    const N = S.horizon.length, f = ((az % 360) + 360) % 360 / 360 * N;
    const i = Math.floor(f) % N, g = f - Math.floor(f);
    return S.horizon[i] * (1 - g) + S.horizon[(i + 1) % N] * g;
  };

  /* ---------- projection ----------
     A pinhole camera: screen position from how far a point sits off the centre of view. */
  function project(az, elev, W, H) {
    const fy = (H / 2) / Math.tan(S.fovY / 2 * RAD);
    let dAz = ((az - S.yaw + 540) % 360) - 180;
    if (Math.abs(dAz) > 85) return null;                 // behind us, or far enough to smear
    const x = W / 2 + fy * Math.tan(dAz * RAD);
    const y = H / 2 - fy * Math.tan((elev - S.pitch) * RAD);
    if (!isFinite(x) || !isFinite(y)) return null;
    return [x, y];
  }

  function seedParts(layers) {
    S.parts = [];
    for (let li = 0; li < layers.length; li++) {
      const want = 260;
      for (let k = 0; k < want; k++) S.parts.push(newPart(li, layers[li]));
    }
  }
  function newPart(li, L) {
    /* Scatter on the plane in a disc around the viewer. The inner radius has to go very
       small or nothing ever passes near the zenith: at 0.35 of the layer height the highest
       any particle can appear is about 70 degrees, so looking straight up showed empty sky. */
    /* Squared, not square-rooted. Spreading them evenly over the disc is the honest
       distribution, but it piles almost everything out near the horizon where a layer is
       far away and sub-pixel; biasing inward puts them in the 20-60 degree band people
       actually look at. This is a choice about where to draw, not about the wind. */
    const r = L.agl * (0.02 + Math.pow(Math.random(), 2) * 9);
    const a = Math.random() * 360;
    return { li, e: r * Math.sin(a * RAD), n: r * Math.cos(a * RAD), age: Math.random() * 300 | 0 };
  }

  const SPEED_COLOR = s => {
    const t = Math.max(0, Math.min(1, s / 18));
    const stops = [[90, 150, 210], [95, 190, 175], [225, 195, 95], [235, 125, 65], [245, 245, 250]];
    const f = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(f)), g = f - i;
    const a = stops[i], b = stops[i + 1];
    return `rgb(${(a[0] + (b[0] - a[0]) * g) | 0},${(a[1] + (b[1] - a[1]) * g) | 0},${(a[2] + (b[2] - a[2]) * g) | 0})`;
  };

  function frame() {
    const d = getData();
    const layers = (d && d.layers) || [];
    const cv = el.cv, W = cv.width, H = cv.height, ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    if (!layers.length) { S.raf = requestAnimationFrame(frame); return; }

    /* the ground, and the skyline the twin's terrain actually makes */
    ctx.save();
    let hp = '';
    for (let px = 0; px <= W; px += 6) {
      const fy = (H / 2) / Math.tan(S.fovY / 2 * RAD);
      const dAz = Math.atan((px - W / 2) / fy) / RAD;
      const elev = horizonAt(S.yaw + dAz);
      const y = H / 2 - fy * Math.tan((elev - S.pitch) * RAD);
      hp += (px ? 'L' : 'M') + px + ' ' + Math.max(-50, Math.min(H + 50, y)).toFixed(1);
    }
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2;
    const pth = new Path2D(hp);
    ctx.stroke(pth);
    ctx.restore();

    /* compass marks sitting on that skyline */
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const [lbl, az] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]]) {
      const p = project(az, horizonAt(az) + 3, W, H);
      if (!p) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText(lbl, p[0], p[1]);
    }

    /* the layers, far ones first so near air draws over them */
    const order = layers.map((L, i) => i).sort((a, b) => layers[b].agl - layers[a].agl);
    const dt = 1 / 30;
    for (const p of S.parts) {
      const L = layers[p.li];
      if (!L) continue;
      const v = dirVec(L.dir);
      p.e += v.e * L.speed * dt * 6;
      p.n += v.n * L.speed * dt * 6;
      p.age++;
      const dist = Math.hypot(p.e, p.n);
      if (p.age > 420 || dist > L.agl * 16) { Object.assign(p, newPart(p.li, L)); continue; }
      const elev = Math.atan2(L.agl, dist) / RAD;
      const az = (Math.atan2(p.e, p.n) / RAD + 360) % 360;
      const q = project(az, elev, W, H);
      if (!q) continue;
      /* a short dash pointing the way it is going, longer when it is overhead and quick */
      /* Bubbles, not streaks. Overhead is near, so a bubble there is large; towards the
         horizon the same air is far away and shrinks, which is the perspective doing the
         work rather than a drawn trail. */
      const fade = Math.max(0.3, Math.min(0.92, (elev - 1) / 18));
      const r = 1.3 + 5.2 * Math.pow(Math.min(90, elev) / 90, 0.85) - p.li * 0.25;
      if (r <= 0.4) continue;
      ctx.globalAlpha = fade;
      ctx.fillStyle = SPEED_COLOR(L.speed);
      ctx.beginPath();
      ctx.arc(q[0], q[1], r, 0, 6.2832);
      ctx.fill();
      /* the catchlight that makes a disc read as a bubble, only where it is big enough to see */
      if (r > 2.6) {
        ctx.globalAlpha = fade * 0.55;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(q[0] - r * 0.3, q[1] - r * 0.33, r * 0.3, 0, 6.2832);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    /* ---------- the sky ----------
       Drawn before the summits so a peak label always wins a fight with a star. */
    let nearestBody = null;
    if (S.showSky && S.sky) {
      refreshSky();
      const sky = S.sky;
      const limit = LIMIT_MAG[sky.twilight] ?? 5;
      /* In daylight the camera shows a blue sky and the honest answer is that you cannot see
         any of this. The sun, the moon and Venus are the exceptions people really do pick out
         in the afternoon, so those stay and the rest waits for dusk. */
      const dim = sky.twilight === 'day' ? 0.5 : sky.twilight === 'civil' ? 0.75 : 1;

      /* constellation lines first, underneath their own stars */
      const placed = new Map();                   // STARS index -> screen point
      for (const s of sky.stars) {
        if (s.alt < -1 || s.mag > limit) continue;
        const q = project(s.az, s.alt, W, H);
        if (q) placed.set(s.i, q);
      }
      if (limit > 1.5) {
        ctx.save();
        ctx.strokeStyle = 'rgba(150,185,230,0.34)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const [a, b] of LINES) {
          const pa = placed.get(a), pb = placed.get(b);
          if (!pa || !pb) continue;
          /* a segment whose ends land on opposite sides of the screen has wrapped around
             behind the viewer; the projection cannot say so, but the distance can */
          if (Math.abs(pa[0] - pb[0]) > W * 0.6) continue;
          ctx.moveTo(pa[0], pa[1]);
          ctx.lineTo(pb[0], pb[1]);
        }
        ctx.stroke();
        ctx.restore();
      }

      /* the stars */
      for (const s of sky.stars) {
        if (s.mag > limit) continue;
        const q = placed.get(s.i);
        if (!q) continue;
        const below = horizonAt(s.az) > s.alt;
        if (below) continue;                      // behind the hills: no star to see
        const r = starRadius(s.mag);
        const a = Math.min(1, Math.max(0.22, (limit - s.mag + 0.7) / 3)) * dim;
        ctx.fillStyle = STAR_INK + a.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(q[0], q[1], r, 0, 6.2832);
        ctx.fill();
      }

      /* names on the few brightest, so the view teaches rather than just sparkles */
      if (limit > 1.5) {
        ctx.font = '400 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(190,215,250,0.8)';
        for (const s of sky.stars) {
          if (!s.name || s.mag > Math.min(1.6, limit)) continue;
          const q = placed.get(s.i);
          if (!q || horizonAt(s.az) > s.alt) continue;
          ctx.fillText(s.name, q[0], q[1] - 9);
        }
      }

      /* the planets: discs rather than points, named, because that is the thing people
         actually want to know when a bright dot will not twinkle */
      for (const p of sky.planets) {
        if (p.alt < 0 || p.mag > limit + 1.5) continue;
        if (horizonAt(p.az) > p.alt) continue;
        const q = project(p.az, p.alt, W, H);
        if (!q) continue;
        const r = Math.max(1.8, starRadius(p.mag) * 1.15);
        ctx.fillStyle = 'rgba(255,238,200,' + (0.95 * dim).toFixed(2) + ')';
        ctx.beginPath();
        ctx.arc(q[0], q[1], r, 0, 6.2832);
        ctx.fill();
        ctx.font = '600 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,230,170,0.92)';
        ctx.fillText(p.name, q[0], q[1] - r - 6);
      }

      /* the sun: drawn at its real angular size, which is a quarter of a degree and
         therefore small — the sun looks big because it is bright, not because it is wide */
      if (sky.sun.alt > -1 && horizonAt(sky.sun.az) <= sky.sun.alt) {
        const q = project(sky.sun.az, sky.sun.alt, W, H);
        if (q) {
          const fy = (H / 2) / Math.tan(S.fovY / 2 * RAD);
          const r = Math.max(5, fy * Math.tan(0.266 * RAD));
          const g = ctx.createRadialGradient(q[0], q[1], r * 0.4, q[0], q[1], r * 3.4);
          g.addColorStop(0, 'rgba(255,245,210,0.95)');
          g.addColorStop(1, 'rgba(255,220,130,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(q[0], q[1], r * 3.4, 0, 6.2832); ctx.fill();
          ctx.fillStyle = 'rgba(255,250,232,0.98)';
          ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, 6.2832); ctx.fill();
        }
      }

      /* the moon, with the phase it really has */
      const mo = sky.moon;
      if (mo.alt > -1 && horizonAt(mo.az) <= mo.alt) {
        const q = project(mo.az, mo.alt, W, H);
        if (q) drawMoon(ctx, q, mo, sky.sun, H);
      }

      /* what are you pointing at? the brightest named thing within ten degrees of centre */
      const cand = [];
      if (mo.alt > 0) cand.push({ name: 'the Moon', az: mo.az, alt: mo.alt, mag: -12.7, extra: `${Math.round(mo.phase.illum * 100)}% lit, ${mo.phase.name}` });
      if (sky.sun.alt > 0) cand.push({ name: 'the Sun', az: sky.sun.az, alt: sky.sun.alt, mag: -26.7, extra: '' });
      for (const p of sky.planets) if (p.alt > 0 && p.mag <= limit + 1.5) cand.push({ name: p.name, az: p.az, alt: p.alt, mag: p.mag, extra: `magnitude ${p.mag.toFixed(1)}` });
      for (const s of sky.stars) if (s.name && s.alt > 0 && s.mag <= Math.min(2.2, limit)) cand.push({ name: s.name, az: s.az, alt: s.alt, mag: s.mag, extra: `magnitude ${s.mag.toFixed(2)}` });
      let best = null;
      for (const c of cand) {
        if (horizonAt(c.az) > c.alt) continue;
        const dA = Math.abs(((c.az - S.yaw + 540) % 360) - 180);
        const dE = Math.abs(c.alt - S.pitch);
        if (dA > 10 || dE > 10) continue;
        if (!best || c.mag < best.mag) best = c;
      }
      nearestBody = best;
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }

    /* ---------- the named summits ----------

       WHICH ONES GET A NAME. There are four hundred named summits above 13,000 ft in
       Colorado and from the Front Range a hundred and eighty of them are above the horizon
       at once. Drawing a caret on each makes a picket fence, and letting labels fall where
       they may hands the few readable slots to whichever obscure 13er the loop reached
       first — the first pass of this put "Emma Burr Mountain" over the Continental Divide
       and left Grays, Torreys and Blue Sky bare.

       So they are ranked by how big they look: the angular height above level, which already
       folds in both elevation and distance, and is a fair stand-in for what makes a mountain
       catch your eye. The biggest in view draws first and claims its label; the rest fill in
       around it until the space runs out. Carets stop after the top forty, which is as many
       as a skyline can carry before it reads as a fence.

       A summit the twin's own terrain stands in front of is drawn hollow and faint with a
       dotted stem: that is where the peak IS, not what you can see from here. */
    let nearestPeak = null;
    if (S.showPeaks && S.peaks.length) {
      const taken = [];
      ctx.textAlign = 'left';
      ctx.font = '600 14px system-ui, sans-serif';

      const inView = [];
      for (const pk of S.peaks) {
        const q = project(pk.az, pk.el, W, H);
        if (!q || q[0] < -40 || q[0] > W + 40) continue;
        inView.push({ pk, q, hidden: horizonAt(pk.az) > pk.el + 0.05 });
      }
      inView.sort((a, b) => b.pk.el - a.pk.el);        // the ones that loom largest go first

      /* the readout names the biggest thing you are actually pointing at, within 12 degrees
         of the middle of the view, which is about where a person would say "that one" */
      let best = null;
      for (const v of inView) {
        if (v.hidden) continue;
        const off = Math.abs(((v.pk.az - S.yaw + 540) % 360) - 180);
        if (off < 12 && (!best || v.pk.el > best.pk.el)) best = v;
      }
      nearestPeak = best && best.pk;

      inView.forEach((v, rank) => {
        const { pk, q, hidden } = v;
        if (rank < 40) {
          ctx.globalAlpha = hidden ? 0.3 : 0.95;
          ctx.strokeStyle = '#ffd9a0';
          ctx.lineWidth = 2;
          ctx.beginPath();                             // a caret sitting on the summit
          ctx.moveTo(q[0] - 7, q[1] + 7);
          ctx.lineTo(q[0], q[1]);
          ctx.lineTo(q[0] + 7, q[1] + 7);
          ctx.stroke();
          if (hidden) {
            ctx.beginPath();                           // a stem: it is behind that ridge
            ctx.setLineDash([3, 3]);
            ctx.moveTo(q[0], q[1] + 7);
            ctx.lineTo(q[0], q[1] + 20);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
        if (taken.length >= 14) return;                // past this the skyline is all text

        const txt = `${pk.name}  ${pk.elevFt.toLocaleString()}′`;
        const w = ctx.measureText(txt).width + 12;
        const bx = q[0] + 10, by = q[1] - 20;
        if (taken.some(t => bx < t.x + t.w && bx + w > t.x && by < t.y + 20 && by + 20 > t.y)) return;
        taken.push({ x: bx, y: by, w });
        ctx.globalAlpha = 1;
        ctx.fillStyle = hidden ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.6)';
        ctx.fillRect(bx - 5, by, w, 20);
        ctx.fillStyle = hidden ? 'rgba(255,217,160,0.55)' : '#ffd9a0';
        ctx.fillText(txt, bx, by + 14);
      });
      ctx.globalAlpha = 1;
    }

    /* labels where each layer crosses straight ahead */
    ctx.textAlign = 'left';
    ctx.font = '600 14px system-ui, sans-serif';
    /* A layer fills every elevation from the horizon to the zenith, so it has no single
       position to label. Spread the labels in height order instead: higher label, higher air.
       The dashes themselves carry the real geometry. */
    for (let oi = 0; oi < order.length; oi++) {
      const i = order[oi], L = layers[i];
      const rank = layers.length < 2 ? 0.5 : i / (layers.length - 1);
      const p = project(S.yaw, 9 + rank * 58, W, H);
      if (!p) continue;
      const txt = `${fmtH(L.agl)}  ${L.speed.toFixed(1)} m/s  ${compass(L.dir)}`;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      const w = ctx.measureText(txt).width + 12;
      ctx.fillRect(p[0] - 6, p[1] - 14, w, 20);
      ctx.fillStyle = SPEED_COLOR(L.speed);
      ctx.fillText(txt, p[0], p[1]);
    }

    el.read.textContent =
      `Facing ${compass(S.yaw)} ${Math.round(S.yaw)}°, ${S.pitch > 0 ? Math.round(S.pitch) + '° up' : Math.round(-S.pitch) + '° down'}` +
      (nearestPeak ? ` — ${nearestPeak.name}, ${Math.round(nearestPeak.distKm)} km` : '') +
      (nearestBody ? ` — ${nearestBody.name}${nearestBody.extra ? ', ' + nearestBody.extra : ''}` : '') +
      (S.showSky && S.sky && S.sky.twilight === 'day' ? ' — daylight, so only the sun, moon and Venus are drawn' : '') +
      (S.haveSensor ? '' : ' — drag to look around') + (S.note ? ' — ' + S.note : '');
    S.raf = requestAnimationFrame(frame);
  }

  /* The moon at its true angular size, lit from the true direction.

     The disc is built as two pieces that share their poles: a half-circle on the bright side,
     always, and the terminator, which is a half-ELLIPSE whose width is the full radius times
     the cosine of the phase angle. That cosine carries the sign, and the sign is the whole
     shape: positive and the terminator bulges away from the bright limb, giving a gibbous
     moon fatter than half; negative and it cuts back across, leaving a crescent. At first
     quarter the cosine is zero, the ellipse collapses to a straight line, and the moon is
     exactly half lit — which is the test that the construction is right.

     The rotation is the bearing from the moon to the sun, worked out on the sky itself, so
     the horns point away from the sun because they are drawn away from the sun. */
  function drawMoon(ctx, q, mo, sun, H) {
    const fy = (H / 2) / Math.tan(S.fovY / 2 * RAD);
    const R = Math.max(6, fy * Math.tan(mo.radiusDeg * RAD));
    const cosI = Math.cos(mo.phase.phaseAngle * RAD);
    const bearing = skyBearing(mo.az, mo.alt, sun.az, sun.alt);

    ctx.save();
    ctx.translate(q[0], q[1]);
    /* screen: "up" is the zenith and +x is increasing azimuth, so a bearing measured from
       the zenith toward increasing azimuth becomes a rotation of that same angle */
    ctx.rotate(bearing);
    /* after the rotation the sun lies along +y... so put the bright limb there by rotating a
       further quarter turn, which lands the limb's midpoint on the sun side */
    ctx.rotate(-Math.PI / 2);

    /* the dark disc first, faintly: earthshine, and it keeps the moon a circle not a sliver */
    ctx.fillStyle = 'rgba(120,130,150,0.22)';
    ctx.beginPath(); ctx.arc(0, 0, R, 0, 6.2832); ctx.fill();

    ctx.fillStyle = 'rgba(252,250,240,0.97)';
    moonShape(ctx, R, cosI);
    ctx.fill();
    ctx.restore();

    ctx.font = '600 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(245,245,235,0.9)';
    ctx.fillText(`Moon  ${Math.round(mo.phase.illum * 100)}%`, q[0], q[1] - R - 8);
  }

  function size() {
    const r = el.wrap.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    el.cv.width = Math.round(r.width * dpr);
    el.cv.height = Math.round(r.height * dpr);
    el.cv.style.width = r.width + 'px';
    el.cv.style.height = r.height + 'px';
  }

  async function open() {
    const d = getData();
    if (!d || !d.layers || !d.layers.length) return 'no wind profile yet — pick a place first';
    S.on = true;
    el.wrap.hidden = false;
    document.body.style.overflow = 'hidden';
    size();
    addEventListener('resize', size);
    S.horizon = skyline(d.dem, 1.6);

    /* The summits, if this is a place that has any in the list. Eye height is the twin's own
       ground at the centre plus a person, which matters: the same peak sits a tenth of a
       degree lower seen from the plains than from a foothills driveway. */
    const eye = (Number.isFinite(d.groundM) ? d.groundM : 1600) + 1.6;
    S.lat = d.lat; S.lon = d.lon; S.elevM = Number.isFinite(d.groundM) ? d.groundM : 0;
    refreshSky(true);
    S.peaks = inPeakCountry(d.lat, d.lon) ? peaksFrom(d.lat, d.lon, eye) : [];
    el.peaksBtn.hidden = S.peaks.length === 0;
    if (!S.peaks.length) { S.showPeaks = false; el.peaksBtn.setAttribute('aria-pressed', 'false'); el.peaksBtn.classList.remove('on'); }

    seedParts(d.layers);
    const camNote = await startCam();
    const ok = await askSensors();
    S.note = [camNote, ok ? '' : 'no compass'].filter(Boolean).join(', ');
    cancelAnimationFrame(S.raf);
    frame();
    return '';
  }
  function close() {
    S.on = false;
    cancelAnimationFrame(S.raf);
    stopCam();
    removeEventListener('resize', size);
    removeEventListener('deviceorientationabsolute', onOrient, true);
    removeEventListener('deviceorientation', onOrient, true);
    el.wrap.hidden = true;
    document.body.style.overflow = '';
  }
  return { open, close };
}

/* The lit part of a moon, as a path, with the sun along +x.

   Exported on its own and kept free of any sky data, because it is the one piece of this
   file whose correctness cannot be read off the screen: a mirrored crescent looks perfectly
   like a crescent. Drawn alone it can be measured — fill it, count the lit pixels, and the
   fraction must come out as (1 + cos i)/2, which is what the illuminated fraction means. The
   sweep flag below is the whole argument, and it was wrong the first time. */
export function moonShape(ctx, R, cosI) {
  ctx.beginPath();
  ctx.arc(0, 0, R, -Math.PI / 2, Math.PI / 2, false);          // the bright limb, facing +x
  /* back along the terminator. Anticlockwise sends it through +x, cutting INTO the lit half
     for a crescent; clockwise sends it through -x, bulging away for a gibbous moon. */
  ctx.ellipse(0, 0, R * Math.abs(cosI), R, 0, Math.PI / 2, Math.PI * 1.5, cosI < 0);
  ctx.closePath();
}

export const dirVec = deg => { const r = (deg + 180) * RAD; return { e: Math.sin(r), n: Math.cos(r) }; };
export const compass = deg => ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
export const fmtH = m => m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m';

/* What this is not: the camera is a backdrop, not a tracked scene. There is no visual
   odometry and no SLAM, so alignment is only as good as the phone's compass, which indoors
   or near metal can be tens of degrees out. The skyline drawn from the terrain is the honest
   check: if it does not sit on the real hills, the heading is wrong, not the wind. */
