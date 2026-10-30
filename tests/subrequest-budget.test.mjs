// Subrequest budget regression: per-invocation feed cache + enrichment gates.
// Live evidence (2026-10-30 probe): synthesis died at 0ms with
// "Too many subrequests by single Worker invocation" - the discovery pipeline
// burned the free-plan 50/invocation budget, mostly by refetching the same
// publisher feeds once per discovery query.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newsRss } from '../worker/rag-lib.js';

const FEED = `<?xml version="1.0"?><rss><channel><item><title>مصر تبدأ التوقيت الشتوي</title><link>https://example.com/a1</link><pubDate>Wed, 29 Oct 2026 21:00:00 GMT</pubDate><description>الساعة تأخرت 60 دقيقة</description></item><item><title>خبر آخر عن الاقتصاد</title><link>https://example.com/a2</link><pubDate>Wed, 29 Oct 2026 20:00:00 GMT</pubDate><description>تفاصيل</description></item></channel></rss>`;

test('newsRss fetches each feed once per invocation even across repeated queries', async () => {
  const calls = [];
  const env = {};
  const f = async (url) => { calls.push(url); return { ok: true, text: async () => FEED }; };
  const r1 = await newsRss('التوقيت الشتوي في مصر', env, f);
  const r2 = await newsRss('هل تأخرت الساعة في مصر', env, f);
  const r3 = await newsRss('مصر الشتوي توقيت', env, f);
  assert.ok(calls.length > 0);
  const unique = new Set(calls);
  assert.equal(calls.length, unique.size, `feeds refetched across queries: ${calls.length} calls, ${unique.size} unique`);
  // Per-query filtering still applies through the same parse pipeline.
  assert.ok(Array.isArray(r1.items) && Array.isArray(r2.items) && Array.isArray(r3.items));
  assert.ok(r1.items.length > 0, 'first query should match the winter-time item');
  assert.ok((r1.feeds_ok ?? 0) > 0);
});

test('newsRss without env still fetches per call (no cache, no crash)', async () => {
  let calls = 0;
  const f = async () => { calls++; return { ok: true, text: async () => FEED }; };
  await newsRss('مصر', null, f);
  const first = calls;
  await newsRss('مصر', null, f);
  assert.equal(calls, first * 2, 'no env means no cache');
});

test('failed feeds are cached too within one invocation (no repeated failing subrequests)', async () => {
  let calls = 0;
  const env = {};
  const f = async () => { calls++; return { ok: false, status: 500, body: { cancel: async () => {} } }; };
  await newsRss('مصر توقيت', env, f);
  const first = calls;
  await newsRss('مصر توقيت', env, f);
  assert.equal(calls, first, 'failed feed results are reused, not refetched');
});
