#!/usr/bin/env python3
"""Record the spoken prompts for Kiddo's Puzzle Box, in the same robot voice as Sound It Out.

Reuses the recorder in gen_phonics.py (same voice, model and ffmpeg effect; the key is injected by the
session proxy). Clips go to audio/puzzles/<name>.mp3.

    python3 scripts/gen_puzzle_voice.py            # make what is missing
    python3 scripts/gen_puzzle_voice.py --force    # re-record everything
"""
import os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_phonics import ROOT, tts

LINES = {
    "next": "What comes next?",
    "odd": "Which one is different?",
    "grid": "What goes in the gap?",
    "balance": "How many more to make it balance?",
    "yes": "Yes! You got it!",
    "again": "Not that one. Try again.",
    "star": "Five stars! Great thinking!",
}

def main(argv):
    force = "--force" in argv
    out_dir = os.path.join(ROOT, "audio", "puzzles")
    os.makedirs(out_dir, exist_ok=True)
    for name, text in LINES.items():
        out = os.path.join(out_dir, name + ".mp3")
        if not force and os.path.exists(out) and os.path.getsize(out) > 400:
            continue
        for attempt in range(3):
            try:
                print(f"  {name:8} {text!r} -> {tts(text, out)} bytes"); break
            except Exception as e:
                if attempt == 2:
                    print(f"  FAILED {name}: {e}", file=sys.stderr); return 1
                time.sleep(4)
        time.sleep(0.2)
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
