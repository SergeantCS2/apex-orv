# RECOVERY · take 190 — what was lost with the workstation, and what survives

*Written 2026-11-01 in a cloud session, from GitHub and the UI/UX chat's
transcript (session "UI/UX", 2026-09-23 → 2026-10-09). Every claim is
labelled as the protocol asks. The rule this taught is landmine 248.*

## 1 · What happened

- Takes 183–189 were built on the maintainer's WSL2 workstation. Take 189
  was built on the local branch `v5`, squashed onto the branch `take-189`,
  merged as PR #4 on 2026-10-02 15:26Z (9a65674), built green by CI run 92
  (release `take-92`), and tagged `t189` on 2026-10-03 03:18Z (PROVEN:
  GitHub, and the release's APK equals the committed `www/` byte for byte,
  2026-11-01).
- Take 190 was started the same day, 2026-10-02 15:54Z, on the local branch
  `v6` from take 189's seal (`b8f0910` on `v5`), as an overnight multi-agent
  run: record first, a sheet-framework lane F, then lanes T, P, S and R in
  parallel worktrees, merges, an integration, a cold audit and a batch
  brief. Usage limits stopped it on 2026-10-03, 04, 05, 06 and 07; the
  maintainer resumed it each time (PROVEN, the chat).
- On 2026-10-08 01:01Z the run stopped for the maintainer's six batch
  decisions; he answered "1a 2b 3a 4a 5a 6a" and the run resumed at
  01:07Z. The last activity is 02:12Z on 2026-10-08 (a lane re-verify and
  a fix round); a client reconnected on 2026-10-09 05:52Z and stopped two
  background tasks. The seal never ran, and nothing on `v6` was pushed
  (PROVEN: no `v6` branch or commit on GitHub; every driver prompt says
  "Never push").
- The workstation was then deleted. With it went `v6` and its lane
  branches, `~/apex-logs`, `~/apex-shots`, `~/apex-t189-work`,
  `~/apex-t190-work` and the subagents' transcripts.

## 2 · What was lost (PROVEN unless labelled)

- **The take-190 code.** About 20 commits on `v6` (head `c6e0796` on
  2026-10-08; the session record's `b44d8b0` is six commits older):

  | Commit | What |
  |---|---|
  | cd5639f | record first: BUILD 190, the title, the HANDOFF entry, AGENDA A247–A266 |
  | bff32ad, c9f501b, 9c1105f | lane F, the sheet framework, merged and integrated |
  | 2e0b4af, 91fb0d8, 6d64433 | lane P (Machine picker, fuel stepper, Home and Start from my position, Loop, Saved), merged; pc-start's words |
  | d8dbdd4, c82b4d2 | lane T (compass sheet, HD tiers, Mark this spot, Diagnostics, Data sources), merged |
  | c84efe0, 5e47f9a | lane S (Search as a sheet), merged |
  | ed72d93, b44d8b0 | lane R (the Ride card, Turns, the tour card), merged |
  | dc38959, e521b84, 718ef25, 4be35b5 | fix rounds for P and R, merged |
  | 6eb48d4 | integration of T, P, S, R |
  | c6e0796 | the cold audit's round-1 fixes: 15 of 18 defects behind 20 findings |
  | (UNKNOWN) | "wip 190 batch decisions: 2b 3a 4a 5a 6a" was scripted; it was never seen made |

  Files changed (PROVEN, `git status` per lane on 2026-10-03):
  `src/app.html`, `tools/render.mjs`, `tools/smoke.mjs`, `tools/gate.py`,
  `tools/manifest.py`, `docs/AGENDA.md`, `docs/DESIGN-v4.md`,
  `docs/PROVISION.md`, `docs/TESTING.md`, `www/app.js`, `www/index.html`.
  Line counts were never printed (UNKNOWN).
- **Why it cannot be replayed.** Every edit to the repo was made by a
  workflow subagent. The chat's transcript holds only the orchestrator's
  own calls and each agent's report cut to about 400 characters; the
  subagents' own transcripts were on the workstation. No diff, patch or
  `git diff --stat` of `v6` was ever printed in the chat.
- **The measurements.** Lane and integration logs: lane F render 681 ok in
  1,317 s and SMOKE5 510; lane P render 706 ok and SMOKE5 553; T SMOKE5
  521; S 530; R 537; after the audit fixes SMOKE5 626 ok (PROVEN, as the
  agents reported them; the logs are gone). The full gate never ran on
  `v6`.
- **The working notes**: `plan190.md`, `plan190-delta.md`, the `wp-*.json`
  work packages, the lane driver, `pending/*.md` and every `*.patch`.
  Some of their text survives in the chat (section 6).

## 3 · What survives

- **main, at take 189** (9a65674), the branch `take-189`, the tag `t189`
  and the releases on GitHub.
- **The V4 mockup**: the private claude.ai artifact "APEX V4 mockup", all
  23 artboards at 411×960, version 1792822710-8607 (PROVEN, read
  2026-11-01). Artboards 10–23 are take 190's screens: 10 Plan tab,
  11 Search, 12 Loop from here, 13 Saved, 14 Your machine, 15 Turns,
  16 Tools tab, 17 Compass, 18 HD imagery, 19 Mark this spot,
  20 Diagnostics, 21 Data sources, 22 Ride before a ride, 23 First run:
  the tour. The maintainer, 2026-09-30: "The take-190 screens are
  approved."
- **The maintainer's decisions**, word for word (section 5).
- **The item table** (section 4) and the six-item batch brief (section 5).

## 4 · Take 190's items (the record-first table, recovered verbatim)

A247 was the next free id (the repo's highest was A246). These numbers were
never committed; take 190's rebuild keeps them so the decisions below still
cite the right items. "Lane" is the lost run's split.

| Id | Item | Artboard | Lane |
|---|---|---|---|
| A247 | The sheet framework (one sheet attribute, row, back row, fold rule, icons, `window.__sheet`) | 10, 16 | F |
| A248 | The Plan index: search entry, Return home (pinned at the sheet foot if it would scroll at 360x800 or 749x832), From here / Your ride rows | 10 | F (P's tools fill its rows) |
| A249 | The Machine picker | 14 | P |
| A250 | The fuel range stepper | 10 | P |
| A251 | Search as a sheet | 11 | S |
| A252 | Search's back (two presses), jump chip (search left on), address arm (survives) defects | 11 | S |
| A253 | Loop from here (pick, then Find; honest start line; LOOP_PICK/LOOP_MI) | 12 | P |
| A254 | Saved (rows; other-region records counted; Mark this spot via T's markHere, I3) | 13 | P |
| A255 | The Tools index | 16 | F (T fills the tools) |
| A256 | Diagnostics and About this build | 20 | T |
| A257 | Data sources: notice first, linked sources + U.S. Census Bureau + AWS Terrain Tiles (DECIDED 2026-10-02) | 21 | T |
| A258 | The compass in the sheet off a ride; it keeps FLOATING during a ride (take 189's #cmppanel + cmpFit) | 17 | T |
| A259 | HD imagery's three tier cards | 18 | T |
| A260 | Mark this spot: fresh GPS fix on press ("Getting a GPS fix…" + Cancel; 30 s then Try again; never a guessed spot or the last fix); ease to zoom 11+; name, Done, Undo; no silent overwrite | 19 | T |
| A261 | Turns: one scroller, Ride it pinned, "N more steps below" | 15 | R |
| A262 | The Ride tab before a ride: Ride card, Start riding the ONLY Start; #btn-ride hides on the Ride tab | 22 | R |
| A263 | The tour card: Next and Skip, ring re-placed after the slide, TOURKEY bumped once | 23 | R |
| A264 | A tapped pin stays in view when its card opens (FOUND take 189 final shot 09; ease once into the clear band; A240 holds; render read at 360x800 + 411x960 with a planted control) | — | F |
| A265 | OPEN, not built: the place card's Save as waypoint silently replaces a same-named waypoint (wpAdd, app.html:4128-4132) | — | none (OPEN) |
| A266 | OPEN, not built: HD progress drawn as a snapshot (hdCard, app.html:7298-7310) | — | none (OPEN) |

Notes the table carried: A257's two new links (census.gov, the AWS
registry/terrain page) are displayed, never fetched, so gate.py's
check_offline ALLOW list gains the new hosts with the same comment shape,
and check_licences must still pass. A260's "no silent overwrite" covers
Mark's own names; A265 (the place card path) is not changed by take 190.
The line numbers above are take 189's `src/app.html`.

## 5 · The maintainer's decisions (quoted from the chat's notes)

**2026-09-30.** "The take-190 screens are approved" (the mockup's
artboards 10–23).

**2026-10-02, before the overnight run** — "I want you to work on the next
when this one is complete overnight, get any approvals out of the way
now." Recorded as:
- Mark this spot with no live fix: **take a fresh GPS fix on Mark**,
  showing "Getting a GPS fix…" with Cancel; **after 30 s with no fix it
  says so and offers Try again — it never marks a guessed spot** (not the
  last fix as a fallback).
- Compass while riding at 360: the default — **the compass keeps FLOATING
  during a ride** (take 189's #cmppanel), not in the sheet.
- One Start on the Ride tab: **the Ride card's "Start riding" is the only
  Start there; the folded drawer's Ride (#btn-ride) hides on the Ride
  tab.**
- Mark pin: after a mark, **ease to zoom 11+** so the new green pin draws
  above the sheet (the real pin, no temporary marker). Changed to z12.5 on
  2026-10-02 23:20 (below).
- Stacking: take 190's pull request follows take 189's; he merges each.
  **Standing go to tag t189 and t190 once CI is green after he merges
  each PR** (an annotated tag on the commit CI built green, pushed alone).
- Plan sheet fit: if Return home would need a scroll at 360x800 or
  749x832, **pin a slim Return home row at the sheet's foot** (always
  visible).
- Data sources: **add the U.S. Census Bureau (TIGER county lines, address
  ranges) and the elevation tiles (AWS Terrain Tiles)**, the independence
  notice staying first.
- A227: **accept 24%, record the rest as an OPEN item** (no option (a)).
- Stops: "Don't cut it, but have it prepped for me to approve all at the
  end for when I return if possible so I can approve all — then you knock
  them out. Otherwise 1 [cut that piece, finish the rest]."

**2026-10-02 23:20, asked live while the lanes ran:**
- F-diag-ride-float — **(a) Diagnostics floats like the compass during a
  ride, as built.**
- F-ride-sheet-footer — **1, the contract as built: while riding, a
  sheet's body is its rows followed by the stats and coordinates (one
  scroll away); the action row stays one tap.**
- T-mark-pin-label — **(b) ease to z12.5 instead of z11** (still "zoom
  11+") so the mark's name label draws below the "you" marker.

**2026-10-03, pc-start ("Start from here" on the place card):** "Fix it,
same words as Plan." — option (a): pc-start uses the same predicate as the
Plan sheet's Start from my position (meDriven()) and the same sentence.
The sentence was then reworded by batch item 3 below.

**2026-10-08 01:01Z, the batch brief — "1a 2b 3a 4a 5a 6a", all as
recommended:**
1. R-turns-footer — **(a) keep Turns' action row, as built.** Every action
   stays one tap; the board draws no footer (landmine 135: hiding it
   would take Return home, Retrace and Dispatch from 1 tap to 2).
2. I-mark-from-saved-tab — **(b) keep the opener's tab**: Plan stays
   marked while Mark is up from Saved.
3. AUDIT-locate-cause — **(a) drop the bracket**: "GPS is on — the next
   fix in the region moves the start pin…" in both places (the Plan
   sheet's Start from my position and the place card's Start from here);
   the bracket "(a ride, or a Locate waiting for its fix)" named causes
   the rider never started when Mark's or Home's wait held GPS.
4. AUDIT-osm-official — **(a) move OpenStreetMap to OTHER DATA** with one
   sentence naming OSM and AWS: OSM is not an agency, so it does not
   belong under "These agencies are the authority".
5. AUDIT-primary-case — **(a) uppercase #rc-ride and #pc-route** (one
   CSS line): the boards draw primary buttons at 800 weight, 18 px,
   .06em, uppercase; a full render must show they fit at 360.
6. AUDIT-me-chevron — **(a) the chevron plus "Tap where you stand — plans
   start there, not the map centre"** on Start from my position (with the
   old text the chevron made the small phone's Plan list scroll: 568 px
   needed, 555 available; the shorter text needed 551 of 551).

**Departures from the boards the decisions make**: Turns keeps its action
row (item 1); Return home is pinned at the sheet foot where it would
scroll (2026-10-02); the compass and Diagnostics float during a ride
rather than sitting in the sheet (2026-10-02).

## 6 · Open at the end, never answered

- The offer to run one lane at a time (2026-10-04).
- Mark this spot accepted a fix up to 15 s old: "Say if you want a new fix
  every time."
- A reviewer's blocking finding in the last run: Retrace and Dispatch from
  the Ride tab went from 2 taps to 3, a landmine-135 rise never brought to
  the maintainer.
- Smaller: the Machine picker scrolls at 360×800; Return home from the
  Tools index on a ride went back to the Plan index; Save on a re-join
  card recorded a point-to-point route.
- A265 and A266 stay OPEN.

## 7 · Where the surviving texts are

The chat is session "UI/UX" (2026-09-23 → 2026-10-09) on the maintainer's
claude.ai account; it holds the orchestrator's calls and the agents'
summaries. The texts recovered from it are copied under
`docs/recovery-t190/`, with an INDEX naming each one's event and whether
it is whole. Paths inside them name the deleted workstation's home
directory as `~`.
