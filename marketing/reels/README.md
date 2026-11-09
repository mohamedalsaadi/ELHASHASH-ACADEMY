# Dhirwa reels (HyperFrames)

Three 18 s, 1080x1920 Gulf Arabic reels about the grade 12 math final: `a/` student, `b/` parent, `c/` father and son dialogue.
`node build.mjs` regenerates all three from one set of scenes (brand values from `DESIGN.md` / `src/app/tokens.css`).

- Preview/check one: `cd a && npx hyperframes preview` / `npx hyperframes check --json`.
- Captions are timed to ESTIMATED speech. When the Gulf voiceover exists, add it as an `<audio id=...>` and re-time `cap` in `build.mjs` from its transcript.
- Numbers on screen are an illustration and are labelled "مثال توضيحي". Claims are limited to lessons, practice questions, progress numbers, asking the teacher.
- Renders and `.hyperframes/` are git-ignored. Nothing here is published.
- Fonts: Reem Kufi (OFL, wordmark only) and IBM Plex Sans Arabic (OFL), via @fontsource.
