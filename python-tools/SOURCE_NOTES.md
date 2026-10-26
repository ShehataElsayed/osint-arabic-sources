# Source notes

This folder is the readable source of the Python tools that run in the browser at `site/tools/`. It is not served by the site.

- `oshai_tools/` is the Python package. `tests/test_tools.py` holds its unit tests (`python -m unittest` from this folder).
- `web_build/make_web.py` builds the Pyodide bundle. See `web_build/README.md` for the recipe. The `.mjs` files are the headless-browser tests.
- Left out of this repo to keep it lean: the vendored wheels (`make_web.py` expects them in `web_build/wheels/`; the same files are in `site/tools/vendor/`), the Cairo font (OFL, in `site/tools/static/`), a small benign test fixture (`sample_with_vba.ppt`), and the evaluation scripts. The runtime license texts are in `site/tools/THIRD_PARTY/`.
- No model weights are included. `setup_models.py` and `MODELS.md` describe an optional local model download used by 3 tools that are unavailable in the browser build.
