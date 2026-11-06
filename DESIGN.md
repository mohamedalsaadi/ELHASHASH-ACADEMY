# DHIRWA · Design DNA ("Contour", branch `redesign-aurora`)

The single source of truth for every screen. Every colour, size, radius and duration in code comes from this file through `tokens.css`. No raw hex, px or ms values in components.

Audience: secondary students across the GCC (Saudi Arabia, UAE, Kuwait, Qatar, Bahrain, Oman) and Egypt, the parents who pay, and the teachers who sell. Identity "Contour" (2026-11-02, when the trade name Dhirwa was reserved). It keeps the layout, spacing, radii, motion timing and the two 3D hero mechanics of the earlier identities, and replaces colour, ornament, mark, wordmark face and intro. The full profile is `docs/brand/dhirwa-dna.json`. Arabic first (RTL), English second.

> Sections 2 to 8 below were written for earlier identities. Where they conflict with sections 0, 1 and 6 and `tokens.css`, those win. Token roles are unchanged, so components did not need renaming.

## 0. Brand

**Name.** Dhirwa, ذروة: the peak. Every student is climbing toward one. Arabic copy writes ذروة; English copy writes Dhirwa; legal lines write "ذروة (Dhirwa)". Identifier `dhirwa`. Never bring back A+, Alsaadi, AAcademy or Sabboura.

**Idea.** A survey map of the climb. Pages are warm survey paper; the heroes are a night map. Contour lines are the one ornament: they show height, and height is progress. One summit-gold point marks what matters (the summit, the one highlighted word, what a student earned). Lines rise once, then rest.

**Mark.** Three nested ridge lines closing in on one peak, and a summit-gold point above them that is both the summit and the dot of ذ, the first letter of the name. 64 × 48 grid, geometry in `src/app/brand-svg.ts`, component `src/components/brand/Mark.tsx` (ridges take `currentColor`: ink on paper, snow on the map), favicon `src/app/icon.svg` (generated from `markSvg()`); the PWA icons, Apple icon and share images use the same geometry.

**Wordmark.** The mark plus ذروة in **Reem Kufi** 700 (geometric Kufi, lettered like a survey map) in Arabic, or Dhirwa in Readex Pro 700 (+0.04em) in English. Reem Kufi (`--font-mark`, `font-mark`) is only for the wordmark and words set on the map, never for reading text or app pages. Display face Readex Pro, body IBM Plex Sans Arabic (all via `next/font`).

**Palette.**
| Token | Hex | Use |
|---|---|---|
| `--color-ground` | `#F6F3EC` | survey paper, every page |
| `--color-surface` | `#FFFFFF` | cards, header, footer |
| `--color-ink` | `#13202F` | text on paper (16.6:1 on white) |
| `--color-ink-muted` | `#586273` | meta, labels (6.1:1 on white, 5.5:1 on paper) |
| `--color-primary` / `pen` / `focus` | `#1F7356` | trail green: actions, links, focus ring (white on it 5.8:1) |
| `--color-night` / `night-2` | `#0F1B2D` / `#172840` | the night map (`.stage`) |
| `--color-night-text` / `night-muted` | `#EEF0EA` / `#9FAABB` | snow and muted text on the map (15.6:1 / 7.4:1) |
| `--color-marker` / `summit` | `#E8B04B` | summit gold: the map's button, the heading underline, the summit point, what a student earned. Never text on paper; night on it 8.9:1 |
| `--color-contour-1..4` | `#3E5C7A` `#5D7FA0` `#8FB0C9` `#C3D3DE` | elevation ramp, low to high: contour lines, the footer rule, the loader |
| `--color-contour-5` / `contour-6` | `#2F8F6B` / `#EEF0EA` | the trail line / the snow line |

## 1. Theses (validated with the trade name, 2026-11-02)

**Visual.** Survey paper ground, white cards with a warm hairline and a navy-tinted soft shadow, large radii, pill buttons. Trail-green primary. One night-map stage (`.stage`) for the home hero, the student-home hero, the closing call and the small side panel of the sign-in and sign-up pages: navy, a little lighter where the summit catches the light, a faint field of still contour lines and a fine grain. `.marker` underlines one word per heading with a hand-drawn contour line in summit gold; on the map the word itself turns gold. On the map the primary button is summit gold (`.btn-glow`). The footer closes every page on three contour lines rising to one gold point (`.contour-rule`).

**Interaction.** Rise, then rest: 160 / 280 / 700 ms on `cubic-bezier(.16,1,.3,1)`. Cards lift 3 px on hover. Sections reveal on scroll with CSS `animation-timeline: view()`. The home hero is the summit (`src/components/three/Summit.tsx`, scene in `hop-scene.ts`), see §6. The signed-in student home has the subject trail (`Ride.tsx`, scene in `ride-scene.ts`): one card per subject on a trail coloured with the elevation ramp and the country line, moved only by the student (drag, sideways wheel, the subject buttons, arrow keys), settling in about 700 ms. Forbidden: 3D outside those two heroes, autoplay carousels, bounce, scroll-jacking.

**Marketing vs app.** Marketing pages get the map, contour lines and reveal motion. The student home counts as a store page. App pages (dashboard, lessons, teacher, admin, parent, checkout) get paper cards, pills and state transitions only, and never Reem Kufi.

**Allowed patterns:** the night-map stage, contour lines in the elevation ramp, the summit-gold point, the gold contour underline on one word, Reem Kufi for the name only, glass sticky header (the one place blur is allowed), white paper cards, pill buttons and segmented pill navs, a country-colour trail or dot, scroll reveal, the session-once summit intro.

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
| `--color-ground` | `#F6F3EC` | page background (survey paper) | |
| `--color-surface` | `#FFFFFF` | header, hero, cards, footer | |
| `--color-raised` | `#EEEAE0` | hover on tiles, inner groups | |
| `--color-hairline` | `#E4DFD3` | decorative dividers | |
| `--color-rule` | `#CBC4B4` | card borders on app pages, dashed rules | |
| `--color-field` | `#888272` | input borders, muted icons | 4.0 |
| `--color-ink` | `#13202F` | text, heavy rules, sign borders | 16.8 |
| `--color-ink-muted` | `#586273` | labels, meta | 6.9 |
| `--color-primary` / `--color-pen` | `#1F7356` | the primary sign, links, icons (trail green) | white on it 5.9 |
| `--color-on-primary` | `#FFFFFF` | text on primary, ink, night and line colours | |
| `--color-night` | `#0F1B2D` | the map, `.stage` heroes, the sign-in aside | night-text 13.9 · night-muted 6.4 |
| `--color-night-2` | `#172840` | the map's second tier | |
| `--color-marker` / `--color-summit` | `#E8B04B` | summit gold: one accent per viewport, the summit point, earned progress. Never body text | ink on it 8.4 |
| `--color-up` | `#0F6B3B` | improvement, correct | 5.9 on paper |
| `--color-down` | `#C8343E` | decline, wrong, errors | 5.8 |
| `--color-focus` | `#1F7356` | 2px focus ring, 2px offset; summit gold on `.stage` | |

`src/app/tokens.css` is authoritative: if this table and the file disagree, the file wins.

**Country lines.** One colour each, Egypt first. The same values are in `brand-svg.ts` (`LINES`) for generated images. Line signs (`LineBadge`) carry white type on every line except Bahrain, which carries ink.

| Token | Hex | Country | White on it | Ink on it |
|---|---|---|---|---|
| `--color-line-eg` | `#D1293D` | Egypt | 5.5 | |
| `--color-line-sa` | `#16834A` | Saudi Arabia | 5.2 | |
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
| `--ease-out` | `cubic-bezier(.16,1,.3,1)` | everything |
| `--dur-fast` | 160ms | hover, press |
| `--dur-base` | 280ms | tabs, panel open/close, toasts, card lift |
| `--dur-reveal` | 700ms | scroll reveal, hero copy rise |
| `--dur-count` | 700ms | score count-up, bar fill, once per value per page load |
| `--dur-press` | 80ms | button press |
| `--stagger` | 60ms | hero copy, lists |

- Animate only `transform`, `opacity`, `background-color`, `border-color`, `color`, `stroke-dashoffset`.
- **Summit intro** (home only; `src/components/three/Summit.tsx`, gate in `src/components/brand/Intro.tsx`, copy delay in `src/app/brand.css`), 4.0 s (`SUMMIT_END`). The flat brand mark with its gold point hopping onto the peak ("Hop", owner's choice 2026-11-03, over a 3D light-sweep relief), `hop-scene.ts`, SVG only, built from the mark's own paths in brand-svg.ts so the last frame is the logo exactly as in the header: 0.1–1.4 s the three ridges draw out from the peak to both feet, outer first · 1.0 s the gold point appears at the start-side foot, crouches, and 1.5–2.15 s hops in one arc (stretched along its path) onto the outer ridge · it squashes, the ridges give under it like a springboard (outer most, inner last) and launch it 2.3–2.9 s to its place with a hair of overshoot · one soft gold ring · then it floats. Below lg the mark sits in the band above the copy, from lg on the end side. The hero copy rises from 3.2 s. The clock starts when the page has loaded (at most 1.5 s after the scene code arrives), never at navigation, and the hero copy is timed from that same start, so slow loading never eats the intro. Any pointer, key, wheel or touch jumps to the end; if the scene never arrives a timer clears the gate at 6 s. Once per tab session (`sessionStorage`), or every time with an `?intro=` link (previews); reduced motion and later visits get the final frame; without JS the flat mark is in the HTML. Paused off-screen and when the tab is hidden.
- **Map** (`src/components/brand/Network.tsx`): hover on a line or station dims the others to 25%.
- **Route loader:** a 3px contour line (low ground to summit gold) draws across the top only while a route is loading.
- Nothing reacts to scroll except the one-time reveal.
- `prefers-reduced-motion`: durations become 0, 3D scenes render their final frame once, count-ups show the final value, colour still changes.

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
