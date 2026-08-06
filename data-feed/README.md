# Live data feed — connecting the calculator to the finance sheets

The calculator reads its live numbers from a single JSON URL (`FEED_URL` in
`../config.js`). This folder sets that URL up as a **Google Apps Script web app**
that exposes only a few aggregate numbers from a `CalcFeed` tab — never the rest
of the workbook.

```
Finance sheets (Avery)
  └─ "CalcFeed" tab: a few key/value cells
       └─ Apps Script web app (calcfeed.gs) → JSON
            └─ calculator config.js fetches it (falls back to constants if down)
```

## What the calculator consumes

| Key | What it is | Source | Auto-updates? |
|---|---|---|---|
| `grossMonthly` | Total monthly fund yield **before** the 45/40/15 split (~$2,705). Calculator takes 40% for holders. | Ledger sheet, "Total CF Share" | ✅ |
| `capitalDeployed` | Current FITs value deployed (~$288,000) | Ops sheet, FITs tab | ✅ |
| `totalPoolPoints` | Points locked in the rewards pool (21,557,825) | **Not in these sheets** — stays a constant for now | ❌ (constant) |
| `irr` | Reference yield (0.14) | Display only | ❌ (constant) |

Anything the feed omits keeps its `FALLBACK` constant in `config.js`, so a partial
or failed feed never breaks the page.

## Setup (one time)

### 1. Add a `CalcFeed` tab
In the ledger sheet (`1q1tp…`), add a tab named exactly **`CalcFeed`** with:

| A (key) | B (value) |
|---|---|
| grossMonthly | `=`_(see below)_ |
| capitalDeployed | `=`_(see below)_ |

**`grossMonthly`** — the recent monthly "Total CF Share" (the fund's claimed yield
before the split). Point it at the PORTFOLIO **Total CF Share** row on the Monthly
tab. A trailing-3-month average smooths the month-to-month swings, e.g.:
`=AVERAGE(Monthly!C<row>:E<row>)` — replace `<row>` and the columns with the actual
"Total CF Share" cells (the newest 3 months). _(You know the layout; the value
should land around $2,700.)_

**`capitalDeployed`** — the current FITs total from the ops sheet (`1-6G4…`). Either
type it, or pull it live with `IMPORTRANGE`:
`=IMPORTRANGE("1-6G4OKT3glV92r_hUFJ04TkhinZAV6IILLKt5E-mmEc","'<tab>'!<cell>")`
pointing at the FITs total (~$288,398). _(First use pops an "Allow access" button.)_

> Sanity check: `grossMonthly ≈ 2700`, `capitalDeployed ≈ 288000`. If the calculator
> starts showing holder numbers ~40% too low, `grossMonthly` was set to the holder
> amount by mistake — it must be the **pre-split** total.

### 2. Deploy the web app
`Extensions > Apps Script`, paste `calcfeed.gs`, then
`Deploy > New deployment > Web app`, **Execute as: Me**, **Who has access: Anyone**,
authorize, and copy the URL ending in `/exec`.

### 3. Send the URL
Paste the `/exec` URL back and it gets set as `FEED_URL` in `config.js` and pushed —
the live site then pulls real numbers, refreshing whenever the sheet changes.

## Notes
- **Privacy:** only the CalcFeed cells are returned. Do **not** "Publish to web" the
  workbook.
- **CORS:** Apps Script `/exec` GET responses are browser-fetchable. If a future
  Google change ever blocks it, the fallback plan is a scheduled build-time sync
  (a GitHub Action writing the numbers into the site) — same CalcFeed tab, no live
  dependency.
- To also auto-update `totalPoolPoints`, add it to CalcFeed once a source exists;
  the calculator already looks for it.
