/* PERMANENT probe scaffold (take 113). For ~30 takes every visual question was
   answered by rewriting this same 30-line server+puppeteer boilerplate into a
   throwaway _show.mjs — pure waste. Now: node tools/probe.mjs shots|eval <js> */
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
const WWW = join(dirname(dirname(fileURLToPath(import.meta.url))), "www");
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
  const out = "/mnt/user-data/outputs/screens"; mkdirSync(out, { recursive: true });
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
  console.log("screens written to /mnt/user-data/outputs/screens/");
} else if (mode === "basemaps") {
  /* One screenshot per basemap state, named by the button's own label, plus a
     card open on hybrid — the state Jacob actually rides with (take 113). */
  const out = "/mnt/user-data/outputs/screens"; mkdirSync(out, { recursive: true });
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
