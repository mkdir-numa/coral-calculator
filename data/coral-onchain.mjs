/*
 * Coral Tribe — on-chain points data layer.
 *
 * Reads the Coral staking program's accounts directly from Solana and returns
 * clean, human-scaled numbers. Runs server-side (snapshotter, serverless funcs)
 * where it sets an Origin header for the RefiHub RPC proxy — no CORS in Node.
 *
 * Program:   6vspTm8HVxArXoZqC3DV8yxdz9pTRtrjc8zCxFzeo5ZD  (Anchor; IDL on-chain)
 * Accounts:  GlobalState (1), StakeEntry (per staked coral), NftPoints (per
 *            coral), UserAccount (per wallet). See ../data/coral.json (IDL).
 * Decimals:  points are stored ×100 (raw ÷100); USDC rewards ×1e6 (raw ÷1e6).
 */

export const PROGRAM_ID = '6vspTm8HVxArXoZqC3DV8yxdz9pTRtrjc8zCxFzeo5ZD';
export const RPC = 'https://rpc-proxy.refihub.workers.dev';
const ORIGIN = 'https://www.coraltribe.io'; // proxy is origin-gated

const DISC = {
  GlobalState: [163, 46, 74, 168, 216, 123, 133, 98],
  NftPoints:   [130, 189, 133, 77, 82, 52, 97, 229],
  StakeEntry:  [187, 127, 9, 35, 155, 68, 86, 40],
  UserAccount: [211, 33, 136, 16, 186, 110, 242, 127],
};
const TIER = { 0: 'Flexible', 1: 'ThreeMonths', 2: 'TwelveMonths' };
const PPD = { 0: 3, 1: 9, 2: 15 };           // points/day per tier (canonical)
const LOCK_DAYS = { 0: 0, 1: 90, 2: 365 };   // stake lock durations
const POINTS = 100, USDC = 1e6;

// --- base58 ---------------------------------------------------------------
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58encode(bytes) {
  let n = 0n; for (const b of bytes) n = n * 256n + BigInt(b);
  let s = ''; while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; }
  for (const b of bytes) { if (b === 0) s = '1' + s; else break; }
  return s || '1';
}
function b58decode(str) {
  let n = 0n; for (const c of str) { const i = B58.indexOf(c); if (i < 0) throw new Error('bad base58'); n = n * 58n + BigInt(i); }
  const bytes = []; while (n > 0n) { bytes.unshift(Number(n % 256n)); n /= 256n; }
  for (const c of str) { if (c === '1') bytes.unshift(0); else break; }
  return Uint8Array.from(bytes);
}
export function isValidAddress(a) {
  try { return b58decode(a).length === 32; } catch { return false; }
}

// --- rpc ------------------------------------------------------------------
async function rpc(method, params) {
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': ORIGIN, 'Referer': ORIGIN + '/' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!r.ok) throw new Error('RPC HTTP ' + r.status);
  const j = await r.json();
  if (j.error) throw new Error('RPC error ' + JSON.stringify(j.error));
  return j.result;
}
async function accountsByType(name, dataSlice, extraFilters = []) {
  const filters = [{ memcmp: { offset: 0, bytes: b58encode(DISC[name]) } }, ...extraFilters];
  const cfg = { encoding: 'base64', filters };
  if (dataSlice) cfg.dataSlice = dataSlice;
  const res = await rpc('getProgramAccounts', [PROGRAM_ID, cfg]);
  return res.map((a) => ({ pubkey: a.pubkey, data: Buffer.from(a.account.data[0], 'base64') }));
}
const u64 = (d, o) => Number(d.readBigUInt64LE(o));
const i64 = (d, o) => Number(d.readBigInt64LE(o));

// --- reads ----------------------------------------------------------------
export async function getGlobalState() {
  const accs = await accountsByType('GlobalState');
  const d = accs[0].data;
  let o = 8 + 1 + 32 + 32;            // disc + is_initialized + admin + verified_collection
  o += d[o] === 1 ? 33 : 1;          // old_points_program: Option<pubkey>
  return {
    poolPoints: u64(d, o) / POINTS,
    rewardsDistributed: u64(d, o + 8) / USDC,
    distributions: u64(d, o + 16),
  };
}

export async function getStakeAggregates() {
  // tier @72 (1), is_locked_in_pool @89 (1). Slice [72,90) -> 18 bytes.
  const accs = await accountsByType('StakeEntry', { offset: 72, length: 18 });
  const perTier = { Flexible: 0, ThreeMonths: 0, TwelveMonths: 0 };
  let lockedInPool = 0, emissionPerDay = 0;
  for (const a of accs) {
    const t = a.data[0];
    perTier[TIER[t]]++;
    emissionPerDay += PPD[t];
    if (a.data[17] === 1) lockedInPool++;
  }
  return { stakedTotal: accs.length, perTier, lockedInPool, emissionPerDay };
}

export async function getCirculation() {
  // accumulated_points @40 (u64)
  const accs = await accountsByType('NftPoints', { offset: 40, length: 8 });
  let sum = 0n;
  for (const a of accs) sum += a.data.readBigUInt64LE(0);
  return { circulation: Number(sum) / POINTS, coralsWithPoints: accs.length };
}

export async function getHolders() {
  const accs = await accountsByType('UserAccount', { offset: 8, length: 1 });
  return { holders: accs.length };
}

// Everything the snapshotter needs, in parallel.
export async function getStats() {
  const [gs, st, ci, ho] = await Promise.all([
    getGlobalState(), getStakeAggregates(), getCirculation(), getHolders(),
  ]);
  return {
    updatedAt: new Date().toISOString(),
    poolPoints: gs.poolPoints,
    circulation: ci.circulation,
    pctLocked: ci.circulation ? +(gs.poolPoints / ci.circulation * 100).toFixed(1) : null,
    rewardsDistributed: gs.rewardsDistributed,
    distributions: gs.distributions,
    stakedTotal: st.stakedTotal,
    perTier: st.perTier,
    lockedInPool: st.lockedInPool,
    emissionPerDay: st.emissionPerDay,
    holders: ho.holders,
    coralsWithPoints: ci.coralsWithPoints,
  };
}

// Per-wallet lookup (for "My Coral").
export async function getWallet(address) {
  if (!isValidAddress(address)) throw new Error('invalid address');
  const [ua, se] = await Promise.all([
    accountsByType('UserAccount', null, [{ memcmp: { offset: 8, bytes: address } }]),
    accountsByType('StakeEntry', null, [{ memcmp: { offset: 8, bytes: address } }]),
  ]);
  let user = null;
  if (ua[0]) {
    const d = ua[0].data;
    user = {
      totalPoints: u64(d, 40) / POINTS,
      lockedPoints: u64(d, 48) / POINTS,
      claimedRewards: u64(d, 56) / USDC,
      availableClaim: u64(d, 64) / USDC,
    };
  }
  const now = Math.floor(Date.now() / 1000);
  const corals = se.map((a) => {
    const d = a.data;
    const tier = d[72];
    const stakedAt = i64(d, 73);
    const unstakeAt = stakedAt + LOCK_DAYS[tier] * 86400;
    return {
      mint: b58encode(d.subarray(40, 72)),
      tier: TIER[tier],
      lockedInPool: d[89] === 1,
      lockedPoints: u64(d, 98) / POINTS,
      daysToUnstake: Math.max(0, Math.ceil((unstakeAt - now) / 86400)),
    };
  });
  return { address, user, corals };
}
