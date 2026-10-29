// Backend endpoint for the RAG section: the project's Cloudflare Worker. Generation runs on Google
// Gemini (free tier, user-requested link 2026-10-30) called BY THE WORKER server-side - the API key
// never reaches the browser or this repository - with automatic fallback to Cloudflare Workers AI
// inside the same worker. Embeddings stay on Workers AI bge-m3.
export const BACKEND_URL = 'https://osint-rag.egkrkr.workers.dev';
// Measured line shown on the page. Source: newsrag verdict+abstention component, Misbar claims test split 2023+, 2 Oct 2026 run.
// Replace with the Kaggle four-stage pipeline numbers when that run finishes.
// Historical lab metrics (84.1% raw verdict accuracy, 93.2% at 60.9% coverage) belong to the old
// lab tool's private test split (see newsrag library CHANGELOG/methodology), NOT to this assistant,
// and are intentionally not shown on this page.
// The Worker processes request text on Cloudflare and may pass it to Google (Gemini API free tier)
// for generation; on the free tier Google may use content to improve its products per its terms.
// Pages show a data-use notice while requests leave the device.
export const EXTERNAL_AI = true;
