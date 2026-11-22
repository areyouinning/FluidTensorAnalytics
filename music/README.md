# The music, as code

Every track on [fluidta.com/tour](https://fluidta.com/tour), and Cloud Compass (the remix under the
FluidTA reel), is made by a Python script in this folder. Nothing is recorded or sampled. Each
sound is written as amplitude and pitch coefficients on a grid the score already lives on, the
beat-semitone transform. One inverse transform turns the grid into audio. Then the mix is measured
before anything ships.

Like the rest of the site, this folder is public domain (CC0). Read it, check it, reuse it.

## What's here

| Path | What it does |
|---|---|
| `kit.py` | The instrument kit: piano, bells, FM, plucks, a sung voice with formants, the womp, drums, rooms, delays and pumps. Also `finish()`, which runs the checks and writes `report.json`. |
| `recipes.py` | The layer the studies are written in: progressions, drum grids with swing, pads, arps, basslines, melodies and the mixdown. |
| `<artist>.py` | One study per track. Each docstring says which method it borrows and what it assumes. |
| `clams_koresma.py` | Cloud Compass, a remix of the FluidTA theme (`theme/events.json`). |
| `bach/` | Bach's Prelude in C, BWV 846, from the Mutopia Project's public-domain MIDI, and three remixes. Every note of the Prelude plays in each one. |
| `build_tours.py`, `tour_text.py`, `videos_map.py` | Build `tours/<slug>.js`: the words, the timed stops and the page clips for each tour. |
| `synthaesthesia/` | The engine: the transform (`bst.py`), mastering (`master.py`), measurement (`listen.py`), reference transcription (`transcribe.py`) and a self-test. Notes on the method are in `SKILL.md` and `references/`. |
| `expected-renders.csv` | The length, loudness and WAV SHA-256 each script rendered to when it was published. |

## The studies are studies

Each track borrows a producer's method as it has been described: tempo, arrangement, sound-design
moves. It never uses a melody or a recording. No artist made, endorsed or reviewed these tracks.
Where the method is a guess, the script's docstring says so.

## Run one

You need Python 3.12 and the packages in `requirements.txt`. ffmpeg must be on PATH or in the conda
environment; it is used for the MP3s.

```
cd music
python -m pip install -r requirements.txt
python synthaesthesia/scripts/selftest.py
python clams_koresma.py
```

The self-test renders an 8-bar demo and checks the chain. A study writes `music/<slug>/`: a 24-bit
48 kHz WAV, a 320 kbps MP3, `beatgram.png` (the mix drawn in its own transform) and `report.json`.

## What gets checked

`finish()` measures every render and fails it if a check fails:

- integrated loudness of −14 LUFS (−17 for the Eno study);
- true peak at or below −1.6 dBTP;
- a census of stray clicks;
- how often and how hard the limiter works;
- mono fold-down;
- whether the file ends in digital zero.

Renders are deterministic, because every random choice has a fixed seed. On the versions in
`requirements.txt`, a script should reproduce its SHA-256 in `expected-renders.csv`. On other
versions, a library's floating-point rounding can change the last bits. When that happens, compare
the measurements in `report.json` instead.
