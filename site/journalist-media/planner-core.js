// Verification-path planner core: deterministic rule-based matching over the
// case description and the materials the journalist declares. Every suggestion
// carries its evidence (the exact signals that fired) so the match is auditable.
// It matches words and materials against documented rules; it does not
// understand the case, and it never runs any tool automatically.

export function normalizeArabic(text){
 if(typeof text!=='string')throw Error('النص غير صالح');
 return text.toLowerCase()
  .replace(/[ً-ْٰـ]/g,'')
  .replace(/[أإآٱ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي')
  .replace(/\s+/g,' ').trim()}

export const MATERIALS=[
 {id:'texts',label:'نصوص أو مستندات'},
 {id:'images',label:'صور'},
 {id:'video',label:'فيديو'},
 {id:'domain',label:'نطاق أو موقع إلكتروني'},
 {id:'webpage',label:'صفحة ويب (حالية أو محذوفة)'},
 {id:'names',label:'أسماء أشخاص أو جهات'},
 {id:'dates',label:'أحداث وتواريخ'},
 {id:'dataset',label:'جدول أو ملف بيانات'},
 {id:'username',label:'اسم مستخدم أو حساب'},
 {id:'phone',label:'رقم هاتف'},
 {id:'email',label:'بريد إلكتروني'}];

export const LOCAL_TOOLS=[
 {id:'domain',stage:1,page:'domain-dossier.html',name:'ملف النطاق والموقع',
  materials:['domain','webpage'],
  signals:['نطاق','دومين','استضافه','تسجيل النطاق','dns','موقع الكتروني','رابط الموقع'],
  steps:['أدخل اسم النطاق في صفحة ملف النطاق','راجع بيانات التسجيل والفحص التقني العامة بمصادرها','سجّل التواريخ والتناقضات المهمة في ملاحظاتك'],
  input:'اسم النطاق أو الموقع',
  expected:'بيانات تسجيل وفحص DNS عامة بمصادرها مع شرح التواريخ والبنية والتناقضات',
  stop:'توقف عند اكتمال صورة النطاق؛ بيانات الخصوصية لا تكشف مالكًا مخفيًا ولا تُخترع هوية.'},
 {id:'archive',stage:2,page:'archive.html',name:'أرشيف الويب',
  materials:['webpage','domain'],
  signals:['ارشيف','نسخه قديمه','نسخه مؤرشفه','حذف الصفحه','صفحه محذوفه','اتغيرت','wayback','لقطه قديمه'],
  steps:['الصق رابط الصفحة واضغط زر البحث بعد قراءة التنبيه','راجع خط اللقطات والتوزيع السنوي ونقاط تغير المحتوى','افتح اللقطات المهمة من روابطها على موقع الأرشيف'],
  input:'رابط الصفحة (يُرسل إلى خدمة الأرشيف بعد تنبيه صريح)',
  expected:'قائمة لقطات مؤرشفة بتواريخها وروابطها وتوزيعها السنوي ونقاط تغير محتواها',
  stop:'غياب اللقطة لا ينفي وجود الصفحة؛ حد ٢٠٠ لقطة معروضة والتقدير الإجمالي منفصل.'},
 {id:'ocr',stage:3,page:'ocr.html',name:'استخراج النص من الصور',
  materials:['texts','images'],
  signals:['مستند','وثيقه','سكانر','ماسح ضوئي','استخراج نص','نص من صوره','pdf','ملف مصور'],
  steps:['ارفع صورة المستند في صفحة الاستخراج','راجع النص الناتج جنب الصورة الأصلية','صحّح مواضع الخلل الواضحة بمراجعة بشرية قبل الاعتماد'],
  input:'صورة المستند (JPEG أو PNG) من جهازك',
  expected:'نص مستخرج محليًا قابل للنسخ بجانب الصورة الأصلية للمراجعة',
  stop:'المحرر قد يخطئ خاصة مع الأرقام العربية؛ لا تعتمد النص قبل مراجعته على الأصل.'},
 {id:'video',stage:4,page:'video-frames.html',name:'لقطات الفيديو',
  materials:['video'],
  signals:['فيديو','مقطع','لقطات فيديو','تفكيك الفيديو','فريم'],
  steps:['اختر ملف الفيديو من جهازك','راجع اللقطات الزمنية الأربع الثابتة وبصماتها','نزّل اللقطات وبياناتها للفحص أو البحث العكسي يدويًا'],
  input:'ملف فيديو من جهازك',
  expected:'أربع لقطات زمنية ثابتة ببصماتها مع بيانات JSON',
  stop:'اللقطات ثابتة التوزيع وليست اختيارًا ذكيًا للحظات المفتاحية؛ راجع الفيديو كاملًا عند الشك.'},
 {id:'image',stage:5,page:'image-analysis.html',name:'فحص بيانات الصورة وطبقاتها',
  materials:['images'],
  signals:['صوره','صور','معدله','فوتوشوب','مفبركه','exif','بيانات وصفيه','تلاعب بالصوره'],
  steps:['اختر الصورة من جهازك وشغّل الفحص المحلي','راجع البيانات الوصفية وطبقات الفحص (فرق الضغط، الضوضاء، النسخ، PCA)','استخدم المكبّر للتدقيق في المناطق المثيرة'],
  input:'صورة JPEG أو PNG من جهازك',
  expected:'بيانات وصفية وطبقات فحص بصرية كمؤشرات مراجعة بشرية',
  stop:'كل الطبقات مؤشرات مراجعة لا تكشف تلاعبًا ولا تحكم بأصالة؛ غياب البيانات الوصفية لا يثبت شيئًا.'},
 {id:'claims',stage:6,page:'claims.html',name:'رصد الادعاءات',
  materials:['texts'],
  signals:['ادعاء','ادعاءات','تصريح','احصائيه','تحقق من خبر','فحص خبر','بيان رسمي'],
  steps:['الصق نص الخبر أو البيان','راجع الجمل المرشحة وإشاراتها (أرقام، تواريخ، اقتباس، نسب قول)','ابنِ قائمة تحققك من المرشحات المقبولة فقط'],
  input:'نص الخبر أو البيان أو المنشور',
  expected:'قائمة جمل مرشحة للتحقق مرتبطة بمواضعها الدقيقة في النص',
  stop:'الترشيح نمطي إرشادي؛ قد يفوت ادعاءات مهمة ويرشح جملًا سليمة، والحكم لك.'},
 {id:'entities',stage:7,page:'entities.html',name:'رصد الكيانات',
  materials:['texts','names'],
  signals:['اسماء','اشخاص','جهات','كيانات','شبكه علاقات','علاقات بين','منظمات'],
  steps:['الصق مستندات القضية','راجع العبارات المتكررة بمواضعها الدقيقة وادمج أو استبعد بقرارك','افحص رسم الظهور المشترك كفرضيات لا كإثبات علاقة'],
  input:'نصوص مستندات القضية',
  expected:'عبارات مرشحة بمواضعها الدقيقة ودمج/استبعاد مراجعة ورسم ظهور مشترك',
  stop:'تشابه الأسماء احتمال لا إثبات هوية، والظهور المشترك في جملة ليس دليل علاقة.'},
 {id:'timeline',stage:8,page:'timeline.html',name:'الخط الزمني',
  materials:['texts','dates'],
  signals:['خط زمني','تسلسل زمني','تواريخ','احداث','تعارض التواريخ','متي حدث'],
  steps:['الصق المصادر وراجع التواريخ المرشحة','أكّد أو عدّل كل تاريخ بمرجعية اقتباس المصدر','راجع الترتيب والفجوات الزمنية في العرض'],
  input:'نصوص المصادر ذات التواريخ',
  expected:'خط زمني تفاعلي بتواريخ أكدتها أنت مرتبطة باقتباسات مصادرها',
  stop:'التعابير النسبية مثل «أمس» تحتاج تحديدًا منك؛ التاريخ غير المؤكد لا يدخل العرض.'},
 {id:'versions',stage:9,page:'versions.html',name:'مقارنة النصوص',
  materials:['texts'],
  signals:['نسختين','مقارنه نص','قارن بين','تعديل بيان','تغير النص','نسخه معدله','حذف واضافه'],
  steps:['الصق النسختين القديمة والجديدة','راجع الإضافات والحذف على مستوى السطور والكلمات','نزّل نتيجة المقارنة لملف القضية'],
  input:'نسختان نصيتان (حتى ٨٠٠ سطر)',
  expected:'إبراز الإضافات والحذف على مستوى السطور والكلمات مع تصدير النتيجة',
  stop:'نقل الفقرة يظهر حذفًا وإضافة؛ راجع السياق قبل قراءته كتغيير مقصود.'},
 {id:'datalab',stage:10,page:'data-lab.html',name:'مختبر البيانات',
  materials:['dataset'],
  signals:['جدول','csv','اكسل','ملف بيانات','قاعده بيانات','احصاء'],
  steps:['ارفع ملف البيانات في المختبر','استعلم بالفلاتر والتجميع محليًا','راجع النتائج قبل أي استنتاج إحصائي'],
  input:'ملف بيانات جدولي من جهازك',
  expected:'استعلامات محلية على البيانات دون رفعها',
  stop:'الاستعلام يجيب عما سألته فقط؛ جودة البيانات واكتمالها مسؤوليتك.'}];

const SIGNAL_CAP=4,MATERIAL_W=4,MAX_LOCAL=5;

export function matchLocalTools(description,materialIds){
 if(typeof description!=='string'||description.length>5000)throw Error('وصف القضية غير صالح (حتى ٥ آلاف حرف)');
 if(!Array.isArray(materialIds)||materialIds.length>MATERIALS.length)throw Error('قائمة المواد غير صالحة');
 const known=new Set(MATERIALS.map(m=>m.id));
 for(const m of materialIds)if(!known.has(m))throw Error('مادة غير معروفة: '+m);
 const norm=normalizeArabic(description),matSet=new Set(materialIds);
 const scored=[];
 for(const tool of LOCAL_TOOLS){
  const matHits=tool.materials.filter(m=>matSet.has(m));
  const sigHits=tool.signals.filter(s=>norm.includes(normalizeArabic(s)));
  const score=matHits.length*MATERIAL_W+Math.min(sigHits.length,SIGNAL_CAP);
  if(score>0)scored.push({tool,score,evidence:{materials:matHits.map(id=>MATERIALS.find(m=>m.id===id).label),signals:sigHits.slice(0,SIGNAL_CAP)}})}
 scored.sort((a,b)=>b.score-a.score);
 return scored.slice(0,MAX_LOCAL)}

// External guide tools: curated free+live subset (planner-catalog.js, generated
// from the guide data). Fires only when its rule matches the case.
export const CATALOG_RULES=[
 {cats:['Username'],materials:['username'],signals:['اسم مستخدم','يوزر','يوزرنيم']},
 {cats:['Telephone Numbers'],materials:['phone'],signals:['هاتف','تليفون','رقم موبايل','واتساب']},
 {cats:['Email Address'],materials:['email'],signals:['بريد الكتروني','ايميل','بريد']},
 {cats:['Social Networks'],materials:['username'],signals:['تويتر','فيسبوك','انستجرام','تيك توك','لينكد','حساب تواصل']},
 {cats:['Geolocation Tools / Maps'],materials:[],signals:['خريطه','موقع جغرافي','احداثيات','تحديد مكان','جيولوكيشن']},
 {cats:['Images / Videos / Docs'],materials:['images','video'],signals:['بحث عكسي','اصل الصوره','مصدر الصوره']},
 {cats:['Archives'],materials:['webpage'],signals:['ارشيف']},
 {cats:['Disinformation & Media Verification'],materials:[],signals:['اخبار زائفه','تضليل','تحقق من محتوي']},
 {cats:['Documentation / Evidence Capture'],materials:[],signals:['توثيق','حفظ الادله','تخليد']}];

const MAX_EXTERNAL=6,PER_CAT=2;

export function matchCatalogTools(description,materialIds,catalog){
 if(!Array.isArray(catalog))throw Error('فهرس الأدوات الخارجية غير متوفر');
 const norm=normalizeArabic(description),matSet=new Set(materialIds);
 const out=[],used=new Set();
 for(const rule of CATALOG_RULES){
  const fired=rule.signals.some(s=>norm.includes(normalizeArabic(s)))||rule.materials.some(m=>matSet.has(m));
  if(!fired)continue;
  let taken=0;
  for(const entry of catalog){
   if(taken>=PER_CAT)break;
   if(!rule.cats.includes(entry.cat)||used.has(entry.name))continue;
   used.add(entry.name);taken++;
   out.push(entry)}}
 return out.slice(0,MAX_EXTERNAL)}

export function buildPlan(description,materialIds,catalog){
 const local=matchLocalTools(description,materialIds);
 const external=matchCatalogTools(description,materialIds,catalog||[]);
 if(!local.length&&!external.length)return{empty:true,
  message:'لم تكفِ الإشارات لاقتراح مسار. اختر المواد المتاحة لديك، أو صف القضية بكلمات أوضح (مثل: صور، فيديو، نطاق، مستند، أسماء، تواريخ، نسختين).'};
 const steps=local.slice().sort((a,b)=>a.tool.stage-b.tool.stage).map((m,i)=>({
  order:i+1,tool:m.tool.name,page:m.tool.page,matchedScore:m.score,evidence:m.evidence,
  steps:m.tool.steps,input:m.tool.input,expected:m.tool.expected,stop:m.tool.stop}));
 return{empty:false,steps,external,
  notes:['الاقتراح مطابقة قواعد على كلماتك وموادك المعلنة، وليس فهمًا آليًا للقضية؛ راجع كل خطوة قبل اتباعها.',
   'الترجمة وأدوات الذكاء الاصطناعي خارج المسار حاليًا بقرار مؤجل من المستخدم.',
   'لا أداة تعمل تلقائيًا نيابة عنك؛ شروط التوقف جزء من كل خطوة.']}}

export function planText(plan,description){
 if(plan.empty)return plan.message;
 const lines=['مسار التحقق المقترح — مطابقة قواعد محلية على وصفك، تتطلب مراجعتك','', 'وصف القضية: '+(description||'').slice(0,300),'','الخطوات:'];
 for(const s of plan.steps){
  lines.push('',`${s.order}) ${s.tool} — ${s.page}`);
  lines.push('   لماذا رُشحت: '+(s.evidence.materials.length?'مواد: '+s.evidence.materials.join('، '):'')+(s.evidence.signals.length?(s.evidence.materials.length?' | ':'')+'إشارات من وصفك: '+s.evidence.signals.join('، '):''));
  lines.push('   المدخلات: '+s.input);
  lines.push('   الخطوات: '+s.steps.join(' ← '));
  lines.push('   النتيجة المتوقعة: '+s.expected);
  lines.push('   شرط التوقف: '+s.stop)}
 if(plan.external.length){lines.push('','أدوات خارجية من الدليل (روابط تغادر المنصة):');
  for(const e of plan.external)lines.push(`- ${e.name} (${e.cat}): ${e.url} — يقبل: ${e.input||'؟'}، يعطي: ${e.output||'؟'}`)}
 lines.push('','ملاحظات:',...plan.notes.map(n=>'- '+n),'','هذا المسار مساعد تخطيط قاعدي، وليس تحققًا منفذًا ولا حكمًا على القضية.');
 return lines.join('\n')}
