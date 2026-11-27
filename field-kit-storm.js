/* Paradox field kit: the storm layer and the photos.
 *
 * Loaded after field-kit.html's own scripts, so it shares their globals (gl, ch, V, ve, prog, LENS_V, groundAt, ...).
 * Three things, all switched from the Storm panel:
 *
 * 1. Rain orbs. MRMS radar rain over the watershed above the canyon, 19-20 July 2026, cut into orbs of 20 m3 each
 *    (volume-conserving per cell, scripts/orbs.py). Each orb falls for FALL frames and lands where its cell is.
 *    Orbs that soak in turn sand coloured; the rest join the runoff.
 * 2. Runoff. The water each cell carries, routed straight downhill (steepest descent, flow speed from the upstream
 *    area) with a flat 10 mm/h soak-in. The field is sqrt(Q) smoothed, so a ribbon's width grows with its flow.
 *    It plays as a grey-level video (pdx/storm/water.mp4) and is composited in the terrain shader.
 * 3. Debris flow, PROVISIONAL. The same flow bulked by a uniform sediment concentration Cv = 0.30 (volume x 1/(1-Cv))
 *    and coloured as sediment-laden. The real layer needs the burn-severity map and the HEC-RAS non-Newtonian runout;
 *    until then the label says so.
 * 4. Photos from the canyon, each standing where it was taken and facing the way the camera pointed (EXIF GPS and
 *    compass). The frame is the photo's own image plane: from the photographer's spot it covers exactly what the
 *    camera saw, at any distance, so the kit pushes it out as you rise to keep it readable.
 *
 * Data: pdx/storm/ (meta.json, water.mp4, orbs.txt, height.png, photos.json, photos/). Built by the burn-to-flow
 * scripts (orb_frames.py, orb_texture.py); nothing here is fetched from outside the site. */
(function () {
  'use strict';
  const BASE = 'pdx/storm/';
  const S = window.STORM = { on: false, ready: false, k: 660, playing: false, speed: 1, mode: 0, orbs: true, rivers: true, photos: true };
  const FALL = 24, DROP = 900, ORB_R = 11;        /* frames of fall, metres of drop, drawn radius in metres (an orb of 20 m3 is 1.7 m: drawn larger to be seen) */
  const CV = 0.30;                                 /* provisional bulking for the debris-flow look; PLAN.md section 3 */

  /* ------------------------------------------------------------------ styles and panel */
  const styleEl = document.createElement('style');
  styleEl.textContent = `
#storm { left: 12px; bottom: 56px; width: min(560px, calc(100% - 420px)); padding: 10px 12px; display: grid; gap: 8px; }
#storm .srow { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; }
#storm .sval { font-variant-numeric: tabular-nums; font-family: var(--font-mono, ui-monospace, monospace); font-size: 13px; }
#storm #st-scrub { flex: 1 1 200px; min-width: 0; }
#storm .sgrid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 2px 10px; font-size: 12px; }
#storm .sgrid b { display: block; font-size: 13px; font-variant-numeric: tabular-nums; }
#storm canvas { width: 100%; height: 44px; display: block; }
#storm .note { font-size: 11.5px; color: var(--c-ink-soft); margin: 0; }
#storm .tag { font-size: 11px; font-weight: var(--weight-bold); color: var(--c-orange); letter-spacing: .04em; text-transform: uppercase; }
#storm label { display: flex; gap: 5px; align-items: center; font-size: 13px; cursor: pointer; }
#photoview img { width: 100%; height: auto; border-radius: var(--radius-sm); display: block; }
@media (max-width: 900px) { #storm { bottom: 26px; left: 6px; right: 6px; width: auto; z-index: 25; } #storm .sgrid { grid-template-columns: repeat(2, minmax(0, 1fr)); } #storm .note { display: none; } }`;
  document.head.appendChild(styleEl);

  const btn = document.createElement('button'); btn.className = 'btn'; btn.id = 'b-storm'; btn.textContent = 'Storm'; btn.setAttribute('aria-pressed', 'false');
  btn.title = 'The 19-20 July 2026 storm: rain orbs, runoff and debris flow, with the canyon photos';
  $('barright').insertBefore(btn, $('b-layers'));
  const P = document.createElement('section'); P.id = 'storm'; P.className = 'panel'; P.hidden = true; P.setAttribute('aria-label', 'Storm');
  P.innerHTML = `
<div class="phead"><h2>Storm of 19&ndash;20 July 2026</h2><a class="btn mini" style="margin-left:auto;margin-right:6px;text-decoration:none" href="mailbox.html" title="Kindred Stranger Mailbox: leave a letter for the next visitor" aria-label="Kindred Stranger Mailbox">&#9993;</a><button class="btn mini" id="st-x">Close</button></div>
<div class="srow"><button class="btn go mini" id="st-play">Play</button><input id="st-scrub" type="range" min="0" max="1799" value="660" aria-label="Storm time"><span class="sval" id="st-when"></span></div>
<div class="srow">
  <select id="st-mode" aria-label="What the water shows"><option value="0">Runoff</option><option value="1">Debris flow (provisional)</option></select>
  <select id="st-speed" aria-label="Playback speed"><option value="0.5">&frac12;&times;</option><option value="1" selected>1&times;</option><option value="2">2&times;</option></select>
  <label><input type="checkbox" id="st-orbs" checked>Rain orbs</label>
  <label><input type="checkbox" id="st-riv" checked>Water</label>
  <label><input type="checkbox" id="st-ph" checked>Photos</label>
</div>
<div class="sgrid">
  <div>Peak rain in a cell<b id="st-r">&ndash;</b></div><div>Flow at the canyon<b id="st-q">&ndash;</b></div>
  <div>Rain so far<b id="st-rain">&ndash;</b></div><div>Soaked in / run out<b id="st-split">&ndash;</b></div>
</div>
<canvas id="st-hy" width="640" height="88" aria-label="Flow at the canyon through the storm"></canvas>
<p class="note" id="st-note"></p>`;
  document.body.appendChild(P);
  const NOTE = ['Runoff. Radar rain (MRMS) in orbs of 20 m³, routed straight downhill with a flat 10 mm/h soak-in. A draft: the HEC-RAS 2D runoff comes next.',
    'Debris flow, provisional. The runoff bulked by a uniform 30% sediment concentration and shown as mud. The real runout needs the burn-severity map and the HEC-RAS non-Newtonian model.'];

  /* ------------------------------------------------------------------ data */
  let M, ORB, START, NF, hydro, qMax, HS, photos = [];
  const video = document.createElement('video'); video.muted = true; video.playsInline = true; video.preload = 'auto'; video.crossOrigin = 'anonymous';
  let wTex = null, wHave = false, wNeed = false;
  async function load() {
    if (S.ready || S.loading) return S.loading; return (S.loading = (async () => {
      M = await (await fetch(BASE + 'meta.json')).json(); NF = M.nf;
      /* the watershed's DEM, metres x 10 packed in R (high) and G (low); only used to sit orbs on the ground */
      const im = new Image(); im.src = BASE + 'height.png'; await im.decode();
      const c = document.createElement('canvas'); c.width = M.nx; c.height = M.ny; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, M.nx, M.ny).data; HS = new Float32Array(M.nx * M.ny); for (let i = 0; i < HS.length; i++) HS[i] = (d[i * 4] * 256 + d[i * 4 + 1]) / 10 + M.hmin;
      const hAt = (x, y) => { x = clamp(x, 0, M.nx - 1.001); y = clamp(y, 0, M.ny - 1.001); const i = x | 0, j = y | 0, fx = x - i, fy = y - j, a = HS[j * M.nx + i], b = HS[j * M.nx + i + 1], e = HS[(j + 1) * M.nx + i], f = HS[(j + 1) * M.nx + i + 1]; return (a * (1 - fx) + b * fx) * (1 - fy) + (e * (1 - fx) + f * fx) * fy; };
      const lines = (await (await fetch(BASE + 'orbs.txt')).text()).trim().split('\n').map(s => JSON.parse(s));
      S.lines = lines; hydro = lines.map(o => o.q); qMax = Math.max(...hydro);
      let n = 0; for (const o of lines) n += o.run[0].length + o.soak[0].length;
      ORB = new Float32Array(n * 5); START = new Int32Array(NF + 1); let p = 0;
      lines.forEach((o, k) => { START[k] = p; for (const [arr, s] of [[o.run, 0], [o.soak, 1]]) for (let i = 0; i < arr[0].length; i++) { const x = arr[0][i], y = arr[1][i]; ORB.set([x, y, hAt(x, y), k, s], p * 5); p++; } });
      START[NF] = p;
      buildGL();
      video.src = BASE + 'water.mp4';
      await new Promise((res, rej) => { if (video.readyState >= 1) res(); else { video.addEventListener('loadedmetadata', res, { once: true }); video.addEventListener('error', () => rej(new Error('water.mp4 did not load')), { once: true }); } });
      video.addEventListener('seeked', () => { wNeed = true; wake(); });
      video.addEventListener('ended', () => setPlay(false));
      photos = await (await fetch(BASE + 'photos.json')).json();
      photos.forEach(ph => { ph.mx = mxOf(ph.lon); ph.my = myOf(ph.lat); const i = new Image(); i.src = BASE + ph.f.replace('photos/', 'photos/t_'); i.decode().then(() => { ph.tex = texOf(i); wake(); }).catch(() => { }); });
      S.ready = true; seek(S.k);
    })());
  }

  /* ------------------------------------------------------------------ GL */
  let P_O, P_Q, orbVAO, quadVAO, quadBuf;
  function texOf(img) { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img); gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; }
  function buildGL() {
    P_O = prog(`layout(location=0) in vec2 aXY; layout(location=1) in float aH; layout(location=2) in vec2 aKS;
uniform mat4 uPV; uniform vec2 uOff, uKxy; uniform float uVE, uK, uFall, uDrop, uR, uPx; out vec4 vC; out float vSoak;
${LENS_V}
void main(){ float age=(uK-aKS.x)/uFall; vSoak=aKS.y;
  if(age<0.||age>1.25){ gl_Position=vec4(2.,2.,2.,1.); gl_PointSize=0.; return; }
  float a=min(age,1.), z=LG(aH)*uVE+uDrop*(1.-a)*(1.-a*.15);
  gl_Position=uPV*vec4(uOff.x+aXY.x*uKxy.x, uOff.y-aXY.y*uKxy.y, z+uR*.6, 1.);
  float land=smoothstep(1.,1.25,age);
  vec3 c=mix(vec3(.74,.88,1.), aKS.y>.5?vec3(.79,.63,.42):vec3(.42,.70,.95), smoothstep(.95,1.02,age));
  vC=vec4(c, 1.-land); gl_PointSize=max(2., uR*uPx/gl_Position.w*(age>1.?1.4:1.)); }`,
      `in vec4 vC; in float vSoak; out vec4 o; void main(){ vec2 q=gl_PointCoord*2.-1.; float r=dot(q,q); if(r>1.) discard;
  float l=.55+.45*clamp(dot(normalize(vec3(q.x,-q.y,sqrt(1.-r))),normalize(vec3(-.5,.5,.7))),0.,1.); float sp=pow(max(1.-length(q-vec2(-.35,-.35))*1.6,0.),6.);
  o=vec4(vC.rgb*l+sp*.6, vC.a*(1.-smoothstep(.8,1.,r))); }`);
    orbVAO = gl.createVertexArray(); gl.bindVertexArray(orbVAO);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, ORB, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 20, 8);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 20, 12);
    gl.bindVertexArray(null);
    P_Q = prog(`layout(location=0) in vec3 aP; layout(location=1) in vec2 aT; uniform mat4 uPV; out vec2 vT; void main(){ vT=aT; gl_Position=uPV*vec4(aP,1.); }`,
      `in vec2 vT; out vec4 o; uniform sampler2D uI; uniform float uA, uHi; void main(){ vec2 e=min(vT,1.-vT); float f=step(.015,min(e.x,e.y)); vec3 edge=uHi>.5?vec3(.91,.45,.05):vec3(.99,.98,.96); o=vec4(mix(edge,texture(uI,vT).rgb,f),uA); }`);
    quadVAO = gl.createVertexArray(); gl.bindVertexArray(quadVAO); quadBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf); gl.bufferData(gl.ARRAY_BUFFER, 4 * 5 * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12); gl.bindVertexArray(null);
    wTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, wTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  function uploadWater() {
    if (!video.videoWidth || video.readyState < 2) return;
    gl.bindTexture(gl.TEXTURE_2D, wTex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, video); wHave = true; wNeed = false;
  }

  /* called by drawTerrain with the terrain program's uniforms: the water field rides in the terrain shader */
  S.bindTerrain = function (u) {
    const on = S.on && S.ready && S.rivers && wHave;
    gl.uniform1f(u.uWOn, on ? 1 : 0); if (!on) return;
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, wTex); gl.uniform1i(u.uW, 3);
    gl.uniform4f(u.uWB, M.b[0], M.b[1], M.b[2], M.b[3]); gl.uniform2f(u.uWS, M.nx / M.water_w, S.mode ? Math.sqrt(1 / (1 - CV)) : 1); gl.uniform1f(u.uWMode, S.mode);
  };

  /* the per-frame draw, after the terrain and the layers */
  S.draw = function () {
    if (!S.on || !S.ready) return;
    if (S.playing) { S.k = Math.min(NF - 1, Math.floor(video.currentTime * M.fps)); wNeed = true; }
    if (wNeed) uploadWater();
    if (S.k !== S.shown) { S.shown = S.k; readout(); }
    const kx = (M.b[2] - M.b[0]) / M.nx * V.S, ky = (M.b[3] - M.b[1]) / M.ny * V.S, off = [(M.b[0] - ch.mx) * V.S, -(M.b[1] - ch.my) * V.S];
    if (S.orbs) {
      const O = P_O, k0 = START[Math.max(0, S.k - FALL - 8)], k1 = START[Math.min(NF, S.k + 1)];
      if (k1 > k0) {
        gl.useProgram(O.p); gl.uniformMatrix4fv(O.u.uPV, false, V.PV); gl.uniform2fv(O.u.uOff, off); gl.uniform2f(O.u.uKxy, kx, ky); gl.uniform1f(O.u.uVE, ve);
        gl.uniform1f(O.u.uK, S.k + (S.playing ? (video.currentTime * M.fps) % 1 : 0)); gl.uniform1f(O.u.uFall, FALL); gl.uniform1f(O.u.uDrop, DROP); gl.uniform1f(O.u.uR, ORB_R);
        gl.uniform1f(O.u.uPx, H * dpr / (2 * Math.tan(FOV / 2))); PDX.lensUniforms(O, true);
        gl.bindVertexArray(orbVAO); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
        gl.drawArrays(gl.POINTS, k0, k1 - k0);
        gl.depthMask(true); gl.disable(gl.BLEND); gl.bindVertexArray(null);
      }
    }
    if (S.photos) drawPhotos();
  };

  /* each photo stands on its own image plane, d metres out along the compass heading, centred at eye height */
  const EYE = 1.6;
  function photoQuad(ph) {
    const gz = groundAt(ph.mx, ph.my), cam = toScene(ph.mx, ph.my, 0);
    const dc = Math.hypot(cam[0] - V.e[0], cam[1] - V.e[1], gz * ve - V.e[2]);
    const d = clamp(dc * 0.035, 10, 160), hd = ph.hd * RD, fx = Math.sin(hd), fy = Math.cos(hd), rx = Math.cos(hd), ry = -Math.sin(hd);
    const w = 2 * d * Math.tan(ph.hfov * RD / 2), h = w / ph.ar, cz = PDX.lgH(gz) * ve + EYE * ve;
    const cx = cam[0] + fx * d, cy = cam[1] + fy * d;
    const c = [[cx - rx * w / 2, cy - ry * w / 2, cz - h / 2, 0, 1], [cx + rx * w / 2, cy + ry * w / 2, cz - h / 2, 1, 1], [cx - rx * w / 2, cy - ry * w / 2, cz + h / 2, 0, 0], [cx + rx * w / 2, cy + ry * w / 2, cz + h / 2, 1, 0]];
    return { c, eye: [cam[0], cam[1], cz], ctr: [cx, cy, cz] };
  }
  function drawPhotos() {
    const Q = P_Q; gl.useProgram(Q.p); gl.uniformMatrix4fv(Q.u.uPV, false, V.PV); gl.uniform1i(Q.u.uI, 0); gl.disable(gl.CULL_FACE); gl.bindVertexArray(quadVAO);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    const ink = [.98, .97, .95, .55], hot = hexRGB(css('--c-orange')).map(v => v / 255).concat(.95);
    for (const ph of photos) {
      if (!ph.tex) continue; const q = photoQuad(ph); ph.q = q;
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(q.c.flat()));
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, ph.tex); gl.uniform1f(Q.u.uA, .97); gl.uniform1f(Q.u.uHi, ph === S.sel ? 1 : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      const col = ph === S.sel ? hot : ink; for (const k of q.c) seg(q.eye, [k[0], k[1], k[2]], col, col[3] * .8);
    }
    gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE); gl.bindVertexArray(null);
  }

  /* ------------------------------------------------------------------ time and readout */
  function seek(k) { S.k = clamp(k | 0, 0, NF - 1); if (S.ready) video.currentTime = (S.k + .5) / M.fps; $('st-scrub').value = S.k; wake(); }
  function setPlay(on) {
    S.playing = on && S.ready; $('st-play').textContent = S.playing ? 'Pause' : 'Play';
    if (S.playing) { if (S.k >= NF - 1) seek(0); video.playbackRate = S.speed; video.play().catch(() => { S.playing = false; $('st-play').textContent = 'Play'; }); } else video.pause();
    wake();
  }
  const fmt = v => v >= 1e6 ? (v / 1e6).toFixed(2) + ' million' : Math.round(v).toLocaleString('en-US');
  const hc = $('st-hy').getContext('2d');
  function readout() {
    const o = S.lines[S.k], bulk = S.mode ? 1 / (1 - CV) : 1;
    $('st-when').textContent = new Date((o.t - 6 * 3600) * 1000).toLocaleString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) + ' MDT';
    $('st-r').textContent = o.rmax.toFixed(0) + ' mm/h'; $('st-q').textContent = (o.q * bulk).toFixed(0) + ' m³/s';
    $('st-rain').textContent = fmt(o.tot[0]) + ' m\u00B3'; $('st-split').textContent = fmt(o.tot[1]) + ' / ' + fmt(o.tot[2] * bulk) + ' m\u00B3';
    $('st-scrub').value = S.k;
    const W2 = 640, H2 = 88, col = S.mode ? '#9a6a3a' : css('--c-blue'); hc.clearRect(0, 0, W2, H2);
    hc.globalAlpha = .18; hc.fillStyle = col; hc.beginPath(); hc.moveTo(0, H2); for (let j = 0; j < NF; j += 3) hc.lineTo(j / (NF - 1) * W2, H2 - 4 - hydro[j] / qMax * (H2 - 10)); hc.lineTo(W2, H2); hc.fill();
    hc.globalAlpha = 1; hc.strokeStyle = col; hc.lineWidth = 2.5; hc.beginPath(); for (let j = 0; j <= S.k; j += 3) { const x = j / (NF - 1) * W2, y = H2 - 4 - hydro[j] / qMax * (H2 - 10); j ? hc.lineTo(x, y) : hc.moveTo(x, y); } hc.stroke();
    hc.fillStyle = css('--c-orange'); hc.fillRect(S.k / (NF - 1) * W2 - 1.5, 0, 3, H2);
    $('st-note').textContent = NOTE[S.mode];
  }

  /* ------------------------------------------------------------------ wiring */
  async function open(on) {
    S.on = on; P.hidden = !on; btn.setAttribute('aria-pressed', String(on)); btn.classList.toggle('on', on);
    if (on) { $('st-note').textContent = 'Loading the storm…'; try { await load(); readout(); } catch (e) { $('st-note').textContent = 'The storm did not load: ' + e.message; } }
    else setPlay(false);
    wake();
  }
  btn.onclick = () => open(!S.on); $('st-x').onclick = () => open(false);
  $('st-play').onclick = () => setPlay(!S.playing);
  $('st-scrub').oninput = e => { if (S.playing) setPlay(false); seek(+e.target.value); };
  $('st-speed').onchange = e => { S.speed = +e.target.value; video.playbackRate = S.speed; };
  $('st-mode').onchange = e => { S.mode = +e.target.value; S.shown = -1; wake(); };
  $('st-orbs').onchange = e => { S.orbs = e.target.checked; wake(); };
  $('st-riv').onchange = e => { S.rivers = e.target.checked; wake(); };
  $('st-ph').onchange = e => { S.photos = e.target.checked; wake(); };

  /* the frame loop sleeps when nothing moves: a playing storm moves */
  const animPrev = window.animating;
  window.animating = function () { const a = animPrev ? animPrev() : false; return (S.on && S.playing) || a; };

  /* a click near a photo opens it; otherwise the kit's own click */
  const clickPrev = window.clickAt;
  window.clickAt = clickAt = function (px, py) {
    if (S.on && S.photos && photos.length) {
      computeView(); let best = null, bd = 1e9;
      for (const ph of photos) { if (!ph.q) continue; const a = project(ph.q.c[0]), b = project(ph.q.c[3]); if (!a || !b) continue;
        const x0 = Math.min(a[0], b[0]) - 6, x1 = Math.max(a[0], b[0]) + 6, y0 = Math.min(a[1], b[1]) - 6, y1 = Math.max(a[1], b[1]) + 6;
        if (px >= x0 && px <= x1 && py >= y0 && py <= y1) { const dd = a[2]; if (dd < bd) { bd = dd; best = ph; } } }
      if (best) { showPhoto(best); return; }
    }
    return clickPrev(px, py);
  };
  const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  function showPhoto(ph) {
    S.sel = ph; const i = photos.indexOf(ph);
    $('insp-h').textContent = `Photo ${i + 1} of ${photos.length}`;
    $('insp-b').innerHTML = `<div id="photoview"><img alt="Canyon photo ${i + 1}, facing ${COMPASS[Math.round(ph.hd / 22.5) % 16]}" src="${BASE + ph.f}"></div>
<p class="k" style="margin:8px 0">26 Nov 2026, ${ph.t} MST. Facing ${Math.round(ph.hd)}&deg; (${COMPASS[Math.round(ph.hd / 22.5) % 16]}), ${Math.round(ph.hfov)}&deg; across. Placed from the phone's GPS and compass, so expect a few metres and a few degrees of error.</p>
<div class="row"><button class="btn mini" id="ph-prev">Previous</button><button class="btn mini" id="ph-next">Next</button><button class="btn mini" id="ph-go">Fly to it</button></div>`;
    $('insp').hidden = false;
    $('ph-prev').onclick = () => showPhoto(photos[(i - 1 + photos.length) % photos.length]);
    $('ph-next').onclick = () => showPhoto(photos[(i + 1) % photos.length]);
    $('ph-go').onclick = () => flyTo(ph.mx, ph.my, 160, { yaw: ph.hd * RD, pitch: -0.32 });
    wake();
  }
  const inspX = $('insp-x'), inspPrev = inspX.onclick; inspX.addEventListener('click', () => { if (S.sel) { S.sel = null; wake(); } });

  /* opened from a link: #...&storm (kept simple: the kit's own hash stays first) */
  if (!location.hash || /storm/.test(location.hash) || window.STORM_OPEN) open(true);
})();
