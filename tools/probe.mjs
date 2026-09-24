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
await pg.setViewport(mode === "v4" || mode === "styles" ? COVER
  : { width: 412, height: 915, deviceScaleFactor: 2 });
/* take 187 · landmine 222: in a fresh profile the first-run tour and guide
   cover every scene — mark both seen before the app reads them */
await pg.evaluateOnNewDocument(() => { try { localStorage.setItem("apex.tour.v1", "1");
  localStorage.setItem("apex.guide.v2", "1"); } catch (e) {} });
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
  await pg.evaluate(() => { document.getElementById("c-layers")?.click();
    try { localStorage.removeItem("apex.guide.v1"); } catch(e){}
    window.guideShow(); }); await s(500); await shot("5-first-run-guide");
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
  for (let i = 0; i < 3; i++) {
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
    await tab("ride"); await s(300); await click("c-ride"); await s(6000); await shot("06-ride-started");
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
  const bandAt = (open) => pg.evaluate((open) => {
    const R = (id) => { const e = document.getElementById(id); if (!e || e.hidden) return null;
      const b2 = e.getBoundingClientRect(); return (b2.width || b2.height) ? b2 : null; };
    const P = document.getElementById("panel"); let fill = null;
    if (open && P) { fill = document.createElement("div"); fill.id = "v4band-fill"; fill.style.height = "2000px"; P.appendChild(fill); }
    const stack = ["c-base", "c-act", "c-mode"].map(R).filter(Boolean);
    const top = Math.max(...stack.map((b2) => b2.bottom));
    const railR = R("rail"), bottom = Math.min(...["rail", "tools"].map(R).filter(Boolean).map((b2) => b2.top));
    const folded = /\bfolded\b/.test((document.getElementById("rail") || {}).className || "");
    if (fill) fill.remove();
    return { clearBand: +((bottom - top) / innerHeight).toFixed(3),
             mapAboveDrawer: railR ? +(railR.top / innerHeight).toFixed(3) : null, folded, vw: innerWidth, vh: innerHeight };
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
} else if (mode === "eval") {
  const code = readFileSync(process.argv[3] || "/dev/stdin", "utf8");
  // eval as a string expression — the Function wrapper mangled user code
  const out = await pg.evaluate("(async()=>{" + code + "})()");
  console.log(JSON.stringify(out, null, 2));
}
await b.close(); srv.close();
