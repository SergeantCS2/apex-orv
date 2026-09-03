# APEX ORV — NEW CHAT BRIEF · V3 (written at take 177, 2026-09-02)

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
ArcGIS layers, USGS DEM and imagery; a verification harness of ~300
smoke assertions across six modes, 252 browser render checks and ~40 gate
checks; append-only ledgers.

## Where it stands at take 176 — PRODUCTION

**Take 176 is the production baseline.** It is on Google Play under
`com.apexoffroad.app` in closed testing, with real testers from
2026-09-02. Nothing before it has been used by a stranger's phone; the
tester guide (docs/TESTING.md → Pages testing.html) is written for them
and lists what has never been ridden.

What the app is at 176:
- **Five modes**, one chip: Off-road · Outdoors · Hunt · Water · Camp.
  Each has its own pins, layers, routing machine and basemap.
- **Navigation** (takes 170–173): a follow camera that turns to your
  course and tilts; turn-by-turn from the planned route with distance,
  ETA from your own pace, "You have arrived", and re-routing at 40 m off;
  river navigation that points DOWNSTREAM, counts down to the take-out
  for your craft and calls a dam first; hike guidance at walking pace;
  voice, feature-detected (the self-test's VOICE line reports what the
  phone has); and a trip that survives the app dying — "Resume your
  trip?" on relaunch.
- **Pins that stack** by distance at every zoom (take 169 — grid
  bucketing was the earlier mistake), mixed stacks allowed, a tap opens
  the pile and moves the map in.
- **Camp mode** (take 174): 433 of 915 campgrounds typed from OSM
  (DNR/USFS/county/private, rustic/modern, fee), the three national
  forests from USFS at 23 KB, dispersed-camping land shaded.
- **The unnamed-pin cleanup** (take 175): 98 private docks and 420
  duplicates dropped, 440 launches and beaches named for their lake, the
  rest stepped back outside Water. 25,291 places.
- Data: 573,320 routable edges / 415,001 nodes, 76 river corridors with
  float times, 4.7M acres of public land, 241 USGS gauges (live on a
  tap), statewide imagery z11–z12 with z13–15 patches over the riding
  areas, 118.9 MB bundle, ~185 MB package.
- Play hardening: comments scrubbed from the shipped web assets by a
  vendored parser; AD_ID asserted absent on the built artifact; sources
  and non-affiliation disclaimer in the listing and under Tools → Data
  sources; two-key signing (dev keystore for sideload, private upload key
  via Actions secrets for the AAB); no R8 yet (A183 explains it).

## The environment (hard-won facts — read LANDMINES 200–214)

- Build sandbox: **4 GB RAM, one worker, no GPU.** Swap lives at
  `/tmp/sw` (2 GB; `swapon /tmp/sw` before heavy work). The disk quota
  shrinks under you: clear `/tmp/puppeteer_dev_chrome_profile-*` and
  `/tmp/apex-fatal-*` before every heavy run; `df -h /` before blaming
  anything else. ENOSPC kills a process before it writes one line.
- **One heavy stage per turn.** A render (~10 min) or a gate (~20 min)
  launched with `setsid nohup` and polled with `sleep 285` inside the
  SAME turn. Across a turn boundary the process may die — or only its
  child may, leaving a parent shell that advances to the next command
  and spawns a second render. Two renderers starve each other to zeros.
  Before launching: kill parent chains FIRST, then node/chrome, then
  confirm `ps` is quiet.
- render.mjs respawns its browser before the machine-legality probe; a
  single page cannot carry the whole run. The gate keeps 700 characters
  of a render failure. Every stack-badge read waits for the map's idle
  event, not just the worker's loaded().
- The build parses app.js before it scrubs and removes it on failure.
- Two chats write one ledger: check the highest agenda and landmine
  numbers before assigning one (A177 and landmine 211 both collided).

## How a take works (PROTOCOL.md is the law)

Record before build; HANDOFF entry, AGENDA item with a `Ruled out:` line,
stamps at the take (tools/stamp.py); build (tools/build_app.py split);
smoke; render; gate; seal a zip named apex-seed-t<N>.zip with the sha256
in chat. The seed never carries www/bundle — CI runs the whole pipeline.
The gate refuses stale stamps, missing ruled-outs, undeclared hosts,
duplicate ids, unparsed artifacts, and any comment in the shipped assets.
CI's gate is the last word; a red CI run means the seed is not uploaded
to Play.

## V3: what the new chat is for

V3 is the public release and everything that comes from strangers using
it. In order:
1. **Tester feedback loop.** Every field report becomes an agenda item
   with a take, as the first external tester's did (A163–A169). The
   navigation arc, Camp and the pin cleanup have never met a real trail.
   The two reports most wanted: the self-test VOICE line, and how the
   follow camera feels at speed.
2. **A190 — HD download tiers** (designed; build in take 177+): this
   view, this county, whole state at z13 (~430 MB clipped to land); needs
   a six-way parallel fetcher, wake-lock through the save, and rate
   discipline toward USGS.
3. **A183 — R8**, once testers can device-verify the native bridge.
4. **A189 — "Security" / road-hazards mode** (idea, design first): Flock
   ALPR cameras and hazards are OpenStreetMap tags the ingest can keep.
5. Production release from closed testing to public listing when the
   tester round is clean.

Standing rules the maintainer has set: no invented features (reference
material first — LANDMINES governs); measurement before decisions; real
progress bars, never timers; nothing downloads on its own; design before
build on anything large, with explicit ruled-outs; one issue at a time;
audit before sealing; "Continue" delegates, "get this right" means do not
seal until every item is hit.
