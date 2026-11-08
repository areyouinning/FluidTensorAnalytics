/* Look up: the twin's air, drawn over the camera.

   Each layer of air is a horizontal plane at some height above you. Seen from underneath, a
   plane in perspective is the same geometry as a ceiling: a ray leaving your eye at elevation
   angle t meets height h at horizontal distance h/tan(t). So particles drifting on that plane
   at the layer's real speed appear fast overhead and crawl near the horizon, which is exactly
   how moving cloud looks. Nothing here is a cartoon of wind: the velocities are the forecast's.

   Honest limits are at the bottom of this file and on the page. */

const RAD = Math.PI / 180;

export function mountSky(host, getData) {
  const el = {};
  host.innerHTML = `
    <div class="sky-wrap" hidden>
      <video class="sky-cam" playsinline muted autoplay></video>
      <canvas class="sky-draw"></canvas>
      <div class="sky-hud">
        <button class="btn sky-x" type="button">Close</button>
        <div class="sky-read" aria-live="polite"></div>
      </div>
    </div>`;
  el.wrap = host.querySelector('.sky-wrap');
  el.cam = host.querySelector('.sky-cam');
  el.cv = host.querySelector('.sky-draw');
  el.read = host.querySelector('.sky-read');
  host.querySelector('.sky-x').addEventListener('click', close);

  const S = {
    on: false, yaw: 0, pitch: 0, haveSensor: false, stream: null, raf: 0,
    drag: null, fovY: 62, parts: [], horizon: null, note: ''
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
      const want = 150;
      for (let k = 0; k < want; k++) S.parts.push(newPart(li, layers[li]));
    }
  }
  function newPart(li, L) {
    /* Scatter on the plane in a disc around the viewer. The inner radius has to go very
       small or nothing ever passes near the zenith: at 0.35 of the layer height the highest
       any particle can appear is about 70 degrees, so looking straight up showed empty sky. */
    const r = L.agl * (0.02 + Math.pow(Math.random(), 0.6) * 14);
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
      const ahead = { e: p.e + v.e * L.speed * 2.2, n: p.n + v.n * L.speed * 2.2 };
      const d2 = Math.hypot(ahead.e, ahead.n);
      const q2 = project((Math.atan2(ahead.e, ahead.n) / RAD + 360) % 360, Math.atan2(L.agl, d2) / RAD, W, H);
      if (!q2) continue;
      const fade = Math.max(0.32, Math.min(0.95, (elev - 1) / 18));
      ctx.strokeStyle = SPEED_COLOR(L.speed);
      ctx.globalAlpha = fade;
      ctx.lineWidth = Math.max(1, 2.6 - p.li * 0.4);
      ctx.beginPath();
      ctx.moveTo(q[0], q[1]);
      ctx.lineTo(q2[0], q2[1]);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

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
