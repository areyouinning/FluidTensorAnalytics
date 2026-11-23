"""The Odyssey in Seven: Homer's story told by seven producer studies in succession, one continuous track.

One theme belongs to Odysseus and travels the whole way: it starts on the tonic, leaps to the fifth,
steps down, then climbs back up to the octave (the long way home). Each chapter re-keys it into its own
scale and gives it to its producer's lead instrument. Between chapters the sea swells up and carries
the boat from one sound to the next.

  I    The Cyclops     after Splatinum  150 half-time, G minor. The theme on bells in the cave, the giant's
                                        footsteps, a voice saying "No-bo-dy", then the talking womps roar
                                        (the blinding) and a riddim drop (the rocks thrown after the ship).
  II   Aeolus          after Koresma    100 BPM, C major. Guitar and glass sail for home with the winds tied
                                        in a bag; the bag opens at bar 16, the gale blows them back and the
                                        theme returns in C minor.
  III  Circe           after Shpongle   128 BPM, E Phrygian dominant. The flute sings the theme over tabla;
                                        the psy roll and the men turned to swine; Hermes' sitar breaks it.
  IV   The Underworld  after Clams      75 BPM, Bb minor. The shades as a drowned choir, the theme as a
                                        pitched-down hook (Tiresias), the 808, then a tape stop into the dark.
  V    The Sirens      after Hopkins    125 BPM, Ab major. The oars are the crunching kick. When the sirens
                                        sing, the crew's wax muffles the beat (everything but the sirens is
                                        low-passed); Odysseus, bound to the mast, answers with the theme on
                                        piano, and the release carries both.
  VI   Calypso         after Eno        no pulse, F pentatonic. Seven years on her island: seven loops whose
                                        periods never line up, and the theme slowed to a sung loop.
  VII  Ithaca          after Fred again 128 BPM, Eb major. The theme as a chopped found-voice riff over piano;
                                        the bow is strung (a twang and a swallow's cry) and the kick drops in;
                                        Penelope's recognition strips it back; the beat returns, and the
                                        piano lands the theme on the octave: home.

Each chapter borrows its study's method (see the study scripts) and never a melody or a recording. Every
chapter is rendered on its own tempo grid, levelled to its place in the arc by measured loudness, and laid
over the previous chapter's fade; the whole suite is mastered once.
"""
import json, os
import numpy as np
from scipy import signal
import soundfile as sf
from kit import Track, finish, norm_rms, euclid, hz, fft_eq, dirt, loudness, SR, PHI, MUSIC
from recipes import Song, span

SLUG = 'odyssey-in-seven'
TMP = os.path.join(os.environ.get('TEMP', '.'), 'odyssey-stems'); os.makedirs(TMP, exist_ok=True)

# ====================================================================== Odysseus's theme
SC = {'minor': [0, 2, 3, 5, 7, 8, 10], 'major': [0, 2, 4, 5, 7, 9, 11], 'phrdom': [0, 1, 4, 5, 7, 8, 10],
      'penta': [0, 2, 4, 7, 9]}
DEG = [0, 4, 3, 2, 1, 2, 4, 6, 7]                 # tonic, fifth, down by steps, back up to the octave
DEG_B = [7, 6, 4, 3, 2, 1, 0, -1, 0]             # the answer: falling from the octave, settling on the tonic
RHY = [(0, 1), (1, 1), (2, .5), (2.5, .5), (3, 1), (4, 1.5), (5.5, .5), (6, 1), (7, 1)]   # two bars of 4/4


def theme(tonic, scale='minor', deg=DEG, stretch=1.0):
    """[(beat from the phrase start, midi, beats)]: two bars, re-keyed into any scale."""
    sc = SC[scale]
    return [(b * stretch, tonic + 12 * (d // len(sc)) + sc[d % len(sc)], L * stretch) for d, (b, L) in zip(deg, RHY)]


def at_bars(phrase, bar):
    """theme() notes placed from `bar`, as (bar, beat, midi, beats) for recipes.Song.melody."""
    return [(bar + int(b // 4), b % 4, m, L) for b, m, L in phrase]


def chapter(tr, mix, fade, sections):
    np.save(os.path.join(TMP, tr.title[:4].strip('. ') + '.npy'), mix.astype(np.float32))
    return dict(tr=tr, mix=mix, fade=fade, sections=sections, title=tr.title)


# ====================================================================== I. The Cyclops (Splatinum)
def cyclops():
    tr = Track(SLUG, 'I. The Cyclops (after Splatinum)', bpm=150, bars=28, tail=2.4, seed=31)
    B = tr.at
    CH = [[55, 58, 62], [55, 58, 62], [55, 58, 63], [57, 60, 65]]
    ROOT = [31, 31, 27, 29]
    c4 = lambda b: b % 4
    LIGHT = list(range(0, 12)) + list(range(24, 28))

    arp = tr.bus()
    for b in LIGHT:
        pool = [m + 12 for m in CH[c4(b)]] + [m + 24 for m in CH[c4(b)]]
        for s, idx in enumerate([0, 1, 2, 3, 4, 3, 2, 1]):
            tr.put(arp, tr.fm(pool[idx], .6, ratio=PHI, beta=2.2, tau_b=.07, tau_a=.22), B(b, s / 2),
                   .55 + .1 * (s == 0), pan=.5 * np.sin(s * 2.39996))
    arp *= tr.sweep([(0, .35), (B(8), .6), (B(11.75), 1.0), (B(12), .45), (B(24), .6), (B(28), .3)])
    bells = tr.bus()                                    # "Sing to me, Muse": the theme in the cave
    for bar, d in ((2, DEG), (6, DEG_B), (24, DEG), (26, DEG_B)):
        for beat, m, L in theme(67, 'minor', d):
            tr.put(bells, tr.bell(m, 3.0, bright=.8), B(bar, beat), .8, pan=-.2)
    pad = tr.bus()
    for v in range(3):
        notes = [(B(b), CH[c4(b)][v], tr.barlen + .05) for b in LIGHT]
        pad += tr.saw_line(notes, K=30, cutoff=tr.lin([(0, 500), (B(11), 1800), (B(12), 600), (B(28), 500)]),
                           res=4, detune=(-10, 10), attack=.3, release=.6, glide=.15)

    drums = tr.bus()
    step = tr.kick(hi=90, lo=34, tau_f=.05, tau_a=.35, p2=.4, drive=2.5, dur=1.4)   # the giant walking
    STEPS = [B(b, q) for b in range(4, 8) for q in (0, 2)]
    for t0 in STEPS:
        tr.put(drums, step, t0, .8)
    kick = tr.kick(hi=200, lo=45, tau_f=.022, tau_a=.11, p2=.35, click=.3)
    KICK = [B(b, q) for b in (8, 9, 10) for q in range(4)] + [B(11, q / 2) for q in range(6)]
    for b in range(12, 24):
        KICK += [B(b), B(b, 2.5 if b % 2 == 0 else 1.75)]
        if b >= 20 and b % 4 == 3:
            KICK += [B(b, 3.5)]
    KICK = sorted(KICK)
    for t0 in KICK:
        tr.put(drums, kick, t0, .8 if t0 < B(12) else 1.0)
    snare = lambda tune=1.0: tr.snare(tune=tune, tau=.07, body=1.2)
    ROLL = ([B(b, q) for b in (8, 9) for q in range(4)] + [B(10, q / 2) for q in range(8)] + [B(11, q / 4) for q in range(12)])
    for t0 in ROLL:
        u = (t0 - B(8)) / (B(11, 3) - B(8))
        tr.put(drums, snare(1 + .7 * u), t0, .3 + .6 * u ** 1.3, noise=True)
    for b in range(12, 24):
        tr.put(drums, snare(), B(b, 2), 1.0, noise=True)
    hats = tr.bus()
    for b in list(range(8, 11)) + list(range(12, 24)):
        for e in range(8):
            tr.put(hats, tr.hat(), B(b, e / 2), (.5 if e % 2 else .3) * (.6 if b < 12 else 1), pan=.3, noise=True)
    nobody = tr.sung([(B(10, 2), 55, .9 * tr.beat, 'o'), (B(10, 3), 52, .9 * tr.beat, 'o'), (B(11), 50, 1.6 * tr.beat, 'i')],
                     attack=.03, release=.2, glide=.05, vib=(5, .08, .3), breath=.1, seed=33, fscale=.8)

    PAT_A = [(0, 1, 0, 1, 0), (1, 1, 0, .5, 0), (2, 1, 0, 1 / 3, 0), (3, .5, 12, .25, -12)]
    PAT_B = [(0, 1.5, 0, .75, 0), (1.5, .5, 7, .25, 0), (2, 1, 0, .5, -12), (3, 1, 0, 1 / 6, 0)]
    RID_1 = [(0, 1, 0, 1 / 3, 0), (1, 1, 0, 1 / 3, 0), (2, .5, 12, 1 / 6, 0), (2.5, .5, 0, 1 / 3, 0), (3, .5, 0, 1 / 3, -7)]
    RID_2 = [(0, 1.5, 0, .5, 0), (1.5, 1, 0, 1 / 3, 0), (2.5, .5, 12, 1 / 6, -12), (3, .5, 3, .25, 0)]
    wn = []
    for b in range(12, 24):
        pat = (PAT_A if b % 2 == 0 else PAT_B) if b < 20 else (RID_1 if b % 2 == 0 else RID_2)
        for off, L, iv, cyc, dive in pat:
            wn.append((B(b, off), L * tr.beat, ROOT[c4(b)] + iv, cyc * tr.beat, dive))
    wn.append((B(24), 2.4, ROOT[0], tr.beat, -12))       # the last stone falls short
    wa = tr.womp([n for n in wn if n[0] < B(20)], KICK, growl=1.0, beta_max=7, drive=6, rasp=.35)
    wb = tr.womp([n for n in wn if n[0] >= B(20)], KICK, hi=4200, growl=1.3, beta_max=9, drive=8, rasp=.45)
    bass = np.stack([wa['L'] + wb['L'], wa['R'] + wb['R']]); sub = wa['sub'] + wb['sub']
    candy = tr.bus(); gi = 0
    for b in range(14, 24):
        pool = [m + 12 for m in CH[c4(b)]] + [m + 24 for m in CH[c4(b)]]
        for s, hit in enumerate(euclid([3, 5, 8, 5][b % 4], 16, rot=3 * b)):
            if hit:
                tr.put(candy, tr.fm(pool[int((gi * PHI) % 1 * len(pool))], .09, ratio=PHI, beta=3, tau_b=.015, tau_a=.03),
                       B(b, s / 4), .5, pan=.8 * np.sin(gi * 2.39996)); gi += 1
    imp = tr.impact(B(12), crash=.5) + .6 * tr.impact(B(20), crash=.35)

    drums = norm_rms(drums, -19); hats = norm_rms(hats, -32); arp = norm_rms(arp, -26); pad = norm_rms(pad, -28)
    bells = norm_rms(bells, -24); nobody = norm_rms(nobody, -36)   # sparse: 1.4 s of 46, so its notes sit near -21 dB
    bass = norm_rms(bass, -17); sub = norm_rms(sub, -20); candy = norm_rms(candy, -33); imp = norm_rms(imp, -24)
    vac = tr.window(B(11, 3), B(12), edge=.03)
    drums = drums * (1 - vac) + np.stack([fft_eq(c, SR, [(150, -40), (300, 0)]) for c in drums]) * vac
    duck = tr.pump(KICK, -3, .12)
    room = tr.reverb(arp + bells + .4 * pad + .3 * drums * (tr.t < B(24)) + candy + .5 * nobody, hp=300,
                     t60_lo=2.8, t60_hi=.9, dur=4.0, seed=9)                       # a cave
    echo = tr.delay(arp + bells + candy, .75 * tr.beat, fb=.35, reps=5, lp=4000)
    mix = drums + imp + nobody + duck * (hats + arp + bells + pad + .4 * norm_rms(room, -24) + .3 * echo + candy + bass + np.stack([sub, sub]))
    return chapter(tr, mix, (B(26), B(28) + 1.0),
                   [(0, 'the cave'), (B(4), 'footsteps'), (B(8), 'the roll'), (B(10, 2), 'No-bo-dy'),
                    (B(12), 'the blinding'), (B(20), 'stones'), (B(24), 'away')])


# ====================================================================== II. Aeolus (Koresma)
def wind(tr, pts, seeds=(41, 42), center=500):
    """Wind as moving band noise: a centre frequency that wanders on two slow sines and rises with the
    gust envelope `pts` [(t, 0..1)]."""
    out = tr.bus()
    env = tr.sweep(pts)
    for ch, sd in enumerate(seeds):
        z = tr.noise(tr.N, 60, 9000, .6, seed=sd)
        ff, tt, Z = signal.stft(z, SR, nperseg=2048)
        g = np.interp(tt, tr.t[::1000], env[::1000])
        fc = center * 2 ** (1.2 * np.sin(2 * np.pi * .07 * tt + ch) + .6 * np.sin(2 * np.pi * .19 * tt + 2 * ch)) * (1 + 2.5 * g)
        Z *= np.exp(-.5 * (np.log2(np.maximum(ff, 1)[:, None] / fc[None, :]) / .55) ** 2)
        _, x = signal.istft(Z, SR, nperseg=2048)
        x = x[:tr.N]; out[ch, :len(x)] = x / (np.abs(x).max() + 1e-9)
    return out * env


def aeolus():
    s = Song(SLUG, 'II. Aeolus (after Koresma)', bpm=100, bars=24, seed=76,
             prog=[[48, 55, 59, 62, 64], [45, 52, 55, 59, 60], [41, 48, 52, 55, 57], [43, 50, 52, 55, 59]])
    tr, B = s.tr, s.at
    guitar = lambda m, L: .55 * (tr.pluck(m, 1.0, bright=.2) + tr.pluck(m + .06, 1.0, bright=.22))
    s.arp('guitar', span(0, 24), guitar, rate=.25, order=(0, 2, 1, 3, 2, 4, 3, 1), octave=12, vel=.55, pan_spread=.25)
    glass = at_bars(theme(76, 'major'), 6) + at_bars(theme(76, 'major', DEG_B), 10) + at_bars(theme(76, 'major'), 12) \
        + at_bars(theme(76, 'minor'), 18) + at_bars(theme(76, 'minor', DEG_B), 20)      # blown back: the theme in minor
    s.melody('glass', glass, inst=lambda m, L: tr.bell(m, 2.0, bright=.9), pan=.3)
    GROOVE = span(4, 16, 18, 22)
    s.bass('bass', GROOVE, [(0, 0, .75), (1.5, 0, .25), (1.75, 7, .5), (2.5, 12, .5), (3.25, 7, .5)], kind='sine', lo=33, harm=(1.0, .45, .2))
    s.drums('kick', 'X.....X.X.....x.', GROOVE, tr.kick(hi=140, lo=52, tau_a=.11, p2=.3, click=.25, drive=1.5), kick=True, swing=.2)
    s.drums('snare', '....X.......X...', GROOVE, tr.layer(tr.snare(1.05, .07, body=1.2), .4 * tr.clap()), noise=True, swing=.2)
    s.drums('shaker', 'xoxoxoxoxoxoxoxo', span(2, 16, 18, 22), tr.shaker(), noise=True, swing=.2)
    s.drums('hats', '..x...x...x...x.', span(8, 16, 18, 22), tr.hat(True, .2), vel=.6, noise=True, swing=.2)
    # the bag of winds: tied shut it only whispers; at bar 16 a sailor opens it
    s.add('wind', wind(tr, [(0, .08), (B(12), .12), (B(15.5), .3), (B(16), 1.0), (B(18), .8), (B(22), .5), (B(24), .2)]))
    s.add('gust', tr.impact(B(16), crash=.8))
    tr.noise_window = getattr(tr, 'noise_window', []) + [(B(15.5), B(18))]
    s.sections = [(0, 'setting sail'), (B(4), 'groove'), (B(6), 'the theme on glass'), (B(16), 'the bag opens'),
                  (B(18), 'blown back')]
    mix = s.mixdown({'guitar': -23, 'glass': -25, 'bass': -21, 'kick': -20, 'snare': -23, 'shaker': -32, 'hats': -32,
                     'wind': -24, 'gust': -31},
                    pump=('kick', -2, .15, ['guitar']), sends={'guitar': .35, 'glass': .5, 'snare': .25},
                    room=dict(t60_lo=2.2, t60_hi=1.0, dur=3.0, seed=21, wet=.4),
                    delay_sends={'glass': .5, 'guitar': .2}, delay=dict(d_s=.75 * tr.beat, fb=.4, reps=6, lp=4000),
                    master=False)
    return chapter(tr, mix, (B(22), B(24) + 1.5), s.sections)


# ====================================================================== III. Circe (Shpongle)
def circe():
    s = Song(SLUG, 'III. Circe (after Shpongle)', bpm=128, bars=28, div=60, seed=74,
             prog=[[52, 56, 59, 64], [53, 56, 60, 65], [52, 56, 59, 64], [50, 53, 57, 62]])
    tr, B = s.tr, s.at
    roll = [(q + .25 * k, 0, .2) for q in range(4) for k in (1, 2, 3)]
    ROLL = span(8, 24)
    s.bass('psybass', ROLL, roll, kind='saw', cutoff=500, res=5, env=3.0, lo=28, K=30, release=.02)
    s.drums('kick', 'X...X...X...X...', ROLL, tr.kick(hi=170, lo=48, tau_f=.02, tau_a=.08, p2=.2, click=.3), kick=True)
    s.drums('hats', '..x...x...x...x.', ROLL, tr.hat(True, .2), noise=True)

    def tabla(b, i):
        m = (62, 69, 64, 74)[i % 4]
        n = int(.25 * SR); t = np.arange(n) / SR
        f = 440 * 2 ** ((m - 69) / 12) * (1 + .3 * np.exp(-t / .03))
        return tr.endfade(tr.attack(n) * np.exp(-t / .07) * (np.sin(2 * np.pi * np.cumsum(f) / SR) + .3 * np.sin(2 * np.pi * np.cumsum(2.9 * f) / SR)))
    s.drums('tabla', 'x.ox.xo.x.oxx.o.', span(0, 28), tabla, vel=.6, pan=-.3)
    flute = []
    for bar, d in ((4, DEG), (6, DEG_B), (12, DEG), (14, DEG_B), (20, DEG), (22, DEG_B)):
        flute += [(b, bt, m, L, 'u') for b, bt, m, L in at_bars(theme(76, 'phrdom', d), bar)]
    s.melody('flute', flute, sung=dict(attack=.05, release=.2, glide=.06, vib=(5.8, .1, .25), breath=.35, seed=120,
                                       fscale=1.35, tilt=2.2, formant_glide=.05))
    # the men become swine: low grunts that slide down, answering the flute
    grunt = [(b, bt, m, .4, 'o') for b in (10, 11, 12, 13) for bt, m in ((1.5, 40), (3.5, 38))]
    s.melody('swine', grunt, sung=dict(attack=.02, release=.08, glide=.12, vib=(9, .5, .02), breath=.4, seed=124, fscale=.7, tilt=1.0))
    sitar = lambda m, L: tr.fm(m, 1.4, ratio=2.0, beta=2.5, tau_b=.25, tau_a=.6) + .3 * tr.fm(m + 12, 1.4, ratio=PHI, beta=1.2, tau_b=.1, tau_a=.3)
    SIT = [(0, 64, .25), (.25, 65, .25), (.5, 68, .5), (1, 69, .25), (1.25, 68, .25), (1.5, 65, .5), (2, 64, 1)]
    s.melody('sitar', [(b, bt + 2 * (b % 2), m, L) for b in span(16, 24) for bt, m, L in SIT], inst=sitar, pan=.35)   # Hermes and the moly
    s.pad('pad', span(0, 28), K=24, cutoff=1400, res=6, detune=(-14, -3, 6, 15), attack=1.5, release=2.0,
          amod=.75 + .25 * np.sin(2 * np.pi * .15 * tr.g.th))
    s.sections = [(0, "Circe's hall"), (B(4), 'the theme on flute'), (B(8), 'the drink'), (B(10), 'swine'),
                  (B(16), "Hermes' sitar"), (B(24), 'free')]
    mix = s.mixdown({'psybass': -21, 'kick': -19, 'hats': -31, 'tabla': -27, 'flute': -22, 'swine': -33, 'sitar': -25, 'pad': -27},
                    pump=('kick', -4, .1, ['pad', 'psybass']), sends={'flute': .5, 'sitar': .5, 'tabla': .3, 'pad': .3, 'swine': .3},
                    room=dict(t60_lo=3.5, t60_hi=1.5, dur=4.5, seed=19, wet=.5),
                    delay_sends={'flute': .4, 'sitar': .5, 'tabla': .3}, delay=dict(d_s=.75 * tr.beat, fb=.55, reps=8, lp=2800),
                    master=False)
    return chapter(tr, mix, (B(26), B(28) + 1.5), s.sections)


# ====================================================================== IV. The Underworld (Clams Casino)
def underworld():
    tr = Track(SLUG, 'IV. The Underworld (after Clams Casino)', bpm=75, bars=20, tail=3.2, div=192, seed=51)
    B = tr.at
    CH = [[53, 56, 60, 61], [53, 54, 58, 61], [53, 56, 61, 63], [51, 56, 60, 63]]
    ROOT = [34, 30, 37, 29]
    c4 = lambda b: b % 4
    SW8 = 7 / 12
    DRUMS = list(range(4, 10)) + list(range(12, 17))
    VOW = 'aoau'
    PHR = [(b, DEG if b % 4 == 0 else DEG_B) for b in list(range(0, 10, 2)) + list(range(12, 20, 2))]
    hn = []
    for b, d in PHR:
        for i, (o, m, L) in enumerate(theme(70, 'minor', d)):
            hn.append((B(b, o), m, L * tr.beat * .92, VOW[i % 4], .65 if b < 4 else 1.0))
    hook = tr.sung(hn, attack=.03, release=.35, glide=.05, vib=(4.8, .12, .25), breath=.08, seed=70, fscale=.85, formant_glide=.05)
    choir = tr.bus()                                    # the shades
    for v in range(4):
        notes = [(B(b), CH[c4(b)][v] + (12 if v == 3 else 0) - 12 * (v == 0), tr.barlen + .1, 'ao'[(b + v) % 2], .8) for b in range(20)]
        x = tr.sung(notes, attack=.9, release=1.5, glide=.25, vib=(4.3, .07, .6), breath=.05, seed=80 + v, fscale=.82, formant_glide=.6, K=50)
        pan = (-.7, -.25, .25, .7)[v]
        choir[0] += x[0] * min(1, 1 - pan); choir[1] += x[1] * min(1, 1 + pan)
    hall_ir = tr.ir(t60_lo=4.5, t60_hi=2.0, f_lo=400, f_hi=6000, dur=3.0, seed=17, predelay=.0)
    swell = tr.bus()
    for b, _ in PHR:
        if b in (0, 12):
            continue
        i0 = int(B(b) * SR); seg = hook[0, i0:i0 + int(.9 * SR)]
        wet = signal.fftconvolve(seg, hall_ir)[:int(2.4 * SR)][::-1].copy()
        wet = tr.endfade(wet * tr.attack(len(wet), 20), .04)
        a = max(0, i0 - len(wet)); wet = wet[len(wet) - (i0 - a):]
        swell[:, a:i0] += wet
        tr.onsets.append(B(b))

    def eight08(m, L, slide_to=None):
        n = int((L + .05) * SR); t = np.arange(n) / SR
        f0 = float(hz(m)); f = f0 * (1 + 1.2 * np.exp(-t / .022))
        if slide_to is not None:
            u = np.clip((t - (L - .14)) / .12, 0, 1)
            f = f * (hz(slide_to) / f0) ** (u * u * (3 - 2 * u))
        y = np.tanh(1.8 * np.exp(-t / 1.3) * np.sin(2 * np.pi * np.cumsum(f) / SR)) / np.tanh(1.8)
        return tr.endfade(y * tr.attack(n), .03)
    b808 = tr.bus(); K808 = []
    for b in DRUMS:
        r = ROOT[c4(b)]
        for o, iv, L, sl in [(0, 0, 1.5, None), (1.75, 0, .75, None), (2.5, 7, 1.5, 0)]:
            tr.put(b808, eight08(r + iv, L * tr.beat, None if sl is None else r + sl), B(b, o)); K808.append(B(b, o))
    drums = tr.bus()
    punch = tr.kick(hi=160, lo=60, tau_f=.02, tau_a=.04, p2=.2, click=.35, dur=.2)
    for t0 in K808:
        tr.put(drums, punch, t0, .5)
    snare = tr.snare(tune=1.15, tau=.08, body=.7); clap = tr.clap()
    for t0 in [B(b, q) for b in DRUMS for q in (1, 3)]:
        tr.put(drums, snare, t0, .55, noise=True); tr.put(drums, clap, t0, .7, noise=True)
    hats = tr.bus()
    for b in DRUMS + [10, 11]:
        filt = b in (10, 11)
        for q in range(4):
            tr.put(hats, tr.hat(), B(b, q), .5 * (.5 if filt else 1), pan=.25, noise=True)
            tr.put(hats, tr.hat(), B(b, q + SW8), .32 * (.5 if filt else 1), pan=.25, noise=True)
        if not filt and b % 2 == 1:
            roll = [B(b, 3 + k / 6) for k in range(6)] if b % 4 == 1 else [B(b, 3.5 + k / 8) for k in range(4)]
            for k, t0 in enumerate(roll):
                tr.put(hats, tr.hat(), t0, .2 + .05 * k, pan=-.2 + .08 * k, noise=True)
    pad = tr.bus()
    for v in range(4):
        pad += tr.saw_line([(B(b), CH[c4(b)][v], tr.barlen + .1) for b in range(20)], K=24, cutoff=900, res=2,
                           detune=(-12, 12), attack=.8, release=1.5, glide=.2)

    choir = norm_rms(choir, -25); hook = norm_rms(hook, -21); pad = norm_rms(pad, -31); swell = norm_rms(swell, -30)
    b808 = norm_rms(b808, -18); drums = norm_rms(drums, -21); hats = norm_rms(hats, -33)
    hall = tr.reverb(hook + 1.4 * choir + .5 * pad, hp=200, t60_lo=4.5, t60_hi=2.0, f_lo=400, f_hi=6000, dur=6.0, seed=19, predelay=.03, dark=7000)
    plate = tr.reverb(drums, hp=500, t60_lo=1.8, t60_hi=1.4, f_lo=800, f_hi=10000, dur=2.5, seed=23, predelay=.01)
    echo = tr.delay(hook, .75 * tr.beat, fb=.4, reps=6, lp=2800)
    melodic = hook * .9 + choir + pad + .7 * norm_rms(hall, -21) + .3 * echo + swell
    d = (.002 + .0011 * np.sin(2 * np.pi * .45 * tr.t) + .0003 * np.sin(2 * np.pi * 1.7 * tr.t + 1.0)) * SR
    idx = np.arange(tr.N) - d
    melodic = np.stack([np.interp(idx, np.arange(tr.N), c) for c in melodic])
    melodic = np.stack(dirt(melodic[0], melodic[1], SR, 1.6, lp_hz=11000))
    duck = tr.pump(K808, -3, .25)
    hiss = np.stack([fft_eq(tr.noise(tr.N, 300, 12000, .5, seed=q), SR, [(2000, 0), (9000, -6)]) for q in (90, 91)])
    hiss = 10 ** (-52 / 20) * hiss / np.sqrt(np.mean(hiss ** 2))
    mix = duck * melodic + b808 + drums + .25 * norm_rms(plate, -24) + hats + hiss
    a, b_ = int(B(16, 3) * SR), int(B(17) * SR)              # the tape stop: the living leave
    u = np.arange(b_ - a) / (b_ - a)
    pos = a + np.cumsum(1 - u ** 1.4)
    mix[:, a:b_] = np.stack([np.interp(pos, np.arange(tr.N), c) for c in mix]) * (1 - u ** 3)
    tr.noises += list(np.arange(B(16, 3), B(17), tr.H / SR * 4))
    mix[:, b_:] = (duck * melodic)[:, b_:] + hiss[:, b_:]
    mix = np.stack([fft_eq(c, SR, [(7000, 0), (12000, -6), (17000, -18)]) for c in mix])
    return chapter(tr, mix, (B(17.5), B(20) + 2.5),
                   [(0, 'the shades'), (B(4), 'Tiresias'), (B(10), 'the mother'), (B(12), 'the line of the dead'),
                    (B(16, 3), 'tape stop'), (B(17), 'the shades remain')])


# ====================================================================== V. The Sirens (Jon Hopkins)
def sirens():
    tr = Track(SLUG, 'V. The Sirens (after Jon Hopkins)', bpm=125, bars=32, tail=2.5, seed=21)
    B = tr.at
    CH = [[56, 60, 63, 70], [53, 56, 60, 67], [53, 56, 61, 63], [55, 58, 63, 68]]
    ROOT = [44, 41, 37, 39]
    chord_of = lambda bar: bar // 2 % 4
    ROW = list(range(0, 16)) + list(range(20, 30))           # the oars
    KICK = sorted([B(b, q) for b in ROW for q in range(4)] + [B(18, q) for q in range(4)] + [B(19, q / 2) for q in range(6)])
    drums = tr.bus()
    k_soft = tr.kick(hi=170, lo=46, tau_f=.03, tau_a=.12, p2=.3, click=.15, drive=3.0)
    k_hard = tr.kick(hi=190, lo=44, tau_f=.028, tau_a=.14, p2=.35, click=.25, drive=6.0)
    for t0 in KICK:
        tr.put(drums, k_hard if t0 >= B(20) else k_soft, t0, .95 if t0 >= B(20) else .8)
    clap = tr.clap()
    for t0 in [B(b, q) for b in list(range(4, 16)) + list(range(20, 30)) for q in (1, 3)]:
        tr.put(drums, clap, t0, .5, noise=True)
    hats = tr.bus()
    for b in list(range(2, 16)) + list(range(20, 30)):
        for st in range(16):
            tr.put(hats, tr.hat(), B(b, st / 4), (.55, .25, .4, .25)[st % 4] * (1.0 if b >= 4 else .6), pan=.25 * np.sin(st * 2.4), noise=True)
    glitch = tr.bus(); gi = 0                               # spray off the oars
    dens = lambda b: 3 if b < 4 else 5 if b < 16 else 2 if b < 20 else 9 if b < 28 else 4
    for b in range(0, 30):
        for st, hit in enumerate(euclid(dens(b), 32, rot=5 * b)):
            if hit:
                kind = ('blip', 'tick', 'grain')[int((gi * PHI) % 1 * 3)]
                tr.put(glitch, tr.glitch(kind, 100 + gi), B(b, st / 8), .25 + .2 * tr.rng.random(), pan=.85 * np.sin(gi * 2.39996), noise=(kind == 'tick'))
                gi += 1
    PAT = [0, 0, 12, 0, 0, 12, 0, 7, 0, 0, 12, 0, 0, 12, 10, 7]
    ACC = [1, .6, .9, .6, .8, .9, .6, .8, 1, .6, .9, .6, .8, .9, .8, .9]
    bnotes = [(B(b, st / 4), ROOT[chord_of(b)] + PAT[st], tr.beat / 4 * .8, ACC[st]) for b in list(range(0, 16)) + list(range(18, 30)) for st in range(16)]
    since = tr.since_onset([n[0] for n in bnotes])
    cut = tr.lin([(0, 260), (B(8), 900), (B(16), 1400), (B(18), 300), (B(20), 2400), (B(28), 3200), (B(30), 500), (B(32), 400)]) * (1 + 2.2 * np.exp(-since / .06))
    bass = tr.saw_line(bnotes, K=40, cutoff=cut, res=7, detune=(-6, 6), pans=(-.3, .3), attack=.004, release=.03, glide=.004)
    sub = tr.sine_line([(B(b), ROOT[chord_of(b)] - 12, tr.barlen) for b in list(range(0, 16)) + list(range(18, 30))], attack=.01, release=.1)
    pad = tr.bus()
    amod = tr.lin([(0, 0), (B(4), .5), (B(16), .6), (B(19.9), 1.0), (B(20), .85), (B(30), .85), (B(32), .5)])
    for v in range(4):
        pad += tr.saw_line([(B(b), CH[chord_of(b)][v], 2 * tr.barlen + .1) for b in range(4, 32, 2)], K=36,
                           cutoff=tr.lin([(0, 400), (B(8), 900), (B(16), 900), (B(20), 3800), (B(30), 2400), (B(32), 700)]),
                           res=3, detune=(-9, 0, 9), pans=(-.8, 0, .8), attack=.6, release=1.2, glide=.25, amod=amod)
    # the sirens: three voices that slide, in close harmony, their own song (not the theme)
    SONG = [(0, 80, 2, 'a'), (2, 79, 1, 'i'), (3, 77, 1, 'a'), (4, 75, 3, 'e'), (7, 77, 1, 'a')]
    sir = tr.bus()
    for k, (shift, pan, sd) in enumerate(((0, 0.0, 61), (-4, -.55, 62), (-9, .55, 63))):
        notes = [(B(b, o), m + shift + (1 if shift == -4 and m in (79, 75) else 0), L * tr.beat * .97, v, .9 if b < 20 else 1.0)
                 for b in list(range(8, 16, 2)) + list(range(20, 30, 2)) for o, m, L, v in SONG]
        x = tr.sung(notes, attack=.25, release=.6, glide=.35, vib=(5.5, .2, .4), breath=.12, seed=sd, fscale=1.12, formant_glide=.2)
        sir[0] += x[0] * min(1, 1 - pan); sir[1] += x[1] * min(1, 1 + pan)
    piano = tr.bus()                                    # Odysseus, bound to the mast, answers
    for bar, d in ((16, DEG), (18, DEG_B), (20, DEG), (22, DEG_B), (24, DEG), (26, DEG_B)):
        for o, m, L in theme(68, 'major', d):
            tr.put(piano, tr.piano(m, .55 + .15 * tr.rng.random(), felt=.35), B(bar, o), pan=.15)
        r = ROOT[chord_of(bar)] - 12 + 24
        for m in (r, r + 7):
            tr.put(piano, tr.piano(m, .5, felt=.5), B(bar), .7, pan=-.25)
    imp = tr.impact(B(20), crash=.35)

    drums = norm_rms(drums, -19); hats = norm_rms(hats, -34); glitch = norm_rms(glitch, -33); sir = norm_rms(sir, -22)
    bass = norm_rms(bass, -21); sub = norm_rms(sub, -24); pad = norm_rms(pad, -24); piano = norm_rms(piano, -23); imp = norm_rms(imp, -28)
    # the crew's wax: while the sirens sing, everything but the sirens is heard through stopped ears
    wax = tr.sweep([(0, 0), (B(7.5), 0), (B(8), 1), (B(15.5), 1), (B(16), 0), (B(32), 0)])
    def waxed(x):
        dark = np.stack([fft_eq(c, SR, [(250, 0), (700, -24)]) for c in x])
        return x * (1 - wax) + dark * wax
    crew = waxed(drums + hats + glitch); bass = waxed(bass)
    breath = np.where(tr.t >= B(20), tr.pump(KICK, -8, .2), tr.pump(KICK, -4, .15))
    breath = np.where((tr.t >= B(16)) & (tr.t < B(18)), 1.0, breath)
    vac = tr.window(B(19, 3), B(20), edge=.03)
    crew = crew * (1 - vac) + np.stack([fft_eq(c, SR, [(120, -40), (300, 0)]) for c in crew]) * vac
    room = tr.reverb(.6 * piano + .4 * pad + .8 * sir + .4 * drums * (tr.t < B(30)) + glitch, hp=300,
                     t60_lo=3.2, t60_hi=1.0, f_lo=500, f_hi=8000, dur=4.5, seed=7)
    echo = tr.delay(piano + .5 * sir, .75 * tr.beat, fb=.38, reps=6, lp=3500)
    mix = crew + imp + sir + breath * (bass + np.stack([sub, sub]) + pad + .9 * piano + .4 * norm_rms(room, -22) + .3 * echo)
    return chapter(tr, mix, (B(29), B(32) + 1.5),
                   [(0, 'the oars'), (B(8), 'the sirens (wax in the ears)'), (B(16), 'bound to the mast'),
                    (B(20), 'release'), (B(30), 'past them')])


# ====================================================================== VI. Calypso (Eno)
def calypso():
    tr = Track(SLUG, 'VI. Calypso (after Brian Eno)', bpm=60, bars=16, tail=2.0, div=192, seed=11)
    END = 50.0
    # seven loops for seven years; no period is a multiple of another
    LOOPS = [(7.3, 1.0, [(0, 65)], 'felt', .55, -.3), (8.9, 2.4, [(0, 57), (.5, 60)], 'felt', .5, .25),
             (10.7, 4.5, [(0, 74)], 'felt', .42, .5), (11.9, 6.0, [(0, 72), (1.0, 69)], 'felt', .45, -.5),
             (13.1, .2, [(0, 53)], 'felt', .6, 0.0), (14.3, 9.3, [(0, 67)], 'bell', .22, .6),
             (16.7, 12.0, [(0, 76)], 'bell', .18, -.6)]
    piano, bells = tr.bus(), tr.bus()
    for period, first, phrase, inst, vel, pan in LOOPS:
        k = 0
        while first + k * period < END:
            for off, m in phrase:
                t0 = tr.snap(first + k * period + off); v = vel * (.88 + .24 * tr.rng.random())
                if inst == 'felt':
                    tr.put(piano, tr.piano(m, v, felt=.8), t0, pan=pan)
                else:
                    tr.put(bells, tr.bell(m, 7.0, bright=.8), t0, v, pan=pan)
            k += 1
    # the theme, slowed until it is a loop: one beat becomes a second and a half
    th_notes = []
    for start, d in ((14.0, DEG), (30.0, DEG_B)):
        for o, m, L in theme(65, 'major', d, stretch=1.5):
            th_notes.append((tr.snap(start + o), m, L * .95, 'u' if m < 72 else 'o', .9))
    voice = tr.sung(th_notes, attack=.6, release=1.5, glide=.3, vib=(4.6, .08, .8), breath=.06, seed=44, formant_glide=1.0)
    drone = tr.bus()
    for m, per, ph in ((41, 11.0, 0.0), (48, 13.0, 1.7), (53, 17.0, 3.1)):
        amod = .55 + .45 * np.sin(2 * np.pi * tr.g.th / per + ph) ** 2
        drone += tr.saw_line([(0.0, m, 62.0)], K=10, cutoff=500, attack=6.0, release=4.0, amod=amod, detune=(-3, 3), pans=(-.4, .4))
    piano = norm_rms(piano, -24); bells = norm_rms(bells, -30); voice = norm_rms(voice, -25); drone = norm_rms(drone, -30)
    hall = tr.reverb(piano + .8 * bells + .9 * voice + .3 * drone, hp=180, t60_lo=7.0, t60_hi=3.0, f_lo=400, f_hi=6000,
                     dur=10.0, seed=3, predelay=.045, dark=5000)
    echo = tr.delay(piano + .5 * bells, 2.1, fb=.42, reps=6, lp=2500, pingpong=.7)
    mix = .8 * piano + .8 * bells + .8 * voice + drone + .55 * norm_rms(hall, -24) + .25 * echo
    return chapter(tr, mix, (54.0, 62.0), [(0, 'the island'), (14.0, 'the theme, slowed'), (30.0, 'its answer'), (50.0, 'the raft')])


# ====================================================================== VII. Ithaca (Fred again..)
def ithaca():
    s = Song(SLUG, 'VII. Ithaca (after Fred again..)', bpm=128, bars=33, div=60, seed=70, tail=2.5,
             prog=[[55, 58, 63], [55, 58, 63, 67], [56, 60, 63, 67], [53, 58, 62]])
    tr, B = s.tr, s.at
    s.stabs('piano', span(0, 30), [(0, 2, .8), (2.5, 1.5, .6)], lambda m, L: tr.piano(m, .55, felt=.3), spread=.3)
    VOW = 'aeoai'
    vox = []
    for bar in range(0, 30, 2):
        d = DEG if bar % 4 == 0 else DEG_B
        vox += [(b, bt, m, min(L, .75), VOW[i % 5]) for i, (b, bt, m, L) in enumerate(at_bars(theme(75, 'major', d), bar))]
    s.melody('vox', vox, sung=dict(attack=.015, release=.12, glide=.04, vib=(5, .06, .3), breath=.07, seed=101, fscale=1.05, formant_glide=.03))
    for b in (7, 15, 27, 29):
        s.stutter('vox', B(b, 2), .25 if b % 2 else .125, 8)
    # the bow: strung and plucked (a low twang that drops in pitch), and it sings like a swallow
    n = int(1.6 * SR); t = np.arange(n) / SR
    f = 82 * (1 + .08 * np.exp(-t / .05)); ks = np.arange(1, 25)
    twang = sum(np.exp(-t / (.9 / (1 + .5 * (k - 1)))) * np.sin(2 * np.pi * k * np.cumsum(f) / SR) / k for k in ks)
    bow = tr.bus(); tr.put(bow, tr.endfade(tr.attack(n) * twang), B(8))
    bow += tr.sung([(B(8, .25), 96, .3, 'i'), (B(8, .5), 91, .5, 'i')], attack=.02, release=.15, glide=.12,
                   vib=(7, .3, .05), breath=.15, seed=105, fscale=1.4)
    s.add('bow', bow)
    BEAT = span(8, 16, 20, 30)
    s.drums('kick', 'X...X...X...X...', BEAT, tr.kick(hi=150, lo=48, tau_a=.14, p2=.3, click=.2), kick=True)
    s.drums('clap', '....X.......X...', span(12, 16, 20, 30), tr.clap(), noise=True)
    s.drums('hats', 'x-o-x-ox-xo-x-ox', BEAT, tr.hat(), noise=True, swing=.3)
    s.bass('sub', BEAT, [(0, 0, .75), (1, 0, .75), (2, 0, .75), (2.75, 7, .25), (3, 0, .75)], kind='sine', lo=27, harm=(1.0, .25))
    # home: the piano lands the theme alone, ending on the octave
    s.melody('home', at_bars(theme(63, 'major', stretch=1.0), 30) + [(32, 0, 51, 4), (32, 0, 58, 4), (32, 0, 63, 4)],
             inst=lambda m, L: tr.piano(m, .6, felt=.4))
    s.sections = [(0, 'piano and the found voice'), (B(8), 'the bow is strung'), (B(16), 'Penelope'),
                  (B(20), 'the beat returns'), (B(30), 'home')]
    mix = s.mixdown({'piano': -23, 'vox': -22, 'bow': -35, 'kick': -21, 'clap': -26, 'hats': -31, 'sub': -23, 'home': -32},
                    pump=('kick', -6, .18, ['piano', 'sub', 'hats']), sends={'piano': .45, 'vox': .45, 'clap': .3, 'home': .5, 'bow': .4},
                    room=dict(t60_lo=2.8, t60_hi=1.2, dur=4.0, seed=15, wet=.45),
                    delay_sends={'vox': .35}, delay=dict(d_s=.75 * tr.beat, fb=.35, reps=6, lp=3500), master=False)
    return chapter(tr, mix, (B(32, 2), B(33) + 2.4), s.sections)


# ====================================================================== the voyage
CHAPTERS = [cyclops, aeolus, circe, underworld, sirens, calypso, ithaca]
LEVEL = [-13.0, -14.5, -13.5, -14.0, -13.5, -18.0, -13.5]     # LUFS of each chapter before the final master


def lufs(x):
    p = os.path.join(TMP, '_lvl.wav'); sf.write(p, x.T, SR, subtype='FLOAT')
    return loudness(p)[0]


def main():
    parts = []
    for fn in CHAPTERS:
        c = fn(); tr = c['tr']
        a, b = c['fade']
        u = np.clip((tr.t - a) / (b - a), 0, 1)
        x = c['mix'] * (.5 + .5 * np.cos(np.pi * u)) * (tr.t < b)
        x = x[:, :int(np.ceil(b * SR))]
        c['mix'] = x * 10 ** ((LEVEL[len(parts)] - lufs(x)) / 20)
        print(f"{c['title']}: {x.shape[1] / SR:.1f} s", flush=True)
        parts.append(c)
    # chapter i+1 enters over the second half of chapter i's fade
    starts = [0.0]
    for c in parts[:-1]:
        a, b = c['fade']
        starts.append(starts[-1] + a + .45 * (b - a))
    total = starts[-1] + parts[-1]['fade'][1] + .5
    st = Track(SLUG, 'The Odyssey in Seven', bpm=120, bars=int(np.ceil(total / 2)), tail=0.0, div=96, seed=7)
    mix = st.bus(); sections = []
    for c, s0 in zip(parts, starts):
        i0 = int(round(s0 * SR)); x = c['mix']; m = min(x.shape[1], st.N - i0)
        mix[:, i0:i0 + m] += x[:, :m]
        tr = c['tr']
        st.onsets += [s0 + t for t in tr.onsets]; st.noises += [s0 + t for t in tr.noises]
        st.noise_window = getattr(st, 'noise_window', []) + [(s0 + a, s0 + b) for a, b in getattr(tr, 'noise_window', [])]
        sections += [(round(s0 + t, 3), (c['title'].split(' (')[0] + ': ' + lab) if t == 0 else lab) for t, lab in c['sections']]
    # the wine-dark sea: waves under every crossing, and at the start and the end
    env = np.zeros(st.N)
    def hump(a, b, edge=3.0):
        return st.window(a + edge / 2, b - edge / 2, edge)
    env += hump(0, 9)
    for c, s0, s1 in zip(parts[:-1], starts[:-1], starts[1:]):
        env = np.maximum(env, hump(s0 + c['fade'][0] - 1, s1 + 6, 4.0))
    env = np.maximum(env, .4 * hump(starts[-1] + parts[-1]['fade'][0] - 4, total, 4.0))
    sea = st.bus()
    waves = (np.sin(np.pi * st.t / 7.3) ** 4 + .7 * np.sin(np.pi * st.t / 9.1 + 1) ** 4 + .4 * np.sin(np.pi * st.t / 4.3 + 2) ** 6)
    for ch, sd in enumerate((301, 302)):
        z = st.noise(st.N, 60, 4000, 1.0, seed=sd)
        ff, tt, Z = signal.stft(z, SR, nperseg=4096)
        w = np.interp(tt, st.t[::1000], waves[::1000])
        fc = 250 * 2 ** (2.2 * w / 2.1)                 # brighter as each wave breaks
        Z *= np.exp(-.5 * (np.log2(np.maximum(ff, 1)[:, None] / fc[None, :]) / .9) ** 2)
        _, x = signal.istft(Z, SR, nperseg=4096)
        sea[ch, :len(x[:st.N])] = x[:st.N]
    sea = sea * (.25 + waves / 2.1) * env
    sea = sea * 10 ** (-27 / 20) / np.sqrt(np.mean(sea[:, env > .5] ** 2))
    mix += sea
    np.save(os.path.join(TMP, 'sea.npy'), sea.astype(np.float32))
    rep = finish(st, mix, target=-14.0, fade=(total - .5, total), sections=sections,
                 notes='Seven chapters in succession: ' + '; '.join(f"{c['title']} at {s0:.1f} s" for c, s0 in zip(parts, starts)))
    json.dump([dict(title=c['title'], start=round(s0, 3), end=round(s0 + c['fade'][1], 3),
                    sections=[(round(s0 + t, 3), lab) for t, lab in c['sections']]) for c, s0 in zip(parts, starts)],
              open(os.path.join(st.dir, 'chapters.json'), 'w'), indent=1)
    return rep


if __name__ == '__main__':
    main()
