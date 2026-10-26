"""External catalog tools linked from the planner. Name, URL and description copied from the published directory (search-tools.json); picked by hand, a few per type. On 2026-10-27 the home page of each listed tool was fetched and its stated purpose read (Fact Check Explorer, Yandex Images, InVID plugin page, Wayback, archive.today, urlscan.io, Domain Dossier, crt.sh). NOT promoted because not verified: TinEye (page returned no content to our fetch; cause unknown), MxToolbox for headers (its home page is an MX lookup; a header analyzer was not checked), Link Expander (DNS failure), DomainTools Whois (TLS failure). Verified means the page loads and states that purpose; not that results are good or the service stays up. They open third-party sites; nothing is sent to them by us."""
CATALOG = {
"quote": [
{
"name": "Google Fact Check Explorer",
"url": "https://toolbox.google.com/factcheck/explorer",
"description": "أداة جوجل للبحث في تحقيقات مؤسسات تدقيق الحقائق الموثقة (ترميز ClaimReview). تحقق في 2026-10-25: الواجهة العربية تعمل وتعرض تحقيقات عربية حديثة من مدققين عرب. مجانية بالكامل ولا تتطلب تسجيلًا. ابدأ بها قبل إعادة نشر أي ادعاء متداول، وتذكّر أن غياب التحقق لا يعني صحة الادعاء."
}
],
"tone": [
{
"name": "Google Fact Check Explorer",
"url": "https://toolbox.google.com/factcheck/explorer",
"description": "أداة جوجل للبحث في تحقيقات مؤسسات تدقيق الحقائق الموثقة (ترميز ClaimReview). تحقق في 2026-10-25: الواجهة العربية تعمل وتعرض تحقيقات عربية حديثة من مدققين عرب. مجانية بالكامل ولا تتطلب تسجيلًا. ابدأ بها قبل إعادة نشر أي ادعاء متداول، وتذكّر أن غياب التحقق لا يعني صحة الادعاء."
}
],
"numbers": [
{
"name": "Google Fact Check Explorer",
"url": "https://toolbox.google.com/factcheck/explorer",
"description": "أداة جوجل للبحث في تحقيقات مؤسسات تدقيق الحقائق الموثقة (ترميز ClaimReview). تحقق في 2026-10-25: الواجهة العربية تعمل وتعرض تحقيقات عربية حديثة من مدققين عرب. مجانية بالكامل ولا تتطلب تسجيلًا. ابدأ بها قبل إعادة نشر أي ادعاء متداول، وتذكّر أن غياب التحقق لا يعني صحة الادعاء."
}
],
"image": [
{
"name": "Yandex Images",
"url": "https://yandex.com/images/",
"description": "البحث عن صور مشابهة أو نسخ منشورة باستخدام صورة أو كلمات قارن النتائج بتاريخ النشر والنسخة الأصلية والسياق؛ التشابه البصري أو تكرار الصورة لا يثبت زمن الالتقاط أو هوية الأشخاص. في التحقيق، سجّل رابط المادة وتاريخ الاطلاع عليها، ثم قارنها بنسخة مستقلة قبل الاستشهاد بها في المادة الصحفية."
},
{
"name": "InVID-WeVerify Verification Plugin",
"url": "https://www.invid-project.eu/tools-and-services/invid-verification-plugin/",
"description": "إضافة متصفح موجهة للصحفيين من مشروع InVID-WeVerify للتحقق من الوسائط: بحث عكسي عن الصور وفحص بيانات وصفية وتحليل إطارات الفيديو. تعمل على صفحات ومنشورات اجتماعية مباشرة. تنبيه: استعلامات الإضافة تمر عبر منصات ومحركات خارجية فينشأ أثر رقمي لبحثك، ونتائجها أدوات مساعدة لا أحكام نهائية؛ التحقق الصحفي ي"
}
],
"link": [
{
"name": "Internet Archive: Wayback Machine",
"url": "https://web.archive.org/",
"description": "استعراض نسخ تاريخية محفوظة لصفحات الويب بحسب الرابط والتاريخ الأرشيف يوثق نسخة محفوظة لا كل ما نشره الموقع؛ دوّن تاريخ الالتقاط وافحص الروابط والصور الناقصة. احفظ رابط النسخة المؤرشفة وتاريخ الالتقاط، وميّز دائماً بين تاريخ الصفحة وتاريخ إضافتها إلى الأرشيف."
},
{
"name": "archive.today",
"url": "https://archive.today/",
"description": "أرشفة فورية للصفحات: يحفظ لقطة ثابتة (HTML مع صورة شاشة) ويبقيها قابلة للبحث، وكثيرًا ما يلتقط صفحات تحجب أدوات الأرشفة الأخرى. الصفحة الرئيسية تتيح الأرشفة والبحث مباشرة دون تسجيل. احفظ رابط اللقطة وتاريخها في ملف قضيتك. تحقق في 2026-10-25."
},
{
"name": "urlscan.io",
"url": "https://urlscan.io/search/#*",
"description": "يسجل urlscan.io ما تحمله صفحة عند فتح رابط، ومنها طلبات الشبكة ولقطات العرض، لفحص الروابط المشبوهة. قد تكون السجلات ناقصة أو محجوبة أو تغيرت بعد فهرستها؛ تحقق من المصدر الأصلي والتواريخ قبل ربط النطاق بجهة أو شخص."
}
],
"domain": [
{
"name": "Domain Dossier",
"url": "https://centralops.net/co/DomainDossier.aspx",
"description": "يجمع Domain Dossier بيانات WHOIS وسجلات DNS ومعلومات الشبكة عند إدخال نطاق أو عنوان IP، فيتيح نقطة بدء لفحص البنية المرتبطة بموقع. قد تكون السجلات ناقصة أو محجوبة أو تغيرت بعد فهرستها؛ تحقق من المصدر الأصلي والتواريخ قبل ربط النطاق بجهة أو شخص."
},
{
"name": "crt.sh - Certificate Search",
"url": "https://crt.sh/?",
"description": "يبحث crt.sh في سجلات شفافية الشهادات عن شهادات لنطاق، وقد يظهر أسماء بديلة للنطاقات داخله. قد تكون السجلات ناقصة أو محجوبة أو تغيرت بعد فهرستها؛ تحقق من المصدر الأصلي والتواريخ قبل ربط النطاق بجهة أو شخص."
}
],
"headers": [],
"document": []
}
