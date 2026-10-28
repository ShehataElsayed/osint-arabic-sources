import test from 'node:test';
import assert from 'node:assert/strict';
import {claimChanges} from '../site/journalist-media/versions-claims-core.js';
test('changed attribution word flagged with both texts',()=>{
  const A=['قال المتحدث إن العمل بدأ'];const B=['نفى المتحدث أن العمل بدأ'];
  const r=claimChanges([{t:'mod',a:0,b:0}],A,B);
  assert.equal(r.length,1);assert.ok(r[0].changedSensitive.includes('قال'));assert.ok(r[0].changedSensitive.includes('نفي'));
  assert.equal(r[0].aLine,1);assert.ok(r[0].oldText.includes('قال'))});
test('negation added to a claim is flagged',()=>{
  const A=['اكدت الوزارة سلامة الموقف'];const B=['اكدت الوزارة ان الموقف لم يتغير'];
  const r=claimChanges([{t:'mod',a:0,b:0}],A,B);
  assert.equal(r.length,1);assert.ok(r[0].changedSensitive.includes('لم'))});
test('unchanged sensitive words not flagged; ordinary word changes ignored',()=>{
  assert.equal(claimChanges([{t:'mod',a:0,b:0}],['قال الرجل كلاما طويلا'],['قال الرجل كلاما قصيرا']).length,0);
  assert.equal(claimChanges([{t:'mod',a:0,b:0}],['بلغ العدد ٤٠ حالة'],['بلغ العدد ٥٥ حالة']).length,0)});
test('non-mod ops ignored and diacritics/alef normalized',()=>{
  assert.deepEqual(claimChanges([{t:'add',b:0}],[],['قال خبر']),[]);
  const r=claimChanges([{t:'mod',a:0,b:0}],['إنكر الخبر'],['أكد الخبر']);
  assert.equal(r.length,1);assert.ok(r[0].changedSensitive.includes('اكد'))});
