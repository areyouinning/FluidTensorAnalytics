"""Flying Lotus study: "Astral Kitchen". Wonky beat at 80 BPM, D Dorian with jazz chords (Dm9 - G13 - Em7b5 - A7b9).

Assumed method: drums that lean drunk around the grid (heavy swing plus seeded jitter, every hit
still on the hop grid), a deep warm sub, a harp and Rhodes playing jazz voicings, the whole beat
ducking under a slow sidechain sweep, crackle and glitch, a cosmic synth line that slides.
"""
from recipes import Song, span

s = Song('flyinglotus-astral-kitchen', 'Astral Kitchen (after Flying Lotus)', bpm=80, bars=20, div=144, seed=75,
         prog=[[53, 57, 60, 64, 65], [53, 59, 64, 65, 69], [52, 55, 58, 62], [55, 58, 61, 64, 67]])
tr, B = s.tr, s.at
harp = lambda m, L: tr.pluck(m, 1.4, bright=.12)
s.arp('harp', span(0, 20), harp, rate=1 / 6, order=(0, 1, 2, 3, 4, 3, 2, 1, 0, 2, 4, 2), octave=12, vel=.45)
s.stabs('rhodes', span(2, 20), [(0, 1.5, .8), (2.75, 1, .6)], lambda m, L: tr.fm(m, L + .5, ratio=1.0, beta=.9, tau_b=.3, tau_a=1.0, tine=.07), spread=.4)
s.drums('kick', 'X.....x..X......', span(4, 20), tr.kick(hi=110, lo=45, tau_a=.18, p2=.25, drive=2), kick=True, swing=.6, jitter=.008)
s.drums('snare', '....X.......X..x', span(4, 20), tr.snare(.9, .08, body=1.0), noise=True, swing=.6, jitter=.01)
s.drums('hats', 'x.xxx.x.xx.xx.xx', span(4, 20), tr.hat(), vel=.6, noise=True, swing=.6, jitter=.006)
s.bass('sub', span(4, 20), [(0, 0, 1.75), (2.75, 7, .5), (3.25, 5, .75)], kind='sine', lo=26, harm=(1.0, .2), glide=.08)
SLIDE = [(0, 77, 1.5), (1.5, 76, .5), (2, 74, 2), (4, 72, 1), (5, 74, .5), (5.5, 77, 2.5)]
line = [(b + bt // 4, bt % 4, m, L) for b in (8, 10, 14, 16) for bt, m, L in SLIDE]
s.add('synth', tr.saw_line([(B(b, bt), m, L * tr.beat * .95) for b, bt, m, L in line], K=24, cutoff=1800, res=6,
                           detune=(-9, 9), attack=.05, release=.4, glide=.2))
s.add('crackle', tr.noise(tr.N, 1500, 9000, .3, seed=130) * (tr.noise(tr.N, 1, 30, 0, seed=131) > .97) * .5)
for b in (7, 11, 15):
    s.stutter('harp', B(b, 3), 1 / 12, 12)
s.sections = [(0, 'harp'), (B(4), 'drunk drums'), (B(8), 'synth slide'), (B(12), 'drop back')]
s.mixdown({'harp': -25, 'rhodes': -25, 'kick': -20, 'snare': -23, 'hats': -32, 'sub': -20, 'synth': -24, 'crackle': -56},
          pump=('kick', -7, .3, ['harp', 'rhodes', 'synth', 'hats']), sends={'harp': .5, 'rhodes': .4, 'synth': .4, 'snare': .3},
          room=dict(t60_lo=2.8, t60_hi=1.1, dur=4.0, seed=20, wet=.45),
          delay_sends={'synth': .4, 'harp': .2}, delay=dict(d_s=.75 * tr.beat, fb=.45, reps=6, lp=2800),
          lofi=[(6000, 0), (11000, -6), (16000, -18)], notes='80 BPM, D Dorian, swing .6 + jitter 6-10 ms')
