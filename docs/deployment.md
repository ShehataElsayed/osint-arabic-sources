<div dir="rtl" align="right">

# النشر

## الموقع (GitHub Pages)

يعمل `.github/workflows/deploy.yml` عند أي دفع إلى `main` يمس `site/` أو `data/` أو `scripts/` أو `tests/` أو ملفات الحزم أو `2-data.json` أو `3-review-queue.json`. يثبّت Node 22 وPython 3.12، ويشغّل `npm run build` ثم `npm test`، ثم ينشر `_site`. الفرع `main` محمي، فالتغيير يمر بطلب دمج.

## الـ Worker (Cloudflare، الخطة المجانية)

الشيفرة في `worker/rag-worker.js`. لا ينشره سير العمل أعلاه؛ يُنشر يدويًا (لوحة Cloudflare أو `wrangler deploy` من `worker/`). بعد أي تعديل على الملف انشره وتأكد أن النسخة المنشورة تطابق ما في المستودع.

الأسرار تُضبط في Cloudflare ولا تُكتب في المستودع أبدًا:

| الاسم | الاستعمال |
|---|---|
| `GEMINI_API_KEY`، `GEMINI_MODEL` | خدمة النموذج الخارجية للأوضاع `verify` و`recommend` و`compose` و`plan` |
| `EXA_API_KEY` | بحث الويب: إصلاح الروابط، ومصادر الادعاء، وروابط البحث الذكي. اختياري؛ بدونه تُتخطى هذه الخطوات بصمت |
| `FACTCHECK_API_KEY` | Google Fact Check Tools. اختياري؛ بدونه يتعطل البحث الافتراضي |

عنوان الـ Worker مكتوب في `site/rag-config.js`. الأصل المسموح الوحيد هو موقع GitHub Pages.

## حدود الخطة المجانية

- 50 طلبًا فرعيًا (subrequests) للطلب الواحد. وضع `verify` يستهلك نحو 13 وحتى نحو 30 مع الإصلاح والبحث.
- حصة النموذج المجانية تنفد؛ تظهر الصفحة "الخدمة مشغولة".
- ذاكرة التخزين المؤقت للبحث تعيش مع نسخة الـ Worker فقط.

## اختبار قبل الدمج

```sh
npm ci && npm run build && npm test && npm run check:js
```

</div>
