import test from 'node:test'; import assert from 'node:assert/strict';
import worker from '../worker/rag-lib.js';

// Route-level tests for the extract_events dispatch. Every event must carry a quote that appears
// verbatim in the user's source text; dates must be ISO or null; failures close to
// { events: null, reason } without touching other routes.

const ORIGIN = 'https://shehataelsayed.github.io';
const SRC = 'في 15 يناير 2026 أعلنت الوزارة القرار. وبعد أسبوعين نشرت الجريدة التفاصيل. وفي 2026-03-01 بدأ التطبيق فعليًا.';
const geminiBody = obj => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] });

let calls = [];
const realFetch = globalThis.fetch;
const mockGemini = handler => { globalThis.fetch = async (url, init) => { calls.push(String(url)); return handler(String(url), init); }; };
test.after(() => { globalThis.fetch = realFetch; });

const envGemini = () => ({ AI: { run: async () => { throw new Error('CF must not be called'); } }, CF_AI_MODEL: '@cf/qwen/qwen3-30b-a3b-fp8', AI_PROVIDER: 'gemini-first', GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-3.8-flash' });
const post = (body, origin = ORIGIN, env = envGemini()) => worker.fetch(new Request('https://worker.test/', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }), env);

test('route: extract_events returns validated events backed by verbatim quotes', async () => {
  calls = [];
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ events: [
    { date: '2026-03-01', event: 'بدأ التطبيق الفعلي', quote: 'وفي 2026-03-01 بدأ التطبيق فعليًا.' },
    { date: null, event: 'نشر التفاصيل', quote: 'وبعد أسبوعين نشرت الجريدة التفاصيل.' },
  ] }) }));
  const r = await (await post({ mode: 'extract_events', text: SRC })).json();
  assert.equal(calls.length, 1);
  assert.match(calls[0], /^https:\/\/generativelanguage\.googleapis\.com\//);
  assert.equal(r.events.length, 2);
  assert.equal(r.events[0].date, '2026-03-01');
  assert.equal(r.events[1].date, null, 'relative-only phrasing stays undated');
});

test('route: events whose quote is not in the source are dropped', async () => {
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ events: [
    { date: '2026-03-01', event: 'حدث حقيقي', quote: 'وفي 2026-03-01 بدأ التطبيق فعليًا.' },
    { date: '2020-01-01', event: 'حدث مخترع', quote: 'جملة غير موجودة في النص الأصلي إطلاقًا.' },
    { date: null, event: 'بدون اقتباس', quote: '' },
  ] }) }));
  const r = await (await post({ mode: 'extract_events', text: SRC })).json();
  assert.equal(r.events.length, 1);
  assert.equal(r.events[0].event, 'حدث حقيقي');
});

test('route: malformed dates become null and duplicates collapse', async () => {
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ events: [
    { date: '15/01/2026', event: 'صيغة غير ISO', quote: 'في 15 يناير 2026 أعلنت الوزارة القرار.' },
    { date: '2026-03-01', event: 'أ', quote: 'وفي 2026-03-01 بدأ التطبيق فعليًا.' },
    { date: '2026-03-01', event: 'أ', quote: 'وفي 2026-03-01 بدأ التطبيق فعليًا.' },
  ] }) }));
  const r = await (await post({ mode: 'extract_events', text: SRC })).json();
  assert.equal(r.events.length, 2);
  assert.equal(r.events[0].date, null, 'non-ISO date nulled, event kept');
});

test('route: gating, http error, parse failure, and empty result fail closed', async () => {
  calls = [];
  mockGemini(async () => ({ ok: true, json: async () => ({}) }));
  const pinned = { AI: { run: async () => ({}) }, CF_AI_MODEL: '@cf/qwen/qwen3-30b-a3b-fp8', AI_PROVIDER: 'cloudflare', GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-3.8-flash' };
  const off = await (await post({ mode: 'extract_events', text: SRC }, ORIGIN, pinned)).json();
  assert.deepEqual(off, { events: null, reason: 'off', retry_after: null });
  assert.equal(calls.length, 0);
  mockGemini(async () => ({ ok: false, status: 429 }));
  assert.deepEqual(await (await post({ mode: 'extract_events', text: SRC })).json(), { events: null, reason: 'http_429', retry_after: null });
  mockGemini(async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'ليس JSON' }] } }] }) }));
  assert.deepEqual(await (await post({ mode: 'extract_events', text: SRC })).json(), { events: null, reason: 'parse', retry_after: null });
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ events: [] }) }));
  assert.deepEqual(await (await post({ mode: 'extract_events', text: SRC })).json(), { events: null, reason: 'filtered', retry_after: null });
  assert.deepEqual(await (await post({ mode: 'extract_events', text: 'قصير' })).json(), { events: null, reason: 'empty', retry_after: null });
});

test('route: origin/method/JSON guards apply to extract_events', async () => {
  const bad = await post({ mode: 'extract_events', text: SRC }, 'https://evil.example');
  assert.equal(bad.status, 403);
  const get = await worker.fetch(new Request('https://worker.test/', { method: 'GET', headers: { origin: ORIGIN } }), envGemini());
  assert.equal(get.status, 405);
  const malformed = await post('{not json');
  assert.equal(malformed.status, 400);
});

test('route: ISO date requires exact correspondence with the anchoring raw expression', async () => {
  mockGemini(async () => ({ ok: true, json: async () => geminiBody({ events: [
    { date: '2026-01-15', date_raw: '15 يناير 2026', event: 'إعلان القرار', quote: 'في 15 يناير 2026 أعلنت الوزارة القرار.' },
    { date: '2026-11-29', date_raw: '29 أكتوبر 2026', event: 'شهر خاطئ', quote: 'في 15 يناير 2026 أعلنت الوزارة القرار.' },
    { date: '2026-03-01', date_raw: '3 يناير 2026', event: 'يوم وشهر متبادلان', quote: 'في 15 يناير 2026 أعلنت الوزارة القرار.' },
    { date: '2026-02-15', date_raw: 'بعد أسبوعين', event: 'عبارة نسبية', quote: 'وبعد أسبوعين نشرت الجريدة التفاصيل.' },
    { date: '2026-03-01', date_raw: '1 مارس 2026', event: 'عبارة غير واردة حرفيًا', quote: 'وفي 2026-03-01 بدأ التطبيق فعليًا.' },
    { date: '2026-03-01', date_raw: '2026-03-01', event: 'ISO حرفي في المصدر', quote: 'وفي 2026-03-01 بدأ التطبيق فعليًا.' },
  ] }) }));
  const r = await (await post({ mode: 'extract_events', text: SRC })).json();
  const byEvent = Object.fromEntries(r.events.map(e => [e.event, e]));
  assert.equal(byEvent['إعلان القرار'].date, '2026-01-15', 'exact day/month/year match: kept');
  assert.equal(byEvent['إعلان القرار'].date_raw, '15 يناير 2026', 'raw expression preserved');
  assert.equal(byEvent['شهر خاطئ'].date, null, 'raw says October, ISO says November: nulled');
  assert.equal(byEvent['شهر خاطئ'].date_raw, null, 'raw expression not in source: dropped');
  assert.equal(byEvent['يوم وشهر متبادلان'].date, null, '3 January vs March 1: nulled');
  assert.equal(byEvent['عبارة نسبية'].date, null, 'relative expression cannot ground an ISO date');
  assert.equal(byEvent['عبارة نسبية'].date_raw, 'بعد أسبوعين', 'raw relative text preserved for the reviewer');
  assert.equal(byEvent['عبارة غير واردة حرفيًا'].date_raw, null, 'raw not verbatim in source: dropped');
  assert.equal(byEvent['عبارة غير واردة حرفيًا'].date, '2026-03-01', 'ISO literal present in the source still grounds');
  assert.equal(byEvent['ISO حرفي في المصدر'].date, '2026-03-01');
});

test('route: 429 passes the provider Retry-After through for honest backoff', async () => {
  mockGemini(async () => ({ ok: false, status: 429, headers: { get: h => h === 'retry-after' ? '37' : null } }));
  const r = await (await post({ mode: 'extract_events', text: SRC })).json();
  assert.equal(r.reason, 'http_429');
  assert.equal(r.retry_after, 37);
});

test('route: origin/method/JSON guards apply to extract_events', async () => {
  const bad = await post({ mode: 'extract_events', text: SRC }, 'https://evil.example');
  assert.equal(bad.status, 403);
  const get = await worker.fetch(new Request('https://worker.test/', { method: 'GET', headers: { origin: ORIGIN } }), envGemini());
  assert.equal(get.status, 405);
  const malformed = await post('{not json');
  assert.equal(malformed.status, 400);
});
