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
