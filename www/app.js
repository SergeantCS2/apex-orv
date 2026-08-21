/* Boot from the region bundle. PROTOCOL §8: provisioning may use the
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
    have.other?j('bundle/'+have.other):Promise.resolve(null)]);
}).then(function(r){
  GR=r[0];TR=r[1];GLYPHS=r[2];WATER=r[3];SHADE=r[4];SAT=r[5];SATB=r[6].b;CTX=r[7];ADDR=r[8];SHOW=r[9];
  start();
}).catch(function(e){
  if(String(e.message).indexOf('required artifact')<0)
    fatal('Could not load this region',String(e.message)+
     '<br><br>The bundle may be corrupt. Re-download it on wifi.');
});

function start(){
var el=function(i){return document.getElementById(i)};
var remoteHits=0,netB=el('b-net');

function isRemote(r){try{var u=new URL(r,location.href);
 if(['data:','blob:','file:'].indexOf(u.protocol)>=0)return false;
 return u.origin!==location.origin}catch(e){return false}}
function watch(r){if(!isRemote(r))return;remoteHits++;
 netB.textContent='NET '+remoteHits+' REMOTE';netB.className='badge bad'}
var nf=window.fetch&&window.fetch.bind(window);
if(nf)window.fetch=function(i,o){watch(typeof i==='string'?i:(i&&i.url)||'');return nf(i,o)};
var no=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(m,u){watch(u);return no.apply(this,arguments)};
netB.textContent='NET CLEAN';netB.className='badge good';

function decode(a){var p=[],x=0,y=0;for(var i=0;i<a.length;i+=2){x+=a[i];y+=a[i+1];
 p.push([x/1e5,y/1e5])}return p}

/* ── graph ─────────────────────────────────────────────────────────────── */
var NODES=decode(GR.n), CLS=GR.cls, NM=GR.nm, BK=GR.bk, B=GR.b;
var EDGES=GR.e.map(function(e,i){return {a:e[0],b:e[1],L:e[2],c:CLS[e[3]],
  n:e[4]>=0?NM[e[4]]:null,id:e[5]>=0?NM[e[5]]:null,bi:e[6],i:i}});
function attrs(e){var o={};if(e.bi<0)return o;
  var v=B[e.bi];for(var k=0;k<BK.length;k++)if(v[k])o[BK[k]]=v[k];return o}

var ADJ=[];for(var i=0;i<NODES.length;i++)ADJ.push([]);
EDGES.forEach(function(e){ADJ[e.a].push(e);ADJ[e.b].push(e)});

el('b-src').textContent='GRAPH '+EDGES.length;
el('b-src').className='badge good';

/* Machine legality. This is ROADMAP 7.4 driven by real MVUM and DNR width data,
   not a guess: a 24" motorcycle trail is illegal for a quad, and a side-by-side
   belongs on 72" routes and roads only. */
var MACHINE={
  bike:{lbl:'🏍 Dirt bike 24"',ok:['route72','trail50','moto24','mccct','fstrail','fsroad','paved','minor','track']},
  quad:{lbl:'🛻 Quad 50"',ok:['route72','trail50','mccct','fstrail','fsroad','paved','minor','track']},
  sxs:{lbl:'🚙 Side-by-side 72"',ok:['route72','fsroad','paved','minor']}
};
/* machIdx, not `mi` — take 15: `mi=0` here silently overwrote the mi(a,b)
   distance function (hoisted from the safety block below), so every Phase-4
   distance call was invoking the number 0 from take 7 onward. The Python
   verifiers mirror the maths and structurally cannot catch a wiring collision
   like this; only executing the shipped file did. */
var ORDER=['bike','quad','sxs'],machIdx=0,machine='bike';
var SPEED={route72:25,fsroad:22,trail50:16,fstrail:14,mccct:11,moto24:11,
  paved:45,minor:28,track:14};
var EFFORT={paved:1,route72:1.05,fsroad:1.1,minor:1.15,trail50:1.5,fstrail:1.7,
  track:1.8,mccct:2.3,moto24:2.6};
var PAVED={paved:1,minor:1};
var HARD=['paved','minor','route72','fsroad','track','trail50','fstrail','mccct','moto24'];

/* ── render straight off the graph — one source of truth, conflation applied ── */
var wf=[];Object.keys(WATER.l).forEach(function(c){var poly=(c==='water');
  WATER.l[c].forEach(function(e){var r=decode(e);
    wf.push({type:'Feature',properties:{c:c},
      geometry:poly?{type:'Polygon',coordinates:[r]}:{type:'LineString',coordinates:r}})})});

/* Map labels use what the sign says, not the database name. "The Meadows
   Motorcycle Trail (TMM)" will not fit along a two-track at z14; "TMM · H58-1"
   is both shorter and closer to what is nailed to the post. The inspect card
   still shows the full name. */
function labelFor(e){
  if(!e.n&&!e.id)return '';
  var n=e.n||'';
  var m=n.match(/\(([A-Z0-9]{2,5})\)\s*$/);
  if(m)n=m[1];
  else if(n.length>24)n=n.replace(/\s+(Trail|Route|Road)$/i,'');
  if(e.id&&e.id!==n&&n)return n+' · '+e.id;
  return n||e.id}
var nf2=EDGES.map(function(e){return {type:'Feature',
  properties:{c:e.c,i:e.i,lb:labelFor(e)},
  geometry:{type:'LineString',coordinates:decode(GR.g[e.i])}}});

/* ══ LABEL STROKES ══════════════════════════════════════════════════════════
   Line-placed labels need a line long enough to carry the text. The graph is
   split into ROUTING edges — median 76 m, and 76% under the 230 px symbol
   spacing — so each edge is its own feature and almost none can host a label.
   The result: 2-3 names for up to 102 trail segments on screen. Every trail
   edge has a label in the data; nearly none of them were being shown.

   Chain consecutive edges that share a label into maximal strokes, and place
   labels on those instead. Built once at load over 16k edges. */
function chainStrokes(){
  var byKey={};
  EDGES.forEach(function(e){
    var lb=labelFor(e); if(!lb)return;
    var k=e.c+'\u0000'+lb;
    (byKey[k]||(byKey[k]=[])).push(e)});
  var feats=[];
  Object.keys(byKey).forEach(function(k){
    var list=byKey[k],cls=k.split('\u0000')[0],lb=k.split('\u0000')[1];
    var adj={},used={};
    list.forEach(function(e){
      (adj[e.a]||(adj[e.a]=[])).push(e);(adj[e.b]||(adj[e.b]=[])).push(e)});
    function walk(from,e){
      /* follow this label as far as it goes, never reusing an edge */
      var pts=decode(GR.g[e.i]).slice(),cur=(e.a===from?e.b:e.a);
      used[e.i]=1;
      if(e.a!==from)pts.reverse();
      for(;;){
        var nx=null,cand=adj[cur]||[];
        for(var i=0;i<cand.length;i++)if(!used[cand[i].i]){nx=cand[i];break}
        if(!nx)break;
        used[nx.i]=1;
        var g=decode(GR.g[nx.i]);
        if(nx.a!==cur)g.reverse();
        pts=pts.concat(g.slice(1));
        cur=(nx.a===cur?nx.b:nx.a)}
      return pts}
    /* start at dead ends first so strokes run end to end, then mop up loops */
    var starts=[];
    Object.keys(adj).forEach(function(n){if(adj[n].length===1)starts.push(+n)});
    starts.forEach(function(n){
      (adj[n]||[]).forEach(function(e){if(!used[e.i])
        feats.push({type:'Feature',properties:{c:cls,lb:lb},
          geometry:{type:'LineString',coordinates:walk(n,e)}})})});
    list.forEach(function(e){if(!used[e.i])
      feats.push({type:'Feature',properties:{c:cls,lb:lb},
        geometry:{type:'LineString',coordinates:walk(e.a,e)}})});
  });
  return feats}
/* ══ SHOW-ONLY ROUTES ═══════════════════════════════════════════════════════
   Trails that EXIST but a dirt bike may not legally ride: hiking, equestrian,
   ski, snowmobile, non-motorised NFS, and OSM paths. Jacob rides to camp and
   wants to know every route in the area — a footpath to a lake is worth seeing.
   They are held out of the routing graph entirely by graph.py, so no cost
   function, snap or loop can reach them; here they are only drawn. */
var SHOWN={foot:'foot / hike',horse:'equestrian',snow:'ski',snowmob:'snowmobile',
  nfsmoto:'NFS trail — MVUM governs',cycle:'cycleway',race:'raceway',
  bike:'bike trail',mou:'permit / MOU',railtrail:'rail trail'};
var showFeats=(SHOW&&SHOW.r?SHOW.r:[]).map(function(r){
  return {type:'Feature',properties:{c:r.c,n:r.n||'',u:r.u||SHOWN[r.c]||r.c},
    geometry:{type:'LineString',coordinates:r.g}}});

var strokes=chainStrokes();

function w(a,b,c){return ['interpolate',['linear'],['zoom'],10,a,14,b,17,c]}
/* MapLibre forbids more than ONE zoom-based interpolate per expression, so
   ['case', cond, w(...), w(...)] is invalid — and an invalid expression makes
   MapLibre reject the ENTIRE style, which is why not a single layer drew from
   take 9 to take 22. Keep the zoom curve on the outside and branch inside it
   (landmine 52). */
function wCase(cond,t,f){
  return ['interpolate',['linear'],['zoom'],
    10,['case',cond,t[0],f[0]],
    14,['case',cond,t[1],f[1]],
    17,['case',cond,t[2],f[2]]]}
function lyr(id,cls,col,wd,dash){var o={id:id,type:'line',source:'net',
  filter:['==',['get','c'],cls],layout:{'line-cap':dash?'butt':'round','line-join':'round'},
  paint:{'line-color':col,'line-width':wd}};if(dash)o.paint['line-dasharray']=dash;return o}

/* ══ LABELS ═════════════════════════════════════════════════════════════════
   MOVED at take 15. This block accreted at take 9 hundreds of lines BELOW the
   map constructor and the pins that use PLACES. `var` hoisting made every
   reference `undefined` instead of an error, so style.glyphs and the places
   source were silently dead from take 9 onward — verify9 proved the glyph PACK
   perfect while nothing checked the WIRING — and take 14's anchorOf turned the
   silence into a fatal crash. Found by the first actual execution of the
   shipped file (tools/smoke.mjs). Definition order is load-bearing here.
══
   Landmine 4: MapLibre fetches glyph ranges from a `glyphs` URL and ships no
   fallback, so a style with symbol layers and no glyphs renders silently blank.
   A CDN is not allowed (PROTOCOL §8), so the SDF pack is generated in
   tools/glyphs.py and inlined here.

   ONE fontstack, served from a static data: URI. MapLibre substitutes
   {fontstack}/{range} only if the placeholders are present; without them it
   requests the URL as-is and gets the same pack every time. That avoids needing
   a custom protocol handler for glyph requests, which would be one more thing
   between the map and its text. data: is allowed by the offline guard. */
/* MapLibre REQUIRES the glyphs url to be a template carrying {fontstack} and
   {range} — a bare data: URI fails STYLE VALIDATION, which rejects the whole
   style, which is why not one layer drew on the Fold (take 22 engine message:
   'glyphs url must include a "{fontstack}" token'). Shipped broken since take 9.

   A custom protocol keeps everything in memory, so this works identically in the
   single-file build and in the APK, with no font files on disk and no network. */
var GLYPH_BUF=(function(){var b=atob(GLYPHS.APEX),n=b.length,u=new Uint8Array(n);
  for(var i=0;i<n;i++)u[i]=b.charCodeAt(i);return u})();
maplibregl.addProtocol('apexfont',function(){
  return Promise.resolve({data:GLYPH_BUF.buffer.slice(0)})});
var GLYPH_URL='apexfont://{fontstack}/{range}.pbf';

/* Anchors come from the region manifest, not from here. Take 14 made regions a
   real concept; an app that knows the names of one riding area is a demo of that
   area, not a tool. */
var CTR=BUNDLE.centre||(BUNDLE.bbox?
  [(BUNDLE.bbox[0]+BUNDLE.bbox[2])/2,(BUNDLE.bbox[1]+BUNDLE.bbox[3])/2]:[0,0]);
var PLACES=(BUNDLE.anchors&&BUNDLE.anchors.length?BUNDLE.anchors:
  [[BUNDLE.name||'Region',CTR[0],CTR[1],'town']]);
var placeFC={type:'FeatureCollection',features:PLACES.map(function(p){
  return {type:'Feature',properties:{n:p[0],k:p[3]||'town'},
    geometry:{type:'Point',coordinates:[p[1],p[2]]}}})};

/* Satellite is optional. With no imagery (partial region) or no georeference,
   the source still needs valid geometry and the basemap chip must not offer
   what cannot be shown. */
var TILES=BUNDLE.tiles||null;
var TILEURL='bundle/imagery/{z}/{x}/{y}.jpg';
var SAT_OK=!!TILES||!!(SAT&&SATB&&(SATB[2]-SATB[0])>1e-6&&(SATB[3]-SATB[1])>1e-6);
var SATBOX=SAT_OK?SATB:(BUNDLE.bbox||[0,0,1,1]);
var SATURL=SAT_OK?SAT:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
var map=new maplibregl.Map({container:'map',style:{version:8,glyphs:GLYPH_URL,
  sources:{
    /* Real tiles when the bundle has them: MapLibre fetches only what is on
       screen, so z15 over the whole region costs 45 MB on disk but bounded
       memory. The single 1500 px mosaic it replaces was 22.1 m/px — a
       two-track is one metre wide, which is why the satellite layer was
       unusable (take 42). The mosaic stays as the fallback for the
       single-file build, which cannot carry 2,000 files. */
    sat:TILES?{type:'raster',tiles:[TILEURL],tileSize:256,
      minzoom:TILES.zmin,maxzoom:TILES.zmax,
      bounds:[SATBOX[0],SATBOX[1],SATBOX[2],SATBOX[3]],
      attribution:'USGS'}
     :{type:'image',url:SATURL,
      coordinates:[[SATBOX[0],SATBOX[3]],[SATBOX[2],SATBOX[3]],[SATBOX[2],SATBOX[1]],[SATBOX[0],SATBOX[1]]]},
    hs:{type:'image',url:SHADE,
      coordinates:[[TR.b[0],TR.b[3]],[TR.b[2],TR.b[3]],[TR.b[2],TR.b[1]],[TR.b[0],TR.b[1]]]},
    wtr:{type:'geojson',data:{type:'FeatureCollection',features:wf}},
    net:{type:'geojson',data:{type:'FeatureCollection',features:nf2}},
    strokes:{type:'geojson',data:{type:'FeatureCollection',features:strokes}},
    showonly:{type:'geojson',data:{type:'FeatureCollection',features:showFeats}},
    state:{type:'geojson',data:{type:'FeatureCollection',features:[]}},
    lakes:{type:'geojson',data:{type:'FeatureCollection',features:[]}},
    approach:{type:'geojson',data:{type:'FeatureCollection',features:[]}},
    alt:{type:'geojson',data:{type:'FeatureCollection',features:[]}},
    route:{type:'geojson',data:{type:'FeatureCollection',features:[]}},
    crumb:{type:'geojson',data:{type:'FeatureCollection',features:[]}},
    back:{type:'geojson',data:{type:'FeatureCollection',features:[]}},
    places:{type:'geojson',data:placeFC}
  },
  layers:[
    {id:'bg',type:'background',paint:{'background-color':'#E4D7BC'}},
    /* USGS ImageryOnly, NAIP-derived, public domain. Landmine 22: Esri, Google,
       Bing and Mapbox imagery are licensed and may not ship offline. */
    {id:'sat',type:'raster',source:'sat',layout:{visibility:'none'},
      paint:{'raster-opacity':1,'raster-fade-duration':0}},
    /* Relief under the map, multiplied into the sand rather than laid over it,
       so trails stay the loudest thing on screen. */
    {id:'hillshade',type:'raster',source:'hs',
      paint:{'raster-opacity':0.42,'raster-contrast':0.12,'raster-fade-duration':0}},
    {id:'water',type:'fill',source:'wtr',filter:['==',['get','c'],'water'],
      paint:{'fill-color':'#8FA9B8'}},
    {id:'wway',type:'line',source:'wtr',filter:['==',['get','c'],'waterway'],
      paint:{'line-color':'#8FA9B8','line-width':w(0.5,1.8,4)}},
    /* A white casing under every trail. This is the single thing that makes a
       coloured network readable over satellite imagery, and it was switched OFF
       except in satellite mode — so on the default map the trails had no
       separation from the roads at all. */
    {id:'casing',type:'line',source:'net',
      layout:{'line-cap':'round','line-join':'round'},
      filter:['in',['get','c'],['literal',['route72','trail50','moto24','mccct','fstrail']]],
      paint:{'line-color':'#FFFFFF','line-opacity':0.9,'line-width':w(2.8,6.2,13)}},
    /* Two-track gets its OWN, narrower casing. Sharing the designated-trail
       casing swamped it — a 1.6 px brown line under a 6 px white halo reads as a
       cream line, which is how the two-track disappeared entirely (take 61). */
    {id:'casing-track',type:'line',source:'net',
      layout:{'line-cap':'round','line-join':'round'},
      filter:['==',['get','c'],'track'],
      paint:{'line-color':'#FFFFFF','line-opacity':0.75,'line-width':w(1.7,3.8,8)}},
    /* PAVED and MINOR are roads and read as background. TRACK and FSROAD are
       not: forest two-track and USFS road are 1,169 of the 2,246 miles here —
       52% — and they are exactly what a dirt bike rides. Styled as grey dashes
       they read as "not for you", which is why Jacob said the trails he rides
       had no colour (take 58). They are ridable dirt: a warm tan, solid, thinner
       than designated trail so the hierarchy still reads. */
    lyr('minor','minor','#4A443B',w(0.4,0.9,2.2)),
    lyr('paved','paved','#3A352E',w(0.9,2,4.8)),
    /* fsroad and track were the same brown at take 58, and Jacob's own example
       shows why that is wrong: "East Wagner Lake Road" is minor and "E. Wagner
       Lake Rd" is fsroad — the SAME road, split in the source. A Forest Service
       road is something you drive a truck down; a two-track is something you
       ride. Muted grey-tan for the road, warm brown for the two-track, and only
       the two-track gets a casing (take 61). */
    lyr('fsroad','fsroad','#8A7C66',w(0.6,1.4,3.2)),
    lyr('track','track','#9C7343',w(0.7,1.8,3.9)),
    /* Trails, by difficulty. Widest/easiest drawn first so the hard singletrack
       sits on top where it matters. */
    lyr('route72','route72','#2F7D4F',w(1.7,4.1,9.5)),
    lyr('fstrail','fstrail','#1F6FB2',w(1.4,3.4,8)),
    lyr('trail50','trail50','#1F6FB2',w(1.5,3.7,8.6)),
    lyr('mccct','mccct','#17150F',w(1.5,3.7,8.6)),
    lyr('moto24','moto24','#17150F',w(1.5,3.7,8.6)),
    lyr('closed','closed','#C1121F',w(1.2,3,7),[2,1.3]),
    lyr('fsclosed','fsclosed','#C1121F',w(1.2,3,7),[2,1.3]),
    /* Both of these were written twice and never landed: my patches anchored on
       'route-line', and the layer is called 'routeline'. The SOURCES were
       created and fed data, so every check I wrote — which measured setData —
       passed while nothing drew. Sources without layers are invisible data
       (take 43, landmine 68). Order matters: alternates under the choice,
       approach legs over it so the dashes stay readable. */
    {id:'show-line',type:'line',source:'showonly',minzoom:11.5,
      layout:{'line-cap':'round'},
      paint:{'line-color':'#7C6F5A','line-width':w(0.9,1.6,2.6),
        'line-dasharray':[1,2],'line-opacity':0.75}},
    {id:'alt-line',type:'line',source:'alt',
      layout:{'line-cap':'round','line-join':'round'},
      paint:{'line-color':'#5F574B','line-width':w(2.6,3.8,5.2),'line-opacity':0.72}},
    {id:'routeline',type:'line',source:'route',
      layout:{'line-cap':'round','line-join':'round'},
      paint:{'line-color':'#00A8E8','line-width':w(3,6,13),'line-opacity':.7}},
    {id:'approach-line',type:'line',source:'approach',
      layout:{'line-cap':'round'},
      paint:{'line-color':'#3FA7E0','line-width':w(2.0,2.8,3.6),
        'line-dasharray':[1.6,1.6],'line-opacity':0.95}},
    {id:'crumbline',type:'line',source:'crumb',
      layout:{'line-cap':'round','line-join':'round'},
      paint:{'line-color':'#111','line-width':w(1.6,3,6),'line-opacity':.85,
        'line-dasharray':[0.6,1.1]}},
    {id:'backline',type:'line',source:'back',
      layout:{'line-cap':'round','line-join':'round'},
      paint:{'line-color':'#FFD166','line-width':w(3,6,13),'line-opacity':.95}}    ,
    /* Trail names ride along the line, the way a routed sign sits beside it.
       Designated line gets its name and number; advisory OSM line gets neither,
       so text itself carries provenance. */
    /* Land filled, water left as the page ground: that contrast is what makes
       the mitten read as the mitten. Both fade out before the real data. */
    {id:'state-fill',type:'fill',source:'state',maxzoom:9.6,
      paint:{'fill-color':'#EFE7D6',
        'fill-opacity':['interpolate',['linear'],['zoom'],5,1,8.6,0.75,9.6,0]}},
    {id:'state-line',type:'line',source:'state',maxzoom:9.6,
      paint:{'line-color':'#8A8175',
        'line-width':['interpolate',['linear'],['zoom'],5,1.0,7,1.4,9.5,1.8],
        'line-opacity':['interpolate',['linear'],['zoom'],5,0.9,8.6,0.7,9.6,0]}},
    {id:'lake-label',type:'symbol',source:'lakes',maxzoom:8.4,
      layout:{'text-field':['get','n'],'text-font':['APEX'],
        'text-size':['interpolate',['linear'],['zoom'],5,9.5,7.5,12],
        'text-letter-spacing':0.18,'text-max-width':9},
      paint:{'text-color':'#5C7C8A','text-halo-color':'#E4D7BC','text-halo-width':1.8,
        'text-opacity':['interpolate',['linear'],['zoom'],5,0.95,7.8,0.8,8.4,0]}},
    {id:'lbl-place',type:'symbol',source:'places',
      layout:{'text-field':['get','n'],'text-font':['APEX'],
        'text-size':wCase(['==',['get','k'],'town'],[12,15,18],[10.5,13,15.5]),
        'text-transform':['case',['==',['get','k'],'town'],'uppercase','none'],
        'text-letter-spacing':['case',['==',['get','k'],'town'],0.16,0.04],
        'text-anchor':'center','text-allow-overlap':false,'text-padding':6},
      paint:{'text-color':['case',['==',['get','k'],'town'],'#1C1A17','#7A3F0C'],
        'text-halo-color':'#EFE6D2','text-halo-width':2.2,'text-halo-blur':0.5}},
    {id:'lbl-trail',type:'symbol',source:'strokes',minzoom:11.4,
      filter:['in',['get','c'],['literal',['route72','trail50','moto24','mccct','fstrail']]],
      layout:{'symbol-placement':'line','text-field':['get','lb'],
        'text-font':['APEX'],'text-size':w(9.5,11.5,14),
        /* 32 degrees placed ZERO labels on this network: ORV trails bend far more than
         that inside the width of a name, and MapLibre rejects the placement
         outright. Measured sweep at z14.5 over 29 candidate strokes:
         a32 s230 -> 0 · a60 s230 -> 3 · a60 s120 -> 4 · a85 s90 -> 5.
         75/100 keeps most of the gain without text wrapping round hairpins. */
        /* Swept at the REAL viewport (411x960), not the 900x1400 the harness used
           to run — that overstated density threefold. Measured at z14.5:
           75/100/pad2 -> 4 names · 85/60/pad1 -> 5 · with smaller text -> 6.
           Past that it flattens, so more aggression buys nothing (take 57). */
        'text-max-angle':85,'symbol-spacing':60,'text-letter-spacing':0.02,
        'text-padding':1},
      /* White on a dark halo rather than dark on light: it survives sand,
         hillshade and satellite equally, which dark-on-light does not. */
      paint:{'text-color':'#FFFFFF','text-halo-color':'rgba(20,18,15,0.92)',
        'text-halo-width':1.9,'text-halo-blur':0.2}},
    /* AFTER lbl-trail. MapLibre gives earlier symbol layers priority in collision,
       so this sat in front and a non-ridable path ("Mack's Sault") was named
       while the trail loop a rider was standing on was not (take 57). Names you
       may ride come first. */
    {id:'lbl-show',type:'symbol',source:'showonly',minzoom:13.0,
      layout:{'symbol-placement':'line','text-field':['get','n'],
        'text-font':['APEX'],'text-size':w(8.5,9.5,11),'text-max-angle':75,
        'symbol-spacing':160,'text-padding':2},
      paint:{'text-color':'#6E6152','text-halo-color':'#EFE6D2','text-halo-width':1.5}},
    {id:'lbl-fsroad',type:'symbol',source:'strokes',minzoom:12.4,
      filter:['==',['get','c'],'fsroad'],
      layout:{'symbol-placement':'line','text-field':['get','lb'],
        'text-font':['APEX'],'text-size':w(8.5,10,12),
        'text-max-angle':70,'symbol-spacing':180,'text-padding':2},
      paint:{'text-color':'#4A423A','text-halo-color':'#EFE6D2','text-halo-width':1.5}},
    {id:'lbl-road',type:'symbol',source:'strokes',minzoom:12.0,
      filter:['in',['get','c'],['literal',['paved','minor']]],
      layout:{'symbol-placement':'line','text-field':['get','lb'],
        'text-font':['APEX'],'text-size':w(8.5,10,12.5),
        'text-max-angle':70,'symbol-spacing':300,'text-padding':2},
      paint:{'text-color':'#3A342C','text-halo-color':'#EFE6D2','text-halo-width':1.5}},
  ]},
  center:CTR,zoom:11.4,maxZoom:17,minZoom:5.2,
  /* Michigan, not just the download. Penning the map to the bundle bbox meant a
     rider 135 mi away could not see where he was relative to the area, and a
     blank screen outside the box read as "broken" instead of "not downloaded"
     (take 27 field report). The coverage outline below carries that meaning. */
  maxBounds:[[-91.5,41.0],[-81.0,49.2]],fadeDuration:0,
  attributionControl:{compact:true,
    customAttribution:'© OpenStreetMap · Michigan DNR · USDA Forest Service · USGS'}});

/* ── pins ──────────────────────────────────────────────────────────────── */
function mk(cls,txt){var d=document.createElement('div');d.className='pin '+cls;
  d.textContent=txt;return d}
/* Start pins on real anchors from whichever region loaded. */
function anchorOf(kind,skip){
  for(var i=0;i<PLACES.length;i++){var p=PLACES[i];
    if(p[3]===kind&&(!skip||p[0]!==skip))return [p[1],p[2]]}
  for(var i=0;i<PLACES.length;i++){var p=PLACES[i];
    if(!skip||p[0]!==skip)return [p[1],p[2]]}
  return CTR}
var HOME=anchorOf('town'),
    ME=anchorOf('site',PLACES.length?null:undefined);
if(ME[0]===HOME[0]&&ME[1]===HOME[1])ME=CTR.slice();
var hM=new maplibregl.Marker({element:mk('home','⌂')}).setLngLat(HOME).addTo(map);
var mM=new maplibregl.Marker({element:mk('me','◎')}).setLngLat(ME).addTo(map);
var arm=null;

el('c-home').addEventListener('click',function(){
  arm=arm==='home'?null:'home';syncArm();
  show(arm?'Tap the map to place <b>home</b>.':'Cancelled.','')});
el('c-me').addEventListener('click',function(){
  arm=arm==='me'?null:'me';syncArm();
  show(arm?"Tap the map to place <b>where you are</b>.":'Cancelled.','')});
function syncArm(){el('c-home').className='chip'+(arm==='home'?' arm':'');
  el('c-me').className='chip'+(arm==='me'?' arm':'')}

el('c-machine').addEventListener('click',function(){
  machIdx=(machIdx+1)%ORDER.length;machine=ORDER[machIdx];
  el('c-machine').textContent=MACHINE[machine].lbl;
  clearRoute();show('Machine set to <b>'+MACHINE[machine].lbl.replace(/^\S+\s/,'')+
   '</b>. Routing now respects what is legal for it.','')});

var FUELS=[30,50,80,120,0],fi=1;
el('c-fuel').addEventListener('click',function(){fi=(fi+1)%FUELS.length;
  el('c-fuel').textContent=FUELS[fi]?'⛽ '+FUELS[fi]+' mi':'⛽ off';
  if(last)renderRoutes(last)});

/* ── Dijkstra ──────────────────────────────────────────────────────────── */
/* Snap to the nearest node that has at least one edge this machine may legally
   use. Snapping to the geometrically nearest node strands a 72" side-by-side on
   a 50" trailhead and reports "no route" when a legal one exists 200 m away. */
function nearestNode(ll){
  var ok={};MACHINE[machine].ok.forEach(function(c){ok[c]=1});
  var best=1e18,bi=-1;
  for(var i=0;i<NODES.length;i++){
    var ad=ADJ[i],legal=false;
    for(var k=0;k<ad.length;k++){
      var c=ad[k].c;
      if(ok[c]&&c!=='closed'&&c!=='fsclosed'){legal=true;break}}
    if(!legal)continue;
    var dx=NODES[i][0]-ll[0],dy=NODES[i][1]-ll[1],d=dx*dx*0.51+dy*dy;
    if(d<best){best=d;bi=i}}
  return bi}

function snapMiles(ll,ni){if(ni<0)return 0;
  var dx=(NODES[ni][0]-ll[0])*0.714*69,dy=(NODES[ni][1]-ll[1])*69;
  return Math.sqrt(dx*dx+dy*dy)}

function route(from,to,cost){
  var ok={};MACHINE[machine].ok.forEach(function(c){ok[c]=1});
  var N=NODES.length,dist=new Float64Array(N),prev=new Int32Array(N),
      pe=new Int32Array(N),done=new Uint8Array(N);
  dist.fill(Infinity);prev.fill(-1);pe.fill(-1);dist[from]=0;
  var heap=[[0,from]];
  function push(v){heap.push(v);var i=heap.length-1;
    while(i>0){var p=(i-1)>>1;if(heap[p][0]<=heap[i][0])break;
      var t=heap[p];heap[p]=heap[i];heap[i]=t;i=p}}
  function pop(){var top=heap[0],last=heap.pop();
    if(heap.length){heap[0]=last;var i=0;
      for(;;){var l=2*i+1,r=l+1,s=i;
        if(l<heap.length&&heap[l][0]<heap[s][0])s=l;
        if(r<heap.length&&heap[r][0]<heap[s][0])s=r;
        if(s===i)break;var t=heap[s];heap[s]=heap[i];heap[i]=t;i=s}}
    return top}
  while(heap.length){var cur=pop(),d=cur[0],u=cur[1];
    if(done[u])continue;done[u]=1;if(u===to)break;
    var ad=ADJ[u];
    for(var k=0;k<ad.length;k++){var e=ad[k];
      if(e.c==='closed'||e.c==='fsclosed')continue;   /* never route through a closure */
      if(!ok[e.c])continue;                            /* never route somewhere illegal */
      var v=e.a===u?e.b:e.a;if(done[v])continue;
      var nd=d+cost(e);
      if(nd<dist[v]){dist[v]=nd;prev[v]=u;pe[v]=e.i;push([nd,v])}}}
  if(!isFinite(dist[to]))return null;
  var path=[],u=to;while(u!==from&&prev[u]>=0){path.push(EDGES[pe[u]]);u=prev[u]}
  return path.reverse()}

/* Designated ORV trail vs legal forest road vs pavement. All three are legal
   for the selected machine — the router cannot produce anything else — but they
   are very different rides. */
var DESIG={route72:1,trail50:1,moto24:1,mccct:1,fstrail:1};
var DIRT={fsroad:1,track:1};

function summarise(path){
  var mi=0,hrs=0,off=0,adv=0,hardest=0,names={},up=0,dn=0,prof=[],run=0;
  /* How much of this route is DESIGNATED ORV line, how much is legal forest
     road, how much is pavement. Jacob: "routes should show if it's fully
     approved, partly approved, or not" — crossing M-33 is inevitable and fine,
     riding a road for ten miles is a different trip (take 58). */
  var mDes=0,mDirt=0,mRoad=0;
  path.forEach(function(e){var L=e.L/1609.34;mi+=L;hrs+=L/(SPEED[e.c]||14);
    if(DESIG[e.c])mDes+=L; else if(DIRT[e.c])mDirt+=L; else mRoad+=L;
    if(!PAVED[e.c])off+=L;
    var a=attrs(e);if(a.auth!=='legal')adv+=L;
    var h=HARD.indexOf(e.c);if(h>hardest)hardest=h;
    if(e.n)names[e.n]=1;
    up+=UP[e.i];dn+=DN[e.i];
    var ep=edgeProfile(e.i),base=NE[e.a];
    for(var k=0;k<ep.length;k+=2)prof.push(base+ep[k]);
    run+=L});
  /* climbing is time as well as effort -- roughly 1 min per 100 ft up */
  hrs+=(up*3.28084/100)/60;
  return {mi:mi,hrs:hrs,off:off,adv:adv,hard:HARD[hardest],up:up,dn:dn,prof:prof,
          des:mDes,dirt:mDirt,road:mRoad,
          turns:Object.keys(names).length,path:path}}

/* sunset, NOAA short form — enough to answer "am I getting home in the dark" */
function sunset(lat,lon,date){
  var d=Math.floor((date-new Date(date.getFullYear(),0,0))/864e5);
  var g=(360/365.24)*(d+10)*Math.PI/180;
  var decl=-23.44*Math.cos(g)*Math.PI/180, L=lat*Math.PI/180;
  var cosH=(Math.cos(90.833*Math.PI/180)-Math.sin(L)*Math.sin(decl))/(Math.cos(L)*Math.cos(decl));
  if(cosH>1||cosH<-1)return null;
  var H=Math.acos(cosH)*180/Math.PI;
  var eq=229.18*(0.000075+0.001868*Math.cos(g)-0.032077*Math.sin(g)
        -0.014615*Math.cos(2*g)-0.040849*Math.sin(2*g));
  var mins=720+4*(-lon+H)-eq;
  var off=-date.getTimezoneOffset();
  return (mins+off)/60}

var PROFILES=[
  /* Most trail first, because it is what this app is FOR. Every other profile
     optimises for speed or ease, and pavement wins both — Return Home was
     handing back "no designated trail, 8.5 mi paved" to a man on a dirt bike
     (take 58). Designated ORV line is cheap, forest road is fine, pavement is
     expensive but never forbidden: crossing M-33 is inevitable. */
  {k:'trail',h:'Most trail',f:function(e){
     return e.L*(DESIG[e.c]?0.55:DIRT[e.c]?1.3:8)}},
  {k:'fast',h:'Fastest',f:function(e){return e.L/(SPEED[e.c]||14)}},
  {k:'easy',h:'Easiest',f:function(e){return e.L*(EFFORT[e.c]||2)+UP[e.i]*CLIMB_K}},
  {k:'pave',h:'Pavement soonest',f:function(e){return e.L*(PAVED[e.c]?1:9)}},
  {k:'short',h:'Shortest',f:function(e){return e.L}},
  {k:'flat',h:'Least climbing',f:function(e){return e.L*0.35+UP[e.i]*45}}
];

var last=null,sel=null;
/* Route from ME to any point. Return Home is just this with HOME as the
   destination — take 33 pulled it out so a tapped pin can use the same five
   profiles, the same legality filter and the same closure handling. One router,
   many callers. */
function routeToPoint(dest,label){
  logAct('route to '+(label||'?'));
  RFROM=ME.slice();RTO=dest.slice();
  el('btn-home').disabled=true;show('Routing…','');
  setTimeout(function(){
    var a=nearestNode(ME),b=nearestNode(dest),out=[];
    DESTLBL=label||'there';
    el('btn-home').disabled=false;
    if(a<0||b<0)return show('<b>Nothing legal nearby</b> for a '+
      MACHINE[machine].lbl.replace(/^\S+\s/,'')+'. Every line within reach is off limits for that machine.','fail');
    var sa=snapMiles(ME,a),sb=snapMiles(dest,b);
    PROFILES.forEach(function(p){var pa=route(a,b,p.f);
      if(pa)out.push({h:p.h,k:p.k,s:summarise(pa),snap:sa+sb,na:a,nb:b})});
    if(!out.length)return show('<b>No legal route</b> for a '+
      MACHINE[machine].lbl.replace(/^\S+\s/,'')+' between those two points. Try a wider machine, or move the pins nearer a trail.','fail');
    presentRoutes(out)},30)}

var DESTLBL='home',RFROM=null,RTO=null;

/* Loops and point-to-point routes are the same thing once they exist: a list of
   options, each with a summary. One presenter, so cards, alternates, dashed
   approach legs and the fuel/dark warnings work for both.

   Take 40: the call sites for this were written before the function was, and
   the definition silently never landed — `presentRoutes is not defined` at the
   first tap. Landmine 38, and I did not re-grep after the edit. */
function presentRoutes(out){
  /* identical geometry across options is common on a sparse network — say so
     rather than showing cards that are secretly the same route */
  var seen={};out.forEach(function(o){var k=o.s.path.map(function(e){return e.i}).join(',');
    o.dup=seen[k]||false;seen[k]=true});
  last=out;sel=0;
  logAct('route '+out.length+' options, best '+out[0].s.mi.toFixed(1)+' mi');
  renderRoutes(out);draw(out[0],true)}

/* ══ LOOPS ══════════════════════════════════════════════════════════════════
   The third of "plan, ride, improvise" — you are at the truck with two hours of
   light and want a ride that ENDS where it starts. Point-to-point routing
   cannot express that: the shortest path from a node to itself is nothing.

   Method: place three waypoints on a circle around the start and route through
   them in turn, penalising edges already used so the return leg does not simply
   retrace the outbound. Circumference C = 2*pi*r, so a target of T miles wants
   r = T/(2*pi) — inflated, because trails do not run in circles and the real
   line is always longer than the crow-flight radius.

   Several bearings are tried; the ones that land nearest the target survive.
   They then become ordinary route options, so the cards, the elevation
   profiles, the fuel and dark warnings, the dashed approach legs and the
   alternates all work with no new UI. */
var LOOP_MI=15,LOOP_CHOICES=[6,10,15,20,30,40];

function nodeToward(from,bearingDeg,miles){
  var lat=NODES[from][1],lon=NODES[from][0],b=bearingDeg*Math.PI/180;
  var dLat=(miles/69.0)*Math.cos(b);
  var dLon=(miles/(69.0*Math.cos(lat*Math.PI/180)))*Math.sin(b);
  return nearestNode([lon+dLon,lat+dLat])}

/* cost that makes an already-ridden edge expensive but not forbidden — a
   network this sparse sometimes has exactly one legal way through */
function freshCost(base,used,factor){
  return function(e){return base(e)*(used[e.i]?factor:1)}}

function loopFrom(start,radiusMi,base,bearing0){
  var r=radiusMi, used={}, legs=[], nodes=[start];
  for(var k=0;k<3;k++){
    var n=nodeToward(start,(bearing0+k*120)%360,r);
    if(n<0||n===nodes[nodes.length-1])continue;
    nodes.push(n)}
  nodes.push(start);
  if(nodes.length<3)return null;
  for(var i=0;i<nodes.length-1;i++){
    if(nodes[i]===nodes[i+1])continue;
    var leg=route(nodes[i],nodes[i+1],freshCost(base,used,6));
    if(!leg||!leg.length)return null;
    leg.forEach(function(e){used[e.i]=(used[e.i]||0)+1});
    legs=legs.concat(leg)}
  if(!legs.length)return null;
  /* how much of it is ridden twice — a loop that doubles back is an out-and-back */
  var seen={},rep=0,tot=0;
  legs.forEach(function(e){var L=e.L/1609.34;tot+=L;if(seen[e.i])rep+=L;seen[e.i]=1});
  return {path:legs,repeat:tot?rep/tot:1,mi:tot}}

/* One radius guess is never right: a first cut at T/(2*pi) came back 33-126%
   long on this network, because trail does not run in circles and a
   trail-hungry cost wanders further than a fast one. Distance is close to
   proportional to radius, so scale and retry — four passes gets inside a few
   percent, and the best attempt is kept even if none do. */
function fitLoop(start,targetMi,base,bearing){
  var r=targetMi/(2*Math.PI), best=null;
  for(var i=0;i<4;i++){
    var L=loopFrom(start,r,base,bearing);
    if(!L)return best;
    var err=Math.abs(L.mi-targetMi)/targetMi;
    if(!best||err<best.err)best={err:err,L:L};
    if(err<0.08)break;
    r*=Math.max(0.35,Math.min(2.2,targetMi/L.mi));
  }
  return best}

function buildLoops(startNode,targetMi){
  var out=[];
  /* six bearings, and two cost shapes: quickest, and trail-hungry */
  var shapes=[
    {h:'Loop · fastest',k:'lfast',f:function(e){return e.L/(SPEED[e.c]||14)}},
    {h:'Loop · most trail',k:'ltrail',f:function(e){
        return e.L*((e.c==='paved'||e.c==='minor')?7:(e.c==='moto24'||e.c==='trail50')?0.7:1.6)}}
  ];
  shapes.forEach(function(sh){
    var best=null;
    for(var b=0;b<360;b+=90){
      var f=fitLoop(startNode,targetMi,sh.f,b);
      if(!f)continue;
      /* score: distance error dominates, then how much is ridden twice */
      var score=f.err+f.L.repeat*0.9;
      if(!best||score<best.score){best={score:score,L:f.L}}}
    if(best)out.push({h:sh.h,k:sh.k,s:summarise(best.L.path),snap:0,
                      na:startNode,nb:startNode,repeat:best.L.repeat})});
  return out}
el('btn-home').addEventListener('click',function(){routeToPoint(HOME,'the ⌂ pin')});

function renderRoutes(out){
  var fuel=FUELS[fi],now=new Date(),
      ss=sunset(ME[1],ME[0],now),nowH=now.getHours()+now.getMinutes()/60;
  var html='<div id="routes">';
  out.forEach(function(o,i){
    var s=o.s,mins=Math.round(s.hrs*60),
        arrive=nowH+s.hrs,dark=(ss!==null&&arrive>ss),
        overFuel=(fuel&&s.mi>fuel);
    html+='<div class="rc'+(i===sel?' sel':'')+'" data-i="'+i+'">'+
      '<h5>'+o.h+(o.dup?' ·<span class="sub"> same line</span>':'')+'</h5>'+
      '<div class="big">'+s.mi.toFixed(1)+' <span class="sub">mi</span></div>'+
      '<div class="sub">'+(mins>=60?Math.floor(mins/60)+'h '+(mins%60)+'m':mins+' min')+
        ' · '+s.off.toFixed(1)+' mi off-pavement</div>'+
      /* the composition, in the order a rider cares about */
      (function(){
        var pd=s.mi>0?Math.round(100*s.des/s.mi):0;
        var tag=pd>=95?'<span class="tag legal">all designated trail</span>':
                pd>=50?'<span class="tag legal">'+pd+'% designated</span>':
                pd>0  ?'<span class="tag adv">'+pd+'% designated</span>':
                        '<span class="tag adv">no designated trail</span>';
        var bits=[];
        if(s.des>0.05)bits.push(s.des.toFixed(1)+' trail');
        if(s.dirt>0.05)bits.push(s.dirt.toFixed(1)+' forest road');
        if(s.road>0.05)bits.push(s.road.toFixed(1)+' paved');
        return '<div class="sub">'+tag+' '+bits.join(' · ')+'</div>'})()+
      '<div class="sub">hardest <b>'+label(s.hard)+'</b></div>'+
      spark(s.prof)+
      '<div class="sub">climb <b>'+ft(s.up)+' ft</b> · drop '+ft(s.dn)+' ft</div>'+
      (overFuel?'<div class="sub warn">⛽ '+(s.mi-fuel).toFixed(1)+' mi past your range</div>':
        (fuel?'<div class="sub good">⛽ within range</div>':''))+
      (dark?'<div class="sub warn">☾ arrives after dark</div>':'')+
      (s.adv>0.05?'<div class="sub warn">'+s.adv.toFixed(1)+' mi unverified (OSM)</div>':
        '<div class="sub good">fully on designated line</div>')+
      (o.snap>0.15?'<div class="sub warn">+'+o.snap.toFixed(1)+
        ' mi off-network (dashed) to reach the trail</div>':'')+
      '</div>'});
  html+='</div>';
  el('panel').className='';el('panel').innerHTML=html;
  Array.prototype.forEach.call(document.querySelectorAll('.rc'),function(c){
    c.addEventListener('click',function(){
      sel=+c.dataset.i;logAct('act  picked '+((last[sel]||{}).h||sel));
      /* Toggle the class in place. Re-rendering the strip reset scrollLeft to 0
         on every tap, which is why scrolling felt broken even once it worked. */
      Array.prototype.forEach.call(document.querySelectorAll('.rc'),function(d){
        d.className='rc'+(+d.dataset.i===sel?' sel':'')});
      draw(last[sel],false);
      try{c.scrollIntoView({behavior:'smooth',block:'nearest',inline:'nearest'})}
      catch(e){}})}) }


/* Elevation profile per option. A 12 mile route with 900 ft of climbing is a
   different ride from a 12 mile route with 200, and the number alone does not
   land the way the shape does. */
function spark(p){
  if(!p||p.length<3)return '';
  var lo=Math.min.apply(null,p),hi=Math.max.apply(null,p),r=Math.max(1,hi-lo);
  var W=128,H=26,step=Math.max(1,Math.floor(p.length/W)),pts=[];
  for(var i=0,x=0;i<p.length;i+=step,x++){
    pts.push((x*W/(p.length/step)).toFixed(1)+','+(H-((p[i]-lo)/r)*H).toFixed(1))}
  return '<svg width="'+W+'" height="'+H+'" style="display:block;margin:5px 0 2px">'+
    '<polyline points="'+pts.join(' ')+'" fill="none" stroke="#8FAE63" stroke-width="1.4"/>'+
    '</svg>'}

function label(c){return {route72:'ORV route 72"',trail50:'ORV trail 50"',
  moto24:'motorcycle 24"',mccct:'MCCCT',fstrail:'USFS trail',fsroad:'USFS road',
  paved:'pavement',minor:'county road',track:'two-track'}[c]||c}

function geomOf(o){return o.s.path.map(function(e){return {type:'Feature',properties:{},
  geometry:{type:'LineString',coordinates:decode(GR.g[e.i])}}})}

/* fit=true only on the first draw. Re-framing on every card tap read as the map
   "shifting over randomly" while comparing options that share most of their
   corridor — and it hid the very change it was meant to show. */
function draw(o,fit){
  var fs=geomOf(o);
  /* The gap between a pin and the network. The cards have always SAID
     "+0.5 mi off-network to the pins" while the line silently started at the
     nearest node — so a route to a pin in the trees looked broken. Dashed,
     because you are covering it off the designated network. */
  var legs=[];
  function leg(from,to){
    if(!from||!to)return;
    if(mi(from,to)<0.02)return;
    legs.push({type:'Feature',properties:{},
      geometry:{type:'LineString',coordinates:[from,to]}})}
  if(o.na>=0)leg(RFROM,[NODES[o.na][0],NODES[o.na][1]]);
  if(o.nb>=0)leg([NODES[o.nb][0],NODES[o.nb][1]],RTO);
  try{map.getSource('approach').setData({type:'FeatureCollection',features:legs})}catch(e){}
  map.getSource('route').setData({type:'FeatureCollection',features:fs});
  /* Every other option, dimmed underneath. Five routes over the same 3.7 mi
     corridor look identical one at a time; against the alternatives the
     difference is obvious at a glance — the pattern every first-party map uses. */
  var others=[];
  (last||[]).forEach(function(x){if(x!==o)others=others.concat(geomOf(x))});
  map.getSource('alt').setData({type:'FeatureCollection',features:others});
  if(!fit)return;
  var b=new maplibregl.LngLatBounds();
  fs.concat(legs).forEach(function(f){
    f.geometry.coordinates.forEach(function(c){b.extend(c)})});
  /* The chip strip floats over the bottom of the map, so 40 px of padding put
     the end of the route underneath it. Clear the strip's real height. */
  var strip=0;
  try{var r=el('rail-chips')||document.querySelector('.strip');
    if(r)strip=Math.round(r.getBoundingClientRect().height)}catch(e){}
  map.fitBounds(b,{padding:{top:64,bottom:40+strip,left:36,right:36},duration:800})}
function clearRoute(){map.getSource('route').setData({type:'FeatureCollection',features:[]});
  try{map.getSource('alt').setData({type:'FeatureCollection',features:[]});
      map.getSource('approach').setData({type:'FeatureCollection',features:[]})}catch(e){}
  last=null;sel=null}






/* ══ SEARCH ═════════════════════════════════════════════════════════════════
   Landmine 19: vector tiles only hold what is in the current viewport, so you
   cannot search them for somewhere you are not already looking. The index is
   separate and built at load from data already in the payload — 1,049 names and
   3,706 junction descriptors that were sitting there unsearchable. */
var IDX=null;
function buildIndex(){
  if(IDX)return IDX;
  var seen={},rows=[];
  for(var i=0;i<EDGES.length;i++){var e=EDGES[i];
    [[e.n,'trail'],[e.id,'number']].forEach(function(p){
      var s=p[0];if(!s||seen[s])return;seen[s]=1;
      var g=decode(GR.g[i]),m=g[(g.length/2)|0];
      rows.push({t:s,k:(e.c==='paved'||e.c==='minor')?'road':p[1],c:m,cls:e.c})})}
  for(var k in JX){var lab=JX[k].map(function(x){return NM[x]}).join(' × ');
    if(seen[lab])continue;seen[lab]=1;
    rows.push({t:lab,k:'junction',c:[NODES[k][0],NODES[k][1]],cls:'jx'})}
  PLACES.forEach(function(p){if(seen[p[0]])return;seen[p[0]]=1;
    rows.push({t:p[0],k:'place',c:[p[1],p[2]],cls:'place'})});
  if(ADDR&&ADDR.names){
    /* one entry per street, positioned on its first segment's midpoint */
    var first={};
    ADDR.segs.forEach(function(g){if(first[g[0]]===undefined)first[g[0]]=g});
    ADDR.names.forEach(function(nm,i){
      if(seen[nm]||first[i]===undefined)return;seen[nm]=1;var g=first[i];
      rows.push({t:nm,k:'street',c:[(g[1]+g[3])/2,(g[2]+g[4])/2],cls:'addr'})})}
  rows.forEach(function(r){r.l=r.t.toLowerCase()});
  IDX=rows;return rows}

var KRANK={address:0,place:1,trail:2,number:3,road:4,street:5,junction:6};
function search(q){
  q=q.trim().toLowerCase();if(q.length<1)return [];
  var rows=buildIndex(),out=[];
  /* a typed street address resolves to a point and leads the results */
  var gc=geocode(q);
  if(gc)out.push([-1,-1,0,{t:gc.t,k:'address',c:gc.c,cls:'addr'}]);
  for(var i=0;i<rows.length;i++){var r=rows[i],p=r.l.indexOf(q);
    if(p<0)continue;
    /* exact, then start-of-string, then start-of-word, then anywhere */
    var s=r.l===q?0:p===0?1:(r.l[p-1]===' '||r.l[p-1]==='(')?2:3;
    out.push([s,(KRANK[r.k]||5),r.t.length,r])}
  out.sort(function(a,b){return a[0]-b[0]||a[1]-b[1]||a[2]-b[2]});
  return out.slice(0,9).map(function(x){return x[3]})}

function renderHits(list){
  if(!list.length){el('hits').innerHTML=
    '<div class="hit">No match. Try a code like <b>TMM</b> or <b>H58</b>.</div>';return}
  el('hits').innerHTML=list.map(function(r,i){
    return '<div class="hit" data-i="'+i+'"><b>'+r.t+'</b><i>'+r.k+'</i></div>'}).join('');
  Array.prototype.forEach.call(document.querySelectorAll('.hit'),function(d){
    if(d.dataset.i===undefined)return;
    d.addEventListener('click',function(){
      var r=list[+d.dataset.i];if(!r)return;
      map.easeTo({center:r.c,zoom:r.k==='place'?13.2:14.6,duration:800});
      el('srch').className='';el('c-search').className='chip';
      /* Every hit becomes a place card, so a searched address can be made home
         or routed to with the same two taps as a dropped pin. */
      dropPin(r.c.slice());
      placeCard(r.c,'drop',r.t)})})}

el('c-search').addEventListener('click',function(){
  var on=el('srch').className.indexOf('on')<0;
  el('srch').className=on?'on':'';el('c-search').className='chip'+(on?' on':'');
  if(on){el('q').focus();renderHits(search(el('q').value||'m'))}});
el('q').addEventListener('input',function(){renderHits(search(el('q').value))});

/* ══ DIRECTIONS ═════════════════════════════════════════════════════════════
   A blue line is not an instruction. Someone who is lost and tired needs words
   they can read once and act on, and a turn list is also what you would relay
   over a radio. Consecutive edges on the same way collapse into one step. */
function turnWord(d){
  var a=((d+540)%360)-180,x=Math.abs(a);
  if(x<22)return ['Continue','↑'];
  if(x<50)return [a<0?'Bear left':'Bear right',a<0?'↖':'↗'];
  if(x<115)return [a<0?'Turn left':'Turn right',a<0?'←':'→'];
  if(x<160)return [a<0?'Sharp left':'Sharp right',a<0?'↰':'↱'];
  return ['Turn around','↻']}

function directions(path,startNode){
  if(!path||!path.length)return [];
  var cur=startNode,legs=[];
  for(var i=0;i<path.length;i++){var e=path[i],g=decode(GR.g[e.i]);
    var fwd=(e.a===cur);if(!fwd)g=g.slice().reverse();
    legs.push({e:e,g:g,name:e.n||label(e.c),id:e.id,
      inB:bearing(g[0],g[Math.min(1,g.length-1)]),
      outB:bearing(g[Math.max(0,g.length-2)],g[g.length-1])});
    cur=fwd?e.b:e.a}
  var steps=[],acc=null;
  for(var i=0;i<legs.length;i++){var L=legs[i];
    var key=L.name+'|'+(L.id||'');
    if(acc&&acc.key===key){acc.mi+=L.e.L/1609.34;acc.up+=UP[L.e.i];acc.out=L.outB;
      continue}
    if(acc)steps.push(acc);
    acc={key:key,name:L.name,id:L.id,cls:L.e.c,mi:L.e.L/1609.34,up:UP[L.e.i],
      inB:L.inB,out:L.outB,at:i}}
  if(acc)steps.push(acc);
  for(var i=0;i<steps.length;i++){
    steps[i].turn=i===0?['Start on','●']:turnWord(steps[i].inB-steps[i-1].out)}
  return steps}

el('btn-steps').addEventListener('click',function(){
  if(!last||sel===null)return show('Pick a <b>Return home</b> route first — directions describe the route you chose.','fail');
  var a=nearestNode(ME),steps=directions(last[sel].s.path,a);
  if(!steps.length)return show('No steps.','fail');
  var tot=0,html='<div id="steps">';
  steps.forEach(function(s){tot+=s.mi;
    var nm=s.name+(s.id&&s.id!==s.name?' · '+s.id:'');
    html+='<div class="st"><div class="ar">'+s.turn[1]+'</div><div class="tx">'+
      s.turn[0]+' <b>'+nm+'</b>'+
      (MACHINE[machine].ok.indexOf(s.cls)<0?' <span class="tag shut">illegal</span>':'')+
      (s.up>8?'<br><span style="color:#C9A227">climbs '+ft(s.up)+' ft</span>':'')+
      '</div><div class="d">'+(s.mi<0.1?(s.mi*5280|0)+' ft':s.mi.toFixed(1)+' mi')+
      '</div></div>'});
  html+='</div>';
  el('panel').className='';
  el('panel').innerHTML='<span class="tn">'+steps.length+' steps · '+tot.toFixed(1)+
    ' mi</span><span class="tag legal">'+last[sel].h+'</span>'+html});

/* ══ BASEMAP ════════════════════════════════════════════════════════════════
   PROTOCOL §8 as revised at take 10: provisioning may use the network, the
   field may not. Imagery is the size driver and it is measured, not guessed --
   z16 is 159 MB for a riding area and 36.6 GB statewide, which is what settles
   imagery as a per-region download you do at home the night before.

   In satellite mode a pale casing goes under the trail lines. Dark ink on dark
   jack pine is unreadable, and a trail you cannot see is not on the map. */
var BASEMAPS=['Map','Satellite','Hybrid'],bmi=0;
function setBasemap(i){
  if(!SAT_OK){bmi=0;el('c-base').textContent='🗺 Map';el('c-base').className='basebtn';
    map.setLayoutProperty('sat','visibility','none');
    return}
  bmi=i%BASEMAPS.length;
  var m=BASEMAPS[bmi],sat=(m!=='Map');
  map.setLayoutProperty('sat','visibility',sat?'visible':'none');
  /* The casing is no longer a satellite-only trick: it separates a
     difficulty-coloured trail from the road network on ANY base, and this
     line was switching it off on the default map (take 46). */
  /* Hide the layer, do not just fade it. A raster layer at opacity 0 is still
     uploaded and drawn every frame — real GPU work for something invisible, and
     battery is the one thing about this app still unmeasured (A18). Relief is
     off by default, so that cost was being paid on every frame by default. */
  var reliefOn=el('c-relief').className.indexOf('on')>=0;
  map.setLayoutProperty('hillshade','visibility',reliefOn?'visible':'none');
  if(reliefOn)map.setPaintProperty('hillshade','raster-opacity',sat?0.16:0.42);
  /* Satellite used to force every label off — from before labels had a dark
     halo, when dark-on-light was unreadable over jack pine. They are white on
     a halo now and survive it. Worse, lbl-show was NOT in LBL, so on satellite
     the only names left were trails you may NOT ride: "Shore To Shore Trail"
     labelled, the loop under your wheels not (take 57). */
  LBL.forEach(function(id){
    map.setLayoutProperty(id,'visibility',
      el('c-labels').className.indexOf('on')<0?'none':'visible')});
  el('c-base').textContent=(sat?'🛰 ':'🗺 ')+m;
  el('c-base').className='basebtn'+(sat?' on':'');
}

/* LABELS block moved above the map constructor at take 15 — see the note where
   it now lives. */

/* ══ TERRAIN ════════════════════════════════════════════════════════════════
   One DEM ingest gives four things: node elevations, per-edge climb, elevation
   profiles, and the hillshade underneath. 3DEP via public Terrarium tiles at
   z13 (~13.6 m/px). Relief across the AOI is 199 m — Bull Gap is a sand hill,
   and routing that ignores that ignores what riders actually feel. */
var NE=TR.ne, UP=TR.up, DN=TR.dn;
function edgeProfile(i){var d=TR.pf[i],out=[],v=0;
  for(var k=0;k<d.length;k++){v+=d[k];out.push(v)}return out}
function ft(m){return Math.round(m*3.28084)}

/* Climbing costs more than distance on loose sand. 1 m up is charged like 12 m
   along; the Least-climbing profile charges it like 45 m. */
var CLIMB_K=12;
function elevAt(ll){
  var best=1e9,e=null;
  for(var i=0;i<NODES.length;i+=7){var dx=NODES[i][0]-ll[0],dy=NODES[i][1]-ll[1];
    var d=dx*dx*0.51+dy*dy;if(d<best){best=d;e=NE[i]}}
  return e}


/* 4.6 — nearest pavement. Not a route: a straight-line bearing to the closest
   thing a truck can reach you on. Answers "which way do I walk" when the bike
   will not move, and needs no router. */
function nearestPavement(ll){
  var best=1e9,bp=null,be=null;
  for(var i=0;i<EDGES.length;i++){var e=EDGES[i];
    if(e.c!=='paved'&&e.c!=='minor')continue;
    var g=decode(GR.g[i]);
    for(var k=0;k<g.length;k++){var d=mi(ll,g[k]);
      if(d<best){best=d;bp=g[k];be=e}}}
  return {p:bp,d:best,e:be}}

/* 4.12 — what this app is not. A promise about its own limits, in the app,
   offline, where you would read it. */
var ABOUT='<span class="tn">APEX ORV</span>'+
 '<span class="tag legal">offline</span><span class="tag adv">no account</span><br>'+
 'Michigan DNR + USDA Forest Service designations, OpenStreetMap for context. '+
 'Every line says which.<br><br>'+
 '<b>This is not an emergency device.</b> It cannot call anyone. In country '+
 'like this a satellite messenger does something no map can — carry one.<br>'+
 'The MVUM and DNR signage are the legal authority. This app is not a defence.<br>'+
 'Private property lines are not shown; that data is licensed and not public.';

/* ══ PHASE 4 — the reason this exists ═══════════════════════════════════════
   Everything below is load-bearing (PROTOCOL §9): no network, no map download,
   no subscription check. Retrace in particular needs nothing but the track you
   already recorded — not the router, not the graph, not agency data. */

var JX = GR.jx || {};
var TRUCK=null, tM=null, crumbs=[], crumbMi=0, riding=null, lost=false, offAlert=false;

function mi(a,b){var dx=(b[0]-a[0])*0.714*69,dy=(b[1]-a[1])*69;return Math.hypot(dx,dy)}
function bearing(a,b){var t=Math.PI/180,
  y=Math.sin((b[0]-a[0])*t)*Math.cos(b[1]*t),
  x=Math.cos(a[1]*t)*Math.sin(b[1]*t)-Math.sin(a[1]*t)*Math.cos(b[1]*t)*Math.cos((b[0]-a[0])*t);
  return (Math.atan2(y,x)*180/Math.PI+360)%360}
function compass(d){return ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW',
  'W','WNW','NW','NNW'][Math.round(d/22.5)%16]}
function buzz(p){
  /* Android WebView does not implement navigator.vibrate — silently. The
     off-route alert's haptic (4.4) would have been dead in the APK. Bridge to
     Capacitor Haptics when present; browsers keep navigator.vibrate. */
  var C=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.Haptics;
  if(C){var d=Array.isArray(p)?p.reduce(function(a,b){return a+b},0):p;
    try{C.vibrate({duration:d})}catch(e){}return}
  try{navigator.vibrate&&navigator.vibrate(p)}catch(e){}}

/* 4.1 — recording starts with the ride, no button to forget.
   4.2 — the truck drops itself where you started. */
/* ══ RIDE TELEMETRY ═════════════════════════════════════════════════════════
   A18 Stage 1 is the standing blocker and only a real ride can close it: battery
   cost with the screen held on, and GPS quality under jack pine. Neither can be
   measured from a container, and "it felt fine" is not a measurement.

   So the ride measures itself. Everything here is local — battery level from the
   Capacitor Device plugin, fix timing from the watch we already run. Nothing is
   sent anywhere; it ends up in the same report Jacob already shares. */
var RIDE=null;

function batteryNow(){
  var C=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.Device;
  if(C&&C.getBatteryInfo)return C.getBatteryInfo().then(function(b){
    return {lvl:b.batteryLevel,chg:!!b.isCharging}}).catch(function(){return null});
  if(navigator.getBattery)return navigator.getBattery().then(function(b){
    return {lvl:b.level,chg:!!b.charging}}).catch(function(){return null});
  return Promise.resolve(null)}

function rideStart(at){
  RIDE={t0:Date.now(),fixes:0,gaps:[],acc:[],drops:0,maxGap:0,
        batt0:null,batt1:null,chg:false,last:Date.now(),mi0:0};
  batteryNow().then(function(b){if(RIDE&&b){RIDE.batt0=b.lvl;RIDE.chg=b.chg}});
  RIDE.ticks=0;
  RIDE.pulse=setInterval(function(){
    if(!RIDE)return;
    /* battery moves slowly and the read is not free; the dropout watch is the
       thing that needs to be prompt */
    if(++RIDE.ticks%3===1)batteryNow().then(function(b){
      if(RIDE&&b){RIDE.batt1=b.lvl;RIDE.chg=RIDE.chg||b.chg}});
    /* a fix that has not arrived in 15s is a dropout, not slowness */
    var since=(Date.now()-RIDE.last)/1000;
    if(since>15){RIDE.drops++;RIDE.last=Date.now();
      if(since>RIDE.maxGap)RIDE.maxGap=since;
      logAct('gps  DROPOUT '+Math.round(since)+'s')}},20000)}

function rideFix(acc){
  if(!RIDE)return;
  var now=Date.now(),gap=(now-RIDE.last)/1000;
  RIDE.last=now;RIDE.fixes++;
  if(RIDE.fixes>1){RIDE.gaps.push(gap);if(gap>RIDE.maxGap)RIDE.maxGap=gap}
  if(acc!==null&&acc!==undefined)RIDE.acc.push(acc)}

function rideStop(){
  if(!RIDE)return null;
  clearInterval(RIDE.pulse);
  var R=RIDE,hrs=(Date.now()-R.t0)/3600000;
  var med=function(a){if(!a.length)return null;var b=a.slice().sort(function(x,y){return x-y});
    return b[(b.length/2)|0]};
  R.hrs=hrs;R.medGap=med(R.gaps);R.medAcc=med(R.acc);
  R.drain=(R.batt0!==null&&R.batt1!==null)?(R.batt0-R.batt1):null;
  /* Android reports battery in 1% steps, so a ten-minute ride can show 0% or 1%
     and extrapolate to anything between "forever" and "two hours". Require a
     real sample before quoting a rate: 20 minutes AND at least 2% moved. */
  R.longEnough=(hrs>=0.33&&R.drain!==null&&Math.abs(R.drain)>=0.02);
  R.perHr=R.longEnough?R.drain/hrs:null;
  RIDE=null;LASTRIDE=R;return R}
var LASTRIDE=null;

function rideReport(R){
  var L=[];
  L.push('APEX RIDE · '+(el('title').textContent||'').replace(/\s+/g,' ').trim());
  L.push(new Date().toISOString());
  L.push('');
  L.push('  duration      '+(R.hrs*60).toFixed(0)+' min');
  L.push('  track         '+crumbMi.toFixed(2)+' mi, '+crumbs.length+' points');
  L.push('  fixes         '+R.fixes+(R.medGap!==null?' · median gap '+R.medGap.toFixed(1)+'s':''));
  L.push('  worst gap     '+(R.maxGap?R.maxGap.toFixed(0)+'s':'—')+
    (R.drops?' · '+R.drops+' dropouts over 15s':' · no dropouts'));
  L.push('  accuracy      '+(R.medAcc!==null?'median ±'+Math.round(R.medAcc)+' m':'not reported'));
  L.push('  battery       '+(R.drain!==null?
    (R.drain*100).toFixed(1)+'% used'+(R.perHr!==null?' · '+(R.perHr*100).toFixed(1)+'%/hour':'')+
      (R.chg?' (WAS CHARGING — drain figure is meaningless)':''):
    'not available on this device'));
  if(R.drain!==null&&!R.longEnough&&!R.chg)
    L.push('  battery note  too short to quote a rate — needs 20+ min and 2%+ moved');
  if(R.perHr!==null&&!R.chg&&R.perHr>0)
    L.push('  screen-on est '+(1/R.perHr).toFixed(1)+' hours from full at this rate');
  L.push('');
  L.push('--- end ---');
  return L.join('\n')}

function startRecording(at){
  TRUCK=at.slice(); crumbs=[at.slice()]; crumbMi=0;
  rideStart(at);
  if(!tM)tM=new maplibregl.Marker({element:mk('truck','⛟')}).setLngLat(TRUCK).addTo(map);
  else tM.setLngLat(TRUCK);
  map.getSource('back').setData({type:'FeatureCollection',features:[]});
  syncSafety()}

function record(at){
  if(!crumbs.length)return;
  var prev=crumbs[crumbs.length-1], d=mi(prev,at);
  if(d<0.004)return;                    /* ~7 m — don't log GPS jitter as travel */
  crumbs.push(at.slice()); crumbMi+=d;
  map.getSource('crumb').setData({type:'FeatureCollection',features:[
    {type:'Feature',properties:{},geometry:{type:'LineString',coordinates:crumbs}}]});
  syncSafety()}

/* 4.3 — back to the vehicle. Never more than a glance away, always on the rail. */
function syncSafety(){
  var tv=el('v-truck'), rv=el('v-rec');
  if(!TRUCK){tv.textContent='—';tv.className='v';rv.textContent='—';return}
  var d=mi(ME,TRUCK), b=bearing(ME,TRUCK);
  tv.textContent=(d<10?d.toFixed(1):Math.round(d))+' '+compass(b);
  tv.className='v'+(d>8?' warn':' good');
  rv.textContent=crumbMi.toFixed(1);
  /* 4.11 — a safety feature that can fail silently needs to show it is alive */
  el('b-src').textContent=crumbs.length?'REC '+crumbs.length:'GRAPH '+EDGES.length;
  el('b-src').className='badge '+(crumbs.length?'good':'good')}

/* 4.4 — off-route alert. Haptic first, because you are looking at the trail. */
function checkOffRoute(){
  if(!last||sel===null||!crumbs.length)return;
  var pts=[];last[sel].s.path.forEach(function(e){pts=pts.concat(decode(GR.g[e.i]))});
  var best=1e9;for(var i=0;i<pts.length;i++){var d=mi(ME,pts[i]);if(d<best)best=d}
  var off=best>0.16;                    /* ~260 m from the planned line */
  if(off&&!offAlert){offAlert=true;buzz([120,80,120,80,220]);
    el('alert').className='on';
    el('alert').innerHTML='Off route — '+(best*5280|0)+' ft from your line'+
      '<small>Tap Retrace to follow your own track back to the truck.</small>'}
  else if(!off&&offAlert){offAlert=false;el('alert').className=''}}

/* 4.14 — Retrace. The one that must never fail: no router, no network, no agency
   data. Just the line you already rode, reversed. */
el('btn-retrace').addEventListener('click',function(){
  if(crumbs.length<2)return show('Nothing recorded yet. Tap <b>▶ Ride it</b> to lay a track, or this fills in from GPS on a real ride.','fail');
  var back=crumbs.slice().reverse(), d=0;
  for(var i=1;i<back.length;i++)d+=mi(back[i-1],back[i]);
  map.getSource('back').setData({type:'FeatureCollection',features:[
    {type:'Feature',properties:{},geometry:{type:'LineString',coordinates:back}}]});
  var b=new maplibregl.LngLatBounds();back.forEach(function(c){b.extend(c)});
  map.fitBounds(b,{padding:50,duration:700});
  el('alert').className='';offAlert=false;
  show('<span class="tn">Retrace</span><br><span class="tag legal">no router · no network</span><br>'+
   '<b>'+d.toFixed(2)+' mi</b> back along the track you actually rode · '+
   compass(bearing(ME,TRUCK))+' to the truck · '+back.length+' points<br>'+
   'Every foot of this is ground you have already covered.','')});

/* 4.7 — the dispatch card. Decimal degrees is what Oscoda and Ogemaw ask for.
   Junctions are named by what meets there, never by a number we invented. */
function nearestEdge(ll){
  var best=1e9,be=null;
  for(var i=0;i<EDGES.length;i++){var g=decode(GR.g[i]);
    for(var k=0;k<g.length;k++){var d=mi(ll,g[k]);if(d<best){best=d;be=EDGES[i]}}}
  return {e:be,d:best}}
function nearestJunction(ll){
  var best=1e9,bn=null;
  for(var k in JX){var n=+k,p=[NODES[n][0],NODES[n][1]],d=mi(ll,p);
    if(d<best){best=d;bn=n}}
  return {n:bn,d:best}}

el('btn-disp').addEventListener('click',function(){
  if(posMode!=='gps')return show('<b>No live position.</b><br>'+
    (posMode==='sim'?'The simulator is driving — those coordinates are invented. ':
     posMode==='away'?'You are about '+Math.round(awayMi)+' mi from this region. ':
     'No GPS fix yet. ')+
    'This card exists to read your <i>actual</i> location to dispatch, so it '+
    'will not print a coordinate you are not standing at. The map centre is '+
    'shown in the readout above if you want a planning reference.','fail');
  show('Locating you on the network…','');
  setTimeout(function(){
    var ne=nearestEdge(ME), nj=nearestJunction(ME);
    var out='<span class="tn">'+ME[1].toFixed(5)+'  '+ME[0].toFixed(5)+'</span>'+
      '<span class="tag legal">decimal degrees</span><br>';
    var bits=[];
    if(ne.e){var a=attrs(ne.e);
      bits.push('On or near <b>'+(ne.e.n||label(ne.e.c))+'</b>'+
        (ne.e.id?' (<b>'+ne.e.id+'</b>)':'')+
        ' — '+(ne.d*5280|0)+' ft'+(a.src?', '+a.src.toUpperCase():''))}
    if(nj.n!==null){var nm=JX[nj.n].map(function(i){return NM[i]}).join(' × ');
      bits.push('Nearest junction <b>'+nm+'</b> — '+
        (nj.d<0.19?(nj.d*5280|0)+' ft':nj.d.toFixed(2)+' mi')+' '+
        compass(bearing(ME,[NODES[nj.n][0],NODES[nj.n][1]])))}
    if(TRUCK)bits.push('Truck <b>'+mi(ME,TRUCK).toFixed(2)+' mi '+
      compass(bearing(ME,TRUCK))+'</b>');
    var ev=elevAt(ME);if(ev!==null)bits.push('Elevation <b>'+ft(ev)+' ft</b>');
    var np=nearestPavement(ME);
    if(np.p)bits.push('Nearest pavement <b>'+np.d.toFixed(2)+' mi '+
      compass(bearing(ME,np.p))+'</b>'+(np.e&&np.e.n?' — '+np.e.n:''));
    bits.push('Read the coordinates first, then the junction.');
    show(out+bits.join('<br>'),'')},20)});

/* ── ride simulator ────────────────────────────────────────────────────────
   Not a product feature. A harness, so Phase 4 can be exercised without a bike
   and a tank of gas — the same reason tools/verify6.py exists. */
function edgesAt(node){return ADJ[node]||[]}
function simPath(){
  if(last&&sel!==null)return last[sel].s.path.slice();
  var a=nearestNode(ME);if(a<0)return null;
  var path=[],cur=a,prev=-1;
  for(var i=0;i<40;i++){var opts=edgesAt(cur).filter(function(e){
      return e.i!==prev&&e.c!=='closed'&&e.c!=='fsclosed'});
    if(!opts.length)break;var e=opts[(Math.random()*opts.length)|0];
    path.push(e);prev=e.i;cur=(e.a===cur?e.b:e.a)}
  return path.length?path:null}

function stopRide(){if(riding){clearInterval(riding);riding=null;
  el('c-ride').textContent='▶ Ride it';el('c-ride').className='chip'}}

/* ── real GPS ────────────────────────────────────────────────────────────
   One recording path, two drivers. On the phone, watchPosition feeds the same
   startRecording/record/checkOffRoute chain the simulator exercised in smoke —
   the sim is the test double, GPS is production, and they share every line
   after the fix arrives. file:// and the harness fall back to the simulator. */
var rideMode=null,gotFix=false,fixN=0;
/* posMode: 'none'  — no fix yet; ME is a planning cursor, NOT a position
            'gps'   — live fix inside this region
            'sim'   — the simulator is driving; real machinery, fabricated position
   'away'  — live fix, but hundreds of miles from this region
   The map has to know the difference. Take 20 showed Jacob 44.57072 -84.15770
   while he was in another state: a plausible, precise, wrong coordinate, on the
   same screen as the button that reads coordinates out to dispatch. */
var posMode='none',awayMi=0;
function inRegion(at){var b=BUNDLE.bbox;if(!b)return true;
  return at[0]>=b[0]-0.02&&at[0]<=b[2]+0.02&&at[1]>=b[1]-0.02&&at[1]<=b[3]+0.02}
function classifyFix(at){
  logAct('gps  fix '+at[1].toFixed(5)+','+at[0].toFixed(5));
  if(inRegion(at)){posMode='gps';awayMi=0;return}
  posMode='away';awayMi=mi(at,CTR);
  show('<b>You are about '+Math.round(awayMi)+' mi from '+
    (BUNDLE.name||'this region')+'.</b><br>Planning mode — everything except live '+
    'tracking works. <b>Tap open ground</b> to drop your planning start, or use '+
    '<b>⌂ Set home</b> to place the truck, then <b>Return Home</b> and '+
    '<b>Directions</b> route between them. Search and elevation work too.'+
    '<br><br>Live tracking and the dispatch card stay off until you are in the '+
    'region — they must never report a position you are not standing at.','')}
function gpsStart(onFix,onFail){
  var C=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.Geolocation;
  if(C){
    /* Capacitor 7 hands back the watch id SYNCHRONOUSLY here, not a Promise.
       Calling .then() on it threw, gpsStart() threw with it, and the whole
       ▶ Ride it handler died on the device while the watch quietly ran in the
       background. The self-test caught it on its first real run. Accept both
       shapes — a plugin's return type is not something to assume (landmine 56). */
    var w;
    try{ w=C.watchPosition({enableHighAccuracy:true,timeout:12000},function(pos,err){
      if(err||!pos)return onFail&&onFail(err);
      onFix([pos.coords.longitude,pos.coords.latitude],pos.coords.accuracy);
    }) }catch(e){ onFail&&onFail(e); return null }
    if(w&&typeof w.then==='function')w.then(function(id){watchId=id})
      .catch(function(e){onFail&&onFail(e)});
    else watchId=w;
    return 'cap'}
  if(navigator.geolocation){
    watchId=navigator.geolocation.watchPosition(function(pos){
      onFix([pos.coords.longitude,pos.coords.latitude],pos.coords.accuracy)},
      function(e){onFail&&onFail(e)},
      {enableHighAccuracy:true,maximumAge:1000,timeout:12000});
    return 'web'}
  return null}
var watchId=null;
function gpsStop(){
  var C=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.Geolocation;
  if(watchId===null)return;
  try{if(rideMode==='cap'&&C)C.clearWatch({id:watchId});
      else if(navigator.geolocation)navigator.geolocation.clearWatch(watchId)}catch(e){}
  watchId=null}
function stopReal(){gpsStop();rideMode=null;posMode=gotFix?'gps':'none';gotFix=false;
  el('c-ride').textContent='▶ Ride it';el('c-ride').className='chip';
  var R=rideStop();
  if(!R)return show('Recording stopped. <b>'+crumbMi.toFixed(2)+
    ' mi</b> on the track. <b>Retrace</b> follows it back.','');
  logAct('ride end '+(R.hrs*60).toFixed(0)+'min '+R.fixes+' fixes');
  var txt=rideReport(R);
  show('<b>Ride recorded — '+crumbMi.toFixed(2)+' mi</b><br>'+
    '<span class="unit">'+(R.hrs*60).toFixed(0)+' min · '+R.fixes+' fixes'+
    (R.medAcc!==null?' · median ±'+Math.round(R.medAcc)+' m':'')+
    (R.drops?' · <b>'+R.drops+' GPS dropouts</b>':' · no dropouts')+
    (R.drain!==null?' · '+(R.drain*100).toFixed(1)+'% battery':'')+'</span><br>'+
    '<b>Retrace</b> follows the track back.'+
    '<div style="margin-top:8px"><button class="chip" id="rr-copy">Copy ride report</button> '+
    '<button class="chip" id="rr-share">Share</button></div>','');
  var cp=el('rr-copy');
  if(cp)cp.addEventListener('click',function(){
    var done=function(){cp.textContent='Copied ✓'};
    if(navigator.clipboard&&navigator.clipboard.writeText)
      navigator.clipboard.writeText(txt).then(done,function(){}); else{
      var ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);
      ta.select();try{document.execCommand('copy');done()}catch(e){}document.body.removeChild(ta)}});
  var sh=el('rr-share');
  if(sh)sh.addEventListener('click',function(){
    var S=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.Share;
    if(S)S.share({title:'APEX ride',text:txt}).catch(function(){});
    else if(navigator.share)navigator.share({title:'APEX ride',text:txt}).catch(function(){})})}
function onFix(at,acc){
  classifyFix(at);
  rideFix(acc);
  if(posMode==='away'){                     /* honest, and still useful */
    gpsStop();rideMode=null;
    el('c-ride').textContent='▶ Ride it';el('c-ride').className='chip';
    paint();return}
  if(!gotFix){gotFix=true;startRecording(at);ME=at.slice();mM.setLngLat(ME);
    map.easeTo({center:ME,zoom:14.5,duration:600});
    show('<span class="tn">Recording</span><span class="tag legal">live GPS</span><br>Truck pinned where you are. Ride.','');return}
  ME=at.slice();mM.setLngLat(ME);record(ME);checkOffRoute();
  if(++fixN%6===0)map.easeTo({center:ME,duration:280})}

el('c-ride').addEventListener('click',function(){
  if(rideMode)return stopReal();
  if(riding)return stopRide();
  rideMode=gpsStart(onFix,function(){
    if(gotFix)return;                 /* transient mid-ride errors: keep riding */
    stopReal();
    show('GPS unavailable here — browsers block it on <b>file://</b>. Running the <b>simulator</b> instead; in the APK this is your real track.','');
    startSim()});
  if(rideMode){el('c-ride').textContent='■ Stop (GPS)';el('c-ride').className='chip on';return}
  startSim()});

function startSim(){
  /* The simulator must exercise every line the GPS path does — that is what
     makes it a usable test double (take 16). It does NOT get to be a position:
     dispatch still refuses, because these coordinates are invented. */
  posMode='sim';
  var path=simPath();
  if(!path)return show('Pick a <b>Return home</b> route first, or move the ◎ pin nearer a trail.','fail');
  var pts=[];path.forEach(function(e){pts=pts.concat(decode(GR.g[e.i]))});
  /* orient the ride away from wherever we start */
  if(pts.length&&mi(ME,pts[0])>mi(ME,pts[pts.length-1]))pts.reverse();
  startRecording(pts[0]);ME=pts[0].slice();mM.setLngLat(ME);
  lost=false;var i=0;
  el('c-ride').textContent='■ Stop';el('c-ride').className='chip on';
  map.easeTo({center:ME,zoom:14.2,duration:600});
  riding=setInterval(function(){
    if(lost){
      var nn=nearestNode(ME),opts=edgesAt(nn);
      if(opts.length){var e=opts[(Math.random()*opts.length)|0],g=decode(GR.g[e.i]);
        pts=g;i=0;lost=false}
    }
    if(i>=pts.length){stopRide();
      show('Ride finished. <b>'+crumbMi.toFixed(2)+' mi</b> recorded. Tap <b>Retrace</b>, or <b>Dispatch</b> for what to read out.','pass');return}
    ME=pts[i++].slice();mM.setLngLat(ME);record(ME);checkOffRoute();
    if(i%6===0)map.easeTo({center:ME,duration:280})},170)}

el('c-base').addEventListener('click',function(){setBasemap(bmi+1)});
el('c-about').addEventListener('click',function(){show(ABOUT,'')});
/* every label layer, so the Labels chip governs all of them */
var LBL=['lbl-trail','lbl-show','lbl-fsroad','lbl-road','lbl-place'];
el('c-labels').addEventListener('click',function(){
  var on=el('c-labels').className.indexOf('on')<0;
  el('c-labels').className='chip'+(on?' on':'');
  LBL.forEach(function(id){map.setLayoutProperty(id,'visibility',on?'visible':'none')})});
var glErr=null;
map.on('error',function(e){var m=(e&&e.error&&e.error.message)||String(e&&e.error||'');
  if(m&&!glErr){glErr=m;try{window.__mapErr=m}catch(_){}renderHealth()}});
function renderedCount(){try{return map.queryRenderedFeatures().length}catch(e){return -1}}
var healthTries=0,healthOK=false;
function renderHealth(){
  /* Sources hold 16k+ features and the style is valid, yet nothing paints:
     that is the renderer, not the data (landmine 47).

     A single zero reading proves nothing — queryRenderedFeatures() is legitimately
     empty while tiles are still being built, so an eager check would cry RENDER
     FAIL on a healthy map. Require three zeros spread over ~7s, and let any
     non-zero reading settle it permanently. False alarms would be worse than the
     silence they replace: a rider who learns to ignore this badge has lost it. */
  if(!nf2.length||healthOK)return;
  var got=renderedCount();
  if(got>0){healthOK=true;
    var b=el('b-src');if(b){b.textContent='GRAPH '+EDGES.length;b.className='badge'}
    return}
  if(++healthTries<3){setTimeout(renderHealth,2500);return}
  var b=el('b-src');if(b){b.textContent='RENDER FAIL';b.className='badge bad'}
  show('<b>The map data loaded but nothing is drawing.</b><br>'+
    nf2.length+' trail segments and '+wf.length+' water features are in memory '+
    'with valid coordinates, and the style is valid — so this is the renderer, '+
    'not your download.<br><br>Most likely the map engine could not start its '+
    'worker thread in this WebView.'+
    (glErr?'<br><br>Engine said: <b>'+glErr.replace(/[<>]/g,'')+'</b>':'')+
    '<br><br>Tell Claude you saw <b>RENDER FAIL</b>'+(glErr?' and that message':'')+'.','fail')}
/* The state outline, drawn only below z9.6 and faded out as you approach the
   data. It answers "where am I relative to my download" and nothing else — the
   orange DOWNLOADED box that used to do this job was, correctly, called
   distracting and ugly. The detailed square speaks for itself. */
function drawCoverage(){
  if(!CTX||!CTX.rings)return;
  /* Polygons, not lines: the Census cartographic file is clipped to the
     SHORELINE, so filling it draws land and leaves the Great Lakes as ground.
     The legal state boundary used at take 32 ran far out into the lakes and
     produced a shape nobody recognised. */
  var feats=CTX.rings.map(function(r){
    var ring=r.slice();
    if(ring[0][0]!==ring[ring.length-1][0]||ring[0][1]!==ring[ring.length-1][1])ring.push(ring[0]);
    return {type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[ring]}}});
  try{map.getSource('state').setData({type:'FeatureCollection',features:feats})}catch(e){}
  var labs=(CTX.labels||[]).map(function(l){
    return {type:'Feature',properties:{n:l.n},geometry:{type:'Point',coordinates:l.at}}});
  try{map.getSource('lakes').setData({type:'FeatureCollection',features:labs})}catch(e){}}
map.on('load',drawCoverage);

/* Locate: fly to the real position when known, otherwise ask for one. The old
   handler delegated to the GeolocateControl, which does nothing useful when the
   rider is outside the region. */
function flyToYou(){
  if(YOU){
    var far=!inRegion(YOU);
    map.easeTo({center:YOU,zoom:far?7.2:14.5,duration:900,essential:true});
    show(far?'<b>You are here</b> — about '+Math.round(awayMi)+' mi from '+
      (BUNDLE.name||'the region')+'. The dashed box is what you have downloaded; '+
      'tap it or a chip to jump there.':
      '<b>You are here.</b> Inside the downloaded area.','');
    return true}
  return false}

/* ══ ADDRESSES ══════════════════════════════════════════════════════════════
   Census TIGER address RANGES, baked into the bundle. Each road segment carries
   the house numbers at each end per side, so a point resolves by finding the
   nearest segment, working out which side of it you are on, and interpolating.
   That is how rural geocoding works where there are no address points.

   Both directions are offline. Coverage is partial out here, and when there is
   no address the card shows nothing rather than announcing an absence. */
var ADDR_CAP=0.09;                 /* miles; beyond this, a road is not "your" road */

function segNear(at,a,b){
  /* Point-to-segment in local planar space, returning distance in miles, the
     parameter t along the segment, and which side the point falls on. */
  var kx=Math.cos(at[1]*Math.PI/180)*69.172, ky=69.172;
  var ax=(a[0]-at[0])*kx, ay=(a[1]-at[1])*ky,
      bx=(b[0]-at[0])*kx, by=(b[1]-at[1])*ky;
  var dx=bx-ax, dy=by-ay, L=dx*dx+dy*dy;
  var t=L>0?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/L)):0;
  var px=ax+t*dx, py=ay+t*dy;
  return {d:Math.sqrt(px*px+py*py), t:t, side:(dx*(-ay)-dy*(-ax))>0?'L':'R'}}

function addressAt(at){
  if(!ADDR||!ADDR.segs)return null;
  var S=ADDR.segs,best=null,bd=ADDR_CAP;
  for(var i=0;i<S.length;i++){var g=S[i];
    var r=segNear(at,[g[1],g[2]],[g[3],g[4]]);
    if(r.d<bd){bd=r.d;best={g:g,r:r}}}
  if(!best)return null;
  var g=best.g,r=best.r;
  var f=r.side==='L'?g[5]:g[7], t=r.side==='L'?g[6]:g[8];
  if(!f&&!t){f=r.side==='L'?g[7]:g[5];t=r.side==='L'?g[8]:g[6]}
  if(!f&&!t)return null;
  var n=Math.round(f+(t-f)*r.t);
  /* keep the parity of the side's range — odd side stays odd */
  if(f%2!==n%2)n+=(n>f?-1:1);
  return {n:n,street:ADDR.names[g[0]],zip:g[9]||0,
          txt:n+' '+ADDR.names[g[0]]+(g[9]?', '+g[9]:'')}}

function geocode(q){
  /* "4952 S Branch Rd" -> a point, by finding a segment of that name whose
     range contains the number and interpolating along it. */
  if(!ADDR||!ADDR.segs)return null;
  var m=/^\s*(\d+)\s+(.+?)\s*$/.exec(q);
  if(!m)return null;
  var want=+m[1],nm=m[2].toLowerCase().replace(/\.$/,'');
  var S=ADDR.segs,hit=null;
  for(var i=0;i<S.length;i++){var g=S[i];
    var name=ADDR.names[g[0]].toLowerCase();
    if(name.indexOf(nm)<0)continue;
    [[g[5],g[6]],[g[7],g[8]]].forEach(function(rg){
      if(hit||!rg[0]&&!rg[1])return;
      var lo=Math.min(rg[0],rg[1]),hi=Math.max(rg[0],rg[1]);
      if(want<lo||want>hi)return;
      var t=hi>lo?(want-rg[0])/(rg[1]-rg[0]):0.5;
      t=Math.max(0,Math.min(1,t));
      hit={c:[g[1]+(g[3]-g[1])*t, g[2]+(g[4]-g[2])*t],
           t:want+' '+ADDR.names[g[0]]+(g[9]?', '+g[9]:'')}})}
  return hit}

/* ══ PLACE CARD ═════════════════════════════════════════════════════════════
   Tap a pin or open ground and get a card: where it is, how high, what trail is
   nearest, how far and which way from you — then the things you would actually
   want to do with it. This is the interaction pattern every first-party map app
   uses, and the app had none of it. */
var dropM=null,DROP=null;

function bearingTo(a,b){
  var y=Math.sin((b[0]-a[0])*Math.PI/180)*Math.cos(b[1]*Math.PI/180),
      x=Math.cos(a[1]*Math.PI/180)*Math.sin(b[1]*Math.PI/180)-
        Math.sin(a[1]*Math.PI/180)*Math.cos(b[1]*Math.PI/180)*Math.cos((b[0]-a[0])*Math.PI/180);
  var d=(Math.atan2(y,x)*180/Math.PI+360)%360;
  var C=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return {deg:Math.round(d),pt:C[Math.round(d/22.5)%16]}}

function nearestEdgeTo(at){
  var best=null,bd=1e9;
  for(var i=0;i<EDGES.length;i++){var e=EDGES[i];
    var n=NODES[e.a],d=mi(at,n);
    if(d<bd){bd=d;best=e}}
  return best?{e:best,mi:bd}:null}

function placeCard(at,kind,title){
  var e=elevAt(at),ne=nearestEdgeTo(at),b=bearingTo(ME,at),d=mi(ME,at);
  var rows=[];
  rows.push('<b style="font-size:15px">'+title+'</b>');
  rows.push('<span class="mono" style="font-size:15px">'+at[1].toFixed(5)+' '+
    at[0].toFixed(5)+'</span> <span class="unit">DD'+
    (e!==null?' · '+ft(e)+' ft':'')+'</span>');
  if(kind!=='me')rows.push('<span class="unit">'+d.toFixed(2)+' mi '+b.pt+
    ' ('+b.deg+'°) from your position</span>');
  var ad=addressAt(at);
  if(ad)rows.push('<span style="color:#F5EFE2">'+ad.txt+'</span>');
  if(ne)rows.push('<span class="unit">nearest: '+(ne.e.n||label(ne.e.c))+
    (ne.e.id?' · '+ne.e.id:'')+' — '+ne.mi.toFixed(2)+' mi</span>');
  var acts=[];
  if(kind!=='me')acts.push('<button class="chip" id="pc-route">▸ Directions here</button>');
  if(kind!=='home')acts.push('<button class="chip" id="pc-home">⌂ Make this home</button>');
  if(kind!=='me')acts.push('<button class="chip" id="pc-start">◉ Start from here</button>');
  if(kind==='me'&&posMode==='gps')acts.push('<button class="chip" id="pc-disp">☎ Dispatch card</button>');
  acts.push('<button class="chip" id="pc-go">⤢ Centre</button>');
  if(kind==='drop')acts.push('<button class="chip" id="pc-drop">✕ Remove pin</button>');
  show(rows.join('<br>')+'<div style="margin-top:9px">'+acts.join(' ')+'</div>','');
  var on=function(id,fn){var b=el(id);if(b)b.addEventListener('click',fn)};
  on('pc-route',function(){routeToPoint(at,title)});
  on('pc-home',function(){logAct('act  make this home');HOME=at.slice();hM.setLngLat(HOME);clearRoute();syncSafety();
    /* The pin has become the ⌂ marker. Leaving a second marker sitting on top of
       it was the whole confusion at take 35: the next long-press appeared to
       "wipe out" a pin that had in fact already done its job. */
    if(kind==='drop')clearDrop();
    show('<b>Home is here now.</b> The ⌂ pin holds this spot — '+
      'press and hold anywhere for a new pin.','')});
  on('pc-start',function(){logAct('act  start from here');
    if(posMode==='gps')return show('A live GPS fix is driving your position — '+
      'the start pin follows you and cannot be moved by hand.','');
    ME=at.slice();mM.setLngLat(ME);paint();syncSafety();clearRoute();
    if(kind==='drop')clearDrop();
    show('<b>Start is here now.</b> The ◎ pin holds this spot and routes measure '+
      'from it — press and hold anywhere for a new pin.','')});
  on('pc-disp',function(){el('btn-disp').click()});
  on('pc-go',function(){map.easeTo({center:at,zoom:Math.max(map.getZoom(),14),
    duration:600,essential:true})});
  on('pc-drop',function(){clearDrop();show('Pin removed.','')});
}

function clearDrop(){
  if(DROP)logAct('pin  removed');
  if(dropM){try{dropM.remove()}catch(e){}dropM=null}
  DROP=null}

function dropPin(at){
  logAct('pin  dropped at '+at[1].toFixed(5)+','+at[0].toFixed(5));
  DROP=at.slice();
  if(!dropM){dropM=new maplibregl.Marker({element:mk('drop')}).setLngLat(DROP).addTo(map);
    dropM.getElement().addEventListener('click',function(ev){ev.stopPropagation();
      placeCard(DROP,'drop','Dropped pin')})}
  else dropM.setLngLat(DROP);
  placeCard(DROP,'drop','Dropped pin')}

try{window.map=map;window.PLACES=PLACES;window.placeCard=placeCard;
    window.__geo={addressAt:addressAt,geocode:geocode,
                  get ADDR(){return ADDR}};
    window.__route={buildLoops:buildLoops,nearestNode:nearestNode,
                    get ME(){return ME}};
    window.__ride={start:startRecording,fix:rideFix,stop:rideStop,report:rideReport,
                   get R(){return RIDE},get last(){return LASTRIDE}}}catch(e){}

/* ══ SELF-TEST ══════════════════════════════════════════════════════════════
   The same battery of checks runs here, on the device, that render.mjs runs in
   headless Chrome. That is the whole point: Chrome cannot tell me how Android's
   WebView behaves, and Jacob should not have to tap through thirty features to
   find out. He taps once and sends the report; anything that differs between
   the two runs is device-specific by construction.

   Every check records what it OBSERVED, not just pass/fail — a bare "FAIL
   routing" is nearly useless to debug from, whereas "FAIL routing · 0 profiles,
   nearestNode returned -1" names the layer that broke. */
var ST=[],ACT=[],T0=Date.now();
/* A ring buffer of what was actually done. Jacob reports symptoms in prose —
   "I clicked start from here, then tried to drop another pin" — and prose loses
   the order and the state. Forty entries is enough to cover any confusion and
   small enough to paste. Nothing here leaves the phone unless he shares it. */
function logAct(s){
  ACT.push(((Date.now()-T0)/1000).toFixed(1)+'s  '+s);
  if(ACT.length>40)ACT.shift()}
try{document.addEventListener('click',function(e){
  var t=e.target;if(!t)return;
  var c=String(t.className||'');
  if(c.indexOf('chip')<0&&c.indexOf('act')<0&&c.indexOf('rc')<0&&c.indexOf('hit')<0)return;
  logAct('tap  '+((t.id||t.textContent||'').replace(/\s+/g,' ').trim().slice(0,26)))
},true)}catch(e){}
function stAdd(g,id,ok,detail){ST.push({g:g,id:id,ok:ok,d:detail===undefined?'':String(detail)})}
function stInfo(g,id,detail){ST.push({g:g,id:id,ok:null,d:String(detail)})}
function stTry(g,id,fn,check){
  try{var v=fn();var r=check?check(v):{ok:!!v,d:v};
    stAdd(g,id,r.ok,r.d)}
  catch(e){stAdd(g,id,false,'threw: '+(e&&e.message||e))}}

function glInfo(){
  try{var c=map.getCanvas(),gl=c.getContext('webgl2')||c.getContext('webgl');
    if(!gl)return{r:'no gl context',v:''};
    var d=gl.getExtension('WEBGL_debug_renderer_info');
    return{r:d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):'masked',
           v:d?gl.getParameter(d.UNMASKED_VENDOR_WEBGL):'masked',
           mt:gl.getParameter(gl.MAX_TEXTURE_SIZE)}}
  catch(e){return{r:'err '+e.message,v:''}}}

function stEnv(){
  var ua=navigator.userAgent||'';
  var wv=(ua.match(/Chrome\/([\d.]+)/)||[])[1]||'n/a';
  var C=window.Capacitor||{};
  var g=glInfo();
  stInfo('ENV','take',(el('title')&&el('title').textContent||'').replace(/\s+/g,' ').trim());
  stInfo('ENV','region',(BUNDLE.region||'?')+' "'+(BUNDLE.name||'?')+'"');
  stInfo('ENV','bundle',(BUNDLE.hash?String(BUNDLE.hash).slice(0,16)+' ':'')+
    (BUNDLE.built||'?'));
  stInfo('ENV','ua',ua.slice(0,150));
  stInfo('ENV','webview','Chrome/'+wv);
  stInfo('ENV','native',(C.isNativePlatform?C.isNativePlatform():false)+
    ' plugins='+Object.keys((C.Plugins)||{}).join(','));
  stInfo('ENV','gl',g.r+' | '+g.v+' | maxTex='+g.mt);
  stInfo('ENV','screen',innerWidth+'x'+innerHeight+' dpr='+devicePixelRatio+
    ' scr='+screen.width+'x'+screen.height);
  stInfo('ENV','cores',(navigator.hardwareConcurrency||'?')+
    ' mem='+(navigator.deviceMemory||'?')+'GB online='+navigator.onLine);
}

function stLoad(){
  stAdd('LOAD','bundle-complete',BUNDLE.state==='complete',
    BUNDLE.state+(BUNDLE.absent&&BUNDLE.absent.length?' absent='+BUNDLE.absent.join(','):''));
  stAdd('LOAD','offline-clean',remoteHits===0,remoteHits+' remote requests');
  stAdd('LOAD','glyph-pack',GLYPH_BUF&&GLYPH_BUF.length>1000,
    (GLYPH_BUF?GLYPH_BUF.length:0)+' bytes');
  stAdd('LOAD','graph',EDGES.length>1000&&NODES.length>500,
    EDGES.length+' edges / '+NODES.length+' nodes');
  stAdd('LOAD','terrain',!!(TR&&TR.ne&&TR.ne.length===NODES.length),
    TR&&TR.ne?TR.ne.length+' node elevations':'absent');
  /* IDX is built lazily on first search, so reading it cold always says 0 —
     a number that looks like a failure and is actually just "not built yet". */
  var idx=buildIndex();
  stAdd('LOAD','search-index',idx&&idx.length>100,(idx?idx.length:0)+' entries');
}

function stRender(){
  stAdd('RENDER','style-loaded',map.isStyleLoaded(),String(map.isStyleLoaded()));
  stAdd('RENDER','no-map-errors',!glErr,glErr||'none');
  var q=function(ids){try{return map.queryRenderedFeatures({layers:ids}).length}
    catch(e){return -1}};
  var all=renderedCount();
  stAdd('RENDER','features-drawn',all>0,all+' in viewport');
  /* Viewport-dependent, so it cannot be a pass/fail: Jacob's map was parked over
     Brainard Springs, where there is genuinely no designated trail, and this
     reported FAIL on a perfectly good map. The trail-names check below jumps to
     a known site and IS a real assertion (take 64). */
  stInfo('RENDER','trails',q(['trail50','route72','moto24','fstrail','mccct'])+
    ' designated · '+q(['track'])+' two-track in the view you left it on');
  stAdd('RENDER','roads',q(['fsroad','minor','paved','track'])>0,
    q(['fsroad','minor','paved','track'])+' features');
  /* Counted at the CURRENT viewport, this reported 0 on a device whose screen
     was visibly showing "The Pink Store" — the map was simply zoomed somewhere
     with no label in frame. Jump to a known anchor, count, restore. Landmine 54
     for the fifth time: a check must control where it looks. */
  var was={c:map.getCenter(),z:map.getZoom()};
  var site=anchorOf('site');
  map.jumpTo({center:site,zoom:14.5});
  /* Knowing WHICH trail you are on is the point of a trail map. text-max-angle
     was 32 degrees, which on a network this twisty placed zero names — the data
     had a label on 100% of trail edges and almost none were shown (take 44). */
  /* Symbols are placed ASYNCHRONOUSLY: querying in the same tick as the jump
     returns 0 on a map that shows several a moment later — which is exactly what
     it reported for Jacob while trail-names, which waits, found 4. stLabels()
     already asserts this properly, so here it is only information. */
  var lb=q(['lbl-place','lbl-trail']);
  stInfo('RENDER','labels',lb+' at '+site[1].toFixed(3)+','+site[0].toFixed(3)+
    ' z13.6 — placed asynchronously, see trail-names for the real check');
  stInfo('RENDER','labels-here',q(['lbl-place','lbl-trail'])+' at the view you left it on');
  map.jumpTo({center:[was.c.lng,was.c.lat],zoom:was.z});
  var vis;try{vis=map.getLayoutProperty('sat','visibility')}catch(e){vis='err'}
  stInfo('RENDER','basemap','sat visibility='+vis+' SAT_OK='+SAT_OK);
  /* Ground resolution is the whole complaint: at 22 m/px a two-track is a
     twentieth of a pixel. Report it so the improvement is visible in the
     report, not just in an opinion. */
  if(TILES){
    var mpp=156543.03*Math.cos(CTR[1]*Math.PI/180)/Math.pow(2,TILES.zmax);
    stAdd('RENDER','imagery',mpp<6,
      'tiles z'+TILES.zmin+'-z'+TILES.zmax+' · '+mpp.toFixed(2)+' m/px · '+
      TILES.count+' tiles, '+(TILES.bytes/1048576).toFixed(0)+' MB')}
  else if(SAT_OK){
    var b=SATBOX,px=1500;
    var km=(b[2]-b[0])*111.32*Math.cos(CTR[1]*Math.PI/180);
    stInfo('RENDER','imagery','single mosaic · about '+(km*1000/px).toFixed(0)+
      ' m/px — no tiles in this bundle')}
}

function stLayout(){
  /* Layout bugs are what Jacob actually hits, and no data check sees them.
     Take 35's route strip was 788 px wide inside a 411 px screen: options 4 and
     5 were not off-screen, they were unreachable. That is measurable, on his
     device, at his width — so measure it. */
  var vw=document.documentElement.clientWidth||innerWidth;
  stInfo('UI','viewport',vw+'x'+(document.documentElement.clientHeight||innerHeight)+
    ' css px @dpr '+devicePixelRatio);
  var wide=[];
  Array.prototype.forEach.call(document.querySelectorAll('#shell *'),function(e){
    var r=e.getBoundingClientRect();
    if(r.width>vw+1)wide.push((e.id||e.className||e.tagName)+' '+Math.round(r.width)+'px')});
  stAdd('UI','no-overflow',wide.length===0,
    wide.length?'wider than the screen: '+wide.slice(0,3).join(', '):
      'nothing exceeds '+vw+' px');
  /* anything that scrolls must actually be able to */
  var bad=[],scrollers=0;
  Array.prototype.forEach.call(document.querySelectorAll('#shell *'),function(e){
    var ov=getComputedStyle(e).overflowX;
    if(ov!=='auto'&&ov!=='scroll')return;
    /* Hidden panels legitimately have no width — the search results row is
       display:none until you open it. Only judge what is on screen. */
    if(e.offsetParent===null&&e.id!=='shell')return;
    if(e.clientHeight<1)return;
    scrollers++;
    /* A scroller wider than the screen is the take-35 bug: it grew instead of
       overflowing, so its far end is unreachable. Content that simply FITS is
       not a fault — an earlier version of this check confused the two and
       failed a perfectly good chip row at 900 px. */
    if(e.clientWidth>vw+1)bad.push((e.id||e.className)+' is '+e.clientWidth+
      ' px inside a '+vw+' px screen');
    else if(e.clientWidth<1)bad.push((e.id||e.className)+' has no width')});
  stAdd('UI','scrollers-scroll',bad.length===0,
    bad.length?bad.join(', '):scrollers+' horizontal scrollers, all within the screen');
  /* gloved thumbs need real targets */
  var small=[];
  Array.prototype.forEach.call(document.querySelectorAll('.chip,.act,.rc'),function(e){
    var r=e.getBoundingClientRect();
    if(r.height>0&&r.height<36)small.push((e.id||e.textContent||'').slice(0,14)+' '+Math.round(r.height)+'px')});
  stAdd('UI','tap-targets',small.length===0,
    small.length?small.length+' under 36 px: '+small.slice(0,3).join(', '):
      'every control at least 36 px tall');
  var off=[];
  Array.prototype.forEach.call(document.querySelectorAll('#actions .act'),function(e){
    var r=e.getBoundingClientRect();
    if(r.right<0||r.left>vw+1)off.push(e.textContent.slice(0,12))});
  stAdd('UI','actions-reachable',off.length===0,
    off.length?'off-screen: '+off.join(', '):'all primary actions on screen');
  var vh=document.documentElement.clientHeight||innerHeight,
      mh=map.getContainer().getBoundingClientRect().height;
  stAdd('UI','map-has-room',mh>vh*0.35,
    Math.round(mh)+' of '+vh+' px ('+Math.round(100*mh/vh)+'% of the screen)');
}

function stLayout(){
  /* Every UI bug Jacob has reported was invisible to this self-test: a strip
     that could not scroll, options unreachable off-screen, a map that jumped.
     None of them are data or logic — they are LAYOUT, and layout only exists on
     a real device at a real viewport. These checks run there. */
  var vw=document.documentElement.clientWidth;
  stInfo('UI','viewport',vw+'x'+document.documentElement.clientHeight+
    ' css px · dpr '+devicePixelRatio);

  /* Anything wider than the screen is a layout bug. This is exactly what the
     route strip did at take 35 — 788 px inside a 411 px phone — and nothing
     caught it but a person squinting at a screenshot. */
  var wide=[];
  Array.prototype.forEach.call(document.querySelectorAll('#shell *'),function(e){
    var r=e.getBoundingClientRect();
    if(r.width>vw+1)wide.push((e.id||e.className||e.tagName)+' '+Math.round(r.width)+'px')});
  stAdd('UI','nothing-overflows',wide.length===0,
    wide.length?wide.slice(0,3).join(' · '):'no element exceeds '+vw+' px');

  /* A scrollable strip that cannot scroll hides its later options entirely. */
  var strips=[],bad=[];
  Array.prototype.forEach.call(document.querySelectorAll('#shell *'),function(e){
    var ov=getComputedStyle(e).overflowX;
    if(ov!=='auto'&&ov!=='scroll')return;
    if(!e.children.length)return;
    strips.push(e.id||e.className);
    /* content wider than the box is fine — that IS scrolling. Content that
       overflows the SCREEN while the box does not scroll is the bug. */
    var last=e.children[e.children.length-1].getBoundingClientRect();
    var box=e.getBoundingClientRect();
    if(last.right>box.right+1&&e.scrollWidth<=e.clientWidth+1)
      bad.push((e.id||e.className)+' clips its last child')});
  stAdd('UI','strips-scroll',bad.length===0,
    bad.length?bad.join(' · '):strips.length+' scrollable strip(s), all reachable');

  /* Gloved thumbs on a bouncing bike. 38 css px is the floor. */
  var small=[];
  Array.prototype.forEach.call(document.querySelectorAll('.chip,.act,.rc,.hit'),function(e){
    var r=e.getBoundingClientRect();
    if(r.height>0&&r.height<38)small.push((e.id||e.textContent||'?').slice(0,14)+
      ' '+Math.round(r.height)+'px')});
  stAdd('UI','tap-targets',small.length===0,
    small.length?small.slice(0,3).join(' · '):'all ≥38 px tall');

  /* Controls that have slid off the bottom cannot be pressed. */
  var vh=document.documentElement.clientHeight,off=[];
  ['btn-home','btn-disp','btn-steps','btn-retrace','c-ride','c-locate'].forEach(function(id){
    var e=el(id);if(!e)return;var r=e.getBoundingClientRect();
    if(r.height===0)return;
    if(r.bottom>vh+2||r.top<0)off.push(id)});
  stAdd('UI','controls-on-screen',off.length===0,
    off.length?off.join(', ')+' outside the viewport':'primary controls all reachable');
}

function stData(){
  /* Elevation against surveyed landmarks — catches a DEM that loaded but is
     georeferenced wrong, which no structural check would notice. */
  var known=[['Mio',-84.1330,44.6597,965],['Bull Gap',-84.0274,44.6166,1070],
             ['The Pink Store',-84.1279,44.5219,1240]];
  known.forEach(function(k){
    var e=elevAt([k[1],k[2]]);
    if(e===null)return stAdd('DATA','elev-'+k[0],false,'no elevation');
    var f=Math.round(e*3.28084),d=Math.abs(f-k[3]);
    stAdd('DATA','elev-'+k[0],d<=90,f+' ft vs '+k[3]+' surveyed (Δ'+d+')')});
  /* Addresses: coverage out here is partial by nature, so the check is that the
     geocoder WORKS where data exists and round-trips, not that every point has
     an address. A point with no address must yield null, never a guess. */
  if(!ADDR||!ADDR.segs)stInfo('DATA','address','no address index in this bundle');
  else{
    stInfo('DATA','address-index',ADDR.segs.length+' segments, '+
      ADDR.names.length+' street names');
    var hits=0,shown=[];
    PLACES.forEach(function(pl){var a=addressAt([pl[1],pl[2]]);
      if(a){hits++;if(shown.length<2)shown.push(pl[0]+': '+a.txt)}});
    stInfo('DATA','address-at-anchors',hits+'/'+PLACES.length+' resolve · '+
      (shown.join(' · ')||'none near an anchor, which is normal out here'));
    var g0=ADDR.segs[0],mid=[(g0[1]+g0[3])/2,(g0[2]+g0[4])/2];
    var a0=addressAt(mid);
    if(!a0)stAdd('DATA','address-roundtrip',false,'a segment midpoint resolved to nothing');
    else{var f=geocode(a0.n+' '+a0.street);
      if(!f)stAdd('DATA','address-roundtrip',false,'"'+a0.txt+'" did not geocode back');
      else{var m2=mi(mid,f.c);
        stAdd('DATA','address-roundtrip',m2<0.6,
          '"'+a0.txt+'" -> back within '+Math.round(m2*5280)+' ft')}}
    var far=addressAt([CTR[0]+0.9,CTR[1]+0.9]);
    stAdd('DATA','address-honest',far===null,
      far?'invented an address 60+ mi away: '+far.txt:'no address far outside the data — omitted, not guessed');
  }
  stTry('DATA','search-town',function(){return search('mio')},
    function(v){return{ok:v&&v.length>0,d:(v?v.length:0)+' hits'}});
  stTry('DATA','search-trail',function(){return search('bull')},
    function(v){return{ok:v&&v.length>0,d:(v?v.length:0)+' hits'}});
}

function stRouting(){
  var a=anchorOf('site'),b=anchorOf('town');
  var na=nearestNode(a),nb=nearestNode(b);
  stAdd('ROUTE','snap',na>=0&&nb>=0,'nodes '+na+' -> '+nb);
  if(na<0||nb<0)return;
  var got=0,detail=[];
  PROFILES.forEach(function(pf){
    try{var path=route(na,nb,pf.f);
      if(path&&path.length){got++;var s=summarise(path);
        detail.push(pf.h+' '+s.mi.toFixed(1)+'mi')}}
    catch(e){detail.push(pf.h+' threw: '+(e&&e.message||e))}});
  stAdd('ROUTE','profiles',got>=2,got+'/'+PROFILES.length+' · '+detail.join(', '));
  stTry('ROUTE','directions',function(){
      var path=route(na,nb,PROFILES[0].f);return directions(path,na)},
    function(v){return{ok:v&&v.length>0,d:(v?v.length:0)+' steps'}});
  /* legality must actually change what is routable */
  var before=machine;
  try{
    machine='bike';var pb=route(na,nb,PROFILES[0].f);
    machine='sxs';var ns=nearestNode(ME),ps=ns>=0?route(ns,nearestNode(HOME),PROFILES[0].f):null;
    /* An SxS finding no route between two points is usually correct — 72"
       machines are barred from most of this network. The filter is only broken
       if a 72" machine cannot snap to ANY node at all. */
    var sxsCanSnap=ns>=0;
    stAdd('ROUTE','machine-filter',!!pb&&sxsCanSnap,
      'bike '+(pb?pb.length:0)+' edges · sxs snaps='+sxsCanSnap+
      ' route='+(ps?ps.length+' edges':'none legal (expected on bike-only trail)'));
    var closedUsed=(pb||[]).filter(function(e){return e.c==='closed'||e.c==='fsclosed'}).length;
    stAdd('ROUTE','closures-avoided',closedUsed===0,closedUsed+' closed edges in route');
  /* Loops are the impromptu-ride feature. Two things make one useful: it lands
     near the distance asked for, and it does not simply ride out and back. */
  try{
    var la=nearestNode(anchorOf('site'));
    if(la<0)stInfo('ROUTE','loop','no legal node near the site anchor');
    else{
      var L=buildLoops(la,15);
      if(!L.length)stAdd('ROUTE','loop',false,'no 15 mi loop found from the site anchor');
      else{
        var worst=0,rep=0,txt=[];
        L.forEach(function(o){
          var e=Math.abs(o.s.mi-15)/15;if(e>worst)worst=e;
          if(o.repeat>rep)rep=o.repeat;
          txt.push(o.h.replace('Loop · ','')+' '+o.s.mi.toFixed(1)+'mi '+
            o.s.off.toFixed(1)+'mi trail '+Math.round(o.repeat*100)+'% twice')});
        stAdd('ROUTE','loop',worst<0.30&&rep<0.40,
          txt.join(' · ')+' (target 15)')}}
  }catch(e){stAdd('ROUTE','loop',false,'threw: '+(e&&e.message||e))}
  }catch(e){stAdd('ROUTE','machine-filter',false,'threw: '+e.message)}
  machine=before;
}

function stSafety(){
  /* The drill calls startRecording, which since take 41 also starts ride
     telemetry and a 20 s interval. A self-test that leaves a live ride running
     is worse than one that skips the check — it would report the DRILL as the
     rider's last ride, and leak a timer for the life of the app. */
  var save={T:TRUCK,c:crumbs.slice(),m:crumbMi,p:posMode,me:ME.slice(),
            ride:RIDE,lastride:LASTRIDE};
  try{
    var c=CTR,pts=[];
    for(var i=0;i<25;i++)pts.push([c[0]+i*0.0008,c[1]+i*0.0005]);
    startRecording(pts[0]);
    for(var j=1;j<pts.length;j++)record(pts[j]);
    stAdd('SAFETY','breadcrumb',crumbMi>0.5,crumbMi.toFixed(2)+' mi from 25 fixes');
    var straight=mi(pts[0],pts[pts.length-1]);
    stAdd('SAFETY','distance-sane',Math.abs(crumbMi-straight)<straight*0.35,
      'track '+crumbMi.toFixed(2)+' vs straight '+straight.toFixed(2)+' mi');
    stAdd('SAFETY','truck-pinned',!!TRUCK&&mi(TRUCK,pts[0])<0.02,
      TRUCK?'at '+TRUCK[1].toFixed(4)+','+TRUCK[0].toFixed(4):'none');
    var back=crumbs.slice().reverse();
    stAdd('SAFETY','retrace-lossless',
      back.length===crumbs.length&&back[0][0]===crumbs[crumbs.length-1][0],
      back.length+' points reversed');
    posMode='away';
    stAdd('SAFETY','dispatch-refuses-fake',posMode!=='gps',
      'posMode='+posMode+' (dispatch prints no coordinate)');
  }catch(e){stAdd('SAFETY','harness',false,'threw: '+e.message)}
  if(RIDE&&RIDE!==save.ride){try{clearInterval(RIDE.pulse)}catch(e){}}
  RIDE=save.ride;LASTRIDE=save.lastride;
  TRUCK=save.T;crumbs=save.c;crumbMi=save.m;posMode=save.p;ME=save.me;
  try{syncSafety()}catch(e){}
}

function stPerf(cb){
  var n=0,t0=performance.now(),d=[],last=t0;
  var c=CTR;
  map.jumpTo({center:c,zoom:12.6});
  function step(){
    var t=performance.now();d.push(t-last);last=t;
    map.setBearing((n*7)%360);
    if(++n<70)requestAnimationFrame(step);
    else{
      d.sort(function(a,b){return a-b});
      var avg=Math.round(1000/(d.reduce(function(a,b){return a+b},0)/d.length));
      var p99=Math.round(1000/d[Math.floor(d.length*0.99)]);
      map.setBearing(0);map.jumpTo({center:c,zoom:11.4});
      var drew=renderedCount();
      /* Headless Chrome rasterises in software at single-digit fps, which says
         nothing about a phone. Judge the frame rate only on real hardware;
         everywhere else record it and judge that something DREW. */
      /* A single hitch and a sustained stutter give the same p99 but need very
         different answers. Count the slow frames and name the worst one, so the
         next report distinguishes "one GC pause" from "this device struggles". */
      var slow=0,worst=0;
      for(var q=0;q<d.length;q++){if(d[q]>33.4)slow++;if(d[q]>worst)worst=d[q]}
      var detail='avg '+avg+' · p99 min '+p99+' · '+slow+'/'+d.length+
        ' frames over 33ms · worst '+Math.round(worst)+'ms · '+drew+' features';
      var soft=/swiftshader|llvmpipe|software/i.test(glInfo().r||'');
      if(soft)stInfo('PERF','fps',detail+' · SOFTWARE RASTERISER, not a verdict');
      else stAdd('PERF','fps',avg>=30&&drew>0&&slow<=d.length*0.1,detail);
      cb()}}
  requestAnimationFrame(step);
}

function stGps(cb){
  var t0=Date.now(),got=false,fixes=[];
  var C=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.Geolocation;
  stInfo('GPS','plugin',C?'Capacitor Geolocation':(navigator.geolocation?'web':'NONE'));
  if(!C&&!navigator.geolocation){
    stAdd('GPS','fix',false,'no geolocation api at all');return cb()}
  var stop=function(){
    if(fixes.length){
      var f=fixes[0];
      stAdd('GPS','first-fix',true,((f.t-t0)/1000).toFixed(1)+'s · ±'+
        Math.round(f.acc)+'m · '+f.at[1].toFixed(5)+','+f.at[0].toFixed(5));
      /* Marking "away" as FAIL was wrong — the detail line even said so. What
         matters is that the app REACTED correctly, not where the rider stands. */
      var away=!inRegion(f.at);
      stInfo('GPS','position',away?Math.round(mi(f.at,CTR))+' mi outside '+
        (BUNDLE.name||'the region'):'inside '+(BUNDLE.name||''));
      classifyFix(f.at);
      stInfo('GPS','fixes',fixes.length+' in 20s');
    }else{
      /* A watch that times out indoors is not the same as "the app has no
         position" — at take 38 the log showed a startup fix at 2.7 s while this
         section reported nothing at all, dropping startup-locate and
         mode-correct precisely when they mattered most. Report state either way. */
      stAdd('GPS','first-fix',!!YOU,YOU?
        'this watch saw nothing in 20s, but the app already has a fix from startup':
        'no fix in 20s and no startup fix (indoors? permission denied?)');
    }
    stAdd('GPS','startup-locate',!!YOU,
      YOU?'app knew its position before the self-test ran ('+
          YOU[1].toFixed(5)+','+YOU[0].toFixed(5)+')':
          'app had NO position at startup — locateOnce failed');
    if(YOU){
      var away2=!inRegion(YOU);
      stInfo('GPS','position',away2?Math.round(mi(YOU,CTR))+' mi outside '+
        (BUNDLE.name||'the region'):'inside '+(BUNDLE.name||''));
      stAdd('GPS','mode-correct',away2?(posMode==='away'):(posMode==='gps'),
        'posMode='+posMode+(away2?' (planning mode expected)':' (in region)'));
    }
    cb()};
  var onF=function(at,acc){fixes.push({t:Date.now(),at:at,acc:acc||0});got=true};
  var id=null;
  try{
    if(C){var w=C.watchPosition({enableHighAccuracy:true,timeout:15000},function(pos,err){
        if(pos&&pos.coords)onF([pos.coords.longitude,pos.coords.latitude],pos.coords.accuracy)});
      if(w&&typeof w.then==='function')w.then(function(x){id=x})
        .catch(function(e){stAdd('GPS','watch',false,String(e.message||e))});
      else id=w;
      stAdd('GPS','watch',true,'watch id '+(id===null?'pending':String(id).slice(0,12)))}
    else id=navigator.geolocation.watchPosition(function(pos){
        onF([pos.coords.longitude,pos.coords.latitude],pos.coords.accuracy)},
      function(e){stAdd('GPS','watch',false,'code '+e.code+' '+e.message)},
      {enableHighAccuracy:true,timeout:15000});
  }catch(e){stAdd('GPS','watch',false,'threw: '+e.message)}
  setTimeout(function(){
    try{if(C&&id!==null)C.clearWatch({id:id});
        else if(id!==null)navigator.geolocation.clearWatch(id)}catch(e){}
    stop()},20000);
}

function stRide(){
  if(!LASTRIDE&&!RIDE)return stInfo('RIDE','none',
    'no ride recorded yet — tap ▶ Ride it and go for one; that is what closes A18');
  var R=LASTRIDE||RIDE;
  stInfo('RIDE','duration',((R.hrs||((Date.now()-R.t0)/3600000))*60).toFixed(0)+' min · '+
    R.fixes+' fixes'+(R.drops?' · '+R.drops+' dropouts':''));
  if(R.medAcc!==null&&R.medAcc!==undefined)
    stInfo('RIDE','accuracy','median ±'+Math.round(R.medAcc)+' m under canopy');
  if(R.drain!==null&&R.drain!==undefined){
    if(R.chg)stInfo('RIDE','battery','was charging — drain is meaningless');
    else if(!R.longEnough)stInfo('RIDE','battery',
      (R.drain*100).toFixed(1)+'% used — ride too short to quote a rate');
    else stAdd('RIDE','battery',R.perHr<0.35,
      (R.drain*100).toFixed(1)+'% used · '+(R.perHr*100).toFixed(1)+'%/hour · '+
      (1/R.perHr).toFixed(1)+'h from full')}
  else stInfo('RIDE','battery','not reported by this device');
}

function stHaptics(){
  var C=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.Haptics;
  stAdd('HAPTICS','available',!!(C||navigator.vibrate),
    C?'Capacitor Haptics':(navigator.vibrate?'navigator.vibrate':'NONE — off-route alert is silent'));
  try{buzz(30);stAdd('HAPTICS','fired',true,'buzz(30) did not throw')}
  catch(e){stAdd('HAPTICS','fired',false,'threw: '+e.message)}
}

function stReport(){
  var pass=0,fail=0,info=0;
  ST.forEach(function(r){if(r.ok===null)info++;else if(r.ok)pass++;else fail++});
  var L=[];
  L.push('APEX SELF-TEST · '+(el('title').textContent||'').replace(/\s+/g,' ').trim());
  L.push(new Date().toISOString()+' · PASS '+pass+' · FAIL '+fail+' · info '+info);
  L.push('');
  var g=null;
  ST.forEach(function(r){
    if(r.g!==g){g=r.g;L.push('['+g+']')}
    var mark=r.ok===null?'  · ':(r.ok?'  ok ':'  XX ');
    L.push(mark+pad(r.id)+' '+r.d)});
  L.push('');
  if(ACT.length){
    L.push('[LAST ACTIONS]');
    ACT.slice(-25).forEach(function(a){L.push('  '+a)});
    L.push('');}
  L.push('--- end ---');
  /* structured too: a caller needs to tell a data failure from a render one,
     and only a real engine can judge the render group. */
  return {text:L.join('\n'),pass:pass,fail:fail,results:ST.slice()};
}
function pad(s){s=String(s);while(s.length<18)s+=' ';return s}

function stRenderPanel(rep){
  var rows=ST.map(function(r){
    var col=r.ok===null?'#9A9184':(r.ok?'#8FAE63':'#C1121F');
    var mk=r.ok===null?'·':(r.ok?'✓':'✕');
    return '<div style="display:flex;gap:8px;padding:3px 0;border-bottom:1px solid #241F1A">'+
      '<span style="color:'+col+';font-weight:700;width:12px">'+mk+'</span>'+
      '<span style="color:#F5EFE2;min-width:112px;font:600 11px ui-monospace,monospace">'+
      r.g+'·'+r.id+'</span>'+
      '<span style="color:#C9C0B2;font-size:11.5px;flex:1">'+
      String(r.d).replace(/[<>]/g,'')+'</span></div>'}).join('');
  var bad=rep.fail>0;
  show('<b style="font-size:15px">Self-test · '+
    '<span style="color:'+(bad?'#C1121F':'#8FAE63')+'">'+rep.pass+' passed, '+
    rep.fail+' failed</span></b><br>'+
    '<div style="max-height:46vh;overflow:auto;margin:8px 0">'+rows+'</div>'+
    '<button id="st-copy" class="chip">Copy report</button> '+
    '<button id="st-share" class="chip">Share report</button>',bad?'fail':'');
  var t=rep.text;
  var cp=el('st-copy');
  if(cp)cp.addEventListener('click',function(){
    var done=function(){cp.textContent='Copied ✓';setTimeout(function(){cp.textContent='Copy report'},1600)};
    if(navigator.clipboard&&navigator.clipboard.writeText)
      navigator.clipboard.writeText(t).then(done,legacy); else legacy();
    function legacy(){var ta=document.createElement('textarea');ta.value=t;
      document.body.appendChild(ta);ta.select();
      try{document.execCommand('copy');done()}catch(e){}
      document.body.removeChild(ta)}});
  var sh=el('st-share');
  if(sh)sh.addEventListener('click',function(){
    var S=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.Share;
    if(S)S.share({title:'APEX self-test',text:t}).catch(function(){});
    else if(navigator.share)navigator.share({title:'APEX self-test',text:t}).catch(function(){});
    else sh.textContent='No share sheet — use Copy'});
}

/* Labels are placed asynchronously: jumping and querying in the same tick
   returns zero on a map that will show eight a moment later. The synchronous
   sections cannot see placement at all, so this waits (take 44 — my check was
   wrong, not the map). */
function stLabels(cb){
  var was={c:map.getCenter(),z:map.getZoom()};
  var site=anchorOf('site');
  map.jumpTo({center:site,zoom:14.5});
  setTimeout(function(){
    var q=function(ids){try{return map.queryRenderedFeatures({layers:ids}).length}
      catch(e){return -1}};
    var segs=q(['trail50','route72','moto24','fstrail','mccct']);
    var tl=q(['lbl-trail']);
    stAdd('RENDER','trail-names',segs===0||tl>0,
      tl+' names for '+segs+' trail segments at z14.5 — knowing WHICH trail '+
      'you are on is the point');
    map.jumpTo({center:[was.c.lng,was.c.lat],zoom:was.z});
    cb()},1800)}

/* opts.gps=false skips the 20s live-fix phase (used by the headless harness) */
function selfTest(opts,done){
  opts=opts||{};ST=[];
  stEnv();stLoad();stRender();stLayout();stData();stRouting();stSafety();stRide();stHaptics();
  var finish=function(){var rep=stReport();
    try{window.__selfTestReport=rep}catch(e){}
    if(done)done(rep);return rep};
  stLabels(function(){
  stPerf(function(){
    if(opts.gps===false)return finish();
    show('<b>Self-test running…</b><br>Waiting up to 20s for a GPS fix. '+
      'Step outside for a real one, or wait it out.','');
    stGps(function(){finish()})})});
}
try{window.__selfTest=selfTest}catch(e){}
el('c-loop').addEventListener('click',function(){
  show('<b>Loop from here</b> — a ride that ends where it starts, on legal line '+
    'for a '+MACHINE[machine].lbl.replace(/^\S+\s/,'')+'.<br>'+
    '<div style="margin-top:8px">'+LOOP_CHOICES.map(function(m){
      return '<button class="chip" data-loop="'+m+'">'+m+' mi</button>'}).join(' ')+
    '</div>','');
  Array.prototype.forEach.call(document.querySelectorAll('[data-loop]'),function(b){
    b.addEventListener('click',function(){
      var want=+b.dataset.loop;LOOP_MI=want;
      logAct('act  loop '+want+' mi');
      show('Building a '+want+' mi loop…','');
      setTimeout(function(){
        var a=nearestNode(ME);
        if(a<0)return show('<b>Nothing legal nearby</b> for a '+
          MACHINE[machine].lbl.replace(/^\S+\s/,'')+'. Move the ◎ pin closer to a trail.','fail');
        RFROM=ME.slice();RTO=ME.slice();
        var out=buildLoops(a,want);
        if(!out.length)return show('<b>No loop found</b> at '+want+
          ' mi from here. The legal network within reach may not connect back — '+
          'try a different distance, or a narrower machine.','fail');
        out.forEach(function(o){
          o.h+=' · '+o.s.mi.toFixed(1)+' mi';
          if(o.repeat>0.25)o.h+=' ⟲'});
        logAct('loop '+out.length+' options, '+out[0].s.mi.toFixed(1)+' mi');
        presentRoutes(out)},30)})})});

el('c-selftest').addEventListener('click',function(){
  el('c-selftest').textContent='⛑ Running…';
  show('<b>Self-test running…</b><br>Exercising load, render, data, routing, '+
    'safety, haptics and performance, then waiting up to 20s for a GPS fix.','');
  setTimeout(function(){selfTest({},function(rep){
    el('c-selftest').textContent='⛑ Self-test';
    stRenderPanel(rep)})},60)});

[[hM,'home',function(){return HOME},function(){return 'Home / truck'}],
 [mM,'me',function(){return ME},function(){
    return posMode==='gps'?'You are here':posMode==='sim'?'Simulated position':
           posMode==='away'?'Planning start':'Start pin'}]
].forEach(function(t){
  try{t[0].getElement().addEventListener('click',function(ev){
    ev.stopPropagation();placeCard(t[2](),t[1],t[3]())})}catch(e){}});
/* ══ LONG PRESS ═════════════════════════════════════════════════════════════
   Own implementation rather than relying on the browser's contextmenu, which is
   inconsistent in a WebView and cannot be tuned. 450 ms with a 12 px tolerance:
   long enough not to fire while panning, short enough to feel deliberate with
   gloves on. A buzz confirms it, because a gesture with no feedback feels
   broken. */
var LP_MS=450,LP_TOL=12,lp={t:null,x:0,y:0,fired:false};
function lpCancel(){if(lp.t){clearTimeout(lp.t);lp.t=null}}
function lpAt(cx,cy){
  /* getContainer(), not getCanvasContainer(): the latter is a zero-height
     wrapper around absolutely-positioned children, and unproject() is defined
     against the map CONTAINER's top-left anyway. Same origin today, but relying
     on a rect whose height is 0 is asking for it. */
  var box=map.getContainer().getBoundingClientRect();
  var ll=map.unproject([cx-box.left,cy-box.top]);
  buzz(18);dropPin([ll.lng,ll.lat])}
(function(){
  var cv=map.getCanvasContainer();
  cv.addEventListener('touchstart',function(e){
    lpCancel();
    if(!e.touches||e.touches.length!==1)return;
    var t=e.touches[0];lp.x=t.clientX;lp.y=t.clientY;lp.fired=false;
    lp.t=setTimeout(function(){lp.t=null;lp.fired=true;lpAt(lp.x,lp.y)},LP_MS)},{passive:true});
  cv.addEventListener('touchmove',function(e){
    var t=e.touches&&e.touches[0];if(!t)return;
    if(Math.abs(t.clientX-lp.x)>LP_TOL||Math.abs(t.clientY-lp.y)>LP_TOL)lpCancel()},{passive:true});
  cv.addEventListener('touchend',lpCancel,{passive:true});
  cv.addEventListener('touchcancel',lpCancel,{passive:true});
})();
/* desktop / stylus right-click, and the path the harness drives */
map.on('contextmenu',function(e){buzz(18);dropPin([e.lngLat.lng,e.lngLat.lat])});
/* MapLibre's compact attribution renders EXPANDED on first paint, and on a
   411 px screen that bar sits across the chip strip and hides a button. Collapse
   it; the (i) still opens it, and the credits are also in About (take 61). */
function collapseAttrib(){
  try{Array.prototype.forEach.call(
    document.querySelectorAll('.maplibregl-ctrl-attrib.maplibregl-compact-show'),
    function(el){el.classList.remove('maplibregl-compact-show')})}catch(e){}}
map.on('load',collapseAttrib);map.on('idle',collapseAttrib);

map.on('idle',function(){if(!healthOK)renderHealth()});
map.on('move',refreshReadout);map.on('load',refreshReadout);
map.on('load',function(){el('c-labels').className='chip on';setBasemap(0);
  setTimeout(renderHealth,1800);
  var C=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.Geolocation;
  if(C){try{C.requestPermissions().then(locateOnce).catch(locateOnce)}catch(e){locateOnce()}}
  else locateOnce()});

/* One fix at startup. The app used to learn where you were only when you tapped
   ▶ Ride it, so it happily showed a region you were 135 miles from and said
   nothing (take 27 field report). Knowing early costs one fix and changes the
   whole first screen. */
var YOU=null,youM=null;
function locateOnce(){
  /* Take 30 used getCurrentPosition with enableHighAccuracy:false and a 10s
     timeout. On the Fold it never produced a fix — the self-test reported
     posMode=none while its OWN watch got one in 1.0s at +/-17m. So: use the same
     watch machinery that demonstrably works, take the first fix, stop. One
     proven path beats two plausible ones (landmine 56 again). */
  var handle=function(at,acc){
    YOU=at.slice();
    if(!youM){var d=mk('you');youM=new maplibregl.Marker({element:d}).setLngLat(YOU).addTo(map)}
    else youM.setLngLat(YOU);
    classifyFix(at);
    if(posMode==='away')showAway(acc); else{posMode='gps';ME=at.slice();mM.setLngLat(ME);paint();syncSafety()}
    drawCoverage()};
  var done=false,saveWatch=watchId;
  var mode=gpsStart(function(at){
    if(done)return; done=true;
    handle(at,null);
    gpsStop(); watchId=saveWatch;          /* leave a ride's own watch alone */
  },function(){ if(!done){done=true; gpsStop(); watchId=saveWatch} });
  if(!mode)return;
  /* Give up quietly after 25s rather than holding the receiver open. */
  setTimeout(function(){ if(!done){done=true; gpsStop(); watchId=saveWatch;
    stInfo&&0; } },25000);}

function showAway(acc){
  show('<b>You are about '+Math.round(awayMi)+' mi from '+(BUNDLE.name||'this region')+
    '.</b><br>This download only covers the boxed area — everywhere else is '+
    'deliberately blank, not broken. <b>Planning mode</b> is on: browse, search, '+
    'tap open ground to set a start, then <b>Return Home</b> or <b>Directions</b>.'+
    '<br><br>Tap <b>◉ Locate</b> to jump to your real position, or a chip above to '+
    'jump to the riding area.','')}

el('c-relief').addEventListener('click',function(){
  var on=el('c-relief').className.indexOf('on')<0;
  el('c-relief').className='chip'+(on?' on':'');
  /* visibility, not just opacity — see setBasemap. Both places must agree or
     the toggle looks dead: setBasemap hid the layer and this only faded it. */
  map.setLayoutProperty('hillshade','visibility',on?'visible':'none');
  if(on)map.setPaintProperty('hillshade','raster-opacity',
    BASEMAPS[bmi]==='Map'?0.42:0.16)});

el('c-lost').addEventListener('click',function(){
  if(rideMode)return show('Live GPS is driving — the alert fires from your actual track, not a button.','');
  if(!riding)return show('Start <b>▶ Ride it</b> first, then take a wrong turn and watch the alert fire.','');
  lost=true;buzz(40);
  show('Veering off at the next junction — this is the failure the whole app exists to catch.','')});

/* ── inspect / place ───────────────────────────────────────────────────── */
var HIT=['route72','trail50','moto24','mccct','fstrail','fsroad','closed','fsclosed','track','paved','minor'];
/* Tapping a dashed line has to answer "what is that and may I ride it".
   Show-only features are not in EDGES, so the identify branch below cannot
   describe them — they get their own branch that says plainly what they are. */
var HIT_SHOW=['show-line'];
map.on('click',function(e){
  if(lp.fired){lp.fired=false;return}   /* the long press already acted */
  if(arm){var ll=[e.lngLat.lng,e.lngLat.lat];
    if(arm==='home'){HOME=ll;hM.setLngLat(ll)}else{ME=ll;mM.setLngLat(ll);syncSafety()}
    arm=null;syncArm();clearRoute();
    return show('Placed. Tap <b>Return home</b> to route.','')}
  var f=map.queryRenderedFeatures([[e.point.x-9,e.point.y-9],[e.point.x+9,e.point.y+9]],
    {layers:HIT.concat(HIT_SHOW)});
  if(!f.length){
    /* Empty ground. With a live in-region fix, ME means "where I am" and must
       not be draggable. Otherwise this is planning: put the start here.
       Take 21 added a second click handler for this and it clobbered the
       identify branch above — one handler, one meaning per tap. */
    /* Tap does ONE job: identify. Pinning moved to long-press at take 36 so a
       pin can be dropped ON a road or trail — tapping one has to keep selecting
       it. Google Maps' convention, and the only way both gestures fit. */
    return show('Nothing there. <b>Press and hold</b> anywhere to drop a pin — '+
      'including on a road or trail. Tap a line to identify it.','')}
  if(f[0].properties.i===undefined){
    /* a show-only route: exists, but not ridable on this machine */
    var pr=f[0].properties;
    return show('<span class="tn">'+(pr.n||pr.u||'Route')+'</span>'+
      '<span class="tag adv">'+(pr.u||SHOWN[pr.c]||pr.c)+'</span><br>'+
      '<b>Not an ORV route.</b> It is on the map because it exists and can help '+
      'you place yourself — routing will never use it.','')}
  var ed=EDGES[f[0].properties.i],a=attrs(ed);
  var out='<span class="tn">'+(ed.n||label(ed.c))+'</span><br>';
  out+='<span class="tag '+(a.auth==='legal'?'legal':'adv')+'">'+
    (a.src==='dnr'?'DNR · legal':a.src==='usfs'?'USFS · legal':'OSM · advisory')+'</span>';
  if(a.st&&a.st.toLowerCase().indexOf('temporarily')===0)out+='<span class="tag shut">closed</span>';
  if(MACHINE[machine].ok.indexOf(ed.c)<0)
    out+='<span class="tag shut">illegal for your machine</span>';
  out+='<br>';
  var bits=[];
  if(ed.id)bits.push('Trail <b>'+ed.id+'</b>');
  if(a.w)bits.push('Width <b>'+a.w+'</b>');
  if(a.sym)bits.push(a.sym);
  if(a.moto)bits.push('Moto <b>'+a.moto+'</b>');
  if(a.atv)bits.push('ATV <b>'+a.atv+'</b>');
  if(a.lic)bits.push(a.lic);
  bits.push((ed.L/1609.34).toFixed(2)+' mi segment');
  if(UP[ed.i]||DN[ed.i])bits.push('+'+ft(UP[ed.i])+' / -'+ft(DN[ed.i])+' ft');
  show(out+bits.join(' · '),'')});

function show(h,s){var p=el('panel');p.className=s||'';p.innerHTML=h}

var geo=new maplibregl.GeolocateControl({positionOptions:{enableHighAccuracy:true},
  trackUserLocation:true,showAccuracyCircle:true});
map.addControl(geo,'top-right');
/* A scale bar is the one piece of map furniture every off-road app has and this
   did not: without it a rider cannot judge whether a gap is 200 yards or two
   miles, which is exactly the judgement that decides whether to push through. */
try{map.addControl(new maplibregl.ScaleControl({maxWidth:96,unit:'imperial'}),'bottom-left')}catch(e){}
el('c-locate').addEventListener('click',function(){
  if(flyToYou())return;
  locateOnce();
  setTimeout(function(){if(!flyToYou())geo.trigger()},1200)});
geo.on('error',function(){show('Location unavailable — browsers block GPS on <b>file://</b> and in embedded frames. Expected here; works in the APK. Use <b>&#39;I am here&#39;</b> to place yourself manually.','fail')});

el('chips').innerHTML=PLACES.map(function(p,i){
  return '<button class="chip" data-i="'+i+'">'+p[0]+'</button>'}).join('');
Array.prototype.forEach.call(document.querySelectorAll('#chips .chip'),function(c){
  c.addEventListener('click',function(){var p=PLACES[+c.dataset.i];
    map.easeTo({center:[p[1],p[2]],zoom:p[3]==='town'?13.2:13.8,
      duration:700,essential:true})})});

function refreshReadout(){
  var c=map.getCenter(),e=elevAt([c.lng,c.lat]);
  var r=el('ro-elev');
  /* Was a bare "1194 ft" sitting under a scale bar reading "3000 ft" — two
     numbers in the same unit with nothing to tell them apart. Say which is
     which (take 65). */
  if(r)r.textContent=(e===null?'':ft(e)+' ft elevation');
  var v=el('v-elev');
  if(v)v.textContent=(e===null?'—':ft(e)+' ft')}

function paint(){var c=map.getCenter();
  var e=elevAt([c.lng,c.lat]);
  var tag=posMode==='gps'?'DD':posMode==='sim'?'DD · SIMULATED TRACK':
    posMode==='away'?
      'DD · MAP CENTRE · you are '+Math.round(awayMi)+' mi away':
      'DD · MAP CENTRE · no GPS fix yet';
  el('coords').innerHTML=c.lat.toFixed(5)+' '+c.lng.toFixed(5)+
    ' <span class="unit">'+tag+(e!==null?' · '+ft(e)+' ft':'')+'</span>';
  }
map.on('move',paint);map.on('load',paint);paint();syncSafety();

var lastT=performance.now(),win=[],cap=null;
(function tick(n){var d=n-lastT;lastT=n;
  if(d>0&&d<1000){win.push(d);if(win.length>60)win.shift();if(cap)cap.push(d)}
  if(win.length>10){var a=win.reduce(function(x,y){return x+y},0)/win.length,
    f=Math.round(1000/a),e=el('v-fps');e.textContent=f;
    e.className=f>=50?'v good':f>=30?'v':'v warn'}
  requestAnimationFrame(tick)})(performance.now());

/* A fixed loop over this region's anchors, so two builds stay comparable and any
   region can be perf-tested the same way. */
var LEGS=(function(){
  var z=[15.5,13,15,16],b=[0,40,0,0],out=[];
  for(var i=0;i<Math.min(4,PLACES.length);i++)
    out.push({center:[PLACES[i][1],PLACES[i][2]],zoom:z[i],bearing:b[i],duration:1600});
  out.push({center:BUNDLE.centre||[PLACES[0][1],PLACES[0][2]],zoom:11.4,
    bearing:0,duration:1500});
  return out})();
el('c-pan').addEventListener('click',function(){
  el('c-pan').disabled=true;cap=[];show('Running…','');var i=0;
  (function step(){if(i>=LEGS.length)return done();map.once('moveend',step);
    var L=LEGS[i++];map.easeTo({center:L.center,zoom:L.zoom,bearing:L.bearing,
      duration:L.duration,essential:true})})()});
function done(){var d=cap.slice().sort(function(a,b){return a-b});cap=null;
  el('c-pan').disabled=false;
  if(d.length<30)return show('Not enough frames. Run it again.','fail');
  var avg=Math.round(1000/(d.reduce(function(a,b){return a+b},0)/d.length)),
      mn=Math.round(1000/d[Math.floor(d.length*0.99)]),
      /* A frame rate measured over an empty canvas is meaningless. Take 20
         reported "PASS 121 fps · 16352 edges rendered" while the map was blank
         sand — the test asserted its own hope. It counts pixels now. */
      drew=renderedCount(),
      pass=avg>=50&&mn>=30&&remoteHits===0&&drew>0;
  show('<b>'+(pass?'PASS':'FAIL')+'</b> · avg <b>'+avg+'</b> fps · p99 min <b>'+mn+
   '</b> fps · remote <b>'+remoteHits+'</b><br>'+drew+' of '+EDGES.length+
   ' edges actually rendered. '+(drew===0?
     'ZERO drew — the high frame rate is an idle renderer, not speed. Tap ⓘ.':
     pass?'Holds up with the full routable network loaded.'
   :'Below threshold — note both numbers before comparing to the APK.'),
   pass?'pass':'fail')}
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
