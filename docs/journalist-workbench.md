# Non-AI journalist workbench

User pivot 28 October 2026: build all ten without AI now, defer AI. This page contains no model runtime or remote inference. Existing rejected private model work remains separate.

- Claims: exact-span sentence segmentation, number/negation spotting, human selection, evidence direction and notes.
- Entities: human-entered subject/relation/object, literal unique source quote and entity presence checks, graph.
- Timeline: date-pattern candidates, relative/ambiguous dates remain unresolved, valid ISO manual sort, editable event.
- Versions: exact line-LCS insert/delete/equal output, raw numeric and negation token lists. Not semantic difference.
- OCR: actual self-hosted Tesseract.js 5.1.1 + core 5.1.1, Arabic/English traineddata, original visible, raw text preserved. Synthetic test misreads ١٢ as ١١7. Mandatory original review.
- Translation: human-aligned translation with surface number/negation checks. No automatic translation.
- Image: actual local SHA-256, dimensions, JPEG/PNG structure read (markers, DQT quantization tables, approximate IJG quality estimate), EXIF/eXIf metadata (camera, software, dates, recorded GPS), client-side JPEG-90 recompression difference and local noise map as visual review clues, optional user-clicked Nominatim reverse lookup of recorded coordinates (coordinates only, with ODbL attribution), and user-supplied published-URL reverse-search links (Google Lens/TinEye/Yandex, no local upload). Metadata is editable and indicators are clues: no authenticity, manipulation, location or date verdicts.
- Video: actual four temporal sample frames, approximate browser offsets, per-frame JPEG download, raw report and human notes. No audio or authenticity detection; short events can be missed.
- Domain: actual URL parser and source-backed manually compiled dossier. Optional explicit Google Public DNS A lookup, with domain-only disclosure, timeout, source URL, raw response and timestamp. No automatic WHOIS. See https://developers.google.com/speed/public-dns/docs/doh/json . No network by default.
- Planner: fixed editable material-type plans with local tool routing and evidence notes. No autonomous research.

Immutable source snapshots and exact quote offsets remain with records. JSON import rejects mismatched quotes, malformed schema and unknown tool IDs. Plain-text export and JSON backup available. Per-tab input drafts stay in page memory while switching tools. No automatic persistence: download before closing. Local case text never uploaded. Package dependencies self-hosted.

Tests: node --test tests/journalist-core.test.mjs tests/image-analysis.test.mjs; node tests/journalist-workbench.cjs (CHROME_PATH may override browser). Synthetic test fixtures are not news or verified sources.
