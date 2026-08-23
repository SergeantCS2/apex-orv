# AGENDA

*Current as of take 88.* Ranked by blocking-ness, not by interest.

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

## A27 — The CSP engine is belt-and-braces, not a proven fix · OPEN

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

## A101 — SpecialRestrictionType is not ingested · OPEN, found take 81

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

## A103 — Water from TIGER when the OSM path is unavailable · PROPOSED take 83

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

## A108 — Should Geofabrik become a real fallback tier? · OPEN, raised take 84

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
