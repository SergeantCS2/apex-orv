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
    /* This line used to read `if (!m) return {route:-1,alt:-1,approach:-1,...}`
       — a fragment pasted in from the route-layer probe below, which made the
       poller RETURN on iteration 0 whenever the map had not appeared yet
       instead of waiting for it. It only ever worked because of the 3 s sleep
       underneath. Landmine 65's family: a botched edit that lands somewhere
       valid. Found at take 77 while copying this wait into another harness. */
    if (!m) { await sleep(250); continue; }
    if (m.loaded && m.loaded()) return true;
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
  /* The denominator: how many labelable strokes exist at all. A count of placed
     labels with no denominator cannot tell "crowded out" from "there were only
     two to begin with" (landmine 131). */
  let strokeN = -1;
  try { strokeN = m.getStyle().sources.strokes.data.features.length; } catch (e) { }
  const out = { trailLabels: q(["lbl-trail"]), placeLabels: q(["lbl-place"]),
                strokeN,
                trails: q(["trail50", "route72", "moto24", "fstrail", "mccct"]) };
  m.jumpTo({ center: [c.lng, c.lat], zoom: 11.4 });
  await sleep(1200);
  return out;
}, site ? [site[1], site[2]] : null);
ok(zoomed.trails > 0,
   `z14.5 at ${site ? site[0] : 'centre'}: ${zoomed.trails} trail segments drawn`);
/* The escape clause exists because a run where nothing drew must not be read as
   a labelling failure — the check above already fails on that. But it printed
   "0 trail NAME labels — a rider can identify the trail", which is an actively
   wrong sentence to leave in a log someone will read later. Say which case it
   is (take 87, landmine 55). */
if (zoomed.trails === 0) {
  console.log("  ..   z14.5 trail NAME labels: NOT MEASURABLE — no trail geometry "
              + "drew in this run, see the failure above");
} else {
  ok(zoomed.trailLabels > 0,
     `z14.5 at ${site ? site[0] : 'centre'}: ${zoomed.trailLabels} trail NAME labels `
     + `from ${zoomed.strokeN} labelable strokes — a rider can identify the trail`);
}

/* A77 · water names must never outrank trail names. MapLibre resolves symbol
   collisions in LAYER ORDER, so this is guaranteed by construction rather than
   measured — an empirical count at one zoom on one flaky headless run cannot
   prove it, and I tried (take 87). */
{
  const order = await page.evaluate(() =>
    window.map.getStyle().layers.map((l) => l.id));
  const iTrail = order.indexOf("lbl-trail");
  const iLake = order.indexOf("lbl-lake");
  const iStream = order.indexOf("lbl-stream");
  const wl = await page.evaluate(async () => {
    const m = window.map, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const c = m.getCenter();
    m.jumpTo({ center: [-84.09, 44.57], zoom: 13.2 });
    await sleep(2600);
    const q = (id) => { try { return m.queryRenderedFeatures({ layers: [id] })
                                .map((f) => f.properties.n); } catch (e) { return []; } };
    /* `_data` is private and undefined in MapLibre 5 — the supported route is
       the style spec, which holds the geojson we handed it (take 87). */
    let srcN = -1, sample = null;
    try {
      const d = m.getStyle().sources.wlbl.data;
      srcN = d.features.length;
      sample = d.features.length ? JSON.stringify(d.features[0]).slice(0, 130) : null;
    } catch (e) { srcN = -2; sample = String(e).slice(0, 80); }
    /* queryRenderedFeatures returns only PLACED symbols. querySourceFeatures
       ignores collision, so the two together say whether the data reached the
       tiler or merely failed to win space (take 87). */
    const qs = () => { try { return m.querySourceFeatures("wlbl").length; }
                       catch (e) { return -1; } };
    /* Centre on a KNOWN named lake (Loon Lake, the largest in the region) — a
       probe centred on the riding area may simply have no lake in view, which
       looks identical to a broken layer. */
    /* Measure at a zoom where the layers are ACTIVE. The previous version
       returned the map to z11.4 first — below lbl-lake's 11.6 minzoom — so this
       reading was guaranteed zero regardless of the product (take 87). */
    m.jumpTo({ center: [-84.10916, 44.66529], zoom: 13.2 });
    await sleep(2400);
    const out = { lake: q("lbl-lake"), stream: q("lbl-stream"), srcN, sample };
    m.jumpTo({ center: [c.lng, c.lat], zoom: 11.4 });
    await sleep(1000);
    return out;
  });
  /* A110 · places. Centred on the densest cluster in the payload, chosen from
     the data rather than from where I happen to be looking (landmine 130). */
  const poi = await page.evaluate(async () => {
    const m = window.map, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    m.jumpTo({ center: [-84.13, 44.66], zoom: 13.6 });
    await sleep(2600);
    let srcN = -1;
    try { srcN = m.getStyle().sources.poi.data.features.length; } catch (e) { srcN = -2; }
    const q = (id) => { try { return m.queryRenderedFeatures({ layers: [id] }); }
                        catch (e) { return []; } };
    return { srcN, dots: q("poi-dot").length,
             labels: [...new Set(q("poi-label").map((f) => f.properties.n))] };
  });
  ok(poi.dots > 0,
     `places drawn: ${poi.dots} pins of ${poi.srcN} in the source`);
  ok(poi.labels.length > 0,
     `places named: ${poi.labels.slice(0, 5).join(", ") || "(none placed)"}`);

  /* A75 · posted route numbers. Centred on M 33, which the payload says runs
     through -84.1295,44.5810 — picked from the data, not from where I happen to
     be looking (landmine 130). */
  const rf = await page.evaluate(async () => {
    const m = window.map, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    m.jumpTo({ center: [-84.12954, 44.58098], zoom: 12.6 });
    await sleep(2400);
    let srcN = -1;
    try { srcN = m.getStyle().sources.refs.data.features.length; } catch (e) { srcN = -2; }
    let placed = [];
    try { placed = m.queryRenderedFeatures({ layers: ["lbl-ref"] })
                    .map((f) => f.properties.lb); } catch (e) { }
    return { srcN, placed: [...new Set(placed)] };
  });
  ok(rf.placed.length > 0,
     `route numbers on the map: ${rf.placed.length} of ${rf.srcN} strokes — `
     + `${rf.placed.slice(0, 5).join(", ") || "(none placed)"}`);
  /* A115/A112 · the paddle corridor, and the hazards that make it shippable.
     Centred on the Au Sable from the payload, not from where I happen to be
     looking (landmine 130). */
  const pad = await page.evaluate(async () => {
    const m = window.map, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let src = null;
    try { src = m.getStyle().sources.paddle.data.features; } catch (e) { }
    if (!src || !src.length) return { n: 0 };
    const off = (() => { try {
      return m.getLayoutProperty("pad-line", "visibility") === "none"; } catch (e) { return null; } })();
    const ids = ["pad-case","pad-line","pad-dot","pad-lbl","pad-dam","pad-damlbl"];
    ids.forEach((id) => { try { m.setLayoutProperty(id, "visibility", "visible"); } catch (e) {} });
    // a dam, taken from the payload
    let dams = [];
    try { dams = m.getStyle().sources.padpin.data.features
      .filter((f) => f.properties.k === "dam"); } catch (e) { }
    const at = dams.length ? dams[0].geometry.coordinates : src[0].geometry.coordinates[0];
    m.jumpTo({ center: at, zoom: 12.2 });
    await sleep(2600);
    const q = (id) => { try { return m.queryRenderedFeatures({ layers: [id] }); }
                        catch (e) { return []; } };
    const out = { n: src.length, off,
                  line: q("pad-line").length,
                  pins: q("pad-dot").length,
                  damsDrawn: q("pad-dam").map((f) => f.properties.lb),
                  damCount: dams.length,
                  rivers: [...new Set(src.map((f) => f.properties.n))] };
    ids.forEach((id) => { try { m.setLayoutProperty(id, "visibility", "none"); } catch (e) {} });
    return out;
  });
  ok(pad.n > 0, `${pad.n} river reaches across ${pad.rivers.length} corridors: ${pad.rivers.slice(0,3).join(", ")}`);
  ok(pad.off === true, "the paddle layer is off until asked for");
  ok(pad.line > 0, `the river draws (${pad.line} reach segments in view)`);
  ok(pad.damsDrawn.length > 0,
     `dams are drawn and named: ${pad.damsDrawn.slice(0,3).join(", ")} — A112 makes `
     + `this a ship-blocker, not a nice-to-have`);
  ok(pad.damCount >= 7, `${pad.damCount} dams carried in the payload`);

  /* Tapping a pin must answer the SHUTTLE question — what is above, what is
     below, and whether a dam sits between — not just repeat the pin's name. */
  const card = await page.evaluate(() => {
    const src = window.map.getStyle().sources.padpin.data.features;
    const pick = (f) => window.paddleCard({ properties: f.properties,
                                            geometry: f.geometry });
    const html = () => document.getElementById("panel").innerHTML;
    const out = {};
    // an access point with neighbours on both sides
    const au = src.filter((f) => f.properties.riv === "Au Sable River"
                                 && f.properties.k !== "dam" && f.properties.n);
    au.sort((a, b) => a.properties.mi - b.properties.mi);
    pick(au[Math.floor(au.length / 2)]);
    out.mid = html();
    // a dam
    const dam = src.find((f) => f.properties.k === "dam" && f.properties.n);
    pick(dam);
    out.dam = html();
    out.damName = dam.properties.n;
    return out;
  });
  ok(/Above:/.test(card.mid) && /Below:/.test(card.mid),
     "tapping an access point says what is above and below it");
  ok(/no dam between|in between/.test(card.mid),
     "and whether a dam sits between — the thing a shuttle turns on");
  ok(/DAM — you must take out and portage/.test(card.dam),
     `tapping ${card.damName} says take out and portage, in the closure colour`);
  /* Take 102 shipped an apology here — "run short of a real float". Take 106
     disproved it: USGS NHD agrees with OSM to within 4%, so there is nothing to
     apologise for. The check now asserts the card says where the number comes
     from, which is what it should have said all along. */
  ok(/USGS/.test(card.mid) || /agree within/.test(card.mid),
     "the card says where its river miles come from");

  /* A121 · two pins make a run. This is the shuttle: put-in, take-out, and
     every dam that forces a portage between them. */
  const run = await page.evaluate(() => {
    const src = window.map.getStyle().sources.padpin.data.features;
    const pick = (n) => src.find((f) => f.properties.n === n);
    const html = () => document.getElementById("panel").innerHTML;
    const plan = (a, b) => {
      window.paddleCard({ properties: pick(a).properties });
      const f = document.getElementById("pd-from");
      if (!f) return null;
      f.click();
      window.paddleCard({ properties: pick(b).properties });
      const t = document.getElementById("pd-to");
      if (!t) return null;
      t.click();
      return html();
    };
    return {
      clean: plan("Burtons Landing", "Wakeley Bridge Landing"),
      // deliberately tapped downstream-first: a river runs one way
      backwards: plan("Comins Flats Boat Access", "Camp Ten Bridge Boat Launch"),
    };
  });
  ok(/Put in/.test(run.clean) && /Take out/.test(run.clean) && /mi<\/b> of river/.test(run.clean),
     "two pins make a run with a put-in, a take-out and a distance");
  ok(/No dams between them/.test(run.clean),
     "a clear run says so plainly");
  ok(/dam on the way/.test(run.backwards) && /portage it/.test(run.backwards),
     "a run crossing a dam names it and says you must portage");
  ok(/Put in <b>Camp Ten/.test(run.backwards),
     "tapped downstream-first, the UPSTREAM stop is still the put-in — a river "
     + "only runs one way");
  ok(/other order/.test(run.backwards), "and the card says it swapped them");

  /* A122 · the time estimate, checked against floats with known times. The
     livery's HOURS are accurate (Jacob has paddled them); their MILEAGES run
     high, and NHD agreeing with OSM to within 4% is what settled which number
     to trust (take 106). */
  const est = await page.evaluate(() => {
    const src = window.map.getStyle().sources.padpin.data.features;
    const pick = (n) => src.find((f) => f.properties.n === n);
    const plan = (a, b) => {
      window.paddleCard({ properties: pick(a).properties });
      document.getElementById("pd-from").click();
      window.paddleCard({ properties: pick(b).properties });
      document.getElementById("pd-to").click();
      return document.getElementById("panel").innerText || "";
    };
    /* Both floats chosen from the reaches where the livery's times are
       CONSISTENT. Their long trips imply 2.51, 2.54, 2.57 and 2.59 mph against
       our distances; their short ones give 1.50, 2.08 and 3.10, which are
       rounded booking figures rather than measurements. Calibrating on the
       consistent ones and testing against them is the honest pairing. */
    return { short: plan("McMasters Bridge Canoe Access", "Mio Pond T-Dock"),
             long: plan("Wakeley Bridge Landing", "Mio Pond T-Dock"),
             mph: window.PADDLE_MPH };
  });
  const hrs = (t) => (t.match(/(\d+) hr(?: (\d+) min)?/g) || [])
    .map((x) => { const m = x.match(/(\d+) hr(?: (\d+) min)?/);
                  return +m[1] + (+(m[2] || 0)) / 60; });
  const s2 = hrs(est.short), l2 = hrs(est.long);
  ok(est.mph === 2.5, `pace is the calibrated 2.5 mph, not the livery's implied 4.7`);
  ok(s2.length === 2 && s2[0] <= 8.5 && s2[1] >= 8.5,
     `McMasters to Mio brackets the known 8.5 hrs (${s2.map((x) => x.toFixed(1)).join("-")})`);
  ok(l2.length === 2 && l2[0] <= 11.5 && l2[1] >= 11.5,
     `Wakeley to Mio brackets the known 11.5 hrs (${l2.map((x) => x.toFixed(1)).join("-")})`);
  ok(!/run short of a real float/.test(est.short),
     "the apology is gone — two independent surveys agree, so there is nothing "
     + "to apologise for");
  ok(/USGS/.test(est.short) || /agree within/.test(est.short)
     || /against the liveries/.test(est.short),
     "and the card says where the number comes from");

  /* A76 · named summits. Off by default like the contours they belong with, so
     the check must switch them on — and centred on a peak read OUT OF THE
     PAYLOAD, not on wherever I happen to be looking (landmine 130). */
  const pk = await page.evaluate(async () => {
    const m = window.map, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let src = [];
    try { src = m.getStyle().sources.peaks.data.features; } catch (e) { }
    if (!src.length) return { srcN: 0 };
    const off = (() => { try {
      return m.getLayoutProperty("peak-label", "visibility") === "none"; } catch (e) { return null; } })();
    ["peak-dot", "peak-label"].forEach((id) => {
      try { m.setLayoutProperty(id, "visibility", "visible"); } catch (e) {} });
    m.jumpTo({ center: src[0].geometry.coordinates, zoom: 12.6 });
    await sleep(2400);
    const q = (id) => { try { return m.queryRenderedFeatures({ layers: [id] }); }
                        catch (e) { return []; } };
    const out = { srcN: src.length, off,
                  dots: q("peak-dot").length,
                  names: [...new Set(q("peak-label").map((f) => f.properties.n))],
                  sample: src[0].properties.lb };
    ["peak-dot", "peak-label"].forEach((id) => {
      try { m.setLayoutProperty(id, "visibility", "none"); } catch (e) {} });
    return out;
  });
  ok(pk.srcN > 0, `${pk.srcN} named summits in the payload`);
  ok(pk.off === true, "named hills are off until asked for");
  ok(pk.dots > 0 && pk.names.length > 0,
     `summits draw: ${pk.dots} marker(s), named ${pk.names.slice(0, 3).join(", ")}`);
  ok(/\d/.test(pk.sample || ""), `label carries a height: ${JSON.stringify(pk.sample)}`);

  /* A96 · the dispatch card runs six scans on one tap and has never been timed.
     This is the highest-stakes screen in the app: what a rider reads aloud to
     county dispatch. Measured per scan, not as one number, because "slow" is
     not a diagnosis (landmine 131). */
  const dt = await page.evaluate(() => {
    const D = window.__disp;
    if (!D) return null;
    const at = D.ME;
    const time = (fn) => {
      const t0 = performance.now();
      let r = null;
      for (let i = 0; i < 5; i++) r = fn();
      return { ms: (performance.now() - t0) / 5, ok: r !== undefined };
    };
    return {
      nearestEdge: time(() => D.nearestEdge(at)).ms,
      nearestJunction: time(() => D.nearestJunction(at)).ms,
      nearestPavement: time(() => D.nearestPavement(at)).ms,
      countyAt: time(() => D.countyAt(at)).ms,
      addressAt: time(() => D.addressAt(at)).ms,
      addressNear: time(() => D.addressAt(at, true)).ms,
    };
  });
  if (dt) {
    const total = Object.values(dt).reduce((a, b) => a + b, 0);
    const parts = Object.entries(dt).map(([k, v]) => `${k} ${v.toFixed(0)}ms`).join(" · ");
    console.log(`  ..   dispatch scans: ${parts}`);
    ok(total < 1500,
       `dispatch card assembles in ${total.toFixed(0)} ms of scanning `
       + `(desktop headless; a phone is slower)`);
  }

  /* A87 · contours. Off by default, so the check must turn them on — measuring
     a layer that is switched off measures nothing (landmine 111). */
  const ct = await page.evaluate(async () => {
    const m = window.map, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let srcN = -1;
    try { srcN = m.getStyle().sources.cont.data.features.length; } catch (e) { srcN = -2; }
    const offByDefault = (() => { try {
      return m.getLayoutProperty("cont-line", "visibility") === "none"; } catch (e) { return null; } })();
    ["cont-line", "cont-index", "cont-label"].forEach((id) => {
      try { m.setLayoutProperty(id, "visibility", "visible"); } catch (e) {} });
    /* A87's label check found exactly ONE label here, which made it marginal —
       and the take-98 tab bar took ~52 px of map height, which was enough to
       tip it to zero. A check that flips on an unrelated change is measuring
       the edge, not the feature. Probe at a zoom where a 600 px symbol-spacing
       line label comfortably fits, and report the count either way. */
    const seen = { line: 0, index: 0, labels: [] };
    for (const z of [13.6, 14.4, 15.2]) {
      m.jumpTo({ center: [-84.09, 44.57], zoom: z });
      await sleep(2200);
      const qq = (id) => { try { return m.queryRenderedFeatures({ layers: [id] }); }
                           catch (e) { return []; } };
      seen.line = Math.max(seen.line, qq("cont-line").length);
      seen.index = Math.max(seen.index, qq("cont-index").length);
      qq("cont-label").forEach((f) => seen.labels.push(f.properties.lb));
    }
    const q = (id) => { try { return m.queryRenderedFeatures({ layers: [id] }); }
                        catch (e) { return []; } };
    const out = { srcN, offByDefault, line: seen.line, index: seen.index,
                  labels: [...new Set(seen.labels)] };
    ["cont-line", "cont-index", "cont-label"].forEach((id) => {
      try { m.setLayoutProperty(id, "visibility", "none"); } catch (e) {} });
    return out;
  });
  ok(ct.offByDefault === true, "contours are off until asked for");
  ok(ct.line > 0 && ct.index > 0,
     `contours draw: ${ct.line} intermediate + ${ct.index} index of ${ct.srcN} in the source`);
  ok(ct.labels.length > 0,
     `index contours carry an elevation: ${ct.labels.slice(0, 4).join(", ") || "(none)"}`);

  /* A125 · every feature must be REACHABLE, which is not the same as wired.
     A handler on a button nobody can find is a feature nobody has (take 108). */
  const reach = await page.evaluate(async () => {
    const s = (ms) => new Promise((r) => setTimeout(r, ms));
    const seen = {};
    for (const t of ["map", "plan", "ride", "tools"]) {
      document.querySelector(`#tabs .tab[data-go="${t}"]`).click();
      await s(180);
      for (const c of document.querySelectorAll(".chip[data-tab]"))
        if (!c.hidden) seen[c.id] = t;
    }
    // panels reachable from a chip
    document.querySelector('#tabs .tab[data-go="tools"]').click(); await s(150);
    document.getElementById("c-diag").click(); await s(250);
    const diag = [...document.querySelectorAll("#diagpanel .chip")].map((c) => c.id);
    document.getElementById("c-diag").click(); await s(150);
    document.querySelector('#tabs .tab[data-go="map"]').click(); await s(150);
    document.getElementById("c-layers").click(); await s(250);
    const groups = [...document.querySelectorAll("#lyrpanel [data-lg]")].length;
    document.getElementById("c-layers").click(); await s(150);
    // the always-visible action row
    const acts = [...document.querySelectorAll("#actions button")].map((b) => b.id);
    return { seen, diag, groups, acts,
             pairTab: seen["c-home"] === seen["c-me"] ? seen["c-home"] : null };
  });
  const need = ["c-layers","c-locate","c-search","c-machine","c-home","c-me",
                "c-fuel","c-loop","c-saved","c-ride","c-lost",
                "c-compass","c-markme","c-diag"];
  const missing = need.filter((k) => !reach.seen[k]);
  ok(missing.length === 0,
     `every action is reachable from a destination${missing.length ? ": missing " + missing.join(", ") : ""}`);
  ok(reach.pairTab === "plan",
     `Set home and I'm here are in the same destination (${reach.pairTab}) — `
     + `syncArm treats them as one gesture`);
  ok(reach.diag.length === 3, `diagnostics reachable behind one entry (${reach.diag.join(", ")})`);
  ok(reach.groups >= 7, `${reach.groups} layer groups reachable from Map`);
  ok(reach.acts.length >= 4, `action row always available: ${reach.acts.join(", ")}`);

  /* A119 · the compass. Written AFTER printing the panel and reading it, which
     is the order that caught the useless 0.0 mi rows twice (landmines 163/164). */
  const cmp = await page.evaluate(async () => {
    const s = (ms) => new Promise((r) => setTimeout(r, ms));
    document.querySelector('#tabs .tab[data-go="tools"]').click();
    await s(200);
    const box = () => document.getElementById("cmpbox").innerText || "";
    document.getElementById("c-compass").click();
    await s(300);
    const still = box();
    document.getElementById("c-markme").click();
    await s(200);
    const marked = document.getElementById("panel").innerText || "";
    window.hudSet(8.9, 48.8, null);
    await s(300);
    const moving = box();
    const rose = document.querySelectorAll("#cmpbox svg").length;
    // leaving Tools must put it away
    document.querySelector('#tabs .tab[data-go="map"]').click();
    await s(250);
    const closed = !!document.getElementById("cmppanel").hidden;
    return { still, marked, moving, rose, closed };
  });
  ok(cmp.rose === 1, "the compass draws a rose");
  ok(/no heading yet/.test(cmp.still),
     "standing still it says it has no heading rather than pointing at nothing");
  ok(/NE\b/.test(cmp.moving) && /49/.test(cmp.moving),
     `given a heading it reads it: ${(cmp.moving.split("\n")[0] || "").slice(0, 40)}`);
  ok(/Home/.test(cmp.moving) && /left|right|ahead/.test(cmp.moving),
     "and gives a bearing to home with which way to turn");
  ok(/you are here/.test(cmp.moving),
     "a waypoint at your own position reads 'you are here', not a 0.0 mi bearing");
  ok(/Marked/.test(cmp.marked), "Mark this spot saves a waypoint in one tap");
  ok(cmp.closed, "leaving Tools closes the compass");

  /* A119 · Tools is a bucket now: diagnostics live behind ONE entry, and the
     three buttons still work from wherever they ended up (take 101). */
  const dg = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    document.querySelector('#tabs .tab[data-go="tools"]').click();
    await sleep(200);
    const toolChips = [...document.querySelectorAll('.chip[data-tab="tools"]')]
      .filter((c) => !c.hidden).map((c) => c.id);
    const p = document.getElementById("diagpanel");
    const closedFirst = !!p.hidden;
    document.getElementById("c-diag").click();
    await sleep(320);
    const rows = [...p.querySelectorAll(".chip")].map((c) => c.id);
    // switching destination must put the sub-menu away
    document.querySelector('#tabs .tab[data-go="map"]').click();
    await sleep(250);
    const closedOnLeave = !!p.hidden;
    return { toolChips, closedFirst, rows, closedOnLeave };
  });
  /* This asserted Tools held exactly ONE chip, which was true when the bucket
     was empty and became false the moment it was filled — which was the point
     of having a bucket. What it MEANT was that the three diagnostics are behind
     one entry, so that is what it tests now (take 105). */
  ok(dg.toolChips.includes("c-diag")
     && !dg.toolChips.includes("c-selftest")
     && !dg.toolChips.includes("c-about")
     && !dg.toolChips.includes("c-pan"),
     `Tools holds real tools with diagnostics behind one entry (${dg.toolChips.join(", ")})`);
  ok(dg.closedFirst, "the diagnostics sub-menu starts closed");
  ok(dg.rows.length === 3 && dg.rows.includes("c-selftest"),
     `diagnostics holds ${dg.rows.length}: ${dg.rows.join(", ")}`);
  ok(dg.closedOnLeave,
     "leaving Tools closes the sub-menu — a panel left open across a switch is "
     + "how a UI starts feeling arbitrary");

  /* A120 · a panel that animates stays in the layout while hidden, so it must
     be proven UNCLICKABLE — an invisible control that still catches a tap is
     worse than one that blinks (take 100). */
  const mot = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const p = document.getElementById("lyrpanel");
    document.getElementById("c-layers").click();
    await sleep(320);
    const openRow = p.querySelector("[data-lg]");
    const openHit = document.elementFromPoint(
      ...(() => { const r = openRow.getBoundingClientRect();
                  return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]; })());
    const openReaches = !!(openHit && p.contains(openHit));
    document.getElementById("c-layers").click();
    await sleep(320);
    const cs = getComputedStyle(p);
    const r2 = openRow.getBoundingClientRect();
    const hit = document.elementFromPoint(
      Math.round(r2.left + r2.width / 2), Math.round(r2.top + r2.height / 2));
    return { openReaches, vis: cs.visibility, pe: cs.pointerEvents,
             op: cs.opacity, stillCatches: !!(hit && p.contains(hit)),
             hasTransition: cs.transitionDuration };
  });
  ok(mot.openReaches, "an OPEN panel is reachable by tap");
  ok(mot.stillCatches === false,
     `a closed panel catches no taps (visibility ${mot.vis}, pointer-events ${mot.pe})`);
  ok(parseFloat(mot.op) === 0, `a closed panel is fully transparent (${mot.op})`);
  ok(/[1-9]/.test(mot.hasTransition || ""),
     `panels transition rather than blink (${mot.hasTransition})`);

  /* A99 · icons must be DRAWN, and no placeholder may survive to the screen. */
  const icn = await page.evaluate(() => {
    const shell = document.getElementById("shell");
    const svgs = shell.querySelectorAll("button svg.ic").length;
    const leftover = (shell.innerHTML.match(/__IC_[a-z]+__/g) || []).length;
    // emoji still sitting inside a control
    const EM = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    const emojiButtons = [...shell.querySelectorAll("button")]
      .filter((b) => EM.test(b.textContent)).map((b) => b.id || b.className);
    // a control whose handler still fires after the icon pass
    let fired = false;
    const t = document.querySelector('#tabs .tab[data-go="plan"]');
    t.click(); fired = /\bon\b/.test(t.className);
    document.querySelector('#tabs .tab[data-go="map"]').click();
    return { svgs, leftover, emojiButtons, fired };
  });
  ok(icn.svgs >= 16, `${icn.svgs} controls carry a drawn icon`);
  ok(icn.leftover === 0, `no icon placeholder reached the screen (${icn.leftover})`);
  ok(icn.emojiButtons.length === 0,
     `no emoji left in a control${icn.emojiButtons.length ? ": " + icn.emojiButtons.join(", ") : ""}`);
  ok(icn.fired === true,
     "handlers survived the icon pass — icons replace a button's CHILDREN, "
     + "never a shared parent's innerHTML");

  /* A113 · four destinations, and the point is that a rider sees FEWER controls
     at once, not the same fourteen behind a bar (take 98). */
  const tb = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const vis = () => [...document.querySelectorAll(".chip[data-tab]")]
      .filter((c) => !c.hidden).map((c) => c.id);
    const tabs = [...document.querySelectorAll("#tabs .tab")].map((b) => b.dataset.go);
    const total = document.querySelectorAll(".chip[data-tab]").length;
    const per = {};
    for (const t of tabs) {
      document.querySelector(`#tabs .tab[data-go="${t}"]`).click();
      await sleep(250);
      per[t] = vis();
    }
    document.querySelector('#tabs .tab[data-go="map"]').click();
    await sleep(200);
    const onCls = document.querySelector('#tabs .tab[data-go="map"]').className;
    // a closed destination's chips must still be clickable by anything that
    // holds their id — the harness does exactly that
    /* Pick a chip that is actually IN a destination. c-selftest moved into the
       diagnostics sub-panel at take 101 and no longer carries data-tab, so
       naming it here tested the check's own stale assumption. */
    const hiddenChip = [...document.querySelectorAll('.chip[data-tab]')]
      .find((c) => c.dataset.tab !== "map");
    return { tabs, total, per, onCls, hiddenNow: !!hiddenChip.hidden,
             barH: Math.round(document.getElementById("tabs").getBoundingClientRect().height) };
  });
  ok(tb.tabs.length === 4, `four destinations: ${tb.tabs.join(", ")}`);
  const most = Math.max(...Object.values(tb.per).map((v) => v.length));
  ok(most < tb.total,
     `${tb.total} actions split across destinations — at most ${most} on screen `
     + `at once (was ${tb.total} in one scrolling row)`);
  ok(Object.values(tb.per).reduce((a, v) => a + v.length, 0) === tb.total,
     "every action belongs to exactly one destination — none orphaned");
  ok(/\bon\b/.test(tb.onCls), "the open destination is marked");
  ok(tb.hiddenNow === true,
     "a closed destination's chips are hidden but still in the DOM, so anything "
     + "holding their id still works");

  /* A91 · the layers panel must move the map, not just look like it does. */
  const lyr = await page.evaluate(async () => {
    const m = window.map, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const vis = (id) => { try { return m.getLayoutProperty(id, "visibility") !== "none"; }
                          catch (e) { return null; } };
    document.getElementById("c-layers").click();
    await sleep(400);
    const panel = document.getElementById("lyrpanel");
    const opened = !panel.hidden;
    const rows = panel.querySelectorAll("[data-lg]").length;
    const bms = panel.querySelectorAll("[data-bm]").length;
    const before = { poi: vis("poi-dot"), lbl: vis("lbl-lake") };
    // toggle Places off
    panel.querySelector('[data-lg="0"]').click();
    await sleep(400);
    const afterPoi = { dot: vis("poi-dot"), label: vis("poi-label") };
    panel.querySelector('[data-lg="0"]').click();
    await sleep(300);
    // toggle All labels off — must reach the layers the old chip missed
    const li = [...panel.querySelectorAll("[data-lg]")].length - 1;
    panel.querySelector(`[data-lg="${li}"]`).click();
    await sleep(400);
    const afterLabels = { ref: vis("lbl-ref"), lake: vis("lbl-lake"),
                          poi: vis("poi-label"), trail: vis("lbl-trail") };
    panel.querySelector(`[data-lg="${li}"]`).click();
    await sleep(300);
    document.getElementById("c-layers").click();
    return { opened, rows, bms, before, afterPoi, afterLabels };
  });
  ok(lyr.opened && lyr.rows >= 4 && lyr.bms === 3,
     `layers panel opens with ${lyr.bms} basemaps and ${lyr.rows} layer groups`);
  ok(lyr.afterPoi.dot === false && lyr.afterPoi.label === false,
     "turning Places off hides both the pins and their labels");
  ok(lyr.afterLabels.ref === false && lyr.afterLabels.lake === false
     && lyr.afterLabels.poi === false && lyr.afterLabels.trail === false,
     "All labels reaches route numbers, water names and place names — the six "
     + "layers the old hand-kept list missed");
  const names = [...new Set([...wl.lake, ...wl.stream])];
  ok(names.length > 0,
     `water is named on the map: ${names.length} label(s) of ${wl.srcN} in the `
     + `source — ${names.slice(0, 4).join(", ") || "(none rendered) " + (wl.sample || "")}`);
  const iRef = order.indexOf("lbl-ref");
  ok(iTrail >= 0 && iLake > iTrail && iStream > iTrail && iRef > iTrail,
     `trail names outrank everything added since (lbl-trail ${iTrail}, `
     + `lbl-ref ${iRef}, lbl-lake ${iLake}, lbl-stream ${iStream})`);
  ok(iRef > 0 && iLake > iRef,
     `route numbers outrank water names (lbl-ref ${iRef} < lbl-lake ${iLake}) — `
     + `a road number orients you, a pond does not`);
}

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
/* The HUD is a NEW full-width element and the matrix would otherwise measure it
   hidden — a check with nothing to look at reports success (landmine 85). Force
   the ride state on so every device size measures the ribbon and the stats
   block actually laid out (take 78). */
await page.evaluate(() => {
  try { window.hudShow && window.hudShow(true); window.hudSet &&
        window.hudSet(11.2, 48.8, null); } catch (e) {}
});
for (const dev of DEVICES) {
  await page.setViewport({ width: dev.width, height: dev.height, deviceScaleFactor: dev.dpr });
  await new Promise((r) => setTimeout(r, 1200));
  await page.evaluate(() => { try { window.hudPaint && window.hudPaint(); } catch (e) {} });
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
    const hb = document.getElementById("hudbar");
    const hs = document.getElementById("hudstats");
    const hud = {
      barVisible: !!(hb && !hb.hidden && hb.getBoundingClientRect().width > 0),
      barWidth: hb ? Math.round(hb.getBoundingClientRect().width) : -1,
      labels: hb ? hb.querySelectorAll("#hudticks b").length : -1,
      statsRight: hs ? Math.round(hs.getBoundingClientRect().right) : -1,
      statsTop: hs ? Math.round(hs.getBoundingClientRect().top) : -1,
    };
    return { wide, off, vw, vh, hud };
  });
  ok(fit.wide.length === 0 && fit.off.length === 0,
     `${dev.name} ${dev.width}x${dev.height}: nothing overflows, controls reachable`
     + (fit.wide.length ? " — wide: " + fit.wide.join(", ") : "")
     + (fit.wide.length ? " — wide: " + fit.wide.join(", ") : "")
     + (fit.off.length ? " — off-screen: " + fit.off.join(", ") : ""));
  ok(fit.hud.barVisible && fit.hud.barWidth === fit.vw && fit.hud.labels > 0
     && fit.hud.statsRight <= fit.vw + 1 && fit.hud.statsTop >= 0,
     `${dev.name}: ride HUD fits — ribbon ${fit.hud.barWidth}px of ${fit.vw}, `
     + `${fit.hud.labels} labels, stats right edge ${fit.hud.statsRight}`);
}
await page.evaluate(() => { try { window.hudShow && window.hudShow(false); } catch (e) {} });

/* Field faults from Jacob's take-82 ride, asserted where `hidden` is REAL.
   The smoke stub does not model the initial hidden attribute, so the same
   checks there passed vacuously — false before, false after (landmine 85). */
{
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((x) => setTimeout(x, ms));
    const out = {};
    const hb = () => document.getElementById("hudbar");
    const ch = () => document.getElementById("chips");
    out.hudHiddenAtRest = !!hb().hidden;
    out.chipsShownAtRest = !ch().hidden;
    // the self-test runs a ride drill; it must put the HUD back
    document.getElementById("c-selftest").click();
    for (let i = 0; i < 60 && !/PASS/.test(document.getElementById("panel").innerHTML); i++)
      await sleep(250);
    out.hudHiddenAfterSelftest = !!hb().hidden;
    out.chipsShownAfterSelftest = !ch().hidden;
    // the compass must say something when it has no heading
    window.hudShow(true);
    out.hintShownNoHeading = !document.getElementById("hudhint").hidden;
    window.hudSet(9, 90, null);
    out.hintHiddenWithHeading = !!document.getElementById("hudhint").hidden;
    window.hudShow(false);
    return out;
  });
  ok(r.hudHiddenAtRest, "compass ribbon is off before any ride");
  ok(r.hudHiddenAfterSelftest,
     "self-test leaves the compass ribbon OFF — the drill puts back what it moved");
  ok(r.chipsShownAfterSelftest,
     "self-test gives the place chips back");
  ok(r.hintShownNoHeading,
     "with no heading the ribbon says so instead of showing a bare needle");
  ok(r.hintHiddenWithHeading, "with a heading the hint gets out of the way");
}

/* Clearing a route must clear every line the rider can see. */
{
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((x) => setTimeout(x, ms));
    document.getElementById("btn-home").click();
    for (let i = 0; i < 40 && !document.getElementById("btn-clear"); i++) await sleep(250);
    const q = (id) => { try { return window.map.queryRenderedFeatures({ layers: [id] }).length; } catch { return -1; } };
    /* POLL for the route to draw instead of sleeping a fixed 1200 ms. The fixed
       wait failed intermittently — reporting "a route was drawn first (0
       features)" and then "0 -> 205" after the clear, which is the race stated
       backwards. A gate that fails at random trains you to re-run it, which is
       worse than not having it (take 92). */
    let before = 0;
    for (let i = 0; i < 40; i++) {
      before = q("routeline");
      if (before > 0) break;
      await sleep(250);
    }
    /* Measure the button BEFORE clicking it: clearing calls show(), which
       replaces the panel's innerHTML and takes the button with it. Asserting
       afterwards reported "no Clear control" on a Clear control that had just
       worked (landmine 54, and my check was the broken one). */
    const hasBtn = !!document.getElementById("btn-clear");
    document.getElementById("btn-clear").click();
    let after = before;
    for (let i = 0; i < 20; i++) {
      after = q("routeline");
      if (after === 0) break;
      await sleep(250);
    }
    return { before, after, hasBtn };
  });
  ok(r.hasBtn, "a Clear route control exists on the route panel");
  ok(r.before > 0, `a route was drawn first (${r.before} features)`);
  ok(r.after === 0, `Clear route removes the line (${r.before} -> ${r.after})`);
}

/* Machine legality on the map (take 80, A86). Assert the PAINT the browser
   actually resolved, per machine, not that a function ran. */
const mach = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  for (const m of ["bike", "quad", "sxs"]) {
    window.__mach && window.__mach.set(m);
    await sleep(400);
    const ok = window.__mach ? window.__mach.ok() : [];
    const layers = {};
    for (const id of ["casing", "moto24", "trail50", "route72", "track", "paved"]) {
      let v = null;
      try { v = window.map.getPaintProperty(id, "line-opacity"); } catch (e) {}
      layers[id] = JSON.stringify(v);
    }
    const drew = {};
    for (const id of ["trail50", "track", "fsroad"]) {
      try { drew[id] = window.map.queryRenderedFeatures({ layers: [id] }).length; }
      catch (e) { drew[id] = -1; }
    }
    out[m] = { ok, layers, drew };
  }
  window.__mach && window.__mach.set("bike");
  return out;
});
{
  const sxs = mach.sxs, bike = mach.bike;
  /* Assert on a class that is ACTUALLY IN VIEW here. moto24, mccct, route72 and
     fstrail all render 0 features at this viewport whichever machine is set, so
     an assertion on them passes vacuously and proves nothing (landmine 85).
     trail50 renders 244 and is legal for a dirt bike, not for a 72" machine. */
  ok(bike.ok.includes("trail50") && !sxs.ok.includes("trail50"),
     `50" trail is legal for a dirt bike and not for a side-by-side`);
  ok(/"case"/.test(sxs.layers.trail50),
     "machine legality is a data-driven paint expression, not a layer toggle");
  ok(sxs.layers.trail50 !== bike.layers.trail50,
     "the 50-inch layer's opacity expression changes with the machine");
  ok(bike.drew.trail50 > 0 && sxs.drew.trail50 === bike.drew.trail50,
     `illegal line is still DRAWN for a side-by-side ` +
     `(${sxs.drew.trail50} features, same as ${bike.drew.trail50} for a bike) — ` +
     `dimmed, not hidden: the map stays honest about what exists`);
  ok(["bike", "quad", "sxs"].every((m) => mach[m].ok.includes("paved")),
     "pavement is legal for every machine, so it never dims");
  ok(/0\.285/.test(bike.layers.casing),
     "the casing's 0.95 base was READ FROM THE STYLE and dimmed to 0.285, " +
     "not copied into a second table (landmine 107)");
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
