import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { senateFields } from "./senate-fields.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const date = "2026-10-13";
let failed = false;
const lines = [];

function check(name, ok, detail) {
  lines.push((ok ? "PASS" : "FAIL") + "  " + name + (detail ? "  " + detail : ""));
  if (!ok) failed = true;
}

const full = {
  senate_status: "blocked",
  senate_last_good_date: date,
  senate_handoff_date: "2026-09-01",
  collected: "2026-10-15T00:00:00Z",
  trades: []
};
const meta = senateFields(full);
check(
  "trades.json senate fields copy as their own object",
  meta.senate_status === "blocked" && meta.senate_last_good_date === date && meta.senate_handoff_date === "2026-09-01" && !Object.prototype.hasOwnProperty.call(meta, "collected"),
  JSON.stringify(meta)
);
check("missing senate fields copy nothing", JSON.stringify(senateFields({ collected: "x" })) === "{}", "{}");

const split = fs.readFileSync(path.join(root, "scripts/tape-split.mjs"), "utf8");
const copies = (split.match(/senateFields\(full\)/g) || []).length;
check("tape split copies the fields into page, filers, politicians, and tickers", copies === 4, String(copies) + " sites");
check(
  "tape split calls buildTape unconditionally and imports senateFields",
  split.includes('from "./senate-fields.mjs"') && /buildTape\(\);\s*$/.test(split) && !split.includes("if (entry ==="),
  ""
);

const pages = ["index.html", "politician.html", "ticker.html", "signals.html", "landed.html", "paper.html", "tells.html"];
const versions = pages.map((name) => {
  const html = fs.readFileSync(path.join(root, name), "utf8");
  const match = html.match(/qc\.js\?v=(\d+)/);
  return match ? match[1] : "missing";
});
check("same qc.js version on every page", new Set(versions).size === 1 && versions[0] !== "missing", "v=" + versions[0]);

console.log(lines.join("\n"));
if (failed) process.exit(1);
