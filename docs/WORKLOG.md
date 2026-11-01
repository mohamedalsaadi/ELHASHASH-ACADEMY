# Work log

Read this first if you are an agent picking up the project. Newest entry on top. Each entry says what changed,
why, where, and what is still open. Rules in `AGENTS.md` and design in `DESIGN.md` still win over anything here.
Git history has the rest (`git log --oneline`).

## Standing facts

- **Brand:** A+ Academy, since 2026-11-01 (`a4affc9`). The domain `aplusacademy.ae`, the social handles and the
  Resend DNS are owner actions and are not done yet.
- **Live site:** https://elhashash-academy.vercel.app. It is behind HTTP Basic auth (`SITE_PASSWORD` in
  `src/middleware.ts`). The Claude desktop browser pane cannot show the Basic-auth prompt, so use Claude in
  Chrome; the owner types the password. On 2026-11-01 the live site ran the pre-redesign code (old look, old intro).
- **Payments:**
  - Routing by cart currency is in `src/lib/gateway.ts`: EGP goes to Paymob, AED to Ziina, everything else to Stripe.
  - Stripe stays on test keys; live is on hold (AGENTS.md).
  - Ziina is fully coded (`src/lib/ziina.ts`, `/api/webhooks/ziina`, the checkout result page) but **inactive until
    `ZIINA_API_KEY` is set** in Vercel and the webhook `https://<domain>/api/webhooks/ziina` is registered in
    Ziina's dashboard. Keep `ZIINA_TEST=0` in production. See `docs/payment-bridge.md` and `docs/launch-checklist.md`.
  - Bank transfer with bank-alert approval is a temporary bridge (`docs/payment-bridge.md`).
- **Marketplace stage, until the end of 2026:**
  - Teachers publish their own courses, sessions, prices and cover picture per country, grade and subject.
  - The old plan ideas (monthly plan, "ways to learn") are hidden, not deleted.
  - Migrations stay additive. Keep the `2027-full-release` tag (`f0bf453`).

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
