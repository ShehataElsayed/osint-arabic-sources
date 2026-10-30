// مختبر بيانات محلي: SQL كامل على ملفات CSV/TSV/JSON داخل المتصفح عبر DuckDB-WASM — لا يُرفع أي ملف.
import { BACKEND_URL, aiProviderName } from './rag-config.js';
import * as duckdb from './duckdb/duckdb-browser.mjs';
(function () {
  const $ = s => document.querySelector(s);
  const file = $('#file'), drop = $('#drop'), filemeta = $('#filemeta'), preview = $('#preview'),
        previewwrap = $('#previewwrap'), sql = $('#sql'), run = $('#run'), copy = $('#copy'),
        status = $('#status'), result = $('#result'), resultwrap = $('#resultwrap'), resultmeta = $('#resultmeta');
  let db = null, conn = null, rawFile = null, lastTSV = '', busy = false, cleanup = Promise.resolve();
  function clearResult() { resultwrap.hidden = true; result.innerHTML = ''; resultmeta.textContent = ''; copy.hidden = true; lastTSV = ''; }
  function releaseDB() {
    const oldConn = conn, oldDB = db; conn = null; db = null;
    cleanup = cleanup.then(async () => {
      if (oldConn) { try { await oldConn.close(); } catch {} }
      if (oldDB) { try { await oldDB.terminate(); } catch {} }
    });
  }
  function clearFile() {
    rawFile = null; releaseDB(); clearResult();
    previewwrap.hidden = true; preview.innerHTML = ''; filemeta.textContent = ''; run.disabled = true;
  }

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function renderTable(el, cols, rows, cap) {
    let h = '<thead><tr>' + cols.map(c => '<th>' + esc(c) + '</th>').join('') + '</tr></thead><tbody>';
    rows.slice(0, cap).forEach(r => { h += '<tr>' + r.map(v => '<td>' + esc(v) + '</td>').join('') + '</tr>'; });
    el.innerHTML = h + '</tbody>';
  }
  function setFile(f) {
    if (busy) { status.textContent = 'انتظر اكتمال الاستعلام قبل تغيير الملف.'; return; }
    clearFile();
    if (!f) { status.textContent = 'اختر ملفًا أولًا.'; return; }
    if (!/\.(csv|tsv|txt|json)$/i.test(f.name) && !/csv|json|text/.test(f.type)) { status.textContent = 'صيغة غير مدعومة؛ اختر CSV أو TSV أو JSON.'; return; }
    if (f.size > 100 * 1024 * 1024) { status.textContent = 'الملف أكبر من ١٠٠ ميغابايت؛ حدّ الأداة التجريبية ١٠٠ ميغابايت حفاظًا على ذاكرة جهازك.'; return; }
    rawFile = f; run.disabled = false;
    filemeta.textContent = 'الملف: ' + f.name + ' — ' + (f.size / 1024).toFixed(1) + ' كيلوبايت. اضغط «شغّل الاستعلام» لتحميل المحرك وقراءة الملف.';
    previewwrap.hidden = true; resultwrap.hidden = true; copy.hidden = true; status.textContent = '';
  }
  file.addEventListener('change', () => setFile(file.files[0]));
  drop.addEventListener('dragover', e => e.preventDefault());
  drop.addEventListener('drop', e => { e.preventDefault(); setFile(e.dataTransfer.files[0]); });

  async function ensureDB() {
    await cleanup;
    if (db) return;
    status.textContent = 'يُحمَّل محرك الاستعلام لأول مرة (نحو ٤٠ ميغابايت من خادم الدليل نفسه)...';
    const worker = new Worker('./duckdb/duckdb-browser-mvp.worker.js');
    db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING), worker);
    await db.instantiate(new URL('./duckdb/duckdb-mvp.wasm', window.location.href).toString(), null);
  }
  function jsonToCSV(text) {
    const v = JSON.parse(text);
    const rows = Array.isArray(v) ? v : [v];
    const cols = [...new Set(rows.flatMap(r => r && typeof r === 'object' && !Array.isArray(r) ? Object.keys(r) : ['value']))];
    const cell = x => { const s = x == null ? '' : (typeof x === 'object' ? JSON.stringify(x) : String(x)); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return [cols.join(',')].concat(rows.map(r => cols.map(c => cell(r && typeof r === 'object' && !Array.isArray(r) ? r[c] : r)).join(','))).join('\n');
  }
  async function loadData() {
    if (conn) return;
    await ensureDB();
    status.textContent = 'يقرأ الملف محليًا...';
    conn = await db.connect();
    let text = await rawFile.text();
    if (/\.json$/i.test(rawFile.name) || rawFile.type.includes('json')) { try { text = jsonToCSV(text); } catch (e) { throw new Error('تعذّر تحويل JSON إلى جدول: ' + e.message); } }
    await db.registerFileText('input.csv', text);
    await conn.query("CREATE OR REPLACE TABLE data AS SELECT * FROM read_csv_auto('input.csv', header=true, all_varchar=true)");
    // Lock down AFTER the user's own file is loaded: no network, no extension install/load,
    // no external filesystem from arbitrary SQL (probed: zero cross-origin attempts after these).
    await conn.query('SET enable_external_access=false');
    await conn.query('SET autoinstall_known_extensions=false');
    await conn.query('SET autoload_known_extensions=false');
    try { await conn.query('SET lock_configuration=true'); } catch { /* older engines: re-enable already fails closed (probed) */ }
    const cols = await conn.query('SELECT * FROM data LIMIT 8');
    const names = cols.schema.fields.map(f => f.name);
    renderTable(preview, names, cols.toArray().map(r => names.map(n => r[n])), 8);
    previewwrap.hidden = false;
    const cnt = await conn.query('SELECT count(*) AS n FROM data');
    filemeta.textContent = 'الملف: ' + rawFile.name + ' — الأعمدة: ' + names.length + '، الصفوف: ' + cnt.toArray()[0].n + '. المعاينة أدناه (أول ٨ صفوف).';
  }
  run.addEventListener('click', async () => {
    if (busy) return;
    if (!rawFile) { status.textContent = 'اختر ملفًا أولًا.'; return; }
    busy = true; run.disabled = true; file.disabled = true; sql.disabled = true; clearResult();
    try {
      await loadData();
      status.textContent = 'ينفّذ الاستعلام محليًا...';
      const res = await conn.query(sql.value);
      const cols = res.schema.fields.map(f => f.name);
      const rows = res.toArray().map(r => cols.map(n => r[n]));
      renderTable(result, cols, rows, 500);
      resultwrap.hidden = false;
      resultmeta.textContent = 'عدد صفوف النتيجة: ' + rows.length + (rows.length > 500 ? ' (تُعرض أول ٥٠٠ فقط)' : '') + '.';
      lastTSV = [cols.join('\t')].concat(rows.map(r => r.map(v => String(v == null ? '' : v).replace(/[\t\n]/g, ' ')).join('\t'))).join('\n');
      window.__dlLastTSV = lastTSV; // exposed for the AI-result section (closure-local state)
      copy.hidden = false; status.textContent = 'اكتمل الاستعلام محليًا على جهازك.';
    } catch (e) {
      clearResult(); releaseDB(); previewwrap.hidden = true; // failed imports/queries never reuse incomplete state
      const q = sql.value;
      const em = e && e.message ? e.message : 'خطأ غير معروف';
      if (/https?:\/\/|\b(INSTALL|LOAD|ATTACH|COPY|EXPORT)\b/i.test(q)) {
        status.textContent = 'الوصول إلى الإنترنت أو تثبيت امتدادات أو ملفات خارجية من داخل الاستعلامات معطّل في هذه الأداة حفاظًا على خصوصية بياناتك؛ الاستعلامات تعمل على جدول data المحلي فقط.';
      } else if (/_setThrew|not defined/i.test(em)) {
        // DuckDB-WASM glue fails rendering error messages that contain non-ASCII text
        // (e.g. a mistyped Arabic column name). The query itself is the problem; say so.
        status.textContent = 'تعذّر تنفيذ الاستعلام؛ راجع الصياغة وأسماء الأعمدة كما تظهر في المعاينة أعلاه، واستخدم CAST للحقول الرقمية.';
      } else {
        status.textContent = 'تعذّر التنفيذ: ' + em;
      }
    } finally { busy = false; file.disabled = false; sql.disabled = false; run.disabled = !rawFile; }
  });
  sql.addEventListener('input', () => { clearResult(); if (rawFile && !busy) status.textContent = 'تغير الاستعلام؛ شغّله لعرض نتيجة محدثة.'; });
  copy.addEventListener('click', async () => {
    if (busy || resultwrap.hidden || !lastTSV) return;
    try { await navigator.clipboard.writeText(lastTSV); status.textContent = 'نُسخت النتيجة بصيغة TSV.'; }
    catch { status.textContent = 'تعذّر النسخ التلقائي؛ حدّد الجدول وانسخه يدويًا.'; }
  });
})();

// AI explanation of the SQL result (2026-10-30 all-tools AI expansion, user «تمام ضيفه ف كل
// الأدوات»): the query engine stays fully local; this optional section sends ONLY the visible
// result TSV to the guide worker (summarize_text route, context 'data').
(function aiResult(){
  const box=document.getElementById('ai-box'), btn=document.getElementById('ai-summarize'),
        st=document.getElementById('ai-status'), res=document.getElementById('ai-result'),
        prov=document.getElementById('ai-provider'), ov=document.getElementById('ai-overview'),
        qh=document.getElementById('ai-quotes-h'), ql=document.getElementById('ai-quotes'),
        resultwrap=document.getElementById('resultwrap');
  if(!box||!btn||!resultwrap)return;
  new MutationObserver(()=>{ box.hidden = resultwrap.hidden; if(box.hidden){res.hidden=true;st.textContent='';} }).observe(resultwrap,{attributes:true,attributeFilter:['hidden']});
  btn.onclick=async()=>{
    const tsv=(typeof window.__dlLastTSV==='string'?window.__dlLastTSV:'').slice(0,11000);
    if(tsv.trim().length<40){st.textContent='النتيجة قصيرة جدًا للشرح.';return}
    btn.disabled=true;res.hidden=true;st.textContent='جارٍ الشرح بالذكاء الاصطناعي…';
    try{
      const r=await fetch(BACKEND_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'summarize_text',text:tsv,context:'data'})});
      const j=r.ok?await r.json():null;
      const sm=j&&j.summary;
      if(!sm){st.textContent='الشرح بالذكاء الاصطناعي غير متاح الآن؛ نتيجتك الكاملة ظاهرة أعلاه.';return}
      prov.textContent=aiProviderName(j&&j.provider);
      ov.textContent=sm.overview;
      ql.replaceChildren();
      if(Array.isArray(sm.key_quotes)&&sm.key_quotes.length){qh.hidden=false;for(const q of sm.key_quotes){const li=document.createElement('li');li.textContent=q;ql.append(li)}}else qh.hidden=true;
      res.hidden=false;
      st.textContent='اكتمل الشرح بالذكاء الاصطناعي؛ الملخص بصياغة النموذج - راجعه أمام النتيجة قبل الاعتماد عليه.'}
    catch{st.textContent='تعذر الوصول إلى خدمة الذكاء الاصطناعي؛ نتيجتك الكاملة ظاهرة أعلاه.'}
    finally{btn.disabled=false}};
})();
