/* How to catch an ensemble lying: where does the truth land among its members? This simulates each case. */
import { svg, el, clear, label, controls, picker, readouts, rng, gauss, C } from './kit.js';

const CASES = [
  { name: 'Honest', spread: 1, bias: 0, say: 'Flat bars: the truth is equally likely to land anywhere in the pack. That is what a trustworthy ensemble looks like.' },
  { name: 'Overconfident', spread: .4, bias: 0, say: 'A U: the truth keeps landing outside the pack. The forecast is sure of itself and too often wrong. This is the most common failure.' },
  { name: 'Too timid', spread: 2, bias: 0, say: 'A hill: the truth always lands mid-pack. The forecast is right and hedges more than it needs to.' },
  { name: 'Biased', spread: 1, bias: .9, say: 'A slope: the truth keeps landing low. The whole pack sits too high.' }
];

export function histogram(c, members = 9, trials = 4000, seed = 8) {
  const R = rng(seed), bins = new Array(members + 1).fill(0);
  for (let t = 0; t < trials; t++) {
    const truth = gauss(R); let rank = 0;
    for (let m = 0; m < members; m++) if (c.bias + c.spread * gauss(R) < truth) rank++;
    bins[rank]++;
  }
  return bins;
}

export default function (fig) {
  const s = svg(fig, 360, 170, 'Bar chart counting how often the truth landed at each rank among nine ensemble members.');
  const g = el('g', {}, s), box = controls(fig), cap = fig.querySelector('figcaption');
  const [outside] = readouts(fig, ['Truth outside the whole pack']);
  function draw(k) {
    clear(g);
    const bins = histogram(CASES[k]), top = Math.max(...bins), W = 36, sum = bins.reduce((a, b) => a + b, 0);
    bins.forEach((b, i) => {
      const h = b / top * 130, edge = i === 0 || i === bins.length - 1;
      el('rect', { x: i * W + 2, y: 140 - h, width: W - 4, height: h, rx: 3, fill: edge ? C.orange : C.blue }, g);
    });
    el('path', { d: 'M0 140H360', stroke: C.soft, fill: 'none' }, g);
    label(g, 0, 160, 'below all', { a: 'start', size: 13, cls: 'soft' });
    label(g, 360, 160, 'above all', { a: 'end', size: 13, cls: 'soft' });
    outside.textContent = ((bins[0] + bins[bins.length - 1]) / sum * 100).toFixed(0) + '% (honest: 20%)';
    cap.textContent = CASES[k].say;
  }
  picker(box, CASES.map(c => c.name), 1, draw);
  draw(1);
}
