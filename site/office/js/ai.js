/* Osh Office AI bridge. يستخدم مسارات خادم الدليل الموجودة فقط (Gemini أولًا ثم Workers AI
   تلقائيًا عند نفاد الحصة، ويُذكر المزوّد الفائز مع كل نتيجة). لا مفاتيح في المتصفح.
   الرسم البياني للتكلفة: فئات مجانية فقط؛ عند تجاوز الحصة يظهر خطأ واضح بدل أي تحويل مدفوع. */
import { BACKEND_URL, EXTERNAL_AI, AI_NOTICE } from '../../rag-config.js';
import { buildIndex, search } from '../../tool-search.js';

import {askResponseProblem,askProblemMessage} from '../../ask-guard.js';
import {buildAskReport} from '../../assistant-report.js';
export {AI_NOTICE};
export const aiProviderName=p=>p==='gemini'?'عبر نموذج Gemini من Google':p==='workers-ai'?'عبر نموذج Workers AI على Cloudflare':'المزوّد غير مذكور في الاستجابة';
let latest=null;
export const latestAI=()=>latest?structuredClone(latest):null;
export function attachAI(file,envelope=latestAI()) {if(!envelope)return;file.aiHistory=[...(file.aiHistory||[]),structuredClone(envelope)];file.aiProvenance=structuredClone(envelope);showAIStatus(file)}
export const decisionName=d=>({answer:'إجابة مقترحة بعد الفحص',extractive:'مقتطفات فقط، لا إجابة مكتملة',insufficient:'أدلة غير كافية'})[d]||d;
export function showAIStatus(file){const p=file.aiProvenance;if(!p)return;let e=document.querySelector('[data-ai-status]');if(!e){e=document.createElement('p');e.dataset.aiStatus='';e.className='osh-ai-status';document.querySelector('.osh-bar')?.after(e)}e.textContent='محتوى آلي غير مراجع - '+aiProviderName(p.provider)+(p.result?.decision?' - الحالة الأصلية: '+decisionName(p.result.decision):'')+' - المصدر والنتيجة الأصلية محفوظان في نسخة JSON.'}
export const draftNotice='مسودة آلية غير مراجعة، ليست دليل نشر. راجع المصادر والحدود قبل الاعتماد.';
export function askReport(question,result){return 'الحالة الأصلية: '+decisionName(result.decision||'answer')+'\n'+(result.insufficient_reason||'')+'\n'+buildAskReport({question,result,catalog:_tools||[]})}


let _tools = null, _index = null;
async function toolsIndex() {
  if (_index) return _index;
  const r = await fetch(new URL('../../search-tools.json', import.meta.url));
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
  latest=null;
  if (!EXTERNAL_AI || !BACKEND_URL) throw { reason: 'off' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(BACKEND_URL, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode, ...payload }), signal: ctrl.signal
    });
    if (!r.ok) throw { reason: 'http_' + r.status };
    const result=await r.json();latest={mode,provider:result.provider||result.plan?.provider||'not-reported',sourceText:payload.text||payload.question||'',sourceUrl:location.href,result:structuredClone(result),review:'unreviewed',generatedAt:Date.now()};return result;
  } catch (e) {
    if (e && e.reason) throw e;
    throw { reason: 'network' };
  } finally { clearTimeout(timer); }
}

export function reasonText(reason, retryAfter) {
  if(reason==='bad_shape'||reason==='empty_answer')return askProblemMessage(reason);
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
  const problem=askResponseProblem(j);if(problem){latest=null;throw {reason:problem}}
  return j;
}
