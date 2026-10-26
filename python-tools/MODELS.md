# Local model recipe (weights are NOT bundled; fetch privately and verify hashes)
Checked 2026-10-26 via the HF API.

| Role | File | Source repo @ revision | sha256 |
|---|---|---|---|
| Retrieval | model_quantized.onnx (118,308,185 B) | Xenova/multilingual-e5-small @ 761b726dd34fb83930e26aab4e9ac3899aa1fa78 | f80102d3f2a1229f387d3c81909990d8945513e347b0eab049f7de3c6f98c193 |
| Retrieval | tokenizer.json | same | 0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39 |
| NLI | onnx/model_int8.onnx (317,250,309 B) | Xenova/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7 @ 0864ced79bf1ef851bfaf9dd9de0aa54d735d9d0 | 0e00534691cac71d2a9a0319bce19df9d7c6f003acea00bef9967560584c1a77 |
| NLI | tokenizer.json | same | e23095eb61ba944c7be3a5d3e8ec19e37ce7ced0daa03550bde03e83c21b3f8a |

Download: https://huggingface.co/<repo>/resolve/<revision>/<path>  Install: pip install onnxruntime tokenizers numpy.
Env: OSHAI_E5_DIR (model_quantized.onnx + tokenizer.json), OSHAI_NLI_DIR (model_int8.onnx + tokenizer.json).

Licensing (provenance, not legal advice):
- intfloat/multilingual-e5-small @ 614241f6...: HF license field `mit`.
- MoritzLaurer/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7 @ b5113eb3...: `mit` and a LICENSE file; trained on XNLI/multilingual NLI data whose own terms were not reviewed.
- The Xenova ONNX conversion repos declare NO license of their own; they state the upstream repo as base_model. Treat redistribution of converted weights as unresolved until confirmed. Download privately, give attribution, do not republish the weights in a public repo or release.
