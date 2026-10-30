import test from 'node:test';
import assert from 'node:assert/strict';
import { researchPlan, embedTexts } from '../worker/rag-lib.js';

// A Response whose body reports cancellation - stands in for a provider error page.
function trackable429() {
  const state = { cancelled: false, read: false };
  const stream = new ReadableStream({
    start(c) { c.enqueue(new TextEncoder().encode('{"error":{"message":"Quota exceeded for generate_requests_per_model_per_day"}}')); c.close(); },
    cancel() { state.cancelled = true; },
  });
  const res = new Response(stream, { status: 429, statusText: 'Too Many Requests' });
  return { res, state };
}

test('researchPlan consumes/cancels the error body before returning http_429', async () => {
  const { res, state } = trackable429();
  const out = await researchPlan('سؤال تجريبي', [{ id: 1, name: 'أداة', description: 'وصف' }], { GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm', AI_PROVIDER: 'gemini-first' }, async () => res);
  assert.equal(out.error, 'http_429');
  // body.cancel() OR a full text() read both release the resource. The shared provider path reads
  // the body (server-side quota diagnostics), so assert the body is fully used either way.
  assert.equal(state.cancelled || res.bodyUsed, true);
});

test('embedTexts cancels the provider error body', async () => {
  const { res, state } = trackable429();
  const out = await embedTexts(['نص'], { GEMINI_API_KEY: 'k', GEMINI_EMBED_MODEL: 'm', AI_PROVIDER: 'gemini-first' }, async () => res);
  assert.equal(out, null);
  assert.equal(state.cancelled, true);
});

test('successful path unchanged: researchPlan still parses a good plan', async () => {
  const ok = new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"intro":"خطة","steps":[{"tool_id":1,"goal":"هدف","how":"كيف"}],"limits":"حدود"}' }] } }] }), { status: 200 });
  const out = await researchPlan('سؤال', [{ id: 1, name: 'أداة', description: 'وصف' }], { GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm', AI_PROVIDER: 'gemini-first' }, async () => ok);
  assert.equal(out.steps.length, 1);
  assert.equal(out.steps[0].tool_id, 1);
});
