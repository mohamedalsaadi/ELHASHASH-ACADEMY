# A+ ACADEMY · Design DNA ("Aurora", branch `redesign-aurora`)

The single source of truth for every screen. Every colour, size, radius and duration in code comes from this file through `tokens.css`. No raw hex, px or ms values in components.

Audience: secondary students across the GCC (Saudi Arabia, UAE, Kuwait, Qatar, Bahrain, Oman) and Egypt, the parents who pay, and the teachers who sell. Identity "Aurora" (2026-11-01, competing with "Curriculum Metro" on `redesign-curriculum-metro`): Stripe/Apple-style light, airy surfaces with one night stage and an aurora gradient. The measured palette and effects are in `docs/brand/aurora-dna.json`. Arabic first (RTL), English second.

> Sections 2 to 8 below were written for Metro. Where they conflict with this section and `tokens.css`, this section and the tokens win. The token names are unchanged, so components did not need renaming.

## 0. Brand

**Idea.** One night sky over the region. The home hero is a planet: real continents as dots (Natural Earth), Egypt and the GCC warm in their own borders, a beam on each capital and arcs of light from Cairo and Abu Dhabi. The intro is a dawn: the planet starts back-lit with a crescent on its rim, turns to the Gulf as day sweeps across it, then the capitals light and connect. After that the site is daylight: white cards on a cool grey ground.

**Mark.** Same geometry (`src/app/brand-svg.ts`); the + strokes take `aurora-1` and `aurora-4`.

**Wordmark.** Latin only in both locales. Display face Readex Pro, body IBM Plex Sans Arabic (both via `next/font`).

## 1. Theses (validated 2026-11-01; planet and dawn intro approved 2026-11-02)

**Visual.** Cool grey ground (`--color-ground`), white cards with a hairline and a soft shadow, large radii, pill buttons. Indigo primary (`--color-primary`), orange earned accent (`--color-marker`). One dark stage (`.stage`, `--color-night`) for the home hero and the final call to action, lit by the aurora gradient (`--color-aurora-1..6`). Gradient text (`.marker`) on one word per heading at most. Country colours survive as a dot or a corner glow.

**Interaction.** Calm and smooth: 160 / 280 / 700 ms on `cubic-bezier(.16,1,.3,1)`. Cards lift 3 px on hover. Sections reveal on scroll with CSS `animation-timeline: view()`. The three.js planet (`src/components/three/Planet.tsx`, scene in `planet-scene.ts`, dot masks in `land.ts`) runs only in the home hero: 4.2 s story, copy rises at 3.2 s, on the first visit per tab, any input skips, a still frame under reduced motion, paused off-screen. The signed-in student home (`/` rewritten to `/me`) has its own hero, the subject ride (`Ride.tsx`, scene in `ride-scene.ts`): one car per subject with courses on a looping aurora rail, moved only by the student (drag, sideways wheel, the subject buttons, arrow keys); the nearest car settles at the front station in about 700 ms, frames are drawn only while something moves, and reduced motion jumps straight there. Forbidden: 3D outside those two heroes, autoplay carousels, bounce, scroll-jacking (the ride never takes the vertical wheel).

**Marketing vs app.** Marketing pages get the stage, the gradient and reveal motion. The student home counts as a store page. App pages (dashboard, lessons, teacher, admin, parent, checkout) get cards, pills and state transitions only.

**Allowed patterns:** the night stage, the aurora gradient, gradient text on one word, glass sticky header (the one place blur is allowed), white hairline cards, pill buttons and segmented pill navs, a country-colour dot or glow, scroll reveal, the session-once dawn intro.

## 2. Genjitsu directives

Genjitsu means "the actual facts". Every screen answers: where does this student stand, exactly, today?

1. **Show the number, not a mood.** "81 / 100 · Very Good" beats a 4-star icon. A progress bar always carries its value beside it.
2. **One source per figure.** Every number on screen comes from stored data (attempts, attendance, payments). If we cannot compute it, we do not show it. No invented social proof, no "10,000+ students" until it is true. A count of zero is hidden.
3. **Summary first, detail on demand.** Dashboard order: streak · average · rank → weakest concept → next lesson. Drill-down is a click, never a scroll through decoration.
4. **State in form, not only colour.** Up/down uses ▲/▼ plus colour. The exam tier is a labelled chip. A line under construction is dashed, not only grey. Colour-blind students must read the same facts.
5. **Exam-native vocabulary.** Use the Ministry's terms: الدرجة من ١٠٠, ممتاز, جيد جدًا, نظام الامتحان, أسئلة تدريبية. Never claim ministry authorship of a question set. No invented gamer words.
6. **Energy lives in the data.** Signal yellow, count-ups and rank changes are reserved for real achievements and real offers. Surfaces stay calm.
7. **No decoration that carries nothing.** No blobs, glass, gradient text, stock-photo heroes, emoji icons, or illustrations behind data. The map is data: every line and station on it comes from the catalogue.

### Egyptian grade tiers (score 0–100)
| Score | Arabic | English | Chip |
|---|---|---|---|
| 85–100 | ممتاز | Excellent | marker fill |
| 75–84 | جيد جدًا | Very Good | ink outline |
| 65–74 | جيد | Good | neutral outline |
| 50–64 | مقبول | Pass | neutral outline |
| 0–49 | ضعيف | Poor | primary outline |

## 3. Colour

Light only (`color-scheme: light`). Contrast ratios are WCAG 2.x, measured against `--color-surface` (white) unless noted.

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `--color-ground` | `#F4F5F6` | page background | |
| `--color-surface` | `#FFFFFF` | header, hero, cards, footer | |
| `--color-raised` | `#ECEEF0` | hover on tiles, inner groups | |
| `--color-hairline` | `#E3E5E8` | decorative dividers | |
| `--color-rule` | `#D5D8DC` | card borders on app pages, dashed rules | |
| `--color-field` | `#6B717A` | input borders, dashed "under construction" stations | 4.9 |
| `--color-ink` | `#111418` | text, heavy rules, sign borders | 18.5 |
| `--color-ink-muted` | `#4D535C` | labels, meta | 7.8 |
| `--color-primary` / `--color-pen` | `#1F6FD1` | the primary sign, links, icons (the UAE line's blue) | white on it 4.9 |
| `--color-on-primary` | `#FFFFFF` | text on primary, ink, night and line colours | |
| `--color-night` | `#10223F` | the parents panel, offer cards | white 15.9 · `night-text` 11.1 · `night-muted` 6.8 |
| `--color-marker` | `#E8B23A` | signal yellow: free badge, discount, "best value", the banner label, earned progress. Never text on light | ink on it 9.6 |
| `--color-up` | `#1A7F3C` | improvement, correct | 5.1 |
| `--color-down` | `#C8262E` | decline, wrong, errors | 5.6 |
| `--color-focus` | `#1F6FD1` | 2px focus ring, 2px offset | |

**Country lines.** One colour each, Egypt first. The same values are in `brand-svg.ts` (`LINES`) for generated images. Line signs (`LineBadge`) carry white type on every line except Bahrain, which carries ink.

| Token | Hex | Country | White on it | Ink on it |
|---|---|---|---|---|
| `--color-line-eg` | `#D7262E` | Egypt | 5.0 | |
| `--color-line-sa` | `#1A7F3C` | Saudi Arabia | 5.1 | |
| `--color-line-ae` | `#1F6FD1` | UAE | 4.9 | |
| `--color-line-kw` | `#00807E` | Kuwait | 4.8 | |
| `--color-line-qa` | `#8A1538` | Qatar | 9.4 | |
| `--color-line-bh` | `#E8761C` | Bahrain | | 6.2 |
| `--color-line-om` | `#7A3E9D` | Oman | 7.0 | |

A country with no line token falls back to `--color-field`. `tokens.css` uses `@theme static`, so every line colour is emitted even when no utility class names it (they are read through `var()` in inline styles). The token names `pen` and `marker` are kept from the first brand so app pages re-skin without edits.

## 4. Typography

| Token | Family | Use |
|---|---|---|
| `--font-display` | `Alexandria, "Segoe UI", Tahoma, system-ui, sans-serif` | headings, hero figures, signs, chips, station labels |
| `--font-body` | `Alexandria, "Segoe UI", Tahoma, system-ui, sans-serif` | reading text, inputs |
| `--font-data` | `Alexandria, "Segoe UI", Tahoma, system-ui, sans-serif` + `font-variant-numeric: tabular-nums` | tables, scores in lists, prices, timers |

Loaded with `next/font/google` (self-hosted at build, `display: swap`, variable `--font-alexandria`), subsets `arabic` + `latin`, weights 400 to 800. Alexandria (by Mohamed Gaber) is a signage sans with matched Arabic and Latin, compact enough for station labels. One bilingual family, so mixed Arabic and English never change tone.

**Digits.** Data uses Western digits (0–9): they are the only fixed-width digits in either face, and Egyptian exam results are published with them. Arabic-Indic digits (٠–٩) are fine in Arabic prose labels ("منذ ٣ دقائق"), never in a column.

### Scale (fluid, 360px → 1280px)
| Token | Size | Arabic line-height | Latin line-height | Weight |
|---|---|---|---|---|
| `--text-hero` | clamp(2.4rem, 1.5rem + 3.6vw, 4.25rem) | 1.12 | 1.1 | 800 |
| `--text-display` | clamp(2rem, 1.6rem + 1.8vw, 2.75rem) | 1.25 | 1.15 | 800 |
| `--text-h1` | clamp(1.625rem, 1.4rem + 1vw, 2.125rem) | 1.3 | 1.2 | 800 |
| `--text-h2` | clamp(1.375rem, 1.25rem + .55vw, 1.625rem) | 1.4 | 1.3 | 800 |
| `--text-h3` | 1.25rem | 1.5 | 1.4 | 700 |
| `--text-body-ar` | 1.0625rem (17px) | 1.85 | | 400 |
| `--text-body` | 1rem (16px) | | 1.65 | 400 |
| `--text-small` | .875rem | 1.7 | 1.5 | 400 |
| `--text-label` | .8125rem | 1.5 | 1.4 | 500 to 700 |
| `--text-figure` | 1.75rem | 1.1 | 1.1 | 700 |

Arabic runs one body step larger than Latin because its x-height reads smaller. Running text max width 65ch. Headings use `text-wrap: balance`. No letter-spacing on Arabic, ever; Latin uppercase labels get `.08em`.

## 5. Space, shape, layout

- **Spacing (4px base):** `--space-1` 4 · `--space-2` 8 · `--space-3` 12 · `--space-4` 16 · `--space-6` 24 · `--space-8` 32 · `--space-12` 48 · `--space-16` 64. Data tiles 8–12, cards 16, sections 48–80.
- **Radii:** square. `--radius-sm` 2px (inputs, app buttons) · `--radius-md` 3px · `--radius-lg` 4px · `--radius-full` only for station roundels and avatars. Marketing cards and signs have no radius.
- **Line weight:** `--line` 6px: the rule under the header and under page titles, the top edge of a course card and of the best plan card, the side of a course unit, the stage line on a country page. On the 800 × 500 map board the line is 12 units. In Tailwind v4 write `border-b-(length:--line)` and `w-(--line)`; the v3 form `border-b-[length:--line]` silently produces no CSS.
- **Borders and shadow:** marketing cards use a 2px `--color-ink` border (`--border-strong`); app cards keep 1px `--color-rule`. `--shadow-paper` is a 1px hairline under a surface, not a lift. Hover on a card draws a 2px ink ring (`.hover-lift`); nothing floats.
- **Layout:** logical properties only (`margin-inline-start`, `padding-inline`, `inset-inline-end`) so RTL and LTR flip with `dir`. Icons that point (arrows, chevrons) mirror in RTL; icons that don't (play, check) never mirror.
- **Breakpoints:** 375 phone (primary), 640 `sm`, 768 tablet, 1024 laptop, 1440 desktop. On a phone the home map sits above the headline. Dashboards are one column on phones, never a horizontal scroll.
- **Icons:** Lucide, 20px, stroke 1.75 (2 to 2.5 on signs). No emoji as icons.

## 6. Motion

| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(.2,.7,.2,1)` | everything |
| `--dur-fast` | 160ms | hover, press |
| `--dur-base` | 240ms | tabs, panel open/close, toasts |
| `--dur-count` | 700ms | score count-up, bar fill, once per value per page load |
| `--stagger` | 30ms | streak day cells |

- Animate only `transform`, `opacity`, `background-color`, `border-color`, `color`, `stroke-dashoffset`.
- **Intro** (home only; `src/components/brand/Intro.tsx`, timings in `src/app/brand.css`), 1.8s on a white overlay with the ink rule, over the already-rendered page: 0–0.88s the country lines draw from the edges into the interchange, 60ms apart (dashed lines draw through a mask) · 0.76–1.0s the A+ roundel settles from 60% scale · 0.96–1.3s the wordmark rises 10px · 1.56–1.8s the overlay fades. Pure SVG and CSS, nothing to download. A pointer, key, wheel or touch skips it; a timer always clears it at 1.9s. Once per tab session (`sessionStorage`), never under reduced motion, never without JS.
- **Map** (`src/components/brand/Network.tsx`): hover on a line or station dims the others to 25%. On desktop pointers only, the map rests at a slight isometric tilt (10° × −3°) and flattens on hover or focus over 600ms; flat on touch screens and under reduced motion. Done in CSS; three.js is no longer used.
- **Route loader:** a 4px primary line draws across the top only while a route is loading.
- Nothing reacts to scroll.
- `prefers-reduced-motion`: durations become 0, the intro never shows, count-ups show the final value, colour still changes.

## 7. Components (5 states each: default · hover · focus-visible · active · disabled)

- **Platform sign (marketing primary):** a block up to 24rem wide, `--color-primary` fill, white Alexandria 700, an arrow at the end (mirrored in RTL), 44px min height, no radius. Hover: ink fill. The secondary sign is the same block in ink and hovers to primary. One primary sign per view.
- **Button primary (`.btn-primary`, app):** `--color-primary` background, white text, Alexandria 700, `--radius-sm`. Hover: ink. Focus: 2px `--color-focus` outline, 2px offset. Disabled: 45% opacity, `not-allowed`.
- **Button secondary (`.btn-outline`):** transparent, `--color-ink`, 2px ink border. Hover: ink fill, white text.
- **Input:** `--color-surface` background, 1px `--color-field`, `--radius-sm`, 44px min height. Focus: border `--color-ink` + focus ring. Error: border `--color-down` and a text message under it saying what to fix.
- **Card:** `--color-surface`, a 2px ink border on marketing pages, padding 16–24. Course card (`src/components/CourseCard.tsx`): a `--line` top edge in its country's line colour (ink for skill courses), grade, title, free badge, then the price. Never a card inside a card; inner groups use `--color-raised` tiles.
- **Line sign (`LineBadge`):** a country's code on a square of its line colour. Country tile (`CountryTile`): line sign, name, grade count, currency, arrow.
- **Network map (`Network`):** an 800 × 500 board; each line runs from its edge point to the interchange at the centre. Lines in service take the two level slots so their station labels read straight; up to three labelled stations per line, linking to grade pages. Each instance needs a unique `id` (its reveal mask).
- **Station line (country page):** one roundel per grade along the country's line, vertical on phones, horizontal from `sm`. Grades with courses: ink ring; without: dashed field ring; the student's own grade: signal-yellow fill.
- **New banner (`NewsBanner`):** an ink strip above the header with a signal-yellow "New" label and up to five items, newest first: published courses, running SKU discounts (old price struck through) and BAR promotions. Cached five minutes. Hidden when empty. Scrolls sideways on phones; never auto-scrolls.
- **Legend count (home):** the value in `--text-figure` 700 beside a `--line` ink rule on the start side, the unit label muted. Zero counts are left out, and the legend says the counts come from the catalogue today.
- **Stat tile:** `--color-raised`, `--radius-sm`, padding 10/12. Value `--text-figure` (display face for one hero value, `--font-data` when tiles sit in a row that must align), label `--text-label` muted.
- **Chip:** square, 1px border, `--text-label`. Variants: tier (table above), up (▲ + `--color-up`), down (▼ + `--color-down`).
- **Concept row:** label + score (`--font-data`) + 4px bar with value beside it. Weak (< 65) bar in `--color-down`. Hover: `--color-raised`.
- **Paywall lock:** lesson row with lock icon, price in `--font-data`, "Free preview" secondary button when Unit 1. Never blurs content as a teaser.
- **Video watermark:** VdoCipher renders it; spec: name + phone + IP, 40% opacity, `--color-ink`, moves every 8–12s.

## 8. Copy voice

Plain, direct, exam-literate. Arabic in Modern Standard, understood from the Gulf to Egypt. Buttons say what happens ("اشترك في الفصل الدراسي", "Start Unit 1 free"). One name per action across the site. Errors say what went wrong and how to fix it. No filler verbs (elevate, unleash, seamless), no em dashes in UI copy. Payment copy on marketing pages names no method the platform may withdraw (the bank-transfer bridge is temporary).
