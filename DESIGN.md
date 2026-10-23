# ELHASHASH ACADEMY · Design DNA

The single source of truth for every screen. Every colour, size, radius and duration in code comes from this file through `tokens.css`. No raw hex, px or ms values in components.

Audience: students in Grade 10 to 12 (Egypt Secondary 1–3 / Thanawya Amma, UAE Cycle 3) and the parents who pay. Classes are taken after school, so the default light is **dusk**. Arabic first (RTL), English second.

## 1. Theses (validated)

**Visual.** A dusk-first interface: a deep indigo-slate ground (never black) with warm, slightly dimmed off-white text, one sunset-amber accent kept for streaks, ranks and the main action, and a mint/coral pair only for up/down. A soft lavender-grey afternoon mode, never pure white. Readex Pro for headings and large single figures, IBM Plex Sans Arabic for reading text and every number that sits in a column. Data tiles are dense; reading text gets room. Components are flat and tonal, with hairline borders and 6–10px radii, no drop shadows.

**Interaction.** Quick and dry: 160ms for hover, 240ms for state changes, one 700ms count-up when a score first appears, streak days filling with a 30ms stagger, all on one ease-out `cubic-bezier(.2,.7,.2,1)`. Hover shifts the surface tone and never scales. No scroll effects inside the app. Forbidden: bounce, elastic, looping glows or pulses, confetti, parallax, autoplay carousels.

**Allowed patterns:** tabular numbers, hairline rules, the amber accent, the one-time count-up, rank chips, a live dot (live classes only).

Amendment at the design-system gate: Readex Pro's digits are proportional and it has no `tnum` feature (checked in the font file). IBM Plex Sans Arabic's Western digits are all 600 units wide. So every number in a column, table, timer or price uses `--font-data` (Plex), and Readex carries headings and single hero figures only.

## 2. Genjitsu directives

Genjitsu means "the actual facts". Every screen answers: where does this student stand, exactly, today?

1. **Show the number, not a mood.** "81 / 100 · Very Good" beats a 4-star icon. A progress bar always carries its value beside it.
2. **One source per figure.** Every number on screen comes from stored data (attempts, attendance, payments). If we cannot compute it, we do not show it. No invented social proof, no "10,000+ students" until it is true.
3. **Summary first, detail on demand.** Dashboard order: streak · average · rank → weakest concept → next lesson. Drill-down is a click, never a scroll through decoration.
4. **State in form, not only colour.** Up/down uses ▲/▼ plus colour. The exam tier is a labelled chip. Colour-blind students must read the same facts.
5. **Exam-native vocabulary.** Use the Ministry's terms: الدرجة من ١٠٠, ممتاز, جيد جدًا, نظام الامتحان, أسئلة الوزارة. Not invented gamer words.
6. **Energy lives in the data.** Amber, count-ups and rank changes are reserved for real achievements. Surfaces stay calm.
7. **No decoration that carries nothing.** No blobs, glass, gradient text, stock-photo heroes, emoji icons, or illustrations behind data.

### Egyptian grade tiers (score 0–100)
| Score | Arabic | English | Chip |
|---|---|---|---|
| 85–100 | ممتاز | Excellent | amber fill |
| 75–84 | جيد جدًا | Very Good | amber outline |
| 65–74 | جيد | Good | neutral outline |
| 50–64 | مقبول | Pass | neutral outline |
| 0–49 | ضعيف | Poor | coral outline |

## 3. Colour

Depth comes from tone (ground → surface → raised), never shadows. Contrast ratios are computed (WCAG 2.x).

### Dusk (default, `color-scheme: dark`)
| Token | Hex | Use | Contrast |
|---|---|---|---|
| `--color-ground` | `#161A26` | page background | |
| `--color-surface` | `#1E2332` | cards, panels | |
| `--color-raised` | `#272D3F` | tiles inside cards, hover | |
| `--color-hairline` | `#3A4157` | dividers, card borders (decorative) | 1.71 |
| `--color-field` | `#6B7189` | input borders, UI boundaries | 3.24 on surface |
| `--color-ink` | `#ECE6DA` | body text | 13.97 on ground |
| `--color-ink-muted` | `#A9A6B4` | labels, meta | 7.27 on ground · 6.56 on surface |
| `--color-amber` | `#F2A65A` | accent text, streak, rank | 8.58 on ground |
| `--color-amber-fill` | `#F2A65A` | primary button, top-tier chip | |
| `--color-on-amber` | `#1F1407` | text on amber fill | 8.94 |
| `--color-up` | `#6FCFB0` | improvement, correct | 8.37 on surface |
| `--color-down` | `#EE7B6A` | decline, wrong, weak concept | 5.72 on surface |
| `--color-focus` | `#ECE6DA` | 2px focus ring, 2px offset | |

### Afternoon (secondary, `color-scheme: light`)
| Token | Hex | Contrast |
|---|---|---|
| `--color-ground` | `#EEECF2` | |
| `--color-surface` | `#F8F7FA` | |
| `--color-raised` | `#E4E2EA` | |
| `--color-hairline` | `#B9B6C6` | 1.70 (decorative) |
| `--color-field` | `#7D8196` | 3.61 on surface |
| `--color-ink` | `#1D2131` | 13.63 on ground |
| `--color-ink-muted` | `#555A6E` | 5.83 on ground · 6.40 on surface |
| `--color-amber` | `#A9561A` | 4.88 on surface (text) |
| `--color-amber-fill` | `#E8924A` | on-amber 7.44 |
| `--color-on-amber` | `#1F1407` | |
| `--color-up` | `#1C7A60` | 4.92 on surface |
| `--color-down` | `#B4442F` | 5.17 on surface |
| `--color-focus` | `#1D2131` | |

Theme selection: dusk by default; afternoon when the user picks it or the OS asks for light. Saved per user.

## 4. Typography

| Token | Family | Use |
|---|---|---|
| `--font-display` | `"Readex Pro", "IBM Plex Sans Arabic", "Segoe UI", Tahoma, system-ui, sans-serif` | headings, hero figures, buttons, chips |
| `--font-body` | `"IBM Plex Sans Arabic", "Segoe UI", Tahoma, system-ui, sans-serif` | reading text, inputs |
| `--font-data` | `"IBM Plex Sans Arabic", "Segoe UI", Tahoma, system-ui, sans-serif` + `font-variant-numeric: tabular-nums` | tables, scores in lists, prices, timers |

Loaded with `next/font/google` (self-hosted at build, `display: swap`), subsets `arabic` + `latin`. Weights: Readex 400/500/600/700, Plex 400/500/600.

**Digits.** Data uses Western digits (0–9): they are the only fixed-width digits in either face, and Egyptian exam results are published with them. Arabic-Indic digits (٠–٩) are fine in Arabic prose labels ("منذ ٣ دقائق"), never in a column.

### Scale (fluid, 1.25 ratio, 360px → 1280px)
| Token | Size | Arabic line-height | Latin line-height | Weight |
|---|---|---|---|---|
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
- **Radii:** `--radius-sm` 6px (inputs, tiles, buttons) · `--radius-md` 10px (cards, panels) · `--radius-full` (chips, avatars).
- **Borders:** 1px `--color-hairline` on cards. Inputs use `--color-field`. No shadows anywhere; a modal sits on a 60% `--color-ground` scrim, no blur.
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
- Landing page may fade the hero in once (`--dur-base`). Nothing else reacts to scroll.
- `prefers-reduced-motion` or the in-app toggle: durations become 0, count-ups show the final value, colour still changes.
- The 3D streak gem (React Three Fiber) rotates only while the pointer is over it or once on a new streak day; never in a continuous loop. Falls back to a static 2D SVG gem when WebGL is missing, on low-end devices, or with reduced motion.

## 7. Components (5 states each: default · hover · focus-visible · active · disabled)

- **Button primary:** `--color-amber-fill` background, `--color-on-amber` text, Readex 600 15px, padding 12/18, `--radius-sm`. Hover: mix 86% fill + 14% white. Active: mix 84% fill + 16% black. Focus: 2px `--color-focus` outline, 2px offset. Disabled: 45% opacity, `not-allowed`. One primary button per view.
- **Button secondary:** transparent, `--color-ink`, 1px `--color-hairline`. Hover: `--color-raised` background, `--color-ink-muted` border.
- **Input:** `--color-surface` background, 1px `--color-field`, `--radius-sm`, 44px min height. Focus: border `--color-ink` + focus ring. Error: border `--color-down` and a text message under it saying what to fix.
- **Card:** `--color-surface`, 1px hairline, `--radius-md`, padding 16. Never a card inside a card; inner groups use `--color-raised` tiles.
- **Stat tile:** `--color-raised`, `--radius-sm`, padding 10/12. Value `--text-figure` (Readex for one hero value, `--font-data` when tiles sit in a row that must align), label `--text-label` muted.
- **Chip:** `--radius-full`, 1px border, `--text-label`. Variants: tier (table above), up (▲ + `--color-up`), down (▼ + `--color-down`).
- **Concept row:** label + score (`--font-data`) + 4px bar with value beside it. Weak (< 65) bar in `--color-down`. Hover: `--color-raised`.
- **Paywall lock:** lesson row with lock icon, price in `--font-data`, "Free preview" secondary button when Unit 1. Never blurs content as a teaser.
- **Video watermark:** VdoCipher renders it; spec: name + phone + IP, 40% opacity, `--color-ink`, moves every 8–12s.

## 8. Copy voice

Plain, direct, exam-literate. Arabic in Modern Standard with Egyptian-friendly word choice. Buttons say what happens ("اشترك في الفصل الدراسي", "Start free unit"). One name per action across the site. Errors say what went wrong and how to fix it. No filler verbs (elevate, unleash, seamless), no em dashes in UI copy.
