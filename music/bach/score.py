"""Bach, Prelude in C major, BWV 846 (Well-Tempered Clavier I), from the Mutopia Project's public-domain
MIDI (bwv846.mid, LilyPond 2.14.2). Gives the notes in beats and, per bar, the five-note chord that the
famous figure arpeggiates (lowest note first)."""
import os
import mido

HERE = os.path.dirname(os.path.abspath(__file__))


def notes():
    """[(beat, midi, beats_long)] sorted, both hands."""
    m = mido.MidiFile(os.path.join(HERE, 'bwv846.mid'))
    tpb, out = m.ticks_per_beat, []
    for tr in m.tracks[1:]:
        t, on = 0, {}
        for msg in tr:
            t += msg.time
            if msg.type == 'note_on' and msg.velocity > 0:
                on[msg.note] = t
            elif msg.type in ('note_off', 'note_on') and msg.note in on:
                s = on.pop(msg.note); out.append((s / tpb, msg.note, (t - s) / tpb))
    return sorted(out)


def bars():
    """{bar: [notes]} with bar = floor(beat / 4)."""
    b = {}
    for n in notes():
        b.setdefault(int(n[0] // 4), []).append(n)
    return b


def chords():
    """Per bar, the distinct pitches sounding in it, lowest first (the five-note shape in bars 1-32)."""
    return {k: sorted({n[1] for n in v}) for k, v in sorted(bars().items())}


if __name__ == '__main__':
    import librosa
    ns = notes(); bs = bars()
    print(len(ns), 'notes,', len(bs), 'bars,', ns[-1][0] + ns[-1][2], 'beats')
    for k, c in chords().items():
        print(k + 1, ' '.join(librosa.midi_to_note(x) for x in c))
