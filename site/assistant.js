// مساعد NewsRAG: unified tool. RAG mode (your sources, Gemini-grounded answers with [E#] citations)
// and viral-claim mode (Gemini verdict + automated source checks). Honest fallbacks, no invented states.
import { retrieve } from './rag-core.js';
import { BACKEND_URL, EXTERNAL_AI } from './rag-config.js';
import { NOTICE } from './chat-ui.js';
import { buildRagReport, buildVerifyReport } from './assistant-report.js';

const $ = id => document.getElementById(id);
const el = (tag, txt, cls) => { const n = document.createElement(tag); if (txt != null) n.textContent = txt; if (cls) n.className = cls; return n; };
const safeUrl = u => { try { return ['https:', 'http:'].includes(new URL(u).protocol) ? u : ''; } catch { return ''; } };
const esc = s => String(s ?? '');
const FORCE_LOCAL = new URLSearchParams(location.search).has('local');
const SERVER = !FORCE_LOCAL && BACKEND_URL;
const STORE_KEY = 'newsrag-sources-v1';
const SESSION_KEY = 'newsrag-sources-session-v1';
const OPT_KEY = 'newsrag-sources-keep-local';

// ---------- sources store: session-scoped by default; on-device only with explicit opt-in ----------
let keepLocal = false;
try { keepLocal = localStorage.getItem(OPT_KEY) === '1'; } catch { /* blocked */ }
let sources = [];
try { sources = JSON.parse((keepLocal ? localStorage.getItem(STORE_KEY) : sessionStorage.getItem(SESSION_KEY)) || '[]'); } catch { sources = []; }
const persist = () => {
  try {
    if (keepLocal) { localStorage.setItem(STORE_KEY, JSON.stringify(sources)); sessionStorage.removeItem(SESSION_KEY); }
    else { sessionStorage.setItem(SESSION_KEY, JSON.stringify(sources)); localStorage.removeItem(STORE_KEY); }
  } catch { /* full or blocked */ }
};
function renderSources() {
  const b = $('srcList'); b.replaceChildren();
  $('srcCount').textContent = sources.length ? `${sources.length} مصدر محفوظ ${keepLocal ? 'على هذا الجهاز' : 'لهذه الجلسة فقط'}` : 'لا توجد مصادر بعد.';
  sources.forEach((s, i) => {
    const c = el('article', null, 'card src-item');
    const head = el('div', null, 'row'); head.style.justifyContent = 'space-between';
    head.append(el('strong', `${i + 1}. ${s.title}`));
    const del = el('button', 'حذف', 'secondary'); del.type = 'button'; del.setAttribute('aria-label', 'احذف ' + s.title);
    del.onclick = () => { sources.splice(i, 1); persist(); renderSources(); };
    head.append(del); c.append(head);
    c.append(el('small', [s.publisher || 'ناشر غير محدد', s.published_at || 'تاريخ غير معروف', s.url ? 'له رابط' : 'بلا رابط', s.text.length + ' حرف'].join(' · '), 'muted'));
    b.append(c);
  });
}
const normKey = s => String(s || '').replace(/\s+/g, ' ').trim();
const dupIndex = (title, url, text) => sources.findIndex(s => (url && s.url === url) || (normKey(s.title) === normKey(title) && normKey(s.text) === normKey(text)));
$('srcForm').onsubmit = e => {
  e.preventDefault();
  const url = $('sUrl').value.trim();
  if (url && !safeUrl(url)) { $('srcStatus').textContent = 'رابط غير صالح.'; return; }
  const t = $('sText').value.trim();
  if (t.length < 40) { $('srcStatus').textContent = 'نص المصدر قصير جدًا (٤٠ حرفًا على الأقل).'; return; }
  const title = $('sTitle').value.trim();
  const dup = dupIndex(title, url, t);
  const rec = { id: 'S' + Date.now().toString(36), title, publisher: $('sPub').value.trim(), url, published_at: $('sDate').value, source_type: $('sType').value, text: t };
  if (dup >= 0) { rec.id = sources[dup].id; sources[dup] = rec; } else { sources.push(rec); }
  persist(); renderSources();
  $('srcStatus').textContent = dup >= 0 ? 'المصدر موجود بالفعل؛ حُدّث بدلًا من تكراره.' : 'أُضيف المصدر.';
  $('srcForm').reset();
};
$('clearSources').onclick = () => { if (sources.length && confirm('حذف كل المصادر المحفوظة؟')) { sources = []; try { localStorage.removeItem(STORE_KEY); sessionStorage.removeItem(SESSION_KEY); } catch { /* blocked */ } persist(); renderSources(); } };
$('ingestBtn').onclick = async () => {
  const u = $('ingestUrl').value.trim();
  if (!safeUrl(u)) { $('srcStatus').textContent = 'رابط غير صالح.'; return; }
  if (!SERVER) { $('srcStatus').textContent = 'إحضار الروابط يحتاج تفعيل الخلفية (وضع محلي حاليًا).'; return; }
  const btn = $('ingestBtn'); busyWith(btn, true);
  try {
    const res = await post({ mode: 'ingest', url: u });
    if (res.error) { $('srcStatus').textContent = { url: 'تعذّر فتح الرابط (محجوب أو غير صالح).', denied: 'هذا النطاق غير مسموح بجلب نصه الكامل.', type: 'الصفحة ليست نصًا أو HTML.', empty: 'لم يُستخرج نص كافٍ من الصفحة.', fetch: 'تعذّر الوصول للصفحة.' }[res.error] || 'تعذّر إحضار الصفحة.'; return; }
    $('sTitle').value = res.title || ''; $('sUrl').value = res.url || u; $('sText').value = res.text || '';
    $('srcStatus').textContent = 'راجع النص المستخرج في النموذج ثم اضغط «أضف المصدر».';
  } catch { $('srcStatus').textContent = 'تعذّر الوصول للخلفية.'; } finally { busyWith(btn, false); }
};
{ const box = $('persistLocal'); box.checked = keepLocal; box.onchange = () => { keepLocal = box.checked; try { localStorage.setItem(OPT_KEY, keepLocal ? '1' : '0'); } catch { /* blocked */ } persist(); renderSources(); }; }

// ---------- shared helpers ----------
const post = async body => {
  const r = await fetch(BACKEND_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('http_' + r.status);
  return r.json();
};
const busyWith = (btn, on) => { btn.disabled = on; };
function download(name, text) {
  const a = el('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' })); a.download = name;
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}
function exportRow(build) {
  const row = el('div', null, 'row export-row');
  const dl = el('button', 'نزّل التقرير (Markdown)', 'secondary'); dl.type = 'button';
  dl.onclick = () => download('newsrag-report.md', build());
  const cp = el('button', 'انسخ التقرير', 'secondary'); cp.type = 'button';
  cp.onclick = async () => { try { await navigator.clipboard.writeText(build()); cp.textContent = 'نُسخ'; setTimeout(() => cp.textContent = 'انسخ التقرير', 1500); } catch { cp.textContent = 'تعذّر النسخ'; } };
  row.append(dl, cp);
  return row;
}
const spinner = () => { const d = el('div', null, 'thinking'); d.append(el('i'), el('i'), el('i')); return d; };

// ---------- RAG mode ----------
function renderCitationAnswer(body, text) {
  // Render model text with [E#] references as jump links to evidence cards. Model text stays clearly framed.
  const parts = esc(text).split(/(\[E\d+\])/g);
  const p = el('p', null, 'model-answer');
  parts.forEach(part => {
    const m = part.match(/^\[E(\d+)\]$/);
    if (m) { const a = el('a', part, 'cite-chip'); a.href = '#ev-E' + m[1]; p.append(a); }
    else p.append(document.createTextNode(part));
  });
  body.append(p);
}
function evidenceCard(e) {
  const c = el('article', null, 'src-card fade'); c.id = 'ev-' + e.ref;
  const head = el('div', null, 'srchead'); head.append(el('strong', `[${e.ref}] ${e.title}`)); c.append(head);
  c.append(el('small', [e.publisher || 'ناشر غير محدد', 'النشر: ' + (e.published_at || 'غير معروف'), 'الدرجة: ' + (typeof e.score === 'number' ? e.score : '—'), `المواضع: ${e.start}–${e.end}`].join(' · ')));
  const u = safeUrl(e.url); if (u) { const a = el('a', u, 'url'); a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; c.append(a); }
  c.append(el('blockquote', e.excerpt, 'quote'));
  return c;
}
async function askRag() {
  const q = $('ragQuestion').value.trim();
  if (!q) return;
  const btn = $('askRag'); busyWith(btn, true);
  const body = $('ragResult'); body.replaceChildren(spinner());
  const options = { before: $('fromDate').value || undefined, after: $('toDate').value || undefined };
  const when = new Date().toISOString();
  try {
    if (!sources.length) { body.replaceChildren(el('p', 'أضف مصدرًا واحدًا على الأقل من الأسفل ثم اسأل.', 'why')); return; }
    if (SERVER) {
      let res;
      try { res = await post({ mode: 'rag', question: q, sources, options }); }
      catch { res = { error: 'offline' }; }
      if (res.error === 'offline' || res.error === 'upstream' || res.error === 'busy') {
        body.replaceChildren(el('p', res.error === 'busy' ? 'خدمة جيمناي مشغولة الآن؛ جرّب بعد قليل.' : 'تعذّر الوصول للخلفية؛ عرض استرجاع محلي بدون توليد.', 'why'));
        return renderLocalRag(q, body, true);
      }
      renderRagResult(q, res, when, body);
    } else {
      renderLocalRag(q, body, false);
    }
  } finally { busyWith(btn, false); }
}
function renderRagResult(q, res, when, body) {
  body.replaceChildren();
  if (res.error === 'no_sources') { body.append(el('p', 'أضف مصدرًا واحدًا على الأقل.', 'why')); return; }
  const badge = el('span', res.decision === 'answer' ? 'إجابة مولدة بجيمناي' : res.decision === 'retrieve_only' ? 'استرجاع فقط (جيمناي غير مفعّل)' : 'امتناع: لا أدلة كافية', 'badge dec-' + res.decision);
  body.append(el('h3', null, 'answer-title')).append(badge);
  if (res.text && res.generated) renderCitationAnswer(body, res.text);
  else if (res.text) body.append(el('p', res.text, 'meta-line'));
  if (res.citation_refs_valid === false) body.append(el('p', 'تحذير: الإجابة تشير إلى معرّفات أدلة غير موجودة.', 'why'));
  (res.warnings || []).forEach(w => body.append(el('small', w, 'crit-note')));
  (res.evidence || []).forEach(e => body.append(evidenceCard(e)));
  body.append(exportRow(() => buildRagReport({ question: q, result: res, when })));
}
function renderLocalRag(q, body, afterError) {
  if (!afterError) body.replaceChildren();
  const items = sources.map(s => ({ claim: s.title, title: s.title, text: s.text, publisher: s.publisher, rating: '' }));
  const top = retrieve(q, items, 6).filter(x => x.similarity > 0.15);
  if (!top.length) { body.append(el('p', 'لا تطابق كافٍ في مصادرك لهذا السؤال.', 'why')); return; }
  body.append(el('p', 'وضع محلي: ترتيب بالكلمات فقط على جهازك، بدون توليد جيمناي.', 'meta-line'));
  top.forEach((it, i) => body.append(evidenceCard({ ref: 'E' + (i + 1), title: it.title, publisher: it.publisher, published_at: '', score: Math.round(it.similarity * 100) / 100, start: 0, end: (it.text || '').length, excerpt: String(it.text || '').slice(0, 500), url: '' })));
  body.append(el('small', 'الاسترجاع المحلي لا يولّد إجابة ولا يثبت صحة؛ فعّل الربط بجيمناي للإجابة الموثقة بالإحالات.', 'crit-note'));
}
$('askRag').onclick = askRag;
$('ragQuestion').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); askRag(); } });

// ---------- Viral-claim mode ----------
const MARK = { pass: '✓', fail: '✗', warn: '!', na: '—' };
const RELIABILITY = { very_high: 'عالية جدًا', high: 'عالية', medium: 'متوسطة', unknown: 'غير معروفة' };
const CONF = { high: 'عالية', medium: 'متوسطة', low: 'منخفضة' };
function criteriaBox(list) {
  const box = el('div', null, 'criteria fade'); box.append(el('strong', 'نتائج المعايير'));
  list.forEach(c => { const r = el('div', null, 'crit ' + c.status); r.append(el('span', MARK[c.status], 'mk'), el('span', c.label), el('small', c.detail)); box.append(r); });
  box.append(el('small', 'بوابة قواعد تُطبق على إجابة النموذج وليست مراجعة مستقلة؛ لا تُعد الإجابة موثقة.', 'crit-note'));
  return box;
}
function confidenceOf(crit, sources) {
  const f = crit.filter(c => c.status === 'fail').length;
  const strong = (sources || []).some(s => s.verified && (s.tier === 'official' || s.tier === 'news' || s.tier === 'academic'));
  return f ? 'low' : strong ? 'high' : 'medium';
}
async function askVerify() {
  const q = $('verifyQuestion').value.trim();
  if (!q) return;
  const btn = $('askVerify'); busyWith(btn, true);
  const body = $('verifyResult'); body.replaceChildren(spinner());
  const when = new Date().toISOString();
  try {
    if (!SERVER) { body.replaceChildren(el('p', 'وضع الادعاء المتداول يحتاج الخلفية مفعّلة.', 'why')); return; }
    const model = await post({ mode: 'verify', question: q });
    body.replaceChildren();
    if (model.error) { body.append(el('p', model.error === 'busy' ? 'خدمة النموذج مشغولة الآن.' : model.error === 'off' ? 'الربط بجيمناي غير مفعّل بعد على الخادم.' : 'خدمة النموذج غير متاحة الآن.', 'why')); return; }
    const crit = model.criteria || [];
    const conf = confidenceOf(crit, model.sources);
    const lead = el('h3', null, 'answer-title');
    lead.append(el('span', model.decision === 'answer' ? 'إجابة من معرفة النموذج، وهي ليست دليلاً' : 'امتنع النموذج عن الإجابة', 'badge ' + (model.decision === 'answer' ? 'dec-answer' : 'dec-abstain')));
    body.append(lead);
    if (model.answer) body.append(el('p', model.answer, 'model-answer'));
    const c = el('div', null, 'conf ' + conf);
    c.append(el('strong', 'درجة الثقة: ' + CONF[conf]), el('small', conf === 'low' ? 'ثقة منخفضة: لا تعتمد على هذه الإجابة قبل الرجوع إلى مصدر.' : conf === 'medium' ? 'ثقة متوسطة: لم يتحقق مصدر معروف من الادعاء، فراجع مصدرًا قبل النشر.' : 'تقدير إرشادي من نتائج المعايير، وليس قياسًا ولا حكمًا نهائيًا.'));
    body.append(c);
    if (crit.length) body.append(criteriaBox(crit));
    (model.sources || []).forEach(x => {
      const r = el('article', null, 'srcrow ' + (x.verified ? 'pass' : x.exists ? 'warn' : 'fail'));
      const head = el('div', null, 'srchead'); head.append(el('span', x.verified ? '✓' : x.exists ? '!' : '✗', 'mk'));
      const u = safeUrl(x.url);
      if (u) { const a = el('a', x.name || x.title || x.host); a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; head.append(a); } else head.append(el('strong', x.name || 'مصدر بلا عنوان'));
      r.append(head);
      if (x.exists) r.append(el('small', 'موثوقية الجهة (تقدير عام): ' + (RELIABILITY[x.rel] || RELIABILITY.unknown) + ' · دعم الادعاء: ' + (x.verified ? 'اجتاز الفحص' : 'لم يتحقق')));
      else r.append(el('small', 'لم يتم فتح الرابط' + (x.claimed ? ' (المذكور: ' + x.claimed + ')' : '')));
      if (x.quote) r.append(el('blockquote', '«' + x.quote + '»', 'quote'));
      body.append(r);
    });
    body.append(exportRow(() => buildVerifyReport({ question: q, model, confidence: CONF[conf], when })));
  } catch { body.replaceChildren(el('p', 'تعذّر إكمال الطلب.', 'why')); }
  finally { busyWith(btn, false); }
}
$('askVerify').onclick = askVerify;
$('verifyQuestion').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); askVerify(); } });

// ---------- tabs, chips, footer ----------
$('tabRag').onclick = () => switchTab('rag');
$('tabVerify').onclick = () => switchTab('verify');
function switchTab(t) {
  $('tabRag').setAttribute('aria-selected', t === 'rag'); $('tabVerify').setAttribute('aria-selected', t === 'verify');
  $('panelRag').hidden = t !== 'rag'; $('panelVerify').hidden = t !== 'verify';
}
document.querySelectorAll('.chip').forEach(c => c.onclick = () => { $('ragQuestion').value = c.textContent; askRag(); });
$('notice').textContent = EXTERNAL_AI && SERVER ? NOTICE : '';
$('mode').textContent = SERVER ? 'الوضع: خلفية مفعّلة. التوليد والتضمين الدلالي عبر جيمناي عند توفر المفتاح على الخادم.' : 'الوضع المحلي: الخلفية غير مفعّلة؛ استرجاع بالكلمات على جهازك فقط.';
renderSources();
