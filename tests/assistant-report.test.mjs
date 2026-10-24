import test from 'node:test'; import assert from 'node:assert/strict';
import { buildRagReport, buildVerifyReport } from '../site/assistant-report.js';

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
