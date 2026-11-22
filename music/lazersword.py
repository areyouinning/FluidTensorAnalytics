"""Lazer Sword study: "Neon Gauntlet". Wonky electro at 125 BPM in A minor (Am - F - G - Em).

Assumed method (Low Limit + Lando Kal): bright, game-like square leads (and a nod to the soundtrack
guide's "clean, like Beam Rider"), chunky detuned electro bass, swung rap-leaning drums with a
cowbell, and the synths a little out of square with each other on purpose.
"""
from recipes import Song, span

s = Song('lazersword-neon-gauntlet', 'Neon Gauntlet (after Lazer Sword)', bpm=125, bars=32, seed=71,
         prog=[[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]])
tr, B = s.tr, s.at
square = lambda m, L: tr.partials(float(440 * 2 ** ((m - 69) / 12)), L + .05, [1, 3, 5, 7, 9, 11, 13], [1, 1 / 3, 1 / 5, 1 / 7, 1 / 9, 1 / 11, 1 / 13],
                                  [L * 2] * 7)
GAME = [(0, 76, .25), (.25, 79, .25), (.5, 84, .5), (1, 83, .25), (1.25, 79, .25), (1.5, 76, .5), (2, 74, .5),
        (2.5, 76, .25), (2.75, 74, .25), (3, 72, .5), (3.5, 69, .5)]
s.melody('game', [(b, bt, m, L) for b in span(4, 12, 20, 32) for bt, m, L in GAME], inst=square, pan=.25)
s.arp('arp', span(0, 32), lambda m, L: square(m, L) * .6, rate=.25, order=(0, 2, 1, 2), octave=12, vel=.5, pan_spread=.6)
s.lowpass_sweep('arp', [(0, .1), (B(4), .5), (B(12), .3), (B(20), 1.0)])
s.bass('bass', span(4, 32), [(0, 0, .5), (.75, 0, .25), (1.5, 12, .25), (2, 0, .5), (2.75, 3, .25), (3, 5, .5), (3.5, 7, .5)],
       kind='saw', cutoff=900, res=6, env=2.0, lo=33, detune=(-12, 12), K=36)
s.drums('kick', 'X.....X...X.....', span(4, 32), tr.kick(hi=160, lo=50, tau_a=.13, p2=.3, click=.25, drive=2.5), kick=True, swing=.35,
        var=lambda b: 'X.....X...X..X..' if b % 4 == 3 else None)
s.drums('snare', '....X.......X...', span(4, 32), tr.layer(tr.clap() * .7, tr.snare(1.1, .06) * .6), noise=True, swing=.35)
s.drums('hats', 'x.xxx.x.x.xxx.x.', span(4, 32), tr.hat(), vel=.7, noise=True, swing=.35)
cow = tr.partials(800.0, .2, [1, 1.48], [1, .8], [.08, .06])
s.drums('cowbell', '......x.......x.', span(12, 20, 24, 32), cow, vel=.5, swing=.35)
s.sections = [(0, 'arp'), (B(4), 'game lead + beat'), (B(12), 'cowbell'), (B(20), 'all open')]
s.mixdown({'game': -23, 'arp': -27, 'bass': -21, 'kick': -20, 'snare': -23, 'hats': -32, 'cowbell': -30},
          pump=('kick', -3, .14, ['arp', 'game']), sends={'game': .3, 'snare': .25, 'arp': .3},
          room=dict(t60_lo=1.6, t60_hi=.7, dur=2.5, seed=16, wet=.3),
          delay_sends={'game': .35}, delay=dict(d_s=.75 * tr.beat, fb=.35, reps=5, lp=5000),
          notes='125 BPM, A minor, swing .35')
