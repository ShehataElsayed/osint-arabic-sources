// Compares the previous page-support rule with the current one on self-authored Arabic pairs. Usage: node tests/grounding.eval.mjs
import fs from 'node:fs';
import { supportOf } from '../worker/rag-worker.js';
const { cases } = JSON.parse(fs.readFileSync(new URL('./data/grounding-cases.json', import.meta.url), 'utf8'));
// Previous rule: unstemmed tokens, numbers matched anywhere in the page, no negation check.
const nrm = s => String(s ?? '').toLowerCase().normalize('NFKC').replace(/[\u064b-\u065f\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const stok = s => nrm(s).split(' ').filter(t => t.length > 2);
const cos = (a, b) => { const va = new Map(), vb = new Map(); stok(a).forEach(t => va.set(t, (va.get(t) || 0) + 1)); stok(b).forEach(t => vb.set(t, (vb.get(t) || 0) + 1)); let d = 0, na = 0, nb = 0; for (const [t, c] of va) { na += c * c; if (vb.has(t)) d += c * vb.get(t); } for (const c of vb.values()) nb += c * c; return na && nb ? d / Math.sqrt(na * nb) : 0; };
const digits = s => String(s).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[,٬\s]/g, '');
const oldRule = (claim, page, nums) => { const best = Math.max(0, ...page.map(x => cos(claim, x))); const body = digits(page.join(' ')), want = (nums || []).map(digits).filter(Boolean); return Math.round(best * 100) / 100 >= 0.4 && !(want.length && !want.every(n => body.includes(n))); };
const kinds = {}; let o = 0, n = 0;
for (const c of cases) {
  const a = oldRule(c.claim, c.page, c.nums) === c.expect_supported, b = supportOf(c.claim, c.page, c.nums).verified === c.expect_supported;
  o += a; n += b; const k = kinds[c.k] ||= { cases: 0, previous_correct: 0, current_correct: 0 }; k.cases++; k.previous_correct += a; k.current_correct += b;
  if (!b) console.error('current wrong:', c.k, c.claim);
}
console.log(JSON.stringify({ cases: cases.length, previous_correct: o, current_correct: n, by_kind: kinds }, null, 1));
