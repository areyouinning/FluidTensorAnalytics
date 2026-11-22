"""LUKE study: "Low Light Prayer".

After the LUKE remix of Mr. Probz's "Praying To A God" (the soundtrack's first reference),
as a manner, not a copy: warm melodic deep house, where the voice is the figure and the
groove waits for it.
  * syncopated Rhodes chord stabs (two-operator FM) under a lowpass that opens through the intro;
  * a rolling offbeat bass, side-chained to a soft, round four-on-the-floor kick;
  * a wordless sung lead (glottal source, three moving formants, delayed vibrato) carrying
    a gospel-tinged melody in two four-bar phrases;
  * a break where the voice is left alone in a big room, then a drop of pitched vocal chops
    with the vowels chosen by the golden ratio.
D minor (Dm7 - Bbmaj7 - Fadd9 - Cadd9), 120 BPM, 36 bars.
"""
import numpy as np
from scipy import signal
from kit import Track, finish, norm_rms, hz, fft_eq, SR, PHI

tr = Track('luke-low-light-prayer', 'Low Light Prayer (after LUKE)', bpm=120, bars=36, tail=2.0, seed=41)
B = tr.at
CH = [[57, 60, 62, 65], [57, 58, 62, 65], [55, 57, 60, 65], [55, 60, 62, 64]]
ROOT = [38, 34, 41, 36]
c4 = lambda b: b % 4

# ------------------------------------------------------------------ Rhodes stabs
keys = tr.bus()
STAB = [(0, .9), (.75, .6), (1.5, .75), (2.5, .7), (3.25, .6)]
for b in range(0, 35):
    if 16 <= b < 20 and b != 16:
        offs = [(0, .8)]                                     # the break: one held chord a bar
    else:
        offs = STAB
    for off, v in offs:
        L = 1.8 if len(offs) == 1 else .45
        for j, m in enumerate(CH[c4(b)]):
            tr.put(keys, tr.fm(m, L, ratio=1.0, beta=1.3 * v, tau_b=.22, tau_a=.7 if L > 1 else .35, tine=.1),
                   B(b, off), v * (.9 if j else 1.0), pan=(-.35, -.1, .1, .35)[j])
dark = np.stack([fft_eq(c, SR, [(500, 0), (1500, -24)]) for c in keys])
open_ = tr.sweep([(0, 0), (B(8), 1), (B(36), 1)])
keys = dark * (1 - open_) + keys * open_

# ------------------------------------------------------------------ drums
drums = tr.bus()
kick = tr.kick(hi=120, lo=50, tau_f=.04, tau_a=.16, p2=.18, click=.05)
KICK = [B(b, q) for b in list(range(4, 16)) + list(range(20, 34)) for q in range(4)]
for t0 in KICK:
    tr.put(drums, kick, t0, .9)
for b in list(range(8, 16)) + list(range(20, 32)):
    for q in (1, 3):
        tr.put(drums, tr.clap(), B(b, q), .45, noise=True)
    for q in range(4):
        tr.put(drums, tr.hat(True, .3), B(b, q + .5), .35, pan=.2, noise=True)
for s in range(16):
    tr.put(drums, tr.snare(1.3, .04, body=.6), B(19, s / 4), .15 + .5 * (s / 16) ** 1.5, noise=True)
shk = tr.bus()
for b in range(0, 34):
    if 16 <= b < 19:
        continue
    for s in range(16):
        tr.put(shk, tr.shaker(), B(b, s / 4), (.6, .25, .45, .3)[s % 4], pan=-.3, noise=True)

# ------------------------------------------------------------------ bass: rolling offbeats
BPAT = [(.5, 0, .4), (1.5, 0, .4), (2.5, 12, .2), (2.75, 7, .2), (3.5, 0, .4)]
bn = [(B(b, o), ROOT[c4(b)] + iv, L * tr.beat) for b in list(range(4, 16)) + list(range(20, 34)) for o, iv, L in BPAT]
bass = tr.saw_line(bn, K=14, cutoff=480, res=3, attack=.008, release=.05, glide=.01)
sub = tr.sine_line(bn, attack=.008, release=.05, harm=(1.0, .25))

# ------------------------------------------------------------------ the voice
P1 = [(0, 69, 1.5, 'a'), (1.5, 67, .5, 'o'), (2, 65, 2, 'a'), (4, 62, 1, 'o'), (5, 65, 1, 'a'), (6, 67, 2, 'e'),
      (8, 69, 1, 'a'), (9, 72, 1.5, 'a'), (10.5, 69, .5, 'o'), (11, 67, 1, 'a'), (12, 64, 2, 'u'), (14, 62, 2, 'o')]
P2 = [(0, 69, 1, 'a'), (1, 70, 1, 'a'), (2, 69, 2, 'o'), (4, 65, 1.5, 'a'), (5.5, 67, .5, 'e'), (6, 69, 2, 'a'),
      (8, 72, 1, 'a'), (9, 74, 2, 'a'), (11, 72, 1, 'o'), (12, 69, 1.5, 'a'), (13.5, 67, .5, 'o'), (14, 65, 2, 'u')]
vn = []
for start, ph in ((8, P1), (12, P2), (16, P1), (28, P2)):
    vn += [(B(start, o), m, L * tr.beat * .95, v) for o, m, L, v in ph]
voice = tr.sung(vn, attack=.05, release=.3, glide=.08, vib=(5.2, .2, .3), breath=.05, seed=50)
voice_break = voice * tr.window(B(16), B(20), .05)

# vocal chops: short sung notes on a syncopated 16th grid, vowels picked by phi
CHOP = [0, .75, 1.5, 2, 2.75, 3.5]
cn, gi = [], 0
for b in range(20, 32):
    top = [m + 12 for m in CH[c4(b)]]
    for k, o in enumerate(CHOP):
        m = top[(k * 2 + b) % 4]
        cn.append((B(b, o), m, .2 * tr.beat, 'aoei'[int((gi * PHI) % 1 * 4)], 1.0 if b < 28 else .55)); gi += 1
chops = tr.sung(cn, attack=.006, release=.05, glide=.01, vib=(5, 0, 1), breath=.03, seed=60, formant_glide=.01, K=60)

riser = tr.bus()                                      # risers removed 2026-11-21 (the author)
imp = tr.impact(B(20), crash=.6)

# ------------------------------------------------------------------ mix
keys = norm_rms(keys, -23); drums = norm_rms(drums, -20); shk = norm_rms(shk, -34)
bass = norm_rms(bass, -24); sub = norm_rms(sub, -23); voice = norm_rms(voice, -21); chops = norm_rms(chops, -24)
riser = norm_rms(riser, -30); imp = norm_rms(imp, -30)
pump = tr.pump(KICK, -6, .16)
voice_on = tr.window(B(8), B(32), .05)
keys = keys * (1 - .25 * voice_on)                      # the ground leans back for the figure
room = tr.reverb(.5 * keys + voice + 2.0 * voice_break + .6 * chops + .3 * drums, hp=250,
                 t60_lo=2.8, t60_hi=1.0, f_lo=500, f_hi=8000, dur=4.0, seed=13, predelay=.03)
echo = tr.delay(voice + chops, .75 * tr.beat, fb=.35, reps=6, lp=3500)
mix = (drums + imp + .9 * voice + chops
       + pump * (keys + shk + bass + np.stack([sub, sub]) + .45 * norm_rms(room, -23) + .3 * echo + riser))
finish(tr, mix, target=-14.0, fade=(B(33), B(36) + 1.0),
       sections=[(0, 'keys'), (B(4), 'groove'), (B(8), 'voice'), (B(16), 'break'), (B(20), 'drop: chops'),
                 (B(28), 'voice returns'), (B(32), 'outro')],
       notes='120 BPM, D minor')
