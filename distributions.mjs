/*
 * Reconstructs the on-chain reward-distribution history and writes distributions.json:
 *   { updatedAt, totalDistributed, distributions, monthly:[{month, amount}] }
 *
 * SLOW (scans admin-wallet transactions through the rate-limited proxy) — run
 * offline / on a schedule, not on page load. The distributions only change ~monthly.
 * Run:  node distributions.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getGlobalState, getDistributions, monthlyFromDistributions } from './data/coral-onchain.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const [gs, dists] = [await getGlobalState(), await getDistributions()];
const out = {
  updatedAt: new Date().toISOString(),
  totalDistributed: gs.rewardsDistributed,   // authoritative on-chain total (incl. test txns)
  distributions: gs.distributions,           // on-chain count
  monthly: monthlyFromDistributions(dists),  // real monthly payouts (test txns dropped)
};
writeFileSync(join(here, 'distributions.json'), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
