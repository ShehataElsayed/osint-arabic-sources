"""Case planner: a small trained text classifier (multinomial naive Bayes on word and character n-grams) that maps a case description to task types, then to an ordered tool plan with reasons. Standard library only, runs offline in the browser worker. Trained on synthetic cases written by us (see planner_model.py header); NOT validated on real investigations. Planning aid, not a verifier."""
import math, re, json
from collections import Counter
from .core import tool, REGISTRY, normalize_ar, words, STOP

TYPES = {
 "quote": ("اقتباس أو تصريح", ["quotecheck", "quotes", "numdiff"]),
 "numbers": ("أرقام ونسب", ["numdiff", "claims", "benford"]),
 "image": ("صورة أو ملف صورة", ["exif", "imghash", "evidence"]),
 "link": ("رابط أو صفحة", ["urlclean", "urlcheck", "headers"]),
 "domain": ("نطاق مشابه أو انتحال موقع", ["dnstwist", "urlcheck"]),
 "entities": ("أسماء وتواريخ وخط زمني", ["entities", "timeline", "hijri", "ngrams"]),
 "document": ("مرفق أوفيس", ["olevba", "evidence"]),
 "data": ("بيانات وجداول", ["profile", "benford", "coord", "similar"]),
 "headers": ("ترويسة بريد", ["headers", "urlcheck"]),
 "redact": ("حجب بيانات شخصية", ["redact"]),
 "tone": ("ادعاءات ونبرة الصياغة", ["claims", "tone", "hedging"]),
 "case": ("تنظيم قضية وأدلة", ["case", "evidence", "ask"]),
}
NUM = r"[0-9\u0660-\u0669]|\b(مليون|مليار|ألف|بالمئة|بالمائة|percent|million|billion)\b|ملايين"
URLRX = r"https?://|www\.|\b[a-z0-9-]+\.(com|org|net|gov|info|io|eg|ly|sa)\b|رابط|لينك"
CONDITIONS = {
 "numdiff": (NUM, "وصفك يذكر أرقامًا أو نسبًا تُقارن بين الاقتباس والمصدر", "الوصف لا يذكر أي رقم أو نسبة؛ أعد التشغيل إن كان في النص أرقام"),
 "benford": (r"(?:[0-9\u0660-\u0669]+\D+){9,}[0-9\u0660-\u0669]+", "وصفك يذكر 10 أرقام أو أكثر", "اختبار بنفورد يحتاج عشرات الأرقام على الأقل، والوصف لا يذكر 10 أرقام"),
 "urlcheck": (URLRX, "وصفك يذكر رابطًا أو نطاقًا لفحصه", "لا رابط ولا نطاق في الوصف"),
 "urlclean": (URLRX, "وصفك يذكر رابطًا يُنظَّف من معاملات التتبع", "لا رابط في الوصف"),
 "dnstwist": (URLRX, "وصفك يذكر نطاقًا يُولَّد له نطاقات مشابهة", "لا نطاق في الوصف؛ أدخل اسم النطاق في الأداة"),
 "headers": (r"ترويس|header|بريد|ايميل|إيميل|email|e-mail|SPF|DKIM", "وصفك يذكر رسالة بريد", "لا ذكر لرسالة بريد في الوصف"),
 "imghash": (r"نسخ|متداول|مشابه|تكرار|قديم|أصل|صورتين|صورتان|مقارن", "وصفك يشير إلى نسخ أو صور متداولة تُقارن", "لا إشارة إلى نسخة ثانية للمقارنة؛ تحتاج صورتين على الأقل"),
}
FN = {
 "quotecheck": "الصق نص المقال ونص المصدر الرسمي: تبحث عن كل اقتباس حرفيًا في المصدر وتعرض الفروق",
 "quotes": "تستخرج الاقتباسات ومن نُسبت إليه من المقال لتراجعها واحدًا واحدًا",
 "numdiff": "تقارن الأرقام بين الادعاء والمصدر",
 "claims": "تلتقط الجمل القابلة للتحقق في النص لتبدأ بها",
 "benford": "تختبر توزيع أول رقم في عمود أرقام طويل",
 "exif": "تقرأ بيانات الصورة الوصفية (الكاميرا، الوقت، الموقع) إن وُجدت؛ غيابها شائع بعد النشر على المنصات",
 "imghash": "تقارن بصمة الصورة المتداولة بنسخة أخرى من المجلد نفسه (ليست بحثًا في الإنترنت)",
 "evidence": "تحفظ بصمة الملف وتاريخ الاطلاع في سجل أدلة قبل أي تعديل",
 "urlclean": "تنظف الرابط من معاملات التتبع وتولّد روابط أرشفة لحفظ الصفحة قبل حذفها",
 "urlcheck": "تفحص الرابط محليًا: اختصار، نطاق مقلَّد، بونيكود، معاملات تتبع",
 "headers": "تحلل ترويسة البريد الخام: مسار الخوادم وحقول SPF وDKIM وDMARC (حقول يذكرها المرسل ولا تثبت شيئًا وحدها)",
 "dnstwist": "تولّد أشكال النطاقات المشابهة لتراجعها يدويًا (لا تفحص DNS ولا التسجيل)",
 "entities": "تستخرج الأسماء والمؤسسات والأماكن من النص",
 "timeline": "ترتب التواريخ المذكورة في نص زمنيًا",
 "hijri": "تحوّل التواريخ بين الهجري والميلادي",
 "ngrams": "تعدّ أكثر الكلمات والعبارات تكرارًا",
 "olevba": "تفحص ملف أوفيس بحثًا عن ماكرو دون تشغيله (غياب الماكرو لا يعني سلامته)",
 "profile": "تلخص أعمدة الجدول وتبرز القيم الشاذة والمفقودة",
 "coord": "تكشف نصوصًا متطابقة من حسابات عدة في وقت متقارب (يلزم جدول account,time,text)",
 "similar": "تقيس تشابه نصين وتعرض الجمل المشتركة",
 "redact": "تحجب الهواتف والبريد وأرقام الهوية قبل النشر (ليست ضمان إخفاء هوية)",
 "tone": "تقيس لغة التهويل والتعميم في العنوان أو النص",
 "hedging": "تميّز صيغ الجزم من التحوط والنفي",
 "case": "تنظم القضية في ملف واحد بسلسلة أدوات",
 "ask": "تبحث في وثائق تلصقها وتعيد المقاطع المطابقة",
}
def evidence_for(tid, case):
    if tid in ("numdiff", "benford"):
        n = re.findall(r"[0-9\u0660-\u0669][0-9\u0660-\u0669.,٫%]*", case)[:4]
        return ("أرقام في وصفك: " + "، ".join(n)) if n else ""
    if tid in ("urlcheck", "urlclean", "dnstwist"):
        m = re.search(r"https?://\S+|www\.\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\b", case, re.I)
        return ("في وصفك: " + m.group(0)[:60]) if m else ""
    return ""
def _all(*alts): return "".join("(?=.*(?:%s))" % a for a in alts)
# Added only when the model did not already rank the type; marked in the output as a text rule, not the model.
EXPLICIT_MORE = {
 "redact": _all("حجب|احجب|أحجب|نحجب|اخف|أخف|نخف|إخفاء|اخفاء", "بيانات|أسماء|اسماء|أرقام|ارقام|تليفون|هاتف|هواتف|موبايل|شهود|شاهد|هوية|ايميل|إيميل|بريد"),
 "quote": _all("قال|قالت|قالوا|صرح|صرّح|تصريح|نسب|اقتباس", "بيان|نص |نصه|مؤتمر|رسمي|تقرير|غير كده|مختلف|مصدر"),
 "case": _all("ربط|اربط|أربط|نربط|نرتب|أرتب|ارتب", "ادعاء|دليل|أدل|ادل|مستند"),
}
MIN_TOP = 0.20  # below this, with no text rule matching, the planner abstains (estimated from our own cases; not validated)
EXPLICIT = {"image": r"صور[ةه]|الصور|لقط[ةه]|فيديو|مقطع مصور", "headers": r"ترويس|header", "numbers": r"[0-9\u0660-\u0669][0-9\u0660-\u0669.,]*\s*(%|بالمئة|بالمائة|مليون|مليار|ألف|الف)", "document": r"ملف (وورد|ورد|إكسل|اكسل|أوفيس|اوفيس)|docx|xlsx|ماكرو"}
def feats(text):
    text = re.sub(r"(?:https?://|www\.)\S+", " رابطمكتوب ", text)
    t = normalize_ar(text.lower()); ws = [w for w in words(t) if w not in STOP and len(w) > 1]
    f = Counter(ws)
    for w in ws:
        p = "<" + w + ">"
        for n in (3, 4):
            for i in range(len(p) - n + 1): f["#" + p[i:i + n]] += 0.5
    return f
def train(cases, alpha=0.3):
    V = set(); cnt = {c: Counter() for c in cases}
    for c, xs in cases.items():
        for x in xs:
            f = feats(x); cnt[c].update(f); V.update(f)
    tot = {c: sum(cnt[c].values()) for c in cases}; n = len(V)
    lw = {}
    for c in cases:
        for w in V:
            lw.setdefault(w, {})[c] = round(math.log((cnt[c][w] + alpha) / (tot[c] + alpha * n)), 3)
    base = {c: round(math.log((cnt[c][None] if False else (tot[c] + alpha * n)) ** -1), 3) for c in cases}
    # keep only words that discriminate (spread of log-prob across classes) to keep the model small
    keep = {w: v for w, v in lw.items() if max(v.values()) - min(v.values()) > 0.6}
    unk = {c: round(math.log(alpha / (tot[c] + alpha * n)), 3) for c in cases}
    return {"w": keep, "unk": unk, "classes": list(cases)}
def scores(model, text):
    f = feats(text); s = {c: 0.0 for c in model["classes"]}; used = {c: [] for c in s}
    for w, k in f.items():
        v = model["w"].get(w)
        if not v: continue
        mean = sum(v.values()) / len(v)
        for c in s:
            d = (v[c] - mean) * k; s[c] += d; used[c].append((d, w))
    m = max(s.values()); e = {c: math.exp(min(30, (x - m) / 4)) for c, x in s.items()}; z = sum(e.values())
    return {c: e[c] / z for c in s}, used
def plan(model, text, top=2, threshold=0.45):
    p, used = scores(model, text)
    order = sorted(p, key=p.get, reverse=True)[:top]
    steps = []; seen = set()
    for c in order:
        if p[c] < 0.15 and steps: continue
        reasons = [w for d, w in sorted(used[c], reverse=True) if not w.startswith("#")][:4]
        for tid in TYPES[c][1]:
            if tid in seen or tid not in REGISTRY: continue
            seen.add(tid)
            steps.append({"tool": tid, "name": REGISTRY[tid]["name_ar"], "type": TYPES[c][0], "confidence": round(p[c], 2), "because": reasons})
    return {"types": [{"type": TYPES[c][0], "p": round(p[c], 2)} for c in order], "steps": steps, "confident": p[order[0]] >= threshold}
@tool("planner", "مخطط أدوات القضية", "Case Tool Planner",
      "اشرح قضيتك بجملتين فيقترح نموذج صغير مدرَّب أنواع المهام ثم ترتيب أدوات المنصة المناسبة مع سبب كل خطوة. دُرّب على حالات كتبناها نحن (اصطناعية) ولم يُختبر على تحقيقات حقيقية. أداة ترتيب وليست أداة تحقق، وتعمل داخل المتصفح دون إرسال النص.",
      [("case", "وصف القضية (لا تضع بيانات سرية)", "text")])
def planner_tool(case):
    from . import planner_model, planner_catalog
    from .taxonomy import category_of
    if not case.strip(): return {"ok": False, "error": "اكتب وصفًا للقضية"}
    p, used = scores(planner_model.MODEL, case[:3000])
    order = [c for c in sorted(p, key=p.get, reverse=True) if p[c] >= 0.15][:3] or sorted(p, key=p.get, reverse=True)[:1]
    rule_added = [c for c, rx in EXPLICIT.items() if c not in order and re.search(rx, case, re.I)]
    rule_added += [c for c, rx in EXPLICIT_MORE.items() if c not in order and c not in rule_added and re.search(rx, case, re.I | re.S)]
    if max(p.values()) < MIN_TOP and not rule_added:
        return {"ok": False, "fallback": True, "error": "وصفك لا يشير لنوع مهمة يعرفه المخطط (صورة، رابط، اقتباس، أرقام، بريد، ملف أوفيس، بيانات شخصية...). اذكر ما بين يديك وما تريد معرفته، أو استخدم البحث بالكلمات."}
    order = order + rule_added
    out = {"ok": True}
    if p[order[0]] < 0.45:
        out["تنبيه"] = "درجة النموذج منخفضة (عتبة 0.45 تقديرية غير مُتحقَّق منها)؛ استخدم البحث بالكلمات بدل هذا الترتيب."
    out["أنواع المهام المحتملة"] = [({"النوع": TYPES[c][0], "مصدر الإضافة": "قاعدة نصية: كلمة صريحة في وصفك، ليست من النموذج"} if c in rule_added else {"النوع": TYPES[c][0], "درجة النموذج (غير معايرة)": round(p[c], 2)}) for c in order]
    steps = []; kept = set(); plan_steps = []; omitted = []; seen = set()
    for c in order:
        why = "، ".join([w for d, w in sorted(used[c], reverse=True) if not w.startswith("#")][:4]) or "لا كلمات بارزة"
        for tid in TYPES[c][1]:
            if tid in seen or tid not in REGISTRY: continue
            seen.add(tid)
            cond = CONDITIONS.get(tid)
            if cond and not re.search(cond[0], case, re.I):
                omitted.append({"الأداة": REGISTRY[tid]["name_ar"], "لمهمة": TYPES[c][0], "سبب الحذف": cond[2]}); continue
            reason = FN.get(tid, REGISTRY[tid]["name_ar"]); ev = evidence_for(tid, case)
            if ev: reason += " (" + ev + ")"
            kept.add(c)
            plan_steps.append({"name": REGISTRY[tid]["name_ar"], "why": reason.split(" (في وصفك:")[0].split(" (أرقام")[0], "ev": ev, "task": TYPES[c][0], "link": "%s.html#%s" % (category_of(tid), tid), "weak": p[c] < 0.15 and c not in rule_added, "rule": c in rule_added})
            steps.append({"الأداة": "%d. %s" % (len(steps) + 1, REGISTRY[tid]["name_ar"]), "السبب (مهمة: %s)" % TYPES[c][0]: reason, "رابط": "%s.html#%s" % (category_of(tid), tid)})
        out.setdefault("_كلمات", {})[TYPES[c][0]] = why
    out["كلمات رجّحت كل مهمة (إشارة ترتيب فقط، ليست تفسيرًا)"] = out.pop("_كلمات")
    out["الخطوات داخل المنصة بالترتيب (كلها تعمل في متصفحك)"] = steps
    if omitted: out["خطوات حُذفت لأن وصفك لا يتضمن شرطها"] = omitted
    ext = []; seen_u = set()
    for c in [x for x in order if x in kept]:
        for t in planner_catalog.CATALOG.get(c, []):
            if t["url"] in seen_u: continue
            seen_u.add(t["url"]); ext.append({"الأداة": t["name"], "لمهمة": TYPES[c][0], "وصف الدليل": t["description"], "تنبيه": "تفتح موقعًا خارجيًا؛ لا ترفع إليه مواد حساسة", "الرابط": t["url"]})
    if ext: out["أدوات خارجية من الدليل (ليست داخل المنصة)"] = ext
    out["_plan"] = {"steps": plan_steps, "external": [{"name": x["الأداة"], "task": x["لمهمة"], "desc": x["وصف الدليل"], "url": x["الرابط"]} for x in ext], "omitted": [{"name": x["الأداة"], "why": x["سبب الحذف"]} for x in omitted], "low": p[order[0]] < 0.45, "types": [{"t": TYPES[c][0], "p": (None if c in rule_added else round(p[c], 2))} for c in order]}
    out["ملاحظة"] = "الدرجات مخرجات نموذج Naive Bayes صغير دُرّب على حالات اصطناعية كتبناها، وليست احتمال صحة الترتيب. الأدوات الخارجية اختيرناها يدويًا من الدليل لكل نوع مهمة، ولم نشغّلها ولا نضمن توفرها. الترتيب للمراجعة ولا يتحقق من صحة أي خبر."
    return out
