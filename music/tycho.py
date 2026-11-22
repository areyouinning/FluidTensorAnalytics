"""Tycho study: "Coastline Hours". Sunlit downtempo at 100 BPM in D major (Dmaj9 - Bm9 - Gmaj9 - A6, two bars each).

Assumed method: warm detuned pads and a delayed arpeggio as the bed; a picked, slightly chorused
guitar-like line as the voice; live-feeling drums (kick on 1 and the and-of-2, light swing);
a round bass; tape warmth (a soft top end and saturation); a gliding mono lead for the lift.
"""
from recipes import Song, span

s = Song('tycho-coastline-hours', 'Coastline Hours (after Tycho)', bpm=100, bars=24, bpc=2, seed=62,
         prog=[[62, 66, 69, 73, 76], [59, 62, 66, 69, 73], [55, 59, 62, 66, 69], [57, 61, 64, 66, 69]])
tr, B = s.tr, s.at
s.pad('pad', span(0, 24), K=24, cutoff=1400, detune=(-14, -5, 5, 14), attack=1.2, release=1.5, voices=range(4))
s.arp('arp', span(0, 12, 16, 24), lambda m, L: tr.pluck(m, .5, bright=.6), rate=.5, order=(0, 2, 1, 3, 4, 3, 2, 1),
      octave=12, vel=.6)
MOT = [(0, 78, 1.5), (1.5, 76, .5), (2, 74, 2), (4, 73, 1), (5, 74, 1), (6, 76, 2)]
MOT2 = [(0, 81, 1), (1, 78, 1), (2, 76, 1.5), (3.5, 74, .5), (4, 73, 2), (6, 69, 2)]
mel = [(b + (bt // 4), bt % 4, m, L) for b, mot in ((4, MOT), (6, MOT2), (8, MOT), (10, MOT2)) for bt, m, L in mot]
guitar = lambda m, L: .5 * (tr.pluck(m, 1.2, bright=.18) + tr.pluck(m + .07, 1.2, bright=.2))
s.melody('guitar', mel, inst=guitar, pan=.2)
lead = [(b + (bt // 4), bt % 4, m + 12, L) for b, mot in ((16, MOT), (18, MOT2), (20, MOT), (22, MOT2)) for bt, m, L in mot]
s.add('lead', tr.saw_line([(B(b, bt), m, L * tr.beat * .95) for b, bt, m, L in lead], K=30, cutoff=2600, res=4,
                          detune=(-6, 6), attack=.02, release=.25, glide=.08))
s.bass('bass', span(4, 12, 14, 24), [(0, 0, 1.5), (1.5, 0, .5), (2, 7, 1), (3, 12, .5), (3.5, 10, .5)],
       kind='sine', lo=38, harm=(1.0, .4, .15))
s.drums('kick', 'X.....x.X.......', span(4, 12, 16, 24), tr.kick(hi=110, lo=52, tau_a=.14, p2=.3), kick=True, swing=.15)
s.drums('snare', '....X.......X...', span(4, 12, 16, 24), tr.snare(.95, .09, body=1.0), noise=True, swing=.15)
s.drums('hats', 'x-o-x-o-x-o-x-ox', span(4, 12, 14, 24), tr.hat(), noise=True, swing=.15)
s.sections = [(0, 'pad + arp'), (B(4), 'guitar'), (B(12), 'breath'), (B(16), 'lead')]
s.mixdown({'pad': -25, 'arp': -26, 'guitar': -22, 'lead': -23, 'bass': -22, 'kick': -21, 'snare': -24, 'hats': -32},
          pump=('kick', -3, .2, ['pad', 'arp']),
          sends={'pad': .3, 'arp': .4, 'guitar': .5, 'lead': .4, 'snare': .3},
          room=dict(t60_lo=2.8, t60_hi=1.3, dur=4.0, seed=7, wet=.5),
          delay_sends={'arp': .6, 'guitar': .4, 'lead': .3}, delay=dict(d_s=.75 * tr.beat, fb=.45, reps=7, lp=3000),
          lofi=[(6000, 0), (11000, -6), (16000, -18)], notes='100 BPM, D major')
