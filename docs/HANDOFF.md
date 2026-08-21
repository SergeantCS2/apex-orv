# HANDOFF — through Take 63

Newest first. Written BEFORE the build ships, per PROTOCOL §6.
The gate refuses to build a take with no entry here.

## Take 63 — 2026-08-22 — Relief hidden, not faded

Jacob asked to confirm relief is off at open. It already was, as of take 62 —
verified by measurement rather than assertion: hillshade opacity 0, satellite
off, Labels the only chip on, plain sand map with blue trail, brown two-track,
grey roads and labels drawn.

But "opacity 0" is the wrong way to switch a raster layer off. **The tiles are
still uploaded and drawn every frame** — real GPU work for something invisible,
and relief is off by *default*, so that cost was being paid on every frame by
every user by default. Battery is the one thing about this app still unmeasured
(A18), which makes free GPU work worth removing.

`visibility: none` now, in `setBasemap`.

**And the toggle broke, which is the part worth recording.** The Relief chip has
its own handler that set opacity directly and never touched visibility — so
`setBasemap` hid the layer and the chip only faded it. Turning relief ON did
nothing at all: `visibility=none, opacity=0.42`. Two places controlling one
thing, changed in one place.

Both agree now. All four states measured:

| state | visibility | opacity |
|---|---|---|
| open | none | — |
| relief on | visible | 0.42 |
| satellite + relief | visible | 0.16 |
| relief off | none | — |

---

## Take 62 — 2026-08-22 — Opening state, and the road question answered with data

### "Did you fix this for the other roads as well?"

Checked rather than asserted. Across the whole graph:

| class | edges | road-named | drawn |
|---|---|---|---|
| track | 7,085 | 534 | warm brown — RIDE |
| fsroad | 4,494 | 4 | grey-tan — ROAD |
| minor | 4,134 | 3,398 | grey — ROAD |
| paved | 898 | 808 | dark grey — ROAD |
| trail50 / mccct / moto24 / route72 / fstrail | 3,211 | **0** | trail colours |

**No designated trail carries a road name, and all 9,526 road edges are grey
family.** The distinction holds everywhere, not just at Wagner Lake.

The 534 road-named tracks are the interesting case, and they are correct:
*Bull Gap Road, Keeley Road, River Loop Road, Stoney Ridge Road* — 90 distinct
names that are seasonal two-track in fact. Jacob's own words: "many roads up here
lead to trails." A road name does not mean maintained, and the source classifies
these as vehicular trail.

### Opening state

Only **Labels** is on now. Relief was on in the markup and is off. Basemap opens
on **Map** — satellite is something you choose, not something you land in.

### The map-detail button moved

Out of the horizontally scrolling chip strip, to a floating tile at top-left
**under the scale and elevation**, where every off-road app puts it. Orange when
satellite is active.

**It rendered at 0,0 first, and the cause is worth recording.** The CSS was
correct and the DOM was correct — but `setBasemap()` runs at load and rewrote
`className` to `'chip'`, discarding the positioning class entirely. Computed
style said `position: static`. I had replaced one of the two assignment sites and
missed the other because it was indented two spaces, not four — the same
indentation trap as landmines 65 and 75.

Asking the browser for the computed style found it in one step, after reading the
source twice had not.

---

## Take 61 — 2026-08-22 — Three tiers, not two

Jacob on take 59/60: "trails have color, but the trail color also bleeds into the
main roads like E Wagner. E Wagner is brown and the trails that run off it is
also brown."

His example proved the point better than he knew. In the data:

| name | class | drawn as |
|---|---|---|
| East Wagner Lake Road | minor | grey |
| **E. Wagner Lake Rd** | **fsroad** | **brown** |

The *same road*, split in the source between the county-maintained part and a
Forest Service segment. Take 58 painted `fsroad` and `track` the same brown, so
half of one road looked like trail.

They are not the same thing. **A Forest Service road is something you drive a
truck down; a two-track is something you ride.** Three tiers now:

- designated ORV line — green / blue / black, thickest, white casing
- **two-track** — warm brown `#A9702F` with its own casing
- **forest road** — muted grey-tan `#8A7C66`, thin, no casing
- paved and county road — grey

**The two-track then disappeared entirely**, and the reason is worth recording:
it shares the `net` source with designated trail, so it inherited the casing
tuned for a 3.2 px trail line. A 1.6 px brown line under a 6 px white halo reads
as a *cream* line. Two-track now has its own narrower casing and a slightly
wider stroke. In view at Wagner Lake: 18 designated · 37 two-track · 19 forest
road · 25 road, and all four are distinguishable.

### Attribution was covering a button

MapLibre's compact attribution renders **expanded** on first paint, and on a
411 px screen that bar lies across the chip strip. Collapsed on load and on idle;
the (i) still opens it, and the credits are in About too. 24 px wide now.

---

## Take 60 — 2026-08-22 — Why the rerun worked, and the trap under it

Jacob: "I reran the workflow manually and it did work, so that's weird."

Not weird — the **cache**. CI caches `aoi.json`, and `fetch_osm` returns
immediately when that file exists. His first run hit an Overpass outage, fell
back to TIGER, and failed the region check. The rerun restored a **good OSM
`aoi.json` from an earlier successful run**, so TIGER never ran and the bad data
never appeared. The cache was working in his favour.

But the same mechanism is a trap. If a TIGER-derived `aoi.json` is ever cached,
`fetch_osm` skips it forever: the region would be pinned to the road-only
fallback, with no water layer and none of the OSM path classes, and **nothing
would ever retry**. A single outage would silently degrade every future build.

`aoi.json` written by the fallback now carries `"source": "tiger"`, and
`fetch_osm` retries OSM when it sees that marker rather than settling. Verified
against the real code:

```
plain cache      -> osm: aoi.json present, skipping fetch
tiger-marked     -> osm: cached aoi.json came from the TIGER fallback —
                    retrying OSM before settling for it again
                    osm: overpass-api.de HTTPError 503
                    -> rebuilt from TIGER, clipped, 4556 elements
```

Overpass was genuinely down while testing, which made control 2 an end-to-end
proof rather than a simulation.

---

## Take 59 — 2026-08-22 — The gate refused my own bundle, correctly

CI, on the take-58 seed:

```
FAIL bundle neml-bullgap UNUSABLE: graph.json is not this region:
  579/18420 nodes outside bbox [-84.3, 44.42, -83.9, 44.72]
  (data spans -84.37,44.16 to -83.87,44.86)
```

Overpass was down again, so the TIGER fallback from take 56 ran — and my filter
there was wrong. It kept a **whole way** if any single point fell near the
region, so county roads trailed off to the county line. 44.16 to 44.86 against a
44.42-44.72 region: eighteen miles of overhang in each direction.

**Filter replaced with a clip.** Each run of consecutive in-box points becomes
its own way; a road that leaves the region and returns becomes two. Measured with
the gate's own tolerance (pad 0.05, limit 2%):

| | outside | verdict |
|---|---|---|
| CI, before | 579/18420 = **3.14%** | refused |
| TIGER, clipped | 2/18272 = **0.01%** | passes |
| OSM path, unchanged | 13/12177 = 0.11% | passes |

Reproduced the failure locally first by pointing every mirror at an invalid host
— the span came back 44.16-44.86 exactly as CI saw it — then fixed, then
re-measured both paths.

**The check that caught this was written at take 11** and has sat green ever
since. It exists because a bundle built for one region and shipped as another
would put a rider on the wrong map, and it refused a bundle I had just built and
would otherwise have shipped.

One correction to my own reporting mid-fix: I measured containment against the
*strict* bbox and reported 2,566 nodes outside, which looked worse than the
original failure. The gate allows ±0.05 and 2%; measured its way, it is 2.
The check was right and my probe was too strict.

---

## Take 58 — 2026-08-22 — Half the network was styled as "not for you"

Jacob: "a lot of trail colors are missing. Alot of trails I'd ride with my
dirtbike have no color." His two place cards proved the *data* was right —
"M-33 Bull Gap Trailhead · USFS · LEGAL · Moto open" and "Ogemaw Hills Route ·
DNR · LEGAL". The trails were there and known legal. They just did not look it.

### 1,169 of 2,246 miles

| class | miles | was styled |
|---|---|---|
| track (forest two-track, TIGER 4WD) | 784 | thin tan **dashes** |
| fsroad (USFS road) | 384 | thin grey **dashes** |

**52% of the network** — and it is exactly what a dirt bike rides. Drawn as grey
dashes it reads as "not for you". Both are now solid warm tan with a white
casing, thinner than designated trail so the hierarchy still reads: designated
ORV line in green/blue/black, ridable dirt in tan, actual roads muted grey.

### Routes were sending him down the highway

He also asked for routes to say whether they are fully approved. Adding that
composition line immediately exposed something worse than a display gap:

```
Fastest          9.3 mi   no designated trail · 0.8 forest road · 8.5 PAVED
Easiest          8.4 mi   no designated trail · 2.3 forest road · 6.1 paved
Pavement soonest 8.7 mi   no designated trail · 0.7 forest road · 7.9 paved
```

Every profile optimised for speed or ease, and pavement wins both. Return Home
was handing a man on a dirt bike eight and a half miles of highway.

**"Most trail" is now the first profile:** designated ORV line costs 0.55x,
forest road 1.3x, pavement 8x — expensive but never forbidden, because crossing
M-33 is inevitable and he said so. Result:

```
Most trail      11.1 mi   93% designated · 10.3 trail · 0.5 forest road · 0.3 paved
```

Two miles longer and it is the ride he wants. Six profiles now, and every card
carries **all designated trail / N% designated / no designated trail** so the
approval status is visible before committing.

**Not done:** an emergency profile that routes over non-ORV line. Pavement is
already never forbidden and "Pavement soonest" is the get-out — routing anyone
onto a hiking trail needs more thought than a cost multiplier.

---

## Take 57 — 2026-08-22 — CI built it, and the field report found three label bugs

**Take 56 was built by GitHub Actions, installed from a release, and passed
43/0 on the Fold.** The chain works: push, build, release, install. No more APKs
by hand.

The self-test then reported something I did not like:
`trail-names: 3 names for 85 trail segments`. My harness had claimed 8 for 66.

### The harness was measuring a screen that does not exist

`render.mjs` ran at **900x1400**; the Fold's cover screen is **411x960** — under
a third of the area. MapLibre places symbols against the viewport it has, so
every label-density figure I have quoted was optimistic. Set to 411x960 at dpr
2.625, the harness immediately reproduced the device: **4 names for 86
segments**, against Jacob's 3 for 85.

Swept the parameters at the real size rather than guessing: 75/100/pad2 → 4,
85/60/pad1 → 5, and with slightly smaller text → **6**. Past that it flattens.

### Then two bugs the sweep exposed

**Show-only labels outranked ridable ones.** `lbl-show` sat before `lbl-trail`,
and MapLibre gives earlier symbol layers collision priority — so a path Jacob may
NOT ride was named while the loop under his wheels was not. Moved after.

**Satellite hid every trail name.** `LBL` was forced to `none` in Satellite mode,
a rule from before labels had a dark halo, when dark-on-light was unreadable over
jack pine. They are white-on-halo since take 46 and survive it fine. Worse,
`lbl-show` was not in `LBL` — so on satellite the *only* names left were the
trails he may not ride: "Shore To Shore Trail" labelled, his own trail not.

Measured after: **Map 3 · Satellite 3 · Hybrid 3** ridable names, where Satellite
was 0.

---

## Take 56 — 2026-08-22 — checkout lands on the commit that triggered the run

```
bash: ci/bundle.sh: No such file or directory
```

`actions/checkout@v4` checks out **the commit that triggered the run**, not the
tip of the branch. The seed job pushes a new commit; every downstream job then
checked out the *old* SHA, where `ci/bundle.sh` genuinely does not exist. I had
assumed checkout follows the branch and never verified it.

Both downstream checkouts now pin `ref: ${{ github.ref_name }}`.

### The check I wrote for it passed vacuously

`check_checkout_ref()` reported green — because it scans `ci/` and
`.github/workflows/`, and **the generated `apex.yml` was in neither**. It is
written to the outputs directory for Jacob to paste; my repo had an empty
`.github/workflows/`. So every workflow check has been validating `ci/build.yml`,
which has no seed job, and reporting on a file nobody runs.

`tools/mkapex.py` now writes the repo copy as well. The gate sees 2 workflow
files instead of 1, and the negative control fires properly:
*"apex.yml:bundle needs a job that pushes, but checks out the triggering
commit."*

Landmine 54 for the ninth time, and the most expensive variant yet: not a check
that was wrong, a check that had **nothing to look at** and said so as though it
had looked.

### On the cadence

Six CI failures in six runs. Every one real, every one a property of the runner
invisible from inside my container — but the pattern is that I have been
*learning the platform by trial* rather than reading it. The honest fix is what I
did here: after finding the fault, ask what else in the same family I have
assumed, and gate it. Checkout semantics, per-job runners, per-job dependency
installs, workflow validity, absolute paths, vendored assets — six gate checks
now, all negative-controlled.

---

## Take 56 — 2026-08-22 — A volunteer service on the critical path

CI got further than ever — the workflow shim worked, the seed pushed, the bundle
job started — and then every Overpass mirror 503'd. `graph.py` correctly refused
to ship a bundle whose Return Home cannot reach a road, so a build that fetched
all 1,027 trails perfectly produced nothing.

The refusal was right. The dependency was wrong. **OSM is volunteer-run and it
was the single point of failure for the entire build.**

### Census TIGER roads as the fallback

TIGER is a US government CDN: no rate limit, no outage history worth planning
around, and I already parse its shapefiles for addresses and boundaries. It also
carries **MTFCC S1500, "Vehicular Trail (4WD)"** — 384 in Oscoda County alone,
which is precisely the two-track this app exists for.

`tiger_roads()` writes Overpass's element shape, so `graph.py` needs no special
case. OSM stays primary; TIGER is used only when every mirror fails.

Exercised by pointing every mirror at an invalid host:

```
osm: every mirror failed (URLError) — falling back to Census TIGER roads
tiger: 4100 road ways from 15708 features
  residential 3099 · service 567 · track 414 · primary 20
noded: 18619 nodes, 35115 edges
network 2856 mi total, 2850 mi (99.8%) routable together
```

A complete, routable graph with no OSM at all. Water is still skipped — that
layer is genuinely OSM-only — so the bundle reports PARTIAL and the app says so,
which is the designed behaviour.

### Also fixed: checkout landed on the wrong commit

`bash: ci/bundle.sh: No such file or directory`. `actions/checkout` defaults to
the commit that **triggered** the run; the seed job pushes a newer one, so every
downstream job was checking out a tree from before the seed. `ref:
${{ github.ref_name }}` on both. Landmine 85.

**My check for it passed vacuously** — `ci/build.yml` has no seed job, and the
generated `apex.yml` was not in the repo at all, so there was no workflow with a
pushing job to check. `mkapex.py` now writes the repo copy too, and the negative
control fails correctly.

---

## Take 55 — 2026-08-22 — The gate deadlocked the fix it was gating

My own take-54 check failed the seed job:

```
FAIL a job installs no Python deps it needs — each job is a fresh runner:
  apex.yml:seed runs python without ['pyyaml']
  apex.yml:bundle runs python without ['pyyaml']
  apex.yml:apk runs python without ['pillow']
```

The check was right about all three. But it exposed a design fault I had built in
and not noticed: **`gate.py` validates the workflow file, and the workflow file
is one Jacob pasted by hand that the seed job cannot update.** So a workflow one
version behind fails the gate, the gate fails the seed, and the seed is the thing
carrying the fix. A deadlock, with the fix on the wrong side of it.

Three changes:

**1. The workflow is a thin shim now.** Everything that can change moved into
`ci/bundle.sh` and `ci/apk.sh`, which live in the repo and *are* updated by
seeding. The bundle job went from eleven steps to six; the apk job from ten to
seven. Dependency lists, vendoring, render, gate — all in the scripts. The pasted
file should now almost never need re-pasting.

**2. `APEX_GATE_SEED=1`** skips workflow-file checks in the seed job. The
workflow there is the user's, not part of the seed, and gating the seed against
it is the deadlock. The seed still runs every other check.

**3. The seed job installs pyyaml**, because it runs `gate.py`.

Two knock-ons the move required: `check_ci_deps()` now follows `bash ci/*.sh`
into the script, or the deps look absent one level down; and every check that
greps "the workflow" for a command — CSP worker vendoring, `tools/android.py`,
the unpkg host — now reads `ci/*.sh` too, since that is where those commands went.

Simulated: a deliberately stale pasted workflow, a fresh seed zip, seed mode
gate. **51 files unpacked, GATE PASSED, no block.**

---

## Take 54 — 2026-08-21 — Each job is a fresh runner

The bundle job **passed** on the runner — ingest, graph, terrain, glyphs,
imagery, bundle, both smokes, render, gate. The first complete pipeline run on a
machine that is not mine.

Then the apk job died:

```
File "tools/icon.py", line 19, in <module>
    from PIL import Image, ImageDraw
ModuleNotFoundError: No module named 'PIL'
```

**Every job is a fresh runner.** The bundle job's `pip install pillow numpy scipy
pyyaml` does nothing for the apk job, which had no Python dependencies installed
at all. Added.

**My own check from take 53 missed it**, and that is the part worth recording. It
searched the whole workflow file for the package name, found `pillow` in the
bundle job's install line, and passed. Dependencies are **per job**.

`check_ci_deps()` is rewritten to work per job and to resolve imports
**transitively through local modules** — `android.py` imports `icon`, and
`icon.py` imports `PIL`, a chain no direct-import scan would have found. It also
understands that `tools/pipeline.py` pulls in every tool. Negative-controlled by
removing pillow from the apk job alone.

### Pages

`Failed to create deployment (status: 404)` — Pages was not enabled. Jacob has
since set Source to GitHub Actions. The job is `continue-on-error: true`, so it
never blocked the APK; it just looked alarming.

### Four environment faults, four CI runs

A font from my sandbox, a module path from my sandbox, a package that was already
installed here, and now a package installed in the wrong job. Every one invisible
from inside the machine that had it. The gate now covers paths, per-job
dependencies with transitive resolution, and vendored assets.

---

## Take 53 — 2026-08-21 — Stop finding these one CI run at a time

The runner hit the same font error, because the fix was in my take-52 seed and
Jacob's repo was still on take 51. Rather than just say "upload the new zip", I
went looking for what would break NEXT.

**`gate.py` imports `yaml`; CI installs `pillow numpy scipy`.** On the runner the
import would have failed, the workflow validator would have **silently
downgraded to a note**, and the check that exists specifically to catch invalid
workflows would have been absent on the one machine where a workflow is actually
parsed. It would have passed, greenly, doing nothing.

`pyyaml` added to the install line, and **`check_ci_deps()`** now walks every
`import` in `tools/`, subtracts the standard library and local modules, and fails
if the workflow does not install the rest. Negative-controlled by removing pyyaml
from the line.

That is three environment faults in three CI runs — a font from my sandbox, a
path from my sandbox, and a package I never had to install because it was already
there. All the same shape: **the build depended on my machine and I could not see
it from inside my machine.** There are now three gate checks in that family:
absolute paths, CI dependencies, and vendored assets.

---

## Take 52 — 2026-08-21 — The typeface only existed in my sandbox

The repo seeded, the workflow ran, and the pipeline got six steps deep on a real
GitHub runner — ingest 1,027 features, conflation, 20,133 edges, 110 DEM tiles,
98k ft of climb — then died:

```
OSError: cannot open resource
  tools/glyphs.py, ImageFont.truetype(font_path, SIZE)
```

`glyphs.py` loaded its typeface from
`/mnt/skills/examples/canvas-design/canvas-fonts/NationalPark-Bold.ttf` — a path
that exists **only inside my container**. Same fault as `emit_graph.py` importing
`/home/claude/pack.py` at take 45, and the same reasoning as the logo at take 30:
**a typeface is a source asset, not something to borrow from whatever happens to
be installed.**

`assets/fonts/NationalPark-Bold.ttf` is vendored (77 KB) and `glyphs.py` resolves
it relative to the repo. Identical output — 107 glyphs, 45.9 KB pbf — so no map
changes.

**`check_absolute_paths()`** now fails the gate on any tool referencing
`/mnt`, `/home`, `/opt`, `/usr` or `/Users`, excepting the publish directory.
Negative-controlled by putting the old path back.

Full pipeline clean in 105 s afterwards, all five smoke modes and the render
green.

### What the first real CI run taught

Nothing local could have caught this. Every check ran in the container that had
the font. The runner is the first machine that did not — and it found the last
two hand-dependencies in four minutes. Landmine 81 is really landmine 32
restated: **if a build needs it, it belongs in the repo.**

---

## Take 51 — 2026-08-21 — The seeder tried to overwrite the workflow running it

First real CI run. The seed job worked — unpacked the zip, flattened the nested
shape, gated clean at take 49, committed 48 files — and died on the last line:

```
! [remote rejected] main -> main (refusing to allow a GitHub App to create or
  update workflow .github/workflows/apex.yml without `workflows` permission)
```

Landmine 46, from the other side. I had recorded that GITHUB_TOKEN cannot write
`.github/workflows` and built the whole one-file installer around it — then
handed Jacob a zip containing `.github/workflows/`, so the seeder tried to
overwrite **the workflow that was running it**.

Nothing was pushed. The repo stayed clean, which is what the gate-before-commit
ordering is for.

Two faults, not one:

1. **The seed copied `.github/`.** It now deletes that directory from the
   unpacked tree before copying. Whatever the user pasted is theirs and is never
   touched.
2. **`build.yml` would have been a second workflow running the same build.**
   `apex.yml` already contains every job it has, plus seed — so every push would
   have built twice.

**The canonical build definition moved to `ci/build.yml`**, where GitHub does not
execute it. `tools/mkapex.py` generates `.github/workflows/apex.yml` from it, and
that generated file is the only workflow in the repo. `scan_hosts()` and the
workflow validator both read `ci/` as well, or a declared host looks unreached.

Simulated against a repo with a pasted `apex.yml`: the file survived byte for
byte, no `build.yml` appeared, and 47 files landed.

---

## Take 50 — 2026-08-21 — CI had never been valid

GitHub rejected the workflow: *"(Line: 49, Col: 1): 'concurrency' is already
defined."* Tracing it found something worse than a bad splice.

**`build.yml` has carried TWO `concurrency:` blocks since take 20.** GitHub
rejects such a file outright — which means **the CI workflow has never been
valid and could never have run.** Every check we have was local; the one thing
that would have caught it is the one thing we never did, which is let GitHub
parse it.

It survived thirty takes because **PyYAML's `safe_load` silently keeps the last
of duplicate keys**. `yaml.safe_load(...)` returned a clean dict, the gate said
fine, and I validated the generated `apex.yml` the same way — so my validator
passed a file GitHub refuses.

### Fixes

- **The duplicate is gone**, `cancel-in-progress: true` kept.
- **`check_workflow_yaml()`** loads every workflow with a constructor that
  *raises* on a duplicate key, and requires a `jobs` block. Negative-controlled.
- **`tools/mkapex.py`** generates `apex.yml` from `build.yml` instead of my
  splicing it by hand each time — takes the header verbatim so a second
  `concurrency` cannot appear, injects the seed job, asserts the job list and
  the `needs`, and strict-validates before writing.

My splice had also mangled the header: the seed job ended up nested under
build.yml's own `jobs:` with the whole build header duplicated above it. Hand
splicing was the wrong technique; generation with assertions is the right one.

**Landmine 79.** A permissive parser is not a validator. `safe_load` answers
"can I read this", not "will the consumer accept it" — and the gap between those
two questions hid an invalid workflow for thirty takes.

---

## Take 49 — 2026-08-21 — Two workflow bugs, one of them mine

Jacob pasted `apex.yml` back into the chat. Auditing it instead of glancing at
it found two failures, both of which would have hit on his first CI run.

### The release would have published with no APK

`${{ steps.pkg.outputs.apk }}` appeared twice in the apk job — as the
upload-artifact path and as the asset argument to `gh release create`. **No step
declared `id: pkg`.** The step was `id: take` and only ever wrote `take`.

GitHub does not error on an unresolved step reference; it substitutes an **empty
string**. So `upload-artifact` would get no path and the release would be created
with no asset — and nothing in the log would say why. Pre-existing in
`build.yml`, and it survived because CI has never actually run this repo.

Fixed: the step is `id: pkg`, writes `apk=` to `$GITHUB_OUTPUT`, and the file is
named `apex-orv-take-N.apk` — it had still been `apex-offroad-` since the rename
at take 38.

### My generator dropped the env block

Building `apex.yml` I sliced `build.yml` at `jobs:` and prepended a header. That
threw away the **top-level `env:`** — `APEX_REGION` and `TILES_KEY`. With
`$APEX_REGION` empty the bundle job dies on `cp bundles//manifest.json`.

The generator now preserves everything between `name:` and `jobs:` verbatim and
**asserts** that no top-level key was lost and that `env` survived. Same lesson
as landmine 65: a transformation that silently drops content is worse than one
that fails.

### The durable fix

`check_workflow_refs()` — every `steps.X.outputs.Y` must correspond to a step
declaring `id: X`. Negative-controlled: renaming `id: pkg` fails the gate.

It false-positived first, of course: the regex required `id:` at line start and
missed the `- id: deploy` form, reporting a broken reference on a healthy
workflow. And its second check — "does the step write that output" — is
unknowable for third-party actions, which declare their own (`deploy-pages`
emits `page_url`). Dropped that half; kept the half that is both checkable and
the half that silently broke. Landmine 54, ninth time.

---

## Take 49 — 2026-08-21 — Make the wrong choice work, and the failure legible

Jacob got the repo created, pasted a workflow, uploaded a zip, and got a Node
error that told him nothing. Three separate causes, all mine.

1. **He pasted an older `build.yml`**, not the `apex.yml` I had just shipped.
   That old copy has the `steps.pkg.outputs.apk` bug — a step with `id: take`
   whose output is read as `steps.pkg.outputs.apk`, which resolves to empty, so
   `upload-artifact` and `gh release create` both get a blank path. Already
   fixed in the repo; the stale paste reintroduced it.

2. **He uploaded `apex-orv-github-repo.zip`**, not `apex-seed.zip`. Entirely
   reasonable — it is the one whose name says "repo". The seed job looked for
   one filename, found nothing, said "going straight to the build", and the
   build then failed deep inside Node with no reference to the real problem.

3. **Nothing checked that the repo contained the project** before spending ten
   minutes trying to build it.

### Fixes

**The seed accepts either zip and flattens the nested one.**
`apex-orv-github-repo.zip` nests everything under `apex-orv/`; the plain seed
does not. Both now land correctly at the root. A reasonable wrong choice should
work, not punish.

**The bundle job checks for source first** — `BUILD`, `tools/pipeline.py`,
`src/app.html`, `regions.json`, `package.json` — and if any are missing prints
what is actually at the root and names the file to upload. It fails in seconds
instead of two hundred lines into npm.

Simulated all three cases against real directories by extracting the scripts
verbatim from `apex.yml`: correct zip → take 49 unpacked and gated; wrong zip →
flattened, unpacked, gated; empty repo → explicit error naming the missing files
and the right zip.

**Landmine 78.** An error a user cannot act on is not an error message. The Node
stack trace was technically accurate and completely useless: the actual fault was
four steps earlier and in a different language.

---

## Take 48 — 2026-08-21 — One file, one zip, one button

Jacob, trying to get the repo onto GitHub from a phone: "There has got to be an
easier way. I don't want to be creating and editing files, I want to drop it
into my GitHub." He was right and I had over-complicated it.

The two constraints are real — GitHub's mobile web UI cannot create folders from
an upload, and `GITHUB_TOKEN` cannot write `.github/workflows` (landmines 42,
46) — but the conclusion I drew from them was wrong. I had him pasting **two**
workflow files and cutting a release.

**The installer does not need to WRITE the build. It can BE the build.**
`apex.yml` merges the seed job in front of bundle/pages/apk. So:

1. Actions → paste `apex.yml` (one file — the Actions tab prefills the path)
2. Add file → Upload files → drop `apex-seed.zip` at the root (one file, no
   structure required, which is exactly what mobile CAN do)
3. Run

The seed job unzips, gates **before** committing so a bad seed cannot
half-populate the repo, pushes, and the build runs on in the same workflow. Every
run afterwards skips straight past it. No release, no second file, no folders.

### The simulation earned its keep immediately

Running the seed script verbatim against an empty directory holding only the zip
showed `GATE FAILED (3)`: the gate read the hardcoded filename
`.github/workflows/build.yml`, found nothing in the single-file layout, and
failed three checks on a perfectly good seed — which would have blocked Jacob's
very first run. It now concatenates **every** workflow file it finds. Both
layouts gate green.

I would not have caught that by reasoning about it; I caught it by running the
job's own script against an empty folder.

---

## Take 47 — 2026-08-21 — Coverage reconciled against the agencies, exactly

Before Jacob rides it for real: prove nothing ORV is missing, and that nothing
ridable is drawn as un-ridable.

### State — exact match

DNR layer 19 is the master layer, one row per trail with a flag for every use.
Everything it flags ORV Route / ATV Trail / Motorcycle in this region: **199**.
Our ingest, reconciled:

| ours | count |
|---|---|
| route72 | 14 |
| trail50 | 148 |
| moto24 | 25 |
| closed (temporarily) | 12 |
| **total** | **199** |

**199 = 199.** And the 12 we reclassify as closed match layer 19's own
`OpenClosedStatusORV = Temporarily Closed` count exactly — 187 open, 12 closed.
MCCCT (47) is a separate designation and is additional.

### Federal — exact match

MVUM roads **366 = 342 ridable + 24** with no motorcycle or ATV legality, which
is precisely why those 24 are `fsclosed` and unroutable. MVUM trails **46**, all
46 motorcycle-legal, all ingested.

### The real find: multi-use trail drawn twice

A trail can be designated for several uses at once and the DNR publishes it in
every matching layer — **"LP 9" is a motorcycle trail AND a hiking trail AND an
equestrian trail**. Drawn naively that put a grey dashed *"not ridable"* line
directly on top of a trail Jacob may legally ride.

That is worse than useless: it tells him to stay off something he is allowed on.
**70 show-only copies of ridable trails are now dropped — the ridable
designation wins.** Show-only went 767 → 697. Overlap between routing classes and
show-only classes remains NONE.

---

## Take 46 — 2026-08-21 — Difficulty colours, and the map gets the screen

Jacob, with onX and AllTrails screenshots: "feels like a barebones test / cheap
clone." Fair. Two things were doing that.

### The trails were coloured by taxonomy, not difficulty

Green for ORV routes, black for ATV trails, orange for motorcycle, purple for
MCCCT — a legend of *which agency drew the line*. What a rider needs is what the
line will DO to them, which is why every trail map on earth uses green / blue /
black. Now:

| tier | classes | colour |
|---|---|---|
| easy | route72 (72" ORV route) | green `#2F7D4F` |
| moderate | trail50, fstrail | blue `#1F6FB2` |
| difficult | moto24, mccct | near-black `#17150F` |

Roads dropped back to muted greys so trail reads first.

### The white casing was switched off on the default map

`casing` — the white halo under every trail — existed but was bound to satellite
mode, so on the sand basemap trails had no separation from the road network at
all. It is unconditional now, and it is the single change that makes a coloured
network legible over jack pine. Verified: casing paints 126 features where
trail50 paints 126.

Labels went white-on-dark-halo and up 1–2 px. Dark-on-light survives sand and
dies on satellite; white-on-halo survives both.

### The first thing on screen was a build console

A title bar with `NET —` and `GRAPH —` badges, and a `Frames/s` stat cell. None
of that is navigation. The bar is hidden (kept in the DOM so every diagnostic
that writes to it still works, and the self-test still reads it), `Frames/s`
became **Elevation**, and the map now owns the top of the screen.

Added what was missing instead: a **scale bar** and a floating **elevation
readout**, the way onX places them. Without a scale a rider cannot tell whether a
gap is 200 yards or two miles — which is exactly the judgement that decides
whether to push through.

### Two probes lied to me before the map did

- Querying `moto24`, `mccct`, `route72` at Bull Gap returned **0 painted** and I
  nearly went hunting for a filter bug. They cluster around −84.20, not −84.09;
  jumping onto a real segment showed all four painting fine. Landmine 54.
- Three separate patches silently no-matched on indentation before I stopped
  guessing and printed the bytes with `cat -A`. The asserts caught every one.

---

## Take 45 — 2026-08-21 — Every route in the area, and the guards that keep it honest

Jacob: "ensure no off-road trails are missed, even hiking trails or obscure
ones — I need to know every route available." Rebuilt from the take-44 seed
after the container died, then went looking. **648 → 1,027 routes.**

### The DNR FeatureServer was withholding 36 features

`DNRTrailsOPENDATA/FeatureServer` silently returns FEWER features than
`/MapServer` for an identical query. Measured twice, on two different days, in
both GeoJSON and Esri JSON:

| layer | FeatureServer | MapServer |
|---|---|---|
| ORV Trails | 153 | **159** |
| Motorcycle | 23 | **25** |
| MCCCT | 45 | **47** |
| Hiking | 13 | **24** |
| Skiing | 0 | **10** |
| Snowmobile | 97 | **101** |

`returnCountOnly` reports the MapServer totals from **both** endpoints, so the
data exists on both and the FeatureServer drops it on the way out. **Six ORV
trails and two motorcycle trails were missing from every build for forty takes.**
One word of URL.

The fix that matters more is the guard: `query()` now asks the server how many
features match and prints `!! layer N: server reports X, got Y — Z MISSING`
whenever the payload is short. "Did I get everything?" is not a question to leave
unasked on a map someone navigates by. Landmine 72.

### Everything that exists, including what he may not ride

Ten non-ORV DNR layers (hiking, biking, equestrian, skiing, snowshoe, Iron Belle,
hunter walking, MOU, snowmobile, railtrail) plus the full USFS NFS trail set —
and the OSM classes that were being **fetched and silently dropped**:
`path`, `footway`, `bridleway`, `cycleway`, `raceway` had no entry in graph.py's
CLS map. `service` was not even requested. In jack-pine country a lot of real
connecting two-track is tagged `highway=path`.

Result: routing network **16,440 → 20,133 edges**, 2,114 → **2,246 mi**,
connectivity 99.4% → **99.9%**, plus a **767-route show-only payload** (227 KB).

### The invariant, not another list

Non-ORV routes must never enter the routing graph. The obvious implementation —
maintain `SHOW_ONLY` beside `CLS` and remember to update both — is exactly the
shape of mistake that ships a footpath as a dirt-bike route. So the gate checks
the **built data**, not the source:

> every class in the routing graph must be ridable by some machine or explicitly
> closed, and nothing show-only may also be ridable.

Verified: graph holds `closed fsclosed fsroad fstrail mccct minor moto24 paved
route72 track trail50`; show-only holds `foot horse nfsmoto snow snowmob`;
**overlap NONE**. Negative control: injecting `foot` into the graph's class list
fails the gate with "a rider could be routed onto one".

Tapping a dashed show-only line now says what it is and that routing will never
use it. Seeing a trail and being allowed to ride it stay separate facts.

### Three more, found by the audit and the clean run

- **The APK said Take 44 inside** while BUILD said 45: `www/` was rebuilt before
  the bump and `cap sync` copied it verbatim. The gate compared `src/` to BUILD
  and passed it. It now compares the BUILT stamp in `www/index.html`, negative-
  controlled in all three states. Landmine 75.
- **An empty `aoi.json` built a road-less bundle.** `overpass.osm.ch` answers 200
  with zero elements; the guard checked the file EXISTED. A clean run produced
  **3,621 edges instead of 20,133** — trails only, no roads, silent. Empty is now
  a failure in the fetcher (falls through to the next mirror) and in the graph.
  Landmine 74.
- **My own audit regex matched body text** ("DONE take 9") and reported stale doc
  stamps on a current tree. The gate's own check was right all along.

### Two more failures a fresh container exposed

- **`emit_graph.py` imported `/home/claude/pack.py`** — an absolute path outside
  the repo that only ever worked because a stray copy sat there. A fresh
  container has no such file and the pipeline died at step four. Landmine 32
  wearing an import.
- **Overpass 503'd through two builds.** Mirrors serve the same database, so
  `ingest.py` now tries three in turn. A single volunteer endpoint should not
  stop a map someone rides with.

---

## Take 44 — 2026-08-21 — Trail names, from almost none to eight

Jacob's self-test had been quietly reporting `labels 1 at z13.6` for several
takes and I had read past it. Knowing WHICH trail you are on is the point of a
trail map, so this was a real gap hiding in plain sight.

**The data was never the problem: 100% of trail edges carry a label.** Two
separate causes suppressed them.

**1. Routing edges are too short to host a line label.** The graph is split for
routing — median edge **76 m**, and **76% under the 230 px symbol spacing** — and
each edge was its own GeoJSON feature. MapLibre places line labels along a
feature; a feature shorter than the text cannot carry one. `chainStrokes()` now
walks the graph and joins consecutive edges sharing a label into maximal
strokes: **16,440 edges → 1,240 strokes**, longest 213 points. Label layers read
from those; routing and rendering still use the edges.

**2. `text-max-angle:32` placed literally zero labels.** ORV trails bend far
more than 32 degrees inside the width of a name, and MapLibre rejects such
placements outright. Measured sweep at z14.5 over 29 candidate strokes:

| max-angle | spacing | labels placed |
|---|---|---|
| 32 | 230 | **0** |
| 60 | 230 | 3 |
| 60 | 120 | 4 |
| 85 | 90 | 5 |

Settled on **75 / 100** — most of the gain without text wrapping round hairpins.
`line-center` was tested and is worse (1-5). Two road label layers had the same
too-strict angle and were relaxed with them.

**Result at Bull Gap z14.5: 8 names for 66 trail segments**, reading
*MAT · H57-18*, *Bull Gap Hill Climb · 4276*. Before: zero.

### And my check was wrong before the map was

The new self-test check reported "0 names for 62 segments" while `render.mjs`
reported 8 on the same build. Labels are placed **asynchronously**, and the
self-test jumped and queried in the same tick. Moved into the async chain with a
1.8 s settle. Landmine 54 — verify the check before believing it — for the
seventh time, and the reason render.mjs and the self-test measuring the same
thing is worth the duplication.

---

## Take 43 — 2026-08-21 — Full audit. Two features had been shipping invisibly

A checkpoint audit across everything since take 29. Identity, shipped bytes,
feature presence, negative controls, delivery chain, the clean run PROTOCOL §6b
required, and doc coherence. Five real defects, one of them serious.

### 1. Two features drew nothing, for eight takes

`alt` (dimmed alternates, take 35) and `approach` (dashed off-network legs, take
39) had sources created and fed correct geometry — and **no layer to draw
them**. Both patches anchored on `'route-line'`; the layer is called
`'routeline'`. They silently no-matched.

Every check written for them measured `setData` — the DATA, not the DRAWING —
so take 35 reported "alternate lines drawn: 272" and take 39 reported "two legs,
0.49 and 0.06 mi", both true and both about data nothing rendered. Worse, the
alternates were themselves the *fix* for Jacob's "the line doesn't update"
report, so that fix never actually reached him.

Now: both layers exist and render (**66 alternates, 2 approach legs** measured),
`check_orphan_sources()` fails the gate on any source no layer references,
`render.mjs` asserts `queryRenderedFeatures` per layer, and a dead `pins` source
left over from an earlier design is gone. Landmine 69.

### 2. My own check had a false positive, and I caught it before acting

The orphan-source check first flagged `sat` as a ghost — it is declared with a
ternary (`sat:TILES?{...}:{...}`) which my regex missed. Verified the check
before believing it, for once (landmine 54).

### 3. The clean run — which I owed under §6b — found two more

Three pipeline steps had been added (`context`, `address`, rewritten `imagery`)
with no clean run. Doing one found:
- **An Overpass 503 killed the entire build**, after DNR and USFS had already
  fetched fine. Water is optional and now degrades to PARTIAL; the ROAD network
  is not, and now refuses with a clear message rather than shipping a bundle
  whose Return Home cannot reach a town. Landmine 70.
- **`render.mjs` died at import** on a checkout with no `node_modules`. It says
  "run `npm ci` first" and skips.

The clean run then completed in **14 s warm**, COMPLETE bundle, all five smoke
modes green — and reproduced the missing-layer defect exactly, which is
independent confirmation it shipped.

### 4. My guard didn't land, in the audit written to catch that

The `graph.py` refusal was inserted with two spaces of indent against
module-level code. No assert, so it silently no-matched — landmine 65, in this
audit. Reapplied with an assert and verified.

### 5. Documentation had drifted

Landmine **57** held two different lessons under one number, **62** was the same
lesson written twice, and handoff takes **29** and **37** each appeared twice
(interrupted turns). Deduped: 42 handoff entries, 70 landmines, no gaps, no
duplicates, stamps agree.

**Everything else was clean:** cert continuity, take coherence across BUILD /
src / APK / seed / handoff, all five negative controls biting, seed ⇄ repo
byte-identical, bootstrap simulation exact.

---

## Take 42 — 2026-08-21 — Satellite imagery, 6.5x sharper

Jacob: "I can almost count the pixels. I only use it without the map due to
this." Measured before changing anything: the shipped mosaic was **22.1 m/px**.
A two-track is about one metre wide. He was right to stop using it.

**The pipeline was throwing away most of what it downloaded.** It fetched native
z14 tiles (6.8 m/px, 4864x5119 px) and squashed the whole AOI into a single
1500 px JPEG for size — a 3.2x loss on top of an already-coarse zoom.

**Now it ships real tiles**, so MapLibre fetches only what is on screen. That
bounds MEMORY rather than disk, which is what makes higher zoom possible at all:
a z15 mosaic would be 9728 px and would not fit in a texture, but z15 *tiles*
are fine. Measured at 21.3 KB/tile before committing to a level:

| through | size | m/px | what you can see |
|---|---|---|---|
| z14 | 11 MB | 6.81 | two-tracks |
| **z15** | **45 MB** | **3.40** | **individual trails** |
| z16 | 158 MB | 1.70 | ruts and tree lines |

z15 chosen: **2,008 tiles, 45.2 MB, 3.40 m/px** — 6.5x finer than before, for an
APK that goes 5.2 MB → **51 MB**. That is a fair trade for a sideloaded offline
map, and `imagery_max_zoom` in regions.json makes it per-region if a smaller or
sharper region is ever wanted.

The single-file browser build keeps the 1500 px mosaic as a fallback — it cannot
carry 2,000 files — and the app picks tiles when the bundle has them. Both paths
render-verified.

The self-test now reports ground resolution, so the thing Jacob complained about
is a number in his own report rather than an opinion: `imagery tiles z12-z15 ·
3.40 m/px · 2008 tiles, 45 MB`.

Verified from the shipped APK: 2,008 tiles packaged, extracted, and rendered.

---

## Take 41 — 2026-08-21 — The ride measures itself (A18 Stage 1 instrumentation)

Stage 1 is the standing blocker and only a real ride can close it: battery cost
with the screen held on, and GPS quality under jack pine. Neither is measurable
from a container, and "it felt fine" is not a measurement. So the ride now
measures itself.

**Recorded from the moment ▶ Ride it starts**, entirely locally — battery from
the Capacitor Device plugin (falling back to `navigator.getBattery`), fix timing
from the watch already running:

- fix count and median gap between fixes
- **dropouts** — any gap over 15 s, checked every 20 s, with the worst gap kept
- median horizontal accuracy, which is the canopy question
- battery used, and %/hour with the screen held on

Stopping the ride produces a **ride report** with Copy and Share, and the last
ride rides along in the self-test report — so one share covers both.

### The estimate that would have lied

A first pass reported "37 hours from full" off a 90-minute synthetic sample.
The arithmetic was right and the number was nonsense: **Android reports battery
in 1% steps**, so a ten-minute ride can show 0% or 1% and extrapolate to
anything between "forever" and "two hours". A rate is now quoted only from a
sample that can support one — **20 minutes and at least 2% moved** — and
otherwise the report says *"too short to quote a rate"* rather than going quiet.

Verified both ways in a real browser: an 8-minute ride refuses to quote; a
95-minute ride gives **17.7%/hour → 5.7 hours from full**, with a 40 s dropout
counted and ±9 m median accuracy tracked.

Battery is sampled every third pulse (60 s) while the dropout watch runs every
20 s — the dropout needs to be prompt, the battery does not.

**What this changes:** one ride now closes the parts of A18 that are
measurable. What it cannot close — sunlight legibility, glove operation, the
fold seam — stays open and stays honest.

---

## Take 40 — 2026-08-21 — Loops. The third of plan / ride / improvise

A28 was the honest gap: point-to-point routing cannot express "a ride that ends
where it starts" — the shortest path from a node to itself is nothing.

**Method.** Three waypoints on a circle around the start, routed through in
turn, with already-used edges made six times more expensive so the return leg
does not retrace the outbound. Circumference C = 2*pi*r, so a target of T miles
wants r = T/(2*pi).

**One radius guess is never right.** A single cut came back **33–126% long** —
trail does not run in circles, and a trail-hungry cost wanders further than a
fast one. Distance is near-proportional to radius, so scale and retry: four
passes lands inside a few percent. Measured across six targets from a real start
node:

| target | fastest | most trail |
|---|---|---|
| 6 mi | 6.3 (±6%) | 6.7 (±11%), 96% trail |
| 15 mi | 14.0 (±7%) | 16.0 (±7%), **100% trail** |
| 20 mi | 20.4 (±2%) | 19.7 (±1%), 95% trail |
| 40 mi | 40.7 (±2%) | 41.9 (±5%), 91% trail |

**0–3% ridden twice** across every target — these are genuine circuits, not
out-and-backs. 62–129 ms to build. The one weak case is a 30 mi *fastest* loop
(24% short): this network cannot make a fast 30 mi circuit without pavement, and
that is the data speaking.

Two shapes are offered — **fastest** and **most trail** — and they become
ordinary route options, so the cards, elevation profiles, fuel and dark
warnings, dashed approach legs and dimmed alternates all work with no new UI.
`◯ Loop` offers 6/10/15/20/30/40 mi.

### Landmine 38 caught me again, and my own edit hid it

I wrote three call sites for `presentRoutes()` and the definition **silently
never landed** — a replacement that no-matched and which I did not re-grep. The
first tap threw `presentRoutes is not defined`, and a second botched edit then
ate the `},30)}` closing `routeToPoint`. Both were found by driving the real UI
in a browser rather than by reading the diff. Verified after: 116 route features,
265 points, a closed circuit from Bull Gap.

Loops are asserted in both harnesses — smoke checks the builder lands within 30%
and under 40% repeat, and the on-device self-test reports actual loop quality so
Jacob's phone tells me how it behaves on his data.

---

## Take 39 — 2026-08-21 — The route was right; the drawing was not

**The action log earned itself on its first field report.** Jacob said two pins
"didn't seem to connect or find a proper path". The trace gave me the exact
inputs:

```
  28.1s  pin  dropped at 44.53949,-84.12855
  30.8s  act  start from here
  33.8s  pin  dropped at 44.55265,-84.10724
  45.8s  route 5 options, best 2.2 mi
```

Straight line between them is 1.39 mi; 2.2 mi over trails is entirely sane. The
routing was never wrong. What was wrong: the cards have always **said**
"+0.5 mi off-network to the pins" while the line silently began at the nearest
graph node — so a pin in the trees produced a route that appeared to start
nowhere near it.

**The gap is drawn now**, dashed, in the route colour, from the pin to where the
network actually starts. Reproduced with his exact coordinates: two legs of
**0.49 mi and 0.06 mi** — precisely the 0.5 mi the card was claiming. The card
wording changed to "+0.5 mi off-network (dashed) to reach the trail" and is a
warning rather than a footnote, because half a mile of pushing a bike is a
planning fact.

`fitBounds` now includes those legs, and clears the chip strip that floats over
the bottom of the map — 40 px of padding had been putting the end of a route
underneath it.

### The self-test hid its own best evidence

His GPS section reported only `XX first-fix — no fix in 20s`, while the action
log showed a startup fix at **2.7 s**. The report dropped `startup-locate`,
`position` and `mode-correct` whenever its own 20-second watch timed out —
losing the informative lines exactly when the live watch failed. Those now report
from the app's actual state either way, and "no fix in this watch" is
distinguished from "no position at all".

---

## Take 38 — 2026-08-21 — Renamed to APEX ORV

Straightforward, with one trap worth recording.

**`strings.xml` is written once by `cap add android` and never revisited by
`cap sync`.** Changing `appName` in `capacitor.config.json` renames the app in
the config, the release title, the About card and the browser tab — and leaves
the launcher label untouched. That is the one place the rider actually reads the
name. `tools/android.py` now patches `app_name` and `title_activity_main`
directly, idempotently, so the rename survives a fresh `cap add` or an existing
android/ tree either way.

Renamed: window title, header, About card, the loader's fatal screen, the GitHub
release title, ROADMAP, and the Android launcher label. Verified out of the built
APK with `aapt2 dump badging`.

**Deliberately NOT renamed: the signing certificate.** It reads
`CN=APEX Off-road` and must keep reading that — it is what every installed build
is signed against, and the committed keystore is what makes take N install over
take N-1. The `-dname` in `android.py` only applies if the keystore is
regenerated, which would break update continuity regardless (AGENDA A21). Noted
in place so a future reader does not "tidy" it.

---

## Take 37 — 2026-08-21 — Process, not features

Jacob asked what could be improved given that he cannot help with APK work. The
honest bottleneck is not his skill: **three of his last four reports were
interaction bugs my tests structurally could not see**, and several times my
harness either hid a real bug or invented a fake one. Three fixes, aimed there.

### 1. The stubs are now checked against the app

Six times a stub has omitted a method the app calls. Twice it **hid** a feature
(marker taps, take 33), four times it **invented** a failure the app did not have
(`getElement`, `scrollIntoView`, `getContainer`, the two `queryRenderedFeatures`
contracts). Every one was found by a person tapping a phone — the most expensive
way to find anything.

`check_stubs()` is static and free: it extracts every `map.X()`, marker method
and DOM method the shipped `app.js` calls and fails if the harness does not
implement it. On its first run it found **eight genuine gaps** —
`getCanvas`, `getLayoutProperty`, `isStyleLoaded`, `jumpTo`, `setBearing`,
`El.click`, `El.remove`, `El.select` — all in the self-test path, which smoke
had never exercised. Filling them meant **smoke can now run the app's own
self-test too**, so a regression there is caught by whichever harness runs first.

Smoke judges only what a stub can judge: render and perf failures are expected
and isolated, everything else must pass.

### 2. Layout checks that run on his phone

The class that keeps biting is layout, and no data check sees it. The self-test
now measures the rendered page at his width: nothing wider than the screen (the
take-35 bug exactly), every horizontal scroller within the screen, tap targets,
primary actions on screen, and the map keeping most of the height.

It immediately found a real one: **chips were 31 px tall**. For gloves on a
moving bike that is too small — now 38 px minimum.

It also produced two false positives of its own, both fixed rather than
tolerated: a row that simply *fits* is not a row that *cannot scroll*, and a
hidden panel legitimately has no width.

### 3. An action log in the report

Prose loses order and state. The report now carries the last 25 actions with
timestamps — taps, pins dropped and removed, GPS fixes, routes computed — so
"I clicked start from here, then tried to drop another pin" becomes a trace.
It stays on the phone unless he shares it.

### And I broke something mid-take

Removing a duplicated `stLayout` — I had defined it twice — my slice also
deleted `stData` between them. Caught by the render harness immediately
(`stData is not defined`), recovered from the saved block. A surgical edit
across two anchors must check what lies between them.

---

## Take 36 — 2026-08-21 — Long press to pin, and a pin that knows when it is done

Two reports, one root cause: **tap was doing too many jobs.** It identified a
trail, and on open ground it also dropped a pin — so a pin could never be placed
*on* a road, and the two meanings fought.

**Long press drops a pin now; tap always identifies.** Own implementation rather
than the browser's `contextmenu`, which is inconsistent in a WebView and cannot
be tuned: 450 ms with a 12 px tolerance — long enough not to fire while panning,
short enough to feel deliberate with gloves — and a buzz on fire, because a
gesture with no feedback feels broken. Right-click does the same on desktop.

Verified with real CDP touch at 411x960: a **700 ms hold** on a spot with six
features under it drops a pin at Bull Gap (1070 ft); an **80 ms tap** at the
same point identifies instead.

### The pin that "wiped out" the first one

Tapping **Start from here** moved ME to the pin — and left the pin sitting on
top of the new ◎ marker. The next pin then appeared to erase the first, when in
truth the first had already done its job and become the start. A pin consumed by
an action is now removed, the message says which marker holds the spot, and drop
cards gained **✕ Remove pin**.

### My probe was wrong before the code was

The first touch test reported both gestures dead. `getCanvasContainer()` is a
**zero-height** wrapper around absolutely-positioned children, so computing a
press point from its rect aimed at y=38 — up in the chip strip, not the map.
Landmine 54 for the sixth time: verify the check before believing it. It did
surface a real fragility though — `lpAt()` now measures `getContainer()`, which
is what `unproject()` is defined against and actually has a height.

### From the field report

Take 34 self-test: **36 pass, 0 fail**, and the frame-time detail added at take
32 closed an open question — `0/70 frames over 33 ms · worst 14 ms`. The earlier
p99 of 21 fps was a single hitch, not stutter. First fix took 10.9 s at ±25 m
this time versus 0.8 s at ±4 m before; indoors, and worth watching rather than
acting on.

---

## Take 35 — 2026-08-21 — Four bugs in the route picker, measured not guessed

Jacob reported three symptoms while planning a trip from home: the line did not
update, the map shifted randomly, and the option strip could not be scrolled so
a fourth option would be invisible. Reproduced all of it in headless Chrome at
his exact viewport (411x960 @2x) before changing anything — and one of my
assumptions was wrong.

**The line WAS updating.** Instrumenting `setData` showed a redraw with distinct
geometry on every tap. What he was actually seeing:

1. **`fitBounds` fired on every selection.** Five routes over the same 3.7 mi
   corridor look nearly identical one at a time, and re-framing the map on each
   tap read as "shifting over randomly" while masking the very change it was
   meant to reveal. Now fits only on the first draw.
2. **The strip could never scroll.** `#shell` is a grid, grid items default to
   `min-width:auto`, so `#rail` refused to shrink and grew to **788 px on a
   411 px screen**. Nothing overflowed, so there was nothing to scroll and cards
   4 and 5 were simply unreachable. `#shell>*{min-width:0}` fixes it —
   measured: scrollWidth 799 vs clientWidth 385, scrollable.
3. **Selecting rebuilt the whole strip**, resetting `scrollLeft` to 0 on every
   tap. Now the `.sel` class is toggled in place and the chosen card is scrolled
   into view.
4. **Alternates were invisible.** The other four routes are now drawn dimmed
   underneath, so switching visibly moves the highlight — the pattern every
   first-party map uses. 272 alternate segments drawn.

Verified per card at his viewport: refit 0, scroll preserved, exactly one card
marked, and the line redrawn each time.

**And the harness was hiding a real call again.** `El` had no `scrollIntoView`,
so the stub threw where a browser would not. Added — and the app now guards the
call, since the options form is not universal in older WebViews. Same family as
the missing `getElement()` at take 33: an API a stub omits is an API the tests
cannot see.

---

## Take 34 — 2026-08-21 — Offline geocoding, both directions

Jacob asked for an address on a pin, and to be able to type an address to set
home — with the explicit rule that **when there is no address, say nothing**.

Live geocoding is a network service and this app does not get to depend on one
on a trail, so the index ships in the bundle. Source: Census TIGER **ADDRFEAT**,
per-county address *ranges* — each road segment carries the house numbers at
each end, per side, plus the ZIP. That is how rural geocoding works where there
are no address points: find the nearest segment, work out which side of it you
are on, and interpolate along it.

`tools/address.py` picks the counties overlapping the region from the Census
county file, downloads their ranges, clips to the region and emits a name table
plus segment records. For Bull Gap: **2,797 segments, 761 street names, 186 KB**
(bundle 1.89 → 2.07 MB). Counties chosen automatically — Alcona, Oscoda, Ogemaw
and Iosco matched; Crawford correctly did not.

**Verified on real data:** The Pink Store resolves to *5525 S Mount Tom Rd,
48654*, Mack Lake to *1798 Partridge Ct, 48647*, and a round trip —
point → address → back to point — lands within **14 feet**. Only 2 of 8 anchors
resolve at all, which is the honest state of rural address coverage and exactly
why the card must stay quiet rather than announce a gap.

- **Reverse:** shown on every place card when found, omitted entirely when not.
  Parity is preserved, so an odd-side range never yields an even number.
- **Forward:** typing "4952 S Branch Rd" leads the search results and opens a
  place card, which already carries **Make this home** — so setting home by
  address is two taps and needed no new UI.
- Street names joined the search index, so "Mount Tom" finds the road.
- A point outside the data returns **null**, never a nearest guess. Smoke and
  the self-test both assert this specifically; inventing an address 60 miles
  from the data would be worse than having none.

`parse_shp_all()` in context.py now serves both the county outlines and the
address ranges — same record layout for polygon and polyline, and null shapes
yield an empty list so DBF rows and geometry stay aligned. Silently dropping
them would shift every later record's attributes.

---

## Take 33 — 2026-08-21 — Michigan looks like Michigan, and the map answers taps

### Legal boundary vs land boundary is not a detail

Take 32 drew Michigan from TIGERweb's **legal** state boundary, which runs far
out into the Great Lakes — one 10,721-point ring wrapping both peninsulas and a
great deal of water. Jacob: "the weirdest map of Michigan I've ever seen." He was
right, and the mistake was mine for shipping a shape I had never looked at.

The **cartographic** boundary file (`cb_2023_us_state_20m`) is clipped to the
shoreline: Lower Peninsula, Upper Peninsula, Isle Royale and three islands in
469 points. `context.py` now downloads that zip and parses the shapefile
directly — a small DBF reader to find the state and a polygon reader for its
rings, about eighty lines, no dependency. Rendered as **filled land** rather
than a line, because the land/water contrast is what makes the mitten legible.
Four Great Lakes are labelled from a fixed table; nobody needs lake geometry to
know where Lake Michigan is. 6.9 KB in the bundle.

### The map answers taps now

The app had no place interaction at all. It has the first-party pattern now:

- **Tap the home pin, your position pin, or open ground** and get a card —
  coordinates in DD, elevation, distance and compass bearing from you, and the
  nearest named trail with its number.
- **Actions on every card:** Directions here, Make this home, Start from here,
  Dispatch card (live fixes only), Centre.
- **Tap-to-route.** `routeToPoint()` was extracted from the Return Home handler,
  so a tapped pin gets the same five profiles, the same machine legality and the
  same closure avoidance. One router, many callers — Return Home is now just
  this with HOME as the destination.
- Tapping a **trail** still identifies it; only open ground drops a pin. One
  handler, one meaning per tap (landmine 50).

Dropping a pin no longer silently moves the planning start, which was
unexplained and had no undo.

### The harness was quietly declining to test markers

The `Marker` stub had no `getElement()`, so the pin-tap listeners — wrapped in
try/catch — registered nowhere and the whole feature was invisible to smoke.
Added, and `--away` now taps the home pin, asserts its card, taps open ground,
asserts the dropped-pin card, and routes to it. Landmine 39, again: a stub that
omits an API silently omits the feature that uses it.

---

## Take 32 — 2026-08-21 — Clean sweep, and the icon finally fits

**Take 31 field report: 34 pass, 0 fail.** Every previously failing check is
green — `startup-locate` confirms the app knew its position before the test ran,
`mode-correct` reports `posMode=away`, and the fix arrived in **0.8 s at ±4 m**.
The whole GPS chain works on the device.

### The icon was clipping, and it was my bug

`trimmed()` crops the mark to its ink — 782x636, decidedly not square — and then
I resized that into a **square** safe zone. Two errors compounding: the aspect
was distorted, and the extremes were pushed outward until a launcher mask ate
the A's foot and the X's arm.

Now the foreground keeps the master's aspect (1.231 vs 1.229) and is sized by
the **diagonal**, not the width, because a circular mask cuts corners and the
bottom-left of this mark *is* a corner. The furthest ink corner now sits at
r=0.311 of the canvas against a safe-circle radius of 0.310. Verified against
circle, squircle and rounded-square masks — the three shapes a launcher may
apply — with clear margin in all of them, and smaller overall as asked.

### Frame-time instrumentation

p99 min fell 90 → 21 fps between runs while the average held at 115. A single
hitch and a sustained stutter produce the same p99 and need completely different
answers, so the perf check now reports **how many frames exceeded 33 ms and the
worst one**. It also fails on more than 10% slow frames rather than on p99
alone — one GC pause should not condemn a device, and a hundred should.

---

## Take 31 — 2026-08-20 — Michigan, and the startup fix that never fired

Field report on take 29: **32 pass, 1 fail**, and the failure was the one that
mattered — `posMode=none` meant the app still had no idea Jacob was 135 mi away.

### Startup locate never worked

Take 30 used `getCurrentPosition` with `enableHighAccuracy:false` and a 10 s
timeout. On the Fold it never produced a fix, while the self-test's **own watch
got one in 1.0 s at ±17 m** in the same session. So `locateOnce` now uses the
same `gpsStart` machinery that demonstrably works, takes the first fix and stops.
**One proven path beats two plausible ones.** The self-test gained a
`startup-locate` check that reports whether the app knew its position *before*
the test ran — the thing a rider actually experiences on opening the app.

### The orange box is gone; Michigan is there instead

Jacob called the DOWNLOADED square distracting and ugly, and he was right — it
shouted at the one part of the screen that was already obvious. Removed
entirely. In its place, the **state outline** from US Census TIGERweb: a thin
grey line below z9.6, fading out as you approach the data, 10,721 points
simplified to **126** and 2.3 KB in the bundle. It answers "where am I relative
to my download" and nothing else — it is not in the graph, the router, or any
safety path, and it disappears before it could be mistaken for a trail.

**A silent RDP bug nearly ate it.** On a closed ring the first and last points
are identical, so the baseline has zero length and every perpendicular distance
evaluates to exactly **zero** — the simplifier discarded the entire state and
returned two points, with no exception. Rings are now split at their farthest
point and simplified as two open lines.

### And the harness invented one more failure

`flushTimeouts()` fired every pending timer regardless of delay, including the
25 s give-up timer, releasing the GPS receiver during a four-frame idle loop.
It now respects delays. The `--away` mode was rewritten to drive the **startup**
path with no tap at all, which is precisely what failed on the device.

Also noted from the field report: agency data drifted again (16,352 → 16,440
edges), and elevation at Mio moved 965 → 938 ft with it. Within the 90 ft
tolerance, and a reminder that the DEM re-fetches with the region.

---

## Take 30 — 2026-08-20 — Stop redrawing the logo, use the logo

Takes 24 and 29 both tried to reproduce Jacob's APEX mark from primitives and
both missed. His verdict on take 29 was "isn't even close", and he was right —
the letterforms are specific and hand-plotting them was guesswork wearing an
engineering costume. Three attempts at approximating something I had a pixel-
perfect copy of.

**`assets/logo-master.png` is now the artwork itself**: cropped from the file he
supplied, snapped to the three brand colours so JPEG haloes cannot survive
scaling, corner-cleaned, and reduced to the six shapes that are actually the
mark. `tools/icon.py` derives every density from it — still one source of truth,
still no per-density binaries.

**A logo is a source asset, not generated data.** Committing it is the honest
thing; committing five rendered sizes would not be. The earlier "no binaries"
instinct was right about *outputs* and wrong about *inputs*.

### Cleaning it took three passes, each found by looking

1. His screenshot carried registration marks in the corners — cleared by masking
   to the rounded tile.
2. The tile's own anti-aliased border quantised to white and survived just inside
   an exact-radius mask, so the adaptive foreground showed faint arcs once the
   art was lifted onto transparency. Fixed by insetting the mask 12 px.
3. Sixty-four fragments of JPEG debris remained. The mark is **six** large
   shapes — triangle-with-streak, A, P, E, X, and the red X wedge — with a clean
   size gap between 4,678 px and 423 px, so components under 1,000 px are
   dropped. 130,032 ink pixels kept, bbox x129..911 y128..764.

Verified by pulling the 432 px adaptive foreground back **out of the built APK**
and looking at it, then re-checking under circle and squircle masks and down to
40 px.

**Regression check:** the icon touched nothing in the app — render 19/19, the
app's own self-test 29/29, and all five smoke modes green against the take-30
APK bytes. `icon.py` imports only PIL, os and sys; scipy was used once to prepare
the master and is not a build dependency.

---

## Take 29 — 2026-08-20 — Jacob's mark, and a full pre-test audit

Icon replaced with the design Jacob supplied: A-frame outline open at the base,
APEX across the legs with a dark stroke separating wordmark from frame, red
sliver hanging from the peak, red flick off the X, on charcoal. Drawn as
geometry in `tools/icon.py` (Poppins-Bold for the wordmark) rather than
embedding his JPEG, so it stays crisp at every density and CI regenerates it —
no committed binaries (landmine 32). Three iterations, each judged at 48 px:
the wordmark was first oversized and mid-triangle, then the red streak was a
band where the reference has a sliver. Verified square, circle-masked and at
every launcher density.

Scope noted, since it changes the earlier reasoning: this is a personal
sideloaded tool, never listed or sold. AGENDA A21's keystore decision already
assumed that; the icon follows the same footing.

### Take-29 full audit

| area | result |
|---|---|
| smoke, 5 modes, repo build | all PASSED (124 assertions) |
| render, split build | 19 checks green |
| render, single-file build | PASSED |
| render, shipped APK bytes | PASSED, self-test 29/29 |
| smoke, shipped APK bytes, 5 modes | all PASSED |
| second region (sthelen) full pipeline | COMPLETE |
| primary region, clean pipeline | COMPLETE, 148 s |
| bundle geometry-in-bbox, both regions | COMPLETE |
| gate | PASSED |
| seed ⇄ repo byte-identity | 41 files identical |
| bootstrap simulation | reproduces the tree exactly |
| icon inside the APK | extracted and verified visually |

**Negative controls, all firing:** the take-22 style-expression bug → RENDER
FAILED (15); the `mi()` collision → smoke dies; a missing required network
artifact → app refuses, map not constructed; `CI=1` with no browser → gate
fails.

### Two real findings during the audit

**A transient 503 from a state endpoint killed the pipeline.** Take 14 gave
Overpass retries and stopped there; DNR and USFS had none, so one upstream
hiccup is a red CI build for something nobody controls. All network reads retry
with backoff now (landmine 57).

**And it nearly fooled me.** After the failed run I checked
`bundle.py verify neml-bullgap` and got COMPLETE — from **stale bundle files**,
because ingest died before anything was rebuilt. A verify that passes on
leftovers is landmine 32 wearing yet another hat; the fix was to actually
re-run the pipeline to green rather than trust the verdict.

**Icon centring:** the adaptive foreground centred its coordinate box, not its
ink, leaving the mark visibly high with dead space beneath — only obvious once
extracted from the APK and composited on the declared background. Nudged.

---

## Take 28 — 2026-08-20 — The Fold renders, and the self-test paid for itself

**A18 Stage 0 is closed for real.** Take 27 on the SM-F966U1, Android 16, WebView
Chrome/152, **Adreno 830**: satellite imagery, trails, water, hillshade and place
labels all drawing, **avg 123 fps, p99 min 90**, NET CLEAN, 0 remote requests.
The style-validation fix was the whole thing.

The self-test reported 30 pass / 3 fail on its first field run. **One was a real
bug that broke the app; two were my checks being wrong.**

### The real one: ▶ Ride it was dead on the device

Capacitor 7 returns the watch id **synchronously** from `watchPosition`, not a
Promise. `.then()` threw, `gpsStart()` threw with it, and the click handler died
— while the watch quietly ran in the background, which is why a fix still
arrived in 1.3 s at ±18 m. Both call sites now accept either shape. **A plugin's
return type is not something to assume** (landmine 56); nothing in the harness
could have caught this because the harness stubs Capacitor.

### Two checks that lied

- **labels 0** while the screen visibly showed *The Pink Store*. The check
  counted at whatever viewport the map happened to be on. It now jumps to a site
  anchor, counts, and restores. Landmine 54, fifth appearance.
- **in-region FAIL** whose own detail line read *"planning mode is correct"*. Being
  135 mi away is not a failure; it is Tuesday. Now informational, and the
  assertion is on the app's **response** (`posMode==='away'`).

### What Jacob asked for, built

- **The app now locates you at startup**, not only when you tap Ride. It knew
  nothing about position until a ride began, which is why it cheerfully showed a
  region 135 mi away and said nothing.
- **Zoom out to the whole state.** minZoom 9 → 5.2 and maxBounds widened from the
  bundle bbox to Michigan. A dashed orange **DOWNLOADED** box marks the covered
  area, so blank space reads as *not downloaded* rather than *broken* — and a
  blue **you-are-here** pin sits at the real fix.
- **◉ Locate** flies to the real position (statewide zoom when far, 14.5 when
  inside) instead of delegating to a control that does nothing useful outside
  the region.
- **Place labels now outrank trail names** — MapLibre places earlier layers
  first, and `lbl-place` was last, so town and trailhead names lost every
  contest to road labels.

---

## Take 27 — 2026-08-20 — The app tests itself

Jacob asked for a diagnostic he could run once instead of tapping through every
feature, producing something I can actually work from. Built it, because the one
class of bug I genuinely cannot reach from this container is device-specific
WebView behaviour — and a report from the real thing is exactly that.

**⛑ Self-test** runs 29 checks plus 11 environment readings, in-app, on the
device: bundle state and offline cleanliness, glyph pack bytes, graph and
terrain sizes, style loaded, features drawn per layer group, elevation against
three surveyed landmarks, search index, all five routing profiles with distances,
turn-by-turn steps, machine legality, closure avoidance, breadcrumb accumulation,
retrace losslessness, truck pinning, dispatch refusal, haptics, and frame rate.
Visual pass/fail list on screen, then **Copy** or **Share** (Capacitor Share,
with clipboard fallback).

**The design point:** `tools/render.mjs` calls the *same* `window.__selfTest()`
headless in Chrome. So I hold a baseline for every check, and anything that
differs in Jacob's report is device-specific **by construction**. That is the
only comparison that can isolate a WebView problem.

Every check reports what it **observed**, not just a verdict — "FAIL routing" is
nearly useless; "profiles 0/5 · cost is not a function" names the layer.

### It found four bugs immediately, all mine

- `PROFILES[].cost` does not exist; the field is `.f`. All five profiles threw.
- `IDX` is built lazily, so reading it cold reported "0 entries" — a number that
  looks like failure and means "not built yet". Now forces the build first.
- The fps check asserted ≥30 in headless Chrome, which rasterises in **software**
  at single digits. It now detects a software rasteriser and reports the number
  without a verdict; only real hardware gets judged.
- An SxS finding no route read as a failure when it is usually correct — 72"
  machines are barred from most of this network. Now distinguishes "cannot snap
  at all" (broken filter) from "no legal route" (real data).

And landmine 38 caught me again in `smoke.mjs`: I used `idxSrcEarly` above its
own declaration.

**Baseline from headless Chrome, take 27:** 29 passed, 0 failed. Elevation Δ0 ft
at Mio and Bull Gap, Δ10 at the Pink Store. Routing 5/5 profiles, 8.8–9.8 mi.
Search index 2,543 entries. Breadcrumb 1.26 mi from 25 synthetic fixes, retrace
lossless.

---

## Take 26 — 2026-08-20 — Tidying, and two features proven for the first time

Pre-test sweep. Four things.

**1. Stamping was rewriting history.** Takes 13-25 bumped doc stamps with a
whole-file `replace('take N','take N+1')`. It happened to be harmless — each
file carried exactly one take reference — but any prose deliberately citing an
earlier take would have been silently altered. `tools/stamp.py` now edits only
the stamp line, driven by BUILD. Checked all four docs for damage: none.

**2. Labels and satellite had never been proven to draw.** The take-23 render
check asserted *something* rendered; it never asserted the specific things a
rider depends on. Now, by layer: 712 trail features, 6,751 road features, and —
the one with its own failure mode, the glyph pack — **5 place labels**. Plus the
basemap cycle: satellite hidden by default, visible after one tap, still visible
on Hybrid, hidden again on return. Satellite is an image source with a blob url,
so it fails independently of everything else and deserved its own check.

**3. A self-inflicted false alarm, again.** The trail-name check first asserted
at the region's bbox centre, which is farm roads with no moto trail on it, and
duly reported *"0 trail segments drawn"* on a perfectly good map. Anchored to a
`site` anchor instead: **Bull Gap at z14.5 — 66 trail segments, 5 trail NAME
labels**, which is the thing that matters mid-ride. Third time a broken
instrument has accused a working product this week (drawImage, the constructor
wrapper, now this). The pattern is worth naming: **when a check fails, verify
the check before believing it.**

**4. Nine stale APKs were sitting in outputs.** Any of them installable, most of
them blank-mapped. Removed; the repo is the history, old builds are just a
hazard. One APK, one seed, one setup page.

Render suite is now **16 checks**. Smoke is 5 modes, 116 assertions. Both run
against the shipped APK's own bytes.

---

## Take 25 — 2026-08-20 — Closing take 23 properly

Jacob pointed out that I shipped take 23's fix and moved to the icon without
finishing it. He was right. Five loose ends, all real:

1. **`tools/render.mjs` could not run from the seed.** puppeteer was never a
   declared dependency, and `tools/android.py` *overwrote* `package.json` from a
   fixed template. The check that found the blank map was unavailable to the one
   person who needs it. Now declared, and `android.py` merges instead of
   clobbering.
2. **CI never rendered anything.** `check_render` skipped when Chrome was
   absent, and the workflow had no Chrome — so it skipped every time, politely.
   The workflow now installs Chrome and renders before gating, and the gate
   **fails** rather than notes when `$CI` is set with no browser. Landmine 53.
3. **The single-file build was engineless from a clean seed.** `single()`
   inlined `mlg.js`/`mlg.css`, both **gitignored** — present only in my
   container. From the seed it would have written a 2 MB page with no MapLibre
   in it. Now inlined from `www/vendor/`. Landmine 32, fifth appearance.
4. **The pixel assertion had been dropped** when I tidied the harness after take
   23 — the strongest evidence, quietly deleted. Restored, and implemented
   properly: the screenshot is fed back into the page as an `<img>` and read
   from a 2D canvas, avoiding the `preserveDrawingBuffer` trap entirely.
5. **The CSP engine was never revisited** after take 23 disproved the worker
   hypothesis it was shipped for. Recorded honestly as A27: kept as insurance,
   not as a fix, with a decision point once the Fold renders.

**Negative control:** reintroducing the exact take-22 style bug now fails all
five render checks — glyphs url, feature count, badge, colour count, dominant
colour share. Both builds verified: split and single-file each render 7,736
features, 531 colours, busiest colour 39%.

**Agenda:** A24, A25, A26 closed; A27 and A28 opened. A28 is the honest gap —
Jacob's goal is plan / ride / **improvise**, and loop generation for an impromptu
ride does not exist yet. Sequenced deliberately after A18.

---

## Take 24 — 2026-08-20 — An icon of its own

Jacob found an APEX Capital logo he liked and asked to recolour it and drop the
wordmark. Declined the trace — that is their brand mark — and drew an original
from primitives instead, which costs nothing and is actually his. What he liked
about it (peak geometry, a streak through the letter) is not anyone's property.

`tools/icon.py`: an A-frame that reads as both letter and peak, with a single
tapered streak down the left face in the app's own flag orange, on rail black —
same palette as the map, so icon and app look like one thing. All geometry is
derived from the two triangle edges, so the crossbar and streak sit exactly on
them at every size.

Two revisions after looking at it rendered: a hollow crossbar turned into a
smudge below ~72 px and became solid, and a zigzag "switchback" read as a blob
and became one confident wedge. **Both found by generating the thing and looking
at it at 48 px** — the same principle as take 23, applied to design.

Emits legacy square and round icons mdpi..xxxhdpi, adaptive foregrounds on the
108dp canvas with art inside the 66dp safe zone, `mipmap-anydpi-v26` xml with a
`monochrome` layer for themed icons, and the background colour resource.
Verified under both circle and squircle masks. `tools/android.py` calls it, so
CI generates icons rather than carrying committed binaries (landmine 32).

---

## Take 23 — 2026-08-20 — The map has never rendered, and now it does

**The app has drawn nothing since take 9.** Fourteen takes of "verified" work,
two full audits, 112 green assertions — over a map that was blank every single
time. This is the most important entry in this file.

### The actual cause

MapLibre **rejects an entire style** if any part of it fails validation. Two
parts did:

1. `glyphs` was a bare `data:` URI. MapLibre requires a template carrying
   `{fontstack}` and `{range}`. This is the error the on-device detector
   surfaced, and it was only the *first* one.
2. `lbl-place`'s `text-size` was `['case', cond, w(...), w(...)]` — **two**
   zoom-based interpolates in one expression, which the spec forbids.

Either alone kills all 24 layers. My take-22 diagnosis — a blocked `blob:`
worker — was **wrong**, and the detector I built is what proved it wrong. That
is the one thing that went right.

### Fixes

- Glyphs now load through a custom `apexfont://{fontstack}/{range}.pbf`
  protocol registered with `addProtocol`, serving the pack from memory. Works
  identically in the single-file build and the APK, no font files, no network.
- `wCase()` keeps a single zoom curve on the outside and branches inside it.

### tools/render.mjs — the hole that let this live for 14 takes

`smoke.mjs` stubs `maplibregl` entirely, so it could never see a style being
rejected. `render.mjs` serves `www/` over http, loads it in **real headless
Chrome**, and asserts: no page errors, no map errors, a valid glyphs url,
`queryRenderedFeatures() > 0`, the badge is not RENDER FAIL, and the composited
screenshot is not one flat colour. It is now a pipeline step and a gate check.

**Verified output:** 7,736 features rendered, badge `GRAPH 16352`, 6,037
distinct colours, and a screenshot showing hillshade, the road network, water,
and labels reading *Mack Lake*, *The Pink Store*, *Bull Gap*.

### Two testing lessons, paid for expensively

- I wrapped MapLibre's constructor to catch construction-time errors, and the
  wrapper **broke the map** — no events, no layers, no errors — producing a
  confident, fabricated diagnosis. Observe; never intercept.
- My first pixel check read the canvas with `drawImage`, which always returns
  black because MapLibre runs `preserveDrawingBuffer:false`. The test reported
  "blank map" on a map I had not yet proven either way. Screenshot the
  composited page instead.

Both are landmine 39's moral from the other side: **a broken instrument reports
failure as confidently as a broken product.**

---

## Take 22 — 2026-08-20 — Pre-flight on take 21's own changes

Take 21 changed a lot in one pass. Audited it as an adversary, and three of the
new things were wrong.

### 1. The CSP engine could have bricked the app entirely

If `maplibregl.setWorkerUrl` were not a real top-level export, `index.html`
would throw on the first script and produce **nothing** — strictly worse than
the blank map it was fixing. Loaded `maplibre-gl-csp.js` in a stubbed browser
realm: 66 exports, `setWorkerUrl` a function, `Map`/`Marker`/`GeolocateControl`/
`LngLatBounds` all present. API-compatible. Verified rather than assumed.

### 2. The RENDER FAIL detector would have cried wolf

`queryRenderedFeatures()` is legitimately empty while tiles are still being
built, so a single check 1.5 s after load could condemn a **healthy** map. It now
takes three zero readings over ~7 s, is driven by the `idle` event, and any
non-zero reading settles it permanently and restores the badge. **A false alarm
is worse than the silence it replaces** — a rider who learns to ignore this badge
has lost it. Drilled with `--dead-renderer` per landmine 45.

### 3. Planning mode clobbered the identify tap

Take 21 added a *second* `map.on('click')`, so every tap both identified a trail
and moved the planning start — the second handler winning and wiping the trail
card. Worse, the app already had an arm-a-pin flow doing this properly. The new
handler is gone; planning folds into the existing empty-ground branch, so
**tapping a trail identifies it, tapping open ground plans**. One handler, one
meaning per tap.

### And the harness invented a bug of its own

To make a healthy renderer look healthy I had the stub return 1,240 features
from `queryRenderedFeatures` — to *both* of MapLibre's contracts behind that
name. The no-argument form is a viewport census; the box form is a hit test.
Conflating them made a tap on open ground look like a tap on a trail. Faithful
stubs, or the harness invents failures that do not exist.

**Smoke is now five modes** — gps, sim, fatal-drill, dead-renderer, away — all
run by the pipeline and all enforced by the gate, which previously ran only one.

`--away` is Jacob's actual situation and it passes end to end: out-of-region fix
reports the distance, stops tracking, labels the readout MAP CENTRE, dispatch
refuses with no coordinate printed, a tap drops a planning start, a tap on a
trail still identifies it, and Return Home routes 5 profiles from the planned
start.

---

## Take 21 — 2026-08-20 — A18 opens: the Fold spoke, and it said two things

**Stage 0 PASSED, enormously.** avg **121 fps**, p99 min **119**, remote **0**,
NET CLEAN, GRAPH 16352, chips populated from the region manifest. The offline
bundle pipeline works on the device. Bar was 50/30.

**And the map was blank sand.** Both facts are the same fact.

### The renderer was idle, and my test called it fast

121 fps over an empty canvas is not speed. The pan test printed
*"16352 edges rendered"* — a number taken from `EDGES.length`, i.e. from what I
hoped, never from what drew. **My instrumentation asserted its own hope and
reported PASS on a broken app.** It now calls `queryRenderedFeatures()` and
prints *drew of total*, and fails when drew is 0.

### Diagnosis, by elimination rather than guess

Executed the shipped APK's own bytes: net source **16,352 features**, water 422,
places 8, geometry spanning -84.37..-83.87 / 44.36..44.75 — all correct. 24
layers correctly wired, only 2 hidden by design. `map.on('load')` demonstrably
fired (the chips carry a runtime class). So: valid style, valid data, working
map transform — the DOM markers positioned correctly, which requires it.

What draws on the **main thread** worked (background, DOM markers). Everything
that requires MapLibre's **worker** — every GeoJSON and raster source — drew
nothing. MapLibre builds that worker from a `blob:` URL; Android WebView under
Capacitor is a known environment where that fails. MapLibre publishes a CSP-safe
build for precisely this, so the app now loads `maplibre-gl-csp.js` with an
explicit `setWorkerUrl("vendor/maplibre-gl-csp-worker.js")`.

**Stated honestly: this fix is inferred, not yet observed.** So the app also
ships a detector — if sources hold features and `queryRenderedFeatures()`
returns 0, the badge reads **RENDER FAIL** and the panel explains what loaded,
what did not, and names any engine error. The next run either works or tells us
exactly why. Landmine 47.

### The more serious bug: a fabricated position

The screen read **44.57072 -84.15770 · 1135 ft** while Jacob was a few hundred
miles away. Precise, plausible, wrong — sitting on the same screen as the button
that reads coordinates out to **dispatch**. That is the worst failure mode this
app has shipped, and no render bug outranks it.

`posMode` now distinguishes `none` / `gps` / `sim` / `away`:

- the readout labels the coordinate **MAP CENTRE** until a real fix exists;
- an out-of-region fix says *"about N mi from Bull Gap"* and enters **planning
  mode** rather than pretending;
- **dispatch refuses** anything but a live in-region fix, and says why;
- the simulator sets `posMode='sim'` — it exercises every line of the GPS path
  (test-double fidelity, take 16) but is **still refused** by dispatch, because
  those coordinates are invented. Smoke asserts both halves.

### Planning mode — what Jacob actually asked for

Tap anywhere to drop a planning start; **Return Home** and **Directions** route
from it. Search, browse, elevation and the full graph all work hundreds of miles
away, which is where ride planning actually happens.

**A18 amended:** Stage 0 closed (121/119). Stage 1 blocked on the render fix.

---

## Take 20 — 2026-08-19 — First live run: bootstrap green, build silent

**Jacob ran it.** Bootstrap: checkout, seed download, unzip, `GATE PASSED —
take 19`, 38 files committed (43 zip entries less 5 directory entries — exact),
pushed `602c83a..d147a6f`. Twenty seconds. Every local prediction held.

**And then nothing built.** A push authored by GITHUB_TOKEN does not trigger
`on: push` workflows — GitHub's anti-recursion rule. Landmine 46, and one that
nineteen takes of auditing structurally could not find: every check I ran was
against files and YAML, and this is a property of GitHub's event system.
Platform semantics require a real run to learn.

Recovery was one tap because `workflow_dispatch:` was already on build.yml
(added at take 17 for manual runs). Permanent fix: the seeder now ends with
`gh workflow run build.yml` — `workflow_dispatch` and `repository_dispatch`
being the two documented exceptions to the token rule.

Nothing in the seeded repo is wrong; it does not need re-seeding.

---

## Take 19 — 2026-08-19 — Audit round two: the refusal path fires

Second full audit, from the exact deliverables. Fifteen checks: seed ⇄ staged
repo byte-identical per file (43/43, none extra, junk-free, `.gitignore`
carried, `.github/` excluded); setup-embedded workflows byte-identical; release
permissions (`contents: write`) and the gh token present — the first-real-run
killers; all 12 actions pinned; Pages-safe relative paths; the take-18 APK
re-opened and its own bytes run through GPS, simulator **and** partial-imagery
modes; all five verifiers green against the live-drifted 16,409-edge data; both
regions verify; take numbers coherent.

**Two of my own probes misfired across the two audits** — the `pages:` split
and a literal-`fetch(` grep — each failing a correct artifact. Same moral as
landmine 39 from the other side: hand-rolled greps lie in both directions; the
executed smokes are the authority.

**The gap worth a take: the unusable-region refusal had never fired.** The
fatal screen is landmine 34's entire promise, and no audit had executed it.
`smoke.mjs --fatal-drill` now copies the target www, strips the required
`network` artifact from the manifest, and asserts: fatal screen shown, it says
*Region incomplete*, names the missing artifact, states the principle ("worse
than no map"), the map is **not** constructed, zero remote requests. Fired
against the repo build and against the shipped take-18 APK's extracted bytes —
both refuse correctly. The pipeline now runs smoke in **three** modes.
Landmine 45.

**DEFERRED:** unchanged. Jacob runs the setup next; A18 awaits four numbers.

---

## Take 18 — 2026-08-19 — Full-stack pre-flight, and the second build was broken

Jacob asked for a full-stack smoke before running the setup. Everything was
verified from the **exact files he will download**, nothing from the warm tree:
seed integrity and standalone gate; both pasted workflows parse, and the setup
page's embedded copies are byte-identical to the real files; a clean pipeline
from the seed absorbed live agency drift (16,409 edges vs 16,345 — the trails
moved upstream since the first fetch, and the pipeline just took it); **the
bytes inside the shipped APK were extracted and executed** through smoke, both
GPS and simulator modes; and a clean `npm → cap → gradle` build from the seed
produced an APK whose signing cert digest **equals the shipped one** —
signature continuity proven, CI updates will install over the sideload.

**One layer was red, and it was going to be his second build.** The bundle job
skipped the pipeline on cache-hit, so `bundles/` and `www/bundle` never
existed, and the next step's `cp bundles/…/manifest.json` dies. First build
fine; every subsequent push fails. **Executed, not inferred**: simulating the
cache-hit checkout reproduced the failure exactly. Landmine 44.

Fix: the pipeline is unconditional — a cache hit is a *fast path*, not a
skipped one — and `dem_cache/` + `img_cache/` join the cache so the warm run
stays warm. The fixed path was then executed: **13 seconds**, both smokes, all
artifacts, gate green.

A small verifier lesson en route: my pages-job probe split the YAML at the
first `pages:` — the *permissions* block — and failed a correct workflow.
Filed under landmine 39's moral: a checker aimed at the wrong slice fails good
artifacts as happily as bad ones.

**DEFERRED:** unchanged. A18 is one mailbox-walk away.

---

## Take 17 — 2026-08-19 — First-run experience, walked as the user

Walked the RUNBOOK as Jacob would and found the first thing a new user sees is
**two red failed runs**: pasting `build.yml` triggers a build on its own paste,
and again on the bootstrap paste, both before any tools exist. Fixed with a
push **paths filter** matching exactly what the seed delivers (BUILD, src/,
tools/, regions.json, package files, signing/) plus `workflow_dispatch` for
manual runs — a fresh repo now shows nothing until bootstrap seeds it, and the
seed commit itself lights the first build. Landmine 43. Also added a
`concurrency` group (superseded pushes cancel) and per-job timeouts so a hung
agency endpoint cannot eat the Actions allowance.

**Bootstrap now gates the seed before committing.** The runner runs
`tools/gate.py` against the unzipped tree; a truncated upload or stale zip is
refused instead of becoming the repo's first commit.

**`apex-setup.html`** — the real deliverable: a self-contained, offline page
that walks every tap. Type the GitHub username once and every link templates
itself (including `releases/new?tag=seed-1`, which pre-fills the tag); both
workflows are embedded with one-tap Copy buttons (clipboard API with an
execCommand fallback); the two device tests end with exactly the four numbers
to report. Downloads drop from four files to two: this page and the seed.

APK rebuilt as `apex-offroad-take-17.apk` (Gradle warm — seconds, not
minutes). Smoke both modes green.

**DEFERRED:** unchanged — A14, A17, Phase 1b background tracking, and A18
until the Fold speaks.

---

## Take 16 — 2026-08-19 — A real APK exists

**Shipped:** `apex-offroad-take-16.apk` — 4.8 MB, release-signed
(CN=APEX Off-road, O=SergeantSlabs, cert SHA-256 52f61c46…), package
`com.sergeantslabs.apex`, with the entire neml-bullgap region verified inside
`assets/public/` by unzip. Built **in the container**, not imagined in YAML.

### The apk job was the take-2 spike, in the workflow this time

Its "Write build config" step still wrote a `bullgap-spike` package.json.
Landmine 35's third appearance, now in CI. The job is rewritten to call
`tools/android.py` — the same tool that just produced the working APK — and the
gate refuses a workflow that stops calling it.

### tools/android.py — one tool for CI and hand

Idempotent: writes package.json + capacitor.config.json, npm install
(Capacitor 7 + Geolocation + Haptics), `cap add android`, then patches what the
template does not know this app needs: location/wake/vibrate permissions,
`density` added to configChanges (**landmine 7 — the Fold changes density when
it folds; without it Android restarts the activity and drops the ride**),
`FLAG_KEEP_SCREEN_ON` in MainActivity (a nav screen that sleeps mid-trail is a
safety failure), and release signing.

**The keystore is committed, deliberately.** Anyone with the repo can sign an
update that installs over this app; for a personal sideloaded tool that is the
right trade against the alternative — a fresh CI debug key per run, meaning
every new take refuses to install over the last. Recorded in AGENDA A21;
revisit before any public distribution.

### The app grew its phone half

- **Live GPS.** `▶ Ride it` starts a `watchPosition` that feeds the *same*
  startRecording → record → checkOffRoute chain the simulator proved. The sim
  is the test double, GPS is production, and they share every line after the
  fix arrives. file:// (and the smoke harness with `--no-gps`) fall back to the
  simulator with a plain explanation.
- **Haptics bridged.** Android's WebView does not implement
  `navigator.vibrate` — silently. The off-route alert's buzz would have been
  dead in the APK. `buzz()` now prefers Capacitor Haptics.
- Permission requested once at map load when running inside Capacitor.

Smoke gained a live-GPS scenario: the harness owns the fix stream, asserts the
watch starts, 28 fixes accumulate 1.4 mi of breadcrumb through the real chain,
and stop clears the watch. The pipeline now runs smoke twice — GPS and
`--no-gps`.

### Toolchain lessons, paid for in failed builds

`java` ran but `javac` did not exist — a JRE is not a JDK, and the first Gradle
run died on it. ubuntu-latest runners preinstall the Android SDK and
setup-java provides a full JDK; **a container has neither, which is exactly why
the build had to be proven in one** (landmine 40).

### Getting it onto GitHub from a phone

34 files is too many to hand-create in a mobile browser. The flow is now three
artifacts: paste `build.yml`, paste `bootstrap.yml`, upload `apex-seed.zip` as
a release asset — then run bootstrap once and it commits the whole tree.
The seed **excludes `.github/`** because GITHUB_TOKEN cannot push workflow
files (landmine 42); the two workflows are precisely the two hand-pastes.

**DEFERRED:** background tracking / foreground service (screen-on riding makes
it Phase 1b, after A18); A14, A17. **A18 amended, not closed:** an APK exists
and verifies internally — battery, sunlight, gloves, One UI and the fold seam
remain zero-evidence until it runs on the Fold.

---

## Take 15 — 2026-08-19 — The shipped app runs, and running it corrected the record

**The gap:** `www/app.js` — the exact file CI packages — had only ever been
*parsed*, never *executed*. verify6-11 mirror the algorithms in Python; a mirror
can prove the maths and still miss the wiring. `tools/smoke.mjs` now stubs the
browser and drives the real file against a real bundle: search, Return Home,
directions, ride, retrace, dispatch, basemap, partial-region, both regions.

**First execution ever. Three shipped bugs, in severity order:**

### 1. Every Phase-4 distance call has been invoking the number 0 since take 7

`var ORDER=[...],mi=0` (take 6, machine index) collides with `function mi(a,b)`
(take 7, distance). Function declarations hoist; the `mi=0` assignment then
overwrites the function at startup. Back-to-truck, breadcrumb gating, retrace
distance, off-route detection, dispatch ranges — all dead on first use, hidden
because `syncSafety` early-returns until a truck pin exists. **The take-7 and
take-8 handoffs claimed these "verified"; that was true of the mirrored maths
and false of the shipped wiring.** This entry corrects those claims. Renamed to
`machIdx`.

### 2. Labels and place names have been wired dead since take 9

The LABELS block (GLYPH_URL, PLACES, placeFC) accreted hundreds of lines BELOW
the map constructor and the pins that consume it. `var` hoisting made every
reference `undefined` instead of an error: `style.glyphs=undefined`, places
source `data:undefined`. verify9 proved the glyph *pack* byte-perfect while the
*wiring* was dead. Take 14's `anchorOf` upgraded the silence to a fatal crash —
which is what the smoke test hit on its first run. Block moved above first use,
with a comment marking definition order as load-bearing.

### 3. A bundle's imagery could never be placed without scratch files

The georeference lived only in `imagery_meta.json` in the working directory —
never in the bundle. A bundle alone (the on-device case) fell back to
`[0,0,0,0]`. The manifest now carries `imagery_bounds`; `bundle.py verify`
refuses imagery without it; the loader reads it from the manifest; the app
guards `SAT_OK` so an imagery-less or georef-less region locks the basemap to
Map instead of feeding MapLibre a degenerate image source.

### And the parent-scratch fallback contaminated sthelen a second time

`bundle.py`/`build_app.py` still fell back to the directory above ROOT — stale
take-10 artifacts — and quietly rebuilt sthelen from neml files when scratch was
empty. The take-14 geometry check caught it; the fallback is now deleted rather
than survived.

**Smoke is load-bearing now:** pipeline's final step, and a gate check that runs
the app whenever a built bundle exists. Negative control: reintroducing the `mi`
collision in `www/app.js` fails the gate. 22 assertions green on neml, green on
sthelen, and the partial-imagery path verifies PARTIAL badge + named missing
layer + basemap locked to Map.

**DEFERRED:** A14 3D/slope. A17 voice. A18 stands — and stands corrected: before
today, "the app works" was a claim about Python mirrors of it.

---

## Take 14 — 2026-08-19 — Regions are real, and a second one proved it

**The AOI was hardcoded in ten places across seven files.** Adding a riding area
meant a coordinated edit nobody would get right twice — the same class of problem
as landmine 32, state kept in sync by hand.

`regions.json` is now the single definition: bbox, centre, imagery zoom, anchors,
note. `tools/region.py` reads it; every tool imports `R`. `pipeline.py --region
<id>` runs the lot.

### A second region, built from nothing

**St. Helen / Roscommon** — a different DNR management unit, deliberately, so the
pipeline could not be quietly shaped around one place.

| | Bull Gap | St. Helen |
|---|---|---|
| features | 648 | 294 |
| edges | 16,345 | 8,590 |
| connected | 99.4% | 99.4% |
| relief | 199 m | 204 m |
| network climb | 88.9k ft | 46.2k ft |
| bundle | 1.88 MB | 1.19 MB |
| app | 3.17 MB | 2.46 MB |

The app is region-agnostic now: chips, place labels, home and me pins, map centre,
max bounds and the pan-test route all come from the manifest. **Zero Bull Gap
coordinates remain in `src/app.html`.**

### Four bugs, each found by doing rather than reading

1. **Overpass rate-limits.** A 429 killed the whole pipeline. Retries with
   backoff now — it is a volunteer-run service and deserves the manners anyway.
2. **`fetch_osm` skipped when `aoi.json` existed**, so building region B straight
   after A would have silently used A's OSM data. `ensure_workspace()` makes the
   working directory single-region: switch, and everything derived is cleared.
3. **`build_app` picked the alphabetically-first bundle**, so a St. Helen page
   carried Bull Gap's manifest. And `--region` was being swallowed as the output
   path.
4. **The worst one: a St. Helen bundle containing Bull Gap's graph.** Every hash
   correct, every size correct, wrong place entirely. Hashes prove files are
   *intact*; they do not prove files are *for this region*.

### The check that class deserved

`bundle.py verify` now decodes the graph and asserts its nodes lie inside the
declared bbox. On the contaminated bundle it reported **7,179 of 9,285 nodes
outside bbox, data spanning -84.37,44.36 to -83.87,44.75** — the wrong region,
named exactly. That is the check that would have caught it in one run.

The gate also refuses a bare lat/lon literal anywhere in `tools/` outside
`regions.json`, so the AOI cannot leak back into code.

**DEFERRED this cycle:** A14 3D terrain and slope. A17 voice. A18 remains the
standing blocker — nothing has run on the Fold.

---

## Take 13 — 2026-08-19 — The pipeline runs clean, and four things were broken

Ran the full sequence from a checkout containing **only committed files**, for
the first time in thirteen takes. It failed four times. Every failure was
invisible because artifacts survived on disk from earlier runs — landmine 32,
which I had already written down and still walked into.

### 1. The Overpass fetch had been silently reverted

Added at take 10. At take 11 I ran `cp /home/claude/ingest.py tools/ingest.py`,
overwriting the patched file with an older copy. Nothing failed, because
`aoi.json` was already on disk and stayed there for takes 11 and 12.

**The gate showed the signal and I read past it.** Declared provisioning hosts
fell from 6 to 5 between takes 11 and 12; I printed that line in both takes and
did not notice. The gate now **fails** on a declared-but-unreached host, because
that is precisely the fingerprint of a vanished pipeline step.

### 2. Overpass returns 406 to urllib's default user-agent

Only ever hit because take 5's fetch was a hand-written `curl` that set one.
Fixed with a proper identifying UA, which is also just good manners on a
volunteer-run service.

### 3. The hillshade trim lived in a throwaway script

`terrain.py` emitted 428 KB; the 227 KB version shipped in takes 8-12 came from
an ad-hoc resize I ran once and never committed. A clean run produced a shade
nearly twice the intended size and nothing complained. `terrain.py` now emits its
final size directly.

### 4. Nothing produced the water layer at all

`water_payload.json` came from a one-off snippet. On a clean run there is no
water, and the bundle verifies as **PARTIAL** — correctly, quietly, and not as
intended. `pack.py` is now a real step producing exactly what the app still takes
straight from OSM. Everything else it draws comes from the routable graph, so the
old `payload.json` was dead weight and is gone.

### tools/pipeline.py

The sequence now lives in one runnable file rather than scattered through YAML,
so CI and a laptop cannot diverge. The workflow calls it.

**Clean run: 57 seconds**, all six artifacts, bundle COMPLETE, `www/app.js`
parses, all five verifiers pass, gate green.

| step | time |
|---|---|
| ingest (DNR + USFS + 2,787 OSM elements) | 8.0s |
| pack (242 water polys, 180 lines) | 0.1s |
| graph (conflate, node, 16,345 edges) | 1.2s |
| emit_graph (1,053 KB payload) | 0.3s |
| terrain (110 DEM tiles, 229 KB shade) | 3.8s |
| glyphs (107 SDF glyphs) | 0.4s |
| imagery (380 tiles, budget table) | 30.7s |
| bundle + build_app | 0.1s |

### The lesson, honestly

I wrote landmine 32 at take 10 — *"a pipeline with a hand step in the middle is
not a pipeline"* — and then shipped three more hand steps across takes 11 and 12
without noticing, because everything kept working. **Writing a landmine down does
not prevent it. Only running the thing from scratch does.**

Recorded as landmine 36 with a rule attached: any take that adds a pipeline step
must be followed by a clean run before shipping.

**DEFERRED this cycle:** A14 3D terrain and slope. A17 voice. The APK still needs
a device — but a clean checkout now genuinely produces the app.

---

## Take 12 — 2026-08-19 — The repo now builds the app

**The finding that mattered:** `www/` still held the take-2 spike. Eleven takes of
work lived only in standalone HTML files the repo could not produce, and the CI
workflow was still wired to planetiler and PMTiles. **A push today would have
built an APK of the take-2 spike.**

Nothing caught it. Every gate check asked whether files existed — none asked
whether they were *current*. The pipeline-provenance check passed happily because
`www/app.js` was a real file with no remote origins; it was simply the wrong app.

### One source, two outputs

`src/app.html` is now the only place the app exists. `tools/build_app.py` emits:

- **split** → `www/index.html` + `www/app.js` + `www/bundle/` — what Capacitor packages
- **single** → one self-contained HTML — what can be opened without a build

Same source, so they cannot drift again.

### The bundle model is now live in the app, not just in a tool

Split mode does not inline the payloads. The app boots by reading
`bundle/manifest.json` and honouring its three states (landmine 34):

- **complete** — everything present
- **partial** — required artifacts good, optional absent. Navigates fine, and the
  app *names the missing layers* in the panel and flips the badge to PARTIAL
- **unusable** — a required artifact missing. The region is refused with a plain
  explanation rather than rendered with holes

These are same-origin reads of files already on the device, so the NET guard stays
green — exactly the distinction PROTOCOL §8 was rewritten to make at take 10.

### A bug caught by simulating, not by reading

The loader required kinds `graph / terrain / glyphs`; `bundle.py` emits
`network / terrain / labels`. **Every region would have been refused as
incomplete.** The app would have shipped showing "Region incomplete" on a
perfectly good bundle. Found by feeding real manifests through the state machine
with artifacts removed, not by reading either file. The gate now cross-checks the
loader's required kinds against what `bundle.py` actually emits.

### CI rewritten

The `bundle` job runs the real pipeline — `ingest → graph → emit_graph →
terrain → glyphs → imagery → bundle → build_app` — then gates before packaging.
planetiler and PMTiles are gone; the app renders from the routable graph, so
vector tiles were building something nothing consumed.

### Two new gate checks

- **`check_current`** — `src/app.html` must name the current take, `www/app.js`
  must read a bundle manifest, and the loader's required kinds must exist in
  `bundle.py`.
- **`check_style`** rewritten to scan `src/app.html` for `text-font` rather than a
  `style.json` that no longer exists, preserving landmine 4 and 30 coverage.

**DEFERRED this cycle:** A14 3D terrain and slope. A17 voice. Resumable region
download. The APK itself still needs Jacob's device — but for the first time the
repo would actually build the right thing.

---

## Take 11 — 2026-08-19 — Search, directions, region bundles

**Shipped:** `apex-offroad-take11.html`, 3.16 MB. Offline search, turn-by-turn
directions, and `tools/bundle.py` — the mechanism §8's invariant actually needs.

### A15 CLOSED — offline search

Landmine 19: vector tiles only hold what is in the viewport, so you cannot search
them for somewhere you are not already looking. The index is separate and built
at load from data already in the payload — **2,543 entries** that had been sitting
there unsearchable since take 6:

| kind | count |
|---|---|
| junction descriptors | 1,486 |
| roads | 540 |
| trails | 412 |
| trail numbers | 97 |
| places | 8 |

Ranked exact → string-prefix → word-prefix → substring, then by kind, then by
length. `tmm` finds The Meadows Motorcycle Trail; `h58` finds H58-1; `4460` finds
FR 4460; `pink` finds the Pink Store.

### Turn-by-turn (ROADMAP 5.6)

A blue line is not an instruction. Someone lost and tired needs words they can
read once and act on — and a turn list is also what you would relay over a radio.
Consecutive edges on the same way collapse into one step.

Bull Gap → Pink Store: **47 edges become 5 steps.** *Start on Bull Gap Hill Climb
· 4276 · 0.60 mi / Turn right Weeks Road / Turn left Fowler Road / Turn right
Curtisville Road / Turn left South Mount Tom Road.* Steps flag anything illegal
for the current machine and anything that climbs more than 8 ft.

### A16 — region bundles, with the failure case designed first

`tools/bundle.py` builds a region directory plus a manifest carrying SHA-256 per
artifact, and a bundle hash over the artifact hashes so a manifest cannot be
edited to match a corrupted file.

**The interesting question was never the happy path.** It is what the app does
when a region is half downloaded. Every artifact declares whether it is REQUIRED,
which gives three states:

- **complete** — everything present and hashing correct
- **partial** — required artifacts good, some optional absent. Still navigable,
  and the app must *name* which layers are missing
- **unusable** — a required artifact missing or corrupt. Refuse the region

That distinction is a safety decision, not a UX one. A region without imagery is
perfectly rideable. **A map with holes in it is worse than no map, because you
trust it.**

Current bundle: 1.88 MB — graph 1,053 KB, terrain 257, glyphs 61 required;
water, hillshade, imagery optional. Both failure modes were exercised: appending
one byte to `graph.json` gives UNUSABLE and exit 1; deleting `imagery.jpg` gives
PARTIAL and exit 0.

### Verified (`tools/verify11.py`)

Search ranking mirrored in Python and spot-checked across ten queries. Directions
checked structurally: the leg walk **ends on the routed target node**, and step
mileage matches routed mileage to **1.78e-15**. A wrong turn instruction is worse
than none — it reads as authoritative and gets followed.

**DEFERRED this cycle:** A14 3D terrain and slope. On-device provisioning UX —
`bundle.py` defines the format and the states, but nothing consumes it yet.
Voice for the turn list. Nothing toward the APK.

---

## Take 10 — 2026-08-19 — PROTOCOL §8 revised · satellite · A8 closed

**Shipped:** `apex-offroad-take10.html`, 3.16 MB. Satellite basemap, still zero
runtime requests.

### The protocol was wrong and Jacob caught it

§8 said no shipped asset may reach a remote origin, full stop. That conflated two
different phases and was quietly incoherent — every tile, DEM sample and agency
record has to come from somewhere, and `tools/` had been fetching all along while
the gate only policed `www/`.

**Rewritten:** provisioning may use the network; the field may not. What makes
that safe rather than aspirational is the invariant — *after provisioning
completes and verifies, the app must be provably complete, tested by a cold start
in airplane mode* — plus three controls: no remote origins in runtime assets, the
runtime NET guard, and **every provisioning host declared** in `docs/PROVISION.md`
with purpose, licence and refresh cadence.

`tools/manifest.py` generates that manifest and scans every tool and workflow for
hosts. The gate now refuses an undeclared one. An undeclared fetch is precisely
the thing that passes on the bench with wifi on.

### A8 CLOSED — measured, not extrapolated

USGS ImageryOnly, NAIP-derived, public domain. Five tiles sampled per zoom across
the AOI rather than one:

| zoom | m/px | tiles | AOI | statewide |
|---|---|---|---|---|
| z13 | 13.6 | 110 | 2 MB | 0.4 GB |
| z14 | 6.8 | 380 | 8 MB | 1.8 GB |
| z15 | 3.4 | 1,482 | 37 MB | 8.6 GB |
| **z16** | **1.70** | **5,772** | **159 MB** | **36.6 GB** |

**z16 is the useful ceiling and it costs 159 MB for a riding area** — one wifi
download the night before. Statewide at the same zoom is 36.6 GB, which settles
it permanently: imagery is per-region, always. z12-13 are cheap enough to ship
with the app as a fallback.

My take-8 estimate for the AOI at z16 was ~200 MB; measured is 159 MB. Close, but
the statewide figure is the one that actually decides the architecture and it was
never computed before.

**Correction:** the take-8 m/px figures in my own notes were wrong by a factor of
256 — I divided by tile size twice. z16 is 1.70 m/px, not 0.01.

### Satellite in the app

Basemap chip cycles Map / Satellite / Hybrid. In satellite mode a pale casing
goes under every trail line, because dark ink on dark jack pine is unreadable and
a trail you cannot see is not on the map. Hillshade drops to 0.16 over imagery
rather than off — relief still reads, it just stops fighting.

### The manifest found a hole immediately

Overpass was declared but nothing in the pipeline fetched it: `aoi.json` had been
produced by an ad-hoc curl at take 5 and every take since read a file a clean
checkout could not rebuild. The pipeline-provenance gate passed the whole time
because the *file* existed. `ingest.py` now fetches OSM. **A pipeline with a hand
step in the middle is not a pipeline** — landmine 32.

**A gate bug too:** the new provisioning check was named `check_manifest`, which
shadowed the existing Android-manifest check. Both were in the call tuple, so one
ran twice and the other never. Renamed to `check_provision`. Two checks, one
silently gone — landmine 33.

**DEFERRED this cycle:** A14 3D terrain and slope. A15 offline search. Region
bundle download UX (1.2/1.3/2.9), which §8 now makes the central architecture
rather than a nicety. Nothing toward the APK.

---

## Take 9 — 2026-08-19 — Labels · A3 closed

**Shipped:** `apex-offroad-take9.html`, 2.79 MB. **The map has text.** Plus
nearest-pavement and the about screen from A13.

**A3 CLOSED — the gap I had called #1 since take 1 while shipping 1,049 unused
names.** Landmine 4: MapLibre fetches glyph ranges from a `glyphs` URL and ships
no fallback, so symbol layers with no glyphs render silently blank. A CDN is
forbidden (PROTOCOL §8), so the pack had to be generated.

`tools/glyphs.py` builds SDF glyphs from a TTF and hand-encodes the Mapbox glyph
protobuf — varints and length-delimited fields, no protobuf dependency. 107
glyphs, 46 KB, 61 KB as base64.

**Served from a static `data:` URI, not a protocol handler.** MapLibre substitutes
`{fontstack}/{range}` only when the placeholders are present; without them it
requests the URL as-is and gets the same pack every time. One fontstack makes
that work and removes a moving part between the map and its text. `data:` is
already allowed by the offline guard.

**Typeface: NationalPark-Bold**, the face cut for National Park Service routed
signage. On a map of the Huron National Forest that is the subject's own
vernacular rather than a default sans. OFL, so it ships inside an APK legally.

**Two bugs the label work exposed, both at source:**

1. **Doubled parentheses on 1,066 edges.** `short()` wrapped a trailing code in
   parens without checking whether it already had them, producing *"The Meadows
   Motorcycle Trail ((TMM))"*. It had been in the data since take 5 and was
   invisible until something rendered it. Fixed with an `isalnum()` guard; 0
   remaining.
2. **Database names are not sign names.** *"The Meadows Motorcycle Trail (TMM)"*
   will not fit along a two-track at z14. Map labels now use the abbreviation
   plus the USFS number — **"TMM · H58-8"**, **"MAT · H57-6"**, **"RCT"** — which
   is shorter *and* closer to what is actually nailed to the post. The inspect
   card still shows the full name. Median label length dropped to 10 characters.

**Text carries provenance too.** Designated line gets its name and number;
advisory OSM line gets neither. **12,387 of 16,345 edges carry text.**

**Also shipped from A13:** 4.6 nearest pavement (straight-line bearing to the
closest thing a truck can reach you on — answers "which way do I walk" when the
bike will not move, and needs no router), and 4.12 the about screen, which states
plainly that this is not an emergency device, that the MVUM is the legal
authority, and that private property lines are not shown.

**Verified (`tools/verify9.py`):** the pack round-trips — thresholding the SDF at
192 reproduces the rendered glyph mask with **100.00% agreement**, worst case
100.00%. Zero bitmap size mismatches. And every one of the **68 distinct
characters** the map can render is present in the pack — a missing glyph renders
as a silent gap with no fallback offline, so coverage is proven rather than
assumed.

**DEFERRED this cycle:** A14 3D terrain and slope. A5 tiles in app storage.
Offline search (5.1) despite now having 1,049 indexed names. Turn-by-turn.
Nothing toward the APK — takes 5 through 9 are all viewers.

---

## Take 8 — 2026-08-19 — Terrain · A12 closed

**Shipped:** `apex-offroad-take8.html`, 2.72 MB. Hillshade, elevation everywhere,
climb-aware routing, elevation profiles. Still zero outbound requests.

**A12 CLOSED.** Public Terrarium-encoded DEM tiles (3DEP over CONUS) at z13,
110 tiles covering the AOI at ~13.6 m/px. **One ingest, four products** — node
elevations, per-edge climb, elevation profiles, and the hillshade underneath.
That is landmine 20 handled deliberately rather than discovered late.

**Relief across the AOI is 199 m — 879 to 1503 ft.** Enough to matter. Bull Gap
is a sand hill climb; a router that ignores elevation ignores the thing riders
actually feel.

**Shipped this take:**
- Hillshade inline as a 227 KB JPEG image source, multiplied under the sand at
  0.42 opacity so trails stay the loudest thing on screen. Toggle with ⛰ Relief.
- `Easiest` is now climb-aware: 1 m of climb is charged like 12 m of distance.
- New **Least climbing** profile charging climb at 45×.
- Elevation profile sparkline on every route card. A 12 mi route with 900 ft of
  climbing is a different ride from 12 mi with 200, and the shape lands where the
  number does not.
- ETA now includes climbing time, roughly a minute per 100 ft up.
- Elevation on the coordinate readout, the dispatch card and the inspect card.

**The 724 KB hillshade problem.** First render came out 724 KB — unusable inline.
Cause was not resolution: Terrarium quantises to 1/256 m and resampled 3DEP
carries stair-step noise, so shading it raw produced high-frequency speckle that
JPEG cannot compress. Fix was to **blur the elevation, not the shade**, which
improved the look and the size together. 227 KB at 850 px. Node sampling still
reads the unblurred grid, so distances and climb stay honest. Landmine 28.

**PIL cannot Gaussian-blur a float image**, which forced a rewrite of the decode,
blur and shade path in numpy. That turned out better anyway — vectorised, and the
whole pipeline is now about twenty lines instead of three nested loops.

**Verified headlessly (`tools/verify8.py`):**
- 9,285 nodes sampled, zero null or zero samples.
- Landmarks read true: Mio 965 ft (lowest — it sits in the Au Sable valley),
  Bull Gap 1070, Mack Lake 1175, Rose City 1217, Pink Store 1240.
- **Climb conservation exact: 0/16,345** profiles disagree with their stored
  gain/loss totals.
- Profile endpoints against node elevations: median mismatch 0 m, p95 1 m.
- Network total gain 88.9k ft.

**Honest limitation, landmine 29:** the steepest *segment-averaged* grade in the
network is 3.4%, which is not what Bull Gap feels like. Long edges average a short
steep pitch into nothing. Per-edge climb is right; per-edge *grade* understates.
Anything that reports "steepness" must work from the profile, not the average.

**DEFERRED this cycle:** 3D terrain (needs the encoded DEM shipped, not just the
shade). Slope shading. A13's four unbuilt Phase 4 items. Nothing toward the APK —
takes 5 through 8 are all viewers.

---

## Take 7 — 2026-08-19 — Phase 4 safety core

**Shipped:** `apex-offroad-take7.html`, 2.17 MB. Breadcrumb recording, back-to-truck,
retrace, off-route alert, dispatch card. All offline, all verified headlessly.

**Built in AGENDA A11 order, not roadmap order.** A11 said retrace ships before
anything else in Phase 4 because it needs no router, no network and no agency data.
That held: `retrace` touches nothing but the recorded track. If the graph were
corrupt, the tiles missing and the DNR service gone, it would still get you out.

**Shipped this take:**

| Task | What it does |
|---|---|
| 4.1 | Breadcrumb records automatically, 7 m jitter gate |
| 4.2 | Truck pin drops itself where recording starts |
| 4.3 | Back-to-truck distance + compass bearing, live on the rail |
| 4.4 | Off-route alert at ~260 m, haptic first then visual |
| 4.7 | Dispatch card |
| 4.11 | REC badge counts crumbs — a silent recorder is a failed one |
| 4.14 | **Retrace** |

**A7 gets a better answer than digitising.** Junction numbers are not published
(closed negative, take 4) and inventing our own would produce numbers nobody could
check against a post. Instead junctions are named by what meets there:
*"Ogemaw Hills Route (OHR) × Rose City Trail (RCT)"*. Verifiable from the map and
from the ground, needs no digitising. **3,706 junctions named** — 3,332 with two
ways meeting, 374 with three.

**Limitation, recorded as landmine 26:** these descriptors are not unique. OHR
crosses RCT in several places, so the same string appears more than once. The
dispatch card always leads with decimal degrees and gives the junction as
supporting detail, never as the primary fix.

**Ride simulator added** — a harness, not a product feature, for the same reason
`verify6.py` exists. Phase 4 cannot be exercised without a bike and a tank of gas
otherwise. `▶ Ride it` follows the selected route laying a track;
`😖 Wrong turn` diverts at the next junction so the off-route alert can be seen
firing rather than assumed to work.

**Verified headlessly (`tools/verify7.py`):**
- Bearings reciprocal: Bull Gap → Pink Store 217.1° SW, reverse 37.1° NE.
- Retrace lossless: forward 3.5791 mi, reversed 3.5791 mi, delta 0.00e+00, and
  the reversed track ends exactly on the truck.
- Jitter gate: 240 noisy fixes over a 3.579 mi track produced 77 crumbs and
  3.659 mi — **+2.2%** inflation under heavy noise.

**A bug caught by the syntax check:** an earlier patch double-escaped an apostrophe
inside a JS string literal, which terminated the string and broke the entire
script. Nothing about the page would have hinted at the cause. Extracting the
inline script and running `node --check` against stubs is now part of the build.

**DEFERRED this cycle:** terrain and elevation entirely — no DEM, so no climb
costs, no elevation profiles, no hillshade. 4.5 (nearest pavement), 4.9 (low
power), 4.20 fuel is take 6 only. Nothing toward the APK.

---

## Take 6 — 2026-08-19 — Conflation solved · routable graph · Return Home works

**Shipped:** `apex-offroad-take6.html`, 2.10 MB. Routing, machine legality and
Return Home, all offline, all from agency data.

### Conflation — PROVEN, and the answer was not what I assumed

Densified every line to 20 m and measured USFS against DNR within 25 m:

| | total | duplicated | |
|---|---|---|---|
| USFS trails | 116.5 mi | 110.4 mi | **94.8%** |
| USFS roads | 386.8 mi | 48.9 mi | **12.6%** |

The two agencies are not redundant the way landmine 11 implied. USFS *trails* are
almost entirely the same physical lines the DNR already publishes — Michigan
designates trails running on Huron NF ground, so both publish them. USFS *roads*
are 87% additive and are most of the network's mileage.

**So the rule is asymmetric:** drop duplicate USFS trails, keep every USFS road,
carry the USFS trail number onto the DNR feature it matched. 43 duplicates
dropped, **41 trail ids merged** — DNR trails now know they are H57-7, H58-1 and
so on, which is what you would read to a dispatcher. Neither source alone had both
the closure status and the number.

### Routable graph — PROVEN

Vertices snapped to a ~12 m grid, lines split where two or more meet, then 132
dangling ends pulled onto junctions within 30 m. Result: **9,285 nodes, 16,345
edges, 2,114 network miles, 49 components — the largest holding 99.4% of edges and
99.2% of mileage.** One connected network, which is the precondition for routing
at all and was genuinely uncertain beforehand.

### Return Home — ROADMAP 4.13-4.24, working

Four profiles over that graph: Fastest, Easiest, Pavement soonest, Shortest.
Bull Gap to the Pink Store on a dirt bike: 12.3 mi / 27 min fastest against
11.6 mi / 33 min shortest, and the shortest spends 7.5 mi off pavement versus 2.3.
The tradeoff is real, not decorative.

Also shipped: fuel range (4.20) flagging routes past what is in the tank, sunset
maths (4.21) warning about arriving after dark, route confidence (4.23) reporting
how much of a route is designated versus an OSM guess.

**Machine legality (7.1 / 7.4) is live**, driven by MVUM and DNR width data rather
than inference. Closed segments are never routed through.

### A bug the headless verifier caught, not the browser

`nearestNode` snapped to the geometrically closest node regardless of machine, so
a 72" side-by-side landed on a 50" trailhead and every profile returned "no legal
route". Wrong, and confidently wrong — a legal route existed. Fixed by snapping
only to nodes carrying at least one edge legal for the machine. Side-by-side now
routes 11.6 mi / 20 min. Cards also disclose off-network distance to the pins.

Written up as **landmine 24**. `tools/verify6.py` mirrors the JS cost functions in
Python precisely so the two can disagree out loud.

### Process note

The take-6 doc write silently did not run on the first attempt: a shell `&&` chain
short-circuited on a failed copy and skipped the whole block. The gate caught it —
five stamp failures — which is the second time in three takes it has caught
something invisible to reading. This is exactly what PROTOCOL §7 is for.

**DEFERRED this cycle:** retrace (4.14) needs a recorded track and take 6 is a
viewer. Turn-by-turn. Junction digitising. Imagery. Nothing toward the APK.

---

## Take 5 — 2026-08-19 — Real agency data in the app · A9 closed

**Shipped:** `apex-offroad-take5.html`, 1.45 MB, self-contained. First build with
authoritative data rather than OSM alone.

**A9 CLOSED — USFS MVUM, PROVEN:**
`apps.fs.usda.gov/arcx/rest/services/EDW/EDW_MVUM_01/MapServer`, layer 1 roads /
2 trails. In the AOI: **366 roads, 46 trails.**

**MVUM is richer than the DNR for legality.** Per-vehicle-class open/closed with
date ranges, all populated: `motorcycle` 46/46 open, `atv` 37/46, and the >50"
classes 3/46. `id` carries trail designations (H57, H58-1, H58-8) and `name`
resolves (MEADOWS - MCCCT, MACK LAKE LOOP TRAIL, MEADOWS-M33 TRAIL). This makes
ROADMAP 7.4 vehicle-profile filtering a data join, not an inference — the DNR's
single width field can't express "motorcycle yes, ATV no" and the MVUM can.

**Ingest built** (`tools/ingest.py`): pulls DNR layers 11/12/13/14 and MVUM 1/2,
normalises to one schema, stamps `src` and `auth` on every feature.
**648 features, 648 named.** After RDP: 651 lines, 11,081 coords, 191 KB.

**Provenance rendering proved (ROADMAP 7.2).** OSM tracks and paths now draw pale
and dashed as advisory; DNR and USFS lines draw solid and coloured by designation
class. Standing next to each other, the difference between "legally designated"
and "somebody drew this in OSM" is visible at a glance. This was scheduled for
Phase 7 and came almost free once provenance was in the schema.

**Tap-to-inspect added**, which proves the attribute pipeline end to end: name,
source, trail id, width class, per-vehicle status, season, licence.

**PROVEN:** 246 DNR + 412 USFS features coexist in one style with no conflation
yet, and the duplicate-geometry problem is now visible rather than theoretical —
landmine 11 confirmed by eye at Bull Gap.

**DEFERRED this cycle:** conflation itself (3.11). Junction digitising (3.8).
Imagery sizing. Nothing built for the APK path; take 5 is a viewer, not the app.

---

## Take 4 — 2026-08-19 — Named APEX Off-road · DNR data reconnaissance · Return Home

**Named.** APEX Off-road. appId `com.apexoffroad.app`.

**Reconnaissance — the point of this take.** Jacob can't build or test for a while,
so the unblocked work is data. Went to the live Michigan DNR ArcGIS service and
inspected it rather than reading about it.

**Service — PROVEN:**
`https://gisagodnr.state.mi.us/arcgis/rest/services/DNR/DNRTrailsOPENDATA/FeatureServer`
23 layers. Six matter: 11 ORV Routes, 12 ORV Trails, 13 Motorcycle Trails,
14 MCCCT, 0 Temporary Closures, 1 Temporary Reroutes.

**AOI coverage — PROVEN by query:**

| Layer | Features in AOI |
|---|---|
| ORV Routes (72") | 15 |
| ORV Trails (50") | 159 |
| Motorcycle Trails (24") | 25 |
| MCCCT | 47 |
| Temporary Closures | 20 |

164.1 miles of ORV trail. Named trails resolve correctly: Mack Lake Motorized
(MAT), The Meadows (TMT), Rose City (RCT), Meadows-to-Rose City (MRT), Ambrose
Lake-to-Rose City (ART), Alcona County (ACT).

**Attributes that are genuinely populated — PROVEN:**
- `TrailWidthFeet` — 116x "50 Inches Or Less", 43x "12 Feet And Over".
  ROADMAP 3.6 and 7.1 need no derivation. The data is just there.
- `OpenClosedStatusORV` — 148 Open, 11 Temporarily Closed. Live closures, 7.3.
- `LicenseType` — ORV licence + trail permit vs snowmobile permit. 7.7.
- `TrailOnRoad` — distinguishes National Forest Road / State Forest Road. This is
  a direct assist to conflation (3.11), which I had assumed would be pure geometry.

**Attributes that are dead — PROVEN, and this is a trap:**
- `TrailTreadType` — 159/159 null (`-1`)
- `SpecialRestrictionType` — 159/159 null (`-1`)
- `SurfaceType` — 159/159 "Dirt Natural". No sand vs hardpack distinction, which
  is exactly the distinction that matters here. ROADMAP 6.5 cannot use this.

**A7 ANSWERED — NEGATIVE.** No junction/marker number field exists in any of the
23 layers, and the DNR services folder contains only trails and survey corners —
there is no marker point layer. Junction numbers live on the printed PDF maps and
the physical posts, not in the published GIS. ROADMAP 3.8 is therefore not a
schema question, it is a digitising job. Rescoped and downgraded; still worth
doing, but it is no longer nearly free.

**Return Home added** at Jacob's request as ROADMAP 4.13–4.24, with fuel range
and daylight awareness, which neither onX nor AllTrails does.

**DEFERRED this cycle:** USFS MVUM reconnaissance (same treatment, next). No tiles
built from DNR data yet. No conflation attempted. Imagery still unmeasured.

---

## Take 3 — 2026-08-18 — Cross-project scrub + full feature backlog

**Scrubbed.** PROTOCOL.md carried five references to a prior unrelated project as
provenance for its rules. Removed — the rules now stand on their own terms. Also
renamed the Capacitor appId from a carried-over identifier to `com.offroadmi.app`
and retitled the CI artefacts.

**Why it mattered:** provenance in a rules document is not neutral. It invites a
future reader to go look up context that has nothing to do with this app, and it
made the protocol read as borrowed rather than owned.

**ROADMAP rewritten as a full backlog.** Now carries an explicit feature-parity
matrix against onX Offroad and AllTrails, since Jacob's stated bar is "if either
of them has it, I probably want it." Phases grew from 6 to 9: basemaps/imagery
and search/navigation were previously folded into other phases and were too big
to sit there.

**Reframed around the actual driver.** Jacob has been lost in these woods. Phase 4
is renamed and expanded accordingly, and off-route alerting was promoted from
"nice to have" to a named exit criterion.

**Workflow AOI corrected** to the take-2 settled bbox `-84.30,44.42,-83.90,44.72`,
`TILES_KEY` bumped to `neml-v1` so the stale Bull-Gap-only cache is not reused.
This was called out as deferred in take 2.

**PROVEN this take:** nothing new about the system. No device test has run.

**DEFERRED this cycle:** all Phase 1+ implementation. Satellite imagery sizing is
estimated, not measured (landmine 18). No DNR or USFS data has been touched yet.

---

## Take 2 — 2026-08-18 — Standalone inline build

**Shipped:** `bullgap-mio-rosecity.html`, 1.27 MB, fully self-contained.
MapLibre, CSS, data and logic all inlined. Zero runtime requests.

**Why:** Jacob has no laptop. Needed something testable on the phone today
without CI, sideloading or a server.

**AOI settled at `-84.30, 44.42, -83.90, 44.72`.** First proposal was
`-84.25,44.50,-83.85,44.75` (missed Rose City). Jacob's screenshot implied
`-84.40,44.27,-83.65,44.71`, which pulled 12,054 features — too big to inline.
Landed on the same footprint as the original, nudged south. Covers Bull Gap,
the Meadows, Mio, Luzerne, Mack Lake, the Pink Store, Rose City.

**Data:** Overpass, 2,787 features / 55,693 coords. RDP at ~8 m and 1e-5
quantisation cut it to 21,640 coords. Delta-encoded ints -> 182 KB payload.

**PROVEN this take:**
- Chrome blocks geolocation on `file://` (landmine 2).
- The full screenshot block is ~4.3x the feature count of the AOI — the point
  where inline GeoJSON stops being viable (landmine 8).

**UNKNOWN, unchanged:** everything in Phase 0.2–0.5. No device numbers yet.

**DEFERRED this cycle:** the APK path entirely. Labels. Any DNR or USFS data.
The Fold inner-screen layout, by Jacob's explicit instruction.

---

## Take 1 — 2026-08-18 — Spike scaffold + CI

**Shipped:** `bullgap-spike/` — Capacitor + MapLibre + PMTiles scaffold, and a
GitHub Actions workflow (bundle -> pages -> apk) that builds tiles with
planetiler, deploys Stage 0 to Pages and publishes a signed-debug APK to
Releases. Phone-only: four hand-created files, no laptop.

**Architecture chosen:** Capacitor + MapLibre GL JS + PMTiles, shipped as a
sideloaded APK. Rejected: PWA (fails background GPS under One UI), Kotlin +
MapLibre Native (better ceiling, whole new language), Flutter (new language, no
gain).

**Deliberate design:** the spike splits its unknowns instead of testing them
together. Stage 0 (browser) answers renderer perf; Stage 1 (APK) answers Range
support. Testing both at once would leave a failure unattributable.

**DEFERRED:** labels, ORV data, routing, everything in Phases 1–6.
