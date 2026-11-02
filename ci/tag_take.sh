#!/usr/bin/env bash
# Tag a take: an annotated tN on the commit CI built green.
#
#   bash ci/tag_take.sh <take> <commit> [<release tag>] [check]
#
# The workstation pushed these by hand through take 189; a cloud session's
# git cannot push a tag (HTTP 403, 2026-11-02), so CI does it with its own
# token (the maintainer, 2026-11-02: "CI tags tN itself"):
#   - the build workflow's apk job, after a green build of main publishes its
#     release, tags the take BUILD names on the commit it built;
#   - the tag workflow (Actions tab, "Run workflow") tags one by hand, for a
#     take whose build of main came before this script; with "check" it first
#     requires the commit to be on main with a successful build run.
# A tag that exists is left as it is: a take's FIRST green build of main is
# its tag. DRY=1 prints what it would push and pushes nothing.
set -euo pipefail
TAKE="${1:-}"; SHA="${2:-}"; REL="${3:-}"; CHECK="${4:-}"
case "$TAKE" in ''|*[!0-9]*) echo "tag: the take must be a number, got '$TAKE'"; exit 2;; esac
case "$SHA" in ''|*[!0-9a-f]*) echo "tag: the commit must be a hex sha, got '$SHA'"; exit 2;; esac
T="t$TAKE"
git cat-file -e "$SHA^{commit}" 2>/dev/null || git fetch -q origin "$SHA"
SHA="$(git rev-parse --verify "$SHA^{commit}")"

if git ls-remote --exit-code --tags origin "refs/tags/$T" >/dev/null 2>&1; then
  echo "tag: $T exists — left as it is"; exit 0
fi

# the take this commit carries: BUILD at the commit, not the caller's word
AT="$(git show "$SHA:BUILD" | sed -n 's/^OFFROAD_TAKE=\([0-9]*\)$/\1/p')"
test "$AT" = "$TAKE" || { echo "tag: $SHA is take ${AT:-?} by its BUILD, not take $TAKE"; exit 1; }

if [ "$CHECK" = check ]; then
  git fetch -q origin main
  git merge-base --is-ancestor "$SHA" origin/main || { echo "tag: $SHA is not on main"; exit 1; }
  REPO="${GITHUB_REPOSITORY:?}"
  N="$(gh api "repos/$REPO/actions/runs?branch=main&head_sha=$SHA&status=success" --jq '.total_count')"
  test "${N:-0}" -ge 1 || { echo "tag: no successful build of main on $SHA"; exit 1; }
fi

NOTE="$(git show "$SHA:ci/RELEASE.md" | sed -n '/[^[:space:]]/{s/\*\*//g;p;q}')"
MSG="$NOTE

Commit ${SHA:0:7}, built green by CI${REL:+; release $REL}. Tagged by ci/tag_take.sh."
if [ "${DRY:-}" = 1 ]; then
  printf 'tag: DRY — would push %s on %s:\n%s\n' "$T" "${SHA:0:7}" "$MSG"; exit 0
fi
git -c user.name="github-actions[bot]" \
    -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
    tag -a "$T" "$SHA" -m "$MSG"
git push origin "refs/tags/$T"
echo "tag: pushed $T on ${SHA:0:7}"
