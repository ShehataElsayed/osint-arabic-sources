// Offline HOLDOUT study for the experimental xl translation gate (path D). Separate from the 7
// development fixtures in xl-paths.eval.mjs — new topics, new phrasings. Varied AR->EN paraphrase
// positives and negatives by category: actor swap, time swap, units change, unsupported causal
// claim, partial support, contradiction, entity swap, number change. Reports OBSERVED ERRORS ONLY:
// 12 hand-authored pairs are a scope probe, not calibration — no accuracy or generalization claim.
import { ragTokens } from '../worker/rag-worker.js';

const cos = (a, b) => { const va = new Map(), vb = new Map(); ragTokens(a).forEach(x => va.set(x, (va.get(x) || 0) + 1)); ragTokens(b).forEach(x => vb.set(x, (vb.get(x) || 0) + 1)); let d = 0, na = 0, nb = 0; for (const [x, c] of va) { na += c * c; if (vb.has(x)) d += c * vb.get(x); } for (const c of vb.values()) nb += c * c; return na && nb ? d / Math.sqrt(na * nb) : 0; };
const STOP = new Set(['the', 'and', 'that', 'with', 'from', 'this', 'its', 'for', 'are', 'was', 'has', 'have', 'been', 'according']);
const distinctive = s => [...new Set(ragTokens(s))].filter(t => t.length >= 3 && !STOP.has(t) && !/^\d/.test(t));
const digits = s => String(s).replace(/[,.\s]/g, '').match(/\d+/g) || [];
const NEG = new Set(['not', 'no', 'never', 'without', 'denies', 'denied', 'deny']);
const negParity = s => ragTokens(s).filter(t => NEG.has(t)).length % 2;
const DIR_UP = new Set(['increase', 'increas', 'rose', 'rise', 'grew', 'growth', 'reached', 'surge', 'jump', 'higher', 'gain']);
const DIR_DOWN = new Set(['decrease', 'decreas', 'decline', 'declin', 'fell', 'fall', 'drop', 'dropp', 'down', 'lower', 'slump']);
const dir = s => { const t = ragTokens(s), u = t.some(x => DIR_UP.has(x)), d = t.some(x => DIR_DOWN.has(x)); return u && d ? 'mixed' : u ? 'up' : d ? 'down' : ''; };
const guards = (claim, passage) => {
  const pd = digits(passage).join(','), want = digits(claim);
  if (!want.every(n => pd.split(',').some(x => x.includes(n)))) return 'numbers';
  if (negParity(claim) !== negParity(passage)) return 'negation';
  const cd = dir(claim); if (cd && cd !== 'mixed' && dir(passage) !== cd) return 'direction';
  return '';
};
const coverage = (claim, passage) => { const pt = new Set(ragTokens(passage)), d = distinctive(claim); return d.length ? d.filter(t => pt.has(t)).length / d.length : 0; };
const gateD = (c, p) => cos(c, p) >= 0.4 && guards(c, p) === '' && coverage(c, p) >= 0.66;

const pairs = [
  // positives: varied paraphrases, expect PASS
  { id: 'P1-gdp', cat: 'paraphrase', expect: 'pass', claim: 'Egypt GDP grew by 2.4 percent in fiscal year 2024', passage: "Egypt's economy expanded by 2.4 percent in the 2024 fiscal year, the planning ministry said, driven by construction and communications." },
  { id: 'P2-flood', cat: 'paraphrase', expect: 'pass', claim: 'Floods displaced 30000 people in eastern Libya in September 2023', passage: 'More than 30000 people were displaced by floods in eastern Libya in September 2023 after two dams collapsed, according to the United Nations.' },
  { id: 'P3-vaccine', cat: 'paraphrase', expect: 'pass', claim: 'The health ministry vaccinated 12 million children against measles in 2024', passage: 'The health ministry said 12 million children received measles vaccinations during the 2024 national campaign.' },
  { id: 'P4-wheat', cat: 'paraphrase', expect: 'pass', claim: 'Egypt imported 5.5 million tons of wheat in 2023', passage: "Wheat imports into Egypt totaled 5.5 million tons in 2023, making it one of the world's largest buyers." },
  // negatives by category, expect BLOCK
  { id: 'N1-actor', cat: 'actor swap', expect: 'block', claim: 'The Central Bank raised interest rates by 200 basis points', passage: 'The Finance Ministry raised customs duties by 200 basis points on imported goods, officials said.' },
  { id: 'N2-time', cat: 'time swap', expect: 'block', claim: 'The exchange rate reached 50 pounds per dollar in March 2024', passage: 'The exchange rate reached 50 pounds per dollar in March 2023, a year earlier than analysts expected.' },
  { id: 'N3-units', cat: 'units change', expect: 'block', claim: 'The reservoir holds 5 billion cubic meters of water', passage: 'The reservoir holds 5 million cubic meters of water after the latest filling phase.' },
  { id: 'N4-causal', cat: 'unsupported causal claim', expect: 'block', claim: 'The currency float caused inflation to rise to 38 percent', passage: 'Inflation rose to 38 percent in September, official data showed, while the currency float remained under review by economists.' },
  { id: 'N5-partial', cat: 'partial support', expect: 'block', claim: 'Production fell 15 percent and exports doubled in 2024', passage: 'Production fell 15 percent in 2024 as factories cut shifts, the industrial chamber reported.' },
  { id: 'N6-contra', cat: 'contradiction', expect: 'block', claim: 'Unemployment declined to 7 percent in 2024', passage: 'Unemployment rose to 7 percent in 2024, reversing three years of improvement.' },
  { id: 'N7-entity', cat: 'entity swap', expect: 'block', claim: 'The African Development Bank approved a 500 million dollar loan for Egypt', passage: 'The World Bank approved a 500 million dollar loan for Morocco, regional officials confirmed.' },
  { id: 'N8-number', cat: 'number change', expect: 'block', claim: 'The committee reviewed 140 corruption cases in 2024', passage: 'The committee reviewed 104 corruption cases in 2024, according to its annual report.' },
];

console.log('pair         category                  expect  gate-D  cos    cov   guard  verdict');
const errors = [];
for (const pr of pairs) {
  const c = cos(pr.claim, pr.passage), cov = coverage(pr.claim, pr.passage), g = guards(pr.claim, pr.passage);
  const got = gateD(pr.claim, pr.passage) ? 'pass' : 'block';
  const err = got !== pr.expect;
  if (err) errors.push({ id: pr.id, cat: pr.cat, kind: got === 'pass' ? 'FALSE ACCEPT (unsupported claim would pass)' : 'FALSE BLOCK (true support rejected)' });
  console.log([pr.id.padEnd(12), pr.cat.padEnd(25), pr.expect.padEnd(7), got.padEnd(7), c.toFixed(2), cov.toFixed(2), (g || '-').padEnd(6), err ? 'ERROR' : 'ok'].join('  '));
}
console.log('\nObserved errors on this 12-pair holdout (scope probe, NOT calibration):');
if (!errors.length) console.log('  none');
errors.forEach(e => console.log(`  - ${e.id} [${e.cat}]: ${e.kind}`));
console.log('Scope: hand-authored English pairs simulating translated claims; small set, one gate configuration; results describe this set only and support no accuracy or generalization claim.');
