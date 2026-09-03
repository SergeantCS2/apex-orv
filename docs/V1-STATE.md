# APEX ORV — State of v1

Declared done by the maintainer at take 74 (2026-08-22), on the strength of a live
field test of take 73: **41 PASS / 0 FAIL** on-device (Galaxy Z Fold 7,
SM-F966U1), GPS first fix 5.8 s at ±6 m, screenshots confirming filter, route
cards, satellite legibility and labels in the wild.

## What v1 is

A single-region (`neml-bullgap`), single-APK, fully offline Android trail app.
No server, no account, no telemetry. The phone carries everything: graph,
terrain, addresses, counties, glyphs, and 2,008 satellite tiles.

## Numbers as of take 74

- Graph: **20,222 edges / 12,236 nodes**, ~2,241 mi, 99.7% routable together
- Search: 3,353 entries, three tiers (exact → compressed → one-edit)
- Addresses: 2,797 segments / 761 street names; anchors resolve **2 exact +
  4 near of 8** (near = bearing-and-distance, never claimed as the address)
- Counties: 9 polygons, 70 points, 1.4 KB — **100% agreement with
  unsimplified Census over 3,000 sampled points**
- Imagery: z12–15, 3.40 m/px, 2,008 tiles, 45 MB; APK ~50 MB total
- Performance on the Fold: avg 122 fps, p99 min 102, worst frame 10 ms
- Label start zooms: trail 10.8 · road 11.0 (both at the 1 mi scale) ·
  forest-road numbers 11.6 · show-only 13.0 · short-feature points 13.4
- Layout verified at 360x800, 412x915, 430x932, 411x960

## Feature surface

**Map.** Map/Satellite/Hybrid; hillshade toggle; difficulty-tier trail colours
(green route72 / blue trail50+fstrail / near-black moto24+mccct, all
white-cased), two-track brown, forest road grey-tan, show-only routes coloured
by use and dashed (hiking lime, equestrian violet, snow cyan, NFS moto amber).
Activity filter button doubles as the legend; both are generated from the one
`ACTS` table so they cannot disagree. Short named features get wrapping point
labels (`shortpts`), which is why M-33 Bull Gap Trailhead names itself.

**Routing.** Six point-to-point profiles (Most trail first — DESIG 0.55x /
DIRT 1.3x / paved 8x), loop generator using the same tables (first loop
offered: 15.9 mi with 14.3 mi trail in the field). Route cards: time,
off-pavement miles, designated/forest/paved split, hardest class, filled
elevation profile with low/high, fuel-range check, unverified-OSM mileage.

**Directions.** Turn arrows, names with on-the-ground IDs (H57-17), climbs,
per-step distance plus running total ("at 5.3 mi"), unnamed features in
italics as *unnamed two-track* — a class is never dressed as a name.

**Safety.** Dispatch card ordered for reading aloud: coordinates → address
(exact, or "Nearest address 0.2 mi NW of …") → **county** → trail → junction →
elevation → nearest pavement. Refuses to print a coordinate without a live
fix. Breadcrumb, lossless retrace, truck pin, haptics.

**Self-test.** 41 checks on-device covering bundle integrity, offline
cleanliness, rendering, UI reachability, data honesty, routing, safety, GPS.
Viewport-dependent quantities are info lines, not assertions (landmine 94).

## Pipeline (tools/)

`ingest` (DNR + USFS MVUM + OSM Overpass with 3 mirrors and a Census TIGER
fallback that marks its output so the cache retries OSM) → `conflate` (USFS
deduped against DNR; OSM deduped against agency geometry only at a
conservative 17 m / 0.85 threshold — see A60) → `graph` (noding, class
legality, largest-component stats) → `terrain` / `glyphs` / `address` /
`context` (state outline + 9 county rings from Census cartographic files) →
`bundle` → `build_app` (splits src/app.html into www/). `stamp` writes the
take into the app; `mkapex` generates the pasted workflow from `ci/build.yml`.

## CI

Push `apex-seed.zip` → seed job unpacks (deleting `.github` from the seed;
the workflow itself is the one file the seed cannot update), gated by
`APEX_GATE_SEED=1`; downstream jobs pin `ref: github.ref_name`; bundle and APK
steps live in `ci/*.sh`; release notes in `ci/RELEASE.md` via `--notes-file`.
Signed with `signing/apex.keystore` — **never change the keystore**; cert
SHA-256 52f61c461ee77b4a2f75b55cdbec67d21e48d26b35e673a8ec2545c692756c66.

## Verification

- `smoke.mjs` — five modes (gps, no-gps, fatal-drill, dead-renderer, away)
  against DOM/Map stubs; `check_stubs` in the gate fails the build if the app
  calls anything the stubs do not model (20 map calls, 14 El members covered).
- `render.mjs` — real headless render: label counts vs zoom, trail-name
  density at a known anchor, four-device layout fits (horizontal scroll is not
  overflow), in-page self-test, busiest-colour < 90%.
- `gate.py` — absolute paths, CI deps, checkout refs, workflow YAML
  (duplicate-key strict), stub coverage, AGENDA format. Green gate is the
  precondition for sealing every take.

## Open at end of v1 (the honest list)

- **A18** — ride telemetry: battery, canopy GPS, ground truth. Only a ride.
- **A60** — 5,390 duplicate agency/OSM spans draw as jagged parallel lines.
  Deleting them costs connectivity (proven); correct fix is a flag through
  `emit_graph`'s packed format: route both, draw one. Deliberately deferred.
- Trail-name density at riding zoom is 4–5 names per screen; fine, not rich.
- Bull Gap has no address within 2.5 km — the app correctly says nothing.
- Questions parked, not answered: county on the place card? merge same-name
  direction steps with different IDs? roads-always-visible in hiking filter?

## Where the memory lives

`docs/HANDOFF.md` — all 74 takes, newest first. `docs/LANDMINES.md` — 103
numbered process rules paid for in real failures; they are law here.
`docs/AGENDA.md` — the evidence ledger; every claim PROVEN / INFERRED /
UNKNOWN, with what was ruled out. `docs/V2-KICKOFF-PROMPT.md` — the brief for
the next session.
