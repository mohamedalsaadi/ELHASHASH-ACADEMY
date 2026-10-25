# AAcademy launch checklist

Last updated: 2026-10-25 · release commit `89c6eec` (Phases 1–3).

This is the single place for: **what has not been verified**, **what only the owner can do**, and **every external service the app or its build uses**.

---

## 1. Not verified

Each line says what was checked instead, and how to close it.

- [ ] **Admin catalog CRUD with a real admin login.** Pages, actions, validation and delete guards typecheck and build; the route is protected, but no country/grade/subject was created through the UI because there is no admin password in this session. Verify: sign in as the owner → `/ar/admin/catalog` → create a test country, stage, grade and subject → check `/courses`, the country page and signup → delete or deactivate the test rows.
- [ ] **Contact form delivery.** The form, rate limit, honeypot and fallback are in place; no message was sent because `RESEND_API_KEY` is not set locally. Verify with a real key: send one message and confirm it arrives at the support inbox and `reply_to` is the sender.
- [ ] **All transactional email.** Password reset, email verification, paid receipt, answer notification, expiry/live reminders and the parent weekly summary use the same mail path; none was delivered end to end. Verify after Resend is configured.
- [ ] **PWA install and offline page.** Manifest, 192/512/maskable icons, service worker and `/ar/offline` are built and the icons return 200. Install needs HTTPS and a supported browser, so localhost is not a valid test. Verify on a Vercel preview/production URL in Chrome.
- [ ] **Intro duration and feel.** `--intro-k: 1.825` (3.65 s) and the `calc()` timeline are present in the built CSS; the animation was not visually timed. Verify in a fresh tab in both locales.
- [ ] **Arabic headings across every page.** The Kufi override is gone and Readex applies, but a visual pass over all screens was not possible here. Verify ar pages at phone and desktop widths.
- [ ] **Stripe refund.** The action calls the Stripe refund API and revokes access; it was not exercised against a paid test order. Verify with a test card and the live webhook.
- [ ] **Paymob card / wallet / kiosk / valU.** Existing integration; not exercised in this release. Paymob refunds are not automatic — refund in the Paymob dashboard, then use “Mark refunded” in the admin order page.
- [ ] **Daily live sessions and attendance.** Existing feature; room creation, token minting and attendance writes were not re-tested. Verify one live session with a student and a teacher.
- [ ] **VdoCipher and YouTube playback.** Existing feature; not re-tested in this release.
- [ ] **Parent linking with two real accounts.** Code generation, linking, dashboard and unlink were not exercised with two accounts.
- [ ] **New-country visuals and time zones.** The new-country path is built with a code badge, null landmark and per-country IANA zone; no new country was created. Verify with a test country after the admin check above.
- [ ] **Sitemap, canonical, OG and sitemap URLs in production.** Locally `APP_URL` is empty, so links resolve to `http://localhost:3000`. Set `APP_URL` and re-check `/sitemap.xml`, a course `<head>` and a share card.
- [ ] **Course OG image.** It renders and returns PNG. It deliberately uses the **English** course title because Satori’s default font has no Arabic shaping; the Arabic share image is not localized. Verify how it looks when shared.
- [ ] **CRON reminders.** `/api/cron/reminders` returns 401 without `CRON_SECRET`; it was not run with the secret because it would send real emails. Verify on a preview with a test user.
- [ ] **Brand in delivered emails.** Subjects, header and CTA now say AAcademy; no email was delivered to see the rendering.
- [ ] **Live site with the new code.** The connected Neon database is already migrated and the **current (old) deployment** still returns 200 on home, courses and the EG country page. The new code is committed but not pushed, so the new catalog/admin/Phase 3 UI is not live yet.
- [ ] **Currencies beyond the seven.** EGP, SAR, AED, KWD, QAR, BHD and OMR are supported; any other currency is a separate pricing/gateway change.
- [ ] **Privacy policy legal review.** The Arabic and English draft is complete but must be reviewed before launch.
- [ ] **Search at scale.** `contains` works on the current catalog; no trigram index exists. Add one only if the catalog grows or search feels slow.

---

## 2. Owner actions

### Payments and email

- [ ] **Stripe webhook for the live domain.** In the Stripe dashboard (test mode), add `https://<domain>/api/webhooks/stripe`, copy its signing secret into Vercel as `STRIPE_WEBHOOK_SECRET`. Without it, paid orders stay PENDING and coupons/receipts cannot be proven.
- [ ] **Resend account and sender domain.** Verify the sending domain (SPF, DKIM, DMARC) and set `RESEND_API_KEY` and `MAIL_FROM` in Vercel. Without them, email is skipped and the contact form shows the direct address.
- [ ] **WhatsApp channel.** The owner said they will set this up. Once ready, set `SUPPORT_WHATSAPP` (and `SUPPORT_PHONE`) in Vercel so the official number appears and survives contact masking.
- [ ] **Paymob refunds.** Refunds are executed in the Paymob dashboard, then recorded with “Mark refunded” in the admin order page.

### Deployment and domain

- [ ] **Push/deploy approval.** The release is committed locally only. A push to `main` triggers the Vercel production deploy.
- [ ] **Custom domain and DNS.** Point the domain in Vercel (A record `76.76.21.21` for `@`, CNAME `cname.vercel-dns.com` for `www`, or Vercel nameservers), then set `APP_URL` to the final `https://` origin and move the Stripe/Paymob webhooks if the domain changes.
- [ ] **Vercel environment variables.** `DATABASE_URL`, `AUTH_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYMOB_*`, `VDOCIPHER_API_SECRET`, `DAILY_API_KEY`, `RESEND_API_KEY`, `MAIL_FROM`, `CRON_SECRET`, `APP_URL`, optional `SUPPORT_PHONE`, `SUPPORT_WHATSAPP`, `OFFICIAL_CONTACTS`, `SITE_PASSWORD`.
- [ ] **Reminder schedule.** Vercel Hobby runs crons daily; the one-hour live reminder is only exact if the job runs hourly (Pro or an external scheduler).
- [ ] **Database migration.** `20261025120000_catalog_admin` is already applied to the connected Neon database. If Vercel uses a different database, run `npx prisma migrate deploy` against it before deploying. Keep a Neon branch/backup for future schema changes.
- [ ] **Renames.** Vercel team/project (`elhashash-academy`), GitHub repo (`ELHASHASH-ACADEMY`), and the local folder can be renamed by the owner; package/repo/internal identifiers in code were intentionally left unchanged.

### Product and legal

- [ ] **Privacy review.** Have the drafted `/privacy` page reviewed by the owner’s legal advisor; add the correct legal entity and contact if different.
- [ ] **Support address.** `chemical.mohammed@gmail.com` is hardcoded in `src/lib/site.ts`; consider a branded support address when the domain is live.
- [ ] **New-country art.** New countries get a code badge and no landmark until flag/landmark art is provided.
- [ ] **Catalog regions.** Add countries/grades/subjects only when tutor agreements are ready; inactive rows stay hidden, active empty rows show “coming soon”.
- [ ] **Later batch decisions.** Homework, quizzes and optional handouts need storage. Reviews, referral, analytics/Sentry, teacher profiles/payouts, gamification, live recording and operations are deferred. **Certificates are removed for now.**

---

## 3. External services and sub-websites used in the build

Runtime and build-time services only. Agent tooling (Runpod, viznoir MCP) is not part of the application.

| Service | Used for | Endpoint / domain | Environment | Code or config |
|---|---|---|---|---|
| **Vercel** | Hosting, production builds, image generation, cron trigger | `alsaadi-academy.vercel.app`; Vercel dashboard | `APP_URL` | `.vercel/`, `vercel.json`, `src/app/opengraph-image.tsx`, `src/app/pwa-icon-*.png/route.tsx` |
| **Neon Postgres** | Primary database | `*.neon.tech` | `DATABASE_URL` | `prisma/schema.prisma`, `src/lib/db.ts` |
| **Stripe** | Card payments, Checkout, refunds, webhook | `api.stripe.com`, Stripe dashboard | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | `src/lib/stripe.ts`, `src/app/api/checkout/route.ts`, `src/app/api/webhooks/stripe/route.ts` |
| **Paymob** | EGP card, mobile wallet, kiosk cash, valU; webhook | `accept.paymob.com` (`/v1/intention/`, `/unifiedcheckout/`), Paymob dashboard | `PAYMOB_SECRET_KEY`, `PAYMOB_PUBLIC_KEY`, `PAYMOB_HMAC_SECRET`, `PAYMOB_INTEGRATION_*` | `src/lib/paymob.ts`, `src/app/api/webhooks/paymob/route.ts` |
| **VdoCipher** | DRM video OTP and player | `dev.vdocipher.com/api/videos/.../otp`, `player.vdocipher.com` | `VDOCIPHER_API_SECRET` | `src/lib/vdocipher.ts`, `next.config.ts` frame-src |
| **Daily.co** | Live rooms, prejoin, chat, meeting tokens | `api.daily.co/v1`, `*.daily.co` | `DAILY_API_KEY` | `src/lib/daily.ts`, `src/app/[locale]/live/[id]/page.tsx`, CSP/Permissions-Policy |
| **Resend** | Transactional email | `api.resend.com/emails` | `RESEND_API_KEY`, `MAIL_FROM` | `src/lib/mail.ts`, `src/lib/notify.ts` |
| **Google Fonts** | Readex Pro, fetched at build by `next/font/google` | `fonts.googleapis.com`, `fonts.gstatic.com` | none | `src/app/[locale]/layout.tsx` |
| **YouTube (nocookie)** | Free/marketing lesson embeds | `www.youtube-nocookie.com` | none | lesson player, CSP frame-src |
| **GitHub** | Source repository and Vercel integration | `github.com/mohamedalsaadi/ELHASHASH-ACADEMY` | none | owner rename pending |
| **npm registry** | Dependencies at install/build | `registry.npmjs.org` | none | `package.json`, `package-lock.json` |
| **WhatsApp** | Optional support link only; no API integration yet | `wa.me` link when set | `SUPPORT_WHATSAPP` | `src/lib/site.ts`, contact page/footer |
| **Support mailbox** | Support address shown to users | Google/Gmail mailbox | none | `CONTACT_EMAIL` in `src/lib/site.ts` |
| **Custom domain / DNS** | Final public origin | registrar + Vercel DNS | `APP_URL` | owner action; `alsaadi.academy` appears only as a Paymob fallback email/comment |
| **Vercel Cron** | Calls `/api/cron/reminders` | internal to Vercel | `CRON_SECRET` | `vercel.json`, `src/app/api/cron/reminders/route.ts` |
| **Vercel Analytics / Sentry** | Not installed (deferred) | — | — | later batch |
| **WhatsApp Cloud API** | Not integrated (deferred; owner setup) | — | `SUPPORT_WHATSAPP` only links | later batch |

### Build notes

- `npm run build` needs network access to Google Fonts. A transient font fetch failure was observed; retry the build if `next/font` fails.
- The production build writes generated route types; removing a page can leave a stale `.next/types` entry until the next build. `npm run build` regenerates it.
- Migrations are additive. The catalog migration converts `Country.code` from the `CountryCode` enum to text and backfills 21 stages; keep a branch/backup for future production migrations.
