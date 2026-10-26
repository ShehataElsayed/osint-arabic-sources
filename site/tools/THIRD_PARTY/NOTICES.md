# Third-party components in this bundle (unmodified, self-hosted)
- Pyodide 0.27.7 (py/pyodide.js, pyodide.asm.js, pyodide.asm.wasm, python_stdlib.zip): MPL-2.0, see Pyodide-MPL-2.0.txt. Source: https://github.com/pyodide/pyodide/tree/0.27.7 . Files are the npm package pyodide@0.27.7 unchanged.
- CPython 3.12 (inside Pyodide): PSF licence, see CPython-PSF.txt.
- numpy 2.0.2 wheel (py/numpy-*.whl), from the Pyodide 0.27.7 distribution, sha256 ebb61241d962b98b21597d7ce43b67668a6d5bab3acec4fbe958657320d7cd08: BSD-3-Clause plus bundled notices, see numpy-LICENSE.txt.
- Pillow 10.2.0 wheel (py/pillow-*.whl), from the Pyodide 0.27.7 distribution, sha256 43eab147a9355385a99eeac18fb577d4af2fe4bd0bbd23d3ba3ddb92e72c2815: HPND (MIT-CMU), see pillow-LICENSE.txt. Used only by imghash and exif.
- Cairo font (static/Cairo.ttf): SIL OFL 1.1, see Cairo-OFL.txt.
- Vendored pure-Python wheels from PyPI, unmodified (py/ not used; see vendor/): dnstwist 20250130 (Apache-2.0, used by the dnstwist tool), oletools 0.60.2 and olefile 0.47 (BSD, used by olevba), pyparsing 3.3.3 (MIT), colorclass 2.2.2 (MIT), easygui 0.98.3 (BSD). Their LICENSE files found in the wheels are in THIRD_PARTY/ as <name>-LICENSE*. Check each file's header before relying on this summary.
- No machine-learning model weights are included.
Sources of the OshAi Python tools: oshai.zip contains the readable .py files; build script: web_build/make_web.py.
