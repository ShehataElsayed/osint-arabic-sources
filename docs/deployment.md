# Deployment

## Site (GitHub Pages)

`.github/workflows/deploy.yml` runs on any push to `main` that touches `site/`, `data/`, `scripts/`, `tests/`, package files, `2-data.json` or `3-review-queue.json`. It installs Node 22 and Python 3.12, runs `npm run build` and `npm test`, then publishes `_site`. `main` is protected, so changes go through a pull request.

## Worker (Cloudflare, free plan)

The code is in `worker/rag-worker.js`. The workflow above does not deploy it; deploy it by hand (Cloudflare dashboard, or `wrangler deploy` from `worker/`). After any change to the file, deploy it and confirm the live Worker matches the repository.

Secrets are set in Cloudflare and never written to the repository:

| Name | Use |
|---|---|
| `GEMINI_API_KEY`, `GEMINI_MODEL` | External model service for `verify`, `recommend`, `compose` and `plan` |
| `EXA_API_KEY` | Web search: link repair, claim sources, smart-search links. Optional; without it those steps are skipped quietly |
| `FACTCHECK_API_KEY` | Google Fact Check Tools. Optional; without it the default lookup is off |

The Worker address is in `site/rag-config.js`. The only allowed origin is the GitHub Pages site.

## Free-plan limits

- 50 subrequests per request. `verify` uses about 13, and up to about 30 with repair and search.
- The free model quota runs out; the page then shows that the service is busy.
- The search cache lives only as long as a Worker instance.

## Test before merging

```sh
npm ci && npm run build && npm test && npm run check:js
```

## Parity record: local ONNX int8 asset vs live Workers AI bge-m3 (2026-10-30)

Release gate for the full-catalogue semantic ranking (PR #124), run BEFORE merge and before any
production worker write, via the temporary probe worker `osint-rag-parity-probe` (same AI binding,
returns raw embeddings; not linked from the site). Measured on the 48 eval queries:

- Encoder parity: cosine(live CF vector, local ONNX int8 vector) mean 0.9816, min 0.9694.
- Ranking parity (CF query vector x committed int8 catalogue, exactly the production
  configuration): top-10 overlap with the local-vector ranking mean 8.8/10, min 7.
- Semantic-only quality, like-for-like: held-out recall@15 CF 0.602 vs local 0.634; dev CF 0.654
  vs local 0.649. Within the gate tolerance (0.06); the fused production path adds lexical on top.
- Full fused-path eval with live CF query vectors (`CF_VECTORS=/tmp/cf-vectors.json node
  tests/semantic-catalog.eval.mjs`): held-out recall@15 0.929 vs the 12-cap baseline 0.678;
  hit@5 0.85 vs 0.80; MRR 0.646 vs 0.600; out-of-scope 0/8 shown, abstention gates intact.

Verdict: PASS. Gate command: `PROBE_URL=<probe> python3 scripts/parity_check.py` (exit 0).
Note: Cloudflare's workers.dev edge rejects the default python urllib user-agent (403); the
script sets a curl UA. Workers AI embeddings vary slightly run to run (observed ~1e-3 in early
coordinates), so parity numbers are reproducible up to that noise, not bit-stable.
