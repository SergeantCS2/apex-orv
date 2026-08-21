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
    ("water_payload.json",   "water.json",    "hydro",    False),
    ("hillshade.jpg",        "hillshade.jpg", "relief",   False),
    ("imagery.jpg",          "imagery.jpg",   "imagery",  False),
    ("context_payload.json", "context.json",  "context",  False),
    ("address_payload.json", "address.json",  "address",  False),
    ("other_payload.json",   "other.json",    "other",    False),
]

def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def build(rid):
    reg = Region(rid)
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
        dp = os.path.join(dest, name)
        shutil.copyfile(sp, dp)
        n = os.path.getsize(dp)
        total += n
        entries.append({"path": name, "kind": kind, "required": required,
                        "bytes": n, "sha256": sha256(dp)})

    man = {"schema": SCHEMA, "region": rid, "name": reg.name,
           "bbox": reg.bbox, "note": reg.note, "centre": reg.centre,
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
            "bytes": nbytes,
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
