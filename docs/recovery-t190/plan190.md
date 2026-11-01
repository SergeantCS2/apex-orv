# Take 190 build plan: the approved screens, artboards 10–23

## TLDR

- **Order.** Build the sheet framework first, in one lane (Lane F). After it merges, four lanes run in parallel worktrees, each owning its own regions of `src/app.html`:
  - P: Plan, Machine, Fuel, Home, Loop and Saved
  - S: Search
  - T: Tools, Diagnostics, Data sources, Compass, HD and Mark
  - R: Turns, the Ride tab and the tour
- **Merge.** T, then P, then S, then R, then one integration render and gate.
- **The specs disagree, so F decides the shared pieces.** The seven specs name five different sheet mechanisms: `#rail[data-sheet]`, `#rail[data-tabsheet]`, `#toolsheet`, `#rail[data-view]` and `#rail[data-card]`. F owns the single version of each: one sheet attribute, one row component, one back row, one fold rule, one icon registry and one window hook. Every other lane uses F's and adds no second copy.
- **Fourteen questions go to the maintainer.** They are deduplicated, and each has a safe default (§3). The biggest: the approved boards put sheets above §8's 0.12 open floor, and several paths that are not walker ceilings get one tap longer. Landmine 135 counts both.
- **Every spec was reviewed "fixable"; none blocks.** Ten corrections recur across specs and are folded into each lane's steps:
  - `max()` on the sheet cap where `min()` or the cap alone is meant
  - smoke drills that call functions the IIFE never exposes
  - planted controls that cannot fail
  - a footer-hide rule that also hides the folded drawer's Return home
  - `showQuiet` deferral that breaks ride cards
  - harness lines that lose coverage without failing
  - `#q` with a remembered query
  - `#c-fuel` as a button that holds buttons
  - the case-sensitive compass regex
  - the 38vh body hiding the primary at 360x800

## 0 · Ground truth at plan time

Every item here was read or run, read-only. Nothing in the repo was written.

- **Repo state:** the head is `7582666 wip 189 step 1` on branch v5, and `BUILD` holds `OFFROAD_TAKE=189`. Take 189's lanes run in the worktrees `wt/L-names` and `wt/L-render` (`git worktree list`).
- **Agenda:** the highest item is **A236** (docs/AGENDA.md:4836). Take 190's items begin at the **next free id** after take 189 seals.
- **Landmines:** the highest is **233** (docs/LANDMINES.md:3012).
- **Icons:** LUCIDE holds 74 strings (tools/manifest.py:329; docs/PROVISION.md:181 is a built copy). `ICON_OF` (src/app.html:3419-3434) has no `back`, `next`, `less`, `add`, `done`, `list`, `road`, `trail`, `code`, `junction` or `addr`. `node_modules/lucide-static/icons` has chevron-left, chevron-right, minus, plus, check, list, road, signpost, hash, split and mailbox (`ls`).
- **Take 189 items that collide with take 190:**
  - A229: attribution clear of the drawer
  - A230: waiting-for-GPS copy
  - A231: Compass and Diagnostics usable height while riding at 360
  - A232: "BSD 3-Clause" on one line
  - A233: Ride beside Return home on the folded drawer
  - A227: render sectioning, possibly an `--only=` flag
  
  Every line number below is against 7582666 and will move. Re-anchor by content and `assert old in s` (AGENTS rule 5, landmines 65/75).

## 1 · Lanes

### Shared contract (Lane F owns it; every lane obeys it)

| Piece | Decision | Replaces |
|---|---|---|
| Sheet state | `#rail` `dataset.sheet` ∈ `index` / `tool` / `body` / `card` / `search`, mirrored to `#shell.dataset.sheet` by `sheetPaint()` for the grid, scrim and column rules. Set with `dataset` and cleared with `delete`, never `setAttribute`/`removeAttribute` (check_stubs, gate.py:2181-2186). | `data-tabsheet` (plan), `#toolsheet` + `data-sub` (tools), `data-view` (tools-detail), `data-card` (ride), `#shell[data-sheet="search"]` (search) |
| State object | `SHEET={tab,tool,from}` and `SHEET_ROWS[id]={tab,t,body?,bar?,parent?}`. `parent` covers About→Diagnostics and Mark-from-Compass, and `from` covers HD from `c-hd` and Mark from Saved. | `TSTACK`, `TV`, `PLAN_SUB` |
| Fold rule | Every `railSet(false)` clears the sheet state, and every fold lands on Map when the tab was Plan or Tools. CSS footer rules are also scoped `:not(.folded)` as a second guard. | the Ride and Turns spec's `data-card`, which survived a fold and hid Return home (landmine 135) |
| Footer | `#shell:not([data-ride]) #rail[data-sheet]:not(.folded) #grid, …#coords, …#actions{display:none}`. While riding, `#actions` stays. | four separate rules |
| `show()` | `sheetExit(false)`, then `cardWrite()`. Any non-sheet card ends the sheet and keeps the tab mark. | — |
| `showQuiet()` | **Not deferred.** While a tool is open it ends the sheet (`sheetExit(false)`) and writes, so `rideCard` listeners bind to real DOM (app.html:4539-4560). The peek line goes out as a toast. | framework's deferral, which left ride cards dead and invisible |
| Back row | One static `#sheetbar` (`#sh-back`, `#sh-title`) between `#peek` and `#railbody`, pinned so it never scrolls away. `bar:false` hides it, for Mark only. | `.sbar` inside `#panel` (plan, tools, tools-detail) |
| Row | `<button class="srow" data-tab="plan|tools" id="c-…">` > `.sr-i` (icon tile) + `.sr-t` (`.sr-l` label, `.sr-s` sub-line) + `.sr-v` (value) + `.sr-c` (chevron). Selected: the dot goes on **`.srow.on>.sr-t::before`**, a direct child, because the V4 audit reads only direct children's `::before` (render.mjs:6426-6449, per the plan review). Weight 700, 1px `--sel` inset, no fill. | `.trow`, `.sic/.stx/.stl` |
| Icon keys | `back:'chevron-left'`, `next:'chevron-right'`, `less:'minus'`, `add:'plus'`, `done:'check'`, `list:'list'`, `road:'road'`, `trail:'signpost'`, `code:'hash'`, `junction:'split'`, `addr:'mailbox'`. check_icons refuses an unused key, so each lane adds only the keys it references. The manifest count (74 → 85 if all land) is set **once, at integration**. | `more:` used three different ways |
| Tokens | `--sheet-group:rgba(255,255,255,.03)`, `--row-h:calc(var(--tap) + var(--s-2))` (56 px, chosen for the 360x800 fit), `--row-ic:40px`, plus `--sheet-cap` measured at run time. T adds `--warn-tint`, `--warn-line` and `--dial`. | `--group-fill` |
| Hooks | `window.__sheet={state,tab:showTab,index,tool,back,exit,cap}`. The tab setter is what lets smoke and render reach `showTab` inside the IIFE (www/app.js:2; app.html:7676-7677). | smoke drills that called `sandbox.showTab` |

**Smoke facts every lane obeys.** All of these were PROVEN by reading tools/smoke.mjs:73-153.
- Markup: class first, then letters-only `data-` names. There is no `querySelector` on documentStub.
- `hidden` and `disabled` in markup are not parsed: set them from JS.
- `grab(id)` keeps one El for good, so its listeners accumulate. Bind by delegation, or reset `_listeners` in drills.
- `getBoundingClientRect` is a constant `{top:0,bottom:40}`. Any layout-derived code bails out explicitly.
- The pickers start unhidden and the tour starts on at boot. Back drills first call `__tour.close('notnow')` and hide the PANELS.
- Child mutations do not reach the parent's `_html`. Read child Els directly.

<!-- RECOVERY GAP: original lines 69-95 were never printed in the session transcript -->
7. Floating columns: default (needs_maintainer 1) hides `#readout`, `.maplibregl-ctrl-bottom-left`, `#c-mode`, `#c-act`, `#c-base`, `#c-hd` and the pickers while `#shell[data-sheet]` is index or tool, as during a ride (app.html:655-658). This also removes the picker squeeze (pickers anchor on `#stage`, app.html:368-372).
8. `--sheet-cap`:
   - the rule is `max-height:var(--sheet-cap,38vh)` with no `max()`, keeping `- var(--rc-trim)` when `#routes` sits in a tool
   - the measure takes the band's bottom edge the way `bandRead` does: the highest of `#rail` top, `#tools` and `.maplibregl-ctrl-bottom-right` (render.mjs:6107-6113)
   - a cap below its floor **fails a guard**; it does not clamp silently
9. Entry points that open tools: Home, Saved, Loop, Compass, Diagnostics, About, HD (from `c-hdmanage` and `c-hd`), Sources, Mark. Each tool's content stays as today until its lane restyles it. Self-test and Pan test stay `show()` (map-has-room >35%, app.html:8088-8090).
10. `#ix-search`: `sheetExit(false); tabMark('map')`, then `c-search.click()` when `#srch` is off, else `railSet(true); q.focus()`. Lane S points it at `searchOpen()`.
11. Copy follows the renamed rows at app.html:1079, 6511, 8981 and 9332.
12. Harness lock-step in the same commit:
    - render 787 (read `#c-machine-v`)
    - 3442-3444 (guide chip drawn inside the open index)
    - 3595-3681 (perf/mag/reach: an idempotent `openTab(t)` helper instead of second tab clicks, which are now toggles)
    - 3822-3842 (re-open the compass after marking)
    - 3866-3897
    - 3973-3975 (icn `fired`)
    - 3998-4039 (A113 per tab = strip chips ∪ open-index entries; ≤7 applies to strips, pending needs_maintainer 3)
    - **4459-4461 OTHER()**, which adds the sheet (it silently stops covering the rows otherwise)
    - 4473-4790 (compass and diag reads become open-drawer reads; the liftCaught plant is placed on `#hudstats`'s measured rect)
    - 4489-4509 (undo `tabTo` over a fold)
    - 2981-2995 (`c-sources` now switches tab)
    - 5226-5271 (destination counter plants move to the Map strip)
    - 6099-6158 (G1 sheet reads, with `railSet(false)` and the Map tab chosen explicitly before the Map reading)
    - 6205-6216 (FAM `.srow.on` with `cls:'on'` and `.srow.arm` with `cls:'arm'`, because without `cls` the OFF read fails)
    - 6563-6569 (`__sheet.back()` instead of toggle clicks)
    - probe 241-250 (the same toggle hazard)
13. New guards, each watched failing on its plant first (landmine 54):

| Guard | Planted control |
|---|---|
| THE SHEET: footer hidden off a ride; a Map card still draws the footer | `#rail[data-sheet] #actions{display:flex!important}` |
| Back three ways (render real DOM; smoke as a **new** block, since smoke has no back drills today) | forged sequences; `#sheetbar{display:none!important}` |
| Landmine 135 with a sheet open while riding | `#shell[data-ride] #rail[data-sheet] #actions{display:none!important}` |
| G1 sheet band ≥ 0.12 at three sizes, for both indexes **and one tool** (Sources) | `#railbody{max-height:90vh!important}` at 360x800 |
| Sheet rows reachable, every size | `display:none` row, overlay div, `overflow:hidden` |
| Index fit: `scrollHeight ≤ clientHeight+1` (catches a small clip, which elementFromPoint misses) | a 12 px spacer |
| Accent: Plan index 1, Tools index 0 | `#c-compass` given the accent |
| showQuiet ends the tool; a re-route card's buttons fire (smoke) | the old deferral fails it |
| `--sheet-cap` follows a resize | **stylesheet** `:root{--sheet-cap:Npx!important}`, confirmed applied before judging (an inline pin is overwritten by the app's own writes) |
| Folded Return home after any sheet: `btn-home` tappable after back, the grabber and the empty-map fold | an unscoped footer rule |
| Arm cleared on fold to Map | forged state |

14. Checks right after Lane F:
    - gatefn: icons, tokens, scale, stubs, glyphs
    - `node tools/smoke.mjs` whole
    - render sections: first-run and back, reach/A113/icn, destination counter and device matrix, ride sheet G2/G3/F18, G1, selected-state, V4 audit, walker
    - full gate before merge
15. DESIGN-v4 §7/§11/§12. Take F cannot be cut; every other lane stands on it.

### Lane P · Plan (artboards 10, 12, 13, 14)

Size L. Owns:
- app.html:3588-3653 (homeCard, c-me, Machine, Fuel), 4041-4170 (svCurrent, svName, svOpen, the Saved screen)
- 4268 and 8544-8573 (Loop), the `__nav.fuel` hook at 7727, `__mach.set` at 7754
- render 1345 and 1391, plus its own new blocks

Steps:
1. Machine picker:
   - rows are `<button class="srow" data-mach="k">`, ORDER then WORDER
   - picking applies the legality body and `clearRoute` (F1 kept); Water does not clear
   - the result note goes **above** the list, using the exact string "Route cleared — it was planned for X. Plan it again for Y." (app.html:5290-5291), the same string smoke matches
   - craft rows in a land mode are refused by key, not by `disabled` (needs_maintainer 5)
<!-- RECOVERY GAP: original lines 157-340 were never printed in the session transcript -->
## 2 · Integration points, merge order and render sections

**Merge order:** F, then T, then P, then S, then R. Each merge runs smoke, the merging lane's render sections and gatefn. After R comes one full render and the full gate, in the background per CLAUDE.md (one Chrome; ps count 0 before launch; the PID read from the log's first line; poll to `GATE PASSED`/`GATE FAILED`).

| # | Point | Lanes | Resolution |
|---|---|---|---|
| I1 | `#tabs` click listener (app.html:7165-7166) | S (searchClose), R (goTab) | One `tabTap(t)`: `if(searchIsOpen())searchClose('tab'); goTab(t)`. R merges last and resolves by hand. |
| I2 | `#ix-search` | F, S | F ships the corrected handler; S replaces its body with `searchOpen({from:'plan'})`. |
| I3 | Saved's "Mark this spot" | P, T | P hides it until T's `markHere(from)` exists, then wires `from:'c-saved'`. Mark's Done returns to Saved, re-rendered with the new row (not the "Find it again under Saved" card). |
| I4 | homeCard as a tool | P, T (compass Set home) | Lane P's tool; T calls `sheetTool('c-home')` with `from:'c-compass'`. |
| I5 | A233 folded Ride / one Start | R, take 189 | Decide after 189 seals. The one-Start guard counts A233's id, and the footer rule never hides the folded drawer (`:not(.folded)` plus the fold rule). |
| I6 | Icons and the manifest count | all | Each lane adds only its keys; the integrator sets the manifest count (tools/manifest.py:329) and rebuilds PROVISION.md and licenses.txt. |
| I7 | Walker letters | P, S, T, R | F search, G jump, H loop, I saved, J compass, K mark, L turns→ride; `WALK_CEIL` merged once. Flows run at 411x960; C, H and I at all three sizes. |
| I8 | V4 audit `run()` list, render back block, DESIGN-v4 §11 | all | Append-only per lane, under lane-named comments; the integrator dedupes. |
| I9 | TOUR_STEPS | F (tourStart tab0), S (hint read from the c-search step), R (step 7, TOURKEY) | R owns the single TOURKEY bump. |
| I10 | `rideFlag` / `stopRide` | R (Ride card, st-ride), F (#ix-home hidden while riding) | CSS for F, JS for R; no overlap expected (INFERRED). |
| I11 | Take 189 rebase | all | Every lane branches from 189's seal, not 7582666. Take 189's A231 height rule replaces F's ride-cap assumption for `data-sheet=body`. |

**Render sections per lane.** Names are by content; map them to A227's `--only=` names if take 189 ships the flag, otherwise run the full render one lane at a time under the Chrome lock.
- F: first-run/back, reach/A113/icn, destination counter + device matrix, ride sheet G2/G3/F18, G1, selected-state, V4 audit, walker, perf/mag
- P: V4 audit, walker (C, H, I at three sizes), selected-state, G1, destination counter, back, Machine (1345-1394)
- S: V4 audit `search`, walker F and G, G1/R1-R4, back, first-run
- T: HD h1/h2, A184 sources + licence (1225-1246), mag/compass drills, ride sheet F18, V4 audit, walker J and K, back
- R: first-run/tour (+ ring guard at three sizes), Wrong-turn, fc, GPS refusal, V4 audit, walker D and L, destination counter, stripR
- Integration: the full render, then the gate, then probe/census shots to `~/apex-shots/t190` at 411x960 and 749x832 (no t188 360 census exists; use render's 360 reads), compared with the artboards.

## 3 · needs_maintainer (deduplicated, each with its safe default)

1. **Sheet geometry against §8's open floor (0.12).**
   - Approved tops at 411x960 (PROVEN, mockgen190.py:75 and 182-309): Plan 212, Tools 150, Machine 150, Compass 150, HD 130, Sources 60, Search 96, Saved 380, Loop 420, Diag 420, Mark 470. The activity chip ends at 172 (take-188 log: `#c-act` 168).
   - Over the floor: Plan (band 0.046), Tools (covers the chip), Search (0.10), and the tall tool boards drawn over a dimmed map with no chrome.
   - *Default:* the floor holds everywhere. Plan and Tools sheets hide the floating columns, as during a ride, and use the measured cap. Tool screens use the same capped drawer with no scrim. Search keeps its scrim (modal) at `12dvh + r-lg`. The compass dial is 136 px beside the heading.
   - *Stop and ask* if Plan's Home row needs a scroll at 360x800 or 749x832.
2. **Paths one tap longer (landmine 135; the named ceilings A–E hold and are walked).**
   - Return home: from the Tools index 2→3; from any tool off a ride 2→3; from the Ride card 1→2.
   - Dispatch off a ride, from any sheet: 1–2 → 2–3.
   - Mark from the compass and read the bearing: 3→4.
   - A loop at a non-default distance: 3→4.
   - Machine bike→quad: 2→3 (the approved picker).
   - Tool to tool: 1→2.
   - *Default:* as approved (footer gone off a ride, kept while riding). The per-row Edit toggle is **not** built (Rename and Delete stay visible). Offer the maintainer a slim outlined Return home + Dispatch at the sheet foot.
3. **A113 and A217 for sheets.** The Plan index has 8 entries (search, Return home, 6 rows); "≤7" was written for strips. *Default:* ≤7 applies to strips only; sheets keep A217's "every row fully on screen" judge at every size, with the fit guard. No silent switch to "reachable by scroll".
4. **Approved copy changed for honesty.**
   - Loop: "Starts at the map centre" becomes "Starts at the start pin…". Loops start at `nearestNode(ME)`, never the map centre (PROVEN, app.html:8556).
   - "Start from my position" arms a manual map tap, not GPS: new sub-line, or apply pc-start's GPS refusal.
   - "Seven steps over the real screen": the tour skips hidden steps.
   - Fuel "Routes warn past it" while Off.
   - "Jump to a town" becomes "Jump to a place" (two site anchors).
   - Loop's "from here".
   - *Defaults:* the honest versions in the lanes. The tour sub-line follows the visible count at paint time.
5. **Craft rows in a land mode** (Machine picker lists all seven). *Default:* the other family's rows are disabled, with "Used in Water mode" / "Used in the land modes".
6. **Mark this spot with no live fix.** Today it saves the region centre or the start pin and says "Marked" (the `!ME` guard is dead; app.html:3577, 7184; census 21). *Default:* refuse unless the fix is live, with copy per state, and show the fix's age.
7. **Saved records from another region** are hidden today, and the screen says "Nothing saved yet" (app.html:4112-4118). *Default:* count them ("N more saved in a different region, not shown here"). Ask: list marked spots across regions?
8. **Tour exits** (A194). *Default:* Skip = never show again (Tools → Take the tour replays it); back = not now.
9. **Data sources omits the U.S. Census Bureau** (TIGER county lines and address ranges, PROVEN in tools/manifest.py:225-246 and tools/address.py:8). The elevation credit is fetched from AWS Terrain Tiles (tools/terrain.py:61). *Default:* the list is unchanged (it is the card Play reviewed).
10. **Compass while riding.** Opening it opens the drawer, which hides the trip stats, and the ride cap recreates A231. *Default:* `#hudcells` stays drawn, the body takes A231's ride height, and render judges the dial readable at 360x800 riding. If it fails, stop and ask whether the compass floats during a ride.
11. **Self-test and Pan test** leave the sheet through `show()`; board 20 draws them in-sheet. *Default:* `show()`, because they measure the map.
12. **The generic footer outside sheets.** read3 says it "no longer repeats under every card". Place cards and route options keep it in all specs. *Default:* keep it there, since that is where Turns and Dispatch live.
13. **Departures from the artboards' details.**
    - no grabber or kicker repeat on Tools
    - Mark has no back row; the approved green mark pin is not built (wpt-dot shows from z10.5, app.html:3319)
    - Turns does not switch to Plan
    - type and targets snap to the scale (48/56 px, 16/22 px)
    - River and Town reuse the `water` and `spot` icons
    - *Default:* as listed. Ask about the mark pin specifically: ease to ≥z11 above the sheet, or a temporary marker.
14. **The Ride tab replaces the open card**, a place card or ride report. Leaving the tab folds the drawer. *Default:* as specified, with the report still kept in LASTRIDE.

## 4 · Defaults taken (deduplicated)

- **Sheets:** the sheet is the existing drawer (`#rail`), not a new overlay. Ids the harness reads stay on the rows; rows are static markup bound by id. One sheet attribute, one row component, a pinned back row, and one selected state with the dot on a direct child, no fill. Every fold lands on Map and clears the sheet and any arm except `homeaddr`.
- **The `#tools` strip** stays drawn on every tab: empty on Plan and Tools, with no pointer events, so its anchors do not move.
- **Map tab** keeps its strip (Layers, Locate, Search).
- **Riding:** `#actions` stays during a ride under any sheet.
- **Cards and back:** `show()` ends a sheet; `showQuiet()` ends a tool rather than deferring. Back closes the innermost layer: tour, pickers, guide, search, tool, index, drawer.
- **Sizing:**
  - the sheet cap is measured from `bandRead`'s own edges, and a cap below its floor fails a guard
  - rows are 56 px, the fuel stepper 48 px, `rg-go` 56 px
  - the scale's sizes stand in for the mockup's 17/13/22/24 px
- **Copy:** the full Sources list (six linked agencies, full licence notices, privacy link); About's sub-line made true with take, region, date and hash; "Jump to a place"; "TMM" kept.
- **Plan details:** Machine icons stay the app's; the picker order is ORDER then WORDER; a picker pick stays open with its note above. The Loop distance is remembered for the session (`LOOP_PICK`/`LOOP_MI` split).
- **Saved:** keeps today's order and per-row Rename/Delete.
- **Tour and Turns:** the tour runs over the Map tab and hands back the tab it started from. Turns stays on its tab, under the 38vh cap.
- **Tools:** HD saves are secondaries (no accent) and nothing downloads on open. The HD view from the Map's HD button opens under Tools with back folding. Self-test and Pan test stay `show()` cards.
- **TOURKEY:** bumped once.

## 5 · Agenda items to record (ids from the next free id after take 189 seals)

Each item gets its HANDOFF paragraph. One line per item: title, then the `Ruled out:` line.

1. **The sheet framework: Plan and Tools tabs open the drawer as a sheet of rows; tools open inside with a back row.** Ruled out: a new floating sheet element (`#toolsheet`, which blinds the band, the walker and the ride anchor); rows rendered as innerHTML (smoke grabs static ids); hiding `#tools` on sheet tabs (`--strip-h` drops to 0, the step-13b bug); deferring quiet cards (dead ride-card buttons).
2. **Plan index: search entry, Return home, From here / Your ride rows.** Ruled out: keeping the six floating chips; a sheet top above §8's floor without the maintainer's word.
3. **Machine picker.** Ruled out: keeping the tap-to-cycle; a craft in a land mode that refuses every route.
4. **Fuel range stepper.** Ruled out: a stepper that throws the rider out of the sheet; wrap-around from 120 to Off.
5. **Search as a sheet** (field, results by kind, honest count). Ruled out: the board's 96 px top under the floor; `route` for roads (one meaning per icon, A216); re-sorting results into kind sections; a second search engine.
6. **Search back takes two presses; a jump chip leaves search on; the address arm survives and hijacks the next hit or map tap** (defects found in review). Ruled out: keeping the arm alive across tabs.
7. **Loop from here: pick, then Find, with the start line telling the truth.** Ruled out: "Starts at the map centre" (false; app.html:8556); a chip that sets the saved-loop distance without a build.
8. **Saved: the screen, plus honesty about other-region records.** Ruled out: `.rc`/`#routes` for rows (they are read as route cards); "Nothing saved yet" while records exist.
9. **Tools index.** Ruled out: the strip grown into a sheet; a grabber on a sheet that does not drag.
10. **Diagnostics and About this build in the sheet.** Ruled out: Self-test and Pan test inside the sheet (map-has-room); a self-test "all reachable" line about a hidden action row.
11. **Data sources: the independence notice first, six linked sources.** Ruled out: the board's four sources and the one-line licence list (Play, take 167; check_licences).
12. **Compass in the sheet; the sensor line stops claiming "not reporting" before 3 s.** Ruled out: a 220 px centred dial under the 38vh cap; a scrim behind tools.
13. **HD imagery: three tier cards.** Ruled out: an accent on Save; anything starting on open.
14. **Mark this spot: name, Done, Undo; marks only a live fix; no silent overwrite of a waypoint with the same name.** Ruled out: marking the start pin or the region centre as "this spot"; a mutant that cannot fail.
15. **Turns: one scroller, Ride it pinned, "N more steps below".** Ruled out: the 150 px nested scroller; Turns switching tabs.
16. **The Ride tab before a ride: a Ride card with Start riding.** Ruled out: a Ride sheet that stays up through the pre-fix wait (it would undo A222's fold); two Starts on screen.
17. **The tour card: Next and Skip, ring re-placed after the drawer slides.** Ruled out: two accents on the tour screen; step text naming a button that is not drawn.
18. **OPEN, needs the maintainer: credit the Census Bureau and the elevation tile source on Data sources.** Ruled out: editing the Play-reviewed card without the maintainer.
19. **Candidate, not built: the place card's Save as waypoint silently replaces a same-named waypoint (app.html:7568-7584); HD progress shown as a frozen snapshot.** Ruled out: fixing them unreviewed inside this take.

**Landmine candidates** (from 234 on):
- a guard on a value that is never null (`!ME`)
- a planted control the app's own inline write overwrites (`--sheet-cap`)
- the smoke stub drops `hidden`/`disabled` and keeps listeners per id
- a toggle that became an opener breaks every harness "second click closes"

## 6 · Biggest risks and clean cuts

- **Lane F is XL, and every lane waits on it.** INFERRED from the 12 harness rewrites, about 10 new guards and the state machine. *Mitigation:* F ships with Machine and Fuel cycling in place and every tool hosting today's card unchanged, so F alone is a working, sealable state.
- **Fit at 360x800 and 749x832** (INFERRED; 23–180 px of overflow across the specs' arithmetic). The fit guard and flow C at three sizes decide. A failure stops the build for needs_maintainer 1/3; it is not worked around.
- **Smoke's fake DOM.** Most review defects were here: unreachable IIFE symbols, accumulated listeners, a constant rect, unparsed `hidden`. *Mitigation:* the shared smoke rules above. Every new drill gets a planted reading in the same run.
<!-- RECOVERY GAP: anything after original line 460 is unknown (the 43870-byte file may end here or continue) -->
