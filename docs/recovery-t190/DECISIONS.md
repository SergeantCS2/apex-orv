# The maintainer's decisions on take-190 pending items

## 2026-10-02 23:20 (asked live while the lanes ran)
- F-diag-ride-float — **(a) Diagnostics floats like the compass during a ride, as built.** No change; patch NOT applied.
- F-ride-sheet-footer — **1, the contract as built: while riding, a sheet's body is its rows followed by the
  stats and coordinates (one scroll away); the action row stays one tap.** No change; patch NOT applied.
- T-mark-pin-label — **(b) ease to z12.5 instead of z11** (still "zoom 11+") so the mark's name label draws
  below the "you" marker. APPLY T-mark-pin-label.patch after lane T merges (or its equivalent if T's code
  moved), with render's ease read and message updated to z12.5, a planted control (z11) that fails the
  label-visible read, SMOKE5 and the touched render sections.

## 2026-10-03 04:15
- P-pcstart-live — **(a) apply P-pcstart-live.patch**: pc-start uses meDriven() and lane P's words ("GPS is on
  (a ride, or a Locate waiting for its fix) — the next fix in the region moves the start pin to where you are,
  so it cannot be placed by hand."), with a smoke drill that opens a place card with the watch open and the
  fix 40 s old and rejects "live", plus its planted control. Apply after lane P merges.

## 2026-10-07 — the batch brief (BRIEF.md), all six as recommended: 1a 2b 3a 4a 5a 6a
1. R-turns-footer — (a) keep Turns' action row, as built. No patch.
2. I-mark-from-saved-tab — (b) keep the opener's tab (Plan stays marked while Mark is up from Saved). Rebase the patch (one context line moved in c6e0796).
3. AUDIT-locate-cause — (a) drop the bracket: "GPS is on — the next fix in the region moves the start pin…" in both places (rewording the earlier P-pcstart-live words).
4. AUDIT-osm-official — (a) move OpenStreetMap to OTHER DATA with one sentence naming OSM and AWS.
5. AUDIT-primary-case — (a) uppercase #rc-ride and #pc-route (one CSS line); a full render must show they fit at 360.
6. AUDIT-me-chevron — (a) the chevron plus "Tap where you stand — plans start there, not the map centre". Merge its smoke coldOk line with item 3's by hand.
