import test from 'node:test'; import assert from 'node:assert/strict';
import { semanticCatalog } from '../worker/rag-lib.js';

// Cold isolate, asset unreachable: the worker must report catalog_unavailable (client then
// falls back to the 12-candidate path). Separate file because the per-isolate asset cache is
// process-global and a warm cache would skip the fetch.
test('worker semanticCatalog: asset unreachable on cold isolate -> catalog_unavailable', async () => {
  const env = { AI: { run: async () => ({ data: [[1, 0, 0, 0]] }) }, CF_AI_EMBED_MODEL: '@cf/baai/bge-m3', AI_PROVIDER: 'cloudflare' };
  const down = async () => ({ ok: false });
  assert.equal((await semanticCatalog('استعلام', 'fp-x', env, down)).error, 'catalog_unavailable');
});
