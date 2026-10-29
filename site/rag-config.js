// Backend endpoint for the RAG section: the project's Cloudflare Worker. All AI runs on Cloudflare
// Workers AI inside that worker (no external AI provider, no API key, free allocation enforced by
// the platform). Restored 2026-10-29 after the static-only interlude.
export const BACKEND_URL = 'https://osint-rag.egkrkr.workers.dev';
// Measured line shown on the page. Source: newsrag verdict+abstention component, Misbar claims test split 2023+, 2 Oct 2026 run.
// Replace with the Kaggle four-stage pipeline numbers when that run finishes.
// Historical lab metrics (84.1% raw verdict accuracy, 93.2% at 60.9% coverage) belong to the old
// lab tool's private test split (see newsrag library CHANGELOG/methodology), NOT to this assistant,
// and are intentionally not shown on this page.
// The Worker processes request text on Cloudflare (Workers AI); no external AI service is involved.
// Pages show a data-use notice while requests leave the device.
export const EXTERNAL_AI = true;
