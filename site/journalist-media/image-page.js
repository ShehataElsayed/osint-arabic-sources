import{analyzeImage}from'./image-analysis.js';
const $=id=>document.getElementById(id),say=t=>$('status').textContent=t;
let generation=0,file=null,bitmap=null,url=null,bytes=null,hash='';
async function fingerprint(f){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await f.arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join('')}
function reset(){generation++;if(url)URL.revokeObjectURL(url);url=null;file=null;bitmap=null;bytes=null;hash='';$('preview').hidden=true;$('preview').removeAttribute('src');$('run').disabled=true;$('clear').hidden=true;$('analysis').replaceChildren();$('ia-summary').hidden=true;$('ia-summary').textContent=''}
async function accept(f){reset();if(!f)return;
 if(!/^image\/(jpeg|png)$/.test(f.type)||f.size>20*1024*1024){say('اختر JPEG أو PNG حتى ٢٠ ميجابايت.');return}
 const id=generation;try{say('قراءة الملف محليًا وحساب بصمته…');bitmap=await createImageBitmap(f);
 if(bitmap.width*bitmap.height>16000000){bitmap.close();bitmap=null;say('الصورة تتجاوز ١٦ مليون بكسل؛ صغّرها قبل الفحص.');return}
 bytes=new Uint8Array(await f.arrayBuffer());hash=await fingerprint(f);if(id!==generation)return;
 file=f;url=URL.createObjectURL(f);$('preview').src=url;$('preview').hidden=false;$('run').disabled=false;$('clear').hidden=false;
 say('الملف جاهز. البصمة تربط الملف بمراجعتك ولا تثبت أصالته.')}catch(e){say('تعذر فتح الصورة: '+e.message)}}
$('file').onchange=()=>accept($('file').files[0]);
$('drop').ondragover=e=>{e.preventDefault()};$('drop').ondrop=e=>{e.preventDefault();accept(e.dataTransfer.files[0])};
$('clear').onclick=()=>{reset();$('file').value='';say('مُسحت الصورة من الصفحة. لم يُرفع الملف.')};
$('run').onclick=async()=>{if(!file)return;const id=generation;$('run').disabled=true;
 try{say('يُحلل الملف محليًا…');const summary=$('ia-summary');summary.hidden=false;
 summary.textContent=`اسم الملف: ${file.name}\nالحجم: ${file.size.toLocaleString('ar-EG')} بايت\nالأبعاد: ${bitmap.width}×${bitmap.height}\nSHA-256: ${hash}`;
 const analysis=await analyzeImage({file,bytes,bitmap,box:$('analysis'),say,isStale:()=>id!==generation});
 if(id!==generation)return;
 say(analysis.warnings.length?'اكتمل الفحص المحلي مع ملاحظات. راجع كل مؤشر أمام الأصل؛ لا حكم أصالة.':'اكتمل الفحص المحلي. راجع كل مؤشر أمام الأصل؛ لا حكم أصالة.')}
 catch(e){if(id===generation)say('لم يكتمل الفحص: '+e.message)}
 finally{if(id===generation)$('run').disabled=false}};
addEventListener('pagehide',reset);
