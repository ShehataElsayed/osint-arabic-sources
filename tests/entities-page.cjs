const{chromium}=require('playwright'),{spawn}=require('child_process'),assert=require('assert/strict'),fs=require('fs');(async()=>{fs.mkdirSync('test-output',{recursive:true});const server=spawn('python3',['-m','http.server','8799','--bind','127.0.0.1','--directory',process.env.TEST_SITE||'site'],{stdio:'ignore'});let b;try{b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});const p=await b.newPage({viewport:{width:1280,height:1100}}),external=[],errors=[];p.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:8799'))external.push(r.url())});p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://127.0.0.1:8799/entities.html');
assert.ok((await p.title()).includes('رصد الكيانات'));
assert.deepEqual(external,[],'no third-party on load: '+external.join(','));
const doc1=['التقى أحمد سالم بوزير النقل في مقر الوزارة.','وقال أحمد سالم إن المشروع سيبدأ قريبًا.','حضر الاجتماع كريم فؤاد ممثلًا عن الشركة.','وفي الاجتماع ناقش كريم فؤاد مع أحمد سالم تفاصيل العقد.','وقال المهندس أحمد سالم في البيان إن المشروع يسير وفق الخطة.'].join('\n');
const doc2=['نفى أحمد سالم في تصريح صحفي أي علاقة له بالقضية.','وأكد كريم فؤاد أن العقد لم يوقع بعد.','وفي مقطع آخر ظهر كريم فؤاد إلى جانب أحمد سالم.','وصرح المهندس أحمد سالم لاحقًا بأن التعاقد قانوني.','عقد الاجتماع المغلق صباحًا وانتهى الاجتماع المغلق ظهرًا.'].join('\n');
const src=doc1+'\n===\n'+doc2;
await p.fill('#src',src);
await p.click('#extract');
assert.ok(!(await p.locator('#result').isHidden()));
const items=await p.locator('#list .en-item').allTextContents();
assert.ok(items.some(t=>t.includes('أحمد سالم')),'أحمد سالم candidate');
assert.ok(items.some(t=>t.includes('كريم فؤاد')),'كريم فؤاد candidate');
assert.ok(items.some(t=>t.includes('المهندس أحمد سالم')),'المهندس أحمد سالم separate candidate');
assert.ok(items.some(t=>t.includes('الاجتماع المغلق')),'false-positive recurring phrase surfaced for review');
// list -> source spans
await p.locator('#list .en-item').filter({has:p.getByText(/^أحمد سالم$/)}).click();
assert.ok((await p.locator('#detail h3').textContent()).includes('أحمد سالم'));
const blocks=await p.locator('#detail blockquote').count();
assert.ok(blocks>=5,'per-mention source spans listed: '+blocks);
assert.ok((await p.locator('#detail .en-mention').first().textContent()).includes('إزاحة'),'char offset preserved');
assert.ok((await p.locator('#detail').textContent()).includes('وثيقة 2'),'per-document attribution');
assert.ok((await p.locator('#detail').textContent()).includes('هوية غير محسومة'),'identity unresolved by default');
// ambiguity toggle
await p.click('#ambiguity');
assert.ok((await p.locator('#detail').textContent()).includes('قد تعود الصيغة لكيانات مختلفة'),'ambiguity marked');
// merge two spellings
await p.selectOption('#merge-target',{label:'المهندس أحمد سالم'});
await p.click('#merge');
assert.ok((await p.locator('#detail').textContent()).includes('مدمج يدويًا'),'merge recorded in UI');
// graph interaction: node click
const nodeCount=await p.locator('#graph .en-node').count();
assert.ok(nodeCount>=3,'graph nodes: '+nodeCount);
await p.locator('#graph .en-node').filter({hasText:'كريم فؤاد'}).click();
assert.ok((await p.locator('#detail h3').textContent()).includes('كريم فؤاد'),'graph node opens detail');
// edge click -> shared sentences
await p.locator('#graph .en-edge').first().click();
assert.ok(!(await p.locator('#edge-detail').isHidden()),'edge detail opens');
assert.ok((await p.locator('#edge-detail').textContent()).includes('قرينة بحث لا علاقة'),'co-occurrence framed as lead not relationship');
assert.ok((await p.locator('#edge-detail blockquote').count())>=2,'shared sentences listed');
// dismiss false positive
await p.locator('#list .en-item').filter({hasText:'الاجتماع المغلق'}).click();
await p.click('#dismiss');
assert.ok(!(await p.locator('#list').textContent()).match(/الاجتماع المغلق.*ورود/),'dismissed phrase removed from active list');
assert.ok((await p.locator('#list').textContent()).includes('مستبعد'),'dismissal recorded');
// export
const[d]=await Promise.all([p.waitForEvent('download'),p.click('#export')]);
const ex=JSON.parse(fs.readFileSync(await d.path()));
assert.equal(ex.format,'entities-review-v1');
const ah=ex.entities.find(e=>e.surface==='أحمد سالم');
assert.equal(ah.identity,'unresolved-ambiguous','ambiguity exported');
assert.ok(ah.mentions.every(m=>src.includes(m.quote)),'verbatim sentence quotes preserved');
assert.ok(ah.mentions.every(m=>typeof m.offset==='number'&&m.offset>=0),'offsets exported');
assert.ok(ah.mentions.some(m=>m.doc===2),'per-doc mention spans exported');
assert.ok(ex.clusters.some(c=>c.members.includes('أحمد سالم')&&c.members.includes('المهندس أحمد سالم')),'merge cluster exported');
assert.ok(ex.decisions.some(d2=>d2.action==='merge'&&d2.by==='user'),'user decision recorded');
assert.equal(ex.entities.find(e=>e.surface==='الاجتماع المغلق').status,'dismissed','dismissal exported');
assert.ok(ex.cooccurrence.some(c=>(c.a==='أحمد سالم'&&c.b==='كريم فؤاد')||(c.b==='أحمد سالم'&&c.a==='كريم فؤاد')),'co-occurrence exported');
assert.deepEqual(external,[],'everything stayed local: '+external.join(','));
await p.screenshot({path:'test-output/entities-page-desktop.png',fullPage:true});
for(const width of [390,320]){await p.setViewportSize({width,height:1000});await p.waitForTimeout(300);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal scroll at '+width);await p.screenshot({path:`test-output/entities-page-${width}.png`,fullPage:true})}
assert.deepEqual(errors,[]);
console.log(JSON.stringify({pass:true,nodes:nodeCount,mentions:blocks,responsive:[1280,390,320]}))}finally{if(b)await b.close();server.kill()}})().catch(e=>{console.error(e);process.exitCode=1})
