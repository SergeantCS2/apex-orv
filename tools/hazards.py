#!/usr/bin/env python3
"""take 194 · A189 · Road hazards, from OpenStreetMap.

The maintainer, 2026-11-05: "Build it in the next take" (designed at take
180, AGENDA A189). A layer, off by default, in every mode: plate-reader
cameras, height and weight limits, fords, rail crossings, toll booths,
cattle guards and OSM's own hazard=* points. Each pin says only what OSM
records. It plans nothing and routes around nothing.

One pass over the same Geofabrik extract the ingest and the corridor step
read (osm_local.extract_path; CI caches it in osm_cache). aoi.json is not
widened: its tag set is the ingest's cache key (landmine 196), and a change
there re-ingests the state on every build.

Source totals (the openstreetmap.fr extract of 2026-11-05, every element in
the state, PROVEN by a count pass in take 194; take 180's Geofabrik pass in
brackets): surveillance:type=ALPR 3,682 (3,675); railway=level_crossing
7,464 (7,451); highway ways with maxheight 1,963 (1,938), maxweight 250
(244); ford=yes 622 nodes + 76 ways (694); barrier=toll_booth 110 + 54
(166); barrier=cattle_grid 18 (18); hazard=* 20 + 31 (~60);
highway=speed_camera 0 (0: Michigan permits none, and the layer invents no
category the source is empty on). The step prints its own counts beside
them, inside the region's box.

Not kept (A189's ruled-outs): generic CCTV and gunshot detectors (not road
hazards), speed cameras (none recorded), anything not in OSM.
"""
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
# the review of take 194 · the region from region.R, as every other step:
# osm_local.region() reads only regions.json's default, so --region and
# $APEX_REGION would have built the default region's hazards into another
# region's bundle
from region import R  # noqa: E402

OUT = "hazards_payload.json"
# one letter a kind, so 15,000 pins stay small; the app names them
KINDS = {"a": "plate reader", "h": "height limit", "w": "weight limit", "f": "ford",
         "r": "rail crossing", "t": "toll booth", "c": "cattle guard", "z": "hazard"}
# a cell about 15 m across: one pin a kind per cell (a ford node on a ford
# way, a crossing mapped once per track, a booth once per lane); plate
# readers are never merged (each is a camera)
CELL = 0.00015


NOT_A_LIMIT = ("default", "none", "no_sign")
# a node that is a PLACE is not a road hazard: 26 of the extract's 30
# height-limit nodes are parking garages (amenity=parking), whose clearance
# is the garage's, not the road's (the review of take 194, PROVEN by a pass
# over the 2026-11-05 extract). Its 20 hazard=* nodes are 19 traffic signs
# and one bare point, and stay.
PLACE_KEYS = ("amenity", "building", "shop", "leisure", "tourism", "natural", "landuse")


def kinds_of(t, way):
    """Every kind a set of tags records, each with its recorded value. A road
    can carry several (a height AND a weight limit: 4 statewide, which a
    first-match rule dropped — take 194's reconciliation)."""
    out = []
    if not way:
        if t.get("man_made") == "surveillance" and t.get("surveillance:type") == "ALPR":
            out.append(("a", [t.get("manufacturer") or "", t.get("operator") or "",
                              t.get("direction") or t.get("camera:direction") or ""]))
        if t.get("railway") == "level_crossing":
            out.append(("r", ""))
        if t.get("barrier") == "cattle_grid":
            out.append(("c", ""))
    if t.get("barrier") == "toll_booth":
        out.append(("t", t.get("name") or ""))
    if way and "highway" not in t:
        return out
    if not way and any(k in t for k in PLACE_KEYS):
        return out
    if t.get("maxheight") and t.get("maxheight") not in NOT_A_LIMIT:
        out.append(("h", t.get("maxheight")))
    if way and t.get("maxweight") and t.get("maxweight") not in NOT_A_LIMIT:
        out.append(("w", t.get("maxweight")))
    if t.get("ford") == "yes":
        out.append(("f", t.get("name") or ""))
    if t.get("hazard"):
        out.append(("z", t.get("hazard")))
    return out


class Keeper:
    """What the pass keeps, and the counts that reconcile it with the
    source: found = kept + outside the box + the same spot again."""
    def __init__(self, box):
        self.box, self.out, self.seen = box, [], {}
        self.found, self.kept, self.outside, self.dup = ({k: 0 for k in KINDS} for _ in range(4))

    def keep(self, lon, lat, k, v):
        W, S, E, N = self.box
        self.found[k] += 1
        if not (W <= lon <= E and S <= lat <= N):
            self.outside[k] += 1
            return
        # a plate reader is a camera, and two on one pole facing two ways are
        # two cameras: never merged. A crossing mapped once per track, or a
        # booth once per lane, is one thing for a driver. Two DIFFERENT
        # limits on one spot are two limits (the review of take 194: keyed
        # on the spot alone, a 13'8" could hide the 13'2" beside it).
        if k == "a":
            cell = (k, len(self.out))
        else:
            cell = (k, round(lon / CELL), round(lat / CELL), json.dumps(v, sort_keys=True))
        if cell in self.seen:
            self.dup[k] += 1
            return
        self.seen[cell] = 1
        self.kept[k] += 1
        self.out.append([round(lon, 5), round(lat, 5), k, v])


def osm_date(pbf):
    """The extract's own replication date, else its file date: the age of
    every hazard pin, said on its card like every other source line."""
    try:
        import osmium
        h = osmium.io.Reader(pbf, osmium.osm.osm_entity_bits.NOTHING).header()
        ts = h.get("osmosis_replication_timestamp")
        if ts:
            return ts[:10]
    except Exception:
        pass
    return time.strftime("%Y-%m-%d", time.gmtime(os.path.getmtime(pbf)))


def main():
    try:
        import osmium
    except ImportError:
        # optional, like corridor and landcover: a build without the reader
        # carries no hazards artifact and the Layers row says so
        if os.path.exists(OUT):
            os.remove(OUT)
        print("hazards: osmium unavailable — skipping (no hazards in this bundle)")
        return
    from osm_local import extract_path
    rid = R.id
    W, S, E, N = R.bbox
    pbf = extract_path(R.state or "Michigan")
    t0 = time.time()
    K = Keeper((W, S, E, N))
    keep = K.keep

    class H(osmium.SimpleHandler):
        def node(self, n):
            if not n.tags:
                return
            for k, v in kinds_of(n.tags, False):
                keep(n.location.lon, n.location.lat, k, v)

        def way(self, w):
            t = w.tags
            if "highway" not in t and "barrier" not in t:
                return
            kv = kinds_of(t, True)
            if not kv:
                return
            try:
                nd = w.nodes[len(w.nodes) // 2]   # a point ON the road, mid-way
                lon, lat = nd.location.lon, nd.location.lat
            except Exception:
                return                            # a way cut at the extract's edge
            for k, v in kv:
                keep(lon, lat, k, v)

    idx = os.path.join("/tmp", f"apex_haz_{rid}.idx")
    if os.path.exists(idx):
        os.remove(idx)
    print(f"hazards: reading {os.path.basename(pbf)} (node locations on disk)")
    H().apply_file(pbf, locations=True, idx=f"sparse_file_array,{idx}")
    try:
        os.remove(idx)
    except OSError:
        pass
    date = osm_date(pbf)
    out = K.out
    print(f"hazards: {len(out):,} pins in the region's box, OSM of {date}, {time.time() - t0:.0f} s")
    for k in KINDS:
        print(f"  {KINDS[k]:<14} {K.found[k]:>6,} in the extract = {K.kept[k]:>6,} kept"
              f" + {K.outside[k]:,} outside the box + {K.dup[k]:,} the same spot again")
    if not out:
        # nothing in the box is an honest empty layer, never a padded one; the
        # bundle simply carries no hazards artifact (it is optional)
        if os.path.exists(OUT):
            os.remove(OUT)
        print("hazards: none in the box — payload omitted")
        return
    out.sort(key=lambda r: (r[2], r[1], r[0]))
    json.dump({"v": 1, "osm": date, "k": KINDS, "h": out}, open(OUT, "w"), separators=(",", ":"))
    print(f"hazards: {os.path.getsize(OUT) // 1024} KB")


if __name__ == "__main__":
    main()
