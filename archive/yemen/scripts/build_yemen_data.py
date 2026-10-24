"""Build site/data/yemen-events.json from the UCDP GED CSV (CC BY 4.0).

Usage: python3 scripts/build_yemen_data.py GEDEvent_vXX_X.csv [version]
Only Yemen events from 2010 onward are kept. Values are not changed; Arabic names are added next to them.
"""
import csv, json, math, os, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from yemen_ar import GOV, PARTY
OUT = Path(__file__).resolve().parents[1] / 'site' / 'data' / 'yemen-events.json'
FROM_YEAR = 2010
_places = json.load(open(Path(__file__).resolve().parents[1] / 'data' / 'yemen-places-ar.json', encoding='utf-8'))['places']
_grid = {}
for _p in _places:
    if _p[5] == 'P': _grid.setdefault((int(_p[0] * 10), int(_p[1] * 10)), []).append(_p)
def nearest_ar(lat, lon, maxkm=8):
    best, bd = None, 1e9
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            for p in _grid.get((int(lat * 10) + dy, int(lon * 10) + dx), []):
                d = math.hypot((p[0] - lat) * 111, (p[1] - lon) * 111 * math.cos(math.radians(lat)))
                if d < bd and d <= maxkm: best, bd = p, d
    return best[2] if best else ''

def row_to_event(x):
    return [
        int(x['id']), x['date_start'][:10], x['date_end'][:10],
        round(float(x['latitude']), 4), round(float(x['longitude']), 4),
        int(x['where_prec']), int(x['type_of_violence']),
        int(float(x['best'])), int(float(x['low'])), int(float(x['high'])),
        int(float(x['deaths_civilians'] or 0)),
        x['side_a'][:90], x['side_b'][:90], x['adm_1'].replace(' governorate', ''),
        x['where_description'][:160],
        (x['source_office'] or '')[:80], (x['source_headline'] or '')[:160], x['source_date'][:10],
        nearest_ar(float(x['latitude']), float(x['longitude'])) if int(x['where_prec']) <= 2 else '',
    ]

def main():
    src = sys.argv[1]; version = sys.argv[2] if len(sys.argv) > 2 else 'GED'
    ev = []
    with open(src, encoding='utf-8', errors='replace') as f:
        for x in csv.DictReader(f):
            if x['country'].startswith('Yemen') and int(x['year']) >= FROM_YEAR:
                ev.append(row_to_event(x))
    ev.sort(key=lambda e: (e[1], e[0]))
    out = {
        'source': 'UCDP Georeferenced Event Dataset (GED)', 'version': version,
        'license': 'CC BY 4.0', 'url': 'https://ucdp.uu.se/downloads/',
        'cite': 'Davies, Pettersson, Oberg (2026) Organized violence 1989-2025, Journal of Peace Research; Sundberg & Melander (2013) JPR 50(4).',
        'fields': ['id','date_start','date_end','lat','lon','where_prec','type','best','low','high','civilians','side_a','side_b','governorate','place','source_office','headline','source_date','nearest_place_ar'],
        'ar': {'gov': GOV, 'party': PARTY},
        'last_event': ev[-1][1] if ev else None, 'count': len(ev), 'events': ev,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(len(ev), 'events ->', OUT, OUT.stat().st_size, 'bytes')

if __name__ == '__main__':
    main()
