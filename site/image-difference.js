import { BACKEND_URL, aiProviderName } from './rag-config.js';
const $=id=>document.getElementById(id),file=$('image-file'),quality=$('jpeg-quality'),scale=$('difference-scale'),run=$('image-run'),cancel=$('image-cancel'),status=$('image-status'),original=$('image-original'),difference=$('image-difference'),result=$('image-result'),report=$('image-report');
let revision=0,busy=false,worker=null,bitmap=null,record=null,downloadURL=null,pendingReject=null;
function invalidate(){revision++;worker?.terminate();worker=null;pendingReject?.(Error('أُلغي الحساب.'));pendingReject=null;bitmap?.close();bitmap=null;record=null;busy=false;run.disabled=!file.files[0];cancel.hidden=true;result.hidden=true;report.disabled=true;original.width=difference.width=0;original.height=difference.height=0;if(downloadURL)URL.revokeObjectURL(downloadURL);downloadURL=null;status.textContent='اختر صورة وشغّل المقارنة. لا تُرسل الصورة إلى خادم.';}
file.onchange=invalidate;quality.oninput=()=>{ $('quality-label').textContent=quality.value;invalidate()};scale.oninput=()=>{$('scale-label').textContent=scale.value;invalidate()};cancel.onclick=()=>{invalidate();status.textContent='أُلغي الانتظار والحساب. لم تُرفع الصورة.'};
function blob(canvas,type,q){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('تعذّر إنشاء نسخة JPEG.')),type,q))}
function compare(a,b,gain){return new Promise((resolve,reject)=>{pendingReject=reject;worker=new Worker('./image-difference-worker.js',{type:'module'});worker.onmessage=e=>{worker.terminate();worker=null;pendingReject=null;e.data.error?reject(Error(e.data.error)):resolve(e.data)};worker.onerror=()=>{worker?.terminate();worker=null;pendingReject=null;reject(Error('تعذّر تشغيل عامل معالجة الصورة.'))};worker.postMessage({original:a.buffer,compressed:b.buffer,scale:gain},[a.buffer,b.buffer])})}
run.onclick=async()=>{if(busy)return;invalidate();const version=revision,f=file.files[0];if(!f)return;if(!['image/jpeg','image/png'].includes(f.type)){status.textContent='اختر JPEG أو PNG فقط. لا ندعم SVG أو الصور المتحركة.';return}if(f.size>20*1024*1024){status.textContent='الملف أكبر من20ميجابايت.';return}busy=true;run.disabled=true;cancel.hidden=false;status.textContent='يقرأ الصورة ويعيد ضغطها محليًا...';let decoded,encoded;
try{decoded=await createImageBitmap(f);if(version!==revision)return;if(decoded.width>4096||decoded.height>4096||decoded.width*decoded.height>8_000_000)throw Error('الصورة تتجاوز4096بكسل في أحد البعدين أو8مليون بكسل. لم نصغّرها تلقائيًا لأن التصغير يغيّر التحليل.');bitmap=decoded;
original.width=decoded.width;original.height=decoded.height;const ctx=original.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,original.width,original.height);ctx.drawImage(decoded,0,0);const a=ctx.getImageData(0,0,original.width,original.height).data;
const compressed=await blob(original,'image/jpeg',Number(quality.value)/100);if(version!==revision)return;encoded=await createImageBitmap(compressed);if(version!==revision)return;const temp=document.createElement('canvas');temp.width=original.width;temp.height=original.height;const t=temp.getContext('2d',{willReadFrequently:true});t.drawImage(encoded,0,0);const b=t.getImageData(0,0,temp.width,temp.height).data;const r=await compare(a,b,Number(scale.value));if(version!==revision)return;
difference.width=original.width;difference.height=original.height;difference.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(r.output),original.width,original.height),0,0);
record={method:'absolute RGB pixel difference after browser JPEG recompression',width:original.width,height:original.height,jpeg_quality:Number(quality.value),display_gain:Number(scale.value),mean_absolute_rgb_difference:r.mean,max_channel_difference:r.max,pixel_count:r.pixels,input_type:f.type,alpha_composited_on_white:true,limitations:['Not an authenticity or AI-generation verdict','Browser codec/decoding/color management affects output','PNG has no original JPEG quality; experimental recompression only','Transparent pixels composited on white','No resize performed','Metadata not analyzed']};
$('image-metrics').textContent=`الأبعاد: ${record.width}×${record.height} · متوسط فرق القنوات: ${r.mean.toFixed(3)} من255 · أكبر فرق: ${r.max} من255. هذه قياسات فرق وليست درجة تزوير.`;result.hidden=false;report.disabled=false;const _ab=document.getElementById('ai-box');if(_ab)_ab.hidden=false;status.textContent='اكتملت المقارنة محليًا. المناطق المضيئة ليست دليل تلاعب بمفردها.';
}catch(e){if(version===revision){result.hidden=true;status.textContent=e.message||'تعذّرت قراءة الصورة.'}}finally{decoded?.close();encoded?.close();bitmap=null;if(version===revision){busy=false;run.disabled=false;cancel.hidden=true}}};
report.onclick=()=>{if(!record)return;if(downloadURL)URL.revokeObjectURL(downloadURL);downloadURL=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=downloadURL;a.download='image-difference-report.json';a.click()};
$('image-clear').onclick=()=>{file.value='';invalidate()};

// AI explanation of the visible measurements (2026-10-30 all-tools AI expansion, user «تمام ضيفه ف
// كل الأدوات»): the analysis stays fully local; this optional section sends ONLY the visible
// measurement TEXT (never the image) to the guide worker (summarize_text route, context 'image').
// The worker guard blocks any authenticity/manipulation verdict; description of measurements only.
(function aiSummary(){
  const box=document.getElementById('ai-box'), btn=document.getElementById('ai-summarize'),
        st=document.getElementById('ai-status'), res=document.getElementById('ai-result'),
        prov=document.getElementById('ai-provider'), ov=document.getElementById('ai-overview'),
        qh=document.getElementById('ai-quotes-h'), ql=document.getElementById('ai-quotes');
  if(!box||!btn)return;
  btn.onclick=async()=>{
    const text=(document.getElementById('image-metrics').textContent+'\n'+document.getElementById('image-status').textContent).slice(0,11000);
    if(text.trim().length<40){st.textContent='القياسات أقصر من أن تُشرح.';return}
    btn.disabled=true;res.hidden=true;st.textContent='جارٍ الشرح بالذكاء الاصطناعي…';
    try{
      const r=await fetch(BACKEND_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'summarize_text',text,context:'image'})});
      const j=r.ok?await r.json():null;
      const sm=j&&j.summary;
      if(!sm){st.textContent='الشرح بالذكاء الاصطناعي غير متاح الآن؛ قياساتك الكاملة ظاهرة أعلاه.';return}
      prov.textContent=aiProviderName(j&&j.provider);
      ov.textContent=sm.overview;
      ql.replaceChildren();
      if(Array.isArray(sm.key_quotes)&&sm.key_quotes.length){qh.hidden=false;for(const q of sm.key_quotes){const li=document.createElement('li');li.textContent=q;ql.append(li)}}else qh.hidden=true;
      res.hidden=false;
      st.textContent='اكتمل الشرح بالذكاء الاصطناعي؛ الملخص بصياغة النموذج وصفٌ للقياسات لا حكمٌ على الصورة - راجعه أمام القياسات قبل الاعتماد عليه.'}
    catch{st.textContent='تعذر الوصول إلى خدمة الذكاء الاصطناعي؛ قياساتك الكاملة ظاهرة أعلاه.'}
    finally{btn.disabled=false}};
})();
