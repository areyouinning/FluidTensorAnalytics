"""Build the FluidTA tours: tours/<slug>.mp3 + <slug>.js, and tours/index.js.

Each <slug>.js holds the stops (timed to the study's real section starts), the words from
tour_text.py, the checks, and the track's beat-semitone transform reduced to one row per
semitone (C1-B6) and ~10 columns per second, as dB above a -66 dB floor in bytes (base64).
"""
import base64, json, os, re, subprocess, sys
import numpy as np, soundfile as sf
from scipy import signal
from kit import SK, MUSIC
sys.path.insert(0, SK)
from bst import Grid
from master import ffmpeg
from tour_text import TOURS
from videos_map import videos_for

OUT = os.path.join(os.path.dirname(MUSIC), 'tours')
os.makedirs(OUT, exist_ok=True)
GROUPS = {'eno-slow-morning': 'soundtrack', 'hopkins-breathing-machine': 'soundtrack', 'splatinum-golden-wobble': 'soundtrack',
          'luke-low-light-prayer': 'soundtrack', 'clams-cloud-hymn': 'soundtrack',
          'bach-splatinum': 'bach', 'bach-hopkins': 'bach', 'bach-eno': 'bach', 'odyssey-in-seven': 'odyssey'}
ROMAN = re.compile(r'^([IVX]+)\. (.+) \(after (.+)\)$')
ORDER = list(TOURS)


def gram(wav, seconds):
    y, sr = sf.read(wav)
    m = y.mean(axis=1)
    g = Grid(sr, 120, len(m) / sr, 96)                 # analysis frame only: 1/96 beat at 120 = 5.2 ms
    p, C = g.analyze(m[:g.N], pmin=24, pmax=95.67, step=1 / 3)
    C = C.reshape(72, 3, -1).max(axis=1)                # one row per semitone
    cols = int(round(seconds * 10))
    k = C.shape[1] // cols
    C = C[:, :k * cols].reshape(72, cols, k).max(axis=2)
    d = 20 * np.log10(C + 1e-9)
    d = np.clip((d - (d.max() - 66)) / 66, 0, 1)
    return cols, base64.b64encode((d * 255).astype(np.uint8).tobytes()).decode()


def main(only=None):
    index = []
    for slug in ORDER:
        rep = json.load(open(os.path.join(MUSIC, slug, 'report.json')))
        t = TOURS[slug]
        secs = rep['sections']
        assert len(secs) == len(t['stops']), f'{slug}: {len(secs)} sections, {len(t["stops"])} stops'
        title = re.sub(r'\s*\(after .*\)$', '', rep['title'])
        key = t['key'] if 'key' in t else rep['notes'].split(',')[1].split(';')[0].strip() if ',' in rep['notes'] else ''
        entry = dict(slug=slug, title=title, artist=t['artist'], bpm=rep['bpm'], key=key, seconds=rep['seconds'],
                     group=GROUPS.get(slug, 'influences'))
        index.append(entry)
        if only and slug not in only:
            continue
        mp3 = os.path.join(OUT, slug + '.mp3')
        subprocess.run([ffmpeg(), '-y', '-hide_banner', '-loglevel', 'error', '-i', os.path.join(MUSIC, slug, slug + '.wav'),
                        '-b:a', '128k', mp3], check=True)
        cols, data = gram(os.path.join(MUSIC, slug, slug + '.wav'), rep['seconds'])
        doc = dict(entry, how=t['how'], trick=t['trick'],
                   stops=[dict(t=round(s[0], 3), label=s[1], text=x) for s, x in zip(secs, t['stops'])],
                   checks=dict(lufs=rep['lufs'], tp=rep['tp'], clicks=rep['clicks'], sha=rep['sha256'][:16]),
                   gram=dict(rows=72, cols=cols, lo='C1', fps=10, b64=data))
        for k in ('meta', 'fine'):
            if k in t:
                doc[k] = t[k]
        chj = os.path.join(MUSIC, slug, 'chapters.json')
        if os.path.exists(chj):                         # a suite: mark the stop where each chapter starts
            doc['chapters'] = []
            for c in json.load(open(chj, encoding='utf-8')):
                n, name, artist = ROMAN.match(c['title']).groups()
                k = next(i for i, s in enumerate(doc['stops']) if abs(s['t'] - c['start']) < .01)
                doc['stops'][k]['chap'] = len(doc['chapters'])
                doc['stops'][k]['label'] = n + '. ' + name
                doc['chapters'].append(dict(n=n, title=name, artist=artist, t=round(c['start'], 3)))
            for s in doc['stops']:
                if 'chap' not in s:
                    s['label'] = s['label'][0].upper() + s['label'][1:]
        doc['videos'] = videos_for(slug, doc['stops'], ORDER.index(slug))
        with open(os.path.join(OUT, slug + '.js'), 'w', encoding='utf-8') as f:
            f.write('window.FTA_TOUR = ' + json.dumps(doc, ensure_ascii=False, separators=(',', ':')) + ';\n')
        print(f'{slug}: {os.path.getsize(mp3) / 1e6:.1f} MB audio, {len(data) / 1e3:.0f} kB transform')
    with open(os.path.join(OUT, 'index.js'), 'w', encoding='utf-8') as f:
        f.write('window.FTA_TOURS = ' + json.dumps(index, ensure_ascii=False, indent=0) + ';\n')


if __name__ == '__main__':
    main(set(sys.argv[1:]) or None)
