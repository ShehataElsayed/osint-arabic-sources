"""Browser bridge: lets the unchanged Python tool logic use a JS ONNX engine (onnxruntime-web) without blocking.
Replay pattern: a tool calls embed()/nli.predict(); if the needed model outputs are not cached, NeedModel is raised with the token ids;
the host (JS) runs ONNX on those ids and calls provide(); the tool is then run again and finds the outputs in the cache.
Tokenizing, pooling, softmax and all tool logic stay in Python. The JS side only runs `ids -> tensor`."""
import json, numpy as np
from .tok_unigram import Unigram
class NeedModel(BaseException):
    def __init__(self, model, ids): self.model, self.ids = model, ids
ENABLED = set(); CACHE = {"e5": {}, "nli": {}}; _TOK = {}; HID = 384
def enable(model, tokenizer_path): ENABLED.add(model); _TOK[model] = Unigram(tokenizer_path)
_ACTIVE = False
def active(): return _ACTIVE
def tok(model): return _TOK[model]
def encode_pair(model, a, b, max_len=256):
    t = _TOK[model]; A = t.encode_raw(a); B = t.encode_raw(b); room = max_len - 3
    while len(A) + len(B) > room:
        if len(A) >= len(B): A = A[:-1]
        else: B = B[:-1]
    return tuple([t.cls] + A + [t.sep] + B + [t.sep])
def provide(model, ids_list, flat):
    flat = np.asarray(flat, dtype=np.float32); pos = 0
    for ids in ids_list:
        ids = tuple(ids)
        if model == "e5":
            n = len(ids) * HID; h = flat[pos:pos + n].reshape(len(ids), HID); pos += n
            v = h.mean(0); CACHE["e5"][ids] = v / np.linalg.norm(v)
        else:
            lg = flat[pos:pos + 3]; pos += 3; p = np.exp(lg - lg.max()); p /= p.sum()
            CACHE["nli"][ids] = dict(entailment=float(p[0]), neutral=float(p[1]), contradiction=float(p[2]))
def step(tool, kw_json):
    global _ACTIVE
    from . import run
    _ACTIVE = True
    try: return json.dumps({"done": run(tool, **json.loads(kw_json))}, ensure_ascii=False)
    except NeedModel as e: return json.dumps({"need": e.model, "ids": [list(x) for x in e.ids]})
    finally: _ACTIVE = False
