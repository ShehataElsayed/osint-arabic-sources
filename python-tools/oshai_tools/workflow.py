"""Connected workflow: one text in, outputs of one tool feed the next. Returns a case file plus a manual verification checklist."""
from .core import REGISTRY, tool
@tool("case","ملف التحقيق المتسلسل","Case Pipeline","يمرر النص عبر سلسلة أدوات مترابطة: كيانات ← ادعاءات ← تحوط وتهويل ← فحص كل رابط ← مقارنة أرقام بالمصدر ← حجب البيانات، ثم يخرج قائمة تحقق.",
      [("text","النص المراد فحصه","textarea"),("source","نص المصدر الأصلي (اختياري)","textarea")], ai=True)
def case(text, source=""):
    from . import run
    steps = []; ent = run("entities", text=text); steps.append(("entities", ent))
    cl = run("claims", text=text); steps.append(("claims", cl))
    hd = run("hedging", text=text); tn = run("tone", text=text); steps += [("hedging", hd), ("tone", tn)]
    links = [dict(url=u, **run("urlcheck", url=u), archive=run("urlclean", url=u)["wayback_save"]) for u in ent["urls"]]; steps.append(("links", links))
    nd = None
    if source.strip():
        nd = [dict(claim=c["sentence"], **{k: v for k, v in run("numdiff", claim=c["sentence"], source=source).items() if k != "ok"}) for c in cl["claims"]]; steps.append(("numbers_vs_source", nd))
    rd = run("redact", text=text); steps.append(("redact", rd))
    todo = []
    for c in cl["claims"][:5]: todo.append("تحقق من: " + c["sentence"])
    if nd: todo += ["تعارض مع المصدر: " + x["claim"] for x in nd if x["verdict"] in ("تعارض محتمل", "غير مدعوم")]
    todo += ["افحص الرابط يدويًا: " + l["url"] for l in links if l["risk"] != "منخفض"]
    if tn["level"] != "منخفض": todo.append("لغة مهيجة: ابحث عن المصدر الأصلي قبل الاستشهاد")
    if rd["found"]: todo.append("يحوي بيانات شخصية: " + ", ".join(rd["found"]) + " (استخدم النسخة المحجوبة)")
    if not source.strip() and cl["claims"]: todo.append("لم يُقدَّم مصدر: لم تُقارن الأرقام بأي وثيقة")
    todo = [run("redact", text=x)["redacted"] for x in todo]
    return dict(ok=True, steps=dict(steps), checklist=todo, note="قائمة تحقق للمراجعة البشرية وليست حكمًا بالصدق أو الكذب.")
