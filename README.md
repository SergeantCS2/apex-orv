# APEX ORV

Free, offline-first trail navigation for northeastern Lower Michigan ORV
riding — Bull Gap, Mio, Rose City, Luzerne, Mack Lake, The Pink Store.

**Install:** grab the signed APK from the latest
[Release](../../releases/latest). Android 8+. ~50 MB, satellite imagery
included. Once installed it needs no network, no account, no permissions
beyond location.

Michigan DNR + USDA Forest Service designations, OpenStreetMap for context —
**every line on the map says which source it came from and whether you may
ride it.**

## What it does

Offline map with satellite/hybrid basemaps · activity filter that is also the
legend · six routing profiles + loop generation, most-trail first · turn-by-turn
with running mileage · elevation profiles · offline address + county reverse
geocoding · a dispatch card built to be read aloud to emergency services · GPS
breadcrumb, retrace, truck pin · a 41-check on-device self-test.

## The fine print that matters

**This is not an emergency device.** It cannot call anyone. In country like
this a satellite messenger does something no map can — carry one.
The MVUM and DNR signage are the legal authority; this app is not a defence.
Private property lines are not shown; that data is licensed and not public.

## Building

Drop `apex-seed.zip` in the repo root and push. The workflow unpacks it,
verifies it, and publishes a signed release APK. Release notes come from
`ci/RELEASE.md`. Docs live in `docs/` — start with `V1-STATE.md`.
