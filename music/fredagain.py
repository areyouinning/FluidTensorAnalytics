"""Fred again.. study: "Kitchen Light". Emotional house at 128 BPM in Eb major (Eb - Cm7 - Abmaj7 - Bb).

Assumed method: a found vocal phrase, looped and chopped until it becomes a riff; soft piano
chords that start it all; a long hold, then a kick that drops in; a rolling sub; shuffled hats;
a breakdown that strips back to the voice before the beat returns harder.
(The voice here is wordless; Fred's are real people's words, which this can't fake.)
"""
from recipes import Song, span

s = Song('fredagain-kitchen-light', 'Kitchen Light (after Fred again..)', bpm=128, bars=32, div=60, seed=70,
         prog=[[55, 58, 63], [55, 58, 63, 67], [56, 60, 63, 67], [53, 58, 62]])
tr, B = s.tr, s.at
s.stabs('piano', span(0, 32), [(0, 2, .8), (2.5, 1.5, .6)], lambda m, L: tr.piano(m, .55, felt=.3), spread=.3)
PHRASE = [(0, 75, .5, 'a'), (.5, 75, .25, 'e'), (.75, 72, .75, 'o'), (2, 70, .5, 'a'), (2.5, 72, 1, 'i')]
vox = [(b, bt, m, L, v) for b in span(0, 32) for bt, m, L, v in PHRASE]
s.melody('vox', vox, sung=dict(attack=.015, release=.12, glide=.04, vib=(5, .06, .3), breath=.07, seed=101, fscale=1.05, formant_glide=.03))
for b in (6, 7, 14, 15, 26, 27, 30):
    s.stutter('vox', B(b, 2), .25 if b % 2 else .125, 8 if b % 2 else 16)
s.drums('kick', 'X...X...X...X...', span(8, 16, 20, 30), tr.kick(hi=150, lo=48, tau_a=.14, p2=.3, click=.2), kick=True)
s.drums('clap', '....X.......X...', span(12, 16, 20, 30), tr.clap(), noise=True)
s.drums('hats', 'x-o-x-ox-xo-x-ox', span(8, 16, 20, 30), tr.hat(), noise=True, swing=.3)
s.bass('sub', span(8, 16, 20, 30), [(0, 0, .75), (1, 0, .75), (2, 0, .75), (2.75, 7, .25), (3, 0, .75)],
       kind='sine', lo=27, harm=(1.0, .25))
s.sections = [(0, 'piano + found voice'), (B(8), 'kick drops in'), (B(16), 'strip back'), (B(20), 'beat returns')]
s.mixdown({'piano': -23, 'vox': -22, 'kick': -21, 'clap': -26, 'hats': -31, 'sub': -23, 'riser': -30},
          pump=('kick', -6, .18, ['piano', 'sub', 'hats']), sends={'piano': .45, 'vox': .45, 'clap': .3},
          room=dict(t60_lo=2.8, t60_hi=1.2, dur=4.0, seed=15, wet=.45),
          delay_sends={'vox': .35}, delay=dict(d_s=.75 * tr.beat, fb=.35, reps=6, lp=3500),
          notes='128 BPM, Eb major')
