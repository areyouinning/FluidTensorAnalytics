/* The puzzle: choose a dose and a split at each of six steps. Scored exactly, in your browser. */
import { P, BEST, run, solve, fate } from './diagrams/twohalf-core.js';

const plan = Array.from({ length: P.rounds }, () => [0, .5]);
const rows = [];
const $ = id => document.getElementById(id);
let mine = null, site = null;
/* false until setup finishes, so the preset the page opens with is not recorded as something you did */
let live = false;

/* A schedule is small enough to live in a link: "6.6,35;5.2,38;4.4,45".
   Interior empty steps have to stay, because a step's position sets how hard its vehicles
   are cleared. Trailing ones can go, since run() pads the rest with no dose. */
function encode(sched) {
  const out = sched.map(([d, f]) => (d > 0 ? +d.toFixed(1) : 0) + ',' + Math.round(f * 100));
  while (out.length && /^0,/.test(out[out.length - 1])) out.pop();
  return out.join(';');
}
function decode(s) {
  const steps = String(s).split(';').filter(Boolean).map(p => {
    const [d, f] = p.split(',').map(Number);
    if (!isFinite(d) || !isFinite(f)) return null;
    return [Math.max(0, Math.min(P.dose, d)), Math.max(.01, Math.min(.99, f / 100))];
  });
  return steps.length && steps.length <= P.rounds && steps.every(Boolean) ? steps : null;
}

function make() {
  const box = $('plan');
  for (let k = 0; k < P.rounds; k++) {
    const d = document.createElement('div');
    d.className = 'visit';
    d.innerHTML = '<h3>Step ' + (k + 1) + '</h3>' +
      '<label>Dose<input type="range" min="0" max="' + P.dose + '" step="0.1" value="0" aria-label="Dose at step ' + (k + 1) + '"><output>0</output></label>' +
      '<label>To half A<input type="range" min="2" max="98" step="1" value="50" aria-label="Share to half A at step ' + (k + 1) + '"><output>50%</output></label>' +
      '<p class="lam"></p>';
    const [dose, split] = d.querySelectorAll('input');
    const outs = d.querySelectorAll('output');
    const sync = () => {
      plan[k] = [+dose.value, split.value / 100];
      outs[0].textContent = (+dose.value).toFixed(1);
      outs[1].textContent = split.value + '%';
      score();
    };
    dose.addEventListener('input', sync);
    split.addEventListener('input', sync);
    rows.push({ dose, split, outs, lam: d.querySelector('.lam') });
    box.appendChild(d);
  }
}

function put(sched) {
  for (let k = 0; k < P.rounds; k++) {
    const [d, f] = sched[k] || [0, .5];
    rows[k].dose.value = d;
    rows[k].split.value = Math.round(f * 100);
    plan[k] = [+rows[k].dose.value, rows[k].split.value / 100];
    rows[k].outs[0].textContent = (+rows[k].dose.value).toFixed(1);
    rows[k].outs[1].textContent = rows[k].split.value + '%';
  }
  score();
}

const PARTS = [
  ['Both copies fixed', 'var(--green)', v => fate(v, 'CC')],
  ['One fixed, one scarred', 'var(--orange)', v => fate(v, 'CS')],
  ['One fixed, one still raw', 'var(--blue)', v => fate(v, 'RC')],
  ['Neither fixed', 'var(--sunk)', v => fate(v, 'RR') + fate(v, 'RS') + fate(v, 'SS')]
];

function score() {
  const r = run(plan);
  $('v-score').textContent = (r.score * 100).toFixed(2) + '%';
  $('v-done').textContent = (r.done * 100).toFixed(1) + '%';
  $('v-surv').textContent = (r.surv * 100).toFixed(0) + '%';
  $('v-dose').textContent = r.total.toFixed(1);

  rows.forEach((row, k) => {
    const [d, f] = plan[k];
    if (!(d > 0)) { row.lam.textContent = 'No dose. A machine already here still works, and held halves still decay.'; return; }
    const eff = d * Math.pow(P.eta, k);
    row.lam.textContent = 'Vehicles that arrive: ' + (f * eff * P.wA).toFixed(2) + ' of half A, ' +
      ((1 - f) * eff * P.wB).toFixed(2) + ' of half B.';
  });

  const bar = $('fate');
  bar.replaceChildren();
  PARTS.forEach(([name, hue, get]) => {
    const w = get(r.v) * r.surv * 100;
    if (w <= 0) return;
    const sp = document.createElement('span');
    sp.style.cssText = 'width:' + w + '%;background:' + hue;
    sp.title = name + ': ' + w.toFixed(1) + '%';
    bar.appendChild(sp);
  });
  const dead = (1 - r.surv) * 100;
  if (dead > 0) {
    const sp = document.createElement('span');
    sp.style.cssText = 'width:' + dead + '%;background:var(--line)';
    sp.title = 'Lost to the dose: ' + dead.toFixed(1) + '%';
    bar.appendChild(sp);
  }

  if (mine) {
    const B = window.FTABest;
    const kept = (live && r.total > 0) ? B.record('two-halves', r.score, false) : { best: B.get('two-halves') };
    mine.textContent = kept.best == null ? 'not yet' : (kept.best * 100).toFixed(2) + '%';
  }

  const m = $('plan-msg');
  const gap = r.score - P.best;
  if (r.total === 0) { m.className = 'pmsg'; m.textContent = 'Give at least one step a dose.'; return; }
  if (gap > 1e-6) {
    m.className = 'pmsg win';
    m.textContent = 'You beat the best I found, ' + (P.best * 100).toFixed(2) + '%, by ' + (gap * 100).toFixed(2) + ' points. Tell me how.';
  } else if (gap > -2e-4) {
    m.className = 'pmsg win';
    m.textContent = 'That matches the best I found, ' + (P.best * 100).toFixed(2) + '%.';
  } else {
    m.className = 'pmsg';
    m.textContent = (r.score * 100).toFixed(2) + '% fixed. The best I found is ' + (P.best * 100).toFixed(2) + '%.';
  }
}

function buttons() {
  const box = $('plan-btns');
  const add = (text, on, cls) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn' + (cls ? ' ' + cls : ''); b.textContent = text;
    b.addEventListener('click', on);
    box.appendChild(b);
    return b;
  };
  add('One big dose', () => put([[9, .5]]));
  add('Three even doses', () => put([[5, .5], [5, .5], [5, .5]]));
  const go = add('Improve mine', () => {
    go.disabled = true;
    go.textContent = 'Working';
    setTimeout(() => {
      const seed = plan.some(r => r[0] > 0) ? plan : [[5, .5], [5, .5], [5, .5], [0, .5], [0, .5], [0, .5]];
      put(solve(seed.map(r => r.slice())).sched);
      go.disabled = false;
      go.textContent = 'Improve mine';
    }, 20);
  }, 'go');
  add('Show the best I found', () => put(BEST));
  add('Clear', () => put([]));
}

function key() {
  $('fate-key').innerHTML = PARTS.map(([name, hue]) => '<span><i style="background:' + hue + '"></i>' + name + '</span>').join('') +
    '<span><i style="background:var(--line)"></i>Lost to the dose</span>';
}

/* the best strip, the share link, and anything a link handed us */
function bests() {
  const B = window.FTABest;
  if (!B) return;
  [mine, site] = B.strip($('best'), ['Your best on this device', 'Best I found']);
  site.textContent = (P.best * 100).toFixed(2) + '%';
  B.copier($('share-row'), () => B.share({ s: encode(plan) }), 'Copy my result link');

  const sent = decode(B.parse().s || '');
  if (!sent) { score(); live = true; return; }
  live = true;
  put(sent);
  const r = run(sent);
  const m = $('plan-msg');
  m.className = 'pmsg';
  m.textContent = 'Loaded from a link and recomputed here: ' + (r.score * 100).toFixed(2) +
    '%. The link carried the schedule, not the score, so that number is this page’s, not theirs.';
}

make();
buttons();
key();
put([[5, .5], [5, .5], [5, .5]]);
bests();
