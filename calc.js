/*
 * Coral Tribe rewards — pure math module.
 *
 * One idea: cash = (your locked points / total pool points) x holder distribution.
 * Points are the unit of account; a Coral only matters because it produces points.
 *
 * Where the holder distribution comes from: the Community Fund claims yield from
 * its investments, then auto-splits every claim 45 / 40 / 15 —
 *   45% compounds back into the fund, 40% goes to holders, 15% to ReFi Hub OpEx.
 * The 40% slice is the rewards-pool distribution this calculator pays out.
 *
 * This file has NO UI and NO I/O. It takes inputs + config and returns numbers,
 * so the same code runs in the browser and under `node calc.test.js`. The HTML
 * page and the tests both import this, so the numbers can't silently drift.
 *
 * Worked examples it must reproduce (see coral-rewards-math.md):
 *   gross fund yield ~= $2,705/mo -> 40% = ~$1,082/mo to holders today
 *   rate ~= $0.50 per 10,000 points / month
 *   new buyer (0 held, 1 coral, 12-mo): ~4,900 locked, ~$0.25/mo, ~$3/yr
 *   holder (100,000 held):              90,000 locked, ~$4.52/mo, ~$54/yr
 *   OG (1,000,000 held):                900,000 locked, ~$45/mo,  ~$542/yr
 */
(function (root) {
  'use strict';

  // Staking tiers. rate = points per day per Coral; days = staking length;
  // months = how long cash is delayed before the stake-then-lock path pays.
  // The protocol offers three tiers: Flexible, 3-month, 12-month.
  var TIERS = {
    flex: { ppd: 3,  days: 365, months: 12, label: 'flexibly' },
    m3:   { ppd: 9,  days: 90,  months: 3,  label: '3 months' },
    y1:   { ppd: 15, days: 365, months: 12, label: '12 months' }
  };

  var DEFAULT_CONFIG = {
    totalPoolPoints: 21695562.31, // denominator: points LOCKED in the pool, not network total
    baseGrossMonthly: 2705,    // total yield the fund claims per month at baseCap (trailing 6-mo actual)
    holderShare: 0.40,         // 40% of each claim is distributed to holders
    rhFeeShare: 0.15,          // 15% to ReFi Hub OpEx
    compoundShare: 0.45,       // 45% compounds back into the fund
    baseCap: 288000,           // capital deployed today; anchors the fund slider
    fullyDeployed: 507000,     // idle cash put to work; honest ceiling before "growth"
    irr: 0.14,                 // display-only fallback; the app derives current yield live (config.js)
    lockFee: 0.10,             // 10% taken off points at lock
    months: 24                 // comparison horizon for the chart and totals
  };

  // Gross yield the fund claims per month, scaling linearly with capital deployed:
  //   grossYieldMonthly = baseGrossMonthly x (capitalDeployed / baseCap)
  function grossYieldMonthlyFor(capitalDeployed, cfg) {
    return cfg.baseGrossMonthly * (capitalDeployed / cfg.baseCap);
  }

  // The holder distribution is the 40% slice of the gross yield. This is the
  // monthly distribution the rewards pool actually pays out.
  function monthlyDistributionFor(capitalDeployed, cfg) {
    return grossYieldMonthlyFor(capitalDeployed, cfg) * cfg.holderShare;
  }

  // $ per point per month. Goes up as the fund pays more, down as the pool grows.
  function rateFor(capitalDeployed, cfg) {
    return monthlyDistributionFor(capitalDeployed, cfg) / cfg.totalPoolPoints;
  }

  /*
   * computeRewards(inputs, config) -> derived numbers, no formatting.
   *
   * inputs:
   *   heldPoints      points you already hold
   *   corals          number of Corals you'd stake
   *   tier            'flex' | 'm3' | 'm6' | 'y1'
   *   capitalDeployed live fund value from the slider (defaults to baseCap)
   */
  function computeRewards(inputs, config) {
    var cfg = Object.assign({}, DEFAULT_CONFIG, config || {});
    var tier = TIERS[inputs && inputs.tier] || TIERS.y1;

    var heldPoints = Math.max(0, num(inputs && inputs.heldPoints, 0));
    var corals = Math.max(1, num(inputs && inputs.corals, 1));
    var capitalDeployed = num(inputs && inputs.capitalDeployed, cfg.baseCap);

    // Gross fund yield, then the 45 / 40 / 15 split. The 40% holder slice is the
    // distribution the pool pays; the other two are surfaced for transparency.
    var grossYieldMonthly = grossYieldMonthlyFor(capitalDeployed, cfg);
    var monthlyDistribution = grossYieldMonthly * cfg.holderShare;   // to holders (40%)
    var rhFee = grossYieldMonthly * cfg.rhFeeShare;                  // ReFi Hub (15%)
    var compound = grossYieldMonthly * cfg.compoundShare;            // back to fund (45%)
    var rate = monthlyDistribution / cfg.totalPoolPoints;
    var keep = 1 - cfg.lockFee;

    // Lock now: lock the points you already hold.
    var lockedNow = heldPoints * keep;
    var monthlyNow = lockedNow * rate;

    // Stake then lock: accumulate, then lock. Cash starts only after the staking period.
    var gained = corals * tier.ppd * tier.days;
    var lockedLater = (heldPoints + gained) * keep;
    var monthlyLater = lockedLater * rate;
    var stakeMonths = tier.months;

    // 24-month comparison series (drives the chart and the comparison totals).
    var months = cfg.months;
    var lockNowSeries = [];
    var stakeLockSeries = [];
    for (var m = 0; m <= months; m++) {
      lockNowSeries.push(monthlyNow * m);
      stakeLockSeries.push(m <= stakeMonths ? 0 : monthlyLater * (m - stakeMonths));
    }
    var totalNow = monthlyNow * months;
    var totalLater = monthlyLater * (months - stakeMonths);

    // Month where the stake-then-lock line overtakes the lock-now line. Exists
    // whenever the later monthly is higher (staking added points). Surfaced so the
    // UI can always tell you "staking overtakes locking around month N", even when
    // locking still wins over the 24-month horizon. null if staking never catches up.
    var crossoverMonth = (monthlyLater > monthlyNow)
      ? stakeMonths + (monthlyNow * stakeMonths) / (monthlyLater - monthlyNow)
      : null;

    return {
      // shared
      monthlyDistribution: monthlyDistribution, // holder distribution (40% of gross)
      grossYieldMonthly: grossYieldMonthly,     // total yield the fund claims
      rhFee: rhFee,                             // 15% to ReFi Hub OpEx
      compound: compound,                       // 45% compounded back into the fund
      holderShare: cfg.holderShare,
      rate: rate,
      ratePer10k: rate * 10000,
      capitalDeployed: capitalDeployed,
      idleCapital: Math.max(0, cfg.fullyDeployed - capitalDeployed),
      tierLabel: tier.label,
      stakeMonths: stakeMonths,
      months: months,
      // lock now
      lockedNow: lockedNow,
      monthlyNow: monthlyNow,
      yearlyNow: monthlyNow * 12,
      totalNow: totalNow,
      // stake then lock
      pointsGained: gained,
      lockedLater: lockedLater,
      monthlyLater: monthlyLater,
      yearlyLater: monthlyLater * 12,
      totalLater: totalLater,
      crossoverMonth: crossoverMonth,
      // series
      lockNowSeries: lockNowSeries,
      stakeLockSeries: stakeLockSeries,
      // decision
      verdict: verdictFor(heldPoints, gained, monthlyNow, monthlyLater, totalNow, totalLater, stakeMonths, tier.label)
    };
  }

  /*
   * Adaptive verdict: low balance -> stake first; high balance -> lock now;
   * middle -> close call with the crossover month where staking overtakes locking.
   * Returns structured data; the UI builds the sentence so copy stays in one place.
   */
  function verdictFor(heldPoints, gained, monthlyNow, monthlyLater, totalNow, totalLater, stakeMonths, tierLabel) {
    if (heldPoints < 1000) {
      return { type: 'stake-first', tierLabel: tierLabel };
    }
    if (totalNow >= totalLater) {
      var addedPct = heldPoints > 0 ? (gained / heldPoints) * 100 : Infinity;
      return { type: 'lock-now', tierLabel: tierLabel, addedPct: addedPct };
    }
    // Crossover: lock-now line started at month 0; stake-lock line starts at stakeMonths.
    // They meet where monthlyNow*m == monthlyLater*(m - stakeMonths).
    var crossover = stakeMonths + (monthlyNow * stakeMonths) / (monthlyLater - monthlyNow);
    return { type: 'close-call', tierLabel: tierLabel, crossoverMonth: crossover };
  }

  function num(v, fallback) {
    var n = parseFloat(v);
    return isFinite(n) ? n : fallback;
  }

  var api = {
    TIERS: TIERS,
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    computeRewards: computeRewards,
    grossYieldMonthlyFor: grossYieldMonthlyFor,
    monthlyDistributionFor: monthlyDistributionFor,
    rateFor: rateFor
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;          // Node (tests)
  } else {
    root.CoralCalc = api;          // browser global
  }
})(typeof self !== 'undefined' ? self : this);
