"""Render an 8-bar demo through the whole chain and check it. Run this first in a new environment.

    python selftest.py [out_dir]

Bars 1-4: melody over an arpeggio. Beat 4 of bar 4 is the vacuum. Bars 5-8 (from 8.000 s):
a deep womp bass, the drop kick and four on the floor. Checks:
  * the transform round-trips: a known sine is found in the right bin at about A/2
  * the length is exact, and every event is on the grid
  * the clean render has 0 stray clicks, and a deliberately clicky copy (hard-gated notes) has many,
    which proves the detector works
  * the slam across the drop is positive and the master hits -14 LUFS with TP <= -1.0
"""
import json, os, sys, tempfile
import numpy as np, soundfile as sf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bst import Grid, hz, lowpass_w, bump_w, carve_w
from master import fft_eq, dirt, mono_below, master_to, ramp
from listen import census, punch

out_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(tempfile.gettempdir(), 'synthaesthesia_selftest')
os.makedirs(out_dir, exist_ok=True)
SR, BPM, DROP = 48000, 120, 8.0
g = Grid(SR, BPM, 16.0, 96)
rng = np.random.default_rng(7)
ok = True
def check(name, cond, detail):
    global ok; ok &= bool(cond); print(f'[{"OK" if cond else "FAIL"}] {name}: {detail}')

# ---- 1. transform round trip
x = .5 * np.sin(2 * np.pi * float(hz(69)) * np.arange(g.N) / SR)
p, C = g.analyze(x)
i = int(np.argmax(C[:, g.NH // 2])); lvl = float(C[i, g.NH // 2])
check('round trip', abs(p[i] - 69) < .34 and abs(lvl - .25) < .05, f'peak bin MIDI {p[i]:.2f}, level {lvl:.3f} (expect ~0.25)')

# ---- 2. score (C - Am - F - G), all on the grid
chords = [[48, 52, 55, 60], [45, 48, 52, 57], [41, 45, 48, 53], [43, 47, 50, 55]]
ARP = [(b * 2 + k * .25, chords[b % 4][k % 4] + 12 * (k // 4 % 2), .22) for b in range(8) for k in range(8)]
MEL = [(t, m, L) for t, m, L in [(0, 72, 1), (1, 76, 1), (2, 77, .5), (2.5, 76, .5), (3, 72, 1), (4, 74, 1.5), (5.5, 71, .5),
                                (6, 72, 2), (8, 79, 1), (9, 76, 1), (10, 77, 1), (11, 74, 1), (12, 76, 2), (14, 72, 1.5)]]
KICK = [t * .5 for t in range(0, 16)] + [7.5 + k * .125 for k in range(4)] + [8 + .5 * k for k in range(16)]
KICK = sorted(set(KICK))
g.assert_on_grid([e[0] for e in ARP + MEL] + KICK)
check('on grid', True, f'{len(ARP) + len(MEL) + len(KICK)} events, hop {g.H} samples')

# ---- 3. voices
mel_p = g.pitch_hops(MEL); mel_a = g.env_hops(MEL, release_s=.08, sustain=.55)
mel = g.synth_voice(hz(mel_p), np.array([1, .18, .12, .05])[:, None] * mel_a[None, :])
arp_p = g.pitch_hops(ARP, .02); arp_a = g.env_hops(ARP)
ks = np.arange(1, 41)[:, None]; fk = ks * hz(arp_p)[None, :]
W = lowpass_w(fk, 2200) * bump_w(fk, 2200, 5, .2) / ks * carve_w(fk, hz(mel_p), np.clip(mel_a / .5, 0, 1))
arp = g.synth_voice(hz(arp_p), W * arp_a[None, :])

# womp bass from 8 s: roots C1.., two womps per beat-pair, fast open / slow close
roots = [24, 21 + 12, 17 + 12, 19 + 12]
BASS = [(8 + b * 2 + k * .5, roots[b % 4] if roots[b % 4] < 36 else roots[b % 4] - 12, .5) for b in range(4) for k in range(4)]
b_p = g.pitch_hops(BASS, .03); b_a = g.env_hops(BASS, release_s=.03) * (g.th >= DROP)
u = np.mod((g.th - DROP) / .5, 1.0); ru = .15
shape = np.where(u < ru, .5 - .5 * np.cos(np.pi * u / ru), ((1 - u) / (1 - ru)) ** 1.3)
kb = np.arange(1, 91)[:, None]; fb = kb * hz(b_p)[None, :]
fc = 80 * (3500 / 80) ** shape
Wb = (1 / kb) * lowpass_w(fb, fc[None, :]) * bump_w(fb, fc[None, :], 8, .2) * carve_w(fb, hz(arp_p), np.clip(arp_a / .5, 0, 1), partials=6)
bass = g.synth_voice(hz(b_p), Wb * b_a[None, :]) + 1.2 * g.synth_voice(hz(b_p), b_a[None, :])
bl, br = dirt(bass, bass, SR, 4.0)

t = np.arange(int(.5 * SR)) / SR
kf = 50 + 150 * np.exp(-t / .022)
kick1 = g.attack(len(t)) * np.exp(-t / .085) * (np.sin(2 * np.pi * np.cumsum(kf) / SR) + .3 * np.sin(4 * np.pi * np.cumsum(kf) / SR))
kick = g.hit(kick1, KICK, [.5 if k < DROP else .8 for k in KICK])
vac = ramp(SR, g.N, 7.42, DROP, edge=.04)            # the vacuum: the lows drain for the last beat
kick = kick * (1 - vac) + fft_eq(kick, SR, [(120, -40), (300, 0)]) * vac

# ---- 4. mix and master
L = .5 * mel + .35 * arp + 1.4 * bl + kick
R = .5 * mel + .35 * arp + 1.4 * br + kick
mix = mono_below(np.stack([L, R]), SR)
mix *= np.clip((16.0 - np.arange(g.N) / SR) / 1.0, 0, 1)    # 1 s fade to zero at the end
wav = os.path.join(out_dir, 'selftest.wav')
r = master_to(mix, SR, wav, -14.0, -1.6)
check('loudness', abs(r['lufs'] + 14) <= .2, f"{r['lufs']} LUFS"); check('true peak', r['tp'] <= -1.0, f"{r['tp']} dBTP")
y, _ = sf.read(wav)
check('length', len(y) == g.N, f'{len(y)} samples')

onsets = [e[0] for e in ARP + MEL + BASS] + KICK + list(np.arange(DROP, 16, .5))
n, s = census(wav, onsets, verbose=False)
check('clean render: no stray clicks', n == 0, f'{n} stray' + (f' at {s[:5]}' if n else ''))
# deliberately clicky copy: hard-gate the arpeggio every 3/16 note, off the score grid
gate = (np.floor(np.arange(g.N) / (SR * .1875 + 37)) % 2).astype(float)
bad = os.path.join(out_dir, 'selftest_clicky.wav')
sf.write(bad, (y * (1 - .9 * gate)[:, None]), SR, subtype='PCM_24')
n_bad, _ = census(bad, onsets, verbose=False)
check('detector sees clicks', n_bad >= 10, f'{n_bad} stray in the hard-gated copy')
pu = punch(wav, DROP, KICK, 15.0)
check('slam across the drop', pu['slam <250 Hz'] > 6, f"{pu['slam <250 Hz']:+.1f} dB (vacuum {pu['vacuum <250 Hz (dBFS)']:.1f} dBFS), chest {pu['chest 50-250 Hz']:+.1f} dB")
print(f"limiter: {100 * r['limiter'][0]:.1f} % of the time > 1 dB, max {r['limiter'][1]:.1f} dB")
print('\n' + ('ALL CHECKS PASS' if ok else 'SOME CHECKS FAILED') + f'  ->  {wav}')
sys.exit(0 if ok else 1)
