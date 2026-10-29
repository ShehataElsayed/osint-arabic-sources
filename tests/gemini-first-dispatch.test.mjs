import test from 'node:test'; import assert from 'node:assert/strict';
import { recommend, plan } from '../worker/rag-lib.js';

// Provider-order regressions for the user-requested platform-wide Gemini link (2026-10-30):
// with AI_PROVIDER="gemini-first", generation tries Google Gemini first and falls back to
// Workers AI on any Gemini error; AI_PROVIDER="cloudflare" keeps the strict pin; embeddings
// are never switched off bge-m3 (covered by the semantic tests' provider pin assertions).

const CANDS = [{ id: 1, name: 'أداة', description: 'وصف' }];
const geminiOk = text => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) });

test('gemini-first: Gemini is called before the Workers AI binding', async () => {
  let aiCalled = false; const urls = [];
  const env = { AI_PROVIDER: 'gemini-first', CF_AI_MODEL: 'm', AI: { run: async () => { aiCalled = true; return { response: '{"picks":[]}' }; } }, GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-3.8-flash', _ledger: [] };
  const f = async url => { urls.push(String(url)); return geminiOk('{"picks":[{"id":1,"why":"لأنها تناسب","how":"هكذا"}]}'); };
  const r = await recommend('سؤال', CANDS, env, f);
  assert.equal(r[0].id, 1);
  assert.equal(aiCalled, false, 'Workers AI untouched when Gemini succeeds');
  assert.match(urls[0], /generativelanguage\.googleapis\.com/);
});

test('gemini-first: any Gemini error falls back to Workers AI, and the ledger records both', async () => {
  const env = { AI_PROVIDER: 'gemini-first', CF_AI_MODEL: 'm', AI: { run: async () => ({ response: '{"picks":[{"id":1,"why":"من كلاودفلير","how":"هكذا"}]}' }) }, GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-3.8-flash', _ledger: [] };
  const f = async () => ({ ok: false, status: 429 });
  const r = await recommend('سؤال', CANDS, env, f);
  assert.equal(r[0].why, 'من كلاودفلير', 'CF answer returned after Gemini 429');
  assert.deepEqual(env._ledger.map(x => x.status), ['http_429', 'cf_fallback_ok']);
});

test('gemini-first: Gemini network failure without a binding fails closed, no silent OpenRouter jump', async () => {
  const env = { AI_PROVIDER: 'gemini-first', GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-3.8-flash', OPENROUTER_API_KEY: 'k', OPENROUTER_MODEL: 'm' };
  const f = async () => { throw new Error('network down'); };
  const r = await recommend('سؤال', CANDS, env, f);
  assert.deepEqual(r, { error: 'neterr' });
});

test('cloudflare pin: Gemini key present but unreachable, Workers AI used (pin unchanged)', async () => {
  let aiCalled = false; let fetched = false;
  const env = { AI_PROVIDER: 'cloudflare', CF_AI_MODEL: 'm', AI: { run: async () => { aiCalled = true; return { response: '{"picks":[]}' }; } }, GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-3.8-flash' };
  const f = async () => { fetched = true; return geminiOk('{}'); };
  await recommend('سؤال', CANDS, env, f);
  assert.equal(aiCalled, true); assert.equal(fetched, false, 'external provider unreachable under the pin');
});

test('plan route: gemini-first uses chatText provider order (Gemini, then CF fallback)', async () => {
  const env = { AI_PROVIDER: 'gemini-first', CF_AI_MODEL: 'm', AI: { run: async () => ({ response: '{"kind":"topic","fields":{"topic":"السد"},"note":"فهمت"}' }) }, GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-3.8-flash' };
  const f = async () => ({ ok: false, status: 500 });
  const r = await plan('ابحث في موضوع السد', env, f);
  assert.equal(r.kind, 'topic', 'plan still parsed from the CF fallback response');
});
