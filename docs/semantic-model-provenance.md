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
- The mirror card (Xenova/paraphrase-multilingual-MiniLM-L12-v2) declares
  `base_model: sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`
  and carries NO license field of its own (HF API `license: null`,
  checked 2026-10-29). It is a format conversion (ONNX/quantized weights)
  for transformers.js.
- The base model card (sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2)
  is tagged `license:apache-2.0` (HF API tags, checked 2026-10-29; base sha
  `e8f8c211226b894fcb81acc59f3b34ba3efd5f42`).
- Standing caveat, same bar as `docs/free-ai-local-candidates.md`: the mirror
  itself does not restate a license. The Apache-2.0 tag on the exact base
  model it converts is the strongest available evidence of redistribution
  terms; if a stricter reading is required, treat the semantic re-rank the
  same way as the held NER candidates until Xenova's card declares a license.

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
