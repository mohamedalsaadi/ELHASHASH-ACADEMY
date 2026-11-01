# A+ Academy — Milestone 1 Spec (Website MVP)

> Archived: the brand is now A+ Academy (renamed 2026-10-25, then again 2026-11-01). This spec describes the original MVP.

Source: the original development plan. Markets: Egypt (primary, Thanawya Amma) and UAE.

## Stack
Next.js 15 (App Router, TS strict) · Tailwind v4 · next-intl (ar default/RTL, en/LTR) · Prisma + Neon Postgres · Auth.js (HttpOnly SameSite cookies) · VdoCipher (DRM + dynamic watermark) · Paymob · React Three Fiber · Vercel. Package manager: npm.

## In scope
1. **Curriculum taxonomy** — Country → Grade → Subject → Course → Unit → Lesson.
   - Egypt: Primary 1–6, Prep 1–3, Secondary 1–3 (Sec 3 = Thanawya Amma). Calendar Sep–Jun, mid-year Jan, finals Jun/Jul.
   - UAE: Cycle 1 (G1–6), Cycle 2 (G7–9), Cycle 3 (G10–12); curriculum tag MOE / British / American / IB.
2. **Freemium funnel** — Unit 1 of every course free; guests (no account) may preview free units of Grade 12 / Sec 3.
3. **Lesson types** — video, exam-structure walkthrough (شرح الهيكل), practice question sets, PDF.
4. **Pricing** — SKUs per course: `SEMESTER`, `YEARLY`, `REVISION` (sale window before exams). Bundle rules: a set of subjects → % discount (e.g. Math + Physics = 15%). Entitlements are time-boxed or perpetual.
5. **Checkout** — Paymob: card, mobile wallet, kiosk cash reference, valU. Cash orders stay `PENDING` until webhook; webhook HMAC-verified and idempotent.
6. **Secure video** — VdoCipher OTP issued only server-side after entitlement check; watermark = name + phone + IP. One active device per account: a new device revokes the old one. Free/marketing videos may be YouTube embeds.
7. **PDF library** — signed short-lived URLs, entitled users only.
8. **Student dashboard (Genjitsu)** — exact numbers: streak days, XP, attendance %, per-concept scores, Egyptian tier (≥75 Distinguished/Excellent/Very Good · 65–74 Good · 50–64 Pass · <50 Poor). 3D streak gem with 2D fallback.
9. **Honor Roll (لوحة الشرف)** — public top achievers.
10. **Admin** — CRUD courses/units/lessons/videos/SKUs/bundle rules; manually mark pending orders paid.
11. **Bilingual** — ar/en toggle without losing session; full RTL.

## Out of scope (later phases)
LiveKit live classes (hand-raise queue, upvoted Q&A, polls) · Fawry direct · InstaPay · Tap/PayTabs (UAE Apple/Google Pay) · Sympl/Tabby · Expo mobile app · adaptive difficulty engine · custom DOM watchdog.

## Acceptance criteria
- Guest can browse catalog and play a free unit; paid lesson shows paywall.
- Pricing engine unit tests pass (bundles, overlap, revision windows, rounding).
- Paymob test card → entitlement granted; kiosk order stays PENDING until webhook fixture replayed.
- Paid video plays with visible watermark; signing in on a second browser stops playback on the first.
- ar ↔ en toggle flips direction, session preserved.
- `npm run build` clean; Lighthouse mobile performance ≥ 90 on landing.
