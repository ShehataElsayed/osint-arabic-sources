# OshAi investigation tools (private prototype, 26 tools)
Python standard library for 21 tools; 3 tools (semcheck, narratives, topics) and the optional dense mode of `ask` use two local ONNX models. No keys, no paid services, no network at run time after setup.

## Quick start (tested on Linux, Python 3.10; Windows/macOS not tested)
1. Unzip, `cd oshai_tools`.
2. `python3 -m venv venv && . venv/bin/activate` (Windows: `venv\Scripts\activate`).
3. Optional models (needed only for semcheck, narratives, topics, semantic ask): `pip install -r requirements.txt` (exact pins: numpy 2.2.6, onnxruntime 1.23.2, tokenizers 0.23.3; Pillow 11.3.0 is only for imghash) then `python setup_models.py` (about 435 MB; about 30 s on a datacenter link). Without it, 21 tools and BM25 `ask` still work and the model tools say clearly that the model is missing.
4. `python -m oshai_tools.server` and open http://127.0.0.1:8765.
Tested fresh on 2026-10-26: new venv (numpy 2.2.6, onnxruntime 1.23.2, tokenizers 0.23.3), model download with hash check, 37 tests, server API click-through.

## Run
1. `python -m oshai_tools list`                 list tools
2. `python -m oshai_tools numdiff claim="..." source="..."`   or pipe text: `cat file.txt | python -m oshai_tools claims`
3. `python -m oshai_tools.server`               open http://127.0.0.1:8765 (local only)
File tools (`exif`, `evidence`) run from the command line: `python -m oshai_tools exif path=photo.jpg`.
Open a tool directly: http://127.0.0.1:8765/#semcheck ; add `?demo` for labelled synthetic sample data.

## Model setup (optional; needed for semcheck, narratives, topics, semantic ask)
`pip install onnxruntime tokenizers numpy` then `python setup_models.py` (downloads ~435 MB from Hugging Face, verifies pinned sha256). See MODELS.md for provenance and licence status. Do not republish the weights.
Memory (measured on a 2 GB Linux sandbox, not on any user device): models run one at a time, peak ~730 MB on a 30-passage run.

## Tests
`python -m unittest discover -s tests` (37 tests; model tests skip if models are absent). `python evals/run_eval.py` runs the small semantic smoke set. See evals/README.md for measured limits.

## What it does NOT do
No tool decides true/false. Semantic tools find topic matches and flag possible conflicts; no flag means nothing. No generative AI is included. Nothing is deployed; GitHub Pages cannot run Python.

## Inventory
Rule-based (23): quotecheck, imghash (Pillow, perceptual hash), claims, quotes, numdiff, entities, timeline, tone, hedging, ngrams, redact, similar, urlcheck, urlclean, hijri, exif, evidence, coord, benford, profile, headers, ask (BM25), case (pipeline).
Local-model (3 + ask dense): semcheck, narratives, topics.
