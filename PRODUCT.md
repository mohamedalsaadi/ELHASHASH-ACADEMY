# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **The student** (mainly grade 12, aged about 16 to 18) in Egypt or the Gulf, preparing for a high-stakes final year (Thanawya Amma in Egypt, Grade 12 Advanced in the UAE). Arrives on a phone from Instagram or a WhatsApp share, picks the subject, tries the free unit.
- **The parent** who pays. Checks that the course matches the child's country and grade, what it costs in the local currency, how payment works, and that progress is visible to them.

The student picks, the parent pays: every marketing page gives both a path.

## Product Purpose

Recorded lessons for the school curriculum by invited teachers, with practice after every lesson, spaced review, exams, homework with AI grading, a course leaderboard and live lectures. Success: a student starts the free first unit, and a parent completes payment for the subject.

## Positioning

The curriculum of one country and one grade, taught in Arabic first (English too), with practice and review after every lesson and a parent view of progress, sold per subject for the school year, per rented lecture, or per live lecture. Unit 1 of every subject is free.

## Operating Context

- Main channel: Instagram (handle not bought yet) and WhatsApp shares, opened on mid-range Android phones and iPhones.
- Seven countries are active: Egypt (EGP), Saudi Arabia (SAR), UAE (AED), Kuwait (KWD), Qatar (QAR), Bahrain (BHD), Oman (OMR). Each has its own grades, subjects and prices.
- Payment: card through Ziina (AED, live). Paymob (EGP) and Stripe stay coded behind env flags and test keys. One device per account.

## Capabilities and Constraints

- Next.js 15 App Router, React 19, Tailwind v4, next-intl (`ar` default, `en`), Prisma on Neon. `three` is installed; GSAP and Lenis are not.
- Arabic first, RTL, logical properties only. The wordmark is ذروة in Reem Kufi in Arabic and Dhirwa in English.
- Tokens live in `src/app/tokens.css` and motion in `src/app/brand.css`; no raw hex, px or ms in components.
- Motion and 3D only on marketing pages; app pages stay calm; `prefers-reduced-motion` is honoured.
- Light theme only (owner, 2026-11-01).
- Routes, navigation labels and form field names are kept.
- The trade name Dhirwa (ذروة) was reserved on 2026-11-02, replacing Sabboura (a Dubai "Saboura" and an existing trademark clashed). The domains and handles are not bought yet; dhirwa.net/.org/.ae and Instagram @dhirwa were free on 2026-11-02, dhirwa.com is taken.

## Brand Commitments

- Name: Dhirwa (ذروة, the peak). Identifier `dhirwa`.
- Identity "Contour" (2026-11-02): a night map for the heroes, survey paper for everything else, contour lines as the one ornament and one summit-gold point. See DESIGN.md §0 and docs/brand/dhirwa-dna.json.

## Evidence on Hand

- Stored counts only (owner's choice), read from the database and rendered live: 4 published courses, 23 lessons, 3 subjects, 2 teachers, 7 countries (2026-11-01). Show them only as the database returns them; hide a count that is zero.
- The real product UI (lesson, practice, results) can be shown as product, never with invented scores presented as real.
- Absent and never to be invented: student counts, results, pass rates, testimonials, reviews, ratings, press, partner schools, teacher photos on marketing pages, price ranges not in the database.
- No owned photography: imagery is drawn (SVG, three.js) or the product's own UI.

## Product Principles

1. Country and grade first: a visitor reaches their own curriculum in two taps.
2. The free unit is the front door; payment comes after trust.
3. Every claim is checkable against the database; small honest numbers beat big invented ones.
4. Arabic is the original, not a translation.
5. Calm where people study, expressive only where they decide.

## Accessibility & Inclusion

- RTL-correct layouts and bidi-safe mixed Arabic and Latin text.
- Contrast at least WCAG AA; reduced motion honoured; works on mid-range Android over mobile data.
