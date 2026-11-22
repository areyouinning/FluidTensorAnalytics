"""Clams Casino x Koresma: "Cloud Compass", a remix of the FluidTA greatest-hits theme for the social cut.

The theme comes from the soundtrack's own score (theme/events.json): its arpeggio's
progression C - G - Am - F, its verse melody (8-24 s) and the second half of its drop melody (32-44 s).
The two producers split the jobs, each from what is known of his method:
  Koresma   picked acoustic guitar playing the theme's harmony as a figure, glass bell keys carrying
            the drop melody, a tight groove with shakers, everything given its own space;
  Clams     the verse melody as a pitched-down sung hook (formants lowered 15 %) under a long hall,
            a choir pad, reversed reverb swells breathing into each section, an 808 that slides,
            hats swung to 7/12 with rolls, tape wow and hiss, and a tape stop at the end.
80 BPM (between Clams's 75 and Koresma's 100), so one bar is 3 s and every video cut lands on a bar.
29 bars = 87 s: intro, the hook, a breath, the glass drop, a breakdown where the hook returns over held
808s, a second glass drop, then the tape stop, and the voices ring out.
"""
import json, os
import numpy as np
from scipy import signal
from kit import hz, fft_eq, dirt, SR, MUSIC
from recipes import Song, span

C, G, AM, F = [48, 55, 59, 62, 64], [43, 50, 55, 57, 59], [45, 52, 55, 59, 60], [41, 48, 52, 55, 57]
CYC = [C, G, AM, F]
# bars 0-12 follow the theme's cycle; the drop (13-19) starts the cycle again on C, where the drop melody's
# second half starts in the original (its bar 16)
PROG = [CYC[b % 4] for b in range(13)] + [CYC[(b + 3) % 4] for b in range(13, 19)] + [CYC[(b + 1) % 4] for b in range(19, 29)]
s = Song('clams-koresma-cloud-compass', 'Cloud Compass (after Clams Casino and Koresma)', bpm=80, bars=29,
         prog=PROG, div=144, tail=2.4, seed=87)
tr, B = s.tr, s.at
BEAT = tr.beat
DRUMS = span(4, 12, 13, 19, 23, 28)
BREAK = span(19, 23)

# ------------------------------------------------------------------ the theme, from the score
ev = json.load(open(os.path.join(MUSIC, 'theme', 'events.json')))
mel = [(t, m, d) for kind, t, m, d in ev if kind == 'mel']
def place(t0, t1, bar0, orig_bar0, shift):   # the original is 120 BPM: 2 beats a second, a bar every 2 s
    out = []
    for t, m, d in mel:
        if t0 <= t < t1:
            beat = 2 * t; ob = int(beat // 4)
            out.append((bar0 + ob - orig_bar0, beat - 4 * ob, m + shift, 2 * d))
    return out
VERSE = place(8, 24, 4, 4, -12)        # bars 4-11, sung an octave down, then lowered formants slow it further
DROP = place(32, 44, 13, 16, -12) + place(32, 44, 23, 16, -12)   # bars 13-18 and 23-28, on glass
VERSE += place(8, 16, 19, 4, -12)       # the breakdown: the hook's first four bars again

# ------------------------------------------------------------------ Koresma: guitar, glass, groove
guitar = lambda m, L: .55 * (tr.pluck(m, 1.1, bright=.18) + tr.pluck(m + .06, 1.1, bright=.2))
s.arp('guitar', span(0, 28), guitar, rate=.5, order=(0, 2, 1, 3, 2, 4, 3, 1), octave=12, vel=.55, pan_spread=.3)
s.melody('glass', [(b, bt, m, L) for b, bt, m, L in DROP], inst=lambda m, L: tr.bell(m, 2.2, bright=.9), pan=.25)
s.drums('snare', '....X.......X...', DRUMS, tr.layer(tr.snare(1.05, .07, body=1.2), .5 * tr.clap()), noise=True, swing=.2)
s.drums('shaker', 'xoxoxoxoxoxoxoxo', span(2, 12, 13, 19, 23, 28), tr.shaker(), noise=True, swing=.2)

# ------------------------------------------------------------------ Clams: hook, choir, swells, 808, hats
VOW = 'aou'
hook = s.melody('hook', [(b, bt, m, L, VOW[i % 3]) for i, (b, bt, m, L) in enumerate(VERSE)],
                sung=dict(attack=.04, release=.4, glide=.06, vib=(4.8, .12, .25), breath=.08, seed=71,
                          fscale=.85, formant_glide=.05))
# in the drop the voice answers the glass: the same melody two octaves down, chopped short
chop = s.melody('chop', [(b, bt, m - 12, min(L, .5), VOW[(i + 1) % 3]) for i, (b, bt, m, L) in enumerate(DROP) if bt in (0, 1, 2, 3)],
                sung=dict(attack=.01, release=.12, glide=.02, vib=(5, .05, .1), breath=.05, seed=73, fscale=.85))
s.pad('choir', span(0, 29), attack=.9, release=1.5, octave=12, voices=(1, 2, 3, 4), inst='sung')

hall_ir = tr.ir(t60_lo=4.5, t60_hi=2.0, f_lo=400, f_hi=6000, dur=3.0, seed=17, predelay=.0)
swell = tr.bus()
for at, src in ((B(4), hook), (B(13), s.buses['glass']), (B(8), hook), (B(19), hook), (B(23), s.buses['glass'])):
    i0 = int(at * SR); seg = src[0, i0:i0 + int(.9 * SR)]
    wet = signal.fftconvolve(seg, hall_ir)[:int(2.4 * SR)][::-1].copy()
    wet = tr.endfade(wet * tr.attack(len(wet), 20), .04)
    a = max(0, i0 - len(wet)); wet = wet[len(wet) - (i0 - a):]
    swell[:, a:i0] += wet
    tr.onsets.append(at)
s.add('swell', swell)

def eight08(m, L, slide_to=None):
    """The 808 leads (the Clams lean): a long decay, driven hard so its upper harmonics carry the note on a
    phone speaker, plus a clean sine an octave below for the weight you feel."""
    n = int((L + .05) * SR); t = np.arange(n) / SR
    f0 = float(hz(m)); f = f0 * (1 + 1.4 * np.exp(-t / .02))
    if slide_to is not None:
        u = np.clip((t - (L - .16)) / .14, 0, 1)
        f = f * (hz(slide_to) / f0) ** (u * u * (3 - 2 * u))
    ph = 2 * np.pi * np.cumsum(f) / SR
    env = np.exp(-t / 2.2)
    y = np.tanh(3.2 * env * np.sin(ph)) / np.tanh(3.2)
    sub = .55 * env * np.sin(ph / 2)
    return tr.endfade((y + sub) * tr.attack(n), .03)
PAT = [(0, 0, 1.5, None), (1.75, 0, .75, None), (2.5, 7, 1.5, 0)]
b808, drums = tr.bus(), tr.bus()
punch = tr.kick(hi=150, lo=48, tau_f=.02, tau_a=.08, p2=.3, click=.35, dur=.3)
for b in DRUMS:
    r = s.root(b, 31)
    for o, iv, L, sl in PAT:
        t0 = B(b, o)
        tr.put(b808, eight08(r + iv, L * BEAT, None if sl is None else r + sl), t0)
        tr.put(drums, punch, t0, .5)
        s.kick_times.append(t0)
for b in BREAK:                                  # the breakdown keeps its weight: one held 808 per bar
    r = s.root(b, 31); tr.put(b808, eight08(r, 3.6 * BEAT), B(b))
s.add('808', b808); s.add('kick', drums)
SW8 = 7 / 12
hats = tr.bus()
for b in DRUMS:
    for q in range(4):
        tr.put(hats, tr.hat(), B(b, q), .5, pan=.25, noise=True)
        tr.put(hats, tr.hat(), B(b, q + SW8), .32, pan=.25, noise=True)
    if b % 2 == 1:
        roll = [B(b, 3 + k / 6) for k in range(6)] if b % 4 == 1 else [B(b, 3.5 + k / 8) for k in range(4)]
        for k, t0 in enumerate(roll):
            tr.put(hats, tr.hat(), t0, .2 + .05 * k, pan=-.2 + .08 * k, noise=True)
s.add('hats', hats)
s.add('hiss', np.stack([fft_eq(tr.noise(tr.N, 300, 12000, .5, seed=q), SR, [(2000, 0), (9000, -6)]) for q in (90, 91)]))

# ------------------------------------------------------------------ haze: tape wow on everything melodic
d = (.002 + .0011 * np.sin(2 * np.pi * .45 * tr.t) + .0003 * np.sin(2 * np.pi * 1.7 * tr.t + 1.0)) * SR
idx = np.arange(tr.N) - d
for k in ('guitar', 'glass', 'hook', 'chop', 'choir'):
    x = np.stack([np.interp(idx, np.arange(tr.N), c) for c in s.buses[k]])
    L, R = dirt(x[0], x[1], SR, 1.4, lp_hz=11000)
    s.buses[k] = np.stack([L, R])

# ------------------------------------------------------------------ the tape stop: bar 27, last beat
a, b_ = int(B(27, 3) * SR), int(B(28) * SR)
u = np.arange(b_ - a) / (b_ - a)
pos = a + np.cumsum(1 - u ** 1.4)
for k in list(s.buses):
    x = s.buses[k]
    seg = np.stack([np.interp(pos, np.arange(tr.N), c) for c in x]) * (1 - u ** 3)
    x[:, a:b_] = seg
    if k not in ('choir', 'hook', 'hiss'):
        x[:, b_:] = 0                                  # after the stop only the voices remain
tr.noises += list(np.arange(B(27, 3), B(28), tr.H / SR * 4))

s.sections = [(0, 'guitar and haze'), (B(4), 'the hook'), (B(12), 'breath'), (B(13), 'glass drop'), (B(19), 'breakdown'), (B(23), 'glass drop 2'), (B(27, 3), 'tape stop')]
s.buses['guitar'] = np.stack([fft_eq(c, SR, [(1500, 0), (4000, -9), (9000, -20)]) for c in s.buses['guitar']])   # into the haze
s.mixdown({'guitar': -28, 'glass': -27, 'hook': -20, 'chop': -25, 'choir': -26, 'swell': -29, '808': -14, 'kick': -21,
           'snare': -22, 'shaker': -38, 'hats': -33, 'hiss': -52},
          pump=('808', -6, .3, ['guitar', 'choir', 'hook', 'glass', 'chop']),
          sends={'hook': .9, 'choir': 1.2, 'glass': .6, 'guitar': .3, 'snare': .3, 'chop': .6},
          room=dict(t60_lo=4.5, t60_hi=2.0, f_lo=400, f_hi=6000, dur=6.0, seed=19, predelay=.03, wet=.6),
          delay_sends={'hook': .3, 'glass': .45, 'chop': .4}, delay=dict(d_s=.75 * BEAT, fb=.4, reps=6, lp=3200),
          master_eq=[(30, 2), (60, 3), (120, 1.5), (300, 0), (7000, -1), (12000, -7), (17000, -18)],
          fade=(B(27, 3), B(29) + 2.2), notes='80 BPM, C major (C - G - Am - F), swing 7/12')
