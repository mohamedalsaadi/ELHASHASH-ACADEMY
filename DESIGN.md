# ELHASHASH ACADEMY · Design DNA

The single source of truth for every screen. Every colour, size, radius and duration in code comes from this file through `tokens.css`. No raw hex, px or ms values in components.

Audience: students in Grade 10 to 12 (Egypt Secondary 1–3 / Thanawya Amma, UAE Cycle 3) and the parents who pay. Direction A, "exam paper" (chosen 2026-10-24): the site looks like a marked answer sheet. Arabic first (RTL), English second.

## 0. Brand

**Mark.** The letter ح (Alexandria 800, outlined to a path) inside a hand-drawn marking circle in `--color-pen` that does not quite close, with a pen tick at the lower inline end. It reads as a teacher's mark on a correct answer: "know your real score". 48 grid: circle about r 20, 2.6 stroke, round caps. Code: `src/components/brand/Mark.tsx`.

**Wordmark.** Alexandria. Arabic stacks أكاديمية (600, muted, 0.6em) over **الحشاش** (800). English: ELHASHASH (800) ACADEMY (600, muted). The mark sits at the inline start.

**Sizes.** 24px minimum for the full mark. Favicon (`src/app/icon.svg`): navy tile, paper letter, lighter red circle (#FF5A6E), no tick.

**Where it appears.** Header (40px) and footer (36px) with the wordmark · home intro · empty states (the circle dashed in pencil grey, no letter).

## 1. Theses (validated)

**Visual.** Exam paper: an off-white paper ground with faint notebook rules in heroes, navy ink for text and the primary action, a red correction pen for marks, ticks and links, and a yellow highlighter stroke behind one key word per heading at most. Alexandria for headings, IBM Plex Sans Arabic for reading text and numbers. Cards are white paper with a soft shadow; course cards get a navy header band like the top of an exam sheet. Light only.

**Interaction.** Quick and dry: 160ms for hover, 240ms for state changes, one 700ms draw when a mark first appears, all on one ease-out `cubic-bezier(.2,.7,.2,1)`. Hover shifts tone or lifts a card 2px. Forbidden: bounce, elastic, looping glows or pulses, confetti, autoplay carousels, smooth-scroll libraries.

**Marketing vs app.** The home page may move: a 1.6s logo intro once per tab session and the pen circling the sample score once. App pages stay calm: no scroll effects, no parallax, no intro. No WebGL.

**Allowed patterns:** tabular numbers, notebook rules (heroes only), the highlighter stroke, the pen circle and tick, the session-once intro, a red pen loader only while a route is loading, example figures only when labelled.

Amendment at the design-system gate: Every number in a column, table, timer or price uses `--font-data` (Plex, fixed-width Western digits); Alexandria carries headings and single hero figures only.

## 2. Genjitsu directives

Genjitsu means "the actual facts". Every screen answers: where does this student stand, exactly, today?

1. **Show the number, not a mood.** "81 / 100 · Very Good" beats a 4-star icon. A progress bar always carries its value beside it.
2. **One source per figure.** Every number on screen comes from stored data (attempts, attendance, payments). If we cannot compute it, we do not show it. No invented social proof, no "10,000+ students" until it is true.
3. **Summary first, detail on demand.** Dashboard order: streak · average · rank → weakest concept → next lesson. Drill-down is a click, never a scroll through decoration.
4. **State in form, not only colour.** Up/down uses ▲/▼ plus colour. The exam tier is a labelled chip. Colour-blind students must read the same facts.
5. **Exam-native vocabulary.** Use the Ministry's terms: الدرجة من ١٠٠, ممتاز, جيد جدًا, نظام الامتحان, أسئلة الوزارة. Not invented gamer words.
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
| `--color-ground` | `#FBFAF6` | page background (paper) | |
| `--color-surface` | `#FFFFFF` | cards, header, footer | |
| `--color-raised` | `#F3F1EA` | tiles inside cards, hover | |
| `--color-hairline` | `#E3E0D6` | dividers, card borders (decorative) | |
| `--color-rule` | `#DCE6F5` | notebook rules, dashed rules in cards | |
| `--color-field` | `#8A93A8` | input borders | 3.1 on surface |
| `--color-ink` | `#14213D` | text | 15.3 on ground |
| `--color-ink-muted` | `#4A5672` | labels, meta | 7.0 on ground · 7.3 on surface |
| `--color-primary` | `#14213D` | primary button, course card band | on-primary 15.3 |
| `--color-on-primary` | `#FBFAF6` | text on primary | |
| `--color-pen` | `#D7263D` | marks, ticks, links, accent text | 5.0 on surface · 4.75 on ground |
| `--color-marker` | `#FFE45E` | highlighter, free badge, hover on outline buttons | ink on it 12.6 |
| `--color-up` | `#1C7A4F` | improvement, correct | 5.3 on surface |
| `--color-down` | `#B42335` | decline, wrong, errors | 6.5 on surface |
| `--color-focus` | `#D7263D` | 2px focus ring, 2px offset | |

## 4. Typography

| Token | Family | Use |
|---|---|---|
| `--font-display` | `"Alexandria", "IBM Plex Sans Arabic", "Segoe UI", Tahoma, system-ui, sans-serif` | headings, hero figures, buttons, chips |
| `--font-body` | `"IBM Plex Sans Arabic", "Segoe UI", Tahoma, system-ui, sans-serif` | reading text, inputs |
| `--font-data` | `"IBM Plex Sans Arabic", "Segoe UI", Tahoma, system-ui, sans-serif` + `font-variant-numeric: tabular-nums` | tables, scores in lists, prices, timers |

Loaded with `next/font/google` (self-hosted at build, `display: swap`), subsets `arabic` + `latin`. Weights: Alexandria 400/600/700/800, Plex 400/500/600.

**Digits.** Data uses Western digits (0–9): they are the only fixed-width digits in either face, and Egyptian exam results are published with them. Arabic-Indic digits (٠–٩) are fine in Arabic prose labels ("منذ ٣ دقائق"), never in a column.

### Scale (fluid, 1.25 ratio, 360px → 1280px)
| Token | Size | Arabic line-height | Latin line-height | Weight |
|---|---|---|---|---|
| `--text-hero` | clamp(2.25rem, 1.5rem + 3vw, 3.75rem) | 1.15 | 1.1 | 800 |
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
- **Radii:** `--radius-sm` 8px (inputs, buttons) · `--radius-md` 12px (panels, grade tiles) · `--radius-lg` 20px (cards) · `--radius-full` (chips, avatars).
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
- **Intro** (home, `src/components/brand/Intro.tsx` + `src/app/brand.css`), CSS only, fixed overlay over the rendered page: F1 0–700 pen circle draws · F2 160–860 letter fades in and drops 6px · F3 860–1020 tick draws · F4 860–1100 wordmark rises 4px · F5 hold · F6 1360–1600 overlay fades. Click, tap or any key skips to F6. Once per tab session (`sessionStorage`), never under reduced motion.
- **Hero score** (home): the pen circles the sample score once, 700ms, after the intro when it plays.
- Nothing else reacts to scroll.
- `prefers-reduced-motion` or the in-app toggle: durations become 0, count-ups show the final value, colour still changes.

## 7. Components (5 states each: default · hover · focus-visible · active · disabled)

- **Button primary:** `--color-primary` background, `--color-on-primary` text, Alexandria 600, padding 14/24, `--radius-sm`. Hover: mix 86% fill + 14% white. Active: mix 84% fill + 16% black. Focus: 2px `--color-focus` outline, 2px offset. Disabled: 45% opacity, `not-allowed`. One primary button per view.
- **Button secondary:** transparent, `--color-ink`, 1.5px `--color-ink` border. Hover: `--color-marker` background.
- **Input:** `--color-surface` background, 1px `--color-field`, `--radius-sm`, 44px min height. Focus: border `--color-ink` + focus ring. Error: border `--color-down` and a text message under it saying what to fix.
- **Card:** `--color-surface`, 1px hairline, `--shadow-paper`, `--radius-lg`, padding 20–24. Course card: navy band (grade, title, free badge) over teacher and price (`src/components/CourseCard.tsx`). Never a card inside a card; inner groups use `--color-raised` tiles.
- **Stat tile:** `--color-raised`, `--radius-sm`, padding 10/12. Value `--text-figure` (Alexandria for one hero value, `--font-data` when tiles sit in a row that must align), label `--text-label` muted.
- **Chip:** `--radius-full`, 1px border, `--text-label`. Variants: tier (table above), up (▲ + `--color-up`), down (▼ + `--color-down`).
- **Concept row:** label + score (`--font-data`) + 4px bar with value beside it. Weak (< 65) bar in `--color-down`. Hover: `--color-raised`.
- **Paywall lock:** lesson row with lock icon, price in `--font-data`, "Free preview" secondary button when Unit 1. Never blurs content as a teaser.
- **Video watermark:** VdoCipher renders it; spec: name + phone + IP, 40% opacity, `--color-ink`, moves every 8–12s.

## 8. Copy voice

Plain, direct, exam-literate. Arabic in Modern Standard with Egyptian-friendly word choice. Buttons say what happens ("اشترك في الفصل الدراسي", "Start free unit"). One name per action across the site. Errors say what went wrong and how to fix it. No filler verbs (elevate, unleash, seamless), no em dashes in UI copy.
