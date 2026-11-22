"""Shpongle study: "Spiral Teahouse". Psybient at 128 BPM in E Phrygian dominant (E F G# A B C D).

Assumed method: a rolling psy bass (kick, then three 16th bass notes, every beat), a breathy flute
carrying an exotic-scale melody, sitar and tabla-like pitched drums, phasing pads, reversed
swells, and a long dub echo on everything that isn't the low end.
"""
import numpy as np
from recipes import Song, span
from kit import PHI

s = Song('shpongle-spiral-teahouse', 'Spiral Teahouse (after Shpongle)', bpm=128, bars=32, div=60, seed=74,
         prog=[[52, 56, 59, 64], [53, 56, 60, 65], [52, 56, 59, 64], [50, 53, 57, 62]])
tr, B = s.tr, s.at
roll = [(q + .25 * k, 0, .2) for q in range(4) for k in (1, 2, 3)]
s.bass('psybass', span(8, 28), roll, kind='saw', cutoff=500, res=5, env=3.0, lo=28, K=30, release=.02)
s.drums('kick', 'X...X...X...X...', span(8, 28), tr.kick(hi=170, lo=48, tau_f=.02, tau_a=.08, p2=.2, click=.3), kick=True)
s.drums('hats', '..x...x...x...x.', span(8, 28), tr.hat(True, .2), noise=True)


def tabla(b, i):
    m = (62, 69, 64, 74)[i % 4]
    n = int(.25 * 48000); t = np.arange(n) / 48000
    f = 440 * 2 ** ((m - 69) / 12) * (1 + .3 * np.exp(-t / .03))
    return tr.endfade(tr.attack(n) * np.exp(-t / .07) * (np.sin(2 * np.pi * np.cumsum(f) / 48000) + .3 * np.sin(2 * np.pi * np.cumsum(2.9 * f) / 48000)))


s.drums('tabla', 'x.ox.xo.x.oxx.o.', span(4, 32), tabla, vel=.6, pan=-.3)
FLUTE = [(0, 76, 1, 'u'), (1, 77, .5, 'u'), (1.5, 76, .5, 'u'), (2, 72, 1, 'u'), (3, 71, 1, 'u'),
         (4, 68, 1.5, 'u'), (5.5, 69, .5, 'u'), (6, 71, 2, 'u')]
s.melody('flute', [(b + bt // 4, bt % 4, m + 12, L, v) for b in (4, 6, 12, 14, 20, 22) for bt, m, L, v in FLUTE],
         sung=dict(attack=.05, release=.2, glide=.06, vib=(5.8, .1, .25), breath=.35, seed=120, fscale=1.35, tilt=2.2,
                   formant_glide=.05))
sitar = lambda m, L: tr.fm(m, 1.4, ratio=2.0, beta=2.5, tau_b=.25, tau_a=.6) + .3 * tr.fm(m + 12, 1.4, ratio=PHI, beta=1.2, tau_b=.1, tau_a=.3)
SIT = [(0, 64, .25), (.25, 65, .25), (.5, 68, .5), (1, 69, .25), (1.25, 68, .25), (1.5, 65, .5), (2, 64, 1)]
s.melody('sitar', [(b, bt + 2 * (b % 2), m, L) for b in span(16, 28) for bt, m, L in SIT], inst=sitar, pan=.35)
phase = .75 + .25 * np.sin(2 * np.pi * .15 * tr.g.th)
s.pad('pad', span(0, 32), K=24, cutoff=1400, res=6, detune=(-14, -3, 6, 15), attack=1.5, release=2.0, amod=phase)
s.sections = [(0, 'pad + tabla'), (B(4), 'flute'), (B(8), 'psy roll'), (B(16), 'sitar'), (B(28), 'float out')]
s.mixdown({'psybass': -21, 'kick': -19, 'hats': -31, 'tabla': -27, 'flute': -22, 'sitar': -25, 'pad': -27, 'swell': -30},
          pump=('kick', -4, .1, ['pad', 'psybass']), sends={'flute': .5, 'sitar': .5, 'tabla': .3, 'pad': .3},
          room=dict(t60_lo=3.5, t60_hi=1.5, dur=4.5, seed=19, wet=.5),
          delay_sends={'flute': .4, 'sitar': .5, 'tabla': .3}, delay=dict(d_s=.75 * tr.beat, fb=.55, reps=8, lp=2800),
          notes='128 BPM, E Phrygian dominant')
