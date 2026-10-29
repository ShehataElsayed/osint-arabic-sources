const {chromium}=require('playwright');
const http=require('node:http');
function httpStatus(url){return new Promise((res,rej)=>{const q=http.get(url,{agent:false,headers:{Connection:'close'}},r=>{r.resume();r.on('end',()=>res(r.statusCode));r.on('error',rej)});q.on('error',rej);q.setTimeout(10000,()=>q.destroy(new Error('timeout '+url)))})}
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
  // Editorial homepage: actual local utilities, no catalog or prerecorded results.
  await page.goto('http://127.0.0.1:8765/');
  assert.equal(await page.locator('main input[type=search]').count(),1);
  assert.equal(await page.locator('[data-panel]').count(),5);
  assert.equal(await page.locator('main video').count(),0);
  assert.ok(await page.locator('footer a[href*="facebook"]').count()>0);
  await page.getByRole('searchbox',{name:'صف مهمة البحث'}).fill('التحقق من صورة منشورة');
  await page.waitForFunction(()=>document.querySelector('#out')?.innerText.includes('InVID'));
  assert.ok((await page.locator('#out').innerText()).includes('InVID'));
  assert.ok((await page.locator('.searchnote').innerText()).includes('لا يُرسل'));
  assert.ok((await page.locator('#out a[href*="branches.html?q="]').count())>=1);
  await page.goto('http://127.0.0.1:8765/branches.html');
  assert.equal(await page.locator('.node').count(),33,'33 branch nodes on the branches page');
  await page.getByRole('searchbox',{name:'اكتب مهمتك'}).fill('أريد تتبع سفينة');
  await page.locator('#out:not([hidden])').waitFor();
  assert.ok(await page.locator('.node.lit').count()>=1,'matching branches lit');
  await page.getByRole('searchbox',{name:'اكتب مهمتك'}).fill('zzzz qqqq');
  await page.waitForFunction(()=>document.querySelector('#reply')?.innerText.includes('لا أجد أداة'));
  assert.equal(await page.locator('.node.lit').count(),0,'abstention lights nothing');
  const hrefs=await page.locator('.node').evaluateAll(a=>a.map(x=>x.getAttribute('href')));
  for(const h of hrefs.slice(0,33)){const st=await httpStatus('http://127.0.0.1:8765/'+h);assert.equal(st,200,h+' status '+st)}
  await page.goto('http://127.0.0.1:8765/branches/domain-name.html');
  assert.ok(await page.locator('.tool').count()>100,'branch page lists its tools');
  await page.fill('#filter','whois');
  assert.ok(await page.locator('.tool:not([hidden])').count()>0&&await page.locator('.tool:not([hidden])').count()<await page.locator('.tool').count(),'branch filter works');
  // Full classic map with Pagefind and the original nav
  await page.goto('http://127.0.0.1:8765/map.html');
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
  await page.locator('a[href*="workflows.html#planner"]').first().waitFor();
  await page.locator('summary',{hasText:'نتائج بحث بالكلمات'}).click();
  await page.locator('.tf-btn').first().waitFor();
  await page.locator('.tf-btn').first().click();
  const stored=JSON.parse(await page.evaluate(()=>localStorage.getItem('osint-verification-v2')));
  assert.ok(stored.cases[0].evidence.length>=1,'tool saved into case evidence');
  // assistant page: static-only build — no backend is configured, so the NewsRAG server flow must be
  // genuinely unreachable: ask button disabled, honest static-mode notice, redirect to the on-device
  // smart search, and zero requests to the retired external worker.
  let workerHit = false;
  await page.route('https://osint-rag.egkrkr.workers.dev/**', r => { workerHit = true; r.abort(); });
  await page.goto('http://127.0.0.1:8765/assistant.html');
  assert.equal(await page.getByAltText('شعار OS').count(),1);
  await page.screenshot({path:'test-output/assistant-desktop.png'});
  const modeTxt = await page.locator('#mode').innerText();
  assert.ok(modeTxt.includes('ثابت بالكامل'),'static-only notice shown');
  assert.ok(await page.locator('#askBtn').isDisabled(),'ask button disabled without backend');
  assert.equal(await page.locator('#mode a[href="./smart-search.html"]').count(),1,'redirect to on-device smart search');
  await page.waitForTimeout(500);
  assert.equal(workerHit,false,'no request to the retired external worker');
  await page.unroute('https://osint-rag.egkrkr.workers.dev/**');
  await page.goto('http://127.0.0.1:8765/verification.html');
  await page.locator('#title').fill('اختبار حفظ محلي');
  await page.reload();assert.equal(await page.locator('#title').inputValue(),'اختبار حفظ محلي');
  const exported=page.waitForEvent('download');await page.locator('#exportJson').click();
  await (await exported).saveAs('test-output/verification.json');
  const saved=JSON.parse(fs.readFileSync('test-output/verification.json','utf8'));
  assert.equal(saved.format,'osint-verification-v2');assert.equal(saved.cases[0].title,'اختبار حفظ محلي');
  await page.setViewportSize({width:390,height:844});
  for(const file of ['index.html','map.html','branches/domain-name.html','assistant.html','verification.html']){
   await page.goto('http://127.0.0.1:8765/'+file);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),file+' overflow');
   await page.screenshot({path:'test-output/'+file.replace('.html','').replace('/','-')+'-mobile.png'});
  }
  // mobile hero text on assistant page must be fully readable, not line-clamped
  await page.goto('http://127.0.0.1:8765/assistant.html?local=1');
  const clampDisp = await page.evaluate(() => getComputedStyle(document.querySelector('.hero p')).display);
  assert.notEqual(clampDisp, '-webkit-box', 'assistant hero paragraph not clamped on mobile');
  console.log('PASS: Arabic Pagefind, assistant static-only mode, verification persistence/export, Yemen hidden, nav/logo and 3 mobile widths. No live Gemini tested.');
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
