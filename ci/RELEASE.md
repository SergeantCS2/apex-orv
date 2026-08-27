**Take 136 — the build finishes, for real this time.**

Take 135's fix was not enough: GitHub's runners are rate-limited by
Wikimedia far harder than my sandbox, so the photo step still sat silent.
The dependency is gone. The 608 photos are fetched on my side and ship in
the seed itself (about 10 MB); the build just uses them. Nothing on the
runner talks to Wikipedia any more.

Same map as 134: hiking trails routable on foot, the guide on launch,
public land, photos, lighthouses.

### What to expect
About 30 minutes to "address:", then `photos: budget 0 — using the 608
shipped photo(s)` within seconds, then render and gate. If build #55 is
still running, cancel it first.
