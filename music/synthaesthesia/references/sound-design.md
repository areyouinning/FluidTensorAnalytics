# Instrument cookbook

Each recipe is what shipped in `soundtrack/native/` (render.py, bass_build.py, garden.py). The
numbers are starting points that were tuned by ear and checked by metric. Where an attack is called
"atk", it means a raised-cosine rise over one hop.

## Figure: the melody

- One continuous voice, with log-frequency glide (about 12 ms) between notes.
- Timbre: near-sine, partials `[1, .18, .12, .05, .04]`.
- Envelope: attack of one hop; decay to sustain .55 with τ .25 s; release .08 s.
- Delayed vibrato: 5.5 Hz, ±12 cents, fading in 0.15–0.35 s into each note.
- Mix: centred, with little reverb.

## Ground: the arpeggio / pad

- Two band-limited saws (48 partials, weight 1/k), ±4 cents apart, panned linearly ±0.35. That
  pan is mono-exact: L+R sums to the unpanned voice.
- A resonant low-pass as weights; cutoff and resonance automated per hop.
- A build "thins from below" with a rising high-pass weight (80 → 400–700 Hz).
- **Spectral sidechain:** for melody partials j = 1..4, notch arp partials within about ⅓ semitone
  by up to 60 %, scaled by the melody's level. Then dip the whole ground about 2 dB under the melody.

## Kick

- A chirped sine `48 + 100·e^(−t/.035)` Hz, with partials 2 and 3 at .22/.08 so phones hear it,
  and a body τ of .085 s.
- **Drop kick:** snaps `50 + 150·e^(−t/.022)` Hz (200 → 50 Hz in about 20 ms), partial 2 at .35, plus
  a 4 ms click of 2.5–7 kHz random-phase noise at .3. Chest punch went from +2.8 to +6.5 dB.
- Velocity curves come from the score. A build's kick roll (quarters → eighths → sixteenths)
  crescendos .52 → .72.

## Snare

- Two damped body tones: 185 Hz (τ .05) and 330 Hz (τ .035).
- Band noise: 1.2–9 kHz, −3 dB/oct tilt, from a random-phase spectrum, with τ .055.
- In a build, the tune rises up to ×1.65 and τ shortens to .03.

## Talking womp bass (Splatinum-style)

- **Notes:** roots read from the harmony (the arp's lowest note per bar) at C1–B1, 33–62 Hz. Deep
  is the point; the author hears an octave-higher bass as "meek".
- **Per LFO cycle the filter snaps open, then closes slowly:**
  - the rise is a raised cosine over `ru = max(.15, .025/cycle)` of the cycle, never faster than
    25 ms (faster clicks);
  - the fall is `((1−u)/(1−ru))^1.3`;
  - the cutoff is `80·(3500/80)^shape`.
- **Vowels:** two formant bumps (+12/+9 dB, 0.22 oct wide) glide from a closed "m" (250/650 Hz) to
  the note's vowel as it opens. The vowel per womp comes from a golden-ratio sequence:
  `VOWELS[int((j·φ) mod 1 · 5)]`, with ah, oh, oo, ee and eh.
- **Rate grammar:** 1/4, 1/8, 1/8T and 1/16 per beat. Fill bars lock to the kick's triplets.
- **Timbre:** 90 partials, `1/k · (1 + .6·odd)`.
- **Movement:**
  - dives of −12 st over the note (`^1.5` curve, amplitude e^(−t/.45));
  - a stop for the last eighth before a downbeat (release over two hops);
  - a one-hop re-articulation dip to .35 on each note.
- **Kick pocket:** the body dips 9 dB (τ .1); the subs clear 90 % for 60 ms.
- **Carve around the fun track:** notch near melody partials 1–4 *and* arp partials 1–6. The bass then
  dominates by register and loudness while the melody stays audible on top.
- **Layers:**
  - a unison sine sub;
  - detuned ±8-cent copies from partial 3 up only, so the low end stays mono;
  - the rasp: two decorrelated noise fields shaped in the STFT by the same moving formants, gated by
    womp × level, about −9 dB.
- **Bus:** tanh drive of 6 at 4× oversampling, low-passed at 2.2 kHz. A −3 dB shelf above about
  400 Hz–1.2 kHz leaves the mids to the fun track.

## Golden-ratio FM growl

Carrier one octave up, modulator at φ times the carrier. The sidebands sit at `2(1 + nφ)·f0` for
n = −6..6, with amplitudes J_n(β). β = 1 + 7·shape, so the growl opens with the womp. It is
low-passed at 1.6× the womp cutoff, and anything under 120 Hz is dropped (mono sub). Inharmonic,
never periodic, always "in" the note.

## Tempo-locked reese

The same saw, offset by exactly ±4 Hz left and right, so it beats at 4 Hz: eighth notes at 120 BPM.
Use a static 1.2 kHz low-pass and leave out partials 1–2 to keep the low end mono. In general, use
offset = tempo/60 × (beats per eighth).

## Bessel drum (the boom)

- **Modes:** a circular membrane. Mode (m, n) rings at `j_mn / j_01` times the fundamental, where
  j_mn are the zeros of J_m. Take the 14 lowest; skip any above 900 Hz.
- **Strike:** at radius 0.35, strength `|J_m(j_mn·0.35)|` (×2 for m > 0).
- **Decay and pitch:** τ = 1.4·r^−1.2; pitch sags by ×1.06 decaying with τ .08 s.
- **Skin and tuning:** add 20 ms of 200 Hz–2 kHz skin noise. Tune to the bar's root at C1–B1.
- **Its own hall:** an STFT-invented IR with T60 2.8 s below 200 Hz, .6 s at 1 kHz and .3 s at 4 kHz,
  dark above 900 Hz, decorrelated L/R seeds. The send is high-passed at 55 Hz so the sub stays dry.
- **Ducking:** the bass and subs duck −3 dB under each boom (`boom_duck`).
- **Pattern:** "boom, boom, boom" on beats 1-2-3 at phrase starts, otherwise beat 1, and triplets
  on fill bars.

## Shepard–Risset riser

Eight octave-spaced sine partials climbing `24·u^1.6` semitones (mod 96) under a fixed loudness
bell centred on MIDI 78 (σ 14 st), so it climbs and never arrives. Add a noise band whose centre
climbs 300 Hz → 9 kHz (log-Gaussian σ .8 oct in the STFT). The level rises −18 dB → 0 as `u^1.5`,
and a 20 ms raised-cosine cut takes it to **true zero** on the drop sample.

## Impact

- **Sub boom:** diving `32 + 43·e^(−t/.18)` Hz, τ .55.
- **Thwack:** 25 ms of 100 Hz–3 kHz noise.
- **Crash:** decorrelated L/R noise, 2.5–14 kHz, τ 1.1 s.
- **Room:** cut the reverb return at the drop: `.15 + .85·((t−t0)/.75)²` over 0.75 s, for a dry
  punch before the room comes back.

## Euclidean / golden ear candy

- **Rhythm:** E(k, 16) Euclidean rhythms with Fibonacci k (3, 5, 8, 5), rotated by 3 per bar.
- **Pitch:** the bar's chord tones in C5–B6, picked by a golden-ratio Weyl sequence.
- **Grain:** a 90 ms φ-ratio FM zip with β = 3·e^(−t/.015).
- **Placement:** panned by the golden angle (137.5°), about −14 dB, ducked 50 % under the melody.
- Start them a few bars after the drop (subtraction, after Eno): the first phrase belongs to the
  booms.

## Prime-loop bell garden (after Eno's tape loops)

Five soft bells on a pentatonic (C D E G A), each looping every 5, 7, 11, 13 or 17 eighth notes.
The loops are all prime, so they drift and never realign within the piece. Give them a bright hall
of their own. They work under a solo intro and as an outro bloom; striking all five together on a
cut and letting them drift apart is a strong ending.

## Invented reverb

Make the IR in the time-frequency plane: white noise through the STFT, where each frequency decays
at its own T60 (for example 1.6 s at 800 Hz down to .5 s at 10 kHz). Use a 4 ms fade-in, 20 ms
pre-delay, normalised energy, and different seeds for L and R. High-pass the send at 300 Hz.

## Native delay

Dotted eighth = `0.75·beat` samples, exact. Ping-pong ±0.8, each repeat low-passed further
(÷1.35 per repeat from 6.5 kHz). Feedback is automated per sample, and the delay ducks 35 % under
the figure.

## The build and the gap

- **Continuous (the author's choice):** the kick roll and snare ladder run into the drop, and so do the
  riser, a widening reverb wash (×1 → ×2.5) and a 5 dB tilt so the build never dips.
- **Vacuum:** filter the lows out of the drums for the last beat before the drop:
  `fft_eq(drums, [(120, −40), (300, 0)])` switched in over 80 ms at 29.42 s. The kick roll keeps
  clicking but the floor drains, so the slam lands +15 dB.
- **Alternatives** (kept as `GAP=` modes): a true-silent half-second, or a swell (an inhale of
  C-major partials plus a 400 Hz → 7 kHz noise band) cut to zero on the drop sample.
