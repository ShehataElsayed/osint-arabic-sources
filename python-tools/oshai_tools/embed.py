"""Local semantic embeddings: multilingual-e5-small (MIT, intfloat) quantized ONNX via onnxruntime. CPU, no network at run time.
Model files are looked up in $OSHAI_E5_DIR or ~/models/e5. Missing model => available() is False and AI tools say so."""
import os, numpy as np
_S = {}
def _dir(): return os.environ.get("OSHAI_E5_DIR", os.path.expanduser("~/models/e5"))
def available():
    from . import bridge
    if bridge.active(): return "e5" in bridge.ENABLED
    try:
        import onnxruntime, tokenizers  # noqa
    except Exception: return False
    return os.path.isfile(os.path.join(_dir(), "model_quantized.onnx")) and os.path.isfile(os.path.join(_dir(), "tokenizer.json"))
def _load():
    if not _S:
        import onnxruntime as ort; from tokenizers import Tokenizer
        so = ort.SessionOptions(); so.intra_op_num_threads = 2
        _S["s"] = ort.InferenceSession(os.path.join(_dir(), "model_quantized.onnx"), so, providers=["CPUExecutionProvider"])
        t = Tokenizer.from_file(os.path.join(_dir(), "tokenizer.json")); t.enable_truncation(256); t.enable_padding()
        _S["t"] = t; _S["in"] = {i.name for i in _S["s"].get_inputs()}
    return _S
def embed(texts, kind="passage", bs=16):
    from . import bridge
    if bridge.active():
        ids = [tuple(bridge.tok("e5").encode(f"{kind}: {x}", 256)) for x in texts]; C = bridge.CACHE["e5"]
        miss = list(dict.fromkeys(k for k in ids if k not in C))
        if miss: raise bridge.NeedModel("e5", miss)
        return np.vstack([C[k] for k in ids])
    S = _load(); out = []
    for i in range(0, len(texts), bs):
        enc = S["t"].encode_batch([f"{kind}: {x}" for x in texts[i:i+bs]])
        ids = np.array([e.ids for e in enc], dtype=np.int64); am = np.array([e.attention_mask for e in enc], dtype=np.int64)
        feed = {"input_ids": ids, "attention_mask": am}
        if "token_type_ids" in S["in"]: feed["token_type_ids"] = np.zeros_like(ids)
        h = S["s"].run(None, feed)[0]; m = am[..., None].astype(np.float32)
        v = (h * m).sum(1) / m.sum(1); v /= np.linalg.norm(v, axis=1, keepdims=True); out.append(v)
    return np.vstack(out)

def unload():
    import gc; _S.clear(); gc.collect()
