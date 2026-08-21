"""Headless sanity: does the router actually produce sane routes?
Mirrors the JS cost functions so a bad graph is caught here, not on the trail."""
import json, heapq, math
g=json.load(open('graph_raw.json')); nodes,edges=g['nodes'],g['edges']
adj={}
for i,e in enumerate(edges):
    adj.setdefault(e['a'],[]).append(i); adj.setdefault(e['b'],[]).append(i)
SPEED={'route72':25,'fsroad':22,'trail50':16,'fstrail':14,'mccct':11,'moto24':11,
       'paved':45,'minor':28,'track':14}
EFFORT={'paved':1,'route72':1.05,'fsroad':1.1,'minor':1.15,'trail50':1.5,
        'fstrail':1.7,'track':1.8,'mccct':2.3,'moto24':2.6}
PAVED={'paved','minor'}
OK={'bike':set(SPEED),'quad':set(SPEED)-{'moto24'},'sxs':{'route72','fsroad','paved','minor'}}
def near(ll,mach='bike'):
    ok=OK[mach]
    cand=[i for i in adj if any(edges[e]['c'] in ok and edges[e]['c'] not in ('closed','fsclosed')
                                for e in adj[i])]
    return min(cand,key=lambda i:(nodes[i][0]-ll[0])**2*0.51+(nodes[i][1]-ll[1])**2) if cand else None
def run(a,b,cost,mach):
    ok=OK[mach]; dist={a:0}; prev={}; pq=[(0,a)]; seen=set()
    while pq:
        d,u=heapq.heappop(pq)
        if u in seen: continue
        seen.add(u)
        if u==b: break
        for ei in adj.get(u,[]):
            e=edges[ei]
            if e['c'] in ('closed','fsclosed') or e['c'] not in ok: continue
            v=e['b'] if e['a']==u else e['a']
            if v in seen: continue
            nd=d+cost(e)
            if nd<dist.get(v,1e18): dist[v]=nd; prev[v]=(u,ei); heapq.heappush(pq,(nd,v))
    if b not in dist: return None
    path=[]; u=b
    while u!=a: u,ei=prev[u]; path.append(edges[ei])
    return path[::-1]
def summ(p):
    mi=sum(e['L'] for e in p)/1609.34
    hrs=sum((e['L']/1609.34)/SPEED.get(e['c'],14) for e in p)
    off=sum(e['L'] for e in p if e['c'] not in PAVED)/1609.34
    return mi,hrs*60,off
PT=[('Bull Gap',[-84.0274,44.6166]),('Pink Store',[-84.1279,44.5219]),
    ('Mio',[-84.1330,44.6597]),('Rose City',[-84.0666,44.4939])]
PROF=[('Fastest',lambda e:e['L']/SPEED.get(e['c'],14)),
      ('Easiest',lambda e:e['L']*EFFORT.get(e['c'],2)),
      ('Pavement',lambda e:e['L']*(1 if e['c'] in PAVED else 9)),
      ('Shortest',lambda e:e['L'])]
for mach in ('bike','quad','sxs'):
    print(f"\n=== {mach} ===")
    a,b=near(PT[0][1],mach),near(PT[1][1],mach)
    for nm,c in PROF:
        p=run(a,b,c,mach)
        if not p: print(f"  {nm:<10} no legal route"); continue
        mi,mins,off=summ(p)
        print(f"  {nm:<10} {mi:5.1f} mi  {mins:4.0f} min  {off:5.1f} mi off-pavement  {len(p):3d} edges")
print("\n=== bike, all pairs ===")
for i in range(len(PT)):
    for j in range(i+1,len(PT)):
        p=run(near(PT[i][1],'bike'),near(PT[j][1],'bike'),PROF[0][1],'bike')
        mi,mins,_=summ(p) if p else (0,0,0)
        print(f"  {PT[i][0]:<11}->{PT[j][0]:<12} {mi:5.1f} mi  {mins:4.0f} min" if p else f"  {PT[i][0]}->{PT[j][0]}: UNREACHABLE")
