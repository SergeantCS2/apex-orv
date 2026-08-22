**Take 82 — audit build. Six takes of work, verified end to end and ready to ride.**

Signed release build, installs over take 81. No new features — this one exists to
make sure the last six are actually sound before you take them out.

### What you are testing, in one place

Everything below shipped in takes 76–81 and none of it has been on a trail yet.

- **Colours and the legend** (77). Brighter lines over satellite, and the picker
  now spells out green = easy, blue = moderate, black = difficult, plus forest
  road and closed. Forest roads gained a faint outline because they were the
  hardest thing on the map to see over tree cover.
- **The ride HUD** (78). Compass ribbon across the top while you ride, speed top
  right, time and distance under it. The place-name chips step aside during a
  ride and come back when you stop.
- **Saved routes** (79). Plan something, tap ☆ Save, find it later under ☆ Saved.
  Reopening re-routes it on the current map so closures stay current.
- **Machine legality on the map** (80, 81). Line your machine cannot use is
  dimmed, and the router now reads the Forest Service's per-vehicle rules rather
  than guessing from the trail type. **On your dirt bike none of this changes
  anything** — it is all permissive for a narrow machine.
- **Honest bundles** (76). If a map layer is missing the app says PARTIAL and
  names it, instead of quietly pretending it is there.

### Test script

Ride order. The first two are the ones I most want answers on.

- **Airplane mode on, force-stop, reopen.** Map renders, NET badge green.
- **The compass ribbon on a road you know runs north-south.** Does it read N or
  S? It was verified against arithmetic, never against a road.
- **Save a route, force-stop the app entirely, reopen.** Still under ☆ Saved?
- **Satellite under canopy, in sunlight.** Can you follow a green route across
  the screen without hunting? Is anything now too loud?
- **The activity picker.** Do the indented rows read as an explanation rather
  than buttons? They are not tappable on purpose.
- **Save three or four routes.** Are the auto-names actually distinguishable?
  That is the thing I most expect to be wrong.
- **Self-test.** Should read 58 checks. Three lines are new or renamed:
  `bundle-honest`, `hud-matches-ride`, `saved-routes`.

### Known, and deliberate

- **This build has no water layer.** OpenStreetMap has been down throughout —
  0 real responses out of 24 attempts across all three mirrors. The badge will
  say PARTIAL and name it. On satellite you will not notice; the imagery shows
  real water. Re-run the workflow once OSM is back and it picks up automatically.
- **Duplicate parallel lines are still not fixed.** That work needs OpenStreetMap
  data specifically, so it is queued rather than done badly against fallback data.
- Zoom buttons are still not in. Pinch is the only zoom.

### Only a ride can answer

- Battery drain with the screen on
- GPS accuracy under canopy
- Whether the compass heading is right on a road you know
- Whether these colours work in direct sun with a visor down
