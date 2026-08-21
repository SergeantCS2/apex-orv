Signed release build, ~50 MB — satellite tiles at 3.4 m/px. Installs on any
Android 8+ device.

**First:** airplane mode on, force-stop, reopen. The map must render identically
with no network. Then tap **Self-test** and share the report.

### Test script for this build, in ride order

- **Opening state** — plain map, labels on, nothing else. Relief and satellite
  are choices behind the two top-left buttons, not the landing state.
- **Activity filter** (second top-left button) — pick ORV, hiking, snowmobile,
  equestrian; the map shows only that plus roads. Each row's swatch is the colour
  it draws: solid = ridable, dashed = not yours to ride.
- **Search** — try sloppy queries: `pinkstore`, `mcct`, `h5717`, `wagnr`, a
  street address like `798 n morenci`. One wrong or squeezed-out character should
  still find it. Forest roads are typed *road*, not *trail*.
- **Labels at 1 mi / 3000 ft scale** — trail and road names without zooming
  right in; short features like **M-33 Bull Gap Trailhead** named without
  tapping.
- **Loops** — first option is *most trail*. Check the card's trail mileage
  against what you ride, and whether the small repeated stretch is acceptable.
- **Route cards** — elevation profile with low/high, and the designated / forest
  road / paved split. Does the split match the ground?
- **Directions** — every step carries *"at N mi"*; does it track your odometer?
  Unnamed features say *"unnamed two-track"*.
- **Dispatch card** (needs a live fix) — reads: coordinates, **address** (exact,
  or *"Nearest address 0.2 mi NW of…"*), **county**, trail, junction, elevation,
  pavement. Read it aloud as if to a dispatcher — does every line make sense?
  Check the county near a county line. With no fix it must refuse.
- **Satellite legibility** under canopy, in daylight — brighter blue, wider white
  casing. Enough?

### Only a ride can answer

- Battery drain with the screen on
- GPS accuracy under canopy
- Whether this map matches the ground
