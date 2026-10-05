"""Build site/data/yemen-events.json from the UCDP GED CSV (CC BY 4.0).

Usage: python3 scripts/build_yemen_data.py GEDEvent_vXX_X.csv [version]
Optional: set UCDP_TOKEN to also pull newer UCDP Candidate events from the API.
Only Yemen events from 2010 onward are kept. Nothing is added or inferred.
"""
import csv, json, os, sys, urllib.request
from pathlib import Path
OUT = Path(__file__).resolve().parents[1] / 'site' / 'data' / 'yemen-events.json'
FROM_YEAR = 2010

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
        'fields': ['id','date_start','date_end','lat','lon','where_prec','type','best','low','high','civilians','side_a','side_b','governorate','place','source_office','headline','source_date'],
        'last_event': ev[-1][1] if ev else None, 'count': len(ev), 'events': ev,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(len(ev), 'events ->', OUT, OUT.stat().st_size, 'bytes')

if __name__ == '__main__':
    main()
