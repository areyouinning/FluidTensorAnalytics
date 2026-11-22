"""STS9 study, after the album Artifact (2005): "Relic Signal". 100 BPM, D minor (Dm9 - Bbmaj7 - Gm9 - A7sus).

Artifact is the record where STS9 leaned furthest into the studio: programmed, glitch-edged beats under
a live-played band, warm Rhodes, a melodic synth bass, arpeggiated synth light and long cinematic builds
that never quite turn into a drop. Written from what is known of that approach, not from the record.
"""
from recipes import Song, span

s = Song('sts9-relic-signal', 'Relic Signal (after STS9, Artifact)', bpm=100, bars=26, seed=401,
         prog=[[50, 57, 60, 64, 65], [46, 57, 62, 65], [43, 58, 62, 65, 69], [45, 55, 62, 64, 67]])
tr, B = s.tr, s.at
s.pad('pad', span(0, 26), K=24, cutoff=tr.lin([(0, 700), (B(16), 2600), (B(22), 2600), (B(26), 800)]), res=3, detune=(-9, 0, 9), attack=1.2, release=1.8, voices=(1, 2, 3, 4))
s.stabs('rhodes', span(4, 26), [(0, 1.5, .8), (2.5, .5, .55), (3, 1, .65)], lambda m, L: tr.fm(m, L + .5, ratio=1.0, beta=1.0, tau_b=.25, tau_a=.8, tine=.08), spread=.45)
s.arp('arp', span(8, 26), lambda m, L: tr.pluck(m, .35, bright=.55), rate=.25, order=(0, 2, 4, 3, 1, 3, 4, 2), octave=12, vel=.5)
s.lowpass_sweep('arp', [(B(8), .15), (B(20), 1.0), (B(24), .5)])
s.bass('bass', span(4, 26), [(0, 0, 1), (1.25, 12, .25), (1.5, 10, .5), (2.5, 7, .5), (3, 5, .5), (3.5, 3, .5)], kind='saw', cutoff=700, res=3, env=1.0, lo=26, K=30, glide=.04)
s.drums('kick', 'X.....x...X..x..', span(4, 24), tr.kick(hi=130, lo=48, tau_a=.13, p2=.3, drive=1.5), kick=True, jitter=.003)
s.drums('snare', '....X..-....X.-.', span(4, 24), tr.snare(1.0, .07, body=1.1), noise=True, jitter=.004)
s.drums('glitch', 'x.x.xx.x.xxx.x.x', span(8, 24), lambda b, i: tr.glitch(('tick', 'blip', 'grain')[(b + i) % 3], 500 + 16 * b + i), vel=.45, noise=True)
s.drums('hats', 'xoxoxoxoxoxoxoxo', span(8, 24), tr.hat(), vel=.6, noise=True, jitter=.003)
for b in (11, 15, 19):
    s.stutter('glitch', B(b, 3), 1 / 12, 12)
s.sections = [(0, 'Pad alone'), (B(4), 'The band comes in'), (B(8), 'Arps and glitch'), (B(16), 'The long build'), (B(24), 'Settling')]
s.mixdown({'pad': -25, 'rhodes': -24, 'arp': -27, 'bass': -21, 'kick': -21, 'snare': -24, 'glitch': -31, 'hats': -33},
          pump=('kick', -2, .15, ['arp', 'pad']), sends={'rhodes': .35, 'arp': .4, 'pad': .3, 'snare': .3},
          room=dict(t60_lo=2.6, t60_hi=1.0, dur=3.5, seed=41, wet=.45),
          delay_sends={'arp': .45, 'rhodes': .15}, delay=dict(d_s=.75 * tr.beat, fb=.45, reps=6, lp=3500),
          notes='100 BPM, D minor; after STS9, Artifact (method, not the record)')
