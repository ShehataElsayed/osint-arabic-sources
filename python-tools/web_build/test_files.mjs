import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox'],headless:'new'});
const p=await b.newPage();await p.setViewport({width:420,height:1000});
const reqs=[],errs=[];p.on('request',r=>reqs.push(r.url()));p.on('console',m=>m.type()=='error'&&errs.push(m.text().slice(0,700)));p.on('pageerror',e=>errs.push(e.message.slice(0,150)));
async function run(id,files,pre){await p.goto('http://localhost:8765/#'+id);await p.reload();await p.waitForSelector('#go',{timeout:60000});
 if(files){const i=await p.$('input[data-f]');await i.uploadFile(...files)}
 if(pre)await pre();
 await p.click('#go');await p.waitForFunction("!document.querySelector('#st').textContent.includes('جارٍ')&&document.querySelector('#st').textContent",{timeout:60000});
 return await p.$eval('#st',e=>e.textContent)}
console.log('imghash',await run('imghash',['imgs/a.png','imgs/a_small.jpg','imgs/noise.png']));
console.log('groups',await p.$eval('.rv',e=>e.innerText.replace(/\n+/g,' | ').slice(0,300)));
await p.screenshot({path:'/downloads/w4_imghash.png',fullPage:true});
console.log('exif',await run('exif',['imgs/a_small.jpg']));
console.log('evidence',await run('evidence',['imgs/a.png']));
console.log('nofile',await run('evidence',null));
console.log('toolong',await run('claims',null,async()=>{await p.$eval('textarea',e=>e.value='ك'.repeat(150000))}));
console.log('ext requests',reqs.filter(u=>!u.startsWith('http://localhost:8765')&&!u.startsWith('blob:')&&!u.startsWith('data:')));
console.log('errs',errs);
await p.evaluate(()=>fetch('https://example.com',{mode:'no-cors'}).then(()=>'LEAK').catch(()=>'blocked')).then(r=>console.log('external fetch',r));
await b.close();
