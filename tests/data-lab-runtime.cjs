// Runtime test for the local data lab: real UI path (file input -> run -> result table),
// engine served only from the site's own host. Evidence bundle to /tmp/datalab-evidence/.
const {chromium}=require('playwright');
const {spawn}=require('child_process');
const fs=require('fs');
const EV='/tmp/datalab-evidence'; fs.mkdirSync(EV,{recursive:true});
const CSV='المدينة,الفئة,المبلغ\nالقاهرة,صحة,150\nالقاهرة,تعليم,90\nالإسكندرية,صحة,75\nالإسكندرية,نقل,30\n';
(async()=>{
 const server=spawn('python3',['-m','http.server','8770','--bind','127.0.0.1','--directory','_site'],{stdio:'ignore'});
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
 const reqs=[];
 try{
  for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:8770/')).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  page.on('request',r=>reqs.push(r.url()));
  await page.goto('http://127.0.0.1:8770/data-lab.html');
  fs.writeFileSync(EV+'/input.csv',CSV);
  await page.setInputFiles('#file',EV+'/input.csv');
  await page.click('#run');
  await page.waitForFunction(()=>{const w=document.querySelector('#resultwrap');return w&&!w.hidden},{timeout:180000});
  const meta=await page.$eval('#resultmeta',e=>e.textContent);
  const head=await page.$$eval('#result th',es=>es.map(e=>e.textContent));
  const rows=await page.$$eval('#result tbody tr',es=>es.map(e=>[...e.children].map(c=>c.textContent)));
  // aggregation query — Arabic identifiers work quoted AND unquoted (regression-pinned)
  await page.fill('#sql','SELECT "الفئة", SUM(CAST("المبلغ" AS DOUBLE)) AS total FROM data GROUP BY "الفئة" ORDER BY total DESC;');
  await page.click('#run');
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('اكتمل'),{timeout:60000});
  const agg=await page.$$eval('#result tbody tr',es=>es.map(e=>[...e.children].map(c=>c.textContent)));
  // full expected row set, no stale data
  const want=[['صحة','225'],['تعليم','90'],['نقل','30']];
  if(JSON.stringify(agg)!==JSON.stringify(want)) throw new Error('aggregation rows mismatch: '+JSON.stringify(agg));
  // error path: mistyped Arabic column -> honest guidance, stale result hidden
  await page.fill('#sql','SELECT "عمود_غير_موجود" FROM data;');
  await page.click('#run');
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('تعذّر'),{timeout:60000});
  const errMsg=await page.locator('#status').innerText();
  if(/_setThrew|not defined/i.test(errMsg)) throw new Error('glue internals leaked: '+errMsg.slice(0,120));
  if(await page.locator('#resultwrap').isVisible()) throw new Error('stale result left visible after failed query');
  const status=await page.$eval('#status',e=>e.textContent);
  // gc.zgo.at is the guide's pre-existing privacy-respecting analytics (analytics.js sitewide), not the data tool.
  const crossOrigin=reqs.filter(u=>!u.startsWith('http://127.0.0.1:8770')&&!u.startsWith('data:')&&!u.startsWith('blob:')&&!u.startsWith('https://gc.zgo.at'));
  fs.writeFileSync(EV+'/result.json',JSON.stringify({head,rows,agg,meta,status,crossOrigin,note:'gc.zgo.at = pre-existing sitewide analytics, excluded'},null,2));
  await page.screenshot({path:EV+'/result-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:EV+'/result-mobile.png'});
  console.log('DL_OUT:',JSON.stringify({head,rowsN:rows.length,agg,meta,crossOrigin}));
  const ok=head.includes('المدينة')&&rows.length===4&&JSON.stringify(agg)===JSON.stringify([['صحة','225'],['تعليم','90'],['نقل','30']])&&crossOrigin.length===0;
  console.log(ok?'RUNTIME-PASS':'RUNTIME-FAIL');
  process.exitCode=ok?0:1;
 }finally{await browser.close();server.kill();}
})().catch(e=>{console.error(e.message);process.exit(1)});
