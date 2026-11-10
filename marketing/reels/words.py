# Prints word timings of a voiceover:  python words.py o
import json, sys
d = json.load(open(f"voice/{sys.argv[1]}-alignment.json", encoding="utf-8"))["alignment"]
w, s, e, tag = "", None, None, False
for c, a, b in zip(d["characters"], d["character_start_times_seconds"], d["character_end_times_seconds"]):
    if c == "[": tag = True
    if tag:
        if c == "]": tag = False
        continue
    if c.isspace():
        if w: print(f"{s:6.2f} {e:6.2f}  {w}")
        w = ""; continue
    if not w: s = a
    w += c; e = b
if w: print(f"{s:6.2f} {e:6.2f}  {w}")
