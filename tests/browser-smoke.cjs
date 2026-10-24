const {chromium}=require('playwright');
const {spawn}=require('child_process');
const assert=require('node:assert/strict');
const fs=require('fs');
(async()=>{
 const server=spawn('python3',['-m','http.server','8765','--bind','127.0.0.1','--directory','_site'],{stdio:'ignore'});
 let browser;
 try {
  for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:8765/')).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.goto('http://127.0.0.1:8765/');
  await page.locator('a.taskcard',{hasText:'مساعد NewsRAG'}).waitFor();
  assert.equal(await page.locator('nav.shellnav > a, nav.shellnav > details').count(),4,'four primary nav sections after hiding Yemen');
  assert.equal(await page.locator('header.top a[href*="facebook"]').count(),0,'facebook is in the footer, not the header');
  assert.ok(await page.locator('footer a[href*="facebook"]').count()>0);
  assert.ok(await page.locator('a.skip-link').count()===1);
  assert.equal(await page.locator('a[href$="yemen.html"]').count(),0,'yemen tool hidden from home');
  await page.getByRole('searchbox',{name:'ابحث في هذا الموقع',exact:true}).fill('صورة');
  await page.waitForFunction(()=>document.querySelector('[aria-label="نتائج البحث"]')?.innerText.includes('Google Images'));
  assert.ok(await page.evaluate(()=>[...document.querySelectorAll('[aria-label="نتائج البحث"] a')].some(a=>a.href.includes('category-06.html'))));
  fs.mkdirSync('test-output',{recursive:true});
  await page.getByRole('searchbox',{name:'ابحث في هذا الموقع',exact:true}).fill('');
  await page.screenshot({path:'test-output/home-desktop.png'});
  // task file: add a tool from smart search into the local case
  await page.goto('http://127.0.0.1:8765/smart-search.html?q='+encodeURIComponent('كيف أتتبع سفينة'));
  await page.locator('.tf-btn').first().waitFor();
  await page.locator('.tf-btn').first().click();
  const stored=JSON.parse(await page.evaluate(()=>localStorage.getItem('osint-verification-v2')));
  assert.ok(stored.cases[0].evidence.length>=1,'tool saved into case evidence');
  // assistant page: question-only flow against a fixture backend (fixtures live in tests only, never shipped).
  const fixture={generated:true,decision:'answer',answer_qualified:true,
   answer:'خلاصة مباشرة: ارتفعت درجات حرارة البحر بشكل قياسي [S1]. لم نعثر على سند موثق لادعاء انخفاض الصيد في خليج السويس، فحُذف من الإجابة.',
   claims:[{text:'ارتفعت درجات حرارة البحر خلال العقد الأخير',supported:true,similarity:0.62,evidence:'ارتفعت درجات حرارة البحر في المنطقة خلال العقد الأخير بشكل قياسي حسب التقرير السنوي',source_ref:1},{text:'انخفض الصيد في خليج السويس بنسبة محددة',supported:false,similarity:0.05,evidence:'',source_ref:0}],
   confidence:{score:69,band:'mid',criteria:[
    {id:'sources_opened',label:'فتح المصادر المذكورة',score:1,detail:'فُتح 1 من 2'},
    {id:'claim_support',label:'تطابق نصي بين الادعاءات ونصوص المصادر (لفظي، لا استدلالي)',score:0.5,detail:'1 من 2 ادعاء له سند نصي'},
    {id:'independence',label:'استقلال نطاقات المصادر',score:0.5,detail:'1 نطاق مستقل'},
    {id:'provenance',label:'شفافية جهات النشر (نطاق وتسجيل، لا دقة محتوى)',score:1,detail:'جهة رسمية بينها'},
    {id:'self_critic',label:'نقد ذاتي للتناقض (تقدير آلي)',score:1,detail:'0.10'}]},
   sources:[{name:'تقرير المنظمة العالمية للأرصاد',url:'https://www.who.int/ar/news/item/x',claimed:'',host:'www.who.int',exists:true,title:'تقرير المنظمة العالمية للأرصاد',quote:'ارتفعت درجات حرارة البحر في المنطقة خلال العقد الأخير بشكل قياسي حسب التقرير السنوي',picked:true,repaired:false,by_search:false,original:'',rel:'very_high',tier:'official',similarity:0.62,verified:true,numbers_ok:null,negation_conflict:false,identity:{domain:'who.int',age_years:28,registrar:null,registrant:null,rdap:'ok'},page:{site_name:'WHO',author:null,has_about:true,has_contact:true}},
    {name:'صفحة ميتة',url:'',claimed:'https://dead.example.com/gone',host:'dead.example.com',exists:false,title:'',quote:'',picked:false,repaired:false,by_search:false,original:'',rel:'unknown',tier:'unknown',similarity:0,verified:false,numbers_ok:null,negation_conflict:false,identity:null,page:null}],
   issues:['فجوة في البيانات الإقليمية المحدثة'],
   angles:['زاوية: أثر موجات الحر على صيادي الساحل وما تحتاجه من مقابلات وبيانات'],
   tools:[],factcheck:[],time_sensitive:false,
   warnings:['حُذفت من الإجابة ادعاءات بلا سند نصي في المصادر المفتوحة أو طُوّقت صراحة بأنها غير موثقة','مؤشر الثقة checklist آلي على معايير معلنة، وليس احتمالًا لصحة الإجابة','تصنيف الجهات مبني على النطاق وبيانات التسجيل فقط، والتطابق النصي لا يعني إثبات الاستدلال']};
  await page.route('https://osint-rag.egkrkr.workers.dev/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixture)}));
  await page.goto('http://127.0.0.1:8765/assistant.html');
  assert.equal(await page.getByAltText('شعار OS').count(),1);
  await page.screenshot({path:'test-output/assistant-desktop.png'});
  assert.equal(await page.locator('#askQ').count(),1,'single question box');
  assert.equal(await page.locator('#askBtn').count(),1);
  await page.getByLabel('سؤالك',{exact:true}).fill('ما أثر موجات الحر البحرية على الصيد؟');
  await page.getByRole('button',{name:'اسأل الآن',exact:true}).click();
  await page.locator('#askResult svg[role="img"]').waitFor();
  await page.waitForTimeout(700); // let the fade-in finish before pixel checks
  const rt=await page.locator('#askResult').innerText();
  assert.ok(rt.includes('خلاصة مباشرة'),'answer rendered');
  assert.ok(rt.includes('مؤشر تغطية الفحوص — معايير معلنة'),'coverage card');
  assert.ok(rt.includes('لا احتمال صحة الإجابة'),'honest coverage caveat');
  assert.ok(rt.includes('لا يغني عن مراجعة المصادر الأصلية'),'lexical-not-entailment caveat');
  assert.ok(rt.includes('المصادر المفتوحة (1)'),'only opened source counted');
  assert.ok(rt.includes('لا سند نصي'),'unsupported claim flagged');
  assert.ok(rt.includes('الإجابة بعد الفحص والتنقية'),'qualification badge shown');
  assert.ok(rt.includes('لم نعثر على سند موثق'),'unsupported claim framed out of the answer');
  assert.ok(rt.includes('تعذر فتح 1'),'dead source excluded and counted');
  assert.ok(rt.includes('فتح المصادر المذكورة'),'criteria checklist rendered');
  
  assert.ok(rt.includes('جهة رسمية — تصنيف نطاق'),'provenance pill, not accuracy');
  assert.ok(rt.includes('مسجل منذ 28'),'rdap provenance shown');
  assert.ok(rt.includes('خيوط اكتشاف لا تحققًا'),'discovery-leads caveat');
  assert.ok(rt.includes('الإشكاليات')&&rt.includes('زوايا صحفية'),'issues and angles');
  assert.ok(await page.locator('#askResult a[href^="https://www.who.int"]').count()===1,'source link present');
  assert.ok(await page.locator('#askResult .cite-chip').count()>=1,'citation chips in answer');
  assert.ok(!(await page.content()).includes('84.1'),'no historical lab metrics on assistant page');
  const gaugeAria=await page.locator('#askResult svg[role="img"]').getAttribute('aria-label');
  assert.ok(gaugeAria.includes('69')&&gaugeAria.includes('تغطية الفحوص')&&gaugeAria.includes('لا يقيس احتمال صحة'),'gauge accessible label means coverage, not likelihood');
  const confCard=await page.evaluate(()=>{const c=document.querySelectorAll('#askResult .src-card')[1];return {op:+getComputedStyle(c).opacity,band:getComputedStyle(c.querySelector('.conf-band')).color};});
  assert.equal(confCard.op,1,'confidence card fully opaque');
  assert.equal(confCard.band,'rgb(184, 137, 50)','guide amber for mid band with unsupported claim');
  assert.ok(rt.includes('معيار مستوفى'),'score reads as satisfied criteria');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('newsrag-sources-session-v1')),null,'no session source storage in question-only flow');
  assert.equal(await page.evaluate(()=>localStorage.getItem('newsrag-sources-v1')),null,'nothing written to localStorage');
  await page.unroute('https://osint-rag.egkrkr.workers.dev/**');
  await page.goto('http://127.0.0.1:8765/verification.html');
  await page.locator('#title').fill('اختبار حفظ محلي');
  await page.reload();assert.equal(await page.locator('#title').inputValue(),'اختبار حفظ محلي');
  const exported=page.waitForEvent('download');await page.locator('#exportJson').click();
  await (await exported).saveAs('test-output/verification.json');
  const saved=JSON.parse(fs.readFileSync('test-output/verification.json','utf8'));
  assert.equal(saved.format,'osint-verification-v2');assert.equal(saved.cases[0].title,'اختبار حفظ محلي');
  await page.setViewportSize({width:390,height:844});
  for(const file of ['index.html','assistant.html','verification.html']){
   await page.goto('http://127.0.0.1:8765/'+file);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),file+' overflow');
   await page.screenshot({path:'test-output/'+file.replace('.html','')+'-mobile.png'});
  }
  // mobile hero text on assistant page must be fully readable, not line-clamped
  await page.goto('http://127.0.0.1:8765/assistant.html?local=1');
  const clampDisp = await page.evaluate(() => getComputedStyle(document.querySelector('.hero p')).display);
  assert.notEqual(clampDisp, '-webkit-box', 'assistant hero paragraph not clamped on mobile');
  console.log('PASS: Arabic Pagefind, NewsRAG question-only assistant against fixture backend, verification persistence/export, Yemen hidden, nav/logo and 3 mobile widths. No live Gemini tested.');
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
