# PENDING (lane F) · Diagnostics during a ride: float, or open in the sheet?

## The question
The maintainer decided on 2026-10-02 that the **compass** floats during a ride
(take 189's `#cmppanel` with cmpFit) and opens in the Tools sheet only when
no ride is running. Lane F also made **Diagnostics** float during a ride. No
decision covers Diagnostics. The plan's default (nm10 / I11, delta I11) is
that Diagnostics opens as a body in the ride-capped sheet.

## Options
- **(a) Diagnostics floats like the compass. This is what lane F built.**
  `sheetTool`: `if(R.body&&isRiding())return panelFloat(R.body)` covers both
  bodies. The drawer folds, so the ride sheet's stats and the four ride
  buttons stay drawn. Render's devices A231 reads already judge both panels
  floating at every size.
- **(b) Diagnostics opens in the ride-capped sheet (the plan's default).**
  Only the compass floats. The patch is `F-diag-ride-float.patch` (app only,
  one line in sheetTool; `git apply --check` passes against the lane).
  Harness lock-step that (b) also needs, NOT in the patch: render's devices
  `toolsRead` for diagnostics (render.mjs ~5278-5291) and its judges in the
  A231 block (~5478-5545) read the diagnostics panel as floating
  (`res.float`, "floats") and would fail. They must become a sheet-body read
  while riding: the three rows drawn and one tap each inside the body, and the
  ride buttons plus the action row still one tap (landmine 135).

## Recommendation
**(a), as built.** One rule for both Tools bodies during a ride, the reads
already exist, and Diagnostics is rarely opened mid-ride. (b) is viable too,
and the reason first given against it was wrong (see Evidence).

## Evidence
- The 120 px figure in lane F's first report was WRONG. It took the 15vh floor
  of the ride cap (`max(15vh,min(38vh,var(--ride-cap)))`) as the cap. PROVEN
  (F-work look, `~/apex-logs/look-t190-F-ride-1.log`): at 360x800, riding with
  the Tools index open, `#railbody` is 304 px (38vh) and `--ride-cap` reads
  469 px. Diagnostics' body is its label plus three 48 px chips. It would fit
  304 px without a scroll (INFERRED, not measured).
- Floating Diagnostics while riding at 360x800 (PROVEN,
  `render-t190-F-full-4.log`, devices "mid": "the diagnostics panel holding
  more than the screen stops under the turn banner: top 154 under the banner's
  foot 146, 360 px tall, scrolls true, over nothing").
- What Diagnostics holds: About this build, Self-test, Pan test. Self-test and
  Pan test stay `show()` cards (nm11), so either option ends in a card.
