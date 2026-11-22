"""Transcribe a reference track into a style sheet: the vocabulary, not the tune.

    python transcribe.py ref.mp3 [--from 30 --to 120] [--out dir] [--name label]

Writes <out>/<name>.style.json and .style.md. What it reads:
  time      tempo (refined by regression on beat times, with the half/double alternative),
            bar phase, 16th-note drum grid per voice (kick / snare / hats) as hit
            probability per step, swing, hat rolls
  harmony   key (Krumhansl), chord per bar (12 roots x 7 qualities) and as roman numerals,
            the loop length that best repeats
  bass      the lowest strong pitch per beat (CQT C1-B3), its scale degrees, 808 decay
  melody    range, scale-degree use, steps vs leaps, notes per bar (pYIN on the harmonic
            part); no note sequence is stored, so nothing copyable leaves this script
  sound     band balance, brightness, the lo-fi ceiling (highest frequency within 60 dB of
            the peak), stereo width, crest, LUFS / LRA / true peak, snare tail (wetness)
  arc       level per bar and section boundaries from self-similarity
"""
import argparse, json, os, subprocess, sys, tempfile
import numpy as np, soundfile as sf, librosa
from scipy import signal
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from master import ffmpeg, loudness

NAMES = 'C C# D D# E F F# G G# A A# B'.split()
MAJ = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MIN = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
QUAL = {'': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'maj7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10],
        'sus2': [0, 2, 7], 'sus4': [0, 5, 7]}
ROMAN = ['I', 'bII', 'II', 'bIII', 'III', 'IV', 'bV', 'V', 'bVI', 'VI', 'bVII', 'VII']
SR = 22050
HOP = 256


def load(path, a=None, b=None):
    tmp = os.path.join(tempfile.gettempdir(), 'synth_transcribe.wav')
    cmd = [ffmpeg(), '-y', '-hide_banner', '-loglevel', 'error']
    if a is not None:
        cmd += ['-ss', str(a)]
    cmd += ['-i', path]
    if b is not None:
        cmd += ['-t', str(b - (a or 0))]
    subprocess.run(cmd + ['-ac', '2', '-ar', '44100', tmp], check=True)
    y2, sr2 = sf.read(tmp, always_2d=True)
    return y2, sr2, tmp


def key_of(ch):
    sc = [(np.corrcoef(np.roll(p, k), ch)[0, 1], k, q) for k in range(12) for p, q in ((MAJ, 'major'), (MIN, 'minor'))]
    sc.sort(reverse=True)
    return sc[0], sc[1]


def band_env(S, freqs, lo, hi):
    sel = (freqs >= lo) & (freqs < hi)
    e = np.log1p(S[sel].sum(axis=0))
    flux = np.maximum(0, np.diff(e, prepend=e[0]))
    return flux / (np.percentile(flux, 99) + 1e-9)


def transcribe(path, a=None, b=None, bpm_range=(80, 170)):
    """bpm_range picks the octave when a tempo and its half/double are both strong. Slow hip-hop
    (Clams Casino, 60-80 BPM) reads as double time unless you pass (55, 100)."""
    y2, sr2, tmp = load(path, a, b)
    out = {'file': os.path.basename(path), 'window_s': [a, b], 'seconds': round(len(y2) / sr2, 2)}
    m = librosa.resample(y2.mean(axis=1).astype(np.float32), orig_sr=sr2, target_sr=SR)
    harm, perc = librosa.effects.hpss(m)

    # ---------------------------------------------------------------- time
    oenv = librosa.onset.onset_strength(y=perc, sr=SR, hop_length=HOP)
    oenv = oenv - oenv.mean()
    tf = librosa.frames_to_time(np.arange(len(oenv)), sr=SR, hop_length=HOP)
    # periodicity scan: Fourier strength of the onset envelope at the beat rate and its
    # subdivisions (x2, x4) - a comb that rewards a tempo whose 8ths and 16ths also line up
    dft = lambda bpm: np.abs(np.exp(-2j * np.pi * (bpm / 60) * tf) @ oenv)
    comb = lambda bpm: dft(bpm) + .5 * dft(2 * bpm) + .25 * dft(4 * bpm)
    coarse = np.arange(55, 200, .2)
    P = np.array([comb(b) for b in coarse])
    def refine(b0):
        fine = np.arange(b0 - .4, b0 + .4, .005)
        return float(fine[np.argmax([comb(b) for b in fine])])
    top = refine(coarse[np.argmax(P)])
    alts = {round(top / 2, 2), round(top * 2, 2)}
    in_band = [b for b in [top] + [refine(a) for a in alts if 55 < a < 200] if bpm_range[0] <= b <= bpm_range[1]]
    strength = {round(b, 2): float(comb(b)) for b in [top] + [refine(a) for a in alts if 55 < a < 200]}
    bpm = max(in_band, key=comb) if in_band and comb(max(in_band, key=comb)) > .5 * comb(top) else top
    period = 60 / bpm
    # beat phase from the kick band alone (dense 16ths elsewhere pull a broadband phase off the beat)
    Sk = np.abs(librosa.stft(perc, n_fft=2048, hop_length=HOP))
    fk_ = librosa.fft_frequencies(sr=SR, n_fft=2048)
    kenv = band_env(Sk, fk_, 35, 120)
    offs_ = np.linspace(0, period, 192, endpoint=False)
    kscore = [np.interp(np.arange(o, tf[-1], period), tf, kenv).sum() for o in offs_]
    t0 = float(offs_[int(np.argmax(kscore))])
    bt = np.arange(t0, tf[-1], period)
    out['tempo'] = {'bpm': round(bpm, 2), 'half': round(bpm / 2, 2), 'double': round(bpm * 2, 2),
                    'comb_strength': {str(k): round(v / max(strength.values()), 2) for k, v in sorted(strength.items())},
                    'note': 'static grid from the periodicity scan: right for programmed music; live playing drifts'}
    steps = np.concatenate([np.linspace(bt[i], bt[i + 1], 5)[:-1] for i in range(len(bt) - 1)])
    S = np.abs(librosa.stft(perc, n_fft=2048, hop_length=HOP))
    freqs = librosa.fft_frequencies(sr=SR, n_fft=2048)
    voices = {'kick': band_env(S, freqs, 35, 120), 'snare': band_env(S, freqs, 1500, 5000) * .6 + band_env(S, freqs, 150, 300) * .4,
              'hat': band_env(S, freqs, 7000, 11000)}
    fr = lambda t: np.minimum(librosa.time_to_frames(t, sr=SR, hop_length=HOP), S.shape[1] - 1)
    w = max(1, int(.025 * SR / HOP))
    hit = {k: np.array([v[max(0, f - w):f + w + 1].max() for f in fr(steps)]) for k, v in voices.items()}
    # bar phase: the beat (mod 4) where kicks are strongest
    nb = (len(steps) // 16) * 16
    kb = np.array([hit['kick'][:nb:4][p::4].mean() for p in range(4)])
    sb = np.array([hit['snare'][:nb:4][p::4].mean() for p in range(4)])
    # the downbeat: a strong kick, no snare on it, and snare on the backbeat (2 and 4) or on 3 (half-time)
    kb, sb = kb / (kb.max() + 1e-9), sb / (sb.max() + 1e-9)
    phase = int(np.argmax([kb[p] + .5 * (max(sb[(p + 1) % 4] + sb[(p + 3) % 4], 2 * sb[(p + 2) % 4]) / 2 - sb[p]) for p in range(4)]))
    st0 = phase * 4
    nbars = (len(steps) - st0) // 16
    grid = {k: v[st0:st0 + 16 * nbars].reshape(nbars, 16).mean(axis=0) for k, v in hit.items()}
    grid = {k: g / (g.max() + 1e-9) for k, g in grid.items()}          # relative: the pattern's shape
    out['drums'] = {'bars_read': int(nbars), 'grid_16ths': {k: [round(float(x), 2) for x in g] for k, g in grid.items()},
                    'text': {k: ''.join('#' if x > .8 else 'x' if x > .55 else '.' if x > .35 else ' ' for x in g) for k, g in grid.items()}}
    sn = grid['snare']
    out['drums']['feel'] = ('half-time (snare on beat 3)' if sn[8] > 1.25 * max(sn[4], sn[12]) else
                            'backbeat (snare on 2 and 4)' if min(sn[4], sn[12]) > 1.25 * sn[8] else 'other')
    # swing: where the off-16ths actually land within their 8th
    he = voices['hat']
    def swing(stride):
        offs = []
        for i in range(st0, len(steps) - stride, stride):
            t_on, t_nx = steps[i], steps[i + stride]
            lo, hi = fr(t_on + .3 * (t_nx - t_on)), fr(t_on + .8 * (t_nx - t_on))
            if hi > lo and he[lo:hi].max() > .4:
                tp = librosa.frames_to_time(lo + np.argmax(he[lo:hi]), sr=SR, hop_length=HOP)
                offs.append((tp - t_on) / (t_nx - t_on))
        return round(100 * float(np.median(offs)), 1) if len(offs) > 8 else None
    out['drums']['swing_pct'] = {'8ths': swing(4), '16ths': swing(2)}
    rolls = sum(1 for i in range(len(steps) - 1) if hit['hat'][i] > .4 and
                voices['hat'][fr(steps[i]) + 1:fr(steps[i + 1])].max(initial=0) > .5) / max(1, nbars)
    out['drums']['hat_rolls_per_bar'] = round(float(rolls), 2)

    # ---------------------------------------------------------------- bass (read after each beat's kick has passed)
    # harmonic salience: a bass note has overtones, a kick's sine tail has none
    lowh = librosa.resample(harm, orig_sr=SR, target_sr=11025)
    Cq = np.abs(librosa.cqt(lowh, sr=11025, hop_length=128, fmin=librosa.note_to_hz('C1'), n_bins=72, bins_per_octave=12))
    sal = np.zeros((36, Cq.shape[1]))
    for h_off, wgt in ((0, 1.0), (12, .9), (19, .7), (24, .6), (28, .4)):
        sal += wgt * Cq[h_off:h_off + 36]
    bfr = lambda t: np.minimum(librosa.time_to_frames(t, sr=11025, hop_length=128), Cq.shape[1] - 1)
    thr = np.percentile(sal.max(axis=0), 40)
    cols, live = [], []
    for i in range(len(bt) - 1):
        seg = sal[:, bfr(bt[i] + .55 * (bt[i + 1] - bt[i])):bfr(bt[i + 1])]      # the back of the beat, after the kick
        cols.append(seg.mean(axis=1) if seg.shape[1] else np.zeros(36)); live.append(bool(seg.shape[1]) and seg.max() > thr)
    cols = np.array(cols).T
    # a repeated kick is the same every beat; what changes from beat to beat is the bass line
    resid = cols - .8 * np.median(cols, axis=1, keepdims=True)
    bass_beat = [int(np.argmax(resid[:, i])) + 24 if live[i] else None for i in range(cols.shape[1])]
    bass = [b for b in bass_beat if b is not None]

    # ---------------------------------------------------------------- harmony: chords per bar, the bass votes for the root
    C = librosa.feature.chroma_cqt(y=harm, sr=SR, hop_length=HOP, fmin=librosa.note_to_hz('C3'), n_octaves=5)
    bar_t = steps[st0::16]
    chords = []
    for i in range(len(bar_t) - 1):
        seg = C[:, fr(bar_t[i]):fr(bar_t[i + 1])]
        if seg.shape[1] == 0:
            continue
        v = seg.mean(axis=1); v = v / (np.linalg.norm(v) + 1e-9)
        bb = [x % 12 for x in bass_beat[phase + 4 * i:phase + 4 * i + 4] if x is not None]
        bpc = max(set(bb), key=bb.count) if bb else None
        def score(rt, iv):
            s = float(np.dot(v, np.roll(np.isin(np.arange(12), iv).astype(float), rt)) / np.sqrt(len(iv)))
            return s + (.12 if rt == bpc else .03 if bpc is not None and (bpc - rt) % 12 in iv else 0)
        best_c = max((score(rt, iv), rt, qn) for rt in range(12) for qn, iv in QUAL.items())
        chords.append((best_c[1], best_c[2]))
    # key: the Krumhansl candidates, re-ranked by how well the chords sit in each and how often its tonic chord appears
    allk = {(kk, qq): np.corrcoef(np.roll(p, kk), C.mean(axis=1))[0, 1] for kk in range(12) for p, qq in ((MAJ, 'major'), (MIN, 'minor'))}
    short = sorted(allk, key=allk.get, reverse=True)[:4]
    short = set(short) | {(kk, 'minor' if qq == 'major' else 'major') for kk, qq in short}      # each candidate's parallel mode
    ranked = [(allk[c], c[0], c[1]) for c in short]
    def key_score(c):
        r_, kk, qq = c
        scale = {(kk + d) % 12 for d in ([0, 2, 4, 5, 7, 9, 11] if qq == 'major' else [0, 2, 3, 5, 7, 8, 10])}
        fit = np.mean([rt in scale for rt, qn in chords]) if chords else 0          # roots only (see below)
        # root only: a saturated bass's 5th harmonic is a major third, so chord quality can't vote on mode
        ton = np.mean([rt == kk for rt, qn in chords]) if chords else 0
        return r_ + .5 * fit + .5 * ton
    ranked.sort(key=key_score, reverse=True)
    r, k, q = ranked[0]
    out['key'] = {'tonic': NAMES[k], 'mode': q, 'r': round(float(r), 2),
                  'runner_up': f'{NAMES[ranked[1][1]]} {ranked[1][2]}',
                  'note': 'relative major/minor share a scale; when they tie, the arrangement decides'}
    out['chords_per_bar'] = [NAMES[rt] + qn for rt, qn in chords]
    out['roman_per_bar'] = [ROMAN[(rt - k) % 12] + qn for rt, qn in chords]
    seq = out['chords_per_bar']
    loop = None
    for L in (1, 2, 4, 8, 16):
        if len(seq) >= 2 * L:
            agree = np.mean([seq[i] == seq[i + L] for i in range(len(seq) - L)])
            if agree > .6:
                loop = (L, round(float(agree), 2)); break
    out['harmonic_loop_bars'] = loop
    deg = np.bincount([(n - k) % 12 for n in bass], minlength=12)
    out['bass'] = {'range': [librosa.midi_to_note(min(bass)), librosa.midi_to_note(max(bass))] if bass else None,
                   'degrees': {ROMAN[i]: round(float(deg[i] / max(1, deg.sum())), 2) for i in np.argsort(-deg)[:5] if deg[i]}}
    sub = signal.sosfiltfilt(signal.butter(4, [30, 90], 'bandpass', fs=SR, output='sos'), m)
    se = 20 * np.log10(np.abs(signal.hilbert(sub)) + 1e-9)
    decays = []
    for t in steps[st0::4][:200]:
        i0 = int(t * SR); seg = se[i0:i0 + int(2.5 * SR)]
        if len(seg) > 100 and seg[:int(.05 * SR)].max() > se.max() - 25:
            p = int(np.argmax(seg[:int(.05 * SR)])); below = np.where(seg[p:] < seg[p] - 20)[0]
            if len(below):
                decays.append(below[0] / SR)
    out['bass']['sub_decay_20db_s'] = round(float(np.median(decays)), 2) if decays else None

    # ---------------------------------------------------------------- melody vocabulary (no sequence kept)
    seg_len = min(len(harm), 90 * SR)
    f0, vflag, _ = librosa.pyin(harm[:seg_len], fmin=150, fmax=1300, sr=SR, hop_length=512)
    mid = librosa.hz_to_midi(f0[vflag & ~np.isnan(f0)]) if np.any(vflag) else np.array([])
    if len(mid) > 50:
        q_ = np.round(mid).astype(int)
        notes = q_[np.concatenate([[True], q_[1:] != q_[:-1]])]
        iv = np.abs(np.diff(notes))
        mdeg = np.bincount((notes - k) % 12, minlength=12)
        out['melody'] = {'range': [librosa.midi_to_note(int(np.percentile(mid, 5))), librosa.midi_to_note(int(np.percentile(mid, 95)))],
                         'degrees': {ROMAN[i]: round(float(mdeg[i] / mdeg.sum()), 2) for i in np.argsort(-mdeg)[:6] if mdeg[i]},
                         'steps_pct': round(100 * float(np.mean(iv <= 2)), 0) if len(iv) else None,
                         'leaps_over_5_pct': round(100 * float(np.mean(iv > 5)), 0) if len(iv) else None,
                         'note_changes_per_bar': round(float(len(notes) / max(1, seg_len / SR / (4 * 60 / bpm))), 1),
                         'voiced_pct': round(100 * float(np.mean(vflag)), 0)}
    else:
        out['melody'] = None

    # ---------------------------------------------------------------- sound
    mono = y2.mean(axis=1)
    whole = 20 * np.log10(np.sqrt(np.mean(mono ** 2)) + 1e-12)
    bands = {}
    for name, lo, hi in [('sub 20-60', 20, 60), ('bass 60-250', 60, 250), ('low-mid 250-1k', 250, 1000),
                         ('mid 1-4k', 1000, 4000), ('high 4-12k', 4000, 12000), ('air 12-20k', 12000, 20000)]:
        bb = signal.sosfiltfilt(signal.butter(4, [lo, min(hi, sr2 / 2 - 200)], 'bandpass', fs=sr2, output='sos'), mono)
        bands[name] = round(float(20 * np.log10(np.sqrt(np.mean(bb ** 2)) + 1e-12) - whole), 1)
    f_, P = signal.welch(mono, sr2, nperseg=8192)
    Pd = 10 * np.log10(P + 1e-20)
    sm = np.convolve(Pd, np.ones(9) / 9, 'same')
    cum = np.cumsum(P) / P.sum()
    ceiling = float(f_[np.searchsorted(cum, .995)])                # lo-fi ceiling: 99.5 % of the energy lies below
    side = (y2[:, 0] - y2[:, 1]) / 2
    I, lra = loudness_lra(tmp)
    sn_t = [steps[st0 + i] for i in range(0, 16 * nbars) if hit['snare'][st0 + i] > .6][:60]
    tails = []
    for t in sn_t:
        i0 = int(t * sr2)
        e = lambda d0, d1: np.sqrt(np.mean(mono[i0 + int(d0 * sr2):i0 + int(d1 * sr2)] ** 2)) + 1e-12
        if i0 + int(.45 * sr2) < len(mono):
            tails.append(20 * np.log10(e(.30, .40) / e(0, .05)))
    out['sound'] = {'bands_re_whole_db': bands,
                    'centroid_hz': round(float(np.median(librosa.feature.spectral_centroid(y=m, sr=SR))), 0),
                    'ceiling_hz': round(ceiling, 0),
                    'side_vs_mid_db': round(float(20 * np.log10((np.sqrt(np.mean(side ** 2)) + 1e-12) / (np.sqrt(np.mean(mono ** 2)) + 1e-12))), 1),
                    'crest_db': round(float(20 * np.log10(np.abs(mono).max() / (np.sqrt(np.mean(mono ** 2)) + 1e-12))), 1),
                    'lufs': I, 'lra': lra, 'true_peak_dbtp': loudness(tmp)[1],
                    'snare_tail_300ms_db': round(float(np.median(tails)), 1) if tails else None}

    # ---------------------------------------------------------------- arc
    lev = [round(float(20 * np.log10(np.sqrt(np.mean(mono[int(bar_t[i] * sr2):int(bar_t[i + 1] * sr2)] ** 2)) + 1e-12)), 1)
           for i in range(len(bar_t) - 1)]
    feat = np.vstack([librosa.util.sync(C, fr(bar_t)), librosa.util.sync(librosa.feature.mfcc(y=m, sr=SR, hop_length=HOP, n_mfcc=13), fr(bar_t))])
    feat = librosa.util.normalize(feat, axis=0)
    nseg = int(np.clip(len(bar_t) // 8, 2, 10))
    bounds = librosa.segment.agglomerative(feat, nseg) if feat.shape[1] > nseg else []
    out['arc'] = {'level_per_bar_dbfs': lev, 'section_starts_bar': [int(x) for x in bounds]}
    return out


def loudness_lra(path):
    import re
    r = subprocess.run([ffmpeg(), '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True)
    t = r.stderr[r.stderr.rfind('Summary:'):]
    return float(re.search(r'I:\s+(-?[\d.]+) LUFS', t).group(1)), float(re.search(r'LRA:\s+(-?[\d.]+) LU', t).group(1))


def to_md(s, name):
    L = [f'# Style sheet: {name}', '', f"Source `{s['file']}`, {s['seconds']} s read" + (f" (window {s['window_s']})" if s['window_s'][0] is not None else '') + '.', '']
    t = s['tempo']; L += [f"**Tempo** {t['bpm']} BPM (half {t['half']}, double {t['double']}; comb strength {t['comb_strength']}); feel: {s['drums']['feel']}; swing {s['drums']['swing_pct']} % of the way through the 8th / 16th (50 = straight, 66.7 = triplet); hat rolls {s['drums']['hat_rolls_per_bar']} per bar.", '']
    L += ['**Drum grid** (16ths, one bar; # always, x often, . sometimes):', '```', '      1   2   3   4']
    L += [f"{k:5} {v}" for k, v in s['drums']['text'].items()] + ['```', '']
    L += [f"**Key** {s['key']['tonic']} {s['key']['mode']} (r {s['key']['r']}; runner-up {s['key']['runner_up']}). "
          f"Harmonic loop: {s['harmonic_loop_bars']}.", '', '**Chords per bar:** ' + ' | '.join(s['chords_per_bar'][:32]), '',
          '**As numerals:** ' + ' | '.join(s['roman_per_bar'][:32]), '']
    b = s['bass']; L += [f"**Bass** range {b['range']}, degrees {b['degrees']}, sub decays 20 dB in {b['sub_decay_20db_s']} s.", '']
    if s['melody']:
        mm = s['melody']; L += [f"**Melody vocabulary** range {mm['range']}, degrees {mm['degrees']}, {mm['steps_pct']} % steps, "
                                 f"{mm['leaps_over_5_pct']} % leaps over a fourth, {mm['note_changes_per_bar']} note changes per bar, voiced {mm['voiced_pct']} %.", '']
    so = s['sound']; L += [f"**Sound** {so['lufs']} LUFS, LRA {so['lra']} LU, TP {so['true_peak_dbtp']} dBTP, crest {so['crest_db']} dB, side/mid {so['side_vs_mid_db']} dB, "
                            f"centroid {so['centroid_hz']} Hz, 99.5 % of energy below {so['ceiling_hz']} Hz, snare tail at 300 ms {so['snare_tail_300ms_db']} dB.", '',
                            'Bands re whole: ' + ', '.join(f'{k} {v:+}' for k, v in so['bands_re_whole_db'].items()), '']
    L += [f"**Arc** sections start at bars {s['arc']['section_starts_bar']}; level per bar: " + ' '.join(f'{x:.0f}' for x in s['arc']['level_per_bar_dbfs']), '']
    return '\n'.join(L)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('file'); ap.add_argument('--from', dest='a', type=float); ap.add_argument('--to', dest='b', type=float)
    ap.add_argument('--out', default='.'); ap.add_argument('--name')
    ap.add_argument('--bpm-range', nargs=2, type=float, default=(80, 170))
    A = ap.parse_args()
    name = A.name or os.path.splitext(os.path.basename(A.file))[0]
    s = transcribe(A.file, A.a, A.b, tuple(A.bpm_range))
    os.makedirs(A.out, exist_ok=True)
    json.dump(s, open(os.path.join(A.out, name + '.style.json'), 'w'), indent=1)
    md = to_md(s, name)
    open(os.path.join(A.out, name + '.style.md'), 'w', encoding='utf-8').write(md)
    print(md)
