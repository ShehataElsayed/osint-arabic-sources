// Backend endpoint for the RAG section. Empty until the free backend is set up; the page then runs in local mode.
export const BACKEND_URL = ''; // stale worker removed for the static-only build (2026-10-29 decision): assistant runs local mode, no question text leaves the device
// Measured line shown on the page. Source: newsrag verdict+abstention component, Misbar claims test split 2023+, 2 Oct 2026 run.
// Replace with the Kaggle four-stage pipeline numbers when that run finishes.
// Historical lab metrics (84.1% raw verdict accuracy, 93.2% at 60.9% coverage) belong to the old
// lab tool's private test split (see newsrag library CHANGELOG/methodology), NOT to this assistant,
// and are intentionally not shown on this page.
// The Worker forwards request text to an external AI service. Pages show a data-use notice while this is true.
// Static-only build (2026-10-29 judging decision): no backend, no external AI calls.
// The worker endpoint above is stale; re-enable only after an explicit approved backend decision.
export const EXTERNAL_AI = false;
