import test from 'node:test'; import assert from 'node:assert/strict';
import { buildRagReport, buildVerifyReport, buildAskReport, cleanQuote, decodeEntities } from '../site/assistant-report.js';

test('rag report carries question, answer, warnings and evidence with offsets', () => {
  const md = buildRagReport({
    question: 'ما الذي أُعلن؟', when: '2026-10-25T00:00:00Z',
    result: { type: 'general', decision: 'answer', text: 'بدأ برنامج تجريبي [E1].', generated: true, citation_refs_valid: true,
      warnings: ['تواريخ نشر بعض المصادر غير معروفة'],
      evidence: [{ ref: 'E1', title: 'بيان', publisher: 'جهة', url: 'https://example.org/a', published_at: '2026-09-10', score: 1.5, start: 0, end: 30, excerpt: 'بدأ برنامج تجريبي محدود.' }] },
  });
  assert.ok(md.includes('ما الذي أُعلن؟')); assert.ok(md.includes('بدأ برنامج تجريبي [E1].'));
  assert.ok(md.includes('[E1] بيان')); assert.ok(md.includes('0–30'));
  assert.ok(md.includes('تواريخ نشر بعض المصادر غير معروفة'));
  assert.ok(md.includes('ليس دليل نشر'));
});

test('rag report abstain path', () => {
  const md = buildRagReport({ question: 'س', result: { decision: 'abstain', text: '', evidence: [] } });
  assert.ok(md.includes('امتناع')); assert.ok(md.includes('لا أدلة.'));
});

test('verify report lists criteria, sources and keeps model answer flagged', () => {
  const md = buildVerifyReport({
    question: 'ادعاء', model: { answer: 'جملة', verdict: 'supported', decision: 'answer',
      criteria: [{ status: 'pass', label: 'اتساق العينات', detail: '3' }],
      sources: [{ name: 'مصدر', url: 'https://a.b/c', exists: true, rel: 'high', verified: true, quote: 'اقتباس' }] },
    confidence: 'عالية',
  });
  assert.ok(md.includes('ليست دليلًا')); assert.ok(md.includes('[نجح] اتساق العينات'));
  assert.ok(md.includes('اجتاز الفحص')); assert.ok(md.includes('درجة الثقة الإرشادية: عالية'));
});

test('cleanQuote drops code-like fragments, keeps real prose quotes', () => {
  assert.equal(cleanQuote('length)throw new Error("Field name must be in the format'), '');
  assert.equal(cleanQuote('window.querySelectorAll("a").length)'), '');
  assert.equal(cleanQuote('صرح المتحدث الرسمي بأنه سيتم بدء العمل بالتوقيت الشتوي.'), 'صرح المتحدث الرسمي بأنه سيتم بدء العمل بالتوقيت الشتوي.');
  assert.equal(cleanQuote('The timing change takes effect at midnight.'), 'The timing change takes effect at midnight.');
  assert.equal(cleanQuote(''), '');
  assert.equal(cleanQuote(null), '');
});

test('decodeEntities decodes numeric and named entities, leaves plain text untouched', () => {
  assert.equal(decodeEntities('&#x631;&#x626;&#x627;&#x633;&#x629;'), 'رئاسة');
  assert.equal(decodeEntities('a &quot;b&quot; &amp; c'), 'a "b" & c');
  assert.equal(decodeEntities('عنوان عادي'), 'عنوان عادي');
  assert.equal(decodeEntities('&#169;'), '©');
});

test('ask report omits code-like quotes and decodes entity-encoded titles', () => {
  const md = buildAskReport({
    question: 'سؤال', when: '2026-10-30T00:00:00Z',
    result: { decision: 'answer', answer: 'إجابة.',
      claims: [{ text: 'ادعاء', supported: true, evidence: 'throw new Error("x")', source_ref: 1 }],
      sources: [
        { title: '&#x631;&#x626;&#x627;&#x633;&#x629; &#x645;&#x62C;&#x644;&#x633; &#x627;&#x644;&#x648;&#x632;&#x631;&#x627;&#x621;', url: 'https://cabinet.gov.eg/x', exists: true, rel: 'very_high', quote: 'length)throw new Error("Field name must be in the format' },
        { title: 'مصدر سليم', url: 'https://example.org/y', exists: true, rel: 'high', quote: 'اقتباس صحيح من المصدر.' },
      ] },
  });
  assert.ok(md.includes('### [1] رئاسة مجلس الوزراء'));
  assert.ok(!md.includes('throw new Error'));
  assert.ok(!md.includes('Field name must be in the format'));
  assert.ok(md.includes('> اقتباس صحيح من المصدر.'));
});
