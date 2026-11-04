# Innovations roadmap (2026-11-05)

28 ideas, each chosen because the raw material already exists in the database. Owner decisions:
algorithm-first with AI as garnish, full roadmap built in waves from the top, all four segments equal,
no offline/PWA, no AI bill unless it earns its place.

Rules that bind every idea: no leaderboards or badges, no invented social proof, AI drafts and a human
approves anything touching money, grades or the owner's voice, Arabic first, nothing that exposes a
minor's data to another minor.

Effort: **S** ≤ 1 day · **M** 2–4 days · **L** 1–2 weeks.

## Student

| # | Idea | E | Why it is different |
|---|---|---|---|
| 1 | Readiness Index — one honest 0–100 per course from coverage × accuracy × recency, plus the single biggest gap by name | M | Predicts nothing the teacher has not measured |
| 2 | Confidence check — one tap after a lesson: got it / shaky / lost | S | Feeds 1 and 11; no free-text, no guilt |
| 3 | Review queue from past wrong answers, scheduled by FSRS | M | Deterministic published algorithm, no service |
| 4 | Spotlight lesson view — current step only, rest collapsed to a rail, toggle remembered | L | Minimalism as a feature |
| 5 | One-tap "Ask my teacher" pre-filled with the concept and the student's own answer | S | Removes the blank-page problem |
| 6 | Mistake notebook with a one-line rule per miss, exportable | M | Turns every wrong answer into study material |
| 7 | Exam-day mode — last 48h show only weak concepts and past questions | S | Protects the night before |
| 8 | Ten-word summary + three key terms per lesson, AI draft, teacher approves once | M | Stored, never regenerated per view |
| 9 | Handwriting check — photo of a worked solution graded against the model answer, teacher releases | L | Teacher keeps the final word |
| 10 | AR⇄EN term glossary on hover for maths and science | M | Language switching stops being a cliff |
| 11 | Class pulse (teacher) — who is stuck, from confidence taps and failed attempts | M | No marks, no names on a wall |

## Teacher

| # | Idea | E |
|---|---|---|
| 12 | Homework triage: clearly fine / needs a look / possibly copied, one line each | M |
| 13 | Draft answer to a student question grounded in the lesson; teacher edits and sends | M |
| 14 | Question generator from lesson notes into the bank as drafts | M |
| 15 | Payout statement per teacher from the ledger with anomaly flags | S |
| 16 | Pre-publish nudge: missing video, untranslated title, empty unit, odd price | S |

## Parent

| # | Idea | E |
|---|---|---|
| 17 | Three-sentence weekly digest: one real number, one suggestion, parent's language | S |
| 18 | "Ask about my child" — answers only from that child's data, refuses the rest | M |
| 19 | Fee-and-access clarity card: what is paid, what expires, one tap to renew | S |
| 20 | Exam-week reminder with the child's actual dates | S |

## Owner

| # | Idea | E |
|---|---|---|
| 21 | 06:00 briefing: revenue, approvals, ungraded homework, failed payments, signups | M |
| 22 | Support triage: category, urgency, draft reply; money cases go to the owner | M |
| 23 | Teacher application summary with red flags beside Approve / Reject | S |
| 24 | Weekly "what broke" digest in plain words with the likely cause | M |

## Platform

| # | Idea | E | Status |
|---|---|---|---|
| 25 | Arabic-tolerant catalogue search: hamza, taa marbuta, alef forms, tatweel, diacritics, mixed AR/EN | S | **Shipped 2026-11-05** |
| 26 | Command palette (Ctrl/⌘K): jump to a lesson, ask, open live, search | M | |
| 27 | "Is this for me?" — three questions to the right grade and subject, no signup | S | |
| 28 | Smart empty states — "coming soon" and an offer to notify, never a fake card | S | |

## Waves

1. **Shipped:** #25.
2. **Now:** #2 confidence check → #1 readiness → #11 class pulse → #17 digest.
3. **Engagement:** #3, #6, #7, #19, #15.
4. **Teacher leverage:** #12, #13, #16, #21, #23.
5. **Depth:** #4, #9, #8, #10, #14, #18, #22, #24, #26, #27, #28.

## Bugs found while inventorying (fix before building on them)

- `PracticeAttempt.xp` stores the **cumulative** `StudentProgress.xp`, not the run's XP. The result page
  labels it "XP earned" and the weekly leaderboard sums those totals, so one practice run re-counts
  everyone's prior XP.
- `LessonView.watchedSec` is read by the admin subscriber page but **never written**, so "minutes
  watched" is always 0.
- Exam marks never enter the homework average, `strengths()`, XP or the review schedule.
- `masteryOf()` and `QuizAttempt` are implemented but called from nowhere; `Concept` has no rows.
- `aiFeedback`'s `needsReview` flag is computed and then discarded, so a teacher cannot filter
  low-confidence suggestions.
