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
// Optional Gemini step: writes one short Arabic sentence from the question + verdict labels only. No publisher text is sent.
// Secret: GEMINI_API_KEY (env). Model name: env GEMINI_MODEL. Unpaid Gemini terms apply: content may be used by Google.
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
    if (b?.mode === 'plan') { try { const pl = await plan(String(b.text || ''), env); return json(pl.error ? { plan: null, reason: pl.error } : { plan: pl }, 200, o); } catch { return json({ plan: null, reason: 'err' }, 200, o); } }
    const q = String(b?.question || '').trim().slice(0, 300); if (!q) return json({ error: 'empty' }, 400, o);
    try { return json(await answer(q, env), 200, o); } catch { return json({ error: 'upstream' }, 502, o); }
  },
};
