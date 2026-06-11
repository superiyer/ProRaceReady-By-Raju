# Custom Race

Under **Race Course Headings** there are now two buttons:

- **KYC Wed Race** - the predefined KYC courses (unchanged).
- **Custom Race** - build any course from your own marks.

## Building a custom course
1. Pick a **coordinate format** - Decimal (`40.4695`, `-74.2065`) or Deg-Min (`40 28.17 N`, `074 12.39 W`). Either is accepted per field.
2. Set the **magnetic variation** (default 14W; editable for other areas). Headings are computed magnetic using this.
3. Enter **Start** (Start = Finish) and **1-6 marks** in the order sailed. Leave unused mark rows blank.
4. Choose **Laps**.
5. Tap **Set Course**.

The heading table, course map, and **Map - Live** (GPS, next-mark guidance, tactics) then all work exactly as for KYC courses - headings are computed from your coordinates instead of looked up.

## Shared saved races (cloud)
Saving/retrieving races uses the same Google endpoint as analytics. The course-building above works without it; only **Save / Saved races** need this one-time update:

1. In Apps Script, open the file with your `doPost`/`doGet` (the analytics one - NOT Reports.gs).
2. Replace its contents with **`AppsScript-main.gs`** from this repo. **Save.**
3. **Deploy -> Manage deployments -> Edit (pencil) -> Version: New version -> Deploy.** (URL stays the same; `config.json` needs no change.)

This adds a **`races`** tab to your sheet. **Save** writes the named race there (upsert by name); **Saved races** lists them for anyone to **Load**. Saved coordinates are stored as decimal degrees.
