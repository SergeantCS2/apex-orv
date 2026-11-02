# PENDING (lane F) · The ride's stats under a sheet while riding

## The question
When a rider opens Plan or Tools mid-ride, where do the drawer's stats go?
These are To truck, Recorded and Elevation (`#grid`) and the coordinates
(`#coords`).

Lane F first hid them under any open sheet, whether riding or not. That
was an unscoped rule and a silent departure from the Shared contract. Fix
round 1 put back the contract's own scoping, `#shell:not([data-ride])
#rail[data-sheet]:not(.folded) #grid, …#coords {display:none}`. The stats
are now part of a riding sheet again. They sit after the rows, at the foot
of the sheet's scroll, so they are still not on screen until the rider
scrolls.

## Options
1. **The contract's scoping. This is now in the lane.** While riding, a
   sheet's body is its rows followed by the stats and the coordinates. They
   are one scroll away. The action row (Return home, Dispatch, Retrace,
   Turns) stays one tap (landmine 135).
2. **Stats hidden under a sheet while riding (F's first build).** The patch
   is `F-ride-sheet-footer.patch`, CSS only, and `git apply --check` passes
   against the lane. The truck's distance stays on the folded drawer's peek
   line (`railPeekText`: "Truck N mi D" with a fresh fix; INFERRED from the
   code), one back away. The sheet is shorter by the stats' 47 px and the
   coordinates' 32 px.
3. **The stats first in a riding sheet (above the rows).** Not prepared.
   It needs `#grid` moved to the top of `#railbody` (DOM order, because
   `#railbody` is not a flex box), and render's devices read for "landmine
   135 with a sheet open while riding" re-measured. This is a design
   addition, so it waits for the maintainer.

## Recommendation
**1 (the contract, as now).** It is what the approved contract says, and it
hides nothing. If the maintainer wants To truck visible the moment a sheet
opens mid-ride, the answer is 3, not 2.

## Evidence
- PROVEN (`~/apex-logs/look-t190-F-fix1-ride-1.log`, the lane's build after
  fix round 1, riding with the Tools index open; shots in
  `~/apex-shots/t190-F/fix1/`):
  - At 360x800: `#railbody` is 385-689 (304 px) and scrolls 642 px. `#grid`
    is drawn (`display:grid`) at 932-979 and `#coords` at 987-1019, both
    below the body's visible foot.
  - At 411x960: `#railbody` is 484-849 (365 px) and scrolls 611 px.
    `#grid` is at 1000-1047.
- PROVEN (the lane's first build, the shot
  `~/apex-shots/t190-F/final/360x800-ridetools.png`): with the
  unscoped rule, no To truck or Recorded appears anywhere on screen.
- The ride sheet's own cells (`#hudcells`: Trip, To go, Arrive, Time,
  Speed) are hidden whenever the drawer is open (app.html
  `#shell:has(#rail:not(.folded)) #hudcells .hc{display:none}`, take 189).
  Neither option changes that.
- Render's devices judge "landmine 135 with a sheet open while riding"
  passed with option 1 in the lane's full run. See the report for the log.
