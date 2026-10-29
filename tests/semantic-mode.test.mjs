// Smart-search semantic rerank on Cloudflare Workers AI (bge-m3): one query + candidate texts ->
// one cosine score per candidate, in order. Bounded inputs, no external fetch, no paid fallback.
import test from 'node:test';
import assert from 'node:assert/strict';
import { semanticScores } from '../worker/rag-lib.js';

const vec = (n, hot) => Array.from({ length: n }, (_, i) => (i === hot ? 1 : 0));
const cfEnv = (run) => ({ AI_PROVIDER: 'cloudflare', CF_AI_MODEL: 'm', CF_AI_EMBED_MODEL: 'e', AI: { run } });
const noFetch = async () => { throw new Error('external fetch must be unreachable'); };

test('returns one score per candidate, in input order, via the CF embedding binding', async () => {
  let calls = 0;
  // query matches candidate 2 (shared hot dimension), not candidate 1
  const env = cfEnv(async (model, input) => {
    calls++;
    assert.equal(model, 'e');
    return { data: [vec(4, 0), vec(4, 1), vec(4, 0)] };
  });
  const r = await semanticScores('بحث عكسي', [{ text: 'أداة أ' }, { text: 'أداة ب' }], env);
  assert.equal(calls, 1);
  assert.deepEqual(r, { scores: [0, 1] });
});

test('AI_PROVIDER=cloudflare without the binding: off, never an external fallback', async () => {
  const env = { AI_PROVIDER: 'cloudflare', GEMINI_API_KEY: 'k', GEMINI_EMBED_MODEL: 'g' };
  assert.deepEqual(await semanticScores('سؤال', [{ text: 'أ' }], env), { error: 'off' });
});

test('empty query or candidates: explicit bad_request, no model call', async () => {
  let calls = 0;
  const env = cfEnv(async () => { calls++; return { data: [] }; });
  assert.deepEqual(await semanticScores('', [{ text: 'أ' }], env), { error: 'bad_request' });
  assert.deepEqual(await semanticScores('سؤال', [], env), { error: 'bad_request' });
  assert.equal(calls, 0);
});

test('embedding failure or malformed shape: upstream, never throws', async () => {
  const throwing = cfEnv(async () => { throw new Error('capacity'); });
  assert.deepEqual(await semanticScores('سؤال', [{ text: 'أ' }], throwing), { error: 'upstream' });
  const bad = cfEnv(async () => ({ data: [vec(4, 0)] })); // fewer vectors than inputs
  assert.deepEqual(await semanticScores('سؤال', [{ text: 'أ' }, { text: 'ب' }], bad), { error: 'upstream' });
});

test('inputs are bounded: 12 candidates max, texts truncated', async () => {
  let seen = null;
  const env = cfEnv(async (model, input) => { seen = input.text; return { data: input.text.map(() => vec(4, 0)) }; });
  const many = Array.from({ length: 20 }, (_, i) => ({ text: 'x'.repeat(1500) + i }));
  const r = await semanticScores('س'.repeat(500), many, env);
  assert.equal(seen.length, 13); // 1 query + 12 candidates
  assert.ok(seen.every(t => t.length <= 1000));
  assert.equal(r.scores.length, 12);
});
