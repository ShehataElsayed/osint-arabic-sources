import { BACKEND_URL, EXTERNAL_AI } from './rag-config.js';
import { $, el, startTurn, typeInto, wireComposer, NOTICE } from './chat-ui.js';
// Identifiers are replaced by tokens on this device; the tokens are mapped back after the reply.
export function redact(text) {
  const map = {}, n = { EMAIL: 0, PHONE: 0, URL: 0, HANDLE: 0 };
  const put = (kind, v) => { const k = kind + (++n[kind]); map[k] = v; return k; };
  const s = text.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, m => put('EMAIL', m))
    .replace(/\bhttps?:\/\/\S+|\bwww\.\S+/gi, m => put('URL', m))
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, m => m.replace(/-/g, '\u2011'))
    .replace(/\+?\d[\d\s().-]{7,}\d/g, m => put('PHONE', m.trim()))
    .replace(/(^|\s)@([\w.]{2,})/g, (m, a, h) => a + put('HANDLE', h))
    .replace(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|info|io|gov|edu|co|me|tv|eg|sa|ae|sy|ly|iq|ps|jo|lb)\b/gi, m => put('URL', m));
  return { s, map };
}
export const restore = (v, map) => String(v).replace(/(EMAIL|PHONE|URL|HANDLE)\d+/g, m => map[m] ?? m);
const KINDS = ['person', 'username', 'email', 'phone', 'domain', 'image', 'topic'];
function fill(plan, map) {
  if (!KINDS.includes(plan.kind)) return false;
  const k = $('kind'); k.value = plan.kind; k.dispatchEvent(new Event('change'));
  for (const [id, v] of Object.entries(plan.fields || {})) { const i = $('f_' + id); if (i) i.value = restore(v, map).replace(/[\u2010-\u2015]/g, '-'); }
  return true;
}
async function ask(text) {
  $('greet').hidden = true; const body = startTurn($('ai-thread'), text);
  let note = 'تعذّر فهم الطلب الآن. استخدم النموذج أدناه مباشرة.', ok = false;
  if (EXTERNAL_AI && BACKEND_URL) {
    const { s, map } = redact(text);
    try { const r = await fetch(BACKEND_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'plan', text: s }) }); const pl = r.ok ? (await r.json()).plan : null;
      if (pl && fill(pl, map)) { ok = true; note = (pl.note ? restore(pl.note, map) + ' ' : '') + 'ملأتُ النموذج وولّدتُ الأوامر من قوالب الدليل الثابتة، وهي تظهر أدناه.'; $('build').click(); } } catch { /* manual form remains */ }
  }
  body.replaceChildren(); const t = el('h3', null, 'answer-title'); body.append(t); await typeInto(t, note);
  if (ok) { const a = el('a', 'انتقل إلى الخطة الاستقصائية ↓', 'jump fade'); a.href = '#outbox'; body.append(a); $('outbox').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
}
wireComposer({ form: $('ai-form'), input: $('ai-q'), send: $('ai-send'), chips: [...document.querySelectorAll('#ai-chips .chip')], onAsk: ask });
if (EXTERNAL_AI) $('ai-notice').textContent = NOTICE + ' الإيميلات والأرقام والروابط والنطاقات وأسماء الحسابات تُستبدل برموز على جهازك قبل الإرسال.';
