# ROADMAP — APEX ORV

*Current as of take 126.*

APEX ORV. An offline-first Android app for off-road navigation in Michigan, built from
public agency data. Sideloaded APK. No subscription, no account, no backend, and
no network required in the field.

**The bar:** if onX Offroad or AllTrails has a feature worth having, it belongs on
this list. The parity matrix below is the checklist.

**The driver:** Jacob has been lost in these woods. Phase 4 exists so that does
not happen again, and per PROTOCOL §9 nothing in it gets cut for schedule.

---

## Read this before the phases

**The money case is smaller than it looks, and that's fine.** onX Offroad runs
about $100/yr for all states; Gaia Premium about $40/yr; AllTrails Pro around
$36/yr. Annual, not monthly. This saves roughly $100/yr, not $1,200.

Build it for the reasons that actually hold:

- **Offline integrity you can prove.** A subscription app's offline mode is a
  promise. Here it is a gate check that fails the build.
- **Safety features nobody sells.** Off-route alerting tuned for a dirt bike, a
  dispatch-ready coordinate card, screen-off recording that survives One UI.
- **Your data, versioned, with provenance.** Lines that can tell you whether
  they're legally authoritative or just something somebody drew in OSM.
- **No renewal, no account, no telemetry.** It cannot be taken away, repriced,
  or pivoted out from under you.

If a phase stops serving one of those four, cut it.

---

## Feature parity matrix

Where each capability lands. **Gap** means we can't match it and should say so
plainly in-app rather than pretend.

### Basemaps and imagery

| Capability | onX | AllTrails | Plan |
|---|---|---|---|
| Topo basemap | ✓ | ✓ | 2.1 |
| Satellite imagery, offline | ✓ | ✓ | 2.3 — NAIP, public domain |
| Hybrid (imagery + labels) | ✓ | ✓ | 2.4 |
| Hillshade / relief | ✓ | ✓ | 2.5 |
| Slope angle shading | ✓ | – | 2.6 |
| Contour lines | ✓ | ✓ | 2.5 |
| 3D terrain view | ✓ | ✓ | 2.7 — MapLibre raster-DEM |
| Offline download by region | ✓ | Pro | 1.2, 9.2 |

### Trail and land data

| Capability | onX | AllTrails | Plan |
|---|---|---|---|
| Named/numbered trail database | ✓ | ✓ | 3.2, 3.3 |
| MVUM legal designation | ✓ | – | 3.3, 7.2 |
| Vehicle width class (24/50/72") | ✓ | – | 3.6, 7.1 |
| Seasonal open/close dates | ✓ | – | 3.7, 7.3 |
| Public land boundaries | ✓ | – | 3.4 |
| **Private parcel ownership** | ✓ | – | **Gap — licensed data** |
| Trailheads, staging, parking | ✓ | ✓ | 3.9 |
| Campgrounds | ✓ | ✓ | 3.9 |
| Dispersed camping layer | ✓ | – | 3.10 |
| Fuel / food / lodging POIs | ✓ | – | 3.9 |
| Water features | ✓ | ✓ | 2.1 |
| Junction marker numbers | – | – | 3.8 — **better than both** |
| Weather / smoke / fire overlays | ✓ | – | **Won't do — needs network** |
| Live trail conditions | ✓ | ✓ | **Gap — needs a backend** |

### Navigation and search

| Capability | onX | AllTrails | Plan |
|---|---|---|---|
| GPS position + accuracy circle | ✓ | ✓ | 1.5 |
| Offline place/trail/address search | ✓ | ✓ | 5.1 |
| Road directions to a trailhead | ✓ | ✓ | 5.4 |
| On-trail route planning | ✓ | ✓ | 5.5 |
| Turn-by-turn | ✓ | ✓ | 5.6 |
| Snap-to-trail display | ✓ | ✓ | 5.3 |
| **Off-route / wrong-turn alert** | – | Pro | **4.4 — the one that matters** |
| **Return Home, ranked options** | – | – | **4.13–4.24 — better than both** |
| Fuel-range awareness | – | – | 4.20 — **nobody does this** |
| Daylight / sunset awareness | – | – | 4.21 — **nobody does this** |
| Compass / heading | ✓ | ✓ | 1.9 |
| Distance measuring | ✓ | ✓ | 5.7 |
| Elevation profile along route | ✓ | ✓ | 6.3 |
| Android Auto | ✓ | – | 9.7, low priority |

### Recording and markups

| Capability | onX | AllTrails | Plan |
|---|---|---|---|
| Track recording | ✓ | ✓ | 4.1 |
| Ride stats (dist/time/speed/gain) | ✓ | ✓ | 6.1 |
| Auto-pause | ✓ | ✓ | 6.2 |
| GPX import/export | ✓ | ✓ | 8.3 |
| Waypoints / pins | ✓ | ✓ | 8.1 |
| Lines, areas, freehand drawing | ✓ | – | 8.2 |
| Photos attached to waypoints | ✓ | ✓ | 8.4 |
| Folders / lists / favourites | ✓ | ✓ | 8.5 |
| Share a location or track | ✓ | ✓ | 8.6 — share sheet, needs signal |

### Community

| Capability | onX | AllTrails | Plan |
|---|---|---|---|
| Reviews, ratings, user photos | ✓ | ✓ | **Won't do — no backend** |
| Crowd-sourced condition reports | ✓ | ✓ | **Won't do — no backend** |
| Curated difficulty ratings | ✓ | ✓ | 6.4 — personal ratings instead |
| Live location sharing | – | Pro | 8.7 — trailhead only, no signal out there |

---

## Phase 0 — Spike · IN PROGRESS

Prove the architecture before building on it.

| # | Task | State |
|---|------|-------|
| 0.1 | Standalone inline-HTML build, real AOI data | **DONE** take 2 |
| 0.2 | Renderer perf on the Fold WebView | **OPEN** — awaiting PAN TEST |
| 0.3 | PMTiles byte-range read inside Capacitor | **OPEN** — blocking unknown |
| 0.4 | Offline integrity: airplane mode, NET green | **OPEN** |
| 0.5 | Decision: PMTiles vs MBTiles+SQLite | **BLOCKED** on 0.3 |

**Exit:** avg ≥ 50 fps, p99 min ≥ 30 fps, renders with the radio off, zero remote
requests. Nothing in Phase 1 starts until 0.5 is decided — every later phase
inherits that choice.

---

## Phase 1 — A shell that survives the woods

| # | Task | Notes |
|---|------|-------|
| 1.1 | Release keystore, signed APK | Debug-signed can't be updated in place |
| 1.2 | Tiles in app storage, not bundled | Statewide won't fit in a reinstallable APK |
| 1.3 | First-run download, resumable, verified | Needs progress UI and an integrity check |
| 1.4 | Offline SDF glyph pack | **Labels.** A two-track with no FR number is half a map |
| 1.5 | Foreground service for screen-off GPS | One UI kills background work otherwise |
| 1.6 | Battery-optimization exemption prompt | Samsung-specific; the difference between working and not |
| 1.7 | Fold config-change survival | Fold/unfold must not reset the camera |
| 1.8 | Cover-screen layout locked | Inner screen deferred by decision |
| 1.9 | Compass, heading, orientation lock | Heading-up mode matters when you're turned around |
| 1.10 | Wake-lock and dimming policy | Riding, not reading |
| 1.11 | Crash-safe state persistence | Reopen where you were, always |

**Exit:** four hours of riding, screen mostly off, map available throughout,
battery cost measured and written down.

---

## Phase 2 — Basemaps and imagery

Everything a normal maps app gives you, offline.

| # | Task | Source |
|---|------|--------|
| 2.1 | OSM vector basemap, statewide | planetiler + Geofabrik Michigan |
| 2.2 | Topo styling variant | Same tiles, second style |
| 2.3 | **Satellite imagery, offline** | NAIP — public domain, ~60 cm, USDA |
| 2.4 | Hybrid: imagery + vector labels | Style composition |
| 2.5 | Hillshade + contours | USGS 3DEP, 10 m |
| 2.6 | Slope angle shading | Derived from the same DEM |
| 2.7 | 3D terrain | MapLibre raster-DEM source |
| 2.8 | Basemap switcher, one thumb | Sun-readable, no menu diving |
| 2.9 | Per-region imagery download | Imagery is the size problem — see landmine 18 |

**Imagery is the size driver.** Estimated ~200 MB at z16 for the current AOI
alone (INFERRED, not measured). Statewide imagery is not viable as one download,
so 2.9 is a hard requirement rather than a nicety.

---

## Phase 3 — The Michigan data pipeline

The part that makes this better than a generic map. Runs in CI, never on a phone.

| # | Task | Source |
|---|------|--------|
| 3.1 | Reproducible tile build from clean checkout | One workflow run, no manual steps |
| 3.2 | DNR ORV trails, routes, closures | **Live service confirmed** — see below |
| 3.3 | USFS MVUM roads + trails | data.fs.usda.gov — Huron-Manistee, Hiawatha, Ottawa |
| 3.4 | DNR + state forest land boundaries | gis-michigan |
| 3.5 | **Provenance on every feature** | `src=dnr\|usfs\|osm`, `authority=legal\|advisory` |
| 3.6 | Width class attribute | 24" motorcycle / 50" trail / 72" route |
| 3.7 | Seasonality attribute | Open dates differ by trail and by machine |
| 3.8 | **Numbered junction markers** | DNR posts these; nobody's app shows them |
| 3.9 | POIs: staging, campgrounds, fuel, food, water | OSM + DNR |
| 3.10 | Dispersed camping eligibility | USFS rules are spatial and specific |
| 3.11 | **Conflation: dedupe DNR / USFS / OSM** | The genuinely hard one |
| 3.12 | State forest roads open to ORV | Separate DNR dataset from trails |

**DNR service, PROVEN at take 4:**
`gisagodnr.state.mi.us/arcgis/rest/services/DNR/DNRTrailsOPENDATA/FeatureServer`
Layers 11 (routes), 12 (trails), 13 (motorcycle), 14 (MCCCT), 0 (closures),
1 (reroutes). 246 trail features and 20 live closures inside the AOI, 164.1 miles.

**Usable straight out of the box:** `TrailWidthFeet` (populated — 3.6 and 7.1 need
no derivation), `OpenClosedStatusORV` (live closures — 7.3), `LicenseType` (7.7),
`TrailOnRoad` (names the federal/state road a segment runs on — a direct assist
to 3.11, which was assumed to be pure geometry matching).

**Dead fields — do not plan on them.** `TrailTreadType` and
`SpecialRestrictionType` are null across every AOI record. `SurfaceType` is
"Dirt Natural" for all 159 — no sand vs hardpack, which is the one distinction
that matters here. Task 6.5 needs another source.

**3.8 got harder.** No junction-number field exists in any of the 23 layers, and
there is no marker point layer in the service. The numbers are on the printed PDFs
and the physical posts only. Still worth doing — "I'm at junction 42" is exactly
what a dispatcher wants and neither competitor has it — but it is a digitising
job, not a download.

**3.11 is where onX spends its money.** The same forest road exists three times
with three geometries. Getting it wrong means a doubled map that lies about which
line is authoritative. Budget real time; it is not a merge.

**Exit:** every line can name its source, and Bull Gap matches the paper MVUM.

---

## Phase 4 — Never get lost again · THE REASON THIS EXISTS

If only one phase ever ships, this is it. PROTOCOL §9 applies to everything here.

| # | Task | Notes |
|---|------|-------|
| 4.1 | Always-on breadcrumb recording | Starts with the app. No button to forget |
| 4.2 | Auto-drop a pin where you parked | Detected on first movement, not asked for |
| 4.3 | **Back-to-vehicle bearing + distance** | Always on the rail. Never more than a glance away |
| 4.4 | **Off-route alert** | Haptic + visual when you leave the planned line |
| 4.5 | Retrace: follow your own breadcrumb out | Not routing — the line you actually rode |
| 4.6 | Nearest pavement indicator | Straight-line first; routed at 5.5 |
| 4.7 | **Dispatch card** | Decimal degrees, nearest junction number, nearest FR, PLSS section |
| 4.8 | Last-known-good fix, persisted | If GPS drops, the last real fix stays on screen with its age |
| 4.9 | Low-power reserve mode | Reduced fix rate, dimmed, map still live |
| 4.10 | Battery + storage warnings before you ride | Warn at the trailhead, not at dusk |
| 4.11 | "Working" indicators for every 4.x feature | Silent failure is the enemy (PROTOCOL §9) |
| 4.12 | Offline about-screen: what this is not | Names the satellite-messenger gap honestly |

**4.7 detail:** decimal degrees is what Oscoda and Ogemaw dispatch will ask for.
Show it large, never default to DMS, and pair it with the junction number from 3.8.

### Phase 4 · Return Home

Jacob's feature. Tap once, get ranked ways back to a saved place with honest
tradeoffs — not one "best" route.

| # | Task | Notes |
|---|------|-------|
| 4.13 | Saved places: Home, Camp, Truck | Truck auto-drops at 4.2 |
| 4.14 | **Retrace** — your own breadcrumb | Default and permanent fallback. Needs no router |
| 4.15 | **Fastest** | Least time. May include hard sections; says so |
| 4.16 | **Easiest** | Prefers 72" routes over 50" over 24". Avoids grade and water |
| 4.17 | **Pavement soonest** | The injured / broken / low-fuel option |
| 4.18 | **Shortest** | Pure distance |
| 4.19 | Per-option summary card | Distance, ETA, hardest segment, warnings |
| 4.20 | **Fuel range awareness** | Set tank range; flag routes that exceed what's left |
| 4.21 | **Daylight awareness** | ETA against sunset. "Home 40 min after dark" |
| 4.22 | Avoid list | Sand, water crossings, steep grade, singletrack, closed, illegal-for-machine |
| 4.23 | Route confidence | How much is legally designated vs an OSM guess |
| 4.24 | Recompute on deviation | Ties into the 4.4 off-route alert |

**4.14 is the one that must never fail.** Retrace needs no routing engine, no
network and no map data beyond the track you already recorded. Everything else
here is an optimisation on top of a thing that already works.

**4.20 and 4.21 are the differentiators.** A route that's fastest but 8 miles past
your remaining fuel is not the best route, and neither onX nor AllTrails knows or
cares what's in your tank. Same for arriving after dark on a bike.

**Blocked on:** 4.15–4.18 need the router from 5.4/5.5. 4.14 does not — build it
first and ship it alone if need be.

---

**Permanently out of scope:** this app is not an SOS device. A satellite messenger
does something no map can. Item 4.12 says so inside the app.

**Exit:** ride an unfamiliar loop, deliberately take a wrong turn, and have the app
tell you before you've gone a quarter mile.

---

## Phase 5 — Navigation and search

| # | Task | Notes |
|---|------|-------|
| 5.1 | Offline search index | Place names, trail names, FR numbers, POIs |
| 5.2 | Address search | OSM address points; coverage is thin up there |
| 5.3 | Snap-to-trail display | Under canopy the raw dot wanders |
| 5.4 | Road routing to a trailhead | Check Valhalla before building anything |
| 5.5 | On-trail route planning | Respecting width class from 3.6 |
| 5.6 | Turn-by-turn with voice | Helmet speaker, eyes up |
| 5.7 | Distance and area measuring | Tap-to-measure |
| 5.8 | Coordinate entry / go-to | Paste a lat/lon, ride to it |

---

## Phase 6 — Trail intelligence

| # | Task | Notes |
|---|------|-------|
| 6.1 | Ride stats | Distance, moving time, speed, elevation gain |
| 6.2 | Auto-pause | Don't count the lunch stop |
| 6.3 | Elevation profile | Planned route and recorded ride |
| 6.4 | Personal difficulty ratings and notes | Your own, since there's no community |
| 6.5 | Surface hints | **DNR SurfaceType is useless** (take 4). OSM tags or nothing |
| 6.6 | Ride history browser | Where you've been, searchable |
| 6.7 | Heatmap of your own tracks | The honest version of a popularity layer |

---

## Phase 7 — The legal layer

Deferred early by request; attributes still flow from Phase 3 so this stays
rendering work, not a re-import.

| # | Task | Notes |
|---|------|-------|
| 7.1 | Render by width class | 24/50/72 is the rule that gets you ticketed |
| 7.2 | Authoritative vs advisory styling | MVUM lines must not look like OSM guesses |
| 7.3 | Date-aware seasonal closures | Grey out what's shut today |
| 7.4 | Vehicle profile filter | Set your machine once, hide what's illegal for it |
| 7.5 | Private inholding warning | **The real gap.** Best-effort from public land boundaries |
| 7.6 | In-app disclaimer | The MVUM is the authority; this app is not a defense |
| 7.7 | Licence and permit reminders | ORV licence + trail permit, seasonal |

---

## Phase 8 — Markups, trips, records

| # | Task | Notes |
|---|------|-------|
| 8.1 | Waypoints with icons and notes | Camp, water crossing, washout, gate |
| 8.2 | Lines, areas, freehand drawing | Sketch a plan on the map |
| 8.3 | GPX import and export | Interop with everything else |
| 8.4 | Photos attached to waypoints | Stored locally, geotagged |
| 8.5 | Folders and trip organisation | A weekend is a unit |
| 8.6 | Share track or location | Share sheet; needs signal, so it's a trailhead feature |
| 8.7 | Trip plan note | Where, back by when, sent before you lose signal |
| 8.8 | Local backup and restore | The phone is the only copy otherwise |

---

## Phase 9 — Scale and upkeep

| # | Task | Notes |
|---|------|-------|
| 9.1 | Statewide vector bundle | Size budget, download UX |
| 9.2 | Regional sub-bundles | NE Lower, UP, SE — don't force 400 MB for one weekend |
| 9.3 | Delta updates | Re-download a region, not the state |
| 9.4 | Data freshness stamp, visible in-app | "DNR data as of ____". Staleness must be visible |
| 9.5 | Annual refresh runbook | MVUMs republish each March |
| 9.6 | Storage manager | See what's downloaded, free space |
| 9.7 | Android Auto | Low priority; the bike doesn't have a head unit |
| 9.8 | Expansion beyond Michigan | Only after the pipeline is boring |

---

## Accepted gaps

Written down so nobody re-proposes them as oversights.

- **Private parcel boundaries.** Licensed county-by-county data. Best effort from
  public land boundaries, disclosed in-app (7.5).
- **Community reviews, photos, condition reports.** Needs a backend, moderation,
  and users. Substituted with personal ratings and notes (6.4).
- **Live weather, smoke, fire overlays.** Need network, which is the one thing the
  field doesn't have.
- **Real-time SOS.** Buy a satellite messenger. The app says so (4.12).

---

## Standing decisions

- **Cover screen only.** Inner-screen layout deferred, by request.
- **Legal layer light early.** Attributes carried through Phase 3, rendering in 7.
- **CI builds everything.** No laptop in the loop; the phone installs and measures.
- **No account, no server, no telemetry.** There is no backend. Keep it that way.
- **Android only.** iOS is a different signing, store and problem.
- **Not for sale.** Personal safety use.
