const {chromium}=require('playwright');
const {spawn}=require('child_process');
const fs=require('fs');
(async()=>{
 const server=spawn('python3',['-m','http.server','8768','--bind','127.0.0.1','--directory','_site'],{stdio:'ignore'});
 let browser;
 try {
  for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:8768/')).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
  const real=fs.readFileSync('/tmp/live-exa3.json','utf8');
  const Q='ما تأثير الهجمات على السفن في البحر الأحمر على حركة الملاحة العالمية وقناة السويس منذ 2023؟';
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.route('https://osint-rag.egkrkr.workers.dev/**',r=>r.fulfill({status:200,contentType:'application/json',body:real}));
  await page.goto('http://127.0.0.1:8768/assistant.html');
  await page.getByLabel('سؤالك',{exact:true}).fill(Q);
  await page.getByRole('button',{name:'اسأل الآن',exact:true}).click();
  await page.locator('#askResult svg[role="img"]').waitFor();
  await page.waitForTimeout(900);
  await page.screenshot({path:'/downloads/ask-real-mobile.png',fullPage:true});
  console.log('mobile recaptured');
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
