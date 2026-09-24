# Coral Tribe web style guide

The design system of coraltribe.io (repo: `coral-tribe-website`, Sept 2026 rebuild).
Use this to restyle the calculator so it feels like the same product.
Reference implementation: `../coral-tribe-website/styles.css` — copy from it freely.

## Feel

White, spacious, typographic. One idea per screen. Motion is subtle and rare —
a gentle fade-and-rise at most, never parallax, never bouncy. When in doubt:
more whitespace, fewer elements, no decoration.

## Tokens

```css
:root {
  --paper: #ffffff;      /* page background — always white */
  --ink: #141414;        /* primary text */
  --ink-soft: #3c3c3c;   /* body copy */
  --muted: #8f8f8f;      /* labels, captions */
  --rule: #dfdcd6;       /* hairlines */
  --dark: #101010;       /* dark (video) sections fallback */
  --font-display: "Coral Tribe", Georgia, serif;
  --font-body: -apple-system, "Helvetica Neue", Arial, sans-serif;
  --gutter: clamp(20px, 5vw, 64px);
}
```

## Fonts

- **"Coral Tribe"** display serif — the wordmark font. File:
  `coral-tribe-website/assets/fonts/coral-tribe.ttf` (13 KB, already copied to `assets/fonts/coral-tribe.ttf` in this repo;
  `font-display: swap`, preload it). Used ONLY for: page-title words, big
  headline numbers, stat values.
  **Important quirk:** lowercase letters render as alternate decorative glyphs
  (i → ɸ, n → П, y → Ψ). Always type display-font text in TRUE CAPITALS
  ("OUR FUND", not "Our Fund") so I, N etc. render as clean letters.
- **Helvetica Neue stack** (`--font-body`) for everything else. Body copy is
  regular weight; labels and nav are bold.
- **Georgia** (`Georgia, "Times New Roman", serif`) — the quiet "editorial
  serif", used sparingly where a full sentence needs presence but the display
  font would be too decorative: the Community page's large statement
  (`clamp(2rem, 4.2vw, 3.4rem)`, line-height 1.16) and its link-list labels
  (`clamp(1.3rem, 2.3vw, 1.9rem)`). System font, nothing to load.
- No Google Fonts, no handwritten/script fonts (Caveat Brush was tried and
  rejected as off-brand).

## Type styles

| Role | Spec |
|---|---|
| Page word / header title | display font, `clamp(1.5rem, 2.6vw, 2.3rem)`, letter-spacing 0.05em, CAPS |
| Hero number (e.g. $11,760) | display font, `clamp(4.2rem, 15vw, 12.5rem)`, line-height 0.95 |
| Stat value | display font, `clamp(2.2rem, 4.6vw, 3.6rem)`, line-height 1 |
| Label / caption / eyebrow | body font 700, UPPERCASE, letter-spacing 0.13–0.2em, `--muted`, 11px–0.95rem |
| Body copy | body font, `clamp(1rem, 1.35vw, 1.18rem)`, line-height 1.7–1.75, `--ink-soft`, max-width 34em, centered |
| Nav links | body font 700, 12px, UPPERCASE, letter-spacing 0.14em; no underline; **underline on hover** (`text-underline-offset: 7px`, thickness 1.5px) and on the active page (`aria-current`) |

## Layout

- Content column max-width ~920px, side padding `var(--gutter)`.
- **One spotlight per screen**: each major section is
  `min-height: 100dvh` (minus fixed header), flex-centered, so nothing
  competes for attention. Generous whitespace between everything.
- Stat rows: 3-column grid, each item with a 1px `--rule` top border and
  `padding-top ~24px`; value above, muted uppercase label below.
- Hairlines (`1px solid var(--rule)`) are the only dividers used anywhere.
- Mobile: single breakpoint at 760px; grids collapse to one column; use
  `100dvh` (never `100vh`) for full-height sections.

## Header

- Fixed white bar, page word centered in the display font (CAPS), links
  top-right. The word links to the homepage.
- The nav links are invisible by default; they fade in for ~2s when the user
  scrolls up (or hovers the bar), then fade out. `transition: opacity 0.5s`.
- The whole header fades out when a page-ending dark/footer section passes
  mid-screen.
- (For the calculator a simpler always-visible variant of this header is fine,
  but keep the type specs and the hover-underline.)

## Buttons

```css
.btn-solid {
  display: inline-block;
  background: var(--ink);
  color: #fff;
  font: 700 12px var(--font-body);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  padding: 18px 38px;          /* sharp corners — no border-radius */
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.btn-solid:hover { opacity: 0.82; transform: translateY(-1px); }
```

Secondary actions are plain text links with the hover-underline treatment.

## Motion

- One utility: `.reveal` — `opacity: 0; transform: translateY(22px);
  transition: opacity 0.9s ease, transform 0.9s ease;` → `.is-visible` via
  IntersectionObserver (threshold 0.15, unobserve after firing).
- Vary the rhythm, don't repeat it: a group of stats staggers in with
  `transition-delay` steps of ~0.22s; a final CTA appears with **no**
  animation at all.
- Always honor `prefers-reduced-motion: reduce` (show everything, no
  transitions).
- Hovers are opacity shifts (0.45–0.82) or underlines. Nothing moves more
  than a couple of pixels.

## Misc conventions

- Static files only, no build step; cache-bust CSS/JS with `?v=N` query
  strings and bump N on every change.
- Images: explicit width/height attributes, `loading="lazy"` below the fold.
- The Coral Tribe logotype/wordmark appears only on dark video sections
  (white version) — content pages carry their page word instead.
