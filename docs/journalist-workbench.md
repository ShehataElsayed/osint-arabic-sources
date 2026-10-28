# Non-AI journalist workbench

User pivot 28 October 2026: build all ten without AI now, defer AI. This page contains no model runtime or remote inference. Existing rejected private model work remains separate.

- Claims: exact-span sentence segmentation, number/negation spotting, human selection, evidence direction and notes.
- Entities: human-entered subject/relation/object, literal unique source quote and entity presence checks, graph.
- Timeline: date-pattern candidates, relative/ambiguous dates remain unresolved, valid ISO manual sort, editable event.
- Versions: exact line-LCS insert/delete/equal output, raw numeric and negation token lists. Not semantic difference.
- OCR: actual self-hosted Tesseract.js 5.1.1 + core 5.1.1, Arabic/English traineddata, original visible, raw text preserved. Synthetic test misreads ١٢ as ١١7. Mandatory original review.
- Translation: human-aligned translation with surface number/negation checks. No automatic translation.
- Image: actual local file SHA-256, browser dimensions, context/source notes. Not EXIF/location/authenticity detection.
- Video: actual four temporal sample frames, approximate browser offsets, per-frame JPEG download, raw report and human notes. No audio or authenticity detection; short events can be missed.
- Domain: actual URL parser and source-backed manually compiled dossier. No live WHOIS/DNS lookup.
- Planner: fixed editable material-type plans with local tool routing and evidence notes. No autonomous research.

Immutable source snapshots and exact quote offsets remain with records. JSON import rejects mismatched quotes, malformed schema and unknown tool IDs. Plain-text export and JSON backup available. Per-tab input drafts stay in page memory while switching tools. No automatic persistence: download before closing. Local case text never uploaded. Package dependencies self-hosted.

Tests: node --test tests/journalist-core.test.mjs; node tests/journalist-workbench.cjs (CHROME_PATH may override browser). Synthetic test fixtures are not news or verified sources.
