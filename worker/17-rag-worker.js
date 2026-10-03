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
    const q = String(b?.question || '').trim().slice(0, 300); if (!q) return json({ error: 'empty' }, 400, o);
    try { return json(await answer(q, env), 200, o); } catch { return json({ error: 'upstream' }, 502, o); }
  },
};
