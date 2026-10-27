"""Run: python evals/planner_input_eval.py [--dump out.json]. Records executed tools per case on the deployed path."""
import sys, os, json, re
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import oshai_tools as o
import oshai_tools
try:
    from oshai_tools import __init__ as _
except Exception: pass
A = [
 ({"redact"}, "أحجبها قبل ما أنشر المحضر لأن فيه أرقام تليفونات الشهود"),
 ({"redact"}, "عايز أخفي أسماء وأرقام الشهود من الوثيقة قبل ما أبعتها لزميل"),
 ({"redact"}, "لازم نحجب البيانات الشخصية في المستند قبل النشر"),
 ({"claims","evidence"}, "عندي ادعاءات كتير وعايز أربط كل ادعاء بدليله وأسجل المستندات"),
 ({"evidence","case"}, "أريد ربط كل ادعاء بالأدلة والمستندات التي تدعمه وتتبع ما راجعته"),
 ({"case"}, "ملف تحقيق فيه مستندات وشهادات وعايز أنظم الأدلة وأربطها ببعض"),
 ({"numdiff","quotecheck"}, "الوزير قال في المؤتمر إن العجز 5 مليار والبيان الرسمي مكتوب فيه رقم تاني"),
 ({"numdiff","quotecheck"}, "نسبوا لوزير الصحة تصريح عن 30 بالمئة وعايز أقارنه بنص البيان"),
 ({"tone","claims"}, "العنوان مهول ومبالغ فيه وعايز أعرف الجمل اللي فيها ادعاءات"),
 ({"entities","timeline"}, "استخرجلي الأسماء والتواريخ من المحضر ورتبها"),
]
B = [
 ({"redact"}, "هنشر وثيقة فيها أرقام موبايلات وإيميلات وعايز أحجبها"),
 ({"redact"}, "أخفي بيانات الشهود من الملف قبل المشاركة"),
 ({"case","evidence"}, "جمعت صور ومستندات وروابط وعايز أرتبها كأدلة ببصمة لكل ملف"),
 ({"numdiff","quotecheck"}, "المتحدث قال إن الإنفاق زاد 12 بالمئة والتقرير بيقول غير كده"),
 ({"urlcheck","urlclean"}, "وصلني لينك https://news-eg.example.com/a?utm_source=x وعايز أنضفه وأفحصه"),
 ({"exif"}, "صورة وصلتني من واتساب وعايز أعرف بياناتها"),
 ({"headers"}, "إيميل مشبوه وعايز أحلل الترويسة"),
 ({"claims"}, "حدد لي الجمل القابلة للتحقق في خطاب الوزير"),
 ({"olevba"}, "ملف إكسل جاي من مصدر مجهول وخايف يكون فيه ماكرو"),
 ({"entities","timeline"}, "ملف المحكمة فيه أسماء كتير وتواريخ وعايز ترتيب زمني"),
 ({"profile"}, "جدول بيانات مستشفيات فيه قيم غريبة ومكررة"),
 ({"dnstwist"}, "موقع بيقلد اسم جريدتنا example.com وعايز أشوف الأسماء المشابهة"),
]
N = [
 "إزاي أعمل كشري", "نتيجة مباراة الأهلي امبارح", "عاصمة فرنسا إيه", "اكتبلي قصيدة عن النيل",
 "zzqx vvkj", "ما هو أفضل هاتف", "حجز طيران للقاهرة", "السلام عليكم",
]
def ex(case):
    r = o.run("planner", case=case)
    if not r.get("ok"): return None, set(), set()
    pl = r["_plan"]
    tools = set()
    for s in pl["steps"]:
        m = re.search(r"#(\w+)$", s["link"]); tools.add(m.group(1))
    rule = {t["t"] for t in pl["types"] if t["p"] is None}
    return pl, tools, rule
def main():
    from oshai_tools import t_planner as P
    out = {}
    for name, S in (("A", A), ("B", B)):
        hit = 0
        for g, c in S:
            _, t, _r = ex(c); ok = g <= t; hit += ok; out[name + ":" + c] = sorted(t)
            print(name, "OK  " if ok else "MISS", sorted(g), "->", sorted(t), c[:40])
        print(name, "coverage %d/%d" % (hit, len(S)))
    rules = 0
    for c in N:
        _, t, r = ex(c); rules += len(r); out["N:" + c] = sorted(t); print("N", sorted(r), c)
    print("N rule-added total", rules)
    import importlib.util
    for f, nm in (("planner_realistic.py", "R1"), ("planner_fresh.py", "R2")):
        pass
    src = open(os.path.join(os.path.dirname(__file__), "planner_realistic.py")).read() + "\n" + open(os.path.join(os.path.dirname(__file__), "planner_fresh.py")).read()
    cases = re.findall(r'^ \("\w+", "(.*)"\),$', src, re.M)
    for c in cases:
        _, t, r = ex(c); out["R:" + c] = sorted(t); out["Rrule:" + c] = sorted(r)
    print("R cases", len(cases))
    if "--dump" in sys.argv: json.dump(out, open(sys.argv[sys.argv.index("--dump") + 1], "w"), ensure_ascii=False, indent=1)
if __name__ == "__main__": main()
