"""Precompute bge-m3 embeddings for the whole tool catalogue (one-time local step).

Why: the smart-search server semantic rerank embeds the query plus up to 12 lexical
candidates on Cloudflare Workers AI per request, and can only rerank what the keyword
pass already found. Shipping precomputed catalogue vectors lets the worker rank the
WHOLE catalogue from the query embedding alone: one model call per search instead of
thirteen, and no lexical pre-filter ceiling on which tools can surface.

Inputs:  _site/search-tools.json  (built by scripts/build.py -> build_content.py)
Outputs: site/tool-embeddings.json  (manifest: model, dims, count, fingerprint)
         site/tool-embeddings.bin   (layout: [count x float32 scales][count x dims x int8])

Run AFTER `npm run build` whenever the catalogue changes, then build again so the
pair deploys together. The fingerprint is sha256 of the exact search-tools.json bytes;
tests/semantic-assets.test.mjs fails the build when the pair is stale, and the worker
re-checks the fingerprint the client sends before ranking.

Model: BAAI/bge-m3, MIT license (https://huggingface.co/BAAI/bge-m3), run locally as the
int8 ONNX conversion from Xenova/bge-m3 (card license: mit, sentence_transformers graph =
CLS pooling + L2 normalization, the model's documented sentence-embedding recipe and the
same serving shape as Cloudflare Workers AI's @cf/baai/bge-m3). Generation runs fully
locally: zero Cloudflare quota. Parity between these vectors and the live worker's
embeddings is verified at release time on a bounded sample (docs/ai-evaluation.md);
ranking math is identical either way (cosine over L2-normalized vectors = dot product).

Quantization: per-vector symmetric int8 (scale = max|v| / 127). Roundtrip deviation is
printed and asserted below 0.002 mean |cos - 1|.
"""
import hashlib, json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / '_site' / 'search-tools.json'
MANIFEST = ROOT / 'site' / 'tool-embeddings.json'
BIN = ROOT / 'site' / 'tool-embeddings.bin'
MODEL_ID = 'BAAI/bge-m3'
CONVERSION = 'Xenova/bge-m3 onnx/sentence_transformers_int8.onnx'
CF_MODEL_ID = '@cf/baai/bge-m3'
BATCH = 8


def encode(texts):
    import onnxruntime as ort
    import numpy as np
    from tokenizers import Tokenizer
    from huggingface_hub import hf_hub_download
    onnx_path = hf_hub_download('Xenova/bge-m3', 'onnx/sentence_transformers_int8.onnx')
    tok = Tokenizer.from_file(hf_hub_download('Xenova/bge-m3', 'tokenizer.json'))
    tok.enable_truncation(max_length=512)
    tok.enable_padding()
    sess = ort.InferenceSession(onnx_path, providers=['CPUExecutionProvider'])
    out = []
    for i in range(0, len(texts), BATCH):
        chunk = texts[i:i + BATCH]
        enc = tok.encode_batch(chunk)
        ids = np.array([e.ids for e in enc], dtype=np.int64)
        mask = np.array([e.attention_mask for e in enc], dtype=np.int64)
        out.append(sess.run(['sentence_embedding'], {'input_ids': ids, 'attention_mask': mask})[0])
        if (i // BATCH) % 20 == 0:
            print(f'encoded {i + len(chunk)}/{len(texts)}', flush=True)
    v = np.concatenate(out).astype(np.float32)
    return v / np.linalg.norm(v, axis=1, keepdims=True)


def main():
    tools = json.loads(SRC.read_text(encoding='utf-8'))
    texts = [f"{t['name']}: {t['description']}" for t in tools]
    fp = hashlib.sha256(SRC.read_bytes()).hexdigest()[:16]

    import numpy as np
    vecs = encode(texts)
    count, dims = vecs.shape

    scales = np.abs(vecs).max(axis=1) / 127.0
    scales[scales == 0] = 1.0
    q = np.round(vecs / scales[:, None]).clip(-127, 127).astype(np.int8)

    deq = q.astype(np.float32) * scales[:, None]
    deq /= np.linalg.norm(deq, axis=1, keepdims=True)
    dev = np.abs((vecs * deq).sum(axis=1) - 1.0)  # |cos(original, dequantized) - 1|
    print(f'quantization: mean |cos-1| = {dev.mean():.6f}, max = {dev.max():.6f}')
    assert dev.mean() < 0.002, 'quantization error too high'

    with BIN.open('wb') as f:
        f.write(scales.astype('<f4').tobytes())
        f.write(q.tobytes())

    MANIFEST.write_text(json.dumps({
        'model': MODEL_ID,
        'conversion': CONVERSION,
        'license': 'mit (base model and conversion cards)',
        'cf_model': CF_MODEL_ID,
        'format': 'int8-symmetric-per-vector',
        'normalized': True,
        'dims': int(dims),
        'count': int(count),
        'fingerprint': fp,
        'texts': 'name + ": " + description, same shape as the semantic rerank candidates',
        'generated_by': 'scripts/build_embeddings.py (local, no Cloudflare quota)',
        'bin_sha256': hashlib.sha256(BIN.read_bytes()).hexdigest(),
    }, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'wrote {MANIFEST.name} ({count} x {dims}) and {BIN.name} ({BIN.stat().st_size} bytes), fingerprint {fp}')


if __name__ == '__main__':
    main()
