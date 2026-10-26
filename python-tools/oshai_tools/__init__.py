from .core import REGISTRY
from . import t_text, t_data, t_ext
from . import workflow as _wf
from . import t_ai
from . import ai
def run(tool_id, **kw):
    t = REGISTRY.get(tool_id)
    if not t: return {"ok": False, "error": "أداة غير معروفة: " + tool_id}
    try: return t["run"](**kw)
    except TypeError as e: return {"ok": False, "error": "مدخلات ناقصة: " + str(e)}
    except (ValueError, KeyError) as e: return {"ok": False, "error": "مدخلات غير صالحة: " + type(e).__name__}
