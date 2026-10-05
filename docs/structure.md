# Repository structure

| Path | Contents |
|---|---|
| `site/` | Site source: HTML, JS, CSS, Cairo font. `site/index.html` is a template filled with data at build time. |
| `2-data.json` | Category and source tree of the main map. Derived from OSINT Framework (see [licenses.md](licenses.md)). |
| `data/libs.json` | Analysis libraries and their explanations. |
| `data/aitools.json` | AI tools catalog. |
| `3-review-queue.json` | Review backlog for links. Not a certificate that they work. |
| `site/rag-factchecks.json` | Index of fact-check snippets (from claimreview-data, AFP excluded). Fields: claim, rating, link, short snippet. |
| `worker/` | Cloudflare Worker: `verify`, `recommend`, `compose`, `plan` modes and the default lookup. `wrangler.toml` is the deploy config. |
| `scripts/build.py` | Builds `_site/` from `site/`, injects data, adds license files. |
| `scripts/build_content.py` | Generates category pages. |
| `scripts/build_factcheck_index.py` | Builds the fact-check index and applies the block list. |
| `tests/` | Structure tests (Python), RAG and Worker logic (Node), browser smoke test. |
| `docs/` | Documentation. |
| `.github/workflows/deploy.yml` | Builds, tests and deploys to GitHub Pages on merge to `main`. |

Two odd paths in `site/`: `site/site/Cairo.ttf` (the build copies the font from there) and `site/ite/index.htmls` (an old unused file). Both are left as they are because the build depends on the first.
