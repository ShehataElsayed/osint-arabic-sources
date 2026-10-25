const {chromium}=require('playwright');
const {spawn}=require('child_process');
(async()=>{
 const server=spawn('python3',['-m','http.server','8767','--bind','127.0.0.1','--directory','_site'],{stdio:'ignore'});
 for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:8767/')).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
 const fixture={generated:true,decision:'extractive',answer_qualified:true,
  completeness:'مقتطفات موثقة فقط من النصوص المفتوحة؛ لم تُصغ إجابة كاملة',
  answer:'بلغ عدد سكان مصر 106.5 مليون نسمة في يوليو 2024.\nيقول المصدر: «بلغ عدد السكان 106.5 مليون نسمة في الثاني من يوليو 2024 حسب الجهاز المركزي للتعبئة العامة والإحصاء» [S1]',
  claims:[{text:'بلغ عدد سكان مصر 106.5 مليون نسمة في يوليو 2024',supported:true,similarity:0.71,evidence:'بلغ عدد السكان 106.5 مليون نسمة في الثاني من يوليو 2024 حسب الجهاز المركزي للتعبئة العامة والإحصاء',source_ref:1}],
  unknowns:['معدل النمو السكاني الحالي'],
  confidence:{score:84,band:'mid',criteria:[
   {id:'sources_opened',label:'فتح مصادر الاكتشاف',score:1,detail:'فُتح 7 من 7'},
   {id:'citation_support',label:'سند الاستشهادات: تحقق آلي من كل جملة مقابل مقطعها (لفظي، لا استدلالي)',score:1,detail:'1 من 1 جملة مستشهد بها اجتازت الفحص'},
   {id:'independence',label:'تنوّع نطاقات المصادر المفتوحة',score:1,detail:'7 نطاقات مميزة (تنوّع نطاقات لا يثبت استقلالًا تحريريًا)'},
   {id:'provenance',label:'شفافية جهات النشر (نطاق وتسجيل، لا دقة محتوى)',score:0.5,detail:'حسب النطاق وبيانات التسجيل'}]},
  sources:[{name:'جريدة الوفد',url:'https://alwafd.news/example',host:'alwafd.news',exists:true,title:'السكان في مصر',quote:'بلغ عدد السكان 106.5 مليون نسمة في الثاني من يوليو 2024 حسب الجهاز المركزي للتعبئة العامة والإحصاء',picked:true,rel:'medium',tier:'unknown',similarity:0.71,verified:true,identity:null,page:null}],
  issues:[],angles:[],tools:[],factcheck:[],time_sensitive:true,
  warnings:['تعذرت صياغة إجابة موثقة كاملة؛ المعروض مقتطفات من النصوص المفتوحة فقط','الأرقام المعروضة مؤرخة (2024) وقد لا تعكس القيمة الحالية لحظة النشر؛ تحقق من المصدر الرسمي مباشرة قبل الاعتماد']};
 for(const [name,w,h] of [['desktop',1440,1000],['mobile',390,844]]){
  const page=await browser.newPage({viewport:{width:w,height:h}});
  await page.route('https://osint-rag.egkrkr.workers.dev/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixture)}));
  await page.goto('http://127.0.0.1:8767/assistant.html');
  await page.getByLabel('سؤالك',{exact:true}).fill('ما هو العدد الحالي لسكان مصر ومعدل النمو؟');
  await page.getByRole('button',{name:'اسأل الآن',exact:true}).click();
  await page.locator('#askResult .conf-complete').waitFor();
  await page.waitForTimeout(700);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
  const card=page.locator('#askResult .src-card',{has:page.locator('.conf-complete')}).first();
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({path:'/downloads/gauge-v2-'+name+'.png'});
  const box=await card.boundingBox();
  console.log(name,'overflow-x:',overflow,'card width:',Math.round(box.width),'viewport:',w);
  await page.close();
 }
 await browser.close();server.kill();
})().catch(e=>{console.error(e);process.exit(1)});
