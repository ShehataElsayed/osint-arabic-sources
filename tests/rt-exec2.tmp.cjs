const {chromium}=require('playwright');
const {spawn}=require('child_process');
(async()=>{
 const server=spawn('python3',['-m','http.server','8777','--bind','127.0.0.1','--directory','/tmp/roundtrip/osint-guide/_site-built'],{stdio:'ignore'});
 let browser;
 try{
  for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:8777/')).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:8777/data-lab.html');
  await page.setInputFiles('#file', '/tmp/datalab-evidence/input.csv');
  await page.waitForFunction(()=>document.querySelector('#sql')&&!document.querySelector('#sql').disabled, null, {timeout:30000}).catch(()=>{});
  await page.waitForTimeout(2000);
  await page.fill('#sql', 'SELECT "الفئة" AS cat, SUM("المبلغ") AS total FROM data GROUP BY "الفئة" ORDER BY total DESC');
  await page.click('#run');
  await page.waitForTimeout(4000);
  console.log('DATALAB status:', (await page.locator('#status').innerText()).slice(0,120));
  console.log('DATALAB result:', (await page.locator('#result').innerText()).slice(0,200).replace(/\n/g,' | '));
  await page.goto('http://127.0.0.1:8777/ocr.html');
  await page.setInputFiles('#file', '/tmp/ocr-evidence/input.png');
  const t0=Date.now();
  let out='';
  for(let i=0;i<24;i++){ await page.waitForTimeout(5000); out=await page.locator('#out').innerText().catch(()=> ''); if(out && out.trim().length>20) break; }
  const st=await page.locator('body').innerText();
  console.log('OCR seconds:', ((Date.now()-t0)/1000).toFixed(0));
  console.log('OCR out:', out.slice(0,220).replace(/\n/g,' | ') || '(empty)');
  const ref=require('fs').readFileSync('/tmp/ocr-evidence/reference.txt','utf8').trim();
  console.log('OCR matches reference:', out.trim()===ref);
  if(/تعذّر الاستخراج/.test(st)) console.log('OCR ERROR SHOWN:', st.match(/تعذّر الاستخراج[^\n]*/)[0]);
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error('EXEC FAIL:',e.message);process.exit(1)});
