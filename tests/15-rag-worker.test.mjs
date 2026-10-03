import test from 'node:test'; import assert from 'node:assert/strict';
import { answer, denied, factCheck } from '../worker/rag-worker.js';
const f = async () => ({ ok: true, json: async () => ({ claims: [{ text: 'ادعاء', claimReview: [{ publisher: { name: 'ناشر' }, url: 'https://misbar.com/a', textualRating: 'مضلل', title: 't' }] }] }) });

test('fact-check results are link_only', async () => { const r = await answer('خبز', { FACTCHECK_API_KEY: 'k' }, f); assert.equal(r.results.length, 1); assert.equal(r.results[0].fetch, 'link_only'); assert.ok(r.results.every(x => x.source === 'factcheck')); });
test('no key -> no calls, flagged, empty', async () => { const r = await answer('خبز', {}, f); assert.equal(r.factcheck_enabled, false); assert.equal(r.results.length, 0); });
test('deny-list', () => { assert.ok(denied('https://www.misbar.com/x')); assert.ok(denied('https://factuel.afp.com/x')); assert.ok(denied('not a url')); });
test('factCheck sends key only to google endpoint', async () => { let u; await factCheck('q', 'KEY', async x => { u = x; return { ok: false }; }); assert.ok(u.startsWith('https://factchecktools.googleapis.com/')); });
import { keywords } from '../worker/rag-worker.js';
test('keywords drop question words', () => { assert.equal(keywords('من فاز بكأس العالم 2022؟'), 'فاز بكأس العالم 2022'); assert.equal(keywords('هل لم تفز الأرجنتين بكأس العالم 2022؟'), 'تفز الأرجنتين بكأس العالم 2022'); });

import { compose } from '../worker/rag-worker.js';
test('compose: off without key, rejects links and unsupported verdicts', async () => { assert.equal(await compose('س', [], 'answer', {}), null); const env = { GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm' }; const mk = t => async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: t }] } }] }) }); assert.equal(await compose('س', [{ rating: 'مضلل', count: 1 }], 'answer', env, mk('الحكم السائد مضلل.')), 'الحكم السائد مضلل.'); assert.equal(await compose('س', [{ rating: 'مضلل', count: 1 }], 'answer', env, mk('الخبر كاذب')), null); assert.equal(await compose('س', [], 'answer', env, mk('انظر https://x.com')), null); });
