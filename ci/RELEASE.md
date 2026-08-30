**Take 164 — release build (fixes the failed CI run).**

The previous build failed on the build server: a tool it needed was
installed only on the development machine and not committed. It's now
part of the repository, so a clean checkout builds the same way this one
does.

Otherwise identical to take 163: package name `com.apexoffroad.app`,
release web assets carrying no development notes, and everything from the
recent builds — loading screen, basemap loading line, stacked pins at
every zoom, and satellite imagery about 56 MB smaller.

**Before installing the store version:** it is a separate app from the
one you've been sideloading, so it installs alongside rather than over
it, and saved waypoints, rides and HD imagery do not carry across.

### Check before submitting
1. The build completes on GitHub Actions — that's the fix.
2. Install and open: loading screen, then a finished map.
3. Tools -> Self-test: expect a clean pass.
