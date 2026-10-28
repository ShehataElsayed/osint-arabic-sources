// تحليل بصري محلي للصورة: بيانات وصفية، فرق إعادة ضغط، خريطة ضوضاء، وروابط بحث عكسي بإذن صريح.
// كل المخرجات مؤشرات مراجعة بشرية؛ لا تكشف التزييف ولا تحكم بالأصالة.
import{verificationQuestions}from'./image-review-core.js';
import{scanJpeg,parseExif,estimateQuality,scanPng,noiseMap,extractExifThumbnail,luminanceGradient,levelSweep,channelHistogram,extractStrings,detectClones,pcaProjections,enhanceRegion}from'./image-analysis-core.js';
const $=(root,id)=>root.querySelector(id);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
const fold=(summaryText)=>{const d=el('details',undefined,'analysis-fold');const s=document.createElement('summary');s.textContent=summaryText;const body=el('div',undefined,'fold-body');d.append(s,body);return{fold:d,body}};
const iso=v=>'\u2066'+v+'\u2069';
const EXIF_LABELS={make:'الشركة المصنعة للكاميرا',model:'طراز الكاميرا',software:'برنامج آخر تعديل',captured:'تاريخ الالتقاط المدعى',digitized:'تاريخ الرقمنة',modified:'تاريخ آخر تعديل',orientation:'الاتجاه',exposureSeconds:'زمن التعريض (ثانية)',fNumber:'فتحة العدسة',iso:'حساسية ISO',focalLengthMm:'البعد البؤري (مم)',artist:'حقل المؤلف',copyright:'حقل الحقوق',pixelWidth:'عرض البكسل المسجل',pixelHeight:'ارتفاع البكسل المسجل'};

// بطاقة نتيجة مهنية لكل طبقة: ملاحظة مرصودة من قيم الطبقة نفسها، دلالتها وحدودها، ثم خطوة التحقق التالية.
const resultCard=(obs,sig,next)=>{const c=el('div',undefined,'layer-result');
 const row=(label,text,cls)=>{const p=document.createElement('p');p.className=cls;const s=el('span',label);p.append(s,document.createTextNode(text));c.append(p)};
 row('الملاحظة',obs,'obs');row('الدلالة والحدود',sig,'sig');row('خطوة التحقق',next,'next');return c};

// فرق إعادة ضغط عند جودة مختارة: إحصاءات فروق خام (متوسط/أقصى/نسبة فوق عتبة) وخريطة مكبَّرة للعرض
async function elaCanvas(bitmap,maxSide=1400,quality=.9){
 const scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height)),w=Math.max(1,Math.round(bitmap.width*scale)),h=Math.max(1,Math.round(bitmap.height*scale));
 const a=document.createElement('canvas');a.width=w;a.height=h;const ax=a.getContext('2d',{willReadFrequently:true});ax.drawImage(bitmap,0,0,w,h);
 const original=ax.getImageData(0,0,w,h);
 const dataUrl=a.toDataURL('image/jpeg',quality);
 const img=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>rej(Error('تعذرت إعادة ضغط المعاينة'));im.src=dataUrl});
 const b=document.createElement('canvas');b.width=w;b.height=h;b.getContext('2d').drawImage(img,0,0,w,h);
 const recompressed=b.getContext('2d').getImageData(0,0,w,h);
 const A=original.data,B=recompressed.data,n=A.length/4,out=new Uint8ClampedArray(A.length);
 let sum=0,max=0,over=0;
 for(let i=0;i<n;i++){const o=i*4;let d=0;
  for(let c=0;c<3;c++){const dd=Math.abs(A[o+c]-B[o+c]);if(dd>d)d=dd}
  sum+=d;if(d>max)max=d;if(d>10)over++;
  const v=Math.min(255,d*20);out[o]=out[o+1]=out[o+2]=v;out[o+3]=255}
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 canvas.getContext('2d').putImageData(new ImageData(out,w,h),0,0);
 return{canvas,width:w,height:h,mean:+(sum/n).toFixed(2),max,pct:+(over/n*100).toFixed(2)}}

function noiseCanvas(bitmap,maxSide=1400){
 const scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height)),w=Math.max(1,Math.round(bitmap.width*scale)),h=Math.max(1,Math.round(bitmap.height*scale));
 const a=document.createElement('canvas');a.width=w;a.height=h;const ax=a.getContext('2d',{willReadFrequently:true});ax.drawImage(bitmap,0,0,w,h);
 const pixels=ax.getImageData(0,0,w,h);
 const n=noiseMap(pixels.data,w,h,2,8);
 const out=document.createElement('canvas');out.width=w;out.height=h;
 out.getContext('2d').putImageData(new ImageData(n.output,w,h),0,0);
 // نسبة البكسلات التي ينحرف أي من قنواتها بأكثر من 8 مستويات (قبل التكبير ×8)
 let over=0;for(let i=0;i<n.output.length;i+=4){if(n.output[i]>=64||n.output[i+1]>=64||n.output[i+2]>=64)over++}
 return{canvas:out,width:w,height:h,mean:+n.mean.toFixed(2),max:+n.max.toFixed(1),pct:+(over/(w*h)*100).toFixed(2)}}

export async function analyzeImage({file,bytes,bitmap,box,say,isStale,hashes}){
 box.replaceChildren();
 const result={fields:{},gps:null,jpeg:null,figures:[],warnings:[]};
 const head=el('div',undefined,'analysis-head');
 head.append(el('p','البيانات الوصفية قد تُعدَّل أو تُحذف، والعروض البصرية مؤشرات مراجعة لا حكم أصالة.','hint'));
 box.append(head);
 let struct=null;
 try{
  if(file.type==='image/jpeg'){struct=scanJpeg(bytes);
   result.jpeg={tables:struct.dqt.length,comments:struct.comments,sof:struct.sof,markers:struct.markers.length};
   if(struct.dqt.length)result.jpeg.estimate=estimateQuality(struct.dqt);
   if(struct.exif){try{result.fields=parseExif(struct.exif);result.gps=result.fields.gps||null;delete result.fields.gps}catch(e){result.warnings.push('تعذر تحليل EXIF: '+e.message)}}
   else result.warnings.push('لا توجد بيانات EXIF في الملف (شائع بعد إعادة النشر).')}
  else if(file.type==='image/png'){struct=scanPng(bytes);
   result.png={chunks:struct.chunks.length,texts:struct.texts};
   if(struct.exif){try{result.fields=parseExif(struct.exif);result.gps=result.fields.gps||null;delete result.fields.gps}catch(e){result.warnings.push('تعذر تحليل eXIf: '+e.message)}}
   else result.warnings.push('لا توجد بيانات eXIf في PNG.')}
  else result.warnings.push('قراءة البنية الوصفية مدعومة لـ JPEG وPNG؛ لهذا النوع تُعرض الأبعاد والبصمة فقط.')}
 catch(e){result.warnings.push(e.message)}
 if(isStale())return result;
 // الخلاصة أولًا: الحقائق الحاسمة للمراجع قبل أي تفصيل
 const facts=[];
 const cam=[result.fields.make,result.fields.model].filter(Boolean).join(' ');
 if(cam)facts.push(['الكاميرا المسجلة',cam,false]);
 if(result.fields.software)facts.push(['برنامج آخر تعديل',result.fields.software,true]);
 if(result.fields.captured)facts.push(['تاريخ الالتقاط المدعى',result.fields.captured,false]);
 if(result.jpeg&&result.jpeg.estimate)facts.push(['تقدير جودة ضغط JPEG','نحو '+result.jpeg.estimate.quality+'%',false]);
 if(!facts.length)facts.push(['البيانات الوصفية','لا بيانات مقروءة في الملف'+(result.warnings.length?' — شائع بعد إعادة النشر':''),false]);
 const sum=el('div',undefined,'analysis-summary');
 for(const[label,value,signal]of facts){const f=el('div',undefined,'fact'+(signal?' signal':''));f.append(el('small',label),el('b',value));sum.append(f)}
 if(result.gps&&Number.isFinite(result.gps.lat)){const gf=el('div',undefined,'fact signal');gf.append(el('small','إحداثيات مسجلة'));const gb=document.createElement('b');gb.append('خط العرض: ');const la=document.createElement('span');la.dir='ltr';la.textContent=result.gps.lat;gb.append(la,document.createTextNode(' — خط الطول: '));const lo=document.createElement('span');lo.dir='ltr';lo.textContent=result.gps.lon;gb.append(lo);gf.append(gb);sum.append(gf)}
 box.append(sum);
 const meta=el('div',undefined,'analysis-meta');
 const rows=[];
 for(const[k,label]of Object.entries(EXIF_LABELS)){const v=result.fields[k];if(v===undefined||v==='')continue;rows.push(label+': '+(Array.isArray(v)?v.join(', '):v))}
 if(result.jpeg){rows.push('بنية JPEG: '+result.jpeg.markers+' مقطعًا، '+result.jpeg.tables+' جدول تكميم'+(result.jpeg.sof?'، '+result.jpeg.sof.width+'×'+result.jpeg.sof.height+' '+result.jpeg.sof.coding:''));
  if(result.jpeg.estimate)rows.push('تقدير جودة ضغط JPEG: نحو '+result.jpeg.estimate.quality+'% ('+result.jpeg.estimate.note+')');
  if(result.jpeg.comments.length)rows.push('تعليق مضمّن: '+result.jpeg.comments.join(' | '))}
 if(result.png){rows.push('بنية PNG: '+result.png.chunks+' مقطعًا'+(result.png.texts.length?'، حقول نصية: '+result.png.texts.map(t=>t.key+'='+t.value).join(' | '):''))}
 if(hashes){rows.push('بصمة إدراكية aHash (64 بت): '+hashes.ahash);rows.push('بصمة إدراكية dHash (64 بت): '+hashes.dhash)}
 for(const w of result.warnings)rows.push('ملاحظة: '+w);
 if(hashes)meta.append(el('p','البصمتان الإدراكيتان قيمتان خام للمقارنة البتّية (مسافة Hamming) بين نسختين: قيمة أقرب بتّيًا مؤشر تشابه بلا عتبة قاطعة، ولا يُستدل على التقارب من شكل النص الست عشري.','hint'));
 meta.append(el('pre',rows.length?rows.join('\n'):'لا بيانات وصفية مقروءة في هذا الملف.'));
 const qp=el('div',undefined,'analysis-questions');
 qp.append(el('h3','أسئلة تحقق مقترحة'));
 qp.append(el('p','مولّدة من حضور البيانات الوصفية أو غيابها؛ تساعد مراجعتك ولا تحكم على الصورة.','hint'));
 for(const q of verificationQuestions(result))qp.append(el('p','• '+q));
 box.append(qp);
 // الحقول وبنية الملف قبل أقسام الإحداثيات: يبقى pre البيانات هو الأول في الحاوية (توافق المستدعين)
 const metaFold=fold('كل الحقول المقروءة وبنية الملف ('+rows.length+' سطرًا)');
 metaFold.body.append(meta);box.append(metaFold.fold);
 let gpsDiv=null;
 if(result.gps&&Number.isFinite(result.gps.lat)){
  const g=el('div',undefined,'analysis-gps'),{lat,lon}=result.gps;gpsDiv=g;
  const gp=document.createElement('p');gp.append('إحداثيات مسجلة في الملف — خط العرض: ');const gla=document.createElement('span');gla.dir='ltr';gla.textContent=lat;gp.append(gla,document.createTextNode('، خط الطول: '));const glo=document.createElement('span');glo.dir='ltr';glo.textContent=lon;gp.append(glo);if(Number.isFinite(result.gps.altitude))gp.append(document.createTextNode(' · ارتفاع '+result.gps.altitude+' م'));gp.append(document.createTextNode(' — كما كتبها الجهاز أو أي محرر لاحق، لا تثبت مكان الالتقاط.'));
  g.append(gp);
  const map=document.createElement('a');map.textContent='افتح الإحداثيات في خريطة OpenStreetMap (تبويب جديد)';map.href='https://www.openstreetmap.org/?mlat='+lat+'&mlon='+lon+'#map=14/'+lat+'/'+lon;map.target='_blank';map.rel='noopener';g.append(map);
  const geoBtn=el('button','ابحث عن وصف المكان من الإحداثيات عبر Nominatim (يرسل الإحداثيات فقط، ولا يرسل الملف)');
  const out=el('pre');out.hidden=true;
  geoBtn.onclick=async()=>{geoBtn.disabled=true;out.hidden=false;out.textContent='استعلام خارجي بإذنك من الزر…';
   try{const endpoint=new URL('https://nominatim.openstreetmap.org/reverse');endpoint.searchParams.set('lat',lat);endpoint.searchParams.set('lon',lon);endpoint.searchParams.set('format','jsonv2');endpoint.searchParams.set('accept-language','ar,en');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    let r;try{const res=await fetch(endpoint,{signal:controller.signal,credentials:'omit',referrerPolicy:'strict-origin'});if(!res.ok)throw Error('HTTP '+res.status);r=await res.json()}finally{clearTimeout(timer)}
    if(isStale())return;
    out.textContent='الوصف المرتجع: '+(r.display_name||'لا وصف')+'\nالمصدر: '+endpoint.href+'\nالمساهمون: © OpenStreetMap contributors، رخصة ODbL\nتنبيه: الوصف عنوان إداري تقريبي عند هذه النقطة، وليس تأكيدًا لمكان الالتقاط.'}
   catch(e){if(!isStale())out.textContent='تعذر الاستعلام: '+e.message+' — لم يُضف أي وصف.'}
   finally{geoBtn.disabled=false}};
  g.append(geoBtn,out);box.append(g)}
 const piv=el('div',undefined,'analysis-pivots');
 piv.append(el('h3','بحث عكسي عن نسخ منشورة (اختياري)'),el('p','ألصق رابط الصورة كما نُشرت. فتح أي خدمة يرسل الرابط إليها فقط ولا يرفع ملفك؛ لا تفتح الروابط إن كان الرابط خاصًا.','hint'));
 const urlInput=document.createElement('input');urlInput.type='url';urlInput.id='pivot-url';urlInput.placeholder='https://example.com/photo.jpg';urlInput.maxLength=2000;
 const links=el('div',undefined,'actions');piv.append(urlInput,links);
 const renderLinks=()=>{links.replaceChildren();let u;try{u=new URL(urlInput.value.trim())}catch{return}
  if(!/^https?:$/.test(u.protocol))return;
  const enc=encodeURIComponent(u.href);
  for(const[name,href]of[['Google Lens','https://lens.google.com/uploadbyurl?url='+enc],['TinEye','https://tineye.com/search?url='+enc],['Yandex Images','https://yandex.com/images/search?rpt=imageview&url='+enc]]){const a=document.createElement('a');a.textContent=name;a.href=href;a.target='_blank';a.rel='noopener';links.append(a)}};
 urlInput.oninput=renderLinks;
 box.append(piv);
 if(isStale())return result;
 say('يُحسب فرق إعادة الضغط وخريطة الضوضاء محليًا…');
 const deepFold=fold('الطبقات البصرية العميقة: فرق إعادة الضغط، الضوضاء، النسخ، التدرج، المستويات، المدرج، PCA، المكبّر');
 deepFold.fold.classList.add('analysis-deep');
 deepFold.body.append(el('p','كل طبقة تعرض ملاحظتها المرصودة ودلالتها وخطوة التحقق التالية؛ جميعها مؤشرات مراجعة لا أحكام أصالة.','hint'));
 // متصفح الطبقات: تبويب طبقة مركّزة أو شبكة كاملة
 const viewer=el('div',undefined,'layer-viewer');
 const tabs=el('div',undefined,'ia-tabs');tabs.setAttribute('role','tablist');
 const gridToggle=el('button','عرض كل الطبقات معًا كشبكة','ia-grid-toggle');gridToggle.type='button';gridToggle.setAttribute('aria-pressed','false');
 const figs=el('div',undefined,'analysis-figures');
 viewer.append(tabs,gridToggle,figs);
 deepFold.body.append(viewer);
 const layers=[];
 const activate=idx=>{layers.forEach((L,i)=>{L.tab.setAttribute('aria-selected',i===idx?'true':'false');L.figure.classList.toggle('active',i===idx)});
  figs.classList.remove('grid');gridToggle.textContent='عرض كل الطبقات معًا كشبكة';gridToggle.setAttribute('aria-pressed','false')};
 const addLayer=(label,figure,{signal=false}={})=>{
  const idx=layers.length;const tab=el('button',label,'ia-tab');tab.type='button';tab.setAttribute('role','tab');tab.setAttribute('aria-selected','false');
  if(signal)tab.classList.add('signal');
  tab.onclick=()=>activate(idx);tabs.append(tab);figs.append(figure);layers.push({tab,figure});return idx};
 gridToggle.onclick=()=>{const on=!figs.classList.contains('grid');figs.classList.toggle('grid',on);
  gridToggle.textContent=on?'عرض طبقة واحدة مركّزة':'عرض كل الطبقات معًا كشبكة';gridToggle.setAttribute('aria-pressed',String(on))};
 try{const ela0=await elaCanvas(bitmap);if(isStale())return result;
  const f1=el('figure');
  const elaCtl=el('div',undefined,'ela-ctl');
  const elaRange=document.createElement('input');elaRange.type='range';elaRange.min='50';elaRange.max='95';elaRange.step='5';elaRange.value='90';elaRange.setAttribute('aria-label','جودة إعادة الحفظ');
  const elaQ=el('span','جودة إعادة الحفظ: 90%');
  elaCtl.append(el('span','أعد الحفظ عند: '),elaRange,elaQ);
  const elaCap=el('figcaption','فرق إعادة ضغط JPEG — يقيس تغيّر كل بكسل بعد إعادة الحفظ بالجودة المختارة (الفروق مكبَّرة ×20 للعرض).');
  const cardHolder=el('div');
  const elaRender=r=>{const q=+elaRange.value;cardHolder.replaceChildren(resultCard(
   'عند جودة إعادة حفظ '+q+'%: متوسط تغيّر البكسل '+r.mean+' من 255، أقصى تغيّر '+r.max+'، و'+r.pct+'% من البكسلات يتجاوز تغيّرها 10 مستويات.',
   'المناطق المحفوظة بجودة مختلفة أو المعدَّلة بعد آخر حفظ قد تظهر أوضح من محيطها؛ والحواف والنصوص تضيء في الصور السليمة أيضًا، فهو مؤشر مراجعة لا دليل تلاعب.',
   'حرّك مؤشر الجودة وقارن الاستجابة؛ بقعة تضيء ثابتة عند كل المستويات تستحق الفحص بالمكبّر، واستجابة ضعيفة متجانسة قرب الجودة المقدَّرة للملف تتوافق مع حفظ متجانس واحد.'))};
  elaRender(ela0);
  let elaTimer=null;
  elaRange.oninput=()=>{const q=+elaRange.value;elaQ.textContent='جودة إعادة الحفظ: '+q+'%';
   clearTimeout(elaTimer);elaTimer=setTimeout(async()=>{try{const r=await elaCanvas(bitmap,1400,q/100);if(isStale())return;
    const ctx=f1.querySelector('canvas').getContext('2d');ctx.clearRect(0,0,r.width,r.height);ctx.drawImage(r.canvas,0,0);elaRender(r)}catch{}},140)};
  f1.append(ela0.canvas,elaCtl,elaCap,cardHolder);addLayer('إعادة الضغط',f1);activate(0);
  result.figures.push({kind:'ela',mean:ela0.mean,max:ela0.max})}catch(e){result.warnings.push('تعذر فرق إعادة الضغط: '+e.message)}
 try{const nz=noiseCanvas(bitmap);if(isStale())return result;
  const f2=el('figure');
  f2.append(nz.canvas,el('figcaption','خريطة الضوضاء المحلية — انحراف كل بكسل عن متوسط جواره (مكبَّر ×8 للعرض).'),
   resultCard('متوسط انحراف البكسل عن متوسط جواره '+nz.mean+' (أقصى '+nz.max+')؛ '+nz.pct+'% من البكسلات تنحرف بأكثر من 8 مستويات.',
   'اختلاف مستوى الضوضاء بين منطقة وأخرى قد يشير إلى مصدر أو معالجة مختلفة؛ وإعادة الضغط أو التحجيم توحّد الضوضاء، فالخريطة مؤشر لا حكم.',
   'قارن المناطق الداكنة والفاتحة بالصورة الأصلية، وراجع أي انتقال مفاجئ في مستوى الضوضاء حول العناصر الرئيسية بالمكبّر.'));
  addLayer('الضوضاء',f2);
  result.figures.push({kind:'noise',mean:nz.mean,max:nz.max})}catch(e){result.warnings.push('تعذرت خريطة الضوضاء: '+e.message)}
 box.append(deepFold.fold);
 if(isStale())return result;
 // طبقات تحليل إضافية على نسخة مصغرة: كشف النسخ، التدرج، المدرج، مسح المستويات
 try{
  const scale=Math.min(1,500/Math.max(bitmap.width,bitmap.height)),w=Math.max(1,Math.round(bitmap.width*scale)),h=Math.max(1,Math.round(bitmap.height*scale));
  const base=document.createElement('canvas');base.width=w;base.height=h;base.getContext('2d',{willReadFrequently:true}).drawImage(bitmap,0,0,w,h);
  const px=base.getContext('2d').getImageData(0,0,w,h);
  if(isStale())return result;
  // كشف نسخ-لصق المناطق
  const clones=detectClones(px.data,w,h);
  const f3=el('figure');
  const overlay=document.createElement('canvas');overlay.width=w;overlay.height=h;
  const ox=overlay.getContext('2d');
  const colors=['#e02424','#f59e0b','#2563eb','#059669','#7c3aed','#db2777'];
  const drawClone=sel=>{ox.globalAlpha=1;ox.clearRect(0,0,w,h);ox.drawImage(base,0,0);
   clones.groups.forEach((g,gi)=>{ox.globalAlpha=(sel==null||sel===gi)?1:.12;
    const c=colors[gi%colors.length];ox.strokeStyle=c;ox.lineWidth=2;
    for(const pr of g.pairs){ox.strokeRect(pr.ax-8,pr.ay-8,16,16);ox.strokeRect(pr.bx-8,pr.by-8,16,16)}
    const sample=g.pairs.filter((_,i)=>i%Math.ceil(g.pairs.length/25)===0);
    ox.lineWidth=1;for(const pr of sample){ox.beginPath();ox.moveTo(pr.ax+8,pr.ay+8);ox.lineTo(pr.bx+8,pr.by+8);ox.stroke()}});
   ox.globalAlpha=1};
  drawClone(null);
  f3.append(overlay);
  let cloneObs,cloneSig,cloneNext;
  if(clones.groups.length){
   const gl=el('div',undefined,'clone-groups');
   const mkBtn=(label,sel)=>{const b=el('button',label);b.type='button';b.setAttribute('aria-pressed','false');
    b.onclick=()=>{gl.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed','false'));b.setAttribute('aria-pressed','true');drawClone(sel)};
    gl.append(b);return b};
   const allB=mkBtn('كل الأنماط',null);allB.setAttribute('aria-pressed','true');
   clones.groups.forEach((g,gi)=>mkBtn(iso('X: '+g.dx+' · Y: '+g.dy)+' — '+g.count+' كتلة',gi));
   f3.append(gl);
   cloneObs='رُصد '+clones.groups.length+' نمط تكرار بإزاحة ثابتة؛ أوضحها إزاحة محور X: '+iso(clones.groups[0].dx)+' ومحور Y: '+iso(clones.groups[0].dy)+' تتكرر في '+clones.groups[0].count+' كتلة متطابقة، معلَّمة بالألوان فوق الصورة.';
   cloneSig='تطابق كتل كثيرة بالإزاحة نفسها نمط معتاد في النسخ-لصق داخل الصورة؛ لكن القوام المتكرر طبيعيًا (نوافذ، بلاط، سماء) قد يُعلَّم أيضًا، فالعلامة سبب للفحص لا حكم بالتلاعب.';
   cloneNext='بدّل بين الأنماط بالأزرار أعلاه، وقارن كل منطقة معلَّمة بمقابلتها في الأصل عبر المكبّر: تطابق الحواف والظلال والنسيج الدقيق بين منطقتين سبب للتوسع في الفحص.'}
  else{cloneObs='لم يُرصد تكرار كتل بنفس الإزاحة فوق العتبات ('+clones.blocks+' كتلة قابلة للفحص على نسخة بعرض '+iso(w)+' وارتفاع '+iso(h)+').';
   cloneSig='غياب الرصد لا يعني سلامة الصورة: نسخ أصغر من حجم الكتلة أو معاد تحجيمه أو مموّه قد لا يُرصد عند هذه الإعدادات.';
   cloneNext='إن اشتبهت في منطقة بعينها، افحصها بالمكبّر وقارن تفاصيلها الدقيقة بمحيطها، وجرّب نسخة أعلى دقة من الصورة إن توفرت.'}
  f3.append(el('figcaption','كشف مناطق منسوخة محتملة — مطابقة كتل بمعاملات DCT مكمّمة على نسخة بعرض '+iso(w)+' وارتفاع '+iso(h)+' من الصورة.'),
   resultCard(cloneObs,cloneSig,cloneNext));
  const cloneIdx=addLayer('النسخ',f3,{signal:clones.groups.length>0});
  if(clones.groups.length){activate(cloneIdx);result.cloneSignal=true;
   const sf=el('div',undefined,'fact signal');sf.append(el('small','مؤشر يستحق المراجعة'));
   sf.append(el('b','طبقة النسخ: '+clones.groups.length+' نمط تكرار بإزاحة ثابتة — افحصه في الطبقات العميقة قبل أي استنتاج.'));
   sum.prepend(sf)}
  result.figures.push({kind:'clone-detection',groups:clones.groups.map(g=>({dx:g.dx,dy:g.dy,count:g.count}))});
  // التدرج الإضاءي
  const grad=luminanceGradient(px.data,w,h);
  let edgeCount=0;for(let i=0;i<grad.output.length;i+=4){if(grad.output[i]>40)edgeCount++}
  const edgePct=+(edgeCount/(w*h)*100).toFixed(2);
  const f4=el('figure'),gc=document.createElement('canvas');gc.width=w;gc.height=h;
  gc.getContext('2d').putImageData(new ImageData(grad.output,w,h),0,0);
  f4.append(gc,el('figcaption','التدرج الإضاءي — قوة تغيّر الإضاءة عند كل بكسل (مكبَّرة للعرض)؛ الحواف القوية فقط تضيء.'),
   resultCard('كثافة الحواف: '+edgePct+'% من البكسلات تظهر كحواف قوية في هذه النسخة.',
   'تفاوت حدة الحواف حول عنصر دون سواه قد ينسجم مع تركيب أو إعادة تحجيم موضعية؛ والحواف الحادة طبيعية في الصور السليمة.',
   'قارن حواف العناصر الرئيسية بخلفيتها المحيطة؛ حافة مختلفة الحدة حول عنصر واحد افحصها بالمكبّر.'));
  addLayer('التدرج',f4);result.figures.push({kind:'luminance-gradient'});
  // مسح المستويات التفاعلي
  const f5=el('figure'),sc=document.createElement('canvas');sc.width=w;sc.height=h;
  const sweep=document.createElement('input');sweep.type='range';sweep.min=0;sweep.max=255;sweep.value=128;sweep.setAttribute('aria-label','مستوى السطوع المفحوص');
  const cap5=el('figcaption');
  const card5=el('div');
  const draw=()=>{const r=levelSweep(px.data,+sweep.value,10);sc.getContext('2d').putImageData(new ImageData(r.output,w,h),0,0);
   cap5.textContent='مسح المستويات — عزل البكسلات القريبة من مستوى سطوع مختار (نافذة ±5).';
   card5.replaceChildren(resultCard('المستوى '+sweep.value+' معروض الآن: البكسلات ضمن ±5 منه فقط مضاءة.',
    'تجمّع مفاجئ أو شريط ضيق غير معتاد عند مستوى واحد قد يوحي بتعديل مستويات سابق؛ وهو استكشاف بصري لا حكم.',
    'امسح النطاق كاملًا ببطء؛ أي شكل يظهر عند مستوى واحد فقط افحص موضعه بالمكبّر.'))};
  sweep.oninput=draw;draw();
  f5.append(sc,cap5,sweep,card5);addLayer('المستويات',f5);result.figures.push({kind:'level-sweep',interactive:true});
  // المدرج التكراري
  const hist=channelHistogram(px.data),hc=document.createElement('canvas');hc.width=512;hc.height=140;
  const hx=hc.getContext('2d');hx.fillStyle='#111';hx.fillRect(0,0,512,140);
  const drawCh=(arr,color,alpha)=>{hx.globalAlpha=alpha;hx.fillStyle=color;for(let i=0;i<256;i++){const v=arr[i]/hist.max,barH=Math.max(1,Math.round(v*130));hx.fillRect(i*2,138-barH,2,barH)}hx.globalAlpha=1};
  drawCh(hist.r,'#e02424',.75);drawCh(hist.g,'#059669',.75);drawCh(hist.b,'#2563eb',.75);
  const gaps=a=>{let lo=0,hi=255;while(lo<256&&!a[lo])lo++;while(hi>=0&&!a[hi])hi--;let g=0;for(let i=lo;i<=hi;i++)if(!a[i])g++;return g};
  const gapsTotal=gaps(hist.r)+gaps(hist.g)+gaps(hist.b);
  const peak=hist.l.indexOf(Math.max(...hist.l));
  const f6=el('figure');
  f6.append(hc,el('figcaption','المدرج التكراري للقنوات اللونية (أحمر/أخضر/أزرق) — توزيع قيم البكسلات على 256 مستوى.'),
   resultCard('قمة الإضاءة عند القيمة '+peak+'، و'+gapsTotal+' فجوة فارغة داخل النطاق المستخدم في القنوات الثلاث مجتمعة.',
   'فجوات متكررة منتظمة (أسنان مشط) كثيرًا ما تخلّفها تعديلات المستويات أو التباين، لكنها طبيعية في الصور محدودة الألوان؛ ليست دليلًا بذاتها.',
   'قارن المدرج مع مدرج نسخة أقدم من الصورة إن توفرت، وراجع أي انتظام مفاجئ في الفجوات بعين ناقدة.'));
  addLayer('المدرج',f6);result.figures.push({kind:'histogram',max:hist.max});
  // PCA: projection onto the three principal components, each normalized for display
  const pca=pcaProjections(px.data,w,h);
  const f7=el('figure');f7.className='analysis-pca';
  const pwrap=el('div');pwrap.className='pca-panes';
  const paneNames=['الأول','الثاني','الثالث'];
  pca.components.forEach((comp,k)=>{const pc=document.createElement('canvas');pc.width=w;pc.height=h;
   const out=new Uint8ClampedArray(w*h*4);for(let p=0,i=0;p<w*h;p++,i+=4){out[i]=out[i+1]=out[i+2]=comp[p];out[i+3]=255}
   pc.getContext('2d').putImageData(new ImageData(out,w,h),0,0);
   const pane=el('div');pane.append(pc,el('span','المكوّن '+paneNames[k]+' — تباين '+pca.variances[k]));pwrap.append(pane)});
  const vTotal=pca.variances[0]+pca.variances[1]+pca.variances[2]||1;
  const vp=pca.variances.map(v=>Math.round(v/vTotal*100));
  f7.append(pwrap,el('figcaption','تحليل المكونات الرئيسية (PCA): إسقاط قنوات اللون على المحاور الثلاثة الأكثر تباينًا، كل مكوّن مُطبَّع للعرض.'),
   resultCard('توزيع تباين اللون على المكونات: الأول '+vp[0]+'%، الثاني '+vp[1]+'%، الثالث '+vp[2]+'%.',
   'منطقة تظهر بوضوح في مكوّن فرعي دون الأول قد تختلف بنيتها اللونية عن بقية الصورة؛ وهو عرض استكشافي لا حكم.',
   'ابحث عن بقع تضيء في المكوّن الثاني أو الثالث فقط، وافحص مواضعها في الصورة الأصلية بالمكبّر.'));
  addLayer('PCA',f7);result.figures.push({kind:'pca',variances:pca.variances});
  // Magnifier: interactive lens over the image with optional local enhancement
  const f8=el('figure');f8.className='analysis-magnifier';
  const magBase=document.createElement('canvas');magBase.width=w;magBase.height=h;magBase.getContext('2d').drawImage(bitmap,0,0,w,h);
  const lens=document.createElement('canvas');lens.width=220;lens.height=220;lens.className='magnifier-lens';
  const magCtl=el('div');magCtl.className='magnifier-ctl';
  const magRange=document.createElement('input');magRange.type='range';magRange.min='2';magRange.max='16';magRange.step='1';magRange.value='4';magRange.setAttribute('aria-label','التكبير');
  const magMode=document.createElement('select');magMode.setAttribute('aria-label','التحسين');
  [['none','بلا تحسين'],['equalize','موازنة المدرج التكراري'],['auto-contrast','تباين تلقائي']].forEach(([val,label])=>{const o=document.createElement('option');o.value=val;o.textContent=label;magMode.append(o)});
  const magHint=el('span','حرّك المؤشر فوق الصورة');
  magCtl.append(el('span','التكبير: '),magRange,el('span',' التحسين: '),magMode,magHint);
  const src=document.createElement('canvas');const srcCtx=src.getContext('2d',{willReadFrequently:true});
  const drawLens=(cx,cy)=>{const mag=+magRange.value,size=Math.max(8,Math.round(220/mag));
   const sx=Math.min(Math.max(0,Math.round(cx-size/2)),Math.max(0,w-size)),sy=Math.min(Math.max(0,Math.round(cy-size/2)),Math.max(0,h-size));
   const sw=Math.min(size,w-sx),sh=Math.min(size,h-sy);if(sw<1||sh<1)return;
   src.width=sw;src.height=sh;srcCtx.drawImage(magBase,sx,sy,sw,sh,0,0,sw,sh);
   const region=srcCtx.getImageData(0,0,sw,sh);
   try{enhanceRegion(region.data,{mode:magMode.value})}catch{}
   const lctx=lens.getContext('2d');lens.width=sw;lens.height=sh;lctx.putImageData(region,0,0);
   const scale=220/Math.max(sw,sh);lens.style.width=Math.round(sw*scale)+'px';lens.style.height=Math.round(sh*scale)+'px';
   magHint.textContent='منطقة '+sw+'×'+sh+' بكسل بتكبير '+mag+'×'};
  const point=e=>{const r=magBase.getBoundingClientRect(),cx=(e.clientX-r.left)*w/r.width,cy=(e.clientY-r.top)*h/r.height;if(cx>=0&&cy>=0&&cx<w&&cy<h)drawLens(cx,cy)};
  magBase.addEventListener('pointermove',point);magBase.addEventListener('pointerdown',point);
  magRange.addEventListener('input',()=>drawLens(w/2,h/2));magMode.addEventListener('change',()=>drawLens(w/2,h/2));
  drawLens(w/2,h/2);
  f8.append(magBase,lens,magCtl,el('figcaption','المكبّر: عدسة تفاعلية لفحص منطقة عن قرب مع تحسين محلي اختياري.'),
   resultCard('عدسة تكبير تفاعلية (٢× إلى ١٦×) فوق نسخة بعرض '+iso(w)+' وارتفاع '+iso(h)+' من الصورة، مع تحسين محلي اختياري للمنطقة المعروضة.',
   'التحسين يغيّر العرض فقط ولا يعدّل الملف؛ العدسة أداة فحص تقريب لا مؤشر بذاتها.',
   'افحص بها مواضع العلامات من الطبقات الأخرى: حواف المناطق المعلَّمة في كشف النسخ، والبقع الساطعة في فرق إعادة الضغط وخريطة الضوضاء.'));
  addLayer('المكبّر',f8);result.figures.push({kind:'magnifier',interactive:true});
 }catch(e){result.warnings.push('تعذرت بعض الطبقات: '+e.message)}
 // الصورة المصغرة المضمنة والسلاسل النصية
 let thumbFold=null,strFold=null;
 if(struct&&struct.exif){
  try{const thumb=extractExifThumbnail(struct.exif);
   if(thumb){const tdiv=el('div',undefined,'analysis-thumb');
    const timg=document.createElement('img');timg.src=URL.createObjectURL(new Blob([thumb.data],{type:'image/jpeg'}));timg.alt='الصورة المصغرة المضمنة';timg.style.maxWidth='160px';
    tdiv.append(timg,el('p','المصغرة المسجلة بعرض '+(thumb.width||'?')+' وارتفاع '+(thumb.height||'?')+'، مقابل الصورة بعرض '+bitmap.width+' وارتفاع '+bitmap.height+'. المصغرة قد تبقى من نسخة أقدم بعد التعديل؛ اختلافها عن الصورة المعروضة مؤشر مراجعة مهم.','hint'));
    thumbFold=fold('الصورة المصغرة المضمنة في الملف');thumbFold.body.append(tdiv);box.append(thumbFold.fold);
    result.thumbnail={width:thumb.width,height:thumb.height,bytes:thumb.data.length}}
   else result.warnings.push('لا صورة مصغرة مضمنة.')}catch{}}
 try{const strs=extractStrings(bytes);
  if(strs.length){const spre=el('pre',strs.map(x=>'['+x.offset+'] '+x.text).join('\n'));
   strFold=fold('سلاسل نصية دالة داخل الملف ('+strs.length+')');
   strFold.body.append(el('p','نصوص مخبأة في بنية الملف (أسماء برامج، تعليقات XMP). وجود اسم برنامج تحرير لا يثبت تلاعبًا، وغيابه لا يثبت العكس.','hint'),spre);
   box.append(strFold.fold);
   result.strings=strs.map(x=>x.text.slice(0,120))}}catch{}
 // شريط تنقل سريع بين أقسام النتيجة
 const chips=el('div',undefined,'ia-chips');
 const addChip=(label,target)=>{const b=el('button',label);b.type='button';
  b.onclick=()=>{const d=target.closest('details');if(d)d.open=true;target.scrollIntoView({block:'start',behavior:'smooth'})};
  chips.append(b)};
 if(result.cloneSignal)addChip('مؤشر النسخ المرصود',deepFold.fold);
 addChip('الملخص',sum);addChip('أسئلة التحقق',qp);addChip('الحقول وبنية الملف',metaFold.fold);addChip('الطبقات العميقة',deepFold.fold);
 if(gpsDiv)addChip('الإحداثيات المسجلة',gpsDiv);
 if(thumbFold)addChip('الصورة المصغرة',thumbFold.fold);
 if(strFold)addChip('السلاسل النصية',strFold.fold);
 box.insertBefore(chips,sum);
 return result}
