(function(){'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TYPES={1:'نزاع تشارك فيه حكومة',2:'نزاع بين جماعات غير حكومية',3:'عنف من طرف واحد ضد مدنيين'};
const PREC={1:'موقع الحدث محدد بدقة',2:'ضمن 25 كم من النقطة المعروضة',3:'نقطة مركزية لمديرية، وليست موقع الحدث',4:'نقطة مركزية لمحافظة، وليست موقع الحدث',5:'ميزة خطية أو منطقة غير محددة الحدود',6:'الدولة فقط'};
const num=n=>Number(n).toLocaleString('en-US');
const LIVE='https://raw.githubusercontent.com/ShehataElsayed/osint-arabic-sources/live-data/';
const j=async u=>{const r=await fetch(u);if(!r.ok)throw new Error(u);return r.json()};
const F=['id','d','d2','lat','lon','prec','type','best','low','high','civ','a','b','gov','place','src','head','sd','near','cs'];
const toEv=a=>{const e={};F.forEach((k,i)=>e[k]=a[i]);return e};
async function main(){
  const id=+new URLSearchParams(location.search).get('id'),cand=new URLSearchParams(location.search).get('c')==='1';
  const root=$('dos');
  if(!id){root.innerHTML='<p>لم يُحدَّد حدث. افتح الحدث من الخريطة.</p>';return}
  const d=await j('./data/yemen-events.json');let TR={d:{},h:{}};try{TR=await j('./data/yemen-translations.json')}catch(e){}
  let C={events:[]};try{C=await fetch(LIVE+'yemen-candidate.json').then(r=>{if(!r.ok)throw 0;return r.json()})}catch(e){try{C=await j('./data/yemen-candidate.json')}catch(e2){}}
  const list=cand?C.events:d.events;const row=list.find(a=>a[0]===id);
  if(!row){root.innerHTML='<p>لم يُعثر على هذا الحدث في الملفات الحالية.</p>';return}
  const e=toEv(row),AR=d.ar||{gov:{},party:{}},gAr=g=>AR.gov[g]||g,pAr=p=>AR.party[p]||p;
  const where=e.near?`قرب ${e.near}${e.gov?'، '+gAr(e.gov):''}`:(gAr(e.gov)||'اليمن');
  const td=TR.d[e.place],th=TR.h[e.head];
  document.title=where+' | صفحة حدث';
  const ll=`${e.lat},${e.lon}`;
  const sat=e.prec<=2?`<h3>الصور والخرائط (روابط خارجية)</h3><ul>
<li><a href="https://apps.sentinel-hub.com/eo-browser/?zoom=14&lat=${e.lat}&lng=${e.lon}&themeId=DEFAULT-THEME&datasetId=S2L2A" target="_blank" rel="noopener noreferrer">Sentinel Hub EO Browser</a> للمقارنة بين تواريخ قبل الحدث وبعده</li>
<li><a href="https://browser.dataspace.copernicus.eu/?zoom=14&lat=${e.lat}&lng=${e.lon}" target="_blank" rel="noopener noreferrer">Copernicus Browser</a></li>
<li><a href="https://worldview.earthdata.nasa.gov/?v=${e.lon-.5},${e.lat-.5},${+e.lon+.5},${+e.lat+.5}" target="_blank" rel="noopener noreferrer">NASA Worldview</a> (صور يومية منخفضة الدقة وطبقة الحرارة)</li>
<li><a href="https://www.openstreetmap.org/?mlat=${e.lat}&mlon=${e.lon}#map=14/${e.lat}/${e.lon}" target="_blank" rel="noopener noreferrer">OpenStreetMap</a></li></ul><p class="muted small">الصور قد لا تظهر أثر الحدث، وقد تحجبها الغيوم. الاستنتاج من الصور يحتاج محللًا.</p>`:'<p class="muted small">دقة الموقع لا تسمح بروابط الصور الفضائية لهذا الحدث، لأن النقطة المعروضة ليست موقع الحدث.</p>';
  const today=new Date().toISOString().slice(0,10);
  const ds=cand?'UCDP Candidate (بيانات مبدئية)':'UCDP GED '+(d.version||'');
  const cite=`${ds}، حدث رقم ${e.id}، ${e.d}. جامعة أوبسالا، رخصة CC BY 4.0. عبر خريطة النزاع في اليمن، دليل المصادر المفتوحة للصحفيين العرب، تاريخ الاطلاع ${today}.`;
  root.innerHTML=`<h1>${esc(where)}</h1>
${cand?'<p class="mt">بيانات UCDP مبدئية (شهرية). قد تُعدَّل لاحقًا'+(e.cs&&e.cs!=='Clear'?'. علامة مراجعة من UCDP: '+esc(e.cs):'')+'</p>':''}
<dl><dt>التاريخ</dt><dd>${esc(e.d)}${e.d2!==e.d?' إلى '+esc(e.d2):''}</dd><dt>النوع</dt><dd>${esc(TYPES[e.type])}</dd><dt>الطرفان</dt><dd>${esc(pAr(e.a))} ← ${esc(pAr(e.b))}</dd><dt>المحافظة</dt><dd>${esc(gAr(e.gov))}</dd>
<dt>القتلى</dt><dd>أفضل تقدير ${num(e.best)} (بين ${num(e.low)} و${num(e.high)})، مدنيون: ${num(e.civ)}</dd>
<dt>وصف الموقع</dt><dd>${td?esc(td)+' <span class="mt">ترجمة آلية</span>':'<span class="mt off">لم تُترجم بعد</span>'}</dd>
<dt>عنوان المصدر</dt><dd>${th?esc(th)+' <span class="mt">ترجمة آلية</span>':'<span class="mt off">لم يُترجم بعد</span>'}</dd>
<dt>المصدر</dt><dd>${esc(e.src)}${e.sd?' · '+esc(e.sd):''}</dd>
<dt>الإحداثيات</dt><dd dir="ltr" style="text-align:right">${esc(ll)}</dd></dl>
<details><summary>النص الأصلي (بالإنجليزية)</summary><p dir="ltr" style="text-align:left">${esc(e.place)}<br>${esc(e.head)}<br>${esc(e.a)} → ${esc(e.b)}</p></details>
<section class="ym-unknown"><h3>ما لا نعرفه</h3><ul><li>دقة الموقع ${e.prec} من 6: ${esc(PREC[e.prec])}.</li><li>أعداد القتلى تقديرات منشورة من مصادر إعلامية وغيرها، وليست تحققًا مستقلًا.</li><li>غياب أحداث أخرى عن الخريطة لا يعني عدم وقوعها.</li>${cand?'<li>هذه بيانات مبدئية وقد يُصحَّح الحدث أو يُحذف.</li>':''}<li>اسم المكان الظاهر قد يكون أقرب موقع معروف في GeoNames وليس موقع الحدث.</li></ul></section>
${sat}
<h3>كيف تستشهد</h3><p id="cite" class="cite">${esc(cite)}</p><p><button type="button" id="cp" class="ym-play">نسخ الاستشهاد</button> ${cand?'':`<a href="https://ucdp.uu.se/event/${e.id}" target="_blank" rel="noopener noreferrer">الحدث في موقع UCDP</a>`}</p>`;
  $('cp').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(cite);$('cp').textContent='تم النسخ'}catch(x){}});
}
main().catch(()=>{$('dos').innerHTML='<p>تعذر تحميل بيانات الحدث.</p>'});
})();
