"""Brian Eno study: "Loops for a Slow Morning".

Eno's method from Music for Airports: give a few phrases loops of different lengths,
none a multiple of another, and let them drift. Nothing is composed beyond the loops;
the piece is what their phase relationships happen to do. Here: seven felt-piano and
bell loops on periods of 17.9-37.9 s, three sung "oo" loops on 41-53 s, a drone
that breathes on 11, 13 and 17 s cycles, a long dark hall and a slow echo.
F major pentatonic, no pulse. 150 s.
"""
import numpy as np
from kit import Track, finish, norm_rms

tr = Track('eno-slow-morning', 'Loops for a Slow Morning (after Brian Eno)', bpm=60, bars=37, tail=2.0, div=192, seed=11)
END_STRIKES = 136.0

LOOPS = [  # period s, first strike s, [(offset s, midi)], instrument, velocity, pan
    (17.9, 1.0, [(0, 65)], 'felt', .55, -.3),
    (20.3, 4.2, [(0, 57), (.5, 60)], 'felt', .5, .25),
    (23.7, 9.5, [(0, 74)], 'felt', .42, .5),
    (25.1, 13.0, [(0, 72), (1.0, 69)], 'felt', .45, -.5),
    (31.3, 2.6, [(0, 53)], 'felt', .6, 0.0),
    (29.0, 21.7, [(0, 67)], 'bell', .22, .6),
    (37.9, 30.0, [(0, 76)], 'bell', .18, -.6),
]
VOICES = [  # period, first, midi, length, vowel pair
    (41.0, 18.0, 72, 7.0, ('u', 'o')),
    (47.0, 40.0, 69, 8.0, ('u', 'a')),
    (53.0, 61.0, 65, 9.0, ('o', 'u')),
]

piano = tr.bus(); bells = tr.bus(); strikes = 0
for period, first, phrase, inst, vel, pan in LOOPS:
    k = 0
    while first + k * period < END_STRIKES:
        for off, m in phrase:
            t0 = tr.snap(first + k * period + off)
            v = vel * (.88 + .24 * tr.rng.random())
            if inst == 'felt':
                tr.put(piano, tr.piano(m, v, felt=.8), t0, pan=pan)
            else:
                tr.put(bells, tr.bell(m, 7.0, bright=.8), t0, v, pan=pan)
            strikes += 1
        k += 1

voices = tr.bus()
for i, (period, first, m, L, (v1, v2)) in enumerate(VOICES):
    notes = []
    k = 0
    while first + k * period + L < END_STRIKES + 6:
        t0 = tr.snap(first + k * period)
        notes += [(t0, m, L * .5, v1, .9), (tr.snap(t0 + L * .5), m, L * .5, v2, .9)]
        k += 1
    v = tr.sung(notes, attack=2.5, release=3.0, glide=.3, vib=(4.6, .08, 1.5), breath=.06, seed=40 + i,
                formant_glide=1.2)
    pan = (-.45, .45, 0.0)[i]
    voices[0] += v[0] * min(1, 1 - pan); voices[1] += v[1] * min(1, 1 + pan)

# the drone: F2, C3, F3, each breathing on its own prime cycle
th = tr.g.th
drone = tr.bus()
for m, per, ph in ((41, 11.0, 0.0), (48, 13.0, 1.7), (53, 17.0, 3.1)):
    amod = .55 + .45 * np.sin(2 * np.pi * th / per + ph) ** 2
    drone += tr.saw_line([(0.0, m, 146.0)], K=10, cutoff=500, attack=10.0, release=4.0, amod=amod,
                         detune=(-3, 3), pans=(-.4, .4))

piano = norm_rms(piano, -24); bells = norm_rms(bells, -30); voices = norm_rms(voices, -27); drone = norm_rms(drone, -30)
send = piano + .8 * bells + .9 * voices + .3 * drone
hall = tr.reverb(send, hp=180, t60_lo=7.0, t60_hi=3.0, f_lo=400, f_hi=6000, dur=10.0, seed=3, predelay=.045, dark=5000)
echo = tr.delay(piano + .5 * bells, 2.1, fb=.42, reps=6, lp=2500, pingpong=.7)
mix = .8 * piano + .8 * bells + .7 * voices + drone + .55 * norm_rms(hall, rms_ref := -24) + .25 * echo
finish(tr, mix, target=-17.0, fade=(139.0, 148.0),
       sections=[(0, 'loops begin'), (18, 'first voice'), (61, 'all three voices'), (136, 'last strike')],
       notes=f'{strikes} strikes from 7 loops; 3 voice loops; no pulse')
