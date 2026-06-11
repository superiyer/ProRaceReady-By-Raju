/**
 * KYC Race Ready — reporting / stats.
 *
 * Add this to the SAME Apps Script project as your doPost (paste it below the
 * doPost code, or use the + to add a new script file and paste it there), then
 * Save. Reload the spreadsheet once; a "📊 KYC Reports" menu appears. Click
 * "Refresh reports" to (re)build the summary tabs. No deployment needed.
 *
 * It reads the "events" tab (the live log) and writes/refreshes these tabs:
 *   Dashboard  — headline totals
 *   By User    — one row per unique device (first/last used, time used, etc.)
 *   By Day     — daily sessions / users / distance
 *   Courses    — which courses get picked, by how many users
 *   Devices    — browser / OS / device-type breakdown
 *
 * Works with the current logging schema (15 columns, last column = full JSON).
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("📊 KYC Reports")
    .addItem("Refresh reports", "buildReports")
    .addToUi();
}

function buildReports() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var src = ss.getSheetByName("events");
  if (!src || src.getLastRow() === 0) { ss.toast("No data in 'events' yet.", "KYC Reports", 5); return; }

  var tz = ss.getSpreadsheetTimeZone();
  var rows = src.getDataRange().getValues();

  var events = [];
  for (var i = 0; i < rows.length; i++) {
    var ev = rowToEvent_(rows[i]);
    if (ev && ev.event && ev.event !== "event") events.push(ev);
  }
  if (!events.length) { ss.toast("No usable events found.", "KYC Reports", 5); return; }

  // ---- aggregate ----
  var users = {};          // deviceId -> stats
  var sessions = {};       // deviceId|sessionId -> {dev, min, max}
  var days = {};           // yyyy-mm-dd -> {events, sessSet, userSet, gps, dist}
  var courses = {};        // courseCode -> {count, userSet}
  var firstDate = null, lastDate = null;
  var codePass = 0, codeFail = 0, standaloneYes = 0, standaloneNo = 0;
  var distTotal = 0, waterTotal = 0, gpsTotal = 0, maxSogGlobal = 0;

  for (var j = 0; j < events.length; j++) {
    var e = events[j];
    var t = e._time;
    var dev = e.deviceId || "(unknown)";

    if (t) {
      if (!firstDate || t < firstDate) firstDate = t;
      if (!lastDate || t > lastDate) lastDate = t;
    }

    var u = users[dev] || (users[dev] = {
      dev: dev, first: null, last: null, dates: {}, events: 0, sessions: {},
      deviceType: "", browser: "", os: "", appVersion: "", codeVersion: "",
      gps: 0, dist: 0, maxSog: 0, water: 0, courses: {}
    });
    u.events++;
    if (t) {
      if (!u.first || t < u.first) u.first = t;
      if (!u.last || t > u.last) u.last = t;
      u.dates[fmtDate_(t, tz)] = 1;
    }
    if (e.deviceType) u.deviceType = e.deviceType;
    if (e.browser) u.browser = e.browser;
    if (e.os) u.os = e.os;
    if (e.appVersion) u.appVersion = e.appVersion;
    if (e.configVersion) u.codeVersion = e.configVersion;

    // sessions (by sessionId)
    var sid = e.sessionId || "na";
    var skey = dev + "|" + sid;
    u.sessions[sid] = 1;
    var sObj = sessions[skey] || (sessions[skey] = { dev: dev, min: t, max: t });
    if (t) { if (!sObj.min || t < sObj.min) sObj.min = t; if (!sObj.max || t > sObj.max) sObj.max = t; }

    // per-day
    if (t) {
      var dkey = fmtDate_(t, tz);
      var d = days[dkey] || (days[dkey] = { events: 0, sess: {}, users: {}, gps: 0, dist: 0 });
      d.events++; d.sess[skey] = 1; d.users[dev] = 1;
    }

    // event-specific
    if (e.event === "code_attempt") { if (e.detail === "pass") codePass++; else if (e.detail === "fail") codeFail++; }
    if (e.event === "app_open") { if (e.standalone === true || e.standalone === "true") standaloneYes++; else standaloneNo++; }
    if (e.event === "course_select" && e.courseCode) {
      var c = courses[e.courseCode] || (courses[e.courseCode] = { count: 0, users: {} });
      c.count++; c.users[dev] = 1;
      u.courses[e.courseCode] = 1;
    }
    if (e.event === "gps_session") {
      gpsTotal++; u.gps++;
      var dist = parseFloat(e.distanceNm) || 0, water = parseFloat(e.durationSec) || 0, ms = parseFloat(e.maxSog) || 0;
      distTotal += dist; waterTotal += water; u.dist += dist; u.water += water;
      if (ms > u.maxSog) u.maxSog = ms;
      if (ms > maxSogGlobal) maxSogGlobal = ms;
      if (t) days[fmtDate_(t, tz)].gps++, days[fmtDate_(t, tz)].dist += dist;
    }
  }

  // app-time per session (span of events within a session)
  var appTimeTotal = 0;
  for (var sk in sessions) {
    var s = sessions[sk];
    var span = (s.min && s.max) ? Math.round((s.max - s.min) / 1000) : 0;
    appTimeTotal += span;
    if (users[s.dev]) users[s.dev].appTime = (users[s.dev].appTime || 0) + span;
  }

  var uniqueUsers = Object.keys(users).length;
  var totalSessions = Object.keys(sessions).length;
  var now = new Date();
  var weekAgo = new Date(now.getTime() - 7 * 86400000);
  var sessions7 = 0, users7 = {};
  for (var sk2 in sessions) { if (sessions[sk2].max && sessions[sk2].max >= weekAgo) { sessions7++; users7[sessions[sk2].dev] = 1; } }
  var sessionsToday = 0; var todayStr = fmtDate_(now, tz);
  for (var sk3 in sessions) { if (sessions[sk3].max && fmtDate_(sessions[sk3].max, tz) === todayStr) sessionsToday++; }

  // top course
  var topCourse = "", topN = 0;
  for (var cc in courses) if (courses[cc].count > topN) { topN = courses[cc].count; topCourse = cc; }

  // ---- write Dashboard ----
  var dash = [
    ["Report generated", fmtDateTime_(now, tz)],
    ["Data range", (firstDate ? fmtDate_(firstDate, tz) : "?") + "  to  " + (lastDate ? fmtDate_(lastDate, tz) : "?")],
    ["Last activity", lastDate ? fmtDateTime_(lastDate, tz) : "?"],
    ["", ""],
    ["Unique users (devices)", uniqueUsers],
    ["Active users (last 7 days)", Object.keys(users7).length],
    ["Total sessions", totalSessions],
    ["Sessions today", sessionsToday],
    ["Sessions (last 7 days)", sessions7],
    ["Total events logged", events.length],
    ["Approx. total app time", fmtDur_(appTimeTotal)],
    ["", ""],
    ["GPS sessions", gpsTotal],
    ["Total distance logged (nm)", round_(distTotal, 1)],
    ["Total time on water", fmtDur_(waterTotal)],
    ["Max SOG observed (kt)", round_(maxSogGlobal, 1)],
    ["", ""],
    ["Most-picked course", topCourse ? (topCourse + " (" + topN + "x)") : "—"],
    ["Code entries — pass / fail", codePass + " / " + codeFail],
    ["Opened as installed app / browser", standaloneYes + " / " + standaloneNo]
  ];
  writeKV_(ss, "Dashboard", dash);

  // ---- By User ----
  var uHead = ["Device ID", "First used", "Last used", "Days active", "Sessions", "App time",
    "Events", "Device", "Browser", "OS", "GPS sessions", "Distance (nm)", "Time on water",
    "Max SOG (kt)", "Courses used", "App ver", "Code ver"];
  var uRows = [];
  var uKeys = Object.keys(users).sort(function (a, b) { return (users[b].last || 0) - (users[a].last || 0); });
  for (var k = 0; k < uKeys.length; k++) {
    var uu = users[uKeys[k]];
    uRows.push([
      uu.dev,
      uu.first ? fmtDateTime_(uu.first, tz) : "",
      uu.last ? fmtDateTime_(uu.last, tz) : "",
      Object.keys(uu.dates).length,
      Object.keys(uu.sessions).length,
      fmtDur_(uu.appTime || 0),
      uu.events,
      uu.deviceType, uu.browser, uu.os,
      uu.gps, round_(uu.dist, 1), fmtDur_(uu.water), round_(uu.maxSog, 1),
      Object.keys(uu.courses).join(", "),
      uu.appVersion, uu.codeVersion
    ]);
  }
  writeTable_(ss, "By User", uHead, uRows);

  // ---- By Day ----
  var dHead = ["Date", "Sessions", "Unique users", "Events", "GPS sessions", "Distance (nm)"];
  var dRows = [];
  var dKeys = Object.keys(days).sort();
  for (var di = 0; di < dKeys.length; di++) {
    var dd = days[dKeys[di]];
    dRows.push([dKeys[di], Object.keys(dd.sess).length, Object.keys(dd.users).length, dd.events, dd.gps, round_(dd.dist, 1)]);
  }
  writeTable_(ss, "By Day", dHead, dRows);

  // ---- Courses ----
  var cHead = ["Course", "Times picked", "Unique users"];
  var cRows = [];
  var cKeys = Object.keys(courses).sort(function (a, b) { return courses[b].count - courses[a].count; });
  for (var ci = 0; ci < cKeys.length; ci++) cRows.push([cKeys[ci], courses[cKeys[ci]].count, Object.keys(courses[cKeys[ci]].users).length]);
  writeTable_(ss, "Courses", cHead, cRows);

  // ---- Devices (unique devices per category) ----
  var byType = {}, byBrowser = {}, byOS = {};
  for (var dk in users) {
    inc_(byType, users[dk].deviceType || "?");
    inc_(byBrowser, users[dk].browser || "?");
    inc_(byOS, users[dk].os || "?");
  }
  var devRows = [];
  devRows.push(["— Device type —", ""]); pushCounts_(devRows, byType);
  devRows.push(["", ""]); devRows.push(["— Browser —", ""]); pushCounts_(devRows, byBrowser);
  devRows.push(["", ""]); devRows.push(["— OS —", ""]); pushCounts_(devRows, byOS);
  writeTable_(ss, "Devices", ["Category", "Unique users"], devRows);

  buildCharts_(ss);

  ss.toast("Reports refreshed — " + events.length + " events, " + uniqueUsers + " users.", "📊 KYC Reports", 6);
}

/* Embed charts on the Dashboard tab (rebuilt each refresh). */
function buildCharts_(ss) {
  var dash = ss.getSheetByName("Dashboard");
  if (!dash) return;
  var existing = dash.getCharts();
  for (var i = 0; i < existing.length; i++) dash.removeChart(existing[i]);

  // Sessions & unique users per day (column chart) — from "By Day" cols Date, Sessions, Unique users
  var byDay = ss.getSheetByName("By Day");
  if (byDay && byDay.getLastRow() >= 2) {
    var rng = byDay.getRange(1, 1, byDay.getLastRow(), 3);
    var ch1 = dash.newChart().asColumnChart()
      .addRange(rng).setNumHeaders(1)
      .setOption("title", "Sessions & unique users per day")
      .setOption("legend", { position: "bottom" })
      .setOption("colors", ["#0b4fb3", "#0a6e3a"])
      .setOption("width", 540).setOption("height", 300)
      .setPosition(2, 4, 12, 0)
      .build();
    dash.insertChart(ch1);
  }

  // Course popularity (bar chart) — from "Courses" cols Course, Times picked
  var crs = ss.getSheetByName("Courses");
  if (crs && crs.getLastRow() >= 2) {
    var rng2 = crs.getRange(1, 1, crs.getLastRow(), 2);
    var ch2 = dash.newChart().asBarChart()
      .addRange(rng2).setNumHeaders(1)
      .setOption("title", "Course popularity (times picked)")
      .setOption("legend", { position: "none" })
      .setOption("colors", ["#0b4fb3"])
      .setOption("width", 540).setOption("height", 320)
      .setPosition(19, 4, 12, 0)
      .build();
    dash.insertChart(ch2);
  }
}

/* ---------- helpers ---------- */

function rowToEvent_(row) {
  var ev = null;
  var last = row[row.length - 1];
  if (typeof last === "string" && last.charAt(0) === "{") { try { ev = JSON.parse(last); } catch (e) {} }
  if (!ev) {
    ev = {
      deviceId: row[2], event: row[3], detail: row[4], courseCode: row[5],
      sog: row[6], cog: row[7], lat: row[8], lon: row[9],
      browser: row[10], os: row[11], deviceType: row[12], appVersion: row[13]
    };
  }
  ev._time = (row[0] instanceof Date) ? row[0] : (ev.clientTime ? new Date(ev.clientTime) : null);
  return ev;
}

function inc_(obj, key) { obj[key] = (obj[key] || 0) + 1; }
function pushCounts_(rows, obj) {
  var keys = Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a]; });
  for (var i = 0; i < keys.length; i++) rows.push([keys[i], obj[keys[i]]]);
}
function round_(n, dp) { var f = Math.pow(10, dp); return Math.round((n || 0) * f) / f; }
function fmtDate_(d, tz) { return Utilities.formatDate(d, tz, "yyyy-MM-dd"); }
function fmtDateTime_(d, tz) { return Utilities.formatDate(d, tz, "yyyy-MM-dd HH:mm"); }
function fmtDur_(sec) {
  sec = Math.round(sec || 0);
  if (sec < 60) return sec + "s";
  var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h ? (h + "h " + m + "m") : (m + "m");
}

function writeTable_(ss, name, header, rows) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clear();
  var out = [header].concat(rows.length ? rows : [header.map(function () { return ""; })]);
  sh.getRange(1, 1, out.length, header.length).setValues(out);
  sh.getRange(1, 1, 1, header.length).setFontWeight("bold").setBackground("#0b1f3a").setFontColor("#ffffff");
  sh.setFrozenRows(1);
  try { sh.autoResizeColumns(1, header.length); } catch (e) {}
}

function writeKV_(ss, name, pairs) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clear();
  var out = [["Metric", "Value"]].concat(pairs);
  sh.getRange(1, 1, out.length, 2).setValues(out);
  sh.getRange(1, 1, 1, 2).setFontWeight("bold").setBackground("#0b1f3a").setFontColor("#ffffff");
  sh.getRange(2, 1, pairs.length, 1).setFontWeight("bold");
  sh.setFrozenRows(1);
  try { sh.autoResizeColumns(1, 2); } catch (e) {}
  // move Dashboard to the front
  try { ss.setActiveSheet(sh); ss.moveActiveSheet(1); } catch (e) {}
}
