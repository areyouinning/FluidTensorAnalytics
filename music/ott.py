"""Ott study, after "Adrift in Hilbert Space": "Hilbert Drift". 96 BPM, A minor (Am7 - Fmaj7 - G - Em7).

Ott's psydub: a deep, round dub bass and a one-drop kick, an offbeat chord skank, spring-style echo
throws, squelching acid gurgles, and a gliding analogue lead. The lead's melody is the trick: it walks a
Hilbert curve, the space-filling path that visits every cell of a grid while each step moves only to a
neighbour. Here the grid is 8 eighth notes by 8 scale degrees, so the tune wanders the whole space
without ever leaping. Written from that approach and the title's idea, not from the record.
"""
import numpy as np
from recipes import Song, span

s = Song('ott-hilbert-drift', 'Hilbert Drift (after Ott)', bpm=96, bars=24, div=240, seed=404,
         prog=[[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 67], [52, 55, 59, 62]])
tr, B = s.tr, s.at


def hilbert(order):
    """The d-th point of a Hilbert curve on a 2^order grid (the classic d2xy)."""
    n, pts = 2 ** order, []
    for d in range(n * n):
        x = y = 0; t = d; sz = 1
        while sz < n:
            rx = 1 & (t // 2); ry = 1 & (t ^ rx)
            if ry == 0:
                if rx == 1:
                    x, y = sz - 1 - x, sz - 1 - y
                x, y = y, x
            x += sz * rx; y += sz * ry; t //= 4; sz *= 2
        pts.append((x, y))
    return pts


SC = [57, 59, 60, 62, 64, 65, 67, 69]                     # A minor, eight degrees
H = hilbert(3)                                            # 64 steps on an 8x8 grid
lead = []
for k, (x, y) in enumerate(H):
    b = 8 + k // 8
    lead.append((B(b, (k % 8) / 2), SC[y] + 12, .5 * tr.beat * .95))
s.add('lead', tr.saw_line(lead + [(B(16, j / 2), SC[H[j][1]] + 12, .5 * tr.beat * .95) for j in range(0, 64, 2)],
                          K=30, cutoff=2200, res=6, detune=(-7, 7), attack=.02, release=.12, glide=.07))
s.stabs('skank', span(4, 24), [(.5, .25, 1), (1.5, .25, .8), (2.5, .25, 1), (3.5, .25, .8)],
        lambda m, L: tr.fm(m + 12, .18, ratio=1.0, beta=1.6, tau_b=.05, tau_a=.09), spread=.5)
s.bass('dub', span(4, 24), [(0, 0, 1.5), (1.5, 0, .5), (2, 7, 1), (3, 10, .5), (3.5, 12, .5)], kind='sine', lo=33, harm=(1.0, .4, .1), glide=.05)
s.bass('acid', span(12, 20), [(0, 12, .25), (.75, 15, .25), (1.5, 12, .25), (2.25, 19, .25), (3, 17, .5)], kind='saw', cutoff=400, res=11, env=5.0, lo=33, K=40)
s.drums('kick', '........X.......', span(4, 24), tr.kick(hi=110, lo=45, tau_a=.2, p2=.25), kick=True)
s.drums('rim', '........x......-', span(4, 24), tr.partials(1900.0, .08, [1, 2.2], [1, .45], [.012, .008]), vel=.7)
s.drums('hats', '..x...x...x...x.', span(8, 24), tr.hat(), vel=.55, noise=True)
s.pad('pad', span(0, 24), K=18, cutoff=900, res=3, detune=(-12, 12), attack=1.5, release=2.0)
throw = tr.bus()
for b in (7, 11, 15, 19):
    tr.put(throw, tr.snare(1.0, .06), B(b, 3), .7, noise=True)
s.add('throw', throw)
s.sections = [(0, 'Pad and space'), (B(4), 'The dub settles in'), (B(8), 'The Hilbert lead'), (B(12), 'Acid gurgles'), (B(16), 'The curve again, in steps of two'), (B(20), 'Drifting out')]
s.mixdown({'lead': -23, 'skank': -27, 'dub': -19, 'acid': -28, 'kick': -21, 'rim': -28, 'hats': -33, 'pad': -28, 'throw': -27},
          pump=('kick', -2, .2, ['pad']), sends={'lead': .4, 'skank': .35, 'rim': .35, 'throw': .8, 'pad': .3},
          room=dict(t60_lo=2.2, t60_hi=1.3, dur=3.5, seed=44, wet=.5),
          delay_sends={'skank': .5, 'rim': .5, 'throw': 1.0, 'lead': .3}, delay=dict(d_s=.75 * tr.beat, fb=.62, reps=10, lp=2000),
          notes='96 BPM, A minor; the lead walks an order-3 Hilbert curve')
