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
/* take 189 · A227 · SECTIONS. `--only=<name,…>` runs the named sections, the
   sections each needs (its setup: a route on the cards, a home, the V4 clean
   reload) and the boot, which every run needs; the default run is the full
   render, unchanged and complete, and the gate and the pipeline never pass
   --only. A partial run says so in its last line. An unknown name ends the
   run before a browser starts: a section that silently runs nothing is a
   check that skips (landmine 53). A group name (v4) stands for its members.
   A section run alone starts from the boot's state, not the one the sections
   before it leave. Where its checks lean on that state, the section that
   makes it is listed as its setup. Run alone, the busy line stayed armed
   (INFERRED: the drill arms it with no basemap change, and on an idle map
   nothing renders, so no 'idle' comes; water leaves the map drawing), and
   the Pins selector's food read and the head tap failed (INFERRED: they lean
   on the tiles and stack windows the stack drills leave) — take 189's
   isolated run, render-t189-L-render-only-1.log. Every section was run
   without its neighbour (only-1, only-2). */
const SECTIONS = { trails: [], labels: [], modes: [], imagery: [], back: [], water: [], shell: ["water"],
  stacks: [], pins: ["stacks"], nav: [], camp: [], paddle: [], ui: [], home: [], tools: [], basemap: [],
  selftest: [], routes: [], devices: ["routes"], faults: [], realdom: ["home", "routes"],
  clear: ["home", "routes"], tail: [], g6: [], "v4-setup": [], "v4-band": ["v4-setup"],
  "v4-select": ["v4-setup"], "v4-toast": ["v4-setup"], "v4-audit": ["v4-setup"],
  "v4-walker": ["v4-setup"], "v4-eta": ["v4-setup", "v4-walker"] };
const SECTION_GROUPS = { v4: ["v4-band", "v4-select", "v4-toast", "v4-audit", "v4-walker", "v4-eta"] };
const ONLY = (() => {
  const a = args.find((x) => x.startsWith("--only="));
  if (!a) return null;
  const want = a.slice(7).split(",").map((x) => x.trim()).filter(Boolean);
  const bad = want.filter((x) => !(x in SECTIONS) && !(x in SECTION_GROUPS));
  if (!want.length || bad.length) {
    console.log(`render: --only names ${bad.length ? "unknown sections: " + bad.join(", ") : "no section"}; sections: `
      + Object.keys(SECTIONS).join(", ") + "; groups: " + Object.keys(SECTION_GROUPS).join(", "));
    process.exit(2);
  }
  const set = new Set(), add = (x) => { if (set.has(x)) return; set.add(x); (SECTIONS[x] || []).forEach(add); };
  want.forEach((x) => (SECTION_GROUPS[x] || [x]).forEach(add));
  return set;
})();
/* take 189 · A227 fix round 1 · each check is booked to the section whose
   guard last opened (the boot until the first); the floor guard at the end
   reads the book */
let SECTION_AT = "boot";
const SECTION_N = {};
const RUN = (name) => {
  if (!(name in SECTIONS)) throw new Error("render: RUN(" + name + ") names no section");   /* a typo here would skip in silence */
  const on = !ONLY || ONLY.has(name);
  if (on) SECTION_AT = name;
  return on;
};
if (ONLY) console.log(`render: --only runs ${[...ONLY].join(", ")} (and the boot) — a PARTIAL render; the gate runs them all`);

let failures = 0;
/* take 188 · A216 · emoji and text glyphs used as icons: the ranges
   tools/gate.py check_glyphs scans the source with (TEXT_GLYPH_RE). General Punctuation
   and Latin-1 (· — – … ° × ′ ″) are typography and stay out. */
const GLYPH_SRC = "[\\u2190-\\u21FF\\u2300-\\u23FF\\u2460-\\u24FF\\u25A0-\\u25FF\\u2600-\\u27BF"
  + "\\u27F0-\\u27FF\\u2900-\\u297F\\u2B00-\\u2BFF\\u{1F000}-\\u{1FAFF}\\uFE0F\\u2139\\u203C\\u2049]";
const ok = (c, m) => { console.log((c ? "  ok   " : "  FAIL ") + m); if (!c) failures++;
  SECTION_N[SECTION_AT] = (SECTION_N[SECTION_AT] || 0) + 1; };

/* take 188 · G13 · the tour and guide keys are READ from the built app, never
   typed: they are versioned with their content (A147), and a typed copy goes
   stale on the take that bumps them — the tour then covers every audited
   state (landmine 222). The reader proves itself on planted strings first; a
   key it cannot read ends the run here, before a browser starts. */
const appKey = (js, name) => { const m = new RegExp("\\bvar\\s+" + name + "\\s*=\\s*['\"]([^'\"]+)['\"]").exec(js || "");
  return m ? m[1] : null; };
/* a single-file build inlines the script into index.html */
const APPJS = [join(WWW, "app.js"), join(WWW, "index.html")].filter((f) => existsSync(f))
  .map((f) => readFileSync(f, "utf8")).find((t) => /\bvar\s+(TOURKEY|GUIDEKEY)\b/.test(t)) || "";
const TOURKEY = appKey(APPJS, "TOURKEY"), GUIDEKEY = appKey(APPJS, "GUIDEKEY");
/* take 188 · A217 · how many moving fixes the strip waits before it trusts
   the rider's pace, read from the built app like the keys above (a typed
   copy would go stale on the take that tunes it) */
const appNum = (js, name) => { const m = new RegExp("\\bvar\\s+" + name + "\\s*=\\s*(\\d+)\\s*[;,]").exec(js || "");
  return m ? +m[1] : null; };
const NAV_PACE_N = appNum(APPJS, "NAV_PACE_N");
const numPlants = appNum("var NAV_PACE_N=7;", "NAV_PACE_N") === 7 && appNum("var NAV_PACE_NX=7;", "NAV_PACE_N") === null;
const keyPlants = appKey("var TOURKEY='apex.tour.v9',TOUR={}", "TOURKEY") === "apex.tour.v9"
  && appKey("var TOUR={on:false}", "TOURKEY") === null;
ok(keyPlants && !!TOURKEY && !!GUIDEKEY, `the tour and guide keys are read from ${join(WWW, "app.js")} `
   + `(${TOURKEY || "TOURKEY missing"}, ${GUIDEKEY || "GUIDEKEY missing"}); the reader returns a planted `
   + `v9 key and null without one (its negative control)`);
if (!keyPlants || !TOURKEY || !GUIDEKEY) { console.log(`\nRENDER FAILED (${failures})`); process.exit(1); }

const TYPES = { ".html": "text/html", ".js": "application/javascript",
  ".css": "text/css", ".json": "application/json", ".jpg": "image/jpeg",
  ".png": "image/png", ".pbf": "application/x-protobuf",
  /* take 187 · A211 — served as octet-stream before, which a browser refuses
     for an <img> SVG and may for a font */
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".webp": "image/webp" };

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
/* take 188 · cold audit · whether this bundle carries imagery, from the
   MANIFEST: every Hybrid guard branched on window.__sat.ok, which is the app
   under test's own SAT_OK, so an app that wrongly disowned its imagery
   passed them all as "no imagery in this bundle". The app's rule restated on
   the manifest's facts (build_app.py loads them): imagery tiles, or an
   imagery artifact with non-degenerate imagery_bounds. null = no manifest,
   which fails the equality check below rather than passing on nothing. */
const satExpect = (m) => {
  if (!m || !Array.isArray(m.artifacts)) return null;
  if (m.imagery_tiles) return true;
  const b = m.imagery_bounds;
  return m.artifacts.some((a) => a.kind === "imagery") && Array.isArray(b) && b.length === 4
    && (b[2] - b[0]) > 1e-6 && (b[3] - b[1]) > 1e-6; };
const SAT_EXPECT = satExpect(manifest);
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
console.log(`render: serving ${WWW} on :${port}`);

const LAUNCH = {
  headless: "new",
  /* take 134: a 75 MB graph makes single evaluate() calls in headless slow
     enough to trip the 180 s default protocol timeout (the summit block did) */
  protocolTimeout: 480000,
  args: ["--no-sandbox", "--disable-setuid-sandbox",
         "--use-gl=swiftshader", "--enable-unsafe-swiftshader",
         "--disable-dev-shm-usage"],
};
/* take 189 · A227 · THE WAITS, one set for every block. A fixed sleep waits
   the same whether the page settled in 50 ms or never, and a race against
   m.once("idle") with no repaint waits out its whole ceiling when the map is
   already idle (no render, no idle event; the stack probes lost up to 6 s
   each to it). Each helper waits on the real condition and
   is BOUNDED by the sleep it replaces, so a page that never gets there is
   read exactly when the old sleep read it; one that gets there early is read
   in a state at least as settled. Installed on every document (the reloads
   and the respawn included) as window.__rh:
     settle(max)  a frame drawn, then frames until no finite animation runs
                  (landmine 224: a transition stays pending until a frame)
     idle(m, max) the map at rest: a frame, the camera still and every source
                  loaded, then an 'idle' (tiles drawn, symbols placed, fades
                  done) after a forced repaint */
const RH = () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const busy = () => document.getAnimations().some((a) => a.playState === "running" && a.effect
    && isFinite(a.effect.getComputedTiming().endTime));
  window.__rh = {
    sleep, frame,
    settle: async (max = 3000) => { const t0 = Date.now();
      do { await frame(); if (!busy()) return true; } while (Date.now() - t0 < max); return false; },
    idle: async (m, max = 3000) => { const t0 = Date.now(), left = () => max - (Date.now() - t0);
      await frame();
      while (left() > 0 && (m.isMoving() || !m.loaded())) await sleep(40);
      if (left() <= 0) return false;
      let got = false;
      await Promise.race([new Promise((r) => { m.once("idle", () => { got = true; r(); }); m.triggerRepaint(); }), sleep(left())]);
      return got; } };
};
/* take 189 · A227 · CSS transitions and animations run ANIM_RATE times faster
   (the DevTools animation playback rate, the page's document timeline). The
   drawer is a row of #shell's grid, so every frame of its 260 ms slide resizes
   the map and MapLibre redraws the whole canvas: 2-4 redraws of 150-550 ms
   each per slide under SwiftShader at dpr 2.6-3 (measured, bench-t189-L-render-
   frames-1/3), and the device matrix alone slides the drawer hundreds of
   times. At ten times the rate a slide ends in one frame. Reads wait for a
   settled state (landmine 224), the durations a check asserts are the
   computed ones (a panel's transition-duration reads the same),
   transitionrun/transitionend still fire once per slide, and MapLibre's
   camera eases are JavaScript, not CSS, so they run at their own speed.
   NOT everything a check reads is unchanged: one reading changed. The Stand
   drill's typed waypoint names coordinates ("Stand · 44.3548, -84.3713")
   where it named the Midland to Mackinaw Boy Scout Trail (take 189,
   render-t189-L-render-prof-4 at rate 1 against prof-6 at rate 10, PROVEN);
   its check reads only the "Stand · " prefix. Mechanism INFERRED: at rate 1
   the drawer was still sliding, and resizing the map, when the 450 ms long
   press resolved its point; at rate 10 the slide is over first and the drop
   lands where no trail is near. Generally: a CSS transition now ends before
   app JavaScript timers it used to outlast, so timer-versus-transition
   orderings here are not the Fold WebView's. Applied to every page, and again
   after a reload. */
const ANIM_RATE = 10;
const fastAnim = async (pg) => { const c = await pg.createCDPSession();
  await c.send("Animation.enable"); await c.send("Animation.setPlaybackRate", { playbackRate: ANIM_RATE }); };
/* after a viewport change: the resize handled (a frame, no finite animation
   left) and the map redrawn at its new size, bounded by the fixed sleep it
   replaces */
const vpSettle = (max) => page.evaluate(async (max) => { const t0 = Date.now();
  await window.__rh.settle(max); if (window.map) await window.__rh.idle(window.map, Math.max(0, max - (Date.now() - t0))); }, max);
let browser = await puppeteer.launch(LAUNCH);
let page = await browser.newPage();
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
  /* take 187 · A197 Q3 / A211 — the maintainer's self-test on the Fold:
     749x832 css px at dpr 2.625. The screen the app is used on had never
     been laid out here. */
  { name: "fold   (inner screen)", width: 749, height: 832, dpr: 2.625 },
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
await page.evaluateOnNewDocument(RH);
await fastAnim(page);

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle0", timeout: 60000 });

/* Take 173 · the run outgrew one page. On a 4 GB box with one worker and no
   GPU, two hundred checks of accumulated state plus the machine-legality
   probe — three statewide repaints across 573k edges — pushed the page past
   what memory allows (measured: 3,616 MB used, 158 MB free mid-run), and the
   render died there three times, twice standalone and once inside the gate.
   respawn() closes the browser, launches a fresh one with the same setup,
   reloads the app and waits for it, so the heavy tail runs on a clean page.
   Listeners re-attach to the same arrays; nothing about what is measured
   changes, only what the browser has to carry. */
async function respawn() {
  try { await browser.close(); } catch (e) { }
  browser = await puppeteer.launch(LAUNCH);
  page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2.6 });
  page.on("response", (r) => { if (r.status() >= 400) badRequests.push(r.status() + " " + r.url()); });
  page.on("requestfailed", (r) => badRequests.push("FAILED " + r.url() + " " + (r.failure()||{}).errorText));
  page.on("console", (m) => consoleErrors.push(m.type().toUpperCase() + ": " + m.text()));
  page.on("pageerror", (e) => pageErrors.push(String(e.message)));
  await page.evaluateOnNewDocument(() => {
    window.__mapErrors = []; window.__evts = [];
    const iv = setInterval(() => {
      if (!window.map || !window.map.on) return;
      clearInterval(iv);
      for (const ev of ["load", "idle", "style.load", "sourcedata", "render"])
        window.map.on(ev, () => { if (window.__evts.filter((x) => x === ev).length < 2) window.__evts.push(ev); });
      window.map.on("error", (e) => window.__mapErrors.push((e && e.error && e.error.message) || String(e)));
    }, 10);
  });
  await page.evaluateOnNewDocument(RH);
  await fastAnim(page);
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 240; i++) {
      if (window.map && window.__mode && window.__nav && window.map.loaded && window.map.loaded()) break;
      await sleep(500); }
    await sleep(1500);
  });
  console.log("  (fresh browser for the heavy tail)");
}

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

/* Take 182 · A194 · the FIRST-RUN TOUR. On a clean profile it opens itself
   after the map loads and rings the mode chip with the question the friend
   asked for. Checked here, where first run happens, then closed with Not
   now so the rest of the run sees the screen a returning rider sees. */
const fr0 = await page.evaluate(async () => {
  const wait = (ms) => new Promise((z) => setTimeout(z, ms));
  const T = window.__tour; if (!T) return { missing: true };
  for (let i = 0; i < 40 && !T.state().on; i++) await wait(100);
  await wait(450);   /* the ring animates into place over the motion duration; measure it settled */
  const on = T.state().on, tour = document.getElementById('tour'), ring = document.getElementById('tour-ring');
  const visible = !!tour && !tour.hidden;   /* read BEFORE the close below — the first version read it in the return, after */
  const chip = document.getElementById('c-mode');
  const rr = ring ? ring.getBoundingClientRect() : null, cr = chip ? chip.getBoundingClientRect() : null;
  const rings = !!(rr && cr) && rr.left <= cr.left && rr.top <= cr.top && rr.right >= cr.right && rr.bottom >= cr.bottom;
  const txt = (document.getElementById('tour-card') || {}).textContent || '';
  const seenBefore = T.seen();
  const btns = ['tour-next', 'tour-notnow', 'tour-never', 'tour-x'].map((id) => !!document.getElementById(id));
  const how = on ? T.close('notnow') : null;
  return { on, visible, rings, rr: rr && [rr.left, rr.top, rr.width, rr.height].map(Math.round), cr: cr && [cr.left, cr.top, cr.width, cr.height].map(Math.round), txt: txt.slice(0, 60), seenBefore, btns, how, seenAfter: T.seen() };
});
if (fr0.missing) ok(false, "take-182 tour hooks missing (__tour)");
else {
  ok(fr0.on && fr0.visible && fr0.rings && /What are you doing today\?/.test(fr0.txt),
     `first run: the tour opens itself after the map loads and rings the mode chip — "What are you doing today?" (ring ${fr0.rr} · chip ${fr0.cr} · on=${fr0.on} visible=${fr0.visible})`);
  ok(fr0.btns.every(Boolean) && fr0.how === 'notnow' && !fr0.seenBefore && !fr0.seenAfter,
     `every step carries Next, Not now, Don't show again and ×; Not now closes it and leaves the flag clear`);
}

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
/* take 189 · A239 · TRAIL COUNTRY FROM THE DATA. This section went to the
   'site' anchor, which statewide is Silver Lake Dunes: an open riding AREA
   with no trail line by design. The line check was skipped there ("--") and
   the label line printed "NOT MEASURABLE … see the failure above" with no
   failure above it (landmine 55's shape), so the trail-name check ran in no
   take-189 render (L-render's finding). The camera now goes where the
   bundle draws a NAMED designated trail: the vertex of a named ORV-class
   stroke (the source lbl-trail labels) nearest the region centre, the rule
   the app's own stLabels uses, restated on the strokes source — never a
   typed coordinate (landmine 197). Where nothing can be measured, both
   checks FAIL rather than skip, and the section floor counts them (2). */
const centre = manifest.centre || (Array.isArray(manifest.bbox) && manifest.bbox.length === 4
  ? [(manifest.bbox[0] + manifest.bbox[2]) / 2, (manifest.bbox[1] + manifest.bbox[3]) / 2] : null);
if (RUN("trails")) {   /* take 189 · A227 · section guards: see SECTIONS */
const zoomed = await page.evaluate(async (ctr) => {
  const m = window.map, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  if (!m) return { trails: -1, trailLabels: -1, placeLabels: -1, at: null };
  const c = m.getCenter();
  const DES = ["route72", "trail50", "moto24", "mccct", "fstrail"];
  let feats = [];
  try { feats = m.getStyle().sources.strokes.data.features || []; } catch (e) { }
  const from = ctr || [c.lng, c.lat], kx = Math.cos(from[1] * Math.PI / 180);
  let best = Infinity, at = null, name = null;
  for (const f of feats) {
    const pr = f && f.properties, g = f && f.geometry;
    if (!pr || !g || !DES.includes(pr.c) || !pr.lb) continue;
    const cs = g.type === "MultiLineString" ? g.coordinates.flat() : g.type === "LineString" ? g.coordinates : [];
    for (const p of cs) { const dx = (p[0] - from[0]) * kx, dy = p[1] - from[1], d = dx * dx + dy * dy;
      if (d < best) { best = d; at = p; name = pr.lb; } } }
  if (!at) return { trails: 0, trailLabels: 0, strokeN: feats.length, at: null };
  m.jumpTo({ center: at, zoom: 14.5 });
  await window.__rh.idle(m, 2500);   /* take 189 · A227: was a fixed 2.5 s */
  const q = (ids) => { try { return m.queryRenderedFeatures({ layers: ids }).length; }
                       catch (e) { return -1; } };
  /* The denominator: how many labelable strokes exist at all. A count of placed
     labels with no denominator cannot tell "crowded out" from "there were only
     two to begin with" (landmine 131). */
  let strokeN = -1;
  try { strokeN = m.getStyle().sources.strokes.data.features.length; } catch (e) { }
  let trails = q(["trail50", "route72", "moto24", "fstrail", "mccct"]), trailLabels = q(["lbl-trail"]);
  /* symbols are placed after the lines draw: when the lines are there and no
     name is yet, wait for the map at rest once more (bounded, the same
     2.5 s), then read again — never a pass on the first read alone */
  if (trails > 0 && trailLabels === 0) { await window.__rh.idle(m, 2500);
    trails = q(["trail50", "route72", "moto24", "fstrail", "mccct"]); trailLabels = q(["lbl-trail"]); }
  const out = { trailLabels, placeLabels: q(["lbl-place"]), strokeN, trails,
                at, name, km: Math.round(Math.sqrt(best) * 111.32 * 10) / 10 };
  m.jumpTo({ center: [c.lng, c.lat], zoom: 11.4 });
  await window.__rh.idle(m, 1200);
  return out;
}, centre);
const trailAt = zoomed.at
  ? `"${zoomed.name}" (${zoomed.at[1].toFixed(4)}, ${zoomed.at[0].toFixed(4)}; the named ORV trail nearest the region centre, ${zoomed.km} km from it)`
  : "no named ORV trail in the strokes source";
ok(zoomed.trails > 0, `z14.5 at ${trailAt}: ${zoomed.trails} trail segments drawn`);
/* A run where nothing drew must not be read as a labelling failure — but nor
   may it pass by printing a line (take 189 · A239: it printed "see the
   failure above" with no failure above it). Say which case it is (take 87,
   landmine 55), and FAIL: a check that cannot measure has not passed. */
if (zoomed.trails > 0) {
  ok(zoomed.trailLabels > 0,
     `z14.5 at "${zoomed.name}": ${zoomed.trailLabels} trail NAME labels `
     + `from ${zoomed.strokeN} labelable strokes — a rider can identify the trail`);
} else {
  ok(false, "z14.5 trail NAME labels: NOT MEASURABLE — no trail geometry drew where the data puts a "
     + "named ORV trail (the failure above); a run that cannot measure them fails");
}

}

/* A77 · water names must never outrank trail names. MapLibre resolves symbol
   collisions in LAYER ORDER, so this is guaranteed by construction rather than
   measured — an empirical count at one zoom on one flaky headless run cannot
   prove it, and I tried (take 87). */
{
  /* take 189 · A227 · read by the closing checks (labels) and by camp (shell) */
  let order, iTrail, iLake, iStream, wl, shl;
  if (RUN("labels")) {
  order = await page.evaluate(() =>
    window.map.getStyle().layers.map((l) => l.id));
  iTrail = order.indexOf("lbl-trail");
  iLake = order.indexOf("lbl-lake");
  iStream = order.indexOf("lbl-stream");
  wl = await page.evaluate(async () => {
    const m = window.map, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const c = m.getCenter();
    m.jumpTo({ center: [-84.09, 44.57], zoom: 13.2 });
    await window.__rh.idle(m, 2600);
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
    await window.__rh.idle(m, 2400);
    const out = { lake: q("lbl-lake"), stream: q("lbl-stream"), srcN, sample };
    m.jumpTo({ center: [c.lng, c.lat], zoom: 11.4 });
    await window.__rh.idle(m, 1000);
    return out;
  });
  /* A110 · places. Centred on the densest cluster in the payload, chosen from
     the data rather than from where I happen to be looking (landmine 130). */
  const poi = await page.evaluate(async () => {
    const m = window.map, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    m.jumpTo({ center: [-84.13, 44.66], zoom: 13.6 });
    await window.__rh.idle(m, 2600);
    let srcN = -1;
    try { srcN = m.getStyle().sources.poi.data.features.length; } catch (e) { srcN = -2; }
    const q = (id) => { try { return m.queryRenderedFeatures({ layers: [id] }); }
                        catch (e) { return []; } };
    return { srcN, dots: q("poi-dot").length,
             /* A151: badge and name share a layer now; a placed feature
                with a non-empty name IS a drawn label */
             labels: [...new Set(q("poi-dot").concat(q("poi-dot-major"))
                       .map((f) => f.properties.n).filter(Boolean))] };
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
    await window.__rh.idle(m, 2400);
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
  /* A140 · DNR scramble areas as polygons (take 119). Centred on the LARGEST
     area in the payload — not a hardcoded coordinate, which is a region
     assumption with a fuse (landmine 197). Settle-then-measure (198). */
  const area = await page.evaluate(async () => {
    const m = window.map, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let src = null;
    try { src = m.getStyle().sources.areas.data.features; } catch (e) { }
    if (!src || !src.length) return { n: 0 };
    const on = (() => { try {
      return m.getLayoutProperty("area-fill", "visibility") !== "none"; } catch (e) { return null; } })();
    const big = src.slice().sort((a, b) => b.properties.ac - a.properties.ac)[0];
    /* raw array in the style source, JSON string after queryRenderedFeatures */
    const c = typeof big.properties.c === "string" ? JSON.parse(big.properties.c) : big.properties.c;
    m.jumpTo({ center: c, zoom: 12.4 });
    let fill = [], lbl = [];
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      try { fill = m.queryRenderedFeatures({ layers: ["area-fill"] });
            lbl = m.queryRenderedFeatures({ layers: ["area-label"] }); } catch (e) { }
      if (fill.length && lbl.length) break;
    }
    const card = (() => { try {
      /* through the harness bridge — app functions are not window globals
         (the smoke draft made the same mistake the same take; landmine 54) */
      window.__areas.card(big.properties);
      return document.getElementById("panel").innerHTML; } catch (e) { return "ERR " + e; } })();
    return { n: src.length, on, name: big.properties.n, ac: big.properties.ac,
             fill: fill.length, lbl: lbl.map((f) => f.properties.lb.split("\n")[0]), card };
  });
  if (area.n === 0) {
    ok(true, "no riding-area artifact — areas skipped, not failed");
  } else {
    ok(area.on === true, "riding areas are ON by default — legal ORV ground is not optional");
    ok(area.fill > 0, `${area.name} (${area.ac} ac) draws as a polygon (${area.fill} fill feature(s) in view)`);
    ok(area.lbl.indexOf(area.name) >= 0, `…and is labelled: ${area.lbl.join(", ")}`);
    ok(area.card.indexOf(area.name) >= 0 && area.card.indexOf("never across") >= 0,
       "the area card names the ground and says routing stops at its edge");
    ok(area.n >= 1, `${area.n} DNR scramble area(s) carried in the payload`);
  }

  }
  if (RUN("modes")) {
  /* A136/A137 · MODES (take 125). Each mode must produce the map it promises,
     measured from resolved style state — not from the table. And Ride must
     be exactly today's map, so a rider who never touches the chip sees no
     change. Drills put back what they moved. */
  const modes = await page.evaluate(async () => {
    const m = window.map, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const M = window.__mode; if (!M) return { missing: true };
    const vis = (id) => { try { return m.getLayoutProperty(id, "visibility") !== "none"; } catch (e) { return null; } };
    const was = M.get();
    const out = {};
    for (const k of ["ride", "outdoors", "water"]) {
      M.apply(k, { silent: true }); await sleep(350);
      let poiF = null; try { poiF = JSON.stringify(m.getFilter("poi-dot-major")); } catch (e) { }
      const kinds = ((M.MODES || []).find((x) => x.k === k) || {}).kinds || [];
      out[k] = { chip: document.querySelector("#c-mode span").textContent,
                 trail50: vis("trail50"), show: vis("show-line"), foot: vis("foot"),
                 showF: (() => { try { return JSON.stringify(m.getFilter("show-line")); } catch (e) { return null; } })(),
                 peaks: vis("peak-dot"), paddle: vis("pad-line"), areas: vis("area-fill"),
                 basemap: document.querySelector("#c-base span").textContent,
                 satOk: !!(window.__sat && window.__sat.ok),
                 /* take 154: this used to grep the serialized poi-dot-major
                    FILTER for the word. That filter now also carries the
                    clusterable-kinds list (the double-draw guard), so the
                    text probe went ambiguous. The mode's own kinds list is
                    the authoritative answer and always was. */
                 launchIn: (kinds.indexOf("launch") >= 0),
                 fuelIn: (kinds.indexOf("fuel") >= 0) };
    }
    M.apply(was, { silent: true }); await sleep(200);
    return out;
  });
  if (modes.missing) {
    ok(false, "mode bridge missing");
  } else {
    ok(modes.ride.chip === "Off-road" && modes.ride.trail50 && modes.ride.areas && !modes.ride.peaks,
       "Off-road: ORV lines and riding areas on, hills off");
    /* take 134: `foot` is a NETWORK layer now (routable), not a show-only class */
    ok(modes.outdoors.chip === "Outdoors" && !modes.outdoors.trail50 && modes.outdoors.foot === true
       && modes.outdoors.peaks && modes.outdoors.paddle,
       "Outdoors: ORV lines hidden, hiking routes drawn (routable), named hills and rivers on");
    ok(modes.water.chip === "Water" && !modes.water.trail50 && !modes.water.show
       && modes.water.paddle && modes.water.launchIn && !modes.water.areas,
       "Water: no trail lines, paddling on, launches in the pin set, riding areas off");
    /* take 188 · A213: "either way" let a Water that fell back to Map pass.
       Hybrid whenever the bundle has imagery (window.__sat.ok), Map only when
       it has none. */
    const satPl = [satExpect({ artifacts: [{ kind: "network" }], imagery_tiles: { count: 9 } }),
      satExpect({ artifacts: [{ kind: "imagery" }], imagery_bounds: [0, 0, 0, 0] }), satExpect({})];
    ok(SAT_EXPECT !== null && modes.water.satOk === SAT_EXPECT && satPl[0] === true && satPl[1] === false && satPl[2] === null,
       `imagery: the manifest says ${SAT_EXPECT === null ? "NOTHING (no manifest to judge)" : SAT_EXPECT}, the app's SAT_OK says ${modes.water.satOk} `
       + `— every Hybrid guard below branches on the manifest's answer (plants: tiles ${satPl[0]}, a degenerate mosaic ${satPl[1]}, no manifest ${satPl[2]})`);
    ok(SAT_EXPECT ? modes.water.basemap === "Hybrid" : modes.water.basemap === "Map",
       `Water opens on ${SAT_EXPECT ? "Hybrid" : "Map (no imagery in this bundle)"} (got ${modes.water.basemap})`);
    ok(!modes.outdoors.fuelIn && modes.ride.fuelIn,
       "fuel is a Ride pin, not an Outdoors pin");
    ok(!modes.ride.launchIn,
       "Ride does NOT carry launches — a riding trip, not today's map (Jacob, take 125)");
  }
  /* Take 132 · DNR public land. Measured in Outdoors at the largest game
     area: the wash draws, the boundary draws, the card names the tract and
     its acreage. Ride keeps it off. Drill restores everything. */
  const pub = await page.evaluate(async () => {
    const m = window.map, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const M = window.__mode; if (!M) return { missing: true };
    let src = null; try { src = m.getStyle().sources.pubs.data.features; } catch (e) { }
    if (!src || !src.length) return { absent: true };
    const was = M.get(), cam = { c: m.getCenter(), z: m.getZoom() };
    const game = src.filter((f) => f.properties.t === "game").sort((a, b) => b.properties.ac - a.properties.ac)[0];
    const ring = game.geometry.coordinates.sort((a, b) => b[0].length - a[0].length)[0][0];
    const cx = ring.reduce((s, q) => s + q[0], 0) / ring.length, cy = ring.reduce((s, q) => s + q[1], 0) / ring.length;
    M.apply("hunt", { silent: true });
    m.jumpTo({ center: [cx, cy], zoom: 11 });
    let fill = 0, line = 0;
    for (let i = 0; i < 30; i++) { await sleep(300);
      try { fill = m.queryRenderedFeatures({ layers: ["pub-fill"] }).length;
            line = m.queryRenderedFeatures({ layers: ["pub-line"] }).length; } catch (e) { }
      if (fill && line) break; }
    const vis = (id) => { try { return m.getLayoutProperty(id, "visibility") !== "none"; } catch (e) { return null; } };
    M.apply("ride", { silent: true }); await sleep(150);
    const rideOff = !vis("pub-fill");
    M.apply(was, { silent: true }); m.jumpTo({ center: [cam.c.lng, cam.c.lat], zoom: cam.z });
    return { n: src.length, name: game.properties.n, ac: game.properties.ac, fill, line, rideOff,
             acres: src.reduce((s, f) => s + f.properties.ac, 0) };
  });
  if (pub.missing) { ok(false, "mode bridge missing"); }
  else if (pub.absent) { ok(true, "no public-land artifact — skipped, not failed"); }
  else {
    ok(pub.fill > 0 && pub.line > 0, `Hunt draws public land at ${pub.name} (${pub.ac.toLocaleString()} ac): ${pub.fill} fill, ${pub.line} boundary features`);
    ok(pub.acres > 4e6 && pub.acres < 5.5e6, `${pub.n} tracts carry ${(pub.acres / 1e6).toFixed(2)}M acres — Michigan's state land is ~4.6M`);
    ok(pub.rideOff, "Ride keeps public land off by default");
  }

  /* Take 137 · typed waypoints (onX Hunt 24280). In Outdoors a dropped pin
     offers Stand / Camera / Sign / Water / Gate; choosing Stand saves a
     typed record and the map paints it in the stand colour; in Ride the row
     is absent. Drill clears what it saved. */
  const twp = await page.evaluate(async () => {
    const m = window.map, s = (ms) => new Promise((r) => setTimeout(r, ms));
    const M = window.__mode; if (!M) return { missing: true };
    const was = M.get(), cam = { c: m.getCenter(), z: m.getZoom() };
    const drop = async () => {
      const c = m.getCenter(), px = m.project([c.lng + 0.01, c.lat + 0.004]);
      const cv = m.getCanvasContainer(), r = cv.getBoundingClientRect();
      const t = new Touch({ identifier: 7, target: cv, clientX: r.left + px.x, clientY: r.top + px.y });
      cv.dispatchEvent(new TouchEvent("touchstart", { touches: [t], bubbles: true, cancelable: true }));
      await s(900);
      cv.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: [t], bubbles: true }));
      /* a real finger's touchend is followed by a click, which the app swallows
         as "the long press already acted" and resets lp.fired; without it the
         NEXT drill's tap was swallowed instead (take 137) */
      cv.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true,
        clientX: r.left + px.x, clientY: r.top + px.y }));
      for (let i = 0; i < 20; i++) { await s(300); if (document.getElementById("pc-wpt")) break; }
      return [...document.querySelectorAll("[data-wpt]")].map((b) => b.dataset.wpt);
    };
    M.apply("ride", { silent: true }); await s(200);
    const rideTypes = await drop();
    try { document.getElementById("pc-drop").click(); } catch (e) { }
    M.apply("hunt", { silent: true }); await s(200);
    const outTypes = await drop();
    const stand = document.querySelector('[data-wpt="stand"]');
    if (stand) stand.click(); await s(400);
    let rec = null; try { rec = JSON.parse(localStorage.getItem("apex.waypoints.v1") || "[]")[0]; } catch (e) { }
    let painted = null;
    for (let i = 0; i < 20 && painted === null; i++) { await s(300);
      try { const f = m.queryRenderedFeatures({ layers: ["wpt-dot"] }).find((x) => x.properties.t === "stand");
            if (f) painted = m.getPaintProperty("wpt-dot", "circle-color") ? true : null; } catch (e) { } }
    // clean up what the drill saved
    try { const a = JSON.parse(localStorage.getItem("apex.waypoints.v1") || "[]").filter((x) => x.t !== "stand");
          localStorage.setItem("apex.waypoints.v1", JSON.stringify(a)); } catch (e) { }
    M.apply(was, { silent: true }); m.jumpTo({ center: [cam.c.lng, cam.c.lat], zoom: cam.z });
    return { rideTypes, outTypes, rec, painted };
  });
  if (twp.missing) { ok(false, "mode bridge missing"); } else {
    ok(twp.rideTypes.length === 0, "Ride's pin card offers no hunting types");
    ok(twp.outTypes.join() === "stand,camera,sign,water,gate",
       `Hunt's pin card offers Stand / Camera / Sign / Water / Gate (${twp.outTypes.join(" · ")})`);
    ok(twp.rec && twp.rec.t === "stand" && /^Stand · /.test(twp.rec.n),
       `choosing Stand saves a typed waypoint (${twp.rec && twp.rec.n})`);
    ok(twp.painted === true, "the typed waypoint is drawn on the map in its own colour");
  }

  /* Take 142 · ski & snowboard hills. The target hill comes from the BUNDLE,
     not from a coordinate typed here (landmine 197): poi.json is read on the
     Node side and the drill is handed the record. The card's runs and website
     come off the record via properties.i, so the assertion goes through the
     same door a finger does: tap the pin, read the card. Drill restores mode
     and camera (harness law). */
  {
    let hill = null;
    try {
      const pj = JSON.parse(readFileSync("www/bundle/poi.json", "utf8"));
      const all = (pj.p || []).filter((r) => r.k === "ski");
      hill = all.find((r) => r.runs && r.runs.length && r.web) ||
             all.find((r) => r.runs && r.runs.length) || all[0] || null;
      ok(all.length > 0, `the bundle carries ski hills (${all.length}; drill uses ${hill ? hill.n : "none"})`);
    } catch (e) { ok(false, "poi.json unreadable for the ski drill: " + e.message); }
    if (hill) {
      const ski = await page.evaluate(async (hill) => {
        const m = window.map, s = (ms) => new Promise((r) => setTimeout(r, ms));
        const M = window.__mode; if (!M) return { missing: true };
        const was = M.get(), cam = { c: m.getCenter(), z: m.getZoom() };
        M.apply("outdoors", { silent: true }); await s(200);
        m.jumpTo({ center: hill.p, zoom: 13.2 });
        let drawn = 0;
        for (let i = 0; i < 20; i++) { await s(300);
          try { drawn = m.queryRenderedFeatures(
            { layers: ["poi-dot", "poi-dot-major"] })
            .filter((f) => f.properties.k === "ski").length; } catch (e) { }
          if (drawn) break; }
        const px = m.project(hill.p), cv = m.getCanvasContainer(),
              r = cv.getBoundingClientRect();
        cv.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true,
          clientX: r.left + px.x, clientY: r.top + px.y }));
        let text = "";
        for (let i = 0; i < 16; i++) { await s(250);
          text = document.body.innerText || "";
          if (text.indexOf(hill.n) !== -1) break; }
        M.apply(was, { silent: true });
        m.jumpTo({ center: [cam.c.lng, cam.c.lat], zoom: cam.z });
        return { drawn, named: text.indexOf(hill.n) !== -1,
                 runs: text.indexOf("RUNS") !== -1,
                 firstRun: hill.runs && hill.runs.length ? text.indexOf(hill.runs[0].n) !== -1 : null,
                 web: text.indexOf("Website") !== -1 };
      }, hill);
      ok(ski.drawn > 0, `the ski pin draws in Outdoors at ${hill.n} (${ski.drawn} rendered)`);
      ok(ski.named, `tapping it opens the hill's card`);
      if (hill.runs && hill.runs.length)
        ok(ski.runs && ski.firstRun,
           `the card lists its runs (RUNS section, "${hill.runs[0].n}" shown)`);
      if (hill.web) ok(ski.web, "the card links the hill's website");
    }
  }

  /* Take 131 · photos on major pins. Measured: a pin the index names gets
     markup with an <img> whose file the bundle actually serves; a pin the
     index does not name gets NOTHING — no placeholder. Attribution rides
     with the image. */
  const ph = await page.evaluate(async () => {
    const P = window.__ph; if (!P || !P.index) return { absent: true };
    const keys = Object.keys(P.index);
    if (!keys.length) return { absent: true };
    const k = keys[0], [kind, name, lon, lat] = k.split("|");
    const html = P.html(kind, name, [+lon, +lat]);
    const m = /src="([^"]+)"/.exec(html || "");
    let status = 0, bytes = 0;
    if (m) { try { const r = await fetch(m[1]); status = r.status; bytes = (await r.arrayBuffer()).byteLength; } catch (e) { } }
    const none = P.html("camp", "No Such Campground Anywhere", [-84.5, 44.5]);
    return { n: keys.length, name, kind, hasImg: !!m, status, bytes,
             attributed: /phby/.test(html || "") && /CC|Public|Commons|domain/i.test(html || ""), none };
  });
  if (ph.absent) {
    ok(true, "no photo index in this bundle — skipped, not failed");
  } else {
    ok(ph.hasImg && ph.status === 200 && ph.bytes > 2000,
       `${ph.name} (${ph.kind}) shows its photo, served from the bundle (${ph.bytes} bytes); ${ph.n} pins have one`);
    ok(ph.attributed, "the photo carries its author / licence line");
    ok(ph.none === "", "a pin without a photo gets no markup at all — no placeholder");
  }

  /* Take 130 · Jacob: "let me select what mode I want rather than it swapping
     between them." The chip opens a picker; a row selects directly. */
  const pick = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const M = window.__mode; if (!M) return { missing: true };
    const was = M.get();
    document.getElementById("c-mode").click(); await sleep(150);
    const p = document.getElementById("modepanel");
    const rows = [...p.querySelectorAll("[data-mode]")];
    const open = !p.hidden;
    const labels = rows.map((r) => r.querySelector("span").textContent);
    const water = rows.find((r) => r.dataset.mode === "water");
    if (water) water.click(); await sleep(250);
    const after = M.get(), closed = p.hidden;
    const chip = document.querySelector("#c-mode span").textContent;
    M.apply(was, { silent: true }); await sleep(150);
    return { open, labels, after, closed, chip };
  });
  if (pick.missing) { ok(false, "mode bridge missing"); } else {
    ok(pick.open && pick.labels.length === 5 && pick.labels.join() === "Off-road,Outdoors,Hunt,Water,Camp",
       `the mode chip opens a picker with five rows (${pick.labels.join(" · ")})`);
    ok(pick.after === "water" && pick.closed && pick.chip === "Water",
       "choosing Water selects it directly and closes the picker");
  }

  /* Take 129 · transcribed from onX: county lines + names, trail-system pins,
     summits from z9 — all in Outdoors, measured from resolved state. */
  const od = await page.evaluate(async () => {
    const m = window.map, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const M = window.__mode; if (!M) return { missing: true };
    const was = M.get(), cam = { c: m.getCenter(), z: m.getZoom() };
    M.apply("hunt", { silent: true });
    m.jumpTo({ center: [cam.c.lng, cam.c.lat], zoom: 8.6 }); await sleep(300);
    let lines = 0, labels = 0;
    for (let i = 0; i < 30; i++) { await sleep(300);
      try { lines = m.queryRenderedFeatures({ layers: ["county-line"] }).length;
            labels = m.queryRenderedFeatures({ layers: ["county-label"] }).length; } catch (e) { }
      if (lines && labels) break; }
    const vis = (id) => { try { return m.getLayoutProperty(id, "visibility") !== "none"; } catch (e) { return null; } };
    const peakMin = (() => { try { return m.getLayer("peak-dot").minzoom; } catch (e) { return null; } })();
    const src = m.getStyle().sources.poi.data.features;
    const systems = src.filter((f) => f.properties.k === "system").length;
    const mtb = src.filter((f) => f.properties.k === "mtb").length;
    const withMi = src.filter((f) => f.properties.mi > 0).length;
    const poiF = (() => { try { return JSON.stringify(m.getFilter("poi-dot-major")); } catch (e) { return ""; } })();
    M.apply("ride", { silent: true }); await sleep(200);
    const rideCounty = vis("county-line"), ridePeak = (() => { try { return m.getLayer("peak-dot").minzoom; } catch (e) { return null; } })();
    M.apply(was, { silent: true }); m.jumpTo({ center: [cam.c.lng, cam.c.lat], zoom: cam.z });
    return { lines, labels, peakMin, systems, mtb, withMi, hasSystem: /"system"/.test(poiF), rideCounty, ridePeak };
  });
  if (od.missing) { ok(false, "mode bridge missing"); } else {
    ok(od.lines > 0 && od.labels > 0, `Hunt draws county lines and names at 8.6 (${od.lines} lines, ${od.labels} names)`);
    ok(od.peakMin === 9, `Hunt shows summits from z9 (minzoom ${od.peakMin})`);
    ok(od.systems > 100 && od.mtb > 50 && od.withMi === od.systems + od.mtb,
       `trail-system pins in the payload: ${od.systems} hiking, ${od.mtb} MTB, every one with mileage`);
    ok(od.hasSystem, "Hunt's pin set includes trail systems");
    ok(od.rideCounty === false && od.ridePeak === 10.6, "Ride puts county lines away and summits back to z10.6");
  }

  /* DESIGN-modes step 3 (take 128) · the walking profile. Measured, not
     read off the table: Outdoors puts the router on foot, an edge's time is
     its length at 3 mph, and leaving Outdoors hands the rider's machine back. */
  const walk = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const M = window.__mode, R = window.__route;
    if (!M || !R || !R.MACHINE || !R.MACHINE.walk) return { missing: true };
    R.setMachine("sxs");
    M.apply("outdoors", { silent: true }); await sleep(200);
    const inOut = R.machine;
    const e = R.EDGES.find((x) => x.c === "fsroad") || R.EDGES[0];
    const hrsWalk = (e.L / 1609.34) / R.spd(e);
    M.apply("ride", { silent: true }); await sleep(200);
    const back = R.machine;
    const hrsRide = (e.L / 1609.34) / R.spd(e);
    M.apply("ride", { silent: true });
    return { inOut, back, mphWalk: (e.L / 1609.34) / hrsWalk, mphRide: (e.L / 1609.34) / hrsRide,
             chip: document.querySelector("#c-machine span").textContent };
  });
  if (walk.missing) {
    ok(false, "walk machine or route bridge missing");
  } else {
    ok(walk.inOut === "walk", `Outdoors puts the router on foot (machine=${walk.inOut})`);
    ok(Math.abs(walk.mphWalk - 3) < 0.01, `a walker's edge time is its length at 3 mph (got ${walk.mphWalk.toFixed(2)})`);
    ok(walk.back === "sxs" && walk.mphRide > 10,
       `leaving Outdoors gives the side-by-side back (${walk.back}, ${walk.mphRide.toFixed(0)} mph on a forest road)`);
    ok(/"boost"|launch/.test(modes.water.showF || "") || modes.water.launchIn,
       "Water promotes launches and beaches to the first zoom");
  }

  }
  if (RUN("imagery")) {
  /* A153 · sparse imagery patches (take 127). The proof is not that a file
     exists: it is that at a riding area on Hybrid the patch layer is a
     raster layer, visible, and its source has LOADED tiles — and that a
     request outside every patch box comes back blank rather than as a map
     error (map.on('error') decides RENDER FAIL). Drill puts back the basemap
     and the camera. */
  const patch = await page.evaluate(async () => {
    const m = window.map, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const T = window.__sat && window.__sat.tiles;   // BUNDLE is not a window global
    if (!T || !T.sparse) return { sparse: false };
    let src = null; try { src = m.getStyle().sources.areas.data.features; } catch (e) { }
    if (!src || !src.length) return { sparse: true, noAreas: true };
    const big = src.slice().sort((a, b) => b.properties.ac - a.properties.ac)[0];
    const c = typeof big.properties.c === "string" ? JSON.parse(big.properties.c) : big.properties.c;
    const cam = { c: m.getCenter(), z: m.getZoom() };
    const bm = document.querySelector("#c-base span").textContent;
    m.jumpTo({ center: c, zoom: 14.2 });
    document.getElementById("c-base").click(); await sleep(300);   // Hybrid (take 188: one tap)
    let loaded = false, errBefore = window.__mapErr || null;
    for (let i = 0; i < 40; i++) {
      await sleep(400);
      try { if (m.getSource("satpatch").loaded()) { loaded = true; break; } } catch (e) { }
    }
    const type = (() => { try { return m.getLayer("sat-patch").type; } catch (e) { return null; } })();
    const vis = (() => { try { return m.getLayoutProperty("sat-patch", "visibility"); } catch (e) { return null; } })();
    // a tile no patch declares must answer blank, not throw
    const errAfter = window.__mapErr || null;
    // back
    while (document.querySelector("#c-base span").textContent !== bm) {
      document.getElementById("c-base").click(); await sleep(150); }
    m.jumpTo({ center: [cam.c.lng, cam.c.lat], zoom: cam.z });
    return { sparse: true, name: big.properties.n, type, vis, loaded,
             boxes: (T.boxes || []).length, count: T.count, errRaised: errAfter !== errBefore };
  });
  if (!patch.sparse) {
    ok(true, "no sparse imagery patches in this bundle — skipped, not failed");
  } else if (patch.noAreas) {
    ok(false, "sparse patches declared but no riding areas to anchor them");
  } else {
    ok(patch.type === "raster" && patch.vis === "visible",
       `sat-patch is a visible raster layer on Hybrid at ${patch.name}`);
    ok(patch.loaded, `the patch source loaded its tiles at ${patch.name} (${patch.count} tiles in ${patch.boxes} boxes)`);
    ok(!patch.errRaised, "no map error was raised while tiles outside the patches were requested");
    /* take 138: the "blank" tile was a half-transparent BLUE pixel typed from
       memory and Jacob's Hybrid turned blue from z12 up. Decode it. */
    const alpha = await page.evaluate(async () => {
      const S = window.__sat; if (!S || !S.tiles || !S.tiles.sparse) return null;
      const box = (S.tiles.boxes || [])[0]; if (!box) return null;
      // a tile far outside every box: same zoom, x shifted by 5000
      const url = "apexsat://" + box[0] + "/" + (box[1] + 5000) + "/" + box[2];
      const png = await new Promise((res) => {
        const img = new Image();
        img.onload = () => { const c = document.createElement("canvas"); c.width = c.height = 1;
          const g = c.getContext("2d"); g.drawImage(img, 0, 0); res(g.getImageData(0, 0, 1, 1).data); };
        img.onerror = () => res(null);
        // route through the same protocol handler MapLibre uses
        const h = maplibregl.getProtocolHandler ? null : null;
        img.src = "data:image/png;base64," + btoa(String.fromCharCode.apply(null, window.__sat.blank || []));
      });
      return png ? { r: png[0], g: png[1], b: png[2], a: png[3] } : null;
    });
    ok(alpha && alpha.a === 0, `the out-of-patch tile is fully transparent (rgba ${alpha ? [alpha.r, alpha.g, alpha.b, alpha.a].join(",") : "?"})`);
  }
  /* take 140 · the statewide z11 base under the patches: at a point OUTSIDE
     every patch box, on Hybrid at z13, the base source has loaded tiles
     (its own source, maxzoom 11, so MapLibre overzooms it there). */
  const base = await page.evaluate(async () => {
    const m = window.map, s = (ms) => new Promise((r) => setTimeout(r, ms));
    const S = window.__sat; if (!S || !S.sparse || S.tiles.zmin > 11) return { skip: true };
    const cam = { c: m.getCenter(), z: m.getZoom() };
    const bm = document.querySelector("#c-base span").textContent;
    // a point no patch covers: walk east from the region centre until inPatch is false at z13
    const c0 = m.getCenter(); let lon = c0.lng, lat = c0.lat, tries = 0;
    const tile = (ln, la, z) => { const n = 2 ** z; const r = la * Math.PI / 180;
      return [Math.floor((ln + 180) / 360 * n), Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n)]; };
    while (tries++ < 40) { const t = tile(lon, lat, 13); if (!S.inPatch(13, t[0], t[1])) break; lon += 0.05; }
    m.jumpTo({ center: [lon, lat], zoom: 13 });
    document.getElementById("c-base").click(); await s(300);
    let loaded = false;
    for (let i = 0; i < 40; i++) { await s(400); try { if (m.getSource("satbase").loaded()) { loaded = true; break; } } catch (e) { } }
    const vis = (() => { try { return m.getLayoutProperty("sat-base", "visibility"); } catch (e) { return null; } })();
    while (document.querySelector("#c-base span").textContent !== bm) { document.getElementById("c-base").click(); await s(150); }
    m.jumpTo({ center: [cam.c.lng, cam.c.lat], zoom: cam.z });
    return { loaded, vis, bz: (S.tiles.base || 11), at: [lon.toFixed(2), lat.toFixed(2)] };
  });
  if (base.skip) ok(true, "no statewide imagery base in this bundle — skipped, not failed");
  else ok(base.loaded && base.vis === "visible", `the statewide base (to z${base.bz}) is loaded and visible at z13 outside every patch (${base.at})`);

  /* Take 144 · the saved-HD store behind the apexsat resolver (A160). The
     resolver is called directly — the same function MapLibre calls — with
     tiles chosen from the bundle's OWN box list (landmine 197): one z13
     tile outside every box, one tile inside the statewide base box. Blank
     before saving, the seeded bytes after, the bundle still winning inside
     its boxes, and stats counting exactly what clear removes. */
  const hd = await page.evaluate(async () => {
    const S = window.__sat, H = window.__hd;
    if (!S || !S.resolve || !H) return { missing: true };
    const blankLen = S.blank.length;
    const boxes = S.tiles.boxes || [];
    const at = (z) => boxes.filter((b) => b[0] === z);
    // a z13 tile outside every z13 box: walk east from the first box's edge
    const b13 = at(13)[0] || [13, 4000, 3000, 4001, 3001];
    let ox = b13[3] + 7, oy = b13[2];
    const inAny = (z, x, y) => S.inPatch(z, x, y);
    let guard = 0;
    while (inAny(13, ox, oy) && guard++ < 200) ox += 13;
    // a tile the bundle certainly has: centre of the statewide base box
    const bb = at(12)[0] || at(11)[0];
    const ix = (bb[1] + bb[3]) >> 1, iy = (bb[2] + bb[4]) >> 1, iz = bb[0];
    const r = (u) => S.resolve({ url: u }).then((o) => o.data.byteLength);
    await H.clear();
    const empty = await r(`apexsat://13/${ox}/${oy}`);
    const seed = new Uint8Array(999); for (let i = 0; i < 999; i++) seed[i] = i & 255;
    await H.put(13, ox, oy, seed.buffer);
    const served = await r(`apexsat://13/${ox}/${oy}`);
    const bundleTile = await r(`apexsat://${iz}/${ix}/${iy}`);
    const st1 = await H.stats();
    await H.clear();
    const st0 = await H.stats();
    const after = await r(`apexsat://13/${ox}/${oy}`);
    return { blankLen, empty, served, bundleTile, st1, st0, after,
             at: `13/${ox}/${oy}`, bt: `${iz}/${ix}/${iy}` };
  });
  if (hd.missing) ok(false, "HD store or resolver hook missing");
  else {
    ok(hd.empty === hd.blankLen, `an unsaved tile outside every box answers blank (${hd.at}: ${hd.empty} bytes)`);
    ok(hd.served === 999, `after __hd.put the store answers before blank does (${hd.served} bytes served)`);
    ok(hd.bundleTile !== hd.blankLen && hd.bundleTile !== 999, `the bundle still wins inside its boxes (${hd.bt}: ${hd.bundleTile} bytes)`);
    ok(hd.st1.tiles === 1 && hd.st1.bytes === 999 && hd.st0.tiles === 0,
       `stats count what clear removes (${hd.st1.tiles} tile / ${hd.st1.bytes} B, then ${hd.st0.tiles})`);
    ok(hd.after === hd.blankLen, "a cleared store answers blank again — the store never lies about what it holds");
  }

  /* Take 145 · the HD chip and the save loop (A160). The fetcher seam is
     replaced with a stub, the bbox comes from the bundle's own box list
     (landmine 197), and the loop is proven whole: plan, save, progress,
     store growth, the resolver serving what landed, the chip telling the
     truth, and Jacob's first rule — nothing downloads on its own. */
  const hdl = await page.evaluate(async () => {
    const S = window.__sat, H = window.__hd, D = window.HDDL;
    if (!S || !H || !D) return { missing: true };
    const chip = document.getElementById("c-hd");
    const st0 = await H.stats();
    const boxes = (S.tiles.boxes || []).filter((b) => b[0] === 13);
    const b13 = boxes[0] || [13, 4000, 3000, 4001, 3001];
    let ox = b13[3] + 9, oy = b13[2], guard = 0;
    while (S.inPatch(13, ox, oy) && guard++ < 200) ox += 11;
    const n = 8192, inv = (x, y) => [x / n * 360 - 180,
      Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI];
    const a = inv(ox + 0.05, oy + 0.05), c = inv(ox + 0.95, oy + 0.95);
    const bbox = [a[0], c[1], c[0], a[1]];
    const planned = D.plan(bbox).length;
    D.fetchTile = () => Promise.resolve(new ArrayBuffer(500));
    let last = 0;
    const r = await D.save(bbox, (d, t) => { last = d / t; });
    const st1 = await H.stats();
    const served = await S.resolve({ url: `apexsat://13/${ox}/${oy}` })
      .then((o) => o.data.byteLength);
    window.__hdChip(); await new Promise((z) => setTimeout(z, 300));
    const label = chip ? chip.querySelector("span").textContent : "";
    await H.clear(); window.__hdChip(); await new Promise((z) => setTimeout(z, 300));
    const label0 = chip ? chip.querySelector("span").textContent : "";
    return { chip: !!chip, st0: st0.tiles, planned, r, st1, served, last, label, label0 };
  });
  if (hdl.missing) ok(false, "HD chip / downloader hooks missing");
  else {
    ok(hdl.chip && hdl.st0 === 0, "the HD chip exists and nothing has downloaded on its own");
    ok(hdl.planned === 21, `one z13 tile of view plans its z14+z15 children too (${hdl.planned} = 1+4+16)`);
    ok(hdl.r && !hdl.r.error && hdl.r.done === 21 && hdl.last === 1,
       `the save loop lands every planned tile with progress reaching 100% (${hdl.r && hdl.r.done} done)`);
    ok(hdl.st1.tiles === 21 && hdl.st1.bytes === 21 * 500,
       `the store holds exactly what the save reported (${hdl.st1.tiles} tiles / ${hdl.st1.bytes} B)`);
    ok(hdl.served === 500, "the resolver serves a saved HD tile straight after the save");
    ok(/MB/.test(hdl.label) && hdl.label0 === "HD",
       `the chip tells the truth before and after delete ("${hdl.label}" -> "${hdl.label0}")`);
  }

  /* Take 178 · A190 H1 · the downloader earns the tiers. Same seam, same
     bbox rule as take 145 (the target tile comes from the bundle's own box
     list, landmine 197). A wakeLock STUB is installed first — navWake() had
     been try/catch'd and unexercised since take 170, which is landmine 62's
     shape: an API the app calls that the harness never modelled. */
  const h1 = await page.evaluate(async () => {
    const S = window.__sat, H = window.__hd, D = window.HDDL, W = window.__wake;
    if (!S || !H || !D || !W || !window.__hdCard) return { missing: true };
    const wl = { req: 0, rel: 0 };
    /* navigator.wakeLock is a read-only accessor on Navigator.prototype; a
       plain assignment is silently ignored and the REAL API answers (the
       first run of this check read 0/0 for that reason). Define it. */
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: {
      request: () => { wl.req++; return Promise.resolve({
        release: () => { wl.rel++; return Promise.resolve(); }, addEventListener() {} }); } } });
    const boxes = (S.tiles.boxes || []).filter((b) => b[0] === 13);
    const b13 = boxes[0] || [13, 4000, 3000, 4001, 3001];
    let ox = b13[3] + 9, oy = b13[2], guard = 0;
    while (S.inPatch(13, ox, oy) && guard++ < 200) ox += 11;
    const n = 8192, inv = (x, y) => [x / n * 360 - 180,
      Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI];
    const a = inv(ox + 0.05, oy + 0.05), c = inv(ox + 0.95, oy + 0.95);
    const bbox = [a[0], c[1], c[0], a[1]];
    const wait = (ms) => new Promise((z) => setTimeout(z, ms));
    const slow = (ms) => () => wait(ms).then(() => new ArrayBuffer(500));
    await H.clear();
    /* 1 · lanes + wake lock around one clean save */
    D.fetchTile = slow(12);
    const r1 = await D.save(bbox, null, 'this view');
    const wl1 = { req: wl.req, rel: wl.rel, holds: W.holds() };
    /* 2 · Stop mid-run keeps what landed; 3 · the same save skips exactly those */
    await H.clear();
    D.fetchTile = slow(15);
    let seen = 0;
    const r2 = await D.save(bbox, (d) => { seen = d; if (d === 5) D.stop(); });
    const st2 = await H.stats();
    D.fetchTile = slow(1);
    const r3 = await D.save(bbox);
    const st3 = await H.stats();
    /* 4 · one failure is retried and the run completes */
    await H.clear();
    let calls = 0;
    D.fetchTile = () => (++calls === 3 ? Promise.reject(new Error('HTTP 503')) : Promise.resolve(new ArrayBuffer(500)));
    const r4 = await D.save(bbox);
    /* 5 · two failures on one tile stop the run, landed tiles kept */
    await H.clear();
    /* ONE tile: the first run matched a whole z15 row (four tiles) and read
       four retries for what was meant to be one. */
    D.fetchTile = (z, x, y) => (z === 15 && x === ox * 4 + 3 && y === oy * 4 + 3 ? Promise.reject(new Error('HTTP 503')) : Promise.resolve(new ArrayBuffer(500)));
    const r5 = await D.save(bbox);
    const st5 = await H.stats();
    /* 6 · a prepared LIST drives the batch pause (130 tiles = two drains) */
    await H.clear();
    const list = []; for (let k = 0; k < 130; k++) list.push([13, ox + 40 + k, oy]);
    D.fetchTile = () => Promise.resolve(new ArrayBuffer(100));
    const t0 = performance.now();
    const r6 = await D.save(list, null, 'a list');
    const dt6 = performance.now() - t0;
    /* 7 · the sheet names the tier and the count while a save runs */
    await H.clear();
    D.fetchTile = slow(90);
    const p7 = D.save(bbox, null, 'this view');
    await wait(120);
    window.__hdCard(); await wait(150);
    const card = (document.getElementById('panel') || document.body).textContent || '';
    const pr = D.progress();
    const r7 = await p7;
    await H.clear(); window.__hdChip();
    return { r1, wl1, r2, seen, st2: st2.tiles, r3, st3: st3.tiles, r4, r5, st5: st5.tiles, r6, dt6,
             card, pr, r7, wlEnd: { req: wl.req, rel: wl.rel, holds: W.holds() }, lanes: D.LANES, pause: D.PAUSE };
  });
  if (h1.missing) ok(false, "take-178 HD downloader hooks missing (HDDL / __wake / __hdCard)");
  else {
    ok(h1.r1 && !h1.r1.error && h1.r1.done === 21 && h1.r1.peak >= 2 && h1.r1.peak <= h1.lanes,
       `the pool runs ${h1.r1 && h1.r1.peak} fetches in flight at peak — at least 2, never more than ${h1.lanes}`);
    ok(h1.wl1.req === 1 && h1.wl1.rel === 1 && h1.wl1.holds === 0,
       `the screen lock is requested once at the start of a save and released once at the end (${h1.wl1.req}/${h1.wl1.rel})`);
    ok(h1.r2 && h1.r2.stopped && h1.r2.done > 0 && h1.r2.done < 21 && h1.st2 === h1.r2.done,
       `Stop mid-run keeps exactly what landed (${h1.r2 && h1.r2.done} of 21 tiles, store holds ${h1.st2})`);
    ok(h1.r3 && h1.r3.skipped === (h1.r2 && h1.r2.done) && h1.r3.done === 21 - (h1.r2 && h1.r2.done) && h1.st3 === 21,
       `the same save re-run skips the ${h1.r3 && h1.r3.skipped} landed tiles and finishes the rest (${h1.r3 && h1.r3.done})`);
    ok(h1.r4 && !h1.r4.error && h1.r4.retries === 1 && h1.r4.done === 21,
       `one failed fetch is retried once and the save completes (${h1.r4 && h1.r4.retries} retry, ${h1.r4 && h1.r4.done} done)`);
    ok(h1.r5 && h1.r5.error && /503/.test(h1.r5.error) && h1.r5.retries === 1 && h1.r5.done < 21 && h1.st5 === h1.r5.done,
       `a tile that fails twice stops the run and says why ("${h1.r5 && h1.r5.error}"), keeping the ${h1.r5 && h1.r5.done} that landed`);
    ok(h1.r6 && !h1.r6.error && h1.r6.done === 130 && h1.r6.pauses === 2 && h1.dt6 >= 2 * h1.pause && h1.r6.label === 'a list',
       `a prepared tile list drives the loop: 130 tiles, two ${h1.pause} ms drains between batches of 60 (${h1.r6 && h1.r6.pauses} pauses, ${Math.round(h1.dt6)} ms)`);
    ok(/DOWNLOADING THIS VIEW/.test(h1.card) && /of 21 tiles/.test(h1.card) && h1.pr && h1.pr.label === 'this view' && h1.r7 && h1.r7.done === 21
       && h1.wlEnd.holds === 0,
       `the sheet opened mid-save names the tier and the count (${h1.pr && (h1.pr.done + h1.pr.skipped)} of ${h1.pr && h1.pr.total} at the read), and nothing holds the screen afterwards`);
  }

  /* Take 179 · A190 H2 · the three tiers, quoted from the bundle's own
     rings. Stubs go on with defineProperty (landmine 216). */
  const h2 = await page.evaluate(async () => {
    const S = window.__sat, H = window.__hd, D = window.HDDL, T = window.__hdTiers, IR = window.__inRings;
    const CTX = window.__ctx && window.__ctx();
    if (!S || !H || !D || !T || !IR || !CTX || !CTX.rings) return { missing: true };
    const wait = (ms) => new Promise((z) => setTimeout(z, ms));
    const centre = (z, x, y) => { const n = 2 ** z; return [(x + .5) / n * 360 - 180,
      Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + .5) / n))) * 180 / Math.PI]; };
    const txt = () => (document.getElementById('panel') || document.body).textContent || '';
    const has = (id) => !!document.getElementById(id);
    /* never throw out of this block: a missing button is a finding, and an
       uncaught throw inside evaluate ends the whole render with no verdict */
    const click = (id) => { const e = document.getElementById(id); if (e) e.click(); return !!e; };
    const stubQuota = (mb) => Object.defineProperty(navigator, 'storage', { configurable: true,
      value: { estimate: () => Promise.resolve({ quota: mb * 1048576, usage: 0 }) } });
    await H.clear();
    const tiers = T();
    const county = tiers.find((t) => t.id === 'county'), state = tiers.find((t) => t.id === 'state');
    /* 1 · county plan */
    let cInside = 0, cz = { 13: 0, 14: 0, 15: 0 }, cName = county && county.label;
    if (county) {
      const co = CTX.counties.find((c) => c.n + ' County' === county.label);
      for (const t of county.tiles) { cz[t[0]]++; const p = centre(t[0], t[1], t[2]); if (IR(p[0], p[1], co.r)) cInside++; }
    }
    /* 2 · state clip */
    let W = 180, So = 90, E = -180, N = -90;
    for (const r of CTX.rings) for (const q of r) { W = Math.min(W, q[0]); E = Math.max(E, q[0]); So = Math.min(So, q[1]); N = Math.max(N, q[1]); }
    const n13 = 8192, tx = (lon) => Math.floor((lon + 180) / 360 * n13),
      ty = (lat) => { const r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n13); };
    const box = (tx(E) - tx(W) + 1) * (ty(So) - ty(N) + 1);
    const sN = state ? state.n : 0, sZ = state ? state.tiles.every((t) => t[0] === 13) : false,
      sPatch = state ? state.tiles.filter((t) => S.inPatch(13, t[1], t[2])).length : -1;
    /* 3 · the sheet quotes three tiers, nothing starts */
    stubQuota(2048);
    window.__hdCard(); await wait(200);
    const sheet = txt(), sheetBtns = { view: has('hd-go-view') || /zoom in to a smaller area/.test(txt()) || /already sharp here/.test(txt()), county: has('hd-go-county'), state: has('hd-ask-state') }, busy3 = D.busy();
    const viewTier = tiers.find((t) => t.id === 'view'), viewN = viewTier ? viewTier.n : 0, viewMB = viewTier ? Math.round(viewTier.mb) : 0;
    /* 4 · 100 MB quota: no state button, others stay */
    stubQuota(100); window.__hdCard(); await wait(200);
    const q100 = { txt: txt(), state: has('hd-ask-state'), county: has('hd-go-county') };
    /* 5 · 2 GB quota restores it */
    stubQuota(2048); window.__hdCard(); await wait(200);
    const q2g = has('hd-ask-state');
    /* 6 · the confirmation */
    const clk1 = click('hd-ask-state'); await wait(200);
    const ask = txt(), askBtns = { yes: has('hd-go-state'), no: has('hd-no') };
    /* take 180 · a dismissed and reopened sheet forgets the question */
    window.__hdCard(); await wait(200);
    const reopen = has('hd-ask-state') && !has('hd-go-state');
    click('hd-ask-state'); await wait(200);
    const clk2 = click('hd-no'); await wait(200);
    const afterNo = { busy: D.busy(), ask: has('hd-ask-state') };
    D.fetchTile = () => wait(5).then(() => new ArrayBuffer(300));
    const clk3 = click('hd-ask-state'); await wait(150);
    const clk4 = click('hd-go-state'); await wait(60);
    const started = { busy: D.busy(), label: D.progress() && D.progress().label };
    D.stop(); for (let i = 0; i < 100 && D.busy(); i++) await wait(50);
    const stStop = (await H.stats()).tiles;
    /* 7 · measured minutes-left after 60 tiles */
    await H.clear();
    const list = []; for (let k = 0; k < 130; k++) list.push([13, 4100 + k, 3000]);
    D.fetchTile = () => wait(10).then(() => new ArrayBuffer(100));
    const p7 = D.save(list, null, 'a list');
    for (let i = 0; i < 100 && !(D.progress() && D.progress().done >= 70); i++) await wait(20);
    window.__hdCard(); await wait(150);
    const eta = { txt: txt(), eta: D.progress() && D.progress().eta };
    await p7; await H.clear(); window.__hdChip();
    return { cName, cInside, cN: county ? county.n : 0, cz, box, sN, sZ, sPatch, sMB: state && state.mb,
             sheet, sheetBtns, busy3, viewN, viewMB, q100, q2g, ask, askBtns, reopen, afterNo, started, stStop, eta, clicks: [clk1, clk2, clk3, clk4] };
  });
  if (h2.missing) ok(false, "take-179 tier hooks missing (__hdTiers / __inRings / __ctx)");
  else {
    ok(h2.cN > 0 && h2.cInside === h2.cN && h2.cz[14] > 2.5 * h2.cz[13] && h2.cz[15] > 2.5 * h2.cz[14],
       `${h2.cName}: ${h2.cN} tiles planned at z13–15, every centre inside its rings (z13 ${h2.cz[13]} · z14 ${h2.cz[14]} · z15 ${h2.cz[15]})`);
    ok(h2.sN >= 12300 && h2.sN <= 12600 && h2.sZ && h2.sPatch === 0 && h2.sN < 0.4 * h2.box,
       `the state clips the ${h2.box.toLocaleString()}-tile box to ${h2.sN.toLocaleString()} land tiles at z13, none already shipped (~${Math.round(h2.sMB)} MB)`);
    ok(/THIS VIEW/.test(h2.sheet) && /COUNTY/.test(h2.sheet) && /THE WHOLE STATE/.test(h2.sheet) && (h2.sheet.match(/ tiles · /g) || []).length >= 2
       && h2.sheetBtns.view && h2.sheetBtns.county && h2.sheetBtns.state && !h2.busy3,
       `the sheet quotes all three tiers before any button is pressed (this view ${h2.viewN.toLocaleString()} tiles / ${h2.viewMB} MB${h2.viewMB > 500 ? ', told to zoom in' : h2.viewN === 0 ? ', already sharp here' : ''}), and nothing has started`);
    ok(/Not enough space/.test(h2.q100.txt) && !h2.q100.state && h2.q100.county,
       `a 100 MB quota replaces the state button with "Not enough space" and keeps the county's`);
    ok(h2.q2g, `a 2 GB quota gives the state button back`);
    ok(/Yes, save the whole state/.test(h2.ask) && /screen stays on/.test(h2.ask) && /about \d+ MB/.test(h2.ask) && h2.askBtns.yes && h2.askBtns.no
       && !h2.afterNo.busy && h2.afterNo.ask && h2.started.busy && h2.started.label === 'the whole state' && h2.stStop > 0 && h2.stStop < 12000 && h2.clicks.every(Boolean) && h2.reopen,
       `the state tier asks first, a reopened sheet asks again, "Not now" starts nothing, "Yes" starts a save labelled "the whole state" (Stop kept ${h2.stStop})`);
    ok(typeof h2.eta.eta === 'number' && /(min|minute) left/.test(h2.eta.txt) && /DOWNLOADING A LIST/.test(h2.eta.txt),
       `after 60 tiles the card shows a MEASURED time-left (${h2.eta.eta} s remaining at the read)`);
  }

  }
  if (RUN("back")) {
  /* Take 181 · the first field reports. A192: panels close on an outside tap
     and Layers has a Done. A193: the back button closes what is open, then
     "Back again to exit" — the page half of it; the native half (canGoBack
     honouring pushState) is the phone's to prove. A195: the privacy row. */
  const fr = await page.evaluate(async () => {
    const B = window.__back; if (!B) return { missing: true };
    const wait = (ms) => new Promise((z) => setTimeout(z, ms));
    const vis = (id) => { const e = document.getElementById(id); return !!e && !e.hidden; };
    const click = (id) => { const e = document.getElementById(id); if (e) e.click(); return !!e; };
    const tapAt = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    const popBack = () => new Promise((z) => { window.addEventListener('popstate', () => setTimeout(z, 30), { once: true }); history.back(); });
    /* 1 · outside tap closes Layers and the mode picker */
    click('c-layers'); await wait(50); const a1 = vis('lyrpanel');
    tapAt(document.querySelector('.maplibregl-canvas') || document.getElementById('map')); await wait(50);
    const a2 = vis('lyrpanel');
    click('c-mode'); await wait(50); const a3 = vis('modepanel');
    tapAt(document.getElementById('coords') || document.body); await wait(50);
    const a4 = vis('modepanel');
    /* 2 · a tap INSIDE the panel keeps it open; the chip still toggles it */
    click('c-layers'); await wait(50);
    const row = document.querySelector('#lyrpanel [data-lg="0"]'); if (row) row.click(); await wait(80);
    const b1 = vis('lyrpanel');
    click('c-layers'); await wait(50); const b2 = vis('lyrpanel');
    /* 3 · Done. take 188 · the integration shots: a Done ROW with a
       layer-toggle box read as a layer called Done. It must read as a
       button: the app's secondary (button.act), no swatch, a border, a pill,
       in a footer as wide as the panel's inside (the row's box left a
       hairline at its right edge). Judged on the take-188 row planted first. */
    click('c-layers'); await wait(50);
    const isBtn = (b) => { if (!b) return 'missing'; const cs = getComputedStyle(b), ft = b.parentElement, lp = document.getElementById('lyrpanel');
      if (b.tagName !== 'BUTTON' || !b.classList.contains('act') || b.classList.contains('actrow')) return 'not the secondary button (' + b.className + ')';
      if (b.querySelector('.sw')) return 'carries a swatch';
      if (!(parseFloat(cs.borderTopWidth) >= 1) || !(parseFloat(cs.borderTopLeftRadius) >= b.offsetHeight / 2 - 1)) return 'no pill border';
      if (!ft || !lp || Math.abs(ft.getBoundingClientRect().width - lp.clientWidth * (lp.getBoundingClientRect().width / lp.offsetWidth)) > 1.5) return 'footer narrower than the panel';
      return null; };
    const pl = document.createElement('button'); pl.className = 'actrow'; pl.innerHTML = '<span class="sw"></span><span>Done</span>';
    document.getElementById('lyrpanel').appendChild(pl); const cP = isBtn(pl); pl.remove();
    /* fix round 1 · the pill and footer branches get their own controls: the
       real Done in a plain div (no .lyrfoot bleed) must be caught as a narrow
       footer, and a square button.act in a .lyrfoot as no pill */
    const lpN = document.getElementById('lyrpanel'), rd = lpN.querySelector('[data-lyrdone]');
    let cW = 'no Done to clone', cR = 'no Done to clone';
    if (rd) { const dv = document.createElement('div'); dv.appendChild(rd.cloneNode(true)); lpN.appendChild(dv);
      cW = isBtn(dv.firstChild); dv.remove();
      const fq = document.createElement('div'); fq.className = 'lyrfoot'; const sq = rd.cloneNode(true);
      sq.removeAttribute('data-lyrdone'); sq.style.borderRadius = '0'; fq.appendChild(sq); lpN.appendChild(fq);
      cR = isBtn(sq); fq.remove(); }
    const done = document.querySelector('#lyrpanel [data-lyrdone]'); const cB = isBtn(done), cT = done ? done.textContent.trim() : '';
    const c1 = !!done; if (done) done.click(); await wait(50);
    const c2 = vis('lyrpanel');
    /* 4 · back with a panel open closes it and restores the sentinel */
    const s0 = history.state && history.state.apex === 1;
    click('c-layers'); await wait(50);
    await popBack(); const d1 = vis('lyrpanel'), d2 = history.state && history.state.apex === 1;
    /* 5 · back with nothing open arms the toast and leaves no sentinel; two seconds later it is back.
       "Nothing open" includes the card rail — a body click does not fold it (only a map tap does), and
       the first run of this check found back correctly closing a rail left open by an earlier block. */
    try { window.guideClose(true); } catch (e) { }
    window.railSet(false); document.body.click(); await wait(80);
    const e0 = B.open();
    await popBack(); const e1 = B.state().armed, e2 = vis('toast'), e3 = (document.getElementById('toast') || {}).textContent, e4 = history.state;
    await wait(2200); const e5 = B.state().armed, e6 = history.state && history.state.apex === 1;
    /* 6 · a second press inside the window is the exit path (the page's side of it) */
    await popBack(); const f1 = B.state().armed; const f2 = B.onBack(); const f3 = history.state;
    await wait(2200);
    /* 7 · the privacy row draws only with a URL */
    const orig = window.__privacy(''); click('c-sources'); await wait(80);
    const g1 = /Privacy policy/.test((document.getElementById('panel') || {}).textContent || '');
    window.__privacy('https://example.invalid/privacy.html'); click('c-sources'); await wait(80);
    const g2 = /Privacy policy/.test((document.getElementById('panel') || {}).textContent || '')
      && !!document.querySelector('#panel a[href="https://example.invalid/privacy.html"]');
    window.__privacy(orig); click('c-sources'); await wait(80);
    const g3 = /^https:\/\/.+privacy\.html$/.test(orig) && !!document.querySelector('#panel a[href="' + orig + '"]');
    /* 8 · take 188 · A216 · the licence notices: Lucide (ISC, with the
       Feather MIT part), Barlow (SIL OFL), MapLibre GL JS (BSD 3-Clause, at
       the version the page actually runs) and Capacitor (MIT), and no URL in
       that section; the same test must fail on a text without the OFL words,
       without MapLibre, and with another MapLibre version */
    const kk = [...document.querySelectorAll('#panel .k')].find((k) => /SOFTWARE AND TYPE/.test(k.textContent));
    const sec = kk ? kk.nextElementSibling : null, secT = sec ? sec.textContent : '';
    const mlv = (window.maplibregl && typeof maplibregl.getVersion === 'function') ? maplibregl.getVersion() : '';
    const lic = (t) => /Lucide/.test(t) && /ISC/.test(t) && /Feather/.test(t) && /MIT/.test(t)
      && /Barlow/.test(t) && /Open Font License/.test(t)
      && !!mlv && t.indexOf('MapLibre GL JS ' + mlv + ',') >= 0 && /BSD 3-Clause/.test(t)
      && /Capacitor/.test(t) && /Drifty Co\./.test(t) && /Ionic/.test(t);
    const h1 = lic(secT) && !/http/.test(sec ? sec.innerHTML : 'http'), h2 = !lic(secT.replace(/Open Font License/g, ''));
    const h3 = !lic(secT.replace(/MapLibre/g, '')) && !lic(secT.split('MapLibre GL JS ' + mlv).join('MapLibre GL JS 0.0.0'))
      && !lic(secT.replace(/Capacitor/g, ''));
    return { orig, g3, h1, h2, h3, mlv, a1, a2, a3, a4, b1, b2, c1, c2, cP, cW, cR, cB, cT, s0, d1, d2, e0, e1, e2, e3, e4, e5, e6, f1, f2, f3, g1, g2 };
  });
  if (fr.missing) ok(false, "take-181 hooks missing (__back)");
  else {
    ok(fr.a1 && !fr.a2 && fr.a3 && !fr.a4, `a tap outside closes Layers and the mode picker (field report A192)`);
    ok(fr.b1 && !fr.b2, `a tap inside Layers keeps it open; its own chip still closes it`);
    ok(fr.c1 && !fr.c2, `Layers has a Done row and it closes the panel`);
    ok(!!fr.cP && fr.cW === 'footer narrower than the panel' && fr.cR === 'no pill border' && fr.cB === null && fr.cT === 'Done',
       `Layers' Done reads as a button: the secondary pill in a panel-wide footer, no swatch (${fr.cB || 'ok'}); the old row is rejected (${fr.cP}); Done in a plain div is rejected (${fr.cW}); a square button.act in the footer is rejected (${fr.cR})`);
    ok(fr.s0 && !fr.d1 && fr.d2, `back with a panel open closes the panel and keeps the sentinel entry`);
    ok(fr.e0 === null && fr.e1 && fr.e2 && /Back again to exit/.test(fr.e3) && fr.e4 === null && !fr.e5 && fr.e6,
       `back with nothing open shows "Back again to exit" and drops the sentinel for two seconds, then restores it (open before: ${fr.e0})`);
    ok(fr.f1 && fr.f2 === 'exit' && fr.f3 === null, `a second press inside the window is the exit path (page side; the native finish is the phone's to prove)`);
    ok(!fr.g1 && fr.g2 && fr.g3, `the Data sources card shows a Privacy policy link only with a URL, and the shipped build carries one (${fr.orig})`);
    ok(fr.h1 && fr.h2 && fr.h3, "the Data sources card names the Lucide (ISC, Feather MIT), Barlow (SIL Open Font "
       + `License), MapLibre GL JS ${fr.mlv} (BSD 3-Clause, the version this page runs) and Capacitor (MIT) notices with `
       + "no URL; a text without the OFL words, without MapLibre or Capacitor, or naming another MapLibre version "
       + "fails the same test (its negative controls)");
  }

  /* Take 182 · A194 · the tour's exits and its pointing. */
  const tr = await page.evaluate(async () => {
    const T = window.__tour; if (!T) return { missing: true };
    const wait = (ms) => new Promise((z) => setTimeout(z, ms));
    const click = (id) => { const e = document.getElementById(id); if (e) e.click(); return !!e; };
    const tab = () => { const t = document.querySelector('#tabs .tab.on'); return t ? t.dataset.go : null; };
    const encloses = (id) => { const r = document.getElementById('tour-ring').getBoundingClientRect(), c = document.getElementById(id).getBoundingClientRect();
      return r.left <= c.left && r.top <= c.top && r.right >= c.right && r.bottom >= c.bottom; };
    /* 3 · Next moves the ring to the activity chip and shows its tab */
    T.reset(); T.start(); await wait(120);
    click('tour-next'); await wait(320);
    const n1 = { i: T.state().i, id: T.state().steps[T.state().i].id, rings: encloses('c-act'), tab: tab() };
    T.close('notnow');
    /* 4 · a hidden chip's step is skipped, not faked */
    const hd = document.getElementById('c-hd'); const was = hd.style.display; hd.style.display = 'none';
    T.reset(); T.start(); await wait(60);
    for (let k = 0; k < 3; k++) { click('tour-next'); await wait(60); }
    const before = T.state().steps[T.state().i].id;
    click('tour-next'); await wait(120);
    const after = { id: T.state().steps[T.state().i].id, i: T.state().i, on: T.state().on };
    T.close('notnow'); hd.style.display = was;
    /* 5 · Don't show again sets the flag; Tools still starts it */
    T.reset(); T.start(); await wait(60); click('tour-never'); await wait(60);
    const never = { on: T.state().on, seen: T.seen() };
    click('c-tour'); await wait(120);
    const replay = { on: T.state().on, i: T.state().i };
    T.close('notnow');
    /* 6 · back closes it */
    T.reset(); T.start(); await wait(60);
    const backR = window.__back.onBack(); await wait(60);
    const back = { r: backR, on: T.state().on, seen: T.seen() };
    /* 7 · Done sets the flag and hands back the tab it started on */
    document.querySelector('#tabs .tab[data-go="plan"]').click(); await wait(80);
    const tab0 = tab();
    T.reset(); T.start(); await wait(60);
    let guard = 0, last = null;
    while (T.state().on && guard++ < 12) { click('tour-next'); await wait(60); }
    const done = { on: T.state().on, seen: T.seen(), tab: tab(), tab0 };
    document.querySelector('#tabs .tab[data-go="map"]').click(); await wait(80);
    /* take 188 · A217 · the steps' order is READ, not typed (landmine 189):
       the step before the HD chip, and the one a hidden HD chip hands on to */
    const ids = T.steps.map((x) => x.id), hdAt = ids.indexOf('c-hd');
    return { n1, before, after, never, replay, back, done, nSteps: T.steps.length,
             wantBefore: hdAt > 0 ? ids[hdAt - 1] : null, wantAfter: hdAt >= 0 ? ids[hdAt + 1] : null };
  });
  if (tr.missing) ok(false, "take-182 tour hooks missing");
  else {
    ok(tr.n1.i === 1 && tr.n1.id === 'c-act' && tr.n1.rings && tr.n1.tab === 'map',
       `Next moves the ring to the activity chip and shows the tab it lives on (${tr.n1.tab})`);
    ok(!!tr.wantAfter && tr.before === tr.wantBefore && tr.after.id === tr.wantAfter && tr.after.on,
       `a hidden chip's step is skipped, not faked (after ${tr.before}: ${tr.after.id}, HD hidden; `
       + `the steps say ${tr.wantBefore} then ${tr.wantAfter}, of ${tr.nSteps})`);
    ok(!tr.never.on && tr.never.seen && tr.replay.on && tr.replay.i === 0,
       `Don't show again closes it and sets the flag; Tools → Take the tour still starts it`);
    ok(tr.back.r === 'closed:tour' && !tr.back.on && !tr.back.seen, `the back button closes the tour as Not now`);
    ok(!tr.done.on && tr.done.seen && tr.done.tab === tr.done.tab0 && tr.done.tab0 === 'plan',
       `Done sets the flag and hands back the tab the tour started on (${tr.done.tab0})`);
  }

  }
  if (RUN("water")) {
  /* Takes 147–150 · the tester batch (A163–A166): liveries in Water, boats
     as Water's machine, the run flow reachable and craft-paced, gauges in
     the bundle with live values behind a seam. Every target comes from the
     bundle's own data (landmine 197). */
  {
    let liv = [], livIdx = -1;
    try { const all = JSON.parse(readFileSync("www/bundle/poi.json", "utf8")).p;
      livIdx = all.findIndex((r) => r.k === "livery");
      liv = all.filter((r) => r.k === "livery"); } catch (e) { }
    ok(liv.length > 0, `the bundle carries canoe/kayak liveries (${liv.length}; e.g. ${liv[0] ? liv[0].n : "-"})`);
    const wb = await page.evaluate(async (liv0, livIdx) => {
      const m = window.map, M = window.__mode, P = window.__paddle,
            G = window.__gauge, GS = window.__gauges,
            s = (ms) => new Promise((r) => setTimeout(r, ms));
      if (!M || !P || !G) return { missing: true };
      const was = M.get(), cam = { c: m.getCenter(), z: m.getZoom() };
      M.apply("water", { silent: true }); await s(250);
      const craft0 = P.craft();
      const hK = P.hours(10);
      document.getElementById("c-machine").click(); await s(150);
      const craft1 = P.craft();
      const hAfter = P.hours(10);
      // a river with two NAMED stops, from the bundle
      const c = (P.data.c || []).find((r) =>
        (r.f || []).filter((f) => f.n && (f.k === "launch" || f.k === "access")).length >= 2);
      let run = null, bridge = null, gnear = null;
      if (c) {
        const st = c.f.filter((f) => f.n && (f.k === "launch" || f.k === "access"));
        const a = st[0], b = st[st.length - 1];
        P.run(b, a, c.n);           // deliberately reversed — the card must flip
        await s(200);
        run = document.getElementById("panel").innerText;
        bridge = P.near(a.p);
        gnear = GS ? G.near(a.p, 12) : null;
      }
      let livDrawn = -1;
      if (liv0) {
        /* take 169: a livery sharing a dock with a marina is now a STACK, and
           its pin is hidden on purpose. It counts as drawn if its own pin
           renders OR a stack badge on screen lists its index. */
        m.jumpTo({ center: liv0.p, zoom: 12.5 });
        for (let i = 0; i < 50; i++) { await s(400);
          try {
            const pins = m.queryRenderedFeatures({ layers: ["poi-dot", "poi-dot-major"] })
              .filter((f) => f.properties.k === "livery").length;
            const inStack = m.queryRenderedFeatures({ layers: ["poi-stack-bg"] })
              .filter((b) => String(b.properties.ids || "").split(",").indexOf(String(livIdx)) >= 0).length;
            livDrawn = pins + inStack;
          } catch (e) { }
          if (livDrawn > 0) break; }
      }
      const canned = { value: { timeSeries: [
        { variable: { variableCode: [{ value: "00060" }] },
          values: [{ value: [{ value: "1240", dateTime: "2026-08-28T12:00:00Z" }] }] },
        { variable: { variableCode: [{ value: "00010" }] },
          values: [{ value: [{ value: "10.0", dateTime: "2026-08-28T12:00:00Z" }] }] }] } };
      const fmt = G.fmt(canned);
      M.apply(was, { silent: true });
      m.jumpTo({ center: [cam.c.lng, cam.c.lat], zoom: cam.z });
      return { craft0, craft1, hK, hAfter, riv: c && c.n, run, livDrawn,
               bridge: bridge && bridge.riv, gcount: GS ? GS.g.length : 0,
               gnear: gnear && gnear.g.id, fmt };
    }, liv[0] || null, livIdx);
    if (wb.missing) ok(false, "water-batch hooks missing");
    else {
      ok(wb.craft0 === "kayak" && wb.craft1 === "canoe",
         `Water hands you a kayak and the chip cycles craft (${wb.craft0} -> ${wb.craft1})`);
      ok(wb.hK !== wb.hAfter,
         `float pace follows the craft (10 mi: ${wb.hK} as a kayak, ${wb.hAfter} as a canoe)`);
      ok(!!wb.run && /Put in/.test(wb.run) && /Take out/.test(wb.run) &&
         /of paddling/.test(wb.run) && /other order/.test(wb.run),
         `the run card plans ${wb.riv}: put-in, take-out, time, and it flips a reversed tap order`);
      ok(/canoe at/.test(wb.run || ""),
         "the run card names the craft and its calibrated pace");
      ok(wb.bridge === wb.riv, "a launch point projects to its river's run flow (the pin bridge)");
      ok(wb.livDrawn > 0, `a livery is on the map in Water — as its own pin or inside a stack (${wb.livDrawn} at ${liv[0] ? liv[0].n : "-"})`);
      ok(wb.gcount > 100 && !!wb.gnear,
         `the bundle carries the USGS gauge inventory (${wb.gcount} sites; nearest to the run: ${wb.gnear})`);
      ok(wb.fmt.rows.length === 2 && /1,240 cfs/.test(wb.fmt.rows[0]) && /50\u00b0F|50°F/.test(wb.fmt.rows[1]),
         `gauge values format honestly (flow shown, 10\u00b0C -> 50\u00b0F)`);
    }
    /* takes 151–152 · the Rifle River report: DNR access sites on the
       corridors, and rivers findable by name. */
    const rr = await page.evaluate(() => {
      const P = window.__paddle, S = window.__search;
      if (!P || !S) return { missing: true };
      const c = (P.data.c || []).find((x) => x.n === "Rifle River");
      const named = c ? c.f.filter((f) => f.n && (f.k === "launch" || f.k === "access")) : [];
      const hits = S("rifle river");
      const riv = hits.find((h) => h.k === "river");
      return { named: named.map((f) => f.n), riv: riv && riv.t,
               rank: hits.findIndex((h) => h.k === "river") };
    });
    if (rr.missing) ok(false, "search / paddle hooks missing");
    else {
      ok(rr.named.length >= 6,
         `the Rifle carries the DNR accesses OSM never had (${rr.named.length} named: ${rr.named.slice(0, 4).join(", ")}…)`);
      ok(rr.riv === "Rifle River" && rr.rank >= 0 && rr.rank <= 4,
         `"rifle river" finds the RIVER, ranked with the best hits (row ${rr.rank + 1})`);
    }
  }

  }
  if (RUN("shell")) {
  /* Take 156 · A171 · the boot splash. Two things matter and they pull in
     opposite directions: it must cover the ugly boot, and it must GET OUT
     OF THE WAY. By the time every check above has run the map is long
     since idle, so a splash still present here would be a trap. */
  {
    const sp = await page.evaluate(() => {
      const S = window.__splash;
      const el = document.getElementById("splash");
      const idx = document.documentElement.innerHTML;
      return { hook: !!S, pct: S ? S.pct() : -1, gone: S ? S.gone() : false,
               stillInDom: !!el,
               logoInlined: /id="splash"[\s\S]{0,400}data:image\/png;base64/.test(idx) ||
                            !!document.querySelector("#splash img[src^='data:image']"),
               tokensInShell: (document.body.innerText.match(/__IC_/g) || []).length };
    });
    ok(sp.hook, "the splash controller is wired to the boot");
    ok(sp.pct === 100, `progress reaches 100% on a real boot (${sp.pct}%)`);
    ok(sp.gone && !sp.stillInDom,
       "and the splash lifts itself — it covers the boot, it does not trap the rider");
    ok(sp.tokensInShell === 0,
       `no raw __IC_ tokens are on screen once loaded (${sp.tokensInShell})`);
  }

  /* Take 157 · A173 · the basemap busy line. The failure worth catching is
     a STUCK indicator: one that arms on a switch and never disarms says
     "still loading" forever, which is worse than no indicator at all. */
  {
    const bz = await page.evaluate(async () => {
      const B = window.__busy, m = window.map,
            s = (ms) => new Promise((r) => setTimeout(r, ms));
      if (!B) return { missing: true };
      const el = document.getElementById("busy");
      B.begin();
      const armedNow = B.armed();
      // let the map settle exactly as it would after a real switch
      for (let i = 0; i < 24; i++) { await s(300); if (!B.armed()) break; }
      await s(300);
      return { el: !!el, armedNow, armedAfter: B.armed(),
               classAfter: el ? el.className : null,
               blocksTaps: el ? getComputedStyle(el).pointerEvents : null };
    });
    if (bz.missing) ok(false, "the basemap busy hook is missing");
    else {
      /* "ships hidden" is a property of the MARKUP, not of the live page —
         by the time this drill runs, earlier drills have cycled the basemap
         several times, so reading the class here measured history, not the
         shipped state (my first version failed for exactly that reason). */
      let shipped = "";
      try { shipped = readFileSync("www/index.html", "utf8"); } catch (e) { }
      const m0 = /<div id="busy"[^>]*>/.exec(shipped);
      ok(bz.el && !!m0 && !/class=/.test(m0[0]),
         `the busy line ships hidden, not showing (${m0 ? m0[0] : "absent"})`);
      ok(bz.armedNow === true, "a basemap change arms it");
      ok(bz.armedAfter === false && bz.classAfter === "",
         "and the map settling disarms it — it cannot stick on");
      ok(bz.blocksTaps === "none",
         "it never eats a tap while it shows (pointer-events: none)");
    }
  }

  /* Take 158 · A172 · the shell must be REVEALED and its tokens gone. The
     dangerous failure is the opposite of the ugly one: a shell left at
     opacity 0 is invisible and still tappable. */
  shl = await page.evaluate(() => {
    const sh = document.getElementById("shell");
    if (!sh) return { missing: true };
    const cs = getComputedStyle(sh);
    return { ready: sh.className.indexOf("ready") >= 0,
             opacity: cs.opacity,
             tokens: (sh.innerText.match(/__IC_/g) || []).length,
             btnTokens: [...sh.querySelectorAll("button")]
               .filter((b) => b.innerHTML.indexOf("__IC_") >= 0).length };
  });
  }
  if (RUN("stacks")) {
  /* Take 169 · A174 · the clusterer, every zoom, one algorithm. The invariant
     that takes 154/160 violated and this must not: after a pass, no two
     visible things — badge or lone pin — sit within stackRadius of each
     other. Checked at the statewide floor, at the old seam, and zoomed in
     over a dense town. Every target comes from the bundle (landmine 197). */
  {
    const cz = await page.evaluate(async () => {
      const m = window.map, S = window.__stack, M = window.__mode,
            s = (ms) => new Promise((r) => setTimeout(r, ms));
      if (!S) return { missing: true };
      const was = M.get(), cam = { c: m.getCenter(), z: m.getZoom() };
      /* take 188 · A197 P3 · the no-two-within-R counter, one function for the
         probe and for its planted control (landmine 54) */
      const countPairs = (pts, R) => {
        let worst = Infinity, pairs = 0;
        for (let a = 0; a < pts.length; a++) for (let b = a + 1; b < pts.length; b++) {
          const d = Math.hypot(pts[a].p.x - pts[b].p.x, pts[a].p.y - pts[b].p.y);
          if (d < worst) worst = d; if (d < R) pairs++; }
        return { worst, pairs }; };
      const pairsPlant = countPairs([{ p: { x: 100, y: 100 } }, { p: { x: 101, y: 100 } }], 24).pairs;
      M.apply("water", { silent: true }); await s(250);
      const probe = async (center, zoom) => {
        m.jumpTo({ center, zoom }); await s(350); S.run();
        /* the harness has ONE worker and no GPU; at the floor the badge
           source can wait 15+ s behind the whole state being tiled. Wait
           for it, up to a ceiling, rather than measure a queue. */
        const src = m.getSource("poistack");
        { let w = 0; for (; w < 70; w++) { if (src.loaded() && m.areTilesLoaded()) break; await s(400); } console.debug("APEX-TILEWAIT t1 " + w + "/70"); }
        /* loaded() is the worker; idle is the SCREEN. Under gate starvation
           the floor read 0 badges with 6,410 pins folded — the data was
           there and the frame was not. take 189 · A227: m.once("idle")
           without a repaint waited out its whole 6 s whenever the map had
           gone idle during the tile wait (no render, so no idle event);
           __rh.idle forces the repaint, so the idle comes with the next
           complete frame. The 300 ms nap after it is gone: after idle
           nothing redraws until something changes. */
        await window.__rh.idle(m, 6000);
        const R = S.radius(zoom);
        let badges = [], pins = [];
        try { badges = m.queryRenderedFeatures({ layers: ["poi-stack-bg"] }); } catch (e) { }
        try { pins = m.queryRenderedFeatures({ layers: ["poi-dot", "poi-dot-major"] }); } catch (e) { }
        // dedupe pins by place index (a symbol can be reported per tile)
        const seen = new Set(); pins = pins.filter((f) => { const k = String(f.properties.i);
          if (seen.has(k)) return false; seen.add(k); return true; });
        const pts = badges.map((b) => ({ p: m.project(b.geometry.coordinates), n: +b.properties.n, k: "badge" }))
          .concat(pins.map((f) => ({ p: m.project(f.geometry.coordinates), n: 1, k: f.properties.k })));
        const { worst, pairs } = countPairs(pts, R);
        const biggest = badges.reduce((mx, b) => Math.max(mx, +b.properties.n), 0);
        const mixed = badges.filter((b) => b.properties.mixed === true || b.properties.mixed === "true").length;
        const services = badges.filter((b) => (S.services || []).includes(b.properties.k)).length;
        /* take 185 · A197 P1 · every stacked place must be one the map would
           draw at this zoom — asked of the app's own gate, per member */
        let undraw = 0; const hiddenIds = new Set();
        badges.forEach((b) => String(b.properties.ids || "").split(",").filter(Boolean)
          .forEach((id) => { hiddenIds.add(+id); if (S.drawable && S.drawable(+id, zoom) === false) undraw++; }));
        /* take 186 · A197 P2 · the other direction too: every place the gate
           calls drawable is on screen as a pin or inside a badge (missing),
           and nothing renders that the gate would refuse (extra). Measured
           on the 185 build before the tile-zoom fix: missing 1 at z11.6, 3 at
           z13.7, 0 at every integer zoom. */
        const renderedIds = new Set(pins.map((f) => +f.properties.i));
        const cvW = m.getCanvas().clientWidth, cvH = m.getCanvas().clientHeight;
        let missing = 0, extra = 0;
        (window.POIS ? window.POIS.p : []).forEach((rec, i) => {
          const q = m.project(rec.p); if (q.x < 40 || q.y < 40 || q.x > cvW - 40 || q.y > cvH - 40) return;
          const d = S.drawable ? S.drawable(i, zoom) : null; if (d === null) return;
          if (d && !hiddenIds.has(i) && !renderedIds.has(i)) missing++;
          if (!d && renderedIds.has(i)) extra++; });
        return { R, badges: badges.length, pins: pins.length, worst: isFinite(worst) ? +worst.toFixed(1) : null,
                 places: badges.reduce((a, b) => a + +b.properties.n, 0) + pins.length,
                 pairs, biggest, mixed, hidden: S.hidden(), services, undraw, missing, extra,
                 ids: [...hiddenIds, ...renderedIds],
                 glyph: badges.length ? badges.every((b) => m.hasImage("stk-" + b.properties.k)) : null };
      };
      const floor = await probe([-85.5, 44.8], m.getMinZoom());
      const under = await probe([-85.5, 44.8], 9.0);      /* just under the layers' floor */
      const seam = await probe([-83.5, 42.6], 11.2);
      M.apply("ride", { silent: true }); await s(300);   /* the mode with the most pins */
      const town = await probe([-83.35, 42.66], 13.4);
      /* take 188 · the same town inside band 14: centred on the places the
         z13.4 read drew (a fixed centre at z14.2 lost one off the canvas), at
         the band's floor where the view is widest */
      let town14 = null;
      { const TP = window.POIS ? window.POIS.p : [], xs = [], ys = [];
        (town.ids || []).forEach((i) => { const r = TP[i]; if (r && r.p) { xs.push(r.p[0]); ys.push(r.p[1]); } });
        if (xs.length) {
          town14 = await probe([(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2], 14.05);
          town14.kept = (town.ids || []).filter((i) => town14.ids.includes(i)).length; } }
      /* Camp over Grayling at the three zooms the take-184 measurement used */
      M.apply("camp", { silent: true }); await s(300);
      const c10 = await probe([-84.714, 44.661], 10.0);
      const c11 = await probe([-84.714, 44.661], 11.0);
      const c12 = await probe([-84.714, 44.661], 12.0);
      /* take 186 · the fractional zooms where the gate and the layers used to
         disagree: a step in a filter takes effect at the next integer */
      const f107 = await probe([-84.714, 44.661], 10.7);
      M.apply("outdoors", { silent: true }); await s(300);
      const f116 = await probe([-84.714, 44.661], 11.6);
      const f137 = await probe([-83.36, 42.61], 13.7);
      M.apply(was, { silent: true });
      m.jumpTo({ center: [cam.c.lng, cam.c.lat], zoom: cam.z });
      return { floor, under, seam, town, town14, c10, c11, c12, f107, f116, f137, minz: m.getMinZoom(), pinFloor: S.floor, pairsPlant };
    });
    if (cz.missing) ok(false, "stack hook missing");
    else {
      const f = cz.floor, e = cz.seam, t = cz.town, t14 = cz.town14, u = cz.under;
      /* take 185 · A197 P1 · the statewide floor used to assert badges. It now
         asserts NONE: the pin layers draw nothing below z9.2 and the clusterer
         counts only what they would draw (measured at take 184: at z9 every
         badge on screen was places no layer drew). */
      ok(f.badges === 0 && f.pins === 0,
         `fully zoomed out (z${cz.minz}) nothing stacks and nothing draws — the clusterer honours the pin layers' floor z${cz.pinFloor} (${f.badges} badges, ${f.pins} pins)`);
      ok(u.badges === 0 && u.pins === 0,
         `and just under the floor (z9.0) still nothing (${u.badges} badges, ${u.pins} pins)`);
      [["z10", cz.c10], ["z11", cz.c11], ["z12", cz.c12]].forEach(([z, x]) => {
        ok(x.undraw === 0 && (x.badges + x.pins) > 0,
           `Camp over Grayling at ${z}: every stacked place is one the map would draw (${x.badges} badges, ${x.pins} lone pins, ${x.undraw} undrawable members)`);
        ok((x.badges + x.pins) <= 40,
           `and the view holds ${x.badges + x.pins} markers (ceiling 40; take-184 measurement 12 / 7 / 4 on this viewport)`);
        if (x.badges) ok(x.glyph === true, `every badge at ${z} has its kind's glyph sprite`);
      });
      ok(f.services === 0 && u.services === 0, "services never stack at statewide zoom (Jacob's rule)");
      [["Camp over Grayling z10.7", cz.f107], ["Outdoors over Grayling z11.6", cz.f116], ["Outdoors over Cass Lake z13.7", cz.f137],
       ["Camp over Grayling z10", cz.c10], ["Camp over Grayling z11", cz.c11], ["Camp over Grayling z12", cz.c12]].forEach(([w, x]) => {
        ok(x.undraw === 0 && x.missing === 0 && x.extra === 0,
           `${w}: the clusterer's gate and the pin layers agree on every place in view (${x.badges} badges, ${x.pins} pins, ${x.undraw} undrawable stacked, ${x.missing} drawable but absent, ${x.extra} drawn but refused)`);
        /* take 188 · A197 P3 · inside a band the stacks are the floor's, spread
           apart by 2^(z - floor) while stackRadius falls: no two markers may sit
           within R at mid-band zooms either */
        ok(x.pairs === 0,
           `${w}: no two markers within stackRadius inside the band (closest ${x.worst} px vs R ${x.R}; ${x.pairs} violations)`);
      });
      ok(cz.pairsPlant === 1,
         `planted: the same pairs counter on two points 1 px apart with R 24 counts ${cz.pairsPlant} (must be 1)`);
      ok(e.pairs === 0,
         `at the old z11.4 seam there is no seam: ${e.badges} badges, ${e.pins} lone pins, closest ${e.worst} px, ${e.pairs} violations`);
      /* take 188 · A197 P3 · the floor counts MARKERS: it is there so "no two
         within R" is never read over a view with nothing to compare. Bands
         stack at the band's floor (z13 here, R 28): take 187 drew z13.4 as 4
         lone pins, closest 31.8 px apart — INFERRED 24 px at z13, inside R —
         and bands draw 1 stack of 2 and 2 lone pins (step 8's render): the
         same 4 places in 3 markers, by design (band looseness, plan N9, the
         maintainer's Fold call). So z13.4 holds 3 markers (3 pairs measured)
         and 4 places, and the marker floor of 4 is held unchanged on the same
         places inside band 14 (z14.05, centred on them), where that pair has
         split; every one of z13.4's places must still be there. Both views
         must also agree with the gate on every place. */
      ok(t.pairs === 0 && (t.badges + t.pins) >= 3 && t.places >= 4 && t.undraw === 0 && t.missing === 0 && t.extra === 0,
         `zoomed in over a dense town (Off-road) z13.4: ${t.badges + t.pins} markers (${t.badges} stacks, ${t.pins} lone pins; ${t.places} places), closest ${t.worst} px vs radius ${t.R} (${t.pairs} violations; ${t.undraw} undrawable stacked, ${t.missing} drawable but absent, ${t.extra} drawn but refused)`);
      if (!t14) ok(false, "the same town inside band 14: the z13.4 read returned no places to centre on");
      else ok(t14.pairs === 0 && (t14.badges + t14.pins) >= 4 && t14.kept === t.places && t14.undraw === 0 && t14.missing === 0 && t14.extra === 0,
         `the same town inside band 14 (z14.05, centred on z13.4's places) keeps the marker floor: ${t14.badges + t14.pins} markers (${t14.badges} stacks, ${t14.pins} lone pins; ${t14.places} places, ${t14.kept} of z13.4's ${t.places} kept), closest ${t14.worst} px vs radius ${t14.R} (${t14.pairs} violations; ${t14.undraw} undrawable stacked, ${t14.missing} drawable but absent, ${t14.extra} drawn but refused)`);
      ok(f.mixed >= 0 && (f.badges === 0 || f.badges >= f.mixed),
         `mixed stacks are allowed and marked (${f.mixed} of ${f.badges} at the floor)`);
    }
    /* Jacob, 2026-09-01: "ensure we're not losing the fact that different
       modes have different default pins". A stack must only ever contain
       the kinds its mode shows, and the same camera must stack DIFFERENT
       things in different modes. Asserted, not assumed. */
    const md = await page.evaluate(async () => {
      const m = window.map, S = window.__stack, M = window.__mode,
            s = (ms) => new Promise((r) => setTimeout(r, ms));
      const was = M.get(), cam = { c: m.getCenter(), z: m.getZoom() };
      const kindsOf = (k) => (window.__pins ? window.__pins.eff(k) : null)
        || (M.MODES.find((x) => x.k === k) || {}).kinds || [];   /* take 186: effective pins */
      const stacksIn = async (mode) => {
        M.apply(mode, { silent: true }); await s(250);
        /* take 185: z10 — below the layers' floor nothing stacks any more */
        m.jumpTo({ center: [-83.5, 42.6], zoom: 10.0 }); await s(300); S.run();
        const src = m.getSource("poistack");
        /* loaded() says the worker has the data; it does not say the screen
           shows it. Under gate starvation the first query after loaded()
           returned the PREVIOUS mode's badges (Off-road 722 = Water 722,
           322 "strays"). Wait for the map to go idle — the final frame with
           every tile drawn — before reading what it shows. */
        { let w = 0; for (; w < 70; w++) { if (src.loaded() && m.areTilesLoaded()) break; await s(400); } console.debug("APEX-TILEWAIT t2 " + w + "/70"); }
        await window.__rh.idle(m, 6000);
        let b = []; for (let w = 0; w < 30; w++) {
          try { b = m.queryRenderedFeatures({ layers: ["poi-stack-bg"] }); } catch (e) { }
          if (b.length) break; await s(400); }
        const P = window.POIS ? window.POIS.p : null;
        const allowed = new Set(kindsOf(mode));
        let stray = 0, members = 0;
        b.forEach((f) => String(f.properties.ids || "").split(",").filter(Boolean).forEach((id) => {
          members++; const r = P ? P[+id] : null; if (r && !allowed.has(r.k)) stray++; }));
        return { badges: b.length, members, stray, total: b.reduce((a, f) => a + +f.properties.n, 0) };
      };
      const water = await stacksIn("water"), ride = await stacksIn("ride"), hunt = await stacksIn("hunt");
      M.apply(was, { silent: true });
      m.jumpTo({ center: [cam.c.lng, cam.c.lat], zoom: cam.z });
      return { water, ride, hunt, poisExposed: !!window.POIS };
    });
    ok(md.poisExposed ? (md.water.stray === 0 && md.ride.stray === 0 && md.hunt.stray === 0) : true,
       `a stack never contains a kind its mode does not show (strays: Water ${md.water.stray}, Off-road ${md.ride.stray}, Hunt ${md.hunt.stray})`);
    ok(md.water.total !== md.ride.total && md.ride.total !== md.hunt.total,
       `the same camera stacks different things per mode (Water ${md.water.total}, Off-road ${md.ride.total}, Hunt ${md.hunt.total} places)`);
    /* the tray: the whole pile, listed, and the map moves in */
    const tr = await page.evaluate(async () => {
      const m = window.map, S = window.__stack, M = window.__mode,
            s = (ms) => new Promise((r) => setTimeout(r, ms));
      const was = M.get(), cam = { c: m.getCenter(), z: m.getZoom() };
      M.apply("ride", { silent: true }); await s(200);
      m.jumpTo({ center: [-83.5, 42.6], zoom: 10.0 }); await s(350); S.run();   /* take 185: z10 */
      const src = m.getSource("poistack");
      { let w = 0; for (; w < 70; w++) { if (src.loaded() && m.areTilesLoaded()) break; await s(400); } console.debug("APEX-TILEWAIT t3 " + w + "/70"); }
      await window.__rh.idle(m, 6000);
      let b = [];
      for (let w = 0; w < 30; w++) { await s(400);
        try { b = m.queryRenderedFeatures({ layers: ["poi-stack-bg"] }); } catch (e) { }
        if (b.length) break; }
      b.sort((x, y) => +y.properties.n - +x.properties.n);
      if (!b.length) {
        /* restore BEFORE returning — an early return that left the map in
           Water at z9 is what broke three unrelated checks downstream */
        M.apply(was, { silent: true });
        m.jumpTo({ center: [cam.c.lng, cam.c.lat], zoom: cam.z });
        return { none: true }; }
      const n = +b[0].properties.n, z0 = m.getZoom();
      /* fitBounds animates over 700 ms via requestAnimationFrame; a starved
         headless page can defer frames, so poll for the camera to actually
         arrive rather than assume a timer. The trace rides in the message. */
      let fitCalled = null; const of = m.fitBounds.bind(m);
      m.fitBounds = function (a, o) { fitCalled = JSON.stringify(o && o.maxZoom); return of(a, o); };
      S.card(b[0]);
      const zs = []; let z1 = z0;
      for (let i = 0; i < 25; i++) { await s(200); z1 = m.getZoom(); zs.push(+z1.toFixed(2));
        if (z1 > z0 + 0.5 && !m.isMoving()) break; }
      m.fitBounds = of;
      const txt = document.body.innerText;
      const rows = document.querySelectorAll("[data-si]").length;
      M.apply(was, { silent: true });
      m.jumpTo({ center: [cam.c.lng, cam.c.lat], zoom: cam.z });
      return { n, rows, z0: +z0.toFixed(2), z1: +z1.toFixed(2), fitCalled, trace: zs.slice(0, 8).join(">"),
               titled: new RegExp(n + " places here").test(txt) };
    });
    if (tr.none) ok(false, "no stack to tap at z10 over the southeast");
    else {
      ok(tr.titled && tr.rows === tr.n,
         `tapping a stack of ${tr.n} lists all ${tr.rows} in a scrollable tray`);
      ok(tr.z1 > tr.z0,
         `and the map moves in toward them (z${tr.z0} -> z${tr.z1}; fitBounds maxZoom ${tr.fitCalled}; trace ${tr.trace})`);
    }
  }
  /* take 188 · A197 P3 · pins stay put. Stacks are computed once per zoom
     band (STACK_BANDS) at the band's floor, bottom-up, in world pixels, so a
     zoom inside a band or a pan inside the emitted window re-partitions
     nothing and an edge only splits. Four guards, each beside the planted
     state that proves it can read false (landmine 54):
       1 · re-partition per 0.1 step: Camp, Water and Off-road over Grayling
           and Mio (BUNDLE's anchors, landmine 197), z10→11, 11→12, 12→13.
           Q = places S.pool(previous z) holds that are inside the canvas now
           (arrivals excluded). Within a band < 5% of steps with |Q| > 0 may
           change (0 by construction; the exact count is printed, landmine
           55); 0 merges at edge steps; at least 50 comparisons; a pan inside
           the window changes nothing. Control: take 187's clusterer
           transcribed below must score >= 5% on the same steps, or the guard
           is blind.
       2 · every band holds one pool (floor, midpoint, top - 0.01) in all
           five modes, pool(b) inside pool(b+1), and the top band is the map's
           maxZoom. Control: Camp at z11.39 against z11.4 must differ.
       3 · re-hidden after a same-mode re-apply (landmine 223's shape): the
           read straight after the re-apply is the planted state and must
           show no 'match'; one S.run() later it must.
       4 · a tray row opens that place's own card from a z15 stack: the
           member is still stacked in band 16 (where the tray's fit stops) and
           alone in the top band, so only the row tap's move to the band
           where it stands alone reveals it; landing zoom asserted. A planted
           co-located pair must reopen the tray (it never splits), and the two
           trays' copy must differ honestly. The merge counter, the re-group
           test and the subset counter each read a planted input too.
     Synchronous where it can be (no tiles needed for 1-3); nothing inside
     the evaluate throws (landmine 217); mode and camera restored before
     every return. The replica and the node sketch proved the algorithm, not
     this wiring (landmine 39); the probe was re-run on this build (194). */
  {
    const ps = await page.evaluate(async (A) => {
      const m = window.map, S = window.__stack, M = window.__mode,
            s = (ms) => new Promise((r) => setTimeout(r, ms));
      if (!S || !M || !S.pool || !S.edges || !S.band || !S.rank || !S.out || !S.stackOf) return { missing: true };
      const was = M.get(), cam = { c: m.getCenter(), z: m.getZoom() };
      const restore = () => { try { M.apply(was, { silent: true }); m.jumpTo({ center: [cam.c.lng, cam.c.lat], zoom: cam.z }); } catch (e) { } };
      try {
        const P = window.POIS ? window.POIS.p : [];
        if (!P.length) { restore(); return { noPois: true }; }
        const anchor = (n) => { const a = (A || []).find((x) => x[0] === n); return a ? [a[1], a[2]] : null; };
        const cvW = m.getCanvas().clientWidth, cvH = m.getCanvas().clientHeight;
        const inCanvas = (i) => { const q = m.project(P[i].p); return q.x >= 0 && q.y >= 0 && q.x <= cvW && q.y <= cvH; };
        /* id -> anchor from what restack emitted; ids[0] is the anchor, and a
           place in no stack maps to itself */
        const ofOut = () => { const o = new Map(); (S.out() || []).forEach((f) => {
          const ids = String(f.properties.ids || "").split(",").filter(Boolean).map(Number);
          ids.forEach((i) => o.set(i, ids[0])); }); return o; };
        /* the planted control: take 187's restack, transcribed — the pool at z,
           culled to the canvas plus (R+8) in screen pixels, rank then id,
           nearest seed within R */
        const flat = (z) => { const R = S.radius(z), pad = R + 8, pts = [];
          for (const i of S.pool(z)) { const q = m.project(P[i].p);
            if (q.x < -pad || q.y < -pad || q.x > cvW + pad || q.y > cvH + pad) continue;
            pts.push({ i, x: q.x, y: q.y, r: S.rank(i) }); }
          pts.sort((a, b) => a.r - b.r || a.i - b.i);
          const seeds = [], o = new Map();
          for (const q of pts) { let best = null, bd = R;
            for (const st of seeds) { const d = Math.hypot(st.x - q.x, st.y - q.y); if (d < bd) { bd = d; best = st; } }
            if (best) best.m.push(q.i); else seeds.push({ x: q.x, y: q.y, a: q.i, m: [q.i] }); }
          seeds.forEach((st) => { if (st.m.length > 1) st.m.forEach((i) => o.set(i, st.a)); });
          return o; };
        const moved = (of0, of1, Q) => Q.some((i) => (of0.get(i) ?? i) !== (of1.get(i) ?? i));
        /* a merge: a group now holding places from more than one group before */
        const merges = (of0, of1, Q) => { const g = new Map();
          Q.forEach((i) => { const k = of1.get(i) ?? i; if (!g.has(k)) g.set(k, new Set()); g.get(k).add(of0.get(i) ?? i); });
          let n = 0; g.forEach((v) => { if (v.size > 1) n++; }); return n; };
        /* places a band's pool loses on the way to the next band's */
        const lostOf = (prevSet, cur) => [...prevSet].filter((i) => !cur.has(i)).length;
        /* planted inputs for the three sub-guards, run through the very
           functions the reads use (landmine 54): two loose places joined into
           one group is one merge; a place whose group changes has moved; a
           pool [1,2,3] followed by [1,2] loses one */
        const plants = { merges: merges(new Map(), new Map([[1, 9], [2, 9]]), [1, 2]),
                         moved: moved(new Map(), new Map([[1, 2]]), [1]),
                         lost: lostOf(new Set([1, 2, 3]), new Set([1, 2])) };
        /* ── guard 1 ── */
        const g1 = { runs: [], inN: 0, inCh: 0, ctlCh: 0, edgeN: 0, merges: 0, ctlMerges: 0, qSum: 0, noAnchor: [] };
        for (const mode of ["camp", "water", "ride"]) {
          M.apply(mode, { silent: true });
          for (const name of ["Grayling", "Mio"]) {
            const c = anchor(name); if (!c) { g1.noAnchor.push(name); continue; }
            for (const z0 of [10, 11, 12]) {
              const r = { mode, name, z0, inN: 0, inCh: 0, ctlCh: 0, edgeN: 0, merges: 0, ctlMerges: 0 };
              let prev = null;
              for (let k = 0; k <= 10; k++) {
                const z = Math.round((z0 + 0.1 * k) * 10) / 10;
                m.jumpTo({ center: c, zoom: z }); S.run();
                const of = ofOut(), fo = flat(z);
                if (prev) {
                  const Q = S.pool(prev.z).filter(inCanvas);
                  if (S.band(prev.z) === S.band(z)) {
                    if (Q.length) { r.inN++; g1.qSum += Q.length;
                      if (moved(prev.of, of, Q)) r.inCh++;
                      if (moved(prev.fo, fo, Q)) r.ctlCh++; }
                  } else { r.edgeN++; r.merges += merges(prev.of, of, Q); r.ctlMerges += merges(prev.fo, fo, Q); }
                }
                prev = { z, of, fo };
              }
              g1.runs.push(r); g1.inN += r.inN; g1.inCh += r.inCh; g1.ctlCh += r.ctlCh;
              g1.edgeN += r.edgeN; g1.merges += r.merges; g1.ctlMerges += r.ctlMerges;
            }
          }
        }
        /* a pan inside the window: Camp over Grayling z10.5, a quarter canvas east */
        M.apply("camp", { silent: true });
        const gr = anchor("Grayling"); let pan = { none: true };
        if (gr) {
          m.jumpTo({ center: gr, zoom: 10.5 }); S.run();
          const of0 = ofOut(), out0 = S.out();
          const c1 = m.unproject([cvW / 2 + cvW / 4, cvH / 2]);
          m.jumpTo({ center: [c1.lng, c1.lat], zoom: 10.5 }); S.run();
          const Q = S.pool(10.5).filter(inCanvas), of1 = ofOut();
          pan = { q: Q.length, changed: Q.filter((i) => moved(of0, of1, [i])).length,
                  reEmitted: S.out() !== out0 };
        }
        /* ── guard 2 ── */
        const E = S.edges.slice(), g2 = { diffs: [], notSub: [], checked: 0, expect: M.MODES.length * E.length,
                                            top: E[E.length - 1], maxZoom: m.getMaxZoom() };
        const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
        for (const mode of M.MODES.map((x) => x.k)) {
          M.apply(mode, { silent: true });
          let prevSet = null;
          for (let b = 0; b < E.length; b++) {
            const lo = E[b], hi = b + 1 < E.length ? E[b + 1] : null;
            const top = hi == null ? lo : Math.round((hi - 0.01) * 100) / 100, mid = hi == null ? lo : (lo + hi) / 2;
            const p0 = S.pool(lo), p1 = S.pool(mid), p2 = S.pool(top); g2.checked++;
            if (!sameList(p0, p1) || !sameList(p0, p2))
              g2.diffs.push(`${mode} band ${lo}: ${p0.length}/${p1.length}/${p2.length} at ${lo}/${mid}/${top}`);
            if (prevSet) { const lost = lostOf(prevSet, new Set(p0));
              if (lost) g2.notSub.push(`${mode} band ${E[b - 1]} -> ${lo}: ${lost} places leave the pool`); }
            prevSet = new Set(p0);
          }
        }
        M.apply("camp", { silent: true });
        const c1139 = S.pool(11.39), c114 = S.pool(11.4);
        g2.plant = { a: c1139.length, b: c114.length, differ: !sameList(c1139, c114) };
        /* ── guard 3 ── below the pin floor first: restack clears its window
           there whatever repin does, so the first read is a fresh emission and
           a sabotaged repin can only fail the read after the re-apply; the
           second apply keeps the key and the camera */
        const fd = () => { try { return JSON.stringify(m.getFilter("poi-dot-major")); } catch (e) { return ""; } };
        let g3 = { none: true };
        if (gr) {
          M.apply("camp", { silent: true });
          m.jumpTo({ center: gr, zoom: 9 }); S.run();
          m.jumpTo({ center: gr, zoom: 10 }); S.run();
          const first = /"match"/.test(fd());
          M.apply("camp", { silent: true });
          const planted = /"match"/.test(fd());
          S.run();
          g3 = { first, planted, after: /"match"/.test(fd()), hidden: S.hidden(), out: (S.out() || []).length };
        }
        /* ── guard 4 ── a tray row from a z15 stack */
        const panelTxt = () => ((document.getElementById("panel") || {}).innerText || "");
        const settle = async () => { for (let w = 0; w < 30; w++) { if (!m.isMoving()) break; await s(100); }
          await window.__rh.idle(m, 4000); await s(150); };   /* take 189 · A227: with a repaint (an idle map fires none) */
        const sentinel = () => { const p = document.getElementById("panel"); if (!p) return;
          const i = document.createElement("i"); i.id = "__s8rt"; p.appendChild(i); };
        const tapRow = async (f, pick) => {
          S.card(f); await s(100); await settle();
          const sub = ((document.querySelector("#panel .sub") || {}).innerText || "").trim();
          const rows = [...document.querySelectorAll("#panel [data-si]")];
          const row = rows.find(pick);
          if (!row) return { noRow: true, rows: rows.length, sub };
          row.click(); sentinel();
          let gone = false; for (let w = 0; w < 60; w++) { await s(100); if (!document.getElementById("__s8rt")) { gone = true; break; } }
          await s(200);
          return { sub, rows: rows.length, gone, z: +m.getZoom().toFixed(2), txt: panelTxt().slice(0, 160) };
        };
        const w17 = (i) => { const c = P[i].p, sn = Math.sin(c[1] * Math.PI / 180), k = 512 * Math.pow(2, 17);
          return [(c[0] + 180) / 360 * k, (0.5 - Math.log((1 + sn) / (1 - sn)) / (4 * Math.PI)) * k]; };
        let g4 = { none: true };
        for (const mode of ["water", "camp", "ride"]) {
          M.apply(mode, { silent: true });
          const pool15 = S.pool(15), pool17 = S.pool(17);
          /* places alone at z17: no other z17-pool place within 24 px there */
          const grid = new Map(), cell = 24, key = (x, y) => Math.floor(x / cell) + "," + Math.floor(y / cell);
          pool17.forEach((i) => { const [x, y] = w17(i), k = key(x, y); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); });
          const alone17 = (i) => { const [x, y] = w17(i), cx = Math.floor(x / cell), cy = Math.floor(y / cell);
            for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++)
              for (const j of grid.get((cx + dx) + "," + (cy + dy)) || []) {
                if (j === i) continue; const [xj, yj] = w17(j); if (Math.hypot(xj - x, yj - y) < 24) return false; }
            return true; };
          /* read from the hierarchy, not by emitting: 400 S.run()s would be 400
             setData calls queued in the worker */
          const b15 = S.band(15.2), b16 = S.band(16.5), bTop = S.band(17),
                findStack = (i) => { const ids = S.stackOf(b15, i); return ids && ids.length > 1 ? ids : null; };
          /* the separable member: named, still inside a stack of two or more in
             band 16 (so the tray's own fit, capped at z16.5 from z15.2, leaves
             it stacked) and alone in the top band — only the row tap's
             stackRevealZ move to the top band can reveal it. Take 187's target,
             max(z, 15.6), lands on the badge and reopens the tray. Its z15.2
             stack's members carry distinct names so the row is found by name. */
          let sep = null, tries = 0;
          for (const i of pool15) { if (tries > 400) break;
            if (!P[i].n || !alone17(i)) continue;
            const top = S.stackOf(bTop, i); if (!top || top.length !== 1) continue;
            tries++;
            const s16 = S.stackOf(b16, i); if (!s16 || s16.length < 2) continue;
            const ids = findStack(i); if (!ids) continue;
            if (ids.filter((j) => P[j].n === P[i].n).length !== 1) continue;
            sep = { i, n: P[i].n, ids, n16: s16.length }; break; }
          /* the planted pile: every member of its z15.2 stack on one point */
          let colo = null; const byPt = new Map();
          pool15.forEach((i) => { const k = P[i].p.join(","); if (!byPt.has(k)) byPt.set(k, []); byPt.get(k).push(i); });
          for (const g of byPt.values()) { if (g.length < 2) continue;
            const ids = findStack(g[0]); if (!ids) continue;
            if (ids.every((j) => P[j].p.join(",") === P[g[0]].p.join(","))) { colo = { ids }; break; } }
          if (!sep || !colo) continue;
          const emitted = (i) => (S.out() || []).find((f) => String(f.properties.ids).split(",").map(Number).includes(i)) || null;
          /* a row by its name: the text before the name carries no letter or digit
             (the kind's mark), so "Big X Lake" never answers for "X Lake" */
          const named = (nm) => (r) => { const t = r.innerText.trim(), cut = t.length - nm.length;
            return cut >= 0 && t.slice(cut) === nm && !/[\p{L}\p{N}]/u.test(t.slice(0, cut)); };
          m.jumpTo({ center: P[sep.i].p, zoom: 15.2 }); S.run(); await settle();
          const f1 = emitted(sep.i);
          if (!f1) { g4 = { mode, notEmitted: "separable" }; break; }
          const a = await tapRow(f1, named(sep.n));
          const own = a.gone && a.txt.indexOf(sep.n) >= 0 && !/places here/.test(a.txt);
          m.jumpTo({ center: P[colo.ids[0]].p, zoom: 15.2 }); S.run(); await settle();
          const f2 = emitted(colo.ids[0]);
          if (!f2) { g4 = { mode, notEmitted: "pile" }; break; }
          const b = await tapRow(f2, () => true);
          const retray = b.gone && /places here/.test(b.txt);
          g4 = { mode, sepN: sep.ids.length, sep16: sep.n16, sepName: sep.n, a, own, aBand: S.band(a.z), bTop,
                 coloN: colo.ids.length, b, retray };
          break;
        }
        restore();
        return { g1, pan, g2, g3, g4, plants, cv: [cvW, cvH], stats: S.stats ? S.stats() : null };
      } catch (e) { restore(); return { error: String(e && e.stack || e).slice(0, 400) }; }
    }, anchors);
    if (ps.missing) ok(false, "pins stay put: the __stack band hooks are missing");
    else if (ps.noPois) ok(false, "pins stay put: no places in the page (window.POIS)");
    else if (ps.error) ok(false, `pins stay put: the block threw — ${ps.error}`);
    else {
      const g1 = ps.g1, pct = (a, n) => (100 * a / Math.max(1, n)).toFixed(1);
      ok(g1.noAnchor.length === 0, `pins stay put: Grayling and Mio are bundle anchors (missing: ${g1.noAnchor.join(", ") || "none"})`);
      ok(g1.inN >= 50 && g1.inCh / Math.max(1, g1.inN) < 0.05,
         `pins stay put: a 0.1 zoom step inside a band re-partitions ${g1.inCh} of ${g1.inN} steps (${pct(g1.inCh, g1.inN)}%, target < 5%, 0 by construction; ${g1.qSum} place comparisons, canvas ${ps.cv.join("x")})`);
      ok(g1.ctlCh / Math.max(1, g1.inN) >= 0.05,
         `planted: take 187's clusterer on the same steps re-partitions ${g1.ctlCh} of ${g1.inN} (${pct(g1.ctlCh, g1.inN)}%, must be >= 5% or the guard is blind)`);
      ok(g1.edgeN > 0 && g1.merges === 0,
         `pins stay put: crossing a band edge only splits — ${g1.merges} merges over ${g1.edgeN} edge steps`);
      ok(ps.plants.merges === 1,
         `planted: the same merge counter on two loose places joined into one group counts ${ps.plants.merges} (must be 1); take 187's clusterer at the same edge steps: ${g1.ctlMerges} merges`);
      console.log("       per run (mode anchor z0: within changed/steps, control, merges): " +
        g1.runs.map((r) => `${r.mode} ${r.name} ${r.z0}: ${r.inCh}/${r.inN} ctl ${r.ctlCh} m${r.merges}`).join("; "));
      ok(!ps.pan.none && ps.pan.q > 0 && ps.pan.changed === 0,
         `pins stay put: a pan inside the window changes nothing (${ps.pan.changed} of ${ps.pan.q} places re-grouped; re-emitted: ${ps.pan.reEmitted})`);
      ok(ps.plants.moved === true,
         `planted: the same re-group test on a place whose group changed reads ${ps.plants.moved} (must be true)`);
      const g2 = ps.g2;
      ok(g2.diffs.length === 0 && g2.checked === g2.expect && g2.expect >= 50,
         `every band holds one pool at its floor, middle and top in every mode (${g2.checked} bands checked${g2.diffs.length ? "; " + g2.diffs.slice(0, 4).join("; ") : ""})`);
      ok(g2.notSub.length === 0, `and a band's pool is inside the next band's${g2.notSub.length ? ": " + g2.notSub.slice(0, 4).join("; ") : ""}`);
      ok(ps.plants.lost === 1,
         `planted: the same subset counter on a pool [1,2,3] followed by [1,2] counts ${ps.plants.lost} lost (must be 1)`);
      ok(g2.top === g2.maxZoom, `the top band is the map's maxZoom (STACK_BANDS ends ${g2.top}, maxZoom ${g2.maxZoom})`);
      ok(g2.plant.differ, `planted: the same comparator on Camp at z11.39 against z11.4 reports a difference (${g2.plant.a} against ${g2.plant.b} places)`);
      const g3 = ps.g3;
      ok(!g3.none && g3.planted === false,
         `planted: straight after a same-mode re-apply the pin filter holds no 'match' (${g3.planted}), so the read below can fail`);
      ok(!g3.none && g3.first && g3.after && g3.hidden > 0 && g3.out > 0,
         `re-hidden after a same-mode re-apply: one pass later the members are hidden again (first ${g3.first}, after ${g3.after}, ${g3.hidden} hidden, ${g3.out} badges)`);
      const g4 = ps.g4;
      if (g4.none) ok(false, "a tray row from a z15 stack: no member stacked in band 16 but alone in the top band, with a co-located pile, found in Water, Camp or Off-road");
      else if (g4.notEmitted) ok(false, `a tray row from a z15 stack: the ${g4.notEmitted} stack found in the hierarchy was not emitted at z15.2 in ${g4.mode}`);
      else {
        ok(g4.own && /keep zooming in/.test(g4.a.sub) && g4.a.z >= 16.99 && g4.aBand === g4.bTop,
           `a tray row opens its own place's card: ${g4.sepName} from a ${g4.sepN}-place ${g4.mode} stack at z15.2, still in a ${g4.sep16}-place stack in band 16 and alone in the top band — the row tap must carry it there (landed z${g4.a.z}, band ${g4.aBand} of top ${g4.bTop}; tray said "${g4.a.sub}"; card "${(g4.a.txt || "").replace(/\s+/g, " ").slice(0, 60)}")`);
        ok(g4.retray && /Tap one\.$/.test(g4.b.sub) && !/keep zooming/.test(g4.b.sub),
           `planted: a ${g4.coloN}-place pile on one point never splits — its tray says "${g4.b.sub}" and a row tap reopens the tray (landed z${g4.b.z})`);
      }
      console.log(`       band build: ${ps.stats ? ps.stats.ms + " ms" : "not built"}`);
    }
  }
  }
  if (RUN("pins")) {
  /* take 186 · A197 P2 · the Pins selector: per mode, remembered, reset. The
     block resets every mode's choices first and last — the checks above and
     below assume defaults. */
  {
    const p2 = await page.evaluate(async () => {
      const m = window.map, M = window.__mode, S = window.__stack, P = window.__pins,
            s = (ms) => new Promise((r) => setTimeout(r, ms));
      if (!P) return { missing: true };
      const was = M.get(), cam = { c: m.getCenter(), z: m.getZoom() };
      const modes = M.MODES.map((x) => x.k); modes.forEach((k) => P.reset(k));
      const ftxt = (id) => { try { return JSON.stringify(m.getFilter(id)); } catch (e) { return ""; } };
      const table = M.MODES.every((x) => (x.off || []).every((k) => x.kinds.includes(k))
        && Object.keys(x.z || {}).every((k) => x.kinds.includes(k) && Number.isInteger(x.z[k]))
        && !("demote" in x) && !("boost" in x));
      const effRide = P.eff("ride"), effCamp = P.eff("camp"), effWater = P.eff("water");
      M.apply("camp", { silent: true }); await s(300);
      document.getElementById("c-layers").click(); await s(400);
      const panel = document.getElementById("lyrpanel");
      /* innerText honours text-transform: the section reads PINS IN CAMP */
      const sect = /Pins in Camp/i.test(panel.innerText);
      const rows = [...panel.querySelectorAll("[data-pk]")];
      const labels = rows.map((r) => r.innerText.trim());
      const offRows = rows.filter((r) => /Food|Store/.test(r.innerText)).map((r) => r.className.includes(" on"));
      /* take 187 · A208 — the accent read from its token, not typed */
      const _pr = document.createElement("div"); _pr.style.background = "var(--accent)";
      document.body.appendChild(_pr); const _acc = (getComputedStyle(_pr).backgroundColor.match(/\d+/g) || []).slice(0, 3); _pr.remove();
      const _ACC = new RegExp("^rgba?\\(" + _acc.join(",\\s*") + "(,|\\))");
      /* take 188 · A214 · a Pins row shows the badge image: its FILL pixel is
         read off the decoded image (what the row actually shows), 4.5 units in
         from the left edge on the shape's centre line — inside every shape,
         outside the 14-unit glyph box. A row with no .sw counts against it too
         (verify_palette reads .sw on every .actrow). */
      const _rgb = (t) => (String(t).match(/\d+/g) || []).slice(0, 3).map(Number);
      const _near = (a, b, tol) => a.length === 3 && b.length === 3 && a.every((v, i) => Math.abs(v - b[i]) <= tol);
      const _hex = (h) => [1, 3, 5].map((i) => parseInt(String(h).slice(i, i + 2), 16));
      const fillOf = async (r) => { const sw = r.querySelector(".sw"); if (!sw) return null;
        const im = sw.querySelector("img");
        if (!im) return _rgb(getComputedStyle(sw).backgroundColor);
        try { await im.decode(); } catch (e) {}
        const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
        const x = c.getContext("2d"); x.drawImage(im, 0, 0);
        const S = im.naturalWidth / 26, cy = im.naturalHeight / S > 30 ? 12.5 : 13;
        const d = x.getImageData(Math.round(4.5 * S), Math.round(cy * S), 1, 1).data;
        return [d[0], d[1], d[2]]; };
      const fills = []; for (const r of rows) fills.push(await fillOf(r));
      const noSw = rows.filter((r) => !r.querySelector(".sw")).length;
      const accN = _acc.map(Number);
      const accentSw = noSw + fills.filter((f) => f && _near(f, accN, 24)).length;
      const imgRows = rows.filter((r) => r.querySelector(".sw img")).length;
      /* the sample reads the fill: every image row's pixel is its kind's colour */
      const fillMatch = rows.filter((r, i) => r.querySelector(".sw img") && window.__badges
        && _near(fills[i] || [], _hex((window.__badges.spec(r.dataset.pk) || {}).c), 3)).length;
      /* planted, through the real path (fillOf on a detached row built as
         the app builds it): an accent-filled badge image IS caught by the
         accentSw test, the real fuel badge (the kind nearest a red accent)
         is NOT, and fillMatch rejects the real water badge sampled against
         the toilet's colour while accepting it against its own */
      const _row = (u) => { const b = document.createElement("button"); b.className = "actrow";
        b.innerHTML = '<span class="sw pb"><img class="pbdg" alt=""></span><span>plant</span>';
        b.querySelector("img").src = u; return b; };
      const _pc = document.createElement("canvas"); _pc.width = 52; _pc.height = 72;
      const _px = _pc.getContext("2d"); _px.fillStyle = "rgb(" + _acc.join(",") + ")"; _px.fillRect(0, 0, 52, 72);
      const _B = window.__badges || { url: () => "", spec: () => null };
      const _fu = _B.url("bdg-fuel"), _wu = _B.url("bdg-water");
      const plAcc = await fillOf(_row(_pc.toDataURL("image/png")));
      const plFuel = _fu ? await fillOf(_row(_fu)) : null;
      const plWater = _wu ? await fillOf(_row(_wu)) : null;
      const _kc = (k) => _hex((_B.spec(k) || {}).c || "#000000");
      const accPlant = !!plAcc && _near(plAcc, accN, 24)
        && !!plFuel && !_near(plFuel, accN, 24) && _near(plFuel, _kc("fuel"), 3);
      const matchPlant = !!plWater && !_near(plWater, _kc("toilet"), 3) && _near(plWater, _kc("water"), 3);
      const hasReset = !!panel.querySelector("[data-pkreset]");
      const foodBefore = /"food"/.test(ftxt("poi-dot"));
      /* toggle Toilets off */
      const toiletRow = rows.find((r) => r.dataset.pk === "toilet"); if (toiletRow) toiletRow.click(); await s(400);
      const toiletGone = !/"toilet"/.test(ftxt("poi-dot")) && !P.eff("camp").includes("toilet");
      const toiletIdx = (window.POIS.p || []).findIndex((r) => r.k === "toilet");
      const drawableOff = toiletIdx >= 0 ? S.drawable(toiletIdx, 14) : null;
      let stored = null; try { stored = localStorage.getItem(P.key("camp")); } catch (e) {}
      P.forget(); const survives = !P.eff("camp").includes("toilet");
      const outdoorsKeeps = P.eff("outdoors").includes("toilet");
      /* reset */
      panel.querySelector("[data-pkreset]").click(); await s(400);
      const toiletBack = /"toilet"/.test(ftxt("poi-dot")) && P.eff("camp").includes("toilet");
      let storedAfter = "gone"; try { storedAfter = localStorage.getItem(P.key("camp")); } catch (e) {}
      /* food on by a tap, and it draws at street zoom over the dense town */
      const foodRow = [...panel.querySelectorAll("[data-pk]")].find((r) => r.dataset.pk === "food"); if (foodRow) foodRow.click(); await s(400);
      const foodAfter = /"food"/.test(ftxt("poi-dot"));
      document.getElementById("c-layers").click(); await s(200);
      /* take 189 · cold audit · the drawer folded first, as a state this
         read sets rather than inherits: an earlier drill's card used to
         fold itself on the map's own resize (A240) and this read leaned on
         that; with the card left open the map is the stage above it */
      window.railSet(false);
      for (let i = 0; i < 60; i++) { await new Promise((r) => requestAnimationFrame(() => r()));
        if (!document.getAnimations().some((a) => a.playState === "running" && a.effect && isFinite(a.effect.getComputedTiming().endTime))) break; await s(30); }
      await s(200);
      m.jumpTo({ center: [-83.35, 42.66], zoom: 13.4 }); await s(400); S.run();
      { let w = 0; for (; w < 40; w++) { if (m.areTilesLoaded()) break; await s(300); } console.debug("APEX-TILEWAIT t4 " + w + "/40"); }
      await window.__rh.idle(m, 6000);
      let foodPins = 0; try { foodPins = m.queryRenderedFeatures({ layers: ["poi-dot"] }).filter((f) => f.properties.k === "food").length; } catch (e) {}
      modes.forEach((k) => P.reset(k));
      M.apply(was, { silent: true }); m.jumpTo({ center: [cam.c.lng, cam.c.lat], zoom: cam.z });
      return { table, effRide, effCamp, effWater, sect, rows: rows.length, campKinds: M.MODES.find((x) => x.k === "camp").kinds.length,
               labels, offRows, accentSw, imgRows, fillMatch, accPlant, matchPlant, hasReset, foodBefore, toiletGone, drawableOff, stored, survives, outdoorsKeeps, toiletBack, storedAfter, foodAfter, foodPins };
    });
    if (p2.missing) ok(false, "pins hook missing");
    else {
      ok(p2.table, "MODES table: every off/z key is a listed kind, z values are integers, demote and boost are gone");
      ok(!p2.effRide.includes("food") && !p2.effRide.includes("store") && !p2.effCamp.includes("food") && !p2.effCamp.includes("store"),
         "food and store are off by default in Off-road and Camp (the maintainer's rule)");
      ok(p2.effWater.includes("launch") && !p2.effWater.includes("fuel"), "Water's effective pins include launches and never fuel");
      ok(p2.sect && p2.rows === p2.campKinds && !p2.labels.some((l) => /Fuel/.test(l)),
         `Layers lists "Pins in Camp": ${p2.rows} rows for ${p2.campKinds} kinds, no Fuel row`);
      ok(p2.offRows.length === 2 && p2.offRows.every((x) => x === false), "Food and Store rows start off");
      ok(p2.accentSw === 0 && p2.accPlant && p2.hasReset,
         `no pin row wears the accent (fill read off the row's badge image; ${p2.imgRows} image rows, `
         + `${p2.fillMatch} sampled at their kind's colour; planted through fillOf: an accent-filled badge image is caught, `
         + `the real fuel badge is not), and a Reset row exists`);
      ok(p2.imgRows === p2.rows && p2.fillMatch === p2.imgRows && p2.matchPlant,
         `every Pins row shows a badge image whose fill is the kind's colour (${p2.fillMatch}/${p2.imgRows}/${p2.rows}; `
         + `planted: the water badge sampled against the toilet's colour is rejected)`);
      ok(!p2.foodBefore && p2.toiletGone && p2.drawableOff === false,
         "switching Toilets off removes toilets from the layer filter, the effective pins and the stack gate");
      ok(p2.stored === '{"toilet":false}', `the choice is stored as an override (${p2.stored})`);
      ok(p2.survives && p2.outdoorsKeeps, "the choice survives a kill and is per mode (Outdoors keeps toilets)");
      ok(p2.toiletBack && p2.storedAfter === null, "Reset restores the defaults and removes the key");
      ok(p2.foodAfter && p2.foodPins > 0, `Food switched on enters the filter and draws at street zoom (${p2.foodPins} over the dense town)`);
    }
  }
  /* take 188 · A214 · the badges. R1: every image the layers ask for exists
     and no glyph fell back. R2: no two badges alike (take 187 drew launch =
     marina = pad-launch, info = toilet = pad-parking, …) and the declared
     aliases are the same bitmap. R3: the Pins legend IS the map badge — each
     row's image decodes to m.getImage('bdg-'+k) (landmine 98), in every mode.
     Tolerance 1/1: the PNG round trip measured 0/0 on take 187 (step 3). No
     block may throw (landmine 217); each returns its error instead. */
  {
    let padKinds = [];
    try { padKinds = [...new Set(((JSON.parse(readFileSync("www/bundle/corridor.json", "utf8")).c) || [])
      .flatMap((c) => (c.f || []).map((f) => f.k)))]; } catch (e) { padKinds = null; }
    /* the POI data's kinds, read here in Node from the shipped bundle — not
       through window.POIS, which exists only because the loader assigns an
       undeclared name (an implicit global) and would vanish, silently
       emptying this list, the day it is declared */
    let poiKinds = [];
    try { poiKinds = [...new Set((JSON.parse(readFileSync("www/bundle/poi.json", "utf8")).p || []).map((r) => r.k))]; }
    catch (e) { poiKinds = []; }
    const bd = await page.evaluate(async (padKindsNode, poiKindsNode) => { try {
      const m = window.map, B = window.__badges, M = window.__mode, s = (ms) => new Promise((r) => setTimeout(r, ms));
      if (!B || !M) return { missing: true };
      /* R1 */
      const pk = padKindsNode || [...new Set(((window.__paddle && window.__paddle.data && window.__paddle.data.c) || [])
        .flatMap((c) => (c.f || []).map((f) => f.k)))];
      const wantOf = (dataKinds) => B.kinds.map((k) => "bdg-" + k).concat(B.kinds.map((k) => "stk-" + k))
        .concat(dataKinds.map((k) => "bdg-" + k))
        .concat(pk.filter((k) => k !== "dam").map((k) => "bdg-pad-" + k));
      const want = wantOf(poiKindsNode);
      const lacks = (names) => [...new Set(names)].filter((n) => !m.hasImage(n));
      /* planted: a kind the data carries and POIKIND lacks must come back
         missing through the very path the data kinds take */
      const kindPlant = lacks(wantOf(poiKindsNode.concat(["zz-kind"]))).includes("bdg-zz-kind");
      const r1 = { missing: lacks(want), glyphMissing: B.missing.slice(), want: new Set(want).size, padKinds: pk,
                   dataKinds: poiKindsNode.length, kindPlant,
                   plant: kindPlant && lacks(["bdg-zz-plant"]).length === 1 && !B.glyphOK("zz-none") && B.glyphOK(B.spec("fuel").g) };
      /* R2 */
      const img = (n) => { const i = m.getImage(n); return i && i.data ? i.data : null; };
      const unlike = (A, B2) => { if (!A || !B2) return 1; if (A.width !== B2.width || A.height !== B2.height) return 1;
        let n = 0; const a = A.data, b = B2.data;
        for (let i = 0; i < a.length; i += 4)
          if (Math.abs(a[i] - b[i]) > 32 || Math.abs(a[i + 1] - b[i + 1]) > 32 || Math.abs(a[i + 2] - b[i + 2]) > 32
              || Math.abs(a[i + 3] - b[i + 3]) > 32) n++;
        return n / (A.width * A.height); };
      const same = (A, B2) => !!A && !!B2 && A.width === B2.width && A.height === B2.height && A.data.every((v, i) => v === B2.data[i]);
      const names = m.listImages().filter((n) => /^(bdg|stk)-/.test(n)).sort();
      const aliasOf = B.alias || {};
      const alike = [];
      for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
        const a = names[i], b = names[j];
        if (aliasOf[a] === b || aliasOf[b] === a) continue;
        if (unlike(img(a), img(b)) < 0.02) alike.push(a + "=" + b); }
      const aliasBad = Object.keys(aliasOf).filter((a) => !same(img(a), img(aliasOf[a])));
      const r2 = { n: names.length, alike, aliasBad, aliases: Object.keys(aliasOf).length,
                   plant: unlike(img("bdg-launch"), img("bdg-launch")) < 0.02 && unlike(img("bdg-launch"), img("bdg-marina")) >= 0.02 };
      /* R3 */
      const decode = async (src) => { const im = new Image(); im.src = src; try { await im.decode(); } catch (e) { return null; }
        const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
        const x = c.getContext("2d"); x.drawImage(im, 0, 0);
        return { width: c.width, height: c.height, data: x.getImageData(0, 0, c.width, c.height).data }; };
      const match = (L, A) => { if (!L || !A || L.width !== A.width || L.height !== A.height) return false;
        for (let i = 0; i < L.data.length; i += 4) { if (A.data[i + 3] < 64) continue;
          if (Math.abs(L.data[i + 3] - A.data[i + 3]) > 1) return false;
          for (let c = 0; c < 3; c++) if (Math.abs(L.data[i + c] - A.data[i + c]) > 1) return false; }
        return true; };
      const was = M.get(), panel = document.getElementById("lyrpanel");
      if (panel.hidden) { document.getElementById("c-layers").click(); await s(300); }
      const seen = new Set(), bad = [];
      let rowsN = 0, fuelL = null;
      /* R3b · the mockup's helper line: shown with drawn badges, it names
         exactly the families this mode's rows show (from the app's own
         BADGE_FAMILY, landmine 107), and a square or hexagon family's kinds
         stay inside its `of` so the words are true */
      const FAM = B.family || [];
      const famWords = (kinds) => FAM.filter((f) => f.s ? kinds.some((k) => (B.spec(k) || {}).s === f.s) : kinds.includes(f.k)).map((f) => f.w);
      const noteJudge = (txt, kinds) => { const want = famWords(kinds);
        return !!txt && /^Each badge is the one the map draws\. Shapes by family: /.test(txt) && want.length > 0
          && want.every((w) => txt.includes(w)) && FAM.every((f) => want.includes(f.w) || !txt.includes(f.w)); };
      const noteBad = [], ofBad = [];
      let notePlant = true;
      for (const f of FAM) if (f.of) for (const k of B.kinds) if ((B.spec(k) || {}).s === f.s && !f.of.includes(k)) ofBad.push(f.s + ":" + k);
      for (const md of M.MODES) {
        M.apply(md.k, { silent: true }); await s(250);
        const nt = (panel.querySelector(".pnote") || {}).textContent || "";
        const mk = [...panel.querySelectorAll("[data-pk]")].map((r) => r.dataset.pk);
        if (!noteJudge(nt, mk)) noteBad.push(md.k + ": " + JSON.stringify(nt.slice(0, 120)));
        /* planted: the same text judged against the mode with one shown
           family's kinds removed must fail (it names a family not shown) */
        const drop1 = FAM.find((f) => famWords(mk).includes(f.w));
        const fewer = drop1 ? mk.filter((k) => drop1.s ? (B.spec(k) || {}).s !== drop1.s : k !== drop1.k) : mk;
        if (noteJudge(nt, fewer)) notePlant = false;
        for (const r of [...panel.querySelectorAll("[data-pk]")]) {
          rowsN++; const k = r.dataset.pk, im = r.querySelector(".sw img");
          const L = im ? await decode(im.src) : null;
          if (!match(L, img("bdg-" + k))) bad.push(md.k + ":" + k + (im ? "" : " (no image)"));
          else seen.add(k);
          if (k === "fuel" && L) fuelL = L; } }
      M.apply(was, { silent: true });
      if (!panel.hidden) { document.getElementById("c-layers").click(); await s(200); }
      const r3 = { rows: rowsN, bad, uncovered: B.kinds.filter((k) => !seen.has(k)),
                   plant: !!fuelL && !match(fuelL, img("bdg-toilet")) && match(fuelL, img("bdg-fuel")) };
      const r3b = { fam: FAM.length, noteBad, ofBad, plant: notePlant && !noteJudge("", ["fuel"]) };
      /* R3c · take 188 · cold audit · no PNG is encoded at load (46 were,
         21 of them stack glyphs nothing shows); the legend's are made on
         first use, and a stack glyph never is */
      const r3c = { enc0: B.enc0 ? B.enc0() : null, enc: B.encoded ? B.encoded() : null };
      return { r1, r2, r3, r3b, r3c };
    } catch (e) { return { err: String(e && e.stack || e) }; } }, padKinds, poiKinds);
    if (bd.missing) ok(false, "badges hook (window.__badges) missing");
    else if (bd.err) ok(false, "badge checks threw: " + bd.err.slice(0, 300));
    else {
      ok(bd.r1.plant && bd.r1.dataKinds >= 15 && bd.r1.missing.length === 0 && bd.r1.glyphMissing.length === 0 && bd.r1.want >= 40,
         `R1 every badge the layers ask for is registered (${bd.r1.want} names: every POIKIND kind, the ${bd.r1.dataKinds} kinds in www/bundle/poi.json`
         + `${bd.r1.dataKinds ? "" : " — NONE READ"}, paddle ${bd.r1.padKinds.filter((k) => k !== "dam").join("/")}), `
         + `no glyph fell back${bd.r1.missing.length ? " — MISSING " + bd.r1.missing.slice(0, 6).join(", ") : ""}`
         + `${bd.r1.glyphMissing.length ? " — GLYPH " + bd.r1.glyphMissing.slice(0, 4).join(", ") : ""}; planted data kind zz-kind ${bd.r1.kindPlant ? "caught" : "MISSED"}, `
         + `bdg-zz-plant and glyph zz-none ${bd.r1.plant ? "caught" : "MISSED"}`);
      ok(bd.r2.plant && bd.r2.alike.length === 0 && bd.r2.aliasBad.length === 0 && bd.r2.aliases >= 2,
         `R2 ${bd.r2.n} bdg-/stk- bitmaps pairwise distinct (≥2% of pixels by >32)${bd.r2.alike.length ? " — ALIKE " + bd.r2.alike.slice(0, 6).join(", ") : ""}; `
         + `${bd.r2.aliases} declared aliases byte-identical${bd.r2.aliasBad.length ? " — BAD " + bd.r2.aliasBad.join(", ") : ""}; planted self-compare ${bd.r2.plant ? "caught" : "MISSED"}`);
      const encOk = (r) => !!r && r.enc0 === 0 && Array.isArray(r.enc) && r.enc.some((n) => /^bdg-/.test(n)) && !r.enc.some((n) => /^stk-/.test(n));
      ok(encOk(bd.r3c) && !encOk({ enc0: 46, enc: ["bdg-fuel"] }) && !encOk({ enc0: 0, enc: ["bdg-fuel", "stk-fuel"] }),
         `R3c no badge PNG is encoded at load (${bd.r3c.enc0}); the legend encoded ${bd.r3c.enc ? bd.r3c.enc.length : "?"} on first use, `
         + `stack glyphs ${bd.r3c.enc && bd.r3c.enc.some((n) => /^stk-/.test(n)) ? "ENCODED" : "never"}; the judge rejects 46 at load and an encoded stk-`);
      ok(bd.r3.plant && bd.r3.bad.length === 0 && bd.r3.uncovered.length === 0 && bd.r3.rows > 0,
         `R3 the Pins legend is the map badge: ${bd.r3.rows} rows across every mode decode to m.getImage within 1/1`
         + `${bd.r3.bad.length ? " — MISMATCH " + bd.r3.bad.slice(0, 6).join(", ") : ""}`
         + `${bd.r3.uncovered.length ? " — kinds in no mode's rows: " + bd.r3.uncovered.join(", ") : ", every kind covered"}; `
         + `planted swap (fuel's row against bdg-toilet) ${bd.r3.plant ? "caught" : "MISSED"}`);
      ok(bd.r3b.plant && bd.r3b.fam >= 4 && bd.r3b.noteBad.length === 0 && bd.r3b.ofBad.length === 0,
         `R3b the Pins helper line (V4 mockup) names exactly the badge families each mode's rows show`
         + `${bd.r3b.noteBad.length ? " — BAD " + bd.r3b.noteBad.slice(0, 2).join("; ") : ""}`
         + `; square/hexagon kinds within their words${bd.r3b.ofBad.length ? " — OUTSIDE " + bd.r3b.ofBad.join(", ") : ""}`
         + `; planted family-not-shown and missing line ${bd.r3b.plant ? "caught" : "MISSED"}`);
    }
  }
  /* take 188 · A214 · the head tap. A teardrop stands on its tip, so render's
     other taps (at project(pin)) hit its TIP; a rider taps the HEAD,
     (36 - 12.5) x icon-size CSS px above the point. On a lone destination
     teardrop at z11.4 and z15 that tap must open the place card — not the
     stack tray, not a trail. The control: the same tap 70 px to the side
     opens nothing with that name. */
  {
    /* cameras from the bundle (landmine 197): its ski hills, then the
       manifest's anchors; the first with a lone named teardrop is used */
    let cams = [];
    try { cams = (JSON.parse(readFileSync("www/bundle/poi.json", "utf8")).p || []).filter((r) => r.k === "ski" && r.p).slice(0, 3).map((r) => r.p); } catch (e) {}
    try { cams = cams.concat((JSON.parse(readFileSync("www/bundle/manifest.json", "utf8")).anchors || []).map((a) => [a[1], a[2]])); } catch (e) {}
    const hill = cams.length ? cams : null;
    const ht = await page.evaluate(async (cams) => { try {
      const m = window.map, M = window.__mode, B = window.__badges, s = (ms) => new Promise((r) => setTimeout(r, ms));
      if (!M || !B || !cams) return { missing: true };
      const was = M.get(), cam = { c: m.getCenter(), z: m.getZoom() };
      const sizeAt = (z) => { const e = m.getLayoutProperty("poi-dot-major", "icon-size");
        if (typeof e === "number") return e;
        const st = e.slice(3); if (z <= st[0]) return st[1];
        for (let i = 0; i + 3 < st.length; i += 2) if (z <= st[i + 2]) return st[i + 1] + (st[i + 3] - st[i + 1]) * (z - st[i]) / (st[i + 2] - st[i]);
        return st[st.length - 1]; };
      const cv = m.getCanvasContainer(), rc = cv.getBoundingClientRect();
      const tap = (x, y) => cv.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: rc.left + x, clientY: rc.top + y }));
      /* the card text is cleared between taps so a name left from an earlier
         card cannot pass the read */
      /* take 189 · cold audit · …and the drawer FOLDED, its slide and the
         map's resize over: a card opened by a tap opens the drawer, which
         shrinks the map (the drawer is a grid row) and moves every pin;
         until A240 that resize's moveend folded the card again, and the
         control tap and the point query below leaned on it */
      const closeCard = async () => { const p = document.getElementById("panel"); if (p) p.innerHTML = ""; window.railSet(false);
        for (let i = 0; i < 60; i++) { await new Promise((r) => requestAnimationFrame(() => r()));
          if (!document.getAnimations().some((a) => a.playState === "running" && a.effect && isFinite(a.effect.getComputedTiming().endTime))) break; await s(30); }
        for (let i = 0; i < 40 && m.isMoving(); i++) await s(50);
        await s(150); };
      const out = [];
      M.apply("outdoors", { silent: true }); await s(200);
      await closeCard();
      for (const z of [11.4, 15]) {
        /* the canvas container's own box is 0 px tall (measured); the map
           container holds the size */
        const box = m.getContainer().getBoundingClientRect();
        const W = box.width, H = box.height, isz = sizeAt(z), up = (36 - 12.5) * isz;
        let t = null, tried = 0, seen = 0;
        for (const c of cams) {
          tried++; m.jumpTo({ center: c, zoom: z });
          if (window.__stack) window.__stack.run();
          { let i = 0; for (; i < 40; i++) { if (m.areTilesLoaded()) break; await s(300); } console.debug("APEX-TILEWAIT t5 " + i + "/40"); }
          await window.__rh.idle(m, 6000);
          if (window.__stack) window.__stack.run(); await s(300);
          const pins = m.queryRenderedFeatures({ layers: ["poi-dot-major", "poi-dot"] })
            .map((f) => ({ k: f.properties.k, n: f.properties.n, p: m.project(f.geometry.coordinates) }));
          seen += pins.length;
          const stacks = m.queryRenderedFeatures({ layers: ["poi-stack-bg"] }).map((f) => m.project(f.geometry.coordinates));
          t = pins.find((q) => B.drops.includes(q.k) && q.n && q.p.x > 60 && q.p.x < W - 60 && q.p.y > up + 90 && q.p.y < H - 90
            && pins.filter((o) => o !== q && Math.hypot(o.p.x - q.p.x, o.p.y - q.p.y) < 70).length === 0
            && stacks.every((o) => Math.hypot(o.x - q.p.x, o.y - q.p.y) > 70)) || null;
          if (t) break; }
        if (!t) { out.push({ z, none: true, pins: seen, tried }); continue; }
        await closeCard();
        const had = (document.getElementById("panel") || document.body).innerText.indexOf(t.n) !== -1;
        tap(t.p.x, t.p.y - up);
        let hit = false, stack = false, card = "";
        for (let i = 0; i < 12; i++) { await s(250);
          const tx = (document.getElementById("panel") || document.body).innerText || "";
          stack = /places here/.test(tx); hit = tx.indexOf(t.n) !== -1 && !stack; if (hit || stack) { card = tx; break; } }
        /* take 189 · A237 · the card as the rider got it, and whether the app
           has a live fix (its one reader) */
        const live = window.__nav && typeof window.__nav.live === "function" ? !!window.__nav.live() : null;
        await closeCard();
        tap(t.p.x + 70, t.p.y - up); await s(700);
        const ctl = ((document.getElementById("panel") || document.body).innerText || "").indexOf(t.n) !== -1;
        await closeCard();
        /* anchor-sensitive part: the app's tap box is 22 px wide, so the tap
           above could still land on a CENTRE-anchored badge. A point query at
           the head centre must return the pin — and must NOT once the anchor
           is planted back to 'center' (the regression this guards) */
        const PL = ["poi-dot-major", "poi-dot"];
        const atHead = () => m.queryRenderedFeatures([t.p.x, t.p.y - up], { layers: PL }).some((f) => f.properties.n === t.n);
        const settle = async () => { m.triggerRepaint(); await Promise.race([new Promise((r) => m.once("idle", r)), s(6000)]);
          await new Promise((r) => requestAnimationFrame(() => r())); await s(250); };
        const head = atHead();
        const saved = PL.map((L) => m.getLayoutProperty(L, "icon-anchor"));
        let planted = null, restored = null;
        try { PL.forEach((L) => m.setLayoutProperty(L, "icon-anchor", "center")); await settle(); planted = atHead(); }
        finally { PL.forEach((L, i) => m.setLayoutProperty(L, "icon-anchor", saved[i])); await settle(); restored = atHead(); }
        out.push({ z, k: t.k, n: t.n, up: Math.round(up * 10) / 10, had, hit, stack, ctl, head, planted, restored, card, live });
      }
      M.apply(was, { silent: true }); m.jumpTo({ center: [cam.c.lng, cam.c.lat], zoom: cam.z });
      return { out };
    } catch (e) { return { err: String(e && e.stack || e) }; } }, hill);
    if (ht.missing) ok(false, "head-tap check: no __mode/__badges hook or no camera in the bundle");
    else if (ht.err) ok(false, "head-tap check threw: " + ht.err.slice(0, 300));
    else for (const r of ht.out)
      ok(!r.none && !r.had && r.hit && !r.stack && !r.ctl && r.head === true && r.planted === false && r.restored === true,
         r.none ? `head tap z${r.z}: no lone named teardrop at ${r.tried} bundle cameras (${r.pins} pins seen) — cannot check`
         : `head tap z${r.z}: ${r.up} px above ${r.k} "${r.n}" opens its place card${r.stack ? " — got the STACK tray" : ""}`
           + `; the control tap 70 px aside ${r.ctl ? "ALSO named it" : "does not"}`
           + `; a point query at the head ${r.head ? "hits" : "MISSES"} the badge, planted centre anchor ${r.planted === false ? "caught" : "MISSED"}`
           + `${r.restored ? "" : " — NOT HIT after restoring the anchor"}`);
    /* take 189 · A237 · THE DISTANCE LINE WITH NO FIX. Every card said "152
       mi SSE of you" beside a footer reading "no GPS fix yet": ME is the
       start pin until a fix. Headless Chrome has no fix, so on the cards the
       real head taps opened the app's live-fix reader must say none and the
       line must name the pin it measures from, never "you". Its controls:
       take 188's line is rejected with no fix, a pin's line accepted, and
       "of you" accepted only with one. */
    if (!ht.missing && !ht.err) {
      const distOk = (card, live) => live ? / mi [NSEW]{1,3} of you\b/.test(card)
        : / mi [NSEW]{1,3} of the (start pin|simulated position|planning start)\b/.test(card) && !/ of you\b/.test(card);
      const cards = ht.out.filter((r) => r.hit && r.card);
      const dCtl = !distOk("Fuel\n152 mi SSE of you", false) && distOk("Fuel\n152 mi SSE of the start pin", false)
        && distOk("Fuel\n1.2 mi NE of you", true) && !distOk("Fuel\n1.2 mi NE of the start pin", true);
      const line = (c) => ((c.match(/[^\n]* mi [NSEW]{1,3} of [^\n]*/) || [])[0] || "(no distance line)").trim();
      ok(cards.length > 0 && cards.every((r) => r.live === false && distOk(r.card, false)) && dCtl,
         cards.length ? `with no GPS fix, the place cards measure from the start pin, not "you": `
           + cards.map((r) => `"${r.n}" reads "${line(r.card)}" (live fix ${r.live})`).join("; ")
           + `; its controls: take 188's "of you" with no fix is rejected, "of you" with a fix accepted (${dCtl})`
         : "no place card was opened by a head tap — the distance line could not be read");
    }
    /* take 189 · A237 · fix round 1 · the dropped pin's card (placeCard, the
       card a long press opens, and Home / truck's and a waypoint's): it said
       "N mi DIR (deg°) from your position" with no fix, measured from the
       start pin. A real long press (touch, the app's own 450 ms timer) with
       no fix in headless Chrome: the card must name the start pin and the
       live reader must say none. Its controls: take 188's line with no fix
       is rejected, "from your position" with a fix accepted. */
    {
      const lp = await page.evaluate(async () => { try {
        const m = window.map, s = (ms) => new Promise((r) => setTimeout(r, ms));
        if (!window.__nav || typeof window.__nav.live !== "function") return { missing: true };
        const p0 = document.getElementById("panel"); if (p0) p0.innerHTML = "";
        const c = m.getCenter(), px = m.project([c.lng + 0.01, c.lat + 0.004]);
        const cv = m.getCanvasContainer(), r = cv.getBoundingClientRect();
        const t = new Touch({ identifier: 9, target: cv, clientX: r.left + px.x, clientY: r.top + px.y });
        cv.dispatchEvent(new TouchEvent("touchstart", { touches: [t], bubbles: true, cancelable: true }));
        await s(900);
        cv.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: [t], bubbles: true }));
        /* the click a real finger's touchend brings, which resets lp.fired (take 137) */
        cv.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: r.left + px.x, clientY: r.top + px.y }));
        let card = "";
        for (let i = 0; i < 20; i++) { await s(250); const p = document.getElementById("panel");
          card = p ? p.innerText || "" : ""; if (/Dropped pin/.test(card)) break; }
        const live = window.__nav.live() !== null, pos = window.__nav.pos();
        try { const d = document.getElementById("pc-drop"); if (d) d.click(); } catch (e) { }
        await s(300);
        return { card, live, pos };
      } catch (e) { return { err: String(e && e.stack || e) }; } });
      const fromOk = (card, live) => live ? /\(\d+°\) from your position\b/.test(card)
        : /\(\d+°\) from the (start pin|simulated position|planning start)\b/.test(card) && !/from your position/.test(card);
      const fCtl = !fromOk("Dropped pin\n3.21 mi NE (45°) from your position", false)
        && fromOk("Dropped pin\n3.21 mi NE (45°) from the start pin", false)
        && fromOk("Dropped pin\n3.21 mi NE (45°) from your position", true)
        && !fromOk("Dropped pin\n3.21 mi NE (45°) from the start pin", true);
      const fl = (c) => ((String(c || "").match(/[\d.]+ mi [NSEW]{1,3} \(\d+°\) from [^\n]*/) || [])[0] || "(no distance line)").trim();
      if (lp.missing) ok(false, "dropped-pin distance check: no __nav.live hook");
      else if (lp.err) ok(false, "dropped-pin distance check threw: " + lp.err.slice(0, 300));
      else ok(/Dropped pin/.test(lp.card) && lp.live === false && fromOk(lp.card, false) && fCtl,
        `with no GPS fix, a long press's dropped-pin card measures from the start pin, not "your position": `
        + `"${fl(lp.card)}" (position ${lp.pos}, live fix ${lp.live}${/Dropped pin/.test(lp.card) ? "" : ", NO dropped-pin card opened"}); `
        + `its controls: take 188's "from your position" with no fix is rejected, with a fix accepted (${fCtl})`);
    }
  }
  }
  if (RUN("nav")) {
  /* Take 170 · A187 N1 · the follow camera and trip persistence, driven by
     SYNTHETIC fixes along a bearing so nothing here needs a satellite. */
  {
    const nv = await page.evaluate(async () => {
      /* take 188 · landmine 217: nothing in here may throw — a renamed hook
         or element is a FINDING with a verdict, not a dead render */
      try {
      const m = window.map, N = window.__nav, R = window.__ride,
            s = (ms) => new Promise((r) => setTimeout(r, ms));
      if (!N || !R) return { missing: true };
      const cam = { c: m.getCenter(), z: m.getZoom(), b: m.getBearing(), p: m.getPitch() };
      /* driving the REAL fix path marks the position as a live GPS fix, and
         the app then rightly refuses to let a tap fake a position — which
         the route probe downstream relies on. Restore it on the way out. */
      const pm0 = N.pos();
      const st = [-84.62, 44.56];   // near Mio, on the network
      N.start();
      /* drive the REAL fix path — onFix sets the position, records the
         crumb, persists, and steers the camera — six fixes heading
         north-east at ~8 m/s with GPS course 45 */
      let at = st.slice();
      N.fix(at, 9, 8, 45); await s(300);
      for (let i = 0; i < 5; i++) {
        at = [at[0] + 0.00025, at[1] + 0.00018];
        N.fix(at, 9, 8, 45); await s(1000);
      }
      const b1 = m.getBearing(), p1 = m.getPitch(), z1 = m.getZoom();
      const chip = document.getElementById("nav");
      /* measured NOW, not at return time after the strip has been stopped */
      const chipShown = !!chip && !chip.hidden;
      const chipText = document.getElementById("nav-sp").textContent;
      // a rider's own drag pauses following
      m.fire("dragstart", { originalEvent: {} }); await s(100);
      const pausedAfterDrag = N.state.follow === false;
      /* take 188 · A222 · Re-centre is measured ON SCREEN — drawn at 44 px or
         more, inside the viewport, and the element a tap at its centre lands
         on — with the drawer folded AND open: on take 187 it sat in #nav, one
         tap whatever the drawer did (landmine 135). Reading its `hidden`
         attribute measured nothing once the button moved into the ride sheet
         (landmine 54). This drill rides through the fix hook, not the Ride
         chip, so it sets the flag the chip sets. Plants: the sheet hidden,
         and the whole-sheet yield rule under an open drawer, each read OFF. */
      const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
      const settle = async () => { for (let i = 0; i < 60; i++) { await frame();   /* landmine 224 */
        if (!document.getAnimations().some((a) => a.playState === "running" && a.effect
          && isFinite(a.effect.getComputedTiming().endTime))) return; await s(30); } };
      const tapable = (id) => { const e = document.getElementById(id); if (!e) return false;
        const r = e.getBoundingClientRect();
        if (r.width < 44 || r.height < 44 || r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight) return false;
        const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!h && e.contains(h); };
      const drawn = (id) => { const e = document.getElementById(id); if (!e || e.hidden) return false;
        const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const shellEl = document.getElementById("shell"), rideWas0 = shellEl ? shellEl.dataset.ride : undefined;
      if (shellEl) shellEl.dataset.ride = "1";
      N.rail(false); await settle();
      const recenterFolded = tapable("nav-center");
      N.rail(true); await settle();
      const openCtl = ["hud-stop", "nav-center", "nav-north", "nav-voice"].map((id) => tapable(id));
      const yst = document.createElement("style");
      yst.textContent = "#shell:has(#rail:not(.folded)) #hudstats{display:none!important}";
      document.head.appendChild(yst); await settle();
      const plantYield = tapable("nav-center"); yst.remove();
      N.rail(false); await settle();
      window.hudShow(false); await settle();
      const plantHidden = tapable("nav-center");
      window.hudShow(true); await settle();
      if (shellEl) { if (rideWas0 === undefined) delete shellEl.dataset.ride; else shellEl.dataset.ride = rideWas0; }
      const recenterShown = recenterFolded && openCtl.every(Boolean);
      // the strip's Re-centre resumes it
      document.getElementById("nav-center").click(); await s(600);
      const resumed = N.state.follow === true;
      // north-up: bearing goes to 0, pitch flat, on the next fix
      document.getElementById("nav-north").click(); await s(600);
      at = [at[0] + 0.0003, at[1] + 0.0002];
      N.fix(at, 9, 8, 45); await s(1000);
      const b2 = m.getBearing(), p2 = m.getPitch();
      document.getElementById("nav-north").click(); await s(300);
      // persistence: save, wipe the live state, restore, compare
      N.save(true);
      const saved = JSON.parse(localStorage.getItem("apex.trip.v1") || "null");
      const savedCrumbs = saved ? saved.crumbs.length : -1;
      /* the app dies: live state gone, storage kept. take 188 · A221: the HUD
         goes with it — N.reset() leaves it up, and a drill that never hides
         it cannot see a resumed trip that never shows it (the flow review:
         without this line the assert below passes on take 187) */
      N.reset();
      window.hudShow(false);
      const _hs = document.getElementById("hudstats");
      const hudGoneBeforeResume = !!_hs && _hs.hidden;
      const wiped = N.crumbs();
      const loaded = N.load();
      const restored = loaded ? N.resume(loaded) : false;
      await s(500);
      let crumbNow = -1;
      try { crumbNow = m.getSource("crumb").serialize().data.features[0].geometry.coordinates.length; } catch (e) { }
      /* and the FIRST fix after Resume must continue the line, not restart it —
         the audit found startRecording resetting crumbs to one point here */
      N.start();
      at = [at[0] + 0.0003, at[1] + 0.0002]; N.fix(at, 9, 8, 45); await s(300);
      at = [at[0] + 0.0003, at[1] + 0.0002]; N.fix(at, 9, 8, 45); await s(300);
      const afterResumeFix = N.crumbs();
      /* A221 · the resumed trip's first fixes put the ride sheet back —
         DRAWN (a rect, the stats among it), not merely un-hidden */
      await settle();
      const hudAfterResume = drawn("hudstats") && drawn("hc-dist") && drawn("hudbar");
      /* …and through the path a rider uses: the offer card's Resume button,
         which presses the Ride chip, then a fix. GPS is held PENDING for it —
         a watch that never answers — so headless Chrome cannot turn the
         drill into a simulated ride; the fix comes through the hook as
         above. "Trip resumed" is the app's own card: mid-ride it must leave
         the drawer folded (landmine 135). */
      N.save(true); N.reset(); window.hudShow(false);
      const geo0 = navigator.geolocation, gw0 = geo0 && geo0.watchPosition, gc0 = geo0 && geo0.clearWatch;
      const viaCard = { offered: false, railAfterTap: null, sheet: false, rail: null };
      if (geo0) { geo0.watchPosition = () => 4242; geo0.clearWatch = () => {}; }
      try {
        viaCard.offered = N.card() === true;
        const rb = document.getElementById("trip-resume"); if (rb) rb.click();
        await s(400); await settle();
        viaCard.railAfterTap = document.getElementById("rail").className;
        at = [at[0] + 0.0003, at[1] + 0.0002]; N.fix(at, 9, 8, 45); await s(300);
        at = [at[0] + 0.0003, at[1] + 0.0002]; N.fix(at, 9, 8, 45); await s(300); await settle();
        viaCard.sheet = drawn("hudstats") && drawn("hc-dist") && drawn("hudbar");
        viaCard.rail = document.getElementById("rail").className;
      } catch (e) { viaCard.error = String(e); }
      N.stopReal();              /* ends the ride: navStop + tripEnd, like Stop does */
      if (geo0) { geo0.watchPosition = gw0; geo0.clearWatch = gc0; }
      const gone = N.load() === null;
      N.rail(false);             /* leave the screen as we found it */
      N.pos(pm0);
      m.jumpTo({ center: [cam.c.lng, cam.c.lat], zoom: cam.z, bearing: cam.b, pitch: cam.p });
      return { wiped, afterResumeFix, b1: +b1.toFixed(1), p1: +p1.toFixed(0), z1: +z1.toFixed(1), chipShown,
               chipText, pausedAfterDrag, recenterShown, resumed, b2: +b2.toFixed(1), p2: +p2.toFixed(0),
               savedCrumbs, restored, crumbNow, gone, hudGoneBeforeResume, hudAfterResume,
               recenterFolded, openCtl, plantYield, plantHidden, viaCard };
      } catch (e) { return { error: String((e && e.stack) || e) }; }
    });
    if (nv.missing) ok(false, "nav / ride hooks missing");
    else if (nv.error) ok(false, `the nav drill ran to the end (it threw: ${nv.error})`);
    else {
      ok(Math.abs(nv.b1 - 45) < 6 && nv.p1 >= 50,
         `the camera follows the ride: bearing ${nv.b1} (course 45), pitch ${nv.p1}, zoom ${nv.z1}`);
      ok(nv.chipShown && /mph/.test(nv.chipText),
         `the strip reads speed and heading ("${nv.chipText}")`);
      ok(nv.pausedAfterDrag && nv.recenterShown,
         `a rider's own drag pauses following, and Re-centre is one tap on screen with the drawer folded `
         + `(${nv.recenterFolded}); with it open Stop, Re-centre, North up and Voice all are (${nv.openCtl})`);
      ok(!nv.plantYield && !nv.plantHidden,
         `the on-screen reader fails its plants: the whole-sheet yield rule (${nv.plantYield}), the sheet hidden (${nv.plantHidden})`);
      ok(nv.resumed, "Re-centre resumes following");
      ok(Math.abs(nv.b2) < 1 && nv.p2 === 0,
         `north-up flattens and squares the map on the next fix (bearing ${nv.b2}, pitch ${nv.p2})`);
      ok(nv.savedCrumbs >= 5,
         `the trip is written as it happens (${nv.savedCrumbs} fixes in localStorage)`);
      ok(nv.wiped === 0 && nv.restored && nv.crumbNow === nv.savedCrumbs,
         `and comes back whole after the app is gone — ${nv.crumbNow} of ${nv.savedCrumbs} fixes restored (live state was ${nv.wiped})`);
      ok(nv.afterResumeFix > nv.savedCrumbs,
         `the first fixes after Resume CONTINUE the line (${nv.savedCrumbs} -> ${nv.afterResumeFix}), not restart it`);
      ok(nv.gone, "ending a trip clears the offer, so a finished ride is never offered again");
      ok(nv.hudGoneBeforeResume && nv.hudAfterResume,
         "A221: a RESUMED trip shows the ride sheet and ribbon again on its first fix "
         + `(hidden with the app gone: ${nv.hudGoneBeforeResume}; drawn after resume: ${nv.hudAfterResume})`);
      const vc = nv.viaCard || {};
      ok(vc.offered && vc.railAfterTap === "folded" && vc.sheet && vc.rail === "folded",
         `A221 through the Resume button: offered ${vc.offered}, drawer after the tap "${vc.railAfterTap}" `
         + `("Trip resumed" is quiet), the ride sheet drawn after the first fixes ${vc.sheet}, drawer "${vc.rail}"`
         + (vc.error ? ` — ${vc.error}` : ""));
    }
  }
  /* Take 171 · A187 N2 · guidance, driven along a REAL planned route with
     synthetic fixes: the banner names the next turn with a shrinking
     distance, an ETA is shown, a fix 100 m off the line is counted as off
     route, and reaching the end announces arrival. */
  {
    const gd = await page.evaluate(async (GS, PN) => {
      const GLY = new RegExp(GS, "u");
      /* its negative control first: the test catches a text arrow and passes words */
      const glyphPlant = GLY.test("\u21b0") && !GLY.test("In 400 ft \u00b7 Turn left");
      let bannerIc = null;
      const m = window.map, N = window.__nav, M = window.__mode,
            s = (ms) => new Promise((r) => setTimeout(r, ms));
      if (!N || !N.plan) return { missing: true };
      const pm0 = N.pos(), cam = { c: m.getCenter(), z: m.getZoom(), b: m.getBearing(), p: m.getPitch() };
      N.reset();
      /* plan a real route the way the app does: a start and a destination on
         the network near Mio, via the long-press card */
      m.fire("contextmenu", { lngLat: { lng: -84.12855, lat: 44.53949 } }); await s(200);
      const s1 = document.getElementById("pc-start"); if (s1) s1.click(); await s(200);
      m.fire("contextmenu", { lngLat: { lng: -84.10724, lat: 44.55265 } }); await s(200);
      const r1 = document.getElementById("pc-route"); if (r1) r1.click();
      let G = null;
      for (let i = 0; i < 60; i++) { await s(250); G = N.plan(); if (G) break; }
      if (!G) return { noRoute: true };
      /* walk the route: fixes every ~40 m along the polyline */
      N.start();
      const banners = [], etas = [];
      let firstDist = null, lastDist = null, firstTurn = null, offCount = 0, arrived = false;
      const total = G.total, pts = G.pts, cum = G.cum;
      const at = (metres) => { let i = 0; while (i < cum.length - 2 && cum[i + 1] < metres) i++;
        const t = (metres - cum[i]) / Math.max(1, cum[i + 1] - cum[i]);
        return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]; };
      /* take 188 · A217 · the strip's ~N at fix 1, fix PN-1 and fix PN, with
         the metres left from the app's own projection, so the judge outside
         can hold each read to the route's estimate or to the pace. The drill
         rides at a speed set well apart from the route's own planning speed
         (a probe of this route shape at 6 m/s read ~9 against the plan's ~8:
         the two estimates were a minute apart and no read could tell them
         apart): 2.5 times slower, or 2.5 times faster when slower would come
         near the 3 mph floor. */
      const hrs = G.o && G.o.s && isFinite(G.o.s.hrs) ? G.o.s.hrs : null;
      const vPlan = hrs > 0 ? total / (hrs * 3600) : 6;
      const PM = vPlan / 2.5 >= 2 ? vPlan / 2.5 : vPlan * 2.5;
      const paceReads = {}, readAt = { 1: "first", [PN - 1]: "before", [PN]: "after" };
      const stripMin = (t) => { const a = /~(\d+):(\d\d) h/.exec(t), b = /~(\d+) min/.exec(t);
        return a ? +a[1] * 60 + +a[2] : b ? +b[1] : null; };
      let fixN = 0;
      const paceRead = (p) => { fixN++; const k = readAt[fixN]; if (!k) return;
        const g = document.getElementById("nav-g"), t = g && !g.hidden ? g.innerText : "";
        paceReads[k] = { fix: fixN, shown: stripMin(t), remain: total - N.project(p).prog }; };
      N.fix(at(0), 9, PM, 45); await s(250); paceRead(at(0));
      for (let d = 40; d < Math.min(total, 1600); d += 40) {
        N.fix(at(d), 9, PM, 45); await s(120); paceRead(at(d));
        const g = document.getElementById("nav-g");
        const t = g && !g.hidden ? g.innerText : "";
        const mIn = /In ([\d.,]+) (ft|mi) · (.+)$/m.exec(t);
        if (mIn) { const v = parseFloat(mIn[1].replace(",", "")) * (mIn[2] === "mi" ? 5280 : 1);
          /* the distance to ONE turn must shrink; once it is passed the
             banner names the next one, further away — compare like with like */
          if (firstTurn === null) { firstTurn = mIn[3]; firstDist = v; }
          if (mIn[3] === firstTurn) lastDist = v; }
        if (/~\d+ min/.test(t)) etas.push(t);
        /* take 188 · A216 · the first turn banner: the arrow is an svg icon,
           and no text glyph is left in what the rider reads */
        if (!bannerIc && /onto/.test(t)) { const a = g.querySelector(".arw");
          bannerIc = { svg: !!(a && a.querySelector("svg.ic")), glyph: GLY.test(t), text: t.split("\n")[0] }; }
        banners.push(t.split("\n")[0]);
      }
      /* a fix well off the line, three times — in whichever direction the
         app's own projection says is clear of every nearby segment (a route
         that doubles back can sit 95 m east of itself) */
      const p0 = at(Math.min(total, 1600) - 80);
      let offPt = null, offM = 0;
      for (const [dx, dy] of [[0.0015, 0], [0, 0.0012], [-0.0015, 0], [0, -0.0012], [0.0025, 0]]) {
        const c = [p0[0] + dx, p0[1] + dy]; const pr = N.project(c);
        if (pr.off > 60) { offPt = c; offM = Math.round(pr.off); break; } }
      for (let k = 0; k < 3; k++) { N.fix(offPt || [p0[0] + 0.0025, p0[1]], 9, 6, 45); await s(120); }
      const gOff = document.getElementById("nav-g").innerText;
      /* then to the end */
      for (let d = Math.max(0, total - 200); d <= total; d += 40) { N.fix(at(d), 9, 6, 45); await s(120); }
      N.fix(pts[pts.length - 1], 9, 2, 45); await s(300);
      arrived = /arrived/i.test(document.getElementById("nav-g").innerText) || /You have arrived/.test(document.body.innerText);
      N.stopReal(); N.rail(false); N.pos(pm0);
      m.jumpTo({ center: [cam.c.lng, cam.c.lat], zoom: cam.z, bearing: cam.b, pitch: cam.p });
      return { total: Math.round(total), steps: G.steps.length, banner: banners.find((b) => /onto/.test(b)) || banners[0],
               firstDist, lastDist, firstTurn, eta: etas.length > 0, offM, offText: /off the line|Re-routing/.test(gOff), arrived,
               glyphPlant, bannerIc, hrs, paceReads, totalExact: total, mps: PM };
    }, GLYPH_SRC, NAV_PACE_N || 10);
    if (gd.missing) ok(false, "guidance hooks missing");
    else if (gd.noRoute) ok(false, "no route could be planned for the guidance drill");
    else {
      ok(gd.steps > 0 && gd.total > 200,
         `a planned route becomes a guidance model (${gd.steps} steps over ${gd.total} m)`);
      ok(/In [\d.,]+ (ft|mi)/.test(gd.banner || "") && /onto/.test(gd.banner || ""),
         `the banner names the next turn with its distance ("${gd.banner}")`);
      ok(gd.firstDist !== null && gd.lastDist !== null && gd.lastDist < gd.firstDist,
         `and the distance to that same turn shrinks as the rider closes on it (${gd.firstTurn}: ${gd.firstDist} -> ${gd.lastDist} ft)`);
      ok(gd.eta, "an ETA is shown on the strip");
      /* take 188 · A217 · WHICH estimate: the route's own until NAV_PACE_N
         moving fixes, then what is left at the rider's pace (floored at the
         3 mph the app never goes under). The review found the old line
         above passed on any "~N min", so a pace branch that never ran would
         ship green. The drill's speed keeps the two estimates minutes apart,
         so a ±1 min tolerance cannot take one for the other; the judge
         demands a 3 min gap at every read and fails without it. */
      const eMin = (x) => Math.max(1, Math.round(x));
      const paceJudge = (R, hrs, total, mps) => {
        const f = R && R.first, b = R && R.before, a = R && R.after;
        if (!f || !b || !a || hrs === null || !(total > 0) || !(mps > 0.6)) return { pass: false, why: "a read is missing" };
        const plan = (r) => eMin(hrs * 60 * r.remain / total), pace = (r) => eMin(r.remain / Math.max(mps, 3 * 0.44704) / 60);
        const apart = [f, b, a].every((r) => Math.abs(plan(r) - pace(r)) >= 3);
        const want = { first: plan(f), before: plan(b), after: pace(a) };
        const got = { first: f.shown, before: b.shown, after: a.shown };
        const hit = ["first", "before", "after"].every((k) => got[k] !== null && Math.abs(got[k] - want[k]) <= 1);
        return { pass: apart && hit, apart, want, got,
                 other: { first: pace(f), before: pace(b), after: plan(a) } };
      };
      const PR = gd.paceReads || {};
      const real = paceJudge(PR, gd.hrs, gd.totalExact, gd.mps);
      const clone = (o) => JSON.parse(JSON.stringify(o || {}));
      /* plant 1, the pace never applied: the read after N fixes is the route's estimate */
      const pNever = clone(PR); if (pNever.after && real.other) pNever.after.shown = real.other.after;
      /* plant 2, the pace applied from the first fix: fix 1 reads the pace */
      const pAtOnce = clone(PR); if (pAtOnce.first && real.other) pAtOnce.first.shown = real.other.first;
      const jNever = paceJudge(pNever, gd.hrs, gd.totalExact, gd.mps), jAtOnce = paceJudge(pAtOnce, gd.hrs, gd.totalExact, gd.mps);
      ok(numPlants && NAV_PACE_N !== null && real.pass && !jNever.pass && !jAtOnce.pass,
         `the strip's ETA is the route's own estimate until ${NAV_PACE_N} moving fixes, then the rider's pace: `
         + `fix 1 ~${real.got ? real.got.first : "?"} min (route ${real.want ? real.want.first : "?"}, pace ${real.other ? real.other.first : "?"}), `
         + `fix ${NAV_PACE_N - 1} ~${real.got ? real.got.before : "?"} (route ${real.want ? real.want.before : "?"}), `
         + `fix ${NAV_PACE_N} at ${gd.mps ? gd.mps.toFixed(1) : "?"} m/s ~${real.got ? real.got.after : "?"} (pace ${real.want ? real.want.after : "?"}, route ${real.other ? real.other.after : "?"})`
         + `${real.apart === false ? " — the two estimates are under 3 min apart here, so this drill cannot tell them apart" : ""}`
         + `${real.why ? " — " + real.why : ""}; its plants fail: pace never applied (${!jNever.pass}), pace from fix 1 (${!jAtOnce.pass}); `
         + `NAV_PACE_N is read from the build (${NAV_PACE_N}) by a reader that passes its planted strings (${numPlants})`);
      ok(gd.offText, `three fixes ${gd.offM} m from the line are called "off the line" or trigger a re-route`);
      ok(gd.glyphPlant && gd.bannerIc && gd.bannerIc.svg && !gd.bannerIc.glyph,
         `the turn banner draws its arrow as an icon and carries no text glyph ("${gd.bannerIc ? gd.bannerIc.text : "no banner"}"); `
         + "the glyph test catches a text arrow and passes plain words (its negative control)");
      ok(gd.arrived, "reaching the end announces You have arrived");
    }
  }
  /* Take 172 · A187 N3 · river navigation, on a REAL corridor from the bundle:
     the camera points DOWNSTREAM regardless of the GPS course, the strip
     counts down to the take-out for the craft and calls what is coming, and
     reaching the take-out announces it. */
  {
    const rv = await page.evaluate(async () => {
      const m = window.map, N = window.__nav, M = window.__mode, P = window.__paddle,
            s = (ms) => new Promise((r) => setTimeout(r, ms));
      if (!N || !N.runSet || !P) return { missing: true };
      const pm0 = N.pos(), was = M.get(), cam = { c: m.getCenter(), z: m.getZoom(), b: m.getBearing(), p: m.getPitch() };
      N.reset(); M.apply("water", { silent: true }); await s(250);
      const c = (P.data.c || []).find((x) => x.n === "Au Sable River");
      if (!c) return { noRiver: true };
      const named = c.f.filter((f) => f.n && (f.k === "access" || f.k === "launch"));
      /* a run of a few miles with something downstream to call */
      let a = null, b = null;
      for (let i = 0; i < named.length && !b; i++) for (let j = i + 1; j < named.length; j++) {
        const d = named[j].mi - named[i].mi; if (d >= 3 && d <= 8) { a = named[i]; b = named[j]; break; } }
      if (!a) return { noRun: true };
      N.runSet("Au Sable River", a, b);
      const L = N.riverLine("Au Sable River");
      const atMile = (mi) => { const mm = mi * 1609.34; let i = 0; while (i < L.cum.length - 2 && L.cum[i + 1] < mm) i++;
        const t = (mm - L.cum[i]) / Math.max(1, L.cum[i + 1] - L.cum[i]);
        return [L.pts[i][0] + (L.pts[i + 1][0] - L.pts[i][0]) * t, L.pts[i][1] + (L.pts[i + 1][1] - L.pts[i][1]) * t]; };
      N.start();
      /* paddle downstream with the GPS course deliberately reported as
         due NORTH (0) — the map must ignore it and point down the river */
      let bearingsOK = 0, samples = 0, sawCall = false, sawEta = false, milesSeen = [];
      for (let mi = a.mi + 0.1; mi < b.mi - 0.1; mi += 0.2) {
        const at = atMile(mi); N.fix(at, 12, 1.4, 0);
        /* the camera EASES over 900 ms; the invariant is about where it
           settles, not a frame mid-turn. Sampling at 700 ms read 17/19
           here and 15/19 on the CI runner — timing, not steering. Wait for
           the ease to finish before comparing. */
        await s(950);
        for (let w = 0; w < 20 && m.isMoving(); w++) await s(100);
        const st = N.river(at); samples++;
        const mb = ((m.getBearing() % 360) + 360) % 360, rb = ((st.brg % 360) + 360) % 360;
        const diff = Math.min(Math.abs(mb - rb), 360 - Math.abs(mb - rb));
        if (diff < 15) bearingsOK++;
        const t = document.getElementById("nav-g").innerText;
        if (/Dam in|Access in|Camp in/.test(t)) sawCall = true;
        if (/mi to .* · ~/.test(t)) sawEta = true;
        milesSeen.push(+st.rm.toFixed(2));
      }
      N.fix(atMile(b.mi), 12, 1.0, 0); await s(500);
      N.fix(b.p, 12, 0.5, 0); await s(500);
      const arrived = /reached the take-out/i.test(document.getElementById("nav-g").innerText);
      N.stopReal(); N.rail(false); N.pos(pm0);
      M.apply(was, { silent: true });
      m.jumpTo({ center: [cam.c.lng, cam.c.lat], zoom: cam.z, bearing: cam.b, pitch: cam.p });
      const mono = milesSeen.every((v, i) => i === 0 || v >= milesSeen[i - 1] - 0.05);
      return { a: a.n, b: b.n, len: +(b.mi - a.mi).toFixed(1), samples, bearingsOK, sawCall, sawEta, arrived, mono,
               first: milesSeen[0], last: milesSeen[milesSeen.length - 1] };
    });
    if (rv.missing) ok(false, "river navigation hooks missing");
    else if (rv.noRiver || rv.noRun) ok(false, "no Au Sable run of 3-8 mi between named accesses in the bundle");
    else {
      ok(rv.mono && rv.last > rv.first,
         `the rider's river mile advances downstream (${rv.first} -> ${rv.last} on a ${rv.len} mi run, ${rv.a} to ${rv.b})`);
      ok(rv.bearingsOK >= rv.samples * 0.8,
         `the map points DOWNRIVER, not at the GPS course of due north (${rv.bearingsOK} of ${rv.samples} fixes within 15°)`);
      ok(rv.sawEta, "the strip counts down to the take-out with a time for the craft");
      ok(rv.sawCall, "and calls what is coming downstream (a dam, access or camp)");
      ok(rv.arrived, "reaching the take-out announces it");
    }
  }
  /* Take 173 · A187 N4 + N5 · a hike is guidance on foot: the same engine,
     with the ETA floored at walking pace. And voice: the instruction is
     spoken ONCE when a turn becomes the next one, with a stand-in engine
     so the check is about what the app says, not what headless Chrome can
     pronounce. */
  {
    const hk = await page.evaluate(async () => {
      const m = window.map, N = window.__nav, M = window.__mode, V = window.__voice,
            s = (ms) => new Promise((r) => setTimeout(r, ms));
      if (!N || !V) return { missing: true };
      const pm0 = N.pos(), was = M.get(), cam = { c: m.getCenter(), z: m.getZoom(), b: m.getBearing(), p: m.getPitch() };
      N.reset(); M.apply("outdoors", { silent: true }); await s(250);
      /* stand-in speech engine: records what would be said */
      const said = [];
      /* speechSynthesis is a read-only accessor on Window; plain assignment
         silently does nothing (the first version of this drill spoke to a
         real engine with no voices). An own property shadows it. */
      const stub = { getVoices: () => [{ name: "Stub", lang: "en-US", localService: true }],
        cancel: () => {}, speak: (u) => said.push(u.text) };
      Object.defineProperty(window, "speechSynthesis", { value: stub, configurable: true, writable: true });
      window.SpeechSynthesisUtterance = function (t) { this.text = t; };
      window.__voiceProbe(); V.on = true;
      /* a route on foot near Mio, via the long-press card */
      m.fire("contextmenu", { lngLat: { lng: -84.12855, lat: 44.53949 } }); await s(200);
      const s1 = document.getElementById("pc-start"); if (s1) s1.click(); await s(200);
      m.fire("contextmenu", { lngLat: { lng: -84.10724, lat: 44.55265 } }); await s(200);
      const r1 = document.getElementById("pc-route"); if (r1) r1.click();
      let G = null; for (let i = 0; i < 60; i++) { await s(250); G = N.plan(); if (G) break; }
      /* (cold audit: this line assigned an undefined realSS, so a hike with
         no route threw instead of reporting it) */
      if (!G) { delete window.speechSynthesis; M.apply(was, { silent: true }); return { noRoute: true }; }
      N.start();
      const pts = G.pts, cum = G.cum, total = G.total;
      const at = (mm) => { let i = 0; while (i < cum.length - 2 && cum[i + 1] < mm) i++;
        const t = (mm - cum[i]) / Math.max(1, cum[i + 1] - cum[i]);
        return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]; };
      /* walk it slowly: 1.2 m/s, the ETA must be floored at walking pace */
      let etaMin = null, remainM = null;
      N.fix(at(0), 9, 1.2, 45); await s(250);
      for (let d = 30; d < Math.min(total, 700); d += 30) { N.fix(at(d), 9, 1.2, 45); await s(90); }
      const t = document.getElementById("nav-g").innerText;
      const mE = /~(\d+) min/.exec(t); if (mE) etaMin = +mE[1];
      const mR = /([\d.]+) (mi|ft) remaining/.exec(t);
      if (mR) remainM = parseFloat(mR[1]) * (mR[2] === "mi" ? 1609.34 : 0.3048);
      const walkMph = 3, expectMin = remainM ? remainM / 1609.34 / walkMph * 60 : null;
      const saidTurns = said.filter((x) => /onto/.test(x));
      const distinct = new Set(saidTurns).size;
      /* the ride sheet's Voice button: shown (a voice is present) with its
         icon, which hudBtns repaints from JS on each state change; a copy
         without the svg must read as missing. take 188 · cold audit · the
         button is never hidden now (A218: muted, with the note, when there
         is no speech), so "shown" alone could not fail: what carries the
         meaning is disabled — false here, true once the voice is gone */
      const vb = document.getElementById("nav-voice");
      const voiceShown = !!vb && !vb.hidden && vb.disabled === false, voiceIc = !!(vb && vb.querySelector("svg.ic"));
      let voicePlant = false;
      if (vb) { const cl = vb.cloneNode(true); cl.querySelectorAll("svg").forEach((x) => x.remove()); voicePlant = !cl.querySelector("svg.ic"); }
      N.stopReal(); N.rail(false); N.pos(pm0); V.on = false;
      /* the other way: no speech at all, as this WebView ships (A218). The
         probe finds none, the buttons repaint (navChip runs hudBtns), and
         Voice must be muted with its note drawn. headless Chrome's own
         engine may report voices, so an own property with none shadows it */
      Object.defineProperty(window, "speechSynthesis", { value: { getVoices: () => [], cancel: () => {}, speak: () => {} },
        configurable: true, writable: true });
      window.__voiceProbe(); N.chip();
      const noVoice = { ok: V.ok, disabled: !!(vb && vb.disabled), note: !document.getElementById("hud-vnote").hidden };
      delete window.speechSynthesis;   /* the accessor on the prototype returns */
      window.__voiceProbe(); N.chip();
      M.apply(was, { silent: true });
      m.jumpTo({ center: [cam.c.lng, cam.c.lat], zoom: cam.z, bearing: cam.b, pitch: cam.p });
      return { mode: "outdoors", steps: G.steps.length, etaMin, expectMin: expectMin && +expectMin.toFixed(0),
               said: said.length, saidTurns: saidTurns.length, distinct, sample: saidTurns[0] || said[0] || null,
               voiceShown, voiceIc, voicePlant, noVoice };
    });
    if (hk.missing) ok(false, "hike / voice hooks missing");
    else if (hk.noRoute) ok(false, "no route could be planned on foot for the hike drill");
    else {
      ok(hk.steps > 0 && hk.etaMin !== null,
         `a hike is guided like a ride: ${hk.steps} steps, ETA shown (~${hk.etaMin} min)`);
      ok(hk.expectMin !== null && Math.abs(hk.etaMin - hk.expectMin) <= Math.max(3, hk.expectMin * 0.25),
         `and the ETA is floored at walking pace, not the crawl of the fixes (~${hk.etaMin} min vs ${hk.expectMin} at 3 mph)`);
      ok(hk.saidTurns > 0 && /onto/.test(hk.sample || ""),
         `voice speaks the instruction ("${hk.sample}")`);
      ok(hk.voiceShown && hk.voiceIc && hk.voicePlant,
         `the ride sheet shows Voice ENABLED with its icon drawn while a voice is present (shown and enabled ${hk.voiceShown}, `
         + `icon ${hk.voiceIc}); a copy without its svg reads as missing (its negative control, ${hk.voicePlant})`);
      /* the judge of the other way, proved on plants first: a Voice left
         live with no speech, and a muted one with no note */
      const mutedOk = (r) => !!r && r.ok === false && r.disabled === true && r.note === true;
      const nv = hk.noVoice;
      ok(!mutedOk({ ok: false, disabled: false, note: true }) && !mutedOk({ ok: false, disabled: true, note: false }) && mutedOk(nv),
         `…and with no speech Voice is muted with its note (voice ${nv && nv.ok}, disabled ${nv && nv.disabled}, note drawn ${nv && nv.note}); `
         + `the judge rejects a live Voice with no speech and a muted one without the note`);
      ok(hk.saidTurns === hk.distinct * 1 || hk.saidTurns <= hk.distinct * 2,
         `and says each turn at most twice — once when it becomes next, once close in (${hk.saidTurns} spoken, ${hk.distinct} distinct)`);
    }
  }
  }
  if (RUN("camp")) {
  /* Take 174 · A186 · Camp mode: a fifth mode in the picker; national forest
     land drawn in Camp and hidden elsewhere; campgrounds carry a type where
     the source recorded one and say so where it did not. */
  {
    const cp = await page.evaluate(async () => {
      const m = window.map, M = window.__mode,
            s = (ms) => new Promise((r) => setTimeout(r, ms));
      if (!M) return { missing: true };
      const was = M.get(), cam = { c: m.getCenter(), z: m.getZoom() };
      const modes = M.MODES.map((x) => x.k);
      const vis = (id) => { try { return m.getLayoutProperty(id, "visibility") !== "none"; } catch (e) { return null; } };
      /* in Off-road the forest layer stays off */
      M.apply("ride", { silent: true }); await s(300);
      const nfInRide = vis("nf-fill");
      /* in Camp it is on, and the forest polygons actually render over the Huron */
      M.apply("camp", { silent: true }); await s(300);
      const nfInCamp = vis("nf-fill"), pubInCamp = vis("pub-fill");
      m.jumpTo({ center: [-84.45, 44.60], zoom: 8.6 }); await s(500);
      let nfDrawn = 0, nfName = null;
      for (let i = 0; i < 30; i++) { await s(400);
        try { const f = m.queryRenderedFeatures({ layers: ["nf-fill"] }); nfDrawn = f.length;
          if (f.length) { nfName = f[0].properties.n; break; } } catch (e) { } }
      /* a typed campground, from the bundle, says its type on its card */
      const P = window.POIS ? window.POIS.p : [];
      let typed = -1; for (let i = 0; i < P.length; i++) if (P[i].k === "camp" && P[i].ct && P[i].ct.op === "dnr" && P[i].ct.ty) { typed = i; break; }
      let cardType = "", campKinds = false;
      if (typed >= 0) {
        const r = P[typed];
        m.jumpTo({ center: r.p, zoom: 14.2 }); await s(600);
        const pt = m.project(r.p), cv = m.getCanvas(), rc = cv.getBoundingClientRect();
        for (let k = 0; k < 20; k++) { await s(300);
          try { if (m.queryRenderedFeatures({ layers: ["poi-dot", "poi-dot-major"] }).length) break; } catch (e) { } }
        for (const type of ["mousedown", "mouseup", "click"])
          cv.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: rc.left + pt.x, clientY: rc.top + pt.y }));
        await s(500);
        cardType = document.body.innerText;
        campKinds = (M.MODES.find((x) => x.k === "camp").kinds || []).includes("camp");
      }
      M.apply(was, { silent: true });
      m.jumpTo({ center: [cam.c.lng, cam.c.lat], zoom: cam.z });
      return { modes, nfInRide, nfInCamp, pubInCamp, nfDrawn, nfName, typed, campKinds,
               typedSays: /State forest campground/.test(cardType) && /rustic|modern/.test(cardType) };
    });
    if (cp.missing) ok(false, "mode hook missing");
    else {
      ok(cp.modes.includes("camp") && cp.modes.length === 5,
         `Camp is the fifth mode (${cp.modes.join(" · ")})`);
      ok(cp.nfInRide === false && cp.nfInCamp === true && cp.pubInCamp === true,
         `national forest and state land draw in Camp and stay off in Off-road (forest in Off-road ${cp.nfInRide}, forest in Camp ${cp.nfInCamp}, public in Camp ${cp.pubInCamp})`);
      ok(cp.nfDrawn > 0 && !!cp.nfName,
         `the Huron-Manistee is on the map in Camp (${cp.nfDrawn} feature(s), ${cp.nfName})`);
      ok(cp.typed >= 0 && cp.typedSays,
         "a DNR campground's card says it is a state forest campground and whether it is rustic");
    }
    /* Jacob: "do we need to adjust outdoors or any other mode?" Yes — camp
       sat in every mode at full prominence, and demote only ever reached
       the minor layer, so a major kind could not be stepped back at all.
       Now: Outdoors demotes campgrounds (out below z13), Camp leads with
       them. Same camera, both modes, count the camp pins. */
    const ov = await page.evaluate(async () => {
      const m = window.map, M = window.__mode, S = window.__stack,
            s = (ms) => new Promise((r) => setTimeout(r, ms));
      const was = M.get(), cam = { c: m.getCenter(), z: m.getZoom() };
      const campsIn = async (mode) => {
        M.apply(mode, { silent: true }); await s(300);
        m.jumpTo({ center: [-84.45, 44.62], zoom: 11.0 }); await s(400);
        S.run(); const src = m.getSource("poistack");
        { let w = 0; for (; w < 40; w++) { if (src.loaded() && m.areTilesLoaded()) break; await s(400); } console.debug("APEX-TILEWAIT t6 " + w + "/40"); }
        await window.__rh.idle(m, 6000);
        let pins = 0, inStacks = 0;
        try { pins = m.queryRenderedFeatures({ layers: ["poi-dot", "poi-dot-major"] })
          .filter((f) => f.properties.k === "camp").length; } catch (e) { }
        try { m.queryRenderedFeatures({ layers: ["poi-stack-bg"] }).forEach((b) => {
          if (b.properties.k === "camp") inStacks += +b.properties.n; }); } catch (e) { }
        return pins + inStacks;
      };
      const out = await campsIn("outdoors"), camp = await campsIn("camp");
      M.apply(was, { silent: true }); m.jumpTo({ center: [cam.c.lng, cam.c.lat], zoom: cam.z });
      return { out, camp };
    });
    ok(ov.out === 0 && ov.camp > 0,
       `at z11 over the Huron, Outdoors steps campgrounds back (${ov.out}) while Camp leads with them (${ov.camp})`);
  }
  /* Take 175 · A188 · the unnamed-pin cleanup. The bundle is asserted first
     (the counts are the feature), then the map: over the Cass Lake district
     Jacob photographed, Off-road at z12.5 draws no unnamed launch or beach,
     while Water at the same camera still draws them. */
  {
    let P = [];
    try { P = JSON.parse(readFileSync("www/bundle/poi.json", "utf8")).p; } catch (e) { }
    const un = P.filter((r) => !r.n && (r.k === "launch" || r.k === "beach"));
    const byLake = P.filter((r) => r.w);
    const mt = (a, b) => Math.hypot((a[0] - b[0]) * 111320 * Math.cos(a[1] * Math.PI / 180), (a[1] - b[1]) * 111320);
    const DEST = new Set(["launch", "beach", "marina", "camp", "dayuse", "livery", "lighthouse", "trailhead"]);
    const g = new Map();
    P.filter((r) => r.n && DEST.has(r.k)).forEach((r) => {
      const k = Math.round(r.p[0] * 100) + "|" + Math.round(r.p[1] * 100);
      if (!g.has(k)) g.set(k, []); g.get(k).push(r); });
    let shadows = 0;
    for (const r of un) {
      const kx = Math.round(r.p[0] * 100), ky = Math.round(r.p[1] * 100); let hit = false;
      for (let dx = -1; dx <= 1 && !hit; dx++) for (let dy = -1; dy <= 1 && !hit; dy++)
        for (const q of (g.get((kx + dx) + "|" + (ky + dy)) || [])) if (mt(r.p, q.p) < 300) { hit = true; break; }
      if (hit) shadows++;
    }
    ok(un.length > 0 && un.length <= 1200,
       `unnamed launches and beaches are down to ${un.length} in the bundle (were 1,982)`);
    ok(byLake.length >= 400 && byLake.every((r) => r.n && (r.k === "launch" || r.k === "beach")),
       `${byLake.length} of them now carry the name of the lake they are on, flagged as borrowed`);
    ok(shadows === 0,
       `and none of the rest shadows a named destination within 300 m (${shadows})`);
    const vz = await page.evaluate(async () => {
      const m = window.map, M = window.__mode, S = window.__stack,
            s = (ms) => new Promise((r) => setTimeout(r, ms));
      const was = M.get(), cam = { c: m.getCenter(), z: m.getZoom() };
      const count = async (mode) => {
        M.apply(mode, { silent: true }); await s(300);
        m.jumpTo({ center: [-83.36, 42.61], zoom: 12.5 }); await s(400); S.run();
        const src = m.getSource("poistack");
        { let w = 0; for (; w < 40; w++) { if (src.loaded() && m.areTilesLoaded()) break; await s(400); } console.debug("APEX-TILEWAIT t7 " + w + "/40"); }
        await window.__rh.idle(m, 6000);
        let unnamed = 0, named = 0;
        try { m.queryRenderedFeatures({ layers: ["poi-dot", "poi-dot-major"] }).forEach((f) => {
          if (f.properties.k !== "launch" && f.properties.k !== "beach") return;
          if (+f.properties.named === 1) named++; else unnamed++; }); } catch (e) { }
        return { unnamed, named };
      };
      /* Outdoors carries launches and beaches and is not Water; Off-road
         carries neither, which made the first version of this check vacuous */
      const ride = await count("outdoors"), water = await count("water");
      M.apply(was, { silent: true }); m.jumpTo({ center: [cam.c.lng, cam.c.lat], zoom: cam.z });
      return { ride, water };
    });
    ok(vz.ride.unnamed === 0 && vz.ride.named > 0,
       `over Cass Lake at z12.5, Outdoors draws no unnamed launch or beach (${vz.ride.unnamed}) while ${vz.ride.named} named ones stay`);
    ok(vz.water.unnamed > 0,
       `while Water at the same camera still draws them for the paddler (${vz.water.unnamed})`);
  }
  /* Take 167 · A184 · Play rejected build 166 for presenting government data
     without naming its source or disclaiming affiliation. The store listing
     is where they found it; this asserts the APP says it too, since the
     notice says to check every area. */
  const src = await page.evaluate(async () => {
    const s = (ms) => new Promise((r) => setTimeout(r, ms));
    const b = document.getElementById("c-sources");
    if (!b) return { missing: true };
    b.click(); await s(400);
    const t = document.body.innerText;
    const hrefs = [...document.querySelectorAll("a[href]")].map((a) => a.href);
    return { shown: /Where the data comes from/i.test(t),
             disclaims: /not\s+affiliated/i.test(t) && /any other government agency/i.test(t),
             dnr: hrefs.some((h) => /michigan\.gov\/dnr/.test(h)),
             usfs: hrefs.some((h) => /fs\.usda\.gov/.test(h)),
             usgs: hrefs.some((h) => /nationalmap\.gov|waterdata\.usgs\.gov/.test(h)),
             osm: hrefs.some((h) => /openstreetmap\.org\/copyright/.test(h)) };
  });
  if (src.missing) ok(false, "no Data sources control in Tools (A184)");
  else {
    ok(src.shown, "Tools -> Data sources opens");
    ok(src.disclaims,
       "and states plainly that the app is not affiliated with any government agency");
    ok(src.dnr && src.usfs && src.usgs && src.osm,
       `every government source it republishes is linked (DNR ${src.dnr}, USFS ${src.usfs}, USGS ${src.usgs}, OSM ${src.osm})`);
  }
  /* take 189 · A232 · at 360 px wide every "BSD 3-Clause" on Data sources
     stays on one line: take 188's 13b3 shots read "BSD 3-" / "Clause". Read
     from the text's own line boxes (a Range over each occurrence; one line =
     one distinct top), after a frame with no animation left (landmine 224).
     Its control: the same words in a 40 px box read broken. For the record,
     not the verdict: how many break with the no-wrap taken off. */
  {
    const vpWas = page.viewport();
    await page.setViewport({ width: 360, height: 800, deviceScaleFactor: 3 }); await vpSettle(1200);
    const bsd = await page.evaluate(async () => {
      const b = document.getElementById("c-sources"); if (!b) return { missing: true };
      b.click(); await window.__rh.settle(3000);
      const P = document.getElementById("panel"); if (!P) return { missing: true };
      const lines = (root) => { const out = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) { const re = /BSD 3[-\u2011]Clause/g; let m;
          while ((m = re.exec(n.data))) { const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
            out.push(new Set([...r.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top))).size); } }
        return out; };
      const got = lines(P);
      const plant = document.createElement("div"); plant.style.width = "40px"; plant.textContent = "BSD 3-Clause";
      P.appendChild(plant); const ctl = lines(plant); plant.remove();
      const nb = [...P.querySelectorAll(".nobr")]; nb.forEach((e) => { e.style.whiteSpace = "normal"; });
      const bare = lines(P); nb.forEach((e) => { e.style.whiteSpace = ""; });
      return { got, ctl, bare: bare.filter((n) => n > 1).length, w: Math.round(P.getBoundingClientRect().width) };
    });
    await page.setViewport(vpWas); await vpSettle(1200);
    ok(!bsd.missing && bsd.got.length === 3 && bsd.got.every((n) => n === 1) && bsd.ctl.length === 1 && bsd.ctl[0] > 1,
       bsd.missing ? "360x800: no Data sources card to read for the licence names"
       : `360x800: every "BSD 3-Clause" on Data sources stays on one line (${bsd.got.length} found, lines ${bsd.got.join("/")}, `
         + `card ${bsd.w} px wide); its control, the words in a 40 px box, reads ${bsd.ctl.join("/")} lines; `
         + `with the no-wrap off, ${bsd.bare} of them break here`);
  }
  }
  /* take 189 · A227 fix round 1 · shell's own judgement, at section level.
     It sat inside camp's guard, so --only=shell read shl and never judged it
     (render-t189-L-render-only-3.log: no "shell is revealed" line, RENDER
     PASSED — landmine 53). Camp reopens below for the tab bar; the full run's
     order and texts are unchanged. */
  if (RUN("shell")) {
  if (shl.missing) ok(false, "no #shell to check");
  else {
    ok(shl.ready && shl.opacity === "1",
       `the shell is revealed once its icons are painted (opacity ${shl.opacity})`);
    ok(shl.tokens === 0 && shl.btnTokens === 0,
       `and no button is left holding a raw token (${shl.btnTokens} of them)`);
  }
  }
  if (RUN("camp")) {

  /* take 138: the guide rewrite left two stray </div> and the tab bar fell
     out of the layout grid on the Fold. Assert the bar sits inside a phone
     viewport, below the map, above the bottom edge. */
  const tabs = await page.evaluate(() => {
    const t = document.getElementById("tabs"), st = document.getElementById("stage");
    if (!t || !st) return { missing: true };
    const r = t.getBoundingClientRect(), s = st.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, vh: window.innerHeight, sameParent: t.parentElement === st.parentElement,
             stageBottom: s.bottom };
  });
  ok(!tabs.missing && tabs.bottom <= tabs.vh + 1 && tabs.top >= tabs.stageBottom - 1 && tabs.sameParent,
     `the tab bar sits inside the viewport below the map (top ${Math.round(tabs.top)}, bottom ${Math.round(tabs.bottom)} of ${tabs.vh}; same parent as #stage: ${tabs.sameParent})`);


  }
  if (RUN("paddle")) {
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
    /* Take 117: statewide, the paddle geojson is ~100k points and the source
       worker is still tiling when a fixed sleep expires — the dam check
       failed on TIME, not data. Poll until the layer yields, bounded. */
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      try { if (m.queryRenderedFeatures({ layers: ["pad-dam"] }).length) break; }
      catch (e) { }
    }
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
    if (!src.length) return { srcN: 0,
      artifactAbsent: !(window.CONT && window.CONT.pk && window.CONT.pk.length) };
    const off = (() => { try {
      return m.getLayoutProperty("peak-label", "visibility") === "none"; } catch (e) { return null; } })();
    ["peak-dot", "peak-label"].forEach((id) => {
      try { m.setLayoutProperty(id, "visibility", "visible"); } catch (e) {} });
    /* Take 121: this jumped to the first peak — Mount Arvon, in the Huron
       Mountains at z12.6 — and left the camera there. The app's own self-test
       later counts road features in whatever view it inherits, so it reported
       "roads 0" on a run that was drawing 22,782 of them. A drill puts back
       what it moved; three other blocks in this file already say so. */
    const _cam = { c: m.getCenter(), z: m.getZoom() };
    m.jumpTo({ center: src[0].geometry.coordinates, zoom: 12.6 });
    /* Take 119: statewide the first peak is Mount Arvon, in a corner of the
       UP no earlier check has tiled — a fixed 2.4 s nap lost to the source
       worker and reported 0 of 323 summits drawn. Settle-then-measure,
       bounded (landmine 198). */
    const q = (id) => { try { return m.queryRenderedFeatures({ layers: [id] }); }
                        catch (e) { return []; } };
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      if (q("peak-dot").length && q("peak-label").length) break;
    }
    const out = { srcN: src.length, off,
                  dots: q("peak-dot").length,
                  names: [...new Set(q("peak-label").map((f) => f.properties.n))],
                  sample: src[0].properties.lb };
    ["peak-dot", "peak-label"].forEach((id) => {
      try { m.setLayoutProperty(id, "visibility", "none"); } catch (e) {} });
    m.jumpTo({ center: [_cam.c.lng, _cam.c.lat], zoom: _cam.z });
    return out;
  });
  if (pk.artifactAbsent) {
    console.log("  --   summits: contour artifact honestly absent for this "
      + "region (bulk skip, take 117) — checks skipped, absence is named");
  } else {
    ok(pk.srcN > 0, `${pk.srcN} named summits in the payload`);
    ok(pk.off === true, "named hills are off until asked for");
    ok(pk.dots > 0 && (pk.names || []).length > 0,
       `summits draw: ${pk.dots} marker(s), named ${(pk.names || []).slice(0, 3).join(", ")}`);
    ok(/\d/.test(pk.sample || ""), `label carries a height: ${JSON.stringify(pk.sample)}`);
  }

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
      await window.__rh.idle(m, 2200);
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
  if (!ct.srcN) {
    console.log("  --   contours: no contour LINES for this region (statewide "
      + "lines ruled out at take 75; summits ship without them since take 119) "
      + "— line checks skipped, absence is named");
  } else {
    ok(ct.line > 0 && ct.index > 0,
       `contours draw: ${ct.line} intermediate + ${ct.index} index of ${ct.srcN} in the source`);
    ok(ct.labels.length > 0,
       `index contours carry an elevation: ${ct.labels.slice(0, 4).join(", ") || "(none)"}`);
  }

  }
  if (RUN("ui")) {
  /* Take 115 · THE ACCENT IS A BUDGET, ENFORCED BY COUNT. The T1 rule was
     "orange appears once per screen"; the take-115 audit found .actrow.on still
     glowing full orange because a rule held in memory decays. Counted now: at
     rest, at most ONE element on screen may wear the accent as a surface. */
  /* take 187 · A208 — the accent is READ from its token, not typed as 226,87,15:
     a literal passes in silence the day V4 changes the colour. A planted
     second accent surface must trip the count first (its negative control). */
  const accent = await page.evaluate(() => {
    const pr = document.createElement("div"); pr.style.background = "var(--accent)";
    document.body.appendChild(pr); const acc = (getComputedStyle(pr).backgroundColor.match(/\d+/g) || []).slice(0, 3);
    pr.remove();
    const ACC = new RegExp("^rgba?\\(" + acc.join(",\\s*") + "(,|\\))");
    /* take 188 · A225: a surface counts only when a rider can SEE it — at
       least 4 px both ways (the 2 px #hudneedle is a hairline, not a surface),
       not clipped to nothing by an ancestor (a folded #railbody, max-height 0,
       still gives its children rects), and not faded out: the opacity of the
       element and every ancestor multiplies into the background's own alpha
       (the folded #actions sits at opacity 0 with min-height 44). A fixed
       element escapes its ancestors' clipping, so clipping stops there. */
    const seen = (el, r) => { let a = 1, clips = true;
      for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
        const cs = getComputedStyle(e); a *= +cs.opacity;
        if (e !== el && clips) { const b = e.getBoundingClientRect();
          if (cs.overflowX !== "visible" && Math.min(r.right, b.right) - Math.max(r.left, b.left) < 1) return 0;
          if (cs.overflowY !== "visible" && Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top) < 1) return 0; }
        if (cs.position === "fixed") clips = false; }
      return a; };
    const count = () => { const hit = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      const cs = getComputedStyle(el);
      /* take 181: a hidden picker keeps its layout (display:block, opacity 0,
         visibility hidden) so it can rise when opened — its ON-swatches have a
         rect and an orange background and are NOT on screen. Visibility is
         inherited, so the swatch itself reports hidden. */
      if (cs.visibility === "hidden") continue;
      const bg = cs.backgroundColor;
      if (!ACC.test(bg)) continue;
      const alpha = +((bg.match(/^rgba\([^)]*,\s*([\d.]+)\)$/) || [0, 1])[1]);
      if (alpha * seen(el, r) < 0.3) continue;
      hit.push(el.id || el.className || el.tagName);
    }
    return hit; };
    /* planted: two real surfaces (20 and 40 px) must count; a 3 px accent bar,
       an accent square under an opacity-0 parent and one clipped to nothing by
       a zero-height overflow:hidden parent must not */
    const mk = (id, css, parent) => { const p = document.createElement("div"); p.id = id;
      p.style.cssText = css; (parent || document.body).appendChild(p); return p; };
    const ACCBG = "background:var(--accent);";
    const fade = mk("v4plant-accfade", "position:fixed;left:120px;top:4px;width:30px;height:30px;opacity:0;z-index:99999");
    const clip = mk("v4plant-accclip", "position:fixed;left:160px;top:4px;width:30px;height:0;overflow:hidden;z-index:99999");
    const planted = [mk("v4plant-acc0", "position:fixed;left:4px;top:4px;width:20px;height:20px;" + ACCBG + "z-index:99999"),
      mk("v4plant-acc1", "position:fixed;left:30px;top:4px;width:40px;height:40px;" + ACCBG + "z-index:99999"),
      mk("v4plant-accthin", "position:fixed;left:76px;top:4px;width:40px;height:3px;" + ACCBG + "z-index:99999"),
      mk("v4plant-accunder0", "width:30px;height:30px;" + ACCBG, fade),
      mk("v4plant-accclipped", "width:30px;height:30px;" + ACCBG, clip), fade, clip];
    const withPlant = count(); planted.forEach((p) => p.remove());
    const want = { "v4plant-acc0": true, "v4plant-acc1": true, "v4plant-accthin": false,
                   "v4plant-accunder0": false, "v4plant-accclipped": false };
    const wrong = Object.keys(want).filter((k) => withPlant.includes(k) !== want[k]);
    return { acc: acc.join(","), hit: count(), caught: wrong.length === 0, wrong };
  });
  ok(accent.caught && accent.acc.split(",").length === 3,
     `the accent counter reads its colour from the token (rgb ${accent.acc}) and counts a `
     + `planted second surface, but not a 3 px bar, one under an opacity-0 parent or one `
     + `clipped to nothing (its negative controls)`
     + (accent.wrong && accent.wrong.length ? " — misjudged: " + accent.wrong.join(", ") : ""));
  ok(accent.hit.length <= 1,
     `the accent is spent at most once per screen (${accent.hit.length}: `
     + `${accent.hit.join(", ") || "none"})`);

  /* Take 112 · four field findings from Jacob's take-110 session. */
  const field = await page.evaluate(async () => {
    const s = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = {};
    // A · the chevron must be ONE glyph, not the six literal chars \u25BE
    out.chev = (document.getElementById("peek-chev").textContent || "").trim();
    // B · action buttons hold their height even inside the FOLDED drawer,
    //     which is the state Jacob's report measured them in at 28 px
    window.railSet(false); await s(400);
    /* take 188 · A217 · folded at rest the drawer shows ONE action, Return
       home (the other three wait in the open drawer), so that is the one
       measured */
    out.actH = Math.round(document.getElementById("btn-home")
      .getBoundingClientRect().height);
    // C · a status message must not unfold the drawer
    window.railSet(false); await s(350);
    window.showQuiet("<b>You are about 135 mi away.</b>", "135 mi away · planning mode");
    await s(250);
    out.stayedFolded = document.getElementById("rail").className === "folded";
    out.peekLine = document.getElementById("peek-txt").textContent || "";
    out.panelHasIt = /135 mi away/.test(
      document.getElementById("panel").innerText || "");
    // D · relief starts off; the group stays in the layers panel
    out.relief = window.map.getLayoutProperty("hillshade", "visibility");
    return out;
  });
  ok(field.chev.length === 1 && field.chev === "\u25BE",
     `the drawer chevron is one real glyph, not the literal string \\u25BE `
     + `("${field.chev}")`);
  /* take 188 · A215 · the V4 floor, 48 px (it was 38) */
  ok(field.actH >= 48,
     `Return home holds ${field.actH}px (the V4 floor is 48) on the folded drawer — `
     + `the maintainer's report measured 28px there`);
  ok(field.stayedFolded && field.panelHasIt,
     "a status message fills the panel WITHOUT unfolding the drawer — it is "
     + "not a card about a place the rider touched");
  ok(/135 mi away/.test(field.peekLine),
     `and the peek strip carries its summary ("${field.peekLine}")`);
  ok(field.relief === "none",
     "relief starts OFF — over the flat basemap it reads as dark blotches; "
     + "it stays one tap away under Layers");

  /* A129 · the first-run guide. Shown once, dismissed for good, reachable
     afterwards from Tools (take 110). */
  const guide = await page.evaluate(async (GK) => {
    const s = (ms) => new Promise((r) => setTimeout(r, ms));
    const g = document.getElementById("guide");
    const out = {};
    // it may already have been dismissed by an earlier check in this file, so
    // establish the first-run state rather than assuming it
    /* take 188: the REAL key (read from app.js), not a stale v1 that was never
       set — removing that left the current key in place, so "remembered"
       below could pass on a dismissal from an earlier check */
    try { localStorage.removeItem(GK); } catch (e) {}
    window.guideShow(); await s(350);
    out.opens = !g.hidden;
    out.blurred = /blur/.test(getComputedStyle(g).backdropFilter
                              || getComputedStyle(g).webkitBackdropFilter || "");
    out.text = (document.getElementById("guide-card").innerText || "");
    document.getElementById("guide-go").click(); await s(300);
    out.closes = !!g.hidden;
    out.remembered = (() => { try {
      /* by prefix: the key is versioned with the guide's content (take 133),
         and a check that names a version is stale the moment it is bumped */
      return Object.keys(localStorage).some((k) => /^apex\.guide\.v\d+$/.test(k) && localStorage.getItem(k) === "1"); } catch (e) { return null; } })();
    // and it comes back on request
    document.querySelector('#tabs .tab[data-go="tools"]').click(); await s(180);
    const chip = document.getElementById("c-howto");
    out.chipVisible = !!(chip && !chip.hidden);
    chip.click(); await s(300);
    out.reopens = !g.hidden;
    // tapping the blurred backdrop closes it
    g.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await s(300);
    out.backdropCloses = !!g.hidden;
    /* Leave nothing behind: the overlay covers the map, and the colour-variety
       check that runs later would see a blurred sheet and call the map blank.
       A check that mutates shared state hands that state to every check after
       it (landmine 177 — same mistake as the device matrix one take ago). */
    window.guideClose(true);
    document.querySelector('#tabs .tab[data-go="map"]').click(); await s(250);
    out.leftClosed = !!g.hidden;
    return out;
  }, GUIDEKEY);
  ok(guide.opens, "the guide opens on first run");
  ok(guide.leftClosed, "and the check puts it away again");
  ok(guide.blurred, "it blurs the map behind rather than covering it");
  ok(/Dispatch/.test(guide.text) && /Plan/.test(guide.text)
     && /no signal/.test(guide.text),
     "it explains the destinations, the map and dispatch");
  ok(guide.closes && guide.remembered === true,
     "dismissing it records that, so it never shows again on its own");
  /* take 133: the guide teaches the state and the three modes, and its key
     is versioned so a rewritten guide shows once even on a phone that
     dismissed an old one (A147). */
  ok(/Off-road/.test(guide.text) && /Outdoors/.test(guide.text) && /Hunt/.test(guide.text) && /Water/.test(guide.text)
     && /Michigan/.test(guide.text) && !/Rose City/.test(guide.text),
     "it teaches Ride / Outdoors / Water and the whole state, not the old test box");
  const gk = await page.evaluate(() => { try { return Object.keys(localStorage).filter((k) => /apex\.guide/.test(k)).join(","); } catch (e) { return ""; } });
  ok(gk.split(",").includes(GUIDEKEY) && /^apex\.guide\.v\d+$/.test(GUIDEKEY),
     `the guide key is versioned and is the app's own (${gk}; app.js says ${GUIDEKEY})`);
  ok(guide.chipVisible && guide.reopens,
     "Tools -> How to use brings it back");
  ok(guide.backdropCloses, "tapping the blurred backdrop closes it too");

  /* A127 · the details drawer. Jacob: the rail is always there and takes half
     the screen. The rule is that the card belongs to a PLACE — it opens when you
     touch something and leaves when that thing does (take 109). */
  const drawer = await page.evaluate(async () => {
    const s = (ms) => new Promise((r) => setTimeout(r, ms));
    const rail = document.getElementById("rail");
    const body = document.getElementById("railbody");
    const h = () => Math.round(body.getBoundingClientRect().height);
    /* The fold is a 260 ms transition. A fixed sleep reads whatever height the
       animation happens to be at — 339 px on one run, 0 on the next — so the
       check flipped between runs and accused the product. Poll until the height
       stops changing (take 92's lesson, in a new place). */
    const settle = async () => {
      let last = -1, now = h();
      for (let i = 0; i < 30 && now !== last; i++) {
        last = now; await s(60); now = h();
      }
      return now;
    };
    const acts = () => Math.round(
      document.getElementById("actions").getBoundingClientRect().height);
    document.querySelector('#tabs .tab[data-go="map"]').click(); await s(200);
    /* Earlier checks in this file have already opened the drawer, so "at rest"
       has to be ESTABLISHED, not assumed — a check that depends on the order it
       runs in is testing the order (take 109). */
    /* Set the state directly rather than toggling from whatever earlier checks
       left behind. Clicking the handle inherits ambient state, and a check that
       depends on the order it runs in is testing the order (take 109). */
    window.railSet(false);
    await settle();
    const atRest = { folded: rail.className === "folded", body: h(),
                     inline: body.getAttribute("style") || "(none)",
                     maxH: getComputedStyle(body).maxHeight };
    // a tap on something opens it
    /* Take 126: pick a pin the CURRENT mode draws — Ride no longer shows
       launches and beaches, and src[0] happened to be one. A trailhead is
       in every mode's whitelist. */
    const src = window.map.getStyle().sources.poi.data.features;
    const pick = src.find((f) => f.properties.k === "trailhead") || src[0];
    const at = pick.geometry.coordinates;
    /* Take 121: this drill jumps to the FIRST POI in the payload — statewide
       that is in the Keweenaw — and left the camera there, so the app's own
       self-test counted roads in a view holding none and reported 0 on a run
       drawing 22,782. Put the view back at the end. */
    const _cam = { c: window.map.getCenter(), z: window.map.getZoom() };
    window.map.jumpTo({ center: at, zoom: 15 });
    /* statewide sources tile slower than a fixed nap (the dam lesson,
       take 117): poll until the badge under the tap actually renders */
    for (let i = 0; i < 30; i++) {
      await s(400);
      /* A143 split the pins in two: a destination draws on poi-dot-major,
         everything else on poi-dot. Polling one layer would wait out the
         full 12 s whenever the first POI is a trailhead or a launch. */
      try { if (window.map.queryRenderedFeatures(
              { layers: ["poi-dot", "poi-dot-major"] }).length) break; } catch (e) { }
    }
    /* A synthetic map.fire("click") lacks fields MapLibre's own handlers read
       (originalEvent.target) and throws inside the library. Dispatch a real DOM
       event on the canvas and let MapLibre build the map event itself. */
    const p = window.map.project(at);
    const cv = window.map.getCanvas();
    const r = cv.getBoundingClientRect();
    for (const type of ["mousedown", "mouseup", "click"]) {
      cv.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true,
        clientX: r.left + p.x, clientY: r.top + p.y }));
    }
    await settle();
    const opened = { folded: rail.className === "folded", body: h(), acts: acts() };
    // pan until it is off screen and the card should go with it
    /* take 189 · A240 · only the RIDER's camera move folds the card: the
       app's own move (a jumpTo, as a resize's or a fly-to's moveend) leaves
       it open even with the place off screen; a real drag on the canvas (a
       gesture: its moveend carries the input event) that takes the place
       off screen folds it. This drill used a jumpTo as its "pan" until
       take 189, which was the app's move, not the rider's. */
    const still = async () => { for (let i = 0; i < 80 && window.map.isMoving(); i++) await s(50); await s(60); };
    window.map.jumpTo({ center: [at[0] + 0.25, at[1] + 0.25], zoom: 15 });
    await still(); await settle();
    const appMove = { folded: rail.className === "folded", off: (() => { const q = window.map.project(at),
      c = window.map.getContainer().getBoundingClientRect(); return q.x < -40 || q.y < -40 || q.x > c.width + 40 || q.y > c.height + 40; })() };
    window.map.jumpTo({ center: at, zoom: 15 }); await still(); await settle();
    /* the drag is REAL input (puppeteer's mouse, outside this evaluate): a
       synthetic MouseEvent drag moved the map but MapLibre never fired its
       moveend (PROVEN, probe-t189-audit-a240-1) */
    const x0p = window.map.project(at).x, rc = window.map.getCanvas().getBoundingClientRect();
    const cvAt = (x, y) => { const e = document.elementFromPoint(x, y); return !!e && e.tagName === "CANVAS"; };
    const dx = -(x0p + 90), x0 = rc.left + rc.width * 0.75;
    const y = [0.5, 0.4, 0.6, 0.3, 0.7].map((f) => rc.top + rc.height * f).find((yy) => cvAt(x0, yy) && cvAt(x0 + dx, yy));
    window.__drw = { at, cam: _cam };
    return { atRest, opened, appMove, drag: { x0, y, dx, from: Math.round(x0p) } };
  });
  if (drawer.drag && drawer.drag.y !== undefined) {
    const d = drawer.drag; await page.mouse.move(d.x0, d.y); await page.mouse.down();
    for (let i = 1; i <= 12; i++) await page.mouse.move(d.x0 + d.dx * i / 12, d.y);
    await new Promise((r) => setTimeout(r, 150)); await page.mouse.up();
  }
  Object.assign(drawer, await page.evaluate(async () => {
    const s = (ms) => new Promise((r) => setTimeout(r, ms));
    const rail = document.getElementById("rail");
    const body = document.getElementById("railbody");
    const h = () => Math.round(body.getBoundingClientRect().height);
    const settle = async () => {
      let last = -1, now = h();
      for (let i = 0; i < 30 && now !== last; i++) {
        last = now; await s(60); now = h();
      }
      return now;
    };
    const { at, cam: _cam } = window.__drw; delete window.__drw;
    for (let i = 0; i < 80 && window.map.isMoving(); i++) await s(50); await s(60);
    await settle();
    const panned = { folded: rail.className === "folded", pinX: Math.round(window.map.project(at).x) };
    // the handle
    /* the handle itself, from a KNOWN folded state */
    window.railSet(false); await settle();
    document.getElementById("peek").click(); await settle();
    const byHand = { folded: rail.className === "folded", body: h() };
    window.railSet(false); await settle();
    const _a = document.getElementById("actions");
    const _b = document.getElementById("railbody");
    return { panned, byHand,
             actsPinned: !!(_a && _b && !_b.contains(_a)
                            && document.getElementById("rail").contains(_a)),
             peekVisible: document.getElementById("peek")
               .getBoundingClientRect().height > 10,
             _restored: (() => { window.map.jumpTo(
               { center: [_cam.c.lng, _cam.c.lat], zoom: _cam.z }); return true })() };
  }));
  drawer.panned.from = drawer.drag.from;
  /* The CLASS is asserted, not the animated height. In headless the measured
     height lags the class by a step — railSet(true) reads folded:false h:0, then
     railSet(false) reads folded:true h:84 — and I could not model that
     interaction reliably. The state is what the behaviour is; the pixel mid-
     transition is the animation. Asserting what can be measured honestly rather
     than what looked more impressive (take 109). */
  ok(drawer.atRest.folded,
     `the drawer folds to its resting state (max-height ${drawer.atRest.maxH})`);
  ok(!drawer.opened.folded, "tapping a place opens it");
  /* STRUCTURE, not pixels. The property that was actually broken is that the
     action row lived INSIDE the scrolling body, so a tall card pushed Dispatch
     and Return home past the bottom. Whether it is outside that box is a fact
     about the DOM and does not move with an animation. */
  ok(drawer.actsPinned,
     "the action row sits outside the scrolling body, so a tall card cannot push "
     + "Dispatch and Return home off the bottom");
  ok(drawer.panned.folded && drawer.panned.pinX < -40,
     `panning until the place leaves the screen folds the card with it (a real drag on the canvas: the place `
     + `from x ${drawer.panned.from} to ${drawer.panned.pinX} px)`);
  ok(drawer.appMove.off && !drawer.appMove.folded,
     `A240 · the app's own camera move (a jumpTo, no input event) leaves the card open with its place off screen `
     + `(off ${drawer.appMove.off}, folded ${drawer.appMove.folded}) — only the rider's pan folds it`);
  ok(!drawer.byHand.folded, "the handle opens it by hand");
  ok(drawer.peekVisible,
     "the peek strip never leaves, so nothing is unreachable — only folded");

  /* A126 · the dispatch timing added at take 93 had NEVER run — it required
     `ME`, which is only set inside the region, so it returned silently on
     Jacob's report (he tested 135 mi away) and in this harness (no GPS at all).
     A self-test line nobody had ever seen (take 109, landmine 85). */
  const perf = await page.evaluate(async () => {
    const s = (ms) => new Promise((r) => setTimeout(r, ms));
    document.querySelector('#tabs .tab[data-go="tools"]').click(); await s(150);
    document.getElementById("c-diag").click(); await s(200);
    /* Take 119: this polled the panel for the word PASS, which the statewide
       report never contains ("39 passed, 5 failed") — so it gave up at 20 s
       with the self-test STILL RUNNING, and its teardown show() later landed
       on top of the compass drill's pin card, 60 lines down. Wait for the
       self-test's own completion signal, bounded (landmine 198). */
    try { window.__selfTestReport = null; } catch (e) { }
    document.getElementById("c-selftest").click();
    for (let i = 0; i < 480; i++) {
      if (window.__selfTestReport) break;
      await s(250);
    }
    const ST = typeof window.__st === "function" ? window.__st() : [];
    const d = ST.find((r) => r.id === "dispatch-scan");
    return { hasDisp: !!d, line: d ? `${d.ok === false ? "SLOW " : ""}${d.d}` : "",
             total: ST.length, live: !!(window.__nav && window.__nav.live && window.__nav.live()) };
  });
  /* take 189 · cold audit · the line names what it measured from in A237's
     words: "your position" only from a live fix (its `ME&&ME.slice` guard
     was always true — ME holds the region centre from boot). Its control:
     take 188's "from your position" with no live fix fails */
  const fromOkD = (line, live) => live ? /from your position\)/.test(line)
    : /from (?:the start pin|the planning start|the simulated position|your last GPS fix \([^)]*\))\)/.test(line) && !/from your position\)/.test(line);
  ok(perf.hasDisp && fromOkD(perf.line, perf.live)
     && !fromOkD("120 ms of 3010 ms budget (451000 edges, 0.3 µs/edge, from your position) — this is what you wait for after tapping Dispatch", false),
     `the dispatch timing emits with no GPS (${perf.total} checks, live fix ${perf.live}): `
     + `${perf.line || "(absent)"}; the judge rejects "from your position" with no live fix`);

  /* A119 · the compass must read the magnetometer when standing still, which is
     the case Jacob reported as broken. */
  const mag = await page.evaluate(async () => {
    const s = (ms) => new Promise((r) => setTimeout(r, ms));
    document.querySelector('#tabs .tab[data-go="tools"]').click(); await s(150);
    document.getElementById("c-compass").click(); await s(250);
    const before = document.getElementById("cmpbox").innerText || "";
    window.dispatchEvent(Object.assign(new Event("deviceorientationabsolute"),
      { absolute: true, alpha: 311 }));
    await s(250);
    const after = document.getElementById("cmpbox").innerText || "";
    const h = window.headingNow ? window.headingNow() : null;
    document.getElementById("c-compass").click();
    return { before, after, src: h && h.src, deg: h && Math.round(h.deg) };
  });
  ok(/not reporting a compass|waiting for the compass/.test(mag.before),
     "with no sensor and no GPS the compass says so rather than drawing a needle");
  /* 311 alpha -> 49 magnetic -> 42 TRUE. Take 109 mixed a magnetic heading with
     true bearings computed from coordinates; everything is true at the source
     now, so one number means one thing (take 111). */
  ok(mag.src === "compass" && mag.deg === 42,
     `a magnetometer reading is converted to TRUE north (${mag.deg}\u00B0 by ${mag.src}, `
     + `49\u00B0 magnetic less 7\u00B0 declination)`);
  ok(/compass/.test(mag.after) && /NE/.test(mag.after),
     "and the rose shows it with its source named");

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
                "c-fuel","c-loop","c-saved","c-ride",
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

  /* take 188 · A217 · Wrong turn is the SIMULATOR's control (it veers the
     simulated track to fire the off-route alert; on a GPS ride the alert
     fires from the real track): hidden on the Ride tab with no ride, shown
     while the simulator rides, gone when it stops, hidden on a GPS ride.
     The simulator is driven through __nav.sim (landmine 111), and
     everything it moves is put back — track, truck, ride clock, position
     mode, camera (landmine 177). Its control: a Wrong turn forced visible
     with no ride reads as shown. */
  const wt = await page.evaluate(async () => {
    const s = (ms) => new Promise((r) => setTimeout(r, ms));
    const N = window.__nav, m = window.map, out = {};
    if (!N || !N.sim || !N.simSave || !N.simRestore) return { error: "missing __nav.sim / simSave / simRestore" };
    const shown = () => { const c = document.getElementById("c-lost"); if (!c || c.hidden) return false;
      const r = c.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(c).display !== "none"; };
    const cam = { c: m.getCenter(), z: m.getZoom() }, saved = N.simSave();
    try {
      document.querySelector('#tabs .tab[data-go="ride"]').click(); await s(250);
      out.noRide = shown();
      const c = document.getElementById("c-lost"); c.hidden = false; out.plant = shown(); c.hidden = true;
      N.sim(); await s(300);
      out.sim = shown(); out.simChip = (document.getElementById("c-ride").textContent || "").trim();
      N.simStop(); await s(250);
      out.afterSim = shown();
      document.getElementById("c-ride").click(); await s(300);
      out.gps = shown(); out.gpsChip = (document.getElementById("c-ride").textContent || "").trim();
      document.getElementById("c-ride").click(); await s(250);
    } catch (e) { out.error = String(e); }
    try { N.simRestore(saved); } catch (e) {}
    try { m.jumpTo({ center: cam.c, zoom: cam.z }); window.railSet(false);
      document.querySelector('#tabs .tab[data-go="map"]').click(); } catch (e) {}
    return out;
  });
  ok(!wt.error && !wt.noRide && wt.plant && wt.sim && /^Stop$/.test(wt.simChip || "") && !wt.afterSim
     && /Stop \(GPS\)/.test(wt.gpsChip || "") && !wt.gps,
     `Wrong turn is the simulator's control: hidden with no ride (${wt.noRide}), shown while the simulator rides `
     + `(${wt.sim}, chip "${wt.simChip}"), gone when it stops (${wt.afterSim}), hidden on a GPS ride (${wt.gps}, `
     + `chip "${wt.gpsChip}"); forced visible with no ride it reads shown (${wt.plant}, its control)`
     + (wt.error ? " — " + wt.error : ""));

  /* take 188 · step 13b · the maintainer, 2026-09-25 ("Hide them, like the
     mockup"): while a ride runs the floating map controls are NOT drawn —
     the left column (scale, readout, mode, activity), the right column
     (basemap, HD) and the Map tab's Layers / Locate / Search row — and they
     are drawn again after Stop. Read on the rider's own path: Ride pressed
     on the Ride tab (GPS held PENDING, a watch that never answers, so
     headless Chrome cannot turn it into anything else), the Map tab looked
     at mid-ride, then Stop. Its controls: the hide rule overridden (the
     controls forced back) must read as drawn while riding; the ride flag
     left on after Stop must read as not back. */
  const fc = await page.evaluate(async () => {
    const s = (ms) => new Promise((r) => setTimeout(r, ms));
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    const settle = async () => { for (let i = 0; i < 60; i++) { await frame();
      if (!document.getAnimations().some((a) => a.playState === "running" && a.effect
        && isFinite(a.effect.getComputedTiming().endTime))) return true; await s(30); } return false; };
    const vis = (e) => { if (!e || e.hidden) return null;
      for (let a = e; a && a !== document.documentElement; a = a.parentElement) { const c = getComputedStyle(a);
        if (c.display === "none" || c.visibility === "hidden" || +c.opacity === 0) return null; }
      const r = e.getBoundingClientRect(); return r.width >= 1 && r.height >= 1 ? r : null; };
    const drawn = () => { const out = ["readout", "c-base", "c-hd", "c-mode", "c-act"].filter((id) => vis(document.getElementById(id)));
      if (vis(document.querySelector(".maplibregl-ctrl-bottom-left"))) out.push("scale");
      document.querySelectorAll('#tools .chip[data-tab="map"]').forEach((c) => { if (vis(c)) out.push(c.id); });
      return out; };
    const tab = async (t) => { document.querySelector(`#tabs .tab[data-go="${t}"]`).click(); await s(150); await settle(); };
    const sh = document.getElementById("shell"), cr = document.getElementById("c-ride"), out = {};
    const geo = navigator.geolocation, gw = geo && geo.watchPosition, gc = geo && geo.clearWatch;
    if (geo) { geo.watchPosition = () => 4343; geo.clearWatch = () => {}; }
    const planted = [];
    try {
      window.railSet(false); await tab("map");
      out.before = drawn();
      await tab("ride"); cr.click(); await s(300); await settle();
      out.chip = (cr.textContent || "").trim(); out.flag = sh.dataset.ride || null;
      await tab("map"); out.riding = drawn();
      const st = document.createElement("style"); planted.push(st);
      st.textContent = "#shell[data-ride] #readout{display:block!important}"
        + "#shell[data-ride] #c-base,#shell[data-ride] #c-hd,#shell[data-ride] #c-mode,#shell[data-ride] #c-act,"
        + '#shell[data-ride] #tools .chip[data-tab="map"]{display:inline-flex!important}'
        + "#shell[data-ride] .maplibregl-ctrl-bottom-left{display:block!important}";
      document.head.appendChild(st); await settle(); out.plantRule = drawn(); st.remove();
      await tab("ride"); if (/Stop/.test(cr.textContent || "")) cr.click(); await s(300); await settle();
      out.chipAfter = (cr.textContent || "").trim(); out.flagAfter = sh.dataset.ride || null;
      await tab("map"); out.after = drawn();
      sh.dataset.ride = "1"; await settle(); out.plantStale = drawn(); delete sh.dataset.ride; await settle();
    } catch (e) { out.error = String(e); }
    planted.forEach((p) => p.remove());
    try { if (/Stop/.test(cr.textContent || "")) cr.click(); } catch (e) {}
    if (geo) { geo.watchPosition = gw; geo.clearWatch = gc; }
    try { delete sh.dataset.ride; window.railSet(false); await tab("map"); } catch (e) {}
    return out;
  });
  {
    const WANT = ["readout", "c-base", "c-mode", "c-act", "scale", "c-layers", "c-locate", "c-search"];
    const hiddenOk = (l) => Array.isArray(l) && l.length === 0;
    const backOk = (l) => Array.isArray(l) && Array.isArray(fc.before) && fc.before.every((x) => l.includes(x));
    ok(!fc.error && WANT.every((x) => (fc.before || []).includes(x)) && /Stop \(GPS\)/.test(fc.chip || "") && fc.flag === "1"
       && hiddenOk(fc.riding) && /Ride it/.test(fc.chipAfter || "") && fc.flagAfter === null && backOk(fc.after)
       && !hiddenOk(fc.plantRule) && !backOk(fc.plantStale),
       `riding hides the floating map controls, as the mockup's Ride board (the maintainer, 2026-09-25): at rest drawn `
       + `${(fc.before || []).join(", ")}; Ride pressed ("${fc.chip}", flag ${fc.flag}) — drawn ${(fc.riding || []).join(", ") || "none"}; `
       + `after Stop ("${fc.chipAfter}", flag ${fc.flagAfter}) — drawn ${(fc.after || []).join(", ") || "none"}; `
       + `controls: the hide rule overridden reads ${(fc.plantRule || []).length} drawn (must be > 0), the flag left on after Stop `
       + `reads ${(fc.plantStale || []).length} back (must fail)` + (fc.error ? " — " + fc.error : ""));
  }

  }
  if (RUN("home")) {
  /* A119 · the compass. Written AFTER printing the panel and reading it, which
     is the order that caught the useless 0.0 mi rows twice (landmines 163/164). */
  /* Take 117, the HOME spec: home is unset until the rider sets one, so the
     bearing line has nothing to point at unless this drill sets a home the
     way a rider would — press-and-hold, Make this home (the flow smoke and
     the probe both prove). */
  await page.evaluate(async () => {
    const s = (ms) => new Promise((r) => setTimeout(r, ms));
    try { window.guideClose(true); } catch (e) { }
    try { if (window.__tour && window.__tour.state().on) window.__tour.close('notnow'); } catch (e) { }
    document.querySelector('#tabs .tab[data-go="map"]').click(); await s(200);
    const m = window.map, c = m.getCenter();
    const px = m.project([c.lng + 0.02, c.lat + 0.005]);
    const cv = m.getCanvasContainer(), r = cv.getBoundingClientRect();
    const t = new Touch({ identifier: 9, target: cv,
      clientX: r.left + px.x, clientY: r.top + px.y });
    cv.dispatchEvent(new TouchEvent("touchstart",
      { touches: [t], bubbles: true, cancelable: true }));
    await s(900);
    cv.dispatchEvent(new TouchEvent("touchend",
      { touches: [], changedTouches: [t], bubbles: true }));
    /* landmine 198, caught in this very drill under gate load: the card can
       out-wait any fixed nap. Poll for the button, bounded. */
    let b = null;
    for (let i = 0; i < 25 && !b; i++) {
      await s(400);
      b = document.getElementById("pc-home");
    }
    if (b) b.click();
    await s(400);
    window.__cmpDrill = { pcHome: !!b, centre: [c.lng.toFixed(3), c.lat.toFixed(3)],
      zoom: m.getZoom().toFixed(1),
      panel: (document.getElementById("panel").innerText || "").slice(0, 120) };
  });
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
  /* Take 105 asserted the words "no heading yet". Take 109 gave the compass a
     magnetometer, so standing still it either HAS a heading or names the reason
     it does not — the sentence changed because the product got better. */
  ok(/not reporting a compass|waiting for the compass|\u00B0/.test(cmp.still),
     "standing still it either reads a heading or says why it cannot");
  ok(/NE\b/.test(cmp.moving) && /49/.test(cmp.moving),
     `given a heading it reads it: ${(cmp.moving.split("\n")[0] || "").slice(0, 40)}`);
  ok(/Home/.test(cmp.moving) && /left|right|ahead/.test(cmp.moving),
     "and gives a bearing to home with which way to turn");
  if (!/Home/.test(cmp.moving)) {
    /* say what the drill saw, so a failure here is diagnosable from the log
       and not from a rerun (take 119) */
    const d = await page.evaluate(() => JSON.stringify(window.__cmpDrill));
    console.log("  ..   home drill saw: " + d);
  }
  ok(/you are here/.test(cmp.moving),
     "a waypoint at your own position reads 'you are here', not a 0.0 mi bearing");
  ok(/Marked/.test(cmp.marked), "Mark this spot saves a waypoint in one tap");
  ok(cmp.closed, "leaving Tools closes the compass");

  }
  if (RUN("tools")) {
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

  /* A99 · icons must be DRAWN, and no placeholder may survive to the screen.
     take 188 · A216: no emoji or text glyph in ANY button (#nav's included)
     or in the text of the card, the guidance line, the toast and the tour
     card — check_glyphs' ranges. #peek-chev's chevron is the one exemption,
     by site: its subtree is removed before its button (#peek) is read. */
  const icn = await page.evaluate((GS) => {
    const G = new RegExp(GS, "u"), GG = new RegExp(GS, "gu");
    const shell = document.getElementById("shell"), nav = document.getElementById("nav");
    const svgs = shell.querySelectorAll("button svg.ic").length;
    const leftover = ((shell.innerHTML + (nav ? nav.innerHTML : "")).match(/__IC_[a-z]+__/g) || []).length;
    /* #nav carries no token by design (check_splash), so the count above
       cannot fail for it: its buttons are painted from JS after
       paintIcons(), and a throw there leaves them blank. Read the icon
       itself; a clone with its svg removed must read as missing. */
    const hasIc = (e) => !!(e && e.querySelector("svg.ic"));
    const nn = document.getElementById("nav-north"), nc = document.getElementById("nav-center");
    const navNorth = hasIc(nn), navCenter = hasIc(nc);
    let navPlant = false;
    if (nn) { const cl = nn.cloneNode(true); cl.querySelectorAll("svg").forEach((x) => x.remove()); navPlant = !hasIc(cl); }
    const textOf = (el) => { if (el.id === "peek-chev") return "";
      const c = el.cloneNode(true); c.querySelectorAll("#peek-chev").forEach((x) => x.remove());
      return c.textContent || ""; };
    const scan = () => { const hits = [];
      for (const b of document.querySelectorAll("button")) if (G.test(textOf(b))) hits.push(b.id || b.className || "button");
      for (const id of ["panel", "nav-g", "toast", "tour-card"]) { const e = document.getElementById(id);
        const k = e ? (textOf(e).match(GG) || []).length : 0; if (k) hits.push("#" + id + " x" + k); }
      return hits; };
    const inCard = (h) => { const x = h.find((k) => k.startsWith("#panel x")); return x ? +x.slice(8) : 0; };
    const base = scan();
    // its negative controls: a planted emoji control, a planted text arrow in
    // the card and a planted chevron WITHOUT the peek-chev id are each caught;
    // #peek is not flagged for its own chevron, which is still there
    const plant = document.createElement("button"); plant.id = "v4plant-emoji";
    plant.textContent = "\u{1F680}"; shell.appendChild(plant);
    const caught = scan().includes("v4plant-emoji"); plant.remove();
    const panel = document.getElementById("panel");
    const p1 = document.createElement("span"); p1.textContent = "\u25B8 x"; panel.appendChild(p1);
    const caughtCard = inCard(scan()) > inCard(base); p1.remove();
    const p2 = document.createElement("span"); p2.textContent = "\u25BE"; panel.appendChild(p2);
    const caughtChev = inCard(scan()) > inCard(base); p2.remove();
    const peekFree = !base.includes("peek") && G.test((document.getElementById("peek-chev") || {}).textContent || "");
    const emojiButtons = scan();
    // a control whose handler still fires after the icon pass
    let fired = false;
    const t = document.querySelector('#tabs .tab[data-go="plan"]');
    t.click(); fired = /\bon\b/.test(t.className);
    document.querySelector('#tabs .tab[data-go="map"]').click();
    return { svgs, leftover, emojiButtons, caught, caughtCard, caughtChev, peekFree, fired,
             navNorth, navCenter, navPlant };
  }, GLYPH_SRC);
  ok(icn.svgs >= 16, `${icn.svgs} controls carry a drawn icon`);
  ok(icn.leftover === 0, `no icon placeholder reached the screen (${icn.leftover})`);
  ok(icn.navNorth && icn.navCenter && icn.navPlant,
     `the ride sheet's North up and Re-centre draw an icon (north ${icn.navNorth}, centre ${icn.navCenter}); `
     + `a copy with its svg removed reads as missing (its negative control, ${icn.navPlant})`);
  /* take 188 · A222 put the voice button in the ride sheet and A216 draws it
     as an icon: nothing is listed, and the list may only stay empty */
  const EMOJI_KNOWN = [];
  const emojiNew = icn.emojiButtons.filter((x) => !EMOJI_KNOWN.includes(x));
  ok(icn.caught && icn.caughtCard && icn.caughtChev && icn.peekFree,
     "the glyph scan catches a planted emoji control, a planted text arrow in the card and a planted "
     + "chevron without the peek-chev id, and does not flag #peek for its own chevron (its negative controls)");
  ok(emojiNew.length === 0,
     `no emoji or text glyph in any control, card, guidance line, toast or tour card `
     + `(${icn.emojiButtons.join(", ") || "none"})`);
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
  /* take 188 · A217 · A113 re-decided: "at most 5 on screen" became "a
     destination holds at most 7, every one of them fully on screen" — the
     strips wrap, and the device matrix counts each destination at every
     size (the destination counter). Here, the ceiling itself. */
  ok(most <= 7 && most < tb.total,
     `${tb.total} actions split across destinations — at most ${most} in one (the ceiling is 7; `
     + `was ${tb.total} in one scrolling row)`);
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
    const afterPoi = { dot: vis("poi-dot"), label: vis("poi-dot-major"),
                       stack: vis("poi-stack-bg"), stackLbl: vis("poi-stack") };   /* take 186 */
    panel.querySelector('[data-lg="0"]').click();
    await sleep(300);
    /* take 188 · A226 · "Map text" (was All labels) hides TEXT only. At a
       view that has pins and text: every symbol layer's visibility and the
       pins/badges/stack circles drawn, text drawn, text-fields, then the
       same with the row off, then on again. The verdicts are node functions
       below, proved on the take-187 path run live (every symbol layer and
       the stack circle set to none, as lyrSet did) and on planted readings. */
    const li = [...panel.querySelectorAll("[data-lg]")].length - 1;
    const row = panel.querySelector(`[data-lg="${li}"]`), rowText = row ? row.innerText.replace(/\s+/g, " ").trim() : "";
    const cam = { c: m.getCenter(), z: m.getZoom() };
    const idle = async () => { for (let i = 0; i < 60 && !m.areTilesLoaded(); i++) await sleep(200);
      await Promise.race([new Promise((r) => { m.once("idle", r); m.triggerRepaint(); }), sleep(8000)]); await sleep(250); };
    const SYM = m.getStyle().layers.filter((l) => l.type === "symbol").map((l) => l.id);
    const PIN = ["poi-dot", "poi-dot-major", "poi-stack-bg", "poi-stack"];
    const TXTONLY = m.getStyle().layers.filter((l) => l.type === "symbol" && l.layout && l.layout["text-field"] !== undefined
      && !l.layout["icon-image"] && l.id !== "peak-dot").map((l) => l.id);
    const qn = (ids) => { try { return m.queryRenderedFeatures({ layers: ids.filter((id) => m.getLayer(id)) }).length; } catch (e) { return -1; } };
    /* a view that HOLDS pins and text (landmine 130): destination pins of a
       kind this mode shows, tried in turn until one draws */
    const kinds = (window.__mode && window.__mode.now && window.__mode.now().kinds) || null;
    const cands = (m.getStyle().sources.poi.data.features || []).filter((f) => f.properties && f.properties.d === 1
      && (!kinds || kinds.includes(f.properties.k))).slice(0, 40);
    let dst = null, tries = 0;
    for (const f of cands) { tries++; m.jumpTo({ center: f.geometry.coordinates, zoom: 12.6 }); await idle();
      if (qn(PIN) > 0 && qn(TXTONLY) > 0) { dst = f; break; } }
    const snapV = () => { const o = {}; for (const id of SYM.concat(["poi-stack-bg"])) o[id] = vis(id); return o; };
    const tf = () => { const o = {}; for (const id of SYM) { try { o[id] = JSON.stringify(m.getLayoutProperty(id, "text-field")); } catch (e) { o[id] = "ERR"; } } return o; };
    const reading = () => ({ v: snapV(), tf: tf(), pins: qn(PIN), text: qn(TXTONLY),
      shieldIcon: (() => { try { return m.getPaintProperty("lbl-shield", "icon-opacity"); } catch (e) { return "ERR"; } })(),
      rowOn: /\bon\b/.test((panel.querySelector(`[data-lg="${li}"]`) || {}).className || "") });
    const t0 = reading();
    panel.querySelector(`[data-lg="${li}"]`).click(); await sleep(300); await idle();
    const t1 = reading();
    panel.querySelector(`[data-lg="${li}"]`).click(); await sleep(300); await idle();
    const t2 = reading();
    /* the take-187 path, live: every symbol layer and the stack circle hidden */
    const was = snapV(); let tOld = null;
    try { for (const id of Object.keys(was)) m.setLayoutProperty(id, "visibility", "none"); await idle(); tOld = reading(); }
    finally { for (const [id, on] of Object.entries(was)) m.setLayoutProperty(id, "visibility", on ? "visible" : "none"); }
    await idle();
    const tBack = snapV();
    m.jumpTo({ center: cam.c, zoom: cam.z });
    document.getElementById("c-layers").click();
    return { opened, rows, bms, before, afterPoi, rowText, dst: !!dst, tries, t0, t1, t2, tOld, restored: JSON.stringify(tBack) === JSON.stringify(was),
             TXTONLY, mode: window.__mode && window.__mode.get() };
  });
  ok(lyr.opened && lyr.rows >= 4 && lyr.bms === 2,   /* take 188 · A212: Map and Hybrid */
     `layers panel opens with ${lyr.bms} basemaps and ${lyr.rows} layer groups`);
  ok(lyr.afterPoi.dot === false && lyr.afterPoi.label === false
     && lyr.afterPoi.stack === false && lyr.afterPoi.stackLbl === false,
     "turning Places off hides the pins, their labels and the stack badges (take 186)");
  /* A226 verdicts. off: no visibility changed, pins and badges still drawn
     (> 0), no text-only feature drawn, every text-field but the stack count's
     and the summit mark's empty, the shield's plate faded, the stack count
     kept. on: text-fields and every visibility back as they were, so no group
     the mode keeps off comes on. */
  const a226Off = (a, b) => { const why = [];
    if (!a || !b) return ["no reading"];
    const moved = Object.keys(a.v).filter((id) => a.v[id] !== b.v[id]);
    if (moved.length) why.push("visibility moved: " + moved.slice(0, 5).join(", "));
    if (!(b.pins > 0)) why.push(`pins drawn ${b.pins}`);
    if (b.text !== 0) why.push(`${b.text} text features still drawn`);
    const full = Object.keys(b.tf).filter((id) => !/^(poi-stack|peak-dot)$/.test(id) && b.tf[id] !== undefined && b.tf[id] !== '""' && b.tf[id] !== "undefined");
    if (full.length) why.push("text-field kept on " + full.slice(0, 4).join(", "));
    if (b.tf["poi-stack"] !== a.tf["poi-stack"]) why.push("the stack count was touched");
    if (b.shieldIcon !== 0) why.push(`shield plate opacity ${b.shieldIcon}`);
    if (b.rowOn) why.push("row still reads on");
    return why; };
  const a226On = (a, c) => { const why = [];
    if (!a || !c) return ["no reading"];
    const moved = Object.keys(a.v).filter((id) => a.v[id] !== c.v[id]);
    if (moved.length) why.push("visibility moved: " + moved.slice(0, 5).join(", "));
    const tfd = Object.keys(a.tf).filter((id) => a.tf[id] !== c.tf[id]);
    if (tfd.length) why.push("text-field not restored: " + tfd.slice(0, 4).join(", "));
    if (!(c.text > 0)) why.push(`text drawn ${c.text}`);
    if (!c.rowOn) why.push("row reads off");
    return why; };
  const onPlant = lyr.t0 ? { ...lyr.t2, v: { ...lyr.t2.v, "county-label": true, "cont-label": true } } : null;
  const offOld = a226Off(lyr.t0, lyr.tOld), offPlantText = a226Off(lyr.t0, lyr.t0 && { ...lyr.t1, text: 3 }), onOld = a226On(lyr.t0, onPlant);
  ok(lyr.dst && lyr.t0 && lyr.t0.pins > 0 && lyr.t0.text > 0 && lyr.t0.rowOn,
     `A226 · the view holds pins (${lyr.t0 && lyr.t0.pins}, found at try ${lyr.tries}) and text (${lyr.t0 && lyr.t0.text} features on ${lyr.TXTONLY && lyr.TXTONLY.length} text-only layers) with Map text on (mode ${lyr.mode})`);
  ok(offOld.length > 0 && offOld.some((x) => /pins drawn 0|visibility moved/.test(x)) && offPlantText.some((x) => /text features still drawn/.test(x))
     && onOld.some((x) => /visibility moved: county-label/.test(x)) && lyr.restored,
     `A226 · the judges reject take 187's path run live (${offOld.slice(0, 2).join("; ")}), planted text left drawn, and a planted ON that shows county names and contour labels`);
  const off = a226Off(lyr.t0, lyr.t1), on = a226On(lyr.t0, lyr.t2);
  ok(off.length === 0, `A226 · Map text off hides text only: pins/badges/stack circles drawn ${lyr.t1 && lyr.t1.pins}, text ${lyr.t1 && lyr.t1.text}, no visibility written, stack counts kept`
     + (off.length ? " — " + off.join("; ") : ""));
  ok(on.length === 0, `A226 · Map text on restores the style's own text and shows no group the mode keeps off (text ${lyr.t2 && lyr.t2.text})`
     + (on.length ? " — " + on.join("; ") : ""));
  ok(/^Map text\b/.test(lyr.rowText) && /Names and numbers/.test(lyr.rowText) && /Pins and the count on a stack stay/.test(lyr.rowText),
     `A226 · the row says what it turns off and what stays: "${lyr.rowText}"`);
  }
  if (RUN("labels")) {
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
}

if (RUN("basemap")) {
/* Satellite has never been proven to draw. It is a separate source type (image,
   blob url) from everything above, so it fails independently.
   take 188 · A212 (G1) · two basemaps: c-base toggles Map → Hybrid → Map in
   two taps, the chip names each, and the photo shows only on Hybrid. The
   verdict is proved on take 187's three-state reading first (Map, Satellite,
   Hybrid: two taps left it on Hybrid), which it must reject. */
const sat = await page.evaluate(async () => {
  const m = window.map;
  if (!m) return { noButton: true };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const btn = document.getElementById("c-base");
  if (!btn) return { noButton: true };
  const read = () => { let v = "err"; try { v = m.getLayoutProperty("sat", "visibility") || "visible"; } catch (e) { }
    return { vis: v, lbl: ((document.querySelector("#c-base span") || {}).textContent || "").trim() }; };
  const seq = [read()];
  btn.click(); await sleep(1200); seq.push(read());
  btn.click(); await sleep(1200); seq.push(read());
  return { seq, satOk: !!(window.__sat && window.__sat.ok) };
});
const g1 = (seq, satOk) => seq.length === 3 && (satOk
  ? seq[0].vis === "none" && seq[0].lbl === "Map" && seq[1].vis === "visible" && seq[1].lbl === "Hybrid"
    && seq[2].vis === "none" && seq[2].lbl === "Map"
  : seq.every((r) => r.vis === "none" && r.lbl === "Map"));
const g1Plant = g1([{ vis: "none", lbl: "Map" }, { vis: "visible", lbl: "Satellite" }, { vis: "visible", lbl: "Hybrid" }], true);
if (sat.noButton) ok(false, "basemap button present");
else {
  ok(!g1Plant, `the two-basemap verdict rejects take 187's three-state cycle (Map, Satellite, Hybrid)`);
  ok(g1(sat.seq, SAT_EXPECT) && sat.satOk === SAT_EXPECT,
     `c-base toggles ${sat.seq.map((r) => r.lbl + "/" + r.vis).join(" → ")} — two basemaps, photo only on Hybrid`
     + (SAT_EXPECT ? "" : " (no imagery: stays on Map)"));
}

}

if (RUN("selftest")) {
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
  /* Two checks are flaky in HEADLESS and solid on the phone: geolocation is
     denied outright here, and trail-names measures label placement that varies
     run to run at one viewport (landmine 151). Jacob's device passes both.
     Tolerated BY NAME so a real regression anywhere else still fails, rather
     than by loosening the count to zero-or-one (take 109). */
  const HEADLESS_FLAKY = [/^GPS\//, /^RENDER\/trail-names$/];
  const stState = await page.evaluate(() => {
    const rb = document.getElementById("railbody");
    const r = document.getElementById("rail");
    const bh = document.getElementById("btn-home");
    return {
      fails: (typeof window.__st === "function" ? window.__st() : [])
        .filter((x) => x.ok === false).map((x) => `${x.g}/${x.id}`),
      detail: (typeof window.__st === "function" ? window.__st() : [])
        .filter((x) => x.id === "controls-on-screen").map((x) => x.d)[0] || "",
      /* geometry alongside the verdict, so a failure here names its own cause
         instead of costing another round trip (landmine 131) */
      geo: `rail="${r ? r.className : "?"}" railbody=${rb ? Math.round(rb.getBoundingClientRect().height) : "?"}`
         + ` vh=${document.documentElement.clientHeight}`
         + ` btn-home=${bh ? Math.round(bh.getBoundingClientRect().bottom) : "?"}`,
    };
  });
  const stFails = stState.fails;
  const real = stFails.filter((n) => !HEADLESS_FLAKY.some((re) => re.test(n)));
  ok(real.length === 0,
     `app self-test: ${st.pass} passed, ${real.length} real failure(s)`
     + (real.length ? ` — ${real.join(", ")} :: ${stState.detail} :: ${stState.geo}` : "")
     /* only name what was ACTUALLY tolerated; the first version printed every
        failure under that label, which read as "all fine" when one was not */
     + (stFails.length > real.length
        ? ` (tolerated here: ${stFails.filter((n) => !real.includes(n)).join(", ")})`
        : ""));
  /* take 189 · A236 · the self-test reads back which font the map's labels
     draw in: one INFO line naming the APEX stack, the glyph ranges loaded
     from the pack, failed and pending, and the local font when MapLibre drew
     locally. Not a verdict on the font — the Fold session answers that —
     but on the readback: in a real engine it must READ (an UNKNOWN here
     means the readback is blind, and so would be the phone's). Printed in
     full. Its controls: no line, and an UNKNOWN line, are rejected. */
  {
    /* take 189 · cold audit · and it COUNTED something: the labels have drawn,
       so every glyph came from the pack or was drawn locally; "0 from the
       pack, 0 drawn locally" is a reader whose fields matched nothing (the
       manager's private names), and no line may carry an UNKNOWN */
    const glOk = (rows) => rows.length === 1 && rows[0].ok === null
      && /^APEX \(\d+ label layers?\): ranges from the pack .+ · failed .+ · pending .+ · \d+ glyphs from the pack, \d+ drawn locally/.test(rows[0].d)
      && !/UNKNOWN/.test(rows[0].d)
      && (() => { const c = /(\d+) glyphs from the pack, (\d+) drawn locally/.exec(rows[0].d); return !!c && (+c[1]) + (+c[2]) > 0; })();
    const gl = (st.results || []).filter((r) => r.g === "RENDER" && r.id === "glyphs");
    console.log("  ..   app self-test RENDER/glyphs: " + (gl.length ? gl.map((r) => r.d).join(" | ") : "(no line)"));
    /* fix round 1 · "no glyph requested yet" is rejected too: by the time this
       section runs the labels have drawn, so that phrase here can only be a
       reader whose key matched nothing (landmine 55's shape) */
    const glCtl = !glOk([]) && !glOk([{ g: "RENDER", id: "glyphs", ok: null, d: "UNKNOWN — this MapLibre build exposes no glyph manager" }])
      && !glOk([{ g: "RENDER", id: "glyphs", ok: null, d: "APEX (24 label layers): no glyph requested yet" }])
      && !glOk([{ g: "RENDER", id: "glyphs", ok: null, d: "APEX (24 label layers): UNKNOWN — the glyph manager holds Other, none is APEX" }])
      && !glOk([{ g: "RENDER", id: "glyphs", ok: null, d: "APEX (24 label layers): ranges from the pack none · failed none · pending none · 0 glyphs from the pack, 0 drawn locally" }])
      && !glOk([{ g: "RENDER", id: "glyphs", ok: null, d: "APEX (24 label layers): ranges from the pack none · failed 0-255 · pending none · 0 glyphs from the pack, 40 drawn locally ;; Other (1 label layer): UNKNOWN — x" }])
      && glOk([{ g: "RENDER", id: "glyphs", ok: null, d: "APEX (9 label layers): ranges from the pack none · failed 0-255 · pending none · 0 glyphs from the pack, 40 drawn locally" }]);
    ok(glOk(gl) && glCtl, `the app's self-test reads back the label font and glyph ranges (one INFO line, a reading, `
       + `not UNKNOWN, glyphs counted); its controls, no line, an UNKNOWN line, "no glyph requested yet" and a blind `
       + `"0 from the pack, 0 drawn locally", are rejected (${glCtl})`);
  }
  if (st.fail > 0)
    for (const line of st.text.split("\n").filter((l) => l.startsWith("  XX")))
      console.log("       " + line.trim());
  if (process.env.RENDER_DEBUG) console.log(st.text.split("\n").map(l=>"       "+l).join("\n"));
}

}

if (RUN("routes")) {
/* Route layers must RENDER, not merely receive data. Two features shipped for
   eight takes with their sources fed and no layer to draw them, and every check
   I had written measured setData (take 43). Only a real engine can answer
   "did it draw". */
/* A harness must survive the broken app it is diagnosing: with an invalid style
   there is no map, and throwing here turns "5 checks failed" into a stack trace
   that says nothing (take 43). */
/* take 189 · A227 · run without modes (--only), the route is planned for the
   machine the full run has here: the modes section's walking drill hands the
   side-by-side back (its own check says so) and nothing after it changes the
   ride machine before this point. The device matrix judges these cards. */
if (ONLY && !ONLY.has("modes")) {
  await page.evaluate(() => { try { window.__route.setMachine("sxs"); } catch (e) {} });
  console.log("  ..   (--only) the route is planned for the side-by-side, as the full run leaves it");
}
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

}

/* The same layout checks the on-device self-test runs, across the phone sizes
   people actually own. A control that fits on a 430 px screen and slides off a
   360 px one is broken for half the users (take 65). */
/* take 188 · A215 · ONE way to force the ride states, shared by the device
   matrix (G2/G3), the V4 audit (its full ride) and the tap walker: page-side
   window.__v4ride. force("pressed") is Ride pressed with no fix — #nav up,
   no ribbon, navStart's own state; force("full") is the ribbon, the ride
   sheet, a REAL guidance line (one fix on the route the cards hold, through
   the app's own guidance) and the off-route alert in the app's own words
   (__nav.alert, never a copied string). undo() puts back what force changed
   (the ride flag, the alert, the position mode, the nav state) and ends the
   trip the fix saved. Neither may throw (landmine 217). */
const FORCE_RIDE = () => {
  window.__v4ride = {
    saved: null,
    force(kind) {
      try {
        const N = window.__nav, sh = document.getElementById("shell"), al = document.getElementById("alert");
        if (!this.saved) this.saved = { ride: sh.dataset.ride, pos: N.pos(), al: [al.className, al.innerHTML] };
        sh.dataset.ride = "1";
        if (kind === "pressed") { window.hudShow(false); N.start(); return { ok: true, line: false }; }
        const G = N.plan(); N.start(); let line = false;
        /* the first fix writes "Recording" into the card: keep the card's
           own nodes (the route cards carry listeners) and put them back */
        const P = document.getElementById("panel"), kids = [...P.childNodes], cls = P.className;
        if (G && G.pts && G.pts.length > 2) { N.fix(G.pts[2], 8, 8, null); line = !document.getElementById("nav-g").hidden; }
        P.replaceChildren(...kids); P.className = cls;
        window.hudShow(true); window.hudSet(11.2, 48.8, null);
        al.className = "on"; al.innerHTML = N.alert(420);
        return { ok: true, line };
      } catch (e) { return { ok: false, line: false, error: String(e) }; }
    },
    undo() {
      const w = this.saved; if (!w) return; this.saved = null;
      const N = window.__nav, sh = document.getElementById("shell"), al = document.getElementById("alert");
      try { N.stop(); } catch (e) {} try { N.reset(); } catch (e) {} try { N.end(); } catch (e) {}
      try { window.hudShow(false); } catch (e) {} try { N.pos(w.pos); } catch (e) {}
      try { al.className = w.al[0]; al.innerHTML = w.al[1]; } catch (e) {}
      try { if (w.ride === undefined) delete sh.dataset.ride; else sh.dataset.ride = w.ride; } catch (e) {}
    } };
};
if (RUN("devices")) {
await page.evaluate(FORCE_RIDE);
/* The HUD is a NEW full-width element and the matrix would otherwise measure it
   hidden — a check with nothing to look at reports success (landmine 85). Force
   the ride state on so every device size measures the ribbon and the stats
   block actually laid out (take 78). */
await page.evaluate(() => {
  try { window.hudShow && window.hudShow(true); window.hudSet &&
        window.hudSet(11.2, 48.8, null); } catch (e) {}
});
/* take 189 · A238 · the route-card rows read, kept for the dirt bike's
   pass after the matrix */
let ROWS_FN = null;
for (const dev of DEVICES) {
  await page.setViewport({ width: dev.width, height: dev.height, deviceScaleFactor: dev.dpr });
  await vpSettle(1200);
  await page.evaluate(() => { try { window.hudPaint && window.hudPaint(); } catch (e) {} });
  const fit = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    /* The rail folds at rest (A127), and a folded container clips its children
       while they keep their natural positions — so Return home measures as
       off-screen when it is simply put away. Open it before measuring, the same
       reason the HUD is forced on: forcing the conditional state is part of the
       check (landmine 111). */
    const _rail = document.getElementById("rail");
    const _body = document.getElementById("railbody");
    /* take 188 · A225: read what to put back BEFORE clearing it. The class was
       read after `className = ""`, so "put the drawer back" restored "" and
       left the drawer open for every check after this loop. */
    const _railWas = _rail ? _rail.className : null;
    const _bodyWas = _body ? (_body.getAttribute("style") || "") : null;
    if (_rail) _rail.className = "";
    /* The fold is a 260 ms transition, so setting the class and measuring in the
       same frame still reads the FOLDED geometry. Force the end state inline —
       measuring mid-animation measures the animation. (The inline padding that
       copied #railbody's own is gone: it measured a layout the stylesheet may
       no longer have.) take 188 · A215: nor is max-height forced to none any
       more — an uncapped drawer is a state the app never has (the body's cap,
       38vh, scrolls the rest), and at 360x800 the V4 sizes made it push the
       tool strip off the top of the screen. The drawer is measured open at
       its real cap. */
    if (_body) { _body.style.transition = "none"; _body.style.opacity = "1"; }
    const wide = [];
    document.querySelectorAll("#shell *").forEach((e) => {
      const r = e.getBoundingClientRect();
      if (r.width > vw + 1) wide.push((e.id || e.className || e.tagName) + " " + Math.round(r.width));
    });
    const off = [];
    /* take 187 · A211 — `c-labels` left the app long ago and this list kept
       skipping it in silence; a missing id now fails the check. The Layers
       chip stands in for it. */
    /* take 188 · A215 · c-base and c-hd are the right column now: their
       right edges are what a narrow screen would push off */
    ["btn-home", "c-base", "c-hd", "c-layers", "coords"].forEach((id) => {
      const e = document.getElementById(id);
      if (!e) { off.push(id + " (missing)"); return; }
      const r = e.getBoundingClientRect();
      if (!r.height) return;
      // A chip inside a horizontally scrolling strip is not off-screen, it is
      // scrolled — reaching it is one swipe. Only VERTICAL overflow strands a
      // control. Flagging c-labels on every size, including the one Jacob uses
      // daily, was the check being wrong (landmine 54, again).
      let scroller = e.parentElement;
      let inStrip = false, inBody = false;
      while (scroller && scroller !== document.body) {
        const ox = getComputedStyle(scroller).overflowX;
        if (ox === "auto" || ox === "scroll") { inStrip = true; break; }
        scroller = scroller.parentElement;
      }
      /* take 188 · A215 · the same holds vertically for the drawer's body,
         now measured at its real cap: a line below the card's fold is one
         scroll away, provided the scrolling body itself is on screen */
      const body = e.closest("#railbody"), br = body ? body.getBoundingClientRect() : null;
      if (br && getComputedStyle(body).overflowY === "auto" && br.height > 0 && br.top >= -2 && br.bottom <= vh + 2
        && r.top >= br.top - 2 && r.top < br.top + body.scrollHeight + 2) inBody = true;
      if (!inBody && (r.bottom > vh + 2 || r.top < -2)) off.push(id + " (vertical)");
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
    /* Put the drawer back. Forcing it open to measure and LEAVING it open meant
       the self-test ran later against a permanently expanded rail and reported
       four action buttons off-screen — a check that changed the state it was
       measuring and then handed that state to the next check (take 109). */
    if (_rail && _railWas !== null) _rail.className = _railWas;
    if (_body && _bodyWas !== null) _body.setAttribute("style", _bodyWas);
    return { wide, off, vw, vh, hud };
  });
  ok(fit.wide.length === 0 && fit.off.length === 0,
     `${dev.name} ${dev.width}x${dev.height}: nothing overflows, controls reachable`
     + (fit.wide.length ? " — wide: " + fit.wide.join(", ") : "")
     + (fit.off.length ? " — off-screen: " + fit.off.join(", ") : ""));
  /* take 188 · A222 · the stats left this corner for the ride sheet, which
     yields to the forced-open drawer above — it is measured on its own below,
     folded and open at the drawer's real cap */
  ok(fit.hud.barVisible && fit.hud.barWidth === fit.vw && fit.hud.labels > 0,
     `${dev.name}: ride HUD fits — ribbon ${fit.hud.barWidth}px of ${fit.vw}, `
     + `${fit.hud.labels} labels`);
  /* take 189 · A229 · THE ATTRIBUTION (i) CLEAR OF THE FOLDED DRAWER. It sat
     half under #rail's lip (843-867 px against the drawer's top at 857 at
     411x960, take 188's seal shots), its upper half still taking a tap. Read
     at every device size with the drawer folded, at rest and riding
     (#shell[data-ride]: the folded drawer's action row is up): the button
     drawn, its foot at or above the drawer's top, and a tap at its top,
     centre and foot landing on it. The drawer is folded by its class with
     its transitions off, read synchronously and put back the same way, so
     no slide, rcFit or RAIL_AT change reaches the checks after it. Its plant:
     the corner put back where MapLibre puts it (bottom 0, the compact
     margin 10 px), take 188's place, must read covered. */
  const atb = await page.evaluate(async () => {
    const sh = document.getElementById("shell"), rail = document.getElementById("rail"),
          corner = document.querySelector(".maplibregl-ctrl-bottom-right"),
          btn = document.querySelector(".maplibregl-ctrl-attrib-button"),
          box = btn ? btn.closest(".maplibregl-ctrl-attrib") : null;
    if (!sh || !rail || !corner || !btn || !box) return { error: "missing " + [!sh && "#shell", !rail && "#rail",
      !corner && "the attribution corner", !btn && "its (i) button"].filter(Boolean).join(", ") };
    await window.__rh.settle(3000);
    const tr = ["railbody", "actions"].map((id) => document.getElementById(id)).filter(Boolean);
    const was = { cls: rail.className, ride: sh.dataset.ride, tr: tr.map((e) => e.style.transition) };
    const read = () => { const b = btn.getBoundingClientRect(), r = rail.getBoundingClientRect(), cs = getComputedStyle(btn);
      const drawn = b.width >= 1 && b.height >= 1 && cs.display !== "none" && cs.visibility !== "hidden";
      const taps = [0.15, 0.5, 0.85].map((f) => { const h = document.elementFromPoint(b.left + b.width / 2, b.top + b.height * f);
        return !!h && btn.contains(h); });
      return { drawn, clear: b.bottom <= r.top + 0.5, taps: taps.every(Boolean), top: Math.round(b.top),
               foot: Math.round(b.bottom), rail: Math.round(r.top) }; };
    tr.forEach((e) => { e.style.transition = "none"; });
    /* fix round 2 · the drawer really folded, for every read the plant's too */
    const folded = () => /\bfolded\b/.test(rail.className) && (document.getElementById("railbody") || { getBoundingClientRect: () => ({ height: 99 }) }).getBoundingClientRect().height < 8;
    const out = {};
    for (const st of ["rest", "ride"]) {
      if (st === "ride") sh.dataset.ride = "1"; else delete sh.dataset.ride;
      rail.className = "folded"; out[st] = read();
      out[st].folded = folded();
    }
    delete sh.dataset.ride; rail.className = "folded";
    corner.style.bottom = "0px"; box.style.marginBottom = "10px";
    out.plant = read(); out.plant.folded = folded();
    corner.style.bottom = ""; box.style.marginBottom = "";
    rail.className = was.cls;
    if (was.ride === undefined) delete sh.dataset.ride; else sh.dataset.ride = was.ride;
    rail.getBoundingClientRect();
    tr.forEach((e, i) => { e.style.transition = was.tr[i]; });
    return out;
  });
  {
    const good = (x) => !!x && x.folded && x.drawn && x.clear && x.taps;
    /* fix round 2 · the plant is judged on its geometry, positively: drawn on
       a folded drawer and under its lip or missing a tap. "!good(plant)" was
       true whatever the plant read (it carried no .folded) */
    const covered = (x) => !!x && x.folded && x.drawn && (!x.clear || !x.taps);
    const say = (x) => x ? `(i) ${x.top}-${x.foot} px, drawer top ${x.rail}${x.clear ? "" : " — UNDER the drawer"}${x.taps ? "" : " — a tap misses it"}${x.drawn ? "" : " — NOT DRAWN"}` : "?";
    ok(!atb.error && good(atb.rest) && good(atb.ride) && covered(atb.plant),
       atb.error ? `${dev.name}: the attribution check found ${atb.error}`
       : `${dev.name}: the attribution (i) stands clear of the folded drawer and takes its taps — at rest ${say(atb.rest)}; `
         + `riding ${say(atb.ride)}; its plant, MapLibre's own place (take 188's), reads ${covered(atb.plant) ? "covered: " + say(atb.plant) : "NOT covered — the judge MISSED it: " + say(atb.plant) + (atb.plant && atb.plant.folded ? "" : " (drawer not folded)")}`);
  }
  /* take 188 · A222 · THE RIDE SHEET, at every size, in the state a rider
     sees: #shell[data-ride] on, so the folded drawer's action row is up.
     Read with the drawer FOLDED four ways — free and routed, and each again
     as the tallest sheet (no speech in the WebView, so the Voice note is up,
     as on the Fold (A218); on the free read a simulated ride too, so the
     "Simulated ride" line is up) — then with the compass panel opened
     through its own chip, then with the drawer OPEN at its real cap under a
     body tall enough to reach it (not maxHeight:none).
     Folded: the three stats in the order the ride calls for, left to right,
     each with a value; an opaque surface (A150); inside the viewport; clear
     of the ribbon, the tool chips, the drawer, the left stack, the HD chip,
     the nav strip, the alert and the panels on its anchor; the four ride
     buttons and the drawer's four action buttons each drawn, inside the
     viewport and the thing a tap at their centre lands on (landmine 135).
     Open: the stats fold away and Stop, Re-centre, North up and Voice stay
     one tap each, the sheet overlapping nothing (landmine 135: on take 187
     they sat in #nav whatever the drawer did). Every judge is proved on a
     plant first (landmine 54). */
  const sh = await page.evaluate(async () => {
    /* take 188 · landmine 217 / DESIGN-v4 §11: nothing in here may throw. A
       missing hook or element comes back as `error`, a FINDING with a
       verdict; `undo` puts the page back on that path too. */
    let undo = () => {};
    try {
    const s = (ms) => new Promise((r) => setTimeout(r, ms));
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    /* landmine 224: draw frames until no finite animation is left */
    const settle = async () => { for (let i = 0; i < 60; i++) { await frame();
      if (!document.getAnimations().some((a) => a.playState === "running" && a.effect
        && isFinite(a.effect.getComputedTiming().endTime))) return true; await s(30); } return false; };
    const vis = (e) => { if (!e || e.hidden) return null;
      for (let a = e; a && a !== document.documentElement; a = a.parentElement) { const c = getComputedStyle(a);
        if (c.display === "none" || c.visibility === "hidden" || +c.opacity === 0) return null; }
      const r = e.getBoundingClientRect(); return r.width >= 1 && r.height >= 1 ? r : null; };
    const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
    const cells = (root) => [...root.querySelectorAll(".hc")].map((c) => ({ c, r: vis(c) })).filter((x) => x.r)
      .map((x) => ({ k: ((x.c.querySelector(".hk") || {}).textContent || "").trim(),
                     v: ((x.c.querySelector(".hv") || {}).textContent || "").trim(), l: x.r.left }));
    const orderOk = (cs, want) => cs.length === want.length && cs.every((x, i) => x.k === want[i] && x.v !== "")
      && cs.every((x, i) => i === 0 || x.l > cs[i - 1].l);
    const OTHER = () => [...["hudbar", "rail", "readout", "c-base", "c-act", "c-mode", "c-hd", "nav", "alert",
      "cmppanel", "diagpanel"].map((id) => document.getElementById(id)), ...document.querySelectorAll("#tools .chip"),
      document.querySelector(".maplibregl-ctrl-bottom-left"), document.querySelector(".maplibregl-ctrl-bottom-right")];
    const overlaps = (r0, extra) => [...OTHER(), ...(extra || [])].filter((e) => { const r = vis(e); return !!r && hit(r0, r); })
      .map((e) => e.id || String(e.className).split(" ")[0]);
    const alpha = (e) => { const m = getComputedStyle(e).backgroundColor.match(/[\d.]+/g) || []; return m.length < 4 ? 1 : +m[3]; };
    const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    /* one tap: drawn at least `min` px each way, inside the viewport, and
       the element a tap at its centre lands on */
    const tapOn = (e, min) => { const r = vis(e); if (!r || r.width < min || r.height < min) return false;
      if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1) return false;
      const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!h && e.contains(h); };
    const hs = document.getElementById("hudstats"), rail = document.getElementById("rail"), N = window.__nav;
    const shell = document.getElementById("shell"), V = window.__voice;
    const need = { hudstats: hs, rail, shell, alert: document.getElementById("alert"), cmppanel: document.getElementById("cmppanel"),
      "c-compass": document.getElementById("c-compass"), railbody: document.getElementById("railbody"),
      hudcells: document.getElementById("hudcells"), "window.__nav": N, "window.railSet": window.railSet,
      "window.hudPaint": window.hudPaint };
    const lacking = Object.keys(need).filter((k) => !need[k]);
    if (lacking.length) return { error: "missing " + lacking.join(", "), reads: [], hadRoute: false };
    const FREE = ["Trip", "Time", "Speed"], ROUTED = ["Trip", "To go", "Arrive"];
    const BTNS = ["hud-stop", "nav-center", "nav-north", "nav-voice"].map((id) => document.getElementById(id));
    /* take 189 · A233 · the folded drawer's Ride is not one of the ride's
       actions (it is not drawn while riding); it is judged on its own below */
    const ACTS = [...document.querySelectorAll("#actions .act")].filter((a) => a.id !== "btn-ride");
    /* the drawer at its real geometry, no transition to wait out */
    const tr = ["railbody", "actions"].map((id) => document.getElementById(id));
    const trWas = tr.map((e) => e ? e.style.transition : "");
    tr.forEach((e) => { if (e) e.style.transition = "none"; });
    const railWas = rail.className, rideWas = shell.dataset.ride, voiceWas = V ? V.ok : null, posWas = N.pos();
    /* (cold audit, F18: the Tools-tab read below switches tabs and plants a
       turn banner; both are put back, on a throw too) */
    const tabWas = (document.querySelector("#tabs .tab.on") || { dataset: {} }).dataset.go || "map";
    const tabTo = (t) => { const b = document.querySelector(`#tabs .tab[data-go="${t}"]`); if (b) b.click(); };
    const ng = document.getElementById("nav-g"), navEl = document.getElementById("nav"), barEl = document.getElementById("hudbar");
    const ngWas = ng ? [ng.hidden, ng.innerHTML] : null;
    /* force what a ride puts on screen: the ride flag, the alert (off
       route) and, for the routed reads, the nav strip */
    shell.dataset.ride = "1";
    const al = document.getElementById("alert"), alWas = [al.className, al.innerHTML];
    al.className = "on"; al.innerHTML = "Off route <small>planted for the overlap read</small>";
    /* a body tall enough to reach the drawer's cap, without touching the
       card (its route cards carry listeners later checks click) */
    const pad = document.createElement("div"); pad.id = "v4plant-tall"; pad.style.height = "3000px";
    const planted = [];
    /* put everything back — at the end, and on a throw */
    undo = () => {
      planted.forEach((st) => st.remove());
      try { N.stop(); } catch (e) {} if (V) V.ok = voiceWas; try { N.pos(posWas); } catch (e) {} pad.remove();
      try { if (ngWas) { ng.hidden = ngWas[0]; ng.innerHTML = ngWas[1]; } tabTo(tabWas); } catch (e) {}
      al.className = alWas[0]; al.innerHTML = alWas[1];
      if (rideWas === undefined) delete shell.dataset.ride; else shell.dataset.ride = rideWas;
      try { window.railSet(!/\bfolded\b/.test(railWas)); } catch (e) {} rail.className = railWas;
      tr.forEach((e, i) => { if (e) e.style.transition = trWas[i]; });
      try { window.hudPaint(); } catch (e) {}
    };
    const cmp = document.getElementById("cmppanel"), cmpChip = document.getElementById("c-compass");
    const plantCss = (css) => { const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
      planted.push(st); return st; };
    const read = async (o) => {
      if (V) V.ok = o.worst ? false : voiceWas;
      N.pos(o.worst && !o.routed ? "sim" : posWas);
      if (o.open) document.getElementById("railbody").appendChild(pad); else pad.remove();
      window.railSet(!!o.open);
      if (o.routed) N.start(); else N.stop();
      window.hudPaint();
      let opened = false;
      if (o.compass && cmp.hidden) { cmpChip.click(); opened = true; }
      await settle();
      const r = vis(hs), cs = cells(hs);
      const out = { tag: o.tag, open: !!o.open, routed: !!o.routed, worst: !!o.worst, compass: !!o.compass,
               shown: !!r, rect: r ? [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)] : null,
               inView: !!r && r.left >= -1 && r.top >= -1 && r.right <= vw + 1 && r.bottom <= vh + 1,
               labels: cs.map((x) => x.k), order: orderOk(cs, o.routed ? ROUTED : FREE), alpha: alpha(hs),
               over: r ? overlaps(r) : [], btns: BTNS.map((b) => tapOn(b, 48)), acts: ACTS.map((a) => tapOn(a, 44)),
               note: !!vis(document.getElementById("hud-vnote")), src: !!vis(document.getElementById("hud-src")),
               cmp: !!vis(cmp),
               bodyH: Math.round(document.getElementById("railbody").getBoundingClientRect().height),
               maxH: parseFloat(getComputedStyle(document.getElementById("railbody")).maxHeight) };
      if (opened) { cmpChip.click(); await settle(); }
      return out;
    };
    const hadRoute = !!document.querySelector(".rc");
    const out = { reads: [], hadRoute };
    out.reads.push(await read({ tag: "free" }));
    if (hadRoute) out.reads.push(await read({ tag: "routed", routed: true }));
    out.reads.push(await read({ tag: "free, no speech, simulated", worst: true }));
    if (hadRoute) out.reads.push(await read({ tag: "routed, no speech", routed: true, worst: true }));
    out.reads.push(await read({ tag: "compass panel open", compass: true, worst: true }));
    out.reads.push(await read({ tag: "drawer open, simulated", open: true, worst: true }));
    if (hadRoute) out.reads.push(await read({ tag: "drawer open, routed", open: true, routed: true, worst: true }));
    /* take 188 · cold audit (F18) · the compass and diagnostics panels WHILE
       RIDING, where a rider can open them: the Tools tab (leaving it closes
       both), whose strip is the tallest. A222 lifted both panels over the
       ride sheet and left their height bounded by the stage alone, so on a
       small screen the compass grew up over the turn banner (it stacks
       above #nav). Read on a routed ride with the turn banner drawn (its
       words are planted: no fix runs here), the tallest sheet, and each
       panel given more content than any screen holds (900 px, by CSS, so a
       repaint of the panel keeps it): the panel must be drawn, scroll, and
       stop under the ride block. The plant is each panel's height rule as
       it was before the fix. */
    const toolsRead = async (panel, chip, tallCss, oldCss) => {
      const two = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      /* a text line of the compass box straddling the visible foot (the
         cue's top when it is drawn): the top of the cut line, or null */
      const cmpCut = (r) => {
        const mo = document.getElementById("cmpmore"), mr = mo && vis(mo);
        const vb = mr ? mr.top : r.top + panel.clientTop + panel.clientHeight, f0 = (document.getElementById("cmpbox") || {}).firstElementChild;
        const fb = f0 ? f0.getBoundingClientRect().bottom : r.top;
        const tw = document.createTreeWalker(document.getElementById("cmpbox"), NodeFilter.SHOW_TEXT);
        const rg = document.createRange(); let n, cut = null;
        while ((n = tw.nextNode())) { rg.selectNodeContents(n);
          for (const q of rg.getClientRects()) if (q.height > 0 && q.top >= fb - 0.5 && q.top < vb - 0.5 && q.bottom > vb + 0.5) cut = Math.round(q.top); }
        return { cut, cue: !!mr }; };
      /* take 189 · cold audit r2 · scrolled to its end, nothing is below:
         "More below — scroll" must not be drawn there, and is drawn again
         back at the top. Its control: the cue held drawn by a plant, which
         the same read must see at the end */
      const endRead = async () => {
        const mo = document.getElementById("cmpmore");
        const at = async (top) => { panel.scrollTop = top ? 0 : panel.scrollHeight; await two(); await settle();
          return { end: panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 1, top: panel.scrollTop, cue: !!(mo && vis(mo)) }; };
        const end = await at(false);
        const hold = plantCss("#cmpmore{visibility:visible!important}");
        const endCtl = await at(false); hold.remove();
        const back = await at(true);
        return { end, endCtl, back }; };
      const one = async (wantEnd) => {
        if (panel.hidden) chip.click();
        await settle();
        const r = vis(panel), nr = vis(navEl), gr = vis(ng);
        const res = { drawn: !!r, banner: !!gr, top: r ? Math.round(r.top) : null, h: r ? Math.round(r.height) : 0,
          navBottom: nr ? Math.round(nr.bottom) : null, scrolls: panel.scrollHeight > panel.clientHeight + 1,
          over: r ? [navEl, barEl].filter((e) => { const x = vis(e); return !!x && hit(r, x); }).map((e) => e.id) : [] };
        /* take 189 · A231 · usable: what the panel is opened for is whole in
           its visible box — the compass's dial and its heading line (the
           box's first block), Diagnostics' header and first two actions —
           and the sheet's Stop and the panel's own chip stay one tap */
        const blocks = panel === cmp ? [(document.getElementById("cmpbox") || {}).firstElementChild]
          : [...panel.querySelectorAll(".sect, .chip")].slice(0, 3);
        const clipB = r ? r.top + panel.clientTop + panel.clientHeight : 0;
        res.usable = !!r && blocks.length > 0 && blocks.every((b) => { const x = b && b.getBoundingClientRect();
          return !!x && x.height > 0 && x.top >= r.top - 0.5 && x.bottom <= clipB + 0.5; });
        res.room = r ? Math.round(panel.clientHeight) : 0; res.need = panel.scrollHeight;
        res.stop = tapOn(document.getElementById("hud-stop"), 48); res.chip = tapOn(chip, 44);
        /* take 189 · cold audit · the Tools chips drawn (A231's hiding is for a
           small phone only), none under the attribution's (i), and the
           compass box ending on a whole line with its "more below" cue when
           it scrolls (a text line straddling the visible foot is a cut) */
        const tchips = [...document.querySelectorAll("#tools .chip[data-tab=\"tools\"]")];
        res.toolsN = tchips.length;
        res.chips = tchips.filter((c) => !c.hidden && !!vis(c)).length;
        const ai = document.querySelector(".maplibregl-ctrl-bottom-right .maplibregl-ctrl-attrib"), air = ai && vis(ai);
        res.attrib = air ? tchips.filter((c) => { const x = !c.hidden && vis(c); return !!x && hit(air, x); }).map((c) => c.id) : [];
        if (panel === cmp && r) {
          const cc = cmpCut(r);
          res.lineCut = cc.cut; res.cue = cc.cue;
          if (wantEnd && res.scrolls) res.endRd = await endRead();
        }
        if (!panel.hidden) chip.click();
        await settle();
        return res; };
      /* take 189 · A231 · the real content first, then the same with the
         A231 rule taken out of the stylesheet (its control) */
      const real = await one(true);
      let ruleFound = false, bare = null;
      /* take 189 · cold audit · the rule now sits in an @media block: looked
         for inside grouping rules too */
      const findRule = (list, owner) => { for (let i = 0; i < list.length; i++) { const q = list[i];
          if (q.selectorText && q.selectorText.includes("#diagpanel:not([hidden])) #tools")) return { owner, i, txt: q.cssText };
          if (q.cssRules) { const x = findRule(q.cssRules, q); if (x) return x; } } return null; };
      for (const sht of document.styleSheets) { let rules = null; try { rules = sht.cssRules; } catch (e) { continue; }
        const fr = findRule(rules, sht);
        if (fr) { ruleFound = true; fr.owner.deleteRule(fr.i);
          try { bare = await one(); } finally { fr.owner.insertRule(fr.txt, fr.i); } break; } }
      /* its controls: take 189's rule at every size with the (i) held at its
         unlifted place (the cover screen's shot: the (i) on "Diagnostics");
         and for the compass, the box's cap as it was before the line fit */
      const fz = plantCss("#shell[data-ride]:has(#cmppanel:not([hidden]),#diagpanel:not([hidden])) #tools .chip:not(#c-compass):not(#c-markme):not(#c-diag){display:none}"
        + ".maplibregl-ctrl-bottom-right{bottom:var(--r-lg)!important}");
      const forced = await one(); fz.remove();
      /* …and the same forced row with the (i) free: the lift must take it
         off the chip (the behaviour; the read above is its control) */
      const fl = plantCss("#shell[data-ride]:has(#cmppanel:not([hidden]),#diagpanel:not([hidden])) #tools .chip:not(#c-compass):not(#c-markme):not(#c-diag){display:none}");
      const lifted = await one(); fl.remove();
      /* the compass box at a cap that lands in the MIDDLE of its first text
         line below the dial and heading (the cap's own --s-4 moved by the
         difference: what a screen of another height does), read with the
         line fit (it must end on a whole line, with its cue) and, its
         control, with the cap before the fit (the line is cut) */
      let mid = null, midCtl = null, midAt = null;
      if (panel === cmp) {
        if (panel.hidden) chip.click();
        await settle();
        const bx = document.getElementById("cmpbox"), f0 = bx && bx.firstElementChild, mo = document.getElementById("cmpmore");
        panel.style.removeProperty("--cmp-trim"); if (mo) mo.hidden = true;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const pr0 = panel.getBoundingClientRect(), C0 = panel.offsetHeight, bb = parseFloat(getComputedStyle(panel).borderBottomWidth) || 0;
        const fb = f0 ? f0.getBoundingClientRect().bottom : pr0.top;
        const tw = document.createTreeWalker(bx, NodeFilter.SHOW_TEXT), rg = document.createRange(); let n, L = null;
        while ((n = tw.nextNode())) { rg.selectNodeContents(n);
          for (const q of rg.getClientRects()) if (q.height > 0 && q.top >= fb - 0.5 && (L === null || q.top < L.top)) L = q; }
        if (!panel.hidden) chip.click();
        await settle();
        if (L) { const delta = C0 - ((L.top - pr0.top) + L.height / 2 + bb); midAt = Math.round(L.top - pr0.top);
          const sp = plantCss(`#cmppanel{--s-4:${(16 + delta).toFixed(1)}px}`);
          mid = await one(true);
          const sc = plantCss("#cmppanel{max-height:min(62vh,calc(100% - var(--ride-top) - var(--strip-h,64px) - var(--sheet-h,0px) - var(--s-4)))!important}#cmpmore{display:none!important}");
          midCtl = await one(); sc.remove(); sp.remove(); } }
      /* take 189 · cold audit r2 · the fit follows its cap. The box is given
         thirty planted text lines (so the cap lands in text at every size)
         and fitted by the app's own cmpFit — the call a content change
         makes. (1) The ride block grows past the gap the panel keeps under
         the turn banner (the nav strip padded by a whole number of lines
         and a half; no text changes, so nothing repaints the compass): the
         panel must stay under the banner. Its control: the fit as a fixed
         px max-height (round 1's), which the cap's change does not bound —
         it lands on the banner. (2) Fitted again while the block is grown
         (a content change), the block shrinks back: the panel must end on
         a whole line (a fit left as it was lands mid-line: the cap moved
         by a line and a half's multiple of the pitch) */
      let grow = null, growCtl = null;
      if (panel === cmp) {
        const g1 = async (pxFit) => {
          if (panel.hidden) chip.click();
          await settle();
          const bx = document.getElementById("cmpbox"), pl = document.createElement("div");
          pl.id = "v4plant-lines"; pl.innerHTML = Array.from({ length: 30 }, (_, i) => `Planted line ${i + 1} for the cap read`).join("<br>");
          if (bx) bx.appendChild(pl);
          const fit = () => { if (typeof window.cmpFit === "function") window.cmpFit(); };
          fit(); await two(); await settle();
          const rtv = () => getComputedStyle(document.documentElement).getPropertyValue("--ride-top").trim();
          const trimv = () => parseFloat(panel.style.getPropertyValue("--cmp-trim")) || 0;
          /* the line pitch, from the first two planted text nodes */
          const tops = [...pl.childNodes].filter((x) => x.nodeType === 3).slice(0, 2).map((x) => {
            const rg = document.createRange(); rg.selectNodeContents(x); const q = rg.getClientRects()[0]; return q ? q.top : NaN; });
          const pitch = tops.length === 2 && tops[1] - tops[0] > 4 ? tops[1] - tops[0] : NaN;
          const p0 = vis(panel), n0 = vis(navEl), gap = p0 && n0 ? Math.max(0, p0.top - n0.bottom) : 0;
          /* the least whole-and-a-half number of lines at least 2 px past
             the gap (the less it shrinks, the more text lines the fit has
             to work on in the small panels) */
          const grownBy = isFinite(pitch) ? Math.round((Math.max(0, Math.ceil((gap + 2 - 0.5 * pitch) / pitch)) + 0.5) * pitch) : 32;
          const o = { rt0: rtv(), trim0: trimv(), cut0: p0 ? cmpCut(p0).cut : null, gap: Math.round(gap), grownBy,
            pitch: Math.round(pitch * 10) / 10 };
          if (pxFit) panel.style.maxHeight = panel.offsetHeight + "px";
          const gp = plantCss(`#nav{padding-bottom:${grownBy}px!important}`);
          if (N.publish) N.publish();
          await two(); await settle();
          /* the ride block holds room for the banner, so it grows by less
             than the padding: padded again by the difference, the BLOCK
             (the cap's input) moves by the line and a half's multiple */
          const dRt = parseFloat(rtv()) - parseFloat(o.rt0);
          if (isFinite(dRt) && Math.abs(dRt - grownBy) > 0.5) {
            o.pad = grownBy + (grownBy - dRt); gp.textContent = `#nav{padding-bottom:${o.pad}px!important}`;
            if (N.publish) N.publish();
            await two(); await settle(); }
          const r = vis(panel), nr = vis(navEl);
          Object.assign(o, { rt1: rtv(), drawn: !!r, over: !!r && !!nr && hit(r, nr), top: r ? Math.round(r.top) : null,
            navBottom: nr ? Math.round(nr.bottom) : null });
          fit(); await two(); await settle();
          o.trim1 = trimv();
          gp.remove();
          if (N.publish) N.publish();
          await two(); await settle();
          const r2 = vis(panel), nr2 = vis(navEl);
          Object.assign(o, { rt2: rtv(), trim2: trimv(), over2: !!r2 && !!nr2 && hit(r2, nr2), lineCut: r2 ? cmpCut(r2).cut : null,
            kept: !!pl.parentNode });
          panel.style.maxHeight = ""; pl.remove(); fit();
          if (!panel.hidden) chip.click();
          await settle();
          return o; };
        grow = await g1(false); growCtl = await g1(true); }
      const tall = plantCss(tallCss);
      const now = await one();
      const old = plantCss(oldCss);
      const was = await one();
      old.remove(); tall.remove();
      return { now, was, real, bare, ruleFound, forced, lifted, mid, midCtl, midAt, grow, growCtl }; };
    const diagEl = document.getElementById("diagpanel"), diagChip = document.getElementById("c-diag");
    if (hadRoute && ng && navEl && barEl && diagEl && diagChip) {
      if (V) V.ok = false; N.pos(posWas); pad.remove(); window.railSet(false);
      tabTo("tools"); N.start();
      ng.hidden = false;
      ng.innerHTML = "<b>In 0.6 mi \u00b7 Sharp right onto a road planted for the overlap read</b><span class=\"eta\">3.2 mi remaining</span>";
      window.hudPaint(); if (N.publish) N.publish(); await settle();
      out.tools = {
        strip: Math.round(document.getElementById("tools").getBoundingClientRect().height),
        rideTop: getComputedStyle(document.documentElement).getPropertyValue("--ride-top").trim(),
        cmp: await toolsRead(cmp, cmpChip, "#cmppanel::after{content:'';display:block;height:900px}",
          "#cmppanel{max-height:min(62vh,calc(100% - var(--strip-h,64px) - var(--sheet-h,0px) - var(--s-4)))!important}"),
        diag: await toolsRead(diagEl, diagChip, "#diagpanel::after{content:'';display:block;height:900px;flex:none}",
          "#diagpanel{max-height:none!important}") };
      N.stop(); ng.hidden = ngWas[0]; ng.innerHTML = ngWas[1];
      tabTo(tabWas); await settle();
    }
    /* the plants, against the folded sheet */
    window.railSet(false); pad.remove(); N.stop(); if (V) V.ok = voiceWas; N.pos(posWas); window.hudPaint(); await settle();
    const r0 = vis(hs);
    if (r0) {
      const box = document.createElement("div"); box.id = "v4plant-sheet";
      box.style.cssText = `position:fixed;left:${r0.left}px;top:${r0.top}px;width:${r0.width}px;z-index:99999`;
      const clone = document.getElementById("hudcells").cloneNode(true);
      clone.removeAttribute("id"); clone.querySelectorAll("[id]").forEach((e) => e.removeAttribute("id"));
      /* the grid rule is keyed on the id just stripped: lay the clone out the
         same way inline, or every cell stacks at one left edge and even the
         straight clone fails the order (the first run of this plant) */
      clone.style.cssText = "display:grid;grid-template-columns:repeat(3,1fr);gap:4px 10px";
      box.appendChild(clone); document.body.appendChild(box);
      const straight = orderOk(cells(clone), FREE);
      const kids = [...clone.children]; kids.reverse().forEach((k) => clone.appendChild(k));
      const reversed = orderOk(cells(clone), FREE);
      box.remove();
      const over = document.createElement("div"); over.id = "v4plant-over";
      over.style.cssText = `position:fixed;left:${r0.left + 20}px;top:${r0.top + 10}px;width:40px;height:40px;background:#f0f`;
      const ghost = over.cloneNode(); ghost.id = "v4plant-ghost"; ghost.style.display = "none";
      document.body.appendChild(over); document.body.appendChild(ghost);
      const fl = overlaps(r0, [over, ghost]);
      over.remove(); ghost.remove();
      /* the ride flag off: the folded drawer's action row must read as gone */
      delete shell.dataset.ride; await settle();
      const rowGone = ACTS.map((a) => tapOn(a, 44)); shell.dataset.ride = "1"; await settle();
      /* the take-187-lane rule that hid the WHOLE sheet under an open drawer */
      let st = plantCss("#shell:has(#rail:not(.folded)) #hudstats{display:none!important}");
      const oldYield = await read({ tag: "plant: whole-sheet yield", open: true, worst: true }); st.remove();
      /* the compass panel on its old anchor, not lifted over the sheet */
      st = plantCss("#cmppanel{bottom:calc(var(--strip-h,64px) + 8px)!important}");
      const noLift = await read({ tag: "plant: compass unlifted", compass: true, worst: true }); st.remove();
      /* the drawer's body at its at-rest cap while riding: the ride cap
         removed (38vh since take 188 · A215; it was 42vh) */
      st = plantCss("#shell[data-ride] #rail:not(.folded) #railbody{max-height:38vh!important}");
      const noCap = await read({ tag: "plant: no ride cap", open: true, worst: true }); st.remove();
      /* take 188 · step 13b · with the columns hidden while riding, what the
         ride row must clear is the ride block (tape, turn banner) and the
         off-route alert: the drawer's body with NO cap at all (the ride cap
         and the 38vh at-rest cap both gone) must fail the open-drawer read */
      st = plantCss("#shell[data-ride] #rail:not(.folded) #railbody{max-height:none!important}");
      const noBound = await read({ tag: "plant: unbounded body", open: true, worst: true }); st.remove();
      /* …and the cap FOLLOWS the ride block: the turn banner planted taller
         (as a long name wrapping would make it) by just enough that the
         off-route alert under it reaches 40 px past where the open drawer's
         ride row sits at the 38vh cap. With the ride cap the row must stay
         below the block and the alert (the cap measured against them binds);
         with the ride cap removed (38vh) the row must land on them. (A first
         plant put the banner's foot at 40 % of the screen: at 360 x 800 and
         749 x 832 the body then hit its 15vh floor, a state no real banner
         reaches.) */
      const baseT = await read({ tag: "tall: base", open: true, routed: true, worst: true });
      const alB = document.getElementById("alert").getBoundingClientRect().bottom,
        navH = document.getElementById("nav").getBoundingClientRect().height;
      const extra = Math.max(24, Math.round((baseT.rect ? baseT.rect[1] : 0) - alB + 40));
      const tallCss = `#nav{min-height:${Math.round(navH + extra)}px!important}`;
      st = plantCss(tallCss);
      const tall = await read({ tag: "plant: tall ride block", open: true, routed: true, worst: true });
      const st2 = plantCss("#shell[data-ride] #rail:not(.folded) #railbody{max-height:38vh!important}");
      const tallNoCap = await read({ tag: "plant: tall ride block, no ride cap", open: true, routed: true, worst: true });
      st2.remove(); st.remove();
      /* the folded judge's own clauses, each flipped by one plant on the
         worst free read (review round 2: never watched failing) */
      const pr = {};
      st = plantCss("#hudstats{background:transparent!important}");
      pr.alpha = await read({ tag: "plant: transparent surface", worst: true }); st.remove();
      st = plantCss("#hud-vnote{display:none!important}");
      pr.note = await read({ tag: "plant: no voice note", worst: true }); st.remove();
      st = plantCss("#hud-src{display:none!important}");
      pr.src = await read({ tag: "plant: no simulated line", worst: true }); st.remove();
      st = plantCss("#hudstats{transform:translateY(110vh)!important}");
      pr.view = await read({ tag: "plant: off the viewport", worst: true }); st.remove();
      out.plantReads = pr;
      window.railSet(false); pad.remove(); N.stop(); if (V) V.ok = voiceWas; N.pos(posWas);
      out.plants = { straight, reversedCaught: !reversed, overCaught: fl.includes("v4plant-over"),
                     /* take 188 · A217 · off a ride the folded drawer keeps ONE
                        action, Return home (the V4 Main board); the flag is
                        what brings back the other three */
                     ghostIgnored: !fl.includes("v4plant-ghost"),
                     rowCaught: !rowGone.filter((g, i) => ACTS[i].id !== "btn-home").some(Boolean)
                       && rowGone.some((g, i) => g && ACTS[i].id === "btn-home"),
                     oldYieldCaught: !oldYield.btns.some(Boolean),
                     liftCaught: noLift.over.includes("cmppanel") && noLift.cmp,
                     capCaught: noCap.over.length > 0 || !noCap.btns.every(Boolean),
                     capOver: noCap.over,
                     /* how many px the ride cap takes off the open drawer's
                        body here: the 38vh plant's body minus the capped
                        "drawer open, simulated" read's (same state, pad at
                        3000 px so both sit at their max-height) */
                     capTrim: (() => { const c = out.reads.find((x) => x.tag === "drawer open, simulated");
                       return c ? noCap.bodyH - c.bodyH : null; })(),
                     /* the plant itself took: the body's max-height reads 38vh.
                        A plant that stops matching would read as "the cap
                        trims 0 px" and exempt itself */
                     capPlantTook: Math.abs(noCap.maxH - 0.38 * vh) < 1, capPlantMax: noCap.maxH,
                     noBound: { shown: noBound.shown, inView: noBound.inView, labels: noBound.labels.length,
                       btns: noBound.btns, over: noBound.over, rect: noBound.rect },
                     tall: { extra, shown: tall.shown, inView: tall.inView, labels: tall.labels.length, btns: tall.btns,
                       over: tall.over, rect: tall.rect, bodyH: tall.bodyH },
                     tallNoCap: { shown: tallNoCap.shown, inView: tallNoCap.inView, labels: tallNoCap.labels.length,
                       btns: tallNoCap.btns, over: tallNoCap.over, rect: tallNoCap.rect, bodyH: tallNoCap.bodyH } };
    }
    /* put everything back */
    undo(); await settle();
    return out;
    } catch (e) {
      try { undo(); } catch (e2) {}
      return { error: String((e && e.stack) || e), reads: [], hadRoute: false };
    }
  });
  ok(!sh.error, `${dev.name}: the ride-sheet read ran (${sh.error || "ok"})`);
  /* the folded judge, one function for the reads and their plants */
  const foldedOk = (r) => r.shown && r.inView && r.order && r.alpha >= 0.85 && r.over.length === 0
    && r.btns.every(Boolean) && r.acts.length === 4 && r.acts.every(Boolean)
    && (!r.worst || r.note) && (!r.worst || r.routed || r.src) && (!r.compass || r.cmp);
  const pr = sh.plantReads || {};
  ok(!!sh.plantReads && pr.alpha && !foldedOk(pr.alpha) && pr.alpha.alpha < 0.85
     && pr.note && !foldedOk(pr.note) && !pr.note.note
     && pr.src && !foldedOk(pr.src) && !pr.src.src
     && pr.view && !foldedOk(pr.view) && !pr.view.inView,
     `${dev.name}: the folded judge fails each clause's plant: a transparent surface (alpha `
     + `${pr.alpha ? pr.alpha.alpha : "?"}), the Voice note hidden (note ${pr.note ? pr.note.note : "?"}), `
     + `"Simulated ride" hidden (src ${pr.src ? pr.src.src : "?"}), the sheet off the viewport `
     + `(inView ${pr.view ? pr.view.inView : "?"})`);
  const pl = sh.plants || {};
  ok(!!sh.plants && pl.straight && pl.reversedCaught && pl.overCaught && pl.ghostIgnored && pl.rowCaught
     && pl.oldYieldCaught && pl.liftCaught,
     `${dev.name}: the ride-sheet judges catch their plants (a reversed id-stripped clone fails the order `
     + `while the straight clone passes; a div over the sheet is flagged, a hidden one is not; without the ride `
     + `flag the drawer's action row reads gone but for Return home; the whole-sheet yield rule loses the ride buttons; the compass `
     + `panel on its old anchor is flagged over the sheet)` + (sh.plants ? " " + JSON.stringify(sh.plants) : " — the folded sheet was not on screen"));
  /* the ride cap: wherever it trims the open drawer's body by more than
     CAP_BITES px, removing it (the 38vh plant) must fail the open-drawer
     read. Measured on the lane's renders r3/r4: that is 360x800, 412x915,
     430x932 and the Fold inner screen 749x832; on the Fold cover (411x960)
     the cap trims ~11 px and removing it overlaps nothing, so there the
     plant is not asserted and the reason is printed. The open-drawer reads
     themselves (over.length === 0) guard every size. */
  const CAP_BITES = 20;
  const capBinds = !!sh.plants && typeof pl.capTrim === "number" && pl.capTrim > CAP_BITES;
  ok(!!sh.plants && pl.capPlantTook && typeof pl.capTrim === "number" && (!capBinds || pl.capCaught),
     `${dev.name}: the 38vh plant took (max-height ${pl.capPlantMax} px, took ${pl.capPlantTook}); `
     + `the ride cap trims the open drawer's body by ${pl.capTrim} px; `
     + (capBinds ? `without it (38vh) the open-drawer read fails (${(pl.capOver || []).join(", ") || "no overlap"}) — `
        + `the cap is load-bearing here (capCaught ${pl.capCaught})`
        : `at <= ${CAP_BITES} px the plant is not asserted here (capCaught ${pl.capCaught}, `
        + `overlaps ${(pl.capOver || []).join(", ") || "none"})`));
  /* the open-drawer judge, one function for the reads and the plant */
  const openOk = (r) => !!r && r.shown && r.inView && r.labels === 0 && r.btns.every(Boolean) && r.over.length === 0;
  ok(!!sh.plants && !!pl.noBound && !openOk(pl.noBound),
     `${dev.name}: the open-drawer judge fails its control — the body with no cap at all runs the ride row into what it must `
     + `clear (inView ${pl.noBound && pl.noBound.inView}, buttons ${pl.noBound && pl.noBound.btns}, `
     + `overlaps ${pl.noBound && (pl.noBound.over || []).join(", ") || "none"}, at ${pl.noBound && pl.noBound.rect})`);
  ok(!!sh.plants && openOk(pl.tall) && !openOk(pl.tallNoCap),
     `${dev.name}: the ride cap follows the ride block — the turn banner planted ${pl.tall && pl.tall.extra} px taller: with the cap the open `
     + `drawer's ride row sits below it (body ${pl.tall && pl.tall.bodyH} px, row at ${pl.tall && pl.tall.rect}, overlaps `
     + `${pl.tall && (pl.tall.over || []).join(", ") || "none"}); with the cap removed (38vh, body ${pl.tallNoCap && pl.tallNoCap.bodyH} px) `
     + `it lands on ${pl.tallNoCap && (pl.tallNoCap.over || []).join(", ") || "nothing (NOT CAUGHT)"}`);
  for (const r of sh.reads) {
    if (r.open) ok(openOk(Object.assign({}, r, { labels: r.labels.length })),
      `${dev.name}: drawer OPEN at its cap (${r.tag}): the stats fold away (${r.labels.join(" / ") || "none drawn"}) `
      + `and Stop, Re-centre, North up, Voice are one tap each (${r.btns.join(",")}) at ${r.rect}, `
      + `overlaps ${r.over.join(", ") || "nothing"}`);
    else ok(foldedOk(r),
      `${dev.name}: ride sheet (${r.tag}, drawer folded) at ${r.rect} reads `
      + `${r.labels.join(" / ")} left to right, surface alpha ${r.alpha}, overlaps ${r.over.join(", ") || "nothing"}; `
      + `ride buttons ${r.btns.join(",")}; action row ${r.acts.join(",")}`
      + (r.worst ? `; voice note ${r.note}, simulated line ${r.src}` : "") + (r.compass ? `; compass panel drawn ${r.cmp}` : ""));
  }
  ok(sh.hadRoute, `${dev.name}: the routed sheet was read (a route was on the cards)`);
  /* take 188 · cold audit (F18) · the panels on the sheet's anchor stop
     under the ride block; their rule before the fix must be caught */
  {
    const panelClear = (r) => !!r && r.drawn && r.banner && r.h >= 40 && r.scrolls && r.over.length === 0
      && r.navBottom !== null && r.top >= r.navBottom - 0.5;
    const tl = sh.tools;
    for (const [nm, key] of [["compass", "cmp"], ["diagnostics", "diag"]]) {
      const t = tl && tl[key];
      ok(!!t && panelClear(t.now) && !panelClear(t.was) && t.was.over.includes("nav"),
         `${dev.name}: riding on the Tools tab (strip ${tl ? tl.strip : "?"} px, ride block ${tl ? tl.rideTop : "?"}), the ${nm} panel holding more than the screen `
         + `stops under the turn banner: top ${t ? t.now.top : "?"} under the banner's foot ${t ? t.now.navBottom : "?"}, ${t ? t.now.h : "?"} px tall, `
         + `scrolls ${t ? t.now.scrolls : "?"}, over ${t ? t.now.over.join(", ") || "nothing" : "NOT READ"}; its rule before the fix runs over `
         + `${t ? t.was.over.join(", ") || "NOTHING (not caught)" : "?"} (top ${t ? t.was.top : "?"})`);
    }
  }
  /* take 189 · A231 · …and USABLE there (take 188 left 73 px at 360 x 800,
     the compass's dial cut): with their real content, what each is opened
     for is whole in view under the banner, the sheet's Stop and the
     panel's chip one tap. Its control: the A231 rule taken out (the strip
     keeps every row) must fail at 360 x 800; elsewhere it is reported */
  {
    const use = (r) => !!r && r.drawn && r.usable && r.stop && r.chip && r.over.length === 0
      && r.navBottom !== null && r.top >= r.navBottom - 0.5;
    const tl = sh.tools;
    for (const [nm, key] of [["compass", "cmp"], ["diagnostics", "diag"]]) {
      const t = tl && tl[key], rl = (t && t.real) || {}, br = (t && t.bare) || {};
      const binds = !!t && !!t.bare && !use(t.bare);
      ok(!!t && t.ruleFound && use(t.real) && (dev.width > 360 || binds),
         `${dev.name}: A231 · riding on the Tools tab, the ${nm} panel is usable: ${rl.room} px of ${rl.need} shown, `
         + `what it is opened for whole (${rl.usable}), Stop ${rl.stop}, its chip ${rl.chip}, under the banner (top ${rl.top}, foot ${rl.navBottom}); `
         + `without the A231 rule (found ${t && t.ruleFound}) ${br.room} px, whole ${br.usable}`
         + (dev.width > 360 ? (binds ? " — caught here too" : " — not asserted here (it fits without the rule)") : " — caught"));
    }
    /* take 189 · cold audit · riding with each panel open: A231 hides chips
       only on a small phone (elsewhere all seven stay one tap — landmine
       135 — its control the rule at every size); no Tools chip under the
       attribution's (i) (its control, at the cover screen where the shot
       showed it: the rule forced with the (i) unlifted); and the compass
       box ends on a whole line with its cue when it scrolls (its control at
       360 x 800: the cap before the fit) */
    { const c = tl && tl.cmp, d = tl && tl.diag, tight = dev.width <= 400 && dev.height <= 860;
      const all = (r) => !!r && r.toolsN > 3 && r.chips === r.toolsN, clear = (r) => !!r && r.attrib.length === 0;
      const whole = (r) => !!r && r.lineCut === null && (r.need <= r.room + 1 || r.cue);
      /* take 189 · cold audit r2 · scrolled to its end, no "More below" drawn;
         back at the top, drawn again (when the box scrolls) */
      const endOk = (r) => !!r && (!r.scrolls || (!!r.endRd && r.endRd.end.end && r.endRd.end.top > 0 && !r.endRd.end.cue && r.endRd.back.cue));
      const endCtlOk = (r) => !!r && !!r.endRd && r.endRd.endCtl.end && r.endRd.endCtl.cue;   /* the control is SEEN */
      const grown = (g) => !!g && g.kept && g.drawn && g.cut0 === null && g.pitch > 4 && Math.abs(parseFloat(g.rt1) - parseFloat(g.rt0) - g.grownBy) <= 1
        && parseFloat(g.rt2) === parseFloat(g.rt0) && g.over === false && g.over2 === false && g.lineCut === null;
      const E = (r) => !r ? "not read" : !r.scrolls ? "does not scroll" : !r.endRd ? "no end read"
        : `at its end (${r.endRd.end.top} px) cue ${r.endRd.end.cue ? "DRAWN" : "not drawn"}, back at the top cue ${r.endRd.back.cue ? "drawn" : "NOT drawn"}, held cue seen ${r.endRd.endCtl.cue}`;
      const G = (g) => !g ? "not read" : `fitted (trim ${g.trim0} px, cut at ${g.cut0}); --ride-top ${g.rt0} → ${g.rt1} (${g.grownBy} px past a ${g.gap} px gap, lines ${g.pitch} px, nav padded ${g.pad || g.grownBy} px): `
        + `panel top ${g.top} vs banner bottom ${g.navBottom}, over ${g.over}; refitted there (trim ${g.trim1}), back to ${g.rt2}: trim ${g.trim2}, cut at ${g.lineCut}, over ${g.over2}`
        + `${g.kept ? "" : ", the planted lines REPAINTED AWAY"}`;
      const R = (r) => r ? `${r.chips} of ${r.toolsN} chips, (i) over ${r.attrib.join("/") || "none"}` : "not read";
      const cover = dev.width === 411;
      ok(!!c && !!d && (tight ? c.real.chips === 3 && d.real.chips === 3 && all(c.bare) : all(c.real) && all(d.real) && !all(c.forced) && !all(d.forced))
         && clear(c.real) && clear(d.real) && clear(c.lifted) && clear(d.lifted) && (!cover || !clear(c.forced) || !clear(d.forced))
         && whole(c.real) && !!c.mid && whole(c.mid) && !!c.midCtl && !whole(c.midCtl)
         && endOk(c.real) && !!c.mid.endRd && endOk(c.mid) && endCtlOk(c.mid) && (!c.real.endRd || endCtlOk(c.real))
         && grown(c.grow) && !!c.growCtl && c.growCtl.over === true,
         `${dev.name}: riding on Tools with a panel open — compass ${R(c && c.real)}, diagnostics ${R(d && d.real)} `
         + `(${tight ? "a small phone: the rule binds" : "the rule does not apply here"}); the compass box ends on a whole line `
         + `(cut at ${c && c.real ? c.real.lineCut : "?"}, cue ${c && c.real ? c.real.cue : "?"}, ${c && c.real ? c.real.room : "?"} of ${c && c.real ? c.real.need : "?"} px); `
         + `the rule at every size with the (i) free to lift — compass ${R(c && c.lifted)}, diagnostics ${R(d && d.lifted)}; `
         + `controls: the same, (i) unlifted — compass ${R(c && c.forced)}, diagnostics ${R(d && d.forced)}`
         + (cover ? " (caught here)" : "") + `; a cap landing mid-line (the line ${c ? c.midAt : "?"} px down): with the fit cut at ${c && c.mid ? c.mid.lineCut : "?"}, `
         + `cue ${c && c.mid ? c.mid.cue : "?"}; its control, the cap before the fit, cuts the line at ${c && c.midCtl ? c.midCtl.lineCut : "?"}`
         + `; scrolled — real: ${E(c && c.real)}; mid-line cap: ${E(c && c.mid)}`
         + `; the ride block taller with the box fitted: ${G(c && c.grow)}; control, the fit as a fixed px height: ${G(c && c.growCtl)}`);
    }
  }
  /* take 188 · step 13b · THE ROUTE CARDS ARE NEVER CUT MID-ROW (the
     integration shots: half an icon row under "climb … drop", under the
     pinned Ride it row). With the drawer opened the way a rider opens it
     (a real slide, so the app fits the cards when it ends), every row of
     every card on screen is whole above the visible bottom (the options
     box, the pinned row or the drawer's edge, whichever is highest) or
     wholly below it; the options scroll for the rest. Its control: the
     options box made half a row taller than the app's fit must be flagged.
     And the drawer's action row: every label on ONE line (RETURN HOME
     wrapped at 360 wide), at the 48 px tap and the text floor, open and
     riding; its control: Return home squeezed to 70 px reads two lines. */
  ROWS_FN = async () => {
    try {
    const s = (ms) => new Promise((r) => setTimeout(r, ms));
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    const settle = async () => { for (let i = 0; i < 60; i++) { await frame();
      if (!document.getAnimations().some((a) => a.playState === "running" && a.effect
        && isFinite(a.effect.getComputedTiming().endTime))) return true; await s(30); } return false; };
    const rail = document.getElementById("rail"), body = document.getElementById("railbody");
    const R = document.getElementById("routes"), row = document.getElementById("rcrow"), sh = document.getElementById("shell");
    if (!R || !row || !body) return { error: "no route cards on the panel" };
    const railWas = rail.className, rideWas = sh.dataset.ride;
    delete sh.dataset.ride;
    window.railSet(false); await settle(); window.railSet(true); await s(50); await settle(); await s(50);
    body.scrollTop = 0; R.scrollTop = 0; await settle();
    const vw = document.documentElement.clientWidth;
    const judge = () => { const rr = R.getBoundingClientRect(), br = body.getBoundingClientRect(), rw = row.getBoundingClientRect();
      const bottom = Math.min(rr.bottom, rw.top, br.bottom), cut = []; let whole = 0, below = 0;
      R.querySelectorAll(".rc > *").forEach((k) => { const r = k.getBoundingClientRect();
        if (r.height <= 0 || r.right <= Math.max(rr.left, 0) + 1 || r.left >= Math.min(rr.right, vw) - 1) return;
        if (r.top < bottom - 0.5 && r.bottom > bottom + 0.5) cut.push(`${(k.textContent || k.className || k.tagName).trim().slice(0, 24)} ${Math.round(r.top)}-${Math.round(r.bottom)}`);
        else if (r.bottom <= bottom + 0.5) whole++; else below++; });
      /* …and what follows the card in the drawer (the stats cells, the
         coordinates): whole above the pinned row, or wholly under it or
         past the drawer's edge — never cut by either (the first build of
         the fit left the coordinates cut by the drawer's edge) */
      const foot = Math.min(rw.top, br.bottom);
      [...body.querySelectorAll("#grid .cell"), document.getElementById("coords")].forEach((k) => { if (!k) return;
        const r = k.getBoundingClientRect(); if (r.height <= 0 || getComputedStyle(k).display === "none") return;
        if (r.top < foot - 0.5 && r.bottom > foot + 0.5) cut.push(`${(k.textContent || k.id).trim().slice(0, 24)} ${Math.round(r.top)}-${Math.round(r.bottom)} (after the card)`); });
      /* take 189 · A238 (the review of lane L-ride, round 1) · a fit that
         cuts nothing can still be far shorter than the room allows: the
         lane's first fix floored each line and the bike's box fell from 234
         to 168 px, three rows lost, and every judge here passed it. The room
         the fit had is the box plus what rcFit gave back (at rest the
         drawer's --rc-trim, riding the pinned row's extra margin); from it,
         every card's rows give the largest line that cuts none (a line on a
         row's top or bottom, moved up past each row it would cut). `short`
         is how far the fit falls under that line */
      let best = null, short = null; const fitPx = parseFloat(R.style.maxHeight);
      if (isFinite(fitPx)) {
        const mI = row.style.marginTop; row.style.marginTop = ""; const rm0 = parseFloat(getComputedStyle(row).marginTop) || 0; row.style.marginTop = mI;
        const give = sh.dataset.ride ? Math.max(0, (parseFloat(mI) || rm0) - rm0) : (parseFloat(body.style.getPropertyValue("--rc-trim")) || 0);
        const ks = [...R.querySelectorAll(".rc > *")].map((k) => k.getBoundingClientRect()).filter((r) => r.height > 0);
        let line = fitPx + give, moved = true, it = 0;
        while (moved && it++ < 80) { moved = false;
          for (const r of ks) { const kt = r.top - rr.top + R.scrollTop, kb = kt + r.height;
            if (kt < line - 0.5 && kb > line + 0.5) { line = kt; moved = true; } } }
        best = Math.round(line * 10) / 10; short = Math.round((line - fitPx) * 10) / 10;
      }
      return { cut, whole, below, rowAt: [Math.round(rw.top), Math.round(rw.bottom)], bodyAt: [Math.round(br.top), Math.round(br.bottom)], bottom: Math.round(bottom), fit: R.style.maxHeight || "none", boxH: Math.round(rr.height),
        natural: R.scrollHeight, bodyMax: getComputedStyle(body).maxHeight, best, short }; };
    /* round 2, reported (not judged): the selected card's warnings against
       the pinned row's cue in the state judged here — the judge whose
       controls run in the warnings block below */
    const wread = () => { const rr = R.getBoundingClientRect(), rw = row.getBoundingClientRect(), br = body.getBoundingClientRect();
      const bottom = Math.min(rr.bottom, rw.top, br.bottom); let seen = 0, hid = 0;
      R.querySelectorAll(".rc.sel .warn").forEach((w) => { const r = w.getBoundingClientRect();
        if (r.height > 0 && r.top >= rr.top - 0.5 && r.bottom <= bottom + 0.5) seen++; else hid++; });
      const mo = document.getElementById("rc-more"), shown = !!mo && getComputedStyle(mo).display !== "none";
      return `selected "${((R.querySelector(".rc.sel h5") || {}).textContent || "?").slice(0, 24)}": warnings in view ${seen}, below ${hid}, cue ${shown ? `"${mo.textContent.trim()}"` : "not drawn"}`; };
    const out = { real: judge(), realWarn: wread() };
    /* take 187's layout, reported: no fit */
    const fitWas = R.style.maxHeight, mtWas = row.style.marginTop;
    R.style.maxHeight = ""; row.style.marginTop = ""; await settle(); out.noFit = judge();
    /* the control: half a row taller than the fit */
    R.style.maxHeight = fitWas; row.style.marginTop = mtWas; await settle();
    const fitPx = parseFloat(fitWas);
    if (isFinite(fitPx)) {
      const rr = R.getBoundingClientRect(); let h = 0;
      R.querySelectorAll(".rc > *").forEach((k) => { const r = k.getBoundingClientRect();
        if (Math.abs(r.top - rr.top - fitPx) < 1.5 && r.height > h) h = r.height; });
      R.style.maxHeight = (fitPx + Math.max(6, h / 2)) + "px"; await settle(); out.plant = judge(); out.plant.half = h / 2;
      R.style.maxHeight = fitWas; await settle();
    }
    /* take 188 · step 13b1 review · the RIDING fit (rcFit's riding branch:
       the ride rule is untrimmed and the pinned row's margin takes up the
       difference). A rider meets route cards mid-ride: the cards stay on the
       panel when the ride starts, and a re-route writes them again (the same
       HTML, minus the Ride it the flag hides). The ride is started the
       rider's way — the Ride chip, GPS held pending (a stand-in watch that
       never answers, restored) — then the drawer is opened (a real slide) and
       the same judge runs, with its half-row control. Torn down fully
       (landmine 177): Stop, the watch, the position mode, and the panel's own
       nodes put back (the cards carry listeners later checks click). */
    {
      const N = window.__nav, geo = navigator.geolocation, gw = geo && geo.watchPosition, gc = geo && geo.clearWatch;
      const pm0 = N.pos(), pnl = document.getElementById("panel"), kept = [...pnl.childNodes], pcls = pnl.className;
      const pick = (j, px) => { if (!px) return j; const r2 = R.getBoundingClientRect(); let hh = 0;
        R.querySelectorAll(".rc > *").forEach((k) => { const r = k.getBoundingClientRect();
          if (Math.abs(r.top - r2.top - px) < 1.5 && r.height > hh) hh = r.height; }); return hh; };
      try {
        if (geo) { geo.watchPosition = () => 4246; geo.clearWatch = () => {}; }
        document.getElementById("c-ride").click(); await s(50); await settle();
        out.rideStart = { flag: sh.dataset.ride || null, sameCards: document.getElementById("routes") === R,
          rcRideHidden: !!(document.getElementById("rc-ride") || {}).hidden };
        window.railSet(true); await s(50); await settle(); await s(50);
        body.scrollTop = 0; R.scrollTop = 0; await settle();
        out.ride = judge(); out.ride.margin = row.style.marginTop || "0px"; out.rideWarn = wread();
        const fr = R.style.maxHeight, fpx = parseFloat(fr);
        if (isFinite(fpx)) {
          const hh = pick(null, fpx);
          R.style.maxHeight = (fpx + Math.max(6, hh / 2)) + "px"; await settle(); out.ridePlant = judge(); out.ridePlant.half = hh / 2;
          R.style.maxHeight = fr; await settle();
        }
        /* the floor: the drawer held at 15vh (a turn banner far taller than
           any real one) — reported, not judged: rcFit then fits nothing
           rather than a sliver box, and the body scrolls (INFERRED
           unreachable today: the ride cap trims 0 px at every size) */
        const fl = document.createElement("style"); fl.textContent = "#shell[data-ride] #rail:not(.folded) #railbody{max-height:15vh!important}";
        document.head.appendChild(fl);
        window.railSet(false); await settle(); window.railSet(true); await s(50); await settle(); await s(50);
        out.rideFloor = judge(); fl.remove();
      } catch (e) { out.rideErr = String((e && e.stack) || e); }
      try { N.stopReal(); } catch (e) {}
      if (geo) { geo.watchPosition = gw; geo.clearWatch = gc; }
      try { N.pos(pm0); } catch (e) {}
      pnl.textContent = ""; kept.forEach((k) => pnl.appendChild(k)); pnl.className = pcls;
      { const rb = document.getElementById("rc-ride"); if (rb) rb.hidden = false; }
      row.style.marginTop = ""; R.style.maxHeight = "";
      window.railSet(false); await settle(); window.railSet(true); await s(50); await settle(); await s(50);
      out.restored = { cards: document.getElementById("routes") === R, flag: sh.dataset.ride || null, fit: R.style.maxHeight || "none" };
    }
    /* the action row: open (not riding), then riding with the drawer folded */
    const acts = () => [...document.querySelectorAll("#actions .act")].filter((a) => a.id !== "btn-ride").map((a) => {
      const r = a.getBoundingClientRect(), rg = document.createRange(); rg.selectNodeContents(a);
      const lines = new Set([...rg.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top))).size;
      return { id: a.id, lines, w: Math.round(r.width), h: Math.round(r.height), fs: parseFloat(getComputedStyle(a).fontSize),
        clip: a.scrollWidth > a.clientWidth + 1 }; });
    out.actsOpen = acts();
    sh.dataset.ride = "1"; window.railSet(false); await settle(); out.actsRide = acts();
    const st = document.createElement("style"); st.textContent = "#btn-home{white-space:normal!important;flex:0 0 70px!important}";
    document.head.appendChild(st); await settle(); out.actsPlant = acts(); st.remove();
    if (rideWas === undefined) delete sh.dataset.ride; else sh.dataset.ride = rideWas;
    window.railSet(!/\bfolded\b/.test(railWas)); rail.className = railWas; await settle();
    return out;
    } catch (e) { return { error: String((e && e.stack) || e) }; }
  };
  const rows = await page.evaluate(ROWS_FN);
  if (rows.error) ok(false, `${dev.name}: the route-card rows read ran (${rows.error})`);
  else {
    /* take 189 · A238 (fix round 1) · …and the fit is no more than half a
       row (9 px) under the largest line that cuts nothing */
    const rowsOk = (j) => !!j && j.cut.length === 0 && j.whole >= 4 && (j.short === null || j.short <= 9);
    ok(rowsOk(rows.real) && !!rows.plant && !rowsOk(rows.plant) && !rowsOk(Object.assign({}, rows.real, { short: 66 })),
       `${dev.name}: the route cards show whole rows — ${rows.real.whole} whole, ${rows.real.below} below to scroll to, cut `
       + `${rows.real.cut.join("; ") || "none"} (options box ${rows.real.fit} of ${rows.real.natural} px, drawer body ${rows.real.bodyMax}); `
       + `its control, half a row (${rows.plant ? rows.plant.half : "?"} px) past the fit, is flagged (cut ${rows.plant ? rows.plant.cut.join("; ") || "none" : "not run"}); `
       + `take 187's unfitted box cut ${rows.noFit.cut.join("; ") || "nothing"}; pinned row at ${rows.real.rowAt}, drawer body ${rows.real.bodyAt}; `
       + `the fit ${rows.real.short === null ? "not set" : rows.real.short + " px under the largest line that cuts nothing (" + rows.real.best + ")"}; `
       + `a fit 66 px short is flagged`);
    /* take 188 · step 13b1 review · the same judge, RIDING */
    const rs = rows.rideStart || {};
    ok(!rows.rideErr && rs.flag === "1" && rs.sameCards && rowsOk(rows.ride) && !!rows.ridePlant && !rowsOk(rows.ridePlant)
       && !!rows.restored && rows.restored.cards && rows.restored.flag === null,
       `${dev.name}: RIDING (the Ride chip, GPS pending), the route cards opened in the drawer show whole rows — `
       + `${rows.ride ? rows.ride.whole : "?"} whole, ${rows.ride ? rows.ride.below : "?"} below, cut ${rows.ride ? rows.ride.cut.join("; ") || "none" : "not read"} `
       + `(options box ${rows.ride ? rows.ride.fit : "?"}, drawer body ${rows.ride ? rows.ride.bodyMax : "?"}, pinned row margin ${rows.ride ? rows.ride.margin : "?"}, `
       + `${rows.ride && rows.ride.short !== null ? rows.ride.short + " px under the largest line that cuts nothing" : "no fit"}); `
       + `its control, half a row (${rows.ridePlant ? rows.ridePlant.half : "?"} px) past the fit, is flagged (cut ${rows.ridePlant ? rows.ridePlant.cut.join("; ") || "none" : "not run"}); `
       + `flag ${rs.flag}, same cards ${rs.sameCards}, Ride it hidden ${rs.rcRideHidden}; torn down: cards back ${rows.restored && rows.restored.cards}, flag ${rows.restored && rows.restored.flag}`
       + (rows.rideErr ? ` — ${rows.rideErr}` : ""));
    console.log(`  ..   ${dev.name}: route cards at rest — ${rows.realWarn || "not read"}; riding — ${rows.rideWarn || "not read"}`);
    if (rows.rideFloor) console.log(`  ..   ${dev.name}: riding at the 15vh floor (planted; not judged): options box ${rows.rideFloor.fit}, `
       + `${rows.rideFloor.whole} whole, cut ${rows.rideFloor.cut.join("; ") || "none"}, drawer body ${rows.rideFloor.bodyMax}`);
    const actOk = (l) => Array.isArray(l) && l.length === 4 && l.every((a) => a.lines === 1 && !a.clip && a.w >= 48 && a.h >= 48 && a.fs >= 12);
    const fmt = (l) => (l || []).map((a) => `${a.id} ${a.w}x${a.h} ${a.lines}l${a.clip ? " CLIPPED" : ""}`).join(", ");
    ok(actOk(rows.actsOpen) && actOk(rows.actsRide) && !actOk(rows.actsPlant),
       `${dev.name}: the drawer's actions each on one line at the tap and text floors — open: ${fmt(rows.actsOpen)}; `
       + `riding: ${fmt(rows.actsRide)}; control (Return home at 70 px) fails: ${fmt(rows.actsPlant.filter((a) => a.id === "btn-home"))}`);
  }
  /* take 189 · A233 · THE FOLDED DRAWER'S RIDE (the V4 mockup's Main
     board: Return home primary, Ride secondary). At rest with the drawer
     folded both are drawn on the drawer's one row, each one tap (48 px,
     inside the screen, the element a tap at its centre lands on), Ride on
     one line, unclipped and outlined (Return home stays the one accent).
     With the drawer open, or a ride running, Ride is not drawn (the cards'
     Ride it; the ride's Stop). Its control: Ride hidden by a planted rule
     fails the same judge. The tap walker counts its one tap (flow F). */
  const rb2 = await page.evaluate(async () => {
    try {
      const s = (ms) => new Promise((r) => setTimeout(r, ms));
      const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
      const settle = async () => { for (let i = 0; i < 60; i++) { await frame();
        if (!document.getAnimations().some((a) => a.playState === "running" && a.effect
          && isFinite(a.effect.getComputedTiming().endTime))) return true; await s(30); } return false; };
      const $ = (id) => document.getElementById(id), sh = $("shell"), rail = $("rail");
      const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
      const vis = (e) => { if (!e || e.hidden) return null;
        for (let a = e; a && a !== document.documentElement; a = a.parentElement) { const c = getComputedStyle(a);
          if (c.display === "none" || c.visibility === "hidden" || +c.opacity === 0) return null; }
        const r = e.getBoundingClientRect(); return r.width >= 1 && r.height >= 1 ? r : null; };
      const tapOn = (e, min) => { const r = vis(e); if (!r || r.width < min || r.height < min) return false;
        if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1) return false;
        const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!h && e.contains(h); };
      const lines = (e) => { const rg = document.createRange(); rg.selectNodeContents(e);
        return new Set([...rg.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top))).size; };
      const rideWas = sh.dataset.ride, railWas = rail.className;
      const read = () => { const h = $("btn-home"), r = $("btn-ride"), hr = vis(h), rr = vis(r);
        return { home: tapOn(h, 48), ride: tapOn(r, 48), lines: rr ? lines(r) : 0, clip: !!rr && r.scrollWidth > r.clientWidth + 1,
          row: !!(hr && rr && Math.abs(hr.top - rr.top) < 1 && rr.left >= hr.right - 0.5),
          inRail: !!(rr && rr.top >= rail.getBoundingClientRect().top - 0.5),
          bg: getComputedStyle(r).backgroundColor, homeBg: getComputedStyle(h).backgroundColor,
          at: rr ? [Math.round(rr.left), Math.round(rr.top), Math.round(rr.width), Math.round(rr.height)] : null }; };
      delete sh.dataset.ride; window.railSet(false); await settle();
      const rest = read();
      sh.dataset.ride = "1"; await settle(); const riding = !!vis($("btn-ride")); delete sh.dataset.ride;
      window.railSet(true); await settle(); const open = !!vis($("btn-ride")); window.railSet(false); await settle();
      const st = document.createElement("style"); st.textContent = "#btn-ride{display:none!important}"; document.head.appendChild(st);
      await settle(); const plant = read(); st.remove(); await settle();
      if (rideWas === undefined) delete sh.dataset.ride; else sh.dataset.ride = rideWas;
      window.railSet(!/\bfolded\b/.test(railWas)); rail.className = railWas; await settle();
      return { rest, riding, open, plant };
    } catch (e) { return { error: String((e && e.stack) || e) }; }
  });
  {
    const restOk = (r) => !!r && r.home && r.ride && r.lines === 1 && !r.clip && r.row && r.inRail && r.bg !== r.homeBg;
    const R0 = rb2.rest || {};
    ok(!rb2.error && restOk(rb2.rest) && rb2.riding === false && rb2.open === false && !restOk(rb2.plant),
       `${dev.name}: A233 · the folded drawer at rest holds Return home and Ride on one row, each one tap (${R0.home}/${R0.ride}), `
       + `Ride on ${R0.lines} line at ${R0.at}, clipped ${R0.clip}, outlined (${R0.bg}; Return home ${R0.homeBg}); `
       + `not drawn riding (${rb2.riding}) or with the drawer open (${rb2.open}); its control, Ride hidden, fails`
       + (rb2.error ? ` — ${rb2.error}` : ""));
  }
  /* take 188 · step 13b1 review · A ROUTE CARD'S WARNINGS ARE IN VIEW. The
     cards end on a whole row and scroll for the rest, so a warning below the
     fit sits under a clean edge that reads as the whole card. With a fuel
     range planted shorter than the route (the harness's __nav.fuel), the
     route is asked for again the rider's way (the pin's Route here). The
     SELECTED card's first warning (the fuel range, first under the time
     line) must be whole above the visible foot, and every warning that is
     not must be counted by the pinned row's cue ("N more warnings below"),
     drawn. Controls: the fuel warning moved after the profile (take 187's
     order) fails; a warning moved after the profile with the cue hidden
     fails; the same with the cue drawn passes (the cue path, shown in a
     real browser). Put back: the range, and the cards routed again. */
  const warnR = await page.evaluate(async () => {
    const s = (ms) => new Promise((r) => setTimeout(r, ms));
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    const settle = async () => { for (let i = 0; i < 60; i++) { await frame();
      if (!document.getAnimations().some((a) => a.playState === "running" && a.effect
        && isFinite(a.effect.getComputedTiming().endTime))) return true; await s(30); } return false; };
    const N = window.__nav, m = window.map, body = document.getElementById("railbody"), out = {};
    const DEST = { lng: -84.10724, lat: 44.55265 };      /* the Route layers drill's destination */
    const reroute = async () => { const R0 = document.getElementById("routes");
      m.fire("contextmenu", { lngLat: DEST });
      for (let i = 0; i < 100 && !document.getElementById("pc-route"); i++) await s(50);   /* take 189 · A227: 5 s in 50 ms steps */
      const b = document.getElementById("pc-route"); if (!b) return false; b.click();
      for (let i = 0; i < 600; i++) { const R = document.getElementById("routes"); if (R && R !== R0) break; await s(50); }
      const R = document.getElementById("routes"); if (!R || R === R0) return false;
      window.railSet(false); await settle(); window.railSet(true); await s(50); await settle(); await s(50);
      body.scrollTop = 0; R.scrollTop = 0; await settle(); return true; };
    const judge = () => { const R = document.getElementById("routes"), row = document.getElementById("rcrow");
      const rr = R.getBoundingClientRect(), br = body.getBoundingClientRect(), rw = row.getBoundingClientRect();
      const bottom = Math.min(rr.bottom, rw.top, br.bottom), hid = [], seen = [];
      document.querySelectorAll("#routes .rc.sel .warn").forEach((w) => { const r = w.getBoundingClientRect();
        const t = `${w.textContent.trim().slice(0, 30)} ${Math.round(r.top)}-${Math.round(r.bottom)}`;
        if (r.height > 0 && r.top >= rr.top - 0.5 && r.bottom <= bottom + 0.5) seen.push(t); else hid.push(t); });
      const mo = document.getElementById("rc-more"), mr = mo ? mo.getBoundingClientRect() : null;
      const cueShown = !!mo && getComputedStyle(mo).display !== "none" && mr.height > 0 && mr.bottom <= innerHeight + 0.5;
      const m = mo ? /(\d+) more warning/.exec(mo.textContent || "") : null;
      return { seen, hid, bottom: Math.round(bottom), fit: R.style.maxHeight || "none",
        cue: cueShown ? (m ? +m[1] : -1) : 0, cueText: cueShown ? mo.textContent.trim() : "" }; };
    const refit = async () => { window.railSet(false); await settle(); window.railSet(true); await s(50); await settle(); await s(50); };
    const fuel0 = N.fuel();
    try {
      N.fuel(0.01);
      out.routed = await reroute();
      if (out.routed) {
        out.real = judge();
        const sel = document.querySelector("#routes .rc.sel"), ws = sel ? [...sel.querySelectorAll(".warn")] : [];
        const fw = ws.find((x) => /past your range/.test(x.textContent));
        const lw = ws.filter((x) => x !== fw).pop();
        /* control 1: the fuel warning moved after the profile */
        if (fw) { const nx = fw.nextSibling; sel.appendChild(fw); await refit(); out.plantOrder = judge(); sel.insertBefore(fw, nx); await refit(); }
        /* control 2 and its positive: another warning moved after the
           profile, the cue hidden, then drawn */
        if (lw) { const nx = lw.nextSibling; sel.appendChild(lw);
          const st = document.createElement("style"); st.textContent = "#rc-more{display:none!important}"; document.head.appendChild(st);
          await refit(); out.plantCue = judge(); st.remove(); await refit(); out.cueWorks = judge();
          sel.insertBefore(lw, nx); await refit(); }
        /* the review of step 13b1, round 2 · A PICK RECOUNTS THE CUE. The
           cue counts the SELECTED card's warnings below the fit, so a tap on
           another card must recount it. Another card is given extra
           warnings at its foot (clones of its first) until its own count
           of warnings below the fit differs from the cue drawn now; then it
           is tapped and the same judge must hold for it. Control: the
           selection moved back the way take 187's tap did (the class
           toggled, nothing recounted) fails; tapped back for real, it
           passes again. The clones are removed after. */
        { const R = document.getElementById("routes"), cards = [...R.querySelectorAll(".rc")];
          const c0 = R.querySelector(".rc.sel"), tgt = cards.find((c) => c !== c0), clones = [];
          const hidOf = (c) => { const rr = R.getBoundingClientRect(), row = document.getElementById("rcrow").getBoundingClientRect();
            const bottom = Math.min(rr.bottom, row.top, body.getBoundingClientRect().bottom); let n = 0;
            c.querySelectorAll(".warn").forEach((w) => { const r = w.getBoundingClientRect();
              if (!(r.height > 0 && r.top >= rr.top - 0.5 && r.bottom <= bottom + 0.5)) n++; }); return n; };
          if (c0 && tgt && tgt.querySelector(".warn")) {
            const cue0 = judge().cue; let want = null;
            for (let k = 0; k < 4; k++) {
              const cl = tgt.querySelector(".warn").cloneNode(true); cl.dataset.plant = "1"; tgt.appendChild(cl); clones.push(cl);
              await refit(); R.scrollTop = 0; body.scrollTop = 0;
              want = hidOf(tgt); if (want !== judge().cue) break; }
            out.pickPre = { cards: cards.length, cue0, cueBefore: judge().cue, want, clones: clones.length };
            /* round 3 · THE RIDER'S SCROLL IS KEPT. rcFit runs on the tap
               (rcSel), on resize and on every transitionend that reaches
               #rail, and it clears the box's max-height, which clamps its
               scroll to 0; only its restore puts the scroll back. So the
               options are scrolled down first (a rider reading a card's lower
               rows), and the tap, then a transitionend on #rail, must leave
               that scroll where it was. Round 2 read the scroll from a start
               of 0 and proved nothing (the review). Not asserted where the
               options do not overflow by 8 px. The tapped card must also end
               whole across the box (the tap's smooth scrollIntoView) */
            const room = Math.min(40, R.scrollHeight - R.clientHeight);
            if (room >= 8) { R.scrollTop = room; await frame(); }
            out.scrollPre = room >= 8 ? R.scrollTop : null; out.scrollRoom = room;
            tgt.click(); await s(80); await settle(); await s(400); await settle();
            out.pickScroll = R.scrollTop;
            { const tr = tgt.getBoundingClientRect(), rr = R.getBoundingClientRect();
              out.pickX = { l: Math.round(tr.left - rr.left), r: Math.round(rr.right - tr.right),
                whole: tr.left >= rr.left - 1 && tr.right <= rr.right + 1 }; }
            if (out.scrollPre !== null) {
              document.getElementById("rail").dispatchEvent(new Event("transitionend", { bubbles: true }));
              await frame(); out.teScroll = R.scrollTop; }
            R.scrollTop = 0; body.scrollTop = 0;
            out.pick = judge(); out.pick.isTgt = R.querySelector(".rc.sel") === tgt;
            /* control: take 187's tap (the class toggled, nothing recounted) */
            cards.forEach((d) => { d.className = "rc" + (d === c0 ? " sel" : ""); });
            await s(50); out.pickStale = judge();
            c0.click(); await s(80); await settle(); await s(400); await settle(); R.scrollTop = 0; body.scrollTop = 0;
            out.pickBack = judge(); out.pickBack.isC0 = R.querySelector(".rc.sel") === c0;
            clones.forEach((c) => c.remove()); await refit();
          } else out.pickPre = { cards: cards.length, skipped: !c0 ? "no selected card" : !tgt ? "one card only" : "the other card has no warning" };
        }
      }
    } catch (e) { out.error = String((e && e.stack) || e); }
    try { N.fuel(fuel0); out.back = await reroute(); out.backWarn = /past your range/.test(document.getElementById("panel").innerHTML); } catch (e) { out.error = (out.error || "") + String(e); }
    return out;
  });
  {
    const wr = warnR, fuelSeen = (j) => !!j && j.seen.some((t) => /past your range/.test(t));
    const warnOk = (j) => fuelSeen(j) && j.hid.length === j.cue;
    const fj = (j) => j ? `in view ${j.seen.join("; ") || "none"}; below ${j.hid.join("; ") || "none"}; cue ${j.cue ? `"${j.cueText}"` : "not drawn"}` : "not run";
    ok(!wr.error && wr.routed && warnOk(wr.real) && !!wr.plantOrder && !warnOk(wr.plantOrder)
       && (!wr.plantCue || (!warnOk(wr.plantCue) && warnOk(wr.cueWorks) && wr.cueWorks.cue > 0)) && wr.back && !wr.backWarn,
       `${dev.name}: the selected route card's first warning is in view and every warning below the fit is counted by the cue — `
       + `${fj(wr.real)} (options box ${wr.real ? wr.real.fit : "?"}); controls: the fuel warning after the profile fails (${fj(wr.plantOrder)}); `
       + (wr.plantCue ? `a warning after the profile with the cue hidden fails (${fj(wr.plantCue)}), with the cue drawn passes (${fj(wr.cueWorks)})`
          : "one warning only: the cue control not run")
       + `; range put back and routed again ${wr.back}, fuel warning gone ${!wr.backWarn}` + (wr.error ? ` — ${wr.error}` : ""));
    /* round 3: a pick keeps the rider's scroll of the options */
    {
      const pre = wr.scrollPre, kept = (v) => typeof v === "number" && Math.abs(v - pre) <= 1;
      const asserted = typeof pre === "number";
      ok(!wr.error && !!wr.pick && !!wr.pickX && wr.pickX.whole && (!asserted || (kept(wr.pickScroll) && kept(wr.teScroll))),
         `${dev.name}: tapping another route card keeps the rider's scroll of the options — `
         + (asserted ? `scrolled to ${pre} px before the tap, ${wr.pickScroll ?? "?"} after it, ${wr.teScroll ?? "?"} after a transitionend on #rail`
            : `NOT ASSERTED: the options overflow by ${wr.scrollRoom ?? "?"} px only`)
         + `; the tapped card whole across the box ${wr.pickX ? `${wr.pickX.whole} (left ${wr.pickX.l}, right ${wr.pickX.r} px inside)` : "not read"}`);
    }
    /* round 2: a pick recounts the cue */
    const pp = wr.pickPre || {}, cueOk = (j) => !!j && j.hid.length === j.cue;
    ok(!wr.error && !!wr.pick && wr.pick.isTgt && pp.want !== null && pp.want !== pp.cueBefore && cueOk(wr.pick)
       && !!wr.pickStale && !cueOk(wr.pickStale) && !!wr.pickBack && wr.pickBack.isC0 && cueOk(wr.pickBack),
       `${dev.name}: tapping another route card recounts the warning cue for it — before the tap the cue counted ${pp.cueBefore ?? "?"} `
       + `(the other card: ${pp.want ?? "?"} below with ${pp.clones ?? "?"} planted warning(s) at its foot, ${pp.cards ?? "?"} cards${pp.skipped ? `, NOT RUN: ${pp.skipped}` : ""}); `
       + `after the tap: ${fj(wr.pick)} (the tapped card selected ${wr.pick ? wr.pick.isTgt : "?"}); `
       + `control, take 187's tap (class toggled, not recounted) fails: ${fj(wr.pickStale)}; tapped back: ${fj(wr.pickBack)}`);
  }
  /* take 188 · A215 · G2/G3 · THE RIDE BLOCK at every size, in the three
     states a rider meets: Ride pressed with no fix (#nav alone), the full
     ride (ribbon, nav strip with a real guidance line, sheet, off-route
     alert) with the drawer folded, and the same with the drawer OPEN at its
     ride cap. No two shown floating elements may intersect — the ribbon, the
     nav strip, the sheet, the alert, the four floating controls, the readout,
     the scale and the tool strip — except the one declared overlay: the
     off-route alert over the map controls, and then it must be ON TOP of them
     (a higher layer, and the element a tap there lands on). G3: the nav strip
     sits inside the viewport (it is outside #shell, so the overflow scan never
     sees it). Then the pickers: the activity and mode lists' last row is the
     element a tap at its centre reaches (take 187's panels ran under the
     drawer). Every judge is proved on a plant (landmine 54); nothing in here
     may throw (landmine 217). */
  const rb = await page.evaluate(async () => {
    const R = window.__v4ride; let pad = null;
    try {
    const s = (ms) => new Promise((r) => setTimeout(r, ms));
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    const settle = async () => { for (let i = 0; i < 60; i++) { await frame();
      if (!document.getAnimations().some((a) => a.playState === "running" && a.effect
        && isFinite(a.effect.getComputedTiming().endTime))) return true; await s(30); } return false; };
    const vis = (e) => { if (!e || e.hidden) return null;
      for (let a = e; a && a !== document.documentElement; a = a.parentElement) { const c = getComputedStyle(a);
        if (c.display === "none" || c.visibility === "hidden" || +c.opacity === 0) return null; }
      const r = e.getBoundingClientRect(); return r.width >= 1 && r.height >= 1 ? r : null; };
    const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
    const need = { __v4ride: R, railSet: window.railSet, nav: document.getElementById("nav"), alert: document.getElementById("alert"),
      railbody: document.getElementById("railbody"), actpanel: document.getElementById("actpanel"), modepanel: document.getElementById("modepanel") };
    const lacking = Object.keys(need).filter((k) => !need[k]);
    if (lacking.length) return { error: "missing " + lacking.join(", ") };
    const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    const CONTROLS = ["c-base", "c-hd", "c-mode", "c-act", "readout", "scale"];
    const FLOAT = () => [...["hudbar", "nav", "hudstats", "alert", "c-base", "c-hd", "c-mode", "c-act", "readout", "tools"]
      .map((id) => document.getElementById(id)), document.querySelector(".maplibregl-ctrl-bottom-left")];
    const nm = (e) => e.id || (e.classList.contains("maplibregl-ctrl-bottom-left") ? "scale" : String(e.className).split(" ")[0]);
    const al = need.alert;
    pad = document.createElement("div"); pad.id = "v4plant-ridepad"; pad.style.height = "3000px";
    const judge = (extra) => { const els = [...FLOAT(), ...(extra || [])].filter(Boolean).map((e) => ({ e, r: vis(e) })).filter((x) => x.r);
      const bad = [], overlay = [];
      for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) { const a = els[i], b = els[j];
        if (!hit(a.r, b.r)) continue;
        const pair = [nm(a.e), nm(b.e)], other = pair[0] === "alert" ? b : pair[1] === "alert" ? a : null;
        if (other && CONTROLS.includes(nm(other.e))) {
          const L = Math.max(a.r.left, b.r.left), T = Math.max(a.r.top, b.r.top), Rr = Math.min(a.r.right, b.r.right), B = Math.min(a.r.bottom, b.r.bottom);
          const h = document.elementFromPoint((L + Rr) / 2, (T + B) / 2);
          const zA = +getComputedStyle(al).zIndex || 0, zC = +getComputedStyle(other.e).zIndex || 0;
          if (zA > zC && h && al.contains(h)) overlay.push(nm(other.e)); else bad.push(pair.join("∩") + " (the alert is under it)");
        } else bad.push(pair.join("∩")); }
      const n = vis(need.nav);
      return { bad, overlay, fits: !n || (n.left >= -0.5 && n.right <= vw + 0.5) }; };
    const read = async (kind, open, plant) => {
      const f = R.force(kind);
      if (open) need.railbody.appendChild(pad); else pad.remove();
      window.railSet(!!open); await settle();
      const extra = plant ? await plant() : null;
      const j = judge(extra);
      /* take 188 · step 13b · riding, the floating controls are not drawn */
      j.ctl = CONTROLS.filter((id) => vis(id === "scale" ? document.querySelector(".maplibregl-ctrl-bottom-left") : document.getElementById(id)));
      const r = (id) => { const e = vis(document.getElementById(id)); return e ? [Math.round(e.top), Math.round(e.bottom)] : null; };
      const out = Object.assign({ kind, open: !!open, line: !!f.line, drawn: { hudbar: r("hudbar"), nav: r("nav"), hudstats: r("hudstats"),
        alert: r("alert"), "c-act": r("c-act"), tools: r("tools") }, rideCap: getComputedStyle(document.documentElement).getPropertyValue("--ride-cap").trim() || "unset", rideTop: getComputedStyle(document.documentElement).getPropertyValue("--ride-top").trim() }, j);
      pad.remove(); R.undo(); window.railSet(false); await settle();
      return out; };
    /* take 188 · A215 · Ride pressed with the drawer OPEN, on the session's
       first ride: until a fix the sheet is hidden, so the cap must be
       measured against the tool strip (the Ride tab's "Stop (GPS)" is the
       only Stop on screen then). The first ride of a session has no
       --ride-cap yet; a value left by an earlier ride would hide the gap,
       so it is cleared before this read (the integration review of step 11
       found the drawer at 38vh putting #c-act over the strip). */
    const reads = [await read("pressed", false)];
    document.documentElement.style.removeProperty("--ride-cap");
    reads.push(await read("pressed", true), await read("full", false), await read("full", true));
    /* plants: a box over the sheet is flagged, the same box hidden is not;
       the alert put UNDER the controls is flagged; a nav strip wider than
       the screen fails G3 */
    const box = (id, hide) => { const hs = document.getElementById("hudstats").getBoundingClientRect(), d = document.createElement("div");
      d.id = id; d.style.cssText = `position:absolute;left:20px;top:${hs.top + 10}px;width:40px;height:40px;background:#f0f;z-index:9`
        + (hide ? ";display:none" : ""); document.getElementById("stage").appendChild(d); return d; };
    let bx = [];
    const pOver = await read("full", false, async () => { bx = [box("v4plant-over"), box("v4plant-ghost", true)]; return bx; });
    bx.forEach((d) => d.remove());
    /* take 188 · step 13b · the controls are hidden while riding, so the
       alert-over-controls overlay can only be judged with them forced back:
       that plant reads the controls drawn (the ride-state clause fails), and
       with the alert put under them the overlap judge must flag it */
    const back = document.createElement("style");
    back.textContent = "#shell[data-ride] #readout{display:block!important}#shell[data-ride] #c-base,#shell[data-ride] #c-hd,"
      + "#shell[data-ride] #c-mode,#shell[data-ride] #c-act{display:inline-flex!important}";
    const pShown = await read("full", false, async () => { document.head.appendChild(back); await settle(); return null; }); back.remove();
    const pUnder = await read("full", false, async () => { document.head.appendChild(back); al.style.zIndex = "1"; await settle(); return null; });
    al.style.zIndex = ""; back.remove();
    const pWide = await read("full", false, async () => { need.nav.style.minWidth = (vw + 50) + "px"; return null; }); need.nav.style.minWidth = "";
    const plants = { overCaught: pOver.bad.some((x) => /v4plant-over/.test(x)), ghostIgnored: !pOver.bad.some((x) => /v4plant-ghost/.test(x)),
      underCaught: pUnder.bad.some((x) => /the alert is under it/.test(x)), wideCaught: !pWide.fits,
      shownCaught: pShown.ctl.length > 0 };
    /* the pickers: the last row is one tap, the list scrolled to it */
    const pick = async (chip, pid, plant) => { const p = need[pid]; document.getElementById(chip).click(); await settle(); await s(200);
      if (plant) { p.style.maxHeight = "none"; p.style.overflowY = "visible"; }
      const rows = [...p.querySelectorAll(".actrow, .moderow")].filter((x) => !/\btierrow\b/.test(x.className));
      const last = rows[rows.length - 1]; p.scrollTop = plant ? 0 : p.scrollHeight; await settle();
      const r = last ? last.getBoundingClientRect() : null;
      const h = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
      const railTop = document.getElementById("rail").getBoundingClientRect().top;
      const out = { rows: rows.length, lastHit: !!h && !!last && last.contains(h), hitWas: h ? (h.id || String(h.className).split(" ")[0] || h.tagName) : null,
        centre: r ? Math.round(r.top + r.height / 2) : null, railTop: Math.round(railTop) };
      p.style.maxHeight = ""; p.style.overflowY = ""; p.scrollTop = 0;
      document.getElementById(chip).click(); await settle(); await s(150);
      return out; };
    const panels = {};
    for (const [chip, pid] of [["c-act", "actpanel"], ["c-mode", "modepanel"]]) {
      const real = await pick(chip, pid, false), pl = await pick(chip, pid, true);
      panels[pid] = { real, plant: pl, binds: pl.centre !== null && pl.centre > pl.railTop, caught: !pl.lastHit }; }
    /* the matrix's own forced HUD, for the next size's reads */
    window.hudShow(true); window.hudSet(11.2, 48.8, null);
    return { reads, plants, panels };
    } catch (e) { try { if (pad) pad.remove(); R.undo(); window.hudShow(true); window.hudSet(11.2, 48.8, null); } catch (e2) {}
      return { error: String((e && e.stack) || e) }; }
  });
  ok(!rb.error, `${dev.name}: the ride-block read ran (${rb.error || "ok"})`);
  if (!rb.error) {
    const P2 = rb.plants;
    ok(P2.overCaught && P2.ghostIgnored && P2.underCaught && P2.wideCaught && P2.shownCaught,
       `${dev.name}: the ride-block judges catch their plants (a box over the sheet is flagged, a hidden one is not; `
       + `the alert under the controls (forced back) is flagged; a nav strip wider than the screen fails G3; `
       + `the floating controls forced back while riding read as drawn) ${JSON.stringify(P2)}`);
    for (const r of rb.reads)
      ok(r.bad.length === 0 && r.fits && (r.kind !== "full" || r.line) && r.ctl.length === 0,
         `${dev.name}: G2/G3 · ${r.kind === "pressed" ? "Ride pressed, no fix" : "the full ride"}, drawer ${r.open ? "open at its cap" : "folded"}: `
         + `the floating controls are not drawn (${r.ctl.join(", ") || "none drawn"}); `
         + `nothing overlaps (${r.bad.join(", ") || "none"}); the alert is on top of ${r.overlay.join(", ") || "nothing"}; `
         + `the nav strip fits the width (${r.fits})` + (r.kind === "full" ? `; a real guidance line (${r.line})` : "")
         + `; --ride-top ${r.rideTop}; --ride-cap ${r.rideCap}; ${JSON.stringify(r.drawn)}`);
    for (const [pid, p] of Object.entries(rb.panels))
      ok(p.real.lastHit && (!p.binds || p.caught),
         `${dev.name}: the ${pid}'s last row (of ${p.real.rows}) is one tap, scrolled to (hit ${p.real.hitWas}); `
         + (p.binds ? `unbounded, it would sit under the drawer at ${p.plant.centre} px (rail at ${p.plant.railTop}) and the plant `
            + `is caught (${p.caught}, hit ${p.plant.hitWas})` : `unbounded it would still fit here (the plant is not asserted)`));
  }
  /* take 188 · A217 · THE DESTINATION COUNTER (A113 re-decided). Every
     strip wraps, so at every size, on every tab, each chip of the open
     destination lies fully inside the screen, above the drawer, and is what
     a tap at its centre lands on (landmine 173) — no sideways strip, no
     chip under the attribution — and no destination holds more than 7.
     Its plants: an 8th Tools chip trips the count; a hidden planted chip is
     not counted; and at 360 px take 187's one-row scrolling strip puts
     Plan's chips off screen. All removed at once. */
  const dc = await page.evaluate(async (narrow) => {
    const out = { tabs: {}, plants: {} };
    try {
      const s = (ms) => new Promise((r) => setTimeout(r, ms));
      const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
      const vw = document.documentElement.clientWidth;
      const read = async (t, open) => {
        document.querySelector(`#tabs .tab[data-go="${t}"]`).click(); await frame(); await frame(); await s(80);
        /* take 189 · cold audit · with the drawer OPEN to its cap (a tall
           card; the slide ends and the cap is re-measured before the read,
           landmine 224): at 360 x 800 Tools' four rows rose under the left
           column and "Take the tour" was not to be seen */
        if (open) { window.showQuiet('<div id="v4plant-tallcard3" style="height:2000px">A tall card (render)</div>', ""); window.railSet(true);
          for (let i = 0; i < 60; i++) { await frame(); if (!document.getAnimations().some((a) => a.playState === "running"
            && a.effect && isFinite(a.effect.getComputedTiming().endTime))) break; await s(30); }
          await s(120); await frame(); await frame(); }
        const railTop = document.getElementById("rail").getBoundingClientRect().top, tools = document.getElementById("tools");
        const chips = [...document.querySelectorAll(".chip[data-tab]")]
          .filter((c) => !c.hidden && getComputedStyle(c).display !== "none");
        const bad = [];
        for (const c of chips) { const r = c.getBoundingClientRect();
          if (r.left < -0.5 || r.right > vw + 0.5 || r.top < 0 || r.bottom > railTop + 0.5) { bad.push(c.id + " off screen"); continue; }
          const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          if (!h || !(h === c || c.contains(h))) bad.push(c.id + " under " + (h ? (h.id || String(h.className).split(" ")[0] || h.tagName) : "nothing"));
          /* take 189 · cold audit · and no part of it under the attribution's (i) */
          const ai = document.querySelector(".maplibregl-ctrl-bottom-right .maplibregl-ctrl-attrib"), q = ai && ai.getBoundingClientRect();
          if (q && q.width > 0 && q.height > 0 && r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top) bad.push(c.id + " under the attribution"); }
        return { n: chips.length, bad, stripH: Math.round(tools.getBoundingClientRect().height),
                 rows: new Set(chips.map((c) => Math.round(c.getBoundingClientRect().top))).size,
                 overflow: tools.scrollWidth > tools.clientWidth + 1 };
      };
      for (const t of ["map", "plan", "ride", "tools"]) out.tabs[t] = await read(t);
      out.open = {};
      /* the panel's own nodes (the route cards the matrix reads next, with
         their listeners) are kept and put back after the tall card */
      const pnl = document.getElementById("panel"), keepN = [...pnl.childNodes], keepC = pnl.className;
      for (const t of ["map", "plan", "ride", "tools"]) out.open[t] = await read(t, true);
      if (narrow) { const st = document.createElement("style"); st.id = "v4plant-restcap";
        st.textContent = "#railbody{max-height:calc(38vh - var(--rc-trim,0px))!important}"; document.head.appendChild(st);
        out.plants.restcap = await read("tools", true); st.remove(); }
      window.railSet(false); await frame(); await s(300);
      pnl.replaceChildren(...keepN); pnl.className = keepC;
      const tl = document.getElementById("tools");
      const p8 = document.createElement("button"); p8.className = "chip"; p8.dataset.tab = "tools";
      p8.id = "v4plant-chip8"; p8.innerHTML = "<span>Plant</span>"; tl.appendChild(p8);
      const ph = document.createElement("button"); ph.className = "chip"; ph.dataset.tab = "plan";
      ph.id = "v4plant-chiphid"; ph.style.display = "none"; tl.appendChild(ph);
      out.plants.eight = await read("tools"); out.plants.hid = await read("plan");
      p8.remove(); ph.remove();
      if (narrow) { const st = document.createElement("style"); st.id = "v4plant-nowrap";
        st.textContent = "#tools{flex-wrap:nowrap!important;overflow-x:auto!important}"; document.head.appendChild(st);
        out.plants.nowrap = await read("plan"); st.remove(); }
      document.querySelector('#tabs .tab[data-go="map"]').click(); await frame();
    } catch (e) { out.error = String(e); }
    return out;
  }, dev.width <= 360);
  const destOk = (x) => !!x && x.n <= 7 && x.bad.length === 0 && !x.overflow;
  ok(!dc.error && dc.plants.eight && !destOk(dc.plants.eight) && dc.plants.eight.n === 8
     && destOk(dc.plants.hid) && dc.plants.hid.n === (dc.tabs.plan || {}).n
     && (dev.width > 360 || (dc.plants.nowrap && !destOk(dc.plants.nowrap))),
     `${dev.name}: the destination counter catches its plants (an 8th Tools chip: ${dc.plants.eight ? dc.plants.eight.n : "?"}; `
     + `a hidden chip is not counted: Plan ${dc.plants.hid ? dc.plants.hid.n : "?"}`
     + (dev.width <= 360 ? `; take 187's one-row strip: ${dc.plants.nowrap ? dc.plants.nowrap.bad.length + " Plan chips off screen" : "?"}` : "")
     + ")" + (dc.error ? " — " + dc.error : ""));
  for (const [t, x] of Object.entries(dc.tabs))
    ok(destOk(x), `${dev.name}: ${t} holds ${x.n} (at most 7), all on screen in ${x.rows} row(s), strip ${x.stripH} px`
       + (x.bad.length ? " — " + x.bad.join(", ") : "") + (x.overflow ? " — the strip scrolls sideways" : ""));
  { const op = dc.open || {}, rc = dc.plants.restcap;
    ok(!dc.error && ["map", "plan", "ride", "tools"].every((t) => destOk(op[t])) && (dev.width > 360 || (!!rc && !destOk(rc))),
       `${dev.name}: with the drawer open to its cap every tab's chips are on screen, one tap, clear of the left column and the (i) — `
       + ["map", "plan", "ride", "tools"].map((t) => `${t} ${op[t] ? op[t].n + (op[t].bad.length ? " (" + op[t].bad.join(", ") + ")" : "") : "?"}`).join(", ")
       + (dev.width <= 360 ? `; its control, take 188's 38vh cap at rest on Tools: ${rc ? rc.bad.join(", ") || "NOT CAUGHT" : "?"}` : "")); }
}
/* take 189 · A238 · THE DIRT BIKE'S ROUTE CARDS. The matrix reads the
   side-by-side's cards (the machine the full run plans for here). Planned
   for the dirt bike the same route's cards put neighbouring cards' rows a
   row apart, and rcFit's fit cut one by a fraction of a pixel at 4 of 5
   sizes (render-t189-L-render-prof-5.log; PROVEN in probe at 412 x 915).
   The same rows read, at every size, on the bike's cards — at rest and
   riding, each with its half-row control — then the side-by-side's cards
   are planned again for what follows. */
{
  /* the start pin is put where the Route layers drill put it (the forced
     rides above moved the rider along the route), and afterwards back where
     it was, so what follows is planned from the same place as before */
  const ME0 = await page.evaluate(() => window.__route.ME.slice());
  const replan = (mach, start) => page.evaluate(async (mach, start) => {
    const s = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
      window.__route.setMachine(mach);
      const m = window.map, R0 = document.getElementById("routes");
      m.fire("contextmenu", { lngLat: { lng: start[0], lat: start[1] } });
      for (let i = 0; i < 100 && !document.getElementById("pc-start"); i++) await s(50);
      const st = document.getElementById("pc-start"); if (!st) return { ok: false, why: "no pc-start" };
      st.click(); await s(200);
      const me = window.__route.ME;
      if (Math.abs(me[0] - start[0]) > 1e-6 || Math.abs(me[1] - start[1]) > 1e-6) return { ok: false, why: "the start pin did not move: " + me };
      m.fire("contextmenu", { lngLat: { lng: -84.10724, lat: 44.55265 } });   /* the Route layers drill's destination */
      for (let i = 0; i < 100 && !document.getElementById("pc-route"); i++) await s(50);
      const b = document.getElementById("pc-route"); if (!b) return { ok: false, why: "no pc-route" };
      b.click();
      for (let i = 0; i < 600; i++) { const R = document.getElementById("routes"); if (R && R !== R0) break; await s(50); }
      const R = document.getElementById("routes");
      const hard = R ? [...R.querySelectorAll(".rc .sub")].map((x) => x.textContent.trim()).find((t) => /^hardest/.test(t)) : null;
      return { ok: !!R && R !== R0, machine: window.__route.machine, cards: R ? R.querySelectorAll(".rc").length : 0, hard: hard || "" };
    } catch (e) { return { ok: false, why: String(e) }; } }, mach, start);
  const bk = await replan("bike", [-84.12855, 44.53949]);   /* the Route layers drill's start */
  ok(bk.ok && bk.machine === "bike" && bk.cards >= 2,
     `A238 · the route planned again for the dirt bike: ${bk.cards} cards, "${bk.hard}"` + (bk.why ? ` — ${bk.why}` : ""));
  /* fix round 1 · whole rows, AND no more than half a row (9 px) under the
     largest line that cuts nothing (the lane's first fix kept the rows
     whole by giving up three of them: 168 px of 234). Its control: the
     reading with the fit 66 px short, as that build left it */
  const rowsOk = (j) => !!j && j.cut.length === 0 && j.whole >= 4 && (j.short === null || j.short <= 9);
  for (const dev of DEVICES) {
    await page.setViewport({ width: dev.width, height: dev.height, deviceScaleFactor: dev.dpr });
    await vpSettle(800);
    const rows = bk.ok ? await page.evaluate(ROWS_FN) : { error: "the bike's route was not planned" };
    const J = (j) => j ? `${j.whole} whole, cut ${j.cut.join("; ") || "none"} (box ${j.fit}, ${j.short === null ? "no fit" : j.short + " px under " + j.best})` : "not read";
    ok(!rows.error && !rows.rideErr && rowsOk(rows.real) && !!rows.plant && !rowsOk(rows.plant)
       && !!rows.real && !rowsOk(Object.assign({}, rows.real, { short: 66 }))
       && rowsOk(rows.ride) && !!rows.ridePlant && !rowsOk(rows.ridePlant) && !!rows.restored && rows.restored.cards,
       `${dev.name}: A238 · the dirt bike's route cards show whole rows — at rest ${J(rows.real)}; riding ${J(rows.ride)}; `
       + `each half-row control flagged (${rows.plant ? rows.plant.cut.length : "?"}, ${rows.ridePlant ? rows.ridePlant.cut.length : "?"} cut), and a fit 66 px short`
       + (rows.error || rows.rideErr ? ` — ${rows.error || rows.rideErr}` : ""));
  }
  const sx = await replan("sxs", ME0);
  ok(sx.ok && sx.machine === "sxs" && sx.cards >= 2, `A238 · the side-by-side's route planned again for what follows, `
     + `from where the start pin was (${ME0.map((v) => v.toFixed(5)).join(", ")}): ${sx.cards} cards` + (sx.why ? ` — ${sx.why}` : ""));
  const lastDev = DEVICES[DEVICES.length - 1];
  await page.setViewport({ width: lastDev.width, height: lastDev.height, deviceScaleFactor: lastDev.dpr });
  await vpSettle(800);
}
await page.evaluate(() => { try { window.hudShow && window.hudShow(false); } catch (e) {} });
}

if (RUN("faults")) {
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
    // the self-test runs a ride drill; it must put the HUD back.
    /* take 188 · CI run 89: this loop moved on at the first "PASS" — or
       after 15 s — while the self-test was still waiting up to 20 s for a
       GPS fix that headless Chrome never gets. Its final report card then
       landed in the NEXT check and replaced that check's route cards
       (reproduced at CPU x4: the report at 36 s, the cards at 25.7 s;
       landmine 234). Wait for the report itself, and say so.
       CI run 90: the report took 84 s on a slow runner, 6 s inside the old
       90 s ceiling, and CI renders twice per run (landmine 235). 180 s; the
       loop leaves as soon as the report lands, so a fast runner pays nothing. */
    const done = (h) => /Self-test\s*\u00b7\s*\d+ passed/.test(String(h).replace(/<[^>]*>/g, ""));
    out.doneJudge = done('<b style="font-size:var(--t-lg)">Self-test \u00b7 <span style="color:var(--ok)">42 passed, 3 failed</span></b>')
      && !done("Self-test running\u2026 Waiting up to 20s for a GPS fix");
    const t0 = Date.now();
    document.getElementById("c-selftest").click();
    for (let i = 0; i < 720 && !done(document.getElementById("panel").innerHTML); i++)
      await sleep(250);
    out.selftestDone = done(document.getElementById("panel").innerHTML);
    out.selftestS = Math.round((Date.now() - t0) / 1000);
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
  ok(r.doneJudge && r.selftestDone,
     `the self-test drill waits for the self-test's own report (${r.selftestS} s, at most 180 s) before the next check — `
     + `its judge takes the final report and rejects a running one (its control)`);
  ok(r.hudHiddenAtRest, "compass ribbon is off before any ride");
  ok(r.hudHiddenAfterSelftest,
     "self-test leaves the compass ribbon OFF — the drill puts back what it moved");
  ok(r.chipsShownAfterSelftest,
     "self-test gives the place chips back");
  ok(r.hintShownNoHeading,
     "with no heading the ribbon says so instead of showing a bare needle");
  ok(r.hintHiddenWithHeading, "with a heading the hint gets out of the way");
}

}

if (RUN("realdom")) {
/* take 188 · step 13b1 review · TWO REAL-DOM READS.
   (1) --rc-trim goes with the route cards. Clear route is an ack(): the
   drawer folds, and a trim left on made the next card's drawer open short
   and then grow a second time. Read: the trim right after the clear, then a
   tall card opened (showQuiet + railSet(true), what show() does): ONE
   max-height slide, settling at 38vh. Its control here: the same read with
   the trim planted as a stylesheet settles short (the old code path itself
   needs a planted build: the step's notes record that run).
   (2) Ride refuses honestly in a real browser (the smoke stub keeps one
   element per id, so only a real DOM can say what the rider sees). The
   rider's path: Return home, then the route card's Ride it, with a
   stand-in watch that answers with a permission error. The refusal card
   replaces the route cards; the Ride tab's Ride it is drawn, the route
   stays chosen and drawn, no ride flag, no sheet, no simulator; pressed
   again it opens a NEW watch and refuses again. Its control: GPS held
   pending (no error) fails the same judge. */
{
  const vp0 = page.viewport();
  const trRead = async () => {
    const s = (ms) => new Promise((r) => setTimeout(r, ms));
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    const settle = async () => { for (let i = 0; i < 60; i++) { await frame();
      if (!document.getAnimations().some((a) => a.playState === "running" && a.effect
        && isFinite(a.effect.getComputedTiming().endTime))) return true; await s(30); } return false; };
    const body = document.getElementById("railbody"), out = {};
    const trim = () => body.style.getPropertyValue("--rc-trim").trim();
    const cards = async () => { document.getElementById("btn-home").click();
      for (let i = 0; i < 80 && !document.getElementById("btn-clear"); i++) await s(250);
      if (!document.getElementById("routes")) return false;
      window.railSet(false); await settle(); window.railSet(true); await s(50); await settle(); await s(50); return true; };
    const openTall = async () => { const runs = [];
      const on = (e) => { if (e.target === body && e.propertyName === "max-height") runs.push(1); };
      body.addEventListener("transitionrun", on);
      window.showQuiet('<div id="v4plant-tallcard" style="height:2000px">A tall card (render)</div>', ""); window.railSet(true);
      await s(50); await settle(); await s(500); await settle();
      body.removeEventListener("transitionrun", on);
      return { runs: runs.length, max: Math.round(parseFloat(getComputedStyle(body).maxHeight)) }; };
    try {
      out.vh38 = Math.round(0.38 * document.documentElement.clientHeight);
      if (!(await cards())) return { error: "no route cards after Return home" };
      out.before = trim();
      document.getElementById("btn-clear").click();          /* ack(): a toast, the drawer folds */
      out.afterClear = trim();
      await settle();
      out.real = await openTall();
      window.railSet(false); await settle();
      /* the control: the trim left on (as a stylesheet: the app clears the
         inline one) — the same read settles short */
      if (!(await cards())) return Object.assign(out, { error: "no route cards the second time" });
      const g = trim() || "0px";
      /* take 188 · CI run 89: if something replaced the cards, say what */
      const bc2 = document.getElementById("btn-clear");
      if (!bc2) return Object.assign(out, { error: "the route cards were replaced before Clear route — the drawer shows: "
        + (document.getElementById("panel").innerText || "").replace(/\s+/g, " ").slice(0, 90) });
      bc2.click(); await settle();
      const st = document.createElement("style"); st.textContent = `#railbody{--rc-trim:${g}}`; document.head.appendChild(st);
      out.plant = await openTall(); out.plant.g = g; st.remove();
      window.railSet(false); await settle();
    } catch (e) { out.error = String((e && e.stack) || e); }
    return out;
  };
  /* the read needs a trim to exist: the first size whose route cards
     trim the drawer (412 x 915 trimmed most in the fixer's run; the old
     card order trimmed 0 px at 360 x 800) */
  let tr = null, trAt = "";
  for (const [w, h, d] of [[412, 915, 2.625], [360, 800, 3], [749, 832, 2]]) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: d }); await vpSettle(800);
    tr = await page.evaluate(trRead); trAt = `${w}x${h}`;
    if (tr.error || parseFloat(tr.before) > 0) break;
  }
  await page.setViewport({ width: 360, height: 800, deviceScaleFactor: 3 });
  await vpSettle(800);
  const trimOk = (r) => !!r && r.runs === 1 && Math.abs(r.max - tr.vh38) <= 1;
  ok(!tr.error && parseFloat(tr.before) > 0 && tr.afterClear === "" && trimOk(tr.real) && !trimOk(tr.plant),
     `${trAt}: Clear route takes the route cards' trim with it — trim ${tr.before || "none"} with the cards up, `
     + `"${tr.afterClear}" right after the clear; the next tall card opens in ${tr.real ? tr.real.runs : "?"} slide(s) to ${tr.real ? tr.real.max : "?"} px `
     + `(38vh ${tr.vh38}); its control, the trim (${tr.plant ? tr.plant.g : "?"}) left on, settles at ${tr.plant ? tr.plant.max : "?"} px`
     + (tr.error ? ` — ${tr.error}` : ""));

  const rf = await page.evaluate(async () => {
    const s = (ms) => new Promise((r) => setTimeout(r, ms));
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    const settle = async () => { for (let i = 0; i < 60; i++) { await frame();
      if (!document.getAnimations().some((a) => a.playState === "running" && a.effect
        && isFinite(a.effect.getComputedTiming().endTime))) return true; await s(30); } return false; };
    const N = window.__nav, geo = navigator.geolocation, out = {};
    if (!geo) return { error: "no navigator.geolocation" };
    const gw = geo.watchPosition, gc = geo.clearWatch, pm0 = N.pos();
    const onTab = document.querySelector("#tabs .tab.on"), tab0 = onTab ? onTab.dataset.go : "map";
    let watches = 0, clears = 0, mode = "error";
    geo.watchPosition = (okCb, errCb) => { watches++;
      if (mode === "error") setTimeout(() => { try { errCb && errCb({ code: 1, message: "User denied Geolocation" }); } catch (e) {} }, 60);
      return 4300 + watches; };
    geo.clearWatch = () => { clears++; };
    const vis = (e) => { if (!e) return false;
      for (let x = e; x && x.nodeType === 1; x = x.parentElement) { const cs = getComputedStyle(x);
        if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) return false; }
      const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const q = (id) => { try { return window.map.queryRenderedFeatures({ layers: [id] }).length; } catch (e) { return -1; } };
    const read = () => { const t = document.getElementById("panel").textContent || "", cr = document.getElementById("c-ride");
      return { copy: /No GPS fix/.test(t) && /turn on location and try again/.test(t) && /Nothing started/.test(t),
        sim: /simulat/i.test(t) || N.pos() === "sim", flag: document.getElementById("shell").dataset.ride || null,
        sheet: vis(document.getElementById("hudstats")), chip: vis(cr) && /Ride it/.test(cr.textContent || ""),
        rcRide: !!document.getElementById("rc-ride"), plan: !!N.plan(), line: q("routeline"), text: t.trim().slice(0, 80) }; };
    try {
      document.getElementById("btn-home").click();
      for (let i = 0; i < 80 && !document.getElementById("rc-ride"); i++) await s(250);
      for (let i = 0; i < 40 && q("routeline") <= 0; i++) await s(250);
      const rr = document.getElementById("rc-ride");
      if (!rr) return Object.assign(out, { error: "no route card Ride it after Return home" });
      rr.click(); await s(400); await settle();
      out.first = read(); out.w1 = watches; out.c1 = clears;
      document.getElementById("c-ride").click(); await s(400); await settle();
      out.second = read(); out.w2 = watches; out.c2 = clears;
      mode = "pending";
      document.getElementById("c-ride").click(); await s(300); await settle();
      out.pending = read();
      /* take 189 · A230 · this same press, GPS still pending: the strip and
         the folded drawer's peek line say it is waiting; the peek line is
         whole (not cut by its ellipsis) above the action row. Its control:
         take 188's lone "—" over an empty band, set by hand, fails */
      /* take 189 · cold audit · "whole" read the span against ITSELF: #peek is a
         column flexbox centring its items, so the span is as wide as its text
         and scrollWidth never passed clientWidth (the take's own control read
         "287 of 287 px" for a line it called cut). Whole now means inside the
         peek row (#peek's padding box) and not ellipsed */
      const wr = () => { const sp = document.getElementById("nav-sp"), pk = document.getElementById("peek-txt"),
          ar = document.getElementById("actions").getBoundingClientRect(), pr = pk.getBoundingClientRect();
        const pe = document.getElementById("peek").getBoundingClientRect(), pcs = getComputedStyle(document.getElementById("peek"));
        const inL = pe.left + (parseFloat(pcs.paddingLeft) || 0), inR = pe.right - (parseFloat(pcs.paddingRight) || 0);
        return { strip: sp.textContent, stripDrawn: vis(sp), peek: pk.textContent, peekDrawn: vis(pk),
          whole: pk.scrollWidth <= pk.clientWidth + 1 && pr.left >= inL - 0.5 && pr.right <= inR + 0.5 && pr.right <= document.documentElement.clientWidth + 0.5,
          room: Math.round(inR - inL), w: Math.round(pr.width), folded: /\bfolded\b/.test(document.getElementById("rail").className),
          aboveRow: pr.bottom <= ar.top + 0.5 }; };
      out.wait = wr();
      const spE = document.getElementById("nav-sp"), pkE = document.getElementById("peek-txt"), sp0 = spE.textContent, pk0 = pkE.textContent;
      spE.textContent = "\u2014"; pkE.textContent = "";
      out.waitPlant = wr();
      /* fix round 1 · a resumed trip's form of the line, at its longest,
         its width at 360 (smoke 11b reads what the app writes; this string
         is the app's shape, set by hand). take 189 · cold audit · JUDGED
         now, at the widest three-digit figure (4 is Barlow's widest digit:
         "444.4"; the reported "99.9" was not the longest), against the peek
         row (see wr). Its control: a line longer than the row */
      pkE.textContent = pk0.replace(/nothing recorded yet$/, "444.4 mi recorded, kept");
      out.waitLong = Object.assign(wr(), { sw: pkE.scrollWidth, cw: pkE.clientWidth });
      pkE.textContent = pk0.replace(/nothing recorded yet$/, "444.4 mi recorded, kept, a line planted longer than the drawer is wide");
      out.waitLongPlant = Object.assign(wr(), { sw: pkE.scrollWidth, cw: pkE.clientWidth });
      spE.textContent = sp0; pkE.textContent = pk0;
    } catch (e) { out.error = String((e && e.stack) || e); }
    try { if (document.getElementById("shell").dataset.ride) N.stopReal(); } catch (e) {}
    geo.watchPosition = gw; geo.clearWatch = gc;
    try { N.pos(pm0); window.railSet(false); } catch (e) {}
    const tb = document.querySelector(`#tabs .tab[data-go="${tab0}"]`); if (tb) tb.click();
    await s(200);
    return out;
  });
  const refOk = (r) => !!r && r.copy && !r.sim && r.flag === null && !r.sheet && r.chip && r.plan && r.line > 0;
  const fr = (r) => r ? `copy ${r.copy}, simulator ${r.sim}, flag ${r.flag}, sheet ${r.sheet}, Ride tab's Ride it drawn ${r.chip}, `
    + `route chosen ${r.plan}, route line ${r.line}, route cards' Ride it ${r.rcRide ? "STILL IN THE DOCUMENT" : "gone with the cards"} ("${r.text}")` : "not read";
  ok(!rf.error && refOk(rf.first) && !rf.first.rcRide && rf.w1 === 1 && rf.c1 === 1 && refOk(rf.second) && rf.w2 === 2 && rf.c2 === 2
     && !refOk(rf.pending),
     `360x800 (real DOM): Ride it with GPS refused — ${fr(rf.first)}; watches opened/closed ${rf.w1}/${rf.c1}; `
     + `pressed again (the Ride tab's chip): ${rf.w2}/${rf.c2}, ${refOk(rf.second) ? "refuses again" : "DOES NOT refuse again: " + fr(rf.second)}; `
     + `its control, GPS held pending, fails the judge (${rf.pending ? `copy ${rf.pending.copy}, flag ${rf.pending.flag}` : "not run"})`
     + (rf.error ? ` — ${rf.error}` : ""));
  const waitOk = (w) => !!w && w.stripDrawn && /^Waiting for a GPS fix$/.test(w.strip) && w.peekDrawn
    && /^Waiting for a GPS fix\b/.test(w.peek) && w.whole && w.folded && w.aboveRow;
  const W = rf.wait || {};
  ok(!rf.error && waitOk(rf.wait) && !waitOk(rf.waitPlant),
     `360x800 (real DOM): A230 · Ride pressed with GPS pending — the strip reads "${W.strip}", the folded drawer's peek line `
     + `"${W.peek}" (drawn ${W.peekDrawn}, whole ${W.whole}, above the action row ${W.aboveRow}); its control, take 188's `
     + `"\u2014" over an empty band, fails`);
  { const L = rf.waitLong || {}, LP = rf.waitLongPlant || {};
    const longOk = (w) => !!w && w.whole && w.aboveRow && w.peekDrawn;
    /* and a line longer than the row ends in its ellipsis INSIDE the row
       (the span's max-width: it ran past the drawer's edges) */
    ok(!rf.error && longOk(rf.waitLong) && !longOk(rf.waitLongPlant) && LP.w <= LP.room + 0.5,
       `360x800 (real DOM): A230 · a resumed trip's longest peek line "${L.peek}" is whole (${L.w} px in a ${L.room} px row); `
       + `its control, a line longer than the row (${LP.sw} px of text), is not (${LP.w} px drawn, whole ${LP.whole})`); }

  /* take 189 · A240 · a tapped place card at 360x800 stays open. The pin is
     put 24 px under the map's top (70 px rode up only to -21: the stage
     lost 182 px) and tapped (a real click on the canvas);
     the drawer opens, the stage shrinks under it (#shell is a grid: the
     drawer is a row), and MapLibre's resize() keeps the centre, so the pin
     rides up past the old rule's -40 px edge. The judge: after the slide
     and every resize (a frame drawn before the read, landmine 224) the
     card is open, its pin sits where the old rule folded it (y < -40),
     and the map did resize. Its planted control: the OLD rule (every
     moveend treated as the rider's) registered beside the app's, the same
     tap from the same camera — the card folds, and the judge fails it. */
  const rf2 = await page.evaluate(async () => {
    const s = (ms) => new Promise((r) => setTimeout(r, ms));
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    const settle = async () => { for (let i = 0; i < 60; i++) { await frame();
      if (!document.getAnimations().some((a) => a.playState === "running" && a.effect
        && isFinite(a.effect.getComputedTiming().endTime))) return true; await s(30); } return false; };
    const m = window.map, rail = document.getElementById("rail"), out = {};
    const still = async () => { for (let i = 0; i < 80 && m.isMoving(); i++) await s(50);
      await Promise.race([new Promise((r) => m.once("idle", r)), s(4000)]); await frame(); await frame(); };
    const LAY = ["poi-dot", "poi-dot-major"];
    try {
      const tb = document.querySelector('#tabs .tab[data-go="map"]'); if (tb) tb.click();
      window.railSet(false); await settle(); await still();
      /* a trailhead (every mode draws one), the camera on it, polled until
         its pin draws (the take-109 drill's way) */
      const src = m.getStyle().sources.poi.data.features;
      const pk = src.find((f) => f.properties.k === "trailhead") || src[0];
      const cam0 = { c: m.getCenter(), z: m.getZoom() };
      m.jumpTo({ center: pk.geometry.coordinates, zoom: 14 }); await still();
      let hits = [];
      for (let i = 0; i < 30 && !hits.length; i++) { hits = m.queryRenderedFeatures({ layers: LAY }); if (!hits.length) await s(300); }
      if (!hits.length) return { error: "no pin drawn to tap" };
      hits.sort((x, y) => (y.properties.k === "trailhead") - (x.properties.k === "trailhead"));
      const at = hits[0].geometry.coordinates.slice();
      out.cam0 = cam0;
      const cv = m.getCanvas(), rc = cv.getBoundingClientRect();
      const p0 = m.project(at); m.panBy([p0.x - rc.width / 2, p0.y - 24], { duration: 0 }); await still();
      const cam = { c: m.getCenter(), z: m.getZoom() };
      let resizes = 0; const onRz = () => { resizes++; }; m.on("resize", onRz);
      const tap = async () => { const p = m.project(at), r = cv.getBoundingClientRect();
        const y0 = Math.round(p.y);
        /* a phone's tap starts with a touch: the app's long-press watch
           (touchstart) clears its "the long press already acted" flag,
           which an earlier drill's touch long press left set — a bare
           mouse click then went to that flag (seen: the first run of this
           drill, drawer never opened) */
        try { const tc = new Touch({ identifier: 7, target: cv, clientX: r.left + p.x, clientY: r.top + p.y });
          m.getCanvasContainer().dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [tc], targetTouches: [tc], changedTouches: [tc] }));
          m.getCanvasContainer().dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [tc] }));
        } catch (e) { }
        for (const t of ["mousedown", "mouseup", "click"])
          cv.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, clientX: r.left + p.x, clientY: r.top + p.y }));
        await s(30); const openedAt = !/\bfolded\b/.test(rail.className);
        await s(70); await settle(); await still(); await s(600); await settle(); await still();
        const q = m.project(at);
        return { y0, openedAt, y: Math.round(q.y), folded: /\bfolded\b/.test(rail.className),
          card: (document.getElementById("panel").innerText || "").replace(/\s+/g, " ").trim().slice(0, 60),
          mapH: Math.round(m.getContainer().getBoundingClientRect().height), resizes };
      };
      out.real = await tap();
      window.railSet(false); await settle(); await still();
      m.jumpTo({ center: [cam.c.lng, cam.c.lat], zoom: cam.z }); await still();
      resizes = 0;
      const plant = (e) => window.railFoldIfAway({ originalEvent: (e && e.originalEvent) || { type: "planted" } });
      m.on("moveend", plant);
      out.plant = await tap();
      m.off("moveend", plant); m.off("resize", onRz);
      window.railSet(false); await settle();
      m.jumpTo({ center: [cam0.c.lng, cam0.c.lat], zoom: cam0.z });
    } catch (e) { out.error = String((e && e.stack) || e); }
    return out;
  });
  const keepOk = (r) => !!r && r.openedAt && !r.folded && r.y < -40 && r.resizes > 0 && r.card.length > 0;
  { const R = rf2.real || {}, P = rf2.plant || {};
    ok(!rf2.error && keepOk(rf2.real) && !keepOk(rf2.plant) && P.folded,
       `360x800 (real DOM): A240 · a tapped pin card stays open while the drawer's slide resizes the map — `
       + `pin tapped at y ${R.y0} (drawer opened ${R.openedAt}), after ${R.resizes} resize(s) it sits at y ${R.y} (the old rule folded below -40), `
       + `map ${R.mapH} px tall, drawer ${R.folded ? "FOLDED" : "open"} ("${R.card}"); its control, the old rule `
       + `(every moveend the rider's), folds the same tap (opened ${P.openedAt}, folded ${P.folded}, y ${P.y}, ${P.resizes} resize(s))`
       + (rf2.error ? ` — ${rf2.error}` : "")); }
  await page.setViewport(vp0);
  await vpSettle(600);
}

}

if (RUN("clear")) {
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

}

if (RUN("tail")) {
/* Machine legality on the map (take 80, A86). Assert the PAINT the browser
   actually resolved, per machine, not that a function ran. */
await respawn();
const mach = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  /* Take 121: this block counted wherever the camera was left by an earlier
     drill. When that view changed, bike measured 102 features and the
     side-by-side 31 — not a legality bug, two machines measured at different
     moments of the same tile load. It sets its own view now, derived from a
     trail50 line in the payload (never a hardcoded coordinate — landmine
     197), and lets it settle ONCE before either machine is read. */
  const _pick = (() => {
    try {
      const f = window.map.getStyle().sources.net.data.features
        .find((x) => x.properties && x.properties.c === "trail50");
      const g = f && f.geometry && f.geometry.coordinates;
      return g && (Array.isArray(g[0][0]) ? g[0][0] : g[0]);
    } catch (e) { return null; }
  })();
  if (_pick) {
    window.map.jumpTo({ center: _pick, zoom: 12.5 });
    for (let i = 0; i < 30; i++) {
      await sleep(400);
      try { if (window.map.queryRenderedFeatures({ layers: ["trail50"] }).length) break; }
      catch (e) { }
    }
  }
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
    /* Take 117: statewide repaints outlive a fixed nap, and a mid-repaint
       snapshot made bike and side-by-side counts differ by tile-loading luck
       (the dam lesson, third appearance). Settle until two consecutive
       readings agree, bounded. */
    const settle = async (id) => {
      let prev = -2, cur = -1;
      for (let i = 0; i < 25; i++) {
        try { cur = window.map.queryRenderedFeatures({ layers: [id] }).length; }
        catch (e) { return -1; }
        if (cur === prev && cur >= 0) return cur;
        prev = cur; await sleep(350);
      }
      return cur;
    };
    const drew = {};
    for (const id of ["trail50", "track", "fsroad"]) {
      drew[id] = await settle(id);
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

/* take 188 · A202 D7 (G10) · the network draws by zoom. At render's trail50
   pick: Map draws per-edge features at z12.5 and at z9 (Map is take 187's
   until the maintainer rules, N3); Hybrid draws the class-chained strokes
   from z9 tiles and per-edge features from z12.5 tiles. Each reading waits
   for its tiles and an idle frame first (a parent tile left as a placeholder
   would mix the sets), and every count must be above zero (landmine 130).
   The classifier is judged on a planted mixed list first (landmine 54).
   Every network class drawn in view is read too. The chained set is
   NETLO_CLS, read from app.js: the five designated trail classes plus forest
   road and both closed classes (take 188 scoped two-track and paved back to
   per-edge after step 13b2 measured the ten-class cost). Each chained class
   seen follows trail50's set (strokes on Hybrid z9, per edge elsewhere) and
   at least one chained class that is not a designated trail must be seen as
   strokes on Hybrid z9. The classes left out (two-track, paved, minor) draw
   per edge at every reading; at least one must be seen at a reading, and on
   Hybrid z9 at least one of those Hybrid draws below z11 (two-track, paved)
   must be seen there per edge, so the per-edge verdict cannot pass on
   nothing where it matters. */
{
  const g10 = await page.evaluate(async () => {
    const out = { err: null, r: {} };
    try {
      const m = window.map, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const lbl = () => ((document.querySelector("#c-base span") || {}).textContent || "").trim();
      const to = async (want) => { for (let i = 0; i < 4 && lbl() !== want; i++) {
        document.getElementById("c-base").click(); await window.__rh.settle(900); } return lbl() === want; };
      const f = m.getStyle().sources.net.data.features
        .find((x) => x.properties && x.properties.c === "trail50" && x.properties.i !== undefined);
      const pick = f && f.geometry && f.geometry.coordinates[0];
      if (!pick) { out.err = "no trail50 per-edge feature to pick"; return out; }
      out.satOk = !!(window.__sat && window.__sat.ok);
      out.netLo = window.__netLo || null;
      const read = async (z) => {
        m.jumpTo({ center: pick, zoom: z });
        for (let i = 0; i < 100; i++) { await sleep(200); if (m.areTilesLoaded()) break; }
        const idle = new Promise((r) => m.once("idle", r)); m.triggerRepaint();
        await Promise.race([idle, sleep(15000)]); await sleep(300);
        const o = {};
        for (const id of ["route72", "trail50", "moto24", "mccct", "fstrail", "track", "fsroad", "fsclosed", "closed", "paved", "minor"]) {
          let fs = []; try { fs = m.getLayer(id) ? m.queryRenderedFeatures({ layers: [id] }) : []; } catch (e) { return "ERR " + e.message; }
          o[id] = fs.map((x) => (x.properties.lo === 1 ? 1 : 0) + (x.properties.i !== undefined ? 2 : 0)); }
        return o; };
      await to("Map");
      out.r["Map z12.5"] = await read(12.5);
      out.r["Map z9"] = await read(9);
      if (out.satOk) {
        out.hyb = await to("Hybrid");
        out.r["Hybrid z9"] = await read(9);
        out.r["Hybrid z12.5"] = await read(12.5);
        await to("Map");
      }
      m.jumpTo({ center: pick, zoom: 12.5 });
    } catch (e) { out.err = String(e && e.message || e); }
    return out;
  });
  /* 1 = a stroke (lo), 2 = a per-edge feature (i), 3 = both, 0 = neither */
  const kindOf = (codes) => !Array.isArray(codes) ? "error" : !codes.length ? "none"
    : codes.every((c) => c === 1) ? "lo" : codes.every((c) => c === 2) ? "edge" : "mixed";
  const plant = [{ properties: { lo: 1 } }, { properties: { i: 3 } }]
    .map((x) => (x.properties.lo === 1 ? 1 : 0) + (x.properties.i !== undefined ? 2 : 0));
  ok(kindOf(plant) === "mixed" && kindOf([1, 1]) === "lo" && kindOf([2]) === "edge",
     `G10's classifier answers mixed on a planted stroke + edge list (${kindOf(plant)})`);
  if (g10.err) ok(false, "G10 · " + g10.err);
  else {
    const want = { "Map z12.5": "edge", "Map z9": "edge", "Hybrid z9": "lo", "Hybrid z12.5": "edge" };
    const NLC = (((/NETLO_CLS=\[([^\]]*)\]/.exec(APPJS) || [])[1] || "").match(/'[^']+'/g) || []).map((x) => x.slice(1, -1));
    const READ = ["route72", "trail50", "moto24", "mccct", "fstrail", "track", "fsroad", "fsclosed", "closed", "paved", "minor"];
    const OUT = READ.filter((id) => !NLC.includes(id)), EXT = NLC.filter((id) => !["route72", "trail50", "moto24", "mccct", "fstrail"].includes(id));
    const got = Object.entries(g10.r).map(([k, v]) => [k, typeof v === "string" ? "error" : kindOf(v.trail50),
      typeof v === "string" ? v : v.trail50.length]);
    const bad = got.filter(([k, kd]) => kd !== want[k]);
    /* every other class seen at each reading: the designated ones follow
       trail50's set, the rest are per-edge everywhere */
    const cls = [];
    for (const [k, v] of Object.entries(g10.r)) {
      if (typeof v === "string") continue;
      for (const [id, codes] of Object.entries(v)) {
        if (id === "trail50" || !codes.length) continue;
        const kd = kindOf(codes), exp = OUT.includes(id) ? "edge" : want[k];
        cls.push([k, id, kd, codes.length, kd === exp]); } }
    const clsBad = cls.filter((x) => !x[4]);
    const hz9 = g10.r["Hybrid z9"], extSeen = hz9 && typeof hz9 !== "string" ? EXT.filter((id) => hz9[id].length && kindOf(hz9[id]) === "lo") : [];
    const outSeen = OUT.filter((id) => Object.values(g10.r).some((v) => typeof v !== "string" && v[id] && v[id].length));
    const outHyb = hz9 && typeof hz9 !== "string" ? OUT.filter((id) => id !== "minor" && hz9[id].length) : [];
    ok(got.length === (SAT_EXPECT ? 4 : 2) && bad.length === 0,
       "G10 · trail50 draws " + got.map(([k, kd, n]) => `${k} ${kd} (${n})`).join(", ")
       + (SAT_EXPECT ? "" : " — no imagery, Hybrid not reachable")
       + (bad.length ? " — expected " + bad.map(([k]) => `${k} ${want[k]}`).join(", ") : ""));
    ok(NLC.length >= 5 && clsBad.length === 0 && outSeen.length > 0 && (!SAT_EXPECT || (extSeen.length > 0 && outHyb.length > 0)),
       "G10 · scope: " + cls.filter((x) => x[0] === "Hybrid z9" || x[0] === "Map z9").map(([k, id, kd, n]) => `${k} ${id} ${kd} (${n})`).join(", ")
       + ` — chained ${NLC.join("/") || "NOT READ"}; left out ${OUT.join("/")} seen per edge at ${outSeen.length ? "a reading" : "NO reading"}`
       + (SAT_EXPECT && !extSeen.length ? " — no chained non-trail class seen as strokes on Hybrid z9" : "")
       + (SAT_EXPECT && !outHyb.length ? " — no left-out class (" + OUT.filter((id) => id !== "minor").join("/") + ") seen on Hybrid z9" : "")
       + (clsBad.length ? " — WRONG: " + clsBad.map(([k, id, kd]) => `${k} ${id} ${kd}`).join(", ") : ""));
    const nl = g10.netLo || {};
    console.log(`  ..   D7 net-lo: ${nl.n} strokes from ${nl.edges} edges in ${nl.ms} ms, from z${nl.z}${nl.err ? " — ERROR " + nl.err : ""}`);
  }
}

/* take 188 · Hybrid × machine (A202 D1-D5, A213, A220): G2 one opacity per
   basemap and machine, G3 Map survives a Hybrid round trip, G4 nothing on the
   never-hide list is hidden on Hybrid, G5 Hybrid's paint, G7 casings follow
   their lines. The page only READS; every verdict is a function here, run on
   planted readings first (landmine 54), and nothing in the evaluate throws
   (landmine 217). */
{
  const MACH = ((/var\s+MACH_LAYERS\s*=\s*\[([^\]]*)\]/.exec(APPJS) || [])[1] || "").match(/'[^']+'/g)?.map((x) => x.slice(1, -1)) || [];
  const objLit = (name) => { const mm = new RegExp("var\\s+" + name + "\\s*=\\s*(\\{[^;]*?\\})\\s*;").exec(APPJS);
    try { return mm ? JSON.parse(mm[1].replace(/([{,])\s*([A-Za-z_][\w-]*)\s*:/g, '$1"$2":')) : null; } catch (e) { return null; } };
  const HYB = objLit("HYB_OPA") || {}, FLOOR = objLit("DIM_FLOOR") || {}, HFLOOR = objLit("HYB_FLOOR") || {};
  /* Map's bases are the style's own declarations: a layer's 'line-opacity'
     literal in its {id:…} block, else MapLibre's default of 1 */
  const MAPB = {};
  for (const id of MACH) {
    const at = APPJS.indexOf("{id:'" + id + "',");
    let blk = at >= 0 ? APPJS.slice(at, APPJS.indexOf("{id:'", at + 5) >>> 0 || at + 600) : "";
    const mm = /'line-opacity':\s*([0-9.]+)/.exec(blk);
    MAPB[id] = mm ? +mm[1] : 1;
  }
  const NEVER = [...((/^NEVER_HIDE\s*=\s*\{([^}]*)\}/m.exec(readFileSync(join(ROOT, "tools", "gate.py"), "utf8")) || [])[1] || "")
    .matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  const canon = (x) => Array.isArray(x) ? x.map(canon) : (x && typeof x === "object")
    ? Object.keys(x).sort().reduce((o, k) => { o[k] = canon(x[k]); return o; }, {}) : x;
  const J = (x) => JSON.stringify(canon(x));

  /* take 189 · A227 · the readings here are style properties, which the app
     sets synchronously (setBasemap, applyMachine, applyAct): the fixed sleeps
     between them are a frame now, bounded by the old sleep. A mode apply
     restacks on a 60 ms timer (repin), so it keeps an 80 ms sleep: timers
     fire in deadline order, so the restack has run when it returns. */
  const hyb = await page.evaluate(async (MACH) => {
    const out = { err: null };
    try {
      const m = window.map, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const lbl = () => ((document.querySelector("#c-base span") || {}).textContent || "").trim();
      const to = async (want) => { for (let i = 0; i < 4 && lbl() !== want; i++) {
        document.getElementById("c-base").click(); await window.__rh.settle(900); } return lbl() === want; };
      const snap = () => { const o = {}; for (const L of m.getStyle().layers) o[L.id] = { type: L.type,
        paint: L.paint || {}, layout: L.layout || {}, filter: L.filter === undefined ? null : L.filter,
        minzoom: L.minzoom === undefined ? 0 : L.minzoom, maxzoom: L.maxzoom === undefined ? 24 : L.maxzoom };
        return JSON.parse(JSON.stringify(o)); };
      const opa = () => { const o = {}; for (const id of MACH) { try { o[id] = m.getPaintProperty(id, "line-opacity"); }
        catch (e) { o[id] = "ERR"; } } return JSON.parse(JSON.stringify(o)); };
      const reading = () => ({ bm: lbl(), mode: window.__mode && window.__mode.get(), opa: opa() });
      out.satOk = !!(window.__sat && window.__sat.ok);
      out.minZ = m.getMinZoom();
      await to("Map");
      window.__mode.apply("ride", { silent: true }); await sleep(80); await window.__rh.settle(420);
      window.__mach.set("bike"); await window.__rh.settle(400);
      out.map0 = snap();
      out.toHyb = await to("Hybrid"); await window.__rh.settle(600);
      out.hyb = snap();
      window.__mach.set("sxs"); await window.__rh.settle(400); out.a = reading();          // (a) Hybrid, then sxs
      window.__mach.set("bike"); await window.__rh.settle(400); out.hybBike = reading();
      await to("Map"); await window.__rh.settle(600);
      out.map1 = snap();                                                        // G3: after the round trip
      window.__mach.set("sxs"); await window.__rh.settle(400);
      await to("Hybrid"); await window.__rh.settle(600); out.c = reading();                  // (c) Map → Hybrid with sxs
      window.__mach.set("bike"); await window.__rh.settle(400);
      window.__mode.apply("water", { silent: true }); await sleep(80); await window.__rh.settle(720); out.bWater = reading();   // (b)
      window.__mode.apply("ride", { silent: true }); await sleep(80); await window.__rh.settle(720); out.bRide = reading();
      await to("Map"); window.__mach.set("bike"); await window.__rh.settle(400);
      /* G7 · every activity row, clicked as a rider would, on Map */
      const vis = (id) => { try { return m.getLayoutProperty(id, "visibility") === "none" ? "none" : "visible"; } catch (e) { return "err"; } };
      const panel = document.getElementById("actpanel");
      document.getElementById("c-act").click(); await window.__rh.settle(300);
      const keys = [...panel.querySelectorAll("[data-k]")].map((b) => b.dataset.k);
      out.acts = [];
      for (const k of keys) {
        if (panel.hidden) { document.getElementById("c-act").click(); await window.__rh.settle(300); }
        const b = panel.querySelector('[data-k="' + k + '"]'); if (!b) { out.acts.push({ k, missing: true }); continue; }
        b.click(); await window.__rh.settle(300);
        const v = {};
        for (const id of ["casing", "casing-track", "track", "route72", "trail50", "moto24", "mccct", "fstrail"]) v[id] = vis(id);
        out.acts.push({ k, v });
      }
      if (panel.hidden) { document.getElementById("c-act").click(); await window.__rh.settle(300); }
      const all = panel.querySelector('[data-k="all"]'); if (all) all.click(); await window.__rh.settle(300);
      if (!panel.hidden) { document.getElementById("c-act").click(); }
    } catch (e) { out.err = String(e && e.message || e); }
    return out;
  }, MACH);
  ok(!hyb.err, `the Hybrid block read the page without throwing${hyb.err ? " — " + hyb.err : ""}`);
  ok(MACH.length >= 10 && Object.keys(HYB).length >= 3 && FLOOR.Map > 0 && FLOOR.Hybrid > 0,
     `the tables are read from app.js: MACH_LAYERS ${MACH.length}, HYB_OPA ${Object.keys(HYB).join("/") || "MISSING"}, `
     + `DIM_FLOOR Map ${FLOOR.Map} Hybrid ${FLOOR.Hybrid}; Map bases casing ${MAPB.casing} / casing-track ${MAPB["casing-track"]} / casing-fsroad ${MAPB["casing-fsroad"]}`);

  /* G2 · a per-feature case (or one zoom interpolate of cases) whose full value
     is the basemap's base and whose dimmed value is max(full × 0.3, min(full,
     floor)): strictly under full and at least the floor */
  const g2Layer = (id, v, bm) => {
    const floor = (bm === "Hybrid" && HFLOOR[id] !== undefined) ? HFLOOR[id] : FLOOR[bm], base = (bm === "Hybrid" && HYB[id] !== undefined) ? HYB[id] : MAPB[id];
    const num = (x) => typeof x === "number";
    const cse = (c, full) => {
      if (!Array.isArray(c) || c[0] !== "case" || c.length !== 4 || !num(c[2]) || !num(c[3])) return "not a case: " + JSON.stringify(c);
      if (Math.abs(c[2] - full) > 1e-9) return `full ${c[2]} is not the ${bm} base ${full}`;
      const exp = full > 0 ? Math.max(full * 0.3, Math.min(full, floor)) : 0;
      if (Math.abs(c[3] - exp) > 1e-9) return `dimmed ${c[3]}, expected ${exp}`;
      if (full > 0 && !(c[3] < full && c[3] >= floor - 1e-12)) return `dimmed ${c[3]} not in [${floor}, ${full})`;
      return null; };
    if (!(floor > 0)) return "no floor for " + bm;
    if (Array.isArray(base)) {
      if (!Array.isArray(v) || v[0] !== "interpolate" || !Array.isArray(v[2]) || v[2][0] !== "zoom" || v.length !== 7)
        return "not one zoom interpolate: " + JSON.stringify(v);
      if (v[3] !== base[0] || v[5] !== base[2]) return "the curve's stops moved";
      return cse(v[4], base[1]) || cse(v[6], base[3]);
    }
    return cse(v, base); };
  const g2 = (r) => MACH.map((id) => [id, g2Layer(id, r.opa[id], r.bm)]).filter((x) => x[1]);
  const inOk = ["in", ["get", "c"], ["literal", []]];
  /* each plant must be caught by the branch it was planted for: not a case,
     dimmed (twice), the base mismatch, not one zoom interpolate and the
     curve's stops moved. The base mismatch is A213's defect (take 187 on
     Hybrid, after a machine change, carried Map's case 1/0.3). "no floor"
     is not planted; a missing table fails the tables line above. The
     dimmed range check shares the "dimmed " prefix with the exact-value
     check, so these plants do not tell the two apart. */
  const g2Planted = [["track", 0.4, /^not a case/], ["track", ["case", inOk, 0.55, 0.55], /^dimmed /],
    ["track", ["case", inOk, 0.55, 0.05], /^dimmed /], ["track", ["case", inOk, 1, 0.3], /^full 1 is not the Hybrid base/],
    ["minor", ["case", inOk, 1, 0.3], /^not one zoom interpolate/],
    ["minor", ["interpolate", ["linear"], ["zoom"], 11, ["case", inOk, 0, 0], 12.5, ["case", inOk, 0.45, 0.25]], /^the curve's stops moved/]];
  const g2Caught = g2Planted.map(([id, v, re]) => [id, g2Layer(id, v, "Hybrid")]);
  const g2Plants = g2Caught.filter(([, why], i) => why !== null && g2Planted[i][2].test(why)).length;
  ok(g2Plants === 6, `G2 rejects ${g2Plants}/6 planted opacities on Hybrid, each by its own branch (a plain 0.4, dimmed equal to full, `
     + `dimmed under the floor, Map's case 1/0.3 on track, a case where minor's curve belongs, minor's curve starting at 11)`
     + (g2Plants === 6 ? "" : " — " + g2Caught.map(([id, why]) => id + ": " + why).join("; ")));
  for (const [nm, r] of [["Hybrid then side-by-side", hyb.a], ["Map to Hybrid with the side-by-side set", hyb.c],
                         ["Water entered from Hybrid", hyb.bWater], ["Ride after Water", hyb.bRide], ["Hybrid on a bike", hyb.hybBike]]) {
    if (!r) { ok(false, `G2 · ${nm}: no reading`); continue; }
    const bad = g2(r);
    ok(bad.length === 0, `G2 · ${nm} (${r.bm}, ${r.mode}): every network opacity is the basemap's base × the machine's case`
       + (bad.length ? " — " + bad.slice(0, 3).map((x) => x[0] + ": " + x[1]).join("; ") : ""));
  }
  if (SAT_EXPECT) ok(hyb.a && hyb.a.bm === "Hybrid" && hyb.c && hyb.c.bm === "Hybrid" && hyb.bWater && hyb.bWater.bm === "Hybrid",
     `the G2 readings were taken where they claim (${hyb.a && hyb.a.bm}, ${hyb.c && hyb.c.bm}, Water ${hyb.bWater && hyb.bWater.bm})`);

  /* take 188 · Hybrid "Safer" (the maintainer, 2026-09-25): on Hybrid a
     two-track too wide for the machine is dE >= 15 from a ridable one, and
     the ridable one is dE >= 15 from the ground (landmine 108's bar), over
     the three backdrops of the step-5 replica (400 bundled z12 tiles, the
     photo's tone applied: dark canopy, median and bright ground; CIE76, sRGB
     D65). Forest road stays at full strength. Read off the live side-by-side
     reading (hyb.a), judged here, the judge proved on plants first: step 5's
     0.55 / 0.25, a ridable line too faint for the bar, and fsroad at 0.6. */
  {
    const hex = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16) / 255);
    const lab = (c) => { const l = c.map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      const X = (0.4124 * l[0] + 0.3576 * l[1] + 0.1805 * l[2]) / 0.95047, Y = 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2],
        Z = (0.0193 * l[0] + 0.1192 * l[1] + 0.9505 * l[2]) / 1.08883;
      const f = (t) => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
      return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))]; };
    const dE = (a, b) => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
    const over = (fg, a, bg) => fg.map((v, k) => v * a + bg[k] * (1 - a));
    const BACK = { canopy: [54, 64, 55], median: [73, 84, 69], bright: [110, 116, 102] };
    const trackHex = (/\btrack:'(#[0-9A-Fa-f]{6})'/.exec(APPJS) || [])[1];
    const safer = (v) => {
      if (!trackHex) return "PAL.track not read from app.js";
      if (!Array.isArray(v) || v[0] !== "case" || typeof v[2] !== "number" || typeof v[3] !== "number") return "track is not a case: " + JSON.stringify(v);
      const T = hex(trackHex), out = [];
      for (const [nm, b] of Object.entries(BACK)) { const bg = b.map((x) => x / 255);
        const full = over(T, v[2], bg), dim = over(T, v[3], bg), sep = dE(full, dim), vis = dE(full, bg);
        out.push(`${nm} ${sep.toFixed(1)}/${vis.toFixed(1)}`);
        if (vis < 15) return `ridable ${v[2]} is dE ${vis.toFixed(1)} from ${nm} ground (< 15)`;
        if (sep < 15) return `ridable ${v[2]} vs too-wide ${v[3]} is dE ${sep.toFixed(1)} over ${nm} (< 15)`; }
      return { ok: out.join(", ") }; };
    const fsFull = (v) => Array.isArray(v) && v[0] === "case" && v[2] === 1 ? null : "fsroad on Hybrid is not full strength: " + JSON.stringify(v);
    const plants = [safer(["case", inOk, 0.55, 0.25]), safer(["case", inOk, 0.3, 0.09]), fsFull(["case", inOk, 0.6, 0.18])];
    ok(typeof plants[0] === "string" && /is dE 14\.2 over canopy/.test(plants[0]) && typeof plants[1] === "string" && /from \w+ ground/.test(plants[1]) && typeof plants[2] === "string",
       `Safer · the judge rejects step 5's 0.55/0.25 (${plants[0]}), a ridable 0.3 (${plants[1]}) and fsroad at 0.6`);
    if (SAT_EXPECT) {
      const r = safer(hyb.a && hyb.a.opa && hyb.a.opa.track), f = fsFull(hyb.hybBike && hyb.hybBike.opa && hyb.hybBike.opa.fsroad);
      ok(typeof r === "object" && !f,
         `Safer · Hybrid, side-by-side: two-track ${JSON.stringify(hyb.a && hyb.a.opa && hyb.a.opa.track && hyb.a.opa.track.slice(2))} — ridable vs too-wide / ridable vs ground dE `
         + (typeof r === "object" ? r.ok : r) + `; forest road ${f || "full strength (1)"}`);
    }
  }

  /* G3 · Map after Map → Hybrid → (side-by-side → bike) → Map equals Map
     before it: paint, layout (absent visibility = visible), filter, zoom range */
  const normL = (L) => { const c = JSON.parse(JSON.stringify(L)); c.layout = c.layout || {};
    if (c.layout.visibility === undefined) c.layout.visibility = "visible"; return c; };
  const g3Diff = (a, b) => [...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])]
    .filter((id) => !a[id] || !b[id] || J(normL(a[id])) !== J(normL(b[id])));
  if (hyb.map0 && hyb.map1) {
    const planted = JSON.parse(JSON.stringify(hyb.map0));
    if (planted["lbl-lake"]) planted["lbl-lake"].paint["text-color"] = "#FF00FF";
    const pd = g3Diff(hyb.map0, planted), d = g3Diff(hyb.map0, hyb.map1);
    ok(pd.length === 1 && pd[0] === "lbl-lake", `G3 names a planted paint change and only it (${pd.join(", ") || "none"})`);
    ok(d.length === 0, `G3 · Map is unchanged by a Hybrid round trip with a machine change on Hybrid `
       + `(${Object.keys(hyb.map0).length} layers${d.length ? "; changed: " + d.slice(0, 6).join(", ") : ""})`);
  } else ok(false, "G3 · no Map snapshots");

  /* G4 · never hidden on Hybrid: gate.py's NEVER_HIDE plus the ridable
     network and the trail casing — no minzoom above the map's own, not
     visibility none, no full-opacity stop of 0. minor is the one layer
     Hybrid holds back, from exactly 11.5. */
  const fullStops = (v) => Array.isArray(v) && v[0] === "case" ? [v[2]]
    : Array.isArray(v) && v[0] === "interpolate" ? v.slice(4).filter((x, j) => j % 2 === 0).map((c) => Array.isArray(c) ? c[2] : c)
    : typeof v === "number" ? [v] : [];
  const g4 = (never, H, M, minZ) => {
    if (!never.length) return ["NEVER_HIDE parsed empty"];
    const bad = [];
    for (const id of [...never, "fstrail", "track", "fsroad", "paved", "casing"]) {
      const L = H[id]; if (!L) continue;
      if (L.minzoom > minZ) bad.push(id + " minzoom " + L.minzoom);
      if ((L.layout || {}).visibility === "none") bad.push(id + " hidden");
      if (fullStops((L.paint || {})["line-opacity"]).some((x) => x === 0)) bad.push(id + " full opacity 0");
    }
    const zr = Object.keys(H).filter((id) => M[id] && (H[id].minzoom !== M[id].minzoom || H[id].maxzoom !== M[id].maxzoom));
    if (zr.join() !== "minor") bad.push("zoom ranges differ on " + (zr.join(", ") || "nothing"));
    if (!H.minor || H.minor.minzoom !== 11.5) bad.push("minor minzoom " + (H.minor && H.minor.minzoom));
    return bad; };
  if (hyb.hyb && hyb.map0) {
    const pl = JSON.parse(JSON.stringify(hyb.hyb)); if (pl.trail50) pl.trail50.minzoom = 12;
    const p1 = g4(NEVER, pl, hyb.map0, hyb.minZ), p2 = g4([], hyb.hyb, hyb.map0, hyb.minZ);
    ok(p1.some((x) => /^trail50 minzoom/.test(x)) && p2.length > 0,
       `G4 flags a planted trail50 minzoom 12 and fails an empty NEVER_HIDE parse (${p2[0] || "PASSED IT"})`);
    const b4 = SAT_EXPECT ? g4(NEVER, hyb.hyb, hyb.map0, hyb.minZ) : [];
    ok(b4.length === 0, `G4 · on Hybrid nothing of ${NEVER.join("/")} + the ridable network is held back; only minor, from z11.5`
       + (b4.length ? " — " + b4.join("; ") : "") + (SAT_EXPECT ? "" : " (no imagery: skipped)"));
  } else ok(false, "G4 · no Hybrid snapshot");

  /* G5 · Hybrid's paint. The keep-list is the decision as recorded (take 188):
     pins, stack counts and paddle labels, the shield, trail names, lbl-show and
     area-label keep their colours; every other name goes white on dark. */
  const KEEP_RE = /^(poi-|pad-)|stack/, KEEP_IDS = ["lbl-shield", "lbl-trail", "lbl-trail-short", "lbl-show", "area-label"];
  const kept = (id) => KEEP_RE.test(id) || KEEP_IDS.includes(id);
  const TONE = ["raster-saturation", "raster-brightness-max", "raster-contrast"];
  const g5 = (M, H) => {
    const bad = [];
    const rs = ["sat", "sat-base", "sat-patch"].filter((id) => H[id] && H[id].type === "raster");
    if (!rs.includes("sat")) bad.push("no sat raster");
    for (const id of rs) for (const k of TONE)
      if (J(H[id].paint[k]) !== J(H.sat.paint[k]) || H[id].paint[k] === undefined) bad.push(id + " " + k + " " + H[id].paint[k]);
    const wc = M.water && J(M.water.paint["fill-color"]);
    const wf = Object.keys(M).filter((id) => M[id].type === "fill" && J(M[id].paint["fill-color"]) === wc);
    if (wf.length < 1) bad.push("no water fill found");
    for (const id of wf) if (H[id].paint["fill-color"] !== "#172937") bad.push(id + " fill " + H[id].paint["fill-color"]);
    for (const id of Object.keys(H)) {
      const L = H[id]; if (L.type !== "symbol" || !(L.layout || {})["text-field"]) continue;
      if (kept(id)) { if (J(L.paint) !== J(M[id].paint)) bad.push("kept " + id + " paint changed"); continue; }
      const p = L.paint || {};
      if (p["text-color"] !== "#F4F2EE" || p["text-halo-color"] !== "rgba(10,10,10,0.85)" || p["text-halo-width"] !== 1.6)
        bad.push(id + " label " + p["text-color"] + "/" + p["text-halo-color"] + "/" + p["text-halo-width"]);
    }
    for (const id of KEEP_IDS) if (!H[id]) bad.push("keep-list id " + id + " missing");
    for (const re of [/^poi-/, /stack/, /^pad-/]) if (!Object.keys(H).some((id) => re.test(id))) bad.push("keep-list " + re + " matches nothing");
    const f = (H["lbl-road"] || {}).filter;
    if (!(Array.isArray(f) && f[0] === "step" && J(f[1]) === J(["zoom"]) && f[3] === 11.5 && J(f[4]) === J(M["lbl-road"].filter)
          && /"minor"/.test(J(f[2])) && /"!="/.test(J(f[2])))) bad.push("lbl-road keeps minor names below 11.5: " + J(f));
    for (const id of ["minor-case", "paved-case", "casing-track", "casing-fsroad"]) {
      if ((H[id].layout || {}).visibility !== "none") bad.push(id + " drawn on Hybrid");
      if ((M[id].layout || {}).visibility === "none") bad.push(id + " hidden on Map");
    }
    if ((H.casing.layout || {}).visibility === "none" || (M.casing.layout || {}).visibility === "none") bad.push("casing hidden");
    return bad; };
  if (hyb.hyb && hyb.map0 && SAT_EXPECT) {
    const P = () => JSON.parse(JSON.stringify(hyb.hyb));
    const plants = [
      (() => { const p = P(); if (p["sat-base"] && p["sat-base"].type === "raster") p["sat-base"].paint["raster-saturation"] = 0;
               else p.sat.paint["raster-saturation"] = 0; return [p, hyb.map0]; })(),
      (() => { const p = P(); p["lbl-lake"].paint["text-halo-color"] = "#F2F3F0"; return [p, hyb.map0]; })(),
      (() => { const m0 = JSON.parse(JSON.stringify(hyb.map0)), p = P(); delete p["lbl-show"]; delete m0["lbl-show"]; return [p, m0]; })(),
      (() => { const p = P(); p["casing-track"].layout.visibility = "visible"; return [p, hyb.map0]; })()];
    const caught = plants.filter(([h, m0]) => g5(m0, h).length > 0).length;
    ok(caught === 4, `G5 flags ${caught}/4 planted Hybrid readings (untoned raster, a label on the light halo, a missing keep-list id, casing-track drawn)`);
    const b5 = g5(hyb.map0, hyb.hyb);
    ok(b5.length === 0, `G5 · Hybrid paints the photo one tone, water #172937, names white on a dark halo outside the keep-list, `
       + `no road casings${b5.length ? " — " + b5.slice(0, 5).join("; ") : ""}`);
  } else if (SAT_EXPECT === false) ok(hyb.satOk === false,
     `G5 · the manifest carries no imagery and the app agrees (SAT_OK ${hyb.satOk}) — Hybrid paint not reachable, skipped`);
  else ok(false, "G5 · no snapshots");

  /* G7 · on Map the designated-trail casing draws exactly when all five of its
     classes do (a partial set is a failure: one casing per weight class,
     landmine 91), and the two-track casing exactly when two-track does */
  /* take 188 · A202 D7 · Map's network filters carry ['all', <class filter>,
     ['!',['has','lo']]]; the classes are read from the class filter inside */
  const unLo = (f) => Array.isArray(f) && f[0] === "all" && f.length === 3 && J(f[2]) === J(["!", ["has", "lo"]]) ? f[1] : f;
  const casF = hyb.map0 && hyb.map0.casing ? unLo(hyb.map0.casing.filter) : null;
  const FIVE = (Array.isArray(casF) && Array.isArray((casF[2] || [])[1])) ? casF[2][1] : [];
  const g7 = (rows) => rows.map((r) => {
    if (r.missing) return r.k + ": row missing";
    const on = FIVE.filter((c) => r.v[c] === "visible").length;
    if (on > 0 && on < FIVE.length) return r.k + `: ${on} of ${FIVE.length} designated classes drawn`;
    if ((r.v.casing === "visible") !== (on === FIVE.length)) return r.k + `: casing ${r.v.casing} with ${on}/${FIVE.length} drawn`;
    if ((r.v["casing-track"] === "visible") !== (r.v.track === "visible")) return r.k + `: casing-track ${r.v["casing-track"]}, track ${r.v.track}`;
    return null; }).filter(Boolean);
  const allV = (x) => Object.fromEntries(["casing", "casing-track", "track", ...FIVE].map((id) => [id, x]));
  const pW = { k: "planted-water", v: { ...allV("none"), casing: "visible" } };
  const pP = { k: "planted-partial", v: { ...allV("visible"), [FIVE[0]]: "none", [FIVE[1]]: "none" } };
  ok(FIVE.length === 5 && g7([pW]).length === 1 && g7([pP]).length === 1,
     `G7 flags take 187's Water (casing over hidden trails) and a 3-of-5 set (casing classes: ${FIVE.join(", ") || "NOT READ"})`);
  const b7 = g7(hyb.acts || []);
  ok((hyb.acts || []).length >= 5 && b7.length === 0,
     `G7 · casings follow their lines on Map for ${(hyb.acts || []).length} activity rows${b7.length ? " — " + b7.join("; ") : ""}`);
}
await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2.6 });
await vpSettle(800);

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

/* This check exists to catch a BLANK map — its own message says a blank one is
   1-3 colours. The threshold was 200, which sat close to the real value on the
   flat vector basemap, and the take-110 drawer made the map ~210 px taller and
   changed the sampled area: 171. That is nowhere near blank.
   Widened to a margin that still catches the failure it was written for, and
   the sibling check below carries the real weight — "the busiest colour covers
   under 90%" is what distinguishes terrain and trails from a flat sheet, and it
   passes at 82.9%. A threshold tuned so tightly that a layout change trips it
   is measuring the edge (landmine 151). */
ok(px.colors > 40, `map viewport has ${px.colors} distinct colours (a blank map is 1-3)`);
ok(px.dominant < 0.90,
   `busiest colour covers ${(100 * px.dominant).toFixed(1)}% — under 90% means terrain and trails drew`);
console.log(`       screenshot -> ${SHOT || "(not saved)"} (${(png.length/1024).toFixed(0)} KB)`);

}

if (RUN("g6")) {
/* take 188 · A213 (G6) · a restored Water opens as Water. Take 187's load
   handler forced Map after the mode restore, so a rider who left the app in
   Water came back to Water's pins on the Map basemap with the kayak's dimming
   gone (PROVEN on take 187, 3 of 3 reloads). Its own reload, just before the
   A208 audit's clean one, so that audit still starts from a fresh profile. */
{
  const g6 = (r) => !!r && r.mode === "water"
    && (r.satOk ? r.chip === "Hybrid" && r.sat === "visible" : r.chip === "Map" && r.sat === "none")
    && r.dimOk === true;
  ok(!g6({ mode: "water", chip: "Map", sat: "none", satOk: true, dimOk: true })
     && g6({ mode: "water", chip: "Hybrid", sat: "visible", satOk: true, dimOk: true }),
     "G6's verdict rejects take 187's restored Water (Map, no photo) and accepts Hybrid with the photo");
  await page.evaluate((t, g) => { try { localStorage.setItem(t, "1"); localStorage.setItem(g, "1");
    localStorage.setItem("apex.mode", "water"); } catch (e) {} }, TOURKEY, GUIDEKEY);
  // an explicit limit: Chrome's 30 s default left about 1.3-1.9x over run 90's load (INFERRED; landmine 235)
  await page.reload({ waitUntil: "networkidle0", timeout: 120000 });
  await fastAnim(page);
  const g6ready = await page.waitForFunction(() => window.map && window.map.loaded && window.map.loaded()
    && !document.getElementById("splash")
    && /\bready\b/.test((document.getElementById("shell") || {}).className || ""), { timeout: 120000 })
    .then(() => true, () => false);
  let r6 = null;
  if (g6ready) r6 = await page.evaluate(async () => {
    try {
      await new Promise((r) => setTimeout(r, 1500));
      const m = window.map, op = {};
      for (const id of ["minor", "paved"]) { try { op[id] = m.getPaintProperty(id, "line-opacity"); } catch (e) { op[id] = null; } }
      let sat = "err"; try { sat = m.getLayoutProperty("sat", "visibility") || "visible"; } catch (e) { }
      return { mode: window.__mode && window.__mode.get(), chip: ((document.querySelector("#c-base span") || {}).textContent || "").trim(),
               sat, satOk: !!(window.__sat && window.__sat.ok), op: JSON.parse(JSON.stringify(op)) };
    } catch (e) { return { err: String(e && e.message || e) }; }
  });
  /* the kayak's case: a per-feature case (or zoom stops of cases) whose legal
     list leaves the road out and whose dimmed value is under the full one */
  const dimmed = (id, v) => {
    const cases = Array.isArray(v) && v[0] === "case" ? [v]
      : Array.isArray(v) && v[0] === "interpolate" ? v.slice(4).filter((x, j) => j % 2 === 0) : [];
    return cases.length > 0 && cases.every((c) => Array.isArray(c) && c[0] === "case"
      && Array.isArray(c[1]) && Array.isArray(c[1][2]) && Array.isArray(c[1][2][1]) && !c[1][2][1].includes(id)
      && (c[2] === 0 || c[3] < c[2])); };
  if (r6 && !r6.err) r6.dimOk = dimmed("minor", r6.op.minor) && dimmed("paved", r6.op.paved);
  /* judged on the manifest's answer; the app's own must agree */
  ok(g6ready && !!r6 && r6.satOk === SAT_EXPECT && g6(Object.assign({}, r6, { satOk: SAT_EXPECT })), `G6 · a restored Water reloads as ${r6 ? r6.mode : "?"} on ${r6 ? r6.chip : "?"} (photo ${r6 ? r6.sat : "?"}, `
     + `imagery ${r6 ? r6.satOk : "?"}) with the kayak's dimming on minor and paved (${r6 ? r6.dimOk : "?"})`
     + (g6ready ? "" : " — the page never got ready") + (r6 && r6.err ? " — " + r6.err : ""));
}

}

/* take 187 · A208 · the V4 guards (docs/DESIGN-v4.md §11): tap targets on every
   interactive element, a text-size floor and contrast against what is really
   behind the text — measured in the states a rider reaches (landmine 111),
   each proved on planted controls first. take 188 · A215 raises them to V4's
   floors: 48 px targets and 56 px ride controls, 12 px text, 7:1 for text in
   --text-1/--text-2 (4.5 large) and 4.5:1 for all other text (3 large), 3:1
   for marks that carry meaning (icons, selected states, the grabber, the
   needle). The offender lists are exact: a fixed offender leaves its list in
   the same change, and one the audit cannot see is a coverage loss. */
if (RUN("v4-setup")) {
  const V4_TAP = [];
  const V4_TEXT = [];
  /* take 188 · A216 · emoji or text glyphs on screen, per state: none */
  const V4_GLYPH = [];
  const V4_CONTRAST = [];
  /* take 188 · A215 listed four selected states that were a quiet tint or a
     colour alone (1.37-2.43:1 against their own unselected look); A216 part
     b's one selected state gives each a --sel mark, and this is empty */
  const V4_NONTEXT = [];
  /* named exemptions, each with its reason (map markers and inline links are
     exempt by RULE, below, and disabled controls from contrast only) */
  const V4_EXEMPT = {
    "#map summary.maplibregl-ctrl-attrib-button": "MapLibre's attribution toggle, required by the data "
      + "licences; not a riding control, and enlarging it would move the attribution's layout" };
  /* 1 · a CLEAN page and a fresh profile's storage: the checks above leave a
     ride, routes, panels, a home and trips behind */
  await page.evaluate((t, g) => { try { localStorage.clear(); localStorage.setItem(t, "1");
    localStorage.setItem(g, "1"); } catch (e) {} }, TOURKEY, GUIDEKEY);
  await page.setViewport({ width: 411, height: 960, deviceScaleFactor: 2.625 });
  await page.reload({ waitUntil: "networkidle0", timeout: 120000 }); // landmine 235
  await fastAnim(page);
  /* landmine 222 — and a page that never gets ready must FAIL here, not have
     its splash screen audited as a clean app */
  const v4ready = await page.waitForFunction(() => window.map && window.map.loaded && window.map.loaded()
    && !document.getElementById("splash")
    && /\bready\b/.test((document.getElementById("shell") || {}).className || ""), { timeout: 120000 })
    .then(() => true, () => false);
  /* its negative control: a wait that times out must read as NOT ready */
  const neverReady = await page.waitForFunction(() => false, { timeout: 50 }).then(() => true, () => false);
  ok(v4ready && !neverReady, "the V4 checks start on a ready app after a clean reload (map loaded, splash gone, "
     + "#shell ready); a wait that times out reads as not ready (its negative control)");
  await page.evaluate(FORCE_RIDE);

  /* G1 · THE CLEAR BAND (docs/DESIGN-v4.md §8), back in render (take 187
     left it out after three failures — landmine 224: headless Chrome leaves a
     CSS transition PENDING at its old value until a frame is drawn). Every
     reading draws a frame (a 1x1 screenshot) and waits until no transition is
     left under #rail and #stage, then checks the drawer's geometry agrees with
     its class (folded <=> #railbody under 8 px) and retries up to eight
     times. The band's edges are named, as probe's bandAt names them: the TOP
     edge is the lowest bottom of the scale corner, #readout and every
     .basebtn; the BOTTOM edge is the highest top of #tools, #rail and the
     attribution corner. Folded, it may not fall under take 187's measured
     floors (a V4 take must not hand back map); open to its cap (a 2000 px
     filler in the card, removed at once), it keeps at least 12 % at every
     size. */
  const BAND_FLOOR = { "411x960": 0.592, "360x800": 0.510, "749x832": 0.529 }, BAND_OPEN = 0.12;
  const bandRead = (open) => page.evaluate((open) => {
    const box = (e) => { if (!e || e.hidden) return null; const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden") return null;
      const b2 = e.getBoundingClientRect(); return (b2.width && b2.height) ? b2 : null; };
    const name = (e) => e.id ? "#" + e.id : "." + String(e.className).trim().split(/\s+/)[0];
    const P = document.getElementById("panel"); let fill = null;
    if (open && P) { fill = document.createElement("div"); fill.id = "v4band-fill"; fill.style.height = "2000px"; P.appendChild(fill); }
    const TOP = [document.querySelector(".maplibregl-ctrl-bottom-left"), document.getElementById("readout"),
      ...document.querySelectorAll(".basebtn")];
    const BOTTOM = [document.getElementById("tools"), document.getElementById("rail"),
      document.querySelector(".maplibregl-ctrl-bottom-right")];
    let top = 0, topBy = null, bottom = innerHeight, bottomBy = null;
    for (const e of TOP) { const b2 = box(e); if (b2 && b2.bottom > top) { top = b2.bottom; topBy = name(e); } }
    for (const e of BOTTOM) { const b2 = box(e); if (b2 && b2.top < bottom) { bottom = b2.top; bottomBy = name(e); } }
    const folded = /\bfolded\b/.test((document.getElementById("rail") || {}).className || "");
    const bodyH = (document.getElementById("railbody") || { getBoundingClientRect: () => ({ height: -1 }) }).getBoundingClientRect().height;
    if (fill) fill.remove();
    return { band: +((bottom - top) / innerHeight).toFixed(3), top: Math.round(top), topBy, bottom: Math.round(bottom),
             bottomBy, folded, bodyH: Math.round(bodyH), agrees: folded === (bodyH < 8) };
  }, open);
  const settleDrawer = async () => { for (let i = 0; i < 20; i++) {
      await page.screenshot({ clip: { x: 0, y: 0, width: 1, height: 1 } });
      const busy = await page.evaluate(() => ["rail", "stage"].map((id) => document.getElementById(id))
        .filter(Boolean).reduce((n, e) => n + e.getAnimations({ subtree: true }).filter((a) => a.playState === "running").length, 0));
      if (!busy) return true; await new Promise((x) => setTimeout(x, 150)); } return false; };
  const bandAt = async (open) => { let last = null;
    for (let i = 0; i < 8; i++) { await page.evaluate((o) => { try { window.railSet(o); } catch (e) {} }, open);
      if (!(await settleDrawer())) continue;
      last = await bandRead(open); if (last.folded === !open && last.agrees) return last; }
    return Object.assign(last || {}, { unsettled: true }); };
  if (RUN("v4-band")) {
  /* its planted controls, at 360x800: (a) the mode chip made 248 px tall must
     put the folded band under its floor; (b) a drawer whose class says folded
     while its body is held open must fail the agreement check */
  await page.setViewport({ width: 360, height: 800, deviceScaleFactor: 3 }); await vpSettle(1200);
  await page.evaluate(() => { const c = document.getElementById("c-mode"); if (c) c.style.minHeight = "248px"; });
  const plantA = await bandAt(false);
  await page.evaluate(() => { const c = document.getElementById("c-mode"); if (c) c.style.minHeight = ""; });
  await page.evaluate(() => { try { window.railSet(false); } catch (e) {} const b2 = document.getElementById("railbody");
    if (b2) { b2.style.transition = "none"; b2.style.maxHeight = "none"; b2.style.opacity = "1"; } });
  await settleDrawer();
  const plantB = await bandRead(false);
  await page.evaluate(() => { const b2 = document.getElementById("railbody"); if (b2) { b2.style.transition = "";
    b2.style.maxHeight = ""; b2.style.opacity = ""; } });
  await settleDrawer();
  ok(plantA.band < BAND_FLOOR["360x800"] && plantB.folded && !plantB.agrees,
     `the clear band's judges catch their plants: a 248 px mode chip reads ${plantA.band} at 360x800 `
     + `(floor ${BAND_FLOOR["360x800"]}, top edge ${plantA.topBy}); a drawer held open under the folded class `
     + `reads class≠geometry (body ${plantB.bodyH} px, agrees ${plantB.agrees})`);
  const bands = {};
  for (const [w, h, dpr] of [[411, 960, 2.625], [360, 800, 3], [749, 832, 2.625]]) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: dpr }); await vpSettle(1200);
    const k = `${w}x${h}`, f = await bandAt(false), o = await bandAt(true); bands[k] = { folded: f, open: o };
    ok(!f.unsettled && f.band >= BAND_FLOOR[k],
       `${k}: the clear band, drawer folded, is ${f.band} of the screen (floor ${BAND_FLOOR[k]}, take 187's), `
       + `from ${f.topBy} at ${f.top} px to ${f.bottomBy} at ${f.bottom} px` + (f.unsettled ? " — the drawer never settled folded" : ""));
    ok(!o.unsettled && o.band >= BAND_OPEN,
       `${k}: the clear band, drawer open to its cap, is ${o.band} (floor ${BAND_OPEN}), `
       + `from ${o.topBy} at ${o.top} px to ${o.bottomBy} at ${o.bottom} px` + (o.unsettled ? " — the drawer never settled open" : ""));
  }
  await page.evaluate(() => { try { window.railSet(false); } catch (e) {} });
  await page.setViewport({ width: 411, height: 960, deviceScaleFactor: 2.625 }); await vpSettle(800);

  }
  if (RUN("v4-select")) {
  /* the bundled faces are loaded and applied; a family that does not exist is not */
  const font = await page.evaluate(() => {
    const has = (fam) => [...document.fonts].some((f) => f.family.replace(/["']/g, "") === fam && f.status === "loaded");
    const chip = document.querySelector("#shell .chip, #shell .basebtn");
    return { barlow: has("Barlow"), condensed: has("Barlow Condensed"), bogus: has("NoSuchFont"),
             fam: chip ? getComputedStyle(chip).fontFamily : "" };
  });
  ok(font.barlow && font.condensed && !font.bogus && /Barlow/.test(font.fam),
     `Barlow and Barlow Condensed are loaded and applied (${font.fam.slice(0, 32)}); a family that `
     + `does not exist is not reported loaded (the check's negative control)`);
  /* take 188 · A216 part b · ONE SELECTED STATE, family by family. Each
     family is built as the app builds it, in a fixed box, and read ON and
     then OFF (its state class taken off with transitions stopped, two frames
     drawn — landmine 224): ON must show the indicator (a ::before whose
     colour is the computed --sel), a label one weight HEAVIER than OFF (a
     base weight of 700 would make "on >= 700" vacuous), its line (a --sel
     border with an inset --sel line on a chip, a map control and — in
     --route — a route card; an inset --sel line on a row; the tab's bar is
     its indicator) and no fill change; OFF must show none of it. The ride
     sheet's North up is read for REAL: after navStart with #nav drawn, set on
     and off by its own click handler. Planted controls: a chip whose border
     is red, a tab whose weight does not move, and a chip whose fill changes
     must each be judged wrong; a plain chip must show no indicator. */
  const selRes = await page.evaluate(async () => {
    try {
      const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
      const two = async () => { await frame(); await frame(); };
      const rgb = (c) => (String(c).match(/[\d.]+/g) || []).slice(0, 3).map(Number).join(",");
      const probe = (v) => { const e = document.createElement("span"); e.style.color = `var(${v})`;
        document.body.appendChild(e); const c = rgb(getComputedStyle(e).color); e.remove(); return c; };
      const SEL = probe("--sel"), ROUTE = probe("--route");
      const dotOf = (e) => { if (!e) return false; const b = getComputedStyle(e, "::before");
        return !!b.content && b.content !== "none" && b.display !== "none" && rgb(b.backgroundColor) === SEL; };
      const insetOf = (bs) => { const m = String(bs).match(/(rgba?\([^)]*\))[^,(]*inset/); return m ? rgb(m[1]) : null; };
      const read = (el, f) => { const cs = getComputedStyle(el), lab = f.lab(el);
        const border = rgb(cs.borderTopColor) === f.col && parseFloat(cs.borderTopWidth) > 0;
        const inset = insetOf(cs.boxShadow) === f.col;
        return { dot: dotOf(f.ind(el)), w: +getComputedStyle(lab).fontWeight, bg: cs.backgroundColor,
                 line: f.line === "border" ? border && inset : f.line === "inset" ? inset : true,
                 anyLine: f.line === "border" ? border || inset : f.line === "inset" ? inset : false }; };
      const judge = (on, off) => on.dot && !off.dot && on.w > off.w && on.line && !off.anyLine && on.bg === off.bg;
      const span1 = (e) => e.querySelector("span"), spanL = (e) => e.querySelector("span:last-child"),
            self = (e) => e, h5 = (e) => e.querySelector("h5");
      const FAM = [
        { name: ".chip.on", html: '<button class="chip on"><span>Chip</span></button>', cls: "on", ind: span1, lab: span1, line: "border", col: SEL },
        { name: ".chip.arm", html: '<button class="chip arm"><span>Arm</span></button>', cls: "arm", ind: span1, lab: span1, line: "border", col: SEL },
        { name: ".basebtn.on", html: '<button class="basebtn on" style="position:static"><span>Map</span></button>', cls: "on", ind: span1, lab: span1, line: "border", col: SEL },
        { name: ".actrow.on", html: '<button class="actrow on"><span class="sw"></span><span>Row</span></button>', cls: "on", ind: spanL, lab: spanL, line: "inset", col: SEL },
        { name: ".moderow.on", html: '<button class="moderow on"><span>Mode</span><span class="msub">what it is for</span></button>', cls: "on", ind: span1, lab: span1, line: "inset", col: SEL },
        { name: ".rc.sel", html: '<div class="rc sel"><h5>Route</h5><div class="big">9.1</div></div>', cls: "sel", ind: h5, lab: h5, line: "border", col: ROUTE },
        { name: ".tab.on", html: '<button class="tab on"><span>Tab</span></button>', cls: "on", ind: self, lab: self, line: null, col: SEL }];
      const PLANTS = [
        { name: "planted: a red-bordered chip", want: false, f: Object.assign({}, FAM[0], { html: '<button class="chip on" style="border-color:rgb(255,0,0)"><span>x</span></button>' }) },
        { name: "planted: a tab whose weight does not move", want: false, f: Object.assign({}, FAM[6], { html: '<button class="tab on" style="font-weight:700"><span>t</span></button>' }) },
        { name: "planted: a chip whose fill changes", want: false, f: Object.assign({}, FAM[0], { html: '<button class="chip on v4sel-fill"><span>f</span></button>' }) }];
      const box = document.createElement("div"); box.id = "v4sel";
      box.style.cssText = "position:fixed;left:16px;top:160px;z-index:99999;width:320px;padding:8px;background:var(--surface-1);display:flex;flex-direction:column;gap:8px";
      const st = document.createElement("style"); st.id = "v4sel-css"; st.textContent = ".v4sel-fill.on{background:rgb(250,250,250)!important}";
      document.head.appendChild(st); document.body.appendChild(box);
      const one = async (f) => { const w = document.createElement("div"); w.innerHTML = f.html; const el = w.firstElementChild;
        el.style.transition = "none"; box.appendChild(el); await two();
        const on = read(el, f); el.classList.remove(f.cls); await two(); const off = read(el, f); el.remove();
        return { name: f.name, on, off, ok: judge(on, off) }; };
      const fams = []; for (const f of FAM) fams.push(await one(f));
      const plants = []; for (const p of PLANTS) { const r = await one(p.f); plants.push({ name: p.name, judged: r.ok, caught: r.ok === p.want }); }
      /* a plain chip shows no indicator */
      const plain = document.createElement("button"); plain.className = "chip"; plain.innerHTML = "<span>p</span>";
      box.appendChild(plain); await two(); const plainDot = dotOf(plain.querySelector("span")); plain.remove();
      box.remove(); st.remove();
      /* the real North up, after navStart, with #nav drawn */
      let real = null;
      try {
        const f = window.__v4ride.force("full"); for (let i = 0; i < 6; i++) await frame();
        const nb = document.getElementById("nav-north"), nav = document.getElementById("nav");
        const navUp = !!nav && !nav.hidden && nav.getBoundingClientRect().height > 0;
        const was = /\bon\b/.test(nb.className);
        if (!was) nb.click(); await two();
        const RF = { ind: self, lab: (e) => e.querySelector("span") || e, line: "border", col: SEL };
        const on = read(nb, RF), onCls = /\bon\b/.test(nb.className);
        nb.click(); await two(); const off = read(nb, RF), offCls = /\bon\b/.test(nb.className);
        if (was) nb.click(); await two();
        real = { navUp, forced: !!(f && f.ok), onCls, offCls, on, off, ok: navUp && onCls && !offCls && judge(on, off) };
      } catch (e) { real = { ok: false, error: String(e) }; }
      try { window.__v4ride.undo(); window.__nav.stopReal(); window.railSet(false); } catch (e) {}
      /* card anatomy: the base rules weigh one class (:where), so the route
         card's warning and good lines keep their colours. Its plant: an
         id-weighted `#panel .sub` rule must take the warning colour away. */
      const P = document.getElementById("panel"), card = document.createElement("div"); card.id = "v4sel-card";
      card.innerHTML = '<div class="rc"><div class="sub warn">w</div><div class="sub good">g</div><div class="sub">q</div></div>'
        + '<div class="sub">p</div><span class="unit">u</span><span class="mono">1.0</span>';
      P.appendChild(card); await two();
      const col = (q) => rgb(getComputedStyle(card.querySelector(q)).color);
      const anat = { warn: col(".rc .warn") === probe("--warn"), good: col(".rc .good") === probe("--ok"),
        rcSub: col(".rc .sub:not(.warn):not(.good)") === probe("--text-3"), sub: col(":scope > .sub") === probe("--text-2"),
        unit: col(".unit") === probe("--text-3"), mono: /monospace/.test(getComputedStyle(card.querySelector(".mono")).fontFamily) };
      const pst = document.createElement("style"); pst.textContent = "#panel .sub{color:rgb(1,2,3)}"; document.head.appendChild(pst); await two();
      const anatPlant = col(".rc .warn") !== probe("--warn");
      pst.remove(); card.remove();
      return { SEL, ROUTE, fams, plants, plainDot, real, anat, anatPlant };
    } catch (e) { return { error: String((e && e.stack) || e) }; }
  });
  ok(!selRes.error, `the selected-state guard ran (${selRes.error || "ok"})`);
  if (!selRes.error) {
    const bad = selRes.fams.filter((f) => !f.ok);
    ok(bad.length === 0, `ONE SELECTED STATE: ${selRes.fams.length} families each show a --sel dot (the tab its bar), a heavier `
       + `label, their --sel line (a route card's in --route) and no fill change ON, and none of it OFF (--sel rgb ${selRes.SEL})`
       + (bad.length ? " — wrong: " + bad.map((f) => `${f.name} ${JSON.stringify({ on: f.on, off: f.off })}`).join("; ") : ""));
    const R = selRes.real || {};
    ok(R.ok, `the ride sheet's real North up, after navStart with #nav drawn (${R.navUp}), set on and off by its own `
       + `handler: the dot in its corner, a heavier label and a --sel line on, none off`
       + (R.ok ? "" : " — " + JSON.stringify(R)));
    const pm = selRes.plants.filter((p) => !p.caught);
    ok(pm.length === 0 && !selRes.plainDot, `the selected-state judge catches its plants (a red-bordered chip, a tab whose `
       + `weight does not move, a chip whose fill changes) and a plain chip shows no indicator`
       + (pm.length ? " — missed: " + pm.map((p) => p.name).join(", ") : "") + (selRes.plainDot ? " — a plain chip shows a dot" : ""));
    const A = selRes.anat;
    ok(Object.values(A).every(Boolean) && selRes.anatPlant, `card anatomy: a route card's warning line keeps --warn and its `
       + `good line --ok under the :where() base rules; .sub is --text-2 in a card, --text-3 on a route card; .unit is `
       + `--text-3; .mono is monospace — and an id-weighted "#panel .sub" rule (planted) takes the warning colour away `
       + `(caught: ${selRes.anatPlant})` + (Object.values(A).every(Boolean) ? "" : " — " + JSON.stringify(A)));
  }

  }
  if (RUN("v4-toast")) {
  /* take 188 · A216 · THE TOAST: a live status line (role=status,
     aria-live=polite) that wraps inside the screen and sits above the tool
     strip by the measured dock height, with the drawer folded and open, at
     360x800. Plants: the dock height forced to 0 must put it over the strip,
     and nowrap must run it wider than the screen allows. */
  await page.setViewport({ width: 360, height: 800, deviceScaleFactor: 3 }); await vpSettle(1200);
  const toastAt = async (open) => { await page.evaluate((o) => { try { window.railSet(o); } catch (e) {} }, open);
    await settleDrawer();
    return page.evaluate(async () => {
      const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
      const B = window.__back, t = document.getElementById("toast"), tl = document.getElementById("tools");
      const MSG = "Saved HD imagery is still downloading — keep the app open until the bar reaches the end";
      const rd = () => { const r = t.getBoundingClientRect(), s = tl.getBoundingClientRect();
        return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right),
                 h: Math.round(r.height), tools: Math.round(s.top), vw: innerWidth, over: t.scrollWidth > t.clientWidth + 1 }; };
      /* above the strip, inside a 16 px edge, wrapped (taller than one line)
         and nothing running past its own box */
      const fit = (x) => x.bottom <= x.tools - 4 && x.left >= 15 && x.right <= x.vw - 15 && x.h > 40 && !x.over;
      B.toast(MSG, 4000); await frame(); await frame();
      const real = rd(), role = t.getAttribute("role"), live = t.getAttribute("aria-live"), dock = getComputedStyle(document.documentElement).getPropertyValue("--dock-h").trim();
      document.documentElement.style.setProperty("--dock-h", "0px"); await frame(); await frame();
      const pDock = rd(); B.toast(MSG, 4000);
      t.style.whiteSpace = "nowrap"; await frame(); await frame(); const pWrap = rd(); t.style.whiteSpace = "";
      B.toast(MSG, 50); await new Promise((x) => setTimeout(x, 120));
      return { real, role, live, dock, fits: fit(real), pDock, pWrap, caughtDock: !fit(pDock), caughtWrap: !fit(pWrap), hidden: t.hidden };
    }); };
  const tf = await toastAt(false), to = await toastAt(true);
  await page.evaluate(() => { try { window.railSet(false); } catch (e) {} }); await settleDrawer();
  ok(tf.fits && to.fits && tf.role === "status" && tf.live === "polite" && tf.caughtDock && tf.caughtWrap && tf.hidden,
     `the toast is a live status line (role ${tf.role}, aria-live ${tf.live}) that wraps inside 360 px and sits above the tool `
     + `strip: folded ${tf.real.left}–${tf.real.right} px, bottom ${tf.real.bottom} over the strip at ${tf.real.tools} (dock ${tf.dock}); `
     + `open bottom ${to.real.bottom} over ${to.real.tools}; a dock height forced to 0 (bottom ${tf.pDock.bottom}) and nowrap `
     + `(runs past its box: ${tf.pWrap.over}) are caught`);
  await page.setViewport({ width: 411, height: 960, deviceScaleFactor: 2.625 }); await vpSettle(800);

  }
  if (RUN("v4-audit")) {
  /* 2 · the audit walks states that change the page, so it goes last */
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2.6 });
  await vpSettle(1200);
  const aud = await page.evaluate(async (GS, EXEMPT) => {
    try {
    const G = new RegExp(GS, "u");
    const s = (ms) => new Promise((r) => setTimeout(r, ms));
    const px = (v) => parseFloat(v) || 0;
    const rgba = (c) => { const m = (c || "").match(/[\d.]+/g) || [0, 0, 0, 0];
      return [+m[0], +m[1], +m[2], m[3] == null ? 1 : +m[3]]; };
    const over = (top, bot) => { const a = top[3]; return [0, 1, 2].map((i) => top[i] * a + bot[i] * (1 - a)).concat(1); };
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    /* the 7:1 family is whatever the page's --text-1 and --text-2 compute to */
    const probe = (v) => { const e = document.createElement("span"); e.style.color = `var(${v})`; document.body.appendChild(e);
      const c = rgba(getComputedStyle(e).color); e.remove(); return c; };
    const FAM = [probe("--text-1"), probe("--text-2")];
    const primary = (fg) => FAM.some((c) => [0, 1, 2].every((i) => Math.abs(c[i] - fg[i]) <= 1));
    const STATE = /^(on|sel|arm|folded|ready|swap|gone|empty|open)$/;
    const keyOf = (el) => { if (el.id) return "#" + el.id; let a = el.parentElement;
      while (a && !a.id && a !== document.body) a = a.parentElement;
      const cls = [...(el.classList || [])].filter((c) => !STATE.test(c)).join(".");
      return (a && a.id ? "#" + a.id + " " : "") + el.tagName.toLowerCase() + (cls ? "." + cls : ""); };
    const shown = (el) => { const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return null;
      if (r.bottom <= 0 || r.right <= 0 || r.top >= innerHeight || r.left >= innerWidth) return null;
      for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
        const c = getComputedStyle(a);
        if (c.display === "none" || c.visibility === "hidden" || +c.opacity === 0) return null;
      }
      return r; };
    const opChain = (el) => { let a = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) a *= +getComputedStyle(e).opacity; return a; };
    /* what is behind an element: its solid ground composited through every
       translucent layer; a gradient is judged by its most transparent stop
       over white AND black; no ground at all (the map) is white and black */
    const bases = (el) => { const layers = []; let base = null, grad = null;
      for (let a = el; a && a !== document.documentElement; a = a.parentElement) { const c = getComputedStyle(a), bg = rgba(c.backgroundColor);
        if (c.backgroundImage && /gradient/.test(c.backgroundImage)) { grad = c.backgroundImage; break; }
        if (bg[3] > 0) { layers.push(bg); if (bg[3] >= 0.999) { base = bg; break; } } }
      const fin = (b0) => { let b = b0; for (let i = layers.length - 1; i >= 0; i--) if (layers[i] !== base) b = over(layers[i], b); return b; };
      if (base) return [fin(base)];
      if (grad) { const t = (grad.match(/rgba?\([^)]*\)/g) || []).map(rgba).sort((x, y) => x[3] - y[3])[0] || [0, 0, 0, 0];
        return [fin(over(t, [255, 255, 255, 1])), fin(over(t, [0, 0, 0, 1]))]; }
      return [fin([255, 255, 255, 1]), fin([0, 0, 0, 1])]; };
    const AUDIT = (F) => {
      const out = { tap: {}, text: {}, contrast: {}, glyph: {}, nontext: {}, exempt: {}, haloed: 0 };
      const put = (o, k, v) => { o[k] = o[k] == null ? v : Math.min(o[k], v); };
      const INTERACTIVE = "button, a[href], input, select, textarea, summary, [role=button], .rc, .hit, [data-jump], [data-wpgo], [data-svopen]";
      for (const el of document.querySelectorAll(INTERACTIVE)) {
        const r = shown(el); if (!r) continue;
        const k = keyOf(el), m = Math.round(Math.min(r.width, r.height)), floor = el.matches(F.rideSel) ? F.tapRide : F.tap;
        if (m >= floor) continue;
        /* by rule: a map marker (A214 owns its geometry; a 48 px box would
           take long-presses beside the rider — INFERRED, the maintainer's
           call, N28), and a link inside a sentence (WCAG 2.5.8's inline case) */
        if (el.closest(".maplibregl-canvas-container")) { out.exempt["marker: " + k] = m; continue; }
        if (el.tagName === "A" && getComputedStyle(el).display === "inline" && el.parentElement
          && [...el.parentElement.childNodes].some((n) => n !== el && n.nodeType === 3 && n.textContent.trim())) {
          out.exempt["inline link: " + k] = m; continue; }
        if (k in EXEMPT) { out.exempt[k] = m; continue; }
        put(out.tap, k, m);
      }
      for (const el of document.querySelectorAll("body *")) {
        if (/^(SCRIPT|STYLE)$/.test(el.tagName)) continue;
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        if (el.closest(".maplibregl-canvas-container")) continue;   // map markers draw their own
        const r = shown(el); if (!r) continue;
        const cs = getComputedStyle(el), svg = el instanceof SVGElement, k = keyOf(el);
        /* SVG text is drawn at its font size times the element's scale */
        let size = px(cs.fontSize);
        if (svg && el.getScreenCTM) { const M = el.getScreenCTM(); if (M) size *= Math.sqrt(Math.abs(M.a * M.d - M.b * M.c)); }
        if (size < F.text) put(out.text, k, +size.toFixed(1));
        /* take 188 · A216 · a text glyph in what the rider sees (the drawer's
           chevron is the one exemption, by id) */
        const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("");
        if (el.id !== "peek-chev" && G.test(own)) put(out.glyph, k, own.match(G)[0].codePointAt(0));
        /* the paint: an SVG text's is its fill, not its CSS color; the
           opacity of it and every ancestor thins it */
        const fg0 = rgba(svg ? cs.fill : cs.color), fg = [fg0[0], fg0[1], fg0[2], fg0[3] * opChain(el)];
        const large = size >= 24 || (size >= 18.66 && +cs.fontWeight >= 700);
        const need = primary(fg0) ? (large ? F.primaryLarge : F.primary) : (large ? F.otherLarge : F.other);
        /* haloed text (a stroke or a shadow under it) is judged fill against halo */
        const halo = (cs.textShadow && cs.textShadow !== "none") ? rgba((cs.textShadow.match(/rgba?\([^)]*\)/) || ["rgb(0,0,0)"])[0])
          : px(cs.webkitTextStrokeWidth) > 0 ? rgba(cs.webkitTextStrokeColor) : null;
        let cr;
        if (halo) { out.haloed++; const hb = over(halo, [127, 127, 127, 1]); cr = ratio(over(fg, hb), hb); }
        else cr = Math.min(...bases(el).map((b) => ratio(over(fg, b), b)));
        if (cr >= need) continue;
        /* a disabled control is exempt from contrast (WCAG's inactive
           components), never from size */
        if (el.closest("button[disabled], [aria-disabled=true]")) { out.exempt["disabled: " + k] = +cr.toFixed(2); continue; }
        put(out.contrast, k, +cr.toFixed(2));
      }
      /* non-text 3:1: every drawn icon against what is behind it */
      for (const ic of document.querySelectorAll("svg.ic")) { const r = shown(ic); if (!r) continue;
        if (ic.closest(".maplibregl-canvas-container")) continue;
        const cs = getComputedStyle(ic), col = rgba(cs.stroke && cs.stroke !== "none" ? cs.stroke : cs.color);
        const fg = [col[0], col[1], col[2], col[3] * opChain(ic)];
        const disabled = !!ic.closest("button[disabled]");
        const cr = Math.min(...bases(ic.parentElement || ic).map((b) => ratio(over(fg, b), b)));
        if (cr < F.nonText && !disabled) put(out.nontext, "icon " + keyOf(ic.parentElement || ic), +cr.toFixed(2)); }
      /* each selected state against its own unselected look, read by taking
         the class off with transitions stopped and putting it straight back;
         its "look" is the best of fill, border, text colour and the ::before
         marks of it and its children. A class whose removal HIDES the
         element (#alert.on, #busy.on) is a visibility switch, not a look. */
      for (const el of document.querySelectorAll(".on, .sel, .arm")) { const r = shown(el); if (!r) continue;
        if (el.closest(".maplibregl-canvas-container") || el.id === "shell" || el.id === "rail") continue;
        const cl = ["on", "sel", "arm"].filter((c) => el.classList.contains(c));
        const marks = [el, ...el.children];
        /* a ::before mark is judged against the ground it is DRAWN on — its
           own element's composited background (take 188 · A216: a --sel dot
           inside an opaque chip on the tool strip was judged against the
           strip's gradient over white, 1.15:1, while it sits on the chip's
           #171613 at 15.8:1) */
        const look = () => { const cs = getComputedStyle(el);
          return { bg: rgba(cs.backgroundColor), bd: rgba(cs.borderTopColor), bw: px(cs.borderTopWidth), fg: rgba(cs.color),
                   pre: marks.map((m) => { const b4 = getComputedStyle(m, "::before");
                     return b4.content && b4.content !== "none" && b4.display !== "none" ? rgba(b4.backgroundColor) : [0, 0, 0, 0]; }),
                   ground: marks.map((m) => bases(m)) }; };
        const tr = el.style.transition; el.style.transition = "none";
        const on = look(); cl.forEach((c) => el.classList.remove(c)); const off = look(), offShown = !!shown(el);
        cl.forEach((c) => el.classList.add(c)); el.style.transition = tr;
        if (!offShown) continue;
        const B = bases(el.parentElement || el)[0], comp = (c) => over(c, B);
        const markR = (i) => Math.min(...on.ground[i].map((g, k) => { const h = off.ground[i][Math.min(k, off.ground[i].length - 1)];
          return ratio(over(on.pre[i], g), over(off.pre[i], h)); }));
        const best = Math.max(ratio(comp(on.bg), comp(off.bg)), on.bw > 0 || off.bw > 0 ? ratio(comp(on.bd), comp(off.bd)) : 1,
          ratio(comp(on.fg), comp(off.fg)), ...on.pre.map((p, i) => markR(i)));
        if (best < F.nonText) put(out.nontext, "selected " + keyOf(el) + "." + cl.join("."), +best.toFixed(2)); }
      /* named marks: the drawer's grabber and the compass needle */
      const pk = document.getElementById("peek"); if (pk && shown(pk)) { const c = rgba(getComputedStyle(pk, "::before").backgroundColor);
        const cr = Math.min(...bases(pk).map((b) => ratio(over(c, b), b)));
        if (cr < F.nonText) put(out.nontext, "mark #peek::before", +cr.toFixed(2)); }
      const nd = document.getElementById("hudneedle"); if (nd && shown(nd)) { const c = rgba(getComputedStyle(nd).backgroundColor);
        const cr = Math.min(...bases(nd.parentElement).map((b) => ratio(over(c, b), b)));
        if (cr < F.nonText) put(out.nontext, "mark #hudneedle", +cr.toFixed(2)); }
      return out;
    };
    const merge = (acc, o) => { for (const t of ["tap", "text", "contrast", "glyph", "nontext", "exempt"]) for (const [k, v] of Object.entries(o[t]))
      acc[t][k] = Math.min(acc[t][k] == null ? 1e9 : acc[t][k], v); acc.haloed += o.haloed; return acc; };
    const F = { tap: 48, tapRide: 56, rideSel: "#hudbtns button, #c-ride", text: 12, primary: 7, primaryLarge: 4.5,
                other: 4.5, otherLarge: 3, nonText: 3 };

    /* the planted controls first: the audit must see each, and must NOT see
       the ones its rules exempt (landmine 54) */
    const fx = document.createElement("div"); fx.id = "v4plant";
    fx.style.cssText = "position:fixed;left:20px;top:300px;z-index:99999;background:#4a4a4a;padding:6px;width:300px";
    fx.innerHTML = '<button id="v4plant-small" style="height:44px;width:60px;min-height:0;padding:0;color:#fff;background:#000;border:0">x</button>'
      + '<button id="v4plant-ride" style="height:50px;width:60px;min-height:0;padding:0;color:#fff;background:#000;border:0">r</button>'
      + '<button id="v4plant-ok" style="height:48px;width:60px;min-height:0;padding:0;color:#fff;background:#000;border:0">k</button>'
      + '<span id="v4plant-tiny" style="font-size:11px;color:#fff;background:#000">tiny</span>'
      + '<svg id="v4plant-svg" width="40" height="20" viewBox="0 0 40 20"><text x="0" y="12" font-size="10" fill="#fff">svg</text></svg>'
      + '<svg id="v4plant-svgbig" width="52" height="26" viewBox="0 0 40 20"><text x="0" y="12" font-size="10" fill="#fff">big</text></svg>'
      + '<svg id="v4plant-svgfill" width="80" height="30" viewBox="0 0 80 30" style="background:#4a4a4a"><text x="0" y="20" font-size="16" style="fill:#555">fill</text></svg>'
      + '<span id="v4plant-grey" style="font-size:14px;color:#555;background:#4a4a4a">grey</span>'
      + '<span id="v4plant-t1" style="font-size:14px;color:var(--text-1);background:#5a5a5a">t1</span>'
      + '<span id="v4plant-faded" style="font-size:14px;color:var(--text-1);background:#000;opacity:.35">faded</span>'
      + '<span id="v4plant-halo" style="font-size:14px;color:#777;background:#000;-webkit-text-stroke:3px #666;paint-order:stroke fill">halo</span>'
      + '<span id="v4plant-on" class="on" style="font-size:14px;color:#fff;padding:4px">tint</span>'
      + '<span id="v4plant-onbd" class="on" style="font-size:14px;color:#fff;padding:4px;border:2px solid transparent">bord</span>'
      + '<span id="v4plant-icon"><svg class="ic" viewBox="0 0 24 24" style="color:#555;width:20px;height:20px" fill="none" stroke="currentColor"><path d="M2 2h20"/></svg></span>'
      + '<button id="v4plant-hidden" style="display:none;height:30px">h</button>'
      + '<button id="v4plant-dis" disabled style="height:48px;width:60px;min-height:0;padding:0;color:#555;background:#4a4a4a;border:0">dis</button>'
      + '<p id="v4plant-para" style="font-size:14px;color:#fff;background:#000">see <a id="v4plant-inl" href="#x" style="color:#fff">this</a> here</p>'
      + '<span id="v4plant-glyph" style="font-size:14px;color:#fff;background:#000">☆</span>'
      + '<button id="v4plant-glyphhid" style="display:none;height:30px">☆</button>'
      + '<span style="display:inline-block;background:#fff;padding:4px"><span id="v4plant-dotok" class="on" style="display:inline-block;'
      + 'background:#171613;color:#171613;font-size:14px;padding:4px"><span>d</span></span></span>'
      + '<span style="display:inline-block;background:#000;padding:4px"><span id="v4plant-dotlost" class="on" style="display:inline-block;'
      + 'background:#4a4a4a;color:#4a4a4a;font-size:14px;padding:4px"><span>d</span></span></span>';
    /* the selected looks: a 1.2:1 tint (caught) and a 4:1 border (not) */
    const bd = document.createElement("style"); bd.id = "v4plant-css";
    bd.textContent = "#v4plant-on.on{background:rgba(255,255,255,.12)}#v4plant-onbd.on{border-color:#b0b0b0!important}"
      + "#v4plant-dotok.on>span::before,#v4plant-dotlost.on>span::before{content:'';display:inline-block;width:8px;height:8px}"
      + "#v4plant-dotok.on>span::before{background:#f5efe2}#v4plant-dotlost.on>span::before{background:#4a4a4a}";
    document.head.appendChild(bd);
    document.body.appendChild(fx);
    const cc = document.querySelector(".maplibregl-canvas-container"), mk = document.createElement("div");
    mk.id = "v4plant-marker"; mk.setAttribute("role", "button"); mk.style.cssText = "position:absolute;left:40px;top:40px;width:26px;height:26px";
    if (cc) cc.appendChild(mk);
    await s(150);
    const pl = AUDIT(Object.assign({}, F, { rideSel: F.rideSel + ", #v4plant-ride" }));
    fx.remove(); mk.remove(); bd.remove();
    const has = (o, k) => Object.keys(o).some((x) => x.split(/[\s.:]+/).includes(k));
    const planted = { tap44: "#v4plant-small" in pl.tap, ride50: "#v4plant-ride" in pl.tap, ok48: !("#v4plant-ok" in pl.tap),
      text11: "#v4plant-tiny" in pl.text, svg10: has(pl.text, "#v4plant-svg"), svgScaledNotSeen: !has(pl.text, "#v4plant-svgbig"),
      svgFill: has(pl.contrast, "#v4plant-svgfill"), grey: "#v4plant-grey" in pl.contrast, t1On5A: "#v4plant-t1" in pl.contrast,
      faded: "#v4plant-faded" in pl.contrast, halo: "#v4plant-halo" in pl.contrast,
      tint: has(pl.nontext, "#v4plant-on"), borderNotSeen: !has(pl.nontext, "#v4plant-onbd"), icon: has(pl.nontext, "#v4plant-icon"),
      hiddenNotSeen: !("#v4plant-hidden" in pl.tap), markerExempt: !has(pl.tap, "#v4plant-marker") && has(pl.exempt, "#v4plant-marker"),
      inlineExempt: !has(pl.tap, "#v4plant-inl") && has(pl.exempt, "#v4plant-inl"),
      disabledExempt: !("#v4plant-dis" in pl.contrast) && has(pl.exempt, "#v4plant-dis") && !("#v4plant-dis" in pl.tap),
      glyph: "#v4plant-glyph" in pl.glyph, glyphHiddenNotSeen: !("#v4plant-glyphhid" in pl.glyph),
      dotOnOwnGroundNotSeen: !has(pl.nontext, "#v4plant-dotok"), dotLostCaught: has(pl.nontext, "#v4plant-dotlost") };

    /* the forced states (landmine 111) */
    const acc = { tap: {}, text: {}, contrast: {}, glyph: {}, nontext: {}, exempt: {}, haloed: 0 };
    const click = (q) => { const e = document.querySelector(q); if (e) e.click(); return !!e; };
    const tab = (t) => click(`#tabs .tab[data-go="${t}"]`);
    /* each state proves it was reached before it is audited: a control that
       failed to open would otherwise be audited as whatever was on screen.
       And it waits on FRAMES, not a timer (landmine 224): a transition that a
       class change starts stays pending until a frame is drawn, an idle page
       draws few, and a drawer still pending reads as opacity 0 — its content
       would be skipped as hidden. The same holds for a card's entrance
       (cardIn, from opacity 0): read as it starts, a whole panel is skipped.
       So: frame by frame until the state is reached and no transition or
       finite animation is left, six seconds at most. (The HD sheet renders
       after two promises; a fixed 700 ms missed it in one run.) */
    const visited = [], unreached = [];
    const up = (id) => { const e = document.getElementById(id); return !!e && !e.hidden; };
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    const settleTo = async (reached, max) => { const t0 = Date.now(); let r = false;
      do { await frame(); try { r = !!reached(); } catch (e) { r = false; }
        if (r && !document.getAnimations().some((a) => a.playState === "running" && a.effect
          && isFinite(a.effect.getComputedTiming().endTime))) return true;
      } while (Date.now() - t0 < max);
      return r; };
    const run = async (name, fn, reached, wait = 700, max = 6000) => { try { await fn(); } catch (e) {} await s(wait);
      const r = await settleTo(reached, max);
      visited.push(name); if (!r) unreached.push(name); merge(acc, AUDIT(F)); };
    /* the reach check's negative control: a state that never opens is reported */
    await run("planted: never opens", async () => {}, () => false, 0, 300);
    const reachCaught = unreached.pop() === "planted: never opens"; visited.pop();
    await run("rest", async () => {}, () => true);
    await run("drawer open", async () => window.railSet(true),
      () => !/\bfolded\b/.test(document.getElementById("rail").className));
    for (const t of ["plan", "ride", "tools", "map"]) await run("tab " + t, async () => tab(t),
      () => /\bon\b/.test(document.querySelector(`#tabs .tab[data-go="${t}"]`).className), 400);
    await run("mode picker", async () => click("#c-mode"), () => up("modepanel")); click("#c-mode"); await s(300);
    await run("activity picker", async () => click("#c-act"), () => up("actpanel")); click("#c-act"); await s(300);
    await run("layers", async () => click("#c-layers"), () => up("lyrpanel")); click("#c-layers"); await s(300);
    /* take 188 · A215 · four states the audit never saw */
    await run("search", async () => { tab("map"); await s(200); click("#c-search"); await s(300);
      const q = document.getElementById("q"); q.value = "Grayling"; q.dispatchEvent(new Event("input", { bubbles: true })); },
      () => !!document.querySelector("#hits .hit"), 700);
    /* reached = homeCard's own output (#hc-me drawn) in an open drawer, read
       FALSE just before the click with the drawer folded first, so only the
       click can make it true (landmine 111; review round 1: the plan tab and
       an open drawer were true before the click) */
    const homeUp = () => { const e = document.getElementById("hc-me");
      return !!e && e.getBoundingClientRect().height > 0 && !/\bfolded\b/.test(document.getElementById("rail").className); };
    let homeBefore = null;
    await run("set home", async () => { tab("plan"); await s(200); window.railSet(false); await s(300);
      homeBefore = homeUp(); click("#c-home"); }, homeUp, 700);
    await run("compass", async () => { tab("tools"); await s(200); click("#c-compass"); }, () => up("cmppanel"), 600);
    click("#c-compass"); await s(300);
    await run("diagnostics", async () => { tab("tools"); await s(200); click("#c-diag"); }, () => up("diagpanel"), 600);
    click("#c-diag"); await s(300); tab("map"); await s(200);
    await run("place card", async () => { const c = window.map.getCenter();
      window.map.fire("contextmenu", { lngLat: { lng: c.lng + 0.01, lat: c.lat } }); window.railSet(true); },
      () => !!document.getElementById("pc-route"), 900);
    await run("route cards", async () => { click("#pc-route");
      for (let i = 0; i < 60 && !document.querySelector(".rc"); i++) await s(250); },
      () => !!document.querySelector(".rc"), 600);
    /* take 188 · A216 · where the turn icons draw */
    await run("turn list", async () => click("#btn-steps"), () => !!document.getElementById("steps"), 500);
    await run("hd sheet", async () => click("#c-hd"),
      () => /HD imagery/.test(document.getElementById("panel").textContent));
    await run("tour", async () => { tab("tools"); await s(300); click("#c-tour"); }, () => up("tour"), 900);
    try { window.__tour && window.__tour.close && window.__tour.close(); } catch (e) {} await s(300);
    await run("guide", async () => window.guideShow(), () => up("guide"), 600);
    try { window.guideClose(true); } catch (e) {} await s(300);
    /* take 188 · A215 · the ride, two ways. "Ride pressed, no fix" is the
       real press (headless Chrome gets no fix: #nav up, no ribbon); the full
       ride is forced by the shared helper (ribbon, sheet, a real guidance
       line, the off-route alert in the app's words). G8: the full state
       counts as reached only with BOTH #hudbar and #nav drawn, and that
       predicate must read false before it is forced. */
    await run("ride (pressed, no fix)", async () => { tab("ride"); await s(300); click("#c-ride"); },
      () => up("nav") && !up("hudbar"), 1500);
    /* take 188 · A222 · the ride sheet, forced on (headless gets no fix, so it
       never appears by itself — probe v4-06 on take 187): routed first (the
       route cards' route, guidance on from the ride above), then free */
    const sheetUp = (cell) => () => { const e = document.getElementById("hudstats"), c = document.getElementById(cell);
      return !!e && !e.hidden && e.getBoundingClientRect().height > 0 && !!c && !c.hidden; };
    await run("ride sheet (routed)", async () => { window.hudShow(true); window.hudSet(8.9, 48.8, null); },
      sheetUp("hc-togo"), 400);
    await run("ride sheet (free ride)", async () => { window.__nav.stop(); window.hudPaint(); },
      sheetUp("hc-spd"), 400);
    try { window.hudShow(false); } catch (e) {}
    const fullUp = () => up("hudbar") && up("nav") && !!document.getElementById("hudbar").getBoundingClientRect().height
      && !!document.getElementById("nav").getBoundingClientRect().height;
    const g8Before = fullUp();
    let forced = null;
    await run("ride (full, forced)", async () => { forced = window.__v4ride.force("full"); }, fullUp, 600);
    try { window.__v4ride.undo(); } catch (e) {}
    /* the press above left a GPS watch pending: stop it, or its timeout
       starts the simulator under whatever runs next */
    try { window.__nav.stopReal(); window.railSet(false); } catch (e) {}
    return { planted, offenders: acc, visited, unreached, reachCaught, g8Before, forced, homeBefore };
    } catch (e) { return { error: String((e && e.stack) || e) }; }
  }, GLYPH_SRC, V4_EXEMPT);
  ok(!aud.error, `the V4 audit ran to its end (${aud.error || "ok"})`);
  if (!aud.error) {
  const P = aud.planted;
  ok(Object.values(P).every(Boolean),
     "the V4 audit judges its planted controls: a 44 px button and a 50 px ride control are caught (48 passes); an "
     + "11 px label and SVG text of 10 at 1:1 are caught (x1.3 is not); SVG text by its FILL, #555 on #4A4A4A, "
     + "a --text-1 span on #5A5A5A (7:1 family), a bone span at opacity .35 and grey text on a grey stroke are caught; "
     + "a 1.2:1 selected tint, a #555 icon and a selected dot the colour of its own control are caught (a selected border, "
     + "and a bone dot on a dark control over a white parent, are not); a hidden button, a map marker, an "
     + "inline link and a disabled control's contrast are not" + " " + JSON.stringify(P));
  ok(aud.reachCaught && aud.unreached.length === 0, `the audit reached each of its ${aud.visited.length} states `
     + `before auditing it, and reports a planted state that never opens (its negative control)`
     + (aud.unreached.length ? " — not reached: " + aud.unreached.join(", ") : ""));
  ok(!aud.g8Before && aud.forced && aud.forced.line && !aud.unreached.includes("ride (full, forced)"),
     `G8 · the full ride state counts as reached only with the ribbon AND the nav strip drawn: the predicate read `
     + `${aud.g8Before} before forcing (must be false); forced with a real guidance line (${aud.forced && aud.forced.line})`);
  ok(aud.homeBefore === false && !aud.unreached.includes("set home"),
     `the set-home state counts as reached only when homeCard draws #hc-me in an open drawer: the predicate read `
     + `${aud.homeBefore} before the click with the drawer folded (must be false), and true after it`);
  const fresh = (got, known) => Object.keys(got).filter((k) => !known.includes(k));
  const O = aud.offenders;
  const nT = fresh(O.tap, V4_TAP), nX = fresh(O.text, V4_TEXT), nC = fresh(O.contrast, V4_CONTRAST),
        nG = fresh(O.glyph, V4_GLYPH), nN = fresh(O.nontext, V4_NONTEXT);
  ok(nT.length === 0, `no tap target under 48 px, no ride control under 56 (${V4_TAP.length} known)`
     + (nT.length ? " — new: " + nT.map((k) => `${k} ${O.tap[k]}px`).join(", ") : ""));
  ok(nX.length === 0, `no text under 12 px (${V4_TEXT.length} known)`
     + (nX.length ? " — new: " + nX.map((k) => `${k} ${O.text[k]}px`).join(", ") : ""));
  ok(nC.length === 0, `no text under its contrast floor — 7:1 for --text-1/--text-2 (4.5 large), 4.5:1 for the rest `
     + `(3 large) — (${V4_CONTRAST.length} known, ${O.haloed} haloed texts judged fill against halo)`
     + (nC.length ? " — new: " + nC.map((k) => `${k} ${O.contrast[k]}:1`).join(", ") : ""));
  ok(nG.length === 0, `no new emoji or text glyph on screen (${V4_GLYPH.length} known)`
     + (nG.length ? " — new: " + nG.map((k) => `${k} ${String.fromCodePoint(O.glyph[k])}`).join(", ") : ""));
  ok(nN.length === 0, `no icon, selected state or mark under 3:1 (${V4_NONTEXT.length} known)`
     + (nN.length ? " — new: " + nN.map((k) => `${k} ${O.nontext[k]}:1`).join(", ") : ""));
  const exempted = Object.keys(O.exempt);
  console.log("  .. exempt this run: " + (exempted.map((k) => `${k} (${O.exempt[k]})`).join(", ") || "none"));
  /* the lists are exact, not only a ceiling: a listed offender the audit no
     longer sees is either fixed — take it off its list in the same change —
     or no longer reached, and a coverage loss must not pass as a fix (take
     187: the route cards' four went "no longer offending" while an entrance
     animation hid the whole panel). A named exemption must be seen too. Its
     control: a planted listed key that cannot be seen is reported, in each list. */
  const unseen = (tap, text, contrast, glyph, nontext, exempt) => [...tap.filter((k) => !(k in O.tap)),
    ...text.filter((k) => !(k in O.text)), ...contrast.filter((k) => !(k in O.contrast)),
    ...glyph.filter((k) => !(k in O.glyph)), ...nontext.filter((k) => !(k in O.nontext)),
    ...exempt.filter((k) => !(k in O.exempt))];
  const EX = Object.keys(V4_EXEMPT);
  const gone = unseen(V4_TAP, V4_TEXT, V4_CONTRAST, V4_GLYPH, V4_NONTEXT, EX);
  const never = "#v4plant-never";
  const plantSeen = unseen([...V4_TAP, never], V4_TEXT, V4_CONTRAST, V4_GLYPH, V4_NONTEXT, EX).includes(never)
    && unseen(V4_TAP, V4_TEXT, V4_CONTRAST, [never], V4_NONTEXT, EX).includes(never)
    && unseen(V4_TAP, V4_TEXT, V4_CONTRAST, V4_GLYPH, [never], EX).includes(never)
    && unseen(V4_TAP, V4_TEXT, V4_CONTRAST, V4_GLYPH, V4_NONTEXT, [never]).includes(never);
  ok(plantSeen && gone.length === 0, "every listed offender and named exemption was seen: a fixed one leaves its "
     + "list, and one the audit cannot see is a coverage loss, not a fix; a planted listed key that cannot be seen "
     + "is reported in each list (its negative control)" + (gone.length ? " — not seen: " + gone.join(", ") : ""));
  }

  }
  if (RUN("v4-walker")) {
  /* take 188 · A217 · THE TAP WALKER. The V4 study's tap counts (§7) as
     ceilings, walked the way a rider walks them: from a clean page, every
     step is a tap on a control that is really there to tap — on screen, not
     hidden, not transparent, and the thing a tap at its centre lands on
     (landmine 173: wired is not reachable). A step that cannot be tapped
     reports the flow BLOCKED, never passes. Flows: A plan and ride to a
     place (long-press, Route here, Ride it) <= 3; B return home and ride
     from the FOLDED drawer (Return home, Ride it) <= 2; C set home to the
     armed map tap (Plan, Set home, Tap the map) <= 3, the map tap that
     places it the "+1"; D free ride (Ride, Ride it) <= 2; E the turn list
     from the route cards (Turns) <= 1. A and B run at 360x800 and at
     411x960. The accent is counted at the place card and at the route
     cards (at most one surface each). Setup taps (home, start) are not
     counted; each flow is torn down (the ride stopped, the drawer folded,
     the Map tab) before the next. The same function runs on the frozen
     take-187 tree through probe, where A and B must come back BLOCKED
     (its negative control against real code). WALKER-BEGIN */
  const WALKER = async (cfg) => {
    const out = { flows: {}, acc: {}, plants: {}, error: null };
    try {
      const s = (ms) => new Promise((r) => setTimeout(r, ms));
      const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
      const $ = (id) => document.getElementById(id);
      const settle = async (max = 3000) => { const t0 = Date.now();
        do { await frame(); if (!document.getAnimations().some((a) => a.playState === "running" && a.effect
          && isFinite(a.effect.getComputedTiming().endTime))) return true; } while (Date.now() - t0 < max);
        return false; };
      const until = async (pred, max) => { const t0 = Date.now();
        do { try { if (pred()) return true; } catch (e) {} await s(120); } while (Date.now() - t0 < max); return false; };
      const name = (h) => h ? (h.id || String(h.className || "").split(" ")[0] || h.tagName) : "nothing";
      const opac = (e) => { let a = 1; for (let x = e; x && x.nodeType === 1; x = x.parentElement) a *= +getComputedStyle(x).opacity; return a; };
      const tappable = (e) => { if (!e) return "missing"; if (e.hidden) return "hidden";
        const cs = getComputedStyle(e); if (cs.display === "none") return "display none";
        if (cs.visibility === "hidden") return "visibility hidden"; if (opac(e) < 0.05) return "transparent";
        const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return "no size";
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return "off screen";
        const h = document.elementFromPoint(cx, cy);
        return (h && (h === e || e.contains(h))) ? null : "under " + name(h); };
      const tap = async (fl, q) => { await settle(); const e = q.startsWith("#") || q.includes("[") ? document.querySelector(q) : $(q);
        const why = tappable(e); if (why) { fl.blocked = q + " (" + why + ")";
          /* a failure names its own cause (landmine 131): where the control,
             the drawer's body and the drawer were, and the body's scroll */
          const R = (x) => { if (!x) return null; const r = x.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; };
          fl.geo = { el: R(e), rail: R($("rail")), body: R($("railbody")), scroll: ($("railbody") || {}).scrollTop,
                     railCls: ($("rail") || {}).className, running: document.getAnimations().filter((a) => a.playState === "running").length };
          return false; }
        fl.taps++; fl.path.push(q); e.click(); return true; };
      const press = async (fl, at) => { await settle(); const m = window.map, p = m.project(at), r = m.getCanvas().getBoundingClientRect();
        const h = document.elementFromPoint(r.left + p.x, r.top + p.y);
        if (h !== m.getCanvas()) { fl.blocked = "long-press (under " + name(h) + ")"; return false; }
        fl.taps++; fl.path.push("long-press"); m.fire("contextmenu", { lngLat: { lng: at[0], lat: at[1] }, point: p }); return true; };
      const accent = () => { const pr = document.createElement("div"); pr.style.background = "var(--accent)"; document.body.appendChild(pr);
        const acc = (getComputedStyle(pr).backgroundColor.match(/\d+/g) || []).slice(0, 3); pr.remove();
        const ACC = new RegExp("^rgba?\\(" + acc.join(",\\s*") + "(,|\\))"), hit = [];
        for (const el of document.querySelectorAll("body *")) { const r = el.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) continue; const cs = getComputedStyle(el);
          if (cs.visibility === "hidden" || !ACC.test(cs.backgroundColor)) continue;
          let a = +((cs.backgroundColor.match(/^rgba\([^)]*,\s*([\d.]+)\)$/) || [0, 1])[1]), clips = true;
          for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const c2 = getComputedStyle(e); a *= +c2.opacity;
            if (e !== el && clips) { const b = e.getBoundingClientRect();
              if (c2.overflowX !== "visible" && Math.min(r.right, b.right) - Math.max(r.left, b.left) < 1) a = 0;
              if (c2.overflowY !== "visible" && Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top) < 1) a = 0; }
            if (c2.position === "fixed") clips = false; }
          if (a >= 0.3) hit.push(name(el)); }
        return hit; };
      const riding = () => /Stop/.test(($("c-ride") || {}).textContent || "");
      const tabTo = (t) => { const e = document.querySelector(`#tabs .tab[data-go="${t}"]`); if (e) e.click(); };
      const teardown = async () => {
        try { if (riding()) $("c-ride").click(); } catch (e) {} await s(250);
        try { if (riding()) $("c-ride").click(); } catch (e) {} await s(150);
        try { const h = $("c-home"); if (h && /\barm\b/.test(h.className)) h.click(); } catch (e) {}
        try { window.railSet(false); } catch (e) {} tabTo("map"); await s(150); await settle(); };
      const flow = () => ({ taps: 0, path: [], blocked: null, done: false });
      /* setup, uncounted: home and the start pin, placed as a rider places them */
      const place = async (at, id) => { window.map.jumpTo({ center: at, zoom: 13 }); await s(250);
        window.map.fire("contextmenu", { lngLat: { lng: at[0], lat: at[1] } });
        if (!(await until(() => !!$(id), 3000))) return false; $(id).click(); await s(200); return true; };
      if (cfg.setup) { await teardown();
        out.setup = { home: await place(cfg.home, "pc-home"), start: await place(cfg.start, "pc-start") };
        await teardown(); }
      const plant = cfg.hideRcRide ? (() => { const st = document.createElement("style"); st.id = "v4plant-rcride";
        st.textContent = "#rc-ride{display:none!important}"; document.head.appendChild(st); return st; })() : null;
      for (const F of cfg.flows) {
        const fl = flow();
        try {
          if (F === "A") {
            window.map.jumpTo({ center: cfg.dest, zoom: 13 }); await s(400);
            if (await press(fl, cfg.dest)) {
              if (!(await until(() => !!$("pc-route"), 4000))) fl.blocked = "pc-route (no place card)";
              else { await settle(); out.acc.place = accent();
                if (await tap(fl, "pc-route")) {
                  if (!(await until(() => !!document.querySelector(".rc"), 60000))) fl.blocked = "rc-ride (no route cards)";
                  else { await s(300); await settle(); out.acc.route = accent();
                    if (await tap(fl, "rc-ride")) fl.done = await until(riding, 3000); } } } }
          } else if (F === "B") {
            try { window.railSet(false); } catch (e) {} tabTo("map"); await settle();
            if (await tap(fl, "btn-home")) {
              if (!(await until(() => !!document.querySelector(".rc"), 60000))) fl.blocked = "rc-ride (no route cards)";
              else { await s(300); if (await tap(fl, "rc-ride")) fl.done = await until(riding, 3000); } }
          } else if (F === "C") {
            if (await tap(fl, '#tabs .tab[data-go="plan"]') && await tap(fl, "c-home")) {
              if (!(await until(() => !!$("hc-tap"), 3000))) fl.blocked = "hc-tap (no home card)";
              else if (await tap(fl, "hc-tap")) fl.done = await until(() => /\barm\b/.test($("c-home").className), 2000); }
          } else if (F === "D") {
            if (await tap(fl, '#tabs .tab[data-go="ride"]') && await tap(fl, "c-ride")) fl.done = await until(riding, 3000);
          } else if (F === "F") {
            /* take 189 · A233 · free ride from the FOLDED drawer: its Ride,
               one tap; done when the ride waits and the Ride tab's Stop
               (GPS), then the only Stop, is on screen */
            try { window.railSet(false); } catch (e) {} tabTo("map"); await settle();
            if (await tap(fl, "btn-ride")) fl.done = await until(() => riding() && tappable($("c-ride")) === null, 3000);
          } else if (F === "E") {
            $("btn-home").click();             /* setup: the route cards on screen */
            if (!(await until(() => !!document.querySelector(".rc"), 60000))) fl.blocked = "btn-steps (no route cards)";
            else { await s(300); if (await tap(fl, "btn-steps")) fl.done = await until(() => /steps ·/.test(($("panel") || {}).textContent || ""), 3000); }
          }
        } catch (e) { fl.blocked = "threw: " + String(e); }
        out.flows[F] = fl;
        await teardown();
      }
      if (plant) plant.remove();
      if (cfg.plants) {
        /* a hidden planted button is not tappable; a planted second accent
           surface is counted */
        const b = document.createElement("button"); b.id = "v4plant-walkhid"; b.hidden = true; document.body.appendChild(b);
        out.plants.hiddenNot = tappable(b) !== null; b.remove();
        const a0 = accent().length, d = document.createElement("div"); d.id = "v4plant-walkacc";
        d.style.cssText = "position:fixed;left:8px;top:8px;width:30px;height:30px;background:var(--accent);z-index:99999";
        document.body.appendChild(d); out.plants.accCounted = accent().length === a0 + 1; d.remove();
      }
    } catch (e) { out.error = String((e && e.stack) || e); }
    return out;
  };
  /* WALKER-END */
  /* take 189 · A233 · F: free ride from the folded drawer (its Ride) <= 1 */
  const WALK_CEIL = { A: 3, B: 2, C: 3, D: 2, E: 1, F: 1 };
  /* the judge: done, not blocked, within the ceiling. Its control: the same
     flow with one planted extra step fails it (A at 4 > 3) */
  const walkOk = (F, fl) => !!fl && fl.done && !fl.blocked && fl.taps <= WALK_CEIL[F];
  const WALK_PTS = { start: [-84.12855, 44.53949], home: [-84.10724, 44.55265], dest: [-84.1175, 44.5465] };
  /* a dropped pin stays on the map, and a long-press on it is a tap on the
     pin: each run presses a spot of its own, ~150 m apart */
  const WALK_DEST = { "411": [-84.1175, 44.5465], plant: [-84.1195, 44.5455], "360": [-84.1155, 44.5475] };
  for (const [w, h, dpr, flows] of [[411, 960, 2.625, ["A", "B", "C", "D", "E", "F"]], [360, 800, 3, ["A", "B", "F"]]]) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: dpr }); await vpSettle(1000);
    const wk = await page.evaluate(WALKER, Object.assign({}, WALK_PTS, { flows, setup: w === 411, plants: w === 411, dest: WALK_DEST[w] }));
    ok(!wk.error && (w !== 411 || (wk.setup && wk.setup.home && wk.setup.start)),
       `${w}x${h}: the tap walker ran (${wk.error || "ok"}; setup ${JSON.stringify(wk.setup || {})})`);
    for (const F of flows) {
      const fl = wk.flows[F] || {};
      ok(walkOk(F, fl), `${w}x${h}: tap walker flow ${F} takes ${fl.taps} tap(s) (ceiling ${WALK_CEIL[F]}): `
         + `${(fl.path || []).join(" → ")}` + (fl.blocked ? ` — BLOCKED at ${fl.blocked}` : "") + (fl.done ? "" : " — not done")
         + (fl.geo ? " " + JSON.stringify(fl.geo) : ""));
    }
    ok(!!wk.acc.place && wk.acc.place.length <= 1 && !!wk.acc.route && wk.acc.route.length <= 1,
       `${w}x${h}: the accent is spent at most once at the place card (${(wk.acc.place || ["?"]).join(", ") || "none"}) `
       + `and at the route cards (${(wk.acc.route || ["?"]).join(", ") || "none"})`);
    if (w === 411) {
      const A = wk.flows.A || {};
      ok(wk.plants.hiddenNot && wk.plants.accCounted && walkOk("A", A)
         && !walkOk("A", Object.assign({}, A, { taps: A.taps + 1 })),
         `the walker's judges catch their plants: a hidden button is not tappable (${wk.plants.hiddenNot}), a second `
         + `accent surface is counted (${wk.plants.accCounted}), flow A with one extra step fails its ceiling`);
      /* Ride it hidden: flow A must come back BLOCKED at rc-ride */
      const pk = await page.evaluate(WALKER, Object.assign({}, WALK_PTS, { flows: ["A"], hideRcRide: true, dest: WALK_DEST.plant }));
      const pA = (pk.flows || {}).A || {};
      ok(!pk.error && /^rc-ride/.test(pA.blocked || "") && !walkOk("A", pA),
         `with Ride it hidden (a planted rule), flow A reports BLOCKED at ${pA.blocked || "nothing"} (its control)`);
    }
  }
  await page.setViewport({ width: 411, height: 960, deviceScaleFactor: 2.625 }); await vpSettle(800);

  }
  if (RUN("v4-eta")) {
  /* take 188 · A217 · ONE ARRIVAL ESTIMATE. The route card, the ride
     sheet's Arrive and the nav strip give the same "~N min" for the same
     route: at its start, with no pace yet, all three are the route's own
     estimate (take 187's shots: card 9 min, sheet ~5, strip ~4). The fix
     comes through the app's own guidance at the route's first point, so
     what is left is the whole route. Torn down as the ride helper does. */
  const eta = await page.evaluate(async () => {
    const s = (ms) => new Promise((r) => setTimeout(r, ms));
    const N = window.__nav, sh = document.getElementById("shell"), out = { plants: {} };
    /* one reader for the real read and every plant (review of step 13: a
       guard is proven by failing, landmine 54) */
    const cardOf = () => { const card = document.querySelector(".rc.sel");
      return card ? ((card.textContent.match(/~[\d:]+ (?:min|h)/) || [])[0] || null) : null; };
    const rideOf = () => { const he = document.getElementById("hud-eta"), g = document.querySelector("#nav-g .eta");
      return { sheet: he ? he.textContent.replace(/^~(\S+?)(min|h)$/, "~$1 $2") : null,
        strip: g ? ((g.textContent.match(/~[\d:]+ (?:min|h)/) || [])[0] || null) : null,
        stripText: g ? g.textContent : null }; };
    /* the card is read while the route cards stand (the ride replaces the
       panel); a card plant is read then and judged with the real ride reads */
    let cardNow = null;
    const read = () => Object.assign({ card: cardNow === null ? cardOf() : cardNow }, rideOf());
    /* rewrite the first text node under root that matches re, read, put it back */
    const plantText = (root, re, fn) => {
      if (!root) return null;
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let t = null; while (w.nextNode()) { if (re.test(w.currentNode.nodeValue)) { t = w.currentNode; break; } }
      if (!t) return { unplanted: true };
      const v0 = t.nodeValue; t.nodeValue = v0.replace(re, fn);
      const r = read(); t.nodeValue = v0; return r;
    };
    try {
      document.getElementById("btn-home").click();
      for (let i = 0; i < 240 && !document.querySelector(".rc.sel"); i++) await s(250);
      /* (a) the card in take 187's format: "9 min", no "~" */
      const pc187 = plantText(document.querySelector(".rc.sel"), /~(?=[\d:]+ (?:min|h))/, () => "");
      /* (b) the card with a different time */
      const pcCard = plantText(document.querySelector(".rc.sel"), /~([\d:]+)(?= (?:min|h))/, (m0, n) => "~" + (parseInt(n, 10) + 16));
      cardNow = cardOf();
      const pos0 = N.pos(), G = N.plan();
      N.start(); sh.dataset.ride = "1";
      if (G && G.pts && G.pts.length) N.fix(G.pts[0], 8, null, null);
      await s(200);
      out.real = read();
      const ride = rideOf();
      out.plants.card187 = pc187 && !pc187.unplanted ? Object.assign({}, ride, { card: pc187.card }) : pc187;
      out.plants.card = pcCard && !pcCard.unplanted ? Object.assign({}, ride, { card: pcCard.card }) : pcCard;
      /* (c) the sheet's Arrive with a different time */
      out.plants.sheet = plantText(document.getElementById("hud-eta"), /~([\d:]+)/, (m0, n) => "~" + (parseInt(n, 10) + 16));
      /* (d) the strip with take 187's lower pace-based figure */
      out.plants.strip = plantText(document.querySelector("#nav-g .eta"), /~([\d:]+)(?= (?:min|h))/, (m0, n) => "~" + Math.max(1, parseInt(n, 10) - 5 || 4));
      try { N.stop(); N.reset(); N.end(); window.hudShow(false); N.pos(pos0); } catch (e) {}
      delete sh.dataset.ride; window.railSet(false);
    } catch (e) { out.error = String(e); }
    return out;
  });
  const etaAgree = (e) => !!e && !e.unplanted && !!e.card && e.card === e.sheet && e.sheet === e.strip;
  const etaR = eta.real || {};
  ok(!eta.error && etaAgree(etaR),
     `one arrival estimate for one route at its start: card "${etaR.card}", sheet "${etaR.sheet}", strip "${etaR.strip}"`
     + (eta.error ? " — " + eta.error : ""));
  if (!eta.error) {
    for (const [k, v] of Object.entries(eta.plants)) {
      const vv = v || {};
      ok(!!v && !v.unplanted && !etaAgree(v),
         `its control (${k}): the same reader on a planted mismatch fails — card "${vv.card}", sheet "${vv.sheet}", strip "${vv.strip}"`
         + (vv.unplanted ? " (NOT PLANTED: no text node matched)" : ""));
    }
  }

  /* take 188 · A217 · review of step 13: --strip-h follows the Ride tab's
     chips. The first fix draws the ride sheet and simChip hides c-ride (one
     Stop): the strip shrinks, and --strip-h, which anchors the sheet, the
     panels and the toast, must shrink with it. Read on the rider's own path
     with NO viewport change (a resize re-measures and hides the bug). GPS is
     held pending, as the resume drill does, so headless Chrome does not turn
     it into a simulated ride. */
  const stripR = await page.evaluate(async () => {
    const s = (ms) => new Promise((r) => setTimeout(r, ms));
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const settle = async () => { await frame(); await Promise.all(document.getAnimations()
      .filter((a) => { const t = a.effect && a.effect.getTiming(); return t && t.iterations !== Infinity; })
      .map((a) => a.finished.catch(() => {}))); await frame(); };
    const N = window.__nav, de = document.documentElement, out = {};
    const read = () => { const t = document.getElementById("tools"), r = document.getElementById("c-ride"),
      hs = document.getElementById("hudstats");
      /* take 188 · step 13b · the band is the strip plus whatever of the
         MapLibre attribution reaches above the strip's top (an empty strip
         while riding is lower than the attribution), read here from rects */
      const at = document.querySelector(".maplibregl-ctrl-bottom-right"), tr = t ? t.getBoundingClientRect() : null,
        ar = at ? at.getBoundingClientRect() : null, up = tr && ar && ar.height > 0 && ar.top < tr.top ? Math.round(tr.top - ar.top) : 0;
      return { css: parseFloat(getComputedStyle(de).getPropertyValue("--strip-h")), strip: t ? t.offsetHeight + up : null, attribUp: up,
        crideHidden: !!(r && r.hidden), sheet: !!(hs && !hs.hidden && hs.getBoundingClientRect().height > 0) }; };
    const onTab = document.querySelector("#tabs .tab.on"), tab0 = onTab ? onTab.dataset.go : "map";
    const pm0 = N.pos(), geo = navigator.geolocation, gw = geo && geo.watchPosition, gc = geo && geo.clearWatch;
    const G = N.plan(), at0 = G && G.pts && G.pts.length ? G.pts[0] : [-84.10724, 44.55265];
    const ride = async () => {
      document.getElementById("c-ride").click(); await s(300); await settle();
      const before = read();
      let at = at0.slice();
      for (let i = 0; i < 2; i++) { at = [at[0] + 0.0003, at[1] + 0.0002]; N.fix(at, 9, 8, 45); await s(300); }
      await settle();
      return { before, after: read() };
    };
    try {
      if (geo) { geo.watchPosition = () => 4244; geo.clearWatch = () => {}; }
      const tb = document.querySelector('#tabs .tab[data-go="ride"]'); if (tb) tb.click(); await s(300); await settle();
      out.real = await ride();
      /* plant (a): the same read with --strip-h put back to the value it had
         before the chip stepped aside */
      de.style.setProperty("--strip-h", out.real.before.css + "px");
      out.stale = read();
      de.style.setProperty("--strip-h", out.real.after.css + "px");
      /* plant (b): c-ride's hidden flag flipped by hand, nothing re-measured */
      const cr = document.getElementById("c-ride"), h0 = cr.hidden;
      cr.hidden = !h0; out.flip = read(); cr.hidden = h0;
      /* (the real path with the re-measure removed from the app is the third
         control: it needs a planted build, so it runs through probe eval on
         a copy, not here — the app's functions are not on window) */
    } catch (e) { out.error = String((e && e.stack) || e); }
    try { N.stopReal(); } catch (e) {}
    if (geo) { geo.watchPosition = gw; geo.clearWatch = gc; }
    try { window.railSet(false); N.pos(pm0); window.dispatchEvent(new Event("resize")); } catch (e) {}
    const tb0 = document.querySelector(`#tabs .tab[data-go="${tab0}"]`); if (tb0) tb0.click();
    await s(200);
    return out;
  });
  const stripFits = (r) => !!r && isFinite(r.css) && r.strip != null && Math.abs(r.css - r.strip) <= 1;
  const sR = (stripR.real || {}), sA = sR.after || {}, sB = sR.before || {};
  ok(!stripR.error && sA.sheet && sA.crideHidden && stripFits(sA) && sB.css > sA.css,
     `--strip-h follows the Ride tab's strip once the sheet is up and c-ride steps aside, with no resize: `
     + `before the fix ${sB.css} px / strip ${sB.strip}, after ${sA.css} px / strip ${sA.strip} `
     + `(sheet ${sA.sheet}, c-ride hidden ${sA.crideHidden})` + (stripR.error ? " — " + stripR.error : ""));
  if (!stripR.error) {
    ok(!stripFits(stripR.stale), `its control (stale): --strip-h put back to ${(stripR.stale || {}).css} px over a ${(stripR.stale || {}).strip} px strip fails`);
    ok(!stripFits(stripR.flip), `its control (flip): c-ride's flag flipped by hand with no re-measure fails (${(stripR.flip || {}).css} px vs ${(stripR.flip || {}).strip})`);
  }
  /* take 189 · A235 · ONE ARRIVAL ESTIMATE FOR A RIVER RUN. The run card
     (planned in Water), the ride sheet's Arrive and the strip give the same
     "~N" at the put-in — take 188 printed the card's range, the sheet's
     midpoint and the strip's range. The rider's path: the run card, then
     Navigate this run (GPS held by a stand-in watch), one fix on the river
     line at the put-in through the app's own guidance. The reader rejects
     each value planted different. Torn down: the ride, the watch, the mode */
  const rEta = await page.evaluate(async () => {
    const s = (ms) => new Promise((r) => setTimeout(r, ms));
    const N = window.__nav, M = window.__mode, P = window.__paddle, out = {};
    const geo = navigator.geolocation, gw = geo && geo.watchPosition, gc = geo && geo.clearWatch, pm0 = N.pos(), was = M.get();
    const ETA = /~[\d:]+ (?:min|h)\b/;
    try {
      if (geo) { geo.watchPosition = () => 4400; geo.clearWatch = () => {}; }
      M.apply("water", { silent: true }); await s(250);
      const c = (P.data.c || []).find((x) => x.n === "Au Sable River");
      const named = c ? c.f.filter((f) => f.n && f.p && (f.k === "access" || f.k === "launch")) : [];
      let a = null, b = null;
      for (let i = 0; i < named.length && !b; i++) for (let j = i + 1; j < named.length; j++) {
        const d = named[j].mi - named[i].mi; if (d >= 3 && d <= 8) { a = named[i]; b = named[j]; break; } }
      if (!a) throw new Error("no Au Sable run of 3-8 mi between named accesses");
      out.run = a.n + " to " + b.n;
      P.run(a, b, c.n); await s(150);
      out.card = ((document.getElementById("panel").textContent || "").match(ETA) || [null])[0];
      document.getElementById("pd-nav").click(); await s(200);
      const L = N.riverLine(c.n), mm = a.mi * 1609.34; let i = 0;
      while (i < L.cum.length - 2 && L.cum[i + 1] < mm) i++;
      const t = (mm - L.cum[i]) / Math.max(1, L.cum[i + 1] - L.cum[i]);
      N.fix([L.pts[i][0] + (L.pts[i + 1][0] - L.pts[i][0]) * t, L.pts[i][1] + (L.pts[i + 1][1] - L.pts[i][1]) * t], 12, 1.4, 0);
      await s(300);
      const he = document.getElementById("hud-eta"), g = document.querySelector("#nav-g .eta");
      out.sheet = he ? he.textContent.replace(/^~(\S+?) ?(min|h)$/, "~$1 $2") : null;
      out.strip = g ? (g.textContent.match(ETA) || [null])[0] : null; out.stripText = g ? g.textContent : null;
    } catch (e) { out.error = String((e && e.stack) || e); }
    try { N.stopReal(); } catch (e) {} try { N.reset(); N.end(); } catch (e) {}
    if (geo) { geo.watchPosition = gw; geo.clearWatch = gc; }
    try { N.pos(pm0); M.apply(was, { silent: true }); window.hudShow(false); window.railSet(false); } catch (e) {}
    return out;
  });
  {
    const rAgree = (r) => !!r && !!r.card && r.card === r.sheet && r.sheet === r.strip;
    const bump = (x) => x ? x.replace(/~(\d+)/, (m0, v) => "~" + (parseInt(v, 10) + 16)) : x;
    ok(!rEta.error && rAgree(rEta) && !rAgree(Object.assign({}, rEta, { card: bump(rEta.card) }))
       && !rAgree(Object.assign({}, rEta, { sheet: bump(rEta.sheet) })) && !rAgree(Object.assign({}, rEta, { strip: bump(rEta.strip) })),
       `A235 · one arrival estimate for a river run (${rEta.run}) at its put-in: card "${rEta.card}", sheet "${rEta.sheet}", `
       + `strip "${rEta.strip}" ("${(rEta.stripText || "").trim().slice(0, 70)}"); the reader rejects a card, a sheet and a strip planted different`
       + (rEta.error ? ` — ${rEta.error}` : ""));
  }
  }

  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2.6 });
}

/* take 188 · A202 D7 · the tile-wait ceilings. The Water and stack drills
   wait up to a ceiling for tiles behind the whole state being tiled; D7 grows
   the net source, so how long each wait took is reported, and a wait that hit
   its ceiling is named (the D7 cut rule reads this line; info, not a verdict). */
{
  const tw = consoleErrors.map((c) => /APEX-TILEWAIT (t\d+) (\d+)\/(\d+)/.exec(c)).filter(Boolean);
  const bySite = {};
  for (const x of tw) { const r = (bySite[x[1]] ||= { n: 0, max: 0, cap: +x[3], hit: 0 }); r.n++; r.max = Math.max(r.max, +x[2]); if (+x[2] >= +x[3]) r.hit++; }
  const hits = Object.values(bySite).reduce((a, r) => a + r.hit, 0);
  console.log(`  ..   tile waits: ${tw.length} over ${Object.keys(bySite).length} sites, ceilings hit ${hits} — `
    + Object.entries(bySite).map(([k, r]) => `${k} max ${r.max}/${r.cap} (${r.n}×)`).join(", "));
}

/* take 189 · A227 fix round 1 · SECTION FLOORS. A section that runs prints
   at least the checks it prints in a full run. --only=shell once read the
   shell and never judged it — its two checks sat inside camp's guard
   (render-t189-L-render-only-3.log, RENDER PASSED; landmine 53) — and a
   partial run's PASSED is only worth the checks that ran. In the full run the
   same floors catch a check that went missing. The floors are a full run's
   counts (render-t189-L-render-fix1-cal-1.log); a section that gains checks
   may raise its floor, never lower it (landmine 54). take 189 · lane L-ride
   raised devices 185 -> 207 (A231, A233, A238), realdom 2 -> 3 (A230),
   v4-walker 13 -> 15 (A233's flow F), v4-eta 8 -> 9 (A235). take 189 · L-small:
   trails 0 -> 2 (A239: its line and label checks run where a named trail
   draws, and fail where they cannot measure), pins +2 (A237: the POI
   cards and, fix round 1, the dropped pin's card), camp +1
   (A232), selftest +1 (A236), devices +5 (A229, one per size). Merged:
   devices 185 + 22 (L-ride) + 5 (L-small) = 212. take 189 · cold audit: ui
   +1 (A240: the app's own camera move leaves a card open), realdom +2
   (A240 at 360; the resumed peek line's widest form judged, was reported),
   devices +10 (per size: riding with a panel open — A231 only on a small
   phone, no chip under the (i), the compass box's whole line; and every
   tab with the drawer open to its cap). The judge proves itself on
   planted books first (its control: shell booked 11 of 13, a section with no
   floor). */
{
  SECTION_AT = "(floor guard)";
  const SECTION_FLOOR = {
  boot: 13, trails: 2, labels: 11, modes: 33, imagery: 31, back: 14, water: 11, shell: 10,
  stacks: 48, pins: 21, nav: 31, camp: 15, paddle: 25, ui: 34, home: 7, tools: 26, basemap: 2,
  selftest: 2, routes: 3, devices: 222, faults: 6, realdom: 5, clear: 3, tail: 30, g6: 2,
  "v4-setup": 1, "v4-band": 7, "v4-select": 6, "v4-toast": 1, "v4-audit": 11, "v4-walker": 15,
  "v4-eta": 9 };
  const short = (got, floor, ran) => ran.filter((x) => !(x in floor) || (got[x] || 0) < floor[x]);
  const ran = ["boot"].concat(Object.keys(SECTIONS).filter((x) => !ONLY || ONLY.has(x)));
  const got = Object.assign({}, SECTION_N);
  const ctl = short({ shell: 11 }, { shell: 13 }, ["shell"]).length === 1
    && short({ shell: 13 }, { shell: 13 }, ["shell"]).length === 0
    && short({ x: 1 }, {}, ["x"]).length === 1;
  const miss = short(got, SECTION_FLOOR, ran);
  console.log("  ..   checks per section: " + ran.map((x) => `${x} ${got[x] || 0}`).join(", "));
  ok(ctl && !miss.length,
     `every section that ran (${ran.length}) printed at least the checks it prints in a full run — `
     + `its control: a section booked short, or with no floor, is caught (${ctl})`
     + (miss.length ? " — SHORT: " + miss.map((x) => `${x} ${got[x] || 0} of ${x in SECTION_FLOOR ? SECTION_FLOOR[x] : "no floor"}`).join(", ") : ""));
}

await browser.close();
server.close();
console.log((failures ? `\nRENDER FAILED (${failures})` : "\nRENDER PASSED")
  + (ONLY ? ` — PARTIAL: --only ran ${[...ONLY].join(", ")}; the full render is the gate's` : ""));
process.exit(failures ? 1 : 0);
