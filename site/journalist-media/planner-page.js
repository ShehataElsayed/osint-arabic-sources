import {validateCase} from '../journalist-core.js';
import { BACKEND_URL, aiProviderName } from '../rag-config.js';
import {plannerCase} from './planner-case-core.js';
import{MATERIALS,buildPlan,planText}from'./planner-core.js';
import{CATALOG}from'./planner-catalog.js';
const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
const say=t=>$('status').textContent=t;
let lastPlan=null,lastDesc='',reviews=[],baseCase,caseInvalid=false,caseGeneration=0;
function invalidate(){lastPlan=null;reviews=[];$('result').hidden=true;$('export').disabled=true;$('copy').disabled=true;$('case-export').disabled=true;say('تغير الوصف أو المواد؛ أعد بناء المسار.');}
$('case').oninput=invalidate;
$('case-file').onchange=async()=>{const g=++caseGeneration;caseInvalid=true;baseCase=undefined;try{const f=$('case-file').files[0];if(!f){caseInvalid=false;return}if(f.size>5000000)throw Error('حد القضية5ميجابايت');const v=validateCase(JSON.parse(await f.text()));if(g!==caseGeneration)return;baseCase=v;caseInvalid=false;$('case-status').textContent='قضية مفتوحة محليًا: '+v.title}catch(e){if(g===caseGeneration)$('case-status').textContent='لم تُفتح القضية: '+e.message}};
$('case-export').onclick=()=>{try{if(caseInvalid)throw Error('القضية غير صالحة أو لم يكتمل فتحها');const out=plannerCase(lastPlan,lastDesc,reviews,baseCase),a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'}));a.href=u;a.download='journalist-plan-case.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1500);$('case-status').textContent='نُزلت نسخة جديدة؛ الخطة اقتراح غير منفذ، والأصل لم يتغير.'}catch(e){$('case-status').textContent='لم تُصدر القضية: '+e.message}};

const matBox=$('materials');
for(const m of MATERIALS){const lab=el('label',undefined,'pl-mat');const cb=document.createElement('input');cb.type='checkbox';cb.onchange=invalidate;cb.value=m.id;lab.append(cb,document.createTextNode(m.label));matBox.append(lab)}
$('run').onclick=()=>{lastPlan=null;$('export').disabled=true;$('copy').disabled=true;
 try{const desc=$('case').value;
  const mats=[...matBox.querySelectorAll('input:checked')].map(i=>i.value);
  if(!desc&&!mats.length){say('صف القضية أو اختر المواد المتاحة أولًا.');return}
  say('يُطابق القواعد محليًا…');
  const plan=buildPlan(desc,mats,CATALOG);lastPlan=plan;lastDesc=desc;reviews=(plan.steps||[]).map(s=>({order:s.order,review:'unreviewed',note:''}));$('case-export').disabled=plan.empty;
  render(plan);
  $('export').disabled=plan.empty;$('copy').disabled=plan.empty;
  say(plan.empty?'':'اكتمل الاقتراح محليًا. راجع كل خطوة قبل اتباعها.')}
 catch(e){say('تعذر بناء المسار: '+e.message)}};
function render(plan){const box=$('result');box.hidden=false;const wrap=$('plan');wrap.replaceChildren();
 if(plan.empty){wrap.append(el('p',plan.message,'pl-empty'));return}
 const ol=el('div',undefined,'pl-steps');
 for(const s of plan.steps){const card=el('article',undefined,'pl-card');
  card.append(el('h3',s.order+'. '+s.tool));
  const ev=[];if(s.evidence.materials.length)ev.push('مواد: '+s.evidence.materials.join('، '));if(s.evidence.signals.length)ev.push('إشارات من وصفك: '+s.evidence.signals.join('، '));
  card.append(el('p','لماذا رُشحت: '+ev.join(' | '),'pl-ev'));
  card.append(el('p','المدخلات: '+s.input));
  const ul=document.createElement('ol');for(const st of s.steps)ul.append(el('li',st));card.append(ul);
  card.append(el('p','النتيجة المتوقعة: '+s.expected));
  card.append(el('p','شرط التوقف: '+s.stop,'pl-stop'));
  const a=el('a','افتح الأداة','pl-open');a.href='./'+s.page;card.append(a);
  const review=reviews.find(r=>r.order===s.order),select=el('select');select.setAttribute('aria-label','مراجعة اقتراح '+s.order);for(const[v,t]of[['unreviewed','لم أراجع الاقتراح'],['accepted','قبلت الخطوة في الخطة (ليست منفذة)'],['rejected','استبعدت الخطوة']]){const o=el('option',t);o.value=v;select.append(o)}select.value=review.review;select.onchange=()=>review.review=select.value;const note=el('textarea');note.setAttribute('aria-label','ملاحظات اقتراح '+s.order);note.placeholder='تعديل المسار وحدود الخطة، لا دليل تنفيذ';note.maxLength=5000;note.oninput=()=>review.note=note.value;card.append(select,note);ol.append(card)}
 wrap.append(ol);
 if(plan.external.length){const h=el('h3','أدوات خارجية من الدليل (روابط تغادر المنصة)');wrap.append(h);
  const list=el('div',undefined,'pl-ext');
  for(const e of plan.external){const c=el('div',undefined,'pl-ext-card');
   const a=el('a',e.name);a.href=e.url;a.target='_blank';a.rel='noopener noreferrer';
   c.append(a,el('p',(e.bestFor||'')+(e.input?' — يقبل: '+e.input:'')+(e.output?'، يعطي: '+e.output:''),'pl-ext-desc'));
   if(e.opsecNote)c.append(el('p','تنبيه خصوصية: '+e.opsecNote,'pl-opsec'));
   list.append(c)}
  wrap.append(list)}
 const notes=el('div',undefined,'pl-notes');
 for(const n of plan.notes)notes.append(el('p',n));
 wrap.append(notes)}
$('export').onclick=()=>{if(!lastPlan||lastPlan.empty)return;
 const blob=new Blob([planText(lastPlan,lastDesc)],{type:'text/plain;charset=utf-8'});
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='verification-path.txt';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000)};
$('copy').onclick=async()=>{if(!lastPlan||lastPlan.empty)return;
 try{await navigator.clipboard.writeText(planText(lastPlan,lastDesc));say('نُسخ المسار إلى الحافظة.')}catch(e){say('تعذر النسخ: '+e.message)}};

// AI explanation of the built plan (2026-10-31 all-tools AI expansion, user «تمام ضيفه ف كل
// الأدوات»): the plan stays a local rule match; this optional section sends ONLY the visible plan
// text to the guide worker (summarize_text route, context 'plan'). The worker guard blocks any
// claim that the plan was executed or verified anything; description of the proposal only.
(function aiSummary(){
  const res0=document.getElementById('result');
  new MutationObserver(()=>{const b=document.getElementById('ai-box'); if(b) b.hidden=res0.hidden; if(res0.hidden){const r=document.getElementById('ai-result'); if(r)r.hidden=true; const s=document.getElementById('ai-status'); if(s)s.textContent='';}}).observe(res0,{attributes:true,attributeFilter:['hidden']});
  const box=document.getElementById('ai-box'), btn=document.getElementById('ai-summarize'),
        st=document.getElementById('ai-status'), res=document.getElementById('ai-result'),
        prov=document.getElementById('ai-provider'), ov=document.getElementById('ai-overview'),
        qh=document.getElementById('ai-quotes-h'), ql=document.getElementById('ai-quotes');
  if(!box||!btn)return;
  btn.onclick=async()=>{
    const text=(document.getElementById('result').innerText).slice(0,11000);
    if(text.trim().length<40){st.textContent='المسار أقصر من أن يُشرح.';return}
    btn.disabled=true;res.hidden=true;st.textContent='جارٍ الشرح بالذكاء الاصطناعي…';
    try{
      const r=await fetch(BACKEND_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'summarize_text',text,context:'plan'})});
      const j=r.ok?await r.json():null;
      const sm=j&&j.summary;
      if(!sm){st.textContent='الشرح بالذكاء الاصطناعي غير متاح الآن؛ مسارك الكامل ظاهر أعلاه.';return}
      prov.textContent=aiProviderName(j&&j.provider);
      ov.textContent=sm.overview;
      ql.replaceChildren();
      if(Array.isArray(sm.key_quotes)&&sm.key_quotes.length){qh.hidden=false;for(const q of sm.key_quotes){const li=document.createElement('li');li.textContent=q;ql.append(li)}}else qh.hidden=true;
      res.hidden=false;
      st.textContent='اكتمل الشرح بالذكاء الاصطناعي؛ الملخص بصياغة النموذج وصفٌ لمسار مقترح لم يُنفَّذ - راجعه أمام المسار قبل الاعتماد عليه.'}
    catch{st.textContent='تعذر الوصول إلى خدمة الذكاء الاصطناعي؛ مسارك الكامل ظاهر أعلاه.'}
    finally{btn.disabled=false}};
})();
