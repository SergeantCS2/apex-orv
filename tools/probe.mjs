/* PERMANENT probe scaffold (take 113). For ~30 takes every visual question was
   answered by rewriting this same 30-line server+puppeteer boilerplate into a
   throwaway _show.mjs — pure waste. Now: node tools/probe.mjs shots|eval <js>

   take 186 · A206 · the maintainer: "add a way for you to directly test these
   new features and bug fixes … screenshot testing and browser testing. I will
   look at your findings directly in screenshots." `node tools/probe.mjs take`
   walks the scenes a take changed and writes PNGs to $APEX_SHOTS or
   ~/apex-shots/t<take>/ (never inside the repo, never a sandbox path — the
   old /mnt/user-data path was landmine-shaped); the builder sends them to the
   maintainer before the take is sealed. */
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const WWW = join(ROOT, "www");
const TAKE = (readFileSync(join(ROOT, "BUILD"), "utf8").match(/OFFROAD_TAKE=(\d+)/) || [0, "0"])[1];
const OUT = process.env.APEX_SHOTS || join(process.env.HOME || ".", "apex-shots", "t" + TAKE);
/* take 187 · A211: .svg/.woff2/.png/.webp were served as octet-stream */
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".pbf": "application/x-protobuf" };
const mode = process.argv[2] || "shots";
/* what the `styles` dump records per element — the properties a token pass
   can move; sizes that follow from content are left out as noise */
const STYLE_PROPS = ["display", "visibility", "opacity", "color", "background-color",
  "background-image", "border-top-color", "border-right-color", "border-bottom-color",
  "border-left-color", "border-top-width", "border-right-width", "border-bottom-width",
  "border-left-width", "border-top-left-radius", "border-top-right-radius",
  "border-bottom-right-radius", "border-bottom-left-radius", "box-shadow", "outline-color",
  "outline-width", "font-family", "font-size", "font-weight", "font-style", "line-height",
  "letter-spacing", "text-transform", "text-shadow", "-webkit-text-stroke-width",
  "-webkit-text-stroke-color", "padding-top", "padding-right", "padding-bottom",
  "padding-left", "margin-top", "margin-right", "margin-bottom", "margin-left", "min-height",
  "max-height", "min-width", "z-index", "gap", "transition-duration", "transition-timing-function",
  "animation-name", "fill", "stroke", "backdrop-filter", "filter", "cursor"];
/* take 187 · A208 · `stylediff a.json b.json` compares two `styles` dumps and
   needs no browser: the token pass must leave every computed style as it was */
if (mode === "stylediff") {
  const [A, B] = [process.argv[3], process.argv[4]].map((f) => JSON.parse(readFileSync(f, "utf8")));
  let n = 0;
  for (const st of Object.keys(A)) {
    const a = A[st] || {}, b2 = B[st] || {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b2)])) {
      if (a[k] === b2[k]) continue;
      n++;
      if (n <= 60) {
        const pa = (a[k] || "(absent)").split("|"), pb = (b2[k] || "(absent)").split("|");
        const d = pa.map((v, i) => v !== pb[i] ? `${STYLE_PROPS[i] || i}: ${v} → ${pb[i]}` : null).filter(Boolean);
        console.log(`  ${st} · ${k}: ${d.join("; ") || "(element absent on one side)"}`);
      }
    }
  }
  console.log(n ? `STYLES DIFFER: ${n} element-states` : "STYLES IDENTICAL");
  process.exit(n ? 1 : 0);
}
/* take 188 · G13 · the tour and guide keys are READ from the built app, never
   typed here: the keys are versioned with their content (A147) and a typed
   copy goes stale on the take that bumps them, when the tour then covers every
   scene (landmine 222). A key that cannot be read ends the run — the planted
   strings prove the reader first. */
const appKey = (js, name) => { const m = new RegExp("\\bvar\\s+" + name + "\\s*=\\s*['\"]([^'\"]+)['\"]").exec(js || "");
  return m ? m[1] : null; };
if (appKey("var TOURKEY='apex.tour.v9',TOUR={}", "TOURKEY") !== "apex.tour.v9" || appKey("var TOUR={on:false}", "TOURKEY") !== null) {
  console.log("FAIL: the storage-key reader failed its planted strings"); process.exit(1); }
/* a single-file build inlines the script into index.html */
const APPJS = [join(WWW, "app.js"), join(WWW, "index.html")].filter((f) => existsSync(f))
  .map((f) => readFileSync(f, "utf8")).find((t) => /\bvar\s+(TOURKEY|GUIDEKEY)\b/.test(t)) || "";
const TOURKEY = appKey(APPJS, "TOURKEY"), GUIDEKEY = appKey(APPJS, "GUIDEKEY");
if (!TOURKEY || !GUIDEKEY) {
  console.log(`FAIL: cannot read ${!TOURKEY ? "TOURKEY" : "GUIDEKEY"} from ${join(WWW, "app.js")} — the tour or guide would cover every scene`);
  process.exit(1); }
/* stderr, not stdout: `probe.mjs eval x.js > out.json` must stay pure JSON for
   `pins_probe.py steps --live out.json` (step-2 review) */
console.error(`  storage keys from www/app.js: ${TOURKEY}, ${GUIDEKEY}`);
/* take 188 · APEX_VIEWPORT=WxH[xDPR] sets any mode's viewport, so an eval can
   measure the small phone (360x800x3) or the inner screen */
const VP = /^(\d+)x(\d+)(?:x([\d.]+))?$/.exec(process.env.APEX_VIEWPORT || "");
if (process.env.APEX_VIEWPORT && !VP) { console.log("FAIL: APEX_VIEWPORT must read WxH or WxHxDPR"); process.exit(1); }
const srv = createServer((rq, rs) => {
  const p = join(WWW, decodeURIComponent(rq.url.split("?")[0]));
  if (!existsSync(p) || p.endsWith("/")) { rs.writeHead(404); return rs.end(); }
  rs.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
  rs.end(readFileSync(p));
}).listen(0);
const pup = (await import("puppeteer")).default;
const b = await pup.launch({ headless: "new", args: ["--no-sandbox",
  "--disable-setuid-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader",
  "--disable-dev-shm-usage"] });
const pg = await b.newPage();
/* take 187 · the V4 modes shoot the Fold's cover screen (render's device
   matrix, A197 Q3); the older modes keep the harness's phone viewport */
const COVER = { width: 411, height: 960, deviceScaleFactor: 2.625 };
await pg.setViewport(VP ? { width: +VP[1], height: +VP[2], deviceScaleFactor: +(VP[3] || 2) }
  : mode === "v4" || mode === "styles" || mode === "badges" ? COVER
  : { width: 412, height: 915, deviceScaleFactor: 2 });
/* take 187 · landmine 222: in a fresh profile the first-run tour and guide
   cover every scene — mark both seen before the app reads them */
await pg.evaluateOnNewDocument((t, g) => { try { localStorage.setItem(t, "1");
  localStorage.setItem(g, "1"); } catch (e) {} }, TOURKEY, GUIDEKEY);
const URL0 = `http://127.0.0.1:${srv.address().port}/index.html`;
/* landmine 222: the harness hooks exist before the splash is gone — wait for
   what render checks, the splash node removed and #shell ready */
const ready = async () => {
  await pg.evaluate(async () => { const s = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 120; i++) { if (window.map?.loaded?.()) return; await s(250); } });
  await pg.waitForFunction(() => !document.getElementById("splash") &&
    /\bready\b/.test((document.getElementById("shell") || {}).className || ""), { timeout: 120000 })
    .catch(() => console.log("  (the splash was still up after 120 s)"));
};
await pg.goto(URL0, { waitUntil: "networkidle0" });
await ready();
if (mode === "shots") {
  const out = OUT; mkdirSync(out, { recursive: true });
  const s = (ms) => new Promise((r) => setTimeout(r, ms));
  const shot = async (name) => pg.screenshot({ path: `${out}/${name}.png` });
  await pg.evaluate(() => { try { window.guideClose(true); } catch (e) {} });
  await s(300); await shot("1-map-at-rest");
  await pg.evaluate(async () => { const s2=(ms)=>new Promise(r=>setTimeout(r,ms));
    const src = window.map.getStyle().sources.poi.data.features;
    const at = src.find(f=>/Pink Store/.test(f.properties.n||""))||src[0];
    window.map.jumpTo({ center: at.geometry.coordinates, zoom: 14.5 }); await s2(1500);
    const p = window.map.project(at.geometry.coordinates);
    const cv = window.map.getCanvas(); const r = cv.getBoundingClientRect();
    for (const t of ["mousedown","mouseup","click"])
      cv.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true,
        clientX:r.left+p.x, clientY:r.top+p.y}));
  }); await s(900); await shot("2-place-card-open");
  await pg.evaluate(() => document.querySelector('#tabs .tab[data-go="plan"]').click());
  await s(400); await shot("3-plan-tab");
  await pg.evaluate(() => { document.querySelector('#tabs .tab[data-go="map"]').click();
    document.getElementById("c-layers")?.click(); }); await s(500); await shot("4-layers-panel");
  await pg.evaluate((g) => { document.getElementById("c-layers")?.click();
    try { localStorage.removeItem(g); } catch(e){}
    window.guideShow(); }, GUIDEKEY); await s(500); await shot("5-first-run-guide");
  console.log("screens written to " + out);
} else if (mode === "take") {
  /* the scenes takes 185–186 changed: the first-open card, Camp at three
     scales (the maintainer's five screenshots were 5, 3 and 2 miles),
     Layers → Pins in Camp, the Set home card, a pin card. Deterministic
     cameras from the bundle's anchors so a scene means the same each take. */
  const out = OUT; mkdirSync(out, { recursive: true });
  const s = (ms) => new Promise((r) => setTimeout(r, ms));
  const shot = async (name) => { await pg.screenshot({ path: `${out}/${name}.png` }); console.log("  " + name + ".png"); };
  /* map.loaded() flips before the app's own load handler has run, and that
     handler folds the rail (railSet(false)) — two unfolds lost that race
     before this wait existed. The hooks are defined by the load handler, so
     their presence proves it ran. */
  await pg.waitForFunction(() => window.__nav && window.__stack && window.__mode, { timeout: 60000 });
  await s(300);
  const settle = async () => { await pg.evaluate(async () => { const s2 = (ms) => new Promise((r) => setTimeout(r, ms));
    const m = window.map; try { window.__stack && window.__stack.run(); } catch (e) {}
    for (let i = 0; i < 40; i++) { if (m.areTilesLoaded()) break; await s2(300); }
    await Promise.race([new Promise((r) => m.once("idle", r)), s2(5000)]); await s2(500); }); };
  await pg.evaluate(() => { try { window.__tour && window.__tour.close && window.__tour.close(); } catch (e) {}
    try { window.guideClose(true); } catch (e) {}
    /* unfold the drawer through the app's own hook, not a peek click that
       toggles whatever state it finds (the first run of this scene shot a
       folded drawer — the visual loop's first catch, take 186) */
    try { window.railSet(true); } catch (e) {} });   /* a top-level function: a global */
  await s(700); await shot("01-first-open-card");
  await pg.evaluate(() => { try { window.railSet(false); } catch (e) {} });
  const gr = await pg.evaluate(() => { const a = (window.BUNDLE && window.BUNDLE.anchors || []).find((x) => /Grayling/.test(x[0]));
    return a ? [a[1], a[2]] : null; }) || [-84.7145, 44.6614];
  await pg.evaluate(() => window.__mode.apply("camp", { silent: true })); await s(300);
  for (const [z, label] of [[9.0, "5mi"], [9.8, "3mi"], [10.6, "2mi"]]) {
    await pg.evaluate((c, z) => window.map.jumpTo({ center: c, zoom: z }), gr, z); await settle(); await shot(`02-camp-${label}-z${z}`); }
  await pg.evaluate(() => document.getElementById("c-layers").click()); await s(500);
  await pg.evaluate(() => { const p = document.getElementById("lyrpanel"); if (p) p.scrollTop = p.scrollHeight; }); await s(200);
  await shot("03-layers-pins-in-camp");
  await pg.evaluate(() => document.getElementById("c-layers").click()); await s(200);
  await pg.evaluate(() => document.querySelector('#tabs .tab[data-go="plan"]').click()); await s(300);
  await pg.evaluate(() => document.getElementById("c-home").click()); await s(500); await shot("04-set-home-card");
  await pg.evaluate(() => document.querySelector('#tabs .tab[data-go="map"]').click()); await s(200);
  console.log("take " + TAKE + " scenes written to " + out);
} else if (mode === "state") {
  const out = OUT; mkdirSync(out, { recursive: true });
  const s = (ms) => new Promise((r) => setTimeout(r, ms));
  await pg.evaluate(() => { try { window.guideClose(true); } catch (e) {} });
  await pg.evaluate(() => window.map.jumpTo({ center: [-85.7, 44.9], zoom: 5.75 }));
  await s(9000);
  await pg.screenshot({ path: `${out}/state-overview.png` });
  console.log("state shot written");
} else if (mode === "basemaps") {
  /* One screenshot per basemap state, named by the button's own label, plus a
     card open on hybrid — the state Jacob actually rides with (take 113). */
  const out = OUT; mkdirSync(out, { recursive: true });
  const s = (ms) => new Promise((r) => setTimeout(r, ms));
  await pg.evaluate(() => { try { window.guideClose(true); } catch (e) {} });
  for (let i = 0; i < 2; i++) {   /* take 188 · A212: Map and Hybrid only */
    const label = await pg.evaluate(() =>
      (document.getElementById("c-base").innerText || "x").trim().toLowerCase());
    await s(1800); await pg.screenshot({ path: `${out}/base-${label}.png` });
    await pg.evaluate(() => document.getElementById("c-base").click());
  }
  // open a place card while on the state we ended on (cycle back to hybrid)
  await pg.evaluate(async () => { const s2=(ms)=>new Promise(r=>setTimeout(r,ms));
    while (!/hybrid/i.test(document.getElementById("c-base").innerText))
      { document.getElementById("c-base").click(); await s2(300); }
    const src = window.map.getStyle().sources.poi.data.features;
    const at = src.find(f=>/Campground/.test(f.properties.n||""))||src[0];
    window.map.jumpTo({ center: at.geometry.coordinates, zoom: 14.2 }); await s2(2000);
    const p = window.map.project(at.geometry.coordinates);
    const cv = window.map.getCanvas(); const r = cv.getBoundingClientRect();
    for (const t of ["mousedown","mouseup","click"])
      cv.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true,
        clientX:r.left+p.x, clientY:r.top+p.y}));
  }); await s(1200);
  await pg.screenshot({ path: `${out}/base-hybrid-card.png` });
  console.log("basemap screens written");
} else if (mode === "styles") {
  /* take 187 · A208 · the computed style of every element in 21 UI states, so
     a token pass can prove it changed nothing: `styles before.json` on the old
     build, `styles after.json` on the new, then `stylediff before after`.
     Each state starts from a fresh load (same profile, same order), so what
     one state leaves behind reaches the next identically on both builds. */
  const outFile = process.argv[3] || join(OUT, "styles.json");
  mkdirSync(dirname(outFile), { recursive: true });
  const s = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (q) => pg.evaluate((q) => { const e = document.querySelector(q); if (!e) return false; e.click(); return true; }, q);
  const tab = (t) => click(`#tabs .tab[data-go="${t}"]`);
  const drop = () => pg.evaluate(() => { try { const c = window.map.getCenter();
    window.map.fire("contextmenu", { lngLat: { lng: c.lng + 0.01, lat: c.lat } }); } catch (e) {} });
  const STATES = [
    ["rest", async () => {}],
    ["drawer-open", async () => pg.evaluate(() => { try { window.railSet(true); } catch (e) {} })],
    ["tab-plan", async () => tab("plan")],
    ["tab-ride", async () => tab("ride")],
    ["tab-tools", async () => tab("tools")],
    ["mode-picker", async () => click("#c-mode")],
    ["activity-picker", async () => click("#c-act")],
    ["layers", async () => click("#c-layers")],
    ["search", async () => { await click("#c-search"); await s(300);
      await pg.evaluate(() => { const q = document.getElementById("q");
        if (q) { q.value = "Grayling"; q.dispatchEvent(new Event("input", { bubbles: true })); } }); }],
    ["place-card", async () => drop()],
    ["route-options", async () => { await drop(); await s(900); await click("#pc-route");
      await pg.waitForFunction(() => document.querySelectorAll(".rc").length > 0, { timeout: 30000 }).catch(() => {}); }],
    ["set-home", async () => { await tab("plan"); await click("#c-home"); }],
    ["saved", async () => { await tab("plan"); await click("#c-saved"); }],
    ["compass", async () => { await tab("tools"); await click("#c-compass"); }],
    ["diagnostics", async () => { await tab("tools"); await click("#c-diag"); }],
    ["about", async () => { await tab("tools"); await click("#c-diag"); await s(300); await click("#c-about"); }],
    ["hd-sheet", async () => click("#c-hd")],
    ["tour", async () => { await tab("tools"); await click("#c-tour"); await s(900); }],
    ["guide", async () => pg.evaluate(() => { try { window.guideShow(); } catch (e) {} })],
    ["ride-started", async () => { await tab("ride"); await click("#c-ride"); await s(3000); }],
    ["self-test", async () => { await tab("tools"); await click("#c-diag"); await s(300);
      await click("#c-selftest"); await s(25000); }],
  ];
  const dumpFn = (P) => {
    const key = (el) => { if (el.id) return "#" + el.id; const p = el.parentElement;
      if (!p) return el.tagName.toLowerCase();
      const same = Array.from(p.children).filter((c) => c.tagName === el.tagName);
      return key(p) + ">" + el.tagName.toLowerCase() + (same.length > 1 ? ":" + (same.indexOf(el) + 1) : ""); };
    const o = {};
    for (const el of document.querySelectorAll("body *")) {
      if (/^(CANVAS|SCRIPT|STYLE)$/.test(el.tagName)) continue;
      const cs = getComputedStyle(el);
      o[key(el)] = P.map((p) => cs.getPropertyValue(p)).join("|");
    }
    return o;
  };
  const all = {};
  for (const [name, setup] of STATES) {
    if (name !== "rest") { await pg.goto(URL0, { waitUntil: "networkidle0" }); await ready(); }
    await s(400);
    try { await setup(); } catch (e) { console.log("  " + name + ": setup threw " + e.message); }
    await s(900);
    all[name] = await pg.evaluate(dumpFn, STYLE_PROPS);
    console.log("  " + name + ": " + Object.keys(all[name]).length + " elements");
  }
  writeFileSync(outFile, JSON.stringify(all));
  console.log("styles written to " + outFile);
} else if (mode === "v4") {
  /* take 187 · the V4 study's scenes on the Fold's cover screen, then the
     chrome measured at the three sizes that matter (docs/DESIGN-v4.md §1.6,
     §8), with the inner screen shot as well: run on the old build for the
     "before", on a V4 take for the "after". PNGs go to <out>/v4-*.png. */
  const out = OUT; mkdirSync(out, { recursive: true });
  const s = (ms) => new Promise((r) => setTimeout(r, ms));
  const shot = async (name) => { await pg.screenshot({ path: `${out}/v4-${name}.png` }); console.log("  v4-" + name + ".png"); };
  const settle = async () => { await pg.evaluate(async () => { const s2 = (ms) => new Promise((r) => setTimeout(r, ms));
    try { const m = window.map; try { window.__stack.run(); } catch (e) {}
      for (let i = 0; i < 40; i++) { if (m.areTilesLoaded()) break; await s2(300); }
      await Promise.race([new Promise((r) => m.once("idle", r)), s2(6000)]); await s2(600); } catch (e) {} }); };
  const click = (id) => pg.evaluate((id) => { const e = document.getElementById(id); if (!e) return false; e.click(); return true; }, id);
  const tab = (t) => pg.evaluate((t) => { const e = document.querySelector(`#tabs .tab[data-go="${t}"]`); if (e) e.click(); }, t);
  const rail = (on) => pg.evaluate((on) => { try { window.railSet(on); } catch (e) {} }, on);
  const jump = (c, z) => pg.evaluate((c, z) => { try { window.map.jumpTo({ center: c, zoom: z }); } catch (e) {} }, c, z);
  const base = (want) => pg.evaluate(async (want) => { const s2 = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 4; i++) { const l = ((document.querySelector("#c-base span") || {}).textContent || "").trim();
      if (l === want) return true; document.getElementById("c-base").click(); await s2(1200); } return false; }, want);
  const GR = [-84.7145, 44.6614], HL = [-84.7646, 44.3144];
  await settle();
  await rail(true); await s(700); await shot("01-open-first-card");
  await rail(false); await s(700); await shot("02-home-folded");
  for (const t of ["plan", "ride", "tools"]) { await tab(t); await s(500); await shot(`03-tab-${t}`); }
  await tab("map"); await s(300);
  /* planning: a named trailhead 3–10 mi from the start, its card, the routes */
  const dest = await pg.evaluate(() => { try {
    const me = window.__route.ME || window.map.getCenter().toArray(), rad = Math.PI / 180;
    const d = (a, b2) => { const h = Math.sin((b2[1] - a[1]) * rad / 2) ** 2 + Math.cos(a[1] * rad) *
      Math.cos(b2[1] * rad) * Math.sin((b2[0] - a[0]) * rad / 2) ** 2; return 7917.6 * Math.asin(Math.sqrt(h)); };
    const c = window.map.getStyle().sources.poi.data.features
      .filter((f) => f.properties.k === "trailhead" && f.properties.n)
      .map((f) => ({ n: f.properties.n, c: f.geometry.coordinates, mi: d(me, f.geometry.coordinates) }))
      .filter((x) => x.mi > 3 && x.mi < 10).sort((a, b2) => a.mi - b2.mi)[0];
    return c || null; } catch (e) { return null; } });
  if (dest) {
    await jump(dest.c, 12.5); await settle();
    await pg.evaluate((c) => { try { window.map.fire("contextmenu", { lngLat: { lng: c[0], lat: c[1] } }); } catch (e) {} }, dest.c);
    await s(900); await rail(true); await s(500); await shot("04-place-card");
    await click("pc-route");
    await pg.waitForFunction(() => document.querySelectorAll(".rc").length > 0, { timeout: 30000 }).catch(() => console.log("  no route cards"));
    await s(800); await settle(); await shot("05-route-options");
    /* take 188 · A217 · the ride starts the V4 way: Ride it under the route
       options (it folds the drawer and shows the Ride tab itself); the Ride
       tab's chip is only the fallback, said so in the log */
    if (!(await click("rc-ride"))) { console.log("  (no #rc-ride: started from the Ride tab's chip)");
      await tab("ride"); await s(300); await click("c-ride"); }
    await s(6000); await shot("06-ride-started");
    await click("c-ride"); await s(800); await tab("map"); await s(300);
  }
  await click("c-layers"); await s(600); await shot("07-layers-top");
  await pg.evaluate(() => { try { const p = document.getElementById("lyrpanel"); p.scrollTop = p.scrollHeight; } catch (e) {} });
  await s(300); await shot("08-layers-pins"); await click("c-layers"); await s(300); await rail(false); await s(400);
  await jump(GR, 9); await settle(); await shot("09-map-z9");
  await base("Hybrid");
  for (const z of [7, 9, 11]) { await jump(GR, z); await settle(); await s(800); await shot(`10-hybrid-z${z}`); }
  await base("Map");
  await pg.evaluate(() => { try { window.__mode.apply("water", { silent: true }); } catch (e) {} }); await s(400);
  await jump(HL, 11.6); await settle(); await shot("11-water-pins-z11.6");
  await pg.evaluate(() => { try { window.__mode.apply("camp", { silent: true }); } catch (e) {} }); await s(400);
  await jump(GR, 10.6); await settle(); await shot("12-camp-pins-z10.6");
  await pg.evaluate(() => { try { window.__mode.apply("ride", { silent: true }); } catch (e) {} }); await s(400);
  /* the chrome at the cover, a small phone and the inner screen */
  const measure = {};
  /* the clear band (docs/DESIGN-v4.md §8) is measured here and NOT in render:
     render's guard for it failed three times the same way and came out
     (PROTOCOL §5; it returns with the drawer's redesign, take 189). Folded
     is the resting layout; open is the drawer at its MAXIMUM height (a tall
     filler in the panel, removed at once), since an open drawer is as tall as
     what it holds; each reading re-checks the drawer's state and retries,
     because startup messages open it by themselves after a load */
  /* take 188 · the band's edges are named, not guessed (the look review): the
     TOP edge is the lowest bottom of the scale corner, #readout and every
     .basebtn shown; the BOTTOM edge is the highest top of #tools, #rail and
     the attribution corner. #map, #chips and transient overlays (panels,
     toast, tour, alert) never bound it. Each reading names the element that
     set each edge, so a moved control shows up as a new name, not a new number. */
  const bandAt = (open) => pg.evaluate((open) => {
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
    const railR = box(document.getElementById("rail"));
    const folded = /\bfolded\b/.test((document.getElementById("rail") || {}).className || "");
    if (fill) fill.remove();
    return { clearBand: +((bottom - top) / innerHeight).toFixed(3),
             mapAboveDrawer: railR ? +(railR.top / innerHeight).toFixed(3) : null, folded, vw: innerWidth, vh: innerHeight,
             top: Math.round(top), topBy, bottom: Math.round(bottom), bottomBy };
  }, open);
  /* landmine 224 — the drawer folds by CSS transitions on #railbody and
     #actions, and in headless Chrome a transition that starts while nothing
     asks for a frame stays PENDING at its old value: 700 ms after a fold the
     geometry was still the open drawer's (the class said folded). A 1x1
     screenshot draws a frame; then wait until no transition is left. Returns
     false if they never finish. */
  const settleDrawer = async () => { for (let i = 0; i < 20; i++) {
      await pg.screenshot({ clip: { x: 0, y: 0, width: 1, height: 1 } });
      const busy = await pg.evaluate(() => { const r = document.getElementById("rail");
        return r ? r.getAnimations({ subtree: true }).filter((a) => a.transitionProperty).length : 0; });
      if (!busy) return true; await s(150); } return false; };
  const measureAt = async (open) => { for (let i = 0; i < 8; i++) { await rail(open);
    if (!(await settleDrawer())) { console.log("  (the drawer's transitions never finished)"); continue; }
    const r = await bandAt(open); if (r.folded === !open) return r; }
    console.log("  (the drawer would not hold " + (open ? "open" : "folded") + ")"); return null; };
  for (const [w, h, dpr] of [[411, 960, 2.625], [360, 800, 3], [749, 832, 2.625]]) {
    await pg.setViewport({ width: w, height: h, deviceScaleFactor: dpr }); await s(1500); await settle();
    for (const open of [false, true]) measure[`${w}x${h}-${open ? "open (max)" : "folded"}`] = await measureAt(open);
    if (w === 749) { await measureAt(false); await s(300); await shot("13-inner-home-folded");
      await measureAt(true); await s(300); await shot("14-inner-drawer-open"); }
  }
  writeFileSync(`${out}/v4-measure.json`, JSON.stringify(measure, null, 1));
  console.log("v4 scenes and measurements written to " + out);
} else if (mode === "ridesheet") {
  /* take 188 · A222 · the ride sheet as a rider sees it, at the small phone,
     the cover screen and the inner screen: a real route near Mio planned the
     app's way (long-press → Start here, long-press → Route here), a ride
     started, and synthetic fixes driven along the route through
     window.__nav.fix — a headless Chrome never gets a fix, so without them no
     sheet is drawn (take 187, v4-06). Routed first (Trip / To go / Arrive),
     then guidance off (Trip / Time / Speed), then routed with the drawer
     OPEN on the route cards (the stats fold away, the ride buttons stay —
     landmine 135). PNGs: <out>/ridesheet-*.png. */
  const out = OUT; mkdirSync(out, { recursive: true });
  const s = (ms) => new Promise((r) => setTimeout(r, ms));
  const settleAll = () => pg.evaluate(async () => { const s2 = (ms) => new Promise((r) => setTimeout(r, ms));
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    for (let i = 0; i < 60; i++) { await frame(); if (!document.getAnimations().some((a) => a.playState === "running"
      && a.effect && isFinite(a.effect.getComputedTiming().endTime))) break; await s2(50); }
    try { const m = window.map; for (let i = 0; i < 30; i++) { if (m.areTilesLoaded()) break; await s2(300); }
      await Promise.race([new Promise((r) => m.once("idle", r)), s2(4000)]); } catch (e) {} });
  const planned = await pg.evaluate(async () => { const s2 = (ms) => new Promise((r) => setTimeout(r, ms));
    const m = window.map, N = window.__nav;
    m.jumpTo({ center: [-84.118, 44.546], zoom: 13 }); await s2(500);
    m.fire("contextmenu", { lngLat: { lng: -84.12855, lat: 44.53949 } }); await s2(300);
    const a = document.getElementById("pc-start"); if (a) a.click(); await s2(300);
    m.fire("contextmenu", { lngLat: { lng: -84.10724, lat: 44.55265 } }); await s2(300);
    const b2 = document.getElementById("pc-route"); if (b2) b2.click();
    let G = null; for (let i = 0; i < 80; i++) { await s2(250); G = N.plan(); if (G) break; }
    if (!G) return { ok: false };
    const tab = document.querySelector('#tabs .tab[data-go="ride"]'); if (tab) tab.click(); await s2(300);
    document.getElementById("c-ride").click(); await s2(300);
    /* ride the first 40% of the line, a fix every ~60 m at 8 m/s */
    const at = (mm) => { let i = 0; while (i < G.cum.length - 2 && G.cum[i + 1] < mm) i++;
      const t = (mm - G.cum[i]) / Math.max(1, G.cum[i + 1] - G.cum[i]);
      return [G.pts[i][0] + (G.pts[i + 1][0] - G.pts[i][0]) * t, G.pts[i][1] + (G.pts[i + 1][1] - G.pts[i][1]) * t]; };
    for (let mm = 0; mm <= G.total * 0.4; mm += 60) { N.fix(at(mm), 8, 8, null); await s2(60); }
    window.__probeAt = at(G.total * 0.4);   /* re-sent after guidance is switched back on */
    await s2(1200);
    return { ok: true, total: Math.round(G.total), rail: document.getElementById("rail").className,
      hud: !document.getElementById("hudstats").hidden };
  });
  console.log("  route: " + JSON.stringify(planned));
  const shots = [];
  for (const [w, h, dpr] of [[360, 800, 3], [411, 960, 2.625], [749, 832, 2.625]]) {
    await pg.setViewport({ width: w, height: h, deviceScaleFactor: dpr }); await s(1200);
    for (const variant of ["routed", "free", "open"]) {
      const routed = variant !== "free";
      await pg.evaluate((routed, open) => { try { window.railSet(open); const N = window.__nav;
        /* guidance switched back on has no projection until a fix arrives —
           the sheet honestly reads dashes until then — so one fix is re-sent */
        if (routed) { N.start(); N.fix(window.__probeAt, 8, 8, null); } else N.stop(); window.hudPaint(); } catch (e) {} }, routed, variant === "open");
      await settleAll(); await s(300);
      const name = `ridesheet-${variant}-${w}x${h}`;
      const read = await pg.evaluate(() => { const hs = document.getElementById("hudstats"), r = hs.getBoundingClientRect();
        return { shown: !hs.hidden && r.height > 0, top: Math.round(r.top), bottom: Math.round(r.bottom),
          rail: document.getElementById("rail").className || "open",
          text: [...hs.querySelectorAll(".hc")].filter((c) => !c.hidden && c.getBoundingClientRect().height > 0)
            .map((c) => c.innerText.replace(/\s+/g, " ").trim()) }; });
      await pg.screenshot({ path: `${out}/${name}.png` }); shots.push(name);
      console.log(`  ${name}.png ${JSON.stringify(read)}`);
    }
  }
  await pg.evaluate(() => { try { window.railSet(false); if (window.__nav) window.__nav.stopReal(); } catch (e) {} });
  console.log(`ride sheet shots written to ${out} (${shots.length})`);
} else if (mode === "badges") {
  /* take 188 · A214 · the badge sheet the glyph source and weight are chosen
     from (DESIGN-v4 §10: "chosen by rendering both at z9.2, z10 and z12 at
     DPR 2.625"). Every arm is drawn in the V4 shapes and colours, so only the
     glyph differs between rows:
       A  take 187's own stroke glyphs, copied verbatim from src/app.html
          1300-1335 at 63f1676 (an eligible candidate, not only a baseline)
       B  Lucide at stroke 2.25 (the mockup's weight)
       C  Lucide at 2.6 (the spec's default)
       D  Lucide at 3.0
       E  the app's own bdg-* images, when window.__badges exists
     Lucide is read here from LUCIDE and APEX_GLYPHS in www/app.js (the one
     table since take 188's A216 fold) when the app has them,
     else from node_modules/lucide-static plus this file's drafts of the two
     glyphs Lucide lacks (apex-th, apex-lighthouse). The camera is the bundle
     manifest's Grayling anchor (landmine 197); the app's pin layers and the floating
     chrome are hidden for the shots and restored after. Set APEX_SHOTS. */
  const out = OUT; mkdirSync(out, { recursive: true });
  const s = (ms) => new Promise((r) => setTimeout(r, ms));
  /* the V4 table as built in take 188 (A214; fuel off the hazard red, N14):
     kind, shape, colour, Lucide glyph, take 187's glyph, d. Once the app has
     window.__badges, its own spec wins per kind. */
  const KINDS = [
    ["trailhead", "drop", "#A0441C", "apex-th", "flag", 1],
    ["launch", "drop", "#1873B1", "sailboat", "boat", 1],
    ["marina", "drop", "#0E2D56", "anchor", "boat", 1],
    ["beach", "drop", "#806A10", "umbrella", "sun", 1],
    ["dayuse", "drop", "#386C1D", "trees", "tree", 1],
    ["lighthouse", "drop", "#A52941", "apex-lighthouse", "eye", 1],
    ["ski", "drop", "#3A33B0", "mountain-snow", "ski", 1],
    ["livery", "drop", "#118562", "kayak", "boat", 1],
    ["view", "drop", "#843991", "binoculars", "eye", 1],
    ["pad-access", "drop", "#175A63", "waves-arrow-down", "boat", 1],
    ["camp", "square", "#75522E", "tent", "tent", 1],
    ["shelter", "square", "#525251", "warehouse", "tent", 0],
    ["system", "hex", "#A46103", "footprints", "tree", 1],
    ["mtb", "hex", "#1F5131", "bike", "bike", 1],
    ["fuel", "circle", "#701A1A", "fuel", "fuel", 0],   /* off the closure red (N14, step 6) */
    ["store", "circle", "#5B377C", "shopping-bag", "bag", 0],
    ["food", "circle", "#A23182", "utensils", "cup", 0],
    ["info", "circle", "#3E526C", "info", "i", 0],
    ["water", "circle", "#0B71CA", "droplet", "drop", 0],
    ["toilet", "circle", "#1C7C72", "toilet", "i", 0],
    ["pad-parking", "circle", "#797565", "circle-parking", "i", 0]];
  /* drafts in Lucide's grammar (24 grid, round strokes), used only when the
     app has no LUCIDE/APEX_GLYPHS: a lettered TH in strokes (not fillText, which
     depends on the device font) and a lighthouse */
  const DRAFTS = {
    "apex-th": '<path d="M3 6h8"/><path d="M7 6v12"/><path d="M14 6v12"/><path d="M21 6v12"/><path d="M14 12h7"/>',
    "apex-lighthouse": '<path d="M8 22h8"/><path d="M9 22l1-12h4l1 12"/><path d="M10 10V7h4v3"/>'
      + '<path d="M9 7l3-3 3 3"/><path d="M4 7l2 .5"/><path d="M20 7l-2 .5"/>' };
  const lucideFile = (n) => { const f = join(ROOT, "node_modules", "lucide-static", "icons", n + ".svg");
    if (!existsSync(f)) return null;
    const m = /<svg[^>]*>([\s\S]*?)<\/svg>/.exec(readFileSync(f, "utf8").replace(/<!--[\s\S]*?-->/g, ""));
    return m ? m[1].replace(/\s+/g, " ").trim() : null; };
  let appGlyphs = null;
  try { const js = readFileSync(join(WWW, "app.js"), "utf8"), { runInNewContext } = await import("node:vm");
    const table = (n) => { const i = js.indexOf("var " + n + "={"); if (i < 0) return null;
      return runInNewContext("(" + js.slice(i + 5 + n.length, js.indexOf("};", i) + 1) + ")"); };
    const L = table("LUCIDE"), A = table("APEX_GLYPHS");
    if (L || A) appGlyphs = Object.assign({}, L || {}, A || {}); }
  catch (e) { console.log("  (LUCIDE/APEX_GLYPHS in www/app.js would not parse: " + e.message + ")"); appGlyphs = null; }
  const GLY = {}, missing = [];
  for (const k of KINDS) { const g = k[3];
    GLY[g] = (appGlyphs && appGlyphs[g]) || lucideFile(g) || DRAFTS[g] || null; if (!GLY[g]) missing.push(g); }
  const glyphSource = appGlyphs ? "LUCIDE + APEX_GLYPHS in www/app.js" : "node_modules/lucide-static + this probe's apex-* drafts";
  console.log("  glyphs from " + glyphSource + (missing.length ? " — MISSING: " + missing.join(", ") : ""));
  const ARMS = [["A", "take 187 strokes", 0], ["B", "Lucide 2.25", 2.25], ["C", "Lucide 2.6", 2.6], ["D", "Lucide 3.0", 3.0]];
  const reg = await pg.evaluate((KINDS, GLY, ARMS) => { try {
    const m = window.map, S = 2, BARE = { info: 1, "circle-parking": 1 };
    /* take 187's G, verbatim (src/app.html 1300-1335 at 63f1676) */
    var G={
    tree:function(x){x.moveTo(13,6);x.lineTo(8,15);x.lineTo(18,15);x.closePath();
      x.moveTo(13,15);x.lineTo(13,19)},
    bike:function(x){x.moveTo(11,17);x.arc(8,17,3,0,Math.PI*2);x.moveTo(21,17);x.arc(18,17,3,0,Math.PI*2);
      x.moveTo(8,17);x.lineTo(12,10);x.lineTo(18,17);x.moveTo(12,10);x.lineTo(16,10);
      x.moveTo(12,10);x.lineTo(13,17);x.moveTo(16,10);x.lineTo(18,17);x.moveTo(11,9);x.lineTo(14,9)},
    ski:function(x){x.moveTo(16.6,6.5);x.arc(15,6.5,1.6,0,Math.PI*2);
      x.moveTo(14,8.5);x.lineTo(11.5,13);x.moveTo(13,10.5);x.lineTo(16.5,12.5);x.lineTo(18,17);
      x.moveTo(11.5,13);x.lineTo(9.5,16.2);x.moveTo(11.5,13);x.lineTo(12.5,16.2);
      x.moveTo(6,18.6);x.lineTo(16,15.4);x.moveTo(7.2,20.4);x.lineTo(17.2,17.2)},
    tent:function(x){x.moveTo(6,18);x.lineTo(13,7);x.lineTo(20,18);x.closePath();
      x.moveTo(13,18);x.lineTo(13,12)},
    boat:function(x){x.moveTo(6,15);x.lineTo(20,15);x.lineTo(17,19);x.lineTo(9,19);
      x.closePath();x.moveTo(13,15);x.lineTo(13,6);x.lineTo(18,12);x.lineTo(13,12)},
    fuel:function(x){x.rect(8,7,7,12);x.moveTo(15,11);x.lineTo(18,11);
      x.lineTo(18,17)},
    flag:function(x){x.moveTo(9,20);x.lineTo(9,6);x.lineTo(18,9);x.lineTo(9,12)},
    sun:function(x){x.arc(13,13,4,0,6.283);x.moveTo(13,5);x.lineTo(13,7);
      x.moveTo(13,19);x.lineTo(13,21);x.moveTo(5,13);x.lineTo(7,13);
      x.moveTo(19,13);x.lineTo(21,13)},
    drop:function(x){x.moveTo(13,6);x.bezierCurveTo(9,12,8,14,8,16);
      x.arc(13,16,5,3.1416,0,true);x.bezierCurveTo(18,14,17,12,13,6)},
    bag:function(x){x.rect(8,10,10,9);x.moveTo(10,10);x.arc(13,10,3,3.1416,0)},
    cup:function(x){x.moveTo(8,8);x.lineTo(8,16);x.arc(11,16,3,3.1416,0,true);
      x.moveTo(14,8);x.lineTo(14,14);x.moveTo(14,10);x.arc(14,12,2,-1.57,1.57)},
    eye:function(x){x.moveTo(6,13);x.bezierCurveTo(9,8,17,8,20,13);
      x.bezierCurveTo(17,18,9,18,6,13);x.moveTo(15,13);
      x.arc(13,13,2,0,6.283)},
    i:function(x){x.moveTo(13,11);x.lineTo(13,18);x.moveTo(13,7);x.lineTo(13,8)},
    dam:function(x){x.moveTo(7,7);x.lineTo(13,18);x.lineTo(19,7);
      x.moveTo(13,10);x.lineTo(13,13)}
    };
    /* the V4 shapes in 26-unit space (A214 spec): circle r11 at (13,13);
       rounded square 2.75..23.25 r4.5; pointy-top hexagon R12 at (13,13);
       teardrop head r11 at (13,12.5), tip (13,34.8), on a 26x36 canvas */
    const shape = (x, sh, dy) => { x.beginPath();
      if (sh === "circle") x.arc(13, 13 + dy, 11, 0, Math.PI * 2);
      else if (sh === "square") { const a = 2.75, b = 23.25, r = 4.5; x.moveTo(a + r, a + dy);
        x.arcTo(b, a + dy, b, b + dy, r); x.arcTo(b, b + dy, a, b + dy, r); x.arcTo(a, b + dy, a, a + dy, r); x.arcTo(a, a + dy, b, a + dy, r); }
      else if (sh === "hex") { for (let i = 0; i < 6; i++) { const t = -Math.PI / 2 + i * Math.PI / 3;
        x[i ? "lineTo" : "moveTo"](13 + 12 * Math.cos(t), 13 + dy + 12 * Math.sin(t)); } }
      else { const cy = 12.5 + dy, tip = 34.8 + dy, t = Math.acos(11 / (tip - cy));
        const t1 = Math.PI / 2 - t, t2 = Math.PI / 2 + t; x.moveTo(13, tip);
        x.lineTo(13 + 11 * Math.cos(t1), cy + 11 * Math.sin(t1)); x.arc(13, cy, 11, t1, t2, true); }
      x.closePath(); };
    const lucide = (x, markup, cx, cy, lw, bare) => {
      if (typeof Path2D === "undefined" || !markup) return false;
      const doc = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg">' + markup + "</svg>", "image/svg+xml");
      const p = new Path2D(), n = (e, a) => +e.getAttribute(a) || 0;
      for (const e of doc.documentElement.children) {
        const t = e.tagName;
        if (t === "path") p.addPath(new Path2D(e.getAttribute("d")));
        else if (t === "circle") { if (bare && n(e, "r") >= 9.5) continue;
          p.moveTo(n(e, "cx") + n(e, "r"), n(e, "cy")); p.arc(n(e, "cx"), n(e, "cy"), n(e, "r"), 0, Math.PI * 2); }
        else if (t === "ellipse") { p.moveTo(n(e, "cx") + n(e, "rx"), n(e, "cy"));
          p.ellipse(n(e, "cx"), n(e, "cy"), n(e, "rx"), n(e, "ry"), 0, 0, Math.PI * 2); }
        else if (t === "line") { p.moveTo(n(e, "x1"), n(e, "y1")); p.lineTo(n(e, "x2"), n(e, "y2")); }
        else if (t === "rect") { const q = new Path2D(); (q.roundRect ? q.roundRect(n(e, "x"), n(e, "y"), n(e, "width"), n(e, "height"), n(e, "rx"))
          : q.rect(n(e, "x"), n(e, "y"), n(e, "width"), n(e, "height"))); p.addPath(q); }
        else if (t === "polyline" || t === "polygon") { const v = (e.getAttribute("points") || "").trim().split(/[\s,]+/).map(Number);
          for (let i = 0; i + 1 < v.length; i += 2) p[i ? "lineTo" : "moveTo"](v[i], v[i + 1]); if (t === "polygon") p.closePath(); }
        else return false; }
      /* a 14-unit glyph box centred on the shape's head (A214 spec) */
      x.save(); x.translate(cx - 7, cy - 7); x.scale(14 / 24, 14 / 24);
      x.lineWidth = lw; x.lineCap = "round"; x.lineJoin = "round"; x.strokeStyle = "#FFFFFF"; x.stroke(p); x.restore();
      return true; };
    /* once the app has its table, every arm takes the app's shape and colour
       per kind, so the sheet compares glyphs against what ships */
    const used = KINDS.map(([k, sh, col, lg, og, d]) => { try {
      const v = window.__badges && window.__badges.spec(k);
      if (v && v.c && v.s) return [k, v.s, v.c, lg, og, d, "app"]; } catch (e) {}
      return [k, sh, col, lg, og, d, "spec"]; });
    const made = [], failed = [];
    for (const [arm, , lw] of ARMS) for (const [k, sh, col, lg, og] of used) {
      const name = "probe-" + arm + "-" + k, H = sh === "drop" ? 36 : 26, c = document.createElement("canvas");
      c.width = 26 * S; c.height = H * S; const x = c.getContext("2d"); x.scale(S, S);
      shape(x, sh, 0.6); x.fillStyle = "rgba(0,0,0,.22)"; x.fill();
      shape(x, sh, 0); x.fillStyle = col; x.fill(); x.lineWidth = 1.6; x.lineJoin = "round"; x.strokeStyle = "#FFFFFF"; x.stroke();
      const cy = sh === "drop" ? 12.5 : 13;
      let ok = true;
      if (arm === "A") { x.save(); x.translate(0, cy - 13); x.beginPath(); x.lineWidth = 1.7; x.lineCap = "round"; x.lineJoin = "round";
        x.strokeStyle = "#FFFFFF"; (G[og] || G.i)(x); x.stroke(); x.restore(); }
      else ok = lucide(x, GLY[lg], 13, cy, lw, !!BARE[lg]);
      if (!ok) { failed.push(name); continue; }
      try { if (m.hasImage(name)) m.removeImage(name); m.addImage(name, x.getImageData(0, 0, 26 * S, H * S), { pixelRatio: S }); made.push(name); }
      catch (e) { failed.push(name + " (" + e.message + ")"); } }
    const hasE = !!window.__badges;
    return { made: made.length, failed, hasE, used,
      eMissing: hasE ? KINDS.map((k) => "bdg-" + k[0]).filter((n) => !m.hasImage(n)) : [] };
  } catch (e) { return { err: String(e && e.stack || e) }; } }, KINDS, GLY, ARMS);
  console.log("  badges registered: " + JSON.stringify(reg));
  /* the anchors come from the bundle's manifest, as render reads them — BUNDLE
     is not a window global (app.js is wrapped, take 127), so a page-side read
     of window.BUNDLE finds nothing */
  const manF = join(WWW, "bundle", "manifest.json");
  const anc = ((existsSync(manF) ? JSON.parse(readFileSync(manF, "utf8")) : {}).anchors || []).find((x) => x[0] === "Grayling");
  const gr = anc ? [anc[1], anc[2]] : null;
  if (reg.err || !gr) {
    console.log("FAIL: the badge sheet cannot be drawn — " + (reg.err || "no Grayling anchor in the bundle manifest (landmine 197)"));
    await b.close(); srv.close(); process.exit(1);
  }
  const arms = ARMS.map((a) => a[0]).concat(reg.hasE ? ["E"] : []);
  const settle = async () => { await pg.evaluate(async () => { const s2 = (ms) => new Promise((r) => setTimeout(r, ms));
    const m = window.map; for (let i = 0; i < 40; i++) { if (m.areTilesLoaded()) break; await s2(300); }
    await Promise.race([new Promise((r) => m.once("idle", r)), s2(6000)]); await s2(500); }); };
  const base = (want) => pg.evaluate(async (want) => { const s2 = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 4; i++) { const l = ((document.querySelector("#c-base span") || {}).textContent || "").trim();
      if (l === want) return true; document.getElementById("c-base").click(); await s2(1200); } return false; }, want);
  /* hide the pins and the chrome, lay the sheet out, shoot, and put it all back */
  const hidden = await pg.evaluate(() => { const m = window.map, was = {};
    for (const l of m.getStyle().layers) if (/^(poi-(dot|stack)|pad-(dot|lbl|dam))/.test(l.id)) {
      was[l.id] = m.getLayoutProperty(l.id, "visibility") || "visible"; m.setLayoutProperty(l.id, "visibility", "none"); }
    const st = document.createElement("style"); st.id = "probe-badges-css";
    st.textContent = "#stage > :not(#map), #rail, #tabs { visibility: hidden !important; }"
      + " #probe-badges-rows { position: fixed; left: 0; top: 0; pointer-events: none; z-index: 99999;"
      + " font: 600 11px/1 sans-serif; color: #fff; text-shadow: 0 0 3px #000, 0 0 3px #000; }";
    document.head.appendChild(st); return was; });
  const layout = await pg.evaluate((KINDS, arms) => { const m = window.map, COLS = 7, PX = 52, PY = 52, X0 = 44, Y0 = 70;
    const size = (id) => { try { return m.getLayoutProperty(id, "icon-size"); } catch (e) { return null; } };
    const major = size("poi-dot-major") || 1, minor = size("poi-dot") || 1;
    const cells = [], rows = document.createElement("div"); rows.id = "probe-badges-rows";
    arms.forEach((arm, ai) => KINDS.forEach(([k, sh, , , , d], ki) => {
      const row = ai * Math.ceil(KINDS.length / COLS) + Math.floor(ki / COLS);
      cells.push({ px: [X0 + (ki % COLS) * PX, Y0 + row * PY + (sh === "drop" ? 12 : 0)],
        img: arm === "E" ? "bdg-" + k : "probe-" + arm + "-" + k, s: sh, d, arm, k }); }));
    arms.forEach((arm, ai) => { const t = document.createElement("div"); t.textContent = arm;
      t.style.cssText = "position:absolute;left:6px;top:" + (Y0 - 6 + ai * Math.ceil(KINDS.length / COLS) * PY) + "px";
      rows.appendChild(t); });
    document.body.appendChild(rows);
    m.addSource("probe-badges", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    const lay = (id, dv, sz) => m.addLayer({ id, type: "symbol", source: "probe-badges", filter: ["==", ["get", "d"], dv],
      layout: { "icon-image": ["get", "img"], "icon-size": sz, "icon-allow-overlap": true, "icon-ignore-placement": true,
        "icon-anchor": ["match", ["get", "s"], "drop", "bottom", "center"] } });
    lay("probe-badges-major", 1, major); lay("probe-badges-minor", 0, minor);
    return { cells, iconSize: { major, minor }, grid: { COLS, PX, PY, X0, Y0 } }; }, reg.used || KINDS, arms);
  const place = () => pg.evaluate((cells) => { const m = window.map;
    m.getSource("probe-badges").setData({ type: "FeatureCollection", features: cells.map((c) => ({ type: "Feature",
      properties: { img: c.img, s: c.s, d: c.d }, geometry: { type: "Point", coordinates: m.unproject(c.px).toArray() } })) }); }, layout.cells);
  const shots = [];
  for (const bm of ["Map", "Hybrid"]) {
    const on = await base(bm);
    if (!on) { console.log("  (could not reach the " + bm + " basemap — skipped)"); continue; }
    for (const z of [9.2, 10, 12]) {
      await pg.evaluate((c, z) => window.map.jumpTo({ center: c, zoom: z }), gr, z);
      await place(); await settle();
      await pg.screenshot({ clip: { x: 0, y: 0, width: 1, height: 1 } });   /* landmine 224: draw a frame */
      const f = `badges-${bm.toLowerCase()}-z${z}.png`; await pg.screenshot({ path: `${out}/${f}` }); shots.push(f); console.log("  " + f);
    }
  }
  await base("Map");
  await pg.evaluate((was) => { const m = window.map;
    for (const id of ["probe-badges-major", "probe-badges-minor"]) if (m.getLayer(id)) m.removeLayer(id);
    if (m.getSource("probe-badges")) m.removeSource("probe-badges");
    for (const n of m.listImages()) if (/^probe-/.test(n)) m.removeImage(n);
    for (const id of Object.keys(was)) m.setLayoutProperty(id, "visibility", was[id]);
    for (const id of ["probe-badges-css", "probe-badges-rows"]) { const e = document.getElementById(id); if (e) e.remove(); } }, hidden);
  writeFileSync(`${out}/badges-order.json`, JSON.stringify({ arms: arms.map((a) => (ARMS.find((x) => x[0] === a) || [a, "the app's own bdg-* (window.__badges)"]).slice(0, 2).join(" · ")),
    kinds: (reg.used || KINDS).map((k) => ({ k: k[0], shape: k[1], colour: k[2], lucide: k[3], take187: k[4], d: k[5], from: k[6] })),
    glyphSource, missing, registered: reg, iconSize: layout.iconSize, grid: layout.grid, camera: "the bundle's Grayling anchor",
    shots }, null, 1));
  console.log("badge sheet written to " + out + (shots.length === 6 ? "" : " — only " + shots.length + " of 6 shots"));
} else if (mode === "eval") {
  const code = readFileSync(process.argv[3] || "/dev/stdin", "utf8");
  // eval as a string expression — the Function wrapper mangled user code
  const out = await pg.evaluate("(async()=>{" + code + "})()");
  console.log(JSON.stringify(out, null, 2));
}
await b.close(); srv.close();
