// Smoke test: extract the DATA_LOGIC script block from index.html and verify it.
const fs = require("fs");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
const m = html.match(/<!--DATA_LOGIC_START-->\s*<script>([\s\S]*?)<\/script>\s*<!--DATA_LOGIC_END-->/);
if (!m) { console.error("FAIL: data/logic block not found"); process.exit(1); }
const { MARKS, HEADINGS, FAMILIES, fullSequence, courseCode, buildLegs, validateAll,
        trueBrg, MAG_VAR, trueToMag, bearingMag, angleDiff, TAC, computeTactics, lineBias, destPoint } =
  new Function(m[1] + "\nreturn { MARKS, HEADINGS, FAMILIES, fullSequence, courseCode, buildLegs, validateAll, trueBrg, MAG_VAR, trueToMag, bearingMag, angleDiff, TAC, computeTactics, lineBias, destPoint };")();

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

// 15. Tactics — point of sail classification (wind from North = 000)
check("dead upwind => beat", computeTactics(0, 0).mode === "beat", computeTactics(0,0).mode);
check("dead downwind => run", computeTactics(180, 0).mode === "run", computeTactics(180,0).mode);
check("beam-on => reach", computeTactics(90, 0).mode === "reach", computeTactics(90,0).mode);

// 16. Close-hauled headings & tack labels (wind 000, upwind 45)
{
  const t = computeTactics(10, 0); // a beat toward ~N
  const hs = t.headings.map(c => `${c.t}:${Math.round(c.h)}`).sort().join(",");
  check("beat offers STBD 315 + PORT 045", hs === "PORT:45,STBD:315", hs);
  check("favored tack is the one closer to the mark bearing",
    t.favored === "PORT", t.favored); // brg 010 is closer to 045 (PORT) than 315 (STBD)
}

// 17. Layline detection: bearing to mark aligned with a close-hauled heading
{
  // wind 000 -> starboard close-hauled heading = 315; a mark bearing 315 is on the STBD layline
  const t = computeTactics(315, 0);
  check("mark at close-hauled bearing flags a layline", t.layline === "STBD", String(t.layline));
}
check("no layline when well below it", computeTactics(10, 0).layline === null, String(computeTactics(10,0).layline));

// 18. Reciprocal wind: same geometry, wind from South (180) flips beat/run
check("wind from S: mark to N is a run", computeTactics(0, 180).mode === "run", computeTactics(0,180).mode);

// 19. null wind => no tactics
check("null wind returns null tactics", computeTactics(90, null) === null);


// 20. Ping the line — favored end of the start line
{
  const rc  = { lat: 40.0, lon: -74.0 };
  const pin = { lat: 40.0, lon: -73.999 };           // pin ~85 m EAST of rc
  const V = MAG_VAR;                                   // ACTIVE_VAR defaults to MAG_VAR
  check("line length ~85 m", Math.abs(lineBias(rc,pin,V).len - 85) < 6, String(lineBias(rc,pin,V).len));
  check("wind from true-East favors PIN (east) end", lineBias(rc, pin, 90 + V).favored === "pin", lineBias(rc,pin,90+V).favored);
  check("wind from true-West favors RC (west) end",  lineBias(rc, pin, 270 + V).favored === "rc",  lineBias(rc,pin,270+V).favored);
  check("wind square to line => no end favored",      lineBias(rc, pin, 0 + V).favored === "even", lineBias(rc,pin,0+V).favored);
  check("null wind => favored null",                  lineBias(rc, pin, null).favored === null);
}


// 21. destPoint — 1 nm true-north raises latitude by 1 arc-minute; 1 nm east at the equatorish
{
  const n = destPoint(40, -74, 0, 1);
  check("destPoint 1nm N raises lat ~1/60 deg", Math.abs((n.lat-40) - 1/60) < 1e-3, String(n.lat));
  check("destPoint 1nm N keeps lon ~same", Math.abs(n.lon + 74) < 1e-3, String(n.lon));
  const e = destPoint(40, -74, 90, 1);
  check("destPoint 1nm E raises lon (east)", e.lon > -74, String(e.lon));
  check("destPoint 1nm E keeps lat ~same", Math.abs(e.lat-40) < 1e-3, String(e.lat));
  // round trip: bearing/dist back to origin
  const b = trueBrg({lat:40,lon:-74}, n), d = (function(){return Math.abs(0-((b+360)%360))<1 || Math.abs(360-b)<1;})();
  check("destPoint N round-trips to ~000 bearing", d, String(b));
}

// 22. fullSequence respects noLapMark (RC W/L goes L->W between laps, no start rounding)
{
  const fam = { seq:{X:["A","B"]}, laps:true };
  const famRC = { seq:{X:["A","B"]}, laps:true, noLapMark:true };
  check("KYC-style inserts start between laps", fullSequence(fam,"X",2).join() === "CM,A,B,CM,A,B,CM", fullSequence(fam,"X",2).join());
  check("noLapMark skips start between laps", fullSequence(famRC,"X",2).join() === "CM,A,B,A,B,CM", fullSequence(famRC,"X",2).join());
}
console.log(fails ? `\n${fails} FAILURES` : "\nALL TESTS PASSED");
process.exit(fails ? 1 : 0);
