import test from 'node:test'; import assert from 'node:assert/strict';
import worker from '../worker/rag-lib.js';

// Route-level tests for factcheck_quick (user-requested Gemini chat quick news verification on
// Google Fact Check): matched reviews render attributed; an API failure is never shown as
// "no match"; no match is unknown, never a verdict; the Gemini summary only runs on real matches.

const ORIGIN = 'https://shehataelsayed.github.io';
const FC = claims => ({ ok: true, json: async () => ({ claims }) });
const CLAIM = (text, pub, rating, url) => ({ text, claimReview: [{ publisher: { name: pub }, textualRating: rating, url, reviewDate: '2026-10-20' }] });
const geminiOk = text => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) });

let calls = [];
const realFetch = globalThis.fetch;
const mock = handler => { globalThis.fetch = async (url, init) => { calls.push(String(url)); return handler(String(url), init); }; };
test.after(() => { globalThis.fetch = realFetch; });

const env = () => ({ AI_PROVIDER: 'gemini-first', GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-3.8-flash' });
const post = (body, e = env(), origin = ORIGIN) => worker.fetch(new Request('https://worker.test/', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }), e);

test('route: matched reviews render attributed, https-only, capped, and Gemini summarizes matches only', async () => {
  calls = [];
  mock(async u => u.includes('factchecktools')
    ? FC([CLAIM('ادعاء أول', 'مسبار', 'مضلل', 'https://misbar.com/1'), CLAIM('ادعاء ثانٍ', 'متصدق', 'صحيح', 'https://matsda2sh.com/2'), CLAIM('ادعاء غير آمن', 'x', 'y', 'http://insecure.example/3')])
    : geminiOk('مسبار قال مضلل ومتصدق قال صحيح لادعاءين مختلفين.'));
  const r = await (await post({ mode: 'factcheck_quick', q: 'خبر منتشر' })).json();
  assert.equal(r.matches.length, 2, 'insecure URL dropped');
  assert.equal(r.matches[0].publisher, 'مسبار'); assert.equal(r.matches[0].rating, 'مضلل'); assert.equal(r.matches[0].date, '2026-10-20');
  assert.ok(r.summary.includes('مسبار'), 'Gemini summary attributed');
  assert.equal(r.coverage, 'ar');
  assert.ok(calls.some(u => u.includes('factchecktools.googleapis.com/v1alpha1/claims:search')), 'Fact Check API called');
  assert.ok(calls.some(u => u.includes('generativelanguage.googleapis.com')), 'Gemini called for the summary');
  assert.ok(calls.every(u => u.includes('factchecktools') || !u.includes(encodeURIComponent('خبر'))), 'claim text only to the Fact Check API, not pasted into other URLs');
});

test('route: zero matching reviews in BOTH languages -> empty matches, null summary, NO Gemini call', async () => {
  calls = [];
  mock(async u => u.includes('factchecktools') ? FC([]) : geminiOk('should never happen'));
  const r = await (await post({ mode: 'factcheck_quick', q: 'خبر بلا مراجعات' })).json();
  assert.deepEqual(r.matches, []); assert.equal(r.summary, null); assert.equal(r.coverage, 'none');
  assert.equal(calls.filter(u => u.includes('generativelanguage')).length, 0, 'no Gemini call without matches');
  assert.equal(calls.filter(u => u.includes('factchecktools')).length, 2, 'Arabic then English searched before declaring none');
});

test('route: no Arabic reviews -> English retry returns attributed matches marked coverage=en', async () => {
  calls = [];
  mock(async u => {
    if (u.includes('factchecktools') && u.includes('languageCode=ar')) return FC([]);
    if (u.includes('factchecktools') && u.includes('languageCode=en')) return FC([CLAIM('English claim', 'AFP Fact Check', 'False', 'https://factcheck.afp.com/1')]);
    return geminiOk('AFP Fact Check rated a related claim False.');
  });
  const r = await (await post({ mode: 'factcheck_quick', q: 'international claim' })).json();
  assert.equal(r.coverage, 'en'); assert.equal(r.matches.length, 1); assert.equal(r.matches[0].publisher, 'AFP Fact Check');
  assert.ok(r.summary, 'summary still generated for English matches');
});

test('route: Fact Check API failure is an explicit error, never a fake "no match"', async () => {
  mock(async () => ({ ok: false, status: 403 }));
  const r = await (await post({ mode: 'factcheck_quick', q: 'خبر' })).json();
  assert.deepEqual(r, { error: 'fc_http_403' });
  mock(async () => { throw new Error('down'); });
  const r2 = await (await post({ mode: 'factcheck_quick', q: 'خبر' })).json();
  assert.deepEqual(r2, { error: 'neterr' });
});

test('route: no API key -> off; missing query -> bad_request; guards apply', async () => {
  assert.deepEqual(await (await post({ mode: 'factcheck_quick', q: 'خبر' }, {})).json(), { error: 'off' });
  assert.deepEqual(await (await post({ mode: 'factcheck_quick' })).json(), { error: 'bad_request' });
  assert.equal((await post({ mode: 'factcheck_quick', q: 'س' }, env(), 'https://evil.example')).status, 403);
});

test('route: cloudflare pin skips the Gemini summary but still returns attributed matches', async () => {
  calls = [];
  const pinned = { AI_PROVIDER: 'cloudflare', GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-3.8-flash' };
  mock(async u => u.includes('factchecktools') ? FC([CLAIM('ادعاء', 'مسبار', 'كاذب', 'https://misbar.com/1')]) : geminiOk('no'));
  const r = await (await post({ mode: 'factcheck_quick', q: 'خبر' }, pinned)).json();
  assert.equal(r.matches.length, 1); assert.equal(r.summary, null, 'no generation while pinned');
  assert.equal(calls.filter(u => u.includes('generativelanguage')).length, 0);
});
