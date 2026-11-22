"""Clams Casino study: "Cloud Hymn".

Cloud rap as Clams Casino shaped it, written from what is known of his method (no reference
audio was transcribed for this first pass):
  * the voice as texture: a pitched-down sung hook (formants lowered 15 %, so it sounds slowed),
    a wordless choir pad, both drowned in a long hall, with reversed reverb swells breathing in
    before each phrase;
  * an 808 that is both kick and bass: long decay, saturation, slides between notes;
  * swung hats (58.3 % = 7/12 of the beat) with 16th-triplet and 32nd rolls, and a clap + snare on
    2 and 4 under a big bright plate;
  * haze: tape wow on everything melodic (two slow sines on a variable delay), a darkened top,
    soft saturation and a bed of hiss;
  * a tape stop into the outro.
Bb minor (Bbm9 - Gbmaj7 - Dbadd9 - Fm7), 75 BPM (150 half-time feel), 24 bars.
"""
import numpy as np
from scipy import signal
from kit import Track, finish, norm_rms, hz, fft_eq, dirt, SR, PHI

tr = Track('clams-cloud-hymn', 'Cloud Hymn (after Clams Casino)', bpm=75, bars=24, tail=3.2, div=192, seed=51)
B = tr.at
CH = [[53, 56, 60, 61], [53, 54, 58, 61], [53, 56, 61, 63], [51, 56, 60, 63]]
ROOT = [34, 30, 37, 29]
c4 = lambda b: b % 4
SW8 = 7 / 12                     # swung offbeat 8th, in beats (on the grid: 112 of 192 hops)
DRUMS = list(range(4, 12)) + list(range(14, 22))

# ------------------------------------------------------------------ the voice: hook, choir, reverse swells
HOOK = [(0, 77, .75, 'a'), (1, 75, .5, 'o'), (1.5, 73, 1.5, 'a'), (3.5, 72, .5, 'u'),
        (4, 73, 1, 'a'), (5.25, 70, 1.25, 'o'), (7, 68, 1, 'u')]
HOOK_B = [(0, 77, .75, 'a'), (1, 80, .5, 'a'), (1.5, 77, 1.5, 'o'), (3.5, 75, .5, 'u'),
          (4, 73, 1, 'a'), (5.25, 72, 1.25, 'o'), (7, 70, 1, 'u')]
phr = [(b, HOOK if b % 4 == 0 else HOOK_B) for b in list(range(0, 12, 2)) + list(range(14, 24, 2))]
hn = []
for b, ph in phr:
    for o, m, L, v in ph:
        hn.append((B(b, o), m, L * tr.beat * .92, v, .65 if b < 4 else 1.0))
hook = tr.sung(hn, attack=.03, release=.35, glide=.05, vib=(4.8, .12, .25), breath=.08, seed=70, fscale=.85, formant_glide=.05)

choir = tr.bus()
for v in range(4):
    notes = [(B(b), CH[c4(b)][v] + (12 if v == 3 else 0) - 12 * (v == 0), tr.barlen + .1, 'ao'[(b + v) % 2], .8) for b in range(0, 24)]
    x = tr.sung(notes, attack=.9, release=1.5, glide=.25, vib=(4.3, .07, .6), breath=.05, seed=80 + v, fscale=.82, formant_glide=.6, K=50)
    pan = (-.7, -.25, .25, .7)[v]
    choir[0] += x[0] * min(1, 1 - pan); choir[1] += x[1] * min(1, 1 + pan)

# reversed reverb swells: each phrase's first second, drowned, flipped, ending on the phrase
hall_ir = tr.ir(t60_lo=4.5, t60_hi=2.0, f_lo=400, f_hi=6000, dur=3.0, seed=17, predelay=.0)
swell = tr.bus()
for b, _ in phr:
    if b in (0, 12, 13):
        continue
    i0 = int(B(b) * SR); seg = hook[0, i0:i0 + int(.9 * SR)]
    wet = signal.fftconvolve(seg, hall_ir)[:int(2.4 * SR)][::-1].copy()
    wet = tr.endfade(wet * tr.attack(len(wet), 20), .04)
    s = max(0, i0 - len(wet)); wet = wet[len(wet) - (i0 - s):]
    swell[:, s:i0] += wet
    tr.onsets.append(B(b))

# ------------------------------------------------------------------ 808, drums
def eight08(m, L, slide_to=None):
    n = int((L + .05) * SR); t = np.arange(n) / SR
    f0 = float(hz(m)); f = f0 * (1 + 1.2 * np.exp(-t / .022))
    if slide_to is not None:
        u = np.clip((t - (L - .14)) / .12, 0, 1)
        f = f * (hz(slide_to) / f0) ** (u * u * (3 - 2 * u))
    y = np.exp(-t / 1.3) * np.sin(2 * np.pi * np.cumsum(f) / SR)
    y = np.tanh(1.8 * y) / np.tanh(1.8)
    return tr.endfade(y * tr.attack(n), .03)

PAT = [(0, 0, 1.5, None), (1.75, 0, .75, None), (2.5, 7, 1.5, 0)]
b808 = tr.bus(); K808 = []
for b in DRUMS:
    r = ROOT[c4(b)]
    for o, iv, L, sl in PAT:
        t0 = B(b, o)
        tr.put(b808, eight08(r + iv, L * tr.beat, None if sl is None else r + sl), t0)
        K808.append(t0)
drums = tr.bus()
punch = tr.kick(hi=160, lo=60, tau_f=.02, tau_a=.04, p2=.2, click=.35, dur=.2)
for t0 in K808:
    tr.put(drums, punch, t0, .5)
snare = tr.snare(tune=1.15, tau=.08, body=.7); clap = tr.clap()
BACK = [B(b, q) for b in DRUMS for q in (1, 3)]
for t0 in BACK:
    tr.put(drums, snare, t0, .55, noise=True); tr.put(drums, clap, t0 + 0.0, .7, noise=True)
hats = tr.bus()
for b in DRUMS + [12, 13]:
    filt = b in (12, 13)
    for q in range(4):
        tr.put(hats, tr.hat(), B(b, q), .5 * (.5 if filt else 1), pan=.25, noise=True)
        tr.put(hats, tr.hat(), B(b, q + SW8), .32 * (.5 if filt else 1), pan=.25, noise=True)
    if not filt and (b % 2 == 1 or b >= 14):
        roll = [B(b, 3 + k / 6) for k in range(6)] if b % 4 == 1 else [B(b, 3.5 + k / 8) for k in range(4)]
        for k, t0 in enumerate(roll):
            tr.put(hats, tr.hat(), t0, .2 + .05 * k, pan=-.2 + .08 * k, noise=True)
    if b >= 14 and b % 2 == 0:
        tr.put(hats, tr.hat(True, .4), B(b, 2 + SW8), .3, pan=-.3, noise=True)

pad = tr.bus()
for v in range(4):
    notes = [(B(b), CH[c4(b)][v], tr.barlen + .1) for b in range(0, 24)]
    pad += tr.saw_line(notes, K=24, cutoff=900, res=2, detune=(-12, 12), attack=.8, release=1.5, glide=.2)

# ------------------------------------------------------------------ haze and space
choir = norm_rms(choir, -26); hook = norm_rms(hook, -21); pad = norm_rms(pad, -31); swell = norm_rms(swell, -30)
b808 = norm_rms(b808, -18); drums = norm_rms(drums, -21); hats = norm_rms(hats, -33)
hall = tr.reverb(hook + 1.4 * choir + .5 * pad, hp=200, t60_lo=4.5, t60_hi=2.0, f_lo=400, f_hi=6000, dur=6.0, seed=19, predelay=.03, dark=7000)
plate = tr.reverb(drums, hp=500, t60_lo=1.8, t60_hi=1.4, f_lo=800, f_hi=10000, dur=2.5, seed=23, predelay=.01)
echo = tr.delay(hook, .75 * tr.beat, fb=.4, reps=6, lp=2800)
melodic = hook * .9 + choir + pad + .7 * norm_rms(hall, -21) + .3 * echo + swell
# tape wow: a variable delay of 2 ms +/- 1.1 ms (0.45 Hz) and 0.3 ms (1.7 Hz)
d = (.002 + .0011 * np.sin(2 * np.pi * .45 * tr.t) + .0003 * np.sin(2 * np.pi * 1.7 * tr.t + 1.0)) * SR
idx = np.arange(tr.N) - d
melodic = np.stack([np.interp(idx, np.arange(tr.N), c) for c in melodic])
mL, mR = dirt(melodic[0], melodic[1], SR, 1.6, lp_hz=11000)
melodic = np.stack([mL, mR])
duck = tr.pump(K808, -3, .25)
hiss = np.stack([fft_eq(tr.noise(tr.N, 300, 12000, .5, seed=s), SR, [(2000, 0), (9000, -6)]) for s in (90, 91)])
beat_bus = b808 + drums + .25 * norm_rms(plate, -24) + hats
# the tape stop: the whole mix winds down over the last beat of bar 21
mix = duck * melodic + beat_bus + 10 ** (-52 / 20) * hiss / np.sqrt(np.mean(hiss ** 2))
a, b_ = int(B(21, 3) * SR), int(B(22) * SR)
u = np.arange(b_ - a) / (b_ - a)
pos = a + np.cumsum(1 - u ** 1.4) * 1.0
seg = np.stack([np.interp(pos, np.arange(tr.N), c) for c in mix]) * (1 - u ** 3)
mix[:, a:b_] = seg
tr.noises += list(np.arange(B(21, 3), B(22), tr.H / SR * 4))
# after the stop only the voices remain
mix[:, b_:] = (duck * melodic)[:, b_:] + 10 ** (-52 / 20) * hiss[:, b_:] / np.sqrt(np.mean(hiss ** 2))
mix = np.stack([fft_eq(c, SR, [(7000, 0), (12000, -6), (17000, -18)]) for c in mix])
finish(tr, mix, target=-14.0, fade=(B(22.5), B(24) + 2.5),
       sections=[(0, 'voices'), (B(4), 'beat'), (B(12), 'break'), (B(14), 'full'), (B(21, 3), 'tape stop'), (B(22), 'voices out')],
       notes='75 BPM, Bb minor, swing 7/12')
