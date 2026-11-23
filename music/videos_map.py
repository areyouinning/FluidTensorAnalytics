"""Which FluidTA page plays beside which track: a clip per stop, cycling through a sequence chosen by theme.
Clips are 8 s, muted, looped (tours/video/<page>.mp4); `page` links to the live page when it exists."""

CLIPS = {
    'votes-as-rain': ('Votes as rain', '/votes-as-rain.html'),
    'navier-stokes-demo': ('2D fluid simulation', '/navier-stokes-demo.html'),
    'blowup': ('Blowup', '/blowup.html'),
    'circles': ('What does one circle secretly run?', '/circles.html'),
    'soundscape': ('What does a drop look like?', None),            # not live yet: no link
    'remix-parrondo': ("Parrondo's paradox", '/remix-parrondo.html'),
    'remix-sphere': ('Points on a sphere', '/remix-sphere.html'),
    'rivers-all-the-way-down': ('Rivers all the way down', '/rivers-all-the-way-down.html'),
    'way-of-water': ('The Way of Water', '/way-of-water.html'),
}
FLUID = ['votes-as-rain', 'navier-stokes-demo', 'way-of-water', 'blowup']
MATH = ['circles', 'remix-sphere', 'remix-parrondo', 'rivers-all-the-way-down']
BASS = ['blowup', 'soundscape', 'remix-parrondo', 'votes-as-rain']
SEQ = {
    'drtoast-sunrise-epicycles': ['circles', 'votes-as-rain', 'remix-sphere', 'way-of-water'],
    'andreilien-log-time': ['rivers-all-the-way-down', 'blowup', 'remix-parrondo', 'soundscape'],
    'ott-hilbert-drift': ['remix-sphere', 'navier-stokes-demo', 'remix-parrondo', 'way-of-water'],
    'outersect-single-breath': ['way-of-water', 'navier-stokes-demo', 'votes-as-rain'],
    'welder-violet-hour': ['way-of-water', 'votes-as-rain', 'remix-sphere'],
    'sts9-relic-signal': ['circles', 'remix-parrondo', 'blowup', 'soundscape'],
    'eno-slow-morning': ['way-of-water', 'remix-sphere', 'navier-stokes-demo'],
    'bach-eno': ['way-of-water', 'circles', 'remix-sphere'],
    'bach-hopkins': ['rivers-all-the-way-down', 'navier-stokes-demo', 'votes-as-rain', 'blowup'],
    'bach-splatinum': ['circles', 'blowup', 'remix-parrondo', 'soundscape'],
    'splatinum-golden-wobble': ['soundscape', 'blowup', 'remix-parrondo', 'votes-as-rain'],
    'hopkins-breathing-machine': ['navier-stokes-demo', 'votes-as-rain', 'blowup'],
    'shpongle-spiral-teahouse': ['remix-parrondo', 'votes-as-rain', 'remix-sphere'],
    'tycho-coastline-hours': ['rivers-all-the-way-down', 'way-of-water', 'votes-as-rain'],
}


CHAPTER_CLIPS = {    # one clip per chapter, so the picture changes when the story does
    'odyssey-in-seven': ['soundscape', 'navier-stokes-demo', 'circles', 'rivers-all-the-way-down', 'blowup',
                         'way-of-water', 'remix-sphere'],
}


def videos_for(slug, stops, i):
    if slug in CHAPTER_CLIPS:
        out, c = [], -1
        for st in stops:
            c = st.get('chap', c)
            label, page = CLIPS[CHAPTER_CLIPS[slug][c]]
            out.append(dict(t=st['t'], clip=f'video/{CHAPTER_CLIPS[slug][c]}.mp4', label=label, page=page))
        return out
    """[{t, clip, label, page}] one per stop. Tracks without a chosen sequence take a theme by their index."""
    seq = SEQ.get(slug) or [FLUID, MATH, BASS][i % 3]
    out = []
    for k, st in enumerate(stops):
        c = seq[(k + (0 if slug in SEQ else i)) % len(seq)]
        label, page = CLIPS[c]
        out.append(dict(t=st['t'], clip=f'video/{c}.mp4', label=label, page=page))
    return out
