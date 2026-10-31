// verification.html AI summary section (2026-10-31): the section sends ONLY the active case's
// content, built from case data (never a page scrape), with context 'verify', route-mocked here.
// Asserts content presence, chrome exclusion, provider label, and the filtered-fallback path.
const fs=require('fs'),{spawn}=require('child_process'),assert=require('assert'),{chromium}=require('playwright');
(async()=>{fs.mkdirSync('test-output',{recursive:true});const server=spawn('python3',['-m','http.server','8799','--bind','127.0.0.1','--directory',process.env.TEST_SITE||'_site'],{stdio:'ignore'});let b;try{await new Promise(r=>setTimeout(r,350));b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});const p=await b.newPage({viewport:{width:1280,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8799/verification.html');
await p.fill('#title','حملة تطعيم');await p.fill('#claim','أعلنت الوزارة تطعيم مليوني مواطن خلال ثلاثة أشهر.');
await p.fill('#sourceName','بيان الوزارة');await p.fill('#sourceNote','يذكر الرقم صراحة دون تفاصيل تنفيذ.');await p.fill('#accessDate','2026-10-30T14:00');
await p.click('#evidenceForm button[type="submit"]');
await p.waitForFunction(()=>document.querySelectorAll('#evidenceList .evidence-card').length===1);
assert(await p.locator('#ai-box').isVisible());
let aiBody=null;
await p.route('https://osint-rag.egkrkr.workers.dev/**',async r=>{aiBody=JSON.parse(r.request().postData());await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({summary:{overview:'وصف اختباري لتنظيم الحالة فقط لا حكم فيه على الادعاء.',key_quotes:['أعلنت الوزارة تطعيم مليوني مواطن خلال ثلاثة أشهر.']},provider:'workers-ai'})})});
await p.locator('#ai-summarize').click();
await p.waitForFunction(()=>!document.querySelector('#ai-result').hidden);
assert.equal(aiBody.mode,'summarize_text');
assert.equal(aiBody.context,'verify');
assert(aiBody.text.includes('أعلنت الوزارة تطعيم مليوني مواطن خلال ثلاثة أشهر.'),'claim must be sent');
assert(aiBody.text.includes('بيان الوزارة'),'evidence must be sent');
assert(aiBody.text.includes('التقدير التحريري للصحفي نفسه'),'verdict must be labeled as the journalist\'s own');
assert(!aiBody.text.includes('إضافة الدليل'),'button chrome must not be sent');
assert(!aiBody.text.includes('تصدير ونسخ احتياطي'),'section chrome must not be sent');
assert((await p.locator('#ai-provider').textContent()).includes('Workers AI'));
assert((await p.locator('#ai-overview').textContent()).includes('وصف اختباري'));
await p.unroute('https://osint-rag.egkrkr.workers.dev/**');
await p.route('https://osint-rag.egkrkr.workers.dev/**',async r=>{await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({summary:null,reason:'filtered',retry_after:null})})});
await p.locator('#ai-summarize').click();
await p.waitForFunction(()=>document.querySelector('#ai-status').textContent.includes('غير متاح'));
assert(await p.locator('#ai-result').isHidden());
await p.unroute('https://osint-rag.egkrkr.workers.dev/**');
for(const width of[390,320]){await p.setViewportSize({width,height:900});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))}
assert.deepEqual(errors,[]);
console.log(JSON.stringify({pass:true,contextSent:'verify',chromeExcluded:true,verdictLabeledJournalists:true,filteredFallback:true,responsive:[1280,390,320]}));}finally{if(b)await b.close();server.kill()}})().catch(e=>{console.error(e);process.exitCode=1});
