"""Mix and master helpers that work on arrays. All zero-phase EQ is in the Fourier domain.

    from master import fft_eq, shelf, dirt, mono_below, tp_limit, master_to, loudness, section_lufs

Never use pedalboard's Limiter for mastering: it adds makeup gain equal to -threshold.
"""
import os, re, shutil, subprocess, sys
import numpy as np
from scipy import signal


def ffmpeg():
    for p in (os.path.join(sys.prefix, 'Library', 'bin', 'ffmpeg.exe'),
              os.path.expanduser(r'~\miniforge3\Library\bin\ffmpeg.exe'),
              shutil.which('ffmpeg') or ''):
        if p and os.path.exists(p):
            return p
    raise FileNotFoundError('ffmpeg not found (miniforge3\\Library\\bin\\ffmpeg.exe)')


def rms_db(x, sr, a=None, b=None, hp=None):
    s = x[int((a or 0) * sr):None if b is None else int(b * sr)]
    if hp:
        s = signal.sosfilt(signal.butter(2, hp, 'highpass', fs=sr, output='sos'), s, axis=0)
    return 20 * np.log10(np.sqrt(np.mean(s ** 2)) + 1e-12)


def fft_eq(x, sr, pts):
    """Zero-phase EQ: gain in dB interpolated in log frequency through [(Hz, dB), ...]."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / sr)
    fs, gs = zip(*pts)
    g = np.interp(np.log2(np.maximum(f, 1)), np.log2(fs), gs)
    return np.fft.irfft(X * 10 ** (g / 20), len(x))


def shelf(x, sr, db, f0=400.0, f1=1200.0):
    """0 dB below f0, `db` above f1, log-linear between (zero phase)."""
    return fft_eq(x, sr, [(f0, 0.0), (f1, db)])


def dirt(l, r, sr, drive, os_=4, lp_hz=2200):
    """tanh saturation at os_x oversampling, low-passed (grit stays low; no sizzle),
    level-matched to the input RMS."""
    pk = max(np.abs(l).max(), np.abs(r).max()) + 1e-12
    lp = signal.butter(4, lp_hz, 'lowpass', fs=sr, output='sos')
    out = []
    for x in (l, r):
        y = signal.resample_poly(np.tanh(drive * signal.resample_poly(x / pk, os_, 1)), 1, os_)[:len(x)]
        y = signal.sosfiltfilt(lp, y)
        out.append(y * np.sqrt(np.mean(x ** 2) / (np.mean(y ** 2) + 1e-20)))
    return out


def mono_below(x, sr, f_lo=100.0, f_hi=180.0):
    """x: (2, n). Removes the side channel below ~f_lo (fully) to f_hi (untouched)."""
    m, s = (x[0] + x[1]) / 2, (x[0] - x[1]) / 2
    s = fft_eq(s, sr, [(f_lo, -60.0), (f_hi, 0.0)])
    return np.stack([m + s, m - s])


def ramp(sr, n, a, b, edge=.005):
    """0..1 gain that is 1 inside [a, b) seconds, with raised-cosine edges of `edge` s."""
    t = np.arange(n) / sr
    u = np.clip((t - a) / edge, 0, 1) * np.clip((b - t) / edge, 0, 1)
    return .5 - .5 * np.cos(np.pi * u)


def tp_limit(x, sr, ceil_db, look=0.0015, release=0.08, os_=4):
    """True-peak lookahead limiter, no makeup gain. x: (2, n). Returns (y, gain curve)."""
    from scipy.ndimage import minimum_filter1d
    c = 10 ** (ceil_db / 20)
    n = x.shape[1]
    up = np.stack([signal.resample_poly(ch, os_, 1) for ch in x])
    pk = np.abs(up).max(axis=0)[:n * os_].reshape(n, os_).max(axis=1)
    need = np.minimum(1.0, c / np.maximum(pk, 1e-12))
    Wn = max(1, int(look * sr))
    gm = minimum_filter1d(need, size=Wn, origin=-(Wn // 2))
    a = np.exp(-1 / (release * sr)); g = np.empty(n); prev = 1.0
    for k, v0 in enumerate(gm.tolist()):
        v = 1 - a * (1 - prev); prev = v0 if v0 < v else v; g[k] = prev
    cs = np.cumsum(np.concatenate([[0.0], g])); ga = np.empty(n)
    ga[Wn - 1:] = (cs[Wn:] - cs[:-Wn]) / Wn; ga[:Wn - 1] = g[:Wn - 1]
    ga = np.minimum(ga, 1.0)
    return x * ga, ga


def _ebur(path, extra=()):
    r = subprocess.run([ffmpeg(), '-hide_banner', '-nostats', *extra, '-i', path, '-af', 'ebur128=peak=true',
                        '-f', 'null', '-'], capture_output=True, text=True)
    return r.stderr[r.stderr.rfind('Summary:'):]


def loudness(path):
    """(integrated LUFS, true peak dBTP) via ffmpeg EBU R128."""
    t = _ebur(path)
    return (float(re.search(r'I:\s+(-?[\d.]+) LUFS', t).group(1)),
            float(re.search(r'Peak:\s+(-?[\d.inf]+) dBFS', t).group(1)))


def section_lufs(path, a, b):
    t = _ebur(path, ('-ss', str(a), '-t', str(b - a)))
    return float(re.search(r'I:\s+(-?[\d.]+) LUFS', t).group(1))


def master_to(x, sr, path, target_lufs=-14.0, ceil_db=-1.6, iters=6, tol=.05, subtype='PCM_24'):
    """Gain loop: scale, true-peak limit, write, measure; repeat until within tol LU.
    Writes `path`. Returns dict(lufs, tp, gain_db, limiter=(share >1 dB GR, max GR dB), gain_curve)."""
    import soundfile as sf
    gain_db = 0.0
    for _ in range(iters):
        y, ga = tp_limit(x * 10 ** (gain_db / 20), sr, ceil_db)
        sf.write(path, y.T, sr, subtype=subtype)
        I, tp = loudness(path)
        if abs(I - target_lufs) <= tol:
            break
        gain_db += target_lufs - I
    gr = -20 * np.log10(np.maximum(ga, 1e-9))
    return dict(lufs=I, tp=tp, gain_db=gain_db, limiter=(float(np.mean(gr > 1)), float(gr.max())), gain_curve=ga)


def to_mp3(wav, mp3, kbps=320):
    subprocess.run([ffmpeg(), '-y', '-hide_banner', '-loglevel', 'error', '-i', wav, '-b:a', f'{kbps}k', mp3], check=True)
