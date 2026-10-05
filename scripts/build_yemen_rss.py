"""Write RSS 2.0 feeds from yemen-signals.json: one for all of Yemen and one per governorate.
Usage: python3 scripts/build_yemen_rss.py SIGNALS.json OUT_DIR. Items are UNVERIFIED media-derived signals (GDELT)."""
import json, sys, time
from email.utils import format_datetime
from datetime import datetime, timezone
from pathlib import Path
from xml.sax.saxutils import escape
sys.path.insert(0, str(Path(__file__).resolve().parent))
d = json.load(open(sys.argv[1], encoding='utf-8')); out = Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
SLUG = {'أبين': 'abyan', 'عدن': 'aden', 'البيضاء': 'bayda', 'الضالع': 'dhale', 'الحديدة': 'hodeidah', 'الجوف': 'jawf', 'المهرة': 'mahra', 'المحويت': 'mahwit', 'عمران': 'amran', 'ذمار': 'dhamar', 'حضرموت': 'hadramaut', 'حجة': 'hajjah', 'إب': 'ibb', 'لحج': 'lahj', 'مأرب': 'marib', 'ريمة': 'raymah', 'صعدة': 'saada', 'صنعاء': 'sanaa', 'أمانة العاصمة': 'sanaa-city', 'شبوة': 'shabwah', 'سقطرى': 'socotra', 'تعز': 'taiz'}
NOTE = 'إشارة إعلامية آلية من GDELT، غير محققة. قد يكون الموقع أو النوع خاطئًا. افتح المصدر وتحقق. ليست حدثًا موثقًا.'
def feed(title, sigs, fn):
    items = []
    for g in sorted(sigs, key=lambda g: g['last'], reverse=True)[:60]:
        where = (g.get('place_ar') or g.get('gov_ar') or 'اليمن')
        s0 = g['sources'][0]['u'] if g['sources'] else 'https://ucdp.uu.se/'
        dt = datetime.strptime(g['last'], '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=timezone.utc)
        links = ''.join(f"<li>{escape(x['d'])}: {escape(x['u'])}</li>" for x in g['sources'][:5])
        items.append(f"<item><title>{escape(where + ' - ' + g['cameo_ar'])}</title><link>{escape(s0)}</link><guid isPermaLink=\"false\">{g['lat']},{g['lon']},{g['cameo']},{g['last']}</guid><pubDate>{format_datetime(dt)}</pubDate><description>{escape('<p>' + NOTE + '</p><ul>' + links + '</ul>')}</description></item>")
    x = f'<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>{escape(title)}</title><link>https://github.com/ShehataElsayed/osint-arabic-sources</link><description>{escape(NOTE)} المصدر: GDELT.</description><language>ar</language>{"".join(items)}</channel></rss>'
    (out / fn).write_text(x, encoding='utf-8')
sigs = d.get('signals', [])
feed('إشارات إعلامية عن اليمن (غير محققة)', sigs, 'yemen-rss-all.xml')
for gov, slug in SLUG.items():
    feed(f'إشارات إعلامية: {gov} (غير محققة)', [g for g in sigs if g.get('gov_ar') == gov], f'yemen-rss-{slug}.xml')
print('feeds', len(SLUG) + 1)
