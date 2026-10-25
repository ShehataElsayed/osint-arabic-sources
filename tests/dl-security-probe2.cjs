// Probe v2: can untrusted SQL undo the lockdown? Tests re-enable, multi-statement,
// fresh connection, and CSP worker inheritance (fresh engine WITHOUT lockdown, CSP still active).
// Synthetic data only. Enforced configuration + tested paths; no absolute claims.
const {chromium}=require('playwright');
const {spawn}=require('child_process');
const fs=require('fs');
const EV='/tmp/datalab-evidence';
(async()=>{
 const server=spawn('python3',['-m','http.server','8776','--bind','127.0.0.1','--directory','_site'],{stdio:'ignore'});
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
 const out={};
 try{
  for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:8776/')).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
  const page=await browser.newPage();
  const reqs=[]; page.on('request',r=>reqs.push(r.url()));
  await page.goto('http://127.0.0.1:8776/data-lab.html');
  fs.writeFileSync(EV+'/probe2.csv','a\n1\n');
  await page.setInputFiles('#file',EV+'/probe2.csv');
  await page.click('#run');
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('اكتمل'),{timeout:180000});
  async function trySQL(label,q){
    await page.fill('#sql',q);
    await page.click('#run');
    await page.waitForFunction(()=>{const s=document.querySelector('#status').textContent;return s.includes('اكتمل')||s.includes('تعذّر')||s.includes('معطّل')},{timeout:60000});
    const st=await page.$eval('#status',e=>e.textContent);
    out[label]={query:q.slice(0,120),ok:st.includes('اكتمل'),status:st.slice(0,200)};
    console.log(label,':',st.slice(0,140));
  }
  await trySQL('reenable',"SET enable_external_access=true;");
  await trySQL('reenable_lock',"SET lock_configuration=false;");
  await trySQL('multistmt',"SET enable_external_access=true; SELECT * FROM read_csv('https://example.com/x.csv');");
  // fresh connection: new file resets conn; lockdown must reapply
  fs.writeFileSync(EV+'/probe3.csv','c\n9\n');
  await page.setInputFiles('#file',EV+'/probe3.csv');
  await page.fill('#sql','SELECT count(*) AS n FROM data;');
  await page.click('#run');
  await page.waitForFunction(()=>{const s=document.querySelector('#status').textContent;return s.includes('اكتمل')||s.includes('تعذّر')},{timeout:120000});
  out.fresh_conn_load=await page.$eval('#resultmeta',e=>e.textContent).catch(()=>'(none)');
  console.log('fresh_conn_load:',out.fresh_conn_load);
  await trySQL('fresh_conn_install',"INSTALL httpfs;");
  await trySQL('lock_config_set',"SET lock_configuration=true;");
  await trySQL('reenable_after_lock',"SET enable_external_access=true;");
  const crossLocked=reqs.filter(u=>!u.startsWith('http://127.0.0.1:8776')&&!u.startsWith('data:')&&!u.startsWith('blob:')&&!u.startsWith('https://gc.zgo.at'));
  // CSP worker inheritance: brand-new engine, NO lockdown SETs, CSP still applies
  const csp=await page.evaluate(async()=>{
    const duckdb=await import('/duckdb/duckdb-browser.mjs');
    const w=new Worker('/duckdb/duckdb-browser-mvp.worker.js');
    const db=new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(0),w);
    await db.instantiate('/duckdb/duckdb-mvp.wasm',null);
    const c=await db.connect();
    try{ await c.query('INSTALL httpfs'); return 'install-returned'; }
    catch(e){ return 'blocked: '+String(e&&e.message||e).slice(0,120); }
  });
  await new Promise(r=>setTimeout(r,3000));
  const crossCSP=reqs.filter(u=>!u.startsWith('http://127.0.0.1:8776')&&!u.startsWith('data:')&&!u.startsWith('blob:')&&!u.startsWith('https://gc.zgo.at')&&!crossLocked.includes(u));
  out.csp_worker_test=csp; out.cross_locked=crossLocked; out.cross_csp_phase=crossCSP;
  console.log('CSP-WORKER:',csp,'| new cross-origin in CSP phase:',JSON.stringify(crossCSP));
  fs.writeFileSync(EV+'/security-probe2.json',JSON.stringify(out,null,2));
 }finally{await browser.close();server.kill();}
})().catch(e=>{console.error(e.message);process.exit(1)});
