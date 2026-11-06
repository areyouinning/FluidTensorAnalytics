/* FluidTA kit: the site's frame and its loaders. One script tag on every page.
   <script src="/fta.js" defer></script>            native page: top bar, tab bar, shelves, diagrams, footer
   <script src="/fta.js" data-guest defer></script>  a tool with its own look: one slim bar, nothing else changes
   data-guest="kids" gives Paul's games the gold bar. */
(function () {
  var me = document.currentScript, guest = me.hasAttribute('data-guest');
  var base = me.src.replace(/fta\.js.*$/, '');
  var TABS = [
    { href: '/', shelf: 'home', label: 'Home', icon: '<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/>' },
    { href: '/explore.html', shelf: 'explore', label: 'Explore', icon: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>' },
    { href: '/play.html', shelf: 'play', label: 'Play', icon: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 12h16M12 4v16"/>' },
    { href: '/way-of.html', shelf: 'way', label: 'Way Of', icon: '<path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1z"/><path d="M12 6v14"/>' },
    { href: '/tools.html', shelf: 'tools', label: 'Tools', icon: '<path d="M4 18l6-6M14 4a5 5 0 0 0-3 8l-7 7 1 1 7-7a5 5 0 0 0 8-3l-3 2-3-3z"/>' }
  ];
  var DROP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5S5 10.5 5 15a7 7 0 0 0 14 0c0-4.5-7-12.5-7-12.5Z" fill="var(--blue, #1F6FEB)"/></svg>';
  var path = location.pathname.replace(/index\.html$/, '') || '/';

  function load(file) {
    return new Promise(function (ok, no) {
      var s = document.createElement('script');
      s.src = base + file; s.onload = ok; s.onerror = no;
      document.head.appendChild(s);
    });
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function entry() { return (window.FTA_CATALOG || []).find(function (e) { return e.href === path; }); }
  function shelfOf() {
    var e = entry(), named = document.body.getAttribute('data-tab');
    return named || (e && e.shelf) || (path === '/' ? 'home' : '');
  }

  /* the slim bar for guests lives in a shadow root, so neither page's styles can touch the other */
  function guestBar() {
    var kids = me.getAttribute('data-guest') === 'kids', e = entry();
    var tab = TABS.find(function (t) { return e && t.shelf === e.shelf; }) || TABS[0];
    var host = document.createElement('div');
    host.id = 'fta-bar';
    var root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<style>' +
      ':host{display:block;position:relative;z-index:9999;font:600 16px "Atkinson Hyperlegible Next","Atkinson Hyperlegible",system-ui,sans-serif}' +
      'div{display:flex;justify-content:space-between;align-items:center;gap:8px;min-height:48px;padding:0 12px;background:#FCFBF9;color:#1B1D21;border-bottom:1px solid #DCDFE4}' +
      'a{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 4px;color:inherit;text-decoration:none}' +
      'a:focus-visible{outline:3px solid #1F6FEB;outline-offset:2px}svg{width:20px;height:20px}' +
      (kids ? 'div{background:#FFF;color:#0E1B2B;border:0;border-radius:22px;margin-top:10px;box-shadow:0 8px 24px rgba(14,27,43,.18)}' : '@media(prefers-color-scheme:dark){div{background:#10161D;color:#EEF1F4;border-color:#303C49}}') +
      '</style><div><a href="/">' + DROP + 'FluidTA</a><a href="' + tab.href + '">All of ' + esc(tab.label) + '</a></div>';
    document.body.insertBefore(host, document.body.firstChild);
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@600&display=swap';
    document.head.appendChild(link);
  }

  function frame() {
    var cur = shelfOf(), body = document.body;
    var nav = TABS.map(function (t) {
      return '<a href="' + t.href + '"' + (t.shelf === cur ? ' aria-current="page"' : '') + '><svg viewBox="0 0 24 24" aria-hidden="true">' + t.icon + '</svg>' + t.label + '</a>';
    }).join('');
    var top = document.createElement('div');
    var main = document.querySelector('main'); if (main && !main.id) main.id = 'main';
    top.innerHTML = '<a class="skip" href="#' + (main ? main.id : 'main') + '">Skip to the page</a><header class="bar"><a class="mark" href="/">' + DROP + 'FluidTA</a></header><nav class="tabs" aria-label="Site">' + nav + '</nav>';
    while (top.lastChild) body.insertBefore(top.lastChild, body.firstChild);
    var foot = document.createElement('footer');
    foot.className = 'site';
    foot.innerHTML = 'Made for fun in Westminster, Colorado. <a href="mailto:taylor@fluidtensoranalytics.com">Say hello</a>.';
    body.appendChild(foot);
  }

  function card(e) {
    var svg = (window.FTA_THUMBS && FTA_THUMBS[e.thumb]) ? FTA_THUMBS[e.thumb]() : '';
    return '<li><a class="card' + (e.kids ? ' kids' : '') + '" href="' + e.href + '"><svg class="thumb" viewBox="0 0 320 180" aria-hidden="true">' + svg + '</svg><div class="txt"><b>' + esc(e.title) + '</b><span>' + esc(e.blurb) + '</span></div></a></li>';
  }
  /* <div data-shelf="play" data-limit="4"> or <div data-topic="fluids"> fills itself from the catalog */
  function shelves() {
    document.querySelectorAll('[data-shelf],[data-topic],[data-hrefs]').forEach(function (box) {
      var shelf = box.getAttribute('data-shelf'), topic = box.getAttribute('data-topic'), limit = +box.getAttribute('data-limit') || 999;
      var picks = (box.getAttribute('data-hrefs') || '').split(/\s+/).filter(Boolean);
      var list = picks.length ? picks.map(function (h) { return FTA_CATALOG.find(function (e) { return e.href === h; }); }).filter(Boolean)
        : FTA_CATALOG.filter(function (e) { return (!shelf || e.shelf === shelf) && (!topic || e.topics.indexOf(topic) >= 0); });
      box.innerHTML = '<ul class="cards">' + list.slice(0, limit).map(card).join('') + '</ul>';
    });
  }
  /* explore.html's chips: a hash picks the topic, so a chip can be linked and Back works */
  function chips() {
    var bar = document.querySelector('[data-chips]');
    if (!bar) return;
    var box = document.querySelector(bar.getAttribute('data-chips'));
    bar.innerHTML = '<a class="chip" href="#">All</a>' + Object.keys(FTA_TOPICS).filter(function (k) {
      return FTA_CATALOG.some(function (e) { return e.shelf === 'explore' && e.topics.indexOf(k) >= 0; });
    }).map(function (k) { return '<a class="chip" href="#' + k + '">' + esc(FTA_TOPICS[k]) + '</a>'; }).join('');
    function show() {
      var k = location.hash.slice(1);
      if (k) box.setAttribute('data-topic', k); else box.removeAttribute('data-topic');
      bar.querySelectorAll('a').forEach(function (a) {
        if (a.getAttribute('href') === '#' + k) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
      shelves();
    }
    window.addEventListener('hashchange', show);
    show();
  }
  /* <a data-next></a> at the end of an article points to the next thing on its shelf */
  function next() {
    document.querySelectorAll('[data-next]').forEach(function (a) {
      var e = entry(), mates = FTA_CATALOG.filter(function (x) { return e && x.shelf === e.shelf; });
      var n = mates[(mates.indexOf(e) + 1) % mates.length];
      if (!n) { a.remove(); return; }
      a.className = 'next'; a.href = n.href;
      a.innerHTML = '<small>Next</small><b>' + esc(n.title) + '</b>';
    });
  }
  /* <figure data-diagram="rank1"> imports diagrams/rank1.js when it nears the screen; each module draws into its figure */
  function diagrams() {
    var figs = document.querySelectorAll('[data-diagram]');
    function start(fig) {
      import(base + 'diagrams/' + fig.getAttribute('data-diagram') + '.js').then(function (m) { m.default(fig); }).catch(function (err) {
        console.error(err);
        fig.setAttribute('data-failed', '');
      });
    }
    if (!('IntersectionObserver' in window)) { figs.forEach(start); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (x) { if (x.isIntersecting) { io.unobserve(x.target); start(x.target); } });
    }, { rootMargin: '1200px' });
    figs.forEach(function (f) { io.observe(f); });
  }

  function init() {
    if (guest) { load('catalog.js').then(guestBar, guestBar); return; }
    frame();
    Promise.all([load('catalog.js'), load('thumbs.js')]).then(function () {
      var cur = document.querySelector('.tabs [aria-current]');
      if (!cur) {
        var s = shelfOf(), a = TABS.findIndex(function (t) { return t.shelf === s; });
        if (a >= 0) document.querySelectorAll('.tabs a')[a].setAttribute('aria-current', 'page');
      }
      chips(); shelves(); next();
    });
    diagrams();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
