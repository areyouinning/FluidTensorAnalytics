"""Avicii study: "Brighter Than Morning". Progressive house at 128 BPM in A minor (Am-F-C-G).

From what is known of his method (no reference transcribed yet): one syncopated hook,
stated first on bare piano, then filtered and built, then dropped on a wide supersaw doubled
by the piano; a deep sidechain pump on everything but the kick; offbeat bass; a snare roll into the drop.
"""
import numpy as np
from recipes import Song, span

s = Song('avicii-brighter-than-morning', 'Brighter Than Morning (after Avicii)', bpm=128, bars=32,
         prog=[[57, 60, 64], [57, 60, 65], [55, 60, 64], [55, 59, 62]], div=60, seed=61)
tr, B = s.tr, s.at
HOOK = [[(0, 76, .75), (.75, 76, .75), (1.5, 74, .5), (2, 72, .75), (2.75, 72, .75), (3.5, 74, .5)],
        [(0, 72, .75), (.75, 72, .75), (1.5, 69, .5), (2, 72, .75), (2.75, 74, .75), (3.5, 76, .5)],
        [(0, 79, .75), (.75, 79, .75), (1.5, 76, .5), (2, 74, .75), (2.75, 72, .75), (3.5, 74, .5)],
        [(0, 74, .75), (.75, 71, .75), (1.5, 74, .5), (2, 79, 1.5), (3.5, 76, .5)]]
hook = lambda bars: [(b, bt, m, L) for b in bars for bt, m, L in HOOK[b % 4]]

s.melody('piano', hook(span(0, 8, 28, 32)), inst=lambda m, L: tr.piano(m, .75))
s.melody('pluck', hook(span(8, 16)), inst=lambda m, L: tr.pluck(m, .5, bright=.35))
s.lowpass_sweep('pluck', [(B(8), .1), (B(15.5), 1.0)])
lead = s.tr.saw_line([(B(b, bt), m, L * tr.beat * .9) for b, bt, m, L in hook(span(16, 28))], K=40, cutoff=6000,
                     detune=(-22, -11, -4, 4, 11, 22), pans=(-.9, -.5, -.15, .15, .5, .9), attack=.004, release=.08, glide=.01)
s.add('saw', lead)
s.melody('piano_dbl', hook(span(16, 28)), inst=lambda m, L: tr.piano(m + 12, .8))
s.pad('chords', span(16, 28), K=36, cutoff=4500, detune=(-15, -5, 5, 15), attack=.02, release=.25, octave=-12)
s.bass('bass', span(16, 28), [(.5, 0, .4), (1.5, 0, .4), (2.5, 0, .4), (3.5, 0, .4)], cutoff=500, lo=33)
s.bass('sub', span(16, 28), [(0, 0, 4)], kind='sine', lo=33, harm=(1.0,))

k = tr.kick(hi=150, lo=48, tau_f=.03, tau_a=.12, p2=.25, click=.25)
s.drums('kick', 'X...X...X...X...', span(4, 14, 16, 30), k, kick=True)
s.drums('clap', '....X.......X...', span(16, 28), tr.clap(), noise=True)
s.drums('hats', '--x---x---x---x-', span(8, 14, 16, 30), lambda b, i: tr.hat(i % 4 == 2), noise=True)
s.drums('roll', 'x.x.x.x.x.x.x.x.', [14], tr.snare(1.2, .05), vel=.5, noise=True)
s.drums('roll', 'xxxxxxxxxxxxxxxx', [15], tr.snare(1.4, .04), vel=.75, noise=True)
s.add('impact', tr.impact(B(16), crash=.6))
s.sections = [(0, 'piano hook'), (B(8), 'build'), (B(16), 'drop'), (B(28), 'piano again')]
s.mixdown({'piano': -22, 'pluck': -24, 'saw': -20, 'piano_dbl': -26, 'chords': -27, 'bass': -23, 'sub': -24,
           'kick': -19, 'clap': -27, 'hats': -32, 'roll': -28, 'riser': -28, 'impact': -28},
          pump=('kick', -9, .16, ['saw', 'piano_dbl', 'chords', 'bass', 'sub', 'pluck', 'hats']),
          sends={'piano': .5, 'saw': .4, 'pluck': .5, 'clap': .3},
          room=dict(t60_lo=2.6, t60_hi=1.2, dur=3.5, seed=6, wet=.45),
          delay_sends={'pluck': .4, 'saw': .2}, delay=dict(d_s=.75 * tr.beat, fb=.3, reps=5, lp=5000),
          notes='128 BPM, A minor')
