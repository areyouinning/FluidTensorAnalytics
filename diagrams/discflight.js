/* A disc in flight, through whatever air you hand it.

   The model is the one from the site's Disc Flight Simulator — mass, diameter and the
   lift/drag/Magnus/turn/fade structure after Immonen (2021) — with one thing put right.

   THE FIX. That page treated wind as a sideways shove: a constant acceleration added to the
   x velocity, `wind_x = windSpeed * 0.15`. That is not how air works on a wing. Every
   aerodynamic force depends on the velocity of the disc THROUGH THE AIR, not over the ground,
   so wind belongs inside the relative velocity and nowhere else:

       v_rel = v_disc - v_wind

   and then lift, drag and the angle of attack all read off v_rel. Gravity and the position
   integration stay in the ground frame, because the ground does not move.

   What that buys, and why it is worth the change: a headwind RAISES airspeed, so it raises
   lift and drag together — the disc floats, climbs, and drops short, which is what a headwind
   really does to a disc and the opposite of being pushed backwards. A tailwind lowers airspeed
   and the disc falls out of the sky early. A crosswind turns the disc's own path into the wind
   and changes the angle it meets the air at. None of that comes out of a constant shove.

   `windAt(x, y, z)` returns [east, north, up] in m/s, or null for still air. Give it the
   twin's solved field and the disc flies through real terrain-shaped wind. */

export const DISC = {
  m: 0.175,        // kg
  d: 0.21,         // m
  rho: 1.225,      // kg/m^3
  g: 9.81,
  IX: 0.0018,
  /* CALIBRATED, NOT MEASURED, and different from the simulator page this came from.
     That page carries cd0 = 0.32 / cl0 = 0.18, which makes a 25 m/s release land at 25 m —
     82 feet. A throw that fast carries past 100 m in life, so the published model under-flies
     by about four times, and a disc page that disagrees with a tape measure is not much use.
     These two numbers were fitted instead to a benchmark anyone can check: a 25 m/s release
     at 10 degrees, flat, neutral disc, which now carries 91 m in 4.8 s and peaks near 6 m.
     They are a fit to that outcome, not wind-tunnel coefficients, and the lift/drag split
     here was never a faithful aerofoil model to begin with. */
  cd0: 0.08,
  cl0: 0.34,
  /* Turn and fade had to be rescaled for the same reason. They were tuned against a model
     whose discs landed at 25 m, so once the disc flew four times as far and three times as
     long, the same coefficients produced about nine g sideways and threw it 80 m off line.
     Fitted here so that, off a 25 m/s drive: an understable disc finishes right of the line,
     an overstable one left, neutral slightly left, all within the 5-25 m a real disc moves. */
  kTurn: 0.0005,
  kFade: 0.00018,
  kMagnus: 0.00002
};

const A = Math.PI * (DISC.d / 2) * (DISC.d / 2);

/* opts: speed m/s, angle deg (up), hyzer deg, nose deg, spin rpm, stability -3..3,
   rhbh bool, z0 release height above the ground, ground(x,y) -> terrain height,
   startZ absolute release height. Returns the path in world metres. */
export function fly(opts = {}, windAt = null) {
  const v0 = opts.speed ?? 20;
  const theta = (opts.angle ?? 5) * Math.PI / 180;
  const hyzer = (opts.hyzer ?? 0) * Math.PI / 180;
  const alpha = (opts.nose ?? 0) * Math.PI / 180;
  const r = (opts.spin ?? 1200) * 2 * Math.PI / 60;
  const stability = opts.stability ?? 0;
  const spinDir = (opts.rhbh ?? true) ? 1 : -1;
  const ground = opts.ground || (() => 0);
  const releaseZ = opts.startZ ?? (ground(0, 0) + 1.5);
  const bearing = (opts.bearing ?? 90) * Math.PI / 180;   // compass degrees to throw toward

  /* throw along the chosen bearing: +x east, +y north */
  const fwd = [Math.sin(bearing), Math.cos(bearing)];
  const side = [Math.cos(bearing), -Math.sin(bearing)];

  const pos = [0, 0, releaseZ];
  const horiz = v0 * Math.cos(theta);
  const vel = [
    fwd[0] * horiz * Math.cos(hyzer) + side[0] * horiz * Math.sin(hyzer),
    fwd[1] * horiz * Math.cos(hyzer) + side[1] * horiz * Math.sin(hyzer),
    v0 * Math.sin(theta)
  ];
  let psi = hyzer, phi = 0, tilt = 0;

  const dt = 0.01, maxT = 15;
  const path = [], airs = [];
  let t = 0, landed = false;

  for (; t < maxT; t += dt) {
    path.push([pos[0], pos[1], pos[2]]);

    const gz = ground(pos[0], pos[1]);
    if (pos[2] <= gz) { landed = true; break; }

    /* the air this disc is actually flying through */
    let wind = [0, 0, 0];
    if (windAt) {
      const q = windAt(pos[0], pos[1], pos[2]);
      if (q) wind = q;
    }
    const vr = [vel[0] - wind[0], vel[1] - wind[1], vel[2] - wind[2]];
    const vMag = Math.hypot(vr[0], vr[1], vr[2]);
    airs.push(vMag);
    if (vMag < 0.1 || !isFinite(vMag)) break;

    /* angle of attack is measured against the airflow, not the ground track */
    const fpa = Math.atan2(vr[2], Math.hypot(vr[0], vr[1]));
    const aoa = alpha - fpa;
    const cd = DISC.cd0 * (1 + 0.3 * Math.abs(aoa) + 0.2 * Math.abs(psi));
    const cl = DISC.cl0 * (1 + 2.0 * aoa);

    const q = 0.5 * DISC.rho * vMag * vMag / DISC.m;
    const Fd = q * cd * A;
    const drag = [-Fd * vr[0] / vMag, -Fd * vr[1] / vMag, -Fd * vr[2] / vMag];

    /* lift is perpendicular to the airflow, in the plane the disc is banked into */
    const Fl = q * cl * A;
    const vh = Math.hypot(vr[0], vr[1]);
    const lift = [0, 0, 0];
    if (vh > 0.01) {
      const ux = vr[0] / vh, uy = vr[1] / vh;            // along-track unit, horizontal
      const climb = Math.cos(psi) * Fl * (-vr[2] / Math.max(0.01, Math.hypot(vh, vr[2])));
      lift[0] = climb * ux;
      lift[1] = climb * uy;
      lift[2] = Fl * Math.cos(psi) * (vh / Math.max(0.01, Math.hypot(vh, vr[2])));
      /* bank pushes sideways, to the disc's left for a banked RHBH throw */
      const bank = Fl * Math.sin(psi);
      lift[0] += bank * -uy;
      lift[1] += bank * ux;
    }

    /* spin effects, all against airspeed */
    const speedFrac = vMag / v0;
    const magnus = spinDir * DISC.kMagnus * r * vMag * DISC.rho * A / DISC.m;
    /* Positive `lateral` pushes to the LEFT of travel. For a right-handed backhand that
       makes the two signature behaviours:
         turn, early and fast  — an UNDERSTABLE disc (stability < 0) goes RIGHT
         fade, late and slow   — EVERY disc goes LEFT, the more so the more overstable
       The simulator this came from had the turn term as -stability, which sent an overstable
       disc right early and finished it right of a neutral one. Backwards: overstable is the
       one that should never get right. */
    let turn = 0, fade = 0;
    if (speedFrac > 0.7) {
      const s = (speedFrac - 0.7) / 0.3;
      turn = stability * DISC.kTurn * s * s * r * vMag / DISC.m;
    }
    if (speedFrac < 0.6) {
      const s = (0.6 - speedFrac) / 0.6;
      fade = spinDir * (0.6 + Math.max(0, stability)) * DISC.kFade * s * r * vMag / DISC.m;
    }
    const lateral = magnus + turn + fade;
    const uh = vh > 0.01 ? [vr[0] / vh, vr[1] / vh] : fwd;

    vel[0] += (drag[0] + lift[0] + lateral * -uh[1]) * dt;
    vel[1] += (drag[1] + lift[1] + lateral * uh[0]) * dt;
    vel[2] += (drag[2] + lift[2] - DISC.g) * dt;
    if (!isFinite(vel[0]) || !isFinite(vel[1]) || !isFinite(vel[2])) break;

    pos[0] += vel[0] * dt;
    pos[1] += vel[1] * dt;
    pos[2] += vel[2] * dt;

    /* orientation: understable discs flip up, overstable ones fight back */
    if (stability < -0.5 && psi < -0.1 && speedFrac > 0.6) tilt = -stability * 0.4 * speedFrac;
    else if (stability > 0.5 && psi > 0.1 && speedFrac > 0.5) tilt = -stability * 0.35 * speedFrac;
    else tilt = -stability * 0.25 * Math.sin(psi) * speedFrac;
    phi += spinDir * 0.5 * Math.exp(-t * 0.4) * dt;
    psi = Math.max(-1.2, Math.min(1.2, psi + tilt * dt));
  }

  const end = path[path.length - 1];
  const along = end[0] * fwd[0] + end[1] * fwd[1];
  const across = end[0] * side[0] + end[1] * side[1];
  return {
    path, landed, time: t,
    distance: Math.hypot(end[0], end[1]),
    along, across,
    peak: path.reduce((m, p) => Math.max(m, p[2]), -Infinity),
    airspeed: airs.length ? airs.reduce((a, b) => a + b, 0) / airs.length : 0
  };
}
