"""Shared instrument kit for the producer studies, built on the synthaesthesia skill.

Everything is either a one-shot written partial by partial (piano, bells, plucks, drums) and
placed sample-exactly, or a sustained line written as per-hop coefficients and turned into
audio by the skill's synth_voice (pads, sung voices, womp bass). Attacks are never shorter
than one hop; every one-shot ends in true zero.
"""
import hashlib, json, os, sys
import numpy as np
import soundfile as sf
from scipy import signal
from scipy.special import jv

SK = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'synthaesthesia', 'scripts')
sys.path.insert(0, SK)
from bst import Grid, hz, lowpass_w, highpass_w, bump_w, carve_w   # noqa: E402
from master import fft_eq, dirt, mono_below, master_to, to_mp3, loudness   # noqa: E402
from listen import census, beatgram, punch, energy   # noqa: E402

SR = 48000
PHI = (1 + 5 ** .5) / 2
MUSIC = os.path.dirname(os.path.abspath(__file__))


# ======================================================================= the track
class Track:
    def __init__(self, slug, title, bpm, bars, tail=2.0, div=96, seed=1):
        self.slug, self.title, self.bpm, self.div = slug, title, bpm, div
        self.beat = 60.0 / bpm
        self.barlen = 4 * self.beat
        self.bars = bars
        self.g = Grid(SR, bpm, bars * self.barlen + tail, div)
        self.N, self.H = self.g.N, self.g.H
        self.t = np.arange(self.N) / SR
        self.rng = np.random.default_rng(seed)
        self.onsets, self.noises = [], []
        self.dir = os.path.join(MUSIC, slug)
        os.makedirs(self.dir, exist_ok=True)

    def at(self, bar, beat=0.0):
        return bar * self.barlen + beat * self.beat

    def snap(self, t):
        return round(t * SR / self.H) * self.H / SR

    def bus(self):
        return np.zeros((2, self.N))

    def put(self, out, snd, t0, vel=1.0, pan=0.0, noise=False):
        """Add a one-shot (mono or (2, n)) at t0, balance-panned (mono sum stays exact for mono input)."""
        i0 = int(round(t0 * SR))
        if i0 >= self.N:
            return
        (self.noises if noise else self.onsets).append(t0)
        if snd.ndim == 1:
            snd = np.stack([snd * min(1, 1 - pan), snd * min(1, 1 + pan)])
        m = min(snd.shape[1], self.N - i0)
        out[:, i0:i0 + m] += vel * snd[:, :m]

    @staticmethod
    def layer(*xs):
        """Sum one-shots of different lengths (zero-padded to the longest)."""
        n = max(len(x) for x in xs)
        out = np.zeros(n)
        for x in xs:
            out[:len(x)] += x
        return out

    def attack(self, n, hops=1):
        k = np.arange(n)
        return np.minimum(1, .5 - .5 * np.cos(np.pi * np.minimum(k / (hops * self.H), 1)))

    def endfade(self, x, s=.02):
        k = min(len(x), int(s * SR))
        x[-k:] *= .5 + .5 * np.cos(np.pi * np.arange(k) / k)
        x[-1] = 0.0
        return x

    # ------------------------------------------------------------------ hop curves
    def lin(self, pts):
        return self.g.lin(pts)

    def hop_env(self, notes, attack=None, release=.1, sustain=None, decay=.3):
        """notes: (t, midi, length[, vel]). Raised-cosine rise (>= 1 hop), optional decay to
        `sustain`, exponential release after the note."""
        th = self.g.th
        attack = max(attack or 0, self.H / SR)
        a = np.zeros(len(th))
        for n in notes:
            t0, L = n[0], n[2]
            v = n[3] if len(n) > 3 else 1.0
            k = th - t0
            on = (k >= 0) & (k < L + 10 * release)
            if not on.any():
                continue
            kk = k[on]
            e = .5 - .5 * np.cos(np.pi * np.clip(kk / attack, 0, 1))
            if sustain is not None:
                e = e * (sustain + (1 - sustain) * np.exp(-np.maximum(0, kk - attack) / decay))
            e = e * np.exp(-np.maximum(0, kk - L) / release)
            a[on] = np.maximum(a[on], v * e)
        return a

    def since_onset(self, times):
        """Seconds since the latest onset, per hop (large before the first)."""
        th = self.g.th
        idx = np.searchsorted(np.sort(times), th, side='right') - 1
        ts = np.sort(times)
        return np.where(idx >= 0, th - ts[np.maximum(idx, 0)], 99.0)

    # ------------------------------------------------------------------ sustained voices
    def saw_line(self, notes, K=32, cutoff=1500.0, res=0.0, detune=(0.0,), pans=None, attack=.005,
                 release=.1, sustain=None, decay=.3, glide=.02, amod=None, square=0.0, carve=None):
        """A monophonic band-limited saw (or saw/square blend) line. cutoff: scalar or per-hop.
        detune: cents per unison voice; pans: one per voice. Returns (2, N)."""
        g = self.g
        self.onsets += [n[0] for n in notes]
        p = g.pitch_hops([(n[0], n[1], n[2]) for n in notes], glide)
        a = self.hop_env(notes, attack, release, sustain, decay)
        if amod is not None:
            a = a * amod
        f = hz(p)
        ks = np.arange(1, K + 1)[:, None]
        fc = np.broadcast_to(np.asarray(cutoff, dtype=float), f.shape)
        timbre = (1 / ks) * (1 + square * (ks % 2 == 1) - square * (ks % 2 == 0))
        out = self.bus()
        pans = pans if pans is not None else np.linspace(-.6, .6, len(detune)) if len(detune) > 1 else [0.0]
        for dc, pn in zip(detune, pans):
            fv = f * 2 ** (dc / 1200)
            fk = ks * fv[None, :]
            W = timbre * lowpass_w(fk, fc[None, :])
            if res:
                W = W * bump_w(fk, fc[None, :], res, .2)
            if carve is not None:
                W = W * carve_w(fk, *carve)
            v = g.synth_voice(fv, W * a[None, :]) / len(detune)
            out[0] += v * min(1, 1 - pn); out[1] += v * min(1, 1 + pn)
        return out

    def sine_line(self, notes, attack=.005, release=.08, glide=.02, amod=None, harm=(1.0,)):
        g = self.g
        self.onsets += [n[0] for n in notes]
        p = g.pitch_hops([(n[0], n[1], n[2]) for n in notes], glide)
        a = self.hop_env(notes, attack, release)
        if amod is not None:
            a = a * amod
        return g.synth_voice(hz(p), np.array(harm)[:, None] * a[None, :])

    VOWEL = {'a': (800, 1150, 2800), 'e': (480, 1850, 2600), 'i': (330, 2200, 2950),
             'o': (500, 850, 2700), 'u': (350, 700, 2500), 'm': (280, 1000, 2500)}

    def sung(self, notes, attack=.06, release=.25, glide=.07, vib=(5.2, .18, .35), K=70,
             breath=.04, seed=5, formant_glide=.08, sustain=None, decay=.4, fscale=1.0, tilt=1.3, odd=0.0):
        """A wordless sung voice: notes (t, midi, len, vowel[, vel]). Glottal source (k^-1.3),
        three moving formants as weights on partials, delayed vibrato, a whisper of breath
        shaped by the same formants. Returns (2, N) centred."""
        g, th = self.g, self.g.th
        self.onsets += [n[0] for n in notes]
        base =[(n[0], n[1], n[2]) + ((n[4],) if len(n) > 4 else ()) for n in notes]
        p = g.pitch_hops([(n[0], n[1], n[2]) for n in notes], glide)
        a = self.hop_env(base, attack, release, sustain, decay)
        vb = np.zeros(len(th))
        for n in notes:
            k = th - n[0]
            on = (k >= 0) & (k < n[2] + .3)
            vb[on] = vib[1] * np.clip((k[on] - vib[2]) / .3, 0, 1) * np.sin(2 * np.pi * vib[0] * k[on])
        f = hz(p + vb)
        F = np.zeros((3, len(th)))
        tgt = np.zeros((3, len(th)))
        order = sorted(notes)
        for i, n in enumerate(order):
            t1 = order[i + 1][0] if i + 1 < len(order) else 1e9
            sel = (th >= n[0]) & (th < t1)
            tgt[:, sel] = fscale * np.array(self.VOWEL[n[3]])[:, None]
        tgt[:, th < order[0][0]] = fscale * np.array(self.VOWEL[order[0][3]])[:, None]
        al = 1 - np.exp(-self.H / (formant_glide * SR))
        F[:, 0] = tgt[:, 0]
        for n in range(1, len(th)):
            F[:, n] = F[:, n - 1] + (tgt[:, n] - F[:, n - 1]) * al
        ks = np.arange(1, K + 1)[:, None]
        fk = ks * f[None, :]
        bw = np.array([90.0, 110.0, 160.0])
        gains = np.array([1.0, .55, .3])
        W = .015 + sum(gains[j] * np.exp(-.5 * ((fk - F[j][None, :]) / (bw[j] + .06 * F[j][None, :])) ** 2) for j in range(3))
        W = W * ks ** -tilt * (1 + odd * ((ks % 2 == 1) - .5)) * lowpass_w(fk, 7000)   # tilt ~1 + odd > 0: robot / talkbox
        v = g.synth_voice(f, W * a[None, :])
        out = np.stack([v, v])
        if breath:
            for ch, sd in enumerate((seed, seed + 1)):
                z = np.random.default_rng(sd).standard_normal(self.N)
                ff, tt, Z = signal.stft(z, SR, nperseg=1024, noverlap=768)
                hp = np.minimum(len(th) - 1, np.round(tt * SR / self.H).astype(int))
                form = sum(np.exp(-.5 * (np.log2(np.maximum(ff, 1)[:, None] / F[j][hp][None, :]) / .2) ** 2) for j in range(3))
                Z *= form * a[hp][None, :] * (ff > 400)[:, None]
                _, x = signal.istft(Z, SR, nperseg=1024, noverlap=768)
                out[ch] += breath * x[:self.N] / (np.abs(x).max() + 1e-9) * np.abs(v).max()
        return out

    # ------------------------------------------------------------------ the womp
    VOWELS = [(730, 1090), (570, 840), (300, 870), (270, 2290), (530, 1840)]

    def womp(self, notes, kicks=(), lo=80.0, hi=3500.0, growl=1.0, beta_max=7.0, reese=.5, rasp=.3,
             drive=6.0, sub=1.0, pocket_db=-9.0, carve=None):
        """Talking wobble bass. notes: (t, midi, len_s, cycle_s, dive_st). Per LFO cycle the filter
        snaps open (raised cosine over max(15 %, 25 ms) of the cycle) and closes slowly, into a
        vowel chosen by the golden ratio. Returns dict(L, R, sub)."""
        g, th, NH = self.g, self.g.th, self.g.NH
        pitch = np.full(NH + 1, np.nan); amp = np.zeros(NH + 1); shape = np.zeros(NH + 1)
        V1 = np.full(NH + 1, 730.0); V2 = np.full(NH + 1, 1090.0)
        for j, (t0, L, m, cyc, dive) in enumerate(notes):
            n0, n1 = g.hop(t0), min(NH + 1, g.hop(t0 + L))
            k = np.arange(n1 - n0) * self.H / SR
            pitch[n0:n1] = m + dive * np.clip(k / L, 0, 1) ** 1.5
            a = np.ones(n1 - n0); a[0] = .35
            if dive:
                a *= np.exp(-k / .45)
            amp[n0:n1] = a
            ru = max(.15, .025 / cyc)
            u = np.mod(k / cyc, 1.0)
            shape[n0:n1] = np.where(u < ru, .5 - .5 * np.cos(np.pi * np.clip(u / ru, 0, 1)),
                                    np.clip((1 - u) / (1 - ru), 0, 1) ** 1.3)
            V1[n0:n1], V2[n0:n1] = self.VOWELS[int((j * PHI) % 1 * 5)]
            self.onsets += [t0 + q * cyc for q in range(int(np.ceil(L / cyc)))]
        live = np.where(~np.isnan(pitch))[0]
        first, last = live[0], live[-1]
        pitch[:first] = pitch[first]
        for n in range(first + 1, NH + 1):
            if np.isnan(pitch[n]):
                pitch[n] = pitch[n - 1]
        for n in range(first + 1, last + 1):
            if amp[n] == 0 and amp[n - 1] > .05:
                amp[n] = .5 * amp[n - 1]
        tail = np.exp(-np.arange(1, 60) * self.H / SR / .05)
        m = max(0, min(len(tail), NH - last))
        amp[last + 1:last + 1 + m] = amp[last] * tail[:m]
        lf = pitch.copy(); al = 1 - np.exp(-self.H / (.03 * SR))
        for n in range(1, NH + 1):
            lf[n] = lf[n - 1] + (pitch[n] - lf[n - 1]) * al
        f0 = hz(lf)
        duck_b = np.ones(NH + 1); duck_s = np.ones(NH + 1)
        kk = np.arange(120) * self.H / SR
        for t0 in kicks:
            n0 = g.hop(t0); mm = min(120, NH + 1 - n0)
            if mm <= 0:
                continue
            duck_b[n0:n0 + mm] = np.minimum(duck_b[n0:n0 + mm], 1 - (1 - 10 ** (pocket_db / 20)) * np.exp(-kk[:mm] / .1))
            duck_s[n0:n0 + mm] = np.minimum(duck_s[n0:n0 + mm], 1 - .9 * np.where(kk[:mm] < .06, 1, np.exp(-(kk[:mm] - .06) / .05)))
        K = 90
        ks = np.arange(1, K + 1)[:, None]
        fk = ks * f0[None, :]
        fc = lo * (hi / lo) ** shape
        F1 = np.exp(np.log(250) + (np.log(V1) - np.log(250)) * shape)
        F2 = np.exp(np.log(650) + (np.log(V2) - np.log(650)) * shape)
        Wt = (1 / ks) * (1 + .6 * (ks % 2 == 1)) * lowpass_w(fk, fc[None, :]) * bump_w(fk, fc[None, :], 8, .2)
        Wt = Wt * (bump_w(fk, F1[None, :], 12, .22) + bump_w(fk, F2[None, :], 9, .22) - 1)
        if carve is not None:
            Wt = Wt * carve_w(fk, *carve)
        body_amp = Wt * (amp * duck_b)[None, :]
        body = g.synth_voice(f0, body_amp)
        top = body_amp.copy(); top[:2] = 0
        c8 = 2 ** (8 / 1200)
        up, dn = g.synth_voice(f0 * c8, top), g.synth_voice(f0 / c8, top)
        L = body / 2 + .35 * (.725 * up + .275 * dn)
        R = body / 2 + .35 * (.275 * up + .725 * dn)
        if growl:
            ns = np.arange(-6, 7)
            ratios = 2 * (1 + ns * PHI)
            beta = 1.0 + beta_max * shape
            fr = np.abs(ratios)[:, None] * f0[None, :]
            ga = jv(ns[:, None], beta[None, :]) * lowpass_w(fr, 1.6 * fc[None, :]) * (fr > 120) * (amp * duck_b)[None, :]
            gr = growl * g.synth_ratios(f0, ratios, ga)
            L += gr; R += gr
        if reese:
            rz = (1 / ks) * lowpass_w(ks * f0[None, :], 1200) * (amp * duck_b)[None, :]
            rz[:2] = 0
            beat_hz = 2.0 / self.beat           # beats in 8th notes
            L += reese * g.synth_voice(f0 + beat_hz / 2, rz); R += reese * g.synth_voice(np.maximum(f0 - beat_hz / 2, 1), rz)
        if rasp:
            for ch, sd in ((0, 31), (1, 32)):
                z = np.random.default_rng(sd).standard_normal(self.N)
                ff, tt, Z = signal.stft(z, SR, nperseg=1024, noverlap=768)
                hp = np.minimum(len(th) - 1, np.round(tt * SR / self.H).astype(int))
                gg = (amp * duck_b * shape)[hp]
                form = (np.exp(-.5 * (np.log2(np.maximum(ff, 1)[:, None] / F1[hp][None, :]) / .25) ** 2)
                        + .7 * np.exp(-.5 * (np.log2(np.maximum(ff, 1)[:, None] / F2[hp][None, :]) / .25) ** 2))
                Z *= form * gg[None, :]
                _, x = signal.istft(Z, SR, nperseg=1024, noverlap=768)
                x = x[:self.N] / (np.abs(x).max() + 1e-9) * np.abs(body).max()
                (L if ch == 0 else R)[:] += rasp * x
        if drive:
            L, R = dirt(L, R, SR, drive, lp_hz=2200)
        subw = sub * g.synth_voice(f0, (amp * duck_s)[None, :])
        return dict(L=L, R=R, sub=subw, notes=notes)

    # ------------------------------------------------------------------ one-shots
    def partials(self, f0, dur, ratios, amps, taus, attack_hops=1, seed=None):
        n = int(dur * SR); t = np.arange(n) / SR
        rng = np.random.default_rng(seed) if seed is not None else self.rng
        y = np.zeros(n)
        for r, a, tau in zip(ratios, amps, taus):
            f = r * f0
            if f > 17500 or f < 18:
                continue
            y += a * np.exp(-t / tau) * np.sin(2 * np.pi * f * t + rng.random() * 6.283)
        return self.endfade(y * self.attack(n, attack_hops))

    def piano(self, m, vel=.7, dur=None, felt=0.0):
        """Two strings per note, stiff-string partials f_k = k f0 sqrt(1 + B k^2), brighter
        with velocity, higher partials dying faster. felt (0..1) darkens and softens the hammer."""
        f0 = float(hz(m))
        base = float(np.clip(3.2 * (261.6 / f0) ** .45, .7, 7.0))
        dur = dur or min(9.0, 1.6 * base + .5)
        K = 18
        k = np.arange(1, K + 1)
        B = 3.5e-4 * (f0 / 261.6) ** .5
        ratios = k * np.sqrt(1 + B * k ** 2)
        amps = k ** -1.15 * vel ** (.6 + .18 * k) * np.exp(-felt * .45 * (k - 1))
        taus = base / (1 + .28 * (k - 1))
        c = 2 ** (.7 / 1200)
        y = self.partials(f0 * c, dur, ratios, amps, taus, 1 + int(3 * felt)) \
            + self.partials(f0 / c, dur, ratios, .8 * amps, taus * .9, 1 + int(3 * felt))
        return y / 2

    def bell(self, m, dur=6.0, bright=1.0):
        f0 = float(hz(m))
        r = [.5, 1, 1.19, 1.5, 2, 2.5, 2.67, 3.0, 4.0, 5.33]
        a = np.array([.35, 1, .45, .3, .55, .22, .18, .15, .1, .07]) * bright ** np.arange(10) / bright
        tau = np.array([5, 4, 2.6, 2.2, 2.0, 1.4, 1.2, 1.0, .7, .45]) * dur / 6
        return self.partials(f0, dur, r, a, tau, 2)

    def fm(self, m, dur, ratio=1.0, beta=1.5, tau_b=.2, tau_a=1.0, attack_hops=1, tine=0.0):
        """Two-operator FM one-shot (Rhodes at ratio 1, bells at irrational ratios)."""
        f = float(hz(m)); n = int(dur * SR); t = np.arange(n) / SR
        b = beta * np.exp(-t / tau_b)
        y = np.exp(-t / tau_a) * np.sin(2 * np.pi * f * t + b * np.sin(2 * np.pi * ratio * f * t))
        if tine and 14 * f < 17000:
            y += tine * np.exp(-t / .04) * np.sin(2 * np.pi * 14 * f * t)
        return self.endfade(y * self.attack(n, attack_hops))

    def pluck(self, m, dur=.6, bright=.5, K=40):
        f0 = float(hz(m)); k = np.arange(1, K + 1)
        return self.partials(f0, dur, k, 1 / k, .45 / (1 + bright * (k - 1)))

    def noise(self, n, lo, hi, tilt=0.0, seed=None):
        rng = np.random.default_rng(seed) if seed is not None else self.rng
        fq = np.fft.rfftfreq(n, 1 / SR)
        band = ((fq > lo) & (fq < hi)) * (lo / np.maximum(fq, 1)) ** tilt
        z = np.fft.irfft(band * np.exp(2j * np.pi * rng.random(len(fq))), n)
        return z / (np.abs(z).max() + 1e-12)

    def kick(self, hi=150, lo=48, tau_f=.035, tau_a=.085, p2=.22, p3=.08, click=0.0, drive=0.0, dur=.55):
        n = int(dur * SR); t = np.arange(n) / SR
        f = lo + (hi - lo) * np.exp(-t / tau_f)
        ph = 2 * np.pi * np.cumsum(f) / SR
        y = np.exp(-t / tau_a) * (np.sin(ph) + p2 * np.sin(2 * ph) + p3 * np.sin(3 * ph))
        if click:
            y += click * np.exp(-t / .004) * self.noise(n, 2500, 7000, seed=77)
        if drive:
            y = np.tanh(drive * y) / np.tanh(drive)
            y = signal.sosfiltfilt(signal.butter(2, 7000, 'lowpass', fs=SR, output='sos'), y)
        return self.endfade(y * self.attack(n))

    def snare(self, tune=1.0, tau=.055, dur=.4, body=1.0):
        n = int(dur * SR); t = np.arange(n) / SR
        b = body * (.5 * np.exp(-t / .05) * np.sin(2 * np.pi * 185 * tune * t) + .3 * np.exp(-t / .035) * np.sin(2 * np.pi * 330 * tune * t))
        return self.endfade(self.attack(n) * (b + .55 * np.exp(-t / tau) * self.noise(n, 1200, 9000, .5)))

    def clap(self, dur=.35):
        n = int(dur * SR); t = np.arange(n) / SR
        z = self.noise(n, 900, 7000, .3)
        env = np.zeros(n)
        for d in (0, .009, .019):
            k = t - d
            env += np.where(k >= 0, np.exp(-np.maximum(k, 0) / .007), 0) * .5 * (1 - np.cos(np.pi * np.clip(k * SR / self.H, 0, 1)))
        env += .6 * np.where(t >= .027, np.exp(-np.maximum(t - .027, 0) / .07), 0)
        return self.endfade(env * z * self.attack(n))

    def hat(self, open_=False, dur=None):
        dur = dur or (.35 if open_ else .08)
        n = int(dur * SR); t = np.arange(n) / SR
        return self.endfade(self.attack(n) * np.exp(-t / (.11 if open_ else .018)) * self.noise(n, 7000, 16000))

    def shaker(self):
        n = int(.09 * SR); t = np.arange(n) / SR
        env = np.sin(np.pi * np.clip(t / .05, 0, 1)) ** 2 * np.exp(-t / .03)
        return self.endfade(env * self.noise(n, 4000, 12000))

    def glitch(self, kind, seed):
        """Micro events for Hopkins-style crackle: blip (falling sine), tick (band noise), grain (FM zip)."""
        rng = np.random.default_rng(seed)
        if kind == 'blip':
            n = int(.03 * SR); t = np.arange(n) / SR
            f = (2500 + 3000 * rng.random()) * np.exp(-t / .01) + 600
            y = np.exp(-t / .008) * np.sin(2 * np.pi * np.cumsum(f) / SR)
        elif kind == 'tick':
            n = int(.012 * SR); t = np.arange(n) / SR
            c = 2000 + 6000 * rng.random()
            y = np.exp(-t / .002) * self.noise(n, c / 1.5, c * 1.5, seed=int(rng.integers(1e6)))
        else:
            n = int(.06 * SR); t = np.arange(n) / SR
            f = 800 + 1600 * rng.random()
            y = np.exp(-t / .02) * np.sin(2 * np.pi * f * t + 3 * np.exp(-t / .01) * np.sin(2 * np.pi * PHI * f * t))
        return self.endfade(y * self.attack(n))

    # ------------------------------------------------------------------ space
    def ir(self, t60_lo=1.6, t60_hi=.5, f_lo=800, f_hi=10000, dur=2.5, seed=1, predelay=.02, dark=None):
        n = int(dur * SR)
        z = np.random.default_rng(seed).standard_normal(n)
        f, tt, Z = signal.stft(z, SR, nperseg=2048)
        t60 = np.interp(np.log2(np.maximum(f, 1)), [np.log2(f_lo), np.log2(f_hi)], [t60_lo, t60_hi])
        Z *= np.exp(-6.91 * tt[None, :] / t60[:, None])
        if dark:
            Z *= (1 / np.sqrt(1 + (f / dark) ** 4))[:, None]
        _, h = signal.istft(Z, SR, nperseg=2048)
        h = h[:n]; k = int(.005 * SR); h[:k] *= np.linspace(0, 1, k)
        h = np.concatenate([np.zeros(int(predelay * SR)), h])
        return h / np.sqrt(np.sum(h ** 2))

    def reverb(self, send, hp=250, **kw):
        """send: (2, N) or mono. Returns (2, N), decorrelated by seed."""
        mono = send.sum(axis=0) if send.ndim == 2 else send
        mono = signal.sosfiltfilt(signal.butter(2, hp, 'highpass', fs=SR, output='sos'), mono)
        seed = kw.pop('seed', 1)
        return np.stack([signal.fftconvolve(mono, self.ir(seed=seed, **kw))[:self.N],
                         signal.fftconvolve(mono, self.ir(seed=seed + 1, **kw))[:self.N]])

    def delay(self, send, d_s, fb=.4, reps=8, lp=5000, pingpong=.8):
        mono = send.sum(axis=0) if send.ndim == 2 else send
        D = int(round(d_s * SR)); out = self.bus(); y = mono.copy()
        sos = signal.butter(1, lp, 'lowpass', fs=SR, output='sos')
        for r in range(1, reps + 1):
            y = signal.sosfilt(sos, y) * fb
            if r * D >= self.N:
                break
            sh = np.concatenate([np.zeros(r * D), y[:self.N - r * D]])
            p = pingpong if r % 2 else -pingpong
            out[0] += (1 - p) / 2 * sh; out[1] += (1 + p) / 2 * sh
        return out

    def pump(self, times, depth_db=-6.0, rel=.15, hold=.02):
        """Sidechain as a gain curve: dips one hop before each time, recovers over `rel`."""
        gcurve = np.ones(self.N)
        d = 1 - 10 ** (depth_db / 20)
        n = int((hold + 6 * rel) * SR) + self.H; t = np.arange(n) / SR
        shp = 1 - d * self.attack(n) * np.exp(-np.maximum(0, t - self.H / SR - hold) / rel)
        for t0 in times:
            i0 = max(0, int(round(t0 * SR)) - self.H); m = min(n, self.N - i0)
            if m > 0:
                gcurve[i0:i0 + m] = np.minimum(gcurve[i0:i0 + m], shp[:m])
        return gcurve

    def window(self, a, b, edge=.01):
        """Per-sample 0..1 gate open on [a, b) with raised-cosine edges."""
        t = self.t
        u = np.clip((t - a) / edge + .5, 0, 1) * np.clip((b - t) / edge + .5, 0, 1)
        return .5 - .5 * np.cos(np.pi * u)

    def sweep(self, pts):
        """Per-sample piecewise-linear curve."""
        xs, ys = zip(*pts)
        return np.interp(self.t, xs, ys)

    def shepard(self, a, b, center=78, lvl=(-18, 0)):
        L = self.bus()
        n0, n1 = int(a * SR), int(b * SR); t = np.arange(n1 - n0) / SR; u = t / (b - a)
        cres = 10 ** ((lvl[0] + (lvl[1] - lvl[0]) * u ** 1.5) / 20)
        cut = np.ones_like(t); k = int(.02 * SR); cut[-k:] = .5 + .5 * np.cos(np.pi * np.arange(k) / k); cut[-1] = 0
        base = 24 * u ** 1.6
        for j in range(8):
            m = 24 + np.mod(12 * j + base, 96)
            s = np.exp(-.5 * ((m - center) / 14) ** 2) * np.sin(2 * np.pi * np.cumsum(hz(m)) / SR + self.rng.random() * 6.28) * cres * cut
            p = .5 if j % 2 else -.5
            L[0, n0:n1] += (1 - p) / 2 * s; L[1, n0:n1] += (1 + p) / 2 * s
        for ch in range(2):
            nz = self.noise(n1 - n0, 20, 20000)
            ff, tt, Z = signal.stft(nz, SR, nperseg=1024)
            fc = 300 * (9000 / 300) ** (tt / (b - a)) ** 1.3
            Z *= np.exp(-.5 * (np.log2(np.maximum(ff, 1)[:, None] / fc[None, :]) / .8) ** 2)
            _, x = signal.istft(Z, SR, nperseg=1024)
            x = x[:n1 - n0]; x /= np.abs(x).max()
            L[ch, n0:n1] += .7 * x * cres * cut
        self.noise_window = getattr(self, 'noise_window', []) + [(a, b)]
        return L

    def impact(self, t0, crash=.5):
        n = int(2.5 * SR); t = np.arange(n) / SR
        f = 32 + 43 * np.exp(-t / .18)
        boom = self.attack(n) * np.exp(-t / .55) * np.sin(2 * np.pi * np.cumsum(f) / SR)
        th = self.attack(n) * np.exp(-t / .025) * self.noise(n, 100, 3000)
        out = self.bus()
        self.put(out, self.endfade(boom + .5 * th), t0)
        for ch in range(2):
            cz = self.endfade(self.attack(n) * np.exp(-t / 1.1) * self.noise(n, 2500, 14000, .3))
            i0 = int(round(t0 * SR)); m = min(n, self.N - i0)
            out[ch, i0:i0 + m] += crash * cz[:m]
        self.noises.append(t0)
        return out


def euclid(k, n, rot=0):
    return [((i + rot) * k) % n < k for i in range(n)]


def norm_rms(x, db):
    r = np.sqrt(np.mean(x ** 2)) + 1e-12
    return x * 10 ** (db / 20) / r


def rms(x, a=None, b=None):
    s = x[..., int((a or 0) * SR):None if b is None else int(b * SR)]
    return 20 * np.log10(np.sqrt(np.mean(s ** 2)) + 1e-12)


# ======================================================================= finish
def finish(tr, mix, target=-14.0, tp=-1.0, fade=None, sections=(), notes=''):
    """Mono low end, fade, master to target, write WAV + MP3, run the checks, draw the beatgram."""
    x = mono_below(mix, SR)
    if fade:
        a, b = fade
        u = np.clip((tr.t - a) / (b - a), 0, 1)
        x = x * (.5 + .5 * np.cos(np.pi * u)) * (tr.t < b)
    x = x * 10 ** ((-20 - rms(x)) / 20)
    wav = os.path.join(tr.dir, tr.slug + '.wav')
    r = master_to(x, SR, wav, target, tp - .6)
    to_mp3(wav, os.path.join(tr.dir, tr.slug + '.mp3'))
    y, _ = sf.read(wav)
    ok = True
    lines = []
    def check(name, cond, detail):
        nonlocal ok
        ok &= bool(cond); lines.append(f'[{"OK" if cond else "FAIL"}] {name}: {detail}')
    check('length', len(y) == tr.N, f'{len(y)} samples = {len(y) / SR:.3f} s')
    check('loudness', abs(r['lufs'] - target) <= .2, f"{r['lufs']} LUFS (target {target})")
    check('true peak', r['tp'] <= tp, f"{r['tp']} dBTP")
    if fade:
        check('ends in silence', np.abs(y[int(fade[1] * SR):]).max() == 0, f'digital zero from {fade[1]:.2f} s')
    noise = sorted(set(tr.noises))
    for a, b in getattr(tr, 'noise_window', []):
        noise += list(np.arange(a, b, tr.H / SR * 4))
    n, stray = census(wav, sorted(set(tr.onsets)), noise, tr.bpm, tr.div, verbose=False)
    check('stray clicks', n <= 3, f'{n}' + (f' at {", ".join(f"{s:.3f}" for s in stray[:6])} s' if n else ''))
    gr = r['limiter']
    lines.append(f'limiter: >1 dB reduction {100 * gr[0]:.1f} % of the time, max {gr[1]:.1f} dB')
    mono_l = os.path.join(tr.dir, '_mono.wav')
    sf.write(mono_l, np.repeat(y.mean(axis=1, keepdims=True), 2, axis=1), SR, subtype='PCM_24')
    lines.append(f'mono fold-down: {loudness(mono_l)[0] - r["lufs"]:+.1f} LU'); os.remove(mono_l)
    beatgram(wav, os.path.join(tr.dir, 'beatgram.png'), [s for s, _ in sections], tr.bpm, tr.div)
    sha = hashlib.sha256(open(wav, 'rb').read()).hexdigest().upper()
    lines.append(f'SHA-256 {sha[:16]}')
    rep = dict(title=tr.title, slug=tr.slug, bpm=tr.bpm, seconds=round(tr.N / SR, 3), lufs=r['lufs'], tp=r['tp'],
               clicks=n, limiter=gr, sha256=sha, sections=sections, ok=ok, checks=lines, notes=notes)
    json.dump(rep, open(os.path.join(tr.dir, 'report.json'), 'w'), indent=1)
    print(f'\n== {tr.title}')
    print('\n'.join(lines))
    print('ALL CHECKS PASS' if ok else 'SOME CHECKS FAILED')
    return rep
