#!/usr/bin/env node
/* Render the app in a REAL browser engine and look at the pixels.
 *
 * Take 23. For 22 takes the only "execution" was tools/smoke.mjs, which stubs
 * maplibregl entirely — so it could never see that MapLibre was REJECTING THE
 * WHOLE STYLE because the glyphs url was a data: URI instead of a template with
 * {fontstack}/{range}. The app shipped with every layer dead and the harness
 * said 25 assertions green (landmines 47, 51).
 *
 * This closes that hole: serve www/ over http, load it in headless Chrome,
 * collect console + map errors, wait for the map to go idle, then assert
 *   1. no style/map errors at all
 *   2. queryRenderedFeatures() is non-empty
 *   3. the canvas actually contains trail-coloured pixels, not just background
 *
 * Chrome is not Android WebView, so this does not prove the APK renders — it
 * proves the style and data are renderable, which is precisely what was broken.
 *
 *   node tools/render.mjs [--www www] [--shot out.png]
 */
import { createServer } from "node:http";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
let puppeteer;
try {
  puppeteer = (await import("puppeteer")).default;
} catch (e) {
  /* A clean checkout has no node_modules until `npm ci`. CI installs it before
     this step; a laptop may not have. Say which, rather than dying in an import
     and taking the pipeline with it (take 43). */
  console.log("render: puppeteer not installed — run `npm ci` first.");
  console.log("        Skipping; CI installs it and the gate fails there if absent.");
  process.exit(0);
}

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const wwwArg = opt("--www", "www");
const WWW = wwwArg.startsWith("/") ? wwwArg : join(ROOT, wwwArg);
const SHOT = opt("--shot", null);

let failures = 0;
const ok = (c, m) => { console.log((c ? "  ok   " : "  FAIL ") + m); if (!c) failures++; };

const TYPES = { ".html": "text/html", ".js": "application/javascript",
  ".css": "text/css", ".json": "application/json", ".jpg": "image/jpeg",
  ".png": "image/png", ".pbf": "application/x-protobuf" };

const server = createServer((req, res) => {
  if (req.url === "/favicon.ico") { res.writeHead(204); return res.end(); }
  const p = join(WWW, decodeURIComponent(req.url.split("?")[0]).replace(/^\//, "") || "index.html");
  if (!existsSync(p) || p.includes("..")) { res.writeHead(404); return res.end("404"); }
  res.writeHead(200, { "Content-Type": TYPES[extname(p)] || "application/octet-stream" });
  res.end(readFileSync(p));
});
/* Single-file builds have no bundle/ directory — everything is inlined — so the
   manifest is optional here and anchors fall back to the page's own BUNDLE. */
const manPath = join(WWW, "bundle/manifest.json");
const manifest = existsSync(manPath)
  ? JSON.parse(readFileSync(manPath, "utf8")) : {};
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
console.log(`render: serving ${WWW} on :${port}`);

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox",
         "--use-gl=swiftshader", "--enable-unsafe-swiftshader",
         "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
// Measure the screen the app RUNS on, not a desktop window. The harness used to
// run at 900x1400 — three times the area — so every label-density figure it
// reported was optimistic (landmine 87).
//
// The default is a mid-size Android phone, not one specific handset: this should
// work on whatever anyone brings, and the Fold cover screen it was tuned on is
// unusually narrow. LAYOUT is then checked across the range below.
const DEVICES = [
  { name: "small  (Galaxy S / Pixel a)", width: 360, height: 800, dpr: 3 },
  { name: "mid    (Pixel 8 / S24)", width: 412, height: 915, dpr: 2.6 },
  { name: "large  (Pro Max / Ultra)", width: 430, height: 932, dpr: 3 },
  { name: "fold   (cover screen)", width: 411, height: 960, dpr: 2.625 },
];
await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2.6 });

const consoleErrors = [], pageErrors = [], badRequests = [];
page.on("response", (r) => { if (r.status() >= 400) badRequests.push(r.status() + " " + r.url()); });
page.on("requestfailed", (r) => badRequests.push("FAILED " + r.url() + " " + (r.failure()||{}).errorText));
page.on("console", (m) => consoleErrors.push(m.type().toUpperCase() + ": " + m.text()));
page.on("pageerror", (e) => pageErrors.push(String(e.message)));

/* Do NOT wrap the Map constructor: doing so broke the map outright (no events,
   no layers, no errors) and produced a fake diagnosis. Observe, never intercept.
   The app exposes window.map; listeners attach as soon as it appears. */
await page.evaluateOnNewDocument(() => {
  window.__mapErrors = []; window.__evts = [];
  const iv = setInterval(() => {
    if (!window.map || !window.map.on) return;
    clearInterval(iv);
    for (const ev of ["load", "idle", "style.load", "sourcedata", "render"])
      window.map.on(ev, () => {
        if (window.__evts.filter((x) => x === ev).length < 2) window.__evts.push(ev);
      });
    window.map.on("error", (e) =>
      window.__mapErrors.push((e && e.error && e.error.message) || String(e)));
  }, 10);
});

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle0", timeout: 60000 });

/* the app does not expose `map`, so reach it the way the page does */
const ready = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 120; i++) {
    const m = window.map;
  if (!m) return { route: -1, alt: -1, approach: -1, threw: "no map" };
    if (m && m.loaded && m.loaded()) return true;
    await sleep(250);
  }
  return false;
});
await new Promise((r) => setTimeout(r, 3000));

const info = await page.evaluate(() => {
  const m = window.map;
  if (!m) return { route: -1, alt: -1, approach: -1, threw: "no map" };
  if (!m) return { noMap: true };
  let rendered = -1;
  try { rendered = m.queryRenderedFeatures().length; } catch (e) {}
  let st = null, styleErr = null;
  try { st = m.getStyle(); } catch (e) { styleErr = String(e.message); }
  const src = st && st.sources ? Object.keys(st.sources) : [];
  return { noMap: false, rendered, sources: src,
           glyphs: st ? st.glyphs : null, styleOK: !!st, styleErr,
           isStyleLoaded: (()=>{try{return m.isStyleLoaded()}catch(e){return "threw"}})(),
           evts: window.__evts || [], hasStyleObj: !!m.style,
           styleLoadedFlag: !!(m.style && m.style._loaded),
           layerCount: (()=>{try{return m.getLayersOrder().length}catch(e){return "n/a"}})(),
           errors: window.__mapErrors || [],
           badge: (document.getElementById("b-src") || {}).textContent };
});

if (process.env.RENDER_DEBUG) {
  console.log("── console ──");
  for (const c of consoleErrors.slice(0, 25)) console.log("   " + c.slice(0, 200));
  console.log("── bad requests ──");
  for (const b of badRequests.slice(0, 10)) console.log("   " + b.slice(0, 180));
  console.log("── pageerrors ──");
  for (const e of pageErrors.slice(0, 10)) console.log("   " + e.slice(0, 200));
  console.log("── ready:", ready, "| info:", JSON.stringify(info).slice(0, 300));
}
ok(pageErrors.length === 0, `no uncaught page errors${pageErrors.length ? ": " + pageErrors[0].slice(0, 90) : ""}`);
ok(badRequests.length === 0,
   `every resource loaded${badRequests.length ? ": " + badRequests[0].slice(0, 90) : ""}`);
ok(!info.noMap, "window.map exists");
if (!info.noMap) {
  const styleErrs = (info.errors || []).filter((e) => !/^Failed to fetch|AbortError/.test(e));
  ok(styleErrs.length === 0, `no map errors${styleErrs.length ? ": " + styleErrs[0].slice(0, 100) : ""}`);
  ok(info.glyphs && /\{fontstack\}/.test(info.glyphs), `glyphs url valid (${info.glyphs})`);
  ok(info.rendered > 0, `queryRenderedFeatures returned ${info.rendered}`);
  ok(info.badge !== "RENDER FAIL", `badge reads "${info.badge}"`);
}

/* The composited page screenshot, not a canvas readback: MapLibre runs with
   preserveDrawingBuffer:false, so drawImage() off-frame always yields black and
   the "blank map" it reports is an artefact of the test (take 23). Chrome
   composites the real WebGL output into page.screenshot().  */
const png = await page.screenshot({ type: "png" });
if (SHOT) writeFileSync(SHOT, png);

/* Features that must actually be ON SCREEN, by layer. queryRenderedFeatures with
   no filter proved *something* drew; this proves the specific things a rider
   depends on drew — trails and the labels that name them. Labels have their own
   failure mode (the glyph pack) that trail lines do not. */
const layers = await page.evaluate(() => {
  const m = window.map, out = {};
  if (!m) return { trails: -1, roads: -1, labels: -1 };
  const q = (ids) => { try { return m.queryRenderedFeatures({ layers: ids }).length; }
                       catch (e) { return -1; } };
  out.trails = q(["trail50", "route72", "moto24", "fstrail", "mccct"]);
  out.roads = q(["fsroad", "minor", "paved", "track"]);
  out.labels = q(["lbl-place", "lbl-trail"]);
  return out;
});
ok(layers.trails > 0, `trail layers rendered ${layers.trails} features`);
ok(layers.roads > 0, `road layers rendered ${layers.roads} features`);
ok(layers.labels > 0, `label layers rendered ${layers.labels} features (glyph pack works)`);

/* Trail names at riding zoom. At the overview zoom almost everything is culled
   by text-allow-overlap:false, so counting there says nothing about whether a
   rider can identify the trail under their wheels. */
/* Zoom to a real riding anchor, not the bbox centre. The centre of this region
   is farm roads with no moto trail on it, so asserting there reported "0 trail
   segments" on a perfectly good map — a test measuring the wrong place, which is
   the same family of self-inflicted bug as the drawImage and constructor-wrapper
   mistakes. Anchors marked 'site' are the riding areas. */
const anchors = (manifest.anchors && manifest.anchors.length)
  ? manifest.anchors
  : await page.evaluate(() => (window.PLACES || []).slice());
const site = (anchors || []).find((a) => a[3] === "site") || (anchors || [])[0];
const zoomed = await page.evaluate(async (at) => {
  const m = window.map, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  if (!m) return { trails: -1, trailLabels: -1, placeLabels: -1 };
  const c = m.getCenter();
  m.jumpTo({ center: at || [c.lng, c.lat], zoom: 14.5 });
  await sleep(2500);
  const q = (ids) => { try { return m.queryRenderedFeatures({ layers: ids }).length; }
                       catch (e) { return -1; } };
  const out = { trailLabels: q(["lbl-trail"]), placeLabels: q(["lbl-place"]),
                trails: q(["trail50", "route72", "moto24", "fstrail", "mccct"]) };
  m.jumpTo({ center: [c.lng, c.lat], zoom: 11.4 });
  await sleep(1200);
  return out;
}, site ? [site[1], site[2]] : null);
ok(zoomed.trails > 0,
   `z14.5 at ${site ? site[0] : 'centre'}: ${zoomed.trails} trail segments drawn`);
ok(zoomed.trails === 0 || zoomed.trailLabels > 0,
   `z14.5 at ${site ? site[0] : 'centre'}: ${zoomed.trailLabels} trail NAME labels — a rider can identify the trail`);

/* Satellite has never been proven to draw. It is a separate source type (image,
   blob url) from everything above, so it fails independently. */
const sat = await page.evaluate(async () => {
  const m = window.map;
  if (!m) return { noButton: true };
  if (!m) return { route: -1, alt: -1, approach: -1, threw: "no map" };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const btn = document.getElementById("c-base");
  if (!btn) return { noButton: true };
  const vis = () => { try { return m.getLayoutProperty("sat", "visibility"); }
                      catch (e) { return "err"; } };
  const before = vis();
  btn.click(); await sleep(1200);
  const afterOne = vis();
  btn.click(); await sleep(1200);
  const afterTwo = vis();
  btn.click(); await sleep(600);
  return { before, afterOne, afterTwo, back: vis(),
           label: (document.getElementById("c-base") || {}).textContent };
});
if (sat.noButton) ok(false, "basemap button present");
else {
  ok(sat.before === "none", `satellite hidden on the default basemap (${sat.before})`);
  ok(sat.afterOne === "visible", `one tap shows satellite (${sat.afterOne})`);
  ok(sat.afterTwo === "visible", `hybrid keeps satellite visible (${sat.afterTwo})`);
  ok(sat.back === "none", `cycling returns to Map (${sat.back})`);
}

/* Run the app's OWN self-test here, headless. Same battery Jacob runs by tapping
   one button on the Fold — so anything that differs between the two reports is
   device-specific by construction, which is the only kind of bug I cannot find
   from this container. GPS is skipped; there is no receiver here. */
const st = await page.evaluate(() => new Promise((res) => {
  if (!window.__selfTest) return res({ missing: true });
  window.__selfTest({ gps: false }, (rep) => res(rep));
}));
if (st.missing) ok(false, "app exposes __selfTest");
else {
  ok(st.fail === 0, `app self-test: ${st.pass} passed, ${st.fail} failed`);
  if (st.fail > 0)
    for (const line of st.text.split("\n").filter((l) => l.startsWith("  XX")))
      console.log("       " + line.trim());
  if (process.env.RENDER_DEBUG) console.log(st.text.split("\n").map(l=>"       "+l).join("\n"));
}

/* Route layers must RENDER, not merely receive data. Two features shipped for
   eight takes with their sources fed and no layer to draw them, and every check
   I had written measured setData (take 43). Only a real engine can answer
   "did it draw". */
/* A harness must survive the broken app it is diagnosing: with an invalid style
   there is no map, and throwing here turns "5 checks failed" into a stack trace
   that says nothing (take 43). */
const layers2 = await page.evaluate(async () => {
  try {
  const sl = (ms) => new Promise((r) => setTimeout(r, ms));
  const m = window.map;
  if (!m) return { route: -1, alt: -1, approach: -1, threw: "no map" };
  m.fire("contextmenu", { lngLat: { lng: -84.12855, lat: 44.53949 } }); await sl(200);
  const s1 = document.getElementById("pc-start"); if (s1) s1.click(); await sl(200);
  m.fire("contextmenu", { lngLat: { lng: -84.10724, lat: 44.55265 } }); await sl(200);
  const r1 = document.getElementById("pc-route"); if (r1) r1.click();
  /* Poll, do not sleep. A fixed 1.8s wait covered routing over a 16k-edge graph
     and stopped covering it the moment the network grew to 20k — the harness
     then reported "route line renders 0 features" on a perfectly good app
     (take 46). Wait for the thing, with a ceiling. */
  const qq = (id) => { try { return m.queryRenderedFeatures({ layers: [id] }).length; }
                       catch (e) { return 0; } };
  for (let i = 0; i < 60 && qq("routeline") === 0; i++) await sl(150);
  await sl(400);
  const q = (id) => { try { return m.queryRenderedFeatures({ layers: [id] }).length; }
                      catch (e) { return -1; } };
  return { route: q("routeline"), alt: q("alt-line"), approach: q("approach-line") };
  } catch (e) { return { route: -1, alt: -1, approach: -1, threw: String(e.message) }; }
});
ok(layers2.route > 0, `route line renders ${layers2.route} features`);
ok(layers2.alt > 0, `dimmed alternates render ${layers2.alt} features`);
ok(layers2.approach > 0, `dashed off-network legs render ${layers2.approach} features`);

/* The same layout checks the on-device self-test runs, across the phone sizes
   people actually own. A control that fits on a 430 px screen and slides off a
   360 px one is broken for half the users (take 65). */
for (const dev of DEVICES) {
  await page.setViewport({ width: dev.width, height: dev.height, deviceScaleFactor: dev.dpr });
  await new Promise((r) => setTimeout(r, 1200));
  const fit = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const wide = [];
    document.querySelectorAll("#shell *").forEach((e) => {
      const r = e.getBoundingClientRect();
      if (r.width > vw + 1) wide.push((e.id || e.className || e.tagName) + " " + Math.round(r.width));
    });
    const off = [];
    ["btn-home", "c-base", "c-labels", "coords"].forEach((id) => {
      const e = document.getElementById(id);
      if (!e) return;
      const r = e.getBoundingClientRect();
      if (!r.height) return;
      // A chip inside a horizontally scrolling strip is not off-screen, it is
      // scrolled — reaching it is one swipe. Only VERTICAL overflow strands a
      // control. Flagging c-labels on every size, including the one Jacob uses
      // daily, was the check being wrong (landmine 54, again).
      let scroller = e.parentElement;
      let inStrip = false;
      while (scroller && scroller !== document.body) {
        const ox = getComputedStyle(scroller).overflowX;
        if (ox === "auto" || ox === "scroll") { inStrip = true; break; }
        scroller = scroller.parentElement;
      }
      if (r.bottom > vh + 2 || r.top < -2) off.push(id + " (vertical)");
      else if (!inStrip && r.right > vw + 2) off.push(id + " (horizontal)");
    });
    return { wide, off, vw, vh };
  });
  ok(fit.wide.length === 0 && fit.off.length === 0,
     `${dev.name} ${dev.width}x${dev.height}: nothing overflows, controls reachable`
     + (fit.wide.length ? " — wide: " + fit.wide.join(", ") : "")
     + (fit.off.length ? " — off-screen: " + fit.off.join(", ") : ""));
}
await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2.6 });
await new Promise((r) => setTimeout(r, 800));

/* Pixel evidence. Feed the screenshot BACK into the page as an <img>, draw it to
   a 2D canvas and read it there: reading the WebGL canvas directly always
   returns black under preserveDrawingBuffer:false, which once made this harness
   report a blank map it had not actually measured (take 23). This path needs no
   extra dependency and measures what a person would see. */
const px = await page.evaluate(async (b64) => {
  const img = new Image();
  await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = "data:image/png;base64," + b64; });
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0);
  /* map viewport only — skip the header, chip strip and bottom panel */
  const y0 = Math.round(img.height * 0.16), y1 = Math.round(img.height * 0.62);
  const d = g.getImageData(0, y0, img.width, y1 - y0).data;
  const seen = new Map();
  for (let i = 0; i < d.length; i += 4) {
    const k = (d[i] >> 3) + "," + (d[i + 1] >> 3) + "," + (d[i + 2] >> 3);
    seen.set(k, (seen.get(k) || 0) + 1);
  }
  const total = d.length / 4;
  const top = [...seen.values()].sort((a, b) => b - a)[0];
  return { colors: seen.size, dominant: top / total };
}, png.toString("base64"));

ok(px.colors > 200, `map viewport has ${px.colors} distinct colours (a blank map is 1-3)`);
ok(px.dominant < 0.90,
   `busiest colour covers ${(100 * px.dominant).toFixed(1)}% — under 90% means terrain and trails drew`);
console.log(`       screenshot -> ${SHOT || "(not saved)"} (${(png.length/1024).toFixed(0)} KB)`);

await browser.close();
server.close();
console.log(failures ? `\nRENDER FAILED (${failures})` : "\nRENDER PASSED");
process.exit(failures ? 1 : 0);
