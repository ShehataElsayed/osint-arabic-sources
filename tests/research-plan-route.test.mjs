import test from 'node:test'; import assert from 'node:assert/strict';
import worker from '../worker/rag-lib.js';

// Route-level tests for the research_plan dispatch in worker/rag-lib.js's default fetch handler.
// research_plan is the user-requested Gemini link: it must call Google Gemini directly (never the
// Cloudflare AI binding), validate every step against the actual candidate list, and fail closed
// to { plan: null, reason } without touching other routes' behavior.

const ORIGIN = 'https://shehataelsayed.github.io';
const CANDS = [
  { id: 1, name: 'أداة الأرشيف', description: 'البحث في النسخ المؤرشفة من صفحات الويب' },
  { id: 2, name: 'أداة الصور', description: 'البحث العكسي عن الصور ومعرفة مصدرها' },
  { id: 3, name: 'أداة النطاقات', description: 'بيانات تسجيل النطاق ومالكه' },
];
const geminiBody = obj => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] });

let calls = [];
const realFetch = globalThis.fetch;
const mockGemini = handler => { globalThis.fetch = async (url, init) => { calls.push(String(url)); return handler(String(url), init); }; };
test.after(() => { globalThis.fetch = realFetch; });

const envGemini = () => ({ AI: { run: async () => { throw new Error('CF must not be called'); } }, CF_AI_MODEL: '@cf/qwen/qwen3-30b-a3b-fp8', AI_PROVIDER: 'cloudflare', GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-3.8-flash' });
const post = (body, origin = ORIGIN, env = envGemini()) => worker.fetch(new Request('https://worker.test/', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }), env);

test('route: research_plan calls Gemini, not the Cloudflare AI binding, even when AI is bound', async () => {
  calls = [];
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ intro: 'خطة', steps: [{ tool_id: 1, goal: 'جمع النسخ', how: 'ابحث برابط الصفحة' }], limits: 'للمراجعة' }) }));
  const r = await (await post({ mode: 'research_plan', question: 'كيف أراجع نسخة مؤرشفة من بيان؟', candidates: CANDS })).json();
  assert.equal(calls.length, 1);
  assert.match(calls[0], /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-3\.8-flash:generateContent$/, 'Gemini endpoint with env model');
  assert.equal(r.plan.steps.length, 1); assert.equal(r.plan.steps[0].tool_id, 1); assert.equal(r.plan.limits, 'للمراجعة');
});

test('route: no GEMINI_API_KEY -> plan null reason off, and no external call at all', async () => {
  calls = [];
  mockGemini(async () => ({ ok: true, json: async () => ({}) }));
  const env = { AI: { run: async () => ({}) }, CF_AI_MODEL: '@cf/qwen/qwen3-30b-a3b-fp8', AI_PROVIDER: 'cloudflare' };
  const r = await (await post({ mode: 'research_plan', question: 'سؤال', candidates: CANDS }, ORIGIN, env)).json();
  assert.deepEqual(r, { plan: null, reason: 'off' });
  assert.equal(calls.length, 0, 'no Gemini and no CF call when the key is absent');
});

test('route: steps are validated against the actual candidate list', async () => {
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ intro: '', steps: [
    { tool_id: 1, goal: 'خطوة 1', how: 'طريقة 1' },
    { tool_id: 99, goal: 'أداة مخترعة', how: 'يجب أن تُحذف' },
    { tool_id: 2, goal: 'خطوة 2', how: 'طريقة بها رابط https://evil.example تُحذف' },
    { tool_id: 1, goal: 'مكررة', how: 'تُحذف' },
    { tool_id: 3, goal: 'خطوة 3', how: 'طريقة 3' },
  ] }) }));
  const r = await (await post({ mode: 'research_plan', question: 'سؤال', candidates: CANDS })).json();
  assert.deepEqual(r.plan.steps.map(x => x.tool_id), [1, 3], 'unknown id, URL-bearing step, and duplicate all dropped, order preserved');
});

test('route: plans are capped at 5 steps', async () => {
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ steps: [
    { tool_id: 1, goal: '1', how: 'أ' }, { tool_id: 2, goal: '2', how: 'ب' }, { tool_id: 3, goal: '3', how: 'ج' },
    { tool_id: 1, goal: '4', how: 'د' }, { tool_id: 2, goal: '5', how: 'هـ' }, { tool_id: 3, goal: '6', how: 'و' },
  ].map((x, i) => ({ ...x, tool_id: [1, 2, 3, 4, 5, 6][i] })) }) }));
  const many = [...CANDS, { id: 4, name: 'أداة 4', description: 'وصف' }, { id: 5, name: 'أداة 5', description: 'وصف' }, { id: 6, name: 'أداة 6', description: 'وصف' }];
  const r = await (await post({ mode: 'research_plan', question: 'سؤال', candidates: many })).json();
  assert.equal(r.plan.steps.length, 5);
});

test('route: Gemini http error and unparseable output fail closed with a reason', async () => {
  mockGemini(async () => ({ ok: false, status: 429 }));
  const r429 = await (await post({ mode: 'research_plan', question: 'سؤال', candidates: CANDS })).json();
  assert.deepEqual(r429, { plan: null, reason: 'http_429' });
  mockGemini(async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'ليس JSON' }] } }] }) }));
  const bad = await (await post({ mode: 'research_plan', question: 'سؤال', candidates: CANDS })).json();
  assert.deepEqual(bad, { plan: null, reason: 'parse' });
});

test('route: missing question or candidates -> reason empty; every step filtered -> reason filtered', async () => {
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ steps: [{ tool_id: 99, goal: 'س', how: 'ص' }] }) }));
  const noQ = await (await post({ mode: 'research_plan', candidates: CANDS })).json();
  assert.deepEqual(noQ, { plan: null, reason: 'empty' });
  const noC = await (await post({ mode: 'research_plan', question: 'سؤال', candidates: [] })).json();
  assert.deepEqual(noC, { plan: null, reason: 'empty' });
  const filtered = await (await post({ mode: 'research_plan', question: 'سؤال', candidates: CANDS })).json();
  assert.deepEqual(filtered, { plan: null, reason: 'filtered' });
});

test('route: origin/method/JSON guards apply to research_plan', async () => {
  const bad = await post({ mode: 'research_plan', question: 'س', candidates: CANDS }, 'https://evil.example');
  assert.equal(bad.status, 403);
  const get = await worker.fetch(new Request('https://worker.test/', { method: 'GET', headers: { origin: ORIGIN } }), envGemini());
  assert.equal(get.status, 405);
  const malformed = await post('{not json');
  assert.equal(malformed.status, 400);
});
