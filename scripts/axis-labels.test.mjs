import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = false;
const lines = [];

function check(name, ok, detail) {
  lines.push((ok ? "PASS" : "FAIL") + "  " + name + (detail ? "  " + detail : ""));
  if (!ok) failed = true;
}

function loadQC() {
  const sandbox = {
    console,
    document: {
      readyState: "loading",
      body: { children: [], insertBefore() {} },
      documentElement: { style: {} },
      referrer: "",
      visibilityState: "visible",
      activeElement: null,
      addEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      getElementById() { return null; },
      createElement() { return { className: "", hidden: false, textContent: "", setAttribute() {} }; }
    },
    location: { pathname: "/", search: "", hash: "" },
    navigator: { serviceWorker: null },
    localStorage: { getItem() { return null; }, setItem() {} },
    history: { scrollRestoration: "auto", replaceState() {}, pushState() {} }
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, "qc.js"), "utf8"), sandbox, { filename: "qc.js" });
  return sandbox.QC;
}

const QC = loadQC();
if (!QC || typeof QC.formatAxisPrice !== "function") {
  console.log("FAIL  formatAxisPrice is missing");
  process.exit(1);
}

function ticks(start, step, count) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(Number((start + step * i).toFixed(8)));
  return out;
}

function labelsFor(start, step, count) {
  return ticks(start, step, count).map((v) => QC.formatAxisPrice(v, step));
}

function assertDistinct(name, start, step, count) {
  const labels = labelsFor(start, step, count);
  check(name, new Set(labels).size === labels.length, labels.join("  "));
}

assertDistinct("under $1 step 0.001", 0.125, 0.001, 5);
assertDistinct("under $1 step 0.005", 0.12, 0.005, 5);
assertDistinct("under $1 step 0.01", 0.1, 0.01, 5);
assertDistinct("under $1 step 0.05", 0.1, 0.05, 5);
assertDistinct("under $1 step 0.125", 0.125, 0.125, 4);
assertDistinct("under $1 step 0.25", 0.25, 0.25, 4);

assertDistinct("under $10 step 0.01", 4.2, 0.01, 5);
assertDistinct("under $10 step 0.05", 4.2, 0.05, 5);
assertDistinct("under $10 step 0.25", 4.25, 0.25, 4);
assertDistinct("under $10 step 0.5", 4, 0.5, 5);
assertDistinct("under $10 step 1", 4, 1, 5);

assertDistinct("about $100 step 0.25", 99.25, 0.25, 5);
assertDistinct("about $100 step 0.5", 99.5, 0.5, 5);
assertDistinct("about $100 step 1", 100, 1, 5);
assertDistinct("about $100 step 5", 100, 5, 5);
assertDistinct("about $100 step 10", 90, 10, 5);

assertDistinct("about $3000 step 1", 2998, 1, 5);
assertDistinct("about $3000 step 5", 2950, 5, 5);
assertDistinct("about $3000 step 10", 2950, 10, 5);
assertDistinct("about $3000 step 50", 2950, 50, 5);
assertDistinct("about $3000 step 100", 2700, 100, 6);
assertDistinct("about $3000 step 250", 2750, 250, 4);
assertDistinct("about $3000 step 500", 2500, 500, 5);

assertDistinct("over $100k step 50", 100000, 50, 5);
assertDistinct("over $100k step 100", 100000, 100, 5);
assertDistinct("over $100k step 1000", 780000, 1000, 5);
assertDistinct("over $100k step 5000", 760000, 5000, 5);
assertDistinct("over $100k step 10000", 760000, 10000, 5);
assertDistinct("over $100k step 20000", 720000, 20000, 5);

const thousands = labelsFor(2950, 50, 3);
check(
  "about $3000 step 50 keeps cents in the thousands",
  thousands.join(" ") === "$2.95k $3.00k $3.05k",
  thousands.join(" ")
);
const quarters = labelsFor(4.25, 0.25, 2);
check(
  "under $10 quarters show cents",
  quarters.join(" ") === "$4.25 $4.50",
  quarters.join(" ")
);
check("sub-$1 eighths show three decimals", QC.formatAxisPrice(0.125, 0.125) === "$0.125", QC.formatAxisPrice(0.125, 0.125));

console.log(lines.join("\n"));
if (failed) process.exit(1);
