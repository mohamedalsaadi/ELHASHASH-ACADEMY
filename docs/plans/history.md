# Earlier plans (history)

Saved 2026-11-04 for agents continuing the work. All of these are built and live unless WORKLOG.md says otherwise:
teachers by country and /teach (live 2026-11-03), email checklist (open: DMARC record, real support mailbox),
intro (replaced by the Hop intro), Dhirwa rebrand, name search, student home. The AI operations plan is open and
lives in `ai-operations.md`. Current priorities: `docs/platform-gap-plan.md`.

## Teachers by country, a country-first student ride, and teacher self-registration

## Context
- Email now works (owner confirmed 2026-11-03). The owner asked for four things:
  1. Commit and deploy the mail diagnostics already written (item 4).
  2. Teachers choose their country and create their own subjects; adding another country shows that country's subjects and needs admin approval.
  3. The student roller-coaster is messy: it must ask the country first, then show that country's subjects.
  4. Teachers register themselves; the admin only approves; the registration names the countries of the intended subjects.
- New request while planning: make the home intro the brand logo itself, drawn in 3D (Step 0b below). Suggested order: Step 0, then Step 0b (it is the most visible), then Steps 1 to 4, each deployed separately on the owner's yes.
- Owner's answers: the ride asks the country **once and remembers it** (with a "Change country" link); a teacher's **new subject in a country they already teach in is instant**, no approval.
- Findings that shape the design (from the code):
  - A teacher's countries are not stored: `teacherCountryIds` (`src/lib/staff.ts:44`) derives them from `TeacherSlot` rows. A brand-new teacher has no country, so "choose own country" and "request another country" need a stored grant.
  - `Subject` is global (no country); a subject belongs to a country only through `GradeSubject` (`prisma/schema.prisma:219`). Only admins can create subjects and `GradeSubject` rows (`admin/actions.ts` 649, 741).
  - Invites already create a teacher: `issueInvite` (`src/lib/invites.ts`) and `acceptInvite` (`invite/[token]/actions.ts`, writes `TeacherSlot`). There is no self-registration, no PENDING/APPROVED enum, and `notifyAdmins` (`src/lib/notify.ts`) is the existing admin alert.
  - The ride is already scoped to one grade and country (`getStudentHome`, `src/lib/student-home-server.ts`); it never asks. Mess comes from cars overlapping on phones, `small` read once, the chip row wrapping, and the lede counting empty subjects (`Ride.tsx`, `ride-scene.ts`, `me/page.tsx`).

## Step 0: commit and deploy the mail diagnostics (item 4, as asked)
- Files already in the tree: `src/lib/mail.ts`, `forgot/actions.ts`, `admin/settings/{page.tsx,MailTest.tsx,mail-test.ts}`, `messages/{ar,en}.json`. Type check, 183 tests and build passed.
- Commit alone ("Log mail results and add an admin test email"), push to `main`, wait for the Vercel deploy of `elhashash-academy`, then press the new "Send a test email" button on `/admin/settings` and confirm `[mail] sent` in the logs.

## Step 0b: the intro becomes the brand logo, drawn in 3D (owner's new request)
The owner wants the intro to be **the logo itself**: the three ridge lines drawn exactly as in the brand mark, then the gold sphere comes out on top. Pixar-minimal. This replaces the solid mountain and the flag. Skills: three.js (geometry, materials, lighting, animation), design-dna (update the JSON and DESIGN.md §6), genjutsu cast (interaction thesis below, then a quick audit).

**Interaction thesis (for the owner to validate by seeing it live):** *the logo draws itself, then its summit is born.* Allowed patterns: the three ridge strokes drawn outer to inner; one gold sphere that emerges from the peak with squash and stretch; a slow breathing afterwards; nothing else moves. Not allowed: flags, extra colours, particles, bounce on the lines.

**Exact geometry, nothing redrawn.** Reuse `RIDGES`, `SUMMIT`, `RIDGE_WIDTH` and `MARK_VIEWBOX` from `src/app/brand-svg.ts` (the file `Mark.tsx` and every icon already share), so the intro and the logo can never drift. Each ridge is two cubic Béziers on a 64 × 48 grid; convert SVG coordinates to scene units (x − 32, 43 − y, one scale), sample them with a three.js `CurvePath` of `CubicBezierCurve3`, and build `TubeGeometry` with radius `RIDGE_WIDTH / 2` and round caps (small spheres at both ends), so the line weight equals the logo's.

**Sequence (4.0 s, same `SUMMIT_END`, copy still rises at 3.2 s):**

| Time | What happens | Easing |
|---|---|---|
| 0.15–1.35 s | Outer ridge draws foot to foot (tube `drawRange`); a small snow dot leads the line | brand `--ease-out` |
| 0.45–1.65 s | Middle ridge draws, 0.3 s after the first | same |
| 0.75–1.95 s | Inner ridge draws | same |
| 2.1–2.4 s | Beat of stillness; the three lines glow once, softly | ease-in-out |
| 2.4–3.5 s | The gold sphere is born at the outer peak, stretches up to the logo's summit position (32, 6.5), overshoots a hair, squashes and settles (Pixar squash-and-stretch, about 8 percent) | spring-like cubic, no bounce on lines |
| 3.5 s on | Idle: the sphere breathes (about 2 percent scale, 5 s loop) and floats a few hundredths; pointer parallax tilts the whole mark slightly | sine |

**Look (Pixar minimal):** soft studio light (cool sky fill, one warm key, pale rim); snow-white tubes with a slight sheen so they read as rounded objects, not flat strokes; a glossy gold sphere (clearcoat, small emissive so it glows on the night map) with a faint halo; no floor, no extra geometry. Camera is nearly frontal with a gentle tilt, so the silhouette matches the logo exactly in the final frame.

**Framing:** keep the existing measured fit in `summit-scene.ts` (free area beside `.as-hero-copy`; above it on a phone), with the logo's bounding circle in place of the mountain's.

**Files:** rewrite `src/components/three/summit-scene.ts` (same `createSummit` signature and `{render, resize, dispose}`), `Summit.tsx` (colours back to `line` = `contour-6` and `summit`), no change to `Intro.tsx` or `brand.css` timings. Update `DESIGN.md` §6, `docs/brand/dhirwa-dna.json` (`home_intro`) and `docs/WORKLOG.md`. Reduced motion shows the finished logo; skip, off-screen pause and the 4.4 s guard are unchanged.

**Verify:** headless captures at 0.8, 1.6, 2.6, 3.2 and the final frame, laptop (ar and en) and phone; overlay the final frame on the brand SVG to confirm the strokes match; check no overlap with the headline; `tsc`, tests, build; deploy only on the owner's yes (it replaces the live intro).

## Step 1: data model (additive migration only, nothing dropped)
- `TeacherCountry` (userId, countryId, approvedById?, createdAt; unique userId+countryId). The stored grant. Migration also back-fills it from existing `TeacherSlot` rows so current teachers keep working.
- `TeacherCountryRequest` (userId, countryId, note, status PENDING/APPROVED/REJECTED, decidedById?, decidedAt?). One pending row per user+country.
- `TeacherApplication` (name, email?, phone?, passwordHash, locale, bio, subjectsNote, status PENDING/APPROVED/REJECTED, reviewedById?, reviewedAt?, rejectReason?) plus `TeacherApplicationCountry` (applicationId, countryId).
- New enum `ApprovalStatus { PENDING APPROVED REJECTED }`; add notification kind `TEACHER_REVIEW` (or reuse SYSTEM).
- `teacherCountryIds` becomes the union of `TeacherCountry` and slot-derived countries; `assertSlot` is unchanged otherwise. Applying the migration to the real Neon database is additive; I will ask before running it in production and apply it before the deploy that uses it.

## Step 2: teachers choose country and create subjects (item 2)
- New page `src/app/[locale]/teacher/subjects/page.tsx` (+ `TeacherNav.tsx` entry, `actions.ts`):
  - **Country step first** (auto-selected when the teacher has one country), then that country's grades with their current subjects.
  - **Create a subject**: name (ar/en), icon from the existing list, tick the grades of that country it belongs to. The action (teacher-gated with `requireStaff`, country checked against `teacherCountryIds`) generates the slug (model: `freeSlug`, `admin/actions.ts` ~556), upserts the `Subject` (reuses an existing subject of the same slug), adds `GradeSubject` rows with an add-only upsert (never `setGradeSubjects`' delete-all), and grants the teacher the matching `TeacherSlot`s. Validation in a new `src/lib/schemas/` zod schema with a test.
  - **Add another country**: a picker of active countries the teacher does not have. Choosing one shows that country's grades and subjects read-only, a short note field and "Request access". It writes a `TeacherCountryRequest` (PENDING) and calls `notifyAdmins` (new `dedupeKey` per request, `href` to the teachers admin page). The teacher sees "Waiting for approval" and gets a notification on the decision.
- `teacher/page.tsx` course form: add the country select before the grade/subject select (client filter on the data it already loads).
- Admin: `admin/teachers/page.tsx` gets a "Country requests" block: Approve (creates `TeacherCountry`, notifies the teacher) or Reject (with a reason). Reuses the notification and email helpers.

## Step 3: country-first roller-coaster (item 3)
- New `src/app/[locale]/me/actions.ts` with `setCountry` (validates against active countries, sets cookie `ride_country`, one year, lax, revalidates `/me`) and `clearCountry`.
- `me/page.tsx`: read the cookie. Resolve with a small **pure** helper `resolveCountry(cookie, gradeCountry, activeCountries)` in `src/lib/student-home.ts` returning `ask | auto | use` (single active country skips the step). `ask` shows the country step (reuse `CountryTile`, given an optional form-action mode, `src/components/CountryTile.tsx`); `use` shows the ride.
- If the student's saved grade belongs to the chosen country, use it; otherwise show only that country's grades (reuse `GradePicker` filtered to one group, then `updateGrade`). `getStudentHome` gets an optional `gradeId`; everything downstream is unchanged.
- Tidy the ride: cap cars at 8 (rest reachable by chips and rows), lede counts only subjects with courses, recompute `small` on resize and rebuild (`Ride.tsx:41,127`), bigger loop and softer back cars on phones (`ride-scene.ts` ~88, 192), chip row becomes one scrollable line on small screens, and a visible "Change country" link in the hero.
- Strings in `messages/{ar,en}.json` (`me.pickCountry`, `me.changeCountry`, `me.pickGradeIn`).

## Step 4: teacher self-registration with admin approval (item 4 of the owner's list)
- New public page `src/app/[locale]/teach/page.tsx` (+ `TeacherApplyForm.tsx`, `actions.ts`), linked from the footer and the signup page. Fields: name, email, phone, password, **countries of the intended subjects (at least one)**, subjects (text), short bio. Action modelled on `signup/actions.ts`: zod schema, rate limit by IP, refuses an email or phone that already has an account or a pending application, hashes the password with the same helper as signup, stores a `TeacherApplication` (PENDING), `notifyAdmins`, and a confirmation email to the applicant. The applicant stays unable to sign in as a teacher until approved.
- Admin: `admin/teachers/page.tsx` "Applications" block lists PENDING applications with countries, subjects and bio. **Approve** runs one transaction that creates the `User` as INSTRUCTOR with the stored hash, writes `TeacherCountry` rows for the requested countries, and marks the application APPROVED, then emails "you are approved, sign in". **Reject** stores a reason and emails it. The grant logic is extracted from `acceptInvite` into one shared helper so invites and applications cannot drift.
- Existing invites keep working unchanged.

## Out of scope, decided
- No change to prices, payments or the database contents of existing courses. `Subject` stays global. Students are not asked for a country anywhere else.
- Teacher accounts that exist today keep every current access (back-filled grants).

## Verification
- `npx tsc --noEmit`, `npm test` (new tests: country resolver, subject input schema, application schema), `npm run build`, with the preview stopped and `.next` cleared around the build.
- Browser pane, `ar` and `en`, phone and desktop, with test data only: (a) a teacher with one country creates a subject and sees it on the course form; (b) a request for a second country shows that country's subjects, appears for the admin, and after approval the teacher can use it; (c) a self-registration lands as PENDING, cannot sign in, and after approval can; (d) a student with no cookie sees the country step, picks, sees only that country's ride, and "Change country" returns to the step; (e) the ride on a 390 px phone does not overlap; no console errors.
- No destructive database command; migrations are additive and applied only with the owner's yes. Stripe stays on test. Push and deploy only on the owner's yes, in this order: migrate, then deploy.

---

## Earlier plan: Email that actually reaches inboxes: a checklist for Resend, with a fallback

## Context
- Password-reset email still does not arrive on dhirwa.ae. The owner asked for one feasible plan listing every key, record and small setting to fill, change or add.
- What I verified, read-only:
  - Production already has `RESEND_API_KEY`, `MAIL_FROM` and `APP_URL=https://dhirwa.ae`.
  - The earlier error (Resend 422 "Invalid `from` field") is gone. No mail error has been logged since the fix (`4c275ac`), so Resend is now accepting the request.
  - DNS for dhirwa.ae has the DKIM key (`resend._domainkey`) and the Resend return-path records on `send.dhirwa.ae` (SPF and feedback MX).
  - **No DMARC record** and **no root SPF**. Gmail and others may junk or hold the mail without DMARC.
  - **The root MX points at Resend's inbound server** (`receive-apne1.forge.rmta.net`). Any mailbox such as support@dhirwa.ae would not receive anything today.
  - `User.email` is optional (`prisma/schema.prisma:96`, phone sign-in exists), and the reset form answers "ok" without sending when the address has no account (`forgot/actions.ts`). A test with an address that is not on an account sends nothing, by design.
  - `CONTACT_EMAIL` falls back to the owner's personal Gmail (`src/lib/site.ts:3`).
- What I could not verify: the Resend domain status, and whether the test mail appears in Resend's Emails page. That one screen decides which branch below applies.

## Step 0: one fact from the owner (5 minutes, no code)
Send one reset request for an address that has an account on dhirwa.ae, then open resend.com, Emails.
- **A. The email is listed as Delivered, but is not in the inbox.** Check Spam and Promotions, then do Step 2 (DMARC, domain) and Step 4 (sender name). This is the likely branch.
- **B. The email is listed as Bounced, Suppressed or Failed.** Open it and read the reason. Do Step 1.
- **C. Nothing is listed.** The request never reached Resend. Either the address has no account (use the exact signup email), the 5 per hour limit was hit, or the key is wrong. Do Step 3.

## Step 1: Resend dashboard checklist (owner, resend.com)
1. Domains: `dhirwa.ae` must show **Verified** for both DKIM and SPF. Region should be the same as the records the Tasjeel/Vercel DNS holds. If either shows Pending or Failed, click Verify and compare the records with DNS (Vercel dashboard, Domains, dhirwa.ae, DNS).
2. API Keys: the key in Vercel must be one with **Sending access** for `dhirwa.ae` (or Full access). A key limited to another domain returns 403. If unsure, create a new key, paste it into Vercel as `RESEND_API_KEY` (Production), and redeploy.
3. Plan limits: Free allows 100 emails a day and 3,000 a month, one domain. Enough for launch.
4. Emails page: note the status and reason for the test mail.

## Step 2: DNS records to add (owner, Vercel dashboard, Domains, dhirwa.ae)
| Type | Name | Value | Why |
|---|---|---|---|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:<an inbox you read>` | Gmail and Outlook now expect it. `p=none` only reports; tighten to `quarantine` after two clean weeks. |
Keep the DKIM and `send` records Resend gave you. Do not delete the root MX unless you want a real mailbox (see Step 5).

## Step 3: Vercel production variables (owner)
Exact names and values, Production only:
- `RESEND_API_KEY`: the key from Step 1.2.
- `MAIL_FROM`: `Dhirwa <no-reply@dhirwa.ae>`. Plain text, no quotes. (The code now falls back to this when the value is malformed.)
- `APP_URL`: `https://dhirwa.ae` (already set).
- `SUPPORT_EMAIL`: an address on a mailbox that works. Today the site shows and sends contact mail to the owner's personal Gmail.
After any change, redeploy (Deployments, the latest one, Redeploy), since Vercel reads variables at build.

## Step 4: small code changes (me, after approval; about 30 lines)
1. `src/lib/mail.ts`: log the Resend message id on success (`[mail] sent <id> to <domain>`), so Vercel logs prove acceptance. Never log the address or the body.
2. A small admin-only "Send test email" action on the admin settings page, which sends to the signed-in admin's own address and shows Resend's answer (accepted id or error text). This ends the guessing. It reuses `sendMail` and the admin guard already used in `admin/actions.ts`.
3. Reset flow: when the address has an account but no mail went out, keep the same on-screen answer (privacy) but write the reason to the log.
4. Sender: add a plain-text part and a `List-Unsubscribe`-free transactional subject, since HTML-only mail with a short body is more likely to be filtered. Keep the existing layout.
5. No schema change and no new dependency.

## Step 5: optional, a real mailbox for support@dhirwa.ae
- The root MX currently belongs to Resend's receiving service. To have a human mailbox, choose one: (a) Zoho Mail free or Google Workspace, which replaces the root MX and adds its own SPF and DKIM (sending still uses the `send` subdomain, so Resend keeps working); or (b) keep Resend inbound and use its webhook, which needs code and is not recommended now.
- Until then, keep `SUPPORT_EMAIL` on the Gmail address, and set the contact form's reply-to (already `replyTo: d.data.email`).

## Fallback if Resend still fails after Steps 0 to 4
Switch the sender, no other code: the whole app sends through one function, `sendMail` in `src/lib/mail.ts`. Replace the fetch with:
- **Brevo** (free 300 a day; API key plus a verified domain), or
- **Postmark** (best delivery, about 15 USD a month; needs approval), or
- **SMTP through Google Workspace** (needs a mailbox and an app password; adds `nodemailer`).
Cost and a new account are spending, so this needs the owner's yes first.

## Not covered by email
- Users who signed up with a phone number only have no email, so they cannot use the email reset. Decision for later: ask for an email at signup, or reset by WhatsApp or SMS (paid).

## Verification
- Step 0 shows the status in Resend. After changes: send from the admin test action, then the real reset, and confirm Delivered in Resend and inbox placement in Gmail (Inbox, not Spam) for one Gmail, one Outlook and one custom-domain address.
- `npx vercel logs --environment production --query mail` shows `[mail] sent` and no `[mail] failed`.
- `npx tsc --noEmit`, `npm test`, `npm run build` before any deploy. No deploy without the owner's yes.

---

## Earlier plan: Intro option B, "Dawn Relief": a second summit scene to compare with today's

## Context
- The owner wants a second, comparable version of the home intro and of the mountain itself, so they can choose between them. It has to look right on a laptop and on a phone.
- Today's version ("A", Contour) stays exactly as it is. It is thin contour rings that lift into a peak, a gold spiral trail, and a flag (`summit-scene.ts`). Its framing uses hand-tuned view offsets, and on narrower screens the peak crowds the headline.
- Skills: three.js (shaders, geometry, lighting), design-dna (adds a `visual_effects` variant to `docs/brand/dhirwa-dna.json`), genjutsu cast (an interaction thesis for the new scene, then a quick audit).

## Option B, "Dawn Relief" (the concept)
**Thesis:** the summit at first light. B uses a solid, shaded relief mountain instead of floating rings.
- **The terrain:** a solid mountain mesh that the light falls on from a low angle. Its contour lines are drawn by a shader on the surface itself (anti-aliased isolines in the contour colours), with a gold line near the top and snow above about 85%. It looks like a real relief map, not a wireframe.
- **The sequence, 4.0 s.** It keeps the existing timings, so `SUMMIT_END`, the 3.2 s copy delay and the 4.4 s guard stay valid.

  | Time | What happens |
  |---|---|
  | 0–1.4 s | Dawn breaks: the light rises from the horizon, and the contour lines draw upward from the foot to the peak (a shader threshold climbs). |
  | 0.8–3.0 s | The camera arcs slowly from a low side view to a three-quarter view. |
  | 1.8–3.4 s | A gold route traces the main ridge to the summit (a tube, as in A, but following the ridge rather than a spiral). |
  | 3.4–4.0 s | One gold ring pulses out once from the summit, then stops. |

  Afterwards the only motion is a slow drift and pointer parallax, as in A.
- **The mountain shape:** a new height function with one clear peak and two ridges (gaussians plus a little ridged noise). It is generated once at load, with fewer segments on phones.
- **Framing for laptop and phone (the main fix):** the camera is fitted to the mountain's bounding sphere for the current aspect ratio, with no hand-tuned offsets.
  - On wide screens the peak fills the side opposite the copy (end side, RTL-aware).
  - On phones it sits in the top band above the headline, sized to fit the width.
  - The fit is recalculated on resize and orientation change.
- **Unchanged rules:** colours come from CSS tokens; reduced motion shows a single still frame; the scene pauses off-screen and when the tab is hidden; any input skips to the end; everything is disposed on unmount. three 0.160, no new dependency.

## How the owner compares A and B
- `Summit.tsx` picks the scene. The default stays A, so the live home page does not change.
- `?intro=dawn` (or `?intro=contour`) on the home URL switches the scene on the client. It does not affect the cached page.
- The intro guard in `Intro.tsx` also replays the intro whenever an `intro` parameter is present, so each link shows the full 4 s every time.
- Links: `dhirwa.ae/ar?intro=contour` and `dhirwa.ae/ar?intro=dawn`, on laptop and phone. When the owner picks one, it becomes the default and the other is deleted.

## Files
- **New:** `src/components/three/dawn-scene.ts`, the `createDawn(THREE, canvas, opts)` scene. It returns the same `{render, resize, dispose}` shape as `createSummit`, so `Summit.tsx`'s loop is reused as it is.
- **Edited:**
  - `src/components/three/Summit.tsx`: picks the scene from the query parameter.
  - `src/components/brand/Intro.tsx`: one condition in the guard, so an `intro` parameter forces a replay.
  - `docs/brand/dhirwa-dna.json`: adds the B variant under `visual_effects`.
  - `DESIGN.md` §6: a short note on option B (marked "under review").
  - `docs/WORKLOG.md`.
- **Unchanged:** `summit-scene.ts`, `brand.css` timings, page layout.

## Verification
- `npx tsc --noEmit`, `npm test`, `npm run build`.
- Check locally in the browser pane at 1440×900, 1009 px wide, 375×812 and phone landscape, for both `?intro=contour` and `?intro=dawn`.
  - Check WebGL by reading canvas pixels, since screenshots can miss it.
  - Measure where the mountain sits so it never covers the headline.
  - Confirm the reduced-motion still frame and that there are no console errors.
- Ship: commit and push to `main`. This deploys to production, but the default stays A, so visitors see no change. Then send the owner both links and screenshots from a laptop width and a phone width.
- Separately, still pending from email: run one clean "forgot password" test once the hourly limit clears (after about 20:45 UTC), then check the logs.

---

## Dhirwa: full rebrand and redesign ("Contour")

## Context
- The owner has reserved the trade name **Dhirwa** (ذروة, "peak"). It replaces Sabboura, which clashed with a Dubai "Saboura" and an existing trademark. The live site, `main`, still says Sabboura (`df73687`).
- Owner's choices:
  - **Direction:** "Contour". Topographic contour lines rise to a summit. Warm paper pages, a deep ink-navy hero, one summit-gold accent, and the country colours drawn as trail lines.
  - **Scope:** everything. That covers the identity, mark, icons, OG images, emails and the three.js intro; new layouts for the marketing pages and the student home; and a token reskin of the teacher, admin and app pages.
  - **Pipeline:** genjutsu **bunshin, standard tier** (5 lenses, up to 2 refine rounds). Design DNA defines the system, and the three.js skills build the scenes.
- Names in copy: Arabic writes **ذروة**, English writes **Dhirwa**, and legal lines read "ذروة (Dhirwa)". The identifier is `dhirwa`.
- The domain is not bought yet. `APP_URL`, `MAIL_FROM` and the Paymob/Ziina callbacks keep their current values until the owner buys one. Copy and code never hard-code a new domain.

## What exists to reuse (from the codebase map)
- **Colour tokens:** `src/app/tokens.css` uses role-named tokens (`ground`, `surface`, `ink`, `primary`, `night*`, `marker`, `chalk-1..6`, `line-{country}`, shadows, motion). A new palette goes in by value, so pages re-skin without edits. The `chalk-*` and `wood` tokens become `contour-1..6` and `summit`; every use is renamed in one pass.
- **Marketing CSS:** `src/app/brand.css` holds `.stage`, the intro gating (`html[data-intro]`, a 3200ms copy delay), `.reveal` and the loader. `src/app/globals.css` holds `.btn*`, `.card` and `.hover-lift`.
- **Mark and generated images:** `src/app/brand-svg.ts` holds the mark geometry and colours for `icon.svg`, `apple-icon`, the PWA icons, both `opengraph-image.tsx` files and `manifest.ts`.
- **Shared components:** `src/components/brand/` contains `Mark`, `Wordmark`, `EmptyMark`, `EmptyState`, `Intro`, `Landmark`, `Network` and `SubjectIcon`. Every page also reaches `SiteHeader`, `SiteFooter` and `src/components/ui/*` (PageHeader, StatusChip, StatTile, PageSkeleton, SubmitButton).
- **3D scenes:** `src/components/three/Board.tsx` + `board-scene.ts` (home intro) and `Ride.tsx` + `ride-scene.ts` (student home). The lifecycle stays as it is: dynamic `import("three")`, colours read from CSS, paused when off-screen or the tab is hidden, a still frame under reduced motion, and dispose on unmount. three is 0.160; no new dependency.
- **Fonts:** Plex Arabic, Readex and Aref Ruqaa in `[locale]/layout.tsx`.
- **Tests:** no test asserts a brand string.

## Pipeline (bunshin standard)
1. **Direction contract (me, the art director).**
   - Run design-dna Phase 2 from the described "Contour" style, written to `docs/brand/dhirwa-dna.json`.
   - Then the genjutsu visual and interaction theses with an `Allowed patterns:` line, shown on a rendered preview page (Artifact): swatches with contrast ratios, the type specimen, the mark, and the intro storyboard with its easing curve.
   - The owner validates it once before any code.
2. **Foundation (me).** Tokens, `brand.css`, `globals.css`, `brand-svg.ts`, `Mark.tsx`/`Wordmark`, the fonts, `DESIGN.md` §0 and §6 (fix the stale motion section), `PRODUCT.md`, and `AGENTS.md`.
3. **Signature surface (me).** The new home intro, replacing Board:
   - `src/components/three/Summit.tsx` + `summit-scene.ts`.
   - Flat contour rings on the dark map lift into a 3D terrain. A gold trail climbs to the summit, a flag lands, and ذروة / Dhirwa writes in. About 4s.
   - Timings stay in sync with `brand.css` and `Intro.tsx` (`SUMMIT_END`, the copy delay and the clear timer).
   - Pointer parallax, any input skips, reduced motion shows the final still frame, and the scene pauses when off-screen.
   - Delete `Board.tsx` and `board-scene.ts`.
4. **Parallel clones (disjoint files).** One clone per page group, each owning a declared file list:
   - home and the closing band;
   - catalogue (`courses`, `courses/c/*`, `courses/[slug]`, `teachers/[id]`);
   - info and legal (`faq`, `contact`, `privacy`, `terms`, `refund`);
   - auth pages;
   - student home `me` (restyle the Ride scene into a trail-and-waypoints scene on the same mechanics) plus the dashboard and course player;
   - app shells (teacher, admin, parent, checkout) through the tokens and `ui/*` only, with no layout rewrites;
   - assets and copy: OG images, `icon.svg` regenerated from `brand-svg.ts`, the manifest, the `mail.ts`/`global-error.tsx` palettes, `messages/{ar,en}.json`, emails (`signup/actions.ts`, `admin/actions.ts`, `notify.ts`), `support.ts`, JSON-LD, the `middleware.ts` realm, `sw.js` cache renamed to `dhirwa-v1`, the `InstallApp` storage key, `package.json` name, the seed teacher name, and the launch checklist.
5. **Review.** The 5 lenses are finish, mobile, truth/tech, RTL/i18n and accessibility/motion. Each uses headless captures of every page in `ar` and `en`, phone and desktop. A plan follows.
6. **Refine.** Up to 2 rounds. Each round ends in a verdict, and the cold-eyes pass runs in round 1. The loop stops when only minor issues remain.
7. **Wrap-up.** A WORKLOG entry, the memory update (the brand file and the MEMORY.md line), and the report to the owner.

## Rules held throughout
- Real numbers from stored data only, and no invented social proof (DESIGN.md).
- Motion stays on the marketing pages and the student home hero. App pages stay calm. `prefers-reduced-motion` is honoured.
- RTL logical properties only. No raw hex, px or ms in components.
- Stripe stays on test, Ziina-only checkout is unchanged, and the database is untouched (no migrations needed).
- Nothing is committed, pushed or deployed until the owner says so.
- The old names are never brought back: A+, Alsaadi, AAcademy, Sabboura. `docs/WORKLOG.md` history is left as it is.

## Verification
- `rg -i "sabboura|سبّورة|سبورة|chalk"` across `src messages public prisma DESIGN.md PRODUCT.md AGENTS.md` returns nothing except the WORKLOG history.
- `npx tsc --noEmit`, `npm test` and `npm run build`, with the preview stopped and `.next` cleared around the build.
- Browser pane, `ar` + `en`, phone + desktop:
  - the intro plays once per tab, skips on input, and shows a still frame under reduced motion;
  - WebGL is checked by reading pixels;
  - no console errors;
  - the header, footer, course pages, checkout, dashboard, `/me`, teacher and admin all render in the new palette.
- `/opengraph-image`, `/apple-icon`, the PWA icon routes and `/manifest.webmanifest` render with Dhirwa.
- Screenshots go to the owner. Deploy only on the owner's yes.

---

## Name search: 10 clear names to replace Sabboura

## Context
- "Sabboura" is not safe. A "Saboura" already operates in Dubai, and another company seems to hold "Sabboura" as a trademark. This is the third name that has failed: AAcademy and A+ Academy were refused by ADDED, and now Sabboura.
- **Why my last check missed it:** I checked only the exact spelling `sabbouraacademy` (domains and handles). I did not check:
  - other spellings that sound the same (Saboura, Sabora, Sabbora, سبورة);
  - trademark registers;
  - the Dubai trade-name register;
  - the app stores.
- **Goal:** 10 names, ranked, each with written evidence that it is clear on every check the owner listed:
  - no UAE trademark;
  - not in use in the Arab world;
  - not taken on Google Play or the App Store;
  - .com, .net, .org and .ae all free;
  - Instagram and TikTok handles free;
  - no copyright or competitor conflict.
- The site is not changed in this task. The rebrand happens only after the owner picks a name and has it cleared.

## Honest limit
- I can screen names with public data. I cannot certify that a trademark is clear.
- The UAE Ministry of Economy (MOE) trademark search is behind UAE Pass login, so I may not be able to query it directly.
- Before paying for the licence change, the owner's chosen name needs:
  - a search by a UAE trademark agent (usually a few hundred AED);
  - an ADDED/DED trade-name reservation.
- Every name in the report will say exactly which checks passed and which could not be run.

## Method

### 1. Generate about 60 candidates
- Spread them across five styles:
  - coined words (the strongest trademarks and the least likely to collide);
  - Arabic roots in Latin letters;
  - Arabic–English blends;
  - metaphors for learning (the path, the lamp, the ladder, the compass, the notebook margin);
  - short abstract names.
- Each name must:
  - be easy to say in Arabic and in English;
  - have one obvious spelling in each script;
  - be 4 to 9 letters long;
  - have no offensive or awkward meaning in Gulf or Egyptian dialects, nor in English, Hindi/Urdu or Farsi (many UAE parents speak these);
  - not be a generic dictionary word for education ("academy", "school", "tutor" alone). A generic word cannot be registered as a trademark.

### 2. Expand every candidate into its variants before checking
- Alternative Latin spellings: doubled or single consonants; ou, u or o; final -a, -ah or -e.
- The Arabic spelling or spellings.
- These variants are what the last check skipped.

### 3. Screen each name and its variants, cheapest check first
A name is dropped at its first conflict.

| # | Check | How |
|---|---|---|
| a | Domains .com .net .org .ae | RDAP/WHOIS for .com/.net/.org; the aeDA WHOIS for .ae (not DNS only, which is what I relied on last time) |
| b | Instagram and TikTok | Open the profile URL for the bare name and the `name.academy`/`nameacademy` forms; a 404 counts as free |
| c | Google Play and App Store | Store searches on the bare name and its variants; any education or kids app with the same or similar name is a conflict |
| d | Use in the Arab world | Google searches in Arabic and English on the name plus الإمارات, السعودية, مصر, دبي, تعليم, education; LinkedIn and Facebook pages; Google Maps in the UAE |
| e | Dubai and UAE trade names | The DED / Invest in Dubai trade-name search and the ADDED business register lookup, where it can be read without logging in |
| f | Trademarks | WIPO Global Brand Database (covers Madrid filings that designate the UAE, and other national registers), TMview, USPTO, and the MOE e-service if it can be reached; classes 9, 16, 35, 41 and 42 |
| g | Copyright and competitors | Names close to existing ed-tech brands in MENA (Noon Academy, Abwaab, Nagwa, Classera, Madrasa, Orcas, Almentor and similar), and well-known characters or titles |

### 4. Score the survivors and pick 10
- Score each name on:
  - trademark strength (coined beats suggestive, suggestive beats descriptive);
  - how close the nearest conflict is;
  - how well it fits what the site does (a GCC + Egypt secondary-school marketplace);
  - whether it can be said and remembered in both languages;
  - how easily a logo can be built from it.
- Deliver a ranked table of 10 names. For each name:
  - the meaning;
  - the Arabic and Latin spellings;
  - the result of each check, with links;
  - the nearest conflict found.
- Publish the table as an Artifact so the owner can read it on their phone.

### 5. Owner decides
- The owner picks 1 to 3 names and takes them to a UAE trademark agent and ADDED.
- Only after the licence name is approved do we:
  - buy the domains and handles (the owner's spending);
  - plan the site rebrand. It reuses the Sabboura work: the brand-name strings are already centralised in `messages/*.json`, `brand-svg.ts`, `Mark.tsx` and `layout.tsx`.

## Tools
- Subagents run the per-name checks in parallel, a few names each, so the screening runs across the whole long list at once.
- The built-in browser is used for the stores, Instagram, TikTok and the register lookups.
- `whois` and RDAP over curl, all read-only.
- No account sign-ins and no purchases. I never type the owner's UAE Pass details.

## Verification
- Every name in the final 10 has a link or a command output behind each check.
- I re-run the domain and handle checks right before delivering, because these can be taken within hours.
- For each pick, the report lists the checks that could not be run (likely the MOE trademark register), so the agent search covers those.

---

## A+ Academy: signed-in student home ("Your grade")

## Context
- Today a signed-in student lands on the same marketing home as a visitor: planet, countries, the latest 3 courses from any country. Nothing on it is about their grade, so it does little for sales.
- The owner wants a separate main page for signed-in students. It is built around their **grade and country** and shows every subject of their grade with its courses. A three.js "ride" (a roller-coaster style track) carries the subjects, and the design is guided by the design DNA + genjutsu. The goal is more sales.
- What already exists:
  - Signup already requires a grade for students (`signup/actions.ts`, `schemas/auth.ts`). The grade select is grouped by country, and the country comes from the grade (`User.gradeId` → `Grade.countryId`).
  - Missing: there is no way to change the grade later. `account/` has no grade field.
  - Auth is credentials only, so every student has a grade, apart from old or seeded rows. The page still handles `gradeId = null`.

## Approach

### 1. Routing: same URL, different page
- `/{locale}` stays the cached public home (`revalidate = 300`). Calling `auth()` there would make it dynamic for every visitor, so the page itself does not change.
- `src/middleware.ts`: when the Auth.js session cookie is present (`authjs.session-token` / `__Secure-authjs.session-token`), **rewrite** `/{locale}` to `/{locale}/me`. The URL stays `/`.
- New route `src/app/[locale]/me/page.tsx` (dynamic):
  - Runs `auth()`.
  - A STUDENT with a grade gets the new page.
  - Anyone else gets the public home: its body moves into a shared `HomePublic` component that both routes render. The cookie may also be stale.
  - A student without a grade sees the grade picker first (step 3).
- The header logo keeps linking to `/`, so it works for both.

### 2. The page: `src/app/[locale]/me/`
Data comes from one query helper, `src/lib/student-home.ts` (`getStudentHome(userId, now)`). All of it is real stored data: no invented counts and no "popular" badges unless they come from real counts.
- The grade, its country, and `GradeSubject` in order → the subjects, with `SubjectIcon` keys.
- Per subject: the published courses for `gradeId + subjectId`, with `cardInclude(now)` (`src/lib/catalog.ts`). These carry teacher, price, discount and cover.
- Ownership: the student's current entitlements, using the `grantsFor` logic in `catalog.ts`. Each course is marked "yours" or "for sale".
- Active `BundleRule`s that cover this grade's subjects, for example "Math + Physics −15%". This is the main sales lever and is already priced by `pricing-engine.ts`.
- Running SKU discounts, and upcoming live sessions in the grade.

Sections, top to bottom:
1. **Hero ride (three.js).** "Your Grade 12, UAE" with the country line colour and flag (`Landmark`/flag assets). One car per subject travels a looping track.
   - Each car carries the subject's icon, name, course count and starting price.
   - The student drives it: drag, wheel, swipe or the arrow keys. There is no autoplay; DESIGN.md forbids autoplay carousels.
   - Selecting a car (or tabbing to it) scrolls to that subject's row and highlights it.
   - Copy and buttons are DOM over the canvas, so they stay readable and translatable.
2. **Continue learning.** Courses the student already has, linked to the next lesson. Shown only when there are some. A quick link to `/dashboard`.
3. **Subject rows.** One row per subject of the grade:
   - every teacher's course as a `CourseCard`;
   - a "yours" chip on owned courses;
   - a sideways scroll on phones.
   - An empty subject says "Coming soon" with no fake cards.
4. **Bundle offer.** "Take N subjects, save X%", built from the real `BundleRule`s. It shows the real total for the subjects the student doesn't own yet and has a "Buy the bundle" button that goes to `/checkout?sku=…&sku=…`, which already prices bundles.
5. **Live this week.** The grade's next live sessions, each with a seat button.
6. Footer link: "Not your grade? Change it", to the account page.

### 3. Grade and country in settings
- `account/page.tsx` + `AccountForms.tsx`: a "My grade" select, grouped by country, the same as the signup select. Reuse the query from `signup/page.tsx` (move it to a small shared helper).
- `account/actions.ts`: `updateGrade` checks the grade exists and is active, writes `User.gradeId`, and revalidates `/me`.
- Students only. Changing the grade does not touch what the student has bought.
- `/me` without a grade shows the same select inline: "Pick your grade to see your subjects".

### 4. The 3D ride: `src/components/three/Ride.tsx` + `ride-scene.ts`
- Same pattern as `Planet.tsx`: a client component, a dynamic `import("three")`, colours read from CSS tokens (aurora, country line colour), DPR capped, paused when off-screen or the tab is hidden, everything disposed on unmount.
- Scene:
  - A `CatmullRomCurve3` closed track with a soft rail tube.
  - Cars are rounded panels textured from a small canvas: the subject icon SVG plus its name. The Arabic and English names come from the server props.
  - Position along the curve is `t = base + offset`, and input moves `offset` with eased inertia. RTL reverses the direction.
  - Cars ease into a front "station" slot and snap to the nearest subject when input stops.
- Accessibility and performance:
  - The canvas is `aria-hidden`. The real control is a DOM list of subject buttons (a roving tabindex) that drives the scene.
  - Under reduced motion there is no WebGL loop, only one still frame, and the subject buttons stay.
  - On phones there are fewer segments and smaller textures.
  - No new dependency: three 0.160 is already installed.
- Design pass: during implementation, run `genjutsu:paint` (light-to-medium scope) against `docs/brand/aurora-dna.json` to settle the ride's interaction thesis (curve, timing, snap) before writing code. Then audit it.

### 5. Rules to update
- `DESIGN.md`:
  - Allow 3D in the **student home hero** as well as the public home hero.
  - The page counts as a store (marketing) surface, so motion is allowed there.
  - No autoplay, and the reduced-motion still frame stays.
- Strings: `messages/{ar,en}.json` → `me.*` (greeting, ride hint, the section titles, bundle copy, "coming soon", "change grade") and `account.grade*`.

## Files
- New:
  - `src/app/[locale]/me/page.tsx`
  - `src/components/HomePublic.tsx` (moved out of `[locale]/page.tsx`)
  - `src/components/three/Ride.tsx` and `ride-scene.ts`
  - `src/components/SubjectRow.tsx`
  - `src/lib/student-home.ts`, with a test
- Edited:
  - `src/middleware.ts`
  - `src/app/[locale]/page.tsx`
  - `account/{page,actions,AccountForms}`
  - the signup grade query helper
  - `DESIGN.md`
  - `messages/*`
  - `docs/WORKLOG.md`
- Reused: `cardInclude`, `onSale`, `grantsFor` (`catalog.ts`), `CourseCard`, `SubjectIcon`, the pricing engine bundle logic, the `Planet.tsx` lifecycle pattern.
- No schema change: `User.gradeId` already exists.

## Verification
- Vitest for `student-home.ts`:
  - subjects in `GradeSubject` order;
  - owned vs for sale;
  - bundles limited to the grade's subjects;
  - a grade with no courses.
- Browser pane, ar + en, phone + desktop:
  - signed out, `/` is the public home;
  - signed in as a student, `/` is the grade page;
  - a teacher or admin at `/` gets the public home;
  - changing the grade in the account page changes `/`;
  - the ride moves by drag and keys, and the subject buttons scroll to their rows;
  - with reduced motion, a still frame;
  - no console errors.
  - The pane can't screenshot WebGL, so check the scene by reading pixels, as for the planet.
- `npx tsc --noEmit`, `npm test`, `npm run build`, with the preview stopped and `.next` cleared around the build.
- Nothing is pushed or deployed without the owner's yes.

---

