"""Emancipator study: "Cedar Smoke". Downtempo trip-hop at 96 BPM in A minor (Am9 - Fmaj7 - Dm9 - Em7, two bars each).

Assumed method: a swung, dusty breakbeat with ghost snares; Rhodes chords; a bowed-string melody
(here a voice whose formants sit where a violin body resonates) answered by piano; a deep round
bass; a bed of soft room tone.
"""
from recipes import Song, span

s = Song('emancipator-cedar-smoke', 'Cedar Smoke (after Emancipator)', bpm=96, bars=24, bpc=2, div=240, seed=63,
         prog=[[57, 60, 64, 67, 71], [53, 57, 60, 64], [50, 53, 57, 60, 64], [52, 55, 59, 62]])
tr, B = s.tr, s.at
s.stabs('rhodes', span(0, 24), [(0, 1.5, .9), (1.5, .5, .5), (2.5, 1.5, .7)],
        lambda m, L: tr.fm(m, L + .4, ratio=1.0, beta=.9, tau_b=.3, tau_a=.9, tine=.06), spread=.4)
STR = [(0, 76, 2), (2, 74, 1), (3, 72, 1), (4, 71, 3), (7, 69, 1), (8, 72, 2), (10, 74, 1), (11, 76, 1), (12, 77, 3), (15, 76, 1)]
mel = [(b + bt // 4, bt % 4, m, L, 'a') for b in (8, 16) for bt, m, L in STR]
s.melody('strings', mel, sung=dict(attack=.18, release=.4, glide=.12, vib=(5.6, .16, .25), breath=.1, seed=90,
                                   fscale=1.55, tilt=1.0, formant_glide=.2))
PIA = [(0, 64, .5), (.5, 67, .5), (1, 71, 1), (2, 69, .5), (2.5, 67, .5), (3, 64, 1)]
s.melody('piano', [(b, bt, m + 12, L) for b in span(12, 16, 20, 24) for bt, m, L in PIA],
         inst=lambda m, L: tr.piano(m, .45, felt=.4))
s.bass('bass', span(4, 22), [(0, 0, 1.5), (2.75, 0, .5), (3.25, 7, .75)], kind='sine', lo=33, harm=(1.0, .35, .1))
s.drums('kick', 'X.......-.X.....', span(4, 22), tr.kick(hi=120, lo=50, tau_a=.13, p2=.3, drive=1.5), kick=True, swing=.4)
s.drums('snare', '....X..-.-..X..-', span(4, 22), tr.snare(.9, .07, body=1.1), noise=True, swing=.4)
s.drums('hats', 'x.x.x.xxx.x.x.x.', span(4, 22), tr.hat(), noise=True, swing=.4)
s.add('room', tr.noise(tr.N, 200, 6000, .8, seed=95) * .02)
s.sections = [(0, 'rhodes'), (B(4), 'beat'), (B(8), 'strings'), (B(12), 'piano answer'), (B(16), 'strings again')]
s.mixdown({'rhodes': -24, 'strings': -22, 'piano': -26, 'bass': -22, 'kick': -21, 'snare': -23, 'hats': -32, 'room': -44},
          pump=('kick', -2, .2, ['rhodes']), sends={'rhodes': .3, 'strings': .6, 'piano': .5, 'snare': .2},
          room=dict(t60_lo=3.0, t60_hi=1.2, dur=4.0, seed=8, wet=.45),
          lofi=[(5000, 0), (10000, -6), (15000, -20)], notes='96 BPM, A minor, swing .4 of a 16th')
