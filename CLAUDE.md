@AGENTS.md

# Claude Code in this repo

Since 2026-11-01 the workspace is a Claude Code cloud session, and GitHub
Actions is the build machine; the workstation that took takes 183–189 was
deleted, and with it the unpushed take 190 (landmine 248,
`docs/RECOVERY-t190.md`). The repo head is the single source of truth. A
take is an ordinary commit that CI builds. `docs/PROTOCOL.md` is the law;
`docs/LANDMINES.md` §0 is the symptom index.

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

## A fresh cloud session
`bash ci/cloud_setup.sh` readies the container: npm without puppeteer's own
Chrome, the Chrome CI pins (render on any other Chrome is not CI's render,
landmine 249), and `www/bundle` + `www/vendor` restored from the APK of the
newest green CI run on main. Export the `PUPPETEER_EXECUTABLE_PATH` it
prints. The pipeline cannot run here: Geofabrik and overpass-api.de close
this cloud's connections (PROVEN 2026-11-01). A take that changes the
pipeline or the data is proven by CI's run, which builds everything.

## How a take works here
1. Record first: HANDOFF entry, AGENDA item with a `Ruled out:` line, a
   landmine for anything that bit, `BUILD` and the title in `src/app.html`,
   the take's own `ci/RELEASE.md` (the release's and Play's notes; gate
   check_release_notes), then `python3 tools/stamp.py`.
2. Build the app: `python3 tools/build_app.py split` turns `src/app.html`
   into `www/`, then `bash ci/cloud_setup.sh bundle` puts back the bundle
   `split` clears (landmine 250). The pipeline runs in CI (above).
3. Verify: `node tools/smoke.mjs`, `node tools/render.mjs` (on CI's Chrome),
   and the gate checks that need no pipeline output through
   `python3 ci/gatefn.py check_a check_b …`, each to its exit line. The
   whole gate runs in CI.
4. Audit the diff cold (PROTOCOL §0.3). Read `git status` before staging;
   never `git add -A` blind.
5. Push work in progress to the session's branch at every green step, with
   a draft pull request open (landmine 248). At the seal the take is one
   commit `take N: <what changed>`; `www/app.js`, `www/index.html` and
   `docs/PROVISION.md` are built outputs that ship in it.
6. Mark the pull request ready for review: CI builds it (pipeline, render,
   gate, signed APK as a run artifact; no release). The maintainer merges;
   CI's run on main publishes the release, and is the last word. The
   commit hash is the seal.
Take, agenda and landmine numbers are assigned only in this repo. Any other
surface starts from the repo head.

## Long stages
Render runs for many minutes (about 19 on a 4-core cloud container). Run it
in the background, log to a file under `~/apex-logs/`, and poll until the
exit line (`RENDER PASSED` / `RENDER FAILED`, `SMOKE PASSED`, `GATEFN
PASSED`) is in the log. Never report a stage done before that. One render
at a time. Before launching:
`ps -eo comm | awk '$1=="node"||$1=="chrome"' | wc -l` must print 0;
`df -h /`; `rm -rf /tmp/puppeteer_dev_chrome_profile-* /tmp/apex-fatal-*`.
Kill by exact name (`pkill -x node`), never by a pattern the calling shell
carries (landmine 204). Launch as `setsid nohup bash -c 'echo "PID $$"; …' &`
and stop by the PID the log's first line records, never by `$!`, which is
a parent that has already exited (landmine 221). Read the process count
between a kill and a launch. Do not restore `www/bundle` while a render
runs. Logs and screenshots in the container die with it: a number a take
cites goes into its HANDOFF entry.

## Push hygiene
- The workflow builds main on pushes touching `BUILD`, `src/**`,
  `tools/**`, `regions.json`, `package*.json`, `capacitor.config.json`,
  `signing/**` and `apex-seed*.zip`; docs-only and `ci/**` pushes do not
  build main.
- A pull request into main builds when it is ready for review and touches
  those paths, `ci/**` or `.github/workflows/**`; a draft does not build.
  Each pull request has its own concurrency group, so it never cancels a
  build of main; main's `cancel-in-progress` is on: run `gh run list`
  before pushing a second build-triggering commit to main.
- `ci/build.yml` and `.github/workflows/apex.yml` change in the same commit
  and stay byte-identical (`cmp` them). The seed job and `apex-seed*.zip`
  in `push.paths` are load-bearing (landmine 202).
- Standing go (the maintainer, 2026-11-01): push to the session's own
  `claude/…` branch and open draft pull requests. Never push to main,
  publish a release, touch Play, or change signing or secrets without the
  maintainer's explicit go. Since 2026-11-02 he lets a session merge its
  pull requests once CI is green ("merge them yourself … when they're
  green").
- Tags (the maintainer, 2026-11-02, "CI tags tN itself"): CI tags each
  take `tN` on its first green build of main (`ci/tag_take.sh`, after the
  release). A take built before that, or a missed one, is tagged by the
  `tag` workflow (Actions, "Run workflow": take, commit, release). A
  session never pushes a tag: its git gets HTTP 403 (landmine 257).

## Truth
Code is the truth; a document that disagrees with it is the bug. Fix the
document and cite the code line. Nothing personal in committed files: say
"the maintainer".
