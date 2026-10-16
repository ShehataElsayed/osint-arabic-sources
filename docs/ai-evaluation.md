# Retrieval and grounding evaluation

These numbers come from small, self-authored Arabic test sets. They show whether a change helped on those sets. They are not an accuracy estimate for real use, and they say nothing about the external model. `validated_for_release` stays `false`.

Reproduce: `npm run build`, then `node tests/tool-search.eval.mjs _site/search-tools.json` and `node tests/grounding.eval.mjs`.

## 1. Smart search: candidate retrieval (`site/tool-search.js`)

Change: light Arabic stemming, a small Arabic-to-name vocabulary table, BM25-style scoring over the full description and the tool name, and abstention when the query has no known task vocabulary or the best score is weak. The previous method matched only the name and first sentence of the description by substring.

Data: 1,128 tools. Query sets are in `tests/data/tool-queries.json`: 20 dev queries (used while tuning the vocabulary table and threshold), 20 held-out queries written before tuning, 8 out-of-scope queries (also used to set the abstention threshold).

| Set | Method | recall@5 | recall@15 | hit@5 | MRR |
|---|---|---|---|---|---|
| dev (20) | previous | 0.208 | 0.431 | 0.35 | 0.252 |
| dev (20) | current | 0.616 | 0.857 | 0.90 | 0.721 |
| held-out (20) | previous | 0.285 | 0.511 | 0.50 | 0.327 |
| held-out (20) | current | 0.517 | 0.824 | 0.80 | 0.617 |

Abstention: on 8 out-of-scope queries the previous method returned results for 7; the current one returns none. Cost: 3 of 40 in-scope queries are wrongly refused (7.5%).

Limits: relevance labels were judged by the author; the vocabulary table is hand-made and covers common investigation tasks only; the held-out set is small, so the held-out gain is the figure to trust more.

## 2. Page support check in the Worker (`supportOf` in `worker/rag-worker.js`)

Change: stemmed term overlap; numbers must appear in the best sentence or its neighbours (not anywhere on the page); a best sentence whose negation parity differs from the claim is not treated as support. The negation rule is a weak heuristic (a plain "لا" in an unrelated clause can trigger it).

Data: 25 claim/page pairs in `tests/data/grounding-cases.json`. The negation and distant-number cases were written to exercise the new rules, so the gain on them is by design.

| Rule | Correct decisions |
|---|---|
| previous | 12 / 25 |
| current | 24 / 25 |

The remaining miss is a broken-plural case (الوزراء / الوزير) that a light stemmer cannot join. The change does not alter model prompts, and it needs a Worker deployment to take effect on the live site.
