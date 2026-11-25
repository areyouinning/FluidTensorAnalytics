/* Paradox field kit: the service worker. Built 2026-11-25 08:35 by tools/paradox/build_paradox.mjs.
 *
 * Its only job is to answer from the cache first, so the page works with no signal. The page itself fills
 * the cache (and shows the progress), because a worker filling 5,000 files silently gives the person on a
 * trailhead no way to tell whether it finished.
 *
 * The shell -- the page, this worker, the DEM, the overview, the manifest -- is precached on install, so a
 * reload offline always gets a working page even if the ground is only partly saved. */
const CACHE = 'pdx-v1';
const SHELL = ['field-kit.html', 'pdx/manifest.json', 'pdx/lensdem.json', 'pdx/lensdem.png', 'pdx/overview.json', 'pdx/overview.jpg'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    /* one at a time and forgiving: a missing overview must not stop the page itself being saved */
    for (const u of SHELL) { try { await c.add(new Request(u, { cache: 'reload' })); } catch (err) { } }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);
  const sameOrigin = url.origin === location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;                 /* nothing else is ours to answer */

  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(r, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(r);
      /* keep what we are allowed to keep: our own files, and the font files, which are opaque but cacheable */
      if (res && (res.ok || res.type === 'opaque')) { try { await c.put(r, res.clone()); } catch (err) { } }
      return res;
    } catch (err) {
      /* offline and not saved. A tile that is missing should fail quietly: aerostat falls back to a coarser
         ancestor tile, so a 504 here is a hole in the ground, not a broken page. */
      if (/\/pdx\/(t|i)\//.test(url.pathname)) return new Response('', { status: 504, statusText: 'tile not saved' });
      const page = await c.match('field-kit.html');
      if (page && r.mode === 'navigate') return page;
      return new Response('This part of the page was not saved for offline use.', { status: 504, headers: { 'Content-Type': 'text/plain' } });
    }
  })());
});
