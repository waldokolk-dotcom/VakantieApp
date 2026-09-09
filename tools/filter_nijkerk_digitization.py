#!/usr/bin/env python3
"""Quality-control and clean the Nijkerk off-leash GeoJSON extraction."""
from __future__ import annotations
import json, math
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
GEO=ROOT/'whatsup-dog/data/nijkerk-losloopgebieden.geojson'
REPORT=ROOT/'whatsup-dog/data/digitize-report.json'

def centroid(feature):
    pts=feature['geometry']['coordinates'][0][:-1]
    return (sum(p[1] for p in pts)/len(pts),sum(p[0] for p in pts)/len(pts))

def dist_m(a,b):
    lat1,lon1=a; lat2,lon2=b
    r=6371000
    p1,p2=math.radians(lat1),math.radians(lat2)
    dp=math.radians(lat2-lat1); dl=math.radians(lon2-lon1)
    q=math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*r*math.atan2(math.sqrt(q),math.sqrt(1-q))

# The PDF contains one bright-blue explanatory note:
# "Doornsteeg: geen uitlaatstroken, wel afvalbakken." Its letters are not map areas.
# The first box covers the calibrated-frame transform; the second the improved exact-label
# transform. Real Doornsteeg/Eikepage polygons lie just outside these boxes.
ANNOTATION_BOXES=[
  {'lat_min':52.2268,'lat_max':52.2292,'lon_min':5.4455,'lon_max':5.4510},
  {'lat_min':52.2247,'lat_max':52.2262,'lon_min':5.4575,'lon_max':5.4612},
]

# Independently located labels/known locations used as positional sanity checks.
ANCHORS={
  'Marishof':(52.2140797,5.4972254),
  'Bramenhof':(52.2193080,5.4990967),
  'Van der Flierhof':(52.2252229,5.4710108),
  'Antonie Meilingstraat':(52.2201230,5.4740711),
  'Doornsteeg':(52.22435,5.46266),
  'Eikepage':(52.2130779,5.4614262),
  'Stadspark Nijkerk':(52.2208,5.4865),
  'Corlaerpark':(52.2115,5.4750),
}

def in_annotation_box(lat,lon):
    return any(b['lat_min']<=lat<=b['lat_max'] and b['lon_min']<=lon<=b['lon_max'] for b in ANNOTATION_BOXES)

data=json.loads(GEO.read_text(encoding='utf-8'))
report=json.loads(REPORT.read_text(encoding='utf-8'))
raw=list(data['features'])
kept=[]; removed=[]
for feature in raw:
    lat,lon=centroid(feature)
    area=float(feature['properties'].get('area_m2_approx') or 0)
    if in_annotation_box(lat,lon):
        removed.append({'old_id':feature['properties'].get('id'),'centroid':[lat,lon],'area_m2':area,'reason':'pdf-annotation'})
    else:
        kept.append(feature)

# Assign names only on a tight positional match. Otherwise keep a generic area name.
used=set(); anchor_checks={}
for name,anchor in ANCHORS.items():
    choices=[(dist_m(anchor,centroid(f)),i) for i,f in enumerate(kept)]
    d,i=min(choices) if choices else (999999,None)
    anchor_checks[name]={'nearest_m':round(d,1),'feature_index':i}
    if i is not None and d<=200 and i not in used:
        kept[i]['properties']['name']=name
        kept[i]['properties']['name_basis']='confirmed location matched to official-map trace'
        used.add(i)

# Stable IDs north-to-south / west-to-east.
kept.sort(key=lambda f:(-centroid(f)[0],centroid(f)[1]))
for i,f in enumerate(kept,1):
    f['properties']['id']=f'nijkerk-losloop-{i:02d}'
    if not f['properties'].get('name') or f['properties']['name'].startswith('Losloopgebied'):
        f['properties']['name']=f'Losloopgebied {i}'
    f['properties']['quality']='digitised-from-official-pdf-v1'

data['features']=kept
data['properties']['quality_note']='Kleurgetraceerd uit de officiële gemeentelijke PDF; blauwe toelichtingstekst verwijderd; gegeorefereerd met Nijkerkse kaartlabels.'
GEO.write_text(json.dumps(data,indent=2,ensure_ascii=False),encoding='utf-8')

report['raw_feature_count']=len(raw)
report['feature_count']=len(kept)
report['removed_artifacts']=removed
report['anchor_checks']=anchor_checks
report['qc_expected_range']=[18,20]
report['ok']=18<=len(kept)<=20 and all(v['nearest_m']<500 for v in anchor_checks.values())
REPORT.write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')

print(json.dumps({'raw':len(raw),'kept':len(kept),'removed':len(removed),'anchors':anchor_checks,'ok':report['ok']},indent=2,ensure_ascii=False))
if not report['ok']:
    raise SystemExit('Post-processing QC failed')
