# AGENDA

*Current as of take 160.* Ranked by blocking-ness, not by interest.

**Every item lists what has been RULED OUT and with what evidence.** Keep it that
way, so nobody re-derives a dead end.

---

## A1 — Capacitor Range requests · CLOSED as moot, take 12 (recorded take 39)

Determines the tile storage format for the whole project (landmine 1).

- **CLOSED as moot.** PMTiles was removed at take 12; the app fetches whole
  files over the `https` androidScheme, so byte-range behaviour touches no code
  path. Take 39's APK verifiably contains every bundle file in
  `assets/public/` and the loader reads them with plain fetch.
- **Ruled out:** PMTiles and any byte-range storage format. Whole-file fetch
  from the APK's assets is what ships and what is verified.
- **Left mislabelled BLOCKING in this file until take 39** — an agenda that
  lies about what is blocking is worse than no agenda, and this one did for 27 takes.
- **Next:** Stage 1 APK. Binary answer — the map renders or it doesn't.
- **If no:** MBTiles + `@capacitor-community/sqlite`, ~1 day, no redesign.

## A2 — Renderer speed on the Fold · CLOSED take 28, emphatically

- **Threshold was:** avg >= 50 fps, p99 min >= 30.
- **Measured on SM-F966U1, Adreno 830, WebView Chrome/152:** avg **124**,
  p99 min **98**, **0 of 70 frames over 33 ms**, worst frame 10 ms, with 1,390
  features on screen. Not close — comfortable.
- **Ruled out:** the whole "is a WebView fast enough" question. It is, by 2.5x
  on the average and 3x on the worst percentile.

## A3 — Offline labels · CLOSED, take 9

Landmine 4. A two-track with no forest road number is half a map, and it's the
first thing that will make the app feel unfinished.

- **PROVEN:** SDF pack generated from a TTF, protobuf hand-encoded. 107 glyphs,
  61 KB base64, served from a static `data:` URI — no protocol handler needed.
- **PROVEN:** SDF round-trips at 100.00% against the rendered mask; all 68
  characters the map can render are covered.
- **Ruled out:** CDN glyph URLs. Violates PROTOCOL §8.
- **Ruled out:** two weights. One fontstack is what makes the static URI work.

## A4 — Conflation · SOLVED, take 6

Landmine 11. Phase 2.8.

- **PROVEN:** USFS trails 94.8% duplicated by DNR, USFS roads only 12.6%.
- **Rule adopted:** drop duplicate USFS trails, keep all USFS roads, merge the
  USFS trail id onto the matching DNR feature. 43 dropped, 41 ids merged.
- **Ruled out:** dropping USFS wholesale. Costs 338 mi of forest road.
- **Ruled out:** keeping USFS wholesale. Doubles every trail.

## A5 — Tiles in app storage vs bundled in the APK · ANSWERED take 42 (bundled)

Landmine 10 forces this eventually. Question is whether it lands in Phase 1 or 2.

- **Ruled out:** committing statewide tiles to git. 100 MB file limit.
- **Open:** first-run download UX, resumability, integrity check.

## A6 — Land ownership · STILL A GAP, take 45 note

The one thing onX has that free data doesn't.

- **Ruled out:** free statewide parcels. Licensed, county-by-county, not public.
- **Decision:** accept the gap, disclose it in-app. Revisit only if a specific
  county publishes usable data.

## A7 — Junction markers · SOLVED DIFFERENTLY, take 7

ROADMAP 3.8. Michigan posts numbered junction signs on ORV trails. "I'm at
junction 42" is exactly what a dispatcher wants, and neither onX nor AllTrails
surfaces them.

- **Ruled out:** the DNR GIS service. PROVEN — no junction/marker field in any of
  its 23 layers, and no marker point layer exists in the DNR services folder.
- **Ruled out:** deriving junction numbers from topology. They wouldn't match the
  physical signs, which is the entire point.
- **Remaining path:** digitise from the DNR trail PDFs. Real work, not free.
  Rescoped at ROADMAP 3.8 and no longer treated as cheap.

## A8 — Imagery size budget · CLOSED, take 10

Landmine 18. Determines whether satellite is a per-region opt-in or a per-trip
download.

- **PROVEN by measurement:** USGS ImageryOnly over the AOI — z14 8 MB, z15 37 MB,
  z16 159 MB. Statewide at z16 would be 36.6 GB.
- **Decided:** z16 (1.70 m/px) per region, downloaded on wifi. z12-13 shipped with
  the app as a fallback.
- **Ruled out:** statewide imagery at any useful zoom. 36.6 GB settles it.
- **Ruled out:** Esri/Google/Bing/Mapbox imagery. Licensed, not redistributable
  offline (landmine 22).

## A9 — USFS MVUM · CLOSED, take 5

Same treatment the DNR service got in take 4. Bull Gap and the Meadows are federal;
without this, half the riding area is missing (landmine 13).

- **PROVEN:** `EDW_MVUM_01/MapServer` layers 1 (roads) and 2 (trails). 366 roads
  and 46 trails in the AOI. Per-vehicle-class legality with date ranges, fully
  populated. Richer than the DNR for 7.4.
- **Ruled out:** needing to infer vehicle legality from width. The MVUM states it.

## A10 — Surface type: sand vs hardpack · OPEN

ROADMAP 6.5. In this terrain it's the difference between a fun loop and a bad day.

- **Ruled out:** DNR `SurfaceType`. PROVEN — "Dirt Natural" on 159/159 AOI records.
- **Ruled out:** DNR `TrailTreadType`. PROVEN — null on 159/159.
- **Open:** OSM `surface` tag coverage in the AOI, and whether it's worth anything
  this far from a city.

## A11 — Retrace · DONE, take 7

ROADMAP 4.14, the one Return Home option that must never fail. Take 6 ships the
four routed profiles; retrace is not among them because a viewer has no track.

- **PROVEN:** reversal is lossless (delta 0.00e+00) and lands exactly on the truck.
- **PROVEN:** the 7 m jitter gate holds distance inflation to +2.2% under heavy
  simulated GPS noise.
- **Ruled out:** needing the graph. Retrace touches only the recorded track.

## A12 — Terrain · CLOSED, take 8

ROADMAP 2.5-2.7, 6.3, and a better "Easiest" cost. Bull Gap is a sand hill climb;
routing that ignores elevation is routing that ignores the thing riders care about.

- **PROVEN:** 110 Terrarium tiles at z13 cover the AOI. Relief 199 m, 879-1503 ft.
  Node elevations, per-edge climb, profiles and hillshade all from one ingest.
- **PROVEN:** climb conservation exact across 16,345 edges; profile endpoints
  match node elevations to a median of 0 m.
- **Ruled out:** per-point elevation APIs. 9,285 nodes is far too many calls.
- **Still open (A14):** 3D terrain needs the encoded DEM shipped to the client,
  not the rendered shade — landmine 20 stands.

## A13 — Phase 4 items · PARTLY DONE, take 9

- **4.6 nearest pavement — DONE take 9.** Straight-line bearing, no router.
- **4.12 about screen — DONE take 9.** States the app is not an emergency device,
  that the MVUM is the authority, and that parcel lines are absent.
- **4.9 low-power reserve mode** still unbuilt; battery behaviour unmeasured and
  unmeasurable until there is an APK.
- **4.10 pre-ride warnings** still unbuilt.
- **Ruled out:** nothing. Neither remaining item is blocked on anything but the
  APK for 4.9.

## A14 — 3D terrain and slope shading · OPEN

ROADMAP 2.6, 2.7. Take 8 ships the rendered hillshade; 3D and slope need the
encoded DEM on the client.

- **Ruled out:** reusing the hillshade JPEG. Landmine 20 — a rendered shade
  carries no elevation values, so MapLibre terrain renders flat.
- **Open:** size of a Terrarium tileset trimmed to the AOI versus what 3D is
  actually worth on a 6.5" cover screen while riding.
- **Note:** slope shading needs the same encoded DEM, and is arguably worth more
  than 3D here — it would show the sand hills directly.

## A15 — Offline search · CLOSED, take 11

ROADMAP 5.1. The graph already carries 1,049 distinct names and 3,706 named
junctions; none of it is searchable.

- **Ruled out:** searching the tiles. Landmine 19 — vector tiles only hold what is
  in the current viewport, so you cannot find a place you are not already looking
  at. A separate index is required.
- **PROVEN:** one flat index over everything is right — 2,543 entries covering
  trails, numbers, roads, 1,486 junction descriptors and places, built at load
  from the existing payload with no extra bytes shipped.
- **Ruled out:** a separate junction index. Ranking by kind handles precedence.

## A16 — Region bundle download · NOW CENTRAL

PROTOCOL §8 as revised makes this the architecture rather than a convenience:
the app ships small, the user provisions a region on wifi, and the field is
guaranteed offline. ROADMAP 1.2, 1.3, 2.9.

- **PROVEN:** the sizes that force it — 159 MB imagery + vector + terrain per
  riding area, and statewide imagery impossible.
- **Ruled out:** bundling regions in the APK. Landmine 10 (100 MB git limit) and
  reinstall-to-update.
- **DONE take 11:** `tools/bundle.py` — manifest format, SHA-256 per artifact,
  bundle hash, and the three-state model (complete / partial / unusable). The
  half-downloaded case is designed rather than discovered (landmine 34).
- **Open:** resumable download and the on-device consumer. Nothing reads a
  manifest yet; that needs the APK.

## A17 — Voice for the turn list · OPEN

ROADMAP 5.6. Take 11 generates readable steps; nothing speaks them.

- **Ruled out:** a cloud TTS. PROTOCOL §8 — the field has no network.
- **Open:** Android on-device TTS through Capacitor, and whether it is wanted at
  all on a bike where a helmet speaker may not be present. Eyes-up matters more
  than ears here, so the visual step list may already be the right answer.

## A18 — On-device evidence · STAGE 0 CLOSED take 28 · STAGE 1 INSTRUMENTED take 41

Stage 0 is closed. The app renders, routes, geocodes and self-tests on the
Fold: 37 pass / 1 fail on the last field report, the failure being an indoor GPS
timeout.

- **Ruled out:** renderer speed (A2), offline loading (NET CLEAN, 0 remote
  requests), style validity, glyph rendering, routing, the address index, and
  layout at 411x960.
- **STAGE 1 STILL OPEN — and only Jacob can close it:** battery cost over a real
  ride with the screen held on, sunlight legibility, glove operation, the fold
  seam, GPS quality under jack pine canopy, and what happens when a fix drops
  out mid-ride. None of these can be measured from here.
- **Still unknown:** renderer performance (A2), Capacitor Range behaviour (A1 —
  now moot for tiles but not for the WebView generally), whether One UI keeps a
  foreground service alive, real battery cost, whether labels are legible in
  sunlight, whether the cover-screen layout works with gloves on.
- **Note:** this is not a criticism of the work, it is the honest state. The repo
  builds, the pipeline is clean, the maths is verified. None of that is evidence
  about a phone in a jack pine stand.

## A19 — Regional sub-bundles · PROVEN VIABLE, take 14

ROADMAP 9.2. Two regions build from one definition with no code changes.

- **PROVEN:** St. Helen (722 km2) builds in ~1 min to a 1.19 MB bundle; Bull Gap
  (1,060 km2) to 1.88 MB. Adding a region is one entry in `regions.json`.
- **Ruled out:** per-region code. Nothing about either region lives in a tool.
- **Open:** how many regions a phone should hold, and whether the glyph pack
  (identical across regions, 61 KB each) should be shared rather than duplicated.

## A20 — Execute the shipped artifact · CLOSED, take 15

- **PROVEN:** `tools/smoke.mjs` runs `www/app.js` under a stubbed browser against
  real bundles. 22 assertions; complete, partial and second-region paths.
- **PROVEN:** it immediately found two wiring failures the mirrors never could
  (landmines 38, 39) and the missing imagery georeference.
- **Ruled out:** treating `node --check` + Python mirrors as sufficient. They
  passed for eight takes while Phase 4 was dead on first use.

## A21 — Signing and update continuity · DECIDED, take 20

- **Decision:** `signing/apex.keystore` is committed; CI signs releases with it,
  so every take installs over the previous one.
- **Tradeoff, stated:** anyone with the repo can sign as this app. Acceptable
  for a personal sideloaded tool; **must be revisited before any public
  distribution** — at that point the key moves to a secret and the repo history
  means a new appId.
- **Ruled out:** per-run debug keys. Signature mismatch would force
  uninstall/reinstall on every take, destroying recorded tracks.

## A22 — Planning mode away from the region · SHIPPED take 22

- **PROVEN:** `posMode` separates none/gps/sim/away; dispatch refuses every
  non-live case; the readout labels the map centre as such; tap-to-place sets a
  planning start that Return Home and Directions route from.
- **Ruled out:** defaulting the position pin to a region anchor. It produced a
  precise, plausible, wrong coordinate next to the dispatch button (take 20).
- **Open:** should planning mode let a second region load side by side, for
  riders choosing between areas?

## A23 — Render verification in a real engine · SHIPPED take 24

- **PROVEN:** `tools/render.mjs` renders `www/` in headless Chrome and asserts
  errors, feature counts, badge state and screenshot colour diversity. It found
  in one run what 14 takes of stubbed execution could not.
- **Ruled out:** treating `smoke.mjs` as sufficient. It stubs `maplibregl`, so
  style validation is structurally invisible to it.
- **Open:** Chrome is not Android WebView. This proves the style and data are
  renderable, not that the APK renders — only the device closes that.

## A24 — CI could not verify rendering · CLOSED take 25

- **Was:** `check_render` skipped silently when Chrome was absent, and CI had no
  Chrome. A blank map would have shipped again with a green gate.
- **Now:** the workflow installs Chrome and runs `tools/render.mjs` before
  gating, and the gate **fails** rather than notes when `$CI` is set and no
  browser exists. Negative control: reintroducing the take-22 style bug fails
  all five render checks.
- **Ruled out:** a soft skip. A check that cannot run where it matters is
  theatre — it reported "skipped" politely on every CI run while the map drew
  nothing (landmine 53).

## A25 — Single-file build was engineless from a clean seed · CLOSED take 25

- **Was:** `single()` inlined `mlg.js`/`mlg.css`, which are **gitignored**. They
  existed only in one container; from the seed the browser page would have
  shipped with no map engine at all. Landmine 32, fifth appearance.
- **Now:** inlined from `www/vendor/`, which CI fetches and the manifest
  declares. Render-verified: 531 colours, 7,736 features.
- **Stated divergence:** the single file uses the standard MapLibre build (blob
  worker, fine in browsers) because one file cannot reference a separate worker;
  split/APK use the CSP build with an explicit worker URL. Both render-verified.
- **Ruled out:** committing the engine as a repo binary, and keeping the
  gitignored copy. Vendoring from a declared host is the only version CI and a
  clean seed can both reproduce.

## A26 — render.mjs was unrunnable from the seed · CLOSED take 25

- **Was:** puppeteer was never in `package.json`, and `tools/android.py`
  *overwrote* that file from a fixed template — so the check that found the
  blank map could not run on Jacob's machine or in CI.
- **Now:** puppeteer is a declared devDependency and `android.py` merges rather
  than clobbers.
- **Ruled out:** generating `package.json` from a template at all. A tool that
  rewrites a file it does not fully own will silently delete whatever it does
  not know about.

## A27 — The CSP engine is belt-and-braces, not a proven fix · MEASURED take 97, Jacob's call

- **Honest status:** take 21 shipped the CSP build to fix a `blob:` worker
  problem that **take 23 disproved** — the real cause was style validation.
- **Kept anyway** because an explicit worker URL cannot be blocked, it costs
  ~370 KB in a 5.2 MB APK, and it is render-verified. But it is insurance
  against an unobserved failure, not a fix.
- **Decide when:** the Fold renders. If it draws with CSP, try the standard
  build once and drop 370 KB if it also draws.
- **Ruled out:** removing it now on the strength of a Chrome render. Chrome is
  not Android WebView, and this is precisely the environment difference the CSP
  build exists for — dropping it on desktop evidence would repeat take 22's
  mistake in the opposite direction.

## A28 — Impromptu rides · SHIPPED take 40

Jacob's stated goal is three things: plan a trip, ride it, and **improvise** —
"a new impromptu trail ride" or getting out of trouble. The first two are built.
The third is not:

- **Missing:** "give me a loop from here, about 20 miles, mostly moto trail" —
  loop generation, not point-to-point. The graph, per-edge costs, machine
  legality and climb data all exist; the routing is A-to-B only.
- **Missing:** saving and naming a planned route so it survives an app restart.
- **Ruled out:** nothing yet — this is unstarted, not blocked.
- **Sequenced after A18** deliberately: no new feature until the map is proven
  to draw on the device.

## A29 — On-device self-test · SHIPPED take 27

- **PROVEN:** 29 checks + 11 environment readings run in-app and produce a
  shareable text report; `render.mjs` runs the identical battery headless, so a
  device report is diffable against a known-good baseline.
- **PROVEN:** it found four bugs in its own first run (profile field name, lazy
  index, software-rasteriser fps verdict, SxS legality misread).
- **Ruled out:** asking Jacob to tap through thirty features per build, and
  free-text bug reports — both cost him time and give me less.
- **Open:** the report is text; a future version could attach the map screenshot
  and the last N GPS fixes for a track-quality view.

## A30 — Statewide context · REVISED take 31

- **PROVEN:** minZoom 5.2, Michigan-wide maxBounds, dashed DOWNLOADED box with a
  label, blue you-are-here pin, Locate flies to the real fix.
- **Ruled out:** penning the map to the bundle bbox. It left a rider 135 mi away
  unable to see where he stood relative to the data, and made blank space read
  as breakage.
- **Open:** a faint statewide reference (county or state outline) would orient
  better still, but needs a small offline geometry the pipeline does not fetch
  yet — and it must not imply routable detail.

## A31 — Launcher icon · CLOSED take 30

- **PROVEN:** `assets/logo-master.png` (Jacob's own artwork, cleaned) drives all
  18 icon resources through `tools/icon.py`; verified by extracting the adaptive
  foreground from the shipped APK.
- **Ruled out:** redrawing the mark from primitives. Two takes tried, both
  missed, and the second was rejected outright — approximating an asset you
  already possess exactly is not engineering.
- **Note:** a wordmark costs legibility below ~56 px. Jacob's design, knowingly
  kept.

## A32 — State outline for orientation · REVISED take 33

- **PROVEN:** Michigan from US Census TIGERweb, 10,721 points simplified to 126,
  2.3 KB, drawn below z9.6 and faded out above it. Rendered and verified at z5.8
  with the detailed square visible inside it.
- **Ruled out:** the orange DOWNLOADED box — rejected in the field as
  distracting, and redundant once the data itself shows where coverage is.
- **Ruled out:** treating the outline as data. It is an optional bundle artifact
  and touches no routing, snapping or safety code.
- **Open:** county lines would orient better still, but risk reading as roads.

## A33 — Place cards and tap-to-route · SHIPPED take 33

- **PROVEN:** tapping the home pin, the position pin or open ground opens a card
  with coordinates, elevation, distance/bearing and nearest named trail, plus
  Directions / Make home / Start here / Dispatch / Centre. Smoke asserts the pin
  tap, the card contents and that Directions routes with multiple profiles.
- **Ruled out:** a second click handler for planning (landmine 50) and silently
  moving state on tap — both were in take 31 and both were wrong.
- **Open:** long-press vs tap for the pin, and whether the card should offer
  "add as waypoint" once multi-stop routing exists (A28).

## A34 — Offline addresses · SHIPPED take 34

- **PROVEN:** reverse and forward geocoding from Census TIGER address ranges,
  entirely offline. Round trip within 14 ft; The Pink Store resolves to a real
  street address.
- **PROVEN:** a point with no address returns null and the card omits the line —
  asserted in both smoke and the on-device self-test.
- **Ruled out:** live geocoding (Nominatim and friends). It would work at the
  trailhead and fail exactly where it is needed, and it would break the
  zero-remote-requests guarantee the NET badge exists to prove.
- **Open:** coverage is partial in the forest (2/8 anchors). Address *points*
  from Michigan open data could raise it, at a size cost worth measuring first.

## A36 — Closing the field-report loop · SHIPPED take 37

- **PROVEN:** `check_stubs()` fails the gate when the harness lacks an API the
  app calls; found 8 real gaps on first run.
- **PROVEN:** on-device layout checks (overflow, scrollers, tap targets, action
  reachability, map share) — found 31 px chips immediately.
- **PROVEN:** a 25-entry action log ships in the self-test report, turning a
  prose symptom into an ordered trace.
- **Ruled out:** asking Jacob for more detailed prose. The information he cannot
  give is state and ordering, and the app already has both.

## A35 — Feedback loop for a non-developer tester · SHIPPED take 37

- **PROVEN:** static stub-coverage gate (found 8 real gaps), on-device layout
  checks (catch the take-35 overflow by regression), and a 40-entry action log
  in the shared report.
- **Ruled out:** asking Jacob to describe UI bugs more precisely. The cost was
  never his description — it was that nothing on his device was measuring the
  thing he was describing.
- **Open:** a screenshot attached to the report would remove the last manual
  step, but Share of text plus his own screenshot already works well.

## A37 — Loop quality on real data · OPEN

- **PROVEN:** loops land within 1-13% of target on Bull Gap data, 0-3% ridden
  twice, 91-100% off-pavement for the trail-hungry shape, built in under 130 ms.
- **Ruled out:** a single radius estimate (33-126% long) and random-walk loop
  generation (produces out-and-backs).
- **Open:** a fast 30 mi loop comes back 24% short — the network may not support
  one without pavement. Needs a rider's judgement, not more code.
- **Open:** loops always start at the ◎ pin. Starting from a trailhead you name,
  or a loop that passes a fuel stop, are the obvious next asks.

## A38 — Ride telemetry · SHIPPED take 41

- **PROVEN:** fix count, median gap, dropouts over 15 s with worst gap, median
  accuracy, battery used and %/hour — all local, all in a shareable report, and
  carried into the self-test.
- **PROVEN:** the rate is withheld below 20 min / 2% moved, because Android's 1%
  battery granularity makes a short-ride extrapolation meaningless. An 8-minute
  ride says so; a 95-minute one reports 17.7%/hour.
- **Ruled out:** quoting a battery rate from any sample. That was the first
  version and it produced "37 hours from full".
- **Open until Jacob rides:** actual %/hour on the Fold with the screen on, and
  median accuracy under jack pine. Sunlight, gloves and the fold seam remain
  unmeasurable from here.

## A39 — Imagery resolution · SHIPPED take 42

- **PROVEN:** the old mosaic was 22.1 m/px and the pipeline was discarding 3.2x
  of the resolution it had already downloaded. Tiles at z12-z15 give 3.40 m/px,
  2,008 files, 45.2 MB, verified inside the built APK.
- **Ruled out:** a bigger single image. A z15 mosaic is 9728 px, beyond the
  8192 px max texture on the Adreno 830 — tiles are not an optimisation here,
  they are the only way to get past z14.
- **Ruled out:** z16 for now — 158 MB. Reachable per-region via
  `imagery_max_zoom` if a specific area deserves it.
- **Open:** APK is now 51 MB. If that becomes awkward, A16 (region download)
  is the answer — ship the app small and provision imagery on wifi.

## A40 — Sources without layers · CLOSED take 43

- **PROVEN:** `alt` and `approach` shipped for eight takes with data and no
  layer. Both now render (66 and 2 features measured in a real engine).
- **PROVEN:** `check_orphan_sources()` fails on a source with no layer and on a
  layer naming a missing source; negative-controlled both ways.
- **Ruled out:** asserting `setData` as evidence of drawing. It is evidence of
  data, and the two are not the same thing.

## A41 — Trail names on the map · SHIPPED take 44

- **PROVEN:** 8 names for 66 trail segments at riding zoom, up from 0-2. Both
  causes measured, not guessed: 76% of edges shorter than the label spacing, and
  `text-max-angle:32` placing zero.
- **Ruled out:** the data. Every trail edge carries a label; the styling and the
  feature geometry were suppressing them.
- **Ruled out:** `line-center` placement — measurably worse (1-5 labels).
- **Open:** label density still depends on how twisty a trail is. If a specific
  area reads thin, raising max-angle further trades legibility for coverage.

## A42 — Complete route coverage · SHIPPED take 45

- **PROVEN:** 648 -> 1,027 routes. DNR MapServer (FeatureServer was withholding
  36 features incl. 6 ORV trails), ten non-ORV DNR layers, the full NFS trail
  set, and the OSM path classes that were fetched and dropped.
- **PROVEN:** completeness guard compares payload against `returnCountOnly` per
  layer; class-legality invariant checked against the built graph, with a
  negative control.
- **Ruled out:** maintaining SHOW_ONLY beside CLS as the only protection. Two
  lists that must agree is how a footpath becomes a suggested route.
- **Open:** DNR layer 19 carries `SurfaceType`, which reopens A10 (sand vs
  hardpack) — I had written that off as unavailable and was wrong.

## A43 — Map reads like a trail map · SHIPPED take 46

- **PROVEN:** difficulty-tiered colours (green/blue/black), unconditional white
  casing, white-on-halo labels, scale bar, floating elevation readout, debug bar
  and Frames/s off the navigation screen.
- **Ruled out:** colouring by agency/class. It encoded who drew the line, not
  what riding it costs.
- **Open, from Jacob's references:** trail detail card (name, difficulty, length,
  climb, surface, elevation profile) on tap; POI markers for trailheads and
  campgrounds — DNR layer 19 carries FacilityType/SiteName, so the data is there;
  land-ownership shading; a difficulty legend so the colours are learnable.

## A44 — ORV coverage reconciled · CLOSED take 47

- **PROVEN:** state ORV coverage matches DNR layer 19 exactly (199 = 199), with
  the 12 temporarily-closed segments matching the agency's own status field.
- **PROVEN:** MVUM roads 366 = 342 ridable + 24 with no motorcycle/ATV legality;
  MVUM trails 46, all motorcycle-legal, all present.
- **PROVEN:** no ridable trail is drawn as non-ridable — 70 multi-use duplicates
  dropped in favour of the ridable designation.
- **Ruled out:** trusting the ingest because it "looks complete". Both agencies
  publish totals to check against.
- **Open:** only a rider can confirm the map matches the ground.

## A45 — One-step GitHub import · SHIPPED take 48

- **PROVEN:** `apex.yml` merges seed + bundle + pages + apk into one file. Seed
  unzips, gates before committing, pushes, and the build continues in the same
  run. Simulated against an empty directory holding only the zip.
- **PROVEN:** the gate reads every workflow file, not a hardcoded name — the
  single-file layout and the two-file layout both pass.
- **Ruled out:** paste-two-workflows-plus-cut-a-release. Correct, and needlessly
  hard from a phone.

## A46 — CI actually publishes the APK · FIXED take 49

- **PROVEN:** `steps.pkg.outputs.apk` referenced a step id that did not exist, so
  every release would have published with no asset attached. Fixed and guarded
  by `check_workflow_refs()`, negative-controlled.
- **PROVEN:** `apex.yml` now preserves the top-level `env:` block; asserted at
  generation time.
- **Ruled out:** trusting a workflow because it parses. Valid YAML with an
  unresolved step reference runs to completion and publishes nothing.
- **Open:** none of this has run on GitHub yet. The first real CI run is the
  test — everything here is static analysis and simulation.

## A46b — First-run failures are legible · SHIPPED take 49

*Numbered A46 in error at take 49, when A46 was already taken by the APK-publish
item above. Disambiguated at take 82 rather than renumbered: A46 keeps its
meaning, this keeps a citable id of its own.*

- **PROVEN:** seed accepts apex-seed.zip or apex-orv-github-repo.zip, flattening
  the nested shape; bundle refuses in seconds with a message naming the missing
  files and the right zip. All three cases simulated against real directories.
- **Ruled out:** one accepted filename. The other zip is the one whose name
  sounds right.

## A47 — Workflow validity · CLOSED take 50

- **PROVEN:** build.yml had two `concurrency:` keys since take 20 — invalid to
  GitHub, invisible to safe_load. Removed; gate now rejects duplicate keys in
  any workflow, negative-controlled.
- **PROVEN:** apex.yml is generated by tools/mkapex.py from build.yml, with
  assertions on job order and `needs`, strict-validated before writing.
- **Ruled out:** hand-maintaining or hand-splicing the second workflow copy.
- **Open:** nothing here is confirmed until a run actually goes green on
  GitHub. Local validation missed this for thirty takes.

## A48 — Seeder vs workflow permissions · CLOSED take 51

- **PROVEN:** the seed deletes `.github/` before copying; a pasted apex.yml
  survives byte-for-byte and no second workflow appears. Simulated.
- **PROVEN:** canonical build definition at `ci/build.yml`, generated copy at
  `.github/workflows/apex.yml`; gate and scan_hosts read both locations.
- **Ruled out:** shipping build.yml inside the seed. GITHUB_TOKEN cannot push it
  and it would double every build.

## A49 — Build runs on a machine that is not mine · CLOSED take 56

- **PROVEN:** repo seeds and commits on GitHub; ingest, pack, graph, emit_graph
  and terrain all complete on ubuntu-latest.
- **PROVEN:** typeface vendored at assets/fonts/; gate rejects any tool path
  outside the repo, negative-controlled.
- **Ruled out:** local verification as evidence that CI works. Fifty takes of
  green pipelines here missed two hand-dependencies that a clean runner found in
  four minutes.
- **Open:** the run has not yet reached glyphs → bundle → APK on the runner.

## A50 — Environment faults are gated, not discovered · SHIPPED take 53

- **PROVEN:** three gate checks now cover the class — absolute paths outside the
  repo, third-party imports CI does not install, and vendored assets. Each
  negative-controlled.
- **Ruled out:** fixing environment faults one CI run at a time. Three in three
  runs, all the same shape.
- **PROVEN take 54:** the bundle job completes on ubuntu-latest — pipeline,
  both smokes, render and gate all green on a machine that is not mine.
- **Open:** the apk job has not yet produced an APK on the runner.

## A51 — Workflow is a stable shim · SHIPPED take 55

- **PROVEN:** volatile CI steps live in ci/bundle.sh and ci/apk.sh, which the
  seed updates; the pasted workflow shrank to six and seven steps and should
  rarely change again.
- **PROVEN:** APEX_GATE_SEED=1 lets the seed gate its own contents without being
  blocked by a stale pasted workflow. Simulated end to end.
- **Ruled out:** gating the seed against the workflow file. It deadlocks the fix.

## A52 — CI runs the tree the seed just pushed · SHIPPED take 56

- **PROVEN:** downstream checkouts pin `ref: github.ref_name`; gate fails without
  it, negative-controlled against the real apex.yml.
- **PROVEN:** mkapex writes the repo copy, so the gate validates the workflow
  that actually runs — previously it validated only ci/build.yml, which has no
  seed job.
- **Ruled out:** assuming checkout follows the branch tip.

## A52b — Build survives an OSM outage · SHIPPED take 56

*Numbered A52 in error at take 56, when A52 was already taken by the seed-tree
item above. Disambiguated at take 82, not renumbered.*

- **PROVEN:** with every Overpass mirror pointed at an invalid host, TIGER
  produced 4,100 roads incl. 414 4WD vehicular trails, and the graph built to
  2,856 mi at 99.8% connectivity.
- **PROVEN:** OSM remains primary; the normal path is unchanged and still wins.
- **Ruled out:** OSM as a hard dependency for roads. It is volunteer-run and it
  stopped a build.
- **Open:** water is still OSM-only, so an outage yields a PARTIAL bundle. That
  is honest and the app says so.

## A53 — Labels legible on the real screen · SHIPPED take 57

- **PROVEN:** harness now runs at 411x960 dpr 2.625 and reproduces the device
  (4 names vs Jacob's 3, where it used to claim 8). Swept params at that size:
  6 names at z14.5.
- **PROVEN:** ridable names outrank show-only ones, and survive Satellite —
  Map 3 · Satellite 3 · Hybrid 3, where Satellite was 0.
- **Ruled out:** tuning label density against a 900x1400 harness. It measured a
  screen that does not exist.
- **Open:** A18 Stage 1 — still no recorded ride. Battery and canopy GPS remain
  unmeasured.

## A54 — Ridable dirt looks ridable; routes state their approval · SHIPPED take 58

- **PROVEN:** track + fsroad (1,169 mi, 52% of network) styled as ridable dirt
  with casing, distinct from both designated trail and pavement.
- **PROVEN:** every route card shows designated / forest road / paved miles and
  an approval tag. "Most trail" profile returns 93% designated where Fastest
  returned 0%.
- **Ruled out:** trusting distance alone to rank routes for a dirt bike.
- **Open:** an emergency profile crossing non-ORV line. Pavement is already
  never forbidden; routing onto a hiking trail needs more than a multiplier.

## A55 — Fallback data stays inside the region · CLOSED take 59

- **PROVEN:** TIGER geometry clipped to bbox+0.02; nodes outside the gate's
  tolerance fell 3.14% -> 0.01%. OSM path unchanged at 0.11%.
- **PROVEN:** failure reproduced locally before the fix by forcing every mirror
  to fail, and both paths re-measured after.
- **Ruled out:** keeping a whole way because one point is near the region.

## A56 — Fallback cannot become permanent · CLOSED take 60

- **PROVEN:** TIGER-derived aoi.json is marked at write time; fetch_osm retries
  OSM on seeing the marker instead of skipping. Both cache states exercised
  against the real ingest, with Overpass genuinely down for the second.
- **Ruled out:** treating file existence as proof the data is good.

## A57 — Road / two-track / trail read distinctly · SHIPPED take 61

- **PROVEN:** four weights distinguishable in one view at Wagner Lake — 18
  designated, 37 two-track, 19 forest road, 25 road.
- **PROVEN:** attribution collapsed to 24 px on load; no longer covers a chip.
- **Ruled out:** one colour for all ridable dirt. A forest road is drivable, a
  two-track is ridable, and the source splits single roads between them.

## A58 — Opening state and control placement · SHIPPED take 62

- **PROVEN:** only Labels enabled at open; Relief off; basemap opens on Map with
  satellite off and hillshade at 0; attribution collapsed.
- **PROVEN:** map-detail button floats at left 11 / top 104, under the scale, and
  turns orange on satellite. Verified via computed style, not just a screenshot.
- **PROVEN by data:** road/trail distinction holds across all classes — 0 of
  3,211 designated-trail edges carry a road name; all 9,526 road edges are grey.
- **Ruled out:** burying map detail in the horizontally scrolling chip strip,
  and opening on satellite. A basemap is a choice, not a landing state.
- **Ruled out:** trusting a screenshot to confirm placement — the button looked
  absent and computed style showed why.
- **Open:** the 534 road-named two-tracks (Bull Gap Road et al.) are brown by
  design. Only a rider can confirm they are two-track on the ground.

## A59 — Relief costs nothing when off · SHIPPED take 63

- **PROVEN:** hillshade uses visibility:none when off, not opacity 0 — no raster
  draw on the default view. Four states measured: open none, on visible/0.42,
  satellite+on visible/0.16, off none.
- **Ruled out:** fading a layer to zero as a way of disabling it. It keeps the
  GPU work and hides the cost.
- **Open:** whether this shows up in the A18 battery figure. Only a ride tells.

## A60 — Duplicate agency/OSM geometry · SHIPPED take 86

- **PROVEN:** 5,390 spans carry >1 edge; 1,957 are fsroad+track. Visible as
  jagged parallel lines at riding zoom.
- **PROVEN:** dropping OSM duplicates at 45 m removes 558 mi and costs
  connectivity (99.7% -> 97.4%). At 17 m it is safe but removes only 14 ways.
- **Ruled out:** deleting the duplicate. The sources differ topologically and
  the OSM way bridges gaps the agency geometry leaves.
- **Open:** mark duplicates through emit_graph and filter them from the render
  layers only — routable but drawn once.

## A61 — Works on ordinary Android phones · SHIPPED take 65

- **PROVEN:** layout checked at 360x800, 412x915, 430x932 and 411x960; harness
  default is a mid-size phone, not the Fold. Negative-controlled.
- **PROVEN:** labels appear at z11.5-12 (scale 3000 ft-1 mi) where they
  previously needed z12.5; measured against the scale bar.
- **Ruled out:** treating horizontal overflow inside a scrolling strip as an
  unreachable control.
- **Open:** never run on any device other than the Fold. Only a second phone
  settles it.

## A62 — Every named feature is readable without tapping · SHIPPED take 66

- **PROVEN:** short named strokes get a wrapping point label; 8 names appeared at
  Bull Gap that had never drawn, including M-33 Bull Gap Trailhead.
- **PROVEN:** show-only routes coloured by use (hiking lime, equestrian violet,
  ski/snowmobile cyan, NFS motorised amber), still dashed.
- **PROVEN:** release notes read from ci/RELEASE.md so the seed can update them.
- **Ruled out:** line-center placement for short features. It still fits text to
  the line and drew nothing.
- **Open:** whether the brighter blue and wider casing are enough under real
  canopy on a real screen in daylight.

## A63 — Activity filter and legend · SHIPPED take 67

- **PROVEN:** picker filters the map (ORV 143/0/0, hiking 0/0/45, roads always
  233) and shows a colour swatch per discipline, generated from the same table
  the style uses.
- **PROVEN:** swatch colours verified by computed style per row, dashed for every
  non-ridable discipline.
- **Ruled out:** a hand-written legend. It drifts from the map by construction.
- **Open:** whether "roads always visible" is right when filtering to hiking.
  Only riding with it settles that.

## A64 — Loops and profiles use what we already compute · SHIPPED take 68

- **PROVEN:** loops costed from DESIG/DIRT; first loop offered went from 4.7 mi
  trail of 14.3 to 15.0 of 15.0.
- **PROVEN:** elevation profile filled, card-width, low/high in feet; layout
  verified by computed style at 360x800.
- **Ruled out:** hand-written class weights in the loop generator. They drifted
  from the routing tables for ten takes.
- **Open:** address coverage is still 2/8 at anchors, and trail-names 4 of 84.
  Both are next.

## A65 — Location is stated as strongly as the data allows · SHIPPED take 69

- **PROVEN:** anchors went 2/8 to 2 exact + 4 near; near form is a bearing and
  distance from an addressed road, never the address itself.
- **PROVEN:** all four bearings recomputed independently from segment geometry
  and agree (Mio NW, Rose City SE, Luzerne W, South Branch S).
- **Ruled out:** silence beyond ADDR_CAP. It discarded a true answer.
- **Open:** Bull Gap is 2.5 km from any addressed road. Nothing to say there,
  and the app says nothing — which is correct.

## A66 — Directions usable mid-ride · SHIPPED take 70

- **PROVEN:** every step carries the running total at its start; verified across
  a 13-step 11.1 mi route at 360x800.
- **PROVEN:** unnamed features read "unnamed two-track" in italic rather than
  presenting a class as a name.
- **Ruled out:** showing only per-step distance. It cannot answer "which step am
  I on", which is the question a rider actually has.
- **Open:** consecutive steps on the same trail with different IDs are not
  merged. The IDs match markers on the ground, so that may be correct.

## A67 — Dispatch states the strongest location available · SHIPPED take 71

- **PROVEN:** dispatch leads with the address after the coordinate — exact where
  known, bearing-and-distance otherwise, labelled so the two cannot be confused.
  Verified at two real coordinates via browser geolocation.
- **PROVEN:** unnamed features read "an unnamed two-track" on the card.
- **Ruled out:** a dispatch card without an address. It withheld the one field a
  dispatcher can act on directly.
- **CLOSED take 72:** county stated on the dispatch card, 100% agreement with
  unsimplified Census boundaries over 3,000 sampled points.

## A68 — County on dispatch · SHIPPED take 72

- **PROVEN:** 9 counties in context.json (70 points, 1.4 KB); dispatch names the
  county; 3,000 random points match full-resolution Census polygons exactly.
- **Ruled out:** trusting four named towns as evidence a simplified boundary is
  safe.
- **Open:** nothing states the county on the place card, only on dispatch. That
  may be right — the card is for planning, dispatch is for help.

## A69 — Search audit and release test script · SHIPPED take 73

- **PROVEN:** six realistic near-miss queries all resolve (mcct, pinkstore,
  h5717, bul gap, wagnr) with exact queries unchanged and fuzzy strictly ranked
  below exact.
- **PROVEN:** search types match the map's road/trail distinction.
- **Ruled out:** exact-only matching for a rider in gloves.
- **Open:** field test — the next report is Jacob's, against the eleven-item
  script in ci/RELEASE.md.

## A70 — Labels at the 1 mi scale · SHIPPED take 74

- **PROVEN:** trail/road names render from z11 (1 mi): 3 trail + 25 road labels
  measured at 412x915; z11.3 screenshot shows clean spacing, names tracking
  roads.
- **PROVEN:** forest-road numbers deliberately held to 3000 ft (11 at z12).
- **Ruled out:** lowering fsroad to 1 mi as well — 4-digit IDs at that scale are
  noise where road names are signal.
- **Open:** the field answer. Jacob is riding take 73; take 74 is the build that
  should make the "zoomed out" complaint go away.

## A71 — v1 complete · take 75

- **PROVEN:** v1 field-tested at take 73 — 41 PASS / 0 FAIL on-device, first
  fix 5.8 s ±6 m, filter/cards/labels/satellite confirmed by screenshots.
- **PROVEN:** the repo is self-describing: README, V1-STATE, HANDOFF (75
  takes), LANDMINES (103 rules), AGENDA, V2 kickoff brief.
- **Ruled out:** ending v1 with essential knowledge living only in chat
  transcripts — everything durable is in the repository.
- **Open:** v2. It begins with a study-only session driven by
  docs/V2-KICKOFF-PROMPT.md; A18 and A60 head the technical queue.

## A99 — Bundle honesty: an empty layer is not a layer · CLOSED take 76

*A72–A98 are reserved for the v2 backlog derived from the onX study and the
take-75 review; they land next cycle. This took A99 so no number already quoted
has to move — numbers are never reused or renumbered.*

- **PROVEN:** `pack.py` emitted a 65-byte water payload with both buckets empty;
  `verify()` passed it on existence, size and SHA-256 and reported COMPLETE while
  `ingest` had already printed "bundle will be PARTIAL".
- **PROVEN:** the same blindness applied to REQUIRED artifacts. Reconstructing
  the take-75 predicate against a bundle whose `graph.json` was never staged
  returns **COMPLETE**; it now returns **UNUSABLE**.
- **PROVEN:** stale artifacts survived in `bundles/<id>/` and in `www/bundle/`,
  so a layer the pipeline had just refused to produce was copied onward into what
  `cap sync` packages — defeating the app's own correct manifest-keyed check.
- **PROVEN:** `build_app.single()` hardcoded `state:"complete", absent:[]`.
- **PROVEN, both directions:** with water absent → PARTIAL, `water.json` named,
  smoke 5 modes / 192 assertions, render 26 checks / 4,304 features, gate green.
  With three synthetic water ways through the real `pack.py` → COMPLETE, smoke
  asserts "not PARTIAL", self-test 37/0, gate green.
- **PROVEN, negative controls:** an empty artifact staged and hashed into the
  manifest fails the gate by name; a missing required artifact verifies unusable.
- **Ruled out:** a byte-size threshold for "empty". It is a guess that fails on a
  region with one small pond. Counting features is exact and reads off the real
  payload shape.
- **Ruled out:** fixing this in `pack.py` alone. A safety-relevant path deserves
  two guards (landmine 74), and the bundler's guard catches producers that do not
  exist yet.
- **Ruled out:** asserting `state === 'complete'` anywhere. PARTIAL is a designed
  state; asserting completeness scored correct behaviour as failure in two
  separate harnesses (landmine 56's corollary).
- **Open:** the app's `OPT` list (`imagery`, `relief`, `hydro`) is hand-kept
  beside `bundle.py`'s `ARTIFACTS`. Two lists that must agree is the shape
  landmine 73 warns about. Not urgent — the loader degrades safely either way —
  but it wants the same treatment: derive one from the other, or gate them.

## A74 — One colour table, vibrant, and a legend that explains it · SHIPPED take 77

- **PROVEN:** `ACTS` swatch `#A9702F` vs layer `#9C7343` — dE 12.9, and
  `#A9702F` was in no layer anywhere. The legend read a copy (landmine 107).
- **PROVEN, in the browser:** all six network swatches now equal the colour
  MapLibre paints, computed style per row, 18 checks.
- **PROVEN, 1,048,576 satellite pixels:** dE vs canopy — easy 26.1→49.2,
  moderate 62.5→74.4, two-track 29.0→41.7.
- **PROVEN:** `showother` sat dE 5.2 from `fsroad` — a non-ridable route nearly
  indistinguishable from a ridable forest road. Now 25.5.
- **Ruled out:** `#B0722B` for two-track. Best on visibility, dE 12.5 from
  `nfsmoto` amber, which the MVUM governs — landmine 88 through the palette.
- **Ruled out:** solving `fsroad` with colour. Nine candidates; light gains on
  canopy exactly as fast as it loses on sand. Fixed with a casing instead.
- **Ruled out:** legend rows for `minor` and `paved` — grey means road, and two
  more rows costs panel height on a 360 px screen. Declared in `LEGEND_EXEMPT`
  with the reason, and gated so a fourth class cannot join them silently.
- **Open:** the three difficulty tiers are stated in the picker but nowhere on
  the map itself. Only a ride says whether that is enough.

## A72–A98 — the v2 backlog, from the onX study and the take-75 review

Recorded here so the numbering lives in the repo rather than in a chat
transcript. Where an item below also has its own `##` heading elsewhere in this
file, that heading is the outcome and this bullet is the original proposal. Each is expanded in `docs/V2-PROPOSALS.md`. Ordering is by
blocking-ness; labels are PROVEN-need / INFERRED / UNKNOWN.

- **A72 — statewide ORV coverage, two-tier.** PROVEN-need, deferred behind the
  square by Jacob's decision. Measured take 75: DNR ORV 4,475 features
  statewide, MVUM 9,523 roads + 3,480 trails; Michigan is 236× the Bull Gap AOI
  by area but only 18–26× by network. Agency vector statewide ≈ 8–15 MB.
  *Ruled out:* one statewide bundle; statewide imagery (8.6 GB at z15);
  statewide addresses.
- **A73 — derive the region set from the data.** INFERRED. *Ruled out:*
  hand-drawing ten bboxes, which is ten chances to mistype a corner.
- **A75 — highway and route shields.** INFERRED. Answers "which road am I two
  east of" faster than a name. *Ruled out:* nothing yet; needs glyph coverage
  checked first (landmine 30).
- **A76 — named summits with elevation.** INFERRED, GNIS + our DEM. *Ruled out:*
  deriving summit names from topology — a name nobody can check against the
  ground, same reasoning as A7.
- **A77 — water feature labels.** INFERRED. We draw water and never name it.
- **A78 — trailhead and access-point markers.** INFERRED. A43 already recorded
  that DNR layer 19 carries `FacilityType` and `SiteName`. *Ruled out:* planning
  the feature before querying the values (landmine 23).
- **A79 — draw the county lines.** INFERRED. *Open:* A32 warns they risk reading
  as roads; needs a weight that says administrative.
- **A80–A83 — compass ribbon, speed readout, live ride HUD, zoom buttons.**
  INFERRED, all from telemetry and gestures already present. A82 is PROVEN-need:
  take 41 records time, distance and elevation and only elevation is shown.
- **A84 — tools palette.** INFERRED. Line distance, area shape, mark location,
  waypoint, photo.
- **A85 — named, saved waypoints and routes.** PROVEN-need. A28's last
  enumerated gap, listed missing at take 25 and never built.
- **A86 — filter by machine and by difficulty.** INFERRED. *Ruled out:* onX's
  width taxonomy, which lists 60"; Michigan designates 24"/50"/72".
- **A87 — topo basemap with contours.** INFERRED, a fifth product of the DEM
  ingest already run.
- **A88 — slope angle shading.** INFERRED, extends A14. *Ruled out:* using the
  rendered hillshade; needs the encoded DEM (landmine 20). Sequence after A18 —
  per-frame GPU work on an unmeasured power budget.
- **A89 — cell carrier coverage, offline.** UNKNOWN. The best idea on onX's
  layer strip and the one that pairs with our dispatch card. *Ruled out:*
  planning it before checking FCC Broadband Data Collection resolution, size and
  licence.
- **A90 — dispersed camping.** INFERRED, USFS publishes it.
- **A91 — layer manager.** INFERRED. The chip strip cannot absorb topo, slope,
  coverage, camping and county lines. Do it before the layers arrive.
- **A92 — five-mode navigation.** UNKNOWN. Recorded so it is not re-derived.
  *Ruled out for now:* more structure than this app currently needs.
- **A93 — ledger hygiene.** PROVEN-need. Two `## Take 56`, two `## Take 49`, two
  `A46`, two `A52`, `A36` before `A35`, and LANDMINES §0 repeats a ~40-row
  block. Take 43 deduped exactly this and it re-accumulated. *Ruled out:*
  renumbering anything — a duplicate/gap CHECK, not a renumber.
- **A94 — `region.DERIVED` omissions.** INFERRED. `context_payload.json`,
  `address_payload.json`, `imagery_tiles/` not cleared on a region switch;
  `address.py`'s early return leaves the previous region's index. Landmine 37's
  shape. *Ruled out:* treating it as urgent while one region ships — but it is a
  precondition for A72.
- **A95 — `sthelen` anchors outside its own bbox.** UNKNOWN. Roscommon 2.5 km
  west of the edge, Houghton Lake 16 km. Not traced; may be a deliberate
  signpost.
- **A96 — dispatch-path latency.** UNKNOWN. `nearestEdge()` decodes all 20,222
  polylines per call on the highest-stakes screen. *Ruled out:* optimising
  before measuring on the device.
- **A97 — weather, radar, air quality, share location.** Ruled out for the
  field: all network, and nothing in the field may wait on a call (§8).
  Recorded so they are not re-proposed as offline features.
- **A98 — SOS.** Ruled out by design. A satellite messenger does something no
  map can; the README says so and that is better than a feature.

## A80 · A81 · A82 — Ride HUD: heading, speed, trip · SHIPPED take 78

- **PROVEN:** `coords.speed` and `coords.heading` arrived on every fix since
  take 21 and were discarded in both drivers. A82 was an unconnected wire, not
  an unbuilt feature.
- **PROVEN, independently computed:** harness steps of +8e-4 lon / +5e-4 lat give
  `atan2(0.03941, 0.03450)` = 48.8° = NE, and the ribbon centres on NE. A fix
  carrying `heading: 90` centres on E; `speed: 8.9408 m/s` reads 20 mph.
- **PROVEN, four devices with the ride state forced on:** ribbon exactly
  full-width at 360 / 412 / 430 / 411, stats inside the right edge at all four.
- **Ruled out:** adding HUD height to the screen. The ribbon takes the place-chip
  strip's slot, because those chips jump the camera to a town and the map
  recentres on the rider every sixth fix — they undo themselves during a ride.
- **Ruled out:** `deviceorientation` for a magnetic compass. Course-over-ground
  from the fix is what a moving rider wants, needs no new permission, and works
  identically in the simulator.
- **Ruled out:** asserting a fixed HUD state in the self-test. `hud-matches-ride`
  asserts the response to the ride state, whichever it is (landmine 56).
- **Open:** speed derived from the trail cannot be exercised by the harness —
  no wall-clock elapses between synchronous fixes. Only a ride shows whether the
  derived path reads sensibly when `coords.speed` is null.
- **Open:** A83, zoom buttons. Held back deliberately — map controls are a
  different concern from ride instrumentation, and the screen is crowded.

### A60 status at take 78 — BLOCKED (see A60 above)

- **PROVEN:** Overpass down at take 78 — `overpass-api.de` 503,
  `overpass.kumi.systems` 500 after 53 s, `overpass.osm.ch` HTTP 200 with
  `count = 0` for a box that certainly has roads (landmine 74's signature).
- **Ruled out:** doing A60 on the TIGER fallback network. A60 is about
  OSM↔agency duplicate geometry; TIGER produces a different duplicate profile,
  so the take-64 measurements would not transfer and the fix would be tuned
  against a network the rider will not have.
- **Blocked on:** OpenStreetMap returning. Re-ingest first; the take-60 marker
  retries automatically.

## A85 — Save and name a planned route · SHIPPED take 79

- **PROVEN:** A28's last enumerated gap, named missing at take 25, open until now.
- **PROVEN, structurally:** the stored record contains no `path`, `geom`, `line`
  or `coords` — reopening re-routes from inputs against current data.
- **PROVEN:** save → storage write → one record → list → Open control rendered,
  across five smoke modes; re-saving under the same name replaces.
- **Ruled out:** storing route geometry. The bundle carries twelve
  temporarily-closed segments refreshed every build; a frozen line replays a
  legality decision made against data that has since moved (landmine 113).
- **Ruled out:** a naming dialog on the save path. One tap, auto-named from what
  the route is; rename lives in the panel where there is time. Gloves.
- **Ruled out:** offering routes saved in another region — a line planned on a
  different map is not meaningful, so records are region-stamped.
- **Open:** saved *waypoints* and geotagged photos (the rest of A84) are not
  built. Routes were the enumerated gap; waypoints are the natural next.
- **Open:** only a ride shows whether auto-generated names are distinguishable
  once there are a dozen of them.

## A86 — Machine legality shown on the map · SHIPPED take 80

- **PROVEN:** the router refused illegal line from take 7 and the map said
  nothing — 24" singletrack and 72" route were drawn identically.
- **PROVEN, in the browser:** illegal line still draws 34 features for a
  side-by-side, the same 34 as for a dirt bike — dimmed, not hidden, asserted by
  count rather than by appearance.
- **PROVEN:** the casing's 0.95 base resolves to 0.285 under dimming, a number
  that appears nowhere in the source — the base is read out of the style, not
  copied (landmine 107).
- **Ruled out:** hiding illegal line. It denies that the trail exists, which is
  the fault landmine 34 exists to prevent.
- **Ruled out:** dashing it. Dashed means "never yours to ride"; a motorcycle
  trail is legal ORV line that a 72" machine simply cannot fit (landmine 115).
- **Ruled out:** dimming closed line. It is closed to everyone, red already says
  so, and fading it weakens the one colour that must not be missed.
- **Ruled out:** a per-layer opacity toggle. `casing` covers five classes in one
  layer, so legality has to be a per-feature expression.
- **Open:** difficulty filtering (the other half of onX's filter sheet) is not
  built. Machine legality was the honesty gap; difficulty is preference.
- **Open:** whether 0.30 is the right dim. Faint enough to recede, strong enough
  to still plan around — only sunlight settles that.

## A86b — Per-vehicle machine legality in the router · SHIPPED take 81

- **PROVEN:** 25 `fstrail` edges (1.95 mi) carry `moto: open` with `atv` unset,
  MVUM symbol "Trails open to motorcycles, Yearlong". Class `fstrail` is in
  `quad.ok`, so class-only routing put a quad on a motorcycle trail.
- **PROVEN, per machine, against the built graph:** bike 0 excluded, quad 25
  edges / 1.95 mi excluded, sxs 0 excluded.
- **PROVEN, four negative controls:** router reverted to class-only, snapper
  diverged from router, `machineLegal` removed, raw allow-list reintroduced —
  all four fail the gate.
- **Ruled out:** class-only legality. The DNR encodes width in the layer; the
  Forest Service does not encode anything in the class (landmine 116).
- **Ruled out:** treating an absent flag as permission. Anything other than
  "open" is not a licence to ride.
- **Open:** `sxs` has no per-vehicle flag stored. The MVUM's
  `other_ohv_gt50inches` and `highclearancevehicle` are fetched by ingest and
  dropped before the bundle; sxs falls back to the class rule, which excludes
  `fstrail` entirely — conservative, not wrong. Storing them is a small ingest
  and emit change.

## A101 — SpecialRestrictionType · SHIPPED take 95 (raised take 81)

*A precondition for A72. Numbered separately so it is citable on its own.*

- **PROVEN:** the DNR field carries real law — *"ORVs less than 65 inches in
  width only between the dates of May 1st and November 1st. Off road motorcycles
  are prohibited"* — including seasonal windows and explicit machine bans.
- **PROVEN:** **zero** of the 246 in-region features carry one, so the square is
  unaffected today. The ingest field list is
  `namefield,TrailNamePrimary,TrailWidthFeet,OpenClosedStatusORV,LicenseType,TrailOnRoad`.
- **Ruled out:** treating this as urgent for Bull Gap. It is latent, and becomes
  live the moment A72 pulls in features from outside this box.
- **Ruled out:** the alarm about `LicenseType: "Snowmobile Trail Permit"` —
  1,418 of 1,889 ORV Routes statewide carry it, records read
  `TrailUseCategory: Motorized` and `OpenClosedStatusORV: Open`, and one states
  "ORV license and trail permit required". It records a winter co-designation,
  not an ORV restriction. My expectation was wrong, not the data.
- **Blocked on:** A72, which is itself blocked behind the square being ridden.

## A100 — Jacob's machine is a narrow dirt bike · NOTED take 82

Recorded so it is not re-derived, and so it is not mistaken for a null result.

- **PROVEN (take 81, measured):** on the `bike` profile the per-vehicle rules
  exclude **0 edges / 0.00 mi**. The 25-edge quad exclusion touches nothing he
  rides.
- **Consequence for debugging:** if a route looks wrong on his phone, machine
  legality is *not* the first place to look. Every width and vehicle rule in the
  app is permissive for a narrow bike; the cause will be elsewhere.
- **Consequence for testing:** the take-80 dimming and take-81 routing changes
  are effectively invisible to him. He cannot confirm them by riding, and should
  not be asked to. They are verified in the harness instead.
- **Ruled out:** removing or simplifying the machine model. It is correct, it is
  gated, and it becomes live the moment anyone else runs this build or A72 pulls
  in features from outside the box.
- **Open:** no second machine has ever run this app, so the quad and sxs paths
  have never been exercised on a device — only in the harness (A61's family).

## A93 — Ledger integrity, gated · SHIPPED take 82

- **PROVEN:** take 43 deduped by hand and declared "no gaps, no duplicates". By
  take 81: Take 49 ×2, Take 56 ×2, A46 ×2, A52 ×2, landmines 78 ×2 and 85 ×2 —
  plus A60, A72 and A87 created by me in takes 78–82.
- **PROVEN, the serious one:** landmine 78 was two *different* lessons sharing a
  number cited by both `mkapex.py` and `gate.py`.
- **PROVEN, five negative controls:** duplicate take, missing take, duplicate
  agenda id, duplicate landmine, landmine gap — all fail the gate, verified
  against a harness that proves itself with a baseline note first.
- **Ruled out:** renumbering anything already cited. Disambiguated instead —
  A46b, A52b, Take 49b, Take 56b, landmine 119 — with the reason in each entry.
- **Ruled out:** special-casing the checker so a "restated" landmine parses as
  not-a-definition. 85 was merged into one entry instead; one definition per
  number is the rule the checker exists to enforce.

## A102 — Overpass is unreachable here; OSM is not · CORRECTED take 83

- **PROVEN:** `api.openstreetmap.org/api/0.6/map?bbox=` → 200, 660,710 bytes of
  real data for the Bull Gap bbox. `openstreetmap.org` 200, tile server 200.
- **PROVEN:** `overpass-api.de` → 503 on `GET /`, Envoy body, three headers, DNS
  resolving correctly to 162.55.144.139. The host is unreachable from the build
  environment; its own health is unknown from here.
- **PROVEN:** `overpass.osm.ch` is region-limited — Bern 4,176 ways, Bull Gap 0.
  It cannot serve this project and never could.
- **PROVEN:** `overpass.private.coffee` returns a real 500/502 (host reached);
  `osm.jp`, `openstreetmap.ru`, `nchc.org.tw` all give the same Envoy 503.
- **Ruled out:** "OpenStreetMap is down." It is not, and was not.
- **Ruled out:** keeping `overpass.osm.ch` in the mirror list. A fallback that
  cannot serve the region is worse than no fallback — it answers 200 and looks
  like data.
- **Open:** A60 is *not* unblocked by this. It needs the OSM road network for
  this region, and no reachable Overpass instance currently serves it.

## A103 — Water from TIGER when the OSM path is unavailable · SUPERSEDED take 85

The bundle has shipped PARTIAL since take 76 because water comes only from OSM.
It does not have to.

- **PROVEN:** Census TIGER publishes `AREAWATER` and `LINEARWATER` per county.
  All eight files for the region's four address counties return 200 —
  139–643 KB each — from `www2.census.gov`, **already declared in PROVISION and
  already working** while Overpass is not.
- **PROVEN:** `tools/context.py` already contains a working `parse_shp()`; the
  TIGER road fallback (take 56) already fetches and clips county shapefiles.
- **Shape:** when `aoi.json` carries `source: tiger`, fetch water from TIGER for
  the same counties, clip to the bbox as the road fallback does (landmine 89),
  and emit the existing water payload. Bundle returns to COMPLETE honestly.
- **Ruled out:** copying `parse_shp` into `pack.py`. Import it — a copy of a
  table is not the table (landmine 107).
- **Ruled out:** the OSM main API as a bulk source. It works from here, but the
  region exceeds its bbox limit and it is an editing API, not a download path.
- **Open:** whether TIGER water and OSM water differ enough to be worth marking
  provenance on. The app already stamps `src` per feature elsewhere.

## A104 — Clear a route · SHIPPED take 83

- **PROVEN, field:** Jacob closed the directions panel and the route line stayed
  on the map with no way to remove it.
- **PROVEN:** `clearRoute()` has existed since take 33 and clears route,
  alternates and approach legs. It was bound only to side effects — machine
  change, home move, pin move — never to a control.
- **PROVEN, real browser:** 226 route features → 0 on tap.
- **Ruled out:** clearing automatically when the panel is dismissed. Dismissing a
  panel is not the same gesture as discarding a plan; you may want the line up
  while you read the map.

## A105 — The self-test left the HUD on · FIXED take 83

- **PROVEN, field:** the compass ribbon appeared during the self-test and stayed,
  over the place chips, with no heading.
- **PROVEN:** the safety drill calls `startRecording()`, which turns the HUD on;
  the restore block restored seven variables and no visible state.
- **Ruled out:** asserting this in `smoke.mjs`. The stub does not model the
  initial `hidden` attribute, so the check read false before and false after and
  passed vacuously (landmine 85). It lives in `render.mjs` where `hidden` is real.
- **Open:** the drill still calls `startRecording()` directly rather than going
  through the ride start/stop path a rider uses. Driving it through the real path
  would have made this impossible instead of merely fixed.

## A106 — fps scored a backgrounded app as a failure · FIXED take 83

- **PROVEN, field:** take-82 report read `avg 2 · worst 39402ms` — a 39-second
  frame — while 69 of 70 frames were under 33 ms. That is a screenshot being
  taken, not a device struggling.
- **Ruled out:** judging the frame rate at all when the page has been hidden.
  `requestAnimationFrame` pauses in the background; the worst frame is the length
  of the absence. Reported as info, not scored (landmine 56's corollary).

## A107 — Local OSM extract as a measurement instrument · SHIPPED take 84

- **PROVEN:** Overpass is unreachable from the development container and fine
  from CI (take 83). `download.geofabrik.de` is reachable at 16 MB/s; the
  Michigan extract is 297 MB.
- **PROVEN, validated against the record:** `emit_graph` returns 20,222 edges /
  12,236 nodes / 99.7% routable — the take-74 numbers exactly — and water
  returns at 244 polys / 180 lines.
- **PROVEN:** the tag set is read out of `ingest.py`'s Overpass query and
  compared, so the two cannot drift silently. It caught my own regex error on
  the first run.
- **Ruled out:** making it a pipeline step or a fallback tier. That means a
  297 MB download and a compiled dependency inside the build, which is a
  separate decision with real costs — see A108.
- **Ruled out:** tiling `api.openstreetmap.org/api/0.6/map`. It works from here
  but caps at 10,000 elements per request and is an editing API, not a bulk path.
- **Open:** the extract is cached in `osm_cache/` (gitignored). Nothing prunes it.

## A108 — Geofabrik as a real fallback tier · SHIPPED take 85 (raised take 84)

- The current chain is three Overpass mirrors then Census TIGER, which has no
  water and a different topology. One of those three mirrors is Swiss-only and
  can never serve Michigan (A102).
- **For:** Geofabrik is the sanctioned bulk path, carries real OSM data with
  water, and would mean the build essentially never degrades.
- **Against:** 297 MB per fallback build and a compiled PBF reader as a CI
  dependency, for a path exercised only on failure — and a refusal that never
  fires is a hope, not a safety property (landmine 45).
- **Ruled out for now:** doing it silently as part of A107. It changes what CI
  downloads and installs on every degraded build, and that is Jacob's call to
  make rather than mine to slip in.

### A60 measured on real geometry · take 84 (see A60 above)

- **PROVEN:** 8,103 near-parallel pairs at 17 m; **5,169 cross-source
  (222.7 mi)** — `fsroad+track` 2,651, `fsroad+minor` 1,314, `track+trail50` 438.
- **PROVEN:** 2,934 same-source pairs must NOT be collapsed, led by
  **`mccct+moto24` 861** — two designations on one corridor, not one road twice.
- **Ruled out:** a proximity-only predicate. It cannot distinguish a duplicate
  from a co-designation, and would erase 861 pairs of legal designation
  (landmine 125).
- **Next:** the eighth field on `E[i]`, `nf2` and `chainStrokes()` filtered
  together, gated on connectivity unchanged at 99.7%.

### A108 resolved at take 85 — SHIPPED (see A108 above)

*Third time I have appended a `## ` heading for an id that already existed (A60 at take 78, A72 at take 82, A108 here). The ledger check caught it twice; the habit is mine and the fix is to grep the agenda for the id before writing the entry, not after the gate says no.*

- **DECIDED by Jacob, take 85:** promote it. The chain is Overpass mirrors →
  Geofabrik extract → Census TIGER.
- **PROVEN, clean run from a pristine unpack with Overpass down:** extract
  downloaded from scratch, `verify -> COMPLETE`, 20,222 edges / 12,236 nodes /
  99.7%, water 244 polys / 180 lines, smoke reads `GRAPH 20222, not PARTIAL`.
  The same clean run one take earlier gave 34,341 TIGER edges and no water.
- **PROVEN, four negative controls:** tier removed, tiers genuinely reordered,
  Swiss mirror reinstated, `osm_local.py` deleted — all fail the gate.
- **Ruled out:** treating TIGER as an equivalent next-thing-to-try. It is roads
  only, no water, different topology; it is the last resort and the gate now
  enforces that it is tried last (landmine 126).
- **Ruled out:** keeping `overpass.osm.ch`. Swiss-only, 0 ways for this region,
  answering 200 with an empty set. Removed from the mirror list and from
  PROVISION; the gate refuses it by name.
- **Open:** the 297 MB extract is re-downloaded on every fallback build in CI —
  nothing caches it between runs. Only matters if Overpass stays down.
- **Open:** the Geofabrik tier is exercised on every local build (Overpass is
  unreachable here) but never in CI, where Overpass works. A path that only runs
  in one environment is one nobody watches (landmine 45).

## A109 — Bundle artifacts must describe the same graph · SHIPPED take 86

- **PROVEN:** a bundle shipped with `terrain.json` holding 18,252 node
  elevations and `graph.json` holding 12,236 nodes. Every hash matched, the
  manifest was correct, and the gate passed it. The app's self-test caught it.
- **PROVEN, negative control:** truncating terrain's `ne` array by five entries
  now fails the gate by name.
- **Ruled out:** relying on hashes for this. A hash proves a file is intact, not
  that it belongs with the file beside it (landmine 128).
- **Open:** only graph↔terrain is compared. Address, context and glyphs are not
  cross-checked against anything, though none is indexed by node id.


### A60 shipped at take 86 — route both, draw one (see A60 above)

- **PROVEN:** 20,222 edges routable, 16,972 drawn; 3,250 suppressed (16% of
  edges, 111 mi of 2,244).
- **PROVEN:** every designated class untouched — `trail50` 0 hidden, `mccct` 0,
  `moto24` 0, `route72` 0, `closed` 0, `fsclosed` 0. Suppression falls on
  `track` (−2,194) and `minor` (−811); 3,040 of 3,250 hidden edges are the OSM
  copy.
- **PROVEN, smoke:** every suppressed edge is still in the routing adjacency,
  and no closure or designated line is among them.
- **PROVEN, five negative controls:** whole class hidden, closure hidden,
  designated trail hidden, terrain mismatched, eighth field stripped.
- **Ruled out:** a proximity-only predicate. 2,934 of 8,103 near-parallel pairs
  share a source, 861 being `mccct+moto24` — two designations on one corridor,
  not one road twice (landmine 125).
- **Ruled out:** deleting the duplicate. Take 64 measured 558 mi and
  99.7% -> 97.4% connectivity lost at 45 m.
- **Ruled out:** choosing the survivor by length. It is a safety decision and is
  ranked explicitly, with closures and designated line unhideable (landmine 129).
- **Open:** `chainStrokes()` is filtered, but nothing yet asserts that a placed
  label lies on drawn geometry — only that the chain is built from drawn edges.
- **Open:** only a ride confirms the map now matches the road.

## A77 — Name the water · SHIPPED take 87

- **PROVEN:** 175 named water features existed in the OSM data and `pack.py`
  dropped every name. Payload 38 KB -> 41 KB to carry them.
- **PROVEN, measured:** named streams had a median length of 139 m against a
  ~1,200 m requirement for a line label at riding zoom — only 16 of 133 were
  long enough, and `text-max-angle: 45` rejected 61 of 133 as too sinuous.
- **PROVEN:** chaining fragments by name turned 133 into 28 strokes, median
  139 m -> 2,361 m, Au Sable River one 68.9 km line, 20 of 28 labelable.
- **PROVEN on the map:** Shaw Lake, Twin Lake, Briggs Lake, Muleshoe Lake,
  Wolf Creek, Au Sable River.
- **PROVEN, structurally:** `lbl-trail 29 < lbl-lake 33 < lbl-stream 34`, so
  trail names win collisions by layer order rather than by measurement.
- **Ruled out:** chaining in the client. Water has no node ids, so chaining
  means coordinate matching — cheaper once at build time than on every start.
- **Ruled out:** proving label priority by counting labels at one zoom. Headless
  placement is unstable enough that an A/B showed water labels *increasing*
  trail names, which is impossible (landmine 130).
- **Open:** 8 of 28 chained strokes are still too short to label. They are
  genuinely short creeks, not fragments.
- **Open:** only a ride says whether named water helps or clutters.

## A75 — Posted route numbers · SHIPPED take 88

- **PROVEN:** `ref` was dropped twice — at the OSM ingest into the graph, and
  again by the noding step's explicit key list. 4,470 edges carry one across
  183 distinct refs (`M 33`, `M 72`, `F-28`, `489`, `H57-7`, Forest Road numbers).
- **PROVEN:** 2,318 of those are already suppressed by A60 as cross-source
  duplicates — 1,693 tracks that duplicate USFS road we label authoritatively.
  2,152 remain drawn: paved 760, minor 527, track 865.
- **PROVEN:** 703 chained ref strokes; rendered `H58-1, M 33` centred on M 33 at
  coordinates read from the payload.
- **PROVEN, gated:** `lbl-trail 29 < lbl-ref 33 < lbl-lake 34 < lbl-stream 35`.
- **Ruled out:** a second copy of `chainStrokes`. It is parameterised by key —
  trail names chain by `labelFor`, route numbers by the ref (landmine 107).
- **Ruled out:** splitting multi-value refs at ingest. The raw `M 33;M 72;F-32`
  is what the source said; splitting happens where it is drawn.
- **Ruled out:** true shields. They need a sprite sheet the build has no
  pipeline for; a badge-styled text label is legible and costs nothing.
- **Open:** trail names at the z14.5 Bull Gap anchor read 2 before and 1 after.
  Two A/B attempts landed on runs where no trail geometry drew at all. The
  denominator (1 of 1,708 labelable strokes) says small viewport rather than
  crowding, but only a ride settles it.
- **Open:** third and later refs on a multi-value road are dropped, not shown.

## A110 — Places you can ride to · SHIPPED take 89

Jacob, take 88: pins you can tap for more information, "almost like Google Maps".
The immediate, no-architecture-required piece of A111 below.

- **PROVEN, in the Geofabrik extract we already download — no new source, no new
  host:** inside the region, 3 named trailheads (Bull Gap, East Bull Gap, Bull
  Gap Hill Climb), 7 boat launches (4 named), 14 named campgrounds (Mack Lake
  ORV, Island Lake, Wagner Lake, Luzerne Trail Camp, Parmalee Bridge SFC),
  2 day-use areas (Island Lake, Loon Lake), 2 viewpoints, 4 beaches.
- **PROVEN:** this closes A78 for free — the trailhead markers wanted since
  take 43 are `amenity=parking` with a name, already in the data.
- **PROVEN:** Jacob's Island Lake beach exists as an unnamed `natural=beach` at
  −84.1423,44.5083, **6 m** from the named `Island Lake Day Use Area`.
- **Ruled out:** shipping every candidate. 205 parking areas and 135 camp
  pitches in-region would be clutter, not information. Named features and a
  curated tag set only.
- **Ruled out:** naming an unnamed beach from an adjacent feature. That is
  inference presented as fact; draw both and let the day-use name sit beside it.
- **SHIPPED take 89:** 59 places — camp 14, food 10, store 9, fuel 5, launch 5,
  info 5, trailhead 4, beach 4, dayuse 2, view 1. 4 KB, no new source or host.
  Render draws 16 of 59 at the test viewport; smoke asserts every one is inside
  the region bbox and that fuel is among the kinds.
- **Ruled out:** borrowing a name for an unnamed beach from the day-use area 6 m
  away. Beaches ship unnamed and are labelled "Beach" by kind.
- **Open:** whether a tapped pin should show more than it does — hours, surface,
  whether a campground takes an ORV. OSM carries some of it; none is verified.

## A111 — Modes that change the UI · PROPOSED take 89

Jacob's idea, and it is the one that resolves the scope question rather than
dodging it: **APEX is not diluted by paddling if paddling is a MODE.**

Each mode owns a network, a hazard model, a refusal rule and a filter set. The
ORV machinery stays exactly as it is and becomes one mode rather than the whole
app. onX does the same thing with its Dirt / Snow toggle.

What is shared across every mode, and must stay shared: the dispatch card (where
you are does not depend on what you are doing), offline-clean, the honesty rules,
saved routes, the ride HUD, breadcrumb and retrace.

- **Ruled out:** bolting paddling onto the ORV filter as another activity row.
  The activity picker filters *what is drawn on one network*; a river is a
  different network with a different hazard model.
- **Open:** whether modes are a top-level switch or a bottom navigation bar
  (A113). Probably the same decision.
- **Open:** how the machine selector (bike/quad/sxs) relates. Likely mode-scoped.
- **Blocked on:** A110 and A91. Build the layers before building the shell that
  organises them, or the shell is designed against guesses.

## A112 — Paddle mode: the Au Sable corridor · PROPOSED take 89

Jacob wants to run the whole Au Sable, Grayling to Lake Huron — 160 river miles.

- **PROVEN, and this is the reason the item exists:** every mainstem dam is in
  OSM **by name** — Mio, Alcona, Loud, Five Channels, Cooke, Foote — plus Van
  Etten Lake Dam near the mouth and 35 further hazards in the corridor. They map
  exactly onto stops ⑩⑪⑫⑬⑭ of the outfitter's own table.
- **THE SAFETY RULE, and it is not optional:** a map that draws the Au Sable as
  one continuous blue line from Grayling to Lake Huron without marking six dams
  is actively dangerous. Dams are to paddling what closures are to riding —
  drawn unmissably, never routed through, and the portage named. If paddle mode
  cannot show them it does not ship.
- **PROVEN:** the water layer already chains the Au Sable into a single 68.9 km
  stroke inside the region (take 87), so distance along the channel is
  computable from geometry we hold.
- **Ruled out:** the Hinchman Acres distance table as a data source. It is a
  private business's page — same class as the licensed data ruled out at A6.
  Excellent ground truth for checking ours; not ours to redistribute.
- **Ruled out:** quoting paddling TIMES. Their hours embed craft, flow and
  season. Distance along the channel is arithmetic we can do honestly; how long
  it takes you is not.
- **Open:** the river leaves the box. Grayling is at −84.71 and Oscoda at −83.33;
  the region bbox is −84.3 to −83.9. See A115.

## A113 — Bottom navigation · SHIPPED take 98 (proposed take 89)

Jacob: "buttons in the bottom or something". onX uses five: Discover, Offline
Maps, My Content, Tools, Go & Track (documented at A92).

- **Open:** this is probably the same decision as A111, not a separate one — a
  bottom bar is what modes look like on a phone.
- **Ruled out:** doing it before the layers and tools exist. A shell designed
  around three features and then filled with ten is a shell designed twice
  (A91's reasoning).

## A114 — Rebrand: APEX ORV -> APEX · DECIDED take 89: not happening

*Jacob, take 89: "We'll always call it APEX ORV, at least for a long time,
but rebranding in our minds." The modes are the real idea (A111); the name
is not changing. Kept on the ledger so the consequences below are not
rediscovered if it ever comes up again.*

Jacob: "maybe we'll rebrand in the future to just APEX, do whatever outdoors".

- **Consequence that must not be discovered late:** the signing certificate reads
  `CN=APEX Off-road` and must keep reading it — a stable key is what lets take N
  install over take N−1. A rename touches the window title, header, About card,
  release title and launcher label, and deliberately **not** the cert. That is
  exactly what take 38 did and the reasoning holds (invariant B1).
- **Consequence:** the Android appId is a separate question from the display
  name. Changing the appId is a new app to the phone — no update path, saved
  routes and recorded tracks gone. Do not change it as part of a rename.
- **Ruled out:** changing the signing certificate or the Android appId as part
  of a rename. The cert must keep reading `CN=APEX Off-road`, and a new appId is
  a new app to the phone — no update path, saved routes and recorded tracks gone.
- **Blocked on:** A111. A rebrand describes an app that does more than one thing;
  the modes have to exist first or the name is a promise the app does not keep.

## A115 — A corridor is not a bbox · SHIPPED take 102 (raised take 89)

Every region is a rectangle. A river is a line that runs off the edge of one: the
Au Sable enters the Bull Gap box at −84.3 and leaves at −83.9, and the trip
Jacob wants runs −84.71 to −83.33.

- **PROVEN:** the Geofabrik extract is statewide, so the full corridor geometry
  is already downloaded — extracting it needs no new fetch, only a different
  selection rule.
- **Ruled out:** widening the region bbox to contain the river. That drags in
  imagery and address indexes for 100 km of country nobody is riding, and the
  imagery budget alone rules it out (8.6 GB statewide at z15).
- **Open:** a corridor could be a buffered polyline — the river plus a margin —
  provisioned separately from the area region. That is a real change to the
  region model and it should be designed once, for A72 and A112 together.

## A91 — Layer manager · SHIPPED take 90

- **PROVEN:** the tools strip had 16 chips with basemap, relief and labels
  scattered among ride actions; the 59 places from take 89 had no toggle at all.
- **PROVEN:** `LBL` governed 5 of 11 symbol layers — `lake-label`,
  `lbl-trail-short`, `poi-label`, `lbl-ref`, `lbl-lake`, `lbl-stream` all escaped
  the Labels control, four added by me in takes 87-89. The same array had already
  drifted once at take 57.
- **PROVEN, in a real browser:** panel opens with 3 basemaps and 4 groups;
  Places off hides pins and their labels; All labels reaches route numbers, water
  names and place names; basemap still cycles in one tap.
- **PROVEN, four negative controls:** hand-kept array returns, `labelLayers()`
  removed, a group governing a layer the style lacks, `LYRGROUPS` removed.
- **Ruled out:** replacing the one-tap basemap cycle with the panel. It cost two
  taps and a hunt in gloves; the render harness caught it (landmine 135).
- **Ruled out:** keeping layer state in chip classNames. `setBasemap` read
  `c-relief.className` and threw once that chip was gone. The map is the only
  copy that cannot be stale.
- **Ruled out:** folding the activity picker in. That filters ONE network and
  doubles as the legend; the layers panel governs which layers exist at all.
- **Open:** the panel is where contours, slope and cell coverage go next — it
  was built now so those do not each arrive as another chip.

## A87 — Contour lines · SHIPPED take 91

- **PROVEN, measured across four intervals before choosing:** 20 ft costs
  1,154 KB, 40 ft costs 423 KB, 100 ft costs 237 KB. 40 ft shipped — the USGS
  interval for 199 m of relief, about seven lines on Wagon Wheel Hill.
- **PROVEN:** 3,204 lines, 880 of them 200 ft index contours carrying the
  elevation label. Bundle 2.59 -> 3.07 MB, ~1% of an APK already carrying 45 MB
  of imagery.
- **PROVEN, clean run:** identical output and an identical artifact hash
  (`fb6d41b680cf`) from a pristine unpack with no DEM cache; gate green on the
  clean tree.
- **PROVEN, real browser:** off by default, both line layers draw, index
  contours carry `1200 ft`.
- **Ruled out:** a new data source. This is the fifth product of the DEM ingest
  `terrain.py` already runs — the tiles are in `dem_cache/` when it starts.
- **Ruled out:** raw float coordinates. Same delta encoding as water and graph,
  so the client's existing `decode()` needs no new code, and 946 KB became
  423 KB (landmine 136).
- **Ruled out:** labelling every 40 ft line. Sixteen numbers on one hillside;
  only the 200 ft index contours are labelled, as on a paper quad.
- **Ruled out:** drawing them above the network. Terrain is what you read the
  map ON; contours sit above the hillshade and below water and every trail.
- **Open:** 8 of 28 chained water strokes and some contour fragments are short
  enough that they never carry a label. Cosmetic, unmeasured.
- **Open:** A88 slope shading is the other DEM product still unbuilt, and now
  has a home in the layers panel.

## A84 — Waypoints · SHIPPED take 92

- **PROVEN:** a dropped pin was ephemeral — one at a time, unnamed, lost on the
  next drop. It now saves, persists, draws, and is listed under ☆ Saved with
  Go to / Rename / Delete.
- **PROVEN:** auto-named without a dialog from what is there — address, else
  nearest trail, else coordinates. The harness named one "Curtisville Road".
- **PROVEN, asserted in one run:** a waypoint stores its coordinate AND a saved
  route still stores no geometry. The two rules differ on purpose (landmine 139).
- **Ruled out:** storing a waypoint as inputs, the way routes are stored. A point
  on the ground encodes no legality decision that can go stale; freezing an
  observation is what saving it means.
- **Ruled out:** a naming dialog on the save path. Gloves, moving bike — same
  reasoning as saved routes at take 79.
- **Ruled out for now:** geotagged photos. Capacitor Camera is not among the
  installed plugins (Geolocation, Device, Haptics, Cookies, WebView, Share,
  Http), so it is a new plugin and a new permission, not a UI change.
- **Open:** line distance and area measure from onX's tools palette are not
  built. Waypoints were the piece that mattered.
- **Open:** waypoints are drawn above POIs and there is no way to hide them
  separately; they are not yet a layers-panel group.

## A88 — Slope-angle shading · RULED OUT take 92

- **PROVEN, measured from the DEM already on disk:** 65.6% of the region is
  under 3 degrees, 84% under 6, 95% under 10, and only 1.2% above 15. Median
  1.7, mean 3.0, max 47.9.
- **PROVEN:** onX's slope layer bands at 27/30/35/45 degrees for avalanche
  terrain. 99.9% of this region is under 22, so the layer would render 1,060 km²
  a single flat colour.
- **Ruled out:** the feature as it exists elsewhere. It is a hypothesis about
  terrain, and this terrain answers no (landmine 140).
- **Open, if ever wanted:** a *steep-ground highlight* banded for a bike — say
  12/18/25 degrees — would light up the 1.2% that is hill climbs. Redundant with
  the contours shipped at take 91, which already show steepness through line
  spacing, so not scheduled.

## A96 — Dispatch-path latency · MEASURED take 93, closed

- **PROVEN, per scan in a real browser:** `nearestEdge` 17 ms, `nearestPavement`
  4 ms, `nearestJunction` 1 ms, `addressAt` 1 ms, `addressAt(near)` 0 ms,
  `countyAt` 0 ms — **23 ms total**, 10 ms on a second run. `nearestEdge` is
  three quarters of it, as expected; the total is imperceptible.
- **PROVEN:** the worry was carried as UNKNOWN from take 75 to take 93 and cost
  one browser evaluate to settle (landmine 141).
- **Ruled out:** indexing `nearestEdge`. Rewriting a working safety path against
  a measurement that says it is fine trades real risk for imagined gain.
- **Ruled out:** extrapolating a phone figure from headless Chrome. Take 57 paid
  for that once with a 900×1400 viewport nobody had (landmine 142).
- **SHIPPED:** the timing runs on the device as a `PERF dispatch-scan` self-test
  line, threshold 600 ms, so the next field report carries the real number.
- **Open:** only a device report closes this for the phone. The desktop figure
  says the shape of the problem is fine.

## A76 — Named summits · SHIPPED take 94

- **PROVEN:** 4 named peaks in the region — Wagon Wheel Hill 1,464 ft, Auger
  Hill 1,382, Mio Mountain 1,290, Timberline Mountain 1,267.
- **PROVEN, three ways:** our DEM agrees with OSM's surveyed `ele` within 1 m on
  three of four (8 m on Timberline), and three of the four match onX's printed
  figures within 3 ft (landmine 144).
- **PROVEN, clean run:** identical output from a pristine tree; gate green with
  260 smoke assertions and 61 render checks.
- **Ruled out:** GNIS as the source. The S3 path 404'd, and it was not needed —
  OSM carries the names and our DEM has better provenance for the heights.
- **Ruled out:** using OSM's `ele` for the label. Every other elevation in the
  app comes from the DEM; a summit disagreeing with the readout under your
  wheels would be its own small lie.
- **Ruled out:** unnamed peaks. A summit with no name is terrain, and the
  contours shipped at take 91 already draw it.
- **Ruled out:** a separate payload and pipeline step for four features.
  Summits ride in the contour payload — both are terrain from the same region.
- **Open:** only 4 in this box. onX's screenshot showed Brants Hill and Preachers
  Hill, both outside it. Statewide (A72) would bring in many more.

### A101 shipped at take 95 (see A101 above)

*Fourth time I have appended a `## ` heading for an id that already had one — A60 at 78, A72 at 82, A108 at 85, and this. The check catches it every time and I keep making it; the fix is to grep the agenda for the id BEFORE writing, which I did for A76 and A84 and skipped here.*

- **PROVEN:** 180 features statewide carry one; **67 read "Off road motorcycles
  are prohibited"**. Zero are in the Bull Gap region — this is preparation for
  A72, not a live fix.
- **PROVEN:** only **nine distinct strings statewide**, two of them the same rule
  with different punctuation. Enumerated as a table rather than parsed
  (landmine 145).
- **PROVEN:** `-1` is the null sentinel on 1,877 of 1,889 routes; treating it as
  a restriction would have flagged nearly the whole state network.
- **PROVEN, drilled:** injecting the verbatim DNR strings onto real edges — a
  dirt bike is refused the motorcycle prohibition, a quad is not, an
  unrecognised string bans nobody and is displayed unedited.
- **Ruled out:** a regex over legal prose. It cannot be reviewed by eye and fails
  silently on the tenth string.
- **Ruled out:** letting the table grant access. It may only ever restrict —
  wrongly restricting costs a detour, wrongly permitting puts a rider somewhere
  illegal (landmine 146).
- **Open:** seasonal windows are displayed, not enforced. Enforcing them means
  the router refusing a segment out of season, which is the closure model and
  deserves its own take rather than being done half-way.
- **Open:** "High Clearance Required" and "4x4 And High Clearance Required" are
  shown and restrict nothing. Whether they should exclude a narrow dirt bike is
  a rider's judgement, not the data's.

## A89 — Cell coverage · RULED OUT take 95, on availability

- **PROVEN:** `broadbandmap.fcc.gov` returns 403; the bulk BDC download path
  404s. `geo.fcc.gov/api/census/area` answers but serves census blocks, not
  coverage.
- **PROVEN:** OSM has 10 communication masts in the region, 187 just outside,
  and only one carries a name. None carries carrier or coverage information.
- **Ruled out:** drawing mast locations as a coverage proxy. A mast tells you
  nothing about whether a phone works — terrain decides that, and this terrain is
  exactly what blocks it. It would be a safety-relevant claim the app cannot
  support.
- **Ruled out:** modelling RF propagation. That is a confident guess about
  whether someone can call for help.
- **Open, and the honest version:** log where the rider ACTUALLY had signal along
  their own recorded tracks. `navigator.onLine` is not a network request, so it
  stays offline-clean, and it is ground truth rather than a model. It ships
  empty until there are recorded rides (A18).

## A94 — A region switch must leave nothing behind · SHIPPED take 96

- **PROVEN:** `DERIVED` named 12 artifacts while the pipeline wrote 19. The seven
  missed were `address`, `context`, `other`, `poi`, `contour`, `imagery_tiles/`
  and `dem_meta` — poi and contour added by me at takes 89 and 91. It also still
  listed `payload.json`, long gone.
- **PROVEN:** `imagery_tiles/` survived every switch — 2,008 tiles of the
  previous region, unlisted and unremovable by `os.remove` anyway.
- **PROVEN, three negative controls:** back to a hand-kept list, `imagery_tiles/`
  no longer cleared, and a tool that starts writing a new payload nobody clears —
  the last being takes 89 and 91 reproduced deliberately.
- **Ruled out:** adding seven names. A copied set has drifted four times here
  (palette 77, CI deps 84, label layers 90, this). The `*_payload.json`
  convention is globbed instead (landmine 148).
- **Open:** the check scans `tools/` for literal filenames. A tool that builds a
  payload name by concatenation would slip past it.

## A95 — Anchors outside their own region · SHIPPED take 96

- **PROVEN, traced at last:** a place chip runs `map.easeTo` to the anchor.
  `sthelen` listed Roscommon 2.5 km and Houghton Lake 16.2 km outside its bbox,
  so those chips pan the rider to ground the bundle does not cover — no imagery,
  no network, no explanation — and both were in the search index too.
- **PROVEN:** the check failed on the real defect the moment it was written; it
  needed no manufactured control.
- **Ruled out:** widening `sthelen`'s bbox to contain them. That changes what the
  region downloads, which is a scope decision and Jacob's to make — the reasoning
  is recorded in the region's own note, not only here (landmine 150).
- **Ruled out:** leaving them as low-zoom signposts. They are chips and search
  hits, not labels; both take you somewhere the app knows nothing about.
- **Open:** if Jacob wants Houghton Lake and Roscommon, a wider `sthelen` bbox or
  a third region is the answer, and either is one line in regions.json.

### A103 superseded at take 85 (see A103 above)

- **Superseded, not abandoned:** A103 proposed pulling water from Census TIGER
  when Overpass failed, because the fallback shipped no water. Take 85 inserted
  the Geofabrik extract ahead of TIGER instead, which returns **real OSM water**
  — 244 polys and 180 lines, identical to the primary path.
- **Ruled out:** building TIGER water anyway. It would only run on the third
  tier, below a tier that already provides better water, so it could not fire
  without Geofabrik also failing — and a path that never runs is not a safety
  property (landmine 45).

### A27 measured at take 97 (see A27 above)

- **PROVEN, measured:** the standard MapLibre build is **364 KB smaller** than
  the CSP build plus its separate worker (1,032 KB against 1,396 KB), matching
  the estimate carried since take 21.
- **PROVEN, headless:** built against the standard engine, the app draws
  identically — 3,198 rendered features, no page errors, no map errors,
  self-test 37/0, all 61 render checks green. In headless Chrome the CSP build
  buys nothing.
- **NOT PROVEN, and this is the whole point:** headless Chrome is not the
  Android WebView. The standard build inlines its worker as a `blob:`, and
  whether a Capacitor WebView permits that is exactly the question take 21 could
  not answer and take 23 only partly disproved. It cannot be answered from here.
- **Ruled out:** switching on this evidence. 364 KB is 0.7% of a ~50 MB APK, and
  the failure mode is no map at all. The app would say RENDER FAIL rather than
  fail silently (take 15's drill), so a bad install would be legible — but it
  would still cost a ride.
- **Not one-sided:** the CSP build has its own moving part. It needs
  `setWorkerUrl` pointing at a file that must exist, and `ci/bundle.sh` carries
  `test -s www/vendor/maplibre-gl-csp-worker.js` precisely because that file went
  missing once. The standard build has no such failure mode.
- **JACOB'S CALL:** worth 364 KB on a build where he is testing anyway? The
  experiment is one line in `build_app.py` and reverting is the same line.

### A113 shipped at take 98 (see A113 above)

- **PROVEN:** 14 actions lived in one horizontally scrolling row. Now split
  across Map / Plan / Ride / Tools with **at most 5 on screen at once**, and
  every action belonging to exactly one destination — none orphaned.
- **PROVEN:** clean layout at all four device sizes; the bar owns the
  safe-area inset.
- **PROVEN:** every chip keeps its id, handler and DOM position. A closed
  destination's chips are `hidden`, which `click()` ignores and the layout
  self-test already skips — 274 smoke assertions passed untouched.
- **Ruled out:** making it a router with separate screens. There is nothing to
  get lost between, and the map stays visible in every destination because on a
  trail the map is what you are looking at.
- **Ruled out:** shipping a mode selector alongside it. One mode is a promise,
  not a feature; it goes at the top of this shell when A111/A112 make a second
  mode real.
- **Known cost:** ~52 px of map height, which tipped a contour-label check that
  had been finding exactly one label (landmine 151).
- **Open:** the next two takes of this arc — a drawn icon set replacing 38 emoji,
  then a type scale and motion.

## A116 — Presentation, not architecture · MEASURED take 98

Jacob asked whether the backend approach was wrong, because onX and AllTrails
feel more premium.

- **PROVEN, measured:** the gap is 14 chips in one row, 38 emoji as icons, **1**
  CSS transition in 3,667 lines, and 15 distinct font sizes. None of it is the
  backend.
- **PROVEN:** those apps are client-server with accounts because they bill
  millions of users. That architecture buys sync and monetisation, not polish.
- **Ruled out:** mimicking their framework. It would add a server, accounts and a
  subscription, and cost the things this app is better at — offline routing,
  provenance on every line, per-machine legality, and refusing to guess an
  address (landmine 153).
- **Ruled out:** a native rewrite. The WebView is not what makes it feel less
  finished; one transition in 3,667 lines is.
- **Worth taking from them:** the shell. Destination bar (A113, done), a drawn
  icon set, a type scale, and motion.
- **Open:** vector tiles instead of a bundle is the one architectural idea of
  theirs worth having, and the two-tier statewide plan already approximates it
  without a server.

## A117 — Rivers, lakes and river access, properly · JACOB'S NEXT PRIORITY, after the overhaul

Jacob, take 98: *"I'm making rivers and lakes a priority as well, where they're
drawn on the map properly with all major drops/pickups or campgrounds"* — and,
asked when: **after the UI overhaul is complete**, not interleaved with it.

- **Scheduled after:** A113 (done), the icon set, and the type scale and motion
  takes. Recorded here so the ordering is his and not mine.
- **Already in hand:** water is drawn and named (A77, 175 features, 133 stream
  fragments chained into 28 strokes). 7 boat launches, 14 campgrounds, 4 beaches
  and 2 day-use areas already ship as places (A110).
- **What "properly" still needs:** the river drawn as a continuous corridor
  rather than clipped at the bbox (A115), access points ordered ALONG the river
  with distances between them, and the dam portages that make it safe (A112).
- **Ruled out, already:** the Hinchman Acres distance table as a source, and
  quoting paddling times — their hours embed craft, flow and season (A112).
- **Ruled out:** treating this as a water-styling task. The drawing is largely
  done; what is missing is the corridor model and the hazards.

## A118 — Drawn icon set · SHIPPED take 99

- **PROVEN:** 38 emoji were doing an icon set's job. Now **20 controls carry a
  drawn SVG icon and no emoji remains in any control** — verified in a real
  browser, along with zero placeholders reaching the screen.
- **PROVEN:** handlers survive the icon pass, asserted by clicking a control
  after it and requiring the handler to fire (landmine 154).
- **Ruled out:** replacing `#shell.innerHTML` to expand placeholders. It rebuilds
  the DOM with no listeners — the map still draws and nothing works.
- **Ruled out:** a sprite sheet or an icon font. Inline SVG needs no fetch and
  cannot go missing offline, which matters more here than anywhere.
- **Ruled out:** drawing the machine. A motorcycle at 24 px in stroke is beyond
  what I can draw well and a bad one is worse than an emoji; the label carries it.
- **Ruled out:** `classList.contains()`. The codebase tests classes with
  `className.indexOf()` and the stub check enforced it (landmine 156).
- **Open:** direction arrows in the turn list (← ↑ ↰ ↻) are still text glyphs.
  They are inline in sentences rather than in controls, and a drawn arrow mid-
  sentence is a harder problem than a drawn icon in a button.

## A119 — Tools destination · PARTLY SHIPPED take 101, bucket still to fill

Jacob, take 99: *"Do we have the tool bucket/tab?"*

- **Honest status:** the destination exists (A113) and currently holds About,
  Self-test and Pan test. Those are diagnostics. It is the right container with
  the wrong contents.
- **What belongs there**, from the onX study (A84) and Jacob's asks: measure a
  line, mark my location, a standalone compass, area shape. Waypoints already
  shipped at take 92 but are reached by long-press, not from Tools.
- **Ruled out:** filling it before the overhaul finishes. A tools palette built
  against a type scale and motion that are about to change is built twice.
- **Ruled out:** moving the diagnostics out yet. About and Self-test have to live
  somewhere, and "More" is a fifth destination this app has not earned.
- **Scheduled:** after A117 (rivers), which is Jacob's stated next priority.

## A120 — Type scale and motion · SHIPPED take 100

- **PROVEN:** 16 distinct font sizes across 44 declarations reduced to a 6-step
  scale; **zero hard-coded sizes remain**. Each mapped to its nearest step, so
  nothing moved more than 1 px, verified clean at all four device sizes.
- **PROVEN:** 1 transition became 6, plus a `prefers-reduced-motion` block.
- **PROVEN, asserted with `elementFromPoint`:** an open panel is reachable, a
  closed one catches no taps, is fully transparent, and transitions rather than
  blinks.
- **Ruled out:** folding MapLibre `text-size` expressions into the CSS scale.
  They were tuned against satellite at take 57 by measurement; a tidy-up would
  have undone it (landmine 157).
- **Ruled out:** animating anything on the map. A rider glancing down mid-trail
  does not want the interface moving.
- **Ruled out:** `display:none` on animating panels. There is nothing to fade —
  hence the invisible-tap risk and the check that covers it (landmine 158).
- **Closes** the presentation gap measured at A116. All four numbers now match
  what a finished app looks like.

### A119 resolved at take 101 — Tools is a bucket (see A119 above)

- **SHIPPED:** Diagnostics is one entry opening a sub-menu with About, Self-test
  and Pan test. Tools shows one chip where it showed three.
- **PROVEN:** sub-menu starts closed, holds all three, and closes when the
  destination changes.
- **PROVEN:** the three keep their ids and handlers, so the harness needed no
  changes — 274 assertions passed untouched.
- **Ruled out:** a fifth "More" destination for diagnostics. Four destinations is
  what this app has earned; a sub-menu costs nothing.
- **Open:** the bucket is still nearly empty. Measure, mark-my-location and a
  compass go in after A117.

### A115 shipped at take 102 — paddle corridors (see A115 above)

- **PROVEN:** 574 named rivers in Michigan, 2,645 access points. At >= 3 access
  points within 500 m: 83 rivers, 5,139 mi statewide (~3 MB). Near this region:
  **6 corridors, 390 river miles, 265 KB**.
- **PROVEN:** the ranking is the state's canonical paddling list with nobody
  choosing it — Huron 78, Au Sable 54, Manistee 51, Grand 44. Every river Jacob
  named clears it: Rifle 6, Black 9, Pine 15 (landmine 160).
- **PROVEN:** the Rifle River has **zero points inside the region bbox** and is
  fully carried, with launches at mile 0.2 and 8.7 and six campgrounds — a
  corridor is not a bbox.
- **PROVEN:** the fragmentation IS the dams. 5 reaches, 4 portages of 2.9-7.7 km,
  every break on an impoundment (landmine 161).
- **PROVEN:** every corridor runs east, 0 reversed joins, so "above" and "below"
  are meaningful — the basis of a shuttle.
- **PROVEN, hazards:** 13 dams in the payload; Mio Dam verified drawn and named
  in a real browser. A112's ship-blocker is satisfied.
- **Ruled out:** joining reaches across impoundments. It would draw a river
  nobody can paddle and erase the hazards in one move.
- **Ruled out:** a correction factor on the distances. 0.53x above Mio, 0.78x
  near it — not constant, so any factor is invented (landmine 162).
- **Ruled out:** a portage midpoint pin. A second pin a kilometre from its dam is
  two markers for one hazard; the gate caught the dead source.
- **Open:** USGS NHD gives 11.2 mi where OSM gives 7.8 and the livery says 10.
  Better geometry, but a per-river web query where OSM is already on disk —
  a refinement, not a blocker.
- **Open:** a time estimate. Once distance is right, pace is a stated assumption
  the rider can adjust; the outfitter's figures imply 4-5 mph including current.

## A121 — The paddle card · SHIPPED take 103

- **PROVEN, in a real browser:** tapping an access point names what is above and
  below with the gap to each, and whether a dam sits between. Tapping a dam says
  take out and portage in the closure colour, and lists what sits at the dam.
- **PROVEN:** a dam is queried before a launch, so when both are under the finger
  the hazard is the answer.
- **PROVEN:** every card states once that distances run short of a real float and
  that the order is what to trust — the take-102 caveat travels with the number.
- **Ruled out:** reporting the literally nearest neighbour. A dam has an access
  on each bank at the same river mile, so both rows read "about 0.0 mi" — true,
  assertion-passing, and useless (landmines 163, 164).
- **Open:** unnamed access points show as "Canoe access". That is the data, not
  the card, and naming them would be inventing.
- **Open:** no way yet to pick two pins and get the run between them as a plan —
  the card answers one hop at a time.

### A121 extended at take 104 — two pins make a run (see A121 above)

- **PROVEN, in a real browser:** picking two stops gives put-in, take-out,
  distance, every dam between with a portage warning, and the access points and
  campgrounds on the way.
- **PROVEN:** tapping downstream-first still puts the UPSTREAM stop as the
  put-in, and the card says it swapped them. A river only runs one way.
- **PROVEN:** the card turns red when a dam is in the way.
- **Ruled out:** refusing a backwards tap. The direction is not ambiguous — the
  river decides it — so refusing would be pedantry dressed as rigour.
- **Ruled out:** a bare glyph on the new buttons. The icon check caught it five
  takes after the drawn set shipped.
- **Open:** the run is not saveable. Saved routes store inputs and re-route; a
  run is two stops on a named river, which is the same shape and would reuse
  that machinery.
- **Open:** no time estimate. Once distance is honest, pace is a stated
  assumption — the outfitter's figures imply 4-5 mph including current.

### A119 filled at take 105 — compass and mark-this-spot (see A119 above)

- **PROVEN, in a real browser:** the compass draws a rose, reads a heading when
  given one, says plainly when it has none, and gives bearing plus which way to
  turn for the truck, home and every saved waypoint.
- **PROVEN:** it reads `HUD.hdg`, the same heading the ride ribbon uses, so there
  is no second source of truth; it repaints on every fix.
- **PROVEN:** Mark this spot saves a waypoint in one tap, auto-named — the
  harness got "Bull Gap Hill Climb".
- **Ruled out:** drawing a needle when there is no heading. A phone lying still
  has none, and a needle pointing somewhere arbitrary is worse than an honest
  blank.
- **Ruled out:** a bearing to something you are standing on. Under ~100 ft the
  row reads "you are here" (landmine 167).
- **Open:** measure-a-line and area are still unbuilt; the bucket has room.
- **Open:** the compass has no magnetometer — it is GPS course-over-ground, so it
  needs movement. A device compass would work at a standstill and is a Capacitor
  plugin the build does not carry.

## A122 — How long the float takes · SHIPPED take 106

- **PROVEN:** USGS NHD agrees with OSM within 4% on three reaches (9.2/9.3,
  26.2/26.3, 11.1/10.7) while the outfitter's table reads 16/50/15. Our
  distances were right; take 102's apology was wrong (landmine 168).
- **PROVEN:** the outfitter's hours against our distances give 2.51-2.59 mph
  across four long floats — a real canoe pace. Their own figures imply 4.7.
- **PROVEN:** the estimate brackets two floats with published times, 8.5 hrs and
  11.5 hrs.
- **Ruled out:** switching the corridor geometry to NHD. It agrees with what we
  already have, and it is a per-river web query where the extract is on disk.
- **Ruled out:** calibrating on all their figures. Short trips scatter 1.5-3.1
  mph and are rounded booking numbers (landmine 169).
- **Ruled out:** a single number. Pace is the guess, so it shows a range and says
  what it assumed; the distance is not a guess and is stated plainly.
- **Open:** flow. Spring melt and a dry August are different rivers, and nothing
  in the app knows which one you are on.

## A123 — Michigan only, deliberately · DECIDED take 106

Jacob: *"I'm abandoning all states or other countries. This app will essentially
be the Michiganders dream, the one stop Michigan app."*

- **Consequence:** the Geofabrik Michigan extract is the permanent OSM source,
  not a stepping stone. `EXTRACTS` in `osm_local.py` needs no second entry.
- **Consequence:** statewide (A72) is the END GOAL rather than a phase, and the
  two-tier plan (statewide vector index + region packs) is the shape to build.
- **Consequence:** Michigan-specific authorities stay first-class — DNR ORV
  layers, MVUM for the two national forests, and the paddle filter tuned on
  Michigan's 574 named rivers.
- **Ruled out:** any abstraction for multi-state. Every place the code could have
  been made state-agnostic is now a place it should stay concrete and legible.
- **Ruled out:** dropping `state` from regions.json. It is one field, it names
  which extract to use, and removing it would save nothing.

## A124 — Full audit before statewide · take 107

- **PROVEN:** 23 of 23 claimed app features present in the built artifact,
  checked against `www/` rather than the handoff.
- **PROVEN:** ledgers clean — 106 takes, 116 agenda ids, 169 landmines, no
  duplicates, no gaps; all stamps at 106.
- **FOUND AND FIXED:** the CI cache list had drifted, missing poi, contour,
  corridor and `osm_cache`, so every build re-downloaded 297 MB and re-ran the
  ~285 s corridor step (landmine 170). Now expressed by convention and gated
  with four controls.
- **Ruled out:** trusting the handoff for what shipped. Every feature was checked
  against the artifact.
- **NOT VERIFIED, and stated:** a cold clean run does not complete in this
  environment — Geofabrik ingest plus the corridor step each read the 297 MB
  extract and exceed a tool window. CI reaches Overpass so its ingest is fast,
  but the corridor cost is real and unmeasured in CI.
- **Open:** `corridor.py` reads the whole state to build six rivers, and
  `osm_local.py` reads it again for the fallback. One pass could serve both.
- **Open:** a cold CI build is slower than at take 96 by an unmeasured amount.

## A125 — Wiring and reachability audit · SHIPPED take 108

- **PROVEN:** 40 buttons, 47 handlers, **zero unwired and zero orphaned**,
  cross-checked mechanically across all four binding shapes in the file.
- **PROVEN, and fixed:** `I'm here` sat in Ride while `Set home` sat in Plan,
  though `syncArm()` treats them as one gesture. Now both in Plan, asserted.
- **PROVEN, and fixed:** two dead handler blocks for chips removed at take 90,
  preserved by their own `if(el(...))` guards (landmine 174).
- **PROVEN:** every action reachable by walking all four destinations; 7 layer
  groups; diagnostics behind one entry; action row always present.
- **Ruled out:** trusting the wiring cross-reference alone. Wired is not
  reachable (landmine 173).
- **Ruled out:** removing `lyrSet`'s guarded writes to `c-relief`/`c-labels`.
  Those are deliberate, so re-adding a chip needs no new code.

## A127 — The details drawer · SHIPPED take 109

Jacob's design, after the first real session: the rail was always on screen and
took nearly half of a map app.

- **PROVEN, six behaviours:** folds to its resting state · tapping a place opens
  it · panning until the place leaves the screen folds the card with it · the
  handle works · the peek strip never leaves · the action row sits outside the
  scrolling body.
- **PROVEN:** clean at all four device sizes; the map gains ~210 px at rest.
- **Ruled out:** translating the rail off screen. It is a grid row, so a
  transform leaves a hole the map does not fill — the "just disappears" Jacob
  did not want. Folding shrinks the row and the map grows into it.
- **Ruled out:** opening from each card site. Every card goes through `show()`,
  so there is one hook and a new card cannot forget.
- **FOUND AND FIXED:** the action row scrolled away under a tall card, taking
  Dispatch and Return home below the fold.
- **Open:** the drawer does not remember a manual fold across a tab switch.
- **Open:** during a ride it peeks rather than opening; whether that is right is
  a field question.

## A128 — Compass from the magnetometer · SHIPPED take 109

- **PROVEN, field-reported:** *"I don't think compass works."* It read GPS
  course-over-ground, which does not exist standing still.
- **PROVEN:** `deviceorientationabsolute` needs no Capacitor plugin; one reading
  at alpha 311 gives `NE 49° · compass`.
- **Ruled out:** a magnetometer while moving. Course-over-ground is what you are
  doing, and a compass beside an engine is not to be trusted.
- **Ruled out:** drawing a needle with no source. If neither reports, it says so.
- **Open:** magnetic declination is not applied — about 7° W in this part of
  Michigan, which matters for a bearing read off a paper map.

## A129 — First-run guide · SHIPPED take 110

Jacob: a short guide the first time the app opens, blurring the background,
reachable afterwards from a How-to button in Tools.

- **PROVEN, in a real browser:** opens on first run · blurs the map behind rather
  than covering it · explains the destinations, the map and Dispatch · dismissal
  is remembered so it never shows again on its own · **Tools → How to use**
  brings it back · tapping the blurred backdrop closes it.
- **Ruled out:** anything in it the app cannot back up. Every line is a fact
  about what the app does, including that Dispatch refuses to guess.
- **Ruled out:** failing when storage is unavailable. It shows every time
  instead — an extra tap is a smaller harm than a first-time rider getting no
  explanation at all.
- **Open:** it is one long card. If it grows, paging it beats scrolling it.

## A130 — Card motion · SHIPPED take 110

- **PROVEN:** cards rise on every change, 140 ms, transform and opacity only so
  it composites and costs no layout while the map is drawing.
- **PROVEN:** the animation replays on consecutive cards — the class is removed,
  layout read, and re-added, because a browser will not replay for an unchanged
  class (landmine 179).
- **FOUND AND FIXED:** three cards — saved routes, route options, the step list —
  wrote the panel directly, so they had no motion and did not open the drawer.
  All routed through `show()` (landmine 180).
- **Ruled out:** animating anything that costs layout. Transform and opacity
  only, and `prefers-reduced-motion` disables it.

## A131 — Hardening sweep · SHIPPED take 111

- **FOUND AND FIXED:** the dead `stLayout` twin from take 109 was never deleted,
  and held **three checks that had never run** — `machine-on-map` (dead since
  take 80), `hud-matches-ride`, `map-has-room` (landmine 182).
- **PROVEN:** lifting them exposed `_hb`, `_hs`, `_rid` as undefined references
  that threw and killed every check after them. Self-test **38 → 42**.
- **PROVEN:** `map-has-room` reports **825 of 915 px, 90% of the screen** — the
  take-109 drawer's payoff, now with a check that will notice a regression.
- **PROVEN, gated:** `check_no_duplicate_defs` refuses duplicate function names,
  duplicate top-level vars and duplicate static ids. Three controls, including
  the take-109 bug reproduced exactly.
- **Ruled out:** leaving the twin in place with a comment. A construct that can
  silently swallow code has to go, not be annotated.
- **Open:** `routes` appears as an id in two mutually-exclusive template strings.
  Nothing reads it by id — it is CSS only — so it is not a runtime collision, and
  the gate checks static markup rather than template strings.

### A128 corrected at take 111 — two norths (see A128 above)

- **PROVEN:** GPS course is TRUE north, the magnetometer is MAGNETIC, about 7° W
  here. The same needle meant different things depending on speed, and every
  bearing row compared a magnetic heading against a true bearing (landmine 183).
- **PROVEN:** converted at the source; a 311° alpha reading now reads **42° true**
  and the screen says "true · compass".
- **Ruled out:** a WMM model. It changes slowly, this app covers one region of
  one state, and an approximate correction applied consistently beats an exact
  one applied to half the app.

## A132 — Field fixes from the take-110 session · SHIPPED take 112

- **FIXED, field-reported:** the chevron shipped as the literal six characters
  `\u25BE` — a JS escape pasted into markup — and the fold's rotation mirrored
  it; both of Jacob's "random strings" were this one span (landmine 185).
- **FIXED, field-reported:** action buttons at 28 px inside the folded drawer —
  flex-stretch in a clipped box squeezes below padding height; `min-height:44px`
  on the control itself (landmine 186).
- **FIXED, field-reported:** the away message opened the drawer under the
  first-run guide. `showQuiet()` — status fills the panel and the peek line
  without unfolding; cards still open it (landmine 187).
- **FIXED, field-reported:** relief defaulted ON and read as dark blotches over
  the flat basemap. Starts OFF, one tap away under Layers.
- **PROVEN:** all four asserted in a real browser, including the button height
  measured in the folded state specifically — where the report caught it.
- **Ruled out:** removing relief. On Hybrid at low opacity it earns its place;
  the fault was the default, not the layer.
- **Ruled out:** special-casing show() with a flag for startup. Status is a
  different KIND of content, so it gets a named function, not a boolean.
- **Open:** Jacob has more guide adjustments coming; the content will move.

## A133 — Reference redesign T1–T3 · SHIPPED take 113

Jacob's brief: onX hybrid, AllTrails light map, one app, Michigan only. Study
in docs/DESIGN.md; built as checkpoints, sealed once.

- **PROVEN (T1):** Lucide icons, bundled Barlow, one dark control language,
  accent once per screen, true sheet anatomy, place-name-first cards, place
  strip folded into Search (8 jump chips on empty query, asserted).
- **PROVEN (T2):** landcover extracted — 276 areas incl. the HNF boundary wash;
  ground/water/labels re-coloured to the reference family.
- **PROVEN (T3):** white cased roads · category badges on POI and paddle pins ·
  the Michigan trunkline diamond · onX imagery dimming · empty cells hide.
- **PROVEN:** 131 render checks passed untouched through the whole reskin
  (landmine 189); smoke 274 and gate 30 green at seal.
- **Ruled out:** a stack change. The gap was presentation; MapLibre carries the
  reference look in style JSON and canvas images with zero new dependencies.
- **Ruled out:** importing icon paths into badges — at 8 px inside a 26 px
  circle a hand stroke sketch reads better than any scaled import.
- **Open:** Jacob's real feedback pass on the finished direction — colours,
  badge glyphs and the trail palette on the light ground are his call now.
- **Open:** street-name labels still carry the old dark halo weight; label
  typography pass (Barlow SDF glyphs for the MAP itself) is a candidate T4.

## A134 — T4 · Barlow on the map itself · SHIPPED take 114

- **PROVEN:** glyph pack rebuilt from Barlow SemiBold; trail, water, street and
  shield labels all place under the render checks untouched.
- **PROVEN:** street labels re-tuned for the light ground (grey on light halo);
  they had carried dark-on-tan values since the old basemap.
- **Ruled out (held):** shipping two packs. The old face is deleted the same
  take.
- **Ruled out:** Regular weight — it goes thin under SDF at trail-label sizes.

### A134 original queue note (take 114)

The chrome speaks Barlow; the map still labels in the old glyph face. T4
regenerates the SDF glyph pack from Barlow so one typeface carries the whole
app, and re-tunes street-label halos for the light ground.

- **Ruled out:** shipping a second glyph pack beside the old one. One face,
  one pack; the old pack dies the same take.
- **Open:** scheduled after statewide lands — a glyph pack is region-independent
  and there is no reason to build it twice.


## A135 — Statewide preparation (A72's groundwork) · LANDED DORMANT take 114

- **PROVEN dormant:** michigan region declared (12 anchors in-bbox, bulk:true);
  bulk modes in ingest / contour / imagery / terrain / landcover, every skip
  printing its reason; default region unchanged, all paths inert for the box.
- **PROVEN by prior measurement:** 236× area but 18–26× network (take 75);
  statewide memory model proven by corridor.py in CI.
- **Ruled out:** statewide Overpass (volunteer-service abuse); z13 statewide DEM
  (~38,000 tiles); z12+ statewide imagery pyramid (8.6 GB, take 75).
- **Open:** the run itself — switch, measure, tune. Jacob's confirmed order
  (take 116): Michigan as a whole → Great Lakes water polygons via the area
  handler → tuning. Multiple takes budgeted.

## A136 — onX Backcountry study · AWAITING REFERENCES take 115

Third reference for the design synthesis. Slot reserved in docs/DESIGN.md §7.
- **Ruled out:** designing from the app's reputation before Jacob's screenshots
  arrive — transcribe, don't invent (landmine 190).
- **Open:** everything, pending captures.

## A137 — App modes: the multi-discipline vision · RECORDED take 117 (Jacob)

Jacob's direction, on the record: after the first Michigan draft, APEX splits
into MODES — General Outdoors, ORV/Mountain Biking, Hunting/Fishing, potentially
more. onX Hunt and onX Fish join the reference set (Jacob holds "tons of
screenshots", to be transcribed not invented, landmine 190). Implications noted
now so statewide decisions don't fight it: per-mode legality/routing profiles
(Return Home matters more cross-mode), per-mode POI emphasis, per-mode layer
defaults. Route-length expectations differ per mode (he judges Return Home is
not for massive trips in ORV mode).
- **Ruled out:** designing modes before the Michigan draft ships.
- **Open:** everything else, pending his screenshots.


## A138 — Statewide Michigan: FIRST CUT SHIPPED take 117

The one-stop Michigan app exists: 473,674 edges routed, 127 MB bundle, six
route profiles at 84–102 ms, suites green (smoke 274+/5 modes, render 124).
- **PROVEN:** connector-only residential (6,272 bridging ways = 2.4% carry all
  connectivity); legality memo + expansion cap + pre-summary length filter;
  HOME/open-view spec; cross-artifact alignment guard; closure lines
  undroppable in dedup.
- **PROVEN:** the harness scales — expired box premises (197) and tiling races
  (198) identified and cured as classes, not instances.
- **Ruled out:** keeping all residential (OOM at 3 GB) and dropping all
  residential (severed a third of the network) — the bridge subset is the
  proven middle.
- **Open (Jacob's order):** ~~Great Lakes polygons~~ SHIPPED take 118 (738
  relation-assembled water bodies via the landcover area handler) → tuning
  (Silver Lake riding area, summits OOM, 53.7 MB address, corridor box-prose,
  A96 typed arrays, residential display layer) → A136/A137 references and
  modes.

## A139 — Great Lakes destination POI · RECORDED take 118 (Jacob)

The big lakes are not rivers: no put-ins/take-outs, no float times — corridor
treatment does not apply and never will. What they get instead, in a future
data pass: the MAJOR destinations — principal boat launches, lighthouses,
famous fishing grounds and hangouts (Jacob names Manistee's launch/lighthouse
as the archetype; there are thousands of such places around the state).
- **Ruled out:** corridor float treatment on the Great Lakes.
- **Ruled out:** importing every ramp — MAJOR is the word; curation or a
  quality signal (official designations) picks them.
- **Open:** source selection (DNR boating access sites layer? USCG lights?)
  and the badge classes, after tuning.

## A140 — Riding areas: DNR scramble-area polygons · SHIPPED take 119

Silver Lake is ground, not trail (Jacob, take 117). Source found at take 119:
`DNR_ORV_Scramble_Areas` on ArcGIS Online — 8 designated areas statewide,
server total = shipped.
- **PROVEN:** 8 polygons in 9 KB; fill/outline/label draw in a real browser;
  the tap card yields to any trail under the finger; group on by default.
- **PROVEN:** the DNR trails MapServer holds only the two access routes into
  Silver Lake — the perimeter was never going to come from the layers we had.
- **Ruled out:** OSM as the source — nothing tagged as the riding area was in
  the extract's tag set; the DNR layer is authoritative and complete.
- **Ruled out:** importing ingest.query() — landmine 201.
- **Open:** private motocross parks (Ogemaw Hills etc.) as a POI category in
  the places pass, with a badge that says "private, fee" — Jacob wants them
  drawn; they are businesses, not designated riding ground.
- **Open:** routing awareness — Return Home and Directions still route to the
  nearest edge; inside a scramble area "ride anywhere" could mean a straight
  line to the edge. The card says so; the router does not yet.

### A138 note (take 119)
Summits OOM CLOSED (landmine 200) — 323 statewide, contour artifact ships
lines-empty. Bundle now verifies COMPLETE.

### A96 note (take 120)
Spatial grid SHIPPED for nearestEdge / nearestNode / nearestEdgeTo — exact
(asserted against the linear scan), 304 → 41 ms in Chrome incl. build.
- **Open:** nearestPavement (40 ms) and addressAt/addressNear (41 ms each)
  are the next linear scans; the address index (53.7 MB) wants the same
  grid treatment and a size diet together.

## Take-120 field report (Jacob, 2026-08-26) — everything, ranked

Self-test on the Fold: PASS 46, dispatch 654 → 300 ms (grid), fps 117.
Bundle hash `4d051023100b9aff` = t119's — CI restored cached payloads and
skipped terrain, so the riding-area patches never ran (Δ49 unchanged).

### A141 — WITHDRAWN, and the reason matters
First read: "CI restored cached payloads and skipped terrain, landmine 196
again." Checked instead of asserted: the local bundle carrying the terrain
patches hashes 3509f18cb103eac3; Jacob's t120 build hashes 4d051023100b9aff,
byte-identical to his t119. Identical data is exactly what the FIRST t120
zip (grid only, app-side) should produce — it was sealed before the patch
work and resealed after. He built the pre-reseal zip. No cache bug; the
patches have simply never run in CI yet. Landmine 203: two seals under one
take number is a trap — the take number is the only handle Jacob has, so a
reseal must bump the take, not reuse it.
- **Do:** verify Δ on Bull Gap after the next build; if it is still 49 ft
  with a bundle hash of 3509f18c or later, THEN the cache is the suspect.

### A142 — the tan state wash covers the map · P1 · statewide visual
At state/regional zoom the context land polygon draws OVER landcover: the
whole peninsula reads as a flat tan sheet with a dark outline (Jacob's
"tan overlay covers the map"). Move the land fill beneath the ground
layers or fade it out by z8; keep the outline.

### A143 — POI prominence tiers · P2 · trip planning
"Major" places — trailheads, campgrounds, riding areas, dunes, launches —
should be ~2× the badge size and visible from ~10 mi out (z≈9); food, fuel,
stores from ~3 mi (z≈11+). Today one size, one minzoom. Two tiers in the
poi payload (`t: 1|2`), two symbol layers.

### A144 — bottom sheet bleeds into the Layers/Locate/Search row · P2
Screenshots at Silver Lake: the folded sheet's top edge overlaps the
button row. Fold height vs button row bottom margin; check on the Fold's
411×960 inner screen with the Android gesture bar.

### A145 — elevation readout + basemap selector: move up, recolour · P3
Now the quick chips are gone the top-left stack can rise; the readout is
white and invisible on the light map (fine on Hybrid). Use the chrome
dark on light, white on sat — same rule as the labels' halo.

### A146 — missing lake access: beaches, launches, parks · P2 · data
Waterford: Pontiac Lake beach, Dodge Park, public kayak launches absent.
poi.py tags to widen: leisure=beach_resort, natural=beach (named),
leisure=slipway, canoe=put_in / canoe=yes, leisure=park with water access,
DNR Boating Access Sites (DNR has a BAS layer — authoritative, like the
scramble areas). Ties into A139 (Great Lakes destinations).

### A147 — How-to guide did not open on first launch · P3
It works from Tools; one launch showed a broken card (screenshot
6ddfb0.jpg) that self-healed after load. Likely a race between the guide
and the loader on the 38 MB graph parse.

### A148 — compass phases in and out · P3
Heading reads well but skips/fades while in use. Magnetometer sample
smoothing / stale-reading fallback to GPS course while moving.

### A149 — self-test drives the map to Bull Gap · P4 · box-era premise
stRouting drills Bull Gap → Pink Store (hardcoded box anchors, landmine
197) and leaves the map there; Jacob read it as the app "zeroing". Derive
the drill from the anchors nearest the rider and restore the view after.

### Ruled out (take 121)
- **Ruled out:** a CI cache bug behind the unchanged Bull Gap elevation —
  bundle hashes prove Jacob built the pre-reseal t120 (A141, landmine 203).
- **Ruled out:** one POI layer with zoom expressions for A143 — destinations
  and services need different minzooms, which a single layer cannot carry.
- **Ruled out:** fading the state fill instead of restacking it (A142) — a
  translucent sheet over data is still a sheet over data.
- **Ruled out:** naming Waterford's nameless launches from nearby features
  (A146) — that is the invention poi.py's beach exception exists to refuse.

### Order of attack (take 121)
A142 (tan wash — the whole state reads wrong) → A144 (sheet overlaps the
button row) → A145 (readout invisible on light) → A143 (POI tiers) →
A146 (lake access data) → A149 (self-test hijacks the view) → A147/A148.

## Take-121 field report (Jacob, 2026-08-26) — A150–A154

Full investigation in docs/DIAGNOSIS-t121.md (read that first; every cause
below was proven from the tree or measured, not guessed). No code changed
this cycle at Jacob's instruction.

Confirmed fixed on the phone: Bull Gap elevation Δ49 -> **Δ0** (riding-area
z13 patches), map area 65% -> **81%** of screen, roads check names its view.

- **A150 · P1 · the chips are unreadable in BOTH basemaps.** `.basebtn` text
  is --bone #F5EFE2; `.basebtn.on` tints the background with the same cream
  at 16%. Over satellite the tint vanishes and the text floats unbacked
  (24321, 24319); over the light map the pill shows and the cream text
  disappears into it (24325, 24317 — a ghost pill with no legible label).
  Unreadable only when ON, in opposite ways. A first pass at this claimed the
  light map was fine; Jacob's crops disprove it.
  - **Jacob asks: do we still need the cream tint?** No — delete the concept.
    The chip label ALREADY states the state ("Map"/"Satellite"/"Hybrid",
    "All routes"/"ORV / dirt bike"); the tint re-encodes that in the least
    legible channel available. Rule to adopt: every floating control is one
    opaque surface, state lives in the label, never in the background. ON =
    brighter border + an accent dot.
  - Readout/scale: one treatment everywhere per Jacob — dark ink, white
    outline via four +/-1px shadows, not a blur (a blur is what made it read
    grey over imagery).
  - Add to verify_palette: floating-control background alpha >= 0.85 and text
    contrast >= 4.5:1 in BOTH basemap states.
  - **Ruled out:** a rendering or z-order fault — "All routes" in its OFF
    state is crisp in the same screenshot.
- **A151 · P1 · pins pop in and out.** `icon-allow-overlap:false` below z11.4
  hands 670 destination badges (Oakland, 10 mi) to a collision solver whose
  answer changes on every pan and tile load. Fix by thinning the DATA: a
  prominence rank from poi.py filtered by zoom, then allow-overlap true
  everywhere; dedupe unnamed launches within ~200 m (1,167 of 2,156 are
  unnamed).
  - **Ruled out:** badge size as the cause — 24327 at 2000 ft is stable and
    reads well; density is the variable.
- **A151b · P1 · badge and name are placed independently.** 24315 (z~12.2)
  shows launch NAMES with no badges; 24323 (z~11.8) shows launch BADGES with
  almost no names — opposite failures at nearly the same zoom, because A143
  split pins into two symbol layers that collide separately. Pair icon+text in
  ONE layer with text-optional:true, or prove it is fade churn first: park,
  count both layers, pan 200px, settle, count again at the same centre.
- **A155 · P4 · guide rewrite for statewide** (Jacob's own ranking: lowest).
  It still teaches Bull Gap and the Pink Store as the world. Do it after the
  pin work, or it documents pins that are about to change. Ship with the
  bumped GUIDEKEY from A147.
- **A152 · P1 · trailhead = any named car park.** 1,902 statewide, including
  ".", "001", "1 hour/Handicapped", "RMHA Pool Parking Lot". Require
  proximity (~150 m) to a designated trail or forest road; demote the rest.
- **A153 · P2 · Hybrid is a white grid, and blurry.** minor/paved are literally
  #FFFFFF (take 113, correct for a 20k-edge box) and the statewide graph
  carries 246,883 context ways. Dim and narrow roads on satellite only.
  Blurriness is the take-75 trade (464 m/px mosaic, no z12+ pyramid); the
  answer is imagery patches over the 8 riding areas + ORV corridors, the same
  shape as the terrain patches.
  - **Ruled out:** the ORV selector failing to filter — applyAct exempts roads
    deliberately, "you still need to know where the road is".
- **A147 · P3 · guide never auto-opens.** Not a race: localStorage
  `apex.guide.v1` survives every install, so it has been marked seen since an
  earlier take. Version the key with the guide's content.
- **A154 · P2 · diag/compass panels overlap the Tools strip.** Both anchored
  `bottom:64px`; the strip is ~76 px since A144 added its bottom padding —
  take 121 made this worse. Publish the measured strip height as a CSS var.
- **A148 · P3 · compass phasing.** Hypothesis only (Jacob's call): no
  smoothing and no hysteresis between magnetometer and GPS course. Needs a
  real ride to judge.

**Measure, do not guess:** dispatch-scan reads 654 / 300 / 662 ms across
t119-121 on the same phone. Only nearestEdge is grid-backed; nearestPavement
still walks 474k edges and addressAt runs twice over 770k segments, and the
grid builds lazily so it may or may not fall inside the timed window. Report
all six calls separately plus window.__gridMs (exposed at A96, never read)
before optimising anything.

### A156 · P1 · out-of-state bleed (Jacob, 24331) — DATA, do before A151
Agency layers are fetched with the region BBOX and never clipped to the state
polygon. 7,413 of 474,047 edges sit outside every Michigan county: Lakeland
ATV and Price County snowmobile trails (Wisconsin), Chequamegon-Nicolet forest
roads, Superior NF spurs (Minnesota). Landcover and state-fill DO clip, which
is why the foreign networks sit on bare white in the screenshot — two
subsystems disagreeing about what the region is.
- **Ruled out:** OSM. The Geofabrik extract is state-clipped and `track` shows
  almost no bleed; the USFS MVUM layers carry it (fstrail 11% out-of-state).
- **Ruled out:** Ontario data. Jacob read "Canada"; the northernmost cluster
  is Minnesota's Arrowhead at 48.0,-90.0. No Ontario features found.
- **Fix:** clip at ingest against context.py's shoreline polygon (promote it
  to a shared artifact), keep boundary-crossers whole, report drops per layer.
- **The missing assertion:** every check asks "inside the region BBOX" —
  which these pass. Nothing asks "inside the region POLYGON". Bbox and polygon
  were the same thing for 118 takes of box regions; statewide they are not.

### Take 122 — shipped
A150 (opaque controls, permanent dark readout), A154 (panels on --strip-h),
A156 (state-polygon clip at ingest + POI, gate check_region_polygon, 3,774
USFS features dropped, beach trails preserved by a 1 km dilation), A152
(trailhead needs a trail within 150 m: 1,902 -> 732).
- **Ruled out for A156:** the 1:20m polygon context.py draws — too coarse for
  keep/drop on the shoreline; the undilated 1:500k mask — dropped 82 real
  Michigan beach trails.
Open: A151/A151b, A153, A147/A155, A148, A139, private MX parks, DNR Boating
Access Sites.

### Take 123 — shipped
A151/A151b: prominence rank `pri` in poi.py (0 camps/trailheads/day-use/
views, 1 named launch/beach, 2 unnamed, 3 services), zoom-stepped filter on
the destination layer, overlap allowed everywhere, badge + name in ONE layer
with text-optional. 79 clustered unnamed launches collapsed.
- **Ruled out:** smaller badges (density, not size, was the variable).
- **Ruled out:** clustering at runtime — a deterministic rank is stable under
  panning; a cluster re-forms on every camera move, which is the flicker.

### Take 124 — shipped
A153 (roads dim/narrow/warm on satellite only), elevAt exact on the grid
(Mio Δ27 was stride sampling, not terrain), trail-names a real assertion in
data-derived trail country (was vacuous at Silver Lake for three takes).
- **Ruled out:** dimming roads on the Map basemap too — that one reads
  correctly and was never the complaint.
- **Ruled out:** hardcoding a trail-country coordinate for trail-names
  (landmine 197) — it is derived from the nearest designated edge to CTR.

### A136/A137 · Modes — DESIGNED, not built (docs/DESIGN-modes.md)
Three modes as presets over tables that already exist: Ride (ORV/MTB),
Outdoors (hike/camp/fish/hunt), Water (beach/kayak/tube/boat). Foot routes
(69,628) and bike routes (2,949) are already in the bundle, show-only, never
drawn by default. Build order: MODES table + chip → draw foot/bike → walk
machine → water data (marina, DNR BAS, A139) → hunt/fish data after Jacob's
onX screenshots are transcribed (landmine 190).
- **Blocked on Jacob:** the onX Hunt / Fish screenshots, for step 5 only.

### Take 125 — shipped
A136/A137 step 1: MODES table + chip (Ride / Outdoors / Water), each a preset
over act, POI kinds, layer groups, basemap; persisted; restored on load.
New activities `ride` (ORV + two-track + MTB) and `none`. Five render
assertions per mode from resolved style state.
- **Ruled out:** Ride dropping any pin kind — Ride must be exactly today's
  map (the place-tap check enforced it).
- **Ruled out:** rebuilding the Layers panel while hidden — its opacity-0
  rows still count against the accent budget.
- **Next (step 2):** Jacob's field verdict on 69,628 foot routes at state
  zoom; if hairball, a `pri` rank for show-only routes like the pins got.

### Take 126 — shipped
Jacob's modes field pass: Outdoors relief OFF (hillshade also 850 → 4096 px
statewide); Ride drops launch/beach and demotes store/food/info to z13; Water
boosts launch/beach to rank 0; minor roads on imagery fade in from z12,
highways at 0.35; statewide mosaic 1500 → 4096 px (~464 → ~234 m/px); ON-dot
bone not orange; trail-names check controls act as well as viewport.
- **Ruled out:** wrapping the destination layer's zoom-step filter inside
  `all` for the mode constraints — a zoom step is legal only at the top of
  a filter (landmine 52); modeFilter() applies constraints per branch.
- **Ruled out:** a 6400 px native mosaic — the Fold's 8192 texture allows
  it, but 4096 is the floor other devices guarantee.

### Take 127 — shipped
A153 second half: sparse z12–z15 imagery patches over the 8 riding areas
(818 tiles, 17.9 MB, 3.4 m/px) on a second raster source above the
statewide mosaic, read through an apexsat:// protocol that answers out-of-
box and missing tiles with a blank — never a map error. Render proves the
layer is visible and its source loaded at St. Helen; 143/0.
- **Ruled out:** a statewide pyramid (8.6 GB at z15, take 75 stands).
- **Ruled out:** plain tile URLs — a 404 is a map error, and map.on('error')
  decides RENDER FAIL.
- **Ruled out:** reading window.BUNDLE from the harness — app.js is wrapped;
  the check silently skipped and only the count (141, not 143) gave it away.

### Take 128 — shipped
DESIGN-modes step 3: `walk` machine (3 mph via spd() override; Outdoors
enters on foot and restores the rider's machine on exit). Four onX screens
transcribed into DESIGN-modes.md; Hunt specified from them.
- **Ruled out:** routing over the 69,628 foot routes now — they are
  show-only by graph design; adding them is a size/conflation decision for
  Jacob, recorded as open.
- **Ruled out:** parcel owner names and wind-at-stand for Hunt — no free
  statewide source / needs weather; stated in the design rather than faked.

### Takes 129–130 — shipped
129: trail-system pins (343 hiking / 112 MTB, mileage on the card; corridors
>40 km stay lines), county lines + labels (Outdoors on), summits from z9 in
Outdoors. 130: mode picker replaces the cycle.
- **Ruled out:** one pin for statewide corridors (North Country Trail,
  Iron Belle) — a centroid of a 500-mile line is nowhere.
- **Ruled out:** keeping the cycle with a long-press picker — Jacob asked
  to choose, and a description beats a remembered order.

### Takes 131–132 — shipped
Photos on major pins (608; Wikipedia article + Commons geosearch fallback;
description line; attribution), A139 lighthouses (101) and marinas (322),
DNR public land (657 tracts, 4.70M acres, Outdoors on), ingest tag-set
stamp + header-only skip check, shapely in CI.
- **Ruled out:** Google photos (licence forbids caching); layer 13 project
  boundaries (administrative); parcel owner names (county GIS); DMUs (no
  published layer — blocked on the digest).
- **Ruled out:** six photo workers — Wikimedia 429; 3 workers + contact UA +
  pause sustains ~59 lookups/min.

### Takes 133–134 — shipped
133: guide rewritten for state + modes, key apex.guide.v2 (A147/A155).
134: hiking (`foot`) routable for the walk machine; noder thins shared-run
junctions with foot lines (998k → 577k edges, graph 46.6 MB); unnamed OSM
paths are class `path` (drawn, never routed); nearestJunction +
nearestPavement on the grid (dispatch 3,445 → 87 ms); ROUTE_CAP scales with
NODES.
- **Ruled out:** routing only the 455 pinned systems — the doubling was
  two-track being chopped by the noder, not hiking edges.
- **Ruled out:** a gate exception for foot in the walk list — the
  routable-or-show-only law stands; the data got a second class instead.

### Takes 135–137 — shipped
135: photo step progress + time budget. 136: CI never fetches — photos ship
in the seed (landmine 205: 12× throttle on GitHub runners, measured).
137: typed hunting waypoints (stand / camera / sign / water / gate) in
Outdoors, one WPTYPES table, colour by type.
- **Ruled out:** a bigger CI budget for photos — 12.5 s per lookup means
  ~120 photos per 25-minute build; shipping them is the honest fix.
Open Hunt items: DMUs (need the digest page), contours over public land.

### Takes 138–139 — shipped
138: transparent blank tile (was blue at 50 %), guide markup balanced (tab
bar back). 139: address index v2 delta-int (52 → 28 MB), addressAt on a
midpoint grid — dispatch card 2 ms in headless.
- **Ruled out:** 1e-4° precision for the index (2 MB for lost fidelity).
- **Ruled out:** dropping unnumbered segments — there are none.

### Takes 140–141 — shipped
140: statewide z11 imagery base under the riding-area patches (2,695 tiles,
~38 MB) — Hybrid 4× sharper outside the eight areas; readout and scale get
a real `-webkit-text-stroke` (four ±1 px shadows separate into dots at the
Fold's dpr). 141: Hunt is its own mode — public land, game areas, county
lines, summits from z9 and the typed waypoints; Outdoors back to the
hiker's map; MTB systems draw a bicycle glyph.
- **Ruled out:** z13 statewide imagery (400 MB). Field verdict 24493: z11
  still reads pixelated at 1 mi — the z12 base (+104 MB) is queued work.
- **Ruled out:** hunting layers living inside Outdoors — the public-land
  squares crowd the hiker's map (Jacob, 24280).
- 141 process note: first pass died proven-but-unsealed at a chat limit
  (landmine 207); replayed from the transcript onto the sealed t140 tree.
  First seal, so landmine 203 is satisfied.

## A156 — Ski & snowboard hills · SHIPPED take 142
Resort pins in Outdoors from `landuse=winter_sports`; run list with
difficulty from `piste:type` ways inside the polygon; website link; photo
and description from the Wikipedia pass; bike glyph in Ride for the
summer-MTB hills. Nordic out. (Jacob, 24280.)

### Take 142 — shipped
36 ski/snowboard hills from `landuse=winter_sports` (ski kind, Outdoors),
609 named runs with tagged difficulty on the cards, website links, 17
Wikipedia photos; skier glyph verified at 3.4× and real size.
- **Ruled out:** nordic pistes — a groomed loop is not a resort.
- **Ruled out:** guessing untagged difficulty — untagged renders grey.
- **Ruled out:** piste ways in the graph — no highway tag, the selector
  never admits them (verified, not assumed).

## A157 — Hybrid fidelity: z11+z12 statewide base pyramid · SHIPPED take 143
Field report 24493: z11 base still pixelated at 1 mi. Base to z12 (10,573
tiles / ~104 MB / 27 m/px); patches unchanged. Size accepted for now;
WebP re-encode measurement queued separately (Jacob: "work backwards").

### Take 143 — shipped
Statewide base is a z11+z12 pyramid (14,058 tiles / 183 MB with patches):
27 m/px under Jacob's 1-mi view, no regression band anywhere. Manifest
carries "base"; app satbase maxzoom follows it; render check parametrized.
- **Ruled out:** z12-only base — a raster source cannot underzoom, so
  z11-11.9 views would fall back to the mosaic. Worse than t140 in that
  band; the pyramid costs 38 MB more and regresses nothing.
- **Ruled out:** z13 statewide (~400 MB) — unchanged from take 140.
- Queued: WebP re-encode measurement (A158) to work the ~235 MB APK back
  toward the sub-100 MB ideal ("optimize backwards").

## A158 — Imagery size · SHIPPED take 159 (chroma, not WebP)
The bundle is the APK and imagery is now its biggest slab (183 MB JPEG).
Measure: WebP q~70 on a representative tile sample — size delta, visual
delta on the Fold, decode support in the WebView (API 24+ is fine).
Decide re-encode vs keep-JPEG from numbers, not vibes.
- **Ruled out:** dropping the z11 base level to buy back 38 MB — that
  reopens the exact regression band take 143 closed. Size comes from the
  codec or nowhere; the pyramid stays whole.

## A159 — Field report 24542 (t143 APK, Flat Rock at ~1 mi) · DECIDED
"Better but hard to tell — still extremely pixelated despite 230 MB."
Verified from Jacob's own APK: all 10,573 z12 tiles aboard, manifest
base:12, and tile 12/1100/1519 (his exact spot) is crisp at its native
28 m/px — the blur is arithmetic, not delivery. At 1 mi on the Fold the
screen wants ~5 m/px; z12 leaves a ~5x stretch (t143 halved t140's ~10x).
Sharp-at-1-mi needs z14–15: statewide that is 2.2–8.6 GB — no APK can
carry it. Raising the base further is a dead end; the fix is structural.
Options on the table for Jacob: (a) on-demand offline imagery downloads
per area/county (the onX model — z13–15 pulled from USGS to device
storage for places he picks, ~50–150 MB per county); (b) online streaming
Hybrid with cache-as-you-go, offline falls back to the z12 base;
(c) hold at z12 and take the WebP size win (A158) only.
- **Ruled out:** raising the statewide in-APK base past z12 — z13 is
  ~550 MB, z14 ~2.2 GB, z15 8.6 GB (take 75's measurement stands).

## A160 — HD imagery: manual streaming + area saves · IN PROGRESS (144 store+resolver · 145 chip+saves · streaming next)
Jacob picked a hybrid of streaming and downloads with two hard rules:
NOTHING automatic, and one simple visible control. Design of record:
- One **HD chip** top-right by the basemap control. OFF by default.
  First tap opens a two-choice sheet in plain words.
- **Stream HD while connected**: z13–15 live from USGS with signal,
  cache-as-you-go into a bounded LRU (~250 MB); no signal, no cache →
  built-in z12 base. Chip states its truth: "HD · streaming" /
  "HD · offline base".
- **Save HD for this area**: the visible area / riding area / county,
  size quoted BEFORE fetch ("~85 MB"), progress in the chip exactly as
  Jacob sketched ("HD 42%…"), pausable, deletable under Tools.
- Implementation: extend the apexsat:// resolver — bundle → saved store →
  (streaming on + online) fetch+cache → blank. Pipeline and CI untouched;
  same free USGS endpoint the pipeline uses. Est. 3–4 takes.
- Size ledger that motivated it (from Jacob's t143 APK, 240 MB): z12 base
  127.7 + z11 38.0 + patches 17.3 = imagery 183; photos only 9.8 (ski
  added ~2). The pyramid law: each level costs 4x for 2x sharpness.
- **Ruled out:** automatic/background downloads of any kind (Jacob).
- **Ruled out:** raising the in-APK base past z12 (A159 numbers stand).
- A158 (WebP on the SHIPPED bundle) proceeds independently to shrink the
  APK itself.

### Field report — t143 self-test on the Fold (PASS 50 · FAIL 2), and the FIRST EXTERNAL TESTER's notes (via Jacob)

## A161 — self-test style-loaded reads a flickering flag · OPEN
XX style-loaded false while 292 features drew, roads passed, 0 map
errors. isStyleLoaded() is legitimately false mid-tile-transition; the
check reads it once. Fix: settle-then-measure (poll a few seconds) like
every other honest check.
- **Ruled out:** treating this as a style bug — the same run proves the
  style painting.

## A162 — one 1,783 ms frame on the first fps run · CLOSED (noise)
avg 29 poisoned by a single giant frame (1/70 over budget, 596 features);
the rerun scored 120 fps / worst 16 ms. First-paint decode or JIT burst.
Watch across future self-tests; profile only if the field ever feels it.
- **Ruled out:** acting on one frame from one run — a stall that never
  recurs is noise, and the self-test already reran itself to prove it.

## A163 — Paddle planning: Water mode routes on WATER · OPEN (design next)
Tester: planned launch-to-launch and got walked down major roads. The
plan system is the land graph in every mode; Water should route down the
river using the corridor lines we already ship (76 corridors, ordered
downstream, portages marked, launch access scored). Put-in / take-out,
distance by river, estimated float time (livery-style estimates like
Hinchman Acres' Au Sable times as calibration).
- **Ruled out:** noding the rivers into the land graph — water is a
  different network with different legality; corridors stay their own
  system.

## A164 — Live gauge data on rivers (USGS waterdata) · OPEN (design next)
Tester's link: USGS-04137500 (Au Sable at Mio) — flow, stage, temp are
public and current. Fits §8's in-app provisioning rules exactly: user-
invoked or clearly-stated streaming, host declared, never load-bearing.
- **Ruled out:** shipping stale gauge readings in the bundle — a
  water level from build time is worse than none.

## A165 — Water mode's "machine" should be a boat · OPEN
Kayak / canoe / raft as the activity in Water, switching with the mode
(tester: "we kinda do this already but it could use improvement").
Feeds A163's float-time estimates (a raft is not a kayak).
- **Ruled out:** a separate boat button beside the machine button — one
  activity control, mode-aware, as today's foot/machine switch is.

## A166 — Canoe/kayak liveries appear in Ride, vanish in Water · OPEN
Backwards, per the tester. Find which kind swallows rental POIs (store?
marina?) and put liveries in Water's kind list — they are put-in
infrastructure, not shopping.
- **Ruled out:** showing them in both — Ride's pin budget is already
  spent on riding.

## A167 — Rename the Ride mode label to "Off-road" · take 146
Jacob's direct call. Label and guide text only; the internal key 'ride'
and the "Ride it" recording verb stay — renaming keys breaks saved
state, and "go for a ride" is the activity, not the mode.
- **Ruled out:** renaming the k:'ride' key — persistence and harness
  hooks hang off it for zero rider-visible gain.

### Field report — t145/t146 session two (Rifle River, via Jacob)

## A168 — Rivers findable by name · SHIPPED take 152
"rifle river" returned a STREET and three trails, never the river. Every
mapped corridor is a search row now, ranked with the best hits; the hit
fits the whole river and opens a summary (miles, accesses, dams) that
points at the run flow.
- **Ruled out:** dropping a pin at the river's midpoint — a 60-mile line
  is not a point, and the run flow is the destination.

## A169 — Missing river accesses · SHIPPED take 151 (with an honest limit)
The Rifle's mapped 60.8 mi held TWO named OSM accesses; Jacob has stood
on ramps we did not show. Root cause: OSM coverage, not the algorithm
(verified — the only OSM "High Banks" launch is on the MANISTEE). Fix:
the DNR's Michigan Boating Access Sites layer (1,325 sites, same host
PROVISION already declared) merges into launch pins (+280 statewide) and
corridor candidates, 120 m same-ramp dedupe, OSM's fuller names winning.
- **Honest limit, written where it bites:** state-sponsored sites only.
  County/township ramps — the Rifle's High Banks among them — are in
  neither OSM nor this layer. Those need OSM contribution or a county
  source not yet found.
- **Ruled out:** hand-placing High Banks from a Google pin — one
  coordinate typed from a screenshot is landmine-190 bait, and the next
  missing ramp would need the same favour.

### Takes 147–152 — shipped (the tester batch, one seal — Jacob's call)
Every mode plans something. 147: 36 liveries from real boat_rental ingest,
in Water and Outdoors. 148: self-test settles the style flag (setTimeout
chain — smoke pumps timers, not microtasks). 149: kayak/canoe/raft as
Water's machine with craft memory; run flow reachable from launch pins;
run card names the craft and its livery-calibrated pace. 150: 241 USGS
gauges shipped, live values on a tap under §8. 151: 1,325 DNR boating
access sites into launches (+280) and corridors — the Rifle from 2 named
accesses to 6, nameless OSM twins adopting DNR names. 152: rivers are
search rows; a river hit fits the river.
- **Ruled out:** shipping any of the live-network features as automatic —
  every network touch is a tap (Jacob's law, twice stated).
- Verified: smoke 5 modes, render 195/0, self-test 42/0 non-render under
  stubs. Three explicit-map artifacts bit in one batch (manifest keys,
  IN_BUNDLE, the split loader) — each caught by a drill, each now carries
  gauges.

## A170 — Pin stacking in dense areas · SHIPPED take 154
Hess Lake (24571): five real launches + a marina overlap; the two
prominence tiers draw over each other and read as "a small pin inside a
big one". They ARE distinct places. Candidate: same-kind stack badge — a
single pin with ×N where several of one kind collide at the CURRENT zoom,
separating as you zoom in; tap lists the members. Needs a design pass:
MapLibre's built-in clustering merges across kinds and fights the
per-mode filters, so the honest version is per-kind and zoom-aware.
- **Ruled out:** data-side collapse (an A151-style merge) — zoom-blind, it
  would hide genuinely distinct neighbours exactly when you zoom in to
  separate them.
- **Ruled out:** letting it be — Jacob flagged it, and a pin hiding
  another pin is a map lying by occlusion.

### A170 design of record (Jacob 24507/24509 — the reference app's
### numbered clusters at low zoom, plain pins when you zoom in)

Feasible, contained, and the trap is ONE thing: MapLibre clusters at the
SOURCE, and this app selects pins by LAYER FILTER (`modeFilter` sets
poi-dot / poi-dot-major). Stock `cluster:true` on the `poi` source would
therefore count all 25,798 places — including the 17,544 fuel/food/store
pins Jacob explicitly excludes and every kind the current mode hides. The
badge would read a number no rider could ever reach. That is the failure
this project exists to refuse, so:

- **A SECOND source, `poiclust`**, carrying only CLUSTERABLE kinds ∩ the
  current mode's kinds, its data re-set on every mode switch (the
  features are already in memory; setData is cheap). The source IS the
  filter, so the count cannot lie.
- **Clusterable = destinations only** (8,254 statewide): launch, camp,
  trailhead, system, mtb, ski, livery, beach, marina, lighthouse,
  dayuse, view, shelter. **Never** fuel, food, store — Jacob's rule.
- `clusterProperties` carries per-kind counts, so a HOMOGENEOUS cluster
  draws its own glyph with ×N (his idea) and a mixed one draws a plain
  numbered circle (the reference app's behaviour).
- Clusters live below the zoom where pins already separate; above
  `clusterMaxZoom` the map is exactly what it is today. The existing poi
  layers must exclude clusterable kinds below that zoom or both draw.
- Tap a cluster: zoom to its bounds; at max zoom, list its members.
- **Ruled out:** clustering the single existing `poi` source — the count
  would include filtered-out and never-cluster pins (see above).
- **Ruled out:** one clustered source per kind — 13 sources and 13 badge
  layers to avoid one `clusterProperties` expression.
- **Cost:** one take to build (source, badges, mode wiring, tap, drills),
  likely a second to tune radius and thresholds against a field report.
  Memory is a non-issue: ~8k points indexed beside a 573k-edge graph.

### Take 154 — shipped
Same-kind pin stacks below z11.4: one badge, one kind, ×N, tap to open.
12 clusterable destination kinds (POIKIND d:1); services never stack;
the pool is the mode's own kinds so a count can only include reachable
pins. Radius 38 px (Jacob's agreed starting point — it took the biggest
statewide pile from ×150 to ×65).
- **Ruled out:** MapLibre/supercluster clustering — it merges by
  proximity alone and cannot partition by property, so 20 of its first
  23 piles were MIXED. Jacob's rule is "similar and major pins", so the
  bucketing is per-kind in JS: bin by kind + grid cell, stack only where
  2+ of one kind share a cell. Fewer layers than the supercluster
  version, not more.
- **Ruled out:** one clustered source per kind — 13 sources, 39 layers.
- **Ruled out:** clustering `shelter` — POIKIND flags it d:0, i.e. not a
  destination, and it was never a low-zoom pin before this take.
- **Ruled out:** letting the badges evict labels. They draw over
  everything (allow-overlap) but no longer BLOCK (ignore-placement);
  verified against t153's baseline of exactly 1 label at that camera.

### Take 155 — shipped
Jacob asked whether stacks appear when FULLY zoomed out; the take-154
drill only proved z8.4. The harness now asserts at the map's own floor
(minZoom 5.2). Documentation caught up: A170 marked shipped, landmines
208 and 209 recorded.
- **Ruled out:** answering the question from the code rather than from a
  measurement — the whole project's rule.

## A171 — Boot loading screen · SHIPPED take 156
Cold start shows raw __IC_ tokens on a tan background until app.js runs
(Jacob 24582). Static splash painted on first paint, real progress from
boot milestones, lifts into the guide/permission prompt.
- **Ruled out:** the 10-second fixed timer Jacob offered as a shortcut —
  it either wastes a fast phone's time or lifts before a slow one is
  ready, and a progress bar that does not track progress is an instrument
  that lies. The milestones are already countable.
- **Ruled out:** hiding the raw-token problem forever instead of fixing
  it. The splash covers boot; the tokens being runtime-substituted at all
  is filed as its own item (A172).

## A172 — Icon tokens are substituted at RUNTIME · SHIPPED take 158
__IC_*__ ships literal in index.html and app.js swaps it at boot, which
is why a cold start reads broken. Build-time substitution would remove
the failure mode entirely rather than covering it.
- **Ruled out:** doing it inside take 156 — the splash is the fix Jacob
  asked for and mixing a build-system change into it would put two risks
  in one take.

## A173 — Basemap-switch busy line · SHIPPED take 157
A 3 px red line at the top edge while a basemap change settles; armed on
switch, hidden on map idle, 200 ms grace so instant switches do not
flicker, 15 s ceiling so it cannot stick.
- **Ruled out:** reusing the take-156 splash for basemap changes — it
  would cover the map the rider just asked to look at.
- **Ruled out:** a spinner in the basemap chip alone — the chip is
  already carrying the basemap NAME, and the HD chip owns progress text;
  two chips counting different things would read as noise.
- **Ruled out:** blocking taps while it shows. Imagery loading is not a
  reason to take the map away.

### Take 158 — shipped
The shell holds at opacity 0 until paintIcons() has run, so raw __IC_
tokens can never be on screen — the splash covers the boot, and behind it
there is now nothing ugly to cover.
- **Ruled out:** build-time token substitution — it needs a second copy
  of ic()'s SVG wrapper in Python (landmine 98) and drifts silently when
  the wrapper changes.
- **Ruled out:** revealing only on paintIcons success. Invisible and
  tappable is worse than ugly and honest, so the reveal is unconditional
  with an 8 s backstop on top.

## A174 — Pin cluster tuning · OPEN (Jacob, after t157 field test)
"The pin clusters will need additional tuning, but good enough for now."
Knobs, all measured rather than guessed when the report arrives: cluster
radius (38 px today — 46 was too greedy at ×150, 38 gives ×65), the
z11.4 ceiling where stacks give way to pins, and the 12-kind clusterable
set. What is NOT yet known is WHICH way it reads wrong on the Fold —
too eager, too shy, wrong break zoom — so nothing moves until Jacob says
which.
- **Ruled out:** tuning it blind on my own taste. The numbers already
  pass; the thing being tuned is how it FEELS at arm's length, and that
  is his measurement, not mine.

## A175 — Splash timing · CLOSED (field-confirmed take 158)
Lifting on the first idle frame is correct: "when it goes away,
everything is mostly loaded" (Jacob, 24586). No change.
- **Ruled out:** holding for full tile-settle — it would lengthen every
  cold start to fix a problem the field says does not exist.

## A176 — Overlapping pins at high zoom · SHIPPED take 160
Take 154 stacks only below z11.4; at 1000 ft pins still overlap (Jacob,
24596). Collision pass above the ceiling: group rendered pins within a
pin-width, hide all but the top-ranked, badge it xN, tap opens a
scrollable tray of the members.
- **Ruled out:** extending take 154's grid bucketing upward — its 76 px
  cell merges pins that are merely NEAR each other, and up here the only
  thing worth merging is pins that actually overlap.
- **Ruled out:** excluding food and fuel as take 154 does. That rule
  exists to stop mass grouping at statewide zoom; overlapping is
  overlapping, and the report is literally about coffee shops.
- **Ruled out:** reimplementing pin rendering in the stack source. The
  existing layers carry mode filters, prominence tiers and boosts; the
  collision pass hides by feature index and leaves all of that alone.

