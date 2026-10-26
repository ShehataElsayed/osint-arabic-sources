"""Shared core: registry, Arabic text helpers. Standard library only."""
import re, unicodedata
REGISTRY = {}
def tool(id, name_ar, name_en, desc_ar, inputs, ai=False):
    def deco(fn):
        REGISTRY[id] = dict(id=id, name_ar=name_ar, name_en=name_en, desc_ar=desc_ar,
                            inputs=inputs, ai=ai, run=fn)
        return fn
    return deco
AR_DIAC = re.compile(r'[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]')
EAST = str.maketrans('٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789')
def to_ascii_digits(s): return s.translate(EAST)
def normalize_ar(s, strip_diac=True):
    s = unicodedata.normalize('NFKC', s)
    if strip_diac: s = AR_DIAC.sub('', s)
    s = re.sub('[إأآٱ]', 'ا', s).replace('ى', 'ي').replace('ة', 'ه')
    return re.sub(r'\s+', ' ', s).strip()
def sentences(s):
    parts = re.split(r'(?<=[.!?؟।\n])\s+|\n+', s)
    return [p.strip() for p in parts if p.strip()]
STOP_EN = set('the a an of to in on at for and or is are was were be been it its this that with as by from today'.split())
STOP = STOP_EN | set(normalize_ar("في من على الى عن مع هذا هذه ذلك التي الذي ان أن إن كان كانت قد لا ما هو هي هم او أو ثم كما لقد بعد قبل بين حتى كل بعض لم لن هل و").split())
def words(s):
    return re.findall(r'[\u0600-\u06FFA-Za-z0-9]+', to_ascii_digits(s))
def err(msg): return {"ok": False, "error": msg}
