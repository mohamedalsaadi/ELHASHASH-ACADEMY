# SABBOURA · Design DNA ("Chalkboard", branch `redesign-aurora`)

The single source of truth for every screen. Every colour, size, radius and duration in code comes from this file through `tokens.css`. No raw hex, px or ms values in components.

Audience: secondary students across the GCC (Saudi Arabia, UAE, Kuwait, Qatar, Bahrain, Oman) and Egypt, the parents who pay, and the teachers who sell. Identity "Chalkboard" (2026-11-02, when the trade licence was registered as Sabboura). It keeps Aurora's layout, spacing, radii, motion timing and the two 3D heroes, and replaces its colour, ornament, mark and intro. The full profile is `docs/brand/sabboura-dna.json`. Arabic first (RTL), English second.

> Sections 2 to 8 below were written for Metro. Where they conflict with this section and `tokens.css`, this section and the tokens win. The token names are unchanged, so components did not need renaming.

## 0. Brand

**Name.** Sabboura, سبّورة: the classroom blackboard, the one object every student in Cairo, Riyadh and Dubai shares. Arabic copy writes سبّورة; English copy writes Sabboura; legal lines write "سبّورة (Sabboura)".

**Idea.** The best teacher's board, brought home. The heroes are a real slate; everything you read sits on warm exercise-book paper. Coloured chalk is the one ornament, and chalk is written, never animated for its own sake: it draws once at the speed of a hand, then stays.

**Mark.** A slate board on its wooden ledge, a stick of yellow chalk on the ledge, and one chalk stroke writing س, the first letter of the name (its three teeth also read as a handwriting squiggle). 64 × 48 grid, geometry in `src/app/brand-svg.ts`, component `src/components/brand/Mark.tsx`, favicon `src/app/icon.svg`; the PWA icons, Apple icon and share images are generated from the same geometry.

**Wordmark.** The mark plus سبّورة in **Aref Ruqaa** (Ruqʿah, the script Arab teachers actually write on the board) in Arabic, or Sabboura in Readex Pro in English. Ruqʿah (`--font-hand`, `font-hand`) is only for the wordmark and words chalked on the board, never for reading text or app pages. Display face Readex Pro, body IBM Plex Sans Arabic (all via `next/font`).

**Palette.**
| Token | Hex | Use |
|---|---|---|
| `--color-ground` | `#F5F2EA` | exercise-book paper, every page |
| `--color-surface` | `#FFFFFF` | cards, header, footer |
| `--color-ink` | `#16211D` | text on paper (16.5:1 on white) |
| `--color-ink-muted` | `#5C6660` | meta, labels (6.0:1 on white, 5.3:1 on paper) |
| `--color-primary` / `pen` / `focus` | `#1F6B4F` | board green: actions, links, focus ring (white on it 6.4:1) |
| `--color-night` / `night-2` | `#15251F` / `#1E352C` | the slate (`.stage`) |
| `--color-night-text` / `night-muted` | `#EEF1EA` / `#A7B7AE` | chalk white and muted text on the board (14.0:1 / 7.6:1) |
| `--color-marker` / `chalk-1` | `#F2D06B` | yellow chalk: the board's button, the heading underline, what a student earned. Never text on paper; slate on it 10.6:1 |
| `--color-chalk-2..6` | `#F4A261` `#F2A6B8` `#8CC4E8` `#A9DDB3` `#EEF1EA` | orange, pink, blue, green, white chalk: board drawings, the ride's rail, the footer rule |
| `--color-wood` | `#8A5A36` | the board's ledge (mark, share images) |

## 1. Theses (validated with the trade name, 2026-11-02)

**Visual.** Paper ground, white cards with a warm hairline and a slate-tinted soft shadow, large radii, pill buttons. Board-green primary. One slate stage (`.stage`) for the home hero, the student-home hero and the closing call: slate lighter where the classroom light falls, the faint smears of erased lessons and a fine chalk grain, all still. `.marker` underlines one word per heading by hand in yellow chalk; on the board the word itself turns chalk yellow. On the board the primary button is a stick of yellow chalk (`.btn-glow`). The footer closes every page with a thin rule of coloured chalk.

**Interaction.** Calm and smooth: 160 / 280 / 700 ms on `cubic-bezier(.16,1,.3,1)`. Cards lift 3 px on hover. Sections reveal on scroll with CSS `animation-timeline: view()`. The home hero is the board (`src/components/three/Board.tsx`, scene in `board-scene.ts`): a 4.2 s chalk story on the first visit per tab (axes and a parabola in yellow, a wave in blue with its wavelength in pink, a benzene ring in green, then the name written in Ruqʿah and underlined in yellow), dust shed from the chalk tip, then idle motes drifting in three depth layers with a slight pointer parallax. The copy rises at 3.2 s; any input finishes the drawing at once; reduced motion gets the finished board with no dust; it pauses off-screen. Diagrams are never mirrored in Arabic (an x axis points right in every language): only their two columns swap so the name sits beside the copy. The signed-in student home has the subject ride (`Ride.tsx`, scene in `ride-scene.ts`): one card per subject with courses on a looping rail of coloured chalk, moved only by the student (drag, sideways wheel, the subject buttons, arrow keys), settling in about 700 ms. Forbidden: 3D outside those two heroes, autoplay carousels, bounce, scroll-jacking.

**Marketing vs app.** Marketing pages get the board, the chalk and reveal motion. The student home counts as a store page. App pages (dashboard, lessons, teacher, admin, parent, checkout) get paper cards, pills and state transitions only, and never Ruqʿah.

**Allowed patterns:** the slate stage, coloured chalk, the yellow chalk underline on one word, Ruqʿah for the name only, glass sticky header (the one place blur is allowed), white paper cards, pill buttons and segmented pill navs, a country-colour dot or glow, scroll reveal, the session-once chalk intro.

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
