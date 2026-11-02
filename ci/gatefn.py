"""Run named checks from tools/gate.py, and only those.

    python3 ci/gatefn.py check_handoff check_stamps check_workflow_yaml

The gate runs every check at import time, so this executes gate.py's source
up to its check loop (definitions only), then calls the named checks and
prints them the way the gate does. It is a working aid between edits: the
whole gate, in CI, stays the last word. It replaces the helper that lived
in a work folder on the workstation (deleted; landmine 248).

It prints the tree it read, so a run from the wrong checkout says so.
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GATE = os.path.join(ROOT, "tools", "gate.py")
LOOP = "\nfor fn in (check_handoff,"

names = sys.argv[1:]
if not names:
    sys.exit("usage: python3 ci/gatefn.py check_a [check_b ...]")
src = open(GATE, encoding="utf-8").read()
cut = src.find(LOOP)
if cut < 0:
    sys.exit("ci/gatefn.py: gate.py's check loop not found — its anchor moved")
g = {"__name__": "gatefn", "__file__": GATE}
sys.path.insert(0, os.path.dirname(GATE))
exec(compile(src[:cut], GATE, "exec"), g)
bad = [n for n in names if not callable(g.get(n))]
if bad:
    sys.exit("ci/gatefn.py: no check named " + ", ".join(bad))
for n in names:
    try:
        g[n]()
    except Exception as e:
        g["fails"].append(f"{n} crashed: {e}")
print(f"GATEFN — {ROOT} — {', '.join(names)}")
for m in g["notes"]:
    print(f"  ok   {m}")
for f in g["fails"]:
    print(f"  FAIL {f}")
print("GATEFN PASSED" if not g["fails"] else f"GATEFN FAILED ({len(g['fails'])})")
sys.exit(1 if g["fails"] else 0)
