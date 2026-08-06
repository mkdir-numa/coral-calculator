/*
 * Tests for the pure calc module. No framework — run with:  node calc.test.js
 *
 * These pin the calculator to the worked examples in coral-rewards-math.md so the
 * numbers can't silently drift. If a formula changes and these still need to pass,
 * the math doc must change too.
 *
 * Model: the fund claims gross yield (~$2,705/mo today) and splits it 45 / 40 / 15.
 * Holders get the 40% slice -> ~$1,082/mo, which is the distribution the pool pays.
 */
var assert = require('assert');
var Calc = require('./calc.js');
var Config = require('./config.js');

var pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
// Assert |actual - expected| <= tol; the doc quotes rounded figures.
function near(actual, expected, tol, msg) {
  assert.ok(Math.abs(actual - expected) <= tol,
    (msg || '') + ' expected ~' + expected + ', got ' + actual);
}

var cfg = Config.defaultConfig(); // today: 21,557,825 pts, $2,705 gross/mo, $288K, 40/15/45

console.log('coral calculator — worked examples (coral-rewards-math.md)');

test('gross fund yield ~$2,705/mo splits 45/40/15; holders get ~$1,082/mo', function () {
  var r = Calc.computeRewards({ heldPoints: 0, corals: 1, tier: 'y1' }, cfg);
  near(r.grossYieldMonthly, 2705, 0.5, 'gross yield');
  near(r.monthlyDistribution, 1082, 0.5, 'holder distribution (40%)');
  near(r.rhFee, 405.75, 0.5, 'ReFi Hub fee (15%)');
  near(r.compound, 1217.25, 0.5, 'compounded back (45%)');
  // the split must reconstitute the gross exactly
  near(r.monthlyDistribution + r.rhFee + r.compound, r.grossYieldMonthly, 1e-6, 'split sums to gross');
});

test('rate is about $0.50 per 10,000 points per month', function () {
  var r = Calc.computeRewards({ heldPoints: 0, corals: 1, tier: 'y1' }, cfg);
  near(r.ratePer10k, 0.50, 0.01, 'value per 10k points');
});

test('new buyer: 1 Coral staked 12 months -> ~4,900 locked, ~$0.25/mo, ~$3/yr', function () {
  var r = Calc.computeRewards({ heldPoints: 0, corals: 1, tier: 'y1' }, cfg);
  near(r.lockedLater, 4900, 30, 'points locked after fee');   // 5475 * 0.9 = 4927.5
  near(r.monthlyLater, 0.25, 0.01, 'per month once locked');
  near(r.yearlyLater, 3, 0.5, 'per year');
});

test('holder: 100,000 points -> 90,000 locked, ~$4.52/mo, ~$54/yr', function () {
  var r = Calc.computeRewards({ heldPoints: 100000, corals: 1, tier: 'y1' }, cfg);
  near(r.lockedNow, 90000, 0.5, 'points locked after fee');
  near(r.monthlyNow, 4.52, 0.1, 'per month');
  near(r.yearlyNow, 54, 1, 'per year');
});

test('OG: 1,000,000 points -> 900,000 locked, ~$45/mo, ~$542/yr', function () {
  var r = Calc.computeRewards({ heldPoints: 1000000, corals: 1, tier: 'y1' }, cfg);
  near(r.lockedNow, 900000, 0.5, 'points locked after fee');
  near(r.monthlyNow, 45.2, 1, 'per month');
  near(r.yearlyNow, 542, 5, 'per year');
});

console.log('\nformula & behaviour checks');

test('10% lock fee is applied to held points', function () {
  var r = Calc.computeRewards({ heldPoints: 100000, corals: 1, tier: 'y1' }, cfg);
  assert.strictEqual(r.lockedNow, 90000);
});

test('12-month tier earns more per day than the others (rate jumps at 12mo)', function () {
  var flex = Calc.computeRewards({ heldPoints: 0, corals: 1, tier: 'flex' }, cfg);
  var y1 = Calc.computeRewards({ heldPoints: 0, corals: 1, tier: 'y1' }, cfg);
  assert.ok(y1.pointsGained > flex.pointsGained);            // 15/day vs 3/day
});

test('holders always get exactly 40% of the gross yield', function () {
  var r = Calc.computeRewards({ heldPoints: 100000, corals: 1, tier: 'y1', capitalDeployed: 450000 }, cfg);
  near(r.monthlyDistribution, r.grossYieldMonthly * 0.40, 1e-6, 'holder share');
});

test('distribution scales linearly with capital deployed', function () {
  var today = Calc.computeRewards({ heldPoints: 100000, corals: 1, tier: 'y1', capitalDeployed: 288000 }, cfg);
  var doubled = Calc.computeRewards({ heldPoints: 100000, corals: 1, tier: 'y1', capitalDeployed: 576000 }, cfg);
  near(doubled.monthlyNow, today.monthlyNow * 2, 1e-6, 'double capital ~ double monthly');
});

test('fund growth to $1M roughly triples the payout (math doc claim)', function () {
  var today = Calc.computeRewards({ heldPoints: 100000, corals: 1, tier: 'y1', capitalDeployed: 288000 }, cfg);
  var grown = Calc.computeRewards({ heldPoints: 100000, corals: 1, tier: 'y1', capitalDeployed: 1000000 }, cfg);
  near(grown.monthlyNow / today.monthlyNow, 3.47, 0.1, 'ratio'); // 1,000,000 / 288,000
});

test('verdict: near-zero balance -> stake first', function () {
  var r = Calc.computeRewards({ heldPoints: 0, corals: 1, tier: 'y1' }, cfg);
  assert.strictEqual(r.verdict.type, 'stake-first');
});

test('verdict: OG -> lock now', function () {
  var r = Calc.computeRewards({ heldPoints: 1000000, corals: 1, tier: 'y1' }, cfg);
  assert.strictEqual(r.verdict.type, 'lock-now');
});

test('verdict: middle balance -> close call with a crossover month', function () {
  // close call when staking adds more points than you already hold (gained > held)
  var r = Calc.computeRewards({ heldPoints: 10000, corals: 5, tier: 'y1' }, cfg);
  assert.strictEqual(r.verdict.type, 'close-call');
  assert.ok(r.verdict.crossoverMonth > r.stakeMonths, 'crossover after staking ends');
});

test('series: lock-now pays from month 1; stake-lock is zero until staking ends', function () {
  var r = Calc.computeRewards({ heldPoints: 100000, corals: 1, tier: 'y1' }, cfg);
  assert.strictEqual(r.lockNowSeries[0], 0);
  assert.ok(r.lockNowSeries[1] > 0, 'lock now pays in month 1');
  assert.strictEqual(r.stakeLockSeries[r.stakeMonths], 0, 'no cash during staking');
  assert.ok(r.stakeLockSeries[r.stakeMonths + 1] > 0, 'cash begins after staking');
});

test('fallback config equals today\'s published figures', function () {
  assert.strictEqual(cfg.totalPoolPoints, 21557825);
  assert.strictEqual(cfg.baseGrossMonthly, 2705);
  assert.strictEqual(cfg.holderShare, 0.40);
  assert.strictEqual(cfg.rhFeeShare, 0.15);
  assert.strictEqual(cfg.compoundShare, 0.45);
  assert.strictEqual(cfg.baseCap, 288000);
  assert.strictEqual(cfg.irr, 0.14);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
