import test from 'node:test'; import assert from 'node:assert/strict';
import { ingestUrl } from '../worker/rag-worker.js';

const HTML = '<html><head><title>عنوان الخبر</title><style>x{}</style></head><body><script>bad()</script><p>نص الخبر الكامل هنا مع تفاصيل كافية تتجاوز أربعين حرفًا بسهولة تامة للاختبار.</p></body></html>';
const okHtml = (h = HTML) => async () => ({ ok: true, status: 200, headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }), text: async () => h });

test('ingestUrl: extracts title and text, strips script/style', async () => {
  const r = await ingestUrl('https://example.org/a', okHtml());
  assert.equal(r.title, 'عنوان الخبر');
  assert.ok(r.text.includes('نص الخبر الكامل')); assert.ok(!r.text.includes('bad()')); assert.ok(!r.text.includes('x{}'));
});

test('ingestUrl: og:title preferred over <title>', async () => {
  const r = await ingestUrl('https://example.org/a', okHtml('<html><head><meta property="og:title" content="عنوان أو جي"><title>آخر</title></head><body>' + 'نص '.repeat(30) + '</body></html>'));
  assert.equal(r.title, 'عنوان أو جي');
});

test('ingestUrl: blocks loopback/private and non-http schemes without fetching', async () => {
  let called = 0; const f = async () => { called++; return { ok: true, status: 200, headers: new Headers({ 'content-type': 'text/html' }), text: async () => HTML }; };
  for (const u of ['http://127.0.0.1/x', 'http://localhost/x', 'http://192.168.1.1/x', 'http://10.0.0.5/x', 'http://169.254.169.254/latest', 'ftp://example.org/x', 'not-a-url']) {
    assert.equal((await ingestUrl(u, f)).error, u.startsWith('ftp') || u === 'not-a-url' ? 'url' : 'url', u);
  }
  assert.equal(called, 0);
});

test('ingestUrl: follows validated redirects, re-checks each hop', async () => {
  let n = 0;
  const f = async (url) => { n++; if (n === 1) return { ok: false, status: 301, headers: new Headers({ location: 'https://cdn.example.org/final' }) }; return { ok: true, status: 200, headers: new Headers({ 'content-type': 'text/html' }), text: async () => HTML }; };
  const r = await ingestUrl('https://example.org/a', f);
  assert.equal(r.url, 'https://cdn.example.org/final'); assert.ok(r.text.length > 40);
  const evil = async () => ({ ok: false, status: 302, headers: new Headers({ location: 'http://169.254.169.254/meta' }) });
  assert.equal((await ingestUrl('https://example.org/a', evil)).error, 'url');
});

test('ingestUrl: non-html, short text, fetch failure, and denied domains are honest errors', async () => {
  assert.equal((await ingestUrl('https://example.org/i.png', async () => ({ ok: true, status: 200, headers: new Headers({ 'content-type': 'image/png' }), text: async () => '' }))).error, 'type');
  assert.equal((await ingestUrl('https://example.org/a', okHtml('<html><body>قصير</body></html>'))).error, 'empty');
  assert.equal((await ingestUrl('https://example.org/a', async () => ({ ok: false, status: 500, headers: new Headers() }))).error, 'fetch');
  assert.equal((await ingestUrl('https://example.org/a', async () => { throw new Error('net'); })).error, 'fetch');
  let called = 0; const f = async () => { called++; };
  assert.equal((await ingestUrl('https://factuel.afp.com/doc.x', f)).error, 'denied'); assert.equal(called, 0);
});
