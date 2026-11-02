# Take 190 plan delta: plan190.md against v5 at 9c10beb

Inputs: plan190.md (written against 7582666), the framework reader, the content reader, and a read-only check of the code wherever the two readers disagree (last section). All line numbers are on v5 at `9c10beb` (wip 189 audit fixes r2). They will move again at 189's seal, so re-anchor by content and `assert old in s`.

## TLDR

- **The ground moved under every lane.** v5 is 14 commits past 7582666. Take 189 shipped A227's `--only` with section floors, A229 to A240, and a cold audit: app.html +668 lines, render.mjs +1371, smoke.mjs +735. Every anchor in the plan is stale (PROVEN: `git diff --stat`). Re-base every lane on 189's **seal**, not on 9c10beb.
- **Four plan premises are false on v5:**
  1. **I11 / nm 10:** A231 has no ride height rule. It is a small-phone `@media` chip hide plus the floating `#cmppanel` fit (`cmpFit`, `#cmpmore`, `--cmp-trim`). A body in a sheet while riding is capped by `#shell[data-ride] #rail:not(.folded) #railbody{max-height:max(15vh,min(38vh,var(--ride-cap,38vh)))}` (app.html:656-657). That is 120 px at 360x800, below the 136 px dial (INFERRED).
  2. **I7:** walker letter F is taken by A233's flow (render.mjs:7812-7817; `WALK_CEIL` at 7842).
  3. **Lane S step 6:** MapLibre fires `moveend` on every resize step. That is PROVEN by take 189's probe, and A240 now gates the fold on `e.originalEvent` (app.html:9759-9773).
  4. **Lane T step 2:** A232 is three `.nobr` spans, not a no-break hyphen (app.html:804, 7386-7388).
- **Take 189 built what lanes P, T and R planned to write.** `liveFix`, `ME_FIX`, `meIs`, `meNoun` and `meClock` (A237) replace T's `LOC_T` and P's `fixStale`/`fixClock`. `GPS_WAIT`, `rideWaiting` and `railPeekText` (A230) replace R's watch-open wording. `--only` exists, so the plan's full-render fallback goes.
- **Lane F's biggest new cost is a harness rewrite.** In `devices`, about three A231/F19 checks per size, plus the 360 restcap control and the `dc.open` Plan and Tools reads, are written against Tools chips in `#tools`. Once those chips become rows, the checks fail or pass empty (`destOk` passes n=0, render.mjs:6047). The `devices` floor (222) may only rise (render.mjs:8090). Every check F retires needs a replacement that binds.
- **The showQuiet contract must change.** A230's `peekGps` refreshes `#peek-txt` only while it already holds one of its own lines (app.html:5783-5792). If F's showQuiet only toasts the peek line, a first fix that arrives under an open tool leaves the peek on "Waiting…" for the rest of the ride (INFERRED). showQuiet must **always** write `peekLine`.
- **New maintainer questions:**
  - Two Starts on the Ride tab with the drawer folded (`c-ride` plus `btn-ride`), with the labels Ride / Ride it / Start riding.
  - nm 6 re-asked with three options: off a ride, a 15 s live bound refuses most marks.
  - nm 10 is now likely to fire at 360x800.
  - nm 4 gains the `pc-start` / `liveFix` wording conflict.
- **Reader disagreements, checked in the code:**
  - Floors are never lowered. The framework reader is right; the content reader's "lower with a reason" contradicts render.mjs:8090.
  - There are two Starts on the Ride tab when folded. The content reader is right.
  - A184 sits in `camp`, and `back` holds the A216/privacy read with three more `c-sources` clicks. The content reader is right.
  - `__search` is in `water`. The content reader is right.
  - Walker letters: take the content reader's minimal remap, search F→M.

---

## 0 · Plan-level ground (§0, §2 headers)

- **Repo state.** The head is `9c10beb` on v5, and `BUILD` still holds `OFFROAD_TAKE=189`. The worktrees are `wt/L-names`, `L-render`, `L-ride`, `L-small` and `hotfix188` (PROVEN: `git worktree list`). Branch every lane from 189's seal.
- **Numbers.**
  - The highest agenda item is **A240** (docs/AGENDA.md:4873).
  - The highest committed landmine is **235** (docs/LANDMINES.md:3043; 234 and 235 came from main's take-188 CI fixes). Take 189's landmines start at 236 (notes/step-00-maintainer.md).
  - Take 190's ids start after whatever 189 assigns. Read both at the seal (PROVEN).
- **Collision list.** Replace it with the shipped set (PROVEN):

  | Item | What shipped | Where |
  |---|---|---|
<!-- RECOVERY GAP: only original lines 1-40 were printed in the session transcript (sed -n 1,40p, event 66ca1b9a); the rest is unknown -->
