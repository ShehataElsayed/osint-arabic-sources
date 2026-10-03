// Pure logic for the RAG section: claim type, retrieval, contradiction check, decision, chart data.
// Mirrors the four stages of the newsrag lab pipeline. Heuristics here are NOT a trained NLI model.
export const THRESHOLDS = Object.freeze({ minSimilarity: 0.35, contradiction: 0.5, minAgreeShare: 0.6 });
export const norm = s => String(s ?? '').toLowerCase().normalize('NFKC')
  .replace(/[\u064b-\u065f\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const STOP = new Set(['في','من','على','الى','عن','ان','هذا','هذه','ذلك','التي','الذي','هل','ما','كان','كانت','مع','او','ثم','قد','تم','بعد','قبل','هو','هي','و','ب','ل','ك']);
const NEG = ['لا','لم','لن','ليس','ليست','نفي','نفت','ينفي','تنفي','كذب','مفبرك','مزيف','زائف','غير صحيح','عار عن الصحه','لا صحه'];
export const tokens = s => norm(s).split(' ').map(t => (t.length > 4 && t.startsWith('ال') ? t.slice(2) : t)).filter(t => t && !STOP.has(t) && t.length > 1);

// Stage 1: question type by plain rules.
export function classifyClaim(text) {
  const t = norm(text);
  if (/\d|[٠-٩]/.test(String(text)) || /(نسبه|مليون|مليار|الف|عدد|ارتفع|انخفض|%)/.test(t)) return 'numeric';
  if (/(قال|صرح|اعلن|اكد|نسب|يزعم|قاله|تصريح)/.test(t)) return 'attribution';
  if (/(لقاح|مرض|علاج|سرطان|فيروس|دواء|صحه|وباء)/.test(t)) return 'health';
  return 'general';
}

// Stage 2: retrieval by term-frequency cosine.
function vec(ts) { const m = new Map(); ts.forEach(t => m.set(t, (m.get(t) || 0) + 1)); return m; }
export function cosine(a, b) {
  const va = vec(tokens(a)), vb = vec(tokens(b)); let dot = 0, na = 0, nb = 0;
  for (const [t, c] of va) { na += c * c; if (vb.has(t)) dot += c * vb.get(t); }
  for (const c of vb.values()) nb += c * c;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
export function retrieve(question, items, k = 5) {
  // Long texts dilute cosine, so score the best single sentence as well as the whole item.
  const score = it => Math.max(cosine(question, `${it.claim || ''} ${it.title || ''}`), cosine(question, `${it.claim || ''} ${it.text || ''} ${it.title || ''}`),
    ...String(it.text || '').split(/[.!؟?\n،]+/).filter(x => x.trim().length > 8).map(x => cosine(question, `${it.title || ''} ${x}`)));
  return items.map(it => ({ ...it, similarity: score(it) }))
    .sort((x, y) => y.similarity - x.similarity).slice(0, k);
}

// Stage 3: contradiction score. Uses model probabilities when the backend supplies them,
// otherwise a negation-parity heuristic over shared content words (placeholder, weak).
export function contradictionScore(question, item) {
  if (item.nli && typeof item.nli.contradiction === 'number') return { score: item.nli.contradiction, source: 'nli' };
  const q = norm(question), t = norm(`${item.claim || ''} ${item.text || ''}`);
  const has = s => NEG.some(n => (` ${s} `).includes(` ${n} `));
  const shared = tokens(question).filter(w => tokens(t).includes(w) && !NEG.includes(w)).length;
  const differ = has(q) !== has(t);
  return { score: differ && shared >= 2 ? 0.6 : 0, source: 'heuristic' };
}

// Stage 4: answer or abstain. Always carries the not-validated flags.
export function decide(question, rawItems, opts = {}) {
  const th = { ...THRESHOLDS, ...opts };
  const type = classifyClaim(question), reasons = [];
  const top = retrieve(question, rawItems, 5).filter(i => i.similarity >= th.minSimilarity);
  const base = { type, validated_for_release: false, autonomous_allowed: false, evidence: top };
  if (!rawItems.length) return { ...base, decision: 'abstain', reasons: ['no_sources'] };
  if (!top.length) return { ...base, decision: 'abstain', reasons: ['low_similarity'], evidence: [] };
  const checked = top.map(i => ({ ...i, contradiction: contradictionScore(question, i) }));
  base.evidence = checked;
  if (checked.some(i => i.contradiction.score >= th.contradiction)) reasons.push('contradiction');
  const ratings = checked.filter(i => i.rating).map(i => i.polarity || norm(i.rating));
  if (ratings.length > 1) {
    const counts = {}; ratings.forEach(r => counts[r] = (counts[r] || 0) + 1);
    if (Math.max(...Object.values(counts)) / ratings.length < th.minAgreeShare) reasons.push('split_vote');
  }
  if (!ratings.length) reasons.push('no_rating_in_sources');
  if (reasons.length) return { ...base, decision: 'abstain', reasons };
  return { ...base, decision: 'answer', reasons: [] };
}

// Chart request detection and chart data from retrieved real fields only.
export const wantsChart = q => /(رسم بياني|مخطط|رسم|chart|graph|plot)/i.test(String(q));
export function chartSpec(items, field = 'rating') {
  const counts = new Map();
  for (const it of items) { const v = String(it[field] ?? '').trim(); if (v) counts.set(v, (counts.get(v) || 0) + 1); }
  const data = [...counts].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  return { field, total: data.reduce((s, d) => s + d.value, 0), data };
}
