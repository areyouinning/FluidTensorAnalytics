#!/usr/bin/env python3
"""Generate the phonics voice clips for Sound It Out, with ElevenLabs — in a fun-robot voice.

We record one clip per grapheme (the building blocks) and the game stitches those into whole words,
so any word in the family works with no per-word recording. The voice is a clear base (Bella) with a
light "crunch" robot effect applied by ffmpeg, which suits stitched phonemes: a robot is meant to
sound a little segmented.

  audio/phonics/sounds/<letter>.mp3   one sound per grapheme, for sounding out (c... a... t)
  audio/phonics/words/<word>.mp3      each whole word, recorded, for the smooth blended "cat!"
  audio/phonics/words/_<name>.mp3     a few spoken rewards
  audio/phonics/manifest.json         the word list (for the game's trie), voice, model, effect

Words are recorded whole (not stitched from the sounds) so the blend is smooth; the sounds are
still used for the segmented "sound it out" step and for per-letter feedback.

The ElevenLabs key is injected by the session proxy into the xi-api-key header, so this script
sends a placeholder value. Override the voice/model/effect with the env vars below. ffmpeg is required.

    python3 scripts/gen_phonics.py            # make everything that's missing
    python3 scripts/gen_phonics.py --force     # re-record everything
    python3 scripts/gen_phonics.py a b c       # just these items
"""
import json, os, subprocess, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICE = os.environ.get("ELEVEN_VOICE", "EXAVITQu4vr4xnSDxMaL")   # Bella — bright and clear
MODEL = os.environ.get("ELEVEN_MODEL", "eleven_turbo_v2_5")
FMT = "mp3_44100_128"
# the fun-robot effect (ffmpeg): a bit-crush for the robot timbre, a flanger for shimmer, a treble lift
# for clarity — then leading/trailing silence trimmed tight so stitched phonemes blend. Override to taste.
ROBOT = os.environ.get("PHONICS_FX",
    "acrusher=level_in=1:level_out=1:bits=7:mode=log:aa=1,flanger=delay=3:depth=2:regen=4:speed=0.5,treble=g=3,"
    "silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.02,areverse,"
    "silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.05,areverse")

# The short-a word family: real CVC words, no digraphs or r-controlled vowels. Used for the game's trie;
# the audio is just the per-letter sounds, stitched into these words in the browser.
WORDS = ("cat can cap cab cam bat ban bad bag dad dab dam fan fat fad gag gap gas had ham hat has "
         "jab jam jag lad lap lab lag mad man map mat nap nab nag pad pan pat pal rag ram ran rap rat "
         "sad sag sap sat tab tad tag tan tap van vat wag yam yap zap zag").split()

# One stable sound per grapheme in this family. Stops carry a light schwa, as sounding-out is taught.
SOUND_CUE = {
    "a": "aah",
    "b": "buh", "c": "kuh", "d": "duh", "g": "guh", "j": "juh", "p": "puh", "t": "tuh",
    "f": "fff", "h": "hh", "l": "lll", "m": "mmm", "n": "nnn", "r": "rrr", "s": "sss",
    "v": "vvv", "w": "wuh", "y": "yuh", "z": "zzz",
}
PHRASES = {"nice": "Nice!", "win": "You made a word!", "try": "Keep going.", "top": "You made it to the top!"}

def letters_used():
    s = set("a")
    for w in WORDS:
        for ch in w:
            s.add(ch)
    return sorted(s)

def robotize(src, out):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-af", ROBOT,
                    "-codec:a", "libmp3lame", "-b:a", "96k", out], check=True)

def tts(text, out):
    raw = out + ".raw.mp3"
    body = json.dumps({"text": text, "model_id": MODEL,
                       "voice_settings": {"stability": 0.4, "similarity_boost": 0.8, "style": 0.3, "use_speaker_boost": True}})
    code = subprocess.run(["curl", "-sS", "-m", "90", "-X", "POST",
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format={FMT}",
        "-H", "xi-api-key: proxy-injected", "-H", "content-type: application/json",
        "-d", body, "-o", raw, "-w", "%{http_code}"], capture_output=True, text=True).stdout.strip()
    if code != "200" or not os.path.exists(raw) or os.path.getsize(raw) < 400:
        head = open(raw, "rb").read(200) if os.path.exists(raw) else b""
        if os.path.exists(raw): os.remove(raw)
        raise RuntimeError(f"HTTP {code} for {text!r}: {head[:160]!r}")
    robotize(raw, out)
    os.remove(raw)
    return os.path.getsize(out)

def main(argv):
    force = "--force" in argv
    only = set(a for a in argv if not a.startswith("-"))
    jobs = []
    for lt in letters_used():
        jobs.append(("sound", lt, SOUND_CUE[lt], os.path.join(ROOT, "audio/phonics/sounds", lt + ".mp3")))
    for w in WORDS:
        jobs.append(("word", w, w, os.path.join(ROOT, "audio/phonics/words", w + ".mp3")))
    for name, txt in PHRASES.items():
        jobs.append(("phrase", name, txt, os.path.join(ROOT, "audio/phonics/words", "_" + name + ".mp3")))

    made = skipped = 0
    for kind, name, text, out in jobs:
        if only and name not in only:
            continue
        if not force and os.path.exists(out) and os.path.getsize(out) > 400:
            skipped += 1
            continue
        for attempt in range(3):
            try:
                n = tts(text, out)
                print(f"  {kind:6} {name:5} {text!r:>8} -> {n} bytes")
                made += 1
                break
            except Exception as e:
                if attempt == 2:
                    print(f"  FAILED {name}: {e}", file=sys.stderr); return 1
                time.sleep(5)
        time.sleep(0.2)
    manifest = {"voice": VOICE, "model": MODEL, "effect": "bella-crunch-robot",
                "words": WORDS, "letters": letters_used(), "phrases": list(PHRASES)}
    json.dump(manifest, open(os.path.join(ROOT, "audio/phonics/manifest.json"), "w"), indent=0)
    print(f"made {made}, skipped {skipped}. manifest: audio/phonics/manifest.json")
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
