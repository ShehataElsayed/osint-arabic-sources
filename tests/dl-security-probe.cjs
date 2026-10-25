// Security probe for the local data lab: attempts external/network access via SQL and verifies
// restrictions. Uses only synthetic data; no private files. Evidence to /tmp/datalab-evidence/.
const {chromium}=require('playwright');
const {spawn}=require('child_process');
const fs=require('fs');
const EV='/tmp/datalab-evidence';
(async()=>{
 const server=spawn('python3',['-m','http.server','8775','--bind','127.0.0.1','--directory','_site'],{stdio:'ignore'});
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
 const out={};
 try{
  for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:8775/')).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
  const page=await browser.newPage();
  const reqs=[]; page.on('request',r=>reqs.push(r.url()));
  page.on('console',m=>{if(m.type()==='error')console.log('CON-ERR:',m.text().slice(0,200))});
  await page.goto('http://127.0.0.1:8775/data-lab.html');
  fs.writeFileSync(EV+'/probe.csv','a,b\n1,x\n2,y\n');
  await page.setInputFiles('#file',EV+'/probe.csv');
  await page.click('#run');
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('اكتمل')||document.querySelector('#status').textContent.includes('تعذّر'),{timeout:180000});
  async function trySQL(label,q){
    await page.fill('#sql',q);
    await page.click('#run');
    await page.waitForFunction(()=>{const s=document.querySelector('#status').textContent;return s.includes('اكتمل')||s.includes('تعذّر')},{timeout:60000});
    const st=await page.$eval('#status',e=>e.textContent);
    const meta=await page.$eval('#resultmeta',e=>e.textContent).catch(()=> '');
    out[label]={query:q,ok:st.includes('اكتمل'),status:st.slice(0,300),meta:(meta||'').slice(0,100)};
    console.log(label,':',st.slice(0,160));
  }
  await trySQL('set_no_external',"SET enable_external_access=false;");
  await trySQL('set_no_autoinstall',"SET autoinstall_known_extensions=false;");
  await trySQL('set_no_autoload',"SET autoload_known_extensions=false;");
  await trySQL('normal_after_lockdown',"SELECT count(*) AS n FROM data;");
  await trySQL('install_httpfs',"INSTALL httpfs;");
  await trySQL('load_httpfs',"LOAD httpfs;");
  await trySQL('remote_csv',"SELECT * FROM read_csv('https://example.com/data.csv');");
  await trySQL('remote_parquet',"SELECT * FROM 'https://example.com/x.parquet' LIMIT 1;");
  await trySQL('attach_remote',"ATTACH 'https://example.com/db.duckdb' AS r;");
  await trySQL('copy_out',"COPY data TO 'export.csv';");
  const cross=reqs.filter(u=>!u.startsWith('http://127.0.0.1:8775')&&!u.startsWith('data:')&&!u.startsWith('blob:')&&!u.startsWith('https://gc.zgo.at'));
  out.crossOrigin=cross;
  console.log('CROSS-ORIGIN ATTEMPTS:',JSON.stringify(cross));
  fs.writeFileSync(EV+'/security-probe.json',JSON.stringify(out,null,2));
 }finally{await browser.close();server.kill();}
})().catch(e=>{console.error(e.message);process.exit(1)});
