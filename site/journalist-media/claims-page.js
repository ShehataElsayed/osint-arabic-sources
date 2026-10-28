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
function splitSentences(t){
 return t.replace(/\r/g,'').split(/\n+/).flatMap(p=>p.split(/(?<=[.؟!…؛])\s+/)).map(x=>x.trim()).filter(x=>x.length>1)}
let last=null,view=[];
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
  card.append(chips);box.append(card);shown++}
 return shown}
$('detect').onclick=()=>{
 const text=$('src').value.trim();
 if(!text){say('الصق نصًا أولًا.');return}
 const sents=splitSentences(text);
 if(sents.length>MAXS){say('النص يتجاوز '+MAXS+' جملة؛ قسّمه إلى جزء أصغر.');return}
 const items=sents.map((s,i)=>{const sig=signals(s),ctx=context(s);
  const candidate=sig.length>0&&!ctx.includes('رأي معلن')&&!ctx.includes('توجيه أو أمر');
  return{index:i,sentence:s,signals:sig,context:ctx,candidate}});
 const cand=items.filter(x=>x.candidate).length;
 const opin=items.filter(x=>x.context.includes('رأي معلن')).length;
 const dir=items.filter(x=>x.context.includes('توجيه أو أمر')).length;
 const bySig={};for(const it of items)for(const g of it.signals)bySig[g]=(bySig[g]||0)+1;
 const sb=$('stats');sb.replaceChildren();
 const cells=[[sents.length,'جمل في النص'],[cand,'ادعاءات مرشحة للتحقق'],[opin,'آراء معلنة (ليست وقائع)'],[dir,'توجيهات (ليست ادعاءات)']];
 for(const g of Object.keys(bySig))cells.push([bySig[g],'إشارة: '+g]);
 for(const[v,l]of cells){const d=el('div',undefined,'cl-stat');d.append(el('b',String(v)),el('span',l));sb.append(d)}
 view=items;
 last={format:'claims-review-v1',limits:'Pattern heuristics surface review candidates; they do not establish checkability or truth. Sentences preserved verbatim from source.',items:items.filter(x=>x.candidate).map(x=>({sentence:x.sentence,signals:x.signals,context:x.context,reviewState:'unchecked'}))};
 $('result').hidden=false;$('export').disabled=!cand;
 const shown=render();
 say('رُشح '+cand+' ادعاءً من '+sents.length+' جملة. تُعرض '+shown+' بطاقة؛ الجمل محفوظة حرفيًا كما وردت.')};
$('show-plain').onchange=()=>{if(last)render()};
$('export').onclick=()=>{if(!last)return;
 const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(last,null,2)],{type:'application/json'}));
 a.href=u;a.download='claims-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)};
