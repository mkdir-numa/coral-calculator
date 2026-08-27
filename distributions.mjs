/*
 * Reconstructs the on-chain reward-distribution history and writes distributions.json:
 *   { updatedAt, totalDistributed, distributions, monthly:[{month, amount}] }
 *
 * The full rebuild is SLOW (~10 min: it scans admin-wallet transactions through
 * the rate-limited proxy), but the on-chain distribution COUNT is a single
 * sub-second account read. So:
 *
 *   node distributions.mjs              rebuild unconditionally
 *   node distributions.mjs --if-changed rebuild only when a new distribution
 *                                       has landed since the committed file
 *
 * Scheduled by .github/workflows/feeds.yml, which uses --if-changed so the
 * expensive scan runs only when it would actually change something.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getGlobalState, getDistributions, monthlyFromDistributions } from './data/coral-onchain.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, 'distributions.json');
const ifChanged = process.argv.includes('--if-changed');

const gs = await getGlobalState();

if (ifChanged && existsSync(outPath)) {
  try {
    const prev = JSON.parse(readFileSync(outPath, 'utf8'));
    // The count is authoritative and cheap. Totals can be equal across a
    // rebuild, but a new distribution always increments the count.
    if (prev.distributions === gs.distributions) {
      console.log(`No new distributions (still ${gs.distributions}). Skipping the scan.`);
      process.exit(0);
    }
    console.log(`Distributions ${prev.distributions} -> ${gs.distributions}. Rebuilding…`);
  } catch {
    console.log('Existing distributions.json unreadable — rebuilding.');
  }
}

const dists = await getDistributions();
const out = {
  updatedAt: new Date().toISOString(),
  totalDistributed: gs.rewardsDistributed,   // authoritative on-chain total (incl. test txns)
  distributions: gs.distributions,           // on-chain count
  monthly: monthlyFromDistributions(dists),  // real monthly payouts (test txns dropped)
};

// Never publish an empty or shrinking history — a partial scan (rate limit,
// RPC hiccup) must not overwrite good data with worse data.
if (!out.monthly.length) throw new Error('refusing to write: scan produced no monthly data');
if (existsSync(outPath)) {
  const prev = JSON.parse(readFileSync(outPath, 'utf8'));
  if (out.totalDistributed < prev.totalDistributed) {
    throw new Error(`refusing to write: total went down (${prev.totalDistributed} -> ${out.totalDistributed})`);
  }
  if (out.monthly.length < prev.monthly.length) {
    throw new Error(`refusing to write: fewer months than before (${prev.monthly.length} -> ${out.monthly.length})`);
  }
}

writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
