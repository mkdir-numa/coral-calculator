# Coral Tribe calculator style guide

The calculator follows the locked Coral Tribe brand (24 Oct 2026). The source
of truth is the brand kit, not this file:

- `../coral-tribe-brand/brand-kit/BRAND.md`, a copy of the live design system
  (https://claude.ai/artifact/S1EdPDbcPTKopRBjkTpFHq, private)
- `../coral-tribe-brand/brand-kit/tokens.css` and `tokens.json`
- `../coral-tribe-brand/brand-kit/fonts/coral-tribe-1.1.ttf`, copied here as
  `assets/fonts/coral-tribe-1.1.ttf`

The brand kit sits outside this repo, so copy in what you need. If this file
and `BRAND.md` disagree, `BRAND.md` wins; update this file to match.

## Feel

White, spacious, typographic. One idea per screen. Loud in gesture, grounded
in manner: one loud element per layout, everything around it calm. Motion is
subtle and rare. When in doubt: more whitespace, fewer elements, no decoration.

## Tokens

Both pages keep their own variable names in `:root`; they map to the brand
tokens like this:

| Page variable | Brand token | Value | Use |
|---|---|---|---|
| `--bg`, `--surface` | `paper` | `#ffffff` | Page and card ground |
| `--ink` | `ink` | `#16120e` | Headings, numbers, controls, selected states |
| `--body` | `ink-soft` | `#46413a` | Body copy |
| `--muted` | `muted` | `#736d64` | Labels, captions, hints |
| `--line` | `rule` | `#e7e3dc` | Hairlines |
| `--line2` | `rule-strong` | `#d9d3c8` | Input and chip borders |
| `--wine` | `wine` | `#7b2433` | The one accent: the stake-then-lock series, the claimable number |
| `--caution` | `caution` | `#8a5413` | Warnings and lookup errors |
| `--blue`, `--blue-ink` | `action` | `#146c93`, hover `#0f5674` | Links and the primary action only |
| `--r` | `radius-0` | `0` | Corners |

- Sea blue (`--blue`) is the action colour and nothing else: text links, the
  "Look up my Coral" link and the "Look up" button. Not for data, not for
  selected states, not for decoration.
- Selected chips and mode buttons are ink with white text.
- One accent, wine. No second accent, no gradients.
- Square corners, no shadows. Focus is a 2px solid ink outline, offset 3px.

## Fonts

- **Coral Tribe 1.1** (`assets/fonts/coral-tribe-1.1.ttf`, family name
  "Coral Tribe"). `font-display: swap`, preloaded on both pages. Used only for
  the header wordmark here. Display only: never sentences, buttons or body text,
  three words or about 18 characters at most, tracked 0.08em to 0.12em.
  **Marks by choice:** capitals are plain letters. Lowercase a e o i n y draw
  the marks Λ Ξ ⊙ Φ Π Ψ. Type display text in capitals and use a lowercase
  letter only where you want its mark, one per heading, two at most. The eye
  (lowercase o) is the default because it is in the wordmark: `CoRAL TRIBE`.
  Type I as a capital unless you want Φ.
- **Georgia** (`--head`: `Georgia, "Times New Roman", serif`) for headings and
  statements: the page title, section titles, card titles, the subhead. Regular
  weight. System font, nothing to load.
- **Helvetica Neue stack** (`--sans`: `-apple-system, "Helvetica Neue",
  Helvetica, Arial, sans-serif`) for body copy, buttons and labels. Labels are
  bold caps, 10 to 11px, tracked 0.12 to 0.15em, in `--muted`.
- **Space Mono** (`--mono`), loaded from Google Fonts, for numbers only: the
  result figures, pool stats, slider readouts, the chart axis, wallet addresses.
- Nothing else. No Space Grotesk, no Inter, no handwritten or brush fonts.

## Type styles

| Role | Spec |
|---|---|
| Wordmark | Coral Tribe 1.1, 24px (26 / 32 / 40px at 900 / 1600 / 2200px), letter-spacing 0.08em, `CoRAL TRIBE` |
| Page title (h1) | Georgia 400, 26px (36 / 44 / 56px at the same breakpoints), line-height 1.2, sentence case |
| Section title (`.stitle`, `.sect-title`) | Georgia 400, 18px, `--ink` |
| Big number (`.big`, `.card .v`) | Space Mono 700, 24 to 26px and up, letter-spacing -0.02em |
| Label | Helvetica Neue 700, UPPERCASE, 10 to 11px, letter-spacing 0.14em, `--muted` |
| Body copy | Helvetica Neue 400, 15px (16 / 19 / 23px), line-height 1.6 to 1.7, `--body` |
| Primary button | `--blue` ground, white Helvetica Neue 700, 12px, UPPERCASE, letter-spacing 0.15em, square |

## Copy

- Sentence case everywhere, including headings and buttons. Capitals only in
  the display font and in labels.
- No emojis, no em dashes, no exclamation marks.
- Say **rewards**, never "gifts". Say **members**; "holders" only when talking
  about the NFT itself. A **Coral** (capital C) is the NFT.
- Plain, concrete words, no urgency. Rewards are a share of the pool, never a
  guaranteed return: say so.

## Layout

- Content column grows with the screen (720px, then 1080 / 1320 / 1640px on
  the index page) so the tool never becomes a small island on a big monitor.
- Hairlines (`1px solid var(--line)`) are the only dividers. A 3px ink left
  edge marks the recommendation and the estimate.
- Cards only where the thing really is a separate object (the two result
  options, the lookup stats).
- The near-black footer carries the white wave mark, linking to coraltribe.io.

## Motion

- Hovers are opacity shifts (0.82) or colour and underline changes. Nothing
  moves more than a couple of pixels.
- Always honour `prefers-reduced-motion: reduce`.

## Misc conventions

- Static files only, no build step; cache-bust CSS/JS with `?v=N` query
  strings and bump N on every change.
- Images: explicit width/height attributes, `loading="lazy"` below the fold.
- `analytics.js` is shared with the website and docs: change one, copy to all
  three.
