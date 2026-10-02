# APEX ORV — NEW CHAT BRIEF · V4 (rewritten 2026-09-23 at take 186, brought to take 189)

Read this first, then CLAUDE.md (how work happens on the workstation),
then the newest HANDOFF entries. PROTOCOL is the law; LANDMINES §0 is the
symptom index. The ledgers are long: grep them, never read them whole.

## What this project is

A free, fully offline Android trail-navigation app for Michigan — both
peninsulas and Isle Royale — for ORV riders, paddlers, hunters, hikers and
campers. "A love child of onX Offroad and AllTrails, but Michigan only."
It is tested on the maintainer's Samsung Galaxy Z Fold and, since take
183, built on the maintainer's WSL2 workstation (before that: a claude.ai
sandbox and seed zips). Stack: Capacitor 8 + MapLibre GL 5 + an offline
bundle; a Python pipeline over the Geofabrik Michigan extract, DNR/USFS
ArcGIS layers, USGS DEM and imagery; a harness of smoke, render and the
gate; append-only ledgers. The counts on take 189's last build before its
seal (PROVEN, `~/apex-logs/smoke5-t189-audit2-3.log` and
`render-t189-audit2-full-1.log`): smoke 497 assertions over 5 passes, and
render 658 checks. The gate runs 47 checks at take 189 (the loop at
tools/gate.py:3127): 41 at take 187, five new at 188 (scale, badges, icons,
glyphs, licences) for 46, and check_pin_names new at 189. At take 188's
seal the counts were smoke 464 and render
606; at take 187, smoke 319 and render 318.

## Where it stands at take 189

**Play:** take 176 is the production baseline — `com.apexoffroad.app`,
closed testing since 2026-09-02. Takes 183–188 each went green in CI
(`gh run list`, PROVEN), and t184–t188 are pushed; t183 stays local. None
was promoted to Play: the A183 device check is open, and take 186 is the
Play candidate once it passes. Take 188 reached main through pull requests
(PR #1, then two CI fixes, PR #2 and PR #3); CI run 91 on the PR #3 merge
46fc298 was green and t188 is tagged there. **Take 189 was built on the
local branch `v5`** and goes to the maintainer as one commit on a branch
`take-189`, opened as a pull request; CI builds it at the merge.

Since the V3 brief (take 180):
- **181** — the first field reports: panels close on an outside tap and
  have Done (A192); back no longer exits (A193); a privacy link (A195).
- **182** — the first-run tour, on the real screen (A194).
- **183** — R8 on, asserted on the artifact (A183); the first take built
  on the workstation.
- **184** — the address index covers every county or the build refuses
  (A196).
- **185** — pins count what the map draws (A197 P1); CI keeps its cache
  (A198); an honest first-open text (A199); a compass readback (A201);
  the forest layer per mode (A205).
- **186** — the Pins selector (A197 P2); Set home in one button (A200);
  PROVISION regenerates from its tool (A204); a visual QA loop,
  `node tools/probe.mjs take` (A206).
- **187** — V4's foundation, nothing a rider should see change: CSS
  tokens proven by a computed-style diff, and guards on planted controls
  (A208); pin anchors and stale badges (A209); info pins held to their
  zoom (A210); harness blind spots, and the Fold's inner screen in the
  device matrix (A211).
- **188** — V4 itself: the design study's takes 188, 189 and 190 built as
  one take (the maintainer, 2026-09-24).
  - The map: Hybrid as the preview, with "Safer" lines (A202 D1–D5); Map
    and Hybrid only (A212); basemap and machine in one function (A213);
    casings follow their lines (A220).
  - D7: trails and forest roads unbroken at statewide zoom on Hybrid.
  - Pins: pins stay put in zoom bands (A197 P3); badges by shape and glyph
    (A214); "Map text" hides text only (A226).
  - The look and controls: readable at arm's length (A215); one component
    set (A216).
  - The flow: Route here, Return home and Ride it in fewer taps (A217).
  - The ride sheet from the mockup (A222); a resumed trip shows it (A221).
    A GPS failure refuses instead of simulating (A223), and the map
    controls hide while riding.
  - Marinas by water body: ruled out, "Marinas can stay as they are"
    (A219).
  - Every number is desktop headless; the Fold is UNKNOWN.
- **189** — V4's cap-off: what desktop Chrome could settle, after a
  render speed-up.
  - Render −18% to −24% (838 → 634 s), PARTIAL against its 30% target and
    eroded by 50 new checks; `--only=<sections>` with per-section floors
    (A227; the rest is A241).
  - Placeholder pin names ("A"–"F", "11", "car parking") ship unnamed,
    labelled by kind, the source's text on the card (A228).
  - The attribution (i) clear of the drawer (A229); "Waiting for a GPS
    fix" (A230); Tools panels on a small phone while riding (A231); the
    licence on one line (A232); Ride beside Return home, free ride in one
    tap (A233); a loop re-joins itself (A234); one river-run estimate
    (A235); a glyph readback for the Fold (A236).
  - "Of you" only from a live fix, and Dispatch and Locate say when a fix
    is old (A237); the bike's route cards whole (A238); render's trails
    checks run (A239); a tapped card no longer folds itself (A240).
  - A cold audit's 20 findings, all fixed. Every number is desktop
    headless; the Fold is UNKNOWN.

## V4 — the presentation overhaul (A203)

The maintainer, 2026-09-23: "The feature set is there, we just need to
present it better." The study is `docs/DESIGN-v4.md`: a measured audit,
the rules taken from the ui-ux-pro-max skill, the decisions, and takes
187–190 (foundation, the map, the look, the flow). Its pieces are A197 P3,
A202 and A208–A217. Decided that day: one dark look; study first; the look
transcribed from the maintainer's reference screenshots (landmine 190),
which were received 2026-09-23 and transcribed (DESIGN-v4 §4); Map +
Hybrid only.

Take 187 built the foundation. Then came a clickable mockup (a private
claude.ai page). The maintainer judged it on 2026-09-24: "I'm a massive
fan of your mockup". The same day he made 188–190 one take. Take 188 built
it; DESIGN-v4 §9–§12 carry the "Built, take 188" notes and his later
decisions:
- 2026-09-24: marinas as they are; the ride sheet as the mockup draws it.
- 2026-09-25: the controls hide while riding; a GPS failure refuses;
  Hybrid "Safer"; "All labels" becomes map text only.
- 2026-09-25 and 2026-09-30: D7 "Accept the cost", then "Trails + forest
  roads only".

Take 189 capped off what desktop Chrome could decide (DESIGN-v4 §12).
What remains for V4: take 190, the screens the mockup never designed —
the take-190 plan, approved as the V4 mockup's artboards 10–23 (Plan and
Tools as sheets of labelled rows, each tool inside the sheet with a back
arrow, one primary per screen, Machine a picker and fuel range a stepper,
Search, Loop, Saved, Compass, HD imagery, Mark this spot, Diagnostics,
Data sources, Turns, the Ride tab before a ride, the first-run tour card);
then the maintainer's Fold session; then one polish take on what the phone
shows.

The screens are outside the repo: the "before" screens in
`~/apex-shots/v4-baseline/`, take 187's in `~/apex-shots/t187/`, take
188's in `~/apex-shots/t188/` and take 189's in `~/apex-shots/t189/`.

## What only the phone can answer

- The A183 device check: R8 on the phone.
- The whole-state HD save: whether Samsung's WebView grants ~215 MB of
  IndexedDB (A190).
- The self-test COMPASS line (A201) — the fix waits on it.
- Sunlight, gloves and the fold seam — never measured (A18).
- Spoken turns: the Fold's WebView has no Web Speech API (A218).
- The Fold's inner-screen CSS viewport — answered: 749×832 at dpr 2.625
  (A197 Q3), in render's device matrix since take 187.
- Take 188 on the phone. Every take-188 number is desktop headless Chrome
  or node. These questions only the Fold can answer:
  - the V4 look in sun and with gloves;
  - D7's cost at start-up (the self-test's `RENDER/net-lo` line);
  - the pin-band build (the `stack-build` row);
  - whether the faint too-wide two-track on Hybrid still reads.
- Take 189 on the phone: the self-test's `RENDER · glyphs` line (A236:
  in headless no label glyph loads from the pack; on the Fold, UNKNOWN —
  the fix waits on it); a ride started under trees ("Waiting for a GPS
  fix"); a loop left and re-joined (A234).

## How work happens (since take 183)

- The clone at `~/apex-orv` is the workspace and the repo head is the
  truth. A take is one ordinary commit, `take N: …`, that CI builds; the
  commit hash is the seal. The procedure is CLAUDE.md, "How a take works
  here".
- Stages run one at a time, in the background, logged to
  `~/apex-logs/<stage>-t<N>.log` and polled to their exit line. Measured
  at take 183: pipeline 2,054 s, gate 385 s (HANDOFF, take 183).
- Push, tags, Play, signing and secrets only on the maintainer's explicit
  go; `t<N>` is tagged after CI is green.
- Still true from the sandbox years: kill by exact name, never by a
  pattern your own shell carries (landmine 204); stop a detached stage by
  the PID its log records (221); stubs on browser accessors need
  `Object.defineProperty` (216); nothing inside a `page.evaluate` may
  throw (217); do not re-split `www/` while a render runs; the gate
  buffers its output; two chats, one ledger — check the highest agenda
  and landmine numbers before assigning one.
- New at take 187: a harness hook is not a readiness signal (222); a
  reset marker must not be a value the data can produce (223); in
  headless Chrome a transition waits for a frame — draw one before
  reading layout after a class change (224).
- Take 188 only: parallel lanes in git worktrees. Every Chrome command
  ran under `flock /tmp/apex-chrome.lock`, and a stage was stopped only by
  the PID its log recorded. From step 13b on, a locked launch waited up
  to 60 s for `pgrep -x chrome` to read 0 and refused otherwise (228).
- New at take 188:
  - a churn metric that counts things leaving the view measures the
    camera (225);
  - a line shorter than the tiler's tolerance is dropped whole (226);
  - a plant that compares a value with itself can never fail (227);
  - a released lock is not an exited Chrome (228);
  - a queued `flock … > log` truncates its log at launch (229);
  - an opaque panel can make headless Chrome cull a strip of the map
    (230);
  - judge a mark's contrast against the surface it is drawn on (231);
  - close a GPS watch through the handle that opened it (232);
  - working notes a take depends on do not belong in /tmp (233).
- Take 189: the same lanes, under `~/apex-t189-work`; lanes run render's
  `--only=<sections>` plus their declared setups, and the full render at
  every merge and at the gate stays the authority. Single gate checks:
  `python3 ~/apex-t189-work/gatefn.py check_a check_b` from the tree to
  check (it prints the tree it read).
- New at take 189:
  - an idle wait with no repaint runs to its ceiling (236);
  - under `--only`, declare every check's section and every setup (237);
  - speeding animations changes orderings (238);
  - moveend says the camera stopped, not who moved it (239);
  - a drill inherits the state earlier drills left (240);
  - a flex item's width test is vacuous (241);
  - prove a new guard on the build that has the bug (242);
  - a new state's wording blinds older guards (243);
  - a live fix is a question of its age (244);
  - a worktree lane reaches the main tree through a symlink (245);
  - compare timings only A/B in one window (246).
- At this brief: take 189 built, agenda A244, landmine 246. Next numbers:
  take 190, agenda A245, landmine 247.

## Order (as of 2026-10-01)

1. **Tester field reports** as they arrive — each an agenda item, and in
   a take.
2. **A183** — the device check; take 186 is the Play candidate.
3. **V4 (A203)** — `docs/DESIGN-v4.md`. Take 187 built the foundation,
   take 188 the rest as one take, and take 189 the desktop-decidable
   gaps. Next is take 190 (the take-190 plan, approved as the V4 mockup's
   artboards 10–23), then the maintainer's Fold session and one polish
   take.
4. **A189** — the "Road hazards" layer, designed at take 180; build after
   A183, on approval. How it ranks against V4 is the maintainer's call
   (not yet made).
5. **Production listing** when the tester round is clean.

Also open: A207 (CI's compute steps never skip), A201's fix, A241 (the
rest of the render speed-up), A242–A244 (found in take 189), the Play
screenshots taken on the Fold.

## Standing rules

No invented features (reference material first — LANDMINES governs);
measurement before decisions; real progress bars, never timers; **nothing
downloads on its own**; design before build on anything large, with
explicit ruled-outs; every ready fix goes into the next take, each with
its own agenda item and HANDOFF paragraph (HANDOFF, take 185); audit
before sealing; card text literally honest; "Continue" delegates, "get
this right" means do not seal until every item is hit; the document is
the bug when it disagrees with the code.
