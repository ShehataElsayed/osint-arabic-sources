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
const classes=await p.evaluate(()=>[...document.querySelectorAll('#frames figure img')].map(img=>{const c=document.createElement('canvas');c.width=10;c.height=10;const x=c.getContext('2d');x.drawImage(img,0,0);const d=x.getImageData(5,5,1,1).data;return d[0]>200?'red':d[2]>200?'blue':'other'}));
assert.deepEqual(classes,['red','red','blue','blue'],'real canvas frames from the actual video scenes');
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
await p.screenshot({path:'test-output/video-page-desktop.png',fullPage:true});
for(const width of [390,320]){await p.setViewportSize({width,height:900});await p.waitForTimeout(300);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal scroll at '+width);await p.screenshot({path:`test-output/video-page-${width}.png`,fullPage:true})}
assert.deepEqual(errors,[]);
console.log(JSON.stringify({pass:true,frames:4,classes,responsive:[1280,390,320]}))}finally{if(b)await b.close();server.kill()}})().catch(e=>{console.error(e);process.exitCode=1})
