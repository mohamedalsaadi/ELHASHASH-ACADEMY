# Site log: sources and what they mean

Everything below is written to the `SiteLog` table (read it at `/admin/logs`, or `node --env-file=.env.local scripts/logs.mjs level=ERROR source=payment n=50`).
Lines are plain facts: a step, a status code, an id. Never a request body, a password, a phone number, an email address or a query string.
Entries older than 30 days are removed (the writer trims, and `/api/cron/retention` trims a quiet site). The meaning of each known problem, and who has to act,
is in `src/lib/log-catalog.ts`; the log page shows it beside each line.

Levels: `INFO` something finished (heartbeats), `WARN` a refusal or a limit, `ERROR` something failed. Add a source here when you add a `logError` / `logWarn` call.

| Source | Level | Written by | Means |
|---|---|---|---|
| `server.error` | ERROR | `src/instrumentation.ts` | A page, route or action threw. `path`, route and digest are in the line and `meta`. |
| `auth.error` | ERROR | `src/auth.ts` logger | Auth.js hit an unexpected error during sign-in (the "Server error" page). Wrong passwords are not logged. |
| `auth.refused` | WARN | `src/auth.ts` | Sign-in refused: too many attempts, account locked, staff via Google or phone, erased account, unverified Google email. |
| `payment.gateway` | ERROR | `api/checkout` | The gateway would not create a payment. The order is marked FAILED. |
| `payment.orphan` | ERROR | `api/checkout` | A payment exists at the gateway but its id is not on our order. The customer may have paid: check Ziina. |
| `payment.mismatch` | ERROR | `lib/ziina.ts` | A completed Ziina payment does not match the order amount or currency. Not settled. |
| `payment.webhook` | ERROR / WARN | webhooks | Ziina webhook failed (Ziina retries), key missing, or a Stripe or Paymob call with a bad signature. |
| `payment.result_sync` | ERROR | `checkout/result` | The page could not ask Ziina what happened. |
| `payment.receipt`, `payment.referral`, `payment.invoice` | ERROR | `lib/payments.ts` | The payment settled but a follow-up step failed. Access was granted. |
| `payment.checkout_invalid` | WARN | `api/checkout` | The browser sent a checkout body that failed validation. |
| `ratelimit.checkout`, `ratelimit.redis` | WARN | checkout, `lib/rate-limit.ts` | The checkout limit was hit, or Redis failed and limits use the database. |
| `otp.too_many` | WARN | `signin/otp-actions.ts` | Too many sign-in codes asked for or checked. |
| `whatsapp.send` | ERROR | `lib/whatsapp.ts` | Meta refused or did not answer: expired token, template not approved. The student sees "send failed". |
| `mail.send` | ERROR | `lib/mail.ts` | Resend refused or did not answer, or `RESEND_API_KEY` is missing. |
| `ai.error` | ERROR / WARN | `lib/ai.ts` | Gemini timed out, answered with an error, or returned JSON that failed the schema. |
| `video.playback` | ERROR | lesson page | A student could not start a lesson video (VdoCipher token failed). |
| `vdocipher.slot`, `client.vdo_upload` | INFO / ERROR | upload route, uploader | Admin video upload: slot opened or refused, browser upload finished or failed. |
| `blob.upload`, `blob.head`, `pdf.store` | WARN | Blob helpers, PDF route | A file upload was refused, a stored file could not be read, or a PDF could not be stored. |
| `db.unreachable`, `db.schema` | ERROR | `api/health` | The database did not answer, or its schema is behind the deployed code. |
| `cron.<name>` | INFO / ERROR / WARN | `lib/cron-log.ts` | `finished` (heartbeat with `ms`), `failed`, or `refused` (wrong or missing `CRON_SECRET`). A job with no heartbeat for a day is a finding. |
| `turnstile.open` | WARN | `lib/turnstile.ts` | Cloudflare did not answer and the form was let through (it fails open). |
| `support.ticket` | ERROR | `contact/actions.ts` | A support message could not be saved. |
| `analytics.write` | WARN | `lib/analytics.ts` | A behaviour event could not be saved. |
| `client.error`, `client.unhandled` | ERROR | browser | A page crashed (`error.tsx` boundary) or threw an uncaught error or rejected promise. |
| `client.checkout`, `client.upload` | ERROR | browser | The pay button's request failed or was refused; a homework or image upload failed. |
| `admin.subscriber_grade` | INFO | admin actions | An admin changed a student's grade. |

Browser lines come through `POST /api/log`: anonymous callers are limited to 20 per 10 minutes per address, only the sources above, and the same page and message are sent once.
