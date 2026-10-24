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
const REWRITE = JSON.stringify({ answer: 'خلاصة منقحة عن موجات الحر البحرية [S1] مع إطار صريح لما لم يُوثق [S2] وتم حذف الرقم المختلق.' });

// Scripted fetch: dispatches Gemini calls by prompt content and serves page fixtures.
function scripted(pages = {}, { draftStatus = 200, draft = DRAFT, rewrite = REWRITE } = {}) {
  return async (url, o = {}) => {
    const u = String(url);
    if (u.includes('generativelanguage.googleapis.com')) {
      const prompt = JSON.parse(o.body).contents[0].parts[0].text;
      const wrap = text => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) });
      if (prompt.includes('أجب عن السؤال التالي')) { if (draftStatus === 429) return { ok: false, status: 429 }; return wrap(draft); }
      if (prompt.includes('أعد كتابة الإجابة')) return wrap(rewrite);
      if (prompt.includes('اختر رقم الجملة')) return wrap('{"index":1}');
      if (prompt.includes('أنت مدقق ناقد')) return wrap('{"contradiction":0.1}');
      if (prompt.includes('زوايا صحفية')) return wrap('{"issues":["فجوة في البيانات الإقليمية المحدثة"],"angles":["زاوية: أثر موجات الحر على صيادي الساحل"]}');
      if (prompt.includes('اختر حتى 4 أدوات')) return wrap('{"picks":[{"id":0,"why":"تناسب البحث عن بيانات","how":"افتح الأداة وابحث بالكلمات المفتاحية"}]}');
      return wrap('{}');
    }
    if (u.includes('rdap.org')) return { ok: false, status: 404, json: async () => ({}) };
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
  assert.ok(r.answer.includes('منقحة'));
  assert.ok(r.answer.includes('[S1]'), 'marker for opened source kept');
  assert.ok(!r.answer.includes('[S2]'), 'marker for dead source stripped');
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
  assert.ok(r.warnings.some(w => w.includes('ليس احتمالًا')) && r.warnings.some(w => w.includes('لا يعني إثبات الاستدلال')));
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
  assert.equal(r.answer_qualified, true, 'qualification pass ran');
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
  assert.ok(r.warnings.some(w => w.includes('معرفة النموذج فقط')));
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
  assert.equal(r.answer_qualified, false);
  assert.ok(r.answer.includes('خليج السويس'), 'original answer kept as fallback');
  assert.ok(r.warnings.some(w => w.includes('لم تُنقَّ')), 'unqualified unsupported claims stay flagged');
});
