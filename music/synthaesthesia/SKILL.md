---
name: synthaesthesia
description: Make, remix, mix and master music entirely in Python with no DAW, by writing every sound as coefficients on a time-frequency grid native to the score (the beat-semitone transform), then verify it by measurement and turn it into a 3D listening page. Use whenever the author wants to compose, render, fix, punch up, master or "make it hit harder" a track; turn a score, MIDI or event list into audio; build a drop, riser, wobble or womp bass, sub, drum or texture; match a mix to a reference track; diagnose clicks, static, mud or a "meek" bass; or visualize a track as a landscape linked to a video. Also for soundtracks for FluidTA videos. Not for recording live audio or editing someone else's song by sampling it.
---

# Synthaesthesia

Hear it as a picture; build it as a picture. Every sound is written as amplitude and pitch
coefficients on a grid the music already lives on, then turned into audio by one inverse transform.
Nothing is recorded, so nothing drops out. No envelope or filter can step, so nothing clicks.
Because the picture is the score, you can measure what you made in the same frame you wrote it.

**Instruments and recipes:** `music/kit.py` holds the instrument kit (piano, bells, FM, plucks,
a sung voice with formants that also does talkbox and flute, the womp, drums, rooms, delays and
pumps). `music/recipes.py` turns a style study into a page of musical decisions: progression,
drum grids with swing and jitter, pads, stabs, arps, basslines, melodies, stutters, mixdown.
Copy a study in `music/` as a starting point.

The reference build is the FluidTA greatest-hits soundtrack in `soundtrack/native/` (60 s, 120 BPM,
drop at 30 s). Read it when a recipe here is too terse. `MIX_NOTES.md` beside it is a model hand-back.

## The kit

Python in miniforge, with numpy, scipy, soundfile, librosa, mido, pretty_midi, pedalboard,
sounddevice and matplotlib. ffmpeg comes from the conda environment (`Library/bin`) or PATH;
`scripts/master.py` finds it. Use the PowerShell tool. Set `PYTHONIOENCODING=utf-8`
before running anything that prints.

| Script | What it does |
|---|---|
| `scripts/bst.py` | The transform. `Grid(sr, bpm, dur, div)` holds the hop arithmetic. Synthesis is `synth_voice` (harmonic partials) and `synth_ratios` (any ratios, including FM sidebands); analysis is `analyze` (constant-Q Gabor bank). Also `rc_interp`, `env_hops`, `pitch_hops` and `hz`. |
| `scripts/master.py` | `fft_eq`, `shelf`, `dirt` (tanh at 4x oversampling), `mono_below`, `tp_limit` (a true-peak limiter with **no makeup gain**), `loudness` / `section_lufs` (ffmpeg EBU R128) and `master_to` (a gain loop onto target LUFS under a TP ceiling). |
| `scripts/listen.py` | Measurement as listening. Commands: `census` (stray clicks), `punch` (chest, attack, slam, vacuum), `energy` (level curve), `bands` (balance vs a reference) and `beatgram` (a picture of the mix in its own transform). |
| `scripts/transcribe.py` | A reference track → a style sheet (tempo, feel, swing, drum grid, chords, key, bass, melodic vocabulary, tone, arc). It keeps no melody, so nothing copyable leaves it. Validated on known tracks: see [references/transcription.md](references/transcription.md). |
| `scripts/selftest.py` | Renders an 8-bar demo through the whole chain and checks it. Run it first in a new environment. |

## Workflow

1. **Find the grid.** Fix the sample rate, tempo and the finest subdivision the score uses (8ths,
   16ths, triplets, quintuplets...). Choose `div` so one hop = `sr*60/bpm/div` samples is an integer
   and every event lands on a hop. At 48 kHz and 120 BPM, `div=96` gives 250 samples. Assert every
   event is on the grid; an off-grid event is a bug in the score, not something to round.
1b. **Working in someone's style? Transcribe first.** Run `transcribe.py` on two or three of
   their tracks and write from the style sheets: tempo octave, swing, drum grid, harmonic loop
   length, bass habits, the lo-fi ceiling, how wet the snare is. Make a study from general
   knowledge only when no audio is available, and say so in the notes.
2. **Read the brief as constraints.** Write down the hard numbers before touching sound: length,
   tempo, drop time, video cuts, fade end, target LUFS, true-peak ceiling. They become checks in step 7.
3. **Name the figure and the ground.** The figure is the thing the listener follows (usually the
   melody); the ground is everything that makes room for it. Every later mix decision answers to
   this. When the author says "figure and ground", that means exactly this.
4. **Write voices as coefficients.** Each voice is a pitch per hop plus an amplitude per partial per
   hop. Filters are weights on partials, and sidechains and carving are weights too. See
   [references/transform.md](references/transform.md) for why this is clean by construction and
   [references/sound-design.md](references/sound-design.md) for the instrument cookbook (kick,
   snare, womp bass, φ-FM growl, reese, Bessel drum, Shepard riser, Euclidean grains, prime-loop
   bells, invented reverbs).
5. **Render stems, then mix them as arrays.** Keep every stem separate until the mix. Save them to
   temp as `.npy` so the checks can read them. Mix moves are in
   [references/mixing.md](references/mixing.md): carving by register, the section arc, pinning the
   figure, the breath, vacuum and slam, reference EQ, mono low end, and the limiter.
6. **Master to the target** with `master_to`, never with pedalboard's `Limiter` (it adds makeup gain
   equal to minus the threshold).
7. **Verify by measurement, then listen by measurement.** First run the brief's hard checks: length
   to the sample, drop onset, fade to true zero, LUFS, TP and mono fold-down. Then run the listening
   metrics that answer the last piece of feedback. See [references/verification.md](references/verification.md).
   Report numbers, not adjectives.
8. **Translate feedback into moves.** The author's words map to specific, testable changes; see
   [references/feedback-glossary.md](references/feedback-glossary.md). Add a metric for every new
   complaint, so the fix is proven and the old fixes stay fixed.
9. **Hand back.** Update a `MIX_NOTES.md` that says what changed, what the video or website side
   must know (timing, file fingerprint), and a checked table. Give the deliverable a SHA-256
   fingerprint so everyone knows which file is current.
10. **Make it visible (optional).** A track can become a 3D landscape of its own transform, using
    the audio clock as the only state. See [references/visualize.md](references/visualize.md).

## Rules, and why

- **Stems are the grid; the grid is the truth.** If a rendered or recorded file disagrees with
  the score's timing, measure the offset (v5 was 3.3–3.6 ms late) and fix the file, not the score.
- **Every change takes at least one hop.** Attacks are a raised cosine over at least one hop, and no
  coefficient jumps between hops. An instant attack is a click, and a census will find it.
- **Carve by register, never by level,** when two parts collide. Level carving makes the loser
  sound "meek" or "muted". Notch the partials of the part that should yield, near the other part's
  partials, scaled by the other part's level.
- **Mono below about 150 Hz.** Detuned or stereo layers start above the second partial. Then filter
  the side channel below 150 Hz.
- **Fixed seeds everywhere.** Use `np.random.default_rng(seed)`, so a re-render changes only what
  you changed and A/B comparisons are honest.
- **References are analysed, never sampled.** A reference track the author supplies is measured for
  band balance, slam and technique. None of its audio goes into the output, and the notes say so.
- **Math earns its place by being heard.** φ, Bessel zeros, Euclid, primes and Weyl sequences are
  welcome (the author likes literal math framed as such). Each must do something audible: decorrelate,
  never repeat, sit inharmonically, or tune a membrane.
- **Name honestly.** If a part used to be "played on the rack" and now is not, say so in the
  hand-back so the video doesn't claim it.

## Traps already paid for

- The Web Audio recorder (hydrograph rack) **drops whole 128-sample render quanta**: zeroed blocks
  in the same place in every stem. Those were the clicks, not the drums. Fixing the recorder beats
  repairing after the fact.
- A **section-loudness ride drags the figure down with the section.** Re-pin the figure (and the
  fun track) after the ride: `comp = max(0, ride_target_for_figure - ride)`.
- **Anything added after the fader escapes the fade.** Multiply late additions by the fader too.
  Tighten the fade check to the RMS of the last half-second, not only digital zero.
- **Rests in a pitch curve are NaN.** Forward-fill pitch through rests and release amplitude over
  two hops; a NaN silently breaks sorts and synthesis.
- **tanh saturation sizzles above 5 kHz.** Low-pass the dirt (the reference build uses 2.2 kHz).
- A click census fires on composed events. Exclude scored onsets, womp openings and noise bursts
  (snares register in the slow 1 kHz bins for about 20 ms), and report what remains.
- `librosa.lpc` returns NaN on very pure high tones.
- A metric can lie by construction: a boom measured after kick-ducking looked weak. Measure a
  part against the rest using stems, not the mix.
