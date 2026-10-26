// OCR محلي بالكامل داخل المتصفح عبر Tesseract.js — لا يُرفع أي ملف.
(function () {
  const $ = s => document.querySelector(s);
  const file = $('#file'), drop = $('#drop'), preview = $('#preview'), run = $('#run'),
        status = $('#status'), out = $('#out'), copy = $('#copy'), lang = $('#lang');
  let imgURL = null, busy = false;
  function clearResult() { out.value = ''; out.hidden = true; copy.hidden = true; }
  function clearImage() {
    if (imgURL) URL.revokeObjectURL(imgURL);
    imgURL = null; preview.removeAttribute('src'); preview.hidden = true; run.disabled = true;
    clearResult();
  }
  function setFile(f) {
    if (busy) { status.textContent = 'انتظر اكتمال الاستخراج قبل تغيير الصورة.'; return; }
    clearImage();
    if (!f || !f.type.startsWith('image/')) { status.textContent = 'الملف المختار ليس صورة.'; return; }
    imgURL = URL.createObjectURL(f);
    preview.src = imgURL; preview.hidden = false;
    run.disabled = false; status.textContent = 'جاهز للاستخراج.';
  }
  file.addEventListener('change', () => setFile(file.files[0]));
  drop.addEventListener('dragover', e => e.preventDefault());
  drop.addEventListener('drop', e => { e.preventDefault(); setFile(e.dataTransfer.files[0]); });
  run.addEventListener('click', async () => {
    if (!imgURL || typeof Tesseract === 'undefined') { status.textContent = 'مكتبة التعرف لم تُحمّل بعد؛ تحقق من الاتصال وأعد المحاولة.'; return; }
    if (busy) return;
    busy = true; run.disabled = true; file.disabled = true; lang.disabled = true; clearResult();
    let worker;
    try {
      worker = await Tesseract.createWorker(lang.value.split('+'), Tesseract.OEM.DEFAULT, {
        langPath: './tessdata', gzip: true,
        logger: m => { if (m.status) status.textContent = m.status + (m.progress ? ' — ' + Math.round(m.progress * 100) + '%' : ''); }
      });
      const result = await worker.recognize(imgURL);
      const text = (result && result.data && result.data.text || '').trim();
      out.value = text; out.hidden = false; copy.hidden = !text;
      status.textContent = text ? 'اكتمل الاستخراج. راجع النص قبل الاعتماد عليه.' : 'لم يُستخرج نص واضح؛ جرّب صورة أوضح أو لغة أخرى.';
    } catch (e) {
      status.textContent = 'تعذّر الاستخراج: ' + (e && e.message ? e.message : 'خطأ غير معروف');
    } finally {
      if (worker) { try { await worker.terminate(); } catch {} }
      busy = false; file.disabled = false; lang.disabled = false; run.disabled = !imgURL;
    }
  });
  lang.addEventListener('change', () => { clearResult(); status.textContent = imgURL ? 'تغيرت اللغة؛ أعد استخراج النص.' : ''; });
  copy.addEventListener('click', async () => {
    if (busy || out.hidden || !out.value.trim()) return;
    try { await navigator.clipboard.writeText(out.value); status.textContent = 'نُسخ النص.'; }
    catch { out.select(); document.execCommand('copy'); status.textContent = 'نُسخ النص.'; }
  });
})();
