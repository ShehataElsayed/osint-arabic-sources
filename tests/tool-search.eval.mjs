// Measures candidate retrieval on the self-authored Arabic query set. Usage: node tests/tool-search.eval.mjs [path/to/search-tools.json]
import fs from 'node:fs';
import { buildIndex, search, baselineKeyword } from '../site/tool-search.js';
const file = process.argv[2] || '_site/search-tools.json';
const items = JSON.parse(fs.readFileSync(file, 'utf8')), Q = JSON.parse(fs.readFileSync(new URL('./data/tool-queries.json', import.meta.url), 'utf8'));
const idx = buildIndex(items);
function metrics(set, run) {
  let r5 = 0, r15 = 0, mrr = 0, hit5 = 0;
  for (const x of set) {
    const names = run(x.q).map(c => c.t.name), rel = new Set(x.rel);
    const found5 = names.slice(0, 5).filter(n => rel.has(n)).length, found15 = names.filter(n => rel.has(n)).length;
    r5 += found5 / rel.size; r15 += found15 / rel.size; hit5 += found5 > 0 ? 1 : 0;
    const k = names.findIndex(n => rel.has(n)); mrr += k < 0 ? 0 : 1 / (k + 1);
  }
  const n = set.length, f = v => +(v / n).toFixed(3);
  return { queries: n, 'recall@5': f(r5), 'recall@15': f(r15), 'hit@5': f(hit5), MRR: f(mrr) };
}
const base = q => baselineKeyword(q, items), neu = q => search(idx, q).candidates;
const out = { items: items.length, baseline: {}, new: {} };
for (const s of ['dev', 'heldout']) { out.baseline[s] = metrics(Q[s], base); out.new[s] = metrics(Q[s], neu); }
out.abstain = {
  queries: Q.out_of_scope.length,
  baseline_returned_results: Q.out_of_scope.filter(q => base(q).length > 0).length,
  new_returned_results: Q.out_of_scope.filter(q => search(idx, q).confident).length
};
// Guard: in-scope queries wrongly abstained by the new method
out.abstain.new_false_abstain_in_scope = [...Q.dev, ...Q.heldout].filter(x => !search(idx, x.q).confident).length;
console.log(JSON.stringify(out, null, 1));
