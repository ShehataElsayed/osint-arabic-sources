// Candidate retrieval for the smart search. Pure functions, no network. Used by smart-search.js and tests.
export const normalize = s => String(s || '').toLowerCase().normalize('NFKD')
  .replace(/[\u064b-\u065f\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/هه(?=\s|$)/g, 'ه')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// Light Arabic stemmer: strips common prefixes/suffixes while keeping at least 3 letters. Latin words pass through.
export function stem(w) {
  if (!/[\u0600-\u06ff]/.test(w)) return w.length > 4 ? w.replace(/(ing|es|s)$/, '') : w;
  let x = w;
  for (const p of ['وال', 'بال', 'كال', 'فال', 'لل', 'ال', 'و', 'ب', 'ل', 'ف', 'ك']) if (x.startsWith(p) && x.length - p.length >= 3) { x = x.slice(p.length); break; }
  for (const s of ['ات', 'ان', 'ون', 'ين', 'يه', 'ها', 'هم', 'ه', 'ي']) if (x.endsWith(s) && x.length - s.length >= 3) { x = x.slice(0, -s.length); break; }
  return x;
}
const STOP = new Set(['اريد', 'احتاج', 'كيف', 'هل', 'ما', 'هو', 'هذا', 'هذه', 'ماذا', 'من', 'في', 'على', 'عن', 'الى', 'او', 'ان', 'مع', 'ثم', 'قبل', 'بعد', 'ذلك', 'شخص', 'اعرف', 'ابحث', 'البحث', 'بحث', 'اتتبع', 'اتابع', 'مكان', 'كل', 'لمعرفه', 'يوجد']);

// Task vocabulary: Arabic task words (normalised, stemmed forms are derived) mapped to extra terms that appear in tool names/descriptions.
const SYN = {
  'رابط': ['روابط', 'url', 'link', 'links'], 'روابط': ['رابط', 'url', 'link'], 'مشبوه': ['suspicious', 'phishing', 'malicious'],
  'ملف': ['ملفات', 'file', 'files'], 'حساب': ['حسابات', 'account', 'accounts'], 'صفحه': ['صفحات', 'page', 'webpage'],
  'exif': ['exiftool', 'metadata'], 'ميتا': ['metadata'], 'وصفيه': ['metadata', 'exif'],
  'تجاري': ['registry', 'register', 'companies'], 'ملكيه': ['ownership', 'beneficial', 'owner'],
  'ضغط': ['compression', 'ela', 'jpeg'], 'معالج': ['تعديل', 'تلاعب', 'manipulation', 'edit', 'edited'], 'تلاعب': ['manipulation', 'tamper', 'fake', 'edited'],
  'صوره': ['image', 'images', 'صور', 'reverse', 'photo'], 'صور': ['image', 'images', 'photo'], 'سفينه': ['vessel', 'ship', 'ais', 'maritime'], 'سفن': ['vessel', 'ship', 'ais'], 'بحري': ['vessel', 'ship', 'maritime', 'ais'],
  'طائره': ['flight', 'aircraft', 'adsb', 'ads', 'flightradar24'], 'طيران': ['flight', 'aircraft', 'ads', 'flightradar24'], 'رحله': ['flight', 'flightradar24'],
  'تيليجرام': ['telegram'], 'تلغرام': ['telegram'], 'تلجرام': ['telegram'], 'قناه': ['channel'],
  'تسريب': ['breach', 'pwned', 'leak', 'dehashed'], 'تسربت': ['breach', 'pwned', 'leak'], 'اختراق': ['breach', 'pwned', 'leak'], 'كلمات': ['password', 'passwords'],
  'نطاق': ['domain', 'whois', 'dns'], 'موقع': ['domain', 'website', 'whois'], 'مالك': ['whois', 'ownership', 'owner'], 'يملك': ['whois', 'ownership', 'owner'], 'تسجيل': ['whois', 'registration'],
  'شركه': ['company', 'companies', 'ownership', 'registry', 'register'], 'شركات': ['company', 'companies', 'ownership', 'registry', 'register'], 'سجلات': ['registry', 'register', 'records'],
  'ترجمه': ['translate', 'translator', 'translation'], 'ترجم': ['translate', 'translator'],
  'اقمار': ['satellite', 'imagery', 'landsat', 'earth'], 'قمر': ['satellite', 'imagery'], 'صناعيه': ['satellite', 'imagery'],
  'تغريدات': ['twitter', 'tweets'], 'تغريده': ['twitter'], 'تويتر': ['twitter'],
  'مولد': ['ai', 'deepfake', 'generated'], 'مزيفه': ['fake', 'deepfake', 'forensics', 'ai'], 'مزيف': ['fake', 'deepfake'], 'تلاعب': ['forensic', 'forensics', 'forensically', 'ela', 'manipulation'], 'تعديل': ['forensic', 'forensics', 'manipulation'], 'تزييف': ['fake', 'deepfake', 'forensics'], 'فحص': ['scan', 'scanner', 'check', 'forensic', 'forensics'],
  'ارشيف': ['archive', 'wayback', 'archived'], 'مؤرشفه': ['archive', 'wayback'], 'محذوفه': ['archive', 'wayback', 'cache'], 'قديمه': ['archive', 'wayback'],
  'مكشوفه': ['shodan', 'zoomeye', 'netlas', 'exposed', 'devices'], 'اجهزه': ['devices', 'shodan', 'zoomeye', 'netlas'],
  'يوتيوب': ['youtube'], 'فيديو': ['video', 'videos', 'youtube'], 'مقطع': ['video', 'videos', 'invid'],
  'وجه': ['face', 'facial', 'pimeyes', 'facecheck'], 'وجوه': ['face', 'facial'],
  'واي': ['wifi', 'wigle', 'wireless'], 'فاي': ['wifi', 'wigle', 'wireless'], 'شبكات': ['wigle', 'wireless', 'network'],
  'هاتف': ['phone', 'spydialer', 'thatsthem', 'dialer'], 'هواتف': ['phone', 'spydialer', 'thatsthem'], 'ارقام': ['phone', 'number'],
  'مستخدم': ['username', 'usernames', 'whatsmyname', 'namechk'], 'حساب': ['username', 'usernames', 'account', 'namechk'],
  'بريد': ['email', 'mail'], 'ايميل': ['email'],
  'خريطه': ['map', 'maps'], 'احداثيات': ['geolocation', 'coordinates', 'map'],
  'مزور': ['fake', 'forensics'], 'تحقق': ['verification', 'verify', 'invid', 'forensics'],
  'ip': ['ip', 'ip2location', 'trace', 'geolocation'], 'جغرافيا': ['geolocation', 'location', 'ip'], 'جغرافي': ['geolocation', 'location', 'ip'],
  'صيد': ['fishing', 'vessel'], 'مقارنه': ['compare', 'imagery', 'wayback'], 'خوادم': ['dns', 'servers', 'domain'], 'تحليل': ['analysis', 'dossier', 'dns']
};
const SYNS = Object.fromEntries(Object.entries(SYN).map(([k, v]) => [stem(k), v.map(x => stem(normalize(x)))]));
const tok = s => normalize(s).split(' ').filter(Boolean);

export function buildIndex(items) {
  const docs = items.map(t => {
    const name = tok(t.name).map(stem), desc = tok(t.description).map(stem);
    const tf = new Map(); for (const w of desc) tf.set(w, (tf.get(w) || 0) + 1);
    return { name: new Set(name), tf, len: desc.length || 1, seq: desc };
  });
  const df = new Map(); for (const d of docs) for (const w of new Set([...d.name, ...d.tf.keys()])) df.set(w, (df.get(w) || 0) + 1);
  const names = new Set(); for (const d of docs) for (const w of d.name) names.add(w);
  const avg = docs.reduce((s, d) => s + d.len, 0) / (docs.length || 1);
  return { items, docs, df, avg, names, n: docs.length };
}

// Jurisdiction roots (normalized surface matching): detect when a request names a jurisdiction the
// returned tools do not actually cover, so the UI can qualify results honestly instead of silently
// answering for a different jurisdiction. Arabic roots match as substrings of the normalized text
// (covers case/adjective/definite-article variants); Latin roots match on word boundaries.
const JURIS_AR = ['فرنس', 'بريطان', 'انجليز', 'انجلتر', 'المان', 'امريك', 'مصر', 'سعود', 'امارات', 'تركي', 'اسبان', 'ايطال', 'هولند', 'سويسر', 'كندا', 'كندي', 'استرال', 'الهند', 'هندي', 'الصين', 'صيني', 'روسيا', 'روسي', 'يابان', 'اردن', 'لبنان', 'مغرب', 'تونس', 'جزائر', 'عراق', 'سوري', 'ليبي', 'سودان', 'يمن', 'قطر', 'كويت', 'بحرين', 'عمان', 'اوروب'];
const JURIS_LAT = ['french', 'france', 'british', 'britain', 'england', 'uk', 'german', 'germany', 'american', 'america', 'usa', 'egypt', 'egyptian', 'saudi', 'emirati', 'emirates', 'uae', 'turkish', 'turkey', 'spanish', 'spain', 'italian', 'italy', 'dutch', 'netherlands', 'swiss', 'switzerland', 'canadian', 'canada', 'australian', 'australia', 'indian', 'india', 'chinese', 'china', 'russian', 'russia', 'japanese', 'japan', 'jordanian', 'jordan', 'lebanese', 'lebanon', 'moroccan', 'morocco', 'tunisian', 'tunisia', 'algerian', 'algeria', 'iraqi', 'iraq', 'syrian', 'syria', 'libyan', 'libya', 'sudanese', 'sudan', 'yemeni', 'yemen', 'qatari', 'qatar', 'kuwaiti', 'kuwait', 'bahraini', 'bahrain', 'omani', 'oman', 'european', 'europe'];
const LAT_BOUNDARY = r => new RegExp(`(^|[^\\p{L}])${r}($|[^\\p{L}])`, 'u');
export function jurisHits(text) {
  const n = normalize(text), padded = ` ${n} `, hits = new Set();
  for (const r of JURIS_AR) if (padded.includes(r)) hits.add(r);
  for (const r of JURIS_LAT) if (LAT_BOUNDARY(r).test(n)) hits.add(r);
  return [...hits];
}

// Transactional intent (booking, buying, tickets): the catalogue contains research tools only,
// so these requests are never confident regardless of which domain words co-occur.
const TX_INTENT = new Set(['حجز', 'احجز', 'حجزت', 'تذكره', 'تذاكر', 'تذكرت', 'شراء', 'اشترى', 'يشتري', 'ابتاع', 'اشتري'].map(w => stem(normalize(w))));

// Returns scored candidates; `confident` is false when evidence is too weak to recommend anything.
export function search(idx, query, { limit = 15, minScore = 2.2, minTerms = 1 } = {}) {
  const base = [...new Set(tok(query).filter(w => !STOP.has(w)).map(stem).filter(w => w.length > 1))];
  const txIntent = base.some(w => TX_INTENT.has(w));
  const terms = new Map();
  for (const w of base) { terms.set(w, 1); for (const s of SYNS[w] || []) if (!terms.has(s)) terms.set(s, 0.7); }
  const idf = w => Math.log(1 + (idx.n - (idx.df.get(w) || 0) + .5) / ((idx.df.get(w) || 0) + .5));
  let scored = idx.items.map((t, i) => {
    const d = idx.docs[i]; let score = 0, hits = 0;
    for (const [w, wt] of terms) {
      let s = 0; const tf = d.tf.get(w) || 0;
      if (tf) s += idf(w) * (tf * 2.2) / (tf + 1.2 * (0.25 + .75 * d.len / idx.avg));
      if (s) { hits++; score += s * wt; }
    }
    for (const a of base) {
      let nameBest = 0;
      if (d.name.has(a)) nameBest = idf(a) * 1.6;
      for (const syn of SYNS[a] || []) if (d.name.has(syn)) nameBest = Math.max(nameBest, idf(syn) * 1.6 * 0.5);
      score += nameBest;
    }
    return { t, id: i, score, hits };
  }).filter(x => x.hits >= minTerms).sort((a, b) => b.score - a.score);
  // Same tool can be catalogued under several branches; recommend each URL once, keeping its best-scored entry.
  const seenUrl = new Set();
  scored = scored.filter(x => { const u = x.t.url || x.t.name; return !seenUrl.has(u) && seenUrl.add(u); });
  // Anchor filter: query terms with known capability vocabulary must actually be served by a
  // recommended tool; otherwise the honest answer is low confidence (e.g. a jurisdiction or
  // capability the catalogue does not cover).
  const anchors = base.filter(w => SYNS[w] || (idx.names.has(w) && w.length > 2));
  let anchorMiss = false;
  if (anchors.length) {
    const kept = scored.filter(x => anchors.some(a => [a, ...(SYNS[a] || [])].some(w => idx.docs[x.id].tf.has(w) || idx.docs[x.id].name.has(w))));
    if (kept.length) scored = kept; else anchorMiss = true;
  }
  // Phrase proximity: an adjacent pair of query concepts in a description is much stronger
  // intent evidence than the same words scattered. Synonym-expanded on both sides.
  const w1 = base.filter(w => terms.get(w) === 1);
  for (const x of scored) {
    const seq = idx.docs[x.id].seq; let bonus = 0;
    for (let i = 0; i + 1 < seq.length; i++) {
      for (const a of w1) {
        const aw = [a, ...(SYNS[a] || [])];
        if (!aw.includes(seq[i])) continue;
        for (const b of w1) {
          if (a === b) continue;
          const bw = [b, ...(SYNS[b] || [])];
          if (bw.includes(seq[i + 1])) { bonus += 0.5 * (idf(a) + idf(b)) * 0.5; }
        }
      }
    }
    if (bonus) x.score += Math.min(bonus, 8);
    // Coordination/coverage: reward covering many distinct query concepts (a concept counts
    // once whether matched directly or through a synonym), not just one strong term.
    const d = idx.docs[x.id]; let cov = 0;
    for (const a of w1) {
      const aw = [a, ...(SYNS[a] || [])];
      if (aw.some(w => d.tf.has(w) || d.name.has(w))) cov += 0.4 * idf(a);
    }
    x.score += Math.min(cov, 10);
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, limit);
  // Abstain unless the query contains task vocabulary we know (synonym table or a tool name) and the best match is strong enough.
  const known = base.some(w => SYNS[w] || (idx.names.has(w) && w.length > 2));
  // If the request names a jurisdiction, at least one displayed tool should actually mention it;
  // otherwise the results are cross-jurisdiction alternatives and must be labeled as such.
  const queryJuris = jurisHits(query);
  const jurisdictionMiss = !!queryJuris.length && !!top.length && !top.slice(0, 6).some(x => {
    const it = idx.items[x.id] || {};
    return jurisHits(`${it.name || ''} ${it.description || ''}`).some(r => queryJuris.includes(r));
  });
  return { terms: [...terms.keys()], candidates: top, known, txIntent, anchorMiss, jurisdictionMiss, queryJuris, confident: !txIntent && !anchorMiss && known && !!top.length && top[0].score >= minScore };
}

// The previous retrieval (kept only so tests can measure the change honestly).
export function baselineKeyword(q, items) {
  const n = normalize;
  const docs = items.map(t => n(t.name + ' ' + t.description.split(/[.؛]/)[0]));
  const terms = [...new Set(n(q).split(' ').filter(x => x.length > 3))].map(w => { const st = w.length > 4 ? w.replace(/^(ال|و|ب|ل)/, '') : w, df = docs.filter(d => d.includes(st)).length; return { st, wt: df ? Math.min(2, .6 + Math.log(items.length / df) / 3) : 0 }; });
  return items.map((t, i) => ({ t, id: i, score: terms.reduce((s, x) => s + (docs[i].includes(x.st) ? x.wt : 0), 0) })).sort((a, b) => b.score - a.score).slice(0, 24).filter(x => x.score > 0).slice(0, 15);
}

// Capability scoping (2026-10-29 live regression: a photo-republication query ranked a satellite
// map-imagery archive first on embedding similarity alone). A tool whose own name/description
// restricts it to satellite/map imagery mismatches a query that never invokes that medium;
// gateScopes demotes those mismatches below scope-compatible tools and labels them. Nothing is
// dropped, and naming the medium restores the tool. General rule over tool text - no per-name
// handling. Only satellite/map imagery is restrictive: photo, video and audio intentionally are
// not, because generic multimedia tools (verification plugins, platforms, deepfake scanners)
// legitimately span them and demotion hid exactly those tools in catalogue review 2026-10-29.
export const SCOPES = [
  { id: 'satmap', label: 'صور الخرائط والأقمار الصناعية', restrictive: true, terms: ['قمر صناعي', 'اقمار صناعيه', 'خريطه', 'خرائط', 'فضائي', 'فضائيه', 'satellite', 'landsat'] },
];
export function toolScopes(text) {
  const n = ' ' + normalize(text) + ' ';
  return SCOPES.filter(s => s.terms.some(t => n.includes(t))).map(s => s.id);
}
// Full-catalogue semantic fusion: the worker's semantic_catalog mode ranks the WHOLE
// catalogue server-side (precomputed bge-m3 vectors + one query embedding); the lexical
// candidates stay the other ranking signal. RRF (k=60, same constant as fuseRanks) blends
// the two orders: a strong lexical match cannot be buried, and a semantically strong tool
// the keyword pass missed entirely can now surface - that is the point of the full-catalogue
// pass. Tools present in only one list get that list's contribution alone.
export function fuseSemanticCatalog(lexCands, semRanked) {
  const K = 60, byId = new Map();
  (Array.isArray(semRanked) ? semRanked : []).forEach((x, i) => { byId.set(x.id, { t: x.t, id: x.id, sem: x.s, rrf: 1 / (K + i + 1) }); });
  (Array.isArray(lexCands) ? lexCands : []).forEach((c, i) => {
    const e = byId.get(c.id);
    if (e) e.rrf += 1 / (K + i + 1);
    else byId.set(c.id, { t: c.t, id: c.id, sem: null, rrf: 1 / (K + i + 1) });
  });
  return [...byId.values()].sort((a, b) => b.rrf - a.rrf);
}

// Abstention floor for the full-catalogue path when the lexical pass produced NO confident
// candidates: semantic suggestions are only shown above this cosine. Chosen from the small
// self-authored set (tests/semantic-catalog.eval.mjs): the 8 out-of-scope questions top out
// at 0.457 (excluding 0.542 for a genuinely OSINT-adjacent car-identification tool), while
// sampled in-scope questions top at >= 0.55. Indicative only - tiny sample, not a calibrated
// separation guarantee.
export const SEM_CATALOG_FLOOR = 0.5;

export function gateScopes(query, scored) {
  const qs = toolScopes(query);
  for (const c of scored) {
    const miss = toolScopes(`${c.t.name} ${c.t.description}`).find(s => !qs.includes(s) && SCOPES.find(x => x.id === s).restrictive);
    c.scopeMismatch = miss ? SCOPES.find(s => s.id === miss).label : null;
  }
  return [...scored].sort((a, b) => ((a.scopeMismatch ? 1 : 0) - (b.scopeMismatch ? 1 : 0)) || (b.rrf - a.rrf));
}
