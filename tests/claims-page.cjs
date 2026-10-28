const{chromium}=require('playwright'),{spawn}=require('child_process'),assert=require('assert/strict'),fs=require('fs');(async()=>{fs.mkdirSync('test-output',{recursive:true});const server=spawn('python3',['-m','http.server','8797','--bind','127.0.0.1','--directory',process.env.TEST_SITE||'site'],{stdio:'ignore'});let b;try{b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});const p=await b.newPage({viewport:{width:1280,height:1100}}),external=[],errors=[];p.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:8797'))external.push(r.url())});p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://127.0.0.1:8797/claims.html');
assert.ok((await p.title()).includes('رصد الادعاءات'));
assert.deepEqual(external,[],'no third-party on load: '+external.join(','));
const S_ATTR='قال المتحدث الرسمي إن التكلفة بلغت 55 مليون جنيه في 2026-03-02.';
const S_QUOTE='وكتب على صفحته: «لن نقبل هذا القرار مهما كلف الأمر».';
const S_SUPER='هذا أسرع مشروع في تاريخ المحافظة.';
const S_COND='إذا صح الرقم المعلن فإن التكلفة النهائية ستتجاوز 100 مليون.';
const S_NEG='لم يقدم المصدر أي دليل على الرقم الذي ذكره.';
const S_OPIN='أعتقد أن المشروع خطوة ممتازة للمحافظة.';
const S_IMPER='تحققوا من الرقم قبل نشر الخبر.';
const S_PLAIN='الجو كان مشمسًا ذلك اليوم.';
const src=[S_ATTR,S_QUOTE,S_SUPER,S_COND,S_NEG,S_OPIN,S_IMPER,S_PLAIN].join('\n');
await p.fill('#src',src);
await p.click('#detect');
assert.ok(!(await p.locator('#result').isHidden()));
const stats=await p.locator('#stats').textContent();
// candidates: attribution, quote(نسب قول via نقل? no — quote signal only), superlative, conditional, negation-with-number? S_NEG has no signals... it has "أي دليل" no digits; signals: none => not candidate
// expected candidates: S_ATTR, S_QUOTE, S_SUPER, S_COND = 4; opinion and imperative excluded; negation has no signal (plain); plain excluded
assert.equal(await p.locator('#claims .cl-card').count(),4,'only candidate claims shown by default');
const cards=await p.locator('#claims .cl-card').allTextContents();
assert.ok(cards[0].includes(S_ATTR),'verbatim sentence 1');
assert.ok(cards.some(c=>c.includes('نسبة قول إلى مصدر')&&c.includes('أرقام')&&c.includes('تاريخ أو زمن')),'attribution card carries its signals');
assert.ok(cards.some(c=>c.includes(S_COND)&&c.includes('صيغة افتراضية أو احتمالية')),'conditional flagged');
assert.ok(cards.some(c=>c.includes(S_SUPER)),'bare superlative (أسرع) flagged as candidate');
assert.ok(cards.some(c=>c.includes(S_QUOTE)&&c.includes('صيغة نفي')),'negated quote carries negation chip');
assert.ok(!cards.some(c=>c.includes(S_NEG)),'negation without real signals not a candidate (ذكره must not match ذكر)');
// imperative and opinion NOT among candidates
assert.ok(!cards.some(c=>c.includes(S_IMPER)),'imperative not a claim');
assert.ok(!cards.some(c=>c.includes(S_OPIN)),'opinion not a claim');
// show all -> 8 cards, opinion labeled, negation preserved verbatim, imperative labeled directive
await p.check('#show-plain');
assert.equal(await p.locator('#claims .cl-card').count(),8);
const all=await p.locator('#claims .cl-card').allTextContents();
assert.ok(all.some(c=>c.includes(S_NEG)),'negation sentence preserved verbatim');
assert.ok(all.some(c=>c.includes(S_OPIN)&&c.includes('رأي معلن')),'opinion labeled');
assert.ok(all.some(c=>c.includes(S_IMPER)&&c.includes('توجيه أو أمر')),'directive labeled');
await p.uncheck('#show-plain');
// export: verbatim sentences, reviewState unchecked
const[d]=await Promise.all([p.waitForEvent('download'),p.click('#export')]);
const ex=JSON.parse(fs.readFileSync(await d.path()));
assert.equal(ex.format,'claims-review-v1');
assert.equal(ex.items.length,4);
assert.ok(ex.items.every(it=>src.includes(it.sentence)),'every exported sentence is verbatim substring of source');
assert.ok(ex.items.every(it=>it.reviewState==='unchecked'));
assert.ok(ex.items.some(it=>it.context.includes('صيغة افتراضية أو احتمالية')));
assert.deepEqual(external,[],'everything stayed local: '+external.join(','));
await p.screenshot({path:'test-output/claims-page-desktop.png',fullPage:true});
for(const width of [390,320]){await p.setViewportSize({width,height:1000});await p.waitForTimeout(300);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal scroll at '+width);await p.screenshot({path:`test-output/claims-page-${width}.png`,fullPage:true})}
assert.deepEqual(errors,[]);
console.log(JSON.stringify({pass:true,candidates:4,sentences:8,responsive:[1280,390,320]}))}finally{if(b)await b.close();server.kill()}})().catch(e=>{console.error(e);process.exitCode=1})
