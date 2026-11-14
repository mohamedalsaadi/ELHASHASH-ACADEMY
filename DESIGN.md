# DHIRWA · Design system

The single source of truth for every screen. Every colour, size, radius and duration in code comes from this file through `src/app/tokens.css`. No raw hex, px or ms values in components. If this file and `tokens.css` disagree on a value, `tokens.css` wins.

Audience: secondary students across the GCC (Saudi Arabia, UAE, Kuwait, Qatar, Bahrain, Oman) and Egypt, the parents who pay, and the teachers who sell. Arabic first (RTL), English second. The machine-readable profile is `docs/brand/dhirwa-dna.json`.

Redesigned in November 2026 with Apple's Human Interface Guidelines as the review standard (through `dickwu/apple-design-skill`, which stays outside this repo because its terms allow design review only) and GSAP for marketing motion. It replaced the "Contour" identity (survey paper, night map, contour ornament).

## 0. Brand

**Name.** Dhirwa, ذروة: the peak. Arabic copy writes ذروة; English copy writes Dhirwa; legal lines write "ذروة (Dhirwa)". Identifier `dhirwa`. Never bring back A+, Alsaadi, AAcademy or Sabboura.

**The one idea.** A quiet neutral page where the only colour is the gold summit point. Gold marks what a student reached or earned, and nothing else.

**Mark.** Three nested ridge lines closing in on one peak, and a gold point above them that is both the summit and the dot of ذ. 64 × 48 grid, geometry in `src/app/brand-svg.ts`, component `src/components/brand/Mark.tsx` (ridges take `currentColor`), favicon `src/app/icon.svg`. The PWA icons, Apple icon and share images use the same geometry. The mark never flips in RTL.

**Wordmark.** The mark plus ذروة in **Reem Kufi** 700 in Arabic, or Dhirwa in Readex Pro 700 (+0.04em) in English. Reem Kufi (`--font-mark`) is for the wordmark only.

## 1. Theses

**Visual.** Neutral grounds, ink actions, large type, fewer boxes, more space, one idea per section. Colour appears only where it carries data (country accents, up and down) or meaning (summit gold).

**Marketing and app.** Marketing pages (home, catalogue, course detail, `/teach`) get GSAP motion and large type. App pages (dashboard, lessons, teacher, admin, parent, checkout) get calm surfaces and brief state transitions, no GSAP. Dense admin tables stay dense.

**Honesty.** Sample product UI on marketing pages is visibly labelled as an example. See §2.

**Allowed patterns:** pill actions, hairline cards, glass on the floating header and phone tab bar only, the gold point, country dots and badges, the once-per-session intro, scroll reveals and pinned sections on marketing pages.

**Forbidden:** blobs, gradient text, stock-photo heroes, emoji icons, autoplay carousels, bounce, wheel hijacking, decoration behind data, gold as text on the page ground.

## 2. Genjitsu directives

Genjitsu means "the actual facts". Every screen answers: where does this student stand, exactly, today?

1. **Show the number, not a mood.** "81 / 100 · Very Good" beats a 4-star icon. A progress bar always carries its value beside it.
2. **One source per figure.** Every number on screen comes from stored data (attempts, attendance, payments). If we cannot compute it, we do not show it. No invented social proof, no "10,000+ students" until it is true. A count of zero is hidden.
3. **Summary first, detail on demand.** Dashboard order: streak · average · rank → weakest concept → next lesson. Drill-down is a click, never a scroll through decoration.
4. **State in form, not only colour.** Up/down uses ▲/▼ plus colour. The exam tier is a labelled chip. Something not yet open is dashed, not only grey. The current tab is bolder, not only darker. Colour-blind students must read the same facts.
5. **Exam-native vocabulary.** Use the Ministry's terms: الدرجة من ١٠٠, ممتاز, جيد جدًا, نظام الامتحان, أسئلة تدريبية. Never claim ministry authorship of a question set. No invented gamer words.
6. **Energy lives in the data.** Gold, count-ups and rank changes are reserved for real achievements. Surfaces stay calm.
7. **No decoration that carries nothing.**

### Egyptian grade tiers (score 0–100)
| Score | Arabic | English | Chip |
|---|---|---|---|
| 85–100 | ممتاز | Excellent | gold fill |
| 75–84 | جيد جدًا | Very Good | ink outline |
| 65–74 | جيد | Good | neutral outline |
| 50–64 | مقبول | Pass | neutral outline |
| 0–49 | ضعيف | Poor | primary outline |

## 3. Colour

Two themes. The device decides by default; a toggle in the header and on the account page can force either, stored per browser. `public/theme-guard.js` sets `html[data-theme]` before paint, so there is no flash. Token names `pen`, `marker` and `contour-*` are kept from earlier brands so call sites did not need renaming.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-ground` | `#F5F5F7` | `#000000` | page |
| `--color-surface` | `#FFFFFF` | `#1C1C1E` | cards, header, footer |
| `--color-raised` | `#EDEDF0` | `#2C2C2E` | hover, inner groups, tab rails |
| `--color-hairline` | `#E2E2E6` | `#2F2F32` | card edges, dividers |
| `--color-rule` | `#C7C7CC` | `#48484A` | dashed rules, stronger edges |
| `--color-field` | `#86868B` | `#8E8E93` | input borders, muted icons |
| `--color-ink` | `#1D1D1F` | `#F5F5F7` | text |
| `--color-ink-muted` | `#636366` | `#A1A1A6` | labels, meta |
| `--color-primary` / `pen` / `focus` | `#1D1D1F` | `#F5F5F7` | actions, links (underlined), focus ring |
| `--color-on-primary` | `#FFFFFF` | `#1D1D1F` | text on an action |
| `--color-summit` / `marker` | `#E8B04B` | same | the gold point, what a student earned. Never text on the ground |
| `--color-on-summit` | `#1D1D1F` | same | text on gold |
| `--color-up` | `#0F6B3B` | `#32D74B` | improvement, correct |
| `--color-down` | `#C8343E` | `#FF6B61` | decline, wrong, errors |
| `--color-contour-1..6` | neutral ramp | neutral ramp | the student-home trail, the network drawing |

Accessibility answers: `prefers-contrast: more` turns muted text into ink, makes faint edges visible and makes the glass solid. `prefers-reduced-transparency` makes the glass solid.

**Country accents.** One colour each, carrying data. Line badges (`LineBadge`) carry white type on every country except Bahrain, which carries ink.

| Token | Light | Dark | Country |
|---|---|---|---|
| `--color-line-eg` | `#D1293D` | same | Egypt |
| `--color-line-sa` | `#127A43` | same | Saudi Arabia |
| `--color-line-ae` | `#1F6FD1` | same | UAE |
| `--color-line-kw` | `#007573` | same | Kuwait |
| `--color-line-qa` | `#8A1538` | `#C2325F` | Qatar |
| `--color-line-bh` | `#B85400` | same | Bahrain |
| `--color-line-om` | `#7A3E9D` | `#9458B8` | Oman |

A country with no token falls back to `--color-field`. `tokens.css` uses `@theme static`, so every colour is emitted even when read only through `var()` in inline styles.

## 4. Typography

| Token | Family | Use |
|---|---|---|
| `--font-display` | Readex Pro | headings, hero figures |
| `--font-body` | IBM Plex Sans Arabic | reading text, inputs, buttons |
| `--font-data` | IBM Plex Sans Arabic + `tabular-nums` (`.num`) | tables, prices, timers |
| `--font-mark` | Reem Kufi | the Arabic wordmark only |

All through `next/font`. Tokens are in rem, so browser text-size settings scale them.

**Digits.** Data uses Western digits (0–9), which are fixed-width. Arabic-Indic digits are fine in Arabic prose labels, never in a column.

| Token | Size |
|---|---|
| `--text-hero` | clamp(3rem, 1.4rem + 6.4vw, 7rem) |
| `--text-display` | clamp(2.25rem, 1.5rem + 3vw, 4.25rem) |
| `--text-h1` | clamp(1.875rem, 1.5rem + 1.5vw, 2.75rem) |
| `--text-h2` | clamp(1.375rem, 1.25rem + .6vw, 1.75rem) |
| `--text-h3` | 1.25rem |
| `--text-lede` | clamp(1.125rem, 1.05rem + .4vw, 1.375rem) |
| `--text-body-ar` | 1.0625rem (17px), line-height 1.85 |
| `--text-body` | 1rem, line-height 1.65 |
| `--text-small` | .875rem |
| `--text-label` | .8125rem |
| `--text-figure` | 2rem |

Arabic runs one body step larger than Latin because its x-height reads smaller. The tab bar label is the only text below `--text-label` (.6875rem, 11px). Running text max width 65ch. Headings use `text-wrap: balance`. No letter-spacing on Arabic, ever.

## 5. Space, shape, layout

- **Spacing:** 4px base (`--spacing`). Cards 16 to 24, sections 64 on phones and 96 or more on desktop.
- **Radii:** `--radius-sm` 10px (inputs) · `--radius-md` 14px · `--radius-lg` 22px (cards) · `--radius-full` (actions, badges).
- **Edges and shadow:** cards use a 1px hairline and `--shadow-paper` (no shadow in dark). `.hover-lift` raises 2px on marketing cards.
- **Containers:** `--container-page` 76rem, `--container-reading` 46rem.
- **Layout:** logical properties only (`ms-`, `me-`, `inset-inline`, `start`, `end`). Icons that point (arrows, chevrons) mirror in RTL with `rtl:-scale-x-100`; the mark, play and check never mirror.
- **Phones:** 375 is the primary width. Signed-in users get a bottom tab bar (`TabBar`) with the same destinations as the header. Tabs only move; actions stay in the page. Section tabs (`.subnav`) scroll on phones and wrap from 40rem. Dashboards are one column, never a horizontal page scroll.
- **Controls:** at least 44px (`--control-h`), guarded by `e2e/tap-targets.spec.ts` (public pages) and `e2e/signed-in-ui.spec.ts` (student, teacher, admin and parent pages). A text link that stands on its own line or in a flex row takes `.link-tap` (44px tall and wide, text stays small); a small pill button takes `min-h-(--control-h)`. Links inside a sentence are exempt.
- **Icons:** Lucide, stroke 1.75. No emoji as icons.

## 6. Motion

| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(.16,1,.3,1)` | everything |
| `--dur-fast` | 160ms | hover, press |
| `--dur-base` | 280ms | tabs, panels, toasts |
| `--dur-reveal` | 700ms | reveals, hero copy |
| `--dur-count` | 700ms | count-up, bar fill |
| `--dur-press` | 80ms | button press |
| `--stagger` | 60ms | hero copy, lists |

- **Library.** GSAP with ScrollTrigger, marketing client components only (`components/motion/Motion.tsx`, `components/brand/Intro.tsx`). `gsap.matchMedia` handles reduced motion and phone layouts. App pages never import it.
- **Scroll.** Native always. Pinning is CSS `position: sticky`, and scroll position drives what changes inside. No wheel hijacking, no scroll snapping forced on the page. Markup hooks: `data-reveal`, `data-scale-in`, `data-steps` / `data-step` / `data-panel`. A pinned step starts at 55% opacity and reaches 1 as it scrolls in, so resting text stays near 3:1 for large headings.
- **Intro.** About 2.6 s, once per tab session, home only. Ridges draw on a clean full-screen ground, the gold point climbs to the peak, the mark shrinks into its exact header position, the headline rises. States on `html[data-intro]`: `play`, `run`, `skip`, set by `public/intro-guard.js`. Any input skips. A 6 s failsafe clears it. `?intro=` previews it. Reduced motion and no JavaScript get the final frame.
- **Backdrop.** `components/motion/Backdrop.tsx`, mounted by `MarketingBackdrop` on the home, the catalogue and `/teach` only, as its own lazy chunk. Fixed behind the page: three ridgelines (drawn like the logo's, each three contour lines) that drift slowly and move at different speeds with the scroll, two soft lights (gold, and the UAE blue at low strength) in slow orbits, and one gold summit point that leans toward a fine pointer. Transform and opacity only, no click, hidden in print, still under reduced motion.
- **Student home.** The subject trail (`components/three/Ride.tsx`) moves only when the student moves it.
- **Route loader.** A hairline draws across the top only while a route is loading.
- Animate only `transform`, `opacity`, `background-color`, `border-color`, `color`, `stroke-dashoffset`.
- `prefers-reduced-motion`: durations become 0, GSAP shows the final frame, count-ups show the final value.

## 7. Components (5 states each: default · hover · focus-visible · active · disabled)

- **Button primary (`.btn-primary`):** pill, `--color-primary` fill, `--color-on-primary` text, 44px min height. Hover: 82% opacity. Disabled: 45% opacity.
- **Button secondary (`.btn-outline`):** pill, transparent, 1px `--color-field`. Hover: `--color-raised`.
- **Input:** `--color-surface`, 1px `--color-field`, `--radius-sm`, 44px min height. Focus: primary border and soft ring. Error: `--color-down` border and a message saying what to fix.
- **Card (`.card`):** surface, hairline, `--radius-lg`, `--shadow-paper`. Never a card inside a card; inner groups use `--color-raised`.
- **Course card (`CourseCard`):** cover (or the subject icon), grade, title, free badge, price, country accent. Covers are private blobs served by `/api/covers/<id>`; they render through `next/image` (`images.localPatterns` in `next.config.ts`), so each screen gets a resized WebP or AVIF with a `sizes` hint, cached for a year by the versioned URL. **Country tile (`CountryTile`):** line badge, name, grade count, currency.
- **Grade tile (country page):** open link, or dashed "coming soon". A gold dot marks the student's own grade, next to a text label.
- **News banner (`NewsBanner`):** up to five items, newest first, from stored courses and discounts. Cached five minutes. Hidden when empty. Never auto-scrolls.
- **Tab bar and section tabs:** the current tab is ink and bold, with `aria-current`.
- **Stat tile:** `--color-raised`, value in `--text-figure`, label in `--text-label`.
- **Chip:** 1px border, `--text-label`. Variants: tier (table above), up (▲ + `--color-up`), down (▼ + `--color-down`).
- **Concept row:** label + score (`.num`) + 4px bar with its value beside it. Weak (< 65) bar in `--color-down`.
- **Paywall lock:** lesson row with lock icon and price; a "Free preview" button on Unit 1. Never blurs content as a teaser.
- **Video watermark:** VdoCipher renders it. Name + phone + IP, 40% opacity, moves every 8 to 12 s.
- **Share images and emails:** `brand-svg.ts` holds the hex values for generated images. `src/lib/mail.ts` is not yet restyled.

## 8. Copy voice

Plain, direct, exam-literate. Arabic in Modern Standard, understood from the Gulf to Egypt. Buttons say what happens. One name per action across the site. Errors say what went wrong and how to fix it. No filler verbs (elevate, unleash, seamless), no em dashes in UI copy. Payment copy on marketing pages names no method the platform may withdraw.

**One term per concept (Arabic / English).** course دورة / course · teacher معلم / teacher · lesson درس / lesson · live session حصة مباشرة / live session · phone هاتف / phone · email البريد الإلكتروني / email · code رمز / code. Teacher-facing copy calls the owner الإدارة / admin. `src/i18n/messages-parity.test.ts` checks that both locales hold the same keys and placeholders. The 2026-11 rewording and every departure from the translator are in `docs/copy-review-2026-11.csv`.
