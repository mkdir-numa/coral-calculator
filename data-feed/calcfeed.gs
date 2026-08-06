/**
 * Coral Tribe calculator — live data feed (Google Apps Script web app).
 *
 * Serves ONLY the calculator's aggregate numbers as JSON, read from a small
 * "CalcFeed" tab. The rest of the workbook is never exposed.
 *
 * CalcFeed tab layout — column A = key, column B = value (a header row is fine,
 * non-numeric values are ignored):
 *
 *   | key             | value                                                   |
 *   | grossMonthly    | total monthly fund yield, BEFORE the 45/40/15 split (~2705) |
 *   | capitalDeployed | current FITs value deployed (~288000)                    |
 *   | totalPoolPoints | (optional) points locked in the rewards pool            |
 *   | irr             | (optional) reference yield, e.g. 0.14                    |
 *
 * IMPORTANT: grossMonthly is the FULL yield the fund claims (the "Total CF Share"),
 * not the holder amount — the calculator applies the 40% holder split itself.
 *
 * Deploy:
 *   1. In the sheet that will hold CalcFeed: Extensions > Apps Script.
 *   2. Paste this file. Set FEED_SHEET_ID below to that sheet's id.
 *   3. Deploy > New deployment > type "Web app".
 *      Execute as: Me.   Who has access: Anyone.
 *   4. Authorize, then copy the Web app URL (ends in /exec) and send it over.
 */

var FEED_SHEET_ID = '1q1tpXFh5KbmEJomrElrx9pAG6SHHkoVo8ktcWN_wex0'; // sheet holding the CalcFeed tab
var FEED_TAB = 'CalcFeed';

function doGet() {
  var out = {};
  try {
    var sh = SpreadsheetApp.openById(FEED_SHEET_ID).getSheetByName(FEED_TAB);
    var rows = sh.getRange(1, 1, sh.getLastRow(), 2).getValues();
    rows.forEach(function (r) {
      var key = String(r[0]).trim();
      var val = Number(r[1]);
      if (key && r[1] !== '' && r[1] !== null && isFinite(val)) out[key] = val;
    });
  } catch (err) {
    out = { error: String(err) };
  }
  return ContentService
    .createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}
