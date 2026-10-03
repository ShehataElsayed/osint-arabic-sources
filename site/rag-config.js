// Backend endpoint for the RAG section. Empty until the free backend is set up; the page then runs in local mode.
export const BACKEND_URL = 'https://osint-rag.egkrkr.workers.dev';
// Measured line shown on the page. Source: newsrag verdict+abstention component, Misbar claims test split 2023+, 2 Oct 2026 run.
// Replace with the Kaggle four-stage pipeline numbers when that run finishes.
export const MEASURED = 'مكوّن الحكم والامتناع في المكتبة، مقاس على مجموعة اختبار خاصة: دقة الحكم الخام 84.1% مقابل 84.3% لأغلبية الفئة، وعند الامتناع عن الحالات الضعيفة يُجاب على 60.9% من الحالات بدقة 93.2%.';
// The Worker forwards request text to an external AI service. Pages show a data-use notice while this is true.
export const EXTERNAL_AI = true;
