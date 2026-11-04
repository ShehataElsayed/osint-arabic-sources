/* عروض أوش: محرر شرائح 1280×720 بعناصر نصية وصور وأشكال وجداول، تصدير/استيراد pptx. */
import { getFile, putFile, newFile, esc, download, toast, debounce, fileParam, uid } from './kernel.js';
import { summarize, researchPlan, askGuide,latestAI,attachAI,showAIStatus,askReport,draftNotice,decisionName, AI_NOTICE, aiProviderName, reasonText } from './ai.js';

const $ = s => document.querySelector(s);
const stage = $('#stage'), thumbs = $('#thumbs');
let file = null, dirty = false, cur = 0, selId = null, scale = 1;

const W = 1280, H = 720;
function slide() { return file.data.slides[cur]; }
function el(id) { return slide().elements.find(e => e.id === id); }

/* ---------- عرض الشريحة ---------- */
function renderSlideInto(container, s, interactive) {
  container.innerHTML = '';
  const bg = s.bg || { type: 'color', value: '#141613' };
  container.style.background = bg.type === 'gradient' ? `linear-gradient(135deg, ${bg.value}, ${bg.value2 || '#0a0d08'})` : (bg.value || '#141613');
  for (const e of s.elements) {
    const d = document.createElement('div');
    d.className = 'osh-el' + (interactive && e.id === selId ? ' sel' : '');
    d.style.cssText = `left:${e.x}px;top:${e.y}px;width:${e.w}px;height:${e.h}px;z-index:${e.z || 1}`;
    d.dataset.elid = e.id;
    const st = e.style || {};
    if (e.type === 'text') {
      const t = document.createElement('div'); t.className = 'el-text';
      t.contentEditable = interactive ? 'true' : 'false'; t.spellcheck = false;
      t.innerHTML = esc(e.text || '').replace(/\n/g, '<br>');
      t.style.cssText = `font-size:${st.fontSize || 24}px;color:${st.color || '#f2f4ef'};font-family:'${st.font || 'Cairo'}',sans-serif;text-align:${st.align || 'right'};font-weight:${st.bold ? 800 : 400};line-height:1.7;direction:rtl;padding:6px`;
      if (interactive) t.addEventListener('input', () => { e.text = t.innerText; markDirty(); });
      d.appendChild(t);
    } else if (e.type === 'image') {
      const img = document.createElement('img'); img.src = e.src; img.alt = e.alt || ''; img.draggable = false; d.appendChild(img);
    } else if (e.type === 'shape') {
      const f = document.createElement('div'); f.className = 'el-fill';
      f.style.cssText = `background:${st.fill || '#b5e853'};border:${st.line ? '2px solid ' + st.line : 'none'};border-radius:${e.shape === 'ellipse' ? '50%' : (st.radius || 4) + 'px'};opacity:${st.opacity ?? 1}`;
      d.appendChild(f);
      if (e.shape === 'line') f.style.cssText = `background:${st.fill || '#b5e853'};height:3px;top:50%;position:absolute;left:0;right:0`;
    } else if (e.type === 'table') {
      const rows = e.rows || [['', ''], ['', '']];
      const tb = document.createElement('table');
      tb.style.cssText = 'width:100%;height:100%;border-collapse:collapse;font-size:' + (st.fontSize || 16) + 'px;color:' + (st.color || '#f2f4ef');
      tb.innerHTML = rows.map((r, i) => '<tr>' + r.map(c => `<td contenteditable="${interactive ? 'true' : 'false'}" style="border:1px solid #4b6032;padding:6px 10px;${i === 0 ? 'background:#26351a;font-weight:700' : ''}">${esc(c)}</td>`).join('') + '</tr>').join('');
      if (interactive) tb.addEventListener('input', () => { e.rows = [...tb.rows].map(tr => [...tr.cells].map(td => td.innerText)); markDirty(); });
      d.appendChild(tb);
    }
    container.appendChild(d);
  }
}
function fitStage() {
  const wrap = $('#stage-wrap');
  scale = Math.min(1, (wrap.clientWidth - 30) / W);
  stage.style.transform = `scale(${scale})`;
  stage.style.marginBottom = (-(H * (1 - scale))) + 'px';
}
function render() {
  renderSlideInto(stage, slide(), true);
  if (selId) addHandles(selId);
  renderThumbs();
  $('#notes').value = slide().notes || '';
}
function renderThumbs() {
  thumbs.innerHTML = '';
  file.data.slides.forEach((s, i) => {
    const t = document.createElement('div'); t.className = 'osh-thumb' + (i === cur ? ' on' : '');
    const inner = document.createElement('div'); inner.className = 'thumb-scale';
    const tw = thumbs.clientWidth - 8 || 190; const k = tw / W;
    inner.style.transform = `scale(${k})`;
    renderSlideInto(inner, s, false);
    t.appendChild(inner);
    const n = document.createElement('span'); n.className = 'tnum'; n.textContent = i + 1; t.appendChild(n);
    t.addEventListener('click', () => { cur = i; selId = null; render(); });
    thumbs.appendChild(t);
  });
}
/* ---------- سحب وتغيير الحجم ---------- */
function addHandles(id) {
  stage.querySelectorAll('.osh-handle').forEach(h => h.remove());
  const e = el(id); if (!e) return;
  for (const [name, dx, dy] of [['se', 1, 1], ['sw', -1, 1], ['ne', 1, -1], ['nw', -1, -1]]) {
    const h = document.createElement('div'); h.className = 'osh-handle'; h.dataset.h = name;
    h.style.left = (dx > 0 ? e.x + e.w - 5 : e.x - 5) + 'px';
    h.style.top = (dy > 0 ? e.y + e.h - 5 : e.y - 5) + 'px';
    stage.appendChild(h);
  }
}
let drag = null;
stage.addEventListener('mousedown', e => {
  const handle = e.target.closest('.osh-handle');
  const eld = e.target.closest('.osh-el');
  if (handle && selId) { drag = { mode: 'resize', h: handle.dataset.h, id: selId, sx: e.clientX, sy: e.clientY, orig: { ...el(selId) } }; e.preventDefault(); return; }
  if (eld) {
    const id = eld.dataset.elid;
    if (id !== selId) { selId = id; render(); }
    const o = el(id);
    drag = { mode: 'move', id, sx: e.clientX, sy: e.clientY, orig: { x: o.x, y: o.y } };
    e.preventDefault();
  } else { selId = null; render(); }
});
addEventListener('mousemove', e => {
  if (!drag) return;
  const o = el(drag.id); if (!o) return;
  const dx = (e.clientX - drag.sx) / scale, dy = (e.clientY - drag.sy) / scale;
  if (drag.mode === 'move') { o.x = Math.round(Math.max(-o.w + 30, Math.min(W - 30, drag.orig.x + dx))); o.y = Math.round(Math.max(-o.h + 30, Math.min(H - 30, drag.orig.y + dy))); }
  else {
    const or = drag.orig;
    if (drag.h.includes('e')) o.w = Math.max(30, or.w + dx);
    if (drag.h.includes('s')) o.h = Math.max(20, or.h + dy);
    if (drag.h.includes('w')) { o.w = Math.max(30, or.w - dx); o.x = or.x + dx; }
    if (drag.h.includes('n')) { o.h = Math.max(20, or.h - dy); o.y = or.y + dy; }
  }
  const d = stage.querySelector(`[data-elid="${o.id}"]`); if (d) { d.style.left = o.x + 'px'; d.style.top = o.y + 'px'; d.style.width = o.w + 'px'; d.style.height = o.h + 'px'; }
  addHandles(o.id);
});
addEventListener('mouseup', () => { if (drag) { markDirty(); renderThumbs(); drag = null; } });
$('#notes').addEventListener('input', e => { slide().notes = e.target.value; markDirty(); });

/* ---------- شريط الأدوات ---------- */
const FONTS = ['Cairo','Amiri','Noto Naskh Arabic','Noto Kufi Arabic','Noto Sans Arabic','Tajawal','Almarai','Changa','El Messiri','Markazi Text','Reem Kufi','Scheherazade New','Vazirmatn','Readex Pro','Rubik','Alexandria','IBM Plex Sans Arabic','Aref Ruqaa','Lemonada','Inter','Noto Sans','Noto Serif','Montserrat','Playfair Display'];
function buildToolbar() {
  const tb = $('#toolbar');
  tb.innerHTML = `
  <button class="osh-tbtn" id="t-add-slide" title="شريحة جديدة">+ شريحة</button>
  <div class="osh-drop"><button class="osh-tbtn" id="t-layout">قالب ▾</button><div class="osh-menu" id="m-layout"></div></div>
  <button class="osh-tbtn" id="t-dup" title="تكرار الشريحة">⧉</button>
  <button class="osh-tbtn" id="t-del-slide" title="حذف الشريحة">🗑</button>
  <span class="sep"></span>
  <button class="osh-tbtn" id="t-text" title="نص">نص</button>
  <button class="osh-tbtn" id="t-img" title="صورة">🖼</button>
  <button class="osh-tbtn" id="t-rect" title="مستطيل">▭</button>
  <button class="osh-tbtn" id="t-ellipse" title="دائرة">◯</button>
  <button class="osh-tbtn" id="t-line" title="خط">―</button>
  <button class="osh-tbtn" id="t-table" title="جدول">▦</button>
  <span class="sep"></span>
  <select id="t-font" title="الخط">${FONTS.map(f => `<option style="font-family:'${f}'">${f}</option>`).join('')}</select>
  <select id="t-size" title="حجم الخط">${[14,18,22,26,32,40,54,72].map(s => `<option${s===26?' selected':''}>${s}</option>`).join('')}</select>
  <button class="osh-tbtn" id="t-bold" title="غامق"><b>غ</b></button>
  <input type="color" id="t-color" value="#f2f4ef" title="لون النص/الشكل">
  <button class="osh-tbtn" id="t-al-r" title="يمين">⇥</button><button class="osh-tbtn" id="t-al-c" title="وسط">≡</button><button class="osh-tbtn" id="t-al-l" title="يسار">⇤</button>
  <span class="sep"></span>
  <input type="color" id="t-bg" value="#141613" title="خلفية الشريحة">
  <button class="osh-tbtn" id="t-bggrad" title="خلفية متدرجة">تدرج</button>
  <span class="sep"></span>
  <button class="osh-tbtn" id="t-front" title="للأمام">⬆</button><button class="osh-tbtn" id="t-back" title="للخلف">⬇</button>
  <button class="osh-tbtn" id="t-del-el" title="حذف العنصر">⌫ عنصر</button>`;
  const on = (id, fn) => $(id).addEventListener('click', fn);
  on('#t-add-slide', () => { pushUndo(); file.data.slides.splice(cur + 1, 0, { bg: { type: 'color', value: file.data.theme.canvas }, elements: [], notes: '' }); cur++; render(); markDirty(); });
  on('#t-dup', () => { pushUndo(); const c = JSON.parse(JSON.stringify(slide())); c.elements.forEach(e => e.id = uid()); file.data.slides.splice(cur + 1, 0, c); cur++; render(); markDirty(); });
  on('#t-del-slide', () => { if (file.data.slides.length <= 1) return toast('العرض يحتاج شريحة واحدة على الأقل'); if (!confirm('احذف الشريحة الحالية؟')) return; pushUndo(); file.data.slides.splice(cur, 1); cur = Math.max(0, cur - 1); render(); markDirty(); });
  on('#t-text', () => addEl({ type: 'text', x: 120, y: 120, w: 900, h: 90, text: 'نص جديد', style: { fontSize: 26, color: '#f2f4ef', font: 'Cairo' } }));
  on('#t-img', () => pickFile('image/*', f => { const r = new FileReader(); r.onload = () => { const img = new Image(); img.onload = () => { const k = Math.min(600 / img.width, 420 / img.height, 1); addEl({ type: 'image', x: (W - img.width * k) / 2, y: (H - img.height * k) / 2, w: img.width * k, h: img.height * k, src: r.result }); }; img.src = r.result; }; r.readAsDataURL(f); }));
  on('#t-rect', () => addEl({ type: 'shape', shape: 'rect', x: 300, y: 250, w: 400, h: 200, style: { fill: '#26351a', line: '#b5e853' } }));
  on('#t-ellipse', () => addEl({ type: 'shape', shape: 'ellipse', x: 400, y: 250, w: 240, h: 240, style: { fill: '#2c3b1b', line: '#b5e853' } }));
  on('#t-line', () => addEl({ type: 'shape', shape: 'line', x: 240, y: 350, w: 800, h: 6, style: { fill: '#b5e853' } }));
  on('#t-table', () => { const r = parseInt(prompt('الصفوف:', '3') || '0'), c = parseInt(prompt('الأعمدة:', '3') || '0'); if (!r || !c) return; addEl({ type: 'table', x: 200, y: 200, w: 880, h: 60 * r, rows: Array.from({ length: r }, () => Array.from({ length: c }, () => '')) }); });
  $('#t-font').addEventListener('change', e => styleSel({ font: e.target.value }));
  $('#t-size').addEventListener('change', e => styleSel({ fontSize: +e.target.value }));
  on('#t-bold', () => { const e0 = el(selId); if (e0) styleSel({ bold: !(e0.style && e0.style.bold) }); });
  $('#t-color').addEventListener('input', e => { const o = el(selId); if (!o) return; if (o.type === 'shape') styleSel({ fill: e.target.value }); else styleSel({ color: e.target.value }); });
  on('#t-al-r', () => styleSel({ align: 'right' })); on('#t-al-c', () => styleSel({ align: 'center' })); on('#t-al-l', () => styleSel({ align: 'left' }));
  $('#t-bg').addEventListener('input', e => { slide().bg = { type: 'color', value: e.target.value }; render(); markDirty(); });
  on('#t-bggrad', () => { slide().bg = { type: 'gradient', value: '#1a2113', value2: '#050605' }; render(); markDirty(); });
  on('#t-front', () => { const o = el(selId); if (!o) return; o.z = (o.z || 1) + 1; render(); markDirty(); });
  on('#t-back', () => { const o = el(selId); if (!o) return; o.z = Math.max(0, (o.z || 1) - 1); render(); markDirty(); });
  on('#t-del-el', () => { if (!selId) return; pushUndo(); slide().elements = slide().elements.filter(x => x.id !== selId); selId = null; render(); markDirty(); });
  /* القوالب */
  const layouts = [
    ['شريحة عنوان', s => { s.elements = [txt(90, 250, 1100, 150, 'عنوان العرض', { fontSize: 54, bold: true, align: 'center' }), txt(190, 430, 900, 70, 'سطر تعريفي', { fontSize: 24, align: 'center', color: '#b5e853' })]; }],
    ['عنوان ومحتوى', s => { s.elements = [txt(90, 60, 1100, 90, 'العنوان', { fontSize: 36, bold: true, color: '#b5e853' }), txt(90, 190, 1100, 420, 'نقطة أولى\nنقطة ثانية\nنقطة ثالثة', { fontSize: 24 })]; }],
    ['عمودان', s => { s.elements = [txt(90, 60, 1100, 90, 'العنوان', { fontSize: 36, bold: true, color: '#b5e853' }), txt(660, 190, 530, 420, 'العمود الأيمن', { fontSize: 22 }), txt(90, 190, 530, 420, 'العمود الأيسر', { fontSize: 22 })]; }],
    ['اقتباس', s => { s.elements = [txt(140, 260, 1000, 200, '"نص الاقتباس"', { fontSize: 34, align: 'center' }), txt(140, 480, 1000, 60, '— المصدر', { fontSize: 20, align: 'center', color: '#b5e853' })]; }],
    ['قسم فاصل', s => { s.bg = { type: 'gradient', value: '#1a2113', value2: '#050605' }; s.elements = [txt(90, 300, 1100, 120, 'عنوان القسم', { fontSize: 48, bold: true, align: 'center' })]; }],
    ['فارغة', s => { s.elements = []; }],
  ];
  const m = $('#m-layout');
  for (const [name, fn] of layouts) { const b = document.createElement('button'); b.textContent = name; b.addEventListener('click', () => { pushUndo(); fn(slide()); render(); markDirty(); m.classList.remove('open'); }); m.appendChild(b); }
  $('#t-layout').addEventListener('click', e => { e.stopPropagation(); m.classList.toggle('open'); });
  document.addEventListener('click', () => m.classList.remove('open'));
  function txt(x, y, w, h, text, st) { return { id: uid(), type: 'text', x, y, w, h, text, style: { font: 'Cairo', color: '#f2f4ef', ...st } }; }
}
function addEl(e) { pushUndo(); e.id = uid(); e.z = Math.max(0, ...slide().elements.map(x => x.z || 0)) + 1; slide().elements.push(e); selId = e.id; render(); markDirty(); }
function styleSel(patch) { if (!selId) return toast('حدّد عنصرًا على الشريحة أولًا'); pushUndo(); const o = el(selId); o.style = { ...(o.style || {}), ...patch }; render(); markDirty(); }
function pickFile(accept, cb) { const inp = $('#file-input'); inp.accept = accept; inp.onchange = () => { if (inp.files[0]) cb(inp.files[0]); inp.value = ''; }; inp.click(); }
/* تراجع بسيط على مستوى العرض */
const undoStack = [], redoStack = [];
function pushUndo() { undoStack.push(JSON.stringify(file.data)); if (undoStack.length > 50) undoStack.shift(); redoStack.length = 0; }
function undo() { if (!undoStack.length) return; redoStack.push(JSON.stringify(file.data)); file.data = JSON.parse(undoStack.pop()); render(); markDirty(); }
function redo() { if (!redoStack.length) return; undoStack.push(JSON.stringify(file.data)); file.data = JSON.parse(redoStack.pop()); render(); markDirty(); }
document.addEventListener('keydown', e => {
  if (e.target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
  if (e.key === 'Delete' && selId) { pushUndo(); slide().elements = slide().elements.filter(x => x.id !== selId); selId = null; render(); markDirty(); }
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'PageDown' || e.key === 'PageUp') {
    const d = (e.key === 'ArrowLeft' || e.key === 'PageDown') ? 1 : -1;
    if (!selId) { cur = Math.min(Math.max(0, cur + d), file.data.slides.length - 1); render(); }
    else { const o = el(selId); pushUndo(); if (e.key.startsWith('Arrow')) { o.x += (e.key === 'ArrowLeft' ? 10 : -10); } render(); markDirty(); }
    e.preventDefault();
  }
});
/* ---------- وضع العرض ---------- */
let presenting = false;
$('#btn-present').addEventListener('click', () => { presenting = true; cur = 0; showPresent(); document.getElementById('present').classList.add('on'); document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); });
function showPresent() { const ps = $('#p-stage'); renderSlideInto(ps, file.data.slides[cur], false); const k = Math.min(innerWidth / W, innerHeight / H); ps.style.transform = `scale(${k})`; ps.style.transformOrigin = 'center center'; ps.style.width = W + 'px'; ps.style.height = H + 'px'; }
$('#present').addEventListener('click', e => { if (cur < file.data.slides.length - 1) { cur++; showPresent(); } else exitPresent(); });
document.addEventListener('keydown', e => {
  if (!presenting) return;
  if (e.key === 'Escape') exitPresent();
  if (e.key === 'ArrowLeft' || e.key === ' ' || e.key === 'PageDown') { if (cur < file.data.slides.length - 1) { cur++; showPresent(); } else exitPresent(); }
  if (e.key === 'ArrowRight' || e.key === 'PageUp') { if (cur > 0) { cur--; showPresent(); } }
});
function exitPresent() { presenting = false; $('#present').classList.remove('on'); document.exitFullscreen && document.exitFullscreen().catch(() => {}); }

/* ---------- تصدير PowerPoint ---------- */
async function exportPptx() {
  toast('يجري إنشاء ملف PowerPoint…');
  const p = new PptxGenJS();
  p.defineLayout({ name: 'OSH', width: 13.333, height: 7.5 }); p.layout = 'OSH'; p.rtlMode = true;
  for (const s of file.data.slides) {
    const ps = p.addSlide();
    const bg = s.bg || {};
    ps.background = { color: (bg.type === 'gradient' ? (bg.value || '#141613') : (bg.value || '#141613')).replace('#', '') };
    for (const e of s.elements) {
      const st = e.style || {}; const base = { x: e.x / 96, y: e.y / 96, w: e.w / 96, h: e.h / 96 };
      if (e.type === 'text') ps.addText((e.text || '').split('\n').map(t => ({ text: t, options: { breakLine: true } })), { ...base, fontSize: (st.fontSize || 24) * 0.75, color: (st.color || '#f2f4ef').replace('#', ''), fontFace: st.font || 'Cairo', align: st.align || 'right', bold: !!st.bold, rtlMode: true, valign: 'top' });
      else if (e.type === 'image') { try { ps.addImage({ ...base, data: e.src }); } catch {} }
      else if (e.type === 'shape') { const map = { rect: 'rect', ellipse: 'ellipse', line: 'line' }; ps.addShape(map[e.shape] || 'rect', { ...base, fill: { color: (st.fill || '#b5e853').replace('#', '') }, line: st.line ? { color: st.line.replace('#', ''), width: 1.5 } : { type: 'none' } }); }
      else if (e.type === 'table') ps.addTable((e.rows || []).map((r, i) => r.map(c => ({ text: c, options: { bold: i === 0, fill: i === 0 ? { color: '26351A' } : undefined, color: 'F2F4EF' } }))), { ...base, border: { pt: 1, color: '4B6032' }, fontSize: (st.fontSize || 16) * 0.75, fontFace: 'Cairo', rtlMode: true, fill: { color: '141613' } });
    }
    if (s.notes) ps.addNotes(s.notes);
  }
  await p.writeFile({ fileName: file.name + '.pptx' });
  toast('نُزّل ملف PowerPoint');
}
/* ---------- استيراد PowerPoint ---------- */
const EMU = 914400; /* بكسل عرضنا 96dpi ≈ EMU/9525 */
async function importPptx(fileObj) {
  const zip = await JSZip.loadAsync(await fileObj.arrayBuffer());
  let slideNames = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => (+a.match(/(\d+)/)[1]) - (+b.match(/(\d+)/)[1]));
  if(zip.file('ppt/presentation.xml')&&zip.file('ppt/_rels/presentation.xml.rels')){
    const pd=new DOMParser().parseFromString(await zip.file('ppt/presentation.xml').async('text'),'application/xml');
    const pr=new DOMParser().parseFromString(await zip.file('ppt/_rels/presentation.xml.rels').async('text'),'application/xml'),targets={};
    pr.querySelectorAll('Relationship').forEach(r=>{if(r.getAttribute('TargetMode')!=='External'&&(r.getAttribute('Type')||'').endsWith('/slide'))targets[r.getAttribute('Id')]=new URL(r.getAttribute('Target'),'https://package.invalid/ppt/presentation.xml').pathname.slice(1)});
    const ordered=[...pd.querySelectorAll('p\\:sldId, sldId')].map(el=>targets[el.getAttribute('r:id')]).filter(n=>slideNames.includes(n));
    if(ordered.length)slideNames=ordered;
  }
  if (!slideNames.length) return toast('لم يُعثر على شرائح في الملف');
  pushUndo();
  const slides = [];
  for (const sn of slideNames) {
    const xml = await zip.file(sn).async('text');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const relsName = sn.replace('slides/', 'slides/_rels/') + '.rels';
    const rels = {}; let notesPath='';
    if (zip.file(relsName)) {
      const rd = new DOMParser().parseFromString(await zip.file(relsName).async('text'), 'application/xml');
      rd.querySelectorAll('Relationship').forEach(r => {if(r.getAttribute('TargetMode')==='External')return;const target=r.getAttribute('Target');rels[r.getAttribute('Id')]=target;if((r.getAttribute('Type')||'').endsWith('/notesSlide'))notesPath=new URL(target,'https://package.invalid/'+sn).pathname.slice(1)});
    }
    const elements = [];
    const walk = async node => {
      for (const sp of node.querySelectorAll('p\\:sp, sp')) {
        const xfrm = sp.querySelector('a\\:xfrm, xfrm');
        let x = 100, y = 100, w = 600, h = 100;
        if (xfrm) { const off = xfrm.querySelector('a\\:off, off'), ext = xfrm.querySelector('a\\:ext, ext');
          if (off) { x = Math.round(+off.getAttribute('x') / EMU * 96); y = Math.round(+off.getAttribute('y') / EMU * 96); }
          if (ext) { w = Math.round(+ext.getAttribute('cx') / EMU * 96); h = Math.round(+ext.getAttribute('cy') / EMU * 96); } }
        const paras = [...sp.querySelectorAll('a\\:p, p')].map(pa => [...pa.querySelectorAll('a\\:t, t')].map(t => t.textContent).join('')).filter(t => t !== '');
        if (!paras.length) continue;
        const rPr = sp.querySelector('a\\:rPr, rPr');
        const sz = rPr && rPr.getAttribute('sz') ? +rPr.getAttribute('sz') / 100 / 0.75 : 24;
        const bold = rPr && rPr.getAttribute('b') === '1';
        let color = '#f2f4ef';
        const srgb = rPr && rPr.querySelector('a\\:srgbClr, srgbClr'); if (srgb) color = '#' + srgb.getAttribute('val');
        const latin=rPr&&rPr.querySelector('a\\:latin, latin'),para=sp.querySelector('a\\:pPr, pPr');
        const align={r:'right',l:'left',ctr:'center',just:'justify'}[para?.getAttribute('algn')]||'right';
        elements.push({ id: uid(), type: 'text', x, y, w, h, text: paras.join('\n'), style: { fontSize: sz, bold, color, font:latin?.getAttribute('typeface')||'Cairo',align } });
      }
      for (const pic of node.querySelectorAll('p\\:pic, pic')) {
        const blip = pic.querySelector('a\\:blip, blip'); const rid = blip && (blip.getAttribute('r:embed') || blip.getAttribute('embed'));
        const target = rid && rels[rid]; if (!target) continue;
        const path = 'ppt/' + target.replace(/^\.\.\//, '').replace(/^media/, 'media').replace('slides/', '');
        const f2 = zip.file(path) || zip.file('ppt/' + target.replace('../', ''));
        if (!f2) continue;
        const b64 = await f2.async('base64');
        const mime = /\.(png)$/i.test(path) ? 'image/png' : (/\.(gif)$/i.test(path) ? 'image/gif' : 'image/jpeg');
        const xfrm = pic.querySelector('a\\:xfrm, xfrm'); let x = 100, y = 100, w = 400, h = 300;
        if (xfrm) { const off = xfrm.querySelector('a\\:off, off'), ext = xfrm.querySelector('a\\:ext, ext');
          if (off) { x = Math.round(+off.getAttribute('x') / EMU * 96); y = Math.round(+off.getAttribute('y') / EMU * 96); }
          if (ext) { w = Math.round(+ext.getAttribute('cx') / EMU * 96); h = Math.round(+ext.getAttribute('cy') / EMU * 96); } }
        elements.push({ id: uid(), type: 'image', x, y, w, h, src: `data:${mime};base64,${b64}` });
      }
    };
    await walk(doc);
    let notes='';
    if(notesPath&&zip.file(notesPath)){
      const nd=new DOMParser().parseFromString(await zip.file(notesPath).async('text'),'application/xml');
      notes=[...nd.querySelectorAll('p\\:sp, sp')].filter(sp=>sp.querySelector('p\\:ph, ph')?.getAttribute('type')==='body').flatMap(sp=>[...sp.querySelectorAll('a\\:p, p')].map(pa=>[...pa.querySelectorAll('a\\:t, t')].map(t=>t.textContent).join(''))).join('\n').trim();
    }
    const bg=doc.querySelector('p\\:bg p\\:bgPr a\\:solidFill a\\:srgbClr, bg bgPr solidFill srgbClr');
    slides.push({ bg: { type: 'color', value:bg?'#'+bg.getAttribute('val'):'#141613' }, elements, notes });
  }
  file.data.slides = slides; cur = 0; selId = null;
  render(); markDirty(); toast(`استُورد العرض (${slides.length} شريحة)`);
}

/* ---------- لوحة الذكاء ---------- */
const aiPanel = $('#ai-panel'), aiResult = $('#ai-result');
$('#ai-note').textContent = AI_NOTICE;
$('#btn-ai').addEventListener('click', () => { const on = aiPanel.classList.toggle('open'); document.body.classList.toggle('ai-open', on); });
$('#ai-close').addEventListener('click', () => { aiPanel.classList.remove('open'); document.body.classList.remove('ai-open'); });
let aiSlides = null,aiEnvelope=null;
aiPanel.querySelectorAll('[data-ai]').forEach(b => b.addEventListener('click', async () => {
  const kind = b.dataset.ai;aiPanel.querySelectorAll('[data-ai]').forEach(x=>x.disabled=true);
  aiResult.innerHTML = 'جارٍ المعالجة عبر خادم الدليل…'; aiSlides = null;aiEnvelope=null; $('#ai-insert').disabled = true;
  try {
    if (kind === 'deck-plan') {
      const q = prompt('موضوع العرض:'); if (!q) { aiResult.innerHTML = ''; return; }
      const plan = await researchPlan(q);
      aiSlides = [{ title: q, body: plan.intro || '', notes: '' }].concat((plan.steps || []).map((s, i) => ({ title: `${i + 1}. ${s.goal}`, body: s.how, notes: '' }))).concat(plan.limits ? [{ title: 'الحدود', body: plan.limits, notes: '' }] : []);
      aiResult.innerHTML = `<span class="en-provider">${esc(aiProviderName(plan.provider))}</span><p style="font-size:12.5px">${aiSlides.length} شرائح مقترحة — خطة لم تُنفَّذ، راجعها قبل الاعتماد.</p>`;
      $('#ai-insert').disabled = false;
    } else if (kind === 'summarize-slide') {
      const text = slide().elements.filter(e => e.type === 'text').map(e => e.text).join('\n');
      if (!text.trim()) { aiResult.textContent = 'الشريحة الحالية بلا نص.'; return; }
      const r = await summarize(text);
      aiSlides = [{ title: 'ملخص الشريحة ' + (cur + 1), body: r.overview, notes: (r.quotes || []).join('\n') }];
      aiResult.innerHTML = `<span class="en-provider">${esc(aiProviderName(r.provider))}</span><p style="font-size:12.5px;line-height:2">${esc(r.overview)}</p>`;
      $('#ai-insert').disabled = false;
    } else if (kind === 'ask') {
      const q = prompt('سؤالك للدليل:'); if (!q) { aiResult.innerHTML = ''; return; }
      const r = await askGuide(q);
      const report=askReport(q,r);
      aiSlides=[{title:q.slice(0,80),body:'الحالة: '+decisionName(r.decision||'answer')+'\n'+draftNotice+'\n'+(r.answer||r.insufficient_reason||'لا توجد إجابة مكتملة.').slice(0,600)+'\nالتقرير الكامل والمصادر والحدود في ملاحظات المتحدث.',notes:report}];
      aiResult.innerHTML='<span class="en-provider">'+esc(aiProviderName(r.provider))+'</span><pre style="white-space:pre-wrap">'+esc(report)+'</pre>';
      $('#ai-insert').disabled = false;
    }
    if(aiSlides){aiEnvelope=latestAI();aiResult.insertAdjacentHTML('afterbegin','<p>'+esc(draftNotice)+'</p>');aiSlides.forEach(s=>{s.notes=draftNotice+'\n'+(s.notes||'')})}
  } catch (e) { aiResult.textContent = reasonText(e && e.reason, e && e.retryAfter); } finally {aiPanel.querySelectorAll('[data-ai]').forEach(x=>x.disabled=false)}
}));
$('#ai-insert').addEventListener('click', () => {
  if (!aiSlides) return;
  pushUndo();
  const mk = aiSlides.map(s => ({ bg: { type: 'color', value: file.data.theme.canvas }, notes: s.notes || '', elements: [
    { id: uid(), type: 'text', x: 90, y: 90, w: 1100, h: 100, text: s.title, style: { fontSize: 34, bold: true, color: file.data.theme.accent, font: 'Cairo' } },
    { id: uid(), type: 'text', x: 90, y: 230, w: 1100, h: 380, text: s.body, style: { fontSize: 22, color: file.data.theme.ink, font: 'Cairo' } }] }));
  file.data.slides.splice(cur + 1, 0, ...mk);cur++;selId=null;attachAI(file,aiEnvelope);
  render(); markDirty(); toast(`أُدرجت ${mk.length} شرائح`);
});

/* ---------- قائمة ملف والحفظ ---------- */
function wireFileMenu() {
  const btn = $('#btn-file'), menu = $('#menu-file');
  btn.addEventListener('click', e => { e.stopPropagation(); menu.classList.toggle('open'); });
  document.addEventListener('click', e => { if (!menu.contains(e.target)) menu.classList.remove('open'); });
  menu.addEventListener('click', async e => {
    const act = e.target.dataset.act; if (!act) return; menu.classList.remove('open');
    if (act === 'new') { const f = newFile('deck'); await putFile(f); location.href = './slides.html?f=' + f.id; }
    if (act === 'import-pptx') pickFile('.pptx', importPptx);
    if (act === 'export-pptx') exportPptx();
    if (act === 'print') print();
    if (act === 'hub') location.href = './index.html';
  });
}
const save = debounce(async () => { await putFile(file); dirty = false; $('#save-status').textContent = 'محفوظ محليًا ' + new Date().toLocaleTimeString('ar-EG-u-nu-latn'); }, 700);
function markDirty() { dirty = true; $('#save-status').textContent = 'يحفظ…'; save(); }
$('#doc-name').addEventListener('change', async e => { file.name = e.target.value.trim() || file.name; await putFile(file); });
async function load() {
  const id = fileParam();
  if (id) file = await getFile(id);
  if (!file) { file = newFile('deck'); await putFile(file); history.replaceState(null, '', './slides.html?f=' + file.id); }
  $('#doc-name').value = file.name;showAIStatus(file);
  const params = new URLSearchParams(location.search);
  if (params.get('import') === '1') {
    const dataUrl = sessionStorage.getItem('osh-import-' + file.id); const name = sessionStorage.getItem('osh-import-name-' + file.id) || '';
    if (dataUrl) { sessionStorage.removeItem('osh-import-' + file.id); sessionStorage.removeItem('osh-import-name-' + file.id); const [header, encoded] = dataUrl.split(','); const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0)); const blob = new Blob([bytes], { type: header.slice(5).split(';')[0] }); await importPptx(new File([blob], name)); }
  }
  buildToolbar(); wireFileMenu(); fitStage(); render();
}
addEventListener('resize', fitStage);
addEventListener('beforeunload', () => { if (dirty) putFile(file); });
load();
