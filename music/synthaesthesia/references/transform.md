# The beat-semitone transform (BST)

A time-frequency frame chosen so the music's own rhythms are integers. Its lineage: Gabor's 1946
atoms and Brown's constant-Q transform (1991), on a grid derived from the score.

## The grid

- **Time:** hops of `1/div` beat. One hop is `H = sr*60/bpm/div` samples, which must be an integer.
  At 48 kHz and 120 BPM a beat is 24,000 samples. With `div=96`, H = 250 samples (5.2 ms), so
  8ths, 16ths, triplets and the 2-3-4-6-8 tuplet ladder all land exactly on hops.
- **Choosing `div`:** take the least common multiple of the subdivisions you need (16ths and triplets
  need 12; add 32nds and you need 24) and multiply it until H is small (≤ about 6 ms) and still an
  integer. At 44.1 kHz many tempos have no clean H, so render at 48 kHz and convert at the end if
  needed. At non-integer BPM, pick `sr` or `div` to fit. `Grid` raises if H is not an integer.
- **Frequency:** semitones (MIDI pitch, fractional allowed). Filters, carving and formants are all
  easiest in log frequency.

## Synthesis (the inverse transform)

A voice is `sum_k a_k(t) sin(k * phase(t))`, where `phase` is the integral of the fundamental,
computed once per voice.
- **Coefficients per hop, raised-cosine between hops.** Every change takes at least one hop and is
  C1-smooth (continuous with a continuous first derivative).
- **One phase integral per voice.** Phase never resets, so legato and glides are free and nothing
  pops on a note change.
- **Band-limited by weight.** A partial's weight fades to zero between 18 and 20 kHz (19 kHz for
  arbitrary ratios), so nothing aliases. This is why a saw built from 48–90 partials stays clean.
- **`synth_ratios`** handles any ratio, including inharmonic and negative ones. That gives FM as its
  exact sideband series: `sin(wc t + b sin(wm t)) = sum_n J_n(b) sin((wc + n wm) t)`. A negative
  ratio is the reflected sideband, because sin(-x) = -sin(x). Writing FM this way means the index β
  can be automated per hop without any sideband ever stepping.
- **Filters are weights on partial frequencies.** A resonant low-pass is
  `1/sqrt(1+(f/fc)^4)` times a log-Gaussian bump at fc. Cutoff automation is per hop and cannot zipper.
- Noise-based parts (snare, rasp, riser band, reverb IR) are built from **random-phase spectra**
  or **shaped in the STFT plane**, with fixed seeds.

## Analysis (the forward transform)

For each pitch bin, a Gaussian band slice of one FFT of the whole signal is shifted to baseband and
inverse-transformed straight onto the hop grid. Bins are 1/3 semitone wide. Each bin's time width
is clipped to between half a hop and a quarter beat, so low bins aren't smeared over bars. A steady
sinusoid of amplitude A reads about A/2 in its own bin. Round-trip test: synthesize a known note
and check it appears in the predicted bin at the predicted level.

The forward transform is what makes measurement native:
- the **click census** looks for broadband rises in one hop;
- **figure/ground** compares melody and backing energy in the melody's own bins;
- the **beatgram** is the picture of the mix with bars and cuts on the axis.

## Performance

60 s at 48 kHz is 2.88 M samples and 11,520 hops. `synth_voice` works in one-second blocks and
skips silent partials. A 90-partial bass is a few seconds. The full reference render (≈30 stems,
reverb convolutions, the mastering loop) takes a few minutes, so run it in the background.
