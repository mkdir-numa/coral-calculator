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

  // Today's figures. These are the fallbacks AND the initial render values.
  var FALLBACK = {
    totalPoolPoints: 21695562.31, // rewards-pool API. Points LOCKED in the pool only,
                               // NOT total network points. This is the denominator.
    grossMonthly: 2705,        // total yield the fund CLAIMS per month (trailing 6-mo actual,
                               // on-chain). Holders get 40% of this -> ~$1,082/mo today.
    capitalDeployed: 288000    // fund / ReFi Hub. Drives the fund slider's "today" anchor.
    // (No irr fallback: the current yield is DERIVED as grossMonthly*12/capitalDeployed,
    //  unless the feed supplies an explicit irr. See buildConfig.)
  };

  // Fixed reference points (not live feeds): slider anchors, split, and protocol rules.
  var CONSTANTS = {
    fullyDeployed: 507000, // honest ceiling once idle cash is deployed
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
  function loadConfig() {
    if (!FEED_URL || typeof fetch === 'undefined') return Promise.resolve(defaultConfig());
    return fetch(FEED_URL)
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; })
      .then(function (json) {
        var live = {};
        ['totalPoolPoints', 'grossMonthly', 'capitalDeployed', 'irr'].forEach(function (k) {
          var v = readField(json, k);
          live[k] = (v != null) ? v : FALLBACK[k];
        });
        return buildConfig(live);
      });
  }

  // Synchronous build from the fallbacks — used for first paint before any fetch.
  function defaultConfig() {
    return buildConfig(FALLBACK);
  }

  function buildConfig(live) {
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
      // fixed
      fullyDeployed: CONSTANTS.fullyDeployed,
      growthCap: CONSTANTS.growthCap,
      lockFee: CONSTANTS.lockFee,
      months: CONSTANTS.months
    };
  }

  var api = {
    FALLBACK: FALLBACK,
    CONSTANTS: CONSTANTS,
    FEED_URL: FEED_URL,
    loadConfig: loadConfig,
    defaultConfig: defaultConfig
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.CoralConfig = api;
  }
})(typeof self !== 'undefined' ? self : this);
