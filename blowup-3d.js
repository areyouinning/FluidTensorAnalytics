/* The 3D picture on the Blowup page, in raw WebGL2. Nothing here is simulated on a grid: all three cases are the exact Navier-Stokes solution
   for a Gaussian vortex in axisymmetric strain, u_r = -αr/2, u_z = αz, u_θ = Γ/(2πr)(1 - exp(-r²/δ²)), ω = Γ/(πδ²) exp(-r²/δ²), with dδ²/dt = 4ν - αδ².
   The cases differ only in α(t): zero, constant, or G/δ². Γ = 1. Without WebGL2 the page stays a plain article. */
'use strict';
window.BLOWUP = (() => {
  const cv = document.getElementById('vortex'), gl = cv.getContext('webgl2', { antialias: true, alpha: false });
  if (!gl) return null;
  document.body.classList.add('live');
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches, narrow = innerWidth <= 1000;
  const D0 = .1225, DMIN = .00012, SPEED = 1.5, TMAX = 60, HOLD = 3.5, NP = narrow ? 500 : 1100, $ = id => document.getElementById(id);
  const S = { kase: 'flat', nu: .0008, alpha: .1, G: .015, t: 0, d2: D0, stretch: 0, phase: 0, a: 0, T: Infinity, blown: false, hold: 0, running: !calm, trace: [], frame: 0 };

  /* ---------- the exact solutions */
  function blowTime(nu, G) { return G > 4 * nu ? (D0 - DMIN) / (G - 4 * nu) : Infinity; }
  function coreAt(k, t) {   // δ² and the log of how far the fluid has been stretched along the axis
    if (k === 'flat') return { d2: D0 + 4 * S.nu * t, stretch: 0, a: 0 };
    if (k === 'strain') { const q = 4 * S.nu / S.alpha; return { d2: q + (D0 - q) * Math.exp(-S.alpha * t), stretch: S.alpha * t, a: S.alpha }; }
    const r = 4 * S.nu - S.G, d2 = D0 + r * t;
    return { d2, stretch: Math.abs(r) > 1e-9 ? S.G / r * Math.log(d2 / D0) : S.G * t / D0, a: S.G / d2 };
  }
  const peak = d2 => 1 / (Math.PI * d2);
  function restart() { Object.assign(S, { t: 0, d2: D0, stretch: 0, phase: 0, a: 0, blown: false, hold: 0, trace: [], T: S.kase === 'feed' ? blowTime(S.nu, S.G) : Infinity }); seed(); advance(0); label(); }
  function advance(dt) {
    S.t = Math.min(S.t + dt, S.T); const c = coreAt(S.kase, S.t); S.d2 = c.d2; S.stretch = c.stretch; S.a = c.a; S.phase += dt * peak(S.d2) / 2;
    if (S.t >= S.T) { if (!S.blown) { S.blown = true; label(); } }
    if (S.trace.length === 0 || S.t - S.trace[S.trace.length - 1][0] > .1) S.trace.push([S.t, peak(S.d2)]);
    moveTracers(dt);
  }

  /* ---------- tracers: each step holds r²z fixed and turns the fluid exactly, so a very large α or a thin core can't make them unstable */
  const P = new Float32Array(NP * 3), V = new Float32Array(NP * 7), ROUT = 1.1, ZOUT = 1.15;
  function seed() { for (let k = 0; k < NP; k++) { P[k * 3] = ROUT * Math.sqrt(Math.random()); P[k * 3 + 1] = Math.random() * Math.PI * 2; P[k * 3 + 2] = (Math.random() * 2 - 1) * ZOUT; } }
  function moveTracers(dt) {
    const shrink = Math.exp(-S.a * dt / 2), grow = Math.exp(S.a * dt), R2 = S.d2;
    for (let k = 0; k < NP; k++) { const o = k * 3; let r = P[o], z = P[o + 2];
      const q = r * r / R2, turn = q < 1e-4 ? 1 / (2 * Math.PI * R2) : (1 - Math.exp(-q)) / (2 * Math.PI * r * r);
      P[o + 1] += Math.min(turn * dt, 1.2); r *= shrink; z *= grow;
      if (Math.abs(z) > ZOUT) { r = ROUT; z = (Math.random() * 2 - 1) * ZOUT; P[o + 1] = Math.random() * Math.PI * 2; }   // inflow arrives evenly over the side of the cylinder
      P[o] = r; P[o + 2] = z; }
  }

  /* ---------- GL */
  const mk = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
  const prog = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); const U = {}, c = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < c; i++) { const a = gl.getActiveUniform(p, i); U[a.name] = gl.getUniformLocation(p, a.name); } return { p, U }; };
  const RAMP = `vec3 ramp(float x){ x=clamp(x,0.,1.); vec3 a=vec3(.39,.78,1.), b=vec3(.5,.89,.77), c=vec3(1.,.54,.36), d=vec3(1.,.95,.86); return x<.4?mix(a,b,x/.4):x<.75?mix(b,c,(x-.4)/.35):mix(c,d,(x-.75)/.25); }`;
  const HEAT = 'float heat(float w){ return log(max(w,.3)/.3)/log(1000.); }';   // ω from .3 to 300 runs across the color ramp
  const TUBE = prog(`#version 300 es
    layout(location=0) in vec2 aV; uniform mat4 uVP; uniform float uR; out vec3 vN; out vec3 vP; out vec2 vT;
    void main(){ float c=cos(aV.x), s=sin(aV.x); vN=vec3(c,0.,s); vP=vec3(c*uR,aV.y,s*uR); vT=aV; gl_Position=uVP*vec4(vP,1.); }`, `#version 300 es
    precision highp float; in vec3 vN; in vec3 vP; in vec2 vT; uniform vec3 uEye; uniform float uW, uStretch, uPhase, uSpin, uAlpha, uMarks; out vec4 o; ${RAMP} ${HEAT}
    void main(){ vec3 V=normalize(uEye-vP), L=normalize(vec3(-.5,.7,.5)), N=normalize(vN); float d=max(dot(N,L),0.), rim=pow(1.-abs(dot(N,V)),2.);
      vec3 c=ramp(heat(uW))*(.45+.6*d)+rim*.25;
      float zm=vT.y*exp(-uStretch), f=fract(zm*4.+.5), w=fwidth(zm*4.)*1.2+.02, ring=1.-smoothstep(w,w*2.,min(f,1.-f));
      float th=fract((vT.x-uPhase)*3./6.28318), tw=fwidth(vT.x*3./6.28318)*1.2+.02, tick=(1.-smoothstep(tw,tw*2.,min(th,1.-th)))*uSpin;
      c=mix(c,vec3(.04,.08,.15),max(ring,tick)*.72*uMarks); float end=smoothstep(1.2,.92,abs(vT.y)); o=vec4(c,uAlpha*end); }`);
  const DISC = prog(`#version 300 es
    layout(location=0) in vec2 aV; uniform mat4 uVP; out float vR;
    void main(){ vR=aV.x; gl_Position=uVP*vec4(cos(aV.y)*aV.x,-1.2,sin(aV.y)*aV.x,1.); }`, `#version 300 es
    precision highp float; in float vR; uniform float uW, uD2; out vec4 o; ${RAMP} ${HEAT}
    void main(){ float w=uW*exp(-vR*vR/uD2), h=heat(w), lit=smoothstep(0.,.05,h), edge=smoothstep(1.2,1.1,vR); o=vec4(mix(vec3(.078,.13,.21),ramp(h),lit),edge); }`);
  const LINE = prog(`#version 300 es
    layout(location=0) in vec3 aP; layout(location=1) in vec4 aC; uniform mat4 uVP; uniform float uPx; out vec4 vC;
    void main(){ vC=aC; gl_Position=uVP*vec4(aP,1.); gl_PointSize=uPx; }`, `#version 300 es
    precision highp float; in vec4 vC; uniform float uRound; out vec4 o;
    void main(){ if(uRound>.5){ vec2 q=gl_PointCoord*2.-1.; if(dot(q,q)>1.) discard; } o=vC; }`);
  const tube = (() => { const v = [], ix = [], A = 48, B = 96; for (let j = 0; j <= B; j++) for (let i = 0; i <= A; i++) v.push(i / A * Math.PI * 2, -1.2 + j / B * 2.4); for (let j = 0; j < B; j++) for (let i = 0; i < A; i++) { const p = i + j * (A + 1); ix.push(p, p + A + 1, p + 1, p + 1, p + A + 1, p + A + 2); } const a = gl.createVertexArray(); gl.bindVertexArray(a); gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(ix), gl.STATIC_DRAW); return { a, n: ix.length }; })();
  const disc = (() => { const v = [], ix = [], A = 96, B = 160; for (let j = 0; j <= B; j++) { const r = 1.2 * Math.pow(j / B, 2.4); for (let i = 0; i <= A; i++) v.push(r, i / A * Math.PI * 2); } for (let j = 0; j < B; j++) for (let i = 0; i < A; i++) { const p = i + j * (A + 1); ix.push(p, p + 1, p + A + 1, p + 1, p + A + 2, p + A + 1); } const a = gl.createVertexArray(); gl.bindVertexArray(a); gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(ix), gl.STATIC_DRAW); return { a, n: ix.length }; })();
  const lineV = gl.createVertexArray(), lineB = gl.createBuffer(); gl.bindVertexArray(lineV); gl.bindBuffer(gl.ARRAY_BUFFER, lineB); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12); gl.bindVertexArray(null);
  const FRAME = (() => { const o = [], A = 64; for (const y of [-1.2, 1.2]) for (let i = 0; i < A; i++) { const a = i / A * Math.PI * 2, b = (i + 1) / A * Math.PI * 2; o.push(Math.cos(a) * ROUT, y, Math.sin(a) * ROUT, .66, .84, 1, .3, Math.cos(b) * ROUT, y, Math.sin(b) * ROUT, .66, .84, 1, .3); } return new Float32Array(o); })();

  /* ---------- camera */
  const CAM = { yaw: .5, pitch: .3 }; let w = 0, h = 0, dp = 1, drawn = false;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], unit = a => { const l = Math.hypot(...a); return a.map(x => x / l); };
  const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
  function size() { const r = cv.getBoundingClientRect(); w = r.width; h = r.height; if (!w || !h) return; dp = Math.min(devicePixelRatio || 1, 2); cv.width = Math.round(w * dp); cv.height = Math.round(h * dp); gl.viewport(0, 0, cv.width, cv.height); }

  function draw() {
    if (!w) return; drawn = true;
    const a = w / h, far = Math.max(5.4, 5.4 * 1.05 / a), cp = Math.cos(CAM.pitch), eye = [Math.sin(CAM.yaw) * cp * far, Math.sin(CAM.pitch) * far, Math.cos(CAM.yaw) * cp * far], z = unit(sub(eye, [0, 0, 0])), x = unit(cross([0, 1, 0], z)), y = cross(z, x), T = 1 / Math.tan(.42), n = .1, m = 30;
    const lift = narrow ? 0 : -.2;   // on a wide screen the readouts sit over the bottom of the canvas, so the picture rides above them
    const VP = mul([T / a, 0, 0, 0, 0, T, 0, 0, 0, lift, (m + n) / (n - m), -1, 0, 0, 2 * m * n / (n - m), 0], [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
    const W = peak(S.d2), d = Math.sqrt(S.d2);
    gl.clearColor(.039, .086, .157, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(DISC.p); gl.uniformMatrix4fv(DISC.U.uVP, false, VP); gl.uniform1f(DISC.U.uW, W); gl.uniform1f(DISC.U.uD2, S.d2); gl.bindVertexArray(disc.a); gl.drawElements(gl.TRIANGLES, disc.n, gl.UNSIGNED_INT, 0);
    /* the tube's wall is where ω has fallen to 1/e of its peak; a fainter shell marks 1/e⁴, at twice the radius */
    gl.useProgram(TUBE.p); gl.uniformMatrix4fv(TUBE.U.uVP, false, VP); gl.uniform3fv(TUBE.U.uEye, eye); gl.uniform1f(TUBE.U.uW, W); gl.uniform1f(TUBE.U.uStretch, Math.min(S.stretch, 40)); gl.uniform1f(TUBE.U.uPhase, S.phase % (Math.PI * 2 / 3)); gl.bindVertexArray(tube.a);
    const spun = S.running ? Math.abs(W / 2 * SPEED / 60) : 0; gl.uniform1f(TUBE.U.uSpin, spun > .35 ? 0 : 1);   // marks turning too fast to follow would only flicker
    gl.uniform1f(TUBE.U.uR, d); gl.uniform1f(TUBE.U.uAlpha, 1); gl.uniform1f(TUBE.U.uMarks, 1); gl.drawElements(gl.TRIANGLES, tube.n, gl.UNSIGNED_INT, 0);
    gl.depthMask(false); gl.uniform1f(TUBE.U.uR, d * 2); gl.uniform1f(TUBE.U.uAlpha, .13); gl.uniform1f(TUBE.U.uMarks, 0); gl.drawElements(gl.TRIANGLES, tube.n, gl.UNSIGNED_INT, 0);
    gl.useProgram(LINE.p); gl.uniformMatrix4fv(LINE.U.uVP, false, VP); gl.uniform1f(LINE.U.uRound, 0); gl.uniform1f(LINE.U.uPx, 1); gl.bindVertexArray(lineV); gl.bindBuffer(gl.ARRAY_BUFFER, lineB); gl.bufferData(gl.ARRAY_BUFFER, FRAME, gl.DYNAMIC_DRAW); gl.drawArrays(gl.LINES, 0, FRAME.length / 7);
    for (let k = 0; k < NP; k++) { const r = P[k * 3], t = P[k * 3 + 1], q = k * 7, near = Math.exp(-r * r / (S.d2 * 4 + .02)); V[q] = Math.cos(t) * r; V[q + 1] = P[k * 3 + 2]; V[q + 2] = Math.sin(t) * r; V[q + 3] = .66 + .34 * near; V[q + 4] = .84 + .16 * near; V[q + 5] = 1; V[q + 6] = (.42 + .5 * near) * Math.min(1, (ZOUT - Math.abs(V[q + 1])) * 8); }
    gl.uniform1f(LINE.U.uRound, 1); gl.uniform1f(LINE.U.uPx, 2.4 * dp); gl.bufferData(gl.ARRAY_BUFFER, V, gl.DYNAMIC_DRAW); gl.drawArrays(gl.POINTS, 0, NP);
    gl.depthMask(true); gl.bindVertexArray(null);
  }

  /* ---------- the panel */
  const TITLE = { flat: 'Lamb-Oseen vortex', strain: "Burgers' vortex", feed: 'Stretching on cue' };
  const fmt = v => v >= 1000 ? Math.round(v).toLocaleString('en-US') : v >= 10 ? v.toFixed(1) : v >= 1 ? v.toFixed(2) : v.toPrecision(2);
  function statusText() {
    if (S.kase === 'flat') return S.nu ? 'No stretching. Viscosity widens the core and the peak falls.' : 'No stretching and no viscosity. Nothing changes the core at all.';
    if (S.kase === 'strain') return S.nu ? `The core settles at δ = ${Math.sqrt(4 * S.nu / S.alpha).toFixed(2)}, where viscosity balances stretching.` : 'No viscosity. The peak grows exponentially, with no finite time at which it reaches infinity.';
    const line = 4 * S.nu;
    if (S.blown) return `Peak ω is infinite at t = ${(D0 / (S.G - line)).toFixed(1)}. A formula can get there. A screen can't.`;
    if (S.G > line) return `G is above 4ν = ${line.toFixed(4)}, so the core reaches zero at t = ${(D0 / (S.G - line)).toFixed(1)}. The strain is supplied by hand.`;
    return `G is not above 4ν = ${line.toFixed(4)}, so the vortex ${S.G === line ? 'holds its width' : 'spreads'} and never blows up.`;
  }
  function label() {
    $('rtitle').textContent = TITLE[S.kase]; $('status').textContent = statusText();
    $('kstrain').hidden = S.kase !== 'strain'; $('kfeed').hidden = S.kase !== 'feed';
    document.querySelectorAll('#cases button').forEach(b => b.setAttribute('aria-pressed', b.dataset.case === S.kase));
    $('onu').textContent = S.nu.toFixed(4); $('ostrain').textContent = S.alpha.toFixed(2); $('ofeed').textContent = S.G.toFixed(4);
    cv.setAttribute('aria-label', `${TITLE[S.kase]}, a vortex tube in 3D. ${statusText()}`);
  }
  function chart() {
    const top = 1000, low = .1, X = 300, Y = 64, tm = S.kase === 'feed' && isFinite(S.T) ? S.T * 1.02 : Math.max(20, S.t * 1.05), py = v => (1 - Math.log(Math.min(top, Math.max(low, v)) / low) / Math.log(top / low)) * (Y - 2) + 1;
    let pts = ''; for (const [t, v] of S.trace) pts += `${(t / tm * X).toFixed(1)},${py(v).toFixed(1)} `;
    const grid = [1, 10, 100].map(v => `<line x1="0" x2="${X}" y1="${py(v)}" y2="${py(v)}" stroke="rgba(168,213,255,.18)" vector-effect="non-scaling-stroke"/>`).join('');
    const lim = S.kase === 'feed' && isFinite(S.T) ? `<line x1="${S.T / tm * X}" x2="${S.T / tm * X}" y1="0" y2="${Y}" stroke="#FF8A5C" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>` : '';
    $('chart').innerHTML = grid + lim + `<polyline points="${pts}" fill="none" stroke="#64C8FF" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
    $('nt').textContent = S.t.toFixed(1); $('nd').textContent = S.blown ? '0' : Math.sqrt(S.d2).toFixed(3); $('nw').textContent = S.blown ? '∞' : fmt(peak(S.d2));
  }

  function setCase(k) { if (k === S.kase) return; S.kase = k; restart(); chart(); if (!S.running) { still(); draw(); } }
  /* with motion reduced, show each case as one held frame partway through, and let Play run it */
  function still() { if (!calm) return; const T = S.kase === 'feed' ? blowTime(S.nu, S.G) : Infinity, t = isFinite(T) ? T * .8 : 18; for (let k = 0; k < 60; k++) advance(t / 60); chart(); }
  document.querySelectorAll('#cases button').forEach(b => b.onclick = () => setCase(b.dataset.case));
  for (const [id, key] of [['nu', 'nu'], ['strain', 'alpha'], ['feed', 'G']]) $(id).oninput = e => { S[key] = parseFloat(e.target.value); restart(); label(); chart(); if (calm && !S.running) { still(); draw(); } };
  $('run').onclick = () => { S.running = !S.running; $('run').textContent = S.running ? 'Pause' : 'Play'; };
  $('restart').onclick = () => { restart(); chart(); draw(); };
  if (!S.running) $('run').textContent = 'Play';

  /* the story picks the case as each section reaches the middle of the screen; the buttons still work in between */
  const seen = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting && e.target.dataset.case) setCase(e.target.dataset.case); }, { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('#story section').forEach(s => seen.observe(s));

  /* drag turns it. On a touch screen, vertical drags stay with the page so the story can scroll */
  let grab = null;
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); grab = { x: e.clientX, y: e.clientY, yaw: CAM.yaw, pitch: CAM.pitch }; cv.classList.add('drag'); });
  cv.addEventListener('pointermove', e => { if (!grab) return; CAM.yaw = grab.yaw + (e.clientX - grab.x) / w * 3.2; CAM.pitch = Math.max(-.2, Math.min(1.3, grab.pitch + (e.clientY - grab.y) / h * 1.8)); if (!S.running) draw(); });
  const drop = () => { grab = null; cv.classList.remove('drag'); }; cv.addEventListener('pointerup', drop); cv.addEventListener('pointercancel', drop);
  cv.addEventListener('keydown', e => { const k = { ArrowLeft: [-.08, 0], ArrowRight: [.08, 0], ArrowUp: [0, .05], ArrowDown: [0, -.05] }[e.key]; if (!k) return; e.preventDefault(); CAM.yaw += k[0]; CAM.pitch = Math.max(-.2, Math.min(1.3, CAM.pitch + k[1])); if (!S.running) draw(); });
  if (narrow) $('knobs').open = false;

  let last = 0;
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
    if (S.running) {
      if (S.blown || S.t >= TMAX) { S.hold += dt; if (S.hold > HOLD) restart(); }
      else advance(dt * SPEED);
      if (!grab) CAM.yaw += dt * .06;
      if (S.frame++ % 6 === 0) chart();
      draw();
    } else if (!drawn) draw();
    requestAnimationFrame(frame);
  }
  new ResizeObserver(() => { size(); draw(); }).observe(cv); size(); restart(); still(); chart(); draw(); requestAnimationFrame(frame);

  /* console check: integrate dδ²/dt = 4ν - αδ² and the vorticity equation on the axis by hand, and compare with the closed forms used above */
  return { S, CAM, draw, advance, setCase, restart, check() {
    const out = {}, keep = { kase: S.kase }; const runs = [['flat', 40], ['strain', 40], ['feed', 8]];
    for (const [k, tEnd] of runs) { S.kase = k; let d2 = D0, st = 0; const N = 400000, h = tEnd / N; for (let i = 0; i < N; i++) { const a = k === 'flat' ? 0 : k === 'strain' ? S.alpha : S.G / d2, f = y => 4 * S.nu - (k === 'feed' ? S.G / y : a) * y; const m = d2 + f(d2) * h / 2; d2 += f(m) * h; const a2 = k === 'flat' ? 0 : k === 'strain' ? S.alpha : S.G / m; st += a2 * h; } const c = coreAt(k, tEnd); out[k] = { d2Error: Math.abs(c.d2 - d2) / d2, stretchError: st ? Math.abs(c.stretch - st) / st : 0 }; }
    S.kase = keep.kase; const r = .3, dl = 1e-4, d2 = .05; const omega = x => Math.exp(-x * x / d2) / (Math.PI * d2), a = .1, nu = .001, dd = 4 * nu - a * d2; const dwdt = omega(r) * (-1 / d2 + r * r / (d2 * d2)) * dd, rhs = (a * r / 2) * (omega(r + dl) - omega(r - dl)) / (2 * dl) + a * omega(r) + nu * ((omega(r + dl) - 2 * omega(r) + omega(r - dl)) / (dl * dl) + (omega(r + dl) - omega(r - dl)) / (2 * dl * r)); out.vorticityEquationResidual = Math.abs(dwdt - rhs) / Math.abs(rhs);
    out.glError = gl.getError(); return out; } };
})();
