#!/usr/bin/env python3
"""take 150 · A164 (first external tester): USGS live gauges.

The BUNDLE ships only the site inventory — id, name, position — because a
water level from build time is worse than none (ruled out in AGENDA). The
APP fetches live values on a user tap under PROTOCOL §8's in-app
provisioning rules. Inventory source: the NWIS site service, surface-water
sites with instantaneous values, statewide.
"""
import json, os, sys, time, urllib.error, urllib.request

sys.path.insert(0, os.path.dirname(__file__))
# take 194 · the region from region.R, as every other step: osm_local's
# region() reads only regions.json's default, so --region and $APEX_REGION
# built the default region's inventory (found by take 194's review of
# hazards.py, which had copied this line)
from region import R as REG

RID = REG.id
W, S, E, N = REG.bbox
# NWIS wants the two-letter postal code; the region record carries the
# prose name. Explicit map, not string surgery — a wrong guess here is a
# silent empty inventory.
STATE = {"michigan": "MI"}.get(RID, getattr(REG, "postal", None) or "MI")

URL = ("https://waterservices.usgs.gov/nwis/site/?format=rdb"
       f"&stateCd={STATE}&siteType=ST&siteStatus=active&hasDataTypeCd=iv")


# take 192 · A245 (the maintainer, 2026-11-02: "The omission is fine"): an
# omitted inventory is RECORDED, not only printed. The reason goes in
# OMITTED; tools/bundle.py carries it into the manifest's "omitted", and
# render accepts a bundle without gauges.json only with that record (a
# layer lost without a word still fails). Any run that leaves a payload
# removes the record.
OMITTED = "gauges_omitted.json"


def omitted(why):
    # the region it was written for: bundle.py ignores a record of another
    # region's build (the region stamp's rule, landmine 199)
    json.dump({"why": why, "region": RID,
               "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())},
              open(OMITTED, "w"))
    print(f"gauges: payload omitted — {why}; recorded in {OMITTED}, the card "
          "simply offers no conditions button")


def kept():
    if os.path.exists(OMITTED):
        os.remove(OMITTED)


def main():
    print(f"gauges: NWIS site inventory for {STATE} (surface water, live data)")
    # take 179 (A191): one refusal from a public service must not stop a
    # build. Retry once after a pause; then keep the previous build's
    # payload if there is one (CI restores it with the region cache); only
    # with nothing cached does the payload go missing.
    raw = None
    for attempt in (1, 2):
        try:
            raw = urllib.request.urlopen(URL, timeout=60).read().decode("utf-8", "replace")
            break
        except (urllib.error.URLError, urllib.error.HTTPError, OSError, TimeoutError) as e:
            print(f"gauges: NWIS refused ({e}) on attempt {attempt}")
            if attempt == 1:
                time.sleep(20)
    if raw is None:
        if os.path.exists("gauges_payload.json"):
            try:
                n = len(json.load(open("gauges_payload.json")).get("g", []))
            except (ValueError, OSError):
                n = "?"
            print(f"gauges: NWIS refused twice — keeping {n} sites from the "
                  "previous build (gauges_payload.json unchanged)")
            kept()
            return
        omitted("NWIS refused twice and nothing is cached")
        return
    rows = [l for l in raw.splitlines() if l and not l.startswith("#")]
    if len(rows) < 3:
        if os.path.exists("gauges_payload.json"):
            os.remove("gauges_payload.json")
        omitted("NWIS answered with an empty inventory")
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
    if not out:
        # an inventory with nothing inside the box is an omission too, said
        # and recorded (the review of take 192: an empty payload was staged
        # and render failed it as a lost layer)
        if os.path.exists("gauges_payload.json"):
            os.remove("gauges_payload.json")
        omitted(f"no NWIS surface-water site inside the region's box ({skipped} outside or unparsable)")
        return
    json.dump({"g": out}, open("gauges_payload.json", "w"))
    kept()
    kb = os.path.getsize("gauges_payload.json") // 1024
    print(f"gauges: {len(out)} sites in the box ({skipped} outside or "
          f"unparsable), {kb} KB")


if __name__ == "__main__":
    main()
