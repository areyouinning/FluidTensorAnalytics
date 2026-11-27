#!/usr/bin/env python3
"""Mailbox check: letters and visit photos sent to the Kindred Stranger Mailbox.

   python3 scripts/check_mailbox.py FILE...   # the files a pull request adds or changes
Fails when a letter has no front matter, is too long, or carries a phone number, email or
street address, and when a photo is too big or still records where it was taken (EXIF GPS)."""
import re, sys
from pathlib import Path

MAX_LETTER, MAX_PHOTO = 4000, 8 * 1024 * 1024
PRIVATE = re.compile(r"\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b|[\w.+-]+@[\w-]+\.\w|\b\d{2,5}\s+\w+\s+(road|rd|street|st|lane|ln|drive|dr|ave|avenue|hwy|highway)\b", re.I)
IMAGE = {".jpg", ".jpeg", ".png", ".webp"}

def letter(p):
    t = p.read_text(encoding="utf-8", errors="replace")
    if not re.match(r"^---\r?\n[\s\S]*?\r?\n---", t): return "no front matter (--- name: ... ---)"
    if len(t) > MAX_LETTER: return f"{len(t)} characters, more than {MAX_LETTER}"
    if PRIVATE.search(t): return "looks like it has a phone number, email or street address"

def photo(p):
    if p.stat().st_size > MAX_PHOTO: return f"{p.stat().st_size // 1024} KB, more than {MAX_PHOTO // 1024 // 1024} MB"
    from PIL import Image
    try:
        with Image.open(p) as im:
            gps = im.getexif().get_ifd(0x8825)
    except Exception as e: return f"could not be read as an image ({e})"
    if gps: return "still records where it was taken (GPS in EXIF). Turn off location, or strip it, and send it again"

def main(files):
    bad = 0
    for f in files:
        p = Path(f)
        if not p.is_file() or not str(p).startswith("mailbox/"): continue
        why = None
        if p.parent.name == "letters" and p.suffix == ".md": why = letter(p)
        elif p.parent.name == "notes" and p.suffix.lower() in IMAGE: why = photo(p)
        elif p.name == "README.md" and str(p.parent) in ("mailbox", "mailbox/notes", "mailbox/letters"): pass  # the mailbox's own notes
        else: why = "is not a letter (mailbox/letters/*.md) or a photo (mailbox/notes/*.jpg, .png, .webp)"
        print(("FAIL " if why else "ok   ") + f + (": " + why if why else ""))
        bad += bool(why)
    sys.exit(1 if bad else 0)

if __name__ == "__main__": main(sys.argv[1:])
