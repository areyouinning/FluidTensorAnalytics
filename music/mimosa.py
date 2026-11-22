"""Mimosa (MiM0SA) study: "Pink Static". Glitch hop at 100 BPM in F minor.

Assumed method: hard, crunchy breaks with the snare on 2 and 4, a funky talking wobble bass at
8th and 16th rates, chopped vocal shouts, synth stabs, glitch stutters and tape-stop dives at
the ends of phrases.
"""
import numpy as np
from recipes import Song, span

s = Song('mimosa-pink-static', 'Pink Static (after Mimosa)', bpm=100, bars=24, seed=78,
         prog=[[53, 56, 60], [49, 53, 56], [51, 55, 58], [48, 52, 55]])
tr, B = s.tr, s.at
s.stabs('stabs', span(0, 24), [(0, .25, 1.0), (.75, .25, .6), (2.5, .25, .8)],
        lambda m, L: tr.fm(m, .3, ratio=2.0, beta=3.0, tau_b=.05, tau_a=.12), spread=.5)
s.drums('kick', 'X.........X..X..', span(4, 24), tr.kick(hi=170, lo=48, tau_a=.12, p2=.35, click=.35, drive=3), kick=True, swing=.25,
        var=lambda b: 'X..X......X.....' if b % 2 else None)
s.drums('snare', '....X.......X...', span(4, 24), tr.layer(tr.snare(1.15, .07, body=1.3), .5 * tr.clap()), noise=True, swing=.25)
s.drums('hats', 'x.xxx.x.x.xxx.x.', span(4, 24), tr.hat(), vel=.7, noise=True, swing=.25)
shout = [(b, 3.5, 77 if b % 2 else 72, .3, 'a') for b in span(4, 24)] + [(b, 1.75, 75, .2, 'e') for b in span(8, 24)[::2]]
s.melody('vox', shout, sung=dict(attack=.006, release=.05, glide=.01, vib=(5, 0, 1), breath=.15, seed=150, fscale=1.1))
notes = []
for b in span(8, 24):
    r = s.root(b, 29)
    for o, L, iv, c, d in [(0, 1, 0, .5, 0), (1, 1, 0, .25, 0), (2, .5, 12, .125, 0), (2.5, .5, 7, .25, 0), (3, 1, 0, 1 / 6, -12 if b % 4 == 3 else 0)]:
        notes.append((B(b, o), L * tr.beat, r + iv, c * tr.beat, d))
w = tr.womp(notes, s.kick_times, lo=110, hi=3600, growl=1.0, beta_max=6, drive=6, rasp=.4)
s.add('womp', np.stack([w['L'], w['R']])); s.add('sub', w['sub'])
for b in (7, 11, 15, 19, 23):
    s.stutter('snare', B(b, 3), .0625, 16)
s.sections = [(0, 'stabs'), (B(4), 'breaks'), (B(8), 'wobble')]
s.mixdown({'stabs': -25, 'kick': -20, 'snare': -21, 'hats': -32, 'vox': -25, 'womp': -20, 'sub': -22},
          pump=('kick', -3, .12, ['stabs', 'vox']), sends={'stabs': .3, 'vox': .4, 'snare': .2},
          room=dict(t60_lo=1.8, t60_hi=.8, dur=2.5, seed=23, wet=.35),
          delay_sends={'vox': .4}, delay=dict(d_s=.75 * tr.beat, fb=.35, reps=5, lp=4000),
          notes='100 BPM, F minor')
