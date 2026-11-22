"""Splatinum study: "Golden Wobble".

The talking wobble the author asked for in the soundtrack, given a track of its own: half-time
150 BPM, an eerie golden-ratio FM bell arpeggio, a snare-roll build into a vacuum, then
two drops.
  Drop A (bars 16-24): womp-womp-womp phrases whose LFO rate changes beat by beat
  (1/1, 1/2, 1/3, 1/4 beat), octave stabs that dive, and a stop before each downbeat.
  Drop B (bars 24-32): riddim. Triplet womps hammering one root, harder growl
  (phi-FM index to 9), and Euclidean / Fibonacci grains panned by the golden angle.
G minor (Gm - Gm - Eb - F), roots at G1-F1 (39-49 Hz). 36 bars, 60 s.
"""
import numpy as np
from kit import Track, finish, norm_rms, euclid, hz, fft_eq, SR, PHI

tr = Track('splatinum-golden-wobble', 'Golden Wobble (after Splatinum)', bpm=150, bars=36, tail=2.4, seed=31)
B = tr.at
CH = [[55, 58, 62], [55, 58, 62], [55, 58, 63], [57, 60, 65]]
ROOT = [31, 31, 27, 29]
cyc4 = lambda b: b % 4

# ------------------------------------------------------------------ intro / build voices
arp = tr.bus()
arp_cut = tr.sweep([(0, .35), (B(8), .6), (B(15.75), 1.0), (B(16), .45), (B(32), .6), (B(36), .3)])
for b in list(range(0, 16)) + list(range(32, 35)):
    c = CH[cyc4(b)]
    pool = [m + 12 for m in c] + [m + 24 for m in c]
    for s, idx in enumerate([0, 1, 2, 3, 4, 3, 2, 1]):
        t0 = B(b, s / 2)
        tr.put(arp, tr.fm(pool[idx], .6, ratio=PHI, beta=2.2, tau_b=.07, tau_a=.22), t0,
               .55 + .1 * (s == 0), pan=.5 * np.sin(s * 2.39996))
arp *= arp_cut
pad = tr.bus()
for v in range(3):
    notes = [(B(b), CH[cyc4(b)][v], tr.barlen + .05) for b in list(range(0, 16)) + list(range(32, 36))]
    pad += tr.saw_line(notes, K=30, cutoff=tr.lin([(0, 500), (B(15), 1800), (B(16), 600), (B(36), 500)]),
                       res=4, detune=(-10, 10), attack=.3, release=.6, glide=.15)

# ------------------------------------------------------------------ drums
drums = tr.bus()
kick = tr.kick(hi=200, lo=45, tau_f=.022, tau_a=.11, p2=.35, click=.3)
snare = lambda tune=1.0: tr.snare(tune=tune, tau=.07, body=1.2)
KICK = [B(b) for b in range(4, 12)]
KICK += [B(b, q) for b in range(12, 15) for q in range(4)] + [B(15, q / 2) for q in range(6)]
for b in range(16, 32):
    KICK += [B(b), B(b, 2.5 if b % 2 == 0 else 1.75)]
    if b >= 24 and b % 4 == 3:
        KICK += [B(b, 3.5)]
KICK = sorted(KICK)
for t0 in KICK:
    tr.put(drums, kick, t0, .6 if t0 < B(12) else .8 if t0 < B(16) else 1.0)
SN = [B(b, 2) for b in range(16, 32)]
ROLL = ([B(b, q) for b in (8, 9) for q in range(4)] + [B(b, q / 2) for b in (10, 11) for q in range(8)]
        + [B(b, q / 4) for b in (12, 13) for q in range(16)] + [B(14, q / 8) for q in range(32)] + [B(15, q / 8) for q in range(24)])
for i, t0 in enumerate(ROLL):
    u = (t0 - B(8)) / (B(15, 3) - B(8))
    tr.put(drums, snare(1 + .7 * u), t0, .3 + .6 * u ** 1.3, noise=True)
for t0 in SN:
    tr.put(drums, snare(), t0, 1.0, noise=True)
for t0 in [B(31, 2 + q / 3) for q in range(1, 6)]:
    tr.put(drums, snare(1.1), t0, .6, noise=True)
hats = tr.bus()
for b in list(range(4, 15)) + list(range(16, 32)):
    for e in range(8):
        tr.put(hats, tr.hat(), B(b, e / 2), (.5 if e % 2 else .3) * (.6 if b < 16 else 1), pan=.3, noise=True)

# ------------------------------------------------------------------ the bass
PAT_A = [(0, 1, 0, 1, 0), (1, 1, 0, .5, 0), (2, 1, 0, 1 / 3, 0), (3, .5, 12, .25, -12)]      # stop on the last eighth
PAT_B = [(0, 1.5, 0, .75, 0), (1.5, .5, 7, .25, 0), (2, 1, 0, .5, -12), (3, 1, 0, 1 / 6, 0)]
RID_1 = [(0, 1, 0, 1 / 3, 0), (1, 1, 0, 1 / 3, 0), (2, .5, 12, 1 / 6, 0), (2.5, .5, 0, 1 / 3, 0), (3, .5, 0, 1 / 3, -7)]
RID_2 = [(0, 1.5, 0, .5, 0), (1.5, 1, 0, 1 / 3, 0), (2.5, .5, 12, 1 / 6, -12), (3, .5, 3, .25, 0)]
wn = []
for b in range(16, 32):
    pat = (PAT_A if b % 2 == 0 else PAT_B) if b < 24 else (RID_1 if b % 2 == 0 else RID_2)
    for off, L, iv, cyc, dive in pat:
        wn.append((B(b, off), L * tr.beat, ROOT[cyc4(b)] + iv, cyc * tr.beat, dive))
wn.append((B(32), 2.4, ROOT[0], tr.beat, -12))                    # one last dive under the outro
drop_a = [n for n in wn if n[0] < B(24)]
drop_b = [n for n in wn if n[0] >= B(24)]
wa = tr.womp(drop_a, KICK, growl=1.0, beta_max=7, drive=6, rasp=.35)
wb = tr.womp(drop_b, KICK, hi=4200, growl=1.3, beta_max=9, drive=8, rasp=.45)
bassL, bassR, sub = wa['L'] + wb['L'], wa['R'] + wb['R'], wa['sub'] + wb['sub']

# ear candy: Fibonacci hits on Euclidean 16ths, chord tones by a Weyl sequence, golden-angle pans
candy = tr.bus(); gi = 0
for b in range(18, 32):
    pool = [m + 12 for m in CH[cyc4(b)]] + [m + 24 for m in CH[cyc4(b)]]
    for s, hit in enumerate(euclid([3, 5, 8, 5][b % 4], 16, rot=3 * b)):
        if hit:
            m = pool[int((gi * PHI) % 1 * len(pool))]
            tr.put(candy, tr.fm(m, .09, ratio=PHI, beta=3, tau_b=.015, tau_a=.03), B(b, s / 4), .5,
                   pan=.8 * np.sin(gi * 2.39996)); gi += 1

riser = tr.bus()                                      # risers removed 2026-11-21 (the author)
imp = tr.impact(B(16), crash=.5) + .6 * tr.impact(B(24), crash=.35)

# ------------------------------------------------------------------ mix
drums = norm_rms(drums, -19); hats = norm_rms(hats, -32); arp = norm_rms(arp, -25); pad = norm_rms(pad, -28)
bass = norm_rms(np.stack([bassL, bassR]), -17); sub = norm_rms(sub, -20); candy = norm_rms(candy, -33)
riser = norm_rms(riser, -26); imp = norm_rms(imp, -24)
vac = tr.window(B(15, 3), B(16), edge=.03)
drums = drums * (1 - vac) + np.stack([fft_eq(c, SR, [(150, -40), (300, 0)]) for c in drums]) * vac
duck = tr.pump(KICK, -3, .12)
room = tr.reverb(arp + .4 * pad + .3 * drums * (tr.t < B(32)) + candy, hp=300, t60_lo=2.4, t60_hi=.8, dur=3.5, seed=9)
echo = tr.delay(arp + candy, .75 * tr.beat, fb=.35, reps=5, lp=4000)
mix = drums + imp + duck * (hats + arp + pad + .35 * norm_rms(room, -24) + .3 * echo + candy + riser + bass + np.stack([sub, sub]))
finish(tr, mix, target=-14.0, fade=(B(33), B(36) + 1.0),
       sections=[(0, 'bells'), (B(8), 'the roll'), (B(16), 'drop A'), (B(24), 'drop B: riddim'), (B(32), 'outro')],
       notes='150 BPM half-time, G minor')
