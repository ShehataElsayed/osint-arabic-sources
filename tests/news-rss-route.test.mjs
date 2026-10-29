import test from 'node:test'; import assert from 'node:assert/strict';
import worker, { NEWS_FEEDS } from '../worker/rag-lib.js';

// Route-level tests for the news_rss dispatch: live Arabic news discovery via direct publisher
// RSS feeds, matched on the guide's server. Items are discovery leads (headline/source/date/link),
// https-only, deduped, capped at 8; failing feeds are counted, never fatal.

const ORIGIN = 'https://shehataelsayed.github.io';
const XML = (items) => `<?xml version="1.0"?><rss version="2.0"><channel>${items}</channel></rss>`;
const item = (t, l, d = '<pubDate>Thu, 29 Oct 2026 20:00:00 GMT</pubDate>', desc = '') => `<item><title>${t}</title><link>${l}</link>${d}<description>${desc}</description></item>`;
const FEED_A = XML(item('الصحافة الاستقصائية تكشف ملفًا جديدًا', 'https://a.example/1', undefined, 'تقرير عن الصحافة الاستقصائية في المنطقة') + item('رياضة: مباراة اليوم', 'https://a.example/2') + item('غير آمن', 'http://a.example/3'));
const FEED_B = XML(item('ملف الصحافة الاستقصائية يتفاعل', 'https://b.example/9', '<pubDate>Thu, 29 Oct 2026 21:00:00 GMT</pubDate>') + item('الصحافة الاستقصائية تكشف ملفًا جديدًا', 'https://a.example/1'));

const realFetch = globalThis.fetch;
let calls = [];
globalThis.fetch = async url => { calls.push(String(url)); const u = String(url); if (u.includes('france24')) return { ok: false, status: 503 }; return { ok: true, text: async () => u.includes('bbci') ? FEED_A : FEED_B }; };
test.after(() => { globalThis.fetch = realFetch; });

const post = (body, origin = ORIGIN) => worker.fetch(new Request('https://worker.test/', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }), {});

test('route: matches Arabic query terms across feeds, dedups by URL, https only, sorts by hits then recency', async () => {
  calls = [];
  const r = await (await post({ mode: 'news_rss', q: 'الصحافة الاستقصائية' })).json();
  assert.equal(r.items.length, 2, 'sports item, insecure item, and duplicate URL all excluded');
  assert.equal(r.items[0].url, 'https://b.example/9', 'newer equal-hit item first');
  assert.equal(r.items[1].url, 'https://a.example/1');
  assert.ok(r.items[0].source && r.items[0].published, 'source and date carried');
  assert.equal(calls.length, NEWS_FEEDS.length, 'every curated feed fetched once');
  assert.ok(calls.every(u => !u.includes(encodeURIComponent('الصحافة'))), 'query never sent to publishers');
  assert.equal(r.feeds_failed, 1, 'failing feed counted');
  assert.equal(r.feeds_ok, NEWS_FEEDS.length - 1);
});

test('route: all feeds failing yields empty items with counts, not an exception', async () => {
  const saved = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('down'); };
  try {
    const r = await (await post({ mode: 'news_rss', q: 'اختبار خبر' })).json();
    assert.deepEqual(r.items, []); assert.equal(r.feeds_failed, NEWS_FEEDS.length); assert.equal(r.feeds_ok, 0);
  } finally { globalThis.fetch = saved; }
});

test('route: missing/short query -> bad_request without fetching', async () => {
  calls = [];
  assert.equal((await (await post({ mode: 'news_rss' })).json()).error, 'bad_request');
  assert.equal((await (await post({ mode: 'news_rss', q: 'اب' })).json()).error, 'bad_request');
  assert.equal(calls.length, 0);
});

test('route: origin/method/JSON guards apply', async () => {
  assert.equal((await post({ mode: 'news_rss', q: 'س' }, 'https://evil.example')).status, 403);
  assert.equal((await worker.fetch(new Request('https://worker.test/', { method: 'GET', headers: { origin: ORIGIN } }), {})).status, 405);
  assert.equal((await post('{bad')).status, 400);
});
