import test from 'node:test'; import assert from 'node:assert/strict';
import worker from '../worker/rag-lib.js';

// Route-level tests for summarize_text: the OCR workbench's AI structuring. Gemini-first with the
// Workers AI fallback (provider reported); the overview is labeled model prose; every key quote is
// validated verbatim against the source so nothing quoted can be invented. Fails closed.

const ORIGIN = 'https://shehataelsayed.github.io';
const SRC = 'أعلنت وزارة الصحة المصرية اليوم عن إطلاق حملة تطعيم جديدة في المحافظات. وقال المتحدث باسم الوزارة إن الحملة تستهدف مليوني مواطن خلال ثلاثة أشهر. وأضاف أن مراكز التطعيم ستعمل يوميًا من التاسعة صباحًا.';
const geminiBody = obj => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] });

let calls = [];
const realFetch = globalThis.fetch;
const mockGemini = handler => { globalThis.fetch = async (url, init) => { calls.push(String(url)); return handler(String(url), init); }; };
test.after(() => { globalThis.fetch = realFetch; });

const envGemini = () => ({ AI: { run: async () => { throw new Error('CF must not be called'); } }, CF_AI_MODEL: '@cf/qwen/qwen3-30b-a3b-fp8', AI_PROVIDER: 'gemini-first', GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-3.8-flash' });
const envGeminiOnly = () => ({ AI_PROVIDER: 'gemini-first', GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-3.8-flash' });
const post = (body, origin = ORIGIN, env = envGemini()) => worker.fetch(new Request('https://worker.test/', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }), env);

test('route: summarize_text returns an overview plus verbatim-validated quotes', async () => {
  calls = [];
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ overview: 'النص عن حملة تطعيم أطلقتها وزارة الصحة.', key_quotes: ['أعلنت وزارة الصحة المصرية اليوم عن إطلاق حملة تطعيم جديدة في المحافظات.', 'جملة غير موجودة في النص إطلاقًا'] }) }));
  const r = await (await post({ mode: 'summarize_text', text: SRC })).json();
  assert.equal(calls.length, 1);
  assert.equal(r.provider, 'gemini');
  assert.equal(r.summary.overview, 'النص عن حملة تطعيم أطلقتها وزارة الصحة.');
  assert.deepEqual(r.summary.key_quotes, ['أعلنت وزارة الصحة المصرية اليوم عن إطلاق حملة تطعيم جديدة في المحافظات.'], 'invented quote dropped');
});

test('route: overview carrying a URL or empty after cleaning fails closed', async () => {
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ overview: 'راجع https://evil.example للمزيد', key_quotes: [] }) }));
  const r = await (await post({ mode: 'summarize_text', text: SRC })).json();
  assert.deepEqual(r, { summary: null, reason: 'filtered', retry_after: null });
});

test('route: no providers configured -> summary null reason off, no external call', async () => {
  calls = [];
  mockGemini(async () => ({ ok: true, json: async () => ({}) }));
  const r = await (await post({ mode: 'summarize_text', text: SRC }, ORIGIN, {})).json();
  assert.deepEqual(r, { summary: null, reason: 'off', retry_after: null });
  assert.equal(calls.length, 0);
});

test('route: Gemini 429 falls back to Workers AI; quotes still verbatim-validated', async () => {
  mockGemini(async () => ({ ok: false, status: 429, text: async () => 'quota', headers: { get: () => null } }));
  const env = { AI: { run: async () => ({ response: JSON.stringify({ overview: 'ملخص من النموذج البديل.', key_quotes: ['وقال المتحدث باسم الوزارة إن الحملة تستهدف مليوني مواطن خلال ثلاثة أشهر.'] }) }) }, CF_AI_MODEL: '@cf/qwen/qwen3-30b-a3b-fp8', AI_PROVIDER: 'gemini-first', GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-3.8-flash' };
  const r = await (await post({ mode: 'summarize_text', text: SRC }, ORIGIN, env)).json();
  assert.equal(r.provider, 'workers-ai');
  assert.equal(r.summary.overview, 'ملخص من النموذج البديل.');
  assert.equal(r.summary.key_quotes.length, 1);
});

test('route: 429 without fallback / short or missing text fail closed honestly', async () => {
  mockGemini(async () => ({ ok: false, status: 429, headers: { get: () => null }, text: async () => '' }));
  const r429 = await (await post({ mode: 'summarize_text', text: SRC }, ORIGIN, envGeminiOnly())).json();
  assert.deepEqual(r429, { summary: null, reason: 'http_429', retry_after: null });
  const noT = await (await post({ mode: 'summarize_text' })).json();
  assert.deepEqual(noT, { summary: null, reason: 'empty', retry_after: null });
  const short = await (await post({ mode: 'summarize_text', text: 'قصير' })).json();
  assert.deepEqual(short, { summary: null, reason: 'empty', retry_after: null });
});

test('route: origin/method guards apply to summarize_text', async () => {
  const bad = await post({ mode: 'summarize_text', text: SRC }, 'https://evil.example');
  assert.equal(bad.status, 403);
});

test('route: overview asserting extraction quality/accuracy is rejected (model never saw the image)', async () => {
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ overview: 'النص عن حملة تطعيم، ويبدو خاليًا من أخطاء الاستخراج.', key_quotes: [] }) }));
  const r = await (await post({ mode: 'summarize_text', text: SRC })).json();
  assert.deepEqual(r, { summary: null, reason: 'filtered', retry_after: null }, 'unsupported accuracy assertion fails closed');
});

test('route: data context prompt frames the input as a SQL TSV result', async () => {
  let bodySeen = '';
  mockGemini(async (url, init) => { bodySeen = String(init && init.body || ''); return { ok: true, json: async () => geminiBody({ overview: 'النتيجة تظهر ثلاثة أعمدة وعشرين صفًا.', key_quotes: [] }) }; });
  const r = await (await post({ mode: 'summarize_text', text: 'col1\tcol2\nقيمة1\tقيمة2\nقيمة3\tقيمة4\nقيمة5\tقيمة6\nقيمة7\tقيمة8', context: 'data' })).json();
  assert.equal(r.summary.overview, 'النتيجة تظهر ثلاثة أعمدة وعشرين صفًا.');
  assert.match(bodySeen, /TSV/, 'prompt names the TSV/SQL framing for data context');
});

test('route: prose-wrapped JSON from the fallback model is salvaged', async () => {
  mockGemini(async () => ({ ok: false, status: 429, text: async () => 'quota', headers: { get: () => null } }));
  const wrapped = 'إليك الملخص المطلوب:\n{"overview":"ملخص سليم من النص.", "key_quotes":[]}\nانتهى.';
  const env = { AI: { run: async () => ({ response: wrapped }) }, CF_AI_MODEL: '@cf/qwen/qwen3-30b-a3b-fp8', AI_PROVIDER: 'gemini-first', GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-3.8-flash' };
  const r = await (await post({ mode: 'summarize_text', text: SRC }, ORIGIN, env)).json();
  assert.equal(r.summary.overview, 'ملخص سليم من النص.', 'JSON extracted from surrounding prose');
});

test('route: model JSON with literal newlines in strings and trailing commas is salvaged', async () => {
  // Small models (the Workers AI fallback path) often emit invalid JSON: raw newlines inside
  // Arabic string values and trailing commas. salvageJson repairs both; quotes stay verbatim.
  const broken = '{"overview":"ملخص أولي\nيتابع على سطرين.",\n"key_quotes":["أعلنت وزارة الصحة المصرية اليوم عن إطلاق حملة تطعيم جديدة في المحافظات.",],\n}';
  mockGemini(async () => ({ ok: false, status: 429, text: async () => 'quota', headers: { get: () => null } }));
  const env = { AI: { run: async () => ({ response: broken }) }, CF_AI_MODEL: '@cf/qwen/qwen3-30b-a3b-fp8', AI_PROVIDER: 'gemini-first', GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-3.8-flash' };
  const r = await (await post({ mode: 'summarize_text', text: SRC }, ORIGIN, env)).json();
  assert.equal(r.provider, 'workers-ai');
  assert.equal(r.summary.overview, 'ملخص أولي يتابع على سطرين.');
  assert.deepEqual(r.summary.key_quotes, ['أعلنت وزارة الصحة المصرية اليوم عن إطلاق حملة تطعيم جديدة في المحافظات.']);
});

test('route: unparseable model output still fails closed with reason parse', async () => {
  mockGemini(async () => ({ ok: false, status: 429, text: async () => 'quota', headers: { get: () => null } }));
  const env = { AI: { run: async () => ({ response: 'لا أستطيع المساعدة في هذا الطلب' }) }, CF_AI_MODEL: '@cf/qwen/qwen3-30b-a3b-fp8', AI_PROVIDER: 'gemini-first', GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-3.8-flash' };
  const r = await (await post({ mode: 'summarize_text', text: SRC }, ORIGIN, env)).json();
  assert.deepEqual(r, { summary: null, reason: 'parse', retry_after: null });
});

test('route: OCR overview attributing garbling to the original image fails closed', async () => {
  // The model only ever saw extracted text, never the image: blaming "damage in the original
  // image" (observed live 2026-10-30) is an unsupported judgment and must be rejected.
  const blame = 'يبدو أن النص يحتوي على كلمات مكسورة بسبب تلف في الصورة الأصلية.';
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ overview: blame, key_quotes: [] }) }));
  const r = await (await post({ mode: 'summarize_text', text: SRC, context: 'ocr' })).json();
  assert.deepEqual(r, { summary: null, reason: 'filtered', retry_after: null });
});

test('route: OCR overview referencing the original image or OCR process quality fails closed', async () => {
  for (const overview of [
    'جودة الاستخراج جيدة والنص واضح.',
    'جودة الصورة منخفضة مما أثر على النص.',
    'قد تكون الأخطاء نتيجة التعرف الضوئي على الحروف.',
    'النص المستخرج من الصورة الأصلية يحتوي غموضًا.',
  ]) {
    mockGemini(async () => ({ ok: true, json: async () => geminiBody({ overview, key_quotes: [] }) }));
    const r = await (await post({ mode: 'summarize_text', text: SRC, context: 'ocr' })).json();
    assert.deepEqual(r, { summary: null, reason: 'filtered', retry_after: null }, overview);
  }
});

test('route: OCR overview describing text ambiguity WITHOUT a source attribution passes', async () => {
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ overview: 'النص يحتوي مقاطع غير مفهومة لغويًا وبعض الكلمات غير المكتملة.', key_quotes: ['أعلنت وزارة الصحة المصرية اليوم عن إطلاق حملة تطعيم جديدة في المحافظات.'] }) }));
  const r = await (await post({ mode: 'summarize_text', text: SRC, context: 'ocr' })).json();
  assert.equal(r.provider, 'gemini');
  assert.equal(r.summary.overview, 'النص يحتوي مقاطع غير مفهومة لغويًا وبعض الكلمات غير المكتملة.');
  assert.equal(r.summary.key_quotes.length, 1);
});

test('route: data context mentioning damage in the CONTENT is not blocked by the OCR guard', async () => {
  // The OCR-specific guard must not leak into other contexts: a data summary about damaged goods
  // is legitimate content description.
  const dataSrc = 'المنتج\tالحالة\nقمح\tتالف\nأرز\tسليم\nذرة\tتالف\nشعير\tسليم\nعدس\tسليم\nفول\tتالف';
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ overview: 'تظهر النتيجة 6 منتجات، نصفها تالف والنصف سليم.', key_quotes: [] }) }));
  const r = await (await post({ mode: 'summarize_text', text: dataSrc, context: 'data' })).json();
  assert.equal(r.provider, 'gemini');
  assert.equal(r.summary.overview, 'تظهر النتيجة 6 منتجات، نصفها تالف والنصف سليم.');
});

test('route: OCR overview asserting OCR errors or a corruption cause fails closed (live phrasing 2026-10-30)', async () => {
  // Second live phrasing: "مُستخرج عبر أداة OCR ويتضمن أخطاء تعرف ضوئي، مما أدى إلى تلفه" -
  // an extraction-quality judgment plus a causal claim; both unsupported from text alone.
  for (const overview of [
    'النص هو نص عربي مُستخرج عبر أداة OCR ويتضمن أخطاء تعرف ضوئي، مما أدى إلى تلفه وصعوبة فهمه.',
    'النص يحتوي أخطاء استخراج واضحة.',
    'أدى التعرف الضوئي إلى تلف بعض الكلمات.',
    'دقة التعرف منخفضة في هذا النص.',
  ]) {
    mockGemini(async () => ({ ok: true, json: async () => geminiBody({ overview, key_quotes: [] }) }));
    const r = await (await post({ mode: 'summarize_text', text: SRC, context: 'ocr' })).json();
    assert.deepEqual(r, { summary: null, reason: 'filtered', retry_after: null }, overview);
  }
});

test('route: new tool contexts pass with grounded description and provider label', async () => {
  // archive / domain / diff contexts: describe only what the result shows.
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ overview: 'تظهر النتيجة 12 لقطة أرشيفية بين 2020 و2026 مع نقطتي تغير بصمة.', key_quotes: ['أقدم لقطة مجلوبة 2020-03-01'] }) }));
  const arc = await (await post({ mode: 'summarize_text', text: 'نتيجة أرشيف: لقطات مجلوبة 12. أقدم لقطة مجلوبة 2020-03-01. أحدث لقطة مجلوبة 2026-01-15. نقطة تغير محتوى بين المجلوبة 2.', context: 'archive' })).json();
  assert.equal(arc.provider, 'gemini');
  assert.equal(arc.summary.key_quotes.length, 1);
});

test('route: domain guard blocks trust/reputation judgments', async () => {
  const rec = 'سجل DNS من Google Public DNS\nالحالة: NOERROR\nexample.com A 93.184.216.34 (TTL 3600)\nبيانات التسجيل RDAP\nالمسجل: Example Registrar\nتاريخ التسجيل: 1995-08-14';
  for (const overview of ['النطاق موثوق وقديم التسجيل.', 'السجلات تشير إلى موقع مشبوه.', 'يبدو النطاق آمنًا لكن تحقق بنفسك: النطاق موثوق.']) {
    mockGemini(async () => ({ ok: true, json: async () => geminiBody({ overview, key_quotes: [] }) }));
    const r = await (await post({ mode: 'summarize_text', text: rec, context: 'domain' })).json();
    assert.deepEqual(r, { summary: null, reason: 'filtered', retry_after: null }, overview);
  }
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ overview: 'تشمل السجلات سجل A بعنوان 93.184.216.34 وتاريخ تسجيل يعود إلى 1995-08-14 عبر مسجل معلن.', key_quotes: ['تاريخ التسجيل: 1995-08-14'] }) }));
  const ok = await (await post({ mode: 'summarize_text', text: rec, context: 'domain' })).json();
  assert.equal(ok.provider, 'gemini');
  assert.equal(ok.summary.key_quotes.length, 1);
});

test('route: archive guard blocks hacking speculation; diff guard blocks intent claims', async () => {
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ overview: 'ربما تعرض الموقع لاختراق أدى لتغير البصمة.', key_quotes: [] }) }));
  const arc = await (await post({ mode: 'summarize_text', text: 'نتيجة أرشيف: لقطات مجلوبة 12. أقدم لقطة مجلوبة 2020-03-01. أحدث لقطة 2026-01-15. نقاط تغير 2.', context: 'archive' })).json();
  assert.deepEqual(arc, { summary: null, reason: 'filtered', retry_after: null });
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ overview: 'يبدو أن التغيير تلاعب متعمد بالأرقام.', key_quotes: [] }) }));
  const dif = await (await post({ mode: 'summarize_text', text: 'مقارنة نسختين: تغيرت 3 أسطر. السطر الأول: الموعد نهار الثلاثاء. السطر الثاني: الموعد نهار الأربعاء.', context: 'diff' })).json();
  assert.deepEqual(dif, { summary: null, reason: 'filtered', retry_after: null });
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ overview: 'تغيرت 3 أسطر بين النسختين أبرزها تغيير يوم الموعد من الثلاثاء إلى الأربعاء.', key_quotes: ['الموعد نهار الثلاثاء'] }) }));
  const okd = await (await post({ mode: 'summarize_text', text: 'مقارنة نسختين: تغيرت 3 أسطر. السطر الأول: الموعد نهار الثلاثاء. السطر الثاني: الموعد نهار الأربعاء.', context: 'diff' })).json();
  assert.equal(okd.provider, 'gemini');
  assert.equal(okd.summary.key_quotes.length, 1);
});

test('route: archive overview must say fingerprint change and scope the fetched sample', async () => {
  const arc = 'نتيجة أرشيف: تقدير إجمالي اللقطات 3176. لقطات مجلوبة 200 (حد 200). أقدم لقطة مجلوبة 2025-07-31. أحدث لقطة مجلوبة 2026-07-12. نقطة تغير محتوى بين المجلوبة 5.';
  // Live phrasing 2026-10-30: "5 نقاط تغير في المحتوى" upgrades a digest-change lead to a
  // content-change claim - blocked.
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ overview: 'تبدأ أقدم لقطة في 2025-07-31 وتنتهي أحدث لقطة في 2026-07-12، مع وجود 5 نقاط تغير في المحتوى.', key_quotes: [] }) }));
  const bad = await (await post({ mode: 'summarize_text', text: arc, context: 'archive' })).json();
  assert.deepEqual(bad, { summary: null, reason: 'filtered', retry_after: null });
  // Correct wording: fingerprint changes scoped to the fetched sample.
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ overview: 'تُظهر النتيجة 200 لقطة مجلوبة من أصل 3176 مقدرة، أقدمها مجلوبة في 2025-07-31 وأحدثها مجلوبة في 2026-07-12، مع 5 نقاط تغير بصمة بين المجلوبة.', key_quotes: ['أقدم لقطة مجلوبة 2025-07-31'] }) }));
  const ok = await (await post({ mode: 'summarize_text', text: arc, context: 'archive' })).json();
  assert.equal(ok.provider, 'gemini');
  assert.equal(ok.summary.key_quotes.length, 1);
});

test('route: image context blocks authenticity/manipulation verdicts, allows measurement description', async () => {
  const metrics = 'بيانات الملف: PNG، الأبعاد 1200×630، الحجم 39 كيلوبايت. متوسط فرق القنوات: 2.31 من 255. أكبر فرق: 87 من 255. بصمة إدراكية: a3f9...';
  for (const overview of [
    'القياسات تثبت أن الصورة معدلة.',
    'الصورة أصلية ولم تُعدّل.',
    'توجد مؤشرات تلاعب واضحة في الصورة.',
    'الصورة مزيفة على الأرجح.',
  ]) {
    mockGemini(async () => ({ ok: true, json: async () => geminiBody({ overview, key_quotes: [] }) }));
    const r = await (await post({ mode: 'summarize_text', text: metrics, context: 'image' })).json();
    assert.deepEqual(r, { summary: null, reason: 'filtered', retry_after: null }, overview);
  }
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ overview: 'تشمل القياسات ملف PNG بأبعاد 1200×630 ومتوسط فرق قنوات 2.31 من 255 وأكبر فرق 87، وهي قياسات وصفية لفرق إعادة الضغط.', key_quotes: ['متوسط فرق القنوات: 2.31 من 255'] }) }));
  const ok = await (await post({ mode: 'summarize_text', text: metrics, context: 'image' })).json();
  assert.equal(ok.provider, 'gemini');
  assert.equal(ok.summary.key_quotes.length, 1);
  // Negated limits wording (observed live 2026-10-31, reason 'filtered' on image-difference):
  // «لا تثبت» / «ليست اثبات» mirrors the page's own disclaimer and must NOT be blocked.
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ overview: 'هذه القياسات وصفية لفرق إعادة الضغط ولا تثبت تعديلًا وليست اثبات على الأصالة.', key_quotes: ['أكبر فرق: 87 من 255'] }) }));
  const neg = await (await post({ mode: 'summarize_text', text: metrics, context: 'image' })).json();
  assert.equal(neg.provider, 'gemini');
  assert.equal(neg.summary.key_quotes.length, 1);
  // Negated authenticity words stay blocked: «ليست مزيفة» is still an authenticity verdict.
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ overview: 'الصورة ليست مزيفة حسب هذه القياسات.', key_quotes: [] }) }));
  const negAuth = await (await post({ mode: 'summarize_text', text: metrics, context: 'image' })).json();
  assert.deepEqual(negAuth, { summary: null, reason: 'filtered', retry_after: null });
  // Live phrasing 2026-10-31 on image-difference: the model echoed the completion status
  // «المناطق المضيئة ليست دليل تلاعب بمفردها» and the absolute تلاعب guard blocked it.
  // Negated-limits wording around an evidence noun is limits language, allowed.
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ overview: 'تعرض القياسات متوسط فرق قنوات 2.31 وأكبر فرق 87، والمناطق المضيئة ليست دليل تلاعب بمفردها.', key_quotes: ['أكبر فرق: 87 من 255'] }) }));
  const lim = await (await post({ mode: 'summarize_text', text: metrics, context: 'image' })).json();
  assert.equal(lim.provider, 'gemini');
  assert.equal(lim.summary.key_quotes.length, 1);
  // A positive tampering verdict inside the same sentence still fails closed.
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ overview: 'القياسات لا تثبت تعديلًا لكن توجد مؤشرات تلاعب واضحة.', key_quotes: [] }) }));
  const smug = await (await post({ mode: 'summarize_text', text: metrics, context: 'image' })).json();
  assert.deepEqual(smug, { summary: null, reason: 'filtered', retry_after: null });
  // Exact live overview 2026-10-31 (from server diag log, reason 'filtered'): «يؤكد النص على
  // أنها مؤشرات تقنية... ولا تعتبر دليلًا قاطعًا على التلاعب» - description + negated limits,
  // must pass. Proof verbs only block when a verdict word follows in the same breath.
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ overview: 'يتناول النص نتائج فحص فني محلي لصورة رقمية، موضحًا أبعادها وقياسات فرق القنوات اللونية الناتجة عن التحليل. كما يؤكد النص على أن هذه البيانات هي مؤشرات تقنية للمقارنة ولا تعتبر دليلًا قاطعًا على التلاعب أو التزوير بمفردها.', key_quotes: ['متوسط فرق القنوات: 2.31 من 255'] }) }));
  const live = await (await post({ mode: 'summarize_text', text: metrics, context: 'image' })).json();
  assert.equal(live.provider, 'gemini', JSON.stringify(live));
  assert.equal(live.summary.key_quotes.length, 1);
  // Proof verb tied to a verdict word still fails closed.
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ overview: 'القياسات تثبت التعديل بوضوح في هذه الصورة.', key_quotes: [] }) }));
  const linked = await (await post({ mode: 'summarize_text', text: metrics, context: 'image' })).json();
  assert.deepEqual(linked, { summary: null, reason: 'filtered', retry_after: null });  // Boundary regression (caught by the video route test 2026-10-31): without a word boundary
  // before the negation, «التغيّر» false-matches «غير» and the strip would DELETE this real
  // verdict before the guard sees it. Finite regression coverage, not a safety guarantee.
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ overview: 'درجات التغيّر تثبت التعديل في هذه الصورة.', key_quotes: [] }) }));
  const boundary = await (await post({ mode: 'summarize_text', text: metrics, context: 'image' })).json();
  assert.deepEqual(boundary, { summary: null, reason: 'filtered', retry_after: null });
  // Live phrasing 2026-10-31 on image-analysis (parent review): the source only LISTS display
  // layer names (الطبقات البصرية العميقة as available views), yet the overview implied a deep
  // layer analysis («إشارة إلى تحليل طبقات بصرية عميقة»). Executed-analysis claims about
  // merely-listed layers fail closed; naming the layers as available views is allowed.
  const withLayers = metrics + ' الطبقات المتاحة للعرض: فرق إعادة الضغط، الضوضاء، النسخ، التدرج، المستويات، المدرج، PCA.';
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ overview: 'تعرض النتيجة قياسات الملف بالإضافة إلى إشارة إلى تحليل طبقات بصرية عميقة.', key_quotes: [] }) }));
  const deep = await (await post({ mode: 'summarize_text', text: withLayers, context: 'image' })).json();
  assert.deepEqual(deep, { summary: null, reason: 'filtered', retry_after: null });
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ overview: 'تشمل القياسات المنفذة أبعاد الملف 1200×630 ومتوسط فرق القنوات 2.31، مع طبقات عرض متاحة مثل خريطة الضوضاء لم تُذكر نتائجها هنا.', key_quotes: ['متوسط فرق القنوات: 2.31 من 255'] }) }));
  const listed = await (await post({ mode: 'summarize_text', text: withLayers, context: 'image' })).json();
  assert.equal(listed.provider, 'gemini', JSON.stringify(listed));
  assert.equal(listed.summary.key_quotes.length, 1);
});

test('route: video context blocks authenticity/editing verdicts, allows extraction description', async () => {
  const results = 'اسم الملف: clip.mp4 الحجم: 480000 بايت SHA-256: ab12... لقطات مستخرجة: 6. لقطة عند 0.0ث · لقطة البداية المرجعية. لقطة عند 2.4ث · تغيّر مرصود · درجة 12.3. الدلالة والحدود: درجات التغيّر مؤشرات مراجعة لا حكم أصالة.';
  for (const overview of [
    'الفيديو معدل عند اللقطة 2.4ث.',
    'درجات التغيّر تثبت تركيب الفيديو.',
    'الفيديو أصلي ولم يُعدّل.',
  ]) {
    mockGemini(async () => ({ ok: true, json: async () => geminiBody({ overview, key_quotes: [] }) }));
    const r = await (await post({ mode: 'summarize_text', text: results, context: 'video' })).json();
    assert.deepEqual(r, { summary: null, reason: 'filtered', retry_after: null }, overview);
  }
  // Negated limits wording is allowed; executed results described with their numbers.
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ overview: 'استُخرجت 6 لقطات من الملف مع بصمته، وسُجّل تغيّر مرصود بدرجة 12.3 عند 2.4ث وهو مؤشر مراجعة لا يثبت تعديلًا.', key_quotes: ['لقطات مستخرجة: 6'] }) }));
  const ok = await (await post({ mode: 'summarize_text', text: results, context: 'video' })).json();
  assert.equal(ok.provider, 'gemini', JSON.stringify(ok));
  assert.equal(ok.summary.key_quotes.length, 1);
});
