/* The game: pick a die (or let me pick first), roll eleven times, higher number takes the roll. */
import { svg, el, clear, label, controls, button, picker, readouts, C } from './kit.js';
import { EFRON, duel, frac, beater, matchChance } from './dice-core.js';

const ROLLS = 11;

export default function (fig) {
  const s = svg(fig, 380, 250, 'Two dice and the eleven rolls of a match.');
  const g = el('g', {}, s);
  const modeBox = controls(fig), pickBox = controls(fig), rollBox = controls(fig);
  const [perRoll, perMatch, tally] = readouts(fig, ['Your chance each roll', 'Your chance in a match', 'Matches, you to me']);
  const S = { youFirst: true, you: -1, me: -1, rolls: [], last: null, wins: 0, losses: 0, msg: 'Pick a die.' };

  const choose = picker(modeBox, ['You pick first', 'I pick first'], 0, k => { S.youFirst = k === 0; fresh(); });
  const dieBtns = EFRON.map((d, i) => button(pickBox, 'Die ' + d.k, () => pick(i)));
  const once = button(rollBox, 'Roll', () => roll(1), 'go');
  const ten = button(rollBox, 'Roll the rest', () => roll(ROLLS));
  button(rollBox, 'New match', () => fresh());

  function fresh() {
    S.rolls = []; S.last = null; S.you = -1; S.me = -1;
    if (!S.youFirst) { S.me = Math.floor(Math.random() * 4); S.msg = 'I picked die ' + EFRON[S.me].k + '. Your pick.'; }
    else S.msg = 'Pick a die. I pick after you.';
    draw();
  }
  function pick(i) {
    if (S.rolls.length && S.rolls.length < ROLLS) return;
    if (S.rolls.length >= ROLLS) { const keep = S.youFirst ? -1 : S.me; S.rolls = []; S.last = null; if (S.youFirst) S.me = -1; else S.me = keep; }
    if (!S.youFirst && i === S.me) return;
    S.you = i;
    if (S.youFirst) { S.me = beater(EFRON, i); S.msg = 'You took ' + EFRON[i].k + '. I take ' + EFRON[S.me].k + '.'; }
    else S.msg = 'You took ' + EFRON[i].k + ' against my ' + EFRON[S.me].k + '.';
    draw();
  }
  function roll(n) {
    if (S.you < 0 || S.me < 0 || S.rolls.length >= ROLLS) return;
    for (let k = 0; k < n && S.rolls.length < ROLLS; k++) {
      const a = EFRON[S.you].faces[Math.floor(Math.random() * 6)], b = EFRON[S.me].faces[Math.floor(Math.random() * 6)];
      S.last = [a, b]; S.rolls.push(a > b ? 1 : 0);
    }
    if (S.rolls.length >= ROLLS) {
      const mine = S.rolls.filter(x => x).length, won = mine > ROLLS / 2;
      if (won) S.wins++; else S.losses++;
      S.msg = won ? 'You won the match, ' + mine + ' to ' + (ROLLS - mine) + '. Again?' : 'I won the match, ' + (ROLLS - mine) + ' to ' + mine + '. Again?';
    } else S.msg = 'Roll ' + S.rolls.length + ' of ' + ROLLS + '.';
    draw();
  }

  function die(x, y, d, face, who) {
    el('rect', { x, y, width: 92, height: 92, rx: 18, fill: d ? d.c : C.sunk }, g);
    label(g, x + 46, y + 62, d ? (face == null ? d.k : String(face)) : '?', { size: 46, w: 600, fill: d ? 'var(--on-accent)' : 'var(--ink-soft)' });
    label(g, x + 46, y - 10, who, { size: 14, cls: 'soft' });
    if (d) d.faces.forEach((f, k) => {
      el('rect', { x: x - 8 + k * 18, y: y + 102, width: 16, height: 18, rx: 4, fill: C.sunk }, g);
      label(g, x + k * 18, y + 116, String(f), { size: 12, cls: 'mono' });
    });
  }

  function draw() {
    clear(g);
    const you = S.you >= 0 ? EFRON[S.you] : null, me = S.me >= 0 ? EFRON[S.me] : null;
    die(52, 30, you, S.last ? S.last[0] : null, 'You');
    die(236, 30, me, S.last ? S.last[1] : null, 'Me');
    label(g, 190, 84, 'vs', { size: 16, cls: 'soft' });
    if (S.last) label(g, 190, 108, S.last[0] > S.last[1] ? '← you' : 'me →', { size: 14, w: 600 });
    for (let k = 0; k < ROLLS; k++) {
      const r = S.rolls[k], x = 22 + k * 31;
      el('rect', { x, y: 186, width: 27, height: 27, rx: 6, fill: r == null ? C.sunk : r ? (you ? you.c : C.ink) : (me ? me.c : C.ink), opacity: r == null ? 1 : .9 }, g);
      if (r != null) label(g, x + 13.5, 205, r ? 'Y' : 'M', { size: 13, w: 600, fill: 'var(--on-accent)' });
    }
    label(g, 190, 238, S.msg, { size: 15 });
    dieBtns.forEach((b, i) => { b.setAttribute('aria-pressed', i === S.you); b.disabled = (!S.youFirst && i === S.me) || (S.rolls.length > 0 && S.rolls.length < ROLLS); });
    const ready = you && me && S.rolls.length < ROLLS; once.disabled = !ready; ten.disabled = !ready;
    if (you && me) { const r = duel(you.faces, me.faces), p = r.w / r.n; perRoll.textContent = frac(r.w, r.n); perMatch.textContent = (matchChance(p, ROLLS) * 100).toFixed(1) + '%'; }
    else { perRoll.textContent = '–'; perMatch.textContent = '–'; }
    tally.textContent = S.wins + ' to ' + S.losses;
  }
  fresh();
}
