// Cloudflare Worker (free plan). Secret: FACTCHECK_API_KEY. Open sources only; no Google scraping.
// Fact-check results are snippet + link only.
const ALLOWED_ORIGIN = 'https://shehataelsayed.github.io';
export const DENY_FULL_TEXT = ['afp.com', 'factuel.afp.com', 'misbar.com', 'arafacts'];
const cors = o => ({ 'access-control-allow-origin': o === ALLOWED_ORIGIN ? o : ALLOWED_ORIGIN, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', vary: 'origin' });
const json = (b, s, o) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', ...cors(o) } });
export const denied = url => { try { const h = new URL(url).hostname; return DENY_FULL_TEXT.some(d => h.includes(d)); } catch { return true; } };

const QSTOP = new Set(['هل','ما','ماذا','من','متى','اين','كيف','لماذا','كم','هي','هو','ان','إن','أن','في','على','الى','إلى','عن','مع','لم','لن','لا','ليس','قال','تم','كان','كانت','هذا','هذه','ذلك','التي','الذي','و','او','أو','ثم','قد','مليون','اليوم','عام']);
export const keywords = q => { const w = String(q).replace(/[؟?!.,،:;"()]/g, ' ').split(/\s+/).filter(t => t.length > 1 && !QSTOP.has(t)); return (w.length ? w : [String(q)]).slice(0, 6).join(' '); };
export async function factCheck(q, key, f = fetch) {
  if (!key) return [];
  const u = `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodeURIComponent(q)}&languageCode=ar&pageSize=8&key=${encodeURIComponent(key)}`;
  const r = await f(u); if (!r.ok) return [];
  const out = [];
  for (const c of (await r.json()).claims || []) for (const rv of c.claimReview || [])
    out.push({ title: rv.title || c.text, claim: c.text, publisher: rv.publisher?.name || rv.publisher?.site || '', url: rv.url, rating: rv.textualRating || '', date: rv.reviewDate || c.claimDate || '', text: '', fetch: 'link_only', source: 'factcheck' });
  return out;
}
// Optional external-AI step: writes one short Arabic sentence from the question + verdict labels only. No publisher text is sent.
// Secret: GEMINI_API_KEY (env). Model name: env GEMINI_MODEL. The provider is external and may use the text; the site shows a notice.
export const cleanLabels = l => (Array.isArray(l) ? l : []).slice(0, 8).map(x => ({ rating: String(x?.rating || '').slice(0, 40), count: Math.min(99, Number(x?.count) || 0) }));
export async function compose(question, labels, decision, env, f = fetch) {
  if (!env.GEMINI_API_KEY || !env.GEMINI_MODEL) return null;
  const ls = cleanLabels(labels).map(x => `${x.rating}: ${x.count}`).join('، ') || 'لا أحكام';
  const prompt = `اكتب جملة عربية واحدة قصيرة (أقل من 40 كلمة) تلخص النتيجة للصحفي. لا تضف معلومات من عندك، ولا روابط، ولا حكمًا جديدًا. السؤال: ${String(question).slice(0, 200)}\nالقرار: ${decision === 'answer' ? 'يوجد تدقيق سابق' : 'امتناع'}\nالأحكام المسترجعة: ${ls}`;
  const r = await f(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 120, temperature: 0.2 } }) });
  if (!r.ok) return null;
  const t = ((await r.json()).candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
  const allowed = new Set(cleanLabels(labels).map(x => x.rating));
  if (!t || t.length > 400 || /https?:|www\./i.test(t)) return null;
  const verdicts = ['كاذب', 'مضلل', 'صحيح', 'غير مؤكد'].filter(v => t.includes(v) && ![...allowed].some(a => a.includes(v)));
  return verdicts.length ? null : t;
}
// Platform-only tool recommender. Input: the user's query plus candidate tools taken from the site's own public tool list.
// Output ids must be among the candidates; links are never produced here (the page uses its own data).
export const cleanCandidates = c => (Array.isArray(c) ? c : []).slice(0, 15).map(x => ({ id: Number(x?.id), name: String(x?.name || '').slice(0, 120), description: String(x?.description || '').slice(0, 300) })).filter(x => Number.isInteger(x.id) && x.name);
export async function recommend(query, candidates, env, f = fetch) {
  const cs = cleanCandidates(candidates);
  if (!env.GEMINI_API_KEY || !env.GEMINI_MODEL || !cs.length) return null;
  const list = cs.map(x => `[${x.id}] ${x.name}: ${x.description}`).join('\n');
  const prompt = `أنت مساعد داخل دليل عربي للمصادر المفتوحة للصحفيين. اختر حتى 4 أدوات من القائمة فقط تناسب طلب المستخدم، ولا تذكر أي أداة غير موجودة فيها ولا تضف روابط. لكل أداة اكتب سببًا قصيرًا في جملة، ثم خطوات استخدام قصيرة مستمدة من الوصف فقط؛ وإن لم يكفِ الوصف فاكتب: راجع صفحة الأداة. أعد JSON فقط بالشكل {"picks":[{"id":رقم,"why":"...","how":"..."}]}.\nطلب المستخدم: ${String(query).slice(0, 300)}\nالأدوات:\n${list}`;
  const r = await f(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 2048, temperature: 0.2, responseMimeType: 'application/json' } }) });
  if (!r.ok) return { error: 'http_' + r.status };
  let j; try { j = JSON.parse(((await r.json()).candidates?.[0]?.content?.parts?.[0]?.text || '').replace(/^\s*```(?:json)?|```\s*$/g, '').trim()); } catch { return { error: 'parse' }; }
  const ids = new Set(cs.map(x => x.id)), seen = new Set(), bad = /https?:|www\./i;
  const picks = (Array.isArray(j?.picks) ? j.picks : []).filter(x => ids.has(Number(x?.id)) && !seen.has(Number(x.id)) && seen.add(Number(x.id)) && typeof x.why === 'string' && typeof x.how === 'string' && !bad.test(x.why + x.how)).slice(0, 4).map(x => ({ id: Number(x.id), why: x.why.slice(0, 240), how: x.how.slice(0, 360) }));
  return picks.length ? picks : { error: 'filtered' };
}
// Investigative-builder assistant: turns the user's description into a target kind and form fields. It never produces commands or links;
// the page builds commands deterministically. Identifiers (emails, phones, urls, handles) arrive already replaced by tokens.
export const PLAN_KINDS = { person: ['name', 'org', 'city', 'extra', 'exclude', 'from', 'to'], username: ['handle'], email: ['email'], phone: ['phone'], domain: ['domain'], image: ['imageurl'], topic: ['topic', 'city', 'exclude', 'from', 'to'] };
export const cleanPlan = (j) => {
  const kind = String(j?.kind || ''); if (!PLAN_KINDS[kind]) return null;
  const fields = {}; for (const k of PLAN_KINDS[kind]) { let v = String(j?.fields?.[k] ?? '').replace(/[\u2010-\u2015]/g, '-').trim().slice(0, 120); if (/https?:|www\./i.test(v) && k !== 'imageurl' && k !== 'domain') v = ''; if ((k === 'from' || k === 'to') && !/^\d{4}-\d{2}-\d{2}$/.test(v)) v = ''; if (v) fields[k] = v; }
  const note = String(j?.note || '').trim().slice(0, 300); if (/https?:|www\./i.test(note)) return null;
  return { kind, fields, note };
};
export async function plan(text, env, f = fetch) {
  if (!env.GEMINI_API_KEY || !env.GEMINI_MODEL || !String(text || '').trim()) return { error: 'off' };
  const kinds = Object.entries(PLAN_KINDS).map(([k, v]) => `${k} (${v.join(', ')})`).join('؛ ');
  const prompt = `أنت مساعد داخل منشئ أوامر البحث الاستقصائي لدليل عربي للصحفيين. حوّل وصف المستخدم إلى نوع هدف وحقول فقط، بدون أي أوامر بحث أو روابط. الأنواع وحقولها: ${kinds}. القيم الرمزية مثل EMAIL1 وPHONE1 وURL1 وHANDLE1 انسخها كما هي في الحقل المناسب. التواريخ بصيغة YYYY-MM-DD. لا تخترع معلومات لم تُذكر. اكتب note جملة عربية واحدة تشرح ما فهمته وما ينقصه. أعد JSON فقط: {"kind":"...","fields":{...},"note":"..."}.\nوصف المستخدم: ${String(text).slice(0, 500)}`;
  const r = await f(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 2048, temperature: 0.1, responseMimeType: 'application/json' } }) });
  if (!r.ok) return { error: 'http_' + r.status };
  let j; try { j = JSON.parse(((await r.json()).candidates?.[0]?.content?.parts?.[0]?.text || '').replace(/^\s*```(?:json)?|```\s*$/g, '').trim()); } catch { return { error: 'parse' }; }
  return cleanPlan(j) || { error: 'filtered' };
}
// Model-answer gate: a JS port of the NewsRAG decision rules applied to the model's own answer.
// It is not the Python library and has no trained NLI; the critic score is a model self-critique. validated_for_release stays false.
export const GATE = Object.freeze({ minAgreeShare: 0.6, contradiction: 0.5, samples: 3 });
const nrm = s => String(s ?? '').toLowerCase().normalize('NFKC').replace(/[\u064b-\u065f\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function claimType(text) {
  const t = nrm(text);
  if (/\d|[٠-٩]/.test(String(text)) || /(نسبه|مليون|مليار|الف|عدد|ارتفع|انخفض|%)/.test(t)) return 'numeric';
  if (/(قال|صرح|اعلن|اكد|نسب|يزعم|قاله|تصريح)/.test(t)) return 'attribution';
  if (/(لقاح|مرض|علاج|سرطان|فيروس|دواء|صحه|وباء)/.test(t)) return 'health';
  return 'general';
}
const VERDICTS = ['supported', 'refuted', 'uncertain'];
const cleanText = (s, n) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n); return /https?:|www\./i.test(t) ? '' : t; };
async function modelJson(prompt, env, f, temperature) {
  const r = await f(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 2048, temperature, responseMimeType: 'application/json' } }) });
  if (!r.ok) return { error: 'http_' + r.status };
  try { return { json: JSON.parse(((await r.json()).candidates?.[0]?.content?.parts?.[0]?.text || '').replace(/^\s*```(?:json)?|```\s*$/g, '').trim()) }; } catch { return { error: 'parse' }; }
}

// Source verification: do the sources cited in the model answer exist, and does the page text support the claim.
// Page text is compared locally (term overlap and numbers); it is never sent to the model and never shown.
const SRC_DENY = ['afp.com', 'misbar.com', 'arafacts'];
const stok = s => nrm(s).split(' ').filter(t => t.length > 2);
const cos = (a, b) => { const va = new Map(), vb = new Map(); stok(a).forEach(t => va.set(t, (va.get(t) || 0) + 1)); stok(b).forEach(t => vb.set(t, (vb.get(t) || 0) + 1)); let d = 0, na = 0, nb = 0; for (const [t, c] of va) { na += c * c; if (vb.has(t)) d += c * vb.get(t); } for (const c of vb.values()) nb += c * c; return na && nb ? d / Math.sqrt(na * nb) : 0; };
const digits = s => String(s).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[,٬\s]/g, '');
export function safeSourceUrl(u) {
  try { const x = new URL(String(u)); const h = x.hostname.toLowerCase(); if (x.protocol !== 'https:' || x.username || x.port || !h.includes('.') || /^[\d.]+$/.test(h) || h.includes(':') || /(^|\.)(localhost|local|internal)$/.test(h) || SRC_DENY.some(d => h.includes(d))) return ''; return x.href; } catch { return ''; }
}
export async function checkSource(src, claimText, nums, f = fetch) {
  const url = safeSourceUrl(src?.url); const out = { name: cleanText(src?.name, 80), url: '', host: '', exists: false, similarity: 0, numbers_ok: null, verified: false };
  if (!url) return out;
  out.host = new URL(url).hostname;
  try {
    const r = await f(url, { headers: { accept: 'text/html,text/plain', 'user-agent': 'Mozilla/5.0 (compatible; osint-guide-check)' }, redirect: 'follow', signal: AbortSignal.timeout(6000) });
    const ct = r.headers?.get?.('content-type') || 'text/html';
    if (!r.ok || !/text\/(html|plain)/i.test(ct)) return out;
    const text = (await r.text()).slice(0, 400000).replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&amp;/g, ' ');
    out.exists = true; out.url = url;
    out.similarity = Math.max(0, ...text.split(/[.!؟?\n]+/).filter(x => x.trim().length > 15).map(x => cos(claimText, x)));
    out.similarity = Math.round(out.similarity * 100) / 100;
    const body = digits(text), want = (nums || []).map(digits).filter(Boolean);
    out.numbers_ok = want.length ? want.every(n => body.includes(n)) : null;
    out.verified = out.similarity >= 0.35 && out.numbers_ok !== false;
  } catch { /* unreachable */ }
  return out;
}
export async function verifyModel(question, env, f = fetch) {
  const q = String(question || '').trim().slice(0, 300);
  if (!env.GEMINI_API_KEY || !env.GEMINI_MODEL || !q) return { error: 'off' };
  const draft = `أجب عن الادعاء أو السؤال التالي من معرفتك فقط، بالعربية، بدون روابط. إن لم تكن متأكدًا أو كان الأمر حديثًا فاجعل الحكم uncertain. أعد JSON فقط: {"verdict":"supported|refuted|uncertain","answer":"جملة أو جملتان","time_sensitive":true|false,"numbers":["أرقام أو تواريخ ذُكرت في الادعاء"],"sources":[{"name":"اسم الجهة","url":"https://..."}]}. اذكر حتى مصدرين فقط بروابط https تعرف أنها موجودة فعلًا، وإلا اترك المصادر فارغة ولا تخترع روابط. معنى supported أن الادعاء صحيح، وrefuted أنه خاطئ.\nالادعاء: ${q}`;
  const runs = await Promise.all(Array.from({ length: GATE.samples }, () => modelJson(draft, env, f, 0.7)));
  if (runs.some(x => x.error === 'http_429')) return { error: 'busy' };
  const ok = runs.filter(x => x.json && VERDICTS.includes(x.json.verdict)).map(x => ({ verdict: x.json.verdict, answer: cleanText(x.json.answer, 400), time: x.json.time_sensitive === true, numbers: Array.isArray(x.json.numbers) ? x.json.numbers.slice(0, 5).map(n => cleanText(n, 30)) : [], sources: Array.isArray(x.json.sources) ? x.json.sources.slice(0, 2) : [] }));
  if (!ok.length) return { error: 'upstream' };
  const counts = {}; ok.forEach(x => { counts[x.verdict] = (counts[x.verdict] || 0) + 1; });
  const [verdict, top] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const share = top / GATE.samples, lead = ok.find(x => x.verdict === verdict && x.answer) || ok[0];
  const type = claimType(q), strict = type !== 'general';
  const checked = await Promise.all((lead.sources || []).map(s => checkSource(s, `${q} ${lead.answer}`, lead.numbers, f)));
  const anyVerified = checked.some(s => s.verified), anyExists = checked.some(s => s.exists);
  const critic = await modelJson(`أنت مدقق ناقد. الادعاء: ${q}\nإجابة مقترحة: ${lead.answer} (الحكم: ${verdict}).\nقيّم من 0 إلى 1 مدى احتمال أن الإجابة تناقض وقائع معروفة أو أنها غير مدعومة. أعد JSON فقط: {"contradiction":0.0}`, env, f, 0);
  const cs = Number(critic.json?.contradiction), criticOk = Number.isFinite(cs) && cs >= 0 && cs <= 1;
  const criteria = [
    { id: 'consistency', label: 'اتساق العينات', status: verdict !== 'uncertain' && share >= GATE.minAgreeShare ? 'pass' : 'fail', detail: `${top} من ${GATE.samples} عينات: حكم ${{ supported: 'صحيح', refuted: 'خاطئ', uncertain: 'غير متأكد' }[verdict]}` },
    { id: 'type_rule', label: strict ? 'قاعدة النوع (إجماع ومصدر متحقَّق)' : 'قاعدة النوع', status: !strict || (share === 1 && anyVerified) ? 'pass' : 'fail', detail: type },
    { id: 'contradiction', label: 'نقد ذاتي للتناقض', status: criticOk && cs < GATE.contradiction ? 'pass' : 'fail', detail: criticOk ? cs.toFixed(2) : 'غير متاح' },
    { id: 'recency', label: 'حداثة الموضوع', status: ok.some(x => x.time) ? 'fail' : 'pass', detail: ok.some(x => x.time) ? 'قد يحتاج مصدرًا حديثًا' : 'لا مؤشر على حداثة' },
    { id: 'source_exists', label: 'وجود المصادر المذكورة', status: !checked.length ? 'na' : anyExists ? 'pass' : strict ? 'fail' : 'warn', detail: !checked.length ? 'لم يذكر النموذج مصدرًا' : `${checked.filter(s => s.exists).length} من ${checked.length} روابط فُتحت` },
    { id: 'source_support', label: 'دعم المصدر للادعاء', status: !anyExists ? 'na' : anyVerified ? 'pass' : strict ? 'fail' : 'warn', detail: !anyExists ? 'لا مصدر مفتوح' : `تشابه ${Math.max(...checked.map(s => s.similarity)).toFixed(2)} والأرقام ${checked.some(s => s.numbers_ok === true) ? 'موجودة' : checked.some(s => s.numbers_ok === false) ? 'غير موجودة' : 'غير مطلوبة'}` },
    { id: 'evidence', label: 'سند مستقل', status: 'na', detail: 'معرفة النموذج ليست دليلاً' },
  ];
  const failed = criteria.filter(c => c.status === 'fail').map(c => c.id);
  const out = { type, verdict, criteria, sources: checked.filter(s => s.exists).map(s => ({ name: s.name, url: s.url, host: s.host, similarity: s.similarity, verified: s.verified })), validated_for_release: false, decision: failed.length ? 'abstain' : 'answer', reasons: failed };
  if (!failed.length) out.answer = lead.answer;
  return out;
}
export async function answer(question, env, f = fetch) {
  const fc = await factCheck(question, env.FACTCHECK_API_KEY, f);
  const results = [...fc].map(x => (x.fetch === 'full' && denied(x.url) ? { ...x, fetch: 'link_only', text: '' } : x));
  return { results, factcheck_enabled: Boolean(env.FACTCHECK_API_KEY) };
}
export default {
  async fetch(req, env) {
    const o = req.headers.get('origin') || '';
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(o) });
    if (req.method !== 'POST') return json({ error: 'method' }, 405, o);
    if (o !== ALLOWED_ORIGIN) return json({ error: 'origin' }, 403, o);
    let b; try { b = await req.json(); } catch { return json({ error: 'json' }, 400, o); }
    if (b?.mode === 'compose') { try { return json({ text: await compose(String(b.question || ''), b.labels, b.decision, env) }, 200, o); } catch { return json({ text: null }, 200, o); } }
    if (b?.mode === 'recommend') { try { const rec = await recommend(String(b.query || ''), b.candidates, env); return json(Array.isArray(rec) ? { picks: rec } : { picks: null, reason: rec?.error || 'off' }, 200, o); } catch { return json({ picks: null }, 200, o); } }
    if (b?.mode === 'verify') { try { return json(await verifyModel(String(b.question || ''), env), 200, o); } catch { return json({ error: 'upstream' }, 200, o); } }
    if (b?.mode === 'plan') { try { const pl = await plan(String(b.text || ''), env); return json(pl.error ? { plan: null, reason: pl.error } : { plan: pl }, 200, o); } catch { return json({ plan: null, reason: 'err' }, 200, o); } }
    const q = String(b?.question || '').trim().slice(0, 300); if (!q) return json({ error: 'empty' }, 400, o);
    try { return json(await answer(q, env), 200, o); } catch { return json({ error: 'upstream' }, 502, o); }
  },
};
