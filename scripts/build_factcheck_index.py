"""Build site/rag-factchecks.json from MartinoMensio/claimreview-data (CC BY-NC-SA 4.0).
Usage: python3 scripts/build_factcheck_index.py path/to/claim_reviews.json
Keeps Arabic-script claims, drops AFP, stores only a short snippet + rating + link."""
import json, re, sys, collections
from pathlib import Path
AR = re.compile(r'[\u0600-\u06FF]')
EXCLUDE = ('afp.com',)
# The dataset's own normalised label is wrong for some Arabic checkers (e.g. original "كذب" stored as not_verifiable),
# so we map the ORIGINAL label ourselves. Unmapped labels keep no verdict.
GROUPS = [
 ('كاذب', 'false', ['false', 'كذب', 'خطأ', 'fabricated', 'كذب باسم العلم']),
 ('مضلل', 'false', ['تضليل', 'misleading', 'عنوان مضلل', 'خارج السياق', 'missing context', 'misplaced', 'false context', 'تلاعب بالحقائق', 'altered', 'manipulated', 'partly false', 'mostly false']),
 ('صحيح', 'true', ['مؤكد']),
 ('صحيح جزئيا', 'partial', ['half true']),
 ('غير مؤكد', 'uncertain', ['غير مؤكد']),
]
def group(original):
    o = original.strip().lower()
    for name, pol, keys in GROUPS:
        if o in keys or any(k in o for k in keys if len(k) > 6):
            return name, pol
    return '', ''
TAG = re.compile(r'<[^>]+>')
def clean(t):
    t = TAG.sub('', t).replace('&nbsp;', ' ').replace('&amp;', '&')
    t = re.sub(r'^\s*الادعاء\s*', '', t.strip())
    return re.sub(r'\s+', ' ', t).strip()
def build(src, out):
    d = json.load(open(src, encoding='utf-8'))
    rows, dropped = [], collections.Counter()
    for r in d:
        claim = clean(' '.join(r.get('claim_text') or []))
        fc = r.get('fact_checker') or {}
        url = r.get('review_url') or ''
        if not AR.search(claim) or not url: continue
        if any(x in (fc.get('domain') or '') or x in url for x in EXCLUDE): dropped['afp'] += 1; continue
        rv = (r.get('reviews') or [{}])[0]
        orig = str(rv.get('original_label') or '')[:60]; g, pol = group(orig)
        rows.append({'claim': claim[:220], 'rating': g, 'polarity': pol, 'original': orig,
                     'publisher': fc.get('name') or fc.get('domain') or '', 'date': (rv.get('date_published') or '')[:10], 'url': url})
    meta = {'source': 'https://github.com/MartinoMensio/claimreview-data', 'license': 'CC BY-NC-SA 4.0', 'license_url': 'https://creativecommons.org/licenses/by-nc-sa/4.0/', 'attribution': 'Derived from claimreview-data by Martino Mensio (https://github.com/MartinoMensio/claimreview-data); text rights remain with the fact-checkers; this file stays under CC BY-NC-SA 4.0, non-commercial use only.',
            'notice': 'بيانات ClaimReview من مشروع claimreview-data (CC BY-NC-SA 4.0). للاستخدام غير التجاري مع ذكر المصدر. حقوق النصوص لجهات التدقيق؛ المعروض مقتطف قصير مع الرابط.',
            'count': len(rows), 'with_verdict': sum(1 for x in rows if x['rating']), 'dropped': dict(dropped)}
    Path(out).write_text(json.dumps({'meta': meta, 'items': rows}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    return meta
if __name__ == '__main__':
    print(build(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 'site/rag-factchecks.json'))
