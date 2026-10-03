import { decide, wantsChart, chartSpec, classifyClaim, retrieve } from './rag-core.js';
import { barChartSVG } from './rag-chart.js';
import { BACKEND_URL, MEASURED } from './rag-config.js';
const $ = id => document.getElementById(id);
const el = (tag, txt, cls) => { const n = document.createElement(tag); if (txt != null) n.textContent = txt; if (cls) n.className = cls; return n; };
const safeUrl = u => { try { return ['https:', 'http:'].includes(new URL(u).protocol) ? u : ''; } catch { return ''; } };
const TYPES = { numeric: 'رقمي', attribution: 'نسبة قول', health: 'صحي', general: 'عام' };
const REASONS = { no_sources: 'لا توجد مصادر', low_similarity: 'تشابه منخفض مع المصادر', contradiction: 'تناقض بين السؤال والمصدر', split_vote: 'المصادر منقسمة في الحكم', no_rating_in_sources: 'لا حكم صريح في المصادر' };
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
async function show(q, res, body) {
  body.replaceChildren();
  const rated = res.evidence.filter(i => i.rating), tally = {}; rated.forEach(i => { tally[i.rating] = (tally[i.rating] || 0) + 1; });
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
  const title = el('h3', null, 'answer-title'); body.append(title);
  const lead = res.decision === 'answer' && top ? `يوجد تدقيق سابق، والحكم السائد: ` : res.decision === 'answer' ? 'وُجدت مصادر ذات صلة بسؤالك.' : 'امتنعتُ عن الإجابة.';
  await typeInto(title, lead);
  if (res.decision === 'answer' && top) { const b = el('span', top[0], 'badge ' + badgeCls(top[0])); title.append(b, document.createTextNode(` (${top[1]} من ${rated.length} نتائج)`)); }
  body.append(el('p', `نوع السؤال: ${TYPES[classifyClaim(q)]}`, 'meta-line fade'));
  if (res.reasons.length) body.append(el('p', 'السبب: ' + res.reasons.map(r => REASONS[r] || r).join('، '), 'why fade'));
  res.evidence.forEach((it, i) => body.append(srcCard(it, i)));
  if (wantsChart(q)) { const svg = barChartSVG(chartSpec(res.evidence, 'rating'), 'توزيع الأحكام في المصادر المسترجعة'); if (svg) { const box = el('div', null, 'chart fade'); box.dir = 'ltr'; box.innerHTML = svg; body.append(box); } else body.append(el('p', 'لا توجد بيانات حقيقية كافية للرسم البياني، فلم أرسم شيئًا.', 'why fade')); }
}
async function composeNote(q, res, body) {
  if (!BACKEND_URL) return;
  const tally = {}; res.evidence.forEach(i => { if (i.rating) tally[i.rating] = (tally[i.rating] || 0) + 1; });
  try { const r = await fetch(BACKEND_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'compose', question: q.replace(/مع رسم بياني|مع رسم/g, '').trim(), decision: res.decision, labels: Object.entries(tally).map(([rating, count]) => ({ rating, count })) }) });
    const t = r.ok ? (await r.json()).text : null; if (t) { const p = el('p', t, 'meta-line fade'); const h = body.querySelector('.answer-title'); h && h.after(p); } } catch { /* optional */ }
}
let busy = false;
async function ask(q) {
  q = q.trim(); if (!q || busy) return; busy = true; $('ask').disabled = true;
  $('greet').hidden = true; $('question').value = ''; autosize();
  const turn = el('div', null, 'turn'), bot = el('div', null, 'bot'), body = el('div', null, 'bot-body');
  const dots = el('div', null, 'thinking'); dots.append(el('i'), el('i'), el('i')); body.append(dots);
  bot.append(el('div', null, 'spark'), body); turn.append(el('div', q, 'user-msg'), bot); $('thread').append(turn);
  turn.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
  try { const items = await fetchItems(q), res = decide(q, items); await show(q, res, body); composeNote(q, res, body); } catch (e) { body.replaceChildren(el('p', 'تعذّر إكمال الطلب: ' + e.message, 'why')); }
  busy = false; $('ask').disabled = false;
}
const autosize = () => { const t = $('question'); t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 140) + 'px'; };
$('question').addEventListener('input', autosize);
$('question').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask($('question').value); } });
$('composer').onsubmit = e => { e.preventDefault(); ask($('question').value); };
document.querySelectorAll('.chip').forEach(c => c.onclick = () => ask(c.textContent));
$('measured').textContent = MEASURED;
renderLocal();
