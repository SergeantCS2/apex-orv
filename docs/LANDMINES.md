# LANDMINES

*Current as of take 108.*

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
| Filtered whole ways instead of clipping | 89 |
| Cached fallback becomes permanent | 90 |
| Shared casing swamps a thinner line | 91 |
| className assignment discards a style class | 92 |
| Opacity 0 is not off | 93 |
| Assertion on a user-controlled viewport | 94 |
| Tuned to one screen size | 95 |
| User-facing text inside the workflow | 96 |
| Short feature cannot fit a line label | 97 |
| Legend drifts from the map | 98 |
| Failed assert silently drops the whole patch | 99 |
| Refusing when a weaker true answer exists | 100 |
| Class label presented as a name | 101 |
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
| Filtered whole ways instead of clipping | 89 |
| Cached fallback becomes permanent | 90 |
| Shared casing swamps a thinner line | 91 |
| className assignment discards a style class | 92 |
| Opacity 0 is not off | 93 |
| Assertion on a user-controlled viewport | 94 |
| Tuned to one screen size | 95 |
| User-facing text inside the workflow | 96 |
| Short feature cannot fit a line label | 97 |
| Legend drifts from the map | 98 |
| Failed assert silently drops the whole patch | 99 |
| Refusing when a weaker true answer exists | 100 |
| Class label presented as a name | 101 |
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

**119. Fail where the user can act, not where the code happens to break.**
*(Written as a second "78" at take 49. 78 was already taken by the unresolved-step-reference lesson, which is what mkapex.py and gate.py cite. Given its own number at take 82; nothing was renumbered.)* An
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

*Restated at take 56, having already been written at take 49. Merged back into 85 at take 82, because two definitions of one number is exactly the confusion the numbering exists to prevent. The closing point below is the part the first writing does not make.*

`actions/checkout` checks out the commit that TRIGGERED the run. Not the
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

**89. Filter the geometry, not the feature.** The TIGER fallback kept an entire
road if one of its points lay near the region, so county roads ran on to the
county line — the graph spanned 44.16 to 44.86 against a 44.42-44.72 region and
the gate refused the bundle as "not this region". A bbox query from any agency
returns features that INTERSECT the box, with their full geometry attached.

Clip: emit each run of consecutive in-box points as its own way. 3.14% of nodes
outside became 0.01%.

**Corollary — measure with the checker's tolerance, not your own.** Mid-fix I
reported 2,566 nodes outside using the strict bbox, which looked worse than the
3.14% that had just failed. The gate allows a 0.05 degree pad and a 2% budget;
by that measure it was 2. A second opinion computed differently from the thing
it is second-guessing is not a second opinion.

**90. A cached fallback is a permanent fallback.** CI caches `aoi.json` and
`fetch_osm` returns early when it exists. That is what made a manual rerun
succeed where the first run failed — the cache still held good OSM data. It is
also a trap: cache a TIGER-derived `aoi.json` once and the region is pinned to
the road-only fallback forever, with no water layer and no OSM path classes, and
nothing ever retries.

Mark degraded output at the point it is written (`"source": "tiger"`) and make
the fast path check the marker, not merely the file's existence. A fallback
should be temporary by construction, not by luck.

**Corollary — "it worked on a rerun" is a clue, not an all-clear.** The rerun
succeeded because of a cached artifact, so the bug was still there and would have
resurfaced on any cache eviction, new region, or fresh clone — at which point it
would look intermittent and inexplicable.

**91. A casing tuned for one line width erases another.** `track` shares the
`net` source with designated trail, so it inherited a 6 px white casing under a
1.6 px stroke — which renders as a cream line, and the two-track vanished from
the map entirely. Give each weight class its own casing layer rather than one
filter covering everything that needs a halo.

**Corollary — one paint for two meanings is one meaning too few.** Forest
Service roads and two-tracks were both "ridable dirt" and both brown at take 58.
The user's own example showed the cost: "East Wagner Lake Road" is `minor` and
"E. Wagner Lake Rd" is `fsroad` — the same road, split in the source — so half of
it looked like a trail. Drivable and ridable are different facts and need
different paint.

**MapLibre's compact attribution renders EXPANDED.** `compact: true` controls the
style, not the initial state; on a 411 px screen the bar lies across the chip
strip and hides a control. Remove `maplibregl-compact-show` on load and on idle.

**92. Assigning `className` throws away every other class.** The map-detail
button was given a positioning class in the markup, and `setBasemap()` — which
runs at load — set `className = 'chip' + ...`, silently discarding it. The CSS
was right, the DOM was right, and the element computed to `position: static` at
0,0.

Use `classList.add/remove` for state, or make every assignment site include the
structural class. And when an element ignores CSS that is demonstrably present,
**ask the browser for the computed style** — that answered it in one step after
reading the source twice had not.

**Corollary — grep for EVERY assignment site.** I fixed one of two and the
survivor was indented two spaces instead of four, which is the same trap as
landmines 65 and 75. `grep -n "\.className"` costs nothing.

**93. Opacity 0 is not off.** A raster layer faded to zero is still uploaded and
drawn every frame. The hillshade is off by default, so that cost was paid on
every frame by default, on a device whose battery life is the one thing about
this app still unmeasured. Use `visibility: none` to switch a layer off and keep
opacity for how it looks when it is on.

**Corollary — when two places control one thing, change both.** The Relief chip
had its own handler that set opacity directly; `setBasemap` set visibility. After
fixing only the latter, turning relief ON did nothing — `visibility=none,
opacity=0.42`. Grep for every writer of a property before declaring it fixed, and
measure every state of a toggle, not just the default one.

**94. Do not assert on a viewport the user controls.** The self-test failed
`trails 0 features` because the rider had left the map over an area with no
designated trail. The map was fine. A check that depends on where someone
happened to pan is an info line; if you want an assertion, jump to a known
anchor, wait for placement, and measure there.

The same report failed `labels 0` — a second copy of landmine 87, querying
symbols in the same tick as its own `jumpTo`. Fixing a timing bug in one place
does not fix the copy.

**Corollary — when a fix costs more than the bug, stop and say so.** Deduping
OSM against agency geometry removed 558 miles at a loose tolerance and dropped
connectivity from 99.7% to 97.4%. The duplicates are real; deleting them is the
wrong tool, because the two sources have different topology. Ship the safe
version, record the measurement, and do the correct fix — keep both for routing,
draw one — deliberately.

**95. One handset is not a device target.** Everything here was tuned at
411x960, the Fold's cover screen, which is unusually narrow — and the app is
meant for whatever phone anyone brings. `render.mjs` now checks layout at
360x800, 412x915, 430x932 and the Fold, and defaults to the mid-size phone.

The check flagged `c-labels` off-screen on **all four**, including the device it
demonstrably works on, which is the tell that the check is wrong. A chip inside a
horizontally scrolling strip is not off-screen, it is scrolled — one swipe away.
Only vertical overflow strands a control. Negative-controlled by moving a real
control to `top: 2000px`.

**Corollary — two numbers in the same unit need captions.** A scale bar reading
"3000 ft" with "1194 ft" beneath it is not a readout, it is a puzzle. Say
"elevation".

**96. User-facing text does not belong in the workflow file.** The release notes
were inline in the YAML — the one file the seed cannot update — so the user was
still reading "Install from this page on the Fold" two takes after I changed it,
and I had told him the workflow would rarely need re-pasting. Move anything that
changes into the repo: `ci/RELEASE.md`, read with `--notes-file`.

**97. A short feature cannot carry a long line label.** "M-33 Bull Gap Trailhead"
is 23 characters; its feature is 740 ft, about 90 px at riding zoom. No text size
fits, so MapLibre drew nothing — at every zoom, permanently — and the only way to
learn the name was to tap it. `symbol-placement: line-center` does not help; it
still fits text along the line.

Emit a POINT at the stroke midpoint and label that with `text-max-width` so it
wraps. Eight previously invisible names appeared at Bull Gap alone.

**Corollary — one grey for many meanings is no information.** Every non-ORV route
was the same grey dash, so a hiking trail and a snowmobile route were
indistinguishable. Colour by use; keep the dash to mean "not yours to ride".

**98. A legend must read the same table the map does.** Eight route colours had
accumulated with nothing explaining them. The activity picker is now generated
from `ACTS` — discipline, swatch colour, classes, dashed-or-not — and the style
uses the same values, so the two cannot disagree. A hand-written legend is one
edit away from lying.

**Corollary — `background:` is a shorthand and resets `background-image`.**
Setting `background: transparent` inline killed the dash pattern on every
non-ridable swatch, so the legend showed no colour for exactly the disciplines it
was added to explain. Use `background-color`. Verified per row by computed style,
not by looking at a screenshot.

**Corollary — extend the harness when the app grows, not after.** Adding a filter
UI cost three harness failures in a row: a missing element query API, missing
`data-*` parsing, and a missing `MapStub.setFilter`. All three were caught before
the device saw them, two by `check_stubs` doing precisely its job.

**99. A failed assert aborts the whole script, including the parts that worked.**
Two patches in this take bundled a CSS addition with a code change. The code
anchor missed, the assert fired, and `write_text` never ran — so the CSS was lost
along with it, twice, while an *earlier* successful patch had already added the
markup that needed it. The result was a styled-looking element with no rule at
all: `.profax` computed to `display: block`.

Assert-before-write is right. The lesson is to keep one concern per script, or
verify each change landed rather than assuming the script that printed no error
did everything it contained. `grep -c` for the thing you just added costs
nothing.

**Corollary — ask the browser, not the screenshot.** "1955 ft2572 ft" looks like
a formatting slip; computed style said `display: block` and named the cause in
one step.

**Corollary — a rule established for one code path does not propagate itself.**
`DESIG`/`DIRT` fixed point-to-point routing at take 58 and the loop generator
kept its hand-written class list for ten takes, costing an MCCCT loop the same as
a gravel road. When you introduce a table, grep for everything that should be
reading it.

**100. Refusing is right; refusing when a weaker TRUE answer exists is not.**
The reverse geocoder said nothing beyond 145 m, because an address 300 m away is
not your address. Correct — and it threw away "0.2 mi NW of 798 N Morenci Rd",
which is true, useful, and exactly what you read to dispatch when there is no
address where you stand. Four of eight anchors got silence for twenty takes.

The distinction that makes it honest is the phrasing: a bearing and distance FROM
a road, never presented as the address of the point. Refusal and precision are
not the same axis — say the strongest thing that is true, and label how strong it
is.

**Corollary — verify a bearing outside the code that produced it.** A reversed
compass point sends help the wrong way. All four were recomputed from raw segment
geometry and compared before shipping.

**101. A class label is not a name.** Directions read "Turn left two-track",
which sounds like a trail called "two-track". The feature has no name; the class
was being rendered in the name slot. Say "unnamed two-track" and style it
differently, so the rider can tell the difference between a trail whose name you
are telling them and a trail that has none.

**Corollary — read the output of a feature before improving it.** The
turn-by-turn list had never been read end to end. Doing so took one probe and
found both the missing running total and the naming problem; neither was visible
from the code.

**Corollary — a failure count with no failure text means look at the machine.**
Render reported 5 failures printing nothing. The disk was full, from my own
screenshots. Third occurrence.

**Landmine 101, second occurrence — dispatch.** The class-as-name fault fixed in
directions at take 70 was also on the dispatch card, where it is worse: telling a
dispatcher the trail is called "two-track" is a false statement to someone
sending help. When a landmine is found, grep for every other place the same
pattern appears rather than fixing the instance in front of you.

**Corollary — a capability added in one take does not reach its best consumer by
itself.** The geocoder gained near-addresses at take 69; the dispatch card, which
exists specifically to state a location to a stranger, did not use them until
someone read its output. New data does not route itself to the screen that needs
it most.

**102. Check the expectation before calling it a mismatch.** The county lookup
reported South Branch as Ogemaw; I had written Iosco in the test and marked it
MISMATCH. The app was right and my memory was wrong. One query against the
source settled it — without that, the next hour goes into hunting a bug that does
not exist, and the "fix" would have introduced one.

When a check disagrees with you, establish which of you is wrong before acting on
it.

**Corollary — simplification needs a sampled check, not a spot check.** Four
points agreeing does not show that a simplified boundary is safe; a county line
is precisely where a cheap RDP would drift. 3,000 random points across the region
compared against the unsimplified polygons: 100%. That is the evidence, not the
four named towns.

**103. Search must forgive the hands that use it.** Exact substring match is
correct on a desk and wrong on a trail: a gloved thumb types `mcct`, `pinkstore`
and `h5717`, and all three returned nothing. Add a compressed tier (strip spaces
and punctuation from both sides) and a single-edit tier — strictly ranked below
exact matches, gated to queries of four or more characters, and only when nothing
better matched, so forgiveness can never displace precision.

**Corollary — every surface speaks the map's language.** Search results typed a
Forest Service road as *trail* eleven takes after the map learned to draw the
difference. When a distinction is established, grep every place that names the
thing.

**Landmine 101 corollary, fourth disk incident — the hog can live outside the
project.** Render passed standalone, then the gate's nested render failed with
"Could not compile fragment shader" and zero trail features. No code had
changed; disk had fallen to 70 MB. The consumer was not /tmp or the repo but
**/root/.cache — 652 MB** of headless-Chrome shader caches and downloads
accumulated across seventy takes. A GPU-sounding error on SwiftShader is a disk
error until proven otherwise, and `du -sh` on the home caches belongs in the
diagnosis before any shader theory does.

**104. An empty artifact is not a missing artifact — and only one of them is
honest.** `pack.py` wrote a structurally valid water payload with nothing in it:
65 bytes of `{"bbox":[…],"l":{"waterway":[],"water":[]}}`. `bundle.verify()`
checks existence, byte size and SHA-256, and **all three pass on an empty file**,
so the bundle reported COMPLETE while the map had no water and the app never
named the gap. `ingest` had already printed "bundle will be PARTIAL" in the same
run — two components describing the same tree, disagreeing.

Landmine 74 restated one level up: **existence is not content.** Count what is
in a payload before treating it as a layer. Guard it in the producer *and* in the
bundler, because the next empty artifact will come from a producer nobody has
written yet. Every counter must be read off a REAL payload — a counter aimed at
the wrong key reports 0 on a good artifact and degrades a healthy bundle, which
is landmine 54 wearing a new hat.

**Corollary — a downstream fallback can defeat an upstream guard.** pack.py's
guard was "if `aoi.json` is missing, skip water", written at take 13. Take 56
added a TIGER fallback that *writes* an `aoi.json` carrying no water at all. The
guard was still correct about the question it asked and no longer correct about
the situation. When you add a fallback, grep for every guard that tests for the
condition the fallback now conceals.

**Corollary — stale files defeat a correct check.** The app's own loader keys off
the manifest and would have reported PARTIAL correctly. It didn't, because a
previous run's `water.json` was still sitting in the destination and got copied
onward — into `www/`, which is what `cap sync` packages. Any build step that
stages a set of files must **remove the ones it did not stage**. Landmine 54's
corollary: stale build artifacts are a hazard, not an archive.

**105. A loop over what is declared can never notice what was never declared.**
`bundle.verify()` iterated `man["artifacts"]` looking for files that had gone
missing. An artifact that was never *staged* is not in that list, so the loop is
structurally blind to it. Proven by reconstructing the predicate verbatim: a
bundle whose **required** `graph.json` was never staged verified as **COMPLETE**.

Check the manifest against the **specification** — the `ARTIFACTS` table that
says what a bundle is supposed to contain — not against itself. A document that
is its own checklist always passes. Same shape as an orphan source (69), a call
site with no definition (65) and an unresolved workflow reference (78): a
reference with no referent, silently.

**106. A backgrounded process does not survive the turn.** `nohup … &` to warm a
long pipeline while reading code: the process is gone by the next command, having
produced nothing. Worse, Python **block-buffers stdout when it is a file**, so
the log held only the header and looked like a stall rather than a corpse.

Run long work in the foreground, in stages that each complete, with `python3 -u`.
Artifacts on disk persist between turns; processes do not. Landmine 40's family —
the environment has properties that must be learned rather than assumed, and this
one costs a cycle every time it is rediscovered.

**107. A copy of a table is not the table.** Landmine 98 said a legend must read
the same table the map does, and take 67 shipped a legend "generated from ACTS"
— where ACTS carried its own `sw` colour, hand-copied from the style. Take 61
set two-track to `#A9702F`. Take 64 dimmed the **layer** to `#9C7343`. Take 67
wrote the swatch from the take-61 value. Ten takes later they were **dE 12.9**
apart, four times the just-noticeable difference, and `#A9702F` appeared nowhere
in the style at all.

Generated from a copy is hand-written with extra steps. The style must *read*
the shared table, not be *kept in sync* with it, and a gate check must fail on
any literal where a reference belongs — otherwise the next person to adjust a
colour adjusts one of the two copies, exactly as three people already did.

**Corollary — verify the finished artifact, not the source.** Reading
`src/app.html` twice is how this survived: both values are right there, forty
lines apart, and they look fine. Ask the BROWSER what colour it painted and what
colour the swatch rendered, from computed style, per row. A screenshot cannot
tell 12.9 dE apart either.

**108. Some contrast problems have no colour that solves them.** `fsroad` was
illegible over satellite at dE 15.8 from median ground with no casing under it.
Nine candidate colours, scored against both backdrops: the sand basemap is light
(228,215,188) and canopy is dark (91,106,84), so **every lighter candidate
gained on satellite exactly as fast as it lost on sand.** No single mid-tone can
separate from both. The answer was structural — a casing, the same halo that
made designated trail and two-track legible in the first place.

When a sweep returns nothing that passes, the constraint set is telling you the
lever is wrong. Do not widen the thresholds until something passes.

**Corollary — legality is a hard constraint on colour, not a tiebreak.**
`#B0722B` scored best for two-track on every visibility axis and sits **dE 12.5**
from `nfsmoto` amber, a trail whose ridability the MVUM governs. A ridable line
that looks like a maybe-not-ridable line is landmine 88 arriving through the
palette. Score every candidate against every NON-RIDABLE colour before ranking
them, not afterwards — it was already written into the table when the collision
check caught it.

**109. Copy proven harness arguments; do not derive them.** A new browser probe
launched Chrome with args that looked equivalent to `render.mjs`'s and omitted
`--enable-unsafe-swiftshader`. Modern Chrome then refuses SwiftShader for WebGL,
MapLibre never gets a rendering context, and `window.map` never appears — **with
no page error, no failed request and nothing in the console** beyond a favicon
404. Twenty minutes, and the first suspicion was the product.

PROTOCOL §3 in its narrowest form: when a harness already works, copy its setup
verbatim. And a readiness check must distinguish *never constructed* from
*constructed but never loaded* — one verdict covering two causes is landmine 55
again.

**110. A check that only reads the OUTPUT cannot see a broken input.**
`check_syntax` scanned `www/` and never `src/`. A `str_replace` swallowed a
function header in `src/app.html`, leaving it unparseable, and the gate reported
`inline syntax ok (2 files)` on the same tree — because it was validating a
stale-but-valid build. `check_current` compares take *stamps*, not content, so
an edit within the same take can sit broken in the source indefinitely with the
gate green.

Check the source AND the artifact. Take 12 built `check_current` because `www/`
held an old app while the work lived elsewhere; this is the same hole facing the
other way, and it stayed open for sixty-six takes.

**Corollary — when replacing an anchor, assert the anchor SURVIVES.**
`assert old in s` before the edit proves the anchor was there. It does not prove
the replacement put it back. `function rideStop(){` was consumed by a block that
never restored it, and every brace after that point belonged to the wrong
function. Landmine 65 for the second time in three takes: grep for the anchor
again AFTER the write, not only before it.

**111. Forcing the state a check exists to measure is part of the check.**
The four-device layout matrix runs on a freshly loaded page, where the ride HUD
is hidden. Adding a new full-width element and running the matrix would have
measured `display:none` at four sizes and printed four green lines — landmine
85's corollary arriving through the front door, in the one harness whose entire
job is to catch a control that does not fit.

If a check covers something conditional, the check must put the system into that
condition first. Expose whatever the harness needs to do it; a hidden element
measured at four device sizes is four measurements of nothing.

**112. One sample is not a measurement.** A single probe to `overpass-api.de`
returned 200 with real data, so the entry "Overpass is back" was written and a
re-ingest started. The pipeline got 503 on the same host seconds later. Ten
probes, three seconds apart: **0/10**. The success was noise.

An intermittent service will hand you whichever answer you happen to ask for.
Before declaring an outage over — or a flaky check fixed, or a race resolved —
sample it enough times to state a rate, and put the rate in the record rather
than the verdict. "0/10 at three-second intervals" survives being re-read; "it's
back" does not.

**Corollary — report the workload's result, not the probe's.** The thing that
matters is whether the real fetch completes, not whether a hand-built one-line
query does. When they disagree, the workload is right.

**113. Storing a computed result can bypass the checks that produced it.**
A saved route could have been stored as the line itself — smaller code, exact
replay, no re-computation. It would also have replayed a route around closures
that no longer existed, or *through* twelve segments the DNR closed after it was
saved, because the closure filter runs at routing time and a stored line has
already been past it.

Store the INPUTS and recompute. Where a result encodes a safety decision made
against data that moves, caching the result caches the decision. Accept that the
recomputed answer may differ from the saved one, and say so — that difference is
the feature, not a defect.

**114. Assert on something that is actually on screen.** A machine-legality
check asserted that `moto24` still rendered when dimmed. It renders **zero
features at the harness viewport whichever machine is set** — the class is not
in view there at all — so the assertion was simultaneously wrong and incapable
of passing for the right reason. Its neighbour `trail50` renders 244.

Before asserting that a layer, label or feature behaves a certain way, print the
count. A check written against a class that is not in frame is landmine 85 with
extra steps: it will either fail confusingly or pass while proving nothing.

**Corollary — do not compare serialised expressions.** The same check asserted
`paved` never dims by comparing its paint expression across machines. Those
strings differ because the ok-list literal inside them differs, while `paved` is
in every list and its resolved opacity is 1 in all cases. Compare the resolved
VALUE, or test the input that decides it — never the syntax of the rule.

**115. A visual state must not claim more than it knows.** Line a machine cannot
legally use is DIMMED, never hidden and never dashed. Hidden would deny that the
trail exists, which is the fault landmine 34 exists to prevent. Dashed already
means "not yours to ride, ever" — and a 24" motorcycle trail is a perfectly legal
ORV trail that merely will not take a 72" machine, so dashing it would state
something false about the world.

Three different facts need three different marks: *does not exist* (absent),
*exists and is never legal for anyone* (dashed), *exists, is legal, is not for
the machine you are on right now* (dimmed). Reusing one mark for two of them
loses the distinction the rider needs most.

**116. A class is not always the rule.** `MACHINE[m].ok` is a class allow-list
and it encodes the DNR's rules perfectly, because the DNR expresses width by
publishing a feature in a 24" / 50" / 72" layer. The Forest Service publishes
ONE trail class and states the rules per vehicle in the attributes. 25 edges
here read `moto: open` with `atv` unset — "Trails open to motorcycles,
Yearlong" — and class-only routing put a quad on them while the feature card
printed "Moto open" alongside.

Two agencies, two schemas, and a model shaped around one of them silently
mis-serves the other. When a source states a rule per feature, that rule governs;
the class rule is the fallback, not the authority. And the router and the
snapper must apply the SAME predicate — a snap onto a node the router will not
leave either reports "no route" when a legal one exists or starts the rider on
one (take 24).

**Corollary — displaying a fact is not honouring it.** The MVUM flags had been
on the feature card since take 5. The app showed the rider "Moto open" and
routed as if it had not read it.

**117. Importing a module to test one function runs the whole module.**
`gate.py` calls `sys.exit()` at module level. A harness that imported it to call
a single check **ended on the first import**, printing `GATE PASSED` — and four
negative controls were recorded as passing without ever running. The output of a
harness that died looks identical to the output of a harness that succeeded.

Load the definitions without the runner, and make the harness prove itself
first: a baseline that must produce the real, expected NOTE, not merely the
absence of a failure. Silence is not a pass.

**Corollary — a cut anchor must be unique.** Splitting the file at
`SRC.find("for fn in (")` matched a line inside the very check under test,
truncating it after its second statement. Every result was an artefact of the
harness. Verify the slice contains what you are about to test.

**118. Bound a source-scan window at a structure, not a character count.**
The machine-legality check looked for `machineLegal(` within 2600 characters of
`function nearestNode(ll)`. `nearestNode` is twelve lines long, so the window ran
past its end into `route()` — which does call it — and the check passed on a
`nearestNode` reverted to class-only. Bound at the next top-level definition.

Found by the negative control, which is the entire argument for writing them.

**120. Name the thing that is actually broken.** Four takes shipped on the claim
"OpenStreetMap is down", measured as 0/24 real responses across three Overpass
mirrors. Jacob asked whether it was an outage or the build environment being
blocked. It was neither, quite:

- `api.openstreetmap.org/api/0.6/map?bbox=` returns **200 with 660 KB of real
  data for the Bull Gap box**. `openstreetmap.org` and the tile server: 200.
  OSM was never down.
- `overpass-api.de` returns **503 on `GET /`** — the whole host, not the API —
  with an Envoy proxy body and only three response headers. DNS resolves to the
  correct address. That is the egress path failing to reach that host, and
  nothing to do with Overpass's own health.
- `overpass.osm.ch` is the **Swiss chapter's instance**: Bern returns 4,176 ways,
  Bull Gap returns 0. It is not intermittently empty. It is permanently the
  wrong instance for this project, and landmine 74 was written about it as if
  the problem were flakiness.

Three different faults were collapsed into one wrong headline, and the headline
went into four handoff entries and four sets of release notes. A rate is not
enough (landmine 112) if the thing being rated is misnamed: check whether the
HOST answers at all, look at the response headers, and test the same data from a
second path before naming a source dead.

**Corollary — a fallback needs the same reachability test as the primary.**
Nothing ever checked that `overpass.osm.ch` could serve this region. It sat third
in the mirror list for twenty-six takes as a fallback that could never once have
worked.

**121. A drill must put back everything it moved, not just the state it was
written to think about.** The self-test's safety drill calls `startRecording()`
to exercise breadcrumb and retrace. It carefully saved and restored `TRUCK`,
`crumbs`, `crumbMi`, `posMode`, `ME`, `RIDE` and `LASTRIDE` — and left the ride
HUD switched on, over the place chips, showing no heading, for the life of the
app. Jacob found it on the first real ride.

The restore list was written when `startRecording()` had five side effects. A
sixth was added at take 78 and nothing connected them. Save the VISIBLE state
too, or better, drive the drill through the same stop path a rider would.

**122. My sandbox is not the build environment, and its failures are not the
product's.** Four takes shipped saying "OpenStreetMap is down", measured at 0/24.
Jacob's take-82 APK came back with **20,428 edges and a complete bundle** — the
OSM profile, water and all. CI reached Overpass without difficulty the whole
time. The release notes told him his build had no water; it did.

Before writing an environmental fault into the record, check whether the thing
that actually ships is affected. A build machine, a runner and a container are
three different places (landmine 40's family), and the one that matters is the
one the artifact is built on.

**123. A control that renders nothing looks broken.** With no heading the
compass ribbon drew its needle and no ticks — technically correct, and
indistinguishable from a bug. Jacob's words were "it doesn't work whatever it
is." Say what is missing: *"waiting for heading — start moving."* An empty state
is a state, and it needs the same care as a full one.

**124. Fix the instrument before you distrust the product.** Four takes were
shipped believing OpenStreetMap was unavailable, on 0/24 local probes, while
CI built complete bundles from it the whole time. The correct response was not
to work around the outage — there was no outage — but to notice that the thing
doing the measuring was the thing that was broken, and repair it.

A 297 MB sanctioned bulk download and eighty lines of tool restored the ability
to measure. Everything that had been "blocked" for four takes was measurable in
one. When a measurement and the shipped artifact disagree, the artifact is the
evidence.

**Corollary — a new instrument is worthless until it reproduces a known
result.** `osm_local.py` is trusted because it returns 20,222 edges and 12,236
nodes, which is the take-74 record exactly. Had it returned something close but
different, everything measured with it would have carried an unknown error.
Validate against a recorded number before using a tool to decide anything.

**125. Near is not the same as duplicated.** A60 is "two sources mapped the same
road, so draw one." Measuring proximity alone finds 8,103 near-parallel pairs at
17 m — and 2,934 of them are the SAME source, including 861 `mccct+moto24`
pairs. Those are the Michigan Cross Country Cycle Trail running along a
motorcycle trail: not one road drawn twice, but two legal designations on one
corridor. Collapsing them would delete a fact about what a rider may ride.

The predicate is not "these lines are close". It is "these lines are the same
physical way, reported by two different sources" — so the source pair is part of
the test, not metadata. Geometry alone cannot tell a duplicate from a
co-designation.

**126. Fallback tiers are not interchangeable, so the ORDER is part of the
contract.** The OSM chain was "three Overpass mirrors, then Census TIGER", and
TIGER was treated as simply the next thing to try. It is not: it carries roads
only, no water, and a different topology — 34,341 edges where OSM gives 20,222.
Nine takes shipped a map made of different data because one volunteer service
was unreachable, and nothing in the code said the tiers differed.

Where a fallback produces a *different product* rather than the same product
more slowly, say so in the code and gate the order. A tier that silently changes
what the artifact is made of is not a fallback, it is a second product.

**127. Search for the CALL, not the name.** A check meant to prove Geofabrik is
tried before TIGER compared `ing.find("osm_local.build()")` against
`ing.find("tiger_roads()")` — and `"tiger_roads()"` is a substring of
`def tiger_roads():`, so it matched the definition near the top of the file and
reported correct code as broken.

The same shape as landmine 118's window bug one take earlier: a source scan that
matches more than it means. Anchor on something that only appears at the site
you care about — `els = tiger_roads()`, not `tiger_roads()`.

**Corollary — a mutation that leaves the searched string intact tests nothing.**
The control for the reorder branch renamed `els = osm_local.build()` to
`XX_osm_local.build()`, which still contains `osm_local.build()` at the same
offset. The control passed, the branch was dead, and only writing a mutation
that genuinely reorders the tiers proved the branch worked. A negative control
must change the thing the check looks at.

**128. Two artifacts can each be perfect and still describe different things.**
`terrain.json` carries one elevation per graph node. A stale terrain from an
earlier run sat in a bundle whose every SHA-256 matched, whose manifest was
correct, and which passed every gate check — because nothing had ever compared
two artifacts to EACH OTHER. The app's own self-test caught it at runtime
(`TR.ne.length === NODES.length`) after the gate had waved it through.

Integrity checks answer "is this file intact". They do not answer "do these
files agree". Where one artifact is indexed by another's contents, check the
relationship, not just the hashes — and notice when a runtime check is the first
thing to find an incoherent build, because that is the wrong way round.

**129. Suppressing something from the map is a safety decision.**
A60 draws one copy of a duplicated road and hides the other. Whichever copy is
hidden, a rider stops seeing it — so the choice cannot be "whichever is
shorter", or arbitrary, or a side effect of iteration order. Closures must never
be the hidden one. Designated ORV line, which carries legality the OSM copy does
not, must never be the hidden one.

Rank the candidates explicitly, gate the ranking against the built artifact, and
name the classes that may never be suppressed in a list the check reads. A rule
that only exists in the shape of the code is a rule nobody can see.

**130. A probe pointed at empty ground reports the same thing as a broken
feature.** Water labels were called dead for most of a take. Two probes in a row
centred on viewports containing **no named water**: Loon Lake is at 44.518, the
Au Sable runs at 44.61–44.68, and both probes sat at Bull Gap, 44.50 and 44.57.
"0 labels rendered" was true and meant nothing.

Before concluding a layer does not work, prove the thing it draws is IN THE
VIEWPORT. Pick the probe target out of the data — the largest named feature, by
coordinates read from the payload — rather than from the place you happen to be
looking at.

**Corollary — measure where the layer is switched on.** The same check then read
its final result at z11.4, below `lbl-lake`'s 11.6 minzoom, so it was guaranteed
zero whatever the product did.

**131. A verdict is not a diagnosis.** Four separate readings said "0 labels"
and every one was compatible with a dozen causes: no data, bad geometry, wrong
filter, missing glyphs, collision, wrong zoom, or an empty viewport. Nothing
moved until the check was changed to report what it OBSERVED —
`0 label(s) of 175 in the source` plus a sample feature — at which point the
source was visibly fine and the search narrowed in one run.

Landmine 55 restated for the case where the check passes its own sanity test: a
number on its own is not evidence. Print the denominator and an example.

**Corollary — private API is not API.** `getSource(id)._data` is undefined in
MapLibre 5, so the diagnostic threw and reported `-2`. That read as "the source
does not exist" when the source held 175 features. Use the documented route —
`getStyle().sources[id].data` — or the probe becomes another suspect.

**132. A field can be dropped more than once on its way through.** Adding OSM's
`ref` to the graph looked done after one edit to the ingest block, and measured
**0 edges with a route number**. The noding step rebuilds every edge from an
explicit key list, and `ref` was not in it, so a correct first fix produced a
correct-looking diff and no data.

Where a pipeline stage reconstructs records rather than passing them through,
every new field must be added at every reconstruction. Measure the count at the
END of the chain, not after the edit that seemed to be the point.

**133. Order the features so the later one cannot undo the earlier one.**
A75 puts posted route numbers on the map. 2,318 of the 4,470 edges carrying one
are the OSM copy of a Forest Service road that A60 already suppressed — and
which we already label with its authoritative FS number. Had A75 shipped before
A60, the map would have drawn the same number twice along two parallel lines,
and the fix would have looked like a labelling bug rather than a duplication one.

A60 first was luck, not judgement. When two agenda items touch the same
geometry, work out which one changes what the other one sees.

**134. The same copied set will drift more than once.** `LBL` was a hand-kept
array of label layer ids. It drifted at take 57 — `lbl-show` was missing, so on
satellite the only names left were trails you may NOT ride — and was fixed by
adding one id to the array. By take 89 it had drifted again, six layers behind a
style with eleven, four of them added by me two takes earlier.

Fixing a drifted copy by updating the copy guarantees a third occurrence. The
fix is to stop keeping the copy: ask the map what layers it has. Third place
this has happened here — the palette (77), the CI dependency attribution (84),
and this — and each was fixed by deriving rather than by syncing.

**Corollary — grep for USES, not for the declaration.** The gate check written
to prevent a return of the array matched `var LBL=[`, and passed a tree where
the declaration was gone and a second call site still stood. `LBL is not
defined` was caught by the browser. Match `NAME` followed by `.`, `[` or `=`;
and beware matching the word inside a comment describing the old bug, which the
next version did.

**135. Replacing a control is not the same as moving it.** Tidying three layer
toggles into a panel, I turned the basemap button from a ONE-TAP CYCLE into a
menu — two taps and a hunt to reach satellite, in gloves, on a bike. The render
harness said so within a minute because its basemap checks encode the old
behaviour.

A control that already works has a cost of use, and a tidier arrangement that
raises it is a regression however much better the code looks. Keep the fast path
and add the panel beside it.

**136. An estimate is only worth its assumptions, so write them down.**
Contours were sized at 419 KB from a measurement that assumed delta-encoded
integers. The first implementation wrote raw lon/lat floats and cost **946 KB** —
more than twice the number I had just quoted, from the same geometry. Nothing was
wrong with the measurement; it described a thing that had not been built yet.

When a measurement informs a design decision, record the encoding, units and
tolerance it assumed. Otherwise the number survives into the implementation and
the assumption does not.

**137. A declaration matched by exact string must be written once.**
`build_app.py` strips its `DECLS` entries out of `src/app.html` by literal
string match. Splitting one across two lines, with different indentation in the
two files, meant the strip silently did nothing: `CONT = __CONT__` shipped as a
literal token, the map never constructed, and every render check returned `-1`
or `undefined` rather than naming a cause.

Where two files must agree byte for byte, keep the shared text on one line and
say so beside it. A mechanism that fails by doing nothing is worse than one that
throws.

**138. A dependency check compares import names, not package names.**
`check_ci_deps` correctly flagged `skimage` as uninstalled. It then flagged it
again after `ci/bundle.sh` installed `scikit-image`, because the two names are
not the same string. A `PIL -> pillow` mapping had existed since take 51 and
simply did not know this case.

Adding a dependency whose import name differs from its package name means adding
it to that mapping too. The failure looks like a broken build script and is
actually an incomplete lookup table.

**139. Two rules that look contradictory need to be asserted together.**
A saved ROUTE stores its inputs and never its geometry, because closures move
and a frozen line replays a stale legality decision (landmine 113). A saved
WAYPOINT stores its coordinate, because a point on the ground does not move and
encodes no decision.

Left as two separate facts in two takes, the second reads as a violation of the
first, and the next person to notice will "fix" one of them. Both are asserted
in the same smoke run with the reasoning in the assertion text. Where a rule has
a deliberate exception, the exception and the rule belong in the same place.

**140. Measure the terrain before porting a feature built for different
terrain.** A slope-angle layer is standard in backcountry mapping and onX ships
one, so it sat on this agenda as an obvious win. Measured against the DEM
already on disk: **65.6% of this region is under 3 degrees and 99.9% is under
22**, where the avalanche bands that layer exists to show start at 27. It would
have rendered 1,060 km² a single colour.

A feature that works elsewhere is a hypothesis about here. The measurement cost
one query against data already downloaded and closed the item for good instead
of leaving it as a maybe.

**141. An unmeasured worry is not a finding, and carrying one is a cost.**
A96 — "the dispatch card decodes 20,222 polylines on the highest-stakes screen"
— sat on the agenda as UNKNOWN for eighteen takes. It read like a real problem
and it shaped how the surrounding code was talked about. Measuring it took one
browser evaluate: **23 ms**, of which `nearestEdge` is 17.

A worry that is cheap to measure and never measured is worse than either
outcome, because it quietly argues against touching the code near it. Measure
per component, not in aggregate — "the card is slow" names nothing to fix.

**Corollary — do not optimise on the strength of the worry.** `nearestEdge`
could be spatially indexed. On this evidence it will not be: rewriting a working
safety path against a number that says it is fine trades real risk for imagined
gain.

**142. A number from the machine that can measure is not a number from the
machine that matters.** The 23 ms above is headless Chrome on a desktop. Turning
that into a phone figure is arithmetic, and take 57 already paid for that mistake
once by tuning label density against a 900×1400 viewport nobody had.

Where a device can report the number itself, make it report it. The timing now
runs as a self-test line, so the next field report carries the real figure rather
than an extrapolation with a confident tone.

**143. A workaround outlives the problem it was written for, and then becomes
one.** `setBasemap` re-applied the label layer's visibility to every symbol layer
on every basemap change. It was written when switching to satellite had to force
labels off, because dark-on-light text was unreadable over jack pine. Labels
gained a halo at take 46 and the comment above the loop said so plainly — but
the loop stayed, doing nothing, for forty-eight takes.

It stopped doing nothing the moment a symbol layer had its OWN default: summits
default off and were switched on at load by a line whose purpose had expired.

When a comment explains why code is no longer needed, that is the moment to
delete the code. A no-op is not harmless; it is a rule waiting for a case that
contradicts it.

**144. Two maps agreeing is worth more than either alone.** The summit
elevations were checked three ways before shipping: OSM's surveyed `ele`, our
own DEM, and the figures printed on a commercial map in a screenshot. All three
agree within three feet on three of four peaks.

Where a cheap independent source exists — even a competitor's screenshot — check
against it. It costs a minute and it is the difference between "the code ran"
and "the number is right".

**145. Count the distinct values before writing a parser.** The DNR's
`SpecialRestrictionType` reads like free-form legal prose — "ORVs less than 65
inches in width only between the dates of May 1st and November 1st. Off road
motorcycles are prohibited" — and a parser for it was budgeted. Querying the
distinct values found **nine strings in the entire state**, two of which are the
same rule written twice with different punctuation.

Nine is a table. A table can be read, checked by eye and reviewed by someone
else; a regex over legal text cannot, and it fails silently on the tenth string
by classifying it as something it is not. Ask the source how many answers it has
before deciding how to read them.

**Corollary — find the null sentinel.** `-1` appears in that field on 1,877 of
1,889 routes. Taken at face value it would have flagged almost the entire state
network as restricted. A field is not populated just because it is non-empty.

**146. A rule derived from data may only ever restrict, never permit.**
The restriction table decides whether a machine may use a segment. Where it
recognises a string it applies the ban; where it does not, it bans nobody and
prints the source's own words unedited.

Both directions are not symmetric. Wrongly restricting costs a rider a detour;
wrongly permitting puts them somewhere they may not legally be. Where an
interpretation could be wrong, make the failure mode the one that is merely
inconvenient — and show the raw text so the rider can out-think the app.

**147. Build the machinery before the data arrives, and drill it with data you
make.** Zero features in this region carry a restriction, so shipping the field
unexercised would have been shipping a refusal nobody had ever seen fire
(landmine 45). The harness injects the verbatim published strings onto real
edges and proves a dirt bike is refused, a quad is not, and an unrecognised
string removes nothing.

A precondition built for a region that does not exist yet is still testable —
by manufacturing the case, from the real values, and saying in the assertion
that is what you did.

**148. A naming convention is a better source of truth than a list.**
`region.DERIVED` named twelve artifacts to clear on a region switch while the
pipeline wrote nineteen. Every payload it writes is called `*_payload.json`, and
had that convention been globbed from the start, the seven it missed — two of
them added by me two takes earlier — would have been cleared the day they were
invented.

Where a set follows a rule, enforce the rule and derive the set. Keep a list only
for the members that break the rule, and expect that list to be short and stable
because the exceptions are.

**Corollary — `os.remove` cannot delete a directory.** `imagery_tiles/` is 2,008
files of the previous region's ground and survived every region switch, partly
because nobody listed it and partly because the loop that would have listed it
could not have removed it. A clear-up that handles one kind of thing will
silently skip the other.

**149. "Not traced" is a decision to find out later, and later is now.**
A95 was recorded at take 75 as "anchors outside the bbox — not traced, may be a
deliberate signpost". Tracing it took one grep: a place chip runs `map.easeTo`
to the anchor, so a chip 16 km outside the region pans the rider to blank ground
with no imagery, no network and no explanation — and the same anchor is in the
search index.

Twenty-one takes of "may be deliberate" cost one command to settle. When
recording an unknown, record the command that would resolve it.

**150. Fix the defect; do not make the judgement call that surrounds it.**
Two anchors sat outside `sthelen`'s bbox. Removing them fixes the defect.
Widening the bbox to include them would also fix it — and would change what that
region downloads, which is a decision about scope, cost and what the region is
FOR.

Where a fix has an alternative that changes the product rather than correcting
it, take the correcting one and write the alternative down where the owner will
see it. The reason went into the region's own note, not just the handoff.

**151. A check that measures the edge will flip on an unrelated change.**
The contour-label check found exactly ONE label at one viewport. The take-98
destination bar took ~52 px of map height and it went to zero — reported as a
failure of contours, which were fine. Probing three zooms found the label
immediately.

A check sitting on a boundary is not testing the feature, it is testing the
boundary, and it will accuse whatever change happens to arrive next. When a
check passes with a count of one, treat the one as a warning: widen the probe
until the margin is real, or the next take pays for it.

**152. A status line is what a successor trusts, so gate it.**
`AGENDA.md` had three headings reading OPEN or PROPOSED over bodies recording
shipped, superseded and measured work. Nothing errors. The ledger check already
enforced unique ids and no gaps and had no opinion on a heading that contradicts
its own entry.

An id that means two things is loud — the check fires. A status that is simply
out of date is silent, and it is read first. Both are ledger integrity.

**Corollary — a status check must not fire on a healthy item.** The first
version matched `**Ruled out:**`, which every agenda item is REQUIRED to carry,
so it flagged all nine open proposals. A check with false positives is turned off
within a week, and then it protects nothing. One of the three controls exists
purely to prove a genuinely open item stays silent.

**153. Presentation is not architecture, and confusing them costs the product.**
Asked why a commercial app felt more premium, the honest answer was measurable:
14 chips in one scrolling row, 38 emoji as icons, ONE CSS transition in 3,667
lines, 15 distinct font sizes. None of that is the backend.

Copying that app's architecture would have meant adding a server, accounts and a
subscription — and would have cost the properties this app is actually better at:
offline routing, provenance on every line, and refusing to guess. Measure the
gap before agreeing to close it, because "it feels cheap" and "it is built wrong"
are different diagnoses with opposite treatments.

**154. Never rebuild a shared parent's innerHTML to change a child.**
Expanding icon placeholders by replacing `#shell.innerHTML` produces a fresh DOM
with identical markup and **no event listeners on any of it**. The map still
draws, every screenshot looks right, and not one button works.

Replace the element you actually mean — a button's own children, never a
container's. And assert it: a render check now clicks a control after the icon
pass and requires the handler to fire, because "it looks correct" is exactly the
symptom this failure produces.

**155. Anything written with `textContent` will discard what you put inside it.**
Twelve places set a chip's label with `textContent`, which was harmless when the
label was `'▶ Ride it'` and destroys an icon the moment one exists. Press Ride
it, change machine, change fuel, switch basemap, run the self-test — every one
of them would have blanked its own icon.

When adding structure inside a control, find every write to that control first.
One helper should own the rewrite, or the count of places that need updating is
the count of places that will be missed — a thirteenth turned up after the first
sweep.

**156. Follow the convention the codebase already has.**
`setChip` needed to know whether a control was a floating map button or a chip,
and reached for `classList.contains()`. The stub-coverage check refused it — and
the app had tested classes with `className.indexOf()` everywhere else since take
4.

Adding an API to the harness so one new line can use a nicer idiom is the wrong
trade. The convention is not better, but it is the one that is already proven,
already stubbed and already understood.

**157. A scale is a decision made once; a list of sizes is a decision made every
time.** Sixteen distinct font sizes across 44 declarations, each picked in
isolation — 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 14, 15, 17, 18, 30.
No individual choice was wrong and the result read as unfinished, because nothing
related to anything else.

Six steps, each existing size mapped to its NEAREST, so the change could not move
anything more than a pixel and the layout matrix could catch it if it did. Map
label sizes stayed out: they were tuned against satellite imagery by measurement
and a tidy-up would have silently undone it. Not everything that looks like the
same problem is.

**158. Anything that animates must stay in the layout, so prove it cannot be
touched.** A panel that fades has to be `display:block` while hidden, or there is
nothing to fade. That leaves an invisible, full-size element sitting over the
map — and an invisible control that still catches a tap is worse than one that
blinks, because the failure is silent and unattributable.

`visibility:hidden` and `pointer-events:none` fix it; `elementFromPoint` proves
it. Assert the negative — that a closed panel catches nothing — because the
positive case looks identical either way.

**159. A check that names a specific element tests the name as much as the
behaviour.** The destination check proved "a chip in a closed destination is
hidden but still works" by naming `c-selftest`. When that button moved into the
diagnostics sub-menu it stopped carrying `data-tab`, and the check failed on
correct code.

The behaviour it meant to test was still true of every other chip. Select the
subject by the property under test — *whichever chip is in a closed destination*
— not by an id that can move for unrelated reasons.

**160. Derive the set from evidence; never type the list.**
"Which rivers do people paddle?" looked like it needed a hand-written list of
famous rivers. A list is opinion, it goes stale, and it does not survive going
statewide — 574 named rivers in Michigan.

The evidence was already in the data: **a river is paddled if people have built
places to put boats on it.** Scoring by access points within 500 m produced the
state's canonical paddling ranking — Huron 78, Au Sable 54, Manistee 51 — with
nobody choosing it, and every river the owner named cleared the threshold
without being named in the code.

When a feature seems to need a curated list, look for the thing people did on
the ground that made the list true.

**161. A gap in the data can be the feature.**
Chaining the Au Sable left 17 fragments and the longest held 86 of 123 miles.
Two obvious readings — a tolerance too tight, or a name mismatch — were both
wrong. The river way **stops at every impoundment**, because a pond is mapped as
a polygon and a river as a line.

The fragmentation was not noise obscuring the river; it was the dams, which are
the one thing a paddler must not miss. Joining the pieces would have produced a
continuous line nobody can paddle and erased the hazards in the same operation.

Before smoothing over a discontinuity, ask what put it there.

**Corollary — a gap has a maximum size.** Michigan reuses river names; one
"Black River" group spans several distinct rivers. Under 15 km a gap is an
impoundment, over it the two reaches are two rivers, and joining them invents a
watercourse. Any rule that bridges gaps needs a limit beyond which it refuses.

**162. When your number disagrees with local ground truth, publish the
disagreement.** Corridor distances came out at 0.53x the local outfitter's
figures above Mio and 0.78x near it — OSM's centreline is drawn at 62 m spacing
and loses the meanders.

The tempting fix is a correction factor. The shortfall is not constant, so any
factor is invented, and it would be applied to a number someone plans a day
around. The distance ships with a field stating what it measures and that the
real river is longer. The ORDER, which is exact, carries the actual use.

A number you cannot stand behind is not improved by scaling it.

**163. A check can prove a card SAYS something and not that the answer is any
use.** Four assertions passed on the paddle card — it named what was above, what
was below, whether a dam sat between, and the distance caveat. The Mio Dam card
read "Above: Canoe access · about 0.0 mi" and "Below: Canoe access · about
0.0 mi", which is true, matches every assertion, and tells a paddler nothing.

A dam has an access on each bank and both project to the same river mile. The
checks tested for the presence of the rows, which is the shape of the answer,
not its content.

**Print the thing a person reads and read it.** One command showed what four
passing checks could not, and the assertions were right to keep — they stop the
rows disappearing. They just cannot tell you the rows are worth having.

**164. Nearest is not most useful.** "The next access downstream" sounds exact
until two of them sit at the same spot. The neighbour search now skips anything
within 0.06 mi, because a row naming a place you are already standing at is
worse than no row — it looks like an answer.

Where a feature picks "the next" of something, decide what distance makes two
things the same thing, and say what happens at zero.

**165. A harness that copies the tree must delete the copy.**
`smoke-fatal` copies `www/` to a temp directory to corrupt its manifest and prove
the app refuses a broken bundle. The copy includes 45 MB of imagery tiles and was
never removed. By take 103 there were **189 of them, 11 GB**, and the disk was at
100%.

What that looked like was not "no disk". It was
`net::ERR_INSUFFICIENT_RESOURCES` on a bundle fetch and a puppeteer crash —
reported by the gate as `render failed`. Landmine 101's corollary, arriving from
a direction nobody had watched: the drill that proves the app is safe was
quietly filling the machine.

Sweep before creating and remove on exit, both — a run that dies still has to
clean up, and the next run should not trust that the last one did.

**166. A check written against a temporary state will accuse the change that was
the goal.** `Tools shows one entry, not three diagnostics` asserted the bucket
held exactly ONE chip. That was true for four takes — because the bucket was
empty — and it failed the moment tools were put in it, which is what a bucket is
for.

What the check meant was "the diagnostics are behind one entry". Write the
invariant, not the current count. A count is a snapshot; an invariant survives
the feature landing.

**167. A bearing to where you are standing is not a bearing.** The compass listed
a waypoint saved at the current position as "N 0° · 0.00 mi · 49° left" — true,
consistent with every assertion, and noise. Under ~100 ft the row says "you are
here".

Second occurrence of landmine 164 in three takes, in unrelated code: the paddle
card and the compass both pick "the nearest thing" and both had to be told what
distance makes two things the same place. Any feature that names the nearest
anything needs a floor, and needs to say what happens at zero.

**168. When your number disagrees with one source, go and find a second.**
Take 102 found the corridor distances at 0.55x a local outfitter's published
table, assumed the geometry was generalised, and shipped an apology on every
card: "runs short of a real float".

Take 106 pulled the same river from USGS NHD — an independent federal survey —
expecting to fix ours. It agreed with OpenStreetMap **to within 4%**. Two surveys
do not both come out 45% wrong; the outfitter's mileages run high, and the app
had been apologising for the correct number.

One disagreement is ambiguous and says nothing about which side is wrong.
A second independent source resolves it, and costs a query. Landmine 144 said
two maps agreeing is worth more than either — this is the same rule when they
disagree.

**Corollary — a wrong apology is not the safe choice.** Hedging felt cautious and
it told a rider the good number was unreliable, which would have sent them back
to the source that was actually wrong.

**169. Calibrate on the consistent data, not on all of it.** The outfitter's long
floats imply 2.51, 2.54, 2.57 and 2.59 mph against our distances. Their short
ones give 1.50, 2.08 and 3.10 — booking figures rounded to convenient numbers.

Averaging everything would have produced a worse pace and a range wide enough to
be useless. Look at the spread before taking the mean, and when part of a dataset
disagrees with itself, find out why before letting it vote.

**170. The CI cache list is a copied set too.**
`ci/build.yml` named the payloads to cache one by one. By take 107 it had missed
three — poi, contour and corridor — and `osm_cache`, so every build
re-downloaded a 297 MB extract and re-ran a 285-second step for output it
already had. Nothing failed; it was just slow, which is why nobody noticed.

**Fifth occurrence** of the same shape: the palette (77), the CI dependency map
(84), the label layers (90), region.DERIVED (96), and this. Every one was fixed
by deriving instead of syncing, and every one was found by accident.

When a list names members of a set the code already has a rule for, it is not a
list — it is a bug that has not fired yet.

**171. Scan the structure, not the text.**
A check that the CI cache covers `*_payload.json` and `osm_cache` tested the
whole file, and the strings it looked for were **inside its own explanatory
comment**. Two of three negative controls passed on a cache list that had been
gutted.

Third time in this project (takes 96, 98, 107). The fix each time was the same:
parse the thing you mean — a function body, a heading's status field, a YAML
`path:` block — and strip comments before matching. A file is not a structure,
and a substring test on a file will eventually match the sentence explaining why
the test exists.

**172. "Slow" is a defect that reports nothing.**
The cache drift cost roughly five minutes and 297 MB per build and produced no
error, no warning and no failed check. It was found by an audit looking at
something else.

A correctness bug announces itself. A performance regression has to be measured
on purpose, so the things that are expensive need a number written down when
they are built — otherwise the only way to find the cost is to go looking for it.

**173. Wired is not reachable.** Every button in the app had a handler — the
cross-check found zero unwired. That says nothing about whether a rider can find
them. `I'm here` was correctly bound and sat in a different destination from
`Set home`, which is its other half: `syncArm()` sets both classNames in one
function while the two lived on separate tabs.

Check both, and check them differently. Wiring is a source cross-reference;
reachability means walking the UI and asking what is actually on screen.

**174. A guard can turn removed code into permanent dead code.**
`c-relief` and `c-labels` lost their chips at take 90. Their handlers survived
as `if(el('c-relief'))el('c-relief').addEventListener(...)` — the guard was added
so the removal would not throw, and it also guaranteed the block could never run
again.

Defensive guards are right when an element is OPTIONAL. When it is gone, the
guard is not defence, it is preservation: the code stays, reads as live wiring,
and the next person to grep for the handler finds one.
