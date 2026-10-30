import {sentences,validateCase} from '../journalist-core.js';
import {BACKEND_URL, GEMINI_NOTICE} from '../rag-config.js';
import {claimsCase} from './claims-case-core.js';
import{missingEvidence}from'./claims-review-core.js';
const $=id=>document.getElementById(id),say=t=>$('status').textContent=t;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
const MAXS=400;
const ATTR=['قال','قالت','أعلن','أعلنت','زعم','زعمت','أكد','أكدت','ادعى','ادعت','صرح','صرحت','أشار','أشارت','ذكر','ذكرت','بحسب','وفقًا','طبقًا','نقلاً عن','نقلت','أوضح','أوضحت','أفاد','أفادت','كشف','كشفت','رجح','رجحت'];
const SUPER=['أسرع','أكبر','أصغر','أعلى','أدنى','أفضل','أسوأ','أكثر','أقل','الأول','الأولى','الأكبر','الأصغر','الأكثر','الأقل','الأسرع','الأعلى','الأدنى','الأفضل','الأسوأ','الوحيد','الوحيدة','دائمًا','أبدًا','مستحيل'];
const OPINION=['أرى','أعتقد','أظن','في رأيي','برأيي','يبدو لي','أتصور','شخصيًا','وجهة نظري'];
const COND=['إذا','لو','في حال','ما لم','قد','ربما','من المحتمل','يحتمل','لعل'];
const NEG=['لم','لن','ما','لا','ليس','ليست','دون','بدون','غير'];
const DIRECT=['تحقق','راجع','تأكد','احذر','قارن','وثق','وثّق','انظر','اسأل','ارجع','لا تنشر','لا تصدق','تجنب','انتبه'];
const MONTHS=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const AR='\\u0621-\\u064A\\u0671-\\u06D3';
const hasW=(s,w)=>new RegExp('(^|[^'+AR+'])'+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=$|[^'+AR+'])').test(s);
const has=(s,arr)=>arr.some(w=>hasW(s,w));
function signals(s){
 const out=[];
 if(/[0-9٠-٩۰-۹]/.test(s))out.push('أرقام');
 if(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(s)||/(عام|سنة)\s*[0-9٠-٩]{4}/.test(s)||MONTHS.some(m=>s.includes(m)))out.push('تاريخ أو زمن');
 if(/[«»"“”]/.test(s))out.push('اقتباس منقول');
 if(has(s,ATTR))out.push('نسبة قول إلى مصدر');
 if(has(s,SUPER))out.push('تفضيل أو تعميم مطلق');
 return out}
function context(s){
 const out=[];
 if(has(s,OPINION))out.push('رأي معلن');
 if(has(s,COND))out.push('صيغة افتراضية أو احتمالية');
 if(has(s,NEG))out.push('صيغة نفي');
 const first=s.trim().split(/\s+/)[0]||'';
 if(DIRECT.some(d=>s.trim().startsWith(d))||/^لا\s/.test(s.trim()))out.push('توجيه أو أمر');
 return out}
let last=null,view=[],baseCase,caseInvalid=false,caseGeneration=0;
function invalidate(){last=null;view=[];$('result').hidden=true;$('export').disabled=true;$('case-export').disabled=true;say('تغير المصدر؛ أُلغيت النتائج السابقة. أعد الترشيح قبل التنزيل.');}
for(const id of ['src','source-title','source-url'])$(id).oninput=invalidate;
$('case-file').onchange=async()=>{const generation=++caseGeneration;caseInvalid=true;baseCase=undefined;try{const f=$('case-file').files[0];if(!f){caseInvalid=false;return}if(f.size>5000000)throw Error('حد القضية5ميجابايت');const checked=validateCase(JSON.parse(await f.text()));if(generation!==caseGeneration)return;baseCase=checked;caseInvalid=false;$('case-status').textContent='قضية مفتوحة محليًا: '+baseCase.title;}catch(e){if(generation!==caseGeneration)return;$('case-status').textContent='لم تُفتح القضية: '+e.message;}};
$('case-export').onclick=()=>{try{if(caseInvalid)throw Error('القضية غير صالحة أو لم يكتمل فتحها');if(!last)throw Error('رشّح النص أولًا');const out=claimsCase(last,baseCase);download('journalist-claims-case.json',out);$('case-status').textContent='نُزلت نسخة جديدة. الأصل وحالات المراجعة السابقة لم تتغير.'}catch(e){$('case-status').textContent='لم تُصدر القضية: '+e.message+'؛ قائمة المراجعة الأصلية ما زالت متاحة.'}};
function download(name,data){const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1500);}
function render(){
 const showPlain=$('show-plain').checked;
 const box=$('claims');box.replaceChildren();
 let shown=0;
 for(const c of view){
  if(!c.candidate&&!showPlain)continue;
  const card=el('div',undefined,'cl-card'+(c.candidate?'':' cl-plain'));
  card.append(el('span','#'+(c.index+1),'cl-num'),el('blockquote',c.sentence));
  const chips=el('div',undefined,'cl-chips');
  for(const g of c.signals)chips.append(el('span',g,'cl-chip'));
  for(const g of c.context)chips.append(el('span',g,'cl-chip'));
  if(!c.candidate&&!c.context.includes('رأي معلن')&&!c.context.includes('توجيه أو أمر'))chips.append(el('span','لا إشارة تحقق ظاهرة','cl-chip'));
  card.append(chips);
  if(c.candidate&&c.missing&&c.missing.length){
   const ml=el('div',undefined,'cl-missing');
   ml.append(el('b','الدليل الناقص: '));
   for(const m of c.missing)ml.append(el('span',m,'cl-chip cl-miss'));
   card.append(ml)}
  if(c.candidate){
   const review=document.createElement('select');review.setAttribute('aria-label','مراجعة المرشح '+(c.index+1));for(const[v,t]of[['unreviewed','لم أراجع'],['accepted','راجعت وقبلت السجل'],['rejected','رفضت السجل']]){const o=el('option',t);o.value=v;review.append(o)}review.value=c.review;review.onchange=()=>{c.review=review.value;c.reviewState=review.value==='unreviewed'?'unchecked':review.value};
   const note=el('textarea');note.placeholder='الدليل ورابطه ونسبة القول وحدود المراجعة';note.maxLength=5000;note.setAttribute('aria-label','ملاحظات المرشح '+(c.index+1));note.value=c.note;note.oninput=()=>c.note=note.value;card.append(review,note);
  }
  box.append(card);shown++}
 return shown}
$('detect').onclick=()=>{
 const text=$('src').value;
 if(!text){say('الصق نصًا أولًا.');return}
 const spans=sentences(text);const sents=spans.map(s=>s.quote);
 if(sents.length>MAXS){say('النص يتجاوز '+MAXS+' جملة؛ قسّمه إلى جزء أصغر.');return}
 const items=sents.map((s,i)=>{const sig=signals(s),ctx=context(s);
  const candidate=sig.length>0&&!ctx.includes('رأي معلن')&&!ctx.includes('توجيه أو أمر');
  return{index:i,sentence:s,start:spans[i].start,end:spans[i].end,review:'unreviewed',reviewState:'unchecked',note:'',signals:sig,context:ctx,candidate,missing:candidate?missingEvidence({signals:sig,context:ctx}):[]}});
 const cand=items.filter(x=>x.candidate).length;
 const opin=items.filter(x=>x.context.includes('رأي معلن')).length;
 const dir=items.filter(x=>x.context.includes('توجيه أو أمر')).length;
 const bySig={};for(const it of items)for(const g of it.signals)bySig[g]=(bySig[g]||0)+1;
 const sb=$('stats');sb.replaceChildren();
 const cells=[[sents.length,'جمل في النص'],[cand,'ادعاءات مرشحة للتحقق'],[opin,'آراء معلنة (ليست وقائع)'],[dir,'توجيهات (ليست ادعاءات)']];
 for(const g of Object.keys(bySig))cells.push([bySig[g],'إشارة: '+g]);
 for(const[v,l]of cells){const d=el('div',undefined,'cl-stat');d.append(el('b',String(v)),el('span',l));sb.append(d)}
 view=items;
 last={format:'claims-review-v1',source:{text,title:$('source-title').value,url:$('source-url').value},limits:'Pattern heuristics surface review candidates; they do not establish checkability or truth. Sentences preserved verbatim from source.',items:items.filter(x=>x.candidate)};
 for(const item of last.items)item.missingEvidence=item.missing;
 $('result').hidden=false;$('export').disabled=!cand;$('case-export').disabled=!cand;
 const shown=render();
 say('رُشح '+cand+' ادعاءً من '+sents.length+' جملة. تُعرض '+shown+' بطاقة؛ الجمل محفوظة حرفيًا كما وردت.')};
$('show-plain').onchange=()=>{if(last)render()};
$('export').onclick=()=>{if(last)download('claims-review.json',last)};

// AI claim extraction (user-requested 2026-10-30): Gemini lists check-worthy claims, each
// anchored to a verbatim quote from the pasted text. No truth assessment anywhere - same
// stance as the local candidacy tool. Unavailable states are shown, never filled in.
const _el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
async function aiExtractClaims(){
 const text=$('src').value.trim();
 if(text.length<20){say('الصق نصًا لا يقل عن 20 حرفًا أولًا.');return}
 const btn=$('ai-extract');btn.disabled=true;
 say('يستخرج الذكاء الاصطناعي الادعاءات من النص…');
 try{
  const r=await fetch(BACKEND_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'extract_claims',text:text.slice(0,12000)})});
  const j=r.ok?await r.json():null;
  const cl=j&&j.claims;
  if(!Array.isArray(cl)){say('الاستخراج بالذكاء الاصطناعي غير متاح الآن؛ جرّب لاحقًا أو استخدم الترشيح المحلي.');return}
  const box=$('ai-list');box.replaceChildren();
  if(!cl.length){box.append(_el('p','لم يجد النموذج ادعاءات قابلة للتحقق في النص.'))}
  for(const c of cl){
   const card=_el('div',undefined,'record');
   card.append(_el('p',c.claim));
   const q=_el('blockquote',c.quote);card.append(q);
   box.append(card)}
  $('ai-notice').textContent=GEMINI_NOTICE;
  $('ai-result').hidden=false;
  say('اكتمل الاستخراج بالذكاء الاصطناعي؛ راجع الادعاءات قبل اعتمادها.')}
 catch{say('تعذر الوصول إلى خدمة الذكاء الاصطناعي؛ الترشيح المحلي ما زال متاحًا.')}
 finally{btn.disabled=false}}
$('ai-extract').onclick=aiExtractClaims;
