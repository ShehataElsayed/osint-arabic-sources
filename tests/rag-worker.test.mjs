import test from 'node:test'; import assert from 'node:assert/strict';
import { answer, denied, factCheck } from '../worker/rag-lib.js';
const f = async () => ({ ok: true, json: async () => ({ claims: [{ text: 'ادعاء', claimReview: [{ publisher: { name: 'ناشر' }, url: 'https://misbar.com/a', textualRating: 'مضلل', title: 't' }] }] }) });

test('fact-check results are link_only', async () => { const r = await answer('خبز', { FACTCHECK_API_KEY: 'k' }, f); assert.equal(r.results.length, 1); assert.equal(r.results[0].fetch, 'link_only'); assert.ok(r.results.every(x => x.source === 'factcheck')); });
test('no key -> no calls, flagged, empty', async () => { const r = await answer('خبز', {}, f); assert.equal(r.factcheck_enabled, false); assert.equal(r.results.length, 0); });
test('deny-list', () => { assert.ok(denied('https://www.misbar.com/x')); assert.ok(denied('https://factuel.afp.com/x')); assert.ok(denied('not a url')); });
test('factCheck sends key only to google endpoint', async () => { let u; await factCheck('q', 'KEY', async x => { u = x; return { ok: false }; }); assert.ok(u.startsWith('https://factchecktools.googleapis.com/')); });
import { keywords } from '../worker/rag-lib.js';
test('keywords drop question words', () => { assert.equal(keywords('من فاز بكأس العالم 2022؟'), 'فاز بكأس العالم 2022'); assert.equal(keywords('هل لم تفز الأرجنتين بكأس العالم 2022؟'), 'تفز الأرجنتين بكأس العالم 2022'); });

import { compose } from '../worker/rag-lib.js';
test('compose: off without key, rejects links and unsupported verdicts', async () => { assert.equal(await compose('س', [], 'answer', {}), null); const env = { GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm' }; const mk = t => async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: t }] } }] }) }); assert.equal(await compose('س', [{ rating: 'مضلل', count: 1 }], 'answer', env, mk('الحكم السائد مضلل.')), 'الحكم السائد مضلل.'); assert.equal(await compose('س', [{ rating: 'مضلل', count: 1 }], 'answer', env, mk('الخبر كاذب')), null); assert.equal(await compose('س', [], 'answer', env, mk('انظر https://x.com')), null); });

import { recommend } from '../worker/rag-lib.js';
test('recommend: only candidate ids, no links, off without key', async () => {
  const cs = [{ id: 1, name: 'أداة أ', description: 'وصف' }, { id: 2, name: 'أداة ب', description: 'وصف' }];
  assert.equal(await recommend('س', cs, {}), null);
  const env = { GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm' };
  const mk = o => async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(o) }] } }] }) });
  const r = await recommend('س', cs, env, mk({ picks: [{ id: 1, why: 'ي', how: 'خ' }, { id: 99, why: 'x', how: 'y' }, { id: 2, why: 'see https://evil.example', how: 'y' }, { id: 1, why: 'dup', how: 'dup' }] }));
  assert.deepEqual(r, [{ id: 1, why: 'ي', how: 'خ' }]);
  assert.deepEqual(await recommend('س', cs, env, mk({ picks: [{ id: 99, why: 'x', how: 'y' }] })), { error: 'filtered' });
});

import { plan, cleanPlan } from '../worker/rag-lib.js';
test('plan: whitelisted kind and fields, no links, dates validated', async () => {
  assert.equal(cleanPlan({ kind: 'hack', fields: {} }), null);
  const c = cleanPlan({ kind: 'person', fields: { name: 'سمير', city: 'http://x.io', from: '2020-01-01', to: 'غدا', evil: 'x' }, note: 'فهمت' });
  assert.deepEqual(c, { kind: 'person', fields: { name: 'سمير', from: '2020-01-01' }, note: 'فهمت' });
  assert.equal(cleanPlan({ kind: 'topic', fields: { topic: 'قمح' }, note: 'see https://a.b' }), null);
  assert.deepEqual(await plan('نص', {}), { error: 'off' });
});

import { verifyModel, claimType } from '../worker/rag-lib.js';
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

import { checkSource, safeSourceUrl } from '../worker/rag-lib.js';
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

import { tierOf } from '../worker/rag-lib.js';
test('tierOf classifies the domain only', () => { assert.equal(tierOf('www.who.int'), 'official'); assert.equal(tierOf('data.worldbank.org'), 'official'); assert.equal(tierOf('moh.gov.eg'), 'official'); assert.equal(tierOf('www.reuters.com'), 'news'); assert.equal(tierOf('blog.example.com'), 'unknown'); assert.equal(tierOf('fakewho.int.example.com'), 'unknown'); });

test('source check: quote is a verbatim passage of the fetched page; dead links give no quote', async () => {
  const html = '<html><title>عنوان الصفحة</title><p>أعلنت الوزارة أن سعر الخبز ارتفع بنسبة 30 في المئة الشهر الماضي في القاهرة</p><p>جملة أخرى لا علاقة لها بالموضوع إطلاقا هنا</p></html>';
  const ok = await checkSource({ name: 'م', url: 'https://example.com/a' }, 'سعر الخبز ارتفع 30 في المئة', ['30'], async () => ({ ok: true, headers: { get: () => 'text/html' }, text: async () => html }));
  assert.ok(ok.exists && ok.quote && html.includes(ok.quote)); assert.equal(ok.title, 'عنوان الصفحة');
  const dead = await checkSource({ name: 'م', url: 'https://example.com/zzz' }, 'سعر الخبز', [], async () => ({ ok: false, headers: { get: () => 'text/html' }, text: async () => '' }));
  assert.equal(dead.exists, false); assert.equal(dead.quote, ''); assert.equal(dead.claimed, 'https://example.com/zzz');
});

test('tierOf: broader lists, anchored to the registrable domain', () => { assert.equal(tierOf('www.cbe.org.eg'), 'official'); assert.equal(tierOf('www.capmas.gov.eg'), 'official'); assert.equal(tierOf('www.sama.gov.sa'), 'official'); assert.equal(tierOf('news.un.org'), 'official'); assert.equal(tierOf('www.aljazeera.net'), 'news'); assert.equal(tierOf('www.youm7.com'), 'news'); assert.equal(tierOf('www.thelancet.com'), 'academic'); assert.equal(tierOf('cu.edu.eg'), 'official'); assert.equal(tierOf('www.ox.ac.uk'), 'academic'); assert.equal(tierOf('who.int.evil.com'), 'unknown'); assert.equal(tierOf('notreuters.com'), 'unknown'); assert.equal(tierOf('reuters.com.fake.io'), 'unknown'); });

test('extraction: the picked passage is a verbatim candidate sentence; bad indexes fall back', async () => {
  const html = '<p>أعلنت الوزارة أن سعر الخبز ارتفع بنسبة 30 في المئة الشهر الماضي في القاهرة</p><p>سعر الخبز في المدينة بقي مستقرا طوال السنة الماضية كلها</p>';
  const s = await checkSource({ name: 'م', url: 'https://example.com/a' }, 'سعر الخبز ارتفع 30 في المئة', ['30'], async () => ({ ok: true, headers: { get: () => 'text/html' }, text: async () => html }));
  assert.ok(s.cands.length >= 2 && s.cands.every(c => html.includes(c)));
});

import { registrable, rdapInfo, pageIdentity, reliabilityOf } from '../worker/rag-lib.js';
test('identity: registrable domain, RDAP parsing without guessing, rating floors', async () => {
  assert.equal(registrable('www.almasryalyoum.com'), 'almasryalyoum.com'); assert.equal(registrable('www.cbe.org.eg'), 'cbe.org.eg'); assert.equal(registrable('a.b.bbc.co.uk'), 'bbc.co.uk');
  const j = { events: [{ eventAction: 'registration', eventDate: '2006-01-23T00:00:00Z' }], entities: [{ roles: ['registrar'], vcardArray: ['vcard', [['fn', {}, 'text', 'GoDaddy.com, LLC']]] }, { roles: ['registrant'], vcardArray: ['vcard', [['fn', {}, 'text', 'REDACTED FOR PRIVACY']]] }] };
  const id = await rdapInfo('www.x.com', async () => ({ ok: true, json: async () => j }));
  assert.ok(id.age_years >= 19); assert.equal(id.registrar, 'GoDaddy.com, LLC'); assert.equal(id.registrant, null); assert.equal(id.rdap, 'ok');
  assert.notEqual((await rdapInfo('x.com', async () => ({ ok: false }))).rdap, 'ok');
  const pg = pageIdentity('<meta property="og:site_name" content="موقع تجريبي"><a href="/about">من نحن</a>'); assert.equal(pg.site_name, 'موقع تجريبي'); assert.equal(pg.has_about, true); assert.equal(pg.has_contact, false);
  assert.equal(reliabilityOf('official', null, null), 'very_high'); assert.equal(reliabilityOf('news', null, null), 'high');
  assert.equal(reliabilityOf('unknown', { age_years: 9 }, pg), 'medium'); assert.equal(reliabilityOf('unknown', { age_years: 1 }, pg), 'unknown'); assert.equal(reliabilityOf('unknown', null, null), 'unknown');
});

import { pickFromSitemap, repairSource } from '../worker/rag-lib.js';
test('repair: candidates come from the same host sitemap and only count if they fetch', async () => {
  const locs = ['https://www.example.com/news/2022/11/cop27-loss-and-damage-fund-agreed', 'https://www.example.com/sports/football', 'https://other.com/cop27-loss-and-damage-fund'];
  assert.deepEqual(pickFromSitemap(locs, 'cop27 loss damage fund agreed', 'www.example.com'), ['https://www.example.com/news/2022/11/cop27-loss-and-damage-fund-agreed']);
  const page = '<p>Delegates agreed to create the loss and damage fund at the cop27 summit in Egypt</p>';
  const f = async u => u.endsWith('sitemap.xml') ? { ok: true, text: async () => `<urlset>${locs.map(l => `<url><loc>${l}</loc></url>`).join('')}</urlset>` } : u.includes('cop27') ? { ok: true, headers: { get: () => 'text/html' }, text: async () => page } : { ok: false, headers: { get: () => '' }, text: async () => '' };
  const r = await repairSource({ name: 'cop27 fund', url: 'https://www.example.com/missing' }, 'cop27 loss damage fund agreed', [], f);
  assert.ok(r && r.repaired && r.exists && r.original === 'https://www.example.com/missing' && r.url.includes('cop27'));
  const none = await repairSource({ name: 'x', url: 'https://www.example.com/missing' }, 'zzz qqq', [], async () => ({ ok: false, headers: { get: () => '' }, text: async () => '' }));
  assert.equal(none, null);
});

import { exaSameDomain } from '../worker/rag-lib.js';
test('repair: domain-restricted search runs only with a key, is cached, and fails quietly', async () => {
  assert.deepEqual(await exaSameDomain('a.com', 'x', {}, async () => { throw new Error('no'); }), []);
  let n = 0, body;
  const f = async (u, o) => { n++; body = JSON.parse(o.body); return { ok: true, json: async () => ({ results: [{ url: 'https://www.a.com/p/1' }, { url: 'https://evil.com/p' }] }) }; };
  assert.deepEqual(await exaSameDomain('www.a.com', 'q1', { EXA_API_KEY: 'k' }, f), ['https://www.a.com/p/1']);
  await exaSameDomain('www.a.com', 'q1', { EXA_API_KEY: 'k' }, f);
  assert.equal(n, 1); assert.deepEqual(body.includeDomains, ['a.com']);
  assert.deepEqual(await exaSameDomain('b.com', 'q', { EXA_API_KEY: 'k' }, async () => ({ ok: false })), []);
});

import { exaWeb } from '../worker/rag-lib.js';
test('open-web search: blocked domains dropped, capped, quiet without key', async () => {
  assert.deepEqual(await exaWeb('q', {}, async () => { throw new Error('x'); }), []);
  const f = async () => ({ ok: true, json: async () => ({ results: [{ url: 'https://factuel.afp.com/a', title: 'a' }, { url: 'https://misbar.com/b', title: 'b' }, { url: 'https://www.who.int/c', title: 'c' }, { url: 'http://insecure.com/d', title: 'd' }, { url: 'https://un.org/e', title: 'e' }] }) });
  const r = await exaWeb('blocked-test', { EXA_API_KEY: 'k' }, f, 3);
  assert.deepEqual(r.map(x => x.host), ['www.who.int', 'un.org']);
});

import { supportOf, stemAr } from '../worker/rag-lib.js';
test('supportOf: negating page and distant numbers are not support; inflected forms overlap', () => {
  assert.equal(stemAr('والمدارس'), 'مدارس');
  const neg = supportOf('أعلنت الوزارة إغلاق المدارس في المحافظة', ['نفت الوزارة إغلاق المدارس في المحافظة وأكدت استمرار الدراسة'], []);
  assert.equal(neg.negation_conflict, true); assert.equal(neg.verified, false);
  const filler = 'وتتابع الجهات المعنية الموقف عن كثب وتصدر تحديثات دورية للرأي العام';
  const far = supportOf('قتل 20 شخصا في الهجوم على القرية', ['قتل عدد من الأشخاص في الهجوم على القرية بحسب شهود عيان محليين', filler, 'أما حصيلة الفيضانات في العام الماضي فبلغت 20 قتيلا'], ['20']);
  assert.equal(far.numbers_ok, false); assert.equal(far.verified, false);
  const ok = supportOf('أغلقت المدارس أبوابها بسبب الفيضانات', ['قررت الوزارة أن المدرسة أغلقت أبوابها بسبب الفيضان في المحافظات الشمالية'], []);
  assert.equal(ok.verified, true);
});

import { exaFetchText } from '../worker/rag-lib.js';
{ // exaFetchText: off without key, returns server-fetched text with key
  assert.equal(await exaFetchText('https://example.com/a', {}, async () => { throw new Error('no call'); }), null);
  const f = async (u, o) => ({ ok: true, json: async () => ({ results: [{ text: 'نص الصفحة من وسيط البحث' }] }) });
  assert.equal(await exaFetchText('https://example.com/a', { EXA_API_KEY: 'k' }, f), 'نص الصفحة من وسيط البحث');
  assert.equal(await exaFetchText('https://example.com/a', { EXA_API_KEY: 'k' }, async () => ({ ok: false })), null);
}
{ // checkSource falls back to Exa contents when the direct fetch fails; provenance URL kept, via marked
  const calls = [];
  const f = async (u, o) => {
    calls.push(u);
    if (u.startsWith('https://api.exa.ai/')) return { ok: true, json: async () => ({ results: [{ text: 'أعلنت الوزارة أن سعر الخبز ارتفع بنسبة 30 في المئة الشهر الماضي في القاهرة بعد قرار مجلس الوزراء' }] }) };
    return { ok: false, headers: { get: () => 'text/html' } };
  };
  const r = await checkSource({ name: 'x', url: 'https://example.com/blocked' }, 'ارتفع سعر الخبز بنسبة 30 في المئة الشهر الماضي', ['30'], f, { EXA_API_KEY: 'k' });
  assert.equal(r.exists, true); assert.equal(r.via, 'exa'); assert.equal(r.url, 'https://example.com/blocked');
  assert.ok(r.quote.includes('30')); assert.ok(calls.some(u => u.startsWith('https://api.exa.ai/')));
  // no key: stays failed, no Exa call
  const calls2 = [];
  const f2 = async (u, o) => { calls2.push(u); return { ok: false, headers: { get: () => 'text/html' } }; };
  const r2 = await checkSource({ name: 'x', url: 'https://example.com/blocked' }, 'سعر الخبز', [], f2, {});
  assert.equal(r2.exists, false); assert.ok(!calls2.some(u => u.startsWith('https://api.exa.ai/')));
}

{ // English negation parity: "did not" counts; mismatch with a positive claim is a conflict
  const sent = 'Suez Canal transits did not decline in the first quarter of 2024 according to the official report';
  const pos = supportOf('Suez Canal transits declined in the first quarter of 2024', [sent], ['2024']);
  assert.equal(pos.negation_conflict, true, 'positive claim vs negated passage conflicts');
  const neg = supportOf('Suez Canal transits did not decline in the first quarter of 2024', [sent], ['2024']);
  assert.equal(neg.negation_conflict, false, 'negation parity holds in English');
}
{ // checkSource altText: Arabic claim against an English page selects candidates via the translated text
  const html = '<p>Suez Canal transits fell by more than 50 percent in early 2024 after the Red Sea attacks began</p>';
  const f = async () => ({ ok: true, headers: { get: () => 'text/html' }, text: async () => html });
  const noAlt = await checkSource({ name: 'x', url: 'https://example.com/en' }, 'انخفضت حركة العبور في قناة السويس', ['50'], f, {});
  assert.ok(noAlt.similarity < 0.15, 'Arabic claim alone does not match English page');
  const withAlt = await checkSource({ name: 'x', url: 'https://example.com/en' }, 'انخفضت حركة العبور في قناة السويس', ['50'], f, {}, 'Suez Canal transits fell by more than 50 percent in early 2024');
  assert.ok(withAlt.similarity >= 0.4, 'translated text matches the English passage');
  assert.ok(withAlt.quote.includes('50'), 'English quote picked');
  assert.equal(withAlt.numbers_ok, true, 'digits guard passes on the original passage');
}

test('wikipedia excluded everywhere (owner request 2026-10-26): discovery, open, ingest', async () => {
  const { wikiHost, exaWeb, checkSource, ingestUrl, gdeltArticles } = await import('../worker/rag-lib.js');
  assert.equal(wikiHost('https://ar.wikipedia.org/wiki/%D8%B0%D9%87%D8%A8'), true);
  assert.equal(wikiHost('https://en.m.wikipedia.org/wiki/Gold'), true);
  assert.equal(wikiHost('https://commons.wikimedia.org/wiki/F'), true);
  assert.equal(wikiHost('https://www.reuters.com/world/'), false);
  const fx = async (u) => u.includes('api.exa.ai/search')
    ? { ok: true, json: async () => ({ results: [{ title: 'w', url: 'https://ar.wikipedia.org/wiki/x' }, { title: 'r', url: 'https://www.reuters.com/a' }] }) }
    : u.includes('gdeltproject.org')
      ? { ok: true, json: async () => ({ articles: [{ title: 'w', url: 'https://ar.wikipedia.org/wiki/x' }, { title: 'g', url: 'https://www.aljazeera.net/b' }] }) }
      : { ok: true, headers: new Map([['content-type', 'text/html']]), url: u, text: async () => '<title>t</title><p>' + 'ذهب '.repeat(80) + '</p>' };
  const web = await exaWeb('ذهب', { EXA_API_KEY: 'k' }, fx, 4);
  assert.deepEqual(web.map(x => x.host), ['www.reuters.com']);
  const gd = await gdeltArticles('ذهب', fx, 4);
  assert.deepEqual(gd.map(x => x.host), ['www.aljazeera.net']);
  const cs = await checkSource({ name: 'w', url: 'https://ar.wikipedia.org/wiki/x' }, 'ذهب', [], fx, {});
  assert.equal(cs.exists, false);
  const ing = await ingestUrl('https://ar.wikipedia.org/wiki/x', fx, {});
  assert.equal(ing.error, 'denied');
});
