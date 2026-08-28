#!/usr/bin/env python3
"""Photos for MAJOR pins (take 131). Jacob: "when I click a pin, show any
available picture — like Google Maps. Only for major pins; random trails
won't have these."

Source: Wikipedia geosearch around the pin, the article matched on NAME (not
just proximity), the article's lead image as a 320 px thumbnail, with the
Commons author and licence so the card can attribute it. Measured first: OSM
carries a photo link on ~2 % of destinations, so this is the only free,
offline-shippable source with real coverage. Google's photos are ruled out —
their licence forbids caching, which is what "offline" means.

Scope: camps, trail systems (hiking + MTB), riding areas, NAMED beaches.
Absence is honest: no match, no photo, no placeholder.

Cached under img_cache/photos/ — a directory CI's region cache already
carries — so a rebuild refetches nothing. Two hosts, declared in manifest.py:
en.wikipedia.org (search, page image) and upload.wikimedia.org (the file).
"""
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from region import R

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CACHE = os.path.join(ROOT, "img_cache", "photos")
OUTDIR = os.path.join(ROOT, "photos")
INDEX = os.path.join(ROOT, "photos_index.json")
API = "https://en.wikipedia.org/w/api.php"
# Wikimedia's policy wants a contact in the UA; without one the first run
# was throttled to 429 at 6 workers (take 131). Contact + 3 workers + a
# pause per call keeps us under their bar. The cache makes it a one-time cost.
# contact goes in the UA per Wikimedia policy — as a name, not a URL, because
# the gate reads any URL in a tool as a provisioning host (PROTOCOL §8)
UA = {"User-Agent": "APEX-Offroad/1.0 (SergeantCS2 on GitHub, repo apex; offline Michigan "
                    "trail map, personal non-commercial) python-urllib"}
# thumbnails arrive from here, via URLs the API hands back; named so the
# PROVISION ledger and this tool agree on the hosts it reaches
THUMB_HOST = "https://upload.wikimedia.org"   # manifest.scan_hosts reads URLs
PAUSE = 0.35
# Take 135: a fresh CI runner has an empty cache, and ~2,940 lookups at ~59
# per minute is ~50 minutes of SILENCE — Jacob watched two builds sit after
# "address:" with no output and one of them time out. Two rules now:
# (1) progress is printed every 100 lookups, so a long step is never mute
# (landmine 32's spirit: a silent step is indistinguishable from a hung one);
# (2) a TIME BUDGET: after BUDGET_S the step ships what it has and says how
# many remain. The cache (img_cache/photos/, carried by CI's region cache)
# accumulates across builds, so the next build resumes where this one
# stopped. Photos land progressively; the build never waits on them.
BUDGET_S = int(os.environ.get("APEX_PHOTO_BUDGET_S", "1500"))
KINDS = {"camp", "system", "mtb", "beach", "lighthouse", "marina", "launch",
         "ski"}   # take 142: ski hills join the photo pass (Mt Holly, Pine Knob have articles)
# how far a Commons photo may sit from the pin and still be "of" it
NEAR = {"area": 700, "camp": 500, "beach": 400, "launch": 250, "marina": 300,
        "lighthouse": 350, "system": 600, "mtb": 600, "ski": 700}
COMMONS = "https://commons.wikimedia.org/w/api.php"
STOP = {"state", "park", "campground", "camp", "trail", "trails", "pathway", "area",
        "orv", "recreation", "rec", "forest", "national", "the", "of", "and", "county",
        "township", "beach", "lake", "river", "unit", "site", "system", "loop"}


def _get(url, timeout=40):
    req = urllib.request.Request(url, headers=UA)
    for attempt in range(3):
        try:
            time.sleep(PAUSE)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(20 * (attempt + 1))   # back off hard; they asked
            else:
                time.sleep(1.5 * (attempt + 1))
        except Exception:
            time.sleep(1.5 * (attempt + 1))
    return None


def _api(params, base=API):
    params = dict(params, format="json", formatversion=2)
    b = _get(base + "?" + urllib.parse.urlencode(params))
    return json.loads(b) if b else None


def _save(k, n, p, img, by, lic, title, desc=""):
    f = hashlib.sha1(key(k, n, p).encode()).hexdigest()[:12] + ".jpg"
    os.makedirs(OUTDIR, exist_ok=True)
    try:
        # 320 px, quality 68: ~16 KB each, so 600 photos ride in a 10 MB seed
        import io
        from PIL import Image
        im = Image.open(io.BytesIO(img)).convert("RGB")
        if im.width > 320:
            im = im.resize((320, int(320 * im.height / im.width)), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=68, optimize=True, progressive=True)
        img = buf.getvalue()
    except Exception:
        pass
    open(os.path.join(OUTDIR, f), "wb").write(img)
    r = {"f": f, "by": by[:80], "lic": lic[:40], "t": title}
    if desc:
        r["d"] = desc[:220]
    return r


def commons_near(k, n, p):
    """Second source (take 131): a geotagged Commons photo within NEAR[k]
    metres of the pin. Prefers a file whose name shares a token with the
    pin's name; otherwise the nearest. Beaches, launches and campgrounds
    rarely have an ARTICLE; many have a photo. Returns None if the search
    itself failed, so nothing is cached."""
    r = _api({"action": "query", "generator": "geosearch",
              "ggscoord": f"{p[1]}|{p[0]}", "ggsradius": NEAR.get(k, 400),
              "ggsnamespace": 6, "ggslimit": 12, "prop": "imageinfo",
              "iiprop": "url|extmetadata", "iiurlwidth": 320,
              "iiextmetadatafilter": "Artist|LicenseShortName"}, base=COMMONS)
    if r is None:
        return None
    pages = ((r.get("query") or {}).get("pages") or [])
    want = toks(n)
    best, bs = None, -1
    for pg in pages:
        t = pg.get("title", "")
        if not re.search(r"\.(jpe?g|png)$", t, re.I):
            continue
        ii = (pg.get("imageinfo") or [{}])[0]
        if not ii.get("thumburl"):
            continue
        sc = len(want & toks(t)) * 10 - min(pg.get("index", 9), 9)
        if sc > bs:
            best, bs = (pg, ii), sc
    if not best:
        return {}
    pg, ii = best
    img = _get(ii["thumburl"], timeout=60) if ii["thumburl"].startswith(THUMB_HOST) else None
    if not img or len(img) < 2000:
        return {}
    meta = ii.get("extmetadata") or {}
    by = re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", "")).strip()
    lic = meta.get("LicenseShortName", {}).get("value", "").strip()
    return _save(k, n, p, img, by, lic, pg["title"])


def toks(s):
    return {t for t in re.findall(r"[a-z0-9]+", (s or "").lower()) if t not in STOP}


def key(k, n, p):
    return f"{k}|{n}|{p[0]:.4f}|{p[1]:.4f}"


def lookup(k, n, p):
    """One pin -> {"f": file, "by": author, "lic": licence, "t": title} or None."""
    ck = os.path.join(CACHE, hashlib.sha1(key(k, n, p).encode()).hexdigest()[:16] + ".json")
    if os.path.exists(ck):
        try:
            c = json.load(open(ck))
            if c is None or os.path.exists(os.path.join(OUTDIR, c["f"])):
                return c
            # a hit whose file is missing: fall through and fetch it again
        except Exception:
            pass
    res = None
    want = toks(n)
    if want:
        gs = _api({"action": "query", "list": "geosearch",
                   "gscoord": f"{p[1]}|{p[0]}", "gsradius": 3000, "gslimit": 8})
        if gs is None:
            # the SEARCH failed (rate limit, timeout). That is not "no photo",
            # and caching it as one froze Silver Lake State Park out of the
            # first run. Return without caching; the next run asks again.
            return None
        best, score = None, 0.0
        for hit in ((gs or {}).get("query") or {}).get("geosearch", []):
            # a town / CDP article ("Luna Pier, Michigan", "Canada Creek
            # Ranch, Michigan") matches a beach or camp named after the town,
            # and its lead image is a street. Not the pin.
            if re.search(r", Michigan$", hit["title"]):
                continue
            have = toks(hit["title"])
            if not have:
                continue
            common = len(want & have)
            sc = common / len(want)
            if common >= 1 and sc >= 0.6 and sc > score:
                best, score = hit, sc
        if best:
            pi = _api({"action": "query", "pageids": best["pageid"], "prop": "pageimages|imageinfo",
                       "piprop": "thumbnail|name", "pithumbsize": 320})
            page = (((pi or {}).get("query") or {}).get("pages") or [{}])[0]
            th = page.get("thumbnail")
            fname = page.get("pageimage")
            if th and fname:
                ii = _api({"action": "query", "titles": "File:" + fname, "prop": "imageinfo",
                           "iiprop": "extmetadata", "iiextmetadatafilter": "Artist|LicenseShortName"})
                meta = ((((ii or {}).get("query") or {}).get("pages") or [{}])[0]
                        .get("imageinfo") or [{}])[0].get("extmetadata") or {}
                by = re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", "")).strip()
                lic = meta.get("LicenseShortName", {}).get("value", "").strip()
                img = _get(th["source"], timeout=60) if th["source"].startswith(THUMB_HOST) else None
                if img and len(img) > 2000:
                    # the article's first sentence, for the card (Jacob's
                    # Google Maps reference: photo, one line, address)
                    ex = _api({"action": "query", "pageids": best["pageid"], "prop": "extracts",
                               "exintro": 1, "explaintext": 1, "exsentences": 1})
                    desc = ((((ex or {}).get("query") or {}).get("pages") or [{}])[0]
                            .get("extract") or "").strip()
                    res = _save(k, n, p, img, by, lic, best["title"], desc)
    if res is None:
        # no article — try a photo taken AT the place
        c = commons_near(k, n, p)
        if c is None:
            return None          # search failed: do not cache
        res = c or None
    os.makedirs(CACHE, exist_ok=True)
    json.dump(res, open(ck, "w"))
    return res


def main():
    # Take 136: CI never fetches. GitHub Actions runners are cloud IPs that
    # Wikimedia rate-limits hard; with the 429 back-off each lookup could take
    # a minute, so two builds sat on "address:" and timed out at 90 minutes
    # (build #53, #55). The photos are FETCHED HERE, shipped in the seed
    # (photos/ + photos_index.json, ~10 MB), and CI uses them as-is — the
    # pipeline-verified-locally-fails-in-CI pattern the ledgers already name.
    # ci/bundle.sh sets APEX_PHOTO_BUDGET_S=0.
    if BUDGET_S <= 0:
        if os.path.exists(INDEX) and os.path.isdir(OUTDIR):
            idx = json.load(open(INDEX))
            have = sum(1 for v in idx.values() if os.path.exists(os.path.join(OUTDIR, v["f"])))
            print(f"photos: budget 0 — using the {have} shipped photo(s) ({len(idx)} indexed); "
                  "no network on this runner")
        else:
            print("photos: budget 0 and nothing shipped — artifact absent")
        return
    cands = []
    pp = os.path.join(ROOT, "poi_payload.json")
    if os.path.exists(pp):
        for r in json.load(open(pp)).get("p", []):
            if r["k"] in KINDS and r.get("n"):
                cands.append((r["k"], r["n"], r["p"]))
    ap = os.path.join(ROOT, "areas_payload.json")
    if os.path.exists(ap):
        for a in json.load(open(ap)).get("a", []):
            cands.append(("area", a["n"], a["c"]))
    if not cands:
        print("photos: no candidates — artifact absent")
        for f in (INDEX,):
            if os.path.exists(f):
                os.remove(f)
        return
    # Do NOT clear the output folder first: cached hits return without
    # re-downloading their file, and the first requery run wiped 56 photos
    # that way. Orphans (files no longer in the index) are removed at the end.
    os.makedirs(OUTDIR, exist_ok=True)
    index, hits = {}, 0
    t0, done, deferred = time.time(), 0, 0
    # cached candidates first (instant), then the rest until the budget runs out
    def cached(c):
        ck = os.path.join(CACHE, hashlib.sha1(key(*c).encode()).hexdigest()[:16] + ".json")
        return os.path.exists(ck)
    order = sorted(cands, key=lambda c: (not cached(c)))
    def guarded(c):
        nonlocal done, deferred
        if time.time() - t0 > BUDGET_S and not cached(c):
            deferred += 1
            return None
        r = lookup(*c)
        done += 1
        if done % 100 == 0:
            print(f"  photos: {done:,} of {len(cands):,} looked up, {hits_box[0]} with a photo, "
                  f"{int(time.time() - t0)} s", flush=True)
        return r
    hits_box = [0]
    with ThreadPoolExecutor(max_workers=3) as ex:
        for (k, n, p), res in zip(order, ex.map(guarded, order)):
            if res:
                index[key(k, n, p)] = res
                hits += 1
                hits_box[0] = hits
    if deferred:
        print(f"photos: time budget of {BUDGET_S} s reached — {deferred:,} pin(s) not yet "
              "looked up; the cache carries this build's work and the next build "
              "continues from here", flush=True)
    # honesty check: every indexed file is on disk
    index = {kk: v for kk, v in index.items() if os.path.exists(os.path.join(OUTDIR, v["f"]))}
    keep = {v["f"] for v in index.values()}
    for fn in os.listdir(OUTDIR):
        if fn not in keep:
            os.remove(os.path.join(OUTDIR, fn))
    json.dump(index, open(INDEX, "w"), separators=(",", ":"))
    by_kind = {}
    for kk in index:
        by_kind[kk.split("|")[0]] = by_kind.get(kk.split("|")[0], 0) + 1
    size = sum(os.path.getsize(os.path.join(OUTDIR, v["f"])) for v in index.values())
    print(f"photos: {len(index)} of {len(cands)} major pins matched to a Wikipedia lead "
          f"image ({size // 1024} KB) — " + ", ".join(f"{k} {v}" for k, v in sorted(by_kind.items())))


if __name__ == "__main__":
    main()
