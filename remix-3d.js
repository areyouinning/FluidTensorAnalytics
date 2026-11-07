/* The DataGenetics remixes, in raw WebGL2. One small renderer (coloured points and lines, a drag-to-orbit camera) and one experiment per page, chosen by body[data-remix].
   Everything shown is computed: the sphere's readouts count the points on screen, the chase steps the sight-line geometry directly. */
'use strict';
window.REMIX = (() => {
  const $ = id => document.getElementById(id), cv = $('gl'), gl = cv.getContext('webgl2', { antialias: true, alpha: false });
  if (!gl) return null;
  document.body.classList.add('live');
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches, narrow = innerWidth <= 1000, TAU = Math.PI * 2;
  const INK = { white: [1, 1, 1], ice: [.66, .84, 1], cyan: [.39, .78, 1], mint: [.5, .89, .77], coral: [1, .54, .36], night: '#0A1628' };
  const css = c => `rgb(${c.map(x => Math.round(x * 255)).join(',')})`;

  /* ---------- renderer */
  const mk = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
  const P = gl.createProgram(); gl.attachShader(P, mk(gl.VERTEX_SHADER, `#version 300 es
    layout(location=0) in vec3 aP; layout(location=1) in vec4 aC; uniform mat4 uVP; uniform float uPx; out vec4 vC;
    void main(){ vC=aC; gl_Position=uVP*vec4(aP,1.); gl_PointSize=uPx; }`)); gl.attachShader(P, mk(gl.FRAGMENT_SHADER, `#version 300 es
    precision highp float; in vec4 vC; uniform float uRound; out vec4 o;
    void main(){ if(uRound>.5){ vec2 q=gl_PointCoord*2.-1.; if(dot(q,q)>1.) discard; } o=vC; }`)); gl.linkProgram(P); if (!gl.getProgramParameter(P, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(P));
  const U = { vp: gl.getUniformLocation(P, 'uVP'), px: gl.getUniformLocation(P, 'uPx'), round: gl.getUniformLocation(P, 'uRound') };
  const vao = gl.createVertexArray(), buf = gl.createBuffer(); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12);
  gl.useProgram(P); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.clearColor(.039, .086, .157, 1);
  class Batch { constructor(n) { this.a = new Float32Array(n * 7); this.n = 0; } clear() { this.n = 0; } add(x, y, z, c, al = 1) { if ((this.n + 1) * 7 > this.a.length) return; const o = this.n++ * 7, a = this.a; a[o] = x; a[o + 1] = y; a[o + 2] = z; a[o + 3] = c[0]; a[o + 4] = c[1]; a[o + 5] = c[2]; a[o + 6] = al; } seg(p, q, c, al = 1) { this.add(p[0], p[1], p[2], c, al); this.add(q[0], q[1], q[2], c, al); }
    draw(mode, px = 2) { if (!this.n) return; gl.bufferData(gl.ARRAY_BUFFER, this.a.subarray(0, this.n * 7), gl.DYNAMIC_DRAW); gl.uniform1f(U.px, px * dp); gl.uniform1f(U.round, mode === gl.POINTS ? 1 : 0); gl.drawArrays(mode, 0, this.n); } }

  /* ---------- camera: narrow pages look at the part of the stage above the readouts */
  const CAM = { yaw: .6, pitch: .28, dist: 4.2, target: [0, 0, 0], spin: 0 }; let w = 0, h = 0, dp = 1, dirty = true;
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], unit = a => { const l = Math.hypot(...a) || 1; return a.map(x => x / l); }, sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
  function size() { const r = cv.getBoundingClientRect(); w = r.width; h = r.height; if (!w || !h) return; dp = Math.min(devicePixelRatio || 1, 2); cv.width = Math.round(w * dp); cv.height = Math.round(h * dp); gl.viewport(0, 0, cv.width, cv.height); dirty = true; }
  function viewProj() { const t = CAM.target, ch = Math.cos(CAM.pitch), e = [t[0] + CAM.dist * ch * Math.sin(CAM.yaw), t[1] + CAM.dist * Math.sin(CAM.pitch), t[2] + CAM.dist * ch * Math.cos(CAM.yaw)], f = unit(sub(t, e)), s = unit(cross(f, [0, 1, 0])), u = cross(s, f);
    const V = [s[0], u[0], -f[0], 0, s[1], u[1], -f[1], 0, s[2], u[2], -f[2], 0, -dot(s, e), -dot(u, e), dot(f, e), 1], n = .05, a = 60, tan = 1 / Math.tan(.42), asp = w / h, fit = Math.min(1, asp / .95);
    const Pm = [tan * fit / asp, 0, 0, 0, 0, tan * fit, 0, 0, 0, 0, (a + n) / (n - a), -1, 0, 0, 2 * a * n / (n - a), 0]; return mul(Pm, V); }
  let drag = null; cv.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId); cv.classList.add('drag'); });
  cv.addEventListener('pointermove', e => { if (!drag) return; CAM.yaw -= (e.clientX - drag[0]) * .006; CAM.pitch = Math.max(-1.3, Math.min(1.3, CAM.pitch + (e.clientY - drag[1]) * .006)); drag = [e.clientX, e.clientY]; CAM.spin = 0; dirty = true; });
  const end = () => { drag = null; cv.classList.remove('drag'); }; cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.tabIndex = 0; cv.setAttribute('role', 'img'); cv.addEventListener('keydown', e => { const d = { ArrowLeft: [-.1, 0], ArrowRight: [.1, 0], ArrowUp: [0, .1], ArrowDown: [0, -.1] }[e.key]; if (d) { CAM.yaw += d[0]; CAM.pitch = Math.max(-1.3, Math.min(1.3, CAM.pitch + d[1])); CAM.spin = 0; dirty = true; e.preventDefault(); } });

  /* ---------- page furniture */
  const lines = new Batch(40000), points = new Batch(30000), big = new Batch(3000);
  const chart = $('chart'), g2 = chart.getContext('2d');
  function chartStart() { const r = chart.getBoundingClientRect(), s = Math.min(devicePixelRatio || 1, 2); if (chart.width !== Math.round(r.width * s)) { chart.width = Math.round(r.width * s); chart.height = Math.round(r.height * s); } g2.setTransform(s, 0, 0, s, 0, 0); g2.clearRect(0, 0, r.width, r.height); g2.font = '12px -apple-system, Segoe UI, Roboto, sans-serif'; g2.textBaseline = 'middle'; return [r.width, r.height]; }
  function read(title, rows) { $('read').innerHTML = `<b>${title}</b><dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`; }
  function button(text, on, pressed) { const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.addEventListener('click', on); if (pressed !== undefined) b.setAttribute('aria-pressed', pressed); $('ctl').append(b); return b; }
  function group(items, pick, first) { const bs = items.map(([k, t]) => { const b = button(t, () => { bs.forEach(x => x.setAttribute('aria-pressed', x === b)); pick(k); }, k === first); return b; }); }
  function slider(text, min, max, step, val, fmt, on) { const l = document.createElement('label'), i = document.createElement('input'), o = document.createElement('output'); l.append(text + ' ', i, o); Object.assign(i, { type: 'range', min, max, step, value: val }); i.setAttribute('aria-label', text); o.textContent = fmt(val); i.addEventListener('input', () => { o.textContent = fmt(+i.value); on(+i.value); }); $('ctl').append(l); }

  /* ---------- random points in a sphere */
  const METHODS = {
    discard: { name: 'Throw away', draws: 3 / (Math.PI / 6), gen(o) { for (;;) { const x = Math.random() * 2 - 1, y = Math.random() * 2 - 1, z = Math.random() * 2 - 1; if (x * x + y * y + z * z < 1) { o[0] = x; o[1] = y; o[2] = z; return; } if (o.miss) o.miss.push(x, y, z); } } },
    norm: { name: 'Stretch a cube', draws: 4, gen(o) { const x = Math.random() * 2 - 1, y = Math.random() * 2 - 1, z = Math.random() * 2 - 1, d = Math.random() / Math.hypot(x, y, z); o[0] = x * d; o[1] = y * d; o[2] = z * d; } },
    polar: { name: 'Plain angles', draws: 3, gen(o) { const t = Math.random() * TAU, p = Math.random() * Math.PI, r = Math.random(); o[0] = r * Math.sin(p) * Math.cos(t); o[1] = r * Math.sin(p) * Math.sin(t); o[2] = r * Math.cos(p); } },
    fixed: { name: 'Corrected angles', draws: 3, gen(o) { const t = Math.random() * TAU, p = Math.acos(2 * Math.random() - 1), r = Math.cbrt(Math.random()); o[0] = r * Math.sin(p) * Math.cos(t); o[1] = r * Math.sin(p) * Math.sin(t); o[2] = r * Math.cos(p); } }
  };
  const CORNERS = []; for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) CORNERS.push(unit([a, b, c]));
  const FACES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  function measure(pts) {   // ratios are 1 for an even scatter: all compare a count with the share of the ball's volume it should hold
    const n = pts.length / 3, shell = new Array(10).fill(0); let pole = 0, corner = 0, face = 0; const c30 = Math.cos(Math.PI / 6), c20 = Math.cos(Math.PI / 9);
    for (let i = 0; i < n; i++) { const x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2], r = Math.hypot(x, y, z) || 1e-9; shell[Math.min(9, Math.floor(r * r * r * 10))]++; const u = [x / r, y / r, z / r]; if (Math.abs(u[2]) > c30) pole++; if (Math.max(...CORNERS.map(c => dot(c, u))) > c20) corner++; if (Math.max(...FACES.map(c => dot(c, u))) > c20) face++; }
    return { shell: shell.map(s => s / n * 10), pole: pole / n / (1 - c30), corner: (corner / 8) / (face / 6) };
  }
  function sphere() {
    const N = narrow ? 3500 : 8000, S = { m: 'discard', slice: 1, pts: new Float32Array(N * 3), miss: [], stats: null };
    function fill() { const o = [0, 0, 0]; o.miss = S.m === 'discard' ? [] : null; for (let i = 0; i < N; i++) { METHODS[S.m].gen(o); S.pts[i * 3] = o[0]; S.pts[i * 3 + 1] = o[1]; S.pts[i * 3 + 2] = o[2]; } S.miss = o.miss || []; S.stats = measure(S.pts); dirty = true; hud(); }
    function hud() { const st = S.stats, [W, H] = chartStart(), m = 8, top = 22, bot = H - 18, bw = (W - 2 * m) / 10, y = v => bot - Math.min(v, 5) / 5 * (bot - top);
      g2.fillStyle = css(INK.ice); g2.textAlign = 'left'; g2.fillText('Points per shell, ten shells of equal volume, centre at left', m, 11);
      st.shell.forEach((v, i) => { g2.fillStyle = css(v > 1.25 ? INK.coral : INK.cyan); g2.beginPath(); g2.roundRect(m + i * bw + 1, y(v), bw - 2, bot - y(v), [3, 3, 0, 0]); g2.fill(); });
      g2.strokeStyle = css(INK.white); g2.setLineDash([4, 3]); g2.beginPath(); g2.moveTo(m, y(1)); g2.lineTo(W - m, y(1)); g2.stroke(); g2.setLineDash([]); g2.fillStyle = css(INK.white); g2.textAlign = 'right'; g2.fillText('even', W - m, y(1) - 8);
      g2.textAlign = 'left'; g2.fillStyle = css(INK.ice); g2.fillText('centre', m, H - 8); g2.textAlign = 'right'; g2.fillText('skin', W - m, H - 8);
      read(METHODS[S.m].name, [['Random numbers per point', METHODS[S.m].draws.toFixed(1)], ['Thrown away', S.m === 'discard' ? (S.miss.length / 3 / (S.miss.length / 3 + N) * 100).toFixed(1) + '%' : '0%'], ['Centre crowding', '×' + st.shell[0].toFixed(2)], ['Pole crowding', '×' + st.pole.toFixed(2)], ['Corners over faces', '×' + st.corner.toFixed(2)]]); }
    group(Object.entries(METHODS).map(([k, v]) => [k, v.name]), k => { S.m = k; fill(); }, 'discard');
    slider('Slice', .04, 1, .01, 1, v => v >= 1 ? 'all' : v.toFixed(2), v => { S.slice = v; dirty = true; });
    button('New points', fill);
    CAM.dist = 4.1; CAM.spin = calm ? 0 : .12; CAM.pitch = .12; cv.setAttribute('aria-label', 'A cloud of random points inside a ball, inside a cube');
    fill();
    return { S, measure, scene(dt) { lines.clear(); points.clear(); big.clear(); const box = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]; for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) lines.seg(box[a], box[b], INK.ice, .22);
      for (let i = 0; i < 96; i++) { const a = i / 96 * TAU, b = (i + 1) / 96 * TAU; lines.seg([Math.cos(a), 0, Math.sin(a)], [Math.cos(b), 0, Math.sin(b)], INK.ice, .3); lines.seg([Math.cos(a), Math.sin(a), 0], [Math.cos(b), Math.sin(b), 0], INK.ice, .3); }
      lines.seg([0, -1.25, 0], [0, 1.25, 0], INK.mint, .5);
      /* the post's z axis, its polar axis, is drawn upward */
      const s = S.slice; for (let i = 0; i < N; i++) { const x = S.pts[i * 3], y = S.pts[i * 3 + 1], z = S.pts[i * 3 + 2]; if (s >= 1 || Math.abs(x * Math.sin(CAM.yaw) + y * Math.cos(CAM.yaw)) < s) points.add(x, z, y, INK.white, s >= 1 ? .72 : .95); }
      if (S.m === 'discard' && s >= 1) { const q = S.miss, n = Math.min(q.length / 3, 2500); for (let i = 0; i < n; i++) big.add(q[i * 3], q[i * 3 + 2], q[i * 3 + 1], INK.coral, .5); } lines.draw(gl.LINES); big.draw(gl.POINTS, 1.8); points.draw(gl.POINTS, s >= 1 ? 1.8 : 2.6); },
      needs: () => CAM.spin !== 0 };
  }

  /* ---------- motion camouflage. The prey wanders at speed 1; the hunter takes the point of the prey-to-tree line it can reach this step, and a second hunter runs straight at the prey for comparison */
  function camouflage() {
    const DT = .02, CATCH = .06, S = { ratio: 1.1, P: [0, 0, 0], u: [1, 0, 0], H: [0, 0, 0], Q: [0, 0, 0], t: 0, tP: [], tH: [], tQ: [], offH: 0, offQ: 0, maxH: 0, blown: 0, done: 0, hold: 0, wob: [0, 0, 0], eye: [], running: !calm };
    const norm = unit, len = a => Math.hypot(...a), add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
    const offAngle = H => { const a = norm(sub([0, 0, 0], S.P)), b = norm(sub(H, S.P)); return Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * 180 / Math.PI; };
    function restart() { const a = Math.random() * TAU; S.P = [2.6 * Math.cos(a), .7 + Math.random() * .6, 2.6 * Math.sin(a)]; S.u = norm(cross(S.P, [0, 1, 0])); const d = norm(S.P); S.H = d.map(x => x * .55); S.Q = S.H.slice(); S.t = 0; S.tP = []; S.tH = []; S.tQ = []; S.eye = []; S.maxH = 0; S.blown = 0; S.done = 0; S.hold = 0; dirty = true; }
    function huntStep(s) {   // the sphere of reach around H cut by the line from the tree through the prey. Larger root: closer to the prey
      const d = norm(S.P), b = dot(S.H, d), disc = b * b - dot(S.H, S.H) + s * s;
      if (disc >= 0) { const r = Math.min(len(S.P), b + Math.sqrt(disc)); S.H = d.map(x => x * r); return true; }
      S.H = add(S.H, norm(sub(d.map(x => x * b), S.H)), s); return false; }
    function tick() { for (let i = 0; i < 3; i++) S.wob[i] += (Math.random() - .5) * .35 - S.wob[i] * .02; let steer = add(S.wob, S.P, -.12 * Math.max(0, len(S.P) - 2.3)); steer[1] -= (S.P[1] - .8) * .6; const rad = norm(S.P), inward = dot(steer, rad); if (len(S.P) < 2 && inward < 0) steer = add(steer, rad, -inward * 1.5); S.u = norm(add(S.u, steer, DT * 2.2)); S.P = add(S.P, S.u, DT);
      const s = S.ratio * DT; if (!huntStep(s)) S.blown += DT; S.Q = add(S.Q, norm(sub(S.P, S.Q)), s); S.t += DT; S.offH = offAngle(S.H); S.offQ = offAngle(S.Q); S.maxH = Math.max(S.maxH, S.offH);
      if (S.frameN = (S.frameN || 0) + 1, S.frameN % 3 === 0) { for (const [k, v] of [['tP', S.P], ['tH', S.H], ['tQ', S.Q]]) { S[k].push(v); if (S[k].length > 500) S[k].shift(); } } if (len(sub(S.P, S.H)) < CATCH) S.done = S.t; }
    function jink() { const sight = norm(sub(S.H, S.P)); let v = cross(sight, [0, 1, 0]); if (Math.random() < .5) v = v.map(x => -x); S.u = norm(v); for (let i = 0; i < 3; i++) S.wob[i] = v[i] * 1.5; }
    function basis() { const f = norm(sub([0, 0, 0], S.P)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f); return [f, r, u]; }
    function hud() { const [W, H] = chartStart(), cx = W / 2, cy = H / 2 + 8, [f, r, u] = basis(), scale = (H / 2 - 12) / 25, mark = (v, c, rad) => { const d = norm(sub(v, S.P)), fw = dot(d, f); if (fw <= 0) return; const px = Math.atan2(dot(d, r), fw) * 180 / Math.PI, py = Math.atan2(dot(d, u), fw) * 180 / Math.PI, X = cx + Math.max(-W / 2 + 6, Math.min(W / 2 - 6, px * scale)), Y = cy - Math.max(-25, Math.min(25, py)) * scale; g2.fillStyle = css(c); g2.beginPath(); g2.arc(X, Y, rad, 0, TAU); g2.fill(); };
      g2.fillStyle = css(INK.ice); g2.textAlign = 'left'; g2.fillText("The prey's eye, looking at the tree", 8, 11); g2.strokeStyle = css(INK.ice); g2.globalAlpha = .35; for (const a of [10, 20]) { g2.beginPath(); g2.arc(cx, cy, a * scale, 0, TAU); g2.stroke(); } g2.globalAlpha = 1;
      mark([0, 0, 0], INK.mint, 9); mark(S.Q, INK.coral, Math.min(14, 1.2 / len(sub(S.Q, S.P)) + 2)); mark(S.H, INK.white, Math.min(14, 1 / len(sub(S.H, S.P)) + 1.5));
      read(S.done ? 'Caught at t = ' + S.done.toFixed(1) : 'Chasing', [['Hunter off the tree', S.offH.toFixed(S.offH < 1 ? 3 : 1) + '°'], ['Runner off the tree', S.offQ.toFixed(1) + '°'], ['Hunter to prey', len(sub(S.P, S.H)).toFixed(2)], ['Time out of cover', S.blown.toFixed(1)]]); }
    slider('Hunter speed', .7, 2, .05, 1.1, v => v.toFixed(2) + '×', v => { S.ratio = v; });
    button('Jink', jink); button('New chase', restart);
    const pause = button(calm ? 'Play' : 'Pause', () => { S.running = !S.running; pause.textContent = S.running ? 'Pause' : 'Play'; });
    CAM.dist = 7.4; CAM.pitch = .42; CAM.target = [0, .5, 0]; cv.setAttribute('aria-label', 'A prey, a hunter and a runner in flight above a marked tree');
    restart();
    return { S, tick, jink, restart, offAngle, step(dt) { if (!S.running) return; if (S.done) { S.hold += dt; if (S.hold > 2.5) restart(); dirty = true; hud(); return; } for (let k = 0, n = Math.round(Math.min(dt, .05) / DT * .3 + Math.random() - .5) ; k < n && !S.done; k++) tick(); dirty = true; hud(); },
      scene() { lines.clear(); points.clear(); big.clear(); for (let i = -4; i <= 4; i++) { lines.seg([i, 0, -4], [i, 0, 4], INK.ice, .1); lines.seg([-4, 0, i], [4, 0, i], INK.ice, .1); } lines.seg([0, 0, 0], [0, .45, 0], INK.mint, 1);
        const trail = (a, c) => { for (let i = 1; i < a.length; i++) lines.seg(a[i - 1], a[i], c, .15 + .75 * i / a.length); }; trail(S.tP, INK.cyan); trail(S.tH, INK.white); trail(S.tQ, INK.coral); lines.seg([0, .0, 0], S.P, INK.mint, .4);
        big.add(0, .45, 0, INK.mint); big.add(...S.P, INK.cyan); big.add(...S.H, INK.white); big.add(...S.Q, INK.coral); lines.draw(gl.LINES); big.draw(gl.POINTS, 8); }, needs: () => S.running };
  }

  /* ---------- run */
  const X = { sphere, camouflage }[document.body.dataset.remix]();
  function draw() { gl.clear(gl.COLOR_BUFFER_BIT); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.uniformMatrix4fv(U.vp, false, viewProj()); X.scene(); dirty = false; }
  addEventListener('resize', size); size();
  let last = performance.now(); function loop(t) { const dt = Math.min(.1, (t - last) / 1000); last = t; if (CAM.spin) { CAM.yaw += CAM.spin * dt; dirty = true; } if (X.step) X.step(dt); if (dirty && w && h) draw(); requestAnimationFrame(loop); } requestAnimationFrame(loop);
  draw();
  return { X, CAM, draw, check: () => gl.getError(), METHODS };
})();
