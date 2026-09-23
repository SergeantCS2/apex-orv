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
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".jpg": "image/jpeg", ".pbf": "application/x-protobuf" };
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
await pg.setViewport({ width: 412, height: 915, deviceScaleFactor: 2 });
await pg.goto(`http://127.0.0.1:${srv.address().port}/index.html`,
  { waitUntil: "networkidle0" });
await pg.evaluate(async () => { const s = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 120; i++) { if (window.map?.loaded?.()) return; await s(250); } });
const mode = process.argv[2] || "shots";
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
} else if (mode === "eval") {
  const code = readFileSync(process.argv[3] || "/dev/stdin", "utf8");
  // eval as a string expression — the Function wrapper mangled user code
  const out = await pg.evaluate("(async()=>{" + code + "})()");
  console.log(JSON.stringify(out, null, 2));
}
await b.close(); srv.close();
