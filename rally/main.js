/* Kiddo's Monster Rally: screens, saving, voice, and the bridge between the race and the tutor. */
import { Tutor, newState, LADDERS } from './lessons.js';
import { createRace, buildTruck, PAINTS, WHEELS, DECALS, ITEMS, buildTrackPath } from './game.js';

const $ = id => document.getElementById(id);
const KEY = 'fta-rally';
const NAMES = ['Rocket', 'Mud Pup', 'Big Blue', 'Thunder', 'Pickle', 'Comet', 'Boulder Jr', 'Zippy'];
const RIVALS = [{ name: 'Rusty', paint: '#A85F1C', wheel: 'chunky', decal: 'stripes', skill: .86 }, { name: 'Zoomer', paint: '#7B5CFF', wheel: 'spiky', decal: 'lightning', skill: .9 }, { name: 'Bolt', paint: '#2BD4C2', wheel: 'classic', decal: 'stars', skill: .94 }];
const SPEEDS = [['Easy', .82], ['Medium', .92], ['Fast', 1.0]];
const COST = { paint: [0, 0, 0, 0, 5, 8, 12, 15], wheel: [0, 6, 10], decal: [0, 4, 8, 10, 14] };
const rng = (() => { let s = (Date.now() % 2147483646) + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

// ---- saved progress ----
function load() { try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.tutor) return d; } catch (e) {} return null; }
let save = load() || { stars: 0, trophies: 0, races: 0, best: null, look: { paint: PAINTS[0], wheel: 'chunky', decal: 'flames', name: 'Rocket' }, unlocked: { paint: [0, 1, 2, 3], wheel: [0], decal: [0, 1] }, tutor: newState(), speed: 0, muted: false };
function store() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} }

// ---- sound: River's recorded lines and clips, played in order (fta-voice.js) ----
let muted = !!save.muted, actx = null;
const V = window.FTAVoice;
function speak(segs) { if (muted || !V) return Promise.resolve(); return V.seq(segs); }
function stopVoice() { if (V) V.stop(); }
function beep(f = 520, d = .12, type = 'square', vol = .06) {
  if (muted) return; try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); const o = actx.createOscillator(), g = actx.createGain(); o.type = type; o.frequency.value = f; g.gain.value = vol; g.gain.exponentialRampToValueAtTime(.0001, actx.currentTime + d); o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + d); } catch (e) {}
}
const SFX = { nitro: () => { beep(300, .3, 'sawtooth'); setTimeout(() => beep(600, .3, 'sawtooth'), 90); }, mud: () => beep(180, .2, 'triangle', .1), shield: () => beep(880, .25, 'sine', .08), spring: () => { beep(400, .1, 'sine'); setTimeout(() => beep(800, .15, 'sine'), 100); }, splat: () => beep(120, .3, 'sawtooth', .1), pop: () => beep(1200, .08, 'sine'), land: () => beep(90, .12, 'triangle', .12) };

// ---- screens ----
const screens = ['garage', 'subject', 'results', 'loading'];
function show(name) { screens.forEach(s => { $(s).hidden = s !== name; }); $('hud').hidden = name !== 'race'; $('topbtns').hidden = name === 'race'; }

// ---- garage, with a turning 3D preview ----
let pv = null;
function preview() {
  const THREE = window.THREE; if (!THREE) return;
  if (!pv) {
    const canvas = $('pv'), r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); r.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, 4 / 3, .1, 100); cam.position.set(9, 6, 10); cam.lookAt(0, 2, 0);
    sc.add(new THREE.HemisphereLight('#FFFFFF', '#8FD3FF', 1)); const d = new THREE.DirectionalLight('#FFFFFF', .6); d.position.set(5, 10, 6); sc.add(d);
    pv = { r, sc, cam, truck: null, a: 0 };
    const loop = () => { if (!$('garage').hidden && pv.truck) { pv.a += .012; pv.truck.root.rotation.y = pv.a; const w = canvas.clientWidth, h = canvas.clientHeight; if (w && (canvas.width !== Math.round(w * r.getPixelRatio()))) { r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); } r.render(sc, cam); } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  if (pv.truck) pv.sc.remove(pv.truck.root);
  pv.truck = buildTruck(save.look); pv.sc.add(pv.truck.root);
}
function swatches() {
  const mk = (box, kind, list, label, cur, apply) => {
    const el = $(box); el.querySelectorAll('button').forEach(b => b.remove());
    list.forEach((v, i) => {
      const b = document.createElement('button'), locked = !save.unlocked[kind].includes(i), cost = COST[kind][i];
      b.className = 'sw' + (kind !== 'paint' ? ' wide' : '') + (locked ? ' locked' : ''); if (locked) b.dataset.cost = cost;
      if (kind === 'paint') b.style.background = v; else b.textContent = label(v);
      b.setAttribute('aria-pressed', cur === v); b.setAttribute('aria-label', (kind === 'paint' ? 'Paint ' + (i + 1) : label(v)) + (locked ? ', costs ' + cost + ' stars' : ''));
      b.onclick = () => {
        if (locked) { if (save.stars >= cost) { save.stars -= cost; save.unlocked[kind].push(i); beep(880, .2, 'sine'); speak([{ text: 'Unlocked!' }]); } else { beep(200, .15); speak([{ text: 'You need ' + cost + ' stars. Answer questions to earn stars!' }]); return; } }
        apply(v); store(); garage();
      };
      el.appendChild(b);
    });
  };
  mk('o-paint', 'paint', PAINTS, null, save.look.paint, v => { save.look.paint = v; });
  mk('o-wheel', 'wheel', WHEELS, v => ({ chunky: 'Chunky', spiky: 'Spiky', classic: 'Classic' })[v], save.look.wheel, v => { save.look.wheel = v; });
  mk('o-decal', 'decal', DECALS, v => ({ none: 'Plain', flames: '🔥', stars: '⭐', stripes: '〰️', lightning: '⚡' })[v], save.look.decal, v => { save.look.decal = v; });
  const nb = $('o-name'); nb.querySelectorAll('button').forEach(b => b.remove());
  NAMES.forEach(n => { const b = document.createElement('button'); b.className = 'sw wide'; b.textContent = n; b.setAttribute('aria-pressed', save.look.name === n); b.onclick = () => { save.look.name = n; store(); garage(); speak([{ text: n + '!' }]); }; nb.appendChild(b); });
}
function garage() { $('stars').textContent = '⭐ ' + save.stars; $('trophies').textContent = '🏆 ' + save.trophies; swatches(); preview(); levelsNote(); }
function levelsNote() {
  const t = save.tutor; $('lv-math').textContent = LADDERS.math[t.math.level].name; $('lv-reading').textContent = LADDERS.reading[t.reading.level].name;
  $('g-levels').textContent = 'Levels now: Math, ' + LADDERS.math[t.math.level].name + ' (' + (t.math.level + 1) + ' of ' + LADDERS.math.length + '); Reading, ' + LADDERS.reading[t.reading.level].name + ' (' + (t.reading.level + 1) + ' of ' + LADDERS.reading.length + ').';
}
function speeds() { const box = $('o-speed'); box.innerHTML = ''; SPEEDS.forEach(([n], i) => { const b = document.createElement('button'); b.className = 'sw wide'; b.textContent = n; b.setAttribute('aria-pressed', save.speed === i); b.onclick = () => { save.speed = i; store(); speeds(); }; box.appendChild(b); }); }

// ---- questions ----
function drawShow(it) {
  const s = $('show'), sh = it.show; s.innerHTML = '';
  const dots = (n, col) => { const w = Math.min(5, n), rows = Math.ceil(n / 5), sz = 34; let o = `<svg width="${w * sz + 6}" height="${rows * sz + 6}" viewBox="0 0 ${w * sz + 6} ${rows * sz + 6}" aria-hidden="true">`; for (let k = 0; k < n; k++) o += `<circle cx="${(k % 5) * sz + sz / 2 + 3}" cy="${Math.floor(k / 5) * sz + sz / 2 + 3}" r="${sz * .4}" fill="${col}" stroke="#22203F" stroke-width="3"/>`; return o + '</svg>'; };
  if (sh.type === 'dots') s.innerHTML = dots(sh.n, '#FF8C42');
  else if (sh.type === 'eq') {
    if (sh.dots && sh.dots[1] < 0) s.innerHTML = `<div style="width:100%">${sh.text}</div>` + dots(sh.dots[0], '#4D94EA');
    else s.innerHTML = `<div style="width:100%">${sh.text}</div>` + (sh.dots ? dots(sh.dots[0], '#4D94EA') + '<span style="font-size:40px">+</span>' + dots(sh.dots[1], '#FF8C42') : '');
  }
  else if (sh.type === 'listen') s.innerHTML = '<span class="pic" aria-hidden="true">👂</span>';
  else if (sh.type === 'pic') s.innerHTML = `<span class="pic">${sh.pic}</span>`;
  else if (sh.type === 'word') s.innerHTML = `<span style="font-size:clamp(64px,16vw,110px);letter-spacing:.06em">${sh.text}</span>`;
  // take-away: cross out the ones taken
  if (sh.type === 'eq' && sh.dots && sh.dots[1] < 0) { const cs = s.querySelectorAll('circle'), b = -sh.dots[1]; for (let k = cs.length - b; k < cs.length; k++) { cs[k].setAttribute('fill', '#FFFFFF'); cs[k].setAttribute('opacity', '.5'); } }
}
let tutor = null, subject = 'math';
function ask(it) {
  return new Promise(done => {
    const box = $('choices'); $('ask').hidden = false; drawShow(it);
    box.innerHTML = '';
    const btns = it.choices.map(c => { const b = document.createElement('button'); b.textContent = c.label; if (c.pic) b.classList.add('pic'); b.setAttribute('aria-label', c.pic ? c.id : c.label); box.appendChild(b); return [c, b]; });
    let first = true, busy = false;
    const setTurn = mine => { $('turn').textContent = mine ? 'My turn' : 'Your turn'; $('turn').classList.toggle('you', !mine); };
    const right = btns.find(([c]) => c.id === it.answer)[1];
    const yourTurn = () => { setTurn(false); busy = false; speak([{ text: 'Your turn.' }, ...it.ask]); };
    const model = async () => {   // My turn: point at the answer and say it
      busy = true; setTurn(true); right.classList.add('hint'); await speak(it.model); right.classList.remove('hint'); if (!$('ask').hidden) yourTurn();
    };
    $('sayagain').onclick = () => speak(it.ask);
    btns.forEach(([c, b]) => b.onclick = async () => {
      if (busy) return;
      const res = tutor.answer(it, c.id, first); store();
      if (res.ok) {
        busy = true; b.classList.add('right'); beep(880, .15, 'sine', .08);
        const praise = first ? [{ clip: '/audio/phonics/words/_nice.mp3' }] : [{ text: 'Yes!' }];
        await speak([...praise, ...(it.answerClip ? [it.answerClip] : it.sayAnswer ? [{ text: it.sayAnswer + '.' }] : [])]);
        $('ask').hidden = true; done({ firstTry: first, res });
      } else {   // correction: model it, then the same question again
        first = false; b.classList.add('wrong'); beep(200, .15, 'triangle', .08);
        setTimeout(() => b.classList.remove('wrong'), 600); await model();
      }
    });
    if (it.modelFirst) model(); else { setTurn(false); speak(it.why === 'retest' ? [{ text: 'Let’s try this one again.' }, ...it.ask] : it.ask); }
  });
}

// ---- the race ----
let race = null, earned = 0;
function toast(t, ms = 1400) { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => { el.hidden = true; }, ms); }
function setItem(it) { const b = $('item'); b.disabled = !it; b.textContent = it ? ITEMS[it].icon : '⭐'; b.classList.toggle('ready', !!it); b.setAttribute('aria-label', it ? 'Use ' + ITEMS[it].name : 'No power-up yet: drive through a star crate'); }
let miniTrack = null;
function drawMini(racers) {
  const c = $('mini'), g = c.getContext('2d'), W = c.width;
  if (!miniTrack) { miniTrack = buildTrackPath(160).S; }
  const X = x => W / 2 + x / 190 * (W / 2 - 14), Z = z => W / 2 + z / 190 * (W / 2 - 14);   // top view, not mirrored
  g.clearRect(0, 0, W, W); g.lineWidth = 16; g.strokeStyle = '#D9822B'; g.lineJoin = 'round'; g.beginPath(); miniTrack.forEach((s, i) => i ? g.lineTo(X(s.x), Z(s.z)) : g.moveTo(X(s.x), Z(s.z))); g.closePath(); g.stroke();
  racers.slice().sort((a, b) => a.me - b.me).forEach(r => { g.beginPath(); g.arc(X(r.x), Z(r.z), r.me ? 13 : 9, 0, 7); g.fillStyle = r.paint; g.fill(); g.lineWidth = r.me ? 5 : 3; g.strokeStyle = '#22203F'; g.stroke(); });
}
const ORD = ['', 'st', 'nd', 'rd', 'th'];
function startRace() {
  show('loading');
  if (race) { race.dispose(); race = null; }
  tutor = new Tutor(save.tutor, subject, rng); earned = 0;
  const mult = SPEEDS[save.speed][1], rivals = RIVALS.map(r => Object.assign({}, r, { skill: r.skill * mult }));
  setTimeout(() => {
    race = createRace($('gl'), { player: save.look, rivals, on: {
      count: n => { const c = $('count'); c.hidden = false; c.textContent = n; beep(n === 'GO' ? 880 : 440, .25, 'square', .08); if (n === 'GO') setTimeout(() => { c.hidden = true; }, 700); },
      lap: n => { toast(n === 3 ? 'Last lap!' : 'Lap ' + n + '!'); speak([{ text: n === 3 ? 'Last lap!' : 'Lap ' + n }]); },
      item: setItem,
      sound: (k, mine) => { if (mine && SFX[k]) SFX[k](); },
      hud: h => { $('place').innerHTML = h.place + '<small>' + (ORD[h.place] || 'th') + '</small>'; $('lap').innerHTML = 'Lap ' + h.lap + '<small>/3</small>'; drawMini(h.racers); },
      crate: async () => {
        race.hold(true); steerSet(0);
        const it = tutor.next(), r = await ask(it);
        if (r.firstTry) { earned++; save.stars++; }
        if (r.res.levelUp) toast('Level up! ' + r.res.levelName, 2200);
        const behind = race.debug().me.place >= 3, pool = behind ? ['nitro', 'nitro', 'spring', 'mud'] : ['nitro', 'mud', 'shield', 'spring'];
        const item = r.firstTry ? pool[Math.floor(rng() * pool.length)] : 'nitro';
        race.give(item); toast(ITEMS[item].icon + ' ' + ITEMS[item].name + '!'); store(); race.hold(false);
      },
      finish: res => {
        const bonus = [0, 5, 3, 2, 1][res.place] || 1; save.stars += bonus; earned += bonus; save.races++; if (res.place === 1) save.trophies++;
        const newBest = !save.best || res.time < save.best; if (newBest) save.best = res.time; store();
        $('r-title').textContent = res.place === 1 ? 'You won! 🏆' : 'You came ' + res.place + ORD[res.place] + '!';
        $('r-list').innerHTML = res.order.map((o, i) => `<li class="${o.me ? 'me' : ''}"><span>${i + 1}. <span class="dot" style="background:${o.paint}"></span> ${o.me ? save.look.name : o.name}</span><span>${o.time ? o.time.toFixed(1) + ' s' : '…'}</span></li>`).join('');
        $('r-stars').textContent = '⭐ +' + earned; $('r-best').textContent = '⏱ Best ' + save.best.toFixed(1) + ' s' + (newBest ? ' — new!' : '');
        show('results'); speak([{ clip: res.place === 1 ? '/audio/phonics/words/_win.mp3' : '/audio/phonics/words/_top.mp3' }]);
      },
    } });
    setItem(null); show('race'); race.start();
    // warm-up: the first question comes before the countdown, so every race starts with a My turn / Your turn
    race.hold(true);
    (async () => { const it = tutor.next(); const r = await ask(it); if (r.firstTry) { earned++; save.stars++; } store(); race.give('nitro'); toast('🔥 Nitro for the start!'); race.hold(false); })();
  }, 60);
}

// ---- steering: buttons, keys, and holding the screen's left or right side ----
let keyL = 0, keyR = 0, padL = 0, padR = 0;
function steerSet(v) { if (race) race.setSteer(v); }
function steerNow() { steerSet((keyR || padR ? 1 : 0) - (keyL || padL ? 1 : 0)); $('left').classList.toggle('on', !!(keyL || padL)); $('right').classList.toggle('on', !!(keyR || padR)); }
function hold(btn, set) { btn.addEventListener('pointerdown', e => { e.preventDefault(); btn.setPointerCapture(e.pointerId); set(1); steerNow(); }); ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => btn.addEventListener(ev, () => { set(0); steerNow(); })); }
hold($('left'), v => { padL = v; }); hold($('right'), v => { padR = v; });
addEventListener('keydown', e => { if ($('hud').hidden) return; if (['ArrowLeft', 'a', 'A'].includes(e.key)) keyL = 1; else if (['ArrowRight', 'd', 'D'].includes(e.key)) keyR = 1; else if ([' ', 'ArrowUp', 'w', 'W'].includes(e.key)) { race && race.useItem(); } else return; e.preventDefault(); steerNow(); });
addEventListener('keyup', e => { if (['ArrowLeft', 'a', 'A'].includes(e.key)) keyL = 0; if (['ArrowRight', 'd', 'D'].includes(e.key)) keyR = 0; steerNow(); });
$('item').onclick = () => race && race.useItem();

// ---- buttons ----
$('toSubj').onclick = () => { speeds(); levelsNote(); show('subject'); speak([{ text: 'Math or reading?' }]); };
$('back1').onclick = () => { show('garage'); garage(); };
$('s-math').onclick = () => { subject = 'math'; startRace(); };
$('s-reading').onclick = () => { subject = 'reading'; startRace(); };
$('again').onclick = startRace;
$('back2').onclick = () => { show('garage'); garage(); };
$('quit').onclick = () => { stopVoice(); $('ask').hidden = true; if (race) { race.dispose(); race = null; } show('garage'); garage(); };
const paintMute = () => { $('mute').textContent = muted ? '🔇' : '🔊'; $('mute').setAttribute('aria-pressed', muted); };
$('mute').onclick = () => { muted = !muted; save.muted = muted; store(); paintMute(); if (muted) stopVoice(); };
$('full').onclick = () => { const el = $('rally'); if (document.fullscreenElement) document.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen().catch(() => {}); };
const lv = (sub, d) => () => { const t = new Tutor(save.tutor, sub, rng); t.setLevel(save.tutor[sub].level + d); store(); levelsNote(); };
$('g-up').onclick = lv('math', 1); $('g-down').onclick = lv('math', -1); $('g-rup').onclick = lv('reading', 1); $('g-rdown').onclick = lv('reading', -1);
$('g-reset').onclick = () => { if (confirm('Clear all stars, unlocks and levels on this device?')) { try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); } };

paintMute(); show('garage');
if (window.THREE) garage(); else { swatches(); levelsNote(); $('toSubj').disabled = true; $('toSubj').textContent = 'The 3D engine did not load'; }
window.__rally = { get race() { return race; }, get save() { return save; } };
