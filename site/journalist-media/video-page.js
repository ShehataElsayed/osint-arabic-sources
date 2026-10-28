import{sampleTimes,stamp,outputSize}from'./video-core.js';
const $=id=>document.getElementById(id),say=t=>$('status').textContent=t;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
const L=v=>'⁦'+v+'⁩';
let generation=0,url=null,record=null,frameShots=[];
async function fingerprint(file){return[...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join('')}
function event(v,type){return new Promise((resolve,reject)=>{let timer;const cleanup=()=>{clearTimeout(timer);v.removeEventListener(type,done);v.removeEventListener('error',bad)};const done=()=>{cleanup();resolve()},bad=()=>{cleanup();reject(Error('تعذر فك الفيديو أو الانتقال داخله'))};v.addEventListener(type,done,{once:true});v.addEventListener('error',bad,{once:true});timer=setTimeout(bad,15000)})}
function reset(){frameShots=[];$('ocr-run').disabled=true;$('ocr-box').hidden=true;$('ocr-list').replaceChildren();$('ocr-filter').value='';generation++;if(url)URL.revokeObjectURL(url);url=null;record=null;$('preview').replaceChildren();$('frames').replaceChildren();$('meta').hidden=true;$('meta').textContent='';$('notes-box').hidden=true;$('notes').value='';$('run').disabled=true;$('save').disabled=true}
$('clear').onclick=()=>{reset();$('file').value='';$('clear').hidden=true;say('مُسح الملف من الواجهة. لم يُرفع الملف.')};
$('file').onchange=async()=>{reset();const f=$('file').files[0];if(!f)return;
 if(!/^video\/(mp4|webm)$/.test(f.type)||f.size>100*1024*1024){say('اختر MP4 أو WebM حتى 100 ميجابايت.');return}
 const id=generation;try{say('حساب بصمة الملف محليًا…');
  const hash=await fingerprint(f);if(id!==generation)return;
  record={name:f.name,bytes:f.size,mime:f.type,sha256:hash,extraction:'not-run'};
  url=URL.createObjectURL(f);
  const v=el('video');v.controls=true;v.preload='metadata';v.src=url;$('preview').append(v);
  $('meta').hidden=false;$('meta').textContent=`اسم الملف: ${L(f.name)}\nالحجم: ${L(f.size+' بايت')}\nSHA-256: ${L(hash)}`;
  $('run').disabled=false;$('clear').hidden=false;
  say('الملف جاهز. البصمة تربط السجل بالملف ولا تثبت أصالته.')}catch(e){say(e.message)}};
$('run').onclick=async()=>{if(!record||!url)return;const id=generation;$('run').disabled=true;$('file').disabled=true;
 try{const v=$('preview').querySelector('video');
  if(v.readyState<1)await event(v,'loadedmetadata');if(id!==generation)return;
  const times=sampleTimes(v.duration,4),[w,h]=outputSize(v.videoWidth,v.videoHeight);
  $('frames').replaceChildren();const frames=[];
  for(const time of times){if(id!==generation)return;
   const seekPosition=time===0?Math.min(.001,v.duration/10):time;
   if(Math.abs(v.currentTime-seekPosition)>.00001){const seek=event(v,'seeked');v.currentTime=seekPosition;await seek}
   if(v.readyState<2)await event(v,'loadeddata');if(id!==generation)return;
   const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(v,0,0,w,h);
   const img=el('img');img.src=c.toDataURL('image/jpeg',.9);img.alt='لقطة عند '+stamp(v.currentTime);
   const fig=el('figure'),cap=el('figcaption');cap.textContent=img.alt+' من بداية الملف';
   const position=v.currentTime;
   const dl=el('button','نزّل اللقطة');dl.onclick=()=>{const a=document.createElement('a');a.href=img.src;a.download=`frame-${Math.round(position*1000)}.jpg`;a.click()};
   fig.append(img,cap,dl);$('frames').append(fig);
   frames.push({requestedSeconds:time,browserPositionSeconds:position,width:w,height:h});
   frameShots.push({src:img.src,stamp:stamp(position)})}
  record={...record,extraction:'browser-temporal-sampling',duration:v.duration,frames,
   limitations:'Approximate browser offsets, not capture dates or forensic frame precision. No audio/vision analysis. Short events can be missed.'};
  $('notes-box').hidden=false;$('save').disabled=false;
  if(typeof Tesseract!=='undefined')$('ocr-run').disabled=false;
  say('اكتملت اللقطات الأربع محليًا. راجعها أمام الأصل ودوّن ملاحظاتك؛ هذا ليس تحليل رؤية ولا حكم أصالة.')}
 catch(e){if(id===generation)say('لم يكتمل الاستخراج: '+e.message)}
 finally{if(id===generation){$('file').disabled=false;$('run').disabled=false}}};
let ocrIndex=null;
$('ocr-run').onclick=async()=>{if(!frameShots.length||typeof Tesseract==='undefined')return;
 $('ocr-run').disabled=true;$('file').disabled=true;
 try{say('استخراج نص اللقطات محليًا… قد يستغرق دقيقة.');
  const worker=await Tesseract.createWorker(['ara','eng'],Tesseract.OEM.DEFAULT,{workerPath:'./journalist-media/ocr/worker.min.js',corePath:'./journalist-media/ocr/',langPath:'./tessdata',gzip:true,workerBlobURL:false});
  const out=[];
  for(const f of frameShots){const r=await worker.recognize(f.src);const text=(r&&r.data&&r.data.text||'').trim();out.push({time:f.stamp,text})}
  await worker.terminate();
  ocrIndex=out;
  const list=$('ocr-list');list.replaceChildren();
  out.forEach((o,i)=>{const d=el('div',undefined,'vf-ocr');d.append(el('b','لقطة '+o.stamp),el('pre',o.text||'(لا نص مقروء في اللقطة)'));d.dataset.idx=i;list.append(d)});
  $('ocr-box').hidden=false;
  record={...record,ocrIndex:{engine:'tesseract.js local, ara+eng',caveat:'engine output unverified - review each line against its frame',frames:out}};
  $('save').disabled=false;
  say('اكتمل فهرس نص اللقطات. النص مستخرج آليًا وعرضة للخطأ؛ راجعه أمام اللقطات.')}
 catch(e){say('تعذر استخراج نص اللقطات: '+e.message)}
 finally{$('ocr-run').disabled=false;$('file').disabled=false}};
$('ocr-filter').oninput=()=>{const q=$('ocr-filter').value.trim();
 for(const d of $('ocr-list').children){const o=(ocrIndex||[])[+d.dataset.idx];d.hidden=!!q&&!(o&&(o.text.includes(q)||o.time.includes(q)))}};
$('save').onclick=()=>{if(!record)return;
 const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify({format:'video-frames-record-v1',source:record,humanNotes:$('notes').value,reviewState:'manual-review-required'},null,2)],{type:'application/json'}));
 a.href=u;a.download='video-frames-record.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)};
addEventListener('pagehide',reset)
