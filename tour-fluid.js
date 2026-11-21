/* The tour's visualizer: a box of water stirred by the track, colored by the velocity-gradient tensor.
   The water is a small "stable fluids" solver (Stam, 1999), the same method as /navier-stokes-demo.html and
   the home page's tank. The music stirs it, read from the track's own transform (tours/<slug>.js, ten
   columns a second, one row per semitone from C1):
     a jump in the low notes (a kick, a bass hit)   -> a jet that rolls up into a pair of opposite swirls
     the middle notes, held                          -> a slow stir going round the box
     a jump in the high notes (hats, sparkle)        -> a small poke
   Height is the spin (vorticity): clockwise swirls rise, anticlockwise ones dip. Color splits the velocity
   gradient ∇u into its two parts, on one shared scale:
     Ω = ½(∇u − ∇uᵀ)  rotation: blue clockwise, orange anticlockwise
     S = ½(∇u + ∇uᵀ)  strain, stretching and squeezing: green
   tour.js calls FTA_FLUID.load(tour) for a new track, .time(t, playing) every frame, and .mode(k) at each stop. */
(function () {
  'use strict';
  var host = document.getElementById('fluid'); if (!host) return;
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var N = 72, W2 = N + 2, SIZE = W2 * W2, ITER = 18, DAMP = .994, FLOOR = .03, DEAD = .003;
  var HS = .42, BASE = -.5;   // full surface height, and the floor of the box, in world units (the box is 2 across)
  var MODES = [[3, 'spin and stretch'], [1, 'spin only'], [2, 'stretch only']];
  var IX = function (i, j) { return i + W2 * j; };

  /* ---------- the water ---------- */
  var u = new Float32Array(SIZE), v = new Float32Array(SIZE), u0 = new Float32Array(SIZE), v0 = new Float32Array(SIZE);
  var p = new Float32Array(SIZE), dv = new Float32Array(SIZE);
  function bnd(b, x) {
    for (var k = 1; k <= N; k++) {
      x[IX(0, k)] = b === 1 ? -x[IX(1, k)] : x[IX(1, k)]; x[IX(N + 1, k)] = b === 1 ? -x[IX(N, k)] : x[IX(N, k)];
      x[IX(k, 0)] = b === 2 ? -x[IX(k, 1)] : x[IX(k, 1)]; x[IX(k, N + 1)] = b === 2 ? -x[IX(k, N)] : x[IX(k, N)];
    }
  }
  function project() {
    var i, j, k, it;
    for (j = 1; j <= N; j++) for (i = 1; i <= N; i++) { k = IX(i, j); dv[k] = -.5 * (u[k + 1] - u[k - 1] + v[k + W2] - v[k - W2]); p[k] = 0; }
    bnd(0, dv); bnd(0, p);
    for (it = 0; it < ITER; it++) { for (j = 1; j <= N; j++) for (i = 1; i <= N; i++) { k = IX(i, j); p[k] = (dv[k] + p[k - 1] + p[k + 1] + p[k - W2] + p[k + W2]) / 4; } bnd(0, p); }
    for (j = 1; j <= N; j++) for (i = 1; i <= N; i++) { k = IX(i, j); u[k] -= .5 * (p[k + 1] - p[k - 1]); v[k] -= .5 * (p[k + W2] - p[k - W2]); }
    bnd(1, u); bnd(2, v);
  }
  function advect(b, d, d0) {
    for (var j = 1; j <= N; j++) for (var i = 1; i <= N; i++) {
      var k = IX(i, j), x = Math.max(.5, Math.min(N + .5, i - u0[k])), y = Math.max(.5, Math.min(N + .5, j - v0[k]));
      var i0 = Math.floor(x), j0 = Math.floor(y), s1 = x - i0, t1 = y - j0, s0 = 1 - s1, t0 = 1 - t1;
      d[k] = s0 * (t0 * d0[IX(i0, j0)] + t1 * d0[IX(i0, j0 + 1)]) + s1 * (t0 * d0[IX(i0 + 1, j0)] + t1 * d0[IX(i0 + 1, j0 + 1)]);
    }
    bnd(b, d);
  }
  function step() {
    project();
    var t = u0; u0 = u; u = t; t = v0; v0 = v; v = t;
    advect(1, u, u0); advect(2, v, v0); project();
    for (var k = 0; k < SIZE; k++) { u[k] *= DAMP; v[k] *= DAMP; }
  }
  function push(gx, gy, fx, fy, r) {   // add velocity (fx, fy) in a soft blob of radius r cells
    var R = Math.ceil(r * 2.2), i, j, w, k;
    for (j = Math.max(1, Math.round(gy) - R); j <= Math.min(N, Math.round(gy) + R); j++)
      for (i = Math.max(1, Math.round(gx) - R); i <= Math.min(N, Math.round(gx) + R); i++) {
        w = Math.exp(-((i - gx) * (i - gx) + (j - gy) * (j - gy)) / (2 * r * r)); k = IX(i, j); u[k] += fx * w; v[k] += fy * w;
      }
  }
  function clearWater() { u.fill(0); v.fill(0); u0.fill(0); v0.fill(0); scale = FLOOR; }

  /* ---------- what the music does ---------- */
  var ev = null, lastCol = -1, kickN = 0, stirA = 0, seed = 1;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  function pct(a, q) { var s = Array.prototype.slice.call(a).sort(function (x, y) { return x - y; }); return s[Math.min(s.length - 1, Math.floor(q * s.length))] || 0; }
  function analyse(g) {   // per column: how hard the low, middle and high notes hit, scaled to this track
    var bin = atob(g.b64), R = g.rows, C = g.cols, third = Math.floor(R / 3), band = [new Float32Array(C), new Float32Array(C), new Float32Array(C)], c, r, b;
    for (r = 0; r < R; r++) { b = Math.min(2, Math.floor(r / third)); for (c = 0; c < C; c++) band[b][c] += bin.charCodeAt(r * C + c) / 255 / third; }
    function jumps(x) {   // a rise above the last column, as a share of this track's biggest rises
      var f = new Float32Array(C), out = new Float32Array(C), lo, hi;
      for (c = 1; c < C; c++) f[c] = Math.max(0, x[c] - x[c - 1]);
      lo = Math.max(.012, pct(f, .86)); hi = Math.max(lo + .01, pct(f, .99));
      for (c = 1; c < C; c++) out[c] = f[c] > lo ? Math.min(1, (f[c] - lo) / (hi - lo)) * .7 + .3 : 0;
      return out;
    }
    var mx = 0; for (c = 0; c < C; c++) mx = Math.max(mx, band[1][c]);
    var mid = new Float32Array(C); for (c = 0; c < C; c++) mid[c] = mx ? band[1][c] / mx : 0;
    return { kick: jumps(band[0]), mid: mid, high: jumps(band[2]), fps: g.fps || 10, cols: C };
  }
  function hit(c) {   // the music's events in column c
    var k = ev.kick[c], h = ev.high[c], a, r, x, y, d;
    if (k) {   // a jet: it rolls up into a pair of opposite swirls; jets walk round the box by the golden angle
      a = kickN++ * 2.39996; r = .18 + .2 * rnd(); x = 1 + (N - 1) * (.5 + r * Math.cos(a)); y = 1 + (N - 1) * (.5 + r * Math.sin(a));
      d = a + Math.PI / 2 + (rnd() - .5) * 1.4; push(x, y, Math.cos(d) * (1.2 + 2.4 * k), Math.sin(d) * (1.2 + 2.4 * k), 2.6 + 1.2 * k);
    }
    if (h) { d = rnd() * 6.283; push(4 + rnd() * (N - 7), 4 + rnd() * (N - 7), Math.cos(d) * .9 * h, Math.sin(d) * .9 * h, 1.5); }
  }
  function stir(c, dt) {   // the held middle notes: a slow push going round the box
    var m = ev.mid[c]; stirA += dt * (.35 + .5 * m);
    var x = 1 + (N - 1) * (.5 + .3 * Math.cos(stirA)), y = 1 + (N - 1) * (.5 + .3 * Math.sin(stirA)), s = .05 * m * m;
    push(x, y, -Math.sin(stirA) * s * 60 * dt, Math.cos(stirA) * s * 60 * dt, 4);
  }

  /* ---------- drawing ---------- */
  var cv = document.createElement('canvas'); cv.setAttribute('role', 'img');
  cv.setAttribute('aria-label', 'A box of water stirred by the music, seen in 3D. Low notes kick up pairs of swirls; held middle notes stir it round. Clockwise spin rises and shows blue, anticlockwise spin dips and shows orange, and stretching shows green.');
  host.appendChild(cv);
  var key = document.createElement('div'); key.className = 'fl-key'; host.appendChild(key);
  var probe = document.createElement('i'); probe.style.display = 'none'; host.appendChild(probe);
  function rgb(name, fb) { probe.style.color = ''; probe.style.color = 'var(' + name + ')'; var m = getComputedStyle(probe).color.match(/[\d.]+/g); return m && m.length >= 3 ? [m[0] / 255, m[1] / 255, m[2] / 255] : fb; }
  var CW, CCW, ST, WATER = [.075, .1, .14], WALL = [.07, .09, .13];
  function colors() { CW = rgb('--blue', [.3, .55, .95]); CCW = rgb('--orange', [.93, .55, .2]); ST = rgb('--green', [.25, .75, .45]); }
  colors();
  var mode = 3, scale = FLOOR, hscale = FLOOR, H = new Float32Array(N * N), COL = new Float32Array(N * N * 3);
  function fields() {   // the spin for height, and the decomposition for color
    var peak = 0, i, j, k, ux, uy, vx, vy, om, sxy, st, q, r, s, tot, spin, c, lift = function (x) { return x < DEAD ? 0 : Math.pow(Math.min(1, (x - DEAD) / (scale - DEAD)), .6); };
    for (j = 1; j <= N; j++) for (i = 1; i <= N; i++) {
      k = IX(i, j); ux = .5 * (u[k + 1] - u[k - 1]); uy = .5 * (u[k + W2] - u[k - W2]); vx = .5 * (v[k + 1] - v[k - 1]); vy = .5 * (v[k + W2] - v[k - W2]);
      om = .5 * (vx - uy); sxy = .5 * (uy + vx); st = Math.sqrt(ux * ux + vy * vy + 2 * sxy * sxy);
      peak = Math.max(peak, Math.abs(om), st); q = (j - 1) * N + (i - 1);
      H[q] = Math.max(-1, Math.min(1, om / hscale));
      r = mode & 1 ? lift(Math.abs(om)) : 0; s = mode & 2 ? lift(st) : 0; tot = Math.min(1, r + s); spin = om > 0 ? CW : CCW;
      for (c = 0; c < 3; c++) COL[q * 3 + c] = WATER[c] + ((r + s > 0 ? (r * spin[c] + s * ST[c]) / (r + s) : WATER[c]) - WATER[c]) * tot;
    }
    scale = Math.max(FLOOR, scale * .97, peak * .55); hscale = Math.max(FLOOR * 1.4, hscale * .985, peak * .8);   // both follow the flow down, slowly
  }

  var gl = cv.getContext('webgl2', { antialias: true }), ctx2 = gl ? null : cv.getContext('2d'), w = 0, h = 0, dpr = 1, yaw = -.6, prog, buf, ibuf, nIdx, VB, uM, uL;
  var NV = N * N + 8 * N;   // the surface, then four walls of N columns, top and bottom
  if (gl) {
    var sh = function (type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, '#version 300 es\nin vec3 p;in vec3 n;in vec3 c;uniform mat4 M;out vec3 vc;out vec3 vn;void main(){gl_Position=M*vec4(p,1.);vc=c;vn=n;}'));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, '#version 300 es\nprecision mediump float;in vec3 vc;in vec3 vn;uniform vec3 L;out vec4 o;void main(){vec3 m=normalize(vn);float d=max(dot(m,L),0.);float sp=pow(max(dot(reflect(-L,m),vec3(0.,1.,0.)),0.),28.)*.22;o=vec4(vc*(.5+.62*d)+sp,1.);}'));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl = null; ctx2 = null; }
  }
  if (gl) {
    gl.useProgram(prog); uM = gl.getUniformLocation(prog, 'M'); uL = gl.getUniformLocation(prog, 'L');
    VB = new Float32Array(NV * 9); buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, VB.byteLength, gl.DYNAMIC_DRAW);
    [['p', 0], ['n', 3], ['c', 6]].forEach(function (a) { var l = gl.getAttribLocation(prog, a[0]); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 3, gl.FLOAT, false, 36, a[1] * 4); });
    var idx = [], i, j, s, a;
    for (j = 0; j < N - 1; j++) for (i = 0; i < N - 1; i++) { a = j * N + i; idx.push(a, a + N, a + 1, a + 1, a + N, a + N + 1); }
    for (s = 0; s < 4; s++) for (i = 0; i < N - 1; i++) { a = N * N + s * 2 * N + i; idx.push(a, a + N, a + 1, a + 1, a + N, a + N + 1); }
    nIdx = idx.length; ibuf = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
  }
  function wx(i) { return i / (N - 1) * 2 - 1; }
  function put(o, x, y, z, nx, ny, nz, c) { VB[o] = x; VB[o + 1] = y; VB[o + 2] = z; VB[o + 3] = nx; VB[o + 4] = ny; VB[o + 5] = nz; VB[o + 6] = c[0]; VB[o + 7] = c[1]; VB[o + 8] = c[2]; }
  function mul(a, b) { var o = new Array(16).fill(0), c, r, k; for (c = 0; c < 4; c++) for (r = 0; r < 4; r++) for (k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; }
  function norm(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function render() {
    if (!w) return;
    if (!gl) { render2d(); return; }
    var i, j, q, o = 0, d = 2 / (N - 1), hy = function (i, j) { return H[Math.max(0, Math.min(N - 1, j)) * N + Math.max(0, Math.min(N - 1, i))] * HS; };
    for (j = 0; j < N; j++) for (i = 0; i < N; i++) {
      q = j * N + i; var nn = norm([-(hy(i + 1, j) - hy(i - 1, j)) / (2 * d), 1, -(hy(i, j + 1) - hy(i, j - 1)) / (2 * d)]);
      put(o, wx(i), H[q] * HS, wx(j), nn[0], nn[1], nn[2], [COL[q * 3], COL[q * 3 + 1], COL[q * 3 + 2]]); o += 9;
    }
    var sides = [[0, 0, 0, 0, -1], [0, 0, N - 1, 0, 1], [1, 0, 0, -1, 0], [1, 0, N - 1, 1, 0]];   // [x fixed?, unused, the fixed index, normal x, normal z]
    sides.forEach(function (S) {
      for (var t = 0; t < 2; t++) for (var k = 0; k < N; k++) {
        var ii = S[0] ? S[2] : k, jj = S[0] ? k : S[2], top = t === 0, y = top ? hy(ii, jj) : BASE, sh = top ? 1 : .55;
        put(o, wx(ii), y, wx(jj), S[3], 0, S[4], [WALL[0] * sh * 2, WALL[1] * sh * 2, WALL[2] * sh * 2]); o += 9;
      }
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, VB);
    var a = w / h, f = 1 / Math.tan(.38), ne = .1, fa = 20, P = [f / a, 0, 0, 0, 0, f, 0, 0, 0, 0, (fa + ne) / (ne - fa), -1, 0, 0, 2 * fa * ne / (ne - fa), 0];
    var R = a < 1.2 ? 3.6 : 3.1, pit = .78, eye = [R * Math.cos(pit) * Math.sin(yaw), R * Math.sin(pit), R * Math.cos(pit) * Math.cos(yaw)], tg = [0, -.12, 0];
    var z = norm([eye[0] - tg[0], eye[1] - tg[1], eye[2] - tg[2]]), x = norm(cross([0, 1, 0], z)), y = cross(z, x);
    var V = [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]), -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]), -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]), 1];
    gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(.043, .063, .086, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(prog); gl.uniformMatrix4fv(uM, false, new Float32Array(mul(P, V))); gl.uniform3fv(uL, norm([.4, 1, .55]));
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf); gl.drawElements(gl.TRIANGLES, nIdx, gl.UNSIGNED_SHORT, 0);
  }
  var off2, img2;
  function render2d() {   // no WebGL2: the same colors, seen from above
    if (!ctx2) return;
    if (!off2) { off2 = document.createElement('canvas'); off2.width = N; off2.height = N; img2 = off2.getContext('2d').createImageData(N, N); }
    for (var q = 0; q < N * N; q++) { var sh = .85 + .15 * H[q]; for (var c = 0; c < 3; c++) img2.data[q * 4 + c] = Math.min(255, COL[q * 3 + c] * 255 * sh); img2.data[q * 4 + 3] = 255; }
    off2.getContext('2d').putImageData(img2, 0, 0);
    ctx2.fillStyle = '#0B1016'; ctx2.fillRect(0, 0, cv.width, cv.height);
    var s = Math.min(cv.width, cv.height) * .92; ctx2.imageSmoothingEnabled = true; ctx2.drawImage(off2, (cv.width - s) / 2, (cv.height - s) / 2, s, s);
  }
  function size() {
    var b = host.getBoundingClientRect(); w = b.width; h = b.height; dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); render();
  }
  function setKey() {
    var m = MODES.filter(function (x) { return x[0] === mode; })[0];
    key.innerHTML = (mode & 1 ? '<span><i style="background:var(--blue)"></i>spin ↻</span><span><i style="background:var(--orange)"></i>spin ↺</span>' : '') +
      (mode & 2 ? '<span><i style="background:var(--green)"></i>stretch</span>' : '') + '<em>' + m[1] + '</em>';
  }

  /* ---------- time: the audio clock drives everything ---------- */
  var raf = 0, playing = false, lastT = 0, seen = true, idle = 0;
  function advance(t, dt) {   // fire every column the clock has passed, then stir and step
    if (!ev) return;
    var c = Math.min(ev.cols - 1, Math.floor(t * ev.fps));
    if (c < lastCol - 1 || c > lastCol + 6) lastCol = c;   // a seek: no burst of old events
    while (lastCol < c) { lastCol++; hit(lastCol); }
    stir(Math.max(0, c), dt); step();
  }
  function frame(now) {
    raf = 0; if (!seen) return;
    var dt = Math.min(.05, (now - (lastT || now)) / 1000); lastT = now;
    if (playing) { advance(api.clock(), dt); idle = 0; yaw += dt * .05; }
    else { step(); idle += dt; }
    fields(); render();
    if (playing || idle < 4) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && seen && !calm) { lastT = 0; raf = requestAnimationFrame(frame); } }
  function still(t) {   // reduced motion: play the last few seconds of the music into the water, show one frame
    if (!ev) return; clearWater(); seed = 1; kickN = 0; var c1 = Math.floor(t * ev.fps), c0 = Math.max(0, c1 - 40);
    for (var c = c0; c <= c1; c++) { hit(c); stir(c, .1); step(); step(); step(); }
    lastCol = c1; fields(); render();
  }
  function seedWater() {   // a few swirls, so the box is never flat before Play
    clearWater(); seed = 7; kickN = 0;
    for (var n = 0; n < 5; n++) { var a = n * 2.39996, x = 1 + (N - 1) * (.5 + .25 * Math.cos(a)), y = 1 + (N - 1) * (.5 + .25 * Math.sin(a)), d = a + 1.7; push(x, y, Math.cos(d) * 2.2, Math.sin(d) * 2.2, 3); for (var k = 0; k < 6; k++) step(); }
    for (var k2 = 0; k2 < 30; k2++) step();
  }

  var api = window.FTA_FLUID = {
    clock: function () { return 0; },
    load: function (tour, t) { ev = analyse(tour.gram); lastCol = Math.floor((t || 0) * ev.fps) - 1; mode = 3; setKey(); if (calm) still(t || 0); else { seedWater(); fields(); render(); kick(); } },
    time: function (t, isPlaying) { if (!ev) return; var was = playing; playing = isPlaying; if (calm) { if (!isPlaying || Math.abs(t * ev.fps - lastCol) > 20) still(t); return; } if (isPlaying && !was) idle = 0; kick(); },
    mode: function (k) { mode = MODES[k % MODES.length][0]; setKey(); fields(); render(); if (calm && ev) render(); }
  };
  new ResizeObserver(size).observe(host);
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { seen = es[0].isIntersecting; if (seen) kick(); }).observe(host);
  addEventListener('fta-theme', function () { colors(); fields(); render(); });
  setKey(); size();
})();
