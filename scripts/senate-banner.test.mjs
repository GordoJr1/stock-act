import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { senateFields } from "./senate-fields.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const date = "2026-10-13";
const asOf = "Senate data as of " + date;
const fallback = "Senate data may be out of date";
let failed = false;
const lines = [];

function check(name, ok, detail) {
  lines.push((ok ? "PASS" : "FAIL") + "  " + name + (detail ? "  " + detail : ""));
  if (!ok) failed = true;
}

function makeDocument() {
  const nodes = {};
  const header = {
    children: [],
    appendChild(el) { this.children.push(el); }
  };
  const body = {
    children: [],
    insertBefore(el) { this.children.unshift(el); }
  };
  return {
    readyState: "loading",
    body,
    documentElement: { style: {} },
    referrer: "",
    visibilityState: "visible",
    activeElement: null,
    addEventListener() {},
    querySelector(sel) { return sel === ".qc-header" ? header : null; },
    querySelectorAll() { return []; },
    getElementById(id) { return nodes[id] || null; },
    createElement() {
      const el = {
        className: "",
        hidden: false,
        textContent: "",
        attrs: {},
        setAttribute(key, value) { this.attrs[key] = value; }
      };
      let id = "";
      Object.defineProperty(el, "id", {
        get() { return id; },
        set(value) {
          if (id && nodes[id] === el) delete nodes[id];
          id = value;
          if (value) nodes[value] = el;
        }
      });
      return el;
    }
  };
}

function loadQC(document) {
  const sandbox = {
    console,
    document,
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

function visible(document) {
  const el = document.getElementById("senate-banner");
  if (!el || el.hidden) return { shown: false, text: "", ariaLive: "" };
  return { shown: true, text: el.textContent, ariaLive: el.attrs["aria-live"] || "" };
}

const document = makeDocument();
const QC = loadQC(document);
if (!QC || typeof QC.paintSenateBanner !== "function") {
  console.log("FAIL  paintSenateBanner is missing");
  process.exit(1);
}

function paint(data) {
  QC.paintSenateBanner(data);
  return visible(document);
}

let state = paint({
  senate_status: "blocked",
  senate_last_good_date: date,
  senate_handoff_date: "2026-09-01"
});
check(
  "blocked with a valid date shows Senate data as of <date>",
  state.shown && state.text === asOf && !state.text.includes("2026-09-01") && state.ariaLive === "polite",
  state.text
);

state = paint({ senate_status: "blocked", senate_handoff_date: "2026-09-01" });
check(
  "blocked without a valid date shows Senate data may be out of date",
  state.shown && state.text === fallback && state.ariaLive === "polite",
  state.text
);

state = paint({ senate_status: "blocked", senate_last_good_date: "2026-13-40" });
check("blocked with an impossible date uses the fallback", state.shown && state.text === fallback, state.text);

state = paint({ senate_status: "Blocked", senate_last_good_date: date });
check("Blocked still shows the banner", state.shown && state.text === asOf, state.text);

state = paint({ senate_status: "clear", senate_last_good_date: date });
check("clear hides the banner", !state.shown, state.shown ? state.text : "hidden");

state = paint({ senate_status: "CLEAR", senate_last_good_date: date });
check("CLEAR hides the banner", !state.shown, state.shown ? state.text : "hidden");

state = paint({ senate_status: "OK", senate_last_good_date: date });
check("OK hides the banner", !state.shown, state.shown ? state.text : "hidden");

state = paint({ senate_status: "" });
check("empty senate_status hides the banner", !state.shown, state.shown ? state.text : "hidden");

state = paint({ senate_status: "blocked", senate_last_good_date: date });
state = paint({ senate_status: "ok", senate_last_good_date: date });
check("ok hides the banner", !state.shown, state.shown ? state.text : "hidden");

state = paint({ senate_status: "blocked", senate_last_good_date: date });
state = paint({ senate_last_good_date: date, senate_handoff_date: "2026-09-01" });
check("missing senate_status hides the banner", !state.shown, state.shown ? state.text : "hidden");

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

for (const name of pages) {
  const html = fs.readFileSync(path.join(root, name), "utf8");
  check(name + " defines --caution and --ink", /--caution\s*:/.test(html) && /--ink\s*:/.test(html), "");
}
const shell = fs.readFileSync(path.join(root, "shell.css"), "utf8");
check("banner CSS uses --caution and --ink", /var\(--caution/.test(shell) && /var\(--ink/.test(shell), "");

console.log(lines.join("\n"));
if (failed) process.exit(1);
