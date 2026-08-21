#!/usr/bin/env python3
"""Update the take stamp in every doc — only the stamp line.

Takes 13-25 bumped stamps with a whole-file `replace('take N','take N+1')`.
It happened to be safe because each file carried exactly one take reference,
but any prose that deliberately cited an earlier take would have been silently
rewritten. History that edits itself is worse than a stale stamp.
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, "docs")
PAT = re.compile(r"^(\*(?:Current as of|Revised [0-9-]+,) take )(\d+)(\.\*)", re.M)


def take():
    for line in open(os.path.join(ROOT, "BUILD")):
        if line.startswith("OFFROAD_TAKE="):
            return int(line.split("=", 1)[1].strip())
    sys.exit("BUILD has no OFFROAD_TAKE")


def main():
    n = take()
    for fn in sorted(os.listdir(DOCS)):
        if not fn.endswith(".md"):
            continue
        p = os.path.join(DOCS, fn)
        s = open(p).read()
        new, hits = PAT.subn(lambda m: f"{m.group(1)}{n}{m.group(3)}", s)
        if hits == 0:
            print(f"  {fn}: no stamp line")
        elif new != s:
            open(p, "w").write(new)
            print(f"  {fn}: stamped take {n}")
        else:
            print(f"  {fn}: current")


if __name__ == "__main__":
    main()
