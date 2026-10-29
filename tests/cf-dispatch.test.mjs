// Cloudflare Workers AI dispatch: production pins AI_PROVIDER=cloudflare so external providers are
// unreachable, Workers AI response shapes parse, quota errors surface as 'busy', and over-limit
// input is refused explicitly instead of silently truncated.
import test from 'node:test';
import assert from 'node:assert/strict';
import { recommend, plan, ragAsk } from '../worker/rag-lib.js';

const cands = [{ id: 1, name: 'Google Lens', description: 'بحث عكسي عن الصور' }, { id: 2, name: 'InVID', description: 'تفكيك الفيديو' }];
const srcs = [{ id: 'a1', title: 'بيان', url: 'https://example.gov/1', publisher: 'جهة', published_at: '2026-03-14', text: 'أعلنت الوزارة إطلاق 320 برج اتصالات بتكلفة 1.7 مليار جنيه.' }];
const noFetch = async () => { throw new Error('external fetch must be unreachable'); };
const cfEnv = (run) => ({ AI_PROVIDER: 'cloudflare', CF_AI_MODEL: 'm', CF_AI_EMBED_MODEL: 'e', AI: { run } });
const chatShape = (text) => ({ choices: [{ message: { content: text } }] });

test('CF binding answers recommend without any external fetch', async () => {
  let calls = 0;
  const env = cfEnv(async (model, input) => { calls++; return chatShape('{"picks":[{"id":1,"why":"مناسب","how":"ارفع الصورة"}]}'); });
  const r = await recommend('أداة بحث عكسي', cands, env, noFetch);
  assert.ok(Array.isArray(r) && r[0].id === 1);
  assert.equal(calls, 1);
});

test('Workers AI parsed-object response shape parses as JSON', async () => {
  const env = cfEnv(async () => ({ response: { picks: [{ id: 2, why: 'يفكك الفيديو', how: 'ارفع الرابط' }] } }));
  const r = await recommend('تحليل فيديو', cands, env, noFetch);
  assert.ok(Array.isArray(r) && r[0].id === 2);
});

test('AI_PROVIDER=cloudflare with external keys but no binding: off, never falls back', async () => {
  const env = { AI_PROVIDER: 'cloudflare', GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm', OPENROUTER_API_KEY: 'k', OPENROUTER_MODEL: 'm' };
  assert.equal(await recommend('سؤال', cands, env, noFetch), null);
  assert.deepEqual(await plan('نص', env, noFetch), { error: 'off' });
});

test('without AI_PROVIDER, external keys remain reachable for local dev', async () => {
  let hit = false;
  const f = async () => { hit = true; return { ok: true, json: async () => ({ choices: [{ message: { content: '{"picks":[{"id":1,"why":"أ","how":"ب"}]}' } }] }) }; };
  const r = await recommend('سؤال', cands, { OPENROUTER_API_KEY: 'k', OPENROUTER_MODEL: 'm' }, f);
  assert.ok(hit && Array.isArray(r));
});

test('quota-like binding error surfaces as busy', async () => {
  const env = cfEnv(async () => { throw new Error('Error 5033: daily neurons limit exceeded'); });
  const r = await plan('نص', env, noFetch);
  assert.equal(r.error, 'busy');
});

test('empty completion degrades to upstream, not a fake answer', async () => {
  const env = cfEnv(async () => ({ choices: [{ message: { content: null, reasoning_content: '...' } }] }));
  const r = await plan('نص', env, noFetch);
  assert.equal(r.error, 'upstream');
});

test('over-limit question is refused explicitly, never silently truncated', async () => {
  const env = cfEnv(async () => chatShape('x'));
  const r = await ragAsk('م'.repeat(500), srcs, {}, env, noFetch);
  assert.equal(r.error, 'too_long');
});

test('in-limit question still processes through CF embeddings and chat', async () => {
  const env = cfEnv(async (model, input) => {
    if (input.text) return { data: input.text.map(() => Array(8).fill(0.1)) };
    return chatShape('الإجابة: 320 برجًا [E1].');
  });
  const r = await ragAsk('كم عدد الأبراج؟', srcs, {}, env, noFetch);
  assert.equal(r.decision, 'answer');
  assert.ok(r.generated);
});
