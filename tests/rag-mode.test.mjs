import test from 'node:test'; import assert from 'node:assert/strict';
import { cleanRagSources, chunkText, ragRetrieve, ragAsk, ragTokens } from '../worker/rag-worker.js';

const SRC = [
  { id: '1', title: 'بيان رسمي', publisher: 'جهة', url: 'https://example.org/a', published_at: '2026-09-10', text: 'بدأ برنامج تجريبي محدود في سبتمبر. لم يُعلن عن إطلاق عام للخدمة.' },
  { id: '2', title: 'تقرير مناخ', publisher: 'مركز', url: 'https://example.net/b', published_at: '', text: 'ارتفعت درجات الحرارة في تقرير المناخ السنوي عن معدلاتها.' },
];

test('cleanRagSources: trims, validates url/date, requires title+text', () => {
  const s = cleanRagSources([...SRC, { id: '3', title: '', text: 'x' }, { id: '4', title: 't', text: '  ' }, { title: 'بدون معرف', url: 'javascript:alert(1)', text: 'نص كافٍ هنا' }]);
  assert.equal(s.length, 3);
  assert.equal(s[2].id, 'S5'); assert.equal(s[2].url, '');
  assert.equal(s[1].published_at, '');
});

test('chunkText: exact offsets, no loss', () => {
  const text = 'كلمة '.repeat(500).trim();
  const chunks = chunkText(text);
  assert.ok(chunks.length > 1);
  for (const c of chunks) assert.equal(text.slice(c.start, c.end), c.text);
});

test('ragRetrieve: lexical works without key; relevant chunk ranks first', async () => {
  const sources = cleanRagSources(SRC);
  const chunks = sources.flatMap(s => chunkText(s.text).map(c => ({ source: s, ...c, tokens: ragTokens(c.text) })));
  const ranked = await ragRetrieve('إطلاق عام للخدمة', chunks, {}, async () => { throw new Error('no fetch expected'); });
  assert.equal(ranked[0].source.id, '1');
});

test('ragAsk: no sources / no key paths are honest', async () => {
  assert.deepEqual(await ragAsk('', SRC, {}, {}), { error: 'empty' });
  assert.deepEqual(await ragAsk('س', [], {}, {}), { error: 'no_sources' });
  const r = await ragAsk('إطلاق عام للخدمة', SRC, {}, {});
  assert.equal(r.decision, 'retrieve_only'); assert.equal(r.generated, false); assert.ok(r.evidence.length > 0);
});

test('ragAsk: date filters exclude unknown dates', async () => {
  const r = await ragAsk('درجات الحرارة', SRC, { after: '2026-01-01' }, {});
  assert.ok(r.evidence.every(e => e.source_id !== '2'));
});

test('ragAsk: abstains on no match', async () => {
  const r = await ragAsk('كرة القدم الأوروبية تماما بعيد', SRC, {}, {});
  assert.equal(r.decision, 'abstain');
});

const geminiFetch = answer => async (url, o) => {
  if (url.includes('batchEmbedContents')) { const n = JSON.parse(o.body).requests.length; return { ok: true, json: async () => ({ embeddings: Array.from({ length: n }, () => ({ values: [1, 0] })) }) }; }
  return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: answer }] } }] }) };
};
const env = { GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm' };

test('ragAsk: generates with valid citations and flags unknown ones', async () => {
  const ok = await ragAsk('ما الذي أُعلن؟', SRC, {}, env, geminiFetch('بدأ برنامج تجريبي في سبتمبر [E1].'));
  assert.equal(ok.decision, 'answer'); assert.equal(ok.generated, true);
  assert.deepEqual(ok.cited, ['E1']); assert.equal(ok.citation_refs_valid, true);
  const bad = await ragAsk('ما الذي أُعلن؟', SRC, {}, env, geminiFetch('بحسب [E9] لم يُعلن شيء.'));
  assert.equal(bad.citation_refs_valid, false);
  assert.ok(bad.warnings.some(w => w.includes('E9')));
  const nocite = await ragAsk('ما الذي أُعلن؟', SRC, {}, env, geminiFetch('إجابة بلا إحالات.'));
  assert.ok(nocite.warnings.some(w => w.includes('لا إحالات')));
});

test('ragAsk: upstream failure returns evidence with error', async () => {
  const r = await ragAsk('إطلاق عام للخدمة', SRC, {}, env, async () => ({ ok: false, status: 500 }));
  assert.equal(r.error, 'upstream'); assert.ok(r.evidence.length > 0);
  const busy = await ragAsk('إطلاق عام للخدمة', SRC, {}, env, async () => ({ ok: false, status: 429 }));
  assert.equal(busy.error, 'busy');
});

test('ragAsk: semantic path uses embeddings when key present', async () => {
  let embedded = 0;
  const f = async (url, o) => { if (url.includes('batchEmbedContents')) { embedded++; const n = JSON.parse(o.body).requests.length; return { ok: true, json: async () => ({ embeddings: Array.from({ length: n }, () => ({ values: [1, 0] })) }) }; } return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'بدأ البرنامج [E1].' }] } }] }) }; };
  const r = await ragAsk('ما الذي أُعلن؟', SRC, {}, env, f);
  assert.equal(embedded, 1); assert.equal(r.decision, 'answer');
});
