import test from 'node:test';
import assert from 'node:assert/strict';
import {flagSuspectTokens} from '../site/journalist-media/ocr-review-core.js';
test('mixed arabic-indic and ascii digits flagged (١١7 misread class)',()=>{
  const f=flagSuspectTokens('التكلفة ١١7 مليون');
  assert.equal(f.length,1);assert.equal(f[0].token,'١١7');assert.ok(f[0].reasons.includes('mixed-digits'))});
test('clean uniform numerals not flagged',()=>{
  assert.equal(flagSuspectTokens('١٢٣ 123 خمسة').length,0)});
test('digit glued to arabic word flagged',()=>{
  const f=flagSuspectTokens('في7الشارع');
  assert.equal(f.length,1);assert.ok(f[0].reasons.includes('digit-glued-to-word'))});
test('mixed arabic and latin letters flagged',()=>{
  const f=flagSuspectTokens('وزارةhealth');
  assert.equal(f.length,1);assert.ok(f[0].reasons.includes('mixed-letters'))});
test('empty and clean arabic text yields no flags',()=>{
  assert.deepEqual(flagSuspectTokens(''),[]);
  assert.equal(flagSuspectTokens('بيان صحفي صادر عن الوزارة اليوم').length,0)});
test('flag limit respected and indices preserved',()=>{
  const text=Array.from({length:120},(_,i)=>'ر'+i+'x'+i).join(' ');
  const f=flagSuspectTokens(text,{limit:5});
  assert.equal(f.length,5);
  const g=flagSuspectTokens('abc وs1');
  assert.equal(g[0].index,4)});
