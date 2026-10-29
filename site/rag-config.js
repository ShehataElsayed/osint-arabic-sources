// Backend endpoint for the RAG section: the project's Cloudflare Worker. Generation provider is
// pinned to Workers AI while the Gemini project's current free plan is unverified; once verified,
// AI_PROVIDER=gemini-first runs generation on Google Gemini (free tier, user-requested link
// 2026-10-30) called BY THE WORKER server-side - the API key never reaches the browser or this
// repository - with automatic fallback to Workers AI. Embeddings stay on Workers AI bge-m3.
export const BACKEND_URL = 'https://osint-rag.egkrkr.workers.dev';
// Research-plan generation on smart-search: OFF until BOTH the production worker carries the
// research_plan route AND the Gemini provider is activated (pending current billing verification).
// While false the page never calls the route - no wasted calls against an old worker, no fake plan.
export const RESEARCH_PLAN = false;
// Measured line shown on the page. Source: newsrag verdict+abstention component, Misbar claims test split 2023+, 2 Oct 2026 run.
// Replace with the Kaggle four-stage pipeline numbers when that run finishes.
// Historical lab metrics (84.1% raw verdict accuracy, 93.2% at 60.9% coverage) belong to the old
// lab tool's private test split (see newsrag library CHANGELOG/methodology), NOT to this assistant,
// and are intentionally not shown on this page.
// The Worker processes request text on Cloudflare (Workers AI); when the Gemini provider is
// enabled it may pass it to Google (Gemini API free tier), where Google may use content to improve
// its products per its terms. Pages show a data-use notice while requests leave the device.
export const EXTERNAL_AI = true;
