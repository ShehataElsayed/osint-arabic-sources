import {validateCase} from './journalist-core.js';
import {ocrCase} from './journalist-media/ocr-case-core.js';
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
  let imgURL = null, busy = false, imageFile=null, rawText='',imageInfo=null,baseCase,caseInvalid=false,caseGeneration=0;
  document.getElementById('case-file').onchange=async()=>{const g=++caseGeneration;caseInvalid=true;baseCase=undefined;try{const f=document.getElementById('case-file').files[0];if(!f){caseInvalid=false;return}if(f.size>5000000)throw Error('حد القضية5ميجابايت');const v=validateCase(JSON.parse(await f.text()));if(g!==caseGeneration)return;baseCase=v;caseInvalid=false;$('#case-status').textContent='قضية مفتوحة محليًا: '+v.title}catch(e){if(g===caseGeneration)$('#case-status').textContent='لم تُفتح القضية: '+e.message}};
  function snapshot(){return {format:'ocr-review-v1',rawText,reviewedText:out.value,image:imageInfo,language:lang.value,title:$('#source-title').value,url:$('#source-url').value,review:$('#human-review').value,note:$('#review-note').value,limits:'OCR transcription is not independent corroboration. Image bytes not embedded; retain original image. Reviewer edits never replace raw engine text.'}}
  function download(name,data){const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)}
  $('#raw-export').onclick=()=>{if(rawText)download('ocr-review.json',snapshot())};
  $('#case-export').onclick=()=>{try{if(caseInvalid)throw Error('القضية غير صالحة أو لم يكتمل فتحها');if(busy)throw Error('انتظر الاستخراج');download('journalist-ocr-case.json',ocrCase(snapshot(),baseCase));$('#case-status').textContent='نُزلت نسخة جديدة مع الأصل وتعديلاتك منفصلة، دون تغيير القضية السابقة.'}catch(e){$('#case-status').textContent='لم تُصدر القضية: '+e.message+'؛ تصدير مراجعة OCR الأصلي ما زال متاحًا.'}};
  function clearResult() { rawText='';imageInfo=null;$('#raw-export').disabled=true;$('#case-export').disabled=true;$('#human-review').value='unreviewed';$('#review-note').value='';out.value = ''; out.hidden = true; copy.hidden = true; review.hidden = true; reviewList.replaceChildren(); layoutSideBySide(false); }
  function layoutSideBySide(on) {
    const row = document.getElementById('review-row');
    if (on) {
      if (!row || !preview.src) return;
      row.hidden = false;
      const imgCell = row.querySelector('.ocr-img-cell');
      imgCell.innerHTML = '';
      const img = document.createElement('img');
      img.src = preview.src; img.alt = 'الصورة الأصلية للمراجعة جنب النص';
      imgCell.appendChild(img);
      row.querySelector('.ocr-txt-cell').appendChild(out);
      out.hidden = false;
    } else if (row && !row.hidden) {
      row.parentNode.insertBefore(out, row);
      row.hidden = true;
      row.querySelector('.ocr-img-cell').innerHTML = '';
    }
  }
  function clearImage() {
    if (imgURL) URL.revokeObjectURL(imgURL);
    imgURL = null; preview.removeAttribute('src'); preview.hidden = true; run.disabled = true;
    clearResult();
  }
  function setFile(f) {
    if (busy) { status.textContent = 'انتظر اكتمال الاستخراج قبل تغيير الصورة.'; return; }
    clearImage();
    if (!f || !f.type.startsWith('image/')) { status.textContent = 'الملف المختار ليس صورة.'; return; }
    imageFile=f;imgURL = URL.createObjectURL(f);
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
      const text = result && result.data && result.data.text || '';rawText=text;const hash=await crypto.subtle.digest('SHA-256',await imageFile.arrayBuffer());imageInfo={name:imageFile.name,type:imageFile.type,size:imageFile.size,sha256:Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('')};$('#raw-export').disabled=!text;$('#case-export').disabled=!text;
      out.value = text; out.hidden = false; copy.hidden = !text;
      renderReview(text);
      layoutSideBySide(true);
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
