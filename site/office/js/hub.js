import{newCase,casesFrom,caseMembers,caseSources}from'./case-workspace.js';
import{parseBackup,workspaceBackup,validateFile}from'./backup.js';
import{putFilesAtomic}from'./kernel.js';
/* Osh Office hub: مدير الملفات + الأمر الذكي الذي يحوّل الطلب إلى التطبيق المناسب. */
import { listFiles, putFile, deleteFile, getFile, newFile, openFile, KINDS, esc, fmtDate, download, toast, peekHandoff, takeHandoff, uid } from './kernel.js';
import { summarize, extractEntities, extractEvents, extractClaims, researchPlan,latestAI,attachAI,draftNotice, AI_NOTICE, aiProviderName, reasonText } from './ai.js';

const $ = s => document.querySelector(s);
const ICONS = {
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
  sheet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 4v16M15 4v16"/></svg>',
  deck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 17v4M8 21h8"/></svg>',
  board: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="5.5" height="14" rx="1.5"/><rect x="9.7" y="4" width="5.5" height="9" rx="1.5"/><rect x="16.4" y="4" width="5.5" height="12" rx="1.5"/></svg>'
};
$('#ai-notice').textContent = AI_NOTICE;

let files = [],activeCase='';
async function refresh() {
  files = (await listFiles()).sort((a, b) => b.updated - a.updated);
  renderCases();render();
}
function render(filter = '') {
  const host = $('#files'); const q = filter.trim();
  const pool=activeCase?caseMembers(files,activeCase):files;const shown = q ? pool.filter(f => f.name.includes(q)) : pool;
  $('#files-empty').hidden = shown.length > 0;
  host.innerHTML = '';
  for (const f of shown) {
    const card = document.createElement('div'); card.className = 'osh-file-card';
    card.innerHTML = `<div class="fc-top"><span class="fc-ico">${ICONS[f.kind] || ''}</span><div style="min-width:0"><strong>${esc(f.name)}</strong><small>${KINDS[f.kind] || f.kind} · آخر تعديل ${fmtDate(f.updated)}</small></div></div>
    <div class="fc-acts"><button data-act="open">افتح</button><button data-act="rename">أعد التسمية</button><button data-act="dup">انسخ</button><button data-act="export">نزّل نسخة</button><button data-act="del" style="color:#f3aaa1">احذف</button></div>`;
    if(!f.caseWorkspace){const label=document.createElement('label');label.textContent='القضية: ';const select=document.createElement('select');select.setAttribute('aria-label','قضية '+f.name);select.innerHTML='<option value="">بلا قضية</option>'+casesFrom(files).map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join('');select.value=f.caseId||'';select.addEventListener('click',e=>e.stopPropagation());select.addEventListener('change',async e=>{e.stopPropagation();f.caseId=select.value||null;await putFile(f);refresh()});label.addEventListener('click',e=>e.stopPropagation());label.append(select);card.append(label)}
    card.addEventListener('click', async e => {
      const act = e.target.dataset && e.target.dataset.act;
      if (!act || act === 'open') return openFile(f);
      e.stopPropagation();
      if (act === 'rename') { const n = prompt('اسم الملف الجديد:', f.name); if (n && n.trim()) { f.name = n.trim(); await putFile(f); refresh(); } }
      if (act === 'dup') { const c = JSON.parse(JSON.stringify(f)); c.id = uid(); c.name = f.name + ' — نسخة'; await putFile(c); refresh(); }
      if (act === 'del') { if (confirm(`احذف «${f.name}» نهائيًا من هذا الجهاز؟`)) { await deleteFile(f.id);if(activeCase===f.id)activeCase=''; refresh(); } }
      if (act === 'export') download(f.name + '.oshoffice.json', new Blob([JSON.stringify(f, null, 1)], { type: 'application/json' }));
    });
    host.appendChild(card);
  }
}
function renderCases(){
 const select=$('#case-select');select.innerHTML='<option value="">كل الملفات</option>'+casesFrom(files).map(f=>'<option value="'+esc(f.id)+'">'+esc(f.name)+'</option>').join('');if(!files.some(f=>f.id===activeCase))activeCase='';select.value=activeCase;
 const f=files.find(f=>f.id===activeCase);$('#case-detail').hidden=!f;$('#case-bundle').disabled=!f;if(!f)return;
 $('#case-question').value=f.caseWorkspace.question;$('#case-notes').value=f.caseWorkspace.notes;
 const list=$('#case-checklist');list.innerHTML='';f.caseWorkspace.checklist.forEach((x,i)=>{const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=x.done;input.dataset.step=i;label.append(input,document.createTextNode(x.text));list.append(label)});
 const sources=$('#case-sources');sources.innerHTML='';for(const s of caseSources(files,f.id)){const li=document.createElement('li');if(/^https?:\/\//i.test(s.url)){const a=document.createElement('a');a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=s.title;li.append(a)}else li.textContent=s.title+' (رابط غير قابل للفتح)';li.append(document.createTextNode(' - '+s.fileName));sources.append(li)}if(!sources.children.length)sources.textContent='لا توجد روابط مصادر محفوظة مع الملفات المرتبطة بعد.';
}
$('#case-select').addEventListener('change',e=>{activeCase=e.target.value;renderCases();render()});
$('#case-create').addEventListener('click',async()=>{const name=prompt('اسم القضية المحلية:');if(!name?.trim())return;const f=newCase(name.trim().slice(0,500));await putFile(f);activeCase=f.id;await refresh();$('#case-status').textContent='أُنشئت قضية شخصية محلية. اربط الملفات من قائمة القضية في بطاقة كل ملف.'});
$('#case-save').addEventListener('click',async()=>{const f=files.find(f=>f.id===activeCase);if(!f)return;f.caseWorkspace.question=$('#case-question').value;f.caseWorkspace.notes=$('#case-notes').value;$('#case-checklist').querySelectorAll('input').forEach(e=>f.caseWorkspace.checklist[+e.dataset.step].done=e.checked);await putFile(f);$('#case-status').textContent='حُفظ التجهيز المحلي؛ هذا ليس اعتماداً تحريرياً أو نشراً.'});
$('#case-bundle').addEventListener('click',()=>{const f=files.find(f=>f.id===activeCase);if(!f)return;download(f.name+'.oshcase.json',new Blob([JSON.stringify(workspaceBackup(caseMembers(files,f.id)))],{type:'application/json'}));$('#case-status').textContent='نُزّلت ملفات القضية ومصادرها. الاستعادة من زر النسخة الكاملة تضيف نسخاً جديدة؛ الحزمة قد تحتوي على مواد حساسة.'});
$('#file-search').addEventListener('input', e => render(e.target.value));

document.querySelectorAll('[data-new]').forEach(b => b.addEventListener('click', async () => {
  const f = newFile(b.dataset.new, 'بدون عنوان');
  await putFile(f); openFile(f);
}));

/* استيراد ملف من الجهاز: يُمرَّر إلى التطبيق المالك لصيغته ليحوّله */
const IMPORT_KIND = { docx: 'doc', html: 'doc', htm: 'doc', md: 'doc', txt: 'doc', xlsx: 'sheet', csv: 'sheet', pptx: 'deck', json: 'board' };
$('#import-file').addEventListener('change', async e => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  let kind = IMPORT_KIND[ext];
  if (ext === 'json') { try { const j = JSON.parse(await file.text()); if (j.kind && KINDS[j.kind]) kind = j.kind; } catch { kind = 'board'; } }
  if (!kind) return toast('صيغة غير مدعومة للاستيراد: ' + ext);
  if (ext === 'json') { try { const j=JSON.parse(await file.text());const f={...validateFile(j),id:uid(),updated:Date.now()};await putFile(f);return openFile(f) } catch {return toast('ملف JSON غير صالح. استخدم استعادة نسخة كاملة لنسخ مساحة العمل.')} }
  const f = newFile(kind, file.name.replace(/\.[^.]+$/, ''));
  await putFile(f);
  const dataUrl = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); });
  sessionStorage.setItem('osh-import-' + f.id, dataUrl);
  sessionStorage.setItem('osh-import-name-' + f.id, file.name);
  location.href = { doc: './writer.html', sheet: './sheets.html', deck: './slides.html', board: './tasks.html' }[kind] + '?f=' + f.id + '&import=1';
});

/* تسليم من أدوات المنصة (مثلاً نتيجة تحقق أو ملخص) */
function renderHandoff() {
  const h = peekHandoff(); const box = $('#handoff-box');
  if (!h) return;
  const div = document.createElement('div');
  div.className = 'osh-panel'; div.style.cssText = 'border-color:var(--accent);margin:16px 0';
  div.innerHTML = `<h2>مادة وصلت من المنصة</h2><p class="muted">${esc(h.name || 'نتيجة من إحدى الأدوات')} — جاهزة للتحويل إلى ملف.</p><div class="row" style="display:flex;gap:8px;flex-wrap:wrap"><button class="osh-btn primary" id="ho-open">حوّلها إلى ${KINDS[h.kind] || 'ملف'}</button><button class="osh-btn" id="ho-dismiss">تجاهل</button></div>`;
  box.appendChild(div);
  div.querySelector('#ho-dismiss').addEventListener('click', () => { takeHandoff(); div.remove(); });
  div.querySelector('#ho-open').addEventListener('click', async () => {
    const p = takeHandoff(); if (!p) return;
    const f = newFile(p.kind || 'doc', p.name || 'من المنصة');
    if (p.kind === 'doc' || !p.kind) f.data.html = p.docHtml || '';
    if (p.kind === 'sheet' && Array.isArray(p.rows)) { const cells = {}; p.rows.forEach((row, r) => row.forEach((v, c) => { if (v !== '' && v != null) cells[(r + 1) + ',' + (c + 1)] = { v: String(v) }; })); f.data.sheets[0].cells = cells; }
    if (p.kind === 'deck' && Array.isArray(p.slides)) f.data.slides = p.slides;
    if(p.aiProvenance)attachAI(f,p.aiProvenance);await putFile(f); openFile(f);
  });
}

/* الأمر الذكي: توجيه قاعدي شفاف إلى التطبيق المناسب */
function routeIntent(text) {
  const t = text;
  if (/(عرض|شرائح|سلايدات|بوربوينت|باوربوينت|تقديمي|محاضرة)/.test(t)) return 'deck';
  if (/(جدول|جداول|بيانات|إحصائ|احصائ|أرقام|ارقام|ميزانية|كشف|إكسل|اكسل|صفوف|أعمدة|اعمدة)/.test(t)) return 'sheet';
  if (/(مهام|مهمة|متابعة|كانبان)/.test(t)) return 'board';
  return 'doc';
}
function wantSummary(t) { return /(لخص|تلخيص|ملخص)/.test(t); }
function wantPlan(t) { return /(خطة|خطوات|خارطة طريق|منهجية عمل|كيف أبحث|كيف ابحث)/.test(t); }
function wantEntities(t) { return /(كيانات|أشخاص|اشخاص|جهات|أماكن|اماكن|أسماء|اسماء)/.test(t); }
function wantEvents(t) { return /(أحداث|احداث|تواريخ|خط زمني)/.test(t); }
function wantClaims(t) { return /(ادعاءات|ادعاء|تحقق من)/.test(t); }
function stripCommand(t) { return t.replace(/^(لخص|تلخيص|استخرج|حوّل|حول|اعمل|أنشئ|انشئ|اكتب|ولّد|ولد)\s*/,'').trim(); }

async function buildDocFromAI(text, target) {
  const out = $('#ai-out');
  if (wantSummary(text) && text.length > 220) {
    const r = await summarize(text);
    return { kind: 'doc', name: 'ملخص ذكي', html: `<h2>ملخص آلي</h2><p>${esc(r.overview)}</p>${r.quotes.length ? '<h3>اقتباسات حرفية من النص</h3><ul>' + r.quotes.map(q => `<li>${esc(q)}</li>`).join('') + '</ul>' : ''}<p><small>provider:${esc(r.provider || '')}</small></p>`, note: 'ملخص آلي — راجعه قبل الاعتماد عليه', provider: r.provider };
  }
  if (wantEntities(text) && text.length > 220) {
    const r = await extractEntities(text);
    const rows = [['الكيان', 'النوع']];
    (r.persons || []).forEach(x => rows.push([x, 'شخص']));
    (r.organizations || []).forEach(x => rows.push([x, 'جهة']));
    (r.places || []).forEach(x => rows.push([x, 'مكان']));
    return tablePayload(rows, 'كيانات مستخرجة', r.provider);
  }
  if (wantEvents(text) && text.length > 220) {
    const r = await extractEvents(text);
    const evs = Array.isArray(r.events) ? r.events : [];
    const rows = [['الحدث', 'التاريخ/الزمن']].concat(evs.map(e => [e.event || e.text || JSON.stringify(e), e.date || e.time || '']));
    return tablePayload(rows, 'أحداث مستخرجة', r.provider);
  }
  if (wantClaims(text) && text.length > 220) {
    const r = await extractClaims(text);
    const cl = Array.isArray(r.claims) ? r.claims : [];
    const rows = [['الادعاء', 'الاقتباس الحرفي']].concat(cl.map(c => [c.claim || c.text || JSON.stringify(c), c.quote || '']));
    return tablePayload(rows, 'ادعاءات قابلة للتحقق', r.provider);
  }
  if (wantPlan(text) || target === 'deck' || target === 'board') {
    const q = stripCommand(text);
    const plan = await researchPlan(q);
    if (target === 'deck') return { kind: 'deck', name: 'عرض: ' + q.slice(0, 40), plan, provider: plan.provider };
    if (target === 'board') return { kind: 'board', name: 'مهام: ' + q.slice(0, 40), plan, provider: plan.provider };
    const steps = (plan.steps || []).map((s, i) => `<li><strong>${esc(s.goal)}</strong> — ${esc(s.how)} <small>(${esc(s.tool || '')})</small></li>`).join('');
    return { kind: 'doc', name: 'خطة: ' + q.slice(0, 40), html: `<h2>${esc(plan.intro || 'خطة بحث')}</h2><ol>${steps}</ol>${plan.limits ? `<p><small>الحدود: ${esc(plan.limits)}</small></p>` : ''}`, note: 'خطة مقترحة لم تُنفَّذ — راجعها بخبرتك', provider: plan.provider };
  }
  if (text.length > 220 && !wantPlan(text)) { const r = await summarize(text); return { kind: 'doc', name: 'ملخص ذكي', html: `<h2>ملخص آلي</h2><p>${esc(r.overview)}</p>`, note: 'ملخص آلي — راجعه قبل الاعتماد عليه', provider: r.provider }; }
  const q = stripCommand(text);
  const plan = await researchPlan(q);
  const steps = (plan.steps || []).map(s => `<li><strong>${esc(s.goal)}</strong> — ${esc(s.how)}</li>`).join('');
  return { kind: 'doc', name: 'خطة: ' + q.slice(0, 40), html: `<h2>${esc(plan.intro || 'خطة بحث')}</h2><ol>${steps}</ol>`, note: 'خطة مقترحة لم تُنفَّذ — راجعها بخبرتك', provider: plan.provider };
}
function tablePayload(rows, name, provider) {
  return { kind: 'sheet', name, rows, provider };
}

$('#ai-run').addEventListener('click', async () => {
  const text = $('#ai-cmd').value.trim();
  const out = $('#ai-out');
  if (!text) return toast('اكتب طلبك أولًا');
  let target = $('#ai-target').value;
  if (target === 'auto') target = routeIntent(text);
  out.hidden = false; out.textContent = 'جارٍ المعالجة عبر خادم الدليل…';
  $('#ai-run').disabled = true;
  try {
    const p = await buildDocFromAI(text, target);
    const f = newFile(p.kind, p.name);attachAI(f,latestAI());
    if (p.kind === 'doc') f.data.html = '<p>'+esc(draftNotice)+'</p>'+p.html;
    if (p.kind === 'sheet') { const cells = {}; (p.rows || []).forEach((row, r) => row.forEach((v, c) => { if (v !== '' && v != null) cells[(r + 1) + ',' + (c + 1)] = { v: String(v) }; })); f.data.sheets[0].cells = cells; }
    if (p.kind === 'deck' && p.plan) {
      const plan = p.plan; const T = f.data.theme;
      const slides = [{ bg: { type: 'color', value: T.canvas }, notes: '', elements: [
        { id: uid(), type: 'text', x: 90, y: 250, w: 1100, h: 150, text: p.name, style: { fontSize: 54, bold: true, color: T.ink, align: 'center', font: 'Cairo' } },
        { id: uid(), type: 'text', x: 190, y: 430, w: 900, h: 70, text: plan.intro || '', style: { fontSize: 24, color: T.accent, align: 'center', font: 'Cairo' } }] }];
      (plan.steps || []).forEach((s, i) => slides.push({ bg: { type: 'color', value: T.canvas }, notes: s.how || '', elements: [
        { id: uid(), type: 'text', x: 90, y: 90, w: 1100, h: 90, text: `${i + 1}. ${s.goal}`, style: { fontSize: 34, bold: true, color: T.accent, font: 'Cairo' } },
        { id: uid(), type: 'text', x: 90, y: 220, w: 1100, h: 300, text: s.how, style: { fontSize: 22, color: T.ink, font: 'Cairo' } }] }));
      if (plan.limits) slides.push({ bg: { type: 'color', value: T.canvas }, notes: '', elements: [{ id: uid(), type: 'text', x: 90, y: 300, w: 1100, h: 120, text: 'الحدود: ' + plan.limits, style: { fontSize: 22, color: T.ink, align: 'center', font: 'Cairo' } }] });
      f.data.slides = slides;
    }
    if (p.kind === 'board' && p.plan) {
      const cards = (p.plan.steps || []).map(s => ({ id: uid(), title: s.goal, desc: s.how, due: '', pr: '', labels: [], check: [] }));
      f.data.lists[0].cards = cards;
      if (p.plan.intro) f.data.lists[0].title = 'خطة: ' + p.name.replace(/^مهام: /, '').slice(0, 30);
    }
    await putFile(f);
    out.innerHTML = `<span class="en-provider">${esc(p.provider ? aiProviderName(p.provider) : aiProviderName(null))}</span>${esc(draftNotice)} تم إنشاء «${esc(f.name)}» (${KINDS[f.kind]}). ${p.note ? esc(p.note) : ''}`;
    setTimeout(() => openFile(f), 900);
  } catch (e) {
    out.textContent = reasonText(e && e.reason, e && e.retryAfter);
  } finally { $('#ai-run').disabled = false; }
});

$('#workspace-backup').addEventListener('click',async()=>{const all=await listFiles();download('osh-office-workspace-'+new Date().toISOString().slice(0,10)+'.json',new Blob([JSON.stringify(workspaceBackup(all))],{type:'application/json'}));$('#backup-status').textContent='نُزّلت نسخة محلية من '+all.length+' ملف. احفظها في مكان آمن؛ قد تحتوي على نصوص ومصادر حساسة.'});
$('#workspace-restore').addEventListener('change',async e=>{const selected=e.target.files[0];e.target.value='';if(!selected)return;const status=$('#backup-status');try{if(selected.size>50*1024*1024)throw Error('حجم النسخة أكبر من 50 ميجابايت.');const incoming=parseBackup(await selected.text());if(!confirm('استعادة '+incoming.length+' ملف كنسخ جديدة؟ لن تُحذف أو تُستبدل الملفات الحالية.')){status.textContent='أُلغيت الاستعادة دون تغيير.';return}await putFilesAtomic(incoming);await refresh();status.textContent='استُعيد '+incoming.length+' ملف كنسخ جديدة؛ ملفاتك الأصلية لم تتغير.'}catch(error){status.textContent='لم تُستعد النسخة: '+error.message}});
refresh(); renderHandoff();
