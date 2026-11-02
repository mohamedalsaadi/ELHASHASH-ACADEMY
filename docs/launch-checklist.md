# Dhirwa launch checklist

Last updated: 2026-10-30 · live commit `22d5f76`.

This is the single place for: **what has not been verified**, **what only the owner can do**, and **every external service the app or its build uses**.

---

## 0. Where things stand

- **Live** at the Vercel production URL (`APP_URL`) — practice, spaced review, exams, homework, AI grading, parent digest and the teacher check-on list all deployed.
- **Database migrated** with every batch: catalog, homework (`Assignment`/`Submission`/`SpecialRequest`), practice (`QuestionItem`/`PracticeAttempt`), review (`ReviewSchedule`), exams (`ExamPaper`/`ExamAttempt`), and `ExamPaper.maxAttempts`.
- **UAE prices in the database**: semester 990, year 1,870, monthly 495 (inactive until a paid lecture carries a month).
- **Seeded dev accounts are locked** — `01000000000` and `01000000001` do not accept the dev password. The only admin is `0556926246`.
- **Security headers added**: `poweredByHeader: false`, `X-Frame-Options: DENY`, COOP/CORP `same-origin`, HSTS in production, on top of the existing `nosniff`, `Referrer-Policy`, `Permissions-Policy` and `frame-ancestors`.
- **Sessions expire after 7 days.** A session cannot be revoked server-side while valid — the role and id ride in the JWT — so a demoted account keeps access until the cookie expires. Real revocation is a separate security batch.

---

## 1. The order to go live on a real domain

**Gate 0 — prove the database is the same one.**
- [ ] Vercel → Settings → Environment Variables → `DATABASE_URL`. The host must be `ep-twilight-feather-b97jpk23-pooler.c-7.eu-central-1.aws.neon.tech`. If it is a different database, run `npx prisma migrate deploy` against it and re-run `npx tsx prisma/seed-uae-prices.ts --apply` first. Without this, every signed-in screen errors on missing tables.

**Domain and handles (owner).** The trade name is Dhirwa, ذروة ("the peak"; reserved 2026-11-02). Nothing is bought yet. On 2026-11-02 `dhirwa.net`, `dhirwa.org` and `dhirwa.ae` (the .ae by DNS only) and Instagram `@dhirwa` were free; `dhirwa.com` is taken. TikTok was not checked.
- [ ] Reserve `@dhirwa` on Instagram (and check TikTok) the same day the domains are bought.
- [ ] Buy `dhirwa.ae` at an aeDA-accredited registrar (Vercel cannot register .ae) and `dhirwa.net` / `dhirwa.org` to protect it; pick one as the primary. Point the nameservers at `ns1.vercel-dns.com` / `ns2.vercel-dns.com`.
- [ ] Once it resolves with a valid certificate: `MAIL_FROM=Dhirwa <no-reply@<domain>>` after Resend verifies SPF, DKIM and DMARC. `src/lib/paymob.ts` takes its no-reply address from `SUPPORT_EMAIL`, then `MAIL_FROM`, then the neutral `no-reply@example.com`, so no domain is hard-coded.

**Then, in this order**
1. [ ] Add the domain in Vercel → Domains; `A 76.76.21.21` for the apex, `CNAME cname.vercel-dns.com` for `www`; 308 `www` → apex. Wait for *Valid Configuration*.
2. [ ] Set `APP_URL=https://<domain>` and a fresh `AUTH_SECRET`; clear `SITE_PASSWORD` (while set, the whole site is behind basic auth).
3. [ ] Point the Stripe and Paymob webhooks at the new domain (they embed the old one).
4. [ ] Verify the Resend sending domain and set `MAIL_FROM`.
5. [ ] Replace the legal entity and support address with real ones (§4).
6. [ ] Take a Neon branch snapshot before opening sign-ups.

---

## 2. Not verified

Each line says what was checked instead, and how to close it.

### New this batch

- [ ] **Signed-in flows end to end.** Every feature below is typechecked, unit-tested and built, but the seeded accounts are locked, so no authenticated screen was clicked.
- [ ] **Homework files.** Needs a private Vercel Blob store and `BLOB_READ_WRITE_TOKEN`. Verify: teacher attaches a 10 MB PDF → it uploads browser-to-Blob → student downloads it through `/api/files`.
- [ ] **AI grading.** Needs `GEMINI_API_KEY`. Without it the button reports "not configured". Verify on a photographed answer: a clear photo returns a score with a reason; a blank or unreadable one returns *needs review*, not a number.
- [ ] **Practice, review and the leaderboard.** Author questions in `/teacher/bank`, practise a lesson, then check XP, streak, mastery and the course leaderboard after enabling it.
- [ ] **Spaced review.** A finished practice run schedules its lesson for tomorrow; the next day `/review` offers it and the dashboard shows the card.
- [ ] **Exams.** Teacher builds a paper from the bank, publishes it, a student sits it. Verify the countdown auto-submits at zero, objective items mark instantly, written answers wait for the teacher, and the attempt limit blocks a second attempt.
- [ ] **Assignment resubmission.** Return a submission — the student must be able to resubmit. With the switch off and no return, they must be blocked.
- [ ] **Parent digest and the teacher check-on list.** Run `/api/cron/reminders` on a preview with a test parent; check the digest carries lessons, live, homework average and streak.

### Carried over

- [ ] **Admin catalog CRUD with a real admin login.** Verify: sign in as the owner → `/ar/admin/catalog` → create a test country, stage, grade and subject → check `/courses`, the country page and signup → delete or deactivate the test rows.
- [ ] **Contact form delivery.** No message was sent because `RESEND_API_KEY` is not set locally.
- [ ] **All transactional email.** Password reset, verification, paid receipt, answer notification, reminders and the digest share one mail path; none was delivered end to end.
- [ ] **PWA install and offline page.** Needs HTTPS; verify on the Vercel URL in Chrome.
- [ ] **Arabic headings across every page.** A visual pass at phone and desktop widths.
- [ ] **Stripe refund.** Not exercised against a paid test order.
- [ ] **Paymob card / wallet / kiosk / valU.** Not exercised in this release. Refunds are manual: refund in the Paymob dashboard, then "Mark refunded" in the admin order page.
- [ ] **Daily live sessions and attendance.** Room creation, token minting and attendance writes not re-tested.
- [ ] **VdoCipher and YouTube playback.** Not re-tested.
- [ ] **Parent linking with two real accounts.** Code generation, linking, dashboard and unlink not exercised.
- [ ] **New-country visuals and time zones.** The path is built; no new country was created.
- [ ] **Sitemap, canonical and OG in production.** Set `APP_URL`, then re-check `/sitemap.xml`, a course `<head>` and a share card.
- [ ] **Course OG image.** Deliberately English-titled: Satori's default font has no Arabic shaping.
- [ ] **CRON reminders.** `CRON_SECRET` is now set, so Vercel's daily run authenticates; it still has not been watched send real email.
- [ ] **Currencies beyond the seven.** EGP, SAR, AED, KWD, QAR, BHD and OMR only.
- [ ] **Privacy policy legal review.** Draft complete; needs the owner's advisor.
- [ ] **Search at scale.** `contains` only; add a trigram index if the catalog grows.
- [ ] **Content for the practice engine.** The engine is empty until questions are written — target ~20 per lesson, per subject.

---

## 3. Owner actions

### Payments and email

- [ ] **Stripe webhook for the live domain.** Test mode only, per the standing rule: add `https://<domain>/api/webhooks/stripe`, copy the signing secret into `STRIPE_WEBHOOK_SECRET`. Live keys stay off until the owner has the paperwork.
- [ ] **Paymob.** Callback and response URLs to `https://<domain>/api/webhooks/paymob`; `PAYMOB_HMAC_SECRET` and the four `PAYMOB_INTEGRATION_*` ids from the dashboard. EGP only.
- [ ] **Resend.** Verify the sending domain (SPF, DKIM, DMARC); set `RESEND_API_KEY` and `MAIL_FROM`.
- [ ] **Ziina is the only gateway (AED).** Stripe and Paymob are hidden until `STRIPE_ENABLED=1` / `PAYMOB_ENABLED=1`. Set `ZIINA_API_KEY` and leave `ZIINA_ENABLED` on; register the webhook at `https://<domain>/api/webhooks/ziina` in Ziina's dashboard. Keep `ZIINA_TEST=0` on production — a test intent completes without money and the code refuses it there anyway. Confirm the merchant fee in writing; their public fee page does not state one.
- [ ] **Support channels.** `SUPPORT_EMAIL`, `SUPPORT_PHONE`, `SUPPORT_WHATSAPP`, `OFFICIAL_CONTACTS` — the only contacts contact masking lets through.
- [ ] **One test purchase end-to-end** after DNS, because `APP_URL` changes the callbacks.

### Deployment and environment

Complete set the app reads, for Vercel **Production and Preview**:

| Var | Required | Purpose |
|---|---|---|
| `APP_URL` | yes | canonical, sitemap, OG, email links, Paymob callback |
| `AUTH_SECRET` | yes | session signing; generate per environment |
| `DATABASE_URL` | yes | Neon; see gate 0 |
| `SITE_PASSWORD` | set empty | non-empty puts the whole site behind basic auth |
| `CRON_SECRET` | yes | `/api/cron/reminders` rejects calls without it |
| `RESEND_API_KEY`, `MAIL_FROM` | yes | all transactional email |
| `BLOB_READ_WRITE_TOKEN` | yes | homework and exam file uploads |
| `VDOCIPHER_API_SECRET` | yes | paid video playback |
| `DAILY_API_KEY` | yes | live lectures |
| `PAYMOB_SECRET_KEY`, `PAYMOB_PUBLIC_KEY`, `PAYMOB_HMAC_SECRET`, `PAYMOB_INTEGRATION_{CARD,WALLET,KIOSK,VALU}` | for Egypt | without them EGP checkout falls back to Stripe |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | yes | test keys |
| `ZIINA_API_KEY` | beta | AED card payments; `ZIINA_ENABLED=0` switches them off |
| `SUPPORT_EMAIL`, `SUPPORT_PHONE`, `SUPPORT_WHATSAPP`, `OFFICIAL_CONTACTS` | recommended | support identity and masking allow-list |
| `GEMINI_API_KEY` | optional | AI grading (~0.5 fils a submission) |

- [x] **Vercel Blob store** — created private in `cdg1`; `BLOB_READ_WRITE_TOKEN` is set for Production and Preview. The upload and download paths still need a teacher-session test.
- [ ] **Reminder schedule.** The 15-minute live reminder needs a job that runs every 10 minutes, which Vercel Hobby cannot do. Create a free external scheduler (cron-job.org, GitHub Actions, or similar) calling `GET https://<domain>/api/cron/reminders` every 10 minutes with `Authorization: Bearer <CRON_SECRET>`. Leave `vercel.json` as it is: its daily 05:00 run is harmless and the external calls supply the cadence. The route returns 401 without the secret, and repeated runs inside a window collapse on the notification's dedupe key.
- [ ] **Renames.** Vercel project, GitHub repo and the local folder can be renamed by the owner; code identifiers were left alone.

### Product and legal

- [ ] **Legal entity and address** in `/terms`, `/privacy`, `/refund` — they must read "ذروة (Dhirwa), UAE" (the legal pages are owned by Content/SEO; check they were renamed); add the licence number and address.
- [ ] **Privacy review** by the owner's advisor.
- [ ] **Branded support address** — `SUPPORT_EMAIL` falls back to `chemical.mohammed@gmail.com`.
- [ ] **New-country art.** New countries get a code badge until flag/landmark art exists.
- [ ] **Catalog regions.** Add countries, grades and subjects only when tutor agreements are ready.

---

## 4. External services used at runtime or build time

| Service | Used for | Endpoint / domain | Environment | Code or config |
|---|---|---|---|---|
| **Vercel** | Hosting, builds, image generation, cron | `<domain>` | `APP_URL` | `.vercel/`, `vercel.json`, OG and icon routes |
| **Neon Postgres** | Primary database | `*.neon.tech` | `DATABASE_URL` | `prisma/schema.prisma`, `src/lib/db.ts` |
| **Vercel Blob** | Private homework and exam files | `*.private.blob.vercel-storage.com` | `BLOB_READ_WRITE_TOKEN` | `src/lib/blob.ts`, `/api/blob/upload`, `/api/files/[kind]/[id]` |
| **Google Gemini** | AI-assisted grading | `generativelanguage.googleapis.com` | `GEMINI_API_KEY` | `src/lib/ai-grading.ts` |
| **Stripe** | Card payments, Checkout, refunds, webhook | `api.stripe.com` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | `src/lib/stripe.ts`, `/api/checkout`, `/api/webhooks/stripe` |
| **Paymob** | EGP card, wallet, kiosk cash, valU | `accept.paymob.com` | `PAYMOB_*` | `src/lib/paymob.ts`, `/api/webhooks/paymob` |
| **VdoCipher** | DRM video OTP and player | `dev.vdocipher.com`, `player.vdocipher.com` | `VDOCIPHER_API_SECRET` | `src/lib/vdocipher.ts`, CSP `frame-src` |
| **Daily.co** | Live rooms and tokens | `api.daily.co`, `*.daily.co` | `DAILY_API_KEY` | `src/lib/daily.ts`, CSP and Permissions-Policy |
| **Resend** | Transactional email | `api.resend.com/emails`, `/emails/receiving` | `RESEND_API_KEY`, `MAIL_FROM` | `src/lib/mail.ts`, `src/lib/notify.ts` |
| **Google Fonts** | Readex Pro, IBM Plex Sans Arabic and Reem Kufi at build | `fonts.googleapis.com` | none | `layout.tsx`, `next/font` |
| **YouTube (nocookie)** | Free lesson embeds | `www.youtube-nocookie.com` | none | lesson player, CSP `frame-src` |
| **GitHub** | Source and Vercel integration | `<owner>/<repo>` | none | owner rename pending |
| **npm registry** | Dependencies | `registry.npmjs.org` | none | `package.json`, `package-lock.json` |
| **Vercel Cron** | `/api/cron/reminders` | internal | `CRON_SECRET` | `vercel.json` |
| **Analytics / Sentry** | Not installed | — | — | deferred |

### Build notes

- `npm run build` needs network access to Google Fonts. A transient fetch failure has been observed twice; retry the build if `next/font` fails.
- Migrations are additive; take a Neon branch snapshot before a launch-day migration.
- Settings the site no longer uses: nothing here.
