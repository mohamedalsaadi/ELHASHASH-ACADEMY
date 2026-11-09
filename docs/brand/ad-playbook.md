# Dhirwa ad playbook (short vertical reels)

Part of the brand identity (agreed with the owner, 2026-11-09). Every future ad follows this method. The working project is `marketing/reels/` (HyperFrames + ElevenLabs); the reels D, E, F and A2, B2, C2 are the reference.

## What every ad must do
1. **Say what Dhirwa is**, out loud and on screen: «دروس تقوية أونلاين لطلاب الثانوية، مع مدرّسين». A viewer who skips to the end card must still learn it (end card carries the same line).
2. **Hook on frame 0.** Frame 0 is the thumbnail: the first words are already visible.
3. **Close with** the mark, ذروة, the tagline «كل درس خطوة نحو الذروة», `dhirwa.ae`. Hold it at least 2 s.
4. Claim only what exists: video lessons with teachers, questions after each lesson, timed exams, progress in numbers, the parent view, asking the teacher, month or term packages. No prices, student counts, results, or testimonials. Sample UI carries «مثال توضيحي».

## Look
- Kinetic type is the caption: the spoken words slam on screen as they are said. No caption bar, and a sentence is never on screen twice (no caption under a bubble, headline, or intro).
- Hard cuts, a new shot every 0.5 to 2 s, alternating ink (dark) and ground (light) screens, a punch-in on every cut.
- The gold point is the only accent. Reem Kufi for the wordmark only. No emoji, no gradient text, no bounce.
- Format 1080x1920, 30 fps; text inside the band 168 to 1330 px.

## Voice and sound
- ElevenLabs `eleven_v3`, stability 0.0, audio tags `[excited]`, `[laughs]`, `[surprised]`. Neutral Gulf wording (not Emirati-only words: «بكرة» not «باجر»).
- Voices: Sultan (`rUaPbzcZIu8df8iNL9WZ`) is the main voice and the father; Bandar (`aLv8a8fbjjLsORNUDQ1J`) is the son. Speed the line up 1.1x (`speed.py`) to keep the pace.
- Write tricky words fully vowelled in the script (for example «الثَّانَوِيَّة»): the plain spelling was misread.
- Sound effect on every cut (whoosh, pop, tick), the beat loop at 0.3, a riser before the end card. A real music track needs the `music_generation` permission on the ElevenLabs key.

## Lengths
Fast 11 to 19 s, medium 21 to 34 s. Scenario ideas that worked: a 5-second challenge, before and after, a message to the parent, a father-and-son dialogue.

## Approved alternative looks (2026-11-09)
The owner rated reels I and J the best so far. The "What every ad must do" rules and the voice rules still apply. Both are drawn on a canvas with lemo-opuscar (MIT, cloned to `~/lemo-opuscar`, not in this repo): `video.mjs --size 1080x1920`, then `mux.sh` (−14 LUFS).
- **Swiss grid (reel I, «ليلة النهائي»):** a flush grid that means something (columns are days, read right to left; rows are درس / أسئلة / اختبار). One giant numeral is the hook. The gold square is the only off-grid element. Snaps land on a 120 bpm beat, a near-silent bar comes before the end card, and a knife cut leads into it. Plex Sans Arabic only, Reem Kufi for the wordmark.
- **One-line drawing (reel J, «رسالة لولي الأمر»):** one ink line draws the story without lifting the pen. The pen stops, and the music goes silent, on the key line. The line then climbs into the mark, and gold is used once, for the dot. Subtitles are written on without a box; each line clears before the next starts.
- **Sound for both:** an original score from real CC0 instruments (`marketing/reels/score.py`, the lemo sampler), dry foley on visible actions, and the voice ducking the music.
- **One take (reel G, HyperFrames)** is also approved. The gold point carries every beat with no cuts.
- Tried but not preferred: paper collage (H).

## Process
Script, audit (dialect, claims, "does it say what Dhirwa is"), voice, `node build.mjs`, `npx hyperframes check --json` (0 errors), snapshot frame 0, the identity scene and the end card, render at delivery quality, owner listens before anything is published. Nothing is posted or paid for without the owner's yes. The ElevenLabs key lives in `marketing/reels/.env` and is never committed.
