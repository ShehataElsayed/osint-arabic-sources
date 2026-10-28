import test from 'node:test';
import assert from 'node:assert/strict';
import {verificationQuestions} from '../site/journalist-media/image-review-core.js';
test('stripped metadata triggers original-request question',()=>{
  const q=verificationQuestions({fields:{},gps:null,warnings:['لا توجد بيانات EXIF في الملف (شائع بعد إعادة النشر).']});
  assert.ok(q.some(x=>x.includes('اطلب الأصل')))});
test('editing software and capture dates produce targeted questions',()=>{
  const q=verificationQuestions({fields:{software:'Adobe Photoshop',captured:'2026:01:01 10:00',modified:'2026:01:03 11:00',make:'Canon'},gps:null,warnings:[]});
  assert.ok(q.some(x=>x.includes('Adobe Photoshop')));assert.ok(q.some(x=>x.includes('يختلف عن تاريخ آخر تعديل')));assert.ok(q.some(x=>x.includes('Canon')))});
test('gps question keeps the not-proof caveat',()=>{
  const q=verificationQuestions({fields:{},gps:{lat:30.0,lon:31.2},warnings:[]});
  assert.ok(q.some(x=>x.includes('لا تثبت المكان')))});
test('bare result falls back to manual-review question',()=>{
  const q=verificationQuestions({fields:{},gps:null,warnings:[]});
  assert.equal(q.length,1);assert.ok(q[0].includes('يدويًا'))});
