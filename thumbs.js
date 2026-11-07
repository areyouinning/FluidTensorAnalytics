/* One small drawing per card, viewBox 320 x 180. They use the kit's colors, so they follow light and dark. */
(function () {
  var B = 'var(--blue)', O = 'var(--orange)', P = 'var(--purple)', G = 'var(--green)', I = 'var(--ink)', S = 'var(--ink-soft)', L = 'var(--line)', W = 'var(--panel)';
  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  function rect(x, y, w, h, f, r, o) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + f + '"' + (r ? ' rx="' + r + '"' : '') + (o != null ? ' opacity="' + o + '"' : '') + '/>'; }
  function dot(x, y, r, f, o) { return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + f + '"' + (o != null ? ' opacity="' + o + '"' : '') + '/>'; }
  function line(d, c, w, o) { return '<path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="' + (w || 2) + '" stroke-linecap="round" stroke-linejoin="round"' + (o != null ? ' opacity="' + o + '"' : '') + '/>'; }
  function text(x, y, s, size, f, a) { return '<text x="' + x + '" y="' + y + '" font-size="' + size + '" font-weight="600" fill="' + (f || I) + '" text-anchor="' + (a || 'middle') + '" font-family="var(--font)">' + s + '</text>'; }
  function board(n, cell, x0, y0) { var o = ''; for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) o += rect(x0 + c * cell, y0 + r * cell, cell, cell, (r + c) % 2 ? L : W); return o; }
  function crown(x, y, s, f) { return '<path transform="translate(' + x + ' ' + y + ') scale(' + s + ')" fill="' + f + '" d="M2 7.3 1.2 3.4 3 5.1 3.4 2.6 4.4 4.6 5 2.2 5.6 4.6 6.6 2.6 7 5.1 8.8 3.4 8 7.3ZM2 7.7h6v1.2H2Z"/>'; }
  /* an isometric cube of n cells a side, colored by fn(i, j) on its three faces */
  function iso(cx, cy, n, s, fn) {
    var o = '', dx = s * .866, dy = s * .5;
    function p(x, y, z) { return (cx + (x - y) * dx).toFixed(1) + ' ' + (cy + (x + y - n) * dy - (z - n / 2) * s).toFixed(1); }
    function q(a, b, c, d, f) { return '<path d="M' + a + 'L' + b + 'L' + c + 'L' + d + 'Z" fill="' + f + '" stroke="var(--sunk)"/>'; }
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
      o += q(p(i, n, j), p(i + 1, n, j), p(i + 1, n, j + 1), p(i, n, j + 1), fn(i, j, 0));
      o += q(p(n, i, j), p(n, i + 1, j), p(n, i + 1, j + 1), p(n, i, j + 1), fn(i, j, 1));
      o += q(p(i, j, n), p(i + 1, j, n), p(i + 1, j + 1, n), p(i, j + 1, n), fn(i, j, 2));
    }
    return o;
  }

  window.FTA_THUMBS = {
    tiling: function () {
      var q = [1, 3, 5, 0, 2, 4], t = [[0, 0, 2, 3], [0, 1, 4, 5], [0, 2, 0, 0], [1, 3, 1, 2], [2, 4, 3, 4], [3, 5, 5, 5], [4, 5, 0, 1], [5, 5, 2, 3]], c = [B, O, P, G], s = 26, x = 82, y = 12, o = rect(x, y, s * 6, s * 6, W);
      t.forEach(function (a, k) { o += rect(x + a[2] * s + 1.5, y + a[0] * s + 1.5, (a[3] - a[2] + 1) * s - 3, (a[1] - a[0] + 1) * s - 3, c[k % 4], 3, .85); });
      q.forEach(function (col, r) { o += crown(x + col * s + 2, y + r * s + 2, 2.2, I); });
      return o;
    },
    queens: function () { var q = [0, 4, 7, 5, 2, 6, 1, 3], s = 20, x = 80, y = 10, o = board(8, s, x, y); q.forEach(function (c, r) { o += crown(x + c * s + 2, y + r * s + 2, 1.6, O); }); return o; },
    halves: function () {
      /* two kinds of vehicle arriving; one cell got both halves, one was half ruined */
      var o = line('M66 46 L124 78', S, 2, .4) + line('M254 46 L196 78', S, 2, .4);
      [[30, 30], [56, 20], [44, 52]].forEach(function (p) { o += dot(p[0], p[1], 7, B); });
      [[290, 30], [264, 20], [276, 52]].forEach(function (p) { o += dot(p[0], p[1], 7, O); });
      o += rect(118, 72, 84, 66, W, 12) + rect(127, 81, 29, 48, G, 6) + rect(164, 81, 29, 48, G, 6);
      o += rect(30, 100, 56, 46, W, 10) + rect(36, 106, 20, 34, G, 4) + rect(60, 106, 20, 34, O, 4);
      o += rect(234, 100, 56, 46, W, 10) + rect(240, 106, 20, 34, O, 4) + rect(264, 106, 20, 34, L, 4);
      return o;
    },
    coins: function () { var R = rng(7), o = ''; for (var r = 0; r < 6; r++) for (var c = 0; c < 6; c++) o += dot(100 + c * 24, 30 + r * 24, 9, R() > .5 ? B : L); return o + '<circle cx="172" cy="78" r="13" fill="none" stroke="' + O + '" stroke-width="4"/>'; },
    numbers: function () {
      var n = [2, 15, 3, 16, 9, 7, 25, 8, 21, 36, 11, 49], hot = { 2: 1, 3: 1, 7: 1, 11: 1 }, o = '';
      n.forEach(function (v, k) { var x = 40 + (k % 4) * 62, y = 18 + Math.floor(k / 4) * 50; o += rect(x, y, 54, 42, hot[v] ? B : W, 8) + text(x + 27, y + 28, v, 19, hot[v] ? 'var(--on-accent)' : I); });
      return o;
    },
    scramble: function () {
      var a = ['3', '+', '4', '=', '7'], b = ['2', '×', '4', '=', '8'], o = '', s = 34;
      a.forEach(function (v, k) { o += rect(75 + k * s, 73, s - 4, s - 4, W, 6) + text(90 + k * s, 95, v, 18); });
      b.forEach(function (v, k) { if (k !== 2) o += rect(143, 5 + k * s, s - 4, s - 4, W, 6) + text(158, 27 + k * s, v, 18); });
      return o + rect(143, 73, s - 4, s - 4, P, 6) + text(158, 95, '4', 18, 'var(--on-accent)');
    },
    scramble3d: function () { return '<g transform="translate(60 26) skewY(-14) scale(.85)">' + this.scramble() + '</g><g opacity=".45" transform="translate(96 62) skewY(-14) scale(.85)">' + this.scramble() + '</g>'; },
    garage: function () { // Paul's Cloud: a big cumulus over the mountains, raining
      var o = rect(0, 0, 320, 180, 'var(--gold)') + rect(16, 14, 288, 152, 'var(--sky)', 16);
      o += '<path d="M16 152 84 98l36 26 50-44 134 76v4a14 14 0 0 1-14 14H30a14 14 0 0 1-14-14Z" fill="var(--spruce)"/><path d="m170 80-20 18 14-3 8 8 10-7 10 5Z" fill="var(--snow)"/>';
      [[150, 108], [172, 116], [194, 108], [214, 116], [236, 108]].forEach(function (p, k) { o += '<path transform="translate(' + p[0] + ' ' + p[1] + ') scale(.62)" d="M12 2.5S5 10.5 5 15a7 7 0 0 0 14 0c0-4.5-7-12.5-7-12.5Z" fill="var(--drop)"/>'; });
      o += '<g transform="translate(0 16)"><path d="M118 84h150a20 20 0 0 0 4-40 30 30 0 0 0-48-22 36 36 0 0 0-64 6 26 26 0 0 0-42 28 14 14 0 0 0 0 28Z" fill="#C9D6E6"/>';
      o += '<path d="M120 76h146a18 18 0 0 0 2-36 28 28 0 0 0-46-20 34 34 0 0 0-60 6 24 24 0 0 0-40 26 12 12 0 0 0-2 24Z" fill="var(--snow)"/>'; o += '</g>';
      return o;
    },
    tensor: function () {
      var o = dot(36, 90, 9, B) + text(36, 150, '1', 15, S);
      for (var i = 0; i < 4; i++) o += rect(68, 54 + i * 18, 16, 16, O, 2);
      o += text(76, 150, '4', 15, S);
      for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) o += rect(106 + c * 18, 54 + r * 18, 16, 16, P, 2, .35 + (r + c) * .1);
      o += text(140, 150, '4×4', 15, S);
      return o + '<g>' + iso(250, 90, 4, 17, function (i, j, f) { return f === 0 ? G : f === 1 ? B : O; }) + '</g>' + text(250, 170, '4×4×4', 15, S);
    },
    cube: function () { var R = rng(21), h = [B, 'var(--sunk)', O]; return iso(160, 90, 6, 13.5, function (i, j, f) { return R() > .6 ? O : R() > .4 ? L : B; }); },
    spaghetti: function () {
      var R = rng(5), o = '';
      for (var k = 0; k < 16; k++) { var y = 90, v = 0, d = 'M20 90'; for (var x = 36; x <= 300; x += 16) { v = v * .8 + (R() - .5) * (x / 26); y = Math.max(8, Math.min(172, y + v)); d += 'L' + x + ' ' + y.toFixed(1); } o += line(d, k === 3 ? O : B, k === 3 ? 3 : 1.5, k === 3 ? 1 : .5); }
      return o + dot(20, 90, 5, I);
    },
    vortex: function () { var o = ''; [[160, 90, 110, 34], [160, 90, 72, 22], [160, 90, 38, 12]].forEach(function (e, k) { o += '<ellipse cx="' + e[0] + '" cy="' + e[1] + '" rx="' + e[2] + '" ry="' + e[3] + '" fill="none" stroke="' + [B, P, O][k] + '" stroke-width="' + (3 + k) + '" transform="rotate(' + (k * 28 - 14) + ' 160 90)"/>'; }); return o + dot(160, 90, 5, I); },
    stir: function () { var o = ''; for (var k = 0; k < 3; k++) { var d = ''; for (var t = 0; t < 34; t += .3) { var r = 4 + t * 2.3, a = t * .62 + k * 2.09; d += (d ? 'L' : 'M') + (160 + r * Math.cos(a) * 1.5).toFixed(1) + ' ' + (90 + r * Math.sin(a)).toFixed(1); } o += line(d, [B, O, P][k], 2.4, .85); } return o; },
    barrier: function () { var R = rng(11), o = ''; for (var k = 0; k < 90; k++) { var x = R() * 300 + 10, y = R() * 160 + 10, left = x < 160; if (R() < .22 && y > 80) left = !left; o += dot(x.toFixed(1), y.toFixed(1), 4, left ? B : O, .85); } return o + line('M160 6V70', I, 4); },
    river: function () {
      var R = rng(3), o = '';
      (function go(x, y, a, w, n) { if (n === 0) return; var l = 18 + n * 6, x2 = x + Math.sin(a) * l, y2 = y - Math.cos(a) * l; o += line('M' + x.toFixed(1) + ' ' + y.toFixed(1) + 'L' + x2.toFixed(1) + ' ' + y2.toFixed(1), B, w); go(x2, y2, a - .45 - R() * .25, w * .72, n - 1); go(x2, y2, a + .35 + R() * .3, w * .72, n - 1); })(160, 176, 0, 9, 6);
      return o;
    },
    rain: function () {
      var R = rng(17), o = '';
      for (var c = 0; c < 6; c++) for (var r = 0; r < 2; r++) o += '<path d="M' + (12 + c * 50) + ' ' + (108 + r * 34) + 'h46v30h-46Z" fill="' + (R() > .5 ? B : O) + '" opacity=".55"/>';
      for (var k = 0; k < 42; k++) { var x = R() * 300 + 10, y = R() * 86 + 6; o += line('M' + x.toFixed(0) + ' ' + y.toFixed(0) + 'v12', R() > .5 ? B : O, 2.4); }
      return o;
    },
    sphere: function () { var R = rng(31), o = '<circle cx="160" cy="90" r="78" fill="none" stroke="' + L + '" stroke-width="2"/>'; for (var k = 0; k < 260; k++) { var r = R() * 76, a = R() * 6.283; o += dot((160 + r * Math.cos(a)).toFixed(1), (90 + r * Math.sin(a)).toFixed(1), 2, r < 30 ? O : B, .85); } return o; },
    bridges: function () { // Königsberg: a river in two branches round an island, and seven bridges
      var o = rect(0, 70, 320, 50, B, 0, .35) + '<path d="M222 82H320V108H222Q212 95 222 82Z" fill="var(--sunk)"/><ellipse cx="104" cy="95" rx="66" ry="15" fill="var(--sunk)"/>';
      [[70, 66, 70, 82], [138, 66, 138, 82], [70, 108, 70, 124], [138, 108, 138, 124], [170, 95, 220, 95], [270, 66, 270, 84], [270, 106, 270, 124]].forEach(function (p, k) { o += line('M' + p[0] + ' ' + p[1] + 'L' + p[2] + ' ' + p[3], k === 4 ? O : I, 7); });
      return o + text(160, 160, '5 · 3 · 3 · 3', 18, S);
    },
    chladni: function () { // sand on a plate in mode (0, 4, minus): the two diagonals and a diamond, drawn as grains
      var R = rng(7), o = rect(90, 20, 140, 140, 'var(--panel)', 8), L = [[0, 0, 1, 1], [1, 0, 0, 1], [.5, 0, 1, .5], [1, .5, .5, 1], [.5, 1, 0, .5], [0, .5, .5, 0]];
      L.forEach(function (l) { for (var k = 0; k < 46; k++) { var t = R(), x = 90 + 140 * (l[0] + (l[2] - l[0]) * t) + (R() - .5) * 4, y = 20 + 140 * (l[1] + (l[3] - l[1]) * t) + (R() - .5) * 4; o += dot(x.toFixed(1), y.toFixed(1), 1.6, I); } });
      return o;
    },
    dice: function () { // four dice round a loop, each arrow a 2/3 win
      var P = [[160, 34], [240, 90], [160, 146], [80, 90]], F = ['var(--blue)', 'var(--orange)', 'var(--purple)', 'var(--green)'], N = ['4', '3', '6', '5'], o = '';
      P.forEach(function (p, k) { var q = P[(k + 1) % 4], dx = q[0] - p[0], dy = q[1] - p[1], d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
        o += line('M' + (p[0] + ux * 34).toFixed(1) + ' ' + (p[1] + uy * 34).toFixed(1) + 'L' + (q[0] - ux * 38).toFixed(1) + ' ' + (q[1] - uy * 38).toFixed(1), I, 3, .7);
        o += '<path d="M' + (q[0] - ux * 30).toFixed(1) + ' ' + (q[1] - uy * 30).toFixed(1) + 'l' + (-ux * 11 - uy * 6).toFixed(1) + ' ' + (-uy * 11 + ux * 6).toFixed(1) + 'l' + (uy * 12).toFixed(1) + ' ' + (-ux * 12).toFixed(1) + 'Z" fill="' + I + '" opacity=".7"/>'; });
      P.forEach(function (p, k) { o += rect(p[0] - 24, p[1] - 24, 48, 48, F[k], 10) + text(p[0], p[1] + 9, N[k], 26, 'var(--on-accent)'); });
      return o;
    },
    stalk: function () {
      var o = '<path d="M268 150v-40" stroke="' + G + '" stroke-width="7" stroke-linecap="round"/><circle cx="268" cy="96" r="20" fill="' + G + '"/>';
      [[30, 40, 60, 150], [66, 62, 102, 134], [102, 78, 140, 122], [140, 86, 182, 114]].forEach(function (p, k) { var o2 = .3 + k * .2; o += line('M' + p[0] + ' ' + p[1] + 'L268 96', G, 1.4, o2) + dot(p[0], p[1], 6, B, o2 + .1); var t = .35 + k * .12, x = 268 + (p[0] - 268) * (1 - t * .55), y = 96 + (p[1] - 96) * (1 - t * .55); o += dot(x.toFixed(1), y.toFixed(1), 5, I, o2 + .1); });
      return o;
    },
    wayWater: function () { var o = ''; for (var k = 0; k < 5; k++) o += line('M20 ' + (50 + k * 20) + 'q35 -22 70 0t70 0t70 0t70 0', B, 3, 1 - k * .15); return o; },
    waySeven: function () { return text(160, 106, 'e<tspan dy="-16" font-size="24">iπ</tspan><tspan dy="16"> + 1 = 0</tspan>', 44, I); },
    wayGodel: function () { return text(160, 120, 'G', 96, P) + line('M212 52c40 0 40 70 0 70M212 122l10 -8M212 122l10 9', O, 4); },
    wayUnlost: function () { return dot(160, 90, 38, I) + '<ellipse cx="160" cy="90" rx="84" ry="18" fill="none" stroke="' + O + '" stroke-width="5" transform="rotate(-14 160 90)"/>' + dot(160, 90, 34, 'var(--sunk)', .15); },
    wayClaude: function () { var R = rng(9), o = ''; for (var r = 0; r < 5; r++) { var x = 30; while (x < 280) { var w = 16 + R() * 44; o += rect(x.toFixed(0), 24 + r * 28, Math.min(w, 290 - x).toFixed(0), 18, r === 2 && x > 150 ? O : B, 5, .3 + R() * .6); x += w + 6; } } return o; },
    radar: function () { var o = ''; [30, 56, 82].forEach(function (r) { o += '<circle cx="160" cy="90" r="' + r + '" fill="none" stroke="' + L + '" stroke-width="2"/>'; }); return o + '<path d="M160 90 222 36A82 82 0 0 1 240 110Z" fill="' + G + '" opacity=".6"/><path d="M196 62l18 8 4 18-14 6-14-12Z" fill="' + O + '"/>' + dot(160, 90, 4, I); },
    snow: function () { var o = ''; for (var k = 0; k < 3; k++) o += line('M90 40 90 140', B, 5).replace('<path', '<path transform="rotate(' + k * 60 + ' 90 90)"'); [46, 74, 58, 96, 38].forEach(function (h, k) { o += rect(166 + k * 26, 140 - h, 20, h, k === 3 ? O : B, 3); }); return o; },
    peaks: function () { return '<path d="M0 150 58 92l28 26 50-62 42 46 34-30 44 42 64 28V180H0Z" fill="' + B + '" opacity=".75"/><path d="m136 56-18 22 12-4 8 8 10-7 8 4Z" fill="' + W + '"/>' + line('M136 54V24', O, 3) + dot(136, 22, 6, O); },
    pareto: function () { var R = rng(13), o = line('M36 20V152H300', S, 2); for (var k = 0; k < 40; k++) { var x = 44 + R() * 240, f = 18 + 12000 / (x + 60), y = f + R() * 70; o += dot(x.toFixed(0), Math.min(146, y).toFixed(0), 3, L); } for (var x2 = 44; x2 < 290; x2 += 24) o += dot(x2, (18 + 12000 / (x2 + 60)).toFixed(0), 5, O); return o; },
    parallel: function () { var R = rng(19), o = ''; [50, 123, 196, 270].forEach(function (x) { o += line('M' + x + ' 18V162', S, 2); }); for (var k = 0; k < 14; k++) { var d = 'M50 ' + (20 + R() * 140).toFixed(0) + 'L123 ' + (20 + R() * 140).toFixed(0) + 'L196 ' + (20 + R() * 140).toFixed(0) + 'L270 ' + (20 + R() * 140).toFixed(0); o += line(d, k === 2 ? O : B, k === 2 ? 3 : 1.4, k === 2 ? 1 : .45); } return o; }
  };
})();
