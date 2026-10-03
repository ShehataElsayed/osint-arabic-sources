import { BACKEND_URL } from './rag-config.js';
const $ = id => document.getElementById(id);
const el = (t, txt, c) => { const n = document.createElement(t); if (txt != null) n.textContent = txt; if (c) n.className = c; return n; };
// Identifiers are replaced by tokens on this device; the tokens are mapped back after the reply.
export function redact(text) {
  const map = {}, n = { EMAIL: 0, PHONE: 0, URL: 0, HANDLE: 0 };
  const put = (kind, v) => { const k = kind + (++n[kind]); map[k] = v; return k; };
  let s = text.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, m => put('EMAIL', m))
    .replace(/\bhttps?:\/\/\S+|\bwww\.\S+/gi, m => put('URL', m))
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, m => m.replace(/-/g, "\u2011")).replace(/\+?\d[\d\s().-]{7,}\d/g, m => put('PHONE', m.trim()))
    .replace(/(^|\s)@([\w.]{2,})/g, (m, a, h) => a + put('HANDLE', h))
    .replace(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|info|io|gov|edu|co|me|tv|eg|sa|ae|sy|ly|iq|ps|jo|lb)\b/gi, m => put('URL', m));
  return { s, map };
}
export const restore = (v, map) => String(v).replace(/(EMAIL|PHONE|URL|HANDLE)\d+/g, m => map[m] ?? m);
const KINDS = ['person', 'username', 'email', 'phone', 'domain', 'image', 'topic'];
function fill(plan, map) {
  const k = $('kind'); if (!KINDS.includes(plan.kind)) return false;
  k.value = plan.kind; k.dispatchEvent(new Event('change'));
  for (const [id, v] of Object.entries(plan.fields || {})) { const i = $('f_' + id); if (i) i.value = restore(v, map).replace(/[\u2010-\u2015]/g, '-').replace(/^https?:\/\//i, id === 'domain' ? '' : '$&'); }
  return true;
}
const thread = $('ai-thread'), input = $('ai-q');
let busy = false;
async function send(text) {
  text = text.trim(); if (!text || busy || !BACKEND_URL) return; busy = true; $('ai-send').disabled = true; input.value = '';
  const { s, map } = redact(text);
  const turn = el('div', null, 'turn'), bot = el('div', null, 'bot'), body = el('div', null, 'bot-body'), dots = el('div', null, 'thinking');
  dots.append(el('i'), el('i'), el('i')); body.append(dots); bot.append(el('div', null, 'spark'), body);
  turn.append(el('div', text, 'user-msg'), bot); thread.append(turn);
  let note = 'تعذّر فهم الطلب الآن. استخدم النموذج أدناه مباشرة.';
  try {
    const r = await fetch(BACKEND_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'plan', text: s }) });
    const pl = r.ok ? (await r.json()).plan : null;
    if (pl && fill(pl, map)) { note = (pl.note ? restore(pl.note, map) + ' ' : '') + 'ملأتُ النموذج أدناه وولّدتُ الأوامر من القوالب الثابتة للدليل.'; $('build').click(); }
  } catch { /* fall back to the form */ }
  body.replaceChildren(el('p', note, 'answer-title'));
  busy = false; $('ai-send').disabled = false;
}
$('ai-form').onsubmit = e => { e.preventDefault(); send(input.value); };
input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); } });
document.querySelectorAll('#ai-chips .chip').forEach(c => c.onclick = () => send(c.textContent));
