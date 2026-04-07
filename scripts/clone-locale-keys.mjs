/**
 * Prints all "key": lines from es.ts for copy-paste into new locale files.
 * Run: node scripts/clone-locale-keys.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const esPath = path.join(__dirname, "../src/i18n/locales/es.ts");
const raw = fs.readFileSync(esPath, "utf8");
const keys = [];
for (const line of raw.split("\n")) {
  const m = line.match(/^\s+"([^"]+)":\s*(.*)$/);
  if (m) keys.push({ key: m[1], rest: m[2].trim() });
}
console.log("KEY_COUNT", keys.length);
for (const { key } of keys) {
  console.log(`  "${key}": "",`);
}
