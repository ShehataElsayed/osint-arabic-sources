import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, search, stem, normalize, gateScopes, toolScopes } from '../site/tool-search.js';
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

test('scope gating demotes satellite map imagery for a photo-republication query', () => {
  const cands = [
    { t: { name: 'SatArchive', description: 'أرشيف نسخ أقدم من صور خريطة العالم بالأقمار الصناعية. قارن تواريخ الصورة نفسها.', url: 'https://a.example' }, rrf: 0.05 },
    { t: { name: 'RevImgA', description: 'بحث عكسي عن الصور ومطابقة صورة كاملة أو جزء منها مع صفحات منشورة.', url: 'https://b.example' }, rrf: 0.04 },
    { t: { name: 'RevImgB', description: 'البحث عن صور مشابهة أو نسخ منشورة باستخدام صورة.', url: 'https://c.example' }, rrf: 0.03 },
  ];
  const out = gateScopes('كيف أتحقق من صورة قديمة أُعيد نشرها؟', cands);
  assert.equal(out[0].t.name, 'RevImgA');
  assert.equal(out[2].t.name, 'SatArchive');
  assert.ok(out[2].scopeMismatch, 'satellite tool must be labeled');
  assert.equal(out[0].scopeMismatch, null);
});

test('scope gating keeps satellite tools when the query names their medium', () => {
  const cands = [
    { t: { name: 'SatArchive', description: 'أرشيف نسخ أقدم من صور خريطة العالم بالأقمار الصناعية.', url: 'https://a.example' }, rrf: 0.03 },
    { t: { name: 'RevImgA', description: 'بحث عكسي عن الصور ومطابقة صورة مع صفحات منشورة.', url: 'https://b.example' }, rrf: 0.05 },
  ];
  const out = gateScopes('أريد صورة قمر صناعي قديمة لموقع على الخريطة', cands);
  assert.equal(out[0].t.name, 'RevImgA', 'rrf order preserved when no mismatch');
  assert.equal(out[1].scopeMismatch, null);
});

test('scope gating is a no-op without scope terms', () => {
  const cands = [
    { t: { name: 'A', description: 'بحث عن اسم مستخدم عبر المواقع.', url: 'https://a.example' }, rrf: 0.02 },
    { t: { name: 'B', description: 'سجلات شركات وملكية.', url: 'https://b.example' }, rrf: 0.05 },
  ];
  const out = gateScopes('ما مواقع الشركات؟', cands);
  assert.equal(out[0].t.name, 'B');
  assert.ok(out.every(c => c.scopeMismatch === null));
});

test('scope gating does not demote generic multimedia tools for a photo query', () => {
  const cands = [
    { t: { name: 'VerifyPlugin', description: 'إضافة متصفح للتحقق من الوسائط: بحث عكسي عن الصور وفحص بيانات وصفية وتحليل إطارات الفيديو.', url: 'https://v.example' }, rrf: 0.05 },
    { t: { name: 'MultiPlatform', description: 'منصة مشاركة الصور والفيديو الأوسع، غنية بالاستطلاع البصري.', url: 'https://p.example' }, rrf: 0.04 },
    { t: { name: 'GenDetector', description: 'تصنيف ما إذا كانت صورة أو مادة صوتية تبدو مولدة آلياً.', url: 'https://g.example' }, rrf: 0.03 },
  ];
  const out = gateScopes('كيف أتحقق من صورة قديمة أُعيد نشرها؟', cands);
  assert.ok(out.every(c => c.scopeMismatch === null), 'no multimedia tool may be demoted');
  assert.equal(out[0].t.name, 'VerifyPlugin');
});

test('video and audio queries gate nothing', () => {
  const cands = [
    { t: { name: 'VidSearch', description: 'محرك للعثور على مقاطع فيديو بحسب عبارة البحث.', url: 'https://v.example' }, rrf: 0.05 },
    { t: { name: 'ImgSearch', description: 'بحث عكسي عن الصور ومطابقة صورة مع صفحات منشورة.', url: 'https://i.example' }, rrf: 0.04 },
  ];
  const out = gateScopes('كيف أتحقق من فيديو منتشر؟', cands);
  assert.ok(out.every(c => c.scopeMismatch === null));
});
