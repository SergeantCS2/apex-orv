@AGENTS.md

# Claude Code in this repo

This clone on the maintainer's workstation is the workspace; the repo head is
the single source of truth. A take is an ordinary commit that CI builds.
`docs/PROTOCOL.md` is the law; `docs/LANDMINES.md` §0 is the symptom index.

## Read order at session start
1. `docs/NEW-CHAT-BRIEF.md`, then `docs/HANDOFF.md` newest entries first
2. `docs/PROTOCOL.md` §0 and §1
3. `docs/LANDMINES.md` §0, then the entries a symptom points to
4. `docs/AGENDA.md`: grep for OPEN, BUILDING, DESIGNED, pending; read those
Never read a ledger whole; grep for the rest. Before proposing work, verify
`BUILD`, the HANDOFF head and the highest agenda and landmine numbers.

## Evidence
Every claim about behaviour is PROVEN (observed; say what), INFERRED
(reasoned) or UNKNOWN. When in doubt, label down. Desktop Chrome is not the
Fold's WebView; a green CI run is not a phone in the woods.

## How a take works here
1. Record first: HANDOFF entry, AGENDA item with a `Ruled out:` line, a
   landmine for anything that bit, `BUILD` and the title in `src/app.html`,
   then `python3 tools/stamp.py`.
2. Build: `python3 tools/pipeline.py`, with `APEX_PHOTO_BUDGET_S=0` unless
   the take refreshes photos on purpose. A touched pipeline step must
   execute its changed path before the commit; a changed step gets a clean
   run (PROTOCOL §6b).
3. Verify: smoke, render, then `python3 tools/gate.py`, each to its exit line.
4. Audit the diff cold (PROTOCOL §0.3). Read `git status` before staging;
   never `git add -A` blind.
5. One commit `take N: <what changed>`. `www/app.js`, `www/index.html` and
   `docs/PROVISION.md` are built outputs that ship in the commit.
6. Push once, on the maintainer's explicit go. CI's gate is the last word; a
   red run means the take is not promoted. The commit hash is the seal.
Take, agenda and landmine numbers are assigned only in this repo. Any other
surface starts from the repo head.

## Long stages on this machine
Render and gate run for many minutes. Run them in the background, log to a
file, and poll until the exit line (`GATE PASSED` / `GATE FAILED`, or the
render summary and its exit code) is in the log. Never report a stage done
before that. One render or gate at a time. Before launching:
`ps -eo comm | awk '$1=="node"||$1=="chrome"' | wc -l` must print 0;
`df -h /`; `rm -rf /tmp/puppeteer_dev_chrome_profile-* /tmp/apex-fatal-*`.
Kill by exact name (`pkill -x node`), never by a pattern the calling shell
carries (landmine 204).

## Push hygiene
- The workflow builds on pushes touching `BUILD`, `src/**`, `tools/**`,
  `regions.json`, `package*.json`, `capacitor.config.json`, `signing/**`
  and `apex-seed*.zip`; docs-only pushes do not build.
- `cancel-in-progress` is on: run `gh run list` before pushing a second
  build-triggering commit.
- `ci/build.yml` and `.github/workflows/apex.yml` change in the same commit
  and stay byte-identical (`cmp` them). The seed job and `apex-seed*.zip`
  in `push.paths` are load-bearing (landmine 202).
- Never push, tag, publish a release, touch Play, or change signing or
  secrets without the maintainer's explicit go.

## Truth
Code is the truth; a document that disagrees with it is the bug. Fix the
document and cite the code line. Nothing personal in committed files: say
"the maintainer".
