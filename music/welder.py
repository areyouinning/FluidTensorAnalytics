"""Welder study, after "Purple and Orange": "Violet Hour". 80 BPM, F minor (Fm9 - Dbmaj7 - Ab - Eb6).

Welder is Brendan Angelides's song alias (he is also Eskmo): a soft, close falsetto voice carried on
warm keys, slow soulful harmony, and Eskmo's handmade percussion (water drops, wood, paper) under a
gentle half-time beat. Written from that approach, not from the record; the voice here is wordless.
"""
import numpy as np
from recipes import Song, span
from kit import euclid

s = Song('welder-violet-hour', 'Violet Hour (after Welder)', bpm=80, bars=20, div=144, seed=402,
         prog=[[53, 60, 63, 67, 68], [49, 56, 60, 65], [44, 60, 63, 67], [51, 58, 60, 63, 67]])
tr, B = s.tr, s.at
s.stabs('keys', span(0, 20), [(0, 2.5, .8), (2.5, 1.5, .55)], lambda m, L: tr.fm(m, L + .6, ratio=1.0, beta=.8, tau_b=.3, tau_a=1.2, tine=.05), spread=.35)
s.pad('pad', span(4, 20), K=20, cutoff=1400, res=2, detune=(-8, 8), attack=1.0, release=1.6, voices=(1, 2, 3))
VOX = [(0, 79, 1.5, 'o'), (1.5, 77, .5, 'u'), (2, 75, 2, 'o'), (4, 72, 1, 'a'), (5, 75, 1, 'o'), (6, 77, 2, 'u'),
       (8, 80, 1.5, 'a'), (9.5, 79, .5, 'o'), (10, 77, 2, 'u'), (12, 75, 1.5, 'o'), (13.5, 72, .5, 'u'), (14, 72, 2, 'o')]
s.melody('voice', [(b + bt // 4, bt % 4, m, L, v) for b in (4, 8, 14) for bt, m, L, v in VOX],
         sung=dict(attack=.09, release=.45, glide=.12, vib=(5.2, .14, .4), breath=.16, seed=420, fscale=1.12, formant_glide=.1))


def drop(m):
    n = int(.12 * 48000); t = np.arange(n) / 48000
    f = 440 * 2 ** ((m - 69) / 12) * (1 + 1.2 * (1 - np.exp(-t / .02)))
    return tr.endfade(tr.attack(n) * np.exp(-t / .03) * np.sin(2 * np.pi * np.cumsum(f) / 48000))


fol, gi = tr.bus(), 0
for b in span(2, 20):
    for name, k, rot, v in (('drop', 5, 1, .5), ('wood', 3, 4, .45), ('paper', 7, 2, .3)):
        for i, hit in enumerate(euclid(k, 16, rot=rot + b)):
            if hit:
                x = drop(77 + (gi * 5) % 12) if name == 'drop' else tr.fm(74, .08, ratio=2.76, beta=3.0, tau_b=.01, tau_a=.02) if name == 'wood' else tr.endfade(tr.noise(2400, 2000, 9000, .2) * np.exp(-np.arange(2400) / 600))
                tr.put(fol, x, B(b, i / 4), v, pan=.8 * np.sin(gi * 2.39996), noise=(name == 'paper')); gi += 1
s.add('foley', fol)
s.bass('sub', span(4, 20), [(0, 0, 2.5), (2.75, 7, .5), (3.25, 12, .75)], kind='sine', lo=29, harm=(1.0, .35), glide=.08)
s.drums('kick', 'X.........X.....', span(4, 18), tr.kick(hi=110, lo=46, tau_a=.17, p2=.25), kick=True, swing=.3)
s.drums('snare', '........X.......', span(4, 18), tr.snare(.85, .1, body=1.0), noise=True, swing=.3)
s.sections = [(0, 'Warm keys'), (B(2), 'Handmade percussion'), (B(4), 'The voice'), (B(8), 'Second verse, the voice climbs higher'), (B(14), 'Last line, then the keys alone')]
s.mixdown({'keys': -23, 'pad': -27, 'voice': -20, 'foley': -28, 'sub': -21, 'kick': -21, 'snare': -24},
          pump=('kick', -3, .25, ['keys', 'pad']), sends={'keys': .35, 'voice': .5, 'foley': .4, 'pad': .3},
          room=dict(t60_lo=2.8, t60_hi=1.1, dur=4.0, seed=42, wet=.5),
          delay_sends={'voice': .35, 'foley': .25}, delay=dict(d_s=.75 * tr.beat, fb=.4, reps=6, lp=3200),
          notes='80 BPM, F minor; after Welder, "Purple and Orange" (method, not the record)')
