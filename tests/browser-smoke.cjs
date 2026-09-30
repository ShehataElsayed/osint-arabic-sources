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
  await page.getByRole('link',{name:'معمل NewsRAG',exact:true}).waitFor();
  await page.getByRole('searchbox',{name:'ابحث في هذا الموقع',exact:true}).fill('صورة');
  await page.waitForFunction(()=>document.querySelector('[aria-label="نتائج البحث"]')?.innerText.includes('Google Images'));
  assert.ok(await page.evaluate(()=>[...document.querySelectorAll('[aria-label="نتائج البحث"] a')].some(a=>a.href.includes('category-06.html'))));
  fs.mkdirSync('test-output',{recursive:true});
  await page.getByRole('searchbox',{name:'ابحث في هذا الموقع',exact:true}).fill('');
  await page.screenshot({path:'test-output/home-desktop.png'});
  await page.goto('http://127.0.0.1:8765/newsrag.html');
  assert.equal(await page.getByAltText('شعار OS').count(),1);
  await page.screenshot({path:'test-output/newsrag-desktop.png'});
  await page.getByLabel('عنوان المصدر',{exact:true}).fill('مثال اصطناعي');
  const text='ارتفعت درجات الحرارة في تقرير المناخ. هذا مثال اصطناعي للاختبار فقط.';
  await page.getByLabel('نص المصدر',{exact:true}).fill(text);
  await page.getByRole('button',{name:'أضف المصدر',exact:true}).click();
  await page.getByLabel('سؤال محدد',{exact:true}).fill('المناخ');
  await page.getByRole('button',{name:'ابحث بالكلمات',exact:true}).click();
  assert.ok((await page.locator('#results').innerText()).includes(text));
  assert.ok((await page.locator('#results').innerText()).includes(`0–${text.length}`));
  await page.goto('http://127.0.0.1:8765/verification.html');
  await page.locator('#title').fill('اختبار حفظ محلي');
  await page.reload();assert.equal(await page.locator('#title').inputValue(),'اختبار حفظ محلي');
  const exported=page.waitForEvent('download');await page.locator('#exportJson').click();
  await (await exported).saveAs('test-output/verification.json');
  const saved=JSON.parse(fs.readFileSync('test-output/verification.json','utf8'));
  assert.equal(saved.format,'osint-verification-v2');assert.equal(saved.cases[0].title,'اختبار حفظ محلي');
  await page.setViewportSize({width:390,height:844});
  for(const file of ['index.html','newsrag.html','verification.html']){
   await page.goto('http://127.0.0.1:8765/'+file);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),file+' overflow');
   await page.screenshot({path:'test-output/'+file.replace('.html','')+'-mobile.png'});
  }
  console.log('PASS: Arabic Pagefind, NewsRAG text/offsets, verification persistence/export, nav/logo and 3 mobile widths. No semantic model tested.');
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
