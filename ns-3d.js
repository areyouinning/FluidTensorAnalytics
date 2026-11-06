/* The 3D surface view for the 2D Navier-Stokes tool, in raw WebGL2. It reads the solver's own arrays and calls its own addForce and
   addVortexAt: nothing here changes the solver, and the 2D view stays one click away.

   The flow is two-dimensional. Height is a display of the chosen field, one vertex per grid cell with no smoothing, stretched so the
   largest recent value reaches full height. This flow loses most of its strength within seconds, so like the 2D view's colors the
   stretch follows it down, over about a second so the surface doesn't jump. The legend prints what full height currently means. */
'use strict';
window.NS3D = (() => {
  const probe = document.createElement('canvas').getContext('webgl2');
  if (!probe) return null;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches, N = fluid.N, W = N + 2, HS = .46, BASE = -.52, STEP = innerWidth < 720 ? 2 : 1, LIFT = .007;
  const PX_PER_CELL = 3;   // the 2D view's force is per canvas pixel, at about this many pixels to a cell on a typical window
  const TAU = 800, BG = [.055, .075, .12];   // the stretch relaxes with this time constant, in ms
  const CAM = { yaw: -.55, pitch: .78, zoom: 1 }, STATE = { on: true, mode: null, scale: 1, last: 0, pushes: true, frame: 0, divShare: 0 };
  const F = new Float32Array(N * N * 4);
  const persp = (t, a, n, r) => [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (r + n) / (n - r), -1, 0, 0, 2 * r * n / (n - r), 0];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], unit = a => { const l = Math.hypot(...a); return a.map(x => x / l); };
  const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
  const worldX = g => (g - .5) / N * 2 - 1;   // g is a solver coordinate, where cell i has its center at i

  /* ---------- the page around it */
  const style = document.createElement('style');
  style.textContent = `.ns3d{position:absolute;inset:0;width:100%;height:100%;display:block;z-index:1;cursor:crosshair;touch-action:none;image-rendering:auto}.ns3d.turn{cursor:grab}.ns3d.drag{cursor:grabbing}.ns3d:focus-visible{outline:2px solid var(--accent-primary);outline-offset:-2px}
  body.view-2d .ns3d,body.view-2d .ns-legend,body.view-2d .ns-drag{display:none}
  .ns-view{display:flex;gap:.5rem;margin-left:auto}.ns-view-btn,.ns-drag{font-family:'JetBrains Mono',monospace;font-size:.75rem;padding:.5rem 1rem;min-height:36px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:4px;color:var(--text-secondary);cursor:pointer}.ns-view-btn:hover,.ns-drag:hover{border-color:var(--accent-primary);color:var(--accent-primary)}.ns-view-btn.active{background:var(--accent-tertiary);border-color:var(--accent-tertiary);color:#fff;font-weight:600}
  .ns-drag{position:absolute;right:12px;bottom:12px;z-index:6;background:rgba(10,14,23,.9);color:var(--text-primary)}
  .ns-legend{position:absolute;right:12px;top:12px;z-index:6;width:230px;max-width:calc(100% - 24px);padding:.6rem .7rem;background:rgba(10,14,23,.88);border:1px solid var(--border);border-radius:6px;font-family:'JetBrains Mono',monospace;font-size:.68rem;line-height:1.45;color:var(--text-secondary);pointer-events:none}.ns-legend b{display:block;color:var(--text-primary);font-weight:600;font-size:.74rem}.ns-strip{height:10px;border-radius:2px;margin:.35rem 0 .15rem}.ns-ends{display:flex;justify-content:space-between}.ns-legend p{margin:.3rem 0 0}.ns-read{color:var(--accent-primary)}
  .interaction-hint.done{display:none}.canvas-container{min-height:0}.simulation-panel{min-height:0;min-width:0}
  @media (max-width:860px){body{overflow:auto}.container{height:auto;min-height:100vh}header{padding:1rem}.main-content{flex-direction:column;padding:1rem;gap:1rem;overflow:visible}.simulation-panel{flex:none}.canvas-container{flex:none;height:min(100vw,68vh)}.controls-panel{width:100%;overflow:visible}.visualization-modes{flex-wrap:nowrap;overflow-x:auto;padding-bottom:2px}.mode-btn{flex:none}.mode-btn[title]:hover::after,.mode-btn[title]:hover::before{display:none}.ns-view{margin-left:0;flex:none;order:-1}.ns-view-btn,.ns-drag,.mode-btn,.btn{min-height:44px}.ns-drag{padding:.4rem .6rem;right:8px;bottom:8px}.ns-legend{width:190px;font-size:.62rem;padding:.4rem .5rem}.ns-legend p{display:none}.ns-legend p.keep{display:block}.interaction-hint{left:8px;bottom:8px;max-width:calc(100% - 170px);padding:.4rem .5rem;font-size:.62rem}}`;
  document.head.append(style);
  const host = canvas.parentElement, bar = document.querySelector('.visualization-modes'), hint = host.querySelector('.interaction-hint'), hint2D = hint.innerHTML, pauseBtn = document.getElementById('pause-btn');
  const cv = document.createElement('canvas'); cv.className = 'ns3d'; cv.tabIndex = 0; cv.setAttribute('role', 'img'); host.insertBefore(cv, canvas.nextSibling);
  const view = document.createElement('div'); view.className = 'ns-view'; view.setAttribute('role', 'group'); view.setAttribute('aria-label', 'View');
  view.innerHTML = '<button class="ns-view-btn active" id="view-3d" aria-pressed="true">3D Surface</button><button class="ns-view-btn" id="view-2d" aria-pressed="false">2D Field</button>'; bar.append(view);
  const legend = document.createElement('div'); legend.className = 'ns-legend'; host.append(legend);
  const dragBtn = document.createElement('button'); dragBtn.className = 'ns-drag'; dragBtn.textContent = 'Drag: pushes water'; dragBtn.setAttribute('aria-label', 'Change what dragging on the water does'); host.append(dragBtn);
  const view3d = document.getElementById('view-3d'), view2d = document.getElementById('view-2d');
  const HINT3D = matchMedia('(pointer: coarse)').matches ? '<strong>Tap</strong>: vortex pair<br><strong>Drag</strong>: push the water<br><strong>Two fingers</strong>: turn, zoom' : '<strong>Click</strong> the water to inject a counter-rotating vortex pair<br><strong>Drag</strong> on it to push it<br><strong>Drag off it</strong> or right-drag to turn; scroll to zoom';
  const LEGEND = {
    velocity: { t: 'Streamlines', strip: 'rgb(0,0,139),rgb(0,150,255),rgb(0,255,200),rgb(255,165,0),rgb(255,20,0)', ends: ['Slow', 'Fast'], read: 'Top of the surface: |u| = ', n: 'Height is speed |u|. Lines are RK4 streamlines, with white marks showing direction.' },
    pressure: { t: 'Pressure p', strip: 'rgb(0,0,255),rgb(255,0,0)', ends: ['Low', 'High'], read: 'Full height: p − mean = ±', n: 'Height is pressure about its mean.' },
    vorticity: { t: 'Vorticity ω = ∇×u', strip: 'rgb(255,0,255),rgb(14,19,31),rgb(0,255,255)', ends: ['−ω', '0', '+ω'], read: 'Full height: ω = ±', n: 'Height is ω, so the two signs stand up and sink down.' },
    divergence: { t: 'Divergence ∇·u', strip: 'rgb(14,19,31),rgb(255,255,255)', ends: ['0', 'Max |∇·u|'], read: 'Largest |∇·u| is ', n: 'Height uses the vorticity scale, so a flat sheet means the flow is nearly incompressible. Color is stretched to show the pattern.' },
    strain: { t: 'Strain Rate |S|', strip: 'hsl(90,100%,50%),hsl(180,100%,50%),hsl(270,100%,50%)', ends: ['−90°', '0°', '+90°'], read: 'Top of the surface: |S| = ', n: 'Height is |S|. Hue is the principal axis angle, and white ticks lie along that axis.' },
    rotation: { t: 'Rotation Rate Ω', strip: 'rgb(255,0,110),rgb(14,19,31),rgb(0,217,255)', ends: ['−Ω', '0', '+Ω'], read: 'Full height: Ω = ±', n: 'Height is Ω. In 2D this is half of ω, so the shape matches Vorticity.' },
    decomposition: { t: 'Tensor Decomposition', strip: 'rgb(255,0,0) 0 33%,rgb(0,217,0) 33% 66%,rgb(0,0,255) 66%', ends: ['−Ω', '|S|', '+Ω'], read: 'Full height: √|W| = ', n: 'Height is the signed root of W = |S|² − ω²: up where strain wins, down where rotation wins.' },
    particles: { t: 'Particle Tracers', strip: 'rgb(14,19,31),rgb(0,217,255)', ends: ['Old', 'New'], read: 'Top of the surface: |u| = ', n: 'Height is speed |u|. Tracers ride on it and fade with age.' }
  };

  /* ---------- GL */
  const gl = cv.getContext('webgl2', { antialias: true, alpha: false });
  const mk = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
  const prog = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); const U = {}, c = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < c; i++) { const a = gl.getActiveUniform(p, i); U[a.name] = gl.getUniformLocation(p, a.name); } return { p, U }; };
  const SHEET = prog(`#version 300 es
    precision highp float; precision highp sampler2D;
    layout(location=0) in vec3 aV; uniform mat4 uVP; uniform sampler2D uF; uniform float uHS, uN, uBase; out vec3 vC; out vec3 vN; out vec3 vP; out float vH; out float vSheet;
    void main(){ ivec2 c=ivec2(aV.xy), m=ivec2(uN)-1; vec4 f=texelFetch(uF,c,0);
      float hx=texelFetch(uF,min(c+ivec2(1,0),m),0).r-texelFetch(uF,max(c-ivec2(1,0),ivec2(0)),0).r, hz=texelFetch(uF,min(c+ivec2(0,1),m),0).r-texelFetch(uF,max(c-ivec2(0,1),ivec2(0)),0).r, d=uHS*uN/4.;
      vN=normalize(vec3(-hx*d,1.,-hz*d)); vH=f.r; vSheet=aV.z<.5?1.:0.; vC=aV.z<.5?f.gba:vec3(.1,.14,.2);
      vec3 p=vec3((aV.x+.5)/uN*2.-1., aV.z>1.5?uBase:f.r*uHS, (aV.y+.5)/uN*2.-1.); vP=p; gl_Position=uVP*vec4(p,1.); }`, `#version 300 es
    precision highp float; in vec3 vC; in vec3 vN; in vec3 vP; in float vH; in float vSheet; uniform vec3 uEye; out vec4 o;
    void main(){ vec3 c=vC; if(vSheet>.5){ vec3 N=normalize(vN), L=normalize(vec3(-.45,.8,.4)), H=normalize(L+normalize(uEye-vP)); float k=vH*10., g=abs(fract(k-.5)-.5)/max(fwidth(k),1e-4); c=c*(.62+.5*max(dot(N,L),0.))+vec3(.5,.6,.7)*pow(max(dot(N,H),0.),48.)*.3; c*=1.-.32*(1.-min(g,1.)); } o=vec4(c,1.); }`);
  const LINE = prog(`#version 300 es
    layout(location=0) in vec3 aP; layout(location=1) in vec4 aC; uniform mat4 uVP; uniform float uPx; out vec4 vC;
    void main(){ vC=aC; gl_Position=uVP*vec4(aP,1.); gl_PointSize=uPx; }`, `#version 300 es
    precision highp float; in vec4 vC; uniform float uRound; out vec4 o;
    void main(){ if(uRound>.5){ vec2 q=gl_PointCoord*2.-1.; if(dot(q,q)>1.) discard; } o=vC; }`);
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, N, N); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  /* the mesh only holds grid indices; heights and colors come from the texture. Phones get every other cell */
  const M = Math.floor((N - 1) / STEP), rows = M + 1, verts = [], index = [], at = (a, b) => Math.min(a * STEP, N - 1);
  for (let b = 0; b < rows; b++) for (let a = 0; a < rows; a++) verts.push(at(a), at(b), 0);
  for (let b = 0; b < M; b++) for (let a = 0; a < M; a++) { const p = a + b * rows; index.push(p, p + rows, p + 1, p + 1, p + rows, p + rows + 1); }
  const wall = (i0, j0, i1, j1) => { const q = verts.length / 3; verts.push(i0, j0, 1, i0, j0, 2, i1, j1, 1, i1, j1, 2); index.push(q, q + 1, q + 2, q + 2, q + 1, q + 3); };
  for (let k = 0; k < M; k++) { const s = at(k), e = at(k + 1), L = N - 1; wall(s, 0, e, 0); wall(s, L, e, L); wall(0, s, 0, e); wall(L, s, L, e); }
  const sheetV = gl.createVertexArray(); gl.bindVertexArray(sheetV); gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(index), gl.STATIC_DRAW); const sheetN = index.length;
  const lineV = gl.createVertexArray(), lineB = gl.createBuffer(); gl.bindVertexArray(lineV); gl.bindBuffer(gl.ARRAY_BUFFER, lineB); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12); gl.bindVertexArray(null);
  let lines = new Float32Array(1 << 20), lineN = 0, dp = 1, w = 0, h = 0, VP = null, eye = [0, 2, 3], basis = null;
  function size() { w = host.clientWidth; h = host.clientHeight; if (!w || !h) return; dp = Math.min(devicePixelRatio || 1, 2); cv.width = Math.round(w * dp); cv.height = Math.round(h * dp); gl.viewport(0, 0, cv.width, cv.height); }

  /* ---------- from the solver's arrays to the sheet */
  const hue2 = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  function speedColor(x, out, o) { let r, g, b; if (x < .25) { const t = x / .25; r = 0; g = t * 150; b = 139 + t * 116; } else if (x < .5) { const t = (x - .25) / .25; r = 0; g = 150 + t * 105; b = 255 - t * 55; } else if (x < .75) { const t = (x - .5) / .25; r = t * 255; g = 255 - t * 90; b = 200 - t * 200; } else { const t = (x - .75) / .25; r = 255; g = 165 - t * 145; b = 0; } out[o] = r / 255; out[o + 1] = g / 255; out[o + 2] = b / 255; }   // the same ramp as the 2D streamlines
  const fieldOf = { velocity: (a, q) => Math.hypot(a.u[q], a.v[q]), particles: (a, q) => Math.hypot(a.u[q], a.v[q]), vorticity: (a, q) => a.vorticity[q], rotation: (a, q) => a.Omega_xy[q], strain: (a, q) => a.strainMagnitude[q], divergence: (a, q) => a.du_dx[q] + a.dv_dy[q], decomposition: (a, q) => { const s = a.strainMagnitude[q], o = a.vorticity[q], W = s * s - o * o; return Math.sign(W) * Math.sqrt(Math.abs(W)); } };
  function fill(mode) {
    const a = fluid; let mean = 0, cur = 0, minP = Infinity, maxP = -Infinity, maxS = 0, maxO = 0, maxD = 0, maxW = 0;
    if (mode === 'pressure') { for (let j = 1; j <= N; j++) for (let i = 1; i <= N; i++) { const p = a.pressure[i + W * j]; mean += p; if (p < minP) minP = p; if (p > maxP) maxP = p; } mean /= N * N; cur = Math.max(maxP - mean, mean - minP); }
    else { const field = fieldOf[mode]; for (let j = 1; j <= N; j++) for (let i = 1; i <= N; i++) { const q = i + W * j, s = a.strainMagnitude[q], o = Math.abs(a.Omega_xy[q]), w2 = Math.abs(a.vorticity[q]), d = Math.abs(a.du_dx[q] + a.dv_dy[q]); if (s > maxS) maxS = s; if (o > maxO) maxO = o; if (w2 > maxW) maxW = w2; if (d > maxD) maxD = d; const v = Math.abs(field(a, q)); if (v > cur) cur = v; } }
    if (mode === 'divergence') cur = maxW;
    const now = performance.now(); STATE.scale = Math.max(cur, STATE.scale * Math.exp(-(now - STATE.last) / TAU)); STATE.last = now; const S = STATE.scale > 1e-9 ? STATE.scale : 1, field = fieldOf[mode]; let o = 0;
    STATE.divShare = maxW ? maxD / maxW : 0; const pr = (maxP - minP) || 1;
    for (let j = 1; j <= N; j++) for (let i = 1; i <= N; i++, o += 4) {
      const q = i + W * j; let r = BG[0], g = BG[1], b = BG[2], n;
      switch (mode) {
        case 'velocity': case 'particles': { const v = field(a, q); F[o] = v / S; speedColor(Math.min(1, v / (S * .5)), F, o + 1); const m = mode === 'velocity' ? .32 : .2; F[o + 1] = BG[0] + (F[o + 1] - BG[0]) * m; F[o + 2] = BG[1] + (F[o + 2] - BG[1]) * m; F[o + 3] = BG[2] + (F[o + 3] - BG[2]) * m; continue; }
        case 'pressure': { const p = a.pressure[q]; F[o] = (p - mean) / S; n = (p - minP) / pr; F[o + 1] = n; F[o + 2] = 0; F[o + 3] = 1 - n; continue; }
        case 'vorticity': { const v = a.vorticity[q]; F[o] = v / S; n = Math.min(1, Math.abs(v) / S); if (v > 0) { r += (0 - r) * n; g += (1 - g) * n; b += (1 - b) * n; } else { r += (1 - r) * n; g += (0 - g) * n; b += (1 - b) * n; } break; }
        case 'rotation': { const v = a.Omega_xy[q]; F[o] = v / S; n = Math.min(1, Math.abs(v) / (S * .5)); if (v > 0) { r += (0 - r) * n; g += (.851 - g) * n; b += (1 - b) * n; } else { r += (1 - r) * n; g += (0 - g) * n; b += (.431 - b) * n; } break; }
        case 'divergence': { const v = field(a, q); F[o] = v / S; n = maxD ? Math.abs(v) / maxD : 0; r += (1 - r) * n; g += (1 - g) * n; b += (1 - b) * n; break; }
        case 'strain': { const v = a.strainMagnitude[q]; F[o] = v / S; n = Math.min(1, v / (S * .5)); const t = (.5 * Math.atan2(2 * a.S_xy[q], a.S_xx[q] - a.S_yy[q]) + Math.PI) / (2 * Math.PI), l = n * .5, u2 = l < .5 ? l * 2 : 1, p2 = 2 * l - u2; r = BG[0] * (1 - n) + hue2(p2, u2, t + 1 / 3); g = BG[1] * (1 - n) + hue2(p2, u2, t); b = BG[2] * (1 - n) + hue2(p2, u2, t - 1 / 3); break; }
        case 'decomposition': { const v = field(a, q), rot = a.Omega_xy[q], sn = Math.min(1, a.strainMagnitude[q] / (maxS * .5 || 1)), rn = Math.min(1, Math.abs(rot) / (maxO * .5 || 1)); F[o] = v / S; const base = 1 - Math.max(sn, rn); r = BG[0] * base + (rot < 0 ? rn : 0); g = BG[1] * base + sn * .851; b = BG[2] * base + (rot > 0 ? rn : 0); break; }
      }
      F[o + 1] = r; F[o + 2] = g; F[o + 3] = b;
    }
    gl.bindTexture(gl.TEXTURE_2D, tex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, N, N, gl.RGBA, gl.FLOAT, F);
  }
  /* height on the sheet at a solver coordinate, bilinear between the cell centers the mesh actually has */
  function heightAt(x, y) { const fx = Math.max(0, Math.min(N - 1.001, x - 1)), fy = Math.max(0, Math.min(N - 1.001, y - 1)), i = fx | 0, j = fy | 0, s = fx - i, t = fy - j, o = (i + j * N) * 4; return ((1 - s) * (1 - t) * F[o] + s * (1 - t) * F[o + 4] + (1 - s) * t * F[o + N * 4] + s * t * F[o + N * 4 + 4]) * HS; }
  const room = n => { if (lineN + n > lines.length) { const b = new Float32Array(lines.length * 2); b.set(lines); lines = b; } };
  const seg = (x0, y0, x1, y1, r, g, b, a) => { room(14); lines.set([worldX(x0), heightAt(x0, y0) + LIFT, worldX(y0), r, g, b, a, worldX(x1), heightAt(x1, y1) + LIFT, worldX(y1), r, g, b, a], lineN); lineN += 14; };
  /* fixed seeds on the 2D view's spacing family, wider apart, so lines hold still in a steady flow rather than flickering each frame */
  const seeds = []; for (let j = 6; j <= N; j += 12) for (let i = 6; i <= N; i += 12) seeds.push([i + (Math.random() - .5) * 6, j + (Math.random() - .5) * 6]);
  const col = [0, 0, 0];
  function traceLines() {
    lineN = 0; let maxVel = 0; for (let j = 1; j <= N; j++) for (let i = 1; i <= N; i++) { const q = i + W * j, v = Math.hypot(fluid.u[q], fluid.v[q]); if (v > maxVel) maxVel = v; }
    if (maxVel < 1e-10) return;
    for (const sd of seeds) { const back = renderer.traceStreamline(sd[0], sd[1], 80, -.5, maxVel), ahead = renderer.traceStreamline(sd[0], sd[1], 80, .5, maxVel), pts = back.reverse().concat(ahead.slice(1)); if (pts.length < 2) continue;
      for (let k = 0; k < pts.length - 1; k++) { const a = pts[k], b = pts[k + 1], t = Math.min(1, (a.speed + b.speed) / 2 / (maxVel * .5)); speedColor(t, col, 0); seg(a.x, a.y, b.x, b.y, col[0], col[1], col[2], .45 + t * .5); }
      if (pts.length > 10) { const m = pts.length >> 1, p = pts[m], a = pts[m - 1], b = pts[m + 1], l = Math.hypot(b.x - a.x, b.y - a.y); if (l > .1) { const nx = (b.x - a.x) / l, ny = (b.y - a.y) / l, s = 1.6; seg(p.x - nx * s - ny * s * .7, p.y - ny * s + nx * s * .7, p.x, p.y, 1, 1, 1, .85); seg(p.x - nx * s + ny * s * .7, p.y - ny * s - nx * s * .7, p.x, p.y, 1, 1, 1, .85); } } }
  }
  function strainTicks() { lineN = 0; let mx = 0; const lam = q => Math.hypot((fluid.S_xx[q] - fluid.S_yy[q]) / 2, fluid.S_xy[q]); for (let j = 8; j <= N; j += 8) for (let i = 8; i <= N; i += 8) mx = Math.max(mx, lam(i + W * j)); if (!mx) return; for (let j = 8; j <= N; j += 16) for (let i = 8; i <= N; i += 16) { const q = i + W * j, ang = .5 * Math.atan2(2 * fluid.S_xy[q], fluid.S_xx[q] - fluid.S_yy[q]), l = 7 * lam(q) / mx, c = Math.cos(ang) * l, s = Math.sin(ang) * l; if (l > .4) seg(i - c, j - s, i + c, j + s, 1, 1, 1, .7); } }
  const FRAME = (() => { const c = [-1, -1, 1, -1, 1, 1, -1, 1], o = []; for (let k = 0; k < 4; k++) { const a = k * 2, b = (k + 1) % 4 * 2; o.push(c[a], 0, c[a + 1], .66, .84, 1, .3, c[b], 0, c[b + 1], .66, .84, 1, .3); } return new Float32Array(o); })();
  let partData = new Float32Array(fluid.particles.length * 7);
  function particleVerts() { let m = 0; for (const p of fluid.particles) { partData[m] = worldX(p.x); partData[m + 1] = heightAt(p.x, p.y) + LIFT * 1.5; partData[m + 2] = worldX(p.y); partData[m + 3] = 0; partData[m + 4] = .85; partData[m + 5] = 1; partData[m + 6] = Math.max(.15, p.life * .9); m += 7; } return m / 7; }

  function setLegend(mode) { const L = LEGEND[mode], ends = L.ends.map(e => `<span>${e}</span>`).join(''); legend.innerHTML = `<b>${L.t}</b><div class="ns-strip" style="background:linear-gradient(90deg,${L.strip})"></div><div class="ns-ends">${ends}</div><p class="keep ns-read" id="ns-read"></p><p>${L.n}</p>`; cv.setAttribute('aria-label', `${L.t} on a ${N} by ${N} grid as a 3D surface. ${L.n} The 2D Field button shows the same field flat.`); }
  function setRead(mode) { const el = document.getElementById('ns-read'); if (!el) return; const L = LEGEND[mode]; el.textContent = mode === 'divergence' ? `${L.read}${(STATE.divShare * 100).toFixed(1)}% of largest |ω|` : `${L.read}${STATE.scale < 1 ? STATE.scale.toPrecision(2) : STATE.scale.toFixed(1)}`; }

  function draw() {
    if (!w) return; const mode = renderer.mode; if (mode !== STATE.mode) { STATE.mode = mode; STATE.scale = 0; setLegend(mode); STATE.frame = 0; lineN = 0; }
    fill(mode); const every = isPaused ? 20 : 2;
    if (mode === 'velocity') { if (STATE.frame % every === 0) traceLines(); } else if (mode === 'strain') { if (STATE.frame % every === 0) strainTicks(); } else lineN = 0;
    if (STATE.frame % 15 === 0) setRead(mode); STATE.frame++;
    const a = w / h, r = 3.05 * Math.max(1, 1.3 / a) * CAM.zoom, cp = Math.cos(CAM.pitch); eye = [Math.sin(CAM.yaw) * cp * r, Math.sin(CAM.pitch) * r - .05, Math.cos(CAM.yaw) * cp * r];
    const tgt = [0, -.05, 0], z = unit(sub(eye, tgt)), x = unit(cross([0, 1, 0], z)), y = cross(z, x), T = 1 / Math.tan(.42); basis = { x, y, z, T, a };
    VP = mul(persp(T, a, .1, 30), [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
    gl.clearColor(.039, .055, .09, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    gl.useProgram(SHEET.p); gl.uniformMatrix4fv(SHEET.U.uVP, false, VP); gl.uniform1f(SHEET.U.uHS, HS); gl.uniform1f(SHEET.U.uN, N); gl.uniform1f(SHEET.U.uBase, BASE); gl.uniform3fv(SHEET.U.uEye, eye); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(SHEET.U.uF, 0); gl.bindVertexArray(sheetV); gl.drawElements(gl.TRIANGLES, sheetN, gl.UNSIGNED_INT, 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.useProgram(LINE.p); gl.uniformMatrix4fv(LINE.U.uVP, false, VP); gl.uniform1f(LINE.U.uRound, 0); gl.uniform1f(LINE.U.uPx, 1); gl.bindVertexArray(lineV); gl.bindBuffer(gl.ARRAY_BUFFER, lineB);
    gl.bufferData(gl.ARRAY_BUFFER, FRAME, gl.DYNAMIC_DRAW); gl.drawArrays(gl.LINES, 0, 8);
    if (lineN) { gl.bufferData(gl.ARRAY_BUFFER, lines.subarray(0, lineN), gl.DYNAMIC_DRAW); gl.drawArrays(gl.LINES, 0, lineN / 7); }
    if (mode === 'particles') { const n = particleVerts(); gl.uniform1f(LINE.U.uRound, 1); gl.uniform1f(LINE.U.uPx, 2.6 * dp); gl.bufferData(gl.ARRAY_BUFFER, partData, gl.DYNAMIC_DRAW); gl.drawArrays(gl.POINTS, 0, n); }
    gl.bindVertexArray(null);
  }

  /* ---------- pointing: the ray from the eye, walked onto the sheet */
  function hit(px, py) { if (!basis) return null; const { x, y, z, T, a } = basis, nx = (px / w * 2 - 1) * a / T, ny = (1 - py / h * 2) / T, d = unit([x[0] * nx + y[0] * ny - z[0], x[1] * nx + y[1] * ny - z[1], x[2] * nx + y[2] * ny - z[2]]); if (d[1] >= 0) return null; const G = t => ({ x: (eye[0] + d[0] * t + 1) / 2 * N + .5, y: (eye[2] + d[2] * t + 1) / 2 * N + .5, wy: eye[1] + d[1] * t }), inside = g => g.x >= .5 && g.x <= N + .5 && g.y >= .5 && g.y <= N + .5, t0 = (HS * 1.02 - eye[1]) / d[1], t1 = (-HS * 1.02 - eye[1]) / d[1]; let prev = t0;   // the first place the ray meets the surface, so a peak in front answers for what it hides
    for (let k = 1; k <= 96; k++) { const b = t0 + (t1 - t0) * k / 96, g = G(b); if (inside(g) && g.wy <= heightAt(g.x, g.y)) { let lo = prev, hi = b; for (let q = 0; q < 6; q++) { const m = (lo + hi) / 2, c = G(m); if (inside(c) && c.wy <= heightAt(c.x, c.y)) hi = m; else lo = m; } const r = G(hi); return { x: r.x, y: r.y }; } prev = b; } return null; }
  const clampPitch = p => Math.max(.18, Math.min(1.45, p));
  const pts = new Map(); let act = null;
  const local = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const seen = () => hint.classList.add('done');
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); const [px, py] = local(e); pts.set(e.pointerId, [px, py]); seen();
    if (pts.size === 2) { const [a, b] = [...pts.values()]; act = { kind: 'pinch', cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2, dist: Math.hypot(a[0] - b[0], a[1] - b[1]), yaw: CAM.yaw, pitch: CAM.pitch, zoom: CAM.zoom }; return; }
    const on = hit(px, py); if (on && STATE.pushes && e.button === 0 && !e.shiftKey) act = { kind: 'push', px, py, last: on, at: performance.now(), moved: 0 }; else { act = { kind: 'turn', px, py, yaw: CAM.yaw, pitch: CAM.pitch }; cv.classList.add('drag'); } });
  cv.addEventListener('pointermove', e => { if (!pts.has(e.pointerId)) return; const [px, py] = local(e); pts.set(e.pointerId, [px, py]); if (!act) return;
    if (act.kind === 'pinch' && pts.size >= 2) { const [a, b] = [...pts.values()], cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2, dist = Math.hypot(a[0] - b[0], a[1] - b[1]); CAM.yaw = act.yaw - (cx - act.cx) / w * 3.2; CAM.pitch = clampPitch(act.pitch + (cy - act.cy) / h * 1.8); CAM.zoom = Math.max(.5, Math.min(1.6, act.zoom * act.dist / (dist || 1))); return; }
    if (act.kind === 'turn') { CAM.yaw = act.yaw - (px - act.px) / w * 3.2; CAM.pitch = clampPitch(act.pitch + (py - act.py) / h * 1.8); return; }
    if (act.kind === 'push') { act.moved = Math.max(act.moved, Math.hypot(px - act.px, py - act.py)); const on = hit(px, py); if (!on) return; const dx = on.x - act.last.x, dy = on.y - act.last.y; if (Math.hypot(dx, dy) > .6) { fluid.addForce(on.x - .5, on.y - .5, dx * PX_PER_CELL * forceMagnitude * .1, dy * PX_PER_CELL * forceMagnitude * .1, N, N); act.last = on; } } });
  const up = e => { pts.delete(e.pointerId); cv.classList.remove('drag'); if (act && act.kind === 'push' && e.type === 'pointerup' && act.moved < 10 && performance.now() - act.at < 200) { const on = hit(act.px, act.py); if (on) fluid.addVortexAt(on.x - .5, on.y - .5, N, N); } act = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); CAM.zoom = Math.max(.5, Math.min(1.6, CAM.zoom * Math.exp(e.deltaY * .001))); }, { passive: false });
  cv.addEventListener('keydown', e => { const k = { ArrowLeft: [.08, 0], ArrowRight: [-.08, 0], ArrowUp: [0, .05], ArrowDown: [0, -.05] }[e.key]; if (!k) return; e.preventDefault(); CAM.yaw += k[0]; CAM.pitch = clampPitch(CAM.pitch + k[1]); });
  function setPushes(on) { STATE.pushes = on; dragBtn.textContent = on ? 'Drag: pushes water' : 'Drag: turns view'; cv.classList.toggle('turn', !on); }
  dragBtn.onclick = () => setPushes(!STATE.pushes);
  function setView(three) { STATE.on = three; document.body.classList.toggle('view-2d', !three); view3d.classList.toggle('active', three); view2d.classList.toggle('active', !three); view3d.setAttribute('aria-pressed', three); view2d.setAttribute('aria-pressed', !three); hint.innerHTML = three ? HINT3D : hint2D; hint.classList.remove('done'); if (three) { STATE.mode = null; size(); } else dispatchEvent(new Event('resize')); }
  view3d.onclick = () => setView(true); view2d.onclick = () => setView(false);
  cv.addEventListener('webglcontextlost', e => { e.preventDefault(); setView(false); view3d.disabled = true; });
  new ResizeObserver(size).observe(host); size(); hint.innerHTML = HINT3D;
  dispatchEvent(new Event('resize'));   // the 2D canvas sized itself before this script's layout rules existed

  /* the tool opens on still water. Start with its own vortex pair, so there is a surface to see; with reduced motion, a still frame */
  fluid.addVortexPair();
  if (calm) { for (let k = 0; k < 12; k++) fluid.step(); isPaused = true; pauseBtn.textContent = 'Resume'; }

  /* console checks: run frames by hand, test the sheet against the solver, and test pointing against the projection */
  return { get on() { return STATE.on; }, draw, setView, setPushes, CAM, STATE, F, hit, check() {
    const mode = renderer.mode, S = STATE.scale; let off = 0;
    if (mode === 'pressure') { let m = 0; for (let j = 1; j <= N; j++) for (let i = 1; i <= N; i++) m += fluid.pressure[i + W * j]; m /= N * N; for (let j = 1; j <= N; j++) for (let i = 1; i <= N; i++) off = Math.max(off, Math.abs(F[((i - 1) + (j - 1) * N) * 4] * S - (fluid.pressure[i + W * j] - m))); }
    else { const f = fieldOf[mode]; for (let j = 1; j <= N; j++) for (let i = 1; i <= N; i++) off = Math.max(off, Math.abs(F[((i - 1) + (j - 1) * N) * 4] * S - f(fluid, i + W * j))); }
    const miss = []; if (VP) for (let j = 8; j <= N; j += 16) for (let i = 8; i <= N; i += 16) { const wp = [worldX(i), heightAt(i, j), worldX(j)], cw = VP[3] * wp[0] + VP[7] * wp[1] + VP[11] * wp[2] + VP[15], sx = ((VP[0] * wp[0] + VP[4] * wp[1] + VP[8] * wp[2] + VP[12]) / cw * .5 + .5) * w, sy = (.5 - (VP[1] * wp[0] + VP[5] * wp[1] + VP[9] * wp[2] + VP[13]) / cw * .5) * h, on = hit(sx, sy); if (on) miss.push(Math.hypot(on.x - i, on.y - j)); } miss.sort((a, b) => a - b);
    return { mode, N, scale: +S.toPrecision(4), largestHeightError: +off.toExponential(2), divergenceShareOfVorticity: +STATE.divShare.toFixed(4), pointingMedianCells: +(miss[miss.length >> 1] || 0).toFixed(2), pointsTried: miss.length, hiddenByPeaks: miss.filter(x => x > 2).length, glError: gl.getError(), lines: lineN / 7 }; } };
})();
