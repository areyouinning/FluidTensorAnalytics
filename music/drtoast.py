"""Dr. Toast study: "Sunrise Epicycles". 96 BPM, D major / Lydian (Dmaj9 - Gmaj7#11 - Bm9 - Aadd9).

Dr. Toast (James Reynolds, San Francisco) describes the project as "radiant textures and beats to a
sunrise near you", with downtempo, ambient and chill tags, science-titled tracks ("Epicycles",
"Untouchable Number") and mastering by Twerk. So: a sunrise, warm and widening, over swung glitchy
beats. The lead's trick is its namesake: the melody is traced by epicycles, three circles turning on
circles (Ptolemy's orbits, and a three-term Fourier series), read off as pitch. The whole track
brightens like a sunrise. Written from that description, not from a record.
"""
import numpy as np
from recipes import Song, span

s = Song('drtoast-sunrise-epicycles', 'Sunrise Epicycles (after Dr. Toast)', bpm=96, bars=24, div=240, seed=405,
         prog=[[50, 57, 61, 64, 66], [55, 59, 62, 66, 73], [47, 54, 57, 61, 62], [45, 52, 57, 59, 61]])
tr, B = s.tr, s.at
SC = [62, 64, 66, 68, 69, 71, 73, 74, 76, 78, 80, 81]               # D Lydian, upward
epi = []
for k in range(8 * 16):                                            # bars 8-24, sixteenth notes, every other one sounds
    t = k / 16
    z = 1.0 * np.exp(1j * 2 * np.pi * t / 2) + .45 * np.exp(-1j * 2 * np.pi * 3 * t / 2 + .7) + .2 * np.exp(1j * 2 * np.pi * 7 * t / 2 + 1.9)
    idx = int(np.clip(np.round((z.real + 1.65) / 3.3 * (len(SC) - 1)), 0, len(SC) - 1))
    if k % 2 == 0 or abs(z.imag) > .9:
        epi.append((8 + k // 16, (k % 16) / 4, SC[idx], .45))
s.melody('epicycles', epi, inst=lambda m, L: tr.layer(tr.pluck(m + 12, .5, bright=.45), .3 * tr.bell(m + 24, 1.2, bright=1.1)), pan=.2)
s.pad('pad', span(0, 24), K=26, cutoff=tr.lin([(0, 400), (B(12), 2200), (B(24), 4200)]), res=3, detune=(-12, -4, 4, 12), attack=1.6, release=2.0)
s.arp('shimmer', span(4, 24), lambda m, L: tr.fm(m + 24, .6, ratio=3.0, beta=1.2, tau_b=.08, tau_a=.3), rate=.25, order=(0, 2, 4, 1, 3, 4, 2, 0), octave=0, vel=.3)
s.lowpass_sweep('shimmer', [(B(4), .1), (B(20), 1.0)])
s.bass('bass', span(4, 24), [(0, 0, 1), (1.5, 7, .5), (2, 12, .5), (2.75, 7, .25), (3, 0, 1)], kind='saw', cutoff=650, res=3, env=1.2, lo=33)
s.drums('kick', 'X.....x...X..x..', span(4, 24), tr.kick(hi=150, lo=48, tau_a=.12, p2=.3, click=.3, drive=2), kick=True, swing=.45)
s.drums('snare', '....X.......X...', span(4, 24), tr.layer(tr.snare(1.1, .06, body=1.1), .4 * tr.clap()), noise=True, swing=.45)
s.drums('glitch', 'x..x.x..x.xx.x..', span(8, 24), lambda b, i: tr.glitch(('blip', 'tick', 'grain')[(b * 3 + i) % 3], 600 + 16 * b + i), vel=.45, noise=True, swing=.45)
for b in (11, 15, 19, 23):
    s.stutter('glitch', B(b, 3), 1 / 8, 8)
s.sections = [(0, 'Before dawn'), (B(4), 'First light: the beat'), (B(8), 'The epicycle melody'), (B(16), 'Full sun'), (B(22), 'Morning')]
sun = tr.sweep([(0, .2), (B(16), 1.0), (B(24), 1.0)])
s.buses['pad'] = s.buses['pad'] * (.6 + .4 * sun)
s.mixdown({'epicycles': -22, 'pad': -25, 'shimmer': -30, 'bass': -21, 'kick': -20, 'snare': -23, 'glitch': -31},
          pump=('kick', -3, .15, ['pad', 'shimmer']), sends={'epicycles': .4, 'pad': .3, 'shimmer': .5, 'snare': .25},
          room=dict(t60_lo=2.6, t60_hi=1.2, dur=3.8, seed=45, wet=.45),
          delay_sends={'epicycles': .35, 'shimmer': .3}, delay=dict(d_s=.75 * tr.beat, fb=.4, reps=6, lp=4000),
          notes='96 BPM, D Lydian; the melody is read off three epicycles')
