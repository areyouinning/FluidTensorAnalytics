/* Fluid Tensor Analytics: the shared 3D scene, in raw WebGL2. A page is a list of plain links (ul#tools); this script turns it into
   a sea with a buoy for each link, and without WebGL2 the list stays a normal page of cards.

   The water is a real 2D wave equation, u_tt = c^2 lap u - damping, stepped on the CPU and drawn as a height field.
   body[data-scene] picks what's special about a page:
     analytics  rain now and then
     fluid      a source moving around a circle stirs the water, as well as the rain
     tensor     a floating 3x3x3 tensor whose 27 entries read the height of the water, and a stronger grid
     home       big buoys, and the tensor */
'use strict';
window.FTA = (() => {
  const SCENES = {
    analytics: { ring: 1.02, size: 1, rain: [450, 900], grid: .11, hint: 'Drag to look around. Click the water to drop a stone.' },
    fluid: { ring: 1.02, size: 1.1, rain: [900, 1500], grid: .08, paddle: true, hint: 'A moving source stirs a live wave equation. Drag to look around.' },
    tensor: { ring: .8, size: 1.15, rain: [600, 1100], grid: .24, lattice: true, hint: 'Each of the 27 entries in this 3×3×3 tensor reads the water below it. Drag to look around.' },
    home: { ring: .8, size: 1.25, rain: [600, 1100], grid: .13, lattice: true, hint: 'Drag to look around. Click the water to drop a stone.' }
  };
  const CFG = SCENES[document.body.dataset.scene] || SCENES.analytics;
  const cv = document.createElement('canvas');
  const gl = cv.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'low-power' });
  if (!gl) return null;
  cv.id = 'sea'; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'A dark sea in 3D with a labeled buoy for each link, rippling where you touch it');
  document.body.prepend(cv); document.body.classList.add('scene');
  const panel = document.createElement('aside'); panel.id = 'panel'; panel.setAttribute('aria-label', 'Selected link');
  panel.innerHTML = '<div id="ptext" aria-live="polite"><b></b><span></span></div><div class="row"><button class="arrow" id="prev" aria-label="Previous"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></button><a id="open" href="#">Open</a><button class="arrow" id="next" aria-label="Next"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg></button></div>';
  const hint = document.createElement('p'); hint.id = 'hint';
  document.body.append(panel, hint);

  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches, small = innerWidth < 720;
  const N = small ? 121 : 181, SPAN = 6, C2 = .23, DAMP = .9968, SUB = 2;
  const u = new Float32Array(N * N), v = new Float32Array(N * N), sponge = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const e = Math.min(i, j, N - 1 - i, N - 1 - j); sponge[j * N + i] = e < 14 ? .86 + .14 * e / 14 : 1; }   // absorb at the edge, so waves leave and don't bounce back
  function step() {
    for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) { const k = j * N + i; v[k] = (v[k] + C2 * (u[k - 1] + u[k + 1] + u[k - N] + u[k + N] - 4 * u[k])) * DAMP * sponge[k]; }
    for (let k = 0; k < N * N; k++) u[k] += v[k];
  }
  const toGrid = x => (x / SPAN + .5) * (N - 1);
  function drop(x, z, amp, r) { const cx = toGrid(x), cz = toGrid(z), R = Math.ceil(r * 2.5); for (let j = Math.max(1, Math.floor(cz - R)); j <= Math.min(N - 2, cz + R); j++) for (let i = Math.max(1, Math.floor(cx - R)); i <= Math.min(N - 2, cx + R); i++) { const d = (i - cx) ** 2 + (j - cz) ** 2; u[j * N + i] -= amp * Math.exp(-d / (r * r)); } }
  const heightAt = (x, z) => { const i = Math.max(0, Math.min(N - 1, Math.round(toGrid(x)))), j = Math.max(0, Math.min(N - 1, Math.round(toGrid(z)))); return u[j * N + i]; };

  /* ---------- a little linear algebra */
  const persp = (t, a, n, r) => [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (r + n) / (n - r), -1, 0, 0, 2 * r * n / (n - r), 0];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], unit = a => { const l = Math.hypot(...a); return a.map(x => x / l); };
  const look = (e, x, y, z) => [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1];
  const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
  const color = name => { const s = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16) / 255); };
  const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;

  const HS = 2.5;   // drawn heights and slopes are exaggerated by this, so small waves can be seen; the solver's numbers are untouched
  const prog = (vs, fs) => { const mk = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }, p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); const U = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); U[a.name] = gl.getUniformLocation(p, a.name); } return { p, U }; };
  const WATER = prog(`#version 300 es
    layout(location=0) in vec3 aP; layout(location=1) in vec2 aN; uniform mat4 uVP; out vec3 vP; out vec3 vN;
    void main(){ vP=vec3(aP.x,aP.y*${HS.toFixed(1)},aP.z); vN=normalize(vec3(aN*${HS.toFixed(1)},1.).xzy); gl_Position=uVP*vec4(vP,1.); }`, `#version 300 es
    precision highp float; in vec3 vP; in vec3 vN; uniform vec3 uEye,uNight,uDusk,uCyan,uIce; uniform float uGrid; out vec4 o;
    void main(){ vec3 N=normalize(vN), V=normalize(uEye-vP), R=reflect(-V,N), L=normalize(vec3(-.4,.42,-.8));
      float F=.03+.5*pow(1.-max(dot(N,V),0.),5.); vec3 sky=mix(uDusk*1.5,uDusk,smoothstep(.0,.5,R.y)); vec3 deep=mix(uNight,uDusk,clamp(.42+vP.y*9.,0.,1.));
      vec3 c=mix(deep,sky,F); c+=uIce*pow(max(dot(R,L),0.),300.)*.9*smoothstep(.015,.09,length(N.xz));   /* glints on slopes only, or flat water shows one fixed patch of glare */
      vec2 s=vP.xz*5.; vec2 g=abs(fract(s-.5)-.5)/max(fwidth(s),vec2(1e-4)); float line=1.-min(min(g.x,g.y),1.); c+=uCyan*line*uGrid;   /* the grid makes the shape of each wave legible */
      c+=uCyan*smoothstep(.003,.05,abs(vP.y))*.2;
      float d=length(vP-uEye); float edge=smoothstep(2.1,2.95,max(abs(vP.x),abs(vP.z))); o=vec4(mix(c,uDusk,max(smoothstep(2.4,4.6,d),edge)),1.); }`);
  const BUOY = prog(`#version 300 es
    layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; uniform mat4 uVP; uniform vec3 uAt; uniform vec2 uTilt; uniform float uS; out vec3 vN; out float vY;
    void main(){ vec3 n=normalize(vec3(uTilt.x,1.,uTilt.y)); vec3 t=normalize(cross(n,vec3(0.,0.,1.))); vec3 b=cross(t,n); mat3 M=mat3(t,n,b); vN=M*aN; vY=aP.y; gl_Position=uVP*vec4(uAt+M*(aP*uS),1.); }`, `#version 300 es
    precision highp float; in vec3 vN; in float vY; uniform vec3 uBase,uGlow; uniform float uOn; out vec4 o;
    void main(){ vec3 N=normalize(vN); float l=.32+.68*max(dot(N,normalize(vec3(-.45,.7,.55))),0.); vec3 c=uBase*l; c=mix(c,uGlow,smoothstep(.135,.16,vY)*(.55+.45*uOn)); c+=uGlow*uOn*.25; o=vec4(c,1.); }`);

  /* ---------- geometry: the sheet of water, and one buoy turned on a lathe */
  const sea = new Float32Array(N * N * 5);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = (j * N + i) * 5; sea[k] = (i / (N - 1) - .5) * SPAN; sea[k + 2] = (j / (N - 1) - .5) * SPAN; }
  const idx = new Uint16Array((N - 1) * (N - 1) * 6); { let q = 0; for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) { const a = j * N + i, b = a + 1, c = a + N, d = c + 1; idx.set([a, c, b, b, c, d], q); q += 6; } }
  const vaoSea = gl.createVertexArray(), vboSea = gl.createBuffer(); gl.bindVertexArray(vaoSea); gl.bindBuffer(gl.ARRAY_BUFFER, vboSea); gl.bufferData(gl.ARRAY_BUFFER, sea, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  const PROFILE = [[0, -.03], [.05, -.03], [.075, 0], [.075, .025], [.03, .05], [.018, .055], [.018, .135], [.035, .14], [.035, .165], [.02, .18], [0, .185]], SIDES = 18, bv = [], bi = [];
  PROFILE.forEach((p, r) => { const a = PROFILE[Math.max(0, r - 1)], b = PROFILE[Math.min(PROFILE.length - 1, r + 1)], nr = b[1] - a[1], ny = a[0] - b[0], l = Math.hypot(nr, ny) || 1; for (let s = 0; s < SIDES; s++) { const t = s / SIDES * 6.28318; bv.push(p[0] * Math.cos(t), p[1], p[0] * Math.sin(t), nr / l * Math.cos(t), ny / l, nr / l * Math.sin(t)); } });
  for (let r = 0; r < PROFILE.length - 1; r++) for (let s = 0; s < SIDES; s++) { const a = r * SIDES + s, b = r * SIDES + (s + 1) % SIDES, c = a + SIDES, d = b + SIDES; bi.push(a, b, c, b, d, c); }
  const vaoB = gl.createVertexArray(); gl.bindVertexArray(vaoB); gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(bv), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(bi), gl.STATIC_DRAW);

  /* ---------- the tensor: 27 entries in a cube, each reading the water under its own spot. Lines are drawn in the same pass */
  let TENSOR = null;
  if (CFG.lattice) {
    const STEP = .135, Y0 = .3, nodes = [], at = (i, j, k) => i * 9 + j * 3 + k, seg = [];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) { nodes.push({ x: (i - 1) * STEP, y: Y0 + (j - 1) * STEP, z: (k - 1) * STEP, sx: (i - 1) * .62 + (j - 1) * .17, sz: (k - 1) * .62 - (j - 1) * .17 }); if (i < 2) seg.push(at(i, j, k), at(i + 1, j, k)); if (j < 2) seg.push(at(i, j, k), at(i, j + 1, k)); if (k < 2) seg.push(at(i, j, k), at(i, j, k + 1)); }
    const P = prog(`#version 300 es
      layout(location=0) in vec3 aP; layout(location=1) in float aV; uniform mat4 uVP; uniform float uPx,uLine; out float vV;
      void main(){ vV=aV; gl_Position=uVP*vec4(aP,1.); gl_PointSize=uLine>.5?1.:uPx*(.55+.75*abs(aV))/gl_Position.w; }`, `#version 300 es
      precision highp float; in float vV; uniform vec3 uHi,uLo,uRest; uniform float uLine; out vec4 o;
      void main(){ vec3 c=mix(uRest,vV>0.?uHi:uLo,clamp(abs(vV),0.,1.)); if(uLine>.5){ o=vec4(c,.5); return; } vec2 q=gl_PointCoord*2.-1.; float r=dot(q,q); if(r>1.) discard; o=vec4(c*(.75+.25*(1.-r)),1.); }`);
    const vao = gl.createVertexArray(), vbo = gl.createBuffer(), data = new Float32Array(27 * 4); nodes.forEach((n, i) => { data.set([n.x, n.y, n.z, 0], i * 4); }); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 16, 12); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(seg), gl.STATIC_DRAW);
    TENSOR = { P, vao, vbo, data, nodes, count: seg.length };
  }

  /* ---------- the buoys: one for each link, on a ring you orbit */
  const items = [...document.querySelectorAll('#tools li')], TAU = Math.PI * 2, RING = CFG.ring;
  const BUOYS = items.map((li, i) => { const a = li.querySelector('a'), th = i / items.length * TAU; return { li, a, th, x: Math.sin(th) * RING, z: Math.cos(th) * RING, lead: li.classList.contains('lead'), puzzle: li.classList.contains('puzzle'), name: a.querySelector('b').textContent, text: a.querySelector('span').textContent, on: 0, want: 0, sx: 0, sy: 0 }; });
  let sel = 0, yaw = 0, yawGoal = 0, lastPointer = 'mouse', W = 1, H = 1, T = 1, EYE = [0, 1, 2], BASIS = null, VP = null;
  const panelB = document.querySelector('#ptext b'), panelS = document.querySelector('#ptext span'), open = document.getElementById('open');
  function select(i, wave) { sel = (i + BUOYS.length) % BUOYS.length; const b = BUOYS[sel]; BUOYS.forEach((q, k) => { q.want = k === sel ? 1 : 0; q.li.classList.toggle('on', k === sel); }); panelB.textContent = b.name; panelS.textContent = b.text; open.href = b.a.getAttribute('href'); open.textContent = `Open ${b.name}`; let d = (b.th - yawGoal) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; yawGoal += d; if (calm) yaw = yawGoal; if (wave !== false) drop(b.x, b.z, .05, 3.2); kick(); }
  BUOYS.forEach((b, i) => { b.a.addEventListener('focus', () => { if (sel !== i) select(i); }); b.a.addEventListener('pointerdown', e => { lastPointer = e.pointerType; }); b.a.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { b.want = 1; kick(); } }); b.a.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && sel !== i) { b.want = 0; kick(); } }); b.a.addEventListener('click', e => { if (lastPointer !== 'mouse' && sel !== i) { e.preventDefault(); select(i); } }); });
  document.getElementById('prev').onclick = () => select(sel - 1);
  document.getElementById('next').onclick = () => select(sel + 1);
  addEventListener('keydown', e => { if (e.key === 'ArrowRight') select(sel + 1); if (e.key === 'ArrowLeft') select(sel - 1); });

  /* ---------- the camera */
  function placeCamera() { const a = W / H, r = a < .8 ? 3.35 : 2.55, h = a < .8 ? 1.5 : 1.05, s = Math.sin(yaw), c = Math.cos(yaw); EYE = [s * r, h, c * r]; const at = [s * .35, a < .8 ? -.1 : -.08, c * .35], z = unit(sub(EYE, at)), x = unit(cross([0, 1, 0], z)), y = cross(z, x); BASIS = { x, y, z }; VP = mul(persp(T, a, .1, 20), look(EYE, x, y, z)); }
  const introEl = document.querySelector('.intro'); let CARD = null;
  const measureLabels = () => { BUOYS.forEach(b => { b.w = b.li.offsetWidth; b.h = b.li.offsetHeight; }); CARD = introEl.getBoundingClientRect(); };   // read once, not every frame; labels are nudged back on screen, and out from under the intro card, with these
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureLabels);
  function resize() { measureLabels(); const dp = Math.min(devicePixelRatio || 1, small ? 1.5 : 2); W = innerWidth; H = innerHeight; cv.width = Math.round(W * dp); cv.height = Math.round(H * dp); gl.viewport(0, 0, cv.width, cv.height); T = 1 / Math.tan((W / H < .8 ? .9 : .72) / 2); placeCamera(); kick(); }
  function pick(px, py) { const a = W / H, nx = (px / W * 2 - 1) * a / T, ny = (1 - py / H * 2) / T, { x, y, z } = BASIS, d = unit([x[0] * nx + y[0] * ny - z[0], x[1] * nx + y[1] * ny - z[1], x[2] * nx + y[2] * ny - z[2]]); if (d[1] >= -.01) return null; const t = -EYE[1] / d[1], wx = EYE[0] + d[0] * t, wz = EYE[2] + d[2] * t; return Math.abs(wx) < SPAN / 2 && Math.abs(wz) < SPAN / 2 ? [wx, wz] : null; }

  /* ---------- the pointer: drag to orbit, tap a buoy to pick it, tap the water to drop a stone */
  let dragging = null;
  cv.addEventListener('pointerdown', e => { dragging = { x: e.clientX, y0: yawGoal, moved: 0 }; cv.setPointerCapture(e.pointerId); cv.classList.add('drag'); });
  cv.addEventListener('pointermove', e => { if (!dragging) return; const dx = e.clientX - dragging.x; dragging.moved = Math.max(dragging.moved, Math.abs(dx)); if (dragging.moved > 6) { yawGoal = dragging.y0 - dx / W * 4; if (calm) yaw = yawGoal; kick(); } });
  cv.addEventListener('pointerup', e => { const d = dragging; dragging = null; cv.classList.remove('drag'); if (!d || d.moved > 6) return; let best = -1, bd = 44; BUOYS.forEach((b, i) => { const q = Math.hypot(b.sx - e.clientX, b.sy - e.clientY); if (q < bd) { bd = q; best = i; } }); if (best >= 0) { select(best); return; } const p = pick(e.clientX, e.clientY); if (p) { drop(p[0], p[1], .08, 3.6); kick(); } });
  cv.addEventListener('pointercancel', () => { dragging = null; cv.classList.remove('drag'); });

  /* ---------- drawing */
  const ice = color('--c-ice'), cyan = color('--c-cyan'), night = color('--c-night'), dusk = color('--c-dusk'), coral = color('--c-coral'), pale = color('--c-pale'), mint = color('--c-mint');
  const clip = (p, w) => VP[p] * w[0] + VP[p + 4] * w[1] + VP[p + 8] * w[2] + VP[p + 12];
  function drawTensor() {
    const X = TENSOR; X.nodes.forEach((n, i) => { X.data[i * 4 + 3] = Math.max(-1, Math.min(1, heightAt(n.sx, n.sz) * 160)); });
    gl.useProgram(X.P.p); gl.uniformMatrix4fv(X.P.U.uVP, false, VP); gl.uniform3fv(X.P.U.uHi, coral); gl.uniform3fv(X.P.U.uLo, cyan); gl.uniform3fv(X.P.U.uRest, ice); gl.uniform1f(X.P.U.uPx, Math.max(30, H * .075));
    gl.bindVertexArray(X.vao); gl.bindBuffer(gl.ARRAY_BUFFER, X.vbo); gl.bufferSubData(gl.ARRAY_BUFFER, 0, X.data);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.uniform1f(X.P.U.uLine, 1); gl.drawElements(gl.LINES, X.count, gl.UNSIGNED_SHORT, 0); gl.disable(gl.BLEND); gl.depthMask(true);
    gl.uniform1f(X.P.U.uLine, 0); gl.drawArrays(gl.POINTS, 0, 27);
  }
  function render() {
    yaw += (yawGoal - yaw) * (calm ? 1 : .07); placeCamera();
    const SC = SPAN / (N - 1); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = j * N + i, q = k * 5, l = u[i > 0 ? k - 1 : k], r = u[i < N - 1 ? k + 1 : k], d = u[j > 0 ? k - N : k], t = u[j < N - 1 ? k + N : k]; sea[q + 1] = u[k]; sea[q + 3] = (l - r) / (2 * SC); sea[q + 4] = (d - t) / (2 * SC); }
    gl.clearColor(...dusk, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST);
    gl.useProgram(WATER.p); gl.uniformMatrix4fv(WATER.U.uVP, false, VP); gl.uniform3fv(WATER.U.uEye, EYE); gl.uniform3fv(WATER.U.uNight, night); gl.uniform3fv(WATER.U.uDusk, dusk); gl.uniform3fv(WATER.U.uCyan, cyan); gl.uniform3fv(WATER.U.uIce, ice); gl.uniform1f(WATER.U.uGrid, CFG.grid);
    gl.bindVertexArray(vaoSea); gl.bindBuffer(gl.ARRAY_BUFFER, vboSea); gl.bufferSubData(gl.ARRAY_BUFFER, 0, sea); gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
    gl.useProgram(BUOY.p); gl.uniformMatrix4fv(BUOY.U.uVP, false, VP); gl.bindVertexArray(vaoB);
    const reach = Math.hypot(EYE[0], EYE[2]), near = reach - RING, far = reach + RING;
    BUOYS.forEach(b => { b.on += (b.want - b.on) * (calm ? 1 : .14); const y = heightAt(b.x, b.z) * HS, e = .05, tx = (heightAt(b.x - e, b.z) - heightAt(b.x + e, b.z)) / (2 * e) * HS, tz = (heightAt(b.x, b.z - e) - heightAt(b.x, b.z + e)) / (2 * e) * HS, S = CFG.size * (b.puzzle ? .78 : 1) * (1 + .22 * b.on);
      gl.uniform3f(BUOY.U.uAt, b.x, y + .02, b.z); gl.uniform2f(BUOY.U.uTilt, tx * .8, tz * .8); gl.uniform1f(BUOY.U.uS, S); gl.uniform3fv(BUOY.U.uBase, pale); gl.uniform3fv(BUOY.U.uGlow, b.lead ? coral : b.puzzle ? mint : cyan); gl.uniform1f(BUOY.U.uOn, b.on); gl.drawElements(gl.TRIANGLES, bi.length, gl.UNSIGNED_SHORT, 0);
      /* the label rides above its buoy, smaller and fainter with distance; back-of-ring labels step aside on narrow screens */
      const w = [b.x, y + .02 + .22 * S, b.z], cw = clip(3, w), sx = (clip(0, w) / cw * .5 + .5) * W, sy = (.5 - clip(1, w) / cw * .5) * H, depth = clamp01((far - Math.hypot(b.x - EYE[0], b.z - EYE[2])) / (far - near)), mid = [b.x, y + .1, b.z]; b.sx = sx; b.sy = (.5 - clip(1, mid) / clip(3, mid) * .5) * H;
      const onScreen = W / H < .8 ? (depth > .62 || b.want || BUOYS.length < 6) : true, scale = (.78 + .32 * depth) * (b.want ? 1.08 : 1), alpha = onScreen ? (.42 + .58 * depth) : 0, half = (b.w || 0) * scale / 2 + 6, tall = (b.h || 0) * scale; let lx = half * 2 < W ? Math.max(half, Math.min(W - half, sx)) : W / 2, ly = sy; if (CARD && lx - half < CARD.right && ly - tall < CARD.bottom + 4) { if (CARD.right + half * 2 + 6 < W) lx = CARD.right + half + 6; else ly = CARD.bottom + tall + 6; } b.li.style.transform = `translate(${lx.toFixed(1)}px, ${ly.toFixed(1)}px) translate(-50%, -100%) scale(${scale.toFixed(3)})`; b.li.style.opacity = b.want ? 1 : alpha.toFixed(2); b.li.style.zIndex = b.want ? 1000 : Math.round(depth * 900); b.li.classList.toggle('far', !onScreen); });
    if (TENSOR) drawTensor();
    gl.bindVertexArray(null);
  }
  /* ---------- the loop: rain now and then, no work when hidden, still frames for people who ask for less motion */
  let nextDrop = 0, phase = 0, rnd = 12345; const R = () => { rnd = (Math.imul(rnd, 1664525) + 1013904223) >>> 0; return rnd / 4294967296; };
  function kick() { if (!calm || !VP) return; for (let i = 0; i < 12; i++) step(); render(); }
  function raindrop() { drop((R() - .5) * SPAN * .7, (R() - .5) * SPAN * .7, .02 + R() * .03, 1.6 + R() * 1.8); }
  /* the fluid page's moving source: a small push travelling on a circle, slower than the waves it makes */
  function paddle() { phase += .018; drop(Math.cos(phase) * .55, Math.sin(phase) * .55, .02, 2.4); }
  function advance() { if (CFG.paddle) paddle(); for (let i = 0; i < SUB; i++) step(); }
  function frame(t) { requestAnimationFrame(frame); if (document.hidden || calm) return; if (t > nextDrop) { raindrop(); nextDrop = t + CFG.rain[0] + R() * CFG.rain[1]; } advance(); render(); }
  addEventListener('resize', resize);
  cv.addEventListener('webglcontextlost', e => { e.preventDefault(); document.body.classList.remove('scene'); cv.remove(); panel.remove(); hint.remove(); items.forEach(li => { li.removeAttribute('style'); li.classList.remove('far'); }); });
  resize(); for (let i = 0; i < 8; i++) raindrop(); for (let i = 0; i < 120; i++) { if (CFG.paddle) paddle(); step(); if (i % 25 === 0) raindrop(); } select(0, false); render();
  hint.textContent = calm ? 'A still frame of a live wave equation. Drag to look around.' : CFG.hint;
  requestAnimationFrame(frame);
  /* console checks: step without the display loop, and read the sea */
  return { tick: n => { for (let i = 0; i < n; i++) { advance(); render(); } }, drop, select, peak: () => u.reduce((a, x) => Math.max(a, Math.abs(x)), 0), tensor: () => TENSOR && [...TENSOR.data].filter((_, i) => i % 4 === 3), BUOYS, N, pick, get sel() { return sel; }, glError: () => gl.getError() };
})();
