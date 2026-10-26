"""Local multilingual NLI: mDeBERTa-v3-base xnli (MoritzLaurer, MIT upstream) int8 ONNX via Xenova conversion. premise=source passage, hypothesis=claim."""
import os, numpy as np
_S = {}
def _dir(): return os.environ.get("OSHAI_NLI_DIR", os.path.expanduser("~/models/nli"))
def available():
    from . import bridge
    if bridge.active(): return "nli" in bridge.ENABLED
    try:
        import onnxruntime, tokenizers  # noqa
    except Exception: return False
    return os.path.isfile(os.path.join(_dir(), "model_int8.onnx")) and os.path.isfile(os.path.join(_dir(), "tokenizer.json"))
def _load():
    if not _S:
        import onnxruntime as ort; from tokenizers import Tokenizer
        so = ort.SessionOptions(); so.intra_op_num_threads = 2
        _S["s"] = ort.InferenceSession(os.path.join(_dir(), "model_int8.onnx"), so, providers=["CPUExecutionProvider"])
        t = Tokenizer.from_file(os.path.join(_dir(), "tokenizer.json")); t.enable_truncation(256); t.enable_padding(); _S["t"] = t; _S["in"] = {i.name for i in _S["s"].get_inputs()}
    return _S
def predict(pairs):
    """pairs: [(premise, hypothesis)] -> [{entailment, neutral, contradiction}]"""
    from . import bridge
    if bridge.active():
        ids = [bridge.encode_pair("nli", a, b) for a, b in pairs]; C = bridge.CACHE["nli"]
        miss = list(dict.fromkeys(k for k in ids if k not in C))
        if miss: raise bridge.NeedModel("nli", miss)
        return [C[k] for k in ids]
    S = _load(); out = []
    for i in range(0, len(pairs), 2):
        enc = S["t"].encode_batch(pairs[i:i+2])
        ids = np.array([e.ids for e in enc], dtype=np.int64); am = np.array([e.attention_mask for e in enc], dtype=np.int64)
        feed = {"input_ids": ids, "attention_mask": am}
        if "token_type_ids" in S["in"]: feed["token_type_ids"] = np.zeros_like(ids)
        lg = S["s"].run(None, feed)[0]; p = np.exp(lg - lg.max(1, keepdims=True)); p /= p.sum(1, keepdims=True)
        out += [dict(entailment=float(r[0]), neutral=float(r[1]), contradiction=float(r[2])) for r in p]
    return out

def unload():
    import gc; _S.clear(); gc.collect()
