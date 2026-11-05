# Dhirwa

Arabic-first tutoring platform for secondary students across the GCC and Egypt. Live at
https://dhirwa.ae.

## Run it

```bash
npm install
cp .env.example .env.local     # then fill it in; nothing works without a database
npm run dev                    # http://localhost:3000
```

## Check it

```bash
npx tsc --noEmit               # types
npm run lint                   # eslint
npm test                       # vitest, pure logic only
npm run build                  # production build
npm run e2e                    # Playwright on a throwaway Postgres (about 17 minutes)
```

`npm run e2e` starts its own database, applies every migration, seeds it and deletes it afterwards.
It never reads the real `DATABASE_URL`, and it blanks every service key.

## Before you change anything

Read, in this order: `AGENTS.md` (rules), `DESIGN.md` (visual system, tokens in
`src/app/tokens.css`), `docs/WORKLOG.md` (what changed and why), `docs/HANDOFF.md` (live state),
`docs/audit.md` (known gaps).

Two rules that are easy to break: the Stripe keys stay on test, and `.env.local`'s `DATABASE_URL` is
production — never run a migration or a destructive query against it without the owner's approval.

## Layout

- `src/app/[locale]/` — pages, `ar` and `en`; Arabic is the default locale and the site is RTL.
- `src/components/` — shared UI; `src/lib/` — logic, with pure modules kept free of database imports
  so they are unit-testable.
- `prisma/` — schema and additive migrations.
- `messages/{ar,en}.json` — every string, both languages, same keys.
- `e2e/` — Playwright specs and their seeding helpers.
