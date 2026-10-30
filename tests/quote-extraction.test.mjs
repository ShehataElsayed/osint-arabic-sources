import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSource, supportOf, looksLikeCode, pagePublishedAt } from '../worker/rag-lib.js';

// Reproduces the observed arabic.cnn.com leak: an inline consent script opens before the
// old 400k slice point but closes after it, so slice-then-strip left raw JS in the text
// and `throw new Error("Field name must be in the format...")` surfaced as a quote.
function bigPage(scriptPad) {
  const arabic = 'بدأ تطبيق التوقيت الشتوي في مصر مع تأخير الساعة ستين دقيقة اعتبارا من منتصف ليل الجمعة وفق ما أعلنته الجهات الرسمية.';
  const scriptBody = 'var x=1;'.repeat(Math.ceil(scriptPad / 8)) + 'throw new Error("Field name must be in the format <section>.<fieldName>");';
  const filler = '<p>مقدمة قصيرة عن الخبر.</p>' + ' '.repeat(250000);
  return `<html><head><title>خبر تجريبي</title><meta property="article:published_time" content="2026-10-30T06:00:00+02:00"></head><body>${filler}<script type="text/javascript">${scriptBody}</script><article><p>${arabic}</p></article></body></html>`;
}

const fetchOf = html => async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });

test('script spanning the 400k cut never leaks JS into candidates or quotes', async () => {
  // script opens ~250k in, body ~600k => closes well past the 400k slice
  const html = bigPage(600000);
  const claim = 'التوقيت الشتوي في مصر تأخير الساعة ستين دقيقة';
  const out = await checkSource({ name: 'مصدر تجريبي', url: 'https://example.com/article/1' }, claim, [], fetchOf(html), {});
  assert.equal(out.exists, true);
  assert.ok(!out.cands.some(c => c.includes('Field name') || c.includes('throw new Error')), 'cands must not contain JS');
  assert.ok(!out.quote.includes('Field name') && !out.quote.includes('throw'), 'quote must not be JS');
  assert.ok(out.quote.includes('التوقيت الشتوي'), 'quote should be the matching Arabic sentence, got: ' + out.quote.slice(0, 120));
});

test('unclosed trailing script block is dropped', () => {
  const sents = ['جملة عربية عادية عن الخبر.', 'function a(){return 1;} var b = {}; // tail'];
  const sup = supportOf('جملة عربية عن الخبر', sents, []);
  assert.ok(!sup.quote.includes('function'));
});

test('looksLikeCode flags code, passes Arabic prose', () => {
  assert.equal(looksLikeCode('if(a){b();} var c = {}; function d(){return e;}'), true);
  assert.equal(looksLikeCode('throw new Error("Field name must be in the format <section>.<fieldName>"); let e=this.parameter.split(".");'), true);
  assert.equal(looksLikeCode('أعلنت الحكومة المصرية بدء تطبيق التوقيت الشتوي وتأخير الساعة ستين دقيقة.'), false);
  assert.equal(looksLikeCode(''), false);
});

test('pagePublishedAt reads meta, JSON-LD and time; never guesses', () => {
  assert.equal(pagePublishedAt('<meta property="article:published_time" content="2026-10-30T06:00:00+02:00">'), '2026-10-30');
  assert.equal(pagePublishedAt('<meta content="2026-10-29" name="datePublished">'), '2026-10-29');
  assert.equal(pagePublishedAt('{"@context":"https://schema.org","datePublished":"2026-10-28T09:15:00Z"}'), '2026-10-28');
  assert.equal(pagePublishedAt('<time datetime="2026-10-27">الثلاثاء</time>'), '2026-10-27');
  assert.equal(pagePublishedAt('<html><body>لا تاريخ هنا</body></html>'), '');
  assert.equal(pagePublishedAt('<meta property="article:published_time" content="not a date">'), '');
});

test('checkSource exposes published_at from the fetched page', async () => {
  const out = await checkSource({ name: 'x', url: 'https://example.com/a' }, 'أي ادعاء بسيط عن خبر', [], fetchOf(bigPage(1000)), {});
  assert.equal(out.published_at, '2026-10-30');
});
