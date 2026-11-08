/* A dichotomous key to the site, like a field guide's key to wildflowers: each couplet offers two statements, a and b;
   pick the one that fits and follow it, until a single page is left. The key is a binary tree:
   a couplet is [statement a, next a, statement b, next b], where next is another couplet or a page's href.
   Every page in catalog.js keys out exactly once; missing() reports any that the key doesn't reach. */

const C = (a, na, b, nb) => ({ a, na, b, nb });

export const KEY = C(
  'You want to play: there is a goal, a score or a win.',
  C('It is for a kid, or the kid in you: fly a rain cloud, roll marbles, launch things.', '/kiddos-cloud.html',
    'It is a puzzle for a grown-up brain.',
    C('Chess queens are involved.',
      C('The classic: eight queens, and no two may attack.', '/eight-queens.html',
        'An olympiad tiling problem with one extra rule and a high score to beat.', '/queens-tiling.html'),
      'No queens.',
      C('Numbers and equations are the pieces.',
        C('Find four numbers that share a secret property.', '/connections.html',
          'Build crossing equations from a pile of tiles.',
          C('On a flat board.', '/math-scramble.html', 'In three dimensions.', '/math-scramble-3d.html')),
        'There is a story: a map to walk, a warden to outwit, or a broken copy to mend.',
        C('You walk across a city of bridges.', '/konigsberg.html',
          'You have to beat a warden or the odds.',
          C('One coin flip has to carry a message.', '/impossible-escape.html',
            'Two damaged copies and one costly repair.', '/two-halves.html'))))),
  'You want to look, read or poke at an idea.',
  C('You want something useful today: weather, water, mountains, plans.',
    C('It is about what is outside right now.',
      C('Point your phone at the mountains.', '/peak-finder-v3.html',
        'You want a map or a classroom.',
        C('A map.',
          C('The forecast and radar where you are.', '/weather-map.html',
            "Colorado's snow, drought, rivers and reservoirs.", '/water-resources-dashboard.html'),
          'You teach, and want these pages in your course.', '/lti.html')),
      'It is about planning a reservoir.',
      C('Four optimizers and one tradeoff curve.', '/reservoir-optimization-complete.html',
        'Four goals at once, on parallel coordinates.', '/reservoir-optimization-moo.html')),
    'You want to understand something.',
    C('You want a long read: a short book, in chapters.',
      C('About water and how stirring mixes it.', '/way-of-water.html',
        'About math, minds or the universe.',
        C('Mathematics and logic.',
          C('Gödel, and what can never be proved.', '/way-of-incompleteness.html',
            'One line of mathematics, a symbol at a time.', '/way-of-seven-symbols.html'),
          'Physics or machines.',
          C('Black holes, and whether they destroy information.', '/way-of-the-unlost.html',
            'How a language model works, written by one.', '/way-of-claude.html'))),
      'You want one page with things to drag, press and watch.',
      C('Water, air or some other fluid is moving.',
        C('Rivers, rain and weather.',
          C('Rivers and floods.',
            C('Rain becoming a flood curve, which you can hear.', '/hydrograph-synth.html',
              'Why river networks branch the way they do.', '/optimal-channel-networks.html'),
            'Weather and climate data.',
            C('One forecast run a hundred times.', '/ensemble-methods.html',
              'Climate data as a cube of numbers.', '/climate-tensor-ops.html')),
          'The fluid itself: stirring, swirling, mixing.',
          C('You stir it or pull it yourself.',
            C('Drag through a flat fluid.', '/navier-stokes-demo.html',
              'Pull out the wall between two fluids, in 3D.', '/navier-stokes-3d-demo.html'),
            'You watch, measure or wonder.',
            C('Birds and posts shedding swirls.', '/vortex-shedding.html',
              'Something stranger.',
              C('The numbers that matter, and why they have no units.', '/dimensionless.html',
                'Something stranger still.',
                C('An unsolved question: can a smooth flow reach infinite speed?', '/blowup.html',
                  'Election votes falling like rain and mixing.', '/votes-as-rain.html'))))),
        'No fluid needed.',
        C('Chance and randomness.',
          C('Dice that beat each other in a circle.', '/intransitive-dice.html',
            'Picking a random point inside a ball.', '/remix-sphere.html'),
          'Things that happen for certain.',
          C('Out in the world: the sky, sound, plants, animals.',
            C('Way up: how far away the stars are.', '/cosmic-ladder.html',
              'Down here.',
              C('Living things.',
                C('Plants catching light, quantum style.', '/photosynthesis-quantum.html',
                  'Dragonflies sneaking up on their prey.', '/remix-camouflage.html'),
                'A ringing metal plate and dancing sand.', '/chladni.html')),
            'Inside mathematics.',
            C('What a tensor really is.', '/tensor-analysis.html',
              'The logarithm of a picture.', '/image-log.html')))))));

/* number the couplets the way a printed key does: depth first, a's branch before b's */
export function number(root) {
  const list = []; (function walk(n) { if (typeof n === 'string') return; n.id = list.length + 1; list.push(n); walk(n.na); walk(n.nb); })(root);
  return list;
}
export function leaves(n, out = []) { if (typeof n === 'string') out.push(n); else { leaves(n.na, out); leaves(n.nb, out); } return out; }
export function missing(catalog, root = KEY) {
  const got = leaves(root), have = new Set(got);
  return { notInKey: catalog.map(e => e.href).filter(h => !have.has(h)), notInCatalog: got.filter(h => !catalog.some(e => e.href === h)),
    twice: got.filter((h, i) => got.indexOf(h) !== i) };
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
function whenCatalog() { return new Promise(ok => { (function t() { if (window.FTA_CATALOG && window.FTA_THUMBS) ok(); else setTimeout(t, 40); })(); }); }

export default async function (fig) {
  const list = number(KEY);
  await whenCatalog();
  const cat = window.FTA_CATALOG, find = h => cat.find(e => e.href === h);
  const gap = missing(cat);
  if (gap.notInKey.length || gap.notInCatalog.length || gap.twice.length) console.error('Dichotomous key and catalog disagree', gap);

  const box = document.createElement('div'); box.className = 'dkey';
  fig.insertBefore(box, fig.querySelector('figcaption'));
  const full = document.createElement('details'); full.className = 'dkey-full';
  full.innerHTML = '<summary>See the whole key, the way a field guide prints it</summary>' + printed();
  fig.parentNode.insertBefore(full, fig.nextSibling);

  /* the path is a string of a's and b's, kept in the address, so Back works and a result can be shared */
  const read = () => (location.hash.match(/^#key=([ab]*)$/) || [, ''])[1];
  function walk(path) { let n = KEY; const steps = []; for (const c of path) { if (typeof n === 'string') break; steps.push([n, c]); n = c === 'a' ? n.na : n.nb; } return { n, steps }; }
  function go(path) { history.pushState(null, '', path ? '#key=' + path : location.pathname); draw(path); }
  function draw(path) {
    const { n, steps } = walk(path);
    const trail = steps.map(([c, s], i) => `<li><button type="button" class="dkey-crumb" data-p="${path.slice(0, i)}"><b>${c.id}${s}</b> ${esc(s === 'a' ? c.a : c.b)}</button></li>`).join('');
    let body;
    if (typeof n === 'string') {
      const e = find(n);
      body = `<p class="dkey-done">Keyed out in ${steps.length} ${steps.length === 1 ? 'step' : 'steps'}.</p>` + (e ? `<ul class="cards"><li><a class="card${e.kids ? ' kids' : ''}" href="${e.href}"><svg class="thumb" viewBox="0 0 320 180" aria-hidden="true">${window.FTA_THUMBS[e.thumb] ? window.FTA_THUMBS[e.thumb]() : ''}</svg><div class="txt"><b>${esc(e.title)}</b><span>${esc(e.blurb)}</span></div></a></li></ul>` : `<p><a href="${n}">${n}</a></p>`);
    } else {
      body = `<p class="dkey-n" id="dkey-q">Couplet ${n.id}</p><div class="dkey-ab" role="group" aria-labelledby="dkey-q">` +
        ['a', 'b'].map(s => `<button type="button" class="dkey-opt" data-p="${path + s}"><b>${n.id}${s}</b><span>${esc(n[s])}</span></button>`).join('') + '</div>';
    }
    box.innerHTML = (steps.length ? `<ol class="dkey-trail" aria-label="Your answers so far">${trail}</ol>` : '') + body +
      (path ? '<p class="dkey-tools"><button type="button" class="btn" data-p="' + path.slice(0, -1) + '">Back one</button> <button type="button" class="btn" data-p="">Start over</button></p>' : '');
    box.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => { go(b.getAttribute('data-p')); box.querySelector('.dkey-opt, .card')?.focus({ preventScroll: true }); }));
  }
  function printed() {
    const line = (n, s) => { const nx = s === 'a' ? n.na : n.nb, e = typeof nx === 'string' ? find(nx) : null;
      return `<li><b>${n.id}${s}.</b> ${esc(n[s])} <span class="dkey-to">${typeof nx === 'string' ? `<a href="${nx}">${esc(e ? e.title : nx)}</a>` : 'go to ' + nx.id}</span></li>`; };
    return '<ol class="dkey-print">' + list.map(n => line(n, 'a') + line(n, 'b')).join('') + '</ol>';
  }
  addEventListener('popstate', () => draw(read()));
  draw(read());
}
