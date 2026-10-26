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


def runbox(rid):
    r = RUNS[rid]
    s = r['source']
    inp = r['input']
    shown = {k: v for k, v in inp.items()}
    real = 'النص المدخل مأخوذ من المصدر' if r['input_is_real_text'] else 'المدخل معدّل منا عمدًا'
    return ('<figure class="run"><figcaption><b>ناتج تشغيل فعلي</b> · الأداة <code>%s</code> · %s · المصدر: <a href="%s" rel="noopener noreferrer">%s (%s)</a></figcaption>'
            '<div class="io"><div><h4>المدخل</h4><pre dir="auto">%s</pre></div><div><h4>المخرج كما أعادته الأداة</h4><pre>%s</pre></div></div>'
            '<p class="muted">%s</p></figure>') % (E(r['tool']), E(real), E(s['url']), E(s['title']), E(s['date']), E(pj(shown)), E(pj(r['output'])), E(r['input_note']))


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
            'media': [], 'data': [], 'workflows': ['ask-werfalli', 'ask-werfalli-ar'], 'ai': []}
CAT_NOTE = {'media': 'لا نعرض هنا تشغيلًا حقيقيًا: أدوات هذه الفئة تحتاج ملفًا ترفعه أنت، ولم نجد ملفًا عامًا نعيد نشره بحقوق واضحة.',
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
    # hub
    cards = ''.join(f'<article class="feat"><span class="bar" aria-hidden="true"></span><small class="eyebrow">{k + 1:02d}</small><h3>{E(a)}</h3><p>{E(b)}</p><a href="{h.split("/")[-1]}">{E(l)} <span aria-hidden="true">←</span></a></article>' for k, (a, b, h, l) in enumerate(cat_cards))
    other = ''.join(f'<article class="feat"><span class="bar" aria-hidden="true"></span><h3>{E(a)}</h3><p>{E(b)}</p><a href="../{h}">{E(l)} <span aria-hidden="true">←</span></a></article>' for a, b, h, l in OTHERS)
    body = (page_head('أدوات التحقق · دليل المصادر المفتوحة', 'أدوات بايثون مفتوحة المصدر تعمل في متصفحك، موزعة على فئات في صفحات مستقلة.', '../') + site_header('../', 'الأدوات') +
            '<main id="main" class="wrap pagebody"><div class="sec-head"><h1>أدوات التحقق</h1><p>%d أداة مفتوحة المصدر، منها %d تعمل داخل متصفحك دون رفع نصك. نتائجها قواعدية قابلة للتتبع وتحتاج مراجعة بشرية، ولا تحكم بالصدق أو الكذب. كل فئة في صفحة مستقلة.</p></div>'
            '<div class="feats">%s</div><div class="sec-head" style="margin-top:34px"><h2>أدوات أخرى في المنصة</h2></div><div class="feats">%s</div></main>' % (len(ids_all), n_run, cards, other) + footer('../') + '</body></html>')
    (SITE / 'tools' / 'index.html').write_text(body, encoding='utf-8')
    static_pages(ns)
    return n_run, len(ids_all)


OTHERS = [
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
<p>الحساب الرسمي المعتمد للتواصل في الموقع هو صفحة المصمم على فيسبوك: <a href="https://www.facebook.com/share/19PTDvQ789/" rel="noopener noreferrer">فيسبوك ↗</a>. لا نعرض هنا بريدًا ولا هاتفًا ولا بيانات شركة لأننا لم نوثّقها بعد.</p>
<h2>ماذا في المنصة</h2>
<ul><li>خريطة من فروع الأدوات والمصادر المتاحة للعموم، لكل مدخل وصف عربي، وبحث بالمهمة يعمل في متصفحك.</li>
<li>أدوات بايثون مفتوحة المصدر تعمل في المتصفح، موزعة على فئات.</li>
<li>منهجية تحقيق من سبع مراحل ومنصة تحقق لحالات مستقلة وسجل أدلة.</li></ul>
<h2>كيف نبني</h2>
<p>الأصل المفتوح للخريطة مأخوذ من مشروع OSINT Framework (رخصة MIT)، وأضفنا إليه ترجمة الأوصاف العربية والفحص والمنصة. التفاصيل والتراخيص في <a href="sources.html">صفحة المصادر والتراخيص</a>. الكود مقروء ومتاح في <a href="https://github.com/ShehataElsayed/osint-arabic-sources" rel="noopener noreferrer">مستودع المشروع على جيت هب</a>.</p>
<h2>صحافة وحدود</h2>
<p>ما نقدمه أدوات مساعدة للبحث. القرار التحريري والمسؤولية عن النشر عند الصحفي. انظر <a href="limits.html">حدود المنصة</a>.</p>'''

PRIVACY = '''<p class="lead">نكتب هنا ما نعرفه فعلًا عن كيفية عمل الموقع. ما لم نتحقق منه نقول إننا لم نتحقق منه.</p>
<h2>يبقى في متصفحك</h2>
<ul><li>بحث الصفحة الرئيسية يجري في متصفحك على ملف فهرس مرفق بالموقع. نص سؤالك لا يُرسل إلى أي خادم.</li>
<li>أدوات بايثون تعمل في متصفحك عبر Pyodide. صفحة الأدوات لها سياسة أمان محتوى تمنع الاتصال بأي نطاق خارجي، وفي اختبارنا لم تُرسل طلبات خارجية.</li>
<li>OCR ومختبر البيانات يعالجان ملفاتك محليًا.</li>
<li>تُحفظ في تخزين المتصفح المحلي على جهازك فقط علامات تقدمك في المنهجية (<code>osint-methodology-progress-v1</code>) وحالات منصة التحقق (<code>osint-verification-v2</code>). تحذفها بمسح بيانات الموقع من المتصفح.</li></ul>
<h2>يُرسل إلى خدمة إحصاء</h2>
<p>الصفحات الرئيسية تحمّل نص إحصاء من <a href="https://www.goatcounter.com/" rel="noopener noreferrer">GoatCounter</a> وتبلغ نطاق <code>osint-arabic-sour.goatcounter.com</code> بزيارات الصفحات وبأحداث مجمعة: نقرة على رابط أداة (بصمة مجزأة وليس نص السؤال)، وحدث بحث بلا نص البحث، وأحداث زر البحث الذكي. شريط بحث الصفحة الرئيسية لا يطلق حدث البحث. لم نتحقق من مدة احتفاظ GoatCounter بالبيانات؛ راجع سياسته.</p>
<h2>يُرسل إلى خادم خارجي عند استخدامك له</h2>
<p>صفحتا المساعد (NewsRAG) والبحث الذكي ترسلان سؤالك إلى خدمة على <code>osint-rag.egkrkr.workers.dev</code> فقط عندما تستخدمهما. البحث الذكي لا يرسل إلا إذا كان الخيار الخارجي مفعّلًا. لم نتحقق مما تسجله هذه الخدمة أو تحتفظ به، فلا ترسل إليها معلومات حساسة أو مصادر تحتاج حمايتها.</p>
<h2>ما لا نفعله ولا نقوله</h2>
<ul><li>لا نضع مدة احتفاظ قانونية لم نقرّها، ولا نذكر جهة قانونية لم نوثّقها.</li><li>لا توجد حسابات مستخدمين ولا ملفات تعريف ارتباط للإعلانات في كود الموقع الذي راجعناه.</li></ul>
<p class="muted">آخر مراجعة لهذه الصفحة بحسب كود المستودع وقت النشر. إذا تغيّر الكود تتغير هذه الصفحة بتغيّره.</p>'''

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
