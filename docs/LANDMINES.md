# LANDMINES

*Current as of take 58.*

Numbered so they can be cited. Never renumber. Add, correct, or mark superseded —
but the number stays with the finding.

---

## §0 — Symptom index

Start here. Do not read top to bottom.

| What you're seeing | Landmine |
|---|---|
| Map renders in browser but not in the APK | 1 |
| Map works on wifi, blank in the field | 3, 4 |
| Locate button does nothing | 2 |
| Text missing everywhere on the map | 4 |
| Tracking stops when the screen turns off | 5, 6 |
| Camera resets when the phone is folded/unfolded | 7 |
| App freezes for seconds on startup | 8 |
| CI rebuilds tiles every single run | 9 |
| Can't commit or push the tile file | 10 |
| The same forest road is drawn two or three times | 11 |
| A trail exists on the map but not on the paper MVUM | 12, 13 |
| GPS dot wanders off the trail under trees | 14 |
| Trail is drawn but riding it is illegal for your machine | 15 |
| Imagery download is enormous / never finishes | 18 |
| Search finds nothing offline | 19 |
| 3D terrain is flat or black | 20 |
| Recorded track has gaps | 21 |
| An agency field exists but is empty everywhere | 23 |
| Router says "no route" when one obviously exists | 24 |
| Two junctions report the same name | 26 |
| Whole page dead, no console clue | 27 |
| Hillshade JPEG is enormous | 28 |
| Grades look far too gentle | 29 |
| Labels missing or showing gaps | 30 |
| A name renders with doubled brackets | 31 |
| Clean checkout cannot rebuild the data | 32 |
| A gate check stops running for no reason | 33 |
| Region downloaded but map has holes | 34 |
| CI builds an app you do not recognise | 35 |
| Works here, fails on a fresh clone | 36 |
| Right data, wrong place | 37 |
| Feature dead though its data verifies perfect | 38 |
| A verifier passes while the product fails | 39 |
| Build works in CI, dies locally — or vice versa | 40 |
| Haptics/GPS silently dead inside the APK | 41 |
| Bootstrap workflow cannot push workflows | 42 |
| Fresh repo shows failed runs before anything exists | 43 |
| First CI build works, every later one fails | 44 |
| Safety refusal believed but never observed | 45 |
| Bootstrap succeeds, build never starts | 46 |
| Data loads, style valid, screen blank | 47 |
| A metric that flatters a broken build | 48 |
| A detector that cries wolf | 49 |
| Two handlers, one gesture | 50 |
| Whole map blank, no error | 51 |
| Style expression silently invalid | 52 |
| A check that skips instead of failing | 53 |
| Test fails but the product is fine | 54 |
| Diagnostic reports a verdict, not evidence | 55 |
| Plugin returns a value, not a Promise | 56 |
| Redrawing an asset you already have | 57 |
| Simplifier silently returns nothing | 58 |
| Boundary data that is legally right and visually wrong | 59 |
| Flex/grid child refuses to scroll | 60 |
| One gesture, two meanings | 61 |
| Stub omits an API the app calls | 62 |
| Source has data but no layer draws it | 69 |
| Optional source down, whole build dead | 70 |
| Line labels vanish on a routing graph | 71 |
| Server returns fewer rows than it has | 72 |
| Fetched data silently unmapped | 73 |
| HTTP 200 with an empty body | 74 |
| www stale, version stamp current | 75 |
| Multi-use trail drawn as un-ridable | 76 |
| Checking for a hardcoded filename | 77 |
| Failure surfaces far from its cause | 78 |
| Permissive parser mistaken for a validator | 79 |
| Installer overwrites the workflow running it | 80 |
| Asset borrowed from the build machine | 81 |
| Import CI never installs | 82 |
| Dependency installed in the wrong job | 83 |
| Gate blocks the seed carrying its own fix | 84 |
| checkout lands on the triggering commit | 85 |
| Volunteer service on the critical path | 86 |
| Harness viewport is not the device | 87 |
| Styling contradicts legality | 88 |
| checkout takes the triggering commit | 85 |
| Unresolved workflow reference is empty, not an error | 78 |
| Rename works everywhere but the home screen | 63 |
| Told but not shown | 64 |
| Call sites written, definition never landed | 65 |
| A rate extrapolated from a sample too small | 66 |
| Downloaded detail thrown away before shipping | 67 |
| Stub omits an API the app calls | 62 |
| Source has data but no layer draws it | 69 |
| Optional source down, whole build dead | 70 |
| Line labels vanish on a routing graph | 71 |
| Server returns fewer rows than it has | 72 |
| Fetched data silently unmapped | 73 |
| HTTP 200 with an empty body | 74 |
| www stale, version stamp current | 75 |
| Multi-use trail drawn as un-ridable | 76 |
| Checking for a hardcoded filename | 77 |
| Failure surfaces far from its cause | 78 |
| Permissive parser mistaken for a validator | 79 |
| Installer overwrites the workflow running it | 80 |
| Asset borrowed from the build machine | 81 |
| Import CI never installs | 82 |
| Dependency installed in the wrong job | 83 |
| Gate blocks the seed carrying its own fix | 84 |
| checkout lands on the triggering commit | 85 |
| Volunteer service on the critical path | 86 |
| Harness viewport is not the device | 87 |
| Styling contradicts legality | 88 |
| checkout takes the triggering commit | 85 |
| Unresolved workflow reference is empty, not an error | 78 |
| Rename works everywhere but the home screen | 63 |
| Told but not shown | 64 |
| Call sites written, definition never landed | 65 |
| A rate extrapolated from a sample too small | 66 |
| Downloaded detail thrown away before shipping | 67 |
| One upstream 503 fails the build | 57 |

---

## §1 — Known-good references

If you need to do one of these, working code already exists. Copy it.

| Task | Reference |
|---|---|
| Compact geometry for inlining | `tools/pack.py` — RDP + delta-encoded ints, 56k→21.6k coords, 182 KB |
| Runtime remote-request guard | `www/index.html` — wraps `fetch` and `XHR`, NET badge |
| Instrumented perf test | `www/app.js` — fixed leg loop, p99 frame time, comparable across builds |
| Tile build from OSM | `.github/workflows/build.yml` — planetiler `--area` + `--bounds`, cached |
| Trail-first cartography | `www/style.json` — track heavy dashed, path orange, everything else quiet |

---

## Landmines

**1. Capacitor's local server and HTTP Range requests — UNKNOWN.**
PMTiles reads tiles as byte ranges from one file. Capacitor serves `www/` through
an internal server whose Range support is unverified. This blocks Phase 0.3 and
determines the storage format for the entire project. Fallback specced:
MBTiles + `@capacitor-community/sqlite` + a `maplibregl.addProtocol` handler,
which has no range reads at all. Do not spend three attempts guessing — see
PROTOCOL §5.

**2. Chrome blocks geolocation on `file://` and in some embedded frames — PROVEN,
take 2.** The standalone HTML's Locate button fails when opened from Downloads or
inside an app frame. This is not a bug in the app and it works in an APK. The
error copy says so, deliberately, so it doesn't read as broken.

**3. A single CDN reference silently voids the offline guarantee.** It passes
every test on wifi and fails only in the field. Mitigations: gate greps shipped
assets for remote origins; runtime `fetch`/`XHR` wrapper with a NET badge.
Both, because the failure is invisible until it matters.

**4. Offline map labels require vendored SDF glyph PBFs — SOLVED at take 9.**
MapLibre fetches glyph ranges from a `glyphs` URL with no default and no bundled
fallback; omit it and every text layer renders nothing, silently. `tools/glyphs.py`
generates the pack (SDF + hand-encoded protobuf, no dependency) and it is served
from a static `data:` URI. **Use ONE fontstack**: MapLibre only substitutes
`{fontstack}/{range}` when the placeholders are present, so a single stack can be
served from a static URI and needs no protocol handler.

**5. One UI battery optimization kills background work.** A plain WebView or PWA
will not keep recording with the screen off. Needs a genuine foreground service
with a persistent notification. INFERRED from Android behaviour generally;
PROVEN only once 1.5 is tested on the Fold.

**6. A wake lock is not a substitute for a foreground service.** Wake lock keeps
the CPU up; it does not exempt the process from being killed.

**7. Folding and unfolding is a configuration change.** Without
`android:configChanges` covering `screenLayout|smallestScreenSize|screenSize`,
the activity is destroyed and recreated — WebView reloads, camera state lost.
Persist camera state regardless; belt and braces. INFERRED.

**8. Large GeoJSON parses on the main thread before MapLibre tiles it.** The
take-2 build inlines ~2,760 features and is fine. At the full screenshot block it
was ~12,000 features, which is roughly where GeoJSON-in-a-variable stops being
viable and real tiles start earning their keep. PROVEN by feature count, not yet
by measured stall.

**9. GitHub Actions cache evicts after 7 days unused.** Tiles rebuild from
scratch (~10–12 min) after a quiet week. Not a failure, but budget for it, and
don't read a slow run as a regression.

**10. GitHub blocks files over 100 MB.** Statewide tiles cannot live in the repo.
They belong in Releases or built fresh in CI. This forces Phase 1.2 (tiles in app
storage) sooner than it looks.

**11. Duplication between agencies is asymmetric — SUPERSEDED by take 6.**
Measured, not assumed: USFS *trails* are 94.8% duplicated by DNR geometry, USFS
*roads* only 12.6%. Dropping "USFS data" wholesale loses 338 miles of forest road;
keeping it wholesale doubles every trail. The rule is per-class: drop duplicate
USFS trails, keep all USFS roads, merge the USFS trail id onto the DNR feature.
See `tools/conflate.py` for the measurement, `tools/graph.py` for the rule.

**12. The MVUM is the legal authority.** OSM being wrong, or onX being wrong, is
not a defense. Anything rendered as rideable must carry provenance (Phase 2.5) so
advisory lines can be styled differently from legal ones.

**13. Michigan layers two jurisdictions in the same riding area.** Bull Gap and
the Meadows are federal (Huron NF, USFS MVUM). Rose City, Ambrose Lake and Ogemaw
Hills are state (DNR-designated). The Pink Store sits near the seam. Any dataset
covering only one of them will look complete and be wrong.

**14. GPS under jack pine canopy wanders.** Do not treat the dot as ground truth
for "am I on the trail" or "am I on public land." Phase 4.2 snapping helps the
display; it does not improve the fix.

**15. Width class is the rule that gets you ticketed.** Michigan designates
motorcycle-only 24", ORV trail 50", ORV route 72". A line being on the map says
nothing about whether your machine is legal on it. Carry the attribute from
Phase 2.6 even though the rendering is deferred.

**16. Debug-signed APKs cannot be updated in place by a release-signed one.**
Decide the keystore before there's data on the device worth keeping. Phase 1.1.

**17. `planetiler --bounds` still downloads the whole regional extract.** The
bounds clip the output, not the input. First run is slow regardless of AOI size;
don't shrink the bbox expecting a faster first build.

**18. Satellite imagery is the size driver — MEASURED at take 10.** USGS
ImageryOnly over the 1,060 km2 AOI: z14 8 MB, z15 37 MB, **z16 159 MB**, and
statewide at z16 would be **36.6 GB**. So z16 (1.70 m/px, near NAIP native) is a
perfectly reasonable wifi download for one riding area and impossible for a state.
Per-region imagery is settled, permanently, and must be a separate opt-in from the
vector basemap.

Note the earlier estimate said ~200 MB for the AOI and never computed the
statewide figure — which is the one that actually decides the architecture.
Also: metres-per-pixel is `156543 * cos(lat) / 2^z`. Do not divide by tile size
as well; take 8 recorded z16 as 0.01 m/px, off by 256.

**19. Offline search needs its own index; the tiles cannot serve it.** Vector
tiles only contain what is in the current viewport at the current zoom, so you
cannot search them for a place you are not already looking at. A separate local
index (SQLite FTS or similar) has to be built in the pipeline and shipped
alongside. Do not discover this at Phase 5.

**20. MapLibre terrain needs a raster-DEM tileset, not a hillshade image.** The
3D terrain source consumes encoded elevation tiles (Terrarium or Mapbox RGB
encoding). A pre-rendered hillshade raster will render flat. These are two
different products from the same DEM and both may be wanted — hillshade for the
2D styles, encoded DEM for 3D and slope. INFERRED.

**21. Android will kill a recording process that looks idle.** A foreground
service is necessary but may not be sufficient on One UI; battery-optimization
exemption is a separate user-granted permission (ROADMAP 1.6). Any gap in a
recorded track is a safety failure, not a cosmetic one — the breadcrumb is what
gets you back out. Needs a visible "recording" indicator per PROTOCOL §9.

**22. NAIP is public domain; most other imagery is not.** Esri World Imagery,
Google, Bing and Mapbox satellite layers are licensed and not redistributable
into an offline bundle. NAIP (USDA) is the free path and covers Michigan. Do not
casually swap in a nicer-looking source without checking the licence.

**23. A published schema is not populated data.** The Michigan DNR trail layers
advertise `TrailTreadType`, `SpecialRestrictionType` and `SurfaceType`. In the AOI
the first two are null on 159/159 records and the third is "Dirt Natural" on
159/159 — no sand vs hardpack, the one distinction that matters in this terrain.
Meanwhile `TrailWidthFeet`, `OpenClosedStatusORV`, `LicenseType` and `TrailOnRoad`
are fully populated and immediately useful. PROVEN take 4.

**Query the values before planning a feature on a field.** A field name in a
schema listing tells you nothing about whether anyone filled it in.

**24. Snapping to the nearest node ignores what is legal there.** A 72"
side-by-side routing from a 50" trailhead snapped to a node whose only edges were
illegal for it, and every profile returned "no legal route" — wrong, and
confidently wrong, with a legal route 200 m away. Snap only to nodes carrying at
least one edge legal for the current machine, and disclose the off-network
distance to the pin. PROVEN take 6, caught by `tools/verify6.py` rather than by
looking at the map.

**Keep a headless verifier that mirrors the client cost functions.** Routing bugs
are invisible in a UI — a wrong route still draws as a confident blue line.

**25. A shell `&&` chain will skip your documentation silently.** The take-6 doc
write never ran because an earlier `cp` in the same chain failed. Nothing errored
visibly; the docs simply stayed at take 5. The gate caught it. Do not chain a doc
write behind anything that can fail, and never trust that a block ran because the
command returned.

**26. Junction descriptors are not unique.** Naming a junction by the ways that
meet there is verifiable, unlike an invented number (see A7) — but Ogemaw Hills
Route crosses Rose City Trail in several places, so the same descriptor recurs.
Of 3,706 named junctions, 3,332 have only two ways meeting, which is where
collisions concentrate. **The dispatch card must always lead with decimal degrees
and offer the junction as supporting detail**, never as the primary fix. PROVEN
take 7.

**27. A double-escaped quote in a patched string kills the entire script.** Take 7
briefly shipped `I\\'m here` inside a single-quoted JS literal; the string
terminated early and every line after it died. The page renders, the map never
appears, and nothing indicates why. Repeated string-patching of a template makes
this likely, so **extract the inline script and run `node --check` against stubs
before assembling** — it is now part of the build.

**28. Shade the blurred elevation, sample the raw one.** The first hillshade came
out 724 KB and could not be inlined. Resolution was not the cause: Terrarium
quantises to 1/256 m and resampled 3DEP carries stair-step noise, so shading it
raw produces high-frequency speckle that JPEG cannot compress. Blurring the
elevation before computing the shade fixed appearance and size together — 227 KB
at 850 px. Keep node sampling on the unblurred grid so distance and climb stay
honest. PROVEN take 8.

Related: **PIL cannot Gaussian-blur mode `F`.** Use numpy for anything DEM-shaped.

**29. Segment-averaged grade understates real steepness.** The steepest edge in
the network averages 3.4%, which is nothing like what Bull Gap feels like — a long
edge averages a short steep pitch away to nothing. Per-edge *climb* is correct and
verified; per-edge *grade* is not a safe number to show. Anything reporting
steepness must work from the stored profile, not from gain divided by length.
PROVEN take 8.

**30. Prove glyph coverage; there is no fallback font offline.** A character
absent from the pack renders as a gap with nothing in the console. `verify9.py`
collects every string the map can display — trail labels, place names, and the
full names the inspect card shows — and asserts each character is in the pack.
68 distinct characters for this AOI. Re-run it whenever label text changes.

Also verify the SDF itself: thresholding at 192 should reproduce the rendered
glyph mask. Take 9 measured 100.00% agreement. A silently wrong SDF gives blurry
or hollow text that looks like a styling problem.

**31. Data that is never rendered is never checked.** `short()` wrapped trailing
trail codes in parentheses without checking whether they already had them,
producing "The Meadows Motorcycle Trail ((TMM))" on 1,066 edges. It shipped in
takes 5 through 8 and was invisible until labels rendered it. **String tidying
applied to agency names needs a guard and a spot-check on the output**, not just
on the transform.

Related: a database name is not a sign name. Map labels want what is nailed to
the post — "TMM · H58-8" — not the full descriptive title.

**32. A pipeline with a hand step in the middle is not a pipeline.** `aoi.json`
was fetched by an ad-hoc curl at take 5, and takes 6 through 9 all read a file
that no tool produced. The pipeline-provenance gate passed throughout because the
*file* existed and the tools existed — nothing checked that the tools could
actually produce the files. Caught at take 10 only because the provisioning
manifest listed a declared host that nothing reached. **A declared-but-unused
source is a signal, not noise.**

**33. Two gate checks with the same function name: one runs twice, one never
runs.** Take 10 added `check_provision` under the name `check_manifest`, which
already existed for the Android manifest. Python bound the later definition, both
entries in the call tuple resolved to it, and the Android check silently stopped
running. The only visible symptom was a duplicated "ok" line in the output.
**Read the gate's own output for repeats**, and keep check names distinct.

**34. A half-downloaded region is a safety problem, not a UX problem.** A map
with holes is worse than no map, because you trust it. Every bundle artifact
declares whether it is REQUIRED, giving three states: *complete*, *partial*
(required present, optional absent — navigable, and the app must name what is
missing), and *unusable* (required absent or corrupt — refuse the region
outright). Never present a partial region as if it were whole, and never silently
drop a layer. `tools/bundle.py` enforces this; the manifest carries SHA-256 per
artifact plus a bundle hash over those hashes, so an edited manifest cannot be
made to match a corrupted file.

**35. "The file exists" is not "the file is current."** For seven takes `www/`
held the take-2 spike while the real app lived only in standalone HTML. CI was
still wired to planetiler and PMTiles and would have produced an APK of the
spike. Every gate check passed, because every check asked whether things existed
and none asked whether they were current.

Two fixes, both mechanical: **one source** (`src/app.html`, with `build_app.py`
emitting every output from it) and a **currency check** — the app source must name
the take in `BUILD`, and generated output must have the shape the current app has.

Generalise it: any check of the form "X is present" should be paired with one of
the form "X is the X we mean." Presence is cheap to satisfy accidentally.

**36. Writing a landmine down does not prevent it — only a clean run does.**
Landmine 32 was recorded at take 10. Takes 11 and 12 then added three more hand
steps (a reverted fetch, an uncommitted hillshade trim, an unwritten water step)
and nothing failed, because the artifacts from earlier runs were still sitting on
disk. Take 13 ran the pipeline from a checkout of committed files only and it
broke four times in a row.

**Rule: any take that adds or changes a pipeline step is followed by a clean run
before it ships.** Copy the committed files to an empty directory, run
`tools/pipeline.py`, then gate. Nothing else finds this class of bug.

Corollary — **a declared-but-unreached source is a failing condition, not a
note.** Provisioning hosts fell from 6 to 5 between takes 11 and 12; the gate
printed it both times and it was read past. That single number was the whole
fingerprint of a vanished pipeline step. The gate now fails on it.

**37. A correct hash does not mean correct data.** Take 14 built a St. Helen
bundle containing Bull Gap's graph. Every SHA-256 matched, every size matched,
the manifest named the right region — and the map was 40 km away. Integrity
checks answer "is this file intact", never "is this file the one we meant".

**Check the content against its own declaration.** `bundle.py verify` decodes the
graph and asserts the nodes fall inside the manifest bbox; on the bad bundle it
named 7,179 of 9,285 nodes outside it. Any artifact carrying a claim about the
world should be checked against that claim, not just against a checksum.

The upstream cause was ordinary: derived artifacts live in the working directory
with no region in their names, and a step fell back to whatever the last run
left there. `ensure_workspace()` now clears everything derived when the selected
region changes.

**38. In one accreted file, definition order is load-bearing and hoisting hides
the breakage.** Fourteen takes of string-patching one `<script>` produced two
silent wiring failures: a block defined below its first use (labels — every
reference hoisted to `undefined`, takes 9-14) and a variable/function name
collision (`mi` index vs `mi()` distance — the assignment overwrote the hoisted
function, takes 7-15). Neither is a syntax error; both are invisible to
`node --check`. When patching by string surgery, grep the whole file for the
name you introduce, and keep definitions above the constructor cluster.

**39. A mirror verifier proves the algorithm, never the wiring.** verify6-11
re-implement the maths in Python and all passed while the shipped JS called a
number as a function. The artifact you ship must itself be executed —
`tools/smoke.mjs` stubs the browser and drives `www/app.js` end to end, and the
gate refuses to pass without it. Corollary for the record: any handoff claim of
"verified" made before take 15 was a claim about the mirror.

**40. A JRE is not a JDK, and a runner is not a container.** The first Gradle
run died on `Toolchain does not provide JAVA_COMPILER` — `java` existed,
`javac` did not. ubuntu-latest preinstalls the Android SDK and a full JDK; a
bare container has neither. The apk workflow had "worked" for fourteen takes
only because it had never run anywhere. **Prove a build in an environment you
control before trusting the YAML**, and have CI call the identical tool
(`tools/android.py`) rather than its own copy of the steps — the gate enforces
that the workflow still does.

**41. Android's WebView silently lacks `navigator.vibrate`, and geolocation
needs manifest + runtime permission.** The off-route haptic (4.4) would have
shipped dead. Bridge through Capacitor Haptics/Geolocation when present, keep
the browser paths as fallback — and keep the simulator: it is both the file://
fallback and the smoke harness's test double for the identical recording chain.

**42. GITHUB_TOKEN cannot push workflow files.** A bootstrap Action can commit
the whole repo except `.github/workflows/`. So the seed zip excludes them, and
the two workflows are exactly the two files created by hand. Do not spend an
evening designing a one-paste bootstrap; the platform forbids it.

**43. A pasted workflow triggers on its own paste.** With a bare `on: push`,
creating `build.yml` runs it immediately — against a repo containing only a
README — and again for the second paste. Two red ✗ before the user has done
anything wrong. Path-filter the push trigger to the files the seed actually
delivers, keep `workflow_dispatch` for manual runs, and let the seed commit be
the first run. The first thing a new user sees must not be failure.

**44. A cache-hit is a second code path — execute it too.** The bundle job
skipped the whole pipeline when the artifact cache hit, leaving `bundles/` and
`www/bundle` unbuilt; the very next step's `cp` then failed. So the *first*
build works and **every subsequent build dies**, which is the cruelest possible
ordering for a new user. Caches must make steps *fast*, never *absent*: run the
pipeline unconditionally and cache its inputs (`dem_cache/`, `img_cache/`,
`aoi.json`) so the warm path is ~13 s. And per landmine 39: the broken path was
proven by simulating the cache-hit checkout and running it, then the fix was
proven the same way.

**45. A refusal that has never fired is a hope, not a safety property.** The
unusable-region fatal screen — the entire point of landmine 34 — shipped for
eight takes without ever being executed. `smoke.mjs --fatal-drill` now strips
the required artifact from a copied bundle and asserts the app refuses: screen
shown, missing artifact named, principle stated, **map not constructed**, no
network. Every refusal, fallback, and guard in a safety tool needs its drill;
the happy path proves nothing about the day the bundle is broken.

**46. A push made with GITHUB_TOKEN does not trigger other workflows.** GitHub
blocks it deliberately to prevent recursive runs. The bootstrap seeded the repo
perfectly — gate green, 38 files committed, push clean — and then nothing
happened, because the `on: push` build cannot see a token-authored commit.

Nineteen takes of local verification could not have caught this: every check
ran against files and YAML, and this is a rule of GitHub's event system, not a
property of any artifact. **The platform's own semantics need a real run to
learn.**

Fix: the seeder dispatches the build explicitly —
`gh workflow run build.yml` — because `workflow_dispatch` and
`repository_dispatch` are the two documented exceptions to the rule. Keeping
`workflow_dispatch:` on build.yml (added at take 17 for manual runs) is what
made the live recovery a single tap.

**47. The harness stubs the renderer, so renderer failures are invisible to it.**
Take 19 passed 25 assertions, three smoke modes, two full audits — and drew
nothing on the Fold. Every source was declared *and correctly populated*;
the style was valid; the load event fired. What failed was MapLibre's `blob:`
worker under Android WebView, and a stubbed `maplibregl` can never see that.
Split the difference: assert the contract the harness *can* see (sources carry
real geometry, the CSP engine and worker URL are wired) and make the **app
self-check at runtime** — if sources hold features and `queryRenderedFeatures()`
returns 0, say **RENDER FAIL** on screen and name the engine error. A blank map
must never be silent.

**48. A metric measured over a broken build will flatter it.** The pan test
reported *"PASS · 121 fps · 16352 edges rendered"* on a blank screen: the frame
rate was real but meaningless, and the edge count came from `EDGES.length` —
what was loaded, never what drew. **An instrument that reads its input from the
same variable the feature does is not measuring the feature.** Count the output:
`queryRenderedFeatures()`, and fail on zero.

**49. A detector must be slower to accuse than the failure is to appear.**
The RENDER FAIL check read `queryRenderedFeatures()` once, 1.5 s after load —
but that call is legitimately empty while tiles are still being built, so a
healthy map could be condemned. Three zero readings over ~7 s, driven by `idle`,
with any non-zero reading settling it for good. A safety indicator that fires
falsely gets ignored, and an ignored indicator is worse than none.

**50. Two handlers on one gesture means the later one wins silently.** Planning
mode added a second `map.on('click')` beside the identify handler; both ran on
every tap and the trail card was overwritten before it could be read. Nothing
errored. Before adding a listener, grep for existing listeners on that event —
and check whether the feature already exists (it did: arm-a-pin).

**Corollary — a stub must honour every contract behind a name.**
`queryRenderedFeatures()` with no arguments is a viewport census;
`queryRenderedFeatures(box, opts)` is a hit test. One stub answering both made
open ground look like a trail, and the harness produced a failure the app did
not have.

**51. MapLibre rejects the WHOLE style if any part fails validation.** Not the
offending layer — the entire style, all 24 layers, silently unless something is
listening on `map.on('error')`. From take 9 to take 22 this app drew nothing
while `node --check`, five smoke modes and two audits reported green, because
`smoke.mjs` stubs `maplibregl` and a stub cannot validate a style. **Render the
app in a real engine before shipping it** — `tools/render.mjs` does, and it is
now a gate check. Corollary: fixing one validation error only reveals the next,
so iterate until a real browser draws real pixels.

**52. `glyphs` must be a template, and only one zoom interpolate per
expression.** The two concrete violations: a bare `data:` URI for `glyphs`
(needs `{fontstack}`/`{range}` — serve the pack via `addProtocol` to stay
offline), and `['case', cond, w(...), w(...)]` for `text-size`, which nests two
zoom-based interpolates. Keep the zoom curve outermost and branch inside it
(`wCase`).

**Corollary — a broken instrument accuses as confidently as a broken product.**
Wrapping MapLibre's constructor to catch early errors *broke the map* and
produced a fabricated diagnosis; reading the canvas with `drawImage` always
returns black under `preserveDrawingBuffer:false` and reported a blank map that
had not been proven either way. Observe, never intercept; and screenshot the
composited page rather than the canvas.

**53. A check that skips is not a check.** `check_render` noted "chrome absent,
render skipped" and passed — in CI, where Chrome was never installed. The one
test that could catch a blank map was structurally unable to run in the only
place that mattered, and it said so politely each time. **A verification that
cannot run in CI must fail there, not shrug.** The gate now fails when `$CI` is
set and no browser exists, and the workflow installs one.

Two more of the same family found in the same audit: `tools/render.mjs` could
not run from the seed at all (puppeteer was never a declared dependency, and
`android.py` overwrote `package.json` from a template), and `single()` inlined
gitignored `mlg.js` — so the browser build from a clean seed would have had no
map engine. **Anything that only works in the author's container is not
shipped.**

**54. When a check fails, verify the check before believing it.** Four times in
two days a broken instrument accused a working product: wrapping MapLibre's
constructor killed the map and produced a confident wrong diagnosis; `drawImage`
on a `preserveDrawingBuffer:false` canvas always returns black and reported a
blank map; a stub answering both `queryRenderedFeatures` contracts made open
ground look like a trail; and a zoom assertion aimed at the region's bbox centre
— farm roads, no moto trail — reported "0 trail segments" on a perfect map.

A red result is a hypothesis about the product **or** the test. Reproduce it a
second way before acting: query a different location, read the pixels by another
path, observe instead of intercept. The corollary of landmine 39, and it costs
far more time when ignored.

**Corollary — stale build artifacts are a hazard, not an archive.** Nine
installable APKs accumulated in outputs, most with a blank map. The repo is the
history; ship exactly one of each thing.

**55. A diagnostic must report what it observed, not just pass/fail.** The first
self-test run returned "profiles 0/5" — true, useless. With the observation
attached it read "0/5 · cost is not a function", which named the bug instantly.
Every check records the number it measured, the value it compared against, and
the exception text if it threw.

Two corollaries found in the same hour: **a lazily-built structure reads as empty
until something builds it** (`IDX` reported 0 entries while search returned 9
hits), and **a threshold is only valid on the hardware it was calibrated for**
(the fps check asserted ≥30 against headless Chrome's software rasteriser, which
manages single digits — it now reports without judging unless the GL renderer is
real).

**56. Never assume a plugin's return shape.** `Capacitor.Plugins.Geolocation.watchPosition`
returns the watch id **synchronously** in Capacitor 7, not a Promise. Calling
`.then()` on it threw, took `gpsStart()` down with it, and killed the ▶ Ride it
handler on the device — while the watch itself ran fine in the background, so a
fix still arrived and every other GPS check passed. A stubbed harness cannot see
this: the stub returns whatever the author imagined. Accept both shapes
(`typeof x.then === 'function' ? x.then(...) : use(x)`) and wrap plugin calls in
try/catch, because the failure lands in an unrelated feature.

**Corollary — "correct behaviour" must not be scored as failure.** A check
asserting `inRegion(fix)` failed when the rider was legitimately 135 mi away,
with a detail line that literally said "planning mode is correct". Assert the
system's *response* to a condition, never the condition itself.

**68. Retry every network read, not just the one that bit you.** Take 14 added
backoff to Overpass after a 429 and stopped there. Take 29 hit a plain 503 from
a state ArcGIS endpoint and the whole pipeline died — which in CI is a red build
for an upstream hiccup nobody controls. Agency servers are not more reliable
than the volunteer one; they just had not failed yet.

**Corollary — verify on leftovers reads as success.** After that failed run,
`bundle.py verify` reported COMPLETE against bundle files from an earlier build,
because ingest died before anything was regenerated. A green verdict means
nothing unless the thing it describes was actually produced by the run you are
judging.

**57. Do not reconstruct an asset you already possess.** The APEX mark was
hand-plotted from polygons twice, across two takes, and rejected both times —
while a pixel-perfect copy sat in the uploads folder the whole while. Source
artwork belongs in the repo as artwork; the tool's job is to derive densities
from it, not to imitate it.

The "generate everything, commit no binaries" rule is about **outputs**, not
**inputs**. A logo, a font, a keystore are inputs. Cleaning a supplied raster is
real work — colour-snap to the brand palette so compression haloes cannot
survive scaling, mask to the tile to drop registration marks, and drop small
connected components, because JPEG debris becomes visible the moment the art is
lifted onto transparency for an adaptive icon.

**58. RDP on a closed ring silently discards the whole shape.** When the first
and last points coincide, the baseline a->b has zero length; the perpendicular
distance formula then evaluates to exactly zero for every interior point, so
nothing exceeds the tolerance and the simplifier returns just the two endpoints.
No exception, no warning — a state outline became a two-point line. Split closed
rings at their farthest point and simplify each half as an open polyline.

**Corollary — a test harness must honour timing.** `flushTimeouts()` ran every
pending timer irrespective of its delay, firing a 25-second give-up timer inside
a four-frame idle loop and releasing the GPS receiver before the test could use
it. Fake clocks should still respect the clock.

**59. A state's legal boundary is not its coastline.** Michigan's TIGER boundary
extends far into the Great Lakes, so drawing it produced a shape nobody
recognised — geometrically correct, cartographically useless. Census
**cartographic** files (`cb_*`) are clipped to the shoreline and are what a
person means by "the outline of Michigan". Fill the land rather than stroking
the border: the land/water contrast is what makes a familiar shape legible.

**Corollary — a stub that omits an API silently omits the feature.** The
harness's `Marker` had no `getElement()`, so pin-tap listeners (guarded by
try/catch) registered nowhere and the entire tap interaction was invisible to
five green smoke modes.

**60. A grid or flex child will not scroll: `min-width:auto` is the default.**
The route strip had `overflow-x:auto` and still could not scroll, because its
grid ancestor refused to shrink below its content and grew to 788 px on a 411 px
screen. Nothing overflowed, so nothing scrolled, and the 4th and 5th options
were unreachable rather than merely off-screen. `#shell>*{min-width:0}`.

Measure it rather than eyeball it: `scrollWidth > clientWidth` is the test for
"can this actually scroll", and it was false.

**Corollary — do not rebuild a scrollable list to change a selection.**
Re-rendering the strip reset `scrollLeft` to zero on every tap, which reads as
"scrolling is broken" even after scrolling works. Toggle the class in place.

**Corollary — when options overlap, show the alternatives.** Five routes down
one corridor look identical shown one at a time; the user reported the line "not
updating" when it was updating perfectly. Draw the others dimmed underneath, and
stop re-framing the map on reselect — a refit hides the change it was meant to
reveal.

**61. A gesture can only mean one thing.** Tap both identified a trail and, on
empty ground, dropped a pin — so a pin could never be placed *on* a trail, and
users could not predict which would happen. Separate them: tap identifies, long
press pins. Implement the long press rather than relying on `contextmenu`, which
is inconsistent in a WebView; 450 ms with a 12 px move tolerance, and buzz on
fire because an invisible gesture with no feedback reads as broken.

**Corollary — an object consumed by an action must stop existing.** A dropped
pin used as "start from here" stayed on the map under the new start marker, so
the next pin looked like it had erased the first. Remove it, and say which
marker now holds the spot.

**Corollary — `getCanvasContainer()` has zero height.** It wraps
absolutely-positioned children. Measure `getContainer()`, which is also what
`unproject()` is defined against. A press point computed from the zero-height
rect lands at the top of the screen, and the resulting "the gesture is dead"
diagnosis is the test's fault, not the app's.


**62. Check the stubs against the app, statically.** Six separate times a stub
lacked a method the shipped app calls — twice hiding a working feature, four
times inventing a failure that did not exist — and every one surfaced only when
a person tapped a phone. Parse `www/app.js` for the API surface it uses and
assert the harness implements it. `check_stubs()` found eight real gaps on its
first run, all in a code path smoke could not previously execute.

**Corollary — assert what the harness CAN judge, and say so.** With the gaps
filled, smoke runs the app's own self-test; under a stub there is no renderer,
so render and perf failures are expected and isolated by group rather than
faked with plausible numbers.

**Corollary — layout bugs need a real viewport, so check them on the device.**
Scroll, overflow, tap-target size and off-screen controls are invisible to a
headless stub and to a desktop browser at the wrong size. Put them in the
on-device self-test, and prove each one by reinjecting the defect it was written
for.

**63. `cap sync` does not rewrite `strings.xml`.** Capacitor generates
`android/app/src/main/res/values/strings.xml` when the platform is first added
and never touches it again. Renaming the app in `capacitor.config.json` updates
the config, the release title and every in-app label — and leaves the launcher
name stale, which is the only place the user reads it. Patch `app_name` and
`title_activity_name` explicitly and idempotently in `tools/android.py`.

**Corollary — do not rename the signing certificate.** The cert DN is baked into
every installed build. Changing it matters only on regeneration, and regenerating
the keystore breaks update continuity outright. Leave it, and say why in a
comment, or someone will tidy it.

**64. If the app states a distance, it must draw it.** The route cards described
"+0.5 mi off-network to the pins" for many takes while the line began at the
nearest graph node, so a route to a pin off the trail looked disconnected and
broken. Text is not a substitute for geometry: draw the approach legs, dashed,
and include them in the bounds fit.

**Corollary — a diagnostic must not drop its findings on failure.** The GPS
section reported "no fix in 20s" and omitted `startup-locate`, `position` and
`mode-correct` entirely, because those lines lived inside the success branch —
so the run that most needed explaining carried the least information. Report
state from what the app already knows, independently of whether this particular
measurement succeeded.

**Corollary — padding must clear floating UI.** `fitBounds` used a flat 40 px
while a chip strip floats over the bottom of the map, hiding the end of every
fitted route. Measure the overlay.

**65. A string replacement that does not match fails silently.** Three call
sites for `presentRoutes()` were written and the function definition never
landed, because the patch anchoring it no-matched against text that had already
been edited. `node --check` passed — a call to an undefined function is valid
syntax. The failure appeared only on the first tap, as
`presentRoutes is not defined`.

**Assert the anchor, and grep after the edit.** `assert old in s` turns a silent
no-match into a stop, and `grep -c "function X"` after writing proves the thing
exists. The second attempt then ate the `},30)}` closing the enclosing function,
which is the other half of the same lesson: when surgery on an accreted file
goes wrong, re-read the region rather than patching the patch.

**66. Do not quote a rate from a sample that cannot support one.** Android
reports battery level in **1% steps**, so a ten-minute ride shows 0% or 1% and
extrapolates to anything from "two hours" to "forever" — the first version
confidently printed *"37 hours from full"*. Require a real sample (20 minutes,
2% moved) before quoting, and when the sample is too small say so explicitly
rather than omitting the line: a missing number invites the reader to assume the
measurement failed, when in fact it was refused on purpose.

Sample rates should match what is being measured — battery every 60 s, the
GPS-dropout watch every 20 s. Polling both at the fast rate wastes power on a
device whose power draw is the thing under test.

**67. Do not downsample what you already paid to download.** The imagery
pipeline fetched native z14 tiles and then squashed the entire AOI into one
1500 px JPEG — 22.1 m/px, where the feature being navigated is one metre wide.
The bandwidth had already been spent; only the resolution was discarded, to keep
a single-file artifact small.

**A single image source has a hard ceiling: max texture size.** A z15 mosaic of
this AOI is 9728 px against 8192 px on the device, so tiles are not an
optimisation, they are the only route past z14. Tiles also bound *memory* rather
than disk — only visible tiles are decoded — which is what makes 45 MB of
imagery affordable on a phone.

**Measure the ground resolution and put it in the report.** "Looks bad" is an
opinion; "22.1 m/px for a 1 m trail" is a decision.

**69. A source with no layer is invisible data.** `alt` (dimmed alternates,
take 35) and `approach` (dashed off-network legs, take 39) were both created,
fed correct geometry, and **never drawn** — the patches adding their layers
anchored on `'route-line'` when the real id is `'routeline'`, so they silently
no-matched. Every check written for them measured `setData`, which is the DATA,
not the DRAWING. Two shipped features were invisible for eight takes, and one of
them was itself the "fix" for a user-reported bug.

`check_orphan_sources()` now fails the gate on any source no layer references,
and on any layer naming a source that does not exist. `render.mjs` asserts
`queryRenderedFeatures` per layer, because only a real engine can answer "did it
draw". Negative-controlled both directions.

**70. An optional dependency's outage must not kill the build.** A clean run died
on an Overpass 503 and stopped the whole pipeline — after the DNR and USFS data
had already been fetched successfully. OSM supplies the optional water layer, so
its absence must degrade to a PARTIAL bundle. It also supplies the ROAD network,
which is not optional: without roads Return Home cannot reach a town, so that
case refuses with a clear message instead of shipping a bundle that cannot get
you back. Distinguish the two rather than treating a whole source as all-or-nothing.

Same run: `render.mjs` died at import because a clean checkout has no
`node_modules`. It now says "run `npm ci` first" and skips, since CI installs it
and the gate fails there if a browser is absent.

**71. Line labels need lines, and a routing graph has none.** A graph split for
routing has short edges — median 76 m here, 76% under the symbol spacing — and if
each edge is its own feature, MapLibre has nothing long enough to place a name
on. Chain consecutive edges sharing a label into maximal strokes and label
those; keep the edges for routing and rendering.

**`text-max-angle` is a silent label killer.** At 32 degrees this network placed
**zero** trail names while every edge carried one in the data. ORV trails bend
more than that inside the width of a word. Sweep the parameter against real
geometry rather than picking a value that sounds tidy: 32→0, 60→3, 85→5.

**Corollary — label placement is asynchronous.** Jumping the map and querying
`queryRenderedFeatures` in the same tick returns zero on a map that shows eight a
moment later. A synchronous self-test cannot see placement at all; the check has
to live in the async chain.

**72. Ask the server how many there should be.** The DNR FeatureServer returns
fewer features than the MapServer for an identical query — 36 withheld in this
region, six of them ORV trails — while `returnCountOnly` reports the full total
from both. Nothing errored; the payload was simply short, for forty takes.

Any bulk fetch that a map depends on should compare what arrived against what the
source says exists, and say so loudly when they differ. A silent shortfall is
indistinguishable from an area genuinely having fewer trails.

**73. Fetching data is not ingesting it.** Overpass was asked for
`path|bridleway|cycleway|raceway` and `graph.py`'s class map had an entry for
none of them, so they were downloaded, parsed, and dropped without a word. Check
that every value a query can return has somewhere to go — and prefer an
invariant over a second list.

**Corollary — enforce safety on the built artifact, not the source.** "Non-ORV
routes must never be routable" implemented as two hand-maintained sets is one
forgotten edit away from routing a dirt bike onto a footpath. The gate now
compares the classes in the built graph against the machines' allow-lists, so
the check cannot drift from the thing it protects.

**74. A 200 is not data.** `overpass.osm.ch` answers HTTP 200 with an EMPTY
result set. `fetch_osm` wrote that as success, and `graph.py` guarded on
`os.path.exists("aoi.json")` — the file existed, so the refusal never fired and a
clean run built **3,621 edges instead of 20,133**: trails only, no roads at all,
Return Home unable to reach a town, and nothing said a word.

Existence is not content. Check the payload against what it must contain — this
bbox provably holds thousands of ways — and treat empty as a failure worth
falling through to the next mirror for. Fixed in both places, because a
safety-relevant path deserves two guards, and found only because PROTOCOL §6b
demands a clean run after a pipeline change.

**75. The version stamp lives in the built artifact, not the source.** Take 45
bumped `BUILD` and `src/app.html`, then packaged an APK that said **Take 44
inside** — `www/` had been rebuilt before the bump and `cap sync` copied it
verbatim. The gate compared `src/` to `BUILD` and passed it.

`www/` is what ships. Compare the built output's stamp to `BUILD`, and read it
from `www/index.html` where `build_app` writes the title — checking `www/app.js`
matches "Take 14" from a landmine comment and reports a stale build on a current
tree (landmine 54, again).

**76. The same trail appears in every layer it is designated for.** "LP 9" is
published by the DNR as a motorcycle trail, a hiking trail and an equestrian
trail — three rows, one physical trail. Ingesting each use layer separately and
drawing them all put a grey "not ridable" line on top of a trail that IS ridable,
which tells a rider to stay off something they are allowed on. Worse than
omitting it.

When the same geometry carries both a ridable and a non-ridable designation, the
**ridable one wins** and the duplicate is dropped. Match on endpoints at 1e-4 and
compare against the routing network AFTER conflation, not against the raw ingest.

**Corollary — reconcile against the source's own totals.** The DNR publishes a
master layer with per-use flags; the USFS publishes per-vehicle legality. Both
give a number to check against, and "199 = 199" is worth more than any amount of
confidence that the ingest looks right.

**77. Check for the ROLE, not the filename.** The gate read
`.github/workflows/build.yml` by name. When the installer was merged into a
single `apex.yml`, three checks failed on a correct repo — and they would have
failed on the user's very first run, in the one moment when a confusing error is
most expensive. It reads every `*.yml` in the workflows directory now.

**Corollary — a constraint does not imply the workaround you first reach for.**
`GITHUB_TOKEN` cannot write `.github/workflows`, so I had the user paste two
workflow files and cut a release. The installer never needed to *write* the
build; it only needed to *be* it. One paste, one zip, one button.

**Corollary — simulate the first-run path against an empty directory.** Every
other test here runs against a populated tree. Running the seed job's own script
against a folder containing nothing but the zip found the failure in seconds.

**78. GitHub substitutes an empty string for an unresolved step reference.**
`${{ steps.pkg.outputs.apk }}` with no step declaring `id: pkg` does not fail the
workflow — it evaluates to nothing. `upload-artifact` receives no path and
`gh release create` receives no asset, so a release publishes with **no APK
attached** and the log reads as success.

This is an orphan reference, the same shape as a source with no layer (landmine
69) and a call site with no definition (landmine 65). `check_workflow_refs()`
now requires every `steps.X.outputs.Y` to have a step with `id: X`.

**Corollary — preserve everything between `name:` and `jobs:`.** Generating a
merged workflow by slicing at `jobs:` dropped the top-level `env:` block, leaving
`$APEX_REGION` empty and the bundle job dying on `cp bundles//manifest.json`.
Assert that no top-level key was lost rather than trusting the slice.

**Corollary — do not check what you cannot know.** The first version of this
check also demanded that the step write the output to `$GITHUB_OUTPUT`. Third-
party actions declare their own outputs; `deploy-pages` emits `page_url` and
nothing writes it. A check that cannot be right for a valid input is worse than
no check.

**78. Fail where the user can act, not where the code happens to break.** An
empty repo produced a Node stack trace from `npm ci` — accurate, and useless:
the real fault was four steps earlier, in a different language, and amounted to
"you uploaded the wrong file". Check preconditions at the top of the job, print
what IS there, and name the fix.

**Corollary — make the reasonable wrong choice work.** Given `apex-seed.zip` and
`apex-orv-github-repo.zip`, a user reaching for the one whose name says "repo" is
being sensible. The seed accepts either and flattens the nested shape rather than
silently doing nothing.

**Corollary — a workflow pasted by hand can be stale.** The copy in the repo was
correct and the copy pasted into GitHub was three versions old, reintroducing a
fixed bug. When handing someone a file to paste, hand them the file — and when
they report an error, check WHICH version they are running before debugging the
one in front of you.

**79. A permissive parser is not a validator.** PyYAML's `safe_load` keeps the
LAST of duplicate keys and returns a clean dict. `build.yml` carried two
`concurrency:` blocks from take 20 to take 50 and passed every gate run, while
GitHub rejects such a file outright as *"Invalid workflow file"* — so CI had
never been valid and could never have run.

Validate against the CONSUMER's rules, not the parser's tolerance. The gate now
loads every workflow with a constructor that raises on duplicate keys.

**Corollary — generate the derived copy, do not splice it.** `apex.yml` is
`build.yml` plus one job. Hand-splicing produced a file with the build header
duplicated and the seed job nested under the wrong `jobs:` key. `tools/mkapex.py`
takes the header verbatim, injects the job, asserts the resulting job list and
`needs`, and strict-validates before writing.

**Corollary — untested by the real consumer is untested.** Everything about this
workflow was verified locally. The single check that mattered was letting GitHub
parse it, and that only happened when Jacob pasted it in.

**80. An installer must not write the workflow that is running it.** The seed job
unpacked a zip containing `.github/workflows/` and tried to push it. GitHub
refuses: `GITHUB_TOKEN` has no `workflows` permission (landmine 46, which I had
already recorded and then designed around incorrectly). Everything else
succeeded, so the failure landed on the very last line after ten minutes.

Delete `.github/` from anything an automated seeder unpacks. Whatever the user
pasted is theirs.

**Corollary — keep the canonical build definition outside `.github/workflows`.**
It lives in `ci/build.yml`, which GitHub ignores; `tools/mkapex.py` generates the
executable copy. Shipping both would also have run the entire build twice on
every push, since the generated file contains every job the original has.

**Corollary — anything that scans "the workflows" must scan both places.** Moving
the source to `ci/` made a declared provisioning host look unreached until
`scan_hosts()` learned about it.

**81. If the build needs it, vendor it.** `glyphs.py` loaded its typeface from
`/mnt/skills/.../NationalPark-Bold.ttf`, a path that existed only in my sandbox.
The pipeline passed here every single time and died six steps into the first real
CI run with `OSError: cannot open resource`.

A typeface is a source asset, exactly like the logo (landmine 57) and the
keystore. Vendor it; do not borrow whatever the machine happens to have
installed, and do not apt-get it either — a font package version bump would
silently change every label on the map.

`check_absolute_paths()` fails the gate on any tool referencing `/mnt`, `/home`,
`/opt`, `/usr` or `/Users`. This is landmine 32 restated for the third time:
emit_graph's `/home/claude/pack.py`, glyphs' font, and every future one.

**Corollary — the first machine that is not yours finds these instantly.** Four
minutes of CI found two hand-dependencies that fifty takes of local verification
could not, because every local check ran on the machine that had them.

**82. A missing dependency can make a check disappear rather than fail.**
`gate.py` imports `yaml` inside a `try/except ImportError` that downgrades to a
note. CI installed `pillow numpy scipy` and not `pyyaml` — so on the runner the
workflow validator would have quietly done nothing, on the one machine where a
workflow actually gets parsed. Green, and empty.

Guard the dependency list itself: walk every `import` in the tools, subtract the
standard library and local modules, and fail if the workflow does not install the
remainder. A soft-fail on an absent import is fine only if something else
guarantees the import is present.

**Corollary — after the second environment fault, stop fixing them one at a
time.** A font from my sandbox, a module path from my sandbox, a package that was
already installed here. Same shape three times: the build depended on my machine
in a way invisible from inside it. Enumerate the whole class — paths, packages,
assets — and gate each.

**83. Every CI job is a fresh runner.** `pip install` in the bundle job does
nothing for the apk job. The apk job called `android.py`, which imports
`icon.py`, which imports `PIL` — and installed no Python packages at all.

Worse: the check written one take earlier to prevent exactly this searched the
whole workflow file, found `pillow` in another job's install line, and passed.
**Scope the check the way the platform scopes the resource.** Per job, and
resolve imports transitively through local modules — `android.py` never mentions
PIL, so a direct-import scan finds nothing.

**Corollary — a check that passes for the wrong reason is worse than no check.**
It converts "I should verify this" into "this is verified", and the second is
much harder to revisit.

**84. Do not gate a delivery mechanism against something it cannot deliver.**
`gate.py` validated `.github/workflows/*`, the seed job ran `gate.py` before
committing, and the seed job cannot write workflow files (landmine 46). A
workflow one version behind therefore failed the gate, which failed the seed,
which was carrying the newer workflow. Deadlock, with the fix on the wrong side.

Two fixes, both needed. `APEX_GATE_SEED=1` narrows the seed-time gate to the
seed's own contents. And — more durably — **anything that changes often must live
where the delivery mechanism can reach it**: the workflow is now a thin shim and
every volatile step moved to `ci/*.sh` inside the repo.

**Corollary — when you move logic, move every check that reads it.** Three checks
grepped the workflow YAML for commands that had just moved into shell scripts,
and all three reported the commands missing. A check anchored on a location is a
check that breaks when the location changes.

**85. `actions/checkout` takes the commit that triggered the run.** Not the
branch tip. A job that pushes (the seed) and a job downstream of it that checks
out bare will land on the tree from *before* the push — `bash: ci/bundle.sh: No
such file or directory`, on a file that is definitely in the repo. Pin
`ref: ${{ github.ref_name }}` on every checkout downstream of a push.

**Corollary — a check with nothing to look at reports success.**
`check_checkout_ref()` scanned `ci/` and `.github/workflows/`; the generated
workflow lived in neither, since it is written to the outputs directory for the
user to paste. So every workflow check had been validating a file nobody runs and
saying "ok". Generate the artifact INTO the repo so the gate can see the thing
that actually executes, and make sure a negative control fires — a green check
over an empty set looks identical to a green check over a passing one.

**85. `actions/checkout` checks out the commit that TRIGGERED the run.** Not the
branch tip. A seed job that pushes new files is followed by jobs that check out
the tree from *before* the push — `bash: ci/bundle.sh: No such file or
directory`. Any job downstream of one that pushes needs
`ref: ${{ github.ref_name }}`.

The check written for this passed **vacuously**: it looked for a job that pushes,
`ci/build.yml` has none, and the generated `apex.yml` was not in the repo — so
there was nothing to check and it reported success. Generate the artefact INTO
the repo so the gate validates the file that actually runs, and always confirm a
new check can fail.

**86. Do not put a volunteer service on the critical path.** Every Overpass
mirror 503'd mid-build; `graph.py` correctly refused to ship a bundle whose
Return Home cannot reach a road, so a build that fetched all 1,027 trails
produced nothing. The refusal was right and the dependency was wrong.

Census TIGER is a government CDN with no rate limit, parses with the shapefile
reader already in the repo, and carries MTFCC **S1500 Vehicular Trail (4WD)** —
the two-track this app is for. It is the fallback, written in Overpass's element
shape so the graph needs no special case. With OSM entirely unreachable: 4,100
roads, 414 4WD trails, 2,856 mi, 99.8% connected.

**87. Measure the screen the app runs on.** `render.mjs` ran at 900x1400 while
the Fold's cover screen is 411x960 — under a third of the area. Label placement,
collision and any density metric are viewport-dependent, so every figure the
harness reported was optimistic: 8 names where the device showed 3. Setting the
harness to the real viewport reproduced the device exactly, and only then was
tuning meaningful.

**Corollary — symbol layer ORDER is collision priority.** `lbl-show` sat before
`lbl-trail`, so paths a rider may not use were named in preference to the trail
under their wheels. Put the labels that matter first.

**Corollary — revisit rules whose reason has expired.** Satellite forced every
label off, a defence from before labels had a dark halo. They have had one since
take 46. The rule survived its justification and, because `lbl-show` had been
added to the style but not to the list the rule governed, it inverted: on
satellite the only visible names were the non-ridable ones.

**88. Style what the user can USE, not what the source calls it.** Forest
two-track and USFS road are "roads" in the data and 52% of the ridable network
in fact — 1,169 of 2,246 miles. Drawn as thin grey dashes they read as "not for
you", and the rider reported that the trails he rides "have no color". The
legality model already knew they were open to him; only the paint disagreed.

**Corollary — a cost function optimises what you tell it to, not what the user
wants.** Fastest, Easiest, Shortest and Least-climbing all preferred pavement,
because pavement IS fast, easy, short and flat. Return Home offered a dirt biker
8.5 miles of highway and 0 miles of trail. Adding the composition to the card is
what made it visible; "Most trail" is what fixed it. Show the composition of a
route, not just its length — a rider choosing between 9.3 mi of road and 11.1 mi
of trail is not choosing on distance.
