/*
 * Live-data layer for the Coral Tribe calculator.
 *
 * The four values below are the only ones meant to move with real conditions.
 * Each has a fallback equal to TODAY's figure, so the tool still works exactly
 * as shipped if an endpoint is down, slow, or unreachable (e.g. opened from
 * file://). Nothing here can kill the page — every fetch is wrapped and the
 * fallback is used on any failure.
 *
 * To go live: set the matching URL in ENDPOINTS and have it return JSON whose
 * shape is described next to each one. Until then the fallbacks are authoritative.
 */
(function (root) {
  'use strict';

  // Today's figures. These are the fallbacks AND the initial render values.
  var FALLBACK = {
    totalPoolPoints: 21557825, // rewards-pool API. Points LOCKED in the pool only,
                               // NOT total network points. This is the denominator.
    grossMonthly: 2705,        // total yield the fund CLAIMS per month (trailing 6-mo actual,
                               // on-chain). Holders get 40% of this -> ~$1,082/mo today.
    capitalDeployed: 288000,   // fund / ReFi Hub. Drives the fund slider's "today" anchor.
    irr: 0.14                  // fund reference rate; scales distribution with capital.
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

  // Set these to real URLs when the feeds exist. null = use fallback, no network call.
  // Each endpoint should return JSON; the reader pulls the field named below.
  var ENDPOINTS = {
    totalPoolPoints: null,     // -> { lockedPoints: <number> }
    grossMonthly: null,        // -> { grossMonthly: <number> } total fund yield/mo (pre-split)
    capitalDeployed: null,     // -> { deployed: <number> }
    irr: null                  // -> { irr: <number, e.g. 0.14> }
  };

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

  // Try one endpoint; resolve to its value or null (never reject).
  function fetchOne(key) {
    var url = ENDPOINTS[key];
    if (!url || typeof fetch === 'undefined') return Promise.resolve(null);
    return fetch(url)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (json) { return readField(json, key); })
      .catch(function () { return null; });
  }

  /*
   * loadConfig() -> Promise<config>. Always resolves. Any value that fails to
   * load falls back to TODAY's figure. The resolved object is ready to hand to
   * CoralCalc.computeRewards as its config, plus the slider anchors.
   */
  function loadConfig() {
    var keys = ['totalPoolPoints', 'grossMonthly', 'capitalDeployed', 'irr'];
    return Promise.all(keys.map(fetchOne)).then(function (results) {
      var live = {};
      keys.forEach(function (k, i) {
        live[k] = results[i] != null ? results[i] : FALLBACK[k];
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
      irr: live.irr,
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
    ENDPOINTS: ENDPOINTS,
    loadConfig: loadConfig,
    defaultConfig: defaultConfig
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.CoralConfig = api;
  }
})(typeof self !== 'undefined' ? self : this);
