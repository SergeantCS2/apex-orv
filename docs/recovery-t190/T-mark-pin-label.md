# PENDING (lane T) · Mark this spot: the new pin is drawn, but under the "you" dot

## The question
The maintainer decided (2026-10-02): after a mark the map eases to zoom 11+ so
the real mark pin draws above the sheet, and no temporary marker is added. That
is built: the map eases to z11 (or stays, if already closer) with the mark in
the clear band above the sheet, and render proves the waypoint dot is drawn
there (queryRenderedFeatures on `wpt-dot`; its control, the ease turned off,
reads no dot at z10).

Two things the decision did not cover:
1. **The mark is where the rider stands, so the blue "you" marker (an HTML
   marker, drawn above the map's layers) covers the waypoint dot.** At z11 the
   rider sees the blue dot and no pin (shot: `T-mark-pin-label-360x800.png`,
   ~/apex-shots/t190-T/360x800-mark.png and 411x960-mark.png). The dot's name
   label draws only from z12.2 (`wpt-label` minzoom).
2. **The pin is not green.** The board draws a green pin; an untyped waypoint
   dot is `#E2570F` (the accent's orange; app.html `wpt-dot`'s fallback). No
   green waypoint exists in the app.

## Options
- **(a) As built.** z11+, the real dot, orange, under the "you" marker when
  marked where the rider stands (always, for Mark this spot).
- **(b) Ease to z12.5 instead of z11** (still "zoom 11+"): the waypoint's name
  label draws under the "you" marker, so the rider sees the mark's name where
  they stand. One constant; the patch is `T-mark-pin-label.patch` (app only;
  `git apply --check` passes on the lane). Render's ease read (z >= 11) still
  holds; its message would read z12.5.
- **(c) Colour untyped waypoints green** (the board's `ok` #8FAE63). Changes
  every dropped-pin waypoint too, and green on this map means "easy" ORV
  route (PAL route72 #0FAE57) — a meaning collision. Not prepared as a patch.

## Recommendation
**(b).** It keeps the real pin (no temporary marker), stays inside "11+", and
is the only option where the rider actually sees something they made. (c) is
not recommended (legality colours own green on the map).

## Evidence
- PROVEN (shots, ~/apex-shots/t190-T/{360x800,411x960,749x832}-mark.png,
  log ~/apex-logs/shots-t190-T-look-1.log): "eased to z11.0, band 8-404"
  (360x800); the dot sits under the blue "you" marker.
- PROVEN (code): `wpt-dot` minzoom 10.5, `wpt-label` minzoom 12.2,
  untyped colour `#E2570F`.
- INFERRED: at z12.5 the label (offset 1.05 em below the dot) clears the
  "you" marker's 20-24 px disc.
