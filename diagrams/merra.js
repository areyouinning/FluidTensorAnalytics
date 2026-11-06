/* Real data: one month of MERRA-2 reanalysis, stored in merra2_data.json. Pick a layer of the cube. */
import { svg, el, clear, label, controls, picker, readouts, ramp, isoProject, quad, C } from './kit.js';

export default async function (fig) {
  const s = svg(fig, 360, 190, 'A stack of four weather layers with one lifted out as a heat map of its real values.');
  const g = el('g', {}, s), box = controls(fig);
  const [lo, hi] = readouts(fig, ['Lowest in this layer', 'Highest in this layer']);
  const text = await (await fetch('/merra2_data.json')).text();
  const data = JSON.parse(text.replace(/\bNaN\b/g, 'null')), vars = Object.values(data.variables).filter(v => v.data.flat().some(x => x != null));
  const short = n => n.replace('Temperature', 'Temp').replace('Relative Humidity', 'Humidity').replace('Sea Level Pressure', 'Pressure');
  const Cell = 14, X0 = 190, Y0 = 20;
  function draw(k) {
    clear(g);
    const p = isoProject(84, 70, 12);
    vars.forEach((_, n) => {
      const z = (vars.length - 1 - n) * .9, on = n === k, f = on ? C.orange : C.line;
      quad(g, p, [0, 0, z], [5, 0, z], [5, 5, z], [0, 5, z], f);
    });
    const v = vars[k], vals = v.data.flat().filter(x => x != null), mn = Math.min(...vals), mx = Math.max(...vals);
    v.data.forEach((row, r) => row.forEach((x, c) => {
      el('rect', { x: X0 + c * Cell, y: Y0 + r * Cell, width: Cell - 1, height: Cell - 1, rx: 1.5, fill: x == null ? C.sunk : ramp((x - mn) / (mx - mn || 1) * .95 + .05, 'var(--orange)') }, g);
    }));
    label(g, X0 + v.data[0].length * Cell / 2, 12, short(v.name), { w: 600, size: 13 });
    lo.textContent = mn.toFixed(1) + ' ' + v.units;
    hi.textContent = mx.toFixed(1) + ' ' + v.units;
  }
  picker(box, vars.map(v => short(v.name).replace(' hPa', '').replace(' @ ', ' ')), 1, draw);
  draw(1);
}
