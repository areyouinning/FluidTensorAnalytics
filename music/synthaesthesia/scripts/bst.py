"""The beat-semitone transform, generalised: a time-frequency grid native to a score.

    from bst import Grid, hz
    g = Grid(sr=48000, bpm=120, dur=60.0, div=96)     # hop = 250 samples = 1/96 beat
    f = hz(g.pitch_hops(notes, .012))                  # notes: [(t_s, midi, len_s), ...]
    a = g.env_hops(notes)
    y = g.synth_voice(f, np.array([1, .2, .1])[:, None] * a[None, :])

Time is hops of 1/div beat (an integer number of samples), frequency is semitones.
Synthesis: per-hop coefficients joined by raised cosines, one continuous phase per voice,
partials faded out between 18 and 20 kHz. Analysis: a constant-Q Gaussian (Gabor) bank from
one FFT, read straight onto the hop grid. See references/transform.md.
"""
import numpy as np


def hz(m):
    return 440.0 * 2.0 ** ((np.asarray(m, dtype=float) - 69.0) / 12.0)


class Grid:
    def __init__(self, sr=48000, bpm=120.0, dur=60.0, div=96):
        beat = sr * 60.0 / bpm
        H = beat / div
        if abs(H - round(H)) > 1e-9:
            raise ValueError(f'hop = {H} samples is not an integer: change sr, bpm or div')
        self.sr, self.bpm, self.div = sr, bpm, div
        self.beat = beat                     # samples per beat (may be fractional only if div absorbs it)
        self.H = int(round(H))
        self.N = int(round(dur * sr))
        self.NH = self.N // self.H
        self.th = np.arange(self.NH + 1) * self.H / sr     # hop times, s

    # ------------------------------------------------------------ grid arithmetic
    def hop(self, t):
        """Seconds -> hop index (exact for anything on the grid)."""
        return int(round(t * self.sr / self.H))

    def on_grid(self, t):
        return abs(t * self.sr / self.H - round(t * self.sr / self.H)) < 1e-6

    def assert_on_grid(self, times):
        bad = [t for t in times if not self.on_grid(t)]
        if bad:
            raise ValueError(f'{len(bad)} events off the hop grid, e.g. {bad[:5]}')

    def rc_interp(self, hv, b0, b1):
        """Raised-cosine interpolation of hop values (..., NH+1) onto samples [b0, b1)."""
        t = np.arange(b0, b1)
        n = t // self.H
        u = (t - n * self.H) / self.H
        w = 0.5 - 0.5 * np.cos(np.pi * u)
        a = hv[..., np.minimum(n, hv.shape[-1] - 1)]
        b = hv[..., np.minimum(n + 1, hv.shape[-1] - 1)]
        return a * (1 - w) + b * w

    # ------------------------------------------------------------ per-hop curves
    def lin(self, pts):
        xs, ys = zip(*pts)
        return np.interp(self.th, xs, ys)

    def env_hops(self, notes, release_s=.07, sustain=None, decay_s=.25):
        """Amplitude per hop for a monophonic line. notes: [(t, midi, length_s), ...].
        Onset hop 0 -> next hop 1 (a one-hop raised-cosine attack), hold or decay to
        `sustain`, exponential release after the note."""
        H, sr, NH = self.H, self.sr, self.NH
        a = np.zeros(NH + 1)
        rel = np.exp(-H / (release_s * sr))
        for t0, _, L in notes:
            n0 = self.hop(t0); n1 = max(n0 + 1, self.hop(t0 + L))
            if n0 > NH:
                continue
            k = np.arange(n1 - n0) * H / sr
            seg = np.ones(n1 - n0) if sustain is None else \
                sustain + (1 - sustain) * np.exp(-np.maximum(0, k - .06) / decay_s)
            seg[0] = 0.0
            tail = seg[-1] * rel ** np.arange(1, int(8 * release_s * sr / H))
            full = np.concatenate([seg, tail])
            m = min(len(full), NH + 1 - n0)
            a[n0:n0 + m] = np.maximum(np.where(np.arange(m) == 0, 0, a[n0:n0 + m]), full[:m])
        return a

    def pitch_hops(self, notes, glide_s=.012):
        """Pitch (MIDI) per hop: holds each note, glides to the next in log frequency.
        Rests hold the previous pitch, so the curve never contains NaN."""
        NH = self.NH
        target = np.full(NH + 1, np.nan)
        for t0, m, _ in sorted(notes):
            target[min(NH, self.hop(t0)):] = m
        target = np.where(np.isnan(target), sorted(notes)[0][1], target)
        out = np.empty(NH + 1); out[0] = target[0]
        a = 1 - np.exp(-self.H / (glide_s * self.sr))
        for n in range(1, NH + 1):
            out[n] = out[n - 1] + (target[n] - out[n - 1]) * a
        return out

    # ------------------------------------------------------------ synthesis
    def synth_voice(self, f_hop, amp_k, block=None):
        """One voice of harmonic partials. f_hop (NH+1,) Hz; amp_k (K, NH+1)."""
        return self.synth_ratios(f_hop, np.arange(1, amp_k.shape[0] + 1), amp_k, block, top=20000.0)

    def synth_ratios(self, f_hop, ratios, amp_r, block=None, top=19000.0):
        """Partials at arbitrary ratios of one phase: sum_j a_j(t) sin(r_j * phase(t)).
        A negative ratio is FM's reflected sideband. Faded out from top-2 kHz to top."""
        N, sr = self.N, self.sr
        block = block or sr
        r = np.asarray(ratios, dtype=float)
        A = amp_r * np.clip((top - np.abs(r)[:, None] * f_hop[None, :]) / 2000.0, 0.0, 1.0)
        phase = 2 * np.pi * np.cumsum(self.rc_interp(f_hop, 0, N)) / sr
        out = np.zeros(N)
        for b0 in range(0, N, block):
            b1 = min(N, b0 + block)
            Ab = self.rc_interp(A, b0, b1)
            live = np.where(np.abs(Ab).max(axis=1) > 1e-7)[0]
            if len(live):
                out[b0:b1] = np.sum(Ab[live] * np.sin(r[live, None] * phase[None, b0:b1]), axis=0)
        return out

    def hit(self, sound, times, vel=None):
        """Place a one-shot array at sample-exact times (velocity per hit)."""
        out = np.zeros(self.N)
        for i, t0 in enumerate(times):
            i0 = int(round(t0 * self.sr)); m = min(len(sound), self.N - i0)
            if m > 0:
                out[i0:i0 + m] += (1.0 if vel is None else vel[i]) * sound[:m]
        return out

    def attack(self, n):
        """One-hop raised-cosine rise over n samples (the minimum legal attack)."""
        t = np.arange(n)
        return np.minimum(1, .5 - .5 * np.cos(np.pi * np.minimum(t / self.H, 1)))

    # ------------------------------------------------------------ analysis
    def analyze(self, x, sr=None, pmin=28.0, pmax=124.0, step=1 / 3):
        """|coefficients| on the (pitch, hop) grid. A steady sinusoid of amplitude A reads ~A/2."""
        sr = sr or self.sr
        hop_s = self.H / self.sr
        n = len(x)
        nh = int(n / (hop_s * sr))
        X = np.fft.rfft(x)
        df = sr / n
        pitches = np.arange(pmin, pmax + 1e-9, step)
        C = np.zeros((len(pitches), nh), dtype=np.float32)
        for i, p in enumerate(pitches):
            f = float(hz(p))
            dfb = f * (2 ** (step / 12) - 1)
            sig_t = np.clip(1 / (np.pi * dfb), 0.5 * hop_s, 0.25 * 60 / self.bpm)
            sig_f = 1 / (2 * np.pi * sig_t)
            k0 = int(round(f / df))
            half = int(np.ceil(4 * sig_f / df))
            lo, hi = max(0, k0 - half), min(len(X) - 1, k0 + half)
            idx = np.arange(lo, hi + 1)
            g = np.exp(-0.5 * ((idx * df - f) / sig_f) ** 2)
            M = nh * int(np.ceil((2 * half + 2) / nh))
            Y = np.zeros(M, dtype=complex)
            Y[(idx - k0) % M] = X[idx] * g
            C[i] = np.abs(np.fft.ifft(Y) * (M / n))[::M // nh][:nh]
        return pitches, C


# ---------------------------------------------------------------- weights on partials
def lowpass_w(f, fc):
    return 1 / np.sqrt(1 + (f / fc) ** 4)


def highpass_w(f, fc):
    return 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-9)) ** 4)


def bump_w(f, fc, gain_db, width_oct):
    return 1 + (10 ** (gain_db / 20) - 1) * np.exp(-0.5 * (np.log2(np.maximum(f, 1) / fc) / width_oct) ** 2)


def carve_w(fk, other_f0, other_on, depth=.6, width_st=.35, partials=4):
    """Weights that notch partials fk (K, NH+1) near the first `partials` partials of another
    voice (other_f0 Hz per hop), scaled by that voice's level 0..1. Carve by register, not level."""
    dmin = np.full(fk.shape, 99.0)
    for j in range(1, partials + 1):
        dmin = np.minimum(dmin, np.abs(12 * np.log2(fk / (j * other_f0[None, :]))))
    return 1 - depth * other_on[None, :] * np.exp(-dmin ** 2 / (2 * width_st ** 2))
