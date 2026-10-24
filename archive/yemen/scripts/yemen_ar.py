"""Arabic dictionaries for the Yemen map. Names of parties and governorates are fixed manual translations
(reviewed by a person, not machine translation). Anything not in these tables stays in its original language."""
GOV = {
 'Abyan':'أبين','Aden':'عدن','Amran':'عمران','‘Amrān':'عمران','Amānat al ‘Āşimah':'أمانة العاصمة','Bayda':'البيضاء','al-Bayḑā’':'البيضاء',
 'Dali':'الضالع','aḑ-Ḑāli‘':'الضالع','Dhamār':'ذمار','Hudaydah':'الحديدة','al-Ḩudaydah':'الحديدة','Ibb':'إب','Laḩij':'لحج','Marib':'مأرب',
 'Raymah':'ريمة','Shabwah':'شبوة','Socotra':'سقطرى',"Ta'izz":'تعز','Taiz':'تعز','al-Jawf':'الجوف','al-Mahrah':'المهرة','al-Maḩwīt':'المحويت',
 'Şan‘ā’':'صنعاء','Şa‘dah':'صعدة','Ḩajjah':'حجة','Ḩaḑramawt':'حضرموت','Hadramaut':'حضرموت','Sanaa':'صنعاء',"Sana'a":'صنعاء',
}
PARTY = {
 'Government of Yemen (North Yemen)':'حكومة اليمن (اليمن الشمالي، كما في تصنيف UCDP)','Forces of the Presidential Leadership Council':'قوات مجلس القيادة الرئاسي',
 'AQAP':'تنظيم القاعدة في جزيرة العرب','Ansarallah':'أنصار الله (الحوثيون)','Civilians':'مدنيون','IS':'تنظيم الدولة الإسلامية','STC':'المجلس الانتقالي الجنوبي',
 'Government of United Kingdom, Government of United States of America':'حكومتا المملكة المتحدة والولايات المتحدة','Islah':'حزب الإصلاح','Dar al-Hadith':'دار الحديث',
 'Government of Israel':'حكومة إسرائيل','Free Yemeni Army':'الجيش اليمني الحر','Alliance of Yemeni Tribes':'تحالف القبائل اليمنية','GPC':'المؤتمر الشعبي العام',
 'Abu al-Abbas Brigades':'ألوية أبو العباس','HTA':'حلف قبائل حضرموت','Giants Brigades, STC':'ألوية العمالقة (المجلس الانتقالي)',"Popular Committee - Rada'a":'اللجنة الشعبية - رداع',
 'Hamas':'حماس','Government of Iran':'حكومة إيران','Government of Eritrea':'حكومة إريتريا',
}
CAMEO = {
 '18':'اعتداء','19':'قتال','20':'عنف جماعي غير تقليدي','180':'اعتداء (غير محدد)','181':'خطف أو احتجاز','182':'اعتداء جسدي','183':'تفجير','184':'استخدام درع بشري',
 '185':'محاولة اغتيال','186':'اغتيال','190':'استخدام قوة عسكرية','191':'فرض حصار','192':'احتلال أرض','193':'قتال بأسلحة خفيفة','194':'قتال بالمدفعية والدبابات',
 '195':'استخدام أسلحة جوية','196':'انتهاك وقف إطلاق نار','200':'عنف جماعي (غير محدد)','201':'قتل جماعي','202':'إبادة عرقية','203':'قتل جماعي (غير محدد)',
}

GOV_EN_ALIASES = {  # English spellings seen in GDELT/GeoNames place strings -> Arabic governorate
 'abyan':'أبين','aden':'عدن','amran':'عمران','al bayda':'البيضاء','al-bayda':'البيضاء','bayda':'البيضاء','dhamar':'ذمار','dhamar governorate':'ذمار','ad dali':'الضالع','ad dali\'':'الضالع',
 'dhale':'الضالع','al hudaydah':'الحديدة','hodeidah':'الحديدة','hudaydah':'الحديدة','ibb':'إب','lahj':'لحج','lahij':'لحج','marib':'مأرب','raymah':'ريمة','shabwah':'شبوة','shabwa':'شبوة',
 'socotra':'سقطرى','sokotra':'سقطرى','taizz':'تعز','taiz':'تعز','ta\'izz':'تعز','al-jawf':'الجوف','al jawf':'الجوف','al mahrah':'المهرة','al-mahrah':'المهرة','al mahwit':'المحويت',
 'sanaa':'صنعاء','sana\'a':'صنعاء','sana\'':'صنعاء','sanaa governorate':'صنعاء','saada':'صعدة','sa\'dah':'صعدة','saadah':'صعدة','hajjah':'حجة','hadramawt':'حضرموت','hadhramaut':'حضرموت','hadramout':'حضرموت',
}
def _k(x):
    import re as _r
    return _r.sub(r'\s+', ' ', _r.sub(r'[^a-z ]', '', x.lower().replace('-', ' '))).strip()
_GA = {_k(k): v for k, v in GOV_EN_ALIASES.items()}
def gov_from_place(full):
    import re as _re
    parts = [_k(x) for x in full.split(',')]
    for x in parts[1:] + parts[:1]:
        x = _re.sub(r'\s+governorate$', '', x)
        if x in _GA: return _GA[x]
    return ''
# Manual Arabic names for places GeoNames could not match by name (checked by hand; extend as needed).
PLACE_OVERRIDES = {
 'lahj': 'لحج', 'mokha': 'المخا', 'taizz': 'تعز', 'al jawf': 'الجوف', 'jawf': 'الجوف', 'aden governorate': 'محافظة عدن', 'al hazm': 'الحزم',
 'hodeidah international': 'مطار الحديدة الدولي', 'jabal habashi': 'جبل حبشي', 'sanaa': 'صنعاء', 'marib': 'مأرب', 'hajjah': 'حجة', 'dhamar': 'ذمار',
}
import unicodedata as _ud, re as _re
def norm(s):
    s = _ud.normalize('NFKD', s.lower()); s = ''.join(c for c in s if not _ud.combining(c))
    s = _re.sub(r"[\u2019\u02bb\u02bc'`\u2018\u02be\u02bf?\-.]", '', s); s = _re.sub(r'\s+', ' ', s).strip()
    s = _re.sub(r'^(al|ad|ar|as|ash|at|az|an|el) ', '', s)
    return s
