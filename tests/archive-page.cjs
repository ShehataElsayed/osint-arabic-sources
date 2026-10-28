const{chromium}=require('playwright'),{spawn}=require('child_process'),assert=require('assert/strict'),fs=require('fs');(async()=>{fs.mkdirSync('test-output',{recursive:true});const server=spawn('python3',['-m','http.server','8801','--bind','127.0.0.1','--directory',process.env.TEST_SITE||'site'],{stdio:'ignore'});let b;try{b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});const p=await b.newPage({viewport:{width:1280,height:1100}}),external=[],errors=[];p.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:8801'))external.push(r.url())});p.on('pageerror',e=>errors.push(e.message));
const caps=[['20200102090000','AAA',804],['20200615080000','AAA',804],['20210101070000','BBB',912],['20230601060000','BBB',900],['20251001050000','CCC',1100]].map(([t,d,l])=>({title:'http://example.org/',originalURL:'http://example.org/',linkToArchive:'https://arquivo.pt/wayback/'+t+'/http://example.org/',tstamp:t,contentLength:l,digest:d,mimeType:'text/html'}));
await p.route('https://arquivo.pt/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({serviceName:'Arquivo.pt',estimated_nr_results:1423,response_items:caps})}));
await p.route('https://archive.org/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({url:'http://example.org/',archived_snapshots:{closest:{available:true,url:'https://web.archive.org/web/20251001050000/http://example.org/',timestamp:'20251001050000',status:'200'}}})}));
await p.goto('http://127.0.0.1:8801/archive.html');
assert.ok((await p.title()).includes('أرشيف الويب'));
assert.deepEqual(external,[],'no third-party on load: '+external.join(','));
await p.fill('#url','example.org');
await p.click('#search');
await p.waitForSelector('#result:not([hidden])');
// only arquivo.pt contacted
assert.ok(external.length>=1&&external.every(u=>u.startsWith('https://arquivo.pt/')),'only arquivo.pt queried: '+external.join(','));
const stats=await p.locator('#stats').textContent();
assert.ok(stats.includes('1423'),'estimated total from first page shown: '+stats);
assert.ok(stats.includes('2020-01-02')&&stats.includes('2025-10-01'),'range scoped to returned captures');
assert.equal(await p.evaluate(()=>getComputedStyle(document.querySelector('#table tbody td')).color),'rgb(25, 28, 32)','table cell text is dark, not theme pale green');
assert.equal(await p.evaluate(()=>getComputedStyle(document.querySelector('#table tbody td a')).color),'rgb(26, 107, 34)','view links dark green on light rows');
assert.equal(await p.locator('#chart rect.aw-bar').count(),4,'year bars: 2020,2021,2023,2025');
assert.equal(await p.locator('#table tbody tr').count(),5,'capture rows');
assert.equal(await p.locator('#table tbody tr.aw-change').count(),2,'two digest-change points flagged');
assert.ok((await p.locator('#table a').first().getAttribute('href')).startsWith('https://arquivo.pt/wayback/'),'view links open arquivo.pt');
// wayback availability button sends to archive.org only on click
await p.click('#wb');
await p.waitForFunction(()=>document.querySelector('#status').textContent.includes('archive.org'));
assert.ok(external.some(u=>u.startsWith('https://archive.org/wayback/available')),'wayback availability queried on click');
assert.ok((await p.locator('#result .aw-chip').getAttribute('href')).startsWith('https://web.archive.org/'),'archive.org snapshot link shown');
// export
const[d]=await Promise.all([p.waitForEvent('download'),p.click('#export')]);
const ex=JSON.parse(fs.readFileSync(await d.path()));
assert.equal(ex.format,'archive-lookup-v1');
assert.equal(ex.captures.length,5);
assert.equal(ex.queriedUrl,'https://example.org/','URL normalized');
assert.ok(external.every(u=>u.startsWith('https://arquivo.pt/')||u.startsWith('https://archive.org/')),'external calls limited to the two archive services');
await p.screenshot({path:'test-output/archive-page-desktop.png',fullPage:true});
for(const width of [390,320]){await p.setViewportSize({width,height:1000});await p.waitForTimeout(300);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal scroll at '+width);await p.screenshot({path:`test-output/archive-page-${width}.png`,fullPage:true})}
assert.deepEqual(errors,[]);
console.log(JSON.stringify({pass:true,captures:5,changes:2,responsive:[1280,390,320]}))}finally{if(b)await b.close();server.kill()}})().catch(e=>{console.error(e);process.exitCode=1})
