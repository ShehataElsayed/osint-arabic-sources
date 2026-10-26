"""Generate the connected-branches homepage and one page per branch from the built map data.

Run after build_content.py: it reads the dataset embedded in _site/map.html, so edited
descriptions and community additions are included. Output: index.html, branches/*.html.
"""
from pathlib import Path
import html, json, math, re, sys

ROOT = Path(__file__).resolve().parents[1]
SITE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / '_site'
E = html.escape

m = re.search(r'const DATA=(.*?);const LIBS=', (SITE / 'map.html').read_text(), re.S)
if not m:
    raise SystemExit('Dataset not found in map.html')
data = json.loads(m.group(1))
tops = data['children']

# Seven research paths. Each branch belongs to exactly one; unknown branches go to the last path.
CLUSTERS = [
    ('01', 'من هو؟', 'الهوية والحسابات', 'اسم مستخدم، بريد، رقم، حساب، مجتمع.',
     ['Username', 'Email Address', 'Social Networks', 'Instant Messaging', 'People Search Engines', 'Dating', 'Telephone Numbers', 'Online Communities', 'Classifieds']),
    ('02', 'أين تقف البنية؟', 'الشبكة والبنية التقنية', 'نطاقات، عناوين، سحابة، تهديدات، هواتف.',
     ['Domain Name', 'Cloud Infrastructure', 'IP & MAC Address', 'Cyber Threat Intelligence', 'Dark Web', 'Mobile OSINT']),
    ('03', 'هل هذا حقيقي؟', 'الوسائط والتحقق', 'صور وفيديو، تضليل، ترجمة، ملفات مشبوهة.',
     ['Images / Videos / Docs', 'Disinformation & Media Verification', 'Language Translation', 'Encoding / Decoding', 'Malicious File Analysis']),
    ('04', 'أين ومتى؟', 'المكان والحركة', 'خرائط، إحداثيات، طيران، سفن، مركبات.',
     ['Geolocation Tools / Maps', 'Transportation']),
    ('05', 'من يملك؟ وأين المال؟', 'السجلات والملكية والمال', 'سجلات عامة وشركات وامتثال وسلاسل الكتل.',
     ['Public Records', 'Business Records', 'Compliance & Risk Intelligence', 'Blockchain & Cryptocurrency']),
    ('06', 'من أين أبدأ؟', 'البحث والأرشفة والأتمتة', 'محركات، أرشيف، أدوات مساعدة، ذكاء اصطناعي.',
     ['Search Engines', 'Archives', 'Tools', 'AI Tools']),
    ('07', 'كيف أحمي نفسي وأثبت؟', 'الحماية والتوثيق والتدريب', 'أمن العمليات، التقاط الأدلة، التدريب.',
     ['OpSec', 'Documentation / Evidence Capture', 'Training']),
]


def ar_n(n, one, two, few, many):
    """Arabic counted noun: 1 / 2 / 3-10 / 11+ (n=0 handled by callers)."""
    if n == 1: return one
    if n == 2: return two
    return few if 3 <= n <= 10 else many

def ar_tools(n): return f'<b>{n}</b> ' + ar_n(n, 'أداة', 'أداتان', 'أدوات', 'أداة')
def ar_subs(n): return 'بلا أقسام فرعية' if n == 0 else (ar_n(n, 'قسم واحد', 'قسمان', f'{n} أقسام', f'{n} قسمًا'))
def ar_brs(n): return ar_n(n, 'فرع واحد', 'فرعان', f'{n} فروع', f'{n} فرعًا')

def title(n):
    return n.get('ar') or n['name']


def slug(n, i):
    s = re.sub(r'[^a-z0-9]+', '-', n['name'].lower()).strip('-')
    return s or f'branch-{i + 1}'


def leaves(n, path=()):
    if n.get('url'):
        yield n, list(path)
    for c in n.get('children', []):
        yield from leaves(c, path + ((title(n),) if n.get('children') else ()))


def count(n):
    return sum(1 for _ in leaves(n))


slugs = {t['name']: slug(t, i) for i, t in enumerate(tops)}
by_name = {t['name']: (i, t) for i, t in enumerate(tops)}
assigned = {name for c in CLUSTERS for name in c[4]}
extra = [t['name'] for t in tops if t['name'] not in assigned]
clusters = [list(c[:4]) + [[n for n in c[4] if n in by_name]] for c in CLUSTERS]
clusters[-1][4] += extra
clusters = [c for c in clusters if c[4]]

total_tools = sum(1 for _ in leaves(data))
n_unique = len({n['url'] for n, _ in leaves(data)})
total_sub = 0


def folders(n):
    return sum(1 + folders(c) for c in n.get('children', []) if c.get('children'))


total_sub = sum(folders(t) for t in tops)


def glyph(n, size=(132, 74)):
    """Data-driven fingerprint: the branch node, one dot per direct sub-branch (area ~ tool count)."""
    w, h = size
    cx, cy = w / 2, h / 2
    subs = [(title(c), count(c)) for c in n.get('children', []) if c.get('children')]
    direct = sum(1 for c in n.get('children', []) if c.get('url'))
    subs.sort(key=lambda x: -x[1])
    subs = subs[:9]
    parts = [f'<svg class="glyph" viewBox="0 0 {w} {h}" aria-hidden="true" focusable="false">']
    pts = []
    k = len(subs) + (1 if direct else 0)
    mx = max([c for _, c in subs] + [direct, 1])
    items = [c for _, c in subs] + ([direct] if direct else [])
    for j, c in enumerate(items):
        ang = -math.pi / 2 + (2 * math.pi * j / max(k, 1)) + 0.35
        rx, ry = w * 0.36, h * 0.34
        x, y = cx + rx * math.cos(ang), cy + ry * math.sin(ang)
        r = 2.2 + 4.6 * math.sqrt(c / mx)
        pts.append((x, y, r, j == len(subs) and bool(direct)))
    for x, y, r, d in pts:
        parts.append(f'<line x1="{cx:.1f}" y1="{cy:.1f}" x2="{x:.1f}" y2="{y:.1f}"/>')
    for x, y, r, d in pts:
        parts.append(f'<circle class="{"d" if d else "s"}" cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}"/>')
    parts.append(f'<circle class="c" cx="{cx:.1f}" cy="{cy:.1f}" r="5.5"/></svg>')
    return ''.join(parts)


HEAD_FONT = '@font-face{font-family:Cairo;src:url("%sCairo.ttf") format("truetype");font-weight:200 1000;font-display:swap}'
NAV = [
    ('الفروع', '%sindex.html#branches'), ('المنهجية', '%smethodology.html'), ('التحقق', '%sverification.html'),
    ('الأوامر', '%scommands.html'), ('OCR', '%socr.html'), ('مختبر البيانات', '%sdata-lab.html'), ('أدوات التحقق', '%stools/index.html'), ('NewsRAG', '%sassistant.html'),
]


def page_head(ttl, desc, base):
    return (f'<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<meta name="theme-color" content="#0a0b0a"><meta name="description" content="{E(desc)}"><title>{E(ttl)}</title>'
            f'<style>{HEAD_FONT % base}</style><link rel="stylesheet" href="{base}platform.css"></head><body>'
            '<a class="skip" href="#main">تخطَّ إلى المحتوى</a>')


def site_header(base, here=''):
    cur = ' aria-current="page"'
    links = ''.join('<a href="%s"%s>%s</a>' % (h % base, cur if l == here else '', l) for l, h in NAV)
    return (f'<header class="top"><a class="brand" href="{base}index.html" aria-label="الصفحة الرئيسية"><img src="{base}brand/oshai-mark.svg" alt="" width="46" height="28">'
            '<span><b>دليل المصادر المفتوحة</b><small>للصحفيين العرب</small></span></a>'
            f'<nav class="nav" aria-label="التنقل الرئيسي">{links}</nav></header>')


def footer(base):
    return ('<footer class="foot"><div><img src="%sbrand/oshai-mark.svg" alt="" width="40" height="24"><p>صممت بواسطة مهندس شحاته السيد · OshAi · <a class="fb" href="https://www.facebook.com/share/19PTDvQ789/" target="_blank" rel="noopener noreferrer">فيسبوك ↗</a></p></div>'
            '<p class="fine">الترشيح والتصنيف مساعدان للبحث، لا يثبتان صحة أي معلومة. ارجع إلى المصدر الأولي قبل النشر. '
            '<a href="%smap.html">المكتبات وقوائم إضافية</a> · <a href="%sTHIRD_PARTY_NOTICES.md">التراخيص</a></p></footer>') % (base, base, base)


def badges(n):
    out = []
    for k, l, t in [('localInstall', 'T', 'تثبيت محلي'), ('googleDork', 'D', 'بحث متقدم'), ('registration', 'R', 'يتطلب تسجيلًا'), ('editUrl', 'M', 'تعديل الرابط')]:
        if n.get(k) or f'({l})' in n['name']:
            out.append(t)
    pr = {'free': 'مجاني', 'freemium': 'مجاني بحدود', 'paid': 'مدفوع'}.get((n.get('pricing') or '').lower())
    if pr:
        out.append(pr)
    if n.get('status') == 'deprecated' or n.get('deprecated'):
        out.append('قديمة بحسب المصدر')
    return out


def safe(u):
    return bool(u) and u.startswith(('https://', 'http://'))


def tool_card(n, i, path):
    ok = safe(n.get('url')) and not n.get('unverifiedLink') and not n.get('linkUnsafe')
    desc = n.get('arDescription') or 'الشرح العربي قيد الإعداد'
    tags = ''.join(f'<span class="tag">{E(b)}</span>' for b in badges(n))
    if n.get('unverifiedLink'):
        tags += '<span class="tag warn">الرابط غير متحقق منه</span>'
    if n.get('linkUnsafe'):
        tags += '<span class="tag warn">وجهة غير آمنة، الرابط معطّل</span>'
    sub = f'<small class="path">{E(" › ".join(path))}</small>' if path else ''
    act = (f'<a class="go" href="{E(n["url"])}" target="_blank" rel="noopener noreferrer" data-osint-tool="{E(n["name"])}">افتح الأداة <span aria-hidden="true">↗</span></a>' if ok else '')
    return (f'<article class="tool" data-q="{E((n["name"] + " " + desc + " " + " ".join(path)).lower())}" data-name="{E(n["name"])}" data-url="{E(n.get("url") if ok else "")}" data-desc="{E(desc[:220])}">'
            f'<span class="bar" aria-hidden="true"></span><div class="tool-top"><small class="no">{i:03d}</small>{sub}</div>'
            f'<h3 dir="auto">{E(n["name"])}</h3><p dir="auto">{E(desc)}</p><div class="tags">{tags}</div><div class="acts">{act}</div></article>')


# ---------------------------------------------------------------- branch pages
(SITE / 'branches').mkdir(exist_ok=True)
cluster_of = {}
for ci, c in enumerate(clusters):
    for name in c[4]:
        cluster_of[name] = ci


def branch_page(i, t):
    base = '../'
    sl = slugs[t['name']]
    ci = cluster_of.get(t['name'], 0)
    cl = clusters[ci]
    n_tools = count(t)
    # sections: direct tools first, then each first-level sub-branch
    sections = []
    direct = [c for c in t.get('children', []) if c.get('url')]
    if direct:
        sections.append(('أدوات الفرع العامة', direct, []))
    for c in t.get('children', []):
        if c.get('children'):
            sections.append((title(c), None, c))
    peers = [(j, tops[j]) for j in range(len(tops)) if cluster_of.get(tops[j]['name']) == ci and j != i]
    chips = ''.join(f'<a href="#s{k}"><b>{E(name)}</b><i>{(len(items) if items is not None else count(node))}</i></a>' for k, (name, items, node) in enumerate(sections))
    body = []
    counter = 0
    for k, (name, items, node) in enumerate(sections):
        rows = [(x, []) for x in items] if items is not None else list(leaves(node))
        # tools inside nested folders show their sub-path (without the section name itself)
        cards = []
        for x, p in rows:
            counter += 1
            cards.append(tool_card(x, counter, [q for q in p if q != name]))
        body.append(f'<section class="sect" id="s{k}" aria-labelledby="h{k}"><div class="sect-head"><span class="dot" aria-hidden="true"></span><h2 id="h{k}">{E(name)}</h2><small>{len(rows)} أداة</small></div><div class="tools">{"".join(cards)}</div></section>')
    peer_html = ''.join(f'<a class="peer" href="{slugs[p["name"]]}.html"><span>{E(title(p))}</span><small>{count(p)}</small></a>' for _, p in peers)
    prev_t, next_t = tops[(i - 1) % len(tops)], tops[(i + 1) % len(tops)]
    desc = f'{title(t)}: {n_tools} أداة ومصدر مفتوح في {len(sections)} أقسام، بوصف عربي لكل أداة.'
    h = page_head(f'{title(t)} | دليل المصادر المفتوحة', desc, base) + site_header(base, 'الفروع')
    h += (f'<main id="main" class="wrap branch"><nav class="crumbs" aria-label="مسار التصفح"><a href="{base}index.html">الرئيسية</a><span>›</span><a href="{base}index.html#branches">الفروع</a><span>›</span><span aria-current="page">{E(title(t))}</span></nav>'
          f'<section class="b-hero"><div class="node big"><span class="bar" aria-hidden="true"></span><small class="eyebrow">{cl[0]} / {E(cl[2])}</small>'
          f'<h1>{E(title(t))}</h1><p class="en" dir="ltr" lang="en">{E(t["name"])}</p>'
          f'<div class="b-stats"><span><b>{n_tools}</b> أداة</span><span><b>{len(sections)}</b> أقسام</span></div></div>'
          f'<div class="b-glyph">{glyph(t, (264, 148))}<small>بنية الفرع: كل نقطة قسم، ومساحتها بعدد أدواته</small></div></section>'
          f'<div class="b-tools-bar"><nav class="chips" aria-label="أقسام الفرع">{chips}</nav>'
          f'<label class="filter"><span class="sr">ابحث داخل هذا الفرع</span><input id="filter" type="search" placeholder="ابحث داخل هذا الفرع" autocomplete="off"></label></div>'
          f'<p id="count" class="muted" role="status" aria-live="polite"></p>'
          f'{"".join(body)}<p id="none" class="empty" hidden>لا توجد أداة مطابقة داخل هذا الفرع. جرّب كلمة أخرى أو ابحث من <a href="{base}index.html#search">الصفحة الرئيسية</a>.</p>'
          f'<aside class="peers" aria-label="فروع من نفس المسار"><h2>من نفس المسار: {E(cl[2])}</h2><div>{peer_html or "<p class=muted>هذا الفرع وحده في مساره.</p>"}</div></aside>'
          f'<div class="pager"><a href="{slugs[prev_t["name"]]}.html">→ {E(title(prev_t))}</a><a href="{slugs[next_t["name"]]}.html">{E(title(next_t))} ←</a></div></main>')
    h += footer(base) + f'<script src="{base}taskfile.js"></script><script src="{base}branch.js" defer></script><script defer src="{base}analytics.js"></script></body></html>'
    (SITE / 'branches' / f'{sl}.html').write_text(h)


for i, t in enumerate(tops):
    branch_page(i, t)

# ---------------------------------------------------------------- homepage
def short(n):
    n = n.split(' / ')[0]
    return n if len(n) <= 24 else n[:23].rstrip() + '…'


def node_html(i, t, k):
    sl = slugs[t['name']]
    tilt = ((k * 7 + i * 3) % 5 - 2) * 0.55
    nsub = folders(t)
    return (f'<a class="node" href="branches/{sl}.html" data-b="{i}" style="--tilt:{tilt:.2f}deg"><span class="bar" aria-hidden="true"></span>'
            f'<small class="eyebrow">{i + 1:02d} / <span dir="ltr">{E(short(t["name"]))}</span></small>{glyph(t)}'
            f'<strong>{E(title(t))}</strong><span class="meta">{ar_tools(count(t))} · {ar_subs(nsub)}</span><span class="hit-badge" hidden></span></a>')


map_html = []
for ci, (num, q, name, blurb, members) in enumerate(clusters):
    nodes = ''.join(node_html(by_name[n][0], by_name[n][1], k) for k, n in enumerate(members))
    cnt = sum(count(by_name[n][1]) for n in members)
    map_html.append(
        f'<div class="cluster" data-c="{ci}"><div class="hub"><span class="bar" aria-hidden="true"></span><small class="eyebrow">{num} / المسار</small>'
        f'<h3>{E(q)}</h3><p class="hub-name">{E(name)}</p><p class="hub-blurb">{E(blurb)}</p><span class="meta">{ar_tools(cnt)} · {ar_brs(len(members))}</span></div>'
        f'<div class="nodes">{nodes}</div></div>')

STAGES = [('التحضير والأمان', 'احمِ نفسك ومصادرك قبل أول بحث.'), ('الهدف والفرضيات', 'حوّل الفكرة إلى فرضيات قابلة للفحص.'), ('جمع المصادر', 'ابدأ بمحركات البحث ثم وسّع الدائرة.'),
          ('الحفظ والتوثيق', 'أرشف الرابط ولقطة الشاشة وتاريخ الوصول.'), ('التحليل والربط', 'خط زمني وعلاقات وجداول نظيفة.'), ('التحقق المتقاطع', 'مصدران مستقلان على الأقل لكل معلومة.'), ('النشر الآمن', 'انشر ما ثبت، وأعلن حدود ما لم يثبت.')]
stages_html = ''.join(f'<li><span class="n">{k + 1:02d}</span><b>{E(a)}</b><p>{E(b)}</p></li>' for k, (a, b) in enumerate(STAGES))

FEATURES = [
    ('خريطة الفروع', f'{len(tops)} فرعًا و{total_sub} قسمًا و{total_tools} مدخلًا ({n_unique} رابطًا فريدًا؛ بعض الأدوات تتكرر في أكثر من فرع)، لكل مدخل وصف عربي وشارات: تثبيت محلي، بحث متقدم، تسجيل.', '#branches', 'تصفح الفروع'),
    ('البحث بالمهمة', 'اكتب مهمتك بكلماتك فيرتب البحث أدوات الدليل ويوضح الكلمات والفروع التي استند إليها. يعمل في متصفحك.', '#search', 'جرّب البحث'),
    ('منهجية من سبع مراحل', 'خارطة طريق من السؤال إلى النشر، مع علامات إنجاز تُحفظ على جهازك فقط.', 'methodology.html', 'افتح المنهجية'),
    ('منصة التحقق', 'حالات مستقلة، مسارات بحسب نوع المادة، سجل أدلة، وتصدير نسخة قابلة للمراجعة. لا تصدر حكمًا تلقائيًا.', 'verification.html', 'افتح التحقق'),
    ('منشئ الأوامر الاستقصائية', 'يحوّل هدف التحقيق إلى أوامر بحث جاهزة مرتبة على مراحل المنهجية.', 'commands.html', 'ابنِ أوامر'),
    ('OCR محلي', 'استخراج نص عربي وإنجليزي من الصور داخل متصفحك؛ الملف لا يُرفع إلى أي خادم.', 'ocr.html', 'استخرج نصًا'),
    ('مختبر البيانات', 'استعلامات SQL كاملة على CSV وTSV وJSON عبر DuckDB في متصفحك، مع منع الوصول الخارجي.', 'data-lab.html', 'افتح المختبر'),
    ('مساعدات تحقق بالبايثون (تجريبية)', 'مساعدات قاعدية تعمل داخل متصفحك دون إرسال نصوصك: مقارنة أرقام، فحص اقتباسات، تنظيف روابط، تاريخ هجري وغيرها. بعضها يحتاج نموذجًا محليًا غير متاح هنا، ولا ذكاء اصطناعي متصل. أول تحميل ثقيل (نحو 20 ميجابايت).', 'tools/index.html', 'افتح الأدوات'),
    ('مساعد NewsRAG (تجريبي)', 'مسودة إجابة بمصادر مفحوصة آليًا. يتطلب خدمة خارجية، وجودته لم تُقَس على مجموعة ادعاءات معروفة النتيجة.', 'assistant.html', 'اقرأ حدوده'),
]
feat_html = ''.join(f'<article class="feat"><span class="bar" aria-hidden="true"></span><small class="eyebrow">{k + 1:02d}</small><h3>{E(a)}</h3><p>{E(b)}</p><a href="{h}">{E(l)} <span aria-hidden="true">←</span></a></article>' for k, (a, b, h, l) in enumerate(FEATURES))

# Real example route built from tools that exist in the dataset (names verified at build time).
ROUTE = [('Images / Videos / Docs', 'صورة متداولة بلا مصدر', ['TinEye', 'Yandex Images', 'Google Images']),
         ('Disinformation & Media Verification', 'فحص التزييف والبحث العكسي', ['InVID', 'FotoForensics', 'Forensically']),
         ('Archives', 'حفظ النسخة قبل أن تُحذف', ['Wayback Machine', 'archive.today', 'Perma.cc']),
         ('Documentation / Evidence Capture', 'توثيق الدليل وتاريخ الوصول', ['Full Page Screen Capture', 'ShareX', 'Web Page Saver'])]
route_items = []
used = set()
for bname, label, names in ROUTE:
    if bname not in by_name:
        continue
    bi, bt = by_name[bname]
    pool = [n for n, _ in leaves(bt)]
    found = []
    for nm in names:
        for n in pool:
            if nm.lower() in n['name'].lower() and n['name'].lower() not in used:
                found.append(n)
                used.add(n['name'].lower())
                break
    if not found:
        found = pool[:3]
    route_items.append((bi, bt, label, found[:3]))
route_html = ''.join(
    f'<li><a class="rb" href="branches/{slugs[bt["name"]]}.html"><small class="eyebrow">{k + 1:02d} / {E(title(bt))}</small><strong>{E(label)}</strong></a>'
    f'<ul>{"".join("<li dir=auto>" + E(f["name"]) + "</li>" for f in found)}</ul></li>' for k, (bi, bt, label, found) in enumerate(route_items))

EXAMPLES = ['أين أجد سجلات الشركات والملكية؟', 'أريد تتبع سفينة', 'حساب باسم مستخدم عبر المنصات', 'أرشيف نسخة قديمة من صفحة محذوفة']

tpl = (SITE / 'index.html').read_text()
home = (tpl.replace('__HEADER__', site_header('./', 'الفروع').replace('aria-current="page"', '')).replace('__FOOTER__', footer('./')).replace('__BRANCH_MAP__', ''.join(map_html)).replace('__STAGES__', stages_html).replace('__FEATURES__', feat_html)
        .replace('__ROUTE__', route_html).replace('__N_BRANCH__', str(len(tops))).replace('__N_SUB__', str(total_sub)).replace('__N_UNIQUE__', str(n_unique)).replace('__N_TOOLS__', str(total_tools))
        .replace('__N_CLUSTERS__', str(len(clusters))).replace('__EXAMPLES_JSON__', json.dumps(EXAMPLES, ensure_ascii=False))
        .replace('__BRANCH_META__', json.dumps([{'t': title(t), 's': slugs[t['name']], 'n': count(t)} for t in tops], ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')))
assert '__' not in re.sub(r'__proto__', '', ''.join(re.findall(r'__[A-Z_]+__', home))), 'unfilled placeholder'
(SITE / 'index.html').write_text(home)
print('branches', len(tops), 'clusters', len(clusters), 'tools', total_tools)
