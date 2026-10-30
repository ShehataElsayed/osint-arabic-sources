import{validateCase}from'../journalist-core.js';
import { BACKEND_URL, aiProviderName } from '../rag-config.js';
import{videoCase}from'./video-case-core.js';
import{sampleTimes,stamp,outputSize,candidateTimes,meanAbsDiff,pickSceneIndices}from'./video-core.js';
const $=id=>document.getElementById(id),say=t=>$('status').textContent=t;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
const L=v=>'⁦'+v+'⁩';
let generation=0,url=null,record=null,frameShots=[],ocrIndex=null,reviews=[],caseBase=null,caseState='empty',caseGeneration=0;
async function fingerprint(file){return[...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join('')}
function event(v,type){return new Promise((resolve,reject)=>{let timer;const cleanup=()=>{clearTimeout(timer);v.removeEventListener(type,done);v.removeEventListener('error',bad)};const done=()=>{cleanup();resolve()},bad=()=>{cleanup();reject(Error('تعذر فك الفيديو أو الانتقال داخله'))};v.addEventListener(type,done,{once:true});v.addEventListener('error',bad,{once:true});timer=setTimeout(bad,15000)})}
function reset(){$('source-title').value='';$('source-url').value='';reviews=[];ocrIndex=null;$('case-export').disabled=true;frameShots=[];$('ocr-run').disabled=true;$('ocr-box').hidden=true;$('ocr-list').replaceChildren();$('ocr-filter').value='';generation++;if(url)URL.revokeObjectURL(url);url=null;record=null;$('preview').replaceChildren();$('frames').replaceChildren();$('meta').hidden=true;$('meta').textContent='';$('vf-result').hidden=true;$('vf-result').replaceChildren();$('notes-box').hidden=true;$('notes').value='';$('run').disabled=true;$('save').disabled=true}
$('clear').onclick=()=>{reset();$('file').value='';$('clear').hidden=true;say('مُسح الملف من الواجهة. لم يُرفع الملف.')};
async function accept(f){reset();if(!f)return;
 if(!/^video\/(mp4|webm)$/.test(f.type)||f.size>100*1024*1024){say('اختر MP4 أو WebM حتى 100 ميجابايت.');return}
 const probe=document.createElement('video');if(f.type&&probe.canPlayType(f.type)===''){say('صيغة الحاوية '+L(f.type)+' غير مدعومة في هذا المتصفح. جرّب متصفحًا آخر أو حوّل الملف إلى MP4 بترميز H.264 ثم أعد المحاولة.');return}
 const id=generation;try{say('حساب بصمة الملف محليًا…');
  const hash=await fingerprint(f);if(id!==generation)return;
  record={name:f.name,bytes:f.size,mime:f.type,sha256:hash,extraction:'not-run'};
  url=URL.createObjectURL(f);
  const v=el('video');v.controls=true;v.preload='auto';v.src=url;$('preview').append(v);
  $('meta').hidden=false;$('meta').textContent=`اسم الملف: ${L(f.name)}\nالحجم: ${L(f.size+' بايت')}\nSHA-256: ${L(hash)}`;
  $('run').disabled=false;$('clear').hidden=false;
  say('الملف جاهز. البصمة تربط السجل بالملف ولا تثبت أصالته.')}catch(e){say(e.message)}}
$('file').onchange=()=>accept($('file').files&&$('file').files[0]);
$('drop').ondragover=e=>{e.preventDefault()};$('drop').ondrop=e=>{e.preventDefault();accept(e.dataTransfer.files&&e.dataTransfer.files[0])};

async function seekTo(v,position){if(Math.abs(v.currentTime-position)>.00001){const s=event(v,'seeked');v.currentTime=position;await s}if(v.readyState<2)await event(v,'loadeddata')}

// عينة إضاءة صغيرة لمقارنة المشاهد: ليست لقطة عرض ولا تصلح دليلًا بذاتها
function lumaSample(v){const w=64,h=36,c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(v,0,0,w,h);const d=x.getImageData(0,0,w,h).data,out=new Float32Array(w*h);for(let i=0;i<w*h;i++)out[i]=d[i*4]*.2126+d[i*4+1]*.7152+d[i*4+2]*.0722;return out}

async function sceneTimes(v,id,count){const times=candidateTimes(v.duration),thumbs=[];
 for(let i=0;i<times.length;i++){if(id!==generation)return null;
  say(`مسح تغيّر المشهد: عينة ${L(i+1)} من ${L(times.length)}…`);
  await seekTo(v,times[i]===0?Math.min(.001,v.duration/10):times[i]);
  thumbs.push(lumaSample(v))}
 const scores=[0];for(let i=1;i<thumbs.length;i++)scores.push(meanAbsDiff(thumbs[i-1],thumbs[i]));
 const picked=pickSceneIndices(scores,count);
 return{times:picked.map(p=>times[p.index]),scores:picked.map(p=>scores[p.index]),kinds:picked.map(p=>p.kind)}}


function resultCard(rows){const c=el('div',undefined,'layer-result');
 for(const[label,parts,cls]of rows){const p=el('p',undefined,cls);p.append(el('span',label));for(const part of parts){if(typeof part==='string')p.append(document.createTextNode(part));else p.append(part)}c.append(p)}return c}
const ltr=text=>{const s=el('span',text);s.dir='ltr';return s};

$('run').onclick=async()=>{if(!record||!url)return;const id=++generation;$('run').disabled=true;$('file').disabled=true;
 try{reviews=[];$('case-export').disabled=true;$('save').disabled=true;frameShots=[];ocrIndex=null;$('ocr-box').hidden=true;$('ocr-list').replaceChildren();$('ocr-filter').value='';$('ocr-run').disabled=true;$('vf-result').hidden=true;$('vf-result').replaceChildren();delete record.ocrIndex;
  const v=$('preview').querySelector('video');
  if(v.readyState<1)await event(v,'loadedmetadata');if(id!==generation)return;
  const count=+$('vf-count').value,mode=$('vf-mode').value,[w,h]=outputSize(v.videoWidth,v.videoHeight);
  let times,scores=null;
  let kinds=null;
  if(mode==='scene'){const r=await sceneTimes(v,id,count);if(!r||id!==generation)return;times=r.times;scores=r.scores;kinds=r.kinds}
  else times=sampleTimes(v.duration,count);
  $('frames').replaceChildren();const frames=[];
  for(let k=0;k<times.length;k++){if(id!==generation)return;
   say(`استخراج اللقطات: ${L(k+1)} من ${L(times.length)}…`);
   await seekTo(v,times[k]===0?Math.min(.001,v.duration/10):times[k]);if(id!==generation)return;
   const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(v,0,0,w,h);
   const img=el('img');img.src=c.toDataURL('image/jpeg',.9);img.alt='لقطة عند '+stamp(v.currentTime);
   const fig=el('figure'),cap=el('figcaption');cap.textContent=img.alt+' من بداية الملف'+(kinds?(kinds[k]==='change'?' · تغيّر مرصود · درجة '+scores[k].toFixed(1):(k===0?' · لقطة البداية المرجعية':' · لقطة زمنية تكميلية')):'');
   const position=v.currentTime;
   const dl=el('button','نزّل اللقطة');dl.onclick=()=>{const a=document.createElement('a');a.href=img.src;a.download=`frame-${Math.round(position*1000)}.jpg`;a.click()};
   const review=el('select');review.setAttribute('aria-label','مراجعة اللقطة '+(k+1));for(const[v,t]of[['unreviewed','لم تراجع'],['accepted','قُبلت بعد المراجعة'],['rejected','مرفوضة']]){const o=el('option',t);o.value=v;review.append(o)}const note=el('textarea');note.rows=2;note.maxLength=2000;note.placeholder='ملاحظات أمام الأصل';note.setAttribute('aria-label','ملاحظات اللقطة '+(k+1));reviews[k]={review:'unreviewed',note:''};review.onchange=()=>reviews[k].review=review.value;note.oninput=()=>reviews[k].note=note.value;fig.append(img,cap,dl,review,note);
   if(window.OshaiReverseSearch){ // per-frame explicit-consent reverse search (two-press; no upload otherwise)
    const rs=el('button','ابحث عكسيًا عن هذه اللقطة','rs-btn');const rsStatus=el('p','','rs-status');const rsResults=el('div','','rs-results');
    window.OshaiReverseSearch.initReverseSearch({canvas:c,btn:rs,status:rsStatus,results:rsResults});
    fig.append(rs,rsStatus,rsResults)}
   $('frames').append(fig);
   const entry={requestedSeconds:times[k],browserPositionSeconds:position,width:w,height:h};
   if(kinds){entry.sceneScore=+scores[k].toFixed(2);entry.kind=kinds[k]==='change'?'scene-change':'temporal-fill'}
   frames.push(entry);
   frameShots.push({src:img.src,stamp:stamp(position)})}
  if(id!==generation)return;
  record={...record,extraction:mode==='scene'?'browser-scene-change-keyframes':'browser-temporal-sampling',extractionMode:mode==='scene'?'scene-change':'even',requestedCount:count,duration:v.duration,frames,
   limitations:mode==='scene'?'Scene points picked by a statistical luma-difference sweep; important changes can be missed and incidental changes surfaced. Approximate browser offsets, not capture dates or forensic frame precision. No audio/vision analysis.':'Approximate browser offsets, not capture dates or forensic frame precision. No audio/vision analysis. Short events can be missed.'};
  // بطاقة النتيجة المهنية
  const box=$('vf-result');box.replaceChildren();
  const noun=frames.length===2?'لقطتان':frames.length<=10?'لقطات':'لقطة';
  const changeCount=kinds?kinds.filter(x=>x==='change').length:0;
  const obs=['استُخرجت ',ltr(String(frames.length)),' '+noun+' '+(mode==='scene'?'بأسلوب نقاط تغيّر المشهد':'بتوزيع زمني متساوٍ')+' من فيديو مدته ',ltr(stamp(v.duration)),' بدقة ',ltr(w+'×'+h),'، وتغطي من ',ltr(stamp(frames[0].browserPositionSeconds)),' إلى ',ltr(stamp(frames[frames.length-1].browserPositionSeconds)),' من بداية الملف.'];
  if(mode==='scene')obs.push(' منها ',ltr(String(changeCount)),' عند تغيّرات مرصودة فعلًا، و',ltr(String(frames.length-changeCount)),' لقطات زمنية تكميلية لاكتمال العدد المطلوب (موسومة بذلك أسفل كل لقطة).');
  const coreLimit='مواضع اللقطات تقريبية كما يقرؤها المتصفح وليست توقيت التقاط؛ لا تحليل رؤية ولا حكم أصالة.';
  const sig=['الأحداث القصيرة بين اللقطات قد تفوت، والمواضع ليست دقة جنائية بالإطار.'];
  if(mode==='scene')sig.push(' اختيار نقاط التغيير إحصائي (فرق الإضاءة بين عينات متقاربة): قد يفوّت تغيّرات مهمة وقد يبرز تغيّرات عرضية كالوميض أو الحركة السريعة؛ اللقطات الزمنية التكميلية ليست تغيّرات مرصودة.');
  const step=['راجع كل لقطة أمام الأصل ودوّن ملاحظاتك، ونزّل ما يهمك وابحث عنه عكسيًا لدى ',link('Google Lens','https://lens.google.com/'),' أو ',link('TinEye','https://tineye.com/'),' أو ',link('Yandex Images','https://yandex.com/images/'),' (الرفع يدوي هناك؛ الملف لا يغادر جهازك من هذه الصفحة). استخرج فهرس نص اللقطات عند الحاجة، ثم نزّل سجل JSON لتوثيق المراجعة.'];
  const card=resultCard([['الملاحظة',obs,'obs'],['حدود أساسية',[coreLimit],'sig']]);
  const det=document.createElement('details');det.className='vf-more';if(matchMedia('(min-width:700px)').matches)det.open=true;
  const sum=document.createElement('summary');sum.textContent='التفاصيل وخطوة التحقق';det.append(sum,resultCard([['الدلالة والحدود',sig,'sig'],['خطوة التحقق',step,'next']]));
  card.append(det);box.append(card);box.hidden=false;
  $('notes-box').hidden=false;$('save').disabled=false;$('case-export').disabled=false;
  if(typeof Tesseract!=='undefined')$('ocr-run').disabled=false;
  say('اكتمل استخراج '+L(String(frames.length))+' '+(frames.length===2?'لقطتان':frames.length<=10?'لقطات':'لقطة')+' محليًا. راجعها أمام الأصل ودوّن ملاحظاتك؛ هذا ليس تحليل رؤية ولا حكم أصالة.')}
 catch(e){if(id===generation)say('لم يكتمل الاستخراج: '+e.message)}
 finally{if(id===generation){$('file').disabled=false;$('run').disabled=false}}};

function link(text,href){const a=el('a',text);a.href=href;a.target='_blank';a.rel='noopener noreferrer';return a}

$('ocr-run').onclick=async()=>{if(!frameShots.length||typeof Tesseract==='undefined')return;
 const id=generation,sourceFrames=[...frameShots];$('run').disabled=true;$('case-export').disabled=true;$('save').disabled=true;$('ocr-run').disabled=true;$('file').disabled=true;
 try{say('استخراج نص اللقطات محليًا… قد يستغرق دقيقة.');
  const worker=await Tesseract.createWorker(['ara','eng'],Tesseract.OEM.DEFAULT,{workerPath:'./journalist-media/ocr/worker.min.js',corePath:'./journalist-media/ocr/',langPath:'./tessdata',gzip:true,workerBlobURL:false});
  const out=[];
  for(const f of sourceFrames){const r=await worker.recognize(f.src);const text=(r&&r.data&&r.data.text||'');out.push({time:f.stamp,text})}
  await worker.terminate();if(id!==generation)return;
  ocrIndex=out;reviews=reviews.map(r=>({...r,review:'unreviewed'}));for(const s of $('frames').querySelectorAll('select'))s.value='unreviewed';
  const list=$('ocr-list');list.replaceChildren();
  out.forEach((o,i)=>{const d=el('div',undefined,'vf-ocr');d.append(el('b','لقطة '+o.stamp),el('pre',o.text||'(لا نص مقروء في اللقطة)'));d.dataset.idx=i;list.append(d)});
  $('ocr-box').hidden=false;
  record={...record,ocrIndex:{engine:'tesseract.js local, ara+eng',caveat:'engine output unverified - review each line against its frame',frames:out}};
  $('save').disabled=false;
  say('اكتمل فهرس نص اللقطات. النص مستخرج آليًا وعرضة للخطأ؛ راجعه أمام اللقطات.')}
 catch(e){if(id!==generation)return;say('تعذر استخراج نص اللقطات: '+e.message)}
 finally{if(id===generation){$('ocr-run').disabled=false;$('file').disabled=false;$('run').disabled=false;$('case-export').disabled=!record?.frames?.length;$('save').disabled=!record?.frames?.length}}};
$('ocr-filter').oninput=()=>{const q=$('ocr-filter').value.trim();
 for(const d of $('ocr-list').children){const o=(ocrIndex||[])[+d.dataset.idx];d.hidden=!!q&&!(o&&(o.text.includes(q)||o.time.includes(q)))}};
$('save').onclick=()=>{if(!record)return;
 const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify({format:'video-frames-record-v1',source:record,humanNotes:$('notes').value,sourceTitle:$('source-title').value,sourceUrl:$('source-url').value,frameReviews:reviews,reviewState:'manual-review-required'},null,2)],{type:'application/json'}));
 a.href=u;a.download='video-frames-record.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)};
addEventListener('pagehide',reset)

$('case-file').onchange=async()=>{const gen=++caseGeneration;caseBase=null;caseState='pending';$('case-status').textContent='تُقرأ القضية…';try{const f=$('case-file').files[0];if(!f){caseState='empty';$('case-status').textContent='ستنشأ نسخة قضية جديدة.';return}if(f.size>5*1024*1024)throw Error('أكبر من 5 MB');const text=await f.text();if(gen!==caseGeneration)return;caseBase=validateCase(JSON.parse(text));caseState='valid';$('case-status').textContent='قضية مفتوحة: '+caseBase.title}catch(e){if(gen!==caseGeneration)return;caseState='invalid';$('case-status').textContent='قضية غير صالحة: '+e.message}};
$('case-clear').onclick=()=>{caseGeneration++;caseBase=null;caseState='empty';$('case-file').value='';$('case-status').textContent='ستنشأ نسخة قضية جديدة.'};
$('case-export').onclick=()=>{if(!record)return;try{if(['pending','invalid'].includes(caseState))throw Error('انتظر قراءة القضية أو أزل الملف غير الصالح');const out=videoCase(record,{title:$('source-title').value,url:$('source-url').value,note:$('notes').value},reviews,caseBase||undefined),u=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='video-case.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1500);$('case-status').textContent='نُزّلت نسخة جديدة؛ احتفظ بملفك السابق وبأصل الفيديو واللقطات.'}catch(e){$('case-status').textContent='لم تصدّر القضية: '+e.message+'؛ التصدير الأصلي الكامل ما زال متاحًا.'}};

function invalidateFrames(){generation++;reviews=[];frameShots=[];ocrIndex=null;if(record){delete record.frames;delete record.ocrIndex;record.extraction='not-run'}$('frames').replaceChildren();$('vf-result').hidden=true;$('ocr-box').hidden=true;$('notes-box').hidden=true;$('case-export').disabled=true;$('save').disabled=true;$('ocr-run').disabled=true;$('file').disabled=false;$('run').disabled=!record;say('تغير إعداد الاستخراج؛ استخرج اللقطات من جديد.')}
$('vf-count').onchange=invalidateFrames;$('vf-mode').onchange=invalidateFrames;

// AI explanation of the visible extraction results (2026-10-31 all-tools AI expansion, user
// «تمام ضيفه ف كل الأدوات»): extraction stays fully local; this optional section sends ONLY the
// visible result TEXT (never the video or frames) to the guide worker (summarize_text route,
// context 'video'). The worker guard blocks any authenticity/manipulation verdict; description only.
(function aiSummary(){
  const res0=document.getElementById('vf-result');
  new MutationObserver(()=>{const b=document.getElementById('ai-box'); if(b) b.hidden=res0.hidden; if(res0.hidden){const r=document.getElementById('ai-result'); if(r)r.hidden=true; const s=document.getElementById('ai-status'); if(s)s.textContent='';}}).observe(res0,{attributes:true,attributeFilter:['hidden']});
  const box=document.getElementById('ai-box'), btn=document.getElementById('ai-summarize'),
        st=document.getElementById('ai-status'), res=document.getElementById('ai-result'),
        prov=document.getElementById('ai-provider'), ov=document.getElementById('ai-overview'),
        qh=document.getElementById('ai-quotes-h'), ql=document.getElementById('ai-quotes');
  if(!box||!btn)return;
  btn.onclick=async()=>{
    const text=((document.getElementById('meta').innerText+'\n'+document.getElementById('vf-result').innerText)).slice(0,11000);
    if(text.trim().length<40){st.textContent='النتائج أقصر من أن تُشرح.';return}
    btn.disabled=true;res.hidden=true;st.textContent='جارٍ الشرح بالذكاء الاصطناعي…';
    try{
      const r=await fetch(BACKEND_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'summarize_text',text,context:'video'})});
      const j=r.ok?await r.json():null;
      const sm=j&&j.summary;
      if(!sm){st.textContent='الشرح بالذكاء الاصطناعي غير متاح الآن؛ نتائجك الكاملة ظاهرة أعلاه.';return}
      prov.textContent=aiProviderName(j&&j.provider);
      ov.textContent=sm.overview;
      ql.replaceChildren();
      if(Array.isArray(sm.key_quotes)&&sm.key_quotes.length){qh.hidden=false;for(const q of sm.key_quotes){const li=document.createElement('li');li.textContent=q;ql.append(li)}}else qh.hidden=true;
      res.hidden=false;
      st.textContent='اكتمل الشرح بالذكاء الاصطناعي؛ الملخص بصياغة النموذج وصفٌ للنتائج لا حكمٌ على الفيديو - راجعه أمام النتائج قبل الاعتماد عليه.'}
    catch{st.textContent='تعذر الوصول إلى خدمة الذكاء الاصطناعي؛ نتائجك الكاملة ظاهرة أعلاه.'}
    finally{btn.disabled=false}};
})();
