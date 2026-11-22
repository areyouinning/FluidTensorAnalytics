"""A recipe layer over kit.py: a style study becomes a page of musical decisions.

    s = Song('slug', 'Title (after X)', bpm=120, bars=32, prog=[[...], ...], bpc=1)
    s.drums('kick', 'X...X...X...X...', s.span(4, 28), s.tr.kick())
    s.pad('pad', s.span(0, 32))
    s.bass('bass', s.span(8, 28), [(0, 0, .5), (1.5, 0, .25)])
    s.melody('lead', [(bar, beat, midi, beats), ...], inst=lambda m, L: s.tr.pluck(m, L))
    s.mixdown({'kick': -20, 'pad': -26, ...}, pump=('kick', -5, .15, ['pad', 'bass']), sends={'pad': .5})
"""
import numpy as np
from scipy import signal
from kit import Track, finish, norm_rms, hz, fft_eq, dirt, euclid, SR, PHI


def span(*pairs):
    """span(0, 8, 12, 16) -> bars 0..7 and 12..15"""
    out = []
    for a, b in zip(pairs[::2], pairs[1::2]):
        out += list(range(a, b))
    return out


class Song:
    def __init__(self, slug, title, bpm, bars, prog, bpc=1, div=96, tail=2.0, seed=1):
        self.tr = Track(slug, title, bpm, bars, tail=tail, div=div, seed=seed)
        self.prog, self.bpc, self.bars = prog, bpc, bars
        self.buses = {}
        self.kick_times = []
        self.at = self.tr.at
        self.span = span
        self.sections = []

    def chord(self, b):
        return self.prog[(b // self.bpc) % len(self.prog)]

    def root(self, b, lo=33):
        pc = self.chord(b)[0] % 12
        return lo + (pc - lo) % 12

    def add(self, name, x):
        if x.ndim == 1:
            x = np.stack([x, x])
        self.buses[name] = self.buses.get(name, 0) + x

    # ------------------------------------------------------------------ drums
    VEL = {'X': 1.0, 'x': .72, 'o': .45, '-': .25}

    def drums(self, name, pattern, bars, sound, vel=1.0, swing=0.0, pan=0.0, noise=False, kick=False, var=None, jitter=0.0):
        """pattern: 16 chars per bar (32 for two bars). swing delays the odd 16ths by that fraction
        of a 16th, snapped to the hop grid. var(bar) -> alternative pattern or None."""
        out = self.tr.bus()
        hops16 = self.tr.g.div // 4
        sw = round(swing * hops16) * self.tr.H / SR
        for b in bars:
            p = (var(b) if var else None) or pattern
            n = len(p) // 16
            seg = p[(b % n) * 16:(b % n) * 16 + 16]
            for i, c in enumerate(seg):
                if c in self.VEL:
                    t0 = self.at(b, i / 4) + (sw if i % 2 else 0)
                    if jitter:                                   # drunk timing, still on the hop grid
                        t0 = max(0.0, self.tr.snap(t0 + jitter * self.tr.rng.standard_normal()))
                    snd = sound(b, i) if callable(sound) else sound
                    self.tr.put(out, snd, t0, vel * self.VEL[c], pan=pan, noise=noise)
                    if kick:
                        self.kick_times.append(t0)
        self.add(name, out)
        return out

    # ------------------------------------------------------------------ harmony
    def pad(self, name, bars, K=30, cutoff=1500.0, res=2, detune=(-10, 10), attack=.4, release=.8, octave=0,
            voices=None, amod=None, glide=.15, inst=None):
        out = self.tr.bus()
        nv = len(self.chord(bars[0]))
        for v in (voices if voices is not None else range(nv)):
            notes = [(self.at(b), self.chord(b)[v % len(self.chord(b))] + octave, self.tr.barlen + .05) for b in bars]
            if inst == 'sung':
                x = self.tr.sung([n + ('ao'[i % 2], .8) for i, n in enumerate(notes)], attack=attack, release=release,
                                 glide=glide, vib=(4.5, .08, .5), breath=.04, seed=200 + v, formant_glide=.4, K=40)
            else:
                x = self.tr.saw_line(notes, K=K, cutoff=cutoff, res=res, detune=detune, attack=attack,
                                     release=release, glide=glide, amod=amod)
            out += x
        self.add(name, out)
        return out

    def stabs(self, name, bars, rhythm, inst, octave=0, spread=.35, vel=1.0):
        """rhythm: [(beat, beats_long, vel)], inst(midi, seconds) -> mono one-shot."""
        out = self.tr.bus()
        for b in bars:
            ch = self.chord(b)
            for beat, L, v in rhythm:
                for j, m in enumerate(ch):
                    pan = spread * (2 * j / max(1, len(ch) - 1) - 1)
                    self.tr.put(out, inst(m + octave, L * self.tr.beat), self.at(b, beat), vel * v / len(ch) * 2, pan=pan)
        self.add(name, out)
        return out

    def arp(self, name, bars, inst, rate=.25, order=(0, 1, 2, 3, 2, 1), octave=12, vel=.8, accent=(1.0,),
            pan_spread=.4, length=None):
        out = self.tr.bus()
        k = 0
        for b in bars:
            ch = self.chord(b)
            pool = [m + octave for m in ch] + [m + octave + 12 for m in ch]
            steps = int(round(4 / rate))
            for s in range(steps):
                m = pool[order[k % len(order)] % len(pool)]
                L = (length or rate) * self.tr.beat
                self.tr.put(out, inst(m, L), self.at(b, s * rate), vel * accent[s % len(accent)],
                            pan=pan_spread * np.sin(k * 2.39996))
                k += 1
        self.add(name, out)
        return out

    def bass(self, name, bars, pattern, kind='saw', cutoff=600.0, res=3, lo=33, K=24, release=.05, glide=.02,
             env=0.0, detune=(0.0,), harm=(1.0, .3)):
        """pattern: [(beat, interval, beats_long[, vel])]. kind: saw | sine | square | acid."""
        notes = []
        for b in bars:
            r = self.root(b, lo)
            for p in pattern:
                notes.append((self.at(b, p[0]), r + p[1], p[2] * self.tr.beat, p[3] if len(p) > 3 else 1.0))
        notes.sort()
        if kind == 'sine':
            x = self.tr.sine_line(notes, attack=.006, release=release, glide=glide, harm=harm)
        else:
            cut = cutoff
            if env:
                since = self.tr.since_onset([n[0] for n in notes])
                cut = cutoff * (1 + env * np.exp(-since / .08))
            x = self.tr.saw_line(notes, K=K, cutoff=cut, res=res, attack=.005, release=release, glide=glide,
                                 square=.8 if kind == 'square' else 0.0, detune=detune)
        self.add(name, x)
        return notes

    def melody(self, name, notes, inst=None, sung=None, pan=0.0):
        """notes: [(bar, beat, midi, beats[, vowel])]. inst: one-shot fn(midi, seconds); or sung=dict(...)."""
        if sung is not None:
            ns = [(self.at(b, bt), m, L * self.tr.beat * .95, (rest[0] if rest else 'a')) for b, bt, m, L, *rest in notes]
            x = self.tr.sung(ns, **sung)
            self.add(name, x)
            return x
        out = self.tr.bus()
        for b, bt, m, L, *rest in notes:
            self.tr.put(out, inst(m, L * self.tr.beat), self.at(b, bt), rest[0] if rest and not isinstance(rest[0], str) else 1.0, pan=pan)
        self.add(name, out)
        return out

    # ------------------------------------------------------------------ edits
    def stutter(self, name, t0, slice_beats, repeats):
        """Retrigger a slice of a bus: the slice starting at t0 replays `repeats` times (1-hop edges)."""
        x = self.buses[name]
        n = int(round(slice_beats * self.tr.beat * SR)); i0 = int(round(t0 * SR))
        seg = x[:, i0:i0 + n].copy()
        e = np.ones(n); k = self.tr.H
        e[:k] = np.linspace(0, 1, k); e[-k:] = np.linspace(1, 0, k)
        seg = seg * e
        for r in range(repeats):
            a = i0 + r * n
            if a + n > self.tr.N:
                break
            x[:, a:a + n] = seg
            self.tr.onsets.append(a / SR)

    def gate(self, name, a, b, edge=.01):
        self.buses[name] = self.buses[name] * (1 - self.tr.window(a, b, edge))

    def lowpass_sweep(self, name, pts):
        """Crossfade a bus with a dark copy: pts [(t, 0..1 openness)]."""
        x = self.buses[name]
        dark = np.stack([fft_eq(c, SR, [(400, 0), (1200, -30)]) for c in x])
        o = self.tr.sweep(pts)
        self.buses[name] = dark * (1 - o) + x * o

    # ------------------------------------------------------------------ mix
    def mixdown(self, levels, pump=None, sends=None, room=None, delay=None, delay_sends=None, master_eq=None,
                target=-14.0, fade=None, notes='', lofi=None):
        tr = self.tr
        b = {k: norm_rms(v, levels[k]) for k, v in self.buses.items() if k in levels}
        mix = tr.bus()
        if sends:
            send = sum(sends[k] * b[k] for k in sends if k in b)
            rp = dict(t60_lo=2.2, t60_hi=.9, dur=3.5, seed=5)
            rp.update(room or {})
            wet = rp.pop('wet', .4)
            b['_room'] = norm_rms(tr.reverb(send, **rp), -22) * wet
        if delay_sends:
            ds = sum(delay_sends[k] * b[k] for k in delay_sends if k in b)
            b['_delay'] = tr.delay(ds, **(delay or dict(d_s=.75 * tr.beat, fb=.35, reps=6, lp=4000)))
        g = None
        if pump:
            src, depth, rel, which = pump
            g = tr.pump(self.kick_times, depth, rel)
        for k, v in b.items():
            if g is not None and (k in pump[3] or k in ('_room', '_delay')):
                v = v * g
            mix += v
        if lofi:
            mix = np.stack([fft_eq(c, SR, lofi) for c in mix])
        if master_eq:
            mix = np.stack([fft_eq(c, SR, master_eq) for c in mix])
        fade = fade or (tr.at(self.bars - 1), tr.at(self.bars) + 1.0)
        return finish(tr, mix, target=target, fade=fade, sections=self.sections, notes=notes)
