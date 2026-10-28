const $=id=>document.getElementById(id),say=t=>$('status').textContent=t;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
const MAXC=200;
let result=null,rawCaps=[];
function normUrl(u){u=u.trim();if(!u)return'';
 if(!/^https?:\/\//i.test(u))u='https://'+u;
 try{const x=new URL(u);return x.href}catch(e){return''}}
function fmtTs(t){return t.slice(0,4)+'-'+t.slice(4,6)+'-'+t.slice(6,8)+' '+t.slice(8,10)+':'+t.slice(10,12)}
async function fetchCaptures(url){
 const all=[];let offset=0,estimated=null;
 while(all.length<MAXC){
  const api='https://arquivo.pt/textsearch?versionHistory='+encodeURIComponent(url)+'&maxItems=50&offset='+offset;
  const r=await fetch(api);
  if(!r.ok)throw new Error('استجابة الأرشيف: '+r.status);
  const j=await r.json();
  if(offset===0)estimated=j.estimated_nr_results;
  const items=j.response_items||[];
  if(!items.length)break;
  for(const it of items)all.push(it);
  if(items.length<50)break;
  offset+=50}
 all.sort((a,b)=>a.tstamp<b.tstamp?-1:1);
 return{captures:all.slice(0,MAXC),estimated}}
function render(){
 const c=rawCaps;
 const sb=$('stats');sb.replaceChildren();
 const years={};for(const x of c){const y=x.tstamp.slice(0,4);years[y]=(years[y]||0)+1}
 const ys=Object.keys(years).sort();
 let changes=0;for(let i=1;i<c.length;i++)if(c[i].digest&&c[i-1].digest&&c[i].digest!==c[i-1].digest)changes++;
 const cells=[[result.estimatedTotal??c.length,'تقدير إجمالي اللقطات'],[c.length,'لقطات مجلوبة (حد '+MAXC+')'],[c.length?fmtTs(c[0].tstamp).slice(0,10):'—','أقدم لقطة مجلوبة'],[c.length?fmtTs(c[c.length-1].tstamp).slice(0,10):'—','أحدث لقطة مجلوبة'],[changes,'نقطة تغير محتوى بين المجلوبة']];
 for(const[v,l]of cells){const d=el('div',undefined,'aw-stat');d.append(el('b',String(v)),el('span',l));sb.append(d)}
 // year chart
 const ch=$('chart');ch.replaceChildren();
 if(ys.length){const ns='http://www.w3.org/2000/svg',W=700,H=150,PAD=34,max=Math.max(...ys.map(y=>years[y]));
  const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('role','img');svg.setAttribute('aria-label','توزيع اللقطات عبر السنوات');
  const bw=(W-2*PAD)/ys.length;
  ys.forEach((y,i)=>{const h=Math.max(2,(H-50)*years[y]/max),x=PAD+i*bw+bw*0.15;
   const r=document.createElementNS(ns,'rect');
   for(const[k,v]of Object.entries({x,y:H-30-h,width:bw*0.7,height:h}))r.setAttribute(k,v);
   r.setAttribute('class','aw-bar');
   const t=document.createElementNS(ns,'text');t.setAttribute('x',x+bw*0.35);t.setAttribute('y',H-34-h);t.setAttribute('text-anchor','middle');t.setAttribute('class','aw-bar-lab');t.textContent=years[y];
   const yl=document.createElementNS(ns,'text');yl.setAttribute('x',x+bw*0.35);yl.setAttribute('y',H-16);yl.setAttribute('text-anchor','middle');yl.setAttribute('class','aw-year');yl.textContent=y;
   svg.append(r,t,yl)});
  ch.append(svg)}else ch.append(el('p','لا لقطات لعرضها.'));
 // table
 const tb=$('table').tBodies[0];tb.replaceChildren();
 c.forEach((x,i)=>{
  const tr=document.createElement('tr');
  const changed=i>0&&x.digest&&c[i-1].digest&&x.digest!==c[i-1].digest;
  if(changed)tr.className='aw-change';
  const td1=el('td',fmtTs(x.tstamp),'aw-ts');
  const td2=el('td',x.mimeType||'—');
  const td3=el('td',x.contentLength!=null?String(x.contentLength):'—');td3.className='aw-ts';
  const td4=el('td',changed?'تغيرت البصمة عن السابقة':(i===0?'—':'مطابقة للسابقة'));
  const td5=document.createElement('td');
  if(x.linkToArchive){const a=el('a','افتح في الأرشيف ↗');a.href=x.linkToArchive;a.target='_blank';a.rel='noopener noreferrer';td5.append(a)}
  tr.append(td1,td2,td3,td4,td5);tb.append(tr)});
 $('table-note').textContent='تُعرض حتى '+MAXC+' لقطة. الصفوف الصفراء نقاط تغير البصمة: قرينة تغيّر لا حجم التغيير.'}
$('search').onclick=async()=>{
 const u=normUrl($('url').value);
 if(!u){say('اكتب رابطًا صالحًا.');return}
 say('يُرسل الرابط الآن إلى arquivo.pt لجلب قائمة اللقطات العامة…');
 $('search').disabled=true;
 try{const{captures,estimated}=await fetchCaptures(u);
  rawCaps=captures;
  result={format:'archive-lookup-v1',queriedUrl:u,source:'arquivo.pt versionHistory API',limits:'Coverage differs across archives; digest change is a content-change lead, not its magnitude. Up to '+MAXC+' captures listed. No page content fetched.',
   estimatedTotal:estimated,captures:captures.map(x=>({timestamp:x.tstamp,mime:x.mimeType,length:x.contentLength,digest:x.digest,view:x.linkToArchive}))};
  $('result').hidden=false;render();
  $('export').disabled=false;$('wb').disabled=false;
  say(captures.length?'جُلبت '+captures.length+' لقطة (تقدير الإجمالي '+estimated+').':'لا لقطات لهذا الرابط في arquivo.pt. جرّب أقرب لقطة في archive.org.')}
 catch(e){say('تعذر جلب الأرشيف: '+e.message+' — يمكنك المحاولة لاحقًا أو فتح arquivo.pt مباشرة.')}
 finally{$('search').disabled=false}};
$('wb').onclick=async()=>{
 const u=result&&result.queriedUrl;if(!u)return;
 say('يُرسل الرابط الآن إلى archive.org لمعرفة أقرب لقطة متاحة…');
 try{const r=await fetch('https://archive.org/wayback/available?url='+encodeURIComponent(u));
  if(!r.ok)throw new Error(r.status);
  const j=await r.json(),s=j.archived_snapshots&&j.archived_snapshots.closest;
  if(s&&s.available){say('أقرب لقطة في archive.org: '+s.timestamp+' — تُفتح على موقعهم.');
   const w=el('a','افتح لقطة archive.org ↗');w.href=s.url;w.target='_blank';w.rel='noopener noreferrer';w.className='aw-chip';
   $('result').querySelector('h2').after(w)}
  else say('لا لقطة متاحة لهذا الرابط في archive.org.')}
 catch(e){say('تعذر الاستعلام من archive.org: '+e.message)}};
$('export').onclick=()=>{if(!result)return;
 const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));
 a.href=u;a.download='archive-lookup.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)};
