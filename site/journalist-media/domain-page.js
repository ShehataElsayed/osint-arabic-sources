import{parseDomain}from'../journalist-core.js';
const $=id=>document.getElementById(id),say=t=>$('status').textContent=t;
const L=v=>'\u2066'+v+'\u2069';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
let info=null;const records=[];
function addCard(title,lines,raw,source,accessed){
 const summary=lines.map(([k,v])=>k+' '+v).join('\n');
 records.push({title,summary,raw,source,accessed});
 const card=el('div',undefined,'dd-card'),body=el('div',undefined,'dd-lines');
 for(const [k,v] of lines){const row=el('div',undefined,'dd-line');row.append(el('span',k,'dd-label'),el('span',v,'dd-val'));body.append(row)}
 const src=el('p',undefined,'src');
 src.append('المصدر: ',el('span',source,'dd-val'),document.createTextNode('\n'),'وقت الوصول (UTC): ',el('span',accessed,'dd-val'));
 card.append(el('h3',title),body,src);
 $('cards').append(card);$('save').disabled=false}
$('parse').onclick=()=>{try{info=parseDomain($('url').value);
 const out=$('parse-out');out.hidden=false;
 out.textContent=`النطاق الفعلي: ${L(info.hostname)}\nالأصل: ${L(info.origin)}\nالمسار: ${L(info.path)}\nالمنفذ: ${L(info.port)}\n${info.punycode?'يتضمن Punycode؛ راجع التشابه البصري بعناية.\n':''}${info.caution}`;
 $('dns').disabled=false;$('rdap').disabled=false;say('فُكك العنوان محليًا. السجلات الحية اختيارية بضغطة صريحة.')}catch(e){say(e.message)}};
async function liveQuery(kind,endpoint,parse){
 const btn=$(kind);btn.disabled=true;say('استعلام خارجي بإذنك من الزر… يرسل اسم النطاق فقط.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{const response=await fetch(endpoint,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const result=await response.json();parse(result,new Date().toISOString());}
 catch(e){say('تعذر الاستعلام: '+e.message+'؛ لم يُضف سجل.')}
 finally{clearTimeout(timer);btn.disabled=false}}
$('dns').onclick=()=>{if(!info)return;const endpoint=new URL('https://dns.google/resolve');
 endpoint.searchParams.set('name',info.hostname);endpoint.searchParams.set('type','A');endpoint.searchParams.set('edns_client_subnet','0.0.0.0/0');
 liveQuery('dns',endpoint,(r,accessed)=>{
  if(!Number.isInteger(r.Status)||!Array.isArray(r.Question)||!r.Question.some(q=>q.name.replace(/\.$/,'').toLowerCase()===info.hostname.toLowerCase()))throw Error('استجابة DNS لا تطابق النطاق');
  const answers=(r.Answer||[]).map(a=>L(`${a.name} A ${a.data} (TTL ${a.TTL})`)).join('\n')||'لا إجابات';
  const rows=(r.Answer||[]).map(a=>[L(`${a.name} A`),L(`${a.data} (TTL ${a.TTL})`)]);
  addCard('سجل DNS من Google Public DNS',[['الحالة:',r.Status===0?'NOERROR':r.Status===3?'NXDOMAIN':'رمز '+r.Status],...rows],JSON.stringify(r,null,2).slice(0,20000),endpoint.href,accessed);
  say('وصلت استجابة DNS فعلية. راجع البطاقة أدناه؛ رمز 3 يعني NXDOMAIN عند هذا المحلل الآن، لا حكمًا دائمًا.')})};
$('rdap').onclick=()=>{if(!info)return;const endpoint='https://rdap.org/domain/'+encodeURIComponent(info.hostname);
 liveQuery('rdap',endpoint,(r,accessed)=>{
  if(!r||typeof r!=='object'||!(r.ldhName||r.handle))throw Error('استجابة RDAP غير مكتملة');
  const events={};for(const e of r.events||[])events[e.eventAction]=e.eventDate;
  const registrar=(r.entities||[]).find(e=>(e.roles||[]).includes('registrar'));
  const registrarName=registrar?.vcardArray?.[1]?.find(v=>v[0]==='fn')?.[3]||'غير معلن';
  const ns=(r.nameservers||[]).map(n=>n.ldhName).filter(Boolean);
  addCard('بيانات التسجيل RDAP عبر rdap.org',
   [['النطاق:',r.ldhName||info.hostname],['المسجل:',registrarName],['تاريخ التسجيل:',events.registration||'غير معلن'],['تاريخ الانتهاء:',events.expiration||'غير معلن'],['آخر تغيير:',events['last changed']||events['last update of RDAP database']||'غير معلن'],['الحالة:',(r.status||[]).join('، ')||'غير معلنة'],['خوادم الأسماء:',ns.join('، ')||'غير معلنة']],
   JSON.stringify(r,null,2).slice(0,24000),endpoint,accessed);
  say('وصلت استجابة RDAP فعلية. غياب البيانات أو إخفاؤها للخصوصية ليس حكمًا.')})};
$('save').onclick=()=>{const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify({format:'domain-dossier-v1',input:$('url').value,hostname:info?.hostname,localParse:info,records,limitations:'DNS/RDAP records are point-in-time and can be privacy-masked; they do not prove operator identity or credibility.',reviewState:'manual-review-required'},null,2)],{type:'application/json'}));
 a.href=u;a.download='domain-dossier.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)};
