/**
 * KYC Race Ready - main web app (analytics receiver + shared custom races).
 *
 * This REPLACES your current doPost/doGet code (the small analytics script).
 * Keep your separate Reports.gs file as-is. After pasting:
 *   1. Save.
 *   2. Deploy -> Manage deployments -> Edit (pencil) -> Version: New version -> Deploy.
 * The /exec URL stays the same; config.json needs no change.
 *
 *   doPost  -> appends an analytics event to the "events" tab (unchanged behavior).
 *   doGet   -> ?action=list_races  returns saved custom races (JSON)
 *              ?action=save_race&race=...  upserts a custom race
 *              (no action) returns a liveness string.
 */

/* ---------- analytics (events) ---------- */
function doPost(e) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("events")
        || SpreadsheetApp.getActiveSpreadsheet().insertSheet("events");
  var d = {};
  try { d = JSON.parse(e.postData.contents); } catch (err) {}
  sh.appendRow([new Date(), d.clientTime || "", d.deviceId || "", d.event || "", d.detail || "",
                d.courseCode || "", d.sog || "", d.cog || "", d.lat || "", d.lon || "",
                d.browser || "", d.os || "", d.deviceType || "", d.appVersion || "", JSON.stringify(d)]);
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------- shared custom races + liveness ---------- */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === "list_races") return jsonOut_(listRaces_());
  if (p.action === "save_race") {
    try { saveRace_(JSON.parse(p.race), p.by || ""); return jsonOut_({ ok: true }); }
    catch (err) { return jsonOut_({ ok: false, error: String(err) }); }
  }
  return ContentService.createTextOutput("KYC Race Log is live.");
}

function racesSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("races");
  if (!sh) { sh = ss.insertSheet("races"); sh.appendRow(["name", "dataJSON", "savedAt", "savedBy"]); }
  if (sh.getLastRow() === 0) sh.appendRow(["name", "dataJSON", "savedAt", "savedBy"]);
  return sh;
}

function listRaces_() {
  var sh = racesSheet_();
  var rows = sh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) {              // skip header
    if (!rows[i][0]) continue;
    var race = {};
    try { race = JSON.parse(rows[i][1]); } catch (e) { race = { name: rows[i][0] }; }
    race.savedAt = rows[i][2] ? (new Date(rows[i][2])).toISOString() : "";
    out.push(race);
  }
  return out;
}

function saveRace_(race, by) {
  var sh = racesSheet_();
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(8000);
    var rows = sh.getDataRange().getValues();
    var name = String(race.name || "").trim();
    var nameLc = name.toLowerCase();
    var now = new Date();
    for (var i = 1; i < rows.length; i++) {            // upsert by name (case-insensitive)
      if (String(rows[i][0]).trim().toLowerCase() === nameLc) {
        sh.getRange(i + 1, 1, 1, 4).setValues([[name, JSON.stringify(race), now, by]]);
        return;
      }
    }
    sh.appendRow([name, JSON.stringify(race), now, by]);
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
