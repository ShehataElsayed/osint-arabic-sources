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
  return { terms: [...terms.keys()], candidates: top, known, txIntent, anchorMiss, confident: !txIntent && !anchorMiss && known && !!top.length && top[0].score >= minScore };
}

// The previous retrieval (kept only so tests can measure the change honestly).
export function baselineKeyword(q, items) {
  const n = normalize;
  const docs = items.map(t => n(t.name + ' ' + t.description.split(/[.؛]/)[0]));
  const terms = [...new Set(n(q).split(' ').filter(x => x.length > 3))].map(w => { const st = w.length > 4 ? w.replace(/^(ال|و|ب|ل)/, '') : w, df = docs.filter(d => d.includes(st)).length; return { st, wt: df ? Math.min(2, .6 + Math.log(items.length / df) / 3) : 0 }; });
  return items.map((t, i) => ({ t, id: i, score: terms.reduce((s, x) => s + (docs[i].includes(x.st) ? x.wt : 0), 0) })).sort((a, b) => b.score - a.score).slice(0, 24).filter(x => x.score > 0).slice(0, 15);
}
