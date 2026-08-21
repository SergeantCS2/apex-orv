"""Mirror the search ranking and turn generation in Python.

A wrong turn instruction is worse than none: it reads as authoritative and gets
followed. Same reason verify6.py exists for routing costs.
"""
import json, math, re
G=json.load(open('graph_payload.json')); T=json.load(open('terrain_payload.json'))
def dec(a):
    p=[];x=y=0
    for i in range(0,len(a),2):
        x+=a[i];y+=a[i+1];p.append((x/1e5,y/1e5))
    return p
NODES=dec(G['n']); NM=G['nm']; CLS=G['cls']; JX=G['jx']; UP=T['up']
E=[{'a':e[0],'b':e[1],'L':e[2],'c':CLS[e[3]],
    'n':NM[e[4]] if e[4]>=0 else None,'id':NM[e[5]] if e[5]>=0 else None,'i':i}
   for i,e in enumerate(G['e'])]
PLACES=['Mio','Luzerne','Rose City','McKinley','South Branch','Bull Gap','Mack Lake','The Pink Store']

# ── index ──
seen=set(); rows=[]
for i,e in enumerate(E):
    for s,k in ((e['n'],'trail'),(e['id'],'number')):
        if not s or s in seen: continue
        seen.add(s); g=dec(G['g'][i])
        rows.append({'t':s,'k':'road' if e['c'] in ('paved','minor') else k,'c':g[len(g)//2]})
for k,v in JX.items():
    lab=' × '.join(NM[x] for x in v)
    if lab in seen: continue
    seen.add(lab); rows.append({'t':lab,'k':'junction','c':NODES[int(k)]})
for p in PLACES:
    if p in seen: continue
    seen.add(p); rows.append({'t':p,'k':'place','c':(0,0)})
for r in rows: r['l']=r['t'].lower()
KR={'place':0,'trail':1,'number':2,'road':3,'junction':4}
def search(q):
    q=q.strip().lower()
    out=[]
    for r in rows:
        p=r['l'].find(q)
        if p<0: continue
        s=0 if r['l']==q else 1 if p==0 else 2 if r['l'][p-1] in ' (' else 3
        out.append((s,KR.get(r['k'],5),len(r['t']),r))
    out.sort(key=lambda x:(x[0],x[1],x[2]))
    return [x[3] for x in out[:9]]

print(f"index: {len(rows)} entries")
from collections import Counter
print("  by kind:", dict(Counter(r['k'] for r in rows)))
print("\n=== queries ===")
for q in ['meadows','tmm','h58','bull','pink','rose city','mack','ohr','4460','zzz']:
    h=search(q)
    print(f"  {q!r:<11} {len(h)} hits" + (f"  -> {h[0]['t']} [{h[0]['k']}]" if h else "  -> none"))

# ── directions ──
adj={}
for e in E:
    adj.setdefault(e['a'],[]).append(e); adj.setdefault(e['b'],[]).append(e)
import heapq
SPEED={'route72':25,'fsroad':22,'trail50':16,'fstrail':14,'mccct':11,'moto24':11,
       'paved':45,'minor':28,'track':14}
def near(ll): return min(range(len(NODES)),key=lambda i:(NODES[i][0]-ll[0])**2*0.51+(NODES[i][1]-ll[1])**2)
def route(a,b):
    d={a:0};pr={};pq=[(0,a)];sn=set()
    while pq:
        c,u=heapq.heappop(pq)
        if u in sn: continue
        sn.add(u)
        if u==b: break
        for e in adj.get(u,[]):
            if e['c'] in ('closed','fsclosed'): continue
            v=e['b'] if e['a']==u else e['a']
            if v in sn: continue
            nd=c+e['L']/SPEED.get(e['c'],14)
            if nd<d.get(v,1e18): d[v]=nd;pr[v]=(u,e);heapq.heappush(pq,(nd,v))
    if b not in d: return None
    p=[];u=b
    while u!=a: u,e=pr[u];p.append(e)
    return p[::-1]
def brg(a,b):
    t=math.pi/180
    y=math.sin((b[0]-a[0])*t)*math.cos(b[1]*t)
    x=math.cos(a[1]*t)*math.sin(b[1]*t)-math.sin(a[1]*t)*math.cos(b[1]*t)*math.cos((b[0]-a[0])*t)
    return (math.degrees(math.atan2(y,x))+360)%360
def word(d):
    a=((d+540)%360)-180;x=abs(a)
    if x<22: return 'Continue'
    if x<50: return 'Bear left' if a<0 else 'Bear right'
    if x<115: return 'Turn left' if a<0 else 'Turn right'
    if x<160: return 'Sharp left' if a<0 else 'Sharp right'
    return 'Turn around'
def steps(path,start):
    cur=start;legs=[]
    for e in path:
        g=dec(G['g'][e['i']])
        fwd=(e['a']==cur)
        if not fwd: g=g[::-1]
        legs.append({'e':e,'name':e['n'] or e['c'],'id':e['id'],
                     'inB':brg(g[0],g[min(1,len(g)-1)]),'outB':brg(g[-2],g[-1])})
        cur=e['b'] if fwd else e['a']
    out=[];acc=None
    for L in legs:
        k=f"{L['name']}|{L['id'] or ''}"
        if acc and acc['key']==k:
            acc['mi']+=L['e']['L']/1609.34; acc['out']=L['outB']; continue
        if acc: out.append(acc)
        acc={'key':k,'name':L['name'],'id':L['id'],'mi':L['e']['L']/1609.34,
             'inB':L['inB'],'out':L['outB'],'cls':L['e']['c']}
    if acc: out.append(acc)
    for i,s in enumerate(out):
        s['turn']='Start on' if i==0 else word(s['inB']-out[i-1]['out'])
    return out,cur

BG=(-84.0274,44.6166); PS=(-84.1279,44.5219)
a,b=near(BG),near(PS)
p=route(a,b); st,endNode=steps(p,a)
tot=sum(s['mi'] for s in st)
print(f"\n=== directions: Bull Gap -> Pink Store ===")
print(f"  {len(p)} edges collapsed into {len(st)} steps, {tot:.2f} mi")
print(f"  path ends on node {endNode}, target {b}  -> {'OK' if endNode==b else 'MISMATCH'}")
assert endNode==b, "direction walk lost the thread"
routed=sum(e['L'] for e in p)/1609.34
print(f"  step mileage {tot:.3f} vs routed {routed:.3f}  delta {abs(tot-routed):.2e}")
assert abs(tot-routed)<1e-6
print("\n  first 9 steps:")
for s in st[:9]:
    nm=s['name']+(f" · {s['id']}" if s['id'] and s['id']!=s['name'] else '')
    print(f"    {s['turn']:<12} {nm[:38]:<38} {s['mi']:5.2f} mi")
print(f"\n  turn mix:", dict(Counter(s['turn'] for s in st)))
print("\nverified")
