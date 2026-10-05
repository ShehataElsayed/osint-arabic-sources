"""Build data/yemen-places-ar.json from GeoNames (CC BY 4.0): populated places in Yemen that have an Arabic name.
Usage: python3 scripts/build_yemen_places.py YE.txt(country dump) alternateNamesV2/YE.txt"""
import csv, json, sys
sys.path.insert(0, str(Path(__file__).resolve().parent)) if False else None
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from yemen_ar import norm
OUT = Path(__file__).resolve().parents[1] / 'data' / 'yemen-places-ar.json'
ar = {}
for r in csv.reader(open(sys.argv[2], encoding='utf-8'), delimiter='\t', quoting=csv.QUOTE_NONE):
    if len(r) > 7 and r[2] == 'ar' and r[7] != '1':
        ar.setdefault(r[1], []).append((r[4] == '1', r[5] == '1', r[3]))
out = []
for r in csv.reader(open(sys.argv[1], encoding='utf-8'), delimiter='\t', quoting=csv.QUOTE_NONE):
    if r[6] in ('P', 'T', 'A') and r[0] in ar:
        best = sorted(ar[r[0]], key=lambda t: (not t[0], t[1]))[0][2]
        keys = sorted({norm(x) for x in [r[1], r[2]] + r[3].split(',') if x and x.isascii() or x and norm(x)})[:8]
        out.append([round(float(r[4]), 4), round(float(r[5]), 4), best, keys, int(r[14] or 0), r[6]])
OUT.write_text(json.dumps({'source': 'GeoNames', 'license': 'CC BY 4.0', 'url': 'https://www.geonames.org/', 'fields': ['lat', 'lon', 'ar', 'norm_names', 'pop', 'class'], 'places': out}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(len(out), 'places')
