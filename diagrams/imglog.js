/* Taking the logarithm of an image, two ways.
   data-view="bright": log of the brightness. A synthetic sky whose pixels span 1 to 100,000; display = log(1 + a·x) / log(1 + a·max).
   data-view="map": log of the positions. A pixel at z = x + iy moves to log z = ln|z| + i·arg z, so rings become stripes and spokes become lines.
     "Escher twist" goes back the other way with a turn: out(z) = droste(exp(α·log z)), α = 1 − i·ln(s)/(2π), the transform behind Escher's Print Gallery.
   A photo you choose is read in your browser only; it is never sent anywhere. */
import { controls, picker, slider, rng } from './kit.js';

const W = 360, H = 240, Hs = 300;
function canvas(fig, w, h, label) { const c = document.createElement('canvas'); c.width = w; c.height = h; c.className = 'd'; c.style.borderRadius = '10px'; c.setAttribute('role', 'img'); c.setAttribute('aria-label', label); fig.insertBefore(c, fig.querySelector('figcaption')); return c; }

/* a night sky: one blazing star, a faint galaxy, a sprinkle of dim stars, a little noise. Values 1 .. ~1e5 */
export function sky() {
  const R = rng(17), a = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y * W + x, dx = x - 250, dy = y - 140, gx = (dx * .85 + dy * .5) / 60, gy = (-dx * .5 + dy * .85) / 22;
    let v = 1 + 2 * R();                                                     // sky glow and noise
    v += 60 * Math.exp(-(gx * gx + gy * gy)) * (1 + .4 * Math.cos(6 * Math.atan2(gy, gx) + 3 * Math.hypot(gx, gy)));   // a faint spiral galaxy
    v += 1e5 * Math.exp(-((x - 90) ** 2 + (y - 80) ** 2) / 18) + 400 * Math.exp(-Math.hypot(x - 90, y - 80) / 9);      // a bright star and its halo
    a[k] = v;
  }
  for (let i = 0; i < 70; i++) { const x = (R() * W) | 0, y = (R() * H) | 0, b = 20 + 300 * R() * R(); for (let j = -1; j <= 1; j++) for (let q = -1; q <= 1; q++) { const X = x + q, Y = y + j; if (X >= 0 && Y >= 0 && X < W && Y < H) a[Y * W + X] += b * Math.exp(-(q * q + j * j)); } }
  return a;
}

/* built-in pictures on the plane |x|,|y| ≤ 1, as functions returning [r,g,b] */
const PICS = {
  rings: (x, y) => { const r = Math.hypot(x, y), t = Math.atan2(y, x), band = Math.floor(Math.log(r + 1e-9) / Math.log(1.6) * 2) & 1, spoke = Math.floor((t + Math.PI) / (Math.PI / 6)) & 1; return band ^ spoke ? [31, 111, 235] : [255, 194, 26]; },
  clock: (x, y) => { const r = Math.hypot(x, y), t = Math.atan2(y, x); if (r > .95) return [27, 29, 33]; if (r > .9) return [241, 239, 234];
    const tick = Math.abs(((t * 6 / Math.PI) % 1 + 1) % 1 - .5) > .47 && r > .75; if (tick) return [27, 29, 33];
    const hand = (ang, len, w) => { const hx = Math.cos(ang), hy = Math.sin(ang), p = x * hx + y * hy, d = Math.abs(-x * hy + y * hx); return p > 0 && p < len && d < w; };
    if (hand(-Math.PI / 2 + .9, .55, .04) || hand(-Math.PI / 2 - 2, .8, .025)) return [200, 50, 31]; return [252, 251, 249]; },
  checks: (x, y) => ((Math.floor(x * 6 + 6) + Math.floor(y * 6 + 6)) & 1) ? [27, 29, 33] : [252, 251, 249]
};

export default function (fig) { return fig.getAttribute('data-view') === 'bright' ? bright(fig) : map(fig); }

function bright(fig) {
  const c = canvas(fig, W, H, 'A night sky with one blazing star and a faint galaxy, shown with a brightness scale you choose.'), g = c.getContext('2d'), img = g.createImageData(W, H), a = sky(), mx = a.reduce((m, v) => Math.max(m, v), 0);
  const box = controls(fig); let s = 0;
  const read = document.createElement('p'); read.className = 'nojs'; read.setAttribute('aria-live', 'polite'); fig.insertBefore(read, fig.querySelector('figcaption'));
  function draw() {
    const A = Math.pow(10, s);   // s = 0 is plain linear; larger s bends harder toward the logarithm
    let seen = 0;
    for (let k = 0; k < W * H; k++) {
      const v = s <= 0 ? a[k] / mx : Math.log1p(A * a[k] / mx) / Math.log1p(A), q = Math.round(255 * Math.min(1, v));
      img.data[k * 4] = q; img.data[k * 4 + 1] = q; img.data[k * 4 + 2] = Math.min(255, q + 8); img.data[k * 4 + 3] = 255; if (q >= 8) seen++;
    }
    g.putImageData(img, 0, 0);
    read.textContent = (s <= 0 ? 'Linear: ' : 'Logarithmic: ') + (100 * seen / (W * H)).toFixed(1) + '% of pixels are bright enough to see (above 3% grey). The brightest pixel is ' + Math.round(mx).toLocaleString('en-US') + ' times the darkest sky.';
  }
  slider(box, 'From linear to logarithmic ', 0, 6, .1, s, v => v <= 0 ? 'linear' : 'a = 10^' + v.toFixed(1), v => { s = v; draw(); });
  draw();
}

function map(fig) {
  const S = 300, c1 = canvas(fig, S, S, 'The picture before the map.'), c2 = canvas(fig, S, S, 'The picture after the map.');
  c1.style.maxWidth = c2.style.maxWidth = 'min(48%, 300px)'; c1.style.display = c2.style.display = 'inline-block'; c1.style.margin = c2.style.margin = '0 1%';
  const g1 = c1.getContext('2d'), g2 = c2.getContext('2d'), box = controls(fig), box2 = controls(fig);
  let pic = 'rings', mode = 0, photo = null, scale = 4;
  function sample(x, y) {   // the source picture at plane point (x, y)
    if (pic === 'photo' && photo) { const u = Math.round((x + 1) / 2 * (photo.w - 1)), v = Math.round((1 - (y + 1) / 2) * (photo.h - 1)); if (u < 0 || v < 0 || u >= photo.w || v >= photo.h) return [241, 239, 234]; const o = (v * photo.w + u) * 4; return [photo.d[o], photo.d[o + 1], photo.d[o + 2]]; }
    return Math.abs(x) <= 1 && Math.abs(y) <= 1 ? PICS[pic === 'photo' ? 'rings' : pic](x, y) : [241, 239, 234];
  }
  /* the Droste picture: the source with a copy of itself, 1/scale as big, in its middle, forever */
  function droste(x, y) { const m = Math.max(Math.abs(x), Math.abs(y)) || 1e-9, k = Math.floor(Math.log(m) / Math.log(scale)), f = Math.pow(scale, -k); let X = x * f, Y = y * f;
    if (Math.max(Math.abs(X), Math.abs(Y)) > 1) { X /= scale; Y /= scale; } return sample(X, Y); }
  function draw() {
    const i1 = g1.createImageData(S, S), i2 = g2.createImageData(S, S), L = Math.log(scale);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const x = i / (S - 1) * 2 - 1, y = 1 - j / (S - 1) * 2, o = (j * S + i) * 4;
      const p = mode === 0 ? sample(x, y) : droste(x * 1.02, y * 1.02); i1.data[o] = p[0]; i1.data[o + 1] = p[1]; i1.data[o + 2] = p[2]; i1.data[o + 3] = 255;
      let q;
      if (mode === 0) { const lr = -4.5 + (i / (S - 1)) * 4.5, th = Math.PI - j / (S - 1) * 2 * Math.PI, r = Math.exp(lr); q = sample(r * Math.cos(th), r * Math.sin(th)); }   // across: ln r from −4.5 to 0; down: angle from π to −π
      else { const lr = Math.log(Math.hypot(x, y) + 1e-12), th = Math.atan2(y, x), ar = 1, ai = -L / (2 * Math.PI), wr = ar * lr - ai * th, wi = ai * lr + ar * th, r = Math.exp(wr); q = droste(r * Math.cos(wi), r * Math.sin(wi)); }
      i2.data[o] = q[0]; i2.data[o + 1] = q[1]; i2.data[o + 2] = q[2]; i2.data[o + 3] = 255;
    }
    g1.putImageData(i1, 0, 0); g2.putImageData(i2, 0, 0);
  }
  picker(box, ['Rings and spokes', 'Clock', 'Checkerboard'], 0, k => { pic = ['rings', 'clock', 'checks'][k]; draw(); });
  const file = document.createElement('label'), inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; file.className = 'btn'; file.style.cssText = 'display:inline-flex;align-items:center;cursor:pointer';
  file.append('Your photo', inp); inp.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0'; box.appendChild(file);
  inp.addEventListener('change', () => { const f = inp.files[0]; if (!f) return; const im = new Image(); im.onload = () => { const n = 300, cv = document.createElement('canvas'); cv.width = n; cv.height = n; const cx = cv.getContext('2d'), m = Math.min(im.width, im.height); cx.drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, n, n); photo = { w: n, h: n, d: cx.getImageData(0, 0, n, n).data }; pic = 'photo'; URL.revokeObjectURL(im.src); draw(); }; im.src = URL.createObjectURL(f); });
  picker(box2, ['Log map', 'Escher twist'], 0, k => { mode = k; draw(); });
  slider(box2, 'Droste scale ', 2, 12, .5, scale, v => v.toFixed(1) + '×', v => { scale = v; if (mode) draw(); });
  draw();
}
