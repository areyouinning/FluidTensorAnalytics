"""Bach, Prelude in C (BWV 846), after Splatinum. 150 BPM half-time; one Bach bar = one bar.

Every note of the Prelude plays, in Bach's own rhythm, on golden-ratio FM bells. Around it: a dark
pad on each bar's chord; a snare roll through bars 9-16; a vacuum, then drop A on
bars 17-24, where a talking womp bass sits on Bach's lowest note of each bar; drop B, where Bach's
eight-bar G pedal (bars 24-31) becomes a riddim of triplet womps hammering G; then Bach's own
cadence (bars 32-35) on bells over one last diving sub.
"""
import os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path[:0] = [HERE, os.path.dirname(HERE)]
from recipes import Song, span
from kit import PHI, fft_eq, SR
from score import notes, chords

N, CH = notes(), chords()
prog = [CH[k][:5] for k in range(35)] + [CH[34][:5]] * 2
s = Song('bach-splatinum', 'Prelude in C (after Splatinum)', bpm=150, bars=37, prog=prog, seed=301, tail=2.4)
tr, B = s.tr, s.at
low = lambda k: CH[min(k, 34)][0]
root = lambda k: 28 + (low(k) - 28) % 12

bells = tr.bus()
for beat, m, L in N:
    bar = int(beat // 4)
    vel = .6 if bar < 16 else (.34 if bar < 32 else .6)
    tr.put(bells, tr.fm(m + 12, .55, ratio=PHI, beta=2.2, tau_b=.07, tau_a=.24), tr.snap(beat * tr.beat), vel, pan=.45 * np.sin(m * 2.39996))
for b in (35, 36):
    for j, m in enumerate(CH[34]):
        tr.put(bells, tr.fm(m + 12, 1.6, ratio=PHI, beta=1.6, tau_b=.1, tau_a=.8), B(b) + .03 * j, .5)
s.add('bells', bells)
s.pad('pad', span(0, 37), K=24, cutoff=tr.lin([(0, 500), (B(15), 1600), (B(16), 600), (B(37), 450)]), res=4, detune=(-10, 10), attack=.25, release=.6, glide=.12)

kick = tr.kick(hi=200, lo=45, tau_f=.022, tau_a=.11, p2=.35, click=.3)
snare = lambda tune=1.0: tr.snare(tune=tune, tau=.07, body=1.2)
KICK = [B(b) for b in range(4, 12)] + [B(b, q) for b in range(12, 15) for q in range(4)] + [B(15, q / 2) for q in range(6)]
for b in range(16, 32):
    KICK += [B(b), B(b, 2.5 if b % 2 == 0 else 1.75)] + ([B(b, 3.5)] if b >= 24 and b % 4 == 3 else [])
drums = tr.bus()
for t0 in sorted(KICK):
    tr.put(drums, kick, t0, .6 if t0 < B(12) else .8 if t0 < B(16) else 1.0); s.kick_times.append(t0)
ROLL = ([B(b, q) for b in (8, 9) for q in range(4)] + [B(b, q / 2) for b in (10, 11) for q in range(8)]
        + [B(b, q / 4) for b in (12, 13) for q in range(16)] + [B(14, q / 8) for q in range(32)] + [B(15, q / 8) for q in range(24)])
for t0 in ROLL:
    u = (t0 - B(8)) / (B(15, 3) - B(8))
    tr.put(drums, snare(1 + .7 * u), t0, .3 + .6 * u ** 1.3, noise=True)
for b in range(16, 32):
    tr.put(drums, snare(), B(b, 2), 1.0, noise=True)
hats = tr.bus()
for b in list(range(4, 15)) + list(range(16, 32)):
    for e in range(8):
        tr.put(hats, tr.hat(), B(b, e / 2), (.5 if e % 2 else .3) * (.6 if b < 16 else 1), pan=.3, noise=True)
s.add('drums', drums); s.add('hats', hats)

A = [(0, 1, 0, 1, 0), (1, 1, 0, .5, 0), (2, 1, 0, 1 / 3, 0), (3, .5, 12, .25, -12)]
Bp = [(0, 1.5, 0, .75, 0), (1.5, .5, 7, .25, 0), (2, 1, 0, .5, -12), (3, 1, 0, 1 / 6, 0)]
R1 = [(0, 1, 0, 1 / 3, 0), (1, 1, 0, 1 / 3, 0), (2, .5, 12, 1 / 6, 0), (2.5, .5, 0, 1 / 3, 0), (3, .5, 0, 1 / 3, -7)]
R2 = [(0, 1.5, 0, .5, 0), (1.5, 1, 0, 1 / 3, 0), (2.5, .5, 12, 1 / 6, -12), (3, .5, 3, .25, 0)]
wn = []
for b in range(16, 32):
    pat = (A if b % 2 == 0 else Bp) if b < 24 else (R1 if b % 2 == 0 else R2)
    for off, L, iv, cyc, dive in pat:
        wn.append((B(b, off), L * tr.beat, root(b) + iv, cyc * tr.beat, dive))
wn.append((B(32), 2.4, root(32), tr.beat, -12))
wa = tr.womp([n for n in wn if n[0] < B(24)], s.kick_times, growl=1.0, beta_max=7, drive=6, rasp=.35)
wb = tr.womp([n for n in wn if n[0] >= B(24)], s.kick_times, hi=4200, growl=1.3, beta_max=9, drive=8, rasp=.45)
s.add('bass', np.stack([wa['L'] + wb['L'], wa['R'] + wb['R']])); s.add('sub', wa['sub'] + wb['sub'])
s.add('impact', tr.impact(B(16), crash=.5) + .6 * tr.impact(B(24), crash=.35))
vac = tr.window(B(15, 3), B(16), edge=.03)
s.buses['drums'] = s.buses['drums'] * (1 - vac) + np.stack([fft_eq(c, SR, [(150, -40), (300, 0)]) for c in s.buses['drums']]) * vac
s.sections = [(0, 'Bach on golden bells'), (B(8), 'The roll'), (B(16), 'Drop A'), (B(24), 'Drop B: the G pedal as riddim'), (B(32), "Bach's cadence")]
s.mixdown({'bells': -24, 'pad': -28, 'drums': -19, 'hats': -32, 'bass': -17, 'sub': -20, 'riser': -26, 'impact': -24},
          pump=('kick', -3, .12, ['bells', 'pad', 'hats']), sends={'bells': .45, 'pad': .3, 'drums': .15},
          room=dict(t60_lo=2.4, t60_hi=.8, dur=3.5, seed=9, wet=.4),
          delay_sends={'bells': .3}, delay=dict(d_s=.75 * tr.beat, fb=.35, reps=5, lp=4000),
          fade=(B(35.5), B(37) + 1.5), notes='150 BPM half-time, C major; every note of BWV 846')
