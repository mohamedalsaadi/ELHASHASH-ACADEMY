# Speeds a voiceover up (pitch kept) and rescales its timings to match.
#   python speed.py d 1.1
import json, os, subprocess, sys

key, f = sys.argv[1], float(sys.argv[2])
src, tmp = f"{key}/assets/voice.mp3", f"{key}/assets/voice-tmp.mp3"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-filter:a", f"atempo={f}", "-b:a", "128k", tmp], check=True)
os.replace(tmp, src)
p = f"voice/{key}-alignment.json"
d = json.load(open(p, encoding="utf-8"))
for k in ("character_start_times_seconds", "character_end_times_seconds"):
    d["alignment"][k] = [t / f for t in d["alignment"][k]]
json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False)
print(key, "last word ends", round(d["alignment"]["character_end_times_seconds"][-1], 2))
