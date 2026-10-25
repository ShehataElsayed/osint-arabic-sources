// OCR محلي بالكامل داخل المتصفح عبر Tesseract.js — لا يُرفع أي ملف.
(function () {
  const $ = s => document.querySelector(s);
  const file = $('#file'), drop = $('#drop'), preview = $('#preview'), run = $('#run'),
        status = $('#status'), out = $('#out'), copy = $('#copy'), lang = $('#lang');
  let imgURL = null;
  function setFile(f) {
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
    run.disabled = true; out.hidden = true; copy.hidden = true;
    try {
      const worker = await Tesseract.createWorker(lang.value.split('+'), Tesseract.OEM.DEFAULT, {
        langPath: './tessdata', gzip: true,
        logger: m => { if (m.status) status.textContent = m.status + (m.progress ? ' — ' + Math.round(m.progress * 100) + '%' : ''); }
      });
      const result = await worker.recognize(imgURL);
      await worker.terminate();
      const text = (result && result.data && result.data.text || '').trim();
      out.value = text; out.hidden = false; copy.hidden = false;
      status.textContent = text ? 'اكتمل الاستخراج. راجع النص قبل الاعتماد عليه.' : 'لم يُستخرج نص واضح؛ جرّب صورة أوضح أو لغة أخرى.';
    } catch (e) {
      status.textContent = 'تعذّر الاستخراج: ' + (e && e.message ? e.message : 'خطأ غير معروف');
    } finally { run.disabled = false; }
  });
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(out.value); status.textContent = 'نُسخ النص.'; }
    catch { out.select(); document.execCommand('copy'); status.textContent = 'نُسخ النص.'; }
  });
})();
