/* Kiddo's Monster Rally: the teaching engine. Direct instruction, in the tradition of Engelmann's DISTAR:
   - Model, then test: a new skill is introduced with "My turn" (the answer, said and shown), then "Your turn".
   - Correct every error at once: model the answer, then ask the same item again straight away (retest),
     and again a few items later (delayed test).
   - Mastery before moving on: five first-try answers in a row move a ladder up one level.
   - Cumulative review: about one item in four comes from a level already mastered.
   Everything here is plain data and functions, so it can be tested without the game. */

const AUD = 'audio/phonics/';
export const clip = name => ({ clip: '/' + AUD + name + '.mp3' });
const say = text => ({ text });

// pictures for the short-a words that have recorded clips
export const PICS = { cat: '🐱', hat: '🎩', bat: '🦇', map: '🗺️', van: '🚐', pan: '🍳', rat: '🐀', man: '👨', cap: '🧢', bag: '👜',
  can: '🥫', ham: '🍖', yam: '🍠', gas: '⛽', tag: '🏷️', nap: '😴', ram: '🐏', sad: '😢', mad: '😠' };
export const WORDS = ['bad','bag','ban','bat','cab','cam','can','cap','cat','dab','dad','dam','fad','fan','fat','gag','gap','gas','had','ham','has','hat','jab','jag','jam','lab','lad','lag','lap','mad','man','map','mat','nab','nag','nap','pad','pal','pan','pat','rag','ram','ran','rap','rat','sad','sag','sap','sat','tab','tad','tag','tan','tap','van','vat','wag','yam','yap','zag','zap'];
export const LETTERS = ['a','b','c','d','f','g','h','j','l','m','n','p','r','s','t','v','w','y','z'];
export const SIGHT = ['the','and','a','is','to','in','it','you','was','said','he','she','we','my','go','look','come','here','see','for'];
const NUM = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty'];
const n2w = n => n <= 20 ? NUM[n] : String(n);

const pick = (R, a) => a[Math.floor(R() * a.length)];
function shuffle(R, a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function numChoices(R, ans, lo, hi) {    // the answer and two near misses, all in range
  const s = new Set([ans]); let tries = 0;
  while (s.size < 3 && tries++ < 50) { const d = pick(R, [-2, -1, 1, 2, 3]), v = ans + d; if (v >= lo && v <= hi) s.add(v); }
  for (let v = lo; s.size < 3; v++) s.add(v);
  return shuffle(R, [...s]).map(v => ({ id: String(v), label: String(v) }));
}
function wordChoices(R, ans, pool, n = 3) {
  const s = new Set([ans]); while (s.size < n) s.add(pick(R, pool));
  return shuffle(R, [...s]);
}

/* Each level makes items. An item: key (for review), show (what is drawn), ask and model (what is said),
   choices [{id, label, pic?}], answer (a choice id). */
export const LADDERS = {
  math: [
    { name: 'Count to 5', make(R) { const n = 1 + Math.floor(R() * 5); return { key: 'c5:' + n, show: { type: 'dots', n }, ask: [say('How many?')], model: [say('My turn. ' + countAloud(n) + '. ' + cap(n2w(n)) + '.')], choices: numChoices(R, n, 1, 6), answer: String(n), sayAnswer: n2w(n) }; } },
    { name: 'Count to 10', make(R) { const n = 4 + Math.floor(R() * 7); return { key: 'c10:' + n, show: { type: 'dots', n }, ask: [say('How many?')], model: [say('My turn. ' + countAloud(n) + '. ' + cap(n2w(n)) + '.')], choices: numChoices(R, n, 1, 12), answer: String(n), sayAnswer: n2w(n) }; } },
    { name: 'Add to 5', make(R) { const a = 1 + Math.floor(R() * 3), b = 1 + Math.floor(R() * (5 - a)); return addItem(R, a, b, true); } },
    { name: 'Add to 10', make(R) { const a = 1 + Math.floor(R() * 8), b = 1 + Math.floor(R() * (10 - a)); return addItem(R, a, b, a + b <= 10); } },
    { name: 'Take away to 10', make(R) { const a = 3 + Math.floor(R() * 8), b = 1 + Math.floor(R() * (a - 1)); return { key: 's:' + a + '-' + b, show: { type: 'eq', text: a + ' − ' + b + ' = ?', dots: [a, -b] }, ask: [say(n2w(a) + ' take away ' + n2w(b) + ' is?')], model: [say('My turn. ' + n2w(a) + ' take away ' + n2w(b) + ' is ' + n2w(a - b) + '.')], choices: numChoices(R, a - b, 0, 10), answer: String(a - b), sayAnswer: n2w(a - b) }; } },
    { name: 'Add to 20', make(R) { const a = 6 + Math.floor(R() * 9), b = 2 + Math.floor(R() * Math.min(9, 20 - a - 1)); return addItem(R, a, b, false); } },
    { name: 'Times 2, 5 and 10', make(R) { const a = pick(R, [2, 5, 10]), b = 1 + Math.floor(R() * 10); return timesItem(R, a, b); } },
    { name: 'Times tables', make(R) { const a = 2 + Math.floor(R() * 9), b = 2 + Math.floor(R() * 9); return timesItem(R, a, b); } },
  ],
  reading: [
    { name: 'Letter sounds', make(R) { const l = pick(R, LETTERS); return { key: 'ls:' + l, show: { type: 'listen' }, ask: [say('Which letter says'), clip('sounds/' + l)], model: [say('My turn. This letter'), clip('sounds/' + l), say('is ' + l + '.')], choices: wordChoices(R, l, LETTERS).map(x => ({ id: x, label: x })), answer: l, sayAnswer: null, answerClip: clip('sounds/' + l) }; } },
    { name: 'First sounds', make(R) { const w = pick(R, Object.keys(PICS)), l = w[0]; return { key: 'fs:' + w, show: { type: 'pic', pic: PICS[w] }, ask: [clip('words/' + w), say('What sound does it start with?')], model: [say('My turn.'), clip('words/' + w), say('starts with'), clip('sounds/' + l)], choices: wordChoices(R, l, LETTERS.filter(x => x !== 'a')).map(x => ({ id: x, label: x })), answer: l, answerClip: clip('sounds/' + l) }; } },
    { name: 'Read a word', make(R) { const w = pick(R, Object.keys(PICS)), opts = wordChoices(R, w, Object.keys(PICS)); return { key: 'rw:' + w, show: { type: 'word', text: w }, ask: [say('Read it. Which picture?')], model: [say('My turn.'), clip('sounds/' + w[0]), clip('sounds/a'), clip('sounds/' + w[2]), clip('words/' + w)], choices: opts.map(x => ({ id: x, label: PICS[x], pic: true })), answer: w, answerClip: clip('words/' + w) }; } },
    { name: 'Hear and find', make(R) { const w = pick(R, WORDS), near = WORDS.filter(x => x !== w && (x[0] === w[0] || x[2] === w[2])); const opts = wordChoices(R, w, near.length >= 2 ? near : WORDS); return { key: 'hf:' + w, show: { type: 'listen' }, ask: [say('Find'), clip('words/' + w)], model: [say('My turn.'), clip('words/' + w), say('is spelled ' + w.split('').join(', ') + '.')], choices: opts.map(x => ({ id: x, label: x })), answer: w, answerClip: clip('words/' + w) }; } },
    { name: 'Sight words', make(R) { const w = pick(R, SIGHT), opts = wordChoices(R, w, SIGHT); return { key: 'sw:' + w, show: { type: 'listen' }, ask: [say('Find the word: ' + w + '.')], model: [say('My turn. This word is ' + w + '.')], choices: opts.map(x => ({ id: x, label: x })), answer: w, sayAnswer: w }; } },
  ],
};
function cap(s) { return s[0].toUpperCase() + s.slice(1); }
function countAloud(n) { return Array.from({ length: n }, (_, i) => n2w(i + 1)).join(', '); }
function addItem(R, a, b, withDots) {
  return { key: 'a:' + a + '+' + b, show: { type: 'eq', text: a + ' + ' + b + ' = ?', dots: withDots ? [a, b] : null }, ask: [say(n2w(a) + ' plus ' + n2w(b) + ' is?')], model: [say('My turn. ' + n2w(a) + ' plus ' + n2w(b) + ' is ' + n2w(a + b) + '.')], choices: numChoices(R, a + b, 0, 20), answer: String(a + b), sayAnswer: n2w(a + b) };
}
function timesItem(R, a, b) {
  return { key: 'm:' + a + 'x' + b, show: { type: 'eq', text: a + ' × ' + b + ' = ?' }, ask: [say(n2w(a) + ' times ' + n2w(b) + ' is?')], model: [say('My turn. ' + n2w(a) + ' times ' + n2w(b) + ' is ' + (a * b) + '.')], choices: numChoices(R, a * b, 0, 100), answer: String(a * b), sayAnswer: String(a * b) };
}

/* The tutor keeps one learner's place on a ladder, and the queue of items to come back to. Its state is saved. */
export function newState() { return { math: { level: 0, streak: 0, seen: 0, right: 0, recent: [] }, reading: { level: 0, streak: 0, seen: 0, right: 0, recent: [] }, review: [], modeled: {} }; }

export class Tutor {
  constructor(state, subject, R) { this.s = state; this.subject = subject; this.R = R; this.sinceReview = 0; }
  get lad() { return LADDERS[this.subject]; }
  get rec() { return this.s[this.subject]; }
  /* next item: a due delayed test first, then sometimes a review item from a mastered level, else the current level */
  next() {
    const due = this.s.review.find(r => r.subject === this.subject && r.wait <= 0);
    if (due) { this.s.review.splice(this.s.review.indexOf(due), 1); return this.decorate(due.item, 'retest'); }
    this.s.review.forEach(r => { if (r.subject === this.subject) r.wait--; });
    const L = this.rec.level;
    if (L > 0 && this.R() < .25) return this.decorate(this.lad[Math.floor(this.R() * L)].make(this.R), 'review', Math.floor(this.R() * L));
    const item = this.lad[L].make(this.R), first = !this.s.modeled[this.subject + L];
    if (first) this.s.modeled[this.subject + L] = true;
    return this.decorate(item, first ? 'new' : 'practice', L);
  }
  decorate(item, why, level) { return Object.assign({}, item, { why, level: level ?? this.rec.level, modelFirst: why === 'new' }); }
  /* record an answer. Returns what the game should do next. */
  answer(item, choiceId, firstTry) {
    const ok = choiceId === item.answer, r = this.rec;
    if (!ok) {   // correction: model it, ask again now, and schedule a delayed test
      if (firstTry) { r.seen++; r.streak = 0; r.recent.push(0); trim(r.recent); this.s.review.push({ subject: this.subject, item: stripMeta(item), wait: 2 }); }
      return { ok: false, action: 'model-and-retest' };
    }
    let levelUp = false, levelDown = false;
    if (firstTry) {
      r.seen++; r.right++; r.recent.push(1); trim(r.recent);
      if (item.why !== 'review' && item.level === r.level) {
        r.streak++;
        if (r.streak >= 5 && r.level < this.lad.length - 1) { r.level++; r.streak = 0; r.recent = []; levelUp = true; }
      }
    }
    if (r.recent.length >= 8 && r.recent.reduce((a, b) => a + b, 0) / r.recent.length < .5 && r.level > 0) { r.level--; r.streak = 0; r.recent = []; levelDown = true; }
    return { ok: true, firstTry, levelUp, levelDown, levelName: this.lad[r.level].name };
  }
  setLevel(L) { this.rec.level = Math.max(0, Math.min(this.lad.length - 1, L)); this.rec.streak = 0; this.rec.recent = []; }
}
function trim(a) { while (a.length > 10) a.shift(); }
function stripMeta(item) { const { why, level, modelFirst, ...rest } = item; return Object.assign(rest, { level }); }
