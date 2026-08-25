"""Assemble the shippable app from `src/app.html`.

Take 12 found that `www/` still held the take-2 spike: eleven takes of work lived
only in standalone HTML files the repo could not produce, and CI would happily
have built an APK of the spike. One source, two outputs, so that cannot recur.

  split   www/index.html + www/app.js + www/bundle/*   -> what Capacitor packages
  single  one self-contained .html                      -> what you can open now

Split mode is not just a packaging choice. The app boots by reading the bundle
manifest and honouring its three states (landmine 34), so the provisioning model
is exercised on every launch instead of living only in a tool.
"""
import base64, json, os, shutil, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from region import R

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "src", "app.html")
WWW = os.path.join(ROOT, "www")

# One line, and it must match src/app.html BYTE FOR BYTE — these are stripped
# by exact string match, so a two-line form with different indentation left
# `CONT = __CONT__` in the shipped app and the map never constructed (take 91).
DECLS = ('var WATER = __WATER__, GR = __GRAPH__, TR = __TERRAIN__, POIS = __POIS__, CONT = __CONT__, PADDLE = __PADDLE__, LAND = __LAND__;',
         'var SHADE = "__SHADE__";', 'var SAT = "__SAT__";',
         'var SATB = __SATB__;', 'var GLYPHS = __GLYPHS__;')


# Scratch payload name -> the name it carries inside a bundle.
IN_BUNDLE = {"graph_payload.json": "graph.json",
             "terrain_payload.json": "terrain.json",
             "glyphs_payload.json": "glyphs.json",
             "water_payload.json": "water.json",
             "imagery_meta.json": "imagery-meta.json",
             "context_payload.json": "context.json",
             "poi_payload.json": "poi.json",
             "contour_payload.json": "contour.json",
             "corridor_payload.json": "corridor.json",
             "landcover_payload.json": "landcover.json",
             "address_payload.json": "address.json",
             "other_payload.json": "other.json",
             "hillshade.jpg": "hillshade.jpg",
             "imagery.jpg": "imagery.jpg",
             "manifest.json": "manifest.json"}


def find(name):
    """The selected region's bundle wins, always.

    Take 14 shipped a St. Helen page built from Bull Gap's graph: the bundle was
    checked for `graph_payload.json`, which only ever exists in scratch, so the
    lookup fell through to whatever the last pipeline run left at the root. Right
    manifest, wrong map, identical file size — the tell.
    """
    sel = os.path.join(ROOT, "bundles", R.id)
    bn = IN_BUNDLE.get(name)
    if bn:
        p = os.path.join(sel, bn)
        if os.path.exists(p):
            return p
    for d in (sel, ROOT):
        p = os.path.join(d, name)
        if os.path.exists(p):
            return p
    return None


def parts():
    s = open(SRC, encoding="utf-8").read()
    head = s[:s.index("<script>__MLGJS__</script>")]
    app = s[s.rindex("<script>") + 8:s.rindex("</script>")]
    for d in DECLS:
        app = app.replace(d, "")
    return head, app.strip()


LOADER = """/* Boot from the region bundle. PROTOCOL §8: provisioning may use the
   network, the field may not -- these are same-origin reads of files already on
   the device, which is why the NET guard stays green.

   The manifest drives it. A region missing an optional layer still rides
   (landmine 34); a region missing a required one is refused rather than shown
   with holes, because a map you cannot trust is worse than no map. */
(function(){
var WATER,GR,TR,SHADE,SAT,SATB,GLYPHS,BUNDLE={state:'unknown',absent:[]};

function j(u){return fetch(u).then(function(r){
  if(!r.ok)throw new Error(u+' '+r.status);return r.json()})}
function blob(u){return fetch(u).then(function(r){
  if(!r.ok)throw new Error(u+' '+r.status);return r.blob()})
  .then(function(b){return URL.createObjectURL(b)})}

function fatal(msg,detail){
  document.body.innerHTML='<div style="padding:26px;font:400 14px/1.6 Roboto,'+
   'system-ui,sans-serif;color:#F5EFE2;background:#14120F;height:100%">'+
   '<div style="font:700 12px/1 Roboto;letter-spacing:.17em;text-transform:uppercase;'+
   'color:#E2570F;margin-bottom:14px">APEX ORV</div>'+
   '<b style="font-size:17px">'+msg+'</b><br><br>'+
   '<span style="color:#9A9184">'+detail+'</span></div>'}

/* These names must match the `kind` column in tools/bundle.py ARTIFACTS.
   They did not at take 12 — the loader wanted graph/terrain/glyphs while the
   manifest emitted network/terrain/labels, so every region would have been
   refused as incomplete. Caught by simulating a partial bundle, not by reading. */
var REQ={network:1,terrain:1,labels:1};
var OPT=['imagery','relief','hydro'];

j('bundle/manifest.json').then(function(man){
  var have={};man.artifacts.forEach(function(a){have[a.kind]=a.path});
  var missingReq=Object.keys(REQ).filter(function(k){return !have[k]});
  if(missingReq.length){
    fatal('Region incomplete',
      'This region is missing '+missingReq.join(', ')+'. It has not been shown '+
      'rather than shown with gaps in it — a map with holes is worse than no map. '+
      'Re-download the region on wifi.');
    throw new Error('required artifact missing');}
  BUNDLE.absent=OPT.filter(function(k){return !have[k]});
  BUNDLE.state=BUNDLE.absent.length?'partial':'complete';
  BUNDLE.name=man.name;BUNDLE.built=man.built;BUNDLE.centre=man.centre;
  BUNDLE.bbox=man.bbox;BUNDLE.anchors=man.anchors||[];BUNDLE.region=man.region;
  BUNDLE.hash=man.bundle_sha256;BUNDLE.tiles=man.imagery_tiles||null;
  return Promise.all([
    j('bundle/'+have.network), j('bundle/'+have.terrain), j('bundle/'+have.labels),
    have.hydro?j('bundle/'+have.hydro):Promise.resolve({l:{}}),
    have.relief?blob('bundle/'+have.relief):Promise.resolve(''),
    have.imagery?blob('bundle/'+have.imagery):Promise.resolve(''),
    Promise.resolve({b:man.imagery_bounds||[0,0,0,0]}),
    have.context?j('bundle/'+have.context):Promise.resolve(null),
    have.address?j('bundle/'+have.address):Promise.resolve(null),
    have.other?j('bundle/'+have.other):Promise.resolve(null),
    /* A110. Optional and absent-safe: an older bundle has no places artifact
       and the app simply draws no pins, rather than refusing the region. */
    have.places?j('bundle/'+have.places):Promise.resolve(null),
    /* A87. Optional and absent-safe, exactly like places: an older bundle has
       no contour artifact and the map simply has no contour lines. */
    have.contour?j('bundle/'+have.contour):Promise.resolve(null),
    /* A115. Optional and absent-safe like the rest. */
    have.paddle?j('bundle/'+have.paddle):Promise.resolve(null),
    have.ground?j('bundle/'+have.ground):Promise.resolve(null)]);
}).then(function(r){
  GR=r[0];TR=r[1];GLYPHS=r[2];WATER=r[3];SHADE=r[4];SAT=r[5];SATB=r[6].b;CTX=r[7];ADDR=r[8];SHOW=r[9];
  POIS=r[10];CONT=r[11];PADDLE=r[12];LAND=r[13];
  start();
}).catch(function(e){
  if(String(e.message).indexOf('required artifact')<0)
    fatal('Could not load this region',String(e.message)+
     '<br><br>The bundle may be corrupt. Re-download it on wifi.');
});

function start(){
"""

TAIL = """
/* Say plainly which layers this region does not have. Silently dropping one is
   how you end up trusting a map that is lying by omission. */
if(BUNDLE.state==='partial'){
  var names={imagery:'satellite imagery',relief:'hillshade',hydro:'water'};
  el('b-src').textContent='PARTIAL';
  el('b-src').className='badge bad';
  show('<span class="tn">Region is partial</span><span class="tag shut">'+
    BUNDLE.absent.length+' layer missing</span><br>Navigation works. Not downloaded: <b>'+
    BUNDLE.absent.map(function(k){return names[k]||k}).join(', ')+
    '</b>. Re-download on wifi to complete it.','fail');
}
}
})();
"""


def split():
    head, app = parts()
    os.makedirs(os.path.join(WWW, "bundle"), exist_ok=True)
    head = (head.replace("<style>__MLGCSS__</style>",
                         '<link rel="stylesheet" href="vendor/maplibre-gl.css">')
                .replace("</body>", "")
                .replace("</html>", ""))
    open(os.path.join(WWW, "index.html"), "w").write(
        head + '<script src="vendor/maplibre-gl-csp.js"></script>\n'
        '<script>maplibregl.setWorkerUrl("vendor/maplibre-gl-csp-worker.js");</script>\n'
               '<script src="app.js"></script>\n</body>\n</html>\n')
    open(os.path.join(WWW, "app.js"), "w").write(LOADER + app + TAIL)

    # imagery tiles ride along as real files; MapLibre fetches them by URL and
    # only decodes what is on screen
    tsrc = os.path.join(ROOT, "bundles", R.id, "imagery")
    tdst = os.path.join(WWW, "bundle", "imagery")
    if os.path.isdir(tsrc):
        if os.path.isdir(tdst):
            shutil.rmtree(tdst)
        shutil.copytree(tsrc, tdst)
        n = sum(len(f) for _, _, f in os.walk(tdst))
        print(f"  imagery tiles: {n}")

    # The manifest was copied into www/ ONLY as a special case inside
    # pipeline.py's smoke step, so a build_app run without smoke shipped
    # whatever manifest a previous run had left — and this is the one file the
    # loader trusts absolutely: it decides required vs optional, fatal vs
    # partial, and which payloads to fetch at all. A stale one listed water.json
    # beside a www/ that no longer had it, and the app hit the fatal screen on a
    # perfectly good bundle (take 76). The step that assembles www/ owns
    # everything in www/.
    # This was a SECOND copy of IN_BUNDLE, and adding the places artifact to one
    # and not the other produced a bundle that verified COMPLETE while www/
    # served a 404 for a file its own manifest referenced. One table, read by
    # both (landmine 107, take 89).
    named = dict(IN_BUNDLE)
    named["manifest.json"] = "manifest.json"
    copied = []
    for src, dst in named.items():
        p = find(src)
        if p:
            shutil.copyfile(p, os.path.join(WWW, "bundle", dst))
            copied.append(dst)
    # A payload this run did NOT copy must not survive from the last one.
    # www/ is what cap sync packages, so a leftover water.json rides into the
    # APK as a layer the pipeline explicitly refused to produce (take 76).
    # Stale build artifacts are a hazard, not an archive (landmine 54).
    for dst in named.values():
        if dst in copied:
            continue
        sp = os.path.join(WWW, "bundle", dst)
        if os.path.exists(sp):
            os.remove(sp)
            print(f"  removed stale bundle/{dst} from an earlier build")
    for stale in ("style.json",):
        sp = os.path.join(WWW, stale)
        if os.path.exists(sp):
            os.remove(sp)
    print(f"split -> www/index.html, www/app.js, www/bundle/ ({len(copied)} files)")
    for c in sorted(copied):
        print(f"    {c}")
    if "graph.json" not in copied:
        print("    NOTE no bundle artifacts found — run the pipeline, "
              "then tools/bundle.py build")


def single(out):
    head, app = parts()
    def rd(n, b=False):
        p = find(n)
        if not p:
            return None
        return open(p, "rb").read() if b else open(p, encoding="utf-8").read()

    def uri(n):
        d = rd(n, True)
        return "data:image/jpeg;base64," + base64.b64encode(d).decode() if d else ""

    meta = rd("imagery_meta.json")
    _mp = find("manifest.json")
    _man = json.load(open(_mp)) if _mp else {}
    # This said state:"complete", absent:[] unconditionally — so the browser
    # build claimed a full region however much was missing, and WATER silently
    # defaulted to an empty layer. The split build computes this honestly from
    # what it loaded; the single build was asserting it (take 76). A page that
    # says COMPLETE with no water in it is exactly the confident wrong answer
    # this app exists not to give.
    _absent = [k for k, f in (("imagery", "imagery.jpg"),
                              ("relief", "hillshade.jpg"),
                              ("hydro", "water_payload.json"))
               if not rd(f) and not uri(f)]
    _state = "partial" if _absent else "complete"
    if _absent:
        print(f"  single: PARTIAL — absent: {', '.join(_absent)}")
    decl = (f'var WATER = {rd("water_payload.json") or "{\"l\":{}}"}, '
            f'GR = {rd("graph_payload.json")}, TR = {rd("terrain_payload.json")}, '
            f'POIS = {rd("poi_payload.json") or "null"};\n'
            f'CONT = {rd("contour_payload.json") or "null"};\n'
            f'PADDLE = {rd("corridor_payload.json") or "null"};\n'
            f'LAND = {rd("landcover_payload.json") or "null"};\n'
            f'var SHADE = "{uri("hillshade.jpg")}";\n'
            f'var SAT = "{uri("imagery.jpg")}";\n'
            f'var SATB = {json.dumps(json.loads(meta)["b"]) if meta else "[0,0,0,0]"};\n'
            f'var GLYPHS = {rd("glyphs_payload.json")};\n'
            f'var BUNDLE={{state:"{_state}",absent:{json.dumps(_absent)},'
        f'centre:{json.dumps(_man.get("centre"))},bbox:{json.dumps(_man.get("bbox"))},'
        f'anchors:{json.dumps(_man.get("anchors", []))},'
        f'name:{json.dumps(_man.get("name"))}}};\n')
    # From www/vendor, which CI fetches and the gate declares — NOT from
    # gitignored mlg.js/mlg.css, which existed only in one container and would
    # have produced a single-file page with no map engine at all (take 25,
    # landmine 32 yet again).
    V = os.path.join(ROOT, "www", "vendor")
    def vendored(name):
        q = os.path.join(V, name)
        return open(q, encoding="utf-8").read() if os.path.exists(q) else None
    mlg_css = vendored("maplibre-gl.css")
    # The single file cannot reference a separate worker, so it uses the
    # standard build (blob workers, which real browsers allow). The split/APK
    # build uses the CSP build with an explicit worker url. Divergence stated,
    # and both are render-verified.
    mlg_js = vendored("maplibre-gl.js")
    if not mlg_js or not mlg_css:
        sys.exit("single: www/vendor/maplibre-gl.{js,css} missing — "
                 "run the vendor step first (see .github/workflows/build.yml)")
    html = (head.replace("__MLGCSS__", mlg_css)
            + "<script>" + mlg_js + "</script>\n<script>"
            + decl + app + "\n</script>\n</body>\n</html>\n")
    open(out, "w").write(html)
    print(f"single -> {out}  ({len(html)/1048576:.2f} MB)")


def _args():
    """Positionals only. `--region X` was being swallowed as the output path,
    so a St. Helen build wrote Bull Gap's manifest into the page (take 14)."""
    out, skip = [], False
    for a in sys.argv[1:]:
        if skip:
            skip = False
            continue
        if a == "--region":
            skip = True
            continue
        if a.startswith("--"):
            continue
        out.append(a)
    return out


if __name__ == "__main__":
    argv = _args()
    mode = argv[0] if argv else "split"
    print(f"region {R.id} — {R.name}")
    if mode == "split":
        split()
    elif mode == "single":
        single(argv[1] if len(argv) > 1 else
               os.path.join(ROOT, f"apex-{R.id}.html"))
    else:
        sys.exit(__doc__)
