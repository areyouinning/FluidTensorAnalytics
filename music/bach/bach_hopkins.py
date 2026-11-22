"""Bach, Prelude in C (BWV 846), after Jon Hopkins. 125 BPM; one Bach bar = one bar.

The Prelude plays on felt piano, every note, in Bach's rhythm. Under it, Hopkins's machinery: a
16th-note bass on each bar's lowest note whose filter opens over minutes; a crunchy kick from bar 5
with everything breathing around it; glitch crackle on Euclidean rhythms; a pad and clap from bar 17.
Bach's long G pedal (bars 24-31) is the swell: the kick leaves, the pad opens and grows, and the kick
comes back in quarters, then eighths. The release lands on Bach's bar 32 and loops his last four bars twice
with the breath at -8 dB, then the final C rings.
"""
import os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path[:0] = [HERE, os.path.dirname(HERE)]
from recipes import Song, span
from kit import PHI, euclid, fft_eq, SR
from score import bars as score_bars, chords

BB, CH = score_bars(), chords()
SONG = list(range(31)) + [31 + (k % 4) for k in range(8)] + [34, 34]        # song bar -> Bach bar (0-based)
prog = [CH[k][:5] for k in SONG]
s = Song('bach-hopkins', 'Prelude in C (after Jon Hopkins)', bpm=125, bars=len(SONG), prog=prog, seed=302, tail=3.0)
tr, B = s.tr, s.at
NB = len(SONG)

piano = tr.bus()
for sb, kb in enumerate(SONG):
    if sb >= 40:
        continue
    for beat, m, L in BB[kb]:
        rel = beat - 4 * kb
        vel = (.5 if sb < 16 else .58 if sb < 31 else .7) + .1 * tr.rng.random()
        tr.put(piano, tr.piano(m, vel, felt=.35), tr.snap(B(sb, rel)), pan=.12)
for j, m in enumerate(CH[34]):
    tr.put(piano, tr.piano(m, .7, felt=.4), B(39) + .02 * j, pan=.12)
s.add('piano', piano)

bass_bars = list(range(4, 24)) + list(range(29, 39))
PAT = [0, 0, 12, 0, 0, 12, 0, 7, 0, 0, 12, 0, 0, 12, 10, 7]
bn = [(B(b, q / 4), 28 + (CH[SONG[b]][0] - 28) % 12 + 12 + PAT[q], tr.beat / 4 * .8, (1, .6, .9, .6)[q % 4]) for b in bass_bars for q in range(16)]
since = tr.since_onset([n[0] for n in bn])
cut = tr.lin([(0, 250), (B(8), 500), (B(16), 1100), (B(24), 300), (B(29), 800), (B(31), 2600), (B(37), 3200), (B(39), 600)]) * (1 + 2.2 * np.exp(-since / .06))
s.add('bass', tr.saw_line(bn, K=40, cutoff=cut, res=7, detune=(-6, 6), pans=(-.3, .3), attack=.004, release=.03, glide=.004))
s.add('sub', tr.sine_line([(B(b), 28 + (CH[SONG[b]][0] - 28) % 12, tr.barlen) for b in bass_bars], attack=.01, release=.1))

k_soft = tr.kick(hi=170, lo=46, tau_f=.03, tau_a=.12, p2=.3, click=.15, drive=3.0)
k_hard = tr.kick(hi=190, lo=44, tau_f=.028, tau_a=.14, p2=.35, click=.25, drive=6.0)
KB = list(range(4, 24)) + list(range(31, 39))
drums = tr.bus()
for b in KB:
    for q in range(4):
        tr.put(drums, k_hard if b >= 31 else k_soft, B(b, q), .95 if b >= 31 else .8); s.kick_times.append(B(b, q))
for t0 in [B(28, q) for q in range(4)] + [B(29, q) for q in range(4)] + [B(30, q / 2) for q in range(8)]:
    tr.put(drums, k_soft, t0, .8); s.kick_times.append(t0)
for b in list(range(16, 24)) + list(range(31, 39)):
    for q in (1, 3):
        tr.put(drums, tr.clap(), B(b, q), .5, noise=True)
s.add('drums', drums)
hats = tr.bus()
for b in list(range(8, 24)) + list(range(31, 39)):
    for q in range(16):
        tr.put(hats, tr.hat(), B(b, q / 4), (.55, .25, .4, .25)[q % 4], pan=.25 * np.sin(q * 2.4), noise=True)
s.add('hats', hats)
glitch, gi = tr.bus(), 0
for b in range(0, NB - 1):
    d = 3 if b < 4 else 5 if b < 16 else 7 if b < 24 else 2 if b < 29 else 11 if b < 39 else 3
    for q, hit in enumerate(euclid(d, 32, rot=5 * b)):
        if hit:
            kind = ('blip', 'tick', 'grain')[int((gi * PHI) % 1 * 3)]
            tr.put(glitch, tr.glitch(kind, 400 + gi), B(b, q / 8), .25 + .2 * tr.rng.random(), pan=.85 * np.sin(gi * 2.39996), noise=(kind == 'tick')); gi += 1
s.add('glitch', glitch)
amod = tr.lin([(0, 0), (B(16), .45), (B(24), .6), (B(30.9), 1.0), (B(31), .85), (B(39), .85), (B(NB), .5)])
s.pad('pad', span(16, NB), K=36, cutoff=tr.lin([(B(16), 900), (B(30.9), 3800), (B(31), 2600), (B(NB), 700)]), res=3,
      detune=(-9, 0, 9), attack=.6, release=1.2, glide=.25, amod=amod)
s.add('impact', tr.impact(B(31), crash=.35))
breath = np.where(tr.t >= B(31), tr.pump(s.kick_times, -8, .2), tr.pump(s.kick_times, -4, .15))
breath = np.where((tr.t >= B(24)) & (tr.t < B(28)), 1.0, breath)
s.buses['bass'] *= breath; s.buses['pad'] *= breath; s.buses['piano'] *= np.where(tr.t >= B(31), tr.pump(s.kick_times, -3, .2), 1.0)
vac = tr.window(B(30, 3), B(31), edge=.03)
s.buses['drums'] = s.buses['drums'] * (1 - vac) + np.stack([fft_eq(c, SR, [(120, -40), (300, 0)]) for c in s.buses['drums']]) * vac
s.sections = [(0, 'Bach on felt piano'), (B(4), 'The pulse'), (B(16), 'Pad and clap'), (B(24), 'The G pedal swell'), (B(31), 'Release'), (B(39), 'The last chord')]
s.mixdown({'piano': -21, 'bass': -22, 'sub': -25, 'drums': -19, 'hats': -34, 'glitch': -33, 'pad': -24, 'riser': -29, 'impact': -28},
          sends={'piano': .5, 'pad': .35, 'glitch': .5, 'drums': .2},
          room=dict(t60_lo=3.2, t60_hi=1.0, f_lo=500, f_hi=8000, dur=4.5, seed=7, wet=.45),
          delay_sends={'piano': .25}, delay=dict(d_s=.75 * tr.beat, fb=.35, reps=6, lp=3500),
          fade=(B(40), B(41) + 2.5), notes='125 BPM, C major; every note of BWV 846, bars 32-35 looped twice for the release')
