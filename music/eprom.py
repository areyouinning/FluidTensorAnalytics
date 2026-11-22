"""EPROM study: "Servo Bloom". Precision half-time bass at 150 BPM in F minor.

Assumed method: mechanical, surgical sound design - metallic FM bass hits whose index is
automated note by note, a womp with a very high phi-FM index, robotic stutters on exact grid
divisions, drums cut tight with drum & bass precision, and sci-fi pads; every edit on the beat.
"""
import numpy as np
from recipes import Song, span

s = Song('eprom-servo-bloom', 'Servo Bloom (after EPROM)', bpm=150, bars=32, seed=79,
         prog=[[53, 56, 60, 63], [49, 53, 56, 60], [51, 55, 58, 62], [48, 51, 55, 58]])
tr, B = s.tr, s.at
s.pad('pad', span(0, 32), K=20, cutoff=1200, res=8, detune=(-15, 15), attack=1.2, release=1.5)
servo = lambda b, i: tr.fm(s.root(b, 33) + (12 if i % 3 else 0), .22, ratio=1.0 + .5 * (i % 4), beta=4 + i % 5, tau_b=.06, tau_a=.1)
s.drums('servo', 'x..x..x...x.x...', span(8, 16, 24, 32), servo, vel=.8)
s.drums('kick', 'X..........X....', span(8, 32), tr.kick(hi=200, lo=46, tau_f=.018, tau_a=.1, p2=.35, click=.4), kick=True,
        var=lambda b: 'X......X...X..X.' if b % 4 == 3 else None)
s.drums('snare', '........X.......', span(8, 32), tr.layer(tr.snare(1.25, .05, body=1.3), .4 * tr.clap()), noise=True)
s.drums('hats', 'x.x.xxx.x.x.xxxx', span(4, 32), tr.hat(), vel=.6, noise=True)
notes = [(B(b, o), L * tr.beat, s.root(b, 29) + iv, c * tr.beat, d) for b in span(16, 24)
         for o, L, iv, c, d in [(0, .75, 0, .25, 0), (.75, .75, 12, 1 / 6, 0), (1.5, .5, 0, .125, 0), (2, 1, 7, 1 / 3, 0), (3, 1, 0, .125, -12)]]
w = tr.womp(notes, s.kick_times, lo=140, hi=5000, growl=1.6, beta_max=12, drive=9, rasp=.35)
s.add('womp', np.stack([w['L'], w['R']])); s.add('sub', w['sub'])
for b in (11, 15, 19, 23, 27, 31):
    s.stutter('servo' if b < 16 or b >= 24 else 'womp', B(b, 3), 1 / 8, 8)
s.add('impact', tr.impact(B(8), crash=.35) + .7 * tr.impact(B(16), crash=.3) + .7 * tr.impact(B(24), crash=.3))
s.sections = [(0, 'pad'), (B(8), 'servo bass'), (B(16), 'womp at index 12'), (B(24), 'servo again')]
s.mixdown({'pad': -28, 'servo': -22, 'kick': -20, 'snare': -21, 'hats': -32, 'womp': -22, 'sub': -22, 'riser': -29, 'impact': -26},
          pump=('kick', -3, .1, ['pad']), sends={'pad': .3, 'snare': .3, 'servo': .15},
          room=dict(t60_lo=2.0, t60_hi=.7, dur=3.0, seed=24, wet=.35),
          delay_sends={'servo': .2}, delay=dict(d_s=.5 * tr.beat, fb=.3, reps=4, lp=5000),
          notes='150 BPM half-time, F minor')
