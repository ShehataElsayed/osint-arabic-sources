import test from 'node:test'; import assert from 'node:assert/strict';
import worker from '../worker/rag-lib.js';

// Route-level tests for source_identity: the lazy recovery route that completes domain-identity
// checks deferred under subrequest pressure. One host per invocation (fresh free-plan budget),
// explicit identity_status - a skipped check is never reported as a completed 'unknown'.

const ORIGIN = 'https://shehataelsayed.github.io';
const realFetch = globalThis.fetch;
let calls = [];
globalThis.fetch = async (url) => {
  calls.push(String(url));
  const u = String(url);
  if (u.includes('rdap.org/domain/broken.example')) return { ok: false, status: 404, json: async () => ({}) };
  return { ok: true, json: async () => ({ events: [{ eventAction: 'registration', eventDate: '2010-01-01T00:00:00Z' }], entities: [{ roles: ['registrar'], vcardArray: ['vcard', [['fn', {}, 'text', 'Test Registrar']]] }] }) };
};
test.after(() => { globalThis.fetch = realFetch; });

const post = (body) => worker.fetch(new Request('https://worker.test/', { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: JSON.stringify(body) }), {});

test('source_identity returns checked identity for a valid host', async () => {
  calls = [];
  const r = await (await post({ mode: 'source_identity', host: 'www.example.com' })).json();
  assert.equal(r.identity_status, 'checked');
  assert.equal(r.identity.domain, 'example.com');
  assert.ok(r.identity.age_years >= 15);
  assert.equal(r.identity.registrar, 'Test Registrar');
  assert.equal(calls.length, 1, 'one RDAP subrequest');
  assert.ok(calls[0].includes('rdap.org/domain/example.com'));
});

test('source_identity completes the check and carries RDAP failure detail honestly', async () => {
  const r = await (await post({ mode: 'source_identity', host: 'broken.example' })).json();
  assert.equal(r.identity_status, 'checked');
  assert.equal(r.identity.rdap, 'http_404');
  assert.equal(r.identity.age_years, null);
});

test('source_identity rejects malformed hosts without any fetch', async () => {
  calls = [];
  for (const host of ['', 'not a host', 'https://evil.example/x', 'EXAMPLE']) {
    const r = await (await post({ mode: 'source_identity', host })).json();
    assert.equal(r.error, 'bad_host', host);
  }
  assert.equal(calls.length, 0);
});

test('source_identity rejects wrong origin', async () => {
  const res = await worker.fetch(new Request('https://worker.test/', { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'source_identity', host: 'example.com' }) }), {});
  assert.equal(res.status, 403);
});
