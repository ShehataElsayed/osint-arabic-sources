import{MATERIALS,buildPlan,planText}from'./planner-core.js';
import{CATALOG}from'./planner-catalog.js';
const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
const say=t=>$('status').textContent=t;
let lastPlan=null,lastDesc='';
const matBox=$('materials');
for(const m of MATERIALS){const lab=el('label',undefined,'pl-mat');const cb=document.createElement('input');cb.type='checkbox';cb.value=m.id;lab.append(cb,document.createTextNode(m.label));matBox.append(lab)}
$('run').onclick=()=>{lastPlan=null;$('export').disabled=true;$('copy').disabled=true;
 try{const desc=$('case').value.trim();
  const mats=[...matBox.querySelectorAll('input:checked')].map(i=>i.value);
  if(!desc&&!mats.length){say('صف القضية أو اختر المواد المتاحة أولًا.');return}
  say('يُطابق القواعد محليًا…');
  const plan=buildPlan(desc,mats,CATALOG);lastPlan=plan;lastDesc=desc;
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
  ol.append(card)}
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
