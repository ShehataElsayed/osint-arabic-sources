import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox'],headless:'new'});
const p=await b.newPage();
async function go(id,fill){await p.goto('http://localhost:8766/#'+id);await p.reload();await p.waitForSelector('#go',{timeout:60000});
 if(fill)await p.$eval('textarea',(e,v)=>e.value=v,fill);
 await p.click('#go');await p.waitForFunction("document.querySelector('#st').textContent&&!document.querySelector('#st').textContent.includes('جارٍ')",{timeout:60000});return p.$eval('#st',e=>e.textContent)}
const heavy=('رفعت الحكومة أسعار الوقود أمس بنسبة 10% وقال الدكتور محمد علي في القاهرة. ').repeat(240);
console.log('heavy case:',await go('case',heavy));
console.log('then claims (same page, engine restarted):',await p.evaluate(async()=>{const r=await fetch('/api/run/claims',{method:'POST',body:JSON.stringify({text:'بلغ التضخم 14% في سبتمبر'})}).then(r=>r.json());return r.ok}));
await b.close();
