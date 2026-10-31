const{chromium}=require('playwright'),{spawn}=require('child_process'),assert=require('assert/strict'),fs=require('fs');(async()=>{fs.mkdirSync('test-output',{recursive:true});const server=spawn('python3',['-m','http.server','8797','--bind','127.0.0.1','--directory',process.env.TEST_SITE||'site'],{stdio:'ignore'});let b;try{b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});const p=await b.newPage({viewport:{width:1280,height:1000}}),external=[],errors=[];p.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:8797'))external.push(r.url())});p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://127.0.0.1:8797/video-frames.html');
assert.ok((await p.title()).includes('لقطات الفيديو'));
assert.deepEqual(external,[],'no third-party on load: '+external.join(','));
await p.setInputFiles('#file','tests/fixtures/journalist-video-scenes.mp4');
await p.waitForFunction(()=>!document.querySelector('#run').disabled);
assert.deepEqual(external,[],'no network on file pick');
assert.ok((await p.locator('#meta').textContent()).includes('SHA-256'));
await p.click('#run');
await p.waitForFunction(()=>!document.querySelector('#save').disabled,{timeout:40000});
assert.equal(await p.locator('#frames figure').count(),4,'four temporal frames');
// reverse-search consent gate: press 1 arms consent with ZERO network; press 2 makes exactly one call (route-mocked)
{const fig=p.locator('#frames figure').first();
 assert.ok(await fig.locator('.rs-btn').count(),'reverse button rendered per frame');
 let rsCalls=0;await p.route('https://reverse-search-proxy.egkrkr.workers.dev/**',async r=>{rsCalls++;await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({visual_matches:[{title:'t',link:'https://example.com/x',source:'s'}],exact_matches:[]})})});
 await fig.locator('.rs-btn').click();
 assert.ok((await fig.locator('.rs-status').innerText()).includes('SerpApi'),'consent notice names provider');
 assert.equal(rsCalls,0,'first press uploads nothing');
 await fig.locator('.rs-btn').click();
 await p.waitForFunction(()=>document.querySelector('#frames figure .rs-list li'));
 assert.equal(rsCalls,1,'confirm press sends exactly one upload');
 await p.unroute('https://reverse-search-proxy.egkrkr.workers.dev/**');
 for(let i=external.length-1;i>=0;i--)if(external[i].includes('workers.dev'))external.splice(i,1)}

// AI explain section (2026-10-31): unhidden with results, route-mocked worker, provider label,
// verbatim quotes; a filtered worker response shows the honest fallback and keeps results intact.
{assert.ok(!(await p.evaluate(()=>document.getElementById('ai-box').hidden)),'ai-box unhidden with results');
 await p.route('https://osint-rag.egkrkr.workers.dev/**',async r=>{await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({summary:{overview:'وصف اختباري للنتائج فقط لا حكم فيه على الفيديو.',key_quotes:['لقطة البداية المرجعية']},provider:'workers-ai'})})});
 await p.click('#ai-summarize');
 await p.waitForFunction(()=>!document.getElementById('ai-result').hidden);
 assert.ok((await p.locator('#ai-provider').innerText()).includes('Workers AI'),'provider label shown');
 assert.ok((await p.locator('#ai-overview').innerText()).includes('وصف اختباري'),'overview rendered');
 assert.equal(await p.locator('#ai-quotes li').count(),1,'verbatim quote rendered');
 await p.unroute('https://osint-rag.egkrkr.workers.dev/**');
 await p.route('https://osint-rag.egkrkr.workers.dev/**',async r=>{await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({summary:null,reason:'filtered',retry_after:null})})});
 await p.click('#ai-summarize');
 await p.waitForFunction(()=>document.getElementById('ai-status').textContent.includes('غير متاح'));
 assert.ok((await p.locator('#ai-status').innerText()).includes('نتائجك الكاملة ظاهرة'),'honest fallback names visible results');
 assert.ok((await p.evaluate(()=>!document.getElementById('vf-result').hidden)),'results intact after filtered');
 assert.ok((await p.evaluate(()=>document.getElementById('ai-result').hidden)),'no stale result after filtered');
 await p.unroute('https://osint-rag.egkrkr.workers.dev/**');
 for(let i=external.length-1;i>=0;i--)if(external[i].includes('osint-rag'))external.splice(i,1)}
// Seek timing is not frame-exact: a cut frame can land mid-fade, so a single pixel is
// unreliable (CI 2026-10-31: frame 3 sampled red on one run, blue on the next, same code).
// Average the whole downscaled frame and require a clear dominant channel; the sequence must
// still run red-scene -> blue-scene, proving the frames are real canvas captures of the
// fixture's two scenes, not placeholders.
const classes=await p.evaluate(()=>[...document.querySelectorAll('#frames figure img')].map(img=>{const c=document.createElement('canvas');c.width=10;c.height=10;const x=c.getContext('2d');x.drawImage(img,0,0);const d=x.getImageData(0,0,10,10).data;let r=0,b=0;for(let i=0;i<d.length;i+=4){r+=d[i];b+=d[i+2]}r/=100;b/=100;return r>150&&r-b>40?'red':b>150&&b-r>40?'blue':'other'}));
assert.ok(classes[0]==='red'&&classes[classes.length-1]==='blue'&&classes.every(c=>c!=='other')&&classes.indexOf('blue')>classes.lastIndexOf('red'),'real canvas frames from the actual video scenes: '+classes.join(','));
assert.deepEqual(external,[],'frame capture is fully local: '+external.join(','));
for(const sel of ['#meta','#frames figcaption'])assert.equal(await p.evaluate(s=>getComputedStyle(document.querySelector(s)).direction,sel),'ltr','technical values isolated LTR: '+sel);
// frame text index (B2): local OCR per frame, review caveat
assert.ok(await p.evaluate(()=>!document.querySelector('#ocr-run').disabled),'ocr index button enabled after frames');
await p.click('#ocr-run');
await p.waitForFunction(()=>!document.querySelector('#ocr-box').hidden,{timeout:90000});
assert.equal(await p.locator('#ocr-list .vf-ocr').count(),4,'ocr index entry per frame');
assert.deepEqual(external,[],'ocr indexing stayed local: '+external.join(','));
await p.fill('#notes','ملاحظة مراجعة اختبارية');
const[d]=await Promise.all([p.waitForEvent('download'),p.click('#save')]);
const rec=JSON.parse(fs.readFileSync(await d.path()));
assert.equal(rec.format,'video-frames-record-v1');
assert.equal(rec.source.frames.length,4);
assert.equal(rec.source.sha256.length,64);
assert.equal(rec.humanNotes,'ملاحظة مراجعة اختبارية');
assert.equal(rec.source.ocrIndex.frames.length,4,'ocr index exported');
assert.ok(rec.source.ocrIndex.caveat.includes('unverified'),'engine caveat exported');
assert.equal(rec.reviewState,'manual-review-required');
const[df]=await Promise.all([p.waitForEvent('download'),p.locator('#frames figure button').first().click()]);
assert.ok((await df.path()).length>0,'per-frame JPEG downloads');
// scene-change keyframe mode: picks the red->blue transition, same local guarantees
await p.selectOption('#vf-mode','scene');await p.selectOption('#vf-count','8');
await p.click('#run');
await p.waitForFunction(()=>{const r=document.getElementById('vf-result');return r&&!r.hidden&&document.querySelectorAll('#frames figure').length===8},undefined,{timeout:120000});
assert.ok((await p.textContent('#vf-result')).includes('تغيّر المشهد'),'professional result card names scene mode');
assert.ok((await p.textContent('#vf-result')).includes('الملاحظة')&&(await p.textContent('#vf-result')).includes('خطوة التحقق'),'professional 3-row result card');
const sceneCaps=await p.evaluate(()=>[...document.querySelectorAll('#frames figcaption')].map(c=>c.textContent));
assert.ok(sceneCaps.some(t=>t.includes('تغيّر مرصود')),'ranked changes labeled');
assert.ok(sceneCaps.some(t=>t.includes('لقطة زمنية تكميلية')),'temporal fillers labeled distinctly');
assert.deepEqual(external,[],'scene sweep stayed local: '+external.join(','));
const[d2]=await Promise.all([p.waitForEvent('download'),p.click('#save')]);
const rec2=JSON.parse(fs.readFileSync(await d2.path()));
assert.equal(rec2.source.extractionMode,'scene-change');
assert.equal(rec2.source.requestedCount,8);
assert.equal(rec2.source.frames.length,8);
assert.ok(rec2.source.limitations.includes('statistical'),'scene limitations exported');
assert.ok(rec2.source.frames.some(f=>f.kind==='scene-change')&&rec2.source.frames.some(f=>f.kind==='temporal-fill'),'frame kinds exported');
assert.ok(!('fpsEstimate' in rec2.source),'no playback-throughput metric presented as file fact');
await p.screenshot({path:'test-output/video-page-desktop.png',fullPage:true});
for(const width of [390,320]){await p.setViewportSize({width,height:900});await p.waitForTimeout(300);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal scroll at '+width);await p.screenshot({path:`test-output/video-page-${width}.png`,fullPage:true})}
assert.deepEqual(errors,[]);
console.log(JSON.stringify({pass:true,frames:4,classes,responsive:[1280,390,320]}))}finally{if(b)await b.close();server.kill()}})().catch(e=>{console.error(e);process.exitCode=1})
