# Seeing the track: the soundscape page

Shipped as `tools/fluidta/soundscape.*` ("What does a drop look like?"). This page reuses the
3dviz-pro-max skill for the 3D craft. What is specific to audio:

- **Export the transform, not a waveform.** `soundtrack/native/export_viz.py` writes
  `soundscape-data.js` from the final WAV:
  - the BST magnitude, downsampled (a 264 kB JS file for 60 s);
  - the melody pitch line;
  - boom times with the drum's mode table;
  - bell strike times;
  - the cuts.
  It also copies the MP3 next to the page. Re-run it whenever the track changes, or the page shows
  the old music.
- **The audio clock is the only state.** Everything is read from `audio.currentTime` every frame.
  Scrubbing, `?t=` deep links and pausing then work for free, and nothing drifts.
- **The landscape:**
  - x is time in beats; z is semitones; height is magnitude with a gamma (2) and a cap (8 units);
  - light smoothing, otherwise it renders as needles;
  - XS = 1.5 units per second.
- **Parts become objects:**
  - the melody is a ribbon;
  - each boom is a membrane ringing in its own 14 Bessel modes, slowed 25× so the eye can follow;
  - the bells are prime-loop lights.
- **The camera cuts on the video's cuts,** so the page and the video tell the same story.
- **Inspect real frames** before calling it done. The shipped page went through needle terrain, a
  side-on shot, a drop camera too close (specular glare), and a garden shot too far out.
- On FluidTA, register the page in `catalog.js` and add a drawing in `thumbs.js`.
