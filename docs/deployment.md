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
