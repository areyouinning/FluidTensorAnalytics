"""Jon Hopkins study: "Breathing Machine".

What makes Hopkins Hopkins, and what this borrows:
  * a kick saturated until it crunches, and everything else breathing around it (deep sidechain);
  * a 16th-note analog bass whose filter opens over minutes, not bars;
  * crackle: micro-glitches (blips, ticks, FM grains) on Euclidean 32nd-note rhythms;
  * a melancholic piano that appears in the breakdown and then rides on top of the noise;
  * a long swell that makes the drop feel like a release rather than a hit.
Ab major (Abmaj9 - Fm9 - Dbadd9 - Eb(add4)), 125 BPM, 48 bars.
"""
import numpy as np
from scipy import signal
from kit import Track, finish, norm_rms, euclid, hz, fft_eq, dirt, SR, PHI

tr = Track('hopkins-breathing-machine', 'Breathing Machine (after Jon Hopkins)', bpm=125, bars=48, tail=2.5, seed=21)
B = tr.at
CH = [[56, 60, 63, 70], [53, 56, 60, 67], [53, 56, 61, 63], [55, 58, 63, 68]]      # 2 bars each
ROOT = [44, 41, 37, 39]
chord_of = lambda bar: bar // 2 % 4

# ------------------------------------------------------------------ drums
KICK = [B(b, q) for b in list(range(0, 16)) + list(range(24, 44)) for q in range(4)]
KICK += [B(22, q) for q in range(4)] + [B(23, q / 2) for q in range(6)]          # the kick returns into the drop
KICK = sorted(KICK)
drums = tr.bus()
k_soft = tr.kick(hi=170, lo=46, tau_f=.03, tau_a=.12, p2=.3, click=.15, drive=3.0)
k_hard = tr.kick(hi=190, lo=44, tau_f=.028, tau_a=.14, p2=.35, click=.25, drive=6.0)
for t0 in KICK:
    drop = t0 >= B(24)
    tr.put(drums, k_hard if drop else k_soft, t0, .95 if drop else .8)
clap = tr.clap()
CLAP = [B(b, q) for b in list(range(8, 16)) + list(range(24, 44)) for q in (1, 3)]
for t0 in CLAP:
    tr.put(drums, clap, t0, .5, noise=True)
hats = tr.bus()
for b in list(range(4, 16)) + list(range(24, 44)):
    for s in range(16):
        acc = (.55, .25, .4, .25)[s % 4] * (1.0 if b >= 8 else .6)
        tr.put(hats, tr.hat(), B(b, s / 4), acc, pan=.25 * np.sin(s * 2.4), noise=True)
    if b >= 8:
        for q in range(4):
            tr.put(hats, tr.hat(True), B(b, q + .5), .3, pan=-.2, noise=True)

# glitch crackle on Euclidean 32nds; density follows the arc
glitch = tr.bus()
dens = lambda b: 3 if b < 4 else 5 if b < 8 else 7 if b < 16 else (2 if b < 20 else 9) if b < 24 else 11 if b < 40 else 4
gi = 0
for b in range(0, 46):
    for s, hit in enumerate(euclid(dens(b), 32, rot=5 * b)):
        if hit:
            kind = ('blip', 'tick', 'grain')[int((gi * PHI) % 1 * 3)]
            tr.put(glitch, tr.glitch(kind, 100 + gi), B(b, s / 8), .25 + .2 * tr.rng.random(),
                   pan=.85 * np.sin(gi * 2.39996), noise=(kind == 'tick'))
            gi += 1

# ------------------------------------------------------------------ bass: 16ths, filter opening over minutes
PAT = [0, 0, 12, 0, 0, 12, 0, 7, 0, 0, 12, 0, 0, 12, 10, 7]
ACC = [1, .6, .9, .6, .8, .9, .6, .8, 1, .6, .9, .6, .8, .9, .8, .9]
bnotes = []
for b in list(range(0, 16)) + list(range(20, 42)):
    r = ROOT[chord_of(b)]
    for s in range(16):
        bnotes.append((B(b, s / 4), r + PAT[s], tr.beat / 4 * .8, ACC[s]))
since = tr.since_onset([n[0] for n in bnotes])
base_cut = tr.lin([(0, 260), (B(8), 650), (B(16), 1500), (B(20), 300), (B(24), 2400), (B(36), 3200),
                   (B(40), 2600), (B(42), 500), (B(48), 400)])
cut = base_cut * (1 + 2.2 * np.exp(-since / .06))
bass = tr.saw_line(bnotes, K=40, cutoff=cut, res=7, detune=(-6, 6), pans=(-.3, .3), attack=.004,
                   release=.03, glide=.004)
sub_notes = [(B(b), ROOT[chord_of(b)] - 12, tr.barlen) for b in list(range(0, 16)) + list(range(22, 42))]
sub = tr.sine_line(sub_notes, attack=.01, release=.1)

# ------------------------------------------------------------------ pad: detuned saws, swell in the break
pad = tr.bus()
pad_cut = tr.lin([(0, 400), (B(8), 900), (B(16), 900), (B(24), 3800), (B(40), 2400), (B(48), 700)])
amod = tr.lin([(0, 0), (B(8), .5), (B(16), .6), (B(23.9), 1.0), (B(24), .85), (B(44), .85), (B(48), .5)])
for v in range(4):
    notes = [(B(b), CH[chord_of(b)][v], 2 * tr.barlen + .1) for b in range(8, 48, 2)]
    pad += tr.saw_line(notes, K=36, cutoff=pad_cut, res=3, detune=(-9, 0, 9), pans=(-.8, 0, .8),
                       attack=.6, release=1.2, glide=.25, amod=amod)

# ------------------------------------------------------------------ piano: the melancholy on top
MOTIF = [(0, 72, 1.5), (1.5, 75, .5), (2, 70, 2), (4, 68, 1), (5, 67, 1), (6, 68, 2),
         (8, 72, 1.5), (9.5, 68, .5), (10, 67, 2), (12, 65, 1), (13, 63, 1), (14, 60, 2),
         (16, 65, 1.5), (17.5, 68, .5), (18, 72, 2), (20, 70, 1), (21, 68, 1), (22, 65, 2),
         (24, 67, 1.5), (25.5, 70, .5), (26, 75, 2), (28, 72, 1), (29, 70, 3)]
piano = tr.bus()
for cyc in (16, 24, 32, 40):
    for off, m, L in MOTIF:
        t0 = B(cyc, off)
        tr.put(piano, tr.piano(m, .55 + .15 * tr.rng.random(), felt=.35), t0, pan=.15)
    for c in range(4):
        r = ROOT[c] - 12 + 24
        for m in (r, r + 7):
            tr.put(piano, tr.piano(m, .5, felt=.5), B(cyc + 2 * c), .7, pan=-.25)

# ------------------------------------------------------------------ build and drop
riser = tr.bus()                                      # risers removed 2026-11-21 (the author)
imp = tr.impact(B(24), crash=.35)

# ------------------------------------------------------------------ mix
drums = norm_rms(drums, -19); hats = norm_rms(hats, -34); glitch = norm_rms(glitch, -33)
bass = norm_rms(bass, -21); sub = norm_rms(sub, -24); pad = norm_rms(pad, -23); piano = norm_rms(piano, -23)
riser = norm_rms(riser, -30); imp = norm_rms(imp, -28)
breath = np.where(tr.t >= B(24), tr.pump(KICK, -8, .2), tr.pump(KICK, -4, .15))
breath = np.where((tr.t >= B(16)) & (tr.t < B(22)), 1.0, breath)
vac = tr.window(B(23, 3), B(24), edge=.03)
drums = drums * (1 - vac) + np.stack([fft_eq(c, SR, [(120, -40), (300, 0)]) for c in drums]) * vac
room = tr.reverb(.6 * piano + .4 * pad + .5 * drums * (tr.t < B(44)) + glitch, hp=300,
                 t60_lo=3.2, t60_hi=1.0, f_lo=500, f_hi=8000, dur=4.5, seed=7)
echo = tr.delay(piano, .75 * tr.beat, fb=.38, reps=6, lp=3500)
mix = (drums + hats + glitch + imp
       + breath * (bass + np.stack([sub, sub]) + pad + .9 * piano + .35 * norm_rms(room, -22) + .3 * echo + riser))
finish(tr, mix, target=-14.0, fade=(B(45), B(48) + 1.5),
       sections=[(0, 'pulse'), (B(8), 'pad + clap'), (B(16), 'piano breakdown'), (B(20), 'swell'),
                 (B(24), 'release'), (B(40), 'closing'), (B(44), 'drums out')],
       notes='125 BPM, Ab major; breath -8 dB in the drop')
