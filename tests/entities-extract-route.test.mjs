import test from 'node:test'; import assert from 'node:assert/strict';
import worker from '../worker/rag-lib.js';

// Route-level tests for the extract_entities dispatch in worker/rag-lib.js's default fetch handler.
// extract_entities powers AI extraction on the entities workbench: Gemini-first with an
// automatic Workers AI fallback (the response reports the winning provider), keeping ONLY names
// that appear verbatim in the user's source text, failing closed to { entities: null, reason }.

const ORIGIN = 'https://shehataelsayed.github.io';
const SRC = 'قال محمد عبد الله، المتحدث باسم وزارة الصحة المصرية، في مؤتمر صحفي بالقاهرة إن مستشفى المنيرة استقبل الحالات.';
const geminiBody = obj => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] });

let calls = [];
const realFetch = globalThis.fetch;
const mockGemini = handler => { globalThis.fetch = async (url, init) => { calls.push(String(url)); return handler(String(url), init); }; };
test.after(() => { globalThis.fetch = realFetch; });

const envGemini = () => ({ AI: { run: async () => { throw new Error('CF must not be called'); } }, CF_AI_MODEL: '@cf/qwen/qwen3-30b-a3b-fp8', AI_PROVIDER: 'gemini-first', GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-3.8-flash' });
const envGeminiOnly = () => ({ AI_PROVIDER: 'gemini-first', GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-3.8-flash' });
const post = (body, origin = ORIGIN, env = envGemini()) => worker.fetch(new Request('https://worker.test/', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }), env);

test('route: extract_entities calls Gemini, not the Cloudflare AI binding, even when AI is bound', async () => {
  calls = [];
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ persons: ['محمد عبد الله'], organizations: ['وزارة الصحة المصرية'], places: ['القاهرة'] }) }));
  const r = await (await post({ mode: 'extract_entities', text: SRC })).json();
  assert.equal(calls.length, 1);
  assert.match(calls[0], /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-3\.8-flash:generateContent$/, 'Gemini endpoint with env model');
  assert.deepEqual(r.entities.persons, ['محمد عبد الله']);
  assert.deepEqual(r.entities.organizations, ['وزارة الصحة المصرية']);
  assert.deepEqual(r.entities.places, ['القاهرة']);
  assert.equal(r.provider, 'gemini');
});

test('route: names not present verbatim in the source are dropped (no invented entities)', async () => {
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ persons: ['محمد عبد الله', 'شخص مخترع غير موجود'], organizations: ['منظمة الصحة العالمية'], places: ['القاهرة'] }) }));
  const r = await (await post({ mode: 'extract_entities', text: SRC })).json();
  assert.deepEqual(r.entities.persons, ['محمد عبد الله'], 'hallucinated person dropped');
  assert.deepEqual(r.entities.organizations, [], 'org not in text dropped');
  assert.deepEqual(r.entities.places, ['القاهرة']);
});

test('route: duplicates collapse and Arabic-normalized variants match the source', async () => {
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ persons: ['محمد عبد الله', 'محمد عبد الله', 'محمد عبدالله'], organizations: [], places: [] }) }));
  const r = await (await post({ mode: 'extract_entities', text: SRC })).json();
  assert.deepEqual(r.entities.persons, ['محمد عبد الله'], 'exact duplicate and alef-variant duplicate collapse to one');
});

test('route: no providers configured -> entities null reason off, no external call', async () => {
  calls = [];
  mockGemini(async () => ({ ok: true, json: async () => ({}) }));
  const r = await (await post({ mode: 'extract_entities', text: SRC }, ORIGIN, {})).json();
  assert.deepEqual(r, { entities: null, reason: 'off', retry_after: null });
  assert.equal(calls.length, 0, 'no Gemini and no CF call when gated');
});

test('route: cloudflare pin uses Workers AI directly and returns provider provenance', async () => {
  calls = [];
  mockGemini(async () => { throw new Error('Gemini must not be called when pinned'); });
  const env = { AI: { run: async () => ({ response: JSON.stringify({ persons: ['محمد عبد الله'], organizations: [], places: [] }) }) }, CF_AI_MODEL: '@cf/qwen/qwen3-30b-a3b-fp8', AI_PROVIDER: 'cloudflare', GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-3.8-flash' };
  const r = await (await post({ mode: 'extract_entities', text: SRC }, ORIGIN, env)).json();
  assert.equal(calls.length, 0, 'zero Gemini calls under the cloudflare pin');
  assert.deepEqual(r.entities.persons, ['محمد عبد الله']);
  assert.equal(r.provider, 'workers-ai');
});

test('route: Gemini 429 falls back to Workers AI and reports the fallback provider', async () => {
  mockGemini(async () => ({ ok: false, status: 429, text: async () => 'quota', headers: { get: () => null } }));
  const env = { AI: { run: async () => ({ response: JSON.stringify({ persons: ['محمد عبد الله'], organizations: ['وزارة الصحة المصرية'], places: ['القاهرة'] }) }) }, CF_AI_MODEL: '@cf/qwen/qwen3-30b-a3b-fp8', AI_PROVIDER: 'gemini-first', GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-3.8-flash' };
  const r = await (await post({ mode: 'extract_entities', text: SRC }, ORIGIN, env)).json();
  assert.equal(r.provider, 'workers-ai');
  assert.deepEqual(r.entities.places, ['القاهرة']);
});

test('route: http error, unparseable output, and empty result fail closed with a reason', async () => {
  mockGemini(async () => ({ ok: false, status: 429 }));
  const r429 = await (await post({ mode: 'extract_entities', text: SRC }, ORIGIN, envGeminiOnly())).json();
  assert.deepEqual(r429, { entities: null, reason: 'http_429', retry_after: null });
  mockGemini(async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'ليس JSON' }] } }] }) }));
  const bad = await (await post({ mode: 'extract_entities', text: SRC })).json();
  assert.deepEqual(bad, { entities: null, reason: 'parse', retry_after: null });
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ persons: ['غير موجود إطلاقا'], organizations: [], places: [] }) }));
  const filt = await (await post({ mode: 'extract_entities', text: SRC })).json();
  assert.deepEqual(filt, { entities: null, reason: 'filtered', retry_after: null });
});

test('route: missing or too-short text -> reason empty', async () => {
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ persons: [], organizations: [], places: [] }) }));
  const noT = await (await post({ mode: 'extract_entities' })).json();
  assert.deepEqual(noT, { entities: null, reason: 'empty', retry_after: null });
  const short = await (await post({ mode: 'extract_entities', text: 'قصير' })).json();
  assert.deepEqual(short, { entities: null, reason: 'empty', retry_after: null });
});

test('route: origin/method/JSON guards apply to extract_entities', async () => {
  const bad = await post({ mode: 'extract_entities', text: SRC }, 'https://evil.example');
  assert.equal(bad.status, 403);
  const get = await worker.fetch(new Request('https://worker.test/', { method: 'GET', headers: { origin: ORIGIN } }), envGemini());
  assert.equal(get.status, 405);
  const malformed = await post('{not json');
  assert.equal(malformed.status, 400);
});
