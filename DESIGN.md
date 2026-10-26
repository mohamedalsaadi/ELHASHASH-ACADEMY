# AACADEMY · Design DNA

The single source of truth for every screen. Every colour, size, radius and duration in code comes from this file through `tokens.css`. No raw hex, px or ms values in components.

Audience: secondary students (Grade 10 to 12) across the GCC (Saudi Arabia, UAE, Kuwait, Qatar, Bahrain, Oman) and Egypt, and the parents who pay. Identity "the illuminated page" (chosen 2026-10-25): two open books laid face down form the double A of AAcademy. Brand book: `docs/brand/brand-book.html`. Arabic first (RTL), English second.

## 0. Brand

**Idea.** A book laid open, spine up, to keep your place is an A. AAcademy holds two of them side by side, tied by one gold ribbon. It promises: pick up exactly where you left off.

**Wordmark.** Latin only, in both locales. The two-A monogram sits beside "AAcademy" set in Readex Pro. The monogram is drawn on a 100-unit cap height with a 14-unit stroke; the double A shares one gold ribbon. Ink is `currentColor`. Code: `src/components/brand/Mark.tsx` (`Wordmark`).

**Monogram.** The double A with its ribbon (`Mark`). Favicon and app icon: lapis tile, vellum A A, gold ribbon (`src/app/icon.svg`, `apple-icon.tsx`). Share image: `opengraph-image.tsx`. Static SVG strings for generated images: `src/app/brand-svg.ts`.

**The fold.** The 71° slope of the A's legs is the only diagonal: the `.fold` corner cut on feature cards, banner edges, and lesson progress as a row of small A's (done lapis, current gold, ahead faint).

**Where it appears.** Header and footer (wordmark) · home intro · small badges (monogram) · empty states (the A A dashed in pencil grey).

## 1. Theses (validated)

**Visual.** The illuminated page: a vellum ground with ink text, lapis for the brand, links and the primary action, and gold leaf only for what a student earned (progress, achievements, the ribbon, one underline per heading at most). Night (deep lapis) for heroes, result cards and the trust strip. Readex Pro sets both scripts at all sizes, headings included. Cards are white with a soft shadow; one feature card per view may take the fold cut. Light only.

**Interaction.** Quick and dry: 160ms for hover, 240ms for state changes, one 700ms draw when a mark first appears, all on one ease-out `cubic-bezier(.2,.7,.2,1)`. Hover shifts tone or lifts a card 2px. Forbidden: bounce, elastic, looping glows or pulses, confetti, autoplay carousels, smooth-scroll libraries.

**Marketing vs app.** The home page may move: a 2s three.js intro once per tab session (the one WebGL scene on the site, loaded only when it plays). App pages stay calm: no scroll effects, no parallax, no intro.

**Allowed patterns:** tabular numbers, the gold ribbon underline, the fold cut, A-shaped progress marks, the pen circle on catalog highlights, the session-once intro, a gold ribbon loader only while a route is loading, example figures only when labelled.

Every number in a column, table, timer or price uses `--font-data` (Readex Pro, tabular Western digits).

## 2. Genjitsu directives

Genjitsu means "the actual facts". Every screen answers: where does this student stand, exactly, today?

1. **Show the number, not a mood.** "81 / 100 · Very Good" beats a 4-star icon. A progress bar always carries its value beside it.
2. **One source per figure.** Every number on screen comes from stored data (attempts, attendance, payments). If we cannot compute it, we do not show it. No invented social proof, no "10,000+ students" until it is true.
3. **Summary first, detail on demand.** Dashboard order: streak · average · rank → weakest concept → next lesson. Drill-down is a click, never a scroll through decoration.
4. **State in form, not only colour.** Up/down uses ▲/▼ plus colour. The exam tier is a labelled chip. Colour-blind students must read the same facts.
5. **Exam-native vocabulary.** Use the Ministry's terms: الدرجة من ١٠٠, ممتاز, جيد جدًا, نظام الامتحان, أسئلة تدريبية. Never claim ministry authorship of a question set. Not invented gamer words.
6. **Energy lives in the data.** The pen, the highlighter, count-ups and rank changes are reserved for real achievements. Surfaces stay calm.
7. **No decoration that carries nothing.** No blobs, glass, gradient text, stock-photo heroes, emoji icons, or illustrations behind data.

### Egyptian grade tiers (score 0–100)
| Score | Arabic | English | Chip |
|---|---|---|---|
| 85–100 | ممتاز | Excellent | marker fill |
| 75–84 | جيد جدًا | Very Good | ink outline |
| 65–74 | جيد | Good | neutral outline |
| 50–64 | مقبول | Pass | neutral outline |
| 0–49 | ضعيف | Poor | pen outline |

## 3. Colour

Light only (`color-scheme: light`). Contrast ratios are WCAG 2.x.

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `--color-ground` | `#F6F7FB` | page background (vellum) | |
| `--color-surface` | `#FFFFFF` | cards, header, footer | |
| `--color-raised` | `#EDEFF7` | tiles inside cards, hover | |
| `--color-hairline` | `#E3E6F3` | dividers, card borders (decorative) | |
| `--color-rule` | `#DDE1F2` | dashed rules in cards | |
| `--color-field` | `#8A90B0` | input borders | 3.1 on surface |
| `--color-ink` | `#0D1030` | text | 17.6 on ground |
| `--color-ink-muted` | `#545A7A` | labels, meta | 6.3 on ground |
| `--color-primary` | `#2430D8` | primary button, course card band | white on it 8.0 |
| `--color-on-primary` | `#FFFFFF` | text on primary and night | |
| `--color-night` | `#0B0F4A` | heroes, result cards, trust strip | vellum on it 17.5 |
| `--color-pen` | `#2430D8` | the lapis accent: links, icons, marks | 7.5 on ground |
| `--color-marker` | `#F2B544` | gold leaf: progress, achievements, ribbon, free badge. Never text on light | ink on it 10.4 |
| `--color-up` | `#0F8A5F` | improvement, correct | 4.6 on surface |
| `--color-down` | `#C8323C` | decline, wrong, errors | 5.3 on surface |
| `--color-focus` | `#2430D8` | 2px focus ring, 2px offset | |

Token names `pen` and `marker` are kept from the first brand so components inherit the new palette.

## 4. Typography

| Token | Family | Use |
|---|---|---|
| `--font-display` | `"Readex Pro", "Segoe UI", Tahoma, system-ui, sans-serif` | headings, hero figures, buttons, chips |
| `--font-body` | `"Readex Pro", "Segoe UI", Tahoma, system-ui, sans-serif` | reading text, inputs |
| `--font-data` | `"Readex Pro", "Segoe UI", Tahoma, system-ui, sans-serif` + `font-variant-numeric: tabular-nums` | tables, scores in lists, prices, timers |

Loaded with `next/font/google` (self-hosted at build, `display: swap`), subsets `arabic` + `latin`. Weights: Readex Pro 300–700. One bilingual family, so mixed Arabic and English never change tone.

**Digits.** Data uses Western digits (0–9): they are the only fixed-width digits in either face, and Egyptian exam results are published with them. Arabic-Indic digits (٠–٩) are fine in Arabic prose labels ("منذ ٣ دقائق"), never in a column.

### Scale (fluid, 1.25 ratio, 360px → 1280px)
| Token | Size | Arabic line-height | Latin line-height | Weight |
|---|---|---|---|---|
| `--text-hero` | clamp(2.4rem, 1.5rem + 3.6vw, 4.25rem) | 1.15 | 1.1 | 700 |
| `--text-display` | clamp(2rem, 1.6rem + 1.8vw, 2.5rem) | 1.25 | 1.15 | 600 |
| `--text-h1` | clamp(1.625rem, 1.4rem + 1vw, 2rem) | 1.3 | 1.2 | 600 |
| `--text-h2` | clamp(1.375rem, 1.25rem + .55vw, 1.5625rem) | 1.4 | 1.3 | 600 |
| `--text-h3` | 1.25rem | 1.5 | 1.4 | 500 |
| `--text-body-ar` | 1.0625rem (17px) | 1.8 | | 400 |
| `--text-body` | 1rem (16px) | | 1.6 | 400 |
| `--text-small` | .875rem | 1.7 | 1.5 | 400 |
| `--text-label` | .8125rem | 1.5 | 1.4 | 500 |
| `--text-figure` | 1.75rem | 1.1 | 1.1 | 600 |

Arabic runs one body step larger than Latin because its x-height reads smaller. Running text max width 65ch. Headings use `text-wrap: balance`. No letter-spacing on Arabic, ever; Latin uppercase labels get `.08em`.

## 5. Space, shape, layout

- **Spacing (4px base):** `--space-1` 4 · `--space-2` 8 · `--space-3` 12 · `--space-4` 16 · `--space-6` 24 · `--space-8` 32 · `--space-12` 48 · `--space-16` 64. Data tiles 8–12, cards 16, sections 48–64.
- **Radii:** `--radius-sm` 6px (inputs, buttons) · `--radius-md` 10px (panels, grade tiles) · `--radius-lg` 16px (cards) · `--radius-full` (chips, avatars).
- **Borders and shadow:** 1px `--color-hairline` on cards plus `--shadow-paper`, the only shadow. Outline buttons and grade tiles use 1.5px `--color-ink`. Inputs use `--color-field`.
- **Layout:** logical properties only (`margin-inline-start`, `padding-inline`, `inset-inline-end`) so RTL and LTR flip with `dir`. Icons that point (arrows, chevrons) mirror in RTL; icons that don't (play, check) never mirror.
- **Breakpoints:** 375 phone (primary), 768 tablet, 1024 laptop, 1440 desktop. Dashboards are one column on phones, never a horizontal scroll.
- **Icons:** Lucide, 20px, stroke 1.75. No emoji as icons.

## 6. Motion

| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(.2,.7,.2,1)` | everything |
| `--dur-fast` | 160ms | hover, press |
| `--dur-base` | 240ms | rank chip swap, tabs, panel open/close, toasts |
| `--dur-count` | 700ms | score count-up, bar fill, once per value per page load |
| `--stagger` | 30ms | streak day cells |

- Animate only `transform`, `opacity`, `background-color`, `border-color`, `color`.
- Every unmount has an exit (opacity + 4px translate, `--dur-base`).
- **Intro** (home, `src/components/brand/Intro.tsx`, `IntroScene.tsx` + `src/app/brand.css`), fixed night overlay over the rendered page, 2s (2.0s authored × 1): 0–0.9s two lapis books (three.js) fall with pages fluttering and land face down as A A · 0.95–1.33s the gold ribbon threads through both · 1.40–1.85s the scene fades while the wordmark rises 12px (1.45–1.95s) · 1.76–2.00s overlay fades. The overlay and wordmark are CSS, so they play without WebGL. three.js loads only when the intro plays. Click, tap, any key or a scroll gesture skips. Once per tab session (`sessionStorage`), never under reduced motion.
- Nothing else reacts to scroll.
- `prefers-reduced-motion` or the in-app toggle: durations become 0, count-ups show the final value, colour still changes.

## 7. Components (5 states each: default · hover · focus-visible · active · disabled)

- **Button primary:** `--color-primary` background, `--color-on-primary` text, Readex Pro 600, padding 14/24, `--radius-sm`. Hover: mix 84% fill + 16% black. Focus: 2px `--color-focus` outline, 2px offset. Disabled: 45% opacity, `not-allowed`. One primary button per view.
- **Button secondary:** transparent, `--color-ink`, 1.5px `--color-ink` border. Hover: `--color-raised` background.
- **Input:** `--color-surface` background, 1px `--color-field`, `--radius-sm`, 44px min height. Focus: border `--color-ink` + focus ring. Error: border `--color-down` and a text message under it saying what to fix.
- **Card:** `--color-surface`, 1px hairline, `--shadow-paper`, `--radius-lg`, padding 20–24. Course card: lapis band (grade, title, free badge) over teacher and price (`src/components/CourseCard.tsx`). Never a card inside a card; inner groups use `--color-raised` tiles.
- **Stat tile:** `--color-raised`, `--radius-sm`, padding 10/12. Value `--text-figure` (display face for one hero value, `--font-data` when tiles sit in a row that must align), label `--text-label` muted.
- **Chip:** `--radius-full`, 1px border, `--text-label`. Variants: tier (table above), up (▲ + `--color-up`), down (▼ + `--color-down`).
- **Concept row:** label + score (`--font-data`) + 4px bar with value beside it. Weak (< 65) bar in `--color-down`. Hover: `--color-raised`.
- **Paywall lock:** lesson row with lock icon, price in `--font-data`, "Free preview" secondary button when Unit 1. Never blurs content as a teaser.
- **Video watermark:** VdoCipher renders it; spec: name + phone + IP, 40% opacity, `--color-ink`, moves every 8–12s.

## 8. Copy voice

Plain, direct, exam-literate. Arabic in Modern Standard, understood from the Gulf to Egypt. Buttons say what happens ("اشترك في الفصل الدراسي", "Start free unit"). One name per action across the site. Errors say what went wrong and how to fix it. No filler verbs (elevate, unleash, seamless), no em dashes in UI copy.
