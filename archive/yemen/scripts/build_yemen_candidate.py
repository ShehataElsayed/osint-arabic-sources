"""Build yemen-candidate.json from the public UCDP Candidate monthly CSVs (CC BY 4.0, no token needed).
Usage: python3 scripts/build_yemen_candidate.py OUT.json [csv ...]   (no csv args: discover and download from ucdp.uu.se/downloads/)
Candidate data is provisional: UCDP revises it. It is kept apart from the final GED."""
import csv, io, json, re, sys, time, urllib.request
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_yemen_data as B
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'osint-arabic-sources'}), timeout=90).read()
def main():
    out = Path(sys.argv[1]); files = sys.argv[2:]
    texts = []
    if files:
        texts = [open(f, encoding='utf-8', errors='replace').read() for f in files]
    else:
        html = get('https://ucdp.uu.se/downloads/').decode('utf-8', 'replace')
        urls = sorted(set(re.findall(r'https://ucdp\.uu\.se/downloads/candidateged/GEDEvent_[\w]+\.csv', html)))
        for u in urls:
            texts.append(get(u).decode('utf-8', 'replace')); time.sleep(1)
    by = {}
    for t in texts:  # later files (alphabetical = chronological here) replace earlier versions of the same event
        for x in csv.DictReader(io.StringIO(t)):
            if not x.get('country', '').startswith('Yemen'): continue
            try: e = B.row_to_event(x)
            except Exception: continue
            e.append(x.get('code_status', ''))
            by[int(x['id'])] = e
    ev = sorted(by.values(), key=lambda e: (e[1], e[0]))
    d = {'source': 'UCDP Candidate Events Dataset (provisional, monthly)', 'license': 'CC BY 4.0', 'url': 'https://ucdp.uu.se/downloads/',
         'note': 'مبدئية: تُراجع وتُعدَّل من UCDP لاحقًا. الحقل الأخير هو علامة UCDP (Clear أو Check...).',
         'last_event': ev[-1][1] if ev else None, 'count': len(ev), 'events': ev}
    out.write_text(json.dumps(d, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(len(ev), 'candidate events, last', d['last_event'])
if __name__ == '__main__': main()
