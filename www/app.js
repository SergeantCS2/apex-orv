 
(function(){
var WATER,GR,TR,SHADE,SAT,SATB,GLYPHS,BUNDLE={state:'unknown',absent:[]};

 
var SPLASH=(function(){
  var el,fill,say,started=0,done=0,pct=0,lifted=false;
  function grab(){
    if(!el)el=document.getElementById('splash');
    if(!fill)fill=document.getElementById('sp-fill');
    if(!say)say=document.getElementById('sp-say')}
  function set(p,msg){grab();
    p=Math.max(pct,Math.min(100,p));pct=p;
    if(fill)fill.style.width=p.toFixed(0)+'%';
    if(msg&&say)say.textContent=msg}
  function lift(){grab();if(lifted)return;lifted=true;set(100);
    if(!el)return;el.className='gone';
    setTimeout(function(){try{el.parentNode.removeChild(el)}catch(e){}},420)}
  return {start:function(){started++},
     
    step:function(){done++;set(done/Math.max(started,12)*70,'Loading Michigan')},
    style:function(){set(86,'Drawing the map')},
    ready:function(){set(100,'Ready');lift()},
    lift:lift,pct:function(){return pct},gone:function(){return lifted}}})();

function j(u){SPLASH.start();return fetch(u).then(function(r){
  if(!r.ok)throw new Error(u+' '+r.status);return r.json()})
  .then(function(v){SPLASH.step();return v})}
function blob(u){SPLASH.start();return fetch(u).then(function(r){
  if(!r.ok)throw new Error(u+' '+r.status);return r.blob()})
  .then(function(b){SPLASH.step();return URL.createObjectURL(b)})}

function fatal(msg,detail){
  document.body.innerHTML='<div style="padding:26px;font:400 14px/1.6 Barlow,'+
   'system-ui,sans-serif;color:#F5EFE2;background:#14120F;height:100%">'+
   '<div style="font:700 12px/1 Barlow,system-ui,letter-spacing:.17em;text-transform:uppercase;'+
   'color:#E2570F;margin-bottom:14px">APEX ORV</div>'+
   '<b style="font-size:17px">'+msg+'</b><br><br>'+
   '<span style="color:#9A9184">'+detail+'</span></div>'}

 
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
     
    have.places?j('bundle/'+have.places):Promise.resolve(null),
     
    have.contour?j('bundle/'+have.contour):Promise.resolve(null),
     
    have.paddle?j('bundle/'+have.paddle):Promise.resolve(null),
    have.ground?j('bundle/'+have.ground):Promise.resolve(null),
     
    have.areas?j('bundle/'+have.areas):Promise.resolve(null),
     
    have.photos?j('bundle/'+have.photos):Promise.resolve(null),
    have.publicland?j('bundle/'+have.publicland):Promise.resolve(null),
     
    have.gauges?j('bundle/'+have.gauges):Promise.resolve(null),
     
    have.nf?j('bundle/'+have.nf):Promise.resolve(null)]);
}).then(function(r){
  GR=r[0];TR=r[1];GLYPHS=r[2];WATER=r[3];SHADE=r[4];SAT=r[5];SATB=r[6].b;CTX=r[7];ADDR=r[8];SHOW=r[9];
  POIS=r[10];CONT=r[11];PADDLE=r[12];LAND=r[13];AREAS=r[14];PHOTOS=r[15];PUBS=r[16];GAUGES=r[17];NF=r[18];
  start();
}).catch(function(e){
  if(String(e.message).indexOf('required artifact')<0)
    fatal('Could not load this region',String(e.message)+
     '<br><br>The bundle may be corrupt. Re-download it on wifi.');
});

function start(){
var el=function(i){return document.getElementById(i)};
 
var SPL=(typeof SPLASH!=='undefined'&&SPLASH)?SPLASH:{start:function(){},
  step:function(){},style:function(){},ready:function(){},lift:function(){},
  pct:function(){return 100},gone:function(){return true}};
var remoteHits=0,netB=el('b-net');

function isRemote(r){try{var u=new URL(r,location.href);
 if(['data:','blob:','file:'].indexOf(u.protocol)>=0)return false;
 return u.origin!==location.origin}catch(e){return false}}
 
var INAPP_HOSTS=['basemap.nationalmap.gov','waterservices.usgs.gov'];
var inappHits=0;
function watch(r){if(!isRemote(r))return;
 try{var h=new URL(r,location.href).hostname;
   if(INAPP_HOSTS.indexOf(h)>=0){inappHits++;
     netB.textContent='NET '+inappHits+' IN-APP';netB.className='badge good';return}
 }catch(e){}
 remoteHits++;
 netB.textContent='NET '+remoteHits+' REMOTE';netB.className='badge bad'}
var nf=window.fetch&&window.fetch.bind(window);
if(nf)window.fetch=function(i,o){watch(typeof i==='string'?i:(i&&i.url)||'');return nf(i,o)};
var no=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(m,u){watch(u);return no.apply(this,arguments)};
netB.textContent='NET CLEAN';netB.className='badge good';

function decode(a){var p=[],x=0,y=0;for(var i=0;i<a.length;i+=2){x+=a[i];y+=a[i+1];
 p.push([x/1e5,y/1e5])}return p}

 
 
var MACH_FLAG={bike:'moto',quad:'atv',sxs:null,walk:null};

 
var RESTRICT=[
  {m:'Off road motorcycles are prohibited',
   ban:['bike'], season:'May 1 – Nov 1',
   say:'Off-road motorcycles are prohibited. ORVs under 65 inches, May 1 – Nov 1.'},
  {m:'including off road motorcycles only between the dates of May 16th and March 14th',
   ban:['sxs'], season:'May 16 – Mar 14',
   say:'ORVs under 65 inches including motorcycles, May 16 – Mar 14.'},
  {m:'including off road motorcycles only',
   ban:['sxs'], say:'ORVs under 65 inches, including motorcycles.'},
  {m:'ORVs Less Than 65 Inches Only',
   ban:['sxs'], say:'ORVs under 65 inches only.'},
  {m:'MDOT ROW',
   ban:[], season:'May 1 – Nov 30',
   say:'Highway right-of-way connector, open May 1 – Nov 30.'},
  {m:'4x4 And High Clearance Required',
   ban:[], say:'4x4 and high clearance required — rough going.'},
  {m:'High Clearance Required',
   ban:[], say:'High clearance required — rough going.'},
  {m:'Snowmobile Season',
   ban:[], say:'Snowmobile season December 1 – March 31.'}
];

function restrictOf(e){
  var a=attrs(e),t=a.rst;
  if(!t)return null;
  for(var i=0;i<RESTRICT.length;i++)
    if(t.indexOf(RESTRICT[i].m)>=0)return RESTRICT[i];
   
  return {m:null,ban:[],say:t,unknown:true}}

 
var _legalMemo={};
function machineLegal(e){
  var mk=machine+':'+e.bi+':'+e.c, hit=_legalMemo[mk];
  if(hit!==undefined)return hit;
  return (_legalMemo[mk]=_machineLegal(e))}
function _machineLegal(e){
  if(MACHINE[machine].ok.indexOf(e.c)<0)return false;
   
  var _r=restrictOf(e);
  if(_r&&_r.ban&&_r.ban.indexOf(machine)>=0)return false;
  if(e.c==='closed'||e.c==='fsclosed')return false;
  var fl=MACH_FLAG[machine];
  if(!fl)return true;                        
  var v=B[e.bi>=0?e.bi:0];
  if(e.bi<0||!v)return true;                 
  var mi=BK.indexOf('moto'),ai=BK.indexOf('atv');
  var has=(mi>=0&&v[mi])||(ai>=0&&v[ai]);
  if(!has)return true;                       
  var k=BK.indexOf(fl);
  if(k<0)return true;
  var val=v[k];
   
  return String(val||'').toLowerCase()==='open'}

var NODES=decode(GR.n), CLS=GR.cls, NM=GR.nm, BK=GR.bk, B=GR.b;
 
var EDGES=GR.e.map(function(e,i){return {a:e[0],b:e[1],L:e[2],c:CLS[e[3]],
  n:e[4]>=0?NM[e[4]]:null,id:e[5]>=0?NM[e[5]]:null,bi:e[6],i:i,
  d:e.length<8||e[7]!==0,
   
  rf:(e.length>8&&e[8]>=0)?NM[e[8]]:null}});
function attrs(e){var o={};if(e.bi<0)return o;
  var v=B[e.bi];for(var k=0;k<BK.length;k++)if(v[k])o[BK[k]]=v[k];return o}

var ADJ=[];for(var i=0;i<NODES.length;i++)ADJ.push([]);
EDGES.forEach(function(e){ADJ[e.a].push(e);ADJ[e.b].push(e)});

el('b-src').textContent='GRAPH '+EDGES.length;
el('b-src').className='badge good';

 
 
var MACHINE={
  bike:{lbl:'Dirt bike 24"',ic:'dirtbike',ok:['route72','trail50','moto24','mccct','fstrail','fsroad','paved','minor','track']},
  quad:{lbl:'Quad 50"',ic:'fourwheel',ok:['route72','trail50','mccct','fstrail','fsroad','paved','minor','track']},
  sxs:{lbl:'Side-by-side 72"',ic:'fourwheel',ok:['route72','fsroad','paved','minor']},
   
  walk:{lbl:'On foot',ic:'walk',ok:['foot','route72','trail50','moto24','mccct','fstrail','fsroad','paved','minor','track'],spd:3},
   
  kayak:{lbl:'Kayak',ic:'paddle',ok:[],mph:3.0,spread:0.5},
  canoe:{lbl:'Canoe',ic:'paddle',ok:[],mph:2.5,spread:0.5},
  raft:{lbl:'Raft / tube',ic:'raft',ok:[],mph:1.8,spread:0.4}
};
function spd(e){var m=MACHINE[machine];return (m&&m.spd)||SPEED[e.c]||14}
 
var ORDER=['bike','quad','sxs','walk'],machIdx=0,machine='bike',rideMachine='bike';
var WORDER=['kayak','canoe','raft'],waterCraft='kayak';
var SPEED={route72:25,fsroad:22,trail50:16,fstrail:14,mccct:11,moto24:11,
  paved:45,minor:28,track:14};
var EFFORT={paved:1,route72:1.05,fsroad:1.1,minor:1.15,trail50:1.5,fstrail:1.7,
  track:1.8,mccct:2.3,moto24:2.6};
var PAVED={paved:1,minor:1};
var HARD=['paved','minor','route72','fsroad','track','trail50','fstrail','mccct','moto24'];

 
var wf=[],wlab=[];
Object.keys(WATER.l).forEach(function(c){var poly=(c==='water');
  var nms=(WATER.nm&&WATER.nm[c])||[];
  WATER.l[c].forEach(function(e,ix){var r=decode(e);
    wf.push({type:'Feature',properties:{c:c},
      geometry:poly?{type:'Polygon',coordinates:[r]}:{type:'LineString',coordinates:r}});
     
    var nm=nms[ix];
    if(!nm)return;
    if(poly){
       
      var A=0,cx=0,cy=0;
      for(var k=0;k<r.length-1;k++){
        var f=r[k][0]*r[k+1][1]-r[k+1][0]*r[k][1];
        A+=f;cx+=(r[k][0]+r[k+1][0])*f;cy+=(r[k][1]+r[k+1][1])*f}
      var pt;
      if(Math.abs(A)>1e-12){pt=[cx/(3*A),cy/(3*A)]}
      else{pt=r[(r.length/2)|0]}           
      wlab.push({type:'Feature',properties:{n:nm,c:c},
        geometry:{type:'Point',coordinates:pt}});
    }else{
      wlab.push({type:'Feature',properties:{n:nm,c:c},
        geometry:{type:'LineString',coordinates:r}});
    }})});

 
function labelFor(e){
  if(!e.n&&!e.id)return '';
  var n=e.n||'';
  var m=n.match(/\(([A-Z0-9]{2,5})\)\s*$/);
  if(m)n=m[1];
  else if(n.length>24)n=n.replace(/\s+(Trail|Route|Road)$/i,'');
  if(e.id&&e.id!==n&&n)return n+' · '+e.id;
  return n||e.id}
 
function refLabel(r){
  if(!r)return null;
  var parts=r.split(';').map(function(x){return x.trim()}).filter(Boolean);
  return parts.length?parts.slice(0,2).join(' · '):null}

var nf2=EDGES.filter(function(e){return e.d}).map(function(e){return {type:'Feature',
  properties:{c:e.c,i:e.i,lb:labelFor(e),rf:refLabel(e.rf)},
  geometry:{type:'LineString',coordinates:decode(GR.g[e.i])}}});

 
var NETLO=[],NETLO_MS=0,NETLO_ERR=null,
    NETLO_CLS=['route72','trail50','moto24','mccct','fstrail','fsroad','fsclosed','closed'],
     
    NETLO_SKIP={track:'90.1-94.7% kept at z7; 704,198 stroke vertices',
                paved:'89.6-96.9% kept at z7; 190,401 stroke vertices',
                minor:'Hybrid draws it from z11.5 only'};
try{
  var _nl0=Date.now(),NFI=[];
  nf2.forEach(function(f){if(NETLO_CLS.indexOf(f.properties.c)>=0)NFI[f.properties.i]=f.geometry.coordinates});
  NETLO=chainStrokes(function(e){return NETLO_CLS.indexOf(e.c)>=0?e.c:''},function(i){return NFI[i].slice()})
    .map(function(f,k){return {type:'Feature',properties:{c:f.properties.c,lo:1,s:k},
      geometry:f.geometry}});
  NETLO_MS=Date.now()-_nl0;
}catch(e){NETLO=[];NETLO_ERR=String(e&&e.message||e)}
var NETLO_Z=NETLO.length?11:0;
 
function netF(f){return NETLO_Z?['step',['zoom'],['all',f,['==',['get','lo'],1]],
  NETLO_Z,['all',f,['!',['has','lo']]]]:f}
 
function netMapF(f){return NETLO_Z?['all',f,['!',['has','lo']]]:f}
 
function netBaseF(f){
  if(Array.isArray(f)&&f[0]==='all'&&f.length===3)return f[1];
  if(Array.isArray(f)&&f[0]==='step'&&Array.isArray(f[4]))return f[4][1];
  return f}
 
var NETFT={},NETF_HYB=false;
function netLyrF(id,f,cls){
  if(cls&&NETLO_CLS.indexOf(cls)<0)return f;
  NETFT[id]={m:netMapF(f),h:netF(f)};return NETFT[id].m}

 
 
function strokeLen(pts){
  var m=0;
  for(var i=1;i<pts.length;i++){
    var dx=(pts[i][0]-pts[i-1][0])*79000,dy=(pts[i][1]-pts[i-1][1])*111320;
    m+=Math.sqrt(dx*dx+dy*dy)}
  return Math.round(m)}

 
 
 
function placeDist(p){
  if(!ME)return '';
  var d=mi(ME,p);
  return d.toFixed(d<10?1:0)+' mi '+compass(bearing(ME,p))+' of '+meNoun();}

 
function chainStrokes(key,geo){
  key=key||labelFor;
  geo=geo||function(i){return decode(GR.g[i])};
  var byKey={};
  EDGES.forEach(function(e){
     
    if(!e.d)return;
    var lb=key(e); if(!lb)return;
    var k=e.c+'\u0000'+lb;
    (byKey[k]||(byKey[k]=[])).push(e)});
  var feats=[];
  Object.keys(byKey).forEach(function(k){
    var list=byKey[k],cls=k.split('\u0000')[0],lb=k.split('\u0000')[1];
    var adj={},used={};
    list.forEach(function(e){
      (adj[e.a]||(adj[e.a]=[])).push(e);(adj[e.b]||(adj[e.b]=[])).push(e)});
    function walk(from,e){
       
      var pts=geo(e.i),cur=(e.a===from?e.b:e.a);
      used[e.i]=1;
      if(e.a!==from)pts.reverse();
      for(;;){
        var nx=null,cand=adj[cur]||[];
        for(var i=0;i<cand.length;i++)if(!used[cand[i].i]){nx=cand[i];break}
        if(!nx)break;
        used[nx.i]=1;
        var g=geo(nx.i);
        if(nx.a!==cur)g.reverse();
        for(var q=1;q<g.length;q++)pts.push(g[q]);
        cur=(nx.a===cur?nx.b:nx.a)}
      return pts}
     
    var starts=[];
    Object.keys(adj).forEach(function(n){if(adj[n].length===1)starts.push(+n)});
    starts.forEach(function(n){
      (adj[n]||[]).forEach(function(e){if(!used[e.i]){
        var co=walk(n,e);
        feats.push({type:'Feature',properties:{c:cls,lb:lb,px:strokeLen(co)},
          geometry:{type:'LineString',coordinates:co}})}})});
    list.forEach(function(e){if(!used[e.i]){
      var co2=walk(e.a,e);
      feats.push({type:'Feature',properties:{c:cls,lb:lb,px:strokeLen(co2)},
        geometry:{type:'LineString',coordinates:co2}})}});
  });
  return feats}
 
var SHOWN={foot:'foot / hike',horse:'equestrian',snow:'ski',snowmob:'snowmobile',
  nfsmoto:'NFS trail — MVUM governs',cycle:'cycleway',race:'raceway',
  bike:'bike trail',mou:'permit / MOU',railtrail:'rail trail',path:'path (unnamed, not routed)'};
var showFeats=(SHOW&&SHOW.r?SHOW.r:[]).map(function(r){
  return {type:'Feature',properties:{c:r.c,n:r.n||'',u:r.u||SHOWN[r.c]||r.c},
    geometry:{type:'LineString',coordinates:r.g}}});

 
 
 
var POIKIND={
  fuel:     {c:'#701A1A', h:'Fuel',        r:1, s:'circle', g:'fuel'},
  trailhead:{c:'#A0441C', h:'Trailhead',   r:1, d:1, s:'drop', g:'apex-th'},
  camp:     {c:'#75522E', h:'Campground',  r:2, d:1, s:'square', g:'tent'},
  launch:   {c:'#1873B1', h:'Boat launch', r:2, d:1, s:'drop', g:'sailboat'},
  beach:    {c:'#806A10', h:'Beach',       r:3, d:1, s:'drop', g:'umbrella'},
  dayuse:   {c:'#386C1D', h:'Day use',     r:3, d:1, s:'drop', g:'trees'},
   
  system:   {c:'#A46103', h:'Trail system', r:1, d:1, s:'hex', g:'footprints'},
   
  lighthouse:{c:'#A52941', h:'Lighthouse', r:0, d:1, s:'drop', g:'apex-lighthouse'},
  marina:   {c:'#0E2D56', h:'Marina',      r:2, d:1, s:'drop', g:'anchor'},
  ski:      {c:'#3A33B0', h:'Ski & snowboard hill', r:1, d:1, s:'drop', g:'mountain-snow'},
  livery:   {c:'#118562', h:'Canoe & kayak livery', r:1, d:1, s:'drop', g:'kayak'},
  mtb:      {c:'#1F5131', h:'MTB trail system', r:1, d:1, s:'hex', g:'bike'},
  store:    {c:'#5B377C', h:'Store',       r:3, s:'circle', g:'shopping-bag'},
  food:     {c:'#A23182', h:'Food',        r:4, s:'circle', g:'utensils'},
  view:     {c:'#843991', h:'Viewpoint',   r:4, d:1, s:'drop', g:'binoculars'},
  info:     {c:'#3E526C', h:'Information', r:5, s:'circle', g:'info'},
  water:    {c:'#0B71CA', h:'Drinking water', r:5, s:'circle', g:'droplet'},
  toilet:   {c:'#1C7C72', h:'Toilets',     r:6, s:'circle', g:'toilet'},
  shelter:  {c:'#525251', h:'Shelter',     r:6, s:'square', g:'warehouse'}
};
 
var APEX_GLYPHS={
  'apex-th':'<path d="M3 6h8" /> <path d="M7 6v12" /> <path d="M14 6v12" /> <path d="M21 6v12" /> <path d="M14 12h7" />',
  'apex-lighthouse':'<path d="M8 22h8" /> <path d="M9 22l1-12h4l1 12" /> <path d="M10 10V7h4v3" /> <path d="M9 7l3-3 3 3" /> <path d="M4 7l2 .5" /> <path d="M20 7l-2 .5" />'
};
function badgeMarkup(g){return APEX_GLYPHS[g]||LUCIDE[g]||''}
 
var BADGE_BARE={info:1,'circle-parking':1};
 
var BADGE_PAD={launch:'launch',camp:'camp',
  access:{c:'#175A63', h:'Canoe access', s:'drop', d:1, g:'waves-arrow-down'},
  parking:{c:'#797565', h:'Parking', s:'circle', g:'circle-parking'}
};
 
var BADGE_LW=2.25;
var BADGE_URL={};        
 
var BADGE_CV={},BADGE_DRAWN=[],BADGE_ENC0=null;
var BADGE_MISSING=[];    
 
var BADGE_FAMILY=[{s:'drop',w:'teardrop places to go'},{s:'circle',w:'round services'},
  {s:'square',w:'square camps and shelters',of:['camp','shelter']},
  {s:'hex',w:'hexagon trail systems',of:['system','mtb']},{k:'trailhead',w:'lettered trailheads'}];
var BADGE_DROPS=Object.keys(POIKIND).filter(function(k){return POIKIND[k].s==='drop'});
var PAD_DROPS=Object.keys(BADGE_PAD).filter(function(k){return (badgeSpec('pad-'+k)||{}).s==='drop'});
function badgeSpec(k){
  k=String(k);
  if(k.indexOf('pad-')===0){var p=BADGE_PAD[k.slice(4)];
    return typeof p==='string'?(POIKIND[p]||null):(p||null)}
  return POIKIND[k]||null}
function badgeURL(name){
  if(BADGE_URL[name]===undefined&&BADGE_CV[name]){
    try{BADGE_URL[name]=BADGE_CV[name].toDataURL('image/png')}catch(e){BADGE_URL[name]=''}
    BADGE_CV[name]=null}
  return BADGE_URL[name]||''}
function padName(k){return k==='dam'?'Dam':((badgeSpec('pad-'+k)||{}).h||k)}
 
function badgeShape(x,s,dy){
  x.beginPath();
  if(s==='circle')x.arc(13,13+dy,11,0,Math.PI*2);
  else if(s==='square'){var a=2.75,b=23.25,r=4.5;x.moveTo(a+r,a+dy);
    x.arcTo(b,a+dy,b,b+dy,r);x.arcTo(b,b+dy,a,b+dy,r);
    x.arcTo(a,b+dy,a,a+dy,r);x.arcTo(a,a+dy,b,a+dy,r)}
  else if(s==='hex'){for(var i=0;i<6;i++){var t=-Math.PI/2+i*Math.PI/3;
    if(i)x.lineTo(13+12*Math.cos(t),13+dy+12*Math.sin(t));
    else x.moveTo(13+12*Math.cos(t),13+dy+12*Math.sin(t))}}
  else{var cy=12.5+dy,tip=34.8+dy,h=Math.acos(11/(tip-cy)),t1=Math.PI/2-h,t2=Math.PI/2+h;
    x.moveTo(13,tip);x.lineTo(13+11*Math.cos(t1),cy+11*Math.sin(t1));
    x.arc(13,cy,11,t1,t2,true)}
  x.closePath()}
 
function badgeGlyph(x,g,cx,cy,box,lw){
  var mk=badgeMarkup(g);
  if(!mk||typeof Path2D==='undefined')return false;
  function at(a,n){var m=new RegExp('\\b'+n+'="([^"]*)"').exec(a);return m?m[1]:null}
  function num(a,n){return +(at(a,n)||0)}
  var p=new Path2D(),re=/<(path|circle|line|rect)\b([^>]*)>/g,m,n=0;
  while((m=re.exec(mk))){var t=m[1],a=m[2];
    if(t==='path')p.addPath(new Path2D(at(a,'d')));
    else if(t==='circle'){var r=num(a,'r');if(BADGE_BARE[g]&&r>=9.5)continue;
      p.moveTo(num(a,'cx')+r,num(a,'cy'));p.arc(num(a,'cx'),num(a,'cy'),r,0,Math.PI*2)}
    else if(t==='line'){p.moveTo(num(a,'x1'),num(a,'y1'));p.lineTo(num(a,'x2'),num(a,'y2'))}
    else p.rect(num(a,'x'),num(a,'y'),num(a,'width'),num(a,'height'));
    n++}
  if(!n)return false;
  x.save();x.translate(cx-box/2,cy-box/2);x.scale(box/24,box/24);
  x.lineWidth=lw;x.lineCap='round';x.lineJoin='round';x.strokeStyle='#FFFFFF';
  x.stroke(p);x.restore();
  return true}

function makeBadges(){
   
  var done={};
  if(!map.addImage)return;
  if(!document.createElement('canvas').getContext)return;
  function draw(name,spec,stack){
    if(done[name])return;done[name]=1;
    try{
      if(!spec||!spec.s)throw new Error('no badge spec');
      var S=2,drop=(spec.s==='drop'&&!stack),H=drop?36:26,c=document.createElement('canvas');
      c.width=26*S;c.height=H*S;
      var x=c.getContext('2d'),ok;x.scale(S,S);
      if(stack){
         
        ok=badgeGlyph(x,spec.g,13,13,16,BADGE_LW*1.35)}
      else{
        badgeShape(x,spec.s,0.6);x.fillStyle='rgba(0,0,0,.22)';x.fill();
        badgeShape(x,spec.s,0);x.fillStyle=spec.c;x.fill();
        x.lineWidth=1.6;x.lineJoin='round';x.strokeStyle='#FFFFFF';x.stroke();
        ok=badgeGlyph(x,spec.g,13,drop?12.5:13,14,BADGE_LW)}
      if(!ok)BADGE_MISSING.push(name+(typeof Path2D==='undefined'?' (no Path2D)':' (glyph '+spec.g+')'));
      map.addImage(name,x.getImageData(0,0,26*S,H*S),{pixelRatio:S});
      BADGE_DRAWN.push(name);
       
      if(!stack)BADGE_CV[name]=c;
    }catch(e){BADGE_MISSING.push(name+' ('+((e&&e.message)||e)+')')}}
  Object.keys(POIKIND).forEach(function(k){draw('bdg-'+k,POIKIND[k])});
  Object.keys(POIKIND).forEach(function(k){draw('stk-'+k,POIKIND[k],true)});
  Object.keys(BADGE_PAD).forEach(function(k){draw('bdg-pad-'+k,badgeSpec('pad-'+k))});
  BADGE_ENC0=Object.keys(BADGE_URL).length;
   
  if(!done['mi-diamond']&&map.addImage&&document.createElement('canvas').getContext){done['mi-diamond']=1;
    var S2=2,cv=document.createElement('canvas');cv.width=cv.height=30*S2;
    var g=cv.getContext('2d');g.scale(S2,S2);g.translate(15,15);g.rotate(Math.PI/4);
    var h=9.6;
    g.beginPath();g.rect(-h,-h,h*2,h*2);
    g.fillStyle='#FFFFFF';g.fill();
    g.lineWidth=1.8;g.strokeStyle='#1C1A16';g.stroke();
    try{map.addImage('mi-diamond',g.getImageData(0,0,30*S2,30*S2),{pixelRatio:S2})}catch(e){}}}
 
var SERVICES=['food','store','fuel'];
 
var STACK_MIXED='#2B2926';
var CLUSTER_MAXZ=11.4;    
function stackRadius(z){  
  if(z<=8)return 48; if(z>=14)return 24;
  return 48-(z-8)*4}    
 
var PIN_FLOOR=9.2;    
function pinDrawable(p,m,z){
  var k=p.k;
  if((m.kinds||[]).indexOf(k)<0)return false;
   
  var T=Math.floor(z);
  if((k==='launch'||k==='beach')&&!p.named&&T<(m.k==='water'?12:13.5))return false;
  if(p.d===1&&z<PIN_FLOOR)return false;
  if(p.d!==1&&z<11.4)return false;
  var kz=(m.z||{})[k];if(kz==null&&POIKIND[k])kz=POIKIND[k].z;
  if(kz!=null)return T>=kz;
  if(p.d===1)return p.pri<=0||(T>=10.5&&p.pri<=1)||T>=11.4;
  return true}
 
var STACK_BANDS=[9.2,10,11,11.4,12,13,14,15,16,17];
var poif=((POIS&&POIS.p)||[]).map(function(r,i){
  var k=POIKIND[r.k]||{c:'#4A443B',h:r.k,r:7};
  return {type:'Feature',
    properties:{i:i,k:r.k,h:k.h,c:k.c,r:k.r,d:k.d?1:0,pri:(r.pri==null?3:r.pri),
      ct:r.ct?JSON.stringify(r.ct):'',w:r.w?1:0,
       
      n:r.n||k.h,named:r.n?1:0,mi:r.mi||0,
       
      ph:(typeof r.ph==='string')?r.ph:''},
    geometry:{type:'Point',coordinates:r.p}}});

 
 
 
 
var areaf=((AREAS&&AREAS.a)||[]).map(function(a){
  return {type:'Feature',properties:{n:a.n,ac:a.ac,o:a.o,c:a.c},
    geometry:{type:'Polygon',coordinates:a.g}}});
var areapt=((AREAS&&AREAS.a)||[]).map(function(a){
  return {type:'Feature',properties:{n:a.n,ac:a.ac,o:a.o,lb:a.n+'\n'+a.ac+' ac'},
    geometry:{type:'Point',coordinates:a.c}}});
 
var PUBT={forest:'State forest',game:'State game area',park:'State park / rec area',
  launch:'Public access site',trail:'State rail trail',other:'State land'};
var pubf=((PUBS&&PUBS.a)||[]).map(function(a){
  return {type:'Feature',properties:{n:a.n,t:a.t,ac:a.ac,h:PUBT[a.t]||PUBT.other},
    geometry:{type:'MultiPolygon',coordinates:a.g.map(function(r){return [r]})}}});
var pubpt=((PUBS&&PUBS.a)||[]).filter(function(a){return a.ac>=2000&&a.t!=='launch'}).map(function(a){
  var big=a.g.slice().sort(function(x,y){return y.length-x.length})[0],sx=0,sy=0;
  big.forEach(function(q){sx+=q[0];sy+=q[1]});
  return {type:'Feature',properties:{n:a.n,t:a.t},geometry:{type:'Point',coordinates:[sx/big.length,sy/big.length]}}});
var padf=[],padpin=[];
((PADDLE&&PADDLE.c)||[]).forEach(function(c){
  (c.g||[]).forEach(function(reach,i){
    padf.push({type:'Feature',properties:{n:c.n,reach:i},
      geometry:{type:'LineString',coordinates:reach}})});
   
  (c.f||[]).forEach(function(f){
    padpin.push({type:'Feature',
      properties:{k:f.k,n:f.n||null,mi:f.mi,riv:c.n,
        lb:(f.n||padName(f.k))},
      geometry:{type:'Point',coordinates:f.p}})})});

 
 
var PADKIND={};
['dam'].concat(Object.keys(BADGE_PAD)).forEach(function(k){PADKIND[k]=padName(k)});

 
var PADDLE_MPH=2.5, PADDLE_SPREAD=0.5;

 
function paddlePace(){var mc=MACHINE[machine]||{};
  return mc.mph?{mph:mc.mph,spr:mc.spread||PADDLE_SPREAD,craft:mc.lbl}:{mph:PADDLE_MPH,spr:PADDLE_SPREAD,craft:null}}
 
function paddleMin(miles){return miles/paddlePace().mph*60}
function paddleHours(miles){
   
  var pp=paddlePace();
  var mph=pp.mph, spr=pp.spr;
  var slow=miles/(mph-spr), fast=miles/(mph+spr);
  var fmt=function(h){
    if(h<1)return Math.round(h*60)+' min';
    var w=Math.floor(h),mn=Math.round((h-w)*60);
    if(mn===60){w+=1;mn=0}
    return w+' hr'+(mn?' '+mn+' min':'')};
  return fmt(fast)+'\u2013'+fmt(slow)}

 
var RUNFROM=null;

function runClear(){RUNFROM=null}

 
function nearStop(p){
  var best=null,bd=0.19;
  ((PADDLE&&PADDLE.c)||[]).forEach(function(c){(c.f||[]).forEach(function(f){
    if(!f.p)return;
    var d=mi(p,f.p);
    if(d<bd){bd=d;best={riv:c.n,stop:f}}})});
  return best}

 
var GAUGE=(function(){
  var IV='https://waterservices.usgs.gov/nwis/iv/?format=json&sites={id}&parameterCd=00060,00065,00010&siteStatus=all';
  function near(p,maxMi){
    var best=null,bd=maxMi||12;
    ((GAUGES&&GAUGES.g)||[]).forEach(function(g){
      var d=mi(p,g.p);if(d<bd){bd=d;best={g:g,mi:d}}});
    return best}
  function fetchIV(id){
    return fetch(IV.replace('{id}',id)).then(function(r){
      if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})}
  function fmt(j){
    var out={};
    try{(j.value.timeSeries||[]).forEach(function(ts){
      var code=ts.variable.variableCode[0].value;
      var vs=ts.values&&ts.values[0]&&ts.values[0].value;
      if(!vs||!vs.length)return;
      var v=vs[vs.length-1];
      out[code]={v:parseFloat(v.value),t:v.dateTime}})}catch(e){}
    var rows=[],t=null;
    if(out['00060']&&out['00060'].v>-99){rows.push('Flow <b>'+out['00060'].v.toLocaleString()+' cfs</b>');t=out['00060'].t}
    if(out['00065']&&out['00065'].v>-99){rows.push('Stage <b>'+out['00065'].v+' ft</b>');t=t||out['00065'].t}
    if(out['00010']&&out['00010'].v>-99){rows.push('Water <b>'+Math.round(out['00010'].v*9/5+32)+'\u00b0F</b>');t=t||out['00010'].t}
    return {rows:rows,t:t}}
  return {near:near,fetchIV:fetchIV,fmt:fmt};
})();

 
var CMP_ON=false, MAG=null, MAG_OK=null;

 
 
var MAGLOG=[];
function magLog(d,ev,abs){var now=Date.now();MAGLOG.push({t:now,d:d,ev:ev,abs:abs===true});
  while(MAGLOG.length&&now-MAGLOG[0].t>3000)MAGLOG.shift()}
function magStart(){
  if(MAG_OK!==null)return;
  MAG_OK=false;
  var onEv=function(e){
    var deg=null;
    if(typeof e.webkitCompassHeading==='number')deg=e.webkitCompassHeading;
    else if(e.absolute===true&&typeof e.alpha==='number')deg=(360-e.alpha)%360;
    else if(typeof e.alpha==='number')deg=(360-e.alpha)%360;
    if(deg===null||isNaN(deg))return;
     
    MAG_OK=true;MAG=(deg+360)%360;magLog(MAG,e.type,e.absolute);
    if(CMP_ON)cmpPaint()};
  try{window.addEventListener('deviceorientationabsolute',onEv,true)}catch(e){}
  try{window.addEventListener('deviceorientation',onEv,true)}catch(e){}
   
  try{
    var D=window.DeviceOrientationEvent;
    if(D&&typeof D.requestPermission==='function')D.requestPermission().catch(function(){});
  }catch(e){}}

 
 
var DECL_W = 7.0;       

function magToTrue(deg){
  if(deg===null||deg===undefined)return null;
  return (deg-DECL_W+360)%360}

function headingNow(){
  var moving=HUD.spd!==null&&HUD.spd>1.2;    
  if(moving&&HUD.hdg!==null)return {deg:HUD.hdg,src:'course'};
  if(MAG!==null)return {deg:magToTrue(MAG),src:'compass'};
  if(HUD.hdg!==null)return {deg:HUD.hdg,src:'course'};
  return null}

function cmpRose(deg){
  var ticks='',i,a,x1,y1,x2,y2,r=46;
  for(i=0;i<16;i++){
    a=(i*22.5-(deg||0))*Math.PI/180;
    var major=(i%4===0),len=major?9:5;
    x1=50+Math.sin(a)*r; y1=50-Math.cos(a)*r;
    x2=50+Math.sin(a)*(r-len); y2=50-Math.cos(a)*(r-len);
    ticks+='<line x1="'+x1.toFixed(1)+'" y1="'+y1.toFixed(1)+'" x2="'+x2.toFixed(1)+
      '" y2="'+y2.toFixed(1)+'" style="stroke:'+(major?'var(--text-1)':'var(--text-3)')+
      '" stroke-width="'+(major?1.6:1)+'"/>'}
  var lbl='',C=['N','E','S','W'];
  for(i=0;i<4;i++){
    a=(i*90-(deg||0))*Math.PI/180;
    lbl+='<text x="'+(50+Math.sin(a)*31).toFixed(1)+'" y="'+(50-Math.cos(a)*31+3.4).toFixed(1)+
      '" text-anchor="middle" font-size="10" font-weight="700" style="fill:'+
      (i===0?'var(--accent)':'var(--text-1)')+'">'+C[i]+'</text>'}
  return '<svg viewBox="0 0 100 100" width="128" height="128" aria-hidden="true">'+
    '<circle cx="50" cy="50" r="47" fill="none" style="stroke:var(--border-strong)"/>'+
    ticks+lbl+
    (deg===null?'':'<path d="M50 8 L45 20 L55 20 Z" style="fill:var(--accent)"/>')+
    '<circle cx="50" cy="50" r="2.4" style="fill:var(--text-1)"/></svg>'}

function cmpRows(hdg){
  var out=[];
  if(hdg===undefined){var H=headingNow();hdg=H?H.deg:null}
  function row(label,at){
    if(!at||!ME)return;
    var b=bearing(ME,at),d=mi(ME,at);
     
    if(d<0.02){out.push('<b>'+label+'</b> <span style="color:var(--text-3)">'+
      'you are here</span>');return}
    var rel=hdg===null?null:((b-hdg+540)%360-180);
    out.push('<b>'+label+'</b> '+compass(b)+' '+Math.round(b)+'\u00B0 · '+
      (d<10?d.toFixed(2):Math.round(d))+' mi'+
      (rel===null?'':' · '+(Math.abs(rel)<8?'straight ahead'
        :(rel<0?Math.round(-rel)+'\u00B0 left':Math.round(rel)+'\u00B0 right'))))}
  row('Truck',TRUCK);
  if(HOME)row('Home',HOME);
  wpLoad().filter(function(x){return !x.r||!BUNDLE.region||x.r===BUNDLE.region})
    .slice(0,6).forEach(function(x){row(x.n,x.p)});
  return out}

function cmpPaint(){
  var box=el('cmpbox');
  if(!box||!CMP_ON)return;
  var H=headingNow(),hdg=H?H.deg:null,rows=cmpRows(hdg);
  box.innerHTML='<div style="text-align:center">'+cmpRose(hdg)+
    '<div style="font:700 var(--t-lg)/1 Barlow,Roboto,system-ui,sans-serif;margin-top:4px">'+
    (hdg===null?'<span style="color:var(--text-3);font-size:var(--t-sm)">'+
       (MAG_OK===false?'this phone is not reporting a compass \u2014 start moving '+
         'and it will use your GPS course instead'
        :'waiting for the compass\u2026')+'</span>'
     :compass(hdg)+' <span style="color:var(--text-3)">'+Math.round(hdg)+'\u00B0 true \u00B7 '+
       (H.src==='compass'?'compass':'course')+'</span>')+
    '</div></div>'+
    (rows.length?'<div style="margin-top:9px;line-height:1.7">'+rows.join('<br>')+'</div>'
     :'<div class="sub" style="margin-top:9px">Nothing to take a bearing to yet — '+
      'pin the truck, set home, or save a waypoint.</div>');
   
  var k=(hdg===null?'n'+MAG_OK:'h'+(H&&H.src))+'|'+rows.join('|');
  if(k!==CMP_KEY){CMP_KEY=k;cmpFit()}}
var CMP_KEY='';
 
function cmpFit(){try{
  var p=el('cmppanel'),b=el('cmpbox'),mo=el('cmpmore');
  if(!p||!b||!p.getBoundingClientRect)return;
  p.style.removeProperty('--cmp-trim');if(mo){mo.hidden=true;mo.style.visibility=''}
  CMP_GEO=cmpGeo();
  if(p.hidden||!(p.offsetHeight>0))return;
  if(p.scrollHeight<=p.clientHeight+1)return;
  if(mo)mo.hidden=false;
  var f=b.firstElementChild,trim=0;
  for(var pass=0;pass<3;pass++){
    var pr=p.getBoundingClientRect(),sc=pr.height/(p.offsetHeight||1)||1,
        off=function(y){return (y-pr.top)/sc},
        vb=(mo&&!mo.hidden)?off(mo.getBoundingClientRect().top):p.clientTop+p.clientHeight,
        fb=f?off(f.getBoundingClientRect().bottom):0,cut=null,
        tw=document.createTreeWalker(b,4,null,false),n,rg=document.createRange();
    while((n=tw.nextNode())){rg.selectNodeContents(n);
      var rs=rg.getClientRects();
      for(var i=0;i<rs.length;i++){var t0=off(rs[i].top),t1=off(rs[i].bottom);
        if(rs[i].height>0&&t0>=fb-0.5&&t0<vb-0.5&&t1>vb+0.5)cut=cut===null?t0:Math.min(cut,t0)}}
    if(cut===null)break;
     
    trim+=p.offsetHeight-Math.floor(p.offsetHeight-(vb-cut));
    p.style.setProperty('--cmp-trim',trim+'px')}
  cmpCue()}catch(e){}}
 
function cmpCue(){try{
  var p=el('cmppanel'),mo=el('cmpmore');
  if(!p||!mo||mo.hidden)return;
  mo.style.visibility=(p.scrollTop+p.clientHeight>=p.scrollHeight-1)?'hidden':''}catch(e){}}
try{el('cmppanel').addEventListener('scroll',cmpCue)}catch(e){}
 
var CMP_GEO='';
function cmpGeo(){try{var c=document.documentElement.style;
  return [c.getPropertyValue('--ride-top'),c.getPropertyValue('--sheet-h'),c.getPropertyValue('--strip-h'),
    window.innerHeight].join('|')}catch(e){return ''}}

function runCard(a,b,riv){
  var c=null,i;
  for(i=0;i<((PADDLE&&PADDLE.c)||[]).length;i++)
    if(PADDLE.c[i].n===riv){c=PADDLE.c[i];break}
  if(!c)return;
  var lo=Math.min(a.mi,b.mi),hi=Math.max(a.mi,b.mi);
  var putIn=(a.mi<=b.mi?a:b), takeOut=(a.mi<=b.mi?b:a);
  var swapped=(a!==putIn);
  var mid=c.f.filter(function(f){return f.mi>lo+0.05&&f.mi<hi-0.05});
  var dams=mid.filter(function(f){return f.k==='dam'});
  var camps=mid.filter(function(f){return f.k==='camp'});
  var acc=mid.filter(function(f){return f.k==='launch'||f.k==='access'});
  var nm=function(f){return f.n||PADKIND[f.k]||f.k};

  var rows=[];
  rows.push('Put in <b>'+nm(putIn)+'</b>');
  rows.push('Take out <b>'+nm(takeOut)+'</b>');
  rows.push('About <b>'+(hi-lo).toFixed(1)+' mi</b> of river between them');
  if(dams.length)
    rows.push('<b style="color:var(--danger-text)">'+dams.length+' dam'+(dams.length>1?'s':'')+
      ' on the way — '+dams.map(nm).join(', ')+'. You must take out and portage '+
      (dams.length>1?'each one':'it')+'.</b>');
  else
    rows.push('<b>No dams between them.</b>');
  if(acc.length)
    rows.push(acc.length+' other access point'+(acc.length>1?'s':'')+
      ' on the way'+(acc.length<=4?': '+acc.map(nm).join(', '):''));
  if(camps.length)
    rows.push(camps.length+' campground'+(camps.length>1?'s':'')+
      (camps.length<=4?': '+camps.map(nm).join(', '):' along it'));
  if(swapped)
    rows.push('<span class="sub">Tapped in the other order — a river only runs '+
      'one way, so this is the run.</span>');
  var _mc=MACHINE[machine]||{}, _craft=_mc.mph?_mc.lbl:null;
   
  rows.push('About <b>~'+etaTxt(paddleMin(hi-lo))+'</b> of paddling'+
    (dams.length?' plus the portage'+(dams.length>1?'s':''):'')+
    ' <span class="sub">('+paddleHours(hi-lo)+' '+(_craft?'as a '+_craft.toLowerCase()+' at '+
      (_mc.mph-_mc.spread)+'\u2013'+(_mc.mph+_mc.spread)+' mph, calibrated '
      :'at 2\u20133 mph, which is what these floats work out at ')+
    'against the liveries\u2019 own times)</span>');
  logAct('act  run '+nm(putIn)+' -> '+nm(takeOut));
  show('<div class="tn">The run \u2014 <span class="sub">'+riv+'</span></div>'+
    rows.join('<br>')+
    '<div class="sub" style="margin-top:8px">'+
    '<button class="chip" id="pd-nav">'+ic('ride')+'<span>Navigate this run</span></button> '+
    '<button class="chip" id="pd-clear">'+ic('close')+'<span>Clear</span></button></div>',
    dams.length?'fail':'pass');
  var cb=el('pd-clear');
  if(cb)cb.addEventListener('click',function(){runClear();ack('Run cleared.')});
   
  var nb=el('pd-nav');
  if(nb)nb.addEventListener('click',function(){
    runSet(riv,putIn,takeOut);
    if(mode!=='water')applyMode('water',{silent:true});
    if(!rideMode)el('c-ride').click();
     
    if(rideMode||riding)show('<b>Navigating the '+riv+'</b><div class="sub">'+(putIn.n||'Put-in')+
      ' to '+(takeOut.n||'take-out')+'. The map points downstream; the strip '+
      'counts down to the take-out and calls what is coming.</div>','')});
  RUNFROM=null}

 
function photoHTML(k,n,p){
  if(!PHOTOS||!n||!p)return '';
  var e=PHOTOS[k+'|'+n+'|'+(+p[0]).toFixed(4)+'|'+(+p[1]).toFixed(4)];
  if(!e||!e.f)return '';
  return '<div class="ph"><img src="bundle/photos/'+e.f+'" alt="" loading="lazy">'+
    '<div class="phby">'+(e.by?e.by+' \u00b7 ':'')+(e.lic||'Wikimedia Commons')+'</div></div>'+
    (e.d?'<div class="sub phd">'+e.d+'</div>':'')}
function pubCard(pr){
  logAct('tap  public '+pr.n);
  return show('<b>'+pr.n+'</b>'+
    '<div class="sub">'+(pr.h||'State land')+' \u00b7 DNR-managed \u00b7 '+
    (pr.ac?pr.ac.toLocaleString()+' acres':'')+'</div>'+
    '<div class="k">PUBLIC LAND</div>'+
    '<div class="sub">State-managed land open to the public. Check the DNR for '+
    'season, permit and unit rules before you hunt or ride here.</div>','');
}
function areaCard(pr){
  logAct('tap  area '+pr.n);
  var c=null;try{c=typeof pr.c==='string'?JSON.parse(pr.c):pr.c}catch(e){}
  return show('<b>'+pr.n+'</b>'+
    '<div class="sub">DNR scramble area \u00b7 '+pr.o+' land</div>'+
    photoHTML('area',pr.n,c)+
    '<div class="k">OPEN RIDING</div>'+
    '<div class="sub">About '+pr.ac+' acres you may ride anywhere on \u2014 '+
    'this is ground, not a trail, so Return home and Route here plan to its '+
    'edge, never across it. ORV licence and trail permit required.</div>'+
    (c?'<div class="k">WHERE</div><span class="tn">'+c[1].toFixed(5)+'  '+c[0].toFixed(5)+'</span>'+
       '<div class="sub">'+placeDist(c)+'</div>':''),'');
}

function paddleCard(ft){
  var pr=ft.properties, riv=pr.riv||pr.n, mi=+pr.mi;
  var c=null,i;
  for(i=0;i<((PADDLE&&PADDLE.c)||[]).length;i++)
    if(PADDLE.c[i].n===riv){c=PADDLE.c[i];break}
  if(!c)return show('<b>'+(pr.lb||'On the river')+'</b>','');
  logAct('tap  paddle '+(pr.n||pr.k));

  var stops=c.f.filter(function(f){return f.k!=='parking'});
  var here=null,bi=-1;
  for(i=0;i<stops.length;i++){
    if(Math.abs(stops[i].mi-mi)<0.02&&(stops[i].n||null)===(pr.n||null)){here=stops[i];bi=i;break}}
  if(bi<0){for(i=0;i<stops.length;i++)if(Math.abs(stops[i].mi-mi)<0.02){here=stops[i];bi=i;break}}

  var isDam=pr.k==='dam';
  var head=(pr.n?pr.n:(PADKIND[pr.k]||'On the river'))+
    ' <span class="sub">'+riv+'</span>';
  var rows=[];
  if(isDam){
    rows.push('<b style="color:var(--danger-text)">DAM — you must take out and portage.</b>');
    var atDam=stops.filter(function(f){
      return f.k!=='dam'&&Math.abs(f.mi-mi)<0.35});
    if(atDam.length)
      rows.push('At the dam: '+atDam.map(function(f){
        return f.n||PADKIND[f.k]||f.k}).slice(0,3).join(', '));
  }
  rows.push((PADKIND[pr.k]||pr.k)+' · about <b>'+mi.toFixed(1)+' mi</b> down the river');

   
  function between(a,b){
    var d=[];
    for(var j=Math.min(a,b)+1;j<Math.max(a,b);j++)
      if(stops[j].k==='dam')d.push(stops[j].n||'a dam');
    return d}
  function side(dir){
    var j=bi+dir;
     
    while(j>=0&&j<stops.length&&
          (stops[j].k==='dam'||Math.abs(stops[j].mi-mi)<0.06))j+=dir;
    if(j<0||j>=stops.length)return null;
    var t=stops[j],gap=Math.abs(t.mi-mi),dams=between(bi,j);
    return (dir<0?'Above: ':'Below: ')+'<b>'+(t.n||PADKIND[t.k]||t.k)+'</b> · '+
      (gap<0.1?'at the same spot':gap.toFixed(1)+' mi · '+paddleHours(gap))+
      (dams.length?' · <b style="color:var(--danger-text)">'+dams.join(', ')+' in between — portage</b>'
                 :' · no dam between')}
  if(bi>=0){
    var up=side(-1),dn=side(1);
    if(up)rows.push(up);
    if(dn)rows.push(dn);
    if(!up)rows.push('<span class="sub">Nothing mapped above this — it is the top of the run.</span>');
    if(!dn)rows.push('<span class="sub">Nothing mapped below this — it is the end of the run.</span>');
  }
  rows.push('<span class="sub">River miles from OpenStreetMap, cross-checked '+
    'against the USGS survey — they agree within 4%.</span>');

   
  var acts='';
  if(here){
    acts=RUNFROM&&RUNFROM.riv===riv&&Math.abs(RUNFROM.mi-here.mi)>0.05
      ? '<button class="chip" id="pd-to">'+ic('route')+'<span>Run from '+
        (RUNFROM.n||PADKIND[RUNFROM.k]||'there')+' to here</span></button> '+
        '<button class="chip" id="pd-cancel">'+ic('close')+'<span>Cancel</span></button>'
      : '<button class="chip" id="pd-from">'+ic('route')+'<span>Plan a run from here</span></button>';}
   
  var _gp=(ft.geometry&&ft.geometry.coordinates)||null;
  var _gn=(_gp&&GAUGES)?GAUGE.near(_gp,12):null;
  show('<div class="tn">'+head+'</div>'+rows.join('<br>')+
    (_gn?'<div class="sub" id="pd-cond" style="margin-top:8px">'+
      '<button class="chip" id="pd-gauge">'+ic('gauge')+
      '<span>River conditions (USGS, live)</span></button></div>':'')+
    (acts?'<div class="sub" style="margin-top:8px">'+acts+'</div>':''),
    isDam?'fail':'');
  var gb=el('pd-gauge');
  if(gb)gb.addEventListener('click',function(){
    var slot=el('pd-cond');
    slot.innerHTML='Fetching from USGS\u2026';
    logAct('act  gauge '+_gn.g.id);
    GAUGE.fetchIV(_gn.g.id).then(function(j){
      var f=GAUGE.fmt(j);
      slot.innerHTML=f.rows.length
        ? f.rows.join(' \u00b7 ')+'<br><span class="sub">as of '+
          (f.t?new Date(f.t).toLocaleString():'now')+' \u00b7 USGS '+_gn.g.id+
          ' \u00b7 '+_gn.g.n+' \u00b7 '+_gn.mi.toFixed(1)+' mi from here</span>'
        : 'The gauge answered but reported nothing usable right now.';
    }).catch(function(e){
      slot.innerHTML='Couldn\u2019t reach USGS \u2014 live conditions need '+
        'signal. The map and your saved runs work fine without them.';})});
  var f1=el('pd-from');
  if(f1)f1.addEventListener('click',function(){
    RUNFROM={mi:here.mi,n:pr.n,k:pr.k,riv:riv};
    logAct('act  run from '+(pr.n||pr.k));
    show('<b>'+(pr.n||PADKIND[pr.k]||'Here')+'</b> is the first end.<br>'+
      'Now tap the other end of the run on the '+riv+'.','')});
  var f2=el('pd-to');
  if(f2)f2.addEventListener('click',function(){
    runCard(RUNFROM,{mi:here.mi,n:pr.n,k:pr.k},riv)});
  var f3=el('pd-cancel');
  if(f3)f3.addEventListener('click',function(){runClear();ack('Run cancelled.')});
}

var peakf=((CONT&&CONT.pk)||[]).map(function(p){
  return {type:'Feature',
    properties:{n:p.n,ft:p.ft,lb:p.n+'\n'+p.ft.toLocaleString()+' ft'},
    geometry:{type:'Point',coordinates:p.p}}});

var contf=((CONT&&CONT.l)||[]).map(function(l){
  return {type:'Feature',
    properties:{ft:l.ft,i:l.i,lb:l.ft+' ft'},
    geometry:{type:'LineString',coordinates:decode(l.c)}}});

var strokes=chainStrokes();
 
var refstrokes=chainStrokes(function(e){return refLabel(e.rf)});
 
var shortPts={type:'FeatureCollection',features:strokes.filter(function(f){
    return f.properties.lb && f.properties.px<420 &&
           f.geometry.coordinates.length>1})
  .map(function(f){
    var c=f.geometry.coordinates,m=c[Math.floor(c.length/2)];
    return {type:'Feature',properties:{lb:f.properties.lb,c:f.properties.c},
            geometry:{type:'Point',coordinates:m}}})};

 
 
var WPTYPES={stand:{h:'Stand',c:'#2E7FA8'},camera:{h:'Camera',c:'#C9A227'},
  sign:{h:'Deer sign',c:'#F5EFE2'},water:{h:'Water',c:'#4FB3C9'},gate:{h:'Gate',c:'#7A5B3A'}};
var PAL={
   
  route72:'#0FAE57',                     
  trail50:'#0B7FE8', fstrail:'#0B7FE8',  
  mccct:'#1C1A16',  moto24:'#1C1A16',    
   
  track:'#96562A',                       
  fsroad:'#8A7C66',                      
   
   
  minor:'#FFFFFF', paved:'#FFFFFF',
   
  minorcase:'#C9C8C2', pavedcase:'#BFBEB8',
   
  closed:'#C1121F', fsclosed:'#C1121F',
   
  foot:'#7CB342', horse:'#8E6BB5', snow:'#4FB3C9', snowmob:'#4FB3C9',
  nfsmoto:'#C98A2E',
  showother:'#5E6B7A'   
};

function w(a,b,c){return ['interpolate',['linear'],['zoom'],10,a,14,b,17,c]}
 
function wCase(cond,t,f){
  return ['interpolate',['linear'],['zoom'],
    10,['case',cond,t[0],f[0]],
    14,['case',cond,t[1],f[1]],
    17,['case',cond,t[2],f[2]]]}
function lyr(id,cls,col,wd,dash){var o={id:id,type:'line',source:'net',
  filter:netLyrF(id,['==',['get','c'],cls],cls),layout:{'line-cap':dash?'butt':'round','line-join':'round'},
  paint:{'line-color':col,'line-width':wd}};if(dash)o.paint['line-dasharray']=dash;return o}

 
 
var GLYPH_BUF=(function(){var b=atob(GLYPHS.APEX),n=b.length,u=new Uint8Array(n);
  for(var i=0;i<n;i++)u[i]=b.charCodeAt(i);return u})();
maplibregl.addProtocol('apexfont',function(){
  return Promise.resolve({data:GLYPH_BUF.buffer.slice(0)})});
var GLYPH_URL='apexfont://{fontstack}/{range}.pbf';

 
var CTR=BUNDLE.centre||(BUNDLE.bbox?
  [(BUNDLE.bbox[0]+BUNDLE.bbox[2])/2,(BUNDLE.bbox[1]+BUNDLE.bbox[3])/2]:[0,0]);
var PLACES=(BUNDLE.anchors&&BUNDLE.anchors.length?BUNDLE.anchors:
  [[BUNDLE.name||'Region',CTR[0],CTR[1],'town']]);
var placeFC={type:'FeatureCollection',features:PLACES.map(function(p){
  return {type:'Feature',properties:{n:p[0],k:p[3]||'town'},
    geometry:{type:'Point',coordinates:[p[1],p[2]]}}})};

 
var TILES=BUNDLE.tiles||null;
var TILEURL='bundle/imagery/{z}/{x}/{y}.jpg';
 
var SPARSE=!!(TILES&&TILES.sparse);
 
var BLANK_PNG=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABpfZFQAAAAABJRU5ErkJggg=='),function(c){return c.charCodeAt(0)});
function inPatch(z,x,y){var b=(TILES&&TILES.boxes)||[];
  for(var i=0;i<b.length;i++){var q=b[i];
    if(q[0]===z&&x>=q[1]&&x<=q[3]&&y>=q[2]&&y<=q[4])return true}
  return false}
 
var HD=(function(){
  var DBN='apex-hd',ST='tiles',db=null;
  function open(){return db?Promise.resolve(db):new Promise(function(res,rej){
    var q=indexedDB.open(DBN,1);
    q.onupgradeneeded=function(){q.result.createObjectStore(ST)};
    q.onsuccess=function(){db=q.result;res(db)};
    q.onerror=function(){rej(q.error)}})}
  function tx(mode,fn){return open().then(function(d){return new Promise(function(res,rej){
    var t=d.transaction(ST,mode),q=fn(t.objectStore(ST));
    t.oncomplete=function(){res(q?q.result:undefined)};
    t.onerror=function(){rej(t.error)}})})}
  return {
    get:function(z,x,y){return tx('readonly',function(s){return s.get(z+'/'+x+'/'+y)})
      .then(function(v){return v?v.b:null})},
    put:function(z,x,y,buf){return tx('readwrite',function(s){
      return s.put({b:buf,s:buf.byteLength,t:Date.now()},z+'/'+x+'/'+y)})},
    del:function(z,x,y){return tx('readwrite',function(s){return s.delete(z+'/'+x+'/'+y)})},
    stats:function(){return tx('readonly',function(s){return s.getAll()})
      .then(function(all){all=all||[];var b=0;for(var i=0;i<all.length;i++)b+=(all[i].s||0);
        return {tiles:all.length,bytes:b}})},
    clear:function(){return tx('readwrite',function(s){return s.clear()})}};
})();
 
function _satResolve(params){
  var m=/apexsat:\/\/(\d+)\/(\d+)\/(\d+)/.exec(params.url||'');
  var blank=function(){return {data:BLANK_PNG.buffer.slice(0)}};
  if(!m)return Promise.resolve(blank());
  var z=+m[1],x=+m[2],y=+m[3];
  if(inPatch(z,x,y))
    return fetch('bundle/imagery/'+z+'/'+x+'/'+y+'.jpg')
      .then(function(r){return r.ok?r.arrayBuffer().then(function(b){return {data:b}}):blank()})
      .catch(blank);
  return HD.get(z,x,y).then(function(b){return b?{data:b}:blank()}).catch(blank);
}
if(SPARSE)maplibregl.addProtocol('apexsat',_satResolve);
 
var WAKE=(function(){
  var held={},lock=null,pending=false;
  function n(){return Object.keys(held).length}
  function release(){var l=lock;lock=null;
    if(l){try{var r=l.release();if(r&&r.catch)r.catch(function(){})}catch(e){}}}
  function acquire(){
    if(lock||pending||!n())return;
    try{
      if(!navigator.wakeLock)return;
      pending=true;
      navigator.wakeLock.request('screen').then(function(l){pending=false;lock=l;
        try{l.addEventListener('release',function(){if(lock===l)lock=null})}catch(e){}
        if(!n())release()}).catch(function(){pending=false});
    }catch(e){pending=false}}
  return {
    hold:function(who){held[who]=1;acquire()},
    drop:function(who){delete held[who];if(!n())release()},
    holds:function(){return n()},active:function(){return !!lock},
    resume:function(){if(n()&&!lock)acquire()}};
})();
 
var HDDL=(function(){
  var USGS='https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}';
  var LANES=6,BATCH=60,PAUSE=300;
  var EST_Z={13:14.6*1024,14:17.7*1024,15:19.4*1024};
  var running=false,stopReq=false,prog=null;
  function txy(lon,lat,z){var n=Math.pow(2,z),r=lat*Math.PI/180;
    return [Math.floor((lon+180)/360*n),
            Math.floor((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*n)]}
  function plan(b){
    var out=[];
    for(var z=13;z<=15;z++){
      var a=txy(b[0],b[3],z),c=txy(b[2],b[1],z);
      for(var x=a[0];x<=c[0];x++)for(var y=a[1];y<=c[1];y++)
        if(!inPatch(z,x,y))out.push([z,x,y]);
    }
    return out}
  function estimate(tiles){var s=0;
    for(var i=0;i<tiles.length;i++)s+=EST_Z[tiles[i][0]]||22*1024;return s}
   
  function planPoly(rings,z0,z1){
    var out=[];if(!rings||!rings.length)return out;
    var W=180,S=90,E=-180,N=-90;
    for(var r=0;r<rings.length;r++)for(var i=0;i<rings[r].length;i++){
      var q=rings[r][i];if(q[0]<W)W=q[0];if(q[0]>E)E=q[0];if(q[1]<S)S=q[1];if(q[1]>N)N=q[1]}
    for(var z=z0;z<=z1;z++){
      var n=Math.pow(2,z),a=txy(W,N,z),c=txy(E,S,z);   
      for(var x=a[0];x<=c[0];x++)for(var y=a[1];y<=c[1];y++){
        var lon=(x+0.5)/n*360-180,lat=Math.atan(Math.sinh(Math.PI*(1-2*(y+0.5)/n)))*180/Math.PI;
        if(inRings(lon,lat,rings)&&!inPatch(z,x,y))out.push([z,x,y])}}
    return out}
  var STATE_PLAN=null;
  function statePlan(){
    if(!STATE_PLAN&&typeof CTX!=='undefined'&&CTX&&CTX.rings)STATE_PLAN=planPoly(CTX.rings,13,13);
    return STATE_PLAN||[]}
   
  function quota(){
    try{
      if(navigator.storage&&navigator.storage.estimate)
        return navigator.storage.estimate().then(function(e){
          return {known:true,free:Math.max(0,(e.quota||0)-(e.usage||0))}}).catch(function(){return {known:false}})
    }catch(e){}
    return Promise.resolve({known:false})}
  function fetchTile(z,x,y){
    return fetch(USGS.replace('{z}',z).replace('{y}',y).replace('{x}',x))
      .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.arrayBuffer()})}
  function sleep(ms){return new Promise(function(r){setTimeout(r,ms)})}
  function save(what,onp,label){
    if(running)return Promise.resolve(null);
    running=true;stopReq=false;
    var tiles=(what&&what.length&&Array.isArray(what[0]))?what:plan(what||[]);
    var done=0,skipped=0,bytes=0,inflight=0,peak=0,retries=0,pauses=0,err=null;
    label=label||'this view';
    prog={label:label,done:0,skipped:0,total:tiles.length,t0:Date.now(),eta:null};
    WAKE.hold('hd');
    function report(){prog.done=done;prog.skipped=skipped;
       
      var el=(Date.now()-prog.t0)/1000;
      prog.eta=(done>=60&&el>0)?Math.round((tiles.length-done-skipped)/(done/el)):null;
      if(onp)onp(done+skipped,tiles.length,label)}
    function one(t){
      return HD.get(t[0],t[1],t[2]).then(function(have){
        if(have){skipped++;return}
        return M.fetchTile(t[0],t[1],t[2])
          .catch(function(){retries++;
             
            return sleep(PAUSE).then(function(){return stopReq?null:M.fetchTile(t[0],t[1],t[2])})})
          .then(function(buf){if(!buf)return;return HD.put(t[0],t[1],t[2],buf)
            .then(function(){done++;bytes+=buf.byteLength})})})}
    function batch(start,end){
      var j=start;
      function lane(){
        if(stopReq||err||j>=end)return Promise.resolve();
        var t=tiles[j++];inflight++;if(inflight>peak)peak=inflight;
        return one(t).then(function(){inflight--;report()},
                           function(e){inflight--;err=String((e&&e.message)||e)})
          .then(lane)}
      var lanes=[];for(var k=0;k<LANES;k++)lanes.push(lane());
      return Promise.all(lanes)}
    function batches(start){
      if(stopReq||err||start>=tiles.length)return Promise.resolve();
      var end=Math.min(start+BATCH,tiles.length);
      return batch(start,end).then(function(){
        if(stopReq||err||end>=tiles.length)return;
        pauses++;return sleep(PAUSE)}).then(function(){return batches(end)})}
    return batches(0).then(function(){
      running=false;prog=null;WAKE.drop('hd');
      return {error:err,done:done,skipped:skipped,bytes:bytes,total:tiles.length,
              stopped:stopReq,peak:peak,retries:retries,pauses:pauses,label:label}})}
  var M={plan:plan,planPoly:planPoly,statePlan:statePlan,quota:quota,
    save:save,fetchTile:fetchTile,estimate:estimate,EST_Z:EST_Z,
    LANES:LANES,BATCH:BATCH,PAUSE:PAUSE,
    progress:function(){return prog},
    stop:function(){stopReq=true},busy:function(){return running}};
  return M;
})();
var SAT_OK=!!TILES||!!(SAT&&SATB&&(SATB[2]-SATB[0])>1e-6&&(SATB[3]-SATB[1])>1e-6);
 
var SAT_TONE={'raster-saturation':-0.35,'raster-brightness-max':0.82,'raster-contrast':0.06};
function satPaint(p){for(var k in SAT_TONE)p[k]=SAT_TONE[k];return p}
var SATBOX=SAT_OK?SATB:(BUNDLE.bbox||[0,0,1,1]);
var SATURL=SAT_OK?SAT:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
 
var _booted=false,_userDrove=false;
function bootEase(at){
  if(_booted||_userDrove)return;_booted=true;
  try{map.easeTo({center:at,zoom:Math.max(map.getZoom(),10.2),duration:900,
    essential:true})}catch(e){}}
 
var HOMEKEY='apex.home.v1',HOME=null;
try{var _h=JSON.parse(localStorage.getItem(HOMEKEY)||'null');
    if(_h&&_h.length===2)HOME=_h}catch(e){}
var map=new maplibregl.Map({container:'map',style:{version:8,glyphs:GLYPH_URL,
  sources:{
     
    sat:(TILES&&!SPARSE)?{type:'raster',tiles:[TILEURL],tileSize:256,
      minzoom:TILES.zmin,maxzoom:TILES.zmax,
      bounds:[SATBOX[0],SATBOX[1],SATBOX[2],SATBOX[3]],
      attribution:'USGS'}
     :{type:'image',url:SATURL,
      coordinates:[[SATBOX[0],SATBOX[3]],[SATBOX[2],SATBOX[3]],[SATBOX[2],SATBOX[1]],[SATBOX[0],SATBOX[1]]]},
     
    satbase:(SPARSE&&TILES.zmin<=11)?{type:'raster',tiles:['apexsat://{z}/{x}/{y}'],tileSize:256,
      minzoom:11,maxzoom:(TILES.base||11),attribution:'USGS'}
      :{type:'geojson',data:{type:'FeatureCollection',features:[]}},
    satpatch:SPARSE?{type:'raster',tiles:['apexsat://{z}/{x}/{y}'],tileSize:256,
      minzoom:Math.max(12,TILES.zmin),maxzoom:TILES.zmax,attribution:'USGS'}
      :{type:'geojson',data:{type:'FeatureCollection',features:[]}},
    hs:{type:'image',url:SHADE,
      coordinates:[[TR.b[0],TR.b[3]],[TR.b[2],TR.b[3]],[TR.b[2],TR.b[1]],[TR.b[0],TR.b[1]]]},
    ground:{type:'geojson',data:(function(){
       
      var f=(LAND&&LAND.f||[]).map(function(a){
        return {type:'Feature',properties:{k:a.k},
          geometry:{type:'Polygon',coordinates:a.g}}});
      return {type:'FeatureCollection',features:f}})()},
    wtr:{type:'geojson',data:{type:'FeatureCollection',features:wf}},
    wlbl:{type:'geojson',data:{type:'FeatureCollection',features:wlab}},
    refs:{type:'geojson',data:{type:'FeatureCollection',features:refstrokes}},
    poi:{type:'geojson',data:{type:'FeatureCollection',features:poif}},
     
     
    poistack:{type:'geojson',data:{type:'FeatureCollection',features:[]}},
    cont:{type:'geojson',data:{type:'FeatureCollection',features:contf}},
    wpts:{type:'geojson',data:{type:'FeatureCollection',features:[]}},
    peaks:{type:'geojson',data:{type:'FeatureCollection',features:peakf}},
    paddle:{type:'geojson',data:{type:'FeatureCollection',features:padf}},
    padpin:{type:'geojson',data:{type:'FeatureCollection',features:padpin}},
    areas:{type:'geojson',data:{type:'FeatureCollection',features:areaf}},
    pubs:{type:'geojson',data:{type:'FeatureCollection',features:pubf}},
     
    nf:{type:'geojson',data:(NF&&NF.features)?NF:{type:'FeatureCollection',features:[]}},
    pubpt:{type:'geojson',data:{type:'FeatureCollection',features:pubpt}},
    areapt:{type:'geojson',data:{type:'FeatureCollection',features:areapt}},

    net:{type:'geojson',data:{type:'FeatureCollection',features:nf2.concat(NETLO)}},
    strokes:{type:'geojson',data:{type:'FeatureCollection',features:strokes}},
    shortpts:{type:'geojson',data:shortPts},
    showonly:{type:'geojson',data:{type:'FeatureCollection',features:showFeats}},
    state:{type:'geojson',data:{type:'FeatureCollection',features:[]}},
    county:{type:'geojson',data:{type:'FeatureCollection',features:[]}},
    countylbl:{type:'geojson',data:{type:'FeatureCollection',features:[]}},
    lakes:{type:'geojson',data:{type:'FeatureCollection',features:[]}},
    approach:{type:'geojson',data:{type:'FeatureCollection',features:[]}},
    alt:{type:'geojson',data:{type:'FeatureCollection',features:[]}},
    route:{type:'geojson',data:{type:'FeatureCollection',features:[]}},
    crumb:{type:'geojson',data:{type:'FeatureCollection',features:[]}},
    back:{type:'geojson',data:{type:'FeatureCollection',features:[]}},
    places:{type:'geojson',data:placeFC}
  },
  layers:[
     
    {id:'bg',type:'background',paint:{'background-color':'#F2F3F0'}},
     
    {id:'state-fill',type:'fill',source:'state',maxzoom:9.6,
      paint:{'fill-color':'#EFE7D6','fill-opacity':1}},
     
     
    {id:'lc-public',type:'fill',source:'ground',
      filter:['==',['get','k'],'public'],
      paint:{'fill-color':'#E9F0DE','fill-opacity':0.85}},
    {id:'lc-forest',type:'fill',source:'ground',
      filter:['==',['get','k'],'forest'],
      paint:{'fill-color':'#D9E7C9','fill-opacity':0.9}},
    {id:'lc-wetland',type:'fill',source:'ground',
      filter:['==',['get','k'],'wetland'],
      paint:{'fill-color':'#D3E4DA','fill-opacity':0.9}},
    {id:'lc-park',type:'fill',source:'ground',
      filter:['==',['get','k'],'park'],
      paint:{'fill-color':'#C9E2B6','fill-opacity':0.9}},
     
     
    {id:'pub-fill',type:'fill',source:'pubs',layout:{visibility:'none'},
      paint:{'fill-color':['match',['get','t'],'game','#5E9E4A','park','#7FB77E','launch','#4F8FB5','#8FBF7A'],
        'fill-opacity':['match',['get','t'],'game',0.30,'launch',0.35,0.20]}},
    {id:'nf-fill',type:'fill',source:'nf',layout:{visibility:'none'},
      paint:{'fill-color':'#3F7D4B','fill-opacity':0.16}},
    {id:'nf-line',type:'line',source:'nf',layout:{visibility:'none'},
      paint:{'line-color':'#2F6E24','line-width':w(1.0,1.6,2.2),'line-dasharray':[3,2]}},
    {id:'area-fill',type:'fill',source:'areas',
      paint:{'fill-color':'#0FAE57','fill-opacity':0.22}},
     
    {id:'sat',type:'raster',source:'sat',layout:{visibility:'none'},
      paint:satPaint({'raster-opacity':1,'raster-fade-duration':0})},
     
    (SPARSE&&TILES.zmin<=11)?{id:'sat-base',type:'raster',source:'satbase',layout:{visibility:'none'},
      paint:satPaint({'raster-opacity':1,'raster-fade-duration':150})}
      :{id:'sat-base',type:'circle',source:'satbase',layout:{visibility:'none'},paint:{'circle-radius':0}},
    SPARSE?{id:'sat-patch',type:'raster',source:'satpatch',layout:{visibility:'none'},
      paint:satPaint({'raster-opacity':1,'raster-fade-duration':150})}
      :{id:'sat-patch',type:'circle',source:'satpatch',layout:{visibility:'none'},paint:{'circle-radius':0}},
     
    {id:'hillshade',type:'raster',source:'hs',
      paint:{'raster-opacity':0.42,'raster-contrast':0.12,'raster-fade-duration':0}},
     
    {id:'cont-line',type:'line',source:'cont',minzoom:12.4,
      layout:{visibility:'none','line-join':'round'},
      filter:['==',['get','i'],0],
      paint:{'line-color':'#9A7B52','line-width':w(0.4,0.9,1.7),
        'line-opacity':0.62}},
    {id:'cont-index',type:'line',source:'cont',minzoom:11.6,
      layout:{visibility:'none','line-join':'round'},
      filter:['==',['get','i'],1],
      paint:{'line-color':'#8A6A42','line-width':w(0.9,1.7,2.8),
        'line-opacity':0.8}},
     
    {id:'lc-water',type:'fill',source:'ground',
      filter:['==',['get','k'],'water'],
      paint:{'fill-color':'#A9D3E6'}},
    {id:'water',type:'fill',source:'wtr',filter:['==',['get','c'],'water'],
      paint:{'fill-color':'#A9D3E6'}},
    {id:'wway',type:'line',source:'wtr',filter:['==',['get','c'],'waterway'],
      paint:{'line-color':'#A9D3E6','line-width':w(0.5,1.8,4)}},
     
    {id:'casing',type:'line',source:'net',
      layout:{'line-cap':'round','line-join':'round'},
      filter:netLyrF('casing',['in',['get','c'],['literal',['route72','trail50','moto24','mccct','fstrail']]]),
       
      paint:{'line-color':'#FFFFFF','line-opacity':0.95,'line-width':w(3.2,7.2,15)}},
     
    {id:'casing-track',type:'line',source:'net',
      layout:{'line-cap':'round','line-join':'round'},
       
      filter:netLyrF('casing-track',['==',['get','c'],'track'],'track'),
      paint:{'line-color':'#FFFFFF','line-opacity':0.75,'line-width':w(1.7,3.8,8)}},
     
    {id:'casing-fsroad',type:'line',source:'net',
      layout:{'line-cap':'round','line-join':'round'},
       
      filter:netLyrF('casing-fsroad',['==',['get','c'],'fsroad'],'fsroad'),
      paint:{'line-color':'#FFFFFF','line-opacity':0.55,'line-width':w(1.2,2.6,5.5)}},
     
     
    lyr('minor-case','minor',PAL.minorcase,w(1.2,2.1,3.8)),
    lyr('paved-case','paved',PAL.pavedcase,w(1.9,3.4,6.6)),
    lyr('minor','minor',PAL.minor,w(0.4,0.9,2.2)),
    lyr('paved','paved',PAL.paved,w(0.9,2,4.8)),
     
    lyr('fsroad','fsroad',PAL.fsroad,w(0.6,1.4,3.2)),
    lyr('track','track',PAL.track,w(0.7,1.8,3.9)),
     
    lyr('foot','foot',PAL.foot,w(1.0,1.8,3.0),[2,2]),
     
    lyr('route72','route72',PAL.route72,w(1.7,4.1,9.5)),
    lyr('fstrail','fstrail',PAL.fstrail,w(1.4,3.4,8)),
    lyr('trail50','trail50',PAL.trail50,w(1.5,3.7,8.6)),
    lyr('mccct','mccct',PAL.mccct,w(1.5,3.7,8.6)),
    lyr('moto24','moto24',PAL.moto24,w(1.5,3.7,8.6)),
    lyr('closed','closed',PAL.closed,w(1.2,3,7),[2,1.3]),
    lyr('fsclosed','fsclosed',PAL.fsclosed,w(1.2,3,7),[2,1.3]),
     
    {id:'show-line',type:'line',source:'showonly',minzoom:11.5,
      layout:{'line-cap':'round'},
       
      paint:{'line-color':['match',['get','c'],
          'foot',PAL.foot,'path',PAL.foot,'horse',PAL.horse,'snow',PAL.snow,
          'snowmob',PAL.snowmob,'nfsmoto',PAL.nfsmoto,PAL.showother],
        'line-width':w(1.1,2,3.2),
        'line-dasharray':[2,2],'line-opacity':0.9}},
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
     
     
    {id:'state-line',type:'line',source:'state',maxzoom:9.6,
      paint:{'line-color':'#8A8175',
        'line-width':['interpolate',['linear'],['zoom'],5,1.0,7,1.4,9.5,1.8],
        'line-opacity':['interpolate',['linear'],['zoom'],5,0.9,8.6,0.7,9.6,0]}},
     
    {id:'county-line',type:'line',source:'county',minzoom:5.5,maxzoom:13,
      layout:{visibility:'none'},
      paint:{'line-color':'#6F6759','line-width':w(0.8,1.2,1.6),
        'line-dasharray':[4,2.5],'line-opacity':0.8}},
    {id:'county-label',type:'symbol',source:'countylbl',minzoom:7,maxzoom:11.5,
      layout:{visibility:'none','text-field':['get','n'],'text-font':['APEX'],
        'text-size':w(9.5,11,12.5),'text-letter-spacing':0.12,'text-transform':'uppercase',
        'text-allow-overlap':false,'text-padding':4},
      paint:{'text-color':'#6F6759','text-halo-color':'#F2F3F0','text-halo-width':1.6}},
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
    {id:'lbl-trail',type:'symbol',source:'strokes',minzoom:10.8,
      filter:['in',['get','c'],['literal',['route72','trail50','moto24','mccct','fstrail']]],
      layout:{'symbol-placement':'line','text-field':['get','lb'],
        'text-font':['APEX'],'text-size':w(9.5,11.5,14),
         
         
        'text-max-angle':85,'symbol-spacing':60,'text-letter-spacing':0.02,
        'text-padding':1},
       
      paint:{'text-color':'#FFFFFF','text-halo-color':'rgba(20,18,15,0.92)',
        'text-halo-width':1.9,'text-halo-blur':0.2}},
     
     
    {id:'lbl-trail-short',type:'symbol',source:'shortpts',minzoom:13.4,
      layout:{'text-field':['get','lb'],'text-font':['APEX'],
        'text-size':w(9,10.5,12),'text-max-width':9,'text-line-height':1.15,
        'text-padding':2,'text-anchor':'center','text-allow-overlap':false},
      paint:{'text-color':'#FFFFFF','text-halo-color':'rgba(20,18,15,0.92)',
        'text-halo-width':1.9,'text-halo-blur':0.2}},
    {id:'lbl-show',type:'symbol',source:'showonly',minzoom:13.0,
      layout:{'symbol-placement':'line','text-field':['get','n'],
        'text-font':['APEX'],'text-size':w(8.5,9.5,11),'text-max-angle':75,
        'symbol-spacing':160,'text-padding':2},
      paint:{'text-color':'#6E6152','text-halo-color':'#EFE6D2','text-halo-width':1.5}},
    {id:'lbl-fsroad',type:'symbol',source:'strokes',minzoom:11.6,
      filter:['==',['get','c'],'fsroad'],
      layout:{'symbol-placement':'line','text-field':['get','lb'],
        'text-font':['APEX'],'text-size':w(8.5,10,12),
        'text-max-angle':70,'symbol-spacing':180,'text-padding':2},
      paint:{'text-color':'#4A423A','text-halo-color':'#EFE6D2','text-halo-width':1.5}},
     
     
     
    {id:'poi-dot',type:'symbol',source:'poi',minzoom:11.4,
      filter:['!=',['get','d'],1],
      layout:{'icon-image':['concat','bdg-',['get','k']],
        'icon-size':w(0.52,0.72,0.95),'icon-allow-overlap':true,
        'text-field':['step',['zoom'],'',12.8,['get','n']],
        'text-font':['APEX'],'text-size':w(8.5,10,11.5),'text-max-width':9,
         
        'icon-anchor':BADGE_DROPS.length?['match',['get','k'],BADGE_DROPS,'bottom','center']:'center',
        'text-offset':BADGE_DROPS.length?['match',['get','k'],BADGE_DROPS,
          ['literal',[0,0.35]],['literal',[0,1.15]]]:[0,1.15],
        'text-anchor':'top','text-padding':3,
        'text-optional':true,'symbol-sort-key':['get','r']},
      paint:{'text-color':['get','c'],'text-halo-color':'#FFFFFF',
        'text-halo-width':1.7}},
    {id:'poi-dot-major',type:'symbol',source:'poi',minzoom:9.2,
      filter:['step',['zoom'],
        ['all',['==',['get','d'],1],['<=',['get','pri'],0]],
        10.5,['all',['==',['get','d'],1],['<=',['get','pri'],1]],
        11.4,['==',['get','d'],1]],
      layout:{'icon-image':['concat','bdg-',['get','k']],
        'icon-size':['interpolate',['linear'],['zoom'],
          9.2,0.60, 11.4,1.04, 14,1.44, 17,1.90],
        'icon-allow-overlap':true,'icon-padding':2,
        'text-field':['step',['zoom'],'',11,['get','n']],
        'text-font':['APEX'],'text-size':w(9.5,11,12.5),'text-max-width':9,
        'icon-anchor':BADGE_DROPS.length?['match',['get','k'],BADGE_DROPS,'bottom','center']:'center',
        'text-offset':BADGE_DROPS.length?['match',['get','k'],BADGE_DROPS,
          ['literal',[0,0.35]],['literal',[0,1.5]]]:[0,1.5],
        'text-anchor':'top','text-padding':3,
        'text-optional':true,'symbol-sort-key':['get','r']},
      paint:{'text-color':['get','c'],'text-halo-color':'#FFFFFF',
        'text-halo-width':1.9}},
     
     
    {id:'poi-stack-bg',type:'circle',source:'poistack',
      paint:{'circle-color':['get','c'],'circle-stroke-color':'#FFFFFF',
        'circle-stroke-width':2,
        'circle-radius':['interpolate',['linear'],['get','n'],
          2,16, 10,18, 50,21, 200,25]}},
     
    {id:'poi-stack',type:'symbol',source:'poistack',
      layout:{'icon-image':['concat','stk-',['get','k']],'icon-size':0.62,
        'icon-offset':[0,-10],'icon-allow-overlap':true,'icon-ignore-placement':true,
        'text-field':['to-string',['get','n']],'text-font':['APEX'],
        'text-size':['interpolate',['linear'],['get','n'],2,11,50,13],
        'text-offset':[0,0.62],
        'text-allow-overlap':true,'text-ignore-placement':true},
      paint:{'text-color':'#FFFFFF'}},
    {id:'cont-label',type:'symbol',source:'cont',minzoom:13.2,
      layout:{visibility:'none','symbol-placement':'line',
        'text-field':['get','lb'],'text-font':['APEX'],
        'text-size':w(7.5,8.5,9.5),'text-max-angle':30,
        'symbol-spacing':600,'text-padding':6,'text-letter-spacing':0.04},
      filter:['==',['get','i'],1],
      paint:{'text-color':'#7A5C36','text-halo-color':'#EFE6D2',
        'text-halo-width':1.6}},
     
    {id:'pad-case',type:'line',source:'paddle',minzoom:8,
      layout:{visibility:'none','line-join':'round','line-cap':'round'},
      paint:{'line-color':'#FFFFFF','line-width':w(3.2,5.5,9),'line-opacity':0.75}},
    {id:'pad-line',type:'line',source:'paddle',minzoom:8,
      layout:{visibility:'none','line-join':'round','line-cap':'round'},
      paint:{'line-color':'#1E6FA8','line-width':w(1.8,3.2,5.5)}},
     
    {id:'peak-dot',type:'symbol',source:'peaks',minzoom:10.6,
      layout:{visibility:'none','text-field':'\u25B2','text-font':['APEX'],
        'text-size':w(8,10,12),'text-allow-overlap':true,'text-padding':0},
      paint:{'text-color':'#3A352E','text-halo-color':'#FFFFFF','text-halo-width':1.8}},
    {id:'peak-label',type:'symbol',source:'peaks',minzoom:11.4,
      layout:{visibility:'none','text-field':['get','lb'],'text-font':['APEX'],
        'text-size':w(8,9.5,11),'text-offset':[0,0.85],'text-anchor':'top',
        'text-max-width':10,'text-padding':4,'text-line-height':1.15},
      paint:{'text-color':'#3A352E','text-halo-color':'#FFFFFF','text-halo-width':1.9}},
     
     
    {id:'pad-dot',type:'symbol',source:'padpin',minzoom:9.5,
      filter:['!=',['get','k'],'dam'],
      layout:{visibility:'none',
        'icon-image':['concat','bdg-pad-',['get','k']],
        'icon-anchor':PAD_DROPS.length?['match',['get','k'],PAD_DROPS,'bottom','center']:'center',
        'icon-size':w(0.5,0.68,0.9),'icon-allow-overlap':true},
      paint:{}},
    {id:'pad-lbl',type:'symbol',source:'padpin',minzoom:12.4,
      layout:{visibility:'none','text-field':['get','lb'],'text-font':['APEX'],
        'text-size':w(8,9.5,11),'text-offset':[0,1],'text-anchor':'top',
        'text-max-width':9,'text-padding':4},
      filter:['!=',['get','k'],'dam'],
      paint:{'text-color':'#1C1A16','text-halo-color':'#FFFFFF','text-halo-width':1.9}},
     
    {id:'pad-dam',type:'circle',source:'padpin',minzoom:8,
      layout:{visibility:'none'},
      filter:['==',['get','k'],'dam'],
      paint:{'circle-radius':w(4,6,8),'circle-color':'#C1121F',
        'circle-stroke-color':'#FFFFFF','circle-stroke-width':2}},
    {id:'pad-damlbl',type:'symbol',source:'padpin',minzoom:10.5,
      layout:{visibility:'none','text-field':['get','lb'],'text-font':['APEX'],
        'text-size':w(9,10.5,12),'text-offset':[0,1.1],'text-anchor':'top',
        'text-allow-overlap':false,'text-padding':2},
      filter:['==',['get','k'],'dam'],
      paint:{'text-color':'#8E0F19','text-halo-color':'#FFFFFF','text-halo-width':2.2}},
    {id:'area-line',type:'line',source:'areas',
      paint:{'line-color':'#0B7A3E','line-width':w(1,1.6,2.6),'line-dasharray':[3,1.5]}},
     
    {id:'pub-line',type:'line',source:'pubs',minzoom:8,layout:{visibility:'none'},
      paint:{'line-color':['match',['get','t'],'game','#2F6E24','park','#3D6B35','#4E7A3E'],
        'line-width':w(0.6,1.1,1.8),'line-opacity':0.8}},
    {id:'pub-label',type:'symbol',source:'pubpt',minzoom:8.5,maxzoom:12,
      layout:{visibility:'none','text-field':['get','n'],'text-font':['APEX'],
        'text-size':w(9,10.5,12),'text-max-width':9,'text-allow-overlap':false,'text-padding':4},
      paint:{'text-color':'#2F6E24','text-halo-color':'#FFFFFF','text-halo-width':1.8}},
    {id:'nf-label',type:'symbol',source:'nf',minzoom:6.5,maxzoom:11,
      layout:{visibility:'none','text-field':['concat',['get','n'],' National Forest'],'text-font':['APEX'],
        'text-size':w(10,12,13),'text-max-width':10,'symbol-placement':'point'},
      paint:{'text-color':'#2F6E24','text-halo-color':'#FFFFFF','text-halo-width':1.8}},
    {id:'area-label',type:'symbol',source:'areapt',minzoom:7,
      layout:{'text-field':['get','lb'],'text-font':['APEX'],
        'text-size':w(10,11.5,13),'text-anchor':'center','text-max-width':9,
        'text-allow-overlap':false,'text-padding':2},
      paint:{'text-color':'#0B7A3E','text-halo-color':'#FFFFFF','text-halo-width':2}},
     
    {id:'wpt-dot',type:'circle',source:'wpts',minzoom:10.5,
      paint:{'circle-radius':w(3.4,5.2,7),
        'circle-color':['match',['get','t']].concat(Object.keys(WPTYPES).reduce(function(a,k){
          return a.concat([k,WPTYPES[k].c])},[])).concat(['#E2570F']),
        'circle-stroke-color':'#FFFFFF','circle-stroke-width':1.8}},
    {id:'wpt-label',type:'symbol',source:'wpts',minzoom:12.2,
      layout:{'text-field':['get','n'],'text-font':['APEX'],
        'text-size':w(8,9.5,11),'text-offset':[0,1.05],'text-anchor':'top',
        'text-max-width':9,'text-padding':4},
      paint:{'text-color':'#2A2620','text-halo-color':'#FFFFFF','text-halo-width':1.9}},
     
     
    {id:'lbl-shield',type:'symbol',source:'refs',minzoom:10.8,
      filter:['==',['index-of','M-',['get','lb']],0],
      layout:{'symbol-placement':'line','symbol-spacing':420,
        'icon-image':'mi-diamond','icon-rotation-alignment':'viewport',
        'icon-size':w(0.72,0.92,1.05),'icon-allow-overlap':false,
        'text-field':['slice',['get','lb'],2],'text-font':['APEX'],
        'text-size':w(8,9.5,10.5),'text-rotation-alignment':'viewport',
        'text-allow-overlap':false},
      paint:{'text-color':'#1C1A16'}},
    {id:'lbl-ref',type:'symbol',source:'refs',minzoom:11.2,
      filter:['!=',['==',['index-of','M-',['get','lb']],0],true],
      layout:{'symbol-placement':'line','text-field':['get','lb'],
        'text-font':['APEX'],'text-size':w(9,10.5,12.5),
        'text-max-angle':70,'symbol-spacing':340,'text-padding':4,
        'text-letter-spacing':0.02},
      paint:{'text-color':'#1C1A16','text-halo-color':'#FFFFFF',
        'text-halo-width':2.2,'text-halo-blur':0.2}},
     
    {id:'lbl-lake',type:'symbol',source:'wlbl',minzoom:11.6,
      filter:['==',['get','c'],'water'],
      layout:{'text-field':['get','n'],'text-font':['APEX'],
        'text-size':w(8,9.5,11.5),'text-max-width':8,
        'text-letter-spacing':0.06,'text-padding':3},
      paint:{'text-color':'#4E93B8','text-halo-color':'#F2F3F0','text-halo-width':1.5,
        'text-opacity':0.95}},
    {id:'lbl-stream',type:'symbol',source:'wlbl',minzoom:12.6,
      filter:['==',['get','c'],'waterway'],
      layout:{'symbol-placement':'line','text-field':['get','n'],
        'text-font':['APEX'],'text-size':w(7.5,9,10.5),
        'text-max-angle':70,'symbol-spacing':420,'text-padding':4,
        'text-letter-spacing':0.04},
      paint:{'text-color':'#3E6A80','text-halo-color':'#EFE6D2','text-halo-width':1.6,
        'text-opacity':0.9}},
    {id:'lbl-road',type:'symbol',source:'strokes',minzoom:11.0,
      filter:['in',['get','c'],['literal',['paved','minor']]],
      layout:{'symbol-placement':'line','text-field':['get','lb'],
        'text-font':['APEX'],'text-size':w(8.5,10,12.5),
        'text-max-angle':70,'symbol-spacing':300,'text-padding':2},
      paint:{'text-color':'#6E6B66','text-halo-color':'#F5F6F3','text-halo-width':1.4}},
  ]},
   
  center:(HOME||CTR),zoom:(HOME?11.4:8.6),maxZoom:17,minZoom:5.2,
   
  maxBounds:[[-91.5,41.0],[-81.0,49.2]],fadeDuration:0,
  attributionControl:{compact:true,
    customAttribution:'© OpenStreetMap · Michigan DNR · USDA Forest Service · USGS'}});

 
 
var LUCIDE_V='1.37.0';
var ICON_OF={
  map:'map',hybrid:'satellite',layers:'layers',hd:'download',activity:'funnel',
  offroad:'mountain',outdoors:'trees',hunt:'target',water:'waves-horizontal',camp:'tent',
  dirtbike:'motorbike',fourwheel:'car',walk:'footprints',paddle:'kayak',raft:'life-buoy',
  home:'house',start:'crosshair',locate:'locate-fixed',compass:'compass',north:'navigation-2',
  fuel:'fuel',dark:'clock',ride:'play',stop:'square',stopdl:'circle-stop',
  warn:'triangle-alert',route:'route',loop:'repeat',saved:'star',search:'search',
  spot:'map-pin',dispatch:'phone',centre:'maximize',close:'x',del:'trash-2',
  tour:'circle-question-mark',guide:'book-open',about:'info',sources:'database',
  selftest:'shield-check',diag:'stethoscope',pantest:'move',gauge:'gauge',
  tools:'sliders-horizontal',voice:'volume-2',voiceoff:'volume-x',straight:'arrow-up',
  bearleft:'arrow-up-left',bearright:'arrow-up-right',left:'corner-up-left',
  right:'corner-up-right',sharpleft:'arrow-down-left',sharpright:'arrow-down-right',
  uturn:'undo-2',arrive:'circle-dot',reroute:'refresh-cw',downstream:'arrow-down',
  external:'external-link',pass:'circle-check',fail:'circle-x',truck:'truck'
};
var LUCIDE={
  'map':'<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z" /> <path d="M15 5.764v15" /> <path d="M9 3.236v15" />',
  'satellite':'<path d="m13.5 6.5-3.148-3.148a1.205 1.205 0 0 0-1.704 0L6.352 5.648a1.205 1.205 0 0 0 0 1.704L9.5 10.5" /> <path d="M16.5 7.5 19 5" /> <path d="m17.5 10.5 3.148 3.148a1.205 1.205 0 0 1 0 1.704l-2.296 2.296a1.205 1.205 0 0 1-1.704 0L13.5 14.5" /> <path d="M9 21a6 6 0 0 0-6-6" /> <path d="M9.352 10.648a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l4.296-4.296a1.205 1.205 0 0 0 0-1.704l-2.296-2.296a1.205 1.205 0 0 0-1.704 0z" />',
  'layers':'<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" /> <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" /> <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />',
  'download':'<path d="M12 15V3" /> <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /> <path d="m7 10 5 5 5-5" />',
  'funnel':'<path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z" />',
  'mountain':'<path d="m8 3 4 8 5-5 5 15H2L8 3z" />',
  'trees':'<path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z" /> <path d="M7 16v6" /> <path d="M13 19v3" /> <path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5" />',
  'target':'<circle cx="12" cy="12" r="10" /> <circle cx="12" cy="12" r="6" /> <circle cx="12" cy="12" r="2" />',
  'waves-horizontal':'<path d="M2 12q2.5 2 5 0t5 0 5 0 5 0" /> <path d="M2 19q2.5 2 5 0t5 0 5 0 5 0" /> <path d="M2 5q2.5 2 5 0t5 0 5 0 5 0" />',
  'tent':'<path d="M3.5 21 14 3" /> <path d="M20.5 21 10 3" /> <path d="M15.5 21 12 15l-3.5 6" /> <path d="M2 21h20" />',
  'motorbike':'<path d="m18 14-1-3" /> <path d="m3 9 6 2a2 2 0 0 1 2-2h2a2 2 0 0 1 1.99 1.81" /> <path d="M8 17h3a1 1 0 0 0 1-1 6 6 0 0 1 6-6 1 1 0 0 0 1-1v-.75A5 5 0 0 0 17 5" /> <circle cx="19" cy="17" r="3" /> <circle cx="5" cy="17" r="3" />',
  'car':'<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" /> <circle cx="7" cy="17" r="2" /> <path d="M9 17h6" /> <circle cx="17" cy="17" r="2" />',
  'footprints':'<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z" /> <path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z" /> <path d="M16 17h4" /> <path d="M4 13h4" />',
  'kayak':'<path d="M18 17a1 1 0 0 0-1 1v1a2 2 0 1 0 2-2z" /> <path d="M20.97 3.61a.45.45 0 0 0-.58-.58C10.2 6.6 6.6 10.2 3.03 20.39a.45.45 0 0 0 .58.58C13.8 17.4 17.4 13.8 20.97 3.61" /> <path d="m6.707 6.707 10.586 10.586" /> <path d="M7 5a2 2 0 1 0-2 2h1a1 1 0 0 0 1-1z" />',
  'life-buoy':'<circle cx="12" cy="12" r="10" /> <path d="m4.93 4.93 4.24 4.24" /> <path d="m14.83 9.17 4.24-4.24" /> <path d="m14.83 14.83 4.24 4.24" /> <path d="m9.17 14.83-4.24 4.24" /> <circle cx="12" cy="12" r="4" />',
  'house':'<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /> <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />',
  'crosshair':'<circle cx="12" cy="12" r="10" /> <line x1="22" x2="18" y1="12" y2="12" /> <line x1="6" x2="2" y1="12" y2="12" /> <line x1="12" x2="12" y1="6" y2="2" /> <line x1="12" x2="12" y1="22" y2="18" />',
  'locate-fixed':'<line x1="2" x2="5" y1="12" y2="12" /> <line x1="19" x2="22" y1="12" y2="12" /> <line x1="12" x2="12" y1="2" y2="5" /> <line x1="12" x2="12" y1="19" y2="22" /> <circle cx="12" cy="12" r="7" /> <circle cx="12" cy="12" r="3" />',
  'compass':'<circle cx="12" cy="12" r="10" /> <path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z" />',
  'navigation-2':'<polygon points="12 2 19 21 12 17 5 21 12 2" />',
  'fuel':'<path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0v-6.998a2 2 0 0 0-.59-1.42L18 5" /> <path d="M14 21V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16" /> <path d="M2 21h13" /> <path d="M3 9h11" />',
  'clock':'<circle cx="12" cy="12" r="10" /> <path d="M12 6v6l4 2" />',
  'play':'<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />',
  'square':'<rect width="18" height="18" x="3" y="3" rx="2" />',
  'circle-stop':'<circle cx="12" cy="12" r="10" /> <rect x="9" y="9" width="6" height="6" rx="1" />',
  'triangle-alert':'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /> <path d="M12 9v4" /> <path d="M12 17h.01" />',
  'route':'<circle cx="6" cy="19" r="3" /> <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" /> <circle cx="18" cy="5" r="3" />',
  'repeat':'<path d="m17 2 4 4-4 4" /> <path d="M3 11v-1a4 4 0 0 1 4-4h14" /> <path d="m7 22-4-4 4-4" /> <path d="M21 13v1a4 4 0 0 1-4 4H3" />',
  'star':'<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />',
  'search':'<path d="m21 21-4.34-4.34" /> <circle cx="11" cy="11" r="8" />',
  'map-pin':'<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" /> <circle cx="12" cy="10" r="3" />',
  'phone':'<path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />',
  'maximize':'<path d="M8 3H5a2 2 0 0 0-2 2v3" /> <path d="M21 8V5a2 2 0 0 0-2-2h-3" /> <path d="M3 16v3a2 2 0 0 0 2 2h3" /> <path d="M16 21h3a2 2 0 0 0 2-2v-3" />',
  'x':'<path d="M18 6 6 18" /> <path d="m6 6 12 12" />',
  'trash-2':'<path d="M10 11v6" /> <path d="M14 11v6" /> <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /> <path d="M3 6h18" /> <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />',
  'circle-question-mark':'<circle cx="12" cy="12" r="10" /> <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /> <path d="M12 17h.01" />',
  'book-open':'<path d="M12 5v16" /> <path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z" />',
  'info':'<circle cx="12" cy="12" r="10" /> <path d="M12 16v-4" /> <path d="M12 8h.01" />',
  'database':'<ellipse cx="12" cy="5" rx="9" ry="3" /> <path d="M3 5V19A9 3 0 0 0 21 19V5" /> <path d="M3 12A9 3 0 0 0 21 12" />',
  'shield-check':'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /> <path d="m9 12 2 2 4-4" />',
  'stethoscope':'<path d="M11 2v2" /> <path d="M5 2v2" /> <path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1" /> <path d="M8 15a6 6 0 0 0 12 0v-3" /> <circle cx="20" cy="10" r="2" />',
  'move':'<path d="M12 2v20" /> <path d="m15 19-3 3-3-3" /> <path d="m19 9 3 3-3 3" /> <path d="M2 12h20" /> <path d="m5 9-3 3 3 3" /> <path d="m9 5 3-3 3 3" />',
  'gauge':'<path d="m12 14 4-4" /> <path d="M3.34 19a10 10 0 1 1 17.32 0" />',
  'sliders-horizontal':'<path d="M10 5H3" /> <path d="M12 19H3" /> <path d="M14 3v4" /> <path d="M16 17v4" /> <path d="M21 12h-9" /> <path d="M21 19h-5" /> <path d="M21 5h-7" /> <path d="M8 10v4" /> <path d="M8 12H3" />',
  'volume-2':'<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" /> <path d="M16 9a5 5 0 0 1 0 6" /> <path d="M19.364 18.364a9 9 0 0 0 0-12.728" />',
  'volume-x':'<path d="M11 4.702a.7.7 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.7.7 0 0 0 11 19.298z" /> <path d="m16.5 14.5 5-5" /> <path d="m16.5 9.5 5 5" />',
  'arrow-up':'<path d="m5 12 7-7 7 7" /> <path d="M12 19V5" />',
  'arrow-up-left':'<path d="M7 17V7h10" /> <path d="M17 17 7 7" />',
  'arrow-up-right':'<path d="M7 7h10v10" /> <path d="M7 17 17 7" />',
  'corner-up-left':'<path d="M20 20v-7a4 4 0 0 0-4-4H4" /> <path d="M9 14 4 9l5-5" />',
  'corner-up-right':'<path d="m15 14 5-5-5-5" /> <path d="M4 20v-7a4 4 0 0 1 4-4h12" />',
  'arrow-down-left':'<path d="M17 7 7 17" /> <path d="M17 17H7V7" />',
  'arrow-down-right':'<path d="m7 7 10 10" /> <path d="M17 7v10H7" />',
  'undo-2':'<path d="M9 14 4 9l5-5" /> <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />',
  'circle-dot':'<circle cx="12" cy="12" r="1" /> <circle cx="12" cy="12" r="10" />',
  'refresh-cw':'<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /> <path d="M21 3v5h-5" /> <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /> <path d="M8 16H3v5" />',
  'arrow-down':'<path d="M12 5v14" /> <path d="m19 12-7 7-7-7" />',
  'external-link':'<path d="M15 3h6v6" /> <path d="M10 14 21 3" /> <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />',
  'circle-check':'<circle cx="12" cy="12" r="10" /> <path d="m16 9-5.5 5.5L8 12" />',
  'circle-x':'<circle cx="12" cy="12" r="10" /> <path d="m15 9-6 6" /> <path d="m9 9 6 6" />',
  'truck':'<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" /> <path d="M15 18H9" /> <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" /> <circle cx="17" cy="18" r="2" /> <circle cx="7" cy="18" r="2" />',
  'sailboat':'<path d="M10 2v15" /> <path d="M7 22a4 4 0 0 1-4-4 1 1 0 0 1 1-1h16a1 1 0 0 1 1 1 4 4 0 0 1-4 4z" /> <path d="M9.159 2.46a1 1 0 0 1 1.521-.193l9.977 8.98A1 1 0 0 1 20 13H4a1 1 0 0 1-.824-1.567z" />',
  'anchor':'<path d="M12 6v16" /> <path d="m19 13 2-1a9 9 0 0 1-18 0l2 1" /> <path d="M9 11h6" /> <circle cx="12" cy="4" r="2" />',
  'umbrella':'<path d="M12 13v7a2 2 0 0 0 4 0" /> <path d="M12 2v2" /> <path d="M20.992 13a1 1 0 0 0 .97-1.274 10.284 10.284 0 0 0-19.923 0A1 1 0 0 0 3 13z" />',
  'mountain-snow':'<path d="m8 3 4 8 5-5 5 15H2L8 3z" /> <path d="M4.14 15.08c2.62-1.57 5.24-1.43 7.86.42 2.74 1.94 5.49 2 8.23.19" />',
  'binoculars':'<path d="M10 10h4" /> <path d="M19 7V4a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v3" /> <path d="M20 21a2 2 0 0 0 2-2v-3.851c0-1.39-2-2.962-2-4.829V8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v11a2 2 0 0 0 2 2z" /> <path d="M 22 16 L 2 16" /> <path d="M4 21a2 2 0 0 1-2-2v-3.851c0-1.39 2-2.962 2-4.829V8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2z" /> <path d="M9 7V4a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v3" />',
  'waves-arrow-down':'<path d="M12 10L12 2" /> <path d="M16 6L12 10L8 6" /> <path d="M2 15C2.6 15.5 3.2 16 4.5 16C7 16 7 14 9.5 14C12.1 14 11.9 16 14.5 16C17 16 17 14 19.5 14C20.8 14 21.4 14.5 22 15" /> <path d="M2 21C2.6 21.5 3.2 22 4.5 22C7 22 7 20 9.5 20C12.1 20 11.9 22 14.5 22C17 22 17 20 19.5 20C20.8 20 21.4 20.5 22 21" />',
  'warehouse':'<path d="M18 21V10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v11" /> <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 1.132-1.803l7.95-3.974a2 2 0 0 1 1.837 0l7.948 3.974A2 2 0 0 1 22 8z" /> <path d="M6 13h12" /> <path d="M6 17h12" />',
  'bike':'<circle cx="18.5" cy="17.5" r="3.5" /> <circle cx="5.5" cy="17.5" r="3.5" /> <circle cx="15" cy="5" r="1" /> <path d="M12 17.5V14l-3-3 4-3 2 3h2" />',
  'shopping-bag':'<path d="M16 10a4 4 0 0 1-8 0" /> <path d="M3.103 6.034h17.794" /> <path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z" />',
  'utensils':'<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /> <path d="M7 2v20" /> <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />',
  'droplet':'<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />',
  'toilet':'<path d="M7 12h13a1 1 0 0 1 1 1 5 5 0 0 1-5 5h-.598a.5.5 0 0 0-.424.765l1.544 2.47a.5.5 0 0 1-.424.765H5.402a.5.5 0 0 1-.424-.765L7 18" /> <path d="M8 18a5 5 0 0 1-5-5V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8" />',
  'circle-parking':'<circle cx="12" cy="12" r="10" /> <path d="M9 17V7h4a3 3 0 0 1 0 6H9" />'
};

function ic(n,sz){
  var d=LUCIDE[ICON_OF[n]];
  if(!d)return '';
   
  return '<svg class="ic" width="'+(sz||15)+'" height="'+(sz||15)+'" viewBox="0 0 24 24" '+
    'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" '+
    'stroke-linejoin="round" aria-hidden="true">'+d+'</svg>'}

 
 
function paintIcons(){
   
  Array.prototype.forEach.call(document.querySelectorAll('#shell button'),
    function(b){
      if(b.innerHTML.indexOf('__IC_')<0)return;
      b.innerHTML=b.innerHTML.replace(/__IC_([a-z]+)__/g,
        function(_,n){return ic(n)})})}

function setChip(id,icon,label,on){
  var b=el(id);
  if(!b)return;
  b.innerHTML=ic(icon)+'<span>'+label+'</span>';
   
  var base=(' '+b.className+' ').indexOf(' basebtn ')>=0?'basebtn':'chip';
  b.className=base+(on?' on':'')+(b.id==='c-act'?' actbtn':'')}

try{paintIcons()}catch(e){}
 
 
try{var _sh=document.getElementById('shell');
  if(_sh&&_sh.className.indexOf('ready')<0)_sh.className+=' ready'}catch(e){}

function mk(cls,key){var d=document.createElement('div');d.className='pin '+cls;
  if(key)d.innerHTML=ic(key);return d}
 
function anchorOf(kind,skip){
  for(var i=0;i<PLACES.length;i++){var p=PLACES[i];
    if(p[3]===kind&&(!skip||p[0]!==skip))return [p[1],p[2]]}
  for(var i=0;i<PLACES.length;i++){var p=PLACES[i];
    if(!skip||p[0]!==skip)return [p[1],p[2]]}
  return CTR}
 
 
function homeSave(){try{HOME?localStorage.setItem(HOMEKEY,JSON.stringify(HOME))
                        :localStorage.removeItem(HOMEKEY)}catch(e){}}
 
var ME=CTR.slice();
var hM=new maplibregl.Marker({element:mk('home','home')});
function homeMark(){if(HOME){hM.setLngLat(HOME).addTo(map)}else{try{hM.remove()}catch(e){}}}
homeMark();
var mM=new maplibregl.Marker({element:mk('me','start')}).setLngLat(ME).addTo(map);
var arm=null;

 
function homeCard(prefix){
  var h=(prefix||'')+'<b>Set home</b> — the truck, the cabin, the trailhead you start from.'+
    '<div style="margin-top:8px">'+
    '<button class="chip" id="hc-me">Use my location</button> '+
    '<button class="chip" id="hc-addr">Type an address</button> '+
    '<button class="chip" id="hc-tap">Tap the map</button>'+
    (HOME?' <button class="chip" id="hc-clear">Clear home</button>':'')+
    '</div><div class="sub" style="margin-top:6px">Then press and hold where you want to go and tap '+
    '<b>Route here</b>; <b>Return home</b> routes back from wherever you are.</div>';
  show(h,'');
   
  ['me','addr','tap','clear'].forEach(function(w){var b=el('hc-'+w);if(!b)return;
    b.addEventListener('click',function(){
      logAct('act  set home '+w);
      if(w==='tap'){arm='home';syncArm();return show('Tap the map to place <b>home</b>.','')}
      if(w==='clear'){HOME=null;homeSave();homeMark();clearRoute();syncSafety();
        return ack('<b>Home cleared.</b>')}
      if(w==='addr'){arm='homeaddr';syncArm();
        try{el('srch').className='on';el('c-search').className='chip on';el('q').value='';el('q').focus()}catch(e){}
        return show('Type the address — a number and a street, like <b>4952 S Branch Rd</b>. '+
          'The hit you tap becomes home.','')}
       
      show('Waiting for a GPS fix…','');
      locateOnce(function(at,why){
        if(!at)return show(why==='none'
          ?'<b>This phone reports no GPS receiver.</b> Set home by address or by a tap on the map.'
          :'<b>No GPS fix in 25 s.</b> Try outside, or set home another way.','');
        HOME=at.slice();homeSave();homeMark();clearRoute();syncSafety();
        show('<b>Home is where you are.</b> Press and hold where you want to go and tap '+
          '<b>Route here</b>.','')})})})}
el('c-home').addEventListener('click',function(){
  if(arm==='home'||arm==='homeaddr'){arm=null;syncArm();return ack('Cancelled.')}
  homeCard('')});
el('c-me').addEventListener('click',function(){
  arm=arm==='me'?null:'me';syncArm();
  if(arm)show("Tap the map to place <b>where you are</b>.",'');else ack('Cancelled.')});
function syncArm(){el('c-home').className='chip'+((arm==='home'||arm==='homeaddr')?' arm':'');
  el('c-me').className='chip'+(arm==='me'?' arm':'')}

el('c-saved').addEventListener('click',function(){
  logAct('act  saved routes');buildSavedPanel()});

el('c-machine').addEventListener('click',function(){
   
  if(mode==='water'){
    var wi=(WORDER.indexOf(machine)+1)%WORDER.length;
    machine=WORDER[wi];waterCraft=machine;
    setChip('c-machine',MACHINE[machine].ic,MACHINE[machine].lbl);
    show('Craft set to <b>'+MACHINE[machine].lbl+
      '</b>. Float times on the river cards use it.','');
    return}
  machIdx=(machIdx+1)%ORDER.length;machine=ORDER[machIdx];_legalMemo={};
  setChip('c-machine',MACHINE[machine].ic,MACHINE[machine].lbl);
  applyMachine();
  var no=machineIllegal();
  clearRoute();show('Machine set to <b>'+MACHINE[machine].lbl+
   '</b>. Routing respects what is legal for it, and the map now shows it: '+
   (no.length?'<b>'+no.length+'</b> kind'+(no.length>1?'s':'')+' of line faded '+
     'because they are too narrow for it. They are still real trails \u2014 just '+
     'not yours today.':'nothing on this map is off limits for it.'),'')});

var FUELS=[30,50,80,120,0],fi=1;
el('c-fuel').addEventListener('click',function(){fi=(fi+1)%FUELS.length;
  setChip('c-fuel','fuel',FUELS[fi]?FUELS[fi]+' mi':'off');
  if(last)renderRoutes(last)});

 
 
 
var GRID=null, GCS=0.02;
function gkey(cx,cy){return cx*100000+cy}
function gcell(ll){return [Math.floor((ll[0]+180)/GCS),Math.floor((ll[1]+90)/GCS)]}
function gridBuild(){
  if(GRID)return GRID;
  var t0=Date.now(), nodes=new Map(), edges=new Map();
  function put(m,k,v){var a=m.get(k);if(a)a.push(v);else m.set(k,[v])}
  for(var i=0;i<NODES.length;i++){var c=gcell(NODES[i]);put(nodes,gkey(c[0],c[1]),i)}
  for(var e=0;e<EDGES.length;e++){var g=decode(GR.g[e]),last=-1;
    for(var k=0;k<g.length;k++){var c2=gcell(g[k]),kk=gkey(c2[0],c2[1]);
      if(kk!==last){put(edges,kk,e);last=kk}}}
  GRID={nodes:nodes,edges:edges,ms:Date.now()-t0};
  try{window.__gridMs=GRID.ms}catch(e){}
  return GRID}
 
function gridRings(ll,idx,visit,maxR){
   
  var c=gcell(ll);
  var hit=function(dx,dy){var a=idx.get(gkey(c[0]+dx,c[1]+dy));if(a)visit(a)};
  for(var r=0;r<=maxR;r++){
    if(r===0)hit(0,0);
    else{ 
      for(var dx=-r;dx<=r;dx++){hit(dx,-r);hit(dx,r)}
      for(var dy=-r+1;dy<=r-1;dy++){hit(-r,dy);hit(r,dy)}}
    if(visit.done(r))return}}
 
function ringMi(r){return Math.max(0,r-0.5)*GCS*0.714*69}

function nearestNode(ll){
  var G=gridBuild(), best=1e18,bi=-1;
  var visit=function(list){
    for(var j=0;j<list.length;j++){var i=list[j],ad=ADJ[i],legal=false;
      for(var k=0;k<ad.length;k++){if(machineLegal(ad[k])){legal=true;break}}
      if(!legal)continue;
      var dx=NODES[i][0]-ll[0],dy=NODES[i][1]-ll[1],d=dx*dx*0.51+dy*dy;
      if(d<best){best=d;bi=i}}};
  visit.done=function(r){return bi>=0&&ringMi(r+1)>Math.sqrt(best)*69};
  gridRings(ll,G.nodes,visit,400);    
  return bi>=0?bi:nearestNode_linear(ll)}
function nearestNode_linear(ll){
  var best=1e18,bi=-1;
  for(var i=0;i<NODES.length;i++){
    var ad=ADJ[i],legal=false;
    for(var k=0;k<ad.length;k++){
       
      if(machineLegal(ad[k])){legal=true;break}}
    if(!legal)continue;
    var dx=NODES[i][0]-ll[0],dy=NODES[i][1]-ll[1],d=dx*dx*0.51+dy*dy;
    if(d<best){best=d;bi=i}}
  return bi}

function snapMiles(ll,ni){if(ni<0)return 0;
  var dx=(NODES[ni][0]-ll[0])*0.714*69,dy=(NODES[ni][1]-ll[1])*69;
  return Math.sqrt(dx*dx+dy*dy)}

var ROUTE_CAP=Math.max(150000,Math.ceil(NODES.length*1.2));
function route(from,to,cost){
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
   
  var _exp=0;
  while(heap.length){var cur=pop(),d=cur[0],u=cur[1];
    if(done[u])continue;done[u]=1;if(u===to)break;
     
    if(++_exp>ROUTE_CAP)return null;
    var ad=ADJ[u];
    for(var k=0;k<ad.length;k++){var e=ad[k];
      if(e.c==='closed'||e.c==='fsclosed')continue;    
      if(!machineLegal(e))continue;                     
      var v=e.a===u?e.b:e.a;if(done[v])continue;
      var nd=d+cost(e);
      if(nd<dist[v]){dist[v]=nd;prev[v]=u;pe[v]=e.i;push([nd,v])}}}
  if(!isFinite(dist[to]))return null;
  var path=[],u=to;while(u!==from&&prev[u]>=0){path.push(EDGES[pe[u]]);u=prev[u]}
  return path.reverse()}

 
var DESIG={route72:1,trail50:1,moto24:1,mccct:1,fstrail:1};
var DIRT={fsroad:1,track:1};

function summarise(path){
  var mi=0,hrs=0,off=0,adv=0,hardest=0,names={},up=0,dn=0,prof=[],run=0;
   
  var mDes=0,mDirt=0,mRoad=0;
  path.forEach(function(e){var L=e.L/1609.34;mi+=L;hrs+=L/spd(e);
    if(DESIG[e.c])mDes+=L; else if(DIRT[e.c])mDirt+=L; else mRoad+=L;
    if(!PAVED[e.c])off+=L;
    var a=attrs(e);if(a.auth!=='legal')adv+=L;
    var h=HARD.indexOf(e.c);if(h>hardest)hardest=h;
    if(e.n)names[e.n]=1;
    up+=(UP&&UP[e.i])||0;dn+=(DN&&DN[e.i])||0;
    var ep=edgeProfile(e.i),base=(NE&&NE[e.a])||0;
    for(var k=0;k<ep.length;k+=2)prof.push(base+ep[k]);
    run+=L});
   
  hrs+=(up*3.28084/100)/60;
  return {mi:mi,hrs:hrs,off:off,adv:adv,hard:HARD[hardest],up:up,dn:dn,prof:prof,
          des:mDes,dirt:mDirt,road:mRoad,
          turns:Object.keys(names).length,path:path}}

 
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
   
  {k:'trail',h:'Most trail',f:function(e){
     return e.L*(DESIG[e.c]?0.55:DIRT[e.c]?1.3:8)}},
  {k:'fast',h:'Fastest',f:function(e){return e.L/spd(e)}},
  {k:'easy',h:'Easiest',f:function(e){return e.L*(EFFORT[e.c]||2)+UP[e.i]*CLIMB_K}},
  {k:'pave',h:'Pavement soonest',f:function(e){return e.L*(PAVED[e.c]?1:9)}},
  {k:'short',h:'Shortest',f:function(e){return e.L}},
  {k:'flat',h:'Least climbing',f:function(e){return e.L*0.35+UP[e.i]*45}}
];

 
var SVKEY='apex.routes.v1';
 
var WPKEY='apex.waypoints.v1';

 
 
var GUIDEKEY='apex.guide.v3';

function guideSeen(){
  if(!svAvailable())return false;
  try{return localStorage.getItem(GUIDEKEY)==='1'}catch(e){return false}}

function guideShow(){
  var g=el('guide');
  if(!g)return;
  g.hidden=false;
  logAct('act  guide open');}

function guideClose(mark){
  var g=el('guide');
  if(!g)return;
  g.hidden=true;
  if(mark&&svAvailable()){try{localStorage.setItem(GUIDEKEY,'1')}catch(e){}}
  logAct('act  guide close');}

 
 
var TOURKEY='apex.tour.v2',TOUR={on:false,i:0,steps:[]};
var TOUR_STEPS=[
  {id:'c-mode',   tab:null,   t:'What are you doing today?',
   s:'Off-road, Outdoors, Hunt, Water or Camp. A mode sets the pins, the lines and the routing for that kind of day — and everything it sets stays one tap away.'},
  {id:'c-act',    tab:'map',  t:'Which lines',
   s:'ORV, two-track, hiking, or all of them. The colours are the legend: green, blue and black by difficulty; red is closed.'},
  {id:'c-layers', tab:'map',  t:'Layers',
   s:'Map or Hybrid; public land, rivers, contours, county lines; which pins this mode shows. Done closes it.'},
  {id:'c-search', tab:'map',  t:'Search',
   s:'A trail code like H58, a town, a river or a street address — all of it offline.'},
  {id:'c-hd',     tab:null,   t:'Sharper satellite',
   s:'Save HD imagery for this view, your county, or the whole state, on wifi. Nothing downloads on its own.'},
   
  {id:'btn-home', tab:null,   t:'Return home',
   s:'Routes you home from wherever you are \u2014 then Ride it on the route card. No home yet? It asks where home is.'},
  {id:'c-ride',   tab:'ride', t:'Ride',
   s:'Press and hold a spot, tap Route here, then Ride it on the route card. Or ride from here with no route: the truck pins where you started, and Retrace leads you back on your own track.'}];
function tourSeen(){if(!svAvailable())return false;try{return localStorage.getItem(TOURKEY)==='1'}catch(e){return false}}
function tourMark(){if(svAvailable()){try{localStorage.setItem(TOURKEY,'1')}catch(e){}}}
function tourReset(){if(svAvailable()){try{localStorage.removeItem(TOURKEY)}catch(e){}}}
function tourVisible(id){var c=el(id);if(!c||typeof c.getBoundingClientRect!=='function')return false;
  if(c.hidden)return false;var r=c.getBoundingClientRect();return r.width>1&&r.height>1}
function tourStart(){
  var t=el('tour');if(!t)return false;
  TOUR.steps=TOUR_STEPS.slice();TOUR.i=-1;TOUR.on=true;t.hidden=false;
  TOUR.tab0=(typeof TAB==='string')?TAB:null;    
  logAct('act  tour start');
  return tourNext()}
function tourNext(){
  if(!TOUR.on)return false;
  for(var i=TOUR.i+1;i<TOUR.steps.length;i++){
    var st=TOUR.steps[i];
    try{if(st.tab&&typeof showTab==='function')showTab(st.tab)}catch(e){}
    if(!tourVisible(st.id)){logAct('tour skip '+st.id+' (hidden)');continue}
    TOUR.i=i;tourPaint();return true}
  return tourClose('done')}
function tourPaint(){
  var st=TOUR.steps[TOUR.i],c=el(st.id),ring=el('tour-ring'),card=el('tour-card');
  if(!c||!ring||!card)return;
  var r=c.getBoundingClientRect(),pad=6,vh=window.innerHeight||900;
  ring.style.left=(r.left-pad)+'px';ring.style.top=(r.top-pad)+'px';
  ring.style.width=(r.width+pad*2)+'px';ring.style.height=(r.height+pad*2)+'px';
  var last=TOUR.i>=TOUR.steps.length-1;
  card.innerHTML='<button id="tour-x" aria-label="Not now">'+ic('close',18)+'</button>'+
    '<b>'+st.t+'</b><div class="sub">'+st.s+'</div>'+
    '<div id="tour-btns">'+
      '<button class="chip" id="tour-next"><span>'+(last?'Done':'Next')+'</span></button>'+
      '<button class="chip quiet" id="tour-notnow"><span>Not now</span></button>'+
      '<button class="chip quiet" id="tour-never"><span>Don\u2019t show again</span></button>'+
      '<span id="tour-n">'+(TOUR.i+1)+' of '+TOUR.steps.length+'</span></div>';
   
  if(r.top<vh/2){card.style.top=(r.bottom+pad+12)+'px';card.style.bottom='auto'}
  else{card.style.bottom=(vh-r.top+pad+12)+'px';card.style.top='auto'}
  el('tour-next').addEventListener('click',function(){tourNext()});
  el('tour-notnow').addEventListener('click',function(){tourClose('notnow')});
  el('tour-x').addEventListener('click',function(){tourClose('notnow')});
  el('tour-never').addEventListener('click',function(){tourClose('never')});}
function tourClose(how){
  var t=el('tour');if(t)t.hidden=true;
  TOUR.on=false;
  try{if(TOUR.tab0&&typeof showTab==='function'&&TAB!==TOUR.tab0)showTab(TOUR.tab0)}catch(e){}
  if(how==='done'||how==='never')tourMark();
  logAct('act  tour close '+how);
  return how}
try{window.addEventListener('resize',function(){if(TOUR.on)tourPaint()})}catch(e){}

function wpLoad(){
  if(!svAvailable())return [];
  try{var a=JSON.parse(localStorage.getItem(WPKEY)||'[]');
      return Array.isArray(a)?a:[]}catch(e){return []}}

function wpWrite(a){
  if(!svAvailable())return false;
  try{localStorage.setItem(WPKEY,JSON.stringify(a));return true}catch(e){return false}}

function wpAdd(rec){
  var a=wpLoad().filter(function(x){return x.n!==rec.n});
  a.unshift(rec);
  if(a.length>200)a=a.slice(0,200);
  return wpWrite(a)?a:null}

function wpDel(n){return wpWrite(wpLoad().filter(function(x){return x.n!==n}))}

function wpName(at){
   
  var a=null;
  try{a=addressAt(at)||addressAt(at,true)}catch(e){}
  if(a&&a.line)return a.line.replace(/^Nearest address\s*/i,'').slice(0,42);
  try{
    var e=nearestEdge(at);
    if(e&&e.e&&e.e.n)return e.e.n.slice(0,38)}catch(e2){}
  return at[1].toFixed(4)+', '+at[0].toFixed(4)}

function svAvailable(){
   
  try{var k='__apex_probe';localStorage.setItem(k,'1');localStorage.removeItem(k);
      return true}catch(e){return false}}

function svLoad(){
  if(!svAvailable())return [];
  try{var a=JSON.parse(localStorage.getItem(SVKEY)||'[]');
      return Array.isArray(a)?a:[]}catch(e){return []}}

function svWrite(a){
  if(!svAvailable())return false;
  try{localStorage.setItem(SVKEY,JSON.stringify(a));return true}catch(e){return false}}

function svAdd(rec){
  var a=svLoad();
   
  a=a.filter(function(x){return x.n!==rec.n});
  a.unshift(rec);
  if(a.length>40)a=a.slice(0,40);
  return svWrite(a)?a:null}

function svDel(name){
  var a=svLoad().filter(function(x){return x.n!==name});
  return svWrite(a)?a:null}

function svCurrent(name){
   
  if(!last||last[sel]===undefined||!last[sel])return null;
  var o=last[sel],isLoop=(o.na===o.nb&&LOOP_MI>0);
  if(!RFROM)return null;
  return {n:name,k:isLoop?'loop':'route',
          f:RFROM.slice(),t:(!isLoop&&RTO)?RTO.slice():null,
          mi:isLoop?LOOP_MI:null,
          m:machine,p:o.k||null,
          r:BUNDLE.region||null,b:BUNDLE.hash||null,
          lbl:DESTLBL||null,ts:Date.now()}}

function svName(){
   
  var o=last&&last[sel];
  if(!o)return 'Route';
  var d=new Date(),md=(d.getMonth()+1)+'/'+d.getDate();
  var isLoop=(o.na===o.nb&&LOOP_MI>0);
  return (isLoop?'Loop ':'')+o.s.mi.toFixed(1)+' mi'+
    (isLoop?'':' to '+(DESTLBL||'there'))+' · '+md}

function svOpen(rec){
  if(!rec)return;
  if(rec.r&&BUNDLE.region&&rec.r!==BUNDLE.region)
    return show('<b>'+rec.n+'</b> was saved in a different region ('+rec.r+
      '). Routes are only meaningful against the map they were planned on.','fail');
  if(!rec.f)return show('<b>'+rec.n+'</b> has no start point saved.','fail');
   
  var stale=(rec.b&&BUNDLE.hash&&rec.b!==BUNDLE.hash);
   
  if(rec.m&&MACHINE[rec.m]){
    machine=rec.m;
    var _mi=ORDER.indexOf(rec.m);if(_mi>=0)machIdx=_mi;
    setChip('c-machine',MACHINE[machine].ic,MACHINE[machine].lbl)}
  ME=rec.f.slice();if(mM)mM.setLngLat(ME);
  var note=stale?'<br><span class="sub">The map has been rebuilt since you saved '+
    'this — it has been routed again on the current data, so closures and '+
    'reroutes are up to date. The line may differ from the one you saved.</span>':'';
  if(rec.k==='loop'&&rec.mi){
    LOOP_MI=rec.mi;
    show('Rebuilding <b>'+rec.n+'</b>…'+note,'');
    setTimeout(function(){
      var a=nearestNode(ME);
      if(a<0)return show('<b>Nothing legal nearby</b> for that machine at the '+
        'saved start point.','fail');
      var out=buildLoops(a,rec.mi);
      if(!out.length)return show('<b>'+rec.n+'</b> will not rebuild — the legal '+
        'network within reach no longer connects back at '+rec.mi+' mi.','fail');
       
      RFROM=ME.slice();RTO=ME.slice();DESTLBL='the start';
      out.forEach(function(o){o.h+=' · '+o.s.mi.toFixed(1)+' mi';
        if(o.repeat>0.25)o.h+=' \u00b7 '+Math.round(o.repeat*100)+'% ridden twice'});
      presentRoutes(out);svPrefer(rec.p)},30);
    return}
  if(!rec.t)return show('<b>'+rec.n+'</b> has no destination saved.','fail');
  routeToPoint(rec.t,rec.lbl||'there');
  setTimeout(function(){svPrefer(rec.p);if(note)el('panel').innerHTML+=note},80)}

function svPrefer(k){
   
  if(!k||!last)return;
  for(var i=0;i<last.length;i++)if(last[i].k===k){
    sel=i;draw(last[i],true);rcSel();
    return}}

function buildSavedPanel(){
  var a=svLoad().filter(function(x){return !x.r||!BUNDLE.region||x.r===BUNDLE.region});
  var wp=wpLoad().filter(function(x){return !x.r||!BUNDLE.region||x.r===BUNDLE.region});
  if(!svAvailable())
    return show('<b>Saved routes are unavailable here.</b> This phone would not let '+
      'the app store anything \u2014 its storage may be full or blocked.','fail');
  if(!a.length&&!wp.length)
    return show('<b>Nothing saved yet.</b><br>Plan a route or a loop, pick the card you want to keep, then tap '+
      '<b>Save</b> under the route options. It is stored on this phone '+
      'only — nothing is sent anywhere — and reopening it routes again on the '+
      'current map, so closures stay up to date.','');
  var h='<div id="routes">';
  if(wp.length){
    h+='<div class="sub" style="margin:2px 0 6px">'+wp.length+' waypoint'+
       (wp.length===1?'':'s')+'</div>';
    wp.forEach(function(x,i){
      h+='<div class="rc" data-wp="'+i+'"><h5>'+ic('spot')+x.n+'</h5>'+
         '<div class="sub">'+x.p[1].toFixed(5)+', '+x.p[0].toFixed(5)+'</div>'+
         '<div class="sub"><button class="chip" data-wpgo="'+i+'">Go to</button> '+
         '<button class="chip" data-wpren="'+i+'">Rename</button> '+
         '<button class="chip" data-wpdel="'+i+'">Delete</button></div></div>'})}
  a.forEach(function(r,i){
    h+='<div class="rc" data-sv="'+i+'"><h5>'+r.n+'</h5>'+
       '<div class="sub">'+(r.k==='loop'?'loop · '+r.mi+' mi target':'point to point')+
       ' · '+((MACHINE[r.m]||{}).lbl||r.m||'')+'</div>'+
       '<div class="sub"><button class="chip" data-svopen="'+i+'">Open</button> '+
       '<button class="chip" data-svren="'+i+'">Rename</button> '+
       '<button class="chip" data-svdel="'+i+'">Delete</button></div></div>'});
  show(h+'</div>','');
  var bind=function(attr,fn){
    Array.prototype.forEach.call(document.querySelectorAll('['+attr+']'),function(b){
      b.addEventListener('click',function(e){
        if(e&&e.stopPropagation)e.stopPropagation();
        fn(a[+b.getAttribute(attr)])})})};
  var bindw=function(attr,fn){
    Array.prototype.forEach.call(document.querySelectorAll('['+attr+']'),function(b){
      b.addEventListener('click',function(e){
        if(e&&e.stopPropagation)e.stopPropagation();
        fn(wp[+b.getAttribute(attr)])})})};
  bindw('data-wpgo',function(x){
    logAct('act  go to waypoint '+x.n);
    map.easeTo({center:x.p,zoom:Math.max(map.getZoom(),14),duration:500});
    placeCard(x.p,'wpt',x.n)});
  bindw('data-wpdel',function(x){
    logAct('act  delete waypoint '+x.n);wpDel(x.n);wpDraw();buildSavedPanel()});
  bindw('data-wpren',function(x){
    var n=null;
    try{n=window.prompt?window.prompt('Name this waypoint',x.n):null}catch(e){n=null}
    if(!n)return;
    var all=wpLoad().map(function(y){return y.n===x.n?(y.n=n,y):y});
    wpWrite(all);wpDraw();buildSavedPanel()});
  bind('data-svopen',function(r){logAct('act  open saved '+r.n);svOpen(r)});
  bind('data-svdel',function(r){logAct('act  delete saved '+r.n);
    svDel(r.n);buildSavedPanel()});
  bind('data-svren',function(r){
    var n=null;
    try{n=window.prompt?window.prompt('Name this route',r.n):null}catch(e){n=null}
    if(!n)return;
    var all=svLoad().map(function(x){return x.n===r.n?(x.n=n,x):x});
    svWrite(all);buildSavedPanel()})}

var last=null,sel=null;
 
 
function routeAuto(auto){return (auto&&typeof auto==='object')?{k:auto.k||null,resume:!!auto.resume,rejoin:auto.rejoin||null}
  :{k:typeof auto==='string'?auto:null,resume:false,rejoin:null}}
function routeToPoint(dest,label,auto){
  logAct('route to '+(label||'?'));
   
  el('btn-home').disabled=true;
  if(auto)rideCard('Routing…','',routeAuto(auto).resume?'Routing to '+(label||'there')+'\u2026':'Re-routing\u2026');
  else show('Routing…','');
  setTimeout(function(){
    var _t0=performance.now();
    var a=nearestNode(ME),b=nearestNode(dest),out=[];
    var _tSnap=performance.now()-_t0;
    el('btn-home').disabled=false;
    if(a<0||b<0)return show('<b>Nothing legal nearby</b> for a '+
      MACHINE[machine].lbl+'. Every line within reach is off limits for that machine.','fail');
    var sa=snapMiles(ME,a),sb=snapMiles(dest,b);
     
    var _dbg={a:a,b:b,sa:sa,sb:sb,tSnap:Math.round(_tSnap),got:[]};
    try{window.__routeDbg=_dbg}catch(e){}
    var _crow=mi(ME,dest);
    PROFILES.forEach(function(p){var _tp=performance.now();var pa=route(a,b,p.f);
      _dbg.got.push(p.k+':'+(pa?pa.length:'null')+':'+Math.round(performance.now()-_tp)+'ms');
      if(!pa)return;
       
      var _len=0;for(var _q=0;_q<pa.length;_q++)_len+=pa[_q].L;
      _len/=1609.34;
      if(_len>Math.max(8, _crow*8+5)){
        _dbg.got[_dbg.got.length-1]+=':absurd('+Math.round(_len)+'mi)';return}
      out.push({h:p.h,k:p.k,s:summarise(pa),snap:sa+sb,na:a,nb:b})});
    try{window.__routeDbg=_dbg}catch(e){}
    if(!out.length)return show('<b>No legal route</b> for a '+
      MACHINE[machine].lbl+' between those two points. Try a wider machine, or move the pins nearer a trail.','fail');
    RFROM=ME.slice();RTO=dest.slice();DESTLBL=label||'there';
    presentRoutes(out,auto)},30)}

var DESTLBL='home',RFROM=null,RTO=null;
 
var RIDDEN_WARN=null;

 
function presentRoutes(out,auto){
   
  var seen={};out.forEach(function(o){var k=o.s.path.map(function(e){return e.i}).join(',');
    o.dup=seen[k]||false;seen[k]=true});
  last=out;sel=0;
   
  var ak=routeAuto(auto).k;
  if(ak)for(var q=0;q<out.length;q++)if(out[q].k===ak){sel=q;break}
  logAct('route '+out.length+' options, best '+out[0].s.mi.toFixed(1)+' mi');
  renderRoutes(out,auto);draw(out[sel],true)}

 
var LOOP_MI=15,LOOP_CHOICES=[6,10,15,20,30,40];

function nodeToward(from,bearingDeg,miles){
  var lat=NODES[from][1],lon=NODES[from][0],b=bearingDeg*Math.PI/180;
  var dLat=(miles/69.0)*Math.cos(b);
  var dLon=(miles/(69.0*Math.cos(lat*Math.PI/180)))*Math.sin(b);
  return nearestNode([lon+dLon,lat+dLat])}

 
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
   
  var seen={},rep=0,tot=0;
  legs.forEach(function(e){var L=e.L/1609.34;tot+=L;if(seen[e.i])rep+=L;seen[e.i]=1});
  return {path:legs,repeat:tot?rep/tot:1,mi:tot}}

 
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

 
var LOOP_SHAPES=[
  {h:'Loop · most trail',k:'ltrail',f:function(e){
      return e.L*(DESIG[e.c]?0.55:DIRT[e.c]?1.3:8)}},
  {h:'Loop · fastest',k:'lfast',f:function(e){return e.L/spd(e)}}
];
function buildLoops(startNode,targetMi){
  var out=[];
   
   
  var shapes=LOOP_SHAPES;
  shapes.forEach(function(sh){
    var best=null;
    for(var b=0;b<360;b+=90){
      var f=fitLoop(startNode,targetMi,sh.f,b);
      if(!f)continue;
       
      var score=f.err+f.L.repeat*0.9;
      if(!best||score<best.score){best={score:score,L:f.L}}}
    if(best)out.push({h:sh.h,k:sh.k,s:summarise(best.L.path),snap:0,
                      na:startNode,nb:startNode,repeat:best.L.repeat})});
  return out}
el('btn-home').addEventListener('click',function(){
  if(!HOME)return homeCard('<b>No home set.</b> ');    
  routeToPoint(HOME,'home')});
 
el('btn-ride').addEventListener('click',function(){
  if(rideMode||riding)return;
  logAct('act  ride (folded drawer)');
  showTab('ride');
  el('c-ride').click()});

 
function rcFit(){try{
  var R=el('routes'),b=el('railbody'),rl=el('rail'),row=el('rcrow'),sh=el('shell');
  if(!b||!rl||!b.getBoundingClientRect)return;
  var t0=parseFloat(b.style.getPropertyValue('--rc-trim'))||0,tn=0;
   
  if(!R){if(t0)b.style.removeProperty('--rc-trim');return}
  if(b.getAnimations&&b.getAnimations().some(function(a){return a.playState==='running'}))return;
  if(/\bfolded\b/.test(rl.className))return;           
  var riding=!!(sh&&sh.dataset&&sh.dataset.ride),mo=el('rc-more');
   
  var sT=R.scrollTop||0,sL=R.scrollLeft||0;
  if(mo&&!mo.hidden){mo.hidden=true;mo.innerHTML='';mo.dataset.n='0'}
  for(var pass=0;pass<3&&R.getBoundingClientRect;pass++){
    R.style.maxHeight='';if(row)row.style.marginTop='';tn=0;
    var cs=getComputedStyle(b),mh=parseFloat(cs.maxHeight),nb=0;
    if(isFinite(mh)&&mh>0){
      if(!riding)mh+=t0;              
      var br=b.getBoundingClientRect(),rr=R.getBoundingClientRect();
      var top=rr.top-br.top+b.scrollTop;
       
      var rm=row?(parseFloat(getComputedStyle(row).marginTop)||0):0,rowH=row?row.offsetHeight+rm:0;
      var room=mh-top-rowH,foot=Infinity;
      if(rr.height>room+0.5){
        foot=room;
         
        var kids=R.querySelectorAll('.rc > *'),line=room,moved=true,it=0;
        while(moved&&it++<40){moved=false;
          for(var i=0;i<kids.length;i++){var k=kids[i].getBoundingClientRect();if(k.height<=0)continue;
            var kt=k.top-rr.top+R.scrollTop,kb=kt+k.height;
            if(kt<line-0.5&&kb>line+0.5){line=kt;moved=true}}}
         
        var c0=R.querySelector('.rc.sel')||R.querySelector('.rc'),k2=c0&&c0.children[1],
            need=k2?k2.getBoundingClientRect().bottom-rr.top+R.scrollTop:1;
        if(line>0&&line>=need-0.5){R.style.maxHeight=line+'px';foot=line;
          var g=Math.ceil(room-line);
          if(riding){if(row)row.style.marginTop=(rm+g)+'px'}else tn=g}}
      var ws=R.querySelectorAll('.rc.sel .warn');
      for(var w=0;w<ws.length;w++){var wr=ws[w].getBoundingClientRect();
        if(wr.height>0&&wr.bottom-rr.top+R.scrollTop>foot+0.5)nb++}}
    if(!mo)break;
    if(mo.hidden===!nb&&(mo.dataset.n||'0')===String(nb))break;
    mo.innerHTML=nb?ic('warn')+nb+' more warning'+(nb>1?'s':'')+' below \u2014 scroll the card':'';
    mo.dataset.n=String(nb);mo.hidden=!nb}
  if(R.getBoundingClientRect){if(R.scrollTop!==sT)R.scrollTop=sT;if(R.scrollLeft!==sL)R.scrollLeft=sL}
  if(tn!==t0){if(tn>0)b.style.setProperty('--rc-trim',tn+'px');else b.style.removeProperty('--rc-trim')}
  }catch(e){}}
try{el('rail').addEventListener('transitionend',rcFit)}catch(e){}
try{window.addEventListener('resize',rcFit)}catch(e){}
 
function rcSel(){
  Array.prototype.forEach.call(document.querySelectorAll('.rc'),function(d){
    d.className='rc'+(+d.dataset.i===sel?' sel':'')});
  rcFit()}
function renderRoutes(out,auto){
  var fuel=FUELS[fi],now=new Date(),
      ss=sunset(ME[1],ME[0],now),nowH=now.getHours()+now.getMinutes()/60;
  var html='<div id="routes">',warn=[];
  out.forEach(function(o,i){
    var s=o.s,mins=Math.round(s.hrs*60),
        arrive=nowH+s.hrs,dark=(ss!==null&&arrive>ss),
        overFuel=(fuel&&s.mi>fuel);
    warn[i]={fuel:overFuel?s.mi-fuel:0,dark:dark,
             adv:s.adv>0.05?s.adv:0,snap:o.snap>0.15?o.snap:0};
    html+='<div class="rc'+(i===sel?' sel':'')+'" data-i="'+i+'">'+
      '<h5>'+o.h+(o.dup?' ·<span class="sub"> same line</span>':'')+'</h5>'+
      '<div class="big">'+s.mi.toFixed(1)+' <span class="sub">mi</span></div>'+
      '<div class="sub">~'+etaTxt(s.hrs*60)+
        ' · '+s.off.toFixed(1)+' mi off-pavement</div>'+
       
      (o.note?'<div class="sub">'+o.note+'</div>':'')+
       
      (overFuel?'<div class="sub warn">'+ic('fuel')+(s.mi-fuel).toFixed(1)+' mi past your range</div>':'')+
      (dark?'<div class="sub warn">'+ic('dark')+'arrives after dark</div>':'')+
      (s.adv>0.05?'<div class="sub warn">'+s.adv.toFixed(1)+' mi unverified (OSM)</div>':'')+
      (o.snap>0.15?'<div class="sub warn">+'+o.snap.toFixed(1)+
        ' mi off-network (dashed) to reach the trail</div>':'')+
       
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
      spark(s.prof,s.up,s.dn)+
      '<div class="sub">climb <b>'+ft(s.up)+' ft</b> · drop '+ft(s.dn)+' ft</div>'+
      ((!overFuel&&fuel)?'<div class="sub good">'+ic('fuel')+'within range</div>':'')+
      (s.adv>0.05?'':'<div class="sub good">fully on designated line</div>')+
      '</div>'});
  html+='</div>';
   
   
   
  html+='<div class="sub" id="rcrow"><div id="rc-more" class="warn" hidden></div>'+
    ((!rideMode&&!riding)?'<button class="chip primary" id="rc-ride">'+ic('ride')+'<span>Ride it</span></button> ':'')+
    '<button class="chip" id="btn-save">'+ic('saved')+'<span>Save</span></button> '+
    '<button class="chip" id="btn-clear">'+ic('close')+'<span>Clear route</span></button></div>';
   
   
  var w0=RIDDEN_WARN;RIDDEN_WARN=warn[sel]||null;
  if(auto){
    var w=warn[sel]||{},bits=[],ra=routeAuto(auto);
    if(w.fuel)bits.push(w.fuel.toFixed(1)+' mi past your range');
    if(w.dark)bits.push('arrives after dark');
    if(w.adv)bits.push(w.adv.toFixed(1)+' mi unverified (OSM)');
     
    if(w.snap)bits.push(ra.rejoin?w.snap.toFixed(1)+' mi of it off-network':'+'+w.snap.toFixed(1)+' mi off-network');
     
    if(!rideMode&&!riding){
      logAct('route cards held: the ride they were for is not running');return}
    if((w.fuel&&!(w0&&w0.fuel))||(w.dark&&!(w0&&w0.dark)))show(html,'');
    else rideCard(html,'',ra.resume
      ?(rideWaiting()?GPS_WAIT:'Trip resumed')+' \u00b7 route to '+(DESTLBL||'there')+(bits.length?' \u00b7 '+bits.join(' \u00b7 '):' is on the map')
       
      :ra.rejoin?'Back to the loop \u00b7 '+navFmt(ra.rejoin.leg*1609.34)+' to it, '+ra.rejoin.rest.toFixed(1)+' mi of it left'+
        (bits.length?' \u00b7 '+bits.join(' \u00b7 '):'')
      :'Re-routed \u00b7 '+(bits.length?bits.join(' \u00b7 '):'the new route is on the map'))}
  else show(html,'');
   
  rcFit();
  var rr=el('rc-ride');
  if(rr)rr.addEventListener('click',function(){
     
    if(rideMode||riding)return;
    if(last&&sel!==null&&!routeFits(last[sel]))return routeUnfitCard();
    logAct('act  ride it (route card)');
    RAIL_MANUAL=false;railSet(false);showTab('ride');
    el('c-ride').click()});
  var cb2=el('btn-clear');
  if(cb2)cb2.addEventListener('click',function(){
    logAct('act  cleared route');
    clearRoute();last=null;sel=null;
    ack('Route cleared.')});
  var sb=el('btn-save');
  if(sb)sb.addEventListener('click',function(){
    var rec=svCurrent(svName());
    if(!rec)return show('Nothing to save yet.','fail');
    if(!svAdd(rec))return show('<b>Could not save.</b> This phone would not let '+
      'the app store it \u2014 its storage may be full or blocked.','fail');
    logAct('act  saved route '+rec.n);
    show('Saved as <b>'+rec.n+'</b>.<br><span class="sub">Kept on this phone only. '+
      'Reopening it routes again on the current map, so closures and reroutes '+
      'stay up to date \u2014 the line may differ from today\u2019s.</span>','pass')});
  Array.prototype.forEach.call(document.querySelectorAll('.rc'),function(c){
    c.addEventListener('click',function(){
      sel=+c.dataset.i;logAct('act  picked '+((last[sel]||{}).h||sel));
       
      rcSel();
      RIDDEN_WARN=warn[sel]||null;
      draw(last[sel],false);
      try{c.scrollIntoView({behavior:'smooth',block:'nearest',inline:'nearest'})}
      catch(e){}})}) }


 
 
function spark(p,up,dn){
  if(!p||p.length<3)return '';
  var lo=Math.min.apply(null,p),hi=Math.max.apply(null,p),r=Math.max(1,hi-lo);
  var W=250,H=44,step=Math.max(1,Math.floor(p.length/W)),pts=[],n=0,tot=Math.ceil(p.length/step);
  for(var i=0;i<p.length;i+=step,n++){
    pts.push((n*W/tot).toFixed(1)+','+(H-2-((p[i]-lo)/r)*(H-8)).toFixed(1))}

  return '<div class="prof">'+
    '<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" '+
      'style="display:block;width:100%;height:44px">'+
      '<polygon points="0,'+H+' '+pts.join(' ')+' '+W+','+H+'" style="fill:var(--ok-tint)"/>'+
      '<polyline points="'+pts.join(' ')+'" fill="none" style="stroke:var(--ok)" '+
        'stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>'+
    '<div class="profax"><span>'+ft(lo)+' ft</span>'+
      '<span>'+ft(hi)+' ft</span></div></div>'}

function label(c){return {route72:'ORV route 72"',trail50:'ORV trail 50"',
  moto24:'motorcycle 24"',mccct:'MCCCT',fstrail:'USFS trail',fsroad:'USFS road',
  paved:'pavement',minor:'county road',track:'two-track'}[c]||c}

function geomOf(o){return o.s.path.map(function(e){return {type:'Feature',properties:{},
  geometry:{type:'LineString',coordinates:decode(GR.g[e.i])}}})}

 
function draw(o,fit){
  var fs=geomOf(o);
   
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
   
  var others=[];
  (last||[]).forEach(function(x){if(x!==o)others=others.concat(geomOf(x))});
  map.getSource('alt').setData({type:'FeatureCollection',features:others});
  if(!fit)return;
  var b=new maplibregl.LngLatBounds();
  fs.concat(legs).forEach(function(f){
    f.geometry.coordinates.forEach(function(c){b.extend(c)})});
   
  var strip=0;
  try{var r=el('rail-chips')||document.querySelector('.strip');
    if(r)strip=Math.round(r.getBoundingClientRect().height)}catch(e){}
  map.fitBounds(b,{padding:{top:64,bottom:40+strip,left:36,right:36},duration:800})}
 
function routeFits(o){
  if(!o||!o.s||!o.s.path)return true;
  for(var i=0;i<o.s.path.length;i++)if(!machineLegal(o.s.path[i]))return false;
  return true}
function routeUnfitCard(){
  logAct('ride refused: the route is not legal for '+machine);
  show('<b>This route is not legal for a '+MACHINE[machine].lbl+'.</b> It was planned '+
    'for another machine. Nothing started \u2014 plan it again for this one.','fail')}
function clearRoute(){NAVG=null;map.getSource('route').setData({type:'FeatureCollection',features:[]});
  try{map.getSource('alt').setData({type:'FeatureCollection',features:[]});
      map.getSource('approach').setData({type:'FeatureCollection',features:[]})}catch(e){}
  last=null;sel=null}






 
var IDX=null;
function buildIndex(){
  if(IDX)return IDX;
  var seen={},rows=[];
  for(var i=0;i<EDGES.length;i++){var e=EDGES[i];
    [[e.n,'trail'],[e.id,'number']].forEach(function(p){
      var s=p[0];if(!s||seen[s])return;seen[s]=1;
      var g=decode(GR.g[i]),m=g[(g.length/2)|0];
      rows.push({t:s,k:(e.c==='paved'||e.c==='minor'||e.c==='fsroad')?'road':p[1],c:m,cls:e.c})})}
  for(var k in JX){var lab=JX[k].map(function(x){return NM[x]}).join(' × ');
    if(seen[lab])continue;seen[lab]=1;
    rows.push({t:lab,k:'junction',c:[NODES[k][0],NODES[k][1]],cls:'jx'})}
  PLACES.forEach(function(p){if(seen[p[0]])return;seen[p[0]]=1;
    rows.push({t:p[0],k:'place',c:[p[1],p[2]],cls:'place'})});
   
  ((PADDLE&&PADDLE.c)||[]).forEach(function(c){
    if(seen[c.n])return;seen[c.n]=1;
    var g0=c.g&&c.g[0],m=g0&&g0[(g0.length/2)|0];
    if(!m)return;
    rows.push({t:c.n,k:'river',c:m,cls:'river',riv:c.n})});
  if(ADDR&&ADDR.names){
     
    var first={};
    ADDR.segs.forEach(function(g){if(first[g[0]]===undefined)first[g[0]]=g});
    ADDR.names.forEach(function(nm,i){
      if(seen[nm]||first[i]===undefined)return;seen[nm]=1;var g=first[i];
      rows.push({t:nm,k:'street',c:[(g[1]+g[3])/2,(g[2]+g[4])/2],cls:'addr'})})}
  rows.forEach(function(r){r.l=r.t.toLowerCase();
     
    r.z=r.l.replace(/[^a-z0-9]/g,'')});
  IDX=rows;return rows}

var KRANK={address:0,place:1,river:1.5,trail:2,number:3,road:4,street:5,junction:6};
function search(q){
  q=q.trim().toLowerCase();if(q.length<1)return [];
  var rows=buildIndex(),out=[];
   
  var gc=geocode(q);
  if(gc)out.push([-1,-1,0,{t:gc.t,k:'address',c:gc.c,cls:'addr'}]);
  var qz=q.replace(/[^a-z0-9]/g,'');
  for(var i=0;i<rows.length;i++){var r=rows[i],p=r.l.indexOf(q);
    if(p>=0){
       
      var s=r.l===q?0:p===0?1:(r.l[p-1]===' '||r.l[p-1]==='(')?2:3;
      out.push([s,(KRANK[r.k]||5),r.t.length,r]);continue}
     
    if(qz.length>=3&&r.z.indexOf(qz)>=0)out.push([4,(KRANK[r.k]||5),r.t.length,r])}
   
  if(!out.length&&qz.length>=4){
    for(var i2=0;i2<rows.length;i2++){var r2=rows[i2];
      if(near1(qz,r2.z))out.push([5,(KRANK[r2.k]||5),r2.t.length,r2])}}
  out.sort(function(a,b){return a[0]-b[0]||a[1]-b[1]||a[2]-b[2]});
  return out.slice(0,9).map(function(x){return x[3]})}

 
function near1(needle,hay){
  var n=needle.length;
  for(var st=0;st<=Math.max(0,hay.length-n+1);st++){
    var i=0,j=st,miss=0,end=Math.min(hay.length,st+n+1);
    while(i<n&&j<end){
      if(needle[i]===hay[j]){i++;j++;continue}
      if(miss++)break;
      if(needle[i+1]===hay[j]){i++;continue}
      if(needle[i]===hay[j+1]){j++;continue}
      i++;j++}
    if(i>=n&&miss<=1)return true}
  return false}

function renderHits(list){
  if(!list.length){el('hits').innerHTML=
    '<div class="hit">No match. Try a code like <b>TMM</b> or <b>H58</b>.</div>';return}
  el('hits').innerHTML=list.map(function(r,i){
    return '<div class="hit" data-i="'+i+'"><b>'+r.t+'</b><i>'+r.k+'</i></div>'}).join('');
  Array.prototype.forEach.call(document.querySelectorAll('.hit'),function(d){
    if(d.dataset.i===undefined)return;
    d.addEventListener('click',function(){
      var r=list[+d.dataset.i];if(!r)return;
      el('srch').className='';el('c-search').className='chip';
      if(r.k==='river'){
         
        var c=null;for(var ci=0;ci<((PADDLE&&PADDLE.c)||[]).length;ci++)
          if(PADDLE.c[ci].n===r.riv){c=PADDLE.c[ci];break}
        if(c){var xs=[],ys=[];
          c.g.forEach(function(gr){gr.forEach(function(pt){xs.push(pt[0]);ys.push(pt[1])})});
          try{map.fitBounds([[Math.min.apply(null,xs),Math.min.apply(null,ys)],
            [Math.max.apply(null,xs),Math.max.apply(null,ys)]],{padding:40,duration:900})}catch(e){}
          var stops=c.f.filter(function(f){return f.k==='launch'||f.k==='access'});
          var dams=c.f.filter(function(f){return f.k==='dam'});
          logAct('act  river '+c.n);
          show('<div class="tn">'+c.n+'</div>'+
            '<b>'+c.mi+' mi</b> mapped · '+stops.length+' access point'+
            (stops.length===1?'':'s')+
            (dams.length?' · <b style="color:var(--danger-text)">'+dams.length+' dam'+
              (dams.length>1?'s':'')+' — portages</b>':'')+
            '<br><span class="sub">Tap a stop on the river to plan a run — '+
            'in Water mode a launch pin works too.</span>','');
        }
        return}
       
      if(arm==='homeaddr'){
        HOME=r.c.slice();homeSave();homeMark();arm=null;syncArm();clearRoute();syncSafety();
        map.easeTo({center:r.c,zoom:13.2,duration:800});
        logAct('act  home from address');
        return show('<b>Home set</b> at '+r.t+'. Press and hold where you want to go and tap '+
          '<b>Route here</b>; <b>Return home</b> routes back from wherever you are.','')}
      map.easeTo({center:r.c,zoom:r.k==='place'?13.2:14.6,duration:800});
       
      dropPin(r.c.slice());
      placeCard(r.c,'drop',r.t)})})}

el('c-search').addEventListener('click',function(){
  var on=el('srch').className.indexOf('on')<0;
  el('srch').className=on?'on':'';el('c-search').className='chip'+(on?' on':'');
  if(on){el('q').focus();
    var q0=el('q').value||'';
    if(q0){renderHits(search(q0))}
    else{show(jumpChipsHTML(),'');wireJumpChips(el('panel'))}}});
el('q').addEventListener('input',function(){
  var q=el('q').value;
  if(!q){show(jumpChipsHTML(),'');wireJumpChips(el('panel'));return}
  renderHits(search(q))});

 
function turnWord(d){
  var a=((d+540)%360)-180,x=Math.abs(a);
  if(x<22)return ['Continue','straight'];
  if(x<50)return [a<0?'Bear left':'Bear right',a<0?'bearleft':'bearright'];
  if(x<115)return [a<0?'Turn left':'Turn right',a<0?'left':'right'];
  if(x<160)return [a<0?'Sharp left':'Sharp right',a<0?'sharpleft':'sharpright'];
  return ['Turn around','uturn']}

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
    steps[i].turn=i===0?['Start on','start']:turnWord(steps[i].inB-steps[i-1].out)}
  return steps}

el('btn-steps').addEventListener('click',function(){
  if(!last||sel===null)return show('Plan a route first \u2014 <b>Route here</b> or <b>Return home</b>. <b>Turns</b> lists the route you chose.','fail');
  var a=nearestNode(ME),steps=directions(last[sel].s.path,a);
  if(!steps.length)return show('No steps.','fail');
  var tot=0,html='<div id="steps">';
   
  steps.forEach(function(s){
    var at=tot;tot+=s.mi;
     
    var named=s.name&&!/^(two-track|forest road|road|paved|trail)$/i.test(s.name);
    var nm=named?(s.name+(s.id&&s.id!==s.name?' \u00b7 '+s.id:''))
                :('unnamed '+(s.name||'track')+(s.id?' \u00b7 '+s.id:''));
    html+='<div class="st"><div class="ar">'+ic(s.turn[1])+'</div><div class="tx">'+
      s.turn[0]+' '+(named?'<b>'+nm+'</b>':'<i class="unn">'+nm+'</i>')+
      (MACHINE[machine].ok.indexOf(s.cls)<0?' <span class="tag shut">illegal</span>':'')+
      (s.up>8?'<br><span style="color:var(--warn)">climbs '+ft(s.up)+' ft</span>':'')+
      '</div><div class="d">'+(s.mi<0.1?(s.mi*5280|0)+' ft':s.mi.toFixed(1)+' mi')+
      (at>0.05?'<div class="at">at '+at.toFixed(1)+' mi</div>':'')+
      '</div></div>'});
  html+='</div>';
  show('<span class="tn">'+steps.length+' steps · '+tot.toFixed(1)+
    ' mi</span><span class="meta">'+last[sel].h+'</span>'+html,'')})

 
 
 
 
var LEGEND_EXEMPT=['minor','paved'];

var ACTS=[
  {k:'all',  h:'All routes',        sw:PAL.trail50},
  {k:'orv',  h:'ORV / dirt bike',   sw:PAL.trail50, cls:['route72','trail50','moto24','mccct','fstrail']},
  {k:'_t1',  h:'  easy · 72" route',      sw:PAL.route72, tier:1},
  {k:'_t2',  h:'  moderate · 50" trail',  sw:PAL.trail50, tier:1},
  {k:'_t3',  h:'  difficult · 24" / MCCCT',sw:PAL.mccct,  tier:1},
  {k:'ride', h:'Everything ridable', sw:PAL.trail50,
     cls:['route72','trail50','moto24','mccct','fstrail','track','bike']},
  {k:'dirt', h:'Two-track',         sw:PAL.track,  cls:['track']},
  {k:'_fr',  h:'  forest road · drivable', sw:PAL.fsroad, tier:1},
  {k:'_cl',  h:'  closed · do not ride',   sw:PAL.closed, tier:1},
  {k:'foot', h:'Hiking',            sw:PAL.foot,   cls:['foot','path'], dash:1},
  {k:'horse',h:'Equestrian',        sw:PAL.horse,  cls:['horse'], dash:1},
  {k:'snow', h:'Snowmobile / ski',  sw:PAL.snow,   cls:['snow','snowmob'], dash:1},
  {k:'nfs',  h:'NFS trails',        sw:PAL.nfsmoto,cls:['nfsmoto'], dash:1},
   
  {k:'none', h:'No trails',         sw:PAL.showother, cls:[]}
];
 
var MACH_DIM=0.30;
var MACH_LAYERS=['casing','casing-track','casing-fsroad','minor','paved',
                 'fsroad','track','route72','fstrail','trail50','mccct','moto24'];
var OPA_BASE=null;

 
var HYB_OPA={minor:[11.5,0,12.5,0.45],paved:0.35,track:0.55};
var DIM_FLOOR={Map:0.165,Hybrid:0.25};
 
var HYB_FLOOR={track:0.165};
function netDim(b,fl){return b>0?Math.max(b*MACH_DIM,Math.min(b,fl)):0}
function netOpacity(){
  if(!map||!map.getLayer)return;
   
  if(!OPA_BASE){
    OPA_BASE={};
    MACH_LAYERS.forEach(function(id){
      if(!map.getLayer(id))return;
      var v=map.getPaintProperty(id,'line-opacity');
      OPA_BASE[id]=(typeof v==='number')?v:1})}
  var ok=(MACHINE[machine]||{}).ok||[],inOk=['in',['get','c'],['literal',ok]];
  var bm=BASEMAPS[bmi]||'Map',fl0=DIM_FLOOR[bm]||DIM_FLOOR.Map;
  MACH_LAYERS.forEach(function(id){
    if(!map.getLayer(id))return;
    var b=(bm==='Hybrid'&&HYB_OPA[id]!==undefined)?HYB_OPA[id]:OPA_BASE[id],
        fl=(bm==='Hybrid'&&HYB_FLOOR[id]!==undefined)?HYB_FLOOR[id]:fl0;
    if(b===undefined)b=1;
    var v=(typeof b==='number')?['case',inOk,b,netDim(b,fl)]
      :['interpolate',['linear'],['zoom'],
         b[0],['case',inOk,b[1],netDim(b[1],fl)],
         b[2],['case',inOk,b[3],netDim(b[3],fl)]];
    map.setPaintProperty(id,'line-opacity',v)})}

function applyMachine(){_legalMemo={};
  if(!map||!map.getLayer)return;
  netOpacity();
  var lg=el('machnote');
  if(lg)lg.textContent=MACHINE[machine].lbl+
    ' — faded line is legal ORV trail your machine is too wide for';}

function machineIllegal(){
   
  var ok=(MACHINE[machine]||{}).ok||[];
  return ['route72','trail50','fstrail','mccct','moto24','track','fsroad']
    .filter(function(c){return ok.indexOf(c)<0})}

var TRAIL_LAYERS=['route72','trail50','moto24','mccct','fstrail','foot'];
var act='all';

function actLabel(){
  var a=ACTS.filter(function(x){return x.k===act})[0];
  setChip('c-act','activity',a.h);
  el('c-act').className='basebtn actbtn'+(act==='all'?'':' on')}

function applyAct(){
   
  var a=ACTS.filter(function(x){return x.k===act})[0],sel=a.cls||null;
  TRAIL_LAYERS.forEach(function(id){
    map.setLayoutProperty(id,'visibility',
      (!sel||sel.indexOf(id)>=0)?'visible':'none')});
  map.setLayoutProperty('track','visibility',
    (!sel||sel.indexOf('track')>=0)?'visible':'none');
  var showCls=(a.cls||[]).filter(function(c){
    return ['horse','snow','snowmob','nfsmoto','bike','path'].indexOf(c)>=0});
  if(!sel){map.setFilter('show-line',null);map.setFilter('lbl-show',null);
    map.setLayoutProperty('show-line','visibility','visible');
    map.setLayoutProperty('lbl-show','visibility','visible')}
  else if(showCls.length){
    var f=['in',['get','c'],['literal',showCls]];
    map.setFilter('show-line',f);map.setFilter('lbl-show',f);
    map.setLayoutProperty('show-line','visibility','visible');
    map.setLayoutProperty('lbl-show','visibility','visible')}
  else{map.setLayoutProperty('show-line','visibility','none');
    map.setLayoutProperty('lbl-show','visibility','none')}
  netVis();
  actLabel()}

 
function netVis(){
  if(!map||!map.getLayer)return;
  var onMap=(BASEMAPS[bmi]||'Map')==='Map',cc=styleFacts().casing;
  function vis(id){try{return map.getLayoutProperty(id,'visibility')!=='none'}catch(e){return false}}
  function put(id,on){try{if(map.getLayer(id)&&vis(id)!==on)
    map.setLayoutProperty(id,'visibility',on?'visible':'none')}catch(e){}}
  put('casing',!cc.length||cc.every(vis));
  put('casing-track',onMap&&vis('track'));
  ['casing-fsroad','minor-case','paved-case'].forEach(function(id){put(id,onMap)})}

function buildActPanel(){
  var p=el('actpanel');
  p.innerHTML=ACTS.map(function(a){
     
    var tag=a.tier?'div':'button';
    return '<'+tag+' class="actrow'+(a.tier?' tierrow':'')+
      (!a.tier&&a.k===act?' on':'')+'"'+(a.tier?'':' data-k="'+a.k+'"')+'>'+
      '<span class="sw'+(a.dash?' dash':'')+'" style="'+
        (a.dash?'color:'+a.sw+';background-color:transparent':'background-color:'+a.sw)+'"></span>'+
      '<span>'+a.h+'</span></'+tag+'>'}).join('');
  Array.prototype.forEach.call(p.querySelectorAll('.actrow'),function(b){
    if(!b.dataset||!b.dataset.k)return;
    b.addEventListener('click',function(){
      act=b.dataset.k;applyAct();buildActPanel();p.hidden=true;
      logAct('tap','activity '+act)})})}

 
 
var MODES=[
   
   
  {k:'ride',     h:'Off-road', ic:'offroad', s:'ORV, dirt bike, side-by-side, MTB — trails, riding areas, fuel', act:'ride',
   kinds:['trailhead','camp','fuel','dayuse','view','info','water','toilet','shelter','store','food','mtb'],
   off:['store','food'], z:{store:13,food:13,info:13},
   groups:{areas:true,peaks:false,contour:false,relief:false,paddle:false,places:true,county:false,public:false,forest:false},
   basemap:'Map', zoom:9},
   
  {k:'outdoors', h:'Outdoors', ic:'outdoors', s:'Hike, fish, explore — on foot, with trail systems, hills and rivers', act:'foot', machine:'walk',
   kinds:['trailhead','camp','shelter','water','toilet','view','launch','beach','dayuse','info','system','mtb','ski','lighthouse','livery'],
   z:{camp:13},
   peaksFrom:9,
    
   groups:{areas:false,peaks:true,contour:true,relief:false,paddle:true,places:true,county:false,public:false,forest:false},
   basemap:'Map', zoom:11},
   
  {k:'hunt',     h:'Hunt', ic:'hunt',     s:'Public land, game areas, counties, stands and cameras — on foot', act:'foot', machine:'walk',
   kinds:['trailhead','camp','water','toilet','info','system','shelter'],
   peaksFrom:9,
   groups:{areas:false,peaks:true,contour:true,relief:false,paddle:false,places:true,county:true,public:true,forest:false},
   basemap:'Map', zoom:11},
  {k:'water',    h:'Water', ic:'water',    s:'Beach, kayak, tube, boat — launches and rivers, no trail lines', act:'none', machine:'kayak',
    
   kinds:['livery','launch','beach','camp','dayuse','info','toilet','lighthouse','marina'],
   z:{launch:9,beach:9,lighthouse:9},
   groups:{areas:false,peaks:false,contour:false,relief:false,paddle:true,places:true,county:false,public:false,forest:false},
   basemap:'Hybrid', zoom:10},
   
  {k:'camp',     h:'Camp', ic:'camp',     s:'Campgrounds by type, national and state forest, supplies', act:'ride',
   kinds:['camp','dayuse','shelter','trailhead','launch','beach','water','toilet','store','food','info'],
   off:['store','food'], z:{camp:9,info:13,launch:13,beach:13,store:13,food:13},
   groups:{areas:false,peaks:false,contour:false,relief:false,paddle:false,places:true,county:false,public:true,forest:true},
   basemap:'Map', zoom:10}
];
 
var mode='ride', POI_BASE={}, POI_MODEF={}, STACKED={};
function modeOf(k){return MODES.filter(function(m){return m.k===k})[0]||MODES[0]}
 
var PINS={};
function pinsKey(k){return 'apex.pins.'+k+'.v1'}
function pinsLoad(k){
  if(PINS[k])return PINS[k];
  var o={};
  try{if(svAvailable()){var v=JSON.parse(localStorage.getItem(pinsKey(k))||'{}');
    if(v&&typeof v==='object')for(var x in v)if(POIKIND[x]&&typeof v[x]==='boolean')o[x]=v[x]}}catch(e){o={}}
  PINS[k]=o;return o}
function pinsSave(k){try{var o=PINS[k]||{};
  if(Object.keys(o).length)localStorage.setItem(pinsKey(k),JSON.stringify(o));
  else localStorage.removeItem(pinsKey(k))}catch(e){}}
function pinsDefault(m,k){return (m.kinds||[]).indexOf(k)>=0&&(m.off||[]).indexOf(k)<0}
function pinsOn(m,k){var o=pinsLoad(m.k);return (k in o)?o[k]:pinsDefault(m,k)}
function pinsEff(m){return (m.kinds||[]).filter(function(k){return pinsOn(m,k)})}
function pinsSet(mk,k,on){var m=modeOf(mk),o=pinsLoad(mk);
  if(on===pinsDefault(m,k))delete o[k];else o[k]=!!on;
  pinsSave(mk);logAct('act  pins '+mk+' '+k+' '+(on?'on':'off'));
  if(mk===mode)repin()}
function pinsReset(mk){PINS[mk]={};pinsSave(mk);logAct('act  pins '+mk+' reset');if(mk===mode)repin()}
function modeNow(){var m=modeOf(mode),n={};for(var f in m)n[f]=m[f];n.kinds=pinsEff(m);return n}
 
function repin(){
  var m=modeNow();
  ['poi-dot','poi-dot-major'].forEach(function(id){
    try{
      if(!POI_BASE[id]&&!Object.keys(STACKED).length)POI_BASE[id]=map.getFilter(id)||true;
       
      POI_MODEF[id]=modeFilter(POI_BASE[id]||true,m,id);
      map.setFilter(id,POI_MODEF[id]);
    }catch(e){}});
   
  STACKED={};STACKSIG='';STACKWIN=null;setTimeout(function(){try{restack()}catch(e){}},60)}
 
function modeFilter(base,m,id){
  var inK=['in',['get','k'],['literal',m.kinds]];
   
  var zt=m.z||{},zk=(m.kinds||[]).filter(function(k){return zt[k]!=null}),zStep=null;
  if(zk.length){
    var stops=[];zk.forEach(function(k){if(zt[k]>9&&stops.indexOf(zt[k])<0)stops.push(zt[k])});
    stops.sort(function(a,b){return a-b});
    var upTo=function(s){return ['in',['get','k'],['literal',zk.filter(function(k){return zt[k]<=s})]]};
     
    if(stops.length){zStep=['step',['zoom'],upTo(9)];
      stops.forEach(function(st){zStep.push(st);zStep.push(upTo(st))})}
    else zStep=upTo(9)}
  var dTest=(id==='poi-dot-major')?['==',['get','d'],1]:['!=',['get','d'],1];
   
  var unZ=(m.k==='water')?12:13.5;
  inK=['all',inK,['any',['==',['get','named'],1],
    ['!',['in',['get','k'],['literal',['launch','beach']]]],
    ['step',['zoom'],false,unZ,true]]];
  var wrap=function(br){
    if(!zStep)return ['all',inK,br];
    return ['all',inK,['any',['all',['in',['get','k'],['literal',zk]],dTest,zStep],
                             ['all',['!',['in',['get','k'],['literal',zk]]],br]]]};
  if(Array.isArray(base)&&base[0]==='step'){
    var out=['step',base[1],wrap(base[2])];
    for(var i=3;i<base.length;i+=2){out.push(base[i]);out.push(wrap(base[i+1]))}
    return out}
  var b=(base===true)?['literal',true]:base;
   
  return wrap(b)}

function applyMode(k,opts){
  opts=opts||{};var m=modeOf(k);mode=m.k;var _m0=machine;
  try{localStorage.setItem('apex.mode',mode)}catch(e){}
   
  if(ACTS.some(function(a){return a.k===m.act})){act=m.act;applyAct()}
   
  repin();
   
  try{
     
    var tgt=m.machine==='kayak'?waterCraft:m.machine;
    if(tgt){if(machine!==tgt){
        if(machine!=='walk'&&!(MACHINE[machine]&&MACHINE[machine].mph))rideMachine=machine;
        if(MACHINE[machine]&&MACHINE[machine].mph)waterCraft=machine;
        machine=tgt;_legalMemo={}}}
    else if(machine==='walk'||(MACHINE[machine]&&MACHINE[machine].mph)){
      if(MACHINE[machine]&&MACHINE[machine].mph)waterCraft=machine;
      machine=rideMachine||'bike';_legalMemo={}}
    machIdx=Math.max(0,ORDER.indexOf(machine));
    setChip('c-machine',MACHINE[machine].ic,MACHINE[machine].lbl);
    applyMachine();
     
    if(machine!==_m0&&last){
      logAct('route cleared: machine '+_m0+' -> '+machine);
      clearRoute();
      if(!opts.silent)ack('Route cleared \u2014 it was planned for '+
        (MACHINE[_m0]?MACHINE[_m0].lbl:_m0)+'. Plan it again for '+MACHINE[machine].lbl+'.')}
  }catch(e){}
   
   
  LYRGROUPS.forEach(function(g){if(g.k in m.groups)lyrSet(g,m.groups[g.k])});
   
  try{var pz=m.peaksFrom||10.6;map.setLayerZoomRange('peak-dot',pz,24);
      map.setLayerZoomRange('peak-label',Math.max(pz,9.6),24)}catch(e){}
   
  var bi=BASEMAPS.indexOf(m.basemap);
  if(bi>=0&&(bi===0||SAT_OK)&&bi!==bmi)setBasemap(bi);
  setChip('c-mode',m.ic,m.h);
  el('c-mode').className='basebtn modebtn'+(mode==='ride'?'':' on');
  if(!opts.silent)logAct('act  mode '+mode);
   
  try{if(!el('lyrpanel').hidden)buildLyrPanel()}catch(e){}
}

 
var BASEMAPS=['Map','Hybrid'],bmi=0;
 
var HYB_WATER='#172937',HYB_TXT='#F4F2EE',HYB_HALO='rgba(10,10,10,0.85)',HYB_HW=1.6,HYB_ROAD='#F1EBDD';
 
var HYB_KEEP=/^(poi-|pad-)|stack|^(lbl-shield|lbl-trail|lbl-trail-short|lbl-show|area-label)$/;
var MAPV=null,SFACTS=null;
 
function styleFacts(){
  if(SFACTS)return SFACTS;
  var ls=[];try{ls=map.getStyle().layers||[]}catch(e){}
  var f={lbl:[],water:[],casing:[],minorZ:[0,24],roadF:null},wc=null;
  ls.forEach(function(l){if(l.id==='water'&&l.paint)wc=JSON.stringify(l.paint['fill-color'])});
  ls.forEach(function(l){
    if(l.type==='symbol'&&l.layout&&l.layout['text-field']!==undefined&&!HYB_KEEP.test(l.id))
      f.lbl.push(l.id);
    if(l.type==='fill'&&wc&&l.paint&&JSON.stringify(l.paint['fill-color'])===wc)f.water.push(l.id);
    var cf=l.id==='casing'?netBaseF(l.filter):null;
    if(Array.isArray(cf)&&cf[0]==='in'&&
       Array.isArray(cf[2])&&Array.isArray(cf[2][1]))f.casing=cf[2][1].slice();
    if(l.id==='minor')f.minorZ=[l.minzoom||0,l.maxzoom===undefined?24:l.maxzoom];
    if(l.id==='lbl-road'&&l.filter)f.roadF=l.filter});
  if(ls.length)SFACTS=f;
  return f}
function hybTable(){
  var f=styleFacts(),t=[];
  f.water.forEach(function(id){t.push([id,'fill-color',HYB_WATER])});
  f.lbl.forEach(function(id){t.push([id,'text-color',HYB_TXT],[id,'text-halo-color',HYB_HALO],
    [id,'text-halo-width',HYB_HW])});
   
  t.push(['minor','line-color',HYB_ROAD],['paved','line-color',HYB_ROAD],
    ['minor','line-width',w(0.25,0.55,1.3)],['paved','line-width',w(0.6,1.3,3.0)]);
  return t}
function setBasemap(i){
  if(!SAT_OK){bmi=0;setChip('c-base','map','Map');
    map.setLayoutProperty('sat','visibility','none');
    try{map.setLayoutProperty('sat-patch','visibility','none');
        map.setLayoutProperty('sat-base','visibility','none')}catch(e){}
    return}
  bmi=i%BASEMAPS.length;
  var m=BASEMAPS[bmi],sat=(m!=='Map');
  BUSY.begin();
  map.setLayoutProperty('sat','visibility',sat?'visible':'none');
  try{map.setLayoutProperty('sat-patch','visibility',sat?'visible':'none');
      map.setLayoutProperty('sat-base','visibility',sat?'visible':'none')}catch(e){}
   
   
  var reliefOn=false;
  try{reliefOn=map.getLayoutProperty('hillshade','visibility')!=='none'}catch(e){}
  map.setLayoutProperty('hillshade','visibility',reliefOn?'visible':'none');
  if(reliefOn)map.setPaintProperty('hillshade','raster-opacity',sat?0.16:0.42);
  try{
    var T=hybTable(),F=styleFacts();
    if(sat&&!MAPV){MAPV={};
      T.forEach(function(r){MAPV[r[0]+'|'+r[1]]=map.getPaintProperty(r[0],r[1])})}
    if(sat){
      T.forEach(function(r){map.setPaintProperty(r[0],r[1],r[2])});
       
      map.setLayerZoomRange('minor',11.5,F.minorZ[1]);
       
      if(F.roadF)map.setFilter('lbl-road',
        ['step',['zoom'],['all',F.roadF,['!=',['get','c'],'minor']],11.5,F.roadF])}
    else if(MAPV){
      T.forEach(function(r){map.setPaintProperty(r[0],r[1],MAPV[r[0]+'|'+r[1]])});
      map.setLayerZoomRange('minor',F.minorZ[0],F.minorZ[1]);
      if(F.roadF)map.setFilter('lbl-road',F.roadF)}
  }catch(e){}
   
  if(NETLO_Z&&sat!==NETF_HYB){
    try{Object.keys(NETFT).forEach(function(id){
      if(map.getLayer(id))map.setFilter(id,sat?NETFT[id].h:NETFT[id].m)});
      NETF_HYB=sat}catch(e){}}
  netVis();netOpacity();
   
  setChip('c-base',sat?'hybrid':'map',m);
  el('c-base').className='basebtn'+(sat?' on':'');
}

 

 
 
if(TR&&GR&&TR.pf&&TR.pf.length!==GR.e.length){
  console.warn('terrain payload indexes '+TR.pf.length+' edges but the graph '+
    'has '+GR.e.length+' — stale terrain vs re-emitted graph; climb data '+
    'disabled for this session');
  TR={ne:null,up:null,dn:null,pf:null}}
var NE=TR.ne, UP=TR.up, DN=TR.dn;
function edgeProfile(i){var d=TR.pf&&TR.pf[i];if(!d)return [];
  var out=[],v=0;
  for(var k=0;k<d.length;k++){v+=d[k];out.push(v)}return out}
function ft(m){return Math.round(m*3.28084)}

 
var CLIMB_K=12;
 
function elevAt(ll){var r=elevNear(ll);return r?r.e:null}
function elevNear(ll){
  var G=gridBuild(),best=1e18,bi=-1;
  var visit=function(list){for(var j=0;j<list.length;j++){var i=list[j];
    var dx=NODES[i][0]-ll[0],dy=NODES[i][1]-ll[1],d=dx*dx*0.51+dy*dy;
    if(d<best){best=d;bi=i}}};
  visit.done=function(r){return bi>=0&&ringMi(r+1)>Math.sqrt(best)*69};
  gridRings(ll,G.nodes,visit,400);
  return bi>=0?{e:NE[bi],mi:mi(ll,NODES[bi])}:null}


 
 
function nearestPavement(ll){
  var G=gridBuild(),best=1e9,bp=null,be=null,seen={};
  var visit=function(list){
    for(var j=0;j<list.length;j++){var i=list[j];if(seen[i])continue;seen[i]=1;
      var e=EDGES[i];if(e.c!=='paved'&&e.c!=='minor')continue;
      var g=decode(GR.g[i]);
      for(var k=0;k<g.length;k++){var d=mi(ll,g[k]);if(d<best){best=d;bp=g[k];be=e}}}};
  visit.done=function(r){return be!==null&&ringMi(r+1)>best};
  gridRings(ll,G.edges,visit,400);
  if(be)return {p:bp,d:best,e:be};
  best=1e9;
  for(var i=0;i<EDGES.length;i++){var e=EDGES[i];
    if(e.c!=='paved'&&e.c!=='minor')continue;
    var g=decode(GR.g[i]);
    for(var k=0;k<g.length;k++){var d=mi(ll,g[k]);
      if(d<best){best=d;bp=g[k];be=e}}}
  return {p:bp,d:best,e:be}}

 
var ABOUT='<span class="tn">APEX ORV</span>'+
 '<span class="meta">offline</span><span class="meta">no account</span><br>'+
 'Michigan DNR + USDA Forest Service designations, OpenStreetMap for context. '+
 'Every line says which.<br><br>'+
 '<b>This is not an emergency device.</b> It cannot call anyone. In country '+
 'like this a satellite messenger does something no map can — carry one.<br>'+
 'The MVUM and DNR signage are the legal authority. This app is not a defence.<br>'+
 'Private property lines are not shown; that data is licensed and not public.';

 

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
   
  var C=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.Haptics;
  if(C){var d=Array.isArray(p)?p.reduce(function(a,b){return a+b},0):p;
    try{C.vibrate({duration:d})}catch(e){}return}
  try{navigator.vibrate&&navigator.vibrate(p)}catch(e){}}

 
 
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
     
    try{hudPaint();if(NAV.on)navChip();peekGps()}catch(e){}
     
    if(++RIDE.ticks%3===1)batteryNow().then(function(b){
      if(RIDE&&b){RIDE.batt1=b.lvl;RIDE.chg=RIDE.chg||b.chg}});
     
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

 
var HUD={spd:null,hdg:null,at:null,t:null};
 
var FIX_T=0,GPS_STALE_MS=15000;
function fixStale(){return posMode==='gps'&&FIX_T>0&&Date.now()-FIX_T>GPS_STALE_MS}
function fixClock(){try{return new Date(FIX_T).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}
  catch(e){return 'the last one'}}
 
var PEEK_LIVE='Recording \u00b7 live GPS';
function peekGpsText(){return fixStale()?'No GPS fix since '+fixClock():PEEK_LIVE}
function peekGps(){var t=el('peek-txt');if(!t||!gotFix)return;
  var cur=String(t.textContent||''),lost=cur.indexOf('No GPS fix since ')===0;
   
  if(cur!==PEEK_LIVE&&!lost&&cur.indexOf('Truck ')!==0)return;
  var w=fixStale()?peekGpsText():lost?(railPeekText()||PEEK_LIVE):cur;
  if(cur!==w)t.textContent=w}

function hudSet(mps,deg,at,quiet){
   
  try{if(CMP_ON)setTimeout(cmpPaint,0)}catch(e){}
  var now=Date.now();
   
  if(at&&HUD.at&&HUD.t){
    var d=mi(HUD.at,at),secs=(now-HUD.t)/1000;
    if(deg===null||deg===undefined){if(d>0.0015)deg=bearing(HUD.at,at)}
    if((mps===null||mps===undefined)&&secs>0.4&&secs<30)mps=d*1609.34/secs;
  }
  if(mps!==null&&mps!==undefined&&isFinite(mps)&&mps>=0)HUD.spd=mps;
  if(deg!==null&&deg!==undefined&&isFinite(deg))HUD.hdg=(deg%360+360)%360;
  if(at){HUD.at=at.slice();HUD.t=now}
   
  if(!quiet)hudPaint()}

function hudShow(on){
  var b=el('hudbar'),s=el('hudstats'),c=el('chips');
  if(b)b.hidden=!on;
  if(s)s.hidden=!on;
   
  if(c)c.hidden=!!on;
  if(!on){HUD={spd:null,hdg:null,at:null,t:null}}
  hudPaint();sheetH();simChip()}
 
function sheetH(){try{var s=el('hudstats');
  var h=(s&&!s.hidden)?(s.offsetHeight||0):0;
  document.documentElement.style.setProperty('--sheet-h',h+'px')}catch(e){}
  ridePublish()}
 
var RIDE_G_ROOM=52;    
function ridePublish(){try{
  var st=el('stage'),b=el('hudbar'),n=el('nav'),g=el('nav-g'),rw=el('nav-row'),h=0;
  if(!st)return;
  var s0=st.getBoundingClientRect().top;
  if(b&&!b.hidden)h=b.getBoundingClientRect().bottom-s0;
  if(n&&!n.hidden){
    var nb=n.getBoundingClientRect().bottom;
    if(rw&&hudRouted()){
       
      var r1=rw.getBoundingClientRect().bottom,pad=nb-(g&&!g.hidden?g.getBoundingClientRect().bottom:r1);
      if(g&&!g.hidden)RIDE_G_ROOM=Math.max(RIDE_G_ROOM,g.getBoundingClientRect().bottom-r1);
      nb=Math.max(nb,r1+RIDE_G_ROOM+pad)}
    h=Math.max(h,nb-s0)}
  var de=document.documentElement;
  de.style.setProperty('--ride-top',Math.round(Math.max(0,h))+'px');
   
  var low=0;['readout','c-mode','c-act','c-base','c-hd'].forEach(function(id){var e=el(id);
    if(e&&!e.hidden){var r=e.getBoundingClientRect();if(r.height>0)low=Math.max(low,r.bottom)}});
   
  low=Math.max(low,s0+h);
  var alr=el('alert');
  if(alr&&/\bon\b/.test(alr.className)){var ar=alr.getBoundingClientRect();if(ar.height>0)low=Math.max(low,ar.bottom)}
   
  var hs=el('hudstats'),rb=el('railbody'),GAP=8;    
   
  var fl=(hs&&!hs.hidden)?hs:el('tools'),fr=fl?fl.getBoundingClientRect():null;
  if(fr&&fr.height>0&&rb&&isFinite(low)){
    var cap=rb.getBoundingClientRect().height+fr.top-low-GAP;
    if(isFinite(cap)){var cv=Math.floor(cap)+'px';
      if(de.style.getPropertyValue('--ride-cap')!==cv){de.style.setProperty('--ride-cap',cv);rcFit()}}}}catch(e){}
   
  if(CMP_ON&&cmpGeo()!==CMP_GEO)cmpFit()}

function hudPaint(){
  var b=el('hudbar');
  if(!b||b.hidden)return;
   
  var hint=el('hudhint');
  if(hint)hint.hidden=(HUD.hdg!==null);
  var w=b.clientWidth||360,SPAN=180,ppd=w/SPAN,h=HUD.hdg;
  var t=el('hudticks');
  if(t){
    if(h===null){t.innerHTML='';}
    else{
      var out=[],CARD=['N','NE','E','SE','S','SW','W','NW'];
      for(var d=0;d<360;d+=15){
        var off=((d-h+540)%360)-180;
        if(Math.abs(off)>SPAN/2)continue;
        var x=w/2+off*ppd,maj=(d%45===0);
        out.push('<i class="'+(maj?'maj':'')+'" style="left:'+x.toFixed(1)+
          'px;height:'+(maj?11:6)+'px"></i>');
        if(maj)out.push('<b style="left:'+x.toFixed(1)+'px">'+CARD[(d/45)|0]+'</b>');
      }
      t.innerHTML=out.join('');
    }
  }
  var old=fixStale();
  var sp=el('hud-spd');
  if(sp)sp.innerHTML=((HUD.spd===null||old)?'—':Math.round(HUD.spd*2.23694))+
    hudUnit('mph');
   
  var ro=hudRouted(),G=HUDG;
  var sh=function(id,on){var c=el(id);if(c)c.hidden=!on};
  sh('hc-togo',ro);sh('hc-eta',ro);sh('hc-time',!ro);sh('hc-spd',!ro);
  var tm=el('hud-time');
  if(tm)tm.innerHTML=RIDE?hudClock(Date.now()-RIDE.t0):'—';
  var ds=el('hud-dist');
  if(ds)ds.innerHTML=crumbMi.toFixed(1)+hudUnit('mi');
  var tg=el('hud-togo');
  if(tg)tg.innerHTML=(G&&G.togo!==null&&!old)?G.togo.toFixed(1)+hudUnit('mi'):'—';
  var et=el('hud-eta');
  if(et){var ep=(G&&G.min!==null&&!old)?etaParts(G.min):null;
    et.innerHTML=ep?'~'+ep[0]+hudUnit(ep[1]):'—'}
  var src=el('hud-src');
  if(src)src.hidden=(posMode!=='sim');
  hudBtns(ro)}
 
 
function hudClock(ms){var m=Math.floor(Math.max(0,ms)/60000);
  if(m<1)return '&lt;1'+hudUnit('min');
  var c=clockParts(m*60000);return c[0]+hudUnit(c[1])}
function hudUnit(u){return '<span class="hu"> '+u+'</span>'}
function clockParts(ms){
  var m=Math.max(0,Math.round(ms/60000));
  if(m<60)return [String(m),'min'];
  var h=Math.floor(m/60),r=m%60;
  return [h+':'+(r<10?'0':'')+r,'h']}
 
var NAV_PACE_N=10;
function etaParts(min){return clockParts(Math.max(1,Math.round(min))*60000)}
function etaTxt(min){var c=etaParts(min);return c[0]+' '+c[1]}
 
function navEta(remainM,hrs,totalM,river){
  if(_navSpd.length>=NAV_PACE_N){
    var spd=_navSpd.reduce(function(a,b){return a+b},0)/_navSpd.length;
    var pp=river?paddlePace():null;
    spd=Math.max(spd,(river?pp.mph-pp.spr:((MACHINE[machine]||{}).spd||3))*0.44704);
    return remainM/spd/60}
  return (hrs!==null&&isFinite(hrs)&&totalM>0)?hrs*60*remainM/totalM:null}
 
var HUDG=null;
function hudRouted(){return !!(NAV.on&&(RUN||(last&&sel!==null)))}
 
function hudBtns(ro){
  var V=(typeof VOICE==='object'&&VOICE)||{},vb=el('nav-voice'),vn=el('hud-vnote');
  if(vb){vb.disabled=!V.ok;vb.className=(V.ok&&V.on)?'on':'';
     
    if(NAV_VOICE_IC!==!!(V.ok&&V.on)){NAV_VOICE_IC=!!(V.ok&&V.on);
      vb.innerHTML=ic(NAV_VOICE_IC?'voice':'voiceoff')+'<span>Voice</span>'}}
  if(vn){vn.hidden=!!V.ok;
    var vt=V.ok?'':'Voice is unavailable in this phone\u2019s WebView'+
      voiceTail(ro===undefined?hudRouted():ro);
    if(vn.textContent!==vt)vn.textContent=vt}
  var nb=el('nav-north');if(nb)nb.className=NAV.northUp?'on':'';
  sheetH()}
 
function voiceTail(ro){
  if(!ro)return '.';
  return RUN?' \u2014 the strip shows what is ahead on the river.':' \u2014 the strip shows every turn.'}

function rideStop(){
  if(!RIDE)return null;
  clearInterval(RIDE.pulse);
  var R=RIDE,hrs=(Date.now()-R.t0)/3600000;
  var med=function(a){if(!a.length)return null;var b=a.slice().sort(function(x,y){return x-y});
    return b[(b.length/2)|0]};
  R.hrs=hrs;R.medGap=med(R.gaps);R.medAcc=med(R.acc);
  R.drain=(R.batt0!==null&&R.batt1!==null)?(R.batt0-R.batt1):null;
   
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

 
function truckPin(){
  if(!tM)tM=new maplibregl.Marker({element:mk('truck','truck')}).setLngLat(TRUCK).addTo(map);
  else tM.setLngLat(TRUCK)}
function startRecording(at){
   
  if(RESUMING){RESUMING=false;
    if(!crumbs.length){crumbs=[at.slice()];crumbMi=0}
    if(!TRUCK)TRUCK=(crumbs[0]||at).slice();
     
    truckPin();
    rideStart(at);
    if(RESUMED_RIDE){RIDE.t0=RESUMED_RIDE.t0;RIDE.mi0=RESUMED_RIDE.mi0||0;RESUMED_RIDE=null}
     
    hudShow(true);
    return}
  TRUCK=at.slice(); crumbs=[at.slice()]; crumbMi=0;
  rideStart(at);
  hudShow(true);
  truckPin();
  map.getSource('back').setData({type:'FeatureCollection',features:[]});
  syncSafety()}

function record(at){
  if(!crumbs.length)return;
  var prev=crumbs[crumbs.length-1], d=mi(prev,at);
  if(d<0.004)return;                     
  crumbs.push(at.slice()); crumbMi+=d;
  map.getSource('crumb').setData({type:'FeatureCollection',features:[
    {type:'Feature',properties:{},geometry:{type:'LineString',coordinates:crumbs}}]});
  syncSafety()}

 
function syncSafety(){
  var tv=el('v-truck'), rv=el('v-rec');
  if(!TRUCK){tv.textContent='—';tv.className='v';rv.textContent='—';
     
    if(tv.parentNode)tv.parentNode.className='cell empty';
    if(rv.parentNode)rv.parentNode.className='cell empty';
    return}
  if(tv.parentNode)tv.parentNode.className='cell';
  if(rv.parentNode)rv.parentNode.className='cell';
  var d=mi(ME,TRUCK), b=bearing(ME,TRUCK);
  tv.textContent=(d<10?d.toFixed(1):Math.round(d))+' '+compass(b);
  tv.className='v'+(d>8?' warn':' good');
  rv.textContent=crumbMi.toFixed(1);
   
  el('b-src').textContent=crumbs.length?'REC '+crumbs.length:'GRAPH '+EDGES.length;
  el('b-src').className='badge '+(crumbs.length?'good':'good')}

 
function offRouteHtml(ft){return 'Off route — '+ft+' ft from your line'+
  '<small>Tap Retrace to follow your own track back to the truck.</small>'}
function checkOffRoute(){
  if(!last||sel===null||!crumbs.length)return;
  var pts=[];last[sel].s.path.forEach(function(e){pts=pts.concat(decode(GR.g[e.i]))});
  var best=1e9;for(var i=0;i<pts.length;i++){var d=mi(ME,pts[i]);if(d<best)best=d}
  var off=best>0.16;                     
  if(off&&!offAlert){offAlert=true;buzz([120,80,120,80,220]);
    el('alert').className='on';
    el('alert').innerHTML=offRouteHtml(best*5280|0);ridePublish()}
  else if(!off&&offAlert){offAlert=false;el('alert').className='';ridePublish()}}

 
el('btn-retrace').addEventListener('click',function(){
   
  if(crumbs.length<2)return show('Nothing recorded yet. Retrace follows the track a ride records \u2014 tap <b>Ride it</b> (Ride tab) with a GPS fix to start one.','fail');
  var back=crumbs.slice().reverse(), d=0;
  for(var i=1;i<back.length;i++)d+=mi(back[i-1],back[i]);
  map.getSource('back').setData({type:'FeatureCollection',features:[
    {type:'Feature',properties:{},geometry:{type:'LineString',coordinates:back}}]});
  var b=new maplibregl.LngLatBounds();back.forEach(function(c){b.extend(c)});
  map.fitBounds(b,{padding:50,duration:700});
  el('alert').className='';offAlert=false;ridePublish();
  show('<span class="tn">Retrace</span><br><span class="meta">no router · no network</span><br>'+
   '<b>'+d.toFixed(2)+' mi</b> back along the track you actually rode · '+
   compass(bearing(ME,TRUCK))+' to the truck · '+back.length+' points<br>'+
   'Every foot of this is ground you have already covered.','')});

 
function nearestEdge(ll){
  var G=gridBuild(), best=1e9,be=null,seen={};
  var visit=function(list){
    for(var j=0;j<list.length;j++){var i=list[j];if(seen[i])continue;seen[i]=1;
      var g=decode(GR.g[i]);
      for(var k=0;k<g.length;k++){var d=mi(ll,g[k]);if(d<best){best=d;be=EDGES[i]}}}};
  visit.done=function(r){return be!==null&&ringMi(r+1)>best};
  gridRings(ll,G.edges,visit,400);
  return be?{e:be,d:best}:nearestEdge_linear(ll)}
function nearestEdge_linear(ll){
  var best=1e9,be=null;
  for(var i=0;i<EDGES.length;i++){var g=decode(GR.g[i]);
    for(var k=0;k<g.length;k++){var d=mi(ll,g[k]);if(d<best){best=d;be=EDGES[i]}}}
  return {e:be,d:best}}
 
function nearestJunction(ll){
  var G=gridBuild(),best=1e9,bn=null;
  var visit=function(list){for(var j=0;j<list.length;j++){var i=list[j];
    if(!JX[i])continue;var d=mi(ll,NODES[i]);if(d<best){best=d;bn=i}}};
  visit.done=function(r){return bn!==null&&ringMi(r+1)>best};
  gridRings(ll,G.nodes,visit,400);
  if(bn!==null)return {n:bn,d:best};
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
   
  var lf=liveFix(),FX=lf?lf.at:ME_FIX?ME_FIX.at.slice():null;
  if(!FX)return show('<b>No GPS fix yet.</b><br>The start pin is not a position: this card '+
    'reads your <i>actual</i> location to dispatch, so it will not print a coordinate you '+
    'are not standing at.','fail');
  var old=lf?'':(function(){var m=Math.floor((Date.now()-ME_FIX.t)/60000);
    return '<b>Last GPS fix '+meClock()+'</b> ('+(m<1?'under a minute':m+' min')+' ago) \u2014 '+
      'not a live position: you may have moved since.<br>'})();
  show('Locating you on the network…','');
  setTimeout(function(){
    var ME=FX;
    var ne=nearestEdge(ME), nj=nearestJunction(ME);
    var out=old+'<span class="tn">'+ME[1].toFixed(5)+'  '+ME[0].toFixed(5)+'</span>'+
      '<span class="meta">decimal degrees</span><br>';
    var bits=[];
     
    var ad=addressAt(ME)||addressAt(ME,true);
    if(ad)bits.push((ad.near?'Nearest address ':'Address ')+'<b>'+ad.txt+'</b>');
    var cty=countyAt(ME);
    if(cty)bits.push('County <b>'+cty+' County, MI</b>');
    if(ne.e){var a=attrs(ne.e);
      bits.push('On or near '+(ne.e.n?'<b>'+ne.e.n+'</b>'
                               :'an unnamed <b>'+label(ne.e.c)+'</b>')+
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
    bits.push((ad?'Read the coordinates first, then the address, then the junction.'
                :'Read the coordinates first, then the junction.')+
      (old?' Say they are your last GPS fix, from '+meClock()+'.':''));
    show(out+bits.join('<br>'),'')},20)});

 
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
  hudShow(false);
  setChip('c-ride','ride','Ride it');rideFlag()}}
 
function rideFlag(){try{var s=el('shell');if(!s)return;
   
  if(rideMode||riding){s.dataset.ride='1';var rr=el('rc-ride');if(rr)rr.hidden=true}
  else delete s.dataset.ride}catch(e){}
   
  simChip();stripH();ridePublish()}
 
function simChip(){
  var c=el('c-lost'),r=el('c-ride'),s=el('hudstats');
  var was=(c?(c.hidden?'1':'0'):'-')+(r?(r.hidden?'1':'0'):'-');
  if(c)c.hidden=!(riding&&TAB==='ride');
  if(r&&TAB==='ride')r.hidden=!!((rideMode||riding)&&s&&!s.hidden);
  var now=(c?(c.hidden?'1':'0'):'-')+(r?(r.hidden?'1':'0'):'-');
  if(now!==was){stripH();ridePublish()}}

 
var rideMode=null,gotFix=false,fixN=0;

 
var TRIPKEY='apex.trip.v1',_tripT=0,RESUMING=false,RESUMED_RIDE=null;
var NAV={on:false,follow:true,northUp:false,brg:0,mps:0,lastAt:null,lock:null};
function tripSnapshot(){
  return {v:1,startedAt:(RIDE&&RIDE.t0)||Date.now(),mode:mode,machine:machine,
    to:RTO,lbl:DESTLBL,prof:(last&&sel!==null&&last[sel])?last[sel].k:null,
    run:RUNFROM?{riv:RUNFROM.riv,mi:RUNFROM.mi,n:RUNFROM.n,k:RUNFROM.k}:null,
    runNav:RUN?{riv:RUN.riv,a:RUN.a,b:RUN.b}:null,
    nav:{northUp:NAV.northUp},crumbs:crumbs,crumbMi:crumbMi,
    ride:RIDE?{t0:RIDE.t0,mi0:RIDE.mi0||0}:null,
    lastFix:ME?{at:ME,t:Date.now()}:null,ended:false}}
function tripSave(force){
  var now=Date.now();if(!force&&now-_tripT<5000)return;_tripT=now;
  var t=tripSnapshot();
  try{localStorage.setItem(TRIPKEY,JSON.stringify(t))}
  catch(e){ 
    try{t.crumbs=t.crumbs.filter(function(_,i){return i%2===0});
      localStorage.setItem(TRIPKEY,JSON.stringify(t))}catch(e2){}}}
function tripEnd(){try{var t=JSON.parse(localStorage.getItem(TRIPKEY)||'null');
  if(t){t.ended=true;localStorage.setItem(TRIPKEY,JSON.stringify(t))}}catch(e){}}
function tripLoad(){try{var t=JSON.parse(localStorage.getItem(TRIPKEY)||'null');
  if(!t||t.ended)return null;
  var ref=t.lastFix?t.lastFix.t:t.startedAt;
  if(Date.now()-ref>24*3600e3)return null;return t}catch(e){return null}}
function tripResume(t){
  if(!t)return false;
  try{
    if(t.mode&&t.mode!==mode)applyMode(t.mode,{silent:true});
    if(t.machine&&MACHINE[t.machine]){machine=t.machine;
      machIdx=Math.max(0,ORDER.indexOf(machine));
      setChip('c-machine',MACHINE[machine].ic,MACHINE[machine].lbl)}
    crumbs=(t.crumbs||[]).slice();crumbMi=t.crumbMi||0;
    if(crumbs.length)map.getSource('crumb').setData({type:'FeatureCollection',
      features:[{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:crumbs}}]});
    if(t.lastFix&&t.lastFix.at){ME=t.lastFix.at.slice();mM.setLngLat(ME)}
    if(t.run)RUNFROM=t.run;
    if(t.runNav)runSet(t.runNav.riv,t.runNav.a,t.runNav.b);
    NAV.northUp=!!(t.nav&&t.nav.northUp);
     
    if(t.to){DESTLBL=t.lbl||'there';RTO=t.to.slice();RIDDEN_WARN=null;routeToPoint(t.to,t.lbl,{k:t.prof||null,resume:true});
       
      setTimeout(function(){if(last&&t.prof){var i=-1;
        for(var q=0;q<last.length;q++)if(last[q].k===t.prof){i=q;break}
        if(i>=0&&i!==sel){sel=i;draw(last[sel],false);rcSel()}}},400)}
    RESUMING=true;RESUMED_RIDE=t.ride||null;
    logAct('act  trip resumed '+crumbs.length+' fixes');
    return true}catch(e){show('Could not resume the trip: '+e,'fail');return false}}
function tripResumeCard(){
  var t=tripLoad();if(!t)return false;
  var when=new Date(t.startedAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
  show('<b>Resume your trip?</b><div class="sub">Started '+when+' \u00b7 '+
    (t.crumbMi||0).toFixed(1)+' mi recorded'+(t.lbl?' \u00b7 heading to '+t.lbl:'')+
    (t.run?' \u00b7 a run on the '+t.run.riv:'')+
    '. The app closed mid-trip; everything up to the last fix is still here.</div>'+
    '<button class="chip" id="trip-resume">'+ic('ride')+'<span>Resume</span></button> '+
    '<button class="chip" id="trip-discard">'+ic('del')+'<span>Discard</span></button>','');
  el('trip-resume').addEventListener('click',function(){
     
     
    if(tripResume(t)){el('c-ride').click();if(rideMode||riding)
      rideCard(rideWaiting()?'<b>Trip resumed</b><div class="sub">Recording continues from the next GPS fix; the '+
          crumbMi.toFixed(1)+' mi recorded are kept.</div>'
        :'<b>Trip resumed</b><div class="sub">Recording continues from your last fix.</div>','',
        rideWaiting()?railPeekText():'Trip resumed \u00b7 recording')}});
  el('trip-discard').addEventListener('click',function(){tripEnd();ack('Trip discarded.')});
  return true}

 
function navFollow(at,mps,deg){
  if(!NAV.on)return;
  var brg=NAV.brg;
  if(typeof NAV.riverBrg==='number')brg=NAV.riverBrg;        
  else if(mps>1.2&&typeof deg==='number'&&!isNaN(deg))brg=deg;
  else if(NAV.lastAt&&mi(NAV.lastAt,at)>0.003)brg=bearing(NAV.lastAt,at);
  NAV.brg=brg;NAV.lastAt=at.slice();NAV.mps=mps||0;
  navChip();
  if(!NAV.follow)return;
  var z=mps>15?15.0:mps>8?15.5:mps>3?16.0:16.4;
  map.easeTo({center:at,bearing:NAV.northUp?0:brg,pitch:NAV.northUp?0:55,zoom:z,
    duration:900,easing:function(t){return t}})}
 
var NAV_VOICE_IC=null;
function navChip(){
   
  var n=el('nav');if(!n)return hudBtns();
  if(!NAV.on){n.hidden=true;return hudBtns()}
  n.hidden=false;
  var dirs=['N','NE','E','SE','S','SW','W','NW'];
   
   
  el('nav-sp').textContent=!NAV.lastAt?GPS_WAIT:fixStale()?'No GPS fix since '+fixClock()
    :(Math.round(NAV.mps*2.237)+' mph \u00b7 '+dirs[Math.round(((NAV.brg%360)+360)%360/45)%8]);
  navGStale();
  hudBtns()}
 
function navGStale(){
  var g=el('nav-g');if(!g||g.hidden||!fixStale())return;
  if((NAVG&&NAVG.arrived)||(RUN&&RUN.arrived))return;
  g.innerHTML='<b><span class="arw">'+ic('warn')+'</span>Waiting for a GPS fix</b>'+
    '<span class="eta">No fix since '+fixClock()+' \u00b7 guidance comes back with the next one</span>'}
 
function navWake(on){try{if(on)WAKE.hold('nav');else WAKE.drop('nav')}catch(e){}}
function navStart(){NAV.on=true;NAV.follow=true;NAV.lastAt=null;FIX_T=0;navWake(true);
  RIDE_G_ROOM=52;    
  navChip()}
function navStop(){NAV.on=false;navWake(false);navChip();navGuideClear();navSay('',true)}

 
var VOICE={ok:false,on:false,last:'',near:''};
function navVoiceProbe(){
  try{
    if(typeof speechSynthesis==='undefined'||typeof SpeechSynthesisUtterance==='undefined')return false;
    var v=speechSynthesis.getVoices()||[];
    VOICE.ok=v.length>0;
    VOICE.voice=v.filter(function(x){return /^en/i.test(x.lang)&&x.localService})[0]
      ||v.filter(function(x){return /^en/i.test(x.lang)})[0]||v[0]||null;
    VOICE.local=!!(VOICE.voice&&VOICE.voice.localService);
    return VOICE.ok}catch(e){VOICE.ok=false;return false}}
function navSay(text,cancel){
  if(cancel){try{if(VOICE.ok)speechSynthesis.cancel()}catch(e){}VOICE.last='';VOICE.near='';return}
  if(!VOICE.ok||!VOICE.on||!text||text===VOICE.last)return;
  VOICE.last=text;
  try{var u=new SpeechSynthesisUtterance(text);if(VOICE.voice)u.voice=VOICE.voice;
    u.rate=1.0;speechSynthesis.cancel();speechSynthesis.speak(u);
    logAct('say  '+text)}catch(e){}}
function navVoiceToggle(){VOICE.on=!VOICE.on;
  try{localStorage.setItem('apex.voice',VOICE.on?'1':'0')}catch(e){}
  navChip();if(VOICE.on)navSay('Voice guidance on')}
try{VOICE.on=localStorage.getItem('apex.voice')==='1'}catch(e){}
if(typeof speechSynthesis!=='undefined'){
  navVoiceProbe();
  try{speechSynthesis.onvoiceschanged=function(){navVoiceProbe();navChip()}}catch(e){}}

 
var NAVG=null,_navSpd=[],_navOff=0,_navReT=0;
 
var LOOPWAS=null;

 
var RUN=null,_riverCache={},_rmHist=[];
function runSet(riv,a,b){
  var c=corridorByName(riv);
  var fix=function(x){if(x&&!x.p&&c){var f=c.f.filter(function(q){return Math.abs(q.mi-x.mi)<0.01})[0];
    if(f)x=Object.assign({},x,{p:f.p})}return x};
  RUN={riv:riv,a:fix(a),b:fix(b)};_rmHist=[];NAV.riverBrg=null;
  _navSpd=[];    
  logAct('act  navigate run '+riv)}
function runNavClear(){RUN=null;HUDG=null;NAV.riverBrg=null;_rmHist=[]}
function corridorByName(riv){
  for(var i=0;i<((PADDLE&&PADDLE.c)||[]).length;i++)if(PADDLE.c[i].n===riv)return PADDLE.c[i];
  return null}
function riverLine(riv){
  if(_riverCache[riv])return _riverCache[riv];
  var c=corridorByName(riv);if(!c)return null;
  var pts=[],cum=[];
  c.g.forEach(function(g){g.forEach(function(p){
    cum.push(pts.length?cum[cum.length-1]+mi(pts[pts.length-1],p)*1609.34:0);pts.push(p)})});
  return _riverCache[riv]={pts:pts,cum:cum,total:cum[cum.length-1],seg:0,c:c}}
function navRiver(at){
  if(!RUN){NAV.riverBrg=null;return null}
  var L=riverLine(RUN.riv);if(!L)return null;
  var lo=Math.max(0,L.seg-60),hi=Math.min(L.pts.length-2,L.seg+600),best=1e12,bi=L.seg,bt=0;
  var cosl=Math.cos(at[1]*Math.PI/180),ax=at[0]*cosl,ay=at[1];
  for(var i=lo;i<=hi;i++){
    var p=L.pts[i],q=L.pts[i+1],px=p[0]*cosl,py=p[1],qx=q[0]*cosl,qy=q[1];
    var dx=qx-px,dy=qy-py,L2=dx*dx+dy*dy,t=L2?((ax-px)*dx+(ay-py)*dy)/L2:0;
    t=t<0?0:t>1?1:t;var cx=px+t*dx,cy=py+t*dy,d2=(ax-cx)*(ax-cx)+(ay-cy)*(ay-cy);
    if(d2<best){best=d2;bi=i;bt=t}}
   
  if(Math.sqrt(best)*111320>400&&(lo>0||hi<L.pts.length-2)){L.seg=0;
    lo=0;hi=L.pts.length-2;best=1e12;
    for(var j=lo;j<=hi;j++){var p2=L.pts[j],q2=L.pts[j+1],px2=p2[0]*cosl,py2=p2[1],qx2=q2[0]*cosl,qy2=q2[1];
      var dx2=qx2-px2,dy2=qy2-py2,L22=dx2*dx2+dy2*dy2,t2=L22?((ax-px2)*dx2+(ay-py2)*dy2)/L22:0;
      t2=t2<0?0:t2>1?1:t2;var cx2=px2+t2*dx2,cy2=py2+t2*dy2,dd=(ax-cx2)*(ax-cx2)+(ay-cy2)*(ay-cy2);
      if(dd<best){best=dd;bi=j;bt=t2}}}
  L.seg=bi;
  var off=Math.sqrt(best)*111320;
  var rmM=L.cum[bi]+bt*(L.cum[bi+1]-L.cum[bi]),rm=rmM/1609.34;
  var brg=bearing(L.pts[bi],L.pts[Math.min(L.pts.length-1,bi+1)]);
  NAV.riverBrg=off<250?brg:null;
  return {rm:rm,off:off,brg:brg,seg:bi}}
function navRiverGuide(at,acc,st,mps){
  var g=el('nav-g');if(!g||!RUN)return false;
  var L=riverLine(RUN.riv);if(!L)return false;
  var lo=Math.min(RUN.a.mi,RUN.b.mi),hi=Math.max(RUN.a.mi,RUN.b.mi),bmi=RUN.b.mi;
  var remain=bmi-st.rm;
  _rmHist.push(st.rm);if(_rmHist.length>6)_rmHist.shift();
   
  var toB=RUN.b.p?mi(at,RUN.b.p)*1609.34:1e9,acc_=Math.max(15,acc||0);
  if(!RUN.arrived&&(toB<Math.max(40,acc_)||remain<0.03)){
    RUN.arrived=true;NAV.follow=false;HUDG={togo:0,min:null};navChip();
    g.hidden=false;g.innerHTML='<b><span class="arw">'+ic('arrive')+'</span>You have reached the take-out</b>'+
      '<span class="eta">'+(RUN.b.n||'Take-out')+'</span>';ridePublish();
    buzz([80,60,80,60,200]);
    navSay('You have reached the take-out'+(RUN.b.n?', '+RUN.b.n:''));
    rideCard('<b>Take-out reached</b><div class="sub">'+(RUN.b.n||'Your take-out')+
      '. Recording continues until you stop it.</div>','','Take-out reached \u00b7 '+(RUN.b.n||'your take-out'));
    logAct('nav  take-out reached');return true}
  if(RUN.arrived)return true;
   
  var f=L.c.f,next=null,dam=null;
  for(var i=0;i<f.length;i++){var q=f[i];if(q.mi<=st.rm+0.03||q.mi>bmi+0.02)continue;
    if(q.k==='dam'&&!dam&&q.mi-st.rm<=3)dam=q;
    if(!next&&(q.k==='access'||q.k==='launch'||q.k==='camp')&&q.mi-st.rm<=5)next=q}
  var up=_rmHist.length>=5&&(_rmHist[0]-_rmHist[_rmHist.length-1])>0.05;
  var line1;
  if(dam){line1='<b><span class="arw">'+ic('warn')+'</span>Dam in '+(dam.mi-st.rm).toFixed(1)+' mi \u2014 portage'+(dam.n?' \u00b7 '+dam.n:'')+'</b>';
    var dk='dam|'+dam.mi.toFixed(2);if(VOICE.near!==dk){VOICE.near=dk;
      navSay('Dam in '+(dam.mi-st.rm).toFixed(1)+' miles. Portage.')}}
  else if(next)line1='<b><span class="arw">'+ic('downstream')+'</span>'+(next.k==='camp'?'Camp':'Access')+' in '+(next.mi-st.rm).toFixed(1)+' mi'+(next.n?' \u00b7 '+next.n:'')+'</b>';
  else line1='<b><span class="arw">'+ic('downstream')+'</span>Downstream to '+(RUN.b.n||'take-out')+'</b>';
  var craft=(MACHINE[machine]&&MACHINE[machine].mph)?MACHINE[machine].lbl.toLowerCase():null;
   
  if(mps>0.6){_navSpd.push(mps);if(_navSpd.length>60)_navSpd.shift()}
  var runMi=Math.abs(RUN.b.mi-RUN.a.mi),left=Math.max(0,remain);
  var etaMin=navEta(left*1609.34,paddleMin(runMi)/60,runMi*1609.34,true);
  HUDG={togo:left,min:etaMin};
  g.hidden=false;
  g.innerHTML=line1+'<span class="eta">'+left.toFixed(1)+' mi to '+(RUN.b.n||'take-out')+
    (etaMin!==null?' \u00b7 ~'+etaTxt(etaMin):'')+(craft?' as a '+craft:'')+
    ' \u00b7 mile '+st.rm.toFixed(1)+
    (st.off>250?' \u00b7 off the mapped river':'')+(up?' \u00b7 heading UPSTREAM':'')+'</span>';
  ridePublish();return true}
function navGuideClear(){
  if(NAVG)LOOPWAS=(NAVG.loop&&!NAVG.arrived)?{set:NAVG.set,rid:NAVG.rid||0}:null;
  NAVG=null;HUDG=null;_navSpd=[];_navOff=0;var g=el('nav-g');if(g)g.hidden=true;ridePublish()}
function navPlan(){
  if(!last||sel===null||!last[sel])return null;
  var o=last[sel],steps=directions(o.s.path,o.na);
  if(!steps.length)return null;
  var pts=[],cum=[0],legs=[],ends=[],cur=o.na;
  for(var i=0;i<o.s.path.length;i++){var e=o.s.path[i],g=decode(GR.g[e.i]);
    if(e.a!==cur)g=g.slice().reverse();cur=(e.a===cur)?e.b:e.a;
    for(var j=(pts.length?1:0);j<g.length;j++){
      if(pts.length)cum.push(cum[cum.length-1]+mi(pts[pts.length-1],g[j])*1609.34);
      pts.push(g[j])}
    legs.push(pts.length-1);ends.push(cur)}
   
  var marks=[];for(var k=0;k<steps.length;k++){var li=steps[k].at;
    marks.push(li===0?0:cum[legs[li-1]])}
   
   
   
  var pv=NAVG,lp=o.na===o.nb||!!o.rj,base=0,odo0=crumbMi,sg=0;
  if(lp&&pv&&pv.loop&&pv.set===last){odo0=pv.odo0;base=pv.base||0}
  else if(lp&&LOOPWAS&&LOOPWAS.set===last)base=LOOPWAS.rid;
  if(lp){var r0=base+Math.max(0,crumbMi-odo0)*1609.34;
    while(sg<cum.length-2&&cum[sg+1]<=r0)sg++}
  var dst=RTO||pts[pts.length-1];
  NAVG={o:o,steps:steps,marks:marks,pts:pts,cum:cum,total:cum[cum.length-1],
    dest:dst,lbl:DESTLBL,seg:sg,arrived:false,key:sel+'|'+(o.k||''),
    loop:lp,set:last,odo0:odo0,base:base,rid:base,appr:(lp&&!o.rj)?mi(dst,pts[0])*1609.34:0,
    legs:legs,ends:ends};
  return NAVG}
 
function navProject(at,lim,want){
  var G=NAVG,best=1e12,bi=G.seg,bt=0,cand=(want==null)?null:[];
  var lo=Math.max(0,G.seg-40),hi=Math.min(G.pts.length-2,G.seg+400);
  var cosl=Math.cos(at[1]*Math.PI/180),ax=at[0]*cosl,ay=at[1];
  for(var i=lo;i<=hi;i++){
    if(lim!=null&&i>lo&&G.cum[i]>lim)break;
    var p=G.pts[i],q=G.pts[i+1],px=p[0]*cosl,py=p[1],qx=q[0]*cosl,qy=q[1];
    var dx=qx-px,dy=qy-py,L2=dx*dx+dy*dy,t=L2?((ax-px)*dx+(ay-py)*dy)/L2:0;
    t=t<0?0:t>1?1:t;
    var cx=px+t*dx,cy=py+t*dy,d2=(ax-cx)*(ax-cx)+(ay-cy)*(ay-cy);
    if(d2<best){best=d2;bi=i;bt=t}
    if(cand)cand.push(i,t,d2)}
  if(cand){var far=Math.sqrt(best)*111320+15,bd=1e12;
    for(var c=0;c<cand.length;c+=3){
      if(Math.sqrt(cand[c+2])*111320>far)continue;
      var ci=cand[c],pg=G.cum[ci]+cand[c+1]*(G.cum[ci+1]-G.cum[ci]),dd=Math.abs(pg-want);
      if(dd<bd){bd=dd;bi=ci;bt=cand[c+1]}}}
  var seglen=G.cum[bi+1]-G.cum[bi];
  return {seg:bi,prog:G.cum[bi]+bt*seglen,off:Math.sqrt(best)*111320}}
 
var REJOIN_MIN_M=100,REJOIN_WIN_M=3219,REJOIN_TRY=4;
function loopRejoin(at,G,pr){try{
  var o=G.o,path=o.s.path,L=G.legs,E=G.ends;
  if(!o||!path||!L||!E||path.length<2)return false;
  var a=nearestNode(at);if(a<0)return false;
  var near=function(lo,hi){var c=[];
    for(var i=0;i<path.length-1;i++){var m=G.cum[L[i]];
      if(m<lo||m>hi)continue;c.push({i:i,n:E[i],m:m,d:mi(at,NODES[E[i]])})}
    c.sort(function(x,y){return x.d-y.d});return c};
  var c=near(pr.prog+REJOIN_MIN_M,pr.prog+REJOIN_MIN_M+REJOIN_WIN_M);
  if(!c.length)c=near(pr.prog+REJOIN_MIN_M,Infinity);
  var sh=null;LOOP_SHAPES.forEach(function(x){if(x.k===o.k)sh=x});
  var cost=sh?sh.f:LOOP_SHAPES[0].f;
   
  var ahead={},S=E[path.length-1];
  for(var j=0;j<path.length-1;j++)
    if(G.cum[L[j]]>=pr.prog+REJOIN_MIN_M&&!ahead.hasOwnProperty(E[j]))ahead[E[j]]=j;
  for(var t=0;t<Math.min(REJOIN_TRY,c.length);t++){
    var leg=(a===c[t].n)?[]:route(a,c[t].n,cost);
     
    if(!leg)break;
    var cut=-1,k=0,cur=a;
    for(;;){if(ahead.hasOwnProperty(cur)){cut=ahead[cur];break}
      if(cur===S&&k>0)break;
      if(k>=leg.length)break;
      cur=(leg[k].a===cur)?leg[k].b:leg[k].a;k++}
    if(cut<0)continue;
    leg=leg.slice(0,k);
    var rest=path.slice(cut+1),np=leg.concat(rest);if(!np.length)continue;
    var legMi=0,restMi=0;leg.forEach(function(e){legMi+=e.L});rest.forEach(function(e){restMi+=e.L});
    legMi/=1609.34;restMi/=1609.34;
    var skip=Math.max(0,(G.cum[L[cut]]-pr.prog)/1609.34);
     
    var snap=snapMiles(at,a),toIt=legMi+snap;
    var opt={h:'Back to the loop',k:o.k,s:summarise(np),snap:snap,na:a,nb:o.nb,
      rj:{leg:toIt,snap:snap,rest:restMi,skip:skip},
      note:navFmt(toIt*1609.34)+' back to the loop, then the rest of it to the start ('+restMi.toFixed(1)+' mi)'+
        (skip>=0.1?' \u00b7 '+skip.toFixed(1)+' mi of it skipped':'')};
    logAct('nav  rejoin loop '+toIt.toFixed(2)+' mi back ('+snap.toFixed(2)+' off-network), '+restMi.toFixed(2)+' mi left, '+skip.toFixed(2)+' skipped');
    RFROM=at.slice();
    presentRoutes([opt],{k:o.k,rejoin:opt.rj});
    NAVG=null;
    return true}
  return false}catch(e){return false}}
function navFmt(m){return m<320?(Math.round(m*3.281/50)*50)+' ft':(m/1609.34).toFixed(1)+' mi'}
function navGuide(at,acc,mps){
  if(!NAV.on)return;
  if(!last||sel===null){navGuideClear();return}
  if(!NAVG||NAVG.key!==sel+'|'+(last[sel].k||''))if(!navPlan())return;
  var G=NAVG,g=el('nav-g');if(!g)return;
  if(mps>0.6){_navSpd.push(mps);if(_navSpd.length>60)_navSpd.shift()}
   
  var rid=null;
  if(G.loop){if(crumbMi<G.odo0)G.odo0=crumbMi;rid=G.base+(crumbMi-G.odo0)*1609.34;G.rid=rid}
  var pr=navProject(at,G.loop?rid+1609.34:null,G.loop?rid:null);G.seg=pr.seg;
  var remain=Math.max(0,G.total-pr.prog);
   
  var toDest=mi(at,G.dest)*1609.34,acc_=Math.max(15,acc||0);
  var near=(toDest<Math.max(25,acc_)||remain<25);
  if(G.loop)near=near&&rid>=G.total*0.5;
  if(!G.arrived&&near){
    G.arrived=true;NAV.follow=false;HUDG={togo:0,min:null};navChip();
    g.hidden=false;g.innerHTML='<b><span class="arw">'+ic('arrive')+'</span>You have arrived</b>'+
      '<span class="eta">'+(G.lbl||'Destination')+'</span>';ridePublish();
    buzz([80,60,80,60,200]);
    navSay('You have arrived at '+(G.lbl||'your destination'));
    rideCard('<b>You have arrived</b><div class="sub">'+(G.lbl||'Your destination')+
      '. Recording continues until you stop it.</div>','','Arrived \u00b7 '+(G.lbl||'your destination'));
    logAct('nav  arrived');return}
  if(G.arrived)return;
   
  var onAppr=G.loop&&mi(at,G.pts[0])*1609.34<=G.appr+40;
  if(pr.off>40&&!onAppr){_navOff++}else _navOff=0;
  if(_navOff>=3&&Date.now()-_navReT>20000&&RTO){
    _navReT=Date.now();_navOff=0;
     
    if(G.loop&&loopRejoin(at,G,pr)){
      g.innerHTML='<b><span class="arw">'+ic('reroute')+'</span>Back to the loop</b>';g.hidden=false;ridePublish();return}
    var keep=last[sel].k;
    logAct('nav  reroute '+Math.round(pr.off)+' m off');
    routeToPoint(RTO,DESTLBL,keep||true);
    setTimeout(function(){if(last&&keep){for(var q=0;q<last.length;q++)
      if(last[q].k===keep&&q!==sel){sel=q;draw(last[sel],false);rcSel();break}}
      NAVG=null},450);
    g.innerHTML='<b><span class="arw">'+ic('reroute')+'</span>Re-routing</b>';g.hidden=false;ridePublish();return}
   
  var ni=-1;for(var k=1;k<G.marks.length;k++){if(G.marks[k]>pr.prog+8){ni=k;break}}
   
  var etaMin=navEta(remain,(G.o&&G.o.s)?G.o.s.hrs:null,G.total);
  HUDG={togo:remain/1609.34,min:etaMin};
  var line1=ni<0
    ?'<b><span class="arw">'+ic('arrive')+'</span>'+navFmt(remain)+' to '+(G.lbl||'destination')+'</b>'
    :'<b><span class="arw">'+ic(G.steps[ni].turn[1])+'</span>In '+navFmt(G.marks[ni]-pr.prog)+
      ' \u00b7 '+G.steps[ni].turn[0]+' onto '+G.steps[ni].name+'</b>';
   
  if(ni>=0){var d=G.marks[ni]-pr.prog,key=ni+'|'+(d<90?'near':'far');
    if(key!==VOICE.near){VOICE.near=key;
      navSay((d<90?'':'In '+navFmt(d)+', ')+G.steps[ni].turn[0].toLowerCase()+' onto '+G.steps[ni].name)}}
  g.hidden=false;
  g.innerHTML=line1+'<span class="eta">'+navFmt(remain)+' remaining'+
    (etaMin!==null?' \u00b7 ~'+etaTxt(etaMin):'')+(pr.off>40?' \u00b7 '+navFmt(pr.off)+' off the line':'')+'</span>';
  ridePublish()}
document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='visible')WAKE.resume()});
 
var posMode='none',awayMi=0;
 
var ME_FIX=null;
function meFix(at){ME_FIX={at:at.slice(),t:Date.now()};
   
  YOU=at.slice();YOU_T=ME_FIX.t;if(youM)try{youM.setLngLat(YOU)}catch(e){}}
 
function meOnFix(){return posMode==='gps'&&!!ME_FIX&&!!ME&&ME[0]===ME_FIX.at[0]&&ME[1]===ME_FIX.at[1]}
 
function liveFix(){
  if(!meOnFix()||Date.now()-ME_FIX.t>GPS_STALE_MS)return null;
  return {at:ME_FIX.at.slice(),t:ME_FIX.t,age:Date.now()-ME_FIX.t}}
 
function meClock(){try{return new Date(ME_FIX.t).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}
  catch(e){return 'time unknown'}}
 
function meIs(){return liveFix()?'you':meOnFix()?'last':posMode==='sim'?'sim':posMode==='away'?'away':'pin'}
 
function meNoun(own){var k=meIs();
  return k==='you'?(own?'your position':'you'):k==='last'?'your last GPS fix ('+meClock()+')':
    {sim:'the simulated position',away:'the planning start',pin:'the start pin'}[k]}
function inRegion(at){var b=BUNDLE.bbox;if(!b)return true;
  return at[0]>=b[0]-0.02&&at[0]<=b[2]+0.02&&at[1]>=b[1]-0.02&&at[1]<=b[3]+0.02}
function classifyFix(at){
  logAct('gps  fix '+at[1].toFixed(5)+','+at[0].toFixed(5));
  if(inRegion(at)){posMode='gps';awayMi=0;bootEase(at);return}
  posMode='away';awayMi=mi(at,CTR);
  show(awayHtml(!!rideMode),'')}
 
function awayHtml(ride){
  return ('<b>You are about '+Math.round(awayMi)+' mi from '+
    (BUNDLE.name||'this region')+'.</b><br>Planning mode — everything except live '+
    'tracking works. <b>Set home</b> (Plan) — an address, a tap on the map — then '+
    'press and hold where you want to go and tap <b>Route here</b>; '+
    '<b>Start here</b> on any pin moves the start pin. Search and elevation work too.'+
    '<br><br>Live tracking and the dispatch card work only inside the region '+
    '— they must never report a position you are not standing at.'+
    (ride?' Press <b>Ride it</b> again once you are back inside it.':''))}
 
var GPS_FIRST_FIX_MS=86400000;
function gpsSlow(e){return !!e&&(e.code==='OS-PLUG-GLOC-0010'||e.code===3)}
 
function gpsWatch(onFix,onFail,firstMs){
  var C=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.Geolocation;
  if(C){var h={drv:'cap',id:null,dead:false};
     
    var w;
     
    try{ w=C.watchPosition({enableHighAccuracy:true,interval:1000,timeout:firstMs},function(pos,err){
      if(h.dead)return;
      if(err||!pos)return onFail&&onFail(err);
      onFix([pos.coords.longitude,pos.coords.latitude],pos.coords.accuracy,
            pos.coords.speed,pos.coords.heading);
    }) }catch(e){ onFail&&onFail(e); return null }
    if(w&&typeof w.then==='function')w.then(function(id){h.id=id;if(h.dead){h.dead=false;gpsClear(h)}})
      .catch(function(e){onFail&&onFail(e)});
    else h.id=w;
    return h}
  if(navigator.geolocation){
    return {drv:'web',dead:false,id:navigator.geolocation.watchPosition(function(pos){
      onFix([pos.coords.longitude,pos.coords.latitude],pos.coords.accuracy,
            pos.coords.speed,pos.coords.heading)},
      function(e){onFail&&onFail(e)},
      {enableHighAccuracy:true,maximumAge:1000,timeout:12000})}}
  return null}
function gpsClear(h){
  if(!h||h.dead)return;h.dead=true;
  if(h.id===null||h.id===undefined)return;    
  var C=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.Geolocation;
  try{if(h.drv==='cap'){if(C)C.clearWatch({id:h.id})}
      else if(navigator.geolocation)navigator.geolocation.clearWatch(h.id)}catch(e){}
  h.id=null}
 
var watchId=null;
function gpsStart(onFix,onFail){
  var h=gpsWatch(onFix,onFail,GPS_FIRST_FIX_MS);
  if(!h)return null;
  watchId=h;return h.drv}
function gpsStop(){
  if(watchId===null)return;
  gpsClear(watchId);watchId=null}
function stopReal(){var had=gotFix,wasRes=RESUMING;
  gpsStop();rideMode=null;posMode=gotFix?'gps':'none';gotFix=false;
   
  RESUMING=false;RESUMED_RIDE=null;
  navStop();tripEnd();runNavClear();
  hudShow(false);
  setChip('c-ride','ride','Ride it');rideFlag();
  var R=rideStop();
   
  if(!R&&!had)return show('<b>Stopped before the first GPS fix</b> \u2014 nothing was recorded'+
    (wasRes?' on this ride. The resumed trip ends here':'')+'.'+
    (crumbs.length>1?(wasRes?' Its ':' The last ')+'track ('+crumbMi.toFixed(2)+
      ' mi) is still on the map; <b>Retrace</b> follows it back.':''),'');
  if(!R)return show('Recording stopped. <b>'+crumbMi.toFixed(2)+
    ' mi</b> on the track. <b>Retrace</b> follows it back.','');
  logAct('ride end '+(R.hrs*60).toFixed(0)+'min '+R.fixes+' fixes');
  var txt=rideReport(R);
  show('<b>Ride recorded — '+crumbMi.toFixed(2)+' mi</b><br>'+
    '<span class="unit">'+(R.hrs*60).toFixed(0)+' min · '+R.fixes+' fixes'+
    (R.medAcc!==null?' · median ±'+Math.round(R.medAcc*3.281)+' ft':'')+
    (R.drops?' · <b>'+R.drops+' GPS dropouts</b>':' · no dropouts')+
    (R.drain!==null?' · '+(R.drain*100).toFixed(1)+'% battery':'')+'</span><br>'+
    '<b>Retrace</b> follows the track back.'+
    '<div style="margin-top:8px"><button class="chip" id="rr-copy">Copy ride report</button> '+
    '<button class="chip" id="rr-share">Share</button></div>','');
  var cp=el('rr-copy');
  if(cp)cp.addEventListener('click',function(){
    var done=function(){cp.textContent='Copied'};
    if(navigator.clipboard&&navigator.clipboard.writeText)
      navigator.clipboard.writeText(txt).then(done,function(){}); else{
      var ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);
      ta.select();try{document.execCommand('copy');done()}catch(e){}document.body.removeChild(ta)}});
  var sh=el('rr-share');
  if(sh)sh.addEventListener('click',function(){
    var S=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.Share;
    if(S)S.share({title:'APEX ride',text:txt}).catch(function(){});
    else if(navigator.share)navigator.share({title:'APEX ride',text:txt}).catch(function(){})})}
function onFix(at,acc,mps,deg){
  FIX_T=Date.now();
  classifyFix(at);
  rideFix(acc);
  if(posMode==='away'){                      
     
    var _rec=gotFix;
    gpsStop();rideMode=null;gotFix=false;
    navStop();hudShow(false);
    setChip('c-ride','ride','Ride it');rideFlag();
    if(_rec){tripEnd();runNavClear();var _R=rideStop();
      if(_R)logAct('ride end (left the region) '+(_R.hrs*60).toFixed(0)+'min '+_R.fixes+' fixes');
       
      show('<b>Ride ended \u2014 you left '+(BUNDLE.name||'the region')+'.</b> <b>'+
        crumbMi.toFixed(2)+' mi</b> recorded; <b>Retrace</b> follows it back.<br><br>'+awayHtml(true),'')}
    paint();return}
   
  var _rs=null;try{_rs=navRiver(at)}catch(e){}
   
  navFollow(at,mps,deg);
   
  try{if(!(NAV.on&&_rs&&navRiverGuide(at,acc,_rs,mps)))navGuide(at,acc,mps)}catch(e){}
   
  if(posMode==='gps')hudSet(mps,deg,at,true);
  if(!gotFix){gotFix=true;startRecording(at);ME=at.slice();mM.setLngLat(ME);meFix(ME);
    if(!NAV.on)map.easeTo({center:ME,zoom:14.5,duration:600});
     
     
    var tk=!TRUCK||(TRUCK[0]===at[0]&&TRUCK[1]===at[1]);
     
    var tkd=tk?0:mi(ME,TRUCK);
    showQuiet('<span class="tn">Recording</span><span class="meta">live GPS</span><br>'+
      (tk?'Truck pinned where you are. Ride.'
       :tkd<0.02?'Trip resumed \u2014 you are at the truck, where it was pinned. Ride.'
       :'Trip resumed \u2014 the truck stays where it was pinned, '+
        navFmt(tkd*1609.34)+' '+compass(bearing(ME,TRUCK))+'. Ride.'),PEEK_LIVE);return}
  ME=at.slice();mM.setLngLat(ME);meFix(ME);record(ME);checkOffRoute();peekGps();
   
  hudPaint();
  fixN++;
  tripSave(fixN===1);
   
  if(!NAV.on&&fixN%6===0)map.easeTo({center:ME,duration:280})}

el('c-ride').addEventListener('click',function(){
  if(rideMode)return stopReal();
  if(riding)return stopRide();
   
  if(last&&sel!==null&&!routeFits(last[sel]))return routeUnfitCard();
   
  railSet(false);
   
  var rr=el('rc-ride');if(rr)rr.hidden=true;
   
  GPS_REFUSED=false;
  var refused=false,onGpsFail=function(e){
    if(gotFix||refused)return;         
     
    if(gpsSlow(e)&&rideMode){gpsStop();var m=gpsStart(onFix,onGpsFail);
      if(m){rideMode=m;logAct('ride gps first fix slow: still waiting');return}}
    refused=true;gpsRefuse('fail')};
  rideMode=gpsStart(onFix,onGpsFail);
  if(rideMode){setChip('c-ride','stop','Stop (GPS)',1);navStart();rideFlag();
     
    var pw=el('peek-txt');if(pw&&/\bfolded\b/.test(el('rail').className))pw.textContent=railPeekText();
    return}
  if(!refused){refused=true;gpsRefuse('none')}});
 
var GPS_REFUSED=false;
function gpsRefuse(why){
  gpsStop();rideMode=null;gotFix=false;GPS_REFUSED=true;
  navStop();hudShow(false);
   
  setChip('c-ride','ride','Ride it');rideFlag();
  logAct('ride refused '+why);
  show(why==='none'
    ?'<b>This phone reports no GPS receiver.</b> Nothing started \u2014 a ride needs a live position.'
    :'<b>No GPS fix</b> \u2014 turn on location and try again. Nothing started.','fail')}
 
el('hud-stop').addEventListener('click',function(){
  if(rideMode||riding)el('c-ride').click()});

function startSim(){
   
  posMode='sim';
  var path=simPath();
  if(!path)return show('Pick a <b>Return home</b> route first, or move the start pin nearer a trail.','fail');
  var pts=[];path.forEach(function(e){pts=pts.concat(decode(GR.g[e.i]))});
   
  if(pts.length&&mi(ME,pts[0])>mi(ME,pts[pts.length-1]))pts.reverse();
  startRecording(pts[0]);ME=pts[0].slice();mM.setLngLat(ME);
  lost=false;var i=0;
  setChip('c-ride','stop','Stop',1);
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
    hudSet(null,null,ME);
    if(i%6===0)map.easeTo({center:ME,duration:280})},170);
  rideFlag()}

 
var LYRGROUPS=[
  {k:'places', h:'Places',      s:'campgrounds, fuel, launches, trailheads',
    
   ids:['poi-dot','poi-dot-major','poi-stack-bg','poi-stack']},
  {k:'water',  h:'Lakes & rivers', s:'water and its names',
   ids:['water','wway','lbl-lake','lbl-stream']},
  {k:'contour',h:'Contours',    s:'40 ft, labelled every 200 ft',
   ids:['cont-line','cont-index','cont-label']},
  {k:'peaks',  h:'Named hills', s:'summits with their height',
   ids:['peak-dot','peak-label']},
  {k:'areas',  h:'Riding areas', s:'DNR scramble areas \u2014 ride anywhere inside',
   ids:['area-fill','area-line','area-label']},
  {k:'county', h:'County lines', s:'83 counties, named at regional zoom',
   ids:['county-line','county-label']},
  {k:'public', h:'Public land', s:'DNR state forest, game areas, parks — 4.7M acres',
   ids:['pub-fill','pub-line','pub-label']},
  {k:'forest', h:'National forests', s:'Ottawa, Hiawatha, Huron-Manistee — dispersed camping allowed',
   ids:['nf-fill','nf-line','nf-label']},
  {k:'paddle', h:'Rivers & paddling', s:'runs, launches, campgrounds and dams',
   ids:['pad-case','pad-line','pad-dot','pad-lbl','pad-dam','pad-damlbl']},
  {k:'relief', h:'Relief',      s:'hillshade', ids:['hillshade']},
   
  {k:'labels', h:'Map text',    s:'names and numbers', ids:null, txt:true}
];

function lyrOn(g){
  if(g.txt)return !TXT_OFF;
  var ids=(g.ids||labelLayers()).concat(g.with||[]);
  for(var i=0;i<ids.length;i++){
    try{if(map.getLayer(ids[i])&&
        map.getLayoutProperty(ids[i],'visibility')!=='none')return true}catch(e){}}
  return false}

function lyrSet(g,on){
  if(g.txt){textSet(on);var l0=el('c-labels');if(l0)l0.className='chip'+(on?' on':'');return}
  var ids=(g.ids||labelLayers()).concat(g.with||[]);
  ids.forEach(function(id){
    try{if(map.getLayer(id))map.setLayoutProperty(id,'visibility',on?'visible':'none')}catch(e){}});
   
  if(on&&g.k==='relief'){
    try{map.setPaintProperty('hillshade','raster-opacity',
      BASEMAPS[bmi]==='Map'?0.42:0.16)}catch(e){}}
  var c=el('c-relief');
  if(c&&g.k==='relief')c.className='chip'+(on?' on':'');
  var l=el('c-labels');
  if(l&&g.k==='labels')l.className='chip'+(on?' on':'')}

function buildLyrPanel(){
  var p=el('lyrpanel'),h='<div class="sect">Basemap</div>';
  BASEMAPS.forEach(function(nm,i){
    var sel=(i===bmi),dis=(i>0&&!SAT_OK);
    h+='<button class="actrow'+(sel?' on':'')+'" data-bm="'+i+'"'+
       (dis?' disabled':'')+'>'+
       '<span class="sw" style="background-color:'+(i===0?'var(--map-ground)':'var(--sw-hybrid)')+'"></span>'+
       '<span>'+nm+(dis?' — not in this bundle':'')+'</span></button>'});
  h+='<div class="sect">Layers</div>';
  LYRGROUPS.forEach(function(g,i){
    var on=lyrOn(g);
     
    h+='<button class="actrow'+(on?' on':'')+'" data-lg="'+i+'">'+
       '<span class="sw" style="background-color:'+(on?'var(--sel)':'transparent')+
       ';border:1px solid var(--sw-edge)"></span>'+
       '<span>'+g.h+(g.txt?'<span class="rsub">Names and numbers on the map. Pins and the count on a stack stay \u2014 choose pins under Pins in '+
       modeOf(mode).h+'.</span>':'')+'</span></button>'});
   
  var pm=modeOf(mode);
  h+='<div class="sect">Pins in '+pm.h+'</div>';
  var rowsH='',drawn=0,shp={},kin={};
  (pm.kinds||[]).forEach(function(k){
     
    var kd=POIKIND[k]||{h:k,c:'var(--pin-unknown)'},on=pinsOn(pm,k),u=badgeURL('bdg-'+k);
    if(u){drawn++;shp[kd.s]=1;kin[k]=1}
    rowsH+='<button class="actrow'+(on?' on':'')+'" data-pk="'+k+'">'+
       (u?'<span class="sw pb"><img class="pbdg" src="'+u+'" alt=""></span>':
       '<span class="sw" style="background-color:'+(on?kd.c:'transparent')+';border:1px solid var(--sw-edge)"></span>')+
       '<span>'+kd.h+'</span></button>'});
   
  var fam=BADGE_FAMILY.filter(function(f){return f.s?shp[f.s]:kin[f.k]}).map(function(f){return f.w});
  if(drawn&&drawn===(pm.kinds||[]).length&&fam.length)
    h+='<div class="pnote">Each badge is the one the map draws. Shapes by family: '+fam.join(', ')+'.</div>';
  h+=rowsH;
  h+='<button class="actrow" data-pkreset="1"><span class="sw" style="background-color:transparent"></span><span>Reset to '+pm.h+' defaults</span></button>';
   
   
  h+='<div class="lyrfoot"><button class="act" data-lyrdone="1">Done</button></div>';
  p.innerHTML=h;
  var dn=p.querySelector('[data-lyrdone]');
  if(dn)dn.addEventListener('click',function(){p.hidden=true;logAct('tap  layers done')});
  Array.prototype.forEach.call(p.querySelectorAll('[data-bm]'),function(b){
    b.addEventListener('click',function(){
      if(b.disabled)return;
      setBasemap(+b.dataset.bm);logAct('act  basemap '+BASEMAPS[bmi]);
      buildLyrPanel()})});
  Array.prototype.forEach.call(p.querySelectorAll('[data-lg]'),function(b){
    b.addEventListener('click',function(){
      var g=LYRGROUPS[+b.dataset.lg],on=!lyrOn(g);
      lyrSet(g,on);logAct('act  layer '+g.k+' '+(on?'on':'off'));
      buildLyrPanel()})});
  Array.prototype.forEach.call(p.querySelectorAll('[data-pk]'),function(b){
    b.addEventListener('click',function(){
      var k=b.dataset.pk,m=modeOf(mode);pinsSet(m.k,k,!pinsOn(m,k));buildLyrPanel()})});
  var rs=p.querySelector('[data-pkreset]');
  if(rs)rs.addEventListener('click',function(){pinsReset(modeOf(mode).k);buildLyrPanel()})}

 
el('c-base').addEventListener('click',function(){setBasemap(bmi+1)});
 
function hdChipTxt(t){var e=el('c-hd');if(e)e.querySelector('span').textContent=t}
function hdChip(){HD.stats().then(function(st){
  if(!HDDL.busy())hdChipTxt(st.tiles?('HD · '+(st.bytes/1048576).toFixed(0)+' MB'):'HD');
  var e=el('c-hd');if(e)e.className='basebtn'+(st.tiles?' on':'')}).catch(function(){})}
function refreshSat(){try{var sc=(map.style.sourceCaches||{})['satpatch'];
  if(sc){sc.clearTiles();map.triggerRepaint()}}catch(e){}}
function startHDSave(tiles,label){
  hdChipTxt('HD 0%');
  HDDL.save(tiles,function(d,t){hdChipTxt('HD '+Math.round(d/Math.max(1,t)*100)+'%')},label)
    .then(function(r){hdChip();refreshSat();
      if(r&&r.error)show('<b>HD imagery</b><div class="sub">Download stopped: '+r.error+
        '. Tiles already saved are kept — run the same save again and it continues where it left off.</div>');})}
 
function hdTiers(){
  var v=map.getBounds(),b=[v.getWest(),v.getSouth(),v.getEast(),v.getNorth()];
  var c=map.getCenter(),co=countyObjAt([c.lng,c.lat]);
  var t=[{id:'view',label:'this view',name:'THIS VIEW',tiles:HDDL.plan(b),btn:'Save HD for this view'}];
  if(co)t.push({id:'county',label:co.n+' County',name:co.n.toUpperCase()+' COUNTY',
    tiles:HDDL.planPoly(co.r,13,15),btn:'Save HD for '+co.n+' County'});
  if(typeof CTX!=='undefined'&&CTX&&CTX.rings)t.push({id:'state',label:'the whole state',
    name:'THE WHOLE STATE',tiles:HDDL.statePlan(),btn:'Save the whole state',confirm:true,
    note:'one level sharper than the built-in map, everywhere'});
  for(var i=0;i<t.length;i++){t[i].n=t[i].tiles.length;t[i].mb=HDDL.estimate(t[i].tiles)/1048576}
  return t}
function hdMB(mb){return mb<1?'under 1 MB':'about '+Math.round(mb)+' MB'}
 
function hdCard(confirmId){
  var conf=typeof confirmId==='string'?confirmId:null;
  var tiers=hdTiers(),pr=HDDL.progress();
  Promise.all([HD.stats(),HDDL.quota()]).then(function(res){
    var st=res[0],q=res[1],busy=HDDL.busy();
    var h='<b>HD imagery</b>'+
      '<div class="sub">Sharper satellite for places you choose. Nothing downloads on its own.</div>';
    if(pr){
      var left=pr.eta==null?'':(pr.eta<60?' · under a minute left':' · about '+Math.ceil(pr.eta/60)+' min left');
      h+='<div class="k">DOWNLOADING '+String(pr.label).toUpperCase()+'</div><div class="sub">'+
        (pr.done+pr.skipped).toLocaleString()+' of '+pr.total.toLocaleString()+' tiles'+left+
        (WAKE.active()?' · the screen stays on until it finishes':'')+'</div>'+
        '<button class="chip" id="hd-stop">'+ic('stopdl')+'<span>Stop downloading</span></button>'}
    for(var i=0;i<tiers.length;i++){
      var t=tiers[i],big=t.id==='view'&&t.mb>500,fits=!q.known||q.free>=t.mb*1048576*1.2;
      h+='<div class="k">'+t.name+'</div><div class="sub">'+(t.n?t.n.toLocaleString()+' tiles · '+hdMB(t.mb)+
        (t.note?' · '+t.note:'')+(big?' — zoom in to a smaller area to save':''):'already sharp here — built in or saved, nothing to download')+'</div>';
      if(busy||big||!t.n)continue;
      if(!fits){h+='<div class="sub">Not enough space: needs '+hdMB(t.mb*1.2)+', the phone allows '+
        hdMB(q.free/1048576)+'</div>';continue}
      if(t.confirm&&conf===t.id){
        h+='<div class="sub">'+hdMB(t.mb)+' and '+t.n.toLocaleString()+' tiles. The screen stays on until it finishes; Stop keeps what landed.</div>'+
          '<button class="chip" id="hd-go-'+t.id+'">'+ic('hd')+'<span>Yes, save the whole state</span></button>'+
          '<button class="chip" id="hd-no">'+ic('close')+'<span>Not now</span></button>'}
      else h+='<button class="chip" id="hd-'+(t.confirm?'ask-':'go-')+t.id+'">'+ic('hd')+'<span>'+t.btn+'</span></button>'}
    if(!q.known)h+='<div class="sub">This phone does not say how much space it allows — a save stops itself if space runs out, and keeps what landed.</div>';
    h+='<div class="k">SAVED ON THIS PHONE</div><div class="sub">'+st.tiles.toLocaleString()+
        ' tiles · '+(st.bytes/1048576).toFixed(1)+' MB</div>'+
      (st.tiles?'<button class="chip" id="hd-del">'+ic('del')+'<span>Delete all saved HD</span></button>':'');
    show(h);
    tiers.forEach(function(t){
      var g=el('hd-go-'+t.id);if(g)g.addEventListener('click',function(){startHDSave(t.tiles,t.label);hdCard()});
      var a=el('hd-ask-'+t.id);if(a)a.addEventListener('click',function(){hdCard(t.id)})});
    var no=el('hd-no');if(no)no.addEventListener('click',function(){hdCard()});
    var o=el('hd-stop');if(o)o.addEventListener('click',function(){HDDL.stop()});
    var d=el('hd-del');if(d)d.addEventListener('click',function(){
       
      HDDL.stop();
      setTimeout(function(){HD.clear().then(function(){refreshSat();hdChip();hdCard()})},350)});
  })}
el('c-hd').addEventListener('click',hdCard);
el('c-hdmanage').addEventListener('click',hdCard);
 
var SOURCES=[
  ['Michigan DNR','Trail designations, closures, state land, boating access',
   'https://www.michigan.gov/dnr'],
  ['Michigan DNR open data','The GIS layers this app ingests',
   'https://gis-midnr.opendata.arcgis.com'],
  ['U.S. Forest Service','National forest roads and trails',
   'https://data.fs.usda.gov/geodata/'],
  ['U.S. Geological Survey','Satellite imagery and elevation',
   'https://apps.nationalmap.gov/downloader/'],
  ['USGS Water Services','Live river gauge readings',
   'https://waterdata.usgs.gov'],
  ['OpenStreetMap contributors','Roads, places and context, under ODbL',
   'https://www.openstreetmap.org/copyright']];
 
var PRIVACY_URL='https://sergeantcs2.github.io/apex-orv/privacy.html';
function sourcesCard(){
  logAct('tap  data sources');
  show('<b>Where the data comes from</b>'+
    '<div class="sub">APEX ORV is an <b>independent app</b>. It is not '+
    'affiliated with, endorsed by, or acting on behalf of the State of '+
    'Michigan, the Michigan Department of Natural Resources, the U.S. Forest '+
    'Service, the U.S. Geological Survey, or any other government agency.</div>'+
    '<div class="k">OFFICIAL SOURCES</div>'+
    '<div class="sub">These agencies are the authority; this app is a '+
    'convenience. Check the official source, and the signs on the ground, '+
    'before you ride.</div>'+
    '<div class="sub">'+SOURCES.map(function(r){
      return '<b>'+r[0]+'</b><br>'+r[1]+'<br><a href="'+r[2]+
        '" target="_blank" rel="noopener" style="color:var(--link)">'+r[2]+'</a>'
      }).join('<br><br>')+'</div>'+
     
    '<div class="k">SOFTWARE AND TYPE</div><div class="sub"><b>Icons</b> \u2014 Lucide '+LUCIDE_V+
    ', ISC licence, \u00a9 Lucide Icons and Contributors; icons derived from Feather under '+
    'the MIT licence, \u00a9 2013-present Cole Bemis.<br><b>Typeface</b> \u2014 Barlow and '+
    'Barlow Condensed 1.408, SIL Open Font License 1.1, '+
    '\u00a9 2017 The Barlow Project Authors.<br><b>Map renderer</b> \u2014 MapLibre GL JS'+
     
    (window.maplibregl&&typeof maplibregl.getVersion==='function'?' '+maplibregl.getVersion():'')+
    ', <span class="nobr">BSD 3-Clause</span> licence, \u00a9 2023 MapLibre contributors; it contains code from Mapbox GL JS '+
    '(<span class="nobr">BSD 3-Clause</span>, \u00a9 2020 Mapbox), glfx.js (MIT, \u00a9 2011 Evan Wallace) and d3-color '+
    '(<span class="nobr">BSD 3-Clause</span>, \u00a9 2010-2016 Mike Bostock).<br><b>App runtime</b> \u2014 Capacitor 8 with its '+
    'Device, Geolocation, Haptics and Share plugins, MIT licence, \u00a9 2017-present Drifty Co.; '+
    'the plugins \u00a9 2020-present Ionic (Geolocation \u00a9 2025 Ionic).'+
    '<br>The full licence texts are included in the app package.</div>'+
    (PRIVACY_URL?'<div class="k">PRIVACY</div><div class="sub"><a href="'+PRIVACY_URL+'" target="_blank" rel="noopener" style="color:var(--link)">Privacy policy</a> — '+
      'nothing you do in this app is sent anywhere; the policy says so in full.</div>':'')+
    '<div class="sub">Links open in your browser and need a connection. '+
    'The map itself does not.</div>','');
}
el('c-sources').addEventListener('click',sourcesCard);
if(!SPARSE){el('c-hd').style.display='none';var _hm=el('c-hdmanage');if(_hm)_hm.style.display='none'}
else hdChip();
 
function buildModePanel(){
  var p=el('modepanel');
  p.innerHTML=MODES.map(function(m){
    return '<button class="moderow'+(m.k===mode?' on':'')+'" data-mode="'+m.k+'">'+
      '<span>'+m.h+'</span><span class="msub">'+m.s+'</span></button>'}).join('');
  Array.prototype.forEach.call(p.querySelectorAll('[data-mode]'),function(b){
    b.addEventListener('click',function(){
      applyMode(b.dataset.mode);p.hidden=true;logAct('tap','mode '+b.dataset.mode)})})}
el('c-mode').addEventListener('click',function(){
  var p=el('modepanel');buildModePanel();p.hidden=!p.hidden;
  try{el('actpanel').hidden=true;el('lyrpanel').hidden=true}catch(e){}});

 
 
var PICKERS=['modepanel','actpanel','lyrpanel'];
var PANELS=PICKERS.concat(['diagpanel','cmppanel']);
var PANEL_CHIP={modepanel:'c-mode',actpanel:'c-act',lyrpanel:'c-layers',diagpanel:'c-diag',cmppanel:'c-compass'};
function panelOpen(list){list=list||PANELS;for(var i=0;i<list.length;i++){var p=el(list[i]);if(p&&!p.hidden)return list[i]}return null}
function panelsClose(list){list=list||PANELS;var n=0;list.forEach(function(id){var p=el(id);if(p&&!p.hidden){p.hidden=true;n++;
  if(id==='cmppanel')CMP_ON=false}});
  if(n){stripH();ridePublish()}    
  return n}
function within(t,node){while(t){if(t===node)return true;t=t.parentNode}return false}
try{document.addEventListener('click',function(e){
  if(!panelOpen(PICKERS))return;
  var t=e.target;if(!t)return;
  for(var i=0;i<PICKERS.length;i++){var p=el(PICKERS[i]);if(p&&within(t,p))return}
  for(var k in PANEL_CHIP){var c=el(PANEL_CHIP[k]);if(c&&within(t,c))return}
  panelsClose(PICKERS);logAct('tap  outside — pickers closed')},true)}catch(e){}

var BACK={armed:false,t:null,toast:null};
function toast(msg,ms){var t=el('toast');if(!t)return;stripH();t.textContent=msg;t.hidden=false;
  clearTimeout(BACK.toast);BACK.toast=setTimeout(function(){t.hidden=true},ms||2000)}
function backPush(){try{if(!history.state||!history.state.apex)history.pushState({apex:1},'')}catch(e){}}
 
function backOpen(){
  if(TOUR.on)return 'tour';
  if(panelOpen())return 'panel';
  var g=el('guide');if(g&&!g.hidden)return 'guide';
  var sr=el('srch');if(sr&&String(sr.className).indexOf('on')>=0)return 'search';
  var r=el('rail');if(r&&r.className!=='folded')return 'rail';
  return null}
function backClose(w){
  if(w==='tour')return tourClose('notnow');
  if(w==='panel')return panelsClose();
  if(w==='guide')return guideClose(true);
  if(w==='search'){el('srch').className='';el('c-search').className='chip';return}
  if(w==='rail'){RAIL_MANUAL=true;railSet(false)}}
function onBack(){
  var w=backOpen();
  if(w){backClose(w);backPush();logAct('back closed '+w);return 'closed:'+w}
  if(BACK.armed){BACK.armed=false;clearTimeout(BACK.t);logAct('back exit');return 'exit'}
  BACK.armed=true;toast('Back again to exit',2000);
  clearTimeout(BACK.t);BACK.t=setTimeout(function(){BACK.armed=false;backPush()},2000);
  logAct('back armed');return 'armed'}
try{window.addEventListener('popstate',function(){onBack()});backPush()}catch(e){}
 
function stripH(){attribLift();try{var t=el('tools');if(t){var h=t.offsetHeight;
   
  var up=stripAttribUp();if(up>0)h+=up;
  document.documentElement.style.setProperty('--strip-h',h+'px')}}catch(e){}
  if(CMP_ON)cmpFit();
   
  try{var d=el('tools'),r=d&&d.getBoundingClientRect?d.getBoundingClientRect():null,
    vh=window.innerHeight||document.documentElement.clientHeight;
    if(r&&r.height>0&&isFinite(vh-r.top))document.documentElement.style
      .setProperty('--dock-h',Math.max(0,Math.round(vh-r.top+Math.max(0,stripAttribUp())))+'px')}catch(e){}}
 
function attribLift(){try{
  var a=document.querySelector('.maplibregl-ctrl-bottom-right .maplibregl-ctrl-attrib'),t=el('tools'),de=document.documentElement;
  if(!a||!t||!a.getBoundingClientRect||!t.querySelectorAll)return;
  var L=parseFloat(de.style.getPropertyValue('--attrib-lift'))||0,ar=a.getBoundingClientRect(),G=8,hit=false;
  if(!(ar.height>0)){if(L)de.style.removeProperty('--attrib-lift');return}
  var top=ar.top+L,bot=ar.bottom+L;
  Array.prototype.forEach.call(t.querySelectorAll('.chip'),function(c){var r=c.getBoundingClientRect();
    if(r.width>0&&r.height>0&&r.left<ar.right+G&&r.right>ar.left-G&&r.top<bot+G&&r.bottom>top-G)hit=true});
  var tr=t.getBoundingClientRect(),w=hit?Math.max(0,Math.ceil(bot-tr.top+G)):0;
  if(w!==L){if(w)de.style.setProperty('--attrib-lift',w+'px');else de.style.removeProperty('--attrib-lift')}}catch(e){}}
 
function stripAttribUp(){try{var t=el('tools'),a=document.querySelector('.maplibregl-ctrl-bottom-right');
  if(!t||!a||!t.getBoundingClientRect||!a.getBoundingClientRect)return 0;
  var tr=t.getBoundingClientRect(),ar=a.getBoundingClientRect();
  return (ar.height>0&&tr.height>0&&ar.top<tr.top)?Math.round(tr.top-ar.top):0}catch(e){return 0}}
stripH();setTimeout(stripH,600);
try{window.addEventListener('resize',stripH)}catch(e){}    
 
try{window.addEventListener('resize',ridePublish)}catch(e){}
 
try{el('rail').addEventListener('transitionend',ridePublish)}catch(e){}
try{el('rail').addEventListener('transitionend',stripH)}catch(e){}
 
var TAB='map';
function showTab(t){
  TAB=t;
   
  if(arm&&arm!=='homeaddr'){arm=null;syncArm()}
  Array.prototype.forEach.call(document.querySelectorAll('.chip[data-tab]'),function(c){
    c.hidden=(c.dataset.tab!==t)});
  Array.prototype.forEach.call(document.querySelectorAll('#tabs .tab'),function(b){
     
    b.className='tab'+(b.dataset.go===t?' on':'')});
   
  var dp=el('diagpanel'); if(dp&&t!=='tools')dp.hidden=true;
  var cp=el('cmppanel'); if(cp&&t!=='tools'){cp.hidden=true;CMP_ON=false}
  var lp=el('lyrpanel'); if(lp&&t!=='map')lp.hidden=true;
  var ap=el('actpanel'); if(ap&&t!=='map')ap.hidden=true;
   
  simChip();stripH();ridePublish();
  logAct('tap  tab '+t)}

Array.prototype.forEach.call(document.querySelectorAll('#tabs .tab'),function(b){
  b.addEventListener('click',function(){showTab(b.dataset.go)})});

el('c-howto').addEventListener('click',function(){guideShow()});
el('c-tour').addEventListener('click',function(){logAct('tap  c-tour');tourStart()});
el('guide-go').addEventListener('click',function(){guideClose(true)});
 
el('guide').addEventListener('click',function(e){
  if(e.target===el('guide'))guideClose(true)});

el('c-compass').addEventListener('click',function(){
  var p=el('cmppanel');CMP_ON=p.hidden;p.hidden=!p.hidden;
  if(CMP_ON){magStart();el('diagpanel').hidden=true;cmpPaint()}
   
  stripH();ridePublish();cmpFit();
  logAct('tap  c-compass')});

 
el('c-markme').addEventListener('click',function(){
  if(!ME)return show('<b>No position yet.</b> Wait for a fix, or long-press the '+
    'map to mark a spot by hand.','fail');
  var nm=wpName(ME);
  if(!wpAdd({n:nm,p:ME.slice(),r:BUNDLE.region||null,ts:Date.now()}))
    return show('<b>Could not save.</b> This phone would not let the app store '+
      'it \u2014 its storage may be full or blocked.','fail');
  logAct('act  marked this spot '+nm);
  wpDraw();
  show('Marked <b>'+nm+'</b>.<br><span class="sub">On this phone only. '+
    'Find it again under <b>Saved</b> on the Plan tab.</span>','pass')});

el('peek').addEventListener('click',function(){
  var folded=el('rail').className==='folded';
  RAIL_MANUAL=!folded;               
  railSet(folded);
  logAct('tap  rail '+(folded?'open':'fold'))});

el('c-diag').addEventListener('click',function(){
  var p=el('diagpanel');p.hidden=!p.hidden;stripH();ridePublish();logAct('tap  c-diag')});

el('c-layers').addEventListener('click',function(){
  var p=el('lyrpanel');buildLyrPanel();p.hidden=!p.hidden;
  if(!p.hidden){el('actpanel').hidden=true;try{el('modepanel').hidden=true}catch(e){}}
  logAct('tap  c-layers')});
el('c-act').addEventListener('click',function(){
  var p=el('actpanel');buildActPanel();p.hidden=!p.hidden;
  if(!p.hidden)try{el('modepanel').hidden=true;el('lyrpanel').hidden=true}catch(e){}});
el('c-about').addEventListener('click',function(){show(ABOUT,'')});
 
function labelLayers(){
  try{
    return map.getStyle().layers.filter(function(l){return l.type==='symbol'})
              .map(function(l){return l.id})
  }catch(e){return []}}
 
var TXT_KEEP=/^(poi-stack|peak-dot)$/,TXT_PLATE=/^lbl-shield$/,TXT_OFF=false,TXT_MEMO=null;
function textLayers(){
  var ls=[];try{ls=map.getStyle().layers||[]}catch(e){}
  var sym={};labelLayers().forEach(function(id){sym[id]=1});
  return ls.filter(function(l){return sym[l.id]&&l.layout&&
    l.layout['text-field']!==undefined&&!TXT_KEEP.test(l.id)}).map(function(l){return l.id})}
function textSet(on){
  var ids=textLayers();
  if(!TXT_MEMO){TXT_MEMO={};ids.forEach(function(id){try{
    TXT_MEMO[id]={tf:map.getLayoutProperty(id,'text-field'),
      io:TXT_PLATE.test(id)?map.getPaintProperty(id,'icon-opacity'):undefined}}catch(e){}})}
  ids.forEach(function(id){var mm=TXT_MEMO[id];if(!mm)return;
    try{map.setLayoutProperty(id,'text-field',on?mm.tf:'');
      if(TXT_PLATE.test(id))map.setPaintProperty(id,'icon-opacity',on?mm.io:0)}catch(e){}});
  TXT_OFF=!on}
var glErr=null;
map.on('error',function(e){var m=(e&&e.error&&e.error.message)||String(e&&e.error||'');
  if(m&&!glErr){glErr=m;try{window.__mapErr=m}catch(_){}renderHealth()}});
function renderedCount(){try{return map.queryRenderedFeatures().length}catch(e){return -1}}
var healthTries=0,healthOK=false;
function renderHealth(){
   
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
    '<br><br>The Self-test (Tools, then Diagnostics) records what the map engine said, and its Copy report carries it.','fail')}
 
function drawCoverage(){
  if(!CTX||!CTX.rings)return;
   
  var feats=CTX.rings.map(function(r){
    var ring=r.slice();
    if(ring[0][0]!==ring[ring.length-1][0]||ring[0][1]!==ring[ring.length-1][1])ring.push(ring[0]);
    return {type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[ring]}}});
  try{map.getSource('state').setData({type:'FeatureCollection',features:feats})}catch(e){}
  var labs=(CTX.labels||[]).map(function(l){
    return {type:'Feature',properties:{n:l.n},geometry:{type:'Point',coordinates:l.at}}});
  try{map.getSource('lakes').setData({type:'FeatureCollection',features:labs})}catch(e){}
   
  var cl=[],cp=[];
  (CTX.counties||[]).forEach(function(co){
    (co.r||[]).forEach(function(r){
      var ring=r.slice();
      if(ring[0][0]!==ring[ring.length-1][0]||ring[0][1]!==ring[ring.length-1][1])ring.push(ring[0]);
      cl.push({type:'Feature',properties:{n:co.n},geometry:{type:'LineString',coordinates:ring}})});
    var big=(co.r||[]).slice().sort(function(a,b){return b.length-a.length})[0];
    if(big&&big.length){var sx=0,sy=0;big.forEach(function(q){sx+=q[0];sy+=q[1]});
      cp.push({type:'Feature',properties:{n:co.n},geometry:{type:'Point',coordinates:[sx/big.length,sy/big.length]}})}});
  try{map.getSource('county').setData({type:'FeatureCollection',features:cl});
      map.getSource('countylbl').setData({type:'FeatureCollection',features:cp})}catch(e){}}
 
 
var BUSY=(function(){
  var el,armed=false,timer=null,ceil=null;
  function grab(){if(!el)el=document.getElementById('busy');return el}
  function hide(){armed=false;clearTimeout(timer);clearTimeout(ceil);
    if(grab())el.className=''}
  function show(){if(grab())el.className='on'}
  return {begin:function(){
      clearTimeout(timer);clearTimeout(ceil);armed=true;
      timer=setTimeout(function(){if(armed)show()},200);
      ceil=setTimeout(function(){hide()},15000);
      try{map.once('idle',function(){if(armed)setTimeout(hide,120)})}catch(e){hide()}},
    hide:hide,
    on:function(){return !!(grab()&&el.className==='on')},
    armed:function(){return armed}}})();
map.on('load',function(){SPL.style();
  setTimeout(function(){SPL.lift()},2600)});
map.on('idle',function(){SPL.ready()});
setTimeout(function(){SPL.lift()},20000);
setTimeout(function(){try{var s2=document.getElementById('shell');
  if(s2&&s2.className.indexOf('ready')<0)s2.className+=' ready'}catch(e){}},8000);
map.on('load',drawCoverage);
 
map.on('load',function(){setTimeout(function(){try{tripResumeCard()}catch(e){}},3200)});
 
map.on('load',applyMachine);
 
map.on('load',function(){var k='ride';
  try{k=localStorage.getItem('apex.mode')||'ride'}catch(e){}
  applyMode(k,{silent:true})});

 
function flyToYou(){
   
  var lf=liveFix();
  if(lf){YOU=lf.at;YOU_T=lf.t;if(youM)youM.setLngLat(YOU)}
  if(YOU&&!(Date.now()-YOU_T<=GPS_STALE_MS))return false;
  if(YOU){
    var far=!inRegion(YOU);
    map.easeTo({center:YOU,zoom:far?7.2:14.5,duration:900,essential:true});
    show(far?'<b>You are here</b> — about '+Math.round(awayMi)+' mi from '+
      (BUNDLE.name||'the region')+'. The dashed box is what you have downloaded; '+
      'tap it or a chip to jump there.':
      '<b>You are here.</b> Inside the downloaded area.','');
    return true}
  return false}

 
 
function addrDecode(){
  if(!ADDR||!ADDR.f||ADDR.segs)return;
  var f=ADDR.f,n=ADDR.n,p=ADDR.p||100000,zips=ADDR.zips||[],segs=new Array(n);
  var pn=0,px=0,py=0,k=0;
  for(var i=0;i<n;i++){
    var nm=pn+f[k],x1=px+f[k+1],y1=py+f[k+2],x2=x1+f[k+3],y2=y1+f[k+4];
    segs[i]=[nm,x1/p,y1/p,x2/p,y2/p,f[k+5],f[k+5]+f[k+6],f[k+7],f[k+7]+f[k+8],zips[f[k+9]]];
    pn=nm;px=x1;py=y1;k+=10}
  ADDR.segs=segs;ADDR.f=null}
try{addrDecode()}catch(e){}
 
var AGRID=null;
function addrGrid(){
  if(AGRID)return AGRID;
  var m=new Map(),S=ADDR.segs;
  for(var i=0;i<S.length;i++){var g=S[i];
    var c=gcell([(g[1]+g[3])/2,(g[2]+g[4])/2]),kk=gkey(c[0],c[1]);
    var a=m.get(kk);if(a)a.push(i);else m.set(kk,[i])}
  AGRID=m;return m}
var ADDR_CAP=0.09;                  
 
var ADDR_NEAR=0.55;                 

function segNear(at,a,b){
   
  var kx=Math.cos(at[1]*Math.PI/180)*69.172, ky=69.172;
  var ax=(a[0]-at[0])*kx, ay=(a[1]-at[1])*ky,
      bx=(b[0]-at[0])*kx, by=(b[1]-at[1])*ky;
  var dx=bx-ax, dy=by-ay, L=dx*dx+dy*dy;
  var t=L>0?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/L)):0;
  var px=ax+t*dx, py=ay+t*dy;
  return {d:Math.sqrt(px*px+py*py), t:t, px:px, py:py, side:(dx*(-ay)-dy*(-ax))>0?'L':'R'}}

 
 
function inRings(x,y,rings){
  for(var r=0;r<rings.length;r++){
    var ring=rings[r],inside=false;
    for(var i=0,j=ring.length-1;i<ring.length;j=i++){
      var xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1];
      if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/((yj-yi)||1e-12)+xi))inside=!inside}
    if(inside)return true}
  return false}
function countyObjAt(at){
  if(!CTX||!CTX.counties)return null;
  for(var c=0;c<CTX.counties.length;c++)
    if(inRings(at[0],at[1],CTX.counties[c].r))return CTX.counties[c];
  return null}
function countyAt(at){var co=countyObjAt(at);return co?co.n:null}

function addressAt(at,wide){
  if(!ADDR||!ADDR.segs)return null;
  var S=ADDR.segs,best=null,bd=wide?ADDR_NEAR:ADDR_CAP;
   
  var G=addrGrid(),c=gcell(at),reach=Math.ceil(bd/(GCS*0.714*69))+2;
  for(var dx=-reach;dx<=reach;dx++)for(var dy=-reach;dy<=reach;dy++){
    var list=G.get(gkey(c[0]+dx,c[1]+dy));if(!list)continue;
    for(var j=0;j<list.length;j++){var g=S[list[j]];
      var r=segNear(at,[g[1],g[2]],[g[3],g[4]]);
      if(r.d<bd){bd=r.d;best={g:g,r:r}}}}
  if(!best)return null;
  var g=best.g,r=best.r;
  var f=r.side==='L'?g[5]:g[7], t=r.side==='L'?g[6]:g[8];
  if(!f&&!t){f=r.side==='L'?g[7]:g[5];t=r.side==='L'?g[8]:g[6]}
  if(!f&&!t)return null;
  var n=Math.round(f+(t-f)*r.t);
   
  if(f%2!==n%2)n+=(n>f?-1:1);
  var txt=n+' '+ADDR.names[g[0]]+(g[9]?', '+g[9]:'');
  var out={n:n,street:ADDR.names[g[0]],zip:g[9]||0,d:bd,txt:txt,near:false};
  if(bd>ADDR_CAP){
     
    var c=compass((Math.atan2(-r.px,-r.py)*180/Math.PI+360)%360);
    out.near=true;
    out.txt=(bd<0.1?Math.round(bd*5280)+' ft':bd.toFixed(1)+' mi')+' '+c+' of '+txt}
  return out}

function geocode(q){
   
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

 
var dropM=null,DROP=null;

function bearingTo(a,b){
  var y=Math.sin((b[0]-a[0])*Math.PI/180)*Math.cos(b[1]*Math.PI/180),
      x=Math.cos(a[1]*Math.PI/180)*Math.sin(b[1]*Math.PI/180)-
        Math.sin(a[1]*Math.PI/180)*Math.cos(b[1]*Math.PI/180)*Math.cos((b[0]-a[0])*Math.PI/180);
  var d=(Math.atan2(y,x)*180/Math.PI+360)%360;
  var C=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return {deg:Math.round(d),pt:C[Math.round(d/22.5)%16]}}

function nearestEdgeTo(at){
   
  var r=nearestEdge(at);
  return r.e?{e:r.e,mi:r.d}:null}

function placeCard(at,kind,title){
  var e=elevAt(at),ne=nearestEdgeTo(at),b=bearingTo(ME,at),d=mi(ME,at);
  var rows=[];
   
  rows.push('<span class="tn">'+(kind==='wpt'?ic('spot'):'')+title+'</span>');
  rows.push('<span class="mono" style="font-size:var(--t-lg)">'+at[1].toFixed(5)+' '+
    at[0].toFixed(5)+'</span> <span class="unit">DD'+
    (e!==null?' · '+ft(e)+' ft':'')+'</span>');
   
  if(kind!=='me')rows.push('<span class="unit">'+d.toFixed(2)+' mi '+b.pt+
    ' ('+b.deg+'°) from '+meNoun(true)+'</span>');
  var ad=addressAt(at)||addressAt(at,true);
  if(ad)rows.push('<span style="color:var(--text-1)">'+ad.txt+'</span>');
  if(ne)rows.push('<span class="unit">nearest: '+(ne.e.n||label(ne.e.c))+
    (ne.e.id?' · '+ne.e.id:'')+' — '+ne.mi.toFixed(2)+' mi</span>');
  var acts=[];
   
  var prime=kind!=='me'?'<div id="pcprime"><button class="chip primary" id="pc-route">'+ic('route')+
    '<span>Route here</span></button></div>':'';
  if(kind!=='home')acts.push('<button class="chip" id="pc-home">'+ic('home')+'<span>Make this home</span></button>');
  if(kind!=='me')acts.push('<button class="chip" id="pc-start">'+ic('start')+'<span>Start from here</span></button>');
  if(kind==='me'&&posMode==='gps')acts.push('<button class="chip" id="pc-disp">'+ic('dispatch')+'<span>Dispatch card</span></button>');
  acts.push('<button class="chip" id="pc-go">'+ic('centre')+'<span>Centre</span></button>');
  if(kind==='drop'){
    acts.push('<button class="chip" id="pc-wpt">'+ic('saved')+'<span>Save as waypoint</span></button>');
    if(mode==='hunt')acts.push(Object.keys(WPTYPES).map(function(k){
      return '<button class="chip" data-wpt="'+k+'">'+WPTYPES[k].h+'</button>'}).join(''));
    acts.push('<button class="chip" id="pc-drop">'+ic('close')+'<span>Remove pin</span></button>')}
  show(rows.join('<br>')+prime+'<div style="margin-top:9px">'+acts.join(' ')+'</div>','');
  var on=function(id,fn){var b=el(id);if(b)b.addEventListener('click',fn)};
  on('pc-route',function(){routeToPoint(at,title)});
  on('pc-home',function(){logAct('act  make this home');HOME=at.slice();homeSave();homeMark();clearRoute();syncSafety();
     
    if(kind==='drop')clearDrop();
    show('<b>Home is here now.</b> The home pin holds this spot — '+
      'press and hold anywhere for a new pin.','')});
  on('pc-start',function(){logAct('act  start from here');
     
    if(posMode==='gps'&&(watchId!==null||LOCATE_N>0))return show('A live GPS fix is driving your position — '+
      'the start pin follows you and cannot be moved by hand.','');
    ME=at.slice();mM.setLngLat(ME);paint();syncSafety();clearRoute();
    if(kind==='drop')clearDrop();
    show('<b>Start is here now.</b> The start pin holds this spot and routes measure '+
      'from it — press and hold anywhere for a new pin.','')});
  on('pc-disp',function(){el('btn-disp').click()});
  on('pc-go',function(){map.easeTo({center:at,zoom:Math.max(map.getZoom(),14),
    duration:600,essential:true})});
  on('pc-wpt',function(){
    var nm=wpName(at);
    if(!wpAdd({n:nm,p:at.slice(),r:BUNDLE.region||null,ts:Date.now()}))
      return show('<b>Could not save.</b> This phone would not let the app '+
        'store it \u2014 its storage may be full or blocked.','fail');
    logAct('act  saved waypoint '+nm);
    wpDraw();clearDrop();
    show('Saved as <b>'+nm+'</b>.<br><span class="sub">On this phone only. '+
      'Find it again under <b>Saved</b> on the Plan tab.</span>','pass')});
  on('pc-drop',function(){clearDrop();ack('Pin removed.')});
  Array.prototype.forEach.call(document.querySelectorAll('[data-wpt]'),function(b){
    b.addEventListener('click',function(){
      var k=b.dataset.wpt,nm=WPTYPES[k].h+' \u00b7 '+wpName(at);
      if(!wpAdd({n:nm,t:k,p:at.slice(),r:BUNDLE.region||null,ts:Date.now()}))
        return show('<b>Could not save.</b>','fail');
      logAct('act  saved waypoint '+k);
      wpDraw();clearDrop();
      show('Saved <b>'+nm+'</b>.<br><span class="sub">On this phone only. '+
        'Find it again under <b>Saved</b> on the Plan tab.</span>','pass')})});
}

function wpDraw(){
  var a=wpLoad().filter(function(x){return !x.r||!BUNDLE.region||x.r===BUNDLE.region});
  try{map.getSource('wpts').setData({type:'FeatureCollection',
    features:a.map(function(x){return {type:'Feature',
      properties:{n:x.n,ts:x.ts||0,t:x.t||''},
      geometry:{type:'Point',coordinates:x.p}}})})}catch(e){}
  return a}

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
    window.paddleCard=paddleCard;window.PADDLE_MPH=PADDLE_MPH;
    window.headingNow=headingNow;window.railSet=railSet;window.railFoldIfAway=railFoldIfAway;
    window.cmpFit=cmpFit;    
    window.guideShow=guideShow;window.guideClose=guideClose;
    window.showQuiet=showQuiet;
    window.railState=function(){var b=el('railbody');
      return{folded:el('rail').className==='folded',
             h:b?Math.round(b.getBoundingClientRect().height):-1}};
     
    window.__st=function(){return ST};
    window.__geo={addressAt:addressAt,geocode:geocode,
                  get ADDR(){return ADDR}};
     
    window.__restrict={of:restrictOf,table:RESTRICT,legal:machineLegal,
                        
                       setMachine:function(m){if(MACHINE[m]){machine=m;_legalMemo={}}},
                        
                       inject:function(e,txt){
                         var b=B[e.bi>=0?e.bi:0];
                         if(e.bi<0){B.push(new Array(BK.length).fill(null));e.bi=B.length-1;b=B[e.bi]}
                         else{b=B[e.bi]=b.slice()}
                         b[BK.indexOf('rst')]=txt;_legalMemo={};return e}};
    window.__disp={nearestEdge:nearestEdge,nearestJunction:nearestJunction,
                   nearestEdgeLinear:nearestEdge_linear,nearestNodeLinear:nearestNode_linear,
                   gridBuild:gridBuild,
                   nearestPavement:nearestPavement,countyAt:countyAt,
                   addressAt:addressAt,get ME(){return ME}};
    window.__route={buildLoops:buildLoops,nearestNode:nearestNode,
                    machineLegal:machineLegal,EDGES:EDGES,ADJ:ADJ,attrs:attrs,
                    setMachine:function(m){if(MACHINE[m])machine=m},
                    get machine(){return machine},spd:spd,MACHINE:MACHINE,
                    get ME(){return ME}};
     
    window.__areas={card:areaCard,groups:LYRGROUPS};
    window.__mode={apply:applyMode,get:function(){return mode},MODES:MODES,now:modeNow};
    window.__stHud=stHudJudge;    
     
    window.__pins={eff:function(k){return pinsEff(modeOf(k))},set:pinsSet,reset:pinsReset,
      key:pinsKey,forget:function(){PINS={}},
      defaults:function(k){var m=modeOf(k);return (m.kinds||[]).filter(function(x){return pinsDefault(m,x)})}};
     
    try{window.__badges={spec:badgeSpec,url:badgeURL,missing:BADGE_MISSING,
      names:function(){return BADGE_DRAWN.slice()},
      encoded:function(){return Object.keys(BADGE_URL)},enc0:function(){return BADGE_ENC0},
      alias:(function(){var o={};Object.keys(BADGE_PAD).forEach(function(k){
        if(typeof BADGE_PAD[k]==='string')o['bdg-pad-'+k]='bdg-'+BADGE_PAD[k]});return o})(),
      glyphOK:function(g){return !!badgeMarkup(g)},
      kinds:Object.keys(POIKIND),pads:Object.keys(BADGE_PAD),
      drops:BADGE_DROPS,padDrops:PAD_DROPS,family:BADGE_FAMILY}}catch(e){}
     
    window.__sat={tiles:TILES,sparse:SPARSE,inPatch:inPatch,blank:Array.from(BLANK_PNG),resolve:_satResolve,
      ok:SAT_OK};    
     
    window.__netLo={n:NETLO.length,ms:NETLO_MS,err:NETLO_ERR,z:NETLO_Z,edges:nf2.length,cls:NETLO_CLS.slice(),
      skip:Object.keys(NETLO_SKIP),layers:Object.keys(NETFT)};
    window.__hd=HD;
     
    window.HDDL=HDDL;window.__hdChip=hdChip;window.__hdCard=hdCard;window.__wake=WAKE;window.__hdTiers=hdTiers;window.__inRings=inRings;window.__ctx=function(){return CTX};window.__back={onBack:onBack,open:backOpen,panelOpen:panelOpen,state:function(){return BACK},toast:toast};window.__privacy=function(u){var o=PRIVACY_URL;if(u!==undefined)PRIVACY_URL=u;return o};window.__tour={start:tourStart,next:tourNext,close:tourClose,seen:tourSeen,reset:tourReset,state:function(){return TOUR},steps:TOUR_STEPS};
    window.__ph={index:PHOTOS,html:photoHTML};
    window.__ride={start:startRecording,fix:rideFix,stop:rideStop,report:rideReport,
                   get R(){return RIDE},get last(){return LASTRIDE}};
     
    try{
      window.__paddle={data:PADDLE,run:runCard,near:nearStop,hours:paddleHours,
        craft:function(){return machine}};
      window.__gauge=GAUGE;
      window.__gauges=(typeof GAUGES!=='undefined')?GAUGES:null;
      window.__search=function(q){return search(q)};
      window.__voice=VOICE;window.__say=navSay;window.__voiceProbe=navVoiceProbe;
      window.__nav={state:NAV,follow:navFollow,start:navStart,stop:navStop,fix:onFix,
         
         
        sim:function(){railSet(false);startSim()},simStop:stopRide,
         
        simSave:function(){return {T:TRUCK?TRUCK.slice():null,c:crumbs.slice(),m:crumbMi,p:posMode,me:ME.slice(),
          ride:RIDE,last:LASTRIDE,got:gotFix,on:NAV.on,lost:lost,hud:!!(el('hudbar')&&el('hudbar').hidden)}},
        simRestore:function(v){try{stopRide()}catch(e){}
          if(RIDE&&RIDE!==v.ride){try{clearInterval(RIDE.pulse)}catch(e){}}
          RIDE=v.ride;LASTRIDE=v.last;TRUCK=v.T;crumbs=v.c;crumbMi=v.m;posMode=v.p;ME=v.me;
          gotFix=v.got;NAV.on=v.on;lost=v.lost;
          try{mM.setLngLat(ME)}catch(e){}
          try{if(tM&&TRUCK)tM.setLngLat(TRUCK);else if(tM&&!TRUCK){tM.remove();tM=null}}catch(e){}
          try{map.getSource('crumb').setData({type:'FeatureCollection',features:crumbs.length>1?[{type:'Feature',
            properties:{},geometry:{type:'LineString',coordinates:crumbs}}]:[]})}catch(e){}
          hudShow(!v.hud);try{syncSafety()}catch(e){}},
        plan:navPlan,guide:function(){return NAVG},project:navProject,
        runSet:runSet,run:function(){return RUN},river:navRiver,riverLine:riverLine,
        pos:function(v){if(v!==undefined)posMode=v;return posMode},
         
        live:function(){return liveFix()},
         
        dist:function(p){return placeDist(p)},
         
        reset:function(full){gotFix=false;rideMode=null;crumbs=[];crumbMi=0;RIDE=null;NAV.on=false;NAV.lastAt=null;
           
          if(full){TRUCK=null;if(tM){try{tM.remove()}catch(e){}tM=null}}},
        crumbs:function(){return crumbs.length},
        stopReal:stopReal,rail:function(on){try{railSet(!!on)}catch(e){}},
        save:tripSave,load:tripLoad,resume:tripResume,end:tripEnd,card:tripResumeCard,
        snapshot:tripSnapshot,chip:navChip,alert:offRouteHtml,publish:ridePublish,
         
        fuel:function(v){if(v!==undefined)FUELS[fi]=v;return FUELS[fi]}};
      window.__splash=SPL;window.__busy=BUSY;
      window.__stack={run:restack,radius:stackRadius,maxz:CLUSTER_MAXZ,
        services:SERVICES,hidden:function(){return Object.keys(STACKED).length},
        out:function(){return STACKOUT},
         
        floor:PIN_FLOOR,
        drawable:function(i,z){var f=poif[i];if(!f)return null;
          var m=modeNow();
          return pinDrawable(f.properties,m,z==null?map.getZoom():z)},
        card:stackCard,
         
        edges:STACK_BANDS,band:stackBand,
        pool:function(z){var m=modeNow(),o=[];
          for(var i=0;i<poif.length;i++)if(pinDrawable(poif[i].properties,m,z))o.push(i);
          return o},
        rank:function(i){var f=poif[i];return f?stackRank(f.properties):null},
        stats:function(){return STACKH?{ms:STACKH.ms,key:STACKH.key}:null},
         
        stackOf:function(b,i){var S=stackAt(b,i);return S?S.m.slice():null}};
    }catch(e){}
     
    window.hudShow=hudShow;window.hudSet=hudSet;window.hudPaint=hudPaint;
    window.__mach={set:function(m){if(!MACHINE[m])return;machine=m;
                     var i=ORDER.indexOf(m);if(i>=0)machIdx=i;applyMachine()},
                   ok:function(){return (MACHINE[machine]||{}).ok||[]},
                   illegal:machineIllegal};
    window.PAL=PAL}catch(e){}

 
var ST=[],ACT=[],T0=Date.now();
 
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
   
  var stMode='?';try{stMode=STACKH?JSON.parse(STACKH.key).k:'?'}catch(e){}
  stInfo('ENV','stack-build',STACKH?STACKH.ms+' ms ('+stMode+')':'not built');
}

function stLoad(){
   
  var _hon=(BUNDLE.state==='partial')===!!(BUNDLE.absent&&BUNDLE.absent.length);
  stAdd('LOAD','bundle-honest',_hon,
    BUNDLE.state+(BUNDLE.absent&&BUNDLE.absent.length?
      ' — names absent: '+BUNDLE.absent.join(','):' — nothing absent'));
  stAdd('LOAD','offline-clean',remoteHits===0,remoteHits+' unexpected remote requests'+
    (inappHits?' \u00b7 '+inappHits+' in-app (HD / gauges \u2014 user taps, \u00a78 allowlist)':''));
   
  var _sv=svLoad();
  stAdd('LOAD','saved-routes',true,
    svAvailable()?_sv.length+' saved on this phone, nothing sent anywhere':
      'storage unavailable in this browser — saving is disabled, not silent');
  stAdd('LOAD','glyph-pack',GLYPH_BUF&&GLYPH_BUF.length>1000,
    (GLYPH_BUF?GLYPH_BUF.length:0)+' bytes');
  stAdd('LOAD','graph',EDGES.length>1000&&NODES.length>500,
    EDGES.length+' edges / '+NODES.length+' nodes');
  stAdd('LOAD','terrain',!!(TR&&TR.ne&&TR.ne.length===NODES.length),
    TR&&TR.ne?TR.ne.length+' node elevations':'absent');
   
  var idx=buildIndex();
  stAdd('LOAD','search-index',idx&&idx.length>100,(idx?idx.length:0)+' entries');
}

function stRender(cb){
   
  var t0=Date.now();
  (function _settle(){
    var okd=map.isStyleLoaded();
    if(!okd&&Date.now()-t0<5000)return setTimeout(_settle,250);
    stAdd('RENDER','style-loaded',okd,okd?('true after '+(Date.now()-t0)+' ms'):'false after 5 s');
    _stRenderBody();cb&&cb()})();
  return;
  function _stRenderBody(){
  stAdd('RENDER','no-map-errors',!glErr,glErr||'none');
  var q=function(ids){try{return map.queryRenderedFeatures({layers:ids}).length}
    catch(e){return -1}};
  var all=renderedCount();
  stAdd('RENDER','features-drawn',all>0,all+' in viewport');
   
  stInfo('RENDER','trails',q(['trail50','route72','moto24','fstrail','mccct'])+
    ' designated · '+q(['track'])+' two-track in the view you left it on');
   
  var _rc=map.getCenter(),_rn=q(['fsroad','minor','paved','track']);
  stAdd('RENDER','roads',_rn>0,_rn+' features at '+_rc.lat.toFixed(3)+','+
    _rc.lng.toFixed(3)+' z'+map.getZoom().toFixed(1));
   
  var was={c:map.getCenter(),z:map.getZoom()};
  var site=anchorOf('site');
  map.jumpTo({center:site,zoom:14.5});
   
   
  var lb=q(['lbl-place','lbl-trail']);
  stInfo('RENDER','labels',lb+' at '+site[1].toFixed(3)+','+site[0].toFixed(3)+
    ' z13.6 — placed asynchronously, see trail-names for the real check');
  stInfo('RENDER','labels-here',q(['lbl-place','lbl-trail'])+' at the view you left it on');
  map.jumpTo({center:[was.c.lng,was.c.lat],zoom:was.z});
  var vis;try{vis=map.getLayoutProperty('sat','visibility')}catch(e){vis='err'}
  stInfo('RENDER','basemap','sat visibility='+vis+' SAT_OK='+SAT_OK);
   
  stInfo('RENDER','net-lo',NETLO_ERR?'chaining failed, every zoom draws per edge: '+NETLO_ERR:
    NETLO.length+' low-zoom strokes ('+NETLO_CLS.join(', ')+') from '+nf2.length+' edges in '+NETLO_MS+' ms; per edge: '+Object.keys(NETLO_SKIP).join(', '));
   
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
}}

function stLayout(){
   
  var vw=document.documentElement.clientWidth;

   
  (function(){
    try{
       
      var at=(ME&&ME.slice)?ME.slice():
             (CTR&&CTR.slice)?CTR.slice():null;
      if(!at)return;
      var t0=performance.now();
      nearestEdge(at);nearestJunction(at);nearestPavement(at);
      countyAt(at);addressAt(at);addressAt(at,true);
      var ms=performance.now()-t0;
       
      var budget=Math.max(600,Math.round(EDGES.length/150));
      stAdd('PERF','dispatch-scan',ms<budget,
        Math.round(ms)+' ms of '+budget+' ms budget ('+EDGES.length+
        ' edges, '+(ms*1000/EDGES.length).toFixed(1)+' µs/edge, from '+
        meNoun(true)+
        ') — this is what you wait for after tapping Dispatch');
    }catch(e){stInfo('PERF','dispatch-scan','could not time: '+e)}
  })();
  stInfo('UI','viewport',vw+'x'+document.documentElement.clientHeight+
    ' css px · dpr '+devicePixelRatio);

   
  var wide=[];
  Array.prototype.forEach.call(document.querySelectorAll('#shell *'),function(e){
    var r=e.getBoundingClientRect();
    if(r.width>vw+1)wide.push((e.id||e.className||e.tagName)+' '+Math.round(r.width)+'px')});
  stAdd('UI','nothing-overflows',wide.length===0,
    wide.length?wide.slice(0,3).join(' · '):'no element exceeds '+vw+' px');

   
  var strips=[],bad=[];
  Array.prototype.forEach.call(document.querySelectorAll('#shell *'),function(e){
    var ov=getComputedStyle(e).overflowX;
    if(ov!=='auto'&&ov!=='scroll')return;
    if(!e.children.length)return;
    strips.push(e.id||e.className);
     
    var last=e.children[e.children.length-1].getBoundingClientRect();
    var box=e.getBoundingClientRect();
    if(last.right>box.right+1&&e.scrollWidth<=e.clientWidth+1)
      bad.push((e.id||e.className)+' clips its last child')});
  stAdd('UI','strips-scroll',bad.length===0,
    bad.length?bad.join(' · '):strips.length+' scrollable strip(s), all reachable');

   
  var small=[];
  Array.prototype.forEach.call(document.querySelectorAll('.chip,.act,.rc,.hit'),function(e){
    var r=e.getBoundingClientRect();
    if(r.height>0&&r.height<38)small.push((e.id||e.textContent||'?').slice(0,14)+
      ' '+Math.round(r.height)+'px')});
  stAdd('UI','tap-targets',small.length===0,
    small.length?small.slice(0,3).join(' · '):'all ≥38 px tall');

   
  var vh=document.documentElement.clientHeight,off=[];
   
   
   
  var _r=el('rail'),_rb=el('railbody');
  var _folded=!_rb||_rb.getBoundingClientRect().height<8;
  var LIST=_folded?['peek','btn-home','btn-ride','c-ride','c-locate']
                  :['btn-home','btn-disp','btn-steps','btn-retrace','c-ride','c-locate'];
  LIST.forEach(function(id){
    var e=el(id);if(!e)return;var r=e.getBoundingClientRect();
    if(r.height===0)return;
    if(r.bottom>vh+2||r.top<0)off.push(id)});
  stAdd('UI','controls-on-screen',off.length===0,
    off.length?off.join(', ')+' outside the viewport'
      :(_folded?'primary controls reachable — the details drawer is folded, '+
                'its handle is on screen'
              :'primary controls all reachable'));


   
   
  var _no=machineIllegal(),_okc=(MACHINE[machine]||{}).ok||[];
  var _wired=true;
  try{['trail50','moto24','track'].forEach(function(id){
    var e=map.getPaintProperty(id,'line-opacity');
    if(!e||!e.length||e[0]!=='case')_wired=false})}catch(e){_wired=false}
  stAdd('UI','machine-on-map',_wired,
    MACHINE[machine].lbl+' — '+_okc.length+' classes legal, '+
    _no.length+' faded'+(_no.length?' ('+_no.join(', ')+')':''));
   
  var _hb=el('hudbar'),_hs=el('hudstats'),_rid=!!(rideMode||riding);
   
  var _drawn=function(e){if(!e||e.hidden)return false;
    var r=e.getBoundingClientRect();return r.width>0&&r.height>0};
  var _bar=_drawn(_hb),_ctl=_drawn(_hs)&&_drawn(el('hudbtns')),
      _sts=_drawn(_hs)&&_drawn(el('hc-dist'));
  var _hj=stHudJudge({rid:_rid,pend:!!(rideMode&&!gotFix&&!riding),nav:_drawn(el('nav')),
    bar:_bar,ctl:_ctl,sheet:_drawn(_hs),sts:_sts});
  stAdd('UI','hud-matches-ride',_hj.ok,_hj.msg);
  var off=[];
  Array.prototype.forEach.call(document.querySelectorAll('#actions .act'),function(e){
    var r=e.getBoundingClientRect();
    if(r.right<0||r.left>vw+1)off.push(e.textContent.slice(0,12))});
  stAdd('UI','actions-reachable',off.length===0,
    off.length?'off-screen: '+off.join(', '):'all primary actions on screen');
   
  var mh=map.getContainer().getBoundingClientRect().height;
  stAdd('UI','map-has-room',mh>vh*0.35,
    Math.round(mh)+' of '+vh+' px ('+Math.round(100*mh/vh)+'% of the screen)');

}

function stData(){
   
  var known=[['Mio',-84.1330,44.6597,965],['Bull Gap',-84.0274,44.6166,1070],
             ['The Pink Store',-84.1279,44.5219,1240]];
  known.forEach(function(k){
    var r=elevNear([k[1],k[2]]);
    if(!r)return stAdd('DATA','elev-'+k[0],false,'no elevation');
    var f=Math.round(r.e*3.28084),d=Math.abs(f-k[3]);
    stAdd('DATA','elev-'+k[0],d<=90,f+' ft vs '+k[3]+' surveyed (Δ'+d+') at the '
      +'nearest node, '+Math.round(r.mi*5280)+' ft away')});
   
  if(!ADDR||!ADDR.segs)stInfo('DATA','address','no address index in this bundle');
  else{
    stInfo('DATA','address-index',ADDR.segs.length+' segments, '+
      ADDR.names.length+' street names');
    var hits=0,near=0,shown=[];
    PLACES.forEach(function(pl){
      var at=[pl[1],pl[2]],a=addressAt(at),n=a?null:addressAt(at,true);
      if(a){hits++;if(shown.length<2)shown.push(pl[0]+': '+a.txt)}
      else if(n){near++;if(shown.length<3)shown.push(pl[0]+': '+n.txt)}});
    stInfo('DATA','address-at-anchors',hits+' exact, '+near+' near, of '+
      PLACES.length+' · '+
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
   
  var _was=machine;
  if(MACHINE[machine]&&MACHINE[machine].mph){machine=rideMachine||'bike';_legalMemo={}}
  var a=anchorOf('site'),b=anchorOf('town');
  var na=nearestNode(a),nb=nearestNode(b);
  stAdd('ROUTE','snap',na>=0&&nb>=0,'nodes '+na+' -> '+nb+
    (_was!==machine?' (as '+MACHINE[machine].lbl+' \u2014 a '+
      MACHINE[_was].lbl.toLowerCase()+' is legal on no land class)':''));
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
   
  var before=machine;
  try{
    machine='bike';_legalMemo={};var pb=route(na,nb,PROFILES[0].f);
    machine='sxs';_legalMemo={};var _sxsTo=HOME||CTR;
    var ns=nearestNode(ME),ps=ns>=0?route(ns,nearestNode(_sxsTo),PROFILES[0].f):null;
     
    var sxsCanSnap=ns>=0;
    stAdd('ROUTE','machine-filter',!!pb&&sxsCanSnap,
      'bike '+(pb?pb.length:0)+' edges · sxs snaps='+sxsCanSnap+
      ' route='+(ps?ps.length+' edges':'none legal (expected on bike-only trail)'));
    var closedUsed=(pb||[]).filter(function(e){return e.c==='closed'||e.c==='fsclosed'}).length;
    stAdd('ROUTE','closures-avoided',closedUsed===0,closedUsed+' closed edges in route');
   
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
  if(_was!==machine){machine=_was;_legalMemo={}}
}
function stSafety(){
   
   
   
  var save={T:TRUCK,c:crumbs.slice(),m:crumbMi,p:posMode,me:ME.slice(),
            rs:RESUMING,rr:RESUMED_RIDE,
            ride:RIDE,lastride:LASTRIDE,
            hud:!!(el('hudbar')&&el('hudbar').hidden),
            chips:!!(el('chips')&&el('chips').hidden)};
  RESUMING=false;RESUMED_RIDE=null;
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
  RESUMING=save.rs;RESUMED_RIDE=save.rr;
  hudShow(!save.hud);
  if(el('chips'))el('chips').hidden=save.chips;
  try{syncSafety()}catch(e){}
}

function stPerf(cb){
  var n=0,t0=performance.now(),d=[],last=t0,bgSeen=false;
  function _vis(){if(document.hidden)bgSeen=true}
  try{document.addEventListener('visibilitychange',_vis)}catch(e){}
   
  var c=CTR, _cam={c:map.getCenter(),z:map.getZoom(),b:map.getBearing()};
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
      map.setBearing(_cam.b);
      map.jumpTo({center:[_cam.c.lng,_cam.c.lat],zoom:_cam.z});
       
       
      var slow=0,worst=0;
      for(var q=0;q<d.length;q++){if(d[q]>33.4)slow++;if(d[q]>worst)worst=d[q]}
      var detail='avg '+avg+' · p99 min '+p99+' · '+slow+'/'+d.length+
        ' frames over 33ms · worst '+Math.round(worst)+'ms · '+drew+' features';
      var soft=/swiftshader|llvmpipe|software/i.test(glInfo().r||'');
       
      if(bgSeen||worst>2000)
        stInfo('PERF','fps',detail+' · APP LEFT THE FOREGROUND during the '+
          'sample (rAF pauses; the worst frame is your absence), not a verdict');
      else if(soft)stInfo('PERF','fps',detail+' · SOFTWARE RASTERISER, not a verdict');
      else stAdd('PERF','fps',avg>=30&&drew>0&&slow<=d.length*0.1,detail);
      try{document.removeEventListener('visibilitychange',_vis)}catch(e){}
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
       
      var away=!inRegion(f.at);
      stInfo('GPS','position',away?Math.round(mi(f.at,CTR))+' mi outside '+
        (BUNDLE.name||'the region'):'inside '+(BUNDLE.name||''));
      classifyFix(f.at);
      stInfo('GPS','fixes',fixes.length+' in 20s');
    }else{
       
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

 
function stHudJudge(o){
  if(o.pend)return {ok:!!(o.nav&&!o.bar&&!o.sheet),
    msg:'Ride pressed \u2014 waiting for the first fix: strip '+(o.nav?'on':'OFF')+' screen, ribbon '+
      (o.bar?'ON':'off')+' screen, ride sheet '+(o.sheet?'ON':'off')+' screen'};
  if(o.rid)return {ok:!!(o.bar&&o.ctl),
    msg:'riding \u2014 ribbon '+(o.bar?'on':'OFF')+' screen, ride controls '+(o.ctl?'on':'OFF')+' screen'+
      (o.sts?', stats on screen':o.ctl?'; the stats fold away while the drawer is open':'')};
  return {ok:!o.bar&&!o.sheet,msg:'not riding \u2014 HUD off screen'}}

function stRide(){
  if(!LASTRIDE&&!RIDE)return stInfo('RIDE','none',
    'no ride recorded yet — start one with Ride it on the Ride tab');
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

 
 
function stPins(){
  var parts=MODES.map(function(m){var o=pinsLoad(m.k),n=Object.keys(o).length;
    return m.h+' '+(n?n+' switched ('+Object.keys(o).map(function(k){return k+(o[k]?' on':' off')}).join(', ')+')':'defaults')});
  stInfo('PINS','choices',parts.join(' · '));
   
  var nb=BADGE_DRAWN.length;
  stInfo('PINS','badges',nb+' drawn'+(BADGE_MISSING.length?' · missing: '+BADGE_MISSING.join(', '):'')+
    (typeof Path2D==='undefined'?' · no Path2D — shapes and colours only':''))}

function stCompass(){
  var n=MAGLOG.length;
  if(!n){stInfo('COMPASS','sensor',MAG_OK===null?'not started — open the compass, wait 3 s, re-run':
    (MAG_OK?'no events in the last 3 s':'no magnetometer events — the compass shows a rose and no needle'));return}
  var span=(MAGLOG[n-1].t-MAGLOG[0].t)/1000,rate=span>0?(n-1)/span:0,sx=0,sy=0;
  MAGLOG.forEach(function(e){sx+=Math.cos(e.d*Math.PI/180);sy+=Math.sin(e.d*Math.PI/180)});
  var mean=Math.atan2(sy,sx)*180/Math.PI,worst=0;
  MAGLOG.forEach(function(e){var d=Math.abs(((e.d-mean)%360+540)%360-180);if(d>worst)worst=d});
  stInfo('COMPASS','sensor',n+' events in '+span.toFixed(1)+' s ('+rate.toFixed(1)+'/s) · raw heading spread ±'+
    worst.toFixed(0)+'° · steadiness '+(Math.hypot(sx,sy)/n).toFixed(3)+' · '+MAGLOG[n-1].ev+
    (MAGLOG[n-1].abs?' (absolute)':' (relative)')+' · painted raw, no smoothing')}

function stHaptics(){
  var C=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.Haptics;
  stAdd('HAPTICS','available',!!(C||navigator.vibrate),
    C?'Capacitor Haptics':(navigator.vibrate?'navigator.vibrate':'NONE — off-route alert is silent'));
  try{buzz(30);stAdd('HAPTICS','fired',true,'buzz(30) did not throw')}
  catch(e){stAdd('HAPTICS','fired',false,'threw: '+e.message)}
   
  var ok=navVoiceProbe(),vs=[];
  try{vs=speechSynthesis.getVoices()||[]}catch(e){}
  stAdd('VOICE','engine',null,ok
    ?vs.length+' voice(s) · using "'+((VOICE.voice||{}).name||'?')+'" ('+((VOICE.voice||{}).lang||'?')+
      (VOICE.local?', on-device — works offline':', NOT marked on-device — may need signal')+')'
    :(typeof speechSynthesis==='undefined'?'Web Speech API absent in this WebView — strip stays silent'
      :'no voices reported — strip stays silent'));
}

 
function stGlyphs(){
  var stacks={},order=[],num=function(a,b){return a-b},
      rg=function(r){return (r*256)+'-'+(r*256+255)},
      list=function(a){return a.length?a.sort(num).map(rg).join(', '):'none'};
  try{map.getLayersOrder().forEach(function(id){
    var L=map.getLayer(id);if(!L||L.type!=='symbol')return;
    var f=map.getLayoutProperty(id,'text-font');if(!f||!f.join)return;
    var k=f.join(',');if(!stacks[k]){stacks[k]=[];order.push(k)}stacks[k].push(id)})}catch(e){}
  if(!order.length)return stInfo('RENDER','glyphs','UNKNOWN \u2014 no label layer with a text-font was found');
  var gm=null;try{gm=map.style&&map.style.glyphManager}catch(e){}
  if(!gm||!gm.entries)return stInfo('RENDER','glyphs','UNKNOWN \u2014 this MapLibre build exposes no glyph '+
    'manager; label layers use '+order.join(' / '));
  stInfo('RENDER','glyphs',order.map(function(k){
    var e=gm.entries[k],n=stacks[k].length,who=k+' ('+n+' label layer'+(n===1?'':'s')+')';
     
    if(!e){var ks=Object.keys(gm.entries);
      return who+(ks.length?': UNKNOWN \u2014 the glyph manager holds '+ks.join(' / ')+', none is '+k:
        ': no glyph requested yet')}
     
    if(!e.glyphs||typeof e.glyphs!=='object'||!e.ranges||typeof e.ranges!=='object'||
       !e.requests||typeof e.requests!=='object')
      return who+': UNKNOWN \u2014 the glyph manager\'s '+k+' entry has no glyphs / ranges / requests to read';
    var loaded=[],failed=[],pending=[],local=0,pack=0,lr={};
    Object.keys(e.glyphs||{}).forEach(function(id){var g=e.glyphs[id];if(!g)return;
      if(g.metrics&&g.metrics.isDoubleResolution){local++;lr[Math.floor(+id/256)]=1}else pack++});
    Object.keys(e.ranges||{}).forEach(function(r){if(e.ranges[r])loaded.push(+r)});
    Object.keys(e.requests||{}).forEach(function(r){r=+r;if(loaded.indexOf(r)>=0)return;
      (lr[r]?failed:pending).push(r)});
    var font=null;try{font=e.tinySDF&&e.tinySDF.ctx&&e.tinySDF.ctx.font}catch(x){}
    return who+': ranges from the pack '+list(loaded)+' \u00b7 failed '+list(failed)+
      ' \u00b7 pending '+list(pending)+' \u00b7 '+pack+' glyphs from the pack, '+local+
      ' drawn locally'+(font?' in "'+font+'"':'')}).join(' ;; '))}
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
   
  return {text:L.join('\n'),pass:pass,fail:fail,results:ST.slice()};
}
function pad(s){s=String(s);while(s.length<18)s+=' ';return s}

function stRenderPanel(rep){
  var rows=ST.map(function(r){
    var col=r.ok===null?'#9A9184':(r.ok?'#8FAE63':'#C1121F');
    var mk=r.ok===null?'·':ic(r.ok?'pass':'fail',12);
    return '<div style="display:flex;gap:8px;padding:3px 0;border-bottom:1px solid var(--divider)">'+
      '<span class="stmk" style="color:'+col+';font-weight:700;width:var(--ic-sm);flex:0 0 var(--ic-sm)">'+mk+'</span>'+
      '<span style="color:var(--text-1);min-width:112px;font:600 var(--t-sm) ui-monospace,monospace">'+
      r.g+'·'+r.id+'</span>'+
      '<span style="color:var(--text-2);font-size:var(--t-sm);flex:1">'+
      String(r.d).replace(/[<>]/g,'')+'</span></div>'}).join('');
  var bad=rep.fail>0;
  show('<b style="font-size:var(--t-lg)">Self-test · '+
    '<span style="color:'+(bad?'var(--danger-text)':'var(--ok)')+'">'+rep.pass+' passed, '+
    rep.fail+' failed</span></b><br>'+
    '<div style="max-height:46vh;overflow:auto;margin:8px 0">'+rows+'</div>'+
    '<button id="st-copy" class="chip">Copy report</button> '+
    '<button id="st-share" class="chip">Share report</button>',bad?'fail':'');
  var t=rep.text;
  var cp=el('st-copy');
  if(cp)cp.addEventListener('click',function(){
    var done=function(){cp.textContent='Copied';setTimeout(function(){cp.textContent='Copy report'},1600)};
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

 
 
function stLabels(cb){
  var was={c:map.getCenter(),z:map.getZoom()};
  var DES={trail50:1,route72:1,moto24:1,fstrail:1,mccct:1},best=1e18,at=null;
  for(var i=0;i<EDGES.length;i++){var e=EDGES[i];if(!DES[e.c])continue;
    var n=NODES[e.a],dx=n[0]-CTR[0],dy=n[1]-CTR[1],d=dx*dx*0.51+dy*dy;
    if(d<best){best=d;at=n}}
  if(!at){stInfo('RENDER','trail-names','no designated trail in this region — skipped');return cb()}
   
  var wasAct=act;if(act!=='all'){act='all';try{applyAct()}catch(e){}}
  map.jumpTo({center:at,zoom:14.5});
  var q=function(ids){try{return map.queryRenderedFeatures({layers:ids}).length}
    catch(e){return -1}};
  var t0=Date.now();
  (function poll(){
    var segs=q(['trail50','route72','moto24','fstrail','mccct']),tl=q(['lbl-trail']);
    if((segs>0&&tl>0)||Date.now()-t0>7000){
      stAdd('RENDER','trail-names',segs>0&&tl>0,
        tl+' names for '+segs+' trail segments at z14.5 near '+at[1].toFixed(3)+','+
        at[0].toFixed(3)+' — knowing WHICH trail you are on is the point');
      map.jumpTo({center:[was.c.lng,was.c.lat],zoom:was.z});
      if(wasAct!==act){act=wasAct;try{applyAct()}catch(e){}}
      return cb()}
    setTimeout(poll,300)})()}

 
function selfTest(opts,done){
  opts=opts||{};ST=[];
  stEnv();stLoad();
   
  stRender(function(){
  stLayout();stData();stRouting();stSafety();stRide();stHaptics();stCompass();stPins();
  var finish=function(){var rep=stReport();
    try{window.__selfTestReport=rep}catch(e){}
    if(done)done(rep);return rep};
  stLabels(function(){
  stGlyphs();
  stPerf(function(){
    if(opts.gps===false)return finish();
    show('<b>Self-test running…</b><br>Waiting up to 20s for a GPS fix. '+
      'Step outside for a real one, or wait it out.','');
    stGps(function(){finish()})})})});
}
try{window.__selfTest=selfTest}catch(e){}
el('c-loop').addEventListener('click',function(){
  show('<b>Loop from here</b> — a ride that ends where it starts, on legal line '+
    'for a '+MACHINE[machine].lbl+'.<br>'+
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
          MACHINE[machine].lbl+'. Move the start pin closer to a trail.','fail');
        var out=buildLoops(a,want);
        if(!out.length)return show('<b>No loop found</b> at '+want+
          ' mi from here. The legal network within reach may not connect back — '+
          'try a different distance, or a narrower machine.','fail');
         
        RFROM=ME.slice();RTO=ME.slice();DESTLBL='the start';
        out.forEach(function(o){
          o.h+=' · '+o.s.mi.toFixed(1)+' mi';
          if(o.repeat>0.25)o.h+=' \u00b7 '+Math.round(o.repeat*100)+'% ridden twice'});
        logAct('loop '+out.length+' options, '+out[0].s.mi.toFixed(1)+' mi');
        presentRoutes(out)},30)})})});

el('c-selftest').addEventListener('click',function(){
  setChip('c-selftest','selftest','Running…');
  show('<b>Self-test running…</b><br>Exercising load, render, data, routing, '+
    'safety, haptics and performance, then waiting up to 20s for a GPS fix.','');
  setTimeout(function(){selfTest({},function(rep){
    setChip('c-selftest','selftest','Self-test');
    stRenderPanel(rep)})},60)});

[[hM,'home',function(){return HOME},function(){return 'Home / truck'}],
 [mM,'me',function(){return ME},function(){
     
    return {you:'You are here',last:'Last GPS fix ('+meClock()+')',sim:'Simulated position',
      away:'Planning start',pin:'Start pin'}[meIs()]}]
].forEach(function(t){
  try{t[0].getElement().addEventListener('click',function(ev){
    ev.stopPropagation();placeCard(t[2](),t[1],t[3]())})}catch(e){}});
 
var LP_MS=450,LP_TOL=12,lp={t:null,x:0,y:0,fired:false};
function lpCancel(){if(lp.t){clearTimeout(lp.t);lp.t=null}}
function lpAt(cx,cy){
   
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
 
map.on('contextmenu',function(e){buzz(18);dropPin([e.lngLat.lng,e.lngLat.lat])});
 
function collapseAttrib(){
  try{Array.prototype.forEach.call(
    document.querySelectorAll('.maplibregl-ctrl-attrib.maplibregl-compact-show'),
    function(el){el.classList.remove('maplibregl-compact-show')})}catch(e){}}
map.on('load',collapseAttrib);map.on('idle',collapseAttrib);

map.on('idle',function(){if(!healthOK)renderHealth()});
map.on('move',refreshReadout);map.on('load',refreshReadout);
map.on('moveend',railFoldIfAway);
 

 
var ZMAX_STACK=STACK_BANDS[STACK_BANDS.length-1];    
function stackBand(z){var b=-1;for(var i=0;i<STACK_BANDS.length;i++)if(z>=STACK_BANDS[i])b=i;return b}
 
function stackRank(p){return (p.r==null?9:+p.r)*10+(p.pri==null?3:+p.pri)}
function stackBuild(m){
  var t0=Date.now(),n=poif.length,i,b;
   
  if(!STACKW){STACKW={x:new Float64Array(n),y:new Float64Array(n),r:new Float64Array(n)};
    for(i=0;i<n;i++){var c=poif[i].geometry.coordinates,sn=Math.sin(c[1]*Math.PI/180);
      STACKW.x[i]=(c[0]+180)/360*512;
      STACKW.y[i]=(0.5-Math.log((1+sn)/(1-sn))/(4*Math.PI))*512;
      STACKW.r[i]=stackRank(poif[i].properties)}}
  var WX=STACKW.x,WY=STACKW.y,RK=STACKW.r;
   
  var FB=new Int8Array(n);
  for(i=0;i<n;i++){FB[i]=-1;var p=poif[i].properties;
    if((m.kinds||[]).indexOf(p.k)<0)continue;
    for(b=0;b<STACK_BANDS.length;b++)if(pinDrawable(p,m,STACK_BANDS[b])){FB[i]=b;break}}
  function better(a,c){return RK[a]<RK[c]||(RK[a]===RK[c]&&a<c)}
  var levels=[],prev=null;
  for(b=STACK_BANDS.length-1;b>=0;b--){
    var zb=STACK_BANDS[b],R=stackRadius(zb),sc=Math.pow(2,zb),pts=[],k,t;
    if(!prev){for(i=0;i<n;i++)if(FB[i]>=0&&FB[i]<=b)pts.push({a:i,m:[i]})}
    else for(k=0;k<prev.length;k++){var mem=[],a=-1,pm=prev[k].m;
      for(t=0;t<pm.length;t++)if(FB[pm[t]]<=b){mem.push(pm[t]);if(a<0||better(pm[t],a))a=pm[t]}
      if(mem.length)pts.push({a:a,m:mem})}
    pts.sort(function(p1,p2){return RK[p1.a]-RK[p2.a]||p1.a-p2.a});
     
    var grid=new Map(),stacks=[];
    for(k=0;k<pts.length;k++){var q=pts[k],x=WX[q.a]*sc,y=WY[q.a]*sc,
        cx=Math.floor(x/R),cy=Math.floor(y/R),best=null,bd=R;
      for(var dx=-1;dx<=1;dx++)for(var dy=-1;dy<=1;dy++){
        var g=grid.get((cx+dx)*2097152+(cy+dy));if(!g)continue;
        for(t=0;t<g.length;t++){var d=Math.hypot(g[t].x-x,g[t].y-y);if(d<bd){bd=d;best=g[t]}}}
      if(best){for(t=0;t<q.m.length;t++)best.m.push(q.m[t])}
      else{var ns={x:x,y:y,a:q.a,m:q.m.slice()};stacks.push(ns);
        var gk=cx*2097152+cy,gg=grid.get(gk);if(!gg)grid.set(gk,gg=[]);gg.push(ns)}}
    levels[b]=stacks;prev=stacks}
   
  for(b=0;b<levels.length;b++)levels[b].forEach(function(S){
    if(S.m.length<2)return;
    S.m.sort(function(p1,p2){return p1===S.a?-1:p2===S.a?1:(RK[p1]-RK[p2]||p1-p2)});
    var w=180,so=90,e=-180,no=-90,k0=poif[S.a].properties.k;S.mixed=false;
    S.m.forEach(function(j){var c=poif[j].geometry.coordinates;
      if(c[0]<w)w=c[0];if(c[0]>e)e=c[0];if(c[1]<so)so=c[1];if(c[1]>no)no=c[1];
      if(poif[j].properties.k!==k0)S.mixed=true});
    S.box=[w,so,e,no]});
  return {levels:levels,ms:Date.now()-t0}}
 
function stackEnsure(){
  var m=modeNow(),key=JSON.stringify(m);
  if(!STACKH||STACKH.key!==key){STACKH=stackBuild(m);STACKH.key=key;STACKWIN=null}
  return STACKH}
 
function stackAt(b,i){var L=stackEnsure().levels[b]||[];
  for(var k=0;k<L.length;k++)if(L[k].m.indexOf(i)>=0)return L[k];
  return null}
 
function stackSplits(ids,z){
  if(!ids.length)return false;
  for(var b=stackBand(z)+1;b<STACK_BANDS.length;b++){var S=stackAt(b,ids[0]);
    if(!S)continue;
    for(var t=0;t<ids.length;t++)if(S.m.indexOf(ids[t])<0)return true}
  return false}
 
function stackRevealZ(i,z){var b0=stackBand(z);
  for(var b=Math.max(b0,0);b<STACK_BANDS.length;b++){var S=stackAt(b,i);
    if(S&&S.m.length<2)return b===b0?z:Math.min(ZMAX_STACK,STACK_BANDS[b]+0.01)}
  return ZMAX_STACK}
function restack(){
  var src;try{src=map.getSource('poistack')}catch(e){return}
  if(!src)return;
  var z=map.getZoom();
   
  if(z<PIN_FLOOR){STACKWIN=null;
    if(STACKOUT.length||Object.keys(STACKED).length){
      STACKED={};applyStackFilters();STACKOUT=[];STACKSIG='';
      src.setData({type:'FeatureCollection',features:[]})}
    return}
  var H=stackEnsure(),key=H.key,b=stackBand(z),bd=map.getBounds(),
      V=[bd.getWest(),bd.getSouth(),bd.getEast(),bd.getNorth()];
   
  if(STACKWIN&&STACKWIN.b===b&&STACKWIN.key===key&&V[0]>=STACKWIN.w[0]&&V[1]>=STACKWIN.w[1]&&
     V[2]<=STACKWIN.w[2]&&V[3]<=STACKWIN.w[3])return;
  var dx=V[2]-V[0],dy=V[3]-V[1],W=[V[0]-dx,V[1]-dy,V[2]+dx,V[3]+dy];
  var hide={},out=[],L=H.levels[b]||[];
  for(var a=0;a<L.length;a++){var S=L[a];
    if(S.m.length<2||S.box[2]<W[0]||S.box[0]>W[2]||S.box[3]<W[1]||S.box[1]>W[3])continue;
    for(var t=0;t<S.m.length;t++)hide[S.m[t]]=1;
    var ak=poif[S.a].properties.k;
    out.push({type:'Feature',
      properties:{n:S.m.length,k:ak,mixed:S.mixed,
        c:S.mixed?STACK_MIXED:((POIKIND[ak]||{}).c||STACK_MIXED),
        ids:S.m.join(',')},
      geometry:{type:'Point',coordinates:poif[S.a].geometry.coordinates}})}
  STACKWIN={b:b,key:key,w:W};
  var changed=Object.keys(hide).length!==Object.keys(STACKED).length;
  if(!changed)for(var h in hide)if(!STACKED[h]){changed=true;break}
  STACKED=hide;
  if(changed)applyStackFilters();
   
   
  var sig=out.length+'|'+out.map(function(f){return f.properties.ids+'@'+f.properties.k+'@'+
    f.geometry.coordinates.join(',')}).join('|');
  STACKOUT=out;
  if(sig===STACKSIG)return;
  STACKSIG=sig;
  src.setData({type:'FeatureCollection',features:out})}
var STACKOUT=[],STACKSIG='';
 
var STACKH=null,STACKWIN=null,STACKW=null;

 
function stackCard(f){
  var ids=String(f.properties.ids||'').split(',').filter(function(x){return x!==''});
  var recs=ids.map(function(i){return {i:+i,r:((POIS&&POIS.p)||[])[+i]}})
    .filter(function(o){return o.r&&o.r.p});
  if(!recs.length)return;
  logAct('tap  stack '+recs.length);
   
  RAIL_AT=f.geometry.coordinates.slice();
   
   
  recs.sort(function(a,b){var pa=POIKIND[a.r.k],pb=POIKIND[b.r.k],
      ka=(pa&&pa.r!=null)?pa.r:9,kb=(pb&&pb.r!=null)?pb.r:9;
    return ka-kb||(a.r.n||'').localeCompare(b.r.n||'')});
  var rows='',lastK=null;
  recs.forEach(function(o,n){
    var kd=POIKIND[o.r.k]||{},nm=o.r.n||kd.h||o.r.k,u=badgeURL('bdg-'+o.r.k);
    if(o.r.k!==lastK){rows+='<div class="k" style="margin-top:'+(lastK?10:0)+'px">'+
      (kd.h||o.r.k).toUpperCase()+'</div>';lastK=o.r.k}
    rows+='<button class="chip" data-si="'+n+'" style="width:100%;'+
      'justify-content:flex-start;text-align:left">'+
      (u?'<img class="pbdg" src="'+u+'" alt="">':
       '<span class="dot" style="background-color:'+(kd.c||'var(--pin-unknown)')+'"></span>')+'<span>'+nm+'</span></button>'});
   
  var zoomSplits=stackSplits(recs.map(function(o){return o.i}),map.getZoom());
  show('<b>'+recs.length+' places here</b>'+
    '<div class="sub">Stacked at this zoom. '+(zoomSplits?'Tap one, or keep zooming in.':'Tap one.')+'</div>'+
    '<div style="max-height:46vh;overflow:auto">'+rows+'</div>','');
  var host=el('panel')||document;
  Array.prototype.forEach.call(host.querySelectorAll('[data-si]'),function(b){
    b.addEventListener('click',function(){
      var o=recs[+b.dataset.si];if(!o)return;
       
      var tz=stackRevealZ(o.i,map.getZoom()),fired=false;
      function tapIt(){if(fired)return;fired=true;
        var pt=map.project(o.r.p),rc=map.getCanvasContainer().getBoundingClientRect();
        map.getCanvasContainer().dispatchEvent(new MouseEvent('click',
          {bubbles:true,cancelable:true,clientX:rc.left+pt.x,clientY:rc.top+pt.y}))}
      map.easeTo({center:o.r.p,zoom:tz,duration:600});
      map.once('moveend',function(){map.once('idle',tapIt)});
      setTimeout(tapIt,2000)})});
   
  var xs=recs.map(function(o){return o.r.p[0]}),ys=recs.map(function(o){return o.r.p[1]});
  var w=Math.max.apply(null,xs)-Math.min.apply(null,xs),
      h=Math.max.apply(null,ys)-Math.min.apply(null,ys);
  var z=map.getZoom();
   
  var target=null;
  if(w>1e-4||h>1e-4){
    var cv=map.getCanvas(),cw=cv.clientWidth,chh=cv.clientHeight;
    try{target=map.cameraForBounds(
      [[Math.min.apply(null,xs),Math.min.apply(null,ys)],
       [Math.max.apply(null,xs),Math.max.apply(null,ys)]],
      {padding:{top:Math.min(70,Math.round(chh*0.12)),
                bottom:Math.round(chh*0.38),
                left:Math.min(40,Math.round(cw*0.1)),right:Math.min(40,Math.round(cw*0.1))},
        
       maxZoom:Math.min(ZMAX_STACK,Math.max(Math.min(16.5,z+3.2),
         STACK_BANDS[Math.min(stackBand(z)+1,STACK_BANDS.length-1)]+0.01))})}catch(e){target=null}}
  if(target)map.easeTo({center:target.center,zoom:target.zoom,duration:700});
   
  else map.easeTo({center:f.geometry.coordinates,zoom:Math.max(z,Math.min(16.5,z+1.8)),duration:600});
}

function applyStackFilters(){
  var ids=Object.keys(STACKED).map(Number);
   
  ['poi-dot','poi-dot-major'].forEach(function(id){
    try{
      var base=POI_MODEF[id]||POI_BASE[id]||true;
      map.setFilter(id, ids.length
        ? ['all',base,['match',['get','i'],ids,false,true]]
        : base)}catch(e){}})}
map.on('moveend',restack);
 
['dragstart','rotatestart','zoomstart'].forEach(function(ev){
  map.on(ev,function(e){if(e&&e.originalEvent&&NAV.on&&NAV.follow){NAV.follow=false;navChip()}})});
el('nav-center').addEventListener('click',function(){NAV.follow=true;navChip();
   
  if(ME)map.easeTo(NAV.on?{center:ME,bearing:NAV.northUp?0:NAV.brg,pitch:NAV.northUp?0:55,duration:500}
                         :{center:ME,duration:500})});
el('nav-voice').addEventListener('click',function(){if(VOICE.ok)navVoiceToggle()});
el('nav-north').addEventListener('click',function(){NAV.northUp=!NAV.northUp;navChip();
  if(ME&&NAV.on&&NAV.follow)map.easeTo({center:ME,bearing:NAV.northUp?0:NAV.brg,pitch:NAV.northUp?0:55,duration:500})});
['dragstart','zoomstart','rotatestart'].forEach(function(ev){
  map.on(ev,function(e){if(e&&e.originalEvent)_userDrove=true})});
 
map.on('load',function(){makeBadges();setBasemap(bmi);wpDraw();showTab('map');
   
  try{map.setLayoutProperty('hillshade','visibility','none')}catch(e){}
   
   
  if(!tourSeen())setTimeout(tourStart,650);
   
  railSet(false);buildActPanel();actLabel();
  setTimeout(renderHealth,1800);
  var C=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.Geolocation;
  if(C){try{C.requestPermissions().then(locateOnce).catch(locateOnce)}catch(e){locateOnce()}}
  else locateOnce()});

 
var YOU=null,YOU_T=0,youM=null,LOCATE_N=0,LOCATE_MS=25000;
function locateOnce(cb){
   
  var handle=function(at,acc){
    YOU=at.slice();YOU_T=Date.now();
    if(!youM){var d=mk('you');youM=new maplibregl.Marker({element:d}).setLngLat(YOU).addTo(map)}
    else youM.setLngLat(YOU);
    classifyFix(at);
    if(posMode==='away')showAway(acc); else{posMode='gps';ME=at.slice();mM.setLngLat(ME);meFix(ME);paint();syncSafety()}
    drawCoverage();
    if(cb)try{cb(at)}catch(e){}};
   
  var done=false,h=null,counted=false,
      fin=function(){if(counted){counted=false;LOCATE_N--}gpsClear(h)};
  h=gpsWatch(function(at){
    if(done)return; done=true;
    fin();handle(at,null);
  },function(){ if(!done){done=true; fin(); if(cb)try{cb(null,'error')}catch(e){}} },LOCATE_MS);
  if(!h){if(done)return;if(cb)try{cb(null,'none')}catch(e){};return}    
   
  if(!done){LOCATE_N++;counted=true}else gpsClear(h);
   
  setTimeout(function(){ if(!done){done=true; fin();
    if(cb)try{cb(null,'timeout')}catch(e){} } },LOCATE_MS);}

function showAway(acc){
  showQuiet('<b>You are about '+Math.round(awayMi)+' mi from '+(BUNDLE.name||'this region')+
    '.</b><br>This download only covers the boxed area — everywhere else is '+
    'deliberately blank, not broken. <b>Planning mode</b> is on: browse, search, '+
    'press and hold a spot for <b>Start here</b> or <b>Route here</b>, '+
    'and <b>Set home</b> on the Plan tab.'+
    '<br><br>Tap <b>Locate</b> (Map tab) to jump to your real position, or a chip above to '+
    'jump to the riding area.',
    Math.round(awayMi)+' mi away \u00b7 planning mode')}

 
el('c-lost').addEventListener('click',function(){
  if(rideMode)return show('Live GPS is driving — the alert fires from your actual track, not a button.','');
  if(!riding)return show('Start <b>Ride it</b> first, then take a wrong turn and watch the alert fire.','');
  lost=true;buzz(40);
  show('Veering off at the next junction — this is the failure the whole app exists to catch.','')});

 
var HIT=['route72','trail50','moto24','mccct','fstrail','fsroad','closed','fsclosed','track','paved','minor','foot'];
 
var HIT_SHOW=['show-line'];
 
function lineWidthAt(v,z){
  if(typeof v==='number')return v;
  if(!Array.isArray(v)||v[0]!=='interpolate'||!Array.isArray(v[2])||v[2][0]!=='zoom')return 0;
  var st=v.slice(3);
  if(z<=st[0])return +st[1]||0;
  for(var k=2;k<st.length;k+=2)if(z<=st[k]){var t=(z-st[k-2])/(st[k]-st[k-2]);
    return (+st[k-1]||0)+t*((+st[k+1]||0)-(+st[k-1]||0))}
  return +st[st.length-1]||0}
function loTapMi(ll){
  var z=map.getZoom(),wmax=0;
  HIT.forEach(function(id){var v=null;try{v=map.getPaintProperty(id,'line-width')}catch(e){}
    var x=lineWidthAt(v,z);if(x>wmax)wmax=x});
  var mpp=78271.517*Math.cos(ll[1]*Math.PI/180)/Math.pow(2,z);
  return (9*Math.SQRT2+wmax/2+1)*mpp/1609.34}
function nearestDrawnEdge(ll,c,maxMi){
  var G=gridBuild(),best=1e9,bi=-1,seen={};
  var visit=function(list){
    for(var j=0;j<list.length;j++){var i=list[j];if(seen[i])continue;seen[i]=1;
      var ed=EDGES[i];if(!ed||!ed.d||ed.c!==c)continue;
      var g=decode(GR.g[i]);
      for(var k=1;k<g.length;k++){var d=segNear(ll,g[k-1],g[k]).d;if(d<best){best=d;bi=i}}}};
  visit.done=function(r){return ringMi(r)>maxMi||(bi>=0&&ringMi(r+1)>best)};
  gridRings(ll,G.edges,visit,Math.ceil(maxMi/(GCS*0.714*69))+2);
  return bi>=0&&best<=maxMi?bi:-1}
map.on('click',function(e){
  if(lp.fired){lp.fired=false;return}    
   
  try{var sf=map.queryRenderedFeatures(
      [[e.point.x-18,e.point.y-18],[e.point.x+18,e.point.y+18]],
      {layers:['poi-stack-bg','poi-stack']});
    if(sf.length&&+sf[0].properties.n>1)return stackCard(sf[0])}catch(_e){}
  if(arm){var ll=[e.lngLat.lng,e.lngLat.lat];
    if(arm==='home'){HOME=ll;homeSave();homeMark()}else{ME=ll;mM.setLngLat(ll);syncSafety()}
    arm=null;syncArm();clearRoute();
    return show('Placed. Tap <b>Return home</b> to route.','')}
   
   
  RAIL_AT=[e.lngLat.lng,e.lngLat.lat];
  var box=[[e.point.x-13,e.point.y-13],[e.point.x+13,e.point.y+13]];
  var dam=map.queryRenderedFeatures(box,{layers:['pad-dam']});
  var padf2=dam.length?dam:map.queryRenderedFeatures(box,{layers:['pad-dot']});
  if(padf2.length&&padf2[0].geometry&&padf2[0].geometry.coordinates)
    return paddleCard(padf2[0]);
   
  var pf0=map.queryRenderedFeatures(box,{layers:['pub-fill']});
  if(pf0.length&&pf0[0].properties&&pf0[0].properties.n){
    var nf0=map.queryRenderedFeatures([[e.point.x-9,e.point.y-9],[e.point.x+9,e.point.y+9]],
      {layers:HIT.concat(HIT_SHOW).concat(['area-fill','poi-dot','poi-dot-major'])});
    if(!nf0.length)return pubCard(pf0[0].properties);}
  var af=map.queryRenderedFeatures(box,{layers:['area-fill']});
  if(af.length&&af[0].properties&&af[0].properties.n){
    var nf=map.queryRenderedFeatures([[e.point.x-9,e.point.y-9],[e.point.x+9,e.point.y+9]],
      {layers:HIT.concat(HIT_SHOW)});
    if(!nf.length)return areaCard(af[0].properties);}

   
  var pf=map.queryRenderedFeatures([[e.point.x-11,e.point.y-11],[e.point.x+11,e.point.y+11]],
    {layers:['poi-dot-major','poi-dot']});
   
  if(pf.length&&pf[0].geometry&&pf[0].geometry.coordinates){
     
    var pr=pf[0].properties,pp=pf[0].geometry.coordinates,
        pc='<span class="tn">'+pp[1].toFixed(5)+'  '+pp[0].toFixed(5)+'</span>';
    logAct('tap  place '+(pr.n||pr.k));
     
    var wrun=(mode==='water'&&(pr.k==='launch'||pr.k==='livery'||pr.k==='marina'))
      ?nearStop(pp):null;
     
    var campLine='';
    if(pr.k==='camp'){var ct=null;try{ct=pr.ct?JSON.parse(pr.ct):null}catch(e){}
      var bits=[];
      if(ct&&ct.op)bits.push({dnr:'State forest campground (DNR)',usfs:'National forest campground (USFS)',
        county:'County or municipal',private:'Private'}[ct.op]||ct.op);
      if(ct&&ct.ty)bits.push(ct.ty==='rustic'?'rustic — vault toilets, no hookups':'modern — hookups or services');
      if(ct&&ct.fee===true)bits.push('fee');if(ct&&ct.fee===false)bits.push('free');
      if(ct&&ct.disp)bits.push('dispersed');
      campLine='<div class="sub">'+(bits.length?bits.join(' \u00b7 '):'Type not recorded in the source')+'</div>'}
    show('<b>'+(pr.named?pr.n:pr.h)+'</b>'+
      (pr.named?'<div class="sub">'+pr.h+(pr.mi?' \u00b7 '+pr.mi+' mi of trail':'')+
          (pr.w?' \u00b7 named for the lake it is on; the source has no name for this spot':'')+'</div>':
                '<div class="sub">'+(pr.ph?'The source names it only \u201c'+
                  String(pr.ph).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+
                  '\u201d \u2014 shown by what it is':'Unnamed in the source \u2014 shown by what it is')+'</div>')+
      campLine+
      (pr.named?photoHTML(pr.k,pr.n,pp):'')+
       
      (function(){if(pr.k!=='ski')return '';
        var rec=((POIS&&POIS.p)||[])[pr.i]||{},x='';
        var DCOL={green:'#2F7D4F',blue:'#2E6FA8',black:'#141414',expert:'#141414',park:'#7A5B3A'};
        var DLAB={green:'Beginner',blue:'Intermediate',black:'Advanced',expert:'Expert',park:'Terrain park'};
        if(rec.runs&&rec.runs.length)x+='<div class="k">RUNS \u00b7 '+rec.runs.length+'</div>'+
          '<div class="sub">'+rec.runs.map(function(r){return '<span class="dot" style="background-color:'+
          (DCOL[r.d]||'var(--pin-unknown)')+'"></span> '+r.n+(DLAB[r.d]?' \u00b7 '+DLAB[r.d]:'')}).join('<br>')+'</div>';
        if(rec.web)x+='<div class="sub"><a href="'+rec.web+'" target="_blank" style="color:var(--link)">Website '+ic('external')+'</a></div>';
        return x})()+
      (wrun?'<div class="k">ON THE '+wrun.riv.toUpperCase().replace('RIVER','').trim()+' RIVER</div>'+
        '<div class="sub">'+
        (RUNFROM&&RUNFROM.riv===wrun.riv&&Math.abs(RUNFROM.mi-wrun.stop.mi)>0.05
          ?'<button class="chip" id="wr-to">'+ic('route')+'<span>Run from '+
            (RUNFROM.n||PADKIND[RUNFROM.k]||'there')+' to here</span></button> '+
            '<button class="chip" id="wr-cancel">'+ic('close')+'<span>Cancel</span></button>'
          :'<button class="chip" id="wr-from">'+ic('route')+'<span>Plan a run from here</span></button>')+
        '</div>':'')+
      '<div class="k">WHERE</div>'+pc+
      '<div class="sub">'+placeDist(pf[0].geometry.coordinates)+'</div>','');
    if(wrun){
      var w1=el('wr-from');
      if(w1)w1.addEventListener('click',function(){
        RUNFROM={mi:wrun.stop.mi,n:pr.n||wrun.stop.n,k:wrun.stop.k,riv:wrun.riv};
        logAct('act  run from '+(pr.n||pr.k)+' (pin bridge)');
        show('<b>'+(pr.n||'Here')+'</b> is the first end.<br>'+
          'Now tap the other end of the run — a launch pin or a stop on the '+
          wrun.riv+'.','')});
      var w2=el('wr-to');
      if(w2)w2.addEventListener('click',function(){
        runCard(RUNFROM,{mi:wrun.stop.mi,n:pr.n||wrun.stop.n,k:wrun.stop.k},wrun.riv)});
      var w3=el('wr-cancel');
      if(w3)w3.addEventListener('click',function(){runClear();ack('Run cancelled.')});
    }
    return;
  }
  var f=map.queryRenderedFeatures([[e.point.x-9,e.point.y-9],[e.point.x+9,e.point.y+9]],
    {layers:HIT.concat(HIT_SHOW)});
  if(!f.length){
     
     
    {  
      railSet(false);RAIL_MANUAL=false;
      var pt=el('peek-txt');
      if(pt)pt.textContent='Nothing there \u2014 press and hold to drop a pin';
      return}}
   
  var loHit=false;
  if(f[0].properties.lo){
    var lll=[e.lngLat.lng,e.lngLat.lat],
        li=nearestDrawnEdge(lll,f[0].properties.c,loTapMi(lll));
    if(li<0){
      if(pf0&&pf0.length&&pf0[0].properties&&pf0[0].properties.n)return pubCard(pf0[0].properties);
      if(af&&af.length&&af[0].properties&&af[0].properties.n)return areaCard(af[0].properties);
      return show('That line is too fine to pick out at this zoom \u2014 zoom in and tap it again.','')}
    loHit=true;
    f=[{properties:{i:li,c:EDGES[li].c}}]}
  if(f[0].properties.i===undefined){
     
    var pr=f[0].properties;
    return show('<span class="tn">'+(pr.n||pr.u||'Route')+'</span>'+
      '<span class="tag adv">'+(pr.u||SHOWN[pr.c]||pr.c)+'</span><br>'+
      '<b>Not an ORV route.</b> It is on the map because it exists and can help '+
      'you place yourself — routing will never use it.','')}
  var ed=EDGES[f[0].properties.i],a=attrs(ed);
  var out='<span class="tn">'+(ed.n||label(ed.c))+'</span><br>';
   
  if(loHit)out+='<div class="sub">The nearest '+label(ed.c)+' segment to your tap at this zoom '+
    '\u2014 zoom in and tap again for the exact one. Everything on this card is about that segment.</div>';
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
   
  var _rs=restrictOf(ed);
  if(_rs){
    var banned=_rs.ban&&_rs.ban.indexOf(machine)>=0;
    bits.push('<br><b'+(banned?' style="color:var(--danger-text)"':'')+'>'+(loHit?'This segment \u2014 ':'')+
      (banned?'NOT for your machine — ':'Restriction: ')+'</b>'+_rs.say+
      (_rs.unknown?' <span class="sub">(as published; not interpreted)</span>':''));}
  if(UP[ed.i]||DN[ed.i])bits.push('+'+ft(UP[ed.i])+' / -'+ft(DN[ed.i])+' ft');
  show(out+bits.join(' · '),'')});

 
var RAIL_AT=null;           
var RAIL_MANUAL=false;      

 
var GPS_WAIT='Waiting for a GPS fix';
function rideWaiting(){return !!(rideMode&&!gotFix&&!riding)}
function railPeekText(){
  if(rideWaiting())return GPS_WAIT+' \u2014 '+(RESUMING?crumbMi.toFixed(1)+' mi recorded, kept':'nothing recorded yet');
   
  if(gotFix&&fixStale())return 'No GPS fix since '+fixClock();
  if(TRUCK&&ME){
    var d=mi(ME,TRUCK);
    return 'Truck '+(d<10?d.toFixed(1):Math.round(d))+' mi '+compass(bearing(ME,TRUCK))}
  if(RAIL_AT)return 'Details';
  return ''}

function railSet(open,at){
  var r=el('rail');
  if(!r)return;
  if(open){
    RAIL_AT=at||RAIL_AT||null;
    r.className='';
  }else{
    RAIL_AT=null;
    r.className='folded';
  }
  var t=el('peek-txt');
  if(t)t.textContent=open?railPeekText():
    (RAIL_AT?'Details':railPeekText());
  sheetH();
   
  rcFit()}

function railFoldIfAway(e){
   
   
  if(!e||!e.originalEvent)return;
  if(RAIL_MANUAL||!RAIL_AT)return;
  try{
    var p=map.project(RAIL_AT),b=map.getContainer().getBoundingClientRect();
    if(p.x<-40||p.y<-40||p.x>b.width+40||p.y>b.height+40)railSet(false);
  }catch(e){}}

 
function cardHTML(h,s){show(h,s)}

 
function showQuiet(h,peekLine){
  var p=el('panel');p.innerHTML=h;p.className='';
  var t=el('peek-txt');
  if(t&&peekLine)t.textContent=peekLine;}

 
 
function ack(h){
  showQuiet(h,'');RAIL_MANUAL=false;railSet(false);
  toast(String(h).replace(/<[^>]*>/g,''),2400)}

function rideCard(h,s,peekLine){
  if(rideMode||riding){showQuiet(h,peekLine);return}
  show(h,s)}

function show(h,s){
  var p=el('panel');p.innerHTML=h;
   
  p.className=s||'';
  void p.offsetWidth;
  p.className=(s?s+' ':'')+'swap';
   
  RAIL_MANUAL=false;railSet(true);}

var geo=new maplibregl.GeolocateControl({positionOptions:{enableHighAccuracy:true},
  trackUserLocation:true,showAccuracyCircle:true});
map.addControl(geo,'top-right');
 
try{map.addControl(new maplibregl.ScaleControl({maxWidth:96,unit:'imperial'}),'bottom-left')}catch(e){}
el('c-locate').addEventListener('click',function(){
  if(NAV.on){NAV.follow=true;navChip()}
  if(flyToYou())return;
   
  if(YOU){var was=new Date(YOU_T).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
    show('<b>Waiting for a GPS fix\u2026</b><br>Your last fix was at '+was+
      '; the map moves to you when a new one arrives.','');
    return locateOnce(function(at,why){
      if(at){flyToYou();return}
      show('<b>No new GPS fix.</b><br>Your last fix was at '+was+' \u2014 you may have '+
        'moved since. Try again in the open.','')})}
  locateOnce();
  setTimeout(function(){if(!flyToYou())geo.trigger()},1200)});
geo.on('error',function(){show('Location unavailable — this phone did not give a position (location permission off, or no fix yet). Place yourself by hand with <b>I&#39;m here</b> on the Plan tab.','fail')});

 
el('chips').innerHTML='';
el('chips').style.display='none';
function jumpChipsHTML(){
  return '<div class="sub" style="margin:2px 0 7px">Jump to</div>'+
    PLACES.map(function(p,i){
      return '<button class="chip" data-jump="'+i+'" style="margin:0 6px 6px 0">'+
        p[0]+'</button>'}).join('')}
function wireJumpChips(root){
  Array.prototype.forEach.call(root.querySelectorAll('[data-jump]'),function(c){
    c.addEventListener('click',function(){var p=PLACES[+c.dataset.jump];
      map.easeTo({center:[p[1],p[2]],zoom:p[3]==='town'?13.2:13.8,
        duration:700,essential:true});railSet(false)})})}

function refreshReadout(){
  var c=map.getCenter(),e=elevAt([c.lng,c.lat]);
  var r=el('ro-elev');
   
  if(r)r.textContent=(e===null?'':ft(e)+' ft elevation');
  var v=el('v-elev');
  if(v)v.textContent=(e===null?'—':ft(e)+' ft')}

function paint(){var c=map.getCenter();
  var e=elevAt([c.lng,c.lat]);
   
  var tag=posMode==='gps'?'DD · MAP CENTRE':posMode==='sim'?'DD · MAP CENTRE · simulated ride':
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
       
      drew=renderedCount(),
      pass=avg>=50&&mn>=30&&remoteHits===0&&drew>0;
  show('<b>'+(pass?'PASS':'FAIL')+'</b> · avg <b>'+avg+'</b> fps · p99 min <b>'+mn+
   '</b> fps · remote <b>'+remoteHits+'</b><br>'+drew+' of '+EDGES.length+
   ' edges actually rendered. '+(drew===0?
     'ZERO drew — the high frame rate is an idle renderer, not speed. Run the Self-test for the render checks.':
     pass?'Holds up with the full routable network loaded.'
   :'Below threshold — note both numbers before comparing to the APK.'),
   pass?'pass':'fail')}
 
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
