"""Fetch a headline index about Yemen from the GDELT DOC 2.0 API into site/data/yemen-news.json.
Only title, link, domain, language and date are stored (no article text). GDELT is free to use with credit.
Runs from the scheduled workflow; never fails the build if GDELT is down (keeps the old file)."""
import json, time, urllib.parse, urllib.request
from pathlib import Path
import sys
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / 'site' / 'data' / 'yemen-news.json'
QUERIES = {
    'ar': '(اليمن OR صنعاء OR الحوثي OR عدن) (غارة OR غارات OR قصف OR هجوم OR صاروخ)',
    'en': 'Yemen (airstrike OR strike OR missile OR attack OR Houthi)',
}
def fetch(q, lang):
    u = 'https://api.gdeltproject.org/api/v2/doc/doc?' + urllib.parse.urlencode({
        'query': f'{q} sourcelang:{lang}', 'mode': 'artlist', 'format': 'json', 'maxrecords': 75, 'sort': 'datedesc', 'timespan': '3d'})
    for _ in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'osint-arabic-sources'}), timeout=40) as r:
                return json.loads(r.read().decode('utf-8')).get('articles', [])
        except Exception:
            time.sleep(8)
    return None
def main():
    items, ok = [], False
    for lang, q in (('arabic', QUERIES['ar']), ('english', QUERIES['en'])):
        a = fetch(q, lang)
        if a is None: continue
        ok = True
        for x in a:
            d = x.get('seendate', '')
            items.append({'t': x.get('title', '')[:200], 'u': x['url'], 'd': x.get('domain', ''), 'l': lang,
                          'at': f"{d[:4]}-{d[4:6]}-{d[6:8]}T{d[9:11]}:{d[11:13]}:00Z" if len(d) >= 13 else ''})
        time.sleep(6)
    if not ok:
        print('GDELT unavailable, keeping previous file'); return
    seen, out = set(), []
    for i in sorted(items, key=lambda i: i['at'], reverse=True):
        if i['u'] in seen: continue
        seen.add(i['u']); out.append(i)
    OUT.write_text(json.dumps({'source': 'GDELT DOC 2.0', 'url': 'https://www.gdeltproject.org/', 'updated': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'items': out[:120]}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(len(out), 'headlines')
main()
