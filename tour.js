/* The tours: one page, 27 tracks. The audio clock is the only state; everything drawn reads it.
   Each track's data (tours/<slug>.js) sets window.FTA_TOUR; its transform is bytes, one row per
   semitone from C1, ten columns a second. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var audio = $('audio'), cv = $('gram'), ctx = cv.getContext('2d');
  var tracks = window.FTA_TOURS || [], tour = null, img = null, raf = 0, curStop = -1;
  var GROUPS = { bach: 'Bach, remixed', soundtrack: 'From the soundtrack', influences: 'From the guide\'s influences' };

  function fmt(s) { s = Math.max(0, s || 0); var m = Math.floor(s / 60), r = Math.floor(s % 60); return m + ':' + (r < 10 ? '0' : '') + r; }
  function toast(msg) { var t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('on'); }, 1600); }

  /* ---- the picker: a list on wide screens, a select on phones */
  function buildPicker() {
    var list = $('list'), pick = $('pick'), last = null;
    tracks.forEach(function (t) {
      if (t.group !== last) {
        var h = document.createElement('h2'); h.textContent = GROUPS[t.group] || t.group; list.appendChild(h);
        var og = document.createElement('optgroup'); og.label = GROUPS[t.group] || t.group; pick.appendChild(og); last = t.group;
      }
      var b = document.createElement('button'); b.type = 'button'; b.dataset.slug = t.slug;
      b.innerHTML = '';
      b.appendChild(document.createTextNode(t.title));
      var sp = document.createElement('span'); sp.textContent = 'after ' + t.artist; b.appendChild(sp);
      b.addEventListener('click', function () { load(t.slug, 0, true); });
      list.appendChild(b);
      var o = document.createElement('option'); o.value = t.slug; o.textContent = t.title + ' (after ' + t.artist + ')';
      pick.lastChild.appendChild(o);
    });
    pick.addEventListener('change', function () { load(pick.value, 0, true); });
  }

  /* ---- colors from the site's tokens, so light and dark both work; the transform sits on night */
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function hex(c) { var m = /^#?([0-9a-f]{6})$/i.exec(c); if (!m) return [255, 255, 255]; var n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function ramp() {
    var stops = [[0, [11, 16, 22]], [.35, hex('#1F4E9A')], [.62, hex('#7C3AED')], [.85, hex('#DB7A26')], [1, [255, 236, 190]]];
    var lut = new Uint8ClampedArray(256 * 3);
    for (var i = 0; i < 256; i++) {
      var u = i / 255, k = 1; while (k < stops.length - 1 && stops[k][0] < u) k++;
      var a = stops[k - 1], b = stops[k], w = (u - a[0]) / (b[0] - a[0]);
      for (var c = 0; c < 3; c++) lut[i * 3 + c] = a[1][c] + (b[1][c] - a[1][c]) * w;
    }
    return lut;
  }
  var LUT = ramp();

  function decode(g) {
    var bin = atob(g.b64), n = bin.length, bytes = new Uint8Array(n);
    for (var i = 0; i < n; i++) bytes[i] = bin.charCodeAt(i);
    var off = document.createElement('canvas'); off.width = g.cols; off.height = g.rows;
    var o = off.getContext('2d'), id = o.createImageData(g.cols, g.rows);
    for (var r = 0; r < g.rows; r++) for (var c = 0; c < g.cols; c++) {
      var v = bytes[r * g.cols + c], p = ((g.rows - 1 - r) * g.cols + c) * 4;
      id.data[p] = LUT[v * 3]; id.data[p + 1] = LUT[v * 3 + 1]; id.data[p + 2] = LUT[v * 3 + 2]; id.data[p + 3] = 255;
    }
    o.putImageData(id, 0, 0);
    return off;
  }

  function size() {
    var r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d);
    draw();
  }

  function draw() {
    if (!tour || !img) return;
    var W = cv.width, H = cv.height, d = W / cv.getBoundingClientRect().width;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0, W, H);
    var T = tour.seconds, t = audio.currentTime || 0;
    ctx.font = (12 * d) + 'px ' + (css('--font') || 'sans-serif');
    ctx.textBaseline = 'top';
    tour.stops.forEach(function (s, i) {
      var x = Math.round(s.t / T * W) + .5;
      ctx.strokeStyle = 'rgba(255,255,255,' + (i === curStop ? .9 : .35) + ')'; ctx.lineWidth = d;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      if (W > 420 * d || i === curStop) {
        ctx.fillStyle = 'rgba(11,16,22,.7)'; var label = s.label, w = ctx.measureText(label).width + 8 * d;
        ctx.fillRect(x + 2 * d, 4 * d, w, 18 * d);
        ctx.fillStyle = '#EEF1F4'; ctx.fillText(label, x + 6 * d, 7 * d);
      }
    });
    ctx.fillStyle = 'rgba(238,241,244,.55)';
    for (var oct = 2; oct <= 6; oct++) { var y = H - (oct - 1) * 12 / 72 * H; ctx.fillText('C' + oct, 4 * d, y - 14 * d); }
    var px = t / T * W;
    ctx.fillStyle = 'rgba(11,16,22,.35)'; ctx.fillRect(0, 0, px, H);
    ctx.fillStyle = '#FFC21A'; ctx.fillRect(Math.round(px) - d, 0, 2 * d, H);
  }

  function stopAt(t) { var k = 0; tour.stops.forEach(function (s, i) { if (t >= s.t - .05) k = i; }); return k; }

  function tick() {
    var t = audio.currentTime || 0, k = stopAt(t);
    $('clock').textContent = fmt(t) + ' / ' + fmt(tour.seconds);
    if (k !== curStop) {
      curStop = k;
      Array.prototype.forEach.call($('stops').children, function (li, i) { li.setAttribute('aria-current', i === k ? 'true' : 'false'); });
    }
    draw();
    if (!audio.paused) raf = requestAnimationFrame(tick); else raf = 0;
  }
  function kick() { if (!raf) raf = requestAnimationFrame(tick); }

  /* ---- load a tour: its data script, its audio, its words */
  function load(slug, at, userInitiated) {
    if (!tracks.some(function (t) { return t.slug === slug; })) slug = tracks[0].slug;
    audio.pause();
    Array.prototype.forEach.call($('list').querySelectorAll('button'), function (b) { b.setAttribute('aria-current', b.dataset.slug === slug ? 'true' : 'false'); });
    $('pick').value = slug;
    $('title').textContent = 'Loading…';
    var s = document.createElement('script');
    s.src = 'tours/' + slug + '.js';
    s.onload = function () {
      tour = window.FTA_TOUR; img = decode(tour.gram); curStop = -1;
      $('title').textContent = tour.title;
      $('meta').textContent = 'after ' + tour.artist + ' · ' + tour.bpm + ' BPM' + (tour.key ? ' · ' + tour.key : '') + ' · ' + fmt(tour.seconds);
      $('how').textContent = tour.how;
      $('trick').innerHTML = ''; var b = document.createElement('b'); b.textContent = 'The trick: '; $('trick').appendChild(b);
      $('trick').appendChild(document.createTextNode(tour.trick));
      var ol = $('stops'); ol.innerHTML = '';
      tour.stops.forEach(function (st) {
        var li = document.createElement('li'), btn = document.createElement('button'), div = document.createElement('div');
        btn.type = 'button'; btn.textContent = fmt(st.t); btn.setAttribute('aria-label', 'Jump to ' + st.label + ' at ' + fmt(st.t));
        btn.addEventListener('click', function () { seek(st.t, true); });
        var bb = document.createElement('b'); bb.textContent = st.label; var p = document.createElement('p'); p.textContent = st.text;
        div.appendChild(bb); div.appendChild(p); li.appendChild(btn); li.appendChild(div); ol.appendChild(li);
      });
      $('fine').textContent = 'Synthesized from code on a beat-semitone grid, with no samples, and written from what is known of ' +
        tour.artist.replace(' (unverified)', '') + '’s method, not copied from a recording.' +
        (tour.group === 'bach' ? ' Bach’s notes come from the Mutopia Project’s public-domain edition of BWV 846.' : '') + ' Mastered to ' + tour.checks.lufs +
        ' LUFS, true peak ' + tour.checks.tp + ' dBTP, ' + tour.checks.clicks + ' stray clicks. Fingerprint ' + tour.checks.sha + '.';
      audio.src = 'tours/' + slug + '.mp3';
      audio.currentTime = at || 0;
      history.replaceState(null, '', '?t=' + slug + (at ? '&s=' + at.toFixed(1) : ''));
      document.title = tour.title + ' | How do you build a sound? | FluidTA';
      $('play').textContent = 'Play'; $('play').setAttribute('aria-label', 'Play');
      size(); tick();
      if (userInitiated && window.innerWidth <= 820) $('card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    s.onerror = function () { $('title').textContent = 'This tour could not load.'; };
    document.head.appendChild(s);
  }

  function seek(t, play) {
    audio.currentTime = Math.max(0, Math.min(tour.seconds - .05, t));
    if (play && audio.paused) audio.play().catch(function () {});
    kick(); tick();
  }

  /* ---- controls */
  $('play').addEventListener('click', function () {
    if (!tour) return;
    if (audio.paused) audio.play().catch(function () { toast('Tap again to start the audio'); }); else audio.pause();
  });
  audio.addEventListener('play', function () { $('play').textContent = 'Pause'; $('play').setAttribute('aria-label', 'Pause'); kick(); });
  audio.addEventListener('pause', function () { $('play').textContent = 'Play'; $('play').setAttribute('aria-label', 'Play'); tick(); });
  audio.addEventListener('ended', function () { tick(); });
  audio.addEventListener('seeked', function () { tick(); });
  function fromEvent(e) { var r = cv.getBoundingClientRect(); return (e.clientX - r.left) / r.width * tour.seconds; }
  cv.addEventListener('click', function (e) { if (tour) seek(fromEvent(e), true); });
  $('copy').addEventListener('click', function () {
    var url = location.origin + location.pathname + '?t=' + tour.slug + '&s=' + (audio.currentTime || 0).toFixed(1);
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { toast('Link copied'); }, function () { toast(url); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space' && !/INPUT|SELECT|BUTTON|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); $('play').click(); }
  });
  window.addEventListener('resize', size);
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', draw);

  buildPicker();
  var q = new URLSearchParams(location.search);
  load(q.get('t') || tracks[0].slug, parseFloat(q.get('s')) || 0, false);
})();
