import {validateCase} from '../journalist-core.js';
import {BACKEND_URL, AI_NOTICE, aiProviderName} from '../rag-config.js';
import {timelineCase,validateEvents} from './timeline-case-core.js';
import{dateCandidates,validDate}from'../journalist-core.js';
import{findConflicts,findGaps}from'./timeline-review-core.js';
const $=id=>document.getElementById(id),say=t=>$('status').textContent=t;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
let events=[],baseCase,caseInvalid=false,caseGeneration=0;
$('src').oninput=$('source-title').oninput=$('source-url').oninput=()=>{$('cands').replaceChildren();say('تغير مصدر الإدخال؛ أُلغيت المرشحات القديمة. الأحداث المضافة تحتفظ بمصادرها الأصلية.');};
$('case-file').onchange=async()=>{const g=++caseGeneration;caseInvalid=true;baseCase=undefined;try{const f=$('case-file').files[0];if(!f){caseInvalid=false;$('case-status').textContent='قضية جديدة';return}if(f.size>5000000)throw Error('حد القضية5ميجابايت');const v=validateCase(JSON.parse(await f.text()));if(g!==caseGeneration)return;baseCase=v;caseInvalid=false;$('case-status').textContent='قضية مفتوحة محليًا: '+v.title}catch(e){if(g===caseGeneration)$('case-status').textContent='لم تُفتح القضية: '+e.message}};
$('case-export').onclick=()=>{try{if(caseInvalid)throw Error('القضية غير صالحة أو لم يكتمل فتحها');download('journalist-timeline-case.json',timelineCase(events,baseCase));$('case-status').textContent='نُزلت نسخة جديدة؛ لم يتغير الأصل أو حالات المراجعة السابقة.'}catch(e){$('case-status').textContent='لم تُصدر القضية: '+e.message}};
function download(name,data){const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1500);}

function renderReview(){
 const box=$('review');if(!box)return;box.replaceChildren();
 const conflicts=findConflicts(events),gaps=findGaps(events);
 if(!conflicts.length&&!gaps.length){box.hidden=true;return}
 box.hidden=false;
 box.append(el('h3','مراجعة التعارضات والفجوات'));
 box.append(el('p','قواعد محلية تبرز ما يستحق المراجعة فقط؛ لا تحسم أي تاريخ ولا تثبت خطأ.','hint'));
 for(const c of conflicts){
  const card=el('div',undefined,'tl-conflict');
  card.append(el('p','تعارض محتمل: الوصف نفسه بتواريخ مختلفة ('+c.dates.join('، ')+')','tl-flag'));
  for(const it of c.items){const row=el('div',undefined,'tl-citem');row.append(el('span',it.date,'tl-dateval'),el('p',it.text));if(it.quote)row.append(el('blockquote',it.quote));card.append(row)}
  box.append(card)}
 for(const g of gaps){
  const card=el('div',undefined,'tl-gap');
  card.append(el('p','فجوة زمنية: '+g.days+' يومًا بين '+g.from+' و '+g.to+' - تحقق من أحداث غير موثقة بينهما.','tl-flag'));
  card.append(el('p','قبل: '+g.fromText));card.append(el('p','بعد: '+g.toText));
  box.append(card)}}
function renderAxis(){$('case-export').disabled=!events.length;
 const ax=$('axis');ax.replaceChildren();$('detail').hidden=true;renderReview();
 const dated=events.filter(e=>e.date).sort((a,b)=>a.date.localeCompare(b.date));
 const undated=events.filter(e=>!e.date);
 const uw=$('undated');uw.replaceChildren();
 if(undated.length){uw.append(el('h3','مسار غير محسوم ('+undated.length+')'));
  for(const e of undated){const c=el('div',undefined,'tl-cand');
   c.append(el('blockquote',e.quote||''),el('p',e.text),el('p','التعبير كما ورد: '+e.raw,'hint'));
   const d=el('input');d.type='text';d.dir='ltr';d.placeholder='YYYY-MM-DD';d.setAttribute('aria-label','حسم تاريخ الحدث');
   const b=el('button','احسم التاريخ',);b.onclick=()=>{if(!validDate(d.value)){say('أدخل يومًا صالحًا بصيغة YYYY-MM-DD');return}e.date=d.value;renderAxis();say('حُسم التاريخ وأضيف إلى المحور.')};
   const del=el('button','احذف');del.onclick=()=>{events=events.filter(x=>x!==e);renderAxis()};
   c.append(d,b,del);uw.append(c)}}
 if(!dated.length){ax.append(el('p','لا أحداث بتاريخ مدخل بعد. راجع المرشحات أو أضف حدثًا يدويًا.','hint'));$('export').disabled=!events.length;return}
 const W=900,H=170,PAD=60,min=dated[0].date,max=dated[dated.length-1].date;
 const span=Math.max(1,Date.parse(max)-Date.parse(min));
 const x=d=>PAD+(1-(Date.parse(d)-Date.parse(min))/span)*(W-2*PAD);
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
 svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('role','img');svg.setAttribute('aria-label','محور زمني للتواريخ المدخلة');
 const line=document.createElementNS(ns,'line');
 for(const[k,v]of Object.entries({x1:PAD,x2:W-PAD,y1:96,y2:96,stroke:'#d42c22','stroke-width':2}))line.setAttribute(k,v);
 svg.append(line);
 const ticks=new Set([min,max]);
 const days=span/86400000,step=days>730?365:days>120?30:days>14?7:1;
 for(let t=Date.parse(min);t<=Date.parse(max);t+=step*86400000)ticks.add(new Date(t).toISOString().slice(0,10));
 // collision filter: drop labels whose x positions are too close (RTL axis, ~72px min gap)
 const MIN_GAP=72, placed=[];
 const sorted=[...ticks].sort((a,b)=>Date.parse(a)-Date.parse(b));
 const kept=sorted.filter(t=>{const px=x(t);if(placed.some(q=>Math.abs(q-px)<MIN_GAP))return false;placed.push(px);return true});
 // min and max always kept: evict any stepped tick colliding with them
 for(const t of[min,max])if(!kept.includes(t)){const px=x(t);for(let k=kept.length-1;k>=0;k--)if(Math.abs(x(kept[k])-px)<MIN_GAP)kept.splice(k,1);kept.push(t)}
 for(const t of kept){const tx=document.createElementNS(ns,'text');tx.setAttribute('x',x(t));tx.setAttribute('y',122);tx.setAttribute('text-anchor','middle');tx.setAttribute('class','tl-tick');tx.textContent=t;svg.append(tx);
  const tl=document.createElementNS(ns,'line');for(const[k,v]of Object.entries({x1:x(t),x2:x(t),y1:92,y2:100,stroke:'#b9aca2'}))tl.setAttribute(k,v);svg.append(tl)}
 dated.forEach((e,i)=>{const cx=x(e.date),up=i%2===0,cy=up?60:150;
  const g=document.createElementNS(ns,'g');g.setAttribute('class','tl-mark');g.setAttribute('tabindex','0');g.setAttribute('role','button');g.setAttribute('aria-label',e.text);
  const stem=document.createElementNS(ns,'line');for(const[k,v]of Object.entries({x1:cx,x2:cx,y1:up?cy+16:96,y2:up?96:cy-6,stroke:'#b9aca2'}))stem.setAttribute(k,v);
  const c=document.createElementNS(ns,'circle');c.setAttribute('cx',cx);c.setAttribute('cy',96);c.setAttribute('r',6);
  const t=document.createElementNS(ns,'text');t.setAttribute('x',cx);t.setAttribute('y',cy);t.setAttribute('text-anchor','middle');
  t.textContent=e.date;
  const hit=document.createElementNS(ns,'rect');
  for(const[k,v]of Object.entries({x:cx-22,y:up?cy-14:96-14,width:44,height:110,fill:'transparent'}))hit.setAttribute(k,v);
  g.append(hit,stem,c,t);g.addEventListener('click',()=>showDetail(e));g.addEventListener('keydown',ev=>{if(ev.key==='Enter')showDetail(e)});
  svg.append(g)});
 ax.append(svg);$('export').disabled=false}
function showDetail(e){const d=$('detail');d.hidden=false;d.replaceChildren();
 d.append(el('h3',e.text),el('p',undefined),);
 const dv=el('span',e.date||'غير محسوم','tl-dateval');d.children[1].append('التاريخ: ',dv);
 if(e.quote)d.append(el('blockquote',e.quote));
 if(e.raw)d.append(el('p','التعبير كما ورد: '+e.raw,'hint'));
 const nd=el('input');nd.type='text';nd.dir='ltr';nd.value=e.date||'';nd.setAttribute('aria-label','تعديل التاريخ');
 const nt=el('input');nt.type='text';nt.value=e.text;nt.maxLength=500;nt.setAttribute('aria-label','تعديل وصف الحدث');
 const save=el('button','احفظ التعديل');save.onclick=()=>{if(nd.value&&!validDate(nd.value)){say('التاريخ المعدل غير صالح');return}e.date=nd.value;e.text=nt.value.trim()||e.text;renderAxis();showDetail(e);say('حُفظ التعديل محليًا.')};
 const del=el('button','احذف الحدث');del.onclick=()=>{events=events.filter(x=>x!==e);renderAxis();say('حُذف الحدث من هذه الجلسة.')};
 const review=document.createElement('select');review.setAttribute('aria-label','مراجعة الحدث');for(const[v,t]of[['unreviewed','لم أراجع'],['accepted','راجعت وقبلت السجل'],['rejected','رفضت السجل']]){const o=el('option',t);o.value=v;review.append(o)}review.value=e.review||'unreviewed';review.onchange=()=>e.review=review.value;
 const note=el('textarea');note.setAttribute('aria-label','ملاحظات الحدث');note.placeholder='مصدر الحسم وحدود المراجعة';note.maxLength=5000;note.value=e.note||'';note.oninput=()=>e.note=note.value;
 d.append(nd,nt,save,del,review,note)}
$('detect').onclick=()=>{const text=$('src').value;if(!text){say('الصق نصًا أولًا.');return}
 let cands;try{cands=dateCandidates(text)}catch(e){say(e.message);return}
 if(cands.length>150){say('أكثر من 150 مقطعًا؛ قسّم النص إلى جزء أصغر.');return}
 const source={id:crypto.randomUUID(),text,title:$('source-title').value||'مصدر الخط الزمني',url:$('source-url').value};const box=$('cands');box.replaceChildren();
 if(!cands.length){say('لم يُرصد نمط تاريخ معروف. يمكنك إضافة حدث يدويًا أدناه.');return}
 for(const x of cands){const c=el('div',undefined,'tl-cand');
  c.append(el('blockquote',x.quote),el('p','التاريخ كما ورد: '+x.date+' · '+x.ambiguity,'hint'));
  const d=el('input');d.type='text';d.dir='ltr';d.value=x.sortDate;d.placeholder='YYYY-MM-DD';d.setAttribute('aria-label','تاريخ ISO مؤكد');
  const ev=el('input');ev.type='text';ev.maxLength=500;ev.placeholder='الحدث كما فهمته، مع النفي ونسبة القول';ev.setAttribute('aria-label','وصف الحدث');
  const b=el('button','أضف للخط');b.onclick=()=>{if(d.value&&!validDate(d.value)){say('التاريخ ليس يومًا صالحًا بصيغة YYYY-MM-DD');return}
   events.push({date:d.value,text:ev.value.trim()||x.quote.slice(0,120),quote:x.quote,raw:x.date,source,anchor:{start:x.start,end:x.end},review:'unreviewed',note:''});
   c.remove();renderAxis();say('أضيف الحدث. '+(events.length)+' حدثًا في هذه الجلسة.')};
  c.append(d,ev,b);box.append(c)}
 say(cands.length+' مرشحًا للمراجعة. لا تحويل آلي للتواريخ النسبية.')};
$('m-add').onclick=()=>{const d=$('m-date').value.trim(),t=$('m-event').value.trim();
 if(d&&!validDate(d)){say('تاريخ غير صالح');return}
 if(!t){say('اكتب وصف الحدث');return}
 events.push({date:d,text:t,quote:'',raw:d||'يدوي'});$('m-date').value='';$('m-event').value='';renderAxis();say('أضيف الحدث اليدوي.')};
$('export').onclick=()=>{if(!events.length)return;
 const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify({format:'timeline-events-v1',events,limitations:'Dates are human-confirmed entries; relative expressions left unresolved by choice. No automatic date conversion.',reviewState:'manual-review-required'},null,2)],{type:'application/json'}));
 a.href=u;a.download='timeline-events.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)};
let importGeneration=0;
$('import').onchange=async()=>{const generation=++importGeneration;const f=$('import').files[0];if(!f)return;
 try{if(f.size>5000000)throw Error('حد الملف5ميجابايت');const raw=JSON.parse(await f.text());
  const checked=validateEvents(raw);if(generation!==importGeneration)return;events=checked;
  renderAxis();say('استُعيد '+events.length+' حدثًا من الملف.')}catch(e){if(generation!==importGeneration)return;say('تعذر الاستيراد: '+e.message)}};
renderAxis();

// AI event extraction (user-requested 2026-10-30): the pasted text goes to the guide's worker,
// which calls Gemini and returns only events anchored to a verbatim quote from the source. The
// local date detector above stays untouched. Results are review aids, not verified facts;
// unavailable states are shown, never filled in.
async function aiExtractEvents(){
 const text=$('src').value.trim();
 if(text.length<20){say('الصق نصًا لا يقل عن 20 حرفًا أولًا.');return}
 const btn=$('ai-extract');btn.disabled=true;
 say('يستخرج الذكاء الاصطناعي الأحداث من النص…');
 try{
  const r=await fetch(BACKEND_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'extract_events',text:text.slice(0,12000)})});
  const j=r.ok?await r.json():null;
  const ev=j&&j.events;
  if(!Array.isArray(ev)){say('الاستخراج بالذكاء الاصطناعي غير متاح الآن؛ جرّب لاحقًا أو استخدم الرصد المحلي.');return}
  const box=$('ai-list');box.replaceChildren();
  box.append(el('p',aiProviderName(j&&j.provider),'en-provider'));
  if(!ev.length){box.append(el('p','لم يجد النموذج أحداثًا مؤكدة في النص.'))}
  for(const e of ev){
   const card=el('div',undefined,'record');
   const chip=el('span',e.date||e.date_raw||'غير مؤرخ','en-chip');
   card.append(chip,el('p',e.event));
   const q=el('blockquote',e.quote);card.append(q);
   box.append(card)}
  $('ai-notice').textContent=AI_NOTICE;
  $('ai-result').hidden=false;
  say('اكتمل الاستخراج بالذكاء الاصطناعي؛ راجع الأحداث قبل اعتمادها.')}
 catch{say('تعذر الوصول إلى خدمة الذكاء الاصطناعي؛ الرصد المحلي ما زال متاحًا.')}
 finally{btn.disabled=false}}
$('ai-extract').onclick=aiExtractEvents;
