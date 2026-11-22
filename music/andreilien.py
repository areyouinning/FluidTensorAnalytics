"""Andreilien study: "Log Time". Psychedelic glitch bass at 80 BPM (half-time feel), E minor.

For the author's memory of the Andreilien (then Heyoka) show at Mighty, with a log-time waveform projected over the
stage: the fills here are LOG-TIME rolls. Hits fall at t_k = T * (1 - r^k), a geometric series
that accelerates into the downbeat like a bouncing ball, so their spacing is even on a log axis
of time-to-downbeat. Around them: crisp half-time drums, a squelching mid-bass (womp with a
phi-FM growl), liquid FM bells, granular stutters and pitch dives.
"""
import numpy as np
from recipes import Song, span
from kit import PHI

s = Song('andreilien-log-time', 'Log Time (after Andreilien)', bpm=80, bars=20, div=144, seed=65,
         prog=[[52, 55, 59, 62], [48, 52, 55, 59], [50, 54, 57, 62], [47, 50, 54, 57]])
tr, B = s.tr, s.at
s.arp('bells', span(0, 20), lambda m, L: tr.fm(m, .9, ratio=PHI, beta=2.0, tau_b=.08, tau_a=.4), rate=.25,
      order=(0, 2, 4, 1, 3, 5, 2, 6), octave=12, vel=.5)
s.lowpass_sweep('bells', [(0, .2), (B(4), .7), (B(8), .5), (B(12), 1.0), (B(20), .6)])
s.drums('kick', 'X..........X....', span(4, 20), tr.kick(hi=180, lo=44, tau_f=.02, tau_a=.11, p2=.35, click=.4), kick=True,
        var=lambda b: 'X......X...X....' if b % 2 else None)
s.drums('snare', '........X.......', span(4, 20), tr.snare(1.1, .06, body=1.2), noise=True)
s.drums('hats', 'x.x.x.x.x.xxx.x.', span(4, 20), tr.hat(), vel=.6, noise=True)
# log-time rolls: 12 hits at T(1 - r^k) before each phrase's downbeat, snapped to the hop grid
roll = tr.bus()
for b in (7, 11, 15, 19):
    T, end = 2 * tr.beat, B(b + 1)
    for k in range(12):
        t = end - T * (.68 ** k)
        tr.put(roll, tr.snare(1.0 + .06 * k, .03, body=.6), tr.snap(t), .3 + .05 * k, pan=.6 * np.sin(k * 2.4), noise=True)
s.add('roll', roll)
notes = []
for b in span(4, 20):
    r = s.root(b, 28)
    cyc = [.5, 1 / 3, .25, 1 / 6][b % 4] * tr.beat
    notes += [(B(b), 1.5 * tr.beat, r, cyc, 0), (B(b, 2), tr.beat, r + 12, cyc, -12 if b % 2 else 0),
              (B(b, 3), .5 * tr.beat, r + 7, .25 * tr.beat, 0)]
w = tr.womp(notes, [t for t in s.kick_times], lo=120, hi=4200, growl=1.4, beta_max=8, drive=7, rasp=.5, sub=1.0)
s.add('womp', np.stack([w['L'], w['R']])); s.add('sub', w['sub'])
for b in (9, 13, 17):
    s.stutter('womp', B(b, 3), .125, 8)
s.sections = [(0, 'liquid bells'), (B(4), 'drop'), (B(7, 2), 'log-time roll'), (B(12), 'bells open')]
s.mixdown({'bells': -25, 'kick': -21, 'snare': -22, 'hats': -32, 'roll': -28, 'womp': -23, 'sub': -24},
          pump=('kick', -4, .12, ['bells']), sends={'bells': .5, 'snare': .3, 'roll': .4},
          room=dict(t60_lo=2.5, t60_hi=1.0, dur=3.5, seed=10, wet=.4),
          delay_sends={'bells': .4}, delay=dict(d_s=.75 * tr.beat, fb=.4, reps=6, lp=4000),
          notes='80 BPM half-time, E minor; log-time rolls r = 0.68')
