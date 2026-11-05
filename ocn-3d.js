/* The 3D landscape view for the Optimal Channel Networks tool, in raw WebGL2. It only reads the tool's networks and renderers:
   nothing here changes how a network is optimized, and the 2D maps stay one click away.

   The terrain isn't decoration. OCN theory gives slope from drainage area, S = A^(gamma-1), so walking upstream from the outlet,
   z_i = z_down + L_i * A_i^(gamma-1). At gamma = 1, the tool's setting, every slope is 1 and this is exactly its "distance to
   outlet" elevation field. Water runs strictly downhill along every link by construction. There's one vertex per grid cell, with
   no invented detail between them, and each quad is split along its diagonal link when it has one, so rivers lie on the surface. */
'use strict';
window.OCN3D = (() => {
  const probe = document.createElement('canvas').getContext('webgl2');
  if (!probe) return null;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches, HEIGHT = .62;   // the tallest point is drawn at this height on a 2-wide map: a stretched vertical scale
  const CAM = { yaw: -.6, pitch: .68, dirty: true };
  const STRAHLER = [[100, 150, 255], [0, 217, 255], [0, 255, 150], [255, 200, 0], [255, 100, 0], [255, 0, 110]].map(c => c.map(x => x / 255));   // the same orders and colors as the 2D map
  const STATE = { on: true, big: -1 };
  const persp = (t, a, n, r) => [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (r + n) / (n - r), -1, 0, 0, 2 * r * n / (n - r), 0];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], unit = a => { const l = Math.hypot(...a); return a.map(x => x / l); };
  const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };

  /* elevation, from the network itself. Children lists, so this is linear in the number of cells */
  function elevation(net) {
    const n = net.size, down = net.downstream, z = new Float32Array(n), head = new Int32Array(n).fill(-1), next = new Int32Array(n), order = [net.outletIdx];
    for (let i = 0; i < n; i++) { const d = down[i]; if (d >= 0 && d !== i) { next[i] = head[d]; head[d] = i; } }
    for (let q = 0; q < order.length; q++) { const p = order[q]; for (let c = head[p]; c >= 0; c = next[c]) { const area = Math.max(net.flowAccum[c], 1); z[c] = z[p] + net.getEuclideanDist(c, p) * Math.pow(area, net.gamma - 1); order.push(c); } }
    return { z, reached: order.length };
  }

  class Slot {
    constructor(host, index) {
      this.index = index; this.host = host; this.net = networks[index]; this.sig = null; this.N = 0; this.parts = [];
      const cv = this.cv = document.createElement('canvas'); cv.className = 'ocn3d'; cv.setAttribute('role', 'img');
      host.insertBefore(cv, host.children[1]);
      const gl = this.gl = cv.getContext('webgl2', { antialias: true, alpha: false });
      const mk = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
      const prog = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); const U = {}, c = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < c; i++) { const a = gl.getActiveUniform(p, i); U[a.name] = gl.getUniformLocation(p, a.name); } return { p, U }; };
      this.LAND = prog(`#version 300 es
        layout(location=0) in vec3 aP; layout(location=1) in vec3 aC; uniform mat4 uVP; out vec3 vP; out vec3 vC;
        void main(){ vP=aP; vC=aC; gl_Position=uVP*vec4(aP,1.); }`, `#version 300 es
        precision highp float; in vec3 vP; in vec3 vC; out vec4 o;
        void main(){ vec3 N=normalize(cross(dFdx(vP),dFdy(vP))); if(N.y<0.&&vP.y>-.03) N=-N; float l=.42+.58*max(dot(N,normalize(vec3(-.5,.75,.45))),0.); o=vec4(vC*l,1.); }`);
      this.WIRE = prog(`#version 300 es
        layout(location=0) in vec3 aP; layout(location=1) in vec3 aC; uniform mat4 uVP; out vec3 vC;
        void main(){ vC=aC; gl_Position=uVP*vec4(aP,1.); }`, `#version 300 es
        precision highp float; in vec3 vC; uniform float uA; out vec4 o; void main(){ o=vec4(vC,uA); }`);
      this.DOT = prog(`#version 300 es
        layout(location=0) in vec3 aP; layout(location=1) in vec3 aC; layout(location=2) in float aS; uniform mat4 uVP; uniform float uPx; out vec3 vC;
        void main(){ vC=aC; gl_Position=uVP*vec4(aP,1.); gl_PointSize=aS*uPx/gl_Position.w; }`, `#version 300 es
        precision highp float; in vec3 vC; out vec4 o; void main(){ vec2 q=gl_PointCoord*2.-1.; if(dot(q,q)>1.) discard; o=vec4(vC,1.); }`);
      const vao3 = stride => { const v = gl.createVertexArray(), b = gl.createBuffer(); gl.bindVertexArray(v); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride * 4, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride * 4, 12); if (stride > 6) { gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride * 4, 24); } return { v, b, n: 0 }; };
      this.land = vao3(6); this.ribbon = vao3(6); this.dots = vao3(7); gl.bindVertexArray(null);
      this.tick = 0;
      new ResizeObserver(() => { this.size(); renderers[index].resizeCanvas(); CAM.dirty = true; }).observe(host);
      cv.addEventListener('webglcontextlost', e => { e.preventDefault(); setView(false); viewBar3d.disabled = true; });
      this.size();
    }
    size() { const w = this.host.clientWidth, h = this.host.clientHeight; if (!w || !h) return; const dp = Math.min(devicePixelRatio || 1, 2); this.w = w; this.h = h; this.cv.width = Math.round(w * dp); this.cv.height = Math.round(h * dp); this.gl.viewport(0, 0, this.cv.width, this.cv.height); }
    signature() { const n = this.net, mode = renderers[this.index].mode; let s = 2166136261; for (let i = 0; i < n.size; i++) s = Math.imul(s ^ n.downstream[i], 16777619); return `${n.N}|${mode}|${n.outletIdx}|${n.gamma}|${s}|${[...n.recentSwaps].length}`; }

    /* every buffer comes from the network as it stands. Only rebuilt when the network or the coloring changes */
    rebuild() {
      const n = this.net, N = n.N, gl = this.gl, mode = renderers[this.index].mode, { z } = elevation(n), X = i => (N > 1 ? i / (N - 1) - .5 : 0) * 2;
      let zMax = 0, areaMax = 1, enMax = 1e-9; for (let i = 0; i < n.size; i++) { if (z[i] > zMax) zMax = z[i]; if (n.flowAccum[i] > areaMax) areaMax = n.flowAccum[i]; if (n.energy[i] > enMax) enMax = n.energy[i]; }
      const H = i => zMax ? z[i] / zMax * HEIGHT : 0; this.H = H; this.z = z; this.zMax = zMax; this.X = X;
      if (mode === 'strahler') n.computeStrahlerOrder();
      const slopeOf = i => { const d = n.downstream[i]; return d >= 0 && d !== i ? (z[i] - z[d]) / n.getEuclideanDist(i, d) : 0; };
      let slopeMax = 1e-9; if (mode === 'slope') for (let i = 0; i < n.size; i++) slopeMax = Math.max(slopeMax, slopeOf(i));
      /* land color: the tool's own ramps for its data fields; a quiet one where the river is the subject */
      const paint = i => { const e = zMax ? z[i] / zMax : 0, a = Math.log(n.flowAccum[i] + 1) / Math.log(areaMax + 1); switch (mode) { case 'elevation': return [e * .39 + .04, e * .59 + .2, e * .78 + .22]; case 'flow': return [a, a * .85, 1]; case 'energy': { const q = Math.min(1, n.energy[i] / enMax); return [.08 + q * .92, .1 + q * .3, .14 + q * .3]; } case 'slope': { const q = .15 + .85 * slopeOf(i) / slopeMax; return [q, q, q]; } default: return [.13 + e * .3, .17 + e * .33, .24 + e * .36]; } };
      const land = []; const put = (x, y, zz, c) => land.push(x, y, zz, c[0], c[1], c[2]);
      const diagonal = (a, b) => n.downstream[a] === b || n.downstream[b] === a;
      for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) { const a = n.IX(i, j), b = n.IX(i + 1, j), c = n.IX(i, j + 1), d = n.IX(i + 1, j + 1), P = (q, ii, jj) => put(X(ii), H(q), X(jj), paint(q)); if (diagonal(b, c) && !diagonal(a, d)) { P(a, i, j); P(c, i, j + 1); P(b, i + 1, j); P(b, i + 1, j); P(c, i, j + 1); P(d, i + 1, j + 1); } else { P(a, i, j); P(d, i + 1, j + 1); P(b, i + 1, j); P(a, i, j); P(c, i, j + 1); P(d, i + 1, j + 1); } }
      /* a skirt down to a base, so the map reads as a solid block */
      const BASE = -.07, side = [.09, .12, .17], wall = (q0, x0, z0, q1, x1, z1) => { put(x0, H(q0), z0, side); put(x0, BASE, z0, side); put(x1, H(q1), z1, side); put(x1, H(q1), z1, side); put(x0, BASE, z0, side); put(x1, BASE, z1, side); };
      for (let k = 0; k < N - 1; k++) { wall(n.IX(k, 0), X(k), X(0), n.IX(k + 1, 0), X(k + 1), X(0)); wall(n.IX(k, N - 1), X(k), X(N - 1), n.IX(k + 1, N - 1), X(k + 1), X(N - 1)); wall(n.IX(0, k), X(0), X(k), n.IX(0, k + 1), X(0), X(k + 1)); wall(n.IX(N - 1, k), X(N - 1), X(k), n.IX(N - 1, k + 1), X(N - 1), X(k + 1)); }
      /* rivers: a flat ribbon on each link, wider with the square root of drainage area, as on the 2D map */
      const rib = [], scale = 10 / N, LIFT = .004;
      for (let i = 0; i < n.size; i++) { const d = n.downstream[i]; if (d < 0 || d === i) continue; const p = n.getCoords(i), q = n.getCoords(d), x0 = X(p.i), z0 = X(p.j), x1 = X(q.i), z1 = X(q.j), y0 = H(i) + LIFT, y1 = H(d) + LIFT, area = n.flowAccum[i], t = Math.min(1, Math.log(area + 1) / Math.log(n.size)); let col = [t * .39, (.7 + t * .3) * .85, (200 + t * 55) / 255], w = (.007 + .012 * Math.sqrt(area)) * scale;
        if (mode === 'strahler') { const o = n.strahlerOrder[i] || 1; col = STRAHLER[Math.min(o - 1, 5)]; w = .012 * o * scale; } else if (mode !== 'network') { col = [.82, .9, 1]; w = .006 * scale; }
        if (n.recentSwaps.has(i)) { col = [0, 1, 1]; w *= 1.6; }
        const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1, ox = -dz / l * w, oz = dx / l * w; rib.push(x0 + ox, y0, z0 + oz, ...col, x0 - ox, y0, z0 - oz, ...col, x1 + ox, y1, z1 + oz, ...col, x1 + ox, y1, z1 + oz, ...col, x0 - ox, y0, z0 - oz, ...col, x1 - ox, y1, z1 - oz, ...col); }
      gl.bindBuffer(gl.ARRAY_BUFFER, this.land.b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(land), gl.DYNAMIC_DRAW); this.land.n = land.length / 6;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.ribbon.b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(rib), gl.DYNAMIC_DRAW); this.ribbon.n = rib.length / 6;
      if (N !== this.N) { this.N = N; this.parts = []; for (let k = 0; k < Math.min(n.size, 260); k++) this.parts.push({ i: Math.floor(Math.random() * n.size), t: Math.random() }); }
      const o = n.getCoords(n.outletIdx); this.out = [X(o.i), H(n.outletIdx) + .03, X(o.j)];
      this.cv.setAttribute('aria-label', `Channel network on a ${N} by ${N} grid as a 3D landscape, with the outlet at column ${o.i + 1}, row ${o.j + 1}. The 2D Maps button shows the same network as a map.`);
    }
    /* tracers: dots riding each link downstream, respawning on a random cell when they reach the outlet */
    moveDots() { const n = this.net, X = this.X, H = this.H, data = new Float32Array((this.parts.length + 1) * 7); let m = 0; const add = (x, y, zz, c, s) => { data.set([x, y, zz, c[0], c[1], c[2], s], m); m += 7; };
      for (const q of this.parts) { let d = n.downstream[q.i]; if (d < 0 || d === q.i) { q.i = Math.floor(Math.random() * n.size); q.t = 0; d = n.downstream[q.i]; if (d < 0 || d === q.i) continue; } if (!calm) q.t += .03 / (n.getEuclideanDist(q.i, d) || 1); if (q.t >= 1) { q.i = d; q.t = 0; d = n.downstream[q.i]; if (d < 0 || d === q.i) continue; } const a = n.getCoords(q.i), b = n.getCoords(d), T = q.t; add(X(a.i) + (X(b.i) - X(a.i)) * T, H(q.i) + (H(d) - H(q.i)) * T + .012, X(a.j) + (X(b.j) - X(a.j)) * T, [.9, .98, 1], .011); }
      add(this.out[0], this.out[1], this.out[2], [1, 0, .43], .05); this.dotN = m / 7; return data; }
    frame() {
      if (!this.w) return; const gl = this.gl, s = this.signature(); if (s !== this.sig) { this.sig = s; this.rebuild(); CAM.dirty = true; }
      const a = this.w / this.h, r = 4.3 * Math.max(1, 1.15 / a), cp = Math.cos(CAM.pitch), e = [Math.sin(CAM.yaw) * cp * r, Math.sin(CAM.pitch) * r + .1, Math.cos(CAM.yaw) * cp * r], at = [0, .1, 0], z = unit(sub(e, at)), x = unit(cross([0, 1, 0], z)), y = cross(z, x), T = 1 / Math.tan(.42);
      const VP = this.VP = mul(persp(T, a, .1, 20), [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]);
      gl.clearColor(.078, .098, .137, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST);
      gl.useProgram(this.LAND.p); gl.uniformMatrix4fv(this.LAND.U.uVP, false, VP); gl.bindVertexArray(this.land.v); gl.drawArrays(gl.TRIANGLES, 0, this.land.n);
      gl.useProgram(this.WIRE.p); gl.uniformMatrix4fv(this.WIRE.U.uVP, false, VP); gl.bindVertexArray(this.ribbon.v); gl.uniform1f(this.WIRE.U.uA, 1); gl.drawArrays(gl.TRIANGLES, 0, this.ribbon.n);
      /* where two diagonal links cross, or a ridge hides a river, show it faintly through the land */
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthFunc(gl.GREATER); gl.depthMask(false); gl.uniform1f(this.WIRE.U.uA, .22); gl.drawArrays(gl.TRIANGLES, 0, this.ribbon.n); gl.depthFunc(gl.LESS); gl.depthMask(true); gl.disable(gl.BLEND);
      const data = this.moveDots(); gl.useProgram(this.DOT.p); gl.uniformMatrix4fv(this.DOT.U.uVP, false, VP); gl.uniform1f(this.DOT.U.uPx, this.cv.height * 1.4); gl.bindVertexArray(this.dots.v); gl.bindBuffer(gl.ARRAY_BUFFER, this.dots.b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW); gl.drawArrays(gl.POINTS, 0, this.dotN); gl.bindVertexArray(null);
    }
    /* nearest cell to a point on the canvas, by projecting every cell: exact for whatever the viewer can see */
    cellAt(px, py) { const n = this.net, VP = this.VP; if (!VP) return null; let best = -1, bd = 1e9; for (let j = 0; j < n.N; j++) for (let i = 0; i < n.N; i++) { const q = n.IX(i, j), w = [this.X(i), this.H(q), this.X(j)], cw = VP[3] * w[0] + VP[7] * w[1] + VP[11] * w[2] + VP[15], sx = ((VP[0] * w[0] + VP[4] * w[1] + VP[8] * w[2] + VP[12]) / cw * .5 + .5) * this.w, sy = (.5 - (VP[1] * w[0] + VP[5] * w[1] + VP[9] * w[2] + VP[13]) / cw * .5) * this.h, d = (sx - px) ** 2 + (sy - py) ** 2; if (d < bd) { bd = d; best = q; } } return bd < (Math.max(this.w, this.h) * .9 / n.N) ** 2 ? best : null; }
  }

  /* ---------- the page around it */
  const style = document.createElement('style');
  style.textContent = `.ocn3d{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:grab;touch-action:pan-y}.ocn3d.drag{cursor:grabbing}
  body.view-2d .ocn3d,body.view-2d .ocn-big{display:none}
  .ocn-view{display:flex;gap:.5rem;margin-left:auto}.ocn-view-btn{font-family:'JetBrains Mono',monospace;font-size:.75rem;padding:.5rem 1rem;min-height:36px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:4px;color:var(--text-secondary);cursor:pointer}.ocn-view-btn:hover{border-color:var(--accent-primary);color:var(--accent-primary)}.ocn-view-btn.active{background:var(--accent-green);border-color:var(--accent-green);color:var(--bg-primary);font-weight:600}.ocn-big{position:absolute;right:5px;top:5px;z-index:2;font-family:'JetBrains Mono',monospace;font-size:.7rem;min-height:30px;padding:0 .5rem;background:rgba(0,0,0,.7);color:var(--text-primary);border:1px solid var(--border);border-radius:3px;cursor:pointer}.ocn-big:hover{border-color:var(--accent-primary)}
  .ocn-note{font-size:.78rem;color:var(--text-secondary);margin:0}.ocn-tip{position:fixed;z-index:50;pointer-events:none;background:#000;color:var(--text-primary);border:1px solid var(--border);border-radius:3px;padding:.2rem .45rem;font-family:'JetBrains Mono',monospace;font-size:.72rem}
  .canvas-container.ocn-hidden{display:none}.canvas-container.ocn-full{grid-column:1/-1;grid-row:1/-1}
  .simulation-panel{min-height:0;overflow-y:auto;padding-right:4px}.simulation-panel>*{flex-shrink:0}.simulation-panel>.canvas-container{flex:0 0 200px}.ocn-grid{flex:1 0 auto!important;min-height:max(440px,62vh)}.ocn-grid .canvas-container>canvas{position:absolute;inset:0}.ocn-note{max-width:80ch}
  @media (max-width:860px){body{overflow:auto}.container{height:auto;min-height:100vh}header{padding:1rem}.main-content{flex-direction:column;padding:1rem;gap:1rem;overflow:visible}.simulation-panel{overflow:visible;padding-right:0}.controls-panel{width:100%;overflow:visible}.ocn-grid{min-height:min(110vw,620px)}.ocn-view{margin-left:0}.ocn-view-btn{min-height:44px}.ocn-big{min-height:44px}.mode-btn{min-height:44px}}`;
  document.head.append(style);
  const hosts = [1, 2, 3, 4].map(i => document.getElementById(`networkCanvas${i}`).parentElement), grid = hosts[0].parentElement, bar = document.querySelector('.visualization-modes'); grid.classList.add('ocn-grid');
  const view = document.createElement('div'); view.className = 'ocn-view'; view.setAttribute('role', 'group'); view.setAttribute('aria-label', 'View');
  view.innerHTML = '<button class="ocn-view-btn active" id="view-3d" aria-pressed="true">3D Landscape</button><button class="ocn-view-btn" id="view-2d" aria-pressed="false">2D Maps</button>'; bar.append(view);
  const note = document.createElement('p'); note.className = 'ocn-note'; note.textContent = 'Elevation follows the OCN slope-area relation, S = A^(γ−1), with the height stretched to show it. Dots ride each link downstream; the magenta dot is the outlet. Drag to turn, click a cell to move the outlet.'; bar.after(note);
  const tip = document.createElement('div'); tip.className = 'ocn-tip'; tip.hidden = true; document.body.append(tip);
  const slots = hosts.map((h, i) => new Slot(h, i)), viewBar3d = document.getElementById('view-3d'), viewBar2d = document.getElementById('view-2d');
  function setBig(i) { STATE.big = i; hosts.forEach((h, k) => { h.classList.toggle('ocn-hidden', i >= 0 && k !== i); h.classList.toggle('ocn-full', k === i); const b = h.querySelector('.ocn-big'); b.textContent = k === i ? 'Show all four' : 'Enlarge'; b.setAttribute('aria-pressed', k === i); }); CAM.dirty = true; }
  hosts.forEach((h, i) => { const b = document.createElement('button'); b.className = 'ocn-big'; b.textContent = 'Enlarge'; b.setAttribute('aria-pressed', 'false'); b.onclick = () => setBig(STATE.big === i ? -1 : i); h.append(b); });
  function setView(three) { if (!three && STATE.big >= 0) setBig(-1); STATE.on = three; document.body.classList.toggle('view-2d', !three); viewBar3d.classList.toggle('active', three); viewBar2d.classList.toggle('active', !three); viewBar3d.setAttribute('aria-pressed', three); viewBar2d.setAttribute('aria-pressed', !three); note.hidden = !three; tip.hidden = true; if (!three) dispatchEvent(new Event('resize')); CAM.dirty = true; }
  viewBar3d.onclick = () => setView(true); viewBar2d.onclick = () => setView(false);

  /* one camera for all four, so they can be compared from the same angle */
  slots.forEach(s => { let d = null; const c = s.cv;
    c.addEventListener('pointerdown', e => { d = { x: e.clientX, y: e.clientY, yaw: CAM.yaw, pitch: CAM.pitch, moved: 0 }; c.setPointerCapture(e.pointerId); c.classList.add('drag'); tip.hidden = true; });
    c.addEventListener('pointermove', e => { const r = c.getBoundingClientRect(); if (d) { const dx = e.clientX - d.x, dy = e.clientY - d.y; d.moved = Math.max(d.moved, Math.abs(dx), Math.abs(dy)); if (d.moved > 6) { CAM.yaw = d.yaw - dx / r.width * 3.2; if (e.pointerType === 'mouse') CAM.pitch = Math.max(.25, Math.min(1.35, d.pitch + dy / r.height * 1.8)); CAM.dirty = true; } return; } if (e.pointerType !== 'mouse') return; const q = s.cellAt(e.clientX - r.left, e.clientY - r.top); if (q === null) { tip.hidden = true; return; } const p = s.net.getCoords(q); tip.textContent = `Cell ${p.i + 1},${p.j + 1}: area ${Math.round(s.net.flowAccum[q])}, elevation ${s.z[q].toFixed(1)}${q === s.net.outletIdx ? ', outlet' : ''}`; tip.hidden = false; tip.style.left = Math.min(e.clientX + 12, innerWidth - 240) + 'px'; tip.style.top = e.clientY + 14 + 'px'; });
    c.addEventListener('pointerleave', () => { tip.hidden = true; });
    c.addEventListener('pointerup', e => { const was = d; d = null; c.classList.remove('drag'); if (!was || was.moved > 6 || isRacing) return; const r = c.getBoundingClientRect(), q = s.cellAt(e.clientX - r.left, e.clientY - r.top); if (q === null) return; const p = s.net.getCoords(q); networks.forEach(n => n.setOutlet((p.i + .5) / n.N, (p.j + .5) / n.N)); });
    c.addEventListener('pointercancel', () => { d = null; c.classList.remove('drag'); }); });

  function draw() { slots.forEach((s, i) => { if (STATE.big < 0 || STATE.big === i) s.frame(); }); CAM.dirty = false; }
  /* with reduced motion the dots stand still and a frame is drawn only when something changes */
  function loop() { requestAnimationFrame(loop); if (!STATE.on || document.hidden) return; if (calm && !CAM.dirty && slots.every(s => s.signature() === s.sig)) return; draw(); }
  draw(); requestAnimationFrame(loop);
  dispatchEvent(new Event('resize'));   // the tool's 2D canvases sized themselves before this script's layout rules and controls existed
  /* console checks: run the frames by hand, and test the terrain against the network it came from */
  return { get on() { return STATE.on; }, slots, setView, setBig, draw, CAM, elevation, check: i => { const n = networks[i || 0], { z, reached } = elevation(n); let uphill = 0, off = 0, zMaxDist = 0; n.computeDistances(); for (let k = 0; k < n.size; k++) { const d = n.downstream[k]; if (d >= 0 && d !== k && z[k] <= z[d]) uphill++; if (n.gamma === 1 && n.distToOutlet[k] < Infinity) { off = Math.max(off, Math.abs(z[k] - n.distToOutlet[k])); zMaxDist = Math.max(zMaxDist, z[k]); } } return { N: n.N, gamma: n.gamma, cells: n.size, reached, uphillLinks: uphill, outletHeight: z[n.outletIdx], maxDifferenceFromDistanceField: +off.toFixed(5), maxElevation: +zMaxDist.toFixed(2) }; } };
})();
