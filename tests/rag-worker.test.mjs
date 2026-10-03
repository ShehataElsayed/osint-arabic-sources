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

import { recommend } from '../worker/rag-worker.js';
test('recommend: only candidate ids, no links, off without key', async () => {
  const cs = [{ id: 1, name: 'أداة أ', description: 'وصف' }, { id: 2, name: 'أداة ب', description: 'وصف' }];
  assert.equal(await recommend('س', cs, {}), null);
  const env = { GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm' };
  const mk = o => async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(o) }] } }] }) });
  const r = await recommend('س', cs, env, mk({ picks: [{ id: 1, why: 'ي', how: 'خ' }, { id: 99, why: 'x', how: 'y' }, { id: 2, why: 'see https://evil.example', how: 'y' }, { id: 1, why: 'dup', how: 'dup' }] }));
  assert.deepEqual(r, [{ id: 1, why: 'ي', how: 'خ' }]);
  assert.deepEqual(await recommend('س', cs, env, mk({ picks: [{ id: 99, why: 'x', how: 'y' }] })), { error: 'filtered' });
});

import { plan, cleanPlan } from '../worker/rag-worker.js';
test('plan: whitelisted kind and fields, no links, dates validated', async () => {
  assert.equal(cleanPlan({ kind: 'hack', fields: {} }), null);
  const c = cleanPlan({ kind: 'person', fields: { name: 'سمير', city: 'http://x.io', from: '2020-01-01', to: 'غدا', evil: 'x' }, note: 'فهمت' });
  assert.deepEqual(c, { kind: 'person', fields: { name: 'سمير', from: '2020-01-01' }, note: 'فهمت' });
  assert.equal(cleanPlan({ kind: 'topic', fields: { topic: 'قمح' }, note: 'see https://a.b' }), null);
  assert.deepEqual(await plan('نص', {}), { error: 'off' });
});

import { verifyModel, claimType } from '../worker/rag-worker.js';
const mk = (drafts, critic) => { let i = 0; return async (u, o) => { const body = JSON.parse(o.body).contents[0].parts[0].text; const j = body.startsWith('أنت مدقق') ? critic : drafts[i++ % drafts.length]; return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(j) }] } }] }) }; }; };
const env = { GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm' };
const D = (verdict, extra = {}) => ({ verdict, answer: 'جملة', time_sensitive: false, ...extra });
test('verify: answers when every gate passes, never validated', async () => {
  const r = await verifyModel('هل القاهرة عاصمة مصر', env, mk([D('supported')], { contradiction: 0.1 }));
  assert.equal(r.decision, 'answer'); assert.equal(r.validated_for_release, false); assert.equal(r.criteria.find(c => c.id === 'evidence').status, 'na');
});
test('verify: failures only for disagreement or critic; recency and unverified strict type are warnings', async () => {
  assert.equal((await verifyModel('سؤال', env, mk([D('supported'), D('refuted'), D('uncertain')], { contradiction: 0.1 }))).decision, 'abstain');
  assert.deepEqual((await verifyModel('سؤال', env, mk([D('supported')], { contradiction: 0.7 }))).reasons, ['contradiction']);
  const rc = await verifyModel('سؤال', env, mk([D('supported', { time_sensitive: true })], { contradiction: 0 }));
  assert.deepEqual(rc.reasons, []); assert.ok(rc.warnings.includes('recency'));
  const s = await verifyModel('ارتفع السعر 20%', env, mk([D('supported'), D('supported'), D('refuted')], { contradiction: 0 }));
  assert.equal(s.decision, 'abstain'); assert.ok(s.reasons.includes('type_rule'));
  const u = await verifyModel('ارتفع السعر 20%', env, mk([D('supported')], { contradiction: 0 }));
  assert.deepEqual(u.reasons, []); assert.ok(u.warnings.includes('type_rule'));
});

test('verify: no key, bad critic, links stripped, quota', async () => {
  assert.deepEqual(await verifyModel('x', {}), { error: 'off' });
  assert.equal((await verifyModel('سؤال', env, mk([D('supported')], { contradiction: 'x' }))).decision, 'abstain');
  const r = await verifyModel('سؤال', env, mk([D('supported', { answer: 'see https://x.io' })], { contradiction: 0 }));
  assert.equal(r.answer, '');
  assert.deepEqual(await verifyModel('سؤال', env, async () => ({ ok: false, status: 429 })), { error: 'busy' });
  assert.equal(claimType('قال الوزير'), 'attribution');
});

import { checkSource, safeSourceUrl } from '../worker/rag-worker.js';
test('source check: url safety, existence, support, numbers', async () => {
  assert.equal(safeSourceUrl('http://a.com/x'), ''); assert.equal(safeSourceUrl('https://127.0.0.1/x'), ''); assert.equal(safeSourceUrl('https://x.afp.com/a'), ''); assert.equal(safeSourceUrl('https://localhost/x'), '');
  assert.ok(safeSourceUrl('https://example.com/a'));
  const page = body => async () => ({ ok: true, headers: { get: () => 'text/html' }, text: async () => body });
  const good = await checkSource({ name: 'x', url: 'https://example.com/a' }, 'ارتفع سعر الخبز بنسبة 30 في المئة الشهر الماضي', ['30'], page('<p>أعلنت الوزارة أن سعر الخبز ارتفع بنسبة 30 في المئة الشهر الماضي في القاهرة.</p>'));
  assert.equal(good.verified, true); assert.equal(good.numbers_ok, true);
  const badNum = await checkSource({ url: 'https://example.com/a' }, 'ارتفع سعر الخبز بنسبة 30 في المئة الشهر الماضي', ['45'], page('<p>أعلنت الوزارة أن سعر الخبز ارتفع بنسبة 30 في المئة الشهر الماضي في القاهرة.</p>'));
  assert.equal(badNum.verified, false);
  const dead = await checkSource({ url: 'https://example.com/a' }, 'x', [], async () => ({ ok: false, headers: { get: () => 'text/html' } }));
  assert.equal(dead.exists, false);
});

test('verify: answer is returned even when gates fail (confidence is decided by the page)', async () => { const r = await verifyModel('سؤال', env, mk([D('supported'), D('refuted'), D('uncertain')], { contradiction: 0.1 })); assert.equal(r.decision, 'abstain'); assert.equal(r.answer, 'جملة'); assert.equal(r.validated_for_release, false); });

import { tierOf } from '../worker/rag-worker.js';
test('tierOf classifies the domain only', () => { assert.equal(tierOf('www.who.int'), 'official'); assert.equal(tierOf('data.worldbank.org'), 'official'); assert.equal(tierOf('moh.gov.eg'), 'official'); assert.equal(tierOf('www.reuters.com'), 'news'); assert.equal(tierOf('blog.example.com'), 'unknown'); assert.equal(tierOf('fakewho.int.example.com'), 'unknown'); });

test('source check: quote is a verbatim passage of the fetched page; dead links give no quote', async () => {
  const html = '<html><title>عنوان الصفحة</title><p>أعلنت الوزارة أن سعر الخبز ارتفع بنسبة 30 في المئة الشهر الماضي في القاهرة</p><p>جملة أخرى لا علاقة لها بالموضوع إطلاقا هنا</p></html>';
  const ok = await checkSource({ name: 'م', url: 'https://example.com/a' }, 'سعر الخبز ارتفع 30 في المئة', ['30'], async () => ({ ok: true, headers: { get: () => 'text/html' }, text: async () => html }));
  assert.ok(ok.exists && ok.quote && html.includes(ok.quote)); assert.equal(ok.title, 'عنوان الصفحة');
  const dead = await checkSource({ name: 'م', url: 'https://example.com/zzz' }, 'سعر الخبز', [], async () => ({ ok: false, headers: { get: () => 'text/html' }, text: async () => '' }));
  assert.equal(dead.exists, false); assert.equal(dead.quote, ''); assert.equal(dead.claimed, 'https://example.com/zzz');
});
