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

# The official PDF contains one blue explanatory note at the west side:
# "Doornsteeg: geen uitlaatstroken, wel afvalbakken." Its glyphs are bright cyan and
# therefore appear in a pure colour extraction. This geographic box is where those
# glyphs land after georeferencing; it is not a designated blue polygon on the map.
ANNOTATION_BOX={'lat_min':52.2268,'lat_max':52.2292,'lon_min':5.4455,'lon_max':5.4510}

# Confirmed named Nijkerk locations used as an independent positional sanity check.
ANCHORS={
  'Marishof':(52.2140797,5.4972254),
  'Bramenhof':(52.2193080,5.4990967),
  'Van der Flierhof':(52.2252229,5.4710108),
  'Antonie Meilingstraat':(52.22012,5.47407),
  'Doornsteeg':(52.22435,5.46266),
  'Eikepage':(52.21308,5.46143),
  'Stadspark Nijkerk':(52.2208,5.4865),
  'Corlaerpark':(52.2115,5.4750),
}

data=json.loads(GEO.read_text(encoding='utf-8'))
report=json.loads(REPORT.read_text(encoding='utf-8'))
raw=list(data['features'])
kept=[]; removed=[]
for feature in raw:
    lat,lon=centroid(feature)
    area=float(feature['properties'].get('area_m2_approx') or 0)
    annotation=(ANNOTATION_BOX['lat_min']<=lat<=ANNOTATION_BOX['lat_max'] and ANNOTATION_BOX['lon_min']<=lon<=ANNOTATION_BOX['lon_max'])
    tiny=area<800
    if annotation or tiny:
        removed.append({'old_id':feature['properties'].get('id'),'centroid':[lat,lon],'area_m2':area,'reason':'pdf-annotation' if annotation else 'tiny-colour-artifact'})
    else:
        kept.append(feature)

# Assign a name only where a traced polygon is clearly nearest to a confirmed anchor.
# Generic polygons remain generic; we do not invent names.
used=set(); anchor_checks={}
for name,anchor in ANCHORS.items():
    choices=[]
    for i,f in enumerate(kept):
        d=dist_m(anchor,centroid(f))
        choices.append((d,i))
    d,i=min(choices) if choices else (999999,None)
    anchor_checks[name]={'nearest_m':round(d,1),'feature_index':i}
    if i is not None and d<=450 and i not in used:
        kept[i]['properties']['name']=name
        kept[i]['properties']['name_basis']='confirmed location matched to official-map trace'
        used.add(i)

# Final stable IDs.
kept.sort(key=lambda f:(-centroid(f)[0],centroid(f)[1]))
for i,f in enumerate(kept,1):
    f['properties']['id']=f'nijkerk-losloop-{i:02d}'
    if not f['properties'].get('name') or f['properties']['name'].startswith('Losloopgebied'):
        f['properties']['name']=f'Losloopgebied {i}'
    f['properties']['quality']='digitised-from-official-pdf-v1'

data['features']=kept
data['properties']['quality_note']='Automatisch kleurgetraceerd uit de officiële PDF; blauwe toelichtingstekst verwijderd; kaartgeometrie gegeorefereerd naar Nijkerk.'
GEO.write_text(json.dumps(data,indent=2,ensure_ascii=False),encoding='utf-8')

report['raw_feature_count']=len(raw)
report['feature_count']=len(kept)
report['removed_artifacts']=removed
report['anchor_checks']=anchor_checks
report['qc_expected_range']=[15,22]
report['ok']=15<=len(kept)<=22 and all(v['nearest_m']<800 for v in anchor_checks.values())
REPORT.write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')

print(json.dumps({'raw':len(raw),'kept':len(kept),'removed':len(removed),'anchors':anchor_checks,'ok':report['ok']},indent=2,ensure_ascii=False))
if not report['ok']:
    raise SystemExit('Post-processing QC failed')
