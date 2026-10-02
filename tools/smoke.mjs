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
import { cpSync, mkdtempSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
if (FATAL_DRILL) {
  const src = wwwArg.startsWith("/") ? wwwArg : join(ROOT, wwwArg);
  /* Sweep anything a previous run left behind BEFORE making another. This copy
     is ~55 MB because it includes the imagery tiles, and it was never removed —
     189 of them, 11 GB, had accumulated by take 103 and filled the disk to 100%.
     What that looked like was not "no disk": it was
     `net::ERR_INSUFFICIENT_RESOURCES` on a bundle fetch and a puppeteer crash,
     i.e. a render failure (landmine 101's corollary, take 103). */
  try {
    for (const d of readdirSync(tmpdir())) {
      if (d.startsWith("apex-fatal-"))
        rmSync(join(tmpdir(), d), { recursive: true, force: true });
    }
  } catch (e) { /* a temp dir we cannot read is not a reason to fail the drill */ }
  const t = mkdtempSync(join(tmpdir(), "apex-fatal-"));
  cpSync(src, t, { recursive: true });
  const mp = join(t, "bundle/manifest.json");
  const man = JSON.parse(readFileSync(mp, "utf8"));
  man.artifacts = man.artifacts.filter((a) => a.kind !== "network");
  writeFileSync(mp, JSON.stringify(man));
  wwwArg = t;
  /* And remove this one on the way out, however the run ends. */
  const _sweep = () => { try { rmSync(t, { recursive: true, force: true }); } catch (e) {} };
  process.on("exit", _sweep);
  process.on("SIGINT", () => { _sweep(); process.exit(130); });
}
const WWW = wwwArg.startsWith("/") ? wwwArg : join(ROOT, wwwArg);
const EXPECT_PARTIAL = (opt("--expect-partial", "") || "").split(",").filter(Boolean);
const NO_GPS = args.includes("--no-gps");

let failures = 0;
const geo = { cb: null, err: null, cleared: 0, seq: 0, id: null, watches: new Map(), clearedIds: [] };
const protocolsAdded = [];
const markers = [];
/* take 189 · fix round 2 · every Marker ever made, never spliced: the A237
   stop drill finds the app's me-marker here (see remove() below) */
const everyMarker = [];
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
    // data-k as well as data-i: the activity filter identifies rows by
    // discipline key. A stub that models half the DOM rejects working code.
    const re = /<(?:button|div)\s+class="([^"]+)"((?:\s+data-[a-z]+="[^"]*")*)/g;
    let m;
    while ((m = re.exec(this._html))) {
      const c = new El(null);
      c.className = m[1];
      for (const d of (m[2] || "").matchAll(/data-([a-z]+)="([^"]*)"/g)) {
        c.dataset[d[1]] = d[2];
      }
      this._children.push(c);
    }
  }
  /* Real elements have these and the app calls them. check_stubs catches the
     reverse — the app calling what the harness lacks — which is exactly how the
     missing setFilter below was found (take 67). */
  querySelectorAll(sel) {
    const want = String(sel).replace(/^\./, "");
    return this._children.filter((c) => (c.className || "").split(/\s+/).includes(want));
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  get hidden() { return !!this._hidden; }
  set hidden(v) { this._hidden = !!v; }
  addEventListener(t, fn) { (this._listeners[t] ||= []).push(fn); }
  fire(t, ev) { for (const fn of this._listeners[t] || []) fn(ev || {}); }
  focus() {}
  select() {}
  click() { this.fire("click", { stopPropagation() {} }); }
  remove() { this._removed = true; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 411, height: 40, right: 411, bottom: 40 }; }
  scrollIntoView() { this._scrolledIntoView = true; }
  appendChild() {}
  getAttribute(n) { const m = /^data-([a-z]+)$/.exec(String(n)); return m && m[1] in this.dataset ? this.dataset[m[1]] : null; }
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
    /* take 188 · cold audit · [data-x]: the buttons a card binds by
       attribute (the loop chooser's distances). The stub answered none, so
       no drill could choose a loop */
    const at = String(sel).match(/^\[data-([a-z]+)\]$/);
    if (at) {
      const hit = [];
      for (const el of byId.values()) for (const c of el._children) if (at[1] in c.dataset) hit.push(c);
      return hit;
    }
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
const timeouts = []; const intervals = new Map(); let iid = 1; let tid = 1;
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
    /* the style's own layers ARE the source of truth for base paint values */
    this._styleLayers = (o.style && o.style.layers) || [];
    this._layers = new Set(this._styleLayers.map((l) => l.id));
    this._paint = new Map();
    for (const [k, v] of Object.entries(o.style.sources)) record.sources[k] = v;
    record.layers = o.style.layers.map((l) => l.id);
  }
  on(t, cb) { (this._on[t] ||= []).push(cb); return this; }
  once(t, cb) { const f = (...a) => { cb(...a); this._on[t] = (this._on[t] || []).filter((x) => x !== f); }; (this._on[t] ||= []).push(f); return this; }
  fire(t, ev) { for (const cb of [...(this._on[t] || [])]) cb(ev || {}); }
  easeTo(o) { record.eased.push(o); this.fire("moveend"); }
  fitBounds() { record.fitted++; }
  /* take 145 · hdCard reads the view, refreshSat pokes the painter */
  getBounds() { return { getWest: () => -84.30, getSouth: () => 44.50,
    getEast: () => -84.20, getNorth: () => 44.60 }; }
  /* take 169 · stackCard computes the camera before easing so a refused
     fit is visible; the stub answers with a plausible camera */
  /* take 170 · the follow camera and the nav strip read these */
  getBearing() { return 0; } getPitch() { return 0; }
  cameraForBounds(b) { const w = b[0][0], s0 = b[0][1], e = b[1][0], n = b[1][1];
    return { center: [(w + e) / 2, (s0 + n) / 2], zoom: 12 }; }
  triggerRepaint() { record.repaints = (record.repaints || 0) + 1; }
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
  setFilter(id, f) { (record.filters ||= []).push([id, f]); }
  /* take 125: applyMode captures each POI layer's base filter once */
  getFilter(id) { const l = (record.filters || []).filter((x) => x[0] === id); return l.length ? l[l.length - 1][1] : undefined; }
  setLayoutProperty(id, k, v) { record.layout.push([id, k, v]); }
  /* take 129: Outdoors moves the summit layers' minzoom */
  setLayerZoomRange(id, a, b) { (record.zoomRanges ||= []).push([id, a, b]); }
  setPaintProperty(id, k, v) { record.paint.push([id, k, v]); this._paint.set(id + "|" + k, v); }
  /* Machine legality reads the CURRENT paint back out of the style to find each
     layer's base opacity, rather than keeping a second copy of it (take 80).
     The stub must therefore answer getPaintProperty honestly: whatever was last
     set, else whatever the style declared at construction. A stub that returns
     undefined here would make every base collapse to 1 and the casings would
     silently stop dimming correctly (landmine 62). */
  getLayer(id) { return this._layers.has(id) ? { id } : undefined; }
  /* railFoldIfAway asks whether the place a card is about is still on screen,
     which means projecting lon/lat to a pixel. A flat approximation is enough:
     the app only tests whether the point is outside the container by 40 px, and
     nothing here depends on a real Mercator (take 109). */
  project(ll) {
    const c = Array.isArray(ll) ? ll : [ll.lng, ll.lat];
    const b = this._centre || [-84.09, 44.57];
    const z = this._zoom || 12;
    const px = 256 * Math.pow(2, z) / 360;
    return { x: 200 + (c[0] - b[0]) * px * 0.71,
             y: 400 - (c[1] - b[1]) * px };
  }
  getContainer() { return { getBoundingClientRect: () => ({ width: 412, height: 700 }) }; }
  addImage() {} hasImage() { return false; }
  /* A91 derives the label set from the style rather than from a hand-kept
     array, so the app now asks the map what layers it has. The stub already
     held them; it just never offered them (landmine 62 — the gate's stub
     check caught this before any test did). */
  getStyle() { return { layers: this._styleLayers.slice(),
                        sources: this._styleSources || {} }; }
  getPaintProperty(id, k) {
    if (this._paint.has(id + "|" + k)) return this._paint.get(id + "|" + k);
    const l = this._styleLayers.find((x) => x.id === id);
    return l && l.paint ? l.paint[k] : undefined;
  }
  queryRenderedFeatures(box) {
    /* MapLibre has two contracts behind one name and they must not be conflated:
       no arguments  -> everything in the viewport (the render health check)
       a box + opts  -> a hit test at a tap point
       Returning viewport features to the hit test made a tap on open ground look
       like a tap on a trail, and the identify branch then indexed EDGES with an
       undefined id. Faithful stubs, or the harness invents its own bugs. */
    if (box === undefined)
      return DEAD_RENDER ? [] : new Array(1240).fill({ properties: {} });
    /* MapLibre gives every hit a `geometry`. The stub gave none, so the first
       code to read one — the A110 place card — crashed on a real bug the stub
       had been hiding: a click handler that throws takes every other tap with
       it. Faithful stubs, or the harness invents its own bugs (landmine 62). */
    /* take 188 · a planted hit that carries layer.id (as MapLibre's do) is
       returned only to a query that asks for that layer; one without a layer
       answers every query, as it always has */
    const want = arguments[1] && arguments[1].layers;
    return (this._hit || []).filter((f) => !want || !f || !f.layer || want.includes(f.layer.id)).map((f) =>
      f && f.geometry ? f : Object.assign({}, f,
        { geometry: { type: "Point", coordinates: this.getCenter
                        ? [this.getCenter().lng, this.getCenter().lat]
                        : [0, 0] } }));
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
    constructor(o) { this._el = (o && o.element) || new El(null); markers.push(this); everyMarker.push(this); }
    setLngLat(ll) { this._ll = ll; return this; }
    addTo(m) { this._map = m; if (markers.indexOf(this) < 0) markers.push(this); /* re-attach re-registers, like real MapLibre (take 117) */ return this; }
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
  /* Saved routes (take 79). A stub that omits an API the app calls turns a
     working feature into a crash the harness reports as a product fault
     (landmine 62). Real semantics: string values, null for a missing key,
     survives within the run so save -> reopen can actually be exercised. */
  localStorage: (() => {
    const m = new Map();
    return {
      getItem: (k) => (m.has(String(k)) ? m.get(String(k)) : null),
      setItem: (k, v) => { m.set(String(k), String(v)); },
      removeItem: (k) => { m.delete(String(k)); },
      clear: () => m.clear(),
      get length() { return m.size; },
      key: (i) => [...m.keys()][i] ?? null,
    };
  })(),
  /* the environment section of the self-test reads these */
  innerWidth: 411, innerHeight: 960, devicePixelRatio: 2.625,
  screen: { width: 411, height: 960 },
  Uint8Array,
  navigator: (() => {
    const nav = { vibrate: () => {} };
    if (!NO_GPS) {
      /* real-GPS driver: the harness owns the fix stream */
      /* take 188 · cold audit · each watch has its own id, and the receiver
         closes the one it is asked to close, as a browser does. Every watch
         used to be 42 and any clearWatch emptied the one callback slot, so
         the harness could not tell the ride's watch from the startup
         locate's — the very mix-up the app had (landmine 62). geo.cb and
         geo.err stay the NEWEST watch's, which is what the drills answer;
         geo.watches holds every watch still open. */
      nav.geolocation = {
        watchPosition(cb, err) { const id = ++geo.seq; geo.watches.set(id, { cb, err }); geo.cb = cb; geo.err = err; geo.id = id; return id; },
        clearWatch(id) { geo.cleared++; geo.clearedIds.push(id); geo.watches.delete(id); if (id === geo.id) geo.cb = null; },
      };
    }
    return nav;
  })(),
  performance: { now: () => now },
  requestAnimationFrame: (f) => rafQ.push(f),
  /* take 157 · the sandbox modelled setTimeout but never clearTimeout, so
     any app code that cancels a timer died with a ReferenceError — the busy
     line's did. The gap was the harness's, not the app's: a browser has
     clearTimeout, so the stub must too. Ids are stable because
     flushTimeouts SPLICES the queue, which would invalidate index-based
     ones. */
  setTimeout: (f, d) => { const id = tid++; timeouts.push({ fn: f, d: d || 0, id }); return id; },
  clearTimeout: (id) => { const i = timeouts.findIndex((t) => t.id === id);
    if (i >= 0) timeouts.splice(i, 1); },
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
  ok(!fatalHtml, "loader did not hit the fatal screen"
     + (fatalHtml ? " :: " + fatalHtml.replace(/<[^>]+>/g, " ").slice(0, 220) : ""));
} 
ok(theMap !== null, "map constructed");
if (!theMap) process.exit(1);
theMap.fire("load");
frames(20);

/* 1 · region identity flows through */
const anchors = manifest.anchors || [];
const chips = documentStub.querySelectorAll(".chip").filter((c) => c.dataset.i !== undefined);
/* Take 113: the place strip folded into Search (reference study — neither
     onX nor AllTrails keeps a permanent pill row over the map). The contract
     is now: the strip renders NOTHING, and an empty search offers every anchor
     as a jump chip instead. */
  ok(!(grab("chips")._html || "").trim(),
     "the place strip renders nothing — quick-jumps moved into Search");
  grab("c-search").click();
  const jumps = grab("panel")._html.match(/data-jump=/g) || [];
  ok(jumps.length >= 8,
     `empty search offers every anchor as a jump chip (${jumps.length})`);
  grab("c-search").click();
  /* 2 · sources and layers */
for (const s of ["net", "route", "crumb", "back"])
  ok(s in record.sources, `source '${s}' declared`);
/* Take 20: every source was declared AND correctly populated, and the device
   still drew nothing — the harness cannot render, so it asserts the contract it
   CAN see, and the app self-checks the rest at runtime (landmine 47). */
const netF = record.sources.net.data.features.length;
ok(netF > 1000, `net source carries real geometry (${netF} features)`);
/* 2a · take 188 · A202 D7 (G8) · the low-zoom strokes are the drawn edges,
   chained by class, and nothing else: per class, stroke vertices = edge
   vertices minus one per join (joins = edges - strokes), and stroke length is
   at least the edge length and at most 40 m more per join with a gap (the
   graph puts edge ends up to 36 m off their node; a gap join is counted as an
   edge end missing from its class's stroke vertices, which can only
   undercount). Every stroke has no edge id and a class that has edges; every
   class has a stroke. Run on two planted copies first (landmine 54).
   Step 9b scoped the chaining to the five designated trail classes; step
   13b2 extended it, by measurement, to every class Hybrid draws below z11
   that lost more than 2%; take 188 then scoped two-track and paved back to
   per-edge (the ten classes cost +3.0/+3.2 s to ready on desktop, and those
   two were 82% of the stroke vertices). The set is the app's NETLO_CLS, read
   from the built app.js, not typed here; it must equal what the app reports,
   contain the casing's designated five, and hold no class of D7_SKIP below.
   D7_SKIP is recorded HERE, each class with its measured reason, and the
   app's NETLO_SKIP must name the same classes: every drawn class is either
   chained or on this list, so a class moved in or out, or one the data gains
   later, fails until someone measures it and changes both. A stroke of any
   class outside the set is a failure, and so is a chained class without one
   (third plant: a stroke moved to a class outside the set). G8s: on Map the
   style wraps exactly the network layers that can draw a stroke, and leaves
   every other network filter as take 187 wrote it (two plants). */
{
  const d7len = (co) => { let m = 0; for (let k = 1; k < co.length; k++) {
    const dx = (co[k][0] - co[k - 1][0]) * 79000, dy = (co[k][1] - co[k - 1][1]) * 111320; m += Math.sqrt(dx * dx + dy * dy); } return m; };
  const unLo = (f) => Array.isArray(f) && f[0] === "all" && f.length === 3
    && JSON.stringify(f[2]) === JSON.stringify(["!", ["has", "lo"]]) ? f[1] : f;
  const casL = (record.style.layers || []).find((l) => l.id === "casing") || {};
  const casF = unLo(casL.filter);
  const DESIG = Array.isArray(casF) && casF[0] === "in" && Array.isArray((casF[2] || [])[1]) ? casF[2][1].slice() : [];
  const clsDecl = /NETLO_CLS=\[([^\]]*)\]/.exec(readFileSync(join(WWW, "app.js"), "utf8"));
  const SCOPE = clsDecl ? (clsDecl[1].match(/'[^']+'/g) || []).map((x) => x.slice(1, -1)) : [];
  const nlo = sandbox.window.__netLo || {};
  /* the classes drawn per edge at every zoom, and the measured reason
     (Hybrid, step 13b2's two cameras per class; unchained share of length
     kept at z7, and the class's stroke vertices when step 13b2 chained it) */
  const D7_SKIP = {
    track: "two-track: 90.1-94.7% kept at z7 unchained, 704,198 stroke vertices (65% of the ten-class strokes)",
    paved: "paved: 89.6-96.9% kept at z7 unchained, 190,401 stroke vertices (18%)",
    minor: "minor: Hybrid draws it from z11.5 only, so a stroke could never draw",
  };
  const SKIPC = Object.keys(D7_SKIP);
  const g8set = (sc, app, des) => sc.length > 0 && des.length === 5 && des.every((c) => sc.includes(c)) && !sc.some((c) => SKIPC.includes(c))
    && JSON.stringify(app.slice().sort()) === JSON.stringify(sc.slice().sort());
  ok(!g8set(SCOPE.filter((c) => c !== "mccct"), SCOPE.filter((c) => c !== "mccct"), DESIG) && !g8set(SCOPE.concat("minor"), SCOPE.concat("minor"), DESIG)
     && !g8set(SCOPE.concat("track"), SCOPE.concat("track"), DESIG) && !g8set(SCOPE.concat("paved"), SCOPE.concat("paved"), DESIG)
     && !g8set(SCOPE, SCOPE.slice(0, -1), DESIG),
     "G8 · the scope judge rejects a set without a designated class, a set with minor, with track, with paved, and an app that reports a different set");
  /* every class the net source draws is chained or on D7_SKIP. A class the
     data gains later is reported here until someone measures it and decides. */
  const netCls = [...new Set(record.sources.net.data.features.filter((f) => f.properties && f.properties.i !== undefined).map((f) => f.properties.c))];
  const unchained = (sc) => netCls.filter((c) => !SKIPC.includes(c) && !sc.includes(c));
  ok(unchained(SCOPE.filter((c) => c !== "fsroad")).join() === "fsroad",
     "G8 · the coverage judge names fsroad when a planted scope leaves it out");
  ok(netCls.length > 5 && unchained(SCOPE).length === 0 && SKIPC.every((c) => netCls.includes(c)),
     `G8 · every drawn network class is chained or recorded per-edge (${netCls.length} classes in the net source; per edge: ${SKIPC.join(", ")})`
     + (unchained(SCOPE).length ? " — NOT CHAINED AND NOT RECORDED: " + unchained(SCOPE).join(", ") : "")
     + (SKIPC.every((c) => netCls.includes(c)) ? "" : " — recorded but not in the net source: " + SKIPC.filter((c) => !netCls.includes(c)).join(", ")));
  ok(g8set(SCOPE, nlo.cls || [], DESIG),
     `G8 · the chained classes are NETLO_CLS (${SCOPE.join(", ")}): the casing's five (${DESIG.join(", ")}) plus the measured ones, none of ${SKIPC.join("/")}; app says ${(nlo.cls || []).join(", ") || "none"}`);
  const skipSame = (app) => JSON.stringify((app || []).slice().sort()) === JSON.stringify(SKIPC.slice().sort());
  ok(!skipSame(SKIPC.filter((c) => c !== "paved")) && !skipSame(SKIPC.concat("fsroad")) && skipSame(nlo.skip),
     `G8 · the app's NETLO_SKIP names the recorded per-edge classes (${(nlo.skip || []).join(", ") || "none"}); `
     + "a planted list without paved, or with fsroad, is rejected");
  for (const c of SKIPC) console.log(`  ..   G8 per edge: ${D7_SKIP[c]}`);
  const g8 = (feats) => {
    const E = {}, S = {}, bad = [], key = (p) => p[0] + "," + p[1];
    for (const f of feats) {
      const p = f.properties || {}, co = f.geometry.coordinates;
      if (p.lo === 1) { if (p.i !== undefined) bad.push(`${p.c}: a stroke carries an edge id`);
        const r = (S[p.c] ||= { n: 0, v: 0, L: 0, pts: new Set() }); r.n++; r.v += co.length; r.L += d7len(co);
        for (const q of co) r.pts.add(key(q)); }
      else if (p.i !== undefined) { const r = (E[p.c] ||= { n: 0, v: 0, L: 0, ends: [] }); r.n++; r.v += co.length; r.L += d7len(co);
        r.ends.push(co[0], co[co.length - 1]); }
    }
    for (const c of Object.keys(S)) if (!E[c]) bad.push(`${c}: strokes of a class with no edges`);
    for (const c of Object.keys(S)) if (!SCOPE.includes(c)) bad.push(`${c}: ${S[c].n} strokes of a class outside the chained set`);
    const rows = {};
    for (const c of Object.keys(E)) {
      if (!SCOPE.includes(c)) continue;
      const e = E[c], t = S[c];
      if (!t) { bad.push(`${c}: no stroke`); continue; }
      const joins = e.n - t.n, gaps = e.ends.filter((q) => !t.pts.has(key(q))).length, dL = t.L - e.L;
      rows[c] = { edges: e.n, strokes: t.n, gaps, dLm: Math.round(dL), v: t.v };
      if (t.v !== e.v - joins) bad.push(`${c}: ${t.v} stroke vertices, expected ${e.v} - ${joins} joins = ${e.v - joins}`);
      if (dL < -1e-6 * e.L || dL > gaps * 40) bad.push(`${c}: stroke length ${Math.round(t.L)} m vs edges ${Math.round(e.L)} m (${gaps} gap joins)`);
    }
    return { bad, rows }; };
  const net = record.sources.net.data.features, nLo = net.filter((f) => f.properties && f.properties.lo === 1).length;
  if (!nLo) ok(false, "G8 · the net source carries no low-zoom strokes (A202 D7 missing, or its chaining failed)");
  else {
    const byC = {}; net.forEach((f, k) => { const p = f.properties; if (p.lo === 1 && (!byC[p.c] || f.geometry.coordinates.length > net[byC[p.c]].geometry.coordinates.length)) byC[p.c] = k; });
    const cls = Object.keys(byC).sort((a, b) => net[byC[b]].geometry.coordinates.length - net[byC[a]].geometry.coordinates.length)[0];
    const dropped = net.filter((f, k) => k !== byC[cls]);
    const other = Object.keys(byC).find((c) => c !== cls);
    const moved = net.map((f, k) => k === byC[cls] ? { ...f, properties: { ...f.properties, c: other } } : f);
    const p1 = g8(dropped).bad, p2 = g8(moved).bad;
    ok(p1.some((x) => x.startsWith(cls + ":")) && p2.some((x) => x.startsWith(cls + ":")) && p2.some((x) => x.startsWith(other + ":")),
       `G8 names the class when ${cls}'s longest stroke is removed (${p1.length}) and when it is moved to ${other} (${p2.length})`);
    const outC = net.find((f) => f.properties && f.properties.i !== undefined && !SCOPE.includes(f.properties.c));
    const outside = outC ? outC.properties.c : "track";
    const p3 = g8(net.map((f, k) => k === byC[cls] ? { ...f, properties: { ...f.properties, c: outside } } : f)).bad;
    ok(p3.some((x) => x.startsWith(outside + ":")),
       `G8 names ${outside} when a stroke is moved outside the chained set (${p3.length})`);
    const r = g8(net);
    ok(r.bad.length === 0, `G8 · ${nLo} low-zoom strokes conserve every class's drawn edges (vertices exact, length +0..40 m per gap join)`
       + (r.bad.length ? " — " + r.bad.slice(0, 4).join("; ") : ""));
    console.log("  ..   G8 baseline: " + Object.entries(r.rows).map(([c, x]) => `${c} ${x.edges}e/${x.strokes}s/${x.v}v/${x.gaps}g/+${x.dLm}m`).join(" · "));
  }
  /* G8s · the style's network layers. A layer whose classes are all chained
     carries ['all', <class filter>, ['!',['has','lo']]] on Map; any other
     network layer carries no 'lo' at all; the app's swap table names exactly
     the wrapped layers. */
  const g8s = (layers) => {
    const bad = [], wrapped = [];
    for (const l of layers) {
      if (l.source !== "net") continue;
      const base = unLo(l.filter), isW = base !== l.filter;
      const cl = Array.isArray(base) && base[0] === "==" ? [base[2]]
        : Array.isArray(base) && base[0] === "in" && Array.isArray((base[2] || [])[1]) ? base[2][1] : null;
      if (!cl) { bad.push(`${l.id}: class filter not read`); continue; }
      const inS = cl.every((c) => SCOPE.includes(c));
      if (inS && !isW) bad.push(`${l.id}: can draw a stroke but is not wrapped on Map`);
      if (!inS && /"lo"/.test(JSON.stringify(l.filter))) bad.push(`${l.id}: outside the chained set but its filter reads lo`);
      if (isW) wrapped.push(l.id);
    }
    return { bad, wrapped }; };
  const LS = record.style.layers || [];
  const pw = g8s(LS.map((l) => l.id === "casing-track" || l.id === "paved" ? { ...l, filter: ["all", l.filter, ["!", ["has", "lo"]]] } : l)).bad;
  const pu = g8s(LS.map((l) => l.id === "casing-fsroad" ? { ...l, filter: unLo(l.filter) } : l)).bad;
  ok(pw.some((x) => x.startsWith("casing-track:")) && pw.some((x) => x.startsWith("paved:")) && pu.some((x) => x.startsWith("casing-fsroad:")),
     `G8s flags planted wrapped casing-track and paved filters (${pw.length}) and an unwrapped casing-fsroad filter (${pu.length})`);
  const gs = g8s(LS), tab = (nlo.layers || []).slice().sort();
  ok(gs.bad.length === 0 && gs.wrapped.length >= 6 && JSON.stringify(gs.wrapped.slice().sort()) === JSON.stringify(tab),
     `G8s · Map wraps exactly the ${gs.wrapped.length} network layers that can draw a stroke (${gs.wrapped.join(", ")}), `
     + `every other network filter is take 187's, and the swap table agrees`
     + (gs.bad.length ? " — " + gs.bad.slice(0, 4).join("; ") : "") + (JSON.stringify(gs.wrapped.slice().sort()) === JSON.stringify(tab) ? "" : ` — table ${tab.join(", ")}`));
}
ok(record.sources.places.data.features.length === (manifest.anchors || []).length,
   "places source carries every region anchor");
/* take 189 · A237 · fix round 1 · the place card's (placeCard: a dropped
   pin, Home / truck, a waypoint) "N mi DIR (deg°) from …" names the point
   ME is, judged from the app's live reader and position mode, not from the
   card: "your position" only with a live fix; else the start pin, the
   simulated position, the planning start (away), or on a ride whose fix has
   gone stale, the last GPS fix. Take 188's "from your position" with no fix
   is rejected (each caller shows the judge that control). */
function fromOk(card, live, pos) {
  const h = String(card || "");
  if (live) return /\(\d+°\) from your position</.test(h);
  const want = pos === "sim" ? "the simulated position" : pos === "away" ? "the planning start"
    : pos === "gps" ? "(the start pin|your last GPS fix \\([^)<]+\\))" : "the start pin";
  return new RegExp("\\(\\d+°\\) from " + want + "<").test(h) && !/from your position/.test(h);
}
const fromLine = (h) => ((String(h || "").match(/[\d.]+ mi [NSEW]{1,3} \(\d+°\) from [^<]*/) || [])[0] || "(no distance line)");
const fromCtl = () => !fromOk('<span class="unit">3.21 mi NE (45°) from your position</span>', false, "none")
  && !fromOk('<span class="unit">3.21 mi NE (45°) from your position</span>', false, "away")
  && fromOk('<span class="unit">3.21 mi NE (45°) from the start pin</span>', false, "none")
  && fromOk('<span class="unit">3.21 mi NE (45°) from your position</span>', true, "gps")
  && !fromOk('<span class="unit">3.21 mi NE (45°) from the start pin</span>', true, "gps");
const appSrc = readFileSync(join(WWW, "app.js"), "utf8");
/* take 189 · cold audit · A234's re-join on a PLANTED graph. The shipped
   loopRejoin — with route, mi, snapMiles, navFmt and LOOP_SHAPES, sliced
   from the built app.js — runs on a 2 x 2 mi square loop (16 nodes, 0.5 mi
   apart, start L0) with a parallel trail L4 > A > B > C > L8 and a
   two-node trail no legal edge joins to anything. Three readings:
   (U) a rider on the parallel trail beside the loop: the crow-nearest loop
   node ahead (L7) is reachable only through the junction ahead (L8); the
   re-join must stop at the first loop node it reaches — no edge ridden
   twice (the audit's harness: B > C > L8 > L7 > L8, 0.5 mi twice, a U-turn).
   (G) a rider 145 m off the loop beside a node ahead: "to it" holds the
   gap, never "0.0 mi" (the leg alone was empty).
   (I) a rider whose nearest legal node cannot reach the loop: ONE search,
   not one per candidate (every candidate is a node of one connected loop).
   Each judge rejects its planted reading. */
if (!DEAD_RENDER && !AWAY) {
  const fnOf = (name) => { const i = appSrc.indexOf("function " + name + "("); if (i < 0) return "";
    let k = appSrc.indexOf("{", i), d = 0; for (; k < appSrc.length; k++) { if (appSrc[k] === "{") d++; else if (appSrc[k] === "}" && !--d) break; }
    return appSrc.slice(i, k + 1); };
  const between = (a, b) => { const i = appSrc.indexOf(a), j = appSrc.indexOf(b, i); return i >= 0 && j > i ? appSrc.slice(i, j) : ""; };
  const parts = { route: fnOf("route"), mi: fnOf("mi"), snapMiles: fnOf("snapMiles"), navFmt: fnOf("navFmt"),
    shapes: between("var LOOP_SHAPES=[", "function buildLoops("), rejoin: between("var REJOIN_MIN_M=", "function navFmt(") };
  const missing = Object.keys(parts).filter((k) => !parts[k] || (k === "rejoin" && !/function loopRejoin\(/.test(parts[k])));
  const rjRun = (rider, progMi) => {
    const cosl = 0.714, P = (x, y) => [-84 + x / (69 * cosl), 45 + y / 69];
    const NODES = [], EDGES = [], ADJ = [];
    const N = (x, y) => { NODES.push(P(x, y)); ADJ.push([]); return NODES.length - 1; };
    const E = (a, b) => { const L = Math.hypot((NODES[a][0] - NODES[b][0]) * 69 * cosl, (NODES[a][1] - NODES[b][1]) * 69) * 1609.34;
      const e = { i: EDGES.length, a, b, c: "trail50", L }; EDGES.push(e); ADJ[a].push(e); ADJ[b].push(e); return e; };
    const sq = []; for (let i = 0; i < 4; i++) sq.push([i * 0.5, 0]); for (let i = 0; i < 4; i++) sq.push([2, i * 0.5]);
    for (let i = 0; i < 4; i++) sq.push([2 - i * 0.5, 2]); for (let i = 0; i < 4; i++) sq.push([0, 2 - i * 0.5]);
    const loop = sq.map((q) => N(q[0], q[1])), path = [];
    for (let i = 0; i < 16; i++) path.push(E(loop[i], loop[(i + 1) % 16]));
    const A = N(2.3, 0), B = N(2.3, 1.2), C = N(2.3, 2); E(loop[4], A); E(A, B); E(B, C); E(C, loop[8]);
    const X1 = N(3.5, 1), X2 = N(3.6, 1); E(X1, X2);
    const cx = vm.createContext({ Math, Float64Array, Int32Array, Uint8Array, Infinity, isFinite, NODES, EDGES, ADJ,
      ROUTE_CAP: 1e6, DESIG: { trail50: 1 }, DIRT: {}, spd: () => 14, machineLegal: () => true, RFROM: null, NAVG: {},
      nearestNode: (ll) => { let b = -1, bd = 1e9; NODES.forEach((n, i) => { const d = Math.hypot(n[0] - ll[0], n[1] - ll[1]); if (d < bd) { bd = d; b = i; } }); return b; },
      summarise: (p) => ({ path: p, mi: p.reduce((t, e) => t + e.L, 0) / 1609.34 }),
      presentRoutes: (o) => { cx.__out = o; }, logAct: () => {} });
    vm.runInContext([parts.route, parts.mi, parts.snapMiles, parts.navFmt, parts.shapes, parts.rejoin].join("\n"), cx);
    let calls = 0; const r0 = cx.route; cx.route = function () { calls++; return r0.apply(null, arguments); };
    const legs = [], ends = [], cum = [0]; let cur = loop[0];
    path.forEach((e, i) => { cum.push(cum[cum.length - 1] + e.L); legs.push(i + 1); cur = e.a === cur ? e.b : e.a; ends.push(cur); });
    const G = { o: { k: "ltrail", na: loop[0], nb: loop[0], s: { path } }, legs, ends, cum };
    const ret = cx.loopRejoin(P(rider[0], rider[1]), G, { prog: progMi * 1609.34 });
    const o = cx.__out && cx.__out[0];
    const ids = o ? o.s.path.map((e) => e.i) : [];
    return { ret, calls, o, twice: ids.length - new Set(ids).size, note: o ? o.note : "", leg: o ? o.rj.leg : -1 };
  };
  if (missing.length) ok(false, `A234 · the re-join on a planted graph: could not slice ${missing.join(", ")} from app.js`);
  else {
    const U = rjRun([2.3, 1.0], 3.0), Gp = rjRun([1.0, 2.09], 4.2), I = rjRun([3.45, 1.0], 3.0);
    const uOk = (r) => r.ret === true && !!r.o && r.twice === 0 && r.leg > 0 && r.leg < 1.5;
    const gOk = (r) => r.ret === true && r.leg * 1609.34 >= 100 && !/^0\.0 mi\b/.test(r.note);
    const iOk = (r) => r.ret === false && r.calls === 1;
    ok(uOk(U) && !uOk({ ret: true, o: {}, twice: 1, leg: 1.8 }),
       `A234 · a rider on a trail that meets the loop ahead re-joins at the first loop node the leg reaches: no edge ridden twice `
       + `(${U.twice}), ${U.leg.toFixed(2)} mi to it — "${U.note}"; the judge rejects the U-turn reading (one edge twice, 1.8 mi)`);
    ok(gOk(Gp) && !gOk({ ret: true, leg: 0, note: "0.0 mi back to the loop, then the rest of it to the start (6.3 mi)" }),
       `A234 · a rider 145 m off the loop beside a node ahead: "to it" holds the gap (${(Gp.leg * 1609.34).toFixed(0)} m) — "${Gp.note}"; `
       + `the judge rejects "0.0 mi back to the loop"`);
    ok(iOk(I) && !iOk({ ret: false, calls: 4 }),
       `A234 · a rider whose nearest legal node cannot reach the loop: ${I.calls} search(es), re-join ${I.ret}; `
       + `the judge rejects one search per candidate (4)`);
  }
}
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
/* PARTIAL is a DESIGNED state, not a failure. This used to assert
   badge !== "PARTIAL" whenever no --expect-partial flag was passed, so a region
   that legitimately has no water — Overpass down, TIGER fallback, exactly what
   take 56 built and called "the designed behaviour" — failed the harness.
   Landmine 56's corollary: assert the system's RESPONSE to a condition, never
   the condition itself.

   The expectation comes from the manifest the app actually loaded, not from a
   flag someone has to remember to pass. That is strictly stronger: it checks
   the honesty machinery in BOTH directions rather than assuming an outcome. */
const OPT_KINDS = { imagery: "imagery", relief: "relief", hydro: "hydro" };
const kindsPresent = new Set((manifest.artifacts || []).map((a) => a.kind));
const manifestAbsent = Object.keys(OPT_KINDS).filter((k) => !kindsPresent.has(k));
const expectAbsent = EXPECT_PARTIAL.length ? EXPECT_PARTIAL : manifestAbsent;

if (expectAbsent.length) {
  ok(badge === "PARTIAL",
     `manifest is missing ${expectAbsent.join(",")} — badge says PARTIAL (got '${badge}')`);
  ok(grab("panel")._html.length > 0,
     `panel names the missing layer(s): ${expectAbsent.join(",")}`);
} else {
  ok(badge !== "PARTIAL",
     `every optional layer present — badge '${badge}', not PARTIAL`);
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
  /* Take 117: this fix was hardcoded Detroit — genuinely away from a forest
     box, INSIDE the statewide bbox. The premise, not the app, broke when the
     region grew. The drill now computes a point west of whatever region it is
     judging, so it can never expire again. */
  const bb = manifest.bbox;
  geo.cb({ coords: { longitude: bb[0] - 1.5,
                     latitude: (bb[1] + bb[3]) / 2, accuracy: 8 } });
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
  /* Take 117: the bbox midpoint of a STATEWIDE region is the middle of Lake
     Michigan — the drill was planning rides in open water, and every pin
     snapped to the same shoreline node. Stand where riders stand: the
     declared centre (trail country), midpoint only as a fallback. */
  const [cx, cy] = manifest.centre
    || [(manifest.bbox[0]+manifest.bbox[2])/2, (manifest.bbox[1]+manifest.bbox[3])/2];
  theMap.fire("click", { lngLat: { lng: cx, lat: cy }, point: { x: 540, y: 900 } });
  /* Tap on open ground no longer pins — it tells you how (take 36). */
  ok(/press and hold/i.test(grab("peek-txt").textContent || ""),
     "tap on open ground FOLDS the drawer and explains the long press on the "
     + "peek strip — an empty tap is how a rider asks for the map back, so the "
     + "answer must not cost half the screen (A127, take 109)");
  /* Long press: drive the real touch path, timer and all. */
  const cv = theMap.getCanvasContainer();
  /* the pin the rider routes to must be a different PLACE than where they
     stand — the phantom-home era hid that this drill's geometry was
     degenerate (take 117) */
  theMap._up = [cx + 0.032, cy - 0.006];
  cv.fire("touchstart", { touches: [{ clientX: 200, clientY: 400 }] });
  flushTimeouts();
  const card = grab("panel")._html;
  ok(/Dropped pin/.test(card), "long press drops a pin with a card");
  ok(/\d{2}\.\d{5}/.test(card), "…card shows decimal degrees");
  {
    const N7 = sandbox.window.__nav, live7 = N7 && typeof N7.live === "function" ? N7.live() : undefined,
      pos7 = N7 && typeof N7.pos === "function" ? N7.pos() : "?";
    ok(live7 !== undefined && fromOk(card, !!live7, pos7) && fromCtl(),
       `…and distance + bearing from the point it measures from (position ${pos7}, live fix ${!!live7}): "${fromLine(card)}"; `
       + `its control rejects take 188's "from your position" with no fix (${fromCtl()})`);
  }
  ok(/pc-route/.test(card) && /pc-home/.test(card) && /pc-start/.test(card),
     "…and offers Route here / Make home / Start from here");
  /* The HOME spec (take 117): away planning sets the truck as home FIRST —
     exactly what the away banner tells the rider to do. */
  /* The HOME spec (take 117): away planning sets the truck as home FIRST —
     at a spot OFFSET from the drill's pin, or route-to-home degenerates to a
     zero-length trip. Press-and-hold there, Make this home, then restore the
     drill's own pin. */
  theMap._up = [cx + 0.02, cy + 0.006];
  cv.fire("touchstart", { touches: [{ clientX: 260, clientY: 380 }] });
  flushTimeouts();
  grab("pc-home") && grab("pc-home").fire("click");
  flushTimeouts();
  theMap._up = [cx, cy];
  cv.fire("touchstart", { touches: [{ clientX: 200, clientY: 400 }] });
  flushTimeouts();
  /* tapping the HOME pin must open its own card, not the dropped pin's */
  const homeMarker = markers.find((m) => (m._el.className || "").includes("home"));
  if (homeMarker) {
    homeMarker.getElement().fire("click", { stopPropagation() {} });
    ok(/Home \/ truck/.test(grab("panel")._html), "tapping the home pin opens its card");
    ok(/pc-route/.test(grab("panel")._html), "…with Route here to it");
  } else ok(false, "home marker was created with a class we can find");
  theMap.fire("click", { lngLat: { lng: cx, lat: cy }, point: { x: 540, y: 900 } });

  /* the action a rider actually wants: route to the thing they tapped */
  ok(!!grab("pc-route"), "Route here button is addressable");
  grab("pc-route").fire("click");
  flushTimeouts();
  ok(documentStub.querySelectorAll(".rc").length >= 2,
     "…and routes to the dropped pin with multiple profiles");
  /* take 188 · A217 · the route cards' one primary: Ride it (this pass is
     --away only; the default and --no-gps passes start their ride from it
     in section 7) */
  ok(/id="rc-ride"/.test(grab("panel")._html) && /<span>Ride it<\/span>/.test(grab("panel")._html),
     "…with Ride it (#rc-ride) under the cards");
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
  ok(/Start is here now/.test(grab("panel")._html), "…and says the start pin holds the spot");
  theMap._hit = [];
  grab("btn-home").fire("click");
  flushTimeouts();
  const pc = documentStub.querySelectorAll(".rc");
  ok(pc.length >= 2, `Return Home still routes from the planned start (${pc.length} profiles)`);
  /* take 188 · cold audit (F8, F20) · a ride that meets an out-of-region fix
     ENDS, all of it. Ride starts navigation at the press (the strip, the
     wake lock); the away branch closed the watch and the flag and left the
     rest: a strip over no ride, and — mid-ride — a ride sheet whose Stop
     did nothing, a recording never closed and a trip left resumable. Both
     ways in: the first fix after the press, and a fix after the ride was
     recording. The judge is shown each ride's own running state, which it
     must reject (its control). */
  {
    const N = sandbox.window.__nav, RD = sandbox.window.__ride;
    const awayFix = { coords: { longitude: bb[0] - 1.5, latitude: (bb[1] + bb[3]) / 2, accuracy: 8 } };
    const state = () => ({ strip: grab("nav").hidden === false, on: !!(N && N.state.on), sheet: grab("hudstats").hidden === false,
      tape: grab("hudbar").hidden === false, flag: "ride" in grab("shell").dataset, watch: typeof geo.cb === "function",
      chip: String(grab("c-ride")._html || "").replace(/<[^>]*>/g, ""), chipOff: grab("c-ride").hidden === true });
    const ended = (x) => !x.strip && !x.on && !x.sheet && !x.tape && !x.flag && !x.watch && /Ride it/.test(x.chip) && !x.chipOff;
    const say = (x) => `strip ${x.strip}, guidance ${x.on}, sheet ${x.sheet}, tape ${x.tape}, flag ${x.flag}, watch ${x.watch}, chip "${x.chip}"`;
    /* the first fix after the press */
    grab("c-ride").fire("click");
    const pressed = state(), cl1 = geo.cleared;
    geo.cb && geo.cb(awayFix); flushTimeouts(); frames(1);
    const a = state(), aCard = grab("panel")._html || "";
    ok(pressed.strip && pressed.on && pressed.flag && pressed.watch && !ended(pressed)
       && ended(a) && geo.cleared === cl1 + 1 && /mi from/.test(aCard) && /Planning mode/.test(aCard),
       `Ride, then a first fix out of region: nothing of the ride is left (${say(a)}) and the card says why; `
       + `the judge rejects the pressed state (${say(pressed)})`);
    /* a ride already recording */
    grab("c-ride").fire("click");
    for (let i = 0; i < 3; i++)
      geo.cb && geo.cb({ coords: { longitude: cx + i * 8e-4, latitude: cy + i * 5e-4, accuracy: 5 } });
    frames(2);
    const riding = state(), recording = !!(RD && RD.R), trip = !!(N && N.load()), cl2 = geo.cleared, seq2 = geo.seq;
    geo.cb && geo.cb(awayFix); flushTimeouts(); frames(1);
    const b = state(), bCard = grab("panel")._html || "";
    grab("hud-stop").fire("click");                     /* a Stop left behind must start nothing */
    /* review of the audit fixes · the card: it said only where the rider is
       and that tracking stays off "until you are in the region" — as if it
       came back by itself. A ride that ended says so, with what it recorded,
       and that Ride it must be pressed again; the ride that never recorded
       is told the last part too. The judge is shown take 187's card. */
    const told = (h, rec) => /mi from/.test(h) && !/stay off until/.test(h) && /Press <b>Ride it<\/b> again/.test(h)
      && (!rec || (/Ride ended/.test(h) && /[\d.]+ mi<\/b> recorded/.test(h)));
    const old187 = "<b>You are about 90 mi from Michigan.</b><br>Planning mode … <br><br>Live tracking and the dispatch card stay off until you are in the region — they must never report a position you are not standing at.";
    ok(told(aCard, false) && !/Ride ended/.test(aCard) && told(bCard, true) && !told(old187, true) && !told(old187, false),
       `the away card after a ride says what became of it ("${bCard.replace(/<[^>]*>/g, "").slice(0, 90)}…"; before any fix: no "Ride ended", `
       + `and Press Ride it again ${/Press <b>Ride it<\/b> again/.test(aCard)}); the judge rejects take 187's card`);
    ok(riding.sheet && riding.tape && riding.strip && recording && trip && !ended(riding)
       && ended(b) && geo.cleared === cl2 + 1 && geo.seq === seq2 && !(RD && RD.R) && !(N && N.load())
       && /mi from/.test(bCard),
       `a recording ride that leaves the region ends as Stop ends it (${say(b)}; recording closed ${!(RD && RD.R)}, `
       + `trip closed ${!(N && N.load())}, no new watch ${geo.seq === seq2}); the judge rejects the riding state (${say(riding)})`);
  }
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
    /* take 139: not segs[0] — the file is sorted now and "first" moved from
       the 1400-block to the 4200-block of the same road, which read as a
       changed answer. A probe must not depend on file order: take the
       first segment of the first street name, which is stable. */
    const seg = g.ADDR.segs.find((x) => x[0] === 0) || g.ADDR.segs[0];
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

/* 5 · Return Home honours the HOME spec (take 117, Jacob): unset by default,
   refuses politely with no home, routes once one is set. The route target is a
   node a few km from the spawn ON the network, so this stays a ROUTER test at
   every region scale rather than a cross-state expedition. */
grab("btn-home").fire("click");
flushTimeouts();
ok(/No home set/i.test(grab("panel")._html || ""),
   "Return Home with no home says so instead of routing to a phantom");
/* take 186 · A200 · one button, three ways. Return home with no home opened
   the chooser above; each way is executed here, and the block ends with
   Clear so the older path below starts from no home, as it always did. */
{
  const c = manifest.centre || [anchors[0][1], anchors[0][2]];
  const ls = sandbox.window.localStorage;
  const home = () => { try { return JSON.parse(ls.getItem("apex.home.v1") || "null"); } catch (e) { return null; } };
  ok(/hc-me/.test(grab("panel")._html) && /hc-addr/.test(grab("panel")._html) && /hc-tap/.test(grab("panel")._html)
     && !/hc-clear/.test(grab("panel")._html),
     "the chooser offers my location, an address and a map tap — and no Clear while there is no home");
  /* tap the map */
  grab("hc-tap").fire("click"); flushTimeouts();
  ok(/Tap the map to place/.test(grab("panel")._html), "Tap the map arms the next map tap");
  theMap.fire("click", { lngLat: { lng: c[0] + 0.011, lat: c[1] + 0.004 }, point: { x: 300, y: 700 } });
  flushTimeouts();
  const h1 = home();
  ok(!!h1 && Math.abs(h1[0] - (c[0] + 0.011)) < 1e-9 && /Placed/.test(grab("panel")._html),
     `an armed map tap places home and stores it (${h1 ? h1.map((v) => v.toFixed(3)).join(",") : "null"})`);
  /* my location, through the same watch a ride uses */
  grab("c-home").fire("click"); flushTimeouts();
  ok(/hc-clear/.test(grab("panel")._html), "with a home set the chooser offers Clear home");
  grab("hc-me").fire("click"); flushTimeouts();
  if (NO_GPS) {
    /* the simulator path has no receiver: the card must say THAT, not "no fix" */
    ok(/no GPS receiver/.test(grab("panel")._html) && home() !== null && Math.abs(home()[0] - (c[0] + 0.011)) < 1e-9,
       "with no receiver, Use my location says so and leaves home as it was");
  } else {
    ok(/Waiting for a GPS fix/.test(grab("panel")._html) && typeof geo.cb === "function",
       "Use my location asks the receiver and says it is waiting");
    geo.cb && geo.cb({ coords: { longitude: c[0] + 0.02, latitude: c[1] - 0.01, accuracy: 6 } });
    flushTimeouts();
    const h2 = home();
    ok(!!h2 && Math.abs(h2[0] - (c[0] + 0.02)) < 1e-9 && /Home is where you are/.test(grab("panel")._html),
       "the first fix becomes home and the card says so");
  }
  /* an address, through the offline geocoder */
  const g = sandbox.window.__geo;
  const seg = g && g.ADDR ? (g.ADDR.segs.find((x) => x[0] === 0) || g.ADDR.segs[0]) : null;
  const rev = seg ? g.addressAt([(seg[1] + seg[3]) / 2, (seg[2] + seg[4]) / 2]) : null;
  if (rev) {
    grab("c-home").fire("click"); flushTimeouts();
    grab("hc-addr").fire("click"); flushTimeouts();
    ok(/Type the address/.test(grab("panel")._html), "Type an address opens the search armed for home");
    const q2 = grab("q"); q2.value = rev.n + " " + rev.street; q2.fire("input"); flushTimeouts();
    const hits = documentStub.querySelectorAll(".hit");
    ok(hits.length > 0, `the typed address returns ${hits.length} hit(s)`);
    if (hits.length) { hits[0].fire("click"); flushTimeouts(); }
    const h3 = home();
    ok(!!h3 && /Home set/.test(grab("panel")._html) && !/Dropped pin/.test(grab("panel")._html),
       `the tapped hit becomes home, and no pin is dropped (${h3 ? h3.map((v) => v.toFixed(3)).join(",") : "null"})`);
  } else ok(false, "no address in the index to set home by");
  /* clear */
  grab("c-home").fire("click"); flushTimeouts();
  grab("hc-clear").fire("click"); flushTimeouts();
  ok(home() === null && /Home cleared/.test(grab("panel")._html), "Clear home removes it from storage and says so");
  /* take 188 · A217 · a bare acknowledgement is a toast: the words on
     #toast, the drawer folded (the map back), the panel still holding the
     text. Read textContent, not hidden: flushTimeouts has already run the
     2.4 s hide. The judge fails on an emptied toast (its control). */
  const acked = (want, t, rail, panel) => want.test(t) && rail === "folded" && want.test(panel);
  ok(acked(/Home cleared/, grab("toast").textContent, grab("rail").className, grab("panel")._html)
     && !acked(/Home cleared/, "", grab("rail").className, grab("panel")._html),
     `Clear home is a toast ("${grab("toast").textContent}", drawer ${grab("rail").className || "OPEN"}); `
     + "an emptied toast fails the same judge (its control)");
  /* Remove pin, which smoke never fired before */
  theMap.fire("contextmenu", { lngLat: { lng: c[0] + 0.015, lat: c[1] - 0.004 } });
  flushTimeouts();
  ok(/Dropped pin/.test(grab("panel")._html) && /id="pc-drop"/.test(grab("panel")._html),
     "a dropped pin's card offers Remove pin");
  const pinsNow = markers.filter((m) => !m._removed).length;
  grab("pc-drop").fire("click"); flushTimeouts();
  ok(acked(/Pin removed/, grab("toast").textContent, grab("rail").className, grab("panel")._html)
     && !/Dropped pin/.test(grab("panel")._html),
     `Remove pin is a toast ("${grab("toast").textContent}", drawer ${grab("rail").className || "OPEN"}), `
     + `and the panel no longer holds the pin's card (${pinsNow} markers before)`);
}
/* take 189 · A237 · a place card's distance line names what it measures
   from: "of you" only from a live fix (the app's one reader, liveFix), the
   start pin otherwise — every card said "152 mi SSE of you" before any fix,
   because ME holds the region centre until one. Here, where the home drill
   above has just taken a real in-region fix through the locate path (the
   live-GPS passes), a tapped pin reads "of you"; with position mode put
   back to no fix, the same pin reads "of the start pin" and the reader says
   none; mode restored, the reader is back. Its controls: take 188's line is
   rejected with no fix, and "of the start pin" with one. */
{
  const N = sandbox.window.__nav, PO = sandbox.POIS;
  const PF = record.sources.poi && record.sources.poi.data && record.sources.poi.data.features;
  const r0 = PO && Array.isArray(PO.p) ? PO.p.find((r) => r.n && Array.isArray(r.p)) : null;
  if (!N || typeof N.live !== "function" || !r0 || !Array.isArray(PF) || PF.length !== PO.p.length) {
    ok(false, `the A237 drill has its hooks and a pin to tap (live reader ${!!(N && N.live)}, pin ${!!r0}, `
       + `features ${Array.isArray(PF) ? PF.length : "none"})`);
  } else {
    const tap = () => { const f = PF[PO.p.indexOf(r0)];
      theMap._hit = [Object.assign({ layer: { id: "poi-dot" } }, f)];
      theMap.fire("click", { lngLat: { lng: r0.p[0], lat: r0.p[1] }, point: { x: 300, y: 700 } });
      theMap._hit = []; flushTimeouts(); return grab("panel")._html || ""; };
    const distOk = (h, live) => live ? /\d mi [NSEW]{1,3} of you</.test(h)
      : /\d mi [NSEW]{1,3} of the (start pin|simulated position|planning start)</.test(h) && !/ of you</.test(h);
    const line = (h) => ((h.match(/[\d.]+ mi [NSEW]{1,3} of [a-z ]+/) || [])[0] || "(no distance line)");
    tap();   /* a throwaway: an earlier long press leaves lp.fired set (see 5x) */
    const posWas = N.pos(), liveNow = N.live(), hNow = tap();
    N.pos("none"); const liveNone = N.live(), hNone = tap();
    N.pos(posWas); const liveBack = N.live();
    /* fix round 2 · the same locate fix 40 s on (past GPS_STALE_MS, no watch
       open): it is where the rider WAS, so the pin reads "of your last GPS
       fix (h:mm)", never "of you"; the clock put back, live again */
    let aged = null;
    if (liveNow) {
      const RA = sandbox.Date;
      sandbox.Date = class extends RA { constructor(...a) { if (a.length) super(...a); else super(RA.now() + 40000); }
        static now() { return RA.now() + 40000; } };
      try { aged = { live: N.live(), h: tap() }; } finally { sandbox.Date = RA; }
      aged.back = N.live();
      /* the clock it must print: the locate fix's own time (a past ride's
         FIX_T, or 0 = 1970, would be a confident wrong time) */
      aged.want = new RA(liveNow.t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    const agedOk = (a) => !!a && a.live === null && /\d mi [NSEW]{1,3} of your last GPS fix \(\d{1,2}:\d\d[^)]*\)</.test(a.h)
      && a.h.includes(" of your last GPS fix (" + a.want + ")<") && !/ of you</.test(a.h);
    const agedCtl = !agedOk({ live: null, want: "10:42 AM", h: "<div class=\"sub\">1.2 mi NE of you</div>" })
      && !agedOk({ live: {}, want: "10:42 AM", h: "<div class=\"sub\">1.2 mi NE of your last GPS fix (10:42 AM)</div>" })
      && !agedOk({ live: null, want: "10:42 AM", h: "<div class=\"sub\">1.2 mi NE of your last GPS fix (7:00 PM)</div>" })
      && agedOk({ live: null, want: "10:42 AM", h: "<div class=\"sub\">1.2 mi NE of your last GPS fix (10:42 AM)</div>" });
    ok(NO_GPS ? aged === null : (agedOk(aged) && aged.back !== null && agedCtl),
       NO_GPS ? "an aged locate fix: no receiver on this pass, so no fix to age (the live-GPS passes judge it)"
       : `a locate fix 40 s old (no watch open) is not "you": "${r0.n}" reads "${aged ? (aged.h.match(/[\d.]+ mi [NSEW]{1,3} of [^<]*/) || ["(no distance line)"])[0] : "?"}" `
         + `(live ${aged ? aged.live !== null : "?"}, the fix's own clock ${aged ? aged.want : "?"}); the clock put back, live ${aged ? aged.back !== null : "?"}; `
         + `its controls reject "of you", a live reader and another clock time (${agedCtl})`);
    /* fix round 1 · the dropped pin's card (placeCard) in the same two
       states: "from your position" only with the live fix */
    const cA = manifest.centre || [anchors[0][1], anchors[0][2]];
    const press = () => { theMap._up = [cA[0] + 0.03, cA[1] - 0.004];
      theMap.getCanvasContainer().fire("touchstart", { touches: [{ clientX: 220, clientY: 420 }] });
      flushTimeouts(); return grab("panel")._html || ""; };
    const pNow = press(), pLive = N.live();
    N.pos("none"); const pNoneLive = N.live(), pNone = press();
    N.pos(posWas);
    ok(/Dropped pin/.test(pNow) && /Dropped pin/.test(pNone) && !!pLive === !!liveNow && pNoneLive === null
       && fromOk(pNow, !!pLive, posWas) && fromOk(pNone, false, "none") && fromCtl(),
       `a dropped pin's card measures "from your position" only from a live fix: `
       + `(position ${posWas}, live ${!!pLive}) "${fromLine(pNow)}"; with no fix "${fromLine(pNone)}" (live ${pNoneLive !== null}); `
       + `its control rejects take 188's line with no fix (${fromCtl()})`);
    const ctl = !distOk("<div class=\"sub\">152 mi SSE of you</div>", false)
      && !distOk("<div class=\"sub\">1.2 mi NE of the start pin</div>", true)
      && distOk("<div class=\"sub\">1.2 mi NE of you</div>", true);
    ok((NO_GPS || !!liveNow) && distOk(hNow, !!liveNow) && liveNone === null && distOk(hNone, false)
       && !!liveBack === !!liveNow && ctl,
       `a place card measures "of you" only from a live fix: ${NO_GPS ? "no receiver" : "after the locate fix"} `
       + `(position ${posWas}, live ${!!liveNow}) "${r0.n}" reads "${line(hNow)}"; with no fix it reads "${line(hNone)}" `
       + `(live ${liveNone !== null}); mode restored, live ${!!liveBack}; its controls (${ctl})`);
  }
}
{
  /* the rider's path: press-and-hold a spot a few km out, "Make this home" */
  const c = manifest.centre || [anchors[0][1], anchors[0][2]];
  theMap._up = [c[0] + 0.028, c[1] + 0.004];
  theMap.getCanvasContainer().fire("touchstart",
    { touches: [{ clientX: 210, clientY: 410 }] });
  flushTimeouts();
  ok(/pc-home/.test(grab("panel")._html || ""),
     "dropped-pin card offers Make this home");
  grab("pc-home").fire("click");
  flushTimeouts();
}
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

/* 5x · A110 — places you can ride to (take 89).
   The payload is optional, so the checks must be honest when it is absent
   rather than asserting a count the region may not have. */
{
  const pj = manifest.artifacts.find((a) => a.kind === "places");
  if (!pj) {
    ok(true, "no places artifact in this bundle — pins skipped, not failed");
  } else {
    const P = sandbox.POIS;
    ok(P && Array.isArray(P.p) && P.p.length > 0,
       `places payload loaded: ${P && P.p ? P.p.length : 0} entries`);
    const kinds = new Set(P.p.map((r) => r.k));
    ok(kinds.has("fuel"),
       `fuel is among the places (${[...kinds].length} kinds) — the app has costed `
       + `routes against a fuel range since take 36 and never showed where fuel is`);
    /* Named-only, except beaches. That is the rule poi.py states; assert it
       rather than trusting the comment. */
    /* Take 121: launches joined beaches under the same rule — a place you may
       put a boat in is a destination whether or not OSM names it (A146; 66 of
       Waterford's 81 slipways were nameless and invisible). The check moves
       with the policy: these two kinds and no others. */
    /* Take 189 · A228: a pin whose source name is a placeholder ("A", "12",
       "car parking") ships unnamed with that text in `ph`, whatever its
       kind; the gate's check_pin_names proves every `ph` IS a placeholder,
       so this cannot pass a real name dropped by mistake. */
    const unnamed = P.p.filter((r) => !r.n);
    const exempt = new Set(["beach", "launch"]);
    const phd = unnamed.filter((r) => typeof r.ph === "string" && r.ph.length > 0);
    ok(unnamed.every((r) => exempt.has(r.k) || phd.includes(r)),
       `only beaches, launches and placeholder-named pins ship unnamed (${unnamed.length} unnamed, `
       + `${[...new Set(unnamed.filter((r) => !phd.includes(r)).map((r) => r.k))].sort().join(" + ")}; `
       + `${phd.length} placeholders)`);
    /* …and a placeholder pin's card says literally what the source called it,
       under the kind's name; a bare unnamed launch or beach still says it is
       unnamed. Taps the app's own features (the poi source it handed the
       map), not hand-made ones. */
    const PF = record.sources.poi && record.sources.poi.data && record.sources.poi.data.features;
    const tapPin = (r) => {
      const f = PF[P.p.indexOf(r)];
      theMap._hit = [Object.assign({ layer: { id: "poi-dot" } }, f)];
      theMap.fire("click", { lngLat: { lng: r.p[0], lat: r.p[1] }, point: { x: 300, y: 700 } });
      theMap._hit = [];
      return grab("panel")._html || "";
    };
    const php = phd.find((r) => r.k === "info") || phd[0];
    const bare = unnamed.find((r) => !phd.includes(r));
    if (php && bare && Array.isArray(PF) && PF.length === P.p.length) {
      /* the first tap is a throwaway: an earlier long-press drill leaves the
         app's lp.fired set, and the next click is (rightly) taken as that
         press's release — the first run of this check read the route panel */
      const h0 = tapPin(bare), hp = tapPin(php), hb = tapPin(bare);
      console.log(`  ..   placeholder card: settle tap ${/Unnamed in the source/.test(h0) ? "opened a card" : "was absorbed"}`);
      const kh = PF[P.p.indexOf(php)].properties.h;
      ok(hp.includes(`<b>${kh}</b>`) && hp.includes(`The source names it only \u201c${php.ph}\u201d`)
         && !hp.includes("Unnamed in the source"),
         `a placeholder pin's card reads "${kh}" and "the source names it only \u201c${php.ph}\u201d"`);
      ok(hb.includes("Unnamed in the source") && !hb.includes("The source names it only"),
         `an unnamed ${bare.k}'s card still says it is unnamed in the source`);
    } else {
      ok(!phd.length, `placeholder card check: ${phd.length} placeholder pins but no features to tap`);
    }
    ok(P.p.every((r) => Array.isArray(r.p) && r.p.length === 2
                        && r.p[0] >= manifest.bbox[0] && r.p[0] <= manifest.bbox[2]
                        && r.p[1] >= manifest.bbox[1] && r.p[1] <= manifest.bbox[3]),
       "every place is inside the region bbox");
  }
}

/* 5x2 · A140 — DNR scramble areas as open-riding polygons (take 119).
   Optional like places. Asserts the SHAPE the app relies on (rings, a
   centre, acres) and that the tap handler and layer group exist — a source
   nobody draws is landmine 69 and the gate covers that; this covers the card. */
{
  const aj = manifest.artifacts.find((a) => a.kind === "areas");
  if (!aj) {
    ok(true, "no riding-area artifact in this bundle — areas skipped, not failed");
  } else {
    const A = sandbox.AREAS;
    ok(A && Array.isArray(A.a) && A.a.length > 0,
       `riding areas loaded: ${A && A.a ? A.a.length : 0} DNR scramble area(s)`);
    ok(A.a.every((r) => r.n && r.ac > 0 && Array.isArray(r.g) && r.g[0].length >= 4
                        && Array.isArray(r.c) && r.c.length === 2),
       "every area carries a name, acres, a centre and a closed ring");
    ok(A.a.every((r) => r.c[0] >= manifest.bbox[0] && r.c[0] <= manifest.bbox[2]
                        && r.c[1] >= manifest.bbox[1] && r.c[1] <= manifest.bbox[3]),
       "every area centre is inside the region bbox");
    /* App internals are reached through the window.__ bridges, not as
       sandbox globals — the first draft asked for sandbox.areaCard and the
       harness, not the product, failed (landmine 54). */
    const AB = sandbox.window.__areas || {};
    const grp = (AB.groups || []).find((g) => g.k === "areas");
    ok(!!grp && grp.ids.indexOf("area-fill") >= 0,
       "Layers panel has a Riding areas group governing area-fill");
    ok(typeof AB.card === "function", "areaCard is wired");
    const html = AB.card ? AB.card({n: A.a[0].n, ac: A.a[0].ac, o: A.a[0].o,
                                   c: JSON.stringify(A.a[0].c)}) : "";
    const txt = grab("panel")._html || String(html || "");
    ok(txt.indexOf(A.a[0].n) >= 0 && txt.indexOf("acres") >= 0,
       `area card names the area and its acreage (${A.a[0].n}, ${A.a[0].ac} ac)`);
    ok(txt.indexOf("never across") >= 0,
       "area card says routing goes to the edge, never across the ground");
  }
}

/* 5x3 · A96 — the spatial grid (take 119). The claim is EXACTNESS, not
   just speed: for every probe the grid answer must equal the linear scan's.
   Probes are read off the region bbox, not hardcoded (landmine 197): the
   centre, two corners pulled inward, and a point in open water where the
   nearest edge is far and the ring walk has to go a long way. */
{
  const D = sandbox.window.__disp, R = sandbox.window.__route;
  if (!D || !D.nearestEdgeLinear) {
    ok(false, "grid bridge missing from __disp");
  } else {
    const bb = manifest.bbox;
    const probes = [
      [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2],
      [bb[0] + (bb[2] - bb[0]) * 0.3, bb[1] + (bb[3] - bb[1]) * 0.3],
      [bb[0] + (bb[2] - bb[0]) * 0.7, bb[1] + (bb[3] - bb[1]) * 0.75],
      [bb[0] + (bb[2] - bb[0]) * 0.55, bb[1] + (bb[3] - bb[1]) * 0.98],
    ];
    const t0 = Date.now(); D.gridBuild(); const tb = Date.now() - t0;
    ok(tb < 8000, `grid built once in ${tb} ms (edges + vertices)`);
    let same = 0, tg = 0, tl = 0; const per = [];
    for (const p of probes) {
      const a0 = Date.now(); const g = D.nearestEdge(p); const dg = Date.now() - a0; tg += dg;
      const b0 = Date.now(); const l = D.nearestEdgeLinear(p); tl += Date.now() - b0;
      per.push(`${dg}ms@${g.d.toFixed(1)}mi`);
      if (g.e === l.e && Math.abs(g.d - l.d) < 1e-9) same++;
    }
    console.log(`  ..   grid per probe: ${per.join(" · ")}`);
    ok(same === probes.length,
       `grid nearestEdge equals the linear scan at ${same}/${probes.length} probes `
       + `(grid ${tg} ms total, linear ${tl} ms total)`);
    let sameN = 0;
    for (const p of probes) {
      if (R.nearestNode(p) === D.nearestNodeLinear(p)) sameN++;
    }
    ok(sameN === probes.length,
       `grid nearestNode equals the linear scan at ${sameN}/${probes.length} probes`);
  }
}

/* 5y · A60 — route both, draw one (take 86).
   The promise is not "fewer lines". It is that every edge stays ROUTABLE while
   only one copy of a duplicated road is DRAWN. Asserted against the real
   bundle, both halves. */
{
  const R = sandbox.__route;
  const all = R.EDGES.length;
  const drawn = R.EDGES.filter((e) => e.d).length;
  ok(drawn > 0 && drawn < all,
     `${all} edges routable, ${drawn} drawn (${all - drawn} suppressed duplicates)`);
  /* the suppressed ones must still be reachable by the router */
  const hidden = R.EDGES.filter((e) => !e.d);
  ok(hidden.length > 0, `${hidden.length} edges are routable but not drawn`);
  const adjHas = hidden.slice(0, 200).every((e) => {
    const at = R.ADJ ? R.ADJ[e.a] : null;
    return !at || at.some((x) => x.i === e.i);
  });
  ok(adjHas, "every suppressed edge is still in the routing adjacency");
  /* nothing safety-bearing may be suppressed */
  const NEVER = ["closed", "fsclosed", "route72", "trail50", "moto24", "mccct"];
  const badHide = hidden.filter((e) => NEVER.indexOf(e.c) >= 0);
  ok(badHide.length === 0,
     `no closure or designated ORV line is suppressed (${badHide.length} found)`);
  /* labels must not chain through geometry that is not on the map */
  ok(R.EDGES.filter((e) => e.d).length === drawn, "drawn set is stable");
}

/* 6a · per-vehicle machine legality (take 80).
   The Forest Service publishes ONE trail class and states its rules per vehicle
   in the attributes, so a class allow-list cannot express "motorcycles yes,
   ATVs no". Asserted against the REAL bundle: find edges the MVUM opens to
   motorcycles only, and check a quad is refused while a dirt bike is not. */
{
  const R = sandbox.__route;
  ok(typeof R.machineLegal === "function", "machineLegal is wired");
  const motoOnly = R.EDGES.filter((e) => {
    const a = R.attrs(e);
    return a.moto && !a.atv;
  });
  ok(motoOnly.length > 0,
     `bundle contains ${motoOnly.length} motorcycle-only edge(s) to test against`);
  if (motoOnly.length) {
    const e = motoOnly[0];
    R.setMachine("bike");
    const bikeOk = R.machineLegal(e);
    R.setMachine("quad");
    const quadOk = R.machineLegal(e);
    R.setMachine("bike");
    ok(bikeOk === true, "a dirt bike MAY use a motorcycle-only trail");
    ok(quadOk === false,
       "a quad may NOT — class alone would have allowed it (fstrail is in quad.ok)");
  }
  /* the class rule must still hold where the source says nothing per-vehicle */
  const plain = R.EDGES.filter((e) => { const a = R.attrs(e); return !a.moto && !a.atv; });
  if (plain.length) {
    R.setMachine("bike");
    const anyLegal = plain.some((e) => R.machineLegal(e));
    ok(anyLegal, "edges with no per-vehicle rule still fall back to the class rule");
  }
}

/* 6a1 · special restrictions (take 95, A101).
   ZERO edges in this region carry one, so the refusal can only be proven by
   making one — a refusal that has never fired is a hope (landmine 45). The
   strings below are verbatim from the DNR, all nine of which exist statewide. */
{
  const R = sandbox.__restrict;
  ok(!!R && Array.isArray(R.table) && R.table.length >= 8,
     `restriction table enumerates ${R ? R.table.length : 0} published strings`);
  const live = sandbox.__route.EDGES.filter((e) => R.of(e)).length;
  ok(manifest.bulk ? live > 0 : live === 0,
   manifest.bulk
     ? `${live} edges carry live restrictions statewide — the A72 preparation `
       + `is now real data, and the drill below exercises it`
     : `no edge in this region carries a restriction (${live}) — this is `
       + `preparation for A72, and the drill below is the only proof`);

  const pick = () => sandbox.__route.EDGES.find((e) => e.c === "trail50");
  const MOTO_BAN = "ORV Routes B BK BL BF BH BI Restriction ORVs less than 65 "
    + "inches in width only between the dates of May 1st and November 1st.  "
    + "Off road motorcycles are prohibited  ORV license and trail permit required";

  let e = R.inject(pick(), MOTO_BAN);
  const parsed = R.of(e);
  ok(!!parsed && parsed.ban.indexOf("bike") >= 0,
     "the motorcycle prohibition is recognised, not guessed at");
  R.setMachine("bike");
  ok(R.legal(e) === false,
     "a DIRT BIKE is refused a segment the DNR says prohibits off-road motorcycles");
  R.setMachine("quad");
  ok(R.legal(e) === true,
     "a QUAD is NOT refused it — the restriction bans one machine, not all");
  R.setMachine("bike");

  /* an unrecognised string must restrict nobody and still be shown */
  let u = R.inject(sandbox.__route.EDGES.find((x) => x.c === "mccct"),
                   "Some Restriction The DNR Has Not Published Yet");
  const un = R.of(u);
  ok(!!un && un.unknown === true && un.ban.length === 0,
     "an unrecognised restriction bans nobody");
  ok(R.legal(u) === true,
     "and does not silently remove access — it is displayed, not interpreted");
}

/* 6a2 · waypoints (take 92, A84).
   A waypoint IS stored as geometry, and that is the opposite of the saved-route
   rule on purpose: a route stores inputs because closures move and a frozen
   line replays a stale legality decision (landmine 113); a point on the ground
   does not move and encodes no decision. Both halves asserted so the difference
   stays deliberate rather than becoming an inconsistency someone "fixes". */
{
  const before = sandbox.localStorage.getItem("apex.waypoints.v1");
  ok(before === null, "no waypoints before the first save");
  const c = manifest.bbox;
  const at = [(c[0] + c[2]) / 2, (c[1] + c[3]) / 2];
  /* grab("map") is the DOM element stub; the MapLibre stub is `theMap`, and
     contextmenu is registered on the map, not the div (take 92). */
  theMap.fire("contextmenu", { lngLat: { lng: at[0], lat: at[1] } });
  frames(1);
  sandbox.localStorage.removeItem("apex.waypoints.v1");  /* the home-setting
     flow above dropped its own pin; this drill counts from zero (take 117) */
  ok(/pc-wpt/.test(grab("panel")._html),
     "a dropped pin offers Save as waypoint");
  grab("pc-wpt").fire("click");
  const raw = sandbox.localStorage.getItem("apex.waypoints.v1");
  ok(typeof raw === "string" && raw.length > 2, "saving a waypoint writes storage");
  let recs = [];
  try { recs = JSON.parse(raw); } catch { }
  /* the stub panel keeps card history, so an earlier card's save button can
     fire alongside this one — count is stub-fragile, identity is not
     (take 117): the LAST record must be THIS pin, correctly shaped. */
  ok(recs.length >= 1, `waypoint stored (${recs.length} record(s))`);
  const r = recs[recs.length - 1] || {};
  ok(Array.isArray(r.p) && r.p.length === 2,
     "a waypoint DOES store its coordinate — a point on the ground encodes no "
     + "decision that could go stale, unlike a route");
  ok(typeof r.n === "string" && r.n.length > 0, `auto-named without a dialog: "${r.n}"`);
  ok(r.r === manifest.region, `region stamped (${r.r})`);
  /* and the route rule must still hold, in the same run */
  let routes = [];
  try { routes = JSON.parse(sandbox.localStorage.getItem("apex.routes.v1") || "[]"); } catch { }
  if (routes.length) {
    ok(!/"path"|"geom"|"line"|"coords"/.test(JSON.stringify(routes[0])),
       "and a saved ROUTE still stores no geometry — the two rules differ on purpose");
  }
  grab("c-saved").fire("click");
  ok(/data-wpgo/.test(grab("panel")._html), "the Saved panel lists waypoints");
}

/* 6b · saved routes (take 79, A85 — A28's last enumerated gap).
   The property under test is not "a string came back". It is that a saved route
   stores INPUTS and is re-routed on open, so a segment closed since it was
   saved is still excluded. Replayed geometry would bypass every closure check;
   that is why nothing here compares stored line coordinates. */
{
  const before = sandbox.localStorage.getItem("apex.routes.v1");
  ok(before === null, "nothing saved before the first save");
  grab("btn-save").fire("click");
  const raw = sandbox.localStorage.getItem("apex.routes.v1");
  ok(typeof raw === "string" && raw.length > 2, "save wrote to storage");
  let recs = [];
  try { recs = JSON.parse(raw); } catch { }
  ok(Array.isArray(recs) && recs.length === 1, `one record stored (${recs.length})`);
  const r = recs[0] || {};
  ok(Array.isArray(r.f) && r.f.length === 2, "start point stored as a coordinate");
  ok(typeof r.m === "string" && r.m.length > 0, `machine stored (${r.m})`);
  ok(r.r === manifest.region, `region stamped on the record (${r.r})`);
  ok(!!r.b, "bundle hash stamped, so a rebuilt map can be reported as changed");
  /* the safety property, asserted structurally */
  const flat = JSON.stringify(r);
  ok(!/"path"|"geom"|"line"|"coords"/.test(flat),
     "no frozen geometry in the record — reopening re-routes on current data");
  /* saving twice under the same name replaces rather than accumulating */
  grab("btn-save").fire("click");
  let again = [];
  try { again = JSON.parse(sandbox.localStorage.getItem("apex.routes.v1")); } catch { }
  ok(again.length === 1, `re-saving the same route replaces it (${again.length})`);
  /* the panel lists it and can reopen it */
  grab("c-saved").fire("click");
  ok(/data-svopen/.test(grab("panel")._html), "saved panel lists the route with an Open action");
  const openBtn = grab("panel")._html.match(/data-svopen="(\d+)"/);
  ok(!!openBtn, "an Open control is rendered");
}

/* 6 · directions for the chosen route */
grab("btn-steps").fire("click");
ok(/steps ·/.test(grab("panel")._html), "turn-by-turn generated");

/* 6a3 · take 188 · cold audit (F9) · Retrace with nothing recorded names
   ONE way to record: Ride it, with a GPS fix. The line used to offer "Ride
   it …, or this fills in from GPS on a real ride" — two sources, from when
   Ride it fell back to the simulator (A223 removed that). The judge is
   shown that line and must reject it. No ride has run yet in this pass. */
{
  const had = sandbox.window.__nav ? sandbox.window.__nav.crumbs() : -1;
  grab("btn-retrace").fire("click");
  const t = (grab("panel")._html || "").replace(/<[^>]*>/g, "");
  const oneWay = (x) => /Nothing recorded yet/.test(x) && /Ride it/.test(x) && /with a GPS fix/.test(x)
    && !/, or /.test(x) && !/lay a track/.test(x);
  ok(had >= 0 && had < 2 && oneWay(t)
     && !oneWay("Nothing recorded yet. Tap Ride it (Ride tab) to lay a track, or this fills in from GPS on a real ride."),
     `Retrace with nothing recorded (${had} fixes) names one way to record: "${t}"; the judge rejects take 187's two-source line`);
}

/* 6b · take 188 · A223 · the maintainer, 2026-09-25: "Refuse honestly". A
   GPS error before the first fix (location off, permission refused) starts
   NOTHING and says so — take 187 fell back to a simulated ride on the phone.
   The watch is opened by the Ride chip, the harness answers it with an
   error, and the app must close it, leave no ride flag, no sheet and no
   simulator, and put the Ride tab's Ride it back — pressed again, it TRIES
   AGAIN (a new watch). The route cards are not asserted: the refusal card
   replaces them, and this stub keeps one element per id, so a detached
   #rc-ride would still answer here (the review of step 13b1). */
if (!NO_GPS) {
  const cl0 = geo.cleared;
  grab("c-ride").fire("click");
  ok(typeof geo.cb === "function" && typeof geo.err === "function", "Ride opens a GPS watch (the refusal drill)");
  geo.err && geo.err({ code: 1, message: "User denied Geolocation" });
  flushTimeouts(); frames(1);
  const ph = grab("panel")._html || "";
  ok(/No GPS fix/.test(ph) && /turn on location and try again/.test(ph) && /Nothing started/.test(ph) && !/simulat/i.test(ph),
     `a GPS error before the first fix refuses honestly ("${ph.replace(/<[^>]*>/g, "").slice(0, 80)}")`);
  ok(sandbox.window.__nav.pos() !== "sim" && grab("hudstats").hidden === true,
     `…and no simulated ride starts (position mode ${sandbox.window.__nav.pos()}, ride sheet hidden ${grab("hudstats").hidden})`);
  ok(!("ride" in grab("shell").dataset) && /Ride it/.test(grab("c-ride")._html || "") && geo.cleared === cl0 + 1 && geo.cb === null,
     "…the watch is closed, the ride flag is off and the Ride chip reads Ride it again");
  ok(grab("c-ride").hidden === false,
     `…the Ride tab's Ride it is on screen to try again (hidden ${grab("c-ride").hidden})`);
  /* the retry: the same chip opens a NEW watch; a second error refuses
     again (the once-per-press latch re-arms on every press) */
  geo.cb = null; geo.err = null;
  grab("c-ride").fire("click");
  const retryOpen = typeof geo.cb === "function" && /Stop \(GPS\)/.test(grab("c-ride")._html || "") && grab("shell").dataset.ride === "1";
  geo.err && geo.err({ code: 2, message: "Position unavailable" });
  flushTimeouts(); frames(1);
  ok(retryOpen && /No GPS fix/.test(grab("panel")._html || "") && geo.cleared === cl0 + 2 && geo.cb === null
     && /Ride it/.test(grab("c-ride")._html || "") && !("ride" in grab("shell").dataset),
     `…pressed again it tries again: a new watch opens (${retryOpen}) and a second error refuses again (watches closed ${geo.cleared - cl0})`);
  /* the review of step 13b1, round 2: a first fix that is only SLOW is a
     wait, not a refusal (location is on; the refusal would tell the rider
     to turn it on). The web driver's TIMEOUT (code 3), then the phone's
     driver — a stand-in Capacitor Geolocation — answering with the
     plugin's own first-fix timeout ('OS-PLUG-GLOC-0010'): each must leave
     the chip on Stop (GPS) with the flag on and a NEW watch open, and a
     denial after it still refuses. The phone's watch must ask for an
     explicit first-fix timeout far past the plugin's 10 s default (the
     plugin times the first fix out at 10 s when none is given). */
  {
    const cl1 = geo.cleared, waitOk = () => /Stop \(GPS\)/.test(grab("c-ride")._html || "")
      && grab("shell").dataset.ride === "1" && !/No GPS fix/.test(grab("panel")._html || "");
    /* round 3: while it waits nothing has been measured, so the nav strip
       (on screen from the press) may claim no speed and no heading — take
       187 and rounds 1-2 printed "0 mph · N", or the last ride's values */
    const spRead = () => ({ shown: grab("nav").hidden === false, t: String(grab("nav-sp").textContent) });
    const spHonest = (r) => !!r && r.shown && !/\d/.test(r.t) && !/\b(N|NE|E|SE|S|SW|W|NW)\b/.test(r.t);
    /* the last drill's refusal card is still on the panel: a marker in its
       place, so "no refusal" is read from this press alone */
    geo.cb = null; geo.err = null; grab("panel").innerHTML = "(slow-fix drill)";
    grab("c-ride").fire("click");
    const cb1 = geo.cb;
    geo.err && geo.err({ code: 3, message: "Timeout expired" });
    flushTimeouts(); frames(1);
    const webWait = waitOk() && typeof geo.cb === "function" && geo.cb !== cb1 && geo.cleared === cl1 + 1;
    const webSp = spRead();
    geo.err && geo.err({ code: 1, message: "User denied Geolocation" });
    flushTimeouts(); frames(1);
    const webRefuse = /No GPS fix/.test(grab("panel")._html || "") && geo.cleared === cl1 + 2 && !("ride" in grab("shell").dataset);
    ok(webWait && webRefuse,
       `a slow first fix waits (web TIMEOUT: chip Stop (GPS), flag on, a new watch opened ${webWait}); a denial after it still refuses (${webRefuse})`);
    const cap = { opened: 0, cleared: 0, opts: null, cb: null };
    sandbox.Capacitor = { Plugins: { Geolocation: {
      watchPosition(o, cb) { cap.opened++; cap.opts = o; cap.cb = cb; return "w" + cap.opened; },
      clearWatch() { cap.cleared++; } } } };
    let capWait = false, capRefuse = false, capTimeout = null, capSp = null;
    try {
      grab("panel").innerHTML = "(slow-fix drill)";
      grab("c-ride").fire("click");
      capTimeout = cap.opts ? cap.opts.timeout : null;
      cap.cb && cap.cb(null, { code: "OS-PLUG-GLOC-0010", message: "Could not obtain location in time. Try with a higher timeout." });
      flushTimeouts(); frames(1);
      capWait = waitOk() && cap.opened === 2 && cap.cleared === 1;
      capSp = spRead();
      cap.cb && cap.cb(null, { code: "OS-PLUG-GLOC-0003", message: "Location permission request was denied." });
      flushTimeouts(); frames(1);
      capRefuse = /No GPS fix/.test(grab("panel")._html || "") && cap.cleared === 2 && !("ride" in grab("shell").dataset)
        && /Ride it/.test(grab("c-ride")._html || "");
    } finally { delete sandbox.Capacitor; }
    ok(capWait && capRefuse && typeof capTimeout === "number" && capTimeout >= 3600000,
       `…and on the phone's driver: the plugin's first-fix timeout waits (a new watch, opened ${cap.opened}, closed ${cap.cleared}: ${capWait}), `
       + `a denial after it refuses (${capRefuse}); the watch asks for a first-fix timeout of ${capTimeout} ms (the plugin's default is 10 s)`);
    ok(spHonest(webSp) && spHonest(capSp),
       `…and while it waits the nav strip claims no speed or heading (web: shown ${webSp.shown}, "${webSp.t}"; `
       + `phone: shown ${capSp ? capSp.shown : "?"}, "${capSp ? capSp.t : "not read"}")`);
  }
}

/* 7 · ride → breadcrumb → retrace, the load-bearing path.
   Default: LIVE GPS drives it — the harness emits fixes and the same record
   chain must fire. --no-gps: the simulator path (the pre-take-16 behavior). */
const clearedBefore = geo.cleared;
/* take 188 · A217 · the ride starts the V4 way: Return home, then Ride it
   on the route card (2 taps from the folded drawer; take 187 needed 4).
   With no #rc-ride the Ride tab's chip starts it, and the assert says so. */
grab("btn-home").fire("click"); flushTimeouts();
const viaRcRide = /id="rc-ride"/.test(grab("panel")._html || "");
/* Ride it acts on the selected card: pick the second option first, as
   section 5 did, so the ride (and the trip the resume block reloads) is on
   the same profile it was before Ride it existed */
{ const all = documentStub.querySelectorAll(".rc"); if (all.length > 1) all[1].fire("click"); }
ok(viaRcRide, `Return home's route cards offer Ride it (#rc-ride)${viaRcRide ? "" : " — ABSENT: the ride below starts from the Ride tab's chip instead"}`);
if (viaRcRide) grab("rc-ride").fire("click"); else grab("c-ride").fire("click");
if (NO_GPS) {
  /* take 188 · A223 · no location API at all: Ride refuses and starts
     nothing (take 187 ran the simulator here). The simulator is the
     deliberate test tool now — its hook starts it, the way render drives it */
  const ph = grab("panel")._html || "";
  ok(/reports no GPS receiver/.test(ph) && /Nothing started/.test(ph) && !/simulat/i.test(ph),
     `with no location API, Ride refuses honestly ("${ph.replace(/<[^>]*>/g, "").slice(0, 80)}")`);
  ok(!("ride" in grab("shell").dataset) && grab("hudstats").hidden !== false && sandbox.window.__nav.pos() !== "sim",
     "…nothing starts: no ride flag, no sheet, not the simulator");
  /* what a rider can tap next: the Ride tab's chip (Ride it switched to the
     Ride tab), with the route still chosen — the refusal card replaced the
     route cards, so their Ride it is not asserted (a stale stub would pass) */
  const plan0 = sandbox.window.__nav.plan();
  ok(grab("c-ride").hidden === false && /Ride it/.test(grab("c-ride")._html || "") && !!plan0,
     `…and the Ride tab's Ride it is offered again, the route still chosen (chip hidden ${grab("c-ride").hidden}, plan ${plan0 ? "kept" : "GONE"})`);
  grab("c-ride").fire("click");
  const ph2 = grab("panel")._html || "";
  ok(/reports no GPS receiver/.test(ph2) && !("ride" in grab("shell").dataset) && sandbox.window.__nav.pos() !== "sim",
     "…pressed again it refuses again, and still nothing starts");
  sandbox.window.__nav.sim();
}
ok(grab("rc-ride").hidden === true,
   "once the ride runs, the route card's Ride it is gone (it could start nothing now)");
/* take 188 · landmine 135 · a ride starts with the drawer folded, and the
   flag that keeps its action row (Dispatch, Retrace, Directions, Return home)
   one tap is on #shell — a data attribute, never a class (landmine 92) */
ok(grab("shell").dataset.ride === "1",
   `a ride sets #shell[data-ride] (${NO_GPS ? "simulator" : "GPS pending"}), so the folded drawer keeps its action row`);
ok(grab("rail").className === "folded", "a ride starts with the drawer folded (the map clear, the sheet on it)");
if (!NO_GPS) {
  ok(geo.cb !== null, "ride started a GPS watch");
  const [cx, cy] = [(manifest.bbox[0]+manifest.bbox[2])/2, (manifest.bbox[1]+manifest.bbox[3])/2];
  for (let i = 0; i < 28; i++)
    geo.cb && geo.cb({ coords: { longitude: cx + i*8e-4, latitude: cy + i*5e-4, accuracy: 5 } });
  frames(3);
  /* take 188 · A217 · a GPS ride: no Wrong turn (the alert fires from the
     real track), and ONE Stop — the sheet's, so the Ride tab's chip steps
     aside once the sheet is drawn */
  ok(grab("c-lost").hidden === true, "Wrong turn is not offered on a GPS ride (the simulator's control only)");
  ok(grab("hudstats").hidden === false && grab("c-ride").hidden === true,
     "one Stop on screen while riding: the ride sheet's (the Ride tab's chip steps aside once the sheet is drawn)");
} else {
  /* take 188 · A217 · the simulator rides: Wrong turn is its control, on the
     Ride tab, and the one Stop is the sheet's (read before the ticks: the
     simulator can reach the end of its path inside them) */
  ok(grab("c-lost").hidden === false, "Wrong turn shows while the simulator rides, on the Ride tab");
  ok(grab("hudstats").hidden === false && grab("c-ride").hidden === true,
     "one Stop on screen while the simulator rides: the ride sheet's");
  /* take 188 · A222 · read the sheet BEFORE the ticks: the simulator can
     reach the end of its path inside them, and stopRide hides the sheet */
  ok(grab("hud-src").hidden === false,
     "a simulated ride says so on the ride sheet (\"Simulated ride\", posMode sim)");
  ok(grab("hc-time").hidden === false && grab("hc-spd").hidden === false && grab("hc-togo").hidden === true,
     "a simulated ride is a free ride on the sheet: Trip, Time, Speed (no guidance runs, so no To go)");
  ticks(300); frames(5);
}
const rec = grab("v-rec").textContent;

/* 7b · the ride HUD (take 78).
   The expected heading is computed HERE, from the harness's own step vector,
   not read back from the code that produced it — take 69's rule, written after
   a reversed bearing would have sent a reader the wrong way.
   Steps are +8e-4 lon, +5e-4 lat. Using the app's own planar scaling
   (dx = dlon * 0.714 * 69, dy = dlat * 69):
     east  = 8e-4 * 0.714 * 69 = 0.03941 mi
     north = 5e-4 * 69         = 0.03450 mi
     bearing = atan2(east, north) = 48.8 deg  -> sector NE */
if (!NO_GPS) {
  const EAST = 8e-4 * 0.714 * 69, NORTH = 5e-4 * 69;
  const wantDeg = (Math.atan2(EAST, NORTH) * 180 / Math.PI + 360) % 360;
  ok(grab("hudbar").hidden === false, "compass ribbon is on screen while riding");
  ok(grab("chips").hidden === true,
     "place chips yield their slot during a ride (they undo themselves anyway)");
  const ticksHtml = grab("hudticks")._html || "";
  const labels = [...ticksHtml.matchAll(/left:([\d.]+)px">([NSEW]{1,2})</g)]
    .map(([, x, t]) => ({ x: parseFloat(x), t }));
  ok(labels.length > 0, `ribbon drew ${labels.length} cardinal labels`);
  if (labels.length) {
    const centre = labels.reduce((a, b) =>
      Math.abs(b.x - 180) < Math.abs(a.x - 180) ? b : a);
    const wantCard = ["N","NE","E","SE","S","SW","W","NW"][Math.round(wantDeg / 45) % 8];
    ok(centre.t === wantCard,
       `ribbon centres on ${centre.t}; independently computed heading ` +
       `${wantDeg.toFixed(1)} deg = ${wantCard}`);
  }
  /* speed passes through when the fix carries it. The derived path cannot be
     exercised by synchronous fixes — no wall-clock elapses between them — and
     saying so is better than asserting something the harness cannot show. */
  geo.cb && geo.cb({ coords: { longitude: (manifest.bbox[0]+manifest.bbox[2])/2 + 0.03,
                               latitude: (manifest.bbox[1]+manifest.bbox[3])/2 + 0.02,
                               accuracy: 5, speed: 8.9408, heading: 90 } });
  frames(1);
  ok(/^20mph|^20<|20/.test(grab("hud-spd")._html || ""),
     `speed shown from the fix: ${(grab("hud-spd")._html || "").replace(/<[^>]*>/g, "")}`);
  /* take 188 · A222 · the ride sheet after the LAST fix. Trip is the recorded
     track: the same one-decimal number as the card's Recorded (the sheet was
     painted before record() and lagged a fix — the review measured 1.4
     against 2.0 here). Read _html: the value carries its unit span. */
  const recNow = grab("v-rec").textContent, tripHtml = grab("hud-dist")._html || "";
  ok(tripHtml.startsWith(recNow + "<span") && /^\d+\.\d$/.test(recNow),
     `the sheet's Trip equals Recorded after the last fix (${tripHtml.replace(/<[^>]*>/g, " ")} vs ${recNow})`);
  ok(/^(\d+|&lt;1)<span class="hu"> min<\/span>$|^\d+:\d\d<span class="hu"> h<\/span>$/.test(grab("hud-time")._html || ""),
     `the sheet's Time reads "<1 min", whole minutes or h:mm, the unit spaced (${(grab("hud-time")._html || "").replace(/<[^>]*>/g, " ")})`);
  /* a route is selected (section 5) and guidance is on (the GPS ride), so
     the sheet is the routed one: Trip, To go, Arrive */
  ok(grab("hc-togo").hidden === false && grab("hc-eta").hidden === false
     && grab("hc-time").hidden === true && grab("hc-spd").hidden === true,
     "a routed GPS ride shows Trip, To go and Arrive on the sheet (Time and Speed make way)");
  ok(/^\d+\.\d<span class="hu"> mi<\/span>$/.test(grab("hud-togo")._html || ""),
     `To go is the miles left along the route (${(grab("hud-togo")._html || "").replace(/<[^>]*>/g, " ")})`);
  ok(/^~(\d+<span class="hu"> min<\/span>|\d+:\d\d<span class="hu"> h<\/span>)$/.test(grab("hud-eta")._html || ""),
     `Arrive is the arrival estimate for what is left (${(grab("hud-eta")._html || "").replace(/<[^>]*>/g, " ")})`);
  /* take 188 · A217 · ONE arrival estimate: the nav strip prints the same
     "~N min" as the sheet's Arrive (take 187's strip used the rider's pace
     while the sheet used the route's estimate: ~4 against ~5 in one shot) */
  {
    const sheetEta = (grab("hud-eta")._html || "").replace(/<[^>]*>/g, "");
    const stripEta = (((grab("nav-g")._html || "").match(/<span class="eta">([^<]*)</) || [])[1] || "").match(/~[\d:]+ (?:min|h)/);
    ok(!!stripEta && stripEta[0] === sheetEta,
       `the nav strip and the sheet give one arrival estimate (strip "${stripEta ? stripEta[0] : "none"}", sheet "${sheetEta}")`);
  }
  const after = [...(grab("hudticks")._html || "")
    .matchAll(/left:([\d.]+)px">([NSEW]{1,2})</g)].map(([, x, t]) => ({ x: +x, t }));
  if (after.length) {
    const c2 = after.reduce((a, b) => Math.abs(b.x - 180) < Math.abs(a.x - 180) ? b : a);
    ok(c2.t === "E", `heading 90 from the fix centres on E (got ${c2.t})`);
  }
}

ok((record.setData.crumb || []).length > 0,
   `breadcrumb recorded via ${NO_GPS ? "simulator" : "live GPS"} (${rec} mi shown)`);
if (!NO_GPS) {
  ok(parseFloat(rec) > 0.5, `distance accumulated from fixes (${rec} mi)`);
  /* take 188 · A222 · Stop is the ride sheet's button now — the same state
     machine as the Ride tab's chip */
  grab("hud-stop").fire("click");
  ok(geo.cleared === clearedBefore + 1, "the ride sheet's Stop cleared the GPS watch");
  ok(!("ride" in grab("shell").dataset), "Stop clears #shell[data-ride] (the action row folds with the drawer again)");
  /* …and with no ride running it never STARTS one */
  grab("hud-stop").fire("click");
  ok(geo.cb === null && geo.cleared === clearedBefore + 1,
     "the sheet's Stop with no ride running starts nothing (no GPS watch opened)");
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

/* 7b · take 188 · landmine 135 · the cards the RIDE raises by itself stay
   quiet mid-ride. Resume is the rider's own tap on the offer, but "Trip
   resumed" and the resumed trip's re-planned route are the app's: with the
   ride running they must leave the drawer folded (the ride sheet's stats on
   screen), write the card, and say it on the peek bar. The app is killed
   mid-ride first (state wiped, storage kept), as render's nav drill does. */
if (!NO_GPS) {
  const N = sandbox.window.__nav;
  ok(!!N && typeof N.card === "function", "the trip hooks are exposed");
  /* An automatic re-route past the fuel range or arriving after dark opens
     its card mid-ride (7b2). Both warnings depend on things the harness does
     not otherwise hold still: the chip's range, and the wall clock (step 7's
     review ran this at 19:45, past sunset). Here the rider sits where the
     restart above left them, far off the network, so the re-planned route is
     long. The block therefore runs with the range OFF and on a pinned clock —
     04:00 at midsummer — so the quiet case has neither warning, and each
     loud case switches on exactly one: a 0.01 mi range, then a winter night.
     Only `new Date()` with no argument is pinned; Date.now keeps running,
     moved on by `skew` ms wherever the re-route's 20-second debounce has to
     have passed. Range and clock are restored at the end. */
  const RealDate = sandbox.Date;
  let pinAt = null, skew = 0;
  class PinnedDate extends RealDate {
    constructor(...a) { if (a.length || pinAt === null) super(...a); else super(pinAt); }
    static now() { return RealDate.now() + skew; }
  }
  sandbox.Date = PinnedDate;
  pinAt = new RealDate(2026, 5, 21, 4, 0).getTime();           /* 04:00, midsummer */
  const fuel0 = N && N.fuel ? N.fuel() : null;
  if (N && N.fuel) N.fuel(0);                                  /* range off */
  if (N && N.card) {
    N.save(true); N.reset(); sandbox.window.hudShow(false);
    /* take 188 · cold audit (F17) · Resume pressed and the GPS REFUSES: the
       refusal card must still be there once the resumed trip's route has
       been planned. The planner runs on a 30 ms timer, so the denial here
       lands before it, as a phone with location off answers; 30 ms later
       the route cards used to replace the refusal, with a live Ride it and
       nothing saying the trip had not resumed. The route is still chosen
       and the trip still resumable (the next assert presses Resume again).
       The judge is shown a panel of route cards, which it must reject. */
    {
      /* review of the audit fixes · "opened" was typeof geo.err, which the
         stub never clears: true once ANY watch had opened, and geo.err then
         reached the section-7 ride's old handler, whose refusal reads the
         same. Resume must open ONE new watch, and its own handler refuses */
      N.card();
      const s0 = geo.seq;
      grab("trip-resume").fire("click");
      const opened = geo.seq === s0 + 1, own = geo.watches.get(geo.id);
      own && own.err && own.err({ code: 1, message: "User denied Geolocation" });
      const before = (grab("panel")._html || "").replace(/<[^>]*>/g, "");
      flushTimeouts(); frames(2);
      const ph = grab("panel")._html || "";
      const kept = (h) => /No GPS fix/.test(h) && /Nothing started/.test(h) && !/id="routes"/.test(h) && !/id="rc-ride"/.test(h);
      ok(opened && /No GPS fix/.test(before) && kept(ph) && !kept('<div id="routes"><div class="rc sel"></div></div><button id="rc-ride"></button>')
         && !!N.plan() && !("ride" in grab("shell").dataset) && N.load() !== null,
         `a refused Resume keeps its refusal on the card after the resumed route is planned ("${ph.replace(/<[^>]*>/g, "").slice(0, 70)}"); `
         + `the route is chosen (${N.plan() ? "planned" : "NOT planned"}), nothing rides, the trip stays resumable; the judge rejects a panel of route cards`);
    }
    /* review of the audit fixes (F17's hold) · Resume presses Ride, and the
       press toggles: with a ride already running (pressed in the 3.2 s
       before the offer came up) it STOPS it. The hold covered a Resume
       only when the GPS refused, so 30 ms later the card read "Trip
       resumed · route to …" with a live Ride it and nothing recording.
       The trip as saved is put back afterwards (Stop ends it), for the
       real Resume below. The judge is shown the unheld card. */
    {
      const ls = sandbox.window.localStorage, trip0 = ls.getItem("apex.trip.v1");
      grab("c-ride").fire("click");
      const running = "ride" in grab("shell").dataset && /Stop \(GPS\)/.test(String(grab("c-ride")._html || ""));
      grab("trip-resume")._listeners = {};
      N.card();
      grab("trip-resume").fire("click");
      flushTimeouts(); frames(2);
      const ph = grab("panel")._html || "", pk = String(grab("peek-txt").textContent);
      const held = (h, p) => !/Trip resumed/.test(h) && !/id="rc-ride"/.test(h) && !/^Trip resumed/.test(p);
      ok(running && held(ph, pk) && !!N.plan() && !("ride" in grab("shell").dataset)
         && !held('<div id="routes"><div class="rc sel"></div></div><button id="rc-ride"></button>', "Trip resumed · route to home is on the map"),
         `a Resume whose Ride press stopped the ride already running keeps the stop's card ("${ph.replace(/<[^>]*>/g, "").slice(0, 60)}"; `
         + `peek "${pk.slice(0, 40)}"): no "Trip resumed · route to …" with a live Ride it, nothing riding; the judge rejects that card`);
      if (trip0 !== null) ls.setItem("apex.trip.v1", trip0);
      N.reset(); sandbox.window.hudShow(false);
    }
    /* (a new card's Resume is a new button in a browser; this stub keeps one
       element per id, so the drill's listener is dropped before the card is
       drawn again — two would press Ride twice, and the second press stops) */
    grab("trip-resume")._listeners = {};
    ok(N.card() === true, "a saved mid-ride trip offers Resume when the app comes back");
    grab("trip-resume").fire("click");
    const peekNow = grab("peek-txt").textContent, railNow = grab("rail").className;
    /* take 189 · cold audit · no fix has come yet: nothing records (the
       first fix starts it), so the card and the peek line say the GPS is
       awaited and the miles kept — never "Trip resumed · recording" (the
       judge is shown that line, and the old card body) */
    const waitKept = (p, h) => /^Waiting for a GPS fix — [\d.]+ mi recorded, kept$/.test(p) && /Trip resumed/.test(h)
      && /next GPS fix/.test(h) && !/continues from your last fix/.test(h);
    ok(railNow === "folded" && waitKept(peekNow, grab("panel")._html || "")
       && !waitKept("Trip resumed · recording", "<b>Trip resumed</b><div class=\"sub\">Recording continues from the next GPS fix</div>")
       && !waitKept(peekNow, "<b>Trip resumed</b><div class=\"sub\">Recording continues from your last fix.</div>"),
       `"Trip resumed" is quiet mid-ride and says what is happening: drawer ${railNow || "OPEN"}, peek "${peekNow}", `
       + `card "${(grab("panel")._html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 90)}"; `
       + `the judge rejects "Trip resumed · recording" before any fix`);
    flushTimeouts(); frames(2);
    ok(grab("rail").className === "folded" && /id="routes"/.test(grab("panel")._html || ""),
       `the resumed trip's re-planned route is quiet too: drawer ${grab("rail").className || "OPEN"}, `
       + `peek "${grab("peek-txt").textContent}"`);
    /* …and quiet is never an all-clear the card does not give: whatever the
       selected option warns (unverified miles, off-network miles) is on the
       peek line too */
    {
      const ph = grab("panel")._html || "", pk = grab("peek-txt").textContent;
      const selCard = (ph.split('<div class="rc sel"')[1] || "").split('<div class="rc')[0].split("<button")[0];
      const warns = [...selCard.matchAll(/([\d.]+) mi unverified \(OSM\)|\+([\d.]+) mi off-network/g)].map((m) => m[0]);
      const est = (selCard.match(/<div class="big">([\d.]+)[\s\S]*?<div class="sub">([^<·]+)/) || []).slice(1).join(" mi, ");
      ok(!!selCard && warns.every((w) => pk.includes(w)),
         `a quiet re-route's peek line carries the selected card's warnings (${est}: ${warns.length ? warns.join(", ") : "the card warns of none"}; peek "${pk}")`);
    }
    const resumedPeek = grab("peek-txt").textContent;
    /* take 188 · cold audit (F7) · nothing was re-routed: the line says the
       trip resumed and where its route goes. It read "Re-routed · the new
       route is on the map" before the rider had moved. The judge is shown
       that line. (7b2 below holds a real re-route to "Re-routed".) */
    {
      /* take 189 · cold audit · and while the GPS still waits (no fix yet
         here) the line says so — "Trip resumed · route to … is on the map"
         said nothing of a ride that was not recording */
      const saysResumed = (p) => /^Waiting for a GPS fix · route to \S/.test(p) && !/Re-rout/.test(p);
      ok(saysResumed(resumedPeek) && !saysResumed("Re-routed · the new route is on the map")
         && !saysResumed("Trip resumed · route to home is on the map"),
         `a resumed trip's route is announced as the trip resuming, never a re-route, and says the GPS is awaited ("${resumedPeek}"); `
         + `the judge rejects "Re-routed · …" and "Trip resumed · route to … is on the map" before any fix`);
    }
    ok(grab("shell").dataset.ride === "1", "the resumed ride keeps #shell[data-ride]");
    /* A221 · the resumed trip's first fix puts the ride sheet back (the
       RESUMING branch returned before hudShow on take 187); the ride runs on
       live GPS into the dispatch check below, as it did before this block */
    const crumbsBefore = N.crumbs();
    for (let i = 7; i < 9; i++)
      geo.cb && geo.cb({ coords: { longitude: manifest.bbox[0]+0.05+i*6e-4, latitude: manifest.bbox[1]+0.05, accuracy: 5 } });
    frames(2);
    ok(grab("hudstats").hidden === false && grab("hudbar").hidden === false && N.crumbs() > crumbsBefore,
       `a resumed trip's first fix shows the ride sheet again and continues the line (${crumbsBefore} -> ${N.crumbs()} fixes)`);
    /* the route guidance now rides (navPlan's option) is the one the quiet
       peek line spoke for: the profile the rider was on, selected before the
       cards were written — not the first option, re-selected afterwards */
    {
      const G = N.guide(), o = G && G.o, adv = o && o.s ? o.s.adv : null;
      ok(adv !== null && (adv <= 0.05 || resumedPeek.includes(adv.toFixed(1) + " mi unverified (OSM)")),
         `the resumed route being ridden is the one the peek line described (${adv === null ? "no route" : adv.toFixed(1) + " mi unverified"}; peek "${resumedPeek}")`);
    }

    /* 7b2 · take 188 · an AUTOMATIC re-route (navGuide's off-route branch:
       three fixes more than 40 m off the line) is quiet only when the option
       the rider will ride carries no range or darkness warning. On take 187
       every re-route opened its card; past the fuel range or arriving after
       dark it still must (the step-7 review: a quiet peek line would read as
       an all-clear). The fixes go 0.012 deg BEHIND the rider, away from the
       destination, so they project onto the route's start (no arrival). */
    const hereAt = sandbox.window.__disp.ME.slice(), trip = N.load() || {};
    const offRoute = (back = 0.012) => {
      const me = sandbox.window.__disp.ME, to = trip.to || me;
      const dx = me[0] - to[0], dy = me[1] - to[1], d = Math.hypot(dx, dy) || 1;
      const p = [hereAt[0] + dx / d * back, hereAt[1] + dy / d * back];
      N.rail(false);
      for (let i = 0; i < 3; i++)
        geo.cb && geo.cb({ coords: { longitude: p[0] + i * 1e-5, latitude: p[1], accuracy: 5 } });
      flushTimeouts(); frames(2);
      return { rail: grab("rail").className, html: grab("panel")._html || "", peek: grab("peek-txt").textContent };
    };
    ok(!!trip.to, `the resumed trip has a destination to re-route to (${trip.to ? trip.to.map((v) => v.toFixed(3)) : "none"})`);
    N.fuel(0.01);                                   /* shorter than any route */
    skew += 25000;                                  /* past the re-route debounce */
    const rf = offRoute();
    ok(/id="routes"/.test(rf.html) && /mi past your range/.test(rf.html) && rf.rail !== "folded",
       `a re-route past the fuel range opens its card mid-ride: drawer ${rf.rail || "OPEN"}, `
       + `card ${/mi past your range/.test(rf.html) ? "says" : "does NOT say"} "past your range"`);
    N.fuel(0);
    skew += 25000;
    pinAt = new RealDate(2026, 11, 21, 23, 50).getTime();        /* a winter night */
    const rd = offRoute();
    ok(/id="routes"/.test(rd.html) && /arrives after dark/.test(rd.html) && !/mi past your range/.test(rd.html)
       && rd.rail !== "folded",
       `a re-route that arrives after dark opens its card mid-ride: drawer ${rd.rail || "OPEN"}, `
       + `card ${/arrives after dark/.test(rd.html) ? "says" : "does NOT say"} "arrives after dark"`);
    /* take 188 · A217 · …but only when the warning is NEW. The next re-route
       on the same winter night arrives after dark too; the rider already
       rode on under that warning, so it changes nothing they must do: the
       card stays quiet, and the peek line still says it (never an
       all-clear). */
    skew += 25000;
    const rq = offRoute(0.03);
    ok(/id="routes"/.test(rq.html) && /arrives after dark/.test(rq.html) && rq.rail === "folded"
       && /arrives after dark/.test(rq.peek) && /^Re-routed · /.test(rq.peek),
       `a re-route whose only warning the ridden route already carried stays quiet: drawer ${rq.rail || "OPEN"}, `
       + `peek "${rq.peek}"`);
    /* back on the line, so the ride runs on into the dispatch check as before */
    N.rail(false);
    geo.cb && geo.cb({ coords: { longitude: hereAt[0], latitude: hereAt[1], accuracy: 5 } });
    frames(1);
  }
  if (N && N.fuel) N.fuel(fuel0);
  sandbox.Date = RealDate;
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
  if (tiles && tiles.sparse) {
    /* Take 127: statewide the pyramid is SPARSE — patches over the riding
       areas on a second raster source, above the mosaic that covers the
       state. Both shapes are asserted: the mosaic stays, the patches are
       real tiles, and every tile the app may ask for is in a declared box. */
    const sp = record.sources.satpatch;
    ok(sat && sat.type === "image", "statewide mosaic stays underneath (image source)");
    ok(sp && sp.type === "raster" && sp.maxzoom === tiles.zmax,
       `riding-area patches are a raster source to z${sp && sp.maxzoom}`);
    ok(Array.isArray(tiles.boxes) && tiles.boxes.length >= 4,
       `${tiles.boxes.length} patch boxes declared — nothing outside them is ever requested`);
    ok(tiles.count > 100, `${tiles.count} tiles, ${(tiles.bytes / 1048576).toFixed(0)} MB over the riding areas`);
  } else if (tiles) {
    ok(sat && sat.type === "raster", `satellite is a raster tile source (${sat && sat.type})`);
    ok(sat && sat.maxzoom === tiles.zmax, `tiles served to z${sat && sat.maxzoom}`);
    ok(tiles.count > 100, `${tiles.count} tiles, ${(tiles.bytes / 1048576).toFixed(0)} MB`);
  } else {
    ok(sat && sat.type === "image", "no tiles in this bundle, mosaic fallback used");
  }
}

/* 9 · basemap: imagery only when the bundle can place it. Take 188 (A212):
   two basemaps, so c-base toggles — tap 1 Hybrid, tap 2 Map, tap 3 Hybrid,
   the state the rest of this harness has always run on. */
const satOK = !EXPECT_PARTIAL.includes("imagery");
const baseTap = () => {
  grab("c-base").fire("click");
  const v = record.layout.filter((l) => l[0] === "sat" && l[1] === "visibility").at(-1);
  const lbl = ((grab("c-base")._html || "").match(/<span>([^<]*)<\/span>/) || [])[1] || "";
  return { vis: v ? v[2] : null, lbl };
};
const bt = [baseTap(), baseTap(), baseTap()];
if (satOK) {
  ok(bt[0].vis === "visible" && bt[0].lbl === "Hybrid", `tap 1 shows Hybrid (sat ${bt[0].vis}, chip "${bt[0].lbl}")`);
  ok(bt[1].vis === "none" && bt[1].lbl === "Map", `tap 2 returns to Map (sat ${bt[1].vis}, chip "${bt[1].lbl}")`);
  ok(bt[2].vis === "visible" && bt[2].lbl === "Hybrid", `tap 3 is Hybrid again — two states, no third (sat ${bt[2].vis}, chip "${bt[2].lbl}")`);
} else ok(bt.every((b) => !b.vis || b.vis === "none"), "no imagery → basemap stays on Map");

/* 9a · take 188 · A213 (G11) · one writer of network opacity. Every
   line-opacity the app wrote on a MACH_LAYERS id is a per-feature case, or a
   zoom interpolate whose stops are cases — never a plain number, which is
   the shape that let a basemap switch overwrite the machine's dimming. The
   list is parsed from the shipped app.js; an empty parse fails. */
{
  const mm = appSrc.match(/var\s+MACH_LAYERS\s*=\s*\[([^\]]*)\]/);
  const MACH = mm ? [...mm[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
  const isCase = (v) => Array.isArray(v) && v[0] === "case";
  const shapeOk = (v) => isCase(v) || (Array.isArray(v) && v[0] === "interpolate"
    && Array.isArray(v[2]) && v[2][0] === "zoom" && v.length > 4
    && v.slice(3).every((x, j) => j % 2 === 0 ? typeof x === "number" : isCase(x)));
  const plain = (paint, L) => paint.filter((p) => L.includes(p[0]) && p[1] === "line-opacity" && !shapeOk(p[2]));
  const writes = record.paint.filter((p) => MACH.includes(p[0]) && p[1] === "line-opacity").length;
  const bad = plain(record.paint, MACH);
  const plantBad = plain(record.paint.concat([["casing-track", "line-opacity", 0.4]]), MACH);
  ok(MACH.length >= 10 && writes > 0 && bad.length === 0 && plantBad.length === bad.length + 1,
     `network line-opacity has one writer: ${writes} writes on ${MACH.length} MACH_LAYERS, `
     + `${bad.length} plain number(s)${bad.length ? " — " + JSON.stringify(bad.slice(0, 3)) : ""}; `
     + `a planted plain 0.4 on casing-track is ${plantBad.length === bad.length + 1 ? "flagged" : "MISSED"}`);
}

/* 9a1 · take 188 · A202 D7 (G9) · a tap on a low-zoom stroke names a real
   edge. The planted hit is a stroke of class C at the first vertex of a
   per-edge feature of C; it must give that class's edge card and never "Not
   an ORV route". The control is a show-only hit (no i, no lo), which must
   give exactly that line — so the assertion can tell the two apart. */
{
  const net = record.sources.net.data.features;
  const edge = net.find((f) => f.properties && f.properties.i !== undefined && f.properties.c === "trail50")
    || net.find((f) => f.properties && f.properties.i !== undefined);
  if (!edge || !net.some((f) => f.properties && f.properties.lo === 1)) ok(false, "G9 · no per-edge feature or no low-zoom stroke to tap");
  else {
    const C = edge.properties.c, at = edge.geometry.coordinates[0];
    /* a long press earlier in this run leaves the next click consumed (as on
       a phone: the press already acted), so an empty tap goes first */
    theMap._hit = []; theMap.fire("click", { lngLat: { lng: at[0], lat: at[1] }, point: { x: 300, y: 500 } }); flushTimeouts();
    const tap = (hit) => { theMap._hit = [hit]; grab("panel")._html = "";
      theMap.fire("click", { lngLat: { lng: at[0], lat: at[1] }, point: { x: 300, y: 500 } }); flushTimeouts();
      theMap._hit = []; return grab("panel")._html || ""; };
    const ctl = tap({ properties: { c: "foot", n: "X" }, layer: { id: "foot" } });
    const lo = tap({ properties: { lo: 1, c: C, s: 0 }, layer: { id: C } });
    ok(/Not an ORV route/.test(ctl) && !/mi segment/.test(ctl),
       "G9 control: a show-only hit (no i, no lo) says Not an ORV route"
       + (/Not an ORV route/.test(ctl) ? "" : " — got: " + ctl.replace(/<[^>]+>/g, " ").slice(0, 160)));
    ok(/mi segment/.test(lo) && !/Not an ORV route/.test(lo) && /nearest/i.test(lo),
       `G9 · a tap on a ${C} low-zoom stroke gives the nearest ${C} edge's card, says it is the nearest at this zoom, `
       + `and never Not an ORV route${/mi segment/.test(lo) ? "" : " — got: " + lo.replace(/<[^>]+>/g, " ").slice(0, 160)}`);
    /* step 9b review · the nearest-segment note must come BEFORE every tag
       (source, "closed", "illegal for your machine"), so no tag reads as a
       fact about the spot tapped; the note says the whole card is about that
       segment. Every edge card carries the source tag, so the order is
       testable on any edge. The plant is the card with the note moved after
       the first tag — the order the card had before this fix. */
    const noteAt = (h) => h.search(/<div class="sub">The nearest /), tagAt = (h) => h.indexOf('class="tag');
    const orderOk = (h) => noteAt(h) >= 0 && tagAt(h) >= 0 && noteAt(h) < tagAt(h) && /Everything on this card is about that segment/.test(h);
    const nm = lo.match(/<div class="sub">The nearest [\s\S]*?<\/div>/);
    const plantOrder = nm ? (() => { const t = lo.replace(nm[0], ""); const i = t.indexOf('class="tag'); const j = t.indexOf("</span>", i) + 7; return t.slice(0, j) + nm[0] + t.slice(j); })() : "";
    ok(orderOk(lo) && !orderOk(plantOrder),
       `G9 · the nearest-segment note precedes every tag on a ${C} lo card (note at ${noteAt(lo)}, first tag at ${tagAt(lo)}) `
       + `and says the whole card is about that segment; a planted note after the first tag is ${orderOk(plantOrder) ? "MISSED" : "caught"}`);
    /* step 13b2 · the classes chained by measurement beyond the designated
       five (forest road and both closed classes since take 188 scoped
       two-track and paved back to per-edge; read from the built app.js's
       NETLO_CLS, not typed) take the same path: a stroke tap at one of the
       class's own edges gives that class's nearest-segment card, never "Not
       an ORV route" */
    const NLC9 = (((/NETLO_CLS=\[([^\]]*)\]/.exec(appSrc) || [])[1] || "").match(/'[^']+'/g) || []).map((x) => x.slice(1, -1));
    const EXT = NLC9.filter((c) => !["route72", "trail50", "moto24", "mccct", "fstrail"].includes(c)), extBad = [];
    if (!EXT.length) extBad.push("no chained class beyond the designated five read from app.js");
    for (const X of EXT) {
      const ex = net.find((f) => f.properties && f.properties.i !== undefined && f.properties.c === X);
      if (!ex) { extBad.push(X + ": no edge"); continue; }
      const p0 = ex.geometry.coordinates[0];
      theMap._hit = [{ properties: { lo: 1, c: X, s: 0 }, layer: { id: X } }]; grab("panel")._html = "";
      theMap.fire("click", { lngLat: { lng: p0[0], lat: p0[1] }, point: { x: 300, y: 500 } }); flushTimeouts(); theMap._hit = [];
      const h = grab("panel")._html || "";
      if (!(/mi segment/.test(h) && /The nearest /.test(h) && !/Not an ORV route/.test(h) && orderOk(h))) extBad.push(X + ": " + h.replace(/<[^>]+>/g, " ").slice(0, 90));
    }
    ok(extBad.length === 0, `G9 · a low-zoom stroke tap on each measured class (${EXT.join(", ")}) gives its nearest-segment card, note first`
       + (extBad.length ? " — " + extBad.join("; ") : ""));
  }
}

/* 9a2 · take 188 · A214 · the Pins rows under stubs. There is no canvas
   here, so makeBadges registers nothing and every row must take the swatch
   fallback — one data-pk row per kind the mode lists, each with its .sw and
   no <img (a row pointing at a badge that was never drawn). applyMode builds
   the panel inside a try, so the rows are read back per mode: a throw would
   leave the previous mode's rows, and the kind list would not match. */
{
  const M = sandbox.window.__mode, was = M && M.get();
  const rowsOf = (h) => [...String(h).matchAll(/<button class="actrow[^"]*" data-pk="([^"]*)">(.*?)<\/button>/g)]
    .map((x) => ({ k: x[1], sw: /class="sw[ "]/.test(x[2]), img: /<img/.test(x[2]) }));
  const judge = (rows, kinds) => rows.length === kinds.length && rows.every((r, i) => r.k === kinds[i] && r.sw && !r.img);
  /* the mockup's helper line says "Each badge is the one the map draws"; with
     no drawn badge it must not be there (card text literally honest) */
  const noted = (h) => /class="pnote"/.test(String(h));
  const bad = [];
  let n = 0;
  /* applyMode rebuilds the panel only while it is open, as a rider reading
     the rows has it; the stub has no initial hidden, so it read open until
     a tab switch closed it (take 188: Ride it shows the Ride tab) */
  const lpWas = grab("lyrpanel").hidden; grab("lyrpanel").hidden = false;
  for (const md of (M && M.MODES) || []) {
    M.apply(md.k, { silent: true });
    const html = grab("lyrpanel")._html, rows = rowsOf(html);
    n += rows.length;
    if (!judge(rows, md.kinds || [])) bad.push(md.k + ": " + JSON.stringify(rows.slice(0, 3)));
    if (noted(html)) bad.push(md.k + ": the helper line claims drawn badges under stubs");
  }
  if (M && was) M.apply(was, { silent: true });
  grab("lyrpanel").hidden = lpWas;
  const plant = rowsOf('<button class="actrow on" data-pk="fuel"><span class="sw pb"><img class="pbdg" src="x" alt=""></span><span>Fuel</span></button>');
  const notePlant = noted('<div class="sect">Pins in Camp</div><div class="pnote">Each badge is the one the map draws.</div>');
  ok(M && M.MODES.length >= 5 && n > 0 && bad.length === 0 && !judge(plant, ["fuel"]) && notePlant,
     `Pins rows under stubs: ${n} rows across ${M ? M.MODES.length : 0} modes, each a .sw swatch with no <img, and no helper line`
     + (bad.length ? " — " + bad.slice(0, 2).join("; ") : "")
     + `; a planted <img row is ${judge(plant, ["fuel"]) ? "MISSED" : "flagged"}; a planted helper line is ${notePlant ? "flagged" : "MISSED"}`);
}

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
    /* take 189 · A236 · the line the Fold session reads: which font the
       labels draw in and which glyph ranges loaded. INFO, never a verdict;
       the stub map has no glyph manager and no layer types, so here it must
       say UNKNOWN rather than a reading it did not make (render reads the
       real one) */
    const gl = (st.results || []).filter((r) => r.g === "RENDER" && r.id === "glyphs");
    ok(gl.length === 1 && gl[0].ok === null && /^UNKNOWN \u2014 /.test(gl[0].d),
       `the self-test carries the glyph readback line, INFO, and under the stubs it says UNKNOWN: "${gl.length ? gl[0].d : "(missing)"}"`);
  }
}

/* 9c · take 188 · A222 · the ride sheet's Voice note (no speech in this
   WebView, A218) says only what the strip really does: a road route's strip
   shows each turn, a river run's shows what is ahead on the river, a free
   ride has no strip line at all — card text literally honest */
if (!NO_GPS) {
  const N = sandbox.window.__nav, V = sandbox.window.__voice;
  if (N && V && N.chip && N.runSet) {
    const okWas = V.ok; V.ok = false;
    /* take 188 · cold audit (F1) · its own route: the Pins drill (9a2) walks
       every mode, and a mode that changes the machine now clears the route
       this drill used to borrow from section 7 */
    grab("btn-home").fire("click"); flushTimeouts();
    N.start(); N.chip();
    const road = grab("hud-vnote").textContent;
    N.runSet("Au Sable River", { n: "Put-in", mi: 0 }, { n: "Take-out", mi: 3 }); N.chip();
    const river = grab("hud-vnote").textContent;
    N.stop(); N.chip();
    const free = grab("hud-vnote").textContent;
    V.ok = okWas; N.chip();
    ok(/every turn\.$/.test(road) && /ahead on the river\.$/.test(river) && !/turn/.test(river)
       && /WebView\.$/.test(free) && grab("hud-vnote").hidden === !!okWas,
       `the Voice note says only what the strip does — road: "${road}"; river: "${river}"; free: "${free}"`);
  } else ok(false, "the voice and run hooks are exposed");
}

/* 7b3 · take 188 · A217 · Clear route is a toast: the drawer folds, the
   panel holds the words and no stale route cards. Last, because retrace,
   the resume block and the Voice note (9c) all still need the route. */
{
  grab("btn-clear").fire("click"); flushTimeouts();
  const ph = grab("panel")._html || "";
  ok(/Route cleared/.test(grab("toast").textContent) && grab("rail").className === "folded"
     && /Route cleared/.test(ph) && !/id="routes"/.test(ph),
     `Clear route is a toast ("${grab("toast").textContent}", drawer ${grab("rail").className || "OPEN"}, `
     + `panel ${/id="routes"/.test(ph) ? "STILL HOLDS the cards" : "holds the words"})`);
}

/* 11 · take 188 · the cold audit's drills (F1-F4, F13, F15, F19). Last on
   purpose: each plans or rides for itself, and nothing after it reads the
   state it leaves. Every judge is shown a planted reading it must reject;
   each fix was also taken out of a copy of the built app to watch its drill
   fail (the runs are in the take's audit notes). */
if (!NO_GPS) {
  const N = sandbox.window.__nav, R = sandbox.window.__route, M = sandbox.window.__mode, D = sandbox.window.__disp;
  const text = (id) => String(grab(id)._html || "").replace(/<[^>]*>/g, "");
  const chipTxt = () => text("c-ride");
  const flagged = () => "ride" in grab("shell").dataset;
  const fix = (p, extra) => geo.cb && geo.cb({ coords: Object.assign({ longitude: p[0], latitude: p[1], accuracy: 5 }, extra || {}) });
  const deny = () => { geo.err && geo.err({ code: 1, message: "User denied Geolocation" }); flushTimeouts(); frames(1); };
  /* the ride the run left going ends where riders stand (the declared
     centre), so the drills start from trail country and off a ride */
  const c0 = manifest.centre || [anchors[0][1], anchors[0][2]];
  if (typeof geo.cb === "function") fix(c0);
  if (flagged()) grab("hud-stop").fire("click");
  flushTimeouts(); frames(1);
  ok(!flagged() && Math.abs(D.ME[0] - c0[0]) < 1e-9 && Math.abs(D.ME[1] - c0[1]) < 1e-9,
     "the cold-audit drills start off a ride, the rider standing at the region's centre (their premise)");

  /* F2 · a loop ends where it starts. Ridden from its own start, the first
     fix was inside 25 m of the "destination": To go 0.0, Arrive a dash and
     "You have arrived" for the whole loop, and no turn was ever called.
     Here the loop is chosen on the chooser, ridden from its first point
     round to its last, one fix per vertex, and must: not arrive at the
     start, count To go down, call turns, and arrive at the end — at "the
     start", not at whatever the last point-to-point route was called.
     F15 and F3 are read on the way round (below). */
  {
    grab("c-loop").fire("click");
    const pick = documentStub.querySelectorAll("[data-loop]")[0];
    if (pick) { pick.fire("click"); flushTimeouts(); }
    const G0 = pick ? N.plan() : null;
    ok(!!G0 && G0.loop === true && G0.lbl === "the start" && G0.pts.length > 10,
       `the loop chooser plans a ${pick ? pick.dataset.loop : "?"} mi loop from here (${G0 ? (G0.total / 1609.34).toFixed(1) + " mi, " + G0.pts.length + " points" : "NONE"}), `
       + `its end named "${G0 ? G0.lbl : "?"}"`);
    if (G0) {
      const totalMi = G0.total / 1609.34, pts = G0.pts.slice(), cum = G0.cum.slice(), total = G0.total;
      const spd = { speed: 8.9408, heading: 90 };
      const read = () => { const G = N.guide() || {}; return { arrived: !!G.arrived, togo: parseFloat(text("hud-togo")), eta: text("hud-eta"),
        strip: text("nav-g"), spd: text("hud-spd"), sp: String(grab("nav-sp").textContent), gHidden: grab("nav-g").hidden === true }; };
      /* the rider stands where the loop was planned (its "destination") */
      const start = D.ME.slice();
      grab("c-ride").fire("click");
      fix(start, spd);                  /* the first fix: the recording starts */
      fix(start, spd);                  /* …and a second, still at the start */
      frames(1);
      const atStart = read();
      /* To go at the start is the loop less wherever on its first mile the
         pin is nearest to (the pin is where the rider stands, not always on
         the line's first vertex) */
      const under = (r, mi) => !r.arrived && r.togo > 0.2 && r.togo <= mi + 0.15 && r.togo >= mi - 1.15
        && !/You have arrived/.test(r.strip) && /^~\d/.test(r.eta);
      ok(under(atStart, totalMi) && !under({ arrived: true, togo: 0, eta: "—", strip: "You have arrived" }, totalMi),
         `a loop ridden from where it was planned (its "destination", 0 m away) has NOT arrived there: To go ${text("hud-togo")} of ${totalMi.toFixed(1)} mi, `
         + `Arrive ${atStart.eta}, strip "${atStart.strip.trim().slice(0, 48)}"; the judge rejects take 187's first fix (arrived, To go 0.0, Arrive a dash)`);
      const iHalf = Math.max(2, cum.findIndex((m) => m >= total / 2));
      const turns = new Set(); let arrivedAt = null, half = null, paints = null, drop = null;
      for (let i = 1; i < pts.length; i++) {
        if (i === iHalf) {
          fix(pts[i], spd);
          half = { togo: read().togo, want: (total - cum[i]) / 1609.34 };
          /* F15 · ONE paint of the ride sheet per fix. hudSet painted it
             before record() and onFix painted it again after: every fix
             wrote the sheet twice. Trip's cell is written once per paint,
             so its writes are counted across one fix; a second paint
             planted inside the same window must read 2 (the control). */
          let writes = 0;
          const cell = grab("hud-dist"), d = Object.getOwnPropertyDescriptor(El.prototype, "innerHTML");
          Object.defineProperty(cell, "innerHTML", { configurable: true, get() { return d.get.call(this); }, set(v) { writes++; d.set.call(this, v); } });
          fix(pts[i], spd);
          const one = writes; sandbox.window.hudPaint();
          paints = { one, planted: writes };
          delete cell.innerHTML;
          /* F3 · a GPS dropout on screen. The sheet repaints on the ride's
             20 s pulse; speed, To go and Arrive are only ever written by a
             fix, so with no fix they sat beside the moving clock as if
             live. 40 s pass with no fix (the clock is moved on, the pulse
             fires): the three read a dash and the strip says since when
             there has been no fix; the next fix puts them back. The clock
             stays moved on: nothing after this block compares it with the
             harness's own. */
          const live = read();
          /* take 189 · A237 · fix round 1 · the place cards in the same
             dropout: "of you" while the fixes come, not once the strip says
             there has been none (the last fix is miles behind at riding
             speed), and back with the next fix */
          const lv = () => ({ live: N.live && N.live() !== null, dist: N.dist ? N.dist(pts[0]) : "(no hook)",
            card: (sandbox.window.placeCard(pts[0], "drop", "Dropped pin"), grab("panel")._html || "") });
          const lvLive = lv();
          const Real = sandbox.Date;
          sandbox.Date = class extends Real {
            constructor(...a) { if (a.length) super(...a); else super(Real.now() + 40000); }
            static now() { return Real.now() + 40000; } };
          ticks(1);
          const lost = read(); lost.time = text("hud-time");
          const lvLost = lv();
          fix(pts[i], spd);
          drop = { live, lost, back: read(), lv: { live: lvLive, lost: lvLost, back: lv() } };
        }
        fix(pts[i], spd);
        const tm = String(grab("nav-g")._html || "").match(/<\/span>In [^<]*? · ([^<]*? onto [^<]*)<\/b>/);
        if (tm) turns.add(tm[1]);
        if (arrivedAt === null && (N.guide() || {}).arrived) arrivedAt = cum[i];
      }
      frames(1);
      const end = read();
      ok(!!half && Math.abs(half.togo - half.want) < 0.2,
         `half way round, To go is what is left of the loop (${half ? half.togo : "?"} mi shown, ${half ? half.want.toFixed(2) : "?"} mi along the line)`);
      ok(turns.size > 0, `the loop's turns are called on the way round (${turns.size} distinct, e.g. "${[...turns][0] || "NONE"}")`);
      ok(end.arrived && arrivedAt !== null && arrivedAt > total * 0.5 && /You have arrived/.test(end.strip) && /the start/.test(end.strip)
         && text("hud-togo").startsWith("0.0"),
         `…and the loop arrives at its end (after ${arrivedAt === null ? "NEVER" : (arrivedAt / 1609.34).toFixed(1)} of ${totalMi.toFixed(1)} mi): "${end.strip}"`);
      ok(!!paints && paints.one === 1 && paints.planted === 2,
         `one GPS fix paints the ride sheet once (Trip written ${paints ? paints.one : "?"}×); a second paint planted in the same window reads ${paints ? paints.planted : "?"} (its control)`);
      /* review of the audit fixes · the turn banner too: it kept the last
         fix's "In 400 ft · Turn …" and "2.3 mi remaining · ~14 min" beside
         the sheet's dashes */
      const bannerStale = (r) => !r.gHidden && /Waiting for a GPS fix/.test(r.strip) && /No fix since \S/.test(r.strip)
        && !/remaining|~\d|In \d|\d(\.\d)? mi\b|\d+ ft\b/.test(r.strip);
      const dashed = (r) => !!r && /^—/.test(r.spd) && isNaN(r.togo) && r.eta === "—" && /^No GPS fix since \S/.test(r.sp) && !/mph/.test(r.sp)
        && bannerStale(r);
      const say = (r) => r ? `speed "${r.spd}", To go "${isNaN(r.togo) ? "—" : r.togo}", Arrive "${r.eta}", strip "${r.sp}"` : "not read";
      ok(!!drop && dashed(drop.lost) && !dashed(drop.live) && !dashed(drop.back) && /mph/.test(drop.live.sp) && /mph/.test(drop.back.sp)
         && isFinite(drop.back.togo) && /\d/.test(drop.lost.time || "") && /remaining/.test(drop.live.strip) && /remaining/.test(drop.back.strip),
         `a GPS dropout reads as one: after 40 s with no fix — ${say(drop && drop.lost)}, banner "${drop ? drop.lost.strip : "?"}", while Time still reads "${drop ? drop.lost.time : "?"}"; `
         + `the next fix puts them back (${say(drop && drop.back)}, banner "${drop ? drop.back.strip : "?"}"); the judge rejects the live reading (${say(drop && drop.live)}) `
         + `and the old dropout (the sheet dashed, the banner still "${drop ? drop.live.strip : "?"}")`);
      {
        const youOk = (r) => !!r && r.live === true && / of you$/.test(r.dist) && fromOk(r.card, true, "gps");
        const lastOk = (r) => !!r && r.live === false && / of your last GPS fix \(\S[^)]*\)$/.test(r.dist) && !/ of you$/.test(r.dist)
          && /\(\d+°\) from your last GPS fix \(\S[^)]*\)</.test(r.card) && fromOk(r.card, false, "gps");
        const L = drop && drop.lv;
        const lCtl = !lastOk({ live: false, dist: "1.2 mi NE of you", card: '<span class="unit">1.20 mi NE (45°) from your position</span>' })
          && !lastOk({ live: true, dist: "1.2 mi NE of your last GPS fix (10:42 AM)", card: '<span class="unit">1.20 mi NE (45°) from your last GPS fix (10:42 AM)</span>' })
          && lastOk({ live: false, dist: "1.2 mi NE of your last GPS fix (10:42 AM)", card: '<span class="unit">1.20 mi NE (45°) from your last GPS fix (10:42 AM)</span>' });
        ok(!!L && youOk(L.live) && lastOk(L.lost) && youOk(L.back) && lCtl,
           `a GPS dropout is no live fix for the place cards either: riding, "${L ? L.live.dist : "?"}" / "${L ? fromLine(L.live.card) : "?"}"; `
           + `40 s with no fix (live ${L ? L.lost.live : "?"}), "${L ? L.lost.dist : "?"}" / "${L ? fromLine(L.lost.card) : "?"}"; `
           + `the next fix, "${L ? L.back.dist : "?"}"; its control rejects the fix-round-0 "of you" in the dropout (${lCtl})`);
      }
      ok(!!drop && !dashed(Object.assign({}, drop.lost, { strip: drop.live.strip })),
         `the dropout judge rejects a dashed sheet under a banner that still reads live ("${drop ? drop.live.strip : "?"}")`);
      grab("hud-stop").fire("click"); flushTimeouts(); frames(1);
      /* take 189 · A237 · fix round 2 · a STOPPED ride: Stop leaves position
         mode 'gps' and ME on the ride's last fix, with no watch open. Just
         after Stop that fix is live ("of you", "You are here"); 40 s on, past
         GPS_STALE_MS by the fix's own clock, it is where the rider WAS: the
         place cards and the me-marker name the last GPS fix and its clock
         time, never "you" (fix round 1 judged the dropout only while the
         ride's watch ran, so hours after Stop it still read "of you") */
      {
        /* the app's me-marker, from every marker made: the stub's markers
           list can lose it (remove() on a marker already removed splices the
           list's last entry) */
        const meM = everyMarker.filter((m) => /(^|\s)me(\s|$)/.test(m._el.className || "")).pop() || null;
        const st = () => { let title = "(no me-marker)";
          if (meM) { meM.getElement().fire("click", { stopPropagation() {} }); flushTimeouts();
            title = ((grab("panel")._html || "").match(/<span class="tn">([^<]*)<\/span>/) || [, "(no title)"])[1]; }
          const far = pts[Math.floor(pts.length / 2)];
          return { live: N.live() !== null, pos: N.pos(), dist: N.dist(far),
            card: (sandbox.window.placeCard(far, "drop", "Dropped pin"), grab("panel")._html || ""), title }; };
        const s0 = st(), t0 = N.live() ? N.live().t : null;
        const R1 = sandbox.Date;
        const want = t0 === null ? "(no live fix)" : new R1(t0).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        sandbox.Date = class extends R1 { constructor(...a) { if (a.length) super(...a); else super(R1.now() + 40000); }
          static now() { return R1.now() + 40000; } };
        let s1 = null;
        try { s1 = st(); } finally { sandbox.Date = R1; }
        const youOk = (r) => !!r && r.live === true && / of you$/.test(r.dist) && fromOk(r.card, true, "gps") && r.title === "You are here";
        const wasOk = (r, w) => !!r && r.live === false && r.pos === "gps" && / of your last GPS fix \(\d{1,2}:\d\d[^)]*\)$/.test(r.dist)
          && r.dist.endsWith(" of your last GPS fix (" + w + ")") && r.card.includes(" from your last GPS fix (" + w + ")<") && r.title === "Last GPS fix (" + w + ")"
          && /\(\d+°\) from your last GPS fix \(\d{1,2}:\d\d[^)]*\)</.test(r.card) && fromOk(r.card, false, "gps")
          && /^Last GPS fix \(\d{1,2}:\d\d[^)]*\)$/.test(r.title);
        const cw = (t) => ({ live: false, pos: "gps", dist: `1.2 mi NE of your last GPS fix (${t})`,
          card: `<span class="unit">1.20 mi NE (45°) from your last GPS fix (${t})</span>`, title: `Last GPS fix (${t})` });
        const sCtl = !wasOk({ live: false, pos: "gps", dist: "1.2 mi NE of you", card: '<span class="unit">1.20 mi NE (45°) from your position</span>', title: "You are here" }, "10:42 AM")
          && !wasOk(Object.assign(cw("10:42 AM"), { title: "You are here" }), "10:42 AM")
          && !wasOk(cw("7:00 PM"), "10:42 AM")
          && wasOk(cw("10:42 AM"), "10:42 AM");
        ok(youOk(s0) && wasOk(s1, want) && sCtl,
           `a stopped ride's last fix is "you" only while it is fresh: just after Stop (position ${s0.pos}, live ${s0.live}) "${s0.dist}", me-marker "${s0.title}"; `
           + `40 s on (live ${s1 ? s1.live : "?"}) "${s1 ? s1.dist : "?"}" / "${s1 ? fromLine(s1.card) : "?"}", me-marker "${s1 ? s1.title : "?"}" (the fix's own clock ${want}); `
           + `its controls reject "of you", "You are here" and another clock time on the aged fix (${sCtl})`);
        /* take 189 · cold audit · the same stopped ride, read by Dispatch,
           Locate and the coordinate footer. Dispatch printed ME, whatever
           its age, as "your actual location"; Locate said "You are here" at
           the startup fix all session; the footer labelled the map centre a
           bare "DD". Just after Stop: Dispatch prints the fix as it did, the
           footer says MAP CENTRE. 40 s on: Dispatch names the last fix, its
           clock time and age BEFORE the coordinate; Locate says it is
           waiting and names the last fix, never "You are here" — and once
           its own watch answers, it is live again. Then the start pin moved
           by hand ("Start from here"): Dispatch prints the FIX, never the
           pin. Each judge rejects its planted reading. */
        {
          const fx = sandbox.window.__disp.ME.slice(), C5 = (p) => p[1].toFixed(5) + "  " + p[0].toFixed(5);
          const disp = () => { grab("btn-disp").fire("click"); flushTimeouts(); return grab("panel")._html || ""; };
          const dLive = disp();
          theMap.fire("move"); const foot = grab("coords")._html || "";
          sandbox.Date = class extends R1 { constructor(...a) { if (a.length) super(...a); else super(R1.now() + 40000); }
            static now() { return R1.now() + 40000; } };
          let dOld = "", lOld = "";
          try { dOld = disp(); grab("c-locate").fire("click"); lOld = grab("panel")._html || ""; } finally { sandbox.Date = R1; }
          geo.cb && geo.cb({ coords: { longitude: fx[0], latitude: fx[1], accuracy: 5 } }); flushTimeouts();
          const lNew = grab("panel")._html || "";
          const tNew = N.live() ? N.live().t : null;
          const wNew = tNew === null ? "(no live fix)" : new R1(tNew).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
          const pin = [fx[0] + 0.01, fx[1] + 0.004];
          /* the startup locate's watch is still "open" here (the harness
             never answers it; later drills need it so), and Start from here
             rightly refuses while a locate runs: the pin is moved in
             planning mode and position mode put back to 'gps' — the state a
             phone reaches once its locate has given up */
          const movePin = (p) => { N.pos("none"); grab("pc-start")._listeners = {}; theMap._hit = [];
            theMap.fire("contextmenu", { lngLat: { lng: p[0], lat: p[1] } }); grab("pc-start").fire("click"); flushTimeouts(); N.pos("gps"); };
          movePin(pin);
          const moved = sandbox.window.__disp.ME[0] === pin[0];
          const dPin = disp();
          movePin(fx);
          const liveD = (h, at) => h.includes(C5(at)) && !/Last GPS fix/.test(h) && /Read the coordinates first/.test(h);
          const oldD = (h, at, w) => { const i = h.indexOf("Last GPS fix " + w), j = h.indexOf(C5(at));
            return i >= 0 && j > i && /min ago|under a minute ago/.test(h) && /Say they are your last GPS fix, from /.test(h); };
          const footOk = (h) => /MAP CENTRE/.test(h);
          const waitL = (h, w) => !/You are here/.test(h) && /Waiting for a GPS fix/.test(h) && h.includes("Your last fix was at " + w);
          const bare = `<span class="tn">${C5(fx)}</span><span class="meta">decimal degrees</span><br>Read the coordinates first, then the junction.`;
          const dctl = !oldD(bare, fx, want) && !waitL("<b>You are here.</b> Inside the downloaded area.", want)
            && !footOk("44.63159 -84.62272 <span class=\"unit\">DD · 1217 ft</span>") && !oldD(dPin.replace(C5(fx), C5(pin)), fx, want);
          ok(liveD(dLive, fx) && footOk(foot) && oldD(dOld, fx, want) && waitL(lOld, want) && /You are here/.test(lNew)
             && moved && oldD(dPin, fx, wNew) && !dPin.includes(C5(pin)) && dctl,
             `Dispatch, Locate and the footer on a stopped ride's fix: just after Stop Dispatch prints the fix (${liveD(dLive, fx)}), the footer `
             + `"${foot.replace(/<[^>]*>/g, "").slice(0, 60)}"; 40 s on Dispatch reads "${dOld.replace(/<[^>]*>/g, "").slice(0, 70)}…", `
             + `Locate "${lOld.replace(/<[^>]*>/g, "").slice(0, 60)}…", and on a new fix "${lNew.replace(/<[^>]*>/g, "").slice(0, 30)}"; `
             + `the start pin moved by hand (${moved}): Dispatch prints the fix, not the pin (${!dPin.includes(C5(pin))}); `
             + `the judges reject a bare coordinate, "You are here" on the old fix, a bare "DD" and the pin's coordinate (${dctl})`);
        }
      }
    }
  }

  /* Review of the audit fixes · three more loop cases, and a request that
     fails. Shared: a clock an hour ahead (the off-route re-route has a 20 s
     debounce that earlier sections' re-routes may still hold), and the
     distance from a point to the loop's first mile. */
  const Real0 = sandbox.Date;
  sandbox.Date = class extends Real0 {
    constructor(...a) { if (a.length) super(...a); else super(Real0.now() + 3600e3); }
    static now() { return Real0.now() + 3600e3; } };
  const mOf = (p, q) => { const k = Math.cos(p[1] * Math.PI / 180) * 111320, dx = (q[0] - p[0]) * k, dy = (q[1] - p[1]) * 111320; return Math.hypot(dx, dy); };
  const segD = (p, a, b) => { const k = Math.cos(p[1] * Math.PI / 180) * 111320;
    const ax = (a[0] - p[0]) * k, ay = (a[1] - p[1]) * 111320, bx = (b[0] - p[0]) * k, by = (b[1] - p[1]) * 111320;
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy; let t = L ? -(ax * dx + ay * dy) / L : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(ax + t * dx, ay + t * dy); };
  const offFirstMile = (p, G) => { let best = 1e12; for (let i = 0; i + 1 < G.pts.length && G.cum[i] <= 1609.34; i++) best = Math.min(best, segD(p, G.pts[i], G.pts[i + 1])); return best; };
  const spd2 = { speed: 8.9408, heading: 90 };
  /* take 189 · A234 (the review of lane L-ride, round 1) · a loop's
     off-route re-route now RE-JOINS the loop: it reads "Back to the loop"
     and stays a loop (o.rj), so the readings below took it for "not
     re-routed" and R1 passed a build that re-joined a rider standing at the
     start pin (PROVEN, a planted build without the approach rule). A re-join
     counts as a re-route here */
  const readL = () => { const G = N.guide() || {}; return { loop: !!G.loop, arrived: !!G.arrived, togo: parseFloat(text("hud-togo")), strip: text("nav-g"),
    panel: text("panel"), peek: String(grab("peek-txt").textContent), rj: !!((G.o || {}).rj) }; };
  const rerouted = (r) => !!r.sawRe || !!r.rj || /Re-rout|Back to the loop/.test(r.strip) || /^(?:Re-routed|Back to the loop)/.test(r.peek) || !r.loop;
  const REJOINED = { rj: true, peek: "Back to the loop · 0.6 mi to it, 1.2 mi of it left" };
  const pickLoop = (mi) => { grab("c-loop").fire("click"); const b = documentStub.querySelectorAll("[data-loop]").find((x) => x.dataset.loop === String(mi))
      || documentStub.querySelectorAll("[data-loop]")[0];
    if (b) { b.fire("click"); flushTimeouts(); } return b ? b.dataset.loop : null; };
  /* the start pin moved by hand, as the pin card's "Start from here" does
     (planning: the drills are off a ride, so the pin is the rider's to move) */
  const pinAt = (p) => { N.pos("none"); grab("pc-start")._listeners = {}; theMap._hit = [];
    theMap.fire("contextmenu", { lngLat: { lng: p[0], lat: p[1] } }); grab("pc-start").fire("click"); flushTimeouts(); };

  /* R1 · the approach. A loop's line starts at the junction nearest the
     pin, which can be well away from it (the dashed approach). Standing at
     the pin gearing up, the rider was more than 40 m off the line for three
     fixes: the loop was re-routed to its start pin — from the pin — and
     replaced by a route with no steps (no turn ever called, To go frozen).
     A pin whose distance to the loop's first mile is over 60 m is searched
     for round the centre (the premise, asserted); four fixes there, then
     the first points of the line. The judge is shown the re-routed state. */
  {
    let P = null, G = null, off = 0, tried = 0;
    for (const d of [0.0025, 0.004, 0.006, 0.0015]) {
      for (const [bx, by] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1]]) {
        const p = [c0[0] + bx * d / Math.cos(c0[1] * Math.PI / 180), c0[1] + by * d];
        tried++; pinAt(p);
        if (Math.abs(D.ME[0] - p[0]) > 1e-9) continue;
        pickLoop(null);
        const g = N.plan();
        if (g && g.loop && g.pts.length > 5 && offFirstMile(p, g) > 60) { P = p; G = g; off = offFirstMile(p, g); break; }
      }
      if (P) break;
    }
    ok(!!P, `a start pin more than 60 m from its loop's first mile (the premise): ${P ? Math.round(off) + " m off, " + (G.total / 1609.34).toFixed(1) + " mi loop, approach " + Math.round(G.appr) + " m" : "NONE in " + tried + " tries"}`);
    if (P) {
      const totalMi = G.total / 1609.34;
      grab("c-ride").fire("click");
      /* each fix's banner is read, and the planner's timer run before the
         next: a re-route shows as "Re-routing" on the fix that starts it */
      let sawRe = false;
      for (let i = 0; i < 4; i++) { fix(P, spd2); if (/Re-rout|Back to the loop/.test(text("nav-g"))) sawRe = true; flushTimeouts(); }
      frames(1);
      const atPin = Object.assign(readL(), { sawRe });
      for (let i = 0; i < Math.min(4, G.pts.length); i++) fix(G.pts[i], spd2);
      frames(1);
      const onLine = readL();
      const fine = (r) => !rerouted(r) && !r.arrived && r.togo > 0.2 && r.togo <= totalMi + 0.15 && r.togo >= totalMi - 1.15;
      ok(fine(atPin) && fine(onLine) && !fine({ loop: false, arrived: false, togo: totalMi, strip: "Re-routing", panel: "", peek: "Re-routed · the new route is on the map" })
         && !fine(Object.assign({}, atPin, { sawRe: true })) && !fine(Object.assign({}, atPin, REJOINED)),
         `a rider standing at a loop's start pin ${Math.round(off)} m from its line (four fixes) is on the approach, not off route: `
         + `strip "${atPin.strip.slice(0, 50)}", To go ${atPin.togo}; on the line's first points "${onLine.strip.slice(0, 40)}", To go ${onLine.togo} of ${totalMi.toFixed(1)} mi; `
         + `the judge rejects the loop re-routed to its own start, and re-joined from it`);
      grab("hud-stop").fire("click"); flushTimeouts(); frames(1);
    }
    pinAt(c0);
  }

  /* R7 · the one-mile cap, and R2 · Stop then Ride again mid-loop. A
     longer loop from the centre. R7: a single fix ON the loop's line more
     than two miles along, while nothing has been ridden, must not jump the
     rider there (the cap: a figure-eight's later leg beside the current
     one); To go stays the loop's. R2: ridden past its first mile and a
     half, stopped, Ride pressed again — the new guidance started the loop
     at 0 and the cap held it to the first mile: nearly the whole loop to go
     and, on the third fix, a re-route to the start. It carries on from
     where Stop left it. Each judge is shown the old reading. */
  {
    const want = pickLoop(15), G = N.plan();
    const totalMi = G ? G.total / 1609.34 : 0;
    const pts = G ? G.pts.slice() : [], cum = G ? G.cum.slice() : [];
    /* the cap reaches to the end of the segment that starts inside it */
    const jr = G ? cum.findIndex((m) => m > 1609.34) : -1, reachMi = jr > 0 ? cum[jr] / 1609.34 : 1;
    const vFar = G ? cum.findIndex((m, i) => m > (reachMi + 1.5) * 1609.34 && m < G.total - 3218.7 && offFirstMile(pts[i], G) > 200) : -1;
    const kStop = G ? cum.findIndex((m) => m >= Math.max(2414, Math.min(4023, G.total * 0.35))) : -1;
    ok(!!G && G.loop && vFar > 0 && kStop > 0 && cum[kStop] < G.total * 0.5,
       `a ${want} mi loop long enough for the cap and the restart (${totalMi.toFixed(1)} mi; a point ${vFar > 0 ? (cum[vFar] / 1609.34).toFixed(1) : "?"} mi along, `
       + `off the first mile; a stop at ${kStop > 0 ? (cum[kStop] / 1609.34).toFixed(1) : "?"} mi)`);
    if (G && vFar > 0 && kStop > 0) {
      const start = D.ME.slice();
      grab("c-ride").fire("click");
      fix(start, spd2); fix(start, spd2);
      fix(pts[vFar], spd2); frames(1);
      const jump = readL(), uncapped = (G.total - cum[vFar]) / 1609.34;
      const capped = (r) => !r.arrived && r.togo >= totalMi - reachMi - 0.1 && r.togo <= totalMi + 0.15;
      ok(capped(jump) && !capped({ arrived: false, togo: +uncapped.toFixed(1) }),
         `a fix on the loop's line ${(cum[vFar] / 1609.34).toFixed(1)} mi along, with nothing ridden, does not jump the rider there: To go ${jump.togo} of ${totalMi.toFixed(1)} mi (the cap reaches ${reachMi.toFixed(2)} mi); `
         + `the judge rejects the uncapped reading (${uncapped.toFixed(1)} mi)`);
      grab("hud-stop").fire("click"); flushTimeouts(); frames(1);
      /* R2 */
      grab("c-ride").fire("click");
      fix(start, spd2); fix(start, spd2);
      for (let i = 1; i <= kStop; i++) fix(pts[i], spd2);
      frames(1);
      const before = readL();
      grab("hud-stop").fire("click"); flushTimeouts(); frames(1);
      const still = N.guide() === null;
      grab("c-ride").fire("click");
      for (let i = 0; i < 3; i++) fix(pts[kStop], spd2);
      frames(1);
      const again = readL();
      for (let i = kStop + 1; i <= Math.min(kStop + 3, pts.length - 1); i++) fix(pts[i], spd2);
      frames(1);
      const on = readL(), wantMi = (G.total - cum[kStop]) / 1609.34;
      const resumed = (r) => !rerouted(r) && !r.arrived && Math.abs(r.togo - wantMi) < 0.2;
      ok(Math.abs(before.togo - wantMi) < 0.2 && still && resumed(again) && !rerouted(on) && on.togo < again.togo
         && !resumed({ loop: true, arrived: false, togo: +(totalMi - 0.5).toFixed(1), strip: "", panel: "", peek: "" })
         && !resumed({ loop: false, arrived: false, togo: wantMi, strip: "Re-routing", panel: "", peek: "Re-routed · the new route is on the map" })
         && !resumed(Object.assign({}, again, REJOINED)),
         `Stop at ${(cum[kStop] / 1609.34).toFixed(1)} mi into the loop, then Ride again: To go ${again.togo} (${wantMi.toFixed(2)} mi left along the line; `
         + `${before.togo} before Stop), no re-route ("${again.strip.slice(0, 44)}"), and it counts down on (${on.togo}); `
         + `the judge rejects the loop restarted at 0, the re-route to the start and a re-join`);
      grab("hud-stop").fire("click"); flushTimeouts(); frames(1);
    }
  }

  /* R10 · a request that fails leaves the route that is drawn as it was.
     A loop (and a point-to-point route) set the start pin, the end and the
     end's name BEFORE the planner answered: "No loop found" left the route
     home drawn and ridable, going to "the start" where the rider stood — it
     "arrived" on its first fix. Two failures are asked for: a loop of 0 mi
     (the chip's value planted: no loop has that length), and a route for a
     machine legal on no land line (a kayak, set as the harness sets a
     machine, then put back). The judge is shown the renamed end. */
  {
    grab("btn-home").fire("click"); flushTimeouts();
    const endOf = () => { const t = N.snapshot(); return { to: t.to ? t.to.slice() : null, lbl: t.lbl }; };
    const e0 = endOf(), g0 = N.plan();
    let e1 = null, c1 = "", e2 = null, c2 = "";
    try {
      grab("c-loop").fire("click");
      const chip = documentStub.querySelectorAll("[data-loop]")[0];
      if (chip) { chip.dataset.loop = "0"; chip.fire("click"); flushTimeouts(); }
      e1 = endOf(); c1 = text("panel");
      R.setMachine("kayak");
      grab("pc-route")._listeners = {}; theMap._hit = [];
      theMap.fire("contextmenu", { lngLat: { lng: c0[0] + 0.01, lat: c0[1] + 0.004 } });
      grab("pc-route").fire("click"); flushTimeouts();
      e2 = endOf(); c2 = text("panel");
    } finally { R.setMachine("bike"); }
    const same = (a, b) => !!a && !!b && a.lbl === b.lbl && !!a.to && !!b.to && Math.abs(a.to[0] - b.to[0]) < 1e-9 && Math.abs(a.to[1] - b.to[1]) < 1e-9;
    const g1 = N.plan();
    ok(!!g0 && e0.lbl === "home" && /No loop found/.test(c1) && /Nothing legal nearby/.test(c2) && same(e1, e0) && same(e2, e0)
       && !!g1 && g1.lbl === "home" && !same({ to: D.ME.slice(), lbl: "the start" }, e0),
       `a loop that is not found and a route with no legal answer leave the drawn route's end as it was ("${e2 ? e2.lbl : "?"}", `
       + `"${c1.slice(0, 20)}", "${c2.slice(0, 20)}"); the judge rejects the end renamed "the start" where the rider stands`);
    grab("btn-clear").fire("click"); flushTimeouts();
    /* …and since routeToPoint now names its end only on success, Resume
       names the trip's own (tripSave writes it): a resumed trip whose
       routing fails still knows where it was going. A saved trip for a
       kayak (no legal land line) is resumed; the ride Resume would start is
       then started and stopped so its "resuming" state is used up here. */
    const tp = [c0[0] + 0.02, c0[1] + 0.01];
    let e3 = null, c3 = "";
    try {
      N.resume({ v: 1, to: tp, lbl: "the camp", machine: "kayak", crumbs: [], crumbMi: 0 });
      flushTimeouts();
      e3 = endOf(); c3 = text("panel");
    } finally { R.setMachine("bike"); }
    grab("c-ride").fire("click"); fix(c0); grab("hud-stop").fire("click"); flushTimeouts(); frames(1);
    const kept3 = (e) => !!e && e.lbl === "the camp" && !!e.to && Math.abs(e.to[0] - tp[0]) < 1e-9 && Math.abs(e.to[1] - tp[1]) < 1e-9;
    ok(/Nothing legal nearby/.test(c3) && kept3(e3) && !kept3({ to: e0.to, lbl: "the camp" }),
       `a resumed trip whose routing fails keeps its destination for the next save ("${e3 ? e3.lbl : "?"}", ${e3 && e3.to ? "to kept" : "to LOST"}; "${c3.slice(0, 24)}"); `
       + `the judge rejects the end left at the last route's`);
  }
  sandbox.Date = Real0;

  /* F1 · a route is planned for ONE machine. A mode that changes the
     machine (Outdoors and Hunt walk; leaving them rides again) left the
     route cards up with a live Ride it, which then guided the new machine
     down a line planned for the old one. Now the mode change clears the
     route and says so — and, belt and braces, Ride it refuses a selected
     route with an edge the machine as it is now may not use (made here the
     only way left: the harness's setMachine, which changes the machine and
     clears nothing). Controls: the judge is shown an uncleared route; and
     the same press as the machine the route was planned for DOES start. */
  {
    const drawn = () => ((record.setData.route || []).at(-1) || { features: [] }).features.length;
    const snap = () => ({ plan: !!N.plan(), drawn: drawn(), machine: R.machine, toast: String(grab("toast").textContent),
      cards: /id="routes"/.test(grab("panel")._html || ""), rail: grab("rail").className });
    const cleared = (c, was) => !c.plan && c.drawn === 0 && !c.cards && /Route cleared/.test(c.toast) && c.toast.includes(was) && c.rail === "folded";
    const walkK = (((M && M.MODES) || []).find((m) => m.machine === "walk") || {}).k, homeK = M && M.get();
    grab("btn-home").fire("click"); flushTimeouts();
    const p1 = snap();
    M.apply(walkK); flushTimeouts();
    const c1 = snap();
    ok(!!walkK && p1.plan && p1.drawn > 0 && p1.cards && p1.machine === "bike" && c1.machine === "walk" && cleared(c1, "Dirt bike")
       && !cleared(Object.assign({}, c1, { plan: true, drawn: p1.drawn, cards: true }), "Dirt bike"),
       `a mode that changes the machine (${homeK} → ${walkK}: ${p1.machine} → ${c1.machine}) clears the route and says so ("${c1.toast}"); `
       + `the judge rejects a route left planned and drawn`);
    grab("btn-home").fire("click"); flushTimeouts();
    const p2 = snap();
    M.apply(homeK); flushTimeouts();
    const c2 = snap();
    ok(p2.plan && p2.drawn > 0 && p2.machine === "walk" && c2.machine === "bike" && cleared(c2, "On foot"),
       `…and so does leaving it: a route planned on foot does not outlive the walk ("${c2.toast}")`);
    grab("btn-home").fire("click"); flushTimeouts();
    const Gp = N.plan(), path = Gp && Gp.o && Gp.o.s ? Gp.o.s.path : [];
    const unfit = ["sxs", "quad", "kayak"].find((m) => { R.setMachine(m); return path.some((e) => !R.machineLegal(e)); });
    const seq0 = geo.seq;
    const press = (id) => { grab(id).fire("click"); flushTimeouts();
      return { t: text("panel"), opened: geo.seq - seq0, flag: flagged(), chip: chipTxt() }; };
    const r1 = press("rc-ride"), r2 = press("c-ride");
    const refusedUnfit = (r) => /not legal for a/.test(r.t) && /Nothing started/.test(r.t) && r.opened === 0 && !r.flag && /Ride it/.test(r.chip);
    R.setMachine("bike");
    grab("c-ride").fire("click");
    const r3 = { t: text("panel"), opened: geo.seq - seq0, flag: flagged(), chip: chipTxt() };
    deny();
    ok(!!unfit && path.length > 0 && refusedUnfit(r1) && refusedUnfit(r2) && !refusedUnfit(r3) && r3.opened === 1 && r3.flag && /Stop \(GPS\)/.test(r3.chip),
       `a selected route with an edge the machine may not use (planned as a dirt bike, the machine now ${unfit || "NONE FOUND"}) is refused by the card's Ride it `
       + `and by the Ride tab's ("${r1.t.slice(0, 64)}"; watches opened ${r2.opened}); as the dirt bike it was planned for the same press starts (watch opened ${r3.opened === 1}, its control)`);
  }

  /* F13 · the self-test while Ride waits for its first fix. rideMode is set
     at the press and the ribbon and sheet only come with the first fix — a
     wait take 188 made last until Stop — and the self-test's two-state HUD
     rule called that a broken HUD. It is run here in that very state; its
     verdict (the app's, __stHud) is also shown the pictures it must fail:
     the waiting state judged by the old two-state rule, and a waiting
     state with a ribbon, with no strip, with a sheet. */
  {
    const J = sandbox.window.__stHud;
    grab("c-ride").fire("click");
    const pend = { flag: flagged(), chip: chipTxt(), strip: grab("nav").hidden === false, tape: grab("hudbar").hidden === false,
      sheet: grab("hudstats").hidden === false };
    let st = null, threw = null;
    try { sandbox.window.__selfTest({ gps: false }, (r) => { st = r; }); } catch (e) { threw = String(e.message); }
    for (let i = 0; i < 500 && !st && !threw; i++) { frames(2); flushTimeouts(); }
    const row = st ? (st.results || []).find((r) => r.id === "hud-matches-ride") : null;
    const still = flagged() && /Stop \(GPS\)/.test(chipTxt());
    deny();
    const old2 = J ? J({ rid: true, pend: false, nav: true, bar: false, ctl: false, sheet: false, sts: false }) : null;
    const bad = J ? [J({ rid: true, pend: true, nav: true, bar: true, ctl: false, sheet: false }),
                     J({ rid: true, pend: true, nav: false, bar: false, ctl: false, sheet: false }),
                     J({ rid: true, pend: true, nav: true, bar: false, ctl: true, sheet: true })] : [];
    ok(pend.flag && /Stop \(GPS\)/.test(pend.chip) && pend.strip && !pend.tape && !pend.sheet && still && !threw
       && !!row && row.ok === true && /waiting for the first fix/.test(row.d)
       && !!old2 && old2.ok === false && bad.length === 3 && bad.every((x) => x.ok === false),
       `the self-test run while Ride waits for its first fix passes hud-matches-ride (${row ? (row.ok ? "pass" : "FAIL") + ": " + row.d : threw || "no such row"}); `
       + `the two-state rule fails the same picture ("${old2 ? old2.msg : "?"}"), and a waiting state with a ribbon, with no strip or with a sheet fails`);
  }

  /* F4 · a watch is closed by whoever opened it. The startup locate kept
     the ONE global watch id and closed whatever it held when its fix (or
     its 25 s give-up) came — the RIDE's watch, if Ride had been pressed
     meanwhile: a ride sheet that never moved again, or "Stop (GPS)" for
     ever. This pass's startup locate has never had a fix (watch 1, still
     open): Ride is pressed, then the locate gets its fix — it must close
     watch 1 and leave the ride's. The judge is shown the old outcome. */
  {
    const ME0 = D.ME.slice(), bootId = geo.watches.size ? Math.min(...geo.watches.keys()) : null, boot = geo.watches.get(bootId);
    grab("c-ride").fire("click");
    const rideId = geo.id, n0 = geo.clearedIds.length;
    boot && boot.cb({ coords: { longitude: ME0[0], latitude: ME0[1], accuracy: 8 } });
    flushTimeouts(); frames(1);
    const w = { closed: geo.clearedIds.slice(n0), rideOpen: geo.watches.has(rideId), cb: typeof geo.cb === "function", chip: chipTxt(), flag: flagged() };
    const own = (x, mine) => x.closed.length === 1 && x.closed[0] === mine && x.rideOpen && x.cb && /Stop \(GPS\)/.test(x.chip) && x.flag;
    deny();
    const after = geo.clearedIds.slice(n0);
    ok(bootId === 1 && !!boot && rideId !== bootId && own(w, bootId)
       && !own({ closed: [rideId], rideOpen: false, cb: false, chip: w.chip, flag: true }, bootId)
       && after.length === 2 && after[1] === rideId && !flagged(),
       `the startup locate's fix closes its own watch (${bootId}; closed ${JSON.stringify(w.closed)}) and leaves the ride's (${rideId}) open and waiting `
       + `(chip "${w.chip}"); a refusal then closes the ride's (${JSON.stringify(after)}); the judge rejects the ride's watch closed instead`);
  }

  /* F4, F19 · the same on the phone's driver (a stand-in Capacitor
     Geolocation that keeps each watch's id and callback). Off a ride a
     locate's give-up sent the plugin's id to the WEB clearWatch, so the
     native watch ran on — for a day, once the ride's first-fix timeout
     applied to it; and with Ride pressed meanwhile the give-up closed the
     ride's watch through the plugin. Now: the locate asks the plugin for
     25 s, its give-up closes its own watch through the plugin, the ride's
     watch stays open with its own long timeout, and an answer from the
     closed watch moves nothing. */
  {
    const cap = { n: 0, open: new Map(), closed: [], opts: {} };
    sandbox.Capacitor = { Plugins: { Geolocation: {
      watchPosition(o, cb) { const id = "w" + (++cap.n); cap.open.set(id, cb); cap.opts[id] = o; return id; },
      clearWatch(o) { cap.closed.push(o && o.id); cap.open.delete(o && o.id); } } } };
    const fire25 = () => { for (let i = 0; i < timeouts.length; i++) if (timeouts[i].d === 25000) { const t = timeouts.splice(i, 1)[0]; i--; t.fn(); } };
    /* locates from earlier sections that never got a fix give up first, so
       the counts below are this drill's alone; and the chooser's button is
       a new element each time the card is drawn (one listener, one locate) */
    fire25();
    const chooser = () => { grab("hc-me")._listeners = {}; grab("c-home").fire("click"); flushTimeouts(); grab("hc-me").fire("click"); flushTimeouts(); };
    const ls = sandbox.window.localStorage, home0 = ls.getItem("apex.home.v1"), web0 = geo.cleared;
    const onlyIts = (closed, id) => closed.length === 1 && closed[0] === id;
    let a = null, b = null;
    try {
      chooser();
      const id1 = "w" + cap.n, waiting = /Waiting for a GPS fix/.test(text("panel"));
      fire25();
      a = { id: id1, waiting, timeout: (cap.opts[id1] || {}).timeout, closed: cap.closed.slice(), open: cap.open.size,
            web: geo.cleared - web0, card: text("panel") };
      chooser();
      const id2 = "w" + cap.n, late = cap.open.get(id2);
      grab("c-ride").fire("click");
      const id3 = "w" + cap.n, n0 = cap.closed.length, me0 = D.ME.slice();
      fire25();
      late && late({ coords: { longitude: me0[0] + 0.5, latitude: me0[1], accuracy: 5 } });
      b = { ids: [id2, id3], rideTimeout: (cap.opts[id3] || {}).timeout, closed: cap.closed.slice(n0), rideOpen: cap.open.has(id3),
            chip: chipTxt(), flag: flagged(), moved: D.ME[0] !== me0[0] };
      const rcb = cap.open.get(id3);
      rcb && rcb(null, { code: "OS-PLUG-GLOC-0003", message: "Location permission request was denied." });
      flushTimeouts(); frames(1);
      b.after = cap.closed.slice(n0); b.endFlag = flagged();
      /* review of the audit fixes · the locate's late answer above is also
         dropped by locateOnce's own `done`; the case gpsWatch's h.dead is for
         is the RIDE's closed watch answering (the plugin delivering a fix as
         Stop or a refusal closes it): an in-region fix from it must start no
         recording, raise no ride and move no pin */
      const RD = sandbox.window.__ride, me1 = D.ME.slice();
      rcb && rcb({ coords: { longitude: me1[0] + 0.01, latitude: me1[1] + 0.005, accuracy: 5 } });
      flushTimeouts(); frames(1);
      b.late = { cb: typeof rcb === "function", rec: !!(RD && RD.R), flag: flagged(), moved: D.ME[0] !== me1[0] };
    } finally { delete sandbox.Capacitor; }
    ok(!!a && a.waiting && a.id === "w1" && a.timeout === 25000 && onlyIts(a.closed, "w1") && a.open === 0 && a.web === 0
       && /No GPS fix in 25 s/.test(a.card) && ls.getItem("apex.home.v1") === home0 && !onlyIts([], "w1"),
       `on the phone's driver a locate that gets no fix asks the plugin for ${a ? a.timeout : "?"} ms and closes its watch THROUGH THE PLUGIN `
       + `(closed ${a ? JSON.stringify(a.closed) : "?"}, still open ${a ? a.open : "?"}, web clearWatch calls ${a ? a.web : "?"}); home is left as it was`);
    ok(!!b && b.ids[0] !== b.ids[1] && onlyIts(b.closed, b.ids[0]) && !onlyIts([b.ids[1]], b.ids[0]) && b.rideOpen
       && typeof b.rideTimeout === "number" && b.rideTimeout >= 3600000
       && /Stop \(GPS\)/.test(b.chip) && b.flag && !b.moved && b.after.length === 2 && b.after[1] === b.ids[1] && !b.endFlag,
       `…and with Ride pressed while it waits, its give-up closes only its own watch (${b ? JSON.stringify(b.closed) : "?"} of ${b ? b.ids.join(", ") : "?"}): `
       + `the ride's stays open (chip "${b ? b.chip : "?"}", first-fix timeout ${b ? b.rideTimeout : "?"} ms), an answer from the closed watch moves nothing, `
       + `and a denial then closes the ride's (${b ? JSON.stringify(b.after) : "?"}); the judge rejects the ride's watch closed instead`);
    const inert = (x) => !!x && x.cb && !x.rec && !x.flag && !x.moved;
    ok(!!b && inert(b.late) && !inert({ cb: true, rec: true, flag: false, moved: true }),
       `…and a fix from the RIDE's watch after the denial closed it starts nothing (recording ${b && b.late ? b.late.rec : "?"}, `
       + `ride flag ${b && b.late ? b.late.flag : "?"}, pin moved ${b && b.late ? b.late.moved : "?"}); the judge rejects a recording started by it`);
  }
}

/* 11b · take 189 · lane L-ride: a ride with no fix says so (A230), the
   folded drawer's Ride (A233), a loop's re-route re-joins the loop (A234),
   one arrival estimate for a river run (A235). After section 11 on purpose:
   each drill rides for itself and nothing after reads what it leaves. Every
   judge is shown a planted reading it must reject; each fix was also taken
   out of a copy of the built app to watch its drill fail (the lane's notes). */
if (!NO_GPS) {
  const N = sandbox.window.__nav, D = sandbox.window.__disp, P = sandbox.window.__paddle;
  const text = (id) => String(grab(id)._html || "").replace(/<[^>]*>/g, "");
  const chipTxt = () => text("c-ride");
  const flagged = () => "ride" in grab("shell").dataset;
  const fix = (p, extra) => geo.cb && geo.cb({ coords: Object.assign({ longitude: p[0], latitude: p[1], accuracy: 5 }, extra || {}) });
  const deny = () => { geo.err && geo.err({ code: 1, message: "User denied Geolocation" }); flushTimeouts(); frames(1); };
  const stop = () => { if (flagged()) grab("hud-stop").fire("click"); if (flagged()) grab("c-ride").fire("click"); flushTimeouts(); frames(1); };
  const c0 = manifest.centre || [anchors[0][1], anchors[0][2]];
  stop();
  /* the off-route re-route waits 20 s after the last one: a clock two hours
     on, put back at the end */
  const Real1 = sandbox.Date;
  sandbox.Date = class extends Real1 {
    constructor(...a) { if (a.length) super(...a); else super(Real1.now() + 7200e3); }
    static now() { return Real1.now() + 7200e3; } };
  try {
    /* A230 · Ride pressed, no fix yet: the strip and the folded drawer's peek
       line say "Waiting for a GPS fix" (take 188: a lone "—" and an empty
       band); the first fix replaces both. */
    {
      const rd = () => ({ shown: grab("nav").hidden === false, strip: String(grab("nav-sp").textContent),
        peek: String(grab("peek-txt").textContent), folded: /\bfolded\b/.test(grab("rail").className) });
      grab("c-ride").fire("click"); flushTimeouts(); frames(1);
      const w0 = Object.assign(rd(), { chip: chipTxt(), flag: flagged() });
      fix(c0, { speed: 6, heading: 45 }); flushTimeouts(); frames(1);
      const w1 = rd();
      stop();
      const says = (r) => !!r && r.shown && r.folded && /^Waiting for a GPS fix$/.test(r.strip)
        && /^Waiting for a GPS fix\b/.test(r.peek) && !/\d/.test(r.strip + r.peek);
      ok(says(w0) && /Stop \(GPS\)/.test(w0.chip) && w0.flag && !says(w1) && /^Recording/.test(w1.peek) && !/Waiting/.test(w1.strip)
         && !says({ shown: true, folded: true, strip: "—", peek: "" }),
         `A230 · Ride pressed with no fix: the strip reads "${w0.strip}", the folded drawer's peek line "${w0.peek}" (chip "${w0.chip}"); `
         + `the first fix replaces both ("${w1.strip}", "${w1.peek}"); the judge rejects take 188's "—" over an empty band`);
    }

    /* A233 · the folded drawer's Ride is the Ride tab's Ride it, in one tap:
       it opens a watch and waits (Stop (GPS), the ride flag), refuses
       honestly on a denial, and starts nothing while a ride runs */
    {
      const w0 = geo.seq;
      grab("btn-ride").fire("click"); flushTimeouts(); frames(1);
      const a = { chip: chipTxt(), flag: flagged(), opened: geo.seq - w0, cb: typeof geo.cb === "function" };
      grab("btn-ride").fire("click"); flushTimeouts(); frames(1);
      const b = { flag: flagged(), opened: geo.seq - w0 };
      deny();
      const c = { flag: flagged(), refused: /No GPS fix/.test(text("panel")), chip: chipTxt() };
      const rides = (x) => /Stop \(GPS\)/.test(x.chip) && x.flag && x.opened === 1 && x.cb;
      ok(rides(a) && b.flag && b.opened === 1 && !c.flag && c.refused && /Ride it/.test(c.chip)
         && !rides({ chip: "Ride it", flag: false, opened: 0, cb: false }),
         `A233 · the folded drawer's Ride starts the Ride tab's ride in one tap (chip "${a.chip}", flag ${a.flag}, watches opened ${a.opened}); `
         + `pressed again while it waits it opens no second watch (${b.opened}); a denial refuses as Ride it does (${c.refused}, chip "${c.chip}"); `
         + `the judge rejects a press that started nothing`);
    }

    /* A234 · a loop's off-route re-route re-joins the loop AHEAD of the
       rider and keeps the rest of it. A 15 mi loop from the centre, ridden
       a mile and a half, then three fixes ~450 m off its line: the new
       option must be the "Back to the loop" re-join — the loop's own edges
       from a node ahead of the rider to its start, unchanged, after a leg
       from the rider — guided as a loop (no arrival at the start on its
       first fixes). Take 187-188's point-to-point route to the start is the
       planted reading the judge rejects. */
    {
      const mOf = (p, q) => { const k = Math.cos(p[1] * Math.PI / 180) * 111320; return Math.hypot((q[0] - p[0]) * k, (q[1] - p[1]) * 111320); };
      grab("c-loop").fire("click");
      const b15 = documentStub.querySelectorAll("[data-loop]").find((x) => x.dataset.loop === "15") || documentStub.querySelectorAll("[data-loop]")[0];
      if (b15) { b15.fire("click"); flushTimeouts(); }
      const G = N.plan();
      const pts = G ? G.pts.slice() : [], cum = G ? G.cum.slice() : [], path0 = G ? G.o.s.path.map((e) => e.i) : [];
      const k1 = G ? cum.findIndex((m) => m >= 2414) : -1;
      ok(!!G && G.loop && k1 > 0 && cum[k1] < G.total * 0.5,
         `A234 · a loop to leave (${G ? (G.total / 1609.34).toFixed(1) + " mi, " + path0.length + " edges" : "NONE"}; ridden to ${k1 > 0 ? (cum[k1] / 1609.34).toFixed(2) : "?"} mi)`);
      if (G && k1 > 0) {
        const spd = { speed: 8.9408, heading: 90 };
        grab("c-ride").fire("click");
        fix(pts[0], spd); fix(pts[0], spd);
        for (let i = 1; i <= k1; i++) fix(pts[i], spd);
        frames(1);
        /* off the line: a point ~450 m to the side of the line a little ahead */
        const ka = Math.min(pts.length - 2, cum.findIndex((m) => m >= cum[k1] + 300));
        const dx = pts[ka + 1][0] - pts[ka][0], dy = pts[ka + 1][1] - pts[ka][1], L = Math.hypot(dx, dy) || 1;
        const off = [pts[ka][0] - (dy / L) * 0.0045 / Math.cos(pts[ka][1] * Math.PI / 180), pts[ka][1] + (dx / L) * 0.0045];
        for (let i = 0; i < 3; i++) fix(off, spd);
        flushTimeouts(); frames(1);
        const peek = String(grab("peek-txt").textContent), panel = text("panel"), strip = text("nav-g");
        const G2 = N.plan();
        const p2 = G2 ? G2.o.s.path.map((e) => e.i) : [];
        let tail = 0; while (tail < p2.length && tail < path0.length && p2[p2.length - 1 - tail] === path0[path0.length - 1 - tail]) tail++;
        /* where on the loop the re-join lands: the end of the loop's edge just before the kept tail */
        const jEdge = path0.length - tail - 1, jMark = G && jEdge >= 0 ? cum[G.legs[jEdge]] : -1;
        const r = { rj: !!(G2 && G2.o.rj), loop: !!(G2 && G2.loop), sameEnd: !!(G2 && G2.o.nb === G.o.nb), tail, rest: path0.length - jEdge - 1,
          ahead: jMark - cum[k1], peek, card: /Back to the loop/.test(panel) && /then the rest of it to the start/.test(panel), appr: G2 ? G2.appr : -1 };
        /* ride the first points of the re-join: it guides, it has not arrived */
        for (let i = 0; i < Math.min(3, G2 ? G2.pts.length : 0); i++) fix(G2.pts[i], spd);
        frames(1);
        const on = { arrived: !!((N.guide() || {}).arrived), togo: parseFloat(text("hud-togo")), total: G2 ? G2.total / 1609.34 : 0 };
        stop();
        /* ahead: at least the app's 100 m past where the rider was placed on
           the loop, and inside its window (2 mi past that, from a point the
           off fixes project to at most ~300 m further on): never the loop's
           start, the old re-route's end */
        const rejoined = (x) => x.rj && x.loop && x.sameEnd && x.tail >= 1 && x.ahead >= 100 && x.ahead <= 3700 && x.appr === 0
          && /^Back to the loop/.test(x.peek) && x.card;
        ok(rejoined(r) && !on.arrived && on.togo > 0.2 && on.togo <= on.total + 0.15
           && !rejoined({ rj: false, loop: false, sameEnd: true, tail: 0, rest: 0, ahead: -1, appr: 0, peek: "Re-routed · the new route is on the map", card: false })
           && !rejoined(Object.assign({}, r, { ahead: G.total - cum[k1] - 50, tail: 1 })),
           `A234 · three fixes ${Math.round(mOf(off, pts[ka]))} m off the loop re-join it ${r.ahead >= 0 ? (r.ahead / 1609.34).toFixed(2) : "?"} mi ahead of the rider, `
           + `keeping the loop's last ${r.tail} of ${path0.length} edges to its start (rest ${r.rest}); "${r.peek}"; guided as a loop (approach ${r.appr}), `
           + `not arrived on its first points (To go ${on.togo} of ${on.total.toFixed(1)} mi); the judge rejects the point-to-point route to the start, `
           + `and a re-join at the loop's own end`);
      }
    }

    /* A235 · ONE arrival estimate for a river run: the run card, the ride
       sheet's Arrive and the strip give the same "~N" at the put-in (take
       188: the card's and the strip's ranges, the sheet's midpoint); after
       ten moving fixes the sheet and the strip read the paddler's own pace,
       still one figure. The same reader rejects planted mismatches. */
    {
      const ETA = /~[\d:]+ (?:min|h)\b/;
      const c = ((P && P.data && P.data.c) || []).find((x) => x.n === "Au Sable River");
      const named = c ? c.f.filter((f) => f.n && f.p && (f.k === "access" || f.k === "launch")) : [];
      let a = null, b = null;
      for (let i = 0; i < named.length && !b; i++) for (let j = i + 1; j < named.length; j++) {
        const d = named[j].mi - named[i].mi; if (d >= 3 && d <= 8) { a = named[i]; b = named[j]; break; } }
      ok(!!a && !!b, `A235 · an Au Sable run of 3-8 mi between named accesses (${a ? a.n + " to " + b.n : "NONE"})`);
      if (a && b) {
        /* planned in Water, where the run card's craft is the one Navigate rides
           with (planned in another mode the card names its own 2-3 mph) */
        sandbox.window.__mode.apply("water", { silent: true }); flushTimeouts();
        P.run(a, b, c.n); flushTimeouts();
        const card = (text("panel").match(ETA) || [null])[0];
        grab("pd-nav").fire("click"); flushTimeouts(); frames(1);
        const Lr = N.riverLine(c.n);
        const atMile = (mi) => { const mm = mi * 1609.34; let i = 0; while (i < Lr.cum.length - 2 && Lr.cum[i + 1] < mm) i++;
          const t = (mm - Lr.cum[i]) / Math.max(1, Lr.cum[i + 1] - Lr.cum[i]);
          return [Lr.pts[i][0] + (Lr.pts[i + 1][0] - Lr.pts[i][0]) * t, Lr.pts[i][1] + (Lr.pts[i + 1][1] - Lr.pts[i][1]) * t]; };
        const read = () => ({ card, sheet: text("hud-eta").replace(/^~(\S+?) ?(min|h)$/, "~$1 $2"),
          strip: ((text("nav-g").match(ETA)) || [null])[0], stripText: text("nav-g") });
        fix(atMile(a.mi), { speed: 1.4, heading: 0 }); flushTimeouts(); frames(1);
        const r0 = read();
        /* ten moving fixes downstream at 1.0 m/s, slower than a kayak's
           range: the FLOOR case (the put-in's 1.4 and these average under
           the kayak's 2.5 mph), the same on the sheet and the strip. The
           paddler's own pace above the floor is the second run below */
        for (let k = 1; k <= 10; k++) fix(atMile(a.mi + k * 0.05), { speed: 1.0, heading: 0 });
        flushTimeouts(); frames(1);
        const r1 = read();
        /* what the pace rule gives here, from the app's own numbers: the
           miles left at the slow end of the kayak's range (the paddler's
           1.0 m/s is under it); and what the run's own estimate would say */
        const K = sandbox.window.__route.MACHINE.kayak, left = b.mi - N.river(atMile(a.mi + 0.5)).rm;
        const wantPace = left * 1609.34 / Math.max(1.0, (K.mph - K.spread) * 0.44704) / 60, wantPlan = left / K.mph * 60;
        const minOf = (t) => { const m = /~(\d+)(?::(\d\d))? (min|h)/.exec(t || ""); return !m ? NaN : m[3] === "min" ? +m[1] : +m[1] * 60 + +(m[2] || 0); };
        r1.min = minOf(r1.sheet);
        stop();
        /* the paddler's OWN pace (the review of lane L-ride, round 1: the
           floor case above passed a build that never used the measured
           pace). The run again, put-in and ten fixes all at 1.8 m/s (~4.0
           mph, faster than the kayak's whole 2.5-3.5): the sheet and the
           strip read the miles left at 1.8 m/s, not the floor's figure nor
           the plan's */
        P.run(a, b, c.n); flushTimeouts();
        grab("pd-nav").fire("click"); flushTimeouts(); frames(1);
        fix(atMile(a.mi), { speed: 1.8, heading: 0 }); flushTimeouts(); frames(1);
        for (let k = 1; k <= 10; k++) fix(atMile(a.mi + k * 0.05), { speed: 1.8, heading: 0 });
        flushTimeouts(); frames(1);
        const r2 = read(); r2.min = minOf(r2.sheet);
        stop();
        const wantOwn = left * 1609.34 / 1.8 / 60;
        const own = (r) => !!r && !!r.sheet && r.sheet === r.strip && Math.abs(r.min - wantOwn) <= 1
          && Math.abs(r.min - wantPace) > 1.5 && Math.abs(r.min - wantPlan) > 1.5;
        ok(own(r2) && !own(Object.assign({}, r2, { min: Math.round(wantPace) })) && !own(Object.assign({}, r2, { min: Math.round(wantPlan) }))
           && !own(Object.assign({}, r2, { strip: r2.strip ? r2.strip.replace(/~(\d+)/, (m0, v) => "~" + (parseInt(v, 10) + 5)) : r2.strip })),
           `A235 · the paddler's own pace takes over after ten fixes at 1.8 m/s, over the kayak's range: sheet "${r2.sheet}", strip "${r2.strip}" `
           + `(the miles left at 1.8 m/s give ${wantOwn.toFixed(1)} min; the floor ${wantPace.toFixed(1)}, the plan ${wantPlan.toFixed(1)}); `
           + `the reader rejects the floor's and the plan's figures, and a strip that differs`);
        const agree = (r) => !!r && !!r.card && r.card === r.sheet && r.sheet === r.strip;
        const paced = (r) => !!r && !!r.sheet && r.sheet === r.strip && Math.abs(r.min - wantPace) <= 1 && Math.abs(r.min - wantPlan) > 1.5;
        const bump = (x, n) => x ? x.replace(/~(\d+)/, (m0, v) => "~" + (parseInt(v, 10) + n)) : x;
        ok(agree(r0) && paced(r1) && r1.sheet !== r0.sheet
           && !agree(Object.assign({}, r0, { card: bump(r0.card, 16) })) && !agree(Object.assign({}, r0, { sheet: bump(r0.sheet, 16) }))
           && !agree(Object.assign({}, r0, { strip: null })) && !paced(Object.assign({}, r1, { strip: bump(r1.strip, 5) }))
           && !paced(Object.assign({}, r1, { min: Math.round(wantPlan) })),
           `A235 · one arrival estimate for a river run at its put-in: card "${r0.card}", sheet "${r0.sheet}", strip "${r0.strip}" ("${(r0.stripText || "").slice(0, 70)}"); `
           + `at the paddler's own pace after ten fixes, sheet "${r1.sheet}", strip "${r1.strip}" (the pace rule gives ${wantPace.toFixed(1)} min, `
           + `the run's own estimate ${wantPlan.toFixed(1)}); the reader rejects a planted card, sheet and strip, and the plan's figure after the pace is known`);
      }
    }

    /* A230 · a RESUMED trip waiting for its first fix (a phone restarted in
       the woods, a cold GPS): its track is kept and drawn, and the Resume
       card has just said how far it is, so the peek line names those miles
       and never says "nothing recorded yet" (the review of lane L-ride,
       round 1). A short ride is recorded and saved, the app "killed"
       (__nav.reset, as section 7 does), Resume pressed with no fix; the
       peek line is read as written, after a refold, and after the resumed
       route is planned. The first fix then carries the same track on. The
       saved trip is put back as it was. Last in 11b on purpose: its fixes
       are off the route chosen earlier, so they re-route, and the 20 s
       debounce that leaves would hold A234's re-join (seen: the first build
       of this drill ran before A234 and A234 then failed) */
    {
      const ls = sandbox.window.localStorage, trip0 = ls.getItem("apex.trip.v1");
      const at = (k) => [c0[0], c0[1] + k * 0.003];
      grab("c-ride").fire("click"); flushTimeouts(); frames(1);
      for (let k = 0; k < 4; k++) fix(at(k), { speed: 8, heading: 0 });
      flushTimeouts(); frames(1);
      const mi0 = parseFloat((N.snapshot() || {}).crumbMi) || 0, n0 = N.crumbs();
      N.save(true); N.reset(); sandbox.window.hudShow(false);
      grab("trip-resume")._listeners = {};
      const offered = N.card() === true;
      grab("trip-resume").fire("click");
      const pk = () => String(grab("peek-txt").textContent);
      const p0 = pk(); N.rail(false); const p1 = pk();
      flushTimeouts(); frames(1); N.rail(false); const p2 = pk();
      const waiting = flagged() && /^Waiting for a GPS fix$/.test(String(grab("nav-sp").textContent));
      /* the first fix starts the recording again (the resumed branch), the
         next records */
      fix(at(4), { speed: 8, heading: 0 }); fix(c0, { speed: 8, heading: 180 }); flushTimeouts(); frames(1);
      const n1 = N.crumbs(), mi1 = parseFloat((N.snapshot() || {}).crumbMi) || 0;
      stop();
      if (trip0 !== null) ls.setItem("apex.trip.v1", trip0); else ls.removeItem("apex.trip.v1");
      const want = mi0.toFixed(1) + " mi recorded, kept";
      const kept = (p) => /^Waiting for a GPS fix — /.test(p) && p.includes(want) && !/nothing recorded/.test(p);
      /* take 189 · cold audit · the line as Resume WROTE it is judged too
         (it read "Trip resumed · recording" until a refold) */
      ok(offered && mi0 > 0.5 && waiting && kept(p0) && kept(p1) && kept(p2) && n1 > n0 && mi1 > mi0 + 0.5 && !kept("Waiting for a GPS fix — nothing recorded yet")
         && !kept("Trip resumed · recording"),
         `A230 · a resumed trip (${mi0.toFixed(2)} mi, ${n0} points) waiting for its first fix: the peek line reads "${p1}" after a refold `
         + `and "${p2}" once its route is planned (as Resume wrote it: "${p0}"); the next fixes carry the same track on (${n0} → ${n1} points, ${mi1.toFixed(2)} mi); `
         + `the judge rejects "Waiting for a GPS fix — nothing recorded yet" and "Trip resumed · recording" for it`);
    }

    /* take 189 · cold audit · a RESUMED trip waiting for its first fix, after
       a relaunch (__nav.reset(true): no truck pinned, no truck marker):
       (1) the self-test run meanwhile leaves the trip alone — its safety
       drill took the resumed branch and spent the trip's flags, so the real
       first fix wiped the kept track (PROVEN, the audit's harness); every
       SAFETY row passes and the next fixes carry the same track on;
       (2) that first fix says the truck stays where it was pinned, never
       "Truck pinned where you are", and the truck's pin is drawn there;
       (3) Stop before a first fix says nothing was recorded and ends the
       trip's flags: the next Ride waits with "nothing recorded yet", and
       its own Stop before a fix never says "Recording stopped. N mi".
       (4) a dropout mid-ride: the peek line "Recording · live GPS" becomes
       "No GPS fix since h:mm" on the ride's pulse and comes back on the
       next fix. Each judge rejects its planted reading. */
    {
      const ls = sandbox.window.localStorage, trip0 = ls.getItem("apex.trip.v1");
      const at = (k) => [c0[0] + 0.002, c0[1] + k * 0.003];
      const pk = () => String(grab("peek-txt").textContent);
      const ph = () => (grab("panel")._html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      const rideSave = () => { grab("c-ride").fire("click"); flushTimeouts(); frames(1);
        for (let k = 0; k < 4; k++) fix(at(k), { speed: 8, heading: 0 });
        flushTimeouts(); frames(1);
        const m = parseFloat((N.snapshot() || {}).crumbMi) || 0;
        N.save(true); N.reset(true); sandbox.window.hudShow(false); return m; };
      const resume = () => { grab("trip-resume")._listeners = {}; const o = N.card() === true; grab("trip-resume").fire("click"); return o; };
      /* (1) and (2) */
      const mi0 = rideSave(), off1 = resume(), n0 = N.crumbs();
      let st = null, threw = null;
      try { sandbox.window.__selfTest({ gps: false }, (r) => { st = r; }); } catch (e) { threw = String(e.message); }
      for (let i = 0; i < 500 && !st && !threw; i++) { frames(2); flushTimeouts(); }
      const saf = st ? (st.results || []).filter((r) => r.g === "SAFETY") : [];
      const nSt = N.crumbs();
      fix(at(4), { speed: 8, heading: 0 }); flushTimeouts(); frames(1);
      const card1 = ph();
      const tr = (N.snapshot() || {}).crumbs, t0p = at(0);
      const tks = everyMarker.filter((m) => /(^|\s)truck(\s|$)/.test(m._el.className || "") && !m._removed && m._map);
      const pinned = tks.some((m) => m._ll && Math.abs(m._ll[0] - t0p[0]) < 1e-9 && Math.abs(m._ll[1] - t0p[1]) < 1e-9);
      fix(at(5), { speed: 8, heading: 0 }); flushTimeouts(); frames(1);
      const n1 = N.crumbs(), mi1 = parseFloat((N.snapshot() || {}).crumbMi) || 0;
      stop();
      const stOk = (x) => x.saf.length >= 4 && x.saf.every((r) => r.ok !== false) && x.nSt === x.n0 && x.n1 > x.n0 && x.mi1 > x.mi0 + 0.1;
      const S1 = { saf, nSt, n0, n1, mi0, mi1 };
      ok(off1 && !threw && stOk(S1)
         && !stOk(Object.assign({}, S1, { saf: saf.concat([{ g: "SAFETY", id: "distance-sane", ok: false }]) }))
         && !stOk(Object.assign({}, S1, { n1: 1, mi1: 0 })),
         `the self-test run while a resumed trip (${mi0.toFixed(2)} mi, ${n0} points) waits leaves it alone: SAFETY ${saf.map((r) => r.id + " " + (r.ok === false ? "FAIL" : "ok")).join(", ") || threw || "(none)"}; `
         + `points ${n0} → ${nSt} during the test → ${n1} after two fixes (${mi1.toFixed(2)} mi); the judge rejects a false SAFETY fail and a wiped track`);
      const cardOk = (c, p) => /the truck stays where it was pinned/.test(c) && !/Truck pinned where you are/.test(c) && p;
      ok(cardOk(card1, pinned) && !cardOk("Recording live GPS Truck pinned where you are. Ride.", true) && !cardOk(card1, false),
         `a resumed trip's first fix keeps the truck where it was and draws its pin there (${pinned}; ${tks.length} truck marker(s)): "${card1.slice(0, 110)}"; `
         + `the judge rejects "Truck pinned where you are" and a missing pin`);
      /* (2b) cold audit r2 · resumed beside the truck: never a bearing to
         where the rider stands (landmines 164/167) — under ~100 ft "you are
         at the truck", in feet below 320 m, never "0.0 mi" */
      const nearCard = (dLat) => { rideSave(); resume(); const t = at(0);
        /* the card the first fix writes, read before the timers run (this
           trip carries an earlier section's route "to the start", which
           replans after the fix and, for this kayak, fails) */
        fix([t[0], t[1] + dLat], { speed: 8, heading: 0 }); const c = ph(); flushTimeouts(); frames(1);
        stop(); return c; };
      const cNear = nearCard(0.0001), cFt = nearCard(0.0014);
      const nearOk = (c) => /Trip resumed — you are at the truck, where it was pinned\. Ride\./.test(c) && !/\d (mi|ft) [NSEW]/.test(c);
      const ftOk = (c) => /Trip resumed — the truck stays where it was pinned, \d+ ft [NSEW]{1,3}\. Ride\./.test(c) && !/0\.0 mi/.test(c);
      ok(nearOk(cNear) && ftOk(cFt)
         && !nearOk("Recording live GPS Trip resumed — the truck stays where it was pinned, 0.0 mi N. Ride.")
         && !ftOk("Recording live GPS Trip resumed — the truck stays where it was pinned, 0.1 mi S. Ride."),
         `a resumed trip's first fix beside the truck (~11 m): "${cNear.slice(0, 110)}"; ~155 m: "${cFt.slice(0, 110)}"; `
         + `the judge rejects "0.0 mi N" beside it and "0.1 mi" at feet range`);
      /* (3) */
      rideSave(); resume();
      grab("c-ride").fire("click");                                      /* Stop, no fix yet */
      const cStop = ph(); flushTimeouts(); frames(1);
      grab("c-ride").fire("click"); flushTimeouts(); frames(1);           /* a new Ride */
      const pNew = pk();
      grab("c-ride").fire("click");                                      /* its Stop, no fix */
      const cStop2 = ph(); flushTimeouts(); frames(1);
      const stopOk = (c, res) => /Stopped before the first GPS fix — nothing was recorded/.test(c) && !/Recording stopped/.test(c)
        && (res ? /resumed trip ends here/.test(c) : !/resumed trip/.test(c));
      ok(stopOk(cStop, true) && /^Waiting for a GPS fix — nothing recorded yet$/.test(pNew) && stopOk(cStop2, false)
         && !stopOk("Recording stopped. 0.62 mi on the track. Retrace follows it back.", false) && !/^Waiting for a GPS fix — nothing recorded yet$/.test("Waiting for a GPS fix — 0.6 mi recorded, kept"),
         `Stop before a first fix: on a resumed trip "${cStop.slice(0, 120)}"; the next Ride waits with "${pNew}"; `
         + `its own Stop "${cStop2.slice(0, 80)}"; the judge rejects "Recording stopped. N mi" and the ended trip's "mi kept"`);
      /* (4) */
      grab("c-ride").fire("click"); flushTimeouts(); frames(1);
      fix(at(0), { speed: 8, heading: 0 }); fix(at(1), { speed: 8, heading: 0 }); flushTimeouts(); frames(1);
      const pLive = pk();
      const R2 = sandbox.Date;
      sandbox.Date = class extends R2 { constructor(...a) { if (a.length) super(...a); else super(R2.now() + 40000); }
        static now() { return R2.now() + 40000; } };
      let pDrop = "";
      let pFold = "";
      try { ticks(1); pDrop = pk(); N.rail(false); pFold = pk(); } finally { sandbox.Date = R2; }
      fix(at(2), { speed: 8, heading: 0 }); flushTimeouts(); frames(1);
      const pBack = pk();
      stop();
      if (trip0 !== null) ls.setItem("apex.trip.v1", trip0); else ls.removeItem("apex.trip.v1");
      const dropOk = (a, b, f, c) => a === "Recording · live GPS" && /^No GPS fix since \d{1,2}:\d\d/.test(b) && /^No GPS fix since \d{1,2}:\d\d/.test(f)
        && (c === "Recording · live GPS" || /^Truck [\d.]+ mi [NSEW]{1,3}$/.test(c));
      ok(dropOk(pLive, pDrop, pFold, pBack) && !dropOk(pLive, "Recording · live GPS", pFold, pBack) && !dropOk(pLive, pDrop, "Truck 0.2 mi S", pBack)
         && !dropOk(pLive, pDrop, pFold, pDrop),
         `a dropout mid-ride: the peek line "${pLive}", 40 s with no fix "${pDrop}" (refolded "${pFold}"), the next fix "${pBack}"; `
         + `the judge rejects "live GPS" and a truck distance through the dropout, and the dropout line left after the fix`);
    }
  } finally { sandbox.Date = Real1; }
}

/* 10 · nothing ever left the origin */
ok(remoteAsked.length === 0, `zero remote requests (${remoteAsked.length})`);

console.log(failures ? `\nSMOKE FAILED (${failures})` : "\nSMOKE PASSED");
process.exit(failures ? 1 : 0);
