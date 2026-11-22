"""Eliot Lipp study: "Glasshouse Funk". Analog synth funk / instrumental hip-hop at 96 BPM in F minor.

Assumed method: heavily swung MPC-style drums; jazzy synth chords (Fm9 - Bbm9 - Ebmaj9 - C7#9)
with a slow filter; a gliding square-wave synth bass; a portamento lead that sings like an old
monosynth; a bright arp for the lift.
"""
from recipes import Song, span

s = Song('eliotlipp-glasshouse-funk', 'Glasshouse Funk (after Eliot Lipp)', bpm=96, bars=24, div=240, seed=66,
         prog=[[53, 56, 60, 63, 67], [58, 61, 65, 68, 72], [51, 55, 58, 62, 65], [48, 52, 58, 63]])
tr, B = s.tr, s.at
s.stabs('keys', span(0, 24), [(0, .75, 1.0), (.75, .5, .6), (2.5, .5, .8), (3.25, .5, .6)],
        lambda m, L: tr.fm(m, L + .2, ratio=1.0, beta=1.4, tau_b=.12, tau_a=.4), spread=.5)
s.lowpass_sweep('keys', [(0, .25), (B(8), .9), (B(16), .6), (B(20), 1.0)])
s.bass('bass', span(4, 24), [(0, 0, .75), (.75, 12, .25), (1.5, 0, .5), (2.5, 10, .5), (3, 7, .5), (3.5, 5, .5)],
       kind='square', cutoff=700, res=6, env=2.5, lo=29, glide=.06)
LEAD = [(0, 72, .5), (.5, 75, .5), (1, 77, 1), (2.5, 79, .5), (3, 80, .5), (3.5, 79, .5),
        (4, 77, 1.5), (5.5, 75, .5), (6, 72, 2)]
lead = [(b + bt // 4, bt % 4, m, L) for b in span(8, 16)[::2] for bt, m, L in LEAD]
s.add('lead', tr.saw_line([(B(b, bt), m, L * tr.beat * .95) for b, bt, m, L in lead], K=30, cutoff=2400, res=5,
                          square=.4, detune=(-5, 5), attack=.01, release=.15, glide=.09))
s.arp('arp', span(16, 24), lambda m, L: tr.pluck(m, .3, bright=.8), rate=.25, order=(0, 1, 2, 3, 4, 3, 2, 1), octave=12, vel=.5)
s.drums('kick', 'X.....X...X..X..', span(4, 24), tr.kick(hi=120, lo=50, tau_a=.12, p2=.3, drive=2), kick=True, swing=.55)
s.drums('snare', '....X.......X...', span(4, 24), tr.snare(.95, .08, body=1.1), noise=True, swing=.55)
s.drums('hats', 'x.x.x.x.x.x.x.xx', span(4, 24), tr.hat(), noise=True, swing=.55)
s.sections = [(0, 'keys'), (B(4), 'beat + bass'), (B(8), 'lead'), (B(16), 'arp')]
s.mixdown({'keys': -24, 'bass': -21, 'lead': -23, 'arp': -28, 'kick': -20, 'snare': -23, 'hats': -32},
          pump=('kick', -2, .15, ['keys']), sends={'keys': .3, 'lead': .3, 'snare': .25},
          room=dict(t60_lo=1.8, t60_hi=.8, dur=3.0, seed=11, wet=.35),
          delay_sends={'lead': .35, 'arp': .4}, delay=dict(d_s=.75 * tr.beat, fb=.35, reps=6, lp=3500),
          notes='96 BPM, F minor, swing .55 of a 16th')
