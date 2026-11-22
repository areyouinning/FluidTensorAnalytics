# Verification

Two layers. **Hard checks** come from the brief and pass or fail. **Listening metrics** answer
feedback and get reported as numbers, compared before and after.

## Hard checks (print [OK]/[FAIL], exit non-zero on failure)

| Check | How |
|---|---|
| Format | channels, rate, subtype (`sf.info`) |
| Length | equal to the brief **in samples**, not seconds |
| Event timing | the drop kick stem: 10 ms after the drop vs 10 ms before (> 1.5×), half-peak within 5 ms |
| Silence/swell modes | a gap that should be silent is exactly 0; a swell's last sample before the drop is 0 |
| Drop onset | the first sample above −50 dBFS after the drop is within 2 ms |
| Fade | the last 0.5 s before the fade end has RMS < −60 dBFS, and everything after is digital zero |
| Loudness | integrated LUFS within ±0.2 of target (ffmpeg `ebur128`) |
| True peak | ≤ spec (ffmpeg `ebur128=peak=true`) |
| Mono fold-down | report the LUFS change (a drum hall in the side channel costs ~0.7 dB, which is fine) |
| Clicks | stray-click census ≤ 3 |

## The click census (`listen.py census`)

A stray click is a > 6 dB rise in more than 60 % of the BST bins above 1 kHz (MIDI ≥ 84) within one
hop, relative to the mean of hops 2–6 earlier, among bins within 70 dB of the max:
- Exclude hops within −2..+5 of noise bursts (snares, swells): slow bins keep registering about 20 ms.
- Exclude ±2 hops of every scored onset you pass in. These are notes, bass notes, grains, booms,
  bells and womp openings, which are composed events.
- What remains is a click: an envelope step, a recorder dropout, a phase reset or saturation sizzle.
- **Register every composed onset where it is written.** Every helper that writes notes (one-shots,
  sustained lines, sung lines, womps) should append its onsets to the track's list as it writes them.
  Otherwise a plucky 16th bass reads as 10 "clicks" one hop after each note (Hopkins study,
  2026-11-21).
- **Exclusions are in milliseconds, not hops** (fixed 2026-11-21). The analysis atoms near 1 kHz are
  about 16 ms wide, so a snare registers up to about 10 ms early. On a fine grid (96 BPM with
  div 240: 2.6 ms hops), "2 hops before" missed it, and Eliot Lipp's snares read as 6 clicks.
  `listen.census` now excludes 10.5 ms before every composed event, 10.5 ms after a note and 26 ms
  after a noise burst.
- The census can flag one rise in the last few hops of a file that ends in digital silence. That is
  an analysis edge effect; check that the audio there is zero.

Run it on the old version too, so the report can say "0, against 196 in v5".

## Listening metrics

| Feedback it answers | Metric | Shipped value |
|---|---|---|
| "punch harder" | chest punch: 50–250 Hz peak in 30 ms after each drop kick vs RMS 150–350 ms after (median) | +6.5 dB |
| "punch harder" | attack: the same at 2–6 kHz; crest of the drop | — |
| "the drop should hit" | slam: RMS < 250 Hz in drop..+0.5 s minus drop−0.4..drop−0.05 | +15.3 dB |
| "quiet before the build" | energy curve: RMS > 100 Hz in 0.5 s steps through the build; no step may dip | −21 → −12 dB |
| "melody muted" | fun-track level per section vs its lilt level | ±1 dB |
| "bass should dominate" | bass family vs fun track: > 40 Hz and > 250 Hz | +6.6 / −3.9 dB |
| "figure and ground" | melody vs backing energy within ±1 st of the melody fundamental (median, 10th pct) | +37 / +15 dB |
| "sound like the reference" | band balance (sub, bass, low-mid, mid, high, relative to the whole) in matched windows | within 2 dB |
| "is the limiter crushing it" | share of the drop with > 1 dB GR, max GR | 17.7 %, 3.5 dB |

Measure parts against each other **with stems**, not from the mix. A ducked part measured in the mix
reads as weak by construction.

## The beatgram

`listen.py beatgram mix.wav --cuts 8,14,22,30` draws the BST of the mix (magma, 75 dB range) with
the cuts as lines. Look at it after every pass: clicks show as vertical hairlines, mud as a bright
band at 200–500 Hz, and a muted melody as a fading top line.
