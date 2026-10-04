<div dir="rtl" align="right">

# بنية المستودع

| المسار | المحتوى |
|---|---|
| `site/` | مصدر الموقع: صفحات HTML وملفات JS وCSS وخط Cairo. `site/index.html` قالب تُحقن فيه البيانات عند البناء. |
| `2-data.json` | شجرة التصنيفات والمصادر في الخريطة الرئيسية. أصلها مشتق من OSINT Framework (انظر [licenses.md](licenses.md)). |
| `data/libs.json` | مكتبات التحليل وشروحاتها. |
| `data/aitools.json` | كتالوج أدوات الذكاء الاصطناعي. |
| `3-review-queue.json` | سجل انتظار لمراجعة الروابط. ليس شهادة بأنها تعمل. |
| `site/rag-factchecks.json` | فهرس مقتطفات تدقيق الحقائق (من claimreview-data، بعد استبعاد AFP). الحقول: ادعاء، تقييم، رابط، مقتطف قصير. |
| `worker/` | Cloudflare Worker: أوضاع `verify` و`recommend` و`compose` و`plan` والبحث الافتراضي. `wrangler.toml` إعداد النشر. |
| `scripts/build.py` | يبني `_site/` من `site/` ويحقن البيانات ويضيف الرخص. |
| `scripts/build_content.py` | يولّد صفحات التصنيفات. |
| `scripts/build_factcheck_index.py` | يبني فهرس تدقيق الحقائق ويطبق قائمة الحجب. |
| `tests/` | اختبارات البنية (بايثون) ومنطق RAG والـ Worker (Node) وفحص المتصفح. |
| `docs/` | الشروحات. |
| `.github/workflows/deploy.yml` | يبني ويختبر وينشر على GitHub Pages عند الدمج في `main`. |
| `*.zip` في الجذر | نسخ أرشيفية قديمة من مراحل المشروع. لا تدخل البناء. |

مجلدان غريبان في `site/` هما `site/site/Cairo.ttf` (يستعمله البناء لنسخ الخط) و`site/ite/index.htmls` (ملف قديم غير مستعمل). تركتهما كما هما لأن البناء يعتمد على الأول.

</div>
