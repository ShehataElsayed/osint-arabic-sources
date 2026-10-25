// Deploy-asset smoke check: browser tools fail live if these assets or relative paths regress.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

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
