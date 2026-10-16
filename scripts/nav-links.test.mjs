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

function localRefs(html) {
  const out = [];
  for (const re of [/href="([^"]+)"/g, /src="([^"]+)"/g]) {
    let m;
    while ((m = re.exec(html)) !== null) out.push(m[1]);
  }
  return out;
}

const pages = fs.readdirSync(root).filter((f) => f.endsWith(".html")).sort();
check("root pages found", pages.length >= 8, pages.join(" "));

for (const page of pages) {
  const html = fs.readFileSync(path.join(root, page), "utf8");
  const missing = [];
  for (const ref of localRefs(html)) {
    if (/^[a-z]+:/i.test(ref) || ref.startsWith("//")) continue;
    const clean = ref.split(/[?#]/)[0];
    if (!clean || clean === "./") continue;
    if (!fs.existsSync(path.join(root, clean))) missing.push(ref);
  }
  check(page + " local hrefs and srcs resolve", missing.length === 0, missing.join(" "));
}

const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const shellMatch = sw.match(/const SHELL = \[([\s\S]*?)\];/);
const shell = shellMatch ? [...shellMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
check("sw.js SHELL parses", shell.length >= 15, String(shell.length) + " entries");
for (const item of shell) {
  const clean = item.replace(/^\.\//, "");
  if (!clean) continue;
  check("sw.js SHELL lists " + item, fs.existsSync(path.join(root, clean)));
}

console.log(lines.join("\n"));
if (failed) process.exit(1);
