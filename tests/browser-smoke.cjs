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
  await page.goto('http://127.0.0.1:8765/assistant.html?local=1');
  assert.equal(await page.getByAltText('شعار OS').count(),1);
  await page.screenshot({path:'test-output/assistant-desktop.png'});
  await page.getByLabel('عنوان المصدر',{exact:true}).fill('مثال اصطناعي');
  const text='ارتفعت درجات الحرارة في تقرير المناخ. هذا مثال اصطناعي للاختبار فقط.';
  await page.getByLabel('نص المصدر',{exact:true}).fill(text);
  await page.getByRole('button',{name:'أضف المصدر',exact:true}).click();
  await page.getByLabel('سؤالك',{exact:true}).fill('المناخ');
  await page.getByRole('button',{name:'اسأل بجيمناي',exact:true}).click();
  await page.locator('#ragResult .src-card').first().waitFor();
  await page.waitForTimeout(700); // let the fade-in finish before pixel checks
  assert.ok((await page.locator('#ragResult').innerText()).includes(text));
  assert.ok((await page.locator('#ragResult').innerText()).includes('وضع محلي'));
  // evidence card readable: dark text on light card, animation settled
  const contrast = await page.evaluate(() => { const c = document.querySelector('#ragResult .src-card'); const st = getComputedStyle(c); const strong = getComputedStyle(c.querySelector('strong')); const bq = getComputedStyle(c.querySelector('blockquote')); return { op: +st.opacity, strong: strong.color, bq: bq.color, bqBg: bq.backgroundColor }; });
  assert.equal(contrast.op, 1, 'evidence card fully opaque');
  assert.equal(contrast.strong, 'rgb(20, 43, 49)');
  assert.equal(contrast.bq, 'rgb(27, 58, 69)');
  assert.equal(contrast.bqBg, 'rgb(242, 248, 247)');
  // sources are session-scoped by default; on-device only via explicit checkbox
  assert.equal(await page.locator('#persistLocal').isChecked(), false, 'no on-device persistence by default');
  assert.ok(JSON.parse(await page.evaluate(() => sessionStorage.getItem('newsrag-sources-session-v1') || '[]')).length === 1, 'source kept in session storage');
  assert.equal(await page.evaluate(() => localStorage.getItem('newsrag-sources-v1')), null, 'nothing written to localStorage');
  // legacy lab metrics must not appear on the assistant page
  assert.ok(!(await page.content()).includes('84.1'), 'no historical lab metrics on assistant page');
  await page.locator('#tabVerify').click();
  assert.ok((await page.locator('#panelVerify').isVisible()));
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
  console.log('PASS: Arabic Pagefind, NewsRAG assistant local retrieval, verification persistence/export, Yemen hidden, nav/logo and 3 mobile widths. No live Gemini tested.');
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
