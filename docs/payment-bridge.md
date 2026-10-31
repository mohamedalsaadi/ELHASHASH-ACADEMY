# Payment bridge: bank transfer until the Stripe live account is ready

**Status:** temporary mitigation. Not a product feature. Remove it when Stripe live is on.
**Opened:** 2026-11-02. **Owner:** the academy owner. **Review trigger:** the day the
AAcademy trade licence is issued and Stripe live keys are enabled.

## Why this exists

The academy cannot take card payments yet: the business licence is still being issued, Stripe
is deliberately on **test** keys, and Paymob needs a commercial registration the owner does not
have yet. Students still need to enrol now, and the owner needs the money recorded properly.

So the platform takes money **outside** the app — a plain bank transfer — and only records the
result. No card data, no gateway, no funds held by the platform.

This is **not** a way around licensing, and it does not pretend to be a gateway. It is a
manual process the owner already runs, with the bookkeeping moved into the app so nothing is
lost and every sale writes a ledger row.

## How it works

1. The student picks a plan and asks to pay by bank transfer. The app creates a `PENDING`
   order with `gateway: MANUAL` at the server price and shows the academy's bank details plus
   the order id as the transfer reference.
2. The student transfers the money directly to the academy's account and may attach a receipt.
3. The owner sees the transfer in the bank. Either:
   - the owner clicks **Mark paid** on the order, or
   - the bank's own alert email arrives at the inbound address, is authenticated, names the
     order id in the transfer note, matches the amount exactly, and — only then, and only with
     both switches on — the order settles automatically.
4. Either path ends at the same place: `applyPaymentOutcome` grants access, writes the
   immutable ledger row (30/70 split, VAT as configured), and emails the receipt.

Everything uncertain goes to `/admin/transfers` for one-click approval. A student's uploaded
receipt is supporting evidence, never proof: it can be edited, so it never approves anything
on its own.

## What this is not

- Not a card processor and not a merchant of record.
- Not a substitute for a licence, a TRN, or VAT registration.
- Not a place where the platform holds or moves customer money.
- Not permanent. It is expected to be switched off.

## Removing it when Stripe live is ready

Order matters; each step is reversible until step 5.

1. **Clear the IBAN** in `/admin/settings` → Bank transfer details. The transfer option
   disappears from every course page immediately; no deploy needed.
2. Set `BANK_AUTO_APPROVE=0`, then the admin toggle off, so no alert can settle anything.
3. Disable the inbound webhook in the Resend dashboard and remove the `email.received`
   endpoint. The route then returns `500 not_configured` and never runs.
4. Remove `RESEND_WEBHOOK_SECRET`, `BANK_INBOUND_ADDRESS`, `BANK_SENDER_ALLOWLIST`,
   `BANK_AUTO_APPROVE` from Vercel. Point the bank's alerts back to ordinary email.
5. Only after confirming no pending manual orders remain: the code can stay dormant
   (it does nothing without an IBAN and the env vars) or be deleted in a later cleanup. Deleting
   is optional; leaving it dormant is harmless and faster to reverse.
6. **Never delete the `Order`, `LedgerEntry`, `BankEmail` or `PaymentEvent` history.** It is
   the accounting record of real money and must survive the switch to Stripe.

Once Stripe live is enabled, Stripe becomes the only gateway; the manual flow remains available
only for an exception the owner handles by hand, as it always did.

## Guardrails already in place

- Stripe stays on test keys until the owner says otherwise; no live key is stored.
- Auto-approval requires a signed webhook, an allowlisted sender, SPF/DKIM/DMARC alignment,
  one order id, exact amount and exact currency. Anything else queues.
- VAT is off; when switched on it is added on top and shown to the payer and on the receipt.
- The ledger records the split the order was priced with; changing rates later never rewrites
  history.

## Decision log

| Date | Decision |
|---|---|
| 2026-11-02 | Bank transfer + receipt + owner approval built as the bridge. |
| 2026-11-02 | Bank-alert email path added, auto-approval off by default, exact-match only. |
| — | Pending: licence issued → Stripe live → remove the bridge per the steps above. |
