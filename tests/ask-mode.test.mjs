import test from 'node:test'; import assert from 'node:assert/strict';
import { askAssistant } from '../worker/rag-worker.js';

const ENV = { GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm' };
const OK_URL = 'https://www.who.int/ar/news/item/01-01-2026-report';
const DEAD_URL = 'https://dead.example.com/gone-page';
const DRAFT = JSON.stringify({
  answer: 'خلاصة مباشرة عن موجات الحر البحرية [S1]. تفصيل في فقرة ثانية مدعوم بالمصدر.',
  claims: ['ارتفعت درجات حرارة البحر في المنطقة خلال العقد الأخير', 'تؤثر موجات الحر البحرية على الثروة السمكية'],
  numbers: [], time_sensitive: false,
  sources: [{ name: 'تقرير المنظمة العالمية للأرصاد', url: OK_URL }, { name: 'صفحة ميتة', url: DEAD_URL }],
});
const PAGE = `<html><head><title>تقرير المنظمة العالمية للأرصاد</title><meta property="og:site_name" content="WMO"></head><body>
<p>ارتفعت درجات حرارة البحر في المنطقة خلال العقد الأخير بشكل قياسي حسب التقرير السنوي للمنظمة</p>
<p>تؤثر موجات الحر البحرية على الثروة السمكية والنظم البيئية البحرية في العالم</p>
<p>هذه جملة ثالثة طويلة بما يكفي لتصبح مرشحة للاقتباس الحرفي في الفحص الآلي للمصادر</p>
</body></html>`;

function scripted({ draftStatus = 200, deadPage = true } = {}) {
  const calls = [];
  return { calls, f: async (url, o = {}) => {
    calls.push(String(url));
    if (String(url).includes('generativelanguage.googleapis.com')) {
      const prompt = JSON.parse(o.body).contents[0].parts[0].text;
      const wrap = text => ({ ok: draftStatus === 200 || text !== DRAFT, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) });
      if (prompt.includes('أجب عن السؤال التالي')) { if (draftStatus === 429) return { ok: false, status: 429 }; return wrap(DRAFT); }
      if (prompt.includes('اختر رقم الجملة')) return wrap('{"index":1}');
      if (prompt.includes('أنت مدقق ناقد')) return wrap('{"contradiction":0.1}');
      if (prompt.includes('زوايا صحفية')) return wrap('{"issues":["فجوة في البيانات الإقليمية المحدثة"],"angles":["زاوية: أثر موجات الحر على صيادي الساحل"]}');
      if (prompt.includes('اختر حتى 4 أدوات')) return wrap('{"picks":[{"id":0,"why":"تناسب البحث عن بيانات","how":"افتح الأداة وابحث بالكلمات المفتاحية"}]}');
      return wrap('{}');
    }
    if (String(url).startsWith(OK_URL)) return { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => PAGE };
    if (String(url).startsWith('https://dead.example.com')) {
      if (String(url).includes('sitemap.xml')) return { ok: true, status: 200, headers: { get: () => 'application/xml' }, text: async () => '<?xml version="1.0"?><urlset></urlset>' };
      if (String(url).includes('robots.txt')) return { ok: false, status: 404, headers: { get: () => 'text/plain' }, text: async () => '' };
      return { ok: false, status: 404, headers: { get: () => 'text/html' }, text: async () => 'not found' };
    }
    if (String(url).includes('rdap.org')) return { ok: false, status: 404, json: async () => ({}) };
    throw new Error('unexpected fetch: ' + url);
  } };
}
const CANDS = [{ id: 0, name: 'بيانات المناخ', description: 'قواعد بيانات مناخية مفتوحة للصحفيين' }];

test('ask: off without key, busy on 429 draft', async () => {
  assert.deepEqual(await askAssistant('سؤال', CANDS, {}, scripted().f), { error: 'off' });
  assert.deepEqual(await askAssistant('سؤال طويل كافٍ', CANDS, ENV, scripted({ draftStatus: 429 }).f), { error: 'busy' });
});

test('ask: full pipeline composes answer, sources, criteria, issues, angles, tools', async () => {
  const { f } = scripted();
  const r = await askAssistant('ما أثر موجات الحر البحرية؟', CANDS, ENV, f);
  assert.equal(r.generated, true);
  assert.ok(r.answer.includes('موجات الحر البحرية'));
  const opened = r.sources.filter(s => s.exists);
  assert.equal(opened.length, 1);
  assert.equal(opened[0].url, OK_URL);
  assert.equal(opened[0].rel, 'very_high'); // who.int is official
  assert.equal(opened[0].quote.length > 10, true); // verbatim pick landed
  const dead = r.sources.find(s => !s.exists);
  assert.equal(dead.claimed, DEAD_URL); assert.equal(dead.url, '');
  const critIds = r.confidence.criteria.map(c => c.id);
  for (const id of ['sources_opened', 'claim_support', 'independence', 'source_quality', 'self_critic']) assert.ok(critIds.includes(id), id);
  assert.ok(!critIds.includes('factcheck_db')); // no key configured
  assert.ok(r.confidence.score >= 0 && r.confidence.score <= 100);
  assert.ok(['high', 'mid', 'low'].includes(r.confidence.band));
  assert.equal(r.claims.length, 2);
  assert.ok(r.claims.every(c => typeof c.supported === 'boolean'));
  assert.ok(r.claims.some(c => c.supported)); // page text overlaps both claims
  assert.deepEqual(r.issues, ['فجوة في البيانات الإقليمية المحدثة']);
  assert.deepEqual(r.angles, ['زاوية: أثر موجات الحر على صيادي الساحل']);
  assert.deepEqual(r.tools, [{ id: 0, why: 'تناسب البحث عن بيانات', how: 'افتح الأداة وابحث بالكلمات المفتاحية' }]);
  assert.ok(r.warnings.some(w => w.includes('ليس احتمالًا')));
});

test('ask: confidence drops when no source opens and model names none', async () => {
  const noSrc = JSON.stringify({ answer: 'إجابة بلا مصادر.', claims: ['ادعاء واحد'], numbers: [], time_sensitive: false, sources: [] });
  const f = async (url, o = {}) => {
    if (String(url).includes('generativelanguage.googleapis.com')) {
      const prompt = JSON.parse(o.body).contents[0].parts[0].text;
      const wrap = text => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) });
      if (prompt.includes('أجب عن السؤال التالي')) return wrap(noSrc);
      if (prompt.includes('أنت مدقق ناقد')) return wrap('{"contradiction":0.1}');
      if (prompt.includes('زوايا صحفية')) return wrap('{"issues":[],"angles":[]}');
      if (prompt.includes('اختر حتى 4 أدوات')) return wrap('{"picks":[]}');
      return wrap('{}');
    }
    if (String(url).includes('rdap.org')) return { ok: false, status: 404, json: async () => ({}) };
    throw new Error('unexpected fetch: ' + url);
  };
  const r = await askAssistant('سؤال عام كافٍ للفحص', CANDS, ENV, f);
  const critIds = r.confidence.criteria.map(c => c.id);
  const cs = r.confidence.criteria.find(c => c.id === 'claim_support');
  assert.ok(cs && cs.score === 0); // claim exists but no opened source can support it
  const opened = r.confidence.criteria.find(c => c.id === 'sources_opened');
  assert.equal(opened.score, 0); assert.equal(opened.detail, 'لم يذكر النموذج مصدرًا');
  assert.equal(r.sources.length, 0);
  assert.ok(r.warnings.some(w => w.includes('معرفة النموذج فقط')));
  assert.equal(r.confidence.band === 'high', false);
});
