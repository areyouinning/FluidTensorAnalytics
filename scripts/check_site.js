#!/usr/bin/env node
/* Site check. Loads every page in catalog.js (plus the section pages) in a headless browser and fails if:
     - a page throws an uncaught error or logs a console error (network failures are ignored: the check runs offline);
     - a native page scrolls sideways at phone width;
     - the Start Here key and the catalog disagree.
   Pages that bring their own look (the fta.js "data-guest" tools and games) are loaded and reported, but only
   uncaught errors on first load count against them.

     node scripts/check_site.js            # everything
     node scripts/check_site.js /nim.html  # just these pages
   Needs Playwright with Chromium (npm i playwright && npx playwright install chromium). */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.css': 'text/css', '.js': 'application/javascript', '.mjs': 'application/javascript', '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.wasm': 'application/wasm' };
const NETWORK = /Failed to load resource|net::|ERR_|NetworkError|Failed to fetch|Load failed|blocked by|CORS|fonts\.g/i;

(async () => {
  const win = {}; new Function('window', fs.readFileSync(path.join(ROOT, 'catalog.js'), 'utf8'))(win);
  const sections = ['/', '/explore.html', '/paradox.html', '/riddles.html', '/play.html', '/way-of.html', '/tools.html', '/key.html', '/obovoid.html'];
  const only = process.argv.slice(2);
  const pages = only.length ? only : sections.concat(win.FTA_CATALOG.map(e => e.href));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, reducedMotion: 'reduce' });
  await ctx.route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.hostname !== 'site.test') return route.abort();
    const f = path.join(ROOT, decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return route.fulfill({ status: 404, body: '' });
    route.fulfill({ body: fs.readFileSync(f), contentType: TYPES[path.extname(f)] || 'application/octet-stream' });
  });
  let failed = 0; const notes = [];
  for (const href of pages) {
    const file = path.join(ROOT, href === '/' ? 'index.html' : href);
    if (!fs.existsSync(file)) { console.log('FAIL', href, '— in the catalog but the file is missing'); failed++; continue; }
    const guest = /fta\.js"[^>]*data-guest|data-guest[^>]*fta\.js/.test(fs.readFileSync(file, 'utf8'));
    const page = await ctx.newPage(), errs = [];
    page.on('pageerror', e => errs.push('uncaught: ' + e.message.split('\n')[0]));
    page.on('console', m => { if (m.type() === 'error' && !NETWORK.test(m.text())) errs.push('console: ' + m.text().split('\n')[0].slice(0, 200)); });
    try {
      await page.goto('http://site.test' + href, { waitUntil: 'load', timeout: 20000 });
      await page.waitForTimeout(500);
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } });
      await page.waitForTimeout(500);
      if (!guest) {
        if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) errs.push('scrolls sideways at 360px');
        const unbuilt = await page.evaluate(() => [...document.querySelectorAll('[data-diagram]')].filter(f => f.hasAttribute('data-failed') || !f.querySelector('svg, canvas, .dkey')).map(f => f.getAttribute('data-diagram')));
        if (unbuilt.length) errs.push('diagram did not draw: ' + unbuilt.join(', '));
      }
      if (href === '/key.html') {
        const gap = await page.evaluate(async () => { const k = await import('/diagrams/key.js'); return k.missing(window.FTA_CATALOG); });
        if (gap.notInKey.length || gap.notInCatalog.length || gap.twice.length) errs.push('key and catalog disagree: ' + JSON.stringify(gap));
      }
    } catch (e) { errs.push('did not load: ' + e.message.split('\n')[0]); }
    await page.close();
    const counted = guest ? errs.filter(e => e.startsWith('uncaught') || e.startsWith('did not load')) : errs;
    if (counted.length) { failed++; console.log('FAIL', href); counted.forEach(e => console.log('     ', e)); }
    else console.log('ok  ', href + (guest ? '  (guest page)' : ''));
    if (guest && errs.length > counted.length) notes.push(href + ': ' + errs.filter(e => !counted.includes(e)).join('; '));
  }
  await browser.close();
  if (notes.length) { console.log('\nNotes on guest pages (not counted):'); notes.forEach(n => console.log('  ' + n)); }
  console.log('\n' + (pages.length - failed) + ' of ' + pages.length + ' pages passed.');
  process.exit(failed ? 1 : 0);
})();
