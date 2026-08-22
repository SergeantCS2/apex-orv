/* Ask the BROWSER whether the legend and the map agree.
 *
 * Take 77. The claim "the picker and the map read the same table" was made at
 * take 67 and was half true: the picker read a COPY. This asserts the finished
 * thing — the colour MapLibre paints versus the colour the swatch renders —
 * per row, from computed style, because a screenshot cannot tell 12.9 dE apart
 * and reading the source twice is how the drift survived ten takes.
 *
 *   node tools/verify_palette.mjs
 */
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

let puppeteer;
try { puppeteer = (await import("puppeteer")).default; }
catch { console.log("puppeteer absent — run `npm ci` first, skipping"); process.exit(0); }

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const WWW = join(ROOT, "www");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
               ".json": "application/json", ".jpg": "image/jpeg", ".pbf": "application/x-protobuf" };

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`  ${c ? "ok  " : "FAIL"} ${m}`); };

const srv = createServer((rq, rs) => {
  const p = join(WWW, decodeURIComponent(rq.url.split("?")[0]));
  if (!existsSync(p) || p.endsWith("/")) { console.log("  404 " + rq.url); rs.writeHead(404); return rs.end(); }
  rs.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
  rs.end(readFileSync(p));
}).listen(0);
const port = srv.address().port;

const browser = await puppeteer.launch({
  /* COPIED from render.mjs, not derived. Without --enable-unsafe-swiftshader
     modern Chrome refuses SwiftShader for WebGL, MapLibre never gets a context,
     and window.map never appears — with no page error to say so. My own args
     cost twenty minutes; PROTOCOL §3, copying beats deriving. */
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox",
         "--use-gl=swiftshader", "--enable-unsafe-swiftshader",
         "--disable-dev-shm-usage"] });
const page = await browser.newPage();
/* A probe that says "no map" without saying WHY is a verdict, not evidence
   (landmine 55). */
const pageErrors = [], consoleErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
page.on("requestfailed", (r) => consoleErrors.push("REQFAIL " + r.url().slice(-60)));
await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2.6 });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle0" });
/* Poll for the map to APPEAR and then to load. `networkidle0` fires before the
   app has finished reading its bundle, so window.map does not exist yet — my
   first version assumed it did and threw, accusing a perfectly good page
   (landmine 54, for the tenth time). Same wait render.mjs uses. */
const ready = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 120; i++) {
    const m = window.map;
    if (!m) { await sleep(250); continue; }
    if (m.loaded && m.loaded()) return true;
    await sleep(250);
  }
  /* Distinguish the two failures. "map appeared and finished loading" as one
     verdict cannot tell "never constructed" from "constructed, never loaded",
     and those have completely different causes (landmine 55). */
  return window.map ? "constructed but never loaded" : "never constructed";
});
if (ready !== true) {
  console.log("  state:         " + ready);
  console.log("  page errors:   " + (pageErrors[0] || "(none)"));
  console.log("  console errors:" + (consoleErrors.slice(0,3).join(" | ") || "(none)"));
}
ok(ready === true, "map appeared and finished loading");
await new Promise((r) => setTimeout(r, 2500));

/* 1 · the swatches, rendered, against the paint the map actually uses */
const rows = await page.evaluate(() => {
  const norm = (s) => {
    if (!s) return null;
    if (s.startsWith("#")) {
      const h = s.slice(1);
      return `rgb(${parseInt(h.slice(0,2),16)}, ${parseInt(h.slice(2,4),16)}, ${parseInt(h.slice(4,6),16)})`;
    }
    return s.replace(/\s+/g, " ").trim();
  };
  const btn = document.getElementById("c-act");
  if (btn) btn.click();                       // open the picker so it renders
  const panel = document.getElementById("actpanel");
  if (panel) panel.hidden = false;
  const out = [];
  document.querySelectorAll(".actrow").forEach((el) => {
    const sw = el.querySelector(".sw");
    const cs = getComputedStyle(sw);
    out.push({
      label: el.textContent.trim(),
      tappable: !!(el.dataset && el.dataset.k),
      tier: el.className.includes("tierrow"),
      swatch: cs.backgroundColor === "rgba(0, 0, 0, 0)" ? norm(cs.color) : norm(cs.backgroundColor),
      height: Math.round(el.getBoundingClientRect().height),
    });
  });
  /* what MapLibre paints, straight off the style */
  const paint = {};
  for (const id of ["route72", "trail50", "fstrail", "mccct", "moto24",
                    "track", "fsroad", "minor", "paved", "closed"]) {
    try { paint[id] = norm(window.map.getPaintProperty(id, "line-color")); } catch { }
  }
  const showExpr = window.map.getPaintProperty("show-line", "line-color");
  return { out, paint, showExpr, PAL: window.PAL || null };
});

console.log("\n1 · legend swatch vs the colour MapLibre paints");
const EXPECT = {
  "easy · 72\" route": "route72", "moderate · 50\" trail": "trail50",
  "difficult · 24\" / MCCCT": "mccct", "Two-track": "track",
  "forest road · drivable": "fsroad", "closed · do not ride": "closed",
};
for (const r of rows.out) {
  const key = EXPECT[r.label];
  if (!key) continue;
  const want = rows.paint[key];
  ok(r.swatch === want,
     `${r.label.padEnd(26)} swatch ${r.swatch} = map ${want}`);
}

console.log("\n2 · show-only colours come from the same table");
const flat = JSON.stringify(rows.showExpr);
for (const r of rows.out) {
  if (!/Hiking|Equestrian|Snowmobile|NFS/.test(r.label)) continue;
  const hex = r.swatch.match(/\d+/g).map(n => (+n).toString(16).padStart(2, "0")).join("");
  ok(flat.toLowerCase().includes("#" + hex),
     `${r.label.padEnd(26)} swatch ${r.swatch} appears in the show-line expression`);
}

console.log("\n3 · legend-only rows explain, they do not filter");
const tiers = rows.out.filter(r => r.tier);
ok(tiers.length >= 4, `${tiers.length} tier rows rendered`);
ok(tiers.every(r => !r.tappable), "no tier row is tappable (no data-k)");
ok(rows.out.filter(r => !r.tier).every(r => r.tappable),
   "every non-tier row IS tappable");
ok(rows.out.filter(r => !r.tier).every(r => r.height >= 36),
   "every real control is still >= 36 px for gloves");

console.log("\n4 · the fsroad casing draws");
const drew = await page.evaluate(() => {
  window.map.jumpTo({ center: window.PALTEST_CENTRE || [-84.09, 44.57], zoom: 13.5 });
  return new Promise((r) => window.map.once("idle", () => {
    const q = (id) => { try { return window.map.queryRenderedFeatures({ layers: [id] }).length; } catch { return -1; } };
    r({ fsroad: q("fsroad"), casing: q("casing-fsroad"),
        track: q("track"), casingTrack: q("casing-track") });
  }));
});
ok(drew.fsroad > 0, `fsroad draws ${drew.fsroad} features`);
ok(drew.casing > 0, `casing-fsroad draws ${drew.casing} features`);
ok(drew.casing === drew.fsroad,
   `casing covers every fsroad feature (${drew.casing} = ${drew.fsroad})`);

await browser.close();
srv.close();
console.log(fail ? `\nPALETTE FAILED (${fail})` : `\nPALETTE PASSED — ${pass} checks`);
process.exit(fail ? 1 : 0);
