# Transcribing a reference into a style sheet

`scripts/transcribe.py` turns a reference track into the **vocabulary** of a style: tempo and
feel, the drum grid, swing, harmony, bass habits, melodic tendencies, tone, space and arc. It
deliberately keeps **no melody sequence**: you learn how a producer writes, then write something new.

```powershell
python transcribe.py ref.mp3 --from 30 --to 120 --out music\_references --name artist-track
```

Add `--bpm-range 55 100` for slow hip-hop (Clams Casino, cloud rap), or anything else that would
otherwise be read at double time.

## How it reads

| Field | Method |
|---|---|
| Tempo | A periodicity scan: the Fourier strength of the onset envelope at the beat rate, plus half weight at 2× and quarter weight at 4×, refined to 0.005 BPM. The octave comes from `bpm_range`. |
| Beat phase | Sweep 192 offsets and keep the one where the **kick band** (35–120 Hz) lines up. Dense 16ths elsewhere pull a broadband phase off the beat. |
| Downbeat | A strong kick, no snare on it, and snare on 2 and 4 (or on 3), scored 1 : 0.5. |
| Drum grid | Mean onset strength per 16th step, per band (kick, snare = 1.5–5 kHz + 150–300 Hz, hats 7–11 kHz), relative to that band's strongest step. |
| Swing | Where the hat peaks fall within each 8th and each 16th (50 = straight, 58.3 = 7/12, 66.7 = triplet). |
| Bass | Harmonic salience: CQT energy at f, 2f, 3f, 4f, 5f, read in the back 45 % of each beat (after the kick). Subtract 0.8× the per-pitch median across beats, because a repeated kick is identical every beat. |
| Chords | Chroma from C3 up (below that the bass and kick tails pollute it), matched against 12 roots × 7 qualities. The bar's bass note adds +0.12 to the matching root. |
| Key | The Krumhansl top 4 plus their parallel modes, re-ranked by: correlation + 0.5 × (fraction of chord roots in the scale) + 0.5 × (fraction of bars on the tonic root). |
| Melody | pYIN on the harmonic part. Only statistics are kept: range, scale degrees, steps/leaps, density. |
| Sound | Band balance; centroid; the 99.5 % energy ceiling (a lo-fi tell); side/mid; crest; LUFS, LRA and true peak (ffmpeg); snare tail at 300 ms. |
| Arc | RMS per bar, and agglomerative segmentation on chroma + MFCC per bar. |

## Validation (2026-11-21, on our own studies, whose answers are known)

| Track | Tempo | Feel | Key | Chord roots |
|---|---|---|---|---|
| Breathing Machine (125, Ab major) | 125.00 | backbeat ✓ | exact | 100 % |
| Golden Wobble (150 half-time, G minor) | 150.05 | half-time ✓ | exact | 100 % |
| Low Light Prayer (120, D minor) | 119.99 | backbeat ✓ | relative (F major) | 91 % |
| Cloud Hymn (75, Bb minor, swing 7/12) | 75.00 with `--bpm-range 55 100` | backbeat ✓, 8th swing 58.2 % | relative (Db major) | weak: the hook dominates the chroma |

Rerun `music/validate_transcriber.py` after any change to the transcriber.

## Traps found while building it (each produced a confident wrong answer)

- **Beat trackers pick the half tempo** when beats are strong and subdivisions busy (Hopkins read
  62.9). The comb scan fixed it.
- **A kick's sine tail reads as the bass note** (the Hopkins kick sat at F1, LUKE's near G1).
  Distorted kicks have overtones, so even harmonic salience fails. Read the back of the beat and
  subtract the beat-to-beat constant.
- **A saturated bass's 5th harmonic is a major third.** Chord quality under heavy bass is
  unreliable, so mode is decided by roots and scale fit, never by chord quality.
- **Extended chords hide their roots:** Abmaj9 contains a whole Cm7, and Bbm9 contains Dbmaj7. The
  bass vote is what separates them.
- **Relative major and minor share a scale.** When the arrangement doesn't make the tonic obvious,
  the sheet says so and gives the runner-up.
- **Hip-hop swings 8ths, not 16ths.** Report both.
- On real music the static grid assumes programmed timing; live playing drifts.
