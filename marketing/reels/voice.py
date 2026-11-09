# Generates the voiceovers with word timings (ElevenLabs v3). Needs ELEVENLABS_API_KEY in .env.
#   python voice.py b      -> b/assets/voice.mp3 + voice/b-alignment.json
#   python voice.py c      -> two speakers, one line at a time, joined with short gaps
import base64, json, os, subprocess, sys, urllib.request

KEY = next(l.split("=", 1)[1].strip() for l in open(".env", encoding="utf-8") if l.startswith("ELEVENLABS_API_KEY="))
SULTAN, BANDAR = "rUaPbzcZIu8df8iNL9WZ", "aLv8a8fbjjLsORNUDQ1J"  # Bandar: young Saudi/Gulf, chosen by the owner for the son

SCRIPTS = {
    "b": [(SULTAN,
        "[excited] تبي تعرف وين مستوى ولدك في الرياضيات قبل النهائي؟ "
        "تعرّف على ذروة: منصّة دراسة لطلاب الثانوية في الخليج. "
        "دروس فيديو مع مدرّسين، وبعد كل درس أسئلة واختبارات بوقت. "
        "وإنت تشوف تقدّمه بالأرقام، بدون ما تسأله ألف مرة! "
        "اختار باقة شهر أو فصل، وريّح بالك. "
        "[excited] ذروة… كل درس خطوة نحو الذروة!")],
    "c": [
        (SULTAN, "[surprised] قاعد تذاكر؟!"),
        (BANDAR, "[excited] إيه! أراجع رياضيات للنهائي."),
        (SULTAN, "[laughs] من متى إنت تذاكر؟"),
        (BANDAR, "[excited] من يوم سجّلت في ذروة! دروس فيديو مع مدرّسين، وبعد كل درس أسئلة أتمرّن عليها."),
        (SULTAN, "وأقدر أشوف تقدّمك؟"),
        (BANDAR, "أكيد يبه، كل شي بالأرقام: الدروس اللي خلّصتها، ونتيجة آخر اختبار."),
        (SULTAN, "[laughs] زين والله! وإذا ما فهمت شي؟"),
        (BANDAR, "أسأل مدرّسي على طول."),
        (SULTAN, "[excited] ذروة… كل درس خطوة نحو الذروة!"),
    ],
    "a2": [(SULTAN,
        "[excited] نهائي الرياضيات على الباب! وللحين تقول بكرة؟ [laughs] لا لا لا! "
        "ذروة: دروس تقوية أونلاين لطلاب الثَّانَوِيَّة، مع مدرّسين يشرحون منهجك خطوة خطوة. "  # vowelled: the plain spelling was misread
        "بعد كل درس أسئلة تتمرّن عليها، واختبارات بوقت مثل النهائي. "
        "تشوف مستواك بالأرقام، وولي أمرك يتابع تقدّمك. علقت؟ اسأل مدرّسك على طول! "
        "اختار باقة شهر أو فصل، وابدأ اليوم. [excited] كل درس خطوة نحو الذروة!")],
    "b2": [(SULTAN,
        "[excited] تبي تعرف وين مستوى ولدك في الرياضيات قبل النهائي؟ "
        "ذروة: دروس تقوية أونلاين لطلاب الثانوية، مع مدرّسين. بعد كل درس أسئلة، واختبارات بوقت. "
        "وإنت تشوف تقدّمه بالأرقام، بدون ما تسأله ألف مرة! اختار باقة شهر أو فصل، وريّح بالك. "
        "[excited] كل درس خطوة نحو الذروة!")],
    "d": [(SULTAN, "[excited] سؤال سريع! مشتقة إكس تربيع؟ عندك خمس ثواني… [laughs] صح! اثنين إكس! "
                   "تبي أسئلة مثل هذي بعد كل درس؟ ذروة: دروس تقوية أونلاين لطلاب الثانوية، مع مدرّسين. "
                   "[excited] كل درس خطوة نحو الذروة!")],
    "e": [(SULTAN, "[excited] قبل: بعدين… بكرة… ما فهمت! بعد ذروة: دروس تقوية أونلاين لطلاب الثانوية، مع مدرّسين. "
                   "درس. سؤال. اختبار. وتشوف مستواك بالأرقام! [excited] كل درس خطوة نحو الذروة!")],
    "f": [(SULTAN, "[excited] يا أبو محمد! ولدك خلّص درس اليوم، وحلّ الأسئلة، ونتيجته بالأرقام قدامك. "
                   "بدون ما تسأله! ذروة: دروس تقوية أونلاين لطلاب الثانوية، مع مدرّسين. "
                   "[excited] كل درس خطوة نحو الذروة!")],
}
WHAT = "ذروة: دروس تقوية أونلاين لطلاب الثَّانَوِيَّة، مع مدرّسين. "  # vowelled: the plain spelling was misread
TAG = "[excited] كل درس خطوة نحو الذروة!"
SCRIPTS.update({
    "g": [(SULTAN, "[excited] سؤال ما فهمته؟ " + WHAT + "تشوف الدرس، تحلّ السؤال، وتشوف تقدّمك بالأرقام. " + TAG)],
    "h": [(SULTAN, "[surprised] سهر لين الفجر، وأوراق مراجعة بكل مكان؟ " + WHAT + "بعد كل درس أسئلة، وتسأل مدرّسك على طول. " + TAG)],
    "i": [(SULTAN, "[excited] باقي على النهائي أسبوع! " + WHAT + "درس، أسئلة، واختبار بوقت مثل النهائي. " + TAG)],
    "j": [(SULTAN, "يا أبو خالد… ولدك خلّص درس اليوم وحلّ الأسئلة، بدون ما تسأله! " + WHAT + TAG)],
    "k": [(SULTAN, "[surprised] فاتتك الحصة؟ " + WHAT + "الدرس فيديو، بعده أسئلة، وتقدّمك بالأرقام. " + TAG)],
    "l": [(SULTAN, "[excited] ثلاث خطوات بس! " + WHAT + "واحد: درس. اثنين: أسئلة. ثلاثة: اختبار بوقت. " + TAG)],
    "m": [(SULTAN, "نص الليل… وسؤال واحد واقف بوجهك؟ " + WHAT + "وتسأل مدرّسك على طول. " + TAG)],
    "n": [(SULTAN, "يا أم سارة… تبين تعرفين بنتك وين وصلت؟ تقدّمها قدامك بالأرقام. " + WHAT + TAG)],
})
# C2: C's dialogue, then the narrator says what Dhirwa is before the tagline.
SCRIPTS["c2"] = SCRIPTS["c"][:-1] + [
    (SULTAN, "ذروة: دروس تقوية أونلاين لطلاب الثانوية، مع مدرّسين."),
    (SULTAN, "[excited] كل درس خطوة نحو الذروة!"),
]
GAP = 0.25  # seconds of silence between speakers


def tts(voice, text):
    body = json.dumps({"text": text, "model_id": "eleven_v3", "voice_settings": {"stability": 0.0, "similarity_boost": 0.8}}).encode()
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice}/with-timestamps?output_format=mp3_44100_128",
        data=body, headers={"xi-api-key": KEY, "content-type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=180))


def duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True)
    return float(out.stdout.strip())


key = sys.argv[1]
os.makedirs(f"{key}/assets", exist_ok=True)
os.makedirs("voice/parts", exist_ok=True)
chars, starts, ends, texts, parts = [], [], [], [], []
offset = 0.0
for n, (voice, text) in enumerate(SCRIPTS[key]):
    d = tts(voice, text)
    part = f"voice/parts/{key}-{n}.mp3"
    open(part, "wb").write(base64.b64decode(d["audio_base64"]))
    a = d["alignment"]
    if chars:  # a space joins the lines so the caption builder splits them
        chars.append(" "); starts.append(offset); ends.append(offset)
    chars += a["characters"]
    starts += [t + offset for t in a["character_start_times_seconds"]]
    ends += [t + offset for t in a["character_end_times_seconds"]]
    texts.append(text)
    parts.append(part)
    offset += duration(part) + GAP

# Join the parts with GAP seconds of silence between them.
inputs, filters = [], []
for i, p in enumerate(parts):
    inputs += ["-i", p]
    filters.append(f"[{i}:a]apad=pad_dur={GAP}[a{i}]")
concat = "".join(f"[a{i}]" for i in range(len(parts)))
subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(filters) + f";{concat}concat=n={len(parts)}:v=0:a=1[out]", "-map", "[out]", "-b:a", "128k", f"{key}/assets/voice.mp3"], check=True)
json.dump({"text": " ".join(texts), "alignment": {"characters": chars, "character_start_times_seconds": starts, "character_end_times_seconds": ends}},
          open(f"voice/{key}-alignment.json", "w", encoding="utf-8"), ensure_ascii=False)
print(key, "voice", round(duration(f"{key}/assets/voice.mp3"), 2), "s, last word ends", round(ends[-1], 2))
