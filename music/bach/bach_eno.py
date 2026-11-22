"""Bach, Prelude in C (BWV 846), after Brian Eno. No pulse; 150 s.

Each bar of the Prelude is an eight-note figure. Five loops, on felt piano and bells, each repeat a
figure every 13, 17, 19, 23 or 29 seconds (all prime, so they never line up twice). Every loop walks
through Bach's 32 figures over the piece, each a few seconds behind the last, so neighbouring
harmonies overlap: the Prelude heard as five slow echoes of itself. A drone holds C, moves to G for
Bach's long dominant pedal, and comes home.
"""
import os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path[:0] = [HERE, os.path.dirname(HERE)]
from kit import Track, finish, norm_rms
from score import bars as score_bars

BB = score_bars()
CELL = {k: sorted([(n[0] - 4 * k, n[1]) for n in BB[k] if n[0] - 4 * k < 2], key=lambda x: (x[0], x[1]))[:8] for k in range(32)}
tr = Track('bach-eno', 'Prelude in C (after Brian Eno)', bpm=60, bars=37, tail=2.0, div=192, seed=303)
SPAN, STEP = 138.0, .46                       # the walk through Bach's 32 bars takes 138 s; one 16th becomes 0.46 s
LOOPS = [(13.0, 0.5, 'felt', 0, -.35, .55, 0.0), (17.0, 3.9, 'felt', 0, .35, .5, 4.0), (19.0, 8.3, 'bell', 12, .6, .2, 8.0),
         (23.0, 12.7, 'felt', -12, 0.0, .5, 12.0), (29.0, 19.1, 'bell', 12, -.6, .18, 16.0)]
piano, bells, strikes = tr.bus(), tr.bus(), 0
for period, start, inst, octv, pan, vel, lag in LOOPS:
    t = start
    while t < 140:
        k = int(np.clip((t - lag) / SPAN * 32, 0, 31))
        for i, (rel, m) in enumerate(CELL[k]):
            t0 = tr.snap(t + i * STEP)
            v = vel * (.85 + .3 * tr.rng.random())
            if inst == 'felt':
                tr.put(piano, tr.piano(m + octv, v, felt=.8), t0, pan=pan)
            else:
                tr.put(bells, tr.bell(m + octv, 6.0, bright=.8), t0, v, pan=pan)
            strikes += 1
        t += period
drone = tr.bus()
G_ON, G_OFF = 23 / 32 * SPAN + 4, 31 / 32 * SPAN + 4
for m, notes_ in ((36, [(0.0, 36, G_ON + .5), (G_OFF, 36, 150 - G_OFF)]), (43, [(0.0, 43, 148.0)]), (31, [(G_ON, 31, G_OFF - G_ON + .5)])):
    per = {36: 11.0, 43: 13.0, 31: 17.0}[m]
    amod = .55 + .45 * np.sin(2 * np.pi * tr.g.th / per) ** 2
    drone += tr.saw_line(notes_, K=10, cutoff=480, attack=6.0, release=4.0, amod=amod, detune=(-3, 3), pans=(-.4, .4))
piano, bells, drone = norm_rms(piano, -23), norm_rms(bells, -31), norm_rms(drone, -30)
hall = tr.reverb(piano + .8 * bells + .25 * drone, hp=180, t60_lo=7.0, t60_hi=3.0, f_lo=400, f_hi=6000, dur=10.0, seed=3, predelay=.045, dark=5000)
echo = tr.delay(piano + .5 * bells, 2.3, fb=.4, reps=6, lp=2500, pingpong=.7)
mix = .85 * piano + .8 * bells + drone + .55 * norm_rms(hall, -24) + .22 * echo
finish(tr, mix, target=-17.0, fade=(141.0, 148.0),
       sections=[(0, 'One loop'), (19.1, 'All five loops'), (G_ON, "Bach's G pedal"), (G_OFF, 'Home to C')],
       notes=f'{strikes} notes from 5 loops walking BWV 846 bars 1-32')
