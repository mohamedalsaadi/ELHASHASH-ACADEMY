# Dhirwa: everything remaining, in order (handoff plan, 2026-11-04)

## Context
Dhirwa (ذروة) is live at https://dhirwa.ae. Done so far: rebrand, Hop intro, teachers by country, `/teach` self-registration, country-first student home, Ziina-only payments, session re-check (5 min), `/api/health`, smoke test (`node scripts/smoke.mjs [url]`), and a Playwright suite on a throwaway Postgres (`npm run e2e`; 98 pass, 2 skipped). The owner has now added `CRON_SECRET` and `APP_URL` (GitHub secrets). Everything below is what is still open. The live step log is `docs/HANDOFF.md`; the six-phase source plan is `docs/platform-gap-plan.md`; the AI-employees detail is `docs/plans/ai-operations.md`.

## Rules that never change (AGENTS.md)
- No push, deploy, merge, DNS change or spending without the owner's yes, asked per action. Stripe stays on test keys. Never run destructive DB commands against the real database; `.env.local` `DATABASE_URL` IS production. Never commit secrets. Never paste keys in chat. Do not work around blocked `vercel env add/rm` or the graphify hook install; the owner does those.
- Arabic first, RTL logical properties, tokens only (no raw hex/px/ms), real numbers only, motion only on marketing pages, honour reduced motion. Never reintroduce A+, Alsaadi, AAcademy, Sabboura.
- Before handing back: `npx tsc --noEmit`, `npm test`, `npm run build`. Commit small, add a line to `docs/HANDOFF.md` after each step. Commit trailer: `Co-Authored-By: Claude <noreply@anthropic.com>` (use the model named in the session).
- Any lockfile change: verify with `npx npm@10 ci --dry-run` (GitHub's Node 22 uses npm 10; npm 11 hides lock errors).

## Step 0: unblock CI (first, small)
1. Commit `c787d17` (lockfile regenerated for npm 10) is local and unpushed. Ask the owner, push to `main`.
2. Watch the `CI` run (repo Actions tab; the repo is private so the API needs auth; the owner screenshots or pastes). If `check` passes but `e2e` fails, download the `playwright-report` artifact. Likely causes, in order: embedded-postgres Linux binary or initdb flags (`--locale=C` may need `C.UTF-8` on Linux), Chrome channel missing (use `npx playwright install --with-deps chromium` and drop `channel: "chrome"` in CI only), port 3200/54329 in use, 45-minute timeout (shard by project if slow).
3. Re-run the `Reminders` workflow by hand (Actions, Reminders, Run workflow). Run #4 failed in 0s with no jobs before the secrets existed. Expected now: a green run, and `curl -i -H "Authorization: Bearer <secret>" https://dhirwa.ae/api/cron/reminders` answering 200 (owner runs this, never paste the secret). If 401: the Vercel `CRON_SECRET` differs or Vercel was not redeployed after adding it (owner: Vercel, Settings, Environment Variables, Production, then Redeploy). Then check `npx vercel logs --environment production --since 15m --query "level:error" --json` (CLI linked in `$TEMP/vl`).
4. Owner still to set in Vercel Production: `GEMINI_API_KEY` (AI is off without it) and confirm `BLOB_READ_WRITE_TOKEN`.

## Phase 1: prove what already exists (owner plus agent, no new features)
- One real live session with a test teacher and student on Daily: schedule, 15-minute and 1-hour reminders (now possible), join, attendance, leave. Fix what breaks.
- Lesson playback on VdoCipher and YouTube after the rebrand.
- Ziina test purchase on a preview (`ZIINA_TEST=1` only off production; production refuses it), then a refund, then a reset email to a real inbox. Owner: add the DMARC TXT record `_dmarc` (`v=DMARC1; p=none; rua=mailto:<inbox you read>`) in Vercel DNS; consider a real support mailbox (root MX currently points at Resend inbound).
- Verify a real signed-in session after the auth change (JWT re-check) and the intro on a slow phone connection (both unverified).
- Register the Ziina webhook `https://dhirwa.ae/api/webhooks/ziina` if not done; Stripe stays hidden and on test.

## Phase 2: simulation and testing (continue; commit each item)
Done: personas and seed (`e2e/seed.ts`, `e2e/personas.ts`), role boundaries, public pages, student home, parent, `/teach` approval, checkout, reset, lesson access. Helpers: `e2e/fixtures.ts`, `e2e/db.ts` (plain `pg`; Playwright cannot import the generated Prisma client; raw SQL timestamps need `now() at time zone 'utc'`).
1. E2E still to add: exam with countdown, homework submit and return, practice, live join (Daily stubbed, `DAILY_API_KEY` is blank in e2e), parent link by code and digest, teacher subjects create and country request approved by admin, invite acceptance, student country picker and "Change country", refund by admin. Each needs seeded rows (exam, assignment, session) added to `e2e/seed.ts` or inserted through `e2e/db.ts`.
2. Money tests: vitest on the pricing engine and ledger (30/70 split on net, VAT off, bundle and coupon discounts, refund reversal); webhook tests posting signed fixtures to `/api/webhooks/ziina` (replay and duplicate delivery must not double-grant); failed-payment path.
3. Load test: about 300 concurrent users on home, course, lesson and live join against a Vercel preview or a local production build, never the live site and never the production DB (k6 or autocannon). Find the first break (DB connections, Daily room creation, cold starts); record numbers in the worklog.
4. Accessibility and RTL: `@axe-core/playwright` on key pages in ar and en, keyboard-only pass, reduced motion, contrast, Arabic line breaks.
5. Safety net (owner accounts needed): Sentry free tier for errors, an uptime monitor on `/` and `/api/health`, a Neon backup restore drill into a branch, a written rollback for launch day. Fix the Postgres SSL-mode warning in production logs (pg driver, `sslmode`).
6. Owner decision pending: the sitewide "New" bar (`src/components/NewsBanner.tsx`) shows every country's courses to an Egypt student; scoping it per country makes the shared layout dynamic.

## Phase 3: live sessions, made good (about 3 days)
Daily cloud recording and a replay for entitled students (new `LiveSession` recording field, additive migration), in-room basics (chat, hand raise, screen share, whiteboard via Daily Prebuilt, mute-all), teacher pre-session room check and fallback link, attendance report for parents.

## Phase 4: embedded software in lessons (about 1 week; owner picks tools)
GeoGebra or Desmos (maths), PhET (science), tldraw or Daily whiteboard; teacher picks a tool in the lesson editor; embeds pass through the `frame-src` allow-list in `next.config.ts`; check RTL, phone width, reduced motion.

## Phase 5: AI employees (about 2 weeks, three drops; needs `GEMINI_API_KEY` and the owner's spending yes)
Drafts first, a human approves. Detail in `docs/plans/ai-operations.md`. Drop 1: `AiRun` table, `/admin/ai` approval queue, 06:00 Gulf daily briefing email. Drop 2: support agent, question generator, draft answers to student questions, auto-mark homework (teacher releases the grade), course-quality check before publish. Drop 3: lesson tutor (5 a day, labelled AI), moderation, payout statements, class insight. Bank-transfer items are void (deleted).

## Phase 6: product gaps (each needs the owner's yes or no)
Certificates (earlier decided out), course reviews and ratings, referral codes, phone-only password recovery, a real support mailbox, store app (Capacitor wrapper of the PWA), WhatsApp notifications (paid).

## Phase 5b: the tiny AI ideas backlog (each is small, one screen or one job; pick in any order after Drop 1)
Every idea obeys: AI drafts, a human approves anything that moves money, shows a grade or speaks in the owner's name; every call is logged in `AiRun` with model, tokens and cost; `AI_ENABLED=false` turns all off; send the model only what the task needs (`maskContacts`, never phones, emails or payment data); answers in the user's locale (Arabic first, Gulf and Egyptian dialect aware, Modern Standard for formal text); AI output is labelled "AI" wherever a student sees it; real numbers only. Cheapest model by default, a stronger one only for marking.

**Student (calm, one tap, no extra screens)**
1. "Explain it simpler" button on any lesson or wrong practice answer: three levels (simple, normal, exam-style), grounded in the lesson text.
2. One-line "why you got this wrong" under each missed practice question when the teacher left no explanation.
3. "Next best 10 minutes": the dashboard shows one suggestion from review schedule, weak concepts and exam date; no plan, no calendar.
4. Spaced-recall nudge: a single question from a lesson seen 3 days ago, answered in the notification or on the home card.
5. Mistake notebook: every wrong answer auto-collected with a one-line AI "rule to remember", exportable as a page.
6. Ten-word lesson summary and three key terms at the top of each lesson (teacher approves once, then it is stored; never regenerated per view).
7. Arabic and English term glossary on hover for science and maths words, so a student switching language keeps up.
8. Voice question: hold a button, speak the question in dialect, get a text answer (later, needs speech-to-text cost approval).
9. Exam-day mode: the last 48 hours show only weak concepts and past questions, nothing new.
10. Gentle streak, no guilt: one quiet line ("3 days in a row") from real activity only; no badges, no leaderboards, no invented social proof.
11. Photo of a handwritten solution graded against the model answer, shown to the teacher first (draft), student sees it only after release.
12. Study-pair icebreaker: none; skipped on purpose (privacy for minors).

**Parent (one weekly message, nothing noisy)**
13. The weekly digest already exists: make it three sentences in the parent's language, with one real number and one suggestion; never a score the teacher has not released.
14. "Ask about my child" box: answers only from that child's own data, refuses everything else.
15. Fee-and-access clarity: a plain statement of what is paid, what expires when, and one tap to renew, drafted from orders; no pressure wording.
16. Exam-week reminder in the parent's language with the child's actual dates.

**Teacher (hours back)**
17. Draft answer to a student question grounded in the lesson; teacher edits and sends (never auto-sent).
18. Question generator from lesson notes into the bank as drafts, with Arabic and English and a difficulty guess.
19. Homework triage: sort the submissions into "clearly fine", "needs a look", "possibly copied" with a one-line reason each; the teacher still releases every grade.
20. Class heat-map in words: "most students lost marks on Unit 2, question type 3", from real attempts.
21. One-click translation of a title, instruction or explanation between Arabic and English, shown as a draft.
22. Lesson-script outline helper: teacher types a topic, gets an outline to record from (not published).
23. Course-quality nudge before publish: missing video, untranslated title, empty unit, price out of range; blocks nothing, owner sees serious ones.
24. Live-session recap: from the recording transcript, a five-line recap and the top three questions asked (after Phase 3 recording exists).

**Owner and admin (the no-staff company)**
25. 06:00 Gulf briefing email: revenue yesterday, pending approvals, open tickets, ungraded homework over 48 hours, failed payments, new signups; numbers from SQL, AI writes only the paragraph.
26. Support triage: category, urgency and a draft reply on every contact message; unsure or money cases go to the owner.
27. Refund assistant: reads the order, policy and history and drafts a decision; the owner clicks refund.
28. Teacher application summary with red flags (missing country, unrealistic subjects, duplicate phone) beside Approve and Reject.
29. Payout statement drafted per teacher from the ledger (30/70 on net) with anomaly flags (refund spike, zero revenue); payment stays manual.
30. Moderation pass on student questions and any future reviews (free OpenAI omni-moderation next to `maskContacts`).
31. Weekly "what broke" digest from Vercel error logs, Sentry and `/api/health` history, in plain words with the likely cause.
32. SEO helper: draft titles, descriptions and Arabic metadata for each course from stored data; no invented claims.
33. Natural-language owner questions ("how many UAE students bought maths this month?") through a read-only database role and Metabase or a fixed set of safe queries, never raw model SQL.
34. Changelog writer: turns `docs/WORKLOG.md` into a short Arabic and English "what is new" note for the site, owner approves.

**Tiny delighters on marketing pages (minimal, no autoplay)**
35. Course page "Is this for me?" three-question helper that points to the right grade and subject; no signup needed.
36. Smart empty states: an empty subject says "coming soon" and offers to notify, never fake cards.
37. Search that understands Arabic spelling variants and mixed Arabic and English queries (hamza, taa marbuta, dialect), built on existing catalogue data first, AI embeddings later (pgvector on Neon).
38. Alt-text and caption drafts for lesson images and covers, for accessibility.

**Build order for this backlog**
Drop 1 foundation first (`AiRun`, `/admin/ai`, kill switch, rate limits via `isLimited` in `src/lib/rate-limit.ts`). Then, cheapest and safest first: 25, 26, 28, 17, 19, 13, 1, 2, 6, 21, 18, 23. Items touching grades, money or minors (11, 19, 27, 29, 14) stay draft-only until the owner flips that kind to automatic. Items needing new spend or vendors (8, 33, 37 embeddings, 31 Sentry) wait for the owner's yes. Evaluate Arabic quality with a small fixed test set (20 to 30 cases per kind, promptfoo or a vitest fixture) before changing models.

## Other open items
- Rebuild the knowledge graph when code changes: `python -m graphify update .` (output in git-ignored `graphify-out/`); the commit hook is not installed (blocked; owner decision).
- Keep `docs/WORKLOG.md`, `docs/HANDOFF.md` and the memory index current; update `docs/platform-gap-plan.md` status table at the top.

## Verification for any step
`npx tsc --noEmit`, `npm test` (194 unit tests), `npm run build`, `npm run e2e` (about 17 minutes; single spec: `npm run e2e -- e2e/<file>.spec.ts --project=en-desktop`), `node scripts/smoke.mjs https://dhirwa.ae` after any deploy, `curl https://dhirwa.ae/api/health` answers `{"ok":true}`, Vercel error logs clean.
