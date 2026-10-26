import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox'],headless:'new'});
const p=await b.newPage();await p.setViewport({width:420,height:900});
await p.goto('http://localhost:8765/?demo');
await p.waitForFunction("window.T&&T.length||document.getElementById('n').textContent!='0'&&document.getElementById('n').textContent!=''",{timeout:90000}).catch(()=>{});
const ids=await p.evaluate(()=>fetch('/api/tools').then(r=>r.json()).then(t=>t.map(x=>[x.id,x.inputs.some(i=>i[2]=='file')])));
for(const [id,f] of ids){const r=await p.evaluate(async id=>{const t=(await fetch('/api/tools').then(r=>r.json())).find(x=>x.id==id);const b={};t.inputs.forEach(i=>{});return 1},id);
 await p.goto('http://localhost:8765/?demo#'+id);await p.reload();
 await p.waitForSelector('#st',{timeout:30000}).catch(()=>{});
 await new Promise(r=>setTimeout(r,200));
 await p.waitForFunction("document.querySelector('#st')&&document.querySelector('#st').textContent.length>0&&!document.querySelector('#st').textContent.includes('جارٍ')",{timeout:30000}).catch(()=>{});
 console.log(id,f?'(file)':'',await p.$eval('#st',e=>e.textContent).catch(()=>'NO ST'));}
await b.close();
