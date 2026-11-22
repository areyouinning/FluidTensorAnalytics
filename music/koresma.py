"""Koresma study: "Compass Rose". Electro-acoustic downtempo at 100 BPM in C major (Cmaj9 - Am9 - Fmaj9 - G6).

From descriptions of his sound ("chilled electro-acoustic music centered around a strong drum
groove"): picked acoustic-guitar figures, a tight, punchy groove with shakers, warm bass, glassy
bell keys, and space for each part.
"""
from recipes import Song, span

s = Song('koresma-compass-rose', 'Compass Rose (after Koresma)', bpm=100, bars=24, seed=76,
         prog=[[48, 55, 59, 62, 64], [45, 52, 55, 59, 60], [41, 48, 52, 55, 57], [43, 50, 52, 55, 59]])
tr, B = s.tr, s.at
guitar = lambda m, L: .55 * (tr.pluck(m, 1.0, bright=.2) + tr.pluck(m + .06, 1.0, bright=.22))
s.arp('guitar', span(0, 24), guitar, rate=.25, order=(0, 2, 1, 3, 2, 4, 3, 1), octave=12, vel=.55, pan_spread=.25)
GLASS = [(0, 79, .5), (.5, 76, .5), (1, 74, 1), (2, 76, .5), (2.5, 79, .5), (3, 81, 1)]
s.melody('glass', [(b, bt, m, L) for b in span(8, 16, 18, 24) for bt, m, L in GLASS], inst=lambda m, L: tr.bell(m, 2.0, bright=.9), pan=.3)
s.bass('bass', span(4, 24), [(0, 0, .75), (1.5, 0, .25), (1.75, 7, .5), (2.5, 12, .5), (3.25, 7, .5)], kind='sine', lo=33, harm=(1.0, .45, .2))
s.drums('kick', 'X.....X.X.....x.', span(4, 24), tr.kick(hi=140, lo=52, tau_a=.11, p2=.3, click=.25, drive=1.5), kick=True, swing=.2)
s.drums('snare', '....X.......X...', span(4, 24), tr.layer(tr.snare(1.05, .07, body=1.2), .4 * tr.clap()), noise=True, swing=.2)
s.drums('shaker', 'xoxoxoxoxoxoxoxo', span(2, 24), tr.shaker(), noise=True, swing=.2)
s.drums('hats', '..x...x...x...x.', span(8, 24), tr.hat(True, .2), vel=.6, noise=True, swing=.2)
s.sections = [(0, 'guitar'), (B(4), 'groove'), (B(8), 'glass keys'), (B(16), 'breath'), (B(18), 'return')]
s.mixdown({'guitar': -23, 'glass': -26, 'bass': -21, 'kick': -20, 'snare': -23, 'shaker': -32, 'hats': -32},
          pump=('kick', -2, .15, ['guitar']), sends={'guitar': .35, 'glass': .5, 'snare': .25},
          room=dict(t60_lo=2.2, t60_hi=1.0, dur=3.0, seed=21, wet=.4),
          delay_sends={'glass': .5, 'guitar': .2}, delay=dict(d_s=.75 * tr.beat, fb=.4, reps=6, lp=4000),
          notes='100 BPM, C major')
