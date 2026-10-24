"""Context datasets for the Yemen page (not conflict events). Usage: python3 scripts/build_yemen_context.py OUT_DIR [--boundaries]
- WFP/FAO food prices (HDX, CC BY-IGO) -> monthly national median USD price per commodity + latest by governorate
- FEWS NET acutely food insecure population, Phase 3+ (HDX, CC BY) -> monthly national series
- --boundaries: OCHA COD-AB governorate boundaries (HDX, CC BY-IGO), simplified, written once to yemen-admin1.json"""
import csv, io, json, statistics, sys, time, urllib.request, zipfile
from pathlib import Path
OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
UA = {'User-Agent': 'osint-arabic-sources/1.0'}
def get(u): return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=120).read()
COMM = {'Wheat flour': 'دقيق القمح', 'Rice (imported)': 'أرز مستورد', 'Oil (vegetable)': 'زيت نباتي', 'Sugar': 'سكر', 'Fuel (petrol-gasoline)': 'بنزين', 'Fuel (diesel)': 'ديزل'}
GOVAR = {}
def food():
    rows = [x for x in csv.DictReader(io.StringIO(get('https://data.humdata.org/dataset/98574e10-6866-4f13-a2b1-3c8312801af5/resource/2f0c1d18-d42d-4e43-b928-1bd1fc7f6c90/download/wfp_food_prices_yem.csv').decode('utf-8-sig'))) if x['date'][:1].isdigit() and x['commodity'] in COMM and x['usdprice']]
    by = {}
    for x in rows: by.setdefault(x['commodity'], {}).setdefault(x['date'][:7], []).append(float(x['usdprice']))
    series = {}
    for c, m in by.items():
        ks = sorted(m)[-48:]
        series[c] = {'ar': COMM[c], 'unit': next(r['unit'] for r in rows if r['commodity'] == c), 'months': ks, 'median_usd': [round(statistics.median(m[k]), 3) for k in ks]}
    last = max(x['date'] for x in rows)[:7]
    lat = {}
    for x in rows:
        if x['date'][:7] == last: lat.setdefault(x['commodity'], {}).setdefault(x['admin1'], []).append(float(x['usdprice']))
    latest = {c: {g: round(statistics.median(v), 3) for g, v in d.items()} for c, d in lat.items()}
    return {'source': 'WFP/FAO price data via HDX', 'license': 'CC BY-IGO', 'url': 'https://data.humdata.org/dataset/wfp-food-prices-for-yemen', 'last_month': last, 'series': series, 'latest_by_governorate': latest}
def fews():
    j = json.loads(get('https://fdw.fews.net/api/ipcpopulationsize/?preference=best&country=YE&scenario=CS&format=json'))
    pts = sorted({(x['projection_start'][:7], x['value'], x.get('source_document') or '') for x in j if x.get('phase') == '3+' and x.get('admin_1') is None and x.get('value')})
    return {'source': 'FEWS NET via HDX', 'license': 'CC BY', 'url': 'https://data.humdata.org/dataset/yemen_current_situation_fewsnet_fipe', 'series': [[m, v] for m, v, _ in pts][-60:], 'last_document': pts[-1][2] if pts else ''}
def dp(pts, tol):
    if len(pts) < 3: return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]; dx, dy = x2 - x1, y2 - y1; n = (dx * dx + dy * dy) ** .5 or 1e-12
    i, m = 0, 0
    for k in range(1, len(pts) - 1):
        d = abs(dy * pts[k][0] - dx * pts[k][1] + x2 * y1 - y2 * x1) / n
        if d > m: i, m = k, d
    if m > tol: return dp(pts[:i + 1], tol)[:-1] + dp(pts[i:], tol)
    return [pts[0], pts[-1]]
def boundaries():
    z = zipfile.ZipFile(io.BytesIO(get('https://data.humdata.org/dataset/6b2656e2-b915-4671-bfed-468d5edcd80a/resource/c79a3728-44cd-4d20-8ea4-ecfab88c1450/download/yem_admin_boundaries.geojson.zip')))
    g = json.loads(z.read('yem_admin1.geojson'))
    feats = []
    for f in g['features']:
        polys = f['geometry']['coordinates'] if f['geometry']['type'] == 'MultiPolygon' else [f['geometry']['coordinates']]
        out = []
        for p in polys:
            pts = [tuple(c[:2]) for c in p[0]]; h = len(pts) // 2; ring = dp(pts[:h + 1], 0.012)[:-1] + dp(pts[h:], 0.012)
            if len(ring) >= 4: out.append([[[round(x, 3), round(y, 3)] for x, y in ring]])
        feats.append({'type': 'Feature', 'properties': {'ar': f['properties']['adm1_name1'], 'en': f['properties']['adm1_name']}, 'geometry': {'type': 'MultiPolygon', 'coordinates': out}})
    (OUT / 'yemen-admin1.json').write_text(json.dumps({'type': 'FeatureCollection', 'source': 'OCHA COD-AB Yemen via HDX (CSO)', 'license': 'CC BY-IGO', 'features': feats}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print('boundaries', len(feats))
d = {'updated': time.strftime('%Y-%m-%dT%H:%MZ', time.gmtime())}
for k, f in (('food', food), ('fews', fews)):
    try: d[k] = f()
    except Exception as ex: print(k, 'failed:', ex)
(OUT / 'yemen-context.json').write_text(json.dumps(d, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('context keys', [k for k in d if k != 'updated'])
if '--boundaries' in sys.argv: boundaries()
