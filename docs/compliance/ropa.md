# Record of Processing Activities (ROPA)

**What this is.** A ROPA is a register of every kind of personal data Dhirwa handles: why it is collected,
who can see it, where it is stored, how long it is kept, and which supplier touches it. UAE, Saudi and
Egyptian data-protection rules all expect one. It is not a public document. Keep it current when a feature
adds a new kind of data.

**Owner.** The account holder named in `PlatformSetting.sellerLegalName`.
**Last reviewed.** 2026-11-06.
**Status.** Drafted from the schema and the code paths. The owner and a privacy adviser must review it.

## Plain-language summary

- We collect what a school needs: who the student is, who pays, what they study, and what the teacher earns.
- We do not sell data and we do not run advertising trackers.
- We keep payment and tax records after an account is deleted because accounting law requires it. The
  person’s name is removed from everything else.
- A guardian’s email is used for one thing: confirming consent for a student under 18.

## Processing activities

| # | Activity | Data | People | Why (lawful basis) | Where | Kept for | Suppliers |
|---|---|---|---|---|---|---|---|
| 1 | Account and sign-in | Name, mobile, email, password hash, role, locale, grade, date of birth | Students, parents, teachers, admins | Contract; age assurance is a legal obligation | Neon Postgres | While the account is open; erasure blanks the personal fields | Neon, Vercel |
| 2 | Guardian consent | Student link, guardian name, guardian email, consent text version, timestamps, token hash | Students under 18 and their guardians | Legal obligation (child safety); consent | Postgres | While the student is a minor, then as evidence | Neon, Resend |
| 3 | Course access and progress | Entitlements, lesson views, completion, confidence taps, practice and exam attempts, marks | Students | Contract | Postgres | While the account is open; progress may be kept in aggregate | Neon, VdoCipher, Daily |
| 4 | Orders and payments | Order lines, amounts, currency, gateway reference, payment events, VAT, invoice number, buyer and student names at the time | Buyers, students | Contract; legal obligation (tax and accounting) | Postgres, Vercel Blob (PDF) | 5–7 years from the end of the tax year; confirm the exact period with the accountant | Ziina, Neon, Vercel |
| 5 | Teacher earnings and statements | Ledger rows, share, corporate-tax contribution, payout, acknowledgement, bank details for payout (account holder, bank, IBAN; read in full only by the owner), payment reference | Teachers | Contract; legal obligation | Postgres | 5–7 years | Neon |
| 6 | Live lectures | Attendance, join time, guardian consent, room tokens | Students, teachers | Contract; legal obligation for minors | Postgres, Daily | While the course runs; attendance kept for the term | Daily, Neon |
| 7 | Homework, questions and grading | Uploaded files, answers, marks, feedback, AI metadata (never the prompt or reply) | Students, teachers | Contract; AI use is disclosed in the terms | Postgres, Vercel Blob, Google Gemini (only when AI grading is on) | While the course runs; files deleted with the account | Vercel, Gemini |
| 8 | Support and contact | Name, contact, message, ticket status | Anyone who writes in | Legitimate interest; contract | Postgres, Resend | 12 months after the ticket closes, then purged | Neon, Resend |
| 9 | Product analytics | Pseudonymous session id, event name, course and role, no message text | Visitors and signed-in users | Legitimate interest (improving the service) | Postgres | 90 days, then purged | Neon |
| 10 | Teacher applications | Name, contact, country, credentials, review notes | Applicants | Contract; legitimate interest | Postgres | 12 months after a decision | Neon, Resend |
| 11 | Referrals | Referral code, referrer, referred account, discount, reward coupon | Students and parents | Contract; legitimate interest (growth) | Postgres | While the programme runs | Neon |
| 12 | Security and abuse prevention | Login attempts, IP address, device cookie, user agent | Anyone signing in | Legitimate interest (security) | Postgres | 24 hours for attempts; session data while the device is active | Neon |

## Retention and erasure

- `/account` deletes an account. `src/lib/erasure.ts` blanks name, email, phone, photo and password, and the
  account can no longer sign in.
- Orders, ledger rows and issued documents survive because tax law requires them. They keep the buyer and
  student names **as snapshotted at the time**, so a receipt still identifies who paid after the account is
  gone. This is deliberate and must match the privacy notice.
- Analytics and closed support tickets are purged by `/api/cron/retention`.
- The ROPA does not include a legal-hold feature. If a dispute starts, stop the erasure and keep the records.

## Transfers outside the UAE

- The database is in Frankfurt (`eu-central-1`) and Vercel functions run in `dxb1` (Dubai).
- Transfers rely on the suppliers’ standard contractual clauses and the necessity of the processing. The
  owner should keep a signed or accepted DPA for each supplier (see `processors.md`).
- Saudi and Egyptian users are told in the privacy notice which suppliers process their data.

## Rights and contacts

- Access, correction, export and erasure requests go to `SUPPORT_EMAIL`.
- The privacy notice explains the rights and the retention exception for tax records.
- A request that cannot be met (for example, deleting an invoice) is answered in writing with the reason.

## Gaps the owner must close

- Legal entity name, address, licence and TRN in `PlatformSetting` (they print on documents).
- A privacy adviser’s review of the notice and this register.
- Signed or accepted DPAs for every supplier in `processors.md`.
- The exact accounting retention period, confirmed by the accountant.
- A written breach-response procedure (who is told, within what time, by whom).
