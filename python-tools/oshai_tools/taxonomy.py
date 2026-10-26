"""Category taxonomy for the tool pages. Each tool belongs to exactly one category; `runtime` says where it runs today."""
CATEGORIES = [
 dict(id="claims", name_ar="الادعاءات والاقتباسات", desc_ar="استخراج ما يحتاج تحققًا ومقارنته بالمصدر والاقتباس الحرفي.", tools=["claims", "quotes", "quotecheck", "numdiff", "hedging", "tone"]),
 dict(id="entities", name_ar="الكيانات والزمن", desc_ar="الأشخاص والجهات والأماكن والتواريخ والتسلسل الزمني للنص.", tools=["entities", "timeline", "ngrams", "hijri"]),
 dict(id="links", name_ar="الروابط والمصادر والأدلة", desc_ar="تنظيف الروابط وفحصها، وتوثيق الأدلة، وقراءة ترويسات البريد، وإخفاء البيانات الشخصية.", tools=["urlcheck", "urlclean", "evidence", "headers", "redact"]),
 dict(id="media", name_ar="الصور والملفات", desc_ar="بيانات الصور، وتكرار الصور، وفحص ماكرو ملفات Office ساكنًا.", tools=["exif", "imghash", "olevba"]),
 dict(id="data", name_ar="البيانات والشبكات", desc_ar="مؤشرات على تنسيق الحسابات وأرقام غير طبيعية وتشابه النصوص وتحليل نطاقات التقليد.", tools=["coord", "benford", "profile", "similar", "dnstwist"]),
 dict(id="workflows", name_ar="البحث والتدفقات", desc_ar="سؤال على مستنداتك، وملف تحقيق متسلسل يجمع عدة أدوات.", tools=["ask", "case"]),
 dict(id="ai", name_ar="نماذج ذكاء اصطناعي محلية", desc_ar="أدوات تعتمد على نماذج لغوية تعمل محليًا؛ لا تحكم بالصدق وإنما ترشّح مقاطع للمراجعة.", tools=["semcheck", "narratives", "topics"]),
]
MODEL_TOOLS = {"semcheck", "narratives", "topics"}
EXTERNAL = {"dnstwist": "dnstwist (Apache-2.0)", "olevba": "oletools (BSD)"}
def category_of(tool_id):
    for c in CATEGORIES:
        if tool_id in c["tools"]: return c["id"]
def manifest(registry, browser_ok=lambda tid: True):
    out = []
    for c in CATEGORIES:
        out.append(dict(id=c["id"], name_ar=c["name_ar"], desc_ar=c["desc_ar"], tools=[dict(id=t, name_ar=registry[t]["name_ar"], name_en=registry[t]["name_en"], desc_ar=registry[t]["desc_ar"], inputs=[list(i) for i in registry[t]["inputs"]],
            kind="model" if t in MODEL_TOOLS else ("external_library" if t in EXTERNAL else "rules"), source=EXTERNAL.get(t, "OshAi"), runs_in_browser=browser_ok(t)) for t in c["tools"] if t in registry]))
    return out
