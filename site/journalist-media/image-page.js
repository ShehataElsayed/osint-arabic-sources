import{analyzeImage}from'./image-analysis.js';
import{perceptualHashes}from'./image-analysis-core.js';
const $=id=>document.getElementById(id),say=t=>$('status').textContent=t;
let generation=0,file=null,bitmap=null,url=null,bytes=null,hash='';
async function fingerprint(f){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await f.arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join('')}
function reset(){generation++;if(url)URL.revokeObjectURL(url);url=null;file=null;bitmap=null;bytes=null;hash='';$('preview').hidden=true;$('preview').removeAttribute('src');$('run').disabled=true;$('clear').hidden=true;$('analysis').replaceChildren();$('ia-summary').hidden=true;$('ia-summary').replaceChildren()}
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
 try{say('يُحلل الملف محليًا…');const summary=$('ia-summary');summary.hidden=false;summary.replaceChildren();
 const wrap=document.createElement('div');wrap.className='ia-file';
 const im=document.createElement('img');im.src=url;im.alt='الصورة محل الفحص';im.className='ia-file-thumb';
 const facts=document.createElement('div');facts.className='ia-facts';
 const addFact=(k,v,ltr)=>{const d=document.createElement('div');d.className='fact';
  const s=document.createElement('small');s.textContent=k;const b=document.createElement('b');b.textContent=v;if(ltr)b.dir='ltr';
  d.append(s,b);facts.append(d)};
 addFact('اسم الملف',file.name);addFact('الحجم',file.size.toLocaleString('ar-EG')+' بايت');
 {const d=document.createElement('div');d.className='fact';const s=document.createElement('small');s.textContent='الأبعاد';
  const b=document.createElement('b');b.append('العرض: ');
  const ws=document.createElement('span');ws.dir='ltr';ws.textContent=bitmap.width;b.append(ws);
  b.append(document.createTextNode(' · الارتفاع: '));
  const hs=document.createElement('span');hs.dir='ltr';hs.textContent=bitmap.height;b.append(hs);
  d.append(s,b);facts.append(d)}
 {const d=document.createElement('div');d.className='fact wide';const s=document.createElement('small');s.textContent='SHA-256';
  const b=document.createElement('b');b.dir='ltr';b.textContent=hash;d.append(s,b);facts.append(d)}
 let ph=null;
 try{const s=Math.min(1,256/Math.max(bitmap.width,bitmap.height)),w=Math.max(1,Math.round(bitmap.width*s)),h=Math.max(1,Math.round(bitmap.height*s));
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(bitmap,0,0,w,h);
  ph=perceptualHashes(x.getImageData(0,0,w,h).data,w,h)}catch{}
 wrap.append(im,facts);summary.append(wrap);
 const analysis=await analyzeImage({file,bytes,bitmap,box:$('analysis'),say,isStale:()=>id!==generation,hashes:ph});
 if(id!==generation)return;
 if(analysis.cloneSignal)say('اكتمل الفحص المحلي مع مؤشر يستحق المراجعة: رُصد نمط تكرار مناطق في طبقة النسخ — قرينة فحص في الطبقات العميقة، لا حكم أصالة.');
 else say(analysis.warnings.length?'اكتمل الفحص المحلي مع ملاحظات. راجع كل مؤشر أمام الأصل؛ لا حكم أصالة.':'اكتمل الفحص المحلي. راجع كل مؤشر أمام الأصل؛ لا حكم أصالة.')}
 catch(e){if(id===generation)say('لم يكتمل الفحص: '+e.message)}
 finally{if(id===generation)$('run').disabled=false}};
addEventListener('pagehide',reset);
