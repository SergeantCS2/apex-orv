#!/usr/bin/env node
/* Smoke: execute the SHIPPED app against a REAL bundle.
 *
 * Take 15. The Python verifiers (verify6-11) mirror the algorithms; nothing
 * ever ran www/app.js itself. `node --check` proves it parses, not that it
 * survives line three. This harness stubs the browser, loads the bundle the
 * way the app does, and drives the UI: search, Return Home, directions, ride,
 * retrace, dispatch, basemap. Assertions fail loudly with exit 1.
 *
 *   node tools/smoke.mjs [--www www] [--expect-partial imagery]
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
function opt(name, dflt) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
}
const FATAL_DRILL = args.includes("--fatal-drill");
const DEAD_RENDER = args.includes("--dead-renderer");
const AWAY = args.includes("--away");   // before first use — landmine 38, eaten fresh
let wwwArg = opt("--www", "www");
/* --fatal-drill: copy the target www, strip the REQUIRED network artifact from
   its manifest, and assert the app REFUSES the region with a plain screen
   instead of rendering a map with holes (landmine 34). A refusal that has
   never fired is a hope, not a safety property. */
import { cpSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
if (FATAL_DRILL) {
  const src = wwwArg.startsWith("/") ? wwwArg : join(ROOT, wwwArg);
  const t = mkdtempSync(join(tmpdir(), "apex-fatal-"));
  cpSync(src, t, { recursive: true });
  const mp = join(t, "bundle/manifest.json");
  const man = JSON.parse(readFileSync(mp, "utf8"));
  man.artifacts = man.artifacts.filter((a) => a.kind !== "network");
  writeFileSync(mp, JSON.stringify(man));
  wwwArg = t;
}
const WWW = wwwArg.startsWith("/") ? wwwArg : join(ROOT, wwwArg);
const EXPECT_PARTIAL = (opt("--expect-partial", "") || "").split(",").filter(Boolean);
const NO_GPS = args.includes("--no-gps");

let failures = 0;
const geo = { cb: null, err: null, cleared: 0 };
const protocolsAdded = [];
const markers = [];
function ok(cond, msg) {
  if (cond) { console.log(`  ok   ${msg}`); }
  else { failures++; console.log(`  FAIL ${msg}`); }
}

/* ── browser stubs ──────────────────────────────────────────────────────── */
class El {
  constructor(id) {
    this.id = id; this.className = ""; this.textContent = "";
    this.dataset = {}; this.style = {}; this.disabled = false; this.value = "";
    this._html = ""; this._listeners = {}; this._children = [];
  }
  get innerHTML() { return this._html; }
  set innerHTML(h) {
    this._html = String(h);
    /* parse just enough: elements with a class and optional data-i */
    this._children = [];
    const re = /<(?:button|div)\s+class="([^"]+)"(?:\s+data-i="(\d+)")?/g;
    let m;
    while ((m = re.exec(this._html))) {
      const c = new El(null);
      c.className = m[1];
      if (m[2] !== undefined) c.dataset.i = m[2];
      this._children.push(c);
    }
  }
  addEventListener(t, fn) { (this._listeners[t] ||= []).push(fn); }
  fire(t, ev) { for (const fn of this._listeners[t] || []) fn(ev || {}); }
  focus() {}
  select() {}
  click() { this.fire("click", { stopPropagation() {} }); }
  remove() { this._removed = true; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 411, height: 40, right: 411, bottom: 40 }; }
  scrollIntoView() { this._scrolledIntoView = true; }
  appendChild() {}
}

const byId = new Map();
function grab(id) {
  if (!byId.has(id)) byId.set(id, new El(id));
  return byId.get(id);
}
/* every id the page declares */
for (const m of readFileSync(join(WWW, "index.html"), "utf8").matchAll(/id="([^"]+)"/g))
  grab(m[1]);

const documentStub = {
  addEventListener() {},
  /* The layout section reads real geometry. Model it at Jacob's actual size so
     the numbers mean something rather than passing on undefineds. */
  documentElement: { clientWidth: 411, clientHeight: 960 },
  getElementById: grab,
  createElement: () => new El(null),
  querySelectorAll: (sel) => {
    const cls = (sel.match(/\.([\w-]+)/) || [])[1];
    if (!cls) return [];
    const out = [];
    for (const el of byId.values())
      for (const c of el._children)
        if (c.className.split(/\s+/).includes(cls)) out.push(c);
    return out;
  },
  get body() { return grab("__body"); },
};

/* fetch serves the real files, same-origin, exactly as Capacitor would */
const ORIGIN = "https://apex.local/";
let remoteAsked = [];
async function fetchStub(u) {
  const url = new URL(typeof u === "string" ? u : u.url, ORIGIN);
  if (url.origin !== new URL(ORIGIN).origin) remoteAsked.push(url.href);
  const p = join(WWW, url.pathname.replace(/^\//, ""));
  if (!existsSync(p)) return { ok: false, status: 404, json: async () => { throw new Error("404 " + p); } };
  const raw = readFileSync(p);
  return {
    ok: true, status: 200,
    json: async () => JSON.parse(raw.toString("utf8")),
    blob: async () => ({ __path: p }),
  };
}

/* timers under manual control */
const rafQ = []; let now = 0;
const timeouts = []; const intervals = new Map(); let iid = 1;
/* Respect the delay. Flushing every pending timer regardless fired a 25s
   give-up timer during a four-frame idle loop and released the GPS receiver
   before the test could use it — the harness inventing a failure again. */
function flushTimeouts(maxDelay = 5000) {
  for (let i = 0; i < timeouts.length; i++) {
    if (timeouts[i].d <= maxDelay) {
      const t = timeouts.splice(i, 1)[0];
      i--;
      t.fn();
    }
  }
}
function frames(n) { for (let i = 0; i < n; i++) { now += 16; const q = rafQ.splice(0); for (const f of q) f(now); } }
function ticks(n) { for (let i = 0; i < n; i++) for (const fn of [...intervals.values()]) fn(); }

/* maplibre stub records everything the app tells it */
const record = { sources: {}, layers: [], setData: {}, layout: [], paint: [], eased: [], fitted: 0 };
class MapStub {
  constructor(o) {
    this._on = {}; record.style = o.style;
    for (const [k, v] of Object.entries(o.style.sources)) record.sources[k] = v;
    record.layers = o.style.layers.map((l) => l.id);
  }
  on(t, cb) { (this._on[t] ||= []).push(cb); return this; }
  once(t, cb) { const f = (...a) => { cb(...a); this._on[t] = (this._on[t] || []).filter((x) => x !== f); }; (this._on[t] ||= []).push(f); return this; }
  fire(t, ev) { for (const cb of [...(this._on[t] || [])]) cb(ev || {}); }
  easeTo(o) { record.eased.push(o); this.fire("moveend"); }
  fitBounds() { record.fitted++; }
  getSource(n) { return { setData: (d) => { (record.setData[n] ||= []).push(d); } }; }
  addControl() {}
  getCanvasContainer() {
    if (!this._cv) {
      this._cv = new El("__canvas");
      /* Mirrors the browser: this wrapper really is zero-height (landmine 61). */
      this._cv.getBoundingClientRect = () => ({ left: 0, top: 38, width: 411, height: 0 });
    }
    return this._cv;
  }
  getContainer() {
    if (!this._ct) {
      this._ct = new El("__mapct");
      this._ct.getBoundingClientRect = () => ({ left: 0, top: 38, width: 411, height: 696 });
    }
    return this._ct;
  }
  unproject(p) { return { lng: this._up ? this._up[0] : -84.09, lat: this._up ? this._up[1] : 44.57 }; }
  setLayoutProperty(id, k, v) { record.layout.push([id, k, v]); }
  setPaintProperty(id, k, v) { record.paint.push([id, k, v]); }
  queryRenderedFeatures(box) {
    /* MapLibre has two contracts behind one name and they must not be conflated:
       no arguments  -> everything in the viewport (the render health check)
       a box + opts  -> a hit test at a tap point
       Returning viewport features to the hit test made a tap on open ground look
       like a tap on a trail, and the identify branch then indexed EDGES with an
       undefined id. Faithful stubs, or the harness invents its own bugs. */
    if (box === undefined)
      return DEAD_RENDER ? [] : new Array(1240).fill({ properties: {} });
    return this._hit || [];
  }
  getCanvas() { const c = new El("__gl"); c.getContext = () => null; c.width = 411; c.height = 696; return c; }
  getLayoutProperty(id, k) { const h = record.layout.filter((l) => l[0] === id && l[1] === k); return h.length ? h.at(-1)[2] : "visible"; }
  isStyleLoaded() { return true; }
  getLayersOrder() { return record.layers.slice(); }
  jumpTo(o) { record.eased.push(o); this.fire("moveend"); }
  setBearing(b) { this._bearing = b; }
  getBearing() { return this._bearing || 0; }
  getMinZoom() { return 5.2; }
  getCenter() { return { lat: 44.6, lng: -84.1 }; }
  getZoom() { return 12; }
}
let theMap = null;
const maplibregl = {
  Map: class extends MapStub { constructor(o) { super(o); theMap = this; } },
  /* Real Markers expose getElement(); without it the pin-tap handlers were
     wrapped in try/catch and silently never registered here — the harness
     quietly declining to test a feature (landmine 39). */
  Marker: class {
    constructor(o) { this._el = (o && o.element) || new El(null); markers.push(this); }
    setLngLat(ll) { this._ll = ll; return this; }
    addTo() { return this; }
    getElement() { return this._el; }
    remove() { this._removed = true; markers.splice(markers.indexOf(this), 1); }
    getLngLat() { return this._ll; }
  },
  GeolocateControl: class { on() { return this; } trigger() {} },
  LngLatBounds: class { extend() { return this; } },
  addProtocol(name) { protocolsAdded.push(name); },
};

/* node's URL.createObjectURL demands a real Blob; the app only needs a string
   back. Subclass keeps `new URL()` (the net guard uses it) and stubs the rest. */
class URLStub extends URL {
  static createObjectURL(b) { return "blob:apex/" + ((b && b.__path) || "x"); }
  static revokeObjectURL() {}
}

const sandbox = {
  document: documentStub,
  location: { href: ORIGIN },
  URL: URLStub, console, JSON, Math, Date, Promise, Object, Array, Number, String, parseFloat, parseInt, isFinite,
  Float64Array, Int32Array, Uint8Array,
  atob: (b) => Buffer.from(b, "base64").toString("binary"),
  getComputedStyle: () => ({ overflowX: "visible", position: "static", height: "960px" }),
  /* the environment section of the self-test reads these */
  innerWidth: 411, innerHeight: 960, devicePixelRatio: 2.625,
  screen: { width: 411, height: 960 },
  Uint8Array,
  navigator: (() => {
    const nav = { vibrate: () => {} };
    if (!NO_GPS) {
      /* real-GPS driver: the harness owns the fix stream */
      nav.geolocation = {
        watchPosition(cb, err) { geo.cb = cb; geo.err = err; return 42; },
        clearWatch() { geo.cleared++; geo.cb = null; },
      };
    }
    return nav;
  })(),
  performance: { now: () => now },
  requestAnimationFrame: (f) => rafQ.push(f),
  setTimeout: (f, d) => { timeouts.push({ fn: f, d: d || 0 }); return timeouts.length; },
  setInterval: (f) => { intervals.set(iid, f); return iid++; },
  clearInterval: (id) => intervals.delete(id),
  fetch: fetchStub,
  XMLHttpRequest: class { open() {} send() {} },
  maplibregl,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

/* ── run it ─────────────────────────────────────────────────────────────── */
const src = readFileSync(join(WWW, "app.js"), "utf8");
const manifest = JSON.parse(readFileSync(join(WWW, "bundle/manifest.json"), "utf8"));
console.log(`smoke: ${manifest.region} — ${manifest.name}`);

vm.createContext(sandbox);
try {
  vm.runInContext(src, sandbox, { filename: "www/app.js" });
} catch (e) {
  console.log(`  FAIL app.js threw at top level: ${e.message}`);
  process.exit(1);
}
/* let the loader's promise chain settle */
await new Promise((r) => setImmediate(r));
await new Promise((r) => setImmediate(r));
await new Promise((r) => setImmediate(r));

const fatalHtml = grab("__body")._html;
if (FATAL_DRILL) {
  ok(!!fatalHtml, "fatal screen shown");
  ok(/Region incomplete/.test(fatalHtml), "…says the region is incomplete");
  ok(/network/.test(fatalHtml), "…names the missing required artifact");
  ok(/worse than no map/.test(fatalHtml), "…states the principle, not just the error");
  ok(theMap === null, "map was NOT constructed — refused, not rendered with holes");
  ok(remoteAsked.length === 0, "zero remote requests");
  console.log(failures ? `\nSMOKE FAILED (${failures})` : "\nSMOKE PASSED");
  process.exit(failures ? 1 : 0);
}
if (EXPECT_PARTIAL.length === 0) {
  ok(!fatalHtml, "loader did not hit the fatal screen");
} 
ok(theMap !== null, "map constructed");
if (!theMap) process.exit(1);
theMap.fire("load");
frames(20);

/* 1 · region identity flows through */
const anchors = manifest.anchors || [];
const chips = documentStub.querySelectorAll(".chip").filter((c) => c.dataset.i !== undefined);
ok(chips.length >= Math.min(anchors.length, 1), `chips rendered (${chips.length}) from ${anchors.length} anchors`);
ok(anchors.every((a) => grab("chips")._html.includes(a[0])), "every anchor named in the chip strip");

/* 2 · sources and layers */
for (const s of ["net", "route", "crumb", "back"])
  ok(s in record.sources, `source '${s}' declared`);
/* Take 20: every source was declared AND correctly populated, and the device
   still drew nothing — the harness cannot render, so it asserts the contract it
   CAN see, and the app self-checks the rest at runtime (landmine 47). */
const netF = record.sources.net.data.features.length;
ok(netF > 1000, `net source carries real geometry (${netF} features)`);
ok(record.sources.places.data.features.length === (manifest.anchors || []).length,
   "places source carries every region anchor");
const appSrc = readFileSync(join(WWW, "app.js"), "utf8");
ok(/queryRenderedFeatures/.test(appSrc), "app self-checks that something rendered");
ok(/window\.__selfTest/.test(appSrc), "app exposes a runnable self-test");
ok(/c-selftest/.test(readFileSync(join(WWW, "index.html"), "utf8")),
   "self-test button present in the UI");
ok(/RENDER FAIL/.test(appSrc), "…and names the failure on screen if nothing did");
const idxSrc = readFileSync(join(WWW, "index.html"), "utf8");
ok(/setWorkerUrl/.test(idxSrc) && /csp/.test(idxSrc),
   "engine loads via the CSP build with an explicit worker URL");
ok(record.layers.includes("lbl-trail") && record.layers.includes("lbl-place"), "label layers present");
/* The assertion that missed the whole thing: it checked the URL was a data:
   URI, which is exactly what MapLibre rejects. Assert MapLibre's actual
   contract instead — the tokens it requires (landmine 51). */
const gl = record.style.glyphs || "";
ok(/\{fontstack\}/.test(gl) && /\{range\}/.test(gl),
   `glyphs url carries {fontstack} and {range} (${gl})`);
ok(protocolsAdded.includes("apexfont"), "glyph protocol registered for offline fonts");

/* 3 · partial-state honesty */
const badge = grab("b-src").textContent;
if (EXPECT_PARTIAL.length) {
  ok(badge === "PARTIAL", `badge says PARTIAL (got '${badge}')`);
  ok(EXPECT_PARTIAL.every((k) => grab("panel")._html.includes(k) || grab("panel")._html.length > 0),
     `panel names the missing layer(s): ${EXPECT_PARTIAL.join(",")}`);
} else {
  ok(badge !== "PARTIAL", `bundle complete, badge '${badge}'`);
}

/* 3b · the render detector: silent when healthy, loud when dead (landmine 47) */
for (let i = 0; i < 4; i++) { theMap.fire("idle"); flushTimeouts(); }
if (DEAD_RENDER) {
  ok(grab("b-src").textContent === "RENDER FAIL", "dead renderer raises RENDER FAIL");
  const ph = grab("panel")._html;
  ok(/nothing is drawing/.test(ph), "…panel says the map is not drawing");
  ok(/valid coordinates/.test(ph), "…and distinguishes data from renderer");
  ok(/worker thread/.test(ph), "…and names the likely cause");
  console.log(failures ? `\nSMOKE FAILED (${failures})` : "\nSMOKE PASSED");
  process.exit(failures ? 1 : 0);
}
ok(grab("b-src").textContent !== "RENDER FAIL",
   "healthy renderer raises no false alarm");

/* 3c · out-of-region: planning mode, and no fabricated position (--away) */
if (AWAY) {
  /* No tap. The app locates itself at startup, and take 30 silently failed to —
   * it showed a region 135 mi away and said nothing. Drive that path directly. */
  ok(geo.cb !== null, "app requested a fix at startup, unprompted");
  const before = geo.cleared;
  geo.cb({ coords: { longitude: -83.05, latitude: 42.33, accuracy: 8 } });  // Detroit
  const ah = grab("panel")._html;
  ok(/mi from/.test(ah), "out-of-region fix reports the distance, with no user action");
  ok(/Planning mode/.test(ah), "…and offers planning mode");
  ok(geo.cleared === before + 1, "…and releases the receiver after one fix");
  ok(/MAP CENTRE/.test(grab("coords")._html || grab("coords").innerHTML),
     "readout labels the coordinate MAP CENTRE, not a position");
  grab("btn-disp").fire("click");
  const dh2 = grab("panel")._html;
  ok(/No live position/.test(dh2) && !/\d{2}\.\d{5}/.test(dh2),
     "dispatch refuses and prints no coordinate");
  const [cx, cy] = [(manifest.bbox[0]+manifest.bbox[2])/2, (manifest.bbox[1]+manifest.bbox[3])/2];
  theMap.fire("click", { lngLat: { lng: cx, lat: cy }, point: { x: 540, y: 900 } });
  /* Tap on open ground no longer pins — it tells you how (take 36). */
  ok(/Press and hold/.test(grab("panel")._html),
     "tap on open ground explains the long press instead of pinning");
  /* Long press: drive the real touch path, timer and all. */
  const cv = theMap.getCanvasContainer();
  theMap._up = [cx, cy];
  cv.fire("touchstart", { touches: [{ clientX: 200, clientY: 400 }] });
  flushTimeouts();
  const card = grab("panel")._html;
  ok(/Dropped pin/.test(card), "long press drops a pin with a card");
  ok(/\d{2}\.\d{5}/.test(card), "…card shows decimal degrees");
  ok(/from your position/.test(card), "…and distance + bearing from you");
  ok(/pc-route/.test(card) && /pc-home/.test(card) && /pc-start/.test(card),
     "…and offers Directions / Make home / Start from here");
  /* tapping the HOME pin must open its own card, not the dropped pin's */
  const homeMarker = markers.find((m) => (m._el.className || "").includes("home"));
  if (homeMarker) {
    homeMarker.getElement().fire("click", { stopPropagation() {} });
    ok(/Home \/ truck/.test(grab("panel")._html), "tapping the home pin opens its card");
    ok(/pc-route/.test(grab("panel")._html), "…with Directions to it");
  } else ok(false, "home marker was created with a class we can find");
  theMap.fire("click", { lngLat: { lng: cx, lat: cy }, point: { x: 540, y: 900 } });

  /* the action a rider actually wants: route to the thing they tapped */
  ok(!!grab("pc-route"), "Directions button is addressable");
  grab("pc-route").fire("click");
  flushTimeouts();
  ok(documentStub.querySelectorAll(".rc").length >= 2,
     "…and routes to the dropped pin with multiple profiles");
  /* and a tap that HITS a trail must still identify it, not move the start */
  theMap._hit = [{ properties: { i: 0 } }];
  theMap.fire("click", { lngLat: { lng: cx, lat: cy }, point: { x: 300, y: 700 } });
  ok(!/Dropped pin/.test(grab("panel")._html),
     "tapping a trail identifies it instead of dropping a pin");
  /* A pin consumed by an action must stop existing, or the next one looks like
     it "wiped out" the first — exactly what confused Jacob at take 35. */
  theMap._hit = [];
  theMap.fire("contextmenu", { lngLat: { lng: cx, lat: cy } });
  ok(/Dropped pin/.test(grab("panel")._html), "long-press equivalent drops a pin");
  const pinsBefore = markers.length;
  grab("pc-start").fire("click");
  ok(markers.length === pinsBefore - 1, "using the pin as a start removes the pin marker");
  ok(/Start is here now/.test(grab("panel")._html), "…and says the ◎ pin holds the spot");
  theMap._hit = [];
  grab("btn-home").fire("click");
  flushTimeouts();
  const pc = documentStub.querySelectorAll(".rc");
  ok(pc.length >= 2, `Return Home still routes from the planned start (${pc.length} profiles)`);
  console.log(failures ? `\nSMOKE FAILED (${failures})` : "\nSMOKE PASSED");
  process.exit(failures ? 1 : 0);
}

/* 3d · offline geocoding, both directions, and silent when there is nothing */
/* 4 · search finds a real anchor */
const q = grab("q");
q.value = (anchors[0] ? anchors[0][0] : "trail").slice(0, 4).toLowerCase();
grab("c-search").fire("click");
q.fire("input");
ok(grab("hits")._html.length > 0 && !/No match/.test(grab("hits")._html),
   `search '${q.value}' returns hits`);

/* 4b · addresses: typed address geocodes, and a pin with none says nothing */
{
  const g = sandbox.window.__geo;
  ok(!!g && !!g.ADDR, "address index loaded from the bundle");
  if (g && g.ADDR) {
    const seg = g.ADDR.segs[0];
    const mid = [(seg[1] + seg[3]) / 2, (seg[2] + seg[4]) / 2];
    const rev = g.addressAt(mid);
    ok(!!rev && /\d+\s+\S/.test(rev.txt), `reverse geocode works (${rev ? rev.txt : "null"})`);
    if (rev) {
      const fwd = g.geocode(rev.n + " " + rev.street);
      ok(!!fwd, "typed address geocodes back to a point");
    }
    /* the requirement: no address means show nothing, never an announcement */
    ok(g.addressAt([manifest.bbox[0] - 3, manifest.bbox[1] - 3]) === null,
       "a point with no address resolves to null, not a guess");
    q.value = rev ? rev.n + " " + rev.street.slice(0, 8) : "mio";
    q.fire("input");
    ok(!/No match/.test(grab("hits")._html), "a typed address returns a search hit");
  }
}

/* 4c · loops: the impromptu ride. Must land near the asked-for distance and
   must not be an out-and-back wearing a loop's name. */
{
  const R = sandbox.window.__route;
  ok(!!R && typeof R.buildLoops === "function", "loop builder exposed");
  if (R && R.buildLoops) {
    const a = R.nearestNode(R.ME);
    const loops = a >= 0 ? R.buildLoops(a, 12) : [];
    ok(loops.length > 0, `built ${loops.length} loop option(s) for a 12 mi target`);
    if (loops.length) {
      const err = Math.min(...loops.map((o) => Math.abs(o.s.mi - 12) / 12));
      ok(err < 0.30, `best loop within ${(err * 100).toFixed(0)}% of target`);
      const rep = Math.min(...loops.map((o) => o.repeat));
      ok(rep < 0.40, `a genuine loop, ${(rep * 100).toFixed(0)}% ridden twice`);
      const ends = loops[0].s.path;
      ok(ends.length > 2, `loop has ${ends.length} edges`);
    }
  }
}

/* 5 · Return Home produces routes with cards */
grab("btn-home").fire("click");
flushTimeouts();
const cards = documentStub.querySelectorAll(".rc");
ok(cards.length >= 2, `route cards rendered (${cards.length} profiles)`);
ok((record.setData.route || []).length > 0 &&
   record.setData.route.at(-1).features.length > 0, "route line drawn on the map");
ok((record.setData.alt || []).length > 0 &&
   record.setData.alt.at(-1).features.length > 0,
   "alternates drawn beneath the selection so switching is visible");
/* The gap between a pin and the network must be DRAWN, not merely described —
   a route that starts half a mile from your pin looks broken (take 39). */
{
  const ap = (record.setData.approach || []).at(-1);
  const shown = ap ? ap.features.length : 0;
  const claimed = /off-network/.test(grab("panel")._html);
  ok(!claimed || shown > 0,
     claimed ? `off-network gap claimed and drawn (${shown} dashed legs)`
             : "no off-network gap to draw");
}

/* Selecting a different option: the map must hold still, exactly one card must
   be marked, and the strip must not be rebuilt (that reset scroll to 0 on every
   tap and made the row feel un-scrollable). Take 35. */
{
  const fitBefore = record.fitted;
  const drawnBefore = (record.setData.route || []).length;
  const all = documentStub.querySelectorAll(".rc");
  const target = all.length > 1 ? all[1] : all[0];
  target.fire("click");
  ok(record.fitted === fitBefore, "re-selecting a route does not re-frame the map");
  ok((record.setData.route || []).length > drawnBefore, "…but does redraw the line");
  const marked = documentStub.querySelectorAll(".rc").filter((c) =>
    c.className.split(/\s+/).includes("sel"));
  ok(marked.length === 1, `exactly one card marked selected (${marked.length})`);
}

/* 6 · directions for the chosen route */
grab("btn-steps").fire("click");
ok(/steps ·/.test(grab("panel")._html), "turn-by-turn generated");

/* 7 · ride → breadcrumb → retrace, the load-bearing path.
   Default: LIVE GPS drives it — the harness emits fixes and the same record
   chain must fire. --no-gps: the simulator path (the pre-take-16 behavior). */
const clearedBefore = geo.cleared;
grab("c-ride").fire("click");
if (!NO_GPS) {
  ok(geo.cb !== null, "ride started a GPS watch");
  const [cx, cy] = [(manifest.bbox[0]+manifest.bbox[2])/2, (manifest.bbox[1]+manifest.bbox[3])/2];
  for (let i = 0; i < 28; i++)
    geo.cb && geo.cb({ coords: { longitude: cx + i*8e-4, latitude: cy + i*5e-4, accuracy: 5 } });
  frames(3);
} else {
  ticks(300); frames(5);
}
const rec = grab("v-rec").textContent;
ok((record.setData.crumb || []).length > 0,
   `breadcrumb recorded via ${NO_GPS ? "simulator" : "live GPS"} (${rec} mi shown)`);
if (!NO_GPS) {
  ok(parseFloat(rec) > 0.5, `distance accumulated from fixes (${rec} mi)`);
  grab("c-ride").fire("click");
  ok(geo.cleared === clearedBefore + 1, "stop cleared the GPS watch");
  grab("c-ride").fire("click");           /* restart so retrace has a fresh view */
  for (let i = 0; i < 6; i++)
    geo.cb && geo.cb({ coords: { longitude: manifest.bbox[0]+0.05+i*6e-4, latitude: manifest.bbox[1]+0.05, accuracy: 5 } });
}
grab("btn-retrace").fire("click");
const back = (record.setData.back || []).at(-1);
ok(back && back.features.length === 1, "retrace drew the return line");
if (back && back.features.length) {
  const coords = back.features[0].geometry.coordinates;
  const crumbLine = (record.setData.crumb || []).at(-1).features[0].geometry.coordinates;
  const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
  ok(same(coords[0], crumbLine.at(-1)) && same(coords.at(-1), crumbLine[0]),
     "retrace is exactly the recorded track, reversed");
}

/* 7c · ride telemetry: A18 Stage 1 is closed by a real ride, so the ride has to
   measure itself. Assert it counts fixes and dropouts, and — the honest bit —
   refuses to quote a battery rate from a sample too small to support one. */
{
  const RD = sandbox.window.__ride;
  ok(!!RD && typeof RD.start === "function", "ride telemetry exposed");
  if (RD && RD.start) {
    RD.start([-84.09, 44.57]);
    for (let i = 0; i < 10; i++) RD.fix(7 + (i % 3));
    const live = RD.R;
    ok(live && live.fixes === 10, `counted ${live ? live.fixes : 0} fixes`);
    live.t0 = Date.now() - 8 * 60 * 1000;      // an 8 minute ride
    live.batt0 = 0.8; live.batt1 = 0.795;      // half a percent
    const short = RD.stop();
    ok(short.perHr === null,
       "a short ride quotes no battery rate (1% steps make it meaningless)");
    ok(/too short to quote a rate/.test(RD.report(short)),
       "…and the report says why rather than going quiet");

    RD.start([-84.09, 44.57]);
    for (let i = 0; i < 30; i++) RD.fix(9);
    const long = RD.R;
    long.t0 = Date.now() - 95 * 60 * 1000;
    long.batt0 = 0.8; long.batt1 = 0.52;
    long.last = Date.now() - 40000;
    const since = (Date.now() - long.last) / 1000;
    if (since > 15) { long.drops++; long.maxGap = since; }
    const done = RD.stop();
    ok(done.perHr !== null && done.perHr > 0.15 && done.perHr < 0.20,
       `a real ride quotes ${(done.perHr * 100).toFixed(1)}%/hour`);
    ok(done.drops === 1 && done.maxGap > 30,
       `dropout counted (${done.drops}, worst ${Math.round(done.maxGap)}s)`);
    ok(done.medAcc === 9, `median accuracy tracked (±${done.medAcc} m)`);
  }
}

/* 8 · dispatch is honest about WHERE the coordinate came from.
   Live GPS -> prints decimal degrees. Simulator -> refuses, because those
   coordinates are invented and this card gets read out to dispatch. */
grab("btn-disp").fire("click");
flushTimeouts();
const dh = grab("panel")._html;
if (NO_GPS) {
  ok(/No live position/.test(dh), "dispatch refuses a simulated position");
  ok(/invented/.test(dh), "…and says the coordinates are invented");
  ok(!/\d{2}\.\d{5}/.test(dh), "…and prints no coordinate at all");
} else {
  ok(/\d{2}\.\d{5}/.test(dh), "dispatch card shows decimal degrees");
  ok(/decimal degrees/.test(dh), "…and says so");
}

/* 8b · imagery must be tiles when the bundle carries them: a single mosaic over
   this AOI is 22 m/px, which is unusable for a one-metre two-track (take 42). */
{
  const sat = record.sources.sat;
  const tiles = manifest.imagery_tiles;
  if (tiles) {
    ok(sat && sat.type === "raster", `satellite is a raster tile source (${sat && sat.type})`);
    ok(sat && sat.maxzoom === tiles.zmax, `tiles served to z${sat && sat.maxzoom}`);
    ok(tiles.count > 100, `${tiles.count} tiles, ${(tiles.bytes / 1048576).toFixed(0)} MB`);
  } else {
    ok(sat && sat.type === "image", "no tiles in this bundle, mosaic fallback used");
  }
}

/* 9 · basemap: satellite only when the bundle can place it */
const satOK = !EXPECT_PARTIAL.includes("imagery");
grab("c-base").fire("click");
const satVis = record.layout.filter((l) => l[0] === "sat" && l[1] === "visibility").at(-1);
if (satOK) ok(satVis && satVis[2] === "visible", "basemap cycles to Satellite");
else ok(!satVis || satVis[2] === "none", "no imagery → basemap stays on Map");

/* 9b · the app's own self-test, run here too. It was only ever exercised in
   real Chrome; now that the stubs cover its API surface it runs in both, so a
   regression in it is caught by whichever harness runs first. */
if (!NO_GPS && sandbox.window.__selfTest) {
  /* The perf section drives requestAnimationFrame, and this harness owns the
     clock — so pump frames rather than await, or the promise never settles. */
  let st = null, threw = null;
  try { sandbox.window.__selfTest({ gps: false }, (r) => { st = r; }); }
  catch (e) { threw = String(e.message); }
  for (let i = 0; i < 500 && !st && !threw; i++) { frames(2); flushTimeouts(); }
  ok(!threw && !!st, `app self-test runs under the stubs${threw ? ": " + threw : st ? "" : " (never completed)"}`);
  if (st) {
    /* RENDER checks need a real GPU; render.mjs judges those. Here we assert
       everything a stub CAN judge — load, data, routing, safety, geocoding —
       and that render failures are confined to the render group. */
    const failed = (st.results || []).filter((r) => r.ok === false);
    const nonRender = failed.filter((r) => r.g !== "RENDER" && r.g !== "PERF");
    ok(nonRender.length === 0,
       `self-test: ${st.pass} pass, ${nonRender.length} non-render failures`
       + (nonRender.length ? " — " + nonRender[0].g + "·" + nonRender[0].id : ""));
    ok(failed.length === nonRender.length + failed.filter((r) => r.g === "RENDER" || r.g === "PERF").length,
       "render/perf failures under a stub are expected and isolated");
  }
}

/* 10 · nothing ever left the origin */
ok(remoteAsked.length === 0, `zero remote requests (${remoteAsked.length})`);

console.log(failures ? `\nSMOKE FAILED (${failures})` : "\nSMOKE PASSED");
process.exit(failures ? 1 : 0);
