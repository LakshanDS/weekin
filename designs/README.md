# WeekIn — Design System

Brand, palette, typography, and tokens for WeekIn (Weekly Report Generator & Team Dashboard).
Source of truth: [`tokens.json`](./tokens.json).

## Brand

**WeekIn** — one word, two colors: **Week** in ink, **In** in coral. The name reads as "week in" (what you log) and "wee-kin" if you like — friendly, round, low-ceremony. That roundness is the design personality: generous radii, soft Fredoka display type, flat surfaces, no gradients.

## Color palette

| Token | Value | Usage |
|---|---|---|
| `brand.ink` | `#242424` | Wordmark "Week", body text, primary buttons, dark panels |
| `brand.coral` | `#FF5757` | Wordmark "In", accents, active/highlight states, brand moments |
| `brand.white` | `#FFFFFF` | Backgrounds, cards, reversed logo |
| `ink.soft` | `#565656` | Secondary text |
| `ink.muted` | `#8A8A8A` | Placeholders, captions |
| `ink.subtle` | `#E8E8E8` | Borders, dividers |
| `ink.tint` | `#F5F5F5` | Hover washes, subtle fills |
| `coral.dark` | `#E14B4B` | Coral hover/pressed |
| `coral.tint` | `#FFF0F0` | Coral wash backgrounds |

**Rules**

- Coral is an *accent*, not a fill color for large surfaces. One coral moment per view (active nav item, key metric, primary highlight) keeps it loud.
- Text is always ink on white or white on ink — never coral for long text (contrast fails). Coral for text only at large/bold display sizes or with the `.tint` wash behind.
- Status colors (semantic tokens: success `#1F8A5A`, info `#2F6FDE`, warning `#D97E00`, neutral `#93A1AD`) are functional, not brand — they exist so Draft / Submitted / Needs Correction / Approved stay instantly distinguishable. Coral is never used for status.

## Typography

| Role | Font | Notes |
|---|---|---|
| Brand / display | **Fredoka** (Google Fonts, free, OFL) | Wordmark (SemiBold 600), headings 500–700. Rounded, friendly, chunky. |
| Body / UI | **Public Sans** | Neutral, legible; lets Fredoka carry personality. |
| Data / labels | **IBM Plex Mono** | Eyebrows, form labels, status tags, timestamps — uppercase with wide tracking. |

All three load from Google Fonts. Fredoka source used for the logo: `logo/Fredoka-SemiBold.ttf` (SIL OFL license).

## Logo

Wordmark set in Fredoka SemiBold, converted to vector paths (no font dependency at render time). Regenerate with `bun designs/logo/generate.mjs` after editing.

| File | Use |
|---|---|
| `logo/logo.svg` | Primary — ink "Week" + coral "In", transparent bg |
| `logo/logo-white.svg` | Dark surfaces — white "Week" + coral "In" |
| `logo/logo-ink.svg` | Single-color ink (print, stamps) |
| `logo/logo-white-mono.svg` | Single-color white for dark/photographic backgrounds |
| `logo/mark.svg` | App icon / favicon source — coral rounded square, white W |

**Usage rules**

- Clear space: keep at least the height of the "k" bowl free on all sides.
- Minimum size: 96px wide (wordmark), 24px (mark).
- Never recolor outside ink/coral/white, never add effects, never stretch.

## Shapes, spacing, elevation

- Radius: inputs 6px, buttons 10px, cards/panels 16px, tags/chips pill. The app is intentionally rounded-square — echoes Fredoka's bowls.
- Spacing: 4px base scale (4/8/12/16/24/32/48/64).
- Elevation is rare and flat: hairline `#E8E8E8` borders do most of the separation work; a single soft shadow token exists for floating layers (chat widget, modals).

## Applying to the app

Tokens map 1:1 to the Tailwind v4 `@theme` block in `app/assets/css/main.css`. Brand font additions:

```css
@import "tailwindcss";
@import url("https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&display=swap");

@theme {
  --color-ink: #242424;
  --color-coral: #FF5757;
  --font-brand: "Fredoka", sans-serif;
}
```

(The app currently ships its own interim palette; migrating it to these tokens is a follow-up task — see plan.md.)
