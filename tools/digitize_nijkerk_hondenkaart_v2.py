#!/usr/bin/env python3
"""Second-pass georeferencing for the Nijkerk dog map digitizer.

Uses exact, independently located street/place labels visible on the official PDF and
chooses repeated PDF labels using the already calibrated fallback map position.
"""
from __future__ import annotations
import math
import re
import digitize_nijkerk_hondenkaart as d

# Reliable BAG/address-derived centres for labels printed on the official map.
d.CONTROL_POINTS={
    'marishof':(52.214079738106,5.4972254031864),
    'bramenhof':(52.21930798348,5.4990966536221),
    'flierhof':(52.225222900545,5.4710108085616),
    'eikepage':(52.213077936051,5.4614261621056),
    'middachtenstraat':(52.217182,5.475982),
    'meilingstr':(52.220123047267,5.4740710972127),
    'slichtenhorsterweg':(52.20886,5.48317),
    'amersfoortseweg':(52.2078973,5.4733756),
}

def norm(s):
    return re.sub(r'[^a-z0-9]','',s.lower().replace('’','').replace("'",''))

def geo_dist2(a,b):
    return (a[0]-b[0])**2 + ((a[1]-b[1])*0.62)**2

def exact_control_words(page):
    # First get the safe map-frame transform solely to disambiguate repeated labels.
    fallback=d.build_georef(page, [])
    words=page.get_text('words')
    chosen=[]
    debug=[]
    for key,(lat,lon) in d.CONTROL_POINTS.items():
        hits=[]
        for x0,y0,x1,y1,text,*_ in words:
            t=norm(text)
            if not t:
                continue
            match=(t==key) or (len(key)>=7 and key in t) or (len(t)>=7 and t in key)
            if not match:
                continue
            cx,cy=(x0+x1)/2,(y0+y1)/2
            # Main cartographic frame only.
            if not (page.rect.width*.027 <= cx <= page.rect.width*.738 and page.rect.height*.10 <= cy <= page.rect.height*.955):
                continue
            est_lon=fallback['lon_a']*cx+fallback['lon_b']
            est_lat=fallback['lat_a']*cy+fallback['lat_b']
            hits.append({'key':key,'x':cx,'y':cy,'lat':lat,'lon':lon,'text':text,'fallback_lat':est_lat,'fallback_lon':est_lon,'fallback_error2':geo_dist2((est_lat,est_lon),(lat,lon))})
        if hits:
            hit=min(hits,key=lambda h:h['fallback_error2'])
            hit.pop('fallback_error2',None)
            chosen.append(hit)
            debug.extend(hits)
    return chosen

d.find_control_words=exact_control_words

# Require a genuinely useful fit. If the labels don't support one, the base script falls
# back to the calibrated map frame instead of publishing a bad transformation.
_original_build=d.build_georef
def strict_build(page,controls):
    if len(controls)>=4:
        lon_fit=d.robust_linear([c['x'] for c in controls],[c['lon'] for c in controls])
        lat_fit=d.robust_linear([c['y'] for c in controls],[c['lat'] for c in controls])
        if lon_fit and lat_fit and lon_fit[2] < 0.00125 and lat_fit[2] < 0.00125:
            return {'mode':'exact-label-fit','lon_a':lon_fit[0],'lon_b':lon_fit[1],'lat_a':lat_fit[0],'lat_b':lat_fit[1],'lon_rms_deg':lon_fit[2],'lat_rms_deg':lat_fit[2],'control_count':len(controls)}
    return _original_build(page,[])

d.build_georef=strict_build

d.main()
