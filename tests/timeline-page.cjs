const{chromium}=require('playwright'),{spawn}=require('child_process'),assert=require('assert/strict'),fs=require('fs');(async()=>{fs.mkdirSync('test-output',{recursive:true});const server=spawn('python3',['-m','http.server','8795','--bind','127.0.0.1','--directory',process.env.TEST_SITE||'site'],{stdio:'ignore'});let b;try{b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});const p=await b.newPage({viewport:{width:1280,height:1100}}),external=[],errors=[];p.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:8795'))external.push(r.url())});p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://127.0.0.1:8795/timeline.html');
assert.ok((await p.title()).includes('الخط الزمني'));
assert.deepEqual(external,[],'no third-party on load: '+external.join(','));
await p.fill('#src','أعلنت الوزارة في 2026-01-15 بدء العملية في المنطقة. وفي 2026-03-02 أكدت اكتمال المرحلة الأولى. أمس نُشر تقرير المتابعة الدوري.');
await p.click('#detect');
assert.equal(await p.locator('#cands .tl-cand').count(),3,'three date candidates detected');
assert.deepEqual(external,[],'detection is local');
// add first two candidates with confirmed dates; leave the relative one
for(const i of [0,1]){const c=p.locator('#cands .tl-cand').nth(0);await c.locator('input[aria-label="وصف الحدث"]').fill(i===0?'بدء العملية':'اكتمال المرحلة الأولى');await c.locator('button').click()}
assert.equal(await p.locator('#axis .tl-mark').count(),2,'two dated events rendered on axis');
assert.equal(await p.locator('#undated .tl-cand').count(),0,'undated lane empty until candidate added');
// candidate with relative date still waiting in cands
assert.equal(await p.locator('#cands .tl-cand').count(),1);
// add the relative candidate without a confirmed date -> lands in undated lane
{const c=p.locator('#cands .tl-cand').first();await c.locator('input[aria-label="تاريخ ISO مؤكد"]').fill('');await c.locator('input[aria-label="وصف الحدث"]').fill('نشر تقرير المتابعة');await c.locator('button').click()}
assert.equal(await p.locator('#undated .tl-cand').count(),1,'relative date stays unresolved in undated lane');
// click a marker -> detail
await p.locator('#axis .tl-mark').first().click();
assert.ok(!(await p.locator('#detail').isHidden()));
assert.ok((await p.locator('#detail').textContent()).includes('2026-01-15'));
assert.ok((await p.locator('#detail blockquote').textContent()).includes('بدء العملية'));
// manual event
await p.fill('#m-date','2026-02-10');await p.fill('#m-event','جلسة استماع برلمانية');await p.click('#m-add');
// conflict surfacing: same description, different dates -> review lead card
await p.fill('#m-date','2026-02-12');await p.fill('#m-event','جلسة استماع برلمانية');await p.click('#m-add');
assert.ok(!(await p.locator('#review').isHidden()),'review panel shown');
assert.ok((await p.locator('#review').textContent()).includes('تعارض'),'conflict lead surfaced');
assert.equal(await p.locator('#review .tl-conflict').count(),1,'one conflict card');
// gap surfacing: events span 2026-01-15..2026-03-02 with wide empty stretch
assert.ok((await p.locator('#review').textContent()).includes('فجوة'),'gap lead surfaced');
assert.equal(await p.locator('#axis .tl-mark').count(),4);
// resolve it in the undated lane
await p.locator('#undated .tl-cand input').fill('2026-02-20');
await p.locator('#undated .tl-cand button').first().click();
assert.equal(await p.locator('#axis .tl-mark').count(),5,'resolved event joins axis');
assert.equal(await p.locator('#undated .tl-cand').count(),0,'undated lane cleared');
// export
const[d]=await Promise.all([p.waitForEvent('download'),p.click('#export')]);
const ex=JSON.parse(fs.readFileSync(await d.path()));
assert.equal(ex.format,'timeline-events-v1');
assert.equal(ex.events.length,5);
assert.ok(ex.events.every(e=>e.date&&/^(\d{4})-(\d{2})-(\d{2})$/.test(e.date)));
assert.deepEqual(external,[],'everything stayed local: '+external.join(','));
// bidi on axis date labels
assert.equal(await p.evaluate(()=>getComputedStyle(document.querySelector('#axis .tl-mark text')).direction),'ltr','axis date labels LTR');
await p.screenshot({path:'test-output/timeline-page-desktop.png',fullPage:true});
for(const width of [390,320]){await p.setViewportSize({width,height:1000});await p.waitForTimeout(300);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal scroll at '+width);await p.screenshot({path:`test-output/timeline-page-${width}.png`,fullPage:true})}
assert.deepEqual(errors,[]);
console.log(JSON.stringify({pass:true,events:5,responsive:[1280,390,320]}))}finally{if(b)await b.close();server.kill()}})().catch(e=>{console.error(e);process.exitCode=1})
