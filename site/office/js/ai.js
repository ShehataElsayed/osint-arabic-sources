/* Osh Office AI bridge. يستخدم مسارات خادم الدليل الموجودة فقط (Gemini أولًا ثم Workers AI
   تلقائيًا عند نفاد الحصة، ويُذكر المزوّد الفائز مع كل نتيجة). لا مفاتيح في المتصفح.
   الرسم البياني للتكلفة: فئات مجانية فقط؛ عند تجاوز الحصة يظهر خطأ واضح بدل أي تحويل مدفوع. */
import { BACKEND_URL, EXTERNAL_AI, AI_NOTICE, aiProviderName } from '../../rag-config.js';
import { buildIndex, search } from '../../tool-search.js';

export { AI_NOTICE, aiProviderName };

let _tools = null, _index = null;
async function toolsIndex() {
  if (_index) return _index;
  const r = await fetch('../search-tools.json');
  if (!r.ok) throw new Error('catalog_missing');
  _tools = await r.json();
  _index = buildIndex(_tools);
  return _index;
}
/* مرشحون من فهرس الدليل المحلي (مطابقة قاعدية) لمساري research_plan و ask */
export async function guideCandidates(q, n = 12) {
  const idx = await toolsIndex();
  const found = search(idx, q, { limit: n });
  const cands = (found.candidates || []).slice(0, n)
    .map(c => ({ id: c.id, name: c.t.name, description: c.t.description }))
    .filter(c => Number.isInteger(c.id) && c.name);
  return cands;
}

export async function aiPost(mode, payload, timeoutMs = 60000) {
  if (!EXTERNAL_AI || !BACKEND_URL) throw { reason: 'off' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(BACKEND_URL, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode, ...payload }), signal: ctrl.signal
    });
    if (!r.ok) throw { reason: 'http_' + r.status };
    return await r.json();
  } catch (e) {
    if (e && e.reason) throw e;
    throw { reason: 'network' };
  } finally { clearTimeout(timer); }
}

export function reasonText(reason, retryAfter) {
  if (reason === 'off') return 'الذكاء الاصطناعي غير متاح حاليًا من إعداد المنصة.';
  if (reason === 'http_429') return 'حصة الذكاء الاصطناعي المجانية مستنفدة مؤقتًا' + (retryAfter ? ` — أعد المحاولة بعد نحو ${Math.ceil(retryAfter / 60)} دقيقة.` : ' — أعد المحاولة لاحقًا اليوم.');
  if (reason === 'empty') return 'النص فارغ أو غير كافٍ للمعالجة.';
  if (reason === 'parse' || reason === 'filtered') return 'تعذّر تفسير استجابة النموذج هذه المرة؛ أعد المحاولة.';
  return 'تعذّر الوصول إلى خادم الذكاء الاصطناعي الآن؛ تحقق من الاتصال وأعد المحاولة.';
}

/* تلخيص نص (يعرض نظرة عامة + اقتباسات حرفية) */
export async function summarize(text, context = 'generic') {
  const j = await aiPost('summarize_text', { text, context });
  if (!j || !j.summary) throw { reason: (j && j.reason) || 'err', retryAfter: j && j.retry_after };
  return { overview: j.summary.overview || '', quotes: j.summary.key_quotes || [], provider: j.provider };
}
export async function extractEntities(text) {
  const j = await aiPost('extract_entities', { text });
  if (!j || !j.entities) throw { reason: (j && j.reason) || 'err', retryAfter: j && j.retry_after };
  return { ...j.entities, provider: j.provider };
}
export async function extractEvents(text) {
  const j = await aiPost('extract_events', { text });
  if (!j || !j.events) throw { reason: (j && j.reason) || 'err', retryAfter: j && j.retry_after };
  return { events: j.events, provider: j.provider };
}
export async function extractClaims(text) {
  const j = await aiPost('extract_claims', { text });
  if (!j || !j.claims) throw { reason: (j && j.reason) || 'err', retryAfter: j && j.retry_after };
  return { claims: j.claims, provider: j.provider };
}
export async function researchPlan(question) {
  const candidates = await guideCandidates(question, 12);
  if (!candidates.length) throw { reason: 'empty' };
  const j = await aiPost('research_plan', { question, candidates });
  if (!j || !j.plan) throw { reason: (j && j.reason) || 'err' };
  return j.plan;
}
export async function askGuide(question) {
  const candidates = await guideCandidates(question, 8);
  const j = await aiPost('ask', { question, candidates }, 90000);
  if (!j) throw { reason: 'err' };
  return j;
}
