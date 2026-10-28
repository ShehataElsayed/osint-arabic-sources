import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeArabic,MATERIALS,LOCAL_TOOLS,matchLocalTools,matchCatalogTools,buildPlan,planText} from '../site/journalist-media/planner-core.js';

test('normalizeArabic unifies alef/ta-marbuta/ya and strips diacritics',()=>{
 assert.equal(normalizeArabic('الأرشيف إشارة'),'الارشيف اشاره');
 assert.equal(normalizeArabic('صُورَة'),'صوره');
 assert.throws(()=>normalizeArabic(42))});

test('material-only match ranks the tool and cites the material as evidence',()=>{
 const r=matchLocalTools('',['images']);
 assert.ok(r.length>0);
 const img=r.find(x=>x.tool.id==='image');
 assert.ok(img,'image tool matched on images material');
 assert.deepEqual(img.evidence.materials,['صور']);
 assert.equal(img.evidence.signals.length,0)});

test('Arabic signal words in the description fire the right tools with quoted signals',()=>{
 const r=matchLocalTools('عندي مستند مصور وعاوز استخراج نص منه وأسماء الأشخاص اللي فيه',[]);
 const ids=r.map(x=>x.tool.id);
 assert.ok(ids.includes('ocr')&&ids.includes('entities'));
 const ocr=r.find(x=>x.tool.id==='ocr');
 assert.ok(ocr.evidence.signals.some(s=>s.includes('مستند')||s.includes('استخراج نص')))});

test('no signals and no materials yields empty scored list; buildPlan returns guidance not a plan',()=>{
 assert.equal(matchLocalTools('كلام عام بلا إشارات',[]).length,0);
 const p=buildPlan('كلام عام بلا إشارات',[],[]);
 assert.equal(p.empty,true);
 assert.ok(p.message.includes('اختر المواد'))});

test('plan orders selected tools by workflow stage not by score',()=>{
 const p=buildPlan('فيديو وصور ونطاق موقع مجهول',['video','images','domain'],[]);
 assert.equal(p.empty,false);
 const stages=p.steps.map(s=>s.order);
 assert.deepEqual(stages,[...stages].sort((a,b)=>a-b));
 const names=p.steps.map(s=>s.tool);
 assert.ok(names.indexOf('ملف النطاق والموقع')<names.indexOf('لقطات الفيديو'))});

test('plan carries steps, inputs, expected output, and stop conditions per tool',()=>{
 const p=buildPlan('', ['dataset'],[]);
 assert.equal(p.steps.length,1);
 const s=p.steps[0];
 assert.ok(s.steps.length>=3&&s.input&&s.expected&&s.stop);
 assert.ok(p.notes.some(n=>n.includes('الذكاء الاصطناعي')))});

test('catalog rules fire on declared materials and respect per-category and total caps',()=>{
 const catalog=[
  {cat:'Username',name:'U1',url:'https://a.example',input:'u',output:'o',bestFor:'b'},
  {cat:'Username',name:'U2',url:'https://b.example',input:'u',output:'o',bestFor:'b'},
  {cat:'Username',name:'U3',url:'https://c.example',input:'u',output:'o',bestFor:'b'},
  {cat:'Telephone Numbers',name:'P1',url:'https://d.example',input:'p',output:'o',bestFor:'b'}];
 const r=matchCatalogTools('', ['username','phone'], catalog);
 assert.equal(r.filter(e=>e.cat==='Username').length,2,'per-category cap');
 assert.ok(r.some(e=>e.name==='P1'));
 assert.throws(()=>matchCatalogTools('',[],null))});

test('input validation rejects oversized description and unknown materials',()=>{
 assert.throws(()=>matchLocalTools('x'.repeat(5001),[]));
 assert.throws(()=>matchLocalTools('', ['bogus']));
 assert.throws(()=>buildPlan('', new Array(12).fill('texts'),[]))});

test('planText renders evidence, stop conditions, external links, and disclaimer',()=>{
 const p=buildPlan('نطاق موقع مجهول ينشر صورًا',['domain','images','webpage'],[{cat:'Archives',name:'Wayback',url:'https://web.archive.org',input:'url',output:'captures'}]);
 const t=planText(p,'وصف تجريبي');
 assert.ok(t.includes('لماذا رُشحت')&&t.includes('شرط التوقف')&&t.includes('https://web.archive.org'));
 assert.ok(t.includes('ليس تحققًا منفذًا'));
 assert.equal(planText({empty:true,message:'رسالة'},''),'رسالة')});
