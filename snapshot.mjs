/*
 * Snapshotter — reads the live on-chain points aggregates and writes:
 *   stats.json    latest snapshot (the calculator + stats page read this)
 *   history.json  appended time-series (one trimmed record per run) for charts
 *
 * Run:  node snapshot.mjs
 * Scheduled by .github/workflows/snapshot.yml (commits both files on a cron).
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getStats } from './data/coral-onchain.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const stats = await getStats();
writeFileSync(join(here, 'stats.json'), JSON.stringify(stats, null, 2) + '\n');

const rec = {
  t: stats.updatedAt,
  pool: stats.poolPoints,
  circ: stats.circulation,
  dist: stats.rewardsDistributed,
  distN: stats.distributions,
  staked: stats.stakedTotal,
  emis: stats.emissionPerDay,
  holders: stats.holders,
};
const hp = join(here, 'history.json');
let hist = [];
if (existsSync(hp)) { try { hist = JSON.parse(readFileSync(hp, 'utf8')); } catch {} }
hist.push(rec);
writeFileSync(hp, JSON.stringify(hist) + '\n');

console.log(JSON.stringify(stats, null, 2));
console.log(`history: ${hist.length} records`);
