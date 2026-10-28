const{chromium}=require('playwright'),{spawn}=require('child_process'),assert=require('assert/strict'),fs=require('fs');(async()=>{fs.mkdirSync('test-output',{recursive:true});const server=spawn('python3',['-m','http.server','8798','--bind','127.0.0.1','--directory',process.env.TEST_SITE||'site'],{stdio:'ignore'});let b;try{b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});const p=await b.newPage({viewport:{width:1280,height:1000}}),external=[],errors=[];p.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:8798'))external.push(r.url())});p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://127.0.0.1:8798/domain-dossier.html');
assert.ok((await p.title()).includes('ملف النطاق'));
assert.deepEqual(external,[],'no third-party on load: '+external.join(','));
await p.fill('#url','https://example.org/news/x?y=1');
await p.click('#parse');
assert.ok((await p.locator('#parse-out').textContent()).includes('example.org'));
assert.deepEqual(external,[],'parse is local only');
await p.route('https://dns.google/**',r=>r.fulfill({json:{Status:0,Question:[{name:'example.org.',type:1}],Answer:[{name:'example.org.',type:1,TTL:60,data:'192.0.2.1'}]}}));
await p.route('https://rdap.org/**',r=>r.fulfill({json:{objectClassName:'domain',ldhName:'example.org',status:['active'],events:[{eventAction:'registration',eventDate:'1995-08-14T04:00:00Z'},{eventAction:'expiration',eventDate:'2027-08-13T04:00:00Z'}],entities:[{roles:['registrar'],vcardArray:['vcard',[['fn',{},'text','Test Registrar LLC']]]}],nameservers:[{ldhName:'a.iana-servers.net'}]}}));
await p.click('#dns');
await p.waitForFunction(()=>document.querySelector('#cards').textContent.includes('192.0.2.1'));
await p.click('#rdap');
await p.waitForFunction(()=>document.querySelector('#cards').textContent.includes('Test Registrar LLC'));
assert.ok(external.every(u=>u.startsWith('https://dns.google/')||u.startsWith('https://rdap.org/')),'only explicit endpoints: '+external.join(','));
for(const sel of ['#parse-out','.dd-card .dd-val'])assert.equal(await p.evaluate(s=>getComputedStyle(document.querySelector(s)).direction,sel),'ltr','technical values isolated LTR: '+sel);
const[d]=await Promise.all([p.waitForEvent('download'),p.click('#save')]);
const dossier=JSON.parse(fs.readFileSync(await d.path()));
assert.equal(dossier.records.length,2);
assert.ok(dossier.records[1].summary.includes('1995-08-14'));
await p.screenshot({path:'test-output/domain-page-desktop.png',fullPage:true});
for(const width of [390,320]){await p.setViewportSize({width,height:900});await p.waitForTimeout(300);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal scroll at '+width);await p.screenshot({path:`test-output/domain-page-${width}.png`,fullPage:true})}
assert.deepEqual(errors,[]);
console.log(JSON.stringify({pass:true,cards:2,responsive:[1280,390,320]}))}finally{if(b)await b.close();server.kill()}})().catch(e=>{console.error(e);process.exitCode=1})
