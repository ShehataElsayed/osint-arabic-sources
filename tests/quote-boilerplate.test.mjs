import test from 'node:test';
import assert from 'node:assert/strict';
import { supportOf, looksLikeBoilerplate } from '../worker/rag-lib.js';

// Boilerplate rejection (live UI finding 2026-10-30): relative timestamps and preference prompts
// are verbatim page text but not claim-bearing - they must not surface as supporting quotes.

test('relative timestamp fragments are boilerplate, real claim sentences are not', () => {
  assert.equal(looksLikeBoilerplate('Published قبل 2 ساعة'), true);
  assert.equal(looksLikeBoilerplate('l قبل 4 ساعات'), true);
  assert.equal(looksLikeBoilerplate('Updated 3 hours ago'), true);
  assert.equal(looksLikeBoilerplate('to register the site as a preferred source — kept per explicit request.'), true);
  assert.equal(looksLikeBoilerplate('اشترك في النشرة البريدية'), true);
  assert.equal(looksLikeBoilerplate('التوقيت الشتوي بدأ رسميًا في مصر.'), false);
  assert.equal(looksLikeBoilerplate('بدء تطبيق التوقيت الشتوي في مصر.'), false);
  // A long claim-bearing sentence that mentions a relative time stays eligible.
  assert.equal(looksLikeBoilerplate('أعلنت الحكومة المصرية قبل 4 ساعات رسميًا عن بدء العمل بالتوقيت الشتوي في البلاد مع تأخير الساعة 60 دقيقة عند منتصف الليل'), false);
});

test('supportOf never picks boilerplate as the quote even when it scores highest', () => {
  const sents = ['Published قبل 2 ساعة', 'أعلنت الحكومة المصرية عن بدء العمل بالتوقيت الشتوي وتأخير الساعة 60 دقيقة عند منتصف الليل'];
  const r = supportOf('التوقيت الشتوي تأخير الساعة', sents, []);
  assert.ok(!looksLikeBoilerplate(r.quote || ''), `boilerplate surfaced as quote: ${r.quote}`);
});

test('a page with only boilerplate matches yields no supporting quote (card moves to checked-not-supporting)', () => {
  const r = supportOf('عبارة لا علاقة لها بالمحتوى إطلاقا', ['Published قبل 2 ساعة', 'اشترك في النشرة'], []);
  assert.equal(r.quote, '');
  assert.equal(r.verified, false);
});
