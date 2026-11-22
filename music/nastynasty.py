"""nastynasty study: "Moon Teeth". Dark bass / trap at 150 BPM half-time, C minor.

Assumed method (Saturate! Records bass): sparse, heavy 808s that are also the bassline, metallic
FM bass hits, trap hats with triplet rolls, a dark pad and bell, and a switch-up halfway with a
growling womp.
"""
import numpy as np
from recipes import Song, span
from kit import PHI

s = Song('nastynasty-moon-teeth', 'Moon Teeth (after nastynasty)', bpm=150, bars=32, seed=67,
         prog=[[48, 51, 55, 58], [44, 48, 51, 55], [46, 50, 53, 57], [43, 47, 50, 53]])
tr, B = s.tr, s.at
s.pad('pad', span(0, 32), K=20, cutoff=800, detune=(-12, 12), attack=1.0, release=1.5, octave=0)
s.arp('bell', span(0, 8, 24, 32), lambda m, L: tr.fm(m, 1.2, ratio=3.5, beta=1.8, tau_b=.1, tau_a=.5), rate=.5,
      order=(0, 3, 2, 1, 3, 2), octave=24, vel=.4)


def eight08(m, L):
    n = int((L + .05) * 48000); t = np.arange(n) / 48000
    f = 440 * 2 ** ((m - 69) / 12) * (1 + 1.4 * np.exp(-t / .02))
    y = np.exp(-t / 1.0) * np.sin(2 * np.pi * np.cumsum(f) / 48000)
    y = np.tanh(2.6 * y) / np.tanh(2.6)
    return tr.endfade(y * tr.attack(n), .03)


PAT = [(0, 0, 1.5), (1.75, 0, .5), (2.5, 3, .75), (3.25, -2, .75)]
b808 = tr.bus()
for b in span(8, 16, 24, 32):
    for bt, iv, L in PAT:
        t0 = B(b, bt); tr.put(b808, eight08(s.root(b, 24) + iv, L * tr.beat), t0); s.kick_times.append(t0)
s.add('808', b808)
metal = lambda b, i: tr.fm(s.root(b, 36) + 12, .25, ratio=1.414, beta=6.0, tau_b=.05, tau_a=.12)
s.drums('metal', '..x.......x...x.', span(8, 16, 24, 32), metal, vel=.6)
s.drums('snare', '........X.......', span(8, 32), tr.layer(tr.clap(), tr.snare(1.2, .07)), noise=True)
s.drums('hats', 'x.x.x.x.x.x.x.x.', span(4, 32), tr.hat(), noise=True,
        var=lambda b: 'x.x.x.xxx.x.xxxx' if b % 2 else None)
roll = tr.bus()
for b in span(8, 32)[1::2]:
    for k in range(6):
        tr.put(roll, tr.hat(), B(b, 3 + k / 6), .35 + .06 * k, pan=-.3 + .12 * k, noise=True)
s.add('roll', roll)
notes = [(B(b, o), L * tr.beat, s.root(b, 24) + iv, c * tr.beat, d) for b in span(16, 24)
         for o, L, iv, c, d in [(0, 1.5, 0, 1 / 3, 0), (1.5, 1, 0, .25, 0), (2.5, 1, 12, 1 / 6, -12), (3.5, .5, 0, .5, 0)]]
w = tr.womp(notes, s.kick_times, lo=90, hi=3800, growl=1.3, beta_max=9, drive=8, rasp=.5)
s.add('womp', np.stack([w['L'], w['R']])); s.add('wsub', w['sub'])
s.add('impact', tr.impact(B(8), crash=.4) + .7 * tr.impact(B(16), crash=.3))
s.sections = [(0, 'dark pad + bell'), (B(8), '808 drop'), (B(16), 'womp switch-up'), (B(24), '808 again')]
s.mixdown({'pad': -28, 'bell': -28, '808': -18, 'metal': -28, 'snare': -21, 'hats': -32, 'roll': -32, 'womp': -19,
           'wsub': -22, 'riser': -29, 'impact': -26},
          pump=('808', -3, .2, ['pad', 'bell']), sends={'bell': .5, 'snare': .35, 'metal': .3},
          room=dict(t60_lo=2.2, t60_hi=.8, dur=3.0, seed=12, wet=.4),
          delay_sends={'bell': .4, 'metal': .3}, delay=dict(d_s=.75 * tr.beat, fb=.4, reps=6, lp=3000),
          notes='150 BPM half-time, C minor')
