 
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
  bike:{lbl:'🏍 Dirt bike 24"',ok:['route72','trail50','moto24','mccct','fstrail','fsroad','paved','minor','track']},
  quad:{lbl:'🛻 Quad 50"',ok:['route72','trail50','mccct','fstrail','fsroad','paved','minor','track']},
  sxs:{lbl:'🚙 Side-by-side 72"',ok:['route72','fsroad','paved','minor']},
   
  walk:{lbl:'🥾 On foot',ok:['foot','route72','trail50','moto24','mccct','fstrail','fsroad','paved','minor','track'],spd:3},
   
  kayak:{lbl:'🛶 Kayak',ok:[],mph:3.0,spread:0.5},
  canoe:{lbl:'🛶 Canoe',ok:[],mph:2.5,spread:0.5},
  raft:{lbl:'🛟 Raft / tube',ok:[],mph:1.8,spread:0.4}
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

 
 
function strokeLen(pts){
  var m=0;
  for(var i=1;i<pts.length;i++){
    var dx=(pts[i][0]-pts[i-1][0])*79000,dy=(pts[i][1]-pts[i-1][1])*111320;
    m+=Math.sqrt(dx*dx+dy*dy)}
  return Math.round(m)}

 
 
function placeDist(p){
  if(!ME)return '';
  var d=mi(ME,p);
  return d.toFixed(d<10?1:0)+' mi '+compass(bearing(ME,p))+' of you';}

function chainStrokes(key){
  key=key||labelFor;
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
  fuel:     {c:'#C1121F', h:'Fuel',        r:1, g:'fuel'},
  trailhead:{c:'#D2500C', h:'Trailhead',   r:1, d:1, g:'flag'},
  camp:     {c:'#7A5B3A', h:'Campground',  r:2, d:1, g:'tent'},
  launch:   {c:'#2E7FA8', h:'Boat launch', r:2, d:1, g:'boat'},
  beach:    {c:'#C9A227', h:'Beach',       r:3, d:1, g:'sun'},
  dayuse:   {c:'#3D6B35', h:'Day use',     r:3, d:1, g:'tree'},
   
  system:   {c:'#2F7D4F', h:'Trail system', r:1, d:1, g:'tree'},
   
  lighthouse:{c:'#B23A48', h:'Lighthouse', r:0, d:1, g:'eye'},
  marina:   {c:'#2E7FA8', h:'Marina',      r:2, d:1, g:'boat'},
  ski:      {c:'#3D6CB3', h:'Ski & snowboard hill', r:1, d:1, g:'ski'},
  livery:   {c:'#1E8C7A', h:'Canoe & kayak livery', r:1, d:1, g:'boat'},
  mtb:      {c:'#1F7A6B', h:'MTB trail system', r:1, d:1, g:'bike'},
  store:    {c:'#6B4FA0', h:'Store',       r:3, g:'bag'},
  food:     {c:'#6B4FA0', h:'Food',        r:4, g:'cup'},
  view:     {c:'#3D6B35', h:'Viewpoint',   r:4, d:1, g:'eye'},
  info:     {c:'#4A5560', h:'Information', r:5, g:'i'},
  water:    {c:'#2E7FA8', h:'Drinking water', r:5, g:'drop'},
  toilet:   {c:'#4A5560', h:'Toilets',     r:6, g:'i'},
  shelter:  {c:'#4A5560', h:'Shelter',     r:6, g:'tent'}
};

function makeBadges(){
   
  var G={
    tree:function(x){x.moveTo(13,6);x.lineTo(8,15);x.lineTo(18,15);x.closePath();
      x.moveTo(13,15);x.lineTo(13,19)},
     
    bike:function(x){x.moveTo(11,17);x.arc(8,17,3,0,Math.PI*2);x.moveTo(21,17);x.arc(18,17,3,0,Math.PI*2);
      x.moveTo(8,17);x.lineTo(12,10);x.lineTo(18,17);x.moveTo(12,10);x.lineTo(16,10);
      x.moveTo(12,10);x.lineTo(13,17);x.moveTo(16,10);x.lineTo(18,17);x.moveTo(11,9);x.lineTo(14,9)},
     
    ski:function(x){x.moveTo(16.6,6.5);x.arc(15,6.5,1.6,0,Math.PI*2);
      x.moveTo(14,8.5);x.lineTo(11.5,13);x.moveTo(13,10.5);x.lineTo(16.5,12.5);x.lineTo(18,17);
      x.moveTo(11.5,13);x.lineTo(9.5,16.2);x.moveTo(11.5,13);x.lineTo(12.5,16.2);
      x.moveTo(6,18.6);x.lineTo(16,15.4);x.moveTo(7.2,20.4);x.lineTo(17.2,17.2)},
    tent:function(x){x.moveTo(6,18);x.lineTo(13,7);x.lineTo(20,18);x.closePath();
      x.moveTo(13,18);x.lineTo(13,12)},
    boat:function(x){x.moveTo(6,15);x.lineTo(20,15);x.lineTo(17,19);x.lineTo(9,19);
      x.closePath();x.moveTo(13,15);x.lineTo(13,6);x.lineTo(18,12);x.lineTo(13,12)},
    fuel:function(x){x.rect(8,7,7,12);x.moveTo(15,11);x.lineTo(18,11);
      x.lineTo(18,17)},
    flag:function(x){x.moveTo(9,20);x.lineTo(9,6);x.lineTo(18,9);x.lineTo(9,12)},
    sun:function(x){x.arc(13,13,4,0,6.283);x.moveTo(13,5);x.lineTo(13,7);
      x.moveTo(13,19);x.lineTo(13,21);x.moveTo(5,13);x.lineTo(7,13);
      x.moveTo(19,13);x.lineTo(21,13)},
    drop:function(x){x.moveTo(13,6);x.bezierCurveTo(9,12,8,14,8,16);
      x.arc(13,16,5,3.1416,0,true);x.bezierCurveTo(18,14,17,12,13,6)},
    bag:function(x){x.rect(8,10,10,9);x.moveTo(10,10);x.arc(13,10,3,3.1416,0)},
    cup:function(x){x.moveTo(8,8);x.lineTo(8,16);x.arc(11,16,3,3.1416,0,true);
      x.moveTo(14,8);x.lineTo(14,14);x.moveTo(14,10);x.arc(14,12,2,-1.57,1.57)},
    eye:function(x){x.moveTo(6,13);x.bezierCurveTo(9,8,17,8,20,13);
      x.bezierCurveTo(17,18,9,18,6,13);x.moveTo(15,13);
      x.arc(13,13,2,0,6.283)},
    i:function(x){x.moveTo(13,11);x.lineTo(13,18);x.moveTo(13,7);x.lineTo(13,8)},
    dam:function(x){x.moveTo(7,7);x.lineTo(13,18);x.lineTo(19,7);
      x.moveTo(13,10);x.lineTo(13,13)}
  };
  var done={};
  function one(name,color,glyph){
    if(done[name]||!map.addImage)return;
     
    if(!document.createElement('canvas').getContext)return;
    done[name]=1;
    var S=2,c=document.createElement('canvas');c.width=c.height=26*S;
    var x=c.getContext('2d');x.scale(S,S);
    x.beginPath();x.arc(13,13.6,11,0,6.283);x.fillStyle='rgba(0,0,0,.22)';x.fill();
    x.beginPath();x.arc(13,13,11,0,6.283);x.fillStyle=color;x.fill();
    x.lineWidth=1.6;x.strokeStyle='#FFFFFF';x.stroke();
    x.beginPath();x.lineWidth=1.7;x.lineCap='round';x.lineJoin='round';
    (G[glyph]||G.i)(x);x.stroke();
    try{map.addImage(name,x.getImageData(0,0,26*S,26*S),{pixelRatio:S})}catch(e){}}
  Object.keys(POIKIND).forEach(function(k){
    one('bdg-'+k,POIKIND[k].c,POIKIND[k].g)});
  one('bdg-pad-launch','#2E7FA8','boat');one('bdg-pad-access','#2E8B99','boat');
  one('bdg-pad-camp','#7A5B3A','tent');one('bdg-pad-parking','#4A5560','i');
  one('bdg-dam','#C1121F','dam');
   
  if(!done['mi-diamond']&&map.addImage&&document.createElement('canvas').getContext){done['mi-diamond']=1;
    var S2=2,cv=document.createElement('canvas');cv.width=cv.height=30*S2;
    var g=cv.getContext('2d');g.scale(S2,S2);g.translate(15,15);g.rotate(Math.PI/4);
    var h=9.6;
    g.beginPath();g.rect(-h,-h,h*2,h*2);
    g.fillStyle='#FFFFFF';g.fill();
    g.lineWidth=1.8;g.strokeStyle='#1C1A16';g.stroke();
    try{map.addImage('mi-diamond',g.getImageData(0,0,30*S2,30*S2),{pixelRatio:S2})}catch(e){}}}
 
var SERVICES=['food','store','fuel'];
var CLUSTER_MAXZ=11.4;    
function stackRadius(z){  
  if(z<=8)return 48; if(z>=14)return 24;
  return 48-(z-8)*4}    
var poif=((POIS&&POIS.p)||[]).map(function(r,i){
  var k=POIKIND[r.k]||{c:'#4A443B',h:r.k,r:7};
  return {type:'Feature',
    properties:{i:i,k:r.k,h:k.h,c:k.c,r:k.r,d:k.d?1:0,pri:(r.pri==null?3:r.pri),
      ct:r.ct?JSON.stringify(r.ct):'',w:r.w?1:0,
       
      n:r.n||k.h,named:r.n?1:0,mi:r.mi||0},
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
        lb:(f.n||({dam:'Dam',launch:'Boat launch',access:'Canoe access',
                   camp:'Campground',parking:'Parking'}[f.k]||f.k))},
      geometry:{type:'Point',coordinates:f.p}})})});

 
var PADKIND={dam:'Dam',launch:'Boat launch',access:'Canoe access',
             camp:'Campground',parking:'Parking'};

 
var PADDLE_MPH=2.5, PADDLE_SPREAD=0.5;

function paddleHours(miles){
   
  var mc=MACHINE[machine]||{};
  var mph=mc.mph||PADDLE_MPH, spr=mc.mph?(mc.spread||PADDLE_SPREAD):PADDLE_SPREAD;
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

 
function magStart(){
  if(MAG_OK!==null)return;
  MAG_OK=false;
  var onEv=function(e){
    var deg=null;
    if(typeof e.webkitCompassHeading==='number')deg=e.webkitCompassHeading;
    else if(e.absolute===true&&typeof e.alpha==='number')deg=(360-e.alpha)%360;
    else if(typeof e.alpha==='number')deg=(360-e.alpha)%360;
    if(deg===null||isNaN(deg))return;
     
    MAG_OK=true;MAG=(deg+360)%360;
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
      '" y2="'+y2.toFixed(1)+'" stroke="'+(major?'#F2ECE0':'#9C9384')+
      '" stroke-width="'+(major?1.6:1)+'"/>'}
  var lbl='',C=['N','E','S','W'];
  for(i=0;i<4;i++){
    a=(i*90-(deg||0))*Math.PI/180;
    lbl+='<text x="'+(50+Math.sin(a)*31).toFixed(1)+'" y="'+(50-Math.cos(a)*31+3.4).toFixed(1)+
      '" text-anchor="middle" font-size="10" font-weight="700" fill="'+
      (i===0?'#E2570F':'#F2ECE0')+'">'+C[i]+'</text>'}
  return '<svg viewBox="0 0 100 100" width="128" height="128" aria-hidden="true">'+
    '<circle cx="50" cy="50" r="47" fill="none" stroke="rgba(255,255,255,.22)"/>'+
    ticks+lbl+
    (deg===null?'':'<path d="M50 8 L45 20 L55 20 Z" fill="#E2570F"/>')+
    '<circle cx="50" cy="50" r="2.4" fill="#F2ECE0"/></svg>'}

function cmpRows(hdg){
  var out=[];
  if(hdg===undefined){var H=headingNow();hdg=H?H.deg:null}
  function row(label,at){
    if(!at||!ME)return;
    var b=bearing(ME,at),d=mi(ME,at);
     
    if(d<0.02){out.push('<b>'+label+'</b> <span style="color:#9C9384">'+
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
    (hdg===null?'<span style="color:#9C9384;font-size:var(--t-sm)">'+
       (MAG_OK===false?'this phone is not reporting a compass \u2014 start moving '+
         'and it will use your GPS course instead'
        :'waiting for the compass\u2026')+'</span>'
     :compass(hdg)+' <span style="color:#9C9384">'+Math.round(hdg)+'\u00B0 true \u00B7 '+
       (H.src==='compass'?'compass':'course')+'</span>')+
    '</div></div>'+
    (rows.length?'<div style="margin-top:9px;line-height:1.7">'+rows.join('<br>')+'</div>'
     :'<div class="sub" style="margin-top:9px">Nothing to take a bearing to yet — '+
      'pin the truck, set home, or save a waypoint.</div>')}

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
    rows.push('<b style="color:#C1121F">'+dams.length+' dam'+(dams.length>1?'s':'')+
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
  var _mc=MACHINE[machine]||{}, _craft=_mc.mph?_mc.lbl.replace(/^\S+\s/,''):null;
  rows.push('Roughly <b>'+paddleHours(hi-lo)+'</b> of paddling'+
    (dams.length?' plus the portage'+(dams.length>1?'s':''):'')+
    ' <span class="sub">'+(_craft?'as a '+_craft.toLowerCase()+' at '+
      (_mc.mph-_mc.spread)+'\u2013'+(_mc.mph+_mc.spread)+' mph, calibrated '
      :'at 2\u20133 mph, which is what these floats work out at ')+
    'against the liveries\u2019 own times</span>');
  logAct('act  run '+nm(putIn)+' -> '+nm(takeOut));
  show('<div class="tn">The run \u2014 <span class="sub">'+riv+'</span></div>'+
    rows.join('<br>')+
    '<div class="sub" style="margin-top:8px">'+
    '<button class="chip" id="pd-nav">'+ic('play')+'<span>Navigate this run</span></button> '+
    '<button class="chip" id="pd-clear">'+ic('close')+'<span>Clear</span></button></div>',
    dams.length?'fail':'pass');
  var cb=el('pd-clear');
  if(cb)cb.addEventListener('click',function(){runClear();show('Run cleared.','')});
   
  var nb=el('pd-nav');
  if(nb)nb.addEventListener('click',function(){
    runSet(riv,putIn,takeOut);
    if(mode!=='water')applyMode('water',{silent:true});
    if(!rideMode)el('c-ride').click();
    show('<b>Navigating the '+riv+'</b><div class="sub">'+(putIn.n||'Put-in')+
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
    'this is ground, not a trail, so Return home and Directions route to its '+
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
    rows.push('<b style="color:#C1121F">DAM — you must take out and portage.</b>');
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
      (dams.length?' · <b style="color:#C1121F">'+dams.join(', ')+' in between — portage</b>'
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
      '<button class="chip" id="pd-gauge">'+ic('info')+
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
  if(f3)f3.addEventListener('click',function(){runClear();show('Run cancelled.','')});
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
  filter:['==',['get','c'],cls],layout:{'line-cap':dash?'butt':'round','line-join':'round'},
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
            return sleep(PAUSE).then(function(){return M.fetchTile(t[0],t[1],t[2])})})
          .then(function(buf){return HD.put(t[0],t[1],t[2],buf)
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
var SATBOX=SAT_OK?SATB:(BUNDLE.bbox||[0,0,1,1]);
var SATURL=SAT_OK?SAT:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
 
var _booted=false,_userDrove=false;
function bootEase(at){
  if(_booted||_userDrove)return;_booted=true;
  try{map.easeTo({center:at,zoom:Math.max(map.getZoom(),10.2),duration:900,
    essential:true})}catch(e){}}
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

    net:{type:'geojson',data:{type:'FeatureCollection',features:nf2}},
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
      paint:{'raster-opacity':1,'raster-fade-duration':0,
        'raster-saturation':-0.35,'raster-brightness-max':0.82,
        'raster-contrast':0.06}},
     
    (SPARSE&&TILES.zmin<=11)?{id:'sat-base',type:'raster',source:'satbase',layout:{visibility:'none'},
      paint:{'raster-opacity':1,'raster-fade-duration':150}}
      :{id:'sat-base',type:'circle',source:'satbase',layout:{visibility:'none'},paint:{'circle-radius':0}},
    SPARSE?{id:'sat-patch',type:'raster',source:'satpatch',layout:{visibility:'none'},
      paint:{'raster-opacity':1,'raster-fade-duration':150}}
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
      filter:['in',['get','c'],['literal',['route72','trail50','moto24','mccct','fstrail']]],
       
      paint:{'line-color':'#FFFFFF','line-opacity':0.95,'line-width':w(3.2,7.2,15)}},
     
    {id:'casing-track',type:'line',source:'net',
      layout:{'line-cap':'round','line-join':'round'},
      filter:['==',['get','c'],'track'],
      paint:{'line-color':'#FFFFFF','line-opacity':0.75,'line-width':w(1.7,3.8,8)}},
     
    {id:'casing-fsroad',type:'line',source:'net',
      layout:{'line-cap':'round','line-join':'round'},
      filter:['==',['get','c'],'fsroad'],
      paint:{'line-color':'#FFFFFF','line-opacity':0.55,'line-width':w(1.2,2.6,5.5)}},
     
     
    lyr('minor-case','minor','#C9C8C2',w(1.2,2.1,3.8)),
    lyr('paved-case','paved','#BFBEB8',w(1.9,3.4,6.6)),
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
        'text-offset':[0,1.15],'text-anchor':'top','text-padding':3,
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
        'text-offset':[0,1.5],'text-anchor':'top','text-padding':3,
        'text-optional':true,'symbol-sort-key':['get','r']},
      paint:{'text-color':['get','c'],'text-halo-color':'#FFFFFF',
        'text-halo-width':1.9}},
     
     
    {id:'poi-stack-bg',type:'circle',source:'poistack',
      paint:{'circle-color':['get','c'],'circle-stroke-color':'#FFFFFF',
        'circle-stroke-width':2,
        'circle-radius':['interpolate',['linear'],['get','n'],
          2,13, 10,16, 50,20, 200,24]}},
    {id:'poi-stack',type:'symbol',source:'poistack',
      layout:{'text-field':['to-string',['get','n']],'text-font':['APEX'],
        'text-size':['interpolate',['linear'],['get','n'],2,12,50,14],
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
      layout:{visibility:'none',
        'icon-image':['concat','bdg-pad-',['get','k']],
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

 
 
var ICONS={
  mountain:'<path d="m8 3 4 8 5-5 5 15H2L8 3z" />',
 
  layers:'<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" /> <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" /> <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />',
  vehicle:'<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" /> <circle cx="7" cy="17" r="2" /> <path d="M9 17h6" /> <circle cx="17" cy="17" r="2" />',
  home:'<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /> <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />',
  here:'<line x1="2" x2="5" y1="12" y2="12" /> <line x1="19" x2="22" y1="12" y2="12" /> <line x1="12" x2="12" y1="2" y2="5" /> <line x1="12" x2="12" y1="19" y2="22" /> <circle cx="12" cy="12" r="7" />',
  fuel:'<path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0v-6.998a2 2 0 0 0-.59-1.42L18 5" /> <path d="M14 21V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16" /> <path d="M2 21h13" /> <path d="M3 9h11" />',
  play:'<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />',
  stop:'<rect width="18" height="18" x="3" y="3" rx="2" />',
  alert:'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /> <path d="M12 9v4" /> <path d="M12 17h.01" />',
  locate:'<line x1="2" x2="5" y1="12" y2="12" /> <line x1="19" x2="22" y1="12" y2="12" /> <line x1="12" x2="12" y1="2" y2="5" /> <line x1="12" x2="12" y1="19" y2="22" /> <circle cx="12" cy="12" r="7" /> <circle cx="12" cy="12" r="3" />',
  clock:'<circle cx="12" cy="12" r="10" /> <path d="M12 6v6l4 2" />',
  info:'<circle cx="12" cy="12" r="10" /> <path d="M12 16v-4" /> <path d="M12 8h.01" />',
  loop:'<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /> <path d="M21 3v5h-5" />',
  star:'<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />',
  shield:'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />',
  search:'<path d="m21 21-4.34-4.34" /> <circle cx="11" cy="11" r="8" />',
  map:'<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z" /> <path d="M15 5.764v15" /> <path d="M9 3.236v15" />',
  sat:'<path d="m13.5 6.5-3.148-3.148a1.205 1.205 0 0 0-1.704 0L6.352 5.648a1.205 1.205 0 0 0 0 1.704L9.5 10.5" /> <path d="M16.5 7.5 19 5" /> <path d="m17.5 10.5 3.148 3.148a1.205 1.205 0 0 1 0 1.704l-2.296 2.296a1.205 1.205 0 0 1-1.704 0L13.5 14.5" /> <path d="M9 21a6 6 0 0 0-6-6" /> <path d="M9.352 10.648a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l4.296-4.296a1.205 1.205 0 0 0 0-1.704l-2.296-2.296a1.205 1.205 0 0 0-1.704 0z" />',
  target:'<circle cx="12" cy="12" r="10" /> <line x1="22" x2="18" y1="12" y2="12" /> <line x1="6" x2="2" y1="12" y2="12" /> <line x1="12" x2="12" y1="6" y2="2" /> <line x1="12" x2="12" y1="22" y2="18" />',
  phone:'<path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />',
  close:'<path d="M18 6 6 18" /> <path d="m6 6 12 12" />',
  check:'<path d="M20 6 9 17l-5-5" />',
  pin:'<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" /> <circle cx="12" cy="10" r="3" />',
  truck:'<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" /> <path d="M15 18H9" /> <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" /> <circle cx="17" cy="18" r="2" /> <circle cx="7" cy="18" r="2" />',
  route:'<circle cx="6" cy="19" r="3" /> <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" /> <circle cx="18" cy="5" r="3" />',
};

function ic(n,sz){
  var d=ICONS[n];
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

function mk(cls,txt){var d=document.createElement('div');d.className='pin '+cls;
  d.textContent=txt;return d}
 
function anchorOf(kind,skip){
  for(var i=0;i<PLACES.length;i++){var p=PLACES[i];
    if(p[3]===kind&&(!skip||p[0]!==skip))return [p[1],p[2]]}
  for(var i=0;i<PLACES.length;i++){var p=PLACES[i];
    if(!skip||p[0]!==skip)return [p[1],p[2]]}
  return CTR}
 
var HOMEKEY='apex.home.v1',HOME=null;
try{var _h=JSON.parse(localStorage.getItem(HOMEKEY)||'null');
    if(_h&&_h.length===2)HOME=_h}catch(e){}
function homeSave(){try{HOME?localStorage.setItem(HOMEKEY,JSON.stringify(HOME))
                        :localStorage.removeItem(HOMEKEY)}catch(e){}}
 
var ME=CTR.slice();
var hM=new maplibregl.Marker({element:mk('home','⌂')});
function homeMark(){if(HOME){hM.setLngLat(HOME).addTo(map)}else{try{hM.remove()}catch(e){}}}
homeMark();
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

el('c-saved').addEventListener('click',function(){
  logAct('act  saved routes');buildSavedPanel()});

el('c-machine').addEventListener('click',function(){
   
  if(mode==='water'){
    var wi=(WORDER.indexOf(machine)+1)%WORDER.length;
    machine=WORDER[wi];waterCraft=machine;
    setChip('c-machine','vehicle',MACHINE[machine].lbl.replace(/^\S+\s/,''));
    show('Craft set to <b>'+MACHINE[machine].lbl.replace(/^\S+\s/,'')+
      '</b>. Float times on the river cards use it.','');
    return}
  machIdx=(machIdx+1)%ORDER.length;machine=ORDER[machIdx];_legalMemo={};
  setChip('c-machine','vehicle',MACHINE[machine].lbl.replace(/^\S+\s/,''));
  applyMachine();
  var no=machineIllegal();
  clearRoute();show('Machine set to <b>'+MACHINE[machine].lbl.replace(/^\S+\s/,'')+
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

 
 
var GUIDEKEY='apex.guide.v2';

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
    setChip('c-machine','vehicle',MACHINE[machine].lbl.replace(/^\S+\s/,''))}
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
      RFROM=ME.slice();RTO=ME.slice();
      var out=buildLoops(a,rec.mi);
      if(!out.length)return show('<b>'+rec.n+'</b> will not rebuild — the legal '+
        'network within reach no longer connects back at '+rec.mi+' mi.','fail');
      out.forEach(function(o){o.h+=' · '+o.s.mi.toFixed(1)+' mi';
        if(o.repeat>0.25)o.h+=' ⟲'});
      presentRoutes(out);svPrefer(rec.p)},30);
    return}
  if(!rec.t)return show('<b>'+rec.n+'</b> has no destination saved.','fail');
  routeToPoint(rec.t,rec.lbl||'there');
  setTimeout(function(){svPrefer(rec.p);if(note)el('panel').innerHTML+=note},80)}

function svPrefer(k){
   
  if(!k||!last)return;
  for(var i=0;i<last.length;i++)if(last[i].k===k){
    sel=i;draw(last[i],true);
    Array.prototype.forEach.call(document.querySelectorAll('.rc'),function(d){
      d.className='rc'+(+d.dataset.i===sel?' sel':'')});
    return}}

function buildSavedPanel(){
  var a=svLoad().filter(function(x){return !x.r||!BUNDLE.region||x.r===BUNDLE.region});
  var wp=wpLoad().filter(function(x){return !x.r||!BUNDLE.region||x.r===BUNDLE.region});
  if(!svAvailable())
    return show('<b>Saved routes are unavailable here.</b> This browser will not '+
      'let the page store anything. In the app they work normally.','fail');
  if(!a.length&&!wp.length)
    return show('<b>Nothing saved yet.</b><br>Plan a route or a loop, then tap '+
      '<b>☆ Save</b> on the card you want to keep. It is stored on this phone '+
      'only — nothing is sent anywhere — and reopening it routes again on the '+
      'current map, so closures stay up to date.','');
  var h='<div id="routes">';
  if(wp.length){
    h+='<div class="sub" style="margin:2px 0 6px">'+wp.length+' waypoint'+
       (wp.length===1?'':'s')+'</div>';
    wp.forEach(function(x,i){
      h+='<div class="rc" data-wp="'+i+'"><h5>\u2691 '+x.n+'</h5>'+
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
    placeCard(x.p,'wpt','\u2691 '+x.n)});
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
 
function routeToPoint(dest,label){
  logAct('route to '+(label||'?'));
  RFROM=ME.slice();RTO=dest.slice();
  el('btn-home').disabled=true;show('Routing…','');
  setTimeout(function(){
    var _t0=performance.now();
    var a=nearestNode(ME),b=nearestNode(dest),out=[];
    var _tSnap=performance.now()-_t0;
    DESTLBL=label||'there';
    el('btn-home').disabled=false;
    if(a<0||b<0)return show('<b>Nothing legal nearby</b> for a '+
      MACHINE[machine].lbl.replace(/^\S+\s/,'')+'. Every line within reach is off limits for that machine.','fail');
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
      MACHINE[machine].lbl.replace(/^\S+\s/,'')+' between those two points. Try a wider machine, or move the pins nearer a trail.','fail');
    presentRoutes(out)},30)}

var DESTLBL='home',RFROM=null,RTO=null;

 
function presentRoutes(out){
   
  var seen={};out.forEach(function(o){var k=o.s.path.map(function(e){return e.i}).join(',');
    o.dup=seen[k]||false;seen[k]=true});
  last=out;sel=0;
  logAct('route '+out.length+' options, best '+out[0].s.mi.toFixed(1)+' mi');
  renderRoutes(out);draw(out[0],true)}

 
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

function buildLoops(startNode,targetMi){
  var out=[];
   
   
  var shapes=[
    {h:'Loop · most trail',k:'ltrail',f:function(e){
        return e.L*(DESIG[e.c]?0.55:DIRT[e.c]?1.3:8)}},
    {h:'Loop · fastest',k:'lfast',f:function(e){return e.L/spd(e)}}
  ];
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
  if(!HOME)return show('<b>No home set.</b> Tap a place and choose '+
    '“Make this home”, or press and hold the map and pick Set home.','');
  routeToPoint(HOME,'the ⌂ pin')});

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
      (overFuel?'<div class="sub warn">⛽ '+(s.mi-fuel).toFixed(1)+' mi past your range</div>':
        (fuel?'<div class="sub good">⛽ within range</div>':''))+
      (dark?'<div class="sub warn">☾ arrives after dark</div>':'')+
      (s.adv>0.05?'<div class="sub warn">'+s.adv.toFixed(1)+' mi unverified (OSM)</div>':
        '<div class="sub good">fully on designated line</div>')+
      (o.snap>0.15?'<div class="sub warn">+'+o.snap.toFixed(1)+
        ' mi off-network (dashed) to reach the trail</div>':'')+
      '</div>'});
  html+='</div>';
   
   
  html+='<div class="sub" style="margin-top:7px">'+
    '<button class="chip" id="btn-save">\u2606 Save this route</button> '+
    '<button class="chip" id="btn-clear">\u2715 Clear route</button></div>';
  show(html,'');
  var cb2=el('btn-clear');
  if(cb2)cb2.addEventListener('click',function(){
    logAct('act  cleared route');
    clearRoute();last=null;sel=null;
    show('Route cleared. The map is back to just the network.','')});
  var sb=el('btn-save');
  if(sb)sb.addEventListener('click',function(){
    var rec=svCurrent(svName());
    if(!rec)return show('Nothing to save yet.','fail');
    if(!svAdd(rec))return show('<b>Could not save.</b> This browser will not let '+
      'the page store anything; in the app it works normally.','fail');
    logAct('act  saved route '+rec.n);
    show('Saved as <b>'+rec.n+'</b>.<br><span class="sub">Kept on this phone only. '+
      'Reopening it routes again on the current map, so closures and reroutes '+
      'stay up to date \u2014 the line may differ from today\u2019s.</span>','pass')});
  Array.prototype.forEach.call(document.querySelectorAll('.rc'),function(c){
    c.addEventListener('click',function(){
      sel=+c.dataset.i;logAct('act  picked '+((last[sel]||{}).h||sel));
       
      Array.prototype.forEach.call(document.querySelectorAll('.rc'),function(d){
        d.className='rc'+(+d.dataset.i===sel?' sel':'')});
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
      '<polygon points="0,'+H+' '+pts.join(' ')+' '+W+','+H+'" fill="rgba(143,174,99,0.22)"/>'+
      '<polyline points="'+pts.join(' ')+'" fill="none" stroke="#8FAE63" '+
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
            (dams.length?' · <b style="color:#C1121F">'+dams.length+' dam'+
              (dams.length>1?'s':'')+' — portages</b>':'')+
            '<br><span class="sub">Tap a stop on the river to plan a run — '+
            'in Water mode a launch pin works too.</span>','');
        }
        return}
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
   
  steps.forEach(function(s){
    var at=tot;tot+=s.mi;
     
    var named=s.name&&!/^(two-track|forest road|road|paved|trail)$/i.test(s.name);
    var nm=named?(s.name+(s.id&&s.id!==s.name?' \u00b7 '+s.id:''))
                :('unnamed '+(s.name||'track')+(s.id?' \u00b7 '+s.id:''));
    html+='<div class="st"><div class="ar">'+s.turn[1]+'</div><div class="tx">'+
      s.turn[0]+' '+(named?'<b>'+nm+'</b>':'<i class="unn">'+nm+'</i>')+
      (MACHINE[machine].ok.indexOf(s.cls)<0?' <span class="tag shut">illegal</span>':'')+
      (s.up>8?'<br><span style="color:#C9A227">climbs '+ft(s.up)+' ft</span>':'')+
      '</div><div class="d">'+(s.mi<0.1?(s.mi*5280|0)+' ft':s.mi.toFixed(1)+' mi')+
      (at>0.05?'<div class="at">at '+at.toFixed(1)+' mi</div>':'')+
      '</div></div>'});
  html+='</div>';
  show('<span class="tn">'+steps.length+' steps · '+tot.toFixed(1)+
    ' mi</span><span class="tag legal">'+last[sel].h+'</span>'+html,'')})

 
 
 
 
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

function applyMachine(){_legalMemo={};
  if(!map||!map.getLayer)return;
   
  if(!OPA_BASE){
    OPA_BASE={};
    MACH_LAYERS.forEach(function(id){
      if(!map.getLayer(id))return;
      var v=map.getPaintProperty(id,'line-opacity');
      OPA_BASE[id]=(typeof v==='number')?v:1})}
  var ok=(MACHINE[machine]||{}).ok||[];
  MACH_LAYERS.forEach(function(id){
    if(!map.getLayer(id))return;
    var b=OPA_BASE[id];
    if(b===undefined)b=1;
    map.setPaintProperty(id,'line-opacity',
      ['case',['in',['get','c'],['literal',ok]],b,b*MACH_DIM])});
  var lg=el('machnote');
  if(lg)lg.textContent=MACHINE[machine].lbl.replace(/^\S+\s/,'')+
    ' — faded line is legal ORV trail your machine is too wide for';}

function machineIllegal(){
   
  var ok=(MACHINE[machine]||{}).ok||[];
  return ['route72','trail50','fstrail','mccct','moto24','track','fsroad']
    .filter(function(c){return ok.indexOf(c)<0})}

var TRAIL_LAYERS=['route72','trail50','moto24','mccct','fstrail','foot'];
var act='all';

function actLabel(){
  var a=ACTS.filter(function(x){return x.k===act})[0];
  setChip('c-act',act==='all'?'vehicle':'target',a.h);
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
  actLabel()}

function buildActPanel(){
  var p=el('actpanel');
  p.innerHTML=ACTS.map(function(a){
     
    return '<button class="actrow'+(a.tier?' tierrow':'')+
      (!a.tier&&a.k===act?' on':'')+'"'+(a.tier?'':' data-k="'+a.k+'"')+'>'+
      '<span class="sw'+(a.dash?' dash':'')+'" style="'+
        (a.dash?'color:'+a.sw+';background-color:transparent':'background-color:'+a.sw)+'"></span>'+
      '<span>'+a.h+'</span></button>'}).join('');
  Array.prototype.forEach.call(p.querySelectorAll('.actrow'),function(b){
    if(!b.dataset||!b.dataset.k)return;
    b.addEventListener('click',function(){
      act=b.dataset.k;applyAct();buildActPanel();p.hidden=true;
      logAct('tap','activity '+act)})})}

 
var MODES=[
   
   
  {k:'ride',     h:'Off-road', s:'ORV, dirt bike, side-by-side, MTB — trails, riding areas, fuel', act:'ride',
   kinds:['trailhead','camp','fuel','dayuse','view','info','water','toilet','shelter','store','food','mtb'],
   demote:['store','food','info'],
   groups:{areas:true,peaks:false,contour:false,relief:false,paddle:false,places:true,county:false,public:false},
   basemap:'Map', zoom:9},
   
  {k:'outdoors', h:'Outdoors', s:'Hike, fish, explore — on foot, with trail systems, hills and rivers', act:'foot', machine:'walk',
   kinds:['trailhead','camp','shelter','water','toilet','view','launch','beach','dayuse','info','system','mtb','ski','lighthouse','livery'],
   demote:['camp'],
   peaksFrom:9,
    
   groups:{areas:false,peaks:true,contour:true,relief:false,paddle:true,places:true,county:false,public:false},
   basemap:'Map', zoom:11},
   
  {k:'hunt',     h:'Hunt',     s:'Public land, game areas, counties, stands and cameras — on foot', act:'foot', machine:'walk',
   kinds:['trailhead','camp','water','toilet','info','system','shelter'],
   peaksFrom:9,
   groups:{areas:false,peaks:true,contour:true,relief:false,paddle:false,places:true,county:true,public:true},
   basemap:'Map', zoom:11},
  {k:'water',    h:'Water',    s:'Beach, kayak, tube, boat — launches and rivers, no trail lines', act:'none', machine:'kayak',
   kinds:['livery','launch','beach','camp','dayuse','info','toilet','fuel','lighthouse','marina'],
   boost:['launch','beach','lighthouse'],
   groups:{areas:false,peaks:false,contour:false,relief:false,paddle:true,places:true,county:false,public:false},
   basemap:'Hybrid', zoom:10},
   
  {k:'camp',     h:'Camp',     s:'Campgrounds by type, national and state forest, supplies', act:'ride',
   kinds:['camp','dayuse','shelter','trailhead','launch','beach','water','toilet','fuel','store','food','info'],
   boost:['camp'], demote:['info','launch','beach','fuel','store','food'],
   groups:{areas:false,peaks:false,contour:false,relief:false,paddle:false,places:true,county:false,public:true,forest:true},
   basemap:'Map', zoom:10}
];
var mode='ride', POI_BASE={}, POI_MODEF={}, STACKED={};
function modeOf(k){return MODES.filter(function(m){return m.k===k})[0]||MODES[0]}
 
function modeFilter(base,m,id){
  var inK=['in',['get','k'],['literal',m.kinds]];
   
  if(m.demote&&m.demote.length)
    inK=['all',inK,['step',['zoom'],['!',['in',['get','k'],['literal',m.demote]]],13,true]];
   
  var unZ=(m.k==='water')?12:13.5;
  inK=['all',inK,['any',['==',['get','named'],1],
    ['!',['in',['get','k'],['literal',['launch','beach']]]],
    ['step',['zoom'],false,unZ,true]]];
  var wrap=function(br){
    var f=['all',inK,(m.boost&&id==='poi-dot-major')
      ?['any',['in',['get','k'],['literal',m.boost]],br]:br];
    return f};
  if(Array.isArray(base)&&base[0]==='step'){
    var out=['step',base[1],wrap(base[2])];
    for(var i=3;i<base.length;i+=2){out.push(base[i]);out.push(wrap(base[i+1]))}
    return out}
  var b=(base===true)?['literal',true]:base;
  return ['all',inK,b]}

function applyMode(k,opts){
  opts=opts||{};var m=modeOf(k);mode=m.k;
  try{localStorage.setItem('apex.mode',mode)}catch(e){}
   
  if(ACTS.some(function(a){return a.k===m.act})){act=m.act;applyAct()}
   
  ['poi-dot','poi-dot-major'].forEach(function(id){
    try{
      if(!POI_BASE[id])POI_BASE[id]=map.getFilter(id)||true;
       
      POI_MODEF[id]=modeFilter(POI_BASE[id],m,id);
      map.setFilter(id,POI_MODEF[id]);
      STACKED={};
    }catch(e){}});
   
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
    setChip('c-machine','vehicle',MACHINE[machine].lbl.replace(/^\S+\s/,''));
    applyMachine();
  }catch(e){}
   
  STACKED={};STACKSIG='';setTimeout(function(){try{restack()}catch(e){}},60);
   
  LYRGROUPS.forEach(function(g){if(g.k in m.groups)lyrSet(g,m.groups[g.k])});
   
  try{var pz=m.peaksFrom||10.6;map.setLayerZoomRange('peak-dot',pz,24);
      map.setLayerZoomRange('peak-label',Math.max(pz,9.6),24)}catch(e){}
   
  var bi=BASEMAPS.indexOf(m.basemap);
  if(bi>=0&&(bi===0||SAT_OK)&&bi!==bmi)setBasemap(bi);
  setChip('c-mode','mountain',m.h);
  el('c-mode').className='basebtn modebtn'+(mode==='ride'?'':' on');
  if(!opts.silent)logAct('act  mode '+mode);
   
  try{if(!el('lyrpanel').hidden)buildLyrPanel()}catch(e){}
}

var BASEMAPS=['Map','Satellite','Hybrid'],bmi=0;
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
   
   
  var roadA=sat?0.35:1, roadC=sat?'#F1EBDD':PAL.minor;
  try{
    map.setPaintProperty('minor','line-opacity',sat
      ?['interpolate',['linear'],['zoom'],11.5,0,12.5,0.45]:1);
    map.setPaintProperty('paved','line-opacity',roadA);
    map.setPaintProperty('minor','line-color',roadC);
    map.setPaintProperty('paved','line-color',roadC);
    map.setPaintProperty('minor','line-width',sat?w(0.25,0.55,1.3):w(0.4,0.9,2.2));
    map.setPaintProperty('paved','line-width',sat?w(0.6,1.3,3.0):w(0.9,2,4.8));
    map.setPaintProperty('casing-track','line-opacity',sat?0.4:0.75);
    map.setPaintProperty('casing-fsroad','line-opacity',sat?0.3:0.55);
  }catch(e){}
   
   
   
  setChip('c-base',sat?'sat':'map',m);
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
 '<span class="tag legal">offline</span><span class="tag adv">no account</span><br>'+
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

function hudSet(mps,deg,at){
   
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
  hudPaint()}

function hudShow(on){
  var b=el('hudbar'),s=el('hudstats'),c=el('chips');
  if(b)b.hidden=!on;
  if(s)s.hidden=!on;
   
  if(c)c.hidden=!!on;
  if(!on){HUD={spd:null,hdg:null,at:null,t:null}}
  hudPaint()}

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
  var sp=el('hud-spd');
  if(sp)sp.innerHTML=(HUD.spd===null?'—':Math.round(HUD.spd*2.23694))+
    '<span class="hu">mph</span>';
  var tm=el('hud-time');
  if(tm)tm.textContent=RIDE?Math.round((Date.now()-RIDE.t0)/60000)+' min':'—';
  var ds=el('hud-dist');
  if(ds)ds.textContent=crumbMi.toFixed(1)+' mi';}

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

function startRecording(at){
   
  if(RESUMING){RESUMING=false;
    if(!crumbs.length){crumbs=[at.slice()];crumbMi=0}
    if(!TRUCK)TRUCK=(crumbs[0]||at).slice();
    rideStart(at);
    if(RESUMED_RIDE){RIDE.t0=RESUMED_RIDE.t0;RIDE.mi0=RESUMED_RIDE.mi0||0;RESUMED_RIDE=null}
    return}
  TRUCK=at.slice(); crumbs=[at.slice()]; crumbMi=0;
  rideStart(at);
  hudShow(true);
  if(!tM)tM=new maplibregl.Marker({element:mk('truck','⛟')}).setLngLat(TRUCK).addTo(map);
  else tM.setLngLat(TRUCK);
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

 
function checkOffRoute(){
  if(!last||sel===null||!crumbs.length)return;
  var pts=[];last[sel].s.path.forEach(function(e){pts=pts.concat(decode(GR.g[e.i]))});
  var best=1e9;for(var i=0;i<pts.length;i++){var d=mi(ME,pts[i]);if(d<best)best=d}
  var off=best>0.16;                     
  if(off&&!offAlert){offAlert=true;buzz([120,80,120,80,220]);
    el('alert').className='on';
    el('alert').innerHTML='Off route — '+(best*5280|0)+' ft from your line'+
      '<small>Tap Retrace to follow your own track back to the truck.</small>'}
  else if(!off&&offAlert){offAlert=false;el('alert').className=''}}

 
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
  show('Locating you on the network…','');
  setTimeout(function(){
    var ne=nearestEdge(ME), nj=nearestJunction(ME);
    var out='<span class="tn">'+ME[1].toFixed(5)+'  '+ME[0].toFixed(5)+'</span>'+
      '<span class="tag legal">decimal degrees</span><br>';
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
    bits.push(ad?'Read the coordinates first, then the address, then the junction.'
                :'Read the coordinates first, then the junction.');
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
  setChip('c-ride','play','Ride it')}}

 
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
      setChip('c-machine','vehicle',MACHINE[machine].lbl.replace(/^\S+\s/,''))}
    crumbs=(t.crumbs||[]).slice();crumbMi=t.crumbMi||0;
    if(crumbs.length)map.getSource('crumb').setData({type:'FeatureCollection',
      features:[{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:crumbs}}]});
    if(t.lastFix&&t.lastFix.at){ME=t.lastFix.at.slice();mM.setLngLat(ME)}
    if(t.run)RUNFROM=t.run;
    if(t.runNav)runSet(t.runNav.riv,t.runNav.a,t.runNav.b);
    NAV.northUp=!!(t.nav&&t.nav.northUp);
    if(t.to){DESTLBL=t.lbl||'there';routeToPoint(t.to,t.lbl);
       
      setTimeout(function(){if(last&&t.prof){var i=-1;
        for(var q=0;q<last.length;q++)if(last[q].k===t.prof){i=q;break}
        if(i>=0&&i!==sel){sel=i;draw(last[sel],false)}}},400)}
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
    '<button class="chip" id="trip-resume">'+ic('play')+'<span>Resume</span></button> '+
    '<button class="chip" id="trip-discard">'+ic('close')+'<span>Discard</span></button>','');
  el('trip-resume').addEventListener('click',function(){
    if(tripResume(t)){el('c-ride').click();
      show('<b>Trip resumed</b><div class="sub">Recording continues from your last fix.</div>','')}});
  el('trip-discard').addEventListener('click',function(){tripEnd();show('Trip discarded.','')});
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
function navChip(){
  var n=el('nav');if(!n)return;
  if(!NAV.on){n.hidden=true;return}
  n.hidden=false;
  var dirs=['N','NE','E','SE','S','SW','W','NW'];
  el('nav-sp').textContent=Math.round(NAV.mps*2.237)+' mph \u00b7 '+dirs[Math.round(((NAV.brg%360)+360)%360/45)%8];
  el('nav-north').className=NAV.northUp?'on':'';
  var vb=el('nav-voice');if(vb){vb.hidden=!VOICE.ok;vb.className=VOICE.on?'on':''}
  el('nav-center').hidden=NAV.follow}
 
function navWake(on){try{if(on)WAKE.hold('nav');else WAKE.drop('nav')}catch(e){}}
function navStart(){NAV.on=true;NAV.follow=true;NAV.lastAt=null;navWake(true);navChip()}
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

 
var RUN=null,_riverCache={},_rmHist=[];
function runSet(riv,a,b){
  var c=corridorByName(riv);
  var fix=function(x){if(x&&!x.p&&c){var f=c.f.filter(function(q){return Math.abs(q.mi-x.mi)<0.01})[0];
    if(f)x=Object.assign({},x,{p:f.p})}return x};
  RUN={riv:riv,a:fix(a),b:fix(b)};_rmHist=[];NAV.riverBrg=null;
  logAct('act  navigate run '+riv)}
function runNavClear(){RUN=null;NAV.riverBrg=null;_rmHist=[]}
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
function navRiverGuide(at,acc,st){
  var g=el('nav-g');if(!g||!RUN)return false;
  var L=riverLine(RUN.riv);if(!L)return false;
  var lo=Math.min(RUN.a.mi,RUN.b.mi),hi=Math.max(RUN.a.mi,RUN.b.mi),bmi=RUN.b.mi;
  var remain=bmi-st.rm;
  _rmHist.push(st.rm);if(_rmHist.length>6)_rmHist.shift();
   
  var toB=RUN.b.p?mi(at,RUN.b.p)*1609.34:1e9,acc_=Math.max(15,acc||0);
  if(!RUN.arrived&&(toB<Math.max(40,acc_)||remain<0.03)){
    RUN.arrived=true;NAV.follow=false;navChip();
    g.hidden=false;g.innerHTML='<b><span class="arw">\u2691</span>You have reached the take-out</b>'+
      '<span class="eta">'+(RUN.b.n||'Take-out')+'</span>';
    buzz([80,60,80,60,200]);
    navSay('You have reached the take-out'+(RUN.b.n?', '+RUN.b.n:''));
    show('<b>Take-out reached</b><div class="sub">'+(RUN.b.n||'Your take-out')+
      '. Recording continues until you stop it.</div>','');
    logAct('nav  take-out reached');return true}
  if(RUN.arrived)return true;
   
  var f=L.c.f,next=null,dam=null;
  for(var i=0;i<f.length;i++){var q=f[i];if(q.mi<=st.rm+0.03||q.mi>bmi+0.02)continue;
    if(q.k==='dam'&&!dam&&q.mi-st.rm<=3)dam=q;
    if(!next&&(q.k==='access'||q.k==='launch'||q.k==='camp')&&q.mi-st.rm<=5)next=q}
  var up=_rmHist.length>=5&&(_rmHist[0]-_rmHist[_rmHist.length-1])>0.05;
  var line1;
  if(dam){line1='<b><span class="arw">\u26a0</span>Dam in '+(dam.mi-st.rm).toFixed(1)+' mi \u2014 portage'+(dam.n?' \u00b7 '+dam.n:'')+'</b>';
    var dk='dam|'+dam.mi.toFixed(2);if(VOICE.near!==dk){VOICE.near=dk;
      navSay('Dam in '+(dam.mi-st.rm).toFixed(1)+' miles. Portage.')}}
  else if(next)line1='<b><span class="arw">\u25bc</span>'+(next.k==='camp'?'Camp':'Access')+' in '+(next.mi-st.rm).toFixed(1)+' mi'+(next.n?' \u00b7 '+next.n:'')+'</b>';
  else line1='<b><span class="arw">\u25bc</span>Downstream to '+(RUN.b.n||'take-out')+'</b>';
  var craft=(MACHINE[machine]&&MACHINE[machine].mph)?MACHINE[machine].lbl.replace(/^\S+\s/,'').toLowerCase():null;
  g.hidden=false;
  g.innerHTML=line1+'<span class="eta">'+Math.max(0,remain).toFixed(1)+' mi to '+(RUN.b.n||'take-out')+
    ' \u00b7 ~'+paddleHours(Math.max(0,remain))+(craft?' as a '+craft:'')+
    ' \u00b7 mile '+st.rm.toFixed(1)+
    (st.off>250?' \u00b7 off the mapped river':'')+(up?' \u00b7 heading UPSTREAM':'')+'</span>';
  return true}
function navGuideClear(){NAVG=null;_navSpd=[];_navOff=0;var g=el('nav-g');if(g)g.hidden=true}
function navPlan(){
  if(!last||sel===null||!last[sel])return null;
  var o=last[sel],steps=directions(o.s.path,o.na);
  if(!steps.length)return null;
  var pts=[],cum=[0],legs=[],cur=o.na;
  for(var i=0;i<o.s.path.length;i++){var e=o.s.path[i],g=decode(GR.g[e.i]);
    if(e.a!==cur)g=g.slice().reverse();cur=(e.a===cur)?e.b:e.a;
    for(var j=(pts.length?1:0);j<g.length;j++){
      if(pts.length)cum.push(cum[cum.length-1]+mi(pts[pts.length-1],g[j])*1609.34);
      pts.push(g[j])}
    legs.push(pts.length-1)}
   
  var marks=[];for(var k=0;k<steps.length;k++){var li=steps[k].at;
    marks.push(li===0?0:cum[legs[li-1]])}
  NAVG={o:o,steps:steps,marks:marks,pts:pts,cum:cum,total:cum[cum.length-1],
    dest:RTO||pts[pts.length-1],lbl:DESTLBL,seg:0,arrived:false,key:sel+'|'+(o.k||'')};
  return NAVG}
function navProject(at){
  var G=NAVG,best=1e12,bi=G.seg,bt=0;
  var lo=Math.max(0,G.seg-40),hi=Math.min(G.pts.length-2,G.seg+400);
  var cosl=Math.cos(at[1]*Math.PI/180),ax=at[0]*cosl,ay=at[1];
  for(var i=lo;i<=hi;i++){
    var p=G.pts[i],q=G.pts[i+1],px=p[0]*cosl,py=p[1],qx=q[0]*cosl,qy=q[1];
    var dx=qx-px,dy=qy-py,L2=dx*dx+dy*dy,t=L2?((ax-px)*dx+(ay-py)*dy)/L2:0;
    t=t<0?0:t>1?1:t;
    var cx=px+t*dx,cy=py+t*dy,d2=(ax-cx)*(ax-cx)+(ay-cy)*(ay-cy);
    if(d2<best){best=d2;bi=i;bt=t}}
  var seglen=G.cum[bi+1]-G.cum[bi];
  return {seg:bi,prog:G.cum[bi]+bt*seglen,off:Math.sqrt(best)*111320}}
function navFmt(m){return m<320?(Math.round(m*3.281/50)*50)+' ft':(m/1609.34).toFixed(1)+' mi'}
function navGuide(at,acc,mps){
  if(!NAV.on)return;
  if(!last||sel===null){navGuideClear();return}
  if(!NAVG||NAVG.key!==sel+'|'+(last[sel].k||''))if(!navPlan())return;
  var G=NAVG,g=el('nav-g');if(!g)return;
  if(mps>0.6){_navSpd.push(mps);if(_navSpd.length>60)_navSpd.shift()}
  var pr=navProject(at);G.seg=pr.seg;
  var remain=Math.max(0,G.total-pr.prog);
   
  var toDest=mi(at,G.dest)*1609.34,acc_=Math.max(15,acc||0);
  if(!G.arrived&&(toDest<Math.max(25,acc_)||remain<25)){
    G.arrived=true;NAV.follow=false;navChip();
    g.hidden=false;g.innerHTML='<b><span class="arw">\u2691</span>You have arrived</b>'+
      '<span class="eta">'+(G.lbl||'Destination')+'</span>';
    buzz([80,60,80,60,200]);
    navSay('You have arrived at '+(G.lbl||'your destination'));
    show('<b>You have arrived</b><div class="sub">'+(G.lbl||'Your destination')+
      '. Recording continues until you stop it.</div>','');
    logAct('nav  arrived');return}
  if(G.arrived)return;
   
  if(pr.off>40){_navOff++}else _navOff=0;
  if(_navOff>=3&&Date.now()-_navReT>20000&&RTO){
    _navReT=Date.now();_navOff=0;
    var keep=last[sel].k;
    logAct('nav  reroute '+Math.round(pr.off)+' m off');
    routeToPoint(RTO,DESTLBL);
    setTimeout(function(){if(last&&keep){for(var q=0;q<last.length;q++)
      if(last[q].k===keep&&q!==sel){sel=q;draw(last[sel],false);break}}
      NAVG=null},450);
    g.innerHTML='<b><span class="arw">\u21bb</span>Re-routing</b>';g.hidden=false;return}
   
  var ni=-1;for(var k=1;k<G.marks.length;k++){if(G.marks[k]>pr.prog+8){ni=k;break}}
  var spd=_navSpd.length?_navSpd.reduce(function(a,b){return a+b},0)/_navSpd.length:0;
  var floorMps=((MACHINE[machine]||{}).spd||3)*0.44704;
  spd=Math.max(spd,floorMps);
  var etaMin=Math.round(remain/spd/60);
  var line1=ni<0
    ?'<b><span class="arw">\u2691</span>'+navFmt(remain)+' to '+(G.lbl||'destination')+'</b>'
    :'<b><span class="arw">'+G.steps[ni].turn[1]+'</span>In '+navFmt(G.marks[ni]-pr.prog)+
      ' \u00b7 '+G.steps[ni].turn[0]+' onto '+G.steps[ni].name+'</b>';
   
  if(ni>=0){var d=G.marks[ni]-pr.prog,key=ni+'|'+(d<90?'near':'far');
    if(key!==VOICE.near){VOICE.near=key;
      navSay((d<90?'':'In '+navFmt(d)+', ')+G.steps[ni].turn[0].toLowerCase()+' onto '+G.steps[ni].name)}}
  g.hidden=false;
  g.innerHTML=line1+'<span class="eta">'+navFmt(remain)+' remaining \u00b7 ~'+
    (etaMin<1?'1':etaMin)+' min'+(pr.off>40?' \u00b7 '+Math.round(pr.off)+' m off the line':'')+'</span>'}
document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='visible')WAKE.resume()});
 
var posMode='none',awayMi=0;
function inRegion(at){var b=BUNDLE.bbox;if(!b)return true;
  return at[0]>=b[0]-0.02&&at[0]<=b[2]+0.02&&at[1]>=b[1]-0.02&&at[1]<=b[3]+0.02}
function classifyFix(at){
  logAct('gps  fix '+at[1].toFixed(5)+','+at[0].toFixed(5));
  if(inRegion(at)){posMode='gps';awayMi=0;bootEase(at);return}
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
     
    var w;
     
    try{ w=C.watchPosition({enableHighAccuracy:true,interval:1000},function(pos,err){
      if(err||!pos)return onFail&&onFail(err);
      onFix([pos.coords.longitude,pos.coords.latitude],pos.coords.accuracy,
            pos.coords.speed,pos.coords.heading);
    }) }catch(e){ onFail&&onFail(e); return null }
    if(w&&typeof w.then==='function')w.then(function(id){watchId=id})
      .catch(function(e){onFail&&onFail(e)});
    else watchId=w;
    return 'cap'}
  if(navigator.geolocation){
    watchId=navigator.geolocation.watchPosition(function(pos){
      onFix([pos.coords.longitude,pos.coords.latitude],pos.coords.accuracy,
            pos.coords.speed,pos.coords.heading)},
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
  navStop();tripEnd();runNavClear();
  hudShow(false);
  setChip('c-ride','play','Ride it');
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
function onFix(at,acc,mps,deg){
  classifyFix(at);
  rideFix(acc);
   
  var _rs=null;try{_rs=navRiver(at)}catch(e){}
   
  navFollow(at,mps,deg);
   
  try{if(!(NAV.on&&_rs&&navRiverGuide(at,acc,_rs)))navGuide(at,acc,mps)}catch(e){}
   
  if(posMode==='gps')hudSet(mps,deg,at);
  if(posMode==='away'){                      
    gpsStop();rideMode=null;
    setChip('c-ride','play','Ride it');
    paint();return}
  if(!gotFix){gotFix=true;startRecording(at);ME=at.slice();mM.setLngLat(ME);
    if(!NAV.on)map.easeTo({center:ME,zoom:14.5,duration:600});
    show('<span class="tn">Recording</span><span class="tag legal">live GPS</span><br>Truck pinned where you are. Ride.','');return}
  ME=at.slice();mM.setLngLat(ME);record(ME);checkOffRoute();
  fixN++;
  tripSave(fixN===1);
   
  if(!NAV.on&&fixN%6===0)map.easeTo({center:ME,duration:280})}

el('c-ride').addEventListener('click',function(){
  if(rideMode)return stopReal();
  if(riding)return stopRide();
  rideMode=gpsStart(onFix,function(){
    if(gotFix)return;                  
    navStop();
    stopReal();
    show('GPS unavailable here — browsers block it on <b>file://</b>. Running the <b>simulator</b> instead; in the APK this is your real track.','');
    startSim()});
  if(rideMode){setChip('c-ride','stop','Stop (GPS)',1);navStart();return}
  startSim()});

function startSim(){
   
  posMode='sim';
  var path=simPath();
  if(!path)return show('Pick a <b>Return home</b> route first, or move the ◎ pin nearer a trail.','fail');
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
    if(i%6===0)map.easeTo({center:ME,duration:280})},170)}

 
var LYRGROUPS=[
  {k:'places', h:'Places',      s:'campgrounds, fuel, launches, trailheads',
   ids:['poi-dot','poi-dot-major']},
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
  {k:'labels', h:'All labels',  s:'every name on the map', ids:null}
];

function lyrOn(g){
  var ids=g.ids||labelLayers();
  for(var i=0;i<ids.length;i++){
    try{if(map.getLayer(ids[i])&&
        map.getLayoutProperty(ids[i],'visibility')!=='none')return true}catch(e){}}
  return false}

function lyrSet(g,on){
  var ids=g.ids||labelLayers();
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
       '<span class="sw" style="background-color:'+(i===0?'#E4D7BC':'#4E6A4A')+'"></span>'+
       '<span>'+nm+(dis?' — not in this bundle':'')+'</span></button>'});
  h+='<div class="sect">Layers</div>';
  LYRGROUPS.forEach(function(g,i){
    var on=lyrOn(g);
    h+='<button class="actrow'+(on?' on':'')+'" data-lg="'+i+'">'+
       '<span class="sw" style="background-color:'+(on?'#E2570F':'transparent')+
       ';border:1px solid rgba(255,255,255,.5)"></span>'+
       '<span>'+g.h+'</span></button>'});
  p.innerHTML=h;
  Array.prototype.forEach.call(p.querySelectorAll('[data-bm]'),function(b){
    b.addEventListener('click',function(){
      if(b.disabled)return;
      setBasemap(+b.dataset.bm);logAct('act  basemap '+BASEMAPS[bmi]);
      buildLyrPanel()})});
  Array.prototype.forEach.call(p.querySelectorAll('[data-lg]'),function(b){
    b.addEventListener('click',function(){
      var g=LYRGROUPS[+b.dataset.lg],on=!lyrOn(g);
      lyrSet(g,on);logAct('act  layer '+g.k+' '+(on?'on':'off'));
      buildLyrPanel()})})}

 
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
 
var HD_CONFIRM=null;
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
function hdCard(){
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
        '<button class="chip" id="hd-stop">'+ic('alert')+'<span>Stop downloading</span></button>'}
    for(var i=0;i<tiers.length;i++){
      var t=tiers[i],big=t.id==='view'&&t.mb>500,fits=!q.known||q.free>=t.mb*1048576*1.2;
      h+='<div class="k">'+t.name+'</div><div class="sub">'+(t.n?t.n.toLocaleString()+' tiles · '+hdMB(t.mb)+
        (t.note?' · '+t.note:'')+(big?' — zoom in to a smaller area to save':''):'already sharp here — built in or saved, nothing to download')+'</div>';
      if(busy||big||!t.n)continue;
      if(!fits){h+='<div class="sub">Not enough space: needs '+hdMB(t.mb*1.2)+', the phone allows '+
        hdMB(q.free/1048576)+'</div>';continue}
      if(t.confirm&&HD_CONFIRM===t.id){
        h+='<div class="sub">'+hdMB(t.mb)+' and '+t.n.toLocaleString()+' tiles. The screen stays on until it finishes; Stop keeps what landed.</div>'+
          '<button class="chip" id="hd-go-'+t.id+'">'+ic('layers')+'<span>Yes, save the whole state</span></button>'+
          '<button class="chip" id="hd-no">'+ic('alert')+'<span>Not now</span></button>'}
      else h+='<button class="chip" id="hd-'+(t.confirm?'ask-':'go-')+t.id+'">'+ic('layers')+'<span>'+t.btn+'</span></button>'}
    if(!q.known)h+='<div class="sub">This phone does not say how much space it allows — a save stops itself if space runs out, and keeps what landed.</div>';
    h+='<div class="k">SAVED ON THIS PHONE</div><div class="sub">'+st.tiles.toLocaleString()+
        ' tiles · '+(st.bytes/1048576).toFixed(1)+' MB</div>'+
      (st.tiles?'<button class="chip" id="hd-del">'+ic('alert')+'<span>Delete all saved HD</span></button>':'');
    show(h);
    tiers.forEach(function(t){
      var g=el('hd-go-'+t.id);if(g)g.addEventListener('click',function(){HD_CONFIRM=null;startHDSave(t.tiles,t.label);hdCard()});
      var a=el('hd-ask-'+t.id);if(a)a.addEventListener('click',function(){HD_CONFIRM=t.id;hdCard()})});
    var no=el('hd-no');if(no)no.addEventListener('click',function(){HD_CONFIRM=null;hdCard()});
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
        '" target="_blank" rel="noopener" style="color:#D98E32">'+r[2]+'</a>'
      }).join('<br><br>')+'</div>'+
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
 
function stripH(){try{var t=el('tools');if(t)document.documentElement.style
  .setProperty('--strip-h',t.offsetHeight+'px')}catch(e){}}
stripH();setTimeout(stripH,600);
try{window.addEventListener('resize',stripH)}catch(e){}    
 
var TAB='map';
function showTab(t){
  TAB=t;
  Array.prototype.forEach.call(document.querySelectorAll('.chip[data-tab]'),function(c){
    c.hidden=(c.dataset.tab!==t)});
  Array.prototype.forEach.call(document.querySelectorAll('#tabs .tab'),function(b){
     
    b.className='tab'+(b.dataset.go===t?' on':'')});
   
  var dp=el('diagpanel'); if(dp&&t!=='tools')dp.hidden=true;
  var cp=el('cmppanel'); if(cp&&t!=='tools'){cp.hidden=true;CMP_ON=false}
  var lp=el('lyrpanel'); if(lp&&t!=='map')lp.hidden=true;
  var ap=el('actpanel'); if(ap&&t!=='map')ap.hidden=true;
  logAct('tap  tab '+t)}

Array.prototype.forEach.call(document.querySelectorAll('#tabs .tab'),function(b){
  b.addEventListener('click',function(){showTab(b.dataset.go)})});

el('c-howto').addEventListener('click',function(){guideShow()});
el('guide-go').addEventListener('click',function(){guideClose(true)});
 
el('guide').addEventListener('click',function(e){
  if(e.target===el('guide'))guideClose(true)});

el('c-compass').addEventListener('click',function(){
  var p=el('cmppanel');CMP_ON=p.hidden;p.hidden=!p.hidden;
  if(CMP_ON){magStart();el('diagpanel').hidden=true;cmpPaint()}
  logAct('tap  c-compass')});

 
el('c-markme').addEventListener('click',function(){
  if(!ME)return show('<b>No position yet.</b> Wait for a fix, or long-press the '+
    'map to mark a spot by hand.','fail');
  var nm=wpName(ME);
  if(!wpAdd({n:nm,p:ME.slice(),r:BUNDLE.region||null,ts:Date.now()}))
    return show('<b>Could not save.</b> This browser will not let the page store '+
      'anything; in the app it works normally.','fail');
  logAct('act  marked this spot '+nm);
  wpDraw();
  show('Marked <b>'+nm+'</b>.<br><span class="sub">On this phone only. '+
    'Find it again under \u2606 Saved.</span>','pass')});

el('peek').addEventListener('click',function(){
  var folded=el('rail').className==='folded';
  RAIL_MANUAL=!folded;               
  railSet(folded);
  logAct('tap  rail '+(folded?'open':'fold'))});

el('c-diag').addEventListener('click',function(){
  var p=el('diagpanel');p.hidden=!p.hidden;logAct('tap  c-diag')});

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
    '<br><br>Tell Claude you saw <b>RENDER FAIL</b>'+(glErr?' and that message':'')+'.','fail')}
 
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
  rows.push('<b style="font-size:var(--t-lg)">'+title+'</b>');
  rows.push('<span class="mono" style="font-size:var(--t-lg)">'+at[1].toFixed(5)+' '+
    at[0].toFixed(5)+'</span> <span class="unit">DD'+
    (e!==null?' · '+ft(e)+' ft':'')+'</span>');
  if(kind!=='me')rows.push('<span class="unit">'+d.toFixed(2)+' mi '+b.pt+
    ' ('+b.deg+'°) from your position</span>');
  var ad=addressAt(at)||addressAt(at,true);
  if(ad)rows.push('<span style="color:#F5EFE2">'+ad.txt+'</span>');
  if(ne)rows.push('<span class="unit">nearest: '+(ne.e.n||label(ne.e.c))+
    (ne.e.id?' · '+ne.e.id:'')+' — '+ne.mi.toFixed(2)+' mi</span>');
  var acts=[];
  if(kind!=='me')acts.push('<button class="chip" id="pc-route">▸ Directions here</button>');
  if(kind!=='home')acts.push('<button class="chip" id="pc-home">⌂ Make this home</button>');
  if(kind!=='me')acts.push('<button class="chip" id="pc-start">◉ Start from here</button>');
  if(kind==='me'&&posMode==='gps')acts.push('<button class="chip" id="pc-disp">☎ Dispatch card</button>');
  acts.push('<button class="chip" id="pc-go">⤢ Centre</button>');
  if(kind==='drop'){
    acts.push('<button class="chip" id="pc-wpt">☆ Save as waypoint</button>');
    if(mode==='hunt')acts.push(Object.keys(WPTYPES).map(function(k){
      return '<button class="chip" data-wpt="'+k+'">'+WPTYPES[k].h+'</button>'}).join(''));
    acts.push('<button class="chip" id="pc-drop">✕ Remove pin</button>')}
  show(rows.join('<br>')+'<div style="margin-top:9px">'+acts.join(' ')+'</div>','');
  var on=function(id,fn){var b=el(id);if(b)b.addEventListener('click',fn)};
  on('pc-route',function(){routeToPoint(at,title)});
  on('pc-home',function(){logAct('act  make this home');HOME=at.slice();homeSave();homeMark();clearRoute();syncSafety();
     
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
  on('pc-wpt',function(){
    var nm=wpName(at);
    if(!wpAdd({n:nm,p:at.slice(),r:BUNDLE.region||null,ts:Date.now()}))
      return show('<b>Could not save.</b> This browser will not let the page '+
        'store anything; in the app it works normally.','fail');
    logAct('act  saved waypoint '+nm);
    wpDraw();clearDrop();
    show('Saved as <b>'+nm+'</b>.<br><span class="sub">On this phone only. '+
      'Find it again under \u2606 Saved.</span>','pass')});
  on('pc-drop',function(){clearDrop();show('Pin removed.','')});
  Array.prototype.forEach.call(document.querySelectorAll('[data-wpt]'),function(b){
    b.addEventListener('click',function(){
      var k=b.dataset.wpt,nm=WPTYPES[k].h+' \u00b7 '+wpName(at);
      if(!wpAdd({n:nm,t:k,p:at.slice(),r:BUNDLE.region||null,ts:Date.now()}))
        return show('<b>Could not save.</b>','fail');
      logAct('act  saved waypoint '+k);
      wpDraw();clearDrop();
      show('Saved <b>'+nm+'</b>.<br><span class="sub">On this phone only. '+
        'Find it again under \u2606 Saved.</span>','pass')})});
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
    window.headingNow=headingNow;window.railSet=railSet;
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
    window.__mode={apply:applyMode,get:function(){return mode},MODES:MODES};
     
    window.__sat={tiles:TILES,sparse:SPARSE,inPatch:inPatch,blank:Array.from(BLANK_PNG),resolve:_satResolve};
    window.__hd=HD;
     
    window.HDDL=HDDL;window.__hdChip=hdChip;window.__hdCard=hdCard;window.__wake=WAKE;window.__hdTiers=hdTiers;window.__inRings=inRings;window.__ctx=function(){return CTX};
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
        plan:navPlan,guide:function(){return NAVG},project:navProject,
        runSet:runSet,run:function(){return RUN},river:navRiver,riverLine:riverLine,
        pos:function(v){if(v!==undefined)posMode=v;return posMode},
         
        reset:function(){gotFix=false;rideMode=null;crumbs=[];crumbMi=0;RIDE=null;NAV.on=false;NAV.lastAt=null},
        crumbs:function(){return crumbs.length},
        stopReal:stopReal,rail:function(on){try{railSet(!!on)}catch(e){}},
        save:tripSave,load:tripLoad,resume:tripResume,end:tripEnd,card:tripResumeCard,
        snapshot:tripSnapshot,chip:navChip};
      window.__splash=SPL;window.__busy=BUSY;
      window.__stack={run:restack,radius:stackRadius,maxz:CLUSTER_MAXZ,
        services:SERVICES,hidden:function(){return Object.keys(STACKED).length},
        out:function(){return STACKOUT},
        card:stackCard};
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
        ((ME&&ME.slice)?'your position':'the region centre')+
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
  var LIST=_folded?['peek','c-ride','c-locate']
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
    MACHINE[machine].lbl.replace(/^\S+\s/,'')+' — '+_okc.length+' classes legal, '+
    _no.length+' faded'+(_no.length?' ('+_no.join(', ')+')':''));
   
  var _hb=el('hudbar'),_hs=el('hudstats'),_rid=!!rideMode;
  stAdd('UI','hud-matches-ride',
    !!_hb&&!!_hs&&_hb.hidden===!_rid&&_hs.hidden===!_rid,
    _rid?'riding — ribbon and stats on screen':'not riding — HUD off screen');
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
    (_was!==machine?' (as '+MACHINE[machine].lbl.replace(/^\S+\s/,'')+' \u2014 a '+
      MACHINE[_was].lbl.replace(/^\S+\s/,'').toLowerCase()+' is legal on no land class)':''));
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
            ride:RIDE,lastride:LASTRIDE,
            hud:!!(el('hudbar')&&el('hudbar').hidden),
            chips:!!(el('chips')&&el('chips').hidden)};
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
   
  var ok=navVoiceProbe(),vs=[];
  try{vs=speechSynthesis.getVoices()||[]}catch(e){}
  stAdd('VOICE','engine',null,ok
    ?vs.length+' voice(s) · using "'+((VOICE.voice||{}).name||'?')+'" ('+((VOICE.voice||{}).lang||'?')+
      (VOICE.local?', on-device — works offline':', NOT marked on-device — may need signal')+')'
    :(typeof speechSynthesis==='undefined'?'Web Speech API absent in this WebView — strip stays silent'
      :'no voices reported — strip stays silent'));
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
   
  return {text:L.join('\n'),pass:pass,fail:fail,results:ST.slice()};
}
function pad(s){s=String(s);while(s.length<18)s+=' ';return s}

function stRenderPanel(rep){
  var rows=ST.map(function(r){
    var col=r.ok===null?'#9A9184':(r.ok?'#8FAE63':'#C1121F');
    var mk=r.ok===null?'·':(r.ok?'✓':'✕');
    return '<div style="display:flex;gap:8px;padding:3px 0;border-bottom:1px solid #241F1A">'+
      '<span style="color:'+col+';font-weight:700;width:12px">'+mk+'</span>'+
      '<span style="color:#F5EFE2;min-width:112px;font:600 var(--t-sm) ui-monospace,monospace">'+
      r.g+'·'+r.id+'</span>'+
      '<span style="color:#C9C0B2;font-size:var(--t-sm);flex:1">'+
      String(r.d).replace(/[<>]/g,'')+'</span></div>'}).join('');
  var bad=rep.fail>0;
  show('<b style="font-size:var(--t-lg)">Self-test · '+
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
  stLayout();stData();stRouting();stSafety();stRide();stHaptics();
  var finish=function(){var rep=stReport();
    try{window.__selfTestReport=rep}catch(e){}
    if(done)done(rep);return rep};
  stLabels(function(){
  stPerf(function(){
    if(opts.gps===false)return finish();
    show('<b>Self-test running…</b><br>Waiting up to 20s for a GPS fix. '+
      'Step outside for a real one, or wait it out.','');
    stGps(function(){finish()})})})});
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
  setChip('c-selftest','shield','Running…');
  show('<b>Self-test running…</b><br>Exercising load, render, data, routing, '+
    'safety, haptics and performance, then waiting up to 20s for a GPS fix.','');
  setTimeout(function(){selfTest({},function(rep){
    setChip('c-selftest','shield','Self-test');
    stRenderPanel(rep)})},60)});

[[hM,'home',function(){return HOME},function(){return 'Home / truck'}],
 [mM,'me',function(){return ME},function(){
    return posMode==='gps'?'You are here':posMode==='sim'?'Simulated position':
           posMode==='away'?'Planning start':'Start pin'}]
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
 

 
function restack(){
  var src;try{src=map.getSource('poistack')}catch(e){return}
  if(!src)return;
  var z=map.getZoom(),R=stackRadius(z),below=z<CLUSTER_MAXZ;
  var m=MODES.filter(function(x){return x.k===mode})[0]||MODES[0];
  var kinds=m.kinds||[];
  var cw=map.getCanvas().clientWidth,ch=map.getCanvas().clientHeight,pad=R+8;
  var pts=[];
  for(var i=0;i<poif.length;i++){
    var f=poif[i],k=f.properties.k;
    if(kinds.indexOf(k)<0)continue;
    if(below&&SERVICES.indexOf(k)>=0)continue;
    var p;try{p=map.project(f.geometry.coordinates)}catch(e){continue}
    if(p.x<-pad||p.y<-pad||p.x>cw+pad||p.y>ch+pad)continue;
    pts.push({id:f.properties.i,x:p.x,y:p.y,k:k,
      r:(+f.properties.r||9)*10+(+f.properties.pri||3),
      c:f.geometry.coordinates})}
  pts.sort(function(a,b){return a.r-b.r});
  var cell=R,grid={},stacks=[];
  function key(x,y){return Math.floor(x/cell)+'|'+Math.floor(y/cell)}
  for(var n=0;n<pts.length;n++){
    var q=pts[n],cx=Math.floor(q.x/cell),cy=Math.floor(q.y/cell),best=null,bd=R;
    for(var dx=-1;dx<=1;dx++)for(var dy=-1;dy<=1;dy++){
      var g=grid[(cx+dx)+'|'+(cy+dy)];if(!g)continue;
      for(var t=0;t<g.length;t++){var st=g[t];
        var d=Math.hypot(st.x-q.x,st.y-q.y);
        if(d<bd){bd=d;best=st}}}
    if(best){best.m.push(q);if(q.k!==best.k)best.mixed=true}
    else{var ns={x:q.x,y:q.y,k:q.k,mixed:false,anchor:q,m:[q]};
      stacks.push(ns);(grid[key(q.x,q.y)]||(grid[key(q.x,q.y)]=[])).push(ns)}}
  var hide={},out=[];
  for(var a=0;a<stacks.length;a++){var S=stacks[a];
    if(S.m.length<2)continue;
    for(var b=0;b<S.m.length;b++)hide[S.m[b].id]=1;
    out.push({type:'Feature',
      properties:{n:S.m.length,k:S.anchor.k,mixed:S.mixed,
        c:S.mixed?'#2B2926':((POIKIND[S.anchor.k]||{}).c||'#2B2926'),
        ids:S.m.map(function(q){return q.id}).join(',')},
      geometry:{type:'Point',coordinates:S.anchor.c}})}
  var changed=Object.keys(hide).length!==Object.keys(STACKED).length;
  if(!changed)for(var h in hide)if(!STACKED[h]){changed=true;break}
  STACKED=hide;
  if(changed)applyStackFilters();
   
  var sig=out.length+'|'+out.map(function(f){return f.properties.n+':'+f.properties.ids.length}).join(',');
  STACKOUT=out;
  if(sig===STACKSIG)return;
  STACKSIG=sig;
  src.setData({type:'FeatureCollection',features:out})}
var STACKOUT=[],STACKSIG='';

 
function stackCard(f){
  var ids=String(f.properties.ids||'').split(',').filter(function(x){return x!==''});
  var recs=ids.map(function(i){return {i:+i,r:((POIS&&POIS.p)||[])[+i]}})
    .filter(function(o){return o.r&&o.r.p});
  if(!recs.length)return;
  logAct('tap  stack '+recs.length);
   
  RAIL_AT=f.geometry.coordinates.slice();
   
  recs.sort(function(a,b){var ka=(POIKIND[a.r.k]||{}).r||9,kb=(POIKIND[b.r.k]||{}).r||9;
    return ka-kb||(a.r.n||'').localeCompare(b.r.n||'')});
  var rows='',lastK=null;
  recs.forEach(function(o,n){
    var kd=POIKIND[o.r.k]||{},nm=o.r.n||kd.h||o.r.k;
    if(o.r.k!==lastK){rows+='<div class="k" style="margin-top:'+(lastK?10:0)+'px">'+
      (kd.h||o.r.k).toUpperCase()+'</div>';lastK=o.r.k}
    rows+='<button class="chip" data-si="'+n+'" style="width:100%;'+
      'justify-content:flex-start;text-align:left">'+
      '<span style="color:'+(kd.c||'#8B857A')+'">\u25cf</span><span>'+nm+'</span></button>'});
  show('<b>'+recs.length+' places here</b>'+
    '<div class="sub">Stacked at this zoom. Tap one, or keep zooming in.</div>'+
    '<div style="max-height:46vh;overflow:auto">'+rows+'</div>','');
  var host=el('panel')||document;
  Array.prototype.forEach.call(host.querySelectorAll('[data-si]'),function(b){
    b.addEventListener('click',function(){
      var o=recs[+b.dataset.si];if(!o)return;
      map.easeTo({center:o.r.p,zoom:Math.max(map.getZoom(),15.6),duration:600});
      setTimeout(function(){
        var pt=map.project(o.r.p),rc=map.getCanvasContainer().getBoundingClientRect();
        map.getCanvasContainer().dispatchEvent(new MouseEvent('click',
          {bubbles:true,cancelable:true,clientX:rc.left+pt.x,clientY:rc.top+pt.y}))},700)})});
   
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
       maxZoom:Math.min(16.5,z+3.2)})}catch(e){target=null}}
  if(target)map.easeTo({center:target.center,zoom:target.zoom,duration:700});
  else map.easeTo({center:f.geometry.coordinates,zoom:Math.min(16.5,z+1.8),duration:600});
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
  if(ME)map.easeTo({center:ME,bearing:NAV.northUp?0:NAV.brg,pitch:NAV.northUp?0:55,duration:500})});
el('nav-voice').addEventListener('click',navVoiceToggle);
el('nav-north').addEventListener('click',function(){NAV.northUp=!NAV.northUp;navChip();
  if(ME&&NAV.follow)map.easeTo({center:ME,bearing:NAV.northUp?0:NAV.brg,pitch:NAV.northUp?0:55,duration:500})});
['dragstart','zoomstart','rotatestart'].forEach(function(ev){
  map.on(ev,function(e){if(e&&e.originalEvent)_userDrove=true})});
map.on('load',function(){makeBadges();setBasemap(0);wpDraw();showTab('map');
   
  try{map.setLayoutProperty('hillshade','visibility','none')}catch(e){}
   
  if(!guideSeen())setTimeout(guideShow,450);
   
  railSet(false);buildActPanel();actLabel();
  setTimeout(renderHealth,1800);
  var C=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.Geolocation;
  if(C){try{C.requestPermissions().then(locateOnce).catch(locateOnce)}catch(e){locateOnce()}}
  else locateOnce()});

 
var YOU=null,youM=null;
function locateOnce(){
   
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
    gpsStop(); watchId=saveWatch;           
  },function(){ if(!done){done=true; gpsStop(); watchId=saveWatch} });
  if(!mode)return;
   
  setTimeout(function(){ if(!done){done=true; gpsStop(); watchId=saveWatch;
    stInfo&&0; } },25000);}

function showAway(acc){
  showQuiet('<b>You are about '+Math.round(awayMi)+' mi from '+(BUNDLE.name||'this region')+
    '.</b><br>This download only covers the boxed area — everywhere else is '+
    'deliberately blank, not broken. <b>Planning mode</b> is on: browse, search, '+
    'tap open ground to set a start, then <b>Return Home</b> or <b>Directions</b>.'+
    '<br><br>Tap <b>◉ Locate</b> to jump to your real position, or a chip above to '+
    'jump to the riding area.',
    Math.round(awayMi)+' mi away \u00b7 planning mode')}

 
el('c-lost').addEventListener('click',function(){
  if(rideMode)return show('Live GPS is driving — the alert fires from your actual track, not a button.','');
  if(!riding)return show('Start <b>▶ Ride it</b> first, then take a wrong turn and watch the alert fire.','');
  lost=true;buzz(40);
  show('Veering off at the next junction — this is the failure the whole app exists to catch.','')});

 
var HIT=['route72','trail50','moto24','mccct','fstrail','fsroad','closed','fsclosed','track','paved','minor','foot'];
 
var HIT_SHOW=['show-line'];
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
                '<div class="sub">Unnamed in the source \u2014 shown by what it is</div>')+
      campLine+
      (pr.named?photoHTML(pr.k,pr.n,pp):'')+
       
      (function(){if(pr.k!=='ski')return '';
        var rec=((POIS&&POIS.p)||[])[pr.i]||{},x='';
        var DCOL={green:'#2F7D4F',blue:'#2E6FA8',black:'#141414',expert:'#141414',park:'#7A5B3A'};
        var DLAB={green:'Beginner',blue:'Intermediate',black:'Advanced',expert:'Expert',park:'Terrain park'};
        if(rec.runs&&rec.runs.length)x+='<div class="k">RUNS \u00b7 '+rec.runs.length+'</div>'+
          '<div class="sub">'+rec.runs.map(function(r){return '<span style="color:'+
          (DCOL[r.d]||'#8B857A')+'">\u25cf</span> '+r.n+(DLAB[r.d]?' \u00b7 '+DLAB[r.d]:'')}).join('<br>')+'</div>';
        if(rec.web)x+='<div class="sub"><a href="'+rec.web+'" target="_blank" style="color:#D98E32">Website \u2197</a></div>';
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
      if(w3)w3.addEventListener('click',function(){runClear();show('Run cancelled.','')});
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
  if(f[0].properties.i===undefined){
     
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
   
  var _rs=restrictOf(ed);
  if(_rs){
    var banned=_rs.ban&&_rs.ban.indexOf(machine)>=0;
    bits.push('<br><b'+(banned?' style="color:#C1121F"':'')+'>'+
      (banned?'NOT for your machine — ':'Restriction: ')+'</b>'+_rs.say+
      (_rs.unknown?' <span class="sub">(as published; not interpreted)</span>':''));}
  if(UP[ed.i]||DN[ed.i])bits.push('+'+ft(UP[ed.i])+' / -'+ft(DN[ed.i])+' ft');
  show(out+bits.join(' · '),'')});

 
var RAIL_AT=null;           
var RAIL_MANUAL=false;      

function railPeekText(){
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
    (RAIL_AT?'Details':railPeekText());}

function railFoldIfAway(){
   
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
  locateOnce();
  setTimeout(function(){if(!flyToYou())geo.trigger()},1200)});
geo.on('error',function(){show('Location unavailable — browsers block GPS on <b>file://</b> and in embedded frames. Expected here; works in the APK. Use <b>&#39;I am here&#39;</b> to place yourself manually.','fail')});

 
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
     'ZERO drew — the high frame rate is an idle renderer, not speed. Tap ⓘ.':
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
