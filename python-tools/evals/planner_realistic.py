"""Longer, messier case descriptions in the style a desk journalist might write. Written by the same author as the training data (not independent), after training, and NEVER used for training. Reports top-1 and top-2 and lists failures."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from oshai_tools import t_planner as P, planner_model as M
CASES = [
 ("quote", "وصلني تقرير من موقع محلي يقول إن المتحدث باسم الوزارة قال إن الأزمة انتهت، وعندي تسجيل المؤتمر مفرغا. هل هذه الجملة موجودة فعلا؟"),
 ("numbers", "الخبر يقول إن الصادرات ارتفعت 12 في المئة بينما جدول الإحصاء الرسمي يعطي رقما مختلفا لنفس الربع. أحتاج أن أعرف أين الفرق"),
 ("image", "صورة لحريق انتشرت اليوم ويقول ناشروها إنها من الحادث، أريد أن أعرف هل لها بيانات تصوير وهل هي نسخة مصغرة من صورة قديمة عندي"),
 ("link", "صفحة خبر عاجل على فيسبوك تحتوي رابطا طويلا بمعاملات كثيرة، أريد رابطا نظيفا وأريد حفظ الصفحة قبل أن يحذفها ناشرها"),
 ("domain", "وصلتنا رسائل من موقع اسمه يشبه اسم مؤسستنا بحرف واحد مختلف، أريد قائمة بما يمكن أن يسجله المنتحل من أسماء قريبة"),
 ("entities", "عندي مئة صفحة من محاضر المحكمة وأريد استخراج الأسماء والجهات وترتيب الأحداث بتواريخها، وبعض التواريخ هجرية"),
 ("document", "أرسل لي مصدر ملف إكسل فيه ميزانية الوزارة ولا أثق به، أريد معرفة هل فيه ماكرو قبل أن أفتحه على جهازي"),
 ("data", "عندي ملف csv فيه آلاف الصفوف من عقود حكومية وأريد ملخصا سريعا لأعمدته ومعرفة هل الأرقام تبدو طبيعية"),
 ("headers", "تلقيت رسالة تدعي أنها من بنك وفيها رابط، أريد تحليل الترويسة الخام لمعرفة الخوادم التي مرت بها"),
 ("redact", "سأشارك محضر مقابلة مع زميل في الخارج وفيه أرقام هواتف وأسماء شهود، أريد حجب البيانات الشخصية قبله"),
 ("tone", "خطاب الرئيس طويل وأريد استخراج الجمل التي تحمل ادعاءات يمكن التحقق منها وتمييزها عن الإنشاء والعبارات المتحفظة"),
 ("case", "بدأت تحقيقا عن شركة وسيط عقارات وعندي ملفات وروابط وملاحظات، أريد طريقة لتسجيلها مع بصمة كل ملف وتتبع ما راجعته"),
 ("quote", "Our reporter heard the governor say 'we will not raise taxes' but the written transcript seems different; I need to compare them"),
 ("image", "A reader sent two photos of the same protest and claims one is from last year. Are they the same file resized?"),
 ("numbers", "The ministry says unemployment is 7.1% but the news site wrote 9.4%. Which numbers disagree with the release?"),
 ("link", "Suspicious shortened link in a WhatsApp group claiming to be our newspaper, I want to clean and archive it"),
 ("tone", "Find which sentences in the minister's speech are factual claims worth checking"),
 ("headers", "an email with a strange sender, I want to see the received chain and spf result"),
 ("data", "mixed hospitals dataset with possible duplicate names and odd coordinates"),
 ("entities", "list the people and places in the leaked memo and put events in order"),
 ("document", "word file attached to an unknown email asking me to enable content"),
]
if __name__ == "__main__":
    t1 = t2 = 0; bad = []
    for c, x in CASES:
        p, _ = P.scores(M.MODEL, x); o = sorted(p, key=p.get, reverse=True)
        t1 += o[0] == c; t2 += c in o[:2]
        if o[0] != c: bad.append((c, o[0], round(p[o[0]], 2), x[:60]))
    print("realistic-style (same author, not trained on): top1 %d/%d top2 %d/%d" % (t1, len(CASES), t2, len(CASES)))
    for b in bad: print("FAIL", b)
