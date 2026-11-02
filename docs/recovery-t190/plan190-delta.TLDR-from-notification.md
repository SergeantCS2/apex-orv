TLDR: the delta for take 190's plan against v5 at `9c10beb` is written to `~/apex-t190-work/plan190-delta.md`. It is the only file written; the repo was not touched.

- **The ground moved under every lane.** v5 is 14 commits past 7582666. Take 189 shipped A227's `--only` with section floors, A229 to A240, and a cold audit. app.html grew by 668 lines, render.mjs by 1371 and smoke.mjs by 735, so every anchor in the plan is stale (PROVEN: `git diff --stat`). Re-base every lane on 189's seal, not on `9c10beb`.
- **Four plan premises are false on v5:**
  1. **I11 / nm 10:** A231 has no ride height rule. It is a small-phone `@media` chip hide plus the floating compass fit (`cmpFit`, `#cmpmore`, `--cmp-trim`). A body in a sheet while riding is capped by the ride rule at app.html:656-657: 120 px at 360x800, below the 136 px dial (INFERRED).
  2. **I7:** walker letter F is taken by A233's folded-Ride flow (render.mjs:7812-7817, 7842).
  3. **Lane S step 6:** take 189's probe PROVED that MapLibre fires `moveend` on every resize step. A240 now folds only on a rider's gesture (`e.originalEvent`, app.html:9759-9773).
  4. **Lane T step 2:** A232 is three `.nobr` spans, not a no-break hyphen (app.html:804, 7386-7388).
- **Take 189 already built what lanes P, T and R planned to write.**
  - `liveFix`, `ME_FIX`, `meIs`, `meNoun` and `meClock` (A237) replace T's `LOC_T` and P's `fixStale`/`fixClock`.
  - `GPS_WAIT`, `rideWaiting` and `railPeekText` (A230) replace R's new wording for the GPS wait.
  - `--only` exists, so the plan's full-render fallback goes.
- **Lane F's biggest new cost is the `devices` harness.**
  - About three A231/F19 checks per size, the 360 restcap control and the `dc.open` reads on Plan and Tools are written against Tools chips in `#tools`.
  - Once those chips become rows, these checks either fail or pass with nothing measured: `destOk` accepts n=0 (render.mjs:6047).
  - The `devices` floor (222) may only rise (render.mjs:8090), so every retired check needs a replacement that can fail.
- **The `showQuiet` contract must change.** A230's `peekGps` only rewrites `#peek-txt` while it already holds one of its own lines (app.html:5783-5792).
  - If F's `showQuiet` only toasts the peek line, a first fix that arrives while a tool is open leaves the peek on "Waiting…" for the rest of the ride (INFERRED).
  - `showQuiet` must always write `peekLine`; a toast can be added but cannot replace it.
- **Maintainer questions, new or changed:**
  - **Two Starts:** with the drawer folded on the Ride tab, both `c-ride` and `btn-ride` are drawn, labelled "Ride it" and "Ride", and Lane R renames `c-ride` to "Start riding" (PROVEN by CSS and markup read; on-screen effect INFERRED).
  - **nm 6 (Mark with no live fix):** re-asked with three options. Off a ride a fix is live for only 15 s after a Locate, so "refuse unless live" refuses most marks (INFERRED). Default is to refuse, naming the last fix's time and age.
  - **nm 10 (compass while riding):** now likely to fire at 360x800. Take 189 already saw the dial cut with the drawer open while riding at 360.
  - **nm 4 (honest copy):** gains a wording conflict. `pc-start`'s "A live GPS fix is driving your position" can show after `liveFix()` has expired (app.html:7976-7977; INFERRED).
- **Where the two readers disagreed, the code decides:**

  | Point | Right | Code |
  |---|---|---|
  | Lowering a floor | Framework: never lower | render.mjs:8090 |
  | Two Starts on the folded Ride tab | Content | app.html:980 has no tab condition; 1103 |
  | Where A184 is checked | Content: `camp`, 3230-3254 | `back` holds the A216 licence and privacy read, with three more `c-sources` clicks at 1379-1386 |
  | `__search` contract | Content: section `water` | render.mjs:1567 |
  | Walker letters | Content: only search moves, F→M | P, T and R keep their letters |
  | Small line numbers | Mostly content | `GPS_STALE_MS` 5773, LIST 8460, restcap 6028-6030; walker size loop 7850 (framework) |
