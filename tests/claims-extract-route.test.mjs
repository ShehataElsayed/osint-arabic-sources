import test from 'node:test'; import assert from 'node:assert/strict';
import worker from '../worker/rag-lib.js';

// Route-level tests for extract_claims. Claims must be neutral and anchored to a verbatim quote;
// verdict-smuggling claims are dropped; failures close to { claims: null, reason }.

const ORIGIN = 'https://shehataelsayed.github.io';
const SRC = 'قالت الشركة إن مبيعاتها بلغت 4 ملايين وحدة في 2025. وأضاف المتحدث أن المصنع الجديد يفتح في مارس. يعتقد كثيرون أن السوق ستتحسن.';
const geminiBody = obj => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] });

let calls = [];
const realFetch = globalThis.fetch;
const mockGemini = handler => { globalThis.fetch = async (url, init) => { calls.push(String(url)); return handler(String(url), init); }; };
test.after(() => { globalThis.fetch = realFetch; });

const envGemini = () => ({ AI: { run: async () => { throw new Error('CF must not be called'); } }, CF_AI_MODEL: '@cf/qwen/qwen3-30b-a3b-fp8', AI_PROVIDER: 'gemini-first', GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-3.8-flash' });
const envGeminiOnly = () => ({ AI_PROVIDER: 'gemini-first', GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-3.8-flash' });
const post = (body, origin = ORIGIN, env = envGemini()) => worker.fetch(new Request('https://worker.test/', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }), env);

test('route: extract_claims returns quote-anchored claims', async () => {
  calls = [];
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ claims: [
    { claim: 'مبيعات الشركة 4 ملايين وحدة في 2025', quote: 'قالت الشركة إن مبيعاتها بلغت 4 ملايين وحدة في 2025.' },
  ] }) }));
  const r = await (await post({ mode: 'extract_claims', text: SRC })).json();
  assert.equal(calls.length, 1);
  assert.equal(r.claims.length, 1);
  assert.equal(r.claims[0].quote, 'قالت الشركة إن مبيعاتها بلغت 4 ملايين وحدة في 2025.');
  assert.equal(r.provider, 'gemini');
});

test('route: claims without a verbatim source quote are dropped', async () => {
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ claims: [
    { claim: 'مدعوم من النص', quote: 'وأضاف المتحدث أن المصنع الجديد يفتح في مارس.' },
    { claim: 'مخترع', quote: 'جملة ليست في النص أبدًا.' },
    { claim: 'بلا اقتباس', quote: '' },
  ] }) }));
  const r = await (await post({ mode: 'extract_claims', text: SRC })).json();
  assert.equal(r.claims.length, 1);
  assert.equal(r.claims[0].claim, 'مدعوم من النص');
});

test('route: verdict-smuggling claims are dropped (no truth assessments ever)', async () => {
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ claims: [
    { claim: 'هذا الادعاء صحيح ومؤكد', quote: 'قالت الشركة إن مبيعاتها بلغت 4 ملايين وحدة في 2025.' },
    { claim: 'الخبر كاذب', quote: 'وأضاف المتحدث أن المصنع الجديد يفتح في مارس.' },
    { claim: 'محايد يبقى', quote: 'وأضاف المتحدث أن المصنع الجديد يفتح في مارس.' },
  ] }) }));
  const r = await (await post({ mode: 'extract_claims', text: SRC })).json();
  assert.deepEqual(r.claims.map(c => c.claim), ['محايد يبقى']);
});

test('route: gating, http error, parse failure, empty text and empty result fail closed', async () => {
  calls = [];
  mockGemini(async () => ({ ok: true, json: async () => ({}) }));
  assert.deepEqual(await (await post({ mode: 'extract_claims', text: SRC }, ORIGIN, {})).json(), { claims: null, reason: 'off', retry_after: null });
  assert.equal(calls.length, 0);
  mockGemini(async () => ({ ok: false, status: 500 }));
  assert.deepEqual(await (await post({ mode: 'extract_claims', text: SRC }, ORIGIN, envGeminiOnly())).json(), { claims: null, reason: 'http_500', retry_after: null });
  mockGemini(async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'ليس JSON' }] } }] }) }));
  assert.deepEqual(await (await post({ mode: 'extract_claims', text: SRC })).json(), { claims: null, reason: 'parse', retry_after: null });
  assert.deepEqual(await (await post({ mode: 'extract_claims', text: 'قصير' })).json(), { claims: null, reason: 'empty', retry_after: null });
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ claims: [] }) }));
  assert.deepEqual(await (await post({ mode: 'extract_claims', text: SRC })).json(), { claims: null, reason: 'filtered', retry_after: null });
});

test('route: origin/method/JSON guards apply to extract_claims', async () => {
  assert.equal((await post({ mode: 'extract_claims', text: SRC }, 'https://evil.example')).status, 403);
  const get = await worker.fetch(new Request('https://worker.test/', { method: 'GET', headers: { origin: ORIGIN } }), envGemini());
  assert.equal(get.status, 405);
  assert.equal((await post('{not json')).status, 400);
});

test('route: Gemini 429 falls back to Workers AI; verdict smuggling still dropped', async () => {
  mockGemini(async () => ({ ok: false, status: 429, text: async () => 'quota', headers: { get: () => null } }));
  const env = { AI: { run: async () => ({ response: JSON.stringify({ claims: [ { claim: 'مبيعات الشركة 4 ملايين وحدة في 2025', quote: 'قالت الشركة إن مبيعاتها بلغت 4 ملايين وحدة في 2025.' }, { claim: 'الخبر كاذب تمامًا', quote: 'وأضاف المتحدث أن المصنع الجديد يفتح في مارس.' } ] }) }) }, CF_AI_MODEL: '@cf/qwen/qwen3-30b-a3b-fp8', AI_PROVIDER: 'gemini-first', GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-3.8-flash' };
  const r = await (await post({ mode: 'extract_claims', text: SRC }, ORIGIN, env)).json();
  assert.equal(r.provider, 'workers-ai');
  assert.deepEqual(r.claims.map(c => c.claim), ['مبيعات الشركة 4 ملايين وحدة في 2025'], 'fallback output passes the same no-verdict filter');
});
