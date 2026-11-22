"""Outersect study, after "To Take a Single Conscious Breath Without Discursive Thought": "Single Breath".
75 BPM, D Dorian. Psybient as meditation: the whole arrangement breathes, swelling over an in-breath of
four beats, holding for four, letting go over eight, the way a slow breathing practice counts. Under it,
Outersect's dub-rooted downtempo: a round dub bass, a soft broken beat, FM sitar answering a breathy flute,
and long feedback echoes. Written from that approach and the title's idea, not from the record.
"""
import numpy as np
from recipes import Song, span
from kit import PHI

s = Song('outersect-single-breath', 'Single Breath (after Outersect)', bpm=75, bars=18, div=192, seed=403,
         prog=[[50, 57, 62, 65], [48, 55, 60, 64], [50, 57, 62, 65], [55, 59, 62, 66]])
tr, B = s.tr, s.at
cyc = 16 * tr.beat                                                  # in 4, hold 4, out 8 (beats)
u = (tr.t % cyc) / tr.beat
breath = np.where(u < 4, .5 - .5 * np.cos(np.pi * u / 4), np.where(u < 8, 1.0, .5 + .5 * np.cos(np.pi * (u - 8) / 8)))
breath = .35 + .65 * breath
th = tr.g.th; uh = (th % cyc) / tr.beat
bh = .35 + .65 * np.where(uh < 4, .5 - .5 * np.cos(np.pi * uh / 4), np.where(uh < 8, 1.0, .5 + .5 * np.cos(np.pi * (uh - 8) / 8)))
s.pad('pad', span(0, 18), K=20, cutoff=1200, res=4, detune=(-11, 0, 11), attack=2.0, release=3.0, amod=bh)
FL = [(0, 74, 2, 'u'), (2, 72, 1, 'u'), (3, 69, 1, 'u'), (4, 67, 3, 'u'), (7, 69, 1, 'u')]
s.melody('flute', [(b + bt // 4, bt % 4, m + 12, L, v) for b in (4, 8, 12) for bt, m, L, v in FL],
         sung=dict(attack=.08, release=.3, glide=.08, vib=(5.4, .1, .3), breath=.4, seed=430, fscale=1.35, tilt=2.2, formant_glide=.05))
sitar = lambda m, L: tr.layer(tr.fm(m, 1.6, ratio=2.0, beta=2.4, tau_b=.25, tau_a=.7), .3 * tr.fm(m + 12, 1.6, ratio=PHI, beta=1.2, tau_b=.1, tau_a=.35))
SIT = [(0, 62, .5), (.5, 64, .5), (1, 65, 1), (2.5, 64, .5), (3, 62, 1)]
s.melody('sitar', [(b, bt, m, L) for b in (6, 7, 10, 11, 14, 15) for bt, m, L in SIT], inst=sitar, pan=-.35)
s.bass('dub', span(2, 18), [(0, 0, 1.5), (2, 7, .5), (2.5, 12, .5), (3, 10, 1)], kind='sine', lo=26, harm=(1.0, .3), glide=.06)
s.drums('kick', 'X.........X.....', span(4, 16), tr.kick(hi=120, lo=46, tau_a=.16, p2=.25), kick=True)
s.drums('rim', '....x.......x..-', span(4, 16), tr.partials(1800.0, .08, [1, 2.3], [1, .5], [.012, .008]), vel=.6)
s.drums('shaker', 'x-x-x-x-x-x-x-x-', span(6, 16), tr.shaker(), noise=True)
for k in ('pad', 'dub', 'flute', 'sitar'):
    s.buses[k] = s.buses[k] * breath
s.sections = [(0, 'Breathing in'), (B(4), 'The flute'), (B(6), 'Sitar answers'), (B(12), 'The last breath'), (B(16), 'Out')]
s.mixdown({'pad': -24, 'flute': -22, 'sitar': -25, 'dub': -20, 'kick': -22, 'rim': -30, 'shaker': -34},
          sends={'pad': .3, 'flute': .5, 'sitar': .5, 'rim': .4},
          room=dict(t60_lo=4.0, t60_hi=1.6, dur=5.0, seed=43, wet=.55),
          delay_sends={'flute': .4, 'sitar': .55, 'rim': .4}, delay=dict(d_s=.75 * tr.beat, fb=.58, reps=9, lp=2200),
          notes='75 BPM, D Dorian; the arrangement breathes 4 in, 4 hold, 8 out')
