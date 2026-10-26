import os, sys, struct, tempfile, unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import oshai_tools as o
from oshai_tools.t_data import verify_ledger

def mk_jpeg(path):
    # little-endian TIFF: Make, Software, GPS IFD (30N 31E-ish)
    def ent(tag, typ, cnt, val): return struct.pack("<HHII", tag, typ, cnt, val)
    make = b"TestCam\0"; sw = b"Photoshop\0"
    ifd0_off = 8; n = 3; ifd0_len = 2 + 12*n + 4
    data_off = ifd0_off + ifd0_len
    gps_off = data_off + len(make) + len(sw)
    gps_n = 4; gps_len = 2 + 12*gps_n + 4
    rat_off = gps_off + gps_len
    ifd0 = struct.pack("<H", n) + ent(0x010F, 2, len(make), data_off) + ent(0x0131, 2, len(sw), data_off+len(make)) + ent(0x8825, 4, 1, gps_off) + struct.pack("<I", 0)
    def rats(*v): return b"".join(struct.pack("<II", a, 1) for a in v)
    gps = struct.pack("<H", gps_n) + ent(1, 2, 2, int.from_bytes(b"N\0\0\0", "little")) + ent(2, 5, 3, rat_off) + ent(3, 2, 2, int.from_bytes(b"E\0\0\0", "little")) + ent(4, 5, 3, rat_off+24) + struct.pack("<I", 0)
    tiff = b"II*\0" + struct.pack("<I", 8) + ifd0 + make + sw + gps + rats(30, 0, 0) + rats(31, 30, 0)
    seg = b"Exif\0\0" + tiff
    open(path, "wb").write(b"\xff\xd8\xff\xe1" + struct.pack(">H", len(seg)+2) + seg + b"\xff\xd9")

class T(unittest.TestCase):
    def test_count(self): self.assertEqual(len(o.REGISTRY), 28); self.assertTrue(all(t["desc_ar"] for t in o.REGISTRY.values()))
    def test_claims(self):
        r = o.run("claims", text="قال الوزير إن التضخم ارتفع إلى 13.9% في 2026. الطقس جميل اليوم.")
        self.assertEqual(r["count"], 1); self.assertIn("نسبة", r["claims"][0]["signals"])
    def test_quotes(self):
        r = o.run("quotes", text='قال الدكتور أحمد: «نحن نراجع الأرقام بدقة كاملة». وكتب أحدهم «هذا كلام بلا مصدر واضح أبدا».')
        self.assertEqual(r["count"], 2); self.assertEqual(r["unattributed"], 1)
    def test_numdiff_known_defect(self):
        self.assertEqual(o.run("numdiff", claim="بلغ العجز 900 ألف", source="بلغ العجز 225 ألف")["verdict"], "تعارض محتمل")
        self.assertEqual(o.run("numdiff", claim="12.8%", source="التضخم 12.8%")["verdict"], "متطابق")
        self.assertEqual(o.run("numdiff", claim="٩٠٠ ألف", source="900 ألف")["verdict"], "متطابق")
    def test_entities(self):
        r = o.run("entities", text="أعلنت وزارة الصحة في القاهرة عبر @mohp وفق https://x.org/a #صحة قال الدكتور محمد علي")
        self.assertIn("القاهرة", r["places"]); self.assertTrue(r["organizations"]); self.assertTrue(r["people"]); self.assertEqual(r["handles"], ["@mohp"])
    def test_timeline(self):
        r = o.run("timeline", text="بدأ الأمر في 5 مارس 2025. ثم صدر القرار في 2024-01-10.")
        self.assertEqual([e["date"] for e in r["events"]], ["2024-01-10", "2025-03-05"])
    def test_tone(self):
        self.assertEqual(o.run("tone", text="عاجل!! فضيحة صادمة تهز الجميع")["level"], "مرتفع")
        self.assertEqual(o.run("tone", text="قال المتحدث إن الاجتماع انتهى.")["level"], "منخفض")
    def test_hedging(self):
        self.assertEqual(o.run("hedging", text="قد يكون الخبر صحيحا ويزعم ناشروه ذلك")["stance"], "متحوط")
        self.assertIn("نفي", o.run("hedging", text="نفت الوزارة الخبر")["stance"])
    def test_ngrams(self): self.assertTrue(o.run("ngrams", text="الاقتصاد المصري ينمو. الاقتصاد المصري يتحسن.")["top_phrases"])
    def test_redact(self):
        r = o.run("redact", text="رقم 4111 1111 1111 1111 وبريد a@b.com والهوية 29001011234567")
        self.assertEqual(r["found"], {"email": 1, "card": 1, "national_id": 1}); self.assertNotIn("4111", r["redacted"])
        self.assertIn("1234", o.run("redact", text="الطلب 1234")["redacted"])
    def test_similar(self):
        a = "أعلنت الحكومة اليوم عن حزمة إجراءات جديدة لدعم الأسر الأكثر احتياجا خلال الشتاء القادم"
        self.assertEqual(o.run("similar", a=a, b=a)["verdict"], "نسخ شبه كامل")
        self.assertEqual(o.run("similar", a=a, b="مباراة الأمس انتهت بالتعادل السلبي بين الفريقين")["verdict"], "لا تطابق يذكر")
    def test_urlcheck(self):
        self.assertEqual(o.run("urlcheck", url="https://bit.ly/abc")["flags"][0], "رابط مختصر يخفي الوجهة")
        self.assertIn("يشبه facebook.com", o.run("urlcheck", url="https://faceb00k.com.evil.xyz")["flags"])
        self.assertEqual(o.run("urlcheck", url="https://www.aljazeera.net/news")["flags"], [])
    def test_urlclean(self):
        r = o.run("urlclean", url="https://a.com/p?id=3&utm_source=x&fbclid=1#frag")
        self.assertEqual(r["clean"], "https://a.com/p?id=3"); self.assertEqual(r["removed"], 2)
    def test_hijri(self):
        self.assertEqual(o.run("hijri", date="2025-03-01")["hijri"], "1 رمضان 1446")
        self.assertEqual(o.run("hijri", date="h1446-09-01")["gregorian"], "2025-03-01")
        self.assertFalse(o.run("hijri", date="x")["ok"])
    def test_exif(self):
        d = tempfile.mkdtemp(); p = os.path.join(d, "a.jpg"); mk_jpeg(p)
        r = o.run("exif", path=p); self.assertEqual(r["tags"]["Make"], "TestCam"); self.assertAlmostEqual(r["tags"]["GPS"]["lat"], 30.0); self.assertAlmostEqual(r["tags"]["GPS"]["lon"], 31.5)
        self.assertTrue(r["warnings"])
        q = os.path.join(d, "b.jpg"); open(q, "wb").write(b"\xff\xd8\xff\xd9"); self.assertFalse(o.run("exif", path=q)["has_exif"])
    def test_evidence_chain(self):
        d = tempfile.mkdtemp(); f = os.path.join(d, "f.txt"); open(f, "w").write("x"); L = os.path.join(d, "l.jsonl")
        from oshai_tools.t_data import evidence
        a = evidence(f, "1", L); b = evidence(f, "2", L); self.assertEqual(b["prev"], a["entry_hash"]); self.assertTrue(verify_ledger(L)["ok"])
        s = open(L, encoding="utf-8").read().replace('"note": "1"', '"note": "9"'); open(L, "w", encoding="utf-8").write(s)
        self.assertEqual(verify_ledger(L)["broken_at"], 1)
    def test_coord(self):
        c = "account,time,text\na1,2026-10-01T10:00:00,شركة المنتجات الغذائية تطلق حملة إعلانية ضخمة لمنتجها الجديد الان\na2,2026-10-01T10:03:00,شركة المنتجات الغذائية تطلق حملة إعلانية ضخمة لمنتجها الجديد الان #x\na3,2026-10-02T10:00:00,شركة المنتجات الغذائية تطلق حملة إعلانية ضخمة لمنتجها الجديد الان\na4,2026-10-01T11:00:00,نص مختلف تماما عن كل ما سبق هنا"
        r = o.run("coord", csv=c, window_min=10, min_accounts=2); self.assertEqual(len(r["clusters"]), 1); self.assertEqual(r["clusters"][0]["accounts"], ["a1", "a2"])
    def test_benford(self):
        import random; random.seed(1)
        nat = " ".join(str(int(10 ** random.uniform(1, 5))) for _ in range(500))
        self.assertEqual(o.run("benford", numbers=nat)["verdict"], "متوافق مع بنفورد")
        self.assertIn("انحراف", o.run("benford", numbers=" ".join(str(random.randint(7, 7) * 10 ** random.randint(2, 5) + random.randint(0, 99)) for _ in range(100)))["verdict"])
        self.assertIn("صغيرة", o.run("benford", numbers="1 2 3")["verdict"])
    def test_profile(self):
        r = o.run("profile", csv="a,b\n1,x\n2,y\n3,\n2,y\n1000,z\n2,y\n3,y\n2,y")
        self.assertIn(1000.0, r["columns"]["a"]["outliers"]); self.assertEqual(r["columns"]["b"]["missing"], 1); self.assertEqual(r["duplicate_rows"], 3)
    def test_headers(self):
        raw = "Received: from x [1.2.3.4] by y\nAuthentication-Results: mx; spf=fail; dkim=pass; dmarc=fail\nFrom: A <a@bank.com>\nReply-To: b@evil.net\nSubject: hi\n\nbody"
        r = o.run("headers", raw=raw); self.assertEqual(r["auth"]["spf"], "fail"); self.assertTrue(any(x.startswith("نطاق Reply-To") for x in r["flags"])); self.assertEqual(r["ips"], ["1.2.3.4"])
    def test_ask(self):
        docs = "ارتفع التضخم السنوي إلى 12.8% في سبتمبر. وبلغ سعر الصرف 48 جنيها.\n---\nفاز الفريق بالمباراة أمس."
        r = o.run("ask", question="كم بلغ التضخم السنوي؟", docs=docs); self.assertEqual(r["passages"][0]["doc"], 1)
        self.assertFalse(o.run("ask", question="من رئيس القمر؟", docs=docs)["answerable"])
    def test_ai_honest(self):
        os.environ.pop("OPENROUTER_API_KEY", None); os.environ["OLLAMA_URL"] = "http://127.0.0.1:9"
        r = o.ai.explain("tone", {"x": 1}); self.assertFalse(r["ok"]); self.assertIsNone(r["provider"])
    def test_coord_false_positive_wire_headline(self):
        c = "account,time,text\nout1,2026-10-01T10:00:00,الرئيس يفتتح مشروعا جديدا في العاصمة اليوم\nout2,2026-10-01T10:01:00,الرئيس يفتتح مشروعا جديدا في العاصمة اليوم"
        self.assertEqual(o.run("coord", csv=c)["clusters"], [])
    def test_benford_inapplicable_narrow_range(self):
        r = o.run("benford", numbers=" ".join(str(20 + i % 60) for i in range(200))); self.assertIn("غير مناسب", r["verdict"])
    def test_headers_mailing_list_not_flagged_as_forgery(self):
        raw = "Authentication-Results: mx; spf=pass; dkim=pass; dmarc=pass\nFrom: N <news@org.com>\nReturn-Path: <bounce@mailer.net>\n\nb"
        self.assertTrue(o.run("headers", raw=raw)["verdict"].startswith("غير محسوم"))
        self.assertTrue(o.run("headers", raw="From: a@b.com\n\nb")["verdict"].startswith("غير محسوم"))
    def test_case_pipeline(self):
        t = "قال الدكتور محمد علي إن العجز بلغ 900 ألف في القاهرة، شاهد https://bit.ly/x?utm_source=a وللتواصل a@b.com"
        r = o.run("case", text=t, source="بلغ العجز 225 ألف")
        self.assertTrue(any("تعارض" in x for x in r["checklist"])); self.assertTrue(any("bit.ly" in x for x in r["checklist"])); self.assertTrue(any("email" in x for x in r["checklist"]))
        self.assertNotIn("a@b.com", r["steps"]["redact"]["redacted"]); self.assertNotIn("a@b.com", " ".join(r["checklist"]))
    def test_entities_person_no_trailing_function_word(self):
        self.assertEqual(o.run("entities", text="قال الدكتور محمد علي إن العجز كبير")["people"], ["الدكتور محمد علي"])
    def test_bad_numeric_param_is_error_not_crash(self): self.assertFalse(o.run('coord', csv='account,time,text\na,2026-10-01T10:00:00,نص طويل بما يكفي هنا للاختبار\nb,2026-10-01T10:01:00,نص طويل بما يكفي هنا للاختبار', min_accounts='x')['ok'])
    def test_unknown(self): self.assertFalse(o.run("nope")["ok"]); self.assertFalse(o.run("tone")["ok"])
class TQ(unittest.TestCase):
    def test_quotecheck_punctuation_case_not_altered(self):
        self.assertEqual(o.run('quotecheck', article='«the conflict continues, and it stays.»', sources='The conflict continues, and it stays well above target.')['results'][0]['status'], 'exact')
    def test_quotecheck_exact_altered_missing(self):
        src = "قال الوزير: «العجز بلغ 225 ألف جنيه خلال الربع الثالث». وأضاف أن الحكومة ستراجع الإنفاق."
        art = 'نقلت الصحيفة «العجز بلغ 225 ألف جنيه خلال الربع الثالث» ثم «العجز بلغ 900 ألف جنيه خلال الربع الثالث» ثم «لن نغير أي سياسة في المستقبل القريب أبدا».'
        r = o.run("quotecheck", article=art, sources=src)["results"]
        self.assertEqual([x["status"] for x in r], ["exact", "altered", "not_found"])
        self.assertIn("900", r[1]["numbers_changed"]); self.assertIn("225", r[1]["numbers_changed"])
    def test_quotecheck_arabic_digits_and_diacritics_still_exact(self):
        self.assertEqual(o.run("quotecheck", article='«بلغ العجز ٢٢٥ ألف جنيه»', sources="بلغ العجز 225 ألف جنيه.")["results"][0]["status"], "exact")
    @unittest.skipUnless(o.t_text._Image, "Pillow not installed")
    def test_imghash_groups_resized_copy_not_different_image(self):
        from PIL import Image; import random
        d = tempfile.mkdtemp(); a = Image.new("RGB", (200, 200))
        a.putdata([(x % 200 * 255 // 200, y * 255 // 200, 80) for y in range(200) for x in range(200)]); a.save(os.path.join(d, "a.png")); a.resize((100, 100)).save(os.path.join(d, "a_small.jpg"), quality=60)
        random.seed(3); b = Image.new("RGB", (200, 200)); b.putdata([(random.randint(0, 255),) * 3 for _ in range(40000)]); b.save(os.path.join(d, "noise.png"))
        r = o.run("imghash", folder=d); self.assertEqual(r["images"], 3); self.assertEqual(len(r["groups"]), 1)
        self.assertEqual(sorted(f["file"] for f in r["groups"][0]["files"]), ["a.png", "a_small.jpg"])
    def test_imghash_missing_pillow_message(self):
        if o.t_text._Image is None: self.assertFalse(o.run("imghash", folder=".")["ok"])

@unittest.skipUnless(o.embed.available(), "local e5 model not installed")
class TAI(unittest.TestCase):
    def test_semcheck_flags_conflicts_and_never_says_supported(self):
        r = o.run("semcheck", claims="رفعت الحكومة أسعار الوقود أمس\nبلغ التضخم 14.1% في سبتمبر", sources="خفضت الحكومة أسعار الوقود أمس. بلغ معدل التضخم السنوي 12.8% في سبتمبر.")
        self.assertTrue(all(x["result"] == "same_topic_conflicting_detail" for x in r["results"]))
        self.assertNotIn("supported", str(r).lower())
    def test_semcheck_unrelated_is_no_match(self):
        self.assertEqual(o.run("semcheck", claims="أعلن البنك أرباحا قياسية", sources="خفضت الحكومة أسعار الوقود أمس.")["results"][0]["result"], "no_match")
    def test_topics_groups_by_meaning_across_languages(self):
        d = "ارتفعت أسعار الوقود اليوم في الأسواق\n---\nFuel prices rose in the markets today\n---\nفاز الفريق بالمباراة النهائية للبطولة\n---\nThe team won the championship final match"
        r = o.run("topics", docs=d); sets = sorted(sorted(x["no"] for x in g["docs"]) for g in r["groups"]); self.assertEqual(sets, [[1, 2], [3, 4]])
    def test_ask_semantic_finds_paraphrase_without_shared_words(self):
        r = o.run("ask", question="كم ارتفع سعر البنزين؟", docs="زادت تكلفة المحروقات بنسبة عشرة في المئة هذا الأسبوع.\n---\nانتهت المباراة بالتعادل."); self.assertEqual(r["passages"][0]["doc"], 1)
    def test_narratives_groups_paraphrase_keeps_opposites_apart(self):
        c = "account,time,text\na1,2026-10-01T10:00:00,شركة المنتجات الغذائية تطلق حملة إعلانية ضخمة لمنتجها الجديد\na2,2026-10-01T10:04:00,أطلقت شركة الأغذية حملة دعائية كبيرة للترويج لمنتجها الحديث\na4,2026-10-01T10:20:00,الحكومة ترفع أسعار الوقود غدا\na5,2026-10-01T10:22:00,الحكومة تخفض أسعار الوقود غدا"
        r = o.run("narratives", csv=c, min_accounts=2); self.assertEqual([x["accounts"] for x in r["clusters"]], [["a1", "a2"]])
if __name__ == "__main__": unittest.main()



class TestOlevbaErrors(unittest.TestCase):
    def test_non_office_gives_arabic_error_and_keeps_detail(self):
        # generated benign fixture (ours): bytes that are not an Office file
        with tempfile.TemporaryDirectory() as d:
            f = os.path.join(d, "not_office.bin"); open(f, "wb").write(b"\xff\xd8\xff\xe0" + bytes(range(256)) * 8)
            r = o.run("olevba", path=f)
        self.assertFalse(r["ok"]); self.assertIn("Office", r["error"]); self.assertIn("FileOpenError", r["technical_detail"])

    def test_generated_benign_docx_reports_no_macro(self):
        # generated benign fixture (ours), not a real public file; proves the code path only, not macro detection
        import zipfile
        with tempfile.TemporaryDirectory() as d:
            f = os.path.join(d, "plain.docx")
            with zipfile.ZipFile(f, "w") as z:
                z.writestr("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
                z.writestr("word/document.xml", '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>')
            r = o.run("olevba", path=f)
        self.assertTrue(r["ok"], r); self.assertIn("لم يُعثر", r["macro_status"])
