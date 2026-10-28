import{validateCase}from'../journalist-core.js';
import{imageCase}from'./image-case-core.js';
import{analyzeImage}from'./image-analysis.js';
import{perceptualHashes}from'./image-analysis-core.js';
const $=id=>document.getElementById(id),say=t=>$('status').textContent=t;
let generation=0,file=null,bitmap=null,url=null,bytes=null,hash='',observation=null,caseBase=null,caseState='empty',caseGeneration=0;
async function fingerprint(f){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await f.arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join('')}
function reset(){observation=null;$('case-export').disabled=true;$('raw-export').disabled=true;$('source-title').value='';$('source-url').value='';$('human-review').value='unreviewed';$('review-note').value='';generation++;if(url)URL.revokeObjectURL(url);url=null;file=null;bitmap=null;bytes=null;hash='';$('preview').hidden=true;$('preview').removeAttribute('src');$('run').disabled=true;$('clear').hidden=true;$('analysis').replaceChildren();$('ia-summary').hidden=true;$('ia-summary').replaceChildren()}
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
$('run').onclick=async()=>{if(!file)return;observation=null;$('case-export').disabled=true;$('raw-export').disabled=true;$('human-review').value='unreviewed';const id=generation;$('run').disabled=true;
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
 observation={file:{name:file.name,bytes:file.size,mime:file.type,sha256:hash,width:bitmap.width,height:bitmap.height},perceptualHashes:ph,analysis,scope:'initial local analysis, not forensic authentication; interactive display edits not logged'};$('case-export').disabled=false;$('raw-export').disabled=false;
 if(analysis.cloneSignal)say('اكتمل الفحص المحلي مع مؤشر يستحق المراجعة: رُصد نمط تكرار مناطق في طبقة النسخ — قرينة فحص في الطبقات العميقة، لا حكم أصالة.');
 else say(analysis.warnings.length?'اكتمل الفحص المحلي مع ملاحظات. راجع كل مؤشر أمام الأصل؛ لا حكم أصالة.':'اكتمل الفحص المحلي. راجع كل مؤشر أمام الأصل؛ لا حكم أصالة.')}
 catch(e){if(id===generation)say('لم يكتمل الفحص: '+e.message)}
 finally{if(id===generation)$('run').disabled=false}};
addEventListener('pagehide',reset);

function context(){return{title:$('source-title').value,url:$('source-url').value,review:$('human-review').value,note:$('review-note').value}}
function download(value,name){const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)}
$('raw-export').onclick=()=>{if(observation)download({format:'image-local-observation-v1',observation,review:context()},'image-observation.json')};
$('case-file').onchange=async()=>{const gen=++caseGeneration;caseBase=null;caseState='pending';$('case-status').textContent='تُقرأ القضية…';try{const f=$('case-file').files[0];if(!f){caseState='empty';$('case-status').textContent='ستنشأ نسخة قضية جديدة.';return}if(f.size>5*1024*1024)throw Error('أكبر من 5 MB');const text=await f.text();if(gen!==caseGeneration)return;caseBase=validateCase(JSON.parse(text));caseState='valid';$('case-status').textContent='قضية مفتوحة: '+caseBase.title}catch(e){if(gen!==caseGeneration)return;caseState='invalid';$('case-status').textContent='قضية غير صالحة: '+e.message}};
$('case-clear').onclick=()=>{caseGeneration++;caseBase=null;caseState='empty';$('case-file').value='';$('case-status').textContent='ستنشأ نسخة قضية جديدة.'};
$('case-export').onclick=()=>{if(!observation)return;try{if(['pending','invalid'].includes(caseState))throw Error('انتظر قراءة القضية أو أزل الملف غير الصالح');download(imageCase(observation,context(),caseBase||undefined),'image-case.json');$('case-status').textContent='نُزّلت نسخة جديدة؛ احتفظ بملفك السابق وبأصل الصورة.'}catch(e){$('case-status').textContent='لم تصدّر القضية: '+e.message+'؛ التصدير الأصلي الكامل ما زال متاحًا.'}};
