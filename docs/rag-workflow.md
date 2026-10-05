# RAG verification workflow

This file replaced an older design note. The current behavior (always answer with a confidence level, source fetching, link repair, search-found sources, identity checks, honest limits) is described in Arabic in [how-verification-works.md](how-verification-works.md).

Standing rules that still hold:
- Official Google APIs only; no Google scraping.
- No AFP, Misbar or AraFacts corpus text. Fact-check items are a short snippet plus a link.
- `validated_for_release=false` in code and docs. No "verified" or "100%" claims without a measured basis.
- No accuracy figure applies to this gate; the 84.1 and 93.2 figures belong to the original NewsRAG library.
