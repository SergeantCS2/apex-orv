"""Check the glyph pack against the text the map will actually ask for.

A character missing from the pack renders as a gap, silently. There is no
fallback font offline (landmine 4), so coverage has to be proven, not assumed.
"""
import base64, json, re, sys
import numpy as np

P = json.load(open('glyphs_payload.json'))
G = json.load(open('graph_payload.json'))

def rv(b,i):
    n=s=0
    while True:
        c=b[i];i+=1;n|=(c&0x7f)<<s
        if not c&0x80: return n,i
        s+=7
def parse(b):
    i=0;o={}
    while i<len(b):
        t,i=rv(b,i);f,w=t>>3,t&7
        if w==2:
            l,i=rv(b,i);o.setdefault(f,[]).append(b[i:i+l]);i+=l
        else:
            v,i=rv(b,i);o.setdefault(f,[]).append(v)
    return o

blob=base64.b64decode(P['APEX'])
st=parse(parse(blob)[1][0])
name=st[1][0].decode(); rng=st[2][0].decode()
have=set()
sizes=[]
for g in st[3]:
    d=parse(g); have.add(d[1][0])
    if 2 in d: sizes.append((d[3][0],d[4][0],len(d[2][0])))
print(f"pack '{name}' range {rng}: {len(have)} glyphs, {len(sizes)} with bitmaps")
bad=[s for s in sizes if s[0]*s[1]!=s[2]]
print(f"  bitmap size mismatches: {len(bad)}")

NM=G['nm']
def lab(e):
    n = NM[e[4]] if e[4]>=0 else ''
    i = NM[e[5]] if e[5]>=0 else ''
    m = re.search(r'\(([A-Z0-9]{2,5})\)\s*$', n)
    if m: n = m.group(1)
    elif len(n)>24: n = re.sub(r'\s+(Trail|Route|Road)$','',n,flags=re.I)
    return (n+' \u00b7 '+i) if (i and i!=n and n) else (n or i)

PLACES=['Mio','Luzerne','Rose City','McKinley','South Branch','Bull Gap',
        'Mack Lake','The Pink Store']
text=set()
for e in G['e']:
    if e[4]>=0 or e[5]>=0: text|=set(lab(e))
for p in PLACES: text|=set(p)|set(p.upper())
for n in NM: text|=set(n)          # inspect card shows full names too

missing=sorted(c for c in text if ord(c) not in have)
print(f"\ndistinct characters the map may render: {len(text)}")
print(f"missing from pack: {len(missing)}" + (f"  -> {missing!r}" if missing else "  (none)"))

print(f"\nlabels: {sum(1 for e in G['e'] if e[4]>=0 or e[5]>=0)}/{len(G['e'])} edges carry text")
lens=[len(lab(e)) for e in G['e'] if e[4]>=0 or e[5]>=0]
lens.sort()
print(f"label length  median {lens[len(lens)//2]}  p95 {lens[int(len(lens)*.95)]}  max {lens[-1]}")

uri_len = len('data:application/x-protobuf;base64,')+len(P['APEX'])
print(f"\nglyph data URI {uri_len/1024:.0f} KB")
assert not missing, "glyph coverage gap"
assert not bad, "bitmap size mismatch"
print("\nglyph pack verified")
