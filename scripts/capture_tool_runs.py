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
d = tempfile.mkdtemp(); p = os.path.join(d, 'werfalli-excerpt.txt'); open(p, 'w', encoding='utf-8').write(W_DOCS)
os.chdir(d)
ev = run('evidence', path=p, note='Bellingcat Werfalli, مقتطفات حرفية')
for k in ('at', 'prev', 'entry_hash'): ev.pop(k, None)
runs.append({'id': 'evidence-werfalli', 'tool': 'evidence', 'source': WERF, 'input': {'file': 'werfalli-excerpt.txt', 'file_text': W_DOCS, 'note': 'Bellingcat Werfalli, مقتطفات حرفية'},
             'output': ev, 'input_note': 'الملف يحوي المقتطفات الحرفية الثلاثة مفصولة بسطر ---. البصمة قابلة لإعادة الحساب على النص نفسه.', 'input_is_real_text': True})
(ROOT / 'data' / 'tool-runs.json').write_text(json.dumps({'captured': datetime.date.today().isoformat(), 'runs': runs}, ensure_ascii=False, indent=1), encoding='utf-8')
print(len(runs), 'runs')
