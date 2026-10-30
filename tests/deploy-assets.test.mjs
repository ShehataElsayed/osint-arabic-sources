// Deploy-asset smoke check: browser tools fail live if these assets or relative paths regress.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const big = p => fs.statSync(p).size > 1_000_000;

test('OCR tessdata assets present (ara/eng gz)', () => {
  assert.ok(big('site/tessdata/ara.traineddata.gz'), 'site/tessdata/ara.traineddata.gz missing or tiny');
  assert.ok(big('site/tessdata/eng.traineddata.gz'), 'site/tessdata/eng.traineddata.gz missing or tiny');
});

test('DuckDB-WASM assets present', () => {
  for (const f of ['duckdb-mvp.wasm', 'duckdb-browser.mjs', 'duckdb-browser-mvp.worker.js'])
    assert.ok(fs.existsSync(`site/duckdb/${f}`), `site/duckdb/${f} missing`);
  assert.ok(big('site/duckdb/duckdb-mvp.wasm'), 'duckdb-mvp.wasm unexpectedly small');
});

test('asset paths stay relative (Pages path prefix safe)', () => {
  const dl = fs.readFileSync('site/data-lab.js', 'utf8');
  assert.ok(!dl.includes("'/duckdb/") && !dl.includes('"/duckdb/'), 'data-lab.js uses domain-absolute asset path');
  const ocr = fs.readFileSync('site/ocr.js', 'utf8');
  assert.ok(ocr.includes("langPath: './tessdata'"), 'ocr.js langPath changed');
});

test('built output carries the assets', () => {
  if (!fs.existsSync('_site/index.html')) return; // build not run in this context
  assert.ok(big('_site/tessdata/ara.traineddata.gz'), '_site missing tessdata');
  assert.ok(big('_site/duckdb/duckdb-mvp.wasm'), '_site missing duckdb wasm');
});

test('built HTML cache-busts local js/css references with a content hash', () => {
  if (!fs.existsSync('_site/index.html')) return; // build not run in this context
  const ss = fs.readFileSync('_site/smart-search.html', 'utf8');
  assert.ok(/src="\.\/smart-search\.js\?v=[a-f0-9]{8}"/.test(ss), 'smart-search.js reference not cache-busted');
  const ast = fs.readFileSync('_site/assistant.html', 'utf8');
  assert.ok(/href="\.\/rag\.css\?v=[a-f0-9]{8}"/.test(ast), 'rag.css reference not cache-busted');
  assert.ok(!/src="https?:\/\/[^"]*\?v=/.test(ss), 'external references must not be rewritten');
});

test('built JS fingerprints nested relative imports and Worker URLs', () => {
  if (!fs.existsSync('_site/journalist-media/timeline-page.js')) return; // build not run in this context
  const tp = fs.readFileSync('_site/journalist-media/timeline-page.js', 'utf8');
  const m = /journalist-core\.js\?v=([a-f0-9]{8})/.exec(tp);
  assert.ok(m, 'nested journalist-core.js import not cache-busted');
  const coreHash = createHash('sha256').update(fs.readFileSync('_site/journalist-core.js')).digest('hex').slice(0, 8);
  assert.equal(m[1], coreHash, 'nested import hash must match target file bytes');
  const idf = fs.readFileSync('_site/image-difference.js', 'utf8');
  assert.ok(/new Worker\('\.\/image-difference-worker\.js\?v=[a-f0-9]{8}'/.test(idf), 'Worker URL not cache-busted');
  assert.ok(!fs.readFileSync('_site/tesseract.min.js', 'utf8').includes('?v='), 'vendor bundle must stay untouched');
});
