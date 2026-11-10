"""Original scores for reels G, H, I, J from real sampled instruments (lemo-opuscar sampler, CC0 libraries),
plus the full mix (voice + score + foley) for the lemo-opuscar films I and J.
Run with the lemo-opuscar venv:  ~/lemo-opuscar/.venv/bin/python score.py g h i j
G and H get assets/music.wav (HyperFrames mixes voice and effects); I and J get mix.wav for core/render/mux.sh."""
import json, os, sys
import numpy as np, soundfile as sf

LIB = os.path.expanduser("~/lemo-opuscar")
sys.path.insert(0, LIB)
from core.audio import sampler as S
from core.audio import sfx
from core.audio.sfx import SR, add, noise, bp, lp, hp, t_, env_exp, norm, compress

S.seed(9)
B = 0.5  # 120 bpm


def chord_events(t, inst, notes, dur, vel, pan=0.0):
    return [(t, inst, n, dur, vel, pan + 0.15 * (i - 1)) for i, n in enumerate(notes)]


def ostinato(t0, t1, notes, inst="marimba", vel=0.5, step=B / 2, pan=-0.2):
    ev, t, i = [], t0, 0
    while t < t1 - 1e-6:
        ev.append((round(t, 4), inst, notes[i % len(notes)], step * 1.6, vel * (1.0 if i % 4 == 0 else 0.8), pan))
        t += step; i += 1
    return ev


def hits(t0, t1, inst, var, every, vel, pan=0.0, offset=0.0):
    ev, t = [], t0 + offset
    while t < t1 - 1e-6:
        ev.append((round(t, 4), inst, var, None, vel, pan)); t += every
    return ev


def score_g(D=15.9):
    ev = []
    ev += ostinato(0.0, 6.0, ["A3", "C4", "E4", "A4", "E4", "C4"], vel=0.42)
    ev += ostinato(6.0, 7.0, ["A3", "E4"], vel=0.3, step=B)                       # the quiet hold
    ev += ostinato(7.0, 11.4, ["A3", "C4", "E4", "A4", "G4", "E4", "C4", "E4"], vel=0.5)
    ev += hits(1.8, 6.0, "hihat", "closed", B / 2, 0.22, 0.3)
    ev += hits(7.0, 11.4, "hihat", "closed", B / 2, 0.28, 0.3)
    ev += hits(7.0, 11.4, "frame_drum", "large", B * 2, 0.55)
    for k, ch in enumerate([["A3", "C4", "E4"], ["F3", "A3", "C4"], ["C4", "E4", "G4"], ["G3", "B3", "D4"]] * 2):
        t = 1.8 + k * 2 * B * 2
        if t < 11.3: ev += chord_events(t, "vibraphone", ch, 1.8, 0.35)
    ev += chord_events(11.45, "vibraphone", ["A3", "C4", "E4", "A4"], 4.0, 0.45)
    ev += chord_events(13.45, "vibraphone", ["C4", "E4", "G4", "C5"], 2.4, 0.4)
    ev.append((12.2, "glockenspiel", "A6", 2.5, 0.5, 0.0))
    return ev, D


def score_h(D=16.0):
    ev = []
    riff = ["D3", "D3", "F3", "A3", "C4", "A3", "F3", "E3"]
    for a, b in [(0.0, 3.0), (3.12, 11.3)]:
        ev += ostinato(a, b, riff, vel=0.5, step=B / 2)
        ev += hits(a, b, "shaker", "down", B / 2, 0.25, 0.35)
        ev += hits(a + B, b, "claps", "group", B * 2, 0.35, -0.1)
        ev += hits(a, b, "frame_drum", "large", B * 2, 0.6)
        ev += hits(a + 0.75, b, "frame_drum", "small", B * 2, 0.4, 0.2)
    ev += chord_events(11.45, "vibraphone", ["D3", "F3", "A3", "D4"], 4.5, 0.45)
    ev += chord_events(13.4, "vibraphone", ["F3", "A3", "C4", "F4"], 2.5, 0.4)
    ev.append((11.5, "glockenspiel", "D6", 2.5, 0.45, 0.0))
    return ev, D


def score_i(D=14.9):
    ev = []
    ev += ostinato(0.0, 9.9, ["C4", "G4", "E4", "G4"], vel=0.42)
    ev += hits(1.9, 9.9, "hihat", "closed", B / 2, 0.22, 0.3)
    ev += hits(6.46, 9.9, "frame_drum", "large", B, 0.55)
    for k, n in enumerate(["C5", "D5", "E5", "G5", "A5", "C6", "D6"]):        # one note per hop of the gold square
        ev.append((round(6.46 + k * 0.42, 3), "glockenspiel", n, 1.2, 0.5, 0.1))
    # 9.9 → 10.45: hard stop, a near-silent bar. Then the resolve
    ev += chord_events(10.45, "vibraphone", ["C4", "E4", "G4", "C5"], 4.4, 0.45)
    ev += ostinato(10.45, 12.4, ["C5", "G4", "E4", "C4"], vel=0.35, step=B / 2)
    ev.append((11.55, "glockenspiel", "E6", 2.5, 0.5, 0.0))
    return ev, D


def score_j(D=15.0):
    L = 0.35  # the film runs 0.35 s ahead of the drawing schedule
    mel = [  # one unbroken clarinet line (D major, gentle); time in drawing time
        (0.2, "D4", 0.9), (1.25, "F#4", 0.6), (1.85, "A4", 0.6), (2.45, "B4", 0.4), (2.85, "A4", 0.45), (3.3, "F#4", 1.0),
        # 4.35 → 4.85: the stop. Silence.
        (4.85, "D4", 1.2), (6.0, "E4", 0.6), (6.6, "F#4", 0.6), (7.2, "G4", 0.6), (7.8, "A4", 0.6), (8.4, "B4", 0.6), (9.0, "C#5", 0.9),
        (9.9, "D5", 1.6), (11.55, "F#5", 1.3), (12.9, "D5", 2.3),
    ]
    ev = [(round(t - L, 3), "clarinet", p, d, 0.5, 0.0) for t, p, d in mel if t - L >= 0]
    ev.append((round(11.6 - L, 3), "glockenspiel", "A6", 2.5, 0.5, 0.0))      # the one gold moment
    return ev, D


def score_k(D=14.6):
    ev = []
    ev += ostinato(0.0, 9.0, ["D4", "A4", "F4", "A4"], vel=0.42)
    ev += hits(1.35, 9.0, "hihat", "closed", B / 2, 0.22, 0.3)
    ev += hits(5.3, 9.0, "frame_drum", "large", B, 0.55)
    ev.append((5.75, "glockenspiel", "D6", 1.4, 0.5, 0.1))                    # the gold fills the hole
    for i, n in enumerate(["F5", "A5", "D6"]):                                 # one note per check
        ev.append((round(7.2 + i * 0.09, 3), "glockenspiel", n, 1.0, 0.4, 0.1))
    ev.append((8.63, "glockenspiel", "F6", 1.6, 0.5, 0.0))                     # 29 → 30
    # 9.0 → 9.5: the near-silent bar, then the resolve on the knife
    ev += chord_events(9.5, "vibraphone", ["D4", "F4", "A4", "D5"], 4.4, 0.45)
    ev += ostinato(9.5, 11.4, ["D5", "A4", "F4", "D4"], vel=0.35, step=B / 2)
    ev.append((10.6, "glockenspiel", "A6", 2.5, 0.5, 0.0))
    return ev, D


def score_l(D=15.9):
    ev = []
    ev += ostinato(0.0, 10.7, ["G3", "D4", "B3", "D4"], vel=0.42)
    ev += hits(1.65, 10.7, "hihat", "closed", B / 2, 0.22, 0.3)
    ev += hits(5.95, 10.7, "frame_drum", "large", B, 0.55)
    for t, ch in [(5.95, ["G3", "B3", "D4"]), (7.39, ["C4", "E4", "G4"]), (8.87, ["D4", "F#4", "A4"])]:   # one chord per step, rising
        ev += chord_events(t, "vibraphone", ch, 1.4, 0.4)
    for t, n in [(6.3, "G5"), (7.72, "B5"), (9.2, "D6")]:
        ev.append((t, "glockenspiel", n, 1.2, 0.5, 0.1))
    ev += hits(10.55, 11.15, "hihat", "closed", B / 4, 0.3, 0.3)              # the timer
    ev += chord_events(11.2, "vibraphone", ["G3", "B3", "D4", "G4"], 4.6, 0.45)
    ev += ostinato(11.2, 13.2, ["G4", "D4", "B3", "G3"], vel=0.35, step=B / 2)
    ev.append((12.3, "glockenspiel", "B6", 2.5, 0.5, 0.0))
    return ev, D


def score_m(D=16.0):
    L = 0.35
    mel = [  # drawing time; a slow night line in A minor, then up into A major at the peak
        (0.1, "E4", 0.9), (1.0, "A4", 0.6), (1.6, "C5", 0.6), (2.2, "B4", 0.5), (2.7, "A4", 0.45),
        # 3.15 → 3.6: the stop on the dot. Silence.
        (3.6, "A3", 1.2), (4.8, "C4", 0.6), (5.4, "E4", 0.6), (6.0, "A4", 0.6), (6.6, "B4", 0.6), (7.2, "C5", 0.9),
        (8.2, "E5", 1.0), (9.2, "D5", 0.6), (9.8, "C#5", 0.8),
        (10.6, "E5", 1.4), (12.0, "A5", 1.2), (13.2, "E5", 2.3),
    ]
    ev = [(round(t - L, 3), "clarinet", p, d, 0.5, 0.0) for t, p, d in mel if t - L >= 0]
    ev.append((round(12.25 - L, 3), "glockenspiel", "A6", 2.5, 0.5, 0.0))
    return ev, D


def score_n(D=15.0):
    L = 0.35
    mel = [  # drawing time; warm G major, one unbroken line
        (0.1, "G4", 0.9), (1.1, "B4", 0.6), (1.7, "D5", 0.6), (2.4, "C5", 0.5), (2.9, "B4", 0.5),
        (3.4, "A4", 0.4), (3.8, "B4", 0.4), (4.2, "C5", 0.4), (4.6, "D5", 0.7),           # the chart rises
        (5.4, "G4", 1.2), (6.6, "A4", 0.6), (7.2, "B4", 0.6), (7.8, "C5", 0.6), (8.4, "D5", 0.6), (9.0, "E5", 0.9),
        (10.1, "D5", 1.5), (11.8, "B5", 1.3), (13.0, "G5", 2.0),
    ]
    ev = [(round(t - L, 3), "clarinet", p, d, 0.5, 0.0) for t, p, d in mel if t - L >= 0]
    ev.append((round(11.8 - L, 3), "glockenspiel", "D7", 2.5, 0.5, 0.0))
    return ev, D


def score_o(D=16.5):
    # the failed jump: a run up and a thud. Then one rising note per step, and the resolve on the peak
    ev = [(round(0.45 + k * 0.06, 3), "glockenspiel", n, 0.5, 0.4, 0.1) for k, n in enumerate(["A4", "C5", "E5", "A5", "C6", "E6"])]
    ev += [(round(1.05 + k * 0.07, 3), "marimba", n, 0.4, 0.4, -0.1) for k, n in enumerate(["E5", "C5", "A4", "E4", "C4"])]
    ev.append((1.5, "frame_drum", "large", None, 0.9, 0.0))
    ev += ostinato(1.75, 11.2, ["A3", "E4", "C4", "E4"], vel=0.4)
    ev += hits(2.6, 11.2, "hihat", "closed", B / 2, 0.22, 0.3)
    ev += hits(8.05, 11.2, "frame_drum", "large", B, 0.5)
    for t, n in [(2.6, "A4"), (2.95, "B4"), (4.45, "C5"), (5.85, "D5"), (7.0, "E5"), (8.05, "G5"), (8.87, "A5"), (9.84, "C6")]:
        ev.append((t, "glockenspiel", n, 1.2, 0.5, 0.1))
        ev.append((t, "frame_drum", "small", None, 0.4, 0.2))
    for t, ch in [(3.64, ["A3", "C4", "E4"]), (5.85, ["F3", "A3", "C4"]), (8.05, ["C4", "E4", "G4"]), (9.84, ["G3", "B3", "D4"])]:
        ev += chord_events(t, "vibraphone", ch, 1.8, 0.35)
    # 11.2 -> 11.9: the near-silent bar
    for t, n in [(12.08, "D6"), (12.4, "E6"), (12.72, "G6")]:
        ev.append((t, "glockenspiel", n, 0.8, 0.5, 0.1)); ev.append((t, "frame_drum", "small", None, 0.45, 0.2))
    ev += chord_events(13.34, "vibraphone", ["A3", "C#4", "E4", "A4"], 4.2, 0.5)
    ev.append((13.34, "frame_drum", "large", None, 0.7, 0.0)); ev.append((13.34, "glockenspiel", "A6", 2.5, 0.5, 0.0))
    return ev, D


def score_p(D=16.3):
    # a pulse that climbs a tone on every dive, held on what Dhirwa is, then the whole run backwards on the pull-out
    ev = []
    dives = [(0.0, "D3"), (1.45, "E3"), (2.3, "F#3"), (4.2, "A3"), (5.05, "B3")]
    for (t, n), t1 in zip(dives, [1.45, 2.3, 4.2, 5.05, 6.5]):
        ev += ostinato(t, t1, [n, n], inst="marimba", vel=0.45, step=B / 2)
    for t, n in [(1.45, "E5"), (2.3, "F#5"), (4.2, "A5"), (5.05, "B5"), (6.5, "D6")]:
        ev.append((t, "glockenspiel", n, 1.2, 0.5, 0.1)); ev.append((t, "frame_drum", "large", None, 0.6, 0.0))
    ev += hits(1.45, 6.5, "hihat", "closed", B / 2, 0.22, 0.3)
    for t, ch in [(6.5, ["D4", "F#4", "A4"]), (8.72, ["G3", "B3", "D4"]), (10.08, ["A3", "C#4", "E4"])]:
        ev += chord_events(t, "vibraphone", ch, 2.2, 0.4)
    ev += ostinato(6.5, 11.4, ["D4", "A4", "F#4", "A4"], vel=0.3, step=B / 2)
    ev += [(round(12.0 + k * 0.17, 3), "glockenspiel", n, 0.6, 0.45, 0.1) for k, n in enumerate(["D6", "B5", "A5", "F#5", "E5", "D5", "A4"])]
    ev += chord_events(13.2, "vibraphone", ["D4", "F#4", "A4", "D5"], 4.2, 0.5)
    ev.append((13.2, "frame_drum", "large", None, 0.7, 0.0)); ev.append((13.2, "glockenspiel", "A6", 2.5, 0.5, 0.0))
    return ev, D


def score_q(D=14.8):
    # chaos: notes with no grid. On the snap everything locks to the beat; one chord per shape
    ev = [(round(0.07 * k * (1 + 0.37 * ((k * 7) % 5)) % 2.05, 3), "marimba",
           ["E4", "A#4", "C5", "F#3", "D#5", "G4", "B3", "F5"][k % 8], 0.3, 0.38, 0.6 * ((k % 5) / 2 - 1)) for k in range(26)]
    ev.append((2.16, "frame_drum", "large", None, 0.85, 0.0))
    ev += ostinato(2.16, 9.4, ["E4", "B4", "G4", "B4"], vel=0.42)
    ev += hits(3.2, 9.4, "hihat", "closed", B / 2, 0.22, 0.3)
    ev += hits(5.09, 9.4, "frame_drum", "large", B * 2, 0.5)
    for t, ch in [(2.16, ["E3", "G3", "B3"]), (4.33, ["C4", "E4", "G4"]), (5.09, ["G3", "B3", "D4"]), (6.69, ["A3", "C4", "E4"]), (8.19, ["B3", "D#4", "F#4"])]:
        ev += chord_events(t, "vibraphone", ch, 1.6, 0.38)
    for t, n in [(3.2, "E5"), (3.71, "G5")]:
        ev.append((t, "glockenspiel", n, 1.0, 0.45, 0.1))
    for t, n in [(9.95, "E5"), (10.4, "G5"), (10.67, "B5"), (10.95, "D6"), (11.2, "E6")]:   # one note per step
        ev.append((t, "glockenspiel", n, 0.9, 0.5, 0.1))
    ev += chord_events(11.72, "vibraphone", ["E4", "G#4", "B4", "E5"], 3.6, 0.5)
    ev.append((11.72, "frame_drum", "large", None, 0.7, 0.0)); ev.append((11.72, "glockenspiel", "B6", 2.3, 0.5, 0.0))
    return ev, D


def render(ev, D, room=0.18):
    mix = S.render(ev, dur=D + 1.0)
    mix = S.room(mix, size=0.35, mix=room)
    n = int(D * SR); mix = mix[:n]
    fade = int(1.2 * SR); mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
    return mix


def voice(path, D):
    v, sr = sf.read(path, dtype="float32")
    if v.ndim > 1: v = v.mean(1)
    assert sr == SR, sr
    v = compress(v, thr=0.25, ratio=3.5)
    out = np.zeros(int(D * SR), np.float32); out[: min(len(v), len(out))] = v[: len(out)]
    return out


def duck(music, vox, depth_db=10.0):
    # gain follows the voice envelope (50 ms), music drops depth_db under speech
    env = np.convolve(np.abs(vox), np.ones(int(0.05 * SR)) / int(0.05 * SR), mode="same")
    g = 1 - (1 - 10 ** (-depth_db / 20)) * np.clip(env / (env.max() * 0.25 + 1e-9), 0, 1)
    return music * g[:, None]


def paper_slide(v=1.0, d=0.18):
    return norm(bp(noise(d), 700, 5000) * np.sin(np.pi * t_(d) / d) ** 1.5) * v


def clack(v=1.0):
    d = 0.07; tt = t_(d)
    x = hp(noise(d), 2500) * env_exp(d, 0.0012) * 0.9 + np.sin(2 * np.pi * 3300 * tt) * env_exp(d, 0.01) * 0.45 + np.sin(2 * np.pi * 420 * tt) * env_exp(d, 0.012) * 0.35
    return norm(x) * v


def thunk(v=1.0):
    d = 0.12; tt = t_(d)
    return norm(np.sin(2 * np.pi * 95 * tt) * env_exp(d, 0.025) + bp(noise(d), 300, 1500) * env_exp(d, 0.006) * 0.6) * v


def knife(v=1.0, d=0.3):
    x = bp(noise(d), 1800, 7000) * np.minimum(1, t_(d) / (d * 0.7)) ** 1.5
    return norm(x) * v


def mix_i(D=14.9, key="i", score=None):
    m = render((score or score_i)(D)[0], D)
    vox = voice(f"{key}/voice.wav", D)
    m = duck(m, vox, 10)
    fol = np.zeros((int(D * SR), 2), np.float32)
    ev = json.load(open(f"{key}/events.json"))["ev"]
    for e in ev:
        if e["type"] == "clack": add(fol, clack(0.22), e["t"], 1.0, 0.6 - 0.2 * e["k"])
        elif e["type"] == "thunk": add(fol, thunk(0.5), e["t"], 1.0, 0)
        elif e["type"] == "slide": add(fol, paper_slide(0.18), e["t"] - 0.15, 1.0, 0.2)
        elif e["type"] == "knife": add(fol, knife(0.3), e["t"], 1.0, 0)
        elif e["type"] == "land": add(fol, thunk(0.3), e["t"], 1.0, 0)
    out = m * 0.55 + fol + vox[:, None] * 1.0
    return out


def mix_j(D=15.0, key="j", score=None):
    m = render((score or score_j)(D)[0], D, room=0.25)
    vox = voice(f"{key}/voice.wav", D)
    m = duck(m, vox, 5)
    ev = json.load(open(f"{key}/events.json"))["ev"]
    # pen on paper: band-passed noise, brighter and louder when the nib is fast
    pen = np.zeros(int(D * SR), np.float32); hop = int(SR / 30)
    base_lo, base_hi = bp(noise(D + 0.1), 400, 2500)[: len(pen)], bp(noise(D + 0.1), 1500, 6000)[: len(pen)]
    amp = np.zeros(len(pen), np.float32); bright = np.zeros(len(pen), np.float32)
    for e in ev:
        if e["type"] != "pen": continue
        i = int(e["t"] * SR); v = e["v"]
        amp[i: i + hop] = np.sqrt(min(v, 2500) / 2500); bright[i: i + hop] = min(v, 1500) / 1500
    k = int(0.03 * SR); amp = np.convolve(amp, np.ones(k) / k, "same"); bright = np.convolve(bright, np.ones(k) / k, "same")
    pen = (base_lo * (1 - bright) + base_hi * bright) * amp
    pen = norm(pen) * 0.12
    env = np.convolve(np.abs(vox), np.ones(int(0.05 * SR)) / int(0.05 * SR), mode="same")
    pen *= 1 - 0.37 * np.clip(env / (env.max() * 0.25 + 1e-9), 0, 1)        # pen ducks ~4 dB under the voice
    out = m * 0.6 + np.stack([pen, pen], 1) + vox[:, None]
    # the stop: literal silence on the music bus
    for e in ev:
        if e["type"] == "stop":
            a, b = int(e["t"] * SR), int((e["t"] + 0.5) * SR)
            out[a:b] = vox[a:b, None]
    return out


for key in sys.argv[1:]:
    if key in "ghopq":
        ev, D = {"g": score_g, "h": score_h, "o": score_o, "p": score_p, "q": score_q}[key]()
        sf.write(f"{key}/assets/music.wav", render(ev, D), SR)
        print(key, "music.wav", D)
    else:
        out = {"i": lambda: mix_i(), "j": lambda: mix_j(),
               "k": lambda: mix_i(14.6, "k", score_k), "l": lambda: mix_i(15.9, "l", score_l),
               "m": lambda: mix_j(16.0, "m", score_m), "n": lambda: mix_j(15.0, "n", score_n)}[key]()
        out = out / max(1.0, np.abs(out).max() / 0.95)
        sf.write(f"{key}/out/mix.wav", out.astype(np.float32), SR)
        print(key, "mix.wav", len(out) / SR)
