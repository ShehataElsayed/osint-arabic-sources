// Offline comparison: OLD semantic path (rerank only the top-12 lexical candidates) vs NEW
// full-catalogue semantic path (worker ranks all tools server-side, RRF-fused with lexical).
// Uses tests/data/semantic-fixture.json (eval queries encoded with the same bge-m3 int8 ONNX
// conversion as the catalogue asset) + the committed site/tool-embeddings.{json,bin}.
// Usage: node tests/semantic-catalog.eval.mjs [path/to/search-tools.json]
import fs from 'node:fs';
import { buildIndex, search, fuseSemanticCatalog, gateScopes, SEM_CATALOG_FLOOR } from '../site/tool-search.js';

const items = JSON.parse(fs.readFileSync(process.argv[2] || '_site/search-tools.json', 'utf8'));
const Q = JSON.parse(fs.readFileSync(new URL('./data/tool-queries.json', import.meta.url), 'utf8'));
const FX = JSON.parse(fs.readFileSync(new URL('./data/semantic-fixture.json', import.meta.url), 'utf8'));
const M = JSON.parse(fs.readFileSync('site/tool-embeddings.json', 'utf8'));
const buf = fs.readFileSync('site/tool-embeddings.bin');
const idx = buildIndex(items);

// Dequantize the catalogue asset exactly as the worker does.
const scales = new Float32Array(buf.buffer, buf.byteOffset, M.count);
const data = new Int8Array(buf.buffer, buf.byteOffset + M.count * 4);
const norms = new Float32Array(M.count);
for (let i = 0; i < M.count; i++) {
  let n = 0; const off = i * M.dims, s = scales[i];
  for (let j = 0; j < M.dims; j++) { const v = data[off + j] * s; n += v * v; }
  norms[i] = Math.sqrt(n) || 1;
}
const fxByQ = new Map(FX.queries.map(x => [x.q, x]));
function semScores(q) {
  const f = fxByQ.get(q); if (!f) throw new Error('missing fixture for: ' + q);
  const qv = f.v.map(x => x * f.scale);
  const qn = Math.sqrt(qv.reduce((a, x) => a + x * x, 0)) || 1;
  const scores = new Float64Array(M.count);
  for (let i = 0; i < M.count; i++) {
    let d = 0; const off = i * M.dims, s = scales[i];
    for (let j = 0; j < M.dims; j++) d += qv[j] * (data[off + j] * s);
    scores[i] = d / (qn * norms[i]);
  }
  return scores;
}
const key = x => typeof x === 'string' ? x : x.q;

// OLD production path: lexical abstain -> nothing; else rerank top-12 lexical candidates by
// semantic score and RRF-fuse within those 12 (current site/smart-search.js semanticServer).
function oldPath(q) {
  const found = search(idx, q);
  if (!found.confident) return [];
  const top = found.candidates.slice(0, 12), scores = semScores(q);
  const scored = top.map(c => ({ ...c, sem: scores[c.id] }));
  const K = 60;
  scored.forEach((c, i) => { c.rrf = 1 / (K + i + 1); });
  [...scored].sort((a, b) => b.sem - a.sem).forEach((c, i) => { c.rrf += 1 / (K + i + 1); });
  return gateScopes(q, scored.sort((a, b) => b.rrf - a.rrf));
}
// NEW path: full-catalogue semantic ranking fused with the lexical candidates; when lexical
// abstains, floor-gated semantic-only suggestions.
function newPath(q) {
  const found = search(idx, q);
  const cands = found.confident ? found.candidates : [];
  const scores = semScores(q);
  const semRanked = [...scores.keys()].sort((a, b) => scores[b] - scores[a]).slice(0, 60)
    .map(i => ({ id: i, s: scores[i], t: items[i] }));
  let ranked;
  if (!cands.length) {
    // Abstention gates hold: transactional intent, capability gap, uncovered jurisdiction -> nothing.
    if (found.txIntent || found.anchorMiss || (found.queryJuris && found.queryJuris.length)) return [];
    const above = semRanked.filter(x => x.s >= SEM_CATALOG_FLOOR);
    ranked = gateScopes(q, above.map(x => ({ t: x.t, rrf: x.s })));
  } else {
    ranked = gateScopes(q, fuseSemanticCatalog(cands, semRanked));
  }
  // Production display (showRanking) recommends each URL once; mirror that here.
  const seen = new Set();
  return ranked.filter(x => { const u = x.t.url || x.t.name; return !seen.has(u) && seen.add(u); });
}
function metrics(set, run) {
  let r5 = 0, r15 = 0, mrr = 0, hit5 = 0;
  for (const x of set) {
    const names = run(key(x)).map(c => c.t.name), rel = new Set(x.rel);
    const f5 = names.slice(0, 5).filter(n => rel.has(n)).length, f15 = names.filter(n => rel.has(n)).length;
    r5 += f5 / rel.size; r15 += f15 / rel.size; hit5 += f5 > 0 ? 1 : 0;
    const k = names.findIndex(n => rel.has(n)); mrr += k < 0 ? 0 : 1 / (k + 1);
  }
  const n = set.length, f = v => +(v / n).toFixed(3);
  return { queries: n, 'recall@5': f(r5), 'recall@15': f(r15), 'hit@5': f(hit5), MRR: f(mrr) };
}
const out = { tools: items.length, floor: SEM_CATALOG_FLOOR, old_12cap: {}, new_full_catalogue: {} };
for (const s of ['dev', 'heldout']) { out.old_12cap[s] = metrics(Q[s], oldPath); out.new_full_catalogue[s] = metrics(Q[s], newPath); }
out.out_of_scope = {
  queries: Q.out_of_scope.length,
  old_shows_nothing_when_lexical_abstains: Q.out_of_scope.filter(q => !search(idx, key(q)).confident).length,
  new_would_show_semantic_suggestions: Q.out_of_scope.filter(q => newPath(key(q)).length > 0).length
};
console.log(JSON.stringify(out, null, 1));
