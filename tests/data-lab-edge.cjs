// Edge-case headers + JSON input through the REAL data lab UI. Offline fixtures.
const {chromium}=require('playwright');
const {spawn}=require('child_process');
const fs=require('fs');
const cases={
 dup:{csv:'المدينة,المدينة,المبلغ\nأ,ب,1\n',expect:['المدينة','المدينة_1','المبلغ']},
 empty:{csv:'المدينة,,المبلغ\nأ,ب,1\n',expect:['المدينة','column1','المبلغ']},
 quoted:{csv:'"اسم, بفاصلة",المبلغ\nأ,1\n',expect:['اسم, بفاصلة','المبلغ']},
 newline:{csv:'"عنوان\nمتعدد",المبلغ\nأ,1\n',expect:['عنوان\nمتعدد','المبلغ']},
 mixed:{csv:'city,الفئة,amount\nx,صحة,2\n',expect:['city','الفئة','amount']},
};
(async()=>{
 const server=spawn('python3',['-m','http.server','8778','--bind','127.0.0.1','--directory','_site'],{stdio:'ignore'});
 let browser;const fails=[];
 try{
  for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:8778/')).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
  const page=await browser.newPage();
  const run=async(path)=>{
   await page.goto('http://127.0.0.1:8778/data-lab.html');
   await page.setInputFiles('#file',path);
   await page.click('#run');
   for(let i=0;i<20;i++){await page.waitForTimeout(2000);const st=await page.locator('#status').innerText();if(st.includes('اكتمل'))return true;if(st.includes('تعذّر'))return 'ERR:'+st.slice(0,100);}
   return 'TIMEOUT';
  };
  for(const [name,c] of Object.entries(cases)){
   fs.writeFileSync('/tmp/edge-'+name+'.csv',c.csv);
   const r=await run('/tmp/edge-'+name+'.csv');
   if(r!==true){fails.push(name+' run: '+r);continue;}
   const head=await page.$$eval('#result th',es=>es.map(e=>e.textContent));
   if(JSON.stringify(head)!==JSON.stringify(c.expect))fails.push(name+' head: '+JSON.stringify(head));
  }
  fs.writeFileSync('/tmp/edge.json',JSON.stringify([{city:'القاهرة',value:5},{city:'جدة',value:7}]));
  const r=await run('/tmp/edge.json');
  if(r!==true)fails.push('json run: '+r);
  else{const head=await page.$$eval('#result th',es=>es.map(e=>e.textContent));if(JSON.stringify(head)!==JSON.stringify(['city','value']))fails.push('json head: '+JSON.stringify(head));}
 }finally{if(browser)await browser.close();server.kill();}
 if(fails.length){console.error('EDGE FAILURES:\n- '+fails.join('\n- '));process.exit(1);}
 console.log('PASS: data-lab edge headers (duplicate/empty/quoted-comma/embedded-newline/mixed) + JSON input');
})().catch(e=>{console.error(e.message);process.exit(1)});
