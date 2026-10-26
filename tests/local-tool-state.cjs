// Real DuckDB UI tests; OCR lifecycle uses a controlled Tesseract substitute, not an accuracy test.
const {chromium}=require('playwright');
const {spawn}=require('child_process');
const assert=require('node:assert/strict');
const fs=require('fs');
(async()=>{
 const server=spawn('python3',['-m','http.server','8789','--bind','127.0.0.1','--directory','_site'],{stdio:'ignore'});
 let browser;
 try{
  for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:8789/')).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
  const p=await browser.newPage({viewport:{width:1280,height:900}});
  const upload=(name,text,mimeType='text/csv')=>p.setInputFiles('#file',{name,mimeType,buffer:Buffer.from(text)});
  const status=()=>p.locator('#status').innerText();
  const runSQL=async()=>{await p.click('#run');await p.waitForFunction(()=>!document.querySelector('#run').disabled,{timeout:60000});};
  await p.goto('http://127.0.0.1:8789/data-lab.html');
  await upload('first.csv','city,value\nCairo,10\n');await runSQL();
  assert.ok(await p.locator('#result').innerText().then(s=>s.includes('Cairo')));
  await upload('bad.exe','bad','application/octet-stream');
  assert.ok((await status()).includes('صيغة غير مدعومة'));
  assert.equal(await p.locator('#resultwrap').isVisible(),false);
  assert.equal(await p.locator('#copy').isVisible(),false);
  assert.equal(await p.locator('#run').isDisabled(),true);
  assert.equal(await p.locator('#filemeta').innerText(),'');
  await p.evaluate(()=>{const f=new File(['x'],'huge.csv',{type:'text/csv'});Object.defineProperty(f,'size',{value:101*1024*1024});const dt=new DataTransfer();dt.items.add(f);document.querySelector('#drop').dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));});
  assert.ok((await status()).includes('١٠٠'));assert.equal(await p.locator('#run').isDisabled(),true);
  await upload('broken.json','{not-json','application/json');await runSQL();
  assert.ok((await status()).includes('تحويل JSON'));
  await runSQL();assert.ok((await status()).includes('تحويل JSON'),'retry must re-read input, not query an incomplete connection');
  await upload('second.csv','city,value\nAlex,20\n');
  await p.click('#run');
  assert.equal(await p.locator('#file').isDisabled(),true);
  assert.equal(await p.locator('#sql').isDisabled(),true);
  assert.equal(await p.locator('#resultwrap').isVisible(),false);
  await p.evaluate(()=>{const dt=new DataTransfer();dt.items.add(new File(['city,value\nWrong,999\n'],'wrong.csv',{type:'text/csv'}));document.querySelector('#drop').dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));});
  await p.waitForFunction(()=>!document.querySelector('#run').disabled,{timeout:60000});
  assert.ok((await p.locator('#result').innerText()).includes('Alex'));
  assert.ok(!(await p.locator('#result').innerText()).includes('Wrong'));
  assert.equal(await p.locator('#file').isDisabled(),false);
  await p.fill('#sql','SELECT missing_field FROM data;');
  assert.equal(await p.locator('#resultwrap').isVisible(),false,'editing query invalidates displayed result');
  await runSQL();assert.ok((await status()).includes('تعذّر'));
  await p.fill('#sql','SELECT * FROM data;');await runSQL();
  assert.ok((await p.locator('#result').innerText()).includes('Alex'),'retry after failed query reloads correct source');
  await p.setInputFiles('#file',[]);assert.equal(await p.locator('#run').isDisabled(),true);
  // No real OCR engine/model runs in this lifecycle test.
  await p.route('**/tesseract.min.js',r=>r.fulfill({contentType:'text/javascript',body:`window.terminated=0;window.Tesseract={OEM:{DEFAULT:1},createWorker:async()=>({recognize:()=>new Promise((resolve,reject)=>{window.finishOCR=()=>resolve({data:{text:'controlled old image text'}});window.failOCR=()=>reject(new Error('controlled failure'));}),terminate:async()=>{window.terminated++}})};`}));
  await p.goto('http://127.0.0.1:8789/ocr.html');
  await upload('image.png','dummy','image/png');await p.click('#run');
  await p.waitForFunction(()=>typeof window.finishOCR==='function');
  assert.equal(await p.locator('#file').isDisabled(),true);assert.equal(await p.locator('#lang').isDisabled(),true);
  await p.evaluate(()=>{const dt=new DataTransfer();dt.items.add(new File(['x'],'changed.png',{type:'image/png'}));document.querySelector('#drop').dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));});
  assert.ok((await status()).includes('انتظر'));
  await p.evaluate(()=>window.finishOCR());await p.waitForFunction(()=>!document.querySelector('#run').disabled);
  assert.equal(await p.locator('#out').inputValue(),'controlled old image text');
  assert.equal(await p.evaluate(()=>window.terminated),1);
  await upload('other.png','dummy2','image/png');
  assert.equal(await p.locator('#out').inputValue(),'');assert.equal(await p.locator('#out').isVisible(),false);assert.equal(await p.locator('#copy').isVisible(),false);
  await p.click('#run');await p.waitForFunction(()=>document.querySelector('#file').disabled);
  await p.evaluate(()=>window.failOCR());await p.waitForFunction(()=>!document.querySelector('#run').disabled);
  assert.ok((await status()).includes('controlled failure'));assert.equal(await p.evaluate(()=>window.terminated),2,'worker terminated after recognition failure');
  await p.click('#run');await p.waitForFunction(()=>document.querySelector('#file').disabled);await p.evaluate(()=>window.finishOCR());await p.waitForFunction(()=>!document.querySelector('#run').disabled);
  await p.selectOption('#lang','eng');assert.equal(await p.locator('#out').isVisible(),false);assert.equal(await p.locator('#copy').isVisible(),false);
  await upload('invalid.txt','not image','text/plain');assert.equal(await p.locator('#run').isDisabled(),true);assert.equal(await p.locator('#preview').isVisible(),false);
  fs.mkdirSync('test-output',{recursive:true});
  for(const w of [320,390,1280]){
   await p.setViewportSize({width:w,height:900});
   for(const tool of ['ocr','data-lab']){
    await p.goto('http://127.0.0.1:8789/'+tool+'.html');
    await upload('invalid.exe','bad','application/octet-stream');
    await p.locator('#status').scrollIntoViewIfNeeded();
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),tool+' overflow at '+w);
    await p.screenshot({path:'test-output/local-state-'+tool+'-'+w+'.png'});
   }
  }
  console.log('PASS: real SQL stale-result invalidation, bad selection, input/query retry, busy locks/drop isolation; controlled OCR output invalidation, failure cleanup, language change, busy locks; 320/390/1280 overflow checks. OCR lifecycle mock is NOT OCR quality evidence.');
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
