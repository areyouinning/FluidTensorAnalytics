#!/usr/bin/env python3
"""Generate the phonics voice clips for Sound It Out, with ElevenLabs.

Writes two sets of mp3s, which the game plays and stitches in the browser:
  audio/phonics/sounds/<letter>.mp3   one sound per grapheme (the /k/ of c, the short /a/, ...)
  audio/phonics/words/<word>.mp3      each whole word, for the blended "say it fast" reward

The ElevenLabs key is injected by the session proxy into the xi-api-key header, so this script
sends a placeholder value; set ELEVEN_VOICE / ELEVEN_MODEL to change the voice or model.
Re-run it any time to re-record: it only rewrites the clips it is asked to make.

    python3 scripts/gen_phonics.py            # make everything that's missing
    python3 scripts/gen_phonics.py --force     # re-record everything
    python3 scripts/gen_phonics.py cat a b      # just these items
"""
import json, os, subprocess, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICE = os.environ.get("ELEVEN_VOICE", "21m00Tcm4TlvDq8ikWAM")   # Rachel — clear; override with a kid-friendly voice if you prefer
MODEL = os.environ.get("ELEVEN_MODEL", "eleven_turbo_v2_5")
FMT = "mp3_44100_64"

# The short-a word family: every one a real CVC word a young reader meets, no digraphs or r-controlled vowels.
WORDS = ("cat can cap cab cam bat ban bad bag dad dab dam fan fat fad gag gap gas had ham hat has "
         "jab jam jag lad lap lab lag mad man map mat nap nab nag pad pan pat pal rag ram ran rap rat "
         "sad sag sap sat tab tad tag tan tap van vat wag yam yap zap zag").split()

# One stable sound per grapheme in this family. Stops carry a light schwa, as sounding-out is taught;
# continuants are held. The short a is cued toward the /a/ in "cat". Tune these cues and re-run to taste.
SOUND_CUE = {
    "a": "aah",                                   # short a, as in cat
    "b": "buh", "c": "kuh", "d": "duh", "g": "guh", "j": "juh", "p": "puh", "t": "tuh",   # stops (slight schwa)
    "f": "fff", "h": "hh", "l": "lll", "m": "mmm", "n": "nnn", "r": "rrr", "s": "sss",
    "v": "vvv", "w": "wuh", "y": "yuh", "z": "zzz",
}
# short, friendly spoken rewards
PHRASES = {"nice": "Nice!", "win": "You made a word!", "try": "Keep going."}

def letters_used():
    s = set("a")
    for w in WORDS:
        for ch in w:
            s.add(ch)
    return sorted(s)

def tts(text, out):
    tmp = out + ".part"
    body = json.dumps({"text": text, "model_id": MODEL,
                       "voice_settings": {"stability": 0.55, "similarity_boost": 0.8, "style": 0.0, "use_speaker_boost": True}})
    code = subprocess.run(["curl", "-sS", "-m", "90", "-X", "POST",
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format={FMT}",
        "-H", "xi-api-key: proxy-injected", "-H", "content-type: application/json",
        "-d", body, "-o", tmp, "-w", "%{http_code}"], capture_output=True, text=True).stdout.strip()
    if code != "200" or not os.path.exists(tmp) or os.path.getsize(tmp) < 400:
        head = open(tmp, "rb").read(200) if os.path.exists(tmp) else b""
        if os.path.exists(tmp): os.remove(tmp)
        raise RuntimeError(f"HTTP {code} for {text!r}: {head[:160]!r}")
    os.replace(tmp, out)
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
    manifest = {"voice": VOICE, "model": MODEL, "words": WORDS, "letters": letters_used(), "phrases": list(PHRASES)}
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
    json.dump(manifest, open(os.path.join(ROOT, "audio/phonics/manifest.json"), "w"), indent=0)
    print(f"made {made}, skipped {skipped}. manifest: audio/phonics/manifest.json")
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
