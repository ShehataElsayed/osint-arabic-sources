# Third-party material and license audit

This is a descriptive inventory of what is in the repository when it was written. It is not legal advice. The license layers are defined in [LICENSE](../LICENSE): original code under Apache License 2.0 ([LICENSE-APACHE](../LICENSE-APACHE)), original Arabic content and design under CC BY-SA 4.0, and third-party material under its own license.

| Material | Location | License | Owner / source | Effect on any new license |
|---|---|---|---|---|
| Source tree derived from OSINT Framework | `2-data.json` and the generated category pages | MIT | Justin Nordine, https://github.com/lockfale/osint-framework | Stays MIT. The license text and copyright notice must stay with copies. Original Arabic content can be added on top under another license, but the derived part itself cannot be relicensed. |
| Fact-check snippet index | `site/rag-factchecks.json` | CC BY-NC-SA 4.0 | claimreview-data by Martino Mensio, https://github.com/MartinoMensio/claimreview-data. Text rights remain with the fact-checkers | Stays CC BY-NC-SA 4.0: attribution, non-commercial, share-alike. It cannot go under a commercial license or one without share-alike. It is credited in its `meta` and in the methodology page. AFP items were excluded. |
| Pagefind search engine | `site/Pagefind-LICENSE`, build output | MIT | Pagefind | Stays MIT. |
| Cairo font | `site/site/Cairo.ttf`, `site/Cairo-OFL.txt` | SIL OFL 1.1 | The Cairo Project Authors | Stays OFL. Cannot be sold alone or relicensed. |
| Libraries loaded on demand | Pyodide, ExcelJS, webR, Transformers.js and the Xenova multilingual model, loaded from the network | Their own licenses | Their authors | Not in the repository. Check their licenses before redistributing. |
| `site/LICENSE` | inside `site/` | MIT, copyright Justin Nordine | OSINT Framework | Leftover from the derived source. Keep it. |
| Tool, service and brand names | `data/libs.json`, `data/aitools.json`, the map | n/a | Trademark owners | Names and links grant no rights in their marks. |

## What this means

- Apache 2.0 applies to the original code only: `worker/`, `scripts/`, `tests/` and the site JavaScript written for this project. It does not apply to `site/index.html` (derived from the upstream OSINT source tree), the data files, or third-party files.
- The Arabic content and design stay under CC BY-SA 4.0. Apache 2.0 is a software license and does not suit editorial text.
- A blanket relicense would not change the third-party licenses: the OSINT-derived map stays MIT, the fact-check index stays CC BY-NC-SA 4.0 (non-commercial), and the font stays OFL.
- There is no "Apache 2.5". The latest version is Apache License 2.0.
- 12 old ZIP archives were removed from the repository root in the same pull request. They remain in git history. Their contents were not inspected and may include earlier third-party material.

## Non-commercial use

The fact-check index is non-commercial. Any commercial use or republication of the site needs that index removed or permission from its rights holders.
