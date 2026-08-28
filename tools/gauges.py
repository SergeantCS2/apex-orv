#!/usr/bin/env python3
"""take 150 · A164 (first external tester): USGS live gauges.

The BUNDLE ships only the site inventory — id, name, position — because a
water level from build time is worse than none (ruled out in AGENDA). The
APP fetches live values on a user tap under PROTOCOL §8's in-app
provisioning rules. Inventory source: the NWIS site service, surface-water
sites with instantaneous values, statewide.
"""
import json, os, sys, urllib.request

sys.path.insert(0, os.path.dirname(__file__))
from osm_local import region

RID, R = region()
W, S, E, N = R["bbox"]
# NWIS wants the two-letter postal code; the region record carries the
# prose name. Explicit map, not string surgery — a wrong guess here is a
# silent empty inventory.
STATE = {"michigan": "MI"}.get(RID, R.get("postal", "MI"))

URL = ("https://waterservices.usgs.gov/nwis/site/?format=rdb"
       f"&stateCd={STATE}&siteType=ST&siteStatus=active&hasDataTypeCd=iv")


def main():
    print(f"gauges: NWIS site inventory for {STATE} (surface water, live data)")
    raw = urllib.request.urlopen(URL, timeout=60).read().decode("utf-8", "replace")
    rows = [l for l in raw.splitlines() if l and not l.startswith("#")]
    if len(rows) < 3:
        print("gauges: inventory empty — payload omitted, the card simply "
              "offers no conditions button")
        if os.path.exists("gauges_payload.json"):
            os.remove("gauges_payload.json")
        return
    head = rows[0].split("\t")
    ix = {k: head.index(k) for k in
          ("site_no", "station_nm", "dec_lat_va", "dec_long_va")}
    out, skipped = [], 0
    for l in rows[2:]:                      # row 1 is the RDB format line
        c = l.split("\t")
        try:
            lat, lon = float(c[ix["dec_lat_va"]]), float(c[ix["dec_long_va"]])
        except (ValueError, IndexError):
            skipped += 1
            continue
        if not (W <= lon <= E and S <= lat <= N):
            skipped += 1
            continue
        out.append({"id": c[ix["site_no"]],
                    "n": c[ix["station_nm"]].title(),
                    "p": [round(lon, 5), round(lat, 5)]})
    json.dump({"g": out}, open("gauges_payload.json", "w"))
    kb = os.path.getsize("gauges_payload.json") // 1024
    print(f"gauges: {len(out)} sites in the box ({skipped} outside or "
          f"unparsable), {kb} KB")


if __name__ == "__main__":
    main()
