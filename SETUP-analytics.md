# KYC Race Ready — analytics setup (one time, ~5 minutes)

This sends app usage to a Google Sheet in **your** Google Drive. You do this once.

## 1. Create the Sheet
1. Go to https://sheets.google.com and create a new blank spreadsheet.
2. Name it e.g. **KYC Race Ready – Analytics**. (A tab named `events` is created automatically on first data.)

## 2. Add the script
1. In that sheet: **Extensions → Apps Script**.
2. Delete any sample code, then paste the entire contents of **`analytics-AppsScript.gs`** (in this repo).
3. Click the **Save** (disk) icon.

## 3. Deploy as a Web App
1. Click **Deploy → New deployment**.
2. Click the gear next to "Select type" → choose **Web app**.
3. Set:
   - **Description:** KYC analytics
   - **Execute as:** **Me** (your account)
   - **Who has access:** **Anyone**   ← required so the app can post without a login
4. Click **Deploy**. Approve the permissions prompt (you may see an "unverified app" warning — it's your own script; click **Advanced → Go to … (unsafe)** and **Allow**).
5. Copy the **Web app URL**. It ends in **`/exec`**, e.g.
   `https://script.google.com/macros/s/AKfy....../exec`

## 4. Point the app at it
1. Open **`config.json`** in this GitHub repo (web editor: click the file → pencil icon).
2. Paste your URL as the value of `analyticsUrl`:
   ```json
   "analyticsUrl": "https://script.google.com/macros/s/AKfy....../exec",
   ```
3. **Commit** the change. Within ~1 minute the live app starts logging; rows appear on the `events` tab as people use it.

## Test it
- Open the app, enter the code, tap around, start GPS. Refresh the Sheet — you should see rows.
- Or visit your `/exec` URL in a browser: it should say *"KYC Race Ready analytics endpoint is live."*

## Notes
- **To pause analytics:** set `analyticsUrl` back to `""` in config.json and commit.
- **To update the script later:** edit the code, then **Deploy → Manage deployments → edit (pencil) → Version: New version → Deploy.** The `/exec` URL stays the same.
- Each row has columns for the common fields; anything new the app sends lands in the `extra` column as JSON, so you rarely need to touch the script.
- You can build charts/pivot tables right in the Sheet (e.g., sessions per day, most-used courses, devices).
