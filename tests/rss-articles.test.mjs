import test from 'node:test'; import assert from 'node:assert/strict';
import { rssArticles } from '../worker/rag-lib.js';

// rssArticles: RSS supplement for the news discovery pools - normalized to the GDELT candidate
// shape, same URL safety filters, discovery-only, failures degrade to empty.

const RSS = (items) => `<?xml version="1.0"?><rss><channel>${items.map(i => `<item><title>${i.t}</title><link>${i.u}</link><pubDate>${i.d || 'Thu, 30 Oct 2026 10:00:00 GMT'}</pubDate><description>${i.x || ''}</description></item>`).join('')}</channel></rss>`;
const mockFetch = xml => async () => ({ ok: true, text: async () => xml });

test('rssArticles: matching items normalize to {title,url,host} with safety filters', async () => {
  const xml = RSS([
    { t: 'أسعار الذهب ترتفع في مصر اليوم', u: 'https://www.almasryalyoum.com/news/details/123' },
    { t: 'خبر غير آمن', u: 'http://insecure.example.com/x' },
    { t: 'خبر ويكيبيديا', u: 'https://ar.wikipedia.org/wiki/x' },
    { t: 'خبر لا يطابق الاستعلام إطلاقا', u: 'https://www.bbc.com/arabic/1' },
  ]);
  const r = await rssArticles('أسعار الذهب', {}, mockFetch(xml), 4);
  assert.equal(r.length, 1);
  assert.equal(r[0].host, 'www.almasryalyoum.com');
  assert.ok(r[0].title.includes('الذهب'));
  assert.ok(/^https:/.test(r[0].url));
});

test('rssArticles: feed failure and bad query degrade to empty, never throw', async () => {
  assert.deepEqual(await rssArticles('ذهب', {}, async () => { throw new Error('down'); }), []);
  assert.deepEqual(await rssArticles('', {}, mockFetch(RSS([]))), []);
  assert.deepEqual(await rssArticles('ذهب', {}, async () => ({ ok: false, status: 500 })), []);
});
