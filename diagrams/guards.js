/* Two doors, two guards. One guard always tells the truth, one always lies; one door leads out.
   You put one yes-or-no question to the guard at the LEFT door. The four possible worlds are
   (who stands at the left door) x (which door is the way out). For each world the answer is
   computed from a small model, never written in:
     a guard turns a true/false fact into an answer: the truth-teller reports it, the liar flips it.
   A question "works" when the answer depends only on which door is the way out: the two cells in each
   column agree, and the two columns differ. Answers go through the guard's honesty once (Q1, Q2),
   or twice (Q3 through the other guard, Q4 through the same guard): flipping twice restores the fact. */
import { svg, el, clear, label, controls, picker, readouts } from './kit.js';

const GREEN = 'var(--green)', ORANGE = 'var(--orange)', RED = 'var(--red)', LINE = 'var(--line)', SUNK = 'var(--sunk)';

/* A guard reports a fact: the truth-teller says it, the liar says the opposite. */
export const tell = (honest, fact) => honest ? fact : !fact;

/* world: { honestLeft: bool, safe: 'L' | 'R' }. Each question gives the left guard's answer (true = yes). */
export const QUESTIONS = [
  { short: '1  Your door', full: '1. “Is your door the way out?”',
    ask: w => tell(w.honestLeft, w.safe === 'L') },
  { short: '2  The liar', full: '2. “Are you the liar?”',
    ask: w => tell(w.honestLeft, !w.honestLeft) },
  { short: '3  The other guard', full: '3. “Would the other guard say your door is the way out?”',
    ask: w => {
      const otherSays = tell(!w.honestLeft, w.safe === 'L'); // the right guard is asked about the left door
      return tell(w.honestLeft, otherSays);                   // the left guard reports it
    } },
  { short: '4  Your own answer', full: '4. “If I asked you whether your door is the way out, would you say yes?”',
    ask: w => {
      const own = QUESTIONS[0].ask(w);  // what this guard would say to question 1
      return tell(w.honestLeft, own);   // and now they report that
    } }
];

const WORLDS = [[true, 'L'], [true, 'R'], [false, 'L'], [false, 'R']]; // [honestLeft, safe]

/* answers[row][col]: row 0 = truth-teller at left, 1 = liar; col 0 = way out left, 1 = way out right */
export function table(q) {
  const a = [[null, null], [null, null]];
  for (const [h, s] of WORLDS) a[h ? 0 : 1][s === 'L' ? 0 : 1] = QUESTIONS[q].ask({ honestLeft: h, safe: s });
  return a;
}

export function judge(a) {
  const colAgree = [a[0][0] === a[1][0], a[0][1] === a[1][1]];
  const differ = a[0][0] !== a[0][1];
  const works = colAgree[0] && colAgree[1] && differ;
  const status = [0, 1].map(c => !colAgree[c] ? 'mixed' : works ? 'good' : 'flat');
  let verdict;
  if (works) verdict = a[0][0] ? 'Yes: “yes” means take this door' : 'Yes: “yes” means take the other door';
  else if (!colAgree[0] || !colAgree[1]) verdict = 'No: the answer depends on who you asked';
  else verdict = 'No: the answer is the same whichever door is safe';
  return { works, colAgree, status, verdict };
}

const WHY = [
  'A truth-teller says yes when the door is out and a liar says yes when it is not, so one answer can mean either.',
  'Both guards say no: the liar lies about being the liar. The answer reveals neither who lies nor which door.',
  'The other guard’s answer is always wrong about your door, and your guard reports it truthfully or flips it back. Either way the answer is the opposite of the fact.',
  'A liar lies about the lie they would tell, so two flips cancel. A truth-teller just repeats the truth. Both give the fact.'
];

export default function (fig) {
  const s = svg(fig, 380, 252, 'A two by two table. Rows: the guard at the left door tells the truth, or lies. Columns: the way out is the left door, or the right door. Each cell shows the answer the left guard gives to the chosen question.');
  const g = el('g', {}, s);
  const box = controls(fig);
  const [verdictR, whyR] = readouts(fig, ['Does it work?', 'Why']);
  let q = 2;

  function draw() {
    clear(g);
    const a = table(q), j = judge(a);
    // the question, in full, on two lines
    const words = QUESTIONS[q].full.split(' '); let l1 = '', l2 = '';
    for (const w of words) { if ((l1 + ' ' + w).length <= 46 && !l2) l1 = (l1 + ' ' + w).trim(); else l2 = (l2 + ' ' + w).trim(); }
    label(g, 190, 16, 'Asked of the guard at the left door', { size: 11, cls: 'soft' });
    label(g, 190, 36, l1, { size: 13.5, w: 700 });
    if (l2) label(g, 190, 54, l2, { size: 13.5, w: 700 });

    const X = [118, 250], W = 124, Y = [102, 170], H = 62;
    label(g, 190, 78, 'The way out is', { size: 11, cls: 'soft' });
    ['the left door', 'the right door'].forEach((t, c) => label(g, X[c] + W / 2, 95, t, { size: 12.5, w: 700 }));
    [['Left guard', 'tells the truth'], ['Left guard', 'lies']].forEach((t, r) => {
      label(g, 6, Y[r] + 27, t[0], { a: 'start', size: 12.5, w: 700 });
      label(g, 6, Y[r] + 44, t[1], { a: 'start', size: 12, cls: 'soft' });
    });
    const HUE = { good: GREEN, flat: ORANGE, mixed: RED };
    for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
      const hue = HUE[j.status[c]];
      el('rect', { x: X[c], y: Y[r], width: W, height: H, rx: 8, fill: `color-mix(in srgb, ${hue} 22%, var(--panel))`, stroke: hue, 'stroke-width': 2 }, g);
      label(g, X[c] + W / 2, Y[r] + 40, a[r][c] ? 'yes' : 'no', { size: 24, w: 700 });
    }
    const note = j.works ? 'Green: each column agrees, and the columns differ.' : j.colAgree[0] && j.colAgree[1] ? 'Orange: each column agrees, but both give the same answer.' : 'Red: a column’s two answers disagree.';
    label(g, 190, 246, note, { size: 11, cls: 'soft' });

    verdictR.textContent = j.verdict;
    whyR.textContent = WHY[q];
  }
  picker(box, QUESTIONS.map(x => x.short), q, k => { q = k; draw(); });
  draw();
}
