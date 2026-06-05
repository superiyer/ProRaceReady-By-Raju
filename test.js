// Smoke test: extract the DATA_LOGIC script block from index.html and verify it.
const fs = require("fs");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
const m = html.match(/<!--DATA_LOGIC_START-->\s*<script>([\s\S]*?)<\/script>\s*<!--DATA_LOGIC_END-->/);
if (!m) { console.error("FAIL: data/logic block not found"); process.exit(1); }
const { MARKS, HEADINGS, FAMILIES, fullSequence, courseCode, buildLegs, validateAll } =
  new Function(m[1] + "\nreturn { MARKS, HEADINGS, FAMILIES, fullSequence, courseCode, buildLegs, validateAll };")();

let fails = 0;
const check = (name, cond, detail) => {
  if (cond) console.log("PASS  " + name);
  else { console.log("FAIL  " + name + (detail ? "  -> " + detail : "")); fails++; }
};

// 1. Validation finds zero data errors
const errs = validateAll();
check("validateAll() clean", errs.length === 0, errs.join("; "));

// 2. Heading matrix: 72 directed entries among A-H/CM... actually 8*8=64 from marks + 8 from CM = 72
let count = 0;
for (const f of Object.keys(HEADINGS)) count += Object.keys(HEADINGS[f]).length;
check("72 heading entries", count === 72, "got " + count);

// 3. Reciprocals differ by 180 (mod 360) for every pair
let recipBad = [];
for (const f of Object.keys(HEADINGS)) for (const t of Object.keys(HEADINGS[f])) {
  const fwd = parseFloat(HEADINGS[f][t]) % 360, rev = parseFloat(HEADINGS[t][f]) % 360;
  const d = Math.abs(((fwd - rev) % 360 + 360) % 360);
  if (Math.abs(d - 180) > 0.01) recipBad.push(`${f}->${t} ${fwd} vs ${rev}`);
}
check("all reciprocals = 180 deg apart", recipBad.length === 0, recipBad.join("; "));

// 4. Headings vs GPS geometry: stored heading should be within a few degrees of
//    the true bearing computed from coordinates (circle is idealized; allow 6 deg)
function trueBrg(p, q) {
  const toR = Math.PI / 180;
  const dLon = (q.lon - p.lon) * toR;
  const y = Math.sin(dLon) * Math.cos(q.lat * toR);
  const x = Math.cos(p.lat * toR) * Math.sin(q.lat * toR) - Math.sin(p.lat * toR) * Math.cos(q.lat * toR) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}
// stored = magnetic, geometry = true; the difference IS the magnetic variation.
// Check every pair shows the SAME variation (within tolerance), i.e. data is self-consistent.
let devs = [];
for (const f of Object.keys(HEADINGS)) for (const t of Object.keys(HEADINGS[f])) {
  const stored = parseFloat(HEADINGS[f][t]) % 360;
  const tb = trueBrg(MARKS[f], MARKS[t]);
  let d = ((stored - tb + 540) % 360) - 180; // signed dev in [-180,180)
  devs.push({ leg: `${f}->${t}`, d });
}
const meanVar = devs.reduce((s, x) => s + x.d, 0) / devs.length;
const outliers = devs.filter(x => Math.abs(x.d - meanVar) > 5).map(x => `${x.leg} dev ${x.d.toFixed(1)}`);
check(`headings consistent with GPS + uniform magnetic variation (~${meanVar.toFixed(1)} deg W)`,
  outliers.length === 0, outliers.slice(0, 5).join("; "));

// 5. Course expansion: W2A
const fam = (c) => FAMILIES.find(f => f.code === c);
check("W2A sequence", fullSequence(fam("W"), "A", 2).join(",") === "CM,A,E,CM,A,E,CM",
  fullSequence(fam("W"), "A", 2).join(","));
check("W2A code", courseCode(fam("W"), "A", 2) === "W2A");
check("O-A code", courseCode(fam("O"), "A", 1) === "O-A");
check("O-A sequence", fullSequence(fam("O"), "A", 1).join(",") === "CM,A,G,E,A,E,CM",
  fullSequence(fam("O"), "A", 1).join(","));
check("S-H sequence", fullSequence(fam("S"), "H", 1).join(",") === "CM,H,CM");

// 6. W2A legs and headings
const legs = buildLegs(fullSequence(fam("W"), "A", 2));
const hd = legs.map(l => l.heading).join(",");
check("W2A headings", hd === "000.0,180.0,000.0,000.0,180.0,000.0", hd);
check("W2A mid/finish flags", legs[2].toCM === "mid" && legs[5].toCM === "finish");

// 7. Computed totals vs published (1 lap / fixed) — allow 10% tolerance
const expect = { W: 2.5, Z: 3.1, O: 5.5, T: 3.0, L: 4.5, S: 1.25 };
for (const code of Object.keys(expect)) {
  const f = fam(code);
  const tot = buildLegs(fullSequence(f, "A", 1)).reduce((s, l) => s + l.dist, 0);
  const ok = Math.abs(tot - expect[code]) / expect[code] < 0.10;
  check(`${code}-A distance ${tot.toFixed(2)}nm ~ published ${expect[code]}nm`, ok);
}

// 8. Verbatim preservation of 360.0 / 000.0 quirks
check("D->B stored as 360.0", HEADINGS.D.B === "360.0");
check("F->H stored as 360.0", HEADINGS.F.H === "360.0");
check("E->A stored as 000.0", HEADINGS.E.A === "000.0");

// 9. All 48 base courses produce complete tables for laps 1-4 where applicable
let tblBad = [];
for (const f of FAMILIES) for (const mk of Object.keys(f.seq)) {
  for (const n of (f.laps ? [1, 2, 3, 4] : [1])) {
    for (const l of buildLegs(fullSequence(f, mk, n)))
      if (!l.heading) tblBad.push(`${courseCode(f, mk, n)}: ${l.from}->${l.to}`);
  }
}
check("all course variants have complete heading tables", tblBad.length === 0, tblBad.slice(0, 5).join("; "));

console.log(fails ? `\n${fails} FAILURES` : "\nALL TESTS PASSED");
process.exit(fails ? 1 : 0);
