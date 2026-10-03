import { decide, wantsChart, chartSpec, classifyClaim, retrieve } from './rag-core.js';
import { barChartSVG } from './rag-chart.js';
import { BACKEND_URL, MEASURED, EXTERNAL_AI } from './rag-config.js';
import { NOTICE } from './chat-ui.js';
const $ = id => document.getElementById(id);
const el = (tag, txt, cls) => { const n = document.createElement(tag); if (txt != null) n.textContent = txt; if (cls) n.className = cls; return n; };
const safeUrl = u => { try { return ['https:', 'http:'].includes(new URL(u).protocol) ? u : ''; } catch { return ''; } };
const TYPES = { numeric: 'رقمي', attribution: 'نسبة قول', health: 'صحي', general: 'عام' };
const REASONS = { no_sources: 'لا توجد مصادر', low_similarity: 'تشابه منخفض مع المصادر', contradiction: 'تناقض بين السؤال والمصدر', split_vote: 'المصادر منقسمة في الحكم', consistency: 'عينات النموذج غير متسقة', type_rule: 'نوع الادعاء يتطلب إجماعًا كاملًا', contradiction_model: 'النقد الذاتي وجد احتمال تناقض', recency: 'قد يحتاج مصدرًا حديثًا', type_rule_warn: 'ادعاء رقمي أو صحي أو منسوب بلا مصدر تحقق منه الفحص', conflict: 'يتعارض مع حكم منشور', source_support: 'المصدر المذكور لا يدعم الادعاء', source_exists: 'لم تُفتح المصادر المذكورة', no_rating_in_sources: 'لا حكم صريح في المصادر' };
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
const MARK = { pass: '✓', fail: '✗', warn: '!', na: '—' };
// Cross-check of the model's verdict against published ratings kept on this device (never sent to the model).
function crossCheck(model, evidence) {
  const pol = evidence.map(i => polarity(i.rating)).filter(Boolean);
  if (!pol.length) return { id: 'published', label: 'مطابقة أحكام منشورة', status: 'na', detail: 'لا حكم منشور مطابق' };
  const f = pol.filter(p => p === 'false').length, t = pol.length - f, against = model.verdict === 'supported' ? f > t : model.verdict === 'refuted' ? t > f : false;
  return { id: 'conflict', label: 'مطابقة أحكام منشورة', status: against ? 'fail' : 'pass', detail: `${t} صحيح · ${f} خاطئ أو مضلل` };
}
const WARN = { type_rule: 'ادعاء رقمي أو صحي أو منسوب لم يتحقق مصدر منه', recency: 'قد يحتاج مصدرًا حديثًا', source_support: 'لم يدعم مصدرٌ فُحص الادعاء', source_exists: 'لم تُفتح المصادر المذكورة' };
const RELIABILITY = { very_high: 'عالية جدًا', high: 'عالية', medium: 'متوسطة', unknown: 'غير معروفة' };
const TIERS = { official: 'جهة رسمية أو دولية', news: 'مؤسسة إخبارية معروفة', academic: 'مجلة علمية أو جهة أكاديمية وصحية معروفة', unknown: 'غير مصنّف' };
// Heuristic confidence from the criteria results. It is a rule of thumb, not a measured probability.
// Any failed criterion -> low. No failure -> medium, or high only when a cited source of the official or news class was fetched and passed the similarity and numbers checks.
function confidence(crit, failed, sources) {
  const f = crit.filter(c => c.status === 'fail').length, warn = crit.filter(c => c.status === 'warn').map(c => c.id);
  const strong = (sources || []).some(s => s.verified && (s.tier === 'official' || s.tier === 'news' || s.tier === 'academic'));
  const level = f ? 'low' : strong ? 'high' : 'medium';
  return { level, why: [...new Set(failed)].map(r => REASONS[r] || r), warn: warn.map(r => WARN[r] || REASONS[r] || r) };
}
const CONF = { high: 'عالية', medium: 'متوسطة', low: 'منخفضة' };
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
  let crit = null, reasons = [...res.reasons], modelAnswer = '', conf = null;
  if (model && !model.error) {
    const x = crossCheck(model, res.evidence); crit = [...model.criteria.slice(0, 4), x, ...model.criteria.slice(4)];
    const failed = model.reasons.map(r => r === 'contradiction' ? 'contradiction_model' : r);
    if (x.status === 'fail') failed.push('conflict');
    modelAnswer = model.answer || '';
    reasons = failed;
    conf = confidence(crit, failed, model.sources);
  }
  const lead = modelAnswer ? 'إجابة من معرفة النموذج، وهي ليست دليلاً:' : res.decision === 'answer' && top ? 'يوجد تدقيق سابق، والحكم السائد: ' : res.decision === 'answer' ? 'وُجدت مصادر ذات صلة بسؤالك.' : 'لم يُنتج النموذج إجابة صالحة.';
  await typeInto(title, lead);
  if (!modelAnswer && res.decision === 'answer' && top) { title.append(el('span', top[0], 'badge ' + badgeCls(top[0])), document.createTextNode(` (${top[1]} من ${rated.length} نتائج)`)); }
  if (modelAnswer) { const p = el('p', null, 'model-answer'); body.append(p); await typeInto(p, modelAnswer); }
  body.append(el('p', `نوع السؤال: ${TYPES[classifyClaim(q)]}`, 'meta-line fade'));
  if (conf) { const c = el('div', null, 'conf ' + conf.level); c.append(el('strong', 'درجة الثقة: ' + CONF[conf.level]), el('small', conf.level === 'low' ? 'ثقة منخفضة: لا تعتمد على هذه الإجابة قبل الرجوع إلى مصدر.' : conf.level === 'medium' ? 'ثقة متوسطة: لم يتحقق مصدر معروف من الادعاء، فراجع مصدرًا قبل النشر.' : 'تقدير إرشادي من نتائج المعايير أدناه، وليس قياسًا ولا حكمًا نهائيًا.')); if (conf.why.length) c.append(el('small', 'أسباب خفض الثقة: ' + conf.why.join('، '))); if (conf.warn.length) c.append(el('small', 'تحفظات: ' + conf.warn.join('، '))); body.append(c); }
  if (!modelAnswer && res.decision !== 'answer' && reasons.length) body.append(el('p', 'السبب: ' + [...new Set(reasons)].map(r => REASONS[r] || r).join('، '), 'why fade'));
  if (model && model.error) body.append(el('p', model.error === 'busy' ? 'خدمة النموذج مشغولة الآن، فعُرضت المصادر فقط.' : 'خدمة النموذج غير متاحة الآن، فعُرضت المصادر فقط.', 'meta-line fade'));
  if (crit) body.append(criteriaBox(crit));
  if (model && !model.error && (model.sources || []).length) { const box = el('div', null, 'criteria fade'); box.append(el('strong', 'المصادر التي ذكرها النموذج وفُحصت آليًا'));
    model.sources.forEach(x => { const u = safeUrl(x.url), r = el('div', null, 'srcrow ' + (x.verified ? 'pass' : x.exists ? 'warn' : 'fail'));
      const head = el('div', null, 'srchead'); head.append(el('span', x.verified ? '✓' : x.exists ? '!' : '✗', 'mk'));
      if (u) { const a = el('a', x.name || x.title || x.host); a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; head.append(a); } else head.append(el('strong', x.name || 'مصدر بلا عنوان'));
      r.append(head);
      if (u) r.append(el('small', u, 'url'));
      if (u && x.repaired) r.append(el('small', 'رابط بديل من نفس النطاق، وقد فُتح فعلًا. الرابط الأصلي الذي ذكره النموذج لم يُفتح: ' + x.original, 'url'));
      if (u) { const b = el('a', 'فتح المصدر', 'open-src'); b.href = u; b.target = '_blank'; b.rel = 'noopener noreferrer'; r.append(b); }
      else r.append(el('small', 'لم يتم فتح الرابط' + (x.claimed ? ' (الرابط الذي ذكره النموذج: ' + x.claimed + ')' : ''), 'url'));
      if (x.exists) { const rel = el('div', null, 'rel rel-' + (x.rel || 'unknown')); rel.append(el('strong', 'موثوقية المصدر: ' + (RELIABILITY[x.rel] || RELIABILITY.unknown)), el('small', 'الفئة: ' + (TIERS[x.tier] || TIERS.unknown) + '. تقدير عام للجهة وليس للادعاء.')); r.append(rel);
        const id = x.identity || {}, pg = x.page || {}, NA = 'غير متاح';
        const idl = el('div', null, 'idbox'); idl.append(el('strong', 'هوية المصدر وملكيته (من سجلات عامة وصفحته نفسها):'));
        [['النطاق', id.domain || x.host], ['عمر النطاق', id.age_years != null ? id.age_years + ' سنة' : NA], ['المسجِّل', id.registrar || NA], ['المالك المسجَّل', id.registrant || NA + ' (قد يكون محجوبًا في السجل العام)'], ['اسم الموقع في الصفحة', pg.site_name || NA], ['صفحة «من نحن»', pg.has_about ? 'يوجد رابط إليها' : 'لم نجد رابطًا في هذه الصفحة'], ['صفحة التواصل', pg.has_contact ? 'يوجد رابط إليها' : 'لم نجد رابطًا في هذه الصفحة'], ['HTTPS', 'نعم']].forEach(([k, v]) => idl.append(el('small', k + ': ' + v)));
        idl.append(el('small', 'غياب حقل لا يعني شيئًا عن المصدر، فكثير من السجلات تحجب بيانات المالك.')); r.append(idl); r.append(el('small', 'دعم الادعاء: ' + (x.verified ? `اجتاز الفحص (تشابه ${x.similarity.toFixed(2)})` : 'لم يتحقق من دعمه للادعاء')));
        if (x.title) r.append(el('small', 'عنوان الصفحة: ' + x.title));
        if (x.quote) { const q = el('blockquote', '«' + x.quote + '»', 'quote'); r.append(el('small', x.picked ? 'مقطع اختير من نص الصفحة المفتوحة، ووُجد حرفيًا فيها (وليس دليلًا على الدعم):' : 'أقرب مقطع وجدناه في الصفحة (لا يعني أنه يدعم الادعاء):'), q); } }
      box.append(r); });
    box.append(el('small', 'الاقتباس يُستخرج من نص الصفحة نفسها بعد فتحها، لا من كتابة النموذج. موثوقية المصدر تقدير للجهة حسب فئة نطاقها وهويتها المعلنة ولا ترفع درجة ثقة الادعاء بمفردها، ولا تعني صحة هذا الادعاء. يُعرض وزن المصدر (درجة التشابه) فقط بعد نجاح فحص الوجود والتشابه والأرقام.', 'crit-note')); body.append(box); }
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
