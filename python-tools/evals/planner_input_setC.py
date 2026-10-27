"""Set C counterexamples, frozen before running. Same author as everything else: diagnostic only."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from planner_input_eval import ex, o
import re
C1 = [
 ({"exif"}, "صورة الحريق دي قديمة؟"),
 ({"urlclean"}, "رابط مشبوه https://t.co/abc?utm_source=fb"),
 ({"headers"}, "ترويسة إيميل"),
 ({"numdiff"}, "البطالة 7% ولا 9%؟"),
 ({"quotecheck"}, "الوزير قال إن الأزمة انتهت وعايز أتأكد من نص بيانه"),
 ({"redact"}, "احجب أرقام الهواتف من الملف"),
 ({"olevba"}, "ملف وورد فيه ماكرو"),
 ({"entities"}, "استخرج الأسماء من المقال"),
]
C2 = [
 "قال لي صديقي إن مطعم الكشري الجديد ممتاز وعنده تصريح رسمي بالتشغيل",
 "أريد ربط الكمبيوتر بالشاشة وأدلة تركيب الكاميرا في البيت",
 "ملف الموسيقى اللي نزلته مش بيشتغل على الموبايل",
 "الرابط بين الحرارة والرطوبة في الصيف وإزاي أحجب الشمس عن الشباك",
 "إيميل أصدقائي القدامى ضاع مني وعايز أرجعه",
 "الصورة اللي علقتها على الحيطة وقعت ومعاها الإطار",
 "الفريق قال إنه هيلعب بنص تشكيلة بعد خسارة 3 مباريات",
 "أرقام التليفونات القديمة في دفتر جدتي عايز أحتفظ بيها",
]
if __name__ == "__main__":
    h = 0
    for g, c in C1:
        pl, t, r = ex(c); ok = pl is not None and g <= t; h += ok
        print("C1", "OK  " if ok else "FAIL", sorted(g), "->", "REFUSED" if pl is None else sorted(t), c)
    print("C1 %d/%d" % (h, len(C1)))
    ref = 0
    for c in C2:
        pl, t, r = ex(c); ref += pl is None
        print("C2", "refused" if pl is None else "STEPS " + str(sorted(t)) + " rule=" + str(sorted(r)), "|", c)
    print("C2 refused %d/%d" % (ref, len(C2)))
