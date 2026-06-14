# Pro Race Ready — Changelog

A sailboat-racing companion for Keyport Yacht Club (KYC) Wednesday-night racing and
custom courses. Single-file PWA (HTML/JS/CSS), offline-capable, hosted on GitHub Pages.

Live: https://superiyer.github.io/ProRaceReady-By-Raju/
Created by Raju Venkatraman.

The `vNN` markers below correspond to the service-worker cache version (`sw.js`),
which is bumped on every deploy so phones pull the new build.

---

## Foundation (initial build)

- **Course engine** — 8 KYC marks (A–H) plus CM (committee/center), the published
  magnetic heading matrix, and 6 course families (Wind/Lee, Trapezoid, Modified Olympic,
  Modified Triangle, Long Triangle, Short W/L) with 1–4 laps.
- **Heading table** — full leg-by-leg sequence with from→to, magnetic heading, GPS-computed
  leg distance, and the destination mark's coordinates.
- **To-scale course diagram** — north-up SVG built from the mark coordinates.
- **Custom Race mode** — build any course from your own marks (Start + up to 6 + Finish),
  decimal or deg-min input, editable magnetic variation; headings computed from coordinates.
- **Shared races (cloud)** — save/load named custom courses via a Google Apps Script + Sheet.
- **Live GPS** — SOG, COG (magnetic), position, next-mark guidance, breadcrumb track.
- **Wind tactics** — point of sail (beat/reach/run), close-hauled & gybe headings, layline calls,
  favored tack, steer-to guidance.
- **PWA** — installable, offline cache, Apple touch icons, manifest.
- **Access gate** — animated splash, User Agreement (every launch), hashed access code
  (remotely changeable kill-switch via `config.json`).
- **Analytics** — anonymous device/session usage to a Google Sheet, plus a reporting script
  (Dashboard / By User / By Day / Courses / Devices).
- Magnetic variation (~14°W) derived from the data itself (no hard-coded constant).
- Node test harness (`test.js`) for the pure data/geo/tactics logic.

---

## Recent changes

### v16 — Set Course gate & cleaner start
- Added a **Set Course** button to KYC mode; the table + map appear only after tapping it.
- No default course is pre-selected (fixes phantom "W1A" analytics on open).
- Custom Race coordinates start blank with sample hints only in the Start row.
- Larger Map-page title; the separate timed splash is hidden (Agreement page covers it).

### v17–v20 — Map clarity
- **Off-grid note** explaining the boat only plots inside the course area.
- **GPS-off hint**; messages reworded to be short and consistent (no contradictions).
- **Next-mark direction** spelled out and shown in parentheses, e.g. `Next mark: C (East)`.

### v21–v23 — Branding & layout polish
- Bigger logo-before-name brand band with a stylish credits band (consistent both screens).
- **Wind compass** on the live map (amber arrow to windward).
- Footer cleaned to the exact User Agreement + info; removed legacy text.
- User Agreement + info footer added to the Map page too.

### v24–v25 — Tactics on the map
- **Most-efficient wind route** to the next mark: dotted line with a single **tack (T)** when
  beating or **gybe (G)** when running, to the layline.
- **Laylines** drawn from the next mark (faint dashed; the two relevant for the point of sail).

### v26 — Wind compass readability
- White, larger arrowhead for clear reading on a phone.

### v27–v28 — iPad support & decluttering
- Detect **iPadOS** for analytics (Safari reports a desktop UA).
- **Side-by-side** Course + live map on tablet/desktop **landscape**; **full-width** map on
  iPad **portrait**.
- Removed the redundant static course diagram and the Print / Open-map buttons.

### v29 — Single page + breadcrumb fix
- Removed the Course/Map tabs — one continuous scroll; the live map reveals under the table
  on **Set Course**.
- **Breadcrumb bug fix**: the trail now records vs. the last breadcrumb (was the previous fix),
  so it accumulates at slow speed.

### v30 — Pinch-zoom map
- **Pinch to zoom** and **drag to pan** the course map, bounded to the course; one finger still
  scrolls the page when not zoomed.

### v31–v33 — Sticky brand bar
- **Locked top bar**: logo + "Pro Race Ready!" + credits stay fixed, **Start GPS** pinned right.
- Larger responsive title and logo; phone number on its own line in phone portrait.
- Larger, screen-fitting live **Position** readout; removed the "all roundings to port" note;
  hid footer info notes except the User Agreement.

### v34–v35 — Ping the Line
- **Ping the line**: pin the start-line ends and get the **favored (more-upwind) end** for the
  entered wind. KYC auto-uses **CM** as the pin end (ping only the RC/boat end); custom pings both.
- **Distance-to-line** with **OVER EARLY** detection and time-to-line at current speed.
- **Start countdown timer** with **Sync** (snap to nearest minute) and Reset.

### v36 — Collapsible phase sections
- Start-line and Next-mark sections are collapsible and **auto-swap at the start**
  (pre-start shows start tools; crossing the line opens next-mark).

### v37 — Gun cues
- Beep + vibrate (Android) + flash at the **3/2/1 min**, the **final 10 s**, and the **gun**.
- Live countdown shown in the collapsed Start header.

### v38 — ISAF 5·4·1 preset
- One-tap **World Sailing Rule 26** start sequence: signals at **5:00 / 4:00 / 1:00 / gun**,
  with a phase label (Warning → Preparatory → One minute → STARTED).

### v39 — Race timer
- New collapsible **Race timer** section: **arms at the gun**, **auto-clocks roundings** into
  **lap/leg splits**, with **Mark / Undo / Finish / Reset** (and manual **Start**).
- Auto-finish at the last mark with per-lap times + total. A lap = each CM passing.

### v40–v46 — Race-day refinements
- Start countdown **retires at the gun**; the whole **Start-line section hides once racing**
  (back on a race Reset for general recalls).
- **Confirm / Cancel** prompts on Race-timer **Reset** and **Finish** (finish time stamped at the tap);
  **Start** hides once the race is running.
- **Course setup** (mode toggle → Set Course) is now a **collapsible section** that folds on Set Course,
  showing the chosen course in its header.
- Wording/visibility tidy-ups: CM = Center Mark; "Ping RC boat end"; start-line legend moved into the
  Start-line section and hidden once racing; footer hint hidden.

### v47 — RC Race (committee-boat course)
- New third mode **RC Race**: **ping the committee boat** (or type its position), then place each mark by
  **magnetic bearing + distance (nm)** — Windward, Offset, Reach/Wing, Leeward, Pin, Finish.
- Enter the **wind**, tap **Set Course**, and all marks are computed and plotted, with the **start line =
  RC ↔ Pin** auto-set (favored-end works immediately).
- Builds the **course sequence** (Windward → Offset → Reach → Leeward, repeated for laps) and feeds the
  heading table, next-mark guidance, route, laylines, and race timer. W/L laps go leeward → windward
  directly (no start rounding between laps). **Custom Race is unchanged.**

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
