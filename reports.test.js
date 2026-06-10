// Validates the pure aggregation logic of reports-AppsScript.gs against sample
// "events" rows (Date in col0, full JSON in last col), without the Sheets API.
const tz = "x";
const fmtDate_ = (d) => d.toISOString().slice(0, 10);
const fmtDateTime_ = (d) => d.toISOString().slice(0, 16).replace("T", " ");
const round_ = (n, dp) => { const f = Math.pow(10, dp); return Math.round((n || 0) * f) / f; };
const fmtDur_ = (sec) => { sec = Math.round(sec || 0); if (sec < 60) return sec + "s"; const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60); return h ? (h + "h " + m + "m") : (m + "m"); };
const inc_ = (o, k) => o[k] = (o[k] || 0) + 1;

function rowToEvent_(row) {
  let ev = null;
  const last = row[row.length - 1];
  if (typeof last === "string" && last.charAt(0) === "{") { try { ev = JSON.parse(last); } catch (e) {} }
  if (!ev) ev = { deviceId: row[2], event: row[3], detail: row[4], courseCode: row[5], browser: row[10], os: row[11], deviceType: row[12], appVersion: row[13] };
  ev._time = (row[0] instanceof Date) ? row[0] : (ev.clientTime ? new Date(ev.clientTime) : null);
  return ev;
}

// build a sheet row from a payload
function row(date, p) { return [date, p.clientTime || "", p.deviceId || "", p.event || "", p.detail || "", p.courseCode || "", p.sog || "", p.cog || "", p.lat || "", p.lon || "", p.browser || "", p.os || "", p.deviceType || "", p.appVersion || "", JSON.stringify(p)]; }

const D = (s) => new Date(s);
const A = { deviceId: "dev-A", browser: "Safari", os: "iOS", deviceType: "phone", appVersion: "v6", configVersion: "2026-06-10", standalone: true };
const B = { deviceId: "dev-B", browser: "Chrome", os: "Android", deviceType: "phone", appVersion: "v6", configVersion: "2026-06-10", standalone: false };

const rows = [
  // device A, session 1, day 1
  row(D("2026-06-08T18:00:00Z"), { ...A, sessionId: "A1", event: "code_attempt", detail: "pass" }),
  row(D("2026-06-08T18:00:05Z"), { ...A, sessionId: "A1", event: "app_open", detail: "entered" }),
  row(D("2026-06-08T18:00:30Z"), { ...A, sessionId: "A1", event: "course_select", courseCode: "W2A" }),
  row(D("2026-06-08T18:35:00Z"), { ...A, sessionId: "A1", event: "gps_session", durationSec: "1800", distanceNm: "4.80", maxSog: "6.2" }),
  // device A, session 2, day 2
  row(D("2026-06-09T17:00:00Z"), { ...A, sessionId: "A2", event: "app_open", detail: "auto" }),
  row(D("2026-06-09T17:10:00Z"), { ...A, sessionId: "A2", event: "course_select", courseCode: "Z2A" }),
  // device B, session 1, day 2
  row(D("2026-06-09T18:00:00Z"), { ...B, sessionId: "B1", event: "code_attempt", detail: "fail" }),
  row(D("2026-06-09T18:00:10Z"), { ...B, sessionId: "B1", event: "code_attempt", detail: "pass" }),
  row(D("2026-06-09T18:00:20Z"), { ...B, sessionId: "B1", event: "app_open", detail: "entered" }),
  row(D("2026-06-09T18:01:00Z"), { ...B, sessionId: "B1", event: "course_select", courseCode: "W2A" }),
  row(D("2026-06-09T18:50:00Z"), { ...B, sessionId: "B1", event: "gps_session", durationSec: "2400", distanceNm: "5.50", maxSog: "7.1" }),
];

// ---- replicate aggregation ----
const events = rows.map(rowToEvent_).filter(e => e && e.event && e.event !== "event");
const users = {}, sessions = {}, days = {}, courses = {};
let codePass = 0, codeFail = 0, standaloneYes = 0, standaloneNo = 0, distTotal = 0, waterTotal = 0, gpsTotal = 0, maxSogGlobal = 0;

for (const e of events) {
  const t = e._time, dev = e.deviceId || "(unknown)";
  const u = users[dev] || (users[dev] = { dev, first: null, last: null, dates: {}, events: 0, sessions: {}, deviceType: "", browser: "", os: "", appVersion: "", codeVersion: "", gps: 0, dist: 0, maxSog: 0, water: 0, courses: {} });
  u.events++;
  if (t) { if (!u.first || t < u.first) u.first = t; if (!u.last || t > u.last) u.last = t; u.dates[fmtDate_(t)] = 1; }
  if (e.deviceType) u.deviceType = e.deviceType; if (e.browser) u.browser = e.browser; if (e.os) u.os = e.os;
  if (e.appVersion) u.appVersion = e.appVersion; if (e.configVersion) u.codeVersion = e.configVersion;
  const sid = e.sessionId || "na", skey = dev + "|" + sid;
  u.sessions[sid] = 1;
  const sObj = sessions[skey] || (sessions[skey] = { dev, min: t, max: t });
  if (t) { if (!sObj.min || t < sObj.min) sObj.min = t; if (!sObj.max || t > sObj.max) sObj.max = t; }
  if (t) { const dkey = fmtDate_(t); const d = days[dkey] || (days[dkey] = { events: 0, sess: {}, users: {}, gps: 0, dist: 0 }); d.events++; d.sess[skey] = 1; d.users[dev] = 1; }
  if (e.event === "code_attempt") { if (e.detail === "pass") codePass++; else if (e.detail === "fail") codeFail++; }
  if (e.event === "app_open") { if (e.standalone === true || e.standalone === "true") standaloneYes++; else standaloneNo++; }
  if (e.event === "course_select" && e.courseCode) { const c = courses[e.courseCode] || (courses[e.courseCode] = { count: 0, users: {} }); c.count++; c.users[dev] = 1; u.courses[e.courseCode] = 1; }
  if (e.event === "gps_session") { gpsTotal++; u.gps++; const dist = parseFloat(e.distanceNm) || 0, water = parseFloat(e.durationSec) || 0, ms = parseFloat(e.maxSog) || 0; distTotal += dist; waterTotal += water; u.dist += dist; u.water += water; if (ms > u.maxSog) u.maxSog = ms; if (ms > maxSogGlobal) maxSogGlobal = ms; days[fmtDate_(t)].gps++, days[fmtDate_(t)].dist += dist; }
}
let appTimeTotal = 0;
for (const sk in sessions) { const s = sessions[sk]; const span = (s.min && s.max) ? Math.round((s.max - s.min) / 1000) : 0; appTimeTotal += span; if (users[s.dev]) users[s.dev].appTime = (users[s.dev].appTime || 0) + span; }

// ---- assertions ----
let fails = 0;
const ck = (name, got, want) => { const ok = String(got) === String(want); console.log((ok ? "PASS  " : "FAIL  ") + name + " = " + got + (ok ? "" : "  (want " + want + ")")); if (!ok) fails++; };

ck("unique users", Object.keys(users).length, 2);
ck("total sessions", Object.keys(sessions).length, 3);
ck("total events", events.length, 11);
ck("code pass", codePass, 2);
ck("code fail", codeFail, 1);
ck("standalone yes (app_open)", standaloneYes, 2);   // A1, B1 entered (standalone true for A; B false) -> A:1, plus A2 auto -> 2 yes
ck("standalone no (app_open)", standaloneNo, 1);      // B1 -> false
ck("gps sessions", gpsTotal, 2);
ck("total distance", round_(distTotal, 1), 10.3);
ck("total water", fmtDur_(waterTotal), "1h 10m");
ck("max sog global", round_(maxSogGlobal, 1), 7.1);
ck("dev-A sessions", Object.keys(users["dev-A"].sessions).length, 2);
ck("dev-A days active", Object.keys(users["dev-A"].dates).length, 2);
ck("dev-A app time", fmtDur_(users["dev-A"].appTime), "45m"); // A1 span 35m + A2 span 10m = 45m
ck("dev-B distance", round_(users["dev-B"].dist, 1), 5.5);
ck("course W2A picks", courses["W2A"].count, 2);
ck("course W2A unique users", Object.keys(courses["W2A"].users).length, 2);
ck("days count", Object.keys(days).length, 2);

console.log(fails ? ("\n" + fails + " FAILURES") : "\nALL REPORT TESTS PASSED");
process.exit(fails ? 1 : 0);
