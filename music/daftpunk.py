"""Daft Punk study: "Robot Sunrise". French house at 120 BPM in G major (Gmaj7 - Em7 - Am7 - D7).

Assumed method: a looped disco chord riff under a filter that opens over the intro and snaps shut
in the break; everything pumping against the kick; a vocoder/talkbox voice (a saw-rich glottal
source through moving formants, no vibrato) singing a short hook; four-on-the-floor with
offbeat hats and claps; a funky octave bass.
"""
from recipes import Song, span

s = Song('daftpunk-robot-sunrise', 'Robot Sunrise (after Daft Punk)', bpm=120, bars=32, seed=69,
         prog=[[55, 59, 62, 66], [52, 55, 59, 62], [57, 60, 64, 67], [50, 54, 57, 60]])
tr, B = s.tr, s.at
brass = lambda m, L: .6 * tr.fm(m, L + .15, ratio=1.0, beta=2.2, tau_b=.18, tau_a=.5) + .4 * tr.pluck(m, L + .15, bright=.3)
s.stabs('loop', span(0, 32), [(0, .5, 1.0), (.75, .25, .6), (1.5, .5, .8), (2.5, .25, .6), (2.75, .5, .9), (3.5, .25, .5)], brass, spread=.5)
s.lowpass_sweep('loop', [(0, .05), (B(8), 1.0), (B(16), 1.0), (B(16.1), .15), (B(20), .15), (B(24), 1.0)])
HOOK = [(0, 74, .5, 'a'), (.5, 74, .5, 'o'), (1, 76, 1, 'u'), (2.5, 74, .5, 'a'), (3, 71, 1, 'o'),
        (4, 72, .5, 'a'), (4.5, 72, .5, 'e'), (5, 74, 1, 'a'), (6.5, 72, .5, 'o'), (7, 69, 1, 'u')]
voc = [(b + bt // 4, bt % 4, m, L, v) for b in span(8, 16, 24, 32)[::2] for bt, m, L, v in HOOK]
s.melody('vocoder', voc, sung=dict(attack=.01, release=.08, glide=.03, vib=(5, 0, 1), breath=.02, seed=99,
                                   tilt=.85, odd=.9, formant_glide=.04, K=80))
s.bass('bass', span(4, 16, 20, 32), [(0, 0, .25), (.5, 12, .25), (1, 0, .25), (1.5, 12, .25), (2, 0, .25), (2.5, 12, .25), (3, 0, .25), (3.5, 10, .25)],
       kind='saw', cutoff=900, res=4, env=1.5, lo=31)
s.drums('kick', 'X...X...X...X...', span(4, 16, 20, 32), tr.kick(hi=140, lo=50, tau_a=.13, p2=.3, click=.2, drive=2), kick=True)
s.drums('clap', '....X.......X...', span(8, 16, 20, 32), tr.clap(), noise=True)
s.drums('hats', '..X...X...X...X.', span(4, 32), tr.hat(True, .25), noise=True)
s.drums('shk', 'x-x-x-x-x-x-x-x-', span(8, 32), tr.shaker(), noise=True)
s.sections = [(0, 'filtered loop'), (B(8), 'robot voice'), (B(16), 'filter shut'), (B(24), 'voice again')]
s.mixdown({'loop': -22, 'vocoder': -21, 'bass': -22, 'kick': -19, 'clap': -26, 'hats': -30, 'shk': -34},
          pump=('kick', -8, .18, ['loop', 'bass', 'vocoder', 'hats', 'shk']), sends={'loop': .25, 'vocoder': .35, 'clap': .3},
          room=dict(t60_lo=1.6, t60_hi=.7, dur=2.5, seed=14, wet=.35),
          delay_sends={'vocoder': .3}, delay=dict(d_s=.75 * tr.beat, fb=.3, reps=4, lp=4000),
          notes='120 BPM, G major, pump -8 dB')
