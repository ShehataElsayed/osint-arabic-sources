import re, io, csv, json, math, hashlib, os, struct, collections, datetime, email, urllib.parse
from email import policy
from .core import *

def _shingles(s, k=4):
    w = [normalize_ar(x) for x in words(s)]
    return {" ".join(w[i:i+k]) for i in range(max(1, len(w)-k+1))} if w else set()

@tool("similar","كاشف التطابق والنسخ","Reuse Detector","يقيس تشابه نصين (نسخ حرفي وإعادة صياغة جزئية) ويعرض الجمل المشتركة.",
      [("a","النص الأول","textarea"),("b","النص الثاني","textarea")])
def similar(a, b):
    sa, sb = _shingles(a), _shingles(b)
    j = len(sa & sb) / len(sa | sb) if sa | sb else 0
    ca = len(sa & sb) / len(sa) if sa else 0
    shared = [s for s in sentences(a) if len(words(s)) >= 5 and any(normalize_ar(s) == normalize_ar(t) for t in sentences(b))]
    level = "نسخ شبه كامل" if j > .6 else "تداخل كبير" if j > .25 else "تداخل جزئي" if j > .08 else "لا تطابق يذكر"
    return dict(ok=True, jaccard=round(j,3), share_of_a_found_in_b=round(ca,3), verdict=level, shared_sentences=shared)

SHORT = {"bit.ly","t.co","tinyurl.com","goo.gl","ow.ly","is.gd","buff.ly","cutt.ly","rb.gy","shorturl.at","t.ly"}
KNOWN = ["facebook.com","google.com","youtube.com","twitter.com","x.com","bbc.com","aljazeera.net","reuters.com","apple.com","microsoft.com","instagram.com","whatsapp.com","telegram.org","paypal.com","amazon.com","github.com"]
def _lev(a, b):
    p = list(range(len(b)+1))
    for i, x in enumerate(a, 1):
        c = [i]
        for j, y in enumerate(b, 1): c.append(min(p[j]+1, c[-1]+1, p[j-1]+(x != y)))
        p = c
    return p[-1]

@tool("urlcheck","فاحص الروابط","Link Inspector","يفحص الرابط محليًا: اختصارات، نطاق مقلَّد، تشفير بونيكود، IP، معاملات تتبع.",
      [("url","الرابط","text")])
def urlcheck(url):
    u = url.strip()
    if not re.match(r'^\w+://', u): u = "http://" + u
    p = urllib.parse.urlparse(u); host = (p.hostname or "").lower(); flags = []
    if host in SHORT: flags.append("رابط مختصر يخفي الوجهة")
    if re.fullmatch(r'[\d.]+', host): flags.append("عنوان IP بدل اسم نطاق")
    if "xn--" in host: flags.append("نطاق بونيكود (قد يكون تشابه حروف)")
    if p.scheme == "http": flags.append("بدون تشفير HTTPS")
    if host.count('.') >= 4: flags.append("نطاقات فرعية كثيرة")
    if '@' in p.netloc: flags.append("بيانات دخول داخل الرابط (تمويه)")
    base = ".".join(host.split('.')[-2:]) if host else ""
    for k in KNOWN:
        stem = k.split('.')[0]
        if base == k or len(stem) < 5: continue
        if any(part != stem and (_lev(part, stem) <= 2 or stem in part) for part in host.split('.')[:-1]): flags.append(f"يشبه {k}"); break
    q = urllib.parse.parse_qsl(p.query); trk = [k for k, _ in q if k.lower().startswith(("utm_","fbclid","gclid","igshid","mc_"))]
    if trk: flags.append("معاملات تتبع: " + ", ".join(trk))
    return dict(ok=True, host=host, scheme=p.scheme, flags=flags, risk=("مرتفع" if len([f for f in flags if "يشبه" in f or "IP" in f or "بونيكود" in f or "تمويه" in f]) else "متوسط" if len(flags) > 1 else "منخفض"),
                note="فحص بنيوي فقط؛ لا يتصل بالإنترنت ولا يثبت سلامة الموقع.")

@tool("urlclean","منظّف الروابط والأرشفة","Link Cleaner & Archiver","يزيل معاملات التتبع ويولّد روابط أرشفة لحفظ الدليل قبل حذفه (أرشيف الإنترنت وأرشيف اليوم).",
      [("url","الرابط","text")])
def urlclean(url):
    p = urllib.parse.urlparse(url.strip())
    q = [(k, v) for k, v in urllib.parse.parse_qsl(p.query) if not k.lower().startswith(("utm_","fbclid","gclid","igshid","mc_","ref","si"))]
    c = urllib.parse.urlunparse(p._replace(query=urllib.parse.urlencode(q), fragment=""))
    return dict(ok=True, clean=c, removed=len(urllib.parse.parse_qsl(p.query)) - len(q),
                wayback_save="https://web.archive.org/save/" + c, wayback_view="https://web.archive.org/web/2/" + c,
                archive_today="https://archive.ph/?run=1&url=" + urllib.parse.quote(c, safe=""))

_H = [(1,"محرم"),(2,"صفر"),(3,"ربيع الأول"),(4,"ربيع الآخر"),(5,"جمادى الأولى"),(6,"جمادى الآخرة"),(7,"رجب"),(8,"شعبان"),(9,"رمضان"),(10,"شوال"),(11,"ذو القعدة"),(12,"ذو الحجة")]
def _g2h(d):  # tabular Islamic calendar (civil), +-1 day vs sighting
    jd = d.toordinal() + 1721425.5; l = int(jd - 1948439.5 + 10632); n = (l-1)//10631; l = l - 10631*n + 354
    j = (int((10985-l)/5316))*(int((50*l)/17719)) + (int(l/5670))*(int((43*l)/15238))
    l = l - (int((30-j)/15))*(int((17719*j)/50)) - (int(j/16))*(int((15238*j)/43)) + 29
    m = int((24*l)/709); return int(l-(709*m)/24), m, int(30*n+j-30)
def _h2g_old(y, m, d):
    jd = d + math.ceil(29.5*(m-1)) + (y-1)*354 + (3+11*y)//30 + 1948440 - 385
    return datetime.date.fromordinal(int(jd - 1721425.5 + .5)) if False else datetime.date.fromordinal(int(jd) - 1721425)

@tool("hijri","محوّل التاريخ الهجري","Hijri Converter","تحويل ميلادي ↔ هجري (تقويم جدولي، قد يختلف يومًا عن الرؤية) مع اليوم من الأسبوع.",
      [("date","التاريخ (YYYY-MM-DD ميلادي أو hYYYY-MM-DD هجري)","text")])
def hijri(date):
    d = to_ascii_digits(date.strip()); days = ["الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت","الأحد"]
    m = re.fullmatch(r'(h)?(\d{4})-(\d{1,2})-(\d{1,2})', d)
    if not m: return err("الصيغة: 2026-10-26 أو h1448-05-14")
    try:
        if m.group(1):
            hy, hm, hd = map(int, m.groups()[1:]); g = _h2g(hy, hm, hd)
        else:
            g = datetime.date(*map(int, m.groups()[1:])); hd, hm, hy = _g2h(g)
    except ValueError as e: return err(str(e))
    return dict(ok=True, gregorian=g.isoformat(), hijri=f"{hd} {_H[hm-1][1]} {hy}", weekday=days[g.weekday()], note="تقويم جدولي: قد يختلف يومًا عن الرؤية الرسمية.")

@tool("exif","قارئ بيانات الصور","EXIF Reader","يقرأ بيانات JPEG الوصفية (الكاميرا، الوقت، GPS) محليًا ويحذّر من غيابها أو تعديلها.",
      [("path","مسار الصورة","file")])
def exif(path):
    try: b = open(path, "rb").read()
    except OSError as e: return err(str(e))
    if b[:2] != b'\xff\xd8': return err("ليس JPEG")
    i = 2; ex = None
    while i < len(b)-4:
        if b[i] != 0xFF: break
        mk = b[i+1]; ln = struct.unpack(">H", b[i+2:i+4])[0]
        if mk == 0xE1 and b[i+4:i+10] == b'Exif\0\0': ex = b[i+10:i+2+ln]; break
        if mk == 0xDA: break
        i += 2 + ln
    if ex is None: return dict(ok=True, has_exif=False, tags={}, warnings=["لا بيانات EXIF: قد تكون أُزيلت عند الرفع على المنصات."])
    e = "<" if ex[:2] == b'II' else ">"; u = lambda f, o: struct.unpack(e+f, ex[o:o+struct.calcsize(f)])
    TAGS = {0x010F:"Make",0x0110:"Model",0x0131:"Software",0x0132:"DateTime",0x9003:"DateTimeOriginal",0x9004:"DateTimeDigitized",0xA002:"Width",0xA003:"Height"}
    GPS = {}; tags = {}
    def rd(off, table, sink):
        n = u("H", off)[0]
        for k in range(n):
            o = off + 2 + 12*k; tag, typ, cnt = u("HHI", o); sz = {1:1,2:1,3:2,4:4,5:8}.get(typ, 1)*cnt
            vo = o + 8 if sz <= 4 else u("I", o+8)[0]
            if typ == 2: v = ex[vo:vo+cnt].split(b'\0')[0].decode("latin-1", "replace")
            elif typ == 5: v = [u("II", vo+8*j) for j in range(cnt)]
            elif typ == 3: v = u("H", vo)[0] if cnt == 1 else None
            elif typ == 4: v = u("I", vo)[0] if cnt == 1 else None
            else: v = None
            if table is not None and tag in table: sink[table[tag]] = v
            if table is TAGS and tag == 0x8769: rd(u("I", o+8)[0], TAGS, sink)
            if table is TAGS and tag == 0x8825: rd(u("I", o+8)[0], None, GPS_raw)
            if table is None: GPS_raw[tag] = v
    GPS_raw = {}; rd(u("I", 4)[0], TAGS, tags)
    if GPS_raw:
        def deg(v): return v[0][0]/v[0][1] + v[1][0]/v[1][1]/60 + v[2][0]/v[2][1]/3600
        try:
            lat = deg(GPS_raw[2]) * (-1 if GPS_raw.get(1) == "S" else 1); lon = deg(GPS_raw[4]) * (-1 if GPS_raw.get(3) == "W" else 1)
            tags["GPS"] = dict(lat=round(lat,6), lon=round(lon,6), map=f"https://www.openstreetmap.org/?mlat={lat:.6f}&mlon={lon:.6f}")
        except Exception: pass
    w = []
    if "Software" in tags: w.append("حقل Software موجود (" + str(tags["Software"]) + "): تحقق من احتمال تعديل الصورة.")
    if "DateTimeOriginal" not in tags: w.append("لا وقت التقاط أصلي.")
    return dict(ok=True, has_exif=True, tags=tags, warnings=w)

@tool("evidence","سجل الأدلة والبصمة","Evidence Ledger","يحسب بصمة SHA-256 للملف ويضيفها لسجل أدلة بوقت وتسلسل مرتبط بالسجل السابق لكشف العبث.",
      [("path","مسار الملف","file"),("note","ملاحظة","text")])
def evidence(path, note="", ledger="evidence-ledger.jsonl"):
    try:
        h = hashlib.sha256(); size = 0
        with open(path, "rb") as f:
            for ch in iter(lambda: f.read(1 << 20), b""): h.update(ch); size += len(ch)
    except OSError as e: return err(str(e))
    prev = "0"*64
    if os.path.exists(ledger):
        lines = open(ledger, encoding="utf-8").read().splitlines()
        if lines: prev = json.loads(lines[-1])["entry_hash"]
    rec = dict(file=os.path.basename(path), size=size, sha256=h.hexdigest(), note=note, at=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"), prev=prev)
    rec["entry_hash"] = hashlib.sha256(json.dumps(rec, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    with open(ledger, "a", encoding="utf-8") as f: f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    return dict(ok=True, **rec)

def verify_ledger(ledger):
    prev = "0"*64
    for n, l in enumerate(open(ledger, encoding="utf-8").read().splitlines(), 1):
        r = json.loads(l); eh = r.pop("entry_hash")
        if r["prev"] != prev or hashlib.sha256(json.dumps(r, sort_keys=True, ensure_ascii=False).encode()).hexdigest() != eh: return dict(ok=False, broken_at=n)
        prev = eh
    return dict(ok=True)

def _rows(text):
    r = list(csv.DictReader(io.StringIO(text.strip())));  return r

@tool("coord","كاشف التنسيق بين الحسابات","Coordination Finder","من جدول منشورات (account,time,text) يكشف نصوصًا متطابقة تُنشر من حسابات متعددة في نافذة زمنية قصيرة.",
      [("csv","CSV بأعمدة account,time,text","textarea"),("window_min","النافذة بالدقائق","text"),("min_accounts","أقل عدد حسابات (الافتراضي 3)","text")])
def coord(csv, window_min=10, min_accounts=3):
    rows = _rows(csv); win = float(window_min) * 60; groups = collections.defaultdict(list)
    for r in rows:
        try: t = datetime.datetime.fromisoformat(r["time"].strip().replace("Z", "+00:00")).timestamp()
        except Exception: continue
        groups[" ".join(normalize_ar(re.sub(r'https?://\S+|#\S+|@\S+', '', r["text"])).split())].append((t, r["account"]))
    out = []
    for k, v in groups.items():
        v.sort(); accs = {a for _, a in v}
        if len(accs) < int(min_accounts) or len(k.split()) < 4: continue
        best = max(range(len(v)), key=lambda i: len({a for t, a in v if v[i][0] <= t <= v[i][0]+win}))
        inwin = {a for t, a in v if v[best][0] <= t <= v[best][0]+win}
        if len(inwin) >= int(min_accounts): out.append(dict(text=k[:160], accounts=sorted(inwin), span_seconds=int(max(t for t, a in v if a in inwin and t <= v[best][0]+win) - v[best][0])))
    out.sort(key=lambda d: -len(d["accounts"]))
    return dict(ok=True, rows=len(rows), clusters=out, note="تطابق نص بين حسابات في وقت متقارب مؤشر يستحق الفحص وليس إثباتًا للتنسيق؛ قد تكون نصوصًا جاهزة أو أخبارًا متداولة. لا تنسب التنسيق لجهة بناءً عليه.")

@tool("benford","اختبار بنفورد","Benford Test","يختبر توزيع أول رقم في عمود أرقام (مبالغ/إحصاءات) ويكشف انحرافات تستحق التدقيق.",
      [("numbers","الأرقام مفصولة بمسافة أو سطر","textarea")])
def benford(numbers):
    v = [abs(float(x)) for x in re.findall(r'\d[\d.]*', to_ascii_digits(numbers).replace(',', '')) if re.search(r'[1-9]', x) and x.count('.') <= 1]
    d = [int(re.sub(r'[0.]', '', f"{x:.15g}".replace('e', ''))[0]) for x in v if x > 0]
    n = len(d)
    if n < 30: return dict(ok=True, n=n, verdict="عينة صغيرة (<30): الاختبار غير موثوق", digits={})
    if max(v) / max(min(x for x in v if x > 0), 1e-9) < 100: return dict(ok=True, n=n, verdict="غير مناسب: القيم تغطي أقل من رتبتين عشريتين (أعمار/أسعار ضيقة...) فبنفورد لا ينطبق", digits={})
    c = collections.Counter(d); chi = 0; rows = {}
    for k in range(1, 10):
        e = n*math.log10(1+1/k); chi += (c[k]-e)**2/e; rows[k] = dict(observed=round(c[k]/n, 3), expected=round(math.log10(1+1/k), 3))
    return dict(ok=True, n=n, chi_square=round(chi, 2), digits=rows, verdict="انحراف معنوي (5%) يستحق التدقيق" if chi > 15.51 else "متوافق مع بنفورد", note="اختبار إحصائي استكشافي: الانحراف قد ينتج عن طبيعة البيانات (سقوف، تقريب، أسعار ثابتة) وليس حكمًا بالتلاعب أو الاحتيال.")

@tool("profile","محلل الجداول والشواذ","Table Profiler","يلخص أعمدة CSV ويكشف القيم الشاذة والمفقودة والمكررة قبل أي تحليل أو نشر.",
      [("csv","CSV","textarea")])
def profile(csv):
    rows = _rows(csv)
    if not rows: return err("جدول فارغ")
    cols = {}
    for k in rows[0]:
        vals = [r[k] for r in rows]; miss = sum(1 for x in vals if x is None or not x.strip())
        nums = []
        for x in vals:
            try: nums.append(float(to_ascii_digits(x).replace(',', '')))
            except Exception: pass
        info = dict(missing=miss, unique=len(set(vals)))
        if len(nums) >= .8*max(1, len(vals) - miss) and nums:
            s = sorted(nums); q = lambda p: s[min(len(s)-1, int(p*(len(s)-1)+.5))]; q1, q3 = q(.25), q(.75); iqr = q3-q1
            info.update(type="number", min=s[0], median=q(.5), max=s[-1], outliers=[x for x in nums if iqr and (x < q1-1.5*iqr or x > q3+1.5*iqr)][:10])
        else: info.update(type="text", top=collections.Counter(vals).most_common(3))
        cols[k] = info
    dup = len(rows) - len({tuple(r.items()) for r in rows})
    return dict(ok=True, rows=len(rows), duplicate_rows=dup, columns=cols)

@tool("headers","محلل ترويسة البريد","Email Header Analyzer","يحلل ترويسة بريد خام: مسار الخوادم، SPF/DKIM/DMARC، وتناقض المرسل والرد.",
      [("raw","ترويسة البريد الخام","textarea")])
def headers(raw):
    m = email.message_from_string(raw, policy=policy.default); fl = []
    auth = " ".join(m.get_all("Authentication-Results", []))
    res = {k: (re.search(k + r'=(\w+)', auth, re.I).group(1).lower() if re.search(k + r'=(\w+)', auth, re.I) else None) for k in ("spf", "dkim", "dmarc")}
    for k, v in res.items():
        if v is None: fl.append(f"لا نتيجة {k.upper()}")
        elif v != "pass": fl.append(f"{k.upper()}={v}")
    f = email.utils.parseaddr(str(m.get("From", "")))[1].lower(); r = email.utils.parseaddr(str(m.get("Reply-To", "")))[1].lower(); rp = email.utils.parseaddr(str(m.get("Return-Path", "")))[1].lower()
    if r and f and r.split('@')[-1] != f.split('@')[-1]: fl.append("نطاق Reply-To يختلف عن From (شائع في النشرات، مريب إذا رافقه فشل مصادقة)")
    if rp and f and rp.split('@')[-1] != f.split('@')[-1]: fl.append("نطاق Return-Path يختلف عن From (عادي مع خدمات الإرسال الجماعي إن نجح DKIM/DMARC)")
    hops = [re.sub(r'\s+', ' ', str(x))[:160] for x in (m.get_all("Received") or [])][::-1]
    ips = sorted(set(re.findall(r'\[(\d{1,3}(?:\.\d{1,3}){3})\]', " ".join(hops))))
    bad = [k for k, v in res.items() if v and v != 'pass']
    verdict = 'الترويسة تذكر فشل مصادقة: تحقق من الرسالة الأصلية' if bad else ('غير محسوم: لا نتائج مصادقة في الترويسة' if not any(res.values()) else 'غير محسوم: الترويسة تذكر نجاح المصادقة لكنها نص قابل للتزوير')
    return dict(ok=True, verdict=verdict, note='حقول Authentication-Results نص داخل الرسالة قد يكتبه المرسل أو خادم وسيط؛ لا تثبت أصالة الرسالة دون فحصها على خادم الاستقبال الذي تثق به.', **{"from": f, "reply_to": r, "return_path": rp, "date": str(m.get("Date", ""))}, auth=res, hops=hops, ips=ips, flags=fl)

@tool("ask","السؤال على وثائقك بالأدلة","Evidence Q&A","يبحث في وثائق تلصقها (BM25 عربي) ويعيد المقاطع المطابقة مع أرقامها؛ والذكاء الاصطناعي اختياري ويُقيَّد بالمقاطع فقط.",
      [("question","السؤال","text"),("docs","الوثائق (افصل بينها بسطر ---)","textarea")], ai=True)
def ask(question, docs, k=3):
    chunks = []
    for di, d in enumerate([x for x in re.split(r'\n-{3,}\n', docs) if x.strip()], 1):
        for ci, s in enumerate(sentences(d)): chunks.append((di, ci, s))
    tok = lambda s: [w[2:] if w.startswith("ال") and len(w) > 4 else w for w in (normalize_ar(x) for x in words(s)) if w not in STOP]
    docs_t = [tok(c[2]) for c in chunks]; q = tok(question)
    if not chunks or not q: return dict(ok=True, passages=[], note="لا مقاطع أو سؤال فارغ")
    N = len(docs_t); avg = sum(map(len, docs_t)) / N or 1; df = collections.Counter(w for t in docs_t for w in set(t))
    sc = []
    for i, t in enumerate(docs_t):
        c = collections.Counter(t); s = 0
        for w in set(q):
            if w in c: s += math.log(1 + (N-df[w]+.5)/(df[w]+.5)) * c[w]*2.2/(c[w] + 1.2*(.25+.75*len(t)/avg))
        sc.append(s)
    mode = "bm25"; dense = None
    try:
        from . import embed
        if embed.available():
            P = embed.embed([c[2] for c in chunks], "passage"); dense = P @ embed.embed([question], "query")[0]; embed.unload(); mode = "bm25+e5"
    except Exception: dense = None
    rank = {}
    for name, arr in (("b", sc), ("d", dense)):
        if arr is None: continue
        for r, i in enumerate(sorted(range(N), key=lambda i: -arr[i])): rank[i] = rank.get(i, 0) + 1 / (60 + r)
    top = sorted(range(N), key=lambda i: -rank[i])[:k]
    ok = lambda i: sc[i] > 0 or (dense is not None and dense[i] >= 0.83)
    ps = [dict(doc=chunks[i][0], sentence_no=chunks[i][1]+1, text=chunks[i][2], score=round(sc[i], 2), **({"semantic": round(float(dense[i]), 3)} if dense is not None else {})) for i in top if ok(i)]
    return dict(ok=True, mode=mode, passages=ps, answerable=bool(ps), note="لا مقاطع مطابقة: لا تُجب من خارج الوثائق." if not ps else "مقاطع مرشحة للقراءة وليست إجابة أو تحققًا.")

def _h2g(y, m, d):
    g = datetime.date.fromordinal(int((y-1)*354.367 + (m-1)*29.53 + d) + 227015)
    for _ in range(40):
        hd, hm, hy = _g2h(g); delta = ((y*12+m)*30+d) - ((hy*12+hm)*30+hd)
        if delta == 0: return g
        g += datetime.timedelta(days=1 if delta > 0 else -1)
    raise ValueError("تاريخ هجري غير صالح")
