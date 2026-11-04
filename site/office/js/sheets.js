/* جداول أوش: شبكة كانفس بمحرك الدوال المحلي (formula.js)، اتجاه RTL أصلي، أوراق متعددة. */
import { getFile, putFile, newFile, esc, download, toast, debounce, fileParam, uid } from './kernel.js';
import { summarize, extractEntities, extractEvents, extractClaims, researchPlan, AI_NOTICE, aiProviderName, reasonText } from './ai.js';
import { evalFormula, isError, numToCol, colToNum, parseA1, ERR } from './formula.js';

const $ = s => document.querySelector(s);
const host = $('#grid-host'), canvas = $('#grid'), ctx = canvas.getContext('2d');
let file = null, dirty = false;

/* ---------- نموذج ---------- */
const K = (r, c) => r + ',' + c;
function sheet() { return file.data.sheets[file.data.active]; }
function getCell(r, c, sh) { const s = sh || sheet(); return s.cells[K(r, c)] || null; }
function setCell(r, c, patch, sh) { const s = sh || sheet(); const k = K(r, c); const cur = s.cells[k] || {}; const nxt = { ...cur, ...patch }; if (nxt.v == null && !nxt.f && !nxt.s) delete s.cells[k]; else s.cells[k] = nxt; }
window.__oshSheet = { displayValue: (r, c) => displayValue(r, c) };
function usedBounds(sh) { const s = sh || sheet(); let mr = 30, mc = 8; for (const k of Object.keys(s.cells)) { const [r, c] = k.split(',').map(Number); if (r > mr) mr = r; if (c > mc) mc = c; } return { rows: Math.min(mr + 30, 5000), cols: Math.min(mc + 8, 200) }; }

/* قيمة معروضة لخلية (تقييم الصيغ مع كشف الدورات) */
let cache = new Map(), visiting = new Set();
function displayValue(r, c, sh) {
  const s = sh || sheet(); const cell = s.cells[K(r, c)];
  if (!cell) return '';
  if (!cell.f) return cell.v ?? '';
  const key = file.data.sheets.indexOf(s) + ':' + K(r, c);
  if (cache.has(key)) return cache.get(key);
  if (visiting.has(key)) return { __err: ERR.CYCLE };
  visiting.add(key);
  let out;
  try {
    out = evalFormula(cell.f, resolverFor(s));
  } catch (e) { out = isError(e) ? e : { __err: ERR.VALUE }; }
  visiting.delete(key);
  cache.set(key, out);
  return out;
}
function resolverFor(s) {
  const byName = n => file.data.sheets.find(x => x.name === n) || null;
  return {
    cell: (sn, r, c) => { const t = sn ? byName(sn) : s; if (!t) return ''; const v = displayValue(r, c, t); return isError(v) ? (() => { throw v; })() : (v === '' ? '' : v); },
    range: (sn, r1, c1, r2, c2) => { const t = sn ? byName(sn) : s; if (!t) return []; const out = []; for (let r = r1; r <= r2; r++) { const row = []; for (let c = c1; c <= c2; c++) { const v = displayValue(r, c, t); if (isError(v)) throw v; row.push(v === '' ? '' : v); } out.push(row); } return out; }
  };
}
function recalc() { cache = new Map(); visiting = new Set(); }

/* تنسيقات الأرقام */
export function fmtCell(v, fmt) {
  if (v == null || v === '') return '';
  if (isError(v)) return v.__err;
  if (typeof v === 'boolean') return v ? 'صواب' : 'خطأ';
  if (fmt === 'text' || typeof v !== 'number') return String(v);
  if (fmt === 'int') return Math.round(v).toLocaleString('en-US');
  if (fmt === 'number') return (+v.toFixed(2)).toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (fmt === 'percent') return (+((v * 100).toFixed(2))) + '٪';
  if (fmt === 'currency') return (+v.toFixed(2)).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ج.م';
  if (fmt === 'date') { const d = new Date(Math.round((v - 25569) * 86400000)); return isNaN(d) ? String(v) : d.toISOString().slice(0,10); }
  return String(+v.toFixed(10));
}

/* ---------- قياسات الشبكة ---------- */
const DEF_CW = 110, DEF_RH = 26, HEAD_W = 46, HEAD_H = 26;
const colW = (s, c) => s.colW[c] || DEF_CW;
const rowH = (s, r) => s.rowH[r] || DEF_RH;
function gridGeom(sh) {
  const s = sh || sheet(); const { rows, cols } = usedBounds(s);
  const xs = [0]; for (let c = 1; c <= cols; c++) xs.push(xs[c - 1] + colW(s, c));
  const ys = [0]; for (let r = 1; r <= rows; r++) ys.push(ys[r - 1] + rowH(s, r));
  return { rows, cols, xs, ys, W: xs[cols], H: ys[rows] };
}
/* اتجاه الأعمدة: في RTL يبدأ العمود A من يمين الشاشة */
function colX(geom, s, c, vpW) { const x = geom.xs[c - 1]; return s.rtl ? vpW - HEAD_W - x - colW(s, c) : x; }

/* ---------- الرسم ---------- */
let sel = { r1: 1, c1: 1, r2: 1, c2: 1 }, anchor = { r: 1, c: 1 };
let scrollX = 0, scrollY = 0;
function render() {
  const s = sheet(); const geom = gridGeom(s);
  const vpW = host.clientWidth - 0, vpH = host.clientHeight - 0;
  const dpr = devicePixelRatio || 1;
  canvas.width = vpW * dpr; canvas.height = vpH * dpr;
  canvas.style.width = vpW + 'px'; canvas.style.height = vpH + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const CW = vpW, CH = vpH;
  ctx.fillStyle = '#090b07'; ctx.fillRect(0, 0, CW, CH);
  const f = s.freeze || { r: 0, c: 0 };
  ctx.save(); ctx.translate(HEAD_W - scrollX, HEAD_H - scrollY);
  /* خلايا */
  for (const k of Object.keys(s.cells)) {
    const [r, c] = k.split(',').map(Number);
    if (r <= f.r || c <= f.c) continue;
    drawCell(s, geom, r, c, CW, CH);
  }
  /* خطوط الشبكة */
  ctx.strokeStyle = '#232a1c'; ctx.lineWidth = 1; ctx.beginPath();
  for (let c = f.c + 1; c <= geom.cols; c++) { const x = colX(geom, s, c, CW); ctx.moveTo(x, scrollY); ctx.lineTo(x, Math.min(geom.H, scrollY + CH)); }
  for (let r = f.r + 1; r <= geom.rows; r++) { const y = geom.ys[r - 1]; ctx.moveTo(scrollX, y); ctx.lineTo(Math.min(geom.W, scrollX + CW), y); }
  ctx.stroke();
  ctx.restore();
  /* خلايا مجمدة */
  if (f.r || f.c) {
    ctx.save(); ctx.beginPath(); ctx.rect(HEAD_W, HEAD_H, CW - HEAD_W, f.r ? geom.ys[f.r] : 0); ctx.clip(); ctx.translate(HEAD_W - scrollX, HEAD_H);
    for (let r = 1; r <= f.r; r++) for (const k of Object.keys(s.cells)) { const [rr, cc] = k.split(',').map(Number); if (rr === r && cc > f.c) drawCell(s, geom, rr, cc, CW, CH, 0); }
    ctx.restore();
  }
  /* التحديد */
  const sx1 = Math.min(...[sel.c1, sel.c2].map(c => colX(geom, s, c, CW))), sx2 = Math.max(...[sel.c1, sel.c2].map(c => colX(geom, s, c, CW) + colW(s, Math.max(sel.c1, sel.c2) === Math.min(sel.c1, sel.c2) ? sel.c1 : sel.c2, 0)));
  const xA = colX(geom, s, Math.min(sel.c1, sel.c2), CW), wA = rangeW(geom, s, sel, CW);
  const yA = geom.ys[Math.min(sel.r1, sel.r2) - 1], hA = rangeH(geom, s, sel);
  ctx.save(); ctx.translate(HEAD_W - scrollX, HEAD_H - scrollY);
  ctx.fillStyle = '#b5e85318'; ctx.fillRect(xA, yA, wA, hA);
  ctx.strokeStyle = '#b5e853'; ctx.lineWidth = 2; ctx.strokeRect(xA, yA, wA, hA);
  ctx.fillStyle = '#b5e853'; ctx.fillRect(xA + wA - 4, yA + hA - 4, 8, 8);
  ctx.restore();
  /* الترويسات */
  ctx.fillStyle = '#0e120a'; ctx.fillRect(0, 0, CW, HEAD_H); ctx.fillRect(0, 0, HEAD_W, CH);
  ctx.strokeStyle = '#303a26'; ctx.beginPath(); ctx.moveTo(0, HEAD_H + .5); ctx.lineTo(CW, HEAD_H + .5); ctx.moveTo(HEAD_W + .5, 0); ctx.lineTo(HEAD_W + .5, CH); ctx.stroke();
  ctx.font = '11px Cairo'; ctx.fillStyle = '#8d9882'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let c = 1; c <= geom.cols; c++) { const x = HEAD_W - scrollX + colX(geom, s, c, CW) + colW(s, c) / 2; if (x < HEAD_W - 60 || x > CW + 60) continue; ctx.fillStyle = (c >= Math.min(sel.c1, sel.c2) && c <= Math.max(sel.c1, sel.c2)) ? '#b5e853' : '#8d9882'; ctx.fillText(numToCol(c), x, HEAD_H / 2); }
  ctx.textAlign = 'center';
  for (let r = 1; r <= geom.rows; r++) { const y = HEAD_H - scrollY + geom.ys[r - 1] + rowH(s, r) / 2; if (y < HEAD_H - 20 || y > CH + 20) continue; ctx.fillStyle = (r >= Math.min(sel.r1, sel.r2) && r <= Math.max(sel.r1, sel.r2)) ? '#b5e853' : '#8d9882'; ctx.fillText(String(r), HEAD_W / 2, y); }
  $('#cellref').textContent = (sel.r1 === sel.r2 && sel.c1 === sel.c2) ? numToCol(sel.c1) + sel.r1 : `${numToCol(Math.min(sel.c1, sel.c2))}${Math.min(sel.r1, sel.r2)}:${numToCol(Math.max(sel.c1, sel.c2))}${Math.max(sel.r1, sel.r2)}`;
}
function rangeW(geom, s, sl, vpW) { let w = 0; for (let c = Math.min(sl.c1, sl.c2); c <= Math.max(sl.c1, sl.c2); c++) w += colW(s, c); return w; }
function rangeH(geom, s, sl) { let h = 0; for (let r = Math.min(sl.r1, sl.r2); r <= Math.max(sl.r1, sl.r2); r++) h += rowH(s, r); return h; }
function drawCell(s, geom, r, c, CW, CH, dyOff) {
  const cell = s.cells[K(r, c)]; if (!cell) return;
  const x = colX(geom, s, c, CW), y = geom.ys[r - 1] + (dyOff || 0);
  if (x + colW(s, c) < scrollX || x > scrollX + CW || y + rowH(s, r) < scrollY || y > scrollY + CH) return;
  const st = cell.s || {};
  if (st.fill) { ctx.fillStyle = st.fill; ctx.fillRect(x, y, colW(s, c), rowH(s, r)); }
  const v = fmtCell(displayValue(r, c, s), st.fmt);
  if (v === '') return;
  ctx.save();
  ctx.beginPath(); ctx.rect(x + 1, y + 1, colW(s, c) - 2, rowH(s, r) - 2); ctx.clip();
  const size = st.size || 12.5;
  ctx.font = `${st.i ? 'italic ' : ''}${st.b ? '700 ' : ''}${size}px ${st.font ? "'" + st.font + "'," : ''}Cairo,sans-serif`;
  ctx.fillStyle = isError(displayValue(r, c, s)) ? '#f3aaa1' : (st.color || '#dfe5d6');
  const numeric = typeof displayValue(r, c, s) === 'number' && !st.align;
  ctx.textAlign = st.align === 'center' ? 'center' : (st.align === 'left' || (!s.rtl && numeric) ? 'left' : (st.align === 'right' || (s.rtl && numeric)) ? 'right' : (s.rtl ? 'right' : 'left'));
  const tx = ctx.textAlign === 'center' ? x + colW(s, c) / 2 : (ctx.textAlign === 'right' ? x + colW(s, c) - 6 : x + 6);
  ctx.textBaseline = 'middle';
  ctx.fillText(v, tx, y + rowH(s, r) / 2);
  ctx.restore();
}

/* ---------- تمرير وتفاعل ---------- */
const spacer = document.createElement('div');
const cellEdit = $('#cell-edit');
host.style.direction = 'ltr';
spacer.style.cssText = 'position:relative';
canvas.style.cssText = 'position:sticky;top:0;left:0;display:block';
host.innerHTML = ''; host.appendChild(spacer); spacer.appendChild(canvas); host.appendChild(cellEdit);
function syncSpacer() { const s = sheet(); const g = gridGeom(s); spacer.style.width = (g.W + HEAD_W + 40) + 'px'; spacer.style.height = (g.H + HEAD_H + 40) + 'px'; }
host.addEventListener('scroll', () => { scrollX = host.scrollLeft; scrollY = host.scrollTop; render(); });

function posFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const px = e.clientX - rect.left, py = e.clientY - rect.top;
  const s = sheet(); const g = gridGeom(s);
  const cx = px + scrollX - HEAD_W, cy = py + scrollY - HEAD_H;
  if (py <= HEAD_H && px > HEAD_W) { /* رأس عمود */
    for (let c = 1; c <= g.cols; c++) { const x = colX(g, s, c, canvas.clientWidth); if (cx >= x && cx < x + colW(s, c)) return { head: 'col', c, edge: cx - x > colW(s, c) - 4 }; }
    return { head: 'col', c: g.cols };
  }
  if (px <= HEAD_W && py > HEAD_H) { for (let r = 1; r <= g.rows; r++) { const y = g.ys[r - 1]; if (cy >= y && cy < y + rowH(s, r)) return { head: 'row', r, edge: cy - y > rowH(s, r) - 4 }; } return { head: 'row', r: g.rows }; }
  if (px <= HEAD_W && py <= HEAD_H) return { head: 'corner' };
  for (let c = 1; c <= g.cols; c++) { const x = colX(g, s, c, canvas.clientWidth); if (cx >= x && cx < x + colW(s, c)) { for (let r = 1; r <= g.rows; r++) { const y = g.ys[r - 1]; if (cy >= y && cy < y + rowH(s, r)) return { r, c }; } return { r: g.rows, c }; } }
  return { r: g.rows, c: g.cols };
}
let dragging = null;
canvas.addEventListener('mousedown', e => {
  const p = posFromEvent(e); commitEdit();
  if (p.head === 'col' && p.edge) { dragging = { type: 'colw', c: p.c }; return; }
  if (p.head === 'row' && p.edge) { dragging = { type: 'rowh', r: p.r }; return; }
  if (p.head === 'col') { sel = { r1: 1, c1: p.c, r2: usedBounds().rows, c2: p.c }; anchor = { r: 1, c: p.c }; dragging = { type: 'sel' }; render(); return; }
  if (p.head === 'row') { sel = { r1: p.r, c1: 1, r2: p.r, c2: usedBounds().cols }; anchor = { r: p.r, c: 1 }; dragging = { type: 'sel' }; render(); return; }
  if (p.head === 'corner') { const g = gridGeom(); sel = { r1: 1, c1: 1, r2: g.rows, c2: g.cols }; render(); return; }
  /* مقبض التعبئة */
  const s = sheet(); const g = gridGeom(s); const vpW = canvas.clientWidth;
  const fx = colX(g, s, Math.max(sel.c1, sel.c2), vpW) + colW(s, Math.max(sel.c1, sel.c2));
  const fy = g.ys[Math.max(sel.r1, sel.r2)];
  const mx = e.clientX - canvas.getBoundingClientRect().left + scrollX - HEAD_W, my = e.clientY - canvas.getBoundingClientRect().top + scrollY - HEAD_H;
  if (Math.abs(mx - fx) < 8 && Math.abs(my - fy) < 8) { dragging = { type: 'fill', from: { ...sel } }; return; }
  if (e.shiftKey) { sel = { ...sel, r2: p.r, c2: p.c }; }
  else { sel = { r1: p.r, c1: p.c, r2: p.r, c2: p.c }; anchor = { r: p.r, c: p.c }; }
  dragging = { type: 'sel' };
  render(); syncFormulaBar();
});
addEventListener('mousemove', e => {
  if (!dragging) return;
  if (dragging.type === 'colw') { const rect = canvas.getBoundingClientRect(); const cx = e.clientX - rect.left + scrollX - HEAD_W; const s = sheet(); const g = gridGeom(s); const x = colX(g, s, dragging.c, canvas.clientWidth); s.colW[dragging.c] = Math.max(40, Math.min(500, cx - x)); syncSpacer(); render(); return; }
  if (dragging.type === 'rowh') { const rect = canvas.getBoundingClientRect(); const cy = e.clientY - rect.top + scrollY - HEAD_H; const s = sheet(); const g = gridGeom(s); const y = g.ys[dragging.r - 1]; s.rowH[dragging.r] = Math.max(20, Math.min(200, cy - y)); syncSpacer(); render(); return; }
  const p = posFromEvent(e); if (p.head) return;
  if (dragging.type === 'sel') { sel = { r1: anchor.r, c1: anchor.c, r2: p.r, c2: p.c }; render(); }
  if (dragging.type === 'fill') { sel = { r1: Math.min(dragging.from.r1, p.r), c1: Math.min(dragging.from.c1, p.c), r2: Math.max(dragging.from.r2, p.r), c2: Math.max(dragging.from.c2, p.c) }; render(); }
});
addEventListener('mouseup', e => {
  if (!dragging) return;
  if (dragging.type === 'fill') applyFill(dragging.from, sel);
  if (dragging.type === 'colw' || dragging.type === 'rowh') markDirty();
  dragging = null; render(); syncFormulaBar();
});
function applyFill(from, to) {
  pushUndo();
  const s = sheet();
  for (let r = Math.min(to.r1, to.r2); r <= Math.max(to.r1, to.r2); r++) for (let c = Math.min(to.c1, to.c2); c <= Math.max(to.c1, to.c2); c++) {
    if (r >= Math.min(from.r1, from.r2) && r <= Math.max(from.r1, from.r2) && c >= Math.min(from.c1, from.c2) && c <= Math.max(from.c1, from.c2)) continue;
    const sr = Math.min(from.r1, from.r2) + ((r - Math.min(from.r1, from.r2)) % (Math.abs(from.r2 - from.r1) + 1) + Math.abs(from.r2 - from.r1) + 1) % (Math.abs(from.r2 - from.r1) + 1);
    const sc = Math.min(from.c1, from.c2) + ((c - Math.min(from.c1, from.c2)) % (Math.abs(from.c2 - from.c1) + 1) + Math.abs(from.c2 - from.c1) + 1) % (Math.abs(from.c2 - from.c1) + 1);
    const src = getCell(sr, sc);
    if (!src) continue;
    const patch = { v: src.v, s: src.s ? { ...src.s } : undefined };
    if (src.f) patch.f = shiftFormula(src.f, r - sr, c - sc);
    setCell(r, c, patch);
  }
  recalc(); markDirty();
}
/* إزاحة مراجع الصيغ النسبية عند التعبئة/اللصق */
export function shiftFormula(f, dr, dc) {
  return f.replace(/(\$?)([A-Za-z]{1,3})(\$?)([0-9]{1,7})/g, (m, dc1, col, dr1, row) => {
    if (!/^[A-Za-z]{1,3}$/.test(col) || colToNum(col) > 200) return m;
    const c = dc1 === '$' ? colToNum(col) : Math.max(1, colToNum(col) + dc);
    const r = dr1 === '$' ? +row : Math.max(1, +row + dr);
    return dc1 + numToCol(c) + dr1 + r;
  });
}

/* ---------- تحرير الخلايا ---------- */
function beginEdit(initial) {
  const s = sheet(); const g = gridGeom(s); const vpW = canvas.clientWidth;
  const x = colX(g, s, sel.c1, vpW) - scrollX + HEAD_W, y = g.ys[sel.r1 - 1] - scrollY + HEAD_H;
  const cell = getCell(sel.r1, sel.c1);
  cellEdit.style.display = 'block';
  cellEdit.style.left = x + 'px'; cellEdit.style.top = y + 'px';
  cellEdit.style.width = Math.max(colW(s, sel.c1) - 2, 60) + 'px'; cellEdit.style.height = rowH(s, sel.r1) - 2 + 'px';
  cellEdit.value = initial !== undefined ? initial : (cell ? (cell.f ? '=' + cell.f : (cell.v ?? '')) : '');
  setTimeout(() => { cellEdit.focus(); cellEdit.setSelectionRange(cellEdit.value.length, cellEdit.value.length); }, 0);
  $('#fx-cancel').style.display = ''; $('#fx-ok').style.display = '';
}
function commitEdit() {
  if (cellEdit.style.display !== 'block') return;
  const raw = cellEdit.value;
  cellEdit.style.display = 'none';
  $('#fx-cancel').style.display = 'none'; $('#fx-ok').style.display = 'none';
  pushUndo();
  if (raw === '') setCell(sel.r1, sel.c1, { v: null, f: null });
  else if (raw.startsWith('=')) setCell(sel.r1, sel.c1, { v: null, f: raw.slice(1) });
  else if (raw !== '' && !isNaN(Number(raw)) && raw.trim() !== '') setCell(sel.r1, sel.c1, { v: Number(raw), f: null });
  else setCell(sel.r1, sel.c1, { v: raw, f: null });
  recalc(); markDirty(); render(); syncFormulaBar();
}
$('#fx-ok').addEventListener('click', commitEdit);
$('#fx-cancel').addEventListener('click', () => { cellEdit.style.display = 'none'; $('#fx-cancel').style.display = 'none'; $('#fx-ok').style.display = 'none'; });
cellEdit.addEventListener('keydown', e => {
  if (e.key === 'Enter') { commitEdit(); moveSel(e.shiftKey ? -1 : 1, 0); e.preventDefault(); }
  if (e.key === 'Escape') { cellEdit.style.display = 'none'; e.preventDefault(); }
  if (e.key === 'Tab') { commitEdit(); moveSel(0, e.shiftKey ? -1 : 1); e.preventDefault(); }
});
canvas.addEventListener('dblclick', () => beginEdit());
$('#formula-input').addEventListener('focus', () => { syncFormulaBar(); });
$('#formula-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') { const v = e.target.value; pushUndo();
    if (v.startsWith('=')) setCell(sel.r1, sel.c1, { v: null, f: v.slice(1) });
    else if (v !== '' && !isNaN(Number(v))) setCell(sel.r1, sel.c1, { v: Number(v), f: null });
    else setCell(sel.r1, sel.c1, { v: v, f: null });
    recalc(); markDirty(); render(); moveSel(1, 0); e.preventDefault(); }
});
function syncFormulaBar() {
 const cell = getCell(sel.r1, sel.c1); const raw=cell ? (cell.f ? '=' + cell.f : (cell.v ?? '')) : '';
 $('#formula-input').value=raw;
 const label=$('#cell-detail-label'),value=$('#cell-detail-value');
 if(label)label.textContent=numToCol(sel.c1)+sel.r1+' - القيمة الكاملة';
 if(value)value.textContent=String(displayValue(sel.r1,sel.c1)??'');
}
// A text view makes canvas cells inspectable and keyboard/mobile accessible without truncation.
const detail=document.createElement('details');detail.className='osh-cell-detail';
const label=document.createElement('summary');label.id='cell-detail-label';label.textContent='القيمة الكاملة للخلية المحددة';
const value=document.createElement('pre');value.id='cell-detail-value';value.tabIndex=0;
const fit=document.createElement('button');fit.type='button';fit.className='osh-btn';fit.id='cell-autofit';fit.textContent='وسّع العمود حسب المحتوى';
detail.append(label,value,fit);host.before(detail);
fit.onclick=()=>{pushUndo();const sh=sheet();let w=100;ctx.save();ctx.font='13px Cairo,sans-serif';for(const key of Object.keys(sh.cells)){const[r,c]=key.split(',').map(Number);if(c===sel.c1)w=Math.max(w,ctx.measureText(String(displayValue(r,c,sh)??'')).width+24)}ctx.restore();sh.colW[sel.c1]=Math.min(600,w);syncSpacer();render();markDirty()};

function moveSel(dr, dc) {
  const g = gridGeom();
  sel.r1 = sel.r2 = Math.min(Math.max(1, sel.r1 + dr), g.rows);
  sel.c1 = sel.c2 = Math.min(Math.max(1, sel.c1 + dc), g.cols);
  anchor = { r: sel.r1, c: sel.c1 };
  ensureVisible(); render(); syncFormulaBar();
}
function ensureVisible() {
  const s = sheet(); const g = gridGeom(s); const vpW = canvas.clientWidth, vpH = canvas.clientHeight;
  const x = colX(g, s, sel.c1, vpW), y = g.ys[sel.r1 - 1];
  if (x - scrollX < 0) host.scrollLeft = Math.max(0, x - 10);
  if (x + colW(s, sel.c1) - scrollX > vpW - HEAD_W) host.scrollLeft = x + colW(s, sel.c1) - vpW + HEAD_W + 10;
  if (y - scrollY < 0) host.scrollTop = Math.max(0, y - 10);
  if (y + rowH(s, sel.r1) - scrollY > vpH - HEAD_H) host.scrollTop = y + rowH(s, sel.r1) - vpH + HEAD_H + 10;
}
document.addEventListener('keydown', e => {
  if (e.target === cellEdit || e.target.id === 'formula-input' || e.target.closest('.osh-modal') || e.target.id === 'doc-name') return;
  if (e.ctrlKey || e.metaKey) {
    const k = e.key.toLowerCase();
    if (k === 'z') { e.preventDefault(); undo(); return; }
    if (k === 'y') { e.preventDefault(); redo(); return; }
    if (k === 'b' || k === 'i' || k === 'u') { e.preventDefault(); toggleStyle(k === 'b' ? 'b' : k === 'i' ? 'i' : 'u'); return; }
    if (k === 'c') { e.preventDefault(); copySel(false); return; }
    if (k === 'x') { e.preventDefault(); copySel(true); return; }
    if (k === 'v') { e.preventDefault(); pasteClip(); return; }
    if (k === 'a') { e.preventDefault(); const g = gridGeom(); sel = { r1: 1, c1: 1, r2: g.rows, c2: g.cols }; render(); return; }
    return;
  }
  if (e.key === 'ArrowUp') { moveSel(-1, 0); e.preventDefault(); }
  else if (e.key === 'ArrowDown') { moveSel(1, 0); e.preventDefault(); }
  else if (e.key === 'ArrowLeft') { moveSel(0, sheet().rtl ? 1 : -1); e.preventDefault(); }
  else if (e.key === 'ArrowRight') { moveSel(0, sheet().rtl ? -1 : 1); e.preventDefault(); }
  else if (e.key === 'Enter') { moveSel(e.shiftKey ? -1 : 1, 0); e.preventDefault(); }
  else if (e.key === 'Tab') { moveSel(0, e.shiftKey ? -1 : 1); e.preventDefault(); }
  else if (e.key === 'Delete' || e.key === 'Backspace') { pushUndo(); eachSelCell((r, c) => setCell(r, c, { v: null, f: null })); recalc(); markDirty(); render(); syncFormulaBar(); e.preventDefault(); }
  else if (e.key === 'F2') { beginEdit(); e.preventDefault(); }
  else if (e.key.length === 1 && !e.altKey) { beginEdit(e.key); e.preventDefault(); }
});
function eachSelCell(fn) { for (let r = Math.min(sel.r1, sel.r2); r <= Math.max(sel.r1, sel.r2); r++) for (let c = Math.min(sel.c1, sel.c2); c <= Math.max(sel.c1, sel.c2); c++) fn(r, c); }
/* حافظة TSV */
let cutMode = false;
function copySel(cut) {
  cutMode = cut;
  const rows = [];
  for (let r = Math.min(sel.r1, sel.r2); r <= Math.max(sel.r1, sel.r2); r++) {
    const row = [];
    for (let c = Math.min(sel.c1, sel.c2); c <= Math.max(sel.c1, sel.c2); c++) { const cell = getCell(r, c); row.push(cell ? (cell.f ? '=' + cell.f : (cell.v ?? '')) : ''); }
    rows.push(row.join('\t'));
  }
  navigator.clipboard.writeText(rows.join('\n')).catch(() => {});
  if (cut) { pushUndo(); eachSelCell((r, c) => setCell(r, c, { v: null, f: null })); recalc(); markDirty(); render(); }
  toast(cut ? 'قُصّ التحديد' : 'نُسخ التحديد');
}
async function pasteClip() {
  let t = ''; try { t = await navigator.clipboard.readText(); } catch { toast('امنح إذن الحافظة أو الصق داخل خلية'); return; }
  if (!t) return;
  pushUndo();
  const rows = t.replace(/\r/g, '').split('\n'); if (rows.length && rows[rows.length - 1] === '') rows.pop();
  rows.forEach((line, i) => line.split('\t').forEach((val, j) => {
    const r = sel.r1 + i, c = sel.c1 + j;
    if (val.startsWith('=')) setCell(r, c, { v: null, f: val.slice(1) });
    else if (val !== '' && !isNaN(Number(val))) setCell(r, c, { v: Number(val), f: null });
    else setCell(r, c, { v: val === '' ? null : val, f: null });
  }));
  recalc(); markDirty(); render(); syncSpacer();
}
/* تراجع/إعادة */
const undoStack = [], redoStack = [];
function pushUndo() { undoStack.push(JSON.stringify(file.data)); if (undoStack.length > 60) undoStack.shift(); redoStack.length = 0; }
function undo() { if (!undoStack.length) return; redoStack.push(JSON.stringify(file.data)); file.data = JSON.parse(undoStack.pop()); recalc(); render(); syncSpacer(); markDirty(); }
function redo() { if (!redoStack.length) return; undoStack.push(JSON.stringify(file.data)); file.data = JSON.parse(redoStack.pop()); recalc(); render(); syncSpacer(); markDirty(); }
/* تنسيق التحديد */
function toggleStyle(prop, val) {
  pushUndo();
  eachSelCell((r, c) => { const cell = getCell(r, c) || {}; const s = { ...(cell.s || {}) }; if (prop === 'b' || prop === 'i' || prop === 'u') { if (s[prop]) delete s[prop]; else s[prop] = true; } else if (val === undefined) delete s[prop]; else s[prop] = val; setCell(r, c, { s: Object.keys(s).length ? s : undefined }); });
  markDirty(); render();
}

/* ---------- شريط الأدوات ---------- */
function buildToolbar() {
  const tb = $('#toolbar');
  tb.innerHTML = `
  <button class="osh-tbtn" id="t-undo" title="تراجع">↶</button><button class="osh-tbtn" id="t-redo" title="إعادة">↷</button><span class="sep"></span>
  <button class="osh-tbtn" id="t-bold" title="غامق"><b>غ</b></button><button class="osh-tbtn" id="t-italic" title="مائل"><i>م</i></button><button class="osh-tbtn" id="t-under" title="تسطير"><u>س</u></button>
  <input type="color" id="t-color" value="#dfe5d6" title="لون النص"><input type="color" id="t-fill" value="#2c3b1b" title="لون التعبئة">
  <select id="t-size" title="حجم الخط">${[10,11,12,13,14,16,18].map(s => `<option${s===13?' selected':''}>${s}</option>`).join('')}</select>
  <span class="sep"></span>
  <button class="osh-tbtn" id="t-al-r" title="يمين">⇥</button><button class="osh-tbtn" id="t-al-c" title="وسط">≡</button><button class="osh-tbtn" id="t-al-l" title="يسار">⇤</button>
  <span class="sep"></span>
  <select id="t-fmt" title="تنسيق الرقم"><option value="">تلقائي</option><option value="text">نص</option><option value="number">رقم (كسران)</option><option value="int">رقم صحيح</option><option value="percent">نسبة مئوية</option><option value="currency">عملة (ج.م)</option><option value="date">تاريخ إكسل</option></select>
  <span class="sep"></span>
  <button class="osh-tbtn" id="t-rtl" title="اتجاه الورقة RTL/LTR">اتجاه</button>
  <button class="osh-tbtn" id="t-freeze" title="تجميد الصف الأول والعمود الأول">تجميد</button>
  <span class="sep"></span>
  <div class="osh-drop"><button class="osh-tbtn" id="t-insert">إدراج ▾</button><div class="osh-menu" id="m-insert"><button data-ins="row-up">صف فوق</button><button data-ins="row-down">صف تحت</button><button data-ins="col-right">عمود قبل</button><button data-ins="col-left">عمود بعد</button></div></div>
  <div class="osh-drop"><button class="osh-tbtn" id="t-del">حذف ▾</button><div class="osh-menu" id="m-del"><button data-del="row">الصف المحدد</button><button data-del="col">العمود المحدد</button><button data-del="cells">محتوى التحديد</button></div></div>
  <div class="osh-drop"><button class="osh-tbtn" id="t-sort">فرز ▾</button><div class="osh-menu" id="m-sort"><button data-sort="asc">تصاعدي حسب العمود الحالي</button><button data-sort="desc">تنازلي حسب العمود الحالي</button></div></div>
  <button class="osh-tbtn" id="t-chart" title="رسم بياني من التحديد">📊</button>
  <button class="osh-tbtn" id="t-fn" title="معالج الدوال">fx الدوال</button>`;
  const wire = (id, fn) => $(id).addEventListener('click', fn);
  wire('#t-undo', undo); wire('#t-redo', redo);
  wire('#t-bold', () => toggleStyle('b')); wire('#t-italic', () => toggleStyle('i')); wire('#t-under', () => toggleStyle('u'));
  $('#t-color').addEventListener('input', e => toggleStyle('color', e.target.value));
  $('#t-fill').addEventListener('input', e => toggleStyle('fill', e.target.value));
  $('#t-size').addEventListener('change', e => toggleStyle('size', +e.target.value));
  $('#t-fmt').addEventListener('change', e => toggleStyle('fmt', e.target.value || undefined));
  wire('#t-al-r', () => toggleStyle('align', 'right')); wire('#t-al-c', () => toggleStyle('align', 'center')); wire('#t-al-l', () => toggleStyle('align', 'left'));
  wire('#t-rtl', () => { pushUndo(); sheet().rtl = !sheet().rtl; markDirty(); render(); });
  wire('#t-freeze', () => { pushUndo(); const s = sheet(); s.freeze = s.freeze && s.freeze.r ? { r: 0, c: 0 } : { r: 1, c: 1 }; markDirty(); render(); });
  wire('#t-chart', chartFromSelection);
  wire('#t-fn', openFnWizard);
  $('#fx-fn').addEventListener('click', openFnWizard);
  for (const [btn, menu] of [['#t-insert', '#m-insert'], ['#t-del', '#m-del'], ['#t-sort', '#m-sort']]) {
    $(btn).addEventListener('click', e => { e.stopPropagation(); document.querySelectorAll('.osh-menu').forEach(m => m.classList.remove('open')); $(menu).classList.toggle('open'); });
    document.addEventListener('click', () => $(menu).classList.remove('open'));
  }
  $('#m-insert').addEventListener('click', e => { const a = e.target.dataset.ins; if (!a) return; pushUndo();
    if (a === 'row-up') shiftRows(sel.r1, 1); if (a === 'row-down') shiftRows(sel.r2 + 1, 1);
    if (a === 'col-right') shiftCols(sel.c1, 1); if (a === 'col-left') shiftCols(sel.c2 + 1, 1);
    recalc(); markDirty(); render(); syncSpacer(); });
  $('#m-del').addEventListener('click', e => { const a = e.target.dataset.del; if (!a) return; pushUndo();
    if (a === 'row') { for (let r = Math.min(sel.r1, sel.r2); r <= Math.max(sel.r1, sel.r2); r++) shiftRows(r, -1); }
    if (a === 'col') { for (let c = Math.min(sel.c1, sel.c2); c <= Math.max(sel.c1, sel.c2); c++) shiftCols(c, -1); }
    if (a === 'cells') eachSelCell((r, c) => setCell(r, c, { v: null, f: null }));
    recalc(); markDirty(); render(); });
  $('#m-sort').addEventListener('click', e => { const a = e.target.dataset.sort; if (!a) return; sortByCol(sel.c1, a === 'asc'); });
}
function shiftRows(at, delta) {
  const s = sheet(); const cells = {};
  for (const k of Object.keys(s.cells)) { const [r, c] = k.split(',').map(Number); if (r >= at) { if (delta > 0 || r > at - delta - 1) cells[K(r + delta, c)] = s.cells[k]; } else cells[k] = s.cells[k]; }
  s.cells = cells;
}
function shiftCols(at, delta) {
  const s = sheet(); const cells = {};
  for (const k of Object.keys(s.cells)) { const [r, c] = k.split(',').map(Number); if (c >= at) { if (delta > 0 || c > at - delta - 1) cells[K(r, c + delta)] = s.cells[k]; } else cells[k] = s.cells[k]; }
  s.cells = cells;
}
function sortByCol(c, asc) {
  pushUndo();
  const s = sheet(); const r1 = Math.min(sel.r1, sel.r2), r2 = Math.max(sel.r1, sel.r2);
  const rows = [];
  for (let r = r1; r <= r2; r++) rows.push(r);
  rows.sort((a, b) => { const va = displayValue(a, c), vb = displayValue(b, c); const na = typeof va === 'number', nb = typeof vb === 'number'; let cmp; if (na && nb) cmp = va - vb; else cmp = String(va).localeCompare(String(vb), 'ar'); return asc ? cmp : -cmp; });
  const copy = {}; for (const r of rows) for (const k of Object.keys(s.cells)) { const [rr, cc] = k.split(',').map(Number); if (rr === r) copy[K(r, cc)] = s.cells[k]; }
  rows.forEach((srcR, i) => { const dstR = r1 + i; for (const k of Object.keys(s.cells)) { const [rr, cc] = k.split(',').map(Number); if (rr === srcR) setCell(dstR, cc, JSON.parse(JSON.stringify(s.cells[k])), s); } });
  recalc(); markDirty(); render();
}

/* ---------- تبويبات الأوراق ---------- */
function renderTabs() {
  const host = $('#sheet-tabs'); host.innerHTML = '';
  file.data.sheets.forEach((s, i) => {
    const b = document.createElement('button'); b.className = 'stab' + (i === file.data.active ? ' on' : ''); b.textContent = s.name;
    b.addEventListener('click', () => { file.data.active = i; recalc(); render(); renderTabs(); syncSpacer(); syncFormulaBar(); markDirty(); });
    b.addEventListener('dblclick', () => { const n = prompt('اسم الورقة:', s.name); if (n && n.trim()) { s.name = n.trim(); markDirty(); renderTabs(); } });
    host.appendChild(b);
  });
  const add = document.createElement('button'); add.className = 'stab'; add.textContent = '+ ورقة';
  add.addEventListener('click', () => { pushUndo(); file.data.sheets.push({ name: 'ورقة' + (file.data.sheets.length + 1), cells: {}, merges: [], colW: {}, rowH: {}, rtl: true, freeze: { r: 0, c: 0 } }); file.data.active = file.data.sheets.length - 1; recalc(); render(); renderTabs(); syncSpacer(); markDirty(); });
  host.appendChild(add);
  if (file.data.sheets.length > 1) {
    const del = document.createElement('button'); del.className = 'stab'; del.textContent = 'احذف الورقة';
    del.addEventListener('click', () => { if (!confirm(`احذف ورقة «${sheet().name}» ومحتواها؟`)) return; pushUndo(); file.data.sheets.splice(file.data.active, 1); file.data.active = 0; recalc(); render(); renderTabs(); syncSpacer(); markDirty(); });
    host.appendChild(del);
  }
}

/* ---------- معالج الدوال ---------- */
const FN_CATALOG = [
  ['SUM', 'جمع قيم نطاق', '=SUM(A1:A10)'], ['AVERAGE', 'متوسط القيم', '=AVERAGE(A1:A10)'], ['COUNT', 'عدّ الخلايا الرقمية', '=COUNT(A1:A10)'], ['COUNTA', 'عدّ الخلايا غير الفارغة', '=COUNTA(A1:A10)'],
  ['MAX', 'أكبر قيمة', '=MAX(A1:A10)'], ['MIN', 'أصغر قيمة', '=MIN(A1:A10)'], ['IF', 'شرط: قيمة عند التحقق وأخرى عند عدمه', '=IF(A1>10,"كبير","صغير")'], ['IFS', 'شروط متعددة', '=IFS(A1>90,"ممتاز",A1>50,"مقبول")'],
  ['AND', 'كل الشروط صحيحة', '=AND(A1>0,B1>0)'], ['OR', 'أي شرط صحيح', '=OR(A1>0,B1>0)'], ['NOT', 'نفي', '=NOT(A1>0)'], ['IFERROR', 'قيمة بديلة عند الخطأ', '=IFERROR(A1/B1,"—")'],
  ['VLOOKUP', 'بحث عمودي في جدول', '=VLOOKUP(A2,D1:F20,2,0)'], ['HLOOKUP', 'بحث أفقي', '=HLOOKUP(A2,A1:Z3,3,0)'], ['INDEX', 'قيمة بموقعها', '=INDEX(A1:C10,3,2)'], ['MATCH', 'موقع قيمة', '=MATCH("x",A1:A10,0)'], ['XLOOKUP', 'بحث حديث مرن', '=XLOOKUP(A2,D1:D20,F1:F20)'],
  ['SUMIF', 'جمع بشرط', '=SUMIF(B1:B10,">100")'], ['COUNTIF', 'عدّ بشرط', '=COUNTIF(B1:B10,"نعم")'], ['AVERAGEIF', 'متوسط بشرط', '=AVERAGEIF(B1:B10,">5")'], ['SUMIFS', 'جمع بشروط متعددة', '=SUMIFS(C1:C10,A1:A10,"صحافة")'], ['COUNTIFS', 'عدّ بشروط متعددة', '=COUNTIFS(A1:A10,"صحافة",B1:B10,">5")'],
  ['CONCAT', 'دمج نصوص', '=CONCAT(A1," ",B1)'], ['CONCATENATE', 'دمج نصوص (الكلاسيكي)', '=CONCATENATE(A1,B1)'], ['LEFT', 'أحرف من اليسار', '=LEFT(A1,5)'], ['RIGHT', 'أحرف من اليمين', '=RIGHT(A1,5)'], ['MID', 'أحرف من الوسط', '=MID(A1,2,4)'], ['LEN', 'طول النص', '=LEN(A1)'], ['TRIM', 'إزالة المسافات الزائدة', '=TRIM(A1)'], ['UPPER', 'أحرف كبيرة', '=UPPER(A1)'], ['LOWER', 'أحرف صغيرة', '=LOWER(A1)'], ['REPLACE', 'استبدال جزء', '=REPLACE(A1,1,3,"ج")'], ['SUBSTITUTE', 'استبدال نص بنص', '=SUBSTITUTE(A1,"قديم","جديد")'], ['TEXTJOIN', 'دمج بفاصل', '=TEXTJOIN("، ",1,A1:A10)'], ['FIND', 'موقع نص', '=FIND("ص",A1)'], ['TEXT', 'تنسيق رقم كنص', '=TEXT(A1,"0.00")'],
  ['ROUND', 'تقريب', '=ROUND(A1,2)'], ['ROUNDUP', 'تقريب لأعلى', '=ROUNDUP(A1,1)'], ['ROUNDDOWN', 'تقريب لأسفل', '=ROUNDDOWN(A1,1)'], ['ABS', 'القيمة المطلقة', '=ABS(A1)'], ['POWER', 'الأس', '=POWER(A1,2)'], ['SQRT', 'الجذر التربيعي', '=SQRT(A1)'], ['MOD', 'باقي القسمة', '=MOD(A1,3)'], ['RAND', 'عشوائي 0-1', '=RAND()'], ['RANDBETWEEN', 'عشوائي بين عددين', '=RANDBETWEEN(1,100)'],
  ['TODAY', 'تاريخ اليوم (رقم إكسل)', '=TODAY()'], ['NOW', 'التاريخ والوقت الآن', '=NOW()'], ['DATE', 'بناء تاريخ', '=DATE(2026,1,31)'], ['YEAR', 'السنة من تاريخ', '=YEAR(A1)'], ['MONTH', 'الشهر', '=MONTH(A1)'], ['DAY', 'اليوم', '=DAY(A1)'], ['DATEDIF', 'فرق بين تاريخين', '=DATEDIF(A1,B1,"d")'],
  ['MEDIAN', 'الوسيط', '=MEDIAN(A1:A10)'], ['STDEV', 'الانحراف المعياري', '=STDEV(A1:A10)'], ['VAR', 'التباين', '=VAR(A1:A10)'], ['PERCENTILE', 'المئين', '=PERCENTILE(A1:A10,0.9)'], ['RANK', 'ترتيب قيمة', '=RANK(A1,A1:A10)'], ['LARGE', 'ك‑أكبر قيمة', '=LARGE(A1:A10,2)'], ['SMALL', 'ك‑أصغر قيمة', '=SMALL(A1:A10,2)'],
  ['PMT', 'قسط قرض', '=PMT(0.05/12,36,100000)'], ['NPV', 'صافي القيمة الحالية', '=NPV(0.1,A1:A5)'], ['IRR', 'معدل العائد الداخلي', '=IRR(A1:A5)'],
  ['CHOOSE', 'اختيار برقم', '=CHOOSE(2,"أ","ب","ج")'], ['SWITCH', 'مطابقة قيمة', '=SWITCH(A1,"أ",1,"ب",2)'], ['ISNUMBER', 'هل رقم؟', '=ISNUMBER(A1)'], ['ISTEXT', 'هل نص؟', '=ISTEXT(A1)'], ['ISBLANK', 'هل فارغة؟', '=ISBLANK(A1)'],
];
function openFnWizard() {
  $('#fn-modal').classList.add('open');
  const list = $('#fn-list');
  const draw = q => {
    list.innerHTML = '';
    for (const [name, desc, ex] of FN_CATALOG.filter(x => !q || x[0].includes(q.toUpperCase()) || x[1].includes(q))) {
      const b = document.createElement('button'); b.className = 'osh-ai-action';
      b.innerHTML = `<strong style="color:var(--accent)">${name}</strong> — ${desc}<small dir="ltr">${esc(ex)}</small>`;
      b.addEventListener('click', () => { $('#fn-modal').classList.remove('open'); beginEdit(ex); });
      list.appendChild(b);
    }
  };
  draw(''); $('#fn-search').value = ''; $('#fn-search').oninput = e => draw(e.target.value.trim());
  $('#fn-close').onclick = () => $('#fn-modal').classList.remove('open');
}

/* ---------- رسم بياني من التحديد ---------- */
function chartFromSelection() {
  const rows = [];
  for (let r = Math.min(sel.r1, sel.r2); r <= Math.max(sel.r1, sel.r2); r++) {
    const label = displayValue(r, Math.min(sel.c1, sel.c2));
    const vals = [];
    for (let c = Math.min(sel.c1, sel.c2) + 1; c <= Math.max(sel.c1, sel.c2); c++) { const v = displayValue(r, c); if (typeof v === 'number') vals.push(v); }
    if (vals.length) rows.push({ label: String(label), v: vals[0] });
  }
  if (!rows.length) return toast('حدّد نطاقًا فيه عمود تسميات وعمود أرقام');
  const type = prompt('نوع الرسم: bar أعمدة / line خط / pie دائري', 'bar') || 'bar';
  const w = 720, h = 420, cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
  g.fillStyle = '#10140c'; g.fillRect(0, 0, w, h);
  const max = Math.max(...rows.map(r => Math.abs(r.v)), 1);
  g.font = '13px Cairo'; g.textAlign = 'center';
  if (type.startsWith('pie')) {
    const total = rows.reduce((s, r) => s + Math.abs(r.v), 0) || 1; let a0 = -Math.PI / 2;
    rows.forEach((r, i) => { const a1 = a0 + Math.PI * 2 * Math.abs(r.v) / total; g.fillStyle = ['#b5e853', '#7fb069', '#e3d2a4', '#5f8d4e', '#c7a456', '#8fb452'][i % 6]; g.beginPath(); g.moveTo(220, 200); g.arc(220, 200, 140, a0, a1); g.fill(); a0 = a1; g.fillStyle = '#dfe5d6'; g.fillText(r.label.slice(0, 14), 460, 60 + i * 26); g.textAlign = 'right'; });
  } else {
    const bw = Math.min(60, (w - 120) / rows.length - 12);
    rows.forEach((r, i) => {
      const x = 70 + i * ((w - 140) / rows.length);
      if (type.startsWith('line')) { g.strokeStyle = '#b5e853'; g.lineWidth = 2; const y = 350 - (Math.abs(r.v) / max) * 300; if (i) g.lineTo(x + bw / 2, y); else { g.beginPath(); g.moveTo(x + bw / 2, y); } g.stroke(); g.fillStyle = '#b5e853'; g.beginPath(); g.arc(x + bw / 2, y, 4, 0, 7); g.fill(); }
      else { const bh = (Math.abs(r.v) / max) * 300; g.fillStyle = '#b5e853'; g.fillRect(x, 350 - bh, bw, bh); }
      g.fillStyle = '#dfe5d6'; g.fillText(String(rows[i].label).slice(0, 10), x + bw / 2, 372); g.fillText(String(r.v), x + bw / 2, 340 - (type.startsWith('line') ? (Math.abs(r.v) / max) * 300 : (Math.abs(r.v) / max) * 300) - 8);
    });
    g.strokeStyle = '#3c482e'; g.beginPath(); g.moveTo(50, 350); g.lineTo(w - 40, 350); g.stroke();
  }
  cv.toBlob(b => download(file.name + '-chart.png', b));
  toast('نُزّل الرسم البياني كصورة PNG');
}

/* ---------- استيراد/تصدير xlsx وcsv ---------- */
async function importXlsx(fileObj) {
  const buf = await fileObj.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellFormula: true, cellNF:true, cellStyles:true });
  const sheets = wb.SheetNames.map(nm => {
    const ws = wb.Sheets[nm]; const cells = {};
    for (const addr of Object.keys(ws)) {
      if (addr.startsWith('!')) continue;
      const p = parseA1(addr); if (!p) continue;
      const c = ws[addr];
      const cell = {};
      if (c.f) cell.f = c.f;
      if (c.v !== undefined && c.v !== null && c.v !== '') cell.v = c.w !== undefined && c.t === 's' ? c.v : c.v;
      if(c.z){cell.xlsxNumberFormat=c.z;const supported={'0.00%':'percent','0%':'percent','0.00':'number','0':'int','yyyy-mm-dd':'date','@':'text'};if(supported[c.z])cell.s={fmt:supported[c.z]}}
      if (cell.f || cell.v !== undefined) cells[K(p.r, p.c)] = cell;
    }
    const colW={},rowH={};
    (ws['!cols']||[]).forEach((col,i)=>{if(col){const px=col.wpx??(col.wch!=null?col.wch*7+5:col.width!=null?col.width*7:undefined);if(Number.isFinite(px))colW[i+1]=Math.max(1,px)}});
    (ws['!rows']||[]).forEach((row,i)=>{if(row){const px=row.hpx??(row.hpt!=null?row.hpt*96/72:undefined);if(Number.isFinite(px))rowH[i+1]=Math.max(1,px)}});
    return { name:nm, cells, merges: [], colW,rowH, rtl:true, freeze:{r:0,c:0} };
  });
  if (sheets.length) { pushUndo(); file.data.sheets = sheets; file.data.active = 0; recalc(); render(); renderTabs(); syncSpacer(); markDirty(); toast('استُورد ملف Excel (' + sheets.length + ' ورقة)'); }
}
function importCsvText(text) {
  pushUndo();
  const rows = XLSX.read(text, { type: 'string', raw: true }).Sheets;
  const ws = rows[Object.keys(rows)[0]];
  const cells = {};
  for (const addr of Object.keys(ws)) { if (addr.startsWith('!')) continue; const p = parseA1(addr); if (!p) continue; const v = ws[addr].v; if (v !== undefined && v !== '') cells[K(p.r, p.c)] = { v }; }
  file.data.sheets[file.data.active].cells = cells;
  recalc(); render(); syncSpacer(); markDirty(); toast('استُورد CSV في الورقة الحالية');
}
function exportXlsx() {
  const wb = XLSX.utils.book_new();
  for (const s of file.data.sheets) {
    const ws = {};
    for (const k of Object.keys(s.cells)) {
      const [r, c] = k.split(',').map(Number); const cell = s.cells[k];
      const addr = numToCol(c) + r;
      if (cell.f) { const v = displayValue(r, c, s); ws[addr] = { t: typeof v === 'number' ? 'n' : typeof v === 'boolean'?'b':'s', v: isError(v) ? v.__err : (v === '' ? '' : v), f: cell.f }; }
      else if (cell.v != null && cell.v !== '') ws[addr] = typeof cell.v === 'number' ? { t: 'n', v: cell.v } : typeof cell.v==='boolean'?{t:'b',v:cell.v}:{ t: 's', v: String(cell.v) };
      const format=cell.s?.fmt;const formats={number:'0.00',int:'0',percent:'0.00%',currency:'#,##0.00 "ج.م"',date:'yyyy-mm-dd',text:'@'};
      if(ws[addr]&&(formats[format]||cell.xlsxNumberFormat))ws[addr].z=formats[format]||cell.xlsxNumberFormat;
    }
    const ref = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(1, usedBounds(s).rows) - 1, c: Math.max(1, usedBounds(s).cols) - 1 } });
    ws['!ref'] = ref;
    ws['!cols']=[];for(const [col,wpx] of Object.entries(s.colW||{}))ws['!cols'][Number(col)-1]={wpx};
    ws['!rows']=[];for(const [row,hpx] of Object.entries(s.rowH||{}))ws['!rows'][Number(row)-1]={hpx,hpt:hpx*72/96};
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0,31) || 'ورقة');
  }
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  download(file.name + '.xlsx', new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}
function exportCsv() {
  const s = sheet(); const { rows, cols } = usedBounds(s);
  const aoa = [];
  for (let r = 1; r <= rows; r++) { const row = []; for (let c = 1; c <= cols; c++) { const v = displayValue(r, c, s); row.push(isError(v) ? v.__err : (v ?? '')); } aoa.push(row); }
  const csv = XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet(aoa));
  download(file.name + '-' + s.name + '.csv', new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
}

/* ---------- لوحة الذكاء ---------- */
const aiPanel = $('#ai-panel'), aiResult = $('#ai-result');
$('#ai-note').textContent = AI_NOTICE;
$('#btn-ai').addEventListener('click', () => { const on = aiPanel.classList.toggle('open'); document.body.classList.toggle('ai-open', on); });
$('#ai-close').addEventListener('click', () => { aiPanel.classList.remove('open'); document.body.classList.remove('ai-open'); });
let aiRows = null;
aiPanel.querySelectorAll('[data-ai]').forEach(b => b.addEventListener('click', async () => {
  const kind = b.dataset.ai;
  aiResult.innerHTML = 'جارٍ المعالجة عبر خادم الدليل…'; aiRows = null; $('#ai-insert').disabled = true;
  try {
    if (kind === 'text-to-table') {
      const t = prompt('الصق النص الخام لتحويله إلى جدول:'); if (!t) { aiResult.innerHTML = ''; return; }
      const which = /(أحداث|احداث|تواريخ)/.test(t.slice(0, 60)) ? 'events' : (/ادعاء/.test(t) ? 'claims' : 'entities');
      let rows;
      if (which === 'entities') { const r = await extractEntities(t); rows = [['الكيان', 'النوع'], ...(r.persons || []).map(x => [x, 'شخص']), ...(r.organizations || []).map(x => [x, 'جهة']), ...(r.places || []).map(x => [x, 'مكان'])]; aiResult.innerHTML = `<span class="en-provider">${esc(aiProviderName(r.provider))}</span>`; }
      else if (which === 'events') { const r = await extractEvents(t); rows = [['الحدث', 'التاريخ/الزمن'], ...((Array.isArray(r.events) ? r.events : []).map(e => [e.event || e.text || '', e.date || e.time || '']))]; aiResult.innerHTML = `<span class="en-provider">${esc(aiProviderName(r.provider))}</span>`; }
      else { const r = await extractClaims(t); rows = [['الادعاء', 'الاقتباس الحرفي'], ...((Array.isArray(r.claims) ? r.claims : []).map(c => [c.claim || c.text || '', c.quote || '']))]; aiResult.innerHTML = `<span class="en-provider">${esc(aiProviderName(r.provider))}</span>`; }
      aiRows = rows;
      aiResult.innerHTML += `<p style="font-size:12px">جاهز: ${rows.length - 1} صفًا — «أدرج» يضعه من الخلية الحالية.</p>`;
      $('#ai-insert').disabled = false;
    } else if (kind === 'summarize-col') {
      const texts = [];
      eachSelCell((r, c) => { const v = displayValue(r, c); if (v && typeof v === 'string') texts.push(v); });
      if (!texts.length) { aiResult.textContent = 'حدّد خلايا فيها نصوص أولًا.'; return; }
      const r = await summarize(texts.join('\n').slice(0, 4000));
      aiResult.innerHTML = `<span class="en-provider">${esc(aiProviderName(r.provider))}</span><p style="font-size:12.5px;line-height:2">${esc(r.overview)}</p>`;
      aiRows = [['ملخص'], [r.overview]];
      $('#ai-insert').disabled = false;
    } else if (kind === 'plan-data') {
      const q = prompt('موضوع خطة البحث:'); if (!q) { aiResult.innerHTML = ''; return; }
      const r = await researchPlan(q);
      aiRows = [['الخطوة', 'الهدف', 'كيف', 'الأداة'], ...(r.steps || []).map((s, i) => [i + 1, s.goal, s.how, s.tool || ''])];
      aiResult.innerHTML = `<span class="en-provider">${esc(aiProviderName(r.provider))}</span><p style="font-size:12px">${esc(r.intro || '')} — ${aiRows.length - 1} خطوة جاهزة للإدراج. خطة مقترحة لم تُنفَّذ.</p>`;
      $('#ai-insert').disabled = false;
    }
  } catch (e) { aiResult.textContent = reasonText(e && e.reason, e && e.retryAfter); }
}));
$('#ai-insert').addEventListener('click', () => {
  if (!aiRows) return;
  pushUndo();
  aiRows.forEach((row, i) => row.forEach((v, c) => { if (v !== '' && v != null) setCell(sel.r1 + i, sel.c1 + c, { v: typeof v === 'number' ? v : String(v) }); }));
  recalc(); markDirty(); render(); syncSpacer(); toast('أُدرجت النتيجة في الورقة');
});

/* ---------- قائمة ملف والحفظ ---------- */
function wireFileMenu() {
  const btn = $('#btn-file'), menu = $('#menu-file');
  btn.addEventListener('click', e => { e.stopPropagation(); menu.classList.toggle('open'); });
  document.addEventListener('click', e => { if (!menu.contains(e.target)) menu.classList.remove('open'); });
  menu.addEventListener('click', async e => {
    const act = e.target.dataset.act; if (!act) return; menu.classList.remove('open');
    if (act === 'new') { const f = newFile('sheet'); await putFile(f); location.href = './sheets.html?f=' + f.id; }
    if (act === 'import-xlsx') pickFile('.xlsx,.xls', importXlsx);
    if (act === 'import-csv') pickFile('.csv,.tsv', f => f.text().then(importCsvText));
    if (act === 'export-xlsx') exportXlsx();
    if (act === 'export-csv') exportCsv();
    if (act === 'print') print();
    if (act === 'hub') location.href = './index.html';
  });
}
function pickFile(accept, cb) { const inp = $('#file-input'); inp.accept = accept; inp.onchange = () => { if (inp.files[0]) cb(inp.files[0]); inp.value = ''; }; inp.click(); }
const save = debounce(async () => { await putFile(file); dirty = false; $('#save-status').textContent = 'محفوظ محليًا ' + new Date().toLocaleTimeString('ar-EG-u-nu-latn'); }, 700);
function markDirty() { dirty = true; $('#save-status').textContent = 'يحفظ…'; save(); }
$('#doc-name').addEventListener('change', async e => { file.name = e.target.value.trim() || file.name; await putFile(file); });

/* ---------- تحميل ---------- */
async function load() {
  const id = fileParam();
  if (id) file = await getFile(id);
  if (!file) { file = newFile('sheet'); await putFile(file); history.replaceState(null, '', './sheets.html?f=' + file.id); }
  $('#doc-name').value = file.name;
  const params = new URLSearchParams(location.search);
  if (params.get('import') === '1') {
    const dataUrl = sessionStorage.getItem('osh-import-' + file.id); const name = sessionStorage.getItem('osh-import-name-' + file.id) || '';
    if (dataUrl) { sessionStorage.removeItem('osh-import-' + file.id); sessionStorage.removeItem('osh-import-name-' + file.id);
      const [header, encoded] = dataUrl.split(','); const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0)); const blob = new Blob([bytes], { type: header.slice(5).split(';')[0] }); const fObj = new File([blob], name);
      if (/\.csv$/i.test(name)) importCsvText(await fObj.text()); else await importXlsx(fObj); }
  }
  buildToolbar(); wireFileMenu(); renderTabs(); syncSpacer(); render(); syncFormulaBar();
}
addEventListener('resize', () => { render(); });
addEventListener('beforeunload', () => { if (dirty) putFile(file); });
load();
