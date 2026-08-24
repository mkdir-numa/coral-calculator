/*
 * Browser-side Coral wallet lookup. Reads a wallet's on-chain points + stakes
 * directly from the RefiHub RPC proxy (returns Access-Control-Allow-Origin: *,
 * so no server needed). Exposes window.CoralWallet.lookup(address).
 *
 * Fields (÷100 for points, ÷1e6 for USDC):
 *   UserAccount: total_points(@40) -> availablePoints (unlocked),
 *                locked_points(@48) -> pointsInPool (locked & earning),
 *                claimed_rewards(@56), available_claim(@64)
 *   StakeEntry:  nft_mint(@40), tier(@72), staked_at(@73), is_locked_in_pool(@89), locked_points(@98)
 */
(function (root) {
  'use strict';
  var RPC = 'https://rpc-proxy.refihub.workers.dev';
  var PID = '6vspTm8HVxArXoZqC3DV8yxdz9pTRtrjc8zCxFzeo5ZD';
  var DISC = { UserAccount: [211, 33, 136, 16, 186, 110, 242, 127], StakeEntry: [187, 127, 9, 35, 155, 68, 86, 40] };
  var TIER = { 0: 'Flexible', 1: 'ThreeMonths', 2: 'TwelveMonths' };
  var LOCK_DAYS = { 0: 0, 1: 90, 2: 365 };
  var B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

  function b58enc(bytes) {
    var n = 0n, i;
    for (i = 0; i < bytes.length; i++) n = n * 256n + BigInt(bytes[i]);
    var s = '';
    while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; }
    for (i = 0; i < bytes.length; i++) { if (bytes[i] === 0) s = '1' + s; else break; }
    return s || '1';
  }
  function b58dec(str) {
    var n = 0n, i, idx;
    for (i = 0; i < str.length; i++) { idx = B58.indexOf(str[i]); if (idx < 0) throw new Error('bad base58'); n = n * 58n + BigInt(idx); }
    var bytes = [];
    while (n > 0n) { bytes.unshift(Number(n % 256n)); n /= 256n; }
    for (i = 0; i < str.length; i++) { if (str[i] === '1') bytes.unshift(0); else break; }
    return Uint8Array.from(bytes);
  }
  function isValid(a) { try { return b58dec(a).length === 32; } catch (e) { return false; } }
  function b64ToBytes(b64) { var bin = atob(b64), u = new Uint8Array(bin.length), i; for (i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  function u64(dv, o) { return Number(dv.getBigUint64(o, true)); }
  function i64(dv, o) { return Number(dv.getBigInt64(o, true)); }

  function rpc(method, params) {
    return fetch(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: method, params: params }) })
      .then(function (r) { if (!r.ok) throw new Error('RPC ' + r.status); return r.json(); })
      .then(function (j) { if (j.error) throw new Error(JSON.stringify(j.error)); return j.result; });
  }
  function gpa(disc, extraFilters) {
    var filters = [{ memcmp: { offset: 0, bytes: b58enc(Uint8Array.from(disc)) } }].concat(extraFilters || []);
    return rpc('getProgramAccounts', [PID, { encoding: 'base64', filters: filters }])
      .then(function (res) { return res.map(function (a) { return b64ToBytes(a.account.data[0]); }); });
  }

  function lookup(address) {
    if (!isValid(address)) return Promise.reject(new Error('invalid address'));
    var owner = [{ memcmp: { offset: 8, bytes: address } }];
    return Promise.all([gpa(DISC.UserAccount, owner), gpa(DISC.StakeEntry, owner)]).then(function (res) {
      var ua = res[0], se = res[1], user = null;
      if (ua[0]) {
        var dv = new DataView(ua[0].buffer);
        user = { availablePoints: u64(dv, 40) / 100, pointsInPool: u64(dv, 48) / 100, claimedRewards: u64(dv, 56) / 1e6, availableClaim: u64(dv, 64) / 1e6 };
      }
      var now = Math.floor(Date.now() / 1000);
      var corals = se.map(function (b) {
        var dv = new DataView(b.buffer), tier = b[72], stakedAt = i64(dv, 73);
        var unstakeAt = stakedAt + LOCK_DAYS[tier] * 86400;
        return { mint: b58enc(b.subarray(40, 72)), tier: TIER[tier], lockedInPool: b[89] === 1, lockedPoints: u64(dv, 98) / 100, daysToUnstake: Math.max(0, Math.ceil((unstakeAt - now) / 86400)) };
      });
      return { address: address, user: user, corals: corals };
    });
  }

  root.CoralWallet = { lookup: lookup, isValid: isValid };
})(window);
