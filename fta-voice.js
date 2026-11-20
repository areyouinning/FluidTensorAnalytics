/* The kids' games' voice: River, from ElevenLabs, pre-recorded.
   Every line a game can say is recorded ahead of time (scripts/gen_river.mjs) and listed in
   /audio/river/index.json, keyed by the normalized sentence. A line is played sentence by sentence;
   a sentence that was not recorded whole is pieced together from recorded parts around its numbers
   ("You got" · 12 · "gems, kiddo!"). Only if a piece is still missing does the whole line fall back
   to the device's own voice, so one line is never said in two voices.

   FTAVoice.say(text, {queue})   speak a line; returns a promise for when it is done
   FTAVoice.seq(segs)            speak [{text}|{clip:url}] in order (the Rally's format)
   FTAVoice.clips(urls)          play recorded clips back to back
   FTAVoice.stop()               stop talking
   The same splitting functions are used by the recorder under Node. */
(function (root) {
  'use strict';
  function key(s) { return String(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase(); }
  function sentences(text) { return String(text).replace(/\s+/g, ' ').trim().replace(/([.!?:])\s+(?=\S)/g, '$1\u0000').split('\u0000').filter(function (s) { return /[a-z0-9]/i.test(s); }); }
  /* a sentence's parts around its whole numbers; punctuation-only parts are dropped */
  function parts(sentence) {
    return sentence.split(/(\d+)/).map(function (p) { return p.trim(); }).filter(function (p) { return /[a-z0-9]/i.test(p); });
  }
  /* the keys that would play a line, or null if it cannot be played from the bank */
  function plan(text, has) {
    var out = [], ss = sentences(text);
    for (var i = 0; i < ss.length; i++) {
      var k = key(ss[i]);
      if (has(k)) { out.push(k); continue; }
      var ps = parts(ss[i]);
      for (var j = 0; j < ps.length; j++) { var pk = key(ps[j]); if (!has(pk)) return null; out.push(pk); }
    }
    return out;
  }
  var api = { key: key, sentences: sentences, parts: parts, plan: plan };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  var BASE = '/audio/river/', index = null, indexP = null, ctx = null, bufs = {}, gen = 0, live = [];
  api.misses = [];
  function loadIndex() {
    if (!indexP) indexP = fetch(BASE + 'index.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }).then(function (j) { index = j || {}; return index; });
    return indexP;
  }
  function ac() {
    if (!ctx) { var C = root.AudioContext || root.webkitAudioContext; if (!C) return null; try { ctx = new C(); } catch (e) { return null; } }
    if (ctx.state === 'suspended') ctx.resume().catch(function () {});
    return ctx;
  }
  /* unlock audio on the first touch, as phones require */
  ['pointerdown', 'keydown', 'touchend'].forEach(function (t) { root.addEventListener && root.addEventListener(t, function () { ac(); loadIndex(); }, { capture: true, passive: true }); });
  function buf(url) {
    if (bufs[url]) return bufs[url];
    var c = ac(); if (!c) return Promise.resolve(null);
    bufs[url] = fetch(url).then(function (r) { return r.ok ? r.arrayBuffer() : Promise.reject(); })
      .then(function (a) { return new Promise(function (ok, no) { c.decodeAudioData(a, ok, no); }); })
      .catch(function () { delete bufs[url]; return null; });
    return bufs[url];
  }
  function stopAll() { live.forEach(function (s) { try { s.stop(); } catch (e) {} }); live = []; try { root.speechSynthesis && root.speechSynthesis.cancel(); } catch (e) {} }
  /* play decoded clips back to back, with a short breath between sentences */
  function playUrls(urls, gaps, me) {
    return Promise.all(urls.map(buf)).then(function (bs) {
      var c = ac(); if (!c || me !== gen) return;
      var t = c.currentTime + 0.03, end = t;
      bs.forEach(function (b, i) { if (!b) return; var s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(t); live.push(s); t += b.duration + (gaps ? gaps[i] || 0 : 0.04); end = t; });
      return new Promise(function (res) { setTimeout(res, Math.max(0, (end - c.currentTime) * 1000)); });
    });
  }
  function device(text, me) {
    return new Promise(function (res) {
      var ss = root.speechSynthesis; if (!ss || me !== gen) return res();
      var u = new SpeechSynthesisUtterance(text); u.rate = 0.95; u.pitch = 1.05;
      var t = setTimeout(res, 1500 + 90 * text.length); u.onend = u.onerror = function () { clearTimeout(t); res(); }; ss.speak(u);
    });
  }
  function sayOne(text, me) {
    return loadIndex().then(function (ix) {
      if (me !== gen) return;
      var p = plan(text, function (k) { return Object.prototype.hasOwnProperty.call(ix, k); });
      if (!p) { api.misses.push(text); return device(text, me); }
      var ss = sentences(text), gaps = [], n = 0;   // a longer pause where a sentence ends than between pieces of one
      ss.forEach(function (s) { var k = key(s), m = Object.prototype.hasOwnProperty.call(ix, k) ? 1 : parts(s).length; for (var i = 0; i < m; i++) gaps[n++] = i === m - 1 ? 0.16 : 0.03; });
      return playUrls(p.map(function (k) { return BASE + ix[k]; }), gaps, me);
    });
  }
  var chain = Promise.resolve();
  api.say = function (text, opts) {
    if (!text) return Promise.resolve();
    if (!(opts && opts.queue)) { gen++; stopAll(); chain = Promise.resolve(); }
    var me = gen; chain = chain.then(function () { return me === gen ? sayOne(text, me) : null; }); return chain;
  };
  api.seq = function (segs) {
    gen++; stopAll(); var me = gen; chain = Promise.resolve();
    segs.forEach(function (s) { chain = chain.then(function () { if (me !== gen) return; return s.clip ? playUrls([s.clip], [0.06], me) : sayOne(s.text, me); }); });
    return chain;
  };
  api.clips = function (urls) { gen++; stopAll(); return playUrls(urls, null, gen); };
  api.stop = function () { gen++; stopAll(); };
  api.preload = loadIndex;
  root.FTAVoice = api;
})(typeof window !== 'undefined' ? window : globalThis);
