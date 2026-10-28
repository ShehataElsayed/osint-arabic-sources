import{flagSuspectTokens}from'./journalist-media/ocr-review-core.js';
// OCR محلي بالكامل داخل المتصفح عبر Tesseract.js — لا يُرفع أي ملف.
(function () {
  const $ = s => document.querySelector(s);
  const file = $('#file'), drop = $('#drop'), preview = $('#preview'), run = $('#run'),
        status = $('#status'), out = $('#out'), copy = $('#copy'), lang = $('#lang');
  const review = $('#review'), reviewList = $('#review-list');
  const REASONS = {
    'mixed-digits': 'أرقام عربية وإنجليزية مختلطة في الرمز نفسه',
    'mixed-letters': 'أحرف عربية ولاتينية مختلطة في الرمز نفسه',
    'digit-glued-to-word': 'رقم ملتصق بكلمة عربية'
  };
  function renderReview(text) {
    const flags = flagSuspectTokens(text);
    review.hidden = false;
    reviewList.replaceChildren();
    const head = document.createElement('p');
    head.textContent = flags.length
      ? flags.length + ' رمز مشبوه للمراجعة (قواعد محلية، بلا تصحيح تلقائي — النص كما استخرجه المحرك):'
      : 'لا رموز مشبوهة بالقواعد المحددة. راجع النص مقابل الصورة يدويًا في كل الأحوال.';
    reviewList.appendChild(head);
    for (const f of flags) {
      const card = document.createElement('div');
      card.className = 'flag-card';
      const b = document.createElement('b');
      b.textContent = f.token;
      const r = document.createElement('p');
      r.textContent = f.reasons.map(x => REASONS[x] || x).join('؛ ');
      card.append(b, r);
      reviewList.appendChild(card);
    }
  }
  let imgURL = null, busy = false;
  function clearResult() { out.value = ''; out.hidden = true; copy.hidden = true; review.hidden = true; reviewList.replaceChildren(); }
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
        workerPath: './journalist-media/ocr/worker.min.js',
        corePath: './journalist-media/ocr/',
        langPath: './tessdata', gzip: true, workerBlobURL: false,
        logger: m => { if (m.status) status.textContent = m.status + (m.progress ? ' — ' + Math.round(m.progress * 100) + '%' : ''); }
      });
      const result = await worker.recognize(imgURL);
      const text = (result && result.data && result.data.text || '').trim();
      out.value = text; out.hidden = false; copy.hidden = !text;
      renderReview(text);
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
