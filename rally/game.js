/* Kiddo's Monster Rally: the 3D race. Uses the global THREE (r128, loaded by the page).
   An arcade model, tuned for small hands: the truck drives itself forward, the player only steers,
   grass slows you down, and soft walls keep everyone near the track. */
const T = () => window.THREE;

// ---- terrain and track -------------------------------------------------------------------------
export function height(x, z) {   // gentle rolling hills, in meters
  return 3.2 * Math.sin(x * .021) * Math.cos(z * .017) + 1.6 * Math.sin((x + z) * .037) + .8 * Math.cos(x * .061 - z * .043);
}
const CTRL = [[0, -150], [95, -135], [165, -70], [150, 20], [175, 105], [95, 160], [5, 115], [-60, 160], [-150, 120], [-165, 25], [-110, -40], [-145, -115], [-70, -160]];
export const ROAD_W = 16, LAPS = 3;

export function buildTrackPath(N = 600) {
  const THREE = T(), pts = CTRL.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  const P = curve.getSpacedPoints(N).slice(0, N);
  const S = P.map((p, i) => {
    const q = P[(i + 1) % N], r = P[(i - 1 + N) % N], tx = q.x - r.x, tz = q.z - r.z, L = Math.hypot(tx, tz);
    return { x: p.x, z: p.z, y: height(p.x, p.z), tx: tx / L, tz: tz / L, nx: -tz / L, nz: tx / L };
  });
  let len = 0; for (let i = 0; i < N; i++) { const a = S[i], b = S[(i + 1) % N]; a.s = len; len += Math.hypot(b.x - a.x, b.z - a.z); }
  return { S, N, len };
}
export function nearest(track, x, z, hint) {   // index of the closest sample, searched near the hint
  const { S, N } = track; let best = -1, bd = 1e18;
  const scan = (from, to) => { for (let k = from; k <= to; k++) { const i = ((k % N) + N) % N, d = (S[i].x - x) ** 2 + (S[i].z - z) ** 2; if (d < bd) { bd = d; best = i; } } };
  if (hint == null) scan(0, N - 1); else scan(hint - 40, hint + 40);
  const s = S[best], lat = (x - s.x) * s.nx + (z - s.z) * s.nz;
  return { i: best, lat, d: Math.sqrt(bd) };
}

// ---- trucks -------------------------------------------------------------------------------------
export const PAINTS = ['#FF4D4D', '#FF8C42', '#FFD23F', '#2BD4C2', '#4D94EA', '#7B5CFF', '#FF6FB5', '#3C3A55'];
export const WHEELS = ['chunky', 'spiky', 'classic'];
export const DECALS = ['none', 'flames', 'stars', 'stripes', 'lightning'];

function decalTexture(kind, base) {
  const THREE = T(), c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 256, 128);
  if (kind === 'flames') { const grd = g.createLinearGradient(0, 0, 256, 0); grd.addColorStop(0, '#FFD23F'); grd.addColorStop(1, '#FF4D4D'); g.fillStyle = grd; g.beginPath(); g.moveTo(0, 128); for (let i = 0; i <= 8; i++) { g.quadraticCurveTo(i * 30 + 10, 40 - (i % 2) * 30, i * 30 + 25, 128 - 20 * (i % 3)); } g.lineTo(0, 128); g.fill(); }
  if (kind === 'stars') { g.fillStyle = '#FFFDF7'; [[50, 64, 26], [130, 50, 18], [200, 74, 22]].forEach(([x, y, r]) => { g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * .45 : r; g.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); } g.fill(); }); }
  if (kind === 'stripes') { g.fillStyle = '#FFFDF7'; g.fillRect(0, 44, 256, 14); g.fillRect(0, 70, 256, 14); }
  if (kind === 'lightning') { g.fillStyle = '#FFD23F'; g.beginPath(); g.moveTo(30, 30); g.lineTo(150, 50); g.lineTo(120, 70); g.lineTo(230, 100); g.lineTo(90, 82); g.lineTo(120, 62); g.closePath(); g.fill(); }
  const t = new THREE.CanvasTexture(c); return t;
}

export function buildTruck(look) {
  const THREE = T(), root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const paint = new THREE.MeshLambertMaterial({ color: look.paint }), dark = new THREE.MeshLambertMaterial({ color: '#22203F' });
  const side = new THREE.MeshLambertMaterial({ map: decalTexture(look.decal, look.paint) });
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.4, .9, 4.2), [side, side, paint, paint, paint, paint]);   // +x, −x sides carry the decal
  chassis.position.y = 2.2; body.add(chassis);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.1, 1.9), paint); cab.position.set(0, 3.15, -.3); body.add(cab);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.9, .7, .05), new THREE.MeshLambertMaterial({ color: '#BFE6FF' })); glass.position.set(0, 3.25, .67); body.add(glass);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(2.6, .3, .3), dark); bar.position.set(0, 1.9, 2.2); body.add(bar);
  // big wheels on struts
  const wheels = [], tire = new THREE.MeshLambertMaterial({ color: '#2A2838' }), hub = new THREE.MeshLambertMaterial({ color: look.rim || '#C9C6D9' });
  [[-1.55, 1.45], [1.55, 1.45], [-1.55, -1.45], [1.55, -1.45]].forEach(([x, z]) => {
    const w = new THREE.Group(); w.position.set(x, 1.1, z);
    const r = look.wheel === 'classic' ? 1.0 : 1.15;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, .9, 18), tire); t.rotation.z = Math.PI / 2; w.add(t);
    const h = new THREE.Mesh(new THREE.CylinderGeometry(r * .5, r * .5, .95, 12), hub); h.rotation.z = Math.PI / 2; w.add(h);
    if (look.wheel === 'spiky') for (let k = 0; k < 8; k++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(.16, .5, 6), hub); const a = k * Math.PI / 4; sp.position.set(x > 0 ? .5 : -.5, Math.sin(a) * .3, Math.cos(a) * .3); sp.rotation.z = x > 0 ? -Math.PI / 2 : Math.PI / 2; w.add(sp); }
    if (look.wheel === 'chunky') for (let k = 0; k < 10; k++) { const tr = new THREE.Mesh(new THREE.BoxGeometry(.95, .22, .3), tire); const a = k * Math.PI / 5; tr.position.set(0, Math.sin(a) * r, Math.cos(a) * r); tr.rotation.x = -a; w.add(tr); }
    root.add(w); wheels.push(w);
  });
  // a shield bubble, hidden until needed
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(3.6, 20, 14), new THREE.MeshLambertMaterial({ color: '#8FD3FF', transparent: true, opacity: .32 }));
  bubble.position.y = 2.2; bubble.visible = false; root.add(bubble);
  return { root, body, wheels, bubble };
}

// ---- the race ------------------------------------------------------------------------------------
export const ITEMS = { nitro: { name: 'Nitro', icon: '🔥' }, mud: { name: 'Mud ball', icon: '🟤' }, shield: { name: 'Bubble', icon: '🫧' }, spring: { name: 'Spring', icon: '🌀' } };
const VMAX = 30, VGRASS = 15, VNITRO = 46;

export function createRace(canvas, opt) {
  const THREE = T(), renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#8FD3FF'); scene.fog = new THREE.Fog('#BDE6FF', 120, 380);
  const cam = new THREE.PerspectiveCamera(68, 1, .5, 1000);
  scene.add(new THREE.HemisphereLight('#FFFFFF', '#6CC04A', .85));
  const sun = new THREE.DirectionalLight('#FFFFFF', .7); sun.position.set(80, 140, 40); scene.add(sun);
  const track = buildTrackPath(), { S, N } = track;

  // ground
  const gg = new THREE.PlaneGeometry(700, 700, 140, 140); gg.rotateX(-Math.PI / 2);
  const gp = gg.attributes.position, gc = [];
  for (let i = 0; i < gp.count; i++) { const x = gp.getX(i), z = gp.getZ(i), y = height(x, z); gp.setY(i, y); const k = .5 + .5 * Math.sin(x * .05) * Math.cos(z * .07); gc.push(.36 + .08 * k, .66 + .08 * k, .24); }
  gg.setAttribute('color', new THREE.Float32BufferAttribute(gc, 3)); gg.computeVertexNormals();
  scene.add(new THREE.Mesh(gg, new THREE.MeshLambertMaterial({ vertexColors: true })));
  // road: a ribbon that follows the ground across its width
  const rv = [], ri = [], rc = [], ACROSS = 6;
  for (let i = 0; i <= N; i++) { const s = S[i % N]; for (let k = 0; k <= ACROSS; k++) { const u = (k / ACROSS - .5) * ROAD_W, x = s.x + s.nx * u, z = s.z + s.nz * u; rv.push(x, height(x, z) + .08, z); const edge = k === 0 || k === ACROSS, stripe = (Math.floor(i / 6) % 2 === 0); rc.push(...(edge ? (stripe ? [1, .3, .3] : [1, 1, 1]) : [.85, .55, .25])); } }
  for (let i = 0; i < N; i++) for (let k = 0; k < ACROSS; k++) { const a = i * (ACROSS + 1) + k, b = a + ACROSS + 1; ri.push(a, b, a + 1, a + 1, b, b + 1); }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rv, 3)); rg.setAttribute('color', new THREE.Float32BufferAttribute(rc, 3)); rg.setIndex(ri); rg.computeVertexNormals();
  scene.add(new THREE.Mesh(rg, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  // start line, an arch, trees and rocks off the road
  const s0 = S[0];
  const check = document.createElement('canvas'); check.width = 64; check.height = 8; const cg = check.getContext('2d'); for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { cg.fillStyle = (i + j) % 2 ? '#22203F' : '#FFFFFF'; cg.fillRect(i * 4, j * 4, 4, 4); }
  const line = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(check) }));
  line.rotation.x = -Math.PI / 2; line.rotation.z = -Math.atan2(s0.nz, s0.nx); line.position.set(s0.x, s0.y + .15, s0.z); scene.add(line);
  const archM = new THREE.MeshLambertMaterial({ color: '#FFD23F' });
  [-1, 1].forEach(sd => { const p = new THREE.Mesh(new THREE.BoxGeometry(1, 9, 1), archM); p.position.set(s0.x + s0.nx * sd * (ROAD_W / 2 + 1), s0.y + 4.5, s0.z + s0.nz * sd * (ROAD_W / 2 + 1)); scene.add(p); });
  const top = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W + 3, 1.6, 1), new THREE.MeshLambertMaterial({ color: '#FF4D4D' })); top.position.set(s0.x, s0.y + 9, s0.z); top.rotation.y = -Math.atan2(s0.nz, s0.nx); scene.add(top);
  const RS = (() => { let q = 99; return () => (q = (q * 16807) % 2147483647) / 2147483647; })();
  const treeG = new THREE.ConeGeometry(3, 9, 7), trunkG = new THREE.CylinderGeometry(.5, .6, 2.5, 6), treeM = new THREE.MeshLambertMaterial({ color: '#2E8B57' }), trunkM = new THREE.MeshLambertMaterial({ color: '#7A4B26' }), rockM = new THREE.MeshLambertMaterial({ color: '#9C98B5' }), rockG = new THREE.DodecahedronGeometry(2.2);
  for (let k = 0; k < 230; k++) {
    const x = (RS() - .5) * 640, z = (RS() - .5) * 640, nr = nearest(track, x, z); if (nr.d < ROAD_W / 2 + 10) continue;
    const y = height(x, z);
    if (RS() < .8) { const t = new THREE.Mesh(treeG, treeM), tr = new THREE.Mesh(trunkG, trunkM), sc = .8 + RS() * .8; t.position.set(x, y + 5.5 * sc + 1, z); t.scale.setScalar(sc); tr.position.set(x, y + 1.2, z); scene.add(t, tr); }
    else { const r = new THREE.Mesh(rockG, rockM); r.position.set(x, y + .8, z); r.rotation.set(RS() * 3, RS() * 3, 0); r.scale.setScalar(.6 + RS()); scene.add(r); }
  }

  // crates: rows across the road at three places
  const crates = [], crateM = new THREE.MeshLambertMaterial({ map: crateTexture() });
  [Math.floor(N * .18), Math.floor(N * .5), Math.floor(N * .8)].forEach(i => {
    const s = S[i];
    [-.33, -.11, .11, .33].forEach(u => { const m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), crateM); const x = s.x + s.nx * u * ROAD_W, z = s.z + s.nz * u * ROAD_W; m.position.set(x, height(x, z) + 2, z); scene.add(m); crates.push({ m, x, z, back: 0 }); });
  });

  // racers: the player and three computer drivers
  const rivals = opt.rivals || [];
  const racers = [opt.player, ...rivals].map((look, k) => {
    const tr = buildTruck(look); scene.add(tr.root);
    const row = Math.floor(k / 2), col = k % 2 ? 1 : -1, i = (N - 6 - row * 7) % N, s = S[i];
    const x = s.x + s.nx * col * 3.5, z = s.z + s.nz * col * 3.5;
    return { k, look, name: look.name, tr, x, z, y: height(x, z), vy: 0, th: Math.atan2(s.tx, s.tz), v: 0, idx: i, lap: 0, prog: -1 + i / N, half: false,
      cpu: k > 0, skill: k > 0 ? (look.skill || .9) : 1, lane: (k - 1.5) * 2.4, item: null, nitro: 0, shield: 0, spin: 0, done: false, time: 0, wheelA: 0, place: k + 1 };
  });
  const me = racers[0];
  const muds = [];

  let steer = 0, paused = true, finished = false, clock = 0, countdown = 3.5, last = 0, raf = 0, slow = 0;
  const cb = opt.on || {};

  function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < h ? 78 : 64; cam.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(canvas); resize();

  function give(r, item) { r.item = item; if (r === me) cb.item && cb.item(item); }
  function use(r) {
    const it = r.item; if (!it || finished && r === me) return; r.item = null; if (r === me) cb.item && cb.item(null);
    if (it === 'nitro') r.nitro = 2.6;
    if (it === 'shield') r.shield = 9;
    if (it === 'spring') { r.vy = 13; r.nitro = Math.max(r.nitro, 1.2); }
    if (it === 'mud') {   // aimed at the nearest racer ahead
      const ahead = racers.filter(o => o !== r && o.prog > r.prog && o.prog - r.prog < .5).sort((a, b) => a.prog - b.prog)[0];
      const m = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), new THREE.MeshLambertMaterial({ color: '#6B4423' })); m.position.set(r.x, r.y + 4, r.z); scene.add(m);
      muds.push({ m, from: r, to: ahead || null, t: 0, x: r.x, z: r.z, y: r.y + 4, th: r.th });
    }
    cb.sound && cb.sound(it, r === me);
  }
  function hit(o) { if (o.shield > 0) { o.shield = 0; cb.sound && cb.sound('pop', o === me); return; } o.spin = 1.4; o.v *= .35; if (o === me) cb.sound && cb.sound('splat', true); }

  function stepRacer(r, dt) {
    const nr = nearest(track, r.x, r.z, r.idx); r.idx = nr.i; const s = S[r.idx], onRoad = Math.abs(nr.lat) < ROAD_W / 2 + .5;
    // laps: count when passing the start after the halfway mark
    const frac = s.s / track.len;
    if (frac > .45 && frac < .6) r.half = true;
    const prevFrac = r.lastFrac ?? frac;
    if (prevFrac > .9 && frac < .1 && r.half) { r.lap++; r.half = false; if (r.lap >= LAPS && !r.done) { r.done = true; r.time = clock; if (r === me) finish(); } else if (r === me) cb.lap && cb.lap(r.lap + 1); }
    if (prevFrac < .1 && frac > .9 && r.lap > 0 && !r.half) r.lap--;   // backing over the line
    r.lastFrac = frac; r.prog = r.lap + frac;
    // steering
    let st;
    if (r.cpu) {
      const a = S[(r.idx + 10) % N], tx = a.x + a.nx * r.lane, tz = a.z + a.nz * r.lane, want = Math.atan2(tx - r.x, tz - r.z);
      let d = want - r.th; d = Math.atan2(Math.sin(d), Math.cos(d)); st = Math.max(-1, Math.min(1, d * 2.2));
      // rubber band: computer drivers ease off when far ahead and push when far behind
      const gap = r.prog - me.prog; r.band = gap > .12 ? .86 : gap < -.12 ? 1.08 : 1;
      if (r.item && Math.random() < dt * .5) use(r);
    } else st = -steer;   // the right button turns right as seen from behind (heading angle goes down)
    if (r.spin > 0) { r.spin -= dt; r.th += dt * 9; st = 0; }
    const vtop = (r.nitro > 0 ? VNITRO : onRoad ? VMAX : VGRASS) * (r.cpu ? r.skill * (r.band || 1) : 1);
    const go = (paused || countdown > 0) ? 0 : 1;
    r.v += ((vtop * go) - r.v) * Math.min(1, dt * (r.v < vtop ? .9 : 2.2));
    if (r.done) r.v *= Math.max(0, 1 - dt * .8);
    r.th += st * dt * (1.9 + .6 * (1 - Math.min(1, r.v / VMAX))) * Math.min(1, r.v / 6 + .15);
    r.x += Math.sin(r.th) * r.v * dt; r.z += Math.cos(r.th) * r.v * dt;
    // soft walls: past the verge you get nudged back toward the track
    const nr2 = nearest(track, r.x, r.z, r.idx); if (Math.abs(nr2.lat) > ROAD_W / 2 + 14) { const s2 = S[nr2.i], back = (Math.abs(nr2.lat) - ROAD_W / 2 - 14) * Math.sign(nr2.lat); r.x -= s2.nx * back; r.z -= s2.nz * back; r.v *= .97; }
    // height: on the ground, or flying after a spring or a crest
    const gy = height(r.x, r.z);
    if (r.y > gy + .05 || r.vy > 0) { r.vy -= 30 * dt; r.y += r.vy * dt; if (r.y <= gy) { r.y = gy; if (r.vy < -8 && r === me) cb.sound && cb.sound('land', true); r.vy = 0; } }
    else r.y = gy;
    r.nitro = Math.max(0, r.nitro - dt); r.shield = Math.max(0, r.shield - dt);
    // crates
    crates.forEach(c => { if (c.back > 0) return; if ((c.x - r.x) ** 2 + (c.z - r.z) ** 2 < 9) { c.back = 4; c.m.visible = false; if (!r.item) { if (r === me) { cb.crate && cb.crate(); } else give(r, Math.random() < .55 ? 'nitro' : Math.random() < .5 ? 'mud' : 'shield'); } } });
  }
  function bump() {   // trucks push each other apart
    for (let a = 0; a < racers.length; a++) for (let b = a + 1; b < racers.length; b++) {
      const A = racers[a], B = racers[b], dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz);
      if (d < 3.6 && d > .01) { const p = (3.6 - d) / 2, ux = dx / d, uz = dz / d; A.x -= ux * p; A.z -= uz * p; B.x += ux * p; B.z += uz * p; A.v *= .985; B.v *= .985; }
    }
  }
  function pose(r, dt) {
    const tr = r.tr; tr.root.position.set(r.x, r.y, r.z); tr.root.rotation.y = r.th;
    const f = 2.2, hx = height(r.x + Math.sin(r.th) * f, r.z + Math.cos(r.th) * f) - height(r.x - Math.sin(r.th) * f, r.z - Math.cos(r.th) * f);
    const sx = height(r.x + Math.cos(r.th) * 1.5, r.z - Math.sin(r.th) * 1.5) - height(r.x - Math.cos(r.th) * 1.5, r.z + Math.sin(r.th) * 1.5);
    tr.root.rotation.x = r.y > height(r.x, r.z) + .3 ? -.15 : -Math.atan2(hx, 2 * f); tr.root.rotation.z = Math.atan2(sx, 3);
    r.wheelA += r.v * dt / 1.1; tr.wheels.forEach(w => { w.rotation.x = r.wheelA; });
    tr.body.position.y = .12 * Math.sin(clock * 9 + r.k) * Math.min(1, r.v / 10) + (r.nitro > 0 ? .1 : 0);
    tr.body.rotation.z = -(r.cpu ? 0 : steer) * .06 * Math.min(1, r.v / 10);
    tr.bubble.visible = r.shield > 0;
  }
  function places() {
    const order = racers.slice().sort((a, b) => (b.done - a.done) || (a.done && b.done ? a.time - b.time : b.prog - a.prog));
    order.forEach((r, i) => { r.place = i + 1; }); return order;
  }
  function finish() {
    finished = true;
    // computer drivers still racing are placed by how far they have to go
    const order = places().map(r => ({ name: r.name, me: r === me, time: r.done ? r.time : null, paint: r.look.paint }));
    setTimeout(() => cb.finish && cb.finish({ place: me.place, time: me.time, order }), 1600);
  }
  function frame(now) {
    const dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
    if (!paused) {
      if (countdown > 0) { const before = Math.ceil(countdown); countdown -= dt; const after = Math.ceil(countdown); if (after !== before) cb.count && cb.count(after > 0 ? after : 'GO'); }
      else clock += dt;
      const sdt = slow ? 0 : dt;   // the action stops while a question is on screen
      if (sdt > 0) { racers.forEach(r => stepRacer(r, sdt)); bump(); }
      crates.forEach(c => { if (c.back > 0) { c.back -= sdt; if (c.back <= 0) c.m.visible = true; } c.m.rotation.y += dt; });
      muds.forEach(m => {
        m.t += sdt; let tx, tz, ty;
        if (m.to) { tx = m.to.x; tz = m.to.z; ty = m.to.y + 2; } else { tx = m.x + Math.sin(m.th) * 40; tz = m.z + Math.cos(m.th) * 40; ty = height(tx, tz); }
        const k = Math.min(1, sdt * 3.2); m.x += (tx - m.x) * k; m.z += (tz - m.z) * k; m.y += (ty + 6 * Math.max(0, 1 - m.t) - m.y) * k;
        m.m.position.set(m.x, m.y, m.z);
        if (m.to && Math.hypot(tx - m.x, tz - m.z) < 2.5) { hit(m.to); m.dead = true; } else if (m.t > 2.2) m.dead = true;
        if (m.dead) scene.remove(m.m);
      });
      for (let i = muds.length - 1; i >= 0; i--) if (muds[i].dead) muds.splice(i, 1);
    }
    racers.forEach(r => pose(r, paused || slow ? 0 : dt));
    // chase camera
    const back = me.nitro > 0 ? 15 : 12, cx = me.x - Math.sin(me.th) * back, cz = me.z - Math.cos(me.th) * back, cy = Math.max(height(cx, cz), me.y) + 6.5;
    cam.position.x += (cx - cam.position.x) * Math.min(1, dt * 5); cam.position.z += (cz - cam.position.z) * Math.min(1, dt * 5); cam.position.y += (cy - cam.position.y) * Math.min(1, dt * 4);
    cam.lookAt(me.x + Math.sin(me.th) * 6, me.y + 2.5, me.z + Math.cos(me.th) * 6);
    renderer.render(scene, cam);
    if (cb.hud) { places(); cb.hud({ lap: Math.min(LAPS, me.lap + 1), place: me.place, time: clock, nitro: me.nitro > 0, racers: racers.map(r => ({ x: r.x, z: r.z, me: r === me, paint: r.look.paint })) }); }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    track, start() { paused = false; },
    setSteer(v) { steer = Math.max(-1, Math.min(1, v)); },
    useItem() { use(me); },
    give(item) { give(me, item); },
    hold(on) { slow = on ? 1 : 0; },        // stop the action while a question is on screen
    pause(on) { paused = on; },
    dispose() { cancelAnimationFrame(raf); renderer.dispose(); },
    debug: () => ({ me, racers, countdown, clock, finished }),
  };
}

function crateTexture() {
  const THREE = T(), c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 128, 128); grd.addColorStop(0, '#FFD23F'); grd.addColorStop(1, '#FF8C42'); g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#22203F'; g.lineWidth = 8; g.strokeRect(4, 4, 120, 120);
  g.fillStyle = '#FFFDF7'; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 18 : 42; g.lineTo(64 + r * Math.cos(a), 66 + r * Math.sin(a)); } g.closePath(); g.fill(); g.stroke();
  return new THREE.CanvasTexture(c);
}
