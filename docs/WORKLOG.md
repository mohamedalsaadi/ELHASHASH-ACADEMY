# Work log

Read this first if you are an agent picking up the project. Newest entry on top. Each entry says what changed,
why, where, and what is still open. Rules in `AGENTS.md` and design in `DESIGN.md` still win over anything here.
Git history has the rest (`git log --oneline`).

## Standing facts

- **Brand:** Dhirwa (ذروة, "the peak"), since 2026-11-02, when the owner reserved the trade name. Sabboura was
  dropped the same day (a Dubai "Saboura" and an existing trademark). Identity "Contour" (DESIGN.md §0,
  `docs/brand/dhirwa-dna.json`). No domain or handle is bought yet; `APP_URL`, `MAIL_FROM` and callbacks are unchanged.
- **Live site:** https://elhashash-academy.vercel.app. It is behind HTTP Basic auth (`SITE_PASSWORD` in
  `src/middleware.ts`). The Claude desktop browser pane cannot show the Basic-auth prompt, so use Claude in
  Chrome; the owner types the password. On 2026-11-01 the live site ran the pre-redesign code (old look, old intro).
- **Payments (owner decision, 2026-11-02): Ziina only.**
  - `activeGateway` in `src/lib/gateway.ts` returns Ziina for AED and nothing else. Stripe and Paymob code stays but is
    hidden until the owner allows it: `STRIPE_ENABLED=1` / `PAYMOB_ENABLED=1`. With no gateway, checkout says payment
    is not open yet and the API answers `payments_unavailable`.
  - Stripe stays on test keys (AGENTS.md).
  - Ziina (`src/lib/ziina.ts`, `/api/webhooks/ziina`) takes money only once `ZIINA_API_KEY` is set in Vercel and the
    webhook `https://<domain>/api/webhooks/ziina` is registered. Keep `ZIINA_TEST=0` in production.
  - Bank transfer is gone (see the entry below). Do not bring it back without the owner.
- **Marketplace stage, until the end of 2026:**
  - Teachers publish their own courses, sessions, prices and cover picture per country, grade and subject.
  - The old plan ideas (monthly plan, "ways to learn") are hidden, not deleted.
  - Migrations stay additive. Keep the `2027-full-release` tag (`f0bf453`).

## 2026-11-02: Rebrand to Dhirwa, identity "Contour" (uncommitted on `redesign-aurora`)

- **Why:** the owner reserved the trade name Dhirwa and asked for a full redesign with a new intro (design-dna,
  genjutsu bunshin standard, three.js).
- **Identity:** survey-paper pages, a night-map `.stage`, contour lines (`contour-1..6`) as the one ornament, one
  summit-gold point (`summit`), trail-green primary `#1F7356`, Reem Kufi for the name ذروة only. Mark = three ridge
  lines plus a gold dot (`src/app/brand-svg.ts`, `Mark.tsx`, `icon.svg`, OG images, manifest).
- **Intro:** `src/components/three/Summit.tsx` + `summit-scene.ts` replace the Board (4.0 s: contour rings lift into a
  peak, a gold trail climbs, a flag lands; copy at 3.2 s, guard clears at 4.4 s). The student-home `Ride` is now a
  trail with waypoints.
- **Pages:** home redesigned as a "climb"; catalogue trail map; auth side panel (`signin/AuthShell.tsx`); every other
  page re-skinned through tokens. Strings in `messages/*.json`.
- **Review round 1 fixed:** gold focus ring on the map; the course header buy button always reaches a plans section;
  ink check on Bahrain's colour; the intro clock starts at page load; list markup; promo `h3`; homework tile grid;
  `--text-lede` token; dead CSS.
- **Open:** the share images are English only (Satori needs an Arabic font file to shape ذروة); Paymob's fallback
  billing email is now `SUPPORT_EMAIL` → `MAIL_FROM` → `no-reply@example.com` (Paymob is off). Nothing committed,
  pushed or deployed.

## 2026-11-02: Rebrand to Sabboura, identity "Chalkboard"

- **Why:** the owner registered the trade licence as Sabboura (سبّورة, the classroom blackboard) and asked for the
  whole site, intro included, to follow the name.
- **Direction:** `docs/brand/sabboura-dna.json` (design-dna profile from a described style) and DESIGN.md §0-§1.
  Slate board for the heroes, exercise-book paper for pages, coloured chalk as the one ornament, board-green actions,
  Ruqʿah (Aref Ruqaa, `--font-hand`) for the Arabic wordmark and chalked words only. Token names are unchanged
  (`aurora-*` became `chalk-*`, `planet-*` became `wood`), so app pages re-skin without edits.
- **Mark:** a slate board on a wooden ledge with a stick of yellow chalk, one chalk stroke writing س
  (`src/app/brand-svg.ts`, `Mark.tsx`, `icon.svg`). Generated icons and share images use the same geometry on paper.
- **Intro:** the planet is gone (`Planet.tsx`, `planet-scene.ts`, `land.ts` deleted). `src/components/three/Board.tsx`
  + `board-scene.ts`: chalk draws axes and a parabola, a wave, a benzene ring, then writes سبّورة / Sabboura and
  underlines it, shedding dust; idle motes drift in three depth layers with pointer parallax. Same 4.2 s contract,
  guard and skip as before; reduced motion gets the finished board. Diagrams are not mirrored in Arabic.
- **Copy:** every "A+ Academy" became سبّورة (Arabic) or Sabboura (English); legal lines read "سبّورة (Sabboura)".
  New home headline ("مدرّسك على السبّورة، أينما كنت." / "Your teacher at the board, wherever you are."), closing
  title and footer tagline. Emails, AI support prompt, Basic-auth realm, manifest, service-worker cache (old caches
  are now deleted on activate), package name.
- **Checked:** browser pane, ar and en, desktop and phone; home intro, courses page, footer, OG image, PWA icon.
- **Open:** buy the domains and handles; licence number and address in the legal pages; the student home (`/me`)
  was not viewed signed in as a student (its colours come from the same tokens). `docs/brand/brand-book.html` and
  `aurora-dna.json` are kept as history.

## 2026-11-02: Student home ("your grade") with the subject ride

- **Routing:** with a session cookie, `src/middleware.ts` rewrites `/{locale}` to `/{locale}/me`, and the address stays `/`.
  The public home keeps its 5-minute cache. `/me` checks `auth()`: a STUDENT gets the grade page; anyone else (parent,
  teacher, admin, stale cookie) gets the public home component; a student without a grade gets a grade picker.
- **Page** (`src/app/[locale]/me/page.tsx`, data in `src/lib/student-home-server.ts`, shaping in `student-home.ts`
  with tests):
  - Hero: "Your {grade}, {country}" with the flag, and the ride.
  - Continue learning: the student's own courses.
  - Bundle offer: the real `BundleRule`s run through `price()` on the cheapest plan of each subject not owned yet,
    linking to checkout with those SKUs.
  - A row per subject with courses: subjects to buy first, then owned ones, with a "Yours" chip.
  - One "Coming soon" line naming the empty subjects.
  - Live sessions in the next 7 days, then a "change grade" link.
- **Ride** (`src/components/three/Ride.tsx` + `ride-scene.ts`): a CatmullRom aurora rail, dotted sleepers, and a car per
  subject drawn on a canvas (`subjectPaths` from `SubjectIcon`).
  - Moved by drag, a sideways wheel, the subject buttons (roving focus, arrow keys) or a tap. Tapping the front car
    scrolls to its row.
  - Frames are drawn only while a car moves. Reduced motion jumps instead.
  - DESIGN.md now allows this second 3D hero.
  - The design used the Aurora DNA values (700 ms settle, ease-out, no autoplay). The genjutsu brainstorm and approval
    steps were not run.
- **Grade setting:** `/account` has a "My grade" picker for students (`GradePicker`, `updateGrade`), and the signup
  page now shares `gradeGroups()` in `catalog.ts`.
- **Checked:**
  - tsc, 183 tests, build.
  - Student view in ar and en, desktop and phone, through a locally minted session for the seeded test student on
    `127.0.0.1`. The owner's localhost session was not touched.
  - Ride buttons, keys and drag; no horizontal overflow; no console errors; admin and signed-out users get the public
    home.
- **Not checked:**
  - Saving a new grade (it would write to the shared database).
  - The bundle box: no active bundle rule exists yet; the unit test covers it.
  - Reduced motion in a real browser.
  - A real phone.

## 2026-11-02: Ziina only, bank transfer removed

- Owner: "we only accept Ziina payment", Stripe hidden until allowed, delete everything about bank transfer.
- Deleted: `lib/transfer.ts`, `lib/bank-email*.ts` (and its tests), `/api/webhooks/bank-email`, `/admin/transfers`,
  `checkout/transfer`, `ReceiptUpload`, `docs/payment-bridge.md`. Also the course-page transfer box, bank details and
  auto-approve in Admin settings, the transfers tab and tile, receipt upload and download, the receipt filter and
  badge on orders, the transfer count in the morning briefing, the strings, the `BANK_*` env vars.
- Public copy (FAQ, terms, privacy) and the support AI policy now say: card, Apple Pay or Google Pay through Ziina, in AED.
- Kept on purpose: the `BankEmail` table, `Order.receipt*` and `PlatformSetting.bank*` columns (migrations stay
  additive until 2027; all were empty), and the MANUAL gateway (free coupons, admin grants, mark-paid).
- Checked: tsc, 179 tests, build; course page, checkout (ar/en), admin home, settings and orders in the browser.
- **Open:** only AED can be paid. A SKU in another currency shows "payment not open"; today all 12 SKUs are AED.
  The terms page still lists seven currencies.

## 2026-11-02: AI operations, phase 1 (solo owner, no staff)

- Plan: `C:\Users\sw-os\.claude\plans\rebrand-to-a-magical-meteor.md` (owner, teacher, student and parent AI
  steps; recommended stack; phases 2–3 still open).
- `src/lib/ai.ts` `askJson()` is now the only Gemini call (plain fetch plus zod). `AI_MODEL` env overrides the
  model, and `AI_ENABLED=0` turns every AI feature off. `ai-grading.ts` uses it.
- **Bank transfers:** an alert that lands in NEEDS_REVIEW now notifies every ADMIN (`notifyAdmins` in
  `notify.ts`). Before this, nobody was told about the queue.
- **Support inbox:** contact-form messages are stored as `SupportTicket`. Gemini drafts a reply grounded in the
  policy text in `src/lib/support.ts`. The owner edits and sends it at `/admin/support`; nothing is sent
  automatically. There is a new tile on the admin home. The email copy to `CONTACT_EMAIL` still goes out.
  **Keep `POLICY` in `support.ts` in step with the FAQ and policy pages.**
- **Homework:** the AI mark suggestion now runs once on submit (`after()`, capped at 300 a day per course). The
  teacher button still works. A resubmission clears the old AI mark.
- **Cron (daily 05:00 UTC):** a morning briefing to admins with the last 24 h of sales and signups, plus what is
  waiting and what is overdue. The Sunday parent summary is now an AI-written note per child, from numbers and
  teacher feedback only; the model never sees the child's name. It falls back to the fixed sentence.
- FAQ: dropped the stale "Unit 1 is free" entry (both languages).
- **Open:**
  - Migration `20261105120000_support_tickets` is **not applied yet**. Until it is, `/admin`, `/admin/support`
    and the briefing fail on the missing table. Run `npx prisma migrate deploy` before deploying.
  - Live-session reminders use windows of an hour or less on a daily cron, so most never fire. This needs an
    hourly scheduler (Vercel Pro or an external one).
  - The generic `AiRun` log and `/admin/ai` queue were left out. Add them when there is a second kind of AI
    draft to approve.

## 2026-11-02: New home planet and dawn intro

- The constellation is replaced by a planet (`src/components/three/Planet.tsx`, scene in `planet-scene.ts`):
  continents as dots from Natural Earth 110m (public domain), packed into `land.ts` (15 KB, regenerate with a
  d3-geo script: land and the Egypt + GCC region masks on a 0.9° grid). Ocean and atmosphere shaders, a beam on
  each capital, arcs from Cairo and Abu Dhabi. Colours come from `--color-planet-*` and the aurora tokens.
- Intro is now 4.2 s: back-lit crescent, dawn sweeps across while the planet turns to the Gulf, capitals light,
  arcs draw; the copy rises at 3.2 s (`brand.css`, guard timer 4.4 s in `Intro.tsx`). Reduced motion: one still frame.
- Framing follows the window shape, and the planet turns by the off-axis angle so the Gulf faces the viewer.
- Checked: tsc, tests, build; ar/en desktop and ar phone in the browser pane. Not seen on a real phone yet.

## 2026-11-01: Free unit cancelled, no teacher marketing

- Owner decision: no free unit. Migration `20261104120000_cancel_free_units` set the 4 free units to paid (ids in
  the SQL comment, **applied to Neon**). The admin switch, the course-page "start the free unit" button, the free chip
  and the course-card badge are gone; `Unit.isFree` stays in the schema, always false.
- Home no longer markets to teachers (the teacher tile is removed). Teachers join only through a small
  "A teacher who wants to join? Contact us" line on `/signup`, which links to `/contact`.

## 2026-11-01: "Aurora" redesign and role gaps (branch `redesign-aurora`)

A second, competing design on its own branch, cut from `redesign-curriculum-metro` so the marketplace, teacher-control
and Ziina work come along. Metro stays untouched on its branch for comparison. Production is untouched until the owner
picks one.

**Design**
- Stripe/Apple style, measured DNA in `docs/brand/aurora-dna.json`, theses in `DESIGN.md` §0–1.
- `tokens.css` rewritten with the same token names, so every page restyled at once. New fonts: IBM Plex Sans Arabic + Readex Pro.
- `globals.css`: pill buttons (`.btn-glow`, `.btn-ghost`), `.card`, `.hover-lift`. `brand.css`: `.stage`, aurora,
  scroll reveal, intro rules.
- Home hero: three.js constellation (`src/components/three/Constellation.tsx`): swirl → "A+" → globe with capital pins.
  The intro guard (`src/components/brand/Intro.tsx`) plays it once per tab, any input skips, reduced motion gets a still.
- Home page rewritten: hero, countries, roles bento (student / parent / teacher), latest courses, how it works, final CTA.
  Only real counts from the database.
- Header is glass and sticky; footer, CountryTile, CourseCard, nav shells and the country stations restyled.

**Roles**
- **Parent pays for a child.** `Order.beneficiaryId` (additive migration `20261103120000_order_beneficiary`, **already
  applied to Neon**, which is shared by local, preview and live). A parent's checkout must pick a linked child
  (`ParentLink`); grants go to `learnerOf(order)` in `src/lib/access.ts`. The parent receives the receipt.
- Parent area: `ParentNav`; the child page now shows exam results and live attendance. Weekly parent email already ran
  from the Sunday cron, no change.
- Signup honours `?type=PARENT` (the "I'm a parent" buttons).
- Teacher: `/teacher/earnings` by month and course from the ledger, CSV export at `/teacher/earnings/export`, and a
  setup checklist on `/teacher` (photo and bio, course, price, publish), shown to INSTRUCTOR accounts until done.
- Admin overview: added linked tiles for transfers to review (manual orders + bank emails) and open requests.

**Checked:** `tsc`, 190 vitest tests, `next build`, and key routes in ar/en at mobile and desktop in the browser pane.
The pane cannot screenshot WebGL; the scene was checked by reading pixels.

**Open**
- The owner chooses Aurora or Metro after the preview. Then that branch goes to main and production on approval.
- Not yet walked as a real INSTRUCTOR or PARENT account in the browser (needs the owner's sign-in).
- Lighthouse on the home page with the 3D hero not measured yet.
- Preview: https://alsaadi-academy-git-redesign-aurora-elhashash-academy.vercel.app (Vercel login). Its env vars are
  scoped to Preview + branch `redesign-aurora`, copied from `.env.local` (Production values are Sensitive and
  unreadable): same Neon DB, Stripe test key, `APP_URL` = the preview URL. No `GEMINI_API_KEY` there yet.

## 2026-11-01: Curriculum Metro redesign, marketplace stage, teacher control (uncommitted)

All of the following is in the working tree, **not committed or deployed**. The owner approves push and deploy.

**Visual redesign ("Curriculum Metro")**
- Tokens are in `src/app/tokens.css` (`@theme static`, one line colour per country) and motion in `src/app/brand.css`.
- The design is described in `DESIGN.md`.
- New pieces:
  - `src/components/brand/Network.tsx`, the metro map and `LineBadge`.
  - `src/components/brand/Intro.tsx`, a 1.8 s intro on the home page only. It plays once per tab session and is
    skipped under reduced motion, so Windows "Animation effects" off means no intro.
  - `src/components/NewsBanner.tsx`, the latest 5 courses, discounts and offers, shown on public pages only via
    `src/components/MarketingOnly.tsx`.
- The brand mark comes from `src/app/brand-svg.ts`. The icons and share images were redrawn.
- **Country identity:** each country shows its landmark (`src/components/brand/Landmark.tsx`), its flag
  (`public/flags/*.svg`) and its line colour. This appears on the tiles (`src/components/CountryTile.tsx`), the
  country page header and the home country list.

**Marketplace browsing**
- The path is country, then grade, then subject (new page `src/app/[locale]/courses/c/[country]/[level]/[subject]/page.tsx`).
- The subject page lists every teacher's published course for that grade and subject.
- `src/components/CourseCard.tsx` shows the cover (the "picture headline"), the teacher, the session count, the
  price and a free-unit badge.

**Teacher control**
- Guards are in `src/lib/staff.ts`; actions are in `src/app/[locale]/admin/actions.ts`.
- A teacher (INSTRUCTOR) can:
  - create courses;
  - edit titles, headline, cover and units/lessons ("sessions");
  - set package prices, discounts and rentals;
  - publish.
  There is no admin approval step.
- **Teacher country:** a teacher's country is the country of any grade the owner granted them (`TeacherSlot`,
  through an invite or Admin → Teachers). Since this entry the teacher may open **any active grade of that country
  and any subject that grade teaches** (`assertSlot` checks `GradeSubject` and the country, then records the slot).
- The `/teacher` dashboard lists those choices grouped by grade, and the teacher menu has a "My courses" tab
  (`/teacher#courses`).
- Admin-only: reassigning a course's teacher, granting the first slot (which sets the country), site-wide
  promotions and coupons, orders, refunds and finance.

**Admin fixes**
- The grade filter in Admin → Courses & prices is grouped by country.
- The public teacher page (`src/app/[locale]/teachers/[id]/page.tsx`) shows:
  - initials when there is no photo;
  - the subjects the teacher teaches;
  - the bio in the other language when only one language is written;
  - full course cards.

**Open**
- Commit and deploy, which need the owner's approval.
- Set `ZIINA_API_KEY` and register the webhook, both owner actions in the Ziina and Vercel dashboards.
- The FAQ still describes the inactive monthly plan.
- Egypt Grade 12 test courses are priced in AED.
- Course share images render text in the default font.
- Session revocation for deleted or demoted users is deferred by the owner. Fix it when touching auth.
- Live benchmark findings (2026-11-01):
  - Typical page 0.59 s.
  - Slow pages: admin/teachers 1.7 s, dashboard 1.6 s, teacher 1.4 s.
  - The admin/catalog HTML is 468 KB.
  - 11 tap targets on the home page are under 44 px.
