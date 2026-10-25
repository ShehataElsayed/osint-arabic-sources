// Offline cross-language DEVELOPMENT study (fixtures, not calibration — holdout lives in xl-holdout.eval.mjs). Grounded pairs hand-authored from real run material
// (ef1/ef2) — no API calls. Positive = true support; negative = entity swap / direction flip /
// number change / unrelated overlap. Compares verification paths on translated-claim vs EN passage.
import { ragTokens } from '../worker/rag-worker.js';

const cos = (a, b) => { const va = new Map(), vb = new Map(); ragTokens(a).forEach(x => va.set(x, (va.get(x) || 0) + 1)); ragTokens(b).forEach(x => vb.set(x, (vb.get(x) || 0) + 1)); let d = 0, na = 0, nb = 0; for (const [x, c] of va) { na += c * c; if (vb.has(x)) d += c * vb.get(x); } for (const c of vb.values()) nb += c * c; return na && nb ? d / Math.sqrt(na * nb) : 0; };
const STOP = new Set(['the', 'and', 'that', 'with', 'from', 'this', 'its', 'for', 'are', 'was', 'has', 'have', 'been', 'according']);
const distinctive = s => [...new Set(ragTokens(s))].filter(t => t.length >= 3 && !STOP.has(t) && !/^\d/.test(t));
const digits = s => String(s).replace(/[,.\s]/g, '').match(/\d+/g) || [];
const NEG = new Set(['not', 'no', 'never', 'without', 'denies', 'denied', 'deny']);
const negParity = s => ragTokens(s).filter(t => NEG.has(t)).length % 2;
const DIR_UP = new Set(['increase', 'increas', 'rose', 'rise', 'grew', 'growth', 'reached', 'surge', 'jump', 'higher', 'gain', 'expand', 'expanded', 'expansion']);
const DIR_DOWN = new Set(['decrease', 'decreas', 'decline', 'declin', 'fell', 'fall', 'drop', 'dropp', 'down', 'lower', 'slump']);
const dir = s => { const t = ragTokens(s), u = t.some(x => DIR_UP.has(x)), d = t.some(x => DIR_DOWN.has(x)); return u && d ? 'mixed' : u ? 'up' : d ? 'down' : ''; };

const pairs = [
  { kind: 'pos', id: 'P1-pop', claim: 'Egypt population reached 106.5 million in July 2024', passage: "Egypt's population reached 106.5 million in July 2024, according to the statistics agency CAPMAS, which tracks births and deaths through its population clock." },
  { kind: 'pos', id: 'P2-ship', claim: 'Sea shipping prices increased by 60 percent since 2023', passage: 'Container shipping costs increased by 60 percent since 2023 as vessels rerouted around the Cape of Good Hope, industry data showed.' },
  { kind: 'pos', id: 'P3-sca', claim: 'The Suez Canal Authority announced that it is closely following developments', passage: 'The Suez Canal Authority announced it is closely monitoring developments in the Red Sea to assess their impact on navigation.' },
  { kind: 'neg', id: 'N1-density', claim: 'Egypt population reached 106.5 million in July 2024', passage: "Egypt's population density reached 106.5 people per square kilometer in 2024, with most residents concentrated along the Nile valley." },
  { kind: 'neg', id: 'N2-direction', claim: 'Sea shipping prices increased by 60 percent since 2023', passage: 'Shipping prices decreased by 60 percent since 2023 as demand collapsed on major routes, industry data showed.' },
  { kind: 'neg', id: 'N3-number', claim: 'Egypt population reached 106.5 million in July 2024', passage: "Egypt's population reached 105.6 million in July 2024, according to the statistics agency." },
  { kind: 'neg', id: 'N4-canal', claim: 'The Suez Canal Authority announced that it is closely following developments', passage: 'The Panama Canal Authority announced new transit fees for 2024 as vessel traffic recovered through the waterway.' },
];

const SCALE = new Set(['الف', 'ملي', 'مليار', 'بلي', 'تريلي', 'thousand', 'million', 'billion', 'trillion']);
const scalesOf = s => new Set(ragTokens(s).filter(t => SCALE.has(t)));
const CAUSAL_TOK = new Set(['cause', 'caused', 'causing', 'because', 'attributed', 'blamed', 'blames']);
const CAUSAL_PHRASE = ['due to', 'because of', 'led to', 'leads to', 'leading to', 'result in', 'resulted in', 'results in', 'attributed to', 'blamed for'];
const hasCausal = s => { const n = s.toLowerCase(); return CAUSAL_PHRASE.some(x => (' ' + n + ' ').includes(x)) || n.split(/\s+/).some(w => CAUSAL_TOK.has(w)); };
const guards = (claim, passage) => {
  const pd = digits(passage).join(','), want = digits(claim);
  if (!want.every(n => pd.split(',').some(x => x.includes(n)))) return 'numbers';
  if (negParity(claim) !== negParity(passage)) return 'negation';
  const cs = scalesOf(claim); if (cs.size) { const ps = scalesOf(passage); if (![...cs].every(x => ps.has(x))) return 'units'; }
  if (hasCausal(claim) && !hasCausal(passage)) return 'causal';
  const cd = dir(claim); if (cd && cd !== 'mixed' && dir(passage) !== cd) return 'direction';
  return '';
};
const coverage = (claim, passage) => { const pt = new Set(ragTokens(passage)), d = distinctive(claim); return d.length ? d.filter(t => pt.has(t)).length / d.length : 0; };

const paths = {
  'A current (cos>=0.78)': (c, p) => cos(c, p) >= 0.78 && guards(c, p) === '',
  'B loose (cos>=0.4)': (c, p) => cos(c, p) >= 0.4 && guards(c, p) === '',
  'C full coverage + cos>=0.4': (c, p) => cos(c, p) >= 0.4 && guards(c, p) === '' && coverage(c, p) === 1,
  'D 2/3 coverage + cos>=0.4': (c, p) => cos(c, p) >= 0.4 && guards(c, p) === '' && coverage(c, p) >= 0.66,
};
console.log('pair        kind  cos    cov   ' + Object.keys(paths).map(k => k.split(' ')[0]).join('   '));
for (const pr of pairs) {
  const row = [pr.id.padEnd(11), pr.kind, cos(pr.claim, pr.passage).toFixed(2), coverage(pr.claim, pr.passage).toFixed(2)];
  for (const fn of Object.values(paths)) row.push(fn(pr.claim, pr.passage) ? 'PASS' : 'block');
  console.log(row.join('  '));
}
