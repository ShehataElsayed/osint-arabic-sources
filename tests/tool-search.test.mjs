import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, search, stem, normalize } from '../site/tool-search.js';
const items = [
  { name: 'Vessel Finder', description: 'تتبع السفن ومساراتها عبر AIS. قارن المسار بمصدر ثان قبل النشر.', url: 'https://example.org/a' },
  { name: 'Flightradar24.com', description: 'تتبع حركة الطائرات والرحلات الجوية مباشرة. البيانات قد تتأخر.', url: 'https://example.org/b' },
  { name: 'Who.is', description: 'استعلام WHOIS عن تسجيل النطاقات وتواريخها. السجل قد يكون محجوبًا.', url: 'https://example.org/c' },
  { name: 'TGStat', description: 'إحصاءات وبحث عن قنوات Telegram العامة.', url: 'https://example.org/d' }
];
const idx = buildIndex(items);
test('stemmer removes common Arabic affixes but keeps short words', () => {
  assert.equal(stem(normalize('والسفن')), 'سفن');
  assert.equal(stem(normalize('الطائرات')), 'طاير');
  assert.equal(stem('ال'), 'ال');
});
test('vocabulary bridge: Arabic task word reaches a tool with a Latin name', () => {
  const r = search(idx, 'كيف أتتبع سفينة', { minScore: 1 });
  assert.equal(r.confident, true);
  assert.equal(r.candidates[0].t.name, 'Vessel Finder');
});
test('plural/prefixed forms still match', () => {
  assert.equal(search(idx, 'متابعة الطائرات').candidates[0].t.name, 'Flightradar24.com');
});
test('abstains on out-of-scope requests instead of guessing', () => {
  assert.equal(search(idx, 'وصفة كبسة بالدجاج', { minScore: 1 }).confident, false);
  assert.equal(search(idx, 'سعر الذهب اليوم', { minScore: 1 }).confident, false);
});
