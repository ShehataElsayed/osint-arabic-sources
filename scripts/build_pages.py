"""Tools category pages, tool-run boxes, and the static pages (about, privacy, limits, sources).
Called from build_branches.py with its namespace. Facts here come from the repository and from
data/tool-runs.json (real captured runs); nothing is invented."""
import html, json, re
from pathlib import Path

E = html.escape
ROOT = Path(__file__).resolve().parents[1]
RUNS = {r['id']: r for r in json.loads((ROOT / 'data/tool-runs.json').read_text(encoding='utf-8'))['runs']}
MANIFEST = json.loads((ROOT / 'site/tools/manifest.json').read_text(encoding='utf-8'))
TOOL_NAMES = {'claims': 'مستخرج الادعاءات'}


def pj(o):
    return json.dumps(o, ensure_ascii=False, indent=1)


def linkify(t):
    return re.sub(r'(https?://[^\s،]+)', lambda m: '<a href="%s" rel="noopener noreferrer" style="display:block;direction:ltr;text-align:left;overflow-wrap:anywhere">%s</a>' % (m.group(1), m.group(1)), t)


NAME_AR = {t['id']: t['name_ar'] for c in MANIFEST for t in c['tools']}
# Curated Arabic cards. Every number or status below is read from the captured JSON; the JSON stays available under "التفاصيل التقنية".
# tone: ok = expected result, warn = limit of the tool (not an accuracy feature), info = neutral.
CARDS = {
    'numdiff-grain': dict(tone='warn', badge='تنبيه خاطئ للأداة: 179 = 148 + 31',
        fed='ادعاء كتبناه نحن: «179 يومًا على الأقل». المصدر: فقرتان حرفيتان من التقرير تذكران 148 يومًا و31 يومًا.', excerpt=None,
        result='أبلغت الأداة عن «تعارض محتمل» بين 179 و148 (فرق 20.9%). الرقم 179 هو مجموع 148 و31 في التقرير نفسه، فالتنبيه خاطئ.',
        limit='لا يعني ذلك أن في التقرير تعارضًا. الأداة تقارن الأرقام المفردة ولا تجمعها، وهذا حد معروف فيها وليس ميزة دقة. المراجع البشري هو من يحسم.'),
    'quotecheck-werfalli': dict(tone='ok', badge='اقتباس معدَّل',
        fed='اقتباس أخذناه من التقرير ثم غيّرنا تاريخه عمدًا من 17 إلى 18 يوليو. المصدر: ثلاث فقرات حرفية من التقرير.', excerpt='The video was filmed from north to south, very likely on July 18, 2017',
        result='صنّفته الأداة «اقتباس معدَّل» وعرضت أقرب جملة في المصدر، والاختلاف في رقم واحد: 18 مقابل 17 (تشابه 0.93).',
        limit='التعديل منا وليس من أي جهة. الأداة تقارن النص بعد تطبيعه، ولا تلتقط الترجمة ولا إعادة الصياغة.'),
    'ask-werfalli': dict(tone='ok', badge='مقطع مرشح',
        fed='سؤال بالإنجليزية كتبناه نحن عن تاريخ تصوير المقطع، على ثلاث فقرات حرفية من التقرير.', excerpt='When was the video filmed?',
        result='رشّحت الأداة أولًا الجملة التي تذكر أن المقطع صُوّر على الأرجح في 17 يوليو 2017 قرابة 6:37 صباحًا، ثم جملتين أقل صلة.',
        limit='هذه مقاطع للقراءة وليست إجابة ولا تحقق. الترتيب لفظي بخوارزمية BM25.'),
    'ask-werfalli-ar': dict(tone='warn', badge='امتنعت عن الترشيح',
        fed='السؤال نفسه بالعربية: «متى صُوّر الفيديو؟» على الوثائق الإنجليزية نفسها.', excerpt=None,
        result='لم ترشّح الأداة أي مقطع وامتنعت عن الإجابة.',
        limit='هذا يبيّن حد البحث اللفظي: لا يربط بين العربية والإنجليزية. الامتناع أفضل من تخمين خاطئ.'),
    'hijri-werfalli': dict(tone='ok', badge='تحويل جدولي',
        fed='تاريخ التصوير الذي حدده التقرير: 2017-07-17.', excerpt=None,
        result='يقابل 22 شوال 1438 هـ، وكان يوم الإثنين.',
        limit='تقويم جدولي حسابي قد يختلف يومًا واحدًا عن رؤية الهلال الرسمية.'),
    'urlclean-grain': dict(tone='ok', badge='رابط منظّف',
        fed='رابط التقرير الحقيقي بعد أن أضفنا إليه بأنفسنا معاملي تتبع نموذجيين (utm_source وfbclid).', excerpt=None,
        result='أزالت الأداة معاملين وأعادت الرابط النظيف، وولّدت روابط لحفظ الصفحة في Wayback Machine وarchive.today.',
        limit='الأداة تولّد الروابط فقط ولا تحفظ الصفحة. تحتاج أنت إلى فتح رابط الحفظ.'),
    'evidence-werfalli': dict(tone='ok', badge='بصمة SHA-256',
        fed='ملف نصي من 384 بايت فيه المقتطفات الحرفية الثلاثة من التقرير.', excerpt=None,
        result='حسبت الأداة بصمة الملف وسجّلتها مع الملاحظة. يمكنك إعادة الحساب على النص نفسه.',
        limit='البصمة تثبت أن الملف لم يتغير منذ حسابها، ولا تثبت صحة ما فيه.'),
    'quotecheck-ecb': dict(tone='ok', badge='اقتباسان حرفيان',
        fed='اقتباسان من تقرير يورونيوز عن قرار البنك المركزي الأوروبي. المصدر: أربع فقرات حرفية من بيان البنك الرسمي.', excerpt=None,
        result='وجدت الأداة كلا الاقتباسين نصًا حرفيًا في البيان.',
        limit='هذا لا يثبت صحة ما قاله البنك، ولا يعني أن تقرير يورونيوز خالٍ من الأخطاء. هو اختبار لوظيفة الأداة.'),
    'numdiff-ecb': dict(tone='ok', badge='أرقام متطابقة',
        fed='جملتان من تقرير يورونيوز عن توقعات التضخم (3%، 2.5%، 2.1%) مقابل بيان البنك.', excerpt=None,
        result='الأرقام الثلاثة موجودة في البيان ولا يوجد رقم مختلف.',
        limit='المطابقة على الأرقام لفظيًا ولا تتحقق من السنة المنسوبة لكل رقم.'),
    'quotecheck-ecb-control': dict(tone='info', badge='ضابط: اقتباس مختلق منا',
        fed='الاقتباسان السابقان وأضفنا إليهما اقتباسًا ثالثًا مختلقًا من عندنا، هذا نصه:', excerpt='inflation will average 4% this year',
        result='الاقتباسان الأولان حرفيان، والثالث صُنّف «غير موجود في المصادر المقدَّمة».',
        limit='«غير موجود» لا يعني أن أحدًا لفّق: قد تكون المصادر ناقصة. هنا الاقتباس مختلق منا لنرى الاستجابة فقط.'),
    'exif-nasa': dict(tone='ok', badge='وسم واحد فقط',
        fed='الملف الأصلي لصورة من ناسا (9725x4862 بكسل). الصورة نفسها غير منشورة هنا.', excerpt=None,
        result='لا وجود إلا لوسم DateTimeDigitized بقيمة 2009-11-10 17:55:16. لا وقت التقاط أصلي، ولا كاميرا، ولا GPS.',
        limit='غياب الوسوم شائع في الصور المعالجة والمنشورة ولا يدل على تعديل ولا على أصالة.'),
    'imghash-nasa': dict(tone='ok', badge='تشابه إدراكي',
        fed='نسخة ناسا المصغّرة من الصورة، ونسخة صغّرناها نحن إلى الثُّمن وأعدنا ضغطها (تعديل منا).', excerpt=None,
        result='وقعت الصورتان في مجموعة واحدة بمسافة 0. ولم يُحسب للأصل بحجم 47 ميغابكسل تجزئة لأنه تجاوز سقف 25 مليون بكسل.',
        limit='التشابه الإدراكي يبيّن أن الصورة نفسها بحجمين، ولا يثبت من أين جاءت.'),
}


def bd(t):
    return re.sub(r'([A-Za-z][A-Za-z0-9_.\-]*(?: [A-Z][A-Za-z0-9_.\-]*)*|\d+(?:\.\d+)?%)', r'<bdi dir="ltr">\1</bdi>', t)


def runbox(rid):
    r = RUNS[rid]
    s = r['source']
    c = CARDS[rid]
    kind = 'ملفات حقيقية ونسخة معدّلة منا' if r.get('file_input') else ('نص حقيقي من المصدر' if r['input_is_real_text'] else 'مدخل معدّل منا عمدًا')
    quote = '<blockquote dir="ltr" lang="en">%s</blockquote>' % E(c['excerpt']) if c.get('excerpt') else ''
    return ('<article class="rcard %s"><header><div><small>ناتج تشغيل فعلي · %s</small><h4>%s</h4></div><span class="rbadge">%s</span></header>'
            '<p class="rsrc">المصدر: <a href="%s" rel="noopener noreferrer"><bdi dir="ltr">%s</bdi></a> · <bdi dir="ltr">%s</bdi></p>'
            '<dl><dt>ما أدخلناه</dt><dd>%s%s</dd><dt>ما أظهرته الأداة</dt><dd>%s</dd><dt>ما لا يثبته</dt><dd>%s</dd></dl>'
            '<details><summary>التفاصيل التقنية: المدخل والمخرج كما أعادتهما الأداة</summary><div class="io"><div><h5>المدخل</h5><pre dir="auto">%s</pre></div><div><h5>المخرج</h5><pre>%s</pre></div></div><p class="muted">%s</p></details></article>') % (
        c['tone'], E(kind), E(NAME_AR.get(r['tool'], r['tool'])), E(c['badge']), E(s['url']), E(s['title']), E(s['date']),
        bd(E(c['fed'])), quote, bd(E(c['result'])), bd(E(c['limit'])), E(pj(r['input'])), E(pj(r['output'])), linkify(E(r['input_note'])))


def expand_runs(text):
    return re.sub(r'\{\{run:([a-z0-9-]+)\}\}', lambda m: runbox(m.group(1)), text)


CAT_HERO = {
    'claims': 'تأكد أن الرقم والاقتباس في مقالك يطابقان مصدرهما.',
    'entities': 'اسحب الأسماء والأماكن والتواريخ من نص طويل ورتّبها.',
    'links': 'نظّف الرابط واحفظ نسخة منه وسجّل بصمة الدليل.',
    'media': 'اقرأ بيانات صورة، اكشف تكرارها، وافحص ملف Office دون تشغيله.',
    'data': 'مؤشرات على تنسيق الحسابات وأرقام غير طبيعية وتشابه النصوص.',
    'workflows': 'اسأل مستنداتك واجمع عدة أدوات في ملف تحقيق.',
    'ai': 'نماذج محلية لا تتوفر في المتصفح في هذه النسخة.',
}
CAT_RUNS = {'claims': ['quotecheck-ecb', 'numdiff-ecb', 'numdiff-grain', 'quotecheck-werfalli'], 'entities': ['hijri-werfalli'], 'links': ['urlclean-grain', 'evidence-werfalli'],
            'media': ['exif-nasa', 'imghash-nasa'], 'data': [], 'workflows': ['ask-werfalli', 'ask-werfalli-ar'], 'ai': []}
CAT_NOTE = {'media': 'الصورة نفسها غير منشورة هنا. نعرض بيانات الوصف والبصمات فقط وروابط المصدر. لا نعرض مثالًا حقيقيًا لفاحص ماكرو Office. استخدام مواد ناسا بحسب إرشادات ناسا: https://www.nasa.gov/nasa-brand-center/images-and-media/ ، وبعض المواد قد تحمل حقوقًا خاصة فتحقق من كل مادة.',
            'data': 'لا نعرض هنا تشغيلًا حقيقيًا بعد: لم نجمع بيانات عامة مناسبة لهذه الأدوات. لا نعرض أرقامًا مصطنعة على أنها واقع.',
            'ai': 'هذه الأدوات الثلاث مسجلة في المصدر المفتوح لكنها لا تعمل في المتصفح هنا، ولا ندّعي أن ذكاءً اصطناعيًا يعمل على الموقع. التفاصيل في ملفي MODELS.md وREADME.md داخل python-tools.'}


def build_all(ns):
    SITE, page_head, site_header, footer = ns['SITE'], ns['page_head'], ns['site_header'], ns['footer']
    (SITE / 'tools').mkdir(exist_ok=True)
    tpl = (ROOT / 'scripts/templates/tools-app.html').read_text(encoding='utf-8')
    ids_all = [t['id'] for c in MANIFEST for t in c['tools']]
    n_run = sum(1 for c in MANIFEST for t in c['tools'] if t['runs_in_browser'])
    cat_cards = []
    for c in MANIFEST:
        run_n = sum(1 for t in c['tools'] if t['runs_in_browser'])
        names = '، '.join(t['name_ar'] for t in c['tools'])
        extra = '' if run_n == len(c['tools']) else ' · غير متاحة في المتصفح'
        cat_cards.append((c['name_ar'], f'{c["desc_ar"]} ({len(c["tools"])} أدوات{extra}): {names}.', f'tools/{c["id"]}.html', 'افتح الفئة'))
    ns['CAT_CARDS'] = cat_cards
    # category pages
    for c in MANIFEST:
        ids = [t['id'] for t in c['tools']]
        sib = ''.join('<a href="%s.html"%s>%s</a>' % (k['id'], ' aria-current="page"' if k['id'] == c['id'] else '', E(k['name_ar'])) for k in MANIFEST)
        runs = ''.join(runbox(r) for r in CAT_RUNS[c['id']])
        note = f'<p class="warn">{E(CAT_NOTE[c["id"]])}</p>' if c['id'] in CAT_NOTE else ''
        hero = (f'<div id="chero"><nav class="catnav" aria-label="فئات الأدوات"><a href="index.html">كل الفئات</a>{sib}</nav>'
                f'<h1>{E(c["name_ar"])}</h1><p class="s">{E(c["desc_ar"])} {E(CAT_HERO[c["id"]])}</p></div>')
        page = make_tool_page(tpl, ids, hero, f'{c["name_ar"]} · أدوات OshAi', runs + note, ns)
        (SITE / 'tools' / f'{c["id"]}.html').write_text(page, encoding='utf-8')
    # Standalone journalistic tools are the primary platform destination.
    standalone = [
      ('رصد الادعاءات', 'قسّم النص وراجع المرشحات واقتباساتها. إشارات لغوية، لا حكم بصحة الادعاء.', 'claims.html'),
      ('الكيانات والعلاقات', 'استكشف العبارات المتكررة وراجع الروابط بينها. لا حسم تلقائي لهوية الأشخاص.', 'entities.html'),
      ('الخط الزمني', 'اجمع التواريخ وراجع الأحداث والتعارضات. التواريخ المرشحة ليست أحداثًا مؤكدة.', 'timeline.html'),
      ('مقارنة النسخ', 'قارن النصوص والأرقام والنفي مع مواضع الفروق الأصلية. اختلاف النص ليس إثبات تضليل.', 'versions.html'),
      ('استخراج النص ومراجعته', 'استخرج نص الصورة بالعربية والإنجليزية محليًا، وراجع الأخطاء أمام الأصل.', 'ocr.html'),
      ('فحص الصورة', 'بيانات وصفية وطبقات فحص محلية ومؤشرات للمراجعة. لا حكم تلقائي بالأصالة.', 'image-analysis.html'),
      ('لقطات الفيديو', 'استخرج لقطات وتوقيتات وسجل ملاحظاتك. البحث العكسي الخارجي بعد موافقة مستقلة.', 'video-frames.html'),
      ('ملف النطاق', 'تفكيك محلي للعنوان وسجلات DNS وRDAP اختيارية واضحة المصدر. لا إثبات لهوية المشغل.', 'domain-dossier.html'),
      ('أرشيف الويب', 'ابحث عن النسخ العامة المؤرشفة واحفظ بياناتها. التغطية ليست كاملة ولا تثبت المصدر الأول.', 'archive.html'),
      ('مسار التحقق', 'خطوات وأدوات مقترحة بقواعد معلنة. ليست خطة مولدة بالذكاء الاصطناعي.', 'planner.html'),
    ]
    standalone_cards = ''.join(f'<article class="feat"><small class="eyebrow">{i+1:02d}</small><h3>{E(t)}</h3><p>{E(d)}</p><a href="../{h}">افتح الأداة <span aria-hidden="true">←</span></a></article>' for i,(t,d,h) in enumerate(standalone))
    # hub
    cards = ''.join(f'<article class="feat"><span class="bar" aria-hidden="true"></span><small class="eyebrow">{k + 1:02d}</small><h3>{E(a)}</h3><p>{E(b)}</p><a href="{h.split("/")[-1]}">{E(l)} <span aria-hidden="true">←</span></a></article>' for k, (a, b, h, l) in enumerate(cat_cards))
    other = ''.join(f'<article class="feat"><span class="bar" aria-hidden="true"></span><h3>{E(a)}</h3><p>{E(b)}</p><a href="../{h}">{E(l)} <span aria-hidden="true">←</span></a></article>' for a, b, h, l in OTHERS)
    body = (page_head('أدوات الصحفي · دليل المصادر المفتوحة', 'أدوات مستقلة داخل المنصة، بخطوات وحدود واضحة.', '../') + site_header('../', 'الأدوات') +
            '<main id="main" class="wrap pagebody"><div class="sec-head standalone-intro" id="journalist-tools"><p class="eyebrow">اختر مهمتك</p><h1>أدوات الصحفي</h1><p>كل أداة في صفحة مستقلة. اختر المادة التي تعمل عليها، وراجع الناتج أمام الأصل قبل اعتماده. هذه الوظائف لا تصدر حكمًا تلقائيًا بصحة المحتوى.</p></div><div class="feats">' + standalone_cards + '</div>' +
            '<section class="box"><h2>قضاياك السابقة محفوظة</h2><p>افتح ملفات قضاياك القديمة والجديدة في دفتر المراجعة المستقل. ملف النطاق والادعاءات ومقارنة النسخ والخط الزمني ورصد الكيانات وOCR ومصمم المسار والأرشيف ولقطات الفيديو وفحص الصورة تدعم تنزيل قضية مع مصادرها، ثم فتحها وإضافة نتائج أخرى إليها. بقية الأدوات لم تكتمل وصلتها بعد. النقل باختيار ملف وتنزيل نسخة جديدة، دون رفع أو مسح الأصل.</p><a href="../case-review.html">افتح دفتر القضية والمراجعة</a><p><a href="../journalist-tools.html">الدفتر القديم للتوافق فقط</a></p></section>' +
            '<section class="box"><h2>مراجعة الترجمة</h2><p>صفحة الترجمة المستقلة لم تكتمل بعد. المراجعة المتوازية في الدفتر القديم يدوية، وليست خدمة ترجمة آلية.</p></section>' +
            '<div class="sec-head" style="margin-top:34px"><h2>مساعدات بايثون حسب الفئة</h2><p>%d أداة مسجلة، منها %d تعمل في المتصفح. الفئات التالية تضم عدة وظائف؛ ليست بديلًا عن صفحات الأدوات الصحفية أعلاه.</p></div><div class="feats">%s</div><div class="sec-head" style="margin-top:34px"><h2>أدوات وخدمات إضافية</h2></div><div class="feats">%s</div></main>' % (len(ids_all), n_run, cards, other) + footer('../') + '</body></html>')
    (SITE / 'tools' / 'index.html').write_text(body, encoding='utf-8')
    static_pages(ns)
    return n_run, len(ids_all)


OTHERS = [
    ('فرق إعادة ضغط الصورة', 'قارن الأصل بنسخة JPEG محليًا، مع قياسات وتقرير وحدود واضحة. ليست درجة تزييف ولا ذكاء اصطناعي.', 'image-difference.html', 'افحص الصورة'),
    ('استخراج نص من الصور (OCR)', 'نص عربي وإنجليزي من الصور داخل متصفحك. الملف لا يُرفع إلى أي خادم.', 'ocr.html', 'استخرج نصًا'),
    ('مختبر البيانات', 'استعلامات SQL على CSV وTSV وJSON عبر DuckDB في متصفحك.', 'data-lab.html', 'افتح المختبر'),
    ('منشئ الأوامر الاستقصائية', 'يحوّل هدف التحقيق إلى أوامر بحث مرتبة على مراحل المنهجية.', 'commands.html', 'ابنِ أوامر'),
    ('مساعد NewsRAG (تجريبي)', 'مسودة إجابة بمصادر. يتطلب خدمة خارجية ولم تُقس جودته على ادعاءات معروفة النتيجة، لذلك لا نقدمه كتحقق.', 'assistant.html', 'اقرأ الحدود'),
]


def make_tool_page(tpl, ids, hero, title, extra, ns):
    base = '../'
    s = tpl
    a = s.index('<div class="app"><div class="top">')
    b = s.index('<div id="home">')
    hdr = ns['site_header'](base, 'الأدوات')
    s = s[:a] + '<link rel="stylesheet" href="../platform.css"><style>body{background:var(--ink-bg,#050605)}header.top{margin:0}.app{max-width:1100px}.catnav{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0 0}.catnav a{border:1px solid #3b4232;border-radius:3px;padding:2px 12px;font-size:13px;color:var(--muted);text-decoration:none}.catnav a[aria-current]{border-color:var(--accent);color:var(--accent)}' \
        '.run{margin:14px 0;border:1px solid #3b4232;background:#0d100b;border-radius:4px;padding:12px}.run figcaption{font-size:13px;color:var(--muted)}.run .io{display:grid;grid-template-columns:1fr 1fr;gap:10px}.run h4{margin:8px 0 2px;font-size:12px;color:var(--muted)}@media(max-width:760px){.run .io{grid-template-columns:1fr}}</style>' + hdr + '<div class="app">' + s[b:]
    # hero replaces h1 + intro + count
    h1a = s.index('<div id="home"><h1>')
    qa = s.index('<input id="q"')
    s = s[:h1a] + '<div id="home">' + hero + '<div id="extra">' + extra + '</div>' + s[qa:]
    s = s.replace('T=t;', 'T=t.filter(x=>window.CAT.includes(x.id));', 1)
    s = re.sub(r"document\.getElementById\('n'\)\.textContent=[^\n]*?\n", "\n", s, count=1)
    s = s.replace('<title>أدوات التحقيق · OshAi (نموذج تجريبي)</title>', '<title>%s</title>' % E(title))
    s = s.replace('<div id="home">', '<script>window.CAT=%s</script><div id="home">' % json.dumps(ids), 1)
    s = s.replace("document.getElementById('home').style.display='none'", "document.getElementById('home').style.display='none'")
    # relative assets stay in the same folder (tools/)
    return s


def prose_page(ns, fname, title, desc, body):
    SITE, page_head, site_header, footer = ns['SITE'], ns['page_head'], ns['site_header'], ns['footer']
    h = page_head(title, desc, './') + site_header('./', 'من نحن' if fname == 'about.html' else '') + '<main id="main" class="wrap pagebody prose"><h1>%s</h1>%s</main>' % (E(title.split(' | ')[0]), body) + footer('./') + '</body></html>'
    (SITE / fname).write_text(h, encoding='utf-8')


def static_pages(ns):
    prose_page(ns, 'about.html', 'من نحن | دليل المصادر المفتوحة', 'من يقف خلف دليل المصادر المفتوحة للصحفيين العرب وما الذي نبنيه.', ABOUT)
    prose_page(ns, 'privacy.html', 'الخصوصية | دليل المصادر المفتوحة', 'ما الذي يبقى في متصفحك وما الذي يُرسل وإلى أين.', PRIVACY)
    prose_page(ns, 'limits.html', 'حدود المنصة وشروط الاستخدام | دليل المصادر المفتوحة', 'ما لا تضمنه المنصة وكيف تستخدم نتائجها.', LIMITS)
    prose_page(ns, 'sources.html', 'المصادر والتراخيص | دليل المصادر المفتوحة', 'مصدر البيانات والأدوات وتراخيصها.', SOURCES)


ABOUT = '''<p class="lead">دليل عربي للمصادر والأدوات المفتوحة، موجه للصحفيين الذين يحققون ويتحققون من المعلومات.</p>
<h2>من يبنيه</h2>
<p>يصمم المنصة ويطورها مهندس شحاته السيد، صحفي استقصائي يكتب في «صدى البلد» ويبني أدوات عربية للتحقق والتحقيق المفتوح المصدر. له مشروعات أخرى مفتوحة على جيت هب باسم <a href="https://github.com/ShehataElsayed" rel="noopener noreferrer">ShehataElsayed</a>، منها هذا الدليل ومشروع NewsRAG.</p>
<p>للتواصل مع المصمم: <a href="https://www.facebook.com/share/19PTDvQ789/" rel="noopener noreferrer">صفحته على فيسبوك ↗</a>.</p>
<h2>ماذا في المنصة</h2>
<ul><li>خريطة من فروع الأدوات والمصادر المتاحة للعموم، لكل مدخل وصف عربي، وبحث بالمهمة يعمل في متصفحك.</li>
<li>29 أداة بايثون مفتوحة المصدر في 7 فئات: 26 منها تعمل في المتصفح، و3 أدوات تعتمد على نماذج محلية غير متاحة فيه. منها مخطط القضية، وهو نموذج صغير مدرَّب على حالات اصطناعية كتبناها ولم يُختبر على تحقيقات حقيقية. بعضها مكتبات مستقلة مغلّفة بتراخيصها، مثل dnstwist وolevba.</li>
<li>منهجية تحقيق من سبع مراحل ومنصة تحقق لحالات مستقلة وسجل أدلة.</li></ul>
<h2>كيف نبني</h2>
<p>الأصل المفتوح للخريطة مأخوذ من مشروع OSINT Framework (رخصة MIT)، وأضفنا إليه ترجمة الأوصاف العربية والفحص والمنصة. التفاصيل والتراخيص في <a href="sources.html">صفحة المصادر والتراخيص</a>. الكود مقروء ومتاح في <a href="https://github.com/ShehataElsayed/osint-arabic-sources" rel="noopener noreferrer">مستودع المشروع على جيت هب</a>.</p>
<h2>صحافة وحدود</h2>
<p>ما نقدمه أدوات مساعدة للبحث. القرار التحريري والمسؤولية عن النشر عند الصحفي. انظر <a href="limits.html">حدود المنصة</a>.</p>'''

PRIVACY = '''<p class="lead">ما الذي يبقى في متصفحك، وما الذي يُرسل، وإلى أين.</p>
<h2>في متصفحك</h2>
<ul><li>بحث الصفحة الرئيسية يجري في متصفحك على ملف فهرس مرفق بالموقع، ونص سؤالك لا يُرسل إلى أي خادم.</li>
<li>أدوات بايثون تعالج النص والملفات داخل المتصفح عبر Pyodide، ولا يحتوي كودها على أي رفع لمدخلاتك. راجعنا طلبات الشبكة أثناء تشغيلها فوجدناها من النطاق نفسه فقط، وهذه ملاحظة تشغيل وليست ضمانًا أمنيًا.</li>
<li>OCR ومختبر البيانات يعالجان ملفاتك محليًا في المتصفح.</li>
<li>يحفظ المتصفح على جهازك علامات تقدمك في المنهجية (<code>osint-methodology-progress-v1</code>) وحالات منصة التحقق (<code>osint-verification-v2</code>). تحذفها بمسح بيانات الموقع من المتصفح.</li></ul>
<h2>خدمة الإحصاء</h2>
<p>تحمّل الصفحات الرئيسية نص إحصاء من <a href="https://www.goatcounter.com/" rel="noopener noreferrer">GoatCounter</a> ويبلغ النطاق <code>osint-arabic-sour.goatcounter.com</code> بزيارات الصفحات وبأحداث مجمعة: نقرة على رابط أداة (بصمة مجزأة للرابط)، وحدث بحث دون نص البحث، وأحداث زر البحث الذكي. شريط بحث الصفحة الرئيسية لا يطلق حدث بحث. مدة الاحتفاظ بهذه البيانات تحددها الخدمة، وسياستها عندها.</p>
<h2>الخدمة الخارجية للمساعد</h2>
<p>صفحتا المساعد (NewsRAG) والبحث الذكي ترسلان سؤالك إلى خدمة على <code>osint-rag.egkrkr.workers.dev</code> عند استخدامهما فقط، والبحث الذكي لا يرسل إلا إذا فعّلت الخيار الخارجي. ما تسجله هذه الخدمة ومدة احتفاظها لا نملك عنهما بيانًا موثقًا، فلا ترسل إليها معلومات حساسة أو مصادر تحتاج إلى حماية.</p>
<h2>الحسابات</h2>
<p>لا توجد حسابات مستخدمين في الموقع، ولا يحمّل كوده إعلانات.</p>'''

LIMITS = '''<p class="lead">ما تقدمه المنصة ترشيح ومساعدة للبحث. هذه حدودها.</p>
<ul><li><b>وجود أداة في الدليل لا يثبت صحة نتيجتها.</b> الأوصاف العربية مراجعة أولية، وحالة كثير من الروابط لم تُراجع. افحص الرابط والمصدر بنفسك. «مفتوحة» تعني متاحة للعموم، ولا تعني مجانية أو بلا تسجيل.</li>
<li><b>البحث ترتيب لفظي.</b> «قوة التطابق» مقياس لتطابق الكلمات، وليست احتمال أن النتيجة صحيحة. قد تظهر أداة لمجرد كلمة مشتركة. عند ضعف التطابق يمتنع البحث عن الترشيح.</li>
<li><b>أدوات بايثون قواعدية.</b> تنتج إشارات قابلة للتتبع تحتاج مراجعة بشرية: أداة مقارنة الأرقام لا تجمع، وفاحص الاقتباس لا يلتقط الترجمة وإعادة الصياغة، والبحث في المستندات لفظي ويفشل مع اختلاف اللغة. لا تحكم أي أداة بصدق خبر أو كذبه.</li>
<li><b>لا ذكاء اصطناعي مباشر على الموقع.</b> ثلاث أدوات نماذج محلية موجودة في المصدر المفتوح وغير متاحة في المتصفح. NewsRAG تجريبي ولم تُقس جودته.</li>
<li><b>الحالات الحقيقية</b> المعروضة تقارير منشورة لجهات أخرى وليست من إنتاج المنصة. نذكر منها ما ورد فيها فقط، مع الرابط الأصلي.</li>
<li><b>روابط خارجية.</b> نفتح مواقع طرف ثالث لا نتحكم بها. افتحها بعزل مناسب إن كان بحثك حساسًا.</li>
<li><b>المسؤولية.</b> القرار التحريري والنشر مسؤولية الصحفي. المنصة تُقدَّم كما هي دون ضمان، وتراخيص الكود والمحتوى في <a href="sources.html">صفحة المصادر</a>.</li></ul>'''

SOURCES = '''<h2>الخريطة</h2>
<p>الشجرة الأصلية مشتقة من <a href="https://github.com/lockfale/osint-framework" rel="noopener noreferrer">OSINT Framework</a> برخصة MIT وحقوقها لـ Justin Nordine. أضفنا الأوصاف العربية والفحص والشارات. الرخصة في <a href="LICENSE">LICENSE</a> والإشعارات الكاملة في <a href="THIRD_PARTY_NOTICES.md">THIRD_PARTY_NOTICES.md</a>.</p>
<h2>أدوات بايثون</h2>
<p>الكود المقروء في المجلد <code>python-tools</code> بالمستودع، وكذلك سكربت بناء حزمة المتصفح واختباراتها. تعمل في المتصفح عبر Pyodide 0.27.7 (MPL-2.0) مع numpy وPillow، ومكتبات بايثون مستقلة مضمّنة دون تعديل: dnstwist وoletools وغيرها. الإشعارات والتراخيص في <a href="tools/THIRD_PARTY/NOTICES.md">tools/THIRD_PARTY/NOTICES.md</a>. لا أوزان نماذج مضمّنة. dnstwist وolevba مكتبات مغلّفة وليستا «أدوات ذكاء اصطناعي».</p>
<h2>خط وبحث وغيرهما</h2>
<ul><li>خط Cairo برخصة SIL OFL: <a href="Cairo-OFL.txt">Cairo-OFL.txt</a>.</li><li>محرك Pagefind برخصة MIT: <a href="Pagefind-LICENSE">Pagefind-LICENSE</a>.</li><li>ملاحظات التطوير للمختبرات: <a href="NOTICE-DEVELOPMENT.md">NOTICE-DEVELOPMENT.md</a>.</li></ul>
<h2>الأمثلة الحقيقية</h2>
<p>مقتطفات قصيرة حرفية من تقريرين لبيلينغكات، مع روابطهما: <a href="https://www.bellingcat.com/news/2023/05/11/grain-trail-tracking-russias-ghost-ships-with-satellite-imagery/" rel="noopener noreferrer">مسار الحبوب (2023-05-11)</a> و<a href="https://www.bellingcat.com/news/middle-east/2017/10/03/how-an-execution-site-was-geolocated/" rel="noopener noreferrer">تحديد موقع إعدام للورفلي (2017-10-03)</a>. ناتج الأدوات عليها مسجل في <code>data/tool-runs.json</code> ويُعاد توليده بالسكربت <code>scripts/capture_tool_runs.py</code>. التقارير حقوقها لأصحابها.</p>'''
