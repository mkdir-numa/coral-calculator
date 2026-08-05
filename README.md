# Coral Tribe — Rewards Calculator

A standalone "lock now vs keep staking" calculator. Self-contained static site:
no build step, no framework, no external script it depends on.

## Files

| File | What it is |
|---|---|
| `index.html` | The calculator. Self-contained UI; loads the two scripts below locally. |
| `calc.js` | **Pure math module.** Inputs + config → numbers. No UI, no I/O. Runs in the browser and in Node. |
| `config.js` | **Live-data layer.** The live values + today's-value fallbacks + the feed loader. |
| `calc.test.js` | Unit tests pinned to the worked examples. |
| `netlify.toml` | Deploy config (static, publish root). |

## The model in one line

`yourMonthlyUSDC = (yourLockedPoints / totalPoolPoints) × holderDistribution`

The holder distribution is the **40%** slice of the Community Fund's monthly yield.
Every yield claim splits **45 / 40 / 15** — 45% compounds back into the fund, 40% goes
to holders, 15% to ReFi Hub. Today the fund claims ~$2,705/mo, so holders get ~$1,082/mo.
Points are the unit of account; a Coral only matters because it produces points. The
output is a share of the rewards pool, never a guaranteed return.

## Run / test locally

- **Open:** open `index.html` in a browser (works offline — falls back to today's figures).
- **Tests:** `node calc.test.js` (16 tests, instant).

## Deploy

This repo is connected to **Netlify** with continuous deployment:

> **Every push to the default branch auto-deploys.** No build, no zip, no manual upload.

First-time setup (once): in Netlify → **Add new site → Import an existing project → GitHub →
pick this repo**. Build command: *(none)*. Publish directory: `.`

## Wiring the live values

`config.js` ships with all feeds **off** (`ENDPOINTS = { … : null }`), so today's figures are
authoritative. To go live, set a URL per value; each must return JSON with the listed field.
Anything that fails to load silently keeps its fallback — the page can never break on a bad feed.

| Value | Today (fallback) | Endpoint field | Notes |
|---|---|---|---|
| `totalPoolPoints` | 21,557,825 | `lockedPoints` | Points **locked in the pool** only. The denominator. |
| `grossMonthly` | 2,705 | `grossMonthly` | Total fund yield/mo, **pre-split**. Holders get 40%. |
| `capitalDeployed` | 288,000 | `deployed` | Anchors the fund slider's "today". |
| `irr` | 0.14 | `irr` | Reference rate shown in copy. |

## Notes

- The footer links back to the **main Coral Tribe site**. They currently point at
  `https://fantastic-dasik-a3eca0.netlify.app/` — update those hrefs in `index.html` when the
  main site moves to a custom domain.
- Fonts load from Google Fonts as progressive enhancement and degrade to Georgia/system fonts
  if blocked — nothing the page depends on can fail.
