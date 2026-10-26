"""Tools that use a local multilingual embedding model. Measured limit (see evals/): embeddings separate TOPICS well but score
opposite or different-detail claims as near-identical (e.g. raise/lower fuel prices = 0.98). So similarity is only a topical gate;
the relation between claim and passage comes from explicit discriminators (numbers, polarity pairs, negation, winner/loser order).
Nothing here ever returns 'supported' or 'false'."""
import re, collections, datetime
import numpy as np
from .core import *
from . import embed, nli
from .t_text import numdiff

POLAR = [("ترفع","تخفض"),("رفع","خفض"),("زيادة","خفض"),("زياده","تخفيض"),("ارتفع","انخفض"),("ارتفاع","انخفاض"),("يفتح","يغلق"),("افتتح","اغلق"),("حاره","برد"),("حار","بارد"),
         ("يرفع","يثبت"),("يرفع","يخفض"),("زاد","تراجع"),("زاد","قل"),("ربح","خسر"),("فوز","خساره"),("يؤكد","ينفي"),("تاكيد","نفي"),("قبول","رفض"),("موافقه","رفض"),("صحيح","كاذب"),("حديثه","قديمه"),("حديثا","قديما")]
NEG = {"ينفي","نفي","نفت","تنفي","لا","لم","لن","ليس","ليست","غير","شائعات","مزاعم","كذب","مفبرك"}
WIN = re.compile(r'([\u0621-\u064A]{3,})\s+(?:يفوز|فاز|انتصر|تفوق|يتغلب|يهزم|هزم)\s+(?:علي\s+)?(?:غريمه\s+)?([\u0621-\u064A]{3,})')
def _stems(s): return {w for w in (normalize_ar(x) for x in words(s))}
def _has(stems, w): return any(x.startswith(w) or w in x for x in stems)
def discriminate(claim, passage):
    """Explicit conflict signals between two texts about the same topic."""
    out = []; a, b = _stems(claim), _stems(passage)
    nd = numdiff(claim, passage)
    if nd["verdict"] == "تعارض محتمل" or (nd["absent_from_source"] and nd["verdict"] != "لا أرقام"): out.append(("number", "أرقام الادعاء لا تطابق المقطع: " + "، ".join(nd["absent_from_source"] + [c["claim"] for c in nd["conflicting"]])))
    for x, y in POLAR:
        if (_has(a, x) and _has(b, y) and not _has(a, y)) or (_has(a, y) and _has(b, x) and not _has(a, x)): out.append(("polarity", f"اتجاه متعاكس: {x} / {y}"))
    def negc(txt, st):
        n = len(st & NEG) + len({w[1:] for w in st if len(w) > 3 and w[0] in 'وف'} & NEG)
        return n + len(re.findall(r'دون\s+(?:وقوع|اصابات|خسائر|ضحايا)', normalize_ar(txt)))
    na, nb = negc(claim, a), negc(passage, b)
    if (na == 0) != (nb == 0): out.append(("negation", "أحد النصين فيه نفي/إنكار والآخر ليس فيه"))
    wa, wb = WIN.search(normalize_ar(claim)), WIN.search(normalize_ar(passage))
    if wa and wb and wa.group(1)[:4] == wb.group(2)[:4] and wa.group(2)[:4] == wb.group(1)[:4]: out.append(("order", "الفائز والخاسر معكوسان"))
    return out

def nli_conflicts(pairs, thr=0.5):
    """pairs [(claim, passage)] -> list of None | detail, using the local NLI model in both directions. High precision, low recall (see evals/README.md)."""
    if not pairs or not nli.available(): return [None] * len(pairs)
    fx = lambda t: t if t.rstrip().endswith((".", "؟", "!")) else t.rstrip() + "."
    A = nli.predict([(fx(p), fx(c)) for c, p in pairs]); B = nli.predict([(fx(c), fx(p)) for c, p in pairs])
    return [f"نموذج الاستدلال النصي يرجّح التعارض ({max(a['contradiction'], b['contradiction']):.2f})" if max(a['contradiction'], b['contradiction']) >= thr else None for a, b in zip(A, B)]

def _label(sim, flags):
    if sim < 0.86: return "no_match"
    return "same_topic_conflicting_detail" if flags else "same_topic_needs_reading"
LABEL_AR = {"no_match": "لا مقطع في المصدر عن نفس الموضوع", "same_topic_conflicting_detail": "نفس الموضوع مع تفصيل متعارض: راجع", "same_topic_needs_reading": "نفس الموضوع: مقطع مرشَّح للقراءة اليدوية (قواعدنا لم تلتقط تعارضًا، وهذا لا يعني أنه يؤيد الادعاء؛ في اختبار مستقل دمجنا ادعاءات متعارضة كثيرًا)"}

@tool("semcheck","باحث المقاطع المقابلة للادعاء","Counter-Passage Finder","يجد لكل ادعاء أقرب مقاطع في مصادرك بالمعنى (حتى عبر العربية والإنجليزية) ويعرض ما قد يعارضه (أرقام، اتجاه، نفي، استدلال نصي). ليس تحققًا: لا يحكم بالصدق ولا بالتأييد، وغياب التنبيه لا يعني شيئًا.",
      [("claims","الادعاءات (سطر لكل ادعاء)","textarea"),("sources","المصادر (افصل بينها بسطر ---)","textarea")], ai=True)
def semcheck(claims, sources):
    if not embed.available(): return err("نموذج التضمين المحلي غير متاح (multilingual-e5-small). الأداة تحتاجه.")
    cl = [c.strip() for c in claims.splitlines() if c.strip()]; ch = []
    for di, d in enumerate([x for x in re.split(r'\n-{3,}\n', sources) if x.strip()], 1):
        for si, s in enumerate(sentences(d)):
            if len(words(s)) >= 3: ch.append((di, si + 1, s))
    if not cl or not ch: return err("أدخل ادعاءً ومصدرًا")
    P = embed.embed([c[2] for c in ch], "passage"); Q = embed.embed(cl, "query"); res = []
    embed.unload(); allc = []
    for i, c in enumerate(cl): allc.append([j for j in np.argsort(-(P @ Q[i]))[:3] if (P @ Q[i])[j] >= 0.86])
    flat = [(i, j) for i, js in enumerate(allc) for j in js]; ncm = dict(zip(flat, nli_conflicts([(cl[i], ch[j][2]) for i, j in flat])))
    nli.unload()
    for i, c in enumerate(cl):
        sims = P @ Q[i]; order = np.argsort(-sims)[:3]; best = []
        nc = {j: ncm.get((i, j)) for j in allc[i]}
        for j in order:
            fl = discriminate(c, ch[j][2]) if sims[j] >= 0.86 else []
            if nc.get(j): fl = fl + [("nli", nc[j])]
            best.append(dict(doc=ch[j][0], sentence_no=ch[j][1], passage=ch[j][2], similarity=round(float(sims[j]), 3), flags=[dict(kind=k, detail=d) for k, d in fl]))
        top = best[0]; conf = [b for b in best if b["similarity"] >= .86 and b["flags"]]
        lab = "same_topic_conflicting_detail" if conf else _label(top["similarity"], top["flags"])
        res.append(dict(claim=c, result=lab, result_ar=LABEL_AR[lab], matches=best))
    return dict(ok=True, results=res, model="multilingual-e5-small + mDeBERTa-xnli (MIT, محلي)" if nli.available() else "multilingual-e5-small (MIT, محلي)", note="التشابه الدلالي يقيس الموضوع فقط: قد يعطي درجة عالية لنصين متناقضين. الفحوص الإضافية قواعد محدودة (أرقام، اتجاه، نفي، فائز/خاسر) ولا تلتقط كل التعارضات.")

@tool("narratives","كاشف السرديات المعاد صياغتها","Paraphrased Narrative Finder","يجمّع منشورات من حسابات متعددة تروّج للموضوع نفسه بصياغات مختلفة (وبلغات مختلفة)، ويفرّق النسخ الحرفي عن إعادة الصياغة ويعرض نافذة النشر. مؤشر يستحق الفحص وليس إثباتًا للتنسيق.",
      [("csv","CSV بأعمدة account,time,text","textarea"),("min_accounts","أقل عدد حسابات (الافتراضي 3)","text")], ai=True)
def narratives(csv, min_accounts=3, threshold=0.88):
    if not embed.available(): return err("نموذج التضمين المحلي غير متاح (multilingual-e5-small).")
    import io, csv as _csv
    rows = []
    for r in _csv.DictReader(io.StringIO(csv.strip())):
        try: t = datetime.datetime.fromisoformat(r["time"].strip().replace("Z", "+00:00"))
        except Exception: continue
        if r.get("text", "").strip(): rows.append((r["account"].strip(), t, r["text"].strip()))
    if len(rows) < 2: return err("أقل من منشورين صالحين")
    rows = rows[:2000]; V = embed.embed([re.sub(r'https?://\S+', '', x[2]) for x in rows], "query")
    parent = list(range(len(rows)))
    def f(x):
        while parent[x] != x: parent[x] = parent[parent[x]]; x = parent[x]
        return x
    S = V @ V.T; cand = []
    for i in range(len(rows)):
        for j in range(i + 1, len(rows)):
            if S[i, j] >= threshold: cand.append((i, j))
    embed.unload(); cand = cand[:600]; ncs = nli_conflicts([(rows[i][2], rows[j][2]) for i, j in cand]); nli.unload()
    for (i, j), n in zip(cand, ncs):
        if not n and not discriminate(rows[i][2], rows[j][2]): parent[f(j)] = f(i)
    groups = collections.defaultdict(list)
    for i in range(len(rows)): groups[f(i)].append(i)
    out = []
    for g in groups.values():
        accs = {rows[i][0] for i in g}
        if len(accs) < int(min_accounts): continue
        norm = {normalize_ar(re.sub(r'https?://\S+|#\S+|@\S+', '', rows[i][2])) for i in g}
        ts = sorted(rows[i][1] for i in g)
        out.append(dict(accounts=sorted(accs), posts=len(g), distinct_wordings=len(norm), verbatim_share=round(1 - (len(norm) - 1) / max(len(g) - 1, 1), 2),
                        window_hours=round((ts[-1] - ts[0]).total_seconds() / 3600, 2), first=ts[0].isoformat(), examples=[rows[i][2][:140] for i in g[:3]]))
    out.sort(key=lambda d: -len(d["accounts"]))
    return dict(ok=True, posts=len(rows), clusters=out, threshold=threshold, model="multilingual-e5-small (MIT, محلي)",
                note="مجموعات موضوعية بصياغات متعددة. مؤشر يستحق الفحص وليس إثباتًا للتنسيق أو لنسبته إلى جهة؛ قد ينتشر موضوع خبري بشكل طبيعي. المنشورات المتعارضة تفصل بقواعد محدودة.")

@tool("topics","فرز الوثائق بالموضوع","Document Topic Triage","لمجموعة وثائق أو مقالات (افصل بينها بسطر ---) يجمّعها بحسب الموضوع بالمعنى (عربي وإنجليزي) ويسمّي كل مجموعة بأبرز مصطلحاتها لتقرر بسرعة ما تقرؤه أولًا. لا يلخّص ولا يحكم.",
      [("docs","الوثائق (افصل بينها بسطر ---)","textarea")], ai=True)
def topics(docs, threshold=0.86):
    if not embed.available(): return err("نموذج التضمين المحلي غير متاح (multilingual-e5-small).")
    ds = [d.strip() for d in re.split(r'\n-{3,}\n', docs) if d.strip()][:300]
    if len(ds) < 2: return err("أدخل وثيقتين على الأقل")
    V = embed.embed([d[:1200] for d in ds], "query"); embed.unload()
    parent = list(range(len(ds)))
    def f(x):
        while parent[x] != x: parent[x] = parent[parent[x]]; x = parent[x]
        return x
    S = V @ V.T
    for i in range(len(ds)):
        for j in range(i + 1, len(ds)):
            if S[i, j] >= threshold: parent[f(j)] = f(i)
    g = collections.defaultdict(list)
    for i in range(len(ds)): g[f(i)].append(i)
    df = collections.Counter(w for d in ds for w in {normalize_ar(x).lower() for x in words(d)} - STOP)
    out = []
    for m in g.values():
        c = collections.Counter(w for i in m for w in {normalize_ar(x).lower() for x in words(ds[i])} - STOP if len(w) > 2 and not w.isdigit())
        terms = [w for w, _ in sorted(c.items(), key=lambda kv: -(kv[1] * (1 - 0.5 * (df[kv[0]] / len(ds)))))[:5]]
        out.append(dict(size=len(m), terms=terms, docs=[dict(no=i + 1, preview=ds[i][:90]) for i in m]))
    out.sort(key=lambda d: -d["size"])
    return dict(ok=True, documents=len(ds), groups=out, model="multilingual-e5-small (MIT, محلي)", note="تجميع موضوعي تقريبي بعتبة ثابتة؛ قد يفصل وثيقتين عن الموضوع نفسه أو يجمع موضوعين متقاربين. للفرز الأولي فقط.")
