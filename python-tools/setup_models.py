"""Download and verify the two local models (pinned revisions + sha256). Usage: python setup_models.py [target_dir=~/models]
Needs: pip install onnxruntime tokenizers numpy. Weights are downloaded from Hugging Face and are not redistributed by this package."""
import hashlib, os, sys, urllib.request
T = os.path.expanduser(sys.argv[1] if len(sys.argv) > 1 else "~/models")
FILES = [
 ("e5", "Xenova/multilingual-e5-small", "761b726dd34fb83930e26aab4e9ac3899aa1fa78", "onnx/model_quantized.onnx", "model_quantized.onnx", "f80102d3f2a1229f387d3c81909990d8945513e347b0eab049f7de3c6f98c193"),
 ("e5", "Xenova/multilingual-e5-small", "761b726dd34fb83930e26aab4e9ac3899aa1fa78", "tokenizer.json", "tokenizer.json", "0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39"),
 ("nli", "Xenova/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7", "0864ced79bf1ef851bfaf9dd9de0aa54d735d9d0", "onnx/model_int8.onnx", "model_int8.onnx", "0e00534691cac71d2a9a0319bce19df9d7c6f003acea00bef9967560584c1a77"),
 ("nli", "Xenova/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7", "0864ced79bf1ef851bfaf9dd9de0aa54d735d9d0", "tokenizer.json", "tokenizer.json", "e23095eb61ba944c7be3a5d3e8ec19e37ce7ced0daa03550bde03e83c21b3f8a"),
]
def sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for c in iter(lambda: f.read(1 << 20), b""): h.update(c)
    return h.hexdigest()
for sub, repo, rev, path, name, want in FILES:
    d = os.path.join(T, sub); os.makedirs(d, exist_ok=True); out = os.path.join(d, name)
    if not (os.path.exists(out) and sha(out) == want):
        print("downloading", repo, path); urllib.request.urlretrieve(f"https://huggingface.co/{repo}/resolve/{rev}/{path}", out)
    ok = sha(out) == want; print(("OK   " if ok else "HASH MISMATCH ") + out)
    if not ok: os.remove(out); sys.exit(1)
print(f"Done. export OSHAI_E5_DIR={T}/e5 OSHAI_NLI_DIR={T}/nli (defaults are ~/models/e5 and ~/models/nli)")
