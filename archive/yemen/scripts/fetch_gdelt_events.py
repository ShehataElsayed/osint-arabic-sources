"""Near-live, UNVERIFIED media-derived signals about Yemen from the GDELT 2.0 Event feed (15-minute files).
Keeps events with CAMEO root 18 (assault), 19 (fight), 20 (unconventional mass violence) whose action location
is in Yemen and below country level. Writes a compact JSON (OUT arg, default site/data/yemen-signals.json).
GDELT is free to use with credit (https://www.gdeltproject.org/about.html). These rows are machine-coded from news
articles: location, actor and event type can be wrong, and one event can appear many times."""
import csv, datetime, io, json, math, sys, urllib.request, zipfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from yemen_ar import GOV, CAMEO, gov_from_place, norm, PLACE_OVERRIDES, _k
ROOT = Path(__file__).resolve().parents[1]
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'site' / 'data' / 'yemen-signals.json'
HOURS = int(sys.argv[2]) if len(sys.argv) > 2 else 72
places = json.load(open(ROOT / 'data' / 'yemen-places-ar.json', encoding='utf-8'))['places']
grid = {}
for p in places: grid.setdefault((int(p[0] * 10), int(p[1] * 10)), []).append(p)
def nearest(lat, lon, maxkm=6):
    best, bd = None, 1e9
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            for p in grid.get((int(lat * 10) + dy, int(lon * 10) + dx), []):
                d = math.hypot((p[0] - lat) * 111, (p[1] - lon) * 111 * math.cos(math.radians(lat)))
                if d < bd and (d < maxkm): best, bd = p, d
    return best
def by_name(full, lat, lon, maxkm=8):
    first = norm(full.split(',')[0])
    best = None
    for dy in (-3, -2, -1, 0, 1, 2, 3):
        for dx in (-3, -2, -1, 0, 1, 2, 3):
            for p in grid.get((int(lat * 10) + dy, int(lon * 10) + dx), []):
                if first not in p[3]: continue
                d = math.hypot((p[0] - lat) * 111, (p[1] - lon) * 111 * math.cos(math.radians(lat)))
                if d < maxkm and (best is None or p[4] > best[4]): best = p
    return best
def get(t):
    u = f"http://data.gdeltproject.org/gdeltv2/{t:%Y%m%d%H%M}00.export.CSV.zip"
    try:
        with urllib.request.urlopen(u, timeout=25) as r: return r.read()
    except Exception: return None
now = datetime.datetime.utcnow().replace(second=0, microsecond=0); now -= datetime.timedelta(minutes=now.minute % 15)
groups, files = {}, 0
for i in range(0, HOURS * 4):
    t = now - datetime.timedelta(minutes=15 * i); b = get(t)
    if not b: continue
    files += 1
    z = zipfile.ZipFile(io.BytesIO(b))
    for r in csv.reader(io.TextIOWrapper(z.open(z.namelist()[0]), encoding='utf-8', errors='replace'), delimiter='\t'):
        if len(r) < 61 or r[53] != 'YM' or r[28] not in ('18', '19', '20') or r[51] not in ('3', '4', '5'): continue
        try: lat, lon = float(r[56]), float(r[57])
        except ValueError: continue
        k = (round(lat, 3), round(lon, 3), r[28])
        g = groups.setdefault(k, {'lat': lat, 'lon': lon, 'root': r[28], 'codes': {}, 'geo': r[52], 'gtype': int(r[51]), 'adm1': r[54], 'first': r[59], 'last': r[59], 'm': 0, 'src': {}, 'tone': []})
        g['codes'][r[26][:3]] = g['codes'].get(r[26][:3], 0) + 1
        g['first'] = min(g['first'], r[59]); g['last'] = max(g['last'], r[59])
        g['m'] += int(r[31] or 0); g['tone'].append(float(r[34] or 0))
        if r[60] and r[60] not in g['src'] and len(g['src']) < 6:
            g['src'][r[60]] = r[60].split('/')[2].replace('www.', '') if r[60].count('/') >= 2 else ''
if files == 0:
    print('GDELT unavailable, keeping previous file'); sys.exit(0)
def ts(s): return f"{s[:4]}-{s[4:6]}-{s[6:8]}T{s[8:10]}:{s[10:12]}:00Z"
out = []
for g in groups.values():
    code = max(g['codes'], key=g['codes'].get); p = by_name(g['geo'], g['lat'], g['lon']) if g['gtype'] in (3, 4) else None
    gov = gov_from_place(g['geo'])
    out.append({'lat': round(g['lat'], 4), 'lon': round(g['lon'], 4), 'type': g['gtype'], 'cameo': code, 'cameo_ar': CAMEO.get(code, CAMEO[g['root']]),
                'place_en': g['geo'], 'place_ar': PLACE_OVERRIDES.get(_k(g['geo'].split(',')[0]), p[2] if p else ''), 'gov_ar': gov, 'first': ts(g['first']), 'last': ts(g['last']),
                'mentions': g['m'], 'tone': round(sum(g['tone']) / len(g['tone']), 1), 'sources': [{'u': u, 'd': d} for u, d in g['src'].items()]})
out.sort(key=lambda s: s['last'], reverse=True)
OUT.write_text(json.dumps({'source': 'GDELT 2.0 Event Database', 'url': 'https://www.gdeltproject.org/', 'label': 'إشارات إعلامية آلية غير محققة', 'updated': ts(now.strftime('%Y%m%d%H%M')), 'hours': HOURS, 'files': files, 'signals': out[:600]}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(files, 'files,', len(out), 'signals ->', OUT)
