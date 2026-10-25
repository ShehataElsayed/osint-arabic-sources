import test from 'node:test';
import assert from 'node:assert/strict';
import { directionOf, groundedOk, markDuplicates, filterToolPicks, buildToolDf, ragTokens } from '../worker/rag-worker.js';

test('directionOf detects rise/fall cues in Arabic and English', () => {
  assert.equal(directionOf('ارتفعت أسعار الشحن بنسبة كبيرة'), 'up');
  assert.equal(directionOf('انخفض عدد السفن العابرة'), 'down');
  assert.equal(directionOf('shipping costs increased sharply'), 'up');
  assert.equal(directionOf('transit numbers dropped'), 'down');
  assert.equal(directionOf('بقيت الأسعار مستقرة دون تغيير'), '');
  assert.equal(directionOf('ارتفعت التكاليف بعد انخفاض سابق'), 'mixed');
});

test('groundedOk blocks direction conflict and missing direction cue (fail closed)', () => {
  const score = 0.6;
  // matching direction passes (numbers present, no negation)
  assert.equal(groundedOk('ارتفعت أسعار الشحن 60 بالمئة', 'ارتفعت أسعار الشحن بنسبة 60 بالمئة هذا العام', score, false), true);
  // opposite direction blocked
  assert.equal(groundedOk('ارتفعت أسعار الشحن 60 بالمئة', 'انخفضت أسعار الشحن بنسبة 60 بالمئة هذا العام', score, false), false);
  // claim asserts direction, passage gives no cue -> unsupported
  assert.equal(groundedOk('ارتفعت أسعار الشحن 60 بالمئة', 'بلغت أسعار الشحن 60 بالمئة هذا العام', score, false), false);
  // no direction in claim -> no constraint
  assert.equal(groundedOk('بلغت أسعار الشحن 60 بالمئة', 'بلغت أسعار الشحن 60 بالمئة هذا العام', score, false), true);
});

test('markDuplicates flags exact-text copies, keeps representatives', () => {
  const list = [{ text_sha256: 'aaa' }, { text_sha256: 'bbb' }, { text_sha256: 'aaa' }, { text_sha256: '' }];
  markDuplicates(list);
  assert.equal(list[0].duplicate_of || 0, 0);
  assert.equal(list[1].duplicate_of || 0, 0);
  assert.equal(list[2].duplicate_of, 1);
  assert.equal(list[3].duplicate_of || 0, 0);
});

test('filterToolPicks: generic single-token overlap abstains, task fit passes', () => {
  const q = 'ما تأثير الهجمات على السفن في البحر الأحمر على حركة الملاحة العالمية وقناة السويس منذ 2023؟';
  const cands = [
    { id: 1, name: 'Tinfoleak Web', description: 'واجهة لتحليل النشاط العام على X وتفاصيل حساباته، بما فيها إشارات قد تفيد في فحص الموقع. لا تحوّل الاستدلال الجغرافي إلى حقيقة عن حركة شخص دون تأكيد مستقل.' },
    { id: 2, name: 'MarineTraffic', description: 'تتبع مباشر لمواقع السفن وحركة الملاحة العالمية عبر الأقمار' },
    { id: 3, name: 'FlightRadar', description: 'تتبع رحلات الطيران الجوي حول العالم' },
  ];
  const picks = [1, 2, 3].map(id => ({ id, why: 'سبب', how: 'خطوات' }));
  const out = filterToolPicks(picks, cands, q);
  const ids = out.map(x => x.id);
  assert.ok(!ids.includes(1), 'single generic token حركة must not promote Tinfoleak');
  assert.ok(ids.includes(2), 'ship tracker shares سفن + حركة/ملاحة: task fit');
  assert.ok(!ids.includes(3), 'no shared tokens: abstain');
});

test('filterToolPicks: single-token pass needs df-rare or long token', () => {
  const catalog = [
    { name: 'أ', description: 'حسابات تواصل اجتماعي' },
    ...Array.from({ length: 40 }, (_, i) => ({ name: 't' + i, description: 'حسابات بيانات عامة ' + i })),
    { name: 'ب', description: 'منصة تخص تيك توك حسابات' },
  ];
  const df = buildToolDf(catalog);
  assert.ok(df.get('حساب') > 34, 'common token حساب has high df');
  // common single token blocked
  const blocked = filterToolPicks([{ id: 1, why: 'w', how: 'h' }], [{ id: 1, name: 'X', description: 'أداة حسابات عامة' }], 'كيف أتحقق من حساب شخص؟', df);
  assert.equal(blocked.length, 0, 'common single token with high df abstains');
  // rare single token passes (تيك appears once in the whole catalog)
  const ok = filterToolPicks([{ id: 2, why: 'w', how: 'h' }], [{ id: 2, name: 'Y', description: 'أداة تيك فقط' }], 'كيف أتحقق من تيك توك؟', df);
  assert.equal(ok.length, 1, 'rare single token passes via df');
});

test('buildToolDf counts tools per stemmed token', () => {
  const df = buildToolDf([{ name: 'x', description: 'سفن ملاحة' }, { name: 'y', description: 'سفن' }]);
  assert.equal(df.get('سفن'), 2);
  assert.equal(df.get('ملاح'), 1);
});

test('xl path: moderate floor + 2/3 coverage separates grounded positives from negatives', async () => {
  const { groundedWhy } = await import('../worker/rag-worker.js');
  const cos = (a, b) => { const va = new Map(), vb = new Map(); ragTokens(a).forEach(x => va.set(x, (va.get(x) || 0) + 1)); ragTokens(b).forEach(x => vb.set(x, (vb.get(x) || 0) + 1)); let d = 0, na = 0, nb = 0; for (const [x, c] of va) { na += c * c; if (vb.has(x)) d += c * vb.get(x); } for (const c of vb.values()) nb += c * c; return na && nb ? d / Math.sqrt(na * nb) : 0; };
  const pos = [
    ['Egypt population reached 106.5 million in July 2024', "Egypt's population reached 106.5 million in July 2024, according to the statistics agency CAPMAS, which tracks births and deaths through its population clock."],
    ['Sea shipping prices increased by 60 percent since 2023', 'Container shipping costs increased by 60 percent since 2023 as vessels rerouted around the Cape of Good Hope, industry data showed.'],
    ['The Suez Canal Authority announced that it is closely following developments', 'The Suez Canal Authority announced it is closely monitoring developments in the Red Sea to assess their impact on navigation.'],
  ];
  for (const [c, p] of pos) assert.equal(groundedWhy(c, p, cos(c, p), false, true), '', 'true support passes: ' + c.slice(0, 30));
  const neg = [
    ['Egypt population reached 106.5 million in July 2024', "Egypt's population density reached 106.5 people per square kilometer in 2024, with most residents concentrated along the Nile valley."],
    ['Sea shipping prices increased by 60 percent since 2023', 'Shipping prices decreased by 60 percent since 2023 as demand collapsed on major routes, industry data showed.'],
    ['Egypt population reached 106.5 million in July 2024', "Egypt's population reached 105.6 million in July 2024, according to the statistics agency."],
    ['The Suez Canal Authority announced that it is closely following developments', 'The Panama Canal Authority announced new transit fees for 2024 as vessel traffic recovered through the waterway.'],
  ];
  for (const [c, p] of neg) assert.notEqual(groundedWhy(c, p, cos(c, p), false, true), '', 'negative blocked: ' + c.slice(0, 30));
  // vector-semantic path keeps its calibrated 0.78 floor
  assert.equal(groundedWhy(pos[0][0], pos[0][1], 0.6, true, false), 'score_floor');
});

test('scale guard blocks magnitude swaps, passes consistent units (both languages)', async () => {
  const { groundedWhy } = await import('../worker/rag-worker.js');
  assert.equal(groundedWhy('The reservoir holds 5 billion cubic meters of water', 'The reservoir holds 5 million cubic meters of water after filling', 0.7, false, true), 'units');
  assert.equal(groundedWhy('The program supported 50 thousand farmers in 2024', 'The program supported 50 million farmers in 2024 across governorates', 0.65, false, true), 'units');
  assert.equal(groundedWhy('بلغت الصادرات 5 مليار دولار في 2024', 'بلغت الصادرات 5 مليون دولار في 2024 حسب بيان الوزارة', 0.6, false, true), 'units');
  assert.equal(groundedWhy('Trade volume reached 5 billion dollars in 2024', 'Trade volume reached 5 billion dollars in 2024, up from 4.2 billion the year before', 0.7, false, true), '');
});

test('causal guard blocks unsupported causation, passes stated causation, spares non-causal claims', async () => {
  const { groundedWhy } = await import('../worker/rag-worker.js');
  assert.equal(groundedWhy('The currency float caused inflation to rise to 38 percent', 'Inflation rose to 38 percent while the currency float remained under review', 0.5, false, true), 'causal');
  assert.equal(groundedWhy('The dam collapse caused the displacement of 30000 people in 2023', 'The dam collapse caused the displacement of 30000 people in 2023, the United Nations said', 0.8, false, true), '');
  // non-causal Arabic wording (منتج/ناتج/أسهم) must not trigger the guard
  const why = groundedWhy('بلغ الناتج المحلي نموا قدره 2.4 في المئة في 2024', 'نما الناتج المحلي بنسبة 2.4 في المئة في 2024 حسب بيانات رسمية', 0.6, false, true);
  assert.notEqual(why, 'causal');
});

test('direction lexicon recognizes expansion as a rise cue', async () => {
  const { directionOf } = await import('../worker/rag-worker.js');
  assert.equal(directionOf('The economy expanded by 2.4 percent'), 'up');
});
