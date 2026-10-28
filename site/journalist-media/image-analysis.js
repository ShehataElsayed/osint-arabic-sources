// تحليل بصري محلي للصورة: بيانات وصفية، فرق إعادة ضغط، خريطة ضوضاء، وروابط بحث عكسي بإذن صريح.
// كل المخرجات مؤشرات مراجعة بشرية؛ لا تكشف التزييف ولا تحكم بالأصالة.
import{scanJpeg,parseExif,estimateQuality,scanPng,noiseMap,extractExifThumbnail,luminanceGradient,levelSweep,channelHistogram,extractStrings,detectClones}from'./image-analysis-core.js';
import{jpegDifference}from'../image-difference-core.js';
const $=(root,id)=>root.querySelector(id);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
const EXIF_LABELS={make:'الشركة المصنعة للكاميرا',model:'طراز الكاميرا',software:'برنامج آخر تعديل',captured:'تاريخ الالتقاط المدعى',digitized:'تاريخ الرقمنة',modified:'تاريخ آخر تعديل',orientation:'الاتجاه',exposureSeconds:'زمن التعريض (ثانية)',fNumber:'فتحة العدسة',iso:'حساسية ISO',focalLengthMm:'البعد البؤري (مم)',artist:'حقل المؤلف',copyright:'حقل الحقوق',pixelWidth:'عرض البكسل المسجل',pixelHeight:'ارتفاع البكسل المسجل'};

async function elaCanvas(bitmap,maxSide=1400,quality=.9){
 const scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height)),w=Math.max(1,Math.round(bitmap.width*scale)),h=Math.max(1,Math.round(bitmap.height*scale));
 const a=document.createElement('canvas');a.width=w;a.height=h;a.getContext('2d',{willReadFrequently:true}).drawImage(bitmap,0,0,w,h);
 const original=a.getContext('2d').getImageData(0,0,w,h);
 const dataUrl=a.toDataURL('image/jpeg',quality);
 const img=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>rej(Error('تعذرت إعادة ضغط المعاينة'));im.src=dataUrl});
 const b=document.createElement('canvas');b.width=w;b.height=h;b.getContext('2d').drawImage(img,0,0,w,h);
 const recompressed=b.getContext('2d').getImageData(0,0,w,h);
 const diff=jpegDifference(original.data,recompressed.data,20);
 const out=document.createElement('canvas');out.width=w;out.height=h;
 out.getContext('2d').putImageData(new ImageData(diff.output,w,h),0,0);
 return{canvas:out,width:w,height:h,mean:+diff.mean.toFixed(2),max:diff.max}}

function noiseCanvas(bitmap,maxSide=1400){
 const scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height)),w=Math.max(1,Math.round(bitmap.width*scale)),h=Math.max(1,Math.round(bitmap.height*scale));
 const a=document.createElement('canvas');a.width=w;a.height=h;a.getContext('2d',{willReadFrequently:true}).drawImage(bitmap,0,0,w,h);
 const pixels=a.getContext('2d').getImageData(0,0,w,h);
 const n=noiseMap(pixels.data,w,h,2,8);
 const out=document.createElement('canvas');out.width=w;out.height=h;
 out.getContext('2d').putImageData(new ImageData(n.output,w,h),0,0);
 return{canvas:out,width:w,height:h,mean:+n.mean.toFixed(2),max:+n.max.toFixed(1)}}

export async function analyzeImage({file,bytes,bitmap,box,say,isStale}){
 box.replaceChildren();
 const result={fields:{},gps:null,jpeg:null,figures:[],warnings:[]};
 const head=el('div',undefined,'analysis-head');
 head.append(el('h3','قراءة محلية للملف'),el('p','البيانات الوصفية قد تُعدَّل أو تُحذف؛ غيابها أو وجودها لا يثبت شيئًا. العروض البصرية مؤشرات مراجعة لا كشف تزييف.','hint'));
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
 const meta=el('div',undefined,'analysis-meta');
 const rows=[];
 for(const[k,label]of Object.entries(EXIF_LABELS)){const v=result.fields[k];if(v===undefined||v==='')continue;rows.push(label+': '+(Array.isArray(v)?v.join(', '):v))}
 if(result.jpeg){rows.push('بنية JPEG: '+result.jpeg.markers+' مقطعًا، '+result.jpeg.tables+' جدول تكميم'+(result.jpeg.sof?'، '+result.jpeg.sof.width+'×'+result.jpeg.sof.height+' '+result.jpeg.sof.coding:''));
  if(result.jpeg.estimate)rows.push('تقدير جودة ضغط JPEG: نحو '+result.jpeg.estimate.quality+'% ('+result.jpeg.estimate.note+')');
  if(result.jpeg.comments.length)rows.push('تعليق مضمّن: '+result.jpeg.comments.join(' | '))}
 if(result.png){rows.push('بنية PNG: '+result.png.chunks+' مقطعًا'+(result.png.texts.length?'، حقول نصية: '+result.png.texts.map(t=>t.key+'='+t.value).join(' | '):''))}
 for(const w of result.warnings)rows.push('ملاحظة: '+w);
 meta.append(el('pre',rows.length?rows.join('\n'):'لا بيانات وصفية مقروءة في هذا الملف.'));
 box.append(meta);
 if(result.gps&&Number.isFinite(result.gps.lat)){
  const g=el('div',undefined,'analysis-gps'),{lat,lon}=result.gps;
  g.append(el('p','إحداثيات مسجلة في الملف: '+lat+', '+lon+(Number.isFinite(result.gps.altitude)?' · ارتفاع '+result.gps.altitude+' م':'')+' — الإحداثيات كما كتبها الجهاز أو أي محرر لاحق، لا تثبت مكان الالتقاط.'));
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
 piv.append(el('h3','بحث عكسي عن نسخ منشورة (اختياري)'),el('p','ألصق رابط الصورة كما نُشرت على الويب. فتح أي خدمة يرسل الرابط إليها ولا يرفع ملفك المحلي. لا تفتح الروابط إن كان الرابط خاصًا أو حساسًا.','hint'));
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
 const figs=el('div',undefined,'analysis-figures');
 try{const ela=await elaCanvas(bitmap);if(isStale())return result;
  const f1=el('figure'),c1=el('figcaption','فرق إعادة ضغط JPEG بجودة 90% — مناطق أكثر سطوعًا تعني فرقًا أكبر عن إعادة الضغط؛ قد تضيء النصوص والحواف في صور سليمة. متوسط الفرق '+ela.mean+'، الأقصى '+ela.max+'.');
  f1.append(ela.canvas,c1);figs.append(f1);result.figures.push({kind:'ela',mean:ela.mean,max:ela.max})}catch(e){result.warnings.push('تعذر فرق إعادة الضغط: '+e.message)}
 try{const nz=noiseCanvas(bitmap);if(isStale())return result;
  const f2=el('figure'),c2=el('figcaption','خريطة الضوضاء المحلية — اختلاف نمط الضوضاء بين المناطق مؤشر مراجعة فقط؛ الضغط المتفاوت وحده يسبب اختلافًا. متوسط '+nz.mean+'، الأقصى '+nz.max+'.');
  f2.append(nz.canvas,c2);figs.append(f2);result.figures.push({kind:'noise',mean:nz.mean,max:nz.max})}catch(e){result.warnings.push('تعذرت خريطة الضوضاء: '+e.message)}
 box.append(figs);
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
  const ox=overlay.getContext('2d');ox.drawImage(base,0,0);
  const cap3=el('figcaption');
  if(clones.groups.length){
   const colors=['#e02424','#f59e0b','#2563eb','#059669','#7c3aed','#db2777'];
   clones.groups.forEach((g,gi)=>{const c=colors[gi%colors.length];ox.strokeStyle=c;ox.lineWidth=2;
    for(const pr of g.pairs){ox.strokeRect(pr.ax-8,pr.ay-8,16,16);ox.strokeRect(pr.bx-8,pr.by-8,16,16)}
    const sample=g.pairs.filter((_,i)=>i%Math.ceil(g.pairs.length/25)===0);
    ox.lineWidth=1;for(const pr of sample){ox.beginPath();ox.moveTo(pr.ax+8,pr.ay+8);ox.lineTo(pr.bx+8,pr.by+8);ox.stroke()}});
   cap3.textContent='كشف مناطق منسوخة محتملة — '+clones.groups.length+' نمط تكرار بإزاحة ثابتة؛ الأعلى إزاحة ('+clones.groups[0].dx+'، '+clones.groups[0].dy+') بـ'+clones.groups[0].count+' كتلة متطابقة. مؤشر يحتاج مراجعة: القوام المتكرر الطبيعي (نوافذ، بلاط) قد يُعلَّم أيضًا.'}
  else cap3.textContent='كشف مناطق منسوخة محتملة — لم تُرصد مناطق مكررة بنفس الإزاحة فوق العتبات ('+clones.blocks+' كتلة فُحصت). غياب الرصد لا يعني سلامة الصورة.';
  f3.append(overlay,cap3);figs.append(f3);
  result.figures.push({kind:'clone-detection',groups:clones.groups.map(g=>({dx:g.dx,dy:g.dy,count:g.count}))});
  // التدرج الإضاءي
  const grad=luminanceGradient(px.data,w,h);
  const f4=el('figure'),gc=document.createElement('canvas');gc.width=w;gc.height=h;
  gc.getContext('2d').putImageData(new ImageData(grad.output,w,h),0,0);
  f4.append(gc,el('figcaption','التدرج الإضاءي — الحواف القوية فقط؛ يساعد على رؤية اختلاف الحواف بين منطقة وأخرى، مؤشر مراجعة لا دليل.'));
  figs.append(f4);result.figures.push({kind:'luminance-gradient'});
  // مسح المستويات التفاعلي
  const f5=el('figure'),sc=document.createElement('canvas');sc.width=w;sc.height=h;
  const sweep=document.createElement('input');sweep.type='range';sweep.min=0;sweep.max=255;sweep.value=128;sweep.setAttribute('aria-label','مستوى السطوع المفحوص');
  const cap5=el('figcaption');
  const draw=()=>{const r=levelSweep(px.data,+sweep.value,10);sc.getContext('2d').putImageData(new ImageData(r.output,w,h),0,0);cap5.textContent='مسح المستويات — يُظهر البكسلات القريبة من المستوى '+sweep.value+' فقط؛ حرّك المؤشر لكشف تفاصيل مختبئة في الظلال أو الإضاءات العالية.'};
  sweep.oninput=draw;draw();
  f5.append(sc,cap5,sweep);figs.append(f5);result.figures.push({kind:'level-sweep',interactive:true});
  // المدرج التكراري
  const hist=channelHistogram(px.data),hc=document.createElement('canvas');hc.width=512;hc.height=140;
  const hx=hc.getContext('2d');hx.fillStyle='#111';hx.fillRect(0,0,512,140);
  const drawCh=(arr,color,alpha)=>{hx.globalAlpha=alpha;hx.fillStyle=color;for(let i=0;i<256;i++){const v=arr[i]/hist.max,barH=Math.max(1,Math.round(v*130));hx.fillRect(i*2,138-barH,2,barH)}hx.globalAlpha=1};
  drawCh(hist.r,'#e02424',.75);drawCh(hist.g,'#059669',.75);drawCh(hist.b,'#2563eb',.75);
  const f6=el('figure');f6.append(hc,el('figcaption','المدرج التكراري للقنوات اللونية (أحمر/أخضر/أزرق) — قمم أو فجوات غير متوقعة قد تشير إلى معالجة، مؤشر مراجعة لا حكم.'));
  figs.append(f6);result.figures.push({kind:'histogram',max:hist.max});
 }catch(e){result.warnings.push('تعذرت بعض الطبقات: '+e.message)}
 // الصورة المصغرة المضمنة والسلاسل النصية
 if(struct&&struct.exif){
  try{const thumb=extractExifThumbnail(struct.exif);
   if(thumb){const tdiv=el('div',undefined,'analysis-thumb');
    const timg=document.createElement('img');timg.src=URL.createObjectURL(new Blob([thumb.data],{type:'image/jpeg'}));timg.alt='الصورة المصغرة المضمنة';timg.style.maxWidth='160px';
    tdiv.append(el('h3','الصورة المصغرة المضمنة في الملف'),timg,el('p','أبعادها المسجلة: '+(thumb.width||'?')+'×'+(thumb.height||'?')+' مقابل الصورة '+bitmap.width+'×'+bitmap.height+'. المصغرة قد تبقى من نسخة أقدم بعد تعديل الصورة؛ اختلافها عن الصورة المعروضة مؤشر مراجعة مهم.','hint'));
    box.append(tdiv);result.thumbnail={width:thumb.width,height:thumb.height,bytes:thumb.data.length}}
   else result.warnings.push('لا صورة مصغرة مضمنة.')}catch{}}
 try{const strs=extractStrings(bytes);
  if(strs.length){const spre=el('pre',strs.map(x=>'['+x.offset+'] '+x.text).join('\n'));
   box.append(el('h3','سلاسل نصية دالة داخل الملف'),el('p','نصوص مخبأة في بنية الملف (أسماء برامج، تعليقات XMP). وجود اسم برنامج تحرير لا يثبت تلاعبًا، وغيابه لا يثبت العكس.','hint'),spre);
   result.strings=strs.map(x=>x.text.slice(0,120))}}catch{}
 return result}
