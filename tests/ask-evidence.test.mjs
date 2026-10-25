import test from 'node:test'; import assert from 'node:assert/strict';
import { askEvidenceFirst, filterToolPicks } from '../worker/rag-worker.js';

const ENV = { GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm', EXA_API_KEY: 'x', DEBUG_LEDGER: true };
const U1 = 'https://www.who.int/ar/news/item/heat-report';
const U2 = 'https://www.fao.org/ar/stories/heat-fisheries';
const P1 = 'تؤثر موجات الحر البحرية على الثروة السمكية والنظم البيئية البحرية في العالم بشكل مباشر وموثق';
const P2 = 'تؤدي موجات الحر البحرية إلى نفوق أعداد كبيرة من الثروة السمكية في المناطق المتأثرة حسب التقرير';
const Q = 'ما أثر موجات الحر البحرية على الثروة السمكية؟';
const CANDS = [{ id: 0, name: 'بيانات المناخ البحري', description: 'قواعد بيانات مفتوحة عن حرارة البحر وموجات الحر البحرية للصحفيين' }];

function scripted({ synthesis, pages = {} } = {}) {
  return async (url, o = {}) => {
    const u = String(url);
    if (u.includes('generativelanguage.googleapis.com')) {
      const prompt = JSON.parse(o.body).contents[0].parts[0].text;
      const wrap = text => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) });
      if (prompt.includes('مخطط بحث')) return wrap('{"queries":["موجات الحر البحرية والثروة السمكية"],"time_sensitive":false}');
      if (prompt.includes('ترجم الجمل')) return wrap('{}'); // no translation -> lexical-only path
      if (prompt.includes('أنت محرر صحفي دقيق')) return wrap(synthesis);
      if (prompt.includes('اقترح إشكاليات')) return wrap('{"issues":["فجوة في البيانات المحدثة"],"angles":["زاوية: أثر الحر على صيادي الساحل"],"picks":[{"id":0,"why":"يناسب بيانات الحر البحرية","how":"افتح الأداة وابحث بالكلمات"}]}');
      return wrap('{}');
    }
    if (u.includes('api.exa.ai/search')) return { ok: true, status: 200, json: async () => ({ results: [{ url: U1, title: 'تقرير المنظمة' }, { url: U2, title: 'قصة المنظمة الغذائية' }] }) };
    if (u.includes('api.exa.ai')) return { ok: false, status: 500, json: async () => ({}) };
    if (u.includes('rdap.org')) return { ok: false, status: 404, json: async () => ({}) };
    if (u.includes('wikipedia.org') || u.includes('gdeltproject.org')) return { ok: false, status: 429, json: async () => ({}) };
    for (const [prefix, body] of Object.entries(pages)) if (u.startsWith(prefix)) return { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => `<html><head><title>صفحة</title></head><body>${body}</body></html>` };
    throw new Error('unexpected fetch: ' + u);
  };
}
const PAGES = { [U1]: `<p>${P1}</p><p>جملة أخرى طويلة عن موضوع مختلف تماما لا صلة لها بالسؤال المطروح هنا</p>`, [U2]: `<p>${P2}</p><p>جملة ثالثة طويلة بما يكفي لتصبح مرشحة للاقتباس الحرفي في الفحص الآلي للمصادر</p>` };

test('answer: verified cited sentences shown with [S#], fabricated citation dropped, unknowns listed', async () => {
  const syn = JSON.stringify({
    answer: `خلاصة: ${P1} [P1].\nتفصيل: ${P2} [P2].\nادعاء مفبرك: انخفض الصيد في خليج السويس بنسبة 60 بالمئة خلال عام واحد [P1].`,
    unknowns: ['لا تغطيه المصادر المفتوحة: الأثر على أسعار الأسماك'],
  });
  const env = { ...ENV, _ledger: [] };
  const r = await askEvidenceFirst(Q, CANDS, env, scripted({ synthesis: syn, pages: PAGES }));
  assert.equal(r.decision, 'answer');
  assert.ok(r.answer.includes('موجات الحر البحرية'), 'verified sentence shown');
  assert.ok(r.answer.includes('[S1]') || r.answer.includes('[S2]'), 'source markers renumbered');
  assert.ok(!r.answer.includes('خليج السويس'), 'fabricated citation dropped (digits guard)');
  assert.equal(r.dropped_count, 1);
  assert.ok(r.answer.includes('ما لم تغطّه المصادر المفتوحة'), 'unknowns section appended');
  assert.deepEqual(r.unknowns, ['لا تغطيه المصادر المفتوحة: الأثر على أسعار الأسماك']);
  assert.equal(r.tools.length, 1, 'relevant tool picked');
  assert.ok(r.issues.length && r.angles.length);
  const stages = r.calls.map(c => c.stage);
  assert.deepEqual(stages, ['planner', 'translate', 'synthesize', 'extras']); // all-Arabic passages: no cross-language translate call
  assert.ok(r.calls.every(c => c.status === 'ok' || c.status === 'parse'));
  assert.ok(r.confidence.criteria.some(c => c.id === 'citation_support'));
  assert.ok(r.warnings.some(w => w.includes('توليف مقيد')), 'constrained-synthesis disclosure');
});

test('extractive: too few verified sentences degrades to quoted extract, never to fabricated prose', async () => {
  const syn = JSON.stringify({
    answer: `وحيدة موثقة: ${P1} [P1].\nمفبركة: انخفض الصيد في خليج السويس بنسبة 60 بالمئة [P2].`,
    unknowns: [],
  });
  const r = await askEvidenceFirst(Q, CANDS, { ...ENV, _ledger: [] }, scripted({ synthesis: syn, pages: PAGES }));
  assert.equal(r.decision, 'extractive');
  assert.ok(r.answer.includes('يقول المصدر:'), 'extractive shows verbatim quotes');
  assert.ok(!r.answer.includes('خليج السويس'));
  assert.ok(r.confidence.score <= 69, 'score capped');
});

test('insufficient: all citations fabricated -> nothing of the draft shown', async () => {
  const syn = JSON.stringify({
    answer: 'مفبركة أولى: انخفض الصيد في خليج السويس بنسبة 60 بالمئة [P1].\nمفبركة ثانية: ارتفع عدد السفن الغارقة إلى 45 سفينة [P2].',
    unknowns: [],
  });
  const r = await askEvidenceFirst(Q, CANDS, { ...ENV, _ledger: [] }, scripted({ synthesis: syn, pages: PAGES }));
  assert.equal(r.decision, 'insufficient');
  assert.equal(r.answer, '');
  assert.ok(r.confidence.score <= 39);
});

test('budget cap: model calls stop at MODEL_CALL_BUDGET and degrade gracefully', async () => {
  const env = { ...ENV, _ledger: [], MODEL_CALL_BUDGET: 2 };
  const syn = JSON.stringify({ answer: `${P1} [P1].`, unknowns: [] });
  const r = await askEvidenceFirst(Q, CANDS, env, scripted({ synthesis: syn, pages: PAGES }));
  const skips = r.calls.filter(c => c.status === 'budget_skip');
  assert.ok(skips.length >= 1, 'later stages skipped');
  assert.ok(env._calls <= 2, 'never exceeded budget');
  assert.ok(['insufficient', 'extractive', 'answer'].includes(r.decision), 'still a valid result shape');
});

test('insufficient: no relevant passages in opened pages', async () => {
  const offTopic = { [U1]: '<p>وصفة طبخ تقليدية لسمك مشوي مع الأرز والبهارات تحتاج وقتا طويلا للتحضير</p>', [U2]: '<p>نتائج مباراة كرة قدم انتهت بفوز الفريق المضيف بثلاثة أهداف مقابل هدف واحد</p>' };
  const syn = JSON.stringify({ answer: 'شيء ما [P1].', unknowns: [] });
  const r = await askEvidenceFirst(Q, CANDS, { ...ENV, _ledger: [] }, scripted({ synthesis: syn, pages: offTopic }));
  assert.equal(r.decision, 'insufficient');
  assert.equal(r.answer, '');
  assert.ok(r.warnings.some(w => w.includes('لم تُسفر')), 'honest insufficient warning');
});

test('filterToolPicks: irrelevant tool abstains (Thats-Them class)', () => {
  const picks = [{ id: 0, why: 'w', how: 'h' }, { id: 1, why: 'w', how: 'h' }];
  const cands = [CANDS[0], { id: 1, name: 'البحث عن الأشخاص', description: 'أداة للعثور على أرقام هواتف الأشخاص وعناوينهم' }];
  const out = filterToolPicks(picks, cands, Q);
  assert.deepEqual(out.map(x => x.id), [0], 'people-search tool excluded for a marine question');
});

test('Exa budget: requests stop at EXA_CALL_BUDGET and are ledgered', async () => {
  const env = { ...ENV, _ledger: [], EXA_CALL_BUDGET: 1 };
  const syn = JSON.stringify({ answer: 'شيء ما [P1].', unknowns: [] });
  const r = await askEvidenceFirst(Q, CANDS, env, scripted({ synthesis: syn, pages: PAGES }));
  assert.ok(env._exaCalls <= 1, 'never exceeded Exa budget');
  assert.ok(r.calls.some(c => c.status === 'exa_budget_skip'), 'skip recorded in ledger');
});

test('indicator honesty: extractive without dropped sentences still caps mid-band; dated figures and no-passage sources are diagnosed', async () => {
  const P3 = 'تقرير رسمي عن الاقتصاد المصري وأسعار الصرف والتضخم ومعدلات البطالة في المحافظات خلال الربع الأخير من العام الحالي';
  const syn = JSON.stringify({ answer: `موثقة: ${P1} [P1].`, unknowns: ['معدل النمو السكاني السنوي'] });
  const f0 = scripted({ synthesis: syn, pages: { ...PAGES, 'https://www.capmas.gov.eg/x': `<p>${P3}</p>` } });
  const f = async (url, o = {}) => {
    const u = String(url);
    if (u.includes('api.exa.ai/search')) return { ok: true, status: 200, json: async () => ({ results: [{ url: U1, title: 'تقرير' }, { url: 'https://www.capmas.gov.eg/x', title: 'صفحة رسمية' }] }) };
    if (u.includes('generativelanguage.googleapis.com')) {
      const prompt = JSON.parse(o.body).contents[0].parts[0].text;
      if (prompt.includes('مخطط بحث')) return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"queries":["موجات الحر 2023"],"time_sensitive":true}' }] } }] }) };
    }
    return f0(url, o);
  };
  const r = await askEvidenceFirst(Q, CANDS, { ...ENV, _ledger: [] }, f);
  assert.equal(r.decision, 'extractive');
  assert.equal(r.dropped_count, 0);
  assert.ok(r.confidence.score <= 84, 'extractive caps score at 84');
  assert.notEqual(r.confidence.band, 'high', 'incomplete coverage never shows top band');
  assert.ok(r.warnings.some(w => w.includes('فتح النطاق الرسمي ليس سندًا')), 'no-passage page distinguished from supporting source');
});
