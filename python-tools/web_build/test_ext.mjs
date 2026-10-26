import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox'],headless:'new'});
const p=await b.newPage();const reqs=[];p.on('request',r=>reqs.push(r.url()));
async function run(id,files,fill){await p.goto('http://localhost:8765/#'+id);await p.reload();await p.waitForSelector('#go',{timeout:60000});
 if(files){const i=await p.$('input[data-f]');await i.uploadFile(...files)}
 if(fill)await p.$eval('input[name]',(e,v)=>e.value=v,fill);
 await p.click('#go');await p.waitForFunction("document.querySelector('#st').textContent&&!document.querySelector('#st').textContent.includes('جارٍ')",{timeout:90000});
 return [await p.$eval('#st',e=>e.textContent),await p.$eval('.rv',e=>e.innerText.replace(/\n+/g,' | ').slice(0,260)).catch(()=>'')]}
console.log('dnstwist',await run('dnstwist',null,'example.org'));
console.log('dnstwist bad',await run('dnstwist',null,'-x'));
console.log('olevba ppt',await run('olevba',['/tmp/rr/runner/pyodide/fixtures/sample_with_vba.ppt']));
console.log('olevba text',await run('olevba',['/tmp/pyo/imgs/noise.png']));
console.log('oversize 21MB',await run('olevba',['/tmp/pyo/big.bin']));
console.log('zipbomb',await run('olevba',['/tmp/pyo/bomb.zip']));
console.log('external',reqs.filter(u=>!u.startsWith('http://localhost:8765')&&!u.startsWith('blob:')&&!u.startsWith('data:')));
await b.close();
