import test from 'node:test';
import assert from 'node:assert/strict';
import { directionOf, groundedOk, markDuplicates, filterToolPicks, buildToolDf } from '../worker/rag-worker.js';

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
