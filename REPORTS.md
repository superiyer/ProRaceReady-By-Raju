# KYC Race Ready — usage reports

Turns the raw `events` log into readable summary tabs inside your **KYC Race Log** sheet.

## One-time install (~2 min, no redeploy)
1. Open the Sheet → **Extensions → Apps Script**.
2. Add a new script file: click the **+** next to "Files" → **Script** → name it `Reports`.
   (Or just paste at the bottom of your existing file — either works.)
3. Paste the entire contents of **`reports-AppsScript.gs`** → **Save** (💾).
4. Go back to the spreadsheet and **reload the browser tab**.
5. A new menu **📊 KYC Reports** appears → click **Refresh reports**.
   (First run asks for permission — it's your own script; Allow.)

## What you get (tabs are rebuilt each refresh)
- **Dashboard** — unique users, sessions (total / today / last 7 days), active users,
  total events, approx app time, GPS sessions, total distance & time on water, max SOG,
  most-picked course, code pass/fail, installed-vs-browser, data range, last activity.
- **By User** — one row per unique device: first used, last used, days active, sessions,
  app time, events, device/browser/OS, GPS sessions, distance, time on water, max SOG,
  courses used, app & code version. (Devices are anonymous IDs — no personal data.)
- **By Day** — date → sessions, unique users, events, GPS sessions, distance.
- **Courses** — which courses get picked and by how many distinct users.
- **Devices** — unique-user breakdown by device type, browser, and OS.

## Refresh options
- **Manual:** 📊 KYC Reports → Refresh reports anytime.
- **Automatic (optional):** in Apps Script, click the ⏰ **Triggers** icon → **Add Trigger**
  → function `buildReports`, event source **Time-driven**, e.g. **Day timer → 6–7am**.
  Reports then refresh themselves every morning.

## Notes
- Reports read the current logging schema (15 columns; last column holds the full event JSON),
  so they keep working even as new event fields are added.
- Nothing here changes the web app or the `doPost` receiver — it's pure reporting on top of the log.
