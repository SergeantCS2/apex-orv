#!/usr/bin/env python3
"""Sweep candidate colours for the classes the take-76 measurement flagged.

The finding that reframed this: the palette was tuned against the SAND basemap
(#E4D7BC) and the app opens on Map — but the rider uses Satellite/Hybrid, where
the backdrop is dark desaturated green. A mid-tone grey-tan that reads fine on
sand disappears over jack pine. `fsroad` measured dE 15.8 against median ground
and it is the one ridable class with NO casing to save it.

So every candidate is scored against BOTH backdrops, plus against the classes it
has to stay distinct from. A colour that wins on one basemap and loses on the
other is not a candidate.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from colour_probe import (hex_rgb, dE, sample_backdrop, backdrop_bands)  # noqa

SAND = hex_rgb("#E4D7BC")      # the Map basemap ground
WHITE = hex_rgb("#FFFFFF")

# What each class must stay clear of, and by how much.
# dE 2.3 is a just-noticeable difference; 10 is "clearly different"; 25+ is
# unmistakable at a glance on a 2 px line at arm's length on a moving bike.
MIN_VS_BACKDROP = 15.0
MIN_VS_SIBLING = 15.0


def score(name, cand, bands, siblings):
    c = hex_rgb(cand)
    sand = dE(c, SAND)
    sat = {b: dE(c, bg) for b, bg in bands.items()}
    worst_sat = min(sat.values())
    sibs = {k: dE(c, hex_rgb(v)) for k, v in siblings.items()}
    worst_sib = min(sibs.values()) if sibs else 99
    ok = (sand >= MIN_VS_BACKDROP and worst_sat >= MIN_VS_BACKDROP
          and worst_sib >= MIN_VS_SIBLING)
    return dict(cand=cand, sand=sand, worst_sat=worst_sat, worst_sib=worst_sib,
                sibs=sibs, ok=ok)


def sweep(title, candidates, siblings, bands, current=None):
    print(f"\n{'='*78}\n{title}\n{'='*78}")
    print(f"  {'candidate':<12}{'vs SAND':>9}{'worst SAT':>11}"
          f"{'worst sibling':>15}   verdict")
    rows = []
    for c in candidates:
        r = score(title, c, bands, siblings)
        rows.append(r)
        tag = "current" if c == current else ""
        v = "OK" if r["ok"] else "fails"
        why = []
        if r["sand"] < MIN_VS_BACKDROP:
            why.append("sand")
        if r["worst_sat"] < MIN_VS_BACKDROP:
            why.append("satellite")
        if r["worst_sib"] < MIN_VS_SIBLING:
            why.append(min(r["sibs"], key=r["sibs"].get))
        if why:
            v += " (" + ",".join(why) + ")"
        print(f"  {c:<12}{r['sand']:>9.1f}{r['worst_sat']:>11.1f}"
              f"{r['worst_sib']:>15.1f}   {v} {tag}")
    good = [r for r in rows if r["ok"]]
    if good:
        best = max(good, key=lambda r: min(r["sand"], r["worst_sat"]))
        print(f"  -> best balanced: {best['cand']} "
              f"(sand {best['sand']:.1f}, satellite {best['worst_sat']:.1f}, "
              f"nearest sibling {best['worst_sib']:.1f})")
    else:
        print("  -> nothing passes; the constraint set may be wrong")
    return rows


if __name__ == "__main__":
    px = sample_backdrop()
    bands, _ = backdrop_bands(px)
    print("\nbackdrop bands:")
    for b, c in bands.items():
        print(f"   {b:<26} rgb({c[0]:.0f},{c[1]:.0f},{c[2]:.0f})")
    print(f"   {'SAND basemap':<26} rgb(228,215,188)")

    # ── fsroad: the one that measurably cannot be seen ──────────────────────
    sweep("fsroad — forest road (NO casing; must read as ROAD, not trail)",
          ["#8A7C66",              # current
           "#9C8E76", "#AE9E82", "#BFAE90", "#C9B896", "#D4C4A4",
           "#B5A176", "#C2B183", "#CDBF9B"],
          {"track": "#9C7343", "minor": "#4A443B", "paved": "#3A352E"},
          bands, current="#8A7C66")

    # ── route72: weakest of the three designated tiers against the ground ───
    sweep("route72 — easy / 72\" ORV route (green, has a white casing)",
          ["#2F7D4F",              # current
           "#199A55", "#12A150", "#0FAE57", "#23B061", "#2FBF6B", "#00994D"],
          {"trail50": "#2585D8", "mccct": "#1C1A16", "track": "#9C7343",
           "fsroad": "#8A7C66"},
          bands, current="#2F7D4F")

    # ── track: settle which of the two drifted values is right ──────────────
    sweep("track — two-track (has its own narrower casing)",
          ["#9C7343",              # what the LAYER paints
           "#A9702F",              # what the LEGEND claims
           "#B0722B", "#B87C33", "#C08A3E"],
          {"fsroad": "#8A7C66", "minor": "#4A443B", "route72": "#2F7D4F"},
          bands, current="#9C7343")

    # ── trail50: measured strong already; confirm before touching it ────────
    sweep("trail50 / fstrail — moderate (measured dE 62-68; expect no change)",
          ["#2585D8", "#1478E0", "#0B7FE8"],
          {"route72": "#2F7D4F", "mccct": "#1C1A16"},
          bands, current="#2585D8")
