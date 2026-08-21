# Working in this repo

APEX ORV is an offline-first Android trail map for ORV riding in north-east
lower Michigan. It is built for one rider, Jacob, on a Samsung Galaxy Z Fold 7,
with no laptop in the loop. Everything below exists because getting it wrong
once cost a day.

**Read `docs/PROTOCOL.md` first, then `docs/LANDMINES.md`.** Seventy-six entries,
every one of them something that already went wrong here. Skimming them is the
cheapest hour you will spend.

---

## The one-paragraph version

`tools/pipeline.py` fetches from state and federal agencies, builds a routable
graph plus satellite tiles, assembles a region bundle, executes the shipped app
in two harnesses, and renders it in real Chrome. `tools/gate.py` refuses to let
anything ship that has drifted. CI runs both on push and produces a signed APK.
You change `src/app.html` and `tools/*.py`; everything else is generated.

## Rules that are not negotiable

1. **The gate is the contract.** `python3 tools/gate.py` must pass before you
   ship. It enforces documentation currency, offline integrity, class legality,
   source/layer coverage, harness fidelity and more. If it fails, the repo is
   wrong — do not work around it.

2. **Verify the check before you believe it.** Landmine 54 has fired eight
   times. A failing test is more often a wrong test than a broken product, and a
   passing test proves nothing until you have watched it fail on purpose.
   Every guard here has a negative control; add one for every guard you write.

3. **Nothing may route a rider onto a trail they may not legally ride.** Non-ORV
   routes (hiking, equestrian, ski, snowmobile, non-motorised NFS) are drawn so
   the map is honest about what exists, and are held out of the routing graph
   entirely. `check_class_legality()` enforces this against the *built* graph,
   not against a list. Do not weaken it.

4. **The field has no network.** `PROTOCOL.md` §8: provisioning may fetch, the
   app may not. One CDN reference passes every test on wifi and dies in the
   woods. The self-test asserts zero remote requests.

5. **Assert your anchors.** String-replacement patches that silently no-match
   have shipped call sites with no definitions and guards that never ran
   (landmines 65, 75). `assert old in s` before every replace, and grep after.

6. **A clean run after any pipeline change.** PROTOCOL §6b. It has caught an
   absolute path outside the repo, an empty-payload-treated-as-success, and a
   dependency that only worked because a stray file existed.

7. **Data claims need a source total.** Both agencies publish counts. "199 = 199"
   is worth more than any amount of confidence that an ingest looks right
   (landmine 76).

## Verifying your work

```bash
python3 tools/pipeline.py          # full build: ingest → … → smoke → render
node tools/smoke.mjs               # executes the SHIPPED app, 5 modes
node tools/render.mjs              # real Chrome, real GPU-less renderer
python3 tools/gate.py              # the contract
```

`smoke.mjs` runs the built `www/app.js`, not a copy — if it passes, that code
path executed. `render.mjs` answers "did it DRAW", which no stub can (landmine
69). Both must pass; they measure different things on purpose.

## Shipping a take

Takes are numbered and never reused. In order:

1. Bump `OFFROAD_TAKE` in `BUILD`, and the title in `src/app.html`
2. Write the `docs/HANDOFF.md` entry **before** shipping — what changed, what was
   measured, what was ruled out, and what you got wrong
3. New landmine for anything that bit you, numbered, never renumbered
4. `python3 tools/stamp.py` then `python3 tools/gate.py`
5. Rebuild `www/` **before** packaging — the version stamp lives in the built
   artifact, not the source (landmine 75)

## What is generated, and must not be committed

`bundles/`, `www/bundle/`, `www/vendor/`, `imagery_tiles/`, `android/`,
`node_modules/`, `*_payload.json`, `aoi.json`, `authoritative.json`,
`graph_raw.json`, `dem_cache/`, `img_cache/`.

Committed on purpose: `assets/logo-master.png` (source artwork) and
`signing/apex.keystore`. The keystore is deliberate — this is a sideloaded
personal app and a stable key is what lets take N install over take N−1. Its
certificate reads `CN=APEX Off-road` and **must keep reading that**.

## Honesty is a feature here

This app tells a rider what it does not know. Bundles report themselves PARTIAL
when a layer is missing; dispatch refuses to print a coordinate it cannot stand
behind; a point with no address shows nothing rather than a guess; the router
refuses rather than shipping a route that cannot get someone home.

If you find yourself making something look complete when it is not, stop. The
worst outcome is not a missing feature — it is a confident wrong answer to
someone thirty miles into a forest with an hour of light left.
