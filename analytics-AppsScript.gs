/**
 * KYC Race Ready — analytics receiver (Google Apps Script).
 *
 * Paste this into a Google Apps Script project bound to a Google Sheet,
 * deploy it as a Web App ("Execute as: Me", "Who has access: Anyone"),
 * and put the resulting /exec URL into config.json -> "analyticsUrl".
 * See SETUP-analytics.md for click-by-click steps.
 *
 * Each incoming event becomes one row on the "events" tab. New fields the
 * app sends in future are preserved in the "extra" column as JSON, so this
 * script rarely needs changing.
 */

var COLS = [
  "serverTime","clientTime","deviceId","sessionId","event","detail",
  "courseCode","sog","cog","lat","lon","accuracy","distanceNm","maxSog","durationSec",
  "browser","os","deviceType","screen","viewport","dpr","lang","tz","network",
  "standalone","cpu","mem","appVersion","configVersion","extra"
];

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(8000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("events") || ss.insertSheet("events");
    if (sheet.getLastRow() === 0) sheet.appendRow(COLS);

    var data = {};
    try { data = JSON.parse(e.postData.contents); } catch (err) { data = {}; }
    var events = (data && data.events && data.events.length) ? data.events : [data];
    var now = new Date();

    var known = {};
    COLS.forEach(function (c) { known[c] = true; });

    events.forEach(function (ev) {
      // collect any keys the app sent that we don't have a column for
      var extra = ev.extra || {};
      if (typeof extra !== "object") extra = { extra: extra };
      Object.keys(ev).forEach(function (k) { if (!known[k]) extra[k] = ev[k]; });

      var row = COLS.map(function (c) {
        if (c === "serverTime") return now;
        if (c === "extra") return Object.keys(extra).length ? JSON.stringify(extra) : "";
        return (ev[c] === undefined || ev[c] === null) ? "" : ev[c];
      });
      sheet.appendRow(row);
    });

    return ContentService.createTextOutput(JSON.stringify({ ok: true, n: events.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

function doGet() {
  return ContentService.createTextOutput("KYC Race Ready analytics endpoint is live.");
}
