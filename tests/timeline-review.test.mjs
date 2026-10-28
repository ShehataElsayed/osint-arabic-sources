import test from 'node:test';
import assert from 'node:assert/strict';
import {findConflicts,findGaps} from '../site/journalist-media/timeline-review-core.js';
const E=(date,text,quote='')=>({date,text,quote});
test('same description with different dates flagged as conflict lead',()=>{
  const ev=[E('2026-01-05','أعلنت الوزارة إطلاق المشروع','اقتباس أ'),E('2026-01-07','أعلنت الوزارة إطلاق المشروع','اقتباس ب'),E('2026-02-01','حدث آخر مختلف تمامًا')];
  const c=findConflicts(ev);
  assert.equal(c.length,1);assert.deepEqual(c[0].dates,['2026-01-05','2026-01-07']);assert.equal(c[0].items.length,2)});
test('diacritics and alef variants normalized before matching',()=>{
  const ev=[E('2026-01-05','إطلاقُ المَشرُوع'),E('2026-01-09','اطلاق المشروع')];
  assert.equal(findConflicts(ev).length,1)});
test('same date or different text is not a conflict',()=>{
  assert.equal(findConflicts([E('2026-01-05','نفس النص'),E('2026-01-05','نفس النص')]).length,0);
  assert.equal(findConflicts([E('2026-01-05','نص أول طويل بما يكفي'),E('2026-01-06','نص ثان مختلف بما يكفي')]).length,0)});
test('large gap between consecutive events surfaced, small gaps not',()=>{
  const ev=[E('2026-01-01','أ'),E('2026-01-05','ب'),E('2026-04-10','ج')];
  const g=findGaps(ev);
  assert.equal(g.length,1);assert.equal(g[0].days,95);assert.equal(g[0].from,'2026-01-05');assert.equal(g[0].to,'2026-04-10')});
test('fewer than three dated events yields no gaps',()=>{
  assert.deepEqual(findGaps([E('2026-01-01','أ'),E('2026-06-01','ب')]),[])});
test('short texts under 8 normalized chars ignored',()=>{
  assert.equal(findConflicts([E('2026-01-05','قريب'),E('2026-01-06','قريب')]).length,0)});
