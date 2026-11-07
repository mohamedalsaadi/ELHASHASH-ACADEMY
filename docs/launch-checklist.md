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
- [ ] Vercel → Settings → Environment Variables → `DATABASE_URL`. The host must be the pooled Frankfurt endpoint shown in the Neon console (it is not written here: this repository is public). If it is a different database, run `npx prisma migrate deploy` against it and re-run `npx tsx prisma/seed-uae-prices.ts --apply` first. Without this, every signed-in screen errors on missing tables.

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
- [x] **Reminders removed (2026-11-05).** The cron route, its scheduler and the expiry/live reminders are gone. The weekly parent digest and the owner's morning briefing lived in the same route and went with it.

### Carried over

- [ ] **Admin catalog CRUD with a real admin login.** Verify: sign in as the owner → `/ar/admin/catalog` → create a test country, stage, grade and subject → check `/courses`, the country page and signup → delete or deactivate the test rows.
- [ ] **Contact form delivery.** No message was sent because `RESEND_API_KEY` is not set locally.
- [ ] **All transactional email.** Password reset, verification, paid receipt, answer notification, reminders and the digest share one mail path; none was delivered end to end.
- [ ] **Google sign-in end to end.** Needs `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` (owner action 3). Verify: a Google email with no Dhirwa account lands on `/complete-profile`, saves phone, grade and birth date, and reaches the dashboard; the next Google sign-in goes straight to the dashboard.
- [ ] **Apple Pay and Google Pay at checkout.** Ziina's payment page offers both when the device and browser support them; the checkout form says so. Not seen on a real payment, because no Ziina intent has completed with money.
- [ ] **Monthly progress note.** `/api/cron/progress` sends one email per linked parent on the 1st. Never run against real data.
- [ ] **PWA install and offline page.** Needs HTTPS; verify on the Vercel URL in Chrome.
- [ ] **Arabic headings across every page.** A visual pass at phone and desktop widths.
- [ ] **Stripe refund.** Not exercised against a paid test order.
- [ ] **Paymob card / wallet / kiosk / valU.** Not exercised in this release. Refunds are manual: refund in the Paymob dashboard, then "Mark refunded" in the admin order page.
- [ ] **Teacher-hosted live lectures.** Link validation, the consent gate and the join page are covered by `e2e/live.spec.ts`; a real Zoom/Meet link pasted by a teacher has not been clicked by a person.
- [ ] **VdoCipher and YouTube playback.** Not re-tested.
- [ ] **Parent linking with two real accounts.** Code generation, linking, dashboard and unlink not exercised.
- [ ] **New-country visuals and time zones.** The path is built; no new country was created.
- [ ] **Sitemap, canonical and OG in production.** Set `APP_URL`, then re-check `/sitemap.xml`, a course `<head>` and a share card.
- [ ] **Course OG image.** Deliberately English-titled: Satori's default font has no Arabic shaping.
- [ ] **Currencies beyond the seven.** EGP, SAR, AED, KWD, QAR, BHD and OMR only.
- [ ] **Privacy policy legal review.** Draft complete; needs the owner's advisor.
- [ ] **Search at scale.** `contains` only; add a trigram index if the catalog grows.
- [ ] **Content for the practice engine.** The engine is empty until questions are written — target ~20 per lesson, per subject.

---

## 3. Owner actions

### Payments and email

- [ ] **Stripe webhook for the live domain.** Test mode only, per the standing rule: add `https://<domain>/api/webhooks/stripe`, copy the signing secret into `STRIPE_WEBHOOK_SECRET`. Live keys stay off until the owner has the paperwork.
- [ ] **Paymob.** Callback and response URLs to `https://<domain>/api/webhooks/paymob`; `PAYMOB_HMAC_SECRET` and the four `PAYMOB_INTEGRATION_*` ids from the dashboard. EGP only.
- [x] **Resend DNS (2026-11-06).** DKIM at `resend._domainkey`; root SPF `v=spf1 include:amazonses.com ~all`; `_dmarc` `v=DMARC1; p=none; rua=mailto:dmarc@dhirwa.ae`. Reports go to `dmarc@dhirwa.ae`, received by Resend inbound; tighten to `p=quarantine` after two clean weeks. `RESEND_API_KEY` and `MAIL_FROM` are set.
- [ ] **Ziina is the only gateway (AED).** Stripe and Paymob are hidden until `STRIPE_ENABLED=1` / `PAYMOB_ENABLED=1`. Set `ZIINA_API_KEY` and leave `ZIINA_ENABLED` on; register the webhook at `https://<domain>/api/webhooks/ziina` in Ziina's dashboard. Keep `ZIINA_TEST=0` on production — a test intent completes without money and the code refuses it there anyway. Confirm the merchant fee in writing; their public fee page does not state one.
- [ ] **Support channels.** `SUPPORT_EMAIL`, `SUPPORT_PHONE`, `SUPPORT_WHATSAPP`, `OFFICIAL_CONTACTS` — the only contacts contact masking lets through.
- [ ] **Google sign-in.** Google Cloud console → Credentials → OAuth client (Web). Authorised redirect URI `https://dhirwa.ae/api/auth/callback/google` (and `http://localhost:3000/api/auth/callback/google` for local work). Put both values in Vercel as `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`. Microsoft works the same way (`AUTH_MICROSOFT_ENTRA_ID_ID`/`_SECRET`, Entra app registration, redirect URI `https://dhirwa.ae/api/auth/callback/microsoft-entra-id`). Until they are set, the provider and its button stay off and phone/password sign-in is unchanged. The OAuth consent screen needs the app's privacy policy URL and must be published, or only test users can sign in.
- [ ] **One test purchase end-to-end** after DNS, because `APP_URL` changes the callbacks.

### Deployment and environment

Complete set the app reads, for Vercel **Production and Preview**:

| Var | Required | Purpose |
|---|---|---|
| `APP_URL` | yes | canonical, sitemap, OG, email links, Paymob callback |
| `AUTH_SECRET` | yes | session signing; generate per environment |
| `DATABASE_URL` | yes | Neon; see gate 0. End it with `sslmode=verify-full`, not `sslmode=require` (see the SSL note below) |
| `SITE_PASSWORD` | set empty | non-empty puts the whole site behind basic auth |
| `CRON_SECRET` | yes | the daily retention job at `/api/cron/retention` returns 401 without it |
| `RESEND_API_KEY`, `MAIL_FROM` | yes | all transactional email |
| `BLOB_READ_WRITE_TOKEN` | yes | homework and exam file uploads |
| `VDOCIPHER_API_SECRET` | yes | paid video playback |
| `PAYMOB_SECRET_KEY`, `PAYMOB_PUBLIC_KEY`, `PAYMOB_HMAC_SECRET`, `PAYMOB_INTEGRATION_{CARD,WALLET,KIOSK,VALU}` | for Egypt | without them EGP checkout falls back to Stripe |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | yes | test keys |
| `ZIINA_API_KEY` | beta | AED card payments; `ZIINA_ENABLED=0` switches them off |
| `STRIPE_CURRENCIES` | if Stripe is on | comma-separated currencies Stripe may take; empty takes none |
| `STRICT_CURRENCY` | after audit | `1` refuses a SKU whose currency differs from its course country |
| `SUPPORT_EMAIL`, `SUPPORT_PHONE`, `SUPPORT_WHATSAPP`, `OFFICIAL_CONTACTS` | recommended | support identity and masking allow-list |
| `GEMINI_API_KEY` | optional | AI grading (~0.5 fils a submission) |

- [x] **Vercel Blob store** — created private in `cdg1`; `BLOB_READ_WRITE_TOKEN` is set for Production and Preview. The upload and download paths still need a teacher-session test.
- [ ] **`sslmode=verify-full` in `DATABASE_URL`** (audit #47). Production logs carry `SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca' are treated as aliases for 'verify-full'`, emitted by `pg-connection-string` 8.x. `.env.local` and Neon's default both say `sslmode=require`. Change that one parameter to `verify-full` in Vercel (Production and Preview) and locally. Behaviour does not change under `pg` 8.23 — `require` is already treated as `verify-full` — but the warning stops and the intent becomes explicit. No code change: the value lives in the environment.
- [ ] **Renames.** Vercel project, GitHub repo and the local folder can be renamed by the owner; code identifiers were left alone.

### Product and legal

- [ ] **Legal entity and address** in `/terms`, `/privacy`, `/refund` — they must read "ذروة (Dhirwa), UAE" (the legal pages are owned by Content/SEO; check they were renamed); add the licence number and address.
- [ ] **AED price on every package.** Model 1 charges every market in AED. Set the “AED price (charged)” on
  each package and rental in Admin → course. A package without one is display-only and shows “payment opens
  soon”. The local price is the reference, not the charge.
- [ ] **Suggestion rates.** Before onboarding a non-AED teacher, enter the AED-per-unit rate for their currency
  in Admin → Settings. On their packages, tick “use today’s rate” and review the AED price. The saved AED
  price is the charge.
- [ ] **Ziina international cards.** Confirm in writing that international cards are enabled, the exact
  international-card fee (about 4.1% + AED 1), and whether Egyptian-issued cards are accepted. Factor the fee
  into the platform share; the ledger does not record gateway fees.
- [ ] **Seller identity for documents.** Fill `sellerLegalName`, `sellerAddress` and `sellerLicenceNo` in Admin → Settings. Add the TRN to the UAE country row in Admin → Catalog. Documents omit a missing line; they never print a placeholder.
- [ ] **VAT registration.** Do not tick the master VAT switch or the UAE country switch until the TRN is issued. The rate and TRN then print on every tax invoice. Before switching it on, check with an adviser whether prices shown to UAE consumers must include VAT: checkout currently adds VAT on top of the listed price, which can read as a hidden fee.
- [ ] **Corporate-tax contribution.** Confirm the 9% base with the accountant. The switch is off; when on, it deducts from the teacher’s share and appears only on statements.
- [ ] **DPAs and ROPA.** Accept and file a DPA for every supplier in `docs/compliance/processors.md`. Review `docs/compliance/ropa.md` with the privacy adviser.
- [ ] **Age assurance.** Signup now asks for a date of birth; under-18 accounts need a guardian email confirmation. Review the privacy notice wording and the under-13 block.
- [ ] **Referral settings.** Set the new-family and referrer percentages in Admin → Settings. Both are capped at the platform share; zero pauses the programme.
- [ ] **Privacy review** by the owner's advisor.
- [ ] **Branded support address** — `SUPPORT_EMAIL` falls back to `chemical.mohammed@gmail.com`.
- [ ] **New-country art.** New countries get a code badge until flag/landmark art exists.
- [ ] **Catalog regions.** Add countries, grades and subjects only when tutor agreements are ready.
- [ ] **Currency audit.** List SKUs whose currency differs from their course country. Fix or quarantine them before setting `STRICT_CURRENCY=1`.
- [ ] **Receipt PDFs.** The PDF is English-labelled because the standard PDF fonts have no Arabic glyphs; the HTML receipt is the Arabic copy. Confirm that is acceptable for the accountant.


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
| **Resend** | Transactional email | `api.resend.com/emails`, `/emails/receiving` | `RESEND_API_KEY`, `MAIL_FROM` | `src/lib/mail.ts`, `src/lib/notify.ts` |
| **Google Fonts** | Readex Pro, IBM Plex Sans Arabic and Reem Kufi at build | `fonts.googleapis.com` | none | `layout.tsx`, `next/font` |
| **YouTube (nocookie)** | Free lesson embeds | `www.youtube-nocookie.com` | none | lesson player, CSP `frame-src` |
| **GitHub** | Source and Vercel integration | `<owner>/<repo>` | none | owner rename pending |
| **npm registry** | Dependencies | `registry.npmjs.org` | none | `package.json`, `package-lock.json` |
| **Vercel Cron** | none | — | — | `vercel.json` has no crons |
| **Analytics / Sentry** | Not installed | — | — | deferred |

### Build notes

- `npm run build` needs network access to Google Fonts. A transient fetch failure has been observed twice; retry the build if `next/font` fails.
- Migrations are additive; take a Neon branch snapshot before a launch-day migration.
- Settings the site no longer uses: nothing here.
