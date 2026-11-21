/* Dive in: the whole site as a sky of orbs you float through.
   Every page in catalog.js is an orb that breathes between an icosahedron and a dodecahedron, the two dual
   Platonic solids. The icosahedron (20 faces) tells you the page's question, its title, and wears its section's
   color. The dodecahedron (12 faces) tells you what you get to do there, its blurb, and wears its topic's color.
   Up close, the label follows the shape. Pages that share sections and topics are pulled together by a small
   force layout, so neighbors in space are neighbors in subject.

   The shape is one sphere mesh pushed onto the polyhedron in the vertex shader: a direction n meets the
   surface at r = min over the 32 face planes of d / (n · N). Sliding the 20 icosahedron planes out while the 12
   dodecahedron planes slide in passes through the truncated and rectified shapes in between. The fragment
   shader finds the face under each pixel the same way, so faces and edges stay crisp. */
import { LINKS } from './links.js';
const THREE = window.THREE;
const CAT = (window.FTA_CATALOG || []).filter(e => e && e.href), TOPICS = window.FTA_TOPICS || {}, THUMBS = window.FTA_THUMBS || {};
const SHELF = { explore: ['Explore', 0x4C8DF6], paradox: ['Paradox', 0x9B6BFF], riddles: ['Riddles', 0xF2B233], play: ['Play', 0x3DBE7A], way: ['Way Of', 0x2BC4B4], tools: ['Tools', 0xF07A2B] };
const TOPIC = { logic: 0xE86A9A, numbers: 0xF2D03B, strategy: 0xB58CFF, fluids: 0x35B6F5, tensors: 0x6E7CF7, water: 0x2ED3BE, chance: 0xFF8C42, math: 0xF25C54, remix: 0xB0B7C3, kids: 0xFFD23F };
const TOPIC_NAME = Object.assign({ kids: 'For kids' }, TOPICS);
const FOG = new THREE.Color(0x070b14);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- the pages, their words, and how alike they are ----------
const shelves = e => Array.isArray(e.shelf) ? e.shelf : [e.shelf];
const PAGES = CAT.map((e, i) => {
  const sh = shelves(e).filter(s => SHELF[s]), main = sh[0] || 'explore', tops = (e.topics || []).slice();
  if (e.kids && !tops.includes('kids')) tops.unshift('kids');
  const tok = new Set([...sh.map(s => 's:' + s), ...tops.map(t => 't:' + t)]);
  const colA = new THREE.Color(SHELF[main][1]), colB = tops.length && TOPIC[tops[0]] != null ? new THREE.Color(TOPIC[tops[0]]) : colA.clone().lerp(new THREE.Color(0xffffff), .45);
  return { i, e, main, tops, tok, colA, colB, phase: (i * 2.399963) % (Math.PI * 2), pos: new THREE.Vector3() };
});
function sim(a, b) { let n = 0; a.tok.forEach(t => { if (b.tok.has(t)) n++; }); const u = a.tok.size + b.tok.size - n; return u ? n / u : 0; }
const S = PAGES.map(a => PAGES.map(b => a === b ? 0 : sim(a, b)));
// connections: [page, page, what they share]; connected pages also pull together in the layout
const byName = {}; PAGES.forEach(p => { byName[p.e.href.replace(/^\/|\.html$/g, '')] = p; });
const EDGES = LINKS.map(([a, b, label, linked]) => ({ a: byName[a], b: byName[b], label, linked: !!linked })).filter(e => e.a && e.b);
const CONN = PAGES.map(() => new Set()); EDGES.forEach(e => { CONN[e.a.i].add(e.b.i); CONN[e.b.i].add(e.a.i); });
const edgesOf = p => EDGES.filter(e => e.a === p || e.b === p);

// ---------- the layout: alike pages attract, everything repels ----------
(function layout() {
  let seed = 7; const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const keys = Object.keys(SHELF), C = keys.map((k, j) => { const y = 1 - 2 * (j + .5) / keys.length, r = Math.sqrt(1 - y * y), a = j * 2.399963; return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r).multiplyScalar(34); });
  PAGES.forEach(p => p.pos.copy(C[keys.indexOf(p.main)]).add(new THREE.Vector3(R() - .5, R() - .5, R() - .5).multiplyScalar(14)));
  const F = PAGES.map(() => new THREE.Vector3()), d = new THREE.Vector3();
  for (let it = 0; it < 420; it++) {
    const step = .9 * (1 - it / 420) + .05;
    F.forEach(f => f.set(0, 0, 0));
    for (let i = 0; i < PAGES.length; i++) for (let j = i + 1; j < PAGES.length; j++) {
      d.subVectors(PAGES[j].pos, PAGES[i].pos); const L = Math.max(.5, d.length()), s = Math.min(1, S[i][j] + (CONN[i].has(j) ? .55 : 0));
      let f = -160 / (L * L);                               // everyone keeps their distance
      if (s > 0) f += .05 * s * (L - (5 + 14 * (1 - s)));   // alike pages want to sit close
      d.multiplyScalar(f / L); F[i].add(d); F[j].sub(d);
    }
    PAGES.forEach((p, i) => { F[i].addScaledVector(p.pos, -.004); F[i].clampLength(0, 3); p.pos.addScaledVector(F[i], step); });
  }
  const c = new THREE.Vector3(); PAGES.forEach(p => c.add(p.pos)); c.divideScalar(PAGES.length || 1); PAGES.forEach(p => p.pos.sub(c));
})();

// ---------- scene ----------
const stage = $('sky');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.setClearColor(FOG);
stage.appendChild(renderer.domElement);
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(62, 1, .1, 400);

// stars, for a sense of motion
{ const n = 1400, g = new THREE.BufferGeometry(), a = new Float32Array(n * 3); let s = 3; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) { const v = new THREE.Vector3(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1).normalize().multiplyScalar(160 + R() * 120); a.set([v.x, v.y, v.z], i * 3); }
  g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9fb4d8, size: 1.1, sizeAttenuation: false, transparent: true, opacity: .7 }))); }

// the two solids' face normals: an icosahedron's faces point at a dodecahedron's vertices, and the other way round
const PHI = (1 + Math.sqrt(5)) / 2;
const ICO_V = [], DOD_V = [];
[[0, 1, PHI]].forEach(([a, b, c]) => { for (const sb of [-1, 1]) for (const sc of [-1, 1]) { ICO_V.push(new THREE.Vector3(a, sb * b, sc * c), new THREE.Vector3(sb * b, sc * c, a), new THREE.Vector3(sc * c, a, sb * b)); } });
for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) DOD_V.push(new THREE.Vector3(x, y, z));
for (const sb of [-1, 1]) for (const sc of [-1, 1]) { const b = sb / PHI, c = sc * PHI; DOD_V.push(new THREE.Vector3(0, b, c), new THREE.Vector3(b, c, 0), new THREE.Vector3(c, 0, b)); }
ICO_V.forEach(v => v.normalize()); DOD_V.forEach(v => v.normalize());
// planes: the 20 icosahedron faces have normals along DOD_V; the 12 dodecahedron faces along ICO_V
const D_ICO = 0.7947, D_ICO_OUT = 1.09, D_DOD_OUT = 1.0, D_DOD = 0.86;   // icosahedron inradius (circumradius 1); dodecahedron inradius
const uniforms = { uTime: { value: 0 }, uMotion: { value: reduce ? .35 : 1 }, uCam: { value: new THREE.Vector3() }, uFog: { value: FOG }, uIco: { value: DOD_V }, uDod: { value: ICO_V } };
const COMMON = `
uniform float uTime; uniform float uMotion; uniform vec3 uIco[20]; uniform vec3 uDod[12];
float morphU(float ph){ return 0.5 - 0.5 * cos(uTime * 0.45 * uMotion + ph); }
mat3 rotY(float a){ float c = cos(a), s = sin(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }
float dI(float u){ return mix(${D_ICO.toFixed(4)}, ${D_ICO_OUT.toFixed(4)}, u); }
float dD(float u){ return mix(${D_DOD_OUT.toFixed(4)}, ${D_DOD.toFixed(4)}, u); }`;
const mat = new THREE.ShaderMaterial({
  uniforms, extensions: { derivatives: true },
  vertexShader: COMMON + `
attribute float aPhase; attribute vec3 aColA; attribute vec3 aColB; attribute float aHi;
varying vec3 vObj; varying vec3 vColA; varying vec3 vColB; varying float vU; varying float vSpin; varying float vHi; varying vec3 vWorld;
void main(){
  float u = morphU(aPhase); vU = u;
  vec3 n = normalize(position); float r = 10.0, a = dI(u), b = dD(u);
  for (int k = 0; k < 20; k++) { float c = dot(n, uIco[k]); if (c > 1e-4) r = min(r, a / c); }
  for (int k = 0; k < 12; k++) { float c = dot(n, uDod[k]); if (c > 1e-4) r = min(r, b / c); }
  vObj = n * r;
  vSpin = uTime * 0.22 * uMotion + aPhase * 3.0;
  vec4 w = modelMatrix * instanceMatrix * vec4(rotY(vSpin) * vObj, 1.0);
  vWorld = w.xyz; vColA = aColA; vColB = aColB; vHi = aHi;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
  fragmentShader: COMMON + `
uniform vec3 uCam; uniform vec3 uFog;
varying vec3 vObj; varying vec3 vColA; varying vec3 vColB; varying float vU; varying float vSpin; varying float vHi; varying vec3 vWorld;
void main(){
  float a = dI(vU), b = dD(vU), best = -1.0, second = -1.0, kind = 0.0; vec3 N = vec3(0.0, 1.0, 0.0);
  for (int k = 0; k < 20; k++) { float s = dot(vObj, uIco[k]) / a; if (s > best) { second = best; best = s; N = uIco[k]; kind = 0.0; } else if (s > second) second = s; }
  for (int k = 0; k < 12; k++) { float s = dot(vObj, uDod[k]) / b; if (s > best) { second = best; best = s; N = uDod[k]; kind = 1.0; } else if (s > second) second = s; }
  vec3 col = kind < 0.5 ? vColA : vColB;
  vec3 Nw = rotY(vSpin) * N, V = normalize(uCam - vWorld), L = normalize(vec3(0.45, 0.8, 0.4));
  float dif = max(dot(Nw, L), 0.0), rim = pow(1.0 - max(dot(Nw, V), 0.0), 2.0), spec = pow(max(dot(reflect(-L, Nw), V), 0.0), 24.0);
  vec3 c = col * (0.32 + 0.78 * dif) + col * rim * 0.45 + vec3(spec * 0.35) + vec3(vHi * 0.22);
  float w = fwidth(best - second) * 1.1 + 0.003;
  c = mix(c * 0.4, c, smoothstep(w, w * 2.0 + 0.012, best - second));   // dark edges where two faces meet
  float f = smoothstep(70.0, 150.0, length(uCam - vWorld));
  gl_FragColor = vec4(mix(c, uFog, f), 1.0);
}`
});
const ORB = 1.6;
// every orb gets a light mesh; the few nearest the camera swap to a fine one, so close-up outlines stay clean
function orbMesh(detail, count) {
  const g = new THREE.IcosahedronGeometry(1, detail), m = new THREE.InstancedMesh(g, mat, count);
  const at = { aPhase: new Float32Array(count), aColA: new Float32Array(count * 3), aColB: new Float32Array(count * 3), aHi: new Float32Array(count) };
  const attr = {}; [['aPhase', 1], ['aColA', 3], ['aColB', 3], ['aHi', 1]].forEach(([k, s]) => { attr[k] = new THREE.InstancedBufferAttribute(at[k], s); attr[k].setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, attr[k]); });
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; scene.add(m);
  return { m, at, attr, set(slot, p, hi) { at.aPhase[slot] = p.phase; p.colA.toArray(at.aColA, slot * 3); p.colB.toArray(at.aColB, slot * 3); at.aHi[slot] = hi; } };
}
const n = PAGES.length, NEAR = 6, far = orbMesh(3, n), fine = orbMesh(5, NEAR);
const m4 = new THREE.Matrix4(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
PAGES.forEach((p, i) => { far.set(i, p, 0); m4.makeScale(ORB, ORB, ORB).setPosition(p.pos); far.m.setMatrixAt(i, m4); });
for (let k = 0; k < NEAR; k++) fine.m.setMatrixAt(k, ZERO);
let fineSet = [];
function updateMeshes(hiOf) {
  const near = PAGES.map(p => [camera.position.distanceToSquared(p.pos), p]).filter(x => x[0] < 30 * 30).sort((a, b) => a[0] - b[0]).slice(0, NEAR).map(x => x[1]);
  PAGES.forEach((p, i) => { const inFine = near.includes(p); m4.makeScale(ORB, ORB, ORB).setPosition(p.pos); far.m.setMatrixAt(i, inFine ? ZERO : m4); far.at.aHi[i] = hiOf(p); });
  for (let k = 0; k < NEAR; k++) { const p = near[k]; if (p) { fine.set(k, p, hiOf(p)); m4.makeScale(ORB, ORB, ORB).setPosition(p.pos); fine.m.setMatrixAt(k, m4); } else fine.m.setMatrixAt(k, ZERO); }
  far.m.instanceMatrix.needsUpdate = true; fine.m.instanceMatrix.needsUpdate = true;
  far.attr.aHi.needsUpdate = true; ['aPhase', 'aColA', 'aColB', 'aHi'].forEach(k => { fine.attr[k].needsUpdate = true; });
  fineSet = near;
}
const morphU = (t, ph) => .5 - .5 * Math.cos(t * .45 * uniforms.uMotion.value + ph);

// ---------- connections: faint lines for all, bright ones (with labels) for the page in focus ----------
function lineGeo(list, dim) {
  const pos = new Float32Array(list.length * 6), col = new Float32Array(list.length * 6);
  list.forEach((e, k) => { e.a.pos.toArray(pos, k * 6); e.b.pos.toArray(pos, k * 6 + 3); e.a.colA.clone().multiplyScalar(dim).toArray(col, k * 6); e.b.colA.clone().multiplyScalar(dim).toArray(col, k * 6 + 3); });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}
const allLines = new THREE.LineSegments(lineGeo(EDGES, 1), new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .32, depthWrite: false }));
scene.add(allLines);
const focusLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .95, depthWrite: false }));
scene.add(focusLines);
let focusOf = null;
function setFocus(p) { if (p === focusOf) return; focusOf = p; focusLines.geometry.dispose(); focusLines.geometry = lineGeo(p ? edgesOf(p) : [], 1.35); }

// ---------- words in the sky ----------
function wrap(g, s, w, maxLines) { const words = String(s).split(/\s+/), out = []; let line = ''; for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (g.measureText(t).width > w && line) { out.push(line); line = wd; } else line = t; } if (line) out.push(line); if (out.length > maxLines) { out.length = maxLines; out[maxLines - 1] = out[maxLines - 1].replace(/\s*\S*$/, '') + '…'; } return out; }
function textSprite(s, { w = 512, h = 128, size = 40, weight = 700, color = '#fff', lines = 2, scale = 6.4 } = {}) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
  g.font = `${weight} ${size}px Inter, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const ls = wrap(g, s, w - 24, lines), lh = size * 1.18, y0 = h / 2 - (ls.length - 1) * lh / 2;
  g.shadowColor = 'rgba(0,0,0,.85)'; g.shadowBlur = 10; g.fillStyle = color; ls.forEach((l, k) => g.fillText(l, w / 2, y0 + k * lh));
  const tex = new THREE.CanvasTexture(cv); tex.minFilter = THREE.LinearFilter; tex.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(scale, scale * h / w, 1); return sp;
}
function pillSprite(s) {
  const w = 800, h = 72, cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
  g.font = '600 30px Inter, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let t = s; while (g.measureText(t).width > w - 48 && t.length > 4) t = t.slice(0, -2); if (t !== s) t = t.replace(/\s*\S*$/, '') + '…';
  const tw = g.measureText(t).width + 36, x0 = (w - tw) / 2;
  g.fillStyle = 'rgba(14,20,36,.88)'; g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(x0 + 30, 6); g.arcTo(x0 + tw, 6, x0 + tw, h - 6, 30); g.arcTo(x0 + tw, h - 6, x0, h - 6, 30); g.arcTo(x0, h - 6, x0, 6, 30); g.arcTo(x0, 6, x0 + tw, 6, 30); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#f3f6ff'; g.fillText(t, w / 2, h / 2 + 1);
  const tex = new THREE.CanvasTexture(cv); tex.minFilter = THREE.LinearFilter;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  sp.scale.set(7.2, 7.2 * h / w, 1); sp.renderOrder = 5; return sp;
}
EDGES.forEach(e => { e.mid = e.a.pos.clone().add(e.b.pos).multiplyScalar(.5); });
function edgeLabel(e) { if (!e.sprite) { e.sprite = pillSprite(e.label); e.sprite.position.copy(e.mid); scene.add(e.sprite); } return e.sprite; }
PAGES.forEach(p => { p.title = textSprite(p.e.title); p.title.position.copy(p.pos).add(new THREE.Vector3(0, ORB + 1.3, 0)); scene.add(p.title); });
function blurbFor(p) { if (!p.blurb) { p.blurb = textSprite(p.e.blurb || '', { size: 30, weight: 500, lines: 3, color: '#e9eefc', h: 150, scale: 6.8 }); p.blurb.position.copy(p.pos).add(new THREE.Vector3(0, -ORB - 1.5, 0)); scene.add(p.blurb); } return p.blurb; }
// section names, floating over their clusters
Object.keys(SHELF).forEach(k => {
  const mine = PAGES.filter(p => p.main === k); if (!mine.length) return;
  const c = new THREE.Vector3(); mine.forEach(p => c.add(p.pos)); c.divideScalar(mine.length);
  let top = -Infinity; mine.forEach(p => { top = Math.max(top, p.pos.y); });
  const sp = textSprite(SHELF[k][0], { size: 64, weight: 800, color: '#' + new THREE.Color(SHELF[k][1]).getHexString(), lines: 1, h: 110, scale: 13 });
  sp.material.opacity = .55; sp.position.set(c.x, top + 5.5, c.z); scene.add(sp);
});

// ---------- moving about ----------
const view = { yaw: 0, pitch: 0, vel: new THREE.Vector3(), keys: {}, fly: null, idle: 0, held: 0 };
const fwd = new THREE.Vector3(), right = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
camera.position.set(0, 8, reduce ? 78 : 190);
lookAtPoint(new THREE.Vector3(0, 0, 0));
if (!reduce) flyTo(new THREE.Vector3(0, 6, 78), new THREE.Vector3(0, 0, 0), 2600);
function lookAtPoint(t) { const d = t.clone().sub(camera.position).normalize(); view.yaw = Math.atan2(-d.x, -d.z); view.pitch = Math.asin(Math.max(-1, Math.min(1, d.y))); }
function applyView() { camera.rotation.set(view.pitch, view.yaw, 0, 'YXZ'); }
function flyTo(pos, target, ms = 1400) {
  const d = target.clone().sub(pos).normalize();
  view.fly = { t0: performance.now(), ms, p0: camera.position.clone(), p1: pos, y0: view.yaw, p0p: view.pitch, y1: Math.atan2(-d.x, -d.z), p1p: Math.asin(Math.max(-1, Math.min(1, d.y))) };
  let dy = view.fly.y1 - view.fly.y0; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); view.fly.y1 = view.fly.y0 + dy;
}
function visit(p) {
  const dir = camera.position.clone().sub(p.pos); dir.y *= .4; if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
  const narrow = innerWidth <= 640;
  dir.normalize().multiplyScalar(narrow ? 12 : 9.5);
  flyTo(p.pos.clone().add(dir).add(new THREE.Vector3(0, 1.2, 0)), p.pos.clone().add(new THREE.Vector3(0, narrow ? -2.6 : .9, 0)));
  select(p);
}
const keymap = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r', KeyE: 'u', Space: 'u', KeyQ: 'd', ShiftLeft: 'd', ShiftRight: 'd' };
addEventListener('keydown', ev => { if (ev.target.closest && ev.target.closest('input,textarea')) return; if (ev.key === 'Escape') { select(null); return; } const k = keymap[ev.code]; if (k) { view.keys[k] = 1; view.fly = null; view.idle = 0; ev.preventDefault(); } });
addEventListener('keyup', ev => { const k = keymap[ev.code]; if (k) view.keys[k] = 0; });
addEventListener('blur', () => { view.keys = {}; view.held = 0; });
// look by dragging; tap to pick; pinch or wheel to float forward and back
const ptrs = new Map(); let drag = null, pinch = 0;
const cv = renderer.domElement;
cv.addEventListener('pointerdown', ev => { cv.setPointerCapture(ev.pointerId); ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); view.idle = 0;
  if (ptrs.size === 1) drag = { x: ev.clientX, y: ev.clientY, moved: 0 }; else { drag = null; const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); } });
cv.addEventListener('pointermove', ev => {
  const p = ptrs.get(ev.pointerId);
  if (!p) { hover(ev); return; }
  const dx = ev.clientX - p.x, dy = ev.clientY - p.y; p.x = ev.clientX; p.y = ev.clientY;
  if (ptrs.size >= 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); camera.getWorldDirection(fwd); camera.position.addScaledVector(fwd, (d - pinch) * .08); pinch = d; view.fly = null; return; }
  if (drag) { drag.moved += Math.abs(dx) + Math.abs(dy); if (drag.moved > 6) { view.fly = null; view.yaw += dx * .004; view.pitch = Math.max(-1.45, Math.min(1.45, view.pitch + dy * .004)); } }
});
const up = ev => { const wasTap = drag && drag.moved <= 6 && ptrs.size === 1; ptrs.delete(ev.pointerId); if (wasTap) { const p = pick(ev.clientX, ev.clientY); if (p) visit(p); else select(null); } if (!ptrs.size) drag = null; };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', ev => { ptrs.delete(ev.pointerId); drag = null; });
cv.addEventListener('wheel', ev => { ev.preventDefault(); camera.getWorldDirection(fwd); camera.position.addScaledVector(fwd, -ev.deltaY * .03); view.fly = null; view.idle = 0; }, { passive: false });
// hold-to-float buttons, for touch
document.querySelectorAll('[data-go]').forEach(b => {
  const on = ev => { ev.preventDefault(); view.held = +b.dataset.go; view.fly = null; view.idle = 0; try { b.setPointerCapture(ev.pointerId); } catch (e) {} };
  const off = () => { view.held = 0; };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
});
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), tmp = new THREE.Vector3();
function pick(x, y) {
  const r = cv.getBoundingClientRect(); ndc.set((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
  let best = null, bt = Infinity;
  PAGES.forEach(p => { tmp.subVectors(p.pos, ray.ray.origin); const t = tmp.dot(ray.ray.direction); if (t < 0) return; const d2 = tmp.lengthSq() - t * t; if (d2 < (ORB * 1.15) ** 2 && t < bt) { bt = t; best = p; } });
  return best;
}
let hovered = null;
function hover(ev) { const p = pick(ev.clientX, ev.clientY); if (p !== hovered) { hovered = p; cv.style.cursor = p ? 'pointer' : 'grab'; } }

// ---------- the panel ----------
let chosen = null;
const panel = $('panel');
function neighbors(p, k = 5) { return PAGES.filter(q => q !== p).map(q => [S[p.i][q.i] - q.pos.distanceTo(p.pos) * .002, q]).sort((a, b) => b[0] - a[0]).slice(0, k).map(x => x[1]); }
function select(p) {
  chosen = p; panel.hidden = !p; if (!p) return;
  const e = p.e, hex = c => '#' + c.getHexString(), shelfName = SHELF[p.main][0];
  const th = THUMBS[e.thumb] ? '<svg class="thumb" viewBox="0 0 320 180" aria-hidden="true">' + THUMBS[e.thumb]() + '</svg>' : '';
  panel.innerHTML = '<button class="x" type="button" aria-label="Close">×</button>' + th +
    '<p class="shape ico" style="--c:' + hex(p.colA) + '"><span class="lbl"><i></i>Icosahedron · the question · ' + esc(shelfName) + '</span><b>' + esc(e.title) + '</b></p>' +
    '<p class="shape dod" style="--c:' + hex(p.colB) + '"><span class="lbl"><i></i>Dodecahedron · what you do' + (p.tops.length ? ' · ' + esc(p.tops.map(t => TOPIC_NAME[t] || t).join(', ')) : '') + '</span>' + esc(e.blurb || '') + '</p>' +
    '<a class="go" href="' + esc(e.href) + '">Open the page</a>' +
    (edgesOf(p).length ? '<p class="near">Connected to:</p><div class="nbrs">' + edgesOf(p).map(ed => { const q = ed.a === p ? ed.b : ed.a; return '<button type="button" data-i="' + q.i + '"><b>' + esc(q.e.title) + '</b><span>' + esc(ed.label) + '</span></button>'; }).join('') + '</div>' : '') +
    '<p class="near">Close by:</p><div class="nbrs">' + neighbors(p).filter(q => !CONN[p.i].has(q.i)).slice(0, 2).map(q => '<button type="button" data-i="' + q.i + '">' + esc(q.e.title) + '</button>').join('') + '</div>';
  panel.querySelector('.x').onclick = () => select(null);
  panel.querySelectorAll('.nbrs button').forEach(b => { b.onclick = () => visit(PAGES[+b.dataset.i]); });
  $('live').textContent = e.title + '. ' + (e.blurb || '');
}

// ---------- the loop ----------
function resize() { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
let last = performance.now();
const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now; const t = now / 1000;
  uniforms.uTime.value = t;
  if (view.fly) {
    const f = view.fly, k = Math.min(1, (performance.now() - f.t0) / f.ms), e = ease(k);   // same clock as flyTo
    camera.position.lerpVectors(f.p0, f.p1, e); view.yaw = f.y0 + (f.y1 - f.y0) * e; view.pitch = f.p0p + (f.p1p - f.p0p) * e; if (k >= 1) view.fly = null;
  } else {
    camera.getWorldDirection(fwd); right.crossVectors(fwd, UP).normalize();
    const K = view.keys, acc = new THREE.Vector3();
    acc.addScaledVector(fwd, (K.f || 0) - (K.b || 0) + view.held).addScaledVector(right, (K.r || 0) - (K.l || 0)).addScaledVector(UP, (K.u || 0) - (K.d || 0));
    view.vel.addScaledVector(acc, dt * 40); view.vel.multiplyScalar(Math.pow(.04, dt)); camera.position.addScaledVector(view.vel, dt);
    view.idle += dt;
    if (!reduce && view.idle > 8 && !chosen && !ptrs.size) {   // a slow drift when nobody is steering
      const a = dt * .04; const x = camera.position.x, z = camera.position.z; camera.position.x = x * Math.cos(a) - z * Math.sin(a); camera.position.z = x * Math.sin(a) + z * Math.cos(a); view.yaw += a;
    }
  }
  if (camera.position.length() > 180) camera.position.setLength(180);
  applyView(); uniforms.uCam.value.copy(camera.position);
  // labels: far away, the title fades with distance; close up, it follows the shape (title on the icosahedron, blurb on the dodecahedron)
  PAGES.forEach(p => {
    const d = camera.position.distanceTo(p.pos), u = morphU(t, p.phase), near = 1 - Math.min(1, Math.max(0, (d - 14) / 14));
    const fade = (1 - Math.min(1, Math.max(0, (d - 40) / 50))) * Math.min(1, Math.max(0, (d - 4) / 3));
    p.title.material.opacity = fade * (1 - near * u * .75);
    if (near > 0) { const b = blurbFor(p); b.visible = true; b.material.opacity = near * u * Math.min(1, Math.max(0, (d - 4) / 3)); }
    else if (p.blurb) p.blurb.visible = false;
  });
  updateMeshes(p => (p === hovered ? .6 : 0) + (p === chosen ? 1 : 0));
  const focus = chosen || hovered; setFocus(focus);
  EDGES.forEach(e => {   // a connection's label shows for the orb in focus, or when you float close to the line's middle
    const on = focus && (e.a === focus || e.b === focus), d = camera.position.distanceTo(e.mid);
    const op = on ? 1 : Math.max(0, Math.min(1, (20 - d) / 6)) * .9;
    if (op > .01) {
      const s = edgeLabel(e); s.visible = true; s.material.opacity = op;
      if (on) { const o = e.a === focus ? e.b : e.a; tmp.subVectors(o.pos, focus.pos); const L = tmp.length(); s.position.copy(focus.pos).addScaledVector(tmp, Math.min(.5, 6.5 / L)); }   // spokes around the orb in focus
      else s.position.copy(e.mid);
    } else if (e.sprite) e.sprite.visible = false;
  });
  if (chosen) { const u = morphU(t, chosen.phase); panel.style.setProperty('--u', u.toFixed(3)); }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__dive = { PAGES, camera, visit, select, flyTo, S };
