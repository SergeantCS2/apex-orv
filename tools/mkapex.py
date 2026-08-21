"""Generate the one-file installer workflow from build.yml.

apex.yml = build.yml with a `seed` job spliced in front. Generated rather than
maintained, because a hand-kept second copy is a copy that drifts — and the
splice must take build.yml's header VERBATIM, or you end up with two
`concurrency:` keys and a workflow GitHub refuses to run (landmine 79).
"""
import os
import re
import sys

import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# ci/build.yml, NOT .github/workflows/. GITHUB_TOKEN cannot create or update
# anything under .github/workflows (landmine 46), so the seed job must never
# write there — and a second workflow file would run the whole build twice on
# every push anyway. The canonical definition lives in ci/ where GitHub ignores
# it; apex.yml is the generated copy the user pastes once.
SRC = os.path.join(ROOT, "ci", "build.yml")

SEED_JOB = '''
  # ── one-file installer ──────────────────────────────────────────────────
  # Unpacks a seed zip sitting in the repo root the first time, then gets out of
  # the way. It exists because GitHub's mobile web UI cannot create folders from
  # an upload, and GITHUB_TOKEN cannot write .github/workflows — so the installer
  # has to BE the build rather than write it (landmines 42, 46, 77).
  seed:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - name: Unpack a seed zip if one is sitting in the repo root
        run: |
          ZIP=""
          for c in apex-seed.zip apex-orv-github-repo.zip; do
            [ -f "$c" ] && ZIP="$c" && break
          done
          if [ -z "$ZIP" ]; then
            echo "no seed zip in the repo root — nothing to unpack, going"
            echo "straight to the build (normal after the first run)"
            exit 0
          fi
          echo "unpacking $ZIP"
          unzip -oq "$ZIP" -d _seed
          # apex-orv-github-repo.zip nests everything under one folder; the plain
          # seed does not. Flatten either shape so the reasonable wrong choice
          # still works (landmine 78).
          SRC=_seed
          if [ ! -f _seed/BUILD ] && [ "$(ls -1 _seed | wc -l)" = "1" ]; then
            SRC="_seed/$(ls -1 _seed)"
            echo "  (nested zip — flattening $SRC)"
          fi
          # NEVER write .github/workflows: GITHUB_TOKEN is refused there
          # (landmine 46), and the workflow running this IS the build — a
          # second copy would run everything twice. Whatever you pasted stays.
          rm -rf "$SRC/.github"
          cp -a "$SRC/." .
          rm -rf _seed "$ZIP"
          echo "unpacked $(find . -type f -not -path './.git/*' | wc -l) files"
          # Gate BEFORE committing: a bad seed must not half-populate the repo.
          # APEX_GATE_SEED=1 skips the workflow-file checks: the workflow here is
          # the one YOU pasted, not part of the seed, and it cannot be updated by
          # this job (GITHUB_TOKEN has no workflows permission). Gating the seed
          # against it would deadlock — the fix ships in the seed the gate is
          # refusing to install (landmine 84).
          python3 -m pip install --quiet pyyaml
          APEX_GATE_SEED=1 python3 tools/gate.py
          git config user.name  apex-seed
          git config user.email seed@users.noreply.github.com
          git add -A
          git commit -m "seed: APEX ORV" || echo "nothing new"
          git push
'''


class NoDup(yaml.SafeLoader):
    """PyYAML keeps the LAST of duplicate keys; GitHub rejects the file."""


def _nodup(loader, node, deep=False):
    out = {}
    for k, v in node.value:
        key = loader.construct_object(k, deep=deep)
        if key in out:
            raise ValueError(f"duplicate key {key!r}")
        out[key] = loader.construct_object(v, deep=deep)
    return out


NoDup.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, _nodup)


def build():
    src = open(SRC).read()
    m = re.search(r"^jobs:[ \t]*$", src, re.M)
    if not m:
        sys.exit("build.yml has no top-level 'jobs:' key")
    header, jobs = src[:m.start()], src[m.end():]
    header = re.sub(r"^name:.*$", "name: APEX", header, count=1, flags=re.M)
    if "\n    paths:\n" not in header:
        sys.exit("build.yml push trigger has no paths: list")
    header = header.replace(
        "\n    paths:\n",
        "\n    paths:\n      - apex-seed.zip\n      - apex-orv-github-repo.zip\n", 1)
    if "\n  bundle:\n" not in jobs:
        sys.exit("build.yml has no bundle job")
    jobs = jobs.replace("\n  bundle:\n", "\n  bundle:\n    needs: seed\n", 1)
    out = header.rstrip("\n") + "\n\njobs:\n" + SEED_JOB.strip("\n") + "\n" + jobs.lstrip("\n")

    d = yaml.load(out, Loader=NoDup)          # refuses duplicate keys
    want = ["seed", "bundle", "pages", "apk"]
    if list(d["jobs"]) != want:
        sys.exit(f"jobs are {list(d['jobs'])}, expected {want}")
    if d["jobs"]["bundle"].get("needs") != "seed":
        sys.exit("bundle does not wait for seed")
    return out


if __name__ == "__main__":
    out = build()
    # Always write the repo copy so the GATE validates the file that actually
    # runs. Without it the workflow checks passed vacuously — there was no
    # workflow in the tree to check (take 56).
    repo = os.path.join(ROOT, ".github", "workflows", "apex.yml")
    os.makedirs(os.path.dirname(repo), exist_ok=True)
    open(repo, "w").write(out)
    dests = [repo]
    if len(sys.argv) > 1:
        open(sys.argv[1], "w").write(out)
        dests.append(sys.argv[1])
    print("apex.yml written to " + " and ".join(dests) + " — validated")
