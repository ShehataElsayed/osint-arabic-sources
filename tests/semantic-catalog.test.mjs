import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import crypto from 'node:crypto';
import { fuseSemanticCatalog, SEM_CATALOG_FLOOR } from '../site/tool-search.js';
import { semanticCatalog } from '../worker/rag-lib.js';

// --- fuseSemanticCatalog (client RRF blend of lexical candidates + full-catalogue semantic ranking) ---
const T = id => ({ id, name: 'tool-' + id, description: 'd', url: 'https://x.example/' + id });

test('fuseSemanticCatalog: semantic-only tools surface, lexical leader not buried', () => {
  const lex = [{ t: T(1), id: 1 }, { t: T(2), id: 2 }];
  const sem = [{ id: 9, s: 0.7, t: T(9) }, { id: 2, s: 0.6, t: T(2) }];
  const fused = fuseSemanticCatalog(lex, sem);
  const ids = fused.map(x => x.id);
  assert.ok(ids.includes(9), 'semantic-only tool must appear');
  assert.equal(ids[0], 2, 'tool present in both lists wins RRF');
  // rank-1 lexical (1/61) and rank-1 semantic-only (1/61) tie; both are shown, scope-gating applies on top
  assert.ok(Math.abs(fused.find(x => x.id === 1).rrf - fused.find(x => x.id === 9).rrf) < 1e-9);
});

test('fuseSemanticCatalog: empty inputs', () => {
  assert.deepEqual(fuseSemanticCatalog([], []), []);
  assert.equal(fuseSemanticCatalog([{ t: T(3), id: 3 }], [])[0].id, 3);
  assert.equal(fuseSemanticCatalog([], [{ id: 4, s: 0.5, t: T(4) }])[0].id, 4);
});

test('SEM_CATALOG_FLOOR sits between observed OOS and in-scope tops (small-sample, see ai-evaluation.md)', () => {
  assert.ok(SEM_CATALOG_FLOOR > 0.457 && SEM_CATALOG_FLOOR < 0.553);
});

// --- worker semanticCatalog route (mocked asset fetch + Workers AI embedding) ---
async function tinyCatalog() {
  // 3 tools, dims 4. Tool 2 is nearest to the query vector [1,0,0,0].
  const dims = 4, vecs = [[0, 1, 0, 0], [1, 0, 0, 0], [0, 0, 1, 0]];
  const scales = new Float32Array(vecs.map(v => Math.max(...v.map(Math.abs)) / 127 || 1));
  const data = new Int8Array(vecs.length * dims);
  vecs.forEach((v, i) => v.forEach((x, j) => { data[i * dims + j] = Math.round(x / scales[i]); }));
  const buf = new ArrayBuffer(vecs.length * 4 + data.length);
  new Float32Array(buf, 0, vecs.length).set(scales);
  new Int8Array(buf, vecs.length * 4).set(data);
  return { manifest: { format: 'int8-symmetric-per-vector', count: vecs.length, dims, fingerprint: 'fp-test', bin_sha256: await shax(buf) }, bin: buf };
}
async function shax(buf) {
  const d = await crypto.subtle.digest('SHA-256', buf.slice(0));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function mockEnv(qv) {
  return { AI: { run: async () => ({ data: [qv] }) }, CF_AI_EMBED_MODEL: '@cf/baai/bge-m3', AI_PROVIDER: 'cloudflare' };
}
function mockFetch(cat) {
  return async url => url.endsWith('.json')
    ? { ok: true, json: async () => cat.manifest }
    : { ok: true, arrayBuffer: async () => cat.bin };
}

test('worker semanticCatalog ranks the whole catalogue server-side', async () => {
  const cat = await tinyCatalog();
  const r = await semanticCatalog('استعلام', 'fp-test', mockEnv([1, 0, 0, 0]), mockFetch(cat));
  assert.equal(r.count, 3); assert.equal(r.fingerprint, 'fp-test');
  assert.equal(r.ranking[0].i, 1, 'nearest vector first');
  assert.ok(r.ranking[0].s > r.ranking[1].s);
});

test('worker semanticCatalog guards: mismatch, off, bad_request, dims', async () => {
  const cat = await tinyCatalog();
  assert.equal((await semanticCatalog('س', 'other-fp', mockEnv([1, 0, 0, 0]), mockFetch(cat))).error, 'catalog_mismatch');
  assert.equal((await semanticCatalog('س', 'fp-test', {}, mockFetch(cat))).error, 'off');
  assert.equal((await semanticCatalog('', 'fp-test', mockEnv([1, 0, 0, 0]), mockFetch(cat))).error, 'bad_request');
  assert.equal((await semanticCatalog('س', 'fp-test', mockEnv([1, 0]), mockFetch(cat))).error, 'dims_mismatch');
  // catalog_unavailable (asset fetch failing on a cold isolate) is covered in
  // tests/semantic-catalog-cold.test.mjs - the per-isolate asset cache is process-global,
  // so it needs its own test process.
});

// --- asset integrity: the committed embedding asset must match the built catalogue ---
// CI builds _site before npm test, so this fails the deploy if the catalogue changed
// without regenerating site/tool-embeddings.* (scripts/build_embeddings.py).
test('committed embedding asset matches the built catalogue (fingerprint + size)', () => {
  const manifest = JSON.parse(fs.readFileSync('site/tool-embeddings.json', 'utf8'));
  const built = fs.readFileSync('_site/search-tools.json');
  const fp = crypto.createHash('sha256').update(built).digest('hex').slice(0, 16);
  assert.equal(manifest.fingerprint, fp, 'catalogue changed - rerun scripts/build_embeddings.py');
  const n = JSON.parse(built).length;
  assert.equal(manifest.count, n);
  const bin = fs.readFileSync('site/tool-embeddings.bin');
  assert.equal(bin.length, manifest.count * 4 + manifest.count * manifest.dims);
  assert.equal(crypto.createHash('sha256').update(bin).digest('hex'), manifest.bin_sha256, 'bin drifted from manifest');
});
