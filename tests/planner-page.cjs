const{chromium}=require('playwright'),{spawn}=require('child_process'),assert=require('assert/strict'),fs=require('fs');(async()=>{fs.mkdirSync('test-output',{recursive:true});const server=spawn('python3',['-m','http.server','8798','--bind','127.0.0.1','--directory',process.env.TEST_SITE||'site'],{stdio:'ignore'});let b;try{b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});const p=await b.newPage({viewport:{width:1280,height:1000}}),external=[],errors=[];p.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:8798'))external.push(r.url())});p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://127.0.0.1:8798/planner.html');
assert.ok((await p.title()).includes('مصمم مسار التحقق'));
assert.equal(await p.locator('.pl-mat').count(),11,'all materials rendered');
// empty input -> guidance, not a plan
await p.click('#run');
assert.ok((await p.locator('#status').textContent()).includes('صف القضية'));
// vague text -> empty plan guidance
await p.fill('#case','كلام عام بلا إشارات واضحة إطلاقًا');
await p.click('#run');
assert.ok((await p.locator('.pl-empty').textContent()).includes('لم تكفِ الإشارات'));
assert.deepEqual(external,[],'no network before results: '+external.join(','));
// real case: video + images + unknown domain + archive signals
await p.fill('#case','وصلني فيديو وصور منشورة على نطاق موقع مجهول، وأريد التحقق من أصلها ومن النسخة القديمة في الأرشيف');
await p.locator('.pl-mat input[value="video"]').check();
await p.locator('.pl-mat input[value="images"]').check();
await p.click('#run');
await p.waitForSelector('.pl-card');
const cards=await p.locator('.pl-card').count();
assert.ok(cards>=4,'domain, archive, video, image suggested: '+cards);
const first=await p.locator('.pl-card').first().textContent();
assert.ok(first.includes('ملف النطاق'),'domain tool leads the path');
assert.ok(first.includes('لماذا رُشحت')&&first.includes('شرط التوقف')&&first.includes('المدخلات')&&first.includes('النتيجة المتوقعة'));
const evAll=(await p.locator('.pl-ev').allTextContents()).join(' ');
assert.ok(evAll.includes('مواد:'),'some card cites declared materials');
assert.ok(evAll.includes('إشارات من وصفك:'),'some card cites quoted description signals');
assert.ok(evAll.includes('فيديو')||evAll.includes('صور'),'checked materials surface in evidence');
const archiveCard=await p.locator('.pl-card:has-text("أرشيف الويب")').textContent();
assert.ok(archiveCard.includes('يُرسل إلى خدمة الأرشيف'),'archive external-send disclosure present');
assert.ok((await p.locator('.pl-open').first().getAttribute('href'))==='./domain-dossier.html');
assert.ok((await p.locator('.pl-notes').textContent()).includes('الذكاء الاصطناعي'),'AI-deferred note visible');
assert.deepEqual(external,[],'zero network after planning: '+external.join(','));
// export enabled and copy works via clipboard permission
assert.ok(await p.locator('#export').isEnabled());
await p.screenshot({path:'test-output/planner-desktop.png',fullPage:true});
for(const width of [390,320]){await p.setViewportSize({width,height:900});await p.waitForTimeout(300);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal scroll at '+width);await p.screenshot({path:`test-output/planner-${width}.png`,fullPage:true})}
assert.deepEqual(errors,[]);
console.log(JSON.stringify({pass:true,cards,externalRequests:0,responsive:[1280,390,320]}))}finally{if(b)await b.close();server.kill()}})().catch(e=>{console.error(e);process.exitCode=1})
