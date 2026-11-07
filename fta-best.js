/* Personal bests and proof links. There is no server behind this site, so there is no board
   everyone shares. Two things stand in for one:

   - Your best is kept in this browser, on this device. It never leaves and nobody else sees it.
   - A proof link carries the SOLUTION, not the score. Whoever opens it recomputes the number
     from the solution itself, so a link cannot overstate what it did. That is the whole trick:
     nothing needs to be trusted, because everything can be rechecked.

   Storage can be missing or throw outright (private windows, blocked site data), so every read
   and write is wrapped and the page has to work when it comes back empty. */
(function () {
  var P = 'fta-best-';

  function get(key) {
    try {
      var v = localStorage.getItem(P + key);
      return v === null || v === '' ? null : +v;
    } catch (e) { return null; }
  }
  function set(key, v) {
    try { localStorage.setItem(P + key, String(v)); } catch (e) { /* nothing to do: bests are a convenience */ }
  }
  /* returns the standing best and whether this attempt improved it */
  function record(key, score, lowerIsBetter) {
    if (!isFinite(score)) return { best: get(key), improved: false };
    var cur = get(key);
    var win = cur === null || (lowerIsBetter ? score < cur : score > cur);
    if (win) set(key, score);
    return { best: win ? score : cur, improved: win };
  }
  function clear(key) { try { localStorage.removeItem(P + key); } catch (e) { } }

  /* a row of kit stat tiles; returns the <b> nodes so the page can fill them */
  function strip(host, labels) {
    var d = document.createElement('div');
    d.className = 'read';
    var vals = labels.map(function (t) {
      var s = document.createElement('div'), a = document.createElement('small'), b = document.createElement('b');
      s.className = 'stat';
      a.textContent = t;
      b.textContent = '-';
      s.appendChild(a); s.appendChild(b); d.appendChild(s);
      return b;
    });
    host.appendChild(d);
    return vals;
  }

  function parse() {
    var o = {}, h = location.hash.slice(1);
    if (!h) return o;
    h.split('&').forEach(function (p) {
      var i = p.indexOf('=');
      if (i > 0) o[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1));
    });
    return o;
  }
  function share(obj) {
    var q = Object.keys(obj).map(function (k) { return k + '=' + encodeURIComponent(obj[k]); }).join('&');
    return location.origin + location.pathname + '#' + q;
  }

  /* a button that copies text, with the clipboard's usual failure path covered */
  function copier(box, text, label) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn';
    b.textContent = label || 'Copy my result link';
    b.addEventListener('click', function () {
      var s = typeof text === 'function' ? text() : text;
      var done = function (word) { b.textContent = word; setTimeout(function () { b.textContent = label || 'Copy my result link'; }, 1600); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(s).then(function () { done('Copied'); }, function () { window.prompt('Copy this link', s); });
      } else {
        window.prompt('Copy this link', s);
      }
    });
    box.appendChild(b);
    return b;
  }

  window.FTABest = { get: get, record: record, clear: clear, strip: strip, parse: parse, share: share, copier: copier };
})();
