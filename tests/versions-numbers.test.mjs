import test from 'node:test';
import assert from 'node:assert/strict';
import {numberTokens,numberChanges} from '../site/journalist-media/versions-numbers-core.js';
test('extracts latin and arabic-indic numerals',()=>{
  assert.deepEqual(numberTokens('تكلفة 40 مليون و١٥٠ ألف'),['40','١٥٠'])});
test('mod pair surfaces removed/added numbers with both texts',()=>{
  const A=['وقال المتحدث إن التكلفة تبلغ 40 مليون جنيه.'];
  const B=['وقال المتحدث إن التكلفة تبلغ 55 مليون جنيه مصري.'];
  const r=numberChanges([{t:'mod',a:0,b:0}],A,B);
  assert.equal(r.changes.length,1);
  assert.deepEqual(r.changes[0].removed,['40']);assert.deepEqual(r.changes[0].added,['55']);
  assert.equal(r.changes[0].aLine,1);assert.equal(r.changes[0].bLine,1);
  assert.ok(r.changes[0].oldText.includes('40'));assert.ok(r.changes[0].newText.includes('55'))});
test('unchanged numbers in mod pair not surfaced',()=>{
  const A=['بلغ العدد 40 حالة مؤكدة'];const B=['بلغ العدد 40 حالة محتملة'];
  const r=numberChanges([{t:'mod',a:0,b:0}],A,B);
  assert.equal(r.changes.length,0)});
test('numbers in fully added/removed lines counted separately',()=>{
  const A=['سطر ١','انتهى البيان 2024'];const B=['سطر ١','زيادة 300 حالة'];
  const r=numberChanges([{t:'same',a:0,b:0},{t:'del',a:1},{t:'add',b:1}],A,B);
  assert.equal(r.changes.length,0);assert.equal(r.onlyRemoved,1);assert.equal(r.onlyAdded,1)});
test('multiset semantics: same number twice removed only as many times',()=>{
  const A=['الأرقام 7 و 7 و 8'];const B=['الأرقام 7 و 9'];
  const r=numberChanges([{t:'mod',a:0,b:0}],A,B);
  assert.deepEqual(r.changes[0].removed,['7','8']);assert.deepEqual(r.changes[0].added,['9'])});
