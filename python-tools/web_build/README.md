# Static browser build (Pyodide)
Build: `npm i pyodide@0.27.7 puppeteer-core`, fetch the numpy and pillow wheels listed in THIRD_PARTY/NOTICES.md into node_modules/pyodide/, then `python web_build/make_web.py node_modules/pyodide out/` (needs /tmp/pyodide-LICENSE.txt and /tmp/cpython-LICENSE.txt, the licence texts, to be present).
Tests (serve out/ on :8765 first): test_all_tools.mjs (each tool's demo runs), test_files.mjs (file picker, size limit, no external requests, CSP blocks an external fetch), test_timeout.mjs (needs a copy served on :8766 with LIM=40 patched in index.html; checks deadline + engine restart), test_screenshots.mjs.
Limits: 100,000 characters per field (case 20,000, similar 30,000), 20 MB of files, 30 s per run, then the worker is killed and restarted.
Model tools (semcheck, narratives, topics) are not available here: onnxruntime and tokenizers are not in Pyodide 0.27.7.
