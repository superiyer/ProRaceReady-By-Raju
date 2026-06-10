#!/usr/bin/env node
/* Generate the SHA-256 hash for a new access code, to paste into config.json.
 *
 *   node set-code.js NEWCODE
 *
 * The code is normalized (trimmed + uppercased) the same way the app does,
 * so "kyc", " KYC " and "KYC" all produce the same hash. Copy the printed
 * hash into the "codes" array in config.json, commit, and push — installed
 * apps pick up the change the next time they are online, locking out anyone
 * still on the old code.
 */
const crypto = require("crypto");

const raw = process.argv[2];
if (!raw) {
  console.error('Usage: node set-code.js <NEWCODE>');
  process.exit(1);
}
const norm = raw.trim().toUpperCase();
const hash = crypto.createHash("sha256").update(norm, "utf8").digest("hex");

console.log("");
console.log('  code (normalized): "' + norm + '"');
console.log("  sha-256 hash     :  " + hash);
console.log("");
console.log("Paste into config.json, e.g. (single active code):");
console.log('  "codes": ["' + hash + '"],');
console.log("");
console.log("To allow BOTH an old and new code during a changeover, list both hashes.");
