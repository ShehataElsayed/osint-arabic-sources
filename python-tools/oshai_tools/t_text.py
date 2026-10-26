import re, collections, hashlib, os
from .core import *

@tool("claims","مستخرج الادعاءات","Claim Extractor","يلتقط الجمل القابلة للتحقق (أرقام، تواريخ، نسب، أقوال) ويرتبها حسب قابلية التحقق.",
      [("text","نص","textarea")], ai=True)
def claims(text):
    out = []
    for s in sentences(text):
        t = to_ascii_digits(s); score = 0; why = []
        if re.search(r'\d', t): score += 2; why.append("رقم")
        if re.search(r'\d+\s*(%|٪|بالمئة|في المئة)', t): score += 1; why.append("نسبة")
        if re.search(r'(19|20)\d{2}', t): score += 1; why.append("سنة")
        if re.search(r'(قال|صرح|أعلن|اعلن|أكد|اكد|وفقا|حسب|بحسب|ذكر)', normalize_ar(s,False)+' '+s): score += 1; why.append("إسناد")
        if re.search(r'(أول|اول|أكبر|اكبر|أعلى|اعلى|ارتفع|انخفض|تضاعف|زاد|تراجع)', s): score += 1; why.append("مقارنة/تغير")
        if score >= 2: out.append(dict(sentence=s, score=score, signals=why))
    out.sort(key=lambda d: -d["score"])
    return dict(ok=True, count=len(out), claims=out)

@tool("quotes","محلل الاقتباسات","Quote Attributor","يستخرج الاقتباسات ومن نُسبت إليه ويكشف الاقتباس بلا مصدر.",
      [("text","نص","textarea")])
def quotes(text):
    res = []; ms = list(re.finditer(r'[«"“]([^»"”]{8,400})[»"”]', text))
    for i, m in enumerate(ms):
        lo = ms[i-1].end() if i else 0; hi = ms[i+1].start() if i+1 < len(ms) else len(text)
        before = text[max(lo, m.start()-80):m.start()]; after = text[m.end():min(hi, m.end()+80)]
        verb = r'(قال|قالت|صرح|صرحت|أكد|أكدت|اكد|أعلن|أعلنت|ذكر|ذكرت|يقول|تقول)'
        a = re.search(verb + r'\s+([^\s،.:«"]+(?:\s+[^\s،.:«"]+){0,2})', before + ' ' + after)
        res.append(dict(quote=m.group(1), speaker=a.group(2) if a else None, attributed=bool(a)))
    return dict(ok=True, count=len(res), unattributed=sum(not r["attributed"] for r in res), quotes=res)

@tool("numdiff","مقارن الأرقام","Number Reconciler","يقارن الأرقام بين نصين (ادعاء ومصدر) ويكشف التعارض والأرقام غير الموجودة في المصدر.",
      [("claim","الادعاء","textarea"),("source","المصدر","textarea")])
def numdiff(claim, source):
    def nums(s):
        s = to_ascii_digits(s).replace('٬', ',').replace('٫', '.')
        mult = {'ألف':1e3,'الف':1e3,'مليون':1e6,'مليار':1e9,'thousand':1e3,'million':1e6,'billion':1e9}
        r = []
        for m in re.finditer(r'(\d[\d,]*\.?\d*)\s*(ألف|الف|مليون|مليار|thousand|million|billion|%|٪)?', s):
            v = float(m.group(1).replace(',', '') or 0); u = m.group(2)
            if u in mult: v *= mult[u]
            if not u and 1900 <= v <= 2100: continue
            r.append((v, m.group(0).strip(), u))
        return r
    cn, sn = nums(claim), nums(source); sv = [v for v,_,_ in sn]
    found, missing, near = [], [], []
    for v, raw, un in cn:
        if any(abs(v-x) <= 1e-9*max(1,abs(v)) for x in sv): found.append(raw)
        else:
            pool = [x for x, _, uu in sn if uu == un] or sv
            c = min(pool, key=lambda x: abs(x-v), default=None)
            if c is not None and (abs(c-v)/max(abs(c),1) < 0.5 or any(uu == un and un for _, _, uu in sn)): near.append(dict(claim=raw, closest_in_source=c, diff_pct=round(100*(v-c)/max(abs(c),1),1)))
            else: missing.append(raw)
    verdict = "متطابق" if cn and not missing and not near else ("تعارض محتمل" if near else ("غير مدعوم" if missing else "لا أرقام"))
    return dict(ok=True, verdict=verdict, matched=found, conflicting=near, absent_from_source=missing)

@tool("entities","مستخرج الكيانات","Entity Spotter","يستخرج أشخاصًا ومؤسسات وأماكن وروابط وحسابات بقواعد عربية بدون إنترنت.",
      [("text","نص","textarea")])
def entities(text):
    ORG = r'(?:وزارة|هيئة|مجلس|شركة|بنك|جامعة|منظمة|الاتحاد|الجهاز|مؤسسة|حزب|جمعية|نقابة)'
    pat_org = re.compile(ORG + r'(?:\s+(?:ال)?[\u0621-\u064A]{2,}){1,3}')
    pat_per = re.compile(r'(?:الدكتور|الدكتورة|الأستاذ|المهندس|الرئيس|الوزير|الوزيرة|الشيخ|السيد|د\.)\s+[\u0621-\u064A]{2,}(?:\s+[\u0621-\u064A]{2,}){0,2}')
    PLACES = "القاهرة الجيزة الإسكندرية الرياض جدة مكة المدينة دمشق بغداد صنعاء عدن بيروت عمّان عمان الدوحة أبوظبي دبي الكويت المنامة مسقط الخرطوم طرابلس تونس الجزائر الرباط القدس غزة رام الله مصر السعودية سوريا العراق اليمن لبنان الأردن فلسطين الإمارات قطر الكويت البحرين عمان السودان ليبيا تونس المغرب".split()
    pl = sorted({p for p in PLACES if re.search(r'(?<![\u0621-\u064A])(?:ال)?'+p+r'(?![\u0621-\u064A])', text)})
    return dict(ok=True,
        organizations=sorted({m.group(0) for m in pat_org.finditer(text)}),
        people=sorted({re.sub(r'(?:\s+(?:إن|ان|أن|في|من|على|عن|قال|قالت|بأن|أمس|اليوم|و\w{0,1}))+$', '', m.group(0)).strip() for m in pat_per.finditer(text)}),
        places=pl,
        urls=re.findall(r'https?://[^\s)»\]]+', text),
        handles=sorted(set(re.findall(r'(?<![\w@])@[A-Za-z0-9_]{3,30}', text))),
        hashtags=sorted(set(re.findall(r'#[\w\u0600-\u06FF]{2,}', text))))

@tool("timeline","باني الخط الزمني","Timeline Builder","يلتقط التواريخ (ميلادي وهجري وعربي) من نص ويرتبها زمنيًا مع الجملة المرتبطة.",
      [("text","نص","textarea")])
def timeline(text):
    MONTHS = {'يناير':1,'كانون الثاني':1,'فبراير':2,'شباط':2,'مارس':3,'آذار':3,'ابريل':4,'أبريل':4,'نيسان':4,'مايو':5,'أيار':5,'يونيو':6,'حزيران':6,'يوليو':7,'تموز':7,'أغسطس':8,'اغسطس':8,'آب':8,'سبتمبر':9,'أيلول':9,'اكتوبر':10,'أكتوبر':10,'تشرين الأول':10,'نوفمبر':11,'تشرين الثاني':11,'ديسمبر':12,'كانون الأول':12,
              'january':1,'february':2,'march':3,'april':4,'may':5,'june':6,'july':7,'august':8,'september':9,'october':10,'november':11,'december':12}
    ev = []
    for s in sentences(text):
        t = to_ascii_digits(s)
        for m in re.finditer(r'(\d{1,2})\s+(' + '|'.join(sorted(map(re.escape, MONTHS), key=len, reverse=True)) + r')\s+(\d{4})', t, re.I):
            ev.append(((int(m.group(3)), MONTHS[m.group(2).lower()], int(m.group(1))), m.group(0), s))
        for m in re.finditer(r'(\d{4})-(\d{2})-(\d{2})|(\d{1,2})/(\d{1,2})/(\d{4})', t):
            g = m.groups()
            key = (int(g[0]),int(g[1]),int(g[2])) if g[0] else (int(g[5]),int(g[4]),int(g[3]))
            if 1<=key[1]<=12 and 1<=key[2]<=31: ev.append((key, m.group(0), s))
    ev.sort(key=lambda e: e[0])
    return dict(ok=True, count=len(ev), events=[dict(date="%04d-%02d-%02d"%k, as_written=w, sentence=s) for k,w,s in ev])

@tool("tone","كاشف التهويل","Sensationalism Detector","يقيس اللغة المهيّجة والتعميم ونقص الإسناد في عنوان أو نص ويشرح كل إشارة.",
      [("text","نص","textarea")], ai=True)
def tone(text):
    n = normalize_ar(text); sig = []
    LEX = {"عاجل":2,"خطير":2,"صادم":3,"فضيحة":3,"كارثة":3,"لن تصدق":3,"سري":2,"تسريب":2,"حصري":1,"انفجار":1,"مفاجأة":2,"بالفيديو":1,"شاهد":1,"يفضح":3,"ينهار":2,"كشف النقاب":2}
    for w,sc in LEX.items():
        if normalize_ar(w) in n: sig.append((w, sc, "كلمة مهيجة"))
    if len(re.findall(r'[!؟?]{2,}|!', text)) : sig.append(("علامات تعجب",1,"ترقيم مبالغ"))
    if re.search(r'\b(كل|جميع|دائما|ابدا|أبدا|اطلاقا|إطلاقا)\b', text): sig.append(("تعميم",1,"ألفاظ مطلقة"))
    if not re.search(r'(قال|وفقا|بحسب|حسب|أعلن|صرح|ذكر|أكد|تقرير)', text): sig.append(("لا إسناد",2,"لا مصدر ظاهر"))
    caps = len(re.findall(r'\b[A-Z]{4,}\b', text)); 
    if caps: sig.append(("أحرف كبيرة",1,"صراخ نصي"))
    total = sum(s for _,s,_ in sig)
    return dict(ok=True, score=total, level=("مرتفع" if total>=6 else "متوسط" if total>=3 else "منخفض"),
                signals=[dict(term=a, weight=b, reason=c) for a,b,c in sig])

@tool("hedging","كاشف اليقين والتحوّط","Certainty Meter","يميز بين صيغ الجزم والتحوط والنفي في النص ليظهر مدى قوة الادعاء.",
      [("text","نص","textarea")])
def hedging(text):
    H = ["ربما","قد ","يُعتقد","يعتقد","يُزعم","يزعم","مزاعم","غير مؤكد","وفق مصادر","يبدو","محتمل","على ما يبدو","تفيد التقارير","لم يتسن"]
    C = ["مؤكد","بالتأكيد","حتما","حتماً","قطعا","قطعاً","ثبت","أثبت","بلا شك","لا شك"]
    N = ["لا صحة","نفى","نفت","ينفي","غير صحيح","كذب","مفبرك","لم يحدث"]
    cnt = lambda L: [w.strip() for w in L if w in text]
    h, c, n = cnt(H), cnt(C), cnt(N)
    lean = "جازم" if len(c) > len(h) and not n else "متحوط" if h else "محايد"
    if n: lean = "يتضمن نفيًا/تكذيبًا"
    return dict(ok=True, hedges=h, certainty=c, denials=n, stance=lean)

@tool("ngrams","محلل المصطلحات","Term Analyzer","أكثر الكلمات والعبارات تكرارًا بعد حذف الكلمات الشائعة وتطبيع العربية.",
      [("text","نص","textarea")])
def ngrams(text):
    w = [normalize_ar(x) for x in words(text)]; w = [x for x in w if x not in STOP and len(x) > 1 and not x.isdigit()]
    uni = collections.Counter(w); bi = collections.Counter(zip(w, w[1:]))
    return dict(ok=True, tokens=len(w), top_words=uni.most_common(15),
                top_phrases=[(" ".join(k), v) for k, v in bi.most_common(10) if v > 1])

@tool("redact","حاجب البيانات الشخصية","PII Redactor","يكشف ويحجب الهواتف والبريد وأرقام الهوية والبطاقات والـIBAN قبل النشر.",
      [("text","نص","textarea")])
def redact(text):
    t = to_ascii_digits(text); found = collections.Counter()
    rules = [("email", r'[\w.+-]+@[\w-]+\.[\w.-]+'), ("iban", r'\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b'),
             ("card", r'\b(?:\d[ -]?){13,19}\b'), ("national_id", r'(?<!\d)\d{14}(?!\d)'),
             ("phone", r'(?<!\d)(?:\+|00)?\d{1,3}[ -]?\(?\d{2,4}\)?[ -]?\d{3,4}[ -]?\d{3,4}(?!\d)')]
    spans = []
    for k, p in rules:
        for m in re.finditer(p, t):
            if k == "card":
                d = [int(x) for x in re.sub(r'\D', '', m.group(0))]
                s = sum(x if i%2==0 else (x*2-9 if x*2>9 else x*2) for i,x in enumerate(reversed(d)))
                if s % 10 or not 13 <= len(d) <= 19: continue
            if any(a < m.end() and m.start() < b for a, b, _ in spans): continue
            spans.append((m.start(), m.end(), k)); found[k] += 1
    spans.sort(); out = []; last = 0
    for a, b, k in spans: out.append(text[last:a]); out.append(f"[{k}]"); last = b
    out.append(text[last:])
    return dict(ok=True, found=dict(found), redacted="".join(out), note="حجب آلي بالأنماط قد يفوّت بيانات (أسماء، عناوين، تفاصيل مميِّزة)؛ لا يضمن إخفاء الهوية. راجع النص يدويًا قبل النشر.")

@tool("quotecheck","فاحص أصالة الاقتباس","Quote Provenance Check","لكل اقتباس في مقالك يبحث في مصادرك عن نصه الحرفي، فإن لم يجده يبحث عن أقرب جملة ويعرض الكلمات والأرقام المختلفة. عدم العثور لا يعني التلفيق: قد تكون مصادرك ناقصة.",
      [("article","نص المقال","textarea"),("sources","المصادر (افصل بينها بسطر ---)","textarea")])
def quotecheck(article, sources):
    import difflib
    qs = [m.group(1).strip() for m in re.finditer(r'[«"“]([^»"”]{8,500})[»"”]', article)]
    sents = []
    for di, d in enumerate([x for x in re.split(r'\n-{3,}\n', sources) if x.strip()], 1):
        for s in sentences(d): sents.append((di, s))
    tok = lambda x: re.findall(r'[\u0600-\u06FFA-Za-z0-9.]+', x)
    flat = {i: " ".join(tok(normalize_ar(to_ascii_digits(s)))) for i, (_, s) in enumerate(sents)}
    res = []
    for q in qs:
        nq = " ".join(tok(normalize_ar(to_ascii_digits(q)))); hit = next((i for i, t in flat.items() if nq in t), None)
        if hit is not None: res.append(dict(quote=q, status="exact", status_ar="نص حرفي موجود في المصدر", doc=sents[hit][0], source_sentence=sents[hit][1])); continue
        best, bi, bw = 0, None, None; a = nq.split()
        for i, t in flat.items():
            tw = t.split()
            for n in {max(1, len(a) - 1), len(a), len(a) + 1}:
                for st in range(0, max(1, len(tw) - n + 1)):
                    w = tw[st:st+n]; r = difflib.SequenceMatcher(None, a, w).ratio()
                    if r > best: best, bi, bw = r, i, w
        if bi is not None and best >= 0.6:
            b = bw; ops = difflib.SequenceMatcher(None, a, b).get_opcodes()
            removed = [" ".join(a[i1:i2]) for t, i1, i2, j1, j2 in ops if t in ("replace", "delete")]; added = [" ".join(b[j1:j2]) for t, i1, i2, j1, j2 in ops if t in ("replace", "insert")]
            nums_q = set(re.findall(r'\d+(?:\.\d+)?', nq)); nums_s = set(re.findall(r'\d+(?:\.\d+)?', " ".join(bw)))
            res.append(dict(quote=q, status="altered" if best >= 0.8 else "similar", status_ar="اقتباس معدَّل عن أقرب جملة" if best >= 0.8 else "جملة قريبة فقط، تحقق يدويًا", similarity=round(best, 2), doc=sents[bi][0], source_sentence=sents[bi][1],
                            words_in_quote_not_in_source=removed, words_in_source_not_in_quote=added, numbers_changed=sorted(nums_q ^ nums_s)))
        else: res.append(dict(quote=q, status="not_found", status_ar="غير موجود في المصادر المقدَّمة (لا يعني التلفيق)"))
    return dict(ok=True, quotes=len(qs), results=res, note="المطابقة على النص بعد تطبيع العربية والأرقام؛ الترجمة وإعادة الصياغة لن تُلتقط.")

try:
    from PIL import Image as _Image; _Image.MAX_IMAGE_PIXELS = 25_000_000
except Exception:
    _Image = None

@tool("imghash","كاشف تكرار الصور","Image Reuse Finder","يحسب بصمة إدراكية (dHash) لصور مجلد ويجمع الصور المتشابهة حتى بعد تغيير الحجم أو الضغط أو قص بسيط. يتطلب Pillow. ليس بحثًا عكسيًا في الإنترنت.",
      [("folder","مجلد الصور","file")])
def imghash(folder, max_distance=8):
    if _Image is None: return err("مكتبة Pillow غير مثبتة (اختيارية): pip install Pillow==11.3.0")
    import glob
    paths = sorted(p for e in ("jpg", "jpeg", "png", "webp", "bmp") for p in glob.glob(os.path.join(folder, "*." + e)) + glob.glob(os.path.join(folder, "*." + e.upper())))[:500]
    hs = {}
    for p in paths:
        try:
            im = _Image.open(p).convert("L").resize((9, 8)); px = list(im.getdata())
            hs[p] = int("".join("1" if px[r*9+c] > px[r*9+c+1] else "0" for r in range(8) for c in range(8)), 2)
        except Exception: continue
    items = list(hs.items()); groups = []; seen = set()
    for i, (p, h) in enumerate(items):
        if p in seen: continue
        g = [(p, 0)]
        for q, h2 in items[i+1:]:
            d = bin(h ^ h2).count("1")
            if d <= int(max_distance) and q not in seen: g.append((q, d)); seen.add(q)
        if len(g) > 1: seen.add(p); groups.append(dict(files=[dict(file=os.path.basename(a), distance=d) for a, d in g]))
    return dict(ok=True, images=len(hs), groups=groups, note="التشابه الإدراكي يعني أن الصور متقاربة بصريًا وليس أنها من الحدث نفسه أو من المصدر نفسه. عتبة 8 من 64 بت للتجربة.")
