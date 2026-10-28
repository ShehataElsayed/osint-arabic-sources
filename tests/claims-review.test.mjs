import test from 'node:test';
import assert from 'node:assert/strict';
import {missingEvidence} from '../site/journalist-media/claims-review-core.js';
test('bare assertion lists every missing anchor',()=>{
  const m=missingEvidence({signals:['تفضيل أو تعميم مطلق'],context:[]});
  assert.ok(m.some(x=>x.includes('لا مصدر منسوب')));
  assert.ok(m.some(x=>x.includes('لا اقتباس حرفي')));
  assert.ok(m.some(x=>x.includes('لا رقم ولا تاريخ')))});
test('attributed quoted numeric claim has no missing-source hints',()=>{
  const m=missingEvidence({signals:['نسبة قول إلى مصدر','اقتباس منقول','أرقام'],context:[]});
  assert.deepEqual(m,[])});
test('hedged and negated phrasing surface their own hints',()=>{
  const m=missingEvidence({signals:['نسبة قول إلى مصدر','أرقام'],context:['صيغة افتراضية أو احتمالية','صيغة نفي']});
  assert.ok(m.some(x=>x.includes('احتمالية')));assert.ok(m.some(x=>x.includes('نفي')));
  assert.ok(!m.some(x=>x.includes('لا مصدر منسوب')))});
test('invalid input rejected',()=>{assert.throws(()=>missingEvidence({signals:'x'}))});
