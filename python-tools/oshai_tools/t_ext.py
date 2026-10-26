"""Thin wrappers around two independent open-source libraries (not our own AI): dnstwist (Apache-2.0) and oletools/olevba (BSD-2). Static and offline: nothing is resolved, executed or sent."""
import json, os
from .core import tool
_MAX = 20_000_000
@tool("dnstwist", "مولّد نطاقات التشابه (dnstwist)", "Look-alike Domain Permutations",
      "يولّد صيغًا مشابهة لاسم نطاق (حروف مبدّلة أو ناقصة أو متشابهة الشكل) لمراجعة محاكاة محتملة. يولّد قوائم فقط: لا يفحص DNS ولا يتحقق من تسجيل أي نطاق. مكتبة dnstwist بترخيص Apache-2.0.",
      [("domain", "النطاق (مثال: example.org)", "text")])
def dnstwist_tool(domain):
    try: import dnstwist
    except ImportError: return {"ok": False, "error": "مكتبة dnstwist غير مثبتة"}
    d = domain.strip().lower()
    if not d or len(d) > 253 or " " in d or d.startswith("-") or "." not in d: return {"ok": False, "error": "اكتب نطاقًا صالحًا مثل example.org"}
    f = dnstwist.Fuzzer(d); f.generate(); rows = f.permutations()
    return {"ok": True, "total": len(rows), "domains": [r["domain"] for r in rows[:300]], "note": "قوائم توليد فقط: وجود صيغة هنا لا يعني أنها مسجلة أو خبيثة، ولم يُجرَ أي فحص DNS."}
@tool("olevba", "فاحص ماكرو ملفات أوفيس (olevba)", "Office Macro Static Inspector",
      "يفحص ملف Office محليًا بحثًا عن وحدات ماكرو VBA وكلمات مفتاحية مثيرة للريبة دون تشغيل أي شيء. عدم العثور على ماكرو لا يثبت سلامة الملف. مكتبة oletools بترخيص BSD.",
      [("path", "ملف Office (doc/xls/ppt/docm...)", "file")])
def olevba_tool(path):
    try: from oletools import olevba
    except ImportError: return {"ok": False, "error": "مكتبة oletools غير مثبتة"}
    if os.path.getsize(path) > _MAX: return {"ok": False, "error": "الملف أكبر من 20 ميجابايت"}
    import zipfile
    if zipfile.is_zipfile(path):
        z = zipfile.ZipFile(path); infos = z.infolist(); tot = sum(i.file_size for i in infos)
        if len(infos) > 5000 or tot > 100_000_000 or (os.path.getsize(path) and tot / os.path.getsize(path) > 200):
            return {"ok": False, "error": "الملف المضغوط يبدو ضخمًا بعد فك الضغط (حد أمان)؛ لم يُفحص."}
    data = open(path, "rb").read()
    try:
        p = olevba.VBA_Parser(os.path.basename(path), data=data)
        has = bool(p.detect_vba_macros()); text = p.type == "Text"
        findings = [[a, b] for a, b, _ in p.analyze_macros()] if has else []
        modules = [m[2] for m in p.extract_macros()] if has and not text else []
        status = "نص عادي: تقدير بالكلمات المفتاحية فقط" if text else ("وُجد كود ماكرو" if has else "لم يُعثر على ماكرو (لا يثبت أن الملف آمن)")
        return {"ok": True, "type": p.type, "macro_status": status, "modules": modules, "findings": findings, "note": "فحص ساكن؛ لم يُنفَّذ أي ماكرو. افتح الملف فقط في بيئة معزولة إن لزم."}
    except Exception as e: return {"ok": False, "error": type(e).__name__ + ": " + str(e)[:160]}
