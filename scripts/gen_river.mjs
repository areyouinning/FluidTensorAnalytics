#!/usr/bin/env node
/* Record every line the kids' games say, in River (ElevenLabs), into audio/river/.
   The games play them through /fta-voice.js, which splits a line into sentences and looks each up in
   audio/river/index.json; a sentence with a number in it can be pieced together from its parts
   ("You got" · 12 · "gems, kiddo!"), so the numbers are recorded once each, not once per sentence.

   The lines are listed here, mirroring the games' own templates. Monster Rally's questions are
   enumerated by running its lesson generators. After recording, every listed line is checked to be
   playable from the bank.

   The ElevenLabs key is injected by the session proxy, so a placeholder is sent. ffmpeg is required.
     node scripts/gen_river.mjs            record what is missing
     node scripts/gen_river.mjs --dry      count, record nothing
     node scripts/gen_river.mjs --force    re-record everything                                    */
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const V = createRequire(import.meta.url)(path.join(ROOT, 'fta-voice.js'));
const { LADDERS } = await import(path.join(ROOT, 'rally/lessons.js'));
const OUT = path.join(ROOT, 'audio/river');
const VOICE = process.env.ELEVEN_VOICE || 'SAz9YHcvj6GT2YYXdXww';   // River
const MODEL = process.env.ELEVEN_MODEL || 'eleven_turbo_v2_5';
const argv = process.argv.slice(2), DRY = argv.includes('--dry'), FORCE = argv.includes('--force');

const whole = [];   // lines recorded sentence by sentence
const pieced = [];  // lines with numbers: sentences without digits are recorded whole, the rest from parts
const spoken = {};  // key -> what to send to the voice, where it differs from the line
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const ABC = 'abcdefghijklmnopqrstuvwxyz'.split('');

// ---------------- Kiddo's Cloud ----------------
whole.push(
  'Whoops! Back a little.', 'Oh no, a hole! Try again.', 'Uh oh! Back you go.',
  'You did it, kiddo!', 'Into the hole! Great rolling!', 'The marble made it home!', 'Yes, kiddo! Down the hole!',
  'Marble maze! Tip the phone. Roll it into the hole with the yellow flag. Watch!',
  'Marble maze! Touch where the marble should go. Roll it into the hole with the yellow flag. Watch!',
  'Your turn!',
  'The board is flat. The marble stays still.', 'Tip the board, and the marble rolls downhill.',
  'Big ball, little ball. Same time!', 'The same! Big or little, it does not matter.', 'Same ramps. A tie!', 'A tie! Both the same.',
  'The steep ramp wins!', 'Yes, kiddo! Steeper is faster!', 'Steep ramp, fast ball!',
  'Same steepness: a tie! Big ball or small ball? It does not matter!', 'The steeper ramp wins. Big ball or small ball? It does not matter!',
  'Ramp race! Drag a knob to make a ramp steep, then press the red button. Watch!',
  'Boing! Not that way!', 'Oops, blocked! Try another way.', 'Bonk! That way is closed.',
  'Steep snow! The marble goes fast.', 'A medium hill. Medium fast.', 'Almost flat here. The marble slows down.',
  'Marble hill! Press the red button, then tip the phone. Go for the most gems. Watch!',
  'Marble hill! Press the red button, then touch where the marble should go. Go for the most gems. Watch!',
  'All three buckets, kiddo! You did it!', 'Wow! All three! Super launching!',
  "The far bucket! That's the sweet spot!", 'In the bucket!', 'Bullseye!', 'Nice launch, kiddo!',
  'A little more to the left!', 'A little more to the right!',
  'A bit more!', 'Too short! Pull harder, or try a new angle.', 'Whoa, too far!', 'Over it! A little less.',
  'Low and fast: a flat throw.', 'High and floaty: a tall throw.', 'Close to 45°: that goes the farthest!',
  'Big launch! Pull the ball back and let go. Pull to the side to aim. The arrows change the angle. Land it in the buckets. Watch!',
  'Word hill! Roll through the letters to spell the sentence. Start with a big letter, add the spaces, and end with a period. Watch!',
  'Too many! Take some away.',
  'The cloud is empty! Fly to a game to get more rain.', "Snow! It's cold up high.",
  'Flood! Too much water! Clear Creek is over its banks in Golden!', 'The flood went down.', 'The water made it to the lake!',
  'Brrr! Snow all the way down.', 'Colder! More snow up high.', 'Warmer! The snow is melting.', 'Warmer!',
  'Too much water! The creek spills over its banks.', "It's cold everywhere. All the rain is snow.",
  "It's warm everywhere. No snow today.", 'Up high it is colder. Above the line, rain turns to snow.',
  'You are the rain cloud! Tap the map to fly. Hold the blue button to rain, and the water runs down the creeks to the lake. Tap a sign to play a game and fill your cloud with raindrops.',
  'You made it to the top! Six words!', 'To the top! Super spelling!',
  'The Argo gondola! Spell a word and it climbs. Spell six words to ride to the top. Watch!',
  'Marble maze!', 'Ramp race!', 'Marble hill!', 'Big launch!', 'Word hill!', 'Rain to the lake!', 'Tile time!', 'Word time!', 'Argo gondola!',
  'No misses!', '1 point.', 'Super bonus! A whole sentence, with a capital, spaces and a period!',
  "That's the fewest adds!", 'No adding at all!', 'With less adding:',
);
// Word hill: the sentence, each word, each letter as the marble rolls through it
const SENTS = ['I see a cat.', 'The dog can run.', 'I can hop.', 'The sun is hot.', 'A bug is red.', 'We go up.', 'A kid has a cap.', 'I see a big pig.', 'The cat sat.', 'My dog is fun.'];
SENTS.forEach(s => { whole.push(s.replace('.', '')); s.replace('.', '').split(' ').forEach(w => { const k = w.toLowerCase(); whole.push(k); if (k.length > 1) spoken[V.key(k)] = k[0].toUpperCase() + k.slice(1) + '!'; }); });
const sayCh = ch => ch === ' ' ? 'space' : ch === '.' ? 'period' : (ch === ch.toUpperCase() && ch !== ch.toLowerCase() ? 'big ' + ch : ch);
const CHARS = [...ABC, ...ABC.map(c => c.toUpperCase()), ' ', '.'];
CHARS.forEach(ch => { whole.push(sayCh(ch), "That's " + sayCh(ch) + '.'); });
ABC.forEach(c => { whole.push('Find ' + c + '.'); spoken[c] = c.toUpperCase() + '.'; spoken['big ' + c] = 'Big ' + c.toUpperCase() + '.'; });
// Word time
const WT = ['cat', 'dog', 'sun', 'bus', 'hat', 'pig', 'bed', 'fox', 'box', 'egg', 'car', 'bug', 'hen', 'cow', 'ant', 'owl', 'fish', 'frog', 'duck', 'cake', 'moon', 'star', 'tree', 'boat', 'bell', 'milk'];
WT.forEach(w => { whole.push(w + '!', 'Word time! Spell the picture. Tap the letters in order. ' + w + '!', 'Word time! Spell the picture. ' + w + '!'); spoken[V.key(w + '!')] = w[0].toUpperCase() + w.slice(1) + '!'; });
// lines with numbers
range(0, 30).forEach(n => pieced.push('Wow, kiddo! ' + n + ' gems! You picked the best way every time!', 'Super! ' + n + ' gems!', 'You got ' + n + ' gems, kiddo!', 'Into the basket! ' + n + ' gems!'));
range(0, 60).forEach(n => pieced.push(n + ' points!', 'Tile time! Make ' + n + '.', 'Tile time! Make ' + n + '. Times makes a block of tiles, and every tile is a point. Every plus takes a point away.'));
range(1, 10).forEach(r => range(1, 10).forEach(c => pieced.push(r + ' times ' + c + ' is ' + r * c)));
range(1, 3).forEach(n => pieced.push('You spelled ' + n + (n === 1 ? ' word' : ' words') + '! ' + 12 + ' points!'));
range(12, 30).forEach(n => pieced.push('The lake is full! ' + n + ' cups of water! Hooray!'));
pieced.push('You earned 25 raindrops! Fly over the mountains and hold the rain button.');
WT.forEach(w => pieced.push(w + '! No misses! ' + w.length + ' points!', w + '! 1 point.'));
// Tile Time's explanation, e.g. "14! 3 times 4 plus 2 ones makes 14. You got 9 points. With less adding: 2 times 7."
const sayEq = gs => { const p = []; let ones = 0; gs.forEach(g => { if (g.one) ones += g.c; else p.push(g.r + ' times ' + g.c); }); if (ones) p.push(ones === 1 ? '1' : ones + ' ones'); return p.join(' plus '); };
[[{ r: 3, c: 4 }, { one: true, c: 2 }], [{ r: 2, c: 5 }, { one: true, c: 1 }], [{ one: true, c: 5 }], [{ r: 3, c: 3 }, { r: 2, c: 2 }]].forEach(gs => {
  pieced.push('14! ' + sayEq(gs) + ' makes 14. You got 9 points. With less adding: ' + sayEq(gs) + '. No adding at all!', '14! ' + sayEq(gs) + " makes 14. You got 9 points. That's the fewest adds!");
});

// ---------------- Kiddo's Monster Rally ----------------
whole.push('Unlocked!', 'Your turn.', 'Yes!', 'Let’s try this one again.', 'Last lap!', 'Lap 1', 'Lap 2', 'Math or reading?',
  ...['Rocket', 'Mud Pup', 'Big Blue', 'Thunder', 'Pickle', 'Comet', 'Boulder Jr', 'Zippy'].map(n => n + '!'));
[4, 5, 6, 8, 10, 12, 14, 15].forEach(c => whole.push('You need ' + c + ' stars. Answer questions to earn stars!'));
let s = 1; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
for (const subj of Object.keys(LADDERS)) for (const lvl of LADDERS[subj]) for (let i = 0; i < 4000; i++) {
  const it = lvl.make(R);
  [...it.ask, ...it.model].forEach(g => { if (g.text) whole.push(g.text); });
  if (it.sayAnswer) whole.push(it.sayAnswer + '.');
}
range(0, 400).forEach(n => { spoken[String(n)] = String(n); });

// ---------------- what to record ----------------
const need = new Map();   // key -> text to say
const add = (k, t) => { if (!need.has(k)) need.set(k, spoken[k] || t); };
for (const line of whole) for (const st of V.sentences(line)) add(V.key(st), st);
for (const line of pieced) for (const st of V.sentences(line)) {
  if (!/\d/.test(st)) add(V.key(st), st); else V.parts(st).forEach(p => add(V.key(p), p));
}
range(0, 400).forEach(n => add(String(n), String(n)));

const file = k => createHash('sha1').update(k).digest('hex').slice(0, 12) + '.mp3';
let index = {}; try { index = JSON.parse(fs.readFileSync(path.join(OUT, 'index.json'), 'utf8')); } catch (e) {}
const todo = [...need].filter(([k]) => FORCE || !index[k] || !fs.existsSync(path.join(OUT, index[k])));
const chars = todo.reduce((a, [, t]) => a + t.length, 0);
console.log(`${need.size} clips in the bank, ${todo.length} to record (${chars} characters)`);
if (DRY) process.exit(0);
fs.mkdirSync(OUT, { recursive: true });

const run = (cmd, args) => new Promise((ok, no) => execFile(cmd, args, { maxBuffer: 1 << 20 }, (e, out) => e ? no(e) : ok(out)));
const TRIM = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse';
async function record(k, text) {
  const out = path.join(OUT, file(k)), raw = out + '.raw.mp3';
  const body = JSON.stringify({ text, model_id: MODEL, voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true } });
  for (let a = 0; a < 4; a++) {
    const code = (await run('curl', ['-sS', '-m', '90', '-X', 'POST', `https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`,
      '-H', 'xi-api-key: proxy-injected', '-H', 'content-type: application/json', '--data-binary', body, '-o', raw, '-w', '%{http_code}']).catch(() => '000')).trim();
    if (code === '200' && fs.existsSync(raw) && fs.statSync(raw).size > 400) {
      await run('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-af', TRIM, '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '64k', out]);
      fs.unlinkSync(raw); index[k] = file(k); return;
    }
    const head = fs.existsSync(raw) ? fs.readFileSync(raw, 'utf8').slice(0, 200) : '';
    if (/quota|credits/i.test(head)) throw new Error('out of ElevenLabs characters: ' + head);
    await new Promise(r => setTimeout(r, 3000 * (a + 1)));
  }
  throw new Error('could not record ' + JSON.stringify(text));
}
const saveIndex = () => { const sorted = {}; Object.keys(index).sort().forEach(k => { if (need.has(k)) sorted[k] = index[k]; }); fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(sorted)); };
let done = 0, failed = null; const queue = todo.slice();
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length && !failed) { const [k, t] = queue.shift(); try { await record(k, t); } catch (e) { failed = e; } if (++done % 50 === 0) { console.log(`  ${done}/${todo.length}`); saveIndex(); } }
}));
saveIndex();
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.mp3') && !Object.values(index).includes(f)) fs.unlinkSync(path.join(OUT, f));   // drop clips no longer used
if (failed) { console.error(String(failed)); process.exit(1); }
// every line must now be playable from the bank
const has = k => Object.prototype.hasOwnProperty.call(index, k);
const bad = [...whole, ...pieced].filter(l => !V.plan(l, has));
if (bad.length) { console.error('not playable:', bad.slice(0, 10)); process.exit(1); }
console.log(`recorded ${todo.length}; all ${whole.length + pieced.length} lines play from the bank`);
