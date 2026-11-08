/* Sound It Out — a phonics game built from pre-recorded ElevenLabs clips.
   Tap a letter; only letters that can continue a real word appear next; each tap plays that letter's
   sound. Finish a word and it is sounded out and then blended, from the clips stitched in the browser.
   The clips and the word list come from /audio/phonics/ (made by scripts/gen_phonics.py). */

const BASE = '/audio/phonics/';
const soundUrl = l => BASE + 'sounds/' + l + '.mp3';
const wordUrl = w => BASE + 'words/' + w + '.mp3';
const phraseUrl = n => BASE + 'words/_' + n + '.mp3';

/* a tiny Web Audio engine: decode once, then schedule buffers back to back so a sound-out blends */
function makeAudio() {
  let ctx = null; const cache = new Map();
  const ensure = () => { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; } } if (ctx && ctx.state === 'suspended') ctx.resume(); return ctx; };
  async function buf(url) {
    if (cache.has(url)) return cache.get(url);
    const p = fetch(url).then(r => r.arrayBuffer()).then(a => new Promise((ok, no) => ensure().decodeAudioData(a, ok, no))).catch(() => null);
    cache.set(url, p); return p;
  }
  return {
    ensure, buf,
    preload(urls) { urls.forEach(buf); },
    /* play a list of urls in order, each after the last, with a gap (seconds); resolves when done */
    async play(urls, gap) {
      const c = ensure(); if (!c) return;
      const bufs = await Promise.all(urls.map(buf)); let t = c.currentTime + 0.05;
      bufs.forEach(b => { if (!b) return; const s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(t); t += b.duration + (gap || 0); });
      return new Promise(r => setTimeout(r, Math.max(0, (t - c.currentTime)) * 1000));
    }
  };
}

export default function (fig) {
  const audio = makeAudio();
  const wrap = document.createElement('div'); wrap.className = 'ph';
  fig.insertBefore(wrap, fig.querySelector('figcaption'));
  wrap.innerHTML = '<div class="ph-word" id="phWord" aria-live="polite"></div>' +
    '<div class="ph-say"><button type="button" class="ph-btn" id="phSay" hidden>▶ Say it</button>' +
    '<button type="button" class="ph-btn ghost" id="phBack" hidden>⌫ Back</button>' +
    '<button type="button" class="ph-btn ghost" id="phClear" hidden>✕ Start over</button></div>' +
    '<div class="ph-pick" id="phPick" role="group" aria-label="Choose the next letter"></div>' +
    '<p class="ph-hint" id="phHint">Loading the sounds…</p>';
  const wordEl = wrap.querySelector('#phWord'), pickEl = wrap.querySelector('#phPick'), hintEl = wrap.querySelector('#phHint');
  const sayBtn = wrap.querySelector('#phSay'), backBtn = wrap.querySelector('#phBack'), clearBtn = wrap.querySelector('#phClear');

  let WORDS = [], trie = null, path = '';

  fetch(BASE + 'manifest.json').then(r => r.json()).then(m => {
    WORDS = m.words; trie = buildTrie(WORDS);
    audio.preload(m.letters.map(soundUrl));   // the sounds are tiny; have them ready
    render();
  }).catch(() => { hintEl.textContent = 'The sounds could not load. Check your connection and reload.'; });

  function buildTrie(words) {
    const root = { next: {}, end: false };
    words.forEach(w => { let n = root; for (const ch of w) { n = n.next[ch] || (n.next[ch] = { next: {}, end: false }); } n.end = true; });
    return root;
  }
  function nodeAt(p) { let n = trie; for (const ch of p) { n = n.next[ch]; if (!n) return null; } return n; }

  function render() {
    const n = nodeAt(path) || trie;
    wordEl.innerHTML = '';
    [...path].forEach((ch, i) => { const s = document.createElement('span'); s.className = 'ph-let'; s.textContent = ch; s.style.animationDelay = (i * 40) + 'ms'; wordEl.appendChild(s); });
    if (!path) { const g = document.createElement('span'); g.className = 'ph-ghost'; g.textContent = 'tap a letter'; wordEl.appendChild(g); }

    const nexts = Object.keys(n.next).sort();
    pickEl.innerHTML = '';
    nexts.forEach(ch => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'ph-tile'; b.textContent = ch;
      b.setAttribute('aria-label', 'Add ' + ch + ', the ' + ch + ' sound');
      b.addEventListener('click', () => pick(ch)); pickEl.appendChild(b);
    });
    const complete = n.end;
    sayBtn.hidden = !complete; backBtn.hidden = !path; clearBtn.hidden = !path;
    sayBtn.classList.toggle('ready', complete);
    hintEl.textContent = !path ? 'Tap a letter to start a word.'
      : complete && !nexts.length ? 'You made “' + path + '”. Press Say it!'
      : complete ? '“' + path + '” is a word — press Say it, or keep going.'
      : 'Keep going — tap the next letter.';
  }

  function pick(ch) {
    path += ch; audio.play([soundUrl(ch)], 0);   // hear the letter's sound as you add it
    const n = nodeAt(path);
    render();
    if (n && n.end) { audio.preload([wordUrl(path)]); if (!Object.keys(n.next).length) setTimeout(say, 350); }   // a dead-end word: celebrate on its own
  }

  async function say() {
    if (!nodeAt(path) || !nodeAt(path).end) return;
    const word = path; sayBtn.disabled = true; wordEl.classList.add('sounding');
    await audio.play([...word].map(soundUrl), 0.12);        // c … a … t
    await new Promise(r => setTimeout(r, 160));
    await audio.play([wordUrl(word)], 0);                   // cat!
    wordEl.classList.remove('sounding'); wordEl.classList.add('pop');
    burst();
    await audio.play([phraseUrl('win')], 0);
    sayBtn.disabled = false;
    setTimeout(() => { wordEl.classList.remove('pop'); }, 700);
  }

  function burst() {
    const n = 14; for (let i = 0; i < n; i++) { const d = document.createElement('i'); d.className = 'ph-star';
      const a = (i / n) * Math.PI * 2, r = 60 + Math.random() * 40;
      d.style.setProperty('--dx', Math.cos(a) * r + 'px'); d.style.setProperty('--dy', (Math.sin(a) * r - 10) + 'px');
      d.style.background = ['#FFC21A', '#1F6FEB', '#1E9E5A', '#D4640A', '#7C3AED'][i % 5];
      wordEl.appendChild(d); setTimeout(() => d.remove(), 900); }
  }

  sayBtn.addEventListener('click', say);
  backBtn.addEventListener('click', () => { if (path) { path = path.slice(0, -1); render(); } });
  clearBtn.addEventListener('click', () => { path = ''; render(); });
}
