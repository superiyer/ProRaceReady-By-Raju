# KYC Race Ready — access code

The app is gated by a code. The **current code is `KYC`**. The code itself is never
stored in the repo — only its SHA-256 hash, in `config.json`.

## How it works
- On launch the app fetches `config.json` fresh from GitHub (bypassing the offline cache).
- The user enters a code; the app hashes it and compares to the `codes` list.
- A valid entry is remembered, so the app keeps working **offline on the water**.
- When the device is next **online**, it re-checks. If you've changed the code,
  the old one no longer matches and that device is prompted for the new code.

> Reality check: this is soft gating, not hard security. The site is public and a
> determined person could bypass a browser-side check. It's meant to keep casual
> access limited and let you rotate/revoke a shared code — not to protect secrets.

## Change the code
1. Pick the new code, e.g. `KYC2026`.
2. Generate its hash:
   ```
   node set-code.js KYC2026
   ```
3. Copy the printed hash into `config.json`:
   ```json
   "codes": ["<new-hash>"],
   ```
   (To allow the old and new code during a changeover, list **both** hashes.)
4. Optionally bump `"configVersion"` and commit. Installed phones pick up the change
   when next online and lock out anyone still on the old code.

## Broadcast a message
Set `"message"` in `config.json` (e.g. `"No racing tonight — fog"`); it shows on the
splash screen for everyone the next time they open the app online.
