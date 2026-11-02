# Sabboura: rules for every agent

Brand: **Sabboura** (سبّورة, "blackboard"; the registered trade name). The Arabic locale writes سبّورة, the English locale Sabboura. Audience: Arabic-speaking secondary students and parents across the whole GCC plus Egypt. The owner talks only to the Manager agent; specialists report to the Manager.

Start with `docs/WORKLOG.md`: the running log of what changed, why, and what is open. Add an entry when you finish a piece of work.

## Stack
- Next.js 15.5 App Router, React 19, TypeScript. Dev server: `npm run dev` (port 3000).
- Tailwind v4. All tokens in `src/app/tokens.css` (`@theme`), brand motion in `src/app/brand.css`. No raw hex/px/ms in components.
- next-intl: locales `ar` (default) and `en`, strings in `messages/{ar,en}.json`. Arabic first, RTL: use logical properties (`inset-inline`, `ms-`/`me-`, `start`/`end`), never left/right.
- Prisma 7 on Neon Postgres. Auth: next-auth v5. Payments: Stripe and Paymob.
- Tests: `npm test` (vitest). Before handing work back: `npx tsc --noEmit`, `npm test`, `npm run build`.

## Hard rules
- **Stripe stays on test keys.** Live payments are on hold. Never switch keys or webhooks to live.
- **No push, deploy, merge, DNS change, or spending without the owner's approval** through the Manager.
- Never run destructive DB commands (`prisma migrate reset`, `DROP`, mass `delete`) against the real database.
- Never commit secrets or `.env*` files.
- Design follows `DESIGN.md`: show real numbers from stored data, never invented social proof. Motion stays on marketing pages; app pages stay calm; honour `prefers-reduced-motion`.

## Roles
| Agent | Owns |
|---|---|
| Manager | Talks to the owner, splits work into tasks, assigns, reviews, reports. Asks the owner before anything in Hard rules. |
| Brand/Design | Identity, `DESIGN.md`, `tokens.css`, logo and icons, the intro. |
| Frontend | Pages and components in `src/app` and `src/components`, i18n and RTL. |
| Backend & Payments | Prisma schema and queries, auth, Stripe/Paymob, webhooks. |
| QA | Browser checks in `ar` and `en`, mobile and desktop, vitest, regressions. Reviews every change before the Manager reports it done. |
| Content/SEO | Copy in `messages/*.json`, metadata, OG images, legal pages. |
