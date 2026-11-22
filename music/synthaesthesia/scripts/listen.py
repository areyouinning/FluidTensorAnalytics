"""Listening by measurement. Each command answers a kind of feedback with a number.

  python listen.py census   mix.wav [--onsets on.json] [--noise noise.json] [--bpm 120 --div 96]
  python listen.py punch    mix.wav --drop 30 [--kicks kicks.json] [--until 48] [--bpm 120]
  python listen.py energy   mix.wav --from 20 --to 30 [--step .5]
  python listen.py bands    ref.wav ours.wav [--ref-win 184 196] [--our-win 30 44]
  python listen.py beatgram mix.wav [--cuts 8,14,22,30] [--out beatgram.png]

JSON files hold a plain list of times in seconds. Without --kicks, punch assumes four on the floor.
"""
import argparse, json, os, sys
import numpy as np, soundfile as sf
from scipy import signal
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bst import Grid

BANDS = [('sub 20-60', 20, 60), ('bass 60-250', 60, 250), ('low-mid 250-1k', 250, 1000),
         ('mid 1-4k', 1000, 4000), ('high 4-12k', 4000, 12000)]


def _mono(path, sr_to=None):
    y, sr = sf.read(path, always_2d=True)
    m = y.mean(axis=1)
    if sr_to and sr != sr_to:
        from math import gcd
        g = gcd(sr, sr_to); m = signal.resample_poly(m, sr_to // g, sr // g); sr = sr_to
    return m, sr


def _band(m, sr, lo, hi):
    return signal.sosfiltfilt(signal.butter(4, [lo, min(hi, sr / 2 - 100)], 'bandpass', fs=sr, output='sos'), m)


def _db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)


def census(path, onsets=(), noise=(), bpm=120, div=96, sr=48000, hi_midi=84, verbose=True):
    """Stray clicks: >6 dB rise in >60 % of the BST bins above ~1 kHz within one hop, away from
    every scored onset (+/-2 hops) and noise burst (-2..+5 hops). Returns (n_stray, stray_times)."""
    m, sr = _mono(path, sr)
    g = Grid(sr, bpm, len(m) / sr, div)
    p, C = g.analyze(m[:g.N])
    Cd = 20 * np.log10(C + 1e-7)
    hi = p >= hi_midi
    ref = np.stack([np.roll(Cd[hi], k, axis=1) for k in range(2, 7)]).mean(axis=0)
    loud = Cd[hi] > (Cd[hi].max() - 70)
    frac = np.mean(((Cd[hi] - ref) > 6) & loud, axis=0)
    hits = [h for h in np.where(frac > .6)[0] if h > 6]
    # exclusions in milliseconds, not hops: the analysis atoms near 1 kHz are ~16 ms wide, so an onset
    # registers up to ~10 ms early; on a fine grid (div 240, 2.6 ms hops) a hop count is too narrow
    hs = g.H / sr
    pre, post_on, post_noise = int(np.ceil(.0105 / hs)), int(np.ceil(.0105 / hs)), int(np.ceil(.026 / hs))
    excl = set()
    for t0 in noise:
        excl.update(range(g.hop(t0) - pre, g.hop(t0) + post_noise + 1))
    for t0 in onsets:
        excl.update(range(g.hop(t0) - pre, g.hop(t0) + post_on + 1))
    hits = [h for i, h in enumerate(hits) if i == 0 or h - hits[i - 1] > 2]
    stray = [h * g.H / sr for h in hits if h not in excl]
    if verbose:
        print(f'{os.path.basename(path)}: {len(hits)} broadband rises, {len(stray)} stray '
              f'({len(stray) / (len(m) / sr) * 60:.0f}/min)' + (f'; first at {", ".join(f"{t:.3f}" for t in stray[:8])} s' if stray else ''))
    return len(stray), stray


def punch(path, drop, kicks=None, until=None, bpm=120):
    """Chest (50-250 Hz) and attack (2-6 kHz) punch per kick after the drop (peak in 30 ms vs
    RMS 150-350 ms after, median), slam below 250 Hz across the drop, and the vacuum level."""
    m, sr = _mono(path)
    until = until or min(len(m) / sr - .5, drop + 18)
    kicks = kicks or list(np.arange(drop, until, 60 / bpm))
    out = {}
    for name, (lo, hi) in {'chest 50-250 Hz': (50, 250), 'attack 2-6 kHz': (2000, 6000)}.items():
        b = _band(m, sr, lo, hi)
        r = [20 * np.log10(np.abs(b[int(t * sr):int((t + .03) * sr)]).max() /
                           (np.sqrt(np.mean(b[int((t + .15) * sr):int((t + .35) * sr)] ** 2)) + 1e-12))
             for t in kicks if drop <= t < until]
        out[name] = float(np.median(r))
    seg = m[int(drop * sr):int(until * sr)]
    out['crest'] = float(20 * np.log10(np.abs(seg).max() / np.sqrt(np.mean(seg ** 2))))
    lo = _band(m, sr, 20, 250)
    w = lambda a, b: _db(lo[int(a * sr):int(b * sr)])
    out['slam <250 Hz'] = float(w(drop, drop + .5) - w(drop - .4, drop - .05))
    out['vacuum <250 Hz (dBFS)'] = float(w(drop - .4, drop - .05))
    return out


def energy(path, a, b, step=.5):
    """RMS above 100 Hz in steps: does the energy dip anywhere it shouldn't?"""
    y, sr = sf.read(path, always_2d=True)
    m = signal.sosfiltfilt(signal.butter(2, 100, 'highpass', fs=sr, output='sos'), y.mean(axis=1))
    return [(float(t), float(_db(m[int(t * sr):int((t + step) * sr)]))) for t in np.arange(a, b, step)]


def bands(path, win=None):
    m, sr = _mono(path)
    if win:
        m = m[int(win[0] * sr):int(win[1] * sr)]
    whole = _db(m)
    return {k: float(_db(_band(m, sr, lo, hi)) - whole) for k, lo, hi in BANDS}


def beatgram(path, out, cuts=(), bpm=120, div=96):
    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
    m, sr = _mono(path, 48000)
    g = Grid(sr, bpm, len(m) / sr, div)
    p, C = g.analyze(m[:g.N])
    Cd = 20 * np.log10(C + 1e-7)
    fig, ax = plt.subplots(figsize=(16, 6))
    ax.imshow(Cd, origin='lower', aspect='auto', cmap='magma', vmin=Cd.max() - 75, vmax=Cd.max(),
              extent=(0, g.N / sr, p[0], p[-1]))
    for c in cuts:
        ax.axvline(c, color='w', lw=.6, alpha=.6)
    ax.set_yticks(range(36, 125, 12)); ax.set_yticklabels([f'C{(k // 12) - 1}' for k in range(36, 125, 12)])
    ax.set_xlabel('seconds'); ax.set_title(f'beat-semitone transform: {os.path.basename(path)}')
    plt.tight_layout(); plt.savefig(out, dpi=80); plt.close(fig)
    return out


def _load(p):
    return json.load(open(p)) if p else []


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['census', 'punch', 'energy', 'bands', 'beatgram'])
    ap.add_argument('files', nargs='+')
    ap.add_argument('--onsets'); ap.add_argument('--noise'); ap.add_argument('--kicks')
    ap.add_argument('--bpm', type=float, default=120); ap.add_argument('--div', type=int, default=96)
    ap.add_argument('--drop', type=float); ap.add_argument('--until', type=float)
    ap.add_argument('--from', dest='a', type=float); ap.add_argument('--to', dest='b', type=float)
    ap.add_argument('--step', type=float, default=.5)
    ap.add_argument('--ref-win', nargs=2, type=float); ap.add_argument('--our-win', nargs=2, type=float)
    ap.add_argument('--cuts', default=''); ap.add_argument('--out', default='beatgram.png')
    A = ap.parse_args()
    if A.cmd == 'census':
        for f in A.files:
            census(f, _load(A.onsets), _load(A.noise), A.bpm, A.div)
    elif A.cmd == 'punch':
        for f in A.files:
            r = punch(f, A.drop, _load(A.kicks) or None, A.until, A.bpm)
            print(os.path.basename(f) + ': ' + '  '.join(f'{k} {v:+.1f}' for k, v in r.items()))
    elif A.cmd == 'energy':
        for f in A.files:
            print(os.path.basename(f) + ': ' + ' '.join(f'{v:.0f}' for _, v in energy(f, A.a, A.b, A.step)))
    elif A.cmd == 'bands':
        ref, ours = bands(A.files[0], A.ref_win), bands(A.files[1], A.our_win)
        for k in ref:
            print(f'{k:16} ref {ref[k]:+6.1f}  ours {ours[k]:+6.1f}  ref-ours {ref[k] - ours[k]:+5.1f} dB')
    else:
        cuts = [float(c) for c in A.cuts.split(',') if c]
        print(beatgram(A.files[0], A.out, cuts, A.bpm, A.div))
