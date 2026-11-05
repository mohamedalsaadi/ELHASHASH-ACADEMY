# Dhirwa: the 60-item hardening and improvement list

## Context

A full audit of security, data correctness, privacy, reliability, UX, SEO and documentation, plus a
dependency scan. Every item below was found in the actual code, with a file and a line; nothing here
is generic advice. Severity is about consequences, not effort:

**S1** = money, minors' data, or access control. **S2** = wrong numbers shown to users, or an outage
risk. **S3** = quality and polish. **S4** = hygiene.

Effort: **S** ≤ 1h · **M** half a day · **L** a day or more. **Owner** marks things only you can do
(dashboards, DNS, spending).

Dependencies are clean except where noted: **`npm audit` reports 12 vulnerabilities, 5 high** —
`zod` (memory exhaustion while validating oversized collections), `postcss`/`next` (XSS in CSS
stringify), and the `@vercel/blob` → `@vercel/oidc` chain.

---

## A. Security and access control

| # | Sev | Effort | Item |
|---|---|---|---|
| 1 | **S1** | M | **Anyone signed in can sit a published exam without buying the course.** `courses/[slug]/exams/[examId]/page.tsx:26-53` and `exams/actions.ts:15-44` never call `grantsFor`, unlike lessons, practice and assignments. A free account gets the full paper and a graded attempt. Add the same grant check the lesson page uses. |
| 2 | **S1** | S | **The parent-link code is brute-forceable.** `parent/actions.ts:13-35`: six digits, 15-minute window, unlimited attempts, and success exposes a minor's grades, homework and payment history. Add `isLimited("link:<userId>", 10, 15 min)` and compare hashes with `timingSafeEqual`. |
| 3 | **S1** | M | **A password reset does not log anyone out.** `auth.ts:62-67` re-reads only `role`; tokens live 7 days. After a compromise, resetting the password changes nothing for the attacker. Store `passwordChangedAt`, carry `iat` in the token, reject older tokens in the `jwt` callback. |
| 4 | **S2** | S | **Login throttling is per-account only** (`auth.ts:43-48`): password spraying across accounts is unlimited, and anyone can lock a victim out for 15 minutes. Add an IP-keyed limit and exponential backoff. |
| 5 | **S2** | S | **CSV injection in both exports.** `lib/csv.ts:2` only doubles quotes; a student named `=cmd|' /C calc'!A0` executes in Excel. Prefix any cell starting with `= + - @` with `'`. |
| 6 | **S2** | M | **The CSP mitigates nothing.** `next.config.ts:25-28` sets only `frame-ancestors`/`frame-src`; there is no `default-src`, `script-src`, `object-src`, `base-uri` or `form-action`. Add a nonce-based policy generated in `middleware.ts`. |
| 7 | **S2** | S | **Unlimited blob-upload tokens.** `api/blob/upload/route.ts:27-69` mints a 20 MB token per request with no counter; one student can fill the store. Rate-limit per user. |
| 8 | **S2** | S | **Password policy is weak and silently truncated.** `lib/schemas/auth.ts:11` allows 8 characters; bcrypt ignores bytes past 72, so two different long passwords are the same password. Enforce 12–72 in all three places (signup, reset, change). |
| 9 | **S2** | S | **Email verification is collected but never enforced** (`auth.ts:45-51`): anyone can register with an address they do not own and take receipts there. Refuse sign-in (or gate checkout) until verified. |
| 10 | **S2** | S | **Signup tells attackers which emails and phones exist** (`signup/actions.ts:82`, `teach/actions.ts:27-30`). Answer neutrally and send the notice by email instead. |
| 11 | **S2** | S | **Teacher bios bypass contact masking.** `teacher/profile/actions.ts:12-33` writes raw text rendered publicly, while questions and support run `maskContacts`. Pipe bios through it. |
| 12 | **S2** | S | **Rate-limit keys trust the client's `X-Forwarded-For`** (`signup`, `contact`, `teach`, `invite`, `OneDevice`). On anything that does not overwrite the header, every limit is spoofable. Read the platform's trusted client-IP header. |
| 13 | **S2** | S | **Phone-only accounts can never reset a password.** `forgot/actions.ts:11` accepts email only, but invites and approvals create phone-only teachers. Accept a phone, or give the admin a "send reset" button. |
| 14 | **S2** | S | **The Gemini key travels in a URL query string** (`ai.ts:46`), so it lands in every proxy log. Send `x-goog-api-key` as a header. |
| 15 | **S3** | S | **No limit on changing the password from a stolen session** (`account/actions.ts:61-69`), nor on resending the verification email (`:72-76`). Two `isLimited` calls. |
| 16 | **S3** | S | **Parent pages trust the JWT role, not the database**, so a demoted parent keeps read access for up to five minutes. Add a `requireParent` that reads the row, like `requireStaff`. |
| 17 | **S3** | S | **`/api` sits outside the pre-launch password gate** (`middleware.ts:10-11,44`): covers, avatars and health are reachable before launch. Allow-list the three webhook paths only. |
| 18 | **S3** | S | **The Ziina webhook is unauthenticated and triggers an outbound API call** (`webhooks/ziina/route.ts:12-31`). Rate-limit per IP or require a shared token. |
| 19 | **S3** | S | **The rate limiter races**: `count` then `create` is not atomic (`rate-limit.ts:4-13`), so N parallel requests all pass. One `INSERT … SELECT … WHERE count < max`, or document the ceiling. |
| 20 | **S3** | S | **Avatar enumeration**: `api/avatars/[userId]` serves any user id. Restrict to staff roles. |
| 21 | **S3** | S | **HSTS has no `preload`** and `Permissions-Policy` misses `payment`, `usb` (`next.config.ts:19-23`). |
| 22 | **S3** | S | **Promotion links accept any HTTPS origin** (`admin/actions.ts:265-270`), so a compromised admin account can post an off-site phishing link on the public home. Restrict to `siteUrl`. |
| 23 | **S2** | S | **Bump vulnerable dependencies**: `zod` (high), `next`/`postcss` (high), `@vercel/blob` chain (high). Verify each advisory before choosing the version. |

## B. Data correctness — numbers users see are wrong today

| # | Sev | Effort | Item |
|---|---|---|---|
| 24 | **S2** | S | **The XP leaderboard double-counts.** `PracticeAttempt.xp` stores the *cumulative* total (`practice/actions.ts:66`, `review/actions.ts:75,86`) while `leaderboard/page.tsx:42` sums it, so five 5-XP runs count as 75 instead of 25. Store the delta. |
| 25 | **S2** | S | The same value is labelled **"XP earned"** on `practice/page.tsx:88` and `review/page.tsx:58,69`. Fixed by #24, not by editing the readers. |
| 26 | **S2** | S | **`LessonView.watchedSec` is read but never written** (`schema.prisma:715`, rendered at `admin/subscribers/[id]/page.tsx:215`), so admin always shows "0 minutes". Write it from the player or drop the column. |
| 27 | **S2** | M | **Exam marks are excluded from every average.** `teacher/analytics/page.tsx:29-30` and `parent/children/[studentId]/page.tsx:37` build averages from homework only, so "weakest unit" is computed on a partial transcript. Union graded `ExamAttempt` rows in. |
| 28 | **S2** | S | **A future-dated entitlement counts as owned on `/me` but locked on the dashboard.** `student-home-server.ts:56-60` filters on `endsAt` only; add `startsAt: { lte: now }` as `dashboard/page.tsx:51` already does. |
| 29 | **S2** | S | **Admin subscriber dates render in Cairo while access ends in the course's zone** (`admin/subscribers/page.tsx:36`, `[id]/page.tsx:56`), so a Kuwaiti student's end date can show a day early. Thread the course zone through. |
| 30 | **S3** | S | **Notification timestamps are pinned to Cairo** (`notifications/page.tsx:37`) while orders use Dubai and `formatWhen` uses the course zone. One helper, three call sites. |
| 31 | **S3** | M | **Untranslated content renders blank, not the other language.** `ar ? titleAr : titleEn` is used raw in ~15 places; only teacher bios fall back. Add one `pick()` helper and use it everywhere. |
| 32 | **S3** | S | **Course structured data truncates 3-decimal currencies** (`courses/[slug]/page.tsx:234`): 3.750 KWD is published to Google as `3.75`. Use `minorPerUnit`. |
| 33 | **S3** | M | **`Concept` and `QuizAttempt` are dead models** (`schema.prisma:676-710`) with cascading FKs and no reader or writer. Delete them, or wire them. |

## C. Privacy, minors and legal

| # | Sev | Effort | Item |
|---|---|---|---|
| 34 | **S1** | M | **Student work is sent to Google AI, undisclosed and unconsented.** `ai-grading.ts:45-70` uploads the child's answer and up to three photos of handwritten homework on every submission; the privacy policy's processor list (`privacy/page.tsx:44-49`) names Neon, Vercel, Ziina, VdoCipher, Resend, Daily — not Google. Add Google to the policy **and** make automatic grading opt-in per course. |
| 35 | **S1** | S | **The privacy policy says "strictly necessary cookies only, no analytics"** (`privacy/page.tsx:52-58`) while `analytics.ts` writes per-user events keyed by a device cookie. Either stop keying anonymous traffic or rewrite the section. |
| 36 | **S2** | M | **Guardian consent is claimed but not collected at signup.** The policy says under-18s join with a guardian's consent; `signupSchema` has no age or consent field, and `GuardianConsent` only exists for live lectures. Add a consent checkbox at signup, or reword the policy to match. |
| 37 | **S2** | S | **Recording consent is unaddressed.** Nothing stops a participant screen-recording a live class; the terms forbid students recording content but not participants in a meeting. Add a plain sentence to the live rules and the terms. |

## D. Reliability and operations

| # | Sev | Effort | Item |
|---|---|---|---|
| 38 | **S2** | S | **Only one outbound `fetch` has a timeout** (`ziina.ts:21`). Gemini, Resend, Paymob, VdoCipher and Blob can hang a server action until the platform kills it. Add `AbortSignal.timeout(10_000)` to each. |
| 39 | **S2** | S | **`createNotification` awaits Resend inside the request path** (`notify.ts:22,50`), and `notifyAdmins` loops admins sequentially. A slow mail provider stalls the user's action and the cron. Move the send into `after()`. |
| 40 | **S2** | S | **Every scheduled job is switched off**: `vercel.json` has no crons and `reminders.yml` has no `schedule:`. Expiry notices, live reminders, the parent digest, the owner briefing and the 180-day analytics purge never run. Re-enable one scheduler. |
| 41 | **S2** | S | **No error monitoring at all.** The only signals are `console.error` at 15 sites and an error boundary nobody watches. See G1. |
| 42 | **S2** | S | **CI never runs the linter.** `ci.yml:21-23` runs tsc, tests and build; `npm run lint` exists and is configured but no job invokes it. |
| 43 | **S2** | S | **Never restored a backup.** A Neon restore drill into a branch has not been done, so the recovery path is unproven. |
| 44 | **S3** | M | **60 pages are `force-dynamic` with only 9 loading boundaries**, so most teacher/admin/account navigations show a dead screen until the query returns. Add `loading.tsx` using the existing `PageSkeleton`. |
| 45 | **S3** | S | **`/courses` is forced dynamic for no reason** (`courses/page.tsx:13`); it is a pure catalogue read. `revalidate = 300`. |
| 46 | **S3** | S | **`generateMetadata` duplicates the page query** on course and teacher pages (Prisma is not deduped like `fetch`). Wrap the loader in React `cache()`. |
| 47 | **S3** | S | **Fix the Postgres SSL-mode warning** in the production logs, and confirm `sslmode` is explicit in the connection string. |

## E. User experience and accessibility

| # | Sev | Effort | Item |
|---|---|---|---|
| 48 | **S3** | S | **The leaderboard marks "this is you" with colour only** (`leaderboard/page.tsx:71-73`). Append the existing `you` string or an `aria-current`. |
| 49 | **S3** | S | **`LessonMarks` conveys state with no text alternative** (`ui/progress.tsx:95-107`): every mark is `aria-hidden`. Add an `sr-only` word per item. |
| 50 | **S3** | S | **Cover images have no dimensions and no lazy loading** (`CourseCard.tsx:26`), so grids fetch full-resolution covers. Add `width`/`height`, `loading="lazy"`, `decoding="async"`. |
| 51 | **S3** | S | **Flag images in `/me` have no height lock** (`me/page.tsx:60,124`), shifting the row on load. Give explicit dimensions. |
| 52 | **S3** | S | **`MobileNav` can trap the page**: if the dialog is open and the window widens past `md`, it becomes `display:none` while still in the top layer, leaving the page inert. Close it on a `matchMedia` change. |
| 53 | **S3** | S | **Hover transforms survive `prefers-reduced-motion`** (`globals.css:74-77,92-94`). Move them into the existing `no-preference` block. |
| 54 | **S3** | S | **The exam timer auto-submits with no accessible warning** (`ExamTimer.tsx:17,31`). Announce once at 5 minutes and once at 1. |
| 55 | **S3** | S | **11 tap targets on the home page are under 44px** (measured in the 2026-11-01 benchmark). Audit and enlarge. |
| 56 | **S3** | M | **No search outside the catalogue.** A student cannot search their own lessons, homework or questions; a teacher cannot search their roster. One box, scoped by role. |

## F. SEO and discoverability

| # | Sev | Effort | Item |
|---|---|---|---|
| 57 | **S2** | S | **`/me` is indexable and claims the public home's canonical** (`me/page.tsx:22-25`). Add `robots: { index: false, follow: false }`. |
| 58 | **S3** | S | **`robots.ts` misses `/*/me`, `/*/review`, `/*/invite`** and the private nested course routes. |
| 59 | **S2** | S | **The sitemap omits the three highest-intent page types**: subject pages, teacher pages and `/teach`. |
| 60 | **S2** | S | **`/teach` is `noindex`** — the teacher-recruitment landing page cannot be found by search engines. Drop it, add alternates and a sitemap line. |
| 61 | **S3** | S | **Teacher pages emit no canonical, hreflang or OG image**, so `/ar/teachers/x` and `/en/teachers/x` are unrelated documents. |

## G. Third-party services (each needs your yes)

| # | Cost | Replaces / adds |
|---|---|---|
| G1 | Free tier | **Sentry** — error monitoring with stack traces and release tags. Replaces `console.error` as the only signal. This is the single highest-value paid-tier-free item. |
| G2 | Free tier | **Uptime monitor** (Better Stack or UptimeRobot) on `/` and `/api/health`, which already returns 503 when the DB fails. |
| G3 | Free | **Cloudflare Turnstile** on signup, contact and `/teach`. Replaces hand-rolled rate limits as the first line against bots, without a CAPTCHA image. |
| G4 | Free tier | **Supabase Auth (or Clerk / Auth.js)** — what you asked about. Replaces the hand-rolled auth: passkeys, Google/Apple sign-in, MFA, session revocation on password change (#3), email verification (#9), and password policy enforcement (#8) become configuration rather than code. **Trade-off:** a migration of every user and the parent/teacher role model, and a new processor to disclose in the privacy policy (#34). Worth it only if you want OAuth and MFA; the security items in section A are cheaper without it. |
| G5 | Free tier | **Upstash Redis** for rate limiting. Removes the race in #19 and the `AuthAttempt` table churn. |
| G6 | ~$10–20/mo | **A real support mailbox** on the domain, with DMARC and SPF. Today the root MX points at Resend inbound and the reply-to is a placeholder. |
| G7 | Free tier | **Neon branching** for a scheduled restore drill (#43): branch production nightly, run a smoke query, delete. Turns "we have backups" into "we have proven backups". |
| G8 | $0–20/mo | **Cloudflare in front** of Vercel: WAF, bot rules, DDoS, and image resizing for #50. |
| G9 | Paid | **WhatsApp Business API** for reminders. Only worth it when the cron actually runs (#40) and only for parents who opt in. |
| G10 | Paid, blocked | **Stripe live keys** — still on test by your rule; needs the paperwork. Ziina remains the only live gateway. |

## H. Documentation and hygiene

| # | Sev | Effort | Item |
|---|---|---|---|
| 62 | **S3** | S | **`DESIGN.md` §3 colour table is entirely wrong** (previous brand: blue primary, grey ground) and contradicts §0 and `tokens.css`. A new developer reads §3 first. |
| 63 | **S3** | S | **`README.md` is untouched `create-next-app` boilerplate** — wrong fonts (says Geist), wrong file paths, offers yarn/pnpm for an npm-10 repo. Rewrite in five lines. |
| 64 | **S3** | S | **`docs/HANDOFF.md` contradicts itself**: one entry says live is still visible, the next says it is gated. Strike the stale sentence. |
| 65 | **S3** | S | **`.env.example` drift**: still says `Sabboura` (a banned name), and omits `AI_ENABLED`, `AI_MODEL`, `SEED_STUDENT_PASSWORD`. |
| 66 | **S4** | S | **Stale comments that now lie**: `schema.prisma:834` says nothing writes the AI columns (it does), and the confidence comment promises a class pulse that does not exist. |

---

## Suggested order

1. **Today, without a decision from you:** #1 (exam access), #2 (link brute force), #3 (reset
   sessions), #5 (CSV injection), #24 (leaderboard XP) — all S1/S2, all small.
2. **This week:** the rest of section A that is S, then #34 and #35 (privacy truth), #40 (cron),
   #41/#G1 (Sentry), #43 (restore drill).
3. **Then:** section B to completion, then E and F.
4. **Only with your yes:** everything in section G.

## Verification, per item

Whatever gets built lands the usual way: `npx tsc --noEmit`, `npm test`, `npm run build`, a Playwright
spec for the touched surface in `ar` and `en`, and a worklog line. Security items get a test that
fails before the fix — for #1, an e2e that a signed-in user without a grant cannot open an exam; for
#2, that the eleventh wrong code is refused.
