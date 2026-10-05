(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TYPES={1:'نزاع تشارك فيه حكومة',2:'نزاع بين جماعات غير حكومية',3:'عنف من طرف واحد ضد مدنيين'};
const COLORS={1:'#c0392b',2:'#d68910',3:'#6c3483'};
const PREC={1:'موقع الحدث محدد بدقة',2:'ضمن 25 كم من النقطة المعروضة',3:'نقطة مركزية لمديرية، وليست موقع الحدث',4:'نقطة مركزية لمحافظة، وليست موقع الحدث',5:'ميزة خطية أو منطقة غير محددة الحدود',6:'الدولة فقط'};
const params=new URLSearchParams(location.hash.slice(1));
if(params.get('embed')==='1')document.body.classList.add('ym-embed');
let EV=[],map,heat,ptsLayer,filtered=[],playTimer=null,selected=null,bars=[];
const F={from:$('fFrom'),to:$('fTo'),prec:$('fPrec'),type:$('fType'),gov:$('fGov'),min:$('fMin'),q:$('fQ'),layer:$('fLayer')};
const num=n=>Number(n).toLocaleString('en-US');
let AR={gov:{},party:{}},TR={d:{},h:{}},SIG=[],LIVE='https://raw.githubusercontent.com/ShehataElsayed/osint-arabic-sources/live-data/';
function ev(a){return{id:a[0],d:a[1],d2:a[2],lat:a[3],lon:a[4],prec:a[5],type:a[6],best:a[7],low:a[8],high:a[9],civ:a[10],a:a[11],b:a[12],gov:a[13],place:a[14],src:a[15],head:a[16],sd:a[17],near:a[18]||''}}
const gAr=g=>AR.gov[g]||g,pAr=p=>AR.party[p]||p;
const where=e=>e.near?`قرب ${e.near}${e.gov?'، '+gAr(e.gov):''}`:(gAr(e.gov)||'اليمن');
const tHead=e=>TR.h[e.head]?{t:TR.h[e.head],mt:true}:{t:e.head,mt:false},tDesc=e=>TR.d[e.place]?{t:TR.d[e.place],mt:true}:{t:e.place,mt:false};
function loadParams(){for(const k of Object.keys(F)){const v=params.get(k);if(v!==null)F[k].value=v}}
function saveParams(){const p=new URLSearchParams();for(const k of Object.keys(F)){if(F[k].value&&F[k].value!==F[k].defaultValue&&!(F[k].tagName==='SELECT'&&F[k].selectedIndex===0))p.set(k,F[k].value)}if(document.body.classList.contains('ym-embed'))p.set('embed','1');history.replaceState(null,'','#'+p.toString())}
function apply(skipDate){
  const from=F.from.value,to=F.to.value,pr=+F.prec.value,ty=F.type.value,gv=F.gov.value,mn=+F.min.value||0,q=F.q.value.trim().toLowerCase();
  const pass=e=>(skipDate||((!from||e.d>=from)&&(!to||e.d<=to)))&&e.prec<=pr&&(!ty||e.type==ty)&&(!gv||gAr(e.gov)===gv)&&e.best>=mn&&(!q||(pAr(e.a)+' '+pAr(e.b)+' '+where(e)+' '+tDesc(e).t+' '+e.place+' '+gAr(e.gov)+' '+e.head).toLowerCase().includes(q));
  return EV.filter(pass);
}
function render(){
  filtered=apply(false);saveParams();
  const best=filtered.reduce((s,e)=>s+e.best,0),low=filtered.reduce((s,e)=>s+e.low,0),high=filtered.reduce((s,e)=>s+e.high,0),civ=filtered.reduce((s,e)=>s+e.civ,0);
  $('stats').innerHTML=`<div><b>${num(filtered.length)}</b><small>حدث</small></div><div><b>${num(best)}</b><small>قتلى (أفضل تقدير) · بين ${num(low)} و${num(high)}</small></div><div><b>${num(civ)}</b><small>منهم مدنيون</small></div>`;
  drawMap();drawList();drawChart();
}
function drawMap(){
  const l=F.layer.value;
  const k=Math.min(1,Math.sqrt(110/Math.max(filtered.length,1)));heat.setLatLngs(l==='pts'?[]:filtered.map(e=>[e.lat,e.lon,Math.min(1,(0.25+Math.log(1+e.best)/4)*k)]));
  ptsLayer.clearLayers();
  if(l!=='heat'){const r=renderer;for(const e of filtered){const m=L.circleMarker([e.lat,e.lon],{renderer:r,radius:3+Math.min(7,Math.sqrt(e.best)),color:'#fff',weight:.7,fillColor:COLORS[e.type],fillOpacity:.85});m.on('click',()=>select(e));ptsLayer.addLayer(m)}}
}
let renderer;
function drawList(){
  let rows=filtered;
  if($('inView').checked&&map){const b=map.getBounds();rows=rows.filter(e=>b.contains([e.lat,e.lon]))}
  const top=rows.slice().sort((a,b)=>a.d<b.d?1:-1).slice(0,150);
  $('list').innerHTML=top.length?top.map(e=>`<button type="button" class="ym-item" data-id="${e.id}"><b>${esc(where(e))}</b><small>${esc(e.d)} · ${esc(TYPES[e.type])} · قتلى: ${num(e.best)}</small></button>`).join(''):'<p class="muted">لا أحداث مطابقة للعوامل الحالية.</p>';
  if(rows.length>150)$('list').insertAdjacentHTML('beforeend',`<p class="muted small">يعرض أحدث 150 من ${num(rows.length)}. استخدم التصدير للقائمة الكاملة.</p>`);
}
function select(e){
  selected=e;const d=$('detail');d.hidden=false;const h=tHead(e),ds=tDesc(e);
  const mt=x=>x.mt?'<span class="mt">ترجمة آلية</span>':'';const tx=x=>x.mt?esc(x.t):'<span class="mt off">لم تُترجم بعد، الأصل في «النص الأصلي» أدناه</span>';
  d.innerHTML=`<h3>${esc(where(e))}</h3><dl><dt>التاريخ</dt><dd>${esc(e.d)}${e.d2!==e.d?' إلى '+esc(e.d2):''}</dd><dt>النوع</dt><dd>${esc(TYPES[e.type])}</dd><dt>الطرفان</dt><dd>${esc(pAr(e.a))} ← ${esc(pAr(e.b))}</dd><dt>المحافظة</dt><dd>${esc(gAr(e.gov))}</dd><dt>القتلى</dt><dd>أفضل تقدير ${num(e.best)} (بين ${num(e.low)} و${num(e.high)})، مدنيون: ${num(e.civ)}</dd><dt>وصف الموقع</dt><dd>${tx(ds)} ${mt(ds)}</dd><dt>المصدر</dt><dd>${esc(e.src)}${e.sd?' · '+esc(e.sd):''}<br>${tx(h)} ${mt(h)}</dd><dt>السجل</dt><dd><a href="https://ucdp.uu.se/event/${e.id}" rel="noopener" target="_blank" style="direction:ltr;unicode-bidi:isolate">UCDP GED #${e.id}</a></dd></dl>
  <details><summary>النص الأصلي (بالإنجليزية)</summary><p dir="ltr" style="text-align:left">${esc(e.place)}<br>${esc(e.head)}<br>${esc(e.a)} → ${esc(e.b)}</p></details>
  <p class="prec">دقة الموقع ${e.prec} من 6: ${esc(PREC[e.prec])}.${e.near?' اسم المكان الظاهر هو أقرب موقع معروف في GeoNames (حساب آلي) وقد لا يطابق الموقع الفعلي.':''} تقدير منشور وليس تحققًا مستقلًا.</p>`;
  map.setView([e.lat,e.lon],Math.max(map.getZoom(),9));
  if(!document.body.classList.contains('ym-embed'))d.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function drawChart(){
  const cv=$('chart'),w=cv.clientWidth||900,h=150,dpr=window.devicePixelRatio||1;cv.width=w*dpr;cv.height=h*dpr;const c=cv.getContext('2d');c.scale(dpr,dpr);c.clearRect(0,0,w,h);
  const base=apply(true),m={};for(const e of base){const k=e.d.slice(0,7);m[k]=(m[k]||0)+1}
  const keys=Object.keys(m).sort();if(!keys.length){bars=[];return}
  const first=keys[0],last=keys[keys.length-1];const all=[];let [y,mo]=first.split('-').map(Number);const [ly,lm]=last.split('-').map(Number);
  while(y<ly||(y===ly&&mo<=lm)){all.push(y+'-'+String(mo).padStart(2,'0'));if(++mo>12){mo=1;y++}}
  const max=Math.max(...Object.values(m)),bw=(w-30)/all.length;bars=[];
  const from=F.from.value.slice(0,7),to=F.to.value.slice(0,7);
  all.forEach((k,i)=>{const v=m[k]||0,bh=v/max*(h-34),x=w-15-(i+1)*bw;const on=(!from||k>=from)&&(!to||k<=to);c.fillStyle=on?'#0a827d':'#b9cfcc';c.fillRect(x+.5,h-22-bh,Math.max(1,bw-1),bh);bars.push({k,x,w:bw})});
  c.fillStyle='#52646d';c.font='12px Cairo,sans-serif';c.textAlign='center';
  all.forEach((k,i)=>{if(k.endsWith('-01')&&(+k.slice(0,4))%2===0){c.fillText(k.slice(0,4),w-15-(i+.5)*bw,h-6)}});
}
function setMonth(k){const[y,m]=k.split('-').map(Number);const last=new Date(y,m,0).getDate();F.from.value=k+'-01';F.to.value=k+'-'+String(last).padStart(2,'0');render()}
$('chart').addEventListener('click',e=>{const r=$('chart').getBoundingClientRect(),x=e.clientX-r.left;const b=bars.find(b=>x>=b.x&&x<b.x+b.w);if(b)setMonth(b.k)});
$('play').addEventListener('click',()=>{
  if(playTimer){clearInterval(playTimer);playTimer=null;$('play').textContent='▶ تشغيل';return}
  const ks=bars.map(b=>b.k).sort();if(!ks.length)return;let i=0;$('play').textContent='⏸ إيقاف';
  playTimer=setInterval(()=>{if(i>=ks.length){clearInterval(playTimer);playTimer=null;$('play').textContent='▶ تشغيل';return}setMonth(ks[i++])},700);
});
function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000)}
const csvq=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
const CREDIT='المصدر: UCDP GED (جامعة أوبسالا)، رخصة CC BY 4.0. دقة الموقع متفاوتة والأعداد تقديرات منشورة وليست تحققًا.';
$('exCsv').addEventListener('click',()=>{const H=['id','date_start','date_end','lat','lon','location_precision','type','deaths_best','deaths_low','deaths_high','civilians','side_a_ar','side_b_ar','governorate_ar','place_ar_nearest','description_ar_machine_translated','source','headline_ar_machine_translated','description_original_en','headline_original_en','ucdp_url'];
  const rows=filtered.map(e=>[e.id,e.d,e.d2,e.lat,e.lon,e.prec,TYPES[e.type],e.best,e.low,e.high,e.civ,pAr(e.a),pAr(e.b),gAr(e.gov),e.near,TR.d[e.place]||'',e.src,TR.h[e.head]||'',e.place,e.head,'https://ucdp.uu.se/event/'+e.id].map(csvq).join(','));
  download('yemen-events.csv','\ufeff'+H.join(',')+'\n'+rows.join('\n')+'\n# '+CREDIT+'\n','text/csv;charset=utf-8');$('exMsg').textContent='تم تنزيل '+num(filtered.length)+' حدثًا. '+CREDIT});
$('exGeo').addEventListener('click',()=>{const g={type:'FeatureCollection',attribution:CREDIT,features:filtered.map(e=>({type:'Feature',geometry:{type:'Point',coordinates:[e.lon,e.lat]},properties:{id:e.id,date_start:e.d,date_end:e.d2,location_precision:e.prec,type:TYPES[e.type],deaths_best:e.best,deaths_low:e.low,deaths_high:e.high,civilians:e.civ,side_a:pAr(e.a),side_b:pAr(e.b),governorate:gAr(e.gov),nearest_place_ar:e.near,description_ar_machine:TR.d[e.place]||'',headline_ar_machine:TR.h[e.head]||'',description_original_en:e.place,headline_original_en:e.head,source:e.src,url:'https://ucdp.uu.se/event/'+e.id}}))};
  download('yemen-events.geojson',JSON.stringify(g),'application/geo+json');$('exMsg').textContent='تم تنزيل GeoJSON. '+CREDIT});
async function copy(t,m){try{await navigator.clipboard.writeText(t);$('exMsg').textContent=m}catch(e){$('exMsg').textContent='تعذر النسخ تلقائيًا. انسخ يدويًا: '+t}}
$('exLink').addEventListener('click',()=>{saveParams();copy(location.href.replace(/embed=1&?/,''),'تم نسخ الرابط بالعوامل الحالية.')});
$('exEmbed').addEventListener('click',()=>{saveParams();const p=new URLSearchParams(location.hash.slice(1));p.set('embed','1');const u=location.origin+location.pathname+'#'+p.toString();copy(`<iframe src="${u}" width="100%" height="680" style="border:0" loading="lazy" title="خريطة النزاع في اليمن"></iframe>\n<!-- ${CREDIT} -->`,'تم نسخ كود التضمين. أبقِ سطر الإسناد في صفحتك.')});
for(const k of Object.keys(F)){F[k].addEventListener('change',render);if(k==='q')F[k].addEventListener('input',()=>{clearTimeout(F.q._t);F.q._t=setTimeout(render,250)})}
$('fReset').addEventListener('click',()=>{for(const k of Object.keys(F)){F[k].value=F[k].defaultValue;if(F[k].tagName==='SELECT')F[k].selectedIndex=0}init2();render()});
$('inView').addEventListener('change',drawList);
$('list').addEventListener('click',e=>{const b=e.target.closest('.ym-item');if(!b)return;const x=EV.find(v=>v.id==b.dataset.id);if(x)select(x)});
document.querySelectorAll('.ym-tabs button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.ym-tabs button').forEach(x=>x.setAttribute('aria-selected',x===b));for(const t of['list','sig','news','cams'])$('tab-'+t).hidden=t!==b.dataset.tab}));
function init2(){const last=EV.length?EV[EV.length-1].d:'';const y=last?new Date(+last.slice(0,4)-1,+last.slice(5,7)-1,+last.slice(8,10)+1):null;F.from.value=y?y.toISOString().slice(0,10):'';F.to.value=''}
async function getJson(u){const r=await fetch(u+'?t='+Math.floor(Date.now()/600000));if(!r.ok)throw new Error(u);return r.json()}

/* ---- Near-live media-derived signals (GDELT). Separate from UCDP documented events. ---- */
let sigLayer,REV={};const sigKey=g=>[g.lat,g.lon,g.cameo].join('|');const nDom=g=>new Set(g.sources.map(x=>x.d)).size;const cand=g=>nDom(g)>=2;
const sigWhere=g=>(g.place_ar||'')?(g.place_ar+(g.gov_ar&&g.gov_ar!==g.place_ar?'، '+g.gov_ar:'')):(g.gov_ar||'اليمن');
function sigRows(){const h=+$('sigWin').value;const cut=new Date(Date.now()-h*3600e3).toISOString();return SIG.filter(g=>g.last>=cut)}
function ago(t){const m=Math.max(0,Math.round((Date.now()-new Date(t))/60000));return m<60?`قبل ${num(m)} دقيقة`:m<2880?`قبل ${num(Math.round(m/60))} ساعة`:`قبل ${num(Math.round(m/1440))} يوم`}
function drawSignals(){
  sigLayer.clearLayers();const rows=sigRows();
  if($('sigShow').checked)for(const g of rows){const m=L.circleMarker([g.lat,g.lon],{radius:6+Math.min(8,Math.log(1+g.mentions)),color:REV[sigKey(g)]?'#0a6b3a':cand(g)?'#b35c00':'#1f5fbf',weight:2,dashArray:REV[sigKey(g)]?null:'3 3',fillColor:REV[sigKey(g)]?'#7fe0a8':cand(g)?'#ffc27a':'#7fb2ff',fillOpacity:.4});m.bindPopup(sigPopup(g));sigLayer.addLayer(m)}
  $('sigList').innerHTML=rows.length?rows.map((g,i)=>`<div class="ym-item sig" data-i="${i}"><b>${esc(sigWhere(g))}</b><small>${REV[sigKey(g)]?'موثق بعد مراجعة · ':cand(g)?'مرشح (مصدران أو أكثر) · ':''}${esc(g.cameo_ar)} · ${esc(ago(g.last))} · ${num(nDom(g))} موقعًا إخباريًا${g.mentions?' · ذُكر '+num(g.mentions)+' مرة':''}</small></div>`).join(''):'<p class="muted">لا إشارات ضمن هذه المدة، أو لم يُنشر ملف الإشارات بعد.</p>';
  sigRowsCache=rows;
}
let sigRowsCache=[];
function sigPopup(g){return `<div dir="rtl" style="font-family:Cairo,sans-serif;min-width:200px"><b>${REV[sigKey(g)]?'موثق بعد مراجعة بشرية':cand(g)?'مرشح للتوثيق: مصادر مستقلة متعددة، لم يُراجع بعد':'إشارة إعلامية آلية، غير محققة'}</b><br>${esc(sigWhere(g))}<br>${esc(g.cameo_ar)} · آخر ظهور ${esc(ago(g.last))}<br>${g.place_ar?'':'<small>الاسم الأصلي: <span dir="ltr">'+esc(g.place_en)+'</span></small><br>'}<small>تُستخرج آليًا من أخبار، وقد يكون الموقع أو النوع خاطئًا. افتح المصدر وتحقق.</small><br>${g.sources.slice(0,4).map(s=>`<a href="${esc(s.u)}" target="_blank" rel="noopener noreferrer" style="direction:ltr;unicode-bidi:isolate;display:block">${esc(s.d||'مصدر')}</a>`).join('')}</div>`}
async function loadSignals(){
  let d=null;try{d=await fetch(LIVE+'yemen-signals.json?t='+Math.floor(Date.now()/300000)).then(r=>{if(!r.ok)throw 0;return r.json()})}catch(e){try{d=await getJson('./data/yemen-signals.json')}catch(e2){}}
  if(!d)return;try{const r=await getJson('./data/yemen-reviewed.json');REV={};(r.reviewed||[]).forEach(x=>{if(x.status==='documented')REV[x.key]=x})}catch(e){}SIG=d.signals||[];$('sigMeta').textContent=`آخر تحديث للملف: ${d.updated.replace('T',' ').replace('Z',' UTC')} (${ago(d.updated)}). ${d.label}.`;drawSignals();
}
async function loadNews(){
  try{let n;try{n=await fetch(LIVE+'yemen-news.json?t='+Math.floor(Date.now()/300000)).then(r=>{if(!r.ok)throw 0;return r.json()})}catch(e){n=await getJson('./data/yemen-news.json')}const items=(n.items||[]).filter(i=>i.l==='arabic');
    $('newsMeta').textContent=items.length?`فهرس آلي من GDELT. آخر تحديث: ${n.updated.replace('T',' ').replace('Z',' UTC')}. غير محرَّر، فتحقق من المصدر.`:'لا عناوين محدثة حاليًا.';
    $('news').innerHTML=items.slice(0,60).map(i=>`<a class="ym-item" href="${esc(/^https?:/.test(i.u)?i.u:'#')}" target="_blank" rel="noopener noreferrer"><b>${esc(i.t)}</b><small>${esc(i.d)} · ${esc(i.at.replace('T',' ').replace('Z',''))}</small></a>`).join('')}
  catch(e){$('newsMeta').textContent='الفهرس الآلي للأخبار لم يُنشر بعد في هذا الإصدار.'}
}
async function loadStreams(){
  try{const [c,l]=await Promise.all([getJson('./data/yemen-streams.json'),fetch(LIVE+'yemen-streams-live.json?t='+Math.floor(Date.now()/300000)).then(r=>{if(!r.ok)throw 0;return r.json()}).catch(()=>({live:[]}))]);
    const live={};(l.live||[]).forEach(x=>live[x.channel_id]=x.video_id);
    $('streams').innerHTML='<p class="muted small">بث قنوات إخبارية رسمية، وليست كاميرات مراقبة. تتحقق الأداة آليًا من أن القناة تبث الآن وتسمح بالتضمين. التشغيل يتم من يوتيوب بعد ضغطك.</p>'+c.channels.map(x=>{const v=live[x.channel_id];return `<div class="ym-item"><b>${esc(x.name)}</b><small>${esc(x.kind)} · ${v?'بث مباشر الآن':'لم يُرصد بث مباشر قابل للتضمين'}</small>${v&&/^[\w-]{11}$/.test(v)?`<button type="button" class="ym-play" data-v="${v}">تشغيل داخل الأداة</button>`:''}<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">فتح على يوتيوب</a></div>`}).join('');
    $('streams').addEventListener('click',ev=>{const b=ev.target.closest('.ym-play');if(!b)return;b.outerHTML=`<iframe src="https://www.youtube-nocookie.com/embed/${b.dataset.v}?autoplay=1" width="100%" height="200" style="border:0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" title="بث مباشر"></iframe>`})
  }catch(e){$('streams').innerHTML='<p class="muted">تعذر تحميل قائمة القنوات.</p>'}
}
async function loadCams(){
  try{const c=await getJson('./data/yemen-cameras.json');const cams=c.cameras||[];$('camCount').textContent=num(cams.length);
    if(!cams.length){$('cams').innerHTML='<p class="muted">لا توجد كاميرات موثقة في السجل حاليًا. لم نجد بثًا عامًا رسميًا لكاميرات مراقبة داخل اليمن يمكن تضمينه بأمان وبشكل قانوني. لن نضيف كاميرات مخترَقة أو غير مؤمَّنة. اقترح كاميرا تملك حق نشرها عبر <a href="https://github.com/ShehataElsayed/osint-arabic-sources/issues/new?title=%D8%A7%D9%82%D8%AA%D8%B1%D8%A7%D8%AD+%D9%83%D8%A7%D9%85%D9%8A%D8%B1%D8%A7" rel="noopener">بلاغ على GitHub</a>.</p>';return}
    $('cams').innerHTML=cams.map(c=>`<div class="ym-item"><b>${esc(c.name)}</b><small>${esc(c.owner||'')} · تم الفحص: ${esc(c.checked_on||'')}</small>${c.embed_url&&/^https:/.test(c.embed_url)?`<iframe src="${esc(c.embed_url)}" width="100%" height="200" style="border:0" loading="lazy" allowfullscreen referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin" title="${esc(c.name)}"></iframe>`:''}${c.page_url?`<a href="${esc(c.page_url)}" target="_blank" rel="noopener">فتح الصفحة الأصلية</a>`:''}</div>`).join('');
    if(window.L)cams.filter(c=>c.lat&&c.lon).forEach(c=>L.marker([c.lat,c.lon]).addTo(map).bindPopup(esc(c.name)))}
  catch(e){}
}
async function loadEvents(){
  const d=await getJson('./data/yemen-events.json');EV=d.events.map(ev);
  AR=d.ar||AR;try{TR=await getJson('./data/yemen-translations.json')}catch(e){}
  if($('lastEv'))$('lastEv').textContent=d.last_event;$('ver').textContent=d.version;
  const govs=[...new Set(EV.map(e=>gAr(e.gov)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
  if($('fGov').options.length<2)$('fGov').insertAdjacentHTML('beforeend',govs.map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join(''));
}
async function boot(){
  map=L.map('map',{center:[15.5,47.5],zoom:6,minZoom:5,maxZoom:14,worldCopyJump:false});
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© مساهمو <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · بيانات الأحداث: UCDP GED (CC BY 4.0)',maxZoom:18}).addTo(map);
  renderer=L.canvas({padding:.5});
  heat=L.heatLayer([],{radius:18,blur:20,maxZoom:9,minOpacity:.35,gradient:{.2:'#ffe08a',.45:'#f5a623',.7:'#d9480f',1:'#8b0000'}}).addTo(map);
  ptsLayer=L.layerGroup().addTo(map);sigLayer=L.layerGroup().addTo(map);
  map.on('moveend',()=>{if($('inView').checked)drawList()});
  await loadEvents();init2();loadParams();render();loadNews();loadCams();loadStreams();loadSignals();
  setInterval(()=>{loadNews();loadCams()},600000);setInterval(loadSignals,300000);$('sigShow').addEventListener('change',drawSignals);$('sigWin').addEventListener('change',drawSignals);
  $('sigList').addEventListener('click',e=>{const b=e.target.closest('.sig');if(!b)return;const g=sigRowsCache[+b.dataset.i];if(g){map.setView([g.lat,g.lon],Math.max(map.getZoom(),9));L.popup().setLatLng([g.lat,g.lon]).setContent(sigPopup(g)).openOn(map)}});
  setInterval(async()=>{try{await loadEvents();render()}catch(e){}},3600000);
}
boot().catch(e=>{$('stats').innerHTML='<p class="muted">تعذر تحميل بيانات الأحداث.</p>'});
})();
