const{chromium}=require('playwright'),{spawn}=require('child_process'),assert=require('assert/strict'),fs=require('fs');(async()=>{fs.mkdirSync('test-output',{recursive:true});const server=spawn('python3',['-m','http.server','8796','--bind','127.0.0.1','--directory',process.env.TEST_SITE||'site'],{stdio:'ignore'});let b;try{b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});const p=await b.newPage({viewport:{width:1280,height:1100}}),external=[],errors=[];p.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:8796'))external.push(r.url())});p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://127.0.0.1:8796/versions.html');
assert.ok((await p.title()).includes('مقارنة النسخ'));
assert.deepEqual(external,[],'no third-party on load: '+external.join(','));
const va=['بيان صحفي صادر عن الوزارة','أعلنت الوزارة اليوم عن إطلاق المرحلة الأولى من المشروع.','وقال المتحدث إن التكلفة تبلغ 40 مليون جنيه.','وأضاف أن العمل سيبدأ مطلع العام المقبل.','انتهى البيان'].join('\n');
const vb=['بيان صحفي صادر عن الوزارة','أعلنت الوزارة اليوم عن إطلاق المرحلة الأولى من المشروع.','وقال المتحدث إن التكلفة تبلغ 55 مليون جنيه مصري.','ونوه المتحدث بأن الرقم قابل للمراجعة.','وأضاف أن العمل سيبدأ مطلع العام المقبل.'].join('\n');
await p.fill('#va',va);await p.fill('#vb',vb);
await p.click('#compare');
assert.ok(!(await p.locator('#result').isHidden()),'result section shown');
const stats=await p.locator('#stats').textContent();
assert.ok(stats.includes('3')&&stats.includes('1'),'stats rendered');
assert.equal(await p.locator('#diff .vd-row').count(),6,'six diff rows');
assert.equal(await p.locator('#diff .vd-same').count(),3,'three unchanged rows (matched lines)');
assert.equal(await p.locator('#diff .vd-mod').count(),1,'one modified row');
assert.equal(await p.locator('#diff .vd-add').count(),1,'one added row');
assert.equal(await p.locator('#diff .vd-del').count(),1,'one removed row (انتهى البيان)');
// word-level highlights inside the modified row
const mod=p.locator('#diff .vd-mod').first();
assert.ok((await mod.locator('del').allTextContents()).join('').includes('40'),'removed word 40 highlighted');
assert.ok((await mod.locator('ins').allTextContents()).join('').includes('55'),'added word 55 highlighted');
// number-change panel surfaces the 40 -> 55 change with before/after text
assert.ok(!(await p.locator('#numchg').isHidden()),'number panel shown');
const nc=await p.locator('#numchg').textContent();
assert.ok(nc.includes('40')&&nc.includes('55'),'changed numbers listed');
assert.ok(await p.locator('#numchg .vn-card .vn-old').first().textContent().then(s=>s.includes('40')),'before text shown');
assert.ok(await p.locator('#numchg .vn-card .vn-new').first().textContent().then(s=>s.includes('55')),'after text shown');
// whitespace-insensitive option keeps matching despite spacing change
await p.fill('#va','سطر واحد   بمسافات\nانتهى');await p.fill('#vb','سطر واحد بمسافات\nانتهى');
await p.click('#compare');
assert.ok((await p.locator('#stats').textContent()).includes('100%'),'whitespace-only change ignored by default');
assert.equal(await p.locator('#diff .vd-same').count(),2);
assert.ok(await p.locator('#numchg').isHidden(),'number panel hidden when no numeric change');
// export
const[d]=await Promise.all([p.waitForEvent('download'),p.click('#export')]);
const ex=JSON.parse(fs.readFileSync(await d.path()));
assert.equal(ex.format,'versions-diff-v1');
assert.equal(ex.stats.same,2);
assert.ok(ex.ops.length===2);
assert.deepEqual(external,[],'everything stayed local: '+external.join(','));
await p.screenshot({path:'test-output/versions-page-desktop.png',fullPage:true});
for(const width of [390,320]){await p.setViewportSize({width,height:1000});await p.waitForTimeout(300);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal scroll at '+width);await p.screenshot({path:`test-output/versions-page-${width}.png`,fullPage:true})}
assert.deepEqual(errors,[]);
console.log(JSON.stringify({pass:true,responsive:[1280,390,320]}))}finally{if(b)await b.close();server.kill()}})().catch(e=>{console.error(e);process.exitCode=1})
