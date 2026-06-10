// Smoke test: extract the DATA_LOGIC script block from index.html and verify it.
const fs = require("fs");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
const m = html.match(/<!--DATA_LOGIC_START-->\s*<script>([\s\S]*?)<\/script>\s*<!--DATA_LOGIC_END-->/);
if (!m) { console.error("FAIL: data/logic block not found"); process.exit(1); }
const { MARKS, HEADINGS, FAMILIES, fullSequence, courseCode, buildLegs, validateAll,
        trueBrg, MAG_VAR, trueToMag, bearingMag, angleDiff } =
  new Function(m[1] + "\nreturn { MARKS, HEADINGS, FAMILIES, fullSequence, courseCode, buildLegs, validateAll, trueBrg, MAG_VAR, trueToMag, bearingMag, angleDiff };")();

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

// 4. Headings vs GPS geometry, using the app's own trueBrg (imported above) so
//    test and app share one implementation.
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

// 10. Geo math — derived magnetic variation is the westerly ~14 deg
check(`MAG_VAR derived ~ +14 deg W (got ${MAG_VAR.toFixed(1)})`, Math.abs(MAG_VAR - 14.1) < 1.0);

// 11. bearingMag(CM->mark) reproduces the published CM headings (within 1 deg)
let bmBad = [];
for (const mk of ["A","B","C","D","E","F","G","H"]) {
  const got = bearingMag(MARKS.CM, MARKS[mk]);
  const want = parseFloat(HEADINGS.CM[mk]);
  let d = Math.abs(got - want); if (d > 180) d = 360 - d;
  if (d > 1.0) bmBad.push(`CM->${mk} got ${got.toFixed(1)} want ${want}`);
}
check("bearingMag reproduces published CM headings", bmBad.length === 0, bmBad.join("; "));

// 12. trueToMag is true + MAG_VAR mod 360
check("trueToMag(350) wraps correctly",
  Math.abs(trueToMag(350) - ((350 + MAG_VAR) % 360)) < 1e-9, String(trueToMag(350)));

// 13. angleDiff sign + wrap
check("angleDiff(350,10) = +20", Math.abs(angleDiff(350, 10) - 20) < 1e-9, String(angleDiff(350,10)));
check("angleDiff(10,350) = -20", Math.abs(angleDiff(10, 350) + 20) < 1e-9, String(angleDiff(10,350)));
check("angleDiff(0,180) = ±180", Math.abs(Math.abs(angleDiff(0, 180)) - 180) < 1e-9, String(angleDiff(0,180)));

// 14. reciprocal magnetic bearings differ by ~180
const rb = angleDiff(bearingMag(MARKS.CM, MARKS.A), bearingMag(MARKS.A, MARKS.CM));
check("reciprocal bearingMag CM<->A ~180", Math.abs(Math.abs(rb) - 180) < 2, String(rb));

console.log(fails ? `\n${fails} FAILURES` : "\nALL TESTS PASSED");
process.exit(fails ? 1 : 0);
