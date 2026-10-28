/* Reverse-image-search client module — DRAFT, wired into video-frames page on activation.
   Per-frame EXPLICIT consent: first press shows the consent notice for THAT frame and arms a
   confirm button; only the confirm press uploads. No frame leaves the browser otherwise.
   No deletion promise (image_id ~10min expiry is an access window, not deletion evidence).
   Quota wording is honest: 240/month is ONE SHARED GLOBAL pool for all visitors, not per-visitor. */
(function(global){
'use strict';
const REVERSE_ENDPOINT='https://reverse-search-proxy.egkrkr.workers.dev/reverse-search'; // set at activation
const MAX_BYTES=480*1024;

function consentText(){
 return 'البحث العكسي عن هذه اللقطة بالذات يعني رفعها إلى SerpApi وتمريرها إلى Google Lens للبحث عن ظهورها على الويب. لا تُرفع أي لقطة إلا بضغطك على زر التأكيد. حصة البحث مشتركة بين كل زوار المنصة ('+240+' عملية في الشهر للجميع) وقد تنفد.';
}
function compressFrame(canvas,cb){
 let q=0.85;
 (function tryQ(){
  canvas.toBlob(b=>{
   if(!b){cb(null);return}
   if(b.size<=MAX_BYTES||q<=0.35){cb(b);return}
   q-=0.15; tryQ();
  },'image/jpeg',q);
 })();
}
async function reverseSearchBlob(blob){
 const res=await fetch(REVERSE_ENDPOINT,{method:'POST',headers:{'content-type':'image/jpeg'},body:blob});
 const j=await res.json().catch(()=>({}));
 if(res.status===429){
  if(j.error==='monthly_quota_exhausted')throw new Error('انتهت الحصة الشهرية المشتركة للبحث العكسي ('+j.cap+' عملية لكل زوار المنصة). تتجدد مع بداية الشهر القادم — الحصة محدودة لأن الخطة مجانية.');
  if(j.error==='daily_quota_exhausted')throw new Error('وصلت للحد اليومي للبحث العكسي ('+j.cap+' صور). جرّب غدًا.');
  throw new Error('خدمة البحث العكسي مشغولة الآن. جرّب بعد قليل.');
 }
 if(!res.ok)throw new Error('تعذّر الوصول لخدمة البحث العكسي. جرّب لاحقًا.');
 return j;
}
function renderResults(container,j){
 container.textContent='';
 const sections=[['نتائج مطابقة تمامًا',j.exact_matches],['نتائج مشابهة',j.visual_matches]];
 let any=false;
 for(const [title,list] of sections){
  if(!Array.isArray(list)||!list.length)continue;
  any=true;
  const h=document.createElement('h4');h.textContent=title;container.appendChild(h);
  const ul=document.createElement('ul');ul.className='rs-list';
  for(const m of list){
   if(!m||typeof m.link!=='string'||!m.link.startsWith('https://'))continue; // no javascript:/data: URLs
   const li=document.createElement('li');
   const a=document.createElement('a');a.href=m.link;a.target='_blank';a.rel='noopener noreferrer';
   if(typeof m.thumbnail==='string'&&m.thumbnail.startsWith('https://')){
    const img=document.createElement('img');img.src=m.thumbnail;img.alt='';img.loading='lazy';a.appendChild(img)}
   const t=document.createElement('span');
   t.textContent=String(m.title||m.link)+' — '+String(m.source||''); // textContent: provider HTML never parsed
   a.appendChild(t);li.appendChild(a);ul.appendChild(li);
  }
  container.appendChild(ul);
 }
 if(!any){const p=document.createElement('p');p.textContent='لم تظهر نتائج مطابقة لهذه اللقطة. غياب النتائج لا يعني أن اللقطة أصلية — جرّب لقطة أوضح أو مصادر تحقق أخرى.';container.appendChild(p)}
}
/* Two-press consent per frame. opts={canvas, btn, status, results} */
function initReverseSearch(opts){
 let armed=false;
 opts.btn.addEventListener('click',async()=>{
  if(!armed){ // press 1: show consent for THIS frame, arm confirm
   opts.status.textContent=consentText();
   opts.btn.textContent='تأكيد رفع هذه اللقطة والبحث عنها';
   armed=true;return;
  }
  armed=false;opts.btn.disabled=true;
  opts.status.textContent='جارٍ تجهيز اللقطة…';
  compressFrame(opts.canvas,async blob=>{
   if(!blob){opts.status.textContent='تعذّر تجهيز اللقطة للرفع.';opts.btn.disabled=false;return}
   opts.status.textContent='جارٍ البحث العكسي عن اللقطة…';
   try{
    const j=await reverseSearchBlob(blob);
    opts.status.textContent='اكتمل البحث — راجع النتائج وتحقّق من سياقها بنفسك.';
    renderResults(opts.results,j);
   }catch(e){opts.status.textContent=e.message}
   finally{opts.btn.disabled=false}
  });
 });
}
global.OshaiReverseSearch={initReverseSearch,renderResults,consentText};
})(window);
