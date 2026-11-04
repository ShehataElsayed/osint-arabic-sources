/* كاتب أوش: محرر مستندات عربي كامل. التحرير في DOM (contenteditable) مع نموذج HTML موثق،
   استيراد docx عبر mammoth وتصدير docx عبر مكتبة docx من النموذج نفسه. */
import { getFile, putFile, newFile, esc, download, toast, debounce, fileParam, stageHandoff, uid, safeDocumentHtml } from './kernel.js';
import { summarize, extractEntities, extractEvents, extractClaims, researchPlan, askGuide,latestAI,attachAI,showAIStatus,askReport,draftNotice, AI_NOTICE, aiProviderName, reasonText } from './ai.js';

const $ = s => document.querySelector(s);
const page = $('#page');
let file = null, dirty = false;

/* ---------- تحميل/حفظ ---------- */
async function load() {
  const id = fileParam();
  if (id) { file = await getFile(id); }
  if (!file) { file = newFile('doc'); await putFile(file); history.replaceState(null, '', './writer.html?f=' + file.id); }
  $('#doc-name').value = file.name;showAIStatus(file);
  page.innerHTML = safeDocumentHtml(file.data.html || '<p><br></p>');
  updateCount();
  applySettings();
  const params = new URLSearchParams(location.search);
  if (params.get('import') === '1') runStagedImport();
}
function applySettings() { const s = file.data.settings || {}; if (s.font) page.style.fontFamily = `'${s.font}',Cairo,sans-serif`; if (s.size) page.style.fontSize = s.size + 'px'; if (s.dir) page.dir = s.dir; }
const save = debounce(async () => { file.data.html = page.innerHTML; await putFile(file); dirty = false; $('#save-status').textContent = 'محفوظ محليًا ' + new Date().toLocaleTimeString('ar-EG-u-nu-latn'); }, 700);
function markDirty() { dirty = true; $('#save-status').textContent = 'يحفظ…'; save(); }
page.addEventListener('input', markDirty);
$('#doc-name').addEventListener('change', async e => { file.name = e.target.value.trim() || file.name; await putFile(file); toast('أُعيدت التسمية'); });
addEventListener('beforeunload', e => { if (dirty) { file.data.html = page.innerHTML; putFile(file); } });

/* ---------- شريط الأدوات ---------- */
const FONTS_AR = ['Cairo','Amiri','Noto Naskh Arabic','Noto Kufi Arabic','Noto Sans Arabic','Tajawal','Almarai','Changa','El Messiri','Harmattan','Lateef','Mada','Markazi Text','Reem Kufi','Scheherazade New','Vazirmatn','Readex Pro','Rubik','Alexandria','IBM Plex Sans Arabic','Marhey','Aref Ruqaa','Lemonada','Rakkas'];
const FONTS_LA = ['Inter','Noto Sans','Noto Serif','Roboto','Open Sans','Montserrat','Merriweather','Playfair Display','Noto Sans Mono','Source Code Pro'];
function buildToolbar() {
  const tb = $('#toolbar');
  const fontOpts = FONTS_AR.concat(FONTS_LA).map(f => `<option value="${esc(f)}" style="font-family:'${esc(f)}'">${esc(f)}</option>`).join('');
  tb.innerHTML = `
  <select id="tb-block" title="نمط الفقرة"><option value="p">نص عادي</option><option value="h1">عنوان 1</option><option value="h2">عنوان 2</option><option value="h3">عنوان 3</option><option value="blockquote">اقتباس</option><option value="pre">شيفرة</option></select>
  <select id="tb-font" title="الخط">${fontOpts}</select>
  <select id="tb-size" title="الحجم">${[10,11,12,13,14,16,18,20,24,28,32,40,48,60].map(s => `<option${s===14?' selected':''}>${s}</option>`).join('')}</select>
  <span class="sep"></span>
  <button class="osh-tbtn" data-cmd="bold" title="غامق (Ctrl+B)"><b>غ</b></button>
  <button class="osh-tbtn" data-cmd="italic" title="مائل (Ctrl+I)"><i>م</i></button>
  <button class="osh-tbtn" data-cmd="underline" title="تسطير (Ctrl+U)"><u>س</u></button>
  <button class="osh-tbtn" data-cmd="strikeThrough" title="يتوسطه خط"><s>ش</s></button>
  <input type="color" id="tb-color" value="#17190f" title="لون النص">
  <input type="color" id="tb-hl" value="#fff3a3" title="تمييز">
  <span class="sep"></span>
  <button class="osh-tbtn" data-cmd="justifyRight" title="محاذاة يمين">⇥</button>
  <button class="osh-tbtn" data-cmd="justifyCenter" title="توسيط">≡</button>
  <button class="osh-tbtn" data-cmd="justifyLeft" title="محاذاة يسار">⇤</button>
  <button class="osh-tbtn" data-cmd="justifyFull" title="ضبط">☰</button>
  <span class="sep"></span>
  <button class="osh-tbtn" data-cmd="insertUnorderedList" title="قائمة نقطية">•≡</button>
  <button class="osh-tbtn" data-cmd="insertOrderedList" title="قائمة مرقمة">1≡</button>
  <button class="osh-tbtn" data-cmd="outdent" title="إنقاص مسافة">⇤|</button>
  <button class="osh-tbtn" data-cmd="indent" title="زيادة مسافة">|⇥</button>
  <span class="sep"></span>
  <button class="osh-tbtn" id="tb-rtl" title="اتجاه RTL/LTR">اتجاه</button>
  <span class="sep"></span>
  <button class="osh-tbtn" id="tb-link" title="رابط">🔗</button>
  <button class="osh-tbtn" id="tb-table" title="جدول">▦</button>
  <button class="osh-tbtn" id="tb-image" title="صورة">🖼</button>
  <button class="osh-tbtn" data-cmd="insertHorizontalRule" title="خط فاصل">―</button>
  <span class="sep"></span>
  <button class="osh-tbtn" data-cmd="undo" title="تراجع">↶</button>
  <button class="osh-tbtn" data-cmd="redo" title="إعادة">↷</button>
  <button class="osh-tbtn" data-cmd="removeFormat" title="مسح التنسيق">⌫</button>
  <span class="sep"></span>
  <button class="osh-tbtn" id="tb-find" title="بحث واستبدال">🔎</button>
  <span class="osh-status" id="word-count" style="margin-inline-start:auto"></span>`;
  tb.addEventListener('click', e => {
    const b = e.target.closest('[data-cmd]'); if (!b) return;
    document.execCommand(b.dataset.cmd, false, null); page.focus(); markDirty();
  });
  $('#tb-block').addEventListener('change', e => { document.execCommand('formatBlock', false, e.target.value === 'p' ? 'p' : e.target.value); page.focus(); markDirty(); });
  $('#tb-font').addEventListener('change', e => { document.execCommand('fontName', false, e.target.value); page.focus(); markDirty(); });
  $('#tb-size').addEventListener('change', e => { wrapSelection(span => span.style.fontSize = e.target.value + 'px'); markDirty(); });
  $('#tb-color').addEventListener('input', e => { document.execCommand('foreColor', false, e.target.value); markDirty(); });
  $('#tb-hl').addEventListener('input', e => { document.execCommand('hiliteColor', false, e.target.value); markDirty(); });
  $('#tb-rtl').addEventListener('click', () => { page.dir = page.dir === 'rtl' ? 'ltr' : 'rtl'; file.data.settings.dir = page.dir; markDirty(); });
  $('#tb-link').addEventListener('click', () => { const u = prompt('عنوان الرابط (https://…):'); if (u && /^https?:\/\//.test(u)) { document.execCommand('createLink', false, u); markDirty(); } });
  $('#tb-image').addEventListener('click', () => pickFile('image/*', f => { const r = new FileReader(); r.onload = () => { document.execCommand('insertImage', false, r.result); markDirty(); }; r.readAsDataURL(f); }));
  $('#tb-table').addEventListener('click', insertTableUI);
  $('#tb-find').addEventListener('click', findReplaceUI);
  page.addEventListener('input', updateCount); updateCount();
}
function updateCount() { const t = page.textContent || ''; const w = t.trim() ? t.trim().split(/\s+/).length : 0; $('#word-count').textContent = `${w} كلمة · ${t.length} حرف`; }
function wrapSelection(fn) {
  const sel = getSelection(); if (!sel.rangeCount || sel.isCollapsed) { toast('حدّد نصًا أولًا'); return; }
  const range = sel.getRangeAt(0); const span = document.createElement('span'); fn(span);
  try { range.surroundContents(span); } catch { document.execCommand('fontSize', false, '4'); page.querySelectorAll('font[size="4"]').forEach(f => { const s2 = document.createElement('span'); fn(s2); s2.innerHTML = f.innerHTML; f.replaceWith(s2); }); }
}
function insertTableUI() {
  const rows = parseInt(prompt('عدد الصفوف:', '3') || '0'), cols = parseInt(prompt('عدد الأعمدة:', '3') || '0');
  if (!rows || !cols || rows > 40 || cols > 12) return;
  let h = '<table><tbody>'; for (let r = 0; r < rows; r++) { h += '<tr>'; for (let c = 0; c < cols; c++) h += r === 0 ? '<th><br></th>' : '<td><br></td>'; h += '</tr>'; } h += '</tbody></table><p><br></p>';
  document.execCommand('insertHTML', false, h); markDirty();
}
function findReplaceUI() {
  const q = prompt('ابحث عن:'); if (q == null || !q) return;
  const rep = prompt('استبدل بـ (اتركه فارغًا للبحث فقط):');
  if (rep == null) { if (typeof find === 'function') find(q); return; }
  const count = page.innerHTML.split(q).length - 1;
  page.innerHTML = page.innerHTML.split(q).join(rep);
  markDirty(); toast(`استُبدلت ${count} مواضع`);
}
function pickFile(accept, cb) { const inp = $('#file-input'); inp.accept = accept; inp.onchange = () => { if (inp.files[0]) cb(inp.files[0]); inp.value = ''; }; inp.click(); }

/* ---------- تصدير Word من نموذج المستند ---------- */
function htmlToDocx(html, name) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, ImageRun, BorderStyle } = window.docx;
  const dom = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html').body.firstChild;
  const isAr = (file.data.settings.dir || 'rtl') === 'rtl';
  const align = a => ({ right: AlignmentType.RIGHT, center: AlignmentType.CENTER, left: AlignmentType.LEFT, justify: AlignmentType.JUSTIFIED })[a] || (isAr ? AlignmentType.RIGHT : AlignmentType.LEFT);
  function runs(node, st = {}) {
    const out = [];
    for (const ch of node.childNodes) {
      if (ch.nodeType === 3) { if (ch.textContent) out.push(new TextRun({ text: ch.textContent, bold: !!st.b, italics: !!st.i, underline: st.u ? {} : undefined, strike: !!st.s, color: st.color, size: st.size ? st.size * 2 : 28, font: st.font || file.data.settings.font || 'Cairo', rightToLeft: isAr })); continue; }
      const tag = ch.tagName ? ch.tagName.toLowerCase() : '';
      const st2 = { ...st };
      if (tag === 'b' || tag === 'strong') st2.b = true;
      if (tag === 'i' || tag === 'em') st2.i = true;
      if (tag === 'u') st2.u = true;
      if (tag === 's' || tag === 'strike' || tag === 'del') st2.s = true;
      if (ch.style) { if (ch.style.color) st2.color = ch.style.color.replace('#', ''); if (ch.style.fontSize) st2.size = parseInt(ch.style.fontSize); if (ch.style.fontFamily) st2.font = ch.style.fontFamily.replace(/['",].*$/, '').trim(); if (ch.style.fontWeight && parseInt(ch.style.fontWeight) >= 600) st2.b = true; }
      out.push(...runs(ch, st2));
    }
    return out;
  }
  async function imgRun(img) {
    try { const buf = img.src.startsWith('data:') ? Uint8Array.from(atob(img.src.split(',')[1]), c => c.charCodeAt(0)).buffer : await (await fetch(img.src)).arrayBuffer();
      return new Paragraph({ children: [new ImageRun({ data: buf, transformation: { width: Math.min(img.naturalWidth || 560, 560), height: Math.min(img.naturalHeight || 400, 560 * ((img.naturalHeight || 400) / (img.naturalWidth || 560))) }, type: img.src.startsWith('data:image/png') ? 'png' : 'jpg' })], alignment: AlignmentType.CENTER });
    } catch { return new Paragraph({ children: [] }); }
  }
  async function blocks(node) {
    const out = [];
    for (const ch of node.childNodes) {
      if (ch.nodeType === 3) { if (ch.textContent.trim()) out.push(new Paragraph({ children: runs(node.ownerDocument.createTextNode(ch.textContent).parentNode || node, {}) })); continue; }
      const tag = (ch.tagName || '').toLowerCase();
      if (/^h[1-3]$/.test(tag)) out.push(new Paragraph({ heading: { h1: HeadingLevel.HEADING_1, h2: HeadingLevel.HEADING_2, h3: HeadingLevel.HEADING_3 }[tag], children: runs(ch), alignment: align(ch.style.textAlign), bidirectional: isAr }));
      else if (tag === 'p' || tag === 'div') out.push(new Paragraph({ children: runs(ch), alignment: align(ch.style.textAlign), bidirectional: isAr }));
      else if (tag === 'blockquote') out.push(new Paragraph({ children: runs(ch, { i: true }), indent: { left: 400 }, bidirectional: isAr }));
      else if (tag === 'ul' || tag === 'ol') { for (const li of ch.querySelectorAll(':scope > li')) out.push(new Paragraph({ children: runs(li), bullet: tag === 'ul' ? { level: 0 } : undefined, numbering: tag === 'ol' ? { reference: 'osh-num', level: 0 } : undefined, bidirectional: isAr })); }
      else if (tag === 'table') {
        const trs = [...ch.querySelectorAll('tr')].map(tr => new TableRow({ children: [...tr.children].map(td => new TableCell({ children: [new Paragraph({ children: runs(td), bidirectional: isAr })], width: { size: Math.floor(9000 / tr.children.length), type: WidthType.DXA } })) }));
        out.push(new Table({ rows: trs, width: { size: 9000, type: WidthType.DXA }, borders: { top: { style: BorderStyle.SINGLE, size: 4 }, bottom: { style: BorderStyle.SINGLE, size: 4 }, left: { style: BorderStyle.SINGLE, size: 4 }, right: { style: BorderStyle.SINGLE, size: 4 }, insideHorizontal: { style: BorderStyle.SINGLE, size: 4 }, insideVertical: { style: BorderStyle.SINGLE, size: 4 } }, visuallyRightToLeft: isAr }));
      }
      else if (tag === 'img') out.push(await imgRun(ch));
      else if (tag === 'hr') out.push(new Paragraph({ children: [new TextRun({ text: '———————————', color: '888888' })], alignment: AlignmentType.CENTER }));
      else if (tag === 'pre') out.push(new Paragraph({ children: runs(ch, { font: 'Source Code Pro', size: 11 }) }));
      else if (tag === 'br') { /* skip */ }
      else out.push(...await blocks(ch));
    }
    return out;
  }
  return (async () => {
    const children = await blocks(dom);
    const doc = new Document({
      numbering: { config: [{ reference: 'osh-num', levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START }] }] },
      styles: { default: { document: { run: { font: file.data.settings.font || 'Cairo', size: (file.data.settings.size || 14) * 2 } } } },
      sections: [{ properties: { page: { margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } }, children: children.length ? children : [new Paragraph({ children: [] })] }]
    });
    return Packer.toBlob(doc);
  })();
}

/* ---------- استيراد ---------- */
async function importDocx(fileObj) {
  const buf = await fileObj.arrayBuffer();
  const r = await window.mammoth.convertToHtml({ arrayBuffer: buf }, { convertImage: window.mammoth.images.dataUri });
  page.innerHTML = safeDocumentHtml(r.value || '<p><br></p>');
  if (r.messages && r.messages.length) toast('استُورد مع ' + r.messages.length + ' ملاحظة تحويل');
  markDirty(); updateCount(); toast('استُورد ملف Word');
}
function importText(fileObj) {
  const ext = (fileObj.name.split('.').pop() || '').toLowerCase();
  fileObj.text().then(t => {
    if (ext === 'md') {
      let h = esc(t);
      h = h.replace(/^###### (.*)$/gm, '<h3>$1</h3>').replace(/^### (.*)$/gm, '<h3>$1</h3>').replace(/^## (.*)$/gm, '<h2>$1</h2>').replace(/^# (.*)$/gm, '<h1>$1</h1>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/^- (.*)$/gm, '<li>$1</li>').replace(/(<li>.*<\/li>\n?)+/g, m => '<ul>' + m + '</ul>')
        .replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>');
      page.innerHTML = '<p>' + h + '</p>';
    } else if (ext === 'html' || ext === 'htm') page.innerHTML = safeDocumentHtml(t);
    else page.innerHTML = esc(t).split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
    markDirty(); toast('استُورد الملف');
  });
}
async function runStagedImport() {
  const dataUrl = sessionStorage.getItem('osh-import-' + file.id);
  const name = sessionStorage.getItem('osh-import-name-' + file.id) || '';
  if (!dataUrl) return;
  sessionStorage.removeItem('osh-import-' + file.id); sessionStorage.removeItem('osh-import-name-' + file.id);
  const [header, encoded] = dataUrl.split(','); const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0)); const blob = new Blob([bytes], { type: header.slice(5).split(';')[0] });
  const f = new File([blob], name);
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (ext === 'docx') await importDocx(f); else importText(f);
}
/* ---------- تصدير نصي ---------- */
function exportMd() {
  let md = '';
  const walk = n => { for (const ch of n.childNodes) {
    if (ch.nodeType === 3) { md += ch.textContent; continue; }
    const t = (ch.tagName || '').toLowerCase();
    if (/^h([1-3])$/.test(t)) md += '\n' + '#'.repeat(+t[1]) + ' ' + ch.textContent.trim() + '\n\n';
    else if (t === 'p' || t === 'div') { md += '\n'; walk(ch); md += '\n'; }
    else if (t === 'strong' || t === 'b') md += '**' + ch.textContent + '**';
    else if (t === 'em' || t === 'i') md += '*' + ch.textContent + '*';
    else if (t === 'li') md += '- ' + ch.textContent.trim() + '\n';
    else if (t === 'br') md += '\n';
    else if (t === 'hr') md += '\n---\n';
    else if (t === 'img') md += `[صورة](${ch.alt || 'image'})`;
    else walk(ch);
  } };
  const d = document.createElement('div'); d.innerHTML = page.innerHTML; walk(d);
  download(file.name + '.md', new Blob([md.replace(/\n{3,}/g, '\n\n').trim()], { type: 'text/markdown;charset=utf-8' }));
}

/* ---------- قائمة ملف ---------- */
function wireMenu(btnSel, menuSel) {
  const btn = $(btnSel), menu = $(menuSel);
  btn.addEventListener('click', e => { e.stopPropagation(); menu.classList.toggle('open'); });
  document.addEventListener('click', e => { if (!menu.contains(e.target)) menu.classList.remove('open'); });
}
wireMenu('#btn-file', '#menu-file');
$('#menu-file').addEventListener('click', async e => {
  const act = e.target.dataset.act; if (!act) return;
  $('#menu-file').classList.remove('open');
  if (act === 'new') { const f = newFile('doc'); await putFile(f); location.href = './writer.html?f=' + f.id; }
  if (act === 'import-docx') pickFile('.docx', importDocx);
  if (act === 'import-html') pickFile('.html,.htm,.md,.txt', importText);
  if (act === 'export-docx') { toast('يجري إنشاء ملف Word…'); const blob = await htmlToDocx(page.innerHTML, file.name); download(file.name + '.docx', blob); }
  if (act === 'export-html') download(file.name + '.html', new Blob(['<!doctype html><html lang="ar" dir="' + (file.data.settings.dir || 'rtl') + '"><head><meta charset="utf-8"><title>' + esc(file.name) + '</title><link rel="stylesheet" href="./fonts/fonts.css"><style>body{font-family:Cairo,sans-serif;max-width:800px;margin:30px auto;padding:0 20px;line-height:1.9}</style></head><body>' + page.innerHTML + '</body></html>'], { type: 'text/html;charset=utf-8' }));
  if (act === 'export-md') exportMd();
  if (act === 'export-txt') download(file.name + '.txt', new Blob([page.textContent], { type: 'text/plain;charset=utf-8' }));
  if (act === 'print') { markDirty(); print(); }
  if (act === 'hub') location.href = './index.html';
});

/* ---------- لوحة الذكاء ---------- */
const aiPanel = $('#ai-panel'), aiResult = $('#ai-result');
$('#ai-note').textContent = AI_NOTICE;
$('#btn-ai').addEventListener('click', () => { const on = aiPanel.classList.toggle('open'); document.body.classList.toggle('ai-open', on); });
$('#ai-close').addEventListener('click', () => { aiPanel.classList.remove('open'); document.body.classList.remove('ai-open'); });
let lastAI = null;
function selectedText() { const s = getSelection().toString(); return s.trim().length > 5 ? s : (page.textContent || '').trim(); }
aiPanel.querySelectorAll('[data-ai]').forEach(b => b.addEventListener('click', async () => {
  const kind = b.dataset.ai;aiPanel.querySelectorAll('[data-ai]').forEach(x=>x.disabled=true);
  aiResult.innerHTML = 'جارٍ المعالجة عبر خادم الدليل…';
  lastAI = null; $('#ai-insert').disabled = true; $('#ai-to-sheet').disabled = true; $('#ai-to-deck').disabled = true;
  try {
    if (kind === 'summarize') {
      const r = await summarize(selectedText());
      lastAI = { html: `<h3>ملخص آلي</h3><p>${esc(r.overview)}</p>${r.quotes.length ? '<h4>اقتباسات حرفية</h4><ul>' + r.quotes.map(q => `<li>${esc(q)}</li>`).join('') + '</ul>' : ''}`, provider: r.provider };
      aiResult.innerHTML = `<span class="en-provider">${esc(aiProviderName(r.provider))}</span>${lastAI.html}`;
      $('#ai-insert').disabled = false; $('#ai-to-deck').disabled = false;
    } else if (kind === 'entities') {
      const r = await extractEntities(selectedText());
      const rows = [['الكيان', 'النوع'], ...(r.persons || []).map(x => [x, 'شخص']), ...(r.organizations || []).map(x => [x, 'جهة']), ...(r.places || []).map(x => [x, 'مكان'])];
      lastAI = { rows, provider: r.provider, html: tableHtml(rows) };
      aiResult.innerHTML = `<span class="en-provider">${esc(aiProviderName(r.provider))}</span>${lastAI.html}`;
      $('#ai-insert').disabled = false; $('#ai-to-sheet').disabled = false;
    } else if (kind === 'events') {
      const r = await extractEvents(selectedText());
      const rows = [['الحدث', 'التاريخ/الزمن'], ...((Array.isArray(r.events) ? r.events : []).map(e => [e.event || e.text || '', e.date || e.time || '']))];
      lastAI = { rows, provider: r.provider, html: tableHtml(rows) };
      aiResult.innerHTML = `<span class="en-provider">${esc(aiProviderName(r.provider))}</span>${lastAI.html}`;
      $('#ai-insert').disabled = false; $('#ai-to-sheet').disabled = false;
    } else if (kind === 'claims') {
      const r = await extractClaims(selectedText());
      const rows = [['الادعاء', 'الاقتباس الحرفي'], ...((Array.isArray(r.claims) ? r.claims : []).map(c => [c.claim || c.text || '', c.quote || '']))];
      lastAI = { rows, provider: r.provider, html: tableHtml(rows) };
      aiResult.innerHTML = `<span class="en-provider">${esc(aiProviderName(r.provider))}</span>${lastAI.html}<p class="muted" style="font-size:11px">الادعاءات مستخرجة آليًا للمراجعة — ليست أحكامًا على الصحة.</p>`;
      $('#ai-insert').disabled = false; $('#ai-to-sheet').disabled = false;
    } else if (kind === 'plan') {
      const topic = selectedText().slice(0, 280);
      const r = await researchPlan(topic);
      const steps = (r.steps || []).map((s, i) => `<li><strong>${i + 1}. ${esc(s.goal)}</strong><br>${esc(s.how)}</li>`).join('');
      lastAI = { html: `<h3>${esc(r.intro || 'خطة بحث')}</h3><ol>${steps}</ol>${r.limits ? `<p><small>الحدود: ${esc(r.limits)}</small></p>` : ''}`, provider: r.provider, plan: r };
      aiResult.innerHTML = `<span class="en-provider">${esc(aiProviderName(r.provider))}</span>${lastAI.html}<p class="muted" style="font-size:11px">خطة مقترحة لم تُنفَّذ.</p>`;
      $('#ai-insert').disabled = false; $('#ai-to-deck').disabled = false;
    } else if (kind === 'ask') {
      const q = getSelection().toString().trim() || prompt('سؤالك للدليل:');
      if (!q) { aiResult.innerHTML = ''; return; }
      const r = await askGuide(q);
      lastAI={html:'<h3>'+esc(q)+'</h3><pre style="white-space:pre-wrap">'+esc(askReport(q,r))+'</pre>',provider:r.provider};
      aiResult.innerHTML='<span class="en-provider">'+esc(aiProviderName(r.provider))+'</span>'+lastAI.html;
      $('#ai-insert').disabled = false;
    }
    if(lastAI){lastAI.provenance=latestAI();lastAI.html='<p>'+esc(draftNotice)+'</p>'+lastAI.html;aiResult.insertAdjacentHTML('afterbegin','<p>'+esc(draftNotice)+'</p>')}
  } catch (e) { aiResult.textContent = reasonText(e && e.reason, e && e.retryAfter); } finally {aiPanel.querySelectorAll('[data-ai]').forEach(x=>x.disabled=false)}
}));
function tableHtml(rows) { return '<table><tbody>' + rows.map((r, i) => '<tr>' + r.map(c => (i === 0 ? '<th>' : '<td>') + esc(c) + (i === 0 ? '</th>' : '</td>')).join('') + '</tr>').join('') + '</tbody></table>'; }
$('#ai-insert').addEventListener('click', () => { if (!lastAI) return; page.focus();const range=document.createRange();range.selectNodeContents(page);range.collapse(false);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);document.execCommand('insertHTML', false, lastAI.html + '<p><br></p>');attachAI(file,lastAI.provenance); markDirty(); toast('أُدرجت النتيجة في المستند'); });
$('#ai-to-sheet').addEventListener('click', () => { if (!lastAI || !lastAI.rows) return; stageHandoff({ kind: 'sheet', name: file.name + ' — استخراج', rows: lastAI.rows,aiProvenance:lastAI.provenance }); location.href = './index.html'; });
$('#ai-to-deck').addEventListener('click', () => {
  if (!lastAI) return;
  let slides;
  if (lastAI.plan) { slides = lastAI.plan.steps.map((s, i) => ({ title: `${i + 1}. ${s.goal}`, body: s.how })); }
  else { const d = document.createElement('div'); d.innerHTML = lastAI.html; const parts = [...d.querySelectorAll('h3, p')].filter(x => x.textContent.trim()); slides = [{ title: file.name, body: '' }]; for (let i = 0; i < parts.length; i += 4) slides.push({ title: parts[i].textContent.trim().slice(0, 80), body: parts.slice(i + 1, i + 4).map(x => x.textContent.trim()).join('\n') }); }
  const mk = slides.filter(s => s.title || s.body).map(s => ({ bg: { type: 'color', value: '#141613' }, notes: '', elements: [
    { id: uid(), type: 'text', x: 90, y: 90, w: 1100, h: 100, text: s.title, style: { fontSize: 34, bold: true, color: '#b5e853', font: 'Cairo' } },
    { id: uid(), type: 'text', x: 90, y: 230, w: 1100, h: 380, text: s.body, style: { fontSize: 22, color: '#f2f4ef', font: 'Cairo' } }] }));
  stageHandoff({ kind: 'deck', name: file.name + ' — عرض', slides: mk,aiProvenance:lastAI.provenance });
  location.href = './index.html';
});

buildToolbar();
load();
