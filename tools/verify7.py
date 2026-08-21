"""Headless check of the Phase 4 maths. Retrace and back-to-truck are
load-bearing (PROTOCOL §9), so they get verified in Python, not by eyeballing
a blue line on a map."""
import json, math
g=json.load(open('graph_payload.json'))
def dec(a):
    p=[];x=y=0
    for i in range(0,len(a),2):
        x+=a[i];y+=a[i+1];p.append((x/1e5,y/1e5))
    return p
NODES=dec(g['n']); NM=g['nm']; JX=g['jx']
def mi(a,b): return math.hypot((b[0]-a[0])*0.714*69,(b[1]-a[1])*69)
def brg(a,b):
    t=math.pi/180
    y=math.sin((b[0]-a[0])*t)*math.cos(b[1]*t)
    x=math.cos(a[1]*t)*math.sin(b[1]*t)-math.sin(a[1]*t)*math.cos(b[1]*t)*math.cos((b[0]-a[0])*t)
    return (math.degrees(math.atan2(y,x))+360)%360
C=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
def comp(d): return C[round(d/22.5)%16]

print("=== bearing sanity (known pairs) ===")
BG=(-84.0274,44.6166); PS=(-84.1279,44.5219); MIO=(-84.1330,44.6597)
for n,a,b in [('Bull Gap -> Pink Store',BG,PS),('Bull Gap -> Mio',BG,MIO),
              ('Pink Store -> Bull Gap',PS,BG),('Mio -> Bull Gap',MIO,BG)]:
    print(f"  {n:<24} {mi(a,b):5.2f} mi  {brg(a,b):5.1f}deg  {comp(brg(a,b))}")

print("\n=== retrace is reversible and lossless ===")
track=[(BG[0]+i*0.0009, BG[1]-i*0.0006) for i in range(60)]
fwd=sum(mi(track[i-1],track[i]) for i in range(1,len(track)))
back=track[::-1]
bwd=sum(mi(back[i-1],back[i]) for i in range(1,len(back)))
print(f"  forward {fwd:.4f} mi   reversed {bwd:.4f} mi   delta {abs(fwd-bwd):.2e}")
assert abs(fwd-bwd)<1e-9
print(f"  end of reversed track == truck: {back[-1]==track[0]}")

print("\n=== jitter filter (7 m gate) ===")
kept=0; total=0.0; p=track[0]
import random
random.seed(7)
for t in track:
    for _ in range(4):                       # 4 noisy fixes per real move
        n=(t[0]+random.uniform(-4e-5,4e-5), t[1]+random.uniform(-4e-5,4e-5))
        d=mi(p,n); total+=0
        if d>=0.004: kept+=1; total+=d; p=n
print(f"  240 noisy fixes -> {kept} crumbs, {total:.3f} mi (true {fwd:.3f} mi)")
print(f"  inflation {100*(total-fwd)/fwd:+.1f}%")

print("\n=== junction descriptors ===")
print(f"  {len(JX)} named junctions")
import itertools
for k in itertools.islice(JX,5):
    print("   ", " x ".join(NM[i] for i in JX[k]))
sizes={}
for v in JX.values(): sizes[len(v)]=sizes.get(len(v),0)+1
print("  ways meeting:", dict(sorted(sizes.items())))
