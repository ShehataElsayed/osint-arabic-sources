import {importDomain} from './domain-case-core.js';
import{parseDomain}from'../journalist-core.js';
const $=id=>document.getElementById(id),say=t=>$('status').textContent=t;
const L=v=>'\u2066'+v+'\u2069';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
let info=null;let generation=0;const records=[];
$('url').oninput=()=>{generation++;info=null;$('parse-out').hidden=true;$('dns').disabled=true;$('rdap').disabled=true;$('save').disabled=true;records.length=0;$('cards').replaceChildren();say('تغير العنوان. أُزيلت النتائج السابقة؛ فككه من جديد قبل الاستعلام.');};
function addCard(title,lines,raw,source,accessed){
 const summary=lines.map(([k,v])=>k+' '+v).join('\n');
 records.push({title,summary,raw,source,accessed});
 const card=el('div',undefined,'dd-card'),body=el('div',undefined,'dd-lines');
 for(const [k,v] of lines){const row=el('div',undefined,'dd-line');row.append(el('span',k,'dd-label'),el('span',v,'dd-val'));body.append(row)}
 const src=el('p',undefined,'src');
 src.append('المصدر: ',el('span',source,'dd-val'),document.createTextNode('\n'),'وقت الوصول (UTC): ',el('span',accessed,'dd-val'));
 card.append(el('h3',title),body,src);
 $('cards').append(card);$('save').disabled=false}
$('parse').onclick=()=>{try{const parsed=parseDomain($('url').value);generation++;records.length=0;$('cards').replaceChildren();$('save').disabled=true;info=parsed;
 const out=$('parse-out');out.hidden=false;
 out.textContent=`النطاق الفعلي: ${L(info.hostname)}\nالأصل: ${L(info.origin)}\nالمسار: ${L(info.path)}\nالمنفذ: ${L(info.port)}\n${info.punycode?'يتضمن Punycode؛ راجع التشابه البصري بعناية.\n':''}${info.caution}`;
 $('dns').disabled=false;$('rdap').disabled=false;say('فُكك العنوان محليًا. السجلات الحية اختيارية بضغطة صريحة.')}catch(e){say(e.message)}};
async function liveQuery(kind,endpoint,parse){
 const epoch=generation;const btn=$(kind);btn.disabled=true;say('استعلام خارجي بإذنك من الزر… يرسل اسم النطاق فقط.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{const response=await fetch(endpoint,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const result=await response.json();if(epoch!==generation)return;parse(result,new Date().toISOString());}
 catch(e){if(epoch===generation)say('تعذر الاستعلام: '+e.message+'؛ لم يُضف سجل.')}
 finally{clearTimeout(timer);btn.disabled=!info}}
$('dns').onclick=()=>{if(!info)return;const endpoint=new URL('https://dns.google/resolve');
 endpoint.searchParams.set('name',info.hostname);endpoint.searchParams.set('type','A');endpoint.searchParams.set('edns_client_subnet','0.0.0.0/0');
 liveQuery('dns',endpoint,(r,accessed)=>{
  if(!Number.isInteger(r.Status)||!Array.isArray(r.Question)||!r.Question.some(q=>q.name.replace(/\.$/,'').toLowerCase()===info.hostname.toLowerCase()))throw Error('استجابة DNS لا تطابق النطاق');
  const rows=(r.Answer||[]).map(a=>[L(`${a.name} ${{1:'A',2:'NS',5:'CNAME',6:'SOA',12:'PTR',15:'MX',16:'TXT',28:'AAAA'}[a.type]||('TYPE'+a.type)}`),L(`${a.data} (TTL ${a.TTL})`)]);
  addCard('سجل DNS من Google Public DNS',[['الحالة:',r.Status===0?'NOERROR':r.Status===3?'NXDOMAIN':'رمز '+r.Status],...rows],JSON.stringify(r,null,2),endpoint.href,accessed);
  say('وصلت استجابة DNS فعلية. راجع البطاقة أدناه؛ رمز 3 يعني NXDOMAIN عند هذا المحلل الآن، لا حكمًا دائمًا.')})};
$('rdap').onclick=()=>{if(!info)return;const endpoint='https://rdap.org/domain/'+encodeURIComponent(info.hostname);
 liveQuery('rdap',endpoint,(r,accessed)=>{
  if(!r||typeof r!=='object'||typeof r.ldhName!=='string'||r.ldhName.replace(/\.$/,'').toLowerCase()!==info.hostname.toLowerCase())throw Error('استجابة RDAP لا تطابق النطاق المطلوب');
  const events={};for(const e of r.events||[])events[e.eventAction]=e.eventDate;
  const registrar=(r.entities||[]).find(e=>(e.roles||[]).includes('registrar'));
  const registrarName=registrar?.vcardArray?.[1]?.find(v=>v[0]==='fn')?.[3]||'غير معلن';
  const ns=(r.nameservers||[]).map(n=>n.ldhName).filter(Boolean);
  addCard('بيانات التسجيل RDAP عبر rdap.org',
   [['النطاق:',r.ldhName||info.hostname],['المسجل:',registrarName],['تاريخ التسجيل:',events.registration||'غير معلن'],['تاريخ الانتهاء:',events.expiration||'غير معلن'],['آخر تغيير:',events['last changed']||events['last update of RDAP database']||'غير معلن'],['الحالة:',(r.status||[]).join('، ')||'غير معلنة'],['خوادم الأسماء:',ns.join('، ')||'غير معلنة']],
   JSON.stringify(r,null,2),endpoint,accessed);
  say('وصلت استجابة RDAP فعلية. غياب البيانات أو إخفاؤها للخصوصية ليس حكمًا.')})};
function dossier(){return {format:'domain-dossier-v1',input:$('url').value,hostname:info?.hostname,localParse:info,records,limitations:'DNS/RDAP records are point-in-time and can be privacy-masked; they do not prove operator identity or credibility.',reviewState:'manual-review-required'}}
let baseCase,caseInvalid=false,caseGeneration=0;
$('case-file').onchange=async()=>{const generation=++caseGeneration;try{caseInvalid=true;baseCase=undefined;const f=$('case-file').files[0];if(!f){caseInvalid=false;return}if(f.size>5000000)throw Error('حد القضية5ميجابايت');const raw=JSON.parse(await f.text());const {validateCase}=await import('../journalist-core.js');const checked=validateCase(raw);if(generation!==caseGeneration)return;baseCase=checked;caseInvalid=false;$('case-port-status').textContent='قضية جاهزة: '+baseCase.title+' ('+baseCase.records.length+' سجل). الأصل لا يتغير.'}catch(e){if(generation!==caseGeneration)return;caseInvalid=true;$('case-port-status').textContent='تعذر فتح القضية: '+e.message;$('case-file').value=''}};
$('case-export').onclick=async()=>{try{if(caseInvalid)throw Error('القضية المختارة غير صالحة أو لم يكتمل فتحها؛ اختر ملفًا صالحًا أو ألغ الاختيار');if(!info||!records.length)throw Error('اجمع سجل نطاق أولًا');const out=await importDomain(JSON.stringify(dossier(),null,2),baseCase);const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'}));a.href=u;a.download='journalist-domain-case.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1500);$('case-port-status').textContent='نُزلت نسخة جديدة بكل مصادرها. سجلات النطاق بلا مراجعة؛ القضية الأصلية لم تتغير.'}catch(e){$('case-port-status').textContent='لم تُصدر قضية: '+e.message+'؛ نزّل ملف النطاق الأصلي للاحتفاظ بالسجلات.'}};
$('save').onclick=()=>{const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify({format:'domain-dossier-v1',input:$('url').value,hostname:info?.hostname,localParse:info,records,limitations:'DNS/RDAP records are point-in-time and can be privacy-masked; they do not prove operator identity or credibility.',reviewState:'manual-review-required'},null,2)],{type:'application/json'}));
 a.href=u;a.download='domain-dossier.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)};
