# Contributing

Thanks for your interest. The most useful contributions: fixing a dead link, suggesting a source or tool, improving an explanation, and reporting a wrong result from the verification tool.

## Before you start

- The site UI is fully Arabic with the Cairo font. Write visible site text in Arabic. Repository docs are in English.
- Do not add "verified" or "100%" claims without a documented measurement.
- Do not add text from AFP, Misbar or AraFacts. Fact-check items are a short snippet plus a link.
- Never commit keys or passwords. Secrets are set in Cloudflare.
- Do not add material without a clear license. State its source and license in the pull request.

## Steps

1. Open an issue first for larger changes.
2. Fork the repository and create a clearly named branch (`fix/broken-link-xyz`).
3. Run locally:
   ```sh
   npm ci
   npm run build
   npm test
   npm run check:js
   ```
4. Open a pull request into `main` and fill in the template. `main` is protected and deploys automatically after merge.

## Suggesting a source or tool

Add it to `2-data.json` (source map), `data/libs.json` or `data/aitools.json` with a name, category, a short Arabic description and the official link. Check that the link works and the tool still exists.

## Changing the verification tool

Edit `worker/rag-worker.js` and `tests/rag-worker.test.mjs` together, then update [docs/how-verification-works.md](docs/how-verification-works.md). The Worker is deployed separately (see [docs/deployment.md](docs/deployment.md)), so say in the pull request that it needs a deploy.

## Security and privacy

Report a vulnerability privately through GitHub security advisories if they are enabled. Do not open a public issue.
