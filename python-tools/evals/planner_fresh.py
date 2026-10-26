"""Fresh cases written after the last retrain, by the same author as the training data (NOT independent). Expected types are the author's own labels. Diagnostic only."""
import sys, os; sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from oshai_tools import planner_model as M, t_planner as P
CASES = [
 ("domain", "وصلتني رسالة فيها رابط https://bank-eg.example.com/login يدعي أنه موقع البنك"),
 ("headers", "عندي إيميل مريب من جهة تدعي أنها شركة شحن وأريد فحص الترويسة ومن أرسله فعلا"),
 ("image", "صورة لحريق في مصنع تنتشر على تويتر ويقال إنها من اليوم وأظنها قديمة"),
 ("quote", "قناة نسبت إلى رئيس الحكومة عبارة لم أجدها في نص كلمته الرسمية"),
 ("numbers", "الوزارة تقول إن البطالة 6.5 بالمئة والجدول المنشور يعطي رقما مختلفا"),
 ("document", "استلمت ملف وورد من مصدر مجهول فيه تقرير داخلي وأخاف أن يكون فيه ماكرو"),
 ("redact", "سأنشر وثائق فيها أرقام هواتف وأسماء شهود وأريد حجبها قبل النشر"),
 ("entities", "عندي مقال طويل أريد استخراج الأشخاص والمؤسسات والتواريخ فيه وترتيب الأحداث"),
 ("data", "جدول csv لمشتريات حكومية فيه قيم شاذة ومكررة وأريد فهمه قبل التحليل"),
 ("case", "أعمل على تحقيق من عدة أسابيع ومعي ملفات كثيرة وأريد تنظيم الأدلة وتتبعها"),
 ("tone", "عنوان يقول كارثة غير مسبوقة تهز البلاد دون أي مصدر وأريد تقييم لغته"),
 ("link", "منشور يحيل إلى مقال على موقع إخباري وأخاف أن يحذفه الناشر فأريد أرشفته"),
]
ok1 = 0
for exp, t in CASES:
    p, _ = P.scores(M.MODEL, t); top = sorted(p, key=p.get, reverse=True)[:3]
    ok1 += top[0] == exp
    print("OK  " if top[0] == exp else "MISS", exp, "->", [(c, round(p[c], 2)) for c in top], "in top3" if exp in top else "NOT in top3")
print("top1 %d/%d" % (ok1, len(CASES)))
