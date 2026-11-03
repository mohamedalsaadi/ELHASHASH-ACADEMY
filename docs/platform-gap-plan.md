# Platform gap plan (2026-11-03)

What is built, what is missing, and the order to close it. Read with `docs/launch-checklist.md` (unverified items and
owner actions) and `docs/WORKLOG.md`. Nothing here is started; every phase needs the owner's yes.

## 1. Where it stands (from the code and Vercel, not memory)

| Area | State |
|---|---|
| Live sessions | Built on Daily.co: rooms and meeting tokens (`src/lib/daily.ts`), a join page with countdown (`live/[id]`), attendance rows, teacher scheduling, 15-minute and 1-hour reminders. **Not verified end to end**, and `DAILY_API_KEY` is set in production. No recording or replay: `LiveSession` has no recording field. |
| Video | VdoCipher (DRM) and YouTube embeds. Playback not re-tested since the rebrand. |
| In-lesson tools (embedded software) | None. No whiteboard, graphing, equation or simulation tool inside lessons or live rooms. |
| AI | `src/lib/ai.ts` (one Gemini call, kill switch), homework grading suggestion, AI-written parent report, AI draft replies to contact tickets. **`GEMINI_API_KEY` is not in the production variable list I could read, so none of it runs.** No `AiRun` log, no approval queue, no tutor, no question generator, no daily briefing. |
| Scheduled jobs | One daily Vercel cron. **`CRON_SECRET` is not in the production list either, so `/api/cron/reminders` answers 401: live reminders, expiry notices and the parent digest are not running.** (The checklist says it is set; check in Vercel.) |
| Tests | 26 unit test files (pricing, access, exams, schemas). **No browser, end-to-end, load, accessibility or restore tests.** The signed-in screens (teacher, admin, student, parent, checkout) have never been clicked through by a script, and the seeded accounts are locked. |
| Monitoring | Server-side behaviour events only (`analytics.ts`). No error tracking, no uptime alert, no log alerts. |
| Open security item | Deleted or demoted accounts keep access until the 7-day cookie expires. |
| Not built | Certificates, reviews and ratings on courses, a student mobile app (the PWA exists), phone-only password recovery, referral or affiliate. |

## 2. Plan, in order

### Phase 1: switch on and prove what already exists (about 2 days; no new features)
1. Set `CRON_SECRET` (and the 10-minute external scheduler, per the checklist), `GEMINI_API_KEY`, and confirm
   `BLOB_READ_WRITE_TOKEN` in Vercel production. Owner action; I verify afterwards from the logs.
2. Run one real live session with a test teacher and a test student: schedule, reminder, join, attendance, leave.
3. Click through VdoCipher and YouTube playback, a Ziina test purchase on a preview, a refund, a password reset email.
4. Fix whatever breaks. This closes most of the "Not verified" list in the launch checklist.

### Phase 2: full simulation and testing (about 4 to 5 days)
1. **Test environment:** a Neon branch as the test database, a Vercel preview, personas seeded by a script
   (admin, two teachers in two countries, students in each country, a parent), Ziina in test mode on the preview only.
2. **Playwright end-to-end suite**, run in `ar` and `en`, phone and desktop: sign-up, sign-in, country-first student
   home, course purchase, access granted, lesson playback, practice, exam with the countdown, homework submit and
   return, live join, parent linking and digest, teacher registration and admin approval, teacher country request,
   refund, password reset.
3. **Role-boundary tests:** every admin, teacher and parent URL requested as the wrong role must be refused; one
   account on two devices; stale-session behaviour (and the fix for it).
4. **Payment and money tests:** the 30/70 split on net, discounts and bundles, refunds, webhook replay and duplicate
   delivery, a failed payment.
5. **Load test:** 300 concurrent students on the home page, course page, lesson page and a live join; find the first
   thing that breaks (database connections, Daily room creation, cold starts).
6. **Accessibility and RTL pass:** keyboard-only, screen-reader landmarks, reduced motion, contrast, Arabic line breaks.
7. **Safety net:** Sentry (free tier) for errors, an uptime check on the home page and `/api/health`, a Neon backup
   restore drill into a branch, and a written launch-day rollback.
8. Wire the suite into GitHub Actions so every push to `main` runs types, unit tests, build and the end-to-end suite
   before it counts as shippable.

### Phase 3: live sessions, made good (about 3 days)
- **Recording and replay:** Daily cloud recording on, the file stored against the session, a replay for entitled students.
- **In-room basics:** chat, hand raise, screen share and whiteboard via Daily Prebuilt settings; teacher mute-all and
  remove; a no-show and late-join rule; attendance report for parents.
- **Reliability:** pre-session room check for the teacher, a fallback link if the room fails, reminders every 10 minutes.

### Phase 4: embedded software inside lessons (about 1 week; scope needs the owner)
Choose from this menu (each is a free embed or small library, no new vendor contract):
- **Maths:** GeoGebra or Desmos graphing and equation editor inside a lesson or question.
- **Science:** PhET simulations (physics, chemistry, biology) as lesson blocks.
- **Whiteboard:** tldraw or the Daily whiteboard, saved with the lesson.
- **Code or tables:** only if you teach computing.
- Teacher picks a tool in the lesson editor; embeds go through the existing `frame-src` allow-list and are checked for
  Arabic/RTL, phone width and reduced motion.

### Phase 5: AI employees (about 2 weeks, in three drops)
The rule from before holds: **drafts first, a human approves**, nothing that moves money or shows a grade without a click.
- **Drop 1, foundation:** `AiRun` log table (what, which model, tokens, cost, status), an admin approval queue
  `/admin/ai`, a daily briefing email to the owner at 06:00 Gulf time (SQL numbers, AI writes the summary), and an
  alert when a ticket or request is waiting.
- **Drop 2, work taken off people:** support agent answering from the FAQ and the person's own orders (draft or send,
  uncertain cases to the owner); AI question generator from lesson notes into the bank as drafts; draft answers to
  student questions for the teacher; auto-mark homework on submit (the teacher still releases the grade);
  AI course-quality check before a teacher publishes.
- **Drop 3, depth:** lesson tutor for paying students (labelled AI, grounded in lesson text, 5 a day), moderation of
  questions and reviews, teacher payout statements drafted from the ledger, class insight for teachers.
- Old plan item dropped: bank-transfer matching (bank transfer was deleted when Ziina became the only gateway).
- Cost: roughly 30 to 150 USD a month of model use at current volume, logged per run. Spend needs the owner's yes.

### Phase 6: product gaps to decide (each needs a yes or a no)
Certificates (earlier decided out), course reviews and ratings, referral codes, phone-only password recovery, a real
mailbox for support, a store app (Capacitor wrapper of the PWA), WhatsApp notifications (paid).

## 3. What I need from the owner
1. Set `CRON_SECRET`, `GEMINI_API_KEY` and confirm the Blob token in Vercel (or say so and I give exact steps).
2. Two test phones or emails for the simulation personas, and a real teacher friend for one live-session test.
3. Which embedded tools (Phase 4 menu), and yes or no on each Phase 6 item.
4. Go-ahead on Phase 1 and 2 first; Phases 3 to 5 follow once those are green.
