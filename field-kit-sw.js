/* Paradox field kit: the service worker. First built 2026-11-25 by tools/paradox/build_paradox.mjs; edited by hand
 * 2026-11-28 (the generator is not in this repo).
 *
 * The page works with no signal because this worker answers from the cache. Two rules decide how:
 *
 * - The kit's own code and small data (the page, its scripts, the manifest, the storm's JSON) go to the network
 *   first and fall back to the cache. The first version answered them from the cache first, so anyone who had
 *   opened the kit once kept the old page forever and never saw the storm layer.
 * - The ground (the tiles under pdx/) stays cache first: it never changes for a given path, and it is what makes
 *   the kit work on a trailhead.
 *
 * The cache keeps its name, so the ground already saved on a phone survives this update.
 *
 * The worker sits at the site root, so its scope is the whole site: it leaves every request that is not the
 * kit's to the browser (the rest of fluidta.com, the mailbox) and it leaves video alone (range requests). */
const CACHE = 'pdx-v1';
const SHELL = ['field-kit.html', 'field-kit-storm.js', 'pdx/manifest.json', 'pdx/lensdem.json', 'pdx/lensdem.png', 'pdx/overview.json', 'pdx/overview.jpg'];

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

/* the kit's own files; everything else on the site is not this worker's business */
const KIT = /\/(field-kit[\w-]*\.(html|js)|pdx\/.*)$/;
/* code and small data that can change between releases: network first */
const FRESH = /\/(field-kit[\w-]*\.(html|js)|pdx\/manifest\.json|pdx\/storm\/[^/]+\.(json|txt))$/;
const WAIT = 4000;                                     /* ms to wait on a slow network before the saved copy */

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);
  const sameOrigin = url.origin === location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (sameOrigin && (!KIT.test(url.pathname) || /\.mp4$/.test(url.pathname) || r.headers.has('range'))) return;
  if (!sameOrigin && !isFont) return;                 /* nothing else is ours to answer */

  if (sameOrigin && (r.mode === 'navigate' || FRESH.test(url.pathname))) { e.respondWith(fresh(r, url)); return; }

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

/* network first, saved copy on failure or after WAIT ms; a good answer refreshes the saved copy */
async function fresh(r, url) {
  const c = await caches.open(CACHE);
  const key = url.pathname.endsWith('/field-kit.html') ? 'field-kit.html' : r;
  /* a navigate Request cannot be re-sent with options, so fetch by URL */
  const net = fetch(url.pathname + url.search, { cache: 'no-cache' }).then(async res => {
    if (res && res.ok) { try { await c.put(key, res.clone()); } catch (err) { } }
    return res;
  });
  const saved = () => c.match(key, { ignoreSearch: true });
  try {
    const res = await Promise.race([net, new Promise((_, no) => setTimeout(() => no(new Error('slow')), WAIT))]);
    if (res.ok) return res;
    return (await saved()) || res;
  } catch (err) {
    const hit = await saved();
    if (hit) return hit;
    try { return await net; } catch (e2) { return new Response('This part of the page was not saved for offline use.', { status: 504, headers: { 'Content-Type': 'text/plain' } }); }
  }
}
