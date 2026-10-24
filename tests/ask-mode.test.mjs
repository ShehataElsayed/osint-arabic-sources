import test from 'node:test'; import assert from 'node:assert/strict';
import { askAssistant } from '../worker/rag-worker.js';

const ENV = { GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm' };
const OK_URL = 'https://www.who.int/ar/news/item/01-01-2026-report';
const DEAD_URL = 'https://dead.example.com/gone-page';
const PAGE = `<html><head><title>تقرير المنظمة العالمية للأرصاد</title><meta property="og:site_name" content="WMO"></head><body>
<p>ارتفعت درجات حرارة البحر في المنطقة خلال العقد الأخير بشكل قياسي حسب التقرير السنوي للمنظمة</p>
<p>تؤثر موجات الحر البحرية على الثروة السمكية والنظم البيئية البحرية في العالم</p>
<p>هذه جملة ثالثة طويلة بما يكفي لتصبح مرشحة للاقتباس الحرفي في الفحص الآلي للمصادر</p>
</body></html>`;
const DRAFT = JSON.stringify({
  answer: 'خلاصة مباشرة عن موجات الحر البحرية [S1]. ادعاء بلا سند عن خليج السويس [S2]. تفصيل ثالث مدعوم [S1].',
  claims: ['ارتفعت درجات حرارة البحر في المنطقة خلال العقد الأخير', 'تؤثر موجات الحر البحرية على الثروة السمكية', 'انخفض الصيد في خليج السويس بنسبة محددة'],
  numbers: [], time_sensitive: false,
  sources: [{ name: 'تقرير المنظمة العالمية للأرصاد', url: OK_URL }, { name: 'صفحة ميتة', url: DEAD_URL }],
});
const REWRITE = JSON.stringify({ answer: 'خلاصة منقحة: ارتفعت درجات حرارة البحر في المنطقة خلال العقد الأخير بشكل قياسي حسب التقرير السنوي. لم نعثر على سند موثق لادعاء انخفاض الصيد في خليج السويس فحُذف من الإجابة.' });

// Scripted fetch: dispatches Gemini calls by prompt content and serves page fixtures.
function scripted(pages = {}, { draftStatus = 200, draft = DRAFT, rewrite = REWRITE, gdelt = null, embed = null } = {}) {
  return async (url, o = {}) => {
    const u = String(url);
    if (u.includes('batchEmbedContents')) {
      if (!embed) return { ok: false, status: 429, json: async () => ({}) };
      const vecs = embed(JSON.parse(o.body).requests.map(r => r.content.parts[0].text));
      return { ok: true, status: 200, json: async () => ({ embeddings: vecs.map(v => ({ values: v })) }) };
    }
    if (u.includes('openrouter.ai')) {
      const prompt = JSON.parse(o.body).messages[0].content;
      const wrap = text => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: text } }] }) });
      if (prompt.includes('أجب عن السؤال التالي')) return wrap(draft);
      if (prompt.includes('أعد كتابة الإجابة')) return wrap(rewrite);
      if (prompt.includes('اختر رقم الجملة')) return wrap('{"index":1}');
      if (prompt.includes('أنت مدقق ناقد')) return wrap('{"contradiction":0.1}');
      if (prompt.includes('زوايا صحفية')) return wrap('{"issues":["فجوة"],"angles":["زاوية"],"picks":[{"id":0,"why":"سبب","how":"كيف"}]}');
      if (prompt.includes('اختر حتى 4 أدوات')) return wrap('{"picks":[{"id":0,"why":"سبب","how":"كيف"}]}');
      return wrap('{}');
    }
    if (u.includes('generativelanguage.googleapis.com')) {
      const prompt = JSON.parse(o.body).contents[0].parts[0].text;
      const wrap = text => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) });
      if (prompt.includes('أجب عن السؤال التالي')) { if (draftStatus === 429) return { ok: false, status: 429 }; return wrap(draft); }
      if (prompt.includes('أعد كتابة الإجابة')) return wrap(rewrite);
      if (prompt.includes('اختر رقم الجملة')) return wrap('{"index":1}');
      if (prompt.includes('أنت مدقق ناقد')) return wrap('{"contradiction":0.1}');
      if (prompt.includes('زوايا صحفية')) return wrap('{"issues":["فجوة في البيانات الإقليمية المحدثة"],"angles":["زاوية: أثر موجات الحر على صيادي الساحل"],"picks":[{"id":0,"why":"تناسب البحث عن بيانات","how":"افتح الأداة وابحث بالكلمات المفتاحية"}]}');
      if (prompt.includes('اختر حتى 4 أدوات')) return wrap('{"picks":[{"id":0,"why":"تناسب البحث عن بيانات","how":"افتح الأداة وابحث بالكلمات المفتاحية"}]}');
      return wrap('{}');
    }
    if (u.includes('rdap.org')) return { ok: false, status: 404, json: async () => ({}) };
    if (u.includes('api.gdeltproject.org')) return gdelt ? gdelt(u) : { ok: false, status: 429, json: async () => ({}) };
    if (u.includes('wikipedia.org/w/api.php')) return { ok: false, status: 429, json: async () => ({}) };
    for (const [prefix, handler] of Object.entries(pages)) if (u.startsWith(prefix)) return typeof handler === 'function' ? handler(u) : handler;
    throw new Error('unexpected fetch: ' + u);
  };
}
const page = (body, title = 'صفحة') => ({ ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => `<html><head><title>${title}</title></head><body>${body}</body></html>` });
const notFound = { ok: false, status: 404, headers: { get: () => 'text/html' }, text: async () => 'not found' };
const CANDS = [{ id: 0, name: 'بيانات المناخ', description: 'قواعد بيانات مناخية مفتوحة للصحفيين' }];

test('ask: off without key, busy on 429 draft', async () => {
  assert.deepEqual(await askAssistant('سؤال', CANDS, {}, scripted()), { error: 'off' });
  assert.deepEqual(await askAssistant('سؤال طويل كافٍ', CANDS, ENV, scripted({}, { draftStatus: 429 })), { error: 'busy' });
});

test('ask: full pipeline qualifies unsupported claims, strips dead citation markers, caps band', async () => {
  const f = scripted({
    [OK_URL]: page(`<p>ارتفعت درجات حرارة البحر في المنطقة خلال العقد الأخير بشكل قياسي حسب التقرير السنوي للمنظمة</p><p>تؤثر موجات الحر البحرية على الثروة السمكية والنظم البيئية البحرية في العالم</p><p>هذه جملة ثالثة طويلة بما يكفي لتصبح مرشحة للاقتباس الحرفي في الفحص الآلي للمصادر</p>`, 'تقرير المنظمة'),
    'https://dead.example.com/gone': notFound,
    'https://dead.example.com/sitemap.xml': { ok: true, status: 200, headers: { get: () => 'application/xml' }, text: async () => '<?xml version="1.0"?><urlset></urlset>' },
    'https://dead.example.com/robots.txt': { ok: false, status: 404, headers: { get: () => 'text/plain' }, text: async () => '' },
  });
  const r = await askAssistant('ما أثر موجات الحر البحرية؟', CANDS, ENV, f);
  assert.equal(r.generated, true);
  assert.equal(r.answer_qualified, true, 'rewrite path ran for the unsupported claim');
  assert.equal(r.decision, 'answer');
  assert.ok(r.answer.includes('منقحة'));
  assert.ok(r.answer.includes('[S1]'), 'marker re-derived to the source whose passage supports the sentence');
  assert.ok(!r.answer.includes('[S2]'), 'no marker for the dead or unsupported source');
  assert.ok(r.warnings.some(w => w.includes('حُذفت')));
  const dead = r.sources.find(s => !s.exists);
  assert.equal(dead.claimed, DEAD_URL); assert.equal(dead.url, '');
  const opened = r.sources.filter(s => s.exists);
  assert.equal(opened.length, 1);
  assert.equal(opened[0].rel, 'very_high'); // official domain classification (provenance only)
  assert.ok(opened[0].identity && opened[0].page, 'provenance signals returned');
  assert.ok(opened[0].quote.length > 10, 'verbatim quote landed');
  // claims: two supported with evidence+ref, one unsupported
  assert.equal(r.claims.length, 3);
  const sup = r.claims.filter(c => c.supported);
  assert.ok(sup.length >= 1 && sup.every(c => c.evidence && c.source_ref >= 1), 'supported claims carry their passage and source');
  assert.ok(r.claims.some(c => !c.supported), 'Gulf of Suez claim has no textual support');
  // confidence: caps apply — unsupported material claim keeps band out of high
  assert.ok(r.confidence.score <= 69, 'score capped below high band');
  assert.notEqual(r.confidence.band, 'high');
  const critIds = r.confidence.criteria.map(c => c.id);
  for (const id of ['sources_opened', 'claim_support', 'independence', 'provenance', 'self_critic']) assert.ok(critIds.includes(id), id);
  assert.ok(r.confidence.criteria.find(c => c.id === 'claim_support').label.includes('لفظي'));
  assert.ok(!critIds.includes('factcheck_db'));
  assert.deepEqual(r.issues, ['فجوة في البيانات الإقليمية المحدثة']);
  assert.equal(r.tools.length, 1);
  assert.ok(r.warnings.some(w => w.includes('لا احتمال صحة')) && r.warnings.some(w => w.includes('لا يعني إثبات الاستدلال')));
});

test('ask: credible but irrelevant page yields no support and low confidence', async () => {
  const draft = JSON.stringify({
    answer: 'إجابة مفصلة عن حرارة البحر وتأثيرها على البيئة البحرية والصيد في المنطقة خلال السنوات الأخيرة [S1].', claims: ['ارتفعت درجات حرارة البحر في المنطقة خلال العقد الأخير'], numbers: [], time_sensitive: false,
    sources: [{ name: 'صفحة رسمية غير ذات صلة', url: 'https://www.who.int/ar/about/careers' }],
  });
  const f = scripted({
    'https://www.who.int/ar/about/careers': page('<p>الوظائف الشاغرة في المنظمة وكيفية التقدم للعمل في المكاتب الإقليمية</p><p>تعلن المنظمة عن برامج التدريب للعاملين الصحيين في مختلف الدول الأعضاء</p>', 'وظائف المنظمة'),
  }, { draft });
  const r = await askAssistant('ما أثر موجات الحر البحرية؟', CANDS, ENV, f);
  assert.equal(r.sources[0].exists, true); // page opened fine
  assert.equal(r.sources[0].verified, false, 'irrelevant page is not treated as support');
  assert.equal(r.claims[0].supported, false, 'lexical check rejects irrelevant credible page');
  assert.ok(r.confidence.score <= 39, 'all claims unsupported → low band');
  assert.equal(r.confidence.band, 'low');
  assert.equal(r.decision, 'insufficient', 'fail closed: no supported claim → no model text shown');
  assert.equal(r.answer, '', 'model answer withheld');
  assert.ok(r.warnings.some(w => w.includes('غير كافية')));
});

test('ask: fabricated domain is dropped, not counted', async () => {
  const draft = JSON.stringify({
    answer: 'إجابة بمصدر مختلق [S1].', claims: [], numbers: [], time_sensitive: false,
    sources: [{ name: 'موقع مختلق', url: 'https://fabricated-news-xyz.example/a' }],
  });
  const f = scripted({}, { draft });
  const r = await askAssistant('سؤال عام كافٍ للفحص', CANDS, ENV, f);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0].exists, false);
  assert.equal(r.sources[0].claimed, 'https://fabricated-news-xyz.example/a');
  assert.ok(r.warnings.some(w => w.includes('خيوط النموذج')));
  assert.ok(!r.answer.includes('[S1]'), 'fabricated citation marker stripped');
});

test('ask: numbers claimed but absent near best passage fail verification', async () => {
  const draft = JSON.stringify({
    answer: 'نص عن البرنامج [S1].', claims: ['أعلنت الجهة عن برنامج تجريبي في مارس'], numbers: ['2026', '500000'], time_sensitive: false,
    sources: [{ name: 'بيان الجهة', url: 'https://cabinet.gov.eg/statements/1' }],
  });
  const f = scripted({
    'https://cabinet.gov.eg/statements/1': page('<p>أعلنت الجهة عن برنامج تجريبي في مارس ضمن خطة العمل السنوية للوزارة</p><p>يشمل البرنامج مرحلة أولى محدودة النطاق في عدد من المحافظات المختارة</p>', 'بيان الجهة'),
  }, { draft });
  const r = await askAssistant('ما تفاصيل البرنامج؟', CANDS, ENV, f);
  assert.equal(r.sources[0].exists, true);
  assert.equal(r.sources[0].numbers_ok, false, 'claimed numbers not present near the passage');
  assert.equal(r.sources[0].verified, false);
});

test('ask: negated page sentence is not support for a positive claim', async () => {
  const draft = JSON.stringify({
    answer: 'أعلنت الجهة الإطلاق العام [S1].', claims: ['أعلنت الجهة الإطلاق العام للخدمة'], numbers: [], time_sensitive: false,
    sources: [{ name: 'بيان النفي', url: 'https://sis.gov.eg/denial/9' }],
  });
  const f = scripted({
    'https://sis.gov.eg/denial/9': page('<p>نفت الجهة ما تردد عن الإطلاق العام للخدمة وأكدت أن التجربة ما زالت محدودة النطاق</p><p>قال المتحدث إن التوسع يحتاج تقييم المرحلة الأولى قبل أي قرار جديد بشأنها</p>', 'بيان النفي'),
  }, { draft });
  const r = await askAssistant('هل أُطلقت الخدمة رسميًا؟', CANDS, ENV, f);
  assert.equal(r.sources[0].negation_conflict, true, 'negation conflict detected');
  assert.equal(r.claims[0].supported, false, 'negated passage is not support for the positive claim');
  assert.ok(r.confidence.score <= 39);
});

test('ask: rewrite fallback keeps original answer when model rewrite is unusable', async () => {
  const f = scripted({
    [OK_URL]: page('<p>ارتفعت درجات حرارة البحر في المنطقة خلال العقد الأخير بشكل قياسي حسب التقرير السنوي للمنظمة</p><p>تؤثر موجات الحر البحرية على الثروة السمكية والنظم البيئية البحرية في العالم</p>', 'تقرير'),
  }, { rewrite: JSON.stringify({ answer: 'قصيرة' }) }); // too short → rejected
  const r = await askAssistant('ما أثر موجات الحر البحرية؟', CANDS, ENV, f);
  assert.equal(r.decision, 'extractive', 'fail closed: unusable rewrite degrades to supported extracts');
  assert.ok(r.answer.includes('يقول المصدر'), 'extractive output is passage-grounded');
  assert.ok(r.answer.includes('[S1]'), 'extractive markers point at the supporting source');
  assert.ok(!r.answer.includes('خليج السويس'), 'unsupported assertion never shown');
  assert.ok(r.warnings.some(w => w.includes('مقتطفات')));
});

test('ask: citation markers are reconciled to the passage that actually supports each sentence', async () => {
  const FISH_URL = 'https://www.aljazeera.net/news/2026/1/1/fish';
  const draft = JSON.stringify({
    answer: 'ارتفعت درجات حرارة البحر في المنطقة خلال العقد الأخير بشكل قياسي [S1]. تؤثر موجات الحر البحرية على الثروة السمكية والنظم البيئية البحرية في العالم [S1].',
    claims: ['ارتفعت درجات حرارة البحر في المنطقة خلال العقد الأخير', 'تؤثر موجات الحر البحرية على الثروة السمكية'],
    numbers: [], time_sensitive: false,
    sources: [{ name: 'تقرير المنظمة', url: OK_URL }, { name: 'تغطية إخبارية', url: FISH_URL }],
  });
  const f = scripted({
    [OK_URL]: page('<p>ارتفعت درجات حرارة البحر في المنطقة خلال العقد الأخير بشكل قياسي حسب التقرير السنوي للمنظمة</p><p>هذه جملة ثانية طويلة بما يكفي لتصبح مرشحة للاقتباس الحرفي في الفحص الآلي للمصادر</p>', 'تقرير المنظمة'),
    [FISH_URL]: page('<p>تؤثر موجات الحر البحرية على الثروة السمكية والنظم البيئية البحرية في العالم بشكل مباشر</p><p>هذه جملة ثانية طويلة بما يكفي لتصبح مرشحة للاقتباس الحرفي في الفحص الآلي للمصادر</p>', 'تغطية'),
  }, { draft });
  const r = await askAssistant('ما أثر موجات الحر البحرية؟', CANDS, ENV, f);
  assert.equal(r.decision, 'answer');
  const iFish = r.answer.indexOf('السمكية'), iHeat = r.answer.indexOf('العقد الأخير');
  const iM1 = r.answer.indexOf('[S1]'), iM2 = r.answer.indexOf('[S2]');
  assert.ok(iM2 > iFish && (iM1 === -1 || iM1 < iFish), `fish sentence re-cited to source 2, got: ${r.answer}`);
  assert.ok(iM1 > iHeat && iM1 < iFish, 'heat sentence keeps source 1');
  assert.equal(r.claims[1].source_ref, 2, 'claim support row agrees with the reconciled marker');
});

test('ask: rewrite that injects a new unsupported claim degrades to extractive', async () => {
  const injectRewrite = JSON.stringify({ answer: 'خلاصة منقحة: ارتفعت درجات حرارة البحر في المنطقة خلال العقد الأخير بشكل قياسي حسب التقرير السنوي. وأضيف ادعاء جديد تماما عن أزمة غذاء عالمية وشيكة بلا أي سند.' });
  const f = async (url, o = {}) => {
    const u = String(url);
    if (u.includes('generativelanguage.googleapis.com')) {
      const prompt = JSON.parse(o.body).contents[0].parts[0].text;
      const wrap = t => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: t }] } }] }) });
      if (prompt.includes('أجب عن السؤال التالي')) return wrap(DRAFT);
      if (prompt.includes('أعد كتابة الإجابة')) return wrap(injectRewrite);
      if (prompt.includes('استخرج من النص التالي')) return wrap(JSON.stringify({ claims: ['أزمة غذاء عالمية وشيكة'] }));
      if (prompt.includes('اختر رقم الجملة')) return wrap('{"index":1}');
      if (prompt.includes('أنت مدقق ناقد')) return wrap('{"contradiction":0.1}');
      if (prompt.includes('زوايا صحفية')) return wrap('{"issues":[],"angles":[]}');
      if (prompt.includes('اختر حتى 4 أدوات')) return wrap('{"picks":[]}');
      return wrap('{}');
    }
    if (u.includes('rdap.org')) return { ok: false, status: 404, json: async () => ({}) };
    if (u.startsWith(OK_URL)) return page('<p>ارتفعت درجات حرارة البحر في المنطقة خلال العقد الأخير بشكل قياسي حسب التقرير السنوي للمنظمة</p><p>تؤثر موجات الحر البحرية على الثروة السمكية والنظم البيئية البحرية في العالم</p><p>هذه جملة ثالثة طويلة بما يكفي لتصبح مرشحة للاقتباس الحرفي في الفحص الآلي للمصادر</p>', 'تقرير');
    if (u.startsWith('https://dead.example.com/gone')) return notFound;
    if (u.startsWith('https://dead.example.com/sitemap.xml')) return { ok: true, status: 200, headers: { get: () => 'application/xml' }, text: async () => '<?xml version="1.0"?><urlset></urlset>' };
    if (u.startsWith('https://dead.example.com/robots.txt')) return { ok: false, status: 404, headers: { get: () => 'text/plain' }, text: async () => '' };
    throw new Error('unexpected fetch: ' + u);
  };
  const r = await askAssistant('ما أثر موجات الحر البحرية؟', CANDS, ENV, f);
  assert.equal(r.decision, 'extractive', 'injected unsupported claim rejects the rewrite');
  assert.ok(!r.answer.includes('أزمة غذاء'), 'injected claim never shown');
  assert.ok(r.warnings.some(w => w.includes('أدخلت الصياغة')));
});

const PAGE_C2 = `<html><head><title>تغطية إخبارية إضافية</title></head><body>
<p>تؤثر موجات الحر البحرية على الصيادين في الساحل وسبل عيشهم اليومية بشكل مباشر</p>
<p>جملة أخرى طويلة محايدة عن موضوع مختلف تماما لا صلة لها بالمناخ أو البحار</p>
</body></html>`;
const DRAFT_G = JSON.stringify({
  answer: 'خلاصة [S1]. تفصيل عن الصيادين [S2].',
  claims: ['ارتفعت درجات حرارة البحر في المنطقة خلال العقد الأخير', 'تؤثر موجات الحر البحرية على الصيادين في الساحل'],
  numbers: [], time_sensitive: false,
  sources: [{ name: 'تقرير المنظمة العالمية للأرصاد', url: OK_URL }],
});
const pageC2 = { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => PAGE_C2 };
const pageNeutral = { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => '<html><head><title>محايد</title></head><body><p>نص محايد طويل بما يكفي ليكون مرشحا للاقتباس دون صلة حقيقية بالسؤال المطروح</p></body></html>' };

test('ask: free discovery widens sources, dedups by domain, feeds claim evidence', async () => {
  const gdelt = () => ({ ok: true, status: 200, json: async () => ({ articles: [
    { url: 'https://extra-news.net/a1', title: 'تغطية إضافية' },
    { url: 'https://extra-news.net/a2', title: 'نسخة مكررة من نفس النطاق' },
    { url: 'https://other-site.org/x', title: 'مصدر محايد آخر' },
  ] }) });
  const f = scripted({ [OK_URL]: { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => PAGE }, 'https://extra-news.net/a1': pageC2, 'https://other-site.org/x': pageNeutral }, { draft: DRAFT_G, gdelt });
  const r = await askAssistant('كيف تؤثر موجات الحر البحرية على الصيادين؟', CANDS, ENV, f);
  assert.equal(r.generated, true);
  const urls = r.sources.map(x => x.url).filter(Boolean);
  assert.ok(urls.includes('https://extra-news.net/a1'), 'discovered article opened');
  assert.ok(urls.includes('https://other-site.org/x'), 'second discovered domain opened');
  assert.ok(!urls.some(u => u.includes('/a2')), 'same-domain duplicate dropped');
  const disc = r.sources.find(x => x.url === 'https://extra-news.net/a1');
  assert.equal(disc.discovered, true, 'marked as discovered');
  const c2 = r.claims.find(c => c.text.includes('الصيادين'));
  assert.ok(c2 && c2.supported, 'claim supported by a DISCOVERED page, not only model-named ones');
  assert.equal(c2.source_ref, r.sources.indexOf(disc) + 1, 'claim points at the discovered source');
  assert.ok(r.confidence.criteria.find(c => c.id === 'independence').detail.includes('3'), 'three independent domains counted');
});

test('ask: discovery capped at ten opened pages total', async () => {
  const arts = Array.from({ length: 15 }, (_, i) => ({ url: `https://d${i + 1}.org/art`, title: `مصدر ${i + 1}` }));
  const gdelt = () => ({ ok: true, status: 200, json: async () => ({ articles: arts }) });
  const f = scripted({ [OK_URL]: { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => PAGE }, 'https://d': pageNeutral }, { draft: DRAFT_G, gdelt });
  const r = await askAssistant('موجات الحر البحرية وتأثيرها', CANDS, ENV, f);
  assert.ok(r.sources.length <= 10, `opened pages capped, got ${r.sources.length}`);
});

test('ask: discovery failure degrades silently (429 from GDELT)', async () => {
  const f = scripted({ [OK_URL]: { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => PAGE } }, { draft: DRAFT_G });
  const r = await askAssistant('موجات الحر البحرية وتأثيرها', CANDS, ENV, f);
  assert.equal(r.generated, true);
  assert.equal(r.sources.filter(x => x.exists).length, 1, 'named source only when discovery unavailable');
  assert.ok(r.warnings.some(w => w.includes('عينة مفتوحة محدودة')), 'limits disclosed');
});

test('ask: shallow homepage escalates to deeper sitemap page that supports the claim', async () => {
  const draft = JSON.stringify({
    answer: 'خلاصة عن حرارة البحر [S1].',
    claims: ['ارتفعت درجات حرارة البحر في المنطقة خلال العقد الأخير'],
    numbers: [], time_sensitive: false,
    sources: [{ name: 'البوابة الرسمية للأرصاد', url: 'https://shallow.gov/' }],
  });
  const home = { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => '<html><head><title>البوابة</title></head><body><p>الرئيسية اتصل بنا عن الجهة روابط سريعة</p></body></html>' };
  const smap = { ok: true, status: 200, headers: { get: () => 'application/xml' }, text: async () => '<?xml version="1.0"?><urlset><url><loc>https://shallow.gov/deep-report</loc></url></urlset>' };
  const deep = { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => PAGE };
  const f = scripted({ 'https://shallow.gov/sitemap.xml': smap, 'https://shallow.gov/robots.txt': notFound, 'https://shallow.gov/deep-report': deep, 'https://shallow.gov/': home }, { draft });
  const r = await askAssistant('ما أثر موجات الحر البحرية؟', CANDS, ENV, f);
  assert.equal(r.generated, true);
  const src = r.sources[0];
  assert.equal(src.url, 'https://shallow.gov/deep-report', 'adopted the deeper page');
  assert.equal(src.escalated, true);
  assert.equal(src.original, 'https://shallow.gov/', 'original homepage kept on record');
  assert.ok(r.claims[0].supported, 'claim supported after escalation');
});

// Semantic retrieval + grounded guards: embeddings pick the candidate passage; numbers/negation guards decide.
const embByTopic = texts => texts.map(t => {
  const v = [0.01, 0.01, 0.01, 0.01, 0.01, 0.01];
  if (/مرجان|coral/i.test(t)) v[0] = 1;
  if (/حر|heat|محيط|ocean/i.test(t)) v[1] = 1;
  if (/العمق/.test(t)) v[2] = 1;
  if (/الأحمر|الأسود/.test(t)) v[3] = 1;
  if (/50/.test(t)) v[4] = 0.6;
  if (/سمك|fish|صياد/i.test(t)) v[5] = 0.4;
  return v;
});
const PAGE_EN = `<html><head><title>Ocean heat report</title></head><body>
<p>Coral bleaching driven by ocean heat waves reduces fish breeding grounds across the region</p>
<p>The report notes fisheries moved north as waters warmed over the last decade</p>
</body></html>`;
const PAGE_ADV = `<html><head><title>تقرير متخصص</title></head><body>
<p>ارتفعت حرارة المحيط بنسبة 50 في المئة خلال العقد الأخير حسب القياسات</p>
<p>لم ترتفع درجات حرارة طبقات العمق في المنطقة خلال فترة الدراسة</p>
<p>سجلت سنة 2023 أعلى متوسط حرارة للمحيطات في السجلات الحديثة</p>
<p>ارتفعت حرارة البحر الأسود بمعدل غير مسبوق خلال العقد الأخير</p>
</body></html>`;
const DRAFT_ADV = JSON.stringify({
  answer: 'خلاصة [S1].',
  claims: [
    'تبييض الشعاب المرجانية بسبب موجات الحر يقلل موائل تكاثر الأسماك',
    'ارتفعت حرارة المحيط بنسبة 30 في المئة خلال العقد الأخير',
    'ارتفعت درجات حرارة طبقات العمق في المنطقة',
    'سجلت سنة 2024 أعلى متوسط حرارة للمحيطات',
    'ارتفعت حرارة البحر الأحمر بمعدل غير مسبوق خلال العقد الأخير',
  ],
  numbers: [], time_sensitive: false,
  sources: [{ name: 'Ocean heat report', url: 'https://ocean.example.org/report' }, { name: 'تقرير متخصص', url: 'https://adv.example.net/report' }],
});
const embPages = { 'https://ocean.example.org/report': { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => PAGE_EN }, 'https://adv.example.net/report': { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => PAGE_ADV } };

test('ask semantic: cross-language valid support passes', async () => {
  const f = scripted(embPages, { draft: DRAFT_ADV, embed: embByTopic });
  const r = await askAssistant('موجات الحر والشعاب', CANDS, ENV, f);
  const cross = r.claims[0];
  assert.ok(cross.supported, 'Arabic claim supported by English passage via semantic retrieval');
  assert.ok(cross.evidence.includes('Coral bleaching'), 'evidence is the actual English passage');
  assert.ok(cross.source_ref >= 1);
});

test('ask semantic guards: conflicting numbers rejected', async () => {
  const f = scripted(embPages, { draft: DRAFT_ADV, embed: embByTopic });
  const r = await askAssistant('موجات الحر والشعاب', CANDS, ENV, f);
  assert.equal(r.claims[1].supported, false, '30% claim rejected: passage says 50%');
});

test('ask semantic guards: negation mismatch rejected', async () => {
  const f = scripted(embPages, { draft: DRAFT_ADV, embed: embByTopic });
  const r = await askAssistant('موجات الحر والشعاب', CANDS, ENV, f);
  assert.equal(r.claims[2].supported, false, 'passage negates the depth-warming claim');
});

test('ask semantic guards: conflicting year rejected', async () => {
  const f = scripted(embPages, { draft: DRAFT_ADV, embed: embByTopic });
  const r = await askAssistant('موجات الحر والشعاب', CANDS, ENV, f);
  assert.equal(r.claims[3].supported, false, '2024 claim rejected: passage says 2023');
});

test('ask semantic guard: entity substitution blocked, limit still disclosed for cross-language', async () => {
  const f = scripted(embPages, { draft: DRAFT_ADV, embed: embByTopic });
  const r = await askAssistant('موجات الحر والشعاب', CANDS, ENV, f);
  // البحر الأحمر vs البحر الأسود: same-script distinctive-token guard blocks the entity swap that pure
  // vector cosine cannot separate. Cross-language pairs still rely on semantic signal + digits/negation,
  // and that residual limit stays disclosed on the page.
  assert.equal(r.claims[4].supported, false, 'entity substitution blocked by distinctive-token guard');
  assert.ok(r.warnings.some(w => w.includes('استبدال الكيانات')), 'residual cross-language limit disclosed');
  assert.ok(r.confidence.score <= 69, 'mixed support keeps score capped');
});

test('ask semantic guard: compound claim with one negated half is rejected atomically', async () => {
  const draft = JSON.stringify({
    answer: 'خلاصة.',
    claims: ['ارتفعت حرارة المحيط بنسبة 50 في المئة وانخفضت درجات حرارة طبقات العمق'],
    numbers: [], time_sensitive: false,
    sources: [{ name: 'تقرير متخصص', url: 'https://adv.example.net/report' }],
  });
  const f = scripted(embPages, { draft, embed: embByTopic });
  const r = await askAssistant('حرارة المحيط', CANDS, ENV, f);
  // First half matches a real passage; second half exists only in NEGATED form. The whole claim is
  // rejected — support is evaluated atomically, not per convenient fragment.
  assert.equal(r.claims[0].supported, false, 'compound claim rejected: العمق half negated in the passage');
  assert.equal(r.decision, 'insufficient', 'zero supported claims stays fail-closed');
});

test('ask: provider-neutral — same pipeline over OpenRouter env', async () => {
  const ENV_OR = { OPENROUTER_API_KEY: 'ork', OPENROUTER_MODEL: 'some-model:free' };
  const f = scripted({ [OK_URL]: { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => PAGE }, [DEAD_URL]: notFound });
  const r = await askAssistant('كيف تؤثر موجات الحر البحرية؟', CANDS, ENV_OR, f);
  assert.equal(r.generated, true);
  assert.equal(r.decision, 'answer');
  assert.ok(r.answer.includes('منقحة'), 'qualification rewrite ran over OpenRouter');
  assert.equal(r.tools.length, 1, 'guide-tool recommendation works over OpenRouter');
  const off = await askAssistant('سؤال', CANDS, {}, scripted());
  assert.deepEqual(off, { error: 'off' });
});

test('ask: cross-language bridge supports Arabic claims from an English source, disclosed', async () => {
  const EN_URL = 'https://www.unctad.org/publication/red-sea-crisis';
  const EN_PAGE = `<html><head><title>UNCTAD Red Sea report</title></head><body>
<p>Suez Canal transits fell by more than 50 percent in the first quarter of 2024 compared with the same period a year earlier</p>
<p>Container ship arrivals at the port of Eilat dropped sharply during the same period of the crisis</p>
</body></html>`;
  const draft = JSON.stringify({
    answer: 'انخفضت حركة العبور في قناة السويس بأكثر من 50% في الربع الأول 2024 [S1]. ادعاء بلا سند عن ميناء جدة [S1].',
    claims: ['انخفضت حركة العبور في قناة السويس بأكثر من 50% في الربع الأول 2024', 'تضاعفت حركة ميناء جدة ثلاث مرات في 2024'],
    numbers: ['50', '2024'], time_sensitive: false,
    sources: [{ name: 'UNCTAD Red Sea report', url: EN_URL }],
  });
  const f = async (url, o = {}) => {
    const u = String(url);
    if (u.includes('generativelanguage.googleapis.com')) {
      const prompt = JSON.parse(o.body).contents[0].parts[0].text;
      const wrap = t => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: t }] } }] }) });
      if (prompt.includes('أجب عن السؤال التالي')) return wrap(draft);
      if (prompt.includes('ترجم الجمل العربية التالية')) {
        const n = (prompt.match(/^\d+\./gm) || []).length;
        const dict = [
          'How did the Red Sea attacks affect shipping', 'Suez Canal transits fell by more than 50 percent in the first quarter of 2024',
          'Jeddah port traffic tripled in 2024',
          'Suez Canal transits fell by more than 50 percent in the first quarter of 2024', 'An unsupported claim about Jeddah port',
        ];
        const en = Array.from({ length: n }, (_, i) => dict[i] || `translation ${i + 1} of an Arabic sentence about shipping`);
        return wrap(JSON.stringify({ en }));
      }
      if (prompt.includes('أعد كتابة الإجابة')) return wrap(JSON.stringify({ answer: 'انخفضت حركة العبور في قناة السويس بأكثر من 50% في الربع الأول 2024 حسب التقرير. لم نعثر على سند موثق لادعاء ميناء جدة فحُذف.' }));
      if (prompt.includes('استخرج من النص التالي')) return wrap(JSON.stringify({ claims: ['انخفضت حركة العبور في قناة السويس بأكثر من 50% في الربع الأول 2024'] }));
      if (prompt.includes('اختر رقم الجملة')) return wrap('{"index":1}');
      if (prompt.includes('أنت مدقق ناقد')) return wrap('{"contradiction":0.1}');
      if (prompt.includes('زوايا صحفية')) return wrap('{"issues":["فجوة"],"angles":["زاوية"]}');
      if (prompt.includes('اختر حتى 4 أدوات')) return wrap('{"picks":[]}');
      return wrap('{}');
    }
    if (u.includes('rdap.org')) return { ok: false, status: 404, json: async () => ({}) };
    if (u.includes('api.gdeltproject.org') || u.includes('wikipedia.org')) return { ok: false, status: 429, json: async () => ({}) };
    if (u.startsWith(EN_URL)) return { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => EN_PAGE };
    throw new Error('unexpected fetch: ' + u);
  };
  const r = await askAssistant('كيف أثرت هجمات البحر الأحمر على الملاحة؟', CANDS, ENV, f);
  const c1 = r.claims.find(c => c.text.includes('قناة السويس'));
  const c2 = r.claims.find(c => c.text.includes('جدة'));
  assert.ok(c1 && c1.supported, 'Arabic claim supported via translation from the English source');
  assert.equal(c1.cross_lang, true, 'flagged as translation-assisted');
  assert.ok(c1.evidence.includes('50 percent'), 'evidence is the original English passage');
  assert.ok(c2 && !c2.supported, 'unsupported claim still rejected (translation does not invent support)');
  assert.ok(r.warnings.some(w => w.includes('ترجمة آلية')), 'translation assistance disclosed');
  assert.notEqual(r.decision, 'insufficient', 'pipeline no longer starves on language mismatch');
});

test('ask: draft without a claims field falls back to extracting claims from the answer', async () => {
  const noClaimsDraft = JSON.stringify({
    answer: 'ارتفعت درجات حرارة البحر في المنطقة خلال العقد الأخير بشكل قياسي حسب التقرير السنوي [S1].',
    numbers: [], time_sensitive: false,
    sources: [{ name: 'تقرير المنظمة العالمية للأرصاد', url: OK_URL }],
  });
  const f = scripted({ [OK_URL]: { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => PAGE } }, { draft: noClaimsDraft });
  const inner = f;
  const f2 = async (url, o = {}) => {
    const u = String(url);
    if (u.includes('generativelanguage.googleapis.com')) {
      const prompt = JSON.parse(o.body).contents[0].parts[0].text;
      if (prompt.includes('استخرج من النص التالي')) {
        const wrap = t => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: t }] } }] }) });
        return wrap(JSON.stringify({ claims: ['ارتفعت درجات حرارة البحر في المنطقة خلال العقد الأخير'] }));
      }
    }
    return inner(url, o);
  };
  const r = await askAssistant('ما أثر موجات الحر البحرية؟', CANDS, ENV, f2);
  assert.ok(r.claims.length >= 1, 'claims recovered from the answer text');
  assert.ok(r.claims[0].supported, 'recovered claim still checked against sources');
});
