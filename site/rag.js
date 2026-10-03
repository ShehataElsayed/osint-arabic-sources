import { decide, wantsChart, chartSpec, classifyClaim, retrieve } from './rag-core.js';
import { barChartSVG } from './rag-chart.js';
import { BACKEND_URL, MEASURED, EXTERNAL_AI } from './rag-config.js';
import { NOTICE } from './chat-ui.js';
const $ = id => document.getElementById(id);
const el = (tag, txt, cls) => { const n = document.createElement(tag); if (txt != null) n.textContent = txt; if (cls) n.className = cls; return n; };
const safeUrl = u => { try { return ['https:', 'http:'].includes(new URL(u).protocol) ? u : ''; } catch { return ''; } };
const TYPES = { numeric: 'رقمي', attribution: 'نسبة قول', health: 'صحي', general: 'عام' };
const REASONS = { no_sources: 'لا توجد مصادر', low_similarity: 'تشابه منخفض مع المصادر', contradiction: 'تناقض بين السؤال والمصدر', split_vote: 'المصادر منقسمة في الحكم', consistency: 'عينات النموذج غير متسقة', type_rule: 'نوع الادعاء يتطلب إجماعًا كاملًا', contradiction_model: 'النقد الذاتي وجد احتمال تناقض', recency: 'قد يحتاج مصدرًا حديثًا', conflict: 'يتعارض مع حكم منشور', no_rating_in_sources: 'لا حكم صريح في المصادر' };
let local = [];
if ($('mode')) $('mode').textContent = BACKEND_URL ? 'الوضع: فهرس أحكام التدقيق، ويُضاف مفتاح التدقيق لاحقًا.' : 'الوضع المحلي: الخلفية غير مفعّلة بعد، تعمل على مصادر تلصقها أنت داخل الصفحة فقط';
function renderLocal() { const b = $('sources'); b.replaceChildren(); local.forEach((s, i) => { const c = el('article', null, 'evidence-card'), r = el('div', null, 'row'), d = el('button', 'حذف', 'secondary'); d.type = 'button'; d.onclick = () => { local.splice(i, 1); renderLocal(); }; r.append(el('strong', `${i + 1}. ${s.title}`), d); c.append(r, el('small', `${s.publisher || 'ناشر غير محدد'} · ${s.rating || 'بلا حكم'}`)); b.append(c); }); if (!local.length) b.append(el('p', 'لا توجد مصادر بعد.', 'empty-state')); }
$('srcForm').onsubmit = e => { e.preventDefault(); const url = $('sUrl').value.trim(); if (url && !safeUrl(url)) { $('status').textContent = 'رابط غير صالح.'; return; } local.push({ title: $('sTitle').value.trim(), publisher: $('sPub').value.trim(), url, rating: $('sRating').value.trim(), text: $('sText').value.trim() }); $('srcForm').reset(); renderLocal(); };
let index = null;
async function loadIndex() { if (index) return index; try { const r = await fetch('./rag-factchecks.json'); index = r.ok ? await r.json() : { items: [], meta: {} }; } catch { index = { items: [], meta: {} }; } return index; }
async function fetchItems(q) {
  const idx = await loadIndex(); let extra = [];
  if (BACKEND_URL) { try { const r = await fetch(BACKEND_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: q }) }); if (r.ok) { const jn = await r.json(); extra = Array.isArray(jn.results) ? jn.results.filter(x => x.source === 'factcheck') : []; } } catch { /* backend optional */ } }
  const top = retrieve(q, idx.items.map(x => ({ ...x, title: x.claim.slice(0, 90), source: 'factcheck-index' })), 12).filter(x => x.similarity > 0.2).slice(0, 8);
  return [...top, ...extra, ...local];
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const badgeCls = r => /كاذب|كذب|false/.test(r) ? 'false' : /مضلل|مظلل|misleading/.test(r) ? 'mislead' : /صحيح|true/.test(r) ? 'true' : '';
async function typeInto(node, text) { if (REDUCED) { node.textContent = text; return; } const w = text.split(' '); node.textContent = ''; for (let i = 0; i < w.length; i++) { node.textContent += (i ? ' ' : '') + w[i]; await sleep(28); } }
function srcCard(it, i) {
  const c = el('article', null, 'src-card fade'); c.style.animationDelay = (i * 0.12) + 's';
  c.append(el('strong', `[E${i + 1}] ${it.title || it.claim || 'مصدر'}`), el('small', `${it.publisher || 'ناشر غير محدد'} · الحكم: ${it.rating || 'غير محدد'}${it.original && it.original !== it.rating ? ' (' + it.original + ')' : ''}`));
  const u = safeUrl(it.url); if (u) { const a = el('a', u); a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; c.append(a); }
  const m = []; if (it.similarity != null) m.push('التشابه ' + it.similarity.toFixed(2)); if (it.contradiction && typeof it.contradiction.score === 'number') m.push('التناقض ' + it.contradiction.score.toFixed(2)); if (m.length) c.append(el('small', m.join(' · ') + ' (استدلال بسيط)'));
  return c;
}
const polarity = r => { const c = badgeCls(String(r || '')); return c === 'true' ? 'true' : c === 'false' || c === 'mislead' ? 'false' : ''; };
const MARK = { pass: '✓', fail: '✗', na: '—' };
// Cross-check of the model's verdict against published ratings kept on this device (never sent to the model).
function crossCheck(model, evidence) {
  const pol = evidence.map(i => polarity(i.rating)).filter(Boolean);
  if (!pol.length) return { id: 'published', label: 'مطابقة أحكام منشورة', status: 'na', detail: 'لا حكم منشور مطابق' };
  const f = pol.filter(p => p === 'false').length, t = pol.length - f, against = model.verdict === 'supported' ? f > t : model.verdict === 'refuted' ? t > f : false;
  return { id: 'conflict', label: 'مطابقة أحكام منشورة', status: against ? 'fail' : 'pass', detail: `${t} صحيح · ${f} خاطئ أو مضلل` };
}
function criteriaBox(list) {
  const box = el('div', null, 'criteria fade'); box.append(el('strong', 'نتائج المعايير'));
  list.forEach(c => { const r = el('div', null, 'crit ' + c.status); r.append(el('span', MARK[c.status], 'mk'), el('span', c.label), el('small', c.id === 'type_rule' ? (TYPES[c.detail] || c.detail) : c.detail)); box.append(r); });
  box.append(el('small', 'هذه بوابة قواعد مأخوذة من المكتبة وتطبَّق على إجابة النموذج، وليست مراجعة مستقلة. لا تُعدّ الإجابة موثّقة.', 'crit-note'));
  return box;
}
async function show(q, res, model, body) {
  body.replaceChildren();
  const rated = res.evidence.filter(i => i.rating), tally = {}; rated.forEach(i => { tally[i.rating] = (tally[i.rating] || 0) + 1; });
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
  const title = el('h3', null, 'answer-title'); body.append(title);
  let crit = null, reasons = [...res.reasons], modelAnswer = '';
  if (model && !model.error) {
    const x = crossCheck(model, res.evidence); crit = [...model.criteria.slice(0, 4), x, ...model.criteria.slice(4)];
    const failed = model.reasons.map(r => r === 'contradiction' ? 'contradiction_model' : r);
    if (x.status === 'fail') failed.push('conflict');
    if (!failed.length) modelAnswer = model.answer || '';
    reasons = failed.length ? failed : reasons;
  }
  const lead = modelAnswer ? 'إجابة من معرفة النموذج، وهي ليست دليلاً:' : res.decision === 'answer' && top ? 'يوجد تدقيق سابق، والحكم السائد: ' : res.decision === 'answer' ? 'وُجدت مصادر ذات صلة بسؤالك.' : 'امتنعتُ عن الإجابة.';
  await typeInto(title, lead);
  if (!modelAnswer && res.decision === 'answer' && top) { title.append(el('span', top[0], 'badge ' + badgeCls(top[0])), document.createTextNode(` (${top[1]} من ${rated.length} نتائج)`)); }
  if (modelAnswer) { const p = el('p', null, 'model-answer'); body.append(p); await typeInto(p, modelAnswer); }
  body.append(el('p', `نوع السؤال: ${TYPES[classifyClaim(q)]}`, 'meta-line fade'));
  if (!modelAnswer && res.decision !== 'answer' && reasons.length) body.append(el('p', 'السبب: ' + [...new Set(reasons)].map(r => REASONS[r] || r).join('، '), 'why fade'));
  if (model && model.error) body.append(el('p', model.error === 'busy' ? 'خدمة النموذج مشغولة الآن، فعُرضت المصادر فقط.' : 'خدمة النموذج غير متاحة الآن، فعُرضت المصادر فقط.', 'meta-line fade'));
  if (crit) body.append(criteriaBox(crit));
  res.evidence.forEach((it, i) => body.append(srcCard(it, i)));
  if (wantsChart(q)) { const svg = barChartSVG(chartSpec(res.evidence, 'rating'), 'توزيع الأحكام في المصادر المسترجعة'); if (svg) { const box = el('div', null, 'chart fade'); box.dir = 'ltr'; box.innerHTML = svg; body.append(box); } else body.append(el('p', 'لا توجد بيانات حقيقية لرسم مخطط.', 'meta-line fade')); }
}
async function verifyModel(q) {
  if (!EXTERNAL_AI || !BACKEND_URL) return null;
  try { const r = await fetch(BACKEND_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'verify', question: q.replace(/مع رسم بياني|مع رسم/g, '').trim() }) }); return r.ok ? await r.json() : { error: 'upstream' }; } catch { return { error: 'upstream' }; }
}
let busy = false;
async function ask(q) {
  q = q.trim(); if (!q || busy) return; busy = true; $('ask').disabled = true;
  $('greet').hidden = true; $('question').value = ''; autosize();
  const turn = el('div', null, 'turn'), bot = el('div', null, 'bot'), body = el('div', null, 'bot-body');
  const dots = el('div', null, 'thinking'); dots.append(el('i'), el('i'), el('i')); body.append(dots);
  bot.append(el('div', null, 'spark'), body); turn.append(el('div', q, 'user-msg'), bot); $('thread').append(turn);
  turn.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
  try { const [items, model] = await Promise.all([fetchItems(q), verifyModel(q)]), res = decide(q, items); await show(q, res, model, body); } catch (e) { body.replaceChildren(el('p', 'تعذّر إكمال الطلب: ' + e.message, 'why')); }
  busy = false; $('ask').disabled = false;
}
const autosize = () => { const t = $('question'); t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 140) + 'px'; };
$('question').addEventListener('input', autosize);
$('question').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask($('question').value); } });
$('composer').onsubmit = e => { e.preventDefault(); ask($('question').value); };
document.querySelectorAll('.chip').forEach(c => c.onclick = () => ask(c.textContent));
$('measured').textContent = 'أرقام القياس التالية تخص مكتبة NewsRAG الأصلية بتصميمها الكامل، لا هذه البوابة المبسطة. ' + MEASURED;
if (EXTERNAL_AI && $('notice')) $('notice').textContent = NOTICE;
renderLocal();
