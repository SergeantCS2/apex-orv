"""Headless check of the terrain layer. Elevation drives routing now, so a bad
DEM sample would silently change which route the app calls easiest."""
import json, math
g=json.load(open('graph_payload.json')); t=json.load(open('terrain_payload.json'))
def dec(a):
    p=[];x=y=0
    for i in range(0,len(a),2):
        x+=a[i];y+=a[i+1];p.append((x/1e5,y/1e5))
    return p
N=dec(g['n']); NE=t['ne']; UP=t['up']; DN=t['dn']; PF=t['pf']; E=g['e']
ft=lambda m: m*3.28084
print("=== node elevations ===")
print(f"  {len(NE)} sampled, {min(NE)}..{max(NE)} m ({ft(min(NE)):.0f}..{ft(max(NE)):.0f} ft)")
print(f"  zero/None samples: {sum(1 for e in NE if e in (0,None))}")

print("\n=== known landmarks (expect ~1100-1250 ft) ===")
def near(ll): return min(range(len(N)),key=lambda i:(N[i][0]-ll[0])**2*0.51+(N[i][1]-ll[1])**2)
for nm,ll in [('Bull Gap',(-84.0274,44.6166)),('Mio',(-84.1330,44.6597)),
              ('Pink Store',(-84.1279,44.5219)),('Rose City',(-84.0666,44.4939)),
              ('Mack Lake',(-84.0600,44.5700))]:
    i=near(ll); print(f"  {nm:<11} {NE[i]:>4} m  {ft(NE[i]):>6.0f} ft")

print("\n=== climb conservation ===")
bad=0
for i,d in enumerate(PF):
    v=0;pr=[]
    for x in d: v+=x; pr.append(v)
    up=sum(max(0,pr[k]-pr[k-1]) for k in range(1,len(pr)))
    dn=sum(max(0,pr[k-1]-pr[k]) for k in range(1,len(pr)))
    if up!=UP[i] or dn!=DN[i]: bad+=1
print(f"  profiles whose gain/loss disagrees with stored totals: {bad}/{len(PF)}")

print("\n=== profile endpoints match node elevations ===")
off=[]
for i,e in enumerate(E):
    d=PF[i]
    if not d: continue
    v=0;pr=[]
    for x in d: v+=x; pr.append(v)
    a,b=NE[e[0]],NE[e[1]]
    s,t2=pr[0],pr[-1]
    off.append(min(abs(s-a)+abs(t2-b), abs(s-b)+abs(t2-a)))
off.sort()
print(f"  median endpoint mismatch {off[len(off)//2]} m, p95 {off[int(len(off)*0.95)]} m")

print("\n=== network climb ===")
tot=sum(UP); print(f"  total gain {tot} m = {ft(tot)/1000:.1f}k ft over {len(UP)} edges")
steep=[(UP[i],E[i][2]) for i in range(len(E)) if E[i][2]>60]
steep.sort(reverse=True)
print("  steepest segments (gain m / length m / grade):")
for u,L in steep[:5]:
    print(f"    {u:>4} m / {L:>5} m  = {100*u/L:5.1f}%")
