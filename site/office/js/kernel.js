/* Osh Office kernel: local-first document storage, shared models and utilities.
   كل الملفات تُحفظ على جهاز المستخدم (IndexedDB) ولا تُرفع إلى أي خادم. */
export const DB_NAME = 'osh-office-v1';
export const KINDS = { doc: 'مستند', sheet: 'جدول', deck: 'عرض تقديمي', board: 'لوحة مهام' };

let _db = null;
export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const rq = indexedDB.open(DB_NAME, 1);
    rq.onupgradeneeded = () => { const d = rq.result; if (!d.objectStoreNames.contains('files')) d.createObjectStore('files', { keyPath: 'id' }); };
    rq.onsuccess = () => { _db = rq.result; res(_db); };
    rq.onerror = () => rej(rq.error);
  });
}
function tx(mode, fn) {
  return openDB().then(d => new Promise((res, rej) => {
    const t = d.transaction('files', mode), s = t.objectStore('files');
    const out = fn(s);
    t.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
    t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  }));
}
export function listFiles() { return openDB().then(d => new Promise((res, rej) => { const rq = d.transaction('files').objectStore('files').getAll(); rq.onsuccess = () => res(rq.result || []); rq.onerror = () => rej(rq.error); })); }
export function getFile(id) { return openDB().then(d => new Promise((res, rej) => { const rq = d.transaction('files').objectStore('files').get(id); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => rej(rq.error); })); }
export function putFile(f) { f.updated = Date.now(); return tx('readwrite', s => s.put(f)).then(() => f); }
export function deleteFile(id) { return tx('readwrite', s => s.delete(id)); }

export const uid = () => 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmtDate = ts => new Date(ts).toLocaleString('ar-EG-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' });
export function download(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

export function newFile(kind, name) {
  const base = { id: uid(), kind, name: name || ('بدون عنوان'), created: Date.now(), updated: Date.now() };
  if (kind === 'doc') base.data = { html: '', settings: { font: 'Cairo', size: 14, dir: 'rtl' } };
  else if (kind === 'sheet') base.data = { sheets: [{ name: 'ورقة1', cells: {}, merges: [], colW: {}, rowH: {}, rtl: true, freeze: { r: 0, c: 0 } }], active: 0 };
  else if (kind === 'deck') base.data = { slides: [{ bg: { type: 'color', value: '#141613' }, elements: [], notes: '' }], theme: { accent: '#b5e853', canvas: '#141613', ink: '#f2f4ef' }, ratio: '16:9' };
  else if (kind === 'board') base.data = { lists: [{ id: uid(), title: 'قائمة الانتظار', cards: [] }, { id: uid(), title: 'قيد التنفيذ', cards: [] }, { id: uid(), title: 'منجز', cards: [] }] };
  return base;
}

/* Handoff bridge: any platform tool can stage content for Osh Office without leaving the device.
   payload: {kind:'doc'|'sheet'|'deck', name, docHtml?|rows?|slides?} */
const HANDOFF_KEY = 'osh-office-handoff';
export function stageHandoff(payload) { localStorage.setItem(HANDOFF_KEY, JSON.stringify({ ...payload, at: Date.now() })); }
export function takeHandoff() { try { const v = localStorage.getItem(HANDOFF_KEY); if (!v) return null; localStorage.removeItem(HANDOFF_KEY); return JSON.parse(v); } catch { return null; } }
export function peekHandoff() { try { const v = localStorage.getItem(HANDOFF_KEY); return v ? JSON.parse(v) : null; } catch { return null; } }

/* Font registry: populated from the bundled OFL families (fonts/manifest.json). */
export async function loadFonts() {
  try { const r = await fetch('./fonts/manifest.json'); if (!r.ok) return []; const m = await r.json(); return Object.entries(m).map(([name, v]) => ({ name, weights: v.weights, slug: v.slug })); } catch { return []; }
}

/* Shared toast */
export function toast(msg, ms = 3200) {
  let host = document.getElementById('osh-toast');
  if (!host) { host = document.createElement('div'); host.id = 'osh-toast'; host.setAttribute('role', 'status'); document.body.appendChild(host); }
  host.textContent = msg; host.classList.add('on');
  clearTimeout(host._t); host._t = setTimeout(() => host.classList.remove('on'), ms);
}

/* Open an existing file in its app */
export const APP_PAGE = { doc: './writer.html', sheet: './sheets.html', deck: './slides.html', board: './tasks.html' };
export function openFile(f) { location.href = APP_PAGE[f.kind] + '?f=' + encodeURIComponent(f.id); }
export function fileParam() { return new URLSearchParams(location.search).get('f'); }

/* Serialize helpers shared by exporters */
export function textOfHtml(html) { const d = document.createElement('div'); d.innerHTML = html; return d.textContent || ''; }
