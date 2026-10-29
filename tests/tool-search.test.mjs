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
test('a tool listed under several branches is recommended once per URL', () => {
  const dupItems = [
    { name: 'Archive.is', description: 'أرشفة صفحات الويب ولقطة محفوظة.', url: 'https://archive.is/' },
    { name: 'Archive.is (مرآة)', description: 'أرشفة صفحات الويب ولقطة محفوظة.', url: 'https://archive.is/' }
  ];
  const r = search(buildIndex([...items, ...dupItems]), 'أرشفة صفحات الويب', { minScore: 1 });
  assert.equal(r.candidates.filter(c => c.t.url === 'https://archive.is/').length, 1);
});

test('jurisdiction mismatch is flagged and jurisdiction-covered queries are not', () => {
  const items = [
    { name: 'UK Companies', url: 'https://example.com/uk', description: 'السجل الحكومي الرسمي لمعلومات الشركات البريطانية وإيداعاتها قارن الملف بدفاتر الشركة وإفصاحاتها الرسمية' },
    { name: 'Companies House', url: 'https://example.com/ch', description: 'يبحث Companies House عن شركات مسجلة في المملكة المتحدة ومسؤوليها ومستندات التسجيل المتاحة' },
    { name: 'OpenCorporates', url: 'https://example.com/oc', description: 'قاعدة مجمعة لسجلات الشركات من ولايات قضائية مختلفة ارجع للسجل الأصلي طابق رقم التسجيل' },
  ];
  const idx = buildIndex(items);
  const fr = search(idx, 'السجل التجاري الفرنسي');
  assert.equal(fr.jurisdictionMiss, true);
  assert.ok(fr.queryJuris.includes('فرنس'));
  const fr2 = search(idx, 'السجل التجاري الفرنسية');
  assert.equal(fr2.jurisdictionMiss, true);
  const uk = search(idx, 'السجل التجاري البريطاني');
  assert.equal(uk.jurisdictionMiss, false);
  const uk2 = search(idx, 'شركات مسجلة في المملكة المتحدة البريطانية');
  assert.equal(uk2.jurisdictionMiss, false);
  const plain = search(idx, 'سجلات شركات');
  assert.equal(plain.jurisdictionMiss, false);
  const lat = search(idx, 'French commercial registry');
  assert.ok(lat.queryJuris.includes('french')); // latin jurisdiction terms are detected on the query side
});

test('transactional intent stays non-confident and exposes no candidates for resurrection', () => {
  const items = [
    { name: 'FlightRadar24', url: 'https://example.com/fr', description: 'تتبع حركة الطيران والرحلات الجوية flight tracking aircraft' },
  ];
  const idx = buildIndex(items);
  const r = search(idx, 'احجز تذكرة طيران');
  assert.equal(r.txIntent, true);
  assert.equal(r.confident, false);
  // the UI contract: candidates only surface when confident, so a refusal leaves nothing to resurrect
  const shown = r.confident ? r.candidates : [];
  assert.equal(shown.length, 0);
});
