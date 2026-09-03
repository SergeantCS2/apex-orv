# APEX ORV — NEW CHAT BRIEF · V3 (rewritten at take 180, 2026-09-03)

Read this first, then the top entries of HANDOFF.md. The full ledgers
(LANDMINES, AGENDA, PROTOCOL, DESIGN, PROVISION) are beside this file.

## What this project is

A free, fully offline Android trail-navigation app for Michigan — both
peninsulas and Isle Royale — for ORV riders, paddlers, hunters, hikers and
campers. "A love child of onX Offroad and AllTrails, but Michigan only."
The maintainer develops and tests entirely on a Samsung Galaxy Z Fold
(no laptop; Termux for shell). Claude edits a persistent workspace, seals
a seed zip, the maintainer uploads it to GitHub, Actions builds the signed
APK and the Play AAB. Stack: Capacitor 8 + MapLibre GL + an offline
bundle; Python pipeline over the Geofabrik Michigan extract, DNR/USFS
ArcGIS layers, USGS DEM and imagery; a verification harness of 300 smoke
assertions across six modes, 267 browser render checks and 41 gate
checks; append-only ledgers.

## Where it stands at take 180

**Take 176 is the production baseline** — on Google Play under
`com.apexoffroad.app` in closed testing with real testers since
2026-09-02. The tester guide (docs/TESTING.md → Pages testing.html) is
written for them. **No field report has arrived yet.** The navigation
arc (170–173), Camp (174), the pin cleanup (175) and everything below
have never met a real trail.

What the app is at 176 (unchanged since):
- **Five modes**, one chip: Off-road · Outdoors · Hunt · Water · Camp.
- **Navigation**: follow camera, turn-by-turn with ETA from your own
  pace, re-route at 40 m off, river navigation downstream to your
  take-out with dams called first, hike guidance, feature-detected
  voice, and a trip that survives the app dying.
- **Pins that stack** by distance at every zoom (169).
- **Data**: 573k routable edges, 76 river corridors, 4.7M acres public
  land, 241 USGS gauges live on a tap, 25k places, statewide imagery
  z11–12 with z13–15 patches over eight riding areas, manifest bytes
  118.9 MiB (~185 MB package).

What V3 has added since (177–180), all gated, none device-verified:
- **177** — paperwork only; 176 locked as production.
- **178 · A190 H1** — the HD downloader: six lanes, 300 ms drain per 60
  tiles, one retry per tile, a ref-counted screen wake lock (WAKE)
  shared with navigation, progress that names the tier, per-zoom tile
  sizes MEASURED on the shipped patches (z13 14.6 KB · z14 17.7 · z15
  19.4 — the old flat 22 KB overstated a z13 tier by half).
- **179 · A190 H2** — three tiers on the HD sheet: THIS VIEW (z13–15),
  <NAME> COUNTY (z13–15, the county under the map centre), THE WHOLE
  STATE (z13, **12,500 tiles / ~178 MB** — the design's 430 MB was the
  bounding box, which is 69% water). Each quoted before its button, each
  checked against navigator.storage.estimate() with a 20% margin, the
  state behind a confirmation, time-left measured from the observed
  pace. **179 · A191** — gauges.py survives a refusing USGS (retry, then
  the previous build's payload, then a spoken omission; gate-asserted)
  after the maintainer's first CI run of 178 died on an NWIS 503 that
  no take had caused.
- **180** — housekeeping: A189 DESIGNED (below), A160 streaming CLOSED
  (nothing downloads without a tap — the maintainer's rule), three small
  fixes from audits, this brief.

**The field test that matters most**: the whole-state HD save. Whether
Samsung's WebView grants ~215 MB of IndexedDB is the one fact the
harness cannot know. Second: the self-test VOICE line and the follow
camera at speed.

## The environment (hard-won — read LANDMINES 200–217)

- **Sandbox: 4 GB RAM, one worker, no GPU, disk quota that shrinks.**
- **Heavy stages launch as the FIRST call of a turn and are polled to
  their verdict inside that turn** (`setsid nohup … &` then `sleep 285`
  polls). A render is ~18 min here, a gate ~22. One launched late in a
  turn dies at the turn boundary with no verdict — it happened twice in
  178 (landmine 214). Two renderers alive at once starve each other.
- **Before EVERY heavy launch**, in this order: `rm -rf
  /tmp/puppeteer_dev_chrome_profile-* /tmp/apex-fatal-*`; `swapon --show
  | grep -q sw || swapon /tmp/sw` (the VM cycles between turns and drops
  swap while the 2 GB file survives — landmine 215; a render at 90 MB
  free with three Chromes up is a death); `ps -eo comm` shows no
  node/chrome/python3; `df -h /`.
- **Kill by exact name, never by pattern**: `pkill -x node; pkill -x
  chrome`. `pkill -f`/`grep` with a pattern your own shell carries kills
  or finds YOUR call first (landmine 204, three times in one session).
- **Stubs on browser accessors need `Object.defineProperty`**
  (`navigator.wakeLock`, `navigator.storage`) — plain assignment is
  silently dropped and the real API answers (216).
- **Nothing inside a page.evaluate block may throw** — a missing element
  is a finding returned to the ok() line; a throw ends the render with
  no verdict (217).
- **Do not re-split www/ while a render is running** — the respawn at
  the machine-legality probe reloads app.js from disk.
- The gate buffers its whole output: a 0-byte log for 20 minutes is
  normal; read `ps` for life.
- Two chats may write one ledger: check the highest agenda and landmine
  numbers before assigning one.

## Cold rebuild of the sandbox (~45 min of wall time, seven launches)

The workspace at /home/claude/apex may be gone at session start. Restore
from the newest seed named in HANDOFF's SEAL line. Then:
1. `fallocate -l 2G /tmp/sw && mkswap /tmp/sw && swapon /tmp/sw`;
   `pip install --break-system-packages osmium shapely`; `npm ci`;
   `npx puppeteer browsers install chrome`.
2. `www/vendor/` is NOT in the seed and smoke passes without it (a
   stub); render cannot. Curl the three MapLibre 5 files from unpkg as
   ci/bundle.sh does.
3. Pipeline, one group per turn, each polled to completion: `ingest`
   (~10 min, downloads the 297 MB extract) · `bas gauges nf pack poi` ·
   `graph emit_graph` (memory peaks at ~120 MB free — run nothing beside
   it) · `areas publicland terrain contour` · `corridor landcover glyphs
   context` · `address` · `APEX_PHOTO_BUDGET_S=0 … photos imagery` (~14k
   USGS tiles, ~10 min) · `bundle build_app smoke smoke-sim smoke-fatal
   smoke-dead smoke-away`.
4. Expect the record within OSM drift: ~25.3k places, ~415k nodes /
   ~574k edges, 76 corridors, 323 summits, address and context EXACT,
   manifest bytes 118.9 MiB. No check asserts an exact OSM count.

## How a take works (PROTOCOL.md is the law)

Record before build: HANDOFF entry, AGENDA item with a `Ruled out:`
line, stamps at the take (tools/stamp.py — it now matches the gate's
stamp regex); measure before deciding; build (tools/build_app.py split);
smoke (~100 s); render; gate; audit the diff cold (§0.3) and fix or
record what it finds; seal `apex-seed-t<N>.zip` from the previous seed's
manifest (`unzip -Z1 prev.zip | grep -v /$`) with the sha256 in chat. A
touched pipeline step must actually EXECUTE its changed path before the
seal (ingest skips the stream when aoi.json is present — move it aside
to force it). CI's gate is the last word; a red CI run means the seed
is not uploaded to Play.

## V3 order (the maintainer's, standing)

1. **Tester field reports** as they arrive — each an agenda item and a
   take. Nothing has arrived yet.
2. ~~A190~~ shipped (178, 179); field verdict pending.
3. **A183 — R8**, once testers can device-verify the native bridge.
4. **A189 — "Road hazards" LAYER**, designed in 180 on measured data
   (3,675 plate readers, 1,938 low bridges, 694 fords, 7,451 rail
   crossings, 0 speed cameras). Build after A183, on the maintainer's
   approval of the design in the item.
5. Production listing when the tester round is clean.

Also open, small: the Play screenshots (real captures), the CI cache
question (ingest re-streamed 388 s in CI though aoi.json is in the cache
list; locally the skip works).

Standing rules: no invented features (reference material first —
LANDMINES governs); measurement before decisions; real progress bars,
never timers; **nothing downloads on its own**; design before build on
anything large, with explicit ruled-outs; one issue at a time; audit
before sealing; card text literally honest; "Continue" delegates, "get
this right" means do not seal until every item is hit; the document is
the bug when it disagrees with the code.
