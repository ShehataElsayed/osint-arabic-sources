"""Context layers for the Yemen page. Usage: python3 scripts/build_yemen_layers.py OUT_DIR
- yemen-thermal.json : NASA FIRMS VIIRS thermal anomalies, last 48 h, public domain (CC0 on HDX). NOT strikes.
- yemen-infra.json   : OpenStreetMap hospitals, airports, ports, power plants (ODbL, (c) OpenStreetMap contributors).
Needs: pip install pyshp. Both files are optional; a failed fetch leaves the previous file."""
import io, json, sys, time, urllib.parse, urllib.request, zipfile
from pathlib import Path
import shapefile
OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
BBOX = (12.0, 42.0, 19.5, 54.7)  # S, W, N, E: a box around Yemen; includes a few points in neighbouring areas
UA = {'User-Agent': 'osint-arabic-sources/1.0'}
def get(u, data=None):
    return urllib.request.urlopen(urllib.request.Request(u, data=data, headers=UA), timeout=120).read()
def thermal():
    base = 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/'
    srcs = [('S-NPP', 'suomi-npp-viirs-c2/shapes/zips/SUOMI_VIIRS_C2_Russia_Asia_48h.zip'), ('NOAA-20', 'noaa-20-viirs-c2/shapes/zips/J1_VIIRS_C2_Russia_Asia_48h.zip'), ('NOAA-21', 'noaa-21-viirs-c2/shapes/zips/J2_VIIRS_C2_Russia_Asia_48h.zip')]
    pts = []
    for name, p in srcs:
        z = zipfile.ZipFile(io.BytesIO(get(base + p)))
        sh = next(n for n in z.namelist() if n.endswith('.shp'))[:-4]
        r = shapefile.Reader(shp=io.BytesIO(z.read(sh + '.shp')), dbf=io.BytesIO(z.read(sh + '.dbf')), shx=io.BytesIO(z.read(sh + '.shx')))
        fn = [f[0] for f in r.fields[1:]]
        for rec in r.iterShapeRecords():
            lon, lat = rec.shape.points[0]
            if BBOX[0] <= lat <= BBOX[2] and BBOX[1] <= lon <= BBOX[3]:
                d = dict(zip(fn, rec.record))
                pts.append([round(lat, 4), round(lon, 4), str(d['ACQ_DATE']), d['ACQ_TIME'], name, d['CONFIDENCE'], round(float(d['FRP']), 1)])
        time.sleep(1)
    pts.sort(key=lambda p: (p[2], p[3]), reverse=True)
    (OUT / 'yemen-thermal.json').write_text(json.dumps({'source': 'NASA FIRMS VIIRS active fire (48h)', 'license': 'CC0 / public domain (HDX listing)', 'url': 'https://firms.modaps.eosdis.nasa.gov/active_fire/', 'updated': time.strftime('%Y-%m-%dT%H:%MZ', time.gmtime()), 'fields': ['lat', 'lon', 'date', 'time_utc', 'satellite', 'confidence', 'frp_mw'], 'points': pts}, separators=(',', ':')), encoding='utf-8')
    print('thermal', len(pts))
def infra():
    q = '[out:json][timeout:90];(nwr["amenity"="hospital"](%s);nwr["aeroway"="aerodrome"](%s);nwr["power"="plant"](%s);nwr["landuse"="port"](%s);nwr["harbour"="yes"]["name"](%s););out center tags;' % ((','.join(map(str, BBOX)),) * 5)
    j = json.loads(get('https://overpass-api.de/api/interpreter', urllib.parse.urlencode({'data': q}).encode()))
    items = []
    for e in j['elements']:
        t = e.get('tags', {}); c = e.get('center') or {'lat': e.get('lat'), 'lon': e.get('lon')}
        if c['lat'] is None: continue
        if t.get('power') and not (t.get('name') or t.get('name:ar')): continue
        kind = 'h' if t.get('amenity') == 'hospital' else 'a' if t.get('aeroway') else 'p' if t.get('power') else 'o'
        nm = t.get('name:ar') or ''
        en = t.get('name:en') or t.get('name') or ''
        items.append([kind, round(c['lat'], 4), round(c['lon'], 4), nm or (en if any('\u0600' <= ch <= '\u06ff' for ch in en) else ''), en if not nm else t.get('name:en', ''), e['type'][0] + str(e['id'])])
    (OUT / 'yemen-infra.json').write_text(json.dumps({'source': 'OpenStreetMap', 'license': 'ODbL 1.0, © مساهمو OpenStreetMap', 'url': 'https://www.openstreetmap.org/copyright', 'updated': time.strftime('%Y-%m-%dT%H:%MZ', time.gmtime()), 'kinds': {'h': 'مستشفى', 'a': 'مطار', 'p': 'محطة كهرباء', 'o': 'ميناء'}, 'items': items}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print('infra', len(items))
only = sys.argv[2] if len(sys.argv) > 2 else 'all'
for f in ((thermal,) if only == 'thermal' else (thermal, infra)):
    try: f()
    except Exception as ex: print(f.__name__, 'failed:', ex)
