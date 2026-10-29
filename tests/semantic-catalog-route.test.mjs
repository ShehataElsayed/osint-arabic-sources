import test from 'node:test'; import assert from 'node:assert/strict';
import worker from '../worker/rag-lib.js';

// Route-level regressions for the semantic_catalog dispatch in worker/rag-lib.js's default
// fetch handler. Function-level guards live in tests/semantic-catalog.test.mjs; this file
// covers the HTTP route itself (the q-alias line shipped in 847c694 had no CI coverage).
// The per-isolate catalogue cache is process-global, so all cases here share one manifest.

const ORIGIN = 'https://shehataelsayed.github.io';
const DIMS = 4;
const cat = await (async () => {
  const vecs = [[0, 1, 0, 0], [1, 0, 0, 0], [0, 0, 1, 0]];
  const scales = new Float32Array(vecs.map(v => Math.max(...v.map(Math.abs)) / 127 || 1));
  const data = new Int8Array(vecs.length * DIMS);
  vecs.forEach((v, i) => v.forEach((x, j) => { data[i * DIMS + j] = Math.round(x / scales[i]); }));
  const buf = new ArrayBuffer(vecs.length * 4 + data.length);
  new Float32Array(buf, 0, vecs.length).set(scales);
  new Int8Array(buf, vecs.length * 4).set(data);
  const d = await crypto.subtle.digest('SHA-256', buf.slice(0));
  const sha = [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
  return { manifest: { format: 'int8-symmetric-per-vector', count: vecs.length, dims: DIMS, fingerprint: 'fp-route', bin_sha256: sha }, bin: buf };
})();

const realFetch = globalThis.fetch;
globalThis.fetch = async url => String(url).endsWith('.json')
  ? { ok: true, json: async () => cat.manifest }
  : { ok: true, arrayBuffer: async () => cat.bin };
test.after(() => { globalThis.fetch = realFetch; });

let aiCalls = [];
const env = qv => ({ AI: { run: async (model, input) => { aiCalls.push({ model, input }); return { data: [qv] }; } }, CF_AI_EMBED_MODEL: '@cf/baai/bge-m3', AI_PROVIDER: 'cloudflare' });
const post = (body, origin = ORIGIN) => worker.fetch(new Request('https://worker.test/', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }), env([1, 0, 0, 0]));

test('route: rejects wrong origin, non-POST, and malformed JSON', async () => {
  const bad = await post({ mode: 'semantic_catalog', q: 'س' }, 'https://evil.example');
  assert.equal(bad.status, 403); assert.equal((await bad.json()).error, 'origin');
  const get = await worker.fetch(new Request('https://worker.test/', { method: 'GET', headers: { origin: ORIGIN } }), env([1, 0, 0, 0]));
  assert.equal(get.status, 405);
  const malformed = await post('{not json');
  assert.equal(malformed.status, 400); assert.equal((await malformed.json()).error, 'json');
});

test('route: semantic_catalog accepts q (847c694 alias) and query identically', async () => {
  const viaQ = await (await post({ mode: 'semantic_catalog', q: 'استعلام', fingerprint: 'fp-route', ids: [0, 2] })).json();
  const viaQuery = await (await post({ mode: 'semantic_catalog', query: 'استعلام', fingerprint: 'fp-route', ids: [0, 2] })).json();
  for (const r of [viaQ, viaQuery]) {
    assert.equal(r.count, 3); assert.equal(r.fingerprint, 'fp-route');
    assert.equal(r.ranking[0].i, 1, 'nearest vector first');
    assert.deepEqual(Object.keys(r.scores).sort(), ['0', '2'], 'exact scores for requested candidate ids');
  }
  assert.deepEqual(viaQ, viaQuery, 'q and query are byte-identical aliases');
});

test('route: q wins when both q and query are present (b.q ?? b.query)', async () => {
  aiCalls = [];
  await post({ mode: 'semantic_catalog', q: 'من q', query: 'من query', fingerprint: 'fp-route' });
  assert.deepEqual(aiCalls.at(-1).input.text, ['من q']);
});

test('route: fingerprint mismatch fails closed with the actual fingerprint', async () => {
  const r = await (await post({ mode: 'semantic_catalog', q: 'س', fingerprint: 'wrong' })).json();
  assert.equal(r.error, 'catalog_mismatch'); assert.equal(r.fingerprint, 'fp-route');
});

test('route: embedding dims mismatch is an explicit error, never a silent trim', async () => {
  const r = await worker.fetch(new Request('https://worker.test/', { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'semantic_catalog', q: 'س', fingerprint: 'fp-route' }) }), env([1, 0]));
  assert.equal((await r.json()).error, 'dims_mismatch');
});

test('route: embedding provider is pinned to env.CF_AI_EMBED_MODEL', async () => {
  aiCalls = [];
  await post({ mode: 'semantic_catalog', q: 'دبابة', fingerprint: 'fp-route' });
  assert.equal(aiCalls.at(-1).model, '@cf/baai/bge-m3');
});

test('route: no embedding provider -> off; missing q and query -> bad_request', async () => {
  const noProv = await worker.fetch(new Request('https://worker.test/', { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'semantic_catalog', q: 'س', fingerprint: 'fp-route' }) }), {});
  assert.equal((await noProv.json()).error, 'off');
  const empty = await (await post({ mode: 'semantic_catalog', fingerprint: 'fp-route' })).json();
  assert.equal(empty.error, 'bad_request');
});
