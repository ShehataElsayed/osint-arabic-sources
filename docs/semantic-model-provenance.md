# Semantic re-rank model provenance (verified 2026-10-29)

Scope: the experimental on-device semantic re-rank in `site/smart-search.html`
(button "رتّب النتائج دلاليًا على جهازي"). This note records what the deployed
artifact actually is, pinned where possible, with the API evidence checked on
2026-10-29 (EEST).

## Runtime
- Library: `@huggingface/transformers@3.8.1`, loaded from jsDelivr
  (`https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm`).
  Version-pinned by the CDN URL.
- Model: `Xenova/paraphrase-multilingual-MiniLM-L12-v2`, quantized ONNX
  (`dtype: 'q8'`).
- Revision: pinned in code to commit
  `2c4055b12046f11709e9df2c122e59ffbdc2f900` (HF API `sha`, lastModified
  2025-07-22T00:07:45Z). Before 2026-10-29 the call used the floating `main`
  revision; pinned in PR #114.
- Observed first-download size in a real Chromium session: 139,765,859 bytes
  (~140MB, disclosed to the user before they start the download). After the
  first download a second semantic turn ran fully offline (network blocked),
  confirming inference is on-device and queries do not leave the device.

## License
- Mirror repo (Xenova/paraphrase-multilingual-MiniLM-L12-v2): declares
  `base_model: sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`;
  its file tree contains NO LICENSE file and its card has NO license field
  (HF API `license: null`; file list and README checked 2026-10-29). It is a
  format conversion (ONNX/quantized weights) for transformers.js.
- Owning base repo (sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2,
  sha `e8f8c211226b894fcb81acc59f3b34ba3efd5f42`): the card YAML itself
  declares `license: apache-2.0` (README frontmatter line 53, checked
  2026-10-29). The sentence-transformers source repository
  (UKPLab/sentence-transformers) ships the Apache License 2.0 text.
- Assessment: the weights derive from an artifact whose owning repo declares
  Apache-2.0, which permits redistribution with notice. The mirror not
  restating terms is a provenance gap, not a confirmed conflict. We keep
  this note as the notice record and attribute both repos here; if Xenova's
  card later declares different terms, this note must be revisited.
- Retrieval-side changes in PR #115 (stemmer consistency, vocabulary pairs,
  concept coverage, rank fusion) are model-agnostic and unaffected.

## Runtime compatibility evidence
- Chromium (headless shell 1248, desktop and 320/390px viewports): model
  downloads, re-rank turn renders, abstention path intact.
- Weak-device behavior: load failure path renders an honest Arabic error
  ("تعذر تشغيل النموذج على هذا الجهاز") instead of hanging; not benchmarked
  on real low-end hardware.

## What this model is NOT
- Not a factual QA or answer model. It re-ranks the lexical search candidates
  by embedding similarity between the query and each tool's name+description
  in the guide. Scores are not calibrated confidence.

## Server-side full-catalogue ranking (added 2026-10-30)

Scope: the "رتّب النتائج" button's primary path now ranks the whole catalogue on the guide's Cloudflare worker (mode `semantic_catalog`), not only the top-12 keyword candidates.

- Catalogue asset: `site/tool-embeddings.json` + `site/tool-embeddings.bin`, generated locally by `scripts/build_embeddings.py` from the exact built `_site/search-tools.json` bytes (manifest fingerprint = sha256[:16]; CI fails the deploy if they drift, `tests/semantic-catalog.test.mjs`).
- Encoding model: `Xenova/bge-m3`, file `onnx/sentence_transformers_int8.onnx` (int8 ONNX conversion of `BAAI/bge-m3`, dims 1024, mean pooling, L2-normalized). License: MIT on all three cards (BAAI/bge-m3, Xenova/bge-m3, onnx-community/bge-m3-ONNX; checked via HF API 2026-10-29).
- Quantization: symmetric int8 per vector with a float32 scale; layout `[count x f32 scales][count x dims x int8]`; measured deviation from fp32 on the full catalogue: mean |cos - 1| = 0.000149, max 0.000400.
- Query embedding at runtime: Workers AI `@cf/baai/bge-m3` (the worker's existing embed binding), so only the question text is embedded per request; catalogue vectors are fetched from the Pages asset and cached per isolate for 5 minutes.
- Parity: the local ONNX int8 conversion and Workers AI `@cf/baai/bge-m3` are the same base model but not bit-identical; release-time parity is checked on a bounded sample and recorded in `docs/deployment.md`.
- Atomic safety: the manifest carries `bin_sha256`; the worker verifies the fetched bin against it on every cold load and fails closed (`catalog_unavailable`) on any mismatch, so a Pages deploy landing between the two asset fetches cannot produce a mixed-generation index. The per-isolate cache (5 minutes) revalidates the manifest fingerprint.
- Privacy: only the question text is sent to the worker; tool descriptions never leave the deployed asset. The on-device MiniLM path above remains available as an explicit fallback.
