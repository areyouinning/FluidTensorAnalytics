/* Fix one direction and a cube falls into a table. Fix two and it falls into a list. */
import { svg, el, clear, controls, picker, slider, isoProject, quad, C } from './kit.js';

const N = [6, 6, 4]; // x sites, y days, z variables

function cubelet(g, p, x, y, z, on, hue) {
  const f = on ? hue : C.line, o = on ? 1 : .35;
  const c = el('g', { opacity: o }, g);
  quad(c, p, [x, y + 1, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x, y + 1, z + 1], f);
  quad(c, p, [x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x + 1, y, z + 1], f);
  quad(c, p, [x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1], f);
}

export default function (fig) {
  const s = svg(fig, 360, 200, 'A cube of cells with one slice or one line of cells lit up.');
  const g = el('g', {}, s), box = controls(fig), cap = fig.querySelector('figcaption');
  const WAYS = [
    { name: 'One site', test: (x, y, z, i) => x === i, hue: C.blue, say: 'Fix the site: a table of every day and every variable at that site. This is a slice.' },
    { name: 'One day', test: (x, y, z, i) => y === i, hue: C.orange, say: 'Fix the day: a table of every site and every variable, one map of the system. Another slice.' },
    { name: 'One variable', test: (x, y, z, i) => z === i % N[2], hue: C.purple, say: 'Fix the variable: a table of every site and every day. A third slice, from the third direction.' },
    { name: 'One site, one variable', test: (x, y, z, i) => x === i && z === 2, hue: C.green, say: 'Fix two directions and one is left: a single time series. This is called a fiber.' }
  ];
  let way = 0, idx = 2;
  const p = isoProject(180, 134, 18);
  function draw() {
    clear(g);
    for (let z = 0; z < N[2]; z++) for (let x = 0; x < N[0]; x++) for (let y = 0; y < N[1]; y++) {
      cubelet(g, p, x - 3, y - 3, z - 2 + 2, WAYS[way].test(x, y, z, idx), WAYS[way].hue);
    }
    cap.textContent = WAYS[way].say;
  }
  picker(box, WAYS.map(w => w.name), 0, k => { way = k; draw(); });
  slider(controls(fig), 'Which one', 0, 5, 1, idx, v => v + 1, v => { idx = v; draw(); });
  draw();
}
