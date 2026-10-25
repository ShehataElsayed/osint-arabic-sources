# Local no-key AI candidates — investigation log (2026-10-25)

Constraint: free-only, no keys, no accounts, browser-local execution preferred
(Hugging Face paid-inference exclusion does not cover browser-local models that
download once and run on the user's device). Status: investigation only —
nothing integrated.

## Already shipped (local, no key)
- Arabic OCR: Tesseract (ara) in-browser; verified verbatim match on a real
  scan in the v3 preview package.
- Data lab: DuckDB-WASM aggregation/filtering on local CSV/JSON, files never
  leave the device.

## Candidate 1: Arabic NER in the data lab (entities from Arabic documents)
- Model: onnx-community/arabic-ner-ONNX (transformers.js token-classification,
  base: hatmimoha/arabic-ner, BERT-based, PERSON/ORG/LOC per base card).
- Fit: journalists paste or load an Arabic text in the data lab and extract
  people/organizations/places locally; pairs naturally with the existing
  zero-upload posture.
- Verified: model exists, official ONNX-community conversion, transformers.js
  usage documented (https://huggingface.co/onnx-community/arabic-ner-ONNX).
- BLOCKER: license undeclared on both the ONNX card (API license field: none)
  and the base model card. Do NOT integrate until a license is confirmed or
  the author clarifies. Also unverified: quantized size / load time on
  low-end devices, entity quality on journalistic MSA+dialect text.

## Candidate 2: multilingual NER fallback — HELD
- Xenova/bert-base-multilingual-cased-ner-hrl: license ALSO undeclared on the
  card (checked 2026-10-25). Held on the same bar.
- arabic-ner-ONNX sizes (HF API): smallest quantized build 98.3 MB (q4f16),
  int8 111 MB — heavy but comparable to the OCR bundle pattern, gated behind
  an explicit download. License still the blocker.
- HF transformers.js search (2026-10-25) lists exactly ONE Arabic NER model;
  alternatives would require converting a licensed PyTorch model ourselves.

## Candidate 3 (LEADING, license cleared): local semantic search for the guide
- Xenova/multilingual-e5-small: browser-local embeddings via transformers.js.
  Base model intfloat/multilingual-e5-small is MIT-licensed (verified via HF
  API 2026-10-25, license:mit tag). The ONNX conversion card declares no
  license of its own; it is a derivative of the MIT base — record this chain
  in the doc if shipped.
- Sizes (HF API): int8/quantized ~118 MB, q4f16 205 MB, fp32 470 MB.
- Fit: semantic ("meaning") search over the guide's own Arabic tool
  descriptions and fact-check index, on-device, no key — complements the
  keyword pagefind search rather than replacing it.
- NOT shipped: needs prototype + actual UI/runtime evidence (load time,
  memory on mid-range phone, Arabic query quality) before any claim.

## Next steps when picked up
1. Prototype candidate 3 (MIT base): load time + memory on a mid-range
   phone; gate behind an explicit user action like the OCR bundle download.
2. Quality check on real journalistic Arabic queries before any UI promise.
3. For NER candidates 1-2: only author clarification or a LICENSE file
   unblocks; otherwise convert a licensed PyTorch Arabic NER ourselves.
