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
/* take 187 · A211 — .svg/.woff2/.png/.webp were served as octet-stream */
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
               ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png",
               ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2",
               ".pbf": "application/x-protobuf" };

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
// an explicit limit: Chrome's 30 s default left about 1.3-1.9x over run 90's load (INFERRED; landmine 235)
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle0", timeout: 120000 });
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
const readRows = () => page.evaluate(() => {
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
      tag: el.tagName,
      swatch: cs.backgroundColor === "rgba(0, 0, 0, 0)" ? norm(cs.color) : norm(cs.backgroundColor),
      /* take 188 · A215 · the laid-out height, not the drawn one: the picker
         opens with a scale(.98) entrance that headless Chrome leaves pending
         until a frame is drawn (landmine 224), so a 48 px row read 47 */
      height: el.offsetHeight,
    });
  });
  /* what MapLibre paints, straight off the style */
  const paint = {};
  for (const id of ["route72", "trail50", "fstrail", "mccct", "moto24",
                    "track", "fsroad", "minor", "paved", "closed"]) {
    try { paint[id] = norm(window.map.getPaintProperty(id, "line-color")); } catch { }
  }
  const showExpr = window.map.getPaintProperty("show-line", "line-color");
  const base = ((document.querySelector("#c-base span") || {}).textContent || "").trim();
  return { out, paint, showExpr, base, PAL: window.PAL || null };
});
const rows = await readRows();

console.log("\n1 · legend swatch vs the colour MapLibre paints");
const EXPECT = {
  "easy · 72\" route": "route72", "moderate · 50\" trail": "trail50",
  "difficult · 24\" / MCCCT": "mccct", "Two-track": "track",
  "forest road · drivable": "fsroad", "closed · do not ride": "closed",
};
/* take 187 · A211 — a legend row whose label no longer matches used to be
   skipped in silence, so renaming one retired its check. Every expected row
   must now be present; the lookup is proved on a planted rename first. */
const missingOf = (labels) => Object.keys(EXPECT).filter((l) => !labels.includes(l));
ok(missingOf(Object.keys(EXPECT).map((l, i) => i ? l : l + " (renamed)")).length === 1,
   "a planted renamed legend row is reported missing (the check's negative control)");
const compare = (R) => {
  const miss = missingOf(R.out.map((r) => r.label));
  ok(miss.length === 0, `[${R.base}] every legend row is present${miss.length ? " — missing: " + miss.join(", ") : ""}`);
  for (const r of R.out) {
    const key = EXPECT[r.label];
    if (!key) continue;
    const want = R.paint[key];
    ok(r.swatch === want,
       `[${R.base}] ${r.label.padEnd(26)} swatch ${r.swatch} = map ${want}`);
  }
};
compare(rows);

/* take 187 · A211 — A202 said this check held each basemap; it only ever ran
   on Map. Hybrid now gets the same comparison. */
const onHybrid = await page.evaluate(async () => {
  const s = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 4; i++) {
    const l = ((document.querySelector("#c-base span") || {}).textContent || "").trim();
    if (l === "Hybrid") return true;
    const b = document.getElementById("c-base"); if (!b) return false; b.click(); await s(1200);
  }
  return false;
});
ok(onHybrid, "the basemap chip reaches Hybrid");
if (onHybrid) compare(await readRows());
/* back to Map: the checks below were written against it */
await page.evaluate(async () => {
  const s = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 4; i++) {
    const l = ((document.querySelector("#c-base span") || {}).textContent || "").trim();
    if (l === "Map") return; const b = document.getElementById("c-base"); if (!b) return; b.click(); await s(1200);
  }
});

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
/* take 188 · A215 · a legend row is a div, not a button: nothing reads it
   as an undersized control; and the V4 floor, 48 px (was 36). Both judges
   are proved on planted copies of the real rows first (landmine 54; review
   round 1: neither had a negative control): one tier row as a BUTTON, one
   real control at 47 px, each must be rejected. */
const tierDiv = (R) => R.filter(r => r.tier).every(r => r.tag === "DIV");
const floor48 = (R) => R.filter(r => !r.tier).every(r => r.height >= 48);
const plantRow = (pick, patch) => { const c = rows.out.map((r) => ({ ...r })); const i = c.findIndex(pick);
  if (i >= 0) Object.assign(c[i], patch); return i >= 0 ? c : null; };
const pTier = plantRow((r) => r.tier, { tag: "BUTTON" }), pLow = plantRow((r) => !r.tier, { height: 47 });
ok(!!pTier && !tierDiv(pTier) && !!pLow && !floor48(pLow),
   "the tier-div and 48 px judges reject their plants (a tier row as BUTTON, a real control at 47 px)");
ok(tierDiv(rows.out), `every tier row is a div (${[...new Set(tiers.map(r => r.tag))].join(", ")})`);
ok(rows.out.filter(r => !r.tier).every(r => r.tappable),
   "every non-tier row IS tappable");
ok(floor48(rows.out),
   `every real control is >= 48 px for gloves (smallest ${Math.min(...rows.out.filter(r => !r.tier).map(r => r.height))} px)`);

console.log("\n4 · the fsroad casing draws");
/* take 189 seal · the judge was `casing count === fsroad count` over the whole
   viewport. queryRenderedFeatures hit-tests a line by its stroke, so a forest
   road lying wholly off the canvas, 1 px past its edge, is reported by the
   wider casing (about 2.4 px at z13.5) and not by the 1.3 px road: the §6b clean
   run's fresh data put edge 142782 there and read 25 = 24 with every road
   cased (PROVEN at the seal, twice; landmine 247, A246).
   The claim is unchanged and judged by feature, both ways: every road drawn
   has its casing, and a casing the road does not report must be a forest
   road lying wholly off the canvas. Its three plants must fail first. */
const drew = await page.evaluate(() => {
  window.map.jumpTo({ center: window.PALTEST_CENTRE || [-84.09, 44.57], zoom: 13.5 });
  return new Promise((r) => window.map.once("idle", () => {
    const m = window.map, W = m.getCanvas().clientWidth, H = m.getCanvas().clientHeight;
    const q = (id) => { try { return m.queryRenderedFeatures({ layers: [id] }); } catch { return null; } };
    const key = (f) => (f.properties.c || "") + "|" + (f.properties.i ?? "") + "|" + JSON.stringify(f.geometry.coordinates);
    /* does the feature's geometry touch the canvas? a vertex inside, or a
       segment crossing one of its four edges (both ends outside) */
    const inR = (p) => p.x >= 0 && p.y >= 0 && p.x <= W && p.y <= H;
    const cross = (a, b) => { const ts = [];
      if (a.x !== b.x) ts.push((0 - a.x) / (b.x - a.x), (W - a.x) / (b.x - a.x));
      if (a.y !== b.y) ts.push((0 - a.y) / (b.y - a.y), (H - a.y) / (b.y - a.y));
      return ts.some((t) => t >= 0 && t <= 1 && inR({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) })); };
    const touches = (f) => { const g = f.geometry, L = g.type === "LineString" ? [g.coordinates]
        : g.type === "MultiLineString" ? g.coordinates : null; if (!L) return true;
      for (const line of L) { const P = line.map((c) => m.project(c));
        for (let i = 0; i < P.length; i++) { if (inR(P[i])) return true; if (i && cross(P[i - 1], P[i])) return true; } }
      return false; };
    const F = q("fsroad"), C = q("casing-fsroad");
    r({ fsroad: F ? F.length : -1, casing: C ? C.length : -1,
        fsK: (F || []).map(key), cas: (C || []).map((f) => ({ k: key(f), c: f.properties.c, on: touches(f) })) });
  }));
});
/* judge: a multiset of road keys against the casing list */
const casingJudge = (fsK, cas) => {
  const left = new Map(); for (const c of cas) left.set(c.k, (left.get(c.k) || 0) + 1);
  let missing = 0; for (const k of fsK) { const n = left.get(k) || 0; if (n) left.set(k, n - 1); else missing++; }
  const extra = cas.filter((c) => { const n = left.get(c.k) || 0; if (n) { left.set(c.k, n - 1); return true; } return false; });
  const stray = extra.filter((c) => c.c !== "fsroad" || c.on);
  return { missing, extra: extra.length, stray: stray.length, ok: missing === 0 && stray.length === 0 };
};
ok(drew.fsroad > 0, `fsroad draws ${drew.fsroad} features`);
ok(drew.casing > 0, `casing-fsroad draws ${drew.casing} features`);
{ const one = drew.cas.findIndex((c) => drew.fsK.includes(c.k));
  const pMiss = drew.cas.filter((_, i) => i !== one);
  const pOn = drew.cas.concat([{ k: "fsroad|planted|on", c: "fsroad", on: true }]);
  const pCls = drew.cas.concat([{ k: "track|planted|off", c: "track", on: false }]);
  /* and the geometry test is live: the casings of roads drawn on screen read as on the canvas */
  const onN = drew.cas.filter((c) => drew.fsK.includes(c.k) && c.on).length;
  ok(one >= 0 && onN > 0 && !casingJudge(drew.fsK, pMiss).ok && !casingJudge(drew.fsK, pOn).ok && !casingJudge(drew.fsK, pCls).ok,
     `the casing judge rejects its plants (a road with its casing removed, a casing on the canvas the road does not draw, an off-canvas casing of another class); ${onN} drawn roads' casings read as on the canvas`); }
const cj = casingJudge(drew.fsK, drew.cas);
ok(cj.ok,
   `casing covers every fsroad feature (${drew.fsroad} roads, ${cj.missing} without a casing; ${cj.extra} more casing feature(s), ${cj.stray} of them on the canvas or of another class)`);

await browser.close();
srv.close();
console.log(fail ? `\nPALETTE FAILED (${fail})` : `\nPALETTE PASSED — ${pass} checks`);
process.exit(fail ? 1 : 0);
