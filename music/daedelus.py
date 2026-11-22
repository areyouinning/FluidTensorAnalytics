"""Daedelus study: "Paper Orchestra". Broken-beat sample collage at 96 BPM in Bb major.

Assumed method: a dandy's orchestra run through a sampler and a grid controller - harp and piano
phrases chopped and retriggered live, a wheezing accordion-like reed (a saw with bellows
tremolo), plucked strings, a swung, stumbling beat that drops out and lurches back, and
stutter edits as punctuation.
"""
import numpy as np
from recipes import Song, span

s = Song('daedelus-paper-orchestra', 'Paper Orchestra (after Daedelus)', bpm=96, bars=24, div=240, seed=68,
         prog=[[58, 62, 65, 69], [55, 58, 62, 65], [51, 55, 58, 62], [53, 57, 60, 63]])
tr, B = s.tr, s.at
harp = lambda m, L: tr.layer(tr.pluck(m, 1.5, bright=.12), .4 * tr.pluck(m + 12, 1.0, bright=.2))
s.arp('harp', span(0, 24), harp, rate=1 / 3, order=(0, 1, 2, 3, 5, 6, 7, 6, 5, 3, 2, 1), octave=0, vel=.6)
bellows = .7 + .3 * np.sin(2 * np.pi * 5.2 * tr.g.th) ** 2
s.pad('reed', span(4, 12, 16, 24), K=30, cutoff=2400, res=5, detune=(-8, 0, 9), attack=.15, release=.3,
      voices=(1, 2, 3), amod=bellows)
TUNE = [(0, 77, .5), (.5, 74, .5), (1, 70, 1), (2, 72, .5), (2.5, 74, .5), (3, 77, 1)]
s.melody('piano', [(b, bt, m, L) for b in span(8, 16, 20, 24) for bt, m, L in TUNE], inst=lambda m, L: tr.piano(m, .6))
s.bass('bass', span(4, 24), [(0, 0, .5), (1, 7, .5), (2, 12, .5), (3, 7, .5)], kind='sine', lo=34, harm=(1.0, .5, .2))
s.drums('kick', 'X.....X..X......', span(4, 11, 12, 24), tr.kick(hi=115, lo=52, tau_a=.12, p2=.3, drive=2.5), kick=True, swing=.5,
        var=lambda b: 'X..X......X..X..' if b % 3 == 2 else None)
s.drums('snare', '....X.......X..x', span(4, 11, 12, 24), tr.snare(1.05, .06, body=.9), noise=True, swing=.5)
s.drums('hats', 'x.xx.x.xx.x.xx.x', span(4, 24), tr.hat(), vel=.7, noise=True, swing=.5)
for b, name, sl, n in ((7, 'harp', .25, 8), (11, 'piano', 1 / 6, 12), (15, 'harp', .125, 16), (19, 'piano', .25, 8), (23, 'harp', 1 / 12, 24)):
    s.stutter(name, B(b, 2), sl, n)
s.sections = [(0, 'harp'), (B(4), 'reed + beat'), (B(8), 'piano'), (B(11), 'the beat stumbles'), (B(16), 'all')]
s.mixdown({'harp': -24, 'reed': -26, 'piano': -23, 'bass': -23, 'kick': -21, 'snare': -24, 'hats': -32},
          pump=('kick', -2, .15, ['reed']), sends={'harp': .5, 'piano': .4, 'reed': .3, 'snare': .3},
          room=dict(t60_lo=2.4, t60_hi=1.0, dur=3.5, seed=13, wet=.45),
          delay_sends={'harp': .3}, delay=dict(d_s=2 / 3 * tr.beat, fb=.35, reps=5, lp=3500),
          lofi=[(7000, 0), (12000, -5), (17000, -15)], notes='96 BPM, Bb major, swing .5')
