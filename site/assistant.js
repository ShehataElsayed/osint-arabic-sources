// مساعد NewsRAG: تجربة السؤال الواحد. المستخدم يكتب السؤال فقط؛ جيمناي يجهّز المسودة،
// وفحوص NewsRAG تمر عليها قبل العرض (فتح المصادر، اقتباسات حرفية، دعم الادعاءات، معايير الثقة).
// العرض: إجابة واحدة مفصلة، مؤشر ثقة بمعايير معلنة، مصادر بموثوقية جهة النشر،
// إشكاليات، زوايا صحفية، وأدوات مناسبة من الدليل بسبب الاختيار وطريقة الاستخدام.
import { BACKEND_URL } from './rag-config.js';
import { buildIndex, search } from './tool-search.js';
import { buildAskReport } from './assistant-report.js';

const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const SERVER = Boolean(BACKEND_URL);
const TEAL = '#0a827d', AMBER = '#b88932', RED = '#9b2218', NAVY = '#102735';
const BAND = { high: { label: 'تغطية فحوص مرتفعة', color: TEAL }, mid: { label: 'تغطية فحوص متوسطة', color: AMBER }, low: { label: 'تغطية فحوص منخفضة', color: RED } };
const REL = { very_high: ['جهة رسمية — تصنيف نطاق', 'tier-official'], high: ['جهة معروفة — تصنيف نطاق', 'tier-news'], medium: ['هوية موثقة جزئيًا', 'tier-academic'], unknown: ['غير مُقيَّمة', 'tier-unknown'] };
const TIER_TXT = { official: 'نطاق رسمي', news: 'موقع إخباري', academic: 'موقع أكاديمي', unknown: 'نطاق غير مصنف' };
function provenance(s) {
  const parts = [TIER_TXT[s.tier] || TIER_TXT.unknown];
  if (s.identity && s.identity.age_years != null) parts.push(`مسجل منذ ${s.identity.age_years} ${s.identity.age_years > 2 ? 'سنوات' : 'سنة'}`);
  if (s.page && s.page.site_name) parts.push(s.page.site_name);
  if (s.page && s.page.has_about) parts.push('له صفحة تعريف');
  if (s.repaired) parts.push('صُحّح الرابط من نفس الموقع');
  if (s.by_search) parts.push('وُجد ببحث مستقل');
  return parts.join(' · ');
}
const CRIT_DOT = s => s >= 1 ? 'dot-1' : s >= 0.5 ? 'dot-half' : 'dot-0';

async function post(payload) {
  const r = await fetch(BACKEND_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  let data = null; try { data = await r.json(); } catch { /* ignore */ }
  if (!r.ok || !data || data.error) {
    const code = data && data.error;
    const msg = code === 'off' || code === 'no_key' ? 'المساعد غير مفعّل بعد: يلزم ضبط مفتاح جيمناي على الخادم.'
      : code === 'busy' || code === 'rate_limited' ? 'ضغط على الخدمة حاليًا — أعد المحاولة بعد دقيقة.'
      : 'تعذر الوصول إلى الخادم — أعد المحاولة لاحقًا.';
    throw new Error(msg);
  }
  return data;
}
async function busyWith(btn, fn) { const t = btn.textContent; btn.disabled = true; btn.textContent = 'جارٍ العمل…'; try { return await fn(); } finally { btn.disabled = false; btn.textContent = t; } }

let catalog = null, tIndex = null;
async function toolCandidates(q) {
  catalog = catalog || await (await fetch('./search-tools.json')).json();
  tIndex = tIndex || buildIndex(catalog);
  const found = search(tIndex, q, { limit: 8 });
  return (found.candidates || []).slice(0, 8).map(c => ({ id: c.id, name: c.t.name, description: c.t.description }));
}
const toolById = id => (tIndex ? tIndex.items[id] : null);

function gauge(conf) {
  const b = BAND[conf.band] || BAND.mid, v = Math.max(0, Math.min(100, Number(conf.score) || 0));
  const r = 62, c = 2 * Math.PI * r, dash = c * v / 100;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 160 160'); svg.setAttribute('width', '140'); svg.setAttribute('height', '140'); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `مؤشر تغطية الفحوص الآلية: ${v} من 100 نقطة — ${b.label} — متوسط معايير معلنة كل منها يسجل 0 أو 0.5 أو 1؛ يقيس اكتمال الفحوص ولا يقيس احتمال صحة الإجابة ولا موثوقيتها`);
  const mk = (tag, attrs) => { const n = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, val] of Object.entries(attrs)) n.setAttribute(k, val); return n; };
  svg.append(
    mk('circle', { cx: 80, cy: 80, r, fill: 'none', stroke: '#e6efed', 'stroke-width': 14 }),
    mk('circle', { cx: 80, cy: 80, r, fill: 'none', stroke: b.color, 'stroke-width': 14, 'stroke-linecap': 'round', 'stroke-dasharray': `${dash} ${c - dash}`, transform: 'rotate(-90 80 80)' }),
    mk('text', { x: 80, y: 88, 'text-anchor': 'middle', style: `font:800 34px Cairo,Tahoma,sans-serif;fill:${NAVY}` }),
    mk('text', { x: 80, y: 108, 'text-anchor': 'middle', style: 'font:700 12px Cairo,Tahoma,sans-serif;fill:#52646d' }));
  svg.childNodes[2].textContent = String(Math.round(v)); svg.childNodes[3].textContent = 'من 100';
  return svg;
}
// [n] markers in the answer become safe link chips to the matching source card; everything else stays plain text.
function appendMarked(p, text, sources) {
  const re = /\[S?(\d{1,2})\]/g; let last = 0, m;
  while ((m = re.exec(text))) {
    p.append(document.createTextNode(text.slice(last, m.index)));
    const n = +m[1];
    if (n >= 1 && n <= sources.length && sources[n - 1].exists) { const a = el('a', 'cite-chip', `[${n}]`); a.href = '#asksrc' + n; p.append(a); } else p.append(document.createTextNode(m[0]));
    last = m.index + m[0].length;
  }
  p.append(document.createTextNode(text.slice(last)));
}

function render(conf, question) {
  const box = $('askResult'); box.innerHTML = '';
  const allSrcs = conf.sources || [];
  const srcs = allSrcs.filter(s => s.exists);
  const decision = conf.decision || 'answer';
  const answerCard = el('div', 'src-card fade');
  if (decision === 'insufficient') {
    answerCard.append(el('span', 'badge mislead', 'أدلة غير كافية'));
    const head = el('h3', null, question); head.style.margin = '12px 0 8px'; answerCard.append(head);
    answerCard.append(el('p', null, 'لم تُفتح مصادر تدعم ادعاءات المسودة بنصوصها، لذلك لم يُعرض نص النموذج. النتيجة أدناه خيوط بحث لا إجابة.'));
  } else {
    answerCard.append(el('span', 'badge true', decision === 'extractive' ? 'مقتطفات موثقة من المصادر المفتوحة' : conf.answer_qualified ? 'الإجابة بعد الفحص والتنقية' : 'الإجابة بعد الفحص'));
    if (decision === 'extractive') answerCard.append(el('p', 'note', 'تعذرت صياغة إجابة موثقة كاملة؛ المعروض فقط ما تدعمه النصوص المفتوحة، باقتباساتها الحرفية.'));
    const head = el('h3', null, question); head.style.margin = '12px 0 8px'; answerCard.append(head);
    for (const para of String(conf.answer || '').split(/\n+/)) { const t = para.trim(); if (!t) continue; const p = document.createElement('p'); appendMarked(p, t, allSrcs); answerCard.append(p); }
  }
  box.append(answerCard);

  const confCard = el('div', 'src-card fade sec-block');
  confCard.append(el('span', 'badge', 'مؤشر تغطية الفحوص — معايير معلنة'));
  const wrap = el('div', 'conf-wrap');
  const left = el('div'); left.append(gauge(conf.confidence || {}));
  const band = (conf.confidence || {}).band || 'low';
  left.append(el('div', 'conf-band band-' + band, BAND[band].label + ` — ${Math.round(conf.confidence.score)}/100 نقطة في المؤشر`));
  wrap.append(left);
  const crits = el('div');
  ((conf.confidence || {}).criteria || []).forEach(c => {
    const row = el('div', 'crit'); row.append(el('span', 'dot ' + CRIT_DOT(c.score)));
    row.append(el('strong', null, c.label + ' ')); row.append(el('small', null, '— ' + c.detail));
    crits.append(row);
  });
  wrap.append(crits); confCard.append(wrap);
  confCard.append(el('p', 'note', 'طريقة الحساب: كل معيار معلن أعلاه يسجل 0 أو 0.5 أو 1، والمؤشر هو متوسطها على 100 نقطة — يقيس تغطية الفحوص الآلية، لا احتمال صحة الإجابة ولا موثوقيتها، ولا يغني عن مراجعة المصادر الأصلية.'));
  const claims = (conf.claims || []).filter(c => c && c.text);
  if (claims.length) {
    const h = el('h3', null, 'سند الادعاءات الرئيسية'); h.style.marginTop = '14px'; confCard.append(h);
    confCard.append(el('p', 'note', 'السند هنا تطابق نصي مع جملة من مصدر مفتوح — وليس إثباتًا استدلاليًا لصحة الادعاء.'));
    claims.forEach(c => {
      const row = el('div', 'claim');
      row.append(el('span', 'st ' + (c.supported ? 'st-ok' : 'st-no'), c.supported ? 'له سند نصي' : 'لا سند نصي'));
      const body = el('div');
      body.append(el('span', null, c.text));
      if (c.supported && c.evidence) {
        const ev = el('blockquote', null, c.evidence); ev.style.cssText = 'margin:4px 0 0;color:#274a52;border-inline-start:3px solid ' + AMBER + ';padding-inline-start:10px;font-size:14px';
        body.append(ev);
        if (c.source_ref >= 1) { const chip = el('a', 'cite-chip', `[${c.source_ref}]`); chip.href = '#asksrc' + c.source_ref; body.append(chip); }
      }
      row.append(body);
      confCard.append(row);
    });
  }
  box.append(confCard);

  if (allSrcs.length) {
    const srcCard = el('div', 'src-card fade sec-block');
    srcCard.append(el('span', 'badge', srcs.length ? `المصادر المفتوحة (${srcs.length})` : 'المصادر'));
    srcCard.append(el('p', 'note', 'ما يذكره النموذج أو يعثر عليه الاكتشاف الآلي خيوط لا تحققًا: لا يظهر هنا إلا ما فُتح فعلًا وطُابق نصه. الاكتشاف الآلي عينة مجانية محدودة بسقف يقارب عشر صفحات، مصدرًا واحدًا لكل نطاق لتنويع الجهات، وليست مسحًا شاملًا للويب.'));
    const verifiedSrc = [], otherSrc = [];
    allSrcs.forEach((s, gi) => { if (!s.exists) return; (s.quote ? verifiedSrc : otherSrc).push([s, gi + 1]); });
    const srcGroups = [
      [`مصادر داعمة باقتباس حرفي (${verifiedSrc.length})`, verifiedSrc],
      [`مصادر مفتوحة أخرى فُحصت (${otherSrc.length})`, otherSrc],
    ];
    srcGroups.forEach(([label, list]) => {
      if (!list.length) return;
      if (srcGroups.filter(g => g[1].length).length > 1) { const gh = el('h4', null, label); gh.style.cssText = 'margin:14px 0 4px;font-size:15px'; srcCard.append(gh); }
      list.forEach(([s, n]) => {
        const item = el('div'); item.id = 'asksrc' + n;
        item.style.cssText = 'border-inline-start:4px solid ' + TEAL + ';padding:12px 14px;background:#f7faf9;border-radius:10px;margin:10px 0';
        const a = document.createElement('a'); a.href = s.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = `[${n}] ${s.title || s.name || s.url}`;
        const rel = REL[s.rel] || REL.unknown;
        item.append(a, el('span', 'tier-pill ' + rel[1], rel[0]));
        if (s.discovered) item.append(el('span', 'tier-pill mid', 'اكتشاف آلي'));
        item.append(document.createElement('br'));
        item.append(el('small', 'note', (s.name && s.name !== s.title ? s.name + ' · ' : '') + provenance(s)));
        if (s.quote) { const q = el('blockquote', null, s.quote); q.style.cssText = 'margin:8px 0 0;color:#274a52;border-inline-start:3px solid ' + AMBER + ';padding-inline-start:10px'; item.append(q); }
        srcCard.append(item);
      });
    });
    const failed = allSrcs.filter(s => !s.exists && s.claimed);
    if (failed.length) srcCard.append(el('p', 'note', 'تعذر فتح ' + failed.length + ' من المصادر التي ذكرها النموذج فاستُبعدت من الإحالات.'));
    box.append(srcCard);
  }

  const fc = (conf.factcheck || []).filter(x => x && x.url);
  if (fc.length) {
    const c = el('div', 'src-card fade sec-block'); c.append(el('span', 'badge', 'من قاعدة مدققي الحقائق'));
    fc.forEach(x => { const a = el('a', 'chip', (x.rating ? x.rating + ' — ' : '') + (x.title || x.publisher || x.url)); a.href = x.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.style.margin = '4px 4px 4px 0'; c.append(a); });
    box.append(c);
  }

  if ((conf.issues || []).length) {
    const c = el('div', 'src-card fade sec-block'); c.append(el('span', 'badge mislead', 'الإشكاليات'));
    const ul = document.createElement('ul'); conf.issues.forEach(t => ul.append(el('li', null, t))); c.append(ul); box.append(c);
  }
  if ((conf.angles || []).length) {
    const c = el('div', 'src-card fade sec-block'); c.append(el('span', 'badge', 'زوايا صحفية للعمل عليها'));
    const ul = document.createElement('ul'); conf.angles.forEach(t => ul.append(el('li', null, t))); c.append(ul); box.append(c);
  }

  const picks = (conf.tools || []).filter(p => toolById(p.id));
  if (picks.length) {
    const c = el('div', 'src-card fade sec-block'); c.append(el('span', 'badge', 'أدوات مناسبة من الدليل'));
    picks.forEach(p => {
      const t = toolById(p.id);
      const item = el('div'); item.style.cssText = 'margin:10px 0';
      const a = el('a', 'chip', t.name); a.href = t.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; item.append(a);
      if (p.why) item.append(el('p', 'note', 'لماذا تناسبك: ' + p.why));
      if (p.how) item.append(el('p', 'note', 'كيف تستخدمها: ' + p.how));
      c.append(item);
    });
    box.append(c);
  }

  const exportBtn = el('button', null, 'تنزيل التقرير (Markdown)'); exportBtn.type = 'button'; exportBtn.style.marginTop = '18px';
  exportBtn.addEventListener('click', () => {
    const md = buildAskReport({ question, result: conf, catalog: tIndex ? tIndex.items : [] });
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'newsrag-ask-report.md'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });
  box.append(exportBtn);
}

async function run(q) {
  const box = $('askResult'); box.innerHTML = '';
  const spin = el('div', 'src-card fade'); spin.append(el('span', 'badge', 'يعمل الآن'));
  spin.append(el('p', 'note', 'يجهّز جيمناي المسودة، ثم تفحص فحوص NewsRAG مصادرها قبل العرض — قد يستغرق الأمر حتى دقيقة.'));
  box.append(spin);
  const candidates = await toolCandidates(q).catch(() => []);
  const conf = await post({ mode: 'ask', question: q, candidates });
  spin.remove();
  render(conf, q);
}

if (SERVER) {
  $('mode').textContent = 'المساعد متصل بالخادم. يجري كل سؤال في مسار واحد: مسودة جيمناي ثم فحوص NewsRAG ثم عرض النتيجة.';
  $('askBtn').addEventListener('click', () => busyWith($('askBtn'), async () => {
    const q = $('askQ').value.trim();
    if (q.length < 10) { $('askResult').innerHTML = ''; $('askResult').append(el('div', 'src-card fade', 'اكتب سؤالًا أوضح (عشرة أحرف على الأقل).')); return; }
    try { await run(q); } catch (e) { $('askResult').innerHTML = ''; $('askResult').append(el('div', 'src-card fade', e.message)); }
  }));
  document.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => { $('askQ').value = b.textContent.trim(); $('askQ').focus(); }));
} else {
  $('mode').textContent = 'المساعد غير مفعّل في هذا النشر بعد: يلزم ضبط عنوان الخادم ومفتاح جيمناي عليه.';
  $('askBtn').disabled = true;
}
