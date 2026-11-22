# Mixing and mastering as arrays

The order that worked, and why each stage sits where it does.

1. **Stems → buses.** Group by role: figure (melody), fun track (arp, delay, reverb, melody), drums,
   bass family (body, sub, growl, reese, rasp), booms, candy, riser/impact, garden.
2. **Set levels by role,** relative to a named reference: for example "bass body vs synths, RMS
   above 40 Hz, over 30–44 s = +14 dB". Use `rms_db(x, a, b, hp)` on stems. Levels stated as
   relationships survive re-arrangement; absolute gains do not.
3. **Bass bus dirt:** tanh at 4× oversampling, level-matched to the input RMS, low-passed at about
   2.2 kHz. Then a mid shelf (−3 dB from 400 Hz to 1.2 kHz and up) to hand the mids to the fun track.
4. **Ducks and breath:**
   - `boom_duck` puts the bass under each boom.
   - The breath (after Jon Hopkins): in the drop, everything except the kick, booms, subs and the
     figure dips 3.5 dB on each kick and recovers over an eighth note.
   - This is sidechain pumping written as a gain curve, so it is exact and does not depend on the
     signal.
5. **Section emphasis:** drop drums +4 dB inside the drop window, with 5 ms ramps.
6. **Fader:** the fade window and any mutes. Everything added later must be multiplied by it too.
7. **Arc ride:** measure each section's LUFS (`section_lufs`) and ride a smooth gain so the sections
   sit at their targets relative to the drop. The author's arc climbs: intro −11, tune −8, lilt −6,
   build −4, drop 0, then −0.5 and −1.5 LU. Ramps between sections are 50–100 ms raised cosines.
8. **Re-pin the figure and the fun track** after the ride, using `comp = max(0, ride_target - ride)`
   multiplied by the fader. The fun track then never steps back; it gets "overwhelmed" by what is
   added, never muted.
9. **Reference EQ (optional):** compare the band balance of the drop window against a reference with
   `listen.py bands`. Then apply zero-phase `fft_eq` curves inside the window only, switched in with a
   5 ms ramp. The shipped match:
   - a low-mid scoop `[(180,0),(300,−5),(800,−5),(1300,0)]` on everything except the fun track;
   - air `[(3000,0),(6000,7),(16000,7),(20000,3)]` on everything.
10. **Mono low end:** `fft_eq` the side channel with `[(100,−60),(180,0)]` (`mono_below`).
11. **Master:** `tp_limit` at a ceiling 0.6 dB under the TP spec (−1.6 for a −1.0 spec, which leaves
    room for the MP3 encode), inside a gain loop onto the target LUFS (`master_to`). Report how much
    of the loudest section the limiter is working (> 1 dB GR) and its maximum. A healthy figure is
    under 20 % of the drop and under 4 dB at most. More than that means the mix is too dense at
    the limiter, so fix levels, not the ceiling.
12. **Export:** 24-bit WAV at the render rate, then a 320 kbps MP3 via ffmpeg. Fingerprint both with
    SHA-256 (`Get-FileHash`).

## Dominance without meekness

When the author asks for a part to "dominate", measure it as a ratio against the fun track in two
bands. In the shipped drop, the bass family is +6.6 dB over the fun track above 40 Hz, while the fun
track still leads by 3.9 dB above 250 Hz. Both numbers matter: the first is "the bass dominates",
the second is "the melody is still there".

## Vacuum and slam

The drop's impact is a *difference*, so build both sides of it. Drain everything below 250 Hz for the
last beat (vacuum about −28 dBFS), then hit it (+15 dB below 250 Hz in the first half-second). The
reference the author loved does +15.9 dB. Measure with `listen.py punch --drop 30`.
