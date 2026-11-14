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

const RAD = Math.PI / 180;

export function mountSky(host, getData) {
  const el = {};
  host.innerHTML = `
    <div class="sky-wrap" hidden>
      <video class="sky-cam" playsinline muted autoplay></video>
      <canvas class="sky-draw"></canvas>
      <div class="sky-hud">
        <button class="btn sky-x" type="button">Close</button>
        <button class="btn sky-peaks" type="button" hidden aria-pressed="false">Peaks</button>
        <div class="sky-read" aria-live="polite"></div>
      </div>
    </div>`;
  el.wrap = host.querySelector('.sky-wrap');
  el.cam = host.querySelector('.sky-cam');
  el.cv = host.querySelector('.sky-draw');
  el.read = host.querySelector('.sky-read');
  el.peaksBtn = host.querySelector('.sky-peaks');
  host.querySelector('.sky-x').addEventListener('click', close);
  el.peaksBtn.addEventListener('click', () => {
    S.showPeaks = !S.showPeaks;
    el.peaksBtn.setAttribute('aria-pressed', String(S.showPeaks));
    el.peaksBtn.classList.toggle('on', S.showPeaks);
  });

  const S = {
    on: false, yaw: 0, pitch: 0, haveSensor: false, stream: null, raf: 0,
    drag: null, fovY: 62, parts: [], horizon: null, note: '',
    peaks: [], showPeaks: false
  };

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
      (S.haveSensor ? '' : ' — drag to look around') + (S.note ? ' — ' + S.note : '');
    S.raf = requestAnimationFrame(frame);
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

export const dirVec = deg => { const r = (deg + 180) * RAD; return { e: Math.sin(r), n: Math.cos(r) }; };
export const compass = deg => ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
export const fmtH = m => m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m';

/* What this is not: the camera is a backdrop, not a tracked scene. There is no visual
   odometry and no SLAM, so alignment is only as good as the phone's compass, which indoors
   or near metal can be tens of degrees out. The skyline drawn from the terrain is the honest
   check: if it does not sit on the real hills, the heading is wrong, not the wind. */
