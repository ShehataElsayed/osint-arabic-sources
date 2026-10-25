import test from 'node:test';
import assert from 'node:assert/strict';
import { sentSpans, passageWindows, supportOf, groundedOk, checkSource } from '../worker/rag-worker.js';

test('sentSpans offsets are exact: text.slice(start, end) equals the span text', () => {
  const text = '  الجملة الأولى من النص هنا كاملة.  الجملة الثانية تليها مباشرة!\nجملة ثالثة في سطر جديد تماما؟';
  for (const sp of sentSpans(text)) assert.equal(text.slice(sp.start, sp.end), sp.text);
});

test('split fact across two adjacent sentences becomes one citable window', () => {
  // Figure in sentence A, unit in short sentence B (B alone would be filtered out as a passage).
  const text = 'تقرير ملاحي مهم. بلغت نسبة الانخفاض في حركة السفن العابرة للقناة 60\nبالمئة مقارنة بالعام الماضي. ثم تابع التقرير تفاصيل أخرى كثيرة لا علاقة لها بالنسبة.';
  const spans = sentSpans(text), wins = passageWindows(text, spans);
  const joined = wins.find(w => w.text.includes('60') && w.text.includes('بالمئة'));
  assert.ok(joined, 'window joins the figure sentence with its unit half');
  assert.equal(joined.text, text.slice(joined.start, joined.end).replace(/\s+/g, ' ').trim());
  // The claim carrying number+unit verifies against the joined window.
  const claim = 'بلغت نسبة الانخفاض في حركة السفن 60 بالمئة';
  const sup = supportOf(claim, wins.map(w => w.text), ['60']);
  assert.equal(sup.numbers_ok, true, 'numbers check sees the split figure');
  const best = sup.cands[0];
  assert.ok(groundedOk(claim, best, 0.6, false), 'claim verifies against joined window');
});

test('regression: same split fact fails numbers check on single-sentence granularity', () => {
  const sents = ['بلغت نسبة الانخفاض في حركة السفن العابرة للقناة ستين', 'بالمئة مقارنة بالعام الماضي', 'جملة أخرى طويلة جدا عن موضوع مختلف تماما هنا'];
  const sup = supportOf('بلغت نسبة الانخفاض في حركة السفن 60 بالمئة', sents, ['60']);
  assert.notEqual(sup.numbers_ok, true, 'single sentences lose the figure-unit link');
});

test('contradictory nearby sentences: joined window cannot falsely support a direction claim', () => {
  const text = 'ارتفعت الصادرات بنسبة 5 بالمئة هذا العام بحسب التقرير. لكن الواردات انخفضت بنسبة 3 بالمئة في الفترة نفسها.';
  const wins = passageWindows(text, sentSpans(text)).map(w => w.text);
  const joined = wins.find(w => w.includes('الصادرات') && w.includes('الواردات'));
  assert.ok(joined, 'window exists');
  // A claim flipping the direction against one side must fail closed on the mixed window.
  assert.equal(groundedOk('انخفضت الصادرات بنسبة 3 بالمئة', joined, 0.7, false), false, 'opposite direction blocked');
  assert.equal(groundedOk('ارتفعت الواردات بنسبة 5 بالمئة', joined, 0.7, false), false, 'misattributed direction blocked');
  // Negated contrast: parity guard blocks even when the net meaning would support.
  const text2 = 'لم تنخفض أعداد السفن العابرة هذا العام إطلاقا. بل ارتفعت الأعداد بنسبة 12 بالمئة سنويا.';
  const joined2 = passageWindows(text2, sentSpans(text2)).map(w => w.text).find(w => w.includes('ارتفعت'));
  assert.equal(groundedOk('ارتفعت أعداد السفن بنسبة 12 بالمئة', joined2, 0.7, false), false, 'negation parity over window fails closed');
});

test('no cross-section joining: heading between sentences blocks the window extension', () => {
  const text = 'انتهت الفقرة الأولى من التقرير السنوي هنا اليوم.\nعنوان القسم الثاني من التقرير\nتبدأ الفقرة الثانية من التقرير في هذا الموضع تماما.';
  const wins = passageWindows(text, sentSpans(text));
  const first = wins.find(w => w.text.startsWith('انتهت'));
  assert.ok(first, 'first sentence kept');
  assert.ok(!first.text.includes('عنوان') && !first.text.includes('تبدأ'), 'no heading or next-section text joined');
});

test('checkSource end-to-end: split fact in a fetched page yields a joined candidate with span offsets', async () => {
  const html = '<html><body><article>بلغت نسبة الانخفاض في حركة السفن العابرة للقناة 60\nبالمئة مقارنة بالعام الماضي وفق البيانات الرسمية.</article></body></html>';
  const f = async () => ({ ok: true, headers: { get: () => 'text/html' }, text: async () => html });
  const out = await checkSource({ name: 'مصدر تجريبي', url: 'https://example.com/report' }, 'نسبة الانخفاض في حركة السفن 60 بالمئة', ['60'], f, {});
  assert.equal(out.exists, true);
  const i = out.cands.findIndex(c => c.includes('60') && c.includes('بالمئة'));
  assert.ok(i >= 0, 'joined window present in candidates');
  assert.ok(out.cand_spans[i] && Number.isInteger(out.cand_spans[i].start) && out.cand_spans[i].end > out.cand_spans[i].start, 'exact span offsets attached');
  assert.equal(out.numbers_ok, true);
});
