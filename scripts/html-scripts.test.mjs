import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = false;
const lines = [];

function check(name, ok, detail) {
  lines.push((ok ? "PASS" : "FAIL") + "  " + name + (detail ? "  " + detail : ""));
  if (!ok) failed = true;
}

const pages = fs.readdirSync(root).filter((f) => f.endsWith(".html")).sort();
for (const page of pages) {
  const html = fs.readFileSync(path.join(root, page), "utf8");
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  let block = 0;
  let ok = true;
  while ((m = re.exec(html)) !== null) {
    block += 1;
    try {
      new Function(m[1]);
    } catch (err) {
      ok = false;
      const at = html.slice(0, m.index).split("\n").length;
      check(page + " inline script #" + block + " parses", false, "~line " + at + ": " + err.message);
    }
  }
  if (ok) check(page + " inline scripts parse", true, block + " block" + (block === 1 ? "" : "s"));
}

console.log(lines.join("\n"));
if (failed) process.exit(1);
