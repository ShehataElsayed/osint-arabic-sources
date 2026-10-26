// Offline HOLDOUT study for the experimental xl translation gate — exercises the SHIPPED groundedWhy
// (worker/rag-worker.js), not a mirror. Separate from the 7 development fixtures in xl-paths.eval.mjs:
// new topics, varied paraphrase positives, negatives by category (actor swap, time swap, units change,
// unsupported causal claim, partial support, contradiction, entity swap, number change), plus positive
// probes proving the scale/causal guards do not over-block true support. Reports OBSERVED ERRORS ONLY:
// a small hand-authored set is a scope probe, not calibration — no accuracy or generalization claim.
import { ragTokens, groundedWhy } from '../worker/rag-lib.js';

const cos = (a, b) => { const va = new Map(), vb = new Map(); ragTokens(a).forEach(x => va.set(x, (va.get(x) || 0) + 1)); ragTokens(b).forEach(x => vb.set(x, (vb.get(x) || 0) + 1)); let d = 0, na = 0, nb = 0; for (const [x, c] of va) { na += c * c; if (vb.has(x)) d += c * vb.get(x); } for (const c of vb.values()) nb += c * c; return na && nb ? d / Math.sqrt(na * nb) : 0; };
const gate = (c, p) => groundedWhy(c, p, cos(c, p), false, true);

const pairs = [
  // positives: varied paraphrases, expect pass
  { id: 'P1-gdp', cat: 'paraphrase', expect: 'pass', claim: 'Egypt GDP grew by 2.4 percent in fiscal year 2024', passage: "Egypt's economy expanded by 2.4 percent in the 2024 fiscal year, the planning ministry said, driven by construction and communications." },
  { id: 'P2-flood', cat: 'paraphrase', expect: 'pass', claim: 'Floods displaced 30000 people in eastern Libya in September 2023', passage: 'More than 30000 people were displaced by floods in eastern Libya in September 2023 after two dams collapsed, according to the United Nations.' },
  { id: 'P3-vaccine', cat: 'paraphrase', expect: 'pass', claim: 'The health ministry vaccinated 12 million children against measles in 2024', passage: 'The health ministry said 12 million children received measles vaccinations during the 2024 national campaign.' },
  { id: 'P4-wheat', cat: 'paraphrase', expect: 'pass', claim: 'Egypt imported 5.5 million tons of wheat in 2023', passage: "Wheat imports into Egypt totaled 5.5 million tons in 2023, making it one of the world's largest buyers." },
  { id: 'P5-causal', cat: 'causal supported', expect: 'pass', claim: 'The dam collapse caused the displacement of 30000 people in 2023', passage: 'The dam collapse caused the displacement of 30000 people in 2023, the United Nations said in its situation report.' },
  { id: 'P6-units', cat: 'units consistent', expect: 'pass', claim: 'Trade volume reached 5 billion dollars in 2024', passage: 'Trade volume reached 5 billion dollars in 2024, up from 4.2 billion the year before, official data showed.' },
  // negatives by category, expect block
  { id: 'N1-actor', cat: 'actor swap', expect: 'block', claim: 'The Central Bank raised interest rates by 200 basis points', passage: 'The Finance Ministry raised customs duties by 200 basis points on imported goods, officials said.' },
  { id: 'N2-time', cat: 'time swap', expect: 'block', claim: 'The exchange rate reached 50 pounds per dollar in March 2024', passage: 'The exchange rate reached 50 pounds per dollar in March 2023, a year earlier than analysts expected.' },
  { id: 'N3-units', cat: 'units change', expect: 'block', claim: 'The reservoir holds 5 billion cubic meters of water', passage: 'The reservoir holds 5 million cubic meters of water after the latest filling phase.' },
  { id: 'N4-causal', cat: 'unsupported causal claim', expect: 'block', claim: 'The currency float caused inflation to rise to 38 percent', passage: 'Inflation rose to 38 percent in September, official data showed, while the currency float remained under review by economists.' },
  { id: 'N5-partial', cat: 'partial support', expect: 'block', claim: 'Production fell 15 percent and exports doubled in 2024', passage: 'Production fell 15 percent in 2024 as factories cut shifts, the industrial chamber reported.' },
  { id: 'N6-contra', cat: 'contradiction', expect: 'block', claim: 'Unemployment declined to 7 percent in 2024', passage: 'Unemployment rose to 7 percent in 2024, reversing three years of improvement.' },
  { id: 'N7-entity', cat: 'entity swap', expect: 'block', claim: 'The African Development Bank approved a 500 million dollar loan for Egypt', passage: 'The World Bank approved a 500 million dollar loan for Morocco, regional officials confirmed.' },
  { id: 'N8-number', cat: 'number change', expect: 'block', claim: 'The committee reviewed 140 corruption cases in 2024', passage: 'The committee reviewed 104 corruption cases in 2024, according to its annual report.' },
  { id: 'N9-scale', cat: 'units change (thousand/million)', expect: 'block', claim: 'The program supported 50 thousand farmers in 2024', passage: 'The program supported 50 million farmers in 2024 across all governorates, the ministry announced.' },
  { id: 'N10-ar-scale', cat: 'units change (Arabic)', expect: 'block', claim: 'بلغت الصادرات 5 مليار دولار في 2024', passage: 'بلغت الصادرات 5 مليون دولار في 2024 حسب بيان وزارة التجارة والصناعة الصادر اليوم.' },
];

console.log('pair          category                      expect  gate    cos    reason        verdict');
const errors = [];
for (const pr of pairs) {
  const why = gate(pr.claim, pr.passage);
  const got = why === '' ? 'pass' : 'block';
  const err = got !== pr.expect;
  if (err) errors.push({ id: pr.id, cat: pr.cat, kind: got === 'pass' ? 'FALSE ACCEPT (unsupported claim would pass)' : 'FALSE BLOCK (true support rejected)', why });
  console.log([pr.id.padEnd(13), pr.cat.padEnd(29), pr.expect.padEnd(7), got.padEnd(7), cos(pr.claim, pr.passage).toFixed(2), (why || '-').padEnd(13), err ? 'ERROR' : 'ok'].join('  '));
}
console.log('\nObserved errors on this ' + pairs.length + '-pair holdout (scope probe, NOT calibration):');
if (!errors.length) console.log('  none in this set — describes this set only, not general correctness');
errors.forEach(e => console.log(`  - ${e.id} [${e.cat}]: ${e.kind} (gate reason: ${e.why || 'passed'})`));
console.log('Scope: hand-authored pairs (EN simulating translated claims + AR same-language), one gate configuration; results describe this set only and support no accuracy or generalization claim.');
