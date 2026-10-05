"""Build yemen-reviewed.json from GitHub issues labeled `yemen-reviewed` (only repo triage+ can add the label).
Usage: GITHUB_TOKEN=... python3 scripts/build_yemen_reviewed.py OUT.json owner/repo
A request counts only if it has: a signal key lat|lon|cameo, a reviewer name, and >=2 source URLs from different domains."""
import json, os, re, sys, urllib.request
from urllib.parse import urlparse
out, repo = sys.argv[1], sys.argv[2]
req = urllib.request.Request(f'https://api.github.com/repos/{repo}/issues?labels=yemen-reviewed&state=all&per_page=100', headers={'Accept': 'application/vnd.github+json', 'Authorization': 'Bearer ' + os.environ.get('GITHUB_TOKEN', ''), 'User-Agent': 'osint-arabic-sources'})
issues = json.load(urllib.request.urlopen(req, timeout=60))
def field(body, label):
    m = re.search(r'###\s*' + re.escape(label) + r'\s*\n+(.*?)(?=\n###|\Z)', body, re.S)
    return (m.group(1).strip() if m else '')
rows = []
for i in issues:
    if 'pull_request' in i: continue
    b = i.get('body') or ''
    key = field(b, 'مفتاح الإشارة'); rev = field(b, 'اسم المراجع'); src = field(b, 'المصادر (رابط في كل سطر، مصدران مستقلان على الأقل)')
    urls = re.findall(r'https?://[^\s)>\]]+', src)
    doms = {urlparse(u).netloc.lower().removeprefix('www.') for u in urls}
    if not re.fullmatch(r'-?[\d.]+\|-?[\d.]+\|\d+', key) or not rev or len(doms) < 2: continue
    rows.append({'key': key, 'status': 'documented', 'reviewer': rev[:80], 'date': (i.get('closed_at') or i['updated_at'])[:10], 'note': field(b, 'ما الذي جرى التحقق منه وكيف')[:500], 'evidence_urls': urls[:8], 'issue': i['html_url']})
json.dump({'note': 'سجل المراجعة البشرية. يبنى آليًا من طلبات موسومة yemen-reviewed.', 'reviewed': rows}, open(out, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(rows), 'reviewed')
