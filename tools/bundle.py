"""Region bundles — the mechanism PROTOCOL §8's invariant needs.

§8 says: after provisioning completes and verifies, the app must be *provably*
complete. "Provably" needs a manifest with hashes, not a spinner that finished.

The safety-relevant question is not the happy path, it is the half-downloaded
one. A region that is missing its imagery is still perfectly navigable. A region
that is missing its graph is not, and must never present itself as usable — a map
with holes in it is worse than no map, because you trust it.

So every artifact declares whether it is REQUIRED. Three states fall out:

  complete   every artifact present and hashing correct
  partial    every REQUIRED artifact good, some optional missing -> usable,
             and the app must say which layers are absent
  unusable   a required artifact missing or corrupt -> refuse the region

Usage:
  python3 tools/bundle.py build  <region-id>
  python3 tools/bundle.py verify <region-id>
"""
import hashlib, json, os, shutil, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from region import Region, ALL

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "bundles")
SCHEMA = 1

# source -> (name in bundle, kind, required)
ARTIFACTS = [
    ("graph_payload.json",   "graph.json",    "network",  True),
    ("terrain_payload.json", "terrain.json",  "terrain",  True),
    ("glyphs_payload.json",  "glyphs.json",   "labels",   True),
    ("landcover_payload.json","landcover.json","ground",   False),
    ("water_payload.json",   "water.json",    "hydro",    False),
    ("hillshade.jpg",        "hillshade.jpg", "relief",   False),
    ("imagery.jpg",          "imagery.jpg",   "imagery",  False),
    ("context_payload.json", "context.json",  "context",  False),
    ("address_payload.json", "address.json",  "address",  False),
    ("other_payload.json",   "other.json",    "other",    False),
    ("poi_payload.json",     "poi.json",         "places",   False),
    ("contour_payload.json", "contour.json",     "contour",  False),
    ("corridor_payload.json","corridor.json",    "paddle",   False),
    ("areas_payload.json",   "areas.json",       "areas",    False),
    ("photos_index.json",    "photos.json",      "photos",   False),
    ("publicland_payload.json","publicland.json",  "publicland",False),
    ("gauges_payload.json",  "gauges.json",      "gauges",   False),
]

# How many things are actually IN a payload. A layer with no features in it is
# not a layer, and existence is not content (landmine 74).
#
# Take 76: pack.py wrote a structurally valid EMPTY water payload — 65 bytes,
# both buckets [] — because take 56's TIGER fallback creates an aoi.json that
# satisfied its "was OSM missing" guard. verify() checked existence, size and
# SHA-256; all three pass on an empty file. The bundle reported COMPLETE with no
# water in it and the app never named the gap, which is exactly what the
# three-state model exists to prevent (landmine 34).
#
# Every key below was read off a REAL built payload, not from memory — a counter
# aimed at the wrong key reports 0 on a good artifact and degrades a healthy
# bundle, which is landmine 54 wearing a new hat.
COUNTERS = {
    "ground":  lambda d: len(d.get("f") or []),
    "hydro":   lambda d: sum(len(v) for v in (d.get("l") or {}).values()),
    # take 119: statewide ships summits with NO lines — a payload of 300
    # named hills is not empty. Lines + peaks, or the guard refuses real data.
    "contour": lambda d: len(d.get("l") or []) + len(d.get("pk") or []),
    "paddle":  lambda d: len(d.get("c") or []),
    "areas":   lambda d: len(d.get("a") or []),
    "photos":  lambda d: len(d or {}),
    "publicland": lambda d: len(d.get("a") or []),
    "other":   lambda d: len(d.get("r") or []),
    "places":  lambda d: len(d.get("p") or []),
    "context": lambda d: len(d.get("counties") or []) + len(d.get("rings") or []),
    # take 139: v2 ships delta-encoded — the count is `n`, the segments are
    # rebuilt in the app
    "address": lambda d: (d.get("n") if d.get("v") == 2 else len(d.get("segs") or [])),
}


def features(kind, path):
    """Count what is in a payload. None means 'not countable — do not judge'."""
    fn = COUNTERS.get(kind)
    if not fn or not path.endswith(".json"):
        return None
    try:
        return fn(json.load(open(path)))
    except Exception:
        return None


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def build(rid):
    reg = Region(rid)
    # Take 118 (landmine 199): refuse payloads that belong to another region.
    # CI's cache once restored the box's payloads under a michigan build and
    # shipped the wrong state at full green. The stamp is written by ingest;
    # absent or foreign means the data on disk is not this region's — say so,
    # name the remedy, stop.
    sp = os.path.join(ROOT, "region_stamp.json")
    stamped = None
    try:
        stamped = json.load(open(sp)).get("region")
    except Exception:
        pass
    if stamped != rid:
        sys.exit(
            f"bundle: payloads on disk are stamped for "
            f"{stamped or 'NO REGION (pre-stamp or restored cache)'} but this "
            f"build targets {rid}.\n"
            f"  This is a stale cache or a mixed workspace — the exact failure "
            f"that shipped the box wearing take 117.\n"
            f"  Remedy: clear cached *_payload.json / aoi.json / "
            f"authoritative.json (in CI: bump the cache key) and rerun the "
            f"pipeline from ingest.")
    dest = os.path.join(OUT, rid)
    os.makedirs(dest, exist_ok=True)

    entries, missing, total = [], [], 0
    for src, name, kind, required in ARTIFACTS:
        # ROOT scratch only. A parent-directory fallback reached stale
        # artifacts from another region's run and contaminated a bundle for the
        # second time (take 15) — the geometry check caught it, but the hole
        # should not exist at all.
        sp = os.path.join(ROOT, src)
        if not os.path.exists(sp):
            missing.append((name, required))
            continue
        # Second guard, one layer up from pack.py. A safety-relevant path
        # deserves two (landmine 74) — and this one catches EVERY producer,
        # not just the one that bit us.
        n_feat = features(kind, sp)
        if n_feat == 0:
            print(f"  {'REQ' if required else 'opt'}  {name:<16} "
                  f"{'EMPTY — not staged':>20}")
            missing.append((name, required))
            continue
        dp = os.path.join(dest, name)
        shutil.copyfile(sp, dp)
        n = os.path.getsize(dp)
        total += n
        entries.append({"path": name, "kind": kind, "required": required,
                        "bytes": n, "sha256": sha256(dp)})

    # Stale artifacts are a hazard, not an archive (landmine 54's corollary).
    # A previous run's water.json survived in the destination when this run had
    # none to stage, so build_app copied it into www/ and BOTH verify() and the
    # app's own loader saw a layer the pipeline had just refused to produce.
    # The correct app-side check was defeated by a leftover file (landmines 32, 36).
    staged = {e["path"] for e in entries}
    for _s, name, _k, _r in ARTIFACTS:
        p = os.path.join(dest, name)
        if name not in staged and os.path.exists(p):
            os.remove(p)
            print(f"  ---  {name:<16} {'stale — removed':>20}")

    man = {"schema": SCHEMA, "region": rid, "name": reg.name,
           "bbox": reg.bbox, "note": reg.note, "centre": reg.centre, "bulk": bool(getattr(reg, "bulk", False)),
           "anchors": reg.anchors,
           "built": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
           "bytes": total, "artifacts": entries}
    # a hash over the artifact hashes, so a manifest cannot be edited to match
    # imagery is useless without its georeference; carry it in the manifest so
    # a bundle is self-contained (take 15 — the meta only ever lived in scratch)
    mp = os.path.join(ROOT, "imagery_meta.json")
    if any(e["kind"] == "imagery" for e in entries) and os.path.exists(mp):
        meta = json.load(open(mp))
        man["imagery_bounds"] = meta["b"]
        man["imagery_zoom"] = meta.get("z")
    # Imagery tiles are a directory, not a file. Copy the tree, hash the
    # sorted (path, size) listing — cheap, and still detects a truncated or
    # partial copy, which is what matters here (take 42).
    # take 131: photos for major pins ride beside the index, like tiles
    psrc = os.path.join(ROOT, "photos")
    if os.path.isdir(psrc) and os.path.exists(os.path.join(ROOT, "photos_index.json")):
        pdst = os.path.join(dest, "photos")
        if os.path.isdir(pdst):
            shutil.rmtree(pdst)
        shutil.copytree(psrc, pdst)
        pn = sum(len(f) for _, _, f in os.walk(pdst))
        pb = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(pdst) for f in fs)
        man["photos"] = {"count": pn, "bytes": pb}
        print(f"  opt  photos/            {pb/1048576:6.1f} MB  {pn} photos")
    tsrc = os.path.join(ROOT, "imagery_tiles")
    if os.path.isdir(tsrc):
        tdst = os.path.join(dest, "imagery")
        if os.path.isdir(tdst):
            shutil.rmtree(tdst)
        shutil.copytree(tsrc, tdst)
        listing, nbytes, count = [], 0, 0
        for dp, _, fns in os.walk(tdst):
            for fn in sorted(fns):
                fp = os.path.join(dp, fn)
                sz = os.path.getsize(fp)
                listing.append(os.path.relpath(fp, tdst) + ":" + str(sz))
                nbytes += sz
                count += 1
        meta = json.load(open(os.path.join(ROOT, "imagery_tiles.json")))
        man["imagery_tiles"] = {
            "zmin": meta["zmin"], "zmax": meta["zmax"], "count": count,
            # take 143: the top of the statewide base pyramid — the app's
            # satbase maxzoom. An explicit key list dropped this the first
            # time; the render check caught it saying "to z11".
            "base": meta.get("base"),
            "bytes": nbytes,
            # take 127: sparse patches ride ON TOP of the mosaic; the app must
            # know, and it must know where the tiles are so nothing else is
            # ever requested
            "sparse": bool(meta.get("sparse")), "boxes": meta.get("boxes", []),
            "sha256": hashlib.sha256("\n".join(sorted(listing)).encode()).hexdigest()}
        print(f"  opt  imagery/           {nbytes/1048576:6.1f} MB  {count} tiles "
              f"z{meta['zmin']}-z{meta['zmax']}")

    man["bundle_sha256"] = hashlib.sha256(
        "".join(sorted(e["sha256"] for e in entries)).encode()).hexdigest()
    with open(os.path.join(dest, "manifest.json"), "w") as f:
        json.dump(man, f, indent=1)

    print(f"{rid} — {reg.name}")
    for e in entries:
        flag = "req" if e["required"] else "opt"
        print(f"  {flag}  {e['path']:<16} {e['bytes']/1024:9.1f} KB  {e['sha256'][:12]}")
    for name, required in missing:
        print(f"  {'REQ' if required else 'opt'}  {name:<16} {'MISSING':>12}")
    print(f"  total {total/1024/1024:.2f} MB   bundle {man['bundle_sha256'][:16]}")
    return man


def verify(rid, root=None):
    dest = root or os.path.join(OUT, rid)
    mp = os.path.join(dest, "manifest.json")
    if not os.path.exists(mp):
        return "unusable", ["no manifest"], []
    man = json.load(open(mp))
    if man.get("schema") != SCHEMA:
        return "unusable", [f"schema {man.get('schema')} != {SCHEMA}"], []

    bad, absent = [], []

    # An artifact that was never STAGED is not in man["artifacts"] at all, so a
    # loop over that list can never notice it is gone — which is how a bundle
    # with no water reported COMPLETE, and how a bundle with no GRAPH would have
    # too. Check the manifest against what a bundle is supposed to contain
    # (take 76). Presence is not the same question as "is the X we mean"
    # (landmine 35).
    present = {e["path"] for e in man.get("artifacts", [])}
    for _s, name, _k, required in ARTIFACTS:
        if name not in present:
            (bad if required else absent).append(name)

    for e in man["artifacts"]:
        p = os.path.join(dest, e["path"])
        if not os.path.exists(p):
            (bad if e["required"] else absent).append(e["path"])
            continue
        if os.path.getsize(p) != e["bytes"]:
            bad.append(f"{e['path']} wrong size")
            continue
        if sha256(p) != e["sha256"]:
            bad.append(f"{e['path']} hash mismatch")

    # Hashes prove the files are intact. They do not prove the files are for
    # THIS region. Take 14 shipped a St. Helen bundle containing Bull Gap's
    # graph — every hash correct, every size correct, wrong place entirely.
    # Geometry has to be checked against the declared bbox.
    if any(a["kind"] == "imagery" for a in man["artifacts"]) \
            and "imagery_bounds" not in man:
        bad.append("imagery.jpg present but manifest has no imagery_bounds — "
                   "the image cannot be placed on the map")

    gp = os.path.join(dest, "graph.json")
    if os.path.exists(gp):
        try:
            g = json.load(open(gp))
            W, S, E, N = man["bbox"]
            x = y = 0
            n = g["n"]
            xs, ys = [], []
            for i in range(0, len(n), 2):
                x += n[i]; y += n[i + 1]
                xs.append(x / 1e5); ys.append(y / 1e5)
            if xs:
                pad = 0.05
                out = sum(1 for i in range(len(xs))
                          if not (W - pad <= xs[i] <= E + pad
                                  and S - pad <= ys[i] <= N + pad))
                if out > len(xs) * 0.02:
                    bad.append(
                        f"graph.json is not this region: {out}/{len(xs)} nodes "
                        f"outside bbox {man['bbox']} "
                        f"(data spans {min(xs):.2f},{min(ys):.2f} to "
                        f"{max(xs):.2f},{max(ys):.2f})")
        except Exception as e:
            bad.append(f"graph.json unreadable: {e}")

    if bad:
        return "unusable", bad, absent
    return ("complete" if not absent else "partial"), [], absent


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "build"
    rid = ([a for a in sys.argv[2:] if not a.startswith("-")] or [None])[0]
    if rid is None:
        from region import R as _r
        rid = _r.id
    if cmd == "build":
        build(rid)
        state, bad, absent = verify(rid)
        print(f"\nverify -> {state.upper()}")
    elif cmd == "verify":
        state, bad, absent = verify(rid)
        print(f"{rid}: {state.upper()}")
        for b in bad:
            print(f"  BAD     {b}")
        for a in absent:
            print(f"  absent  {a} (optional — the app must name the missing layer)")
        sys.exit(0 if state != "unusable" else 1)
    else:
        sys.exit(__doc__)
