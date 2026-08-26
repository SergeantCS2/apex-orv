**Take 123 — pins that stay put.**

One item, the one you ranked highest after the colours: the pins popping in
and out.

### What changed

- **Every place has a rank now, and the map thins by rank, not by luck.**
  Camps, trailheads, day-use areas and viewpoints show from ~10 mi; named
  launches and beaches from ~6 mi; unnamed launches and beaches from ~3 mi;
  fuel, food and stores from ~3 mi at the small size. A pin that is on stays
  on while you pan — the old behaviour handed 670 badges to a collision
  solver whose answer changed every frame.
- **A badge and its name can no longer disagree.** They were two layers that
  collided separately, so you got names with no badge (your 24315) or
  badges with no name (24323). They share one layer now: the badge always
  draws, the name only when it fits.
- Unnamed launches within ~200 m of another launch are collapsed to one
  (79 statewide — most unnamed ramps turned out not to be clustered).

Plus everything in 122: readable chips, dark elevation with a white outline,
panels clear of the Tools row, no Wisconsin, trailheads that have a trail.

### Check on the phone

1. Oakland County at 10 mi, then pan slowly: pins should hold still.
2. Waterford at 1 mi: every "Boat launch" name has a badge under it, and
   every badge that has room shows its name.
3. Zoom from 10 mi to 1 mi over the same spot: pins ADD as you zoom in;
   nothing that was there disappears.

### Next
Dimmer roads on satellite and imagery patches over the riding areas (A153),
then the guide (A147/A155), then the compass after a ride (A148).
