/*
 * Live-data layer for the Coral Tribe calculator.
 *
 * The four values below are the only ones meant to move with real conditions.
 * Each has a fallback equal to TODAY's figure, so the tool still works exactly
 * as shipped if an endpoint is down, slow, or unreachable (e.g. opened from
 * file://). Nothing here can kill the page — every fetch is wrapped and the
 * fallback is used on any failure.
 *
 * To go live: set FEED_URL to a JSON endpoint (a Google Apps Script web app that
 * reads the finance sheet — see data-feed/README.md). Until then the fallbacks are
 * authoritative.
 */
(function (root) {
  'use strict';

  // Today's figures (13 Nov 2026). These are the fallbacks AND the initial render
  // values; the live sources below replace them within a second.
  var FALLBACK = {
    totalPoolPoints: 24783727.92, // on-chain (stats.json). Points LOCKED in the pool only,
                               // NOT total network points. This is the denominator.
    grossMonthly: 3201,        // total yield the fund CLAIMS per month, worked back from what
                               // members were actually paid: the last three monthly payouts
                               // ($1,301, $1,301, $1,239) average $1,280, which is the 40%.
    capitalDeployed: 288398,   // invested in the energy projects (FITs at face). Drives the
                               // fund slider's "today" anchor and the yield.
    fullyDeployed: 454137      // capitalDeployed + everything not yet in a project (cash and
                               // SOL), from the Members Club's /api/fund. Moves with SOL.
    // (No irr fallback: the current yield is DERIVED as grossMonthly*12/capitalDeployed,
    //  unless the feed supplies an explicit irr. See buildConfig.)
  };

  // Fixed reference points (not live feeds): slider anchors, split, and protocol rules.
  var CONSTANTS = {
    growthCap: 1000000,    // speculative growth anchor
    lockFee: 0.10,         // 10% fee on points at lock
    months: 24,            // comparison horizon
    // Community Fund auto-split on every yield claim: 45 / 40 / 15.
    holderShare: 0.40,     // to holders (the rewards-pool distribution)
    rhFeeShare: 0.15,      // to ReFi Hub OpEx
    compoundShare: 0.45    // compounded back into the fund
  };

  // Single JSON feed for the live values — a Google Apps Script web app that reads
  // the "CalcFeed" tab in the finance sheet (see data-feed/README.md). Empty string
  // = no network call, use the fallbacks above. The feed may return any of these
  // fields; whatever it omits keeps its fallback, so a partial or failed feed can
  // never break the page:
  //   { grossMonthly, capitalDeployed, totalPoolPoints, irr }
  // NOTE: grossMonthly is the total fund yield BEFORE the 45/40/15 split; the
  // calculator applies the 40% holder share itself.
  var FEED_URL = 'https://script.google.com/macros/s/AKfycbyT82AHrGh8Z42ja1o9nGECgTcQM-eMkIhtI2uytTwEw0BtFCVN8H1wmm0aak-gaOxz/exec';

  // The monthly payouts to members (distributions.mjs). The fund's monthly yield is
  // worked back from them: average of the last PAYOUT_MONTHS payouts / holderShare.
  // Real payouts beat the hand-kept sheet figure, so this wins when it loads.
  var DISTRIBUTIONS_URL = 'distributions.json';
  var PAYOUT_MONTHS = 3;

  // The live Community Fund (the same numbers the website and the Members Club show).
  // Everything that is not yet in an energy project (cash ready to deploy + SOL) is
  // what "fully deployed" would add to today's capital.
  var FUND_URL = 'https://members.coraltribe.io/api/fund';

  // Live on-chain aggregates written by the snapshotter (snapshot.mjs). Supplies
  // the true rewards-pool total (GlobalState.total_locked_points) plus the pool
  // stats shown in "Reward Pool details". Missing/failed = fall back to constants.
  var STATS_URL = 'stats.json';

  function readField(json, key) {
    var map = {
      totalPoolPoints: ['lockedPoints', 'totalPoolPoints', 'points'],
      grossMonthly: ['grossMonthly', 'grossYieldMonthly', 'monthly'],
      capitalDeployed: ['deployed', 'capitalDeployed', 'capital'],
      irr: ['irr', 'rate']
    };
    var fields = map[key] || [key];
    for (var i = 0; i < fields.length; i++) {
      var v = json && json[fields[i]];
      if (typeof v === 'number' && isFinite(v)) return v;
    }
    return null;
  }

  /*
   * loadConfig() -> Promise<config>. Always resolves. Fetches the single feed once;
   * any field the feed omits or that fails to load falls back to TODAY's figure.
   * The resolved object is ready to hand to CoralCalc.computeRewards, plus anchors.
   */
  function getJSON(url, opts) {
    if (!url) return Promise.resolve(null);
    return fetch(url, opts || {})
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  // Monthly gross yield from the last few real payouts, or null if there are too
  // few to trust. Payouts are the 40% slice, so divide by the holder share.
  function grossFromPayouts(dist) {
    var months = dist && dist.monthly;
    if (!months || !months.length) return null;
    var recent = months.slice(-PAYOUT_MONTHS).map(function (m) { return Number(m.amount); })
      .filter(function (v) { return isFinite(v) && v > 0; });
    if (recent.length < PAYOUT_MONTHS) return null;
    var avg = recent.reduce(function (a, b) { return a + b; }, 0) / recent.length;
    return avg / CONSTANTS.holderShare;
  }

  // Cash ready to deploy + SOL, from the live fund; null if it looks wrong.
  function undeployedFromFund(fund) {
    var rows = (fund && fund.rows) || [];
    var pick = function (key) {
      for (var i = 0; i < rows.length; i++) if (rows[i].key === key) return Number(rows[i].value);
      return NaN;
    };
    var v = pick('ready') + pick('sol');
    return (isFinite(v) && v >= 0 && v < 1e8) ? v : null;
  }

  function loadConfig() {
    if (typeof fetch === 'undefined') return Promise.resolve(defaultConfig());
    var noStore = { cache: 'no-store' };
    return Promise.all([
      getJSON(FEED_URL),
      getJSON(STATS_URL, noStore),
      getJSON(DISTRIBUTIONS_URL, noStore),
      getJSON(FUND_URL)
    ]).then(function (res) {
      var json = res[0] || {}, stats = res[1] || null, dist = res[2], fund = res[3];
      var live = {};
      ['totalPoolPoints', 'grossMonthly', 'capitalDeployed', 'irr'].forEach(function (k) {
        var v = readField(json, k);
        live[k] = (v != null) ? v : FALLBACK[k];
      });
      // On-chain pool total wins when available (the true denominator).
      if (stats && typeof stats.poolPoints === 'number' && isFinite(stats.poolPoints)) {
        live.totalPoolPoints = stats.poolPoints;
      }
      // What members were actually paid wins over the sheet's yield figure.
      var gross = grossFromPayouts(dist);
      if (gross != null) live.grossMonthly = gross;
      // Fully deployed = today's capital + whatever is not in a project yet.
      var undeployed = undeployedFromFund(fund);
      live.fullyDeployed = (undeployed != null)
        ? live.capitalDeployed + undeployed
        : Math.max(FALLBACK.fullyDeployed, live.capitalDeployed);
      return buildConfig(live, stats);
    });
  }

  // Synchronous build from the fallbacks — used for first paint before any fetch.
  function defaultConfig() {
    return buildConfig(FALLBACK, null);
  }

  function buildConfig(live, stats) {
    return {
      // live (with fallbacks applied)
      totalPoolPoints: live.totalPoolPoints,
      grossMonthly: live.grossMonthly,
      capitalDeployed: live.capitalDeployed,
      // Current yield, derived live from the sheet figures (annualised): a feed
      // may override it by supplying `irr` directly.
      irr: (live.irr != null) ? live.irr : (live.grossMonthly * 12 / live.capitalDeployed),
      // mapped to the calc module's expected names
      baseCap: live.capitalDeployed,          // today's capital anchors the slider
      baseGrossMonthly: live.grossMonthly,    // gross fund yield at today's capital
      // the 45 / 40 / 15 split
      holderShare: CONSTANTS.holderShare,
      rhFeeShare: CONSTANTS.rhFeeShare,
      compoundShare: CONSTANTS.compoundShare,
      fullyDeployed: live.fullyDeployed,
      // fixed
      growthCap: CONSTANTS.growthCap,
      lockFee: CONSTANTS.lockFee,
      months: CONSTANTS.months,
      // live on-chain pool stats (null until stats.json loads)
      stats: stats || null
    };
  }

  var api = {
    FALLBACK: FALLBACK,
    CONSTANTS: CONSTANTS,
    FEED_URL: FEED_URL,
    grossFromPayouts: grossFromPayouts,
    undeployedFromFund: undeployedFromFund,
    loadConfig: loadConfig,
    defaultConfig: defaultConfig
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.CoralConfig = api;
  }
})(typeof self !== 'undefined' ? self : this);
