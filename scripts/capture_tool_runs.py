"""Runs the shipped Python tools on short, attributed excerpts of two public Bellingcat reports
and records exact input, output and source in data/tool-runs.json. Rerun: python3 scripts/capture_tool_runs.py"""
import json, os, sys, tempfile, datetime
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'python-tools'))
from oshai_tools import run

GRAIN = {'title': 'Grain Trail: Tracking Russia’s Ghost Ships With Satellite Imagery', 'by': 'Bellingcat', 'date': '2023-05-11',
         'url': 'https://www.bellingcat.com/news/2023/05/11/grain-trail-tracking-russias-ghost-ships-with-satellite-imagery/'}
WERF = {'title': 'How a Werfalli Execution Site Was Geolocated', 'by': 'Bellingcat', 'date': '2017-10-03',
        'url': 'https://www.bellingcat.com/news/middle-east/2017/10/03/how-an-execution-site-was-geolocated/'}
G_CLAIM = 'Bellingcat identified at least 179 days in the first 12 months of the invasion when ships were present at the terminal.'
G_SRC = ('In total, there are 148 days that ships appear to have been present at the terminal, based on Planet imagery alone.\n\n'
         'Bellingcat has also been able to identify a further 31 days when ships were present at the terminal.')
W1 = 'In August 2017, the International Criminal Court (ICC) issued its first ever arrest warrant solely based on social media evidence.'
W2 = 'The video which prompted the ICC arrest warrant was uploaded on July 23, 2017. The video has been deleted since, though an archived version exists.'
W3 = 'The video was filmed from north to south, very likely on July 17, 2017, approximately at 6:37 am.'
W_DOCS = '\n---\n'.join([W1, W2, W3])
URL_IN = GRAIN['url'] + '?utm_source=newsletter&fbclid=IwAR0x'

runs = []
def add(id_, tool, source, inp, note, real_input):
    out = run(tool, **inp)
    runs.append({'id': id_, 'tool': tool, 'source': source, 'input': inp, 'output': out, 'input_note': note, 'input_is_real_text': real_input})

add('numdiff-grain', 'numdiff', GRAIN, {'claim': G_CLAIM, 'source': G_SRC},
    'المصدر مقتطف حرفي من التقرير. الادعاء جملة كتبناها نحن تلخّص مجموع الرقمين في التقرير.', True)
add('quotecheck-werfalli', 'quotecheck', WERF, {'article': 'The report says: "The video was filmed from north to south, very likely on July 18, 2017".', 'sources': W_DOCS},
    'المصادر مقتطفات حرفية من التقرير. الاقتباس هو الجملة الأصلية بعد أن غيّرنا التاريخ من 17 إلى 18 عمدًا لنرى هل تكتشفه الأداة.', False)
add('ask-werfalli', 'ask', WERF, {'question': 'When was the video filmed?', 'docs': W_DOCS},
    'السؤال كتبناه نحن، والوثائق مقتطفات حرفية من التقرير.', True)
add('ask-werfalli-ar', 'ask', WERF, {'question': 'متى صُوّر الفيديو؟', 'docs': W_DOCS},
    'السؤال نفسه بالعربية على الوثائق الإنجليزية نفسها: يبيّن حد البحث اللفظي.', True)
add('hijri-werfalli', 'hijri', WERF, {'date': '2017-07-17'}, 'التاريخ الذي حدده التقرير لتصوير الفيديو.', True)
add('urlclean-grain', 'urlclean', GRAIN, {'url': URL_IN}, 'رابط التقرير الحقيقي بعد أن أضفنا إليه معاملي تتبع نموذجيين بأنفسنا.', False)

ECB = {'title': 'Monetary policy decisions, European Central Bank', 'by': 'ECB', 'date': '2026-09-10',
       'url': 'https://www.ecb.europa.eu/press/pr/date/2026/html/ecb.mp260910~314e508016.en.html'}
ECB_SRC = "The Governing Council today decided to raise the three key ECB interest rates by 25 basis points. The conflict in the Middle East continues to generate inflation pressures, and inflation is set to remain well above target for an extended period. Today’s decision underscores the Governing Council’s commitment to setting monetary policy to ensure that inflation stabilises at its 2% target in the medium term.\n\nThe baseline of the new ECB staff projections sees headline inflation averaging 3.0% in 2026, 2.5% in 2027 and 2.1% in 2028. For inflation excluding energy and food, the baseline foresees 2.5% in 2026, 2.6% in 2027 and 2.3% in 2028. Compared with June, the baseline projection for inflation in 2026 is unchanged, while it has been revised up for 2027 and 2028. The baseline projection for economic growth is 0.9% for 2026, 1.4% for 2027 and 1.5% for 2028. This is an upward revision for both 2026 and 2027, mainly reflecting the greater than expected resilience of the euro area economy.\n\nThe outlook remains highly uncertain, with risks to the upside for inflation and to the downside for economic growth. In relation to the energy shock, the updated scenarios put together by staff illustrate the broad range of outcomes for how growth and inflation would evolve under different assumptions about its intensity and duration, as well as its indirect and second-round effects.\n\nWith today’s decision, the Governing Council remains well positioned to navigate the uncertainty caused by the conflict. It will follow a data-dependent and meeting-by-meeting approach to determining the appropriate monetary policy stance. In particular, the Governing Council’s interest rate decisions will be based on its assessment of the inflation outlook and the risks surrounding it, in light of the incoming economic and financial data, as well as the dynamics of underlying inflation and the strength of monetary policy transmission. The Governing Council is not pre-committing to a particular rate path."
EU_ART = 'In its statement, the central bank noted that "the conflict in the Middle East continues to generate inflation pressures, and inflation is set to remain well above target for an extended period," while ensuring that "with today’s decision, the Governing Council remains well positioned to navigate the uncertainty caused by the conflict."'
EU_NUM = 'The ECB staff projections continue to estimate that headline inflation will average 3% this year. However, it has revised up the expectations for 2027 and 2028 to 2.5% and 2.1% respectively.'
add('quotecheck-ecb', 'quotecheck', ECB, {'article': EU_ART, 'sources': ECB_SRC},
    'الاقتباسان حرفيان من تقرير يورونيوز (Euronews، 10 سبتمبر 2026، كويرينو مياليا) https://www.euronews.com/2026/09/10/ecb-hikes-rates-to-25-as-energy-shock-pushes-eurozone-inflation-higher ، والمصدر أربع فقرات حرفية من بيان البنك المركزي الأوروبي.', True)
add('numdiff-ecb', 'numdiff', ECB, {'claim': EU_NUM, 'source': ECB_SRC},
    'الادعاء جملتان حرفيتان من تقرير يورونيوز نفسه، والمصدر فقرات البيان الرسمي الأربع.', True)
add('quotecheck-ecb-control', 'quotecheck', ECB, {'article': EU_ART + ' It also wrote "inflation will average 4% this year".', 'sources': ECB_SRC},
    'ضابط أضفناه نحن: الاقتباس الأخير مختلق من عندنا وليس في تقرير يورونيوز ولا في البيان. نريد أن نرى كيف تعامله الأداة، وليس اتهام أي جهة بخطأ.', False)

# Runs on binary files cannot be re-run from text here: the builder ran them on the real NASA files
# (exact outputs recorded in data/real-example-nasa-image.json) and we re-ran EXIF/imghash in the browser build.
NASA = json.loads((ROOT / 'data' / 'real-example-nasa-image.json').read_text(encoding='utf-8'))
NASA_SRC = {'title': 'Great Observatories’ Unique Views of the Milky Way (PIA12348), NASA/JPL Photojournal', 'by': 'NASA/JPL', 'date': '2009-11-10', 'url': NASA['sources'][0]['url']}
for t, rid, desc, note in [
    (NASA['trials'][0], 'exif-nasa', {'file': 'PIA12348~orig.jpg (الملف الأصلي من ناسا، 9725x4862، sha256 a0a1cad8...0064)'},
     'لا وقت التقاط أصلي ولا كاميرا ولا GPS: وسم واحد هو DateTimeDigitized. هذا شائع في الصور المعالجة والمنشورة ولا يدل على شيء آخر.'),
    (NASA['trials'][1], 'imghash-nasa', {'files': ['pia_web.jpg: نسخة ناسا المصغّرة من الصورة نفسها (1536x767)', 'pia_small_ourcopy.jpg: نسخة صغّرناها نحن إلى الثُّمن وأعدنا ضغطها (تعديل منا وليس من ناسا)']},
     'وقعت الصورتان في مجموعة واحدة بمسافة 0: الصورة نفسها بحجمين. التشابه الإدراكي لا يثبت من أين جاءت الصورة. رفضت الأداة الأصل بحجم 47 ميغابكسل لتجاوزه سقف 25 مليونًا فلم يُحسب له تجزئة.')]:
    runs.append({'id': rid, 'tool': 'exif' if rid == 'exif-nasa' else 'imghash', 'source': NASA_SRC, 'input': desc, 'output': t['output'], 'input_note': note, 'input_is_real_text': True, 'file_input': True})
d = tempfile.mkdtemp(); p = os.path.join(d, 'werfalli-excerpt.txt'); open(p, 'w', encoding='utf-8').write(W_DOCS)
os.chdir(d)
ev = run('evidence', path=p, note='Bellingcat Werfalli, مقتطفات حرفية')
for k in ('at', 'prev', 'entry_hash'): ev.pop(k, None)
runs.append({'id': 'evidence-werfalli', 'tool': 'evidence', 'source': WERF, 'input': {'file': 'werfalli-excerpt.txt', 'file_text': W_DOCS, 'note': 'Bellingcat Werfalli, مقتطفات حرفية'},
             'output': ev, 'input_note': 'الملف يحوي المقتطفات الحرفية الثلاثة مفصولة بسطر ---. البصمة قابلة لإعادة الحساب على النص نفسه.', 'input_is_real_text': True})
(ROOT / 'data' / 'tool-runs.json').write_text(json.dumps({'captured': datetime.date.today().isoformat(), 'runs': runs}, ensure_ascii=False, indent=1), encoding='utf-8')
print(len(runs), 'runs')
